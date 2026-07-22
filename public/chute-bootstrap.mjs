const APP_VERSION = '5.20.1';
const APP_TITLE = `Chute Mundo v${APP_VERSION} · Competición`;
const CACHE_NAME = `chute-mundo-v${APP_VERSION}`;
const RESET_KEY = `cm_runtime_reset_${APP_VERSION.replaceAll('.', '_')}`;
const RESET_QUERY = 'cmfresh';

let userNavigated = false;
let bootCompleted = false;

function applyVersion() {
  document.documentElement.dataset.chuteVersion = APP_VERSION;
  if (document.title !== APP_TITLE) document.title = APP_TITLE;
  const heroVersion = document.querySelector('.hero .eyebrow');
  if (heroVersion && heroVersion.textContent !== `CHUTE MUNDO v${APP_VERSION}`) {
    heroVersion.textContent = `CHUTE MUNDO v${APP_VERSION}`;
  }
}

function removeResetQuery() {
  const url = new URL(window.location.href);
  if (url.searchParams.get(RESET_QUERY) !== APP_VERSION) return;
  url.searchParams.delete(RESET_QUERY);
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function workerVersion(registration) {
  const scriptUrl = registration?.active?.scriptURL || registration?.waiting?.scriptURL || registration?.installing?.scriptURL || '';
  if (!scriptUrl) return '';
  try { return new URL(scriptUrl).searchParams.get('v') || ''; }
  catch { return ''; }
}

function waitForActivation(registration, timeout = 8000) {
  if (!registration || registration.active?.state === 'activated') return Promise.resolve();
  const worker = registration.installing || registration.waiting || registration.active;
  if (!worker) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      worker.removeEventListener('statechange', check);
      resolve();
    };
    const check = () => {
      if (worker.state === 'activated' || registration.active?.state === 'activated' || worker.state === 'redundant') finish();
    };
    const timer = setTimeout(finish, timeout);
    worker.addEventListener('statechange', check);
    check();
  });
}

async function registerCurrentWorker() {
  if (!('serviceWorker' in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing && workerVersion(existing) === APP_VERSION) return existing;
  const registration = await navigator.serviceWorker.register(`/sw.js?v=${APP_VERSION}`, {
    scope: '/',
    updateViaCache: 'none'
  });
  await waitForActivation(registration);
  return registration;
}

async function resetLegacyRuntimeOnce() {
  let alreadyReset = false;
  try { alreadyReset = localStorage.getItem(RESET_KEY) === 'done'; } catch {}

  if (alreadyReset) {
    removeResetQuery();
    try { await registerCurrentWorker(); } catch (error) { console.warn('No se pudo registrar el service worker actual.', error); }
    return;
  }

  let cleaned = false;
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.filter((name) => name.startsWith('chute-mundo-')).map((name) => caches.delete(name)));
    }
    await registerCurrentWorker();
    cleaned = true;
  } catch (error) {
    console.warn('La limpieza automática de caché no pudo completarse.', error);
  }

  try { localStorage.setItem(RESET_KEY, 'done'); } catch {}
  if (!cleaned) return;

  const url = new URL(window.location.href);
  if (url.searchParams.get(RESET_QUERY) === APP_VERSION) return;
  url.searchParams.set(RESET_QUERY, APP_VERSION);
  window.location.replace(url.toString());
  await new Promise(() => {});
}

function restoreHomeAfterBoot(core) {
  if (userNavigated || !core?.navigate) return;
  core.navigate('inicio');
}

document.addEventListener('click', (event) => {
  if (event.target.closest?.('[data-page],[data-cm-page],[data-cm-mobile-page]')) userNavigated = true;
}, true);

document.addEventListener('chute:boot-complete', (event) => {
  bootCompleted = true;
  applyVersion();
  restoreHomeAfterBoot(event.detail?.core || window.ChuteMundoCore);
}, { once: true });

document.addEventListener('chute:ready', () => applyVersion());

const title = document.querySelector('title');
if (title) {
  new MutationObserver(() => {
    if (document.title !== APP_TITLE) document.title = APP_TITLE;
  }).observe(title, { childList: true, subtree: true, characterData: true });
}

window.ChuteVersion = Object.freeze({
  version: APP_VERSION,
  title: APP_TITLE,
  cacheName: CACHE_NAME,
  apply: applyVersion,
  get bootCompleted() { return bootCompleted; }
});

applyVersion();
await resetLegacyRuntimeOnce();
