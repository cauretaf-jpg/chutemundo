const VERSION = '5.18.3';
let analysisRequest = null;
let refreshQueued = false;
let recoveryRequest = null;

function stampVersion(recovered = false) {
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

async function activateRecovery(error) {
  console.error('El centro estadístico avanzado falló; se activará la vista compatible.', error);
  window.__CM_V518_IMPORT_ERROR__ = error;
  if (!recoveryRequest) recoveryRequest = import('/chute-v5183-stats-recovery.mjs?v=5.18.3');
  const module = await recoveryRequest;
  const recovery = window.ChuteV5183StatsRecovery || module;
  recovery.activate?.(error);
  removeLegacyStatisticsShells();
  stampVersion(true);
  return true;
}

function refreshCurrentStatistics() {
  refreshQueued = false;
  try {
    removeLegacyStatisticsShells();
    window.ChuteLazyV58?.refreshCurrentStatistics?.();
    window.ChuteV518EraStats?.renderShell?.();
    window.ChuteV5181StatsPolish?.refresh?.();
    removeLegacyStatisticsShells();
    stampVersion(Boolean(window.ChuteV5183StatsRecovery && window.ChuteV518EraStats?.version === VERSION));
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
    stampVersion(Boolean(window.ChuteV5183StatsRecovery));
    return true;
  }
  if (!analysisRequest) {
    analysisRequest = window.ChuteLazyV58?.loadHistoricalAnalysis?.()
      .then(() => {
        window.ChuteAnalysisV58?.setMode?.('analysis');
        window.ChuteV5181StatsPolish?.refresh?.();
        removeLegacyStatisticsShells();
        stampVersion(Boolean(window.ChuteV5183StatsRecovery));
        return true;
      })
      .catch((error) => {
        analysisRequest = null;
        window.ChuteV5181StatsPolish?.closeAnalysis?.();
        stampVersion(Boolean(window.ChuteV5183StatsRecovery));
        throw error;
      });
  }
  return analysisRequest;
}

document.addEventListener('click', (event) => {
  if (event.target.closest?.('[data-cm-v5181-analysis]')) {
    void loadHistoricalAnalysis();
    return;
  }
  if (event.target.closest?.('[data-page="estadisticas"],[data-cm-page="estadisticas"],[data-cm-mobile-page="estadisticas"],#cmV518Stats [data-cm-v518-tab]')) {
    setTimeout(scheduleCurrentRefresh, 0);
    setTimeout(() => {
      if (!currentStatsVisible() && !document.getElementById('estadisticas')?.classList.contains('cm-v5181-analysis-open')) refreshCurrentStatistics();
      else stampVersion(Boolean(window.ChuteV5183StatsRecovery));
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

removeLegacyStatisticsShells();
scheduleCurrentRefresh();
stampVersion();

window.ChuteV5182StatsLoader = {
  version: VERSION,
  loadHistoricalAnalysis,
  refreshCurrentStatistics,
  activateRecovery,
  currentStatsVisible,
  loadedLegacyStatistics() {
    return Boolean(window.ChuteStatsV52 || window.ChuteGameMinuteStats || window.ChuteControllersV57 || window.ChuteVisibilityV58);
  }
};
