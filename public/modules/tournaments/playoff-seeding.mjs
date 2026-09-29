const core = window.ChuteMundoCore;
if (!core) throw new Error('Chute Mundo no está listo para corregir los Play-Off.');

const VERSION = '5.16.3';
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

function installHotfixStyles() {
  if (document.getElementById('cmV5163PlayoffUiStyles')) return;
  const style = document.createElement('style');
  style.id = 'cmV5163PlayoffUiStyles';
  style.textContent = `
    #cmTournamentHub .cm-hub-match > footer {
      display: grid !important;
      grid-template-columns: 1fr auto;
      gap: 8px;
      align-items: center;
    }
    #cmTournamentHub .cm-hub-match > footer > div {
      display: flex !important;
      justify-content: flex-end;
      gap: 6px;
    }
    #cmTournamentHub [data-cm-hub-match] {
      visibility: visible !important;
      opacity: 1 !important;
      pointer-events: auto !important;
    }
  `;
  document.head.appendChild(style);
}

function uiContext() {
  const hub = document.getElementById('cmTournamentHub');
  const page = [...document.querySelectorAll('.page')].find((item) => !item.hidden);
  return {
    page: page?.id || '',
    tournamentId: hub?.dataset.tournamentId || '',
    activeTab: hub?.querySelector('[data-cm-tournament-tab].active')?.dataset.cmTournamentTab || ''
  };
}

let uiRefreshToken = 0;
function restoreEnhancedTournamentUi(fallbackContext = {}) {
  installHotfixStyles();
  const token = ++uiRefreshToken;
  let fallback = { ...fallbackContext };
  const refresh = () => {
    if (token !== uiRefreshToken) return;
    const current = uiContext();
    window.ChuteTournamentHub?.refresh?.();
    const rebuilt = uiContext();
    const targetPage = current.page || fallback.page;
    if (targetPage && document.getElementById(targetPage)?.hidden) core.navigate(targetPage);
    const activeTab = current.tournamentId === rebuilt.tournamentId && current.activeTab
      ? current.activeTab
      : fallback.tournamentId === rebuilt.tournamentId
        ? fallback.activeTab
        : '';
    if (activeTab) window.ChuteTournamentHub?.switchTab?.(activeTab);
    fallback = {};
    window.ChuteV511Tournaments?.refresh?.();
    window.ChuteMobileV581?.refresh?.();
    window.ChuteV514UnifiedMatch?.decorateEntryButtons?.();
  };
  window.requestAnimationFrame(() => {
    refresh();
    window.requestAnimationFrame(refresh);
  });
  window.setTimeout(refresh, 120);
  window.setTimeout(refresh, 400);
}

const originalSetState = core.setState.bind(core);
core.setState = (nextState) => {
  const previousUi = uiContext();
  const repaired = repairState(nextState);
  originalSetState(repaired.state);
  restoreEnhancedTournamentUi(previousUi);
  return repaired.state;
};

let applying = false;
let lastSavedSignature = '';

async function applyRepair() {
  if (applying) return false;
  const repaired = repairState(core.getState());
  if (!repaired.changed) return false;
  applying = true;
  const previousUi = uiContext();
  try {
    originalSetState(repaired.state);
    restoreEnhancedTournamentUi(previousUi);
    const signature = JSON.stringify((repaired.state.tournaments || []).filter((tournament) => tournament.type === 'league_playoff').map((tournament) => [tournament.id, (tournament.matches || []).filter((match) => playoffTemplate(match)).map((match) => [match.id, match.homeRef, match.awayRef, match.home, match.away])]));
    if (core.isAdmin() && core.canEdit() && core.cloudLoaded && signature !== lastSavedSignature) {
      await core.saveCloud();
      lastSavedSignature = signature;
    }
    return true;
  } catch (error) {
    console.error('No se pudo reparar la llave de Play-Off.', error);
    restoreEnhancedTournamentUi(previousUi);
    return false;
  } finally {
    applying = false;
  }
}

let cloudChecks = 0;
const cloudRepairTimer = window.setInterval(() => {
  cloudChecks += 1;
  void applyRepair();
  if (core.cloudLoaded || cloudChecks >= 16) window.clearInterval(cloudRepairTimer);
}, 500);

window.addEventListener('focus', () => { void applyRepair(); }, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) void applyRepair();
});

installHotfixStyles();
const heroVersion = document.querySelector('.hero .eyebrow');
if (heroVersion) heroVersion.textContent = 'CHUTE MUNDO v5.16.3';
document.title = 'Chute Mundo v5.16.3 · Play-Off y centro restaurados';

void applyRepair();

window.ChuteV5162PlayoffSeeding = {
  version: VERSION,
  repairState,
  repairTournament,
  playoffTemplate,
  hasRecordedActivity,
  restoreEnhancedTournamentUi,
  applyRepair
};