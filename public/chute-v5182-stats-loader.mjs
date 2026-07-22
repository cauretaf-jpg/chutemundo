const VERSION = '5.18.3';
let analysisRequest = null;
let refreshQueued = false;
let recoveryRequest = null;

function recoveredMode() {
  return Boolean(window.ChuteV5183StatsRecovery && window.ChuteV518EraStats?.version === VERSION);
}

function stampVersion(recovered = recoveredMode()) {
  document.title = recovered ? 'Chute Mundo v5.18.3 · Estadísticas recuperadas' : 'Chute Mundo v5.18.3 · Estadísticas estables';
  document.querySelector('.hero .eyebrow')?.replaceChildren('CHUTE MUNDO v5.18.3');
}

function currentStatsVisible() {
  const page = document.getElementById('estadisticas');
  const host = document.getElementById('cmV518Stats');
  if (!page || page.hidden || !host) return false;
  const style = getComputedStyle(host);
  return style.display !== 'none' && style.visibility !== 'hidden' && host.getClientRects().length > 0;
}

function removeLegacyStatisticsShells() {
  const page = document.getElementById('estadisticas');
  if (!page) return;
  for (const element of [
    document.getElementById('cmStatsCenter'),
    document.getElementById('cmV58ModeSwitch')
  ]) {
    if (!element) continue;
    element.hidden = true;
    element.setAttribute('aria-hidden', 'true');
    element.style.setProperty('display', 'none', 'important');
  }
}

function ensureAnalysisTab() {
  const tabs = document.querySelector('#cmV518Stats .cm-v518-tabs');
  if (!tabs) return null;
  let button = tabs.querySelector('[data-cm-v5181-analysis]');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.dataset.cmV5181Analysis = '';
    button.textContent = 'Análisis histórico';
    tabs.appendChild(button);
  }
  button.hidden = false;
  button.removeAttribute('aria-hidden');
  button.style.removeProperty('display');
  return button;
}

function applyStandaloneAnalysisVisibility(open) {
  const page = document.getElementById('estadisticas');
  const host = document.getElementById('cmV518Stats');
  const root = document.getElementById('cmV58AnalysisRoot');
  const button = ensureAnalysisTab();
  if (!page || !host) return;
  page.classList.toggle('cm-v5181-analysis-open', open);
  button?.classList.toggle('active', open);
  const filters = host.querySelector('.cm-v518-filter-grid');
  const content = host.querySelector('.cm-v518-content');
  if (filters) filters.hidden = open;
  if (content) content.hidden = open;
  if (root) {
    root.hidden = !open;
    root.setAttribute('aria-hidden', open ? 'false' : 'true');
    root.style.setProperty('display', open ? 'grid' : 'none', 'important');
  }
  if (!open) window.ChuteAnalysisV58?.setMode?.('standard');
}

async function activateRecovery(error) {
  console.error('El centro estadístico avanzado falló; se activará la vista compatible.', error);
  window.__CM_V518_IMPORT_ERROR__ = error;
  if (!recoveryRequest) recoveryRequest = import('/chute-v5183-stats-recovery.mjs?v=5.18.3');
  const module = await recoveryRequest;
  const recovery = window.ChuteV5183StatsRecovery || module;
  recovery.activate?.(error);
  removeLegacyStatisticsShells();
  ensureAnalysisTab();
  stampVersion(true);
  return true;
}

function refreshCurrentStatistics() {
  refreshQueued = false;
  try {
    removeLegacyStatisticsShells();
    window.ChuteV5183StatsPreflight?.normalizeState?.();
    window.ChuteLazyV58?.refreshCurrentStatistics?.();
    window.ChuteV518EraStats?.renderShell?.();
    ensureAnalysisTab();
    window.ChuteV5181StatsPolish?.refresh?.();
    ensureAnalysisTab();
    removeLegacyStatisticsShells();
    stampVersion();
  } catch (error) {
    void activateRecovery(error);
  }
}

function scheduleCurrentRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(refreshCurrentStatistics);
}

async function loadHistoricalAnalysis() {
  if (window.ChuteAnalysisV58) {
    window.ChuteAnalysisV58.setMode?.('analysis');
    window.ChuteV5181StatsPolish?.refresh?.();
    if (!window.ChuteV5181StatsPolish) applyStandaloneAnalysisVisibility(true);
    stampVersion();
    return true;
  }
  if (!analysisRequest) {
    analysisRequest = window.ChuteLazyV58?.loadHistoricalAnalysis?.()
      .then(() => {
        window.ChuteAnalysisV58?.setMode?.('analysis');
        window.ChuteV5181StatsPolish?.refresh?.();
        if (!window.ChuteV5181StatsPolish) applyStandaloneAnalysisVisibility(true);
        removeLegacyStatisticsShells();
        ensureAnalysisTab();
        stampVersion();
        return true;
      })
      .catch((error) => {
        analysisRequest = null;
        window.ChuteV5181StatsPolish?.closeAnalysis?.();
        if (!window.ChuteV5181StatsPolish) applyStandaloneAnalysisVisibility(false);
        stampVersion();
        throw error;
      });
  }
  return analysisRequest;
}

document.addEventListener('click', (event) => {
  if (event.target.closest?.('[data-cm-v5181-analysis]')) {
    event.preventDefault();
    void loadHistoricalAnalysis();
    return;
  }
  if (event.target.closest?.('#cmV518Stats [data-cm-v518-tab]') && !window.ChuteV5181StatsPolish) {
    applyStandaloneAnalysisVisibility(false);
  }
  if (event.target.closest?.('[data-page="estadisticas"],[data-cm-page="estadisticas"],[data-cm-mobile-page="estadisticas"],#cmV518Stats [data-cm-v518-tab]')) {
    setTimeout(scheduleCurrentRefresh, 0);
    setTimeout(() => {
      if (!currentStatsVisible() && !document.getElementById('estadisticas')?.classList.contains('cm-v5181-analysis-open')) refreshCurrentStatistics();
      else {
        ensureAnalysisTab();
        stampVersion();
      }
    }, 120);
  }
}, true);

window.addEventListener('error', (event) => {
  if (!/chute-v518|legacyMetricMap|row is not iterable|estadíst/i.test(`${event.filename || ''} ${event.message || ''}`)) return;
  event.preventDefault?.();
  void activateRecovery(event.error || new Error(event.message || 'Error estadístico desconocido.'));
}, true);

window.addEventListener('unhandledrejection', (event) => {
  const text = String(event.reason?.stack || event.reason || '');
  if (!/chute-v518|legacyMetricMap|row is not iterable|estadíst/i.test(text)) return;
  event.preventDefault?.();
  void activateRecovery(event.reason instanceof Error ? event.reason : new Error(text));
}, true);

const statisticsPage = document.getElementById('estadisticas');
if (statisticsPage) {
  new MutationObserver(() => {
    if (!statisticsPage.hidden) scheduleCurrentRefresh();
  }).observe(statisticsPage, { attributes: true, attributeFilter: ['hidden'] });
}

const titleElement = document.querySelector('title');
if (titleElement) {
  new MutationObserver(() => {
    if (!document.title.includes(VERSION)) queueMicrotask(() => stampVersion());
  }).observe(titleElement, { childList: true });
}

removeLegacyStatisticsShells();
ensureAnalysisTab();
scheduleCurrentRefresh();
stampVersion();

window.ChuteV5182StatsLoader = {
  version: VERSION,
  loadHistoricalAnalysis,
  refreshCurrentStatistics,
  activateRecovery,
  currentStatsVisible,
  ensureAnalysisTab,
  loadedLegacyStatistics() {
    return Boolean(window.ChuteStatsV52 || window.ChuteGameMinuteStats || window.ChuteControllersV57 || window.ChuteVisibilityV58);
  }
};
