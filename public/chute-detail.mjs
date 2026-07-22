document.title = 'Chute Mundo v5.8.1 · Competición oficial';
const heroVersion = document.querySelector('.hero .eyebrow');
if (heroVersion) heroVersion.textContent = 'CHUTE MUNDO v5.8.1';
const brandDetail = document.querySelector('.brand small');
if (brandDetail) brandDetail.textContent = 'Competición, análisis histórico, divisiones, disciplina, sedes, planteles y estadísticas · Firebase';
const description = document.querySelector('meta[name="description"]');
if (description) description.content = 'Plataforma deportiva de Chute Mundo con análisis histórico, divisiones, disciplina, sedes y estadísticas optimizadas.';

function loadStyle(href, marker) {
  if (document.querySelector(`link[href*="${marker}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function installV581CompatibilityStyles() {
  if (document.getElementById('cmV581CompatibilityStyles')) return;
  const style = document.createElement('style');
  style.id = 'cmV581CompatibilityStyles';
  style.textContent = `
    .cm-v581-stats-status{margin:0 0 18px;padding:18px 20px;border:1px solid #d7e3dd;border-radius:18px;background:#fff;box-shadow:0 8px 22px rgba(7,42,31,.06);color:#52645c}
    .cm-v581-stats-status strong{display:block;margin-bottom:5px;color:#15382c;font-size:1rem}
    .cm-v581-stats-status p{margin:0;line-height:1.5}
    .cm-v581-stats-status.is-error{border-color:#e6b9bd;background:#fff7f7;color:#7d3339}
    .cm-v581-stats-status button{margin-top:12px;border:0;border-radius:999px;padding:9px 14px;background:#0b7655;color:#fff;font-weight:800}
    .cm-v581-bracket-tabs{display:none}
    @media(max-width:700px){
      html,body{max-width:100%;overflow-x:hidden}
      #torneos,#tournamentDetail,.cm-tournament-hub,.cm-hub-panels,.cm-hub-panel{min-width:0;max-width:100%}
      .cm-hub-tabs{max-width:100%}
      .cm-hub-panel[data-cm-tournament-panel="bracket"]{overflow:hidden}
      .cm-hub-bracket{max-width:100%;overflow:visible!important;padding:0!important}
      .cm-v581-bracket-tabs{display:flex;gap:7px;max-width:100%;margin:0 0 14px;padding:6px;overflow-x:auto;border:1px solid #dce5e0;border-radius:16px;background:#fff;box-shadow:0 7px 18px rgba(7,42,31,.05);scrollbar-width:none}
      .cm-v581-bracket-tabs::-webkit-scrollbar{display:none}
      .cm-v581-bracket-tabs button{flex:1 0 auto;min-width:92px;min-height:40px;border:0;border-radius:11px;padding:8px 11px;background:#edf3f0;color:#50645b;font-size:.72rem;font-weight:850;white-space:nowrap}
      .cm-v581-bracket-tabs button.active{background:linear-gradient(135deg,#0a6f51,#11916a);color:#fff;box-shadow:0 6px 15px rgba(9,111,80,.18)}
      .cm-hub-bracket-grid{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important}
      .cm-hub-bracket-round{display:none!important;width:100%;min-width:0;gap:10px}
      .cm-hub-bracket-round.cm-v581-mobile-active{display:grid!important}
      .cm-hub-bracket-round>header{width:100%}
      .cm-hub-bracket-game{width:100%;max-width:100%;min-width:0}
      .cm-hub-bracket-side{grid-template-columns:31px minmax(0,1fr) auto}
    }
  `;
  document.head.appendChild(style);
}

installV581CompatibilityStyles();

for (const [href, marker] of [
  ['/chute-detail.css?v=5.8.1', 'chute-detail.css'],
  ['/chute-premium.css?v=5.8.1', 'chute-premium.css'],
  ['/chute-premium-overrides.css?v=5.8.1', 'chute-premium-overrides.css'],
  ['/chute-tournament-hub.css?v=5.8.1', 'chute-tournament-hub.css'],
  ['/chute-matches-v52.css?v=5.8.1', 'chute-matches-v52.css'],
  ['/chute-v53-adjustments.css?v=5.8.1', 'chute-v53-adjustments.css'],
  ['/chute-v54.css?v=5.8.1', 'chute-v54.css'],
  ['/chute-v55.css?v=5.8.1', 'chute-v55.css'],
  ['/chute-v56.css?v=5.8.1', 'chute-v56.css']
]) loadStyle(href, marker);

await import('/chute-runtime-v58.mjs?v=5.8.1');
await import('/chute-mutation-guard.mjs?v=5.8.1');
await import('/chute-detail-model.mjs?v=5.8.1');
await Promise.all([
  import('/chute-detail-ui.mjs?v=5.8.1'),
  import('/chute-detail-events.mjs?v=5.8.1'),
  import('/chute-detail-diagnostics.mjs?v=5.8.1'),
  import('/chute-group-editor.mjs?v=5.8.1')
]);
await import('/chute-data-hygiene.mjs?v=5.8.1');
await import('/chute-premium-ui.mjs?v=5.8.1');
await import('/chute-tournament-hub.mjs?v=5.8.1');
await import('/chute-matches-v52.mjs?v=5.8.1');
await import('/chute-v54.mjs?v=5.8.1');
await import('/chute-v54-form-guard.mjs?v=5.8.1');
await import('/chute-v56-discipline.mjs?v=5.8.1');
await import('/chute-v55-event-guard.mjs?v=5.8.1');
await import('/chute-v55.mjs?v=5.8.1');

function installMobileBracketControls() {
  const media = window.matchMedia('(max-width:700px)');
  const selectedByTournament = new Map();
  let refreshQueued = false;

  const normalize = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'fase';
  const compactLabel = (value = '') => {
    const label = String(value).trim();
    const normalized = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (normalized.includes('octavos')) return 'Octavos';
    if (normalized.includes('cuartos')) return 'Cuartos';
    if (normalized.includes('semifinal')) return 'Semifinales';
    if (normalized.includes('3er') || normalized.includes('tercer') || normalized.includes('3.')) return '3.er lugar';
    if (normalized === 'final' || normalized.endsWith(' final')) return 'Final';
    return label;
  };
  const tournamentKey = (bracket) => bracket.closest('#cmTournamentHub')?.dataset.tournamentId || 'torneo-actual';
  const roundsOf = (bracket) => [...bracket.querySelectorAll(':scope > .cm-hub-bracket-grid > .cm-hub-bracket-round')];

  function applySelection(bracket, requested = '') {
    const rounds = roundsOf(bracket);
    if (!rounds.length) return;
    const available = rounds.map((round) => round.dataset.cmV581Round);
    const selected = available.includes(requested) ? requested : available[0];
    selectedByTournament.set(tournamentKey(bracket), selected);
    rounds.forEach((round) => {
      const active = round.dataset.cmV581Round === selected;
      round.classList.toggle('cm-v581-mobile-active', active);
      round.setAttribute('aria-hidden', media.matches && !active ? 'true' : 'false');
    });
    bracket.querySelectorAll('[data-cm-v581-bracket-round]').forEach((button) => {
      const active = button.dataset.cmV581BracketRound === selected;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
  }

  function decorate(bracket) {
    const rounds = roundsOf(bracket);
    if (!rounds.length) return;
    let navigation = bracket.querySelector(':scope > .cm-v581-bracket-tabs');
    if (rounds.length > 1 && !navigation) {
      navigation = document.createElement('nav');
      navigation.className = 'cm-v581-bracket-tabs';
      navigation.setAttribute('aria-label', 'Etapas de la llave');
      navigation.setAttribute('role', 'tablist');
      bracket.prepend(navigation);
    }

    const signature = rounds.map((round) => round.querySelector(':scope > header h3')?.textContent?.trim() || '').join('|');
    if (navigation && navigation.dataset.signature !== signature) {
      navigation.dataset.signature = signature;
      navigation.replaceChildren();
      rounds.forEach((round, index) => {
        const title = round.querySelector(':scope > header h3')?.textContent?.trim() || `Fase ${index + 1}`;
        const key = `${normalize(title)}-${index}`;
        const id = `cm-v581-round-${normalize(tournamentKey(bracket))}-${index}`;
        round.dataset.cmV581Round = key;
        round.id = id;
        round.setAttribute('role', 'tabpanel');
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.cmV581BracketRound = key;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-controls', id);
        button.textContent = compactLabel(title);
        navigation.appendChild(button);
      });
    } else if (!navigation) {
      rounds.forEach((round, index) => { round.dataset.cmV581Round = `${normalize(round.querySelector(':scope > header h3')?.textContent || 'fase')}-${index}`; });
    }

    const selected = selectedByTournament.get(tournamentKey(bracket)) || rounds[0].dataset.cmV581Round;
    applySelection(bracket, selected);
  }

  function refresh() {
    refreshQueued = false;
    document.querySelectorAll('.cm-hub-bracket').forEach(decorate);
  }

  function scheduleRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    window.requestAnimationFrame(refresh);
  }

  document.addEventListener('click', (event) => {
    const roundButton = event.target.closest('[data-cm-v581-bracket-round]');
    if (roundButton) {
      const bracket = roundButton.closest('.cm-hub-bracket');
      if (bracket) applySelection(bracket, roundButton.dataset.cmV581BracketRound);
      return;
    }
    if (event.target.closest('[data-cm-tournament-tab="bracket"],[data-open-tournament],[data-cm-mobile-page="torneos"]')) window.setTimeout(scheduleRefresh, 0);
  });

  const tournamentDetail = document.getElementById('tournamentDetail');
  if (tournamentDetail) {
    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(tournamentDetail, { childList: true, subtree: true });
  }
  media.addEventListener?.('change', scheduleRefresh);
  window.addEventListener('resize', scheduleRefresh, { passive: true });
  refresh();
  window.ChuteMobileV581 = { refresh, version: '5.8.1' };
}

installMobileBracketControls();

let statsPromise = null;
let analysisPromise = null;

function statisticsStatus(type = 'loading', scope = 'statistics') {
  const statsPage = document.getElementById('estadisticas');
  if (!statsPage) return null;
  let status = document.getElementById('cmV581StatsStatus');
  if (!status) {
    status = document.createElement('section');
    status.id = 'cmV581StatsStatus';
    statsPage.querySelector('.page-title')?.insertAdjacentElement('afterend', status);
  }
  status.dataset.scope = scope;
  status.className = `cm-v581-stats-status${type === 'error' ? ' is-error' : ''}`;
  status.style.setProperty('display', 'block', 'important');
  status.replaceChildren();
  const title = document.createElement('strong');
  const loadingAnalysis = scope === 'analysis';
  title.textContent = type === 'error'
    ? loadingAnalysis ? 'No se pudo cargar el análisis histórico' : 'No se pudieron cargar las estadísticas'
    : loadingAnalysis ? 'Cargando análisis histórico…' : 'Cargando estadísticas…';
  const text = document.createElement('p');
  text.textContent = type === 'error'
    ? 'Revisa la conexión e inténtalo nuevamente.'
    : loadingAnalysis ? 'Preparando comparaciones, sedes y evolución histórica.' : 'Preparando el centro estadístico actual.';
  status.append(title, text);
  if (type === 'error') {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.dataset.cmRetryStats = scope;
    retry.textContent = 'Reintentar';
    status.appendChild(retry);
  }
  return status;
}

function clearStatisticsStatus() {
  document.getElementById('cmV581StatsStatus')?.remove();
}

function refreshCurrentStatistics() {
  const statsPage = document.getElementById('estadisticas');
  if (statsPage?.hidden) window.ChuteMundoCore?.navigate?.('estadisticas');
  window.ChuteV518EraStats?.renderShell?.();
  window.ChuteV5181StatsPolish?.refresh?.();
  window.ChuteRuntimeV58?.invalidate('statistics-current-loaded');
}

function loadStatistics() {
  if (statsPromise) return statsPromise;
  statisticsStatus('loading', 'statistics');
  statsPromise = Promise.resolve().then(() => {
    refreshCurrentStatistics();
    clearStatisticsStatus();
    return true;
  }).catch((error) => {
    statsPromise = null;
    statisticsStatus('error', 'statistics');
    console.error('No se pudo cargar el centro estadístico actual de Chute Mundo.', error);
    window.ChuteMundoCore?.showToast?.('No se pudieron cargar las estadísticas. Intenta nuevamente.');
    throw error;
  });
  return statsPromise;
}

function loadHistoricalAnalysis() {
  if (analysisPromise) return analysisPromise;
  statisticsStatus('loading', 'analysis');
  loadStyle('/chute-v58.css?v=5.18.2', 'chute-v58.css');
  analysisPromise = import('/chute-v58-analysis.mjs?v=5.18.2').then(() => {
    const statsPage = document.getElementById('estadisticas');
    if (statsPage?.hidden) window.ChuteMundoCore?.navigate?.('estadisticas');
    window.ChuteAnalysisV58?.refresh?.();
    window.ChuteRuntimeV58?.invalidate('historical-analysis-loaded');
    clearStatisticsStatus();
    return true;
  }).catch((error) => {
    analysisPromise = null;
    statisticsStatus('error', 'analysis');
    console.error('No se pudo cargar el análisis histórico de Chute Mundo.', error);
    window.ChuteMundoCore?.showToast?.('No se pudo cargar el análisis histórico. Intenta nuevamente.');
    throw error;
  });
  return analysisPromise;
}

function requestStatisticsLoad() {
  void loadStatistics().catch(() => {});
}

document.addEventListener('click', (event) => {
  const retry = event.target.closest('[data-cm-retry-stats]');
  if (retry?.dataset.cmRetryStats === 'analysis') {
    void loadHistoricalAnalysis().catch(() => {});
    return;
  }
  if (event.target.closest('[data-page="estadisticas"],[data-cm-page="estadisticas"],[data-cm-mobile-page="estadisticas"],[data-cm-retry-stats]')) requestStatisticsLoad();
}, true);

const statisticsPage = document.getElementById('estadisticas');
if (statisticsPage) {
  const observer = new MutationObserver(() => {
    if (!statisticsPage.hidden) requestStatisticsLoad();
  });
  observer.observe(statisticsPage, { attributes: true, attributeFilter: ['hidden'] });
}

if (!statisticsPage?.hidden) requestStatisticsLoad();

window.ChuteLazyV58 = {
  loadStatistics,
  loadHistoricalAnalysis,
  refreshCurrentStatistics,
  get statisticsLoaded() { return Boolean(statsPromise); },
  get analysisLoaded() { return Boolean(analysisPromise); }
};
