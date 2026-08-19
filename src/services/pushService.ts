import { getMessaging, getToken, onMessage, isSupported, type Messaging } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { app, db } from './firebaseService';

// Notificaciones push reales (FCM), 100% gratis — FCM en sí nunca ha pedido
// plan Blaze, sea cual sea el volumen. Lo que sí pide Blaze es un disparador
// automático del lado servidor (Cloud Functions); ver server/fcm-send.php
// para el camino gratis a eso (mismo hosting PHP que ya usa el proxy de
// Gemini, sin Cloud Functions).
//
// VITE_FCM_VAPID_KEY es la "clave pública Web Push" — se genera gratis en
// Firebase Console → Configuración del proyecto → Cloud Messaging → Web Push
// certificates → "Generar par de claves". Sin ella, todo esto queda
// desactivado con honestidad (igual que VITE_GEMINI_PROXY_URL /
// VITE_FIREBASE_STORAGE_ENABLED / VITE_FACEBOOK_APP_ID): no se pide permiso
// de notificaciones del sistema operativo por push real, la app no promete
// nada que no pueda cumplir.
const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY as string | undefined;

export function isPushConfigured(): boolean {
  return Boolean(VAPID_KEY);
}

let messagingInstance: Messaging | null | undefined; // undefined = aún no comprobado

async function getMessagingInstance(): Promise<Messaging | null> {
  if (messagingInstance !== undefined) return messagingInstance;
  const supported = await isSupported().catch(() => false);
  messagingInstance = supported ? getMessaging(app) : null;
  return messagingInstance;
}

// Pide permiso de notificaciones del SO + un token FCM real para este
// dispositivo, y lo guarda en users/{uid}.fcmTokens (array — un mismo
// usuario puede tener el móvil y el ordenador a la vez, cada uno con su
// propio token). Reutiliza el mismo service worker de caché (public/sw.js)
// en vez de registrar uno nuevo aparte — ver el comentario en sw.js sobre
// por qué.
export async function enablePushNotifications(uid: string): Promise<{ ok: boolean; error?: string }> {
  if (!VAPID_KEY) {
    return { ok: false, error: 'Las notificaciones push no están configuradas todavía (falta VITE_FCM_VAPID_KEY).' };
  }
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return { ok: false, error: 'Este navegador no soporta notificaciones push.' };
  }

  try {
    const messaging = await getMessagingInstance();
    if (!messaging) {
      return { ok: false, error: 'Este navegador no soporta Firebase Messaging.' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, error: 'Permiso de notificaciones denegado.' };
    }

    const swRegistration = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swRegistration });
    if (!token) {
      return { ok: false, error: 'No se pudo obtener el token de este dispositivo.' };
    }

    await updateDoc(doc(db, `users/${uid}`), { fcmTokens: arrayUnion(token) });
    return { ok: true };
  } catch (err) {
    console.error('[pushService] Error activando notificaciones push:', err);
    return { ok: false, error: 'No se pudo activar el push en este dispositivo.' };
  }
}

// Deja de recibir push en ESTE dispositivo (borra solo su propio token, no
// los de otros dispositivos del mismo usuario).
export async function disablePushNotifications(uid: string): Promise<void> {
  if (!VAPID_KEY) return;
  try {
    const messaging = await getMessagingInstance();
    if (!messaging) return;
    const swRegistration = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swRegistration });
    if (token) {
      await updateDoc(doc(db, `users/${uid}`), { fcmTokens: arrayRemove(token) });
    }
  } catch (err) {
    console.warn('[pushService] No se pudo desactivar limpiamente el push:', err);
  }
}

// Mensajes en primer plano (app abierta) — FCM no dispara sola una
// notificación de sistema si la pestaña está activa, así que esto la crea
// a mano con el mismo contenido real que llegó.
export async function listenForForegroundPush(onMessageReceived: (title: string, body: string) => void) {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title || payload.data?.title || 'EG CONNECT';
    const body = payload.notification?.body || payload.data?.body || '';
    onMessageReceived(title, body);
  });
}
