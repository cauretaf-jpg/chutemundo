function waitForCore() {
  if (window.ChuteMundoCore) return Promise.resolve(window.ChuteMundoCore);
  return new Promise((resolve) => document.addEventListener('chute:ready', (event) => resolve(event.detail), { once: true }));
}

const core = await waitForCore();
const VERSION = '5.14.0';
const clone = (value) => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const esc = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const minuteNumber = (value) => value === 'Penales' ? 120 : Math.max(0, Number.parseInt(String(value ?? '0'), 10) || 0);
const playerName = (entry) => Array.isArray(entry) ? String(entry[0] || '') : String(entry?.name || '');
const playerPosition = (entry) => Array.isArray(entry) ? String(entry[1] || '') : String(entry?.position || entry?.role || '');
const originalDetailedMatch = window.ChuteDetailEvents?.openDetailedMatch?.bind(window.ChuteDetailEvents);
let saving = false;
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
  const field = [...(lineup?.starters || [])];
  const changes = [...(lineup?.changes || [])].sort((a, b) => minuteNumber(a.minute) - minuteNumber(b.minute) || Number(a.createdAt || 0) - Number(b.createdAt || 0));
  for (const change of changes) {
    if (minuteNumber(change.minute) > minuteNumber(minute)) continue;
    const index = field.indexOf(change.playerOut);
    if (index >= 0 && !field.includes(change.playerIn)) field.splice(index, 1, change.playerIn);
  }
  return field;
}

