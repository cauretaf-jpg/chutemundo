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

  if (boot.version !== '6.0.0' || !boot.title.includes('6.0.0')) throw new Error('Versión canónica incorrecta: ' + JSON.stringify(boot));
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

  console.log('ChuteMundo 6 smoke OK', { boot, ids: ids.count });
} finally {
  await context.close();
  await browser.close();
}
