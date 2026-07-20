const VERSION = '5.12.0';
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
let deferredInstall = null;
let registration = null;

function ensureHead() {
  if (!document.querySelector('link[rel="manifest"]')) {
    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = `/manifest.webmanifest?v=${VERSION}`;
    document.head.appendChild(manifest);
  }
  if (!document.querySelector('link[rel="icon"]')) {
    const icon = document.createElement('link');
    icon.rel = 'icon';
    icon.href = '/icons/chute-192.svg';
    icon.type = 'image/svg+xml';
    document.head.appendChild(icon);
  }
  let theme = document.querySelector('meta[name="theme-color"]');
  if (!theme) {
    theme = document.createElement('meta');
    theme.name = 'theme-color';
    document.head.appendChild(theme);
  }
  theme.content = '#075f49';
}

function ensureUi() {
  const actions = document.querySelector('.top-actions');
  if (!actions) return;
  let install = document.getElementById('cmInstallApp');
  if (!install) {
    install = document.createElement('button');
    install.id = 'cmInstallApp';
    install.type = 'button';
    install.className = 'top-button cm-v511-install';
    install.textContent = standalone() ? 'App instalada' : 'Instalar app';
    install.hidden = standalone() || !deferredInstall;
    actions.insertBefore(install, document.getElementById('authButton'));
  }
  let offline = document.getElementById('cmOfflineStatus');
  if (!offline) {
    offline = document.createElement('span');
    offline.id = 'cmOfflineStatus';
    offline.className = 'cm-v511-offline';
    actions.prepend(offline);
  }
  offline.textContent = navigator.onLine ? '' : 'Sin conexión';
  offline.hidden = navigator.onLine;
}

function showUpdate(worker) {
  if (!worker) return;
  let panel = document.getElementById('cmPwaUpdate');
  if (!panel) {
    panel = document.createElement('aside');
    panel.id = 'cmPwaUpdate';
    panel.className = 'cm-v511-update';
    panel.innerHTML = '<div><strong>Nueva versión disponible</strong><span>Actualiza Chute Mundo sin cerrar la aplicación.</span></div><button type="button">Actualizar ahora</button>';
    document.body.appendChild(panel);
  }
  panel.hidden = false;
  panel.querySelector('button').onclick = () => worker.postMessage({ type: 'SKIP_WAITING' });
}

async function installApp() {
  if (deferredInstall) {
    deferredInstall.prompt();
    await deferredInstall.userChoice.catch(() => null);
    deferredInstall = null;
    ensureUi();
    return;
  }
  const core = window.ChuteMundoCore;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  core?.openModal?.(`<div class="cm-v511-install-help"><p class="eyebrow">INSTALAR CHUTE MUNDO</p><h2>${ios ? 'Agregar a pantalla de inicio' : 'Instalar como aplicación'}</h2><p>${ios ? 'Abre el menú Compartir del navegador y selecciona “Agregar a inicio”.' : 'Abre el menú del navegador y selecciona “Instalar aplicación” o “Agregar a pantalla de inicio”.'}</p><button type="button" class="primary" data-close-modal>Entendido</button></div>`);
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  registration = await navigator.serviceWorker.register(`/sw.js?v=${VERSION}`, { scope: '/' });
  if (registration.waiting) showUpdate(registration.waiting);
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(worker);
    });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
  window.setInterval(() => registration?.update().catch(() => undefined), 30 * 60 * 1000);
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstall = event;
  ensureUi();
});
window.addEventListener('appinstalled', () => {
  deferredInstall = null;
  ensureUi();
  window.ChuteMundoCore?.showToast?.('Chute Mundo quedó instalado como aplicación.');
});
window.addEventListener('online', ensureUi);
window.addEventListener('offline', ensureUi);
document.addEventListener('click', (event) => {
  if (event.target.closest('#cmInstallApp')) void installApp();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) registration?.update().catch(() => undefined);
});

ensureHead();
ensureUi();
registerServiceWorker().catch((error) => console.warn('No se pudo registrar el modo instalable.', error));
window.ChutePWA = { version: VERSION, install: installApp, update: () => registration?.update() };
