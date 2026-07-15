import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 950 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.ChuteMundoCore && window.ChuteStatsV52 && window.ChuteControllersV57), null, { timeout: 60000 });
  await page.waitForFunction(() => window.ChuteMundoCore.cloudLoaded === true, null, { timeout: 60000 });

  const ids = await page.evaluate(() => {
    const core = window.ChuteMundoCore;
    const current = core.getState();
    const teams = current.teams.filter((team) => !team.archived).slice(0, 4).map((team) => team.id);
    if (teams.length < 4) throw new Error('Faltan equipos de prueba.');
    const makeMatch = (id, home, away, hg, ag, stage = 'group', round = 'Fecha 1') => ({
      id, stage, round, label: id, home, away, homeRef: null, awayRef: null,
      homeGoals: hg, awayGoals: ag, homePens: null, awayPens: null,
      date: '', time: '', venue: '', notes: '', goals: [], cards: []
    });
    const league = {
      id: 'test_ligas', name: 'Liga de prueba', type: 'league', era: 'classic', status: 'historical', config: { legs: 1 }, teamIds: teams, groups: [],
      matches: [makeMatch('l1', teams[0], teams[1], 3, 1), makeMatch('l2', teams[2], teams[3], 1, 2, 'knockout', 'Final')],
      participantChampion: 'participante_carlos', champion: teams[3], playerScorers: [], playerAssists: [], notes: []
    };
    const division = {
      id: 'test_divisiones', name: 'Temporada de divisiones', type: 'division_season', era: 'division', status: 'historical', config: { seasonNumber: 1 }, teamIds: teams,
      groups: [{ id: 'first', name: '1.ª División', teamIds: teams }],
      matches: [makeMatch('d1', teams[0], teams[1], 0, 2), makeMatch('d2', teams[2], teams[3], 1, 1)],
      participantChampion: 'participante_alvaro', champion: teams[2], playerScorers: [], playerAssists: [], notes: []
    };
    current.tournaments = [league, division];
    core.setState(current);
    core.navigate('estadisticas');
    return { league: league.id, division: division.id };
  });

  await page.waitForSelector('#cmStatsCenter');
  await page.click('[data-cm-stats-tab="controllers"]');
  await page.waitForSelector('#cmV57Controllers');

  const totals = await page.evaluate(() => window.ChuteControllersV57.controllerRows(window.ChuteControllersV57.selectedTournaments()).map((row) => ({ key: row.key, pj: row.pj, pts: row.pts })));
  const home = totals.find((row) => row.key === 'home');
  const away = totals.find((row) => row.key === 'away');
  if (home?.pj !== 4 || home?.pts !== 4 || away?.pj !== 4 || away?.pts !== 7) throw new Error(`Totales incorrectos: ${JSON.stringify(totals)}`);

  await page.selectOption('[data-cm-v57-filter="era"]', 'division');
  const division = await page.evaluate(() => ({
    ids: window.ChuteControllersV57.selectedTournaments().map((item) => item.id),
    rows: window.ChuteControllersV57.controllerRows(window.ChuteControllersV57.selectedTournaments()).map((row) => ({ key: row.key, pj: row.pj, pts: row.pts })),
    options: [...document.querySelector('[data-cm-v57-filter="tournament"]').options].map((option) => option.value)
  }));
  if (division.ids[0] !== ids.division || division.options.includes(ids.league)) throw new Error(`Filtro de divisiones incorrecto: ${JSON.stringify(division)}`);
  if (division.rows.find((row) => row.key === 'home')?.pts !== 1 || division.rows.find((row) => row.key === 'away')?.pts !== 4) throw new Error(`Cálculo de divisiones incorrecto: ${JSON.stringify(division)}`);

  await page.selectOption('[data-cm-v57-filter="tournament"]', ids.division);
  if ((await page.inputValue('[data-cm-v57-filter="tournament"]')) !== ids.division) throw new Error('El filtro por torneo no conserva la selección.');

  await page.selectOption('[data-cm-v57-filter="era"]', 'league');
  const league = await page.evaluate(() => window.ChuteControllersV57.controllerRows(window.ChuteControllersV57.selectedTournaments()).map((row) => ({ key: row.key, pj: row.pj, pts: row.pts })));
  if (league.find((row) => row.key === 'home')?.pts !== 3 || league.find((row) => row.key === 'away')?.pts !== 3) throw new Error(`Cálculo de ligas incorrecto: ${JSON.stringify(league)}`);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, width: document.documentElement.scrollWidth }));
  if (mobile.width > mobile.viewport + 3) throw new Error(`Desborde móvil: ${JSON.stringify(mobile)}`);

  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));
  console.log('Chute Mundo v5.7 controller filters smoke OK');
} finally {
  await browser.close();
}
