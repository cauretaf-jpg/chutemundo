const APP_VERSION = '5.21.0';
const APP_TITLE = `Chute Mundo v${APP_VERSION} · Competición`;
const CACHE_NAME = `chute-mundo-v${APP_VERSION}`;
const RESET_KEY = `cm_runtime_reset_${APP_VERSION.replaceAll('.', '_')}`;
const RESET_QUERY = 'cmfresh';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const nativeServiceWorkerRegister = 'serviceWorker' in navigator
  ? navigator.serviceWorker.register.bind(navigator.serviceWorker)
  : null;
const nativeServiceWorkerAddEventListener = 'serviceWorker' in navigator
  ? navigator.serviceWorker.addEventListener.bind(navigator.serviceWorker)
  : null;
const titleDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'title');
const nodeTextDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');

let userNavigated = false;
let bootCompleted = false;

function installCanonicalVersionLock() {
  titleDescriptor?.set?.call(document, APP_TITLE);
  try {
    Object.defineProperty(document, 'title', {
      configurable: true,
      get: () => APP_TITLE,
      set: (value) => {
        if (value === APP_TITLE) titleDescriptor?.set?.call(document, APP_TITLE);
        else console.info(`Se ignoró un título heredado: ${String(value)}`);
      }
    });
  } catch (error) {
    console.warn('No se pudo bloquear el título global.', error);
  }

  const heroVersion = document.querySelector('.hero .eyebrow');
  if (!heroVersion || !nodeTextDescriptor) return;
  const canonicalHero = `CHUTE MUNDO v${APP_VERSION}`;
  const nativeReplaceChildren = heroVersion.replaceChildren.bind(heroVersion);
  nodeTextDescriptor.set.call(heroVersion, canonicalHero);
  try {
    Object.defineProperty(heroVersion, 'textContent', {
      configurable: true,
      get: () => canonicalHero,
      set: (value) => {
        const text = String(value ?? '');
        if (!/^CHUTE MUNDO v\d/i.test(text) || text === canonicalHero) {
          nodeTextDescriptor.set.call(heroVersion, text === canonicalHero ? canonicalHero : text);
        } else {
          console.info(`Se ignoró un encabezado heredado: ${text}`);
        }
      }
    });
    heroVersion.replaceChildren = (...nodes) => {
      const text = nodes.map((node) => typeof node === 'string' ? node : node?.textContent || '').join('');
      if (/^CHUTE MUNDO v\d/i.test(text) && text !== canonicalHero) {
        console.info(`Se ignoró un encabezado heredado: ${text}`);
        return;
      }
      nativeReplaceChildren(...nodes);
    };
  } catch (error) {
    console.warn('No se pudo bloquear el encabezado de versión.', error);
  }
}

function installServiceWorkerListenerGuard() {
  if (!nativeServiceWorkerAddEventListener || navigator.serviceWorker.addEventListener.__cmStableListenerGuard) return;
  const guardedAddEventListener = (type, listener, options) => {
    if (type === 'controllerchange') {
      console.info('Se ignoró una recarga heredada por cambio de service worker.');
      return;
    }
    return nativeServiceWorkerAddEventListener(type, listener, options);
  };
  Object.defineProperty(guardedAddEventListener, '__cmStableListenerGuard', { value: true });
  navigator.serviceWorker.addEventListener = guardedAddEventListener;
}

function applyVersion() {
  document.documentElement.dataset.chuteVersion = APP_VERSION;
  if (document.title !== APP_TITLE) document.title = APP_TITLE;
  const heroVersion = document.querySelector('.hero .eyebrow');
  if (heroVersion && heroVersion.textContent !== `CHUTE MUNDO v${APP_VERSION}`) heroVersion.textContent = `CHUTE MUNDO v${APP_VERSION}`;
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
  if (!nativeServiceWorkerRegister) return null;
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing && workerVersion(existing) === APP_VERSION) return existing;
  const registration = await nativeServiceWorkerRegister(`/sw.js?v=${APP_VERSION}`, { scope: '/', updateViaCache: 'none' });
  await waitForActivation(registration);
  return registration;
}

function installServiceWorkerRegistrationGuard() {
  if (!nativeServiceWorkerRegister || navigator.serviceWorker.register.__cmStableBootstrap) return;
  const guardedRegister = (scriptURL, options = {}) => {
    let requestedVersion = '';
    let requestedPath = '';
    try {
      const requested = new URL(String(scriptURL), window.location.href);
      requestedVersion = requested.searchParams.get('v') || '';
      requestedPath = requested.pathname;
    } catch {}
    if (requestedPath.endsWith('/sw.js') && requestedVersion !== APP_VERSION) {
      console.info(`Se ignoró un registro PWA heredado (${requestedVersion || 'sin versión'}).`);
      return registerCurrentWorker();
    }
    return nativeServiceWorkerRegister(scriptURL, options);
  };
  Object.defineProperty(guardedRegister, '__cmStableBootstrap', { value: true });
  navigator.serviceWorker.register = guardedRegister;
}

async function resetLegacyRuntimeOnce() {
  if (LOCAL_HOSTS.has(window.location.hostname)) {
    removeResetQuery();
    return;
  }
  let alreadyReset = false;
  try { alreadyReset = localStorage.getItem(RESET_KEY) === 'done'; } catch {}
  if (alreadyReset) {
    removeResetQuery();
    try { await registerCurrentWorker(); } catch (error) { console.warn('No se pudo registrar el service worker actual.', error); }
    return;
  }

  let cleaned = false;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.filter((name) => name.startsWith('chute-mundo-')).map((name) => caches.delete(name)));
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

document.addEventListener('chute:ready', applyVersion);
const title = document.querySelector('title');
if (title) new MutationObserver(applyVersion).observe(title, { childList: true, subtree: true, characterData: true });

window.ChuteVersion = Object.freeze({
  version: APP_VERSION,
  title: APP_TITLE,
  cacheName: CACHE_NAME,
  apply: applyVersion,
  registerCurrentWorker,
  get bootCompleted() { return bootCompleted; }
});

installServiceWorkerRegistrationGuard();
installServiceWorkerListenerGuard();
installCanonicalVersionLock();
applyVersion();
await resetLegacyRuntimeOnce();
