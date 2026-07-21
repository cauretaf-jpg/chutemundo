import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteV5162PlayoffSeeding && window.ChuteMundoCore && window.ChuteTournamentHub && window.ChuteV514UnifiedMatch);

  const setup = await page.evaluate(() => {
    const core = window.ChuteMundoCore;
    const api = window.ChuteV5162PlayoffSeeding;
    const original = structuredClone(core.getState());
    window.__cmV5163Original = original;
    const realTeams = original.teams.slice(0, 6);
    if (realTeams.length < 6) return { error: 'No existen seis equipos reales.' };
    const teamIds = realTeams.map((team) => team.id);
    const standings = teamIds.map((teamId, index) => ({ teamId, pos: index + 1, pj: 5, pg: Math.max(0, 5 - index), pe: 0, pp: index, gf: Math.max(0, 6 - index), gc: index, dg: 6 - (index * 2), pts: Math.max(0, 15 - (index * 2)) }));
    const current = {
      id: 'playoff-ui-regression', name: 'Prueba visual Play-Off', type: 'league_playoff', status: 'active', teamIds,
      manualStandings: standings,
      matches: [
        { id: 's1', stage: 'knockout', round: 'Semifinales', label: 'Semifinal 1', home: teamIds[2], away: teamIds[3], homeRef: 'TABLE_3', awayRef: 'TABLE_4', homeGoals: null, awayGoals: null, goals: [], cards: [], specialEvents: [], lineups: { home: { starters: [] }, away: { starters: [] } } },
        { id: 's2', stage: 'knockout', round: 'Semifinales', label: 'Semifinal 2', home: teamIds[4], away: teamIds[5], homeRef: 'TABLE_5', awayRef: 'TABLE_6', homeGoals: null, awayGoals: null, goals: [], cards: [], specialEvents: [] },
        { id: 'third', stage: 'knockout', round: '3er Lugar', label: '3er Puesto', home: teamIds[4], away: teamIds[5], homeRef: 'TABLE_5', awayRef: 'TABLE_6', homeGoals: null, awayGoals: null, goals: [], cards: [], specialEvents: [] },
        { id: 'final', stage: 'knockout', round: 'Final', label: 'Final', home: teamIds[2], away: teamIds[3], homeRef: 'TABLE_3', awayRef: 'TABLE_4', homeGoals: null, awayGoals: null, goals: [], cards: [], specialEvents: [] }
      ]
    };
    const historical = {
      id: 'playoff-history-protected', name: 'Histórico protegido', type: 'league_playoff', status: 'historical', teamIds,
      manualStandings: standings,
      matches: [{ id: 'old-s1', stage: 'knockout', round: 'Semifinales', label: 'Semifinal 1', home: teamIds[2], away: teamIds[3], homeRef: 'TABLE_3', awayRef: 'TABLE_4', homeGoals: 1, awayGoals: 0, goals: [] }]
    };
    const next = structuredClone(original);
    next.tournaments = [...next.tournaments.filter((item) => !['playoff-ui-regression', 'playoff-history-protected'].includes(item.id)), current, historical];
    core.setState(next);
    core.navigate('torneos');
    return { version: api.version, teamIds };
  });
  if (setup.error) throw new Error(setup.error);

  await page.waitForFunction(() => [...document.querySelectorAll('[data-open-tournament="playoff-ui-regression"]')].some((element) => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden' && getComputedStyle(element).display !== 'none'));
  await page.locator('[data-open-tournament="playoff-ui-regression"]:visible').first().click();
  await page.waitForSelector('#cmTournamentHub[data-tournament-id="playoff-ui-regression"]');

  const repaired = await page.evaluate(() => {
    const core = window.ChuteMundoCore;
    const tournament = core.getState().tournaments.find((item) => item.id === 'playoff-ui-regression');
    const semi1 = tournament.matches.find((match) => match.id === 's1');
    const semi2 = tournament.matches.find((match) => match.id === 's2');
    const third = tournament.matches.find((match) => match.id === 'third');
    const final = tournament.matches.find((match) => match.id === 'final');
    const old = core.getState().tournaments.find((item) => item.id === 'playoff-history-protected').matches[0];
    return {
      semi1: { homeRef: semi1.homeRef, awayRef: semi1.awayRef, home: semi1.home, away: semi1.away, resolvedHome: core.resolveHome(tournament, semi1), resolvedAway: core.resolveAway(tournament, semi1) },
      semi2: { homeRef: semi2.homeRef, awayRef: semi2.awayRef, home: semi2.home, away: semi2.away, resolvedHome: core.resolveHome(tournament, semi2), resolvedAway: core.resolveAway(tournament, semi2) },
      third: { homeRef: third.homeRef, awayRef: third.awayRef },
      final: { homeRef: final.homeRef, awayRef: final.awayRef },
      historical: { home: old.home, away: old.away, homeRef: old.homeRef, awayRef: old.awayRef }
    };
  });
  if (setup.version !== '5.16.3') throw new Error(`Versión inválida: ${setup.version}`);
  if (repaired.semi1.homeRef !== 'TABLE_1' || repaired.semi1.awayRef !== 'TABLE_4' || repaired.semi1.home !== null || repaired.semi1.away !== null || repaired.semi1.resolvedHome !== setup.teamIds[0] || repaired.semi1.resolvedAway !== setup.teamIds[3]) throw new Error(`Semifinal 1 incorrecta: ${JSON.stringify(repaired.semi1)}`);
  if (repaired.semi2.homeRef !== 'TABLE_2' || repaired.semi2.awayRef !== 'TABLE_3' || repaired.semi2.home !== null || repaired.semi2.away !== null || repaired.semi2.resolvedHome !== setup.teamIds[1] || repaired.semi2.resolvedAway !== setup.teamIds[2]) throw new Error(`Semifinal 2 incorrecta: ${JSON.stringify(repaired.semi2)}`);
  if (repaired.third.homeRef !== 'S1_L' || repaired.third.awayRef !== 'S2_L' || repaired.final.homeRef !== 'S1_W' || repaired.final.awayRef !== 'S2_W') throw new Error(`Final o tercer lugar incorrectos: ${JSON.stringify(repaired)}`);
  if (repaired.historical.home !== setup.teamIds[2] || repaired.historical.away !== setup.teamIds[3] || repaired.historical.homeRef !== 'TABLE_3') throw new Error(`Se modificó una semifinal histórica: ${JSON.stringify(repaired.historical)}`);

  await page.locator('[data-cm-tournament-tab="table"]').click();
  await page.waitForSelector('[data-cm-tournament-panel="table"].active .cm-hub-table');
  const tableUi = await page.evaluate(() => ({
    hub: Boolean(document.getElementById('cmTournamentHub')),
    tabs: document.querySelectorAll('.cm-hub-tabs [data-cm-tournament-tab]').length,
    shields: document.querySelectorAll('[data-cm-tournament-panel="table"] .cm-hub-team-cell img').length,
    baseTableVisible: [...document.querySelectorAll('#tournamentDetail > *')].some((item) => !['cmPremiumTournamentHero', 'cmTournamentHub'].includes(item.id) && getComputedStyle(item).display !== 'none'),
    width: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth
  }));
  if (!tableUi.hub || tableUi.tabs < 5 || tableUi.shields < 6 || tableUi.baseTableVisible || tableUi.width > tableUi.viewport + 3) throw new Error(`Centro visual incompleto: ${JSON.stringify(tableUi)}`);

  await page.locator('[data-cm-tournament-tab="fixture"]').click();
  await page.waitForSelector('[data-cm-tournament-panel="fixture"].active .cm-hub-filterbar');
  await page.waitForFunction(() => [...document.querySelectorAll('[data-cm-tournament-panel="fixture"] [data-cm-hub-match]')].some((button) => button.textContent.trim() === 'Ver partido'));
  const fixtureUi = await page.evaluate(() => ({
    filters: document.querySelectorAll('.cm-hub-filterbar [data-cm-fixture-filter]').length,
    matchCards: document.querySelectorAll('.cm-hub-match').length,
    shields: document.querySelectorAll('.cm-hub-match-team img').length,
    verPartido: [...document.querySelectorAll('[data-cm-hub-match]')].filter((button) => button.textContent.trim() === 'Ver partido').length
  }));
  if (fixtureUi.filters !== 3 || fixtureUi.matchCards < 4 || fixtureUi.shields < 4 || fixtureUi.verPartido < 1) throw new Error(`Fixture incompleto: ${JSON.stringify(fixtureUi)}`);

  await page.evaluate(() => { window.ChuteMundoCore.canEdit = () => true; });
  await page.locator('[data-cm-tournament-panel="fixture"] [data-cm-hub-match]:visible').first().click();
  await page.waitForSelector('.cm-v516-match-center');
  await page.waitForSelector('[data-cm-v516-goal-minute="home"]');
  const editor = await page.evaluate(() => ({
    center: Boolean(document.querySelector('.cm-v516-match-center')),
    goalMinute: Boolean(document.querySelector('[data-cm-v516-goal-minute="home"]')),
    cardMinute: Boolean(document.querySelector('[data-cm-v516-card-minute="home"]')),
    subMinute: Boolean(document.querySelector('[data-cm-v516-sub-minute="home"]'))
  }));
  if (!editor.center || !editor.goalMinute || !editor.cardMinute || !editor.subMinute) throw new Error(`Registro de partido no disponible: ${JSON.stringify(editor)}`);

  await page.evaluate(() => { window.ChuteMundoCore.setState(window.__cmV5163Original); });
  if (!document.title.includes('5.16.3')) throw new Error(`Título sin actualizar: ${document.title}`);
  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|network/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));
  console.log('Chute Mundo v5.16.3 playoff UI smoke OK', { repaired, tableUi, fixtureUi, editor });
} finally {
  await browser.close();
}