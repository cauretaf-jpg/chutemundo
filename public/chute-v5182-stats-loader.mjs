const VERSION = '5.18.2';
let analysisRequest = null;
let refreshQueued = false;

function stampVersion() {
  document.title = 'Chute Mundo v5.18.2 · Estadísticas estables';
  document.querySelector('.hero .eyebrow')?.replaceChildren('CHUTE MUNDO v5.18.2');
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

function refreshCurrentStatistics() {
  refreshQueued = false;
  removeLegacyStatisticsShells();
  window.ChuteLazyV58?.refreshCurrentStatistics?.();
  window.ChuteV518EraStats?.renderShell?.();
  window.ChuteV5181StatsPolish?.refresh?.();
  removeLegacyStatisticsShells();
  stampVersion();
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
    stampVersion();
    return true;
  }
  if (!analysisRequest) {
    analysisRequest = window.ChuteLazyV58?.loadHistoricalAnalysis?.()
      .then(() => {
        window.ChuteAnalysisV58?.setMode?.('analysis');
        window.ChuteV5181StatsPolish?.refresh?.();
        removeLegacyStatisticsShells();
        stampVersion();
        return true;
      })
      .catch((error) => {
        analysisRequest = null;
        window.ChuteV5181StatsPolish?.closeAnalysis?.();
        stampVersion();
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
      else stampVersion();
    }, 120);
  }
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
  currentStatsVisible,
  loadedLegacyStatistics() {
    return Boolean(window.ChuteStatsV52 || window.ChuteGameMinuteStats || window.ChuteControllersV57 || window.ChuteVisibilityV58);
  }
};
