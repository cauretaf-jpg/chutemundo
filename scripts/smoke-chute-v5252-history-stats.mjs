import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteMundoCore && window.ChuteV521History && window.ChuteHistoricalStatsV5252 && window.ChuteVersion?.bootCompleted);
  await page.waitForFunction(() => ['t4', 't5', 't6', 't7'].every((id) => window.ChuteMundoCore.getState().tournaments.find((tournament) => tournament.id === id)?.historicalPlayerStatsVersion === 'historical-player-stats-t4-t7-v1'));

  const snapshot = await page.evaluate(() => {
    const state = window.ChuteMundoCore.getState();
    const total = (rows = []) => rows.reduce((sum, row) => sum + Number(row[3] || 0), 0);
    const playerName = (entry) => Array.isArray(entry) ? entry[0] : entry?.name;
    const rosters = new Map(state.teams.map((team) => [team.id, new Set((team.players || []).map(playerName))]));
    return Object.fromEntries(['t4', 't5', 't6', 't7'].map((id) => {
      const tournament = state.tournaments.find((item) => item.id === id);
      const rows = [...tournament.playerScorers, ...tournament.playerAssists];
      return [id, {
        name: tournament.name,
        scorerRows: tournament.playerScorers.length,
        goals: total(tournament.playerScorers),
        assistRows: tournament.playerAssists.length,
        assists: total(tournament.playerAssists),
        missing: rows.filter(([name, teamId]) => !rosters.get(teamId)?.has(name)).map(([name, teamId]) => `${name}:${teamId}`),
        dottedProfessor: rows.some(([name]) => /El Profesor\s*\./.test(name)),
        coverage: tournament.coverage,
        leaderGoal: tournament.playerScorers[0],
        leaderAssist: tournament.playerAssists[0]
      }];
    }));
  });

  const expected = {
    t4: { scorerRows: 25, goals: 64, assistRows: 24, assists: 38, goalLeader: 'Giulio Locatelli', goalValue: 12, assistLeader: 'Burt McCloskey', assistValue: 4 },
    t5: { scorerRows: 17, goals: 74, assistRows: 22, assists: 36, goalLeader: 'Giulio Locatelli', goalValue: 18, assistLeader: 'Vito Volta', assistValue: 6 },
    t6: { scorerRows: 9, goals: 19, assistRows: 11, assists: 13, goalLeader: 'Giulio Locatelli', goalValue: 6, assistLeader: 'Rosendo Acosta', assistValue: 2 },
    t7: { scorerRows: 19, goals: 47, assistRows: 18, assists: 29, goalLeader: 'El Kraken', goalValue: 10, assistLeader: "Randolph D'Luna", assistValue: 5 }
  };

  for (const [id, values] of Object.entries(expected)) {
    const actual = snapshot[id];
    for (const key of ['scorerRows', 'goals', 'assistRows', 'assists']) if (actual[key] !== values[key]) throw new Error(`${id} ${key}: ${actual[key]} en vez de ${values[key]}.`);
    if (actual.missing.length) throw new Error(`${id} contiene jugadores fuera del plantel: ${actual.missing.join(', ')}.`);
    if (actual.dottedProfessor) throw new Error(`${id} conservó el punto incorrecto en El Profesor.`);
    if (actual.leaderGoal[0] !== values.goalLeader || actual.leaderGoal[3] !== values.goalValue) throw new Error(`${id} líder de goles incorrecto: ${JSON.stringify(actual.leaderGoal)}.`);
    if (actual.leaderAssist[0] !== values.assistLeader || actual.leaderAssist[3] !== values.assistValue) throw new Error(`${id} líder de asistencias incorrecto: ${JSON.stringify(actual.leaderAssist)}.`);
  }

  await page.evaluate(() => window.ChuteMundoCore.navigate('estadisticas'));
  await page.waitForSelector('#cmV521History', { state: 'visible' });
  await page.locator('[data-cm-v521-tab="rankings"]').click();
  await page.selectOption('[data-cm-v521-filter="tournament"]', 't4');
  await page.waitForFunction(() => document.querySelector('[data-cm-v521-filter="tournament"]')?.value === 't4');
  await page.locator('[data-cm-v521-ranking="goals"]').click();
  const t4Goals = await page.locator('[data-cm-v521-ranking-panel="goals"]').innerText();
  if (!t4Goals.includes('Giulio Locatelli') || !t4Goals.includes('12')) throw new Error(`La tabla visible del 4.º torneo no muestra al goleador correcto: ${t4Goals}`);
  await page.locator('[data-cm-v521-ranking="assists"]').click();
  const t4Assists = await page.locator('[data-cm-v521-ranking-panel="assists"]').innerText();
  if (!t4Assists.includes('Burt McCloskey') || !t4Assists.includes('4')) throw new Error(`La tabla visible del 4.º torneo no muestra al asistidor correcto: ${t4Assists}`);

  await page.selectOption('[data-cm-v521-filter="tournament"]', 't7');
  await page.locator('[data-cm-v521-ranking="goals"]').click();
  const t7Goals = await page.locator('[data-cm-v521-ranking-panel="goals"]').innerText();
  if (!t7Goals.includes('El Kraken') || !t7Goals.includes('10') || t7Goals.includes('Nancy King')) throw new Error(`La tabla visible del 7.º torneo conserva datos anteriores: ${t7Goals}`);

  const mobile = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
  if (mobile.width > mobile.viewport + 3) throw new Error(`Desborde móvil al mostrar estadísticas históricas: ${JSON.stringify(mobile)}`);
  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|network|service worker/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));

  console.log('Chute Mundo v5.25.2 historical player stats smoke OK', { snapshot, mobile });
} finally {
  await context.close();
  await browser.close();
}
