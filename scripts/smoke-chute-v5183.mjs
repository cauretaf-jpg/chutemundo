import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteV5183StatsPreflight && window.ChuteV5182StatsLoader && window.ChuteV518EraStats && window.ChuteMundoCore);

  const setup = await page.evaluate(() => {
    const core = window.ChuteMundoCore;
    const original = structuredClone(core.getState());
    window.__cmV5183Original = original;
    const teams = structuredClone(original.teams.slice(0, 2));
    if (teams.length < 2 || teams.some((team) => !Array.isArray(team.players) || team.players.length < 3)) return { error: 'Faltan equipos con plantel.' };
    const playerName = (entry) => Array.isArray(entry) ? entry[0] : entry.name;
    const scorer = playerName(teams[0].players[1]);
    const assister = playerName(teams[0].players[2]);
    teams[0].players = Object.fromEntries(teams[0].players.map((entry, index) => [`p${index}`, entry]));
    const state = {
      ...original,
      teams,
      tournaments: [{
        id: 'late-firebase-v5183', name: 'Base histórica tardía', type: 'league', status: 'historical', champion: teams[0].id,
        teamIds: teams.map((team) => team.id),
        matches: [{ id: 'late-match', stage: 'regular', home: teams[0].id, away: teams[1].id, homeGoals: 2, awayGoals: 1, goals: [], cards: [] }],
        playerScorers: {
          first: { playerName: scorer, team: teams[0].name, appearances: 1, goals: 2 }
        },
        playerAssists: [{ name: assister, teamId: teams[0].id, pj: 1, assists: 1 }]
      }]
    };
    core.setState(state);
    document.body.appendChild(document.createComment('firebase-late-state'));
    return { scorer, assister, teamId: teams[0].id };
  });
  if (setup.error) throw new Error(setup.error);

  await page.waitForFunction(({ scorer, assister, teamId }) => {
    const tournament = window.ChuteMundoCore.getState().tournaments.find((item) => item.id === 'late-firebase-v5183');
    return Array.isArray(tournament?.playerScorers?.[0])
      && tournament.playerScorers[0][0] === scorer
      && tournament.playerScorers[0][1] === teamId
      && tournament.playerScorers[0][3] === 2
      && Array.isArray(tournament?.playerAssists?.[0])
      && tournament.playerAssists[0][0] === assister
      && Array.isArray(window.ChuteMundoCore.getState().teams[0].players);
  }, setup);

  await page.evaluate(() => window.ChuteMundoCore.navigate('estadisticas'));
  await page.waitForFunction(() => window.ChuteV5182StatsLoader.currentStatsVisible());
  await page.waitForSelector('[data-cm-v518-panel="summary"].active');
  const summary = await page.evaluate(({ scorer, assister }) => ({
    title: document.title,
    tabs: document.querySelectorAll('#cmV518Stats [data-cm-v518-tab]').length,
    filters: document.querySelectorAll('#cmV518Stats [data-cm-v518-filter]').length,
    text: document.querySelector('#cmV518Stats')?.textContent || '',
    scorerVisible: document.querySelector('#cmV518Stats')?.textContent.includes(scorer),
    assisterVisible: document.querySelector('#cmV518Stats')?.textContent.includes(assister),
    report: window.ChuteV5183StatsPreflight.report,
    recovered: Boolean(window.ChuteV5183StatsRecovery)
  }), setup);
  if (!summary.title.includes('5.18.3') || summary.tabs !== 7 || summary.filters !== 3 || !summary.scorerVisible || !summary.assisterVisible || summary.recovered) throw new Error(`Normalización tardía incompleta: ${JSON.stringify(summary)}`);

  await page.locator('[data-cm-v518-tab="players"]').click();
  await page.waitForSelector('[data-cm-v518-panel="players"].active');
  const playersText = await page.locator('[data-cm-v518-panel="players"]').textContent();
  if (!playersText.includes(setup.scorer) || !playersText.includes('2')) throw new Error(`Jugadores históricos no visibles: ${playersText}`);

  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|network|message channel|service worker/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));
  await page.evaluate(() => window.ChuteMundoCore.setState(window.__cmV5183Original));
  console.log('Chute Mundo v5.18.3 historical compatibility smoke OK', summary);
} finally {
  await context.close();
  await browser.close();
}
