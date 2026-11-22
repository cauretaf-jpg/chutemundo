function waitForCore() {
  if (window.ChuteMundoCore) return Promise.resolve(window.ChuteMundoCore);
  return new Promise((resolve) => document.addEventListener('chute:ready', (event) => resolve(event.detail), { once: true }));
}

const core = await waitForCore();
const model = window.ChuteDetailModel;
if (!model) throw new Error('El modelo detallado no está disponible para Chute Mundo v5.9.');

const { esc, logo, photo, playerName, playerPosition, ensureMatchEvents, syncLegacyLogs } = model;
const VERSION = '5.9.0';
const OFFICIAL_MINUTES = ['0', '10', '20', '30', '45', '50', '60', '70', '80', '90', '105', '120', 'Penales'];
const profileState = { mode: 'players', query: '', expanded: false };
let refreshQueued = false;
let busy = false;
let profilesSignature = '';

const clone = (value) => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const state = () => core.getState();
const tournaments = () => state().tournaments || [];
const teams = () => state().teams || [];
const played = (match) => core.matchPlayed(match);
const norm = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const playerKey = (teamId, name) => `${teamId}__${encodeURIComponent(name)}`;
const parsePlayerKey = (value = '') => {
  const separator = value.indexOf('__');
  return separator < 0 ? { teamId: '', name: '' } : { teamId: value.slice(0, separator), name: decodeURIComponent(value.slice(separator + 2)) };
};

function installStyles() {
  if (document.getElementById('cmV59Styles')) return;
  const link = document.createElement('link');
  link.id = 'cmV59Styles';
  link.rel = 'stylesheet';
  link.href = `/styles/match-center.css?v=${VERSION}`;
  document.head.appendChild(link);
}

function addActivity(targetState, text) {
  targetState.activity = Array.isArray(targetState.activity) ? targetState.activity : [];
  targetState.activity.unshift({ id: core.uid('activity'), text, at: Date.now() });
  targetState.activity = targetState.activity.slice(0, 50);
}

function context(pair, sourceState = state()) {
  const [tournamentId, matchId] = String(pair || '').split('__');
  const tournament = (sourceState.tournaments || []).find((item) => item.id === tournamentId);
  const match = tournament?.matches?.find((item) => item.id === matchId);
  if (!tournament || !match) return null;
  const home = match.home || core.resolveHome(tournament, match);
  const away = match.away || core.resolveAway(tournament, match);
  if (!home || !away) return null;
  ensureMatchEvents(match, home, away);
  return { tournament, match, home, away, pair: `${tournamentId}__${matchId}` };
}

function winnerId(tournament, match) {
  if (!played(match)) return null;
  const home = match.home || core.resolveHome(tournament, match);
  const away = match.away || core.resolveAway(tournament, match);
  const hg = Number(match.homeGoals);
  const ag = Number(match.awayGoals);
  if (hg > ag) return home;
  if (ag > hg) return away;
  if (match.homePens !== null && match.homePens !== undefined && match.awayPens !== null && match.awayPens !== undefined) {
    if (Number(match.homePens) > Number(match.awayPens)) return home;
    if (Number(match.awayPens) > Number(match.homePens)) return away;
  }
  return null;
}

function roster(teamId) {
  return core.teamById(teamId)?.players || [];
}

function playerOptions(teamId, selected = '', allowEmpty = false) {
  const empty = allowEmpty ? '<option value="">Sin asistencia</option>' : '<option value="">Selecciona</option>';
  return empty + roster(teamId).map((player) => {
    const name = playerName(player);
    return `<option value="${esc(name)}" ${name === selected ? 'selected' : ''}>${esc(name)}</option>`;
  }).join('');
}

function currentDate() {
  return new Date().toLocaleDateString('en-CA');
}

function currentTime() {
  return new Date().toTimeString().slice(0, 5);
}

function minuteLabel(value) {
  return value === 'Penales' ? 'Penales' : `${value}′`;
}

function eventMinuteOrder(value) {
  const minute = String(value || '');
  if (minute === 'Penales') return 999;
  return Number.parseInt(minute, 10) || 0;
}

function liveTimeline(ctx) {
  const events = [
    ...(ctx.match.goals || []).map((item, index) => ({ ...item, kind: 'goal', sort: eventMinuteOrder(item.minute), index })),
    ...(ctx.match.cards || []).map((item, index) => ({ ...item, kind: 'card', sort: eventMinuteOrder(item.minute), index }))
  ].sort((a, b) => a.sort - b.sort || Number(a.createdAt || 0) - Number(b.createdAt || 0));
  if (!events.length) return '<div class="cm-v59-live-empty">Todavía no hay eventos registrados.</div>';
  return events.map((item) => {
    const teamId = item.teamId || (item.side === 'away' ? ctx.away : ctx.home);
    const icon = item.kind === 'goal' ? '⚽' : item.type === 'red' ? '🟥' : '🟨';
    const extra = item.kind === 'goal' && item.assistName ? ` · Asistencia: ${esc(item.assistName)}` : item.reason === 'double_yellow' ? ' · Doble amarilla' : '';
    return `<div class="cm-v59-live-event"><span class="cm-v59-live-minute">${esc(minuteLabel(item.minute || '0'))}</span>${photo(teamId, item.playerName, 'cm-v59-event-face')}<div><strong>${icon} ${esc(item.playerName)}</strong><small>${esc(core.teamName(teamId))}${extra}</small></div></div>`;
  }).join('');
}

