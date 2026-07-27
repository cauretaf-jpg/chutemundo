const core = window.ChuteMundoCore;
if (!core) throw new Error('Chute Mundo no está listo para completar las estadísticas históricas.');

const VERSION = '5.25.2';
const PATCH_VERSION = 'historical-player-stats-t4-t7-v1';
const UPDATED_AT = Date.parse('2026-07-26T23:59:00Z');
const CLOUD_KEY = `cm_${PATCH_VERSION}_cloud_saved`;
const clone = (value) => JSON.parse(JSON.stringify(value));
const metricTotal = (rows = []) => rows.reduce((sum, row) => sum + Number(row?.[3] || 0), 0);
const officialGoalTotal = (tournament) => (tournament.matches || [])
  .filter((match) => match.stage !== 'bye' && core.matchPlayed(match))
  .reduce((sum, match) => sum + Number(match.homeGoals || 0) + Number(match.awayGoals || 0), 0);

const PATCHES = Object.freeze({
  t4: Object.freeze({
    name: '4to Torneo - Apertura',
    scorers: Object.freeze([
      ['Giulio Locatelli', 'polpetta', 7, 12],
      ['Rod Lete', 'parrilla', 5, 6],
      ['Eric Perry', 'trucha', 4, 4],
      ['Boris Lentz', 'trucha', 4, 4],
      ['Luis Felipe', 'parrilla', 4, 3],
      ['El Kraken', 'perla', 4, 3],
      ['Sharon Ortiz', 'pantera', 3, 3],
      ['Dino Richi', 'trucha', 3, 3],
      ['Alessandro Zito', 'polpetta', 1, 3],
      ['Nick Cabezon', 'parrilla', 4, 2],
      ['Marty Love', 'perla', 4, 2],
      ['Julio Vega', 'perla', 4, 2],
      ['Sid Koslowski', 'guanaco', 3, 2],
      ['El Profesor', 'parrilla', 3, 2],
      ['Nancy King', 'pantera', 2, 2],
      ['Cindy Fitzgerald', 'pantera', 2, 2],
      ['Randolph Salazar', 'perla', 4, 1],
      ['Sonny Saldana', 'guanaco', 3, 1],
      ['Ricky Watkins', 'trucha', 3, 1],
      ['Lonny Ventura', 'guanaco', 3, 1],
      ['Kelly Rivera', 'trucha', 3, 1],
      ['Faustino Soriano', 'trucha', 3, 1],
      ['Roxie Jones', 'pantera', 2, 1],
      ['Nicola Pisani', 'polpetta', 2, 1],
      ['Freddo Bellini', 'polpetta', 2, 1]
    ]),
    assists: Object.freeze([
      ['Burt McCloskey', 'trucha', 5, 4],
      ['Eusebio Flowers', 'perla', 5, 3],
      ['Mario Luna', 'trucha', 4, 3],
      ['Vito Volta', 'polpetta', 2, 3],
      ['Toyo Takahashi', 'perla', 4, 2],
      ['John Giovanni', 'parrilla', 4, 2],
      ['Eddy Pino', 'trucha', 4, 2],
      ['Donald Ortega', 'trucha', 3, 2],
      ['Giorgio Valentino', 'polpetta', 1, 2],
      ['Randolph Salazar', 'perla', 4, 1],
      ['Wilfredo Fernández', 'trucha', 3, 1],
      ["Randolph D'Luna", 'parrilla', 3, 1],
      ['Peta Zeta', 'parrilla', 3, 1],
      ['Dominic Mortensen', 'trucha', 3, 1],
      ['Dino Richi', 'trucha', 3, 1],
      ['Carmelo Wilkinson', 'guanaco', 3, 1],
      ['Bo de la Rosa', 'guanaco', 3, 1],
      ['Rocco Carusso', 'polpetta', 2, 1],
      ['Rebeca Sanders', 'pantera', 2, 1],
      ['Margaret Castillo', 'pantera', 2, 1],
      ['Lina Yamamoto', 'pantera', 2, 1],
      ['Fiorino Panicucci', 'polpetta', 2, 1],
      ['Fabio Clemenza', 'polpetta', 2, 1],
      ['Belinda Sparks', 'pantera', 2, 1]
    ]),
    expected: Object.freeze({ scorerRows: 25, goals: 64, assistRows: 24, assists: 38 })
  }),
  t5: Object.freeze({
    name: '5to Torneo - Clausura',
    scorers: Object.freeze([
      ['Giulio Locatelli', 'polpetta', 7, 18],
      ['Luis Felipe', 'parrilla', 6, 17],
      ['Sid Koslowski', 'guanaco', 5, 7],
      ['Cindy Fitzgerald', 'pantera', 7, 5],
      ['El Kraken', 'perla', 6, 5],
      ['Jackie Sanchez', 'pantera', 4, 3],
      ['Faustino Soriano', 'trucha', 4, 3],
      ['Alessandro Zito', 'polpetta', 3, 3],
      ['Julio Vega', 'perla', 5, 2],
      ['Eric Perry', 'trucha', 4, 2],
      ['El Profesor', 'parrilla', 3, 2],
      ['Irwin Medeiros', 'guanaco', 1, 2],
      ['Sharon Ortiz', 'pantera', 5, 1],
      ['Randolph Salazar', 'perla', 5, 1],
      ['Eric Reyes', 'perla', 5, 1],
      ['Rod Lete', 'parrilla', 4, 1],
      ['Nick Cabezon', 'parrilla', 2, 1]
    ]),
    assists: Object.freeze([
      ['Vito Volta', 'polpetta', 5, 6],
      ['Joe Pavo', 'parrilla', 3, 5],
      ['Rod Lete', 'parrilla', 4, 3],
      ['Randolph Salazar', 'perla', 5, 2],
      ['Donald Ortega', 'trucha', 4, 2],
      ['Belinda Sparks', 'pantera', 4, 2],
      ['Giulio Locatelli', 'polpetta', 7, 1],
      ['Sammy Portillo', 'perla', 5, 1],
      ['Nora Cruz', 'pantera', 5, 1],
      ['Lina Yamamoto', 'pantera', 5, 1],
      ['Eusebio Flowers', 'perla', 5, 1],
      ['Burt McCloskey', 'trucha', 3, 1],
      ['Angelo Carboni', 'trucha', 3, 1],
      ['Mario De Luca', 'polpetta', 2, 1],
      ['Fiorino Panicucci', 'polpetta', 2, 1],
      ['Enzo Mancini', 'polpetta', 2, 1],
      ['Alex Meres', 'parrilla', 2, 1],
      ['Rosendo Acosta', 'guanaco', 1, 1],
      ['Irwin Medeiros', 'guanaco', 1, 1],
      ['Harley Peralta', 'guanaco', 1, 1],
      ['Donovan Vinson', 'guanaco', 1, 1],
      ['Donnie Spumoni', 'polpetta', 1, 1]
    ]),
    expected: Object.freeze({ scorerRows: 17, goals: 74, assistRows: 22, assists: 36 })
  }),
  t6: Object.freeze({
    name: '6to Torneo - Copa SuPizza',
    scorers: Object.freeze([
      ['Giulio Locatelli', 'polpetta', 3, 6],
      ['El Kraken', 'perla', 2, 3],
      ['Boris Lentz', 'trucha', 2, 3],
      ['Omar Watson', 'perla', 1, 2],
      ['Lonny Ventura', 'guanaco', 3, 1],
      ['Roxie Jones', 'pantera', 2, 1],
      ['Sammy Portillo', 'perla', 1, 1],
      ['Marty Love', 'perla', 1, 1],
      ['Julio Vega', 'perla', 1, 1]
    ]),
    assists: Object.freeze([
      ['Rosendo Acosta', 'guanaco', 3, 2],
      ['Eusebio Flowers', 'perla', 1, 2],
      ['Kelly Rivera', 'trucha', 2, 1],
      ['Angelo Carboni', 'trucha', 2, 1],
      ['Vito Volta', 'polpetta', 1, 1],
      ['Toyo Takahashi', 'perla', 1, 1],
      ['Melvin Clayton', 'perla', 1, 1],
      ['Lucius Chase', 'perla', 1, 1],
      ['Eric Reyes', 'perla', 1, 1],
      ['Enzo Mancini', 'polpetta', 1, 1],
      ['Archie Jackson', 'perla', 1, 1]
    ]),
    expected: Object.freeze({ scorerRows: 9, goals: 19, assistRows: 11, assists: 13 })
  }),
  t7: Object.freeze({
    name: '7mo Torneo - Apertura CoPascua',
    scorers: Object.freeze([
      ['El Kraken', 'perla', 7, 10],
      ['Luis Felipe', 'parrilla', 7, 6],
      ['Sharon Ortiz', 'pantera', 5, 4],
      ['Faustino Soriano', 'trucha', 6, 3],
      ['Julio Vega', 'perla', 5, 3],
      ['Jackie Sanchez', 'pantera', 3, 3],
      ['Steven Ramos', 'perla', 5, 2],
      ['Nick Cabezon', 'parrilla', 5, 2],
      ['Giulio Locatelli', 'polpetta', 5, 2],
      ['Eric Perry', 'trucha', 5, 2],
      ['El Profesor', 'parrilla', 5, 2],
      ['Rod Lete', 'parrilla', 5, 1],
      ['Ricky Watkins', 'trucha', 5, 1],
      ['Kelly Rivera', 'trucha', 5, 1],
      ['Freddy Manfredo', 'parrilla', 5, 1],
      ['Roxie Jones', 'pantera', 3, 1],
      ['Donovan Vinson', 'guanaco', 3, 1],
      ['Sonny Saldana', 'guanaco', 2, 1],
      ['Lonny Ventura', 'guanaco', 2, 1]
    ]),
    assists: Object.freeze([
      ["Randolph D'Luna", 'parrilla', 6, 5],
      ['Rebeca Sanders', 'pantera', 3, 3],
      ['Boris Lentz', 'trucha', 6, 2],
      ['Wilfredo Fernández', 'trucha', 5, 2],
      ['Joe Pavo', 'parrilla', 5, 2],
      ['Eusebio Flowers', 'perla', 5, 2],
      ['Nora Cruz', 'pantera', 3, 2],
      ['El Kraken', 'perla', 7, 1],
      ['Mario Luna', 'trucha', 5, 1],
      ['Eric Perry', 'trucha', 5, 1],
      ['Donald Ortega', 'trucha', 5, 1],
      ['Sammy Portillo', 'perla', 4, 1],
      ['Lucius Chase', 'perla', 4, 1],
      ['Archie Jackson', 'perla', 4, 1],
      ['Lina Yamamoto', 'pantera', 3, 1],
      ['Donovan Vinson', 'guanaco', 3, 1],
      ['Rosendo Acosta', 'guanaco', 2, 1],
      ['Irwin Medeiros', 'guanaco', 2, 1]
    ]),
    expected: Object.freeze({ scorerRows: 19, goals: 47, assistRows: 18, assists: 29 })
  })
});

