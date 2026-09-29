function waitForCore() {
  if (window.ChuteMundoCore) return Promise.resolve(window.ChuteMundoCore);
  return new Promise((resolve) => document.addEventListener('chute:ready', (event) => resolve(event.detail), { once: true }));
}

const core = await waitForCore();
const model = window.ChuteDetailModel;
if (!model) throw new Error('El modelo detallado no está disponible para el centro de partido v5.15.');

const VERSION = '5.15.0';
const clone = (value) => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const esc = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const minuteNumber = (value) => value === 'Penales' ? 120 : Math.max(0, Number.parseInt(String(value ?? '0'), 10) || 0);
const minuteLabel = (value) => value === 'Penales' ? 'Penales' : `${minuteNumber(value)}′`;
const playerName = (entry) => Array.isArray(entry) ? String(entry[0] || '') : String(entry?.name || '');
const playerPosition = (entry) => Array.isArray(entry) ? String(entry[1] || '') : String(entry?.position || entry?.role || '');
let saving = false;
let migrationBusy = false;
let refreshQueued = false;

function matchContext(pair, source = core.getState()) {
  const [tournamentId, matchId] = String(pair || '').split('__');
  const tournament = source.tournaments?.find((item) => item.id === tournamentId);
  const match = tournament?.matches?.find((item) => item.id === matchId);
  if (!tournament || !match) return null;
  const home = match.home || core.resolveHome(tournament, match);
  const away = match.away || core.resolveAway(tournament, match);
  if (!home || !away) return null;
  return { tournamentId, matchId, tournament, match, home, away, pair: `${tournamentId}__${matchId}` };
}

function teamRoster(teamId, source = core.getState()) {
  return source.teams?.find((team) => team.id === teamId)?.players || [];
}

function rosterPlayer(teamId, name, source = core.getState()) {
  return teamRoster(teamId, source).find((entry) => playerName(entry) === name) || null;
}

function availability(entry) {
  return entry?.start ? 0 : Math.max(0, Number(entry?.minute ?? 0));
}

function currentLineup(lineup, minute = 120) {
  if (window.ChuteV514UnifiedMatch?.currentLineup) return window.ChuteV514UnifiedMatch.currentLineup(lineup, minute);
  if (window.ChuteV513Lineups?.currentLineup) return window.ChuteV513Lineups.currentLineup(lineup, minute);
  const field = [...(lineup?.starters || [])];
  for (const change of [...(lineup?.changes || [])].sort((a, b) => minuteNumber(a.minute) - minuteNumber(b.minute))) {
    if (minuteNumber(change.minute) > minuteNumber(minute)) continue;
    const index = field.indexOf(change.playerOut);
    if (index >= 0 && !field.includes(change.playerIn)) field.splice(index, 1, change.playerIn);
  }
  return field;
}

function ensureLineups(match, home, away, source) {
  if (window.ChuteV513Lineups?.ensureMatchLineups) {
    window.ChuteV513Lineups.ensureMatchLineups(match, home, away, source);
    return;
  }
  match.lineups ||= {};
  for (const [side, teamId] of [['home', home], ['away', away]]) {
    const starters = teamRoster(teamId, source).filter((entry) => entry?.start).map(playerName).slice(0, 4);
    match.lineups[side] ||= { teamId, starters, changes: [] };
    match.lineups[side].teamId = teamId;
    match.lineups[side].starters ||= starters;
    match.lineups[side].changes ||= [];
  }
}

function substitutionEvent(change, side, teamId) {
  return {
    id: change.id || core.uid('livesub'),
    kind: 'substitution',
    type: 'substitution',
    side,
    teamId,
    playerName: change.playerIn,
    playerIn: change.playerIn,
    playerOut: change.playerOut,
    minute: String(change.minute ?? '0'),
    createdAt: Number(change.createdAt || Date.now())
  };
}

function sameSubstitution(event, change, side, teamId) {
  return event?.kind === 'substitution' && event.side === side && event.teamId === teamId
    && event.playerIn === change.playerIn && event.playerOut === change.playerOut
    && minuteNumber(event.minute) === minuteNumber(change.minute);
}