function liveSide(ctx, side) {
  const teamId = side === 'home' ? ctx.home : ctx.away;
  const team = core.teamById(teamId);
  return `<section class="cm-v59-live-side" data-side="${side}">
    <header>${logo(teamId, 'cm-v59-live-logo')}<div><span>${side === 'home' ? 'LOCAL' : 'VISITA'}</span><h3>${esc(team?.name || 'Equipo')}</h3></div></header>
    <div class="cm-v59-live-event-form">
      <p>Registrar gol</p>
      <label>Goleador<select id="cmV59Scorer-${side}">${playerOptions(teamId)}</select></label>
      <label>Asistencia<select id="cmV59Assist-${side}">${playerOptions(teamId, '', true)}</select></label>
      <button type="button" class="cm-v59-goal-button" data-cm-v59-add-goal="${side}">⚽ Agregar gol</button>
    </div>
    <div class="cm-v59-live-event-form compact">
      <p>Registrar tarjeta</p>
      <label>Jugador<select id="cmV59CardPlayer-${side}">${playerOptions(teamId)}</select></label>
      <label>Tipo<select id="cmV59CardType-${side}"><option value="yellow">🟨 Amarilla</option><option value="red">🟥 Roja directa</option></select></label>
      <button type="button" class="cm-v59-card-button" data-cm-v59-add-card="${side}">Agregar tarjeta</button>
    </div>
  </section>`;
}

function liveEventTimestamp(item) {
  const part = String(item?.id || '').split('_')[1] || '';
  return Number.parseInt(part, 36) || 0;
}

function lastUndoableEvent(ctx) {
  return [...(ctx.match.goals || []), ...(ctx.match.cards || [])]
    .filter((item) => /^(livegoal|livecard)_/.test(String(item.id || '')))
    .sort((a, b) => liveEventTimestamp(b) - liveEventTimestamp(a))[0] || null;
}

function renderLiveModal(pair) {
  const ctx = context(pair);
  if (!ctx) return core.showToast('El partido todavía depende de otra fase o ya no existe.');
  if (!core.canEdit()) return core.showToast('Inicia sesión como administrador para usar el modo partido.');
  const goalHome = (ctx.match.goals || []).filter((goal) => goal.side === 'home').length;
  const goalAway = (ctx.match.goals || []).filter((goal) => goal.side === 'away').length;
  const homeScore = ctx.match.homeGoals ?? goalHome;
  const awayScore = ctx.match.awayGoals ?? goalAway;
  const knockout = ctx.match.stage === 'knockout';
  const undoable = lastUndoableEvent(ctx);
  core.openModal(`<div class="cm-v59-live" data-cm-v59-live-pair="${esc(pair)}">    <div class="cm-v59-live-heading"><div><p class="eyebrow">CENTRO DE PARTIDO</p><h2>${esc(ctx.tournament.name)}</h2><p>${esc(ctx.match.round || '')} · ${esc(ctx.match.label || '')}</p></div><span>${ctx.match.liveStatus === 'final' || played(ctx.match) ? 'Partido registrado' : 'Modo en vivo'}</span></div>
    <div class="cm-v59-scoreboard">
      <div>${logo(ctx.home, 'cm-v59-score-logo')}<strong>${esc(core.teamName(ctx.home))}</strong><div class="cm-v59-score-control"><button type="button" data-cm-v59-score="home:-1">−</button><b>${Number(homeScore)}</b><button type="button" data-cm-v59-score="home:1">+</button></div></div>
      <em>VS</em>
      <div>${logo(ctx.away, 'cm-v59-score-logo')}<strong>${esc(core.teamName(ctx.away))}</strong><div class="cm-v59-score-control"><button type="button" data-cm-v59-score="away:-1">−</button><b>${Number(awayScore)}</b><button type="button" data-cm-v59-score="away:1">+</button></div></div>
    </div>
    <div class="cm-v59-live-meta">
      <label>Minuto oficial<select id="cmV59Minute">${OFFICIAL_MINUTES.map((minute) => `<option value="${minute}">${minuteLabel(minute)}</option>`).join('')}</select></label>
      <label>Fecha<input id="cmV59Date" type="date" value="${esc(ctx.match.date || currentDate())}"></label>
      <label>Hora<input id="cmV59Time" type="time" value="${esc(ctx.match.time || currentTime())}"></label>
      <label>Sede<input id="cmV59Venue" value="${esc(ctx.match.venue || '')}" placeholder="Cancha o sede"></label>
      ${knockout ? `<label>Penales local<input id="cmV59HomePens" type="number" min="0" value="${ctx.match.homePens ?? ''}"></label><label>Penales visita<input id="cmV59AwayPens" type="number" min="0" value="${ctx.match.awayPens ?? ''}"></label>` : ''}
    </div>
    <div class="cm-v59-live-sides">${liveSide(ctx, 'home')}${liveSide(ctx, 'away')}</div>
    <section class="cm-v59-live-timeline"><header><div><p class="eyebrow">CRONOLOGÍA</p><h3>Eventos del partido</h3></div><span>${(ctx.match.goals?.length || 0) + (ctx.match.cards?.length || 0)} eventos</span></header>${liveTimeline(ctx)}</section>
    <div class="cm-v59-live-actions">
      <button type="button" class="secondary" data-cm-v59-save-live>Guardar datos</button>
      <button type="button" class="secondary" data-cm-v59-undo ${undoable ? '' : 'disabled'}>Corregir último evento</button>
      <button type="button" class="cm-v59-finish" data-cm-v59-finish>Finalizar partido</button>
    </div>
  </div>`);
}