function playerName(entry) {
  return Array.isArray(entry) ? String(entry[0] || '') : String(entry?.name || '');
}

function normalizeName(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function editDistance(left = '', right = '') {
  const a = String(left);
  const b = String(right);
  const rows = Array.from({ length: a.length + 1 }, (_, index) => [index]);
  for (let column = 0; column <= b.length; column += 1) rows[0][column] = column;
  for (let row = 1; row <= a.length; row += 1) {
    for (let column = 1; column <= b.length; column += 1) {
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1)
      );
    }
  }
  return rows[a.length][b.length];
}

function candidateScore(requested, candidate) {
  const query = normalizeName(requested);
  const current = normalizeName(candidate);
  if (!query || !current) return 0;
  if (query === current) return 100;
  const queryTokens = query.split(' ');
  const currentTokens = current.split(' ');
  let score = 0;
  if (query.includes(current) || current.includes(query)) score += 20;
  if (queryTokens[0] === currentTokens[0]) score += 8;
  if (queryTokens.at(-1) === currentTokens.at(-1)) score += 8;
  else if (editDistance(queryTokens.at(-1), currentTokens.at(-1)) <= 1) score += 5;
  score += queryTokens.filter((token) => currentTokens.includes(token)).length * 2;
  return score;
}

function resolveRosterName(source, teamId, requestedName) {
  const team = (source.teams || []).find((item) => item.id === teamId);
  const roster = (team?.players || []).map(playerName).filter(Boolean);
  const exact = roster.find((name) => name === requestedName);
  if (exact) return exact;
  const normalized = roster.find((name) => normalizeName(name) === normalizeName(requestedName));
  if (normalized) return normalized;
  const ranked = roster.map((name) => ({ name, score: candidateScore(requestedName, name) })).sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, 'es'));
  if (ranked[0]?.score >= 8 && (!ranked[1] || ranked[0].score > ranked[1].score)) return ranked[0].name;
  throw new Error(`No se encontró un nombre canónico único para ${requestedName} en ${teamId}.`);
}

