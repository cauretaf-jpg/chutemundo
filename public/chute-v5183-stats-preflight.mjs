const core = window.ChuteMundoCore;
if (!core) throw new Error('Chute Mundo no está listo para normalizar estadísticas.');

const VERSION = '5.18.3';
const report = { normalizedRows: 0, inferredTeams: 0, skippedRows: 0, normalizedRosters: 0 };
const norm = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const state = core.getState?.();

if (!state || typeof state !== 'object') throw new Error('El estado compartido no está disponible.');
if (!Array.isArray(state.teams)) state.teams = [];
if (!Array.isArray(state.tournaments)) state.tournaments = [];
if (!Array.isArray(state.participants)) state.participants = [];

const teamByToken = new Map();
const playerTeams = new Map();
for (const team of state.teams) {
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

function inferTeamId(value, name) {
  const direct = teamByToken.get(String(value || '')) || teamByToken.get(norm(value));
  if (direct) return direct;
  const candidates = playerTeams.get(norm(name));
  if (candidates?.size === 1) {
    report.inferredTeams += 1;
    return [...candidates][0];
  }
  return '';
}

function normalizeMetricRow(row, kind) {
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
  const teamId = inferTeamId(teamToken, name);
  if (!name || !teamId) {
    report.skippedRows += 1;
    return null;
  }
  report.normalizedRows += 1;
  return [name, teamId, number(appearances), number(value)];
}

function normalizeMetricRows(rows, kind) {
  const source = Array.isArray(rows) ? rows : rows && typeof rows === 'object' ? Object.values(rows) : [];
  const merged = new Map();
  for (const row of source) {
    const normalized = normalizeMetricRow(row, kind);
    if (!normalized) continue;
    const [name, teamId, appearances, value] = normalized;
    const key = `${teamId}__${norm(name)}`;
    const previous = merged.get(key);
    if (!previous) merged.set(key, normalized);
    else merged.set(key, [previous[0], teamId, Math.max(previous[2], appearances), Math.max(previous[3], value)]);
  }
  return [...merged.values()];
}

for (const tournament of state.tournaments) {
  if (!tournament || typeof tournament !== 'object') continue;
  if (!Array.isArray(tournament.matches)) tournament.matches = [];
  tournament.playerScorers = normalizeMetricRows(tournament.playerScorers, 'goals');
  tournament.playerAssists = normalizeMetricRows(tournament.playerAssists, 'assists');
}

window.ChuteV5183StatsPreflight = {
  version: VERSION,
  report,
  normalizeMetricRows
};
