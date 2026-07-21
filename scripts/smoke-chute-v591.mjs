import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteMundoCore && window.ChuteV59 && window.ChuteV591 && window.ChuteV514UnifiedMatch);
  await page.evaluate(() => window.ChuteMundoCore.navigate('partidos'));
  await page.waitForFunction(() => !document.getElementById('partidos').hidden && document.getElementById('cmV591LivePanel') && document.querySelector('[data-cm-v52-open-match]'));
  const result = await page.evaluate(() => {
    const legacyButton = document.querySelector('#matchesList .cm-v591-live-access');
    const unifiedButton = document.querySelector('[data-cm-v52-open-match]');
    const panel = document.getElementById('cmV591LivePanel');
    return {
      version: window.ChuteV591?.version || 'ui',
      legacyPanelExists: Boolean(panel),
      legacyPanelHidden: panel ? getComputedStyle(panel).display === 'none' : true,
      legacyButtons: document.querySelectorAll('#matchesList .cm-v591-live-access').length,
      legacyButtonHidden: legacyButton ? getComputedStyle(legacyButton).display === 'none' : true,
      unifiedText: unifiedButton?.textContent.trim() || '',
      width: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth
    };
  });
  if (!result.legacyPanelExists || !result.legacyPanelHidden || !result.legacyButtonHidden || result.unifiedText !== 'Ver partido' || result.width > result.viewport + 3) throw new Error(JSON.stringify(result));
  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));
  console.log('Chute Mundo v5.9.1 regression smoke OK', result);
} finally {
  await browser.close();
}