function eligiblePlayers(teamId, lineup, minute, source = core.getState()) {
  const field = new Set(currentLineup(lineup, minute));
  return teamRoster(teamId, source).filter((entry) => {
    const name = playerName(entry);
    return name && playerPosition(entry) !== 'Arquero' && availability(entry) <= minuteNumber(minute) && !field.has(name);
  });
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
  lineup.changes.push({ id: core.uid('sub'), minute, playerOut, playerIn, createdAt: Date.now() });
  context.match.updatedAt = Date.now();
  next.activity = Array.isArray(next.activity) ? next.activity : [];
  next.activity.unshift({ id: core.uid('activity'), text: `Cambio en ${core.teamName(teamId)}: ${playerIn} por ${playerOut} (${minute}′).`, at: Date.now() });
  next.activity = next.activity.slice(0, 50);

  saving = true;
  try {
    core.setState(next);
    await core.saveCloud();
    core.showToast(`Cambio registrado: ${playerIn} por ${playerOut}.`);
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

function makeDetailedReadOnly() {
  if (core.canEdit()) return;
  const editor = document.querySelector('.cm-match-editor');
  if (!editor) return;
  editor.classList.add('cm-v514-readonly');
  editor.querySelectorAll('input, select, textarea, button[type="submit"]').forEach((element) => { element.disabled = true; });
  editor.querySelectorAll('.cm-event-entry, .cm-icon-button, button[type="submit"]').forEach((element) => { element.hidden = true; });
  if (!editor.querySelector('.cm-v514-readonly-notice')) {
    const heading = editor.querySelector('.cm-match-editor-title');
    heading?.insertAdjacentHTML('afterend', '<div class="cm-v514-readonly-notice"><strong>Vista del partido</strong><span>Modo lectura. Inicia sesión como administrador para registrar marcador, goles, asistencias, tarjetas y cambios.</span><button type="button" data-cm-v514-login>Ingresar</button></div>');
  }
}

function openUnifiedMatch(tournamentId, matchId) {
  const context = matchContext(`${tournamentId}__${matchId}`);
  if (!context) return core.showToast('El partido todavía depende de otra fase o no está disponible.');
  if (core.canEdit()) {
    window.ChuteV59?.openLiveMatch?.(context.pair);
    scheduleRefresh();
    return;
  }
  if (!originalDetailedMatch) return core.showToast('La ficha del partido no está disponible.');
  originalDetailedMatch(tournamentId, matchId);
  makeDetailedReadOnly();
}

function openUnifiedPair(pair) {
  const [tournamentId, matchId] = String(pair || '').split('__');
  if (tournamentId && matchId) openUnifiedMatch(tournamentId, matchId);
}

function decorateEntryButtons() {
  document.querySelectorAll('[data-cm-v52-open-match], [data-cm-hub-match]').forEach((button) => {
    button.textContent = 'Ver partido';
    button.title = core.canEdit() ? 'Abrir partido y registrar todos sus eventos' : 'Abrir ficha del partido';
    button.dataset.cmV514Unified = 'true';
  });
  document.querySelectorAll('[data-edit-match]').forEach((button) => button.remove());
  document.querySelectorAll('.cm-v59-live-launch, .cm-v591-live-access, #cmV591LivePanel').forEach((element) => {
    element.setAttribute('aria-hidden', 'true');
    element.tabIndex = -1;
  });
}

function patchLineupSide(section, side, minute, teamId, lineup) {
  const root = section.querySelector(`[data-cm-v513-side="${side}"]`);
  if (!root || !lineup) return;
  const field = currentLineup(lineup, minute);
  const outgoing = field.filter((name) => playerPosition(rosterPlayer(teamId, name)) !== 'Arquero');
  const eligible = eligiblePlayers(teamId, lineup, minute);
  const outSelect = root.querySelector(`[data-cm-v513-out="${side}"]`);
  const inSelect = root.querySelector(`[data-cm-v513-in="${side}"]`);
  if (outSelect) outSelect.innerHTML = outgoing.map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
  if (inSelect) inSelect.innerHTML = eligible.map((entry) => {
    const name = playerName(entry);
    const returned = (lineup.changes || []).some((change) => change.playerOut === name || change.playerIn === name);
    return `<option value="${esc(name)}">${esc(name)} · ${entry?.start ? 'titular' : `${availability(entry)}′`}${returned ? ' · reingreso' : ''}</option>`;
  }).join('');
  const button = root.querySelector('[data-cm-v513-substitute], [data-cm-v514-substitute]');
  if (button) {
    button.removeAttribute('data-cm-v513-substitute');
    button.dataset.cmV514Substitute = side;
    button.disabled = !outgoing.length || !eligible.length;
  }
  const waiting = teamRoster(teamId).filter((entry) => playerPosition(entry) !== 'Arquero' && availability(entry) > minute);
  const waitingRoot = root.querySelector('.cm-v513-waiting');
  if (waitingRoot) {
    waitingRoot.innerHTML = waiting.length ? `<b>Aún no disponibles:</b> ${waiting.map((entry) => `${esc(playerName(entry))} (${availability(entry)}′)`).join(' · ')}` : '';
    waitingRoot.hidden = !waiting.length;
  }
}

function patchLineupControls() {
  const section = document.getElementById('cmV513Lineups');
  if (!section) return;
  const minute = minuteNumber(document.getElementById('cmV59Minute')?.value || 0);
  const pair = section.closest('[data-cm-v59-live-pair]')?.dataset.cmV59LivePair || '';
  const context = matchContext(pair);
  if (!context) return;
  const previewMatch = clone(context.match);
  ensureLineups(previewMatch, context.home, context.away, core.getState());
  const signature = JSON.stringify({ pair, minute, lineups: previewMatch.lineups, version: VERSION });
  if (section.dataset.cmV514Signature === signature) return;
  section.dataset.cmV514Signature = signature;
  const explanation = section.querySelector(':scope > header p:last-child');
  if (explanation) explanation.textContent = 'Los jugadores se habilitan según el minuto de su carta y pueden volver a ingresar después de haber salido. El arquero titular permanece fijo.';
  patchLineupSide(section, 'home', minute, context.home, previewMatch.lineups?.home);
  patchLineupSide(section, 'away', minute, context.away, previewMatch.lineups?.away);
}

function decorateLiveCenter() {
  const live = document.querySelector('[data-cm-v59-live-pair]');
  if (!live) return;
  live.classList.add('cm-v514-unified-live');
  const heading = live.querySelector('.cm-v59-live-heading');
  if (heading && !heading.querySelector('.cm-v514-unified-badge')) {
    heading.querySelector('.eyebrow')?.replaceChildren('PARTIDO · GESTIÓN UNIFICADA');
    heading.insertAdjacentHTML('beforeend', '<span class="cm-v514-unified-badge">Marcador · goles · asistencias · tarjetas · cambios</span>');
  }
}

function refreshUi() {
  refreshQueued = false;
  decorateEntryButtons();
  decorateLiveCenter();
  patchLineupControls();
  makeDetailedReadOnly();
}

function scheduleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(refreshUi);
}

function installStyles() {
  if (document.getElementById('cmV514Styles')) return;
  const link = document.createElement('link');
  link.id = 'cmV514Styles';
  link.rel = 'stylesheet';
  link.href = `/chute-v514-unified-match.css?v=${VERSION}`;
  document.head.appendChild(link);
}

window.addEventListener('click', (event) => {
  const login = event.target.closest?.('[data-cm-v514-login]');
  if (login) {
    event.preventDefault();
    document.getElementById('authButton')?.click();
    return;
  }
  const substitution = event.target.closest?.('[data-cm-v514-substitute]');
  if (substitution) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const root = substitution.closest('[data-cm-v59-live-pair]');
    if (root && !substitution.disabled) void registerSubstitution(root.dataset.cmV59LivePair, substitution.dataset.cmV514Substitute);
    return;
  }
  const open = event.target.closest?.('[data-cm-v52-open-match], [data-cm-hub-match]');
  if (open) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openUnifiedPair(open.dataset.cmV52OpenMatch || open.dataset.cmHubMatch);
  }
}, true);

document.addEventListener('change', (event) => {
  if (event.target.id === 'cmV59Minute') scheduleRefresh();
}, true);

const observer = new MutationObserver(scheduleRefresh);
observer.observe(document.body, { childList: true, subtree: true });

installStyles();
if (window.ChuteDetailEvents) window.ChuteDetailEvents.openDetailedMatch = openUnifiedMatch;
if ('serviceWorker' in navigator) navigator.serviceWorker.register(`/sw.js?v=${VERSION}`).catch((error) => console.warn('No se pudo actualizar la PWA v5.14.', error));
document.title = 'Chute Mundo v5.14 · Partido unificado';
const heroVersion = document.querySelector('.hero .eyebrow');
if (heroVersion) heroVersion.textContent = 'CHUTE MUNDO v5.14';
refreshUi();

window.ChuteV514UnifiedMatch = {
  version: VERSION,
  openUnifiedMatch,
  currentLineup,
  eligiblePlayers,
  makeDetailedReadOnly,
  decorateEntryButtons,
  patchLineupControls,
  registerSubstitution
};
