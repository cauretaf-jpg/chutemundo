const core = window.ChuteMundoCore;
if (!core) throw new Error('Chute Mundo no está listo para normalizar estadísticas.');

const VERSION = '5.18.3';
const report = { normalizedRows: 0, inferredTeams: 0, skippedRows: 0, normalizedRosters: 0, passes: 0, guardedStates: 0 };
const norm = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
let queued = false;

function indexes(state) {
  const teamByToken = new Map();
  const playerTeams = new Map();
  for (const team of state.teams || []) {
    if (!team || typeof team !== 'object') continue;
    teamByToken.set(String(team.id || ''), team.id);
    teamByToken.set(norm(team.id), team.id);
    teamByToken.set(norm(team.name), team.id);
    if (!Array.isArray(team.players)) {
      team.players = team.players && typeof team.players === 'object' ? Object.values(team.players) : [];
      report.normalizedRosters += 1;
    }
    for (const entry of team.players) {
      const name = Array.isArray(entry) ? entry[0] : entry?.name;
      if (!name) continue;
      const key = norm(name);
      if (!playerTeams.has(key)) playerTeams.set(key, new Set());
      playerTeams.get(key).add(team.id);
    }
  }
  return { teamByToken, playerTeams };
}

function inferTeamId(value, name, lookup) {
  const direct = lookup.teamByToken.get(String(value || '')) || lookup.teamByToken.get(norm(value));
  if (direct) return direct;
  const candidates = lookup.playerTeams.get(norm(name));
  if (candidates?.size === 1) {
    report.inferredTeams += 1;
    return [...candidates][0];
  }
  return '';
}

function normalizeMetricRow(row, kind, lookup) {
  let name = '';
  let teamToken = '';
  let appearances = 0;
  let value = 0;
  if (Array.isArray(row)) {
    name = row[0] ?? '';
    teamToken = row[1] ?? '';
    appearances = row[2] ?? 0;
    value = row[3] ?? row[2] ?? 0;
  } else if (row && typeof row === 'object') {
    name = row.name ?? row.playerName ?? row.player ?? row.scorer ?? row.assist ?? '';
    teamToken = row.teamId ?? row.team ?? row.clubId ?? row.club ?? '';
    appearances = row.appearances ?? row.matches ?? row.games ?? row.pj ?? 0;
    value = kind === 'goals'
      ? (row.goals ?? row.value ?? row.total ?? row.count ?? 0)
      : (row.assists ?? row.value ?? row.total ?? row.count ?? 0);
  } else if (typeof row === 'string') {
    name = row;
  }
  name = String(name || '').trim();
  const teamId = inferTeamId(teamToken, name, lookup);
  if (!name || !teamId) {
    report.skippedRows += 1;
    return null;
  }
  report.normalizedRows += 1;
  return [name, teamId, number(appearances), number(value)];
}

function normalizeMetricRows(rows, kind, state = core.getState?.()) {
  const lookup = indexes(state || { teams: [] });
  const source = Array.isArray(rows) ? rows : rows && typeof rows === 'object' ? Object.values(rows) : [];
  const merged = new Map();
  for (const row of source) {
    const normalized = normalizeMetricRow(row, kind, lookup);
    if (!normalized) continue;
    const [name, teamId, appearances, value] = normalized;
    const key = `${teamId}__${norm(name)}`;
    const previous = merged.get(key);
    if (!previous) merged.set(key, normalized);
    else merged.set(key, [previous[0], teamId, Math.max(previous[2], appearances), Math.max(previous[3], value)]);
  }
  return [...merged.values()];
}

function rowIsCanonical(row, state) {
  return Array.isArray(row) && row.length >= 4 && typeof row[0] === 'string' && (state.teams || []).some((team) => team.id === row[1]);
}

function normalizeState(target = core.getState?.()) {
  if (!target || typeof target !== 'object') return false;
  if (!Array.isArray(target.teams)) target.teams = [];
  if (!Array.isArray(target.tournaments)) target.tournaments = [];
  if (!Array.isArray(target.participants)) target.participants = [];
  indexes(target);
  let changed = false;
  for (const tournament of target.tournaments) {
    if (!tournament || typeof tournament !== 'object') continue;
    if (!Array.isArray(tournament.matches)) { tournament.matches = []; changed = true; }
    const scorerRows = Array.isArray(tournament.playerScorers) ? tournament.playerScorers : tournament.playerScorers && typeof tournament.playerScorers === 'object' ? Object.values(tournament.playerScorers) : [];
    const assistRows = Array.isArray(tournament.playerAssists) ? tournament.playerAssists : tournament.playerAssists && typeof tournament.playerAssists === 'object' ? Object.values(tournament.playerAssists) : [];
    if (!Array.isArray(tournament.playerScorers) || scorerRows.some((row) => !rowIsCanonical(row, target))) {
      tournament.playerScorers = normalizeMetricRows(scorerRows, 'goals', target);
      changed = true;
    }
    if (!Array.isArray(tournament.playerAssists) || assistRows.some((row) => !rowIsCanonical(row, target))) {
      tournament.playerAssists = normalizeMetricRows(assistRows, 'assists', target);
      changed = true;
    }
  }
  report.passes += 1;
  return changed;
}

function installSetStateGuard() {
  if (typeof core.setState !== 'function' || core.setState.__cmV5183Guard) return false;
  const originalSetState = core.setState.bind(core);
  const guardedSetState = (next, ...args) => {
    normalizeState(next);
    report.guardedStates += 1;
    return originalSetState(next, ...args);
  };
  Object.defineProperty(guardedSetState, '__cmV5183Guard', { value: true });
  Object.defineProperty(guardedSetState, 'original', { value: originalSetState });
  core.setState = guardedSetState;
  return true;
}

function scheduleNormalization() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    normalizeState();
    installSetStateGuard();
  });
}

normalizeState();
installSetStateGuard();
new MutationObserver(scheduleNormalization).observe(document.body, { childList: true, subtree: true });
document.addEventListener('chute:ready', scheduleNormalization);
document.addEventListener('chute:state', scheduleNormalization);

window.ChuteV5183StatsPreflight = {
  version: VERSION,
  report,
  normalizeMetricRows,
  normalizeState,
  installSetStateGuard,
  scheduleNormalization
};