function readLiveFields(targetMatch) {
  const date = document.getElementById('cmV59Date');
  const time = document.getElementById('cmV59Time');
  const venue = document.getElementById('cmV59Venue');
  if (date) targetMatch.date = date.value;
  if (time) targetMatch.time = time.value;
  if (venue) targetMatch.venue = venue.value.trim();
  const homePens = document.getElementById('cmV59HomePens');
  const awayPens = document.getElementById('cmV59AwayPens');
  if (homePens) targetMatch.homePens = homePens.value === '' ? null : Number(homePens.value);
  if (awayPens) targetMatch.awayPens = awayPens.value === '' ? null : Number(awayPens.value);
}

async function persistLive(pair, mutate, successText, { reopen = true } = {}) {
  if (busy) return false;
  const previous = clone(state());
  const next = clone(previous);
  const ctx = context(pair, next);
  if (!ctx) return core.showToast('El partido ya no está disponible.');
  busy = true;
  try {
    readLiveFields(ctx.match);
    mutate(ctx, next);
    syncLegacyLogs(ctx.match);
    ctx.match.updatedAt = Date.now();
    addActivity(next, successText);
    core.setState(next);
    await core.saveCloud();
    core.showToast(`${successText} Sincronizado con Firebase.`);
    if (reopen) renderLiveModal(pair);
    window.ChuteTournamentHub?.refresh?.();
    scheduleRefresh();
    return true;
  } catch (error) {
    console.error(error);
    core.setState(previous);
    core.showToast(`Firebase rechazó el cambio: ${error.code || error.message || 'error desconocido'}.`);
    if (reopen) renderLiveModal(pair);
    return false;
  } finally {
    busy = false;
  }
}

function syncScoreFromGoalEvents(match) {
  if (match.scoreMode !== 'events') return;
  match.homeGoals = (match.goals || []).filter(goal => goal.side === 'home').length;
  match.awayGoals = (match.goals || []).filter(goal => goal.side === 'away').length;
}

async function adjustScore(pair, side, delta) {
  await persistLive(pair, ({ match }) => {
    const key = side === 'away' ? 'awayGoals' : 'homeGoals';
    match[key] = Math.max(0, Number(match[key] ?? 0) + Number(delta));
    match.liveStatus = 'active';
  }, 'Marcador actualizado.');
}

async function addGoal(pair, side) {
  const scorer = document.getElementById(`cmV59Scorer-${side}`)?.value || '';
  const assist = document.getElementById(`cmV59Assist-${side}`)?.value || '';
  const minute = document.getElementById('cmV59Minute')?.value || '0';
  if (!scorer) return core.showToast('Selecciona al goleador.');
  if (assist && assist === scorer) return core.showToast('El goleador y el asistidor deben ser distintos.');
  await persistLive(pair, (ctx) => {
    const teamId = side === 'away' ? ctx.away : ctx.home;
    const scoreKey = side === 'away' ? 'awayGoals' : 'homeGoals';
    ctx.match.goals.push({ id: core.uid('livegoal'), side, teamId, playerName: scorer, assistName: assist, minute, createdAt: Date.now() });
    ctx.match[scoreKey] = Number(ctx.match[scoreKey] ?? 0) + 1;
    ctx.match.liveStatus = 'active';
  }, `Gol de ${scorer} registrado.`);
}

