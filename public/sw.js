const CACHE = 'chute-mundo-v5.18.3';
const CORE = [
  '/', '/index.html',
  '/chute-official.css?v=5.16.0', '/chute-official.mjs?v=5.18.2', '/chute-official-loader.mjs?v=5.16.0',
  '/chute-detail.mjs?v=5.18.2',
  '/chute-v513-lineups.mjs?v=5.13.0', '/chute-v513-lineups.css?v=5.13.0',
  '/chute-v514-unified-match.mjs?v=5.14.0', '/chute-v514-unified-match.css?v=5.14.0',
  '/chute-v515-match-center.mjs?v=5.15.0', '/chute-v515-match-center.css?v=5.15.0',
  '/chute-v516-events-stats.mjs?v=5.16.1', '/chute-v516-events-stats.css?v=5.16.1',
  ...Array.from({ length: 12 }, (_, index) => `/chute-v516-events-stats-part-${String(index).padStart(2, '0')}.txt?v=5.16.1`),
  '/chute-v5162-playoff-seeding.mjs?v=5.16.3',
  '/chute-v517-finalization.mjs?v=5.17.0', '/chute-v517-finalization.css?v=5.17.0',
  ...Array.from({ length: 8 }, (_, index) => `/chute-v517-finalization-part-${String(index).padStart(2, '0')}.txt?v=5.17.0`),
  '/chute-v5183-stats-preflight.mjs?v=5.18.3',
  '/chute-v518-era-stats.mjs?v=5.18.3', '/chute-v518-era-stats.css?v=5.18.0',
  ...Array.from({ length: 6 }, (_, index) => `/chute-v518-era-stats-part-${String(index).padStart(2, '0')}.txt?v=5.18.3`),
  '/chute-v5181-stats-polish.mjs?v=5.18.1', '/chute-v5181-stats-polish.css?v=5.18.1',
  '/chute-v5182-stats-loader.mjs?v=5.18.3', '/chute-v5183-stats-recovery.mjs?v=5.18.3',
  '/manifest.webmanifest', '/chute-icon.svg', '/chute-icon-maskable.svg'
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
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
