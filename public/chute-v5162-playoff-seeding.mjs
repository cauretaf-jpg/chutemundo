const core = window.ChuteMundoCore;
if (!core) throw new Error('Chute Mundo no está listo para corregir los Play-Off.');

const VERSION = '5.16.2';
const clone = (value) => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const normalize = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function played(match) {
  return match && match.homeGoals !== null && match.homeGoals !== '' && match.awayGoals !== null && match.awayGoals !== '';
}

function hasRecordedActivity(match) {
  if (!match) return false;
  const changes = ['home', 'away'].some((side) => Array.isArray(match.lineups?.[side]?.changes) && match.lineups[side].changes.length > 0);
  return played(match)
    || Boolean(match.participationTracked)
    || changes
    || ['goals', 'cards', 'specialEvents', 'penaltyShootout'].some((field) => Array.isArray(match[field]) && match[field].length > 0);
}

function playoffTemplate(match) {
  if (match?.stage !== 'knockout') return null;
  const round = normalize(match.round);
  const label = normalize(match.label);
  if (round.includes('semifinal') && label.includes('semifinal 1')) return { homeRef: 'TABLE_1', awayRef: 'TABLE_4' };
  if (round.includes('semifinal') && label.includes('semifinal 2')) return { homeRef: 'TABLE_2', awayRef: 'TABLE_3' };
  if (round.includes('3er') || round.includes('tercer') || label.includes('3er') || label.includes('tercer')) return { homeRef: 'S1_L', awayRef: 'S2_L' };
  if (round === 'final' || label === 'final') return { homeRef: 'S1_W', awayRef: 'S2_W' };
  return null;
}

function repairTournament(tournament) {
  if (!tournament || tournament.type !== 'league_playoff') return false;
  let changed = false;
  for (const match of tournament.matches || []) {
    const template = playoffTemplate(match);
    if (!template || hasRecordedActivity(match)) continue;
    if (match.homeRef !== template.homeRef) { match.homeRef = template.homeRef; changed = true; }
    if (match.awayRef !== template.awayRef) { match.awayRef = template.awayRef; changed = true; }
    if (match.home !== null) { match.home = null; changed = true; }
    if (match.away !== null) { match.away = null; changed = true; }
    const hasChanges = ['home', 'away'].some((side) => Array.isArray(match.lineups?.[side]?.changes) && match.lineups[side].changes.length > 0);
    if (match.lineups && !hasChanges) { match.lineups = null; changed = true; }
  }
  return changed;
}

function repairState(source) {
  const next = clone(source || {});
  let changed = false;
  for (const tournament of next.tournaments || []) changed = repairTournament(tournament) || changed;
  return { state: next, changed };
}

const originalSetState = core.setState.bind(core);
core.setState = (nextState) => originalSetState(repairState(nextState).state);

let applying = false;
let scheduled = false;
let lastSavedSignature = '';

async function applyRepair() {
  scheduled = false;
  if (applying) return false;
  const repaired = repairState(core.getState());
  if (!repaired.changed) return false;
  applying = true;
  try {
    originalSetState(repaired.state);
    const signature = JSON.stringify((repaired.state.tournaments || []).filter((tournament) => tournament.type === 'league_playoff').map((tournament) => [tournament.id, (tournament.matches || []).filter((match) => playoffTemplate(match)).map((match) => [match.id, match.homeRef, match.awayRef, match.home, match.away])]));
    if (core.isAdmin() && core.canEdit() && core.cloudLoaded && signature !== lastSavedSignature) {
      lastSavedSignature = signature;
      await core.saveCloud();
    }
    return true;
  } catch (error) {
    console.error('No se pudo reparar la llave de Play-Off.', error);
    return false;
  } finally {
    applying = false;
  }
}

function scheduleRepair() {
  if (scheduled || applying) return;
  scheduled = true;
  window.requestAnimationFrame(() => { applyRepair(); });
}

new MutationObserver(scheduleRepair).observe(document.body, { childList: true, subtree: true });
document.addEventListener('chute:ready', scheduleRepair);
window.addEventListener('focus', scheduleRepair, { passive: true });

const heroVersion = document.querySelector('.hero .eyebrow');
if (heroVersion) heroVersion.textContent = 'CHUTE MUNDO v5.16.2';
document.title = 'Chute Mundo v5.16.2 · Play-Off corregidos';

scheduleRepair();

window.ChuteV5162PlayoffSeeding = {
  version: VERSION,
  repairState,
  repairTournament,
  playoffTemplate,
  hasRecordedActivity,
  applyRepair
};
