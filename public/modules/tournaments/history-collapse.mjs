const core = window.ChuteMundoCore;
const tournamentsUi = window.ChuteV524Tournaments;
if (!core || !tournamentsUi) throw new Error('Chute Mundo no está listo para el archivo plegable v5.24.1.');

const VERSION = '5.24.1';
const esc = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const state = () => core.getState?.() || { tournaments: [] };

let archiveOpen = false;
let renderQueued = false;
let syncingBaseList = false;
let lastSignature = '';

function loadStyles() {
  if (document.getElementById('cmV5241HistoryStyles')) return;
  const link = document.createElement('link');
  link.id = 'cmV5241HistoryStyles';
  link.rel = 'stylesheet';
  link.href = `/chute-v5241-history-collapse.css?v=${VERSION}`;
  document.head.appendChild(link);
}

function parseDate(value) {
  if (!value) return 0;
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])).getTime();
  const local = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (local) return new Date(Number(local[3]), Number(local[2]) - 1, Number(local[1])).getTime();
  const direct = Date.parse(text);
  return Number.isFinite(direct) ? direct : 0;
}

function dateText(tournament) {
  const raw = tournament.startDate || tournament.date || tournament.createdAt;
  const timestamp = parseDate(raw);
  if (!timestamp) return raw ? String(raw) : 'Fecha por definir';
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(timestamp));
}

function typeLabel(type) {
  return ({
    league: 'Liga',
    league_playoff: 'Liga + Play-Off',
    cup_groups: 'Copa con grupos',
    direct_knockout: 'Eliminación directa',
    division_final: 'División con final',
    division_season: 'Temporada por divisiones'
  })[type] || type || 'Formato sin definir';
}

function ensureStructure() {
  const layout = document.querySelector('#torneos .cm-v524-tournament-layout');
  const historyPanel = document.getElementById('cmV524HistoryPanel');
  if (!layout || !historyPanel) return false;

  let upcomingPanel = document.getElementById('cmV5241UpcomingPanel');
  if (!upcomingPanel) {
    upcomingPanel = document.createElement('article');
    upcomingPanel.id = 'cmV5241UpcomingPanel';
    upcomingPanel.className = 'panel cm-v5241-upcoming-panel';
    layout.insertBefore(upcomingPanel, historyPanel);
  }

  let archiveGate = document.getElementById('cmV5241ArchiveGate');
  if (!archiveGate) {
    archiveGate = document.createElement('article');
    archiveGate.id = 'cmV5241ArchiveGate';
    archiveGate.className = 'panel cm-v5241-archive-gate';
    archiveGate.innerHTML = '<div><p class="eyebrow">ARCHIVO</p><h2>Torneos anteriores</h2><p class="muted">El historial permanece oculto para priorizar la competición actual.</p></div><button id="cmV5241ArchiveToggle" class="secondary" type="button" aria-controls="cmV524HistoryPanel"></button>';
    layout.insertBefore(archiveGate, historyPanel);
  }

  historyPanel.classList.add('cm-v5241-archive-content');
  const heading = historyPanel.querySelector('.cm-v524-history-head > div');
  if (heading) heading.innerHTML = '<p class="eyebrow">HISTORIAL</p><h2>Torneos anteriores</h2><p class="muted">Busca y consulta competencias finalizadas.</p>';

  const status = document.getElementById('tournamentStatusFilter');
  const statusLabel = status?.closest('label');
  if (statusLabel) statusLabel.hidden = true;
  return true;
}

function upcomingMarkup(tournaments) {
  const upcoming = tournaments
    .filter((tournament) => tournament.status === 'upcoming')
    .sort((a, b) => parseDate(a.startDate || a.date || a.createdAt) - parseDate(b.startDate || b.date || b.createdAt));
  if (!upcoming.length) return '';
  return `<div class="panel-head"><div><p class="eyebrow">PRÓXIMAS COMPETENCIAS</p><h2>${upcoming.length === 1 ? 'Próximo torneo' : 'Próximos torneos'}</h2><p class="muted">Competencias planificadas que todavía no comienzan.</p></div><span class="badge upcoming">${upcoming.length}</span></div><div class="cm-v5241-upcoming-list">${upcoming.map((tournament) => `<article class="cm-v5241-upcoming-row"><div><span class="badge upcoming">Próximo</span><h3>${esc(tournament.name)}</h3><p>${esc(typeLabel(tournament.type))} · ${esc(dateText(tournament))} · ${(tournament.teamIds || []).length} equipos</p></div><button class="secondary mini-button" data-open-tournament="${esc(tournament.id)}">Abrir torneo</button></article>`).join('')}</div>`;
}

