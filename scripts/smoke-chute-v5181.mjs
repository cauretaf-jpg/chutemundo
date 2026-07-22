import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteV5182StatsLoader && window.ChuteV5181StatsPolish && window.ChuteV518EraStats && window.ChuteMundoCore);
  await page.evaluate(() => window.ChuteMundoCore.navigate('estadisticas'));
  await page.waitForFunction(() => document.querySelector('[data-cm-v5181-analysis]') && window.ChuteV5182StatsLoader.currentStatsVisible());
  await page.waitForSelector('#cmV518Stats', { state: 'visible' });

  const summary = await page.evaluate(() => ({
    title: document.querySelector('#estadisticas .page-title h1')?.textContent || '',
    subtitle: document.querySelector('#estadisticas .page-title p:last-child')?.textContent || '',
    labels: [...document.querySelectorAll('[data-cm-v518-panel="summary"] .cm-v518-metric span')].map((item) => item.textContent.trim()),
    explanatory: document.querySelector('[data-cm-v518-panel="summary"]')?.innerText || '',
    infoCardsVisible: [...document.querySelectorAll('[data-cm-v518-panel="summary"] > .cm-v518-two')].some((item) => item.getClientRects().length),
    oldSwitcherVisible: Boolean(document.getElementById('cmV58ModeSwitch')?.getClientRects().length),
    analysisLoaded: Boolean(window.ChuteAnalysisV58),
    version: window.ChuteV5181StatsPolish.version
  }));
  if (summary.version !== '5.18.1' || summary.title !== 'Estadísticas' || summary.subtitle !== 'Equipos, jugadores, torneos y récords.' || summary.analysisLoaded) throw new Error(`Encabezado o carga inicial incorrectos: ${JSON.stringify(summary)}`);
  if (!summary.labels.includes('Goleador') || !summary.labels.includes('Asistidor') || summary.labels.some((item) => /registrado/i.test(item))) throw new Error(`Etiquetas del resumen incorrectas: ${JSON.stringify(summary.labels)}`);
  if (/Los resultados de equipos abarcan|CRITERIO HISTÓRICO|PUNTO DE CORTE/.test(summary.explanatory) || summary.infoCardsVisible || summary.oldSwitcherVisible) throw new Error(`Persisten textos o controles antiguos: ${JSON.stringify(summary)}`);

  await page.locator('[data-cm-v5181-analysis]').click();
  await page.waitForFunction(() => {
    const root = document.getElementById('cmV58AnalysisRoot');
    return window.ChuteAnalysisV58 && document.getElementById('estadisticas')?.classList.contains('cm-v5181-analysis-open') && root && !root.hidden && root.getClientRects().length > 0;
  });
  const analysis = await page.evaluate(() => ({
    rootText: document.getElementById('cmV58AnalysisRoot')?.textContent || '',
    rootDisplay: getComputedStyle(document.getElementById('cmV58AnalysisRoot')).display,
    filters: document.querySelectorAll('#cmV58AnalysisRoot [data-cm-v58-filter]').length,
    contentHidden: document.querySelector('#cmV518Stats .cm-v518-content')?.hidden,
    toolbarFiltersHidden: document.querySelector('#cmV518Stats .cm-v518-filter-grid')?.hidden,
    active: document.querySelector('[data-cm-v5181-analysis]')?.classList.contains('active'),
    aliases: window.ChuteMundoCore.getState().tournaments.map((tournament) => tournament.era).filter(Boolean),
    legacyLoaded: window.ChuteV5182StatsLoader.loadedLegacyStatistics()
  }));
  if (analysis.rootDisplay === 'none' || analysis.filters !== 6 || !analysis.contentHidden || !analysis.toolbarFiltersHidden || !analysis.active || !analysis.rootText.includes('Análisis histórico') || analysis.legacyLoaded) throw new Error(`Análisis histórico no abrió correctamente: ${JSON.stringify(analysis)}`);
  if (!analysis.aliases.includes('league') && !analysis.aliases.includes('division')) throw new Error(`No se sincronizaron las eras para el análisis: ${JSON.stringify(analysis.aliases)}`);

  await page.locator('[data-cm-v518-tab="summary"]').click();
  await page.waitForFunction(() => {
    const pageElement = document.getElementById('estadisticas');
    const root = document.getElementById('cmV58AnalysisRoot');
    return !pageElement?.classList.contains('cm-v5181-analysis-open')
      && root?.hidden
      && document.querySelector('#cmV518Stats .cm-v518-content')?.hidden === false
      && window.ChuteV5182StatsLoader.currentStatsVisible()
      && document.title.includes('5.18.2');
  });

  const mobile = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth, title: document.title }));
  if (mobile.width > mobile.viewport + 3 || !mobile.title.includes('5.18.2')) throw new Error(`Vista móvil o versión incorrecta: ${JSON.stringify(mobile)}`);
  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|network|message channel/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));
  console.log('Chute Mundo v5.18.2 stats polish smoke OK', { summary, analysis, mobile });
} finally {
  await browser.close();
}