function canonicalRows(source, rows) {
  const canonical = rows.map(([name, teamId, appearances, value]) => [resolveRosterName(source, teamId, name), teamId, Number(appearances || 0), Number(value || 0)]);
  const seen = new Set();
  for (const [name, teamId] of canonical) {
    const key = `${teamId}__${name}`;
    if (seen.has(key)) throw new Error(`La migración histórica duplicó a ${name} en ${teamId}.`);
    seen.add(key);
  }
  return canonical;
}

function validatePatch(source, tournamentId, patch) {
  const scorerGoals = metricTotal(patch.scorers);
  const assists = metricTotal(patch.assists);
  if (patch.scorers.length !== patch.expected.scorerRows || scorerGoals !== patch.expected.goals || patch.assists.length !== patch.expected.assistRows || assists !== patch.expected.assists) {
    throw new Error(`La tabla histórica ${tournamentId} no coincide con sus totales esperados.`);
  }
  return {
    scorers: canonicalRows(source, patch.scorers),
    assists: canonicalRows(source, patch.assists)
  };
}

function patchSignature(source) {
  return JSON.stringify(Object.keys(PATCHES).map((id) => {
    const tournament = (source.tournaments || []).find((item) => item.id === id);
    return [id, tournament?.historicalPlayerStatsVersion || '', tournament?.playerScorers || [], tournament?.playerAssists || []];
  }));
}

