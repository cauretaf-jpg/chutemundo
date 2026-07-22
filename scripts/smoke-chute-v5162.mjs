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
    const original = structuredClone(core.getState());
    window.__cmV5163Original = original;
    const teamIds = original.teams.slice(0, 6).map((team) => team.id);
    if (teamIds.length < 6) return { error: 'No existen seis equipos reales.' };
    const standings = teamIds.map((teamId, index) => ({ teamId, pos: index + 1, pj: 5, pg: 5 - index, pe: 0, pp: index, gf: 6 - index, gc: index, dg: 6 - index * 2, pts: 15 - index * 2 }));
    const match = (id, round, label, home, away, homeRef, awayRef) => ({ id, stage: 'knockout', round, label, home, away, homeRef, awayRef, homeGoals: null, awayGoals: null, goals: [], cards: [], specialEvents: [] });
    const current = {
      id: 'playoff-ui-regression', name: 'Prueba visual Play-Off', type: 'league_playoff', status: 'active', teamIds, manualStandings: standings,
      matches: [
        match('s1', 'Semifinales', 'Semifinal 1', teamIds[2], teamIds[3], 'TABLE_3', 'TABLE_4'),
        match('s2', 'Semifinales', 'Semifinal 2', teamIds[4], teamIds[5], 'TABLE_5', 'TABLE_6'),
        match('third', '3er Lugar', '3er Puesto', teamIds[4], teamIds[5], 'TABLE_5', 'TABLE_6'),
        match('final', 'Final', 'Final', teamIds[2], teamIds[3], 'TABLE_3', 'TABLE_4')
      ]
    };
    const historical = {
      id: 'playoff-history-protected', name: 'Histórico protegido', type: 'league_playoff', status: 'historical', teamIds, manualStandings: standings,
      matches: [{ ...match('old-s1', 'Semifinales', 'Semifinal 1', teamIds[2], teamIds[3], 'TABLE_3', 'TABLE_4'), homeGoals: 1, awayGoals: 0 }]
    };
    core.setState({ ...original, tournaments: [...original.tournaments, current, historical] });
    return { version: window.ChuteV5162PlayoffSeeding.version, teamIds };
  });
  if (setup.error) throw new Error(setup.error);

  await page.waitForFunction(() => {
    const tournaments = window.ChuteMundoCore.getState().tournaments;
    return ['playoff-ui-regression', 'playoff-history-protected'].every((id) => {
      const tournament = tournaments.find((item) => item.id === id);
      return tournament?.eraId && tournament?.coverage?.schema === 'era-stats-v1';
    });
  });
  await page.waitForTimeout(650);
  await page.evaluate(() => window.ChuteMundoCore.navigate('torneos'));
  await page.waitForFunction(() => [...document.querySelectorAll('[data-open-tournament="playoff-ui-regression"]')].some((element) => element.getClientRects().length));
  await page.locator('[data-open-tournament="playoff-ui-regression"]:visible').first().click();
  await page.waitForSelector('#cmTournamentHub[data-tournament-id="playoff-ui-regression"]');

  const repaired = await page.evaluate(() => {
    const core = window.ChuteMundoCore;
    const tournament = core.getState().tournaments.find((item) => item.id === 'playoff-ui-regression');
    const data = Object.fromEntries(tournament.matches.map((item) => [item.id, { homeRef: item.homeRef, awayRef: item.awayRef, resolvedHome: core.resolveHome(tournament, item), resolvedAway: core.resolveAway(tournament, item) }]));
    data.old = core.getState().tournaments.find((item) => item.id === 'playoff-history-protected').matches[0];
    return data;
  });
  if (setup.version !== '5.16.3') throw new Error(`Versión inválida: ${setup.version}`);
  if (repaired.s1.homeRef !== 'TABLE_1' || repaired.s1.awayRef !== 'TABLE_4' || repaired.s1.resolvedHome !== setup.teamIds[0] || repaired.s1.resolvedAway !== setup.teamIds[3]) throw new Error(`Semifinal 1 incorrecta: ${JSON.stringify(repaired.s1)}`);
  if (repaired.s2.homeRef !== 'TABLE_2' || repaired.s2.awayRef !== 'TABLE_3' || repaired.s2.resolvedHome !== setup.teamIds[1] || repaired.s2.resolvedAway !== setup.teamIds[2]) throw new Error(`Semifinal 2 incorrecta: ${JSON.stringify(repaired.s2)}`);
  if (repaired.third.homeRef !== 'S1_L' || repaired.third.awayRef !== 'S2_L' || repaired.final.homeRef !== 'S1_W' || repaired.final.awayRef !== 'S2_W') throw new Error(`Final o tercer lugar incorrectos: ${JSON.stringify(repaired)}`);
  if (repaired.old.home !== setup.teamIds[2] || repaired.old.away !== setup.teamIds[3] || repaired.old.homeRef !== 'TABLE_3') throw new Error(`Se modificó una semifinal histórica: ${JSON.stringify(repaired.old)}`);

  const tableUi = await page.evaluate(() => {
    window.ChuteTournamentHub.switchTab('table');
    return {
      tabs: document.querySelectorAll('#cmTournamentHub .cm-hub-tabs [data-cm-tournament-tab]').length,
      rows: document.querySelectorAll('#cmTournamentHub [data-cm-tournament-panel="table"].active tbody tr').length,
      shields: document.querySelectorAll('#cmTournamentHub [data-cm-tournament-panel="table"].active img').length,
      hiddenSources: [...document.querySelectorAll('#tournamentDetail > .cm-hub-source-hidden')].every((element) => getComputedStyle(element).display === 'none')
    };
  });
  if (tableUi.tabs < 5 || tableUi.rows < 6 || tableUi.shields < 6 || !tableUi.hiddenSources) throw new Error(`Centro visual incompleto: ${JSON.stringify(tableUi)}`);

  const fixtureUi = await page.evaluate(() => {
    window.ChuteTournamentHub.switchTab('fixture');
    return {
      filters: document.querySelectorAll('#cmTournamentHub [data-cm-tournament-panel="fixture"].active .cm-hub-filterbar [data-cm-fixture-filter]').length,
      matches: document.querySelectorAll('#cmTournamentHub [data-cm-tournament-panel="fixture"].active .cm-hub-match').length,
      shields: document.querySelectorAll('#cmTournamentHub [data-cm-tournament-panel="fixture"].active .cm-hub-match-team img').length,
      viewButtons: [...document.querySelectorAll('#cmTournamentHub [data-cm-tournament-panel="fixture"].active [data-cm-hub-match]')].filter((button) => button.textContent.trim() === 'Ver partido').length
    };
  });
  if (fixtureUi.filters !== 3 || fixtureUi.matches < 4 || fixtureUi.shields < 4 || fixtureUi.viewButtons < 4) throw new Error(`Fixture incompleto: ${JSON.stringify(fixtureUi)}`);

  await page.evaluate(() => { window.ChuteMundoCore.canEdit = () => true; });
  await page.waitForTimeout(800);
  const buttonState = await page.evaluate(() => {
    window.ChuteTournamentHub.switchTab('fixture');
    window.ChuteV514UnifiedMatch.decorateEntryButtons();
    const hub = document.getElementById('cmTournamentHub');
    const first = hub?.querySelector('[data-cm-tournament-panel="fixture"].active [data-cm-hub-match]');
    if (!first) return { found: false };
    const style = getComputedStyle(first);
    const rect = first.getBoundingClientRect();
    first.click();
    return { found: true, display: style.display, visibility: style.visibility, width: rect.width, height: rect.height };
  });
  if (!buttonState.found || buttonState.display === 'none' || buttonState.visibility === 'hidden' || buttonState.width <= 0 || buttonState.height <= 0) throw new Error(`Botón de partido oculto: ${JSON.stringify(buttonState)}`);

  await page.waitForSelector('.cm-v516-match-center');
  const editor = await page.evaluate(() => ({
    goal: Boolean(document.querySelector('[data-cm-v516-goal-minute="home"]')),
    card: Boolean(document.querySelector('[data-cm-v516-card-minute="home"]')),
    change: Boolean(document.querySelector('[data-cm-v516-sub-minute="home"]'))
  }));
  if (!editor.goal || !editor.card || !editor.change) throw new Error(`Registro de partido no disponible: ${JSON.stringify(editor)}`);

  await page.evaluate(() => window.ChuteMundoCore.setState(window.__cmV5163Original));
  const title = await page.title();
  if (!/5\.(16\.3|17|18)/.test(title)) throw new Error(`Título sin actualizar: ${title}`);
  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|network/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));
  console.log('Chute Mundo v5.16.3 playoff UI smoke OK', { repaired, tableUi, fixtureUi, buttonState, editor });
} finally {
  await browser.close();
}
