const core = window.ChuteMundoCore;
if (!core) throw new Error('Chute Mundo no está listo para Estadísticas v5.19.');

const VERSION = '5.19.0';
const ERA_LEAGUES = 'leagues';
const ERA_DIVISIONS = 'divisions';
const CUTOFF_NAME = '8vo Torneo - Copa';
const TABS = [
  ['summary', 'Resumen'],
  ['teams', 'Equipos'],
  ['scorers', 'Goleadores'],
  ['assists', 'Asistencias'],
  ['keepers', 'Portería imbatida'],
  ['tournaments', 'Torneos'],
  ['analysis', 'Análisis histórico']
];
const model = window.ChuteDetailModel || {};
const esc = model.esc || ((value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])));
const norm = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const playerName = (entry) => Array.isArray(entry) ? String(entry[0] || '') : String(entry?.name || '');
const playerPosition = (entry) => Array.isArray(entry) ? String(entry[1] || '') : String(entry?.position || entry?.role || '');
const logoUrl = (teamId) => model.logoUrl?.(teamId) || '';
const photo = (teamId, name, className = '') => model.photo?.(teamId, name, className) || `<span class="cm-v519-avatar ${className}">${esc(String(name || '?').slice(0, 1).toUpperCase())}</span>`;
const matchPlayed = (match) => core.matchPlayed?.(match) ?? (match?.homeGoals !== null && match?.awayGoals !== null);
const teamName = (teamId) => core.teamName?.(teamId) || teamId || 'Por definir';
const state = () => core.getState();
let selectedTab = localStorage.getItem('cm_v519_stats_tab') || 'summary';
let selectedEra = localStorage.getItem('cm_v519_stats_era') || 'all';
let selectedTournament = localStorage.getItem('cm_v519_stats_tournament') || 'all';
let selectedTeam = localStorage.getItem('cm_v519_stats_team') || 'all';
let refreshQueued = false;
let rendering = false;
let migrating = false;
let lastSavedMigration = '';

function orderedTournaments(source = state()) {
  return (source.tournaments || []).map((tournament, index) => ({ tournament, index })).sort((a, b) => {
    const left = numeric(a.tournament.createdAt || a.tournament.startDate || 0);
    const right = numeric(b.tournament.createdAt || b.tournament.startDate || 0);
    if (left && right && left !== right) return left - right;
    return a.index - b.index;
  }).map((row) => row.tournament);
}

function cutoffIndex(source = state()) {
  const target = norm(CUTOFF_NAME);
  return orderedTournaments(source).findIndex((tournament) => norm(tournament.name) === target || norm(tournament.name).includes(target));
}

function eraOf(tournament, index = -1, source = state()) {
  if ([ERA_LEAGUES, ERA_DIVISIONS].includes(tournament?.eraId)) return tournament.eraId;
  const ordered = orderedTournaments(source);
  const resolvedIndex = index >= 0 ? index : ordered.findIndex((item) => item.id === tournament?.id);
  const cutoff = cutoffIndex(source);
  if (cutoff >= 0 && resolvedIndex >= 0) return resolvedIndex <= cutoff ? ERA_LEAGUES : ERA_DIVISIONS;
  return String(tournament?.type || '').startsWith('division') || /division/.test(norm(tournament?.name)) ? ERA_DIVISIONS : ERA_LEAGUES;
}

function matchRows(tournaments) {
  return tournaments.flatMap((tournament) => (tournament.matches || []).filter((match) => match?.stage !== 'bye' && matchPlayed(match)).map((match) => ({
    tournament,
    match,
    home: match.home || core.resolveHome?.(tournament, match),
    away: match.away || core.resolveAway?.(tournament, match)
  }))).filter((row) => row.home && row.away);
}

function winnerId(row) {
  const homeGoals = numeric(row.match.homeGoals);
  const awayGoals = numeric(row.match.awayGoals);
  if (homeGoals > awayGoals) return row.home;
  if (awayGoals > homeGoals) return row.away;
  if (numeric(row.match.homePens) > numeric(row.match.awayPens)) return row.home;
  if (numeric(row.match.awayPens) > numeric(row.match.homePens)) return row.away;
  return null;
}

function filteredTournaments(source = state()) {
  let rows = orderedTournaments(source);
  if (selectedEra !== 'all') rows = rows.filter((tournament, index) => eraOf(tournament, index, source) === selectedEra);
  if (selectedTournament !== 'all') rows = rows.filter((tournament) => tournament.id === selectedTournament);
  return rows;
}