async function addCard(pair, side) {
  const player = document.getElementById(`cmV59CardPlayer-${side}`)?.value || '';
  const requested = document.getElementById(`cmV59CardType-${side}`)?.value || 'yellow';
  const minute = document.getElementById('cmV59Minute')?.value || '0';
  if (!player) return core.showToast('Selecciona al jugador sancionado.');
  await persistLive(pair, (ctx) => {
    const teamId = side === 'away' ? ctx.away : ctx.home;
    const priorYellow = requested === 'yellow' && ctx.match.cards.some((card) => card.side === side && card.playerName === player && card.type === 'yellow');
    ctx.match.cards.push({
      id: core.uid('livecard'), side, teamId, playerName: player, role: 'player',
      type: priorYellow || requested === 'red' ? 'red' : 'yellow', minute, createdAt: Date.now(),
      reason: priorYellow ? 'double_yellow' : '', secondYellow: priorYellow
    });
    ctx.match.liveStatus = 'active';
  }, requested === 'red' ? `Tarjeta roja para ${player}.` : `Tarjeta para ${player} registrada.`);
}

async function undoLast(pair) {
  await persistLive(pair, (ctx) => {
    const latest = lastUndoableEvent(ctx);
    if (!latest) throw new Error('No hay eventos recientes del modo en vivo para corregir.');
    if ((ctx.match.goals || []).some((item) => item.id === latest.id)) {
      ctx.match.goals = ctx.match.goals.filter((item) => item.id !== latest.id);
      const key = latest.side === 'away' ? 'awayGoals' : 'homeGoals';
      ctx.match[key] = Math.max(0, Number(ctx.match[key] || 0) - 1);
    } else ctx.match.cards = ctx.match.cards.filter((item) => item.id !== latest.id);
  }, 'Último evento corregido.');
}

function syncPodium(ctx) {
  const round = norm(ctx.match.round);
  const winner = winnerId(ctx.tournament, ctx.match);
  if (!winner) return;
  const loser = winner === ctx.home ? ctx.away : ctx.home;
  if (round === 'final') {
    ctx.tournament.champion = winner;
    ctx.tournament.runnerUp = loser;
    ctx.tournament.status = 'historical';
  }
  if (round.includes('3er') || round.includes('tercer')) ctx.tournament.third = winner;
}

async function finishMatch(pair) {
  const live = document.querySelector('[data-cm-v59-live-pair]');
  if (!live) return;
  const local = Number(live.querySelector('.cm-v59-scoreboard > div:first-child b')?.textContent || 0);
  const visit = Number(live.querySelector('.cm-v59-scoreboard > div:last-child b')?.textContent || 0);
  const homePensValue = document.getElementById('cmV59HomePens')?.value;
  const awayPensValue = document.getElementById('cmV59AwayPens')?.value;
  const ctx = context(pair);
  if (ctx?.match.stage === 'knockout' && local === visit) {    const hp = homePensValue === '' || homePensValue === undefined ? null : Number(homePensValue);
    const ap = awayPensValue === '' || awayPensValue === undefined ? null : Number(awayPensValue);
    if (hp === null || ap === null || hp === ap) return core.showToast('El empate de eliminación debe definirse por penales.');
  }
  await persistLive(pair, (nextCtx) => {
    nextCtx.match.homeGoals = local;
    nextCtx.match.awayGoals = visit;
    nextCtx.match.liveStatus = 'final';
    nextCtx.match.completedAt = Date.now();
    syncPodium(nextCtx);
  }, 'Partido finalizado.', { reopen: false });
  core.closeModal();
}

async function saveLiveData(pair) {
  await persistLive(pair, ({ match }) => { match.liveStatus ||= 'active'; }, 'Datos del partido guardados.');
}

function allMatchRows() {
  return tournaments().flatMap((tournament) => (tournament.matches || []).filter((match) => match.stage !== 'bye').map((match) => {
    const home = match.home || core.resolveHome(tournament, match);
    const away = match.away || core.resolveAway(tournament, match);
    ensureMatchEvents(match, home, away);
    return { tournament, match, home, away };
  })).filter((row) => row.home && row.away);
}

function playerTournamentStats(teamId, name, tournament) {
  const structured = { goals: 0, assists: 0, yellows: 0, reds: 0 };
  for (const match of tournament.matches || []) {
    const home = match.home || core.resolveHome(tournament, match);
    const away = match.away || core.resolveAway(tournament, match);
    ensureMatchEvents(match, home, away);
    for (const goal of match.goals || []) {
      if ((goal.teamId || (goal.side === 'away' ? away : home)) !== teamId) continue;
      if (goal.playerName === name) structured.goals += 1;
      if (goal.assistName === name) structured.assists += 1;
    }
    for (const card of match.cards || []) {
      if ((card.teamId || (card.side === 'away' ? away : home)) !== teamId || card.playerName !== name) continue;
      if (card.type === 'red') structured.reds += 1; else structured.yellows += 1;
    }
  }
  const manualGoals = (tournament.playerScorers || []).find((row) => row[0] === name && row[1] === teamId)?.[3] || 0;
  const manualAssists = (tournament.playerAssists || []).find((row) => row[0] === name && row[1] === teamId)?.[3] || 0;
  return { ...structured, goals: Math.max(structured.goals, Number(manualGoals)), assists: Math.max(structured.assists, Number(manualAssists)) };
}

