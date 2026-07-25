const core = window.ChuteMundoCore;
if (!core) throw new Error('Chute Mundo no está listo para Torneos v5.24.');

const VERSION = '5.24.0';
const MOBILE = window.matchMedia('(max-width: 720px)');
const esc = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const state = () => core.getState?.() || { tournaments: [], teams: [] };

let createOpen = false;
let initialFormState = '';
let pendingCreationCount = null;
let visibleCount = MOBILE.matches ? 3 : 5;
let lastRenderKey = '';
let renderQueued = false;

function loadStyles() {
  if (document.getElementById('cmV524TournamentStyles')) return;
  const link = document.createElement('link');
  link.id = 'cmV524TournamentStyles';
  link.rel = 'stylesheet';
  link.href = `/chute-v524-tournaments.css?v=${VERSION}`;
  document.head.appendChild(link);
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

function formatGroup(type) {
  if (type === 'division_season' || type === 'division_final') return 'divisions';
  if (type === 'cup_groups') return 'cups';
  if (type === 'direct_knockout') return 'knockout';
  return 'leagues';
}

function teamName(id) { return core.teamName?.(id) || 'Por definir'; }
function played(match) { return core.matchPlayed?.(match) ?? (match?.homeGoals !== null && match?.awayGoals !== null); }
function matchesOf(tournament) { return (tournament.matches || []).filter((match) => match.stage !== 'bye'); }

function parseDate(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const text = String(value).trim();
  const isoDate = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoDate) return new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3])).getTime();
  const localDate = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (localDate) return new Date(Number(localDate[3]), Number(localDate[2]) - 1, Number(localDate[1])).getTime();
  const direct = Date.parse(text);
  return Number.isFinite(direct) ? direct : 0;
}

function tournamentTimestamp(tournament, index = 0) {
  const candidates = tournament.status === 'historical'
    ? [tournament.endDate, tournament.finishedAt, tournament.historicalDate, tournament.date, tournament.startDate, tournament.createdAt]
    : [tournament.startDate, tournament.date, tournament.createdAt];
  for (const value of candidates) {
    const timestamp = parseDate(value);
    if (timestamp) return timestamp;
  }
  return index + 1;
}

function dateText(tournament) {
  const raw = tournament.status === 'historical'
    ? tournament.endDate || tournament.historicalDate || tournament.date || tournament.startDate || tournament.createdAt
    : tournament.startDate || tournament.date || tournament.createdAt;
  const timestamp = parseDate(raw);
  if (!timestamp) return raw ? String(raw) : 'Fecha por definir';
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(timestamp));
}

function formSnapshot() {
  const form = document.getElementById('tournamentForm');
  if (!form) return '';
  const fields = [...new FormData(form).entries()].sort(([a], [b]) => a.localeCompare(b));
  const teams = [...document.querySelectorAll('#teamPicker input:checked')].map((input) => input.value).sort();
  return JSON.stringify({ fields, teams });
}

function formIsDirty() { return formSnapshot() !== initialFormState; }

