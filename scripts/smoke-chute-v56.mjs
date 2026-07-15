import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 950 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => Boolean(window.ChuteMundoCore && window.ChuteDivisionsV54 && window.ChuteDisciplineV56 && window.ChuteDetailEvents), null, { timeout: 60_000 });
  await page.waitForFunction(() => window.ChuteMundoCore.cloudLoaded, null, { timeout: 60_000 });

  const setup = await page.evaluate(() => {
    const core = window.ChuteMundoCore;
    const api = window.ChuteDivisionsV54;
    const model = window.ChuteDetailModel;
    const current = core.getState();
    const teams = current.teams.filter((team) => !team.archived).slice(0, 6);
    if (teams.length < 6) throw new Error('Se necesitan seis equipos para probar disciplina.');
    const player = (team, index = 0) => model.playerName(team.players[index]);
    if (teams.some((team) => !team.players?.length)) throw new Error('Todos los equipos de prueba deben tener jugadores.');

    current.tournaments = current.tournaments.filter((tournament) => tournament.type !== 'division_season');
    const season1 = api.buildSeason({
      name: 'Temporada disciplinaria 1', status: 'active', legs: 2,
      firstPlayoff: false, secondPlayoff: false, finalLegs: 1, promotionMode: 'regular',
      firstIds: teams.slice(0, 3).map((team) => team.id), secondIds: teams.slice(3, 6).map((team) => team.id)
    });
    season1.id = 'test_discipline_1';
    season1.config.seasonNumber = 1;
    const season2 = api.buildSeason({
      name: 'Temporada disciplinaria 2', status: 'upcoming', legs: 2,
      firstPlayoff: false, secondPlayoff: false, finalLegs: 1, promotionMode: 'regular',
      firstIds: teams.slice(0, 3).map((team) => team.id), secondIds: teams.slice(3, 6).map((team) => team.id)
    });
    season2.id = 'test_discipline_2';
    season2.config.seasonNumber = 2;

    const teamA = teams[0];
    const playerA = player(teamA, 0);
    const matchesA = season1.matches.filter((match) => [match.home, match.away].includes(teamA.id));
    const addYellow = (match, teamId, name, minute) => {
      const side = match.home === teamId ? 'home' : 'away';
      match.cards.push({ id: core.uid('card'), side, teamId, playerName: name, role: 'player', type: 'yellow', minute: String(minute), createdAt: Date.now() });
    };
    for (const [index, match] of matchesA.slice(0, 2).entries()) {
      match.homeGoals = 1; match.awayGoals = 0;
      addYellow(match, teamA.id, playerA, index ? 20 : 10);
    }

    const teamC = teams[2];
    const playerC = player(teamC, 0);
    const lastC = season1.matches.filter((match) => [match.home, match.away].includes(teamC.id)).at(-1);
    lastC.homeGoals = 2; lastC.awayGoals = 1;
    const sideC = lastC.home === teamC.id ? 'home' : 'away';
    lastC.cards.push(
      { id: core.uid('card'), side: sideC, teamId: teamC.id, playerName: playerC, role: 'player', type: 'yellow', minute: '70', createdAt: Date.now() },
      { id: core.uid('card'), side: sideC, teamId: teamC.id, playerName: playerC, role: 'player', type: 'red', reason: 'double_yellow', secondYellow: true, minute: '80', createdAt: Date.now() }
    );

    current.tournaments.push(season1, season2);
    core.setState(current);
    core.navigate('torneos');

    const nextC = season2.matches.find((match) => [match.home, match.away].includes(teamC.id));
    return {
      season1: season1.id,
      season2: season2.id,
      teamA: teamA.id,
      playerA,
      suspendedMatchA: matchesA[2].id,
      teamC: teamC.id,
      playerC,
      carryMatchC: nextC.id,
      doubleMatch: season2.matches.find((match) => ![match.home, match.away].includes(teamC.id))?.id || season2.matches[0].id,
      doubleTeam: teams[1].id,
      doublePlayer: player(teams[1], 0)
    };
  });

  await page.waitForTimeout(900);
  const ledgerState = await page.evaluate((data) => {
    const getTournament = (id) => window.ChuteMundoCore.getState().tournaments.find((item) => item.id === id);
    const ledger = window.ChuteDisciplineV56.buildLedger();
    const suspendedA = window.ChuteDisciplineV56.suspendedPlayers(ledger, data.season1, data.suspendedMatchA, data.teamA);
    const suspendedC = window.ChuteDisciplineV56.suspendedPlayers(ledger, data.season2, data.carryMatchC, data.teamC);
    return {
      a: [...suspendedA.values()].map((player) => player.name),
      c: [...suspendedC.values()].map((player) => player.name),
      sanctions: ledger.sanctions.map((item) => item.reason),
      title: document.title,
      rules: getTournament(data.season1)?.config?.discipline
    };
  }, setup);
  if (!ledgerState.a.includes(setup.playerA)) throw new Error(`No se aplicó suspensión por acumulación: ${JSON.stringify(ledgerState)}`);
  if (!ledgerState.c.includes(setup.playerC)) throw new Error(`No se arrastró suspensión entre temporadas: ${JSON.stringify(ledgerState)}`);
  if (!ledgerState.sanctions.includes('Acumulación de amarillas') || !ledgerState.sanctions.includes('Doble amarilla')) throw new Error(`Motivos disciplinarios incompletos: ${JSON.stringify(ledgerState)}`);
  if (!ledgerState.title.includes('v5.6') || ledgerState.rules?.yellowLimit !== 2) throw new Error(`Configuración v5.6 incompleta: ${JSON.stringify(ledgerState)}`);

  await page.locator(`[data-open-tournament="${setup.season1}"]:visible`).last().click();
  await page.waitForSelector('#cmTournamentHub');
  await page.waitForSelector('[data-cm-v56-discipline-tab]');
  await page.click('[data-cm-v56-discipline-tab]');
  const disciplinePanel = await page.evaluate(() => ({
    active: document.querySelector('[data-cm-v56-discipline-panel]')?.classList.contains('active'),
    rules: document.querySelectorAll('.cm-v56-rules article').length,
    text: document.querySelector('[data-cm-v56-discipline-panel]')?.textContent || ''
  }));
  if (!disciplinePanel.active || disciplinePanel.rules !== 4 || (!disciplinePanel.text.includes('En riesgo') && !disciplinePanel.text.includes('Suspendido'))) throw new Error(`Centro disciplinario incompleto: ${JSON.stringify(disciplinePanel)}`);

  await page.evaluate((data) => window.ChuteDetailEvents.openDetailedMatch(data.season1, data.suspendedMatchA), setup);
  await page.waitForSelector('.cm-match-editor[data-cm-v56-enhanced="true"]');
  const blocked = await page.evaluate((data) => {
    const editor = document.querySelector('.cm-match-editor');
    const tournament = window.ChuteMundoCore.getState().tournaments.find((item) => item.id === data.season1);
    const match = tournament.matches.find((item) => item.id === data.suspendedMatchA);
    const side = match.home === data.teamA ? 'home' : 'away';
    const option = [...document.getElementById(`cmScorer-${side}`).options].find((item) => item.value === data.playerA);
    return { disabled: option?.disabled, notice: editor.textContent.includes(data.playerA) && editor.textContent.includes('suspensión') };
  }, setup);
  if (!blocked.disabled || !blocked.notice) throw new Error(`El jugador suspendido sigue habilitado: ${JSON.stringify(blocked)}`);

  await page.evaluate((data) => {
    const tournament = window.ChuteMundoCore.getState().tournaments.find((item) => item.id === data.season2);
    const match = tournament.matches.find((item) => item.id === data.doubleMatch);
    const teamId = [match.home, match.away].includes(data.doubleTeam) ? data.doubleTeam : match.home;
    const team = window.ChuteMundoCore.teamById(teamId);
    const name = teamId === data.doubleTeam ? data.doublePlayer : window.ChuteDetailModel.playerName(team.players[0]);
    const side = match.home === teamId ? 'home' : 'away';
    match.cards.push({ id: window.ChuteMundoCore.uid('card'), side, teamId, playerName: name, role: 'player', type: 'yellow', minute: '10', createdAt: Date.now() });
    window.__doubleTest = { tournamentId: tournament.id, matchId: match.id, side, name };
    window.ChuteDetailEvents.openDetailedMatch(tournament.id, match.id);
  }, setup);
  await page.waitForSelector('.cm-match-editor[data-cm-v56-enhanced="true"]');
  const doubleData = await page.evaluate(() => window.__doubleTest);
  await page.selectOption(`#cmCardPlayer-${doubleData.side}`, { label: doubleData.name });
  await page.selectOption(`#cmCardType-${doubleData.side}`, 'yellow');
  await page.selectOption(`#cmCardMinute-${doubleData.side}`, '20');
  await page.click(`[data-cm-add-card="${doubleData.side}"]`);
  await page.waitForFunction(({ tournamentId, matchId, name }) => {
    const tournament = window.ChuteMundoCore.getState().tournaments.find((item) => item.id === tournamentId);
    const match = tournament?.matches.find((item) => item.id === matchId);
    return Boolean(match?.cards.some((card) => card.playerName === name && card.reason === 'double_yellow'));
  }, doubleData, { timeout: 20_000 });
  const doubleResult = await page.evaluate(({ tournamentId, matchId, name }) => {
    const tournament = window.ChuteMundoCore.getState().tournaments.find((item) => item.id === tournamentId);
    const match = tournament.matches.find((item) => item.id === matchId);
    return match.cards.filter((card) => card.playerName === name).map((card) => ({ type: card.type, reason: card.reason || '' }));
  }, doubleData);
  if (!doubleResult.some((card) => card.type === 'red' && card.reason === 'double_yellow')) throw new Error(`La segunda amarilla no se convirtió en roja: ${JSON.stringify(doubleResult)}`);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, width: document.documentElement.scrollWidth }));
  if (mobile.width > mobile.viewport + 3) throw new Error(`Desborde móvil en disciplina: ${JSON.stringify(mobile)}`);

  const critical = errors.filter((message) => !/favicon|firestore.googleapis.com|permission-denied|La sesión administrativa o Firebase todavía no están disponibles|Failed to load resource|QUIC_NETWORK/i.test(message));
  if (critical.length) throw new Error(`Errores de página: ${critical.join(' | ')}`);
  console.log('Chute Mundo v5.6 discipline smoke OK', { ledgerState, disciplinePanel, blocked, doubleResult, mobile });
} finally {
  await browser.close();
}