function syncSubstitutionEvents(match, home, away) {
  let changed = false;
  match.specialEvents = Array.isArray(match.specialEvents) ? match.specialEvents : [];
  for (const [side, teamId] of [['home', home], ['away', away]]) {
    for (const change of match.lineups?.[side]?.changes || []) {
      const existing = match.specialEvents.find((event) => event.id === change.id || sameSubstitution(event, change, side, teamId));
      if (existing) {
        if (!change.id && existing.id) change.id = existing.id;
        continue;
      }
      const record = substitutionEvent(change, side, teamId);
      if (!change.id) change.id = record.id;
      match.specialEvents.push(record);
      changed = true;
    }
  }
  return changed;
}

function syncStateSubstitutions(source) {
  let changed = false;
  for (const tournament of source.tournaments || []) {
    for (const match of tournament.matches || []) {
      const home = match.home || core.resolveHome(tournament, match);
      const away = match.away || core.resolveAway(tournament, match);
      if (!home || !away || !match.lineups) continue;
      if (syncSubstitutionEvents(match, home, away)) changed = true;
    }
  }
  for (const match of source.friendlies || []) {
    if (!match.home || !match.away || !match.lineups) continue;
    if (syncSubstitutionEvents(match, match.home, match.away)) changed = true;
  }
  return changed;
}

async function ensureSubstitutionRecords() {
  if (migrationBusy || !core.canEdit()) return;
  const current = core.getState();
  const next = clone(current);
  if (!syncStateSubstitutions(next)) return;
  migrationBusy = true;
  try {
    core.setState(next);
    core.persistLocal?.();
    await core.saveCloud();
  } catch (error) {
    console.error('No se pudieron completar los eventos de cambios existentes.', error);
    core.setState(current);
  } finally {
    migrationBusy = false;
  }
}

function readLiveMetadata(match) {
  const date = document.getElementById('cmV59Date');
  const time = document.getElementById('cmV59Time');
  const venue = document.getElementById('cmV59Venue');
  const homePens = document.getElementById('cmV59HomePens');
  const awayPens = document.getElementById('cmV59AwayPens');
  if (date) match.date = date.value;
  if (time) match.time = time.value;
  if (venue) match.venue = venue.value.trim();
  if (homePens) match.homePens = homePens.value === '' ? null : Number(homePens.value);
  if (awayPens) match.awayPens = awayPens.value === '' ? null : Number(awayPens.value);
}

