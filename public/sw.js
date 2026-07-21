const VERSION = '5.11.0';
const CACHE = `chute-mundo-${VERSION}`;
const APP_SHELL = [
  '/', '/manifest.webmanifest', '/icons/chute-mundo.svg',
  '/chute-official.css?v=5.6.0', '/chute-official.mjs?v=5.6.0', '/chute-v511.css?v=5.11.0',
  '/chute-v511-core.mjs?v=5.11.0', '/chute-v511-fixture.mjs?v=5.11.0',
  '/chute-v511-awards.mjs?v=5.11.0', '/chute-v511-tournament-ui.mjs?v=5.11.0',
  '/chute-v511-match-ui.mjs?v=5.11.0', '/chute-v511-cards.mjs?v=5.11.0',
  '/chute-v511-quality-scan.mjs?v=5.11.0', '/chute-v511-admin-tools.mjs?v=5.11.0',
  '/chute-v511-actions.mjs?v=5.11.0', '/chute-v511-runtime.mjs?v=5.11.0'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('chute-mundo-') && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put('/', copy));
      return response;
    }).catch(() => caches.match('/')));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => {
    const network = fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
      return response;
    }).catch(() => cached);
    return cached || network;
  }));
});
