const CACHE_NAME = 'eg-connect-v2';

// The precache list used to hardcode dev-only paths (/src/main.tsx, /src/App.tsx)
// that don't exist in the production build, which made cache.addAll() reject and
// the service worker fail to install. Assets are hashed per-build (index-XXXX.js),
// so instead we cache opportunistically at fetch time: serve from cache first for
// speed/offline, but always refresh the cache from the network in the background.

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
