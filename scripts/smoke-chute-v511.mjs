import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteMundoCore && window.ChuteV511 && document.title.includes('v5.11'));
  const result = await page.evaluate(() => ({
    version: window.ChuteV511.version,
    search: Boolean(document.getElementById('cmV511SearchButton')),
    manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href') || '',
    quality: Array.isArray(window.ChuteV511.qualityIssues()),
    randomizer: typeof window.ChuteV511.randomizeTournamentState === 'function',
    viewport: document.documentElement.clientWidth,
    width: document.documentElement.scrollWidth
  }));
  if (result.version !== '5.11.0' || !result.search || !result.manifest.includes('manifest.webmanifest') || !result.quality || !result.randomizer || result.width > result.viewport + 3) throw new Error(JSON.stringify(result));
  await page.click('#cmV511SearchButton');
  await page.waitForSelector('#cmV511SearchInput');
  await page.evaluate(() => window.ChuteMundoCore.navigate('administracion'));
  await page.waitForFunction(() => document.getElementById('cmV511Quality') && document.getElementById('cmV511Backups'));
  console.log('Chute Mundo v5.11 smoke OK', result);
} finally {
  await browser.close();
}