function restoreOfficialMinute(value) {
  requestAnimationFrame(() => {
    const select = document.getElementById('cmV59Minute');
    if (select && [...select.options].some((option) => option.value === String(value))) {
      select.value = String(value);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    scheduleRefresh();
  });
}

function eligiblePlayers(teamId, lineup, minute, source = core.getState()) {
  const field = new Set(currentLineup(lineup, minute));
  return teamRoster(teamId, source).filter((entry) => {
    const name = playerName(entry);
    return name && playerPosition(entry) !== 'Arquero' && availability(entry) <= minuteNumber(minute) && !field.has(name);
  });
}

async function registerSubstitution(pair, side) {
  if (saving || !core.canEdit()) return;
  const minuteValue = document.getElementById('cmV59Minute')?.value || '0';
  const minute = minuteNumber(minuteValue);
  const playerOut = document.querySelector(`[data-cm-v513-out="${side}"]`)?.value || '';
  const playerIn = document.querySelector(`[data-cm-v513-in="${side}"]`)?.value || '';
  if (!playerOut || !playerIn) return core.showToast('Selecciona quién sale y quién entra.');

  const previous = clone(core.getState());
  const next = clone(previous);
  const context = matchContext(pair, next);
  if (!context) return core.showToast('El partido ya no está disponible.');
  ensureLineups(context.match, context.home, context.away, next);
  const teamId = side === 'away' ? context.away : context.home;
  const lineup = context.match.lineups?.[side];
  const field = currentLineup(lineup, minute);
  const incoming = rosterPlayer(teamId, playerIn, next);

  if (!field.includes(playerOut)) return core.showToast('El jugador que sale ya no está en cancha.');
  if (playerPosition(rosterPlayer(teamId, playerOut, next)) === 'Arquero') return core.showToast('El arquero titular permanece durante todo el partido.');
  if (!incoming || availability(incoming) > minute) return core.showToast(`${playerIn} todavía no está habilitado para ingresar.`);
  if (field.includes(playerIn)) return core.showToast(`${playerIn} ya está en cancha.`);

  readLiveMetadata(context.match);
  const change = { id: core.uid('livesub'), minute, playerOut, playerIn, createdAt: Date.now() };
  lineup.changes.push(change);
  context.match.specialEvents = Array.isArray(context.match.specialEvents) ? context.match.specialEvents : [];
  context.match.specialEvents.push(substitutionEvent(change, side, teamId));
  context.match.liveStatus = 'active';
  context.match.updatedAt = Date.now();
  next.activity = Array.isArray(next.activity) ? next.activity : [];
  next.activity.unshift({ id: core.uid('activity'), text: `Cambio en ${core.teamName(teamId)}: entra ${playerIn} y sale ${playerOut} (${minuteLabel(minuteValue)}).`, at: Date.now() });
  next.activity = next.activity.slice(0, 50);

  saving = true;
  try {
    core.setState(next);
    core.persistLocal?.();
    await core.saveCloud();
    core.showToast(`Cambio registrado: entra ${playerIn} por ${playerOut}.`);
    window.ChuteV59?.openLiveMatch?.(pair);
    restoreOfficialMinute(minuteValue);
  } catch (error) {
    console.error(error);
    core.setState(previous);
    core.showToast(`No se pudo guardar el cambio: ${error.code || error.message || 'error desconocido'}.`);
    window.ChuteV59?.openLiveMatch?.(pair);
    restoreOfficialMinute(minuteValue);
  } finally {
    saving = false;
  }
}

function unifiedEvents(context) {
  const substitutions = [];
  for (const [side, teamId] of [['home', context.home], ['away', context.away]]) {
    for (const change of context.match.lineups?.[side]?.changes || []) {
      substitutions.push({ ...change, kind: 'substitution', side, teamId, sort: minuteNumber(change.minute) });
    }
  }
  const represented = new Set(substitutions.map((item) => item.id));
  const otherSpecial = (context.match.specialEvents || []).filter((event) => event.kind !== 'substitution' && !represented.has(event.id));
  return [
    ...(context.match.goals || []).map((event) => ({ ...event, kind: 'goal', sort: minuteNumber(event.minute) })),
    ...(context.match.cards || []).map((event) => ({ ...event, kind: 'card', sort: minuteNumber(event.minute) })),
    ...substitutions,
    ...otherSpecial.map((event) => ({ ...event, kind: event.kind || event.type || 'special', sort: minuteNumber(event.minute) }))
  ].sort((a, b) => a.sort - b.sort || Number(a.createdAt || 0) - Number(b.createdAt || 0));
}

function eventMarkup(context, event) {
  const teamId = event.teamId || (event.side === 'away' ? context.away : context.home);
  if (event.kind === 'substitution') {
    return `<div class="cm-v515-timeline-event is-substitution" data-event-id="${esc(event.id || '')}">
      <span class="cm-v515-event-minute">${esc(minuteLabel(event.minute))}</span>
      <div class="cm-v515-sub-faces">${model.photo(teamId, event.playerOut, 'cm-v515-event-face')}<i>→</i>${model.photo(teamId, event.playerIn, 'cm-v515-event-face')}</div>
      <div class="cm-v515-event-copy"><strong><span class="cm-v515-in">ENTRA</span> ${esc(event.playerIn)}</strong><small><span class="cm-v515-out">SALE</span> ${esc(event.playerOut)} · ${esc(core.teamName(teamId))}</small></div>
    </div>`;
  }
  if (event.kind === 'goal') {
    return `<div class="cm-v515-timeline-event is-goal"><span class="cm-v515-event-minute">${esc(minuteLabel(event.minute))}</span>${model.photo(teamId, event.playerName, 'cm-v515-event-face')}<div class="cm-v515-event-copy"><strong>⚽ ${esc(event.playerName)}</strong><small>${esc(core.teamName(teamId))}${event.assistName ? ` · Asistencia: ${esc(event.assistName)}` : ''}</small></div></div>`;
  }
  if (event.kind === 'card') {
    const red = event.type === 'red';
    return `<div class="cm-v515-timeline-event is-card"><span class="cm-v515-event-minute">${esc(minuteLabel(event.minute))}</span>${model.photo(teamId, event.playerName, 'cm-v515-event-face')}<div class="cm-v515-event-copy"><strong>${red ? '🟥' : '🟨'} ${esc(event.playerName)}</strong><small>${esc(core.teamName(teamId))}${event.reason === 'double_yellow' ? ' · Doble amarilla' : ''}</small></div></div>`;
  }
  return `<div class="cm-v515-timeline-event is-special"><span class="cm-v515-event-minute">${esc(minuteLabel(event.minute))}</span><span class="cm-v515-special-icon">✦</span><div class="cm-v515-event-copy"><strong>${esc(event.playerName || event.title || 'Evento')}</strong><small>${esc(event.note || event.text || core.teamName(teamId))}</small></div></div>`;
}

function latestUnifiedEvent(context) {
  return unifiedEvents(context).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0] || null;
}

