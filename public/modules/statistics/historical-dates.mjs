const core = window.ChuteMundoCore;
if (!core) throw new Error('Chute Mundo no está listo para registrar fechas históricas.');

const VERSION = '5.22.2';

const CONFIRMED_DATES = Object.freeze({
  t2: {
    createdAt: '14 Oct 2022',
    date: '2022-10-14',
    startDate: '2022-10-14',
    endDate: '2022-10-14'
  },
  t3: {
    createdAt: '09 Jun 2023',
    date: '2023-06-09',
    startDate: '2023-06-09',
    endDate: '2023-06-09'
  },
  t4: {
    createdAt: '17 Jun 2023 / 24 Jun 2023',
    date: '2023-06-17',
    startDate: '2023-06-17',
    endDate: '2023-06-24'
  },
  t5: {
    createdAt: '24 Jun 2023 / 20 Ago 2023',
    date: '2023-06-24',
    startDate: '2023-06-24',
    endDate: '2023-08-20'
  },
  t6: {
    createdAt: '06 Abr 2024 / 12 May 2024',
    date: '2024-04-06',
    startDate: '2024-04-06',
    endDate: '2024-05-12'
  },
  t7: {
    createdAt: '18 Abr 2025 / 05 Abr 2026',
    date: '2025-04-18',
    startDate: '2025-04-18',
    endDate: '2026-04-05'
  }
});

const MATCH_SCHEDULE = Object.freeze({
  t4: Object.freeze({
    t4j1a: ['2023-06-17', '02:19'],
    t4j1b: ['2023-06-17', '03:07'],
    t4j1c: ['2023-06-17', '03:45'],
    t4j2a: ['2023-06-17', '04:33'],
    t4j2b: ['2023-06-17', '05:08'],
    t4j2c: ['2023-06-17', '13:51'],
    t4j3a: ['2023-06-17', '23:40'],
    t4j3b: ['2023-06-18', '00:10'],
    t4j3c: ['2023-06-18', '00:54'],
    t4j4a: ['2023-06-18', '01:40'],
    t4j4b: ['2023-06-18', '02:17'],
    t4j4c: ['2023-06-18', '11:55'],
    t4j5a: ['2023-06-18', '12:37'],
    t4j5b: ['2023-06-23', '18:54'],
    t4j5c: ['2023-06-23', '19:50'],
    t4s1: ['2023-06-23', '21:02'],
    t4s2: ['2023-06-23', '22:40'],
    t4t: ['2023-06-23', '23:38'],
    t4f: ['2023-06-24', '00:30']
  }),
  t5: Object.freeze({
    t5j1a: ['2023-06-24', '01:35'],
    t5j1b: ['2023-06-24', '02:20'],
    t5j1c: ['2023-06-24', '03:06'],
    t5j2a: ['2023-06-24', '04:17'],
    t5j2b: ['2023-06-24', '05:20'],
    t5j2c: ['2023-06-24', '19:40'],
    t5j3a: ['2023-06-24', '20:48'],
    t5j3b: ['2023-06-24', '21:40'],
    t5j3c: ['2023-06-24', '22:00'],
    t5j4a: ['2023-06-24', '23:00'],
    t5j4b: ['2023-06-25', '00:10'],
    t5j4c: ['2023-06-25', '01:45'],
    t5j5a: ['2023-06-25', '02:30'],
    t5j5b: ['2023-06-25', '03:16'],
    t5j5c: ['2023-06-25', '04:20'],
    t5s1: ['2023-06-25', '15:29'],
    t5s2: ['2023-06-25', '16:11'],
    t5t: ['2023-06-25', '17:02'],
    t5f: ['2023-08-20', '13:40']
  })
});

let running = false;
let lastSignature = '';

function clone(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function tournamentSnapshot(tournament) {
  return [
    tournament.id,
    tournament.createdAt || '',
    tournament.date || '',
    tournament.startDate || '',
    tournament.endDate || '',
    tournament.historicalDate || '',
    tournament.datePrecision || '',
    (tournament.matches || []).map((match) => [match.id, match.date || '', match.time || '', match.datePrecision || ''])
  ];
}

function signature(source) {
  return JSON.stringify((source.tournaments || [])
    .filter((tournament) => CONFIRMED_DATES[tournament.id])
    .map(tournamentSnapshot));
}

function setValue(target, key, value) {
  if (target[key] === value) return false;
  target[key] = value;
  return true;
}

function applyTournamentDates(tournament, confirmed) {
  let changed = false;
  changed = setValue(tournament, 'createdAt', confirmed.createdAt) || changed;
  changed = setValue(tournament, 'date', confirmed.date) || changed;
  changed = setValue(tournament, 'startDate', confirmed.startDate) || changed;
  changed = setValue(tournament, 'endDate', confirmed.endDate) || changed;
  changed = setValue(tournament, 'historicalDate', confirmed.date) || changed;
  changed = setValue(tournament, 'datePrecision', 'confirmed') || changed;
  return changed;
}

function applyExactMatchSchedule(tournament) {
  const schedule = MATCH_SCHEDULE[tournament.id];
  if (!schedule) return false;
  let changed = false;
  for (const match of tournament.matches || []) {
    const row = schedule[match.id];
    if (!row) continue;
    changed = setValue(match, 'date', row[0]) || changed;
    changed = setValue(match, 'time', row[1]) || changed;
    changed = setValue(match, 'datePrecision', 'confirmed') || changed;
  }
  return changed;
}

function applySeventhTournamentPhases(tournament) {
  if (tournament.id !== 't7') return false;
  let changed = false;
  for (const match of tournament.matches || []) {
    const date = match.stage === 'knockout' ? '2026-04-05' : '2025-04-18';
    changed = setValue(match, 'date', date) || changed;
    changed = setValue(match, 'datePrecision', 'confirmed') || changed;
  }
  return changed;
}

function migrateHistoricalDates() {
  if (running) return false;
  const source = core.getState?.();
  if (!source) return false;
  const before = signature(source);
  if (before === lastSignature) return false;

  const next = clone(source);
  let changed = false;
  for (const tournament of next.tournaments || []) {
    const confirmed = CONFIRMED_DATES[tournament.id];
    if (!confirmed) continue;
    changed = applyTournamentDates(tournament, confirmed) || changed;
    changed = applyExactMatchSchedule(tournament) || changed;
    changed = applySeventhTournamentPhases(tournament) || changed;
  }

  lastSignature = changed ? signature(next) : before;
  if (!changed) return false;
  running = true;
  try {
    core.setState(next);
    core.persistLocal?.();
    if (core.isAdmin?.() && core.cloudLoaded) void core.saveCloud?.();
  } finally {
    running = false;
  }
  return true;
}

migrateHistoricalDates();
document.addEventListener('chute:ready', migrateHistoricalDates);
document.addEventListener('chute:boot-complete', migrateHistoricalDates);

window.ChuteV522HistoricalDates = Object.freeze({
  version: VERSION,
  dates: CONFIRMED_DATES,
  matchSchedule: MATCH_SCHEDULE,
  migrateHistoricalDates
});