function winningGoalIds(row) {
  const winner = winnerId(row.tournament, row.match);
  if (!winner) return new Set();
  const winnerSide = winner === row.home ? 'home' : 'away';
  const loserGoals = winnerSide === 'home' ? Number(row.match.awayGoals) : Number(row.match.homeGoals);
  const ordered = (row.match.goals || []).filter((goal) => goal.side === winnerSide).sort((a, b) => eventMinuteOrder(a.minute) - eventMinuteOrder(b.minute) || Number(a.createdAt || 0) - Number(b.createdAt || 0));
  return new Set(ordered[loserGoals]?.id ? [ordered[loserGoals].id] : []);
}

function playerProfileData(teamId, name) {
  const base = model.playerStatistics(core).find((row) => row.teamId === teamId && row.name === name) || { goals: 0, assists: 0, yellows: 0, reds: 0, appearances: 0, contributions: 0 };
  const team = core.teamById(teamId);
  const rosterEntry = roster(teamId).find((item) => playerName(item) === name);
  let lateGoals = 0; let winningGoals = 0; let finalGoals = 0; let playoffGoals = 0;
  const recent = [];
  for (const row of allMatchRows()) {
    const winningIds = winningGoalIds(row);
    for (const goal of row.match.goals || []) {
      const goalTeam = goal.teamId || (goal.side === 'away' ? row.away : row.home);
      if (goalTeam !== teamId || goal.playerName !== name) continue;
      const minute = eventMinuteOrder(goal.minute);
      if (minute >= 80) lateGoals += 1;
      if (winningIds.has(goal.id)) winningGoals += 1;
      const round = norm(row.match.round);
      if (round === 'final') finalGoals += 1;
      if (round.includes('play-off') || round.includes('playoff') || round.includes('semifinal') || round.includes('cuarto')) playoffGoals += 1;
      recent.push({ kind: 'goal', tournament: row.tournament.name, opponent: core.teamName(goal.side === 'away' ? row.home : row.away), minute: goal.minute });
    }
    for (const goal of row.match.goals || []) {
      const goalTeam = goal.teamId || (goal.side === 'away' ? row.away : row.home);
      if (goalTeam === teamId && goal.assistName === name) recent.push({ kind: 'assist', tournament: row.tournament.name, opponent: core.teamName(goal.side === 'away' ? row.home : row.away), minute: goal.minute });
    }
  }
  const tournamentRows = tournaments().map((tournament) => ({ tournament, ...playerTournamentStats(teamId, name, tournament) })).filter((row) => row.goals || row.assists || row.yellows || row.reds);
  const best = [...tournamentRows].sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists) || b.goals - a.goals)[0] || null;
  return {
    team, name, position: playerPosition(rosterEntry) || 'Jugador',
    ...base, lateGoals, winningGoals, finalGoals, playoffGoals,
    tournamentRows, best, recent: recent.slice(-6).reverse()
  };
}

function teamProfileData(teamId) {
  const team = core.teamById(teamId);
  const stats = { pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, titles: 0, runners: 0, thirds: 0 };
  const form = [];
  const h2h = new Map();
  let biggest = null;
  for (const tournament of tournaments()) {
    if (tournament.champion === teamId) stats.titles += 1;
    if (tournament.runnerUp === teamId) stats.runners += 1;
    if (tournament.third === teamId) stats.thirds += 1;
  }
  for (const row of allMatchRows()) {
    if (!played(row.match) || ![row.home, row.away].includes(teamId)) continue;
    const isHome = row.home === teamId;
    const opponentId = isHome ? row.away : row.home;
    const gf = isHome ? Number(row.match.homeGoals) : Number(row.match.awayGoals);
    const gc = isHome ? Number(row.match.awayGoals) : Number(row.match.homeGoals);
    const winner = winnerId(row.tournament, row.match);
    const result = winner === teamId ? 'G' : winner === opponentId ? 'P' : 'E';
    stats.pj += 1; stats.gf += gf; stats.gc += gc;
    if (result === 'G') stats.pg += 1; else if (result === 'P') stats.pp += 1; else stats.pe += 1;
    form.push({ result, opponentId, score: `${gf}-${gc}`, tournament: row.tournament.name });
    const rival = h2h.get(opponentId) || { opponentId, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0 };
    rival.pj += 1; rival.gf += gf; rival.gc += gc;
    if (result === 'G') rival.pg += 1; else if (result === 'P') rival.pp += 1; else rival.pe += 1;
    h2h.set(opponentId, rival);
    if (result === 'G' && (!biggest || gf - gc > biggest.margin)) biggest = { margin: gf - gc, gf, gc, opponentId, tournament: row.tournament.name };
  }
  const players = model.playerStatistics(core).filter((row) => row.teamId === teamId).sort((a, b) => b.contributions - a.contributions || b.goals - a.goals);
  return { team, ...stats, dg: stats.gf - stats.gc, form: form.slice(-5).reverse(), h2h: [...h2h.values()].sort((a, b) => b.pj - a.pj), biggest, leader: players[0] || null, roster: roster(teamId) };
}