function renderTimeline() {
  const live = document.querySelector('[data-cm-v59-live-pair]');
  const timeline = live?.querySelector('.cm-v59-live-timeline');
  if (!live || !timeline) return;
  const context = matchContext(live.dataset.cmV59LivePair);
  if (!context) return;
  const events = unifiedEvents(context);
  timeline.classList.add('cm-v515-timeline');
  const header = timeline.querySelector(':scope > header');
  if (header) {
    header.querySelector('.eyebrow')?.replaceChildren('EVENTOS OFICIALES');
    header.querySelector('h3')?.replaceChildren('Cronología del partido');
    const count = header.querySelector(':scope > span');
    if (count) count.textContent = `${events.length} evento${events.length === 1 ? '' : 's'}`;
  }
  [...timeline.children].filter((child) => child !== header).forEach((child) => child.remove());
  timeline.insertAdjacentHTML('beforeend', events.length ? `<div class="cm-v515-timeline-list">${events.map((event) => eventMarkup(context, event)).join('')}</div>` : '<div class="cm-v59-live-empty">Todavía no hay eventos registrados.</div>');
  const undo = live.querySelector('[data-cm-v59-undo]');
  if (undo) {
    undo.disabled = !events.length;
    const latest = latestUnifiedEvent(context);
    undo.dataset.cmV515Latest = latest?.kind || '';
    undo.title = latest?.kind === 'substitution' ? 'Eliminar el último cambio registrado' : 'Corregir el último evento registrado';
  }
}

async function undoSubstitution(pair) {
  if (saving || !core.canEdit()) return;
  const previous = clone(core.getState());
  const next = clone(previous);
  const context = matchContext(pair, next);
  if (!context) return;
  const latest = latestUnifiedEvent(context);
  if (!latest || latest.kind !== 'substitution') return;
  const lineup = context.match.lineups?.[latest.side];
  if (!lineup) return;
  lineup.changes = (lineup.changes || []).filter((change) => change.id !== latest.id);
  context.match.specialEvents = (context.match.specialEvents || []).filter((event) => event.id !== latest.id && !sameSubstitution(event, latest, latest.side, latest.teamId));
  context.match.updatedAt = Date.now();
  next.activity = Array.isArray(next.activity) ? next.activity : [];
  next.activity.unshift({ id: core.uid('activity'), text: `Cambio corregido: ${latest.playerIn} por ${latest.playerOut}.`, at: Date.now() });
  next.activity = next.activity.slice(0, 50);
  const minuteValue = document.getElementById('cmV59Minute')?.value || String(latest.minute || 0);

  saving = true;
  try {
    core.setState(next);
    core.persistLocal?.();
    await core.saveCloud();
    core.showToast('Último cambio eliminado.');
    window.ChuteV59?.openLiveMatch?.(pair);
    restoreOfficialMinute(minuteValue);
  } catch (error) {
    console.error(error);
    core.setState(previous);
    core.showToast(`No se pudo corregir el cambio: ${error.code || error.message || 'error desconocido'}.`);
    window.ChuteV59?.openLiveMatch?.(pair);
    restoreOfficialMinute(minuteValue);
  } finally {
    saving = false;
  }
}

