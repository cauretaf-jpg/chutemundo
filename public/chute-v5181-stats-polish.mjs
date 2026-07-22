const core = window.ChuteMundoCore;
if (!core) throw new Error('Chute Mundo no está listo.');

const VERSION = '5.18.1';
let analysisOpen = false;
let analysisApplied = false;
let refreshQueued = false;

function installStyles() {
  if (document.getElementById('cmV5181Styles')) return;
  const link = document.createElement('link');
  link.id = 'cmV5181Styles';
  link.rel = 'stylesheet';
  link.href = `/chute-v5181-stats-polish.css?v=${VERSION}`;
  document.head.appendChild(link);
}

function syncEraAliases() {
  for (const tournament of core.getState().tournaments || []) {
    if (tournament.eraId === 'divisions') tournament.era = 'division';
    else if (tournament.eraId === 'leagues') tournament.era = 'league';
  }
}

function setText(root, selector, value) {
  const element = root?.querySelector(selector);
  if (element && element.textContent !== value) element.textContent = value;
}

function hideElement(element) {
  if (!element) return;
  element.hidden = true;
  element.setAttribute('aria-hidden', 'true');
  element.classList.add('cm-v5181-copy-hidden');
}

function simplifyTableHeaders(panel, replacements) {
  panel?.querySelectorAll('thead th').forEach((header) => {
    const value = replacements[header.textContent.trim()];
    if (value) header.textContent = value;
  });
}

function polishMainStatistics() {
  const page = document.getElementById('estadisticas');
  const host = document.getElementById('cmV518Stats');
  if (!page || !host) return;

  const pageTitle = page.querySelector('.page-title');
  setText(pageTitle, 'h1', 'Estadísticas');
  setText(pageTitle, 'p:last-child', 'Equipos, jugadores, torneos y récords.');

  const summary = host.querySelector('[data-cm-v518-panel="summary"]');
  summary?.querySelectorAll('.cm-v518-metric span').forEach((label) => {
    if (label.textContent.trim() === 'Goleador registrado') label.textContent = 'Goleador';
    if (label.textContent.trim() === 'Asistidor registrado') label.textContent = 'Asistidor';
  });
  const coverage = summary?.querySelector('.cm-v518-coverage-card');
  setText(coverage, '.eyebrow', 'COBERTURA');
  setText(coverage, 'h2', 'Datos disponibles');
  hideElement(coverage?.querySelector(':scope > p'));
  hideElement(summary?.querySelector(':scope > .cm-v518-two'));

  const players = host.querySelector('[data-cm-v518-panel="players"]');
  setText(players, 'h2', 'Jugadores');
  hideElement(players?.querySelector('.cm-v518-note'));
  hideElement(players?.querySelector('.cm-v518-badge'));
  simplifyTableHeaders(players, {
    'Goles reg.': 'Goles',
    'Asist. reg.': 'Asist.',
    'PJ*': 'PJ',
    'Min.*': 'Min.',
    'Entró*': 'Entró',
    'Salió*': 'Salió',
    'A/R*': 'A/R'
  });

  const keepers = host.querySelector('[data-cm-v518-panel="keepers"]');
  setText(keepers, 'h2', 'Porteros');
  hideElement(keepers?.querySelector('.cm-v518-note'));

  const tournaments = host.querySelector('[data-cm-v518-panel="tournaments"]');
  setText(tournaments, 'h2', 'Resumen por torneo');

  const history = host.querySelector('[data-cm-v518-panel="history"]');
  history?.querySelectorAll('.cm-v518-records article').forEach((card) => {
    if (card.querySelector('span')?.textContent.includes('Series ganadas')) hideElement(card.querySelector('small'));
  });
  setText(history, '.cm-v518-two article:last-child h2', 'Participantes');
}

