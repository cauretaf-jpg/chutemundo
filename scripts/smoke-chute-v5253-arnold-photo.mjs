import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteMundoCore && window.ChuteV5253ArnoldPhoto && window.ChuteVersion?.bootCompleted);

  const result = await page.evaluate(async () => {
    const arnold = window.ChuteDetailModel.photoUrl('perla', 'Arnold Vega');
    const legacy = window.ChuteDetailModel.photoUrl('perla', 'Julio Vega');
    const otherTeam = window.ChuteDetailModel.photoUrl('trucha', 'Arnold Vega');
    const image = document.createElement('img');
    image.alt = 'Arnold Vega';
    image.src = 'https://example.invalid/player-photos/perla/arnold-vega.png';
    document.body.appendChild(image);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const repaired = image.src;
    const decoded = await new Promise((resolve) => {
      const probe = new Image();
      probe.onload = () => resolve({ width: probe.naturalWidth, height: probe.naturalHeight });
      probe.onerror = () => resolve({ width: 0, height: 0 });
      probe.src = arnold;
    });
    image.remove();
    return { arnold, legacy, otherTeam, repaired, decoded };
  });

  for (const key of ['arnold', 'legacy', 'repaired']) {
    if (!result[key].startsWith('data:image/jpeg;base64,')) throw new Error(`${key} no usa la fotografía incorporada.`);
  }
  if (result.otherTeam.startsWith('data:image/jpeg;base64,')) throw new Error('La corrección se aplicó fuera de La Perla United.');
  if (result.decoded.width !== 160 || result.decoded.height !== 250) throw new Error(`Dimensiones inesperadas: ${JSON.stringify(result.decoded)}.`);

  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|network|service worker|example\.invalid/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));
  console.log('Chute Mundo v5.25.3 Arnold Vega photo smoke OK', { decoded: result.decoded });
} finally {
  await context.close();
  await browser.close();
}
