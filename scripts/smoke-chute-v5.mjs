import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const desktop = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
desktop.on('pageerror', (error) => errors.push(error.message));
desktop.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

try {
  await desktop.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await desktop.waitForFunction(() => Boolean(
    window.ChuteMundoCore &&
    window.ChuteDetailModel &&
    window.ChuteDetailUI &&
    window.ChuteDetailEvents &&
    window.ChuteGroupEditor &&
    window.ChutePremiumUI &&
    window.ChuteTournamentHub
  ), null, { timeout: 60_000 });
  await desktop.waitForSelector('#cmPremiumDashboard .cm-sport-hero', { timeout: 20_000 });
  await desktop.waitForTimeout(1000);

  const dashboard = await desktop.evaluate(() => {
    const state = window.ChuteMundoCore.getState();
    const active = state.tournaments.find((tournament) => tournament.status === 'active');
    return {
      title: document.title,
      activeId: active?.id,
      dashboardTitle: document.querySelector('.cm-sport-hero h1')?.textContent,
      tournaments: state.tournaments.length,
      hubCss: Array.from(document.styleSheets).some((sheet) => sheet.href?.includes('chute-tournament-hub.css'))
    };
  });

  if (!dashboard.title.includes('v5.1')) throw new Error(`Versión visual incorrecta: ${dashboard.title}`);
  if (dashboard.activeId !== 't8' || dashboard.dashboardTitle !== '8vo Torneo - Copa') throw new Error(`Torneo activo incorrecto: ${JSON.stringify(dashboard)}`);
  if (dashboard.tournaments < 8 || !dashboard.hubCss) throw new Error(`Paquete v5.1 incompleto: ${JSON.stringify(dashboard)}`);

  await desktop.click('[data-cm-open-active]');
  await desktop.waitForFunction(() => !document.getElementById('torneos')?.hidden, null, { timeout: 5_000 });
  await desktop.waitForSelector('#cmTournamentHub', { timeout: 10_000 });
  await desktop.waitForSelector('.cm-tournament-catalog-card', { timeout: 10_000 });

  const catalogCount = await desktop.locator('.cm-tournament-catalog-card').count();
  if (catalogCount < 8) throw new Error(`Catálogo incompleto: ${catalogCount}`);

  const tabs = await desktop.locator('[data-cm-tournament-tab]').count();
  if (tabs !== 5) throw new Error(`Pestañas incorrectas: ${tabs}`);

  await desktop.click('[data-cm-tournament-tab="table"]');
  await desktop.waitForSelector('[data-cm-tournament-panel="table"].active');
  const tableState = await desktop.evaluate(() => ({
    cards: document.querySelectorAll('.cm-hub-table-card').length,
    teams: document.querySelectorAll('.cm-hub-table tbody tr').length,
    form: document.querySelectorAll('.cm-form i').length
  }));
  if (tableState.cards !== 2 || tableState.teams !== 6 || tableState.form < 6) throw new Error(`Tablas desordenadas: ${JSON.stringify(tableState)}`);

  await desktop.click('[data-cm-tournament-tab="fixture"]');
  await desktop.waitForSelector('[data-cm-tournament-panel="fixture"].active');
  const fixtureState = await desktop.evaluate(() => ({
    matches: document.querySelectorAll('.cm-hub-match').length,
    rounds: document.querySelectorAll('.cm-hub-round').length,
    filters: document.querySelectorAll('[data-cm-fixture-filter]').length,
    detailButtons: document.querySelectorAll('[data-cm-hub-match]').length
  }));
  if (fixtureState.matches !== 10 || fixtureState.rounds < 6 || fixtureState.filters !== 3 || fixtureState.detailButtons < 10) throw new Error(`Fixture incorrecto: ${JSON.stringify(fixtureState)}`);

  await desktop.click('[data-cm-fixture-filter="played"]');
  await desktop.waitForFunction(() => document.querySelectorAll('.cm-hub-match').length === 4);
  await desktop.click('[data-cm-fixture-filter="all"]');
  await desktop.waitForFunction(() => document.querySelectorAll('.cm-hub-match').length === 10);

  await desktop.click('[data-cm-tournament-tab="stats"]');
  await desktop.waitForSelector('[data-cm-tournament-panel="stats"].active');
  const statsState = await desktop.evaluate(() => ({
    cards: document.querySelectorAll('.cm-hub-ranking-card').length,
    rows: document.querySelectorAll('.cm-hub-ranking-row').length,
    leader: document.querySelector('.cm-hub-ranking-row .cm-hub-player-copy strong')?.textContent || ''
  }));
  if (statsState.cards !== 2 || statsState.rows < 10 || statsState.leader !== 'Giulio Locatelli') throw new Error(`Rankings incorrectos: ${JSON.stringify(statsState)}`);

  await desktop.click('[data-cm-tournament-tab="bracket"]');
  await desktop.waitForSelector('[data-cm-tournament-panel="bracket"].active');
  if (await desktop.locator('.cm-hub-bracket-game').count() !== 4) throw new Error('La llave no contiene los cuatro cruces.');

  await desktop.screenshot({ path: '/tmp/chute-v5-desktop.png', fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  const mobileErrors = [];
  mobile.on('pageerror', (error) => mobileErrors.push(error.message));
  mobile.on('console', (message) => { if (message.type() === 'error') mobileErrors.push(`console: ${message.text()}`); });
  await mobile.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await mobile.waitForFunction(() => Boolean(window.ChuteTournamentHub), null, { timeout: 60_000 });
  await mobile.click('[data-cm-open-active]');
  await mobile.waitForSelector('#cmTournamentHub');
  await mobile.click('[data-cm-tournament-tab="table"]');
  await mobile.waitForSelector('[data-cm-tournament-panel="table"].active');

  const mobileState = await mobile.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    tabsWidth: document.querySelector('.cm-hub-tabs')?.getBoundingClientRect().width || 0,
    tables: document.querySelectorAll('.cm-hub-table-card').length,
    mobileNav: getComputedStyle(document.getElementById('cmMobileNav')).display !== 'none'
  }));
  if (!mobileState.mobileNav || mobileState.tables !== 2) throw new Error(`Vista móvil incompleta: ${JSON.stringify(mobileState)}`);
  if (mobileState.scrollWidth > mobileState.viewport + 3 || mobileState.tabsWidth > mobileState.viewport) throw new Error(`Desborde móvil: ${JSON.stringify(mobileState)}`);

  await mobile.screenshot({ path: '/tmp/chute-v5-mobile.png', fullPage: true });

  const critical = [...errors, ...mobileErrors].filter((message) => !/favicon|ERR_BLOCKED_BY_CLIENT|QUIC_NETWORK_IDLE_TIMEOUT|firestore.googleapis.com/i.test(message));
  if (critical.length) throw new Error(`Errores de página: ${critical.join(' | ')}`);

  console.log('Chute Mundo v5.1 smoke OK', { dashboard, tableState, fixtureState, statsState, mobileState });
} finally {
  await browser.close();
}
