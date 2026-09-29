function waitForCore() {
  if (window.ChuteMundoCore) return Promise.resolve(window.ChuteMundoCore);
  return new Promise((resolve) => document.addEventListener('chute:ready', (event) => resolve(event.detail), { once: true }));
}

const core = await waitForCore();
const model = window.ChuteDetailModel;
if (!model) throw new Error('El modelo detallado no está disponible para Análisis v5.8.');

const { esc, logoUrl, photo, ensureMatchEvents } = model;
const runtime = window.ChuteRuntimeV58;
const filters = { era: 'all', tournament: 'all', team: 'all', division: 'all', phase: 'all', venue: 'all' };
const compare = { left: '', right: '' };
let mode = 'standard';
let lastSignature = '';
let rendering = false;

const MINUTE_BUCKETS = [
  { key: '0', label: "0′", min: 0, max: 9 },
  { key: '10', label: "10′", min: 10, max: 19 },
  { key: '20', label: "20′", min: 20, max: 29 },
  { key: '30', label: "30′", min: 30, max: 44 },
  { key: '45', label: "45′", min: 45, max: 49 },
  { key: '50', label: "50′", min: 50, max: 59 },
  { key: '60', label: "60′", min: 60, max: 69 },
  { key: '70', label: "70′", min: 70, max: 79 },
  { key: '80', label: "80′", min: 80, max: 89 },
  { key: '90', label: "90′", min: 90, max: 104 },
  { key: '105', label: "105′", min: 105, max: 119 },
  { key: '120', label: "120′", min: 120, max: Number.POSITIVE_INFINITY },
  { key: 'pens', label: 'Penales', penalties: true }
];

function state() { return core.getState(); }
function teams() { return state().teams || []; }
function tournaments() { return state().tournaments || []; }
function teamName(teamId) { return core.teamName(teamId); }
function played(match) { return core.matchPlayed(match); }
function homeOf(tournament, match) { return core.resolveHome(tournament, match); }
function awayOf(tournament, match) { return core.resolveAway(tournament, match); }
function numeric(value) { const number = Number(value); return Number.isFinite(number) ? number : 0; }
function format(value, digits = 2) { return numeric(value).toFixed(digits); }
function percentage(value) { return `${numeric(value).toFixed(1)}%`; }
function normalize(value = '') { return String(value).trim().toLocaleLowerCase('es'); }