function metric(value, label) {
  return `<article><b>${esc(value)}</b><span>${esc(label)}</span></article>`;
}

function openPlayerProfile(key) {
  const { teamId, name } = parsePlayerKey(key);
  const data = playerProfileData(teamId, name);
  if (!data.team || !name) return core.showToast('No se encontró el perfil del jugador.');
  const tournamentRows = data.tournamentRows.length ? data.tournamentRows.sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists)).map((row) => `<tr><td>${esc(row.tournament.name)}</td><td>${row.goals}</td><td>${row.assists}</td><td>${row.goals + row.assists}</td><td>${row.yellows}</td><td>${row.reds}</td></tr>`).join('') : '<tr><td colspan="6">Sin eventos por torneo.</td></tr>';
  const recent = data.recent.length ? data.recent.map((item) => `<div class="cm-v59-profile-event"><b>${item.kind === 'goal' ? '⚽ Gol' : '◉ Asistencia'} ${minuteLabel(item.minute || '0')}</b><span>${esc(item.tournament)} · vs. ${esc(item.opponent)}</span></div>`).join('') : '<p class="empty">Sin contribuciones detalladas recientes.</p>';
  core.openModal(`<div class="cm-v59-profile-modal"><header class="cm-v59-profile-hero">${photo(teamId, name, 'cm-v59-profile-photo')}<div><p class="eyebrow">PERFIL HISTÓRICO</p><h2>${esc(name)}</h2><span>${esc(data.position)} · ${esc(data.team.name)}</span><small>${data.best ? `Mejor torneo: ${esc(data.best.tournament.name)} (${data.best.goals + data.best.assists} G+A)` : 'Sin torneo destacado todavía'}</small></div>${logo(teamId, 'cm-v59-profile-club')}</header><div class="cm-v59-profile-metrics">${metric(data.goals, 'Goles')}${metric(data.assists, 'Asistencias')}${metric(data.goals + data.assists, 'G+A')}${metric(data.appearances || '—', 'PJ registrados')}${metric(data.winningGoals, 'Goles decisivos')}${metric(data.lateGoals, 'Goles 80′+')}${metric(data.finalGoals, 'Goles en finales')}${metric(`${data.yellows}/${data.reds}`, 'Amarillas / rojas')}</div><div class="cm-v59-profile-columns"><section><p class="eyebrow">COMPETENCIAS</p><h3>Rendimiento por torneo</h3><div class="cm-v59-table-wrap"><table><thead><tr><th>Torneo</th><th>G</th><th>A</th><th>G+A</th><th>TA</th><th>TR</th></tr></thead><tbody>${tournamentRows}</tbody></table></div></section><section><p class="eyebrow">MOMENTOS</p><h3>Contribuciones recientes</h3><div class="cm-v59-profile-events">${recent}</div></section></div></div>`);
}

function openTeamProfile(teamId) {
  const data = teamProfileData(teamId);
  if (!data.team) return core.showToast('No se encontró el equipo.');
  const form = data.form.length ? data.form.map((item) => `<span class="is-${item.result.toLowerCase()}" title="${esc(item.tournament)} · ${esc(core.teamName(item.opponentId))} ${esc(item.score)}">${item.result}</span>`).join('') : '<small>Sin partidos</small>';
  const h2h = data.h2h.length ? data.h2h.map((row) => `<tr><td>${esc(core.teamName(row.opponentId))}</td><td>${row.pj}</td><td>${row.pg}</td><td>${row.pe}</td><td>${row.pp}</td><td>${row.gf}-${row.gc}</td></tr>`).join('') : '<tr><td colspan="6">Sin enfrentamientos.</td></tr>';
  const rosterRows = data.roster.map((item) => `<button type="button" data-cm-v59-player="${esc(playerKey(teamId, playerName(item)))}">${photo(teamId, playerName(item), 'cm-v59-roster-face')}<span><b>${esc(playerName(item))}</b><small>${esc(playerPosition(item) || 'Jugador')}</small></span></button>`).join('');
  core.openModal(`<div class="cm-v59-profile-modal"><header class="cm-v59-team-hero">${logo(teamId, 'cm-v59-team-logo')}<div><p class="eyebrow">PERFIL DEL CLUB</p><h2>${esc(data.team.name)}</h2><span>DT: ${esc(data.team.coach || 'Sin registrar')} · ${data.roster.length} jugadores</span><div class="cm-v59-form">${form}</div></div></header><div class="cm-v59-profile-metrics">${metric(data.pj, 'Partidos')}${metric(data.pg, 'Victorias')}${metric(data.pe, 'Empates')}${metric(data.pp, 'Derrotas')}${metric(`${data.gf}-${data.gc}`, 'Goles')}${metric(data.dg > 0 ? `+${data.dg}` : data.dg, 'Diferencia')}${metric(data.titles, 'Títulos')}${metric(data.leader?.name || '—', 'Líder G+A')}</div><div class="cm-v59-profile-columns"><section><p class="eyebrow">RIVALIDADES</p><h3>Rendimiento por rival</h3><div class="cm-v59-table-wrap"><table><thead><tr><th>Rival</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF-GC</th></tr></thead><tbody>${h2h}</tbody></table></div>${data.biggest ? `<p class="cm-v59-highlight"><b>Mayor victoria:</b> ${data.biggest.gf}-${data.biggest.gc} vs. ${esc(core.teamName(data.biggest.opponentId))} · ${esc(data.biggest.tournament)}</p>` : ''}</section><section><p class="eyebrow">PLANTEL</p><h3>Jugadores del club</h3><div class="cm-v59-roster-list">${rosterRows}</div></section></div></div>`);
}

