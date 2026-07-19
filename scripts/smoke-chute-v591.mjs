import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteMundoCore && window.ChuteV59 && window.ChuteV591);
  await page.click('.nav [data-page="partidos"]');
  await page.waitForFunction(() => document.getElementById('cmV591LivePanel') && document.querySelector('#matchesList .cm-v591-live-access'));
  const result = await page.evaluate(() => ({
    version: window.ChuteV591.version,
    panel: document.getElementById('cmV591LivePanel')?.textContent || '',
    buttons: document.querySelectorAll('#matchesList .cm-v591-live-access').length,
    visible: getComputedStyle(document.querySelector('#matchesList .cm-v591-live-access')).display !== 'none',
    width: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth
  }));
  if (result.version !== '5.9.1' || !result.panel.includes('Modo partido') || result.buttons < 1 || !result.visible || result.width > result.viewport + 3) throw new Error(JSON.stringify(result));
  console.log('Chute Mundo v5.9.1 smoke OK', result);
} finally {
  await browser.close();
}
