import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteV517Finalization && window.ChuteMundoCore && window.ChuteTournamentHub);
  const setup = await page.evaluate(() => {
    const core = window.ChuteMundoCore;
    const original = structuredClone(core.getState());
    window.__cmV517Original = original;
    core.canEdit = () => true;
    core.isAdmin = () => true;
    core.saveCloud = async () => true;
    const next = structuredClone(original);
    const teams = next.teams.slice(0, 4);
    if (teams.length < 4) return { error: 'No hay cuatro equipos.' };
    const names = teams.map((team) => team.players.map((entry) => Array.isArray(entry) ? entry[0] : entry.name));
    const debut = { name: 'Debut V517', position: 'Delantero', minute: 0 };
    teams[0].players.push(debut);
    names[0].push(debut.name);
    const lineup = (teamIndex) => ({ goalkeeper: names[teamIndex][0], starters: names[teamIndex].slice(0, 4), changes: [] });
    const goal = (id, side, teamId, playerName, assistName, minute) => ({ id, side, teamId, playerName, assistName, minute: String(minute), createdAt: minute * 1000 });
    const match = (id, round, label, homeIndex, awayIndex, homeGoals, awayGoals, goals, extras = {}) => ({
      id, stage: 'knockout', round, label, home: teams[homeIndex].id, away: teams[awayIndex].id,
      homeGoals, awayGoals, goals, cards: [], specialEvents: [], participationTracked: true,
      date: '2026-07-21', venue: "Wladi's House", lineups: { home: lineup(homeIndex), away: lineup(awayIndex) }, ...extras
    });
    const semi1Goals = [goal('g1', 'home', teams[0].id, names[0][1], names[0][2], 20), goal('g2', 'away', teams[3].id, names[3][1], '', 70)];
    const shootout = [
      ...[names[0][1], names[0][2], names[0][3], debut.name].map((playerName, index) => ({ id: `ph${index}`, kind: 'shootout_penalty', side: 'home', teamId: teams[0].id, playerName, result: 'scored', order: index * 2 + 1, createdAt: 10000 + index })),
      ...[names[3][1], names[3][2], names[3][3]].map((playerName, index) => ({ id: `pa${index}`, kind: 'shootout_penalty', side: 'away', teamId: teams[3].id, playerName, result: 'scored', order: index * 2 + 2, createdAt: 11000 + index }))
    ];
    const tournament = {
      id: 'v517-finalization-test', name: 'Torneo finalización v5.17', type: 'league_playoff', status: 'active', teamIds: teams.map((team) => team.id),
      matches: [
        match('s1', 'Semifinales', 'Semifinal 1', 0, 3, 1, 1, semi1Goals, { shootoutStarted: true, homePens: 4, awayPens: 3, penaltyShootout: shootout }),
        match('s2', 'Semifinales', 'Semifinal 2', 1, 2, 2, 0, [goal('g3', 'home', teams[1].id, names[1][1], names[1][2], 30), goal('g4', 'home', teams[1].id, names[1][1], '', 60)]),
        match('third', '3er Lugar', '3er Puesto', 2, 3, 1, 0, [goal('g5', 'home', teams[2].id, names[2][1], names[2][2], 50)]),
        match('final', 'Final', 'Final', 0, 1, 2, 1, [goal('g6', 'home', teams[0].id, debut.name, names[0][2], 20), goal('g7', 'away', teams[1].id, names[1][1], names[1][2], 45), goal('g8', 'home', teams[0].id, debut.name, names[0][2], 80)])
      ]
    };
    next.tournaments.push(tournament);
    core.setState(next);
    core.navigate('torneos');
    return { tournamentId: tournament.id };
  });
  if (setup.error) throw new Error(setup.error);

  await page.waitForFunction((id) => [...document.querySelectorAll(`[data-open-tournament="${id}"]`)].some((item) => item.getClientRects().length), setup.tournamentId);
  await page.locator(`[data-open-tournament="${setup.tournamentId}"]:visible`).first().click();
  await page.waitForSelector(`#cmTournamentHub[data-tournament-id="${setup.tournamentId}"]`);
  await page.waitForSelector('[data-cm-v517-awards-tab]');
  await page.waitForSelector('[data-cm-v517-awards-panel]', { state: 'attached' });

  const initialAwards = await page.evaluate(() => {
    const panel = document.querySelector('[data-cm-v517-awards-panel]');
    return { hidden: panel.hidden, display: getComputedStyle(panel).display, rects: panel.getClientRects().length };
  });
  if (!initialAwards.hidden || initialAwards.display !== 'none' || initialAwards.rects !== 0) throw new Error(`Premios visibles sin abrir: ${JSON.stringify(initialAwards)}`);

  await page.locator('[data-cm-tournament-tab="fixture"]:visible').click();
  await page.waitForSelector('[data-cm-tournament-panel="fixture"].active');
  await page.waitForFunction(() => document.querySelectorAll('.cm-v517-penalty-result').length > 0);
  const penaltyText = await page.locator('.cm-v517-penalty-result').first().textContent();
  if (!/Definido por penales/i.test(penaltyText) || !/4.*3/.test(penaltyText)) throw new Error(`Resultado por penales incompleto: ${penaltyText}`);

  await page.locator('[data-cm-v517-awards-tab]:visible').click();
  await page.waitForSelector('[data-cm-v517-awards-panel].active .cm-v517-awards-grid');
  const awards = await page.evaluate(() => ({
    cards: document.querySelectorAll('.cm-v517-award-card').length,
    visible: document.querySelector('[data-cm-v517-awards-panel]').getClientRects().length > 0,
    computed: window.ChuteV517Finalization.computeAwards(window.ChuteMundoCore.getState().tournaments.find((item) => item.id === 'v517-finalization-test'))
  }));
  if (awards.cards !== 6 || !awards.visible) throw new Error(`Panel de premios incompleto: ${JSON.stringify({ cards: awards.cards, visible: awards.visible })}`);
  const automatic = ['scorer', 'assist', 'mvp', 'goalkeeper', 'revelation', 'finalMvp'];
  if (automatic.some((key) => !awards.computed.awards[key]?.playerName) || automatic.some((key) => !awards.computed.awards[key]?.reason)) throw new Error(`Premios sin estadísticas completas: ${JSON.stringify(awards.computed.awards)}`);

  await page.locator('[data-cm-v517-quality]:visible').first().click();
  await page.waitForSelector('.cm-v517-quality-modal');
  const quality = await page.evaluate(() => ({
    confirm: Boolean(document.querySelector('[data-cm-v517-confirm-finish]')),
    blocks: document.querySelectorAll('.cm-v517-quality-list .is-critical').length,
    text: document.querySelector('.cm-v517-quality-modal')?.textContent || ''
  }));
  if (!quality.confirm || quality.blocks !== 0 || !/Revisión antes de finalizar/.test(quality.text)) throw new Error(`Control de calidad incompleto: ${JSON.stringify(quality)}`);
  await page.getByRole('button', { name: 'Volver' }).click();

  await page.locator('[data-cm-tournament-tab="table"]:visible').click();
  await page.waitForSelector('[data-cm-tournament-panel="table"].active');
  const hiddenAgain = await page.evaluate(() => {
    const panel = document.querySelector('[data-cm-v517-awards-panel]');
    return panel.hidden && getComputedStyle(panel).display === 'none' && panel.getClientRects().length === 0;
  });
  if (!hiddenAgain) throw new Error('Premios no se ocultaron al cambiar de pestaña.');

  const status = await page.evaluate((id) => window.ChuteMundoCore.getState().tournaments.find((item) => item.id === id)?.status, setup.tournamentId);
  if (status === 'active') {
    await page.locator('[data-cm-v517-finish]:not([disabled])').click();
    await page.waitForSelector('[data-cm-v517-confirm-finish]');
    await page.locator('[data-cm-v517-confirm-finish]').click();
  }
  await page.waitForFunction((id) => {
    const tournament = window.ChuteMundoCore.getState().tournaments.find((item) => item.id === id);
    return tournament?.status === 'historical' && tournament.awardsEngineVersion === '5.17.0' && tournament.awardDetails?.mvp?.playerName;
  }, setup.tournamentId);

  const title = await page.title();
  if (!title.includes('5.17')) throw new Error(`Título incorrecto: ${title}`);
  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|network/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));
  await page.evaluate(() => window.ChuteMundoCore.setState(window.__cmV517Original));
  console.log('Chute Mundo v5.17 smoke OK', { penaltyText, cards: awards.cards, mvp: awards.computed.awards.mvp.playerName, goalkeeper: awards.computed.awards.goalkeeper.playerName, quality, status });
} finally {
  await browser.close();
}