function logoMarkup(teamId) {
  const url = model.logoUrl?.(teamId) || '';
  return url ? `<img class="cm-v515-lineup-logo" src="${esc(url)}" alt="">` : '';
}

function decorateLineupSide(section, side, minute, teamId, lineup) {
  const root = section.querySelector(`[data-cm-v513-side="${side}"]`);
  if (!root || !lineup) return;
  root.classList.add('cm-v515-lineup-side');
  const header = root.querySelector(':scope > header');
  if (header && !header.querySelector('.cm-v515-lineup-logo')) header.insertAdjacentHTML('afterbegin', logoMarkup(teamId));
  const field = currentLineup(lineup, minute);
  root.querySelectorAll('.cm-v513-field > span').forEach((card, index) => {
    card.classList.add('cm-v515-player-slot');
    card.dataset.slot = String(index + 1);
    if (!card.querySelector('.cm-v515-on-field')) card.insertAdjacentHTML('beforeend', '<em class="cm-v515-on-field">EN CANCHA</em>');
  });

  const form = root.querySelector('.cm-v513-change-form');
  if (form) {
    form.classList.add('cm-v515-change-form');
    const labels = form.querySelectorAll('label');
    if (labels[0]) labels[0].childNodes[0].textContent = 'Jugador que sale';
    if (labels[1]) labels[1].childNodes[0].textContent = 'Jugador que entra';
    const button = form.querySelector('[data-cm-v513-substitute], [data-cm-v514-substitute], [data-cm-v515-substitute]');
    if (button) {
      button.removeAttribute('data-cm-v513-substitute');
      button.removeAttribute('data-cm-v514-substitute');
      button.dataset.cmV515Substitute = side;
      button.textContent = 'Confirmar cambio';
    }
  }

  const waiting = teamRoster(teamId).filter((entry) => playerPosition(entry) !== 'Arquero' && availability(entry) > minute);
  const waitingRoot = root.querySelector('.cm-v513-waiting');
  if (waitingRoot) {
    waitingRoot.classList.add('cm-v515-waiting');
    waitingRoot.hidden = !waiting.length;
    waitingRoot.innerHTML = waiting.length ? `<span class="cm-v515-waiting-title">Próximos ingresos</span><span class="cm-v515-waiting-chips">${waiting.map((entry) => `<i>${esc(playerName(entry))}<b>${availability(entry)}′</b></i>`).join('')}</span>` : '';
  }

  const historyRoot = root.querySelector('.cm-v513-change-history');
  if (historyRoot) {
    historyRoot.classList.add('cm-v515-change-history');
    const changes = [...(lineup.changes || [])].sort((a, b) => minuteNumber(a.minute) - minuteNumber(b.minute));
    historyRoot.innerHTML = changes.length ? changes.map((change) => `<li><b>${minuteLabel(change.minute)}</b><span><strong>${esc(change.playerIn)}</strong><i>entra por</i>${esc(change.playerOut)}</span></li>`).join('') : '<li class="is-empty">Aún no se han registrado cambios.</li>';
  }

  const counter = header?.querySelector(':scope > span');
  if (counter) counter.textContent = `${field.length} de 4 en cancha`;
}

