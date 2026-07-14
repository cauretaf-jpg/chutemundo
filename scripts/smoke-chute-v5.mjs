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
    window.ChutePremiumUI
  ), null, { timeout: 60_000 });
  await desktop.waitForSelector('#cmPremiumDashboard .cm-sport-hero', { timeout: 20_000 });
  await desktop.waitForTimeout(1000);

  const dashboard = await desktop.evaluate(() => {
    const state = window.ChuteMundoCore.getState();
    const active = state.tournaments.find((tournament) => tournament.status === 'active');
    return {
      coreVersion: window.ChuteMundoCore.version,
      title: document.title,
      bodyPremium: document.body.classList.contains('cm-premium-theme'),
      activeId: active?.id,
      activeName: active?.name,
      dashboardTitle: document.querySelector('.cm-sport-hero h1')?.textContent,
      kpis: document.querySelectorAll('.cm-kpi-card').length,
      groups: document.querySelectorAll('.cm-mini-group').length,
      fixtures: document.querySelectorAll('.cm-premium-match').length,
      logos: document.querySelectorAll('.cm-hero-club-logo').length,
      leader: document.querySelector('.cm-leader-card h3')?.textContent || '',
      premiumCss: Array.from(document.styleSheets).some((sheet) => sheet.href?.includes('chute-premium.css')),
      tournament8: state.tournaments.find((tournament) => tournament.id === 't8')?.name || null
    };
  });

  if (dashboard.coreVersion !== '4.0.1') throw new Error(`Núcleo inesperado: ${dashboard.coreVersion}`);
  if (!dashboard.title.includes('v5')) throw new Error(`Título visual incorrecto: ${dashboard.title}`);
  if (!dashboard.bodyPremium || !dashboard.premiumCss) throw new Error('El tema premium no se cargó.');
  if (dashboard.activeId !== 't8' || dashboard.activeName !== '8vo Torneo - Copa') throw new Error(`Torneo activo incorrecto: ${JSON.stringify(dashboard)}`);
  if (dashboard.dashboardTitle !== '8vo Torneo - Copa') throw new Error(`La portada no muestra el torneo activo: ${dashboard.dashboardTitle}`);
  if (dashboard.kpis !== 4) throw new Error(`Cantidad de indicadores incorrecta: ${dashboard.kpis}`);
  if (dashboard.groups !== 2) throw new Error(`No se renderizaron los dos grupos: ${dashboard.groups}`);
  if (dashboard.logos < 6) throw new Error(`Faltan escudos en la portada: ${dashboard.logos}`);
  if (!dashboard.tournament8) throw new Error('No está disponible el 8vo torneo.');

  await desktop.click('[data-cm-open-active]');
  await desktop.waitForFunction(() => !document.getElementById('torneos')?.hidden, null, { timeout: 5_000 });
  await desktop.waitForSelector('#cmPremiumTournamentHero', { timeout: 10_000 });
  await desktop.waitForSelector('#cmPremiumBracket', { timeout: 10_000 });

  const tournamentView = await desktop.evaluate(() => ({
    title: document.querySelector('#cmPremiumTournamentHero h2')?.textContent,
    bracketGames: document.querySelectorAll('#cmPremiumBracket .cm-bracket-game').length,
    groupPanels: document.querySelectorAll('#tournamentDetail .cm-group-panel-premium').length,
    decoratedTeams: document.querySelectorAll('#tournamentDetail .cm-table-team-cell img').length,
    decoratedMatches: document.querySelectorAll('#tournamentDetail .cm-match-card-logo').length
  }));
  if (tournamentView.title !== '8vo Torneo - Copa') throw new Error(`Detalle incorrecto: ${JSON.stringify(tournamentView)}`);
  if (tournamentView.bracketGames < 4) throw new Error(`Llave incompleta: ${tournamentView.bracketGames}`);
  if (tournamentView.groupPanels !== 2) throw new Error(`Paneles de grupo incorrectos: ${tournamentView.groupPanels}`);
  if (tournamentView.decoratedTeams < 6) throw new Error('Las tablas no muestran los escudos de todos los equipos.');

  await desktop.evaluate(() => window.ChuteMundoCore.navigate('jugadores'));
  await desktop.waitForSelector('.cm-player-card');
  if (await desktop.locator('.cm-player-card').count() < 80) throw new Error('Las fichas de jugadores no se renderizaron.');

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  const mobileErrors = [];
  mobile.on('pageerror', (error) => mobileErrors.push(error.message));
  mobile.on('console', (message) => { if (message.type() === 'error') mobileErrors.push(`console: ${message.text()}`); });
  await mobile.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await mobile.waitForFunction(() => Boolean(window.ChutePremiumUI), null, { timeout: 60_000 });
  await mobile.waitForSelector('#cmMobileNav');
  await mobile.waitForTimeout(800);

  const mobileStart = await mobile.evaluate(() => ({
    desktopNavHidden: getComputedStyle(document.querySelector('.nav')).display === 'none',
    mobileNavVisible: getComputedStyle(document.getElementById('cmMobileNav')).display !== 'none',
    navButtons: document.querySelectorAll('#cmMobileNav button').length,
    viewport: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    heroWidth: document.querySelector('.cm-sport-hero')?.getBoundingClientRect().width || 0
  }));
  if (!mobileStart.desktopNavHidden || !mobileStart.mobileNavVisible || mobileStart.navButtons !== 5) throw new Error(`Navegación móvil incorrecta: ${JSON.stringify(mobileStart)}`);
  if (mobileStart.scrollWidth > mobileStart.viewport + 3) throw new Error(`Hay desborde horizontal en móvil: ${mobileStart.scrollWidth}/${mobileStart.viewport}`);
  if (mobileStart.heroWidth > mobileStart.viewport) throw new Error('La portada supera el ancho móvil.');

  await mobile.click('[data-cm-more]');
  await mobile.waitForSelector('#cmMoreSheet.open');
  if (await mobile.locator('#cmMoreSheet button').count() !== 4) throw new Error('El menú Más está incompleto.');
  await mobile.click('[data-cm-mobile-page="equipos"]');
  await mobile.waitForFunction(() => !document.getElementById('equipos')?.hidden);
  await mobile.click('[data-cm-mobile-page="inicio"]');
  await mobile.waitForFunction(() => !document.getElementById('inicio')?.hidden);

  const critical = [...errors, ...mobileErrors].filter((message) => !/favicon|ERR_BLOCKED_BY_CLIENT|QUIC_NETWORK_IDLE_TIMEOUT|firestore.googleapis.com/i.test(message));
  if (critical.length) throw new Error(`Errores de página: ${critical.join(' | ')}`);

  console.log('Chute Mundo v5 smoke OK', { dashboard, tournamentView, mobileStart });
} finally {
  await browser.close();
}
