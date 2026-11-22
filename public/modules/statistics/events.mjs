function waitForCore() {
  if (window.ChuteMundoCore) return Promise.resolve(window.ChuteMundoCore);
  return new Promise((resolve) => document.addEventListener('chute:ready', (event) => resolve(event.detail), { once: true }));
}

const core = await waitForCore();
const model = window.ChuteDetailModel;
if (!model) throw new Error('El modelo detallado no está disponible para Chute Mundo v5.16.1.');

const VERSION = '5.16.1';
const SCHEMA = 'match-events-stats-v516';
const OFFICIAL_MINUTES = ['0', '10', '20', '30', '45', '50', '60', '70', '80', '90', '105', '120'];
const DEFAULT_VENUES = ["Wladi's House", "Carlo's House"];
const clone = (value) => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const esc = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const minuteNumber = (value) => Math.max(0, Number.parseInt(String(value ?? '0'), 10) || 0);
const minuteLabel = (value) => `${minuteNumber(value)}′`;
const playerName = (entry) => Array.isArray(entry) ? String(entry[0] || '') : String(entry?.name || '');
const playerPosition = (entry) => Array.isArray(entry) ? String(entry[1] || '') : String(entry?.position || entry?.role || '');
let busy = false;
let refreshQueued = false;
let lastPlayerKey = '';

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

function currentLineup(lineup, minute = 120) {
  if (window.ChuteV515MatchCenter?.currentLineup) return window.ChuteV515MatchCenter.currentLineup(lineup, minute);
  if (window.ChuteV514UnifiedMatch?.currentLineup) return window.ChuteV514UnifiedMatch.currentLineup(lineup, minute);
  if (window.ChuteV513Lineups?.currentLineup) return window.ChuteV513Lineups.currentLineup(lineup, minute);
  return [...(lineup?.starters || [])];
}

function ensureLineups(match, home, away, source = core.getState()) {
  window.ChuteV513Lineups?.ensureMatchLineups?.(match, home, away, source);
}

function venues(source = core.getState(), current = '') {
  const custom = Array.isArray(source.config?.venues) ? source.config.venues : [];
  return [...new Set([...DEFAULT_VENUES, ...custom, current].map((value) => String(value || '').trim()).filter(Boolean))];
}

function minuteOptions(selected = '0') {
  return OFFICIAL_MINUTES.map((minute) => `<option value="${minute}" ${String(selected) === minute ? 'selected' : ''}>${minute}′</option>`).join('');
}

function groupedPlayerOptions(teamId, lineup, minute, selected = '', { emptyLabel = '' } = {}) {
  const field = new Set(currentLineup(lineup, minute));
  const roster = teamRoster(teamId);
  const onField = roster.filter((entry) => field.has(playerName(entry)));
  const others = roster.filter((entry) => !field.has(playerName(entry)));
  const option = (entry, active) => {
    const name = playerName(entry);
    const suffix = active ? ' · EN CANCHA' : ' · Otro jugador';
    return `<option value="${esc(name)}" class="${active ? 'cm-v516-option-field' : ''}" data-on-field="${active ? 'true' : 'false'}" ${name === selected ? 'selected' : ''}>${active ? '● ' : ''}${esc(name)}${suffix}</option>`;
  };
  return `${emptyLabel ? `<option value="">${esc(emptyLabel)}</option>` : '<option value="">Selecciona</option>'}
    <optgroup label="EN CANCHA">${onField.map((entry) => option(entry, true)).join('')}</optgroup>
    <optgroup label="OTROS JUGADORES · selección flexible">${others.map((entry) => option(entry, false)).join('')}</optgroup>`;
}

function groupedShootoutOptions(teamId, lineup, selected = '') {
  return groupedPlayerOptions(teamId, lineup, 120, selected, { emptyLabel: 'Selecciona lanzador' });
}

function readMetadata(match) {
  const date = document.getElementById('cmV59Date');
  const time = document.getElementById('cmV59Time');
  const venue = document.getElementById('cmV59Venue');
  if (date) match.date = date.value;
  if (time) match.time = time.value;
  if (venue) match.venue = venue.value.trim();
}

function syncPenaltyScore(match) {
  const attempts = Array.isArray(match.penaltyShootout) ? match.penaltyShootout : [];
  if (!match.shootoutStarted && !attempts.length) return;
  match.homePens = attempts.filter((item) => item.side === 'home' && item.result === 'scored').length;
  match.awayPens = attempts.filter((item) => item.side === 'away' && item.result === 'scored').length;
}

async function persist(pair, mutate, successText) {
  if (busy || !core.canEdit()) return false;
  const previous = clone(core.getState());
  const next = clone(previous);
  const context = matchContext(pair, next);
  if (!context) return core.showToast('El partido ya no está disponible.');
  ensureLineups(context.match, context.home, context.away, next);
  busy = true;
  try {
    readMetadata(context.match);
    mutate(context, next);
    context.match.participationTracked = true;
    syncPenaltyScore(context.match);
    model.syncLegacyLogs?.(context.match);
    context.match.updatedAt = Date.now();
    next.activity = Array.isArray(next.activity) ? next.activity : [];
    next.activity.unshift({ id: core.uid('activity'), text: successText, at: Date.now() });
    next.activity = next.activity.slice(0, 50);
    core.setState(next);
    core.persistLocal?.();
    await core.saveCloud();
    core.showToast(`${successText} Sincronizado con Firebase.`);
    window.ChuteV59?.openLiveMatch?.(pair);
    scheduleRefresh();
    return true;
  } catch (error) {
    console.error(error);
    core.setState(previous);
    core.showToast(`No se pudo guardar: ${error.code || error.message || 'error desconocido'}.`);
    window.ChuteV59?.openLiveMatch?.(pair);
    return false;
  } finally {
    busy = false;
  }
}

function selectedMinute(kind, side) {
  return document.querySelector(`[data-cm-v516-${kind}-minute="${side}"]`)?.value || '0';
}

