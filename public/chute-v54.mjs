function waitForCore() {
  if (window.ChuteMundoCore) return Promise.resolve(window.ChuteMundoCore);
  return new Promise((resolve) => document.addEventListener('chute:ready', (event) => resolve(event.detail), { once: true }));
}

const core = await waitForCore();
const model = window.ChuteDetailModel;
if (!model) throw new Error('El modelo detallado no está disponible para la temporada por divisiones.');

const { esc } = model;
const TYPE = 'division_season';
const FIRST = '1.ª División';
const SECOND = '2.ª División';
const HOME_DEFAULT = 'participante_alvaro';
const AWAY_DEFAULT = 'participante_carlos';
const stateCache = { composition: null, source: '', blocked: '', saving: false };

function state() { return core.getState(); }
function played(match) { return core.matchPlayed(match); }
function teamName(teamId) { return core.teamName(teamId); }
function uid(prefix = 'div') { return core.uid(prefix); }
function isDivisionSeason(tournament) { return tournament?.type === TYPE; }
function activeTeams() { return (state().teams || []).filter((team) => !team.archived); }
function defaultParticipants() {
  const source = state();
  return {
    home: source.config?.participants?.defaultHomeId || source.participants?.find((participant) => participant.defaultSide === 'home')?.id || HOME_DEFAULT,
    away: source.config?.participants?.defaultAwayId || source.participants?.find((participant) => participant.defaultSide === 'away')?.id || AWAY_DEFAULT
  };
}

function fifaOrder() {
  const rows = window.ChuteStatsV52?.fifaRows?.(state().tournaments || []) || [];
  const ordered = rows.map((row) => row.teamId).filter(Boolean);
  for (const team of activeTeams()) if (!ordered.includes(team.id)) ordered.push(team.id);
  return ordered.slice(0, 6);
}

function divisionSeasons() {
  return (state().tournaments || []).filter(isDivisionSeason).sort((a, b) => Number(a.config?.seasonNumber || 0) - Number(b.config?.seasonNumber || 0));
}

function automaticComposition() {
  const previous = divisionSeasons().at(-1) || null;
  if (previous) {
    if (!previous.nextComposition?.first?.length || !previous.nextComposition?.second?.length) return { blocked: `La temporada “${previous.name}” todavía no define ascenso y descenso.`, source: 'Temporada anterior pendiente', first: [], second: [] };
    return { blocked: '', source: `Ascenso y descenso desde ${previous.name}`, first: [...previous.nextComposition.first], second: [...previous.nextComposition.second] };
  }
  const order = fifaOrder();
  return { blocked: order.length < 6 ? 'Se necesitan seis equipos con Ranking FIFA o equipos activos.' : '', source: 'Composición inaugural según Ranking FIFA', first: order.slice(0, 3), second: order.slice(3, 6) };
}