function syncHistoricalFilter() {
  const status = document.getElementById('tournamentStatusFilter');
  if (!status || status.value === 'historical' || syncingBaseList) return;
  status.value = 'historical';
  syncingBaseList = true;
  try { tournamentsUi.render?.(); }
  finally { requestAnimationFrame(() => { syncingBaseList = false; queueRender(true); }); }
}

function render(force = false) {
  if (!ensureStructure()) return;
  const tournaments = state().tournaments || [];
  const historical = tournaments.filter((tournament) => tournament.status === 'historical');
  const upcoming = tournaments.filter((tournament) => tournament.status === 'upcoming');
  const signature = JSON.stringify({
    archiveOpen,
    historical: historical.map((tournament) => [tournament.id, tournament.name, tournament.endDate, tournament.champion]),
    upcoming: upcoming.map((tournament) => [tournament.id, tournament.name, tournament.startDate, tournament.type])
  });
  if (!force && signature === lastSignature) return;
  lastSignature = signature;

  syncHistoricalFilter();

  const upcomingPanel = document.getElementById('cmV5241UpcomingPanel');
  if (upcomingPanel) {
    upcomingPanel.hidden = upcoming.length === 0;
    upcomingPanel.innerHTML = upcomingMarkup(tournaments);
  }

  const gate = document.getElementById('cmV5241ArchiveGate');
  const toggle = document.getElementById('cmV5241ArchiveToggle');
  const historyPanel = document.getElementById('cmV524HistoryPanel');
  if (gate) gate.hidden = historical.length === 0;
  if (toggle) {
    toggle.textContent = archiveOpen ? 'Ocultar torneos anteriores' : `Ver torneos anteriores (${historical.length})`;
    toggle.setAttribute('aria-expanded', String(archiveOpen));
  }
  if (historyPanel) historyPanel.hidden = !archiveOpen || historical.length === 0;
}

function setArchiveOpen(next, { scroll = true } = {}) {
  archiveOpen = Boolean(next);
  syncHistoricalFilter();
  render(true);
  if (!scroll) return;
  requestAnimationFrame(() => {
    document.getElementById(archiveOpen ? 'cmV524HistoryPanel' : 'cmV5241ArchiveGate')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function queueRender(force = false) {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render(force);
  });
}

loadStyles();
ensureStructure();
syncHistoricalFilter();
render(true);

document.addEventListener('click', (event) => {
  if (event.target.closest('#cmV5241ArchiveToggle')) {
    event.preventDefault();
    setArchiveOpen(!archiveOpen);
    return;
  }

  const summary = event.target.closest('[data-cm-v524-summary]');
  if (summary?.dataset.cmV524Summary === 'historical') {
    setArchiveOpen(true);
    return;
  }
  if (summary?.dataset.cmV524Summary === 'upcoming') {
    archiveOpen = false;
    queueRender(true);
    requestAnimationFrame(() => document.getElementById('cmV5241UpcomingPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return;
  }

  if (event.target.closest('[data-page="torneos"],[data-cm-page="torneos"],[data-cm-mobile-page="torneos"]')) {
    archiveOpen = false;
    queueRender(true);
  }
}, true);

const page = document.getElementById('torneos');
if (page) new MutationObserver(() => queueRender()).observe(page, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
document.addEventListener('chute:ready', () => queueRender(true));
document.addEventListener('chute:boot-complete', () => queueRender(true));

window.ChuteV5241HistoryCollapse = Object.freeze({
  version: VERSION,
  render: () => render(true),
  open: () => setArchiveOpen(true),
  close: () => setArchiveOpen(false),
  get isOpen() { return archiveOpen; }
});