async function addGoal(pair, side) {
  const scorer = document.getElementById(`cmV59Scorer-${side}`)?.value || '';
  const assist = document.getElementById(`cmV59Assist-${side}`)?.value || '';
  const minute = selectedMinute('goal', side);
  if (!scorer) return core.showToast('Selecciona al goleador.');
  if (assist && assist === scorer) return core.showToast('El goleador y el asistidor deben ser distintos.');
  const current = matchContext(pair);
  const teamId = side === 'away' ? current?.away : current?.home;
  const field = new Set(currentLineup(current?.match.lineups?.[side], minute));
  const warnings = [!field.has(scorer) ? scorer : '', assist && !field.has(assist) ? assist : ''].filter(Boolean);
  await persist(pair, (context) => {
    const eventTeamId = side === 'away' ? context.away : context.home;
    const scoreKey = side === 'away' ? 'awayGoals' : 'homeGoals';
    context.match.goals = Array.isArray(context.match.goals) ? context.match.goals : [];
    context.match.goals.push({
      id: core.uid('livegoal'), side, teamId: eventTeamId, playerName: scorer, assistName: assist,
      minute, createdAt: Date.now(), lineupVerified: warnings.length === 0
    });
    context.match[scoreKey] = Number(context.match[scoreKey] ?? 0) + 1;
    context.match.liveMinute = Math.max(Number(context.match.liveMinute || 0), minuteNumber(minute));
    context.match.liveStatus = 'active';
  }, `Gol de ${scorer} registrado${warnings.length ? ` · selección flexible: ${warnings.join(' y ')} no figuraba en cancha` : ''}.`);
}

async function addCard(pair, side) {
  const player = document.getElementById(`cmV59CardPlayer-${side}`)?.value || '';
  const requested = document.getElementById(`cmV59CardType-${side}`)?.value || 'yellow';
  const minute = selectedMinute('card', side);
  if (!player) return core.showToast('Selecciona al jugador sancionado.');
  await persist(pair, (context) => {
    const teamId = side === 'away' ? context.away : context.home;
    context.match.cards = Array.isArray(context.match.cards) ? context.match.cards : [];
    const priorYellow = requested === 'yellow' && context.match.cards.some((card) => card.side === side && card.playerName === player && card.type === 'yellow');
    context.match.cards.push({
      id: core.uid('livecard'), side, teamId, playerName: player, role: 'player',
      type: priorYellow || requested === 'red' ? 'red' : 'yellow', minute, createdAt: Date.now(),
      reason: priorYellow ? 'double_yellow' : '', secondYellow: priorYellow
    });
    context.match.liveMinute = Math.max(Number(context.match.liveMinute || 0), minuteNumber(minute));
    context.match.liveStatus = 'active';
  }, requested === 'red' ? `Tarjeta roja para ${player}.` : `Amonestación para ${player} registrada.`);
}

function substitutionEvent(change, side, teamId) {
  return {
    id: change.id, kind: 'substitution', type: 'substitution', side, teamId,
    playerName: change.playerIn, playerIn: change.playerIn, playerOut: change.playerOut,
    minute: String(change.minute), createdAt: change.createdAt
  };
}

async function addSubstitution(pair, side) {
  const minute = selectedMinute('sub', side);
  const playerOut = document.querySelector(`[data-cm-v513-out="${side}"]`)?.value || '';
  const playerIn = document.querySelector(`[data-cm-v513-in="${side}"]`)?.value || '';
  if (!playerOut || !playerIn) return core.showToast('Selecciona quién sale y quién entra.');
  const source = core.getState();
  const context = matchContext(pair, source);
  const teamId = side === 'away' ? context?.away : context?.home;
  const lineup = context?.match.lineups?.[side];
  const field = currentLineup(lineup, minute);
  const incoming = rosterPlayer(teamId, playerIn, source);
  if (!field.includes(playerOut)) return core.showToast('El jugador que sale no está en cancha en ese minuto.');
  if (playerPosition(rosterPlayer(teamId, playerOut, source)) === 'Arquero') return core.showToast('El arquero titular permanece durante todo el partido.');
  if (!incoming || Number(incoming?.minute ?? 0) > minuteNumber(minute)) return core.showToast(`${playerIn} todavía no está habilitado para ingresar.`);
  if (field.includes(playerIn)) return core.showToast(`${playerIn} ya está en cancha.`);

  await persist(pair, (nextContext) => {
    const eventTeamId = side === 'away' ? nextContext.away : nextContext.home;
    const nextLineup = nextContext.match.lineups[side];
    const change = { id: core.uid('livesub'), minute: minuteNumber(minute), playerOut, playerIn, createdAt: Date.now() };
    nextLineup.changes.push(change);
    nextContext.match.specialEvents = Array.isArray(nextContext.match.specialEvents) ? nextContext.match.specialEvents : [];
    nextContext.match.specialEvents.push(substitutionEvent(change, side, eventTeamId));
    nextContext.match.liveMinute = Math.max(Number(nextContext.match.liveMinute || 0), minuteNumber(minute));
    nextContext.match.liveStatus = 'active';
  }, `Cambio en ${core.teamName(teamId)}: entra ${playerIn} y sale ${playerOut} (${minuteLabel(minute)}).`);
}

function isKnockout(context) {
  return context?.match?.stage === 'knockout';
}

function scoreTied(match) {
  return Number(match?.homeGoals ?? 0) === Number(match?.awayGoals ?? 0);
}

async function startShootout(pair) {
  const context = matchContext(pair);
  if (!isKnockout(context)) return core.showToast('La tanda solo corresponde a partidos de Play-Off.');
  if (!scoreTied(context.match)) return core.showToast('La tanda solo se habilita si el partido termina empatado tras 120 minutos.');
  if (!window.confirm('Confirma que el partido terminó empatado después de 120 minutos y que comenzará la tanda de penales.')) return;
  await persist(pair, ({ match }) => {
    match.shootoutStarted = true;
    match.shootoutStartedAt = Date.now();
    match.penaltyShootout = Array.isArray(match.penaltyShootout) ? match.penaltyShootout : [];
    match.liveMinute = 120;
    match.liveStatus = 'active';
  }, 'Tanda de penales iniciada después de 120 minutos.');
}

async function addShootoutPenalty(pair, side) {
  const player = document.querySelector(`[data-cm-v516-penalty-player="${side}"]`)?.value || '';
  const result = document.querySelector(`[data-cm-v516-penalty-result="${side}"]`)?.value || 'scored';
  if (!player) return core.showToast('Selecciona al lanzador.');
  const context = matchContext(pair);
  if (!context?.match.shootoutStarted || !scoreTied(context.match)) return core.showToast('Primero confirma el empate después de 120 minutos.');
  await persist(pair, (nextContext) => {
    const teamId = side === 'away' ? nextContext.away : nextContext.home;
    nextContext.match.penaltyShootout = Array.isArray(nextContext.match.penaltyShootout) ? nextContext.match.penaltyShootout : [];
    nextContext.match.penaltyShootout.push({
      id: core.uid('shootout'), kind: 'shootout_penalty', side, teamId, playerName: player,
      result, order: nextContext.match.penaltyShootout.length + 1, createdAt: Date.now()
    });
    nextContext.match.liveMinute = 120;
  }, `Penal de tanda ${result === 'scored' ? 'anotado' : 'fallado'} por ${player}.`);
}