function polishAnalysis() {
  const root = document.getElementById('cmV58AnalysisRoot');
  if (!root) return;
  setText(root, '.cm-v58-filters h2', 'Análisis histórico');
  hideElement(root.querySelector('.cm-v58-filters > div > p:not(.eyebrow)'));
  root.querySelectorAll('.cm-v58-panel > header p:not(.eyebrow)').forEach(hideElement);
  setText(root, '.cm-v58-ranking h2', 'Ranking por torneo');
  setText(root, '.cm-v58-comparator h2', 'Comparación de equipos');
  setText(root, '.cm-v58-matrix h2', 'Enfrentamientos');
  setText(root, '.cm-v58-decisive h2', 'Partidos decisivos');
  setText(root, '.cm-v58-venues h2', 'Sedes');
  setText(root, '.cm-v58-minute-chart h2', 'Goles por minuto');
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
  return button;
}

function applyAnalysisVisibility() {
  const page = document.getElementById('estadisticas');
  const host = document.getElementById('cmV518Stats');
  const root = document.getElementById('cmV58AnalysisRoot');
  const oldSwitcher = document.getElementById('cmV58ModeSwitch');
  const analysisButton = ensureAnalysisTab();
  if (!page || !host) return;

  hideElement(oldSwitcher);
  page.classList.toggle('cm-v5181-analysis-open', analysisOpen);
  analysisButton?.classList.toggle('active', analysisOpen);

  const filters = host.querySelector('.cm-v518-filter-grid');
  const content = host.querySelector('.cm-v518-content');
  if (analysisOpen) {
    host.querySelectorAll('[data-cm-v518-tab]').forEach((button) => button.classList.remove('active'));
    if (filters) filters.hidden = true;
    if (content) content.hidden = true;
    if (root) {
      root.hidden = false;
      root.removeAttribute('aria-hidden');
      root.classList.remove('cm-v518-source-hidden');
      root.style.setProperty('display', 'grid', 'important');
      root.style.removeProperty('visibility');
      root.style.removeProperty('opacity');
    }
    if (window.ChuteAnalysisV58 && !analysisApplied) {
      analysisApplied = true;
      window.ChuteAnalysisV58.setMode('analysis');
    }
  } else {
    analysisApplied = false;
    if (filters) filters.hidden = false;
    if (content) content.hidden = false;
    if (root) {
      root.hidden = true;
      root.setAttribute('aria-hidden', 'true');
      root.style.setProperty('display', 'none', 'important');
    }
    window.ChuteAnalysisV58?.setMode?.('standard');
  }
}

function refresh() {
  refreshQueued = false;
  syncEraAliases();
  polishMainStatistics();
  polishAnalysis();
  applyAnalysisVisibility();
  document.title = 'Chute Mundo v5.18.1 · Estadísticas corregidas';
  document.querySelector('.hero .eyebrow')?.replaceChildren('CHUTE MUNDO v5.18.1');
}

function scheduleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(refresh);
}

function openAnalysis() {
  analysisOpen = true;
  analysisApplied = false;
  scheduleRefresh();
  setTimeout(scheduleRefresh, 120);
}

function closeAnalysis() {
  analysisOpen = false;
  scheduleRefresh();
}

document.addEventListener('click', (event) => {
  if (event.target.closest?.('[data-cm-v5181-analysis],[data-cm-v58-mode="analysis"]')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openAnalysis();
    return;
  }
  if (event.target.closest?.('#cmV518Stats [data-cm-v518-tab],[data-cm-v58-mode="standard"]')) closeAnalysis();
  if (event.target.closest?.('[data-page="estadisticas"],[data-cm-mobile-page="estadisticas"]')) setTimeout(scheduleRefresh, 80);
}, true);

document.addEventListener('change', (event) => {
  if (event.target.closest?.('#estadisticas select')) setTimeout(scheduleRefresh, 20);
}, true);

const statisticsPage = document.getElementById('estadisticas');
if (statisticsPage) new MutationObserver(scheduleRefresh).observe(statisticsPage, { childList: true, subtree: true });
installStyles();
if ('serviceWorker' in navigator) navigator.serviceWorker.register(`/sw.js?v=${VERSION}`).catch((error) => console.warn('No se pudo actualizar la PWA v5.18.1.', error));
scheduleRefresh();

window.ChuteV5181StatsPolish = { version: VERSION, openAnalysis, closeAnalysis, refresh };
