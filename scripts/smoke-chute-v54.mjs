import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => Boolean(window.ChuteMundoCore && window.ChuteTournamentHub && window.ChuteStatsV52 && window.ChuteDivisionsV54 && window.ChuteV54FormGuard), null, { timeout: 60_000 });
  await page.waitForSelector('#cmPremiumDashboard');

  const base = await page.evaluate(() => ({
    title: document.title,
    active: window.ChuteMundoCore.getState().tournaments.find((item) => item.status === 'active')?.id,
    css: Array.from(document.styleSheets).some((sheet) => sheet.href?.includes('chute-v54.css')),
    fifa: window.ChuteDivisionsV54.fifaOrder()
  }));
  if (!base.title.includes('v5.4') || base.active !== 't8' || !base.css || base.fifa.length !== 6) throw new Error(`Carga v5.4 incorrecta: ${JSON.stringify(base)}`);

  await page.click('[data-cm-open-active]');
  await page.waitForSelector('#cmTournamentHub');
  await page.click('[data-cm-tournament-tab="fixture"]');
  await page.waitForFunction(() => document.querySelectorAll('.cm-v54-match-toggle').length === 10);
  const compact = await page.evaluate(() => ({
    cards: document.querySelectorAll('.cm-v54-compact-match').length,
    open: document.querySelectorAll('.cm-v54-compact-match.expanded').length,
    hidden: Array.from(document.querySelectorAll('.cm-v54-compact-match')).every((card) => !card.querySelector(':scope > footer') || getComputedStyle(card.querySelector(':scope > footer')).display === 'none')
  }));
  if (compact.cards !== 10 || compact.open !== 0 || !compact.hidden) throw new Error(`Fixture no inicia compacto: ${JSON.stringify(compact)}`);
  await page.locator('.cm-v54-match-toggle').nth(0).click();
  await page.locator('.cm-v54-match-toggle').nth(1).click();
  const accordion = await page.evaluate(() => ({
    open: document.querySelectorAll('.cm-v54-compact-match.expanded').length,
    index: Array.from(document.querySelectorAll('.cm-v54-compact-match')).findIndex((card) => card.classList.contains('expanded'))
  }));
  if (accordion.open !== 1 || accordion.index !== 1) throw new Error(`Acordeón incorrecto: ${JSON.stringify(accordion)}`);

  await page.evaluate(() => {
    window.ChuteMundoCore.navigate('torneos');
    document.querySelector('#tournamentForm')?.closest('.admin-only')?.removeAttribute('hidden');
    const select = document.getElementById('tournamentType');
    select.value = 'division_season';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelectorAll('[data-cm-division-slot]').length === 6);
  const form = await page.evaluate(() => {
    const selected = Array.from(document.querySelectorAll('[data-cm-division-slot]')).map((item) => item.value);
    return {
      selected,
      ranking: window.ChuteDivisionsV54.fifaOrder(),
      unique: new Set(selected).size,
      controls: ['cmDivisionLegs','cmDivisionFinalLegs','cmFirstPlayoff','cmSecondPlayoff','cmPromotionMode'].every((id) => Boolean(document.getElementById(id)))
    };
  });
  if (form.unique !== 6 || !form.controls || form.selected.join('|') !== form.ranking.join('|')) throw new Error(`Composición inaugural incorrecta: ${JSON.stringify(form)}`);
  await page.selectOption('#cmDivisionLegs', '1');
  await page.waitForTimeout(1400);
  if (await page.inputValue('#cmDivisionLegs') !== '1') throw new Error('El formulario pierde la configuración durante la edición.');

  const engine = await page.evaluate(() => {
    const api = window.ChuteDivisionsV54;
    const ids = api.fifaOrder();
    const first = ids.slice(0, 3); const second = ids.slice(3, 6);
    const draft = api.buildSeason({ name: 'Prueba', legs: 2, firstPlayoff: true, secondPlayoff: true, finalLegs: 1, promotionMode: 'playoff', firstIds: first, secondIds: second });
    const order = new Map([...first, ...second].map((id, index) => [id, index % 3]));
    for (const match of draft.matches) {
      const homeWins = order.get(match.home) < order.get(match.away);
      match.homeGoals = homeWins ? 3 : 0;
      match.awayGoals = homeWins ? 0 : 3;
    }
    const regular = draft.matches.length;
    api.syncTournament(draft);
    const finals = draft.matches.filter((match) => match.stage === 'knockout');
    for (const match of finals) { match.homeGoals = 2; match.awayGoals = 0; }
    api.syncTournament(draft);
    return {
      groups: draft.groups.map((group) => group.teamIds.length), regular, finals: finals.length,
      promoted: draft.divisionResults?.promoted, relegated: draft.divisionResults?.relegated,
      nextFirst: draft.nextComposition?.first || [], nextSecond: draft.nextComposition?.second || [], status: draft.status,
      expectedPromoted: second[0], expectedRelegated: first[2]
    };
  });
  if (engine.groups.join('|') !== '3|3' || engine.regular !== 12 || engine.finals !== 2) throw new Error(`Fixture divisional incorrecto: ${JSON.stringify(engine)}`);
  if (engine.promoted !== engine.expectedPromoted || engine.relegated !== engine.expectedRelegated || engine.nextFirst.length !== 3 || engine.nextSecond.length !== 3 || engine.status !== 'historical') throw new Error(`Ascenso y descenso incorrectos: ${JSON.stringify(engine)}`);

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await mobile.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await mobile.waitForFunction(() => Boolean(window.ChuteDivisionsV54));
  await mobile.click('[data-cm-open-active]');
  await mobile.click('[data-cm-tournament-tab="fixture"]');
  await mobile.waitForFunction(() => document.querySelectorAll('.cm-v54-match-toggle').length === 10);
  const mobileState = await mobile.evaluate(() => ({ viewport: document.documentElement.clientWidth, width: document.documentElement.scrollWidth }));
  if (mobileState.width > mobileState.viewport + 3) throw new Error(`Desborde móvil: ${JSON.stringify(mobileState)}`);
  await mobile.screenshot({ path: '/tmp/chute-v5-mobile.png', fullPage: true });
  await page.screenshot({ path: '/tmp/chute-v5-desktop.png', fullPage: true });

  const critical = errors.filter((message) => !/favicon|firestore.googleapis.com|Failed to load resource|QUIC_NETWORK/i.test(message));
  if (critical.length) throw new Error(`Errores de página: ${critical.join(' | ')}`);
  console.log('Chute Mundo v5.4 smoke OK', { base, compact, accordion, form, engine, mobileState });
} finally {
  await browser.close();
}