async function undoShootoutPenalty(pair) {
  const context = matchContext(pair);
  const latest = [...(context?.match.penaltyShootout || [])].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];
  if (!latest) return;
  await persist(pair, ({ match }) => {
    match.penaltyShootout = (match.penaltyShootout || []).filter((item) => item.id !== latest.id);
  }, `Último penal de tanda corregido: ${latest.playerName}.`);
}

function updatePlayerSelects(side, kind) {
  const live = document.querySelector('[data-cm-v59-live-pair]');
  const context = live ? matchContext(live.dataset.cmV59LivePair) : null;
  if (!context) return;
  const minute = selectedMinute(kind, side);
  const teamId = side === 'away' ? context.away : context.home;
  const lineup = context.match.lineups?.[side];
  const ids = kind === 'goal'
    ? [[`cmV59Scorer-${side}`, ''], [`cmV59Assist-${side}`, 'Sin asistencia']]
    : [[`cmV59CardPlayer-${side}`, '']];
  ids.forEach(([id, emptyLabel]) => {
    const select = document.getElementById(id);
    if (!select) return;
    const field = currentLineup(lineup, minute);
    const signature = JSON.stringify({ minute, field, roster: teamRoster(teamId).map(playerName), emptyLabel });
    if (select.dataset.cmV516Options === signature) return;
    const selected = select.value;
    select.innerHTML = groupedPlayerOptions(teamId, lineup, minute, selected, { emptyLabel });
    select.dataset.cmV516Options = signature;
    if ([...select.options].some((option) => option.value === selected)) select.value = selected;
  });
}

function renderSideForMinute(side) {
  const live = document.querySelector('[data-cm-v59-live-pair]');
  const context = live ? matchContext(live.dataset.cmV59LivePair) : null;
  const root = live?.querySelector(`[data-cm-v513-side="${side}"]`);
  if (!context || !root) return;
  const minute = selectedMinute('sub', side);
  const teamId = side === 'away' ? context.away : context.home;
  const lineup = context.match.lineups?.[side];
  const field = currentLineup(lineup, minute);
  const roster = teamRoster(teamId);
  const outgoing = field.filter((name) => playerPosition(rosterPlayer(teamId, name)) !== 'Arquero');
  const eligible = roster.filter((entry) => playerPosition(entry) !== 'Arquero' && Number(entry?.minute ?? 0) <= minuteNumber(minute) && !field.includes(playerName(entry)));
  const sideSignature = JSON.stringify({ minute, field, outgoing, eligible: eligible.map(playerName), changes: lineup?.changes || [] });
  if (root.dataset.cmV516MinuteSignature === sideSignature) return;
  root.dataset.cmV516MinuteSignature = sideSignature;
  const outSelect = root.querySelector(`[data-cm-v513-out="${side}"]`);
  const inSelect = root.querySelector(`[data-cm-v513-in="${side}"]`);
  if (outSelect) outSelect.innerHTML = outgoing.map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
  if (inSelect) inSelect.innerHTML = eligible.map((entry) => `<option value="${esc(playerName(entry))}">${esc(playerName(entry))} · disponible ${Number(entry?.minute ?? 0)}′</option>`).join('');
  const button = root.querySelector('[data-cm-v516-substitute]');
  if (button) button.disabled = !outgoing.length || !eligible.length;
  const fieldRoot = root.querySelector('.cm-v513-field');
  if (fieldRoot) fieldRoot.innerHTML = field.map((name, index) => {
    const entry = rosterPlayer(teamId, name);
    const goalkeeper = playerPosition(entry) === 'Arquero';
    return `<span class="cm-v515-player-slot ${goalkeeper ? 'is-goalkeeper' : ''}" data-slot="${index + 1}"><b>${esc(name)}</b><small>${esc(playerPosition(entry) || 'Jugador')}${goalkeeper ? ' · fijo' : ''}</small><em class="cm-v515-on-field">EN CANCHA</em></span>`;
  }).join('');
  const counter = root.querySelector(':scope > header > span');
  if (counter) counter.textContent = `${field.length} de 4 en cancha · ${minuteLabel(minute)}`;
  const waiting = roster.filter((entry) => playerPosition(entry) !== 'Arquero' && Number(entry?.minute ?? 0) > minuteNumber(minute));
  const waitingRoot = root.querySelector('.cm-v513-waiting');
  if (waitingRoot) {
    waitingRoot.hidden = !waiting.length;
    waitingRoot.innerHTML = waiting.length ? `<span class="cm-v515-waiting-title">Próximos ingresos</span><span class="cm-v515-waiting-chips">${waiting.map((entry) => `<i>${esc(playerName(entry))}<b>${Number(entry?.minute ?? 0)}′</b></i>`).join('')}</span>` : '';
  }
}

function decorateMeta(live, context) {
  const meta = live.querySelector('.cm-v59-live-meta');
  if (!meta) return;
  const globalMinute = document.getElementById('cmV59Minute');
  if (globalMinute) {
    globalMinute.value = String(context.match.liveMinute || 0);
    globalMinute.closest('label')?.classList.add('cm-v516-global-minute-hidden');
  }
  const venueField = document.getElementById('cmV59Venue');
  const venueLabel = venueField?.closest('label');
  if (venueLabel && venueField.tagName !== 'SELECT') {
    const options = venues(core.getState(), context.match.venue).map((venue) => `<option value="${esc(venue)}" ${venue === context.match.venue ? 'selected' : ''}>${esc(venue)}</option>`).join('');
    venueLabel.innerHTML = `Sede<div class="cm-v516-venue-row"><select id="cmV59Venue">${options}</select><button type="button" data-cm-v516-add-venue>+ Nueva sede</button></div>`;
  }
  ['cmV59HomePens', 'cmV59AwayPens'].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.closest('label')?.classList.add('cm-v516-legacy-pens-hidden');
  });
}

