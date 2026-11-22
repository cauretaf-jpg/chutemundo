import { chromium } from 'playwright';

const viewports = [
  { name: 'mobile-small', width: 360, height: 800 },
  { name: 'mobile-standard', width: 390, height: 844 },
  { name: 'mobile-large', width: 412, height: 915 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 }
];
const pages = ['inicio','torneos','partidos','equipos','jugadores','estadisticas','disciplina','administracion'];
const browser = await chromium.launch({ headless: true });
const failures = [];
const summaries = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
    const page = await context.newPage();
    const badResources = [];
    const pageErrors = [];
    page.on('response', (response) => {
      if (response.status() >= 400 && /\.(?:css|mjs|js)(?:\?|$)/i.test(response.url())) {
        badResources.push({ status: response.status(), url: response.url() });
      }
    });
    page.on('pageerror', (error) => pageErrors.push(String(error)));

    try {
      await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.ChuteMundoCore && window.ChuteVersion?.bootCompleted);
      const rows = {};
      for (const pageId of pages) {
        await page.evaluate((id) => window.ChuteMundoCore.navigate(id), pageId);
        await page.waitForTimeout(50);
        rows[pageId] = await page.evaluate((id) => {
          const node = document.getElementById(id);
          const rect = node?.getBoundingClientRect();
          return {
            visible: Boolean(node && !node.hidden && getComputedStyle(node).display !== 'none'),
            pageRight: rect?.right || 0,
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: document.documentElement.clientWidth
          };
        }, pageId);
        if (!rows[pageId].visible) failures.push(`${viewport.name}: ${pageId} no está visible`);
        if (rows[pageId].pageRight > rows[pageId].viewportWidth + 3) failures.push(`${viewport.name}: ${pageId} desborda horizontalmente`);
        if (rows[pageId].documentWidth > rows[pageId].viewportWidth + 3) failures.push(`${viewport.name}: documento desborda en ${pageId}`);
      }
      if (viewport.width <= 768) {
        const mobileNav = await page.locator('#cmV6MobileNav').isVisible().catch(() => false);
        if (!mobileNav) failures.push(`${viewport.name}: navegación móvil no visible`);
      }
      if (badResources.length) failures.push(`${viewport.name}: recursos rotos ${JSON.stringify(badResources)}`);
      const criticalErrors = pageErrors.filter((message) => !/firestore|permission-denied|network|FirebaseError|ERR_/i.test(message));
      if (criticalErrors.length) failures.push(`${viewport.name}: errores de página ${criticalErrors.join(' | ')}`);
      summaries.push({ viewport, pages: rows });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error('Responsive smoke: FALLÓ');
  failures.forEach((failure) => console.error(' - ' + failure));
  process.exit(1);
}

console.log('Responsive smoke: OK', viewports.map((viewport) => viewport.name).join(', '));
