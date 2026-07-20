const VERSION = '5.12.0';
const CACHE = `chute-mundo-${VERSION}`;
const FALLBACK = '/index.html';
const PRECACHE = [
  '/', '/index.html', '/manifest.webmanifest',
  '/icons/chute-192.svg', '/icons/chute-512.svg', '/icons/chute-maskable.svg',
  '/chute-official.mjs?v=5.12.0', '/chute-official.css?v=5.6.0',
  '/chute-v512.css?v=5.12.0'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).catch(() => undefined));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('chute-mundo-') && key !== CACHE).map((key) => caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone()).catch(() => undefined);
    return response;
  } catch (error) {
    return (await cache.match(request)) || (request.mode === 'navigate' ? cache.match(FALLBACK) : Promise.reject(error));
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const update = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone()).catch(() => undefined);
    return response;
  }).catch(() => null);
  return cached || update || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  if (/\.(?:png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (/\.(?:mjs|js|css|json|txt|webmanifest)$/i.test(url.pathname)) event.respondWith(networkFirst(request));
});