function tournamentMetricRows(tournament, kind) {
  const field = kind === 'goals' ? 'playerScorers' : 'playerAssists';
  const raw = tournament?.[field];
  const sourceRows = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.values(raw) : [];
  const rows = new Map();
  for (const entry of sourceRows) {
    let name = '';
    let teamId = '';
    let appearances = 0;
    let value = 0;
    if (Array.isArray(entry)) {
      [name, teamId, appearances, value] = entry;
      if (value === undefined) value = appearances;
    } else if (entry && typeof entry === 'object') {
      name = entry.name ?? entry.playerName ?? entry.player ?? entry.scorer ?? entry.assist ?? '';
      teamId = entry.teamId ?? entry.team ?? entry.clubId ?? entry.club ?? '';
      appearances = entry.appearances ?? entry.matches ?? entry.games ?? entry.pj ?? 0;
      value = kind === 'goals' ? (entry.goals ?? entry.value ?? entry.total ?? entry.count ?? 0) : (entry.assists ?? entry.value ?? entry.total ?? entry.count ?? 0);
    }
    name = String(name || '').trim();
    teamId = resolveTeamId(teamId, name);
    if (!name || !teamId) continue;
    rows.set(`${teamId}__${norm(name)}`, { teamId, name, appearances: numeric(appearances), value: numeric(value) });
  }
  const detailed = new Map();
  for (const row of matchRows([tournament])) {
    const goals = Array.isArray(row.match.goals) ? row.match.goals : [];
    for (const goal of goals) {
      const name = kind === 'goals' ? goal.playerName : goal.assistName;
      const teamId = goal.teamId || (goal.side === 'away' ? row.away : row.home);
      if (!name || !teamId || (kind === 'assists' && /sin asistencia/i.test(name))) continue;
      const key = `${teamId}__${norm(name)}`;
      const current = detailed.get(key) || { teamId, name, appearances: 0, value: 0 };
      current.value += 1;
      detailed.set(key, current);
    }
  }
  for (const [key, detail] of detailed) {
    const current = rows.get(key);
    if (!current) rows.set(key, detail);
    else current.value = Math.max(current.value, detail.value);
  }
  return [...rows.values()];
}

function resolveTeamId(value, name = '', source = state()) {
  const token = String(value || '').trim();
  const direct = (source.teams || []).find((team) => team.id === token || norm(team.id) === norm(token) || norm(team.name) === norm(token));
  if (direct) return direct.id;
  const candidates = (source.teams || []).filter((team) => {
    const roster = Array.isArray(team.players) ? team.players : team.players && typeof team.players === 'object' ? Object.values(team.players) : [];
    return roster.some((entry) => norm(playerName(entry)) === norm(name));
  });
  return candidates.length === 1 ? candidates[0].id : '';
}

function rankingRows(tournaments, kind, source = state()) {
  const map = new Map();
  for (const tournament of tournaments) {
    for (const row of tournamentMetricRows(tournament, kind)) {
      if (selectedTeam !== 'all' && row.teamId !== selectedTeam) continue;
      const key = `${row.teamId}__${norm(row.name)}`;
      const current = map.get(key) || { teamId: row.teamId, name: row.name, value: 0, appearances: 0, tournaments: new Set() };
      current.value += row.value;
      current.appearances = Math.max(current.appearances, row.appearances);
      current.tournaments.add(tournament.id);
      map.set(key, current);
    }
  }
  return [...map.values()].filter((row) => row.value > 0).sort((a, b) => b.value - a.value || b.tournaments.size - a.tournaments.size || a.name.localeCompare(b.name, 'es'));
}

function teamRows(tournaments, source = state()) {
  const map = new Map((source.teams || []).map((team) => [team.id, { teamId: team.id, titles: 0, runners: 0, thirds: 0, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, penWins: 0 }]));
  for (const tournament of tournaments) {
    if (map.has(tournament.champion)) map.get(tournament.champion).titles += 1;
    if (map.has(tournament.runnerUp)) map.get(tournament.runnerUp).runners += 1;
    if (map.has(tournament.third)) map.get(tournament.third).thirds += 1;
    for (const row of matchRows([tournament])) {
      const home = map.get(row.home);
      const away = map.get(row.away);
      if (!home || !away) continue;
      const hg = numeric(row.match.homeGoals);
      const ag = numeric(row.match.awayGoals);
      home.pj += 1; away.pj += 1;
      home.gf += hg; home.gc += ag; away.gf += ag; away.gc += hg;
      if (hg > ag) { home.pg += 1; away.pp += 1; }
      else if (ag > hg) { away.pg += 1; home.pp += 1; }
      else {
        home.pe += 1; away.pe += 1;
        const winner = winnerId(row);
        if (winner && map.has(winner)) map.get(winner).penWins += 1;
      }
    }
  }
  return [...map.values()].filter((row) => row.pj || row.titles || row.runners || row.thirds).map((row) => ({
    ...row,
    dg: row.gf - row.gc,
    performance: row.pj ? ((row.pg * 3 + row.pe) / (row.pj * 3)) * 100 : 0
  })).filter((row) => selectedTeam === 'all' || row.teamId === selectedTeam).sort((a, b) => b.titles - a.titles || b.performance - a.performance || b.dg - a.dg);
}