function decorateForms(live, context) {
  for (const side of ['home', 'away']) {
    const sideRoot = live.querySelector(`.cm-v59-live-side[data-side="${side}"]`);
    if (!sideRoot) continue;
    const defaultMinute = String(Math.min(120, Number(context.match.liveMinute || 0)));
    const goalForm = sideRoot.querySelector('.cm-v59-live-event-form:not(.compact)');
    if (goalForm) {
      if (!goalForm.querySelector(`[data-cm-v516-goal-minute="${side}"]`)) goalForm.querySelector('p')?.insertAdjacentHTML('afterend', `<label class="cm-v516-event-minute">Minuto del gol<select data-cm-v516-goal-minute="${side}">${minuteOptions(defaultMinute)}</select></label>`);
      const button = goalForm.querySelector('[data-cm-v59-add-goal], [data-cm-v516-add-goal]');
      if (button) { button.removeAttribute('data-cm-v59-add-goal'); button.dataset.cmV516AddGoal = side; button.textContent = '⚽ Agregar gol'; }
      updatePlayerSelects(side, 'goal');
    }
    const cardForm = sideRoot.querySelector('.cm-v59-live-event-form.compact');
    if (cardForm) {
      if (!cardForm.querySelector(`[data-cm-v516-card-minute="${side}"]`)) cardForm.querySelector('p')?.insertAdjacentHTML('afterend', `<label class="cm-v516-event-minute">Minuto de la amonestación<select data-cm-v516-card-minute="${side}">${minuteOptions(defaultMinute)}</select></label>`);
      const button = cardForm.querySelector('[data-cm-v59-add-card], [data-cm-v516-add-card]');
      if (button) { button.removeAttribute('data-cm-v59-add-card'); button.dataset.cmV516AddCard = side; button.textContent = 'Agregar amonestación'; }
      updatePlayerSelects(side, 'card');
    }
    const changeForm = live.querySelector(`[data-cm-v513-side="${side}"] .cm-v513-change-form`);
    if (changeForm) {
      if (!changeForm.querySelector(`[data-cm-v516-sub-minute="${side}"]`)) changeForm.insertAdjacentHTML('afterbegin', `<label class="cm-v516-event-minute">Minuto del cambio<select data-cm-v516-sub-minute="${side}">${minuteOptions(defaultMinute)}</select></label>`);
      const button = changeForm.querySelector('[data-cm-v513-substitute], [data-cm-v514-substitute], [data-cm-v515-substitute], [data-cm-v516-substitute]');
      if (button) {
        button.removeAttribute('data-cm-v513-substitute');
        button.removeAttribute('data-cm-v514-substitute');
        button.removeAttribute('data-cm-v515-substitute');
        button.dataset.cmV516Substitute = side;
        button.textContent = 'Confirmar cambio';
      }
      renderSideForMinute(side);
    }
  }
}

function shootoutMarkup(context) {
  if (!isKnockout(context)) return '';
  const match = context.match;
  const attempts = match.penaltyShootout || [];
  const homeScore = attempts.filter((item) => item.side === 'home' && item.result === 'scored').length;
  const awayScore = attempts.filter((item) => item.side === 'away' && item.result === 'scored').length;
  if (!scoreTied(match)) return `<section class="cm-v516-shootout is-locked"><header><div><p class="eyebrow">PLAY-OFF</p><h3>Tanda de penales</h3></div><span>No requerida</span></header><p>La tanda solo se habilita si el marcador continúa empatado después de 120 minutos.</p></section>`;
  if (!match.shootoutStarted) return `<section class="cm-v516-shootout"><header><div><p class="eyebrow">PLAY-OFF</p><h3>Tanda de penales</h3></div><span>Empate</span></header><p>Los penales no forman parte del marcador de los 120 minutos. Se registran individualmente para decidir al ganador.</p><button type="button" data-cm-v516-start-shootout>Iniciar tanda después de 120′</button></section>`;
  const side = (key, teamId) => `<article><header>${model.logo(teamId, 'cm-v516-shootout-logo')}<div><small>${key === 'home' ? 'LOCAL' : 'VISITA'}</small><strong>${esc(core.teamName(teamId))}</strong></div><b>${key === 'home' ? homeScore : awayScore}</b></header><label>Lanzador<select data-cm-v516-penalty-player="${key}">${groupedShootoutOptions(teamId, match.lineups?.[key])}</select></label><label>Resultado<select data-cm-v516-penalty-result="${key}"><option value="scored">Anotado</option><option value="missed">Fallado</option></select></label><button type="button" data-cm-v516-add-penalty="${key}">Registrar penal</button></article>`;
  const history = attempts.length ? attempts.map((item) => `<li><b>${item.order}</b><span>${item.result === 'scored' ? '✅' : '❌'} <strong>${esc(item.playerName)}</strong><small>${esc(core.teamName(item.teamId))}</small></span></li>`).join('') : '<li class="is-empty">Aún no hay lanzamientos registrados.</li>';
  return `<section class="cm-v516-shootout is-active"><header><div><p class="eyebrow">DEFINICIÓN</p><h3>Tanda de penales</h3></div><span>${homeScore}–${awayScore}</span></header><div class="cm-v516-shootout-grid">${side('home', context.home)}${side('away', context.away)}</div><ol>${history}</ol></section>`;
}

function decorateShootout(live, context) {
  let section = live.querySelector('#cmV516Shootout');
  const markup = shootoutMarkup(context);
  if (!markup) { section?.remove(); return; }
  const signature = JSON.stringify({ tied: scoreTied(context.match), started: context.match.shootoutStarted, attempts: context.match.penaltyShootout || [], homeGoals: context.match.homeGoals, awayGoals: context.match.awayGoals });
  if (section?.dataset.signature === signature) return;
  const wrapper = `<div id="cmV516Shootout" data-signature="${esc(signature)}">${markup}</div>`;
  if (section) section.outerHTML = wrapper;
  else live.querySelector('.cm-v59-live-timeline')?.insertAdjacentHTML('beforebegin', wrapper);
  const homeInput = document.getElementById('cmV59HomePens');
  const awayInput = document.getElementById('cmV59AwayPens');
  if (homeInput) homeInput.value = context.match.homePens ?? 0;
  if (awayInput) awayInput.value = context.match.awayPens ?? 0;
}

function unifiedEvents(context) {
  const base = window.ChuteV515MatchCenter?.unifiedEvents?.(context) || [];
  const penalties = (context.match.penaltyShootout || []).map((item, index) => ({ ...item, kind: 'shootout_penalty', sort: 1000 + Number(item.order || index + 1) }));
  return [...base.filter((item) => item.kind !== 'shootout_penalty'), ...penalties]
    .sort((a, b) => Number(a.sort ?? minuteNumber(a.minute)) - Number(b.sort ?? minuteNumber(b.minute)) || Number(a.createdAt || 0) - Number(b.createdAt || 0));
}

