const CACHE_NAME = 'eg-connect-v2';

// The precache list used to hardcode dev-only paths (/src/main.tsx, /src/App.tsx)
// that don't exist in the production build, which made cache.addAll() reject and
// the service worker fail to install. Assets are hashed per-build (index-XXXX.js),
// so instead we cache opportunistically at fetch time: serve from cache first for
// speed/offline, but always refresh the cache from the network in the background.

// Firebase Cloud Messaging — mensajes en segundo plano (app cerrada/en background).
// Se registra en ESTE mismo service worker (no uno aparte en /firebase-messaging-sw.js)
// porque dos SW registrados en la misma scope compiten por el control de la página;
// el cliente (pushService.ts) le pasa esta misma registración a getToken() para que
// FCM entregue aquí. importScripts funciona porque los service workers sí soportan
// scripts clásicos aunque el resto de la app use ES modules. Si algún día no hay
// mensajería configurada (VITE_FCM_VAPID_KEY vacío), esto simplemente nunca recibe
// nada — no rompe el resto del service worker.
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  projectId: 'gen-lang-client-0951010679',
  apiKey: 'AIzaSyCan2hNF6D-EAaLBTxiB74HOs3ifwO7UTc',
  authDomain: 'gen-lang-client-0951010679.firebaseapp.com',
  storageBucket: 'gen-lang-client-0951010679.firebasestorage.app',
  messagingSenderId: '160571429313',
  appId: '1:160571429313:web:866a80978a06cdcd429f40'
});

try {
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || payload.data?.title || 'EG CONNECT';
    const body = payload.notification?.body || payload.data?.body || '';
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/favicon-32.png'
    });
  });
} catch (err) {
  // No hay Messaging válido en este contexto (p.ej. navegador sin soporte) —
  // el resto del service worker (caché offline) sigue funcionando igual.
  console.warn('[sw.js] Firebase Messaging no disponible en este service worker:', err);
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
