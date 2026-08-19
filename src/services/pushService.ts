import { getMessaging, getToken, onMessage, isSupported, type Messaging } from 'firebase/messaging';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { app, auth, db } from './firebaseService';

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

// URL del endpoint PHP que de verdad dispara el push (server/fcm-send.php),
// mismo patrón opcional que VITE_GEMINI_PROXY_URL. Sin ella, sendPushToUser
// no intenta ninguna llamada de red — falla en silencio y con honestidad, no
// rompe nada de lo que sí funciona hoy.
const FCM_SEND_URL = import.meta.env.VITE_FCM_SEND_URL as string | undefined;

// Dispara un push REAL al usuario `targetUid`, a través del proxy PHP
// server/fcm-send.php (que a su vez llama a la API HTTP v1 de FCM con las
// credenciales de la cuenta de servicio que solo vive en el servidor).
//
// Quién llama a esto es responsabilidad de cada call site, no de esta
// función: pensada para ChatScreen (nuevo mensaje), solicitudes de conexión,
// etc. — deliberadamente NO se engancha sola a ningún evento todavía.
//
// Por qué el propio cliente lee fcmTokens de Firestore en vez de que lo haga
// el PHP: firestore.rules ya permite `get` en users/{uid} a cualquier
// usuario con sesión (línea ~44), así que no hace falta que el servidor PHP
// tenga ninguna credencial de Firestore — se mantiene fcm-send.php sin
// ninguna dependencia de Firestore, tal y como pide el diseño.
//
// Devuelve { ok: true } si se pudo intentar el envío (aunque algún token
// individual falle en el servidor — ver el array `results` en la respuesta
// del PHP), o { ok: false, error } si no se pudo ni intentar (sin configurar,
// sin sesión, el usuario destino no tiene tokens, etc.). Pensado para
// llamarse "best-effort": un fallo aquí nunca debe romper la acción principal
// (enviar el mensaje, crear la solicitud de conexión...) que lo dispara.
export async function sendPushToUser(
  targetUid: string,
  title: string,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  if (!FCM_SEND_URL) {
    return { ok: false, error: 'Push real no configurado todavía (falta VITE_FCM_SEND_URL).' };
  }
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return { ok: false, error: 'No hay sesión activa.' };
  }

  try {
    const targetSnap = await getDoc(doc(db, `users/${targetUid}`));
    const tokens: string[] = targetSnap.exists() ? targetSnap.data().fcmTokens ?? [] : [];
    if (tokens.length === 0) {
      return { ok: false, error: 'El usuario destino no tiene notificaciones push activadas.' };
    }

    const idToken = await currentUser.getIdToken();

    const response = await fetch(FCM_SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens, title, body, idToken }),
    });

    if (!response.ok) {
      const errPayload = await response.json().catch(() => ({}));
      return { ok: false, error: errPayload.error || `El servidor de push respondió ${response.status}.` };
    }

    return { ok: true };
  } catch (err) {
    console.error('[pushService] Error enviando push a', targetUid, err);
    return { ok: false, error: 'No se pudo contactar el servidor de push.' };
  }
}