function timelineMarkup(context, event) {
  if (event.kind === 'shootout_penalty') return `<div class="cm-v515-timeline-event cm-v516-penalty-event ${event.result === 'scored' ? 'is-scored' : 'is-missed'}"><span class="cm-v515-event-minute">P${event.order}</span>${model.photo(event.teamId, event.playerName, 'cm-v515-event-face')}<div class="cm-v515-event-copy"><strong>${event.result === 'scored' ? '✅ Penal anotado' : '❌ Penal fallado'} · ${esc(event.playerName)}</strong><small>${esc(core.teamName(event.teamId))} · Tanda de Play-Off</small></div></div>`;
  if (event.kind === 'substitution') return `<div class="cm-v515-timeline-event is-substitution"><span class="cm-v515-event-minute">${minuteLabel(event.minute)}</span><div class="cm-v515-sub-faces">${model.photo(event.teamId, event.playerOut, 'cm-v515-event-face')}<i>→</i>${model.photo(event.teamId, event.playerIn, 'cm-v515-event-face')}</div><div class="cm-v515-event-copy"><strong><span class="cm-v515-in">ENTRA</span> ${esc(event.playerIn)}</strong><small><span class="cm-v515-out">SALE</span> ${esc(event.playerOut)} · ${esc(core.teamName(event.teamId))}</small></div></div>`;
  const teamId = event.teamId || (event.side === 'away' ? context.away : context.home);
  if (event.kind === 'goal') return `<div class="cm-v515-timeline-event is-goal"><span class="cm-v515-event-minute">${minuteLabel(event.minute)}</span>${model.photo(teamId, event.playerName, 'cm-v515-event-face')}<div class="cm-v515-event-copy"><strong>⚽ ${esc(event.playerName)}</strong><small>${esc(core.teamName(teamId))}${event.assistName ? ` · Asistencia: ${esc(event.assistName)}` : ''}${event.lineupVerified === false ? ' · Selección flexible' : ''}</small></div></div>`;
  if (event.kind === 'card') return `<div class="cm-v515-timeline-event is-card"><span class="cm-v515-event-minute">${minuteLabel(event.minute)}</span>${model.photo(teamId, event.playerName, 'cm-v515-event-face')}<div class="cm-v515-event-copy"><strong>${event.type === 'red' ? '🟥' : '🟨'} ${esc(event.playerName)}</strong><small>${esc(core.teamName(teamId))}${event.reason === 'double_yellow' ? ' · Doble amarilla' : ''}</small></div></div>`;
  return '';
}

function renderTimeline(live, context) {
  const timeline = live.querySelector('.cm-v59-live-timeline');
  if (!timeline) return;
  const events = unifiedEvents(context);
  const signature = JSON.stringify(events.map((event) => [event.id, event.kind, event.minute, event.result, event.playerName, event.playerIn, event.playerOut]));
  const penaltyCount = events.filter((event) => event.kind === 'shootout_penalty').length;
  if (timeline.dataset.cmV516Timeline === signature && timeline.querySelectorAll('.cm-v516-penalty-event').length === penaltyCount) return;
  timeline.dataset.cmV516Timeline = signature;
  const header = timeline.querySelector(':scope > header');
  header?.querySelector('.eyebrow')?.replaceChildren('EVENTOS OFICIALES');
  header?.querySelector('h3')?.replaceChildren('Cronología del partido');
  const count = header?.querySelector(':scope > span');
  if (count) count.textContent = `${events.length} evento${events.length === 1 ? '' : 's'}`;
  [...timeline.children].filter((child) => child !== header).forEach((child) => child.remove());
  timeline.insertAdjacentHTML('beforeend', events.length ? `<div class="cm-v515-timeline-list">${events.map((event) => timelineMarkup(context, event)).join('')}</div>` : '<div class="cm-v59-live-empty">Todavía no hay eventos registrados.</div>');
  const undo = live.querySelector('[data-cm-v59-undo], [data-cm-v516-undo]');
  if (undo) undo.disabled = !events.length;
}

function matchRows(source = core.getState(), filterTournamentId = null) {
  const official = (source.tournaments || []).flatMap((tournament) => (tournament.matches || []).map((match) => ({ tournamentId: tournament.id, tournamentName: tournament.name, tournament, match, home: match.home || core.resolveHome(tournament, match), away: match.away || core.resolveAway(tournament, match) })));
  const friendlies = (source.friendlies || []).map((match) => ({ tournamentId: 'friendly', tournamentName: 'Amistosos', tournament: null, match, home: match.home, away: match.away }));
  return [...official, ...friendlies].filter((row) => row.home && row.away && core.matchPlayed(row.match) && (!filterTournamentId || row.tournamentId === filterTournamentId));
}

function matchLength(match) {
  if (match.shootoutStarted) return 120;
  const minutes = [...(match.goals || []), ...(match.cards || []), ...(match.lineups?.home?.changes || []), ...(match.lineups?.away?.changes || [])].map((item) => minuteNumber(item.minute));  return Math.max(90, ...minutes, Number(match.duration || 0));
}

function winnerId(row) {
  const homeGoals = Number(row.match.homeGoals);
  const awayGoals = Number(row.match.awayGoals);
  if (homeGoals > awayGoals) return row.home;
  if (awayGoals > homeGoals) return row.away;
  if (row.match.homePens !== null && row.match.homePens !== undefined && row.match.awayPens !== null && row.match.awayPens !== undefined) {
    if (Number(row.match.homePens) > Number(row.match.awayPens)) return row.home;
    if (Number(row.match.awayPens) > Number(row.match.homePens)) return row.away;
  }
  return null;
}

