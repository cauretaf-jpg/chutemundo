const core = window.ChuteMundoCore;
if (!core) throw new Error('Chute Mundo no está listo para registrar fechas históricas.');

const VERSION = '5.22.1';
const CONFIRMED_DATES = Object.freeze({
  t2: { createdAt: '14 Oct 2022', date: '2022-10-14' },
  t3: { createdAt: '09 Jun 2023', date: '2023-06-09' }
});

let running = false;
let lastSignature = '';

function clone(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function signature(source) {
  return JSON.stringify((source.tournaments || [])
    .filter((tournament) => CONFIRMED_DATES[tournament.id])
    .map((tournament) => [tournament.id, tournament.createdAt || '', tournament.date || '', tournament.datePrecision || '']));
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
    if (tournament.createdAt !== confirmed.createdAt) {
      tournament.createdAt = confirmed.createdAt;
      changed = true;
    }
    if (tournament.date !== confirmed.date) {
      tournament.date = confirmed.date;
      changed = true;
    }
    if (tournament.historicalDate !== confirmed.date) {
      tournament.historicalDate = confirmed.date;
      changed = true;
    }
    if (tournament.datePrecision !== 'confirmed') {
      tournament.datePrecision = 'confirmed';
      changed = true;
    }
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
  migrateHistoricalDates
});
