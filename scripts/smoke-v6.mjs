import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
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

  if (boot.version !== '6.0.1' || !boot.title.includes('6.0.1')) throw new Error('Versión canónica incorrecta: ' + JSON.stringify(boot));
  if (!boot.mobileNav) throw new Error('No se creó la navegación móvil.');
  if (boot.width > boot.viewport + 3) throw new Error('Existe desborde horizontal móvil: ' + JSON.stringify(boot));
  if (boot.playerIds < 1) throw new Error('No se construyó el registro permanente de jugadores.');
  if (boot.legacyResources.length) throw new Error('El navegador cargó recursos versionados antiguos: ' + JSON.stringify(boot.legacyResources));

  await page.evaluate(() => window.ChuteMundoCore.navigate('estadisticas'));
  await page.waitForSelector('#cmV6HistoricalRanking', { state: 'visible' });
  const ranking = await page.locator('#cmV6HistoricalRanking').innerText();
  if (!ranking.includes('Ranking histórico') || !ranking.includes('Títulos') || !ranking.includes('Pts')) throw new Error('Ranking histórico incompleto.');

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
  await page.waitForSelector('#cmV510Journey', { state: 'visible' });
  const homeMobile = await page.evaluate(() => {
    const journey = document.getElementById('cmV510Journey');
    const logo = journey?.querySelector('.cm-v510-team-logo');
    const leaders = journey?.querySelector('.cm-v510-leaders');
    const button = journey?.querySelector('.cm-v510-journey-head > button');
    const rect = journey?.getBoundingClientRect();
    const logoRect = logo?.getBoundingClientRect();
    const buttonStyle = button ? getComputedStyle(button) : null;
    return {
      journeyRight: rect?.right || 0,
      viewport: document.documentElement.clientWidth,
      logoWidth: logoRect?.width || 0,
      leadersDisplay: leaders ? getComputedStyle(leaders).display : '',
      buttonRadius: buttonStyle?.borderRadius || ''
    };
  });
  if (homeMobile.journeyRight > homeMobile.viewport + 3) throw new Error('El Centro de Jornada desborda el viewport: ' + JSON.stringify(homeMobile));
  if (homeMobile.logoWidth > 80) throw new Error('El logo del próximo partido es demasiado grande: ' + JSON.stringify(homeMobile));
  if (homeMobile.leadersDisplay !== 'grid') throw new Error('El bloque Líderes perdió su layout: ' + JSON.stringify(homeMobile));
  if (!homeMobile.buttonRadius || homeMobile.buttonRadius === '0px') throw new Error('El botón Abrir torneo perdió estilos: ' + JSON.stringify(homeMobile));

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
  const statsMobile = await page.evaluate(() => {
    const history = document.getElementById('cmV521History');
    const rect = history?.getBoundingClientRect();
    return {
      height: rect?.height || 0,
      right: rect?.right || 0,
      viewport: document.documentElement.clientWidth,
      visibleChildren: history ? [...history.children].filter((node) => {
        const style = getComputedStyle(node);
        return style.display !== 'none' && style.visibility !== 'hidden';
      }).length : 0
    };
  });
  if (statsMobile.height < 180 || statsMobile.visibleChildren < 1) throw new Error('Estadísticas quedó visualmente vacío: ' + JSON.stringify(statsMobile));
  if (statsMobile.right > statsMobile.viewport + 3) throw new Error('Estadísticas desborda el viewport: ' + JSON.stringify(statsMobile));

  console.log('ChuteMundo 6.0.1 smoke OK', { boot, ids: ids.count, homeMobile, teamsMobile, statsMobile });
} finally {
  await context.close();
  await browser.close();
}
