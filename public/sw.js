importScripts('/version.js');

const VERSION = self.CHUTE_APP_VERSION || '6.0.0';
const CACHE = `chute-mundo-v${VERSION}`;
const APP_SHELL = [
  '/',
  '/index.html',
  '/version.js',
  '/firebase-config.json',
  '/official-history.json',
  `/chute-official.css?v=${VERSION}`,
  `/app.mjs?v=${VERSION}`,
  `/styles/enhancements.css?v=${VERSION}`,
  `/modules/ui/enhancements.mjs?v=${VERSION}`,
  '/manifest.webmanifest',
  '/chute-icon.svg',
  '/chute-icon-maskable.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('chute-mundo-') && key !== CACHE)
          .map((key) => caches.delete(key))
      )
    ),
    self.clients.claim()
  ]));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request, fallbackUrl = '') {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (
      (await caches.match(request)) ||
      (fallbackUrl ? await caches.match(fallbackUrl, { ignoreSearch: true }) : undefined) ||
      Response.error()
    );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, '/index.html'));
    return;
  }

  if (/\.(?:png|jpg|jpeg|webp|svg|woff2?)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  if (/\.(?:mjs|js|css|txt|json)$/i.test(url.pathname)) {
    event.respondWith(networkFirst(event.request));
  }
});