function setCreateOpen(next, { force = false, reset = false } = {}) {
  const form = document.getElementById('tournamentForm');
  if (!next && createOpen && !force && formIsDirty() && !window.confirm('Hay información sin guardar. ¿Cerrar y descartar la creación del torneo?')) return false;
  createOpen = Boolean(next);
  if (reset && form) {
    form.reset();
    document.getElementById('tournamentType')?.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('teamPicker')?.dispatchEvent(new Event('change', { bubbles: true }));
  }
  initialFormState = formSnapshot();
  renderAll(true);
  if (createOpen) {
    requestAnimationFrame(() => {
      document.getElementById('cmV524CreatePanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('tournamentName')?.focus({ preventScroll: true });
    });
  }
  return true;
}

function ensureStructure() {
  const page = document.getElementById('torneos');
  const form = document.getElementById('tournamentForm');
  const list = document.getElementById('tournamentList');
  if (!page || !form || !list) return false;
  if (page.dataset.cmV524Ready === 'true') return true;

  const title = page.querySelector('.page-title');
  if (title) {
    title.classList.add('cm-v524-page-title');
    const description = title.querySelector('p:last-child');
    if (description) description.textContent = 'Administra competencias activas, próximas e históricas desde una vista más clara.';
    if (!document.getElementById('cmV524CreateToggle')) {
      const button = document.createElement('button');
      button.id = 'cmV524CreateToggle';
      button.type = 'button';
      button.className = 'primary admin-only cm-v524-create-toggle';
      button.hidden = true;
      button.setAttribute('aria-controls', 'cmV524CreatePanel');
      title.appendChild(button);
    }
  }

  const createPanel = form.closest('.panel');
  const historyPanel = list.closest('.panel');
  const originalLayout = createPanel?.parentElement;
  if (!createPanel || !historyPanel || !originalLayout) return false;

  originalLayout.classList.remove('two-columns');
  originalLayout.classList.add('cm-v524-tournament-layout');
  createPanel.id = 'cmV524CreatePanel';
  createPanel.classList.remove('admin-only');
  createPanel.classList.add('cm-v524-create-panel');
  createPanel.querySelector('h2')?.insertAdjacentHTML('beforebegin', '<p class="eyebrow">NUEVA COMPETENCIA</p>');

  const submit = form.querySelector('button[type="submit"]');
  if (submit && !document.getElementById('cmV524CancelCreate')) {
    submit.classList.remove('wide');
    const actions = document.createElement('div');
    actions.className = 'cm-v524-form-actions';
    submit.parentNode.insertBefore(actions, submit);
    actions.appendChild(submit);
    const cancel = document.createElement('button');
    cancel.id = 'cmV524CancelCreate';
    cancel.type = 'button';
    cancel.className = 'secondary';
    cancel.textContent = 'Cancelar';
    actions.insertBefore(cancel, submit);
  }

  const summary = document.createElement('section');
  summary.id = 'cmV524TournamentSummary';
  summary.className = 'cm-v524-summary';
  summary.setAttribute('aria-label', 'Resumen de torneos');
  originalLayout.insertBefore(summary, historyPanel);

  const active = document.createElement('article');
  active.id = 'cmV524ActiveTournament';
  active.className = 'panel cm-v524-active-panel';
  originalLayout.insertBefore(active, historyPanel);

  historyPanel.id = 'cmV524HistoryPanel';
  historyPanel.classList.add('cm-v524-history-panel');
  const head = historyPanel.querySelector('.panel-head');
  const statusSelect = document.getElementById('tournamentStatusFilter');
  if (head) {
    head.classList.add('cm-v524-history-head');
    const heading = head.querySelector('div');
    if (heading) heading.innerHTML = '<p class="eyebrow">HISTORIAL</p><h2>Torneos registrados</h2><p class="muted">Consulta próximos torneos y competencias finalizadas.</p>';
  }

  const filters = document.createElement('div');
  filters.id = 'cmV524TournamentFilters';
  filters.className = 'cm-v524-filters';
  filters.innerHTML = `
    <label class="cm-v524-search"><span>Buscar</span><input id="cmV524TournamentSearch" type="search" placeholder="Nombre del torneo" autocomplete="off"></label>
    <label><span>Estado</span><span id="cmV524StatusSlot"></span></label>
    <label><span>Formato</span><select id="cmV524FormatFilter"><option value="all">Todos</option><option value="leagues">Ligas</option><option value="cups">Copas</option><option value="knockout">Eliminación</option><option value="divisions">Divisiones</option></select></label>
    <label><span>Orden</span><select id="cmV524Order"><option value="recent">Más recientes</option><option value="oldest">Más antiguos</option></select></label>`;
  historyPanel.insertBefore(filters, list);
  if (statusSelect) {
    statusSelect.innerHTML = '<option value="all">Todos</option><option value="upcoming">Próximos</option><option value="historical">Finalizados</option>';
    statusSelect.classList.add('compact-select');
    document.getElementById('cmV524StatusSlot')?.replaceWith(statusSelect);
  }

  const listMeta = document.createElement('div');
  listMeta.className = 'cm-v524-list-meta';
  listMeta.innerHTML = '<span id="cmV524ResultCount"></span><button id="cmV524ClearFilters" class="text-button" type="button" hidden>Limpiar filtros</button>';
  historyPanel.insertBefore(listMeta, list);

  const pagination = document.createElement('div');
  pagination.id = 'cmV524Pagination';
  pagination.className = 'cm-v524-pagination';
  pagination.innerHTML = '<button id="cmV524ShowMore" class="secondary" type="button"></button><button id="cmV524ShowLess" class="text-button" type="button">Ver menos</button>';
  historyPanel.appendChild(pagination);

  page.dataset.cmV524Ready = 'true';
  initialFormState = formSnapshot();
  bindEvents();
  return true;
}

function summaryMarkup(tournaments) {
  const counts = {
    active: tournaments.filter((item) => item.status === 'active').length,
    upcoming: tournaments.filter((item) => item.status === 'upcoming').length,
    historical: tournaments.filter((item) => item.status === 'historical').length
  };
  return [
    ['active', 'En juego', counts.active, 'Competición actual'],
    ['upcoming', 'Próximos', counts.upcoming, 'Planificados'],
    ['historical', 'Finalizados', counts.historical, 'Archivo histórico']
  ].map(([status, label, value, detail]) => `<button type="button" data-cm-v524-summary="${status}"><strong>${value}</strong><span>${label}</span><small>${detail}</small></button>`).join('');
}

function activeMarkup(tournaments) {
  const active = tournaments.filter((item) => item.status === 'active');
  if (!active.length) return '<div class="panel-head"><div><p class="eyebrow">COMPETICIÓN ACTUAL</p><h2>No hay un torneo en juego</h2></div></div><p class="empty">Cuando se inicie una competencia aparecerá aquí con su progreso y próximo partido.</p>';
  return `<div class="panel-head"><div><p class="eyebrow">COMPETICIÓN ACTUAL</p><h2>${active.length === 1 ? 'Torneo en juego' : 'Torneos en juego'}</h2></div><span class="badge active">${active.length} activo${active.length === 1 ? '' : 's'}</span></div><div class="cm-v524-active-list">${active.map((tournament) => {
    const matches = matchesOf(tournament);
    const completed = matches.filter(played).length;
    const next = matches.find((match) => !played(match));
    const home = next ? next.home || core.resolveHome?.(tournament, next) : null;
    const away = next ? next.away || core.resolveAway?.(tournament, next) : null;
    const percent = matches.length ? Math.round((completed / matches.length) * 100) : 0;
    return `<article class="cm-v524-active-card"><div><span class="badge active">En juego</span><h3>${esc(tournament.name)}</h3><p>${esc(typeLabel(tournament.type))} · ${completed}/${matches.length} partidos</p>${next ? `<small>Próximo: ${esc(teamName(home))} vs. ${esc(teamName(away))}</small>` : '<small>Todos los partidos están registrados.</small>'}</div><div class="cm-v524-progress" aria-label="${percent}% completado"><span style="width:${percent}%"></span></div><button class="primary mini-button" data-open-tournament="${esc(tournament.id)}">Continuar torneo</button></article>`;
  }).join('')}</div>`;
}

function filterState() {
  return {
    query: document.getElementById('cmV524TournamentSearch')?.value.trim().toLocaleLowerCase('es') || '',
    status: document.getElementById('tournamentStatusFilter')?.value || 'all',
    format: document.getElementById('cmV524FormatFilter')?.value || 'all',
    order: document.getElementById('cmV524Order')?.value || 'recent'
  };
}

function filteredHistory(tournaments) {
  const filters = filterState();
  const source = tournaments.map((tournament, index) => ({ tournament, index })).filter(({ tournament }) => tournament.status !== 'active');
  const rows = source.filter(({ tournament }) => {
    if (filters.query && !String(tournament.name || '').toLocaleLowerCase('es').includes(filters.query)) return false;
    if (filters.status !== 'all' && tournament.status !== filters.status) return false;
    if (filters.format !== 'all' && formatGroup(tournament.type) !== filters.format) return false;
    return true;
  });
  const direction = filters.order === 'oldest' ? 1 : -1;
  rows.sort((a, b) => {
    if (a.tournament.status !== b.tournament.status) return a.tournament.status === 'upcoming' ? -1 : 1;
    return direction * (tournamentTimestamp(a.tournament, a.index) - tournamentTimestamp(b.tournament, b.index));
  });
  return rows.map(({ tournament }) => tournament);
}

function tournamentCard(tournament) {
  const matches = matchesOf(tournament);
  const completed = matches.filter(played).length;
  const champion = tournament.champion ? teamName(tournament.champion) : '';
  return `<article class="cm-v524-tournament-card" data-status="${esc(tournament.status)}"><div class="cm-v524-card-main"><div class="cm-v524-card-badges"><span class="badge ${esc(tournament.status)}">${tournament.status === 'upcoming' ? 'Próximo' : 'Finalizado'}</span><span class="badge">${esc(typeLabel(tournament.type))}</span></div><h3>${esc(tournament.name)}</h3><p>${esc(dateText(tournament))} · ${(tournament.teamIds || []).length} equipos · ${completed}/${matches.length} partidos</p>${champion ? `<strong class="cm-v524-champion">Campeón: ${esc(champion)}</strong>` : '<span class="muted">Competencia pendiente de definición.</span>'}</div><button class="secondary mini-button" data-open-tournament="${esc(tournament.id)}">Abrir torneo</button></article>`;
}

function renderAll(force = false) {
  if (!ensureStructure()) return;
  const source = state();
  const tournaments = source.tournaments || [];
  const admin = Boolean(core.isAdmin?.());
  if (!admin && createOpen) createOpen = false;
  const filters = filterState();
  const history = filteredHistory(tournaments);
  const limit = Math.min(visibleCount, history.length);
  const visible = history.slice(0, limit);
  const key = JSON.stringify({
    admin, createOpen, visibleCount, filters,
    tournaments: tournaments.map((tournament) => [tournament.id, tournament.name, tournament.status, tournament.type, tournament.startDate, tournament.endDate, tournament.createdAt, tournament.champion, (tournament.teamIds || []).length, matchesOf(tournament).map((match) => [match.id, match.homeGoals, match.awayGoals])])
  });

  const list = document.getElementById('tournamentList');
  const markupIsOurs = list?.dataset.cmV524Owned === 'true';
  if (!force && key === lastRenderKey && markupIsOurs) return;
  lastRenderKey = key;

  const toggle = document.getElementById('cmV524CreateToggle');
  const panel = document.getElementById('cmV524CreatePanel');
  if (toggle) {
    toggle.hidden = !admin;
    toggle.textContent = createOpen ? '× Cerrar creación' : '+ Crear torneo';
    toggle.setAttribute('aria-expanded', String(createOpen));
  }
  if (panel) panel.hidden = !(admin && createOpen);

  const summary = document.getElementById('cmV524TournamentSummary');
  if (summary) summary.innerHTML = summaryMarkup(tournaments);
  const active = document.getElementById('cmV524ActiveTournament');
  if (active) active.innerHTML = activeMarkup(tournaments);

  if (list) {
    list.dataset.cmV524Owned = 'true';
    list.classList.add('cm-v524-history-list');
    list.innerHTML = visible.length ? visible.map(tournamentCard).join('') : '<p class="empty cm-v524-empty">No hay torneos para estos filtros.</p>';
  }

  const count = document.getElementById('cmV524ResultCount');
  if (count) count.textContent = `${history.length} torneo${history.length === 1 ? '' : 's'} encontrado${history.length === 1 ? '' : 's'}${history.length > limit ? ` · mostrando ${limit}` : ''}`;
  const clear = document.getElementById('cmV524ClearFilters');
  if (clear) clear.hidden = !(filters.query || filters.status !== 'all' || filters.format !== 'all' || filters.order !== 'recent');
  const pagination = document.getElementById('cmV524Pagination');
  const more = document.getElementById('cmV524ShowMore');
  const less = document.getElementById('cmV524ShowLess');
  const batch = MOBILE.matches ? 3 : 5;
  if (pagination) pagination.hidden = history.length <= (MOBILE.matches ? 3 : 5);
  if (more) {
    more.hidden = limit >= history.length;
    more.textContent = `Ver ${Math.min(batch, history.length - limit)} torneo${Math.min(batch, history.length - limit) === 1 ? '' : 's'} más`;
  }
  if (less) less.hidden = visibleCount <= (MOBILE.matches ? 3 : 5);

  if (pendingCreationCount !== null && tournaments.length > pendingCreationCount) {
    pendingCreationCount = null;
    createOpen = false;
    initialFormState = formSnapshot();
    requestAnimationFrame(() => renderAll(true));
  }
}

function resetPagination() {
  visibleCount = MOBILE.matches ? 3 : 5;
  renderAll(true);
}

function bindEvents() {
  if (document.documentElement.dataset.cmV524Events === 'true') return;
  document.documentElement.dataset.cmV524Events = 'true';
  document.addEventListener('click', (event) => {
    if (event.target.closest('#cmV524CreateToggle')) { setCreateOpen(!createOpen); return; }
    if (event.target.closest('#cmV524CancelCreate')) { setCreateOpen(false, { reset: true }); return; }
    const summary = event.target.closest('[data-cm-v524-summary]');
    if (summary) {
      const status = summary.dataset.cmV524Summary;
      if (status === 'active') document.getElementById('cmV524ActiveTournament')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else {
        const select = document.getElementById('tournamentStatusFilter');
        if (select) select.value = status;
        resetPagination();
        document.getElementById('cmV524HistoryPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }
    if (event.target.closest('#cmV524ShowMore')) { visibleCount += MOBILE.matches ? 3 : 5; renderAll(true); return; }
    if (event.target.closest('#cmV524ShowLess')) { resetPagination(); document.getElementById('cmV524HistoryPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (event.target.closest('#cmV524ClearFilters')) {
      const search = document.getElementById('cmV524TournamentSearch');
      const status = document.getElementById('tournamentStatusFilter');
      const format = document.getElementById('cmV524FormatFilter');
      const order = document.getElementById('cmV524Order');
      if (search) search.value = '';
      if (status) status.value = 'all';
      if (format) format.value = 'all';
      if (order) order.value = 'recent';
      resetPagination();
    }
  }, true);

  document.addEventListener('input', (event) => {
    if (event.target.matches('#cmV524TournamentSearch')) resetPagination();
  });
  document.addEventListener('change', (event) => {
    if (event.target.matches('#tournamentStatusFilter,#cmV524FormatFilter,#cmV524Order')) resetPagination();
  });
  document.getElementById('tournamentForm')?.addEventListener('submit', () => {
    pendingCreationCount = (state().tournaments || []).length;
    window.setTimeout(() => {
      if (pendingCreationCount !== null && (state().tournaments || []).length === pendingCreationCount) pendingCreationCount = null;
    }, 1500);
  }, true);
  MOBILE.addEventListener?.('change', resetPagination);
}

function queueRender(force = false) {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderAll(force);
  });
}

loadStyles();
ensureStructure();
renderAll(true);

const page = document.getElementById('torneos');
if (page) new MutationObserver(() => queueRender()).observe(page, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
document.addEventListener('chute:ready', () => queueRender(true));
document.addEventListener('chute:boot-complete', () => queueRender(true));
document.addEventListener('click', (event) => { if (event.target.closest('[data-page="torneos"],[data-cm-page="torneos"],[data-cm-mobile-page="torneos"]')) queueRender(true); }, true);

window.ChuteV524Tournaments = Object.freeze({ version: VERSION, render: () => renderAll(true), openCreate: () => setCreateOpen(true), closeCreate: () => setCreateOpen(false) });