function playerStats(teamId, name, source = core.getState(), filterTournamentId = null) {
  const entry = rosterPlayer(teamId, name, source);
  const goalkeeper = playerPosition(entry) === 'Arquero';
  const result = {
    teamId, name, position: playerPosition(entry) || 'Jugador', goalkeeper,
    appearances: 0, minutes: 0, entries: 0, substituted: 0,
    goals: 0, assists: 0, yellows: 0, reds: 0,
    penaltiesScored: 0, penaltiesMissed: 0, penaltyAttempts: 0,
    goalsConceded: 0, cleanSheets: 0, wins: 0, draws: 0, losses: 0
  };
  for (const row of matchRows(source, filterTournamentId)) {
    const side = row.home === teamId ? 'home' : row.away === teamId ? 'away' : null;
    if (!side) continue;
    for (const goal of row.match.goals || []) {
      const goalTeam = goal.teamId || (goal.side === 'away' ? row.away : row.home);
      if (goalTeam !== teamId) continue;
      if (goal.playerName === name) result.goals += 1;
      if (goal.assistName === name) result.assists += 1;
    }
    for (const card of row.match.cards || []) {
      const cardTeam = card.teamId || (card.side === 'away' ? row.away : row.home);
      if (cardTeam !== teamId || card.playerName !== name) continue;
      if (card.type === 'red') result.reds += 1; else result.yellows += 1;
    }
    for (const penalty of row.match.penaltyShootout || []) {
      if (penalty.teamId !== teamId || penalty.playerName !== name) continue;
      result.penaltyAttempts += 1;
      if (penalty.result === 'scored') result.penaltiesScored += 1; else result.penaltiesMissed += 1;
    }
    if (!row.match.participationTracked) continue;
    const lineup = row.match.lineups?.[side];    if (!lineup?.starters?.length) continue;
    let active = lineup.starters.includes(name);
    let appeared = active;
    let enteredAt = active ? 0 : null;
    for (const change of [...(lineup.changes || [])].sort((a, b) => minuteNumber(a.minute) - minuteNumber(b.minute) || Number(a.createdAt || 0) - Number(b.createdAt || 0))) {
      const minute = minuteNumber(change.minute);
      if (change.playerOut === name && active) {
        if (!goalkeeper) result.minutes += Math.max(0, minute - enteredAt);
        active = false;
        enteredAt = null;
        result.substituted += 1;
      }
      if (change.playerIn === name && !active) {
        active = true;
        appeared = true;
        enteredAt = minute;
        result.entries += 1;
      }
    }
    if (active && !goalkeeper) result.minutes += Math.max(0, matchLength(row.match) - enteredAt);
    if (!appeared) continue;
    result.appearances += 1;
    if (goalkeeper) {
      const conceded = side === 'home' ? Number(row.match.awayGoals || 0) : Number(row.match.homeGoals || 0);
      result.goalsConceded += conceded;
      if (conceded === 0) result.cleanSheets += 1;
      const winner = winnerId(row);
      if (winner === teamId) result.wins += 1;
      else if (winner) result.losses += 1;
      else result.draws += 1;
    }
  }
  result.contributions = result.goals + result.assists;
  result.penaltyEffectiveness = result.penaltyAttempts ? Math.round((result.penaltiesScored / result.penaltyAttempts) * 100) : 0;
  result.goalsConcededAverage = result.appearances ? (result.goalsConceded / result.appearances).toFixed(2) : '0.00';
  return result;
}

function metric(value, label) {
  return `<article><b>${esc(value)}</b><span>${esc(label)}</span></article>`;
}

function playerKeyParts(value = '') {
  const separator = value.indexOf('__');
  return separator < 0 ? { teamId: '', name: '' } : { teamId: value.slice(0, separator), name: decodeURIComponent(value.slice(separator + 2)) };
}

function tournamentStatsRows(teamId, name, source) {
  const ids = [...new Set(matchRows(source).map((row) => row.tournamentId))];
  return ids.map((id) => ({ id, name: id === 'friendly' ? 'Amistosos' : source.tournaments?.find((item) => item.id === id)?.name || 'Torneo', stats: playerStats(teamId, name, source, id) }))
    .filter((row) => row.stats.appearances || row.stats.goals || row.stats.assists || row.stats.yellows || row.stats.reds || row.stats.penaltyAttempts);
}

function decoratePlayerProfile() {
  if (!lastPlayerKey) return;
  const modal = document.querySelector('.cm-v59-profile-modal');
  if (!modal) return;
  const { teamId, name } = playerKeyParts(lastPlayerKey);
  if (!teamId || modal.querySelector('h2')?.textContent?.trim() !== name) return;
  const source = core.getState();
  const stats = playerStats(teamId, name, source);
  const signature = JSON.stringify(stats);
  if (modal.dataset.cmV516Stats === signature) return;
  modal.dataset.cmV516Stats = signature;
  const metrics = modal.querySelector('.cm-v59-profile-metrics');
  if (metrics) {
    metrics.innerHTML = stats.goalkeeper
      ? `${metric(stats.appearances, 'Partidos jugados')}${metric(stats.goalsConceded, 'Goles recibidos')}${metric(stats.goalsConcededAverage, 'Promedio recibidos')}${metric(stats.cleanSheets, 'Vallas invictas')}${metric(stats.wins, 'Victorias')}${metric(stats.draws, 'Empates')}${metric(stats.losses, 'Derrotas')}${metric(`${stats.yellows}/${stats.reds}`, 'Amarillas / rojas')}${metric(stats.penaltiesScored, 'Penales anotados')}`
      : `${metric(stats.appearances, 'Partidos jugados')}${metric(stats.minutes, 'Minutos')}${metric(stats.goals, 'Goles')}${metric(stats.assists, 'Asistencias')}${metric(stats.contributions, 'G+A')}${metric(stats.entries, 'Ingresos')}${metric(stats.substituted, 'Veces sustituido')}${metric(`${stats.penaltiesScored}/${stats.penaltyAttempts}`, 'Penales anotados')}${metric(stats.penaltiesMissed, 'Penales fallados')}${metric(`${stats.yellows}/${stats.reds}`, 'Amarillas / rojas')}`;
    modal.querySelector('.cm-v516-stats-note')?.remove();
    metrics.insertAdjacentHTML('afterend', '<p class="cm-v516-stats-note">La participación se calcula desde partidos con alineaciones y cambios registrados. Los penales corresponden únicamente a tandas de Play-Off.</p>');
  }
  const rows = tournamentStatsRows(teamId, name, source);
  const firstSection = modal.querySelector('.cm-v59-profile-columns section');
  if (firstSection) {
    firstSection.querySelector('h3')?.replaceChildren(stats.goalkeeper ? 'Rendimiento de portero por torneo' : 'Rendimiento por torneo');
    const tableWrap = firstSection.querySelector('.cm-v59-table-wrap');
    if (tableWrap) {
      const body = rows.length ? rows.map((row) => stats.goalkeeper
        ? `<tr><td>${esc(row.name)}</td><td>${row.stats.appearances}</td><td>${row.stats.goalsConceded}</td><td>${row.stats.cleanSheets}</td><td>${row.stats.wins}</td><td>${row.stats.draws}</td><td>${row.stats.losses}</td><td>${row.stats.penaltiesScored}</td></tr>`
        : `<tr><td>${esc(row.name)}</td><td>${row.stats.appearances}</td><td>${row.stats.minutes}</td><td>${row.stats.goals}</td><td>${row.stats.assists}</td><td>${row.stats.penaltiesScored}</td><td>${row.stats.yellows}</td><td>${row.stats.reds}</td></tr>`).join('') : `<tr><td colspan="8">Sin datos registrados.</td></tr>`;
      tableWrap.innerHTML = stats.goalkeeper
        ? `<table><thead><tr><th>Torneo</th><th>PJ</th><th>GC</th><th>VI</th><th>PG</th><th>PE</th><th>PP</th><th>Pen.</th></tr></thead><tbody>${body}</tbody></table>`
        : `<table><thead><tr><th>Torneo</th><th>PJ</th><th>Min.</th><th>G</th><th>A</th><th>Pen.</th><th>TA</th><th>TR</th></tr></thead><tbody>${body}</tbody></table>`;
    }
  }
  modal.querySelectorAll('.cm-v513-participation').forEach((item) => item.remove());
  [...modal.querySelectorAll('.cm-v59-profile-metrics article')].filter((item) => item.textContent.includes('Titularidades')).forEach((item) => item.remove());
}

