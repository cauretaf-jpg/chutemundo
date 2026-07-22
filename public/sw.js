const CACHE = 'chute-mundo-v5.19.0';
const CORE = [
  '/', '/index.html',
  '/chute-official.css?v=5.16.0', '/chute-official.mjs?v=5.19.0', '/chute-official-loader.mjs?v=5.16.0',
  '/chute-detail.mjs?v=5.19.0',
  '/chute-v513-lineups.mjs?v=5.13.0', '/chute-v513-lineups.css?v=5.13.0',
  '/chute-v514-unified-match.mjs?v=5.14.0', '/chute-v514-unified-match.css?v=5.14.0',
  '/chute-v515-match-center.mjs?v=5.15.0', '/chute-v515-match-center.css?v=5.15.0',
  '/chute-v516-events-stats.mjs?v=5.16.1', '/chute-v516-events-stats.css?v=5.16.1',
  ...Array.from({ length: 12 }, (_, index) => `/chute-v516-events-stats-part-${String(index).padStart(2, '0')}.txt?v=5.16.1`),
  '/chute-v5162-playoff-seeding.mjs?v=5.16.3',
  '/chute-v517-finalization.mjs?v=5.17.0', '/chute-v517-finalization.css?v=5.17.0',
  ...Array.from({ length: 8 }, (_, index) => `/chute-v517-finalization-part-${String(index).padStart(2, '0')}.txt?v=5.17.0`),
  '/chute-v5183-stats-preflight.mjs?v=5.18.3',
  '/chute-v519-stats.mjs?v=5.19.0', '/chute-v519-stats.css?v=5.19.0', '/chute-v519-stats-guard.mjs?v=5.19.0',
  '/manifest.webmanifest', '/chute-icon.svg', '/chute-icon-maskable.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

function networkFirst(request, fallback) {
  return fetch(request).then((response) => {
    if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
    return response;
  }).catch(() => caches.match(request).then((cached) => cached || fallback && caches.match(fallback)));
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, '/index.html'));
    return;
  }
  if (/\.(?:mjs|js|css|txt)$/.test(url.pathname)) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || networkFirst(event.request)));
});
