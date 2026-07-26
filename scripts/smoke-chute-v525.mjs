import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteMundoCore && window.ChuteFifaV525 && window.ChuteV521History && window.ChuteV523ControlCenter && window.ChuteVersion?.bootCompleted);

  const setup = await page.evaluate(() => {
    const core = window.ChuteMundoCore;
    window.__cmV525Original = structuredClone(core.getState());
    core.isAdmin = () => true;
    core.canEdit = () => true;
    core.saveCloud = async () => true;
    const teams = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, index) => ({ id, name: `Equipo ${id.toUpperCase()}`, initials: id.toUpperCase(), archived: false, players: [{ name: `Arquero ${id}`, position: 'Arquero' }], rankingSeed: index + 1 }));
    const tournament = {
      id: 'fifa-one', name: 'Copa FIFA de Prueba', type: 'cup_groups', status: 'historical', eraId: 'leagues',
      teamIds: teams.map((team) => team.id), champion: 'a', runnerUp: 'b', third: 'c',
      matches: [
        { id: 'm1', stage: 'group', round: 'Grupo', home: 'a', away: 'b', homeGoals: 2, awayGoals: 0, date: '2026-01-01' },
        { id: 'm2', stage: 'knockout', round: 'Semifinal', home: 'c', away: 'd', homeGoals: 1, awayGoals: 0, date: '2026-01-02' },
        { id: 'm3', stage: 'knockout', round: 'Final', home: 'a', away: 'c', homeGoals: 1, awayGoals: 1, homePens: 4, awayPens: 3, date: '2026-01-03' }
      ],
      playerScorers: [], playerAssists: []
    };
    const friendly = { id: 'friendly-1', name: 'Amistoso', home: 'f', away: 'a', homeGoals: 1, awayGoals: 0, date: '2026-01-04' };
    core.setState({ ...core.getState(), teams, tournaments: [tournament], friendlies: [friendly], participants: [
      { id: 'participante_alvaro', name: 'Álvaro', color: '#e74c3c', defaultSide: 'home', archived: false },
      { id: 'participante_carlos', name: 'Carlos', color: '#3498db', defaultSide: 'away', archived: false }
    ] });
    window.ChuteFifaV525.refresh();
    const rows = window.ChuteFifaV525.rows([tournament]);
    return {
      expected: window.ChuteFifaV525.expectedScore(1000, 1000),
      rows: rows.map((row) => ({ id: row.teamId, points: row.points, rating: row.rating, bonus: row.bonus, pj: row.pj })),
      order: window.ChuteDivisionsV54.fifaOrder()
    };
  });

  if (setup.expected !== 0.5) throw new Error(`La expectativa ELO inicial no es 0,5: ${setup.expected}`);
  const a = setup.rows.find((row) => row.id === 'a');
  const b = setup.rows.find((row) => row.id === 'b');
  if (!a || !b || a.bonus !== 50 || b.bonus !== 25 || a.points <= b.points) throw new Error(`Ranking FIFA incorrecto: ${JSON.stringify(setup)}`);
  if (setup.order[0] !== 'a' || setup.order.length !== 6) throw new Error(`Divisiones no usan el Ranking FIFA: ${JSON.stringify(setup.order)}`);

  await page.evaluate(() => {
    window.ChuteMundoCore.navigate('estadisticas');
    window.ChuteV521History.refresh();
    window.ChuteFifaV525.refresh();
  });
  await page.waitForSelector('[data-cm-v525-tab="fifa"]', { state: 'visible' });
  await page.locator('[data-cm-v525-tab="fifa"]').click();
  await page.waitForSelector('[data-cm-v525-panel="fifa"].active', { state: 'visible' });
  const fifaText = await page.locator('[data-cm-v525-panel="fifa"]').innerText();
  if (!fifaText.includes('RANKING FIFA CHUTE') || !fifaText.includes('Equipo A') || !fifaText.includes('1000') || !fifaText.includes('Factor K')) throw new Error(`Panel FIFA incompleto: ${fifaText}`);
  if (await page.locator('[data-cm-v523-panel="participants"]').isVisible()) throw new Error('Participantes quedó visible junto al Ranking FIFA.');

  await page.locator('[data-cm-v521-tab="eternal"]').click();
  await page.waitForFunction(() => !document.querySelector('[data-cm-v525-panel="fifa"]')?.classList.contains('active'));
  if (await page.locator('[data-cm-v525-panel="fifa"]').isVisible()) throw new Error('Ranking FIFA quedó visible en La Tabla Eterna.');

  await page.evaluate(() => window.ChuteMundoCore.navigate('administracion'));
  await page.waitForSelector('#cmV523Admin', { state: 'visible' });
  await page.locator('[data-cm-v523-admin-tab="rules"]').click();
  await page.evaluate(() => window.ChuteFifaV525.refresh());
  await page.waitForSelector('[data-cm-v525-rules]', { state: 'visible' });
  const rules = await page.locator('[data-cm-v523-admin-panel="rules"]').innerText();
  for (const text of ['Ranking FIFA Chute', 'K=24', 'Bota de Oro', 'Balón de Oro', 'Guante de Oro', 'Figura de la Final', 'Amistosos ×0,25']) if (!rules.includes(text)) throw new Error(`Falta regla: ${text}`);

  const mobile = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth, title: document.title, version: window.ChuteVersion?.version }));
  if (mobile.width > mobile.viewport + 3) throw new Error(`Desborde móvil en v5.25: ${JSON.stringify(mobile)}`);
  if (mobile.version !== '5.25.0' || !mobile.title.includes('5.25.0')) throw new Error(`Versión incorrecta: ${JSON.stringify(mobile)}`);

  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|network|service worker/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));
  await page.evaluate(() => window.ChuteMundoCore.setState(window.__cmV525Original));
  console.log('Chute Mundo v5.25 FIFA ranking smoke OK', { setup, mobile });
} finally {
  await context.close();
  await browser.close();
}
