function waitForCore() {
  if (window.ChuteMundoCore) return Promise.resolve(window.ChuteMundoCore);
  return new Promise((resolve) => document.addEventListener('chute:ready', (event) => resolve(event.detail), { once: true }));
}

const core = await waitForCore();
const model = window.ChuteDetailModel;
if (!model) throw new Error('El modelo detallado no está disponible para Chute Mundo v5.11.');

const VERSION = '5.11.0';
const DB_NAME = 'chuteMundoVersiones';
const DB_VERSION = 1;
const STORE_NAME = 'backups';
const MAX_BACKUPS = 12;
const DAILY_BACKUP_KEY = 'chute_mundo_v511_daily_backup';
const { esc } = model;
const clone = (value) => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const norm = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const state = () => core.getState();
const played = (match) => core.matchPlayed(match);
const playerName = (player) => Array.isArray(player) ? String(player[0] || '') : String(player?.name || '');
const playerPosition = (player) => Array.isArray(player) ? String(player[1] || '') : String(player?.position || player?.role || '');
const playerKey = (teamId, name) => `${teamId}__${encodeURIComponent(name)}`;
const matchesOf = (tournament) => (tournament?.matches || []).filter((match) => match.stage !== 'bye');
const nowDate = () => new Date().toLocaleDateString('en-CA');
const nowTime = () => new Date().toTimeString().slice(0, 5);
const originalSetState = core.setState.bind(core);
let backupTimer = 0;
let internalStateWrite = false;
let deferredInstallPrompt = null;
let updateRegistration = null;

function addActivity(targetState, text, type = 'administration') {
  targetState.activity = Array.isArray(targetState.activity) ? targetState.activity : [];
  targetState.activity.unshift({
    id: core.uid('activity'), text, type,
    actor: core.authUser?.email || 'Administrador',
    device: /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'Móvil' : 'Escritorio',
    at: Date.now()
  });
  targetState.activity = targetState.activity.slice(0, 120);
}

function stateSignature(value) {
  return JSON.stringify({
    teams: (value.teams || []).map((team) => [team.id, team.name, team.coach, team.players?.length || 0]),
    tournaments: (value.tournaments || []).map((tournament) => [
      tournament.id, tournament.name, tournament.status, tournament.champion, tournament.runnerUp, tournament.third,
      tournament.startedAt, tournament.finishedAt, tournament.fixtureGeneratedAt,
      (tournament.matches || []).map((match) => [match.id, match.home, match.away, match.homeGoals, match.awayGoals, match.homePens, match.awayPens, match.date, match.time, match.venue, match.goals?.length || 0, match.cards?.length || 0]),
      tournament.awards || null
    ])
  });
}

