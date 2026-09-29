import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
const badResources = [];
page.on('response', (response) => {
  const url = response.url();
  if (response.status() >= 400 && /\.(?:css|mjs|js|txt)(?:\?|$)/i.test(url)) badResources.push({ status: response.status(), url });
});
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() =>
    window.ChuteMundoCore &&
    window.ChuteV6 &&
    window.ChuteFifaV525 &&
    window.ChutePlayerIds &&
    window.ChuteVersion?.bootCompleted
  );

  const boot = await page.evaluate(() => ({
    version: window.CHUTE_APP_VERSION,
    title: document.title,
    mobileNav: Boolean(document.getElementById('cmV6MobileNav')),
    width: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
    playerIds: Object.keys(window.ChutePlayerIds.registry()).length,
    legacyResources: performance.getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => /\/chute-v\d/i.test(new URL(url).pathname))
  }));

  if (boot.version !== '6.0.2' || !boot.title.includes('6.0.2')) throw new Error('Versión canónica incorrecta: ' + JSON.stringify(boot));
  if (!boot.mobileNav) throw new Error('No se creó la navegación móvil.');
  if (boot.width > boot.viewport + 3) throw new Error('Existe desborde horizontal móvil: ' + JSON.stringify(boot));
  if (boot.playerIds < 1) throw new Error('No se construyó el registro permanente de jugadores.');
  if (boot.legacyResources.length) throw new Error('El navegador cargó recursos versionados antiguos: ' + JSON.stringify(boot.legacyResources));
  if (badResources.length) throw new Error('Recursos críticos con error HTTP: ' + JSON.stringify(badResources));

  await page.evaluate(() => window.ChuteMundoCore.navigate('administracion'));
  await page.waitForSelector('#cmV6StorageModel', { state: 'visible' });
  const storage = await page.locator('#cmV6StorageModel').innerText();
  if (!storage.includes('Firebase') || !storage.includes('fuente oficial') || !storage.includes('JSON')) throw new Error('Modelo de almacenamiento incompleto.');

  const ids = await page.evaluate(() => {
    const registry = window.ChutePlayerIds.registry();
    const first = Object.values(registry)[0];
    return { count: Object.keys(registry).length, first };
  });
  if (!ids.first?.id || !ids.first?.name) throw new Error('Registro de IDs inválido: ' + JSON.stringify(ids));

  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|ERR_|network|service worker|FirebaseError/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));

  await page.evaluate(() => window.ChuteMundoCore.navigate('inicio'));
  await page.waitForSelector('#cmPremiumDashboard', { state: 'visible' });
  const homeMobile = await page.evaluate(() => {
    const dashboard = document.getElementById('cmPremiumDashboard');
    const hero = dashboard?.querySelector('.cm-sport-hero');
    const rootRect = dashboard?.getBoundingClientRect();
    const sourceNotice = document.getElementById('sourceNotice');
    return {
      viewport: document.documentElement.clientWidth,
      dashboardRight: rootRect?.right || 0,
      heroTitleCount: dashboard?.querySelectorAll('.cm-sport-hero h1').length || 0,
      legacyJourneyCount: document.querySelectorAll('#cmV510Journey').length,
      duplicateV6DashboardCount: document.querySelectorAll('#cmV6Dashboard').length,
      sourceNoticeDisplay: sourceNotice ? getComputedStyle(sourceNotice).display : 'none',
      heroDisplay: hero ? getComputedStyle(hero).display : ''
    };
  });
  if (homeMobile.dashboardRight > homeMobile.viewport + 3) throw new Error('El dashboard principal desborda el viewport: ' + JSON.stringify(homeMobile));
  if (homeMobile.heroTitleCount !== 1) throw new Error('Inicio no tiene una jerarquía única de torneo activo: ' + JSON.stringify(homeMobile));
  if (homeMobile.legacyJourneyCount || homeMobile.duplicateV6DashboardCount) throw new Error('Inicio volvió a cargar dashboards redundantes: ' + JSON.stringify(homeMobile));
  if (homeMobile.sourceNoticeDisplay !== 'none') throw new Error('El aviso redundante de fuente sigue visible en Inicio: ' + JSON.stringify(homeMobile));
  if (!homeMobile.heroDisplay || homeMobile.heroDisplay === 'none') throw new Error('El dashboard deportivo principal no está visible: ' + JSON.stringify(homeMobile));

  await page.evaluate(() => window.ChuteMundoCore.navigate('equipos'));
  await page.waitForSelector('#teamList .cm-team-card', { state: 'visible' });
  const teamsMobile = await page.evaluate(() => {
    const card = document.querySelector('#teamList .cm-team-card');
    const logo = card?.querySelector('img');
    const rect = card?.getBoundingClientRect();
    const logoRect = logo?.getBoundingClientRect();
    return {
      cardRight: rect?.right || 0,
      viewport: document.documentElement.clientWidth,
      logoWidth: logoRect?.width || 0,
      radius: card ? getComputedStyle(card).borderRadius : ''
    };
  });
  if (teamsMobile.cardRight > teamsMobile.viewport + 3) throw new Error('Una tarjeta de equipo desborda el viewport: ' + JSON.stringify(teamsMobile));
  if (teamsMobile.logoWidth > 130) throw new Error('Un escudo de equipo se renderiza sobredimensionado: ' + JSON.stringify(teamsMobile));
  if (!teamsMobile.radius || teamsMobile.radius === '0px') throw new Error('Las tarjetas de equipos perdieron estilos: ' + JSON.stringify(teamsMobile));

  await page.evaluate(() => window.ChuteMundoCore.navigate('estadisticas'));
  await page.waitForSelector('#cmV521History', { state: 'visible' });
  await page.waitForSelector('#cmV521History .cm-v521-hero', { state: 'visible' });
  const statsMobile = await page.evaluate(() => {
    const history = document.getElementById('cmV521History');
    const hero = history?.querySelector('.cm-v521-hero');
    const activePanel = history?.querySelector('.cm-v521-panel.active:not([hidden])');
    const rect = history?.getBoundingClientRect();
    const heroStyle = hero ? getComputedStyle(hero) : null;
    const historyCss = [...document.querySelectorAll('link[rel="stylesheet"]')].map(link => link.getAttribute('href') || '').find(href => href.includes('/styles/history.css'));
    return {
      height: rect?.height || 0,
      right: rect?.right || 0,
      viewport: document.documentElement.clientWidth,
      visibleChildren: history ? [...history.children].filter((node) => {
        const style = getComputedStyle(node);
        return style.display !== 'none' && style.visibility !== 'hidden';
      }).length : 0,
      heroDisplay: heroStyle?.display || '',
      heroBackground: heroStyle?.backgroundImage || '',
      activePanel: Boolean(activePanel),
      historyCss: historyCss || '',
      duplicateIntro: document.querySelectorAll('#cmV6RankingIntro,#cmV6HistoricalRanking').length
    };
  });
  if (statsMobile.height < 500 || statsMobile.visibleChildren < 3) throw new Error('Estadísticas quedó visualmente incompleto: ' + JSON.stringify(statsMobile));
  if (statsMobile.right > statsMobile.viewport + 3) throw new Error('Estadísticas desborda el viewport: ' + JSON.stringify(statsMobile));
  if (statsMobile.heroDisplay === 'none' || !statsMobile.heroBackground || statsMobile.heroBackground === 'none') throw new Error('El Archivo Histórico perdió sus estilos principales: ' + JSON.stringify(statsMobile));
  if (!statsMobile.activePanel) throw new Error('Estadísticas no tiene un panel activo visible: ' + JSON.stringify(statsMobile));
  if (!statsMobile.historyCss.includes('/styles/history.css')) throw new Error('El stylesheet del Archivo Histórico no está cargado: ' + JSON.stringify(statsMobile));
  if (statsMobile.duplicateIntro) throw new Error('Persisten paneles estadísticos duplicados: ' + JSON.stringify(statsMobile));

  const pageLayouts = {};
  for (const pageId of ['torneos','partidos','equipos','jugadores','estadisticas','disciplina','administracion']) {
    await page.evaluate((id) => window.ChuteMundoCore.navigate(id), pageId);
    await page.waitForTimeout(40);
    pageLayouts[pageId] = await page.evaluate((id) => {
      const node = document.getElementById(id);
      const rect = node?.getBoundingClientRect();
      return {
        visible: Boolean(node && !node.hidden && getComputedStyle(node).display !== 'none'),
        right: rect?.right || 0,
        viewport: document.documentElement.clientWidth
      };
    }, pageId);
    if (!pageLayouts[pageId].visible) throw new Error('Página no visible: ' + pageId + ' ' + JSON.stringify(pageLayouts[pageId]));
    if (pageLayouts[pageId].right > pageLayouts[pageId].viewport + 3) throw new Error('Página con desborde horizontal: ' + pageId + ' ' + JSON.stringify(pageLayouts[pageId]));
  }
  if (badResources.length) throw new Error('Recursos críticos con error HTTP tras recorrer la app: ' + JSON.stringify(badResources));

  console.log('ChuteMundo 6.0.2 smoke OK', { boot, ids: ids.count, homeMobile, teamsMobile, statsMobile, pageLayouts });
} finally {
  await context.close();
  await browser.close();
}