function allPlayers() {
  return teams().flatMap((team) => roster(team.id).map((item) => ({ teamId: team.id, team, name: playerName(item), position: playerPosition(item) || 'Jugador' })));
}

function playerCard(item, statsMap) {
  const stats = statsMap.get(`${item.teamId}__${item.name}`) || { goals: 0, assists: 0, yellows: 0, reds: 0 };
  return `<button type="button" class="cm-v59-player-card" data-cm-v59-player="${esc(playerKey(item.teamId, item.name))}">${photo(item.teamId, item.name, 'cm-v59-player-card-photo')}<span><b>${esc(item.name)}</b><small>${esc(item.position)} · ${esc(item.team.name)}</small><em>${stats.goals} G · ${stats.assists} A · ${stats.yellows + stats.reds} tarjetas</em></span></button>`;
}

function teamCard(team) {
  const data = teamProfileData(team.id);
  return `<button type="button" class="cm-v59-team-card" data-cm-v59-team="${esc(team.id)}">${logo(team.id, 'cm-v59-team-card-logo')}<span><b>${esc(team.name)}</b><small>${esc(team.coach || 'Sin DT')} · ${data.roster.length} jugadores</small><em>${data.pj} PJ · ${data.titles} títulos · DG ${data.dg > 0 ? '+' : ''}${data.dg}</em></span></button>`;
}

function profilesMarkup() {
  const query = norm(profileState.query);
  const statsMap = new Map(model.playerStatistics(core).map((row) => [`${row.teamId}__${row.name}`, row]));
  const players = allPlayers().filter((item) => !query || norm(`${item.name} ${item.position} ${item.team.name}`).includes(query));
  const teamRows = teams().filter((team) => !query || norm(`${team.name} ${team.coach || ''}`).includes(query));
  const visiblePlayers = profileState.expanded || query ? players : players.slice(0, 18);
  const content = profileState.mode === 'players'
    ? `<div class="cm-v59-profile-grid players">${visiblePlayers.map((item) => playerCard(item, statsMap)).join('') || '<p class="empty">No se encontraron jugadores.</p>'}</div>${!profileState.expanded && !query && players.length > visiblePlayers.length ? `<button type="button" class="cm-v59-show-all" data-cm-v59-show-all>Mostrar los ${players.length} jugadores</button>` : ''}`
    : `<div class="cm-v59-profile-grid teams">${teamRows.map(teamCard).join('') || '<p class="empty">No se encontraron equipos.</p>'}</div>`;
  return `<section id="cmV59ProfilesRoot" class="cm-v59-profiles"><header><div><p class="eyebrow">IDENTIDAD E HISTORIA</p><h2>Perfiles de Chute Mundo</h2><p>Consulta el rendimiento de cada jugador y club a partir de los registros oficiales.</p></div><div class="cm-v59-profile-counts"><span>${teams().length} clubes</span><span>${allPlayers().length} jugadores</span></div></header><div class="cm-v59-profile-tools"><div class="cm-v59-profile-tabs"><button type="button" class="${profileState.mode === 'players' ? 'active' : ''}" data-cm-v59-profile-mode="players">Jugadores</button><button type="button" class="${profileState.mode === 'teams' ? 'active' : ''}" data-cm-v59-profile-mode="teams">Equipos</button></div><label>Buscar<input id="cmV59ProfileSearch" value="${esc(profileState.query)}" placeholder="Jugador, equipo o posición"></label></div><div id="cmV59ProfileContent">${content}</div></section>`;
}

function renderProfiles() {
  const page = document.getElementById('equipos');
  if (!page) return;
  const dataSignature = JSON.stringify({
    mode: profileState.mode, query: profileState.query, expanded: profileState.expanded,
    teams: teams().map((team) => [team.id, team.name, team.coach, team.players?.length || 0]),
    tournaments: tournaments().map((tournament) => [tournament.id, tournament.status, tournament.champion, tournament.runnerUp, tournament.third, (tournament.matches || []).map((match) => [match.id, match.homeGoals, match.awayGoals, match.goals?.length || 0, match.cards?.length || 0])])
  });
  let root = document.getElementById('cmV59ProfilesRoot');
  if (root && profilesSignature === dataSignature) return;
  profilesSignature = dataSignature;
  const markup = profilesMarkup();
  if (root) root.outerHTML = markup;
  else page.querySelector('.page-title')?.insertAdjacentHTML('afterend', markup);
}

