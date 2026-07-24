import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteMundoCore && window.ChuteV523ControlCenter && window.ChuteDivisionsV54 && window.ChuteVersion?.bootCompleted);

  const setup = await page.evaluate(() => {
    const core = window.ChuteMundoCore;
    window.__cmV523Original = structuredClone(core.getState());
    core.canEdit = () => true;
    core.isAdmin = () => true;
    core.saveCloud = async () => true;
    const original = core.getState();
    const teams = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, index) => ({ id, name: `Equipo ${id.toUpperCase()}`, players: [{ name: `Arquero ${id}`, position: 'Arquero' }, { name: `Jugador ${id}`, position: 'Delantero' }], rankingSeed: index + 1 }));
    const participants = [
      { id: 'participante_alvaro', name: 'Álvaro', color: '#e74c3c', defaultSide: 'home', archived: false },
      { id: 'participante_carlos', name: 'Carlos', color: '#3498db', defaultSide: 'away', archived: false },
      { id: 'participante_sofia', name: 'Sofía', color: '#16a085', archived: false }
    ];
    const tournament = {
      id: 'hist', name: 'Torneo Participantes', type: 'league_playoff', status: 'historical', eraId: 'leagues', teamIds: teams.map((team) => team.id),
      champion: 'a', runnerUp: 'b', third: 'c', participantChampion: 'participante_sofia', participantRunnerUp: 'participante_carlos', participantThird: 'participante_alvaro',
      matches: [
        { id: 'm1', stage: 'regular', round: 'Fecha 1', home: 'a', away: 'b', homeGoals: 2, awayGoals: 0, date: '2026-01-01', venue: "Carloco's House" },
        { id: 'm2', stage: 'regular', round: 'Fecha 2', home: 'c', away: 'd', homeGoals: 1, awayGoals: 3, participantHome: 'participante_sofia', participantAway: 'participante_carlos', date: '2026-01-02', venue: "Wladi's House" },
        { id: 'm3', stage: 'knockout', round: 'Final', label: 'Final', home: 'a', away: 'b', homeGoals: 1, awayGoals: 0, participantHome: 'participante_sofia', participantAway: 'participante_carlos', date: '2026-01-03', venue: "Carloco's House" },
        { id: 'm4', stage: 'knockout', round: '3er Lugar', label: '3er Puesto', home: 'c', away: 'd', homeGoals: 1, awayGoals: 0, participantHome: 'participante_alvaro', participantAway: 'participante_carlos', date: '2026-01-03', venue: "Carloco's House" }
      ], playerScorers: [], playerAssists: []
    };
    core.setState({ ...original, config: {}, teams, participants, tournaments: [tournament], friendlies: [], activity: [] });
    window.ChuteV523ControlCenter.ensureDefaults();
    const season = window.ChuteDivisionsV54.buildSeason({ name: '1.ª Temporada', firstIds: ['a', 'b', 'c'], secondIds: ['d', 'e', 'f'], legs: 1, firstPlayoff: true, secondPlayoff: true, finalLegs: 1, promotionMode: 'playoff' });
    const tieTournament = {
      id: 'tie', type: 'division_season', groups: [{ name: '1.ª División', teamIds: ['a', 'b', 'c', 'd'] }],
      matches: [
        { id: 'ab', stage: 'group', group: '1.ª División', home: 'a', away: 'b', homeGoals: 1, awayGoals: 0 },
        { id: 'ac', stage: 'group', group: '1.ª División', home: 'a', away: 'c', homeGoals: 0, awayGoals: 0 },
        { id: 'ad', stage: 'group', group: '1.ª División', home: 'a', away: 'd', homeGoals: 0, awayGoals: 1 },
        { id: 'bc', stage: 'group', group: '1.ª División', home: 'b', away: 'c', homeGoals: 1, awayGoals: 0 },
        { id: 'bd', stage: 'group', group: '1.ª División', home: 'b', away: 'd', homeGoals: 0, awayGoals: 0 }
      ]
    };
    const table = window.ChuteDivisionsV54.standings(tieTournament, '1.ª División');
    return {
      seasonYellowLimit: season.config.discipline.yellowLimit,
      seasonTieBreak: season.config.tieBreakOrder,
      matchDefaults: season.matches.slice(0, 2).map((match) => [match.participantHome, match.participantAway]),
      aIndex: table.findIndex((row) => row.teamId === 'a'),
      bIndex: table.findIndex((row) => row.teamId === 'b')
    };
  });

  if (setup.seasonYellowLimit !== 2 || setup.seasonTieBreak.at(-1) !== 'headToHead') throw new Error(`Reglas divisionales incorrectas: ${JSON.stringify(setup)}`);
  if (setup.matchDefaults.some(([home, away]) => home !== 'participante_alvaro' || away !== 'participante_carlos')) throw new Error(`Participantes predeterminados incorrectos: ${JSON.stringify(setup.matchDefaults)}`);
  if (!(setup.aIndex >= 0 && setup.bIndex >= 0 && setup.aIndex < setup.bIndex)) throw new Error(`El enfrentamiento directo no ordenó A sobre B: ${JSON.stringify(setup)}`);

  await page.evaluate(() => window.ChuteMundoCore.navigate('administracion'));
  await page.waitForSelector('#cmV523Admin', { state: 'visible' });
  const admin = await page.evaluate(() => ({
    tabs: [...document.querySelectorAll('[data-cm-v523-admin-tab]')].map((button) => button.textContent.trim()),
    status: document.querySelector('[data-cm-v523-admin-panel="status"]')?.innerText || '',
    title: document.title
  }));
  for (const label of ['Estado', 'Participantes', 'Reglamento', 'Datos y respaldos', 'Mantenimiento']) if (!admin.tabs.includes(label)) throw new Error(`Falta pestaña administrativa ${label}: ${JSON.stringify(admin.tabs)}`);
  if (!admin.status.includes('Listo para comenzar las divisiones') || !admin.title.includes('5.23.0')) throw new Error(`Estado divisional o versión incorrectos: ${JSON.stringify(admin)}`);

  await page.locator('[data-cm-v523-admin-tab="rules"]').click();
  const rulesText = await page.locator('[data-cm-v523-admin-panel="rules"]').innerText();
  if (!rulesText.includes('Resultado entre ambos equipos') || !rulesText.includes('Dos amarillas acumuladas') || !rulesText.includes('Ascenso y descenso')) throw new Error(`Reglamento incompleto: ${rulesText}`);

  await page.locator('[data-cm-v523-admin-tab="participants"]').click();
  await page.fill('#cmV523ParticipantName', 'Martín');
  await page.fill('#cmV523ParticipantAvatar', 'https://example.com/martin.png');
  await page.locator('#cmV523ParticipantForm button[type="submit"]').click();
  await page.waitForFunction(() => window.ChuteMundoCore.getState().participants.some((participant) => participant.name === 'Martín'));

  await page.evaluate(() => window.ChuteMundoCore.navigate('estadisticas'));
  await page.waitForSelector('#cmV521History', { state: 'visible' });
  await page.waitForSelector('[data-cm-v523-tab="participants"]');
  await page.locator('[data-cm-v523-tab="participants"]').click();
  await page.waitForSelector('[data-cm-v523-panel="participants"].active');
  const stats = await page.locator('[data-cm-v523-panel="participants"]').innerText();
  if (!stats.includes('La Liga de los Participantes') || !stats.includes('Álvaro') || !stats.includes('Carlos') || !stats.includes('Sofía') || !stats.includes('Ranking de participantes')) throw new Error(`Estadísticas de participantes incompletas: ${stats}`);

  await page.evaluate(() => window.ChuteV514UnifiedMatch.openUnifiedMatch('hist', 'm1'));
  await page.waitForSelector('.cm-v523-match-participants');
  const selectors = await page.evaluate(() => ({
    home: document.querySelector('[data-cm-v523-match-person="home"]')?.value,
    away: document.querySelector('[data-cm-v523-match-person="away"]')?.value,
    options: [...document.querySelectorAll('[data-cm-v523-match-person="home"] option')].map((option) => option.textContent)
  }));
  if (selectors.home !== 'participante_alvaro' || selectors.away !== 'participante_carlos' || !selectors.options.includes('Sofía')) throw new Error(`Selectores de partido incorrectos: ${JSON.stringify(selectors)}`);
  await page.selectOption('[data-cm-v523-match-person="home"]', 'participante_sofia');
  await page.waitForFunction(() => window.ChuteMundoCore.getState().tournaments.find((tournament) => tournament.id === 'hist').matches.find((match) => match.id === 'm1').participantHome === 'participante_sofia');

  const rows = await page.evaluate(() => window.ChuteV523ControlCenter.participantStats(window.ChuteMundoCore.getState().tournaments).map((row) => ({ id: row.id, pj: row.pj, points: row.points, titles: row.titles })));
  if (!rows.find((row) => row.id === 'participante_sofia')?.pj || rows.find((row) => row.id === 'participante_sofia')?.titles !== 1) throw new Error(`Acumulados de Sofía incorrectos: ${JSON.stringify(rows)}`);

  const mobile = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
  if (mobile.width > mobile.viewport + 3) throw new Error(`Desborde móvil en v5.23: ${JSON.stringify(mobile)}`);
  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|network|service worker|example.com/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));
  await page.evaluate(() => window.ChuteMundoCore.setState(window.__cmV523Original));
  console.log('Chute Mundo v5.23 participants and divisions smoke OK', { setup, admin, selectors, rows, mobile });
} finally {
  await context.close();
  await browser.close();
}