function roundRobin(teamIds) {
  const teams = [...teamIds];
  if (teams.length % 2) teams.push(null);
  const rounds = [];
  for (let round = 0; round < teams.length - 1; round += 1) {
    const pairs = [];
    for (let index = 0; index < teams.length / 2; index += 1) {
      const a = teams[index]; const b = teams[teams.length - 1 - index];
      if (a && b) pairs.push(round % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
    }
    rounds.push(pairs);
    const fixed = teams[0]; const rest = teams.slice(1); rest.unshift(rest.pop()); teams.splice(0, teams.length, fixed, ...rest);
  }
  return rounds;
}

function newMatch(data = {}) {
  const participants = defaultParticipants();
  return {
    id: data.id || uid('m'), stage: data.stage || 'group', round: data.round || 'Fecha 1', label: data.label || 'Partido 1', group: data.group || null,
    home: data.home || null, away: data.away || null, homeRef: null, awayRef: null, homeGoals: null, awayGoals: null, homePens: null, awayPens: null,
    participantHome: data.participantHome || participants.home, participantAway: data.participantAway || participants.away,
    date: '', time: '', venue: '', notes: '', homeGoalLog: '', awayGoalLog: '', homeCardLog: '', awayCardLog: '', goals: [], cards: []
  };
}

function divisionMatches(teamIds, legs, divisionName, divisionKey) {
  const base = roundRobin(teamIds); const matches = [];
  const append = (rounds, offset, reverse = false) => rounds.forEach((pairs, roundIndex) => pairs.forEach((pair, matchIndex) => matches.push(newMatch({ id: uid(`ds_${divisionKey}`), stage: 'group', group: divisionName, round: `Fecha ${offset + roundIndex + 1}`, label: `Partido ${matchIndex + 1}`, home: reverse ? pair.away : pair.home, away: reverse ? pair.home : pair.away }))));
  append(base, 0, false);
  if (Number(legs) === 2) append(base, base.length, true);
  return matches;
}

function buildSeason({ name, status = 'upcoming', legs = 2, firstPlayoff = true, secondPlayoff = true, finalLegs = 1, promotionMode = 'playoff', firstIds, secondIds }) {
  const seasonNumber = divisionSeasons().length + 1;
  const participants = defaultParticipants();
  return {
    id: uid('season'), name, type: TYPE, era: 'division', eraId: 'divisions', status, createdAt: new Date().toLocaleDateString('es-CL'),
    config: {
      seasonNumber, legs: Number(legs), finalLegs: Number(finalLegs), playoffs: { first: Boolean(firstPlayoff), second: Boolean(secondPlayoff) },
      promotionMode: secondPlayoff && promotionMode === 'playoff' ? 'playoff' : 'regular', relegationMode: 'regular', compositionSource: stateCache.source || 'Ranking FIFA',
      tieBreakOrder: ['points', 'goalDifference', 'goalsFor', 'goalsAgainst', 'headToHead'],
      discipline: { yellowLimit: 2, doubleYellowIsRed: true, suspensionMatches: 1, directRedSuspension: 1, carryBetweenSeasons: true }
    },
    teamIds: [...firstIds, ...secondIds],
    groups: [{ id: 'first', name: FIRST, teamIds: [...firstIds] }, { id: 'second', name: SECOND, teamIds: [...secondIds] }],
    matches: [...divisionMatches(firstIds, legs, FIRST, 'first'), ...divisionMatches(secondIds, legs, SECOND, 'second')],
    notes: ['Primera y Segunda División pertenecen a una misma temporada.', 'El 3.º de Primera desciende y el ascendido de Segunda se incorpora automáticamente a la temporada siguiente.', 'Desempates: puntos, diferencia de gol, goles a favor, menos goles recibidos y resultado entre ambos.'],
    playerScorers: [], playerAssists: [], divisionResults: null, nextComposition: null, champion: null, runnerUp: null, third: null,
    participantLocal: participants.home, participantAway: participants.away, participantChampion: '', participantRunnerUp: '', participantThird: ''
  };
}

function directResult(tournament, divisionName, teamA, teamB) {
  let pointsA = 0; let pointsB = 0; let goalsA = 0; let goalsB = 0; let matches = 0;
  for (const match of (tournament.matches || []).filter((item) => item.stage === 'group' && item.group === divisionName && played(item) && ((item.home === teamA && item.away === teamB) || (item.home === teamB && item.away === teamA)))) {
    matches += 1;
    const aHome = match.home === teamA;
    const aGoals = Number(aHome ? match.homeGoals : match.awayGoals);
    const bGoals = Number(aHome ? match.awayGoals : match.homeGoals);
    goalsA += aGoals; goalsB += bGoals;
    if (aGoals > bGoals) pointsA += 3;
    else if (bGoals > aGoals) pointsB += 3;
    else { pointsA += 1; pointsB += 1; }
  }
  return { matches, pointsA, pointsB, goalDifference: goalsA - goalsB };
}

function standings(tournament, divisionName) {
  const group = (tournament.groups || []).find((item) => item.name === divisionName);
  const seeds = new Map((group?.teamIds || []).map((teamId, index) => [teamId, index]));
  const rows = Object.fromEntries((group?.teamIds || []).map((teamId) => [teamId, { teamId, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0, tiePending: false }]));
  for (const match of (tournament.matches || []).filter((item) => item.stage === 'group' && item.group === divisionName && played(item))) {
    const home = rows[match.home]; const away = rows[match.away];
    if (!home || !away) continue;
    const hg = Number(match.homeGoals); const ag = Number(match.awayGoals);
    home.pj += 1; away.pj += 1; home.gf += hg; home.gc += ag; away.gf += ag; away.gc += hg;
    if (hg > ag) { home.pg += 1; away.pp += 1; home.pts += 3; }
    else if (ag > hg) { away.pg += 1; home.pp += 1; away.pts += 3; }
    else { home.pe += 1; away.pe += 1; home.pts += 1; away.pts += 1; }
  }
  const list = Object.values(rows).map((row) => ({ ...row, dg: row.gf - row.gc }));
  list.sort((a, b) => {
    const base = b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.gc - b.gc;
    if (base) return base;
    const direct = directResult(tournament, divisionName, a.teamId, b.teamId);
    if (direct.pointsA !== direct.pointsB) return direct.pointsB - direct.pointsA;
    if (direct.goalDifference) return -direct.goalDifference;
    return (seeds.get(a.teamId) || 0) - (seeds.get(b.teamId) || 0);
  });
  list.forEach((row, index) => {
    const next = list[index + 1];
    if (!next || row.pts !== next.pts || row.dg !== next.dg || row.gf !== next.gf || row.gc !== next.gc) return;
    const direct = directResult(tournament, divisionName, row.teamId, next.teamId);
    if (direct.pointsA === direct.pointsB && direct.goalDifference === 0) { row.tiePending = true; next.tiePending = true; }
  });
  return list.map((row, index) => ({ ...row, pos: index + 1 }));
}

function regularComplete(tournament, divisionName) {
  const matches = (tournament.matches || []).filter((item) => item.stage === 'group' && item.group === divisionName);
  return matches.length > 0 && matches.every(played);
}
function playoffMatches(tournament, divisionName) { return (tournament.matches || []).filter((item) => item.stage === 'knockout' && item.round === 'Play-Off' && item.group === divisionName); }

function createPlayoff(tournament, divisionName, divisionKey, rows) {
  const legs = Number(tournament.config?.finalLegs || 1); const leader = rows[0]?.teamId; const runner = rows[1]?.teamId;
  if (!leader || !runner || rows[0]?.tiePending || rows[1]?.tiePending || playoffMatches(tournament, divisionName).length) return false;
  if (legs === 2) tournament.matches.push(newMatch({ id: `${tournament.id}_${divisionKey}_final_1`, stage: 'knockout', round: 'Play-Off', label: `Final ${divisionName} · Ida`, group: divisionName, home: runner, away: leader }), newMatch({ id: `${tournament.id}_${divisionKey}_final_2`, stage: 'knockout', round: 'Play-Off', label: `Final ${divisionName} · Vuelta`, group: divisionName, home: leader, away: runner }));
  else tournament.matches.push(newMatch({ id: `${tournament.id}_${divisionKey}_final`, stage: 'knockout', round: 'Play-Off', label: `Final ${divisionName}`, group: divisionName, home: leader, away: runner }));
  return true;
}

function matchWinner(match) {
  if (!played(match)) return null;
  const hg = Number(match.homeGoals); const ag = Number(match.awayGoals);
  if (hg > ag) return match.home; if (ag > hg) return match.away;
  if (match.homePens !== null && match.awayPens !== null && Number(match.homePens) !== Number(match.awayPens)) return Number(match.homePens) > Number(match.awayPens) ? match.home : match.away;
  return null;
}

function finalOutcome(tournament, divisionName) {
  const matches = playoffMatches(tournament, divisionName);
  if (!matches.length || !matches.every(played)) return null;
  if (matches.length === 1) { const winner = matchWinner(matches[0]); return winner ? { winner, runnerUp: winner === matches[0].home ? matches[0].away : matches[0].home } : null; }
  const totals = new Map();
  for (const match of matches) { totals.set(match.home, (totals.get(match.home) || 0) + Number(match.homeGoals)); totals.set(match.away, (totals.get(match.away) || 0) + Number(match.awayGoals)); }
  const teams = [...totals.keys()]; if (teams.length !== 2) return null;
  let winner = totals.get(teams[0]) > totals.get(teams[1]) ? teams[0] : totals.get(teams[1]) > totals.get(teams[0]) ? teams[1] : null;
  if (!winner) { const secondLeg = matches.at(-1); if (secondLeg.homePens !== null && secondLeg.awayPens !== null && Number(secondLeg.homePens) !== Number(secondLeg.awayPens)) winner = Number(secondLeg.homePens) > Number(secondLeg.awayPens) ? secondLeg.home : secondLeg.away; }
  return winner ? { winner, runnerUp: teams.find((teamId) => teamId !== winner) } : null;
}

function syncTournament(tournament) {
  if (!isDivisionSeason(tournament)) return false;
  let changed = false;
  const firstRows = standings(tournament, FIRST); const secondRows = standings(tournament, SECOND);
  const firstDone = regularComplete(tournament, FIRST); const secondDone = regularComplete(tournament, SECOND);
  const firstPlayoff = Boolean(tournament.config?.playoffs?.first); const secondPlayoff = Boolean(tournament.config?.playoffs?.second);
  if (firstDone && firstPlayoff) changed = createPlayoff(tournament, FIRST, 'first', firstRows) || changed;
  if (secondDone && secondPlayoff) changed = createPlayoff(tournament, SECOND, 'second', secondRows) || changed;
  const unresolved = [...firstRows, ...secondRows].some((row) => row.tiePending);
  if (unresolved) {
    tournament.notes = Array.from(new Set([...(tournament.notes || []), 'Existe un empate total que requiere partido de desempate o resolución administrativa.']));
    return changed;
  }
  const firstFinal = firstPlayoff ? finalOutcome(tournament, FIRST) : (firstDone ? { winner: firstRows[0]?.teamId, runnerUp: firstRows[1]?.teamId } : null);
  const secondFinal = secondPlayoff ? finalOutcome(tournament, SECOND) : (secondDone ? { winner: secondRows[0]?.teamId, runnerUp: secondRows[1]?.teamId } : null);
  const promoted = secondDone ? (tournament.config?.promotionMode === 'playoff' ? secondFinal?.winner : secondRows[0]?.teamId) : null;
  const relegated = firstDone ? firstRows.at(-1)?.teamId : null;
  if (firstDone && secondDone && firstFinal?.winner && secondFinal?.winner && promoted && relegated) {
    const nextFirst = firstRows.map((row) => row.teamId).filter((teamId) => teamId !== relegated); if (!nextFirst.includes(promoted)) nextFirst.push(promoted);
    const nextSecond = secondRows.map((row) => row.teamId).filter((teamId) => teamId !== promoted); if (!nextSecond.includes(relegated)) nextSecond.push(relegated);
    const outcome = { firstChampion: firstFinal.winner, firstRunnerUp: firstFinal.runnerUp, secondChampion: secondFinal.winner, secondRunnerUp: secondFinal.runnerUp, promoted, relegated, completedAt: tournament.divisionResults?.completedAt || Date.now() };
    const signature = JSON.stringify({ outcome, nextFirst, nextSecond });
    const previousSignature = JSON.stringify({ outcome: tournament.divisionResults, nextFirst: tournament.nextComposition?.first, nextSecond: tournament.nextComposition?.second });
    if (signature !== previousSignature) {
      tournament.divisionResults = outcome; tournament.nextComposition = { first: nextFirst, second: nextSecond, sourceTournamentId: tournament.id };
      tournament.champion = firstFinal.winner; tournament.runnerUp = firstFinal.runnerUp; tournament.third = firstRows.find((row) => ![firstFinal.winner, firstFinal.runnerUp].includes(row.teamId))?.teamId || null;
      tournament.status = 'historical'; tournament.notes = Array.from(new Set([...(tournament.notes || []), `${teamName(promoted)} asciende a Primera División.`, `${teamName(relegated)} desciende a Segunda División.`])); changed = true;
    }
  }
  return changed;
}

async function syncAll({ persist = true } = {}) {
  if (stateCache.saving) return false;
  const tournaments = (state().tournaments || []).filter(isDivisionSeason);
  const changed = tournaments.some((tournament) => syncTournament(tournament));
  if (!changed || !persist) return changed;
  stateCache.saving = true;
  try {
    const current = state(); const completed = [...tournaments].reverse().find((tournament) => tournament.nextComposition);
    if (completed) current.divisions = { ...(current.divisions || {}), A: [...completed.nextComposition.first], B: [...completed.nextComposition.second], first: [...completed.nextComposition.first], second: [...completed.nextComposition.second], sourceTournamentId: completed.id };
    core.persistLocal(); core.render(); if (core.canEdit()) await core.saveCloud();
  } catch (error) { console.error('No se pudo sincronizar el ascenso y descenso.', error); }
  finally { stateCache.saving = false; }
  return changed;
}

function teamOption(team, selectedId, rankingMap) {
  const points = rankingMap.get(team.id);
  return `<option value="${esc(team.id)}" ${team.id === selectedId ? 'selected' : ''}>${esc(team.name)}${points !== undefined ? ` · ${Number(points).toFixed(2)} pts FIFA` : ''}</option>`;
}
function compositionEditor(composition) {
  const teams = activeTeams(); const rankings = new Map((window.ChuteStatsV52?.fifaRows?.(state().tournaments || []) || []).map((row) => [row.teamId, row.points]));
  const division = (name, key, ids) => `<section class="cm-v54-division-box ${key}"><header><div><p class="eyebrow">${key === 'first' ? 'MÁXIMA CATEGORÍA' : 'ASCENSO'}</p><h3>${name}</h3></div><span>3 equipos</span></header><div>${ids.map((teamId, index) => `<label>${index + 1}.º puesto<select data-cm-division-slot="${key}-${index}">${teams.map((team) => teamOption(team, teamId, rankings)).join('')}</select></label>`).join('')}</div></section>`;
  return `<div class="cm-v54-composition">${division(FIRST, 'first', composition.first)}${division(SECOND, 'second', composition.second)}</div>`;
}

function ensureFormUI() {
  const typeSelect = document.getElementById('tournamentType'); const form = document.getElementById('tournamentForm');
  if (!typeSelect || !form) return;
  if (!typeSelect.querySelector(`option[value="${TYPE}"]`)) { const option = document.createElement('option'); option.value = TYPE; option.textContent = 'Temporada por divisiones'; typeSelect.appendChild(option); }
  let panel = document.getElementById('cmDivisionSeasonConfig');
  if (!panel) { panel = document.createElement('section'); panel.id = 'cmDivisionSeasonConfig'; panel.className = 'cm-v54-config'; document.getElementById('formatHelp')?.insertAdjacentElement('afterend', panel); }
  const active = typeSelect.value === TYPE; form.classList.toggle('cm-v54-division-mode', active); panel.hidden = !active; if (!active) return;
  const auto = automaticComposition();
  if (!stateCache.composition || stateCache.source !== auto.source) { stateCache.composition = { first: [...auto.first], second: [...auto.second] }; stateCache.source = auto.source; stateCache.blocked = auto.blocked; }
  const help = document.getElementById('formatHelp'); if (help) help.textContent = 'Crea Primera y Segunda División en una sola temporada, con ascenso, descenso, Play-Off y desempate directo.';
  const composition = stateCache.composition;
  panel.innerHTML = `<div class="cm-v54-config-head"><div><p class="eyebrow">TEMPORADA POR DIVISIONES</p><h3>Primera y Segunda en una sola competencia</h3><p>${esc(auto.source)}</p></div><button type="button" data-cm-reset-composition>Restablecer equipos</button></div>${auto.blocked ? `<p class="cm-v54-warning">${esc(auto.blocked)}</p>` : ''}${composition.first.length === 3 && composition.second.length === 3 ? compositionEditor(composition) : ''}<div class="cm-v54-options"><label>Fase regular<select id="cmDivisionLegs"><option value="1">Solo ida</option><option value="2" selected>Ida y vuelta</option></select></label><label>Final de Play-Off<select id="cmDivisionFinalLegs"><option value="1" selected>Partido único</option><option value="2">Ida y vuelta</option></select></label><label class="cm-v54-switch"><input id="cmFirstPlayoff" type="checkbox" checked><span>Play-Off en Primera</span><small>1.º y 2.º definen al campeón</small></label><label class="cm-v54-switch"><input id="cmSecondPlayoff" type="checkbox" checked><span>Play-Off en Segunda</span><small>1.º y 2.º disputan la final</small></label><label>Ascenso de Segunda<select id="cmPromotionMode"><option value="playoff" selected>Ganador del Play-Off</option><option value="regular">1.º de la fase regular</option></select></label><div class="cm-v54-rule"><b>Descenso</b><span>El 3.º de Primera desciende directamente.</span></div><div class="cm-v54-rule"><b>Desempate</b><span>Puntos, DG, GF, GC y resultado entre ambos.</span></div><div class="cm-v54-rule"><b>Disciplina</b><span>2 amarillas acumuladas generan una suspensión.</span></div></div>`;
}

function readCompositionFromUI() { const read = (key) => [0, 1, 2].map((index) => document.querySelector(`[data-cm-division-slot="${key}-${index}"]`)?.value || ''); return { first: read('first'), second: read('second') }; }
function validateComposition(composition) { const all = [...composition.first, ...composition.second]; if (all.some((teamId) => !teamId)) return 'Completa los seis cupos de las divisiones.'; if (new Set(all).size !== 6) return 'Cada equipo debe aparecer una sola vez.'; return ''; }

async function createSeasonFromForm(event) {
  const form = event.target;
  if (form.id !== 'tournamentForm' || document.getElementById('tournamentType')?.value !== TYPE) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (!core.canEdit()) return core.showToast('Inicia sesión como administrador para crear la temporada.');
  const name = document.getElementById('tournamentName')?.value.trim() || '';
  if (!name) return core.showToast('Escribe un nombre para la temporada.');
  if ((state().tournaments || []).some((tournament) => tournament.name.toLowerCase() === name.toLowerCase())) return core.showToast('Ya existe un torneo con ese nombre.');
  if (stateCache.blocked) return core.showToast(stateCache.blocked);
  const composition = readCompositionFromUI(); const error = validateComposition(composition); if (error) return core.showToast(error);
  const secondPlayoff = Boolean(document.getElementById('cmSecondPlayoff')?.checked);
  const tournament = buildSeason({ name, status: document.getElementById('tournamentStatus')?.value || 'upcoming', legs: Number(document.getElementById('cmDivisionLegs')?.value || 2), firstPlayoff: Boolean(document.getElementById('cmFirstPlayoff')?.checked), secondPlayoff, finalLegs: Number(document.getElementById('cmDivisionFinalLegs')?.value || 1), promotionMode: secondPlayoff ? document.getElementById('cmPromotionMode')?.value || 'playoff' : 'regular', firstIds: composition.first, secondIds: composition.second });
  const current = state(); current.tournaments.push(tournament); current.activity = Array.isArray(current.activity) ? current.activity : []; current.activity.unshift({ id: uid('activity'), text: `Se creó ${name} con Primera y Segunda División.`, at: Date.now() });
  core.setState(current); core.navigate('torneos'); window.setTimeout(() => document.querySelector(`[data-open-tournament="${CSS.escape(tournament.id)}"]`)?.click(), 50);
  try { await core.saveCloud(); core.showToast(`Temporada “${name}” creada y sincronizada.`); }
  catch (errorCloud) { console.error(errorCloud); core.showToast(`Temporada guardada localmente; Firebase respondió: ${errorCloud.code || errorCloud.message || 'error desconocido'}.`); }
  form.reset(); document.getElementById('tournamentType').value = 'league'; stateCache.composition = null; ensureFormUI();
}

function enhanceDivisionHub() {
  const hub = document.getElementById('cmTournamentHub'); if (!hub) return;
  const tournament = (state().tournaments || []).find((item) => item.id === hub.dataset.tournamentId); if (!isDivisionSeason(tournament)) return;
  hub.classList.add('cm-v54-division-hub');
  const tableTab = hub.querySelector('[data-cm-tournament-tab="table"]'); if (tableTab) tableTab.textContent = 'Divisiones y tablas';
  const heading = hub.querySelector('.cm-hub-heading h2'); if (heading) heading.textContent = 'Temporada de Primera y Segunda División';
  const sourceLegend = hub.querySelector('[data-cm-tournament-panel="table"] .cm-hub-legend'); if (sourceLegend) sourceLegend.hidden = true;
  hub.querySelectorAll('.cm-hub-table-card').forEach((card) => {
    const title = card.querySelector('h3')?.textContent?.trim(); const divisionKey = title === FIRST ? 'first' : title === SECOND ? 'second' : '';
    if (!divisionKey || card.dataset.cmDivisionEnhanced === 'true') return;
    card.dataset.cmDivisionEnhanced = 'true'; card.classList.add(`cm-v54-${divisionKey}-table`);
    const rows = [...card.querySelectorAll('tbody tr')]; if (divisionKey === 'first') rows.at(-1)?.classList.add('cm-v54-relegation-row');
    const playoff = Boolean(tournament.config?.playoffs?.[divisionKey]); const note = document.createElement('p'); note.className = 'cm-v54-table-note';
    note.innerHTML = divisionKey === 'first' ? `<span class="qualify"></span>${playoff ? '1.º y 2.º clasifican al Play-Off.' : 'El 1.º es campeón.'}<span class="relegate"></span>El 3.º desciende.` : `<span class="qualify"></span>${playoff ? '1.º y 2.º clasifican al Play-Off.' : 'El 1.º es campeón y asciende.'}`;
    card.appendChild(note);
  });
  let seasonInfo = hub.querySelector('.cm-v54-season-info'); if (!seasonInfo) { seasonInfo = document.createElement('section'); seasonInfo.className = 'cm-v54-season-info'; hub.querySelector('.cm-hub-heading')?.insertAdjacentElement('afterend', seasonInfo); }
  const result = tournament.divisionResults;
  seasonInfo.innerHTML = `<article><span>Primera División</span><b>${tournament.config?.playoffs?.first ? 'Con Play-Off' : 'Tabla regular'}</b></article><article><span>Segunda División</span><b>${tournament.config?.playoffs?.second ? 'Con Play-Off' : 'Tabla regular'}</b></article><article><span>Ascenso</span><b>${tournament.config?.promotionMode === 'playoff' ? 'Ganador Play-Off' : 'Líder regular'}</b></article><article><span>Desempate</span><b>Resultado entre ambos</b></article><article><span>Disciplina</span><b>2 amarillas</b></article>${result ? `<div class="cm-v54-movement"><strong>↑ ${esc(teamName(result.promoted))} asciende</strong><strong>↓ ${esc(teamName(result.relegated))} desciende</strong></div>` : ''}`;
}

function enhanceCompactFixture() {
  const fixture = document.querySelector('#cmTournamentHub [data-cm-tournament-panel="fixture"]'); if (!fixture) return;
  fixture.querySelectorAll('.cm-hub-match').forEach((card) => { if (card.dataset.cmCompact === 'true') return; card.dataset.cmCompact = 'true'; card.classList.add('cm-v54-compact-match'); const header = card.querySelector(':scope > header'); if (header) { const button = document.createElement('button'); button.type = 'button'; button.className = 'cm-v54-match-toggle'; button.setAttribute('aria-expanded', 'false'); button.innerHTML = '<span>Detalle</span><b>⌄</b>'; header.appendChild(button); } });
}
function replaceRawLabels() { document.querySelectorAll('.badge, .cm-tournament-card-top small').forEach((element) => { if (element.textContent?.trim() === TYPE) element.textContent = 'Temporada por divisiones'; }); }
function refresh() { ensureFormUI(); enhanceDivisionHub(); enhanceCompactFixture(); replaceRawLabels(); }

document.addEventListener('submit', createSeasonFromForm, true);
document.addEventListener('change', (event) => { if (event.target.id === 'tournamentType') { stateCache.composition = null; window.setTimeout(ensureFormUI, 0); return; } if (event.target.closest('[data-cm-division-slot]')) stateCache.composition = readCompositionFromUI(); if (event.target.id === 'cmSecondPlayoff') { const promotion = document.getElementById('cmPromotionMode'); if (promotion) { promotion.disabled = !event.target.checked; if (!event.target.checked) promotion.value = 'regular'; } } window.setTimeout(() => syncAll(), 650); });
document.addEventListener('click', (event) => { if (event.target.closest('[data-cm-reset-composition]')) { stateCache.composition = null; stateCache.source = ''; ensureFormUI(); return; } const toggle = event.target.closest('.cm-v54-match-toggle'); if (toggle) { event.preventDefault(); event.stopPropagation(); const card = toggle.closest('.cm-hub-match'); const fixture = card?.closest('[data-cm-tournament-panel="fixture"]'); const open = !card.classList.contains('expanded'); fixture?.querySelectorAll('.cm-hub-match.expanded').forEach((item) => { item.classList.remove('expanded'); item.querySelector('.cm-v54-match-toggle')?.setAttribute('aria-expanded', 'false'); }); card?.classList.toggle('expanded', open); toggle.setAttribute('aria-expanded', String(open)); } window.setTimeout(() => syncAll(), 750); });
document.addEventListener('submit', () => window.setTimeout(() => syncAll(), 800));
refresh();
window.setInterval(() => { refresh(); syncAll(); }, 1100);
window.ChuteDivisionsV54 = { TYPE, FIRST, SECOND, fifaOrder, automaticComposition, buildSeason, standings, directResult, syncTournament, syncAll, refresh };