function decorateLineups() {
  const live = document.querySelector('[data-cm-v59-live-pair]');
  const section = live?.querySelector('#cmV513Lineups');
  if (!live || !section) return;
  const context = matchContext(live.dataset.cmV59LivePair);
  if (!context) return;
  const minute = minuteNumber(document.getElementById('cmV59Minute')?.value || 0);
  const preview = clone(context.match);
  ensureLineups(preview, context.home, context.away, core.getState());
  section.classList.add('cm-v515-lineups');
  const header = section.querySelector(':scope > header');
  if (header) {
    header.querySelector('.eyebrow')?.replaceChildren('ALINEACIÓN Y CAMBIOS');
    header.querySelector('h3')?.replaceChildren('Jugadores disponibles en el partido');
    const description = header.querySelector('p:last-child');
    if (description) description.textContent = 'Consulta quién está en cancha, registra sustituciones y revisa los próximos jugadores habilitados.';
    const minuteBadge = header.querySelector(':scope > span');
    if (minuteBadge) minuteBadge.textContent = `Minuto ${minuteLabel(minute)}`;
  }
  decorateLineupSide(section, 'home', minute, context.home, preview.lineups?.home);
  decorateLineupSide(section, 'away', minute, context.away, preview.lineups?.away);
}

function decorateMatchCenter() {
  const live = document.querySelector('[data-cm-v59-live-pair]');
  if (!live) return;
  live.classList.add('cm-v515-match-center');
  live.querySelector('.cm-v59-live-heading .eyebrow')?.replaceChildren('CENTRO ÚNICO DEL PARTIDO');
  const badge = live.querySelector('.cm-v514-unified-badge');
  if (badge) badge.textContent = 'Marcador · goles · asistencias · tarjetas · alineaciones · cambios';
  decorateLineups();
  renderTimeline();
}

function refreshUi() {
  refreshQueued = false;
  decorateMatchCenter();
}

function scheduleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(refreshUi);
}

function installStyles() {
  if (document.getElementById('cmV515Styles')) return;
  const link = document.createElement('link');
  link.id = 'cmV515Styles';
  link.rel = 'stylesheet';
  link.href = `/chute-v515-match-center.css?v=${VERSION}`;
  document.head.appendChild(link);
}

window.addEventListener('click', (event) => {
  const substitution = event.target.closest?.('[data-cm-v515-substitute]');
  if (substitution) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const live = substitution.closest('[data-cm-v59-live-pair]');
    if (live && !substitution.disabled) void registerSubstitution(live.dataset.cmV59LivePair, substitution.dataset.cmV515Substitute);
    return;
  }
  const undo = event.target.closest?.('[data-cm-v59-undo]');
  if (undo && !undo.disabled) {
    const live = undo.closest('[data-cm-v59-live-pair]');
    const context = live ? matchContext(live.dataset.cmV59LivePair) : null;
    if (context && latestUnifiedEvent(context)?.kind === 'substitution') {
      event.preventDefault();
      event.stopImmediatePropagation();
      void undoSubstitution(live.dataset.cmV59LivePair);
    }
  }
}, true);

document.addEventListener('change', (event) => {
  if (event.target.id === 'cmV59Minute') scheduleRefresh();
}, true);

const observer = new MutationObserver(scheduleRefresh);
observer.observe(document.body, { childList: true, subtree: true });

installStyles();
await ensureSubstitutionRecords();
if ('serviceWorker' in navigator) navigator.serviceWorker.register(`/sw.js?v=${VERSION}`).catch((error) => console.warn('No se pudo actualizar la PWA v5.15.', error));
document.title = 'Chute Mundo v5.15 · Partido uniforme';
const heroVersion = document.querySelector('.hero .eyebrow');
if (heroVersion) heroVersion.textContent = 'CHUTE MUNDO v5.15';
refreshUi();

window.ChuteV515MatchCenter = {
  version: VERSION,
  currentLineup,
  eligiblePlayers,
  syncSubstitutionEvents,
  syncStateSubstitutions,
  unifiedEvents,
  latestUnifiedEvent,
  registerSubstitution,
  undoSubstitution,
  decorateLineups,
  renderTimeline
};