async function digestText(text) {
  if (!crypto?.subtle) return String(text.length);
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function openBackupDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function listBackups() {
  const db = await openBackupDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve((request.result || []).sort((a, b) => b.at - a.at));
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

async function writeBackupRecord(record) {
  const db = await openBackupDb();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(record);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

async function deleteBackupRecord(id) {
  const db = await openBackupDb();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(id);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

async function createBackup(reason, sourceState = state()) {
  const serialized = JSON.stringify(sourceState);
  const hash = await digestText(serialized);
  const existing = await listBackups();
  if (existing[0]?.hash === hash) return existing[0];
  const record = {
    id: `backup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(), reason, hash, appVersion: VERSION,
    bytes: new Blob([serialized]).size, state: serialized
  };
  await writeBackupRecord(record);
  const rows = await listBackups();
  for (const old of rows.slice(MAX_BACKUPS)) await deleteBackupRecord(old.id);
  window.ChuteV511Internal?.scheduleRefresh?.();
  return record;
}

function scheduleBackup(reason, sourceState) {
  clearTimeout(backupTimer);
  const snapshot = clone(sourceState);
  backupTimer = window.setTimeout(() => {
    void createBackup(reason, snapshot).catch((error) => console.warn('No se pudo crear el respaldo automático.', error));
  }, 180);
}

core.setState = (nextState) => {
  if (!internalStateWrite) {
    const before = clone(state());
    if (stateSignature(before) !== stateSignature(nextState)) scheduleBackup('Antes de un cambio en la base', before);
  }
  return originalSetState(nextState);
};

async function persistMutation(mutator, successText, activityText = successText) {
  if (!core.canEdit()) { document.getElementById('authButton')?.click(); return false; }
  const previous = clone(state());
  const next = clone(previous);
  try {
    mutator(next);
    addActivity(next, activityText);
    core.setState(next);
    await core.saveCloud();
    core.showToast(successText);
    window.ChuteV511Internal?.scheduleRefresh?.();
    return true;
  } catch (error) {
    console.error(error);
    internalStateWrite = true;
    originalSetState(previous);
    internalStateWrite = false;
    core.showToast(`No se aplicaron cambios: ${error.message || error.code || 'error desconocido'}.`);
    return false;
  }
}

function installStyles() {
  if (document.getElementById('cmV511Styles')) return;
  const link = document.createElement('link');
  link.id = 'cmV511Styles';
  link.rel = 'stylesheet';
  link.href = `/chute-v511.css?v=${VERSION}`;
  document.head.appendChild(link);
}

function installManifest() {
  let manifest = document.querySelector('link[rel="manifest"]');
  if (!manifest) { manifest = document.createElement('link'); manifest.rel = 'manifest'; document.head.appendChild(manifest); }
  manifest.href = `/manifest.webmanifest?v=${VERSION}`;
  let apple = document.querySelector('link[rel="apple-touch-icon"]');
  if (!apple) { apple = document.createElement('link'); apple.rel = 'apple-touch-icon'; document.head.appendChild(apple); }
  apple.href = '/icons/chute-mundo.svg';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#086348');
}

function ensureInstallButton() {
  const actions = document.querySelector('.top-actions');
  if (!actions) return;
  let button = document.getElementById('cmV511Install');
  if (!button) {
    button = document.createElement('button');
    button.id = 'cmV511Install';
    button.type = 'button';
    button.className = 'top-button cm-v511-install';
    button.textContent = 'Instalar app';
    button.hidden = true;
    actions.insertBefore(button, document.getElementById('authButton'));
  }
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  button.hidden = standalone || !deferredInstallPrompt;
}

function setInstallPrompt(event) { deferredInstallPrompt = event; ensureInstallButton(); }
function clearInstallPrompt() { deferredInstallPrompt = null; ensureInstallButton(); }
async function promptInstall() {
  if (!deferredInstallPrompt) return;
  await deferredInstallPrompt.prompt();
  try { await deferredInstallPrompt.userChoice; } finally { clearInstallPrompt(); }
}

function showUpdateBanner(registration) {
  updateRegistration = registration;
  let banner = document.getElementById('cmV511Update');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'cmV511Update';
    banner.className = 'cm-v511-update';
    banner.innerHTML = '<strong>Nueva versión disponible</strong><span>Actualiza Chute Mundo para cargar los últimos cambios.</span><button type="button" data-cm-v511-update>Actualizar ahora</button>';
    document.body.appendChild(banner);
  }
  banner.hidden = false;
}

function applyUpdate() { updateRegistration?.waiting?.postMessage({ type: 'SKIP_WAITING' }); }

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register(`/sw.js?v=${VERSION}`, { scope: '/' });
    if (registration.waiting && navigator.serviceWorker.controller) showUpdateBanner(registration);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(registration);
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
  } catch (error) { console.warn('No se pudo registrar el modo instalable.', error); }
}

function openTournament(tournamentId) {
  const button = document.createElement('button');
  button.hidden = true;
  button.dataset.openTournament = tournamentId;
  document.body.appendChild(button);
  button.click();
  button.remove();
}

function openMatch(tournamentId, matchId) {
  core.navigate('partidos');
  window.setTimeout(() => {
    const filter = document.getElementById('matchTournamentFilter');
    if (filter) { filter.value = tournamentId; filter.dispatchEvent(new Event('change', { bubbles: true })); }
    window.setTimeout(() => {
      const pair = `${tournamentId}__${matchId}`;
      const button = [...document.querySelectorAll('[data-cm-v591-live], [data-edit-match]')]
        .find((item) => item.dataset.cmV591Live === pair || item.dataset.editMatch === pair);
      button?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  }, 100);
}

function allSearchRows() {
  const rows = [];
  for (const team of state().teams || []) {
    rows.push({ type: 'team', title: team.name, subtitle: `${team.coach ? `DT: ${team.coach} · ` : ''}${team.players?.length || 0} jugadores`, teamId: team.id, keywords: `${team.name} ${team.coach || ''}` });
    for (const player of team.players || []) {
      const name = playerName(player);
      if (!name) continue;
      rows.push({ type: 'player', title: name, subtitle: `${playerPosition(player) || 'Jugador'} · ${team.name}`, teamId: team.id, playerName: name, keywords: `${name} ${playerPosition(player)} ${team.name}` });
    }
  }
  for (const tournament of state().tournaments || []) {
    rows.push({ type: 'tournament', title: tournament.name, subtitle: `${tournament.status === 'historical' ? 'Finalizado' : tournament.status === 'active' ? 'En disputa' : 'Próximo'} · ${tournament.teamIds?.length || 0} equipos`, tournamentId: tournament.id, keywords: `${tournament.name} ${tournament.status}` });
    for (const match of matchesOf(tournament)) {
      const home = match.home || core.resolveHome(tournament, match);
      const away = match.away || core.resolveAway(tournament, match);
      if (!home || !away) continue;
      const score = played(match) ? `${match.homeGoals}-${match.awayGoals}` : 'Pendiente';
      rows.push({ type: 'match', title: `${core.teamName(home)} vs. ${core.teamName(away)}`, subtitle: `${tournament.name} · ${match.round || match.label || 'Partido'} · ${score}`, tournamentId: tournament.id, matchId: match.id, keywords: `${core.teamName(home)} ${core.teamName(away)} ${tournament.name} ${score} ${match.venue || ''}` });
    }
  }
  return rows;
}

function searchIcon(type) { return ({ team: '🛡️', player: '👤', tournament: '🏆', match: '⚽' })[type] || '•'; }

function renderSearchResults(query = '') {
  const root = document.getElementById('cmV511SearchResults');
  if (!root) return;
  const value = norm(query);
  const rows = allSearchRows().filter((row) => !value || norm(`${row.title} ${row.subtitle} ${row.keywords}`).includes(value)).slice(0, 40);
  root.innerHTML = rows.length ? rows.map((row) => `<button type="button" class="cm-v511-search-result" data-cm-v511-result='${esc(JSON.stringify(row))}'><span>${searchIcon(row.type)}</span><div><strong>${esc(row.title)}</strong><small>${esc(row.subtitle)}</small></div></button>`).join('') : '<div class="cm-v511-empty"><strong>Sin resultados</strong><span>Prueba con otro jugador, club, torneo o resultado.</span></div>';
}

function openGlobalSearch() {
  core.openModal(`<div class="cm-v511-search-modal"><p class="eyebrow">BUSCADOR GLOBAL</p><h2>Explorar Chute Mundo</h2><label class="cm-v511-search-box"><span>⌕</span><input id="cmV511SearchInput" autocomplete="off" placeholder="Jugador, equipo, torneo, partido o resultado"></label><div id="cmV511SearchResults"></div></div>`);
  renderSearchResults('');
  const input = document.getElementById('cmV511SearchInput');
  input?.focus();
  input?.addEventListener('input', () => renderSearchResults(input.value));
}

function ensureSearchButton() {
  const actions = document.querySelector('.top-actions');
  if (!actions || document.getElementById('cmV511SearchButton')) return;
  const button = document.createElement('button');
  button.id = 'cmV511SearchButton';
  button.type = 'button';
  button.className = 'top-button cm-v511-search-button';
  button.textContent = 'Buscar';
  actions.insertBefore(button, document.getElementById('cmV511Install') || document.getElementById('authButton'));
}

window.ChuteV511Internal = {
  VERSION, DB_NAME, STORE_NAME, MAX_BACKUPS, DAILY_BACKUP_KEY,
  core, model, esc, clone, norm, state, played, playerName, playerPosition, playerKey, matchesOf, nowDate, nowTime,
  originalSetState, addActivity, createBackup, listBackups, persistMutation,
  installStyles, installManifest, ensureInstallButton, setInstallPrompt, clearInstallPrompt, promptInstall,
  showUpdateBanner, applyUpdate, registerServiceWorker,
  openTournament, openMatch, openGlobalSearch, ensureSearchButton, renderSearchResults,
  setInternalStateWrite(value) { internalStateWrite = Boolean(value); }
};