function tournamentEra(tournament) {
  return tournament?.type === 'division_season' || tournament?.era === 'division' ? 'division' : 'league';
}
function eraLabel(era) {
  if (era === 'division') return 'Era de divisiones';
  if (era === 'league') return 'Era de ligas';
  return 'Toda la historia';
}
function matchDate(match) {
  if (!match?.date) return null;
  const raw = String(match.date).trim();
  const text = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T${match.time || '00:00'}:00` : raw;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}
function orderedTournaments(list = tournaments()) {
  return list.map((tournament, index) => ({ tournament, index })).sort((left, right) => {
    const leftDate = numeric(left.tournament.createdAt || left.tournament.startDate || 0);
    const rightDate = numeric(right.tournament.createdAt || right.tournament.startDate || 0);
    if (leftDate && rightDate && leftDate !== rightDate) return leftDate - rightDate;
    return left.index - right.index;
  }).map(({ tournament }) => tournament);
}
function divisionFor(tournament, match, home, away) {
  if (tournament.type !== 'division_season') return 'none';
  const group = (tournament.groups || []).find((item) => item.id === match.group)
    || (tournament.groups || []).find((item) => (item.teamIds || []).includes(home) && (item.teamIds || []).includes(away));
  const label = normalize(`${group?.name || ''} ${group?.label || ''} ${match.group || ''}`);
  if (/1|primera/.test(label)) return 'first';
  if (/2|segunda/.test(label)) return 'second';
  return 'playoff';
}
function phaseFor(match) {
  const text = normalize(`${match.stage || ''} ${match.round || ''} ${match.label || ''}`);
  if (/final/.test(text) && !/semi/.test(text)) return 'final';
  if (/knockout|playoff|semi|elimin/.test(text)) return 'playoff';
  return 'regular';
}
function allPlayedRecords(list = tournaments()) {
  return orderedTournaments(list).flatMap((tournament, tournamentIndex) => (tournament.matches || [])
    .filter((match) => match.stage !== 'bye')
    .map((match, matchIndex) => {
      const home = homeOf(tournament, match);
      const away = awayOf(tournament, match);
      ensureMatchEvents(match, home, away);
      return { tournament, match, home, away, tournamentIndex, matchIndex, era: tournamentEra(tournament), division: divisionFor(tournament, match, home, away), phase: phaseFor(match), venue: String(match.venue || '').trim() || 'Sin sede' };
    }))
    .filter(({ match, home, away }) => played(match) && home && away)
    .sort((left, right) => {
      const leftTime = matchDate(left.match)?.getTime();
      const rightTime = matchDate(right.match)?.getTime();
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return leftTime - rightTime;
      return left.tournamentIndex - right.tournamentIndex || left.matchIndex - right.matchIndex;
    });
}
function tournamentsForFilters() {
  const eraFiltered = orderedTournaments().filter((tournament) => filters.era === 'all' || tournamentEra(tournament) === filters.era);
  if (filters.tournament !== 'all' && !eraFiltered.some((tournament) => tournament.id === filters.tournament)) filters.tournament = 'all';
  return filters.tournament === 'all' ? eraFiltered : eraFiltered.filter((tournament) => tournament.id === filters.tournament);
}
function filteredRecords() {
  return allPlayedRecords(tournamentsForFilters()).filter((record) => {
    if (filters.team !== 'all' && record.home !== filters.team && record.away !== filters.team) return false;
    if (filters.division !== 'all' && record.division !== filters.division) return false;
    if (filters.phase !== 'all' && record.phase !== filters.phase) return false;
    if (filters.venue !== 'all' && record.venue !== filters.venue) return false;
    return true;
  });
}
function resultPoints(goalsFor, goalsAgainst) { return goalsFor > goalsAgainst ? 3 : goalsFor === goalsAgainst ? 1 : 0; }
function importance(match, config) {
  const weights = config?.weights || {};
  if (phaseFor(match) === 'final') return numeric(weights.final || 2);
  if (phaseFor(match) === 'playoff') return numeric(weights.playoff || 1.5);
  return numeric(weights.league || 1);
}
function rankingEvolution(selectedTournaments) {
  const fifa = state().config?.fifa || {};
  const bonus = fifa.bonus || {};
  const totals = new Map(teams().map((team) => [team.id, 0]));
  const snapshots = [];
  for (const tournament of orderedTournaments(selectedTournaments)) {
    for (const { match, home, away } of allPlayedRecords([tournament])) {
      const homeGoals = numeric(match.homeGoals);
      const awayGoals = numeric(match.awayGoals);
      const weight = importance(match, fifa);
      totals.set(home, numeric(totals.get(home)) + resultPoints(homeGoals, awayGoals) * weight);
      totals.set(away, numeric(totals.get(away)) + resultPoints(awayGoals, homeGoals) * weight);
    }
    if (tournament.champion && totals.has(tournament.champion)) totals.set(tournament.champion, totals.get(tournament.champion) + numeric(bonus.champion || 50));
    if (tournament.runnerUp && totals.has(tournament.runnerUp)) totals.set(tournament.runnerUp, totals.get(tournament.runnerUp) + numeric(bonus.runnerUp || 25));
    if (tournament.third && totals.has(tournament.third)) totals.set(tournament.third, totals.get(tournament.third) + numeric(bonus.third || 10));
    const ranking = [...totals.entries()].map(([teamId, points]) => ({ teamId, points })).sort((left, right) => right.points - left.points || teamName(left.teamId).localeCompare(teamName(right.teamId), 'es')).map((row, index) => ({ ...row, position: index + 1 }));
    snapshots.push({ tournament, ranking });
  }
  return snapshots;
}
function rankingChart(snapshots) {
  if (!snapshots.length) return '<div class="cm-v58-empty"><h3>Sin evolución disponible</h3><p>No hay torneos con datos para el filtro seleccionado.</p></div>';
  const teamIds = teams().map((team) => team.id).filter((teamId) => snapshots.some((snapshot) => snapshot.ranking.some((row) => row.teamId === teamId && row.points > 0)));
  const width = 920, height = 360, padX = 60, padTop = 28, padBottom = 65;
  const maxPoints = Math.max(1, ...snapshots.flatMap((snapshot) => snapshot.ranking.map((row) => row.points)));
  const usableWidth = width - padX * 2, usableHeight = height - padTop - padBottom;
  const x = (index) => snapshots.length === 1 ? width / 2 : padX + index * (usableWidth / (snapshots.length - 1));
  const y = (points) => padTop + usableHeight - (points / maxPoints) * usableHeight;
  const grid = [0, .25, .5, .75, 1].map((ratio) => { const value = maxPoints * ratio; const py = y(value); return `<g><line x1="${padX}" y1="${py}" x2="${width - padX}" y2="${py}"/><text x="${padX - 8}" y="${py + 4}">${Math.round(value)}</text></g>`; }).join('');
  const lines = teamIds.map((teamId, index) => { const points = snapshots.map((snapshot, snapshotIndex) => { const row = snapshot.ranking.find((item) => item.teamId === teamId); return `${x(snapshotIndex)},${y(row?.points || 0)}`; }).join(' '); const dimmed = filters.team !== 'all' && filters.team !== teamId ? ' dimmed' : ''; return `<polyline class="team-line line-${index % 8}${dimmed}" points="${points}" data-team="${esc(teamId)}"><title>${esc(teamName(teamId))}</title></polyline>`; }).join('');
  const labels = snapshots.map((snapshot, index) => `<text class="x-label" x="${x(index)}" y="${height - 24}" transform="rotate(-24 ${x(index)} ${height - 24})">${esc(snapshot.tournament.name)}</text>`).join('');
  const legend = teamIds.map((teamId, index) => { const last = snapshots.at(-1)?.ranking.find((row) => row.teamId === teamId); return `<span class="line-${index % 8}${filters.team !== 'all' && filters.team !== teamId ? ' dimmed' : ''}"><i></i><img src="${esc(logoUrl(teamId))}" alt="">${esc(teamName(teamId))}<b>${format(last?.points || 0)}</b></span>`; }).join('');
  return `<div class="cm-v58-chart-scroll"><svg class="cm-v58-ranking-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolución del Ranking FIFA Chute"><g class="grid">${grid}</g>${lines}${labels}</svg></div><div class="cm-v58-chart-legend">${legend}</div>`;
}
function winnerSide(match) {
  const homeGoals = numeric(match.homeGoals), awayGoals = numeric(match.awayGoals);
  if (homeGoals > awayGoals) return 'home'; if (awayGoals > homeGoals) return 'away';
  if (match.homePens !== null && match.homePens !== '' && match.awayPens !== null && match.awayPens !== '') { if (numeric(match.homePens) > numeric(match.awayPens)) return 'home'; if (numeric(match.awayPens) > numeric(match.homePens)) return 'away'; }
  return null;
}
function teamStats(teamId, records, selectedTournaments) {
  const row = { teamId, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0, titles: 0, finals: 0, finalsWon: 0, playoffs: 0, playoffsWon: 0, cleanSheets: 0 };
  for (const record of records) {
    if (record.home !== teamId && record.away !== teamId) continue;
    const isHome = record.home === teamId;
    const gf = numeric(isHome ? record.match.homeGoals : record.match.awayGoals), gc = numeric(isHome ? record.match.awayGoals : record.match.homeGoals);
    row.pj += 1; row.gf += gf; row.gc += gc; row.pts += resultPoints(gf, gc);
    if (gf > gc) row.pg += 1; else if (gf === gc) row.pe += 1; else row.pp += 1;
    if (gc === 0) row.cleanSheets += 1;
    if (record.phase === 'final') { row.finals += 1; if (winnerSide(record.match) === (isHome ? 'home' : 'away')) row.finalsWon += 1; }
    if (record.phase === 'playoff') { row.playoffs += 1; if (winnerSide(record.match) === (isHome ? 'home' : 'away')) row.playoffsWon += 1; }
  }
  row.titles = selectedTournaments.filter((tournament) => tournament.champion === teamId).length;
  row.dg = row.gf - row.gc; row.ppg = row.pj ? row.pts / row.pj : 0; row.winPct = row.pj ? row.pg / row.pj * 100 : 0;
  return row;
}
function headToHead(leftId, rightId, records) {
  const row = { matches: 0, leftWins: 0, rightWins: 0, draws: 0, leftGoals: 0, rightGoals: 0, latest: null, biggest: null };
  for (const record of records) {
    if (!((record.home === leftId && record.away === rightId) || (record.home === rightId && record.away === leftId))) continue;
    row.matches += 1; const leftHome = record.home === leftId; const leftGoals = numeric(leftHome ? record.match.homeGoals : record.match.awayGoals), rightGoals = numeric(leftHome ? record.match.awayGoals : record.match.homeGoals);
    row.leftGoals += leftGoals; row.rightGoals += rightGoals; if (leftGoals > rightGoals) row.leftWins += 1; else if (rightGoals > leftGoals) row.rightWins += 1; else row.draws += 1;
    row.latest = { ...record, leftGoals, rightGoals }; const margin = Math.abs(leftGoals - rightGoals); if (!row.biggest || margin > row.biggest.margin) row.biggest = { ...record, leftGoals, rightGoals, margin };
  }
  return row;
}
function metricRow(label, left, right, higherIsBetter = true, formatter = (value) => value) {
  const leftNumber = numeric(left), rightNumber = numeric(right); const leftWins = higherIsBetter ? leftNumber > rightNumber : leftNumber < rightNumber; const rightWins = higherIsBetter ? rightNumber > leftNumber : rightNumber < leftNumber;
  return `<div class="cm-v58-compare-metric"><span>${esc(label)}</span><b class="${leftWins ? 'leader' : ''}">${formatter(left)}</b><b class="${rightWins ? 'leader' : ''}">${formatter(right)}</b></div>`;
}
function comparatorMarkup(records, selectedTournaments) {
  const available = teams().filter((team) => records.some((record) => record.home === team.id || record.away === team.id));
  if (!compare.left || !available.some((team) => team.id === compare.left)) compare.left = available[0]?.id || teams()[0]?.id || '';
  if (!compare.right || compare.right === compare.left || !available.some((team) => team.id === compare.right)) compare.right = available.find((team) => team.id !== compare.left)?.id || teams().find((team) => team.id !== compare.left)?.id || '';
  const left = teamStats(compare.left, records, selectedTournaments), right = teamStats(compare.right, records, selectedTournaments), h2h = headToHead(compare.left, compare.right, records);
  const options = (selected) => available.map((team) => `<option value="${esc(team.id)}" ${team.id === selected ? 'selected' : ''}>${esc(team.name)}</option>`).join('');
  return `<section class="cm-v58-panel cm-v58-comparator"><header><div><p class="eyebrow">COMPARADOR DE EQUIPOS</p><h2>Rendimiento frente a frente</h2><p>Los jugadores permanecen vinculados a su mazo; la comparación se realiza entre clubes.</p></div></header><div class="cm-v58-compare-selects"><label>Equipo A<select data-cm-v58-compare="left">${options(compare.left)}</select></label><span>VS</span><label>Equipo B<select data-cm-v58-compare="right">${options(compare.right)}</select></label></div><div class="cm-v58-compare-head"><article><img src="${esc(logoUrl(compare.left))}" alt=""><strong>${esc(teamName(compare.left))}</strong></article><article><img src="${esc(logoUrl(compare.right))}" alt=""><strong>${esc(teamName(compare.right))}</strong></article></div><div class="cm-v58-compare-metrics">${metricRow('Partidos', left.pj, right.pj)}${metricRow('Victorias', left.pg, right.pg)}${metricRow('Puntos', left.pts, right.pts)}${metricRow('Puntos/PJ', left.ppg, right.ppg, true, (value) => format(value))}${metricRow('Goles', left.gf, right.gf)}${metricRow('Diferencia', left.dg, right.dg)}${metricRow('% victorias', left.winPct, right.winPct, true, percentage)}${metricRow('Vallas invictas', left.cleanSheets, right.cleanSheets)}${metricRow('Títulos', left.titles, right.titles)}${metricRow('Finales ganadas', left.finalsWon, right.finalsWon)}${metricRow('Play-Off ganados', left.playoffsWon, right.playoffsWon)}${metricRow('Victorias directas', h2h.leftWins, h2h.rightWins)}</div><div class="cm-v58-h2h-summary"><strong>${h2h.matches} enfrentamientos</strong><span>${h2h.leftWins} victorias ${esc(teamName(compare.left))} · ${h2h.draws} empates · ${h2h.rightWins} victorias ${esc(teamName(compare.right))}</span><b>Goles ${h2h.leftGoals}–${h2h.rightGoals}</b></div></section>`;
}
function matrixMarkup(records) {
  const visibleTeams = teams().filter((team) => records.some((record) => record.home === team.id || record.away === team.id));
  if (!visibleTeams.length) return '<div class="cm-v58-empty"><h3>Sin enfrentamientos</h3></div>';
  const header = visibleTeams.map((team) => `<th><img src="${esc(logoUrl(team.id))}" alt=""><span>${esc(team.initials || team.name.slice(0, 3).toUpperCase())}</span></th>`).join('');
  const body = visibleTeams.map((rowTeam) => `<tr><th><span class="cm-v58-matrix-team"><img src="${esc(logoUrl(rowTeam.id))}" alt="">${esc(rowTeam.name)}</span></th>${visibleTeams.map((columnTeam) => { if (rowTeam.id === columnTeam.id) return '<td class="same">—</td>'; const h2h = headToHead(rowTeam.id, columnTeam.id, records); return `<td title="${esc(`${rowTeam.name} vs ${columnTeam.name}`)}"><b>${h2h.leftWins}-${h2h.draws}-${h2h.rightWins}</b><small>${h2h.leftGoals}:${h2h.rightGoals} goles</small></td>`; }).join('')}</tr>`).join('');
  return `<section class="cm-v58-panel cm-v58-matrix"><header><div><p class="eyebrow">ENFRENTAMIENTOS DIRECTOS</p><h2>Matriz histórica</h2><p>Cada celda muestra victorias, empates y derrotas desde la perspectiva del equipo de la fila.</p></div></header><div class="cm-v58-matrix-scroll"><table><thead><tr><th>Equipo</th>${header}</tr></thead><tbody>${body}</tbody></table></div></section>`;
}
function minuteNumber(goal) { const match = String(goal?.minute || '').match(/\d+/); return match ? Number(match[0]) : null; }
function bucketForMinute(minute) { if (!Number.isFinite(minute)) return null; return MINUTE_BUCKETS.find((bucket) => !bucket.penalties && minute >= bucket.min && minute <= bucket.max) || null; }
function goalSequence(record) { return [...(record.match.goals || [])].sort((left, right) => numeric(minuteNumber(left)) - numeric(minuteNumber(right)) || numeric(left.createdAt) - numeric(right.createdAt)); }
function decisiveAnalysis(records) {
  const playerMap = new Map(), clubMap = new Map(); const summary = { finals: 0, playoffs: 0, shootouts: 0, comebacks: 0, closeWins: 0, lateGoals: 0 };
  const ensurePlayer = (teamId, name) => { const key = `${teamId}::${normalize(name)}`; if (!playerMap.has(key)) playerMap.set(key, { teamId, name, lateGoals: 0, finalGoals: 0, playoffGoals: 0, winningGoals: 0, score: 0 }); return playerMap.get(key); };
  const ensureClub = (teamId) => { if (!clubMap.has(teamId)) clubMap.set(teamId, { teamId, comebacks: 0, closeWins: 0, shootoutWins: 0, finalWins: 0, playoffWins: 0 }); return clubMap.get(teamId); };
  for (const record of records) {
    const winningSide = winnerSide(record.match), winningTeam = winningSide === 'home' ? record.home : winningSide === 'away' ? record.away : null; const homeGoals = numeric(record.match.homeGoals), awayGoals = numeric(record.match.awayGoals);
    if (record.phase === 'final') summary.finals += 1; if (record.phase === 'playoff') summary.playoffs += 1;
    if (record.match.homePens !== null && record.match.homePens !== '' && record.match.awayPens !== null && record.match.awayPens !== '') { summary.shootouts += 1; if (winningTeam) ensureClub(winningTeam).shootoutWins += 1; }
    if (winningTeam && Math.abs(homeGoals - awayGoals) === 1) { summary.closeWins += 1; ensureClub(winningTeam).closeWins += 1; }
    if (winningTeam && record.phase === 'final') ensureClub(winningTeam).finalWins += 1; if (winningTeam && record.phase === 'playoff') ensureClub(winningTeam).playoffWins += 1;
    let runningHome = 0, runningAway = 0, winningTeamTrailed = false; const sequence = goalSequence(record);
    for (const goal of sequence) { if (goal.side === 'away' || goal.teamId === record.away) runningAway += 1; else runningHome += 1; if (winningSide === 'home' && runningHome < runningAway) winningTeamTrailed = true; if (winningSide === 'away' && runningAway < runningHome) winningTeamTrailed = true; const minute = minuteNumber(goal); const teamId = goal.teamId || (goal.side === 'away' ? record.away : record.home); if (goal.playerName) { const player = ensurePlayer(teamId, goal.playerName); if (minute >= 80) { player.lateGoals += 1; summary.lateGoals += 1; } if (record.phase === 'final') player.finalGoals += 1; if (record.phase === 'playoff') player.playoffGoals += 1; } }
    if (winningTeamTrailed && winningTeam) { summary.comebacks += 1; ensureClub(winningTeam).comebacks += 1; }
    if (winningSide && homeGoals !== awayGoals) { let scoreHome = 0, scoreAway = 0; for (let index = 0; index < sequence.length; index += 1) { const goal = sequence[index]; if (goal.side === 'away' || goal.teamId === record.away) scoreAway += 1; else scoreHome += 1; const winnerAhead = winningSide === 'home' ? scoreHome > scoreAway : scoreAway > scoreHome; if (!winnerAhead) continue; let remainsAhead = true, futureHome = scoreHome, futureAway = scoreAway; for (const future of sequence.slice(index + 1)) { if (future.side === 'away' || future.teamId === record.away) futureAway += 1; else futureHome += 1; if (winningSide === 'home' ? futureHome <= futureAway : futureAway <= futureHome) { remainsAhead = false; break; } } if (remainsAhead && goal.playerName) { const teamId = goal.teamId || (goal.side === 'away' ? record.away : record.home); ensurePlayer(teamId, goal.playerName).winningGoals += 1; break; } } }
  }
  const players = [...playerMap.values()].map((player) => ({ ...player, score: player.winningGoals * 4 + player.finalGoals * 3 + player.playoffGoals * 2 + player.lateGoals })).sort((left, right) => right.score - left.score || right.winningGoals - left.winningGoals || left.name.localeCompare(right.name, 'es'));
  const clubs = [...clubMap.values()].sort((left, right) => (right.comebacks + right.finalWins + right.shootoutWins) - (left.comebacks + left.finalWins + left.shootoutWins));
  return { summary, players, clubs };
}
function decisiveMarkup(records) {
  const { summary, players, clubs } = decisiveAnalysis(records);
  return `<section class="cm-v58-panel cm-v58-decisive"><header><div><p class="eyebrow">RENDIMIENTO BAJO PRESIÓN</p><h2>Estadísticas decisivas</h2><p>Finales, Play-Off, penales, remontadas, definiciones y goles tardíos calculados desde los eventos oficiales.</p></div></header><div class="cm-v58-kpis compact"><article><span>Finales</span><b>${summary.finals}</b></article><article><span>Play-Off</span><b>${summary.playoffs}</b></article><article><span>Penales</span><b>${summary.shootouts}</b></article><article><span>Remontadas</span><b>${summary.comebacks}</b></article><article><span>Triunfos por uno</span><b>${summary.closeWins}</b></article><article><span>Goles 80′+</span><b>${summary.lateGoals}</b></article></div><div class="cm-v58-decisive-grid"><article><h3>Jugadores más decisivos</h3>${players.slice(0, 10).map((player, index) => `<div class="cm-v58-player-row"><b>${index + 1}</b>${photo(player.teamId, player.name, 'cm-v58-player-photo')}<div><strong>${esc(player.name)}</strong><span>${esc(teamName(player.teamId))}</span></div><em>${player.score}</em><small>${player.winningGoals} G ganador · ${player.finalGoals} final · ${player.lateGoals} tardíos</small></div>`).join('') || '<p class="empty">Sin goles detallados.</p>'}</article><article><h3>Clubes bajo presión</h3>${clubs.slice(0, 8).map((club) => `<div class="cm-v58-club-pressure"><img src="${esc(logoUrl(club.teamId))}" alt=""><div><strong>${esc(teamName(club.teamId))}</strong><span>${club.comebacks} remontadas · ${club.finalWins} finales · ${club.shootoutWins} penales</span></div><b>${club.closeWins}</b><small>triunfos cerrados</small></div>`).join('') || '<p class="empty">Sin definiciones registradas.</p>'}</article></div></section>`;
}
function venueAnalysis(records) {
  const map = new Map();
  for (const record of records) {
    if (!map.has(record.venue)) map.set(record.venue, { venue: record.venue, matches: 0, goals: 0, homeWins: 0, awayWins: 0, draws: 0, cards: 0, teamPoints: new Map(), scorers: new Map() });
    const row = map.get(record.venue), homeGoals = numeric(record.match.homeGoals), awayGoals = numeric(record.match.awayGoals); row.matches += 1; row.goals += homeGoals + awayGoals; row.cards += (record.match.cards || []).length;
    if (homeGoals > awayGoals) row.homeWins += 1; else if (awayGoals > homeGoals) row.awayWins += 1; else row.draws += 1;
    row.teamPoints.set(record.home, numeric(row.teamPoints.get(record.home)) + resultPoints(homeGoals, awayGoals)); row.teamPoints.set(record.away, numeric(row.teamPoints.get(record.away)) + resultPoints(awayGoals, homeGoals));
    for (const goal of record.match.goals || []) { if (!goal.playerName) continue; const teamId = goal.teamId || (goal.side === 'away' ? record.away : record.home); const key = `${teamId}::${goal.playerName}`; const scorer = row.scorers.get(key) || { teamId, name: goal.playerName, goals: 0 }; scorer.goals += 1; row.scorers.set(key, scorer); }
  }
  return [...map.values()].map((row) => ({ ...row, avgGoals: row.matches ? row.goals / row.matches : 0, bestTeam: [...row.teamPoints.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || null, topScorer: [...row.scorers.values()].sort((left, right) => right.goals - left.goals || left.name.localeCompare(right.name, 'es'))[0] || null })).sort((left, right) => right.matches - left.matches || left.venue.localeCompare(right.venue, 'es'));
}
function minuteAnalysis(records) {
  const rows = MINUTE_BUCKETS.map((bucket) => ({ ...bucket, scored: 0, conceded: 0 }));
  for (const record of records) {
    for (const goal of record.match.goals || []) { const bucket = bucketForMinute(minuteNumber(goal)); if (!bucket) continue; const target = rows.find((row) => row.key === bucket.key); const teamId = goal.teamId || (goal.side === 'away' ? record.away : record.home); if (filters.team === 'all' || filters.team === teamId) target.scored += 1; if (filters.team !== 'all' && filters.team !== teamId && (record.home === filters.team || record.away === filters.team)) target.conceded += 1; }
    const penalties = rows.find((row) => row.penalties); if (record.match.homePens !== null && record.match.homePens !== '' && record.match.awayPens !== null && record.match.awayPens !== '') { if (filters.team === 'all') penalties.scored += numeric(record.match.homePens) + numeric(record.match.awayPens); else if (record.home === filters.team) { penalties.scored += numeric(record.match.homePens); penalties.conceded += numeric(record.match.awayPens); } else if (record.away === filters.team) { penalties.scored += numeric(record.match.awayPens); penalties.conceded += numeric(record.match.homePens); } }
  }
  return rows;
}
function venueAndMinuteMarkup(records) {
  const venues = venueAnalysis(records), minutes = minuteAnalysis(records), maximum = Math.max(1, ...minutes.map((row) => Math.max(row.scored, row.conceded)));
  return `<section class="cm-v58-venue-minute"><article class="cm-v58-panel cm-v58-venues"><header><div><p class="eyebrow">SEDES</p><h2>Rendimiento por escenario</h2></div></header>${venues.length ? `<div class="cm-v58-table-wrap"><table><thead><tr><th>Sede</th><th>PJ</th><th>G/PJ</th><th>Local</th><th>Empates</th><th>Visita</th><th>Tarjetas</th><th>Mejor club</th><th>Goleador</th></tr></thead><tbody>${venues.map((row) => `<tr><td><strong>${esc(row.venue)}</strong></td><td>${row.matches}</td><td>${format(row.avgGoals)}</td><td>${row.homeWins}</td><td>${row.draws}</td><td>${row.awayWins}</td><td>${row.cards}</td><td>${row.bestTeam ? esc(teamName(row.bestTeam)) : '—'}</td><td>${row.topScorer ? `${esc(row.topScorer.name)} · ${row.topScorer.goals}` : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Todavía no existen sedes registradas en este filtro.</p>'}</article><article class="cm-v58-panel cm-v58-minute-chart"><header><div><p class="eyebrow">MINUTOS OFICIALES</p><h2>Goles por tramo</h2><p>${filters.team === 'all' ? 'Distribución total de goles y definiciones.' : `Anotados y recibidos por ${esc(teamName(filters.team))}.`}</p></div></header><div class="cm-v58-minute-legend"><span><i class="scored"></i>Anotados</span>${filters.team !== 'all' ? '<span><i class="conceded"></i>Recibidos</span>' : ''}</div><div class="cm-v58-minute-bars">${minutes.map((row) => `<div><span>${row.label}</span><div class="bars"><i class="scored"><b style="width:${Math.round(row.scored / maximum * 100)}%"></b></i>${filters.team !== 'all' ? `<i class="conceded"><b style="width:${Math.round(row.conceded / maximum * 100)}%"></b></i>` : ''}</div><strong>${row.scored}${filters.team !== 'all' ? ` / ${row.conceded}` : ''}</strong></div>`).join('')}</div></article></section>`;
}
function filterMarkup(candidates, records) {
  const availableTeams = teams().filter((team) => records.some((record) => record.home === team.id || record.away === team.id)); const venues = [...new Set(allPlayedRecords(candidates).map((record) => record.venue))].sort((left, right) => left.localeCompare(right, 'es'));
  return `<section class="cm-v58-filters"><div><p class="eyebrow">FILTROS DE ANÁLISIS</p><h2>Archivo histórico de Chute Mundo</h2><p>Combina era, torneo, club, división, fase y sede.</p></div><label>Era<select data-cm-v58-filter="era"><option value="all">Toda la historia</option><option value="league">Era de ligas</option><option value="division">Era de divisiones</option></select></label><label>Torneo<select data-cm-v58-filter="tournament"><option value="all">Todos los torneos</option>${candidates.map((tournament) => `<option value="${esc(tournament.id)}">${esc(tournament.name)}</option>`).join('')}</select></label><label>Equipo<select data-cm-v58-filter="team"><option value="all">Todos los equipos</option>${availableTeams.map((team) => `<option value="${esc(team.id)}">${esc(team.name)}</option>`).join('')}</select></label><label>División<select data-cm-v58-filter="division"><option value="all">Todas</option><option value="first">1.ª División</option><option value="second">2.ª División</option><option value="playoff">Play-Off divisional</option></select></label><label>Fase<select data-cm-v58-filter="phase"><option value="all">Todas las fases</option><option value="regular">Fase regular</option><option value="playoff">Play-Off</option><option value="final">Finales</option></select></label><label>Sede<select data-cm-v58-filter="venue"><option value="all">Todas las sedes</option>${venues.map((venue) => `<option value="${esc(venue)}">${esc(venue)}</option>`).join('')}</select></label><button type="button" data-cm-v58-reset>Restablecer</button></section>`;
}
function overviewMarkup(records, selectedTournaments) {
  const goals = records.reduce((total, record) => total + numeric(record.match.homeGoals) + numeric(record.match.awayGoals), 0), cards = records.reduce((total, record) => total + (record.match.cards || []).length, 0), venues = new Set(records.map((record) => record.venue)).size;
  return `<section class="cm-v58-kpis"><article><span>Periodo</span><b>${eraLabel(filters.era)}</b><small>${selectedTournaments.length} torneo${selectedTournaments.length === 1 ? '' : 's'}</small></article><article><span>Partidos</span><b>${records.length}</b><small>${records.filter((record) => record.phase === 'final').length} finales</small></article><article><span>Goles</span><b>${goals}</b><small>${format(records.length ? goals / records.length : 0)} por partido</small></article><article><span>Tarjetas</span><b>${cards}</b><small>${format(records.length ? cards / records.length : 0)} por partido</small></article><article><span>Sedes</span><b>${venues}</b><small>escenarios utilizados</small></article><article><span>Filtro activo</span><b>${filters.team === 'all' ? 'Global' : esc(teamName(filters.team))}</b><small>${filters.phase === 'all' ? 'Todas las fases' : filters.phase}</small></article></section>`;
}
function ensureShell() {
  const page = document.getElementById('estadisticas'); if (!page) return null;
  let switcher = document.getElementById('cmV58ModeSwitch'); if (!switcher) { switcher = document.createElement('nav'); switcher.id = 'cmV58ModeSwitch'; switcher.className = 'cm-v58-mode-switch'; switcher.innerHTML = '<button type="button" data-cm-v58-mode="standard" class="active">Estadísticas</button><button type="button" data-cm-v58-mode="analysis">Análisis histórico <span>Nuevo</span></button>'; page.querySelector('.page-title')?.insertAdjacentElement('afterend', switcher); }
  let root = document.getElementById('cmV58AnalysisRoot'); if (!root) { root = document.createElement('section'); root.id = 'cmV58AnalysisRoot'; root.className = 'cm-v58-analysis-root'; root.hidden = true; switcher.insertAdjacentElement('afterend', root); }
  return { page, switcher, root, standard: document.getElementById('cmStatsCenter') };
}
function applyMode() { const shell = ensureShell(); if (!shell) return; shell.switcher.querySelectorAll('[data-cm-v58-mode]').forEach((button) => button.classList.toggle('active', button.dataset.cmV58Mode === mode)); if (shell.standard) shell.standard.hidden = mode === 'analysis'; shell.root.hidden = mode !== 'analysis'; }
function render() {
  if (rendering) return; rendering = true;
  try {
    const shell = ensureShell(); if (!shell) return; applyMode(); if (mode !== 'analysis') return;
    const candidates = orderedTournaments().filter((tournament) => filters.era === 'all' || tournamentEra(tournament) === filters.era), selectedTournaments = tournamentsForFilters(), records = filteredRecords();
    const signature = JSON.stringify({ mode, filters, compare, tournaments: selectedTournaments.map((tournament) => [tournament.id, tournament.name, tournament.type, tournament.champion, tournament.runnerUp, tournament.third]), matches: records.map((record) => [record.tournament.id, record.match.id, record.match.homeGoals, record.match.awayGoals, record.match.homePens, record.match.awayPens, record.match.venue, record.match.goals?.length, record.match.cards?.length]) });
    if (signature === lastSignature && shell.root.children.length) return; lastSignature = signature;
    const allRecordsForOptions = allPlayedRecords(candidates), snapshots = rankingEvolution(selectedTournaments);
    shell.root.innerHTML = `${filterMarkup(candidates, allRecordsForOptions)}${overviewMarkup(records, selectedTournaments)}<section class="cm-v58-panel cm-v58-ranking"><header><div><p class="eyebrow">EVOLUCIÓN FIFA</p><h2>Evolución del Ranking FIFA Chute</h2><p>Puntos acumulados después de cada torneo, con ponderación de liga, Play-Off, final y bonificaciones por podio.</p></div><span>${snapshots.length} cortes históricos</span></header>${rankingChart(snapshots)}</section>${comparatorMarkup(records, selectedTournaments)}${matrixMarkup(records)}${decisiveMarkup(records)}${venueAndMinuteMarkup(records)}`;
    for (const [key, value] of Object.entries(filters)) { const select = shell.root.querySelector(`[data-cm-v58-filter="${key}"]`); if (select) select.value = value; }
  } finally { rendering = false; }
}
function refresh() { lastSignature = ''; render(); }
document.addEventListener('click', (event) => { const modeButton = event.target.closest('[data-cm-v58-mode]'); if (modeButton) { mode = modeButton.dataset.cmV58Mode; lastSignature = ''; render(); return; } if (event.target.closest('[data-cm-v58-reset]')) { Object.assign(filters, { era: 'all', tournament: 'all', team: 'all', division: 'all', phase: 'all', venue: 'all' }); lastSignature = ''; render(); } });
document.addEventListener('change', (event) => { const filter = event.target.closest('[data-cm-v58-filter]'); if (filter) { filters[filter.dataset.cmV58Filter] = filter.value; if (filter.dataset.cmV58Filter === 'era') filters.tournament = 'all'; lastSignature = ''; render(); return; } const compareSelect = event.target.closest('[data-cm-v58-compare]'); if (compareSelect) { compare[compareSelect.dataset.cmV58Compare] = compareSelect.value; if (compare.left === compare.right) { const alternative = teams().find((team) => team.id !== compare.left); compare[compareSelect.dataset.cmV58Compare === 'left' ? 'right' : 'left'] = alternative?.id || ''; } lastSignature = ''; render(); } });
document.addEventListener('click', (event) => { if (event.target.closest('[data-page="estadisticas"]')) window.setTimeout(() => { ensureShell(); applyMode(); render(); }, 80); });
document.addEventListener('submit', () => window.setTimeout(refresh, 350));
if (runtime?.register) runtime.register('analysis-v58', () => render()); else window.setInterval(render, 1200);
ensureShell(); applyMode(); render();
window.ChuteAnalysisV58 = { filters, compare, tournamentEra, allPlayedRecords, filteredRecords, rankingEvolution, teamStats, headToHead, decisiveAnalysis, venueAnalysis, minuteAnalysis, setMode(value) { mode = value === 'analysis' ? 'analysis' : 'standard'; refresh(); }, refresh };