function allPlayerStats(source = core.getState()) {
  return (source.teams || []).flatMap((team) => (team.players || []).map((entry) => ({ team, ...playerStats(team.id, playerName(entry), source) })));
}

function decorateStatsPage() {
  const page = document.getElementById('estadisticas');
  if (!page) return;
  const source = core.getState();
  const rows = allPlayerStats(source);
  const participation = rows.filter((row) => !row.goalkeeper && (row.appearances || row.minutes || row.entries || row.substituted)).sort((a, b) => b.minutes - a.minutes || b.appearances - a.appearances).slice(0, 20);
  const keepers = rows.filter((row) => row.goalkeeper && row.appearances).sort((a, b) => b.cleanSheets - a.cleanSheets || Number(a.goalsConcededAverage) - Number(b.goalsConcededAverage));
  const penalties = rows.filter((row) => row.penaltyAttempts).sort((a, b) => b.penaltiesScored - a.penaltiesScored || b.penaltyEffectiveness - a.penaltyEffectiveness);
  const signature = JSON.stringify([participation, keepers, penalties].map((list) => list.map((row) => [row.teamId, row.name, row.appearances, row.minutes, row.penaltyAttempts, row.goalsConceded])));
  let host = document.getElementById('cmV516Stats');
  if (host?.dataset.signature === signature) return;
  const participationRows = participation.length ? participation.map((row) => `<tr><td><b>${esc(row.name)}</b><small>${esc(row.team.name)}</small></td><td>${row.appearances}</td><td>${row.minutes}</td><td>${row.entries}</td><td>${row.substituted}</td><td>${row.goals}</td><td>${row.assists}</td></tr>`).join('') : '<tr><td colspan="7">Aún no existen partidos con participación registrada.</td></tr>';
  const keeperRows = keepers.length ? keepers.map((row) => `<tr><td><b>${esc(row.name)}</b><small>${esc(row.team.name)}</small></td><td>${row.appearances}</td><td>${row.goalsConceded}</td><td>${row.goalsConcededAverage}</td><td>${row.cleanSheets}</td><td>${row.wins}-${row.draws}-${row.losses}</td></tr>`).join('') : '<tr><td colspan="6">Aún no existen datos de porteros registrados.</td></tr>';
  const penaltyRows = penalties.length ? penalties.map((row) => `<tr><td><b>${esc(row.name)}</b><small>${esc(row.team.name)}</small></td><td>${row.penaltiesScored}</td><td>${row.penaltiesMissed}</td><td>${row.penaltyAttempts}</td><td>${row.penaltyEffectiveness}%</td></tr>`).join('') : '<tr><td colspan="5">Todavía no se han registrado tandas de penales.</td></tr>';
  const markup = `<div id="cmV516Stats" data-signature="${esc(signature)}"><div class="two-columns"><article class="panel"><div class="panel-head"><div><p class="eyebrow">PARTICIPACIÓN</p><h2>Minutos y cambios</h2></div></div><div class="cm-v516-table"><table><thead><tr><th>Jugador</th><th>PJ</th><th>Min.</th><th>Ingresos</th><th>Sust.</th><th>G</th><th>A</th></tr></thead><tbody>${participationRows}</tbody></table></div></article><article class="panel"><div class="panel-head"><div><p class="eyebrow">PORTEROS</p><h2>Rendimiento registrado</h2></div></div><div class="cm-v516-table"><table><thead><tr><th>Portero</th><th>PJ</th><th>GC</th><th>Prom.</th><th>VI</th><th>G-E-P</th></tr></thead><tbody>${keeperRows}</tbody></table></div></article></div><article class="panel"><div class="panel-head"><div><p class="eyebrow">PLAY-OFF</p><h2>Penales de tanda</h2></div></div><div class="cm-v516-table"><table><thead><tr><th>Jugador</th><th>Anotados</th><th>Fallados</th><th>Intentos</th><th>Efectividad</th></tr></thead><tbody>${penaltyRows}</tbody></table></div></article></div>`;
  if (host) host.outerHTML = markup;
  else page.querySelector('#recordsGrid')?.closest('article')?.insertAdjacentHTML('beforebegin', markup);
}

async function addVenue(pair) {
  const name = window.prompt('Nombre de la nueva sede:')?.trim() || '';
  if (!name) return;
  const previous = clone(core.getState());
  const next = clone(previous);
  const existing = venues(next).find((venue) => venue.toLocaleLowerCase('es') === name.toLocaleLowerCase('es'));
  if (existing) return core.showToast('Esa sede ya está registrada.');
  next.config = { ...(next.config || {}), venues: [...venues(next), name], matchCenterSchema: SCHEMA };
  const context = matchContext(pair, next);
  if (context) context.match.venue = name;
  try {
    core.setState(next);
    core.persistLocal?.();
    await core.saveCloud();
    core.showToast(`Sede “${name}” agregada.`);
    window.ChuteV59?.openLiveMatch?.(pair);
  } catch (error) {
    console.error(error);
    core.setState(previous);
    core.showToast('No se pudo guardar la nueva sede.');
  }
}

