const core = window.ChuteMundoCore;
if (!core) throw new Error('Chute Mundo no está listo para el Archivo Histórico v5.21.');

const VERSION = window.CHUTE_APP_VERSION || '6.0.2';
const ERA_LEAGUES = 'leagues';
const ERA_DIVISIONS = 'divisions';
const CUTOFF_NAME = '8vo Torneo - Copa';
const TABS = [
  ['eternal', 'La Tabla Eterna', 'Clasificación histórica acumulada'],
  ['rankings', 'Rankings Históricos', 'Goles, asistencias y arqueros'],
  ['honours', 'Salón de la Gloria', 'Palmarés de equipos y jugadores'],
  ['archive', 'Archivo de Campeones', 'Registro oficial de torneos'],
  ['records', 'Libro de Récords', 'Hitos y marcas históricas'],
  ['h2h', 'Historia Frente a Frente', 'Rivalidades entre equipos']
];
const RANKING_TABS = [
  ['goals', 'Grandes Artilleros', 'Goleadores históricos'],
  ['assists', 'Arquitectos del Gol', 'Asistidores históricos'],
  ['keepers', 'El Muro Histórico', 'Porterías imbatidas']
];
const AWARD_LABELS = {
  scorer: 'Bota de Oro',
  assist: 'Maestro de Asistencias',
  mvp: 'Balón de Oro del Torneo',
  goalkeeper: 'Guante de Oro',
  revelation: 'Revelación del Torneo',
  finalMvp: 'Figura de la Final'
};
const FORMAT_LABELS = {
  all: 'Todos los formatos',
  league: 'Ligas',
  cup: 'Copas',
  playoff: 'Play-Off',
  division: 'Divisiones',
  other: 'Otros'
};
const STATUS_LABELS = {
  all: 'Todos los estados',
  historical: 'Finalizados',
  active: 'En juego',
  upcoming: 'Próximos'
};

const model = window.ChuteDetailModel || {};
const esc = model.esc || ((value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])));
const norm = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const playerName = (entry) => Array.isArray(entry) ? String(entry[0] || '') : String(entry?.name || entry?.playerName || '');
const playerPosition = (entry) => Array.isArray(entry) ? String(entry[1] || '') : String(entry?.position || entry?.role || '');
const isGoalkeeper = (entry) => /arquero|portero|goalkeeper|keeper|gk/i.test(playerPosition(entry));
const matchPlayed = (match) => core.matchPlayed?.(match) ?? (match?.homeGoals !== null && match?.homeGoals !== '' && match?.awayGoals !== null && match?.awayGoals !== '');
const state = () => core.getState?.() || { teams: [], tournaments: [] };
const teamById = (teamId, source = state()) => (source.teams || []).find((team) => team.id === teamId) || null;
const teamName = (teamId, source = state()) => teamById(teamId, source)?.name || core.teamName?.(teamId) || teamId || 'Por definir';
const logoUrl = (teamId) => model.logoUrl?.(teamId) || '';
const photo = (teamId, name, className = '') => model.photo?.(teamId, name, className) || `<span class="cm-v521-avatar ${className}">${esc(String(name || '?').slice(0, 1).toUpperCase())}</span>`;
const clone = (value) => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));

const storage = {
  tab: 'cm_v521_tab',
  ranking: 'cm_v521_ranking',
  era: 'cm_v521_era',
  tournament: 'cm_v521_tournament',
  format: 'cm_v521_format',
  status: 'cm_v521_status',
  team: 'cm_v521_team',
  h2hA: 'cm_v521_h2h_a',
  h2hB: 'cm_v521_h2h_b'
};
const localGet = (key, fallback) => {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
};
const localSet = (key, value) => {
  try { localStorage.setItem(key, value); } catch {}
};

let selectedTab = localGet(storage.tab, 'eternal');
let selectedRanking = localGet(storage.ranking, 'goals');
let selectedEra = localGet(storage.era, 'all');
let selectedTournament = localGet(storage.tournament, 'all');
let selectedFormat = localGet(storage.format, 'all');
let selectedStatus = localGet(storage.status, 'all');
let selectedTeam = localGet(storage.team, 'all');
let selectedH2HA = localGet(storage.h2hA, '');
let selectedH2HB = localGet(storage.h2hB, '');
let rendering = false;
let refreshQueued = false;

function parseChronology(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value) return null;
  const timestamp = Date.parse(String(value));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function orderedTournaments(source = state()) {
  return (source.tournaments || []).map((tournament, index) => ({
    tournament,
    index,
    time: parseChronology(tournament.createdAt || tournament.startDate || tournament.date)
  })).sort((left, right) => {
    if (left.time !== null && right.time !== null && left.time !== right.time) return left.time - right.time;
    return left.index - right.index;
  }).map((row) => row.tournament);
}

function cutoffIndex(source = state()) {
  const target = norm(CUTOFF_NAME);
  return orderedTournaments(source).findIndex((tournament) => {
    const name = norm(tournament?.name);
    return name === target || name.includes(target);
  });
}

function eraOf(tournament, source = state()) {
  if ([ERA_LEAGUES, ERA_DIVISIONS].includes(tournament?.eraId)) return tournament.eraId;
  const ordered = orderedTournaments(source);
  const index = ordered.findIndex((item) => item.id === tournament?.id);
  const cutoff = cutoffIndex(source);
  if (cutoff >= 0 && index >= 0) return index <= cutoff ? ERA_LEAGUES : ERA_DIVISIONS;
  return String(tournament?.type || '').startsWith('division') || /division/.test(norm(tournament?.name)) ? ERA_DIVISIONS : ERA_LEAGUES;
}

function formatGroup(tournament) {
  const type = norm(tournament?.type);
  const name = norm(tournament?.name);
  if (type.includes('division') || name.includes('division')) return 'division';
  if (type.includes('cup') || type.includes('knockout') || name.includes('copa')) return 'cup';
  if (type.includes('playoff') || name.includes('play off') || name.includes('playoff')) return 'playoff';
  if (type.includes('league') || name.includes('liga')) return 'league';
  return 'other';
}

function statusGroup(tournament) {
  if (tournament?.status === 'historical' || tournament?.champion) return 'historical';
  if (tournament?.status === 'active') return 'active';
  return 'upcoming';
}

function tournamentHasTeam(tournament, teamId) {
  if (!teamId || teamId === 'all') return true;
  if ([tournament?.champion, tournament?.runnerUp, tournament?.third].includes(teamId)) return true;
  if ((tournament?.teamIds || tournament?.teams || []).includes(teamId)) return true;
  return (tournament?.matches || []).some((match) => [match?.home, match?.away, match?.homeTeamId, match?.awayTeamId].includes(teamId));
}

