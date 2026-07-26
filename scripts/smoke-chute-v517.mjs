import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteV517Finalization && window.ChuteMundoCore && window.ChuteTournamentHub && window.ChuteV523ControlCenter);

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
      participantHome: 'participante_alvaro', participantAway: 'participante_carlos',
      date: '2026-07-21', venue: "Wladi's House", lineups: { home: lineup(homeIndex), away: lineup(awayIndex) }, ...extras
    });
    const shootout = [
      ...[names[0][1], names[0][2], names[0][3], debut.name].map((playerName, index) => ({ id: `ph${index}`, kind: 'shootout_penalty', side: 'home', teamId: teams[0].id, playerName, result: 'scored', order: index * 2 + 1, createdAt: 10000 + index })),
      ...[names[3][1], names[3][2], names[3][3]].map((playerName, index) => ({ id: `pa${index}`, kind: 'shootout_penalty', side: 'away', teamId: teams[3].id, playerName, result: 'scored', order: index * 2 + 2, createdAt: 11000 + index }))
    ];
    const tournament = {
      id: 'v517-finalization-test', name: 'Torneo finalización v5.17', type: 'league_playoff', status: 'active', teamIds: teams.map((team) => team.id),
      participantLocal: 'participante_alvaro', participantAway: 'participante_carlos',
      matches: [
        match('s1', 'Semifinales', 'Semifinal 1', 0, 3, 1, 1, [goal('g1', 'home', teams[0].id, names[0][1], names[0][2], 20), goal('g2', 'away', teams[3].id, names[3][1], '', 70)], { shootoutStarted: true, homePens: 4, awayPens: 3, penaltyShootout: shootout }),
        match('s2', 'Semifinales', 'Semifinal 2', 1, 2, 2, 0, [goal('g3', 'home', teams[1].id, names[1][1], names[1][2], 30), goal('g4', 'home', teams[1].id, names[1][1], '', 60)]),
        match('third', '3er Lugar', '3er Puesto', 2, 3, 1, 0, [goal('g5', 'home', teams[2].id, names[2][1], names[2][2], 50)]),
        match('final', 'Final', 'Final', 0, 1, 2, 1, [goal('g6', 'home', teams[0].id, debut.name, names[0][2], 20), goal('g7', 'away', teams[1].id, names[1][1], names[1][2], 45), goal('g8', 'home', teams[0].id, debut.name, names[0][2], 80)])
      ]
    };
    next.tournaments.push(tournament);
    core.setState(next);
    return { tournamentId: tournament.id };
  });
  if (setup.error) throw new Error(setup.error);

  await page.waitForFunction((id) => Boolean(window.ChuteMundoCore.getState().tournaments.find((item) => item.id === id)?.eraId), setup.tournamentId);
  const computed = await page.evaluate((id) => {
    const tournament = window.ChuteMundoCore.getState().tournaments.find((item) => item.id === id);
    const result = window.ChuteV517Finalization.computeAwards(tournament);
    const issues = window.ChuteV517Finalization.qualityIssues(tournament);
    return {
      awards: Object.fromEntries(Object.entries(result.awards).map(([key, value]) => [key, { playerName: value?.playerName || '', reason: value?.reason || '', status: value?.status || '' }])),
      critical: issues.filter((issue) => issue.level === 'critical').length,
      penalties: window.ChuteV517Finalization.penaltyScore(tournament.matches[0])
    };
  }, setup.tournamentId);
  for (const key of ['scorer', 'assist', 'mvp', 'goalkeeper', 'finalMvp']) {
    if (!computed.awards[key]?.playerName || !computed.awards[key]?.reason) throw new Error(`Premio ${key} incompleto: ${JSON.stringify(computed.awards[key])}`);
  }
  if (!computed.awards.revelation?.reason || (!computed.awards.revelation.playerName && computed.awards.revelation.status !== 'pending')) throw new Error(`Revelación inválida: ${JSON.stringify(computed.awards.revelation)}`);
  if (computed.critical !== 0 || computed.penalties.home !== 4 || computed.penalties.away !== 3) throw new Error(`Calidad o penales inválidos: ${JSON.stringify(computed)}`);

  await page.evaluate((id) => {
    window.ChuteMundoCore.navigate('torneos');
    window.ChuteV524Tournaments?.render?.();
    document.querySelector(`[data-open-tournament="${CSS.escape(id)}"]`)?.click();
  }, setup.tournamentId);
  await page.waitForFunction((id) => Boolean(document.querySelector(`#cmTournamentHub[data-tournament-id="${id}"] [data-cm-v517-awards-tab]`)), setup.tournamentId);
  const hidden = await page.locator('[data-cm-v517-awards-panel]').evaluate((panel) => panel.hidden && panel.getClientRects().length === 0);
  if (!hidden) throw new Error('El panel de premios debe comenzar oculto.');
  await page.locator('[data-cm-v517-awards-tab]').click();
  await page.waitForSelector('[data-cm-v517-awards-panel].active .cm-v517-awards-grid');
  if (await page.locator('.cm-v517-award-card').count() !== 6) throw new Error('El panel no muestra los seis premios.');

  await page.evaluate((id) => window.ChuteV517Finalization.finalizeTournament(id), setup.tournamentId);
  await page.waitForFunction((id) => {
    const tournament = window.ChuteMundoCore.getState().tournaments.find((item) => item.id === id);
    return tournament?.status === 'historical' && tournament.awardsEngineVersion === '5.17.0' && tournament.awardDetails?.mvp?.playerName;
  }, setup.tournamentId);
  const finalData = await page.evaluate((id) => {
    const tournament = window.ChuteMundoCore.getState().tournaments.find((item) => item.id === id);
    return { status: tournament.status, champion: tournament.champion, participantChampion: tournament.participantChampion, title: document.title };
  }, setup.tournamentId);
  if (!/5\.(17|18|19|20|21|22|23|24|25)/.test(finalData.title)) throw new Error(`Título incorrecto: ${finalData.title}`);
  if (finalData.participantChampion && finalData.participantChampion !== 'participante_alvaro') throw new Error(`Participante campeón incorrecto: ${JSON.stringify(finalData)}`);

  const criticalErrors = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|network/i.test(message));
  if (criticalErrors.length) throw new Error(criticalErrors.join(' | '));
  await page.evaluate(() => window.ChuteMundoCore.setState(window.__cmV517Original));
  console.log('Chute Mundo v5.17 regression smoke OK', { computed, finalData });
} finally {
  await browser.close();
}