function goalkeeperRows(tournaments, source = state()) {
  const modernTournaments = tournaments.filter((tournament, index) => eraOf(tournament, index, source) === ERA_DIVISIONS);
  const modernSource = { ...source, tournaments: modernTournaments, friendlies: [] };
  const api = window.ChuteV516EventsStats;
  if (!api?.playerStats) return [];
  const rows = [];
  for (const team of source.teams || []) {
    if (selectedTeam !== 'all' && team.id !== selectedTeam) continue;
    const roster = Array.isArray(team.players) ? team.players : team.players && typeof team.players === 'object' ? Object.values(team.players) : [];
    for (const entry of roster) {
      const name = playerName(entry);
      if (!name || !/arquero|portero/i.test(playerPosition(entry))) continue;
      const stats = api.playerStats(team.id, name, modernSource);
      if (!stats.appearances) continue;
      rows.push({
        teamId: team.id,
        name,
        appearances: numeric(stats.appearances),
        cleanSheets: numeric(stats.cleanSheets),
        goalsConceded: numeric(stats.goalsConceded),
        average: numeric(stats.goalsConcededAverage),
        wins: numeric(stats.wins),
        draws: numeric(stats.draws),
        losses: numeric(stats.losses),
        cleanSheetPct: stats.appearances ? numeric(stats.cleanSheets) / numeric(stats.appearances) * 100 : 0
      });
    }
  }
  return rows.sort((a, b) => b.cleanSheets - a.cleanSheets || b.cleanSheetPct - a.cleanSheetPct || a.average - b.average || a.name.localeCompare(b.name, 'es'));
}

function coverage(tournaments) {
  const played = matchRows(tournaments).length;
  const tracked = tournaments.reduce((sum, tournament) => sum + (tournament.matches || []).filter((match) => matchPlayed(match) && match.participationTracked).length, 0);
  const scorerTournaments = tournaments.filter((tournament) => tournamentMetricRows(tournament, 'goals').length).length;
  const assistTournaments = tournaments.filter((tournament) => tournamentMetricRows(tournament, 'assists').length).length;
  return { played, tracked, scorerTournaments, assistTournaments };
}

