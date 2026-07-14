import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const desktop = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
desktop.on('pageerror', (error) => errors.push(error.message));
desktop.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

try {
  await desktop.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await desktop.waitForFunction(() => Boolean(
    window.ChuteMundoCore &&
    window.ChuteDetailModel &&
    window.ChuteDetailEvents &&
    window.ChutePremiumUI &&
    window.ChuteTournamentHub &&
    window.ChuteMatchesV52 &&
    window.ChuteStatsV52
  ), null, { timeout: 60_000 });
  await desktop.waitForSelector('#cmPremiumDashboard .cm-sport-hero', { timeout: 20_000 });
  await desktop.waitForTimeout(900);

  const dashboard = await desktop.evaluate(() => ({
    title: document.title,
    activeId: window.ChuteMundoCore.getState().tournaments.find((item) => item.status === 'active')?.id,
    recentRows: document.querySelectorAll('.cm-v52-recent-row').length,
    recentLogos: document.querySelectorAll('.cm-v52-recent-row img').length,
    matchesCss: Array.from(document.styleSheets).some((sheet) => sheet.href?.includes('chute-matches-v52.css')),
    statsCss: Array.from(document.styleSheets).some((sheet) => sheet.href?.includes('chute-stats-v52.css'))
  }));
  if (!dashboard.title.includes('v5.2')) throw new Error(`Versión visual incorrecta: ${dashboard.title}`);
  if (dashboard.activeId !== 't8') throw new Error(`Torneo activo incorrecto: ${dashboard.activeId}`);
  if (dashboard.recentRows !== 4 || dashboard.recentLogos !== 8) throw new Error(`Resultados recientes sin ambos escudos: ${JSON.stringify(dashboard)}`);
  if (!dashboard.matchesCss || !dashboard.statsCss) throw new Error('No se cargaron los estilos v5.2.');

  await desktop.evaluate(() => window.ChuteMundoCore.navigate('partidos'));
  await desktop.waitForSelector('#cmAdvancedMatchFilters');
  await desktop.waitForSelector('.cm-v52-match-card');
  const matchStart = await desktop.evaluate(() => ({
    filters: document.querySelectorAll('[data-cm-match-filter]').length,
    cards: document.querySelectorAll('.cm-v52-match-card').length,
    logos: document.querySelectorAll('.cm-v52-match-card .cm-v52-match-team img').length
  }));
  if (matchStart.filters !== 7 || matchStart.cards < 10 || matchStart.logos !== matchStart.cards * 2) throw new Error(`Filtros o tarjetas de partidos incorrectos: ${JSON.stringify(matchStart)}`);

  await desktop.selectOption('[data-cm-match-filter="tournament"]', 't8');
  await desktop.waitForFunction(() => document.querySelectorAll('.cm-v52-match-card').length === 10);
  await desktop.selectOption('[data-cm-match-filter="status"]', 'played');
  await desktop.waitForFunction(() => document.querySelectorAll('.cm-v52-match-card').length === 4);
  await desktop.selectOption('[data-cm-match-filter="team"]', 'polpetta');
  const polpettaCount = await desktop.locator('.cm-v52-match-card').count();
  if (polpettaCount !== 2) throw new Error(`Filtro de equipo incorrecto: ${polpettaCount}`);
  await desktop.click('[data-cm-v52-reset-matches]');

  await desktop.evaluate(() => window.ChuteMundoCore.navigate('estadisticas'));
  await desktop.waitForSelector('#cmStatsCenter .cm-v52-stats-shell');
  const statsStart = await desktop.evaluate(() => ({
    tabs: document.querySelectorAll('[data-cm-stats-tab]').length,
    kpis: document.querySelectorAll('.cm-v52-stats-kpis article').length,
    tableRows: document.querySelectorAll('.cm-v52-table tbody tr').length,
    oldStatsHidden: getComputedStyle(document.getElementById('statsOverview')).display === 'none'
  }));
  if (statsStart.tabs !== 5 || statsStart.kpis !== 6 || statsStart.tableRows < 6 || !statsStart.oldStatsHidden) throw new Error(`Centro estadístico incompleto: ${JSON.stringify(statsStart)}`);

  await desktop.click('[data-cm-stats-tab="fifa"]');
  await desktop.waitForSelector('.cm-v52-fifa-panel');
  const fifaState = await desktop.evaluate(() => ({
    rows: document.querySelectorAll('.cm-v52-fifa-panel tbody tr').length,
    formula: document.querySelectorAll('.cm-v52-formula span').length,
    firstPoints: document.querySelector('.cm-v52-fifa-points')?.textContent || ''
  }));
  if (fifaState.rows < 6 || fifaState.formula !== 6 || !fifaState.firstPoints) throw new Error(`Ranking FIFA incorrecto: ${JSON.stringify(fifaState)}`);

  await desktop.click('[data-cm-stats-tab="controllers"]');
  await desktop.waitForSelector('.cm-v52-controller-card');
  const controllers = await desktop.evaluate(() => ({
    cards: document.querySelectorAll('.cm-v52-controller-card').length,
    names: Array.from(document.querySelectorAll('.cm-v52-controller-card h2')).map((item) => item.textContent),
    minuteBars: document.querySelectorAll('.cm-v52-minute-chart i b').length,
    records: document.querySelectorAll('.cm-v52-record-grid article').length
  }));
  if (controllers.cards !== 2 || controllers.names.join('|') !== 'Álvaro|Carlos' || controllers.minuteBars !== 5 || controllers.records < 4) throw new Error(`Controladores o récords incorrectos: ${JSON.stringify(controllers)}`);

  await desktop.screenshot({ path: '/tmp/chute-v5-desktop.png', fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  const mobileErrors = [];
  mobile.on('pageerror', (error) => mobileErrors.push(error.message));
  mobile.on('console', (message) => { if (message.type() === 'error') mobileErrors.push(`console: ${message.text()}`); });
  await mobile.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await mobile.waitForFunction(() => Boolean(window.ChuteMatchesV52 && window.ChuteStatsV52), null, { timeout: 60_000 });
  await mobile.evaluate(() => window.ChuteMundoCore.navigate('partidos'));
  await mobile.waitForSelector('#cmAdvancedMatchFilters');
  const mobileMatches = await mobile.evaluate(() => ({ viewport: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, filters: document.querySelectorAll('[data-cm-match-filter]').length }));
  if (mobileMatches.filters !== 7 || mobileMatches.scrollWidth > mobileMatches.viewport + 3) throw new Error(`Partidos móvil incorrectos: ${JSON.stringify(mobileMatches)}`);
  await mobile.evaluate(() => window.ChuteMundoCore.navigate('estadisticas'));
  await mobile.waitForSelector('#cmStatsCenter');
  const mobileStats = await mobile.evaluate(() => ({ viewport: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, tabs: document.querySelectorAll('[data-cm-stats-tab]').length, nav: getComputedStyle(document.getElementById('cmMobileNav')).display !== 'none' }));
  if (!mobileStats.nav || mobileStats.tabs !== 5 || mobileStats.scrollWidth > mobileStats.viewport + 3) throw new Error(`Estadísticas móvil incorrectas: ${JSON.stringify(mobileStats)}`);
  await mobile.screenshot({ path: '/tmp/chute-v5-mobile.png', fullPage: true });

  const critical = [...errors, ...mobileErrors].filter((message) => !/favicon|ERR_BLOCKED_BY_CLIENT|QUIC_NETWORK_IDLE_TIMEOUT|firestore.googleapis.com/i.test(message));
  if (critical.length) throw new Error(`Errores de página: ${critical.join(' | ')}`);
  console.log('Chute Mundo v5.2 smoke OK', { dashboard, matchStart, statsStart, fifaState, controllers, mobileMatches, mobileStats });
} finally {
  await browser.close();
}