function injectLiveButtons() {
  document.querySelectorAll('.cm-v59-live-launch').forEach((button) => {
    if (!core.canEdit()) button.remove();
  });
  if (!core.canEdit()) return;
  document.querySelectorAll('[data-edit-match]').forEach((edit) => {
    const pair = edit.dataset.editMatch;
    const parent = edit.parentElement;
    if (pair && parent && !parent.querySelector(`[data-cm-v59-live="${CSS.escape(pair)}"]`)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mini-button cm-v59-live-launch';
      button.dataset.cmV59Live = pair;
      button.textContent = 'Modo partido';
      parent.appendChild(button);
    }
  });
  document.querySelectorAll('[data-cm-hub-match]').forEach((open) => {
    const pair = open.dataset.cmHubMatch;
    const parent = open.parentElement;
    if (pair && parent && !parent.querySelector(`[data-cm-v59-live="${CSS.escape(pair)}"]`)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cm-v59-live-launch';
      button.dataset.cmV59Live = pair;
      button.textContent = 'Modo partido';
      parent.appendChild(button);
    }
  });
}

function refresh() {
  refreshQueued = false;
  renderProfiles();
  injectLiveButtons();
}

function scheduleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(refresh);
}

document.addEventListener('click', (event) => {
  const live = event.target.closest('[data-cm-v59-live]');
  if (live) { event.preventDefault(); event.stopPropagation(); renderLiveModal(live.dataset.cmV59Live); return; }
  const score = event.target.closest('[data-cm-v59-score]');
  if (score) { const root = score.closest('[data-cm-v59-live-pair]'); const [side, delta] = score.dataset.cmV59Score.split(':'); void adjustScore(root.dataset.cmV59LivePair, side, Number(delta)); return; }
  const goal = event.target.closest('[data-cm-v59-add-goal]');
  if (goal) { const root = goal.closest('[data-cm-v59-live-pair]'); void addGoal(root.dataset.cmV59LivePair, goal.dataset.cmV59AddGoal); return; }
  const card = event.target.closest('[data-cm-v59-add-card]');
  if (card) { const root = card.closest('[data-cm-v59-live-pair]'); void addCard(root.dataset.cmV59LivePair, card.dataset.cmV59AddCard); return; }
  const undo = event.target.closest('[data-cm-v59-undo]');
  if (undo && !undo.disabled) { const root = undo.closest('[data-cm-v59-live-pair]'); void undoLast(root.dataset.cmV59LivePair); return; }
  const save = event.target.closest('[data-cm-v59-save-live]');
  if (save) { const root = save.closest('[data-cm-v59-live-pair]'); void saveLiveData(root.dataset.cmV59LivePair); return; }
  const finish = event.target.closest('[data-cm-v59-finish]');
  if (finish) { const root = finish.closest('[data-cm-v59-live-pair]'); void finishMatch(root.dataset.cmV59LivePair); return; }
  const player = event.target.closest('[data-cm-v59-player]');
  if (player) { openPlayerProfile(player.dataset.cmV59Player); return; }
  const team = event.target.closest('[data-cm-v59-team]');
  if (team) { openTeamProfile(team.dataset.cmV59Team); return; }
  const mode = event.target.closest('[data-cm-v59-profile-mode]');
  if (mode) { profileState.mode = mode.dataset.cmV59ProfileMode; profileState.expanded = false; renderProfiles(); return; }
  if (event.target.closest('[data-cm-v59-show-all]')) { profileState.expanded = true; renderProfiles(); return; }
  setTimeout(scheduleRefresh, 0);
}, true);

document.addEventListener('input', (event) => {
  if (event.target.id !== 'cmV59ProfileSearch') return;
  profileState.query = event.target.value;
  profileState.expanded = Boolean(profileState.query);
  renderProfiles();
  const input = document.getElementById('cmV59ProfileSearch');
  input?.focus();
  input?.setSelectionRange(input.value.length, input.value.length);
});

const observedPages = [document.getElementById('partidos'), document.getElementById('torneos'), document.getElementById('equipos')].filter(Boolean);
observedPages.forEach((page) => new MutationObserver(scheduleRefresh).observe(page, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] }));

installStyles();
document.title = 'Chute Mundo v5.9 · Competición oficial';
const heroVersion = document.querySelector('.hero .eyebrow');
if (heroVersion) heroVersion.textContent = 'CHUTE MUNDO v5.9';
refresh();
window.setInterval(refresh, 1600);
window.ChuteV59 = {
  version: VERSION,
  refresh,
  openLiveMatch: renderLiveModal,
  openPlayerProfile,
  openTeamProfile,
  playerProfileData,
  teamProfileData,
  officialMinutes: [...OFFICIAL_MINUTES]
};
