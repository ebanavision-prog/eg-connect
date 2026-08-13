import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebaseService';
import { AppNotification } from '../types';

// Antes el "centro de notificaciones" de la app era un solo aviso de
// licitación fabricado por un setTimeout — nunca reflejaba nada real, y
// `unreadMessageCount` estaba fijo en 0. Este hook deriva notificaciones de
// verdad a partir de datos que ya existen en Firestore (solicitudes de
// conexión y licitaciones publicadas), sin depender de Cloud Functions
// (el proyecto está en el plan Spark, sin funciones de servidor).
//
// El estado de "leído" no vive en el documento origen (no queremos escribir
// campos ajenos en colecciones de otros usuarios) — se guarda localmente,
// por id derivado, igual que el resto del estado puramente local de la app.

const READ_KEY = 'eg_connect_read_notifications';

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // localStorage no disponible — el estado de leído solo dura la sesión.
  }
}

function formatTimestamp(ts: unknown): string {
  if (ts instanceof Timestamp) {
    return ts.toDate().toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  return 'Ahora mismo';
}

interface RawRequest {
  id: string;
  fromUid: string;
  toUid: string;
  fromName: string;
  status: 'pending' | 'accepted' | 'declined';
  pitch?: string;
  createdAt?: unknown;
}

interface RawTender {
  id: string;
  title: string;
  companyName?: string;
  createdAt?: unknown;
}

export function useAppNotifications(uid: string | undefined, usersById: Record<string, string>) {
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds());
  const [incoming, setIncoming] = useState<RawRequest[]>([]);
  const [mine, setMine] = useState<RawRequest[]>([]);
  const [tenders, setTenders] = useState<RawTender[]>([]);

  useEffect(() => {
    if (!uid) {
      setIncoming([]);
      setMine([]);
      return;
    }
    const qIncoming = query(collection(db, 'connectionRequests'), where('toUid', '==', uid), where('status', '==', 'pending'));
    const unsub1 = onSnapshot(qIncoming, (snap) => {
      setIncoming(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RawRequest)));
    });

    const qMine = query(collection(db, 'connectionRequests'), where('fromUid', '==', uid));
    const unsub2 = onSnapshot(qMine, (snap) => {
      setMine(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RawRequest)).filter((r) => r.status !== 'pending'));
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setTenders([]);
      return;
    }
    const qTenders = query(collection(db, 'tenders'), orderBy('createdAt', 'desc'), limit(5));
    const unsub = onSnapshot(qTenders, (snap) => {
      setTenders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RawTender)));
    });
    return () => unsub();
  }, [uid]);

  const notifications: AppNotification[] = useMemo(() => {
    const list: AppNotification[] = [];

    incoming.forEach((r) => {
      const id = `conn-in-${r.id}`;
      list.push({
        id,
        title: 'Nueva solicitud de conexión',
        message: r.pitch ? `${r.fromName}: "${r.pitch}"` : `${r.fromName} quiere conectar contigo.`,
        type: 'message',
        relatedEntityId: r.id,
        timestamp: formatTimestamp(r.createdAt),
        isRead: readIds.has(id)
      });
    });

    mine.forEach((r) => {
      const id = `conn-out-${r.id}`;
      const toName = usersById[r.toUid] || 'El destinatario';
      list.push({
        id,
        title: r.status === 'accepted' ? 'Solicitud aceptada' : 'Solicitud rechazada',
        message: r.status === 'accepted'
          ? `${toName} aceptó tu solicitud de conexión.`
          : `${toName} no aceptó tu solicitud de conexión.`,
        type: 'message',
        relatedEntityId: r.id,
        timestamp: formatTimestamp(r.createdAt),
        isRead: readIds.has(id)
      });
    });

    tenders.forEach((t) => {
      const id = `tender-${t.id}`;
      list.push({
        id,
        title: 'Nueva licitación publicada',
        message: t.companyName ? `${t.title} — ${t.companyName}` : t.title,
        type: 'tender',
        relatedEntityId: t.id,
        timestamp: formatTimestamp(t.createdAt),
        isRead: readIds.has(id)
      });
    });

    return list;
  }, [incoming, mine, tenders, readIds, usersById]);

  const markAsRead = (id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
  };

  const clearAll = () => {
    setReadIds((prev) => {
      const next = new Set(prev);
      notifications.forEach((n) => next.add(n.id));
      saveReadIds(next);
      return next;
    });
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return { notifications, markAsRead, clearAll, unreadCount };
}