function filteredTournaments(source = state(), { ignoreTeam = false } = {}) {
  let rows = orderedTournaments(source);
  if (selectedEra !== 'all') rows = rows.filter((tournament) => eraOf(tournament, source) === selectedEra);
  if (selectedTournament !== 'all') rows = rows.filter((tournament) => tournament.id === selectedTournament);
  if (selectedFormat !== 'all') rows = rows.filter((tournament) => formatGroup(tournament) === selectedFormat);
  if (selectedStatus !== 'all') rows = rows.filter((tournament) => statusGroup(tournament) === selectedStatus);
  if (!ignoreTeam && selectedTeam !== 'all') rows = rows.filter((tournament) => tournamentHasTeam(tournament, selectedTeam));
  return rows;
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
function resolveMatchTeam(tournament, match, side) {
  const direct = match?.[side];
  if (direct) return direct;
  return side === 'home' ? core.resolveHome?.(tournament, match) : core.resolveAway?.(tournament, match);
}

function matchRows(tournaments) {
  return tournaments.flatMap((tournament) => {
    const matches = Array.isArray(tournament.matches) ? tournament.matches : [];
    return matches.filter((match) => match?.stage !== 'bye' && matchPlayed(match)).map((match, matchIndex) => ({
      tournament,
      match,
      matchIndex,
      home: resolveMatchTeam(tournament, match, 'home'),
      away: resolveMatchTeam(tournament, match, 'away')
    }));
  }).filter((row) => row.home && row.away);
}

function regulationResult(row, teamId) {
  const homeGoals = number(row.match.homeGoals);
  const awayGoals = number(row.match.awayGoals);
  if (homeGoals === awayGoals) return 'draw';
  const winner = homeGoals > awayGoals ? row.home : row.away;
  return winner === teamId ? 'win' : 'loss';
}

function winnerId(row) {
  const homeGoals = number(row.match.homeGoals);
  const awayGoals = number(row.match.awayGoals);
  if (homeGoals > awayGoals) return row.home;
  if (awayGoals > homeGoals) return row.away;
  if (number(row.match.homePens) > number(row.match.awayPens)) return row.home;
  if (number(row.match.awayPens) > number(row.match.homePens)) return row.away;
  const shootout = Array.isArray(row.match.penaltyShootout) ? row.match.penaltyShootout : [];
  if (shootout.length) {
    const homePens = shootout.filter((item) => item.side === 'home' && item.result === 'scored').length;
    const awayPens = shootout.filter((item) => item.side === 'away' && item.result === 'scored').length;
    if (homePens !== awayPens) return homePens > awayPens ? row.home : row.away;
  }
  return null;
}

function tournamentParticipants(tournament) {
  const ids = new Set([...(tournament?.teamIds || tournament?.teams || [])]);
  for (const row of matchRows([tournament])) {
    ids.add(row.home);
    ids.add(row.away);
  }
  [tournament?.champion, tournament?.runnerUp, tournament?.third].filter(Boolean).forEach((id) => ids.add(id));
  return ids;
}

function teamStandings(tournaments, source = state(), { respectTeam = true } = {}) {
  const map = new Map((source.teams || []).map((team) => [team.id, {
    teamId: team.id,
    tournaments: new Set(),
    titles: 0,
    runners: 0,
    thirds: 0,
    finals: 0,
    pj: 0,
    pg: 0,
    pe: 0,
    pp: 0,
    gf: 0,
    gc: 0,
    penWins: 0,
    cleanSheets: 0
  }]));

  for (const tournament of tournaments) {
    const participants = tournamentParticipants(tournament);
    participants.forEach((teamId) => map.get(teamId)?.tournaments.add(tournament.id));
    if (map.has(tournament.champion)) map.get(tournament.champion).titles += 1;
    if (map.has(tournament.runnerUp)) map.get(tournament.runnerUp).runners += 1;
    if (map.has(tournament.third)) map.get(tournament.third).thirds += 1;
    if (map.has(tournament.champion)) map.get(tournament.champion).finals += 1;
    if (map.has(tournament.runnerUp)) map.get(tournament.runnerUp).finals += 1;

    for (const row of matchRows([tournament])) {
      const home = map.get(row.home);
      const away = map.get(row.away);
      if (!home || !away) continue;
      const homeGoals = number(row.match.homeGoals);
      const awayGoals = number(row.match.awayGoals);
      home.pj += 1;
      away.pj += 1;
      home.gf += homeGoals;
      home.gc += awayGoals;
      away.gf += awayGoals;
      away.gc += homeGoals;
      if (awayGoals === 0) home.cleanSheets += 1;
      if (homeGoals === 0) away.cleanSheets += 1;

      if (homeGoals > awayGoals) {
        home.pg += 1;
        away.pp += 1;
      } else if (awayGoals > homeGoals) {
        away.pg += 1;
        home.pp += 1;
      } else {
        home.pe += 1;
        away.pe += 1;
        const winner = winnerId(row);
        if (winner && map.has(winner)) map.get(winner).penWins += 1;
      }
    }
  }

  return [...map.values()]
    .filter((row) => row.pj || row.titles || row.runners || row.thirds)
    .map((row) => ({
      ...row,
      points: row.pg * 3 + row.pe,
      dg: row.gf - row.gc,
      performance: row.pj ? ((row.pg * 3 + row.pe) / (row.pj * 3)) * 100 : 0,
      cleanSheetPct: row.pj ? row.cleanSheets / row.pj * 100 : 0
    }))
    .filter((row) => !respectTeam || selectedTeam === 'all' || row.teamId === selectedTeam)
    .sort((left, right) =>
      right.points - left.points ||
      right.dg - left.dg ||
      right.gf - left.gf ||
      right.titles - left.titles ||
      teamName(left.teamId, source).localeCompare(teamName(right.teamId, source), 'es')
    );
}

function tournamentTeamRow(tournament, teamId, source = state()) {
  return teamStandings([tournament], source, { respectTeam: false }).find((row) => row.teamId === teamId) || null;
}

function matchTimestamp(row, tournamentOrder) {
  return parseChronology(row.match.date) ??
    parseChronology(row.match.updatedAt) ??
    parseChronology(row.match.registrationStartedAt) ??
    ((tournamentOrder.get(row.tournament.id) || 0) * 100000 + row.matchIndex);
}

function chronologicalMatches(tournaments) {
  const order = new Map(tournaments.map((tournament, index) => [tournament.id, index + 1]));
  return matchRows(tournaments).sort((left, right) => matchTimestamp(left, order) - matchTimestamp(right, order));
}

function formatTournamentName(tournament) {
  return String(tournament?.name || 'Torneo sin nombre');
}

function formatStatus(tournament) {
  const status = statusGroup(tournament);
  return status === 'historical' ? 'Finalizado' : status === 'active' ? 'En juego' : 'Próximo';
}
function metricEntries(raw) {
  if (Array.isArray(raw)) return raw.map((value) => ({ key: '', value }));
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw).map(([key, value]) => ({ key, value }));
}

function parseMetricEntry(entry, kind, source = state()) {
  const sourceValue = entry.value;
  let name = entry.key || '';
  let teamId = '';
  let appearances = 0;
  let value = 0;

  if (Array.isArray(sourceValue)) {
    name = sourceValue[0] ?? name;
    const second = sourceValue[1];
    const third = sourceValue[2];
    const fourth = sourceValue[3];
    if (typeof second === 'string') {
      teamId = second;
      appearances = third ?? 0;
      value = fourth ?? third ?? 0;
    } else {
      value = second ?? 0;
      teamId = typeof third === 'string' ? third : '';
      appearances = typeof third === 'number' ? third : fourth ?? 0;
    }
  } else if (sourceValue && typeof sourceValue === 'object') {
    name = sourceValue.name ?? sourceValue.playerName ?? sourceValue.player ?? sourceValue.scorer ?? sourceValue.assist ?? name;
    teamId = sourceValue.teamId ?? sourceValue.team ?? sourceValue.clubId ?? sourceValue.club ?? '';
    appearances = sourceValue.appearances ?? sourceValue.matches ?? sourceValue.games ?? sourceValue.pj ?? 0;
    value = kind === 'goals'
      ? (sourceValue.goals ?? sourceValue.value ?? sourceValue.total ?? sourceValue.count ?? 0)
      : (sourceValue.assists ?? sourceValue.value ?? sourceValue.total ?? sourceValue.count ?? 0);
  } else if (typeof sourceValue === 'number' || typeof sourceValue === 'string') {
    if (!name && typeof sourceValue === 'string') name = sourceValue;
    else value = number(sourceValue);
  }

  name = String(name || '').trim();
  teamId = resolveTeamId(teamId, name, source);
  if (!name || !teamId) return null;
  return { teamId, name, appearances: number(appearances), value: number(value) };
}

