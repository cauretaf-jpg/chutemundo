import { chromium } from 'playwright';

const sizes = [
  { name: 'android-small', viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true },
  { name: 'android-standard', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { name: 'desktop', viewport: { width: 1280, height: 800 } }
];
const browser = await chromium.launch({ headless: true });
const failures = [];

async function check(page, expected, label) {
  try {
    await page.waitForFunction(expected => location.hash === '#' + expected && window.ChuteExperience?.route?.() === expected, expected, { timeout: 3000 });
    const result = await page.evaluate(() => ({
      route: window.ChuteExperience?.route?.(),
      hash: location.hash,
      h1: document.querySelector('#cm62Root h1')?.textContent,
      error: Boolean(document.querySelector('#cm62Root .cm62-error'))
    }));
    if (!result.h1 || result.error) failures.push(label + ': ruta sin pantalla correcta: ' + JSON.stringify(result));
  } catch(error) {
    const snapshot = await page.evaluate(() => ({
      route: window.ChuteExperience?.route?.(),
      hash: location.hash,
      h1: document.querySelector('#cm62Root h1')?.textContent,
      active: document.activeElement?.outerHTML?.slice(0, 200)
    }));
    failures.push(label + ': click no navegó a ' + expected + '; ' + JSON.stringify(snapshot) + '; ' + String(error));
  }
}
async function clickAndCheck(page, selector, expected, label) {
  try {
    await page.locator(selector).first().click({ timeout: 8000 });
    await check(page, expected, label);
  } catch(error) {
    failures.push(label + ': selector ' + selector + ' no se pudo pulsar: ' + String(error));
  }
}

try {
  for (const device of sizes) {
    const ctx = await browser.newContext({ ...device, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const jsErrors = [];
    page.on('pageerror', error => jsErrors.push(String(error)));
    try {
      await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.ChuteExperience?.enabled && document.querySelector('#cm62Root .cm62-hero'));
      const initial = await page.evaluate(() => ({
        active: window.ChuteExperience?.route?.(),
        mainLinks: [...document.querySelectorAll('#cm62Root a[data-cm62-route]')].length,
        bottomLinks: [...document.querySelectorAll('#cm62BottomNav a[data-cm62-route]')].length
      }));
      if (initial.mainLinks < 2 || initial.bottomLinks !== 4) failures.push(device.name + ': enlaces ausentes: ' + JSON.stringify(initial));

      await clickAndCheck(page, '#cm62Root .cm62-hero .cm62-btn[data-cm62-route]', '/torneos/' + encodeURIComponent(
        await page.evaluate(() => window.ChuteMundoCore.getState().tournaments.slice().reverse().find(t => t.status === 'active')?.id || window.ChuteMundoCore.getState().tournaments.at(-1)?.id)
      ), device.name + ': CTA Inicio → torneo activo');

      const tabs = await page.evaluate(() => {
        const base = window.ChuteExperience?.route?.();
        return { tournament: base, fixture: base + '/partidos' };
      });
      await clickAndCheck(page, '#cm62Root .cm62-tabs a[href$="/partidos"]', tabs.fixture, device.name + ': pestaña Partidos de torneo');

      await clickAndCheck(page, '#cm62Root a.cm62-result', await page.locator('#cm62Root a.cm62-result').first().getAttribute('data-cm62-route'), device.name + ': partido en el fixture');

      const clubRoute = await page.locator('#cm62Root a.cm62-scoreboard-team').first().getAttribute('data-cm62-route');
      await clickAndCheck(page, '#cm62Root a.cm62-scoreboard-team', clubRoute, device.name + ': marcador → club');

      await clickAndCheck(page, '#cm62Root .cm62-tabs a[href$="/plantel"]', clubRoute + '/plantel', device.name + ': pestaña Plantel');
      const playerRoute = await page.locator('#cm62Root a.cm62-player-card').first().getAttribute('data-cm62-route');
      await clickAndCheck(page, '#cm62Root a.cm62-player-card', playerRoute, device.name + ': plantel → jugador');
      await clickAndCheck(page, '#cm62Root .cm62-tabs a[href$="/carrera"]', playerRoute + '/carrera', device.name + ': Carrera de jugador');

      await clickAndCheck(page, '#cm62Root button[data-cm62-back]', playerRoute, device.name + ': botón Volver contextual');

      if (device.name === 'desktop') {
        await clickAndCheck(page, '.nav-button[data-page="estadisticas"]', '/estadisticas', device.name + ': navegación superior a estadísticas');
        await clickAndCheck(page, '#cm62Root a[data-cm62-route="/estadisticas/fifa"]', '/estadisticas/fifa', device.name + ': tarjeta FIFA');
      } else {
        await clickAndCheck(page, '#cm62BottomNav a[data-cm62-route="/torneos"]', '/torneos', device.name + ': navegación inferior Torneos');
        await page.locator('#cm62BottomNav [data-cm62-more]').click();
        const sheetVisible = await page.locator('#cm62MoreSheet').isVisible();
        if (!sheetVisible) failures.push(device.name + ': menú Más no apareció');
        await clickAndCheck(page, '#cm62MoreSheet a[data-cm62-route="/estadisticas"]', '/estadisticas', device.name + ': menú Más → Estadísticas');
      }

      await page.reload({waitUntil:'domcontentloaded'});
      await page.waitForFunction(() => window.ChuteExperience?.enabled && document.querySelector('#cm62Root h1'));
      await check(page, '/estadisticas' + (device.name === 'desktop' ? '/fifa' : ''), device.name + ': deep link tras recargar');
      const fatal = jsErrors.filter(m => !/FirebaseError|permission-denied|Failed to fetch|network|ERR_/i.test(m));
      if (fatal.length) failures.push(device.name + ': errores JS: ' + fatal.join(' || '));
    } catch(error) {
      failures.push(device.name + ': error: ' + String(error));
      await page.screenshot({path:'/tmp/chute-navigation-'+device.name+'.png', fullPage:true}).catch(()=>{});
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error('PRUEBAS REALES DE CLIC: FALLO');
  failures.forEach(x => console.error(' - ' + x));
  process.exit(1);
}
console.log('PRUEBAS REALES DE CLIC: OK (CTA, pestañas, partidos, club, jugador, volver, menús, recarga)');