function decorateMatchCenter() {
  const live = document.querySelector('[data-cm-v59-live-pair]');
  if (!live) { decoratePlayerProfile(); decorateStatsPage(); return; }
  const context = matchContext(live.dataset.cmV59LivePair);
  if (!context) return;
  ensureLineups(context.match, context.home, context.away, core.getState());
  live.classList.add('cm-v516-match-center');
  live.querySelector('.cm-v514-unified-badge')?.replaceChildren('Minuto por evento · alineaciones · goles · amonestaciones · cambios · penales');
  decorateMeta(live, context);
  decorateForms(live, context);
  decorateShootout(live, context);
  renderTimeline(live, context);
  const undo = live.querySelector('[data-cm-v59-undo], [data-cm-v516-undo]');
  if (undo) {
    undo.removeAttribute('data-cm-v59-undo');
    undo.dataset.cmV516Undo = '';
    undo.title = 'Corregir el último gol, amonestación, cambio o penal de tanda';
  }
  decoratePlayerProfile();
  decorateStatsPage();
}

function scheduleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => { refreshQueued = false; decorateMatchCenter(); });
}
async function ensureSchema() {
  const current = core.getState();
  const currentVenues = venues(current);
  if (current.config?.matchCenterSchema === SCHEMA && JSON.stringify(current.config?.venues || []) === JSON.stringify(currentVenues)) return;
  const next = clone(current);
  next.config = { ...(next.config || {}), venues: currentVenues, matchCenterSchema: SCHEMA };
  core.setState(next);
  core.persistLocal?.();
  if (core.canEdit()) {
    try { await core.saveCloud(); }
    catch (error) { console.warn('No se pudo guardar la configuración v5.16.', error); }
  }
}

function installStyles() {
  if (document.getElementById('cmV516Styles')) return;
  const link = document.createElement('link');
  link.id = 'cmV516Styles';
  link.rel = 'stylesheet';
  link.href = `/styles/event-stats.css?v=${VERSION}`;
  document.head.appendChild(link);
}

async function undoLatestEvent(pair) {
  const context = matchContext(pair);
  const latest = context ? unifiedEvents(context).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0] : null;
  if (!latest) return core.showToast('No hay eventos para corregir.');
  if (latest.kind === 'shootout_penalty') return undoShootoutPenalty(pair);
  if (latest.kind === 'substitution') return window.ChuteV515MatchCenter?.undoSubstitution?.(pair);
  if (!['goal', 'card'].includes(latest.kind)) return core.showToast('Ese evento no puede corregirse automáticamente.');
  await persist(pair, (nextContext) => {
    if (latest.kind === 'goal') {
      nextContext.match.goals = (nextContext.match.goals || []).filter((item) => item.id !== latest.id);
      const scoreKey = latest.side === 'away' ? 'awayGoals' : 'homeGoals';
      nextContext.match[scoreKey] = Math.max(0, Number(nextContext.match[scoreKey] || 0) - 1);
    } else {
      nextContext.match.cards = (nextContext.match.cards || []).filter((item) => item.id !== latest.id);
    }
  }, 'Último evento corregido.');
}

window.addEventListener('click', (event) => {
  const live = event.target.closest?.('[data-cm-v59-live-pair]');
  if (!live) return;
  const pair = live.dataset.cmV59LivePair;
  const lifecycle = event.target.closest?.('[data-cm-v59-save-live], [data-cm-v59-finish]');
  if (lifecycle) {
    const context = matchContext(pair);
    if (context) context.match.participationTracked = true;
  }
  const goal = event.target.closest?.('[data-cm-v516-add-goal]');
  if (goal) { event.preventDefault(); event.stopImmediatePropagation(); void addGoal(pair, goal.dataset.cmV516AddGoal); return; }
  const card = event.target.closest?.('[data-cm-v516-add-card]');
  if (card) { event.preventDefault(); event.stopImmediatePropagation(); void addCard(pair, card.dataset.cmV516AddCard); return; }
  const substitution = event.target.closest?.('[data-cm-v516-substitute]');
  if (substitution) { event.preventDefault(); event.stopImmediatePropagation(); void addSubstitution(pair, substitution.dataset.cmV516Substitute); return; }
  if (event.target.closest?.('[data-cm-v516-start-shootout]')) { event.preventDefault(); event.stopImmediatePropagation(); void startShootout(pair); return; }
  const penalty = event.target.closest?.('[data-cm-v516-add-penalty]');
  if (penalty) { event.preventDefault(); event.stopImmediatePropagation(); void addShootoutPenalty(pair, penalty.dataset.cmV516AddPenalty); return; }
  if (event.target.closest?.('[data-cm-v516-add-venue]')) { event.preventDefault(); event.stopImmediatePropagation(); void addVenue(pair); return; }
  const undo = event.target.closest?.('[data-cm-v516-undo]');
  if (undo && !undo.disabled) { event.preventDefault(); event.stopImmediatePropagation(); void undoLatestEvent(pair); }
}, true);

document.addEventListener('change', (event) => {
  const goalMinute = event.target.closest?.('[data-cm-v516-goal-minute]');
  if (goalMinute) updatePlayerSelects(goalMinute.dataset.cmV516GoalMinute, 'goal');
  const cardMinute = event.target.closest?.('[data-cm-v516-card-minute]');
  if (cardMinute) updatePlayerSelects(cardMinute.dataset.cmV516CardMinute, 'card');
  const subMinute = event.target.closest?.('[data-cm-v516-sub-minute]');
  if (subMinute) renderSideForMinute(subMinute.dataset.cmV516SubMinute);
}, true);

window.addEventListener('click', (event) => {
  const player = event.target.closest?.('[data-cm-v59-player]');
  if (player) lastPlayerKey = player.dataset.cmV59Player || '';
}, true);

const originalOpenPlayerProfile = window.ChuteV59?.openPlayerProfile?.bind(window.ChuteV59);
if (originalOpenPlayerProfile) window.ChuteV59.openPlayerProfile = (key) => { lastPlayerKey = key; const result = originalOpenPlayerProfile(key); scheduleRefresh(); return result; };

const observer = new MutationObserver(scheduleRefresh);
observer.observe(document.body, { childList: true, subtree: true });

installStyles();
await ensureSchema();if ('serviceWorker' in navigator) navigator.serviceWorker.register(`/sw.js?v=${VERSION}`).catch((error) => console.warn('No se pudo actualizar la PWA v5.16.1.', error));
document.title = 'Chute Mundo v5.16.1 · Eventos y estadísticas';
const heroVersion = document.querySelector('.hero .eyebrow');
if (heroVersion) heroVersion.textContent = 'CHUTE MUNDO v5.16.1';
scheduleRefresh();

window.ChuteV516EventsStats = {
  version: VERSION,
  venues,
  currentLineup,
  groupedPlayerOptions,
  playerStats,
  allPlayerStats,
  unifiedEvents,
  addGoal,
  addCard,
  addSubstitution,
  startShootout,
  addShootoutPenalty,
  syncPenaltyScore
};