function patchedCompletely(source) {
  return Object.keys(PATCHES).every((id) => {
    const tournament = (source.tournaments || []).find((item) => item.id === id);
    return tournament?.historicalPlayerStatsVersion === PATCH_VERSION;
  });
}

let busy = false;
let refreshQueued = false;
let saveTimer = null;

function scheduleCloudSave() {
  if (!core.isAdmin?.() || !core.cloudLoaded || localStorage.getItem(CLOUD_KEY) === PATCH_VERSION) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!core.isAdmin?.() || !core.cloudLoaded || !patchedCompletely(core.getState())) return;
    try {
      await core.saveCloud();
      localStorage.setItem(CLOUD_KEY, PATCH_VERSION);
      core.showToast?.('Estadísticas históricas de los torneos 4.º al 7.º sincronizadas.');
    } catch (error) {
      console.error('No se pudieron sincronizar las estadísticas históricas.', error);
    }
  }, 300);
}

function applyPatch() {
  refreshQueued = false;
  if (busy) return false;
  const source = core.getState();
  const before = patchSignature(source);
  const next = clone(source);
  let found = 0;

  for (const [id, patch] of Object.entries(PATCHES)) {
    const tournament = (next.tournaments || []).find((item) => item.id === id);
    if (!tournament) continue;
    found += 1;
    const canonical = validatePatch(next, id, patch);
    tournament.playerScorers = canonical.scorers;
    tournament.playerAssists = canonical.assists;
    tournament.historicalPlayerStatsVersion = PATCH_VERSION;
    tournament.historicalPlayerStatsSource = 'Tablas históricas verificadas por el administrador';
    tournament.historicalPlayerStatsUpdatedAt = UPDATED_AT;
    const recordedGoals = metricTotal(tournament.playerScorers);
    const officialGoals = officialGoalTotal(tournament);
    tournament.coverage = {
      ...(tournament.coverage || {}),
      scorers: officialGoals > 0 && recordedGoals >= officialGoals ? 'complete' : 'partial',
      assists: tournament.playerAssists.length ? 'partial' : 'none',
      updatedAt: UPDATED_AT
    };
  }

  if (found !== Object.keys(PATCHES).length) return false;
  const after = patchSignature(next);
  if (before !== after) {
    busy = true;
    try {
      core.setState(next);
      core.persistLocal?.();
    } finally {
      busy = false;
    }
  }
  if (patchedCompletely(core.getState())) scheduleCloudSave();
  return before !== after;
}

function scheduleApply() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(applyPatch);
}

document.addEventListener('chute:ready', scheduleApply);
new MutationObserver(scheduleApply).observe(document.body, { childList: true, subtree: true });
scheduleApply();

window.ChuteHistoricalStatsV5252 = Object.freeze({
  version: VERSION,
  patchVersion: PATCH_VERSION,
  patches: PATCHES,
  apply: applyPatch,
  resolveRosterName: (teamId, name) => resolveRosterName(core.getState(), teamId, name),
  totals: () => Object.fromEntries(Object.entries(PATCHES).map(([id, patch]) => [id, {
    scorerRows: patch.scorers.length,
    goals: metricTotal(patch.scorers),
    assistRows: patch.assists.length,
    assists: metricTotal(patch.assists)
  }]))
});
