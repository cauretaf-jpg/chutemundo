import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteMundoCore && window.ChuteV5254PlayerPhotoFix && window.ChuteVersion?.bootCompleted);

  const result = await page.evaluate(async () => {
    const model = window.ChuteDetailModel;
    const urls = {
      arnold: model.photoUrl('perla', 'Arnold Vega'),
      julio: model.photoUrl('perla', 'Julio Vega'),
      arnoldWrongTeam: model.photoUrl('trucha', 'Arnold Vega'),
      rocco: model.photoUrl('cualquier-equipo', 'Rocco Caruso'),
      roccoLegacy: model.photoUrl('cualquier-equipo', 'Rocco Carusso'),
      warner: model.photoUrl('trucha', 'Warner Ferrara'),
      warnerWrongTeam: model.photoUrl('perla', 'Warner Ferrara'),
      other: model.photoUrl('trucha', 'Jugador Distinto')
    };

    const repaired = {};
    for (const [key, alt] of Object.entries({ arnold: 'Arnold Vega', rocco: 'Rocco Caruso', warner: 'Warner Ferrara' })) {
      const image = document.createElement('img');
      image.alt = alt;
      image.src = `https://example.invalid/${key}.png`;
      image.classList.add('photo-fallback');
      document.body.appendChild(image);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      repaired[key] = { src: image.src, fallback: image.classList.contains('photo-fallback') };
      image.remove();
    }

    const dimensions = {};
    for (const key of ['arnold', 'rocco', 'warner']) {
      dimensions[key] = await new Promise((resolve) => {
        const probe = new Image();
        probe.onload = () => resolve({ width: probe.naturalWidth, height: probe.naturalHeight });
        probe.onerror = () => resolve({ width: 0, height: 0 });
        probe.src = urls[key];
      });
    }
    return { urls, repaired, dimensions };
  });

  const expected = {
    arnold: '/player-photos/overrides/arnold-vega.png',
    rocco: '/player-photos/overrides/rocco-caruso.png',
    warner: '/player-photos/overrides/warner-ferrara.png'
  };
  for (const [key, path] of Object.entries(expected)) {
    if (!result.urls[key].includes(path)) throw new Error(`${key} no usa la fotografía corregida.`);
    if (!result.repaired[key].src.includes(path) || result.repaired[key].fallback) throw new Error(`${key} no repara imágenes ya renderizadas.`);
  }
  if (!result.urls.julio.includes(expected.arnold)) throw new Error('El alias histórico Julio Vega no usa la nueva fotografía.');
  if (!result.urls.roccoLegacy.includes(expected.rocco)) throw new Error('La variante Rocco Carusso no usa la nueva fotografía.');
  if (result.urls.arnoldWrongTeam.includes(expected.arnold)) throw new Error('Arnold Vega fue corregido fuera de La Perla United.');
  if (result.urls.warnerWrongTeam.includes(expected.warner)) throw new Error('Warner Ferrara fue corregido fuera de Trucha FC.');
  if (Object.values(expected).some((path) => result.urls.other.includes(path))) throw new Error('La corrección afectó a un jugador distinto.');

  const expectedDimensions = {
    arnold: { width: 252, height: 420 },
    rocco: { width: 256, height: 420 },
    warner: { width: 383, height: 420 }
  };
  for (const [key, dimensions] of Object.entries(expectedDimensions)) {
    if (result.dimensions[key].width !== dimensions.width || result.dimensions[key].height !== dimensions.height) {
      throw new Error(`Dimensiones inesperadas para ${key}: ${JSON.stringify(result.dimensions[key])}.`);
    }
  }

  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|network|service worker|example\.invalid/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));
  console.log('Chute Mundo v5.25.4 player photos smoke OK', result.dimensions);
} finally {
  await context.close();
  await browser.close();
}
