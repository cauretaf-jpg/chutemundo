import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteMundoCore && window.ChuteV59);
  await page.evaluate(() => window.ChuteMundoCore.navigate('partidos'));
  await page.waitForFunction(() => !document.getElementById('partidos').hidden && document.getElementById('cmV591LivePanel') && document.querySelector('#matchesList .cm-v591-live-access'));
  const result = await page.evaluate(() => {
    const button = document.querySelector('#matchesList .cm-v591-live-access');
    return {
      version: window.ChuteV591?.version || 'ui',
      panel: document.getElementById('cmV591LivePanel')?.textContent || '',
      buttons: document.querySelectorAll('#matchesList .cm-v591-live-access').length,
      visible: button ? getComputedStyle(button).display !== 'none' : false,
      locked: Boolean(button?.classList.contains('is-locked')),
      width: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth
    };
  });
  if (!result.panel.includes('Modo partido') || result.buttons < 1 || !result.visible || !result.locked || result.width > result.viewport + 3) throw new Error(JSON.stringify(result));
  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));
  console.log('Chute Mundo v5.9.1 smoke OK', result);
} finally {
  await browser.close();
}