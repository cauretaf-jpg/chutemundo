import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteMundoCore && /v5\.(8|9|18)/.test(document.title));
  const lazy = await page.evaluate(() => ({ analysis: Boolean(window.ChuteAnalysisV58), statsCss: performance.getEntriesByType('resource').some((entry) => entry.name.includes('chute-stats-v52.css')), runtime: window.ChuteRuntimeV58?.stats?.() }));
  if (lazy.analysis || lazy.statsCss || !lazy.runtime) throw new Error(`Carga diferida incorrecta: ${JSON.stringify(lazy)}`);

  await page.click('.nav [data-page="estadisticas"]');
  await page.waitForFunction(() => window.ChuteAnalysisV58 && window.ChuteControllersV57 && document.querySelector('[data-cm-v5181-analysis]'));
  await page.click('[data-cm-v5181-analysis]');
  await page.waitForFunction(() => document.getElementById('cmV58AnalysisRoot')?.hidden === false && document.getElementById('cmV58AnalysisRoot')?.getClientRects().length > 0);

  const desktop = await page.evaluate(() => {
    const statsPage = document.getElementById('estadisticas');
    const root = document.getElementById('cmV58AnalysisRoot');
    const switcher = document.getElementById('cmV58ModeSwitch');
    return {
      filters: document.querySelectorAll('[data-cm-v58-filter]').length,
      ranking: document.querySelectorAll('.cm-v58-ranking-svg .team-line').length,
      compare: document.querySelectorAll('.cm-v58-compare-metric').length,
      matrix: document.querySelectorAll('.cm-v58-matrix tbody tr').length,
      decisive: document.querySelectorAll('.cm-v58-decisive .cm-v58-kpis article').length,
      venuePanel: Boolean(document.querySelector('.cm-v58-venues')),
      minutes: document.querySelectorAll('.cm-v58-minute-bars > div').length,
      runtime: window.ChuteRuntimeV58.stats(),
      visibility: { pageHidden: statsPage?.hidden, pageDisplay: statsPage ? getComputedStyle(statsPage).display : '', rootDisplay: root ? getComputedStyle(root).display : '', switchDisplay: switcher ? getComputedStyle(switcher).display : '', rootRect: root ? [root.offsetWidth, root.offsetHeight] : [] }
    };
  });
  if (desktop.visibility.pageDisplay === 'none' || desktop.visibility.rootDisplay === 'none' || desktop.visibility.rootRect[0] === 0 || desktop.visibility.switchDisplay !== 'none') throw new Error(`Visibilidad incorrecta: ${JSON.stringify(desktop.visibility)}`);
  if (desktop.filters !== 6 || desktop.ranking < 2 || desktop.compare < 12 || desktop.matrix < 4 || desktop.decisive !== 6 || !desktop.venuePanel || desktop.minutes !== 13 || desktop.runtime.managedIntervals < 3) throw new Error(`Análisis incompleto: ${JSON.stringify(desktop)}`);

  const team = await page.evaluate(() => window.ChuteMundoCore.getState().teams[0]?.id);
  await page.selectOption('[data-cm-v58-filter="team"]', team);
  await page.waitForFunction((value) => window.ChuteAnalysisV58.filters.team === value && document.querySelector('[data-cm-v58-filter="team"]')?.value === value, team);
  const teamFilter = await page.evaluate(() => ({ internal: window.ChuteAnalysisV58.filters.team, selected: document.querySelector('[data-cm-v58-filter="team"]')?.value }));
  if (teamFilter.internal !== team || teamFilter.selected !== team) throw new Error(`Filtro de equipo desincronizado: ${JSON.stringify({ team, teamFilter })}`);
  if (await page.locator('.cm-v58-minute-bars > div').count() !== 13) throw new Error('El filtro por equipo alteró los tramos oficiales.');

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, width: document.documentElement.scrollWidth, visible: !document.getElementById('cmV58AnalysisRoot').hidden && document.getElementById('cmV58AnalysisRoot').getClientRects().length > 0 }));
  if (!mobile.visible || mobile.width > mobile.viewport + 3) throw new Error(`Desborde móvil: ${JSON.stringify(mobile)}`);

  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));
  console.log('Chute Mundo v5.8 smoke OK', { lazy, desktop, teamFilter, mobile });
} finally {
  await browser.close();
}
