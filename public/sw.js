const CACHE = 'chute-mundo-v5.14.0';
const CORE = ['/', '/index.html', '/chute-official.css?v=5.14.0', '/chute-official.mjs?v=5.14.0', '/chute-v513-lineups.mjs?v=5.13.0', '/chute-v513-lineups.css?v=5.13.0', '/chute-v514-unified-match.mjs?v=5.14.0', '/chute-v514-unified-match.css?v=5.14.0', '/manifest.webmanifest', '/chute-icon.svg', '/chute-icon-maskable.svg'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
      return response;
    }).catch(() => caches.match('/index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => {
    const network = fetch(event.request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => cached);
    return cached || network;
  }));
});
