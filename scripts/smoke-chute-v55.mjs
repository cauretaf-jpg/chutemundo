import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

try {
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => Boolean(window.ChuteMundoCore && window.ChuteDivisionsV54 && window.ChuteMatchToolsV55), null, { timeout: 60_000 });

  const base = await page.evaluate(() => {
    const core = window.ChuteMundoCore;
    const state = core.getState();
    const ids = state.teams.filter((team) => !team.archived).slice(0, 6).map((team) => team.id);
    if (ids.length < 6) throw new Error('No hay seis equipos para probar las divisiones.');
    const season = window.ChuteDivisionsV54.buildSeason({
      name: 'Temporada de prueba v5.5', status: 'active', legs: 1,
      firstPlayoff: true, secondPlayoff: true, finalLegs: 1, promotionMode: 'playoff',
      firstIds: ids.slice(0, 3), secondIds: ids.slice(3, 6)
    });
    season.id = 'test_v55';
    state.tournaments = state.tournaments.filter((tournament) => tournament.id !== season.id);
    state.tournaments.push(season);
    core.setState(state);
    core.navigate('torneos');
    return { id: season.id, firstMatch: season.matches[0].id };
  });

  await page.click(`[data-open-tournament="${base.id}"]`);
  await page.waitForSelector('#cmTournamentHub');
  await page.click('[data-cm-tournament-tab="fixture"]');
  await page.waitForSelector('[data-cm-fixture-division]');

  const allCards = await page.locator('.cm-hub-match:not([hidden])').count();
  await page.selectOption('[data-cm-fixture-division]', 'first');
  const firstState = await page.evaluate(() => ({
    visible: document.querySelectorAll('.cm-hub-match:not([hidden])').length,
    labels: [...document.querySelectorAll('.cm-hub-match:not([hidden]) > header > span')].map((item) => item.textContent.trim())
  }));
  await page.selectOption('[data-cm-fixture-division]', 'second');
  const secondState = await page.evaluate(() => ({
    visible: document.querySelectorAll('.cm-hub-match:not([hidden])').length,
    labels: [...document.querySelectorAll('.cm-hub-match:not([hidden]) > header > span')].map((item) => item.textContent.trim())
  }));
  if (allCards !== 6 || firstState.visible !== 3 || secondState.visible !== 3) throw new Error(`Filtro de divisiones incorrecto: ${JSON.stringify({ allCards, firstState, secondState })}`);
  if (firstState.labels.some((label) => !label.includes('1.ª')) || secondState.labels.some((label) => !label.includes('2.ª'))) throw new Error('El filtro mezcló partidos de ambas divisiones.');

  await page.evaluate(({ tournamentId, matchId }) => window.ChuteDetailEvents.openDetailedMatch(tournamentId, matchId), { tournamentId: base.id, matchId: base.firstMatch });
  await page.waitForSelector('.cm-match-editor[data-cm-v55-enhanced="true"]');

  const editor = await page.evaluate(() => {
    const minuteValues = [...document.querySelectorAll('#cmGoalMinute-home option')].map((option) => option.value).filter(Boolean);
    const cardValues = [...document.querySelectorAll('#cmCardMinute-home option')].map((option) => option.value).filter(Boolean);
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return {
      title: document.title,
      date: document.getElementById('cmMatchDate')?.value,
      expectedDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      time: document.getElementById('cmMatchTime')?.value,
      venueTag: document.getElementById('cmMatchVenue')?.tagName,
      minuteValues,
      cardValues,
      css: [...document.styleSheets].some((sheet) => sheet.href?.includes('chute-v55.css'))
    };
  });
  const expectedMinutes = ['0','10','20','30','45','50','60','70','80','90','105','120'];
  if (!editor.title.includes('v5.5') || editor.date !== editor.expectedDate || !/^\d{2}:\d{2}$/.test(editor.time || '') || editor.venueTag !== 'SELECT' || !editor.css) throw new Error(`Editor v5.5 incompleto: ${JSON.stringify(editor)}`);
  if (editor.minuteValues.join('|') !== expectedMinutes.join('|') || editor.cardValues.join('|') !== expectedMinutes.join('|')) throw new Error(`Minutos oficiales incorrectos: ${JSON.stringify(editor)}`);

  await page.click('[data-cm-quick-venue]');
  await page.fill('[data-cm-quick-venue-name]', 'Cancha Central');
  await page.click('[data-cm-save-quick-venue]');
  const venueState = await page.evaluate(() => ({
    selected: document.getElementById('cmMatchVenue')?.value,
    last: window.ChuteMundoCore.getState().config?.lastVenue,
    venues: window.ChuteMundoCore.getState().config?.venues || []
  }));
  if (venueState.selected !== 'Cancha Central' || venueState.last !== 'Cancha Central' || !venueState.venues.includes('Cancha Central')) throw new Error(`La sede no quedó recordada: ${JSON.stringify(venueState)}`);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, width: document.documentElement.scrollWidth }));
  if (mobile.width > mobile.viewport + 3) throw new Error(`Desbordamiento móvil v5.5: ${JSON.stringify(mobile)}`);

  const critical = errors.filter((message) => !/favicon|ERR_BLOCKED_BY_CLIENT|QUIC_NETWORK_IDLE_TIMEOUT|firestore.googleapis.com|permission-denied/i.test(message));
  if (critical.length) throw new Error(`Errores de página: ${critical.join(' | ')}`);
  console.log('Chute Mundo v5.5 smoke OK', { firstState, secondState, editor, venueState, mobile });
} finally {
  await browser.close();
}