function tournamentMetricRows(tournament, kind, source = state()) {
  const field = kind === 'goals' ? 'playerScorers' : 'playerAssists';
  const rows = new Map();
  for (const entry of metricEntries(tournament?.[field])) {
    const parsed = parseMetricEntry(entry, kind, source);
    if (!parsed) continue;
    rows.set(`${parsed.teamId}__${norm(parsed.name)}`, parsed);
  }

  const detailed = new Map();
  for (const row of matchRows([tournament])) {
    for (const goal of Array.isArray(row.match.goals) ? row.match.goals : []) {
      const name = kind === 'goals' ? goal.playerName : goal.assistName;
      const teamId = resolveTeamId(goal.teamId || (goal.side === 'away' ? row.away : row.home), name, source);
      if (!name || !teamId || (kind === 'assists' && /sin asistencia|sin pase|ninguna/i.test(String(name)))) continue;
      const key = `${teamId}__${norm(name)}`;
      const current = detailed.get(key) || { teamId, name: String(name).trim(), appearances: 0, value: 0 };
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

function lineupNames(lineup, field) {
  const values = Array.isArray(lineup?.[field]) ? lineup[field] : [];
  return values.map((value) => typeof value === 'string' ? value : playerName(value)).filter(Boolean);
}

function appearedInLineup(name, lineup) {
  const key = norm(name);
  if (lineupNames(lineup, 'starters').some((item) => norm(item) === key)) return true;
  return (lineup?.changes || []).some((change) => norm(change?.playerIn) === key || norm(change?.playerOut) === key);
}

function playerAppearancesInTournament(tournament, teamId, name) {
  let appearances = 0;
  for (const row of matchRows([tournament])) {
    const side = row.home === teamId ? 'home' : row.away === teamId ? 'away' : null;
    if (!side || !row.match.participationTracked) continue;
    if (appearedInLineup(name, row.match.lineups?.[side])) appearances += 1;
  }
  return appearances;
}

function careerMetricRows(tournaments, kind, source = state()) {
  const careers = new Map();
  for (const tournament of tournaments) {
    for (const metric of tournamentMetricRows(tournament, kind, source)) {
      if (selectedTeam !== 'all' && metric.teamId !== selectedTeam) continue;
      const key = norm(metric.name);
      const derivedAppearances = playerAppearancesInTournament(tournament, metric.teamId, metric.name);
      const appearances = Math.max(metric.appearances, derivedAppearances);
      const current = careers.get(key) || {
        name: metric.name,
        value: 0,
        appearances: 0,
        teams: new Set(),
        teamCounts: new Map(),
        tournaments: new Set(),
        bestTournament: null
      };
      current.value += metric.value;
      current.appearances += appearances;
      current.teams.add(metric.teamId);
      current.teamCounts.set(metric.teamId, number(current.teamCounts.get(metric.teamId)) + metric.value + 1);
      current.tournaments.add(tournament.id);
      if (!current.bestTournament || metric.value > current.bestTournament.value) {
        current.bestTournament = { id: tournament.id, name: formatTournamentName(tournament), value: metric.value };
      }
      careers.set(key, current);
    }
  }
  return [...careers.values()].map((row) => {
    const primaryTeam = [...row.teamCounts].sort((left, right) => right[1] - left[1])[0]?.[0] || [...row.teams][0] || '';
    return {
      ...row,
      teamId: primaryTeam,
      average: row.appearances ? row.value / row.appearances : null
    };
  }).filter((row) => row.value > 0).sort((left, right) =>
    right.value - left.value ||
    right.tournaments.size - left.tournaments.size ||
    left.name.localeCompare(right.name, 'es')
  );
}

function goalkeeperCareerRows(tournaments, source = state()) {
  const careers = new Map();
  const matches = matchRows(tournaments);
  for (const team of source.teams || []) {
    if (selectedTeam !== 'all' && team.id !== selectedTeam) continue;
    const roster = Array.isArray(team.players) ? team.players : team.players && typeof team.players === 'object' ? Object.values(team.players) : [];
    for (const entry of roster) {
      const name = playerName(entry);
      if (!name || !isGoalkeeper(entry)) continue;
      const key = norm(name);
      const current = careers.get(key) || {
        name,
        teamId: team.id,
        teams: new Set(),
        teamCounts: new Map(),
        appearances: 0,
        cleanSheets: 0,
        goalsConceded: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        tournaments: new Set()
      };
      for (const row of matches) {
        const side = row.home === team.id ? 'home' : row.away === team.id ? 'away' : null;
        if (!side || !row.match.participationTracked) continue;
        if (!appearedInLineup(name, row.match.lineups?.[side])) continue;
        const conceded = side === 'home' ? number(row.match.awayGoals) : number(row.match.homeGoals);
        current.appearances += 1;
        current.goalsConceded += conceded;
        current.teams.add(team.id);
        current.teamCounts.set(team.id, number(current.teamCounts.get(team.id)) + 1);
        current.tournaments.add(row.tournament.id);
        if (conceded === 0) current.cleanSheets += 1;
        const result = regulationResult(row, team.id);
        if (result === 'win') current.wins += 1;
        else if (result === 'draw') current.draws += 1;
        else current.losses += 1;
      }
      careers.set(key, current);
    }
  }
  return [...careers.values()].filter((row) => row.appearances > 0).map((row) => ({
    ...row,
    teamId: [...row.teamCounts].sort((left, right) => right[1] - left[1])[0]?.[0] || row.teamId,
    average: row.goalsConceded / row.appearances,
    cleanSheetPct: row.cleanSheets / row.appearances * 100
  })).sort((left, right) =>
    right.cleanSheets - left.cleanSheets ||
    right.cleanSheetPct - left.cleanSheetPct ||
    left.average - right.average ||
    right.appearances - left.appearances ||
    left.name.localeCompare(right.name, 'es')
  );
}

function teamCleanSheetRows(tournaments, source = state()) {
  return teamStandings(tournaments, source).filter((row) => row.pj > 0).sort((left, right) =>
    right.cleanSheets - left.cleanSheets ||
    right.cleanSheetPct - left.cleanSheetPct ||
    right.points - left.points
  );
}
function awardTeamFromName(name, source = state()) {
  return resolveTeamId('', name, source);
}

function playerAwardRecords(tournaments, source = state()) {
  const records = [];
  for (const tournament of tournaments) {
    const seen = new Set();
    const details = tournament?.awardDetails && typeof tournament.awardDetails === 'object' ? tournament.awardDetails : {};
    for (const [category, value] of Object.entries(details)) {
      if (!value || typeof value !== 'object') continue;
      const name = String(value.playerName || value.name || '').trim();
      if (!name) continue;
      const teamId = resolveTeamId(value.teamId || value.team || '', name, source);
      if (!teamId || (selectedTeam !== 'all' && teamId !== selectedTeam)) continue;
      const key = `${category}__${norm(name)}`;
      seen.add(key);
      records.push({
        type: 'player',
        category,
        title: AWARD_LABELS[category] || value.title || category,
        name,
        teamId,
        tournament,
        official: tournament.awardsStatus === 'official' || tournament.status === 'historical',
        reason: String(value.reason || '')
      });
    }
    const legacy = tournament?.awards && typeof tournament.awards === 'object' ? tournament.awards : {};
    for (const [category, rawName] of Object.entries(legacy)) {
      const name = typeof rawName === 'string' ? rawName.trim() : String(rawName?.playerName || rawName?.name || '').trim();
      if (!name || seen.has(`${category}__${norm(name)}`)) continue;
      const teamId = awardTeamFromName(name, source);
      if (!teamId || (selectedTeam !== 'all' && teamId !== selectedTeam)) continue;
      records.push({
        type: 'player',
        category,
        title: AWARD_LABELS[category] || category,
        name,
        teamId,
        tournament,
        official: tournament.status === 'historical',
        reason: ''
      });
    }
  }
  return records;
}

function collectiveAwardRecords(tournaments, source = state()) {
  const records = [];
  for (const tournament of tournaments) {
    const collections = [tournament?.teamAwards, tournament?.collectiveAwards, tournament?.awardsTeams].filter(Boolean);
    for (const collection of collections) {
      const entries = Array.isArray(collection) ? collection.map((value, index) => [String(index), value]) : Object.entries(collection || {});
      for (const [key, value] of entries) {
        let teamId = '';
        let title = key;
        if (typeof value === 'string') teamId = resolveTeamId(value, '', source);
        else if (value && typeof value === 'object') {
          teamId = resolveTeamId(value.teamId || value.team || value.winner || '', '', source);
          title = value.title || value.name || value.award || key;
        }
        if (!teamId || (selectedTeam !== 'all' && teamId !== selectedTeam)) continue;
        records.push({ type: 'team', title: String(title || 'Premio colectivo'), teamId, tournament });
      }
    }
  }
  return records;
}

function playerHonoursRows(tournaments, source = state()) {
  const map = new Map();
  for (const record of playerAwardRecords(tournaments, source)) {
    const key = norm(record.name);
    const current = map.get(key) || {
      name: record.name,
      teamId: record.teamId,
      teams: new Set(),
      teamCounts: new Map(),
      total: 0,
      categories: new Map(),
      tournaments: new Set()
    };
    current.total += 1;
    current.teams.add(record.teamId);
    current.teamCounts.set(record.teamId, number(current.teamCounts.get(record.teamId)) + 1);
    current.categories.set(record.category, number(current.categories.get(record.category)) + 1);
    current.tournaments.add(record.tournament.id);
    map.set(key, current);
  }
  return [...map.values()].map((row) => ({
    ...row,
    teamId: [...row.teamCounts].sort((left, right) => right[1] - left[1])[0]?.[0] || row.teamId
  })).sort((left, right) => right.total - left.total || left.name.localeCompare(right.name, 'es'));
}

function teamHonoursRows(tournaments, source = state()) {
  const standings = teamStandings(tournaments, source);
  const playerAwards = playerAwardRecords(tournaments, source);
  const collective = collectiveAwardRecords(tournaments, source);
  const playerCounts = new Map();
  const collectiveCounts = new Map();
  playerAwards.forEach((record) => playerCounts.set(record.teamId, number(playerCounts.get(record.teamId)) + 1));
  collective.forEach((record) => collectiveCounts.set(record.teamId, number(collectiveCounts.get(record.teamId)) + 1));
  return standings.map((row) => ({
    ...row,
    playerAwards: number(playerCounts.get(row.teamId)),
    collectiveAwards: number(collectiveCounts.get(row.teamId)),
    podiums: row.titles + row.runners + row.thirds,
    distinctions: row.titles + row.runners + row.thirds + number(playerCounts.get(row.teamId)) + number(collectiveCounts.get(row.teamId))
  })).sort((left, right) =>
    right.titles - left.titles ||
    right.podiums - left.podiums ||
    right.distinctions - left.distinctions ||
    right.points - left.points
  );
}

function awardCountForPlayer(name, category, tournaments, source = state()) {
  return playerAwardRecords(tournaments, source).filter((record) => norm(record.name) === norm(name) && (!category || record.category === category)).length;
}

function archiveRows(tournaments, source = state()) {
  return [...tournaments].reverse().map((tournament) => {
    const matches = matchRows([tournament]);
    const goals = matches.reduce((sum, row) => sum + number(row.match.homeGoals) + number(row.match.awayGoals), 0);
    const awards = playerAwardRecords([tournament], source);
    const award = (category) => awards.find((record) => record.category === category)?.name || '';
    return {
      tournament,
      era: eraOf(tournament, source),
      format: formatGroup(tournament),
      status: statusGroup(tournament),
      teams: tournamentParticipants(tournament).size,
      matches: matches.length,
      goals,
      champion: tournament.champion || '',
      runnerUp: tournament.runnerUp || '',
      third: tournament.third || '',
      scorer: award('scorer') || tournamentMetricRows(tournament, 'goals', source).sort((a, b) => b.value - a.value)[0]?.name || '',
      mvp: award('mvp'),
      goalkeeper: award('goalkeeper')
    };
  });
}

function playerTeamsLabel(row, source = state()) {
  const ids = [...(row.teams || [])];
  if (!ids.length && row.teamId) ids.push(row.teamId);
  return ids.map((teamId) => teamName(teamId, source)).join(' · ') || 'Equipo sin identificar';
}

function awardBreakdown(row) {
  return [...(row.categories || new Map())]
    .sort((left, right) => right[1] - left[1])
    .map(([category, count]) => `${AWARD_LABELS[category] || category}: ${count}`)
    .join(' · ');
}
function streakRecords(tournaments, source = state()) {
  const rows = chronologicalMatches(tournaments);
  const trackers = new Map();
  const get = (teamId) => {
    if (!trackers.has(teamId)) trackers.set(teamId, {
      teamId,
      win: 0,
      unbeaten: 0,
      clean: 0,
      bestWin: 0,
      bestUnbeaten: 0,
      bestClean: 0
    });
    return trackers.get(teamId);
  };

  for (const row of rows) {
    for (const teamId of [row.home, row.away]) {
      const tracker = get(teamId);
      const result = regulationResult(row, teamId);
      const winner = winnerId(row);
      const conceded = row.home === teamId ? number(row.match.awayGoals) : number(row.match.homeGoals);
      tracker.win = winner === teamId ? tracker.win + 1 : 0;
      tracker.unbeaten = result !== 'loss' ? tracker.unbeaten + 1 : 0;
      tracker.clean = conceded === 0 ? tracker.clean + 1 : 0;
      tracker.bestWin = Math.max(tracker.bestWin, tracker.win);
      tracker.bestUnbeaten = Math.max(tracker.bestUnbeaten, tracker.unbeaten);
      tracker.bestClean = Math.max(tracker.bestClean, tracker.clean);
    }
  }
  return [...trackers.values()].filter((row) => selectedTeam === 'all' || row.teamId === selectedTeam);
}

function bestStreak(rows, field) {
  return [...rows].sort((left, right) => right[field] - left[field])[0] || null;
}

function championPerformance(tournaments, source = state()) {
  const rows = [];
  for (const tournament of tournaments.filter((item) => item.champion)) {
    const row = tournamentTeamRow(tournament, tournament.champion, source);
    if (!row?.pj) continue;
    rows.push({ tournament, teamId: tournament.champion, performance: row.performance, points: row.points, pj: row.pj, dg: row.dg });
  }
  return rows.sort((left, right) => right.performance - left.performance || right.dg - left.dg)[0] || null;
}

function recordBook(tournaments, source = state()) {
  const teams = teamStandings(tournaments, source);
  const scorers = careerMetricRows(tournaments, 'goals', source);
  const assists = careerMetricRows(tournaments, 'assists', source);
  const keepers = goalkeeperCareerRows(tournaments, source);
  const players = playerHonoursRows(tournaments, source);
  const matches = matchRows(tournaments);
  const biggest = [...matches].sort((left, right) => {
    const rightDifference = Math.abs(number(right.match.homeGoals) - number(right.match.awayGoals));
    const leftDifference = Math.abs(number(left.match.homeGoals) - number(left.match.awayGoals));
    return rightDifference - leftDifference || (number(right.match.homeGoals) + number(right.match.awayGoals)) - (number(left.match.homeGoals) + number(left.match.awayGoals));
  })[0] || null;
  const highest = [...matches].sort((left, right) =>
    (number(right.match.homeGoals) + number(right.match.awayGoals)) -
    (number(left.match.homeGoals) + number(left.match.awayGoals))
  )[0] || null;
  const streaks = streakRecords(tournaments, source);
  return {
    teams,
    scorers,
    assists,
    keepers,
    players,
    matches,
    biggest,
    highest,
    bestWinStreak: bestStreak(streaks, 'bestWin'),
    bestUnbeaten: bestStreak(streaks, 'bestUnbeaten'),
    bestCleanStreak: bestStreak(streaks, 'bestClean'),
    bestChampion: championPerformance(tournaments, source)
  };
}

function h2hSummary(tournaments, teamA, teamB, source = state()) {
  const matches = matchRows(tournaments).filter((row) =>
    (row.home === teamA && row.away === teamB) || (row.home === teamB && row.away === teamA)
  );
  let winsA = 0;
  let winsB = 0;
  let draws = 0;
  let goalsA = 0;
  let goalsB = 0;
  let pensA = 0;
  let pensB = 0;
  let finals = 0;
  let titlesA = 0;
  let titlesB = 0;

  for (const row of matches) {
    const aHome = row.home === teamA;
    const scoreA = number(aHome ? row.match.homeGoals : row.match.awayGoals);
    const scoreB = number(aHome ? row.match.awayGoals : row.match.homeGoals);
    goalsA += scoreA;
    goalsB += scoreB;
    if (scoreA > scoreB) winsA += 1;
    else if (scoreB > scoreA) winsB += 1;
    else draws += 1;
    const winner = winnerId(row);
    if (scoreA === scoreB && winner === teamA) pensA += 1;
    if (scoreA === scoreB && winner === teamB) pensB += 1;
    const final = norm(row.match.round) === 'final' || norm(row.match.label) === 'final';
    if (final) {
      finals += 1;
      if (winner === teamA || row.tournament.champion === teamA) titlesA += 1;
      if (winner === teamB || row.tournament.champion === teamB) titlesB += 1;
    }
  }

  const order = new Map(tournaments.map((tournament, index) => [tournament.id, index + 1]));
  const recent = [...matches].sort((left, right) => matchTimestamp(right, order) - matchTimestamp(left, order));
  return { teamA, teamB, matches, winsA, winsB, draws, goalsA, goalsB, pensA, pensB, finals, titlesA, titlesB, recent };
}

function matchScoreForTeams(row, teamA, teamB) {
  const aHome = row.home === teamA;
  return {
    scoreA: number(aHome ? row.match.homeGoals : row.match.awayGoals),
    scoreB: number(aHome ? row.match.awayGoals : row.match.homeGoals),
    pensA: number(aHome ? row.match.homePens : row.match.awayPens),
    pensB: number(aHome ? row.match.awayPens : row.match.homePens)
  };
}

function recordMatchLabel(row, source = state()) {
  return `${teamName(row.home, source)} ${number(row.match.homeGoals)}–${number(row.match.awayGoals)} ${teamName(row.away, source)}`;
}
function medal(index) {
  return index < 3 ? `<span class="cm-v521-rank is-${index + 1}">${index + 1}</span>` : `<span class="cm-v521-rank">${index + 1}</span>`;
}

function teamCell(teamId, source = state()) {
  const logo = logoUrl(teamId);
  return `<button class="cm-v521-person" type="button" data-cm-v521-team="${esc(teamId)}">${logo ? `<img class="cm-v521-logo" src="${esc(logo)}" alt="">` : `<span class="cm-v521-avatar">${esc(teamName(teamId, source).slice(0, 1))}</span>`}<span><b>${esc(teamName(teamId, source))}</b></span></button>`;
}

function playerCell(row, source = state()) {
  const teamId = row.teamId || [...(row.teams || [])][0] || '';
  return `<button class="cm-v521-person" type="button" data-cm-v521-player="${esc(teamId)}__${encodeURIComponent(row.name)}">${photo(teamId, row.name, 'cm-v521-photo')}<span><b>${esc(row.name)}</b><small>${esc(playerTeamsLabel(row, source))}</small></span></button>`;
}

function simplePlayer(name, teamId, source = state()) {
  if (!name) return '<span class="cm-v521-missing">Sin registro</span>';
  return `<span class="cm-v521-inline-person">${photo(teamId, name, 'cm-v521-mini-photo')}<span><b>${esc(name)}</b><small>${esc(teamName(teamId, source))}</small></span></span>`;
}

function table(headers, rows, empty = 'Sin datos para este filtro.', className = '') {
  return `<div class="cm-v521-table ${className}"><table><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td colspan="${headers.length}" class="cm-v521-empty-cell">${esc(empty)}</td></tr>`}</tbody></table></div>`;
}

function sectionHeader(kicker, title, description = '', count = null) {
  return `<header class="cm-v521-section-head"><div><span>${esc(kicker)}</span><h2>${esc(title)}</h2>${description ? `<p>${esc(description)}</p>` : ''}</div>${count === null ? '' : `<b>${count}</b>`}</header>`;
}

function filterLabel(source, tournaments) {
  const parts = [];
  parts.push(selectedEra === 'all' ? 'Toda la historia' : selectedEra === ERA_DIVISIONS ? 'Era de divisiones' : 'Era de ligas');
  if (selectedTournament !== 'all') parts.push(tournaments[0]?.name || 'Torneo seleccionado');
  if (selectedFormat !== 'all') parts.push(FORMAT_LABELS[selectedFormat]);
  if (selectedStatus !== 'all') parts.push(STATUS_LABELS[selectedStatus]);
  if (selectedTeam !== 'all') parts.push(teamName(selectedTeam, source));
  return parts.join(' · ');
}

function heroMetrics(tournaments, source = state()) {
  const matches = matchRows(tournaments);
  const goals = matches.reduce((sum, row) => sum + number(row.match.homeGoals) + number(row.match.awayGoals), 0);
  const teams = new Set(matches.flatMap((row) => [row.home, row.away]));
  const awards = playerAwardRecords(tournaments, source).length;
  return { tournaments: tournaments.length, matches: matches.length, goals, teams: teams.size, awards };
}

function metricStrip(metrics) {
  return `<div class="cm-v521-metric-strip">
    <span><b>${metrics.tournaments}</b><small>Torneos</small></span>
    <span><b>${metrics.matches}</b><small>Partidos</small></span>
    <span><b>${metrics.goals}</b><small>Goles</small></span>
    <span><b>${metrics.teams}</b><small>Equipos</small></span>
    <span><b>${metrics.awards}</b><small>Premios</small></span>
  </div>`;
}

function podium(rows, valueText, source = state(), emptyText = 'Sin registros.') {
  if (!rows.length) return `<div class="cm-v521-empty">${esc(emptyText)}</div>`;
  return `<div class="cm-v521-podium">${rows.slice(0, 3).map((row, index) => `<article class="is-${index + 1}"><span>${index + 1}</span>${photo(row.teamId, row.name, 'cm-v521-podium-photo')}<b>${esc(row.name)}</b><small>${esc(playerTeamsLabel(row, source))}</small><strong>${esc(valueText(row))}</strong></article>`).join('')}</div>`;
}

function awardPills(row) {
  const entries = [...(row.categories || new Map())].sort((left, right) => right[1] - left[1]);
  return entries.length ? `<div class="cm-v521-pills">${entries.map(([category, count]) => `<span>${esc(AWARD_LABELS[category] || category)} <b>${count}</b></span>`).join('')}</div>` : '<span class="cm-v521-missing">Sin premios</span>';
}

function eraBadge(era) {
  return `<span class="cm-v521-badge is-${era}">${era === ERA_DIVISIONS ? 'Divisiones' : 'Ligas'}</span>`;
}

function formatBadge(format) {
  return `<span class="cm-v521-badge is-format">${esc(FORMAT_LABELS[format] || 'Otro')}</span>`;
}
function eternalPanel(tournaments, source = state()) {
  const rows = teamStandings(tournaments, source);
  const metrics = heroMetrics(tournaments, source);
  return `<section class="cm-v521-panel" data-cm-v521-panel="eternal">
    <div class="cm-v521-panel-intro"><div><span>CLASIFICACIÓN HISTÓRICA</span><h2>La Tabla Eterna</h2><p>Todos los puntos obtenidos en partidos oficiales. Los empates definidos por penales conservan un punto para cada equipo y registran la tanda por separado.</p></div>${metricStrip(metrics)}</div>
    <article class="cm-v521-card">${sectionHeader('HISTORIA DE CLUBES', 'Clasificación acumulada', filterLabel(source, tournaments), rows.length)}
      ${table(['#', 'Equipo', 'Torneos', 'PJ', 'PG', 'PE', 'PP', 'GF', 'GC', 'DG', 'Pts', 'Pen.', 'Rend.', 'Títulos'], rows.map((row, index) => `<tr>
        <td>${medal(index)}</td><td>${teamCell(row.teamId, source)}</td><td>${row.tournaments.size}</td><td>${row.pj}</td><td>${row.pg}</td><td>${row.pe}</td><td>${row.pp}</td>
        <td>${row.gf}</td><td>${row.gc}</td><td>${row.dg > 0 ? '+' : ''}${row.dg}</td><td><strong class="cm-v521-points">${row.points}</strong></td><td>${row.penWins}</td>
        <td><span class="cm-v521-percent">${Math.round(row.performance)}%</span></td><td><strong>${row.titles}</strong></td>
      </tr>`), 'No existen partidos oficiales para este filtro.', 'is-eternal')}</article>
  </section>`;
}

function goalsRanking(tournaments, source = state()) {
  const rows = careerMetricRows(tournaments, 'goals', source);
  return `<div class="cm-v521-ranking-panel" data-cm-v521-ranking-panel="goals">
    ${podium(rows, (row) => `${row.value} goles`, source, 'No hay goles individuales registrados.')}
    <article class="cm-v521-card">${sectionHeader('GOLEADORES HISTÓRICOS', 'Los Grandes Artilleros', 'Carrera acumulada en todos los torneos incluidos.', rows.length)}
      ${table(['#', 'Jugador', 'Goles', 'PJ', 'G/PJ', 'Torneos', 'Mejor torneo', 'Botas de Oro'], rows.map((row, index) => `<tr>
        <td>${medal(index)}</td><td>${playerCell(row, source)}</td><td><strong class="cm-v521-stat-value">${row.value}</strong></td>
        <td>${row.appearances || '<span class="cm-v521-missing">S/R</span>'}</td><td>${row.average === null ? '<span class="cm-v521-missing">S/R</span>' : row.average.toFixed(2)}</td>
        <td>${row.tournaments.size}</td><td>${esc(row.bestTournament?.name || 'Sin registro')} ${row.bestTournament ? `<small>(${row.bestTournament.value})</small>` : ''}</td>
        <td>${awardCountForPlayer(row.name, 'scorer', tournaments, source)}</td>
      </tr>`), 'No hay goleadores registrados para este filtro.')}</article>
  </div>`;
}

function assistsRanking(tournaments, source = state()) {
  const rows = careerMetricRows(tournaments, 'assists', source);
  return `<div class="cm-v521-ranking-panel" data-cm-v521-ranking-panel="assists">
    ${podium(rows, (row) => `${row.value} asistencias`, source, 'No hay asistencias registradas.')}
    <article class="cm-v521-card">${sectionHeader('CREADORES HISTÓRICOS', 'Los Arquitectos del Gol', 'Asistencias acumuladas y rendimiento creativo.', rows.length)}
      ${table(['#', 'Jugador', 'Asist.', 'PJ', 'A/PJ', 'Torneos', 'Mejor torneo', 'Premios'], rows.map((row, index) => `<tr>
        <td>${medal(index)}</td><td>${playerCell(row, source)}</td><td><strong class="cm-v521-stat-value">${row.value}</strong></td>
        <td>${row.appearances || '<span class="cm-v521-missing">S/R</span>'}</td><td>${row.average === null ? '<span class="cm-v521-missing">S/R</span>' : row.average.toFixed(2)}</td>
        <td>${row.tournaments.size}</td><td>${esc(row.bestTournament?.name || 'Sin registro')} ${row.bestTournament ? `<small>(${row.bestTournament.value})</small>` : ''}</td>
        <td>${awardCountForPlayer(row.name, 'assist', tournaments, source)}</td>
      </tr>`), 'No hay asistencias registradas para este filtro.')}</article>
  </div>`;
}

function keepersRanking(tournaments, source = state()) {
  const rows = goalkeeperCareerRows(tournaments, source);
  const teams = teamCleanSheetRows(tournaments, source);
  return `<div class="cm-v521-ranking-panel" data-cm-v521-ranking-panel="keepers">
    ${podium(rows, (row) => `${row.cleanSheets} porterías imbatidas`, source, 'No hay porteros con participación registrada.')}
    <article class="cm-v521-card">${sectionHeader('ARQUEROS HISTÓRICOS', 'El Muro Histórico', 'Solo utiliza partidos con alineación o participación confirmada.', rows.length)}
      ${table(['#', 'Portero', 'PJ', 'Imbatidas', '%', 'GC', 'GC/PJ', 'G-E-P', 'Torneos', 'Guantes de Oro'], rows.map((row, index) => `<tr>
        <td>${medal(index)}</td><td>${playerCell(row, source)}</td><td>${row.appearances}</td><td><strong class="cm-v521-stat-value">${row.cleanSheets}</strong></td>
        <td>${Math.round(row.cleanSheetPct)}%</td><td>${row.goalsConceded}</td><td>${row.average.toFixed(2)}</td><td>${row.wins}-${row.draws}-${row.losses}</td>
        <td>${row.tournaments.size}</td><td>${awardCountForPlayer(row.name, 'goalkeeper', tournaments, source)}</td>
      </tr>`), selectedEra === ERA_LEAGUES ? 'La Era de ligas no posee alineaciones suficientes para identificar porteros.' : 'No hay porteros registrados para este filtro.')}</article>
    <article class="cm-v521-card">${sectionHeader('DEFENSA COLECTIVA', 'Las Fortalezas Defensivas', 'Porterías imbatidas de equipos, disponibles incluso sin alineaciones individuales.', teams.length)}
      ${table(['#', 'Equipo', 'PJ', 'Porterías imbatidas', '% imbatida', 'GC', 'GC/PJ'], teams.map((row, index) => `<tr>
        <td>${medal(index)}</td><td>${teamCell(row.teamId, source)}</td><td>${row.pj}</td><td><strong class="cm-v521-stat-value">${row.cleanSheets}</strong></td>
        <td>${Math.round(row.cleanSheetPct)}%</td><td>${row.gc}</td><td>${row.pj ? (row.gc / row.pj).toFixed(2) : '0.00'}</td>
      </tr>`), 'No hay resultados defensivos para este filtro.')}</article>
  </div>`;
}

function rankingsPanel(tournaments, source = state()) {
  return `<section class="cm-v521-panel" data-cm-v521-panel="rankings">
    <div class="cm-v521-panel-intro"><div><span>JUGADORES Y PORTEROS</span><h2>Rankings Históricos</h2><p>Clasificaciones acumuladas de goles, asistencias y porterías imbatidas.</p></div></div>
    <nav class="cm-v521-subtabs" aria-label="Rankings históricos">${RANKING_TABS.map(([id, label, description]) => `<button type="button" data-cm-v521-ranking="${id}" class="${selectedRanking === id ? 'active' : ''}"><b>${label}</b><small>${description}</small></button>`).join('')}</nav>
    <div class="cm-v521-ranking-content">${goalsRanking(tournaments, source)}${assistsRanking(tournaments, source)}${keepersRanking(tournaments, source)}</div>
  </section>`;
}
function honoursPanel(tournaments, source = state()) {
  const teams = teamHonoursRows(tournaments, source);
  const players = playerHonoursRows(tournaments, source);
  const awardHistory = [...playerAwardRecords(tournaments, source)].reverse();
  const collective = [...collectiveAwardRecords(tournaments, source)].reverse();

  return `<section class="cm-v521-panel" data-cm-v521-panel="honours">
    <div class="cm-v521-panel-intro is-gold"><div><span>PALMARÉS OFICIAL</span><h2>Salón de la Gloria</h2><p>Todos los campeonatos, podios y premios individuales registrados en ChuteMundo.</p></div><strong>${teams.reduce((sum, row) => sum + row.titles, 0)} títulos</strong></div>
    <article class="cm-v521-card">${sectionHeader('GLORIA DE LOS EQUIPOS', 'Clubes más laureados', 'Campeonatos, finales, podios y premios obtenidos por sus jugadores.', teams.length)}
      ${table(['#', 'Equipo', 'Campeón', 'Subcampeón', '3.º', 'Finales', 'Podios', 'Premios de jugadores', 'Premios colectivos', 'Distinciones'], teams.map((row, index) => `<tr>
        <td>${medal(index)}</td><td>${teamCell(row.teamId, source)}</td><td><strong class="cm-v521-stat-value">${row.titles}</strong></td><td>${row.runners}</td>
        <td>${row.thirds}</td><td>${row.finals}</td><td>${row.podiums}</td><td>${row.playerAwards}</td><td>${row.collectiveAwards}</td><td><strong>${row.distinctions}</strong></td>
      </tr>`), 'No hay equipos con distinciones para este filtro.')}</article>
    <article class="cm-v521-card">${sectionHeader('GLORIA DE LOS JUGADORES', 'Los Más Laureados', 'Premios acumulados durante toda la carrera.', players.length)}
      ${podium(players, (row) => `${row.total} premios`, source, 'No existen premios individuales registrados.')}
      ${table(['#', 'Jugador', 'Premios', 'Torneos premiado', 'Detalle'], players.map((row, index) => `<tr>
        <td>${medal(index)}</td><td>${playerCell(row, source)}</td><td><strong class="cm-v521-stat-value">${row.total}</strong></td><td>${row.tournaments.size}</td><td>${awardPills(row)}</td>
      </tr>`), 'No existen premios individuales registrados.')}</article>
    <article class="cm-v521-card">${sectionHeader('LIBRO DE PREMIACIONES', 'Historial de premios individuales', 'Cada reconocimiento asociado al torneo en que fue entregado.', awardHistory.length)}
      ${table(['Torneo', 'Premio', 'Ganador', 'Equipo', 'Estado'], awardHistory.map((record) => `<tr>
        <td><b>${esc(record.tournament.name)}</b></td><td>${esc(record.title)}</td><td>${simplePlayer(record.name, record.teamId, source)}</td>
        <td>${esc(teamName(record.teamId, source))}</td><td><span class="cm-v521-status ${record.official ? 'is-official' : ''}">${record.official ? 'Oficial' : 'Provisional'}</span></td>
      </tr>`), 'No hay premios individuales registrados.')}</article>
    ${collective.length ? `<article class="cm-v521-card">${sectionHeader('DISTINCIONES COLECTIVAS', 'Premios especiales de equipos', '', collective.length)}
      ${table(['Torneo', 'Premio', 'Equipo'], collective.map((record) => `<tr><td>${esc(record.tournament.name)}</td><td>${esc(record.title)}</td><td>${teamCell(record.teamId, source)}</td></tr>`))}</article>` : ''}
  </section>`;
}

function archivePanel(tournaments, source = state()) {
  const rows = archiveRows(tournaments, source);
  return `<section class="cm-v521-panel" data-cm-v521-panel="archive">
    <div class="cm-v521-panel-intro"><div><span>REGISTRO OFICIAL</span><h2>Archivo de Campeones</h2><p>La cronología completa de torneos, campeones, subcampeones, terceros lugares y premios principales.</p></div><strong>${rows.filter((row) => row.champion).length} campeones</strong></div>
    <article class="cm-v521-card">${sectionHeader('HISTORIA DE LAS COMPETENCIAS', 'Torneos disputados', filterLabel(source, tournaments), rows.length)}
      ${table(['Torneo', 'Era', 'Formato', 'Estado', 'Equipos', 'PJ', 'Goles', 'Campeón', 'Subcampeón', '3.º', 'Goleador', 'MVP', 'Mejor arquero'], rows.map((row) => `<tr>
        <td><b>${esc(row.tournament.name)}</b></td><td>${eraBadge(row.era)}</td><td>${formatBadge(row.format)}</td><td>${esc(formatStatus(row.tournament))}</td>
        <td>${row.teams}</td><td>${row.matches}</td><td>${row.goals}</td><td>${row.champion ? teamCell(row.champion, source) : '<span class="cm-v521-missing">Sin definir</span>'}</td>
        <td>${row.runnerUp ? esc(teamName(row.runnerUp, source)) : '<span class="cm-v521-missing">Sin registro</span>'}</td>
        <td>${row.third ? esc(teamName(row.third, source)) : '<span class="cm-v521-missing">Sin registro</span>'}</td>
        <td>${row.scorer ? esc(row.scorer) : '<span class="cm-v521-missing">Sin registro</span>'}</td>
        <td>${row.mvp ? esc(row.mvp) : '<span class="cm-v521-missing">Sin registro</span>'}</td>
        <td>${row.goalkeeper ? esc(row.goalkeeper) : '<span class="cm-v521-missing">Sin registro</span>'}</td>
      </tr>`), 'No existen torneos para los filtros seleccionados.', 'is-archive')}</article>
  </section>`;
}
function recordCard(label, value, detail = '', emphasis = '') {
  return `<article class="cm-v521-record ${emphasis}"><span>${esc(label)}</span><b>${value}</b>${detail ? `<small>${detail}</small>` : ''}</article>`;
}

function recordsPanel(tournaments, source = state()) {
  const records = recordBook(tournaments, source);
  const topTeam = records.teams[0];
  const titleTeam = [...records.teams].sort((left, right) => right.titles - left.titles || right.points - left.points)[0];
  const topScorer = records.scorers[0];
  const topAssist = records.assists[0];
  const topKeeper = records.keepers[0];
  const topPlayer = records.players[0];

  return `<section class="cm-v521-panel" data-cm-v521-panel="records">
    <div class="cm-v521-panel-intro is-dark"><div><span>HITOS OFICIALES</span><h2>Libro de Récords</h2><p>Las marcas más importantes de equipos, jugadores, porteros y partidos.</p></div></div>
    <div class="cm-v521-record-grid">
      ${recordCard('Más puntos históricos', topTeam ? esc(teamName(topTeam.teamId, source)) : '—', topTeam ? `${topTeam.points} puntos` : 'Sin datos', 'is-primary')}
      ${recordCard('Más campeonatos', titleTeam ? esc(teamName(titleTeam.teamId, source)) : '—', titleTeam ? `${titleTeam.titles} títulos` : 'Sin datos')}
      ${recordCard('Máximo goleador', topScorer ? esc(topScorer.name) : '—', topScorer ? `${topScorer.value} goles` : 'Sin datos')}
      ${recordCard('Máximo asistidor', topAssist ? esc(topAssist.name) : '—', topAssist ? `${topAssist.value} asistencias` : 'Sin datos')}
      ${recordCard('Más porterías imbatidas', topKeeper ? esc(topKeeper.name) : '—', topKeeper ? `${topKeeper.cleanSheets} partidos` : 'Sin datos')}
      ${recordCard('Jugador más premiado', topPlayer ? esc(topPlayer.name) : '—', topPlayer ? `${topPlayer.total} premios` : 'Sin datos')}
      ${recordCard('Mayor goleada', records.biggest ? esc(recordMatchLabel(records.biggest, source)) : '—', records.biggest ? esc(records.biggest.tournament.name) : 'Sin partidos')}
      ${recordCard('Partido con más goles', records.highest ? esc(recordMatchLabel(records.highest, source)) : '—', records.highest ? `${number(records.highest.match.homeGoals) + number(records.highest.match.awayGoals)} goles · ${esc(records.highest.tournament.name)}` : 'Sin partidos')}
      ${recordCard('Mayor racha de victorias', records.bestWinStreak ? esc(teamName(records.bestWinStreak.teamId, source)) : '—', records.bestWinStreak ? `${records.bestWinStreak.bestWin} partidos` : 'Sin datos')}
      ${recordCard('Mayor invicto', records.bestUnbeaten ? esc(teamName(records.bestUnbeaten.teamId, source)) : '—', records.bestUnbeaten ? `${records.bestUnbeaten.bestUnbeaten} partidos` : 'Sin datos')}
      ${recordCard('Mayor racha sin recibir', records.bestCleanStreak ? esc(teamName(records.bestCleanStreak.teamId, source)) : '—', records.bestCleanStreak ? `${records.bestCleanStreak.bestClean} partidos` : 'Sin datos')}
      ${recordCard('Campeón más dominante', records.bestChampion ? esc(teamName(records.bestChampion.teamId, source)) : '—', records.bestChampion ? `${Math.round(records.bestChampion.performance)}% · ${esc(records.bestChampion.tournament.name)}` : 'Sin datos')}
    </div>
    <article class="cm-v521-card">${sectionHeader('MARCAS DE EQUIPOS', 'Récords acumulados', 'Comparación de las principales cifras históricas.', records.teams.length)}
      ${table(['#', 'Equipo', 'Pts', 'Victorias', 'Goles', 'DG', 'Títulos', 'Finales', 'Porterías imbatidas'], records.teams.map((row, index) => `<tr>
        <td>${medal(index)}</td><td>${teamCell(row.teamId, source)}</td><td>${row.points}</td><td>${row.pg}</td><td>${row.gf}</td><td>${row.dg > 0 ? '+' : ''}${row.dg}</td>
        <td>${row.titles}</td><td>${row.finals}</td><td>${row.cleanSheets}</td>
      </tr>`), 'No hay récords de equipos para este filtro.')}</article>
  </section>`;
}

function ensureH2HDefaults(source = state()) {
  const ids = (source.teams || []).map((team) => team.id);
  if (!ids.includes(selectedH2HA)) selectedH2HA = selectedTeam !== 'all' && ids.includes(selectedTeam) ? selectedTeam : (ids[0] || '');
  if (!ids.includes(selectedH2HB) || selectedH2HB === selectedH2HA) selectedH2HB = ids.find((id) => id !== selectedH2HA) || '';
}

function h2hPanel(tournaments, source = state()) {
  ensureH2HDefaults(source);
  const summary = h2hSummary(tournaments, selectedH2HA, selectedH2HB, source);
  const optionsA = (source.teams || []).map((team) => `<option value="${esc(team.id)}" ${team.id === selectedH2HA ? 'selected' : ''}>${esc(team.name)}</option>`).join('');
  const optionsB = (source.teams || []).map((team) => `<option value="${esc(team.id)}" ${team.id === selectedH2HB ? 'selected' : ''}>${esc(team.name)}</option>`).join('');
  const teamA = teamName(selectedH2HA, source);
  const teamB = teamName(selectedH2HB, source);

  return `<section class="cm-v521-panel" data-cm-v521-panel="h2h">
    <div class="cm-v521-panel-intro"><div><span>RIVALIDADES</span><h2>Historia Frente a Frente</h2><p>Selecciona dos clubes para revisar todos sus enfrentamientos oficiales.</p></div></div>
    <section class="cm-v521-h2h-selector"><label>Primer equipo<select data-cm-v521-h2h="a">${optionsA}</select></label><span>VS</span><label>Segundo equipo<select data-cm-v521-h2h="b">${optionsB}</select></label></section>
    <article class="cm-v521-h2h-score">
      <div>${logoUrl(selectedH2HA) ? `<img src="${esc(logoUrl(selectedH2HA))}" alt="">` : `<span>${esc(teamA.slice(0, 1))}</span>`}<b>${esc(teamA)}</b><strong>${summary.winsA}</strong><small>victorias</small></div>
      <section><b>${summary.matches.length}</b><span>partidos</span><strong>${summary.goalsA}–${summary.goalsB}</strong><small>goles históricos</small><em>${summary.draws} empates · penales ${summary.pensA}–${summary.pensB}</em></section>
      <div>${logoUrl(selectedH2HB) ? `<img src="${esc(logoUrl(selectedH2HB))}" alt="">` : `<span>${esc(teamB.slice(0, 1))}</span>`}<b>${esc(teamB)}</b><strong>${summary.winsB}</strong><small>victorias</small></div>
    </article>
    <div class="cm-v521-h2h-metrics">
      <span><b>${summary.finals}</b><small>Finales disputadas</small></span>
      <span><b>${summary.titlesA}</b><small>Títulos de ${esc(teamA)}</small></span>
      <span><b>${summary.titlesB}</b><small>Títulos de ${esc(teamB)}</small></span>
      <span><b>${summary.pensA + summary.pensB}</b><small>Series por penales</small></span>
    </div>
    <article class="cm-v521-card">${sectionHeader('CRONOLOGÍA DEL DUELO', 'Todos los enfrentamientos', filterLabel(source, tournaments), summary.recent.length)}
      ${table(['Torneo', 'Fase', 'Resultado', 'Penales', 'Sede', 'Fecha'], summary.recent.map((row) => {
        const score = matchScoreForTeams(row, selectedH2HA, selectedH2HB);
        const penalties = score.scoreA === score.scoreB && (score.pensA || score.pensB) ? `${score.pensA}–${score.pensB}` : '—';
        return `<tr><td><b>${esc(row.tournament.name)}</b></td><td>${esc(row.match.label || row.match.round || row.match.stage || 'Partido')}</td>
          <td><strong>${esc(teamA)} ${score.scoreA}–${score.scoreB} ${esc(teamB)}</strong></td><td>${penalties}</td>
          <td>${esc(row.match.venue || 'Sin sede')}</td><td>${esc(row.match.date || 'Sin fecha')}</td></tr>`;
      }), 'Estos equipos no tienen enfrentamientos dentro de los filtros seleccionados.')}</article>
  </section>`;
}
function filterOptions(source = state()) {
  const tournamentOptions = orderedTournaments(source)
    .filter((tournament) => selectedEra === 'all' || eraOf(tournament, source) === selectedEra)
    .filter((tournament) => selectedFormat === 'all' || formatGroup(tournament) === selectedFormat)
    .map((tournament) => `<option value="${esc(tournament.id)}" ${selectedTournament === tournament.id ? 'selected' : ''}>${esc(tournament.name)}</option>`).join('');
  const teamOptions = (source.teams || []).map((team) => `<option value="${esc(team.id)}" ${selectedTeam === team.id ? 'selected' : ''}>${esc(team.name)}</option>`).join('');
  return { tournamentOptions, teamOptions };
}

function activateRanking(tab) {
  selectedRanking = RANKING_TABS.some(([id]) => id === tab) ? tab : 'goals';
  localSet(storage.ranking, selectedRanking);
  document.querySelectorAll('#cmV521History [data-cm-v521-ranking]').forEach((button) => button.classList.toggle('active', button.dataset.cmV521Ranking === selectedRanking));
  document.querySelectorAll('#cmV521History [data-cm-v521-ranking-panel]').forEach((panel) => {
    const active = panel.dataset.cmV521RankingPanel === selectedRanking;
    panel.classList.toggle('active', active);
    panel.hidden = !active;
  });
}

function activateTab(tab, { focus = false } = {}) {
  selectedTab = TABS.some(([id]) => id === tab) ? tab : 'eternal';
  localSet(storage.tab, selectedTab);
  document.querySelectorAll('#cmV521History [data-cm-v521-tab]').forEach((button) => {
    const active = button.dataset.cmV521Tab === selectedTab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll('#cmV521History [data-cm-v521-panel]').forEach((panel) => {
    const active = panel.dataset.cmV521Panel === selectedTab;
    panel.classList.toggle('active', active);
    panel.hidden = !active;
  });
  activateRanking(selectedRanking);
  if (focus) document.querySelector('#cmV521History .cm-v521-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function installStyles() {
  if (document.getElementById('cmV521Styles')) return;
  const link = document.createElement('link');
  link.id = 'cmV521Styles';
  link.rel = 'stylesheet';
  link.href = `/styles/history.css?v=${window.CHUTE_APP_VERSION || VERSION}`;
  document.head.appendChild(link);
}

function migrateEras() {
  if (migrateEras.running) return false;
  const source = state();
  const next = clone(source);
  const expectedConfig = {
    statsEraSchema: 'era-stats-v2',
    statsEraCutoffName: CUTOFF_NAME,
    defaultEraId: ERA_DIVISIONS,
    statsCompleteFromEra: ERA_DIVISIONS
  };
  let changed = false;
  next.config = { ...(next.config || {}) };
  for (const [key, value] of Object.entries(expectedConfig)) {
    if (next.config[key] !== value) {
      next.config[key] = value;
      changed = true;
    }
  }
  for (const tournament of next.tournaments || []) {
    const planned = eraOf(tournament, next);
    if (tournament.eraId !== planned) {
      tournament.eraId = planned;
      changed = true;
    }
  }
  if (!changed) return false;
  migrateEras.running = true;
  try {
    core.setState(next);
    core.persistLocal?.();
    if (core.isAdmin?.() && core.cloudLoaded) void core.saveCloud?.();
  } finally {
    migrateEras.running = false;
  }
  return true;
}
migrateEras.running = false;

function renderShell() {
  if (rendering) return;
  rendering = true;
  try {
    const page = document.getElementById('estadisticas');
    if (!page) return;
    const source = state();
    if (selectedTournament !== 'all' && !(source.tournaments || []).some((tournament) => tournament.id === selectedTournament)) selectedTournament = 'all';
    if (selectedTeam !== 'all' && !(source.teams || []).some((team) => team.id === selectedTeam)) selectedTeam = 'all';
    ensureH2HDefaults(source);
    const tournaments = filteredTournaments(source);
    const h2hTournaments = filteredTournaments(source, { ignoreTeam: true });
    const metrics = heroMetrics(tournaments, source);

    [...page.children].forEach((child) => {
      if (child.id === 'cmV521History' || child.classList.contains('page-title')) return;
      child.hidden = true;
      child.setAttribute('aria-hidden', 'true');
      child.style.setProperty('display', 'none', 'important');
    });
    const title = page.querySelector('.page-title');
    if (title) title.innerHTML = '<p class="eyebrow">ARCHIVO HISTÓRICO</p><h1>Estadísticas de ChuteMundo</h1><p>Clasificaciones acumuladas, palmarés, campeones y récords oficiales.</p>';
    let host = document.getElementById('cmV521History');
    if (!host) {
      host = document.createElement('div');
      host.id = 'cmV521History';
      title?.insertAdjacentElement('afterend', host);
    }

    const options = filterOptions(source);
    const signature = JSON.stringify({
      selectedTab, selectedRanking, selectedEra, selectedTournament, selectedFormat, selectedStatus, selectedTeam, selectedH2HA, selectedH2HB,
      tournaments: tournaments.map((tournament) => [tournament.id, tournament.eraId, tournament.type, tournament.status, tournament.champion, tournament.runnerUp, tournament.third, tournament.awards, tournament.awardDetails, tournament.playerScorers, tournament.playerAssists, (tournament.matches || []).map((match) => [match.id, match.home, match.away, match.homeGoals, match.awayGoals, match.homePens, match.awayPens, match.date, match.venue, match.participationTracked, match.lineups, match.goals])]),
      teams: (source.teams || []).map((team) => [team.id, team.name, team.players])
    });
    if (host.dataset.signature === signature) {
      activateTab(selectedTab);
      return;
    }
    host.dataset.signature = signature;

    host.innerHTML = `<section class="cm-v521-hero">
      <div><span>CHUTE MUNDO · ARCHIVO OFICIAL</span><h2>${esc(filterLabel(source, tournaments))}</h2><p>Consulta la historia completa de clubes, jugadores, porteros y torneos.</p></div>
      ${metricStrip(metrics)}
    </section>
    <section class="cm-v521-toolbar">
      <header><div><span>FILTROS GLOBALES</span><b>Se aplican a todas las tablas, premios y récords</b></div><button type="button" data-cm-v521-reset>Restablecer</button></header>
      <div>
        <label>Periodo<select data-cm-v521-filter="era"><option value="all" ${selectedEra === 'all' ? 'selected' : ''}>Toda la historia</option><option value="${ERA_LEAGUES}" ${selectedEra === ERA_LEAGUES ? 'selected' : ''}>Era de ligas</option><option value="${ERA_DIVISIONS}" ${selectedEra === ERA_DIVISIONS ? 'selected' : ''}>Era de divisiones</option></select></label>
        <label>Torneo<select data-cm-v521-filter="tournament"><option value="all">Todos los torneos</option>${options.tournamentOptions}</select></label>
        <label>Formato<select data-cm-v521-filter="format">${Object.entries(FORMAT_LABELS).map(([value, label]) => `<option value="${value}" ${selectedFormat === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
        <label>Estado<select data-cm-v521-filter="status">${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${selectedStatus === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
        <label>Equipo<select data-cm-v521-filter="team"><option value="all">Todos los equipos</option>${options.teamOptions}</select></label>
      </div>
    </section>
    <nav class="cm-v521-tabs" role="tablist" aria-label="Archivo estadístico">${TABS.map(([id, label, description]) => `<button type="button" role="tab" data-cm-v521-tab="${id}" class="${selectedTab === id ? 'active' : ''}"><b>${label}</b><small>${description}</small></button>`).join('')}</nav>
    <div class="cm-v521-content">${eternalPanel(tournaments, source)}${rankingsPanel(tournaments, source)}${honoursPanel(tournaments, source)}${archivePanel(tournaments, source)}${recordsPanel(tournaments, source)}${h2hPanel(h2hTournaments, source)}</div>`;
    activateTab(selectedTab);
    document.getElementById('cmV520Stats')?.remove();
  } finally {
    rendering = false;
  }
}

function persistFilters() {
  localSet(storage.era, selectedEra);
  localSet(storage.tournament, selectedTournament);
  localSet(storage.format, selectedFormat);
  localSet(storage.status, selectedStatus);
  localSet(storage.team, selectedTeam);
  localSet(storage.h2hA, selectedH2HA);
  localSet(storage.h2hB, selectedH2HB);
}

function refresh() {
  refreshQueued = false;
  migrateEras();
  renderShell();
}

function scheduleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(refresh);
}

document.addEventListener('click', (event) => {
  const tab = event.target.closest?.('[data-cm-v521-tab]');
  if (tab) {
    event.preventDefault();
    activateTab(tab.dataset.cmV521Tab, { focus: true });
    return;
  }
  const ranking = event.target.closest?.('[data-cm-v521-ranking]');
  if (ranking) {
    event.preventDefault();
    activateRanking(ranking.dataset.cmV521Ranking);
    return;
  }
  if (event.target.closest?.('[data-cm-v521-reset]')) {
    selectedEra = 'all';
    selectedTournament = 'all';
    selectedFormat = 'all';
    selectedStatus = 'all';
    selectedTeam = 'all';
    persistFilters();
    renderShell();
    return;
  }
  const team = event.target.closest?.('[data-cm-v521-team]');
  if (team) {
    core.navigate?.('equipos');
    window.ChuteV59?.openTeamProfile?.(team.dataset.cmV521Team);
    return;
  }
  const player = event.target.closest?.('[data-cm-v521-player]');
  if (player) {
    core.navigate?.('equipos');
    window.ChuteV59?.openPlayerProfile?.(player.dataset.cmV521Player);
    return;
  }
  if (event.target.closest?.('[data-page="estadisticas"],[data-cm-page="estadisticas"],[data-cm-mobile-page="estadisticas"]')) setTimeout(scheduleRefresh, 0);
}, true);

document.addEventListener('change', (event) => {
  const filter = event.target.closest?.('[data-cm-v521-filter]');
  if (filter) {
    const type = filter.dataset.cmV521Filter;
    if (type === 'era') {
      selectedEra = filter.value;
      selectedTournament = 'all';
    }
    if (type === 'tournament') selectedTournament = filter.value;
    if (type === 'format') {
      selectedFormat = filter.value;
      selectedTournament = 'all';
    }
    if (type === 'status') selectedStatus = filter.value;
    if (type === 'team') selectedTeam = filter.value;
    persistFilters();
    renderShell();
    return;
  }
  const h2h = event.target.closest?.('[data-cm-v521-h2h]');
  if (h2h) {
    if (h2h.dataset.cmV521H2h === 'a') selectedH2HA = h2h.value;
    if (h2h.dataset.cmV521H2h === 'b') selectedH2HB = h2h.value;
    if (selectedH2HA === selectedH2HB) {
      const alternate = (state().teams || []).find((team) => team.id !== selectedH2HA)?.id || '';
      if (h2h.dataset.cmV521H2h === 'a') selectedH2HB = alternate;
      else selectedH2HA = alternate;
    }
    persistFilters();
    renderShell();
  }
}, true);

document.addEventListener('submit', () => setTimeout(scheduleRefresh, 350));
const statisticsPage = document.getElementById('estadisticas');
if (statisticsPage) new MutationObserver(() => { if (!statisticsPage.hidden) scheduleRefresh(); }).observe(statisticsPage, { attributes: true, attributeFilter: ['hidden'] });

installStyles();
scheduleRefresh();

window.ChuteV521History = {
  version: VERSION,
  refresh,
  renderShell,
  activateTab,
  eraOf,
  teamStandings,
  careerMetricRows,
  goalkeeperCareerRows,
  playerHonoursRows,
  archiveRows,
  h2hSummary
};
window.ChuteV520Stats = window.ChuteV521History;
window.ChuteV519Stats = window.ChuteV521History;
window.ChuteV518EraStats = { version: VERSION, renderShell, activateTab, migrateEras };