function table(headers, rows, empty = 'Sin datos para este filtro.') {
  return `<div class="cm-v519-table"><table><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td colspan="${headers.length}" class="cm-v519-empty-cell">${esc(empty)}</td></tr>`}</tbody></table></div>`;
}

function medal(index) {
  return index < 3 ? `<span class="cm-v519-rank is-${index + 1}">${index + 1}</span>` : `<span class="cm-v519-rank">${index + 1}</span>`;
}

function playerCell(row) {
  return `<button class="cm-v519-person" data-cm-v519-player="${esc(row.teamId)}__${encodeURIComponent(row.name)}">${photo(row.teamId, row.name, 'cm-v519-photo')}<span><b>${esc(row.name)}</b><small>${esc(teamName(row.teamId))}</small></span></button>`;
}

function teamCell(teamId) {
  const logo = logoUrl(teamId);
  return `<button class="cm-v519-person" data-cm-v519-team="${esc(teamId)}">${logo ? `<img class="cm-v519-logo" src="${esc(logo)}" alt="">` : `<span class="cm-v519-avatar">${esc(teamName(teamId).slice(0, 1))}</span>`}<span><b>${esc(teamName(teamId))}</b></span></button>`;
}

function summaryPanel(tournaments, source) {
  const matches = matchRows(tournaments);
  const goals = matches.reduce((sum, row) => sum + numeric(row.match.homeGoals) + numeric(row.match.awayGoals), 0);
  const teams = teamRows(tournaments, source);
  const scorers = rankingRows(tournaments, 'goals', source);
  const assists = rankingRows(tournaments, 'assists', source);
  const keepers = goalkeeperRows(tournaments, source);
  const data = coverage(tournaments);
  const topCards = [
    ['Goleador', scorers[0], scorers[0] ? `${scorers[0].value} goles` : '—', 'scorers'],
    ['Asistidor', assists[0], assists[0] ? `${assists[0].value} asistencias` : '—', 'assists'],
    ['Portería imbatida', keepers[0], keepers[0] ? `${keepers[0].cleanSheets} vallas invictas` : '—', 'keepers']
  ];
  return `<section class="cm-v519-panel active" data-cm-v519-panel="summary">
    <div class="cm-v519-hero-grid">
      <article class="cm-v519-hero-card"><span>Partidos</span><b>${matches.length}</b><small>${tournaments.length} torneos</small></article>
      <article class="cm-v519-hero-card"><span>Goles</span><b>${goals}</b><small>${matches.length ? (goals / matches.length).toFixed(2) : '0.00'} por partido</small></article>
      <article class="cm-v519-hero-card"><span>Más títulos</span><b>${esc(teams[0] ? teamName(teams[0].teamId) : '—')}</b><small>${teams[0]?.titles || 0} campeonatos</small></article>
      <article class="cm-v519-hero-card"><span>Datos detallados</span><b>${data.tracked}/${data.played}</b><small>partidos con alineación</small></article>
    </div>
    <div class="cm-v519-leaders">${topCards.map(([label, row, value, tab]) => `<article class="cm-v519-leader-card" data-cm-v519-go="${tab}"><div>${row ? photo(row.teamId, row.name, 'cm-v519-leader-photo') : '<span class="cm-v519-leader-photo cm-v519-placeholder">—</span>'}</div><span>${label}</span><b>${esc(row?.name || 'Sin registro')}</b><small>${esc(value)}</small><button type="button" data-cm-v519-tab-jump="${tab}">Ver tabla</button></article>`).join('')}</div>
    <article class="cm-v519-card cm-v519-coverage"><header><div><span class="cm-v519-kicker">COBERTURA</span><h2>Datos disponibles</h2></div></header><div><span><b>${tournaments.length}</b>Torneos</span><span><b>${data.scorerTournaments}</b>Con goleadores</span><span><b>${data.assistTournaments}</b>Con asistencias</span><span><b>${data.tracked}</b>Con alineaciones</span></div></article>
  </section>`;
}

function teamsPanel(tournaments, source) {
  const rows = teamRows(tournaments, source);
  return `<section class="cm-v519-panel" data-cm-v519-panel="teams"><article class="cm-v519-card"><header><div><span class="cm-v519-kicker">CLUBES</span><h2>Rendimiento</h2></div><span class="cm-v519-count">${rows.length}</span></header>${table(['#','Equipo','Títulos','Subc.','3.º','PJ','PG','PE','PP','Pen.','GF','GC','DG','Rend.'], rows.map((row, index) => `<tr><td>${medal(index)}</td><td>${teamCell(row.teamId)}</td><td><b>${row.titles}</b></td><td>${row.runners}</td><td>${row.thirds}</td><td>${row.pj}</td><td>${row.pg}</td><td>${row.pe}</td><td>${row.pp}</td><td>${row.penWins}</td><td>${row.gf}</td><td>${row.gc}</td><td>${row.dg > 0 ? '+' : ''}${row.dg}</td><td>${Math.round(row.performance)}%</td></tr>`))}</article></section>`;
}

function rankingPanel(tournaments, source, kind) {
  const rows = rankingRows(tournaments, kind, source);
  const isGoals = kind === 'goals';
  const title = isGoals ? 'Goleadores' : 'Asistencias';
  return `<section class="cm-v519-panel" data-cm-v519-panel="${isGoals ? 'scorers' : 'assists'}"><article class="cm-v519-card"><header><div><span class="cm-v519-kicker">JUGADORES</span><h2>${title}</h2></div><span class="cm-v519-count">${rows.length}</span></header>${table(['#','Jugador',isGoals ? 'Goles' : 'Asist.','Torneos con registro'], rows.map((row, index) => `<tr><td>${medal(index)}</td><td>${playerCell(row)}</td><td><strong class="cm-v519-value">${row.value}</strong></td><td>${row.tournaments.size}</td></tr>`), `No hay ${isGoals ? 'goleadores' : 'asistencias'} registrados para este filtro.`)}</article></section>`;
}

function keepersPanel(tournaments, source) {
  const rows = goalkeeperRows(tournaments, source);
  return `<section class="cm-v519-panel" data-cm-v519-panel="keepers"><article class="cm-v519-card"><header><div><span class="cm-v519-kicker">PORTEROS</span><h2>Portería imbatida</h2></div><span class="cm-v519-count">${rows.length}</span></header>${table(['#','Portero','PJ','Vallas inv.','% imbatida','GC','GC/PJ','G-E-P'], rows.map((row, index) => `<tr><td>${medal(index)}</td><td>${playerCell(row)}</td><td>${row.appearances}</td><td><strong class="cm-v519-value">${row.cleanSheets}</strong></td><td>${Math.round(row.cleanSheetPct)}%</td><td>${row.goalsConceded}</td><td>${row.average.toFixed(2)}</td><td>${row.wins}-${row.draws}-${row.losses}</td></tr>`), selectedEra === ERA_LEAGUES ? 'La portería imbatida se registra desde la Era de divisiones.' : 'No hay porteros con participación registrada para este filtro.')}</article></section>`;
}

function tournamentsPanel(tournaments) {
  const rows = [...tournaments].reverse();
  return `<section class="cm-v519-panel" data-cm-v519-panel="tournaments"><article class="cm-v519-card"><header><div><span class="cm-v519-kicker">COMPETENCIAS</span><h2>Torneos</h2></div><span class="cm-v519-count">${rows.length}</span></header>${table(['Torneo','Era','Estado','PJ','Goles','Campeón','Goleadores','Asistencias'], rows.map((tournament, index) => {
    const matches = matchRows([tournament]);
    const goals = matches.reduce((sum, row) => sum + numeric(row.match.homeGoals) + numeric(row.match.awayGoals), 0);
    const scorerCount = tournamentMetricRows(tournament, 'goals').length;
    const assistCount = tournamentMetricRows(tournament, 'assists').length;
    return `<tr><td><b>${esc(tournament.name || `Torneo ${index + 1}`)}</b></td><td><span class="cm-v519-era is-${eraOf(tournament, -1, state())}">${eraOf(tournament, -1, state()) === ERA_DIVISIONS ? 'Divisiones' : 'Ligas'}</span></td><td>${esc(tournament.status || '—')}</td><td>${matches.length}</td><td>${goals}</td><td>${esc(tournament.champion ? teamName(tournament.champion) : '—')}</td><td>${scorerCount ? scorerCount : 'Sin registro'}</td><td>${assistCount ? assistCount : 'Sin registro'}</td></tr>`;
  }))}</article></section>`;
}

function rankingEvolution(tournaments, source) {
  const totals = new Map((source.teams || []).map((team) => [team.id, 0]));
  const snapshots = [];
  for (const tournament of tournaments) {
    for (const row of matchRows([tournament])) {
      const hg = numeric(row.match.homeGoals);
      const ag = numeric(row.match.awayGoals);
      totals.set(row.home, numeric(totals.get(row.home)) + (hg > ag ? 3 : hg === ag ? 1 : 0));
      totals.set(row.away, numeric(totals.get(row.away)) + (ag > hg ? 3 : hg === ag ? 1 : 0));
    }
    if (tournament.champion && totals.has(tournament.champion)) totals.set(tournament.champion, totals.get(tournament.champion) + 8);
    if (tournament.runnerUp && totals.has(tournament.runnerUp)) totals.set(tournament.runnerUp, totals.get(tournament.runnerUp) + 4);
    snapshots.push({ tournament, rows: [...totals].map(([teamId, points]) => ({ teamId, points })).sort((a, b) => b.points - a.points) });
  }
  return snapshots;
}

function rankingChart(tournaments, source) {
  const snapshots = rankingEvolution(tournaments, source);
  if (!snapshots.length) return '<div class="cm-v519-empty">Sin evolución para este filtro.</div>';
  const teams = (source.teams || []).filter((team) => snapshots.some((snapshot) => snapshot.rows.some((row) => row.teamId === team.id && row.points > 0))).slice(0, 8);
  const width = 960;
  const height = 360;
  const left = 48;
  const top = 26;
  const bottom = 62;
  const usableWidth = width - left * 2;
  const usableHeight = height - top - bottom;
  const maximum = Math.max(1, ...snapshots.flatMap((snapshot) => snapshot.rows.map((row) => row.points)));
  const x = (index) => snapshots.length === 1 ? width / 2 : left + index * (usableWidth / (snapshots.length - 1));
  const y = (value) => top + usableHeight - value / maximum * usableHeight;
  const lines = teams.map((team, index) => {
    const points = snapshots.map((snapshot, snapshotIndex) => `${x(snapshotIndex)},${y(snapshot.rows.find((row) => row.teamId === team.id)?.points || 0)}`).join(' ');
    return `<polyline class="cm-v519-line line-${index}" points="${points}"><title>${esc(team.name)}</title></polyline>`;
  }).join('');
  const labels = snapshots.map((snapshot, index) => `<text x="${x(index)}" y="${height - 20}" transform="rotate(-22 ${x(index)} ${height - 20})">${esc(snapshot.tournament.name)}</text>`).join('');
  const grid = [0,.25,.5,.75,1].map((ratio) => `<line x1="${left}" y1="${y(maximum * ratio)}" x2="${width - left}" y2="${y(maximum * ratio)}"></line>`).join('');
  const legend = teams.map((team, index) => `<span class="line-${index}"><i></i>${esc(team.name)}</span>`).join('');
  return `<div class="cm-v519-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolución histórica">${grid}${lines}${labels}</svg></div><div class="cm-v519-legend">${legend}</div>`;
}

function headToHeadRows(tournaments, source) {
  const teams = teamRows(tournaments, source).map((row) => row.teamId);
  const records = matchRows(tournaments);
  const rows = [];
  for (let i = 0; i < teams.length; i += 1) {
    for (let j = i + 1; j < teams.length; j += 1) {
      const left = teams[i];
      const right = teams[j];
      const matches = records.filter((row) => (row.home === left && row.away === right) || (row.home === right && row.away === left));
      if (!matches.length) continue;
      let leftWins = 0, rightWins = 0, draws = 0, leftGoals = 0, rightGoals = 0;
      for (const row of matches) {
        const leftHome = row.home === left;
        const lg = numeric(leftHome ? row.match.homeGoals : row.match.awayGoals);
        const rg = numeric(leftHome ? row.match.awayGoals : row.match.homeGoals);
        leftGoals += lg; rightGoals += rg;
        if (lg > rg) leftWins += 1; else if (rg > lg) rightWins += 1; else draws += 1;
      }
      rows.push({ left, right, matches: matches.length, leftWins, rightWins, draws, leftGoals, rightGoals });
    }
  }
  return rows.sort((a, b) => b.matches - a.matches || (b.leftWins + b.rightWins) - (a.leftWins + a.rightWins));
}

function minuteRows(tournaments) {
  const buckets = [
    ['0–14',0,14],['15–29',15,29],['30–44',30,44],['45–59',45,59],['60–74',60,74],['75–89',75,89],['90+',90,999]
  ].map(([label,min,max]) => ({ label,min,max,value:0 }));
  for (const row of matchRows(tournaments)) {
    for (const goal of row.match.goals || []) {
      const minute = Number(String(goal.minute || '').match(/\d+/)?.[0]);
      if (!Number.isFinite(minute)) continue;
      const bucket = buckets.find((item) => minute >= item.min && minute <= item.max);
      if (bucket) bucket.value += 1;
    }
  }
  return buckets;
}

function venueRows(tournaments) {
  const map = new Map();
  for (const row of matchRows(tournaments)) {
    const venue = String(row.match.venue || '').trim() || 'Sin sede';
    const current = map.get(venue) || { venue, matches: 0, goals: 0, cards: 0 };
    current.matches += 1;
    current.goals += numeric(row.match.homeGoals) + numeric(row.match.awayGoals);
    current.cards += (row.match.cards || []).length;
    map.set(venue, current);
  }
  return [...map.values()].sort((a, b) => b.matches - a.matches || a.venue.localeCompare(b.venue, 'es'));
}

function analysisPanel(tournaments, source) {
  const h2h = headToHeadRows(tournaments, source).slice(0, 12);
  const minutes = minuteRows(tournaments);
  const maximum = Math.max(1, ...minutes.map((row) => row.value));
  const venues = venueRows(tournaments);
  const records = matchRows(tournaments);
  const biggest = [...records].sort((a, b) => Math.abs(numeric(b.match.homeGoals) - numeric(b.match.awayGoals)) - Math.abs(numeric(a.match.homeGoals) - numeric(a.match.awayGoals)))[0];
  const highest = [...records].sort((a, b) => numeric(b.match.homeGoals) + numeric(b.match.awayGoals) - numeric(a.match.homeGoals) - numeric(a.match.awayGoals))[0];
  return `<section class="cm-v519-panel" data-cm-v519-panel="analysis">
    <div class="cm-v519-analysis-grid">
      <article class="cm-v519-card cm-v519-wide"><header><div><span class="cm-v519-kicker">EVOLUCIÓN</span><h2>Ranking histórico</h2></div></header>${rankingChart(tournaments, source)}</article>
      <article class="cm-v519-card"><header><div><span class="cm-v519-kicker">RÉCORD</span><h2>Mayor diferencia</h2></div></header><div class="cm-v519-record">${biggest ? `<b>${esc(teamName(biggest.home))} ${numeric(biggest.match.homeGoals)}–${numeric(biggest.match.awayGoals)} ${esc(teamName(biggest.away))}</b><span>${esc(biggest.tournament.name)}</span>` : '<b>—</b>'}</div></article>
      <article class="cm-v519-card"><header><div><span class="cm-v519-kicker">RÉCORD</span><h2>Más goles</h2></div></header><div class="cm-v519-record">${highest ? `<b>${esc(teamName(highest.home))} ${numeric(highest.match.homeGoals)}–${numeric(highest.match.awayGoals)} ${esc(teamName(highest.away))}</b><span>${esc(highest.tournament.name)}</span>` : '<b>—</b>'}</div></article>
      <article class="cm-v519-card cm-v519-wide"><header><div><span class="cm-v519-kicker">ENFRENTAMIENTOS</span><h2>Más repetidos</h2></div></header>${table(['Cruce','PJ','Victorias','Empates','Goles'], h2h.map((row) => `<tr><td>${esc(teamName(row.left))} vs ${esc(teamName(row.right))}</td><td>${row.matches}</td><td>${row.leftWins}–${row.rightWins}</td><td>${row.draws}</td><td>${row.leftGoals}–${row.rightGoals}</td></tr>`), 'Sin enfrentamientos para este filtro.')}</article>
      <article class="cm-v519-card"><header><div><span class="cm-v519-kicker">MINUTOS</span><h2>Goles por tramo</h2></div></header><div class="cm-v519-bars">${minutes.map((row) => `<div><span>${row.label}</span><i><b style="width:${Math.round(row.value / maximum * 100)}%"></b></i><strong>${row.value}</strong></div>`).join('')}</div></article>
      <article class="cm-v519-card"><header><div><span class="cm-v519-kicker">SEDES</span><h2>Escenarios</h2></div></header>${table(['Sede','PJ','Goles','G/PJ','Tarjetas'], venues.map((row) => `<tr><td>${esc(row.venue)}</td><td>${row.matches}</td><td>${row.goals}</td><td>${(row.goals / row.matches).toFixed(2)}</td><td>${row.cards}</td></tr>`), 'Sin sedes registradas.')}</article>
    </div>
  </section>`;
}

function filterOptions(source) {
  const tournaments = orderedTournaments(source).filter((tournament, index) => selectedEra === 'all' || eraOf(tournament, index, source) === selectedEra);
  const teams = source.teams || [];
  return {
    tournaments: tournaments.map((tournament) => `<option value="${esc(tournament.id)}" ${selectedTournament === tournament.id ? 'selected' : ''}>${esc(tournament.name)}</option>`).join(''),
    teams: teams.map((team) => `<option value="${esc(team.id)}" ${selectedTeam === team.id ? 'selected' : ''}>${esc(team.name)}</option>`).join('')
  };
}

function renderShell() {
  if (rendering) return;
  rendering = true;
  try {
    const page = document.getElementById('estadisticas');
    if (!page) return;
    const source = state();
    const tournaments = filteredTournaments(source);
    if (selectedTournament !== 'all' && !(source.tournaments || []).some((tournament) => tournament.id === selectedTournament)) selectedTournament = 'all';
    if (selectedTeam !== 'all' && !(source.teams || []).some((team) => team.id === selectedTeam)) selectedTeam = 'all';
    page.hidden = false;
    [...page.children].forEach((child) => {
      if (child.id === 'cmV519Stats' || child.classList.contains('page-title')) return;
      child.hidden = true;
      child.setAttribute('aria-hidden', 'true');
      child.style.setProperty('display', 'none', 'important');
    });
    const title = page.querySelector('.page-title');
    if (title) title.innerHTML = '<p class="eyebrow">RENDIMIENTO</p><h1>Estadísticas</h1><p>Historia, rankings y rendimiento.</p>';
    let host = document.getElementById('cmV519Stats');
    if (!host) {
      host = document.createElement('div');
      host.id = 'cmV519Stats';
      title?.insertAdjacentElement('afterend', host);
    }
    const options = filterOptions(source);
    const signature = JSON.stringify({ selectedTab, selectedEra, selectedTournament, selectedTeam, tournaments: tournaments.map((tournament) => [tournament.id, tournament.eraId, tournament.status, tournament.champion, tournament.runnerUp, tournament.third, tournament.playerScorers, tournament.playerAssists, (tournament.matches || []).map((match) => [match.id, match.homeGoals, match.awayGoals, match.homePens, match.awayPens, match.venue, match.participationTracked, match.lineups, match.goals, match.cards])]), teams: (source.teams || []).map((team) => [team.id, team.name, team.players]) });
    if (host.dataset.signature === signature) { activateTab(selectedTab); return; }
    host.dataset.signature = signature;
    host.innerHTML = `<section class="cm-v519-toolbar"><div class="cm-v519-toolbar-head"><div><span>FILTROS</span><b>${selectedEra === 'all' ? 'Toda la historia' : selectedEra === ERA_DIVISIONS ? 'Era de divisiones' : 'Era de ligas'}</b></div><button type="button" data-cm-v519-reset>Restablecer</button></div><div class="cm-v519-filters"><label>Periodo<select data-cm-v519-filter="era"><option value="all" ${selectedEra === 'all' ? 'selected' : ''}>General</option><option value="${ERA_LEAGUES}" ${selectedEra === ERA_LEAGUES ? 'selected' : ''}>Era de ligas</option><option value="${ERA_DIVISIONS}" ${selectedEra === ERA_DIVISIONS ? 'selected' : ''}>Era de divisiones</option></select></label><label>Torneo<select data-cm-v519-filter="tournament"><option value="all">Todos los torneos</option>${options.tournaments}</select></label><label>Equipo<select data-cm-v519-filter="team"><option value="all">Todos los equipos</option>${options.teams}</select></label></div><nav class="cm-v519-tabs" aria-label="Secciones estadísticas">${TABS.map(([id, label]) => `<button type="button" data-cm-v519-tab="${id}" class="${selectedTab === id ? 'active' : ''}">${label}</button>`).join('')}</nav></section><div class="cm-v519-content">${summaryPanel(tournaments, source)}${teamsPanel(tournaments, source)}${rankingPanel(tournaments, source, 'goals')}${rankingPanel(tournaments, source, 'assists')}${keepersPanel(tournaments, source)}${tournamentsPanel(tournaments)}${analysisPanel(tournaments, source)}</div>`;
    activateTab(selectedTab);
    document.getElementById('cmV581StatsStatus')?.remove();
  } finally {
    rendering = false;
  }
}

function activateTab(tab) {
  selectedTab = TABS.some(([id]) => id === tab) ? tab : 'summary';
  localStorage.setItem('cm_v519_stats_tab', selectedTab);
  document.querySelectorAll('#cmV519Stats [data-cm-v519-tab]').forEach((button) => button.classList.toggle('active', button.dataset.cmV519Tab === selectedTab));
  document.querySelectorAll('#cmV519Stats [data-cm-v519-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.cmV519Panel === selectedTab));
}

function migrateEras() {
  if (migrating) return;
  const source = state();
  const ordered = orderedTournaments(source);
  const next = JSON.parse(JSON.stringify(source));
  let changed = false;
  next.config = { ...(next.config || {}), statsEraSchema: 'era-stats-v2', statsEraCutoffName: CUTOFF_NAME, defaultEraId: ERA_DIVISIONS, statsCompleteFromEra: ERA_DIVISIONS };
  (next.tournaments || []).forEach((tournament, index) => {
    const planned = eraOf(tournament, index, next);
    if (tournament.eraId !== planned) { tournament.eraId = planned; changed = true; }
  });
  const signature = JSON.stringify((next.tournaments || []).map((tournament) => [tournament.id, tournament.eraId]));
  if (!changed || lastSavedMigration === signature) return;
  migrating = true;
  lastSavedMigration = signature;
  try {
    core.setState(next);
    core.persistLocal?.();
    if (core.isAdmin?.() && core.cloudLoaded) void core.saveCloud?.();
  } finally {
    migrating = false;
  }
}

function installStyles() {
  if (document.getElementById('cmV519Styles')) return;
  const link = document.createElement('link');
  link.id = 'cmV519Styles';
  link.rel = 'stylesheet';
  link.href = `/chute-v519-stats.css?v=${VERSION}`;
  document.head.appendChild(link);
}

function refresh() {
  refreshQueued = false;
  migrateEras();
  renderShell();
  document.title = 'Chute Mundo v5.19 · Estadísticas';
  document.querySelector('.hero .eyebrow')?.replaceChildren('CHUTE MUNDO v5.19');
}

function scheduleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(refresh);
}

document.addEventListener('click', (event) => {
  const tab = event.target.closest?.('[data-cm-v519-tab],[data-cm-v519-tab-jump]');
  if (tab) {
    event.preventDefault();
    activateTab(tab.dataset.cmV519Tab || tab.dataset.cmV519TabJump);
  }
  if (event.target.closest?.('[data-cm-v519-reset]')) {
    selectedEra = 'all'; selectedTournament = 'all'; selectedTeam = 'all';
    localStorage.setItem('cm_v519_stats_era', selectedEra);
    localStorage.setItem('cm_v519_stats_tournament', selectedTournament);
    localStorage.setItem('cm_v519_stats_team', selectedTeam);
    renderShell();
  }
  const team = event.target.closest?.('[data-cm-v519-team]');
  if (team) {
    core.navigate?.('equipos');
    window.ChuteV59?.openTeamProfile?.(team.dataset.cmV519Team);
  }
  const player = event.target.closest?.('[data-cm-v519-player]');
  if (player) {
    core.navigate?.('equipos');
    window.ChuteV59?.openPlayerProfile?.(player.dataset.cmV519Player);
  }
  if (event.target.closest?.('[data-page="estadisticas"],[data-cm-page="estadisticas"],[data-cm-mobile-page="estadisticas"]')) setTimeout(scheduleRefresh, 0);
}, true);

document.addEventListener('change', (event) => {
  const filter = event.target.closest?.('[data-cm-v519-filter]');
  if (!filter) return;
  if (filter.dataset.cmV519Filter === 'era') {
    selectedEra = filter.value;
    selectedTournament = 'all';
    localStorage.setItem('cm_v519_stats_era', selectedEra);
    localStorage.setItem('cm_v519_stats_tournament', selectedTournament);
  }
  if (filter.dataset.cmV519Filter === 'tournament') {
    selectedTournament = filter.value;
    localStorage.setItem('cm_v519_stats_tournament', selectedTournament);
  }
  if (filter.dataset.cmV519Filter === 'team') {
    selectedTeam = filter.value;
    localStorage.setItem('cm_v519_stats_team', selectedTeam);
  }
  renderShell();
}, true);

document.addEventListener('submit', () => setTimeout(scheduleRefresh, 350));
const statisticsPage = document.getElementById('estadisticas');
if (statisticsPage) new MutationObserver(() => { if (!statisticsPage.hidden) scheduleRefresh(); }).observe(statisticsPage, { attributes: true, attributeFilter: ['hidden'] });
installStyles();
scheduleRefresh();

window.ChuteV519Stats = { version: VERSION, refresh, renderShell, activateTab, eraOf, rankingRows, goalkeeperRows, teamRows };
window.ChuteV518EraStats = { version: VERSION, renderShell };
