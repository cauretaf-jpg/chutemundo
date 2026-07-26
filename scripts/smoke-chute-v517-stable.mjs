import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteV517Finalization && window.ChuteMundoCore && window.ChuteV511Tournaments && window.ChuteVersion?.bootCompleted);

  const setup = await page.evaluate(() => {
    const core = window.ChuteMundoCore;
    window.__cmV517StableOriginal = structuredClone(core.getState());
    core.canEdit = () => true;
    core.isAdmin = () => true;
    core.saveCloud = async () => true;
    const next = structuredClone(core.getState());
    const teams = next.teams.slice(0, 4);
    if (teams.length < 4) return { error: 'No hay cuatro equipos.' };
    const names = teams.map((team) => team.players.map((entry) => Array.isArray(entry) ? entry[0] : entry.name));
    const debut = { name: 'Debut Stable 517', position: 'Delantero', minute: 0 };
    teams[0].players.push(debut);
    names[0].push(debut.name);
    const lineup = (index) => ({ goalkeeper: names[index][0], starters: names[index].slice(0, 4), changes: [] });
    const goal = (id, side, teamId, playerName, assistName, minute) => ({ id, side, teamId, playerName, assistName, minute: String(minute), createdAt: minute });
    const match = (id, round, label, homeIndex, awayIndex, homeGoals, awayGoals, goals, extras = {}) => ({
      id, stage: 'knockout', round, label, home: teams[homeIndex].id, away: teams[awayIndex].id,
      homeGoals, awayGoals, goals, cards: [], specialEvents: [], participationTracked: true,
      participantHome: 'participante_alvaro', participantAway: 'participante_carlos',
      date: '2026-07-21', venue: "Wladi's House", lineups: { home: lineup(homeIndex), away: lineup(awayIndex) }, ...extras
    });
    const tournament = {
      id: 'v517-stable', name: 'Torneo estable v5.17', type: 'league_playoff', status: 'active', teamIds: teams.map((team) => team.id),
      participantLocal: 'participante_alvaro', participantAway: 'participante_carlos',
      matches: [
        match('semi-a', 'Semifinales', 'Semifinal 1', 0, 3, 1, 0, [goal('g1', 'home', teams[0].id, names[0][1], names[0][2], 20)]),
        match('semi-b', 'Semifinales', 'Semifinal 2', 1, 2, 2, 0, [goal('g2', 'home', teams[1].id, names[1][1], names[1][2], 30), goal('g3', 'home', teams[1].id, names[1][1], '', 60)]),
        match('third', '3er Lugar', '3er Puesto', 2, 3, 1, 0, [goal('g4', 'home', teams[2].id, names[2][1], names[2][2], 50)]),
        match('final', 'Final', 'Final', 0, 1, 2, 1, [goal('g5', 'home', teams[0].id, debut.name, names[0][2], 20), goal('g6', 'away', teams[1].id, names[1][1], names[1][2], 45), goal('g7', 'home', teams[0].id, debut.name, names[0][2], 80)])
      ]
    };
    next.tournaments.push(tournament);
    core.setState(next);
    return { tournamentId: tournament.id };
  });
  if (setup.error) throw new Error(setup.error);

  await page.waitForFunction((id) => Boolean(window.ChuteMundoCore.getState().tournaments.find((item) => item.id === id)?.eraId), setup.tournamentId);
  const before = await page.evaluate((id) => {
    const tournament = window.ChuteMundoCore.getState().tournaments.find((item) => item.id === id);
    const calculation = window.ChuteV517Finalization.computeAwards(tournament);
    const issues = window.ChuteV517Finalization.qualityIssues(tournament, calculation);
    return {
      cards: Object.keys(calculation.awards).length,
      automatic: ['scorer', 'assist', 'mvp', 'goalkeeper', 'finalMvp'].map((key) => [key, calculation.awards[key]?.playerName || '', calculation.awards[key]?.reason || '']),
      revelation: calculation.awards.revelation,
      critical: issues.filter((item) => item.level === 'critical').length
    };
  }, setup.tournamentId);
  if (before.cards !== 6 || before.critical !== 0) throw new Error(`Cálculo o calidad inválidos: ${JSON.stringify(before)}`);
  if (before.automatic.some(([, playerName, reason]) => !playerName || !reason)) throw new Error(`Premios automáticos incompletos: ${JSON.stringify(before.automatic)}`);
  if (!before.revelation?.reason || (!before.revelation.playerName && before.revelation.status !== 'pending')) throw new Error(`Revelación inválida: ${JSON.stringify(before.revelation)}`);

  await page.evaluate((id) => window.ChuteV517Finalization.finalizeTournament(id), setup.tournamentId);
  await page.waitForFunction((id) => {
    const tournament = window.ChuteMundoCore.getState().tournaments.find((item) => item.id === id);
    return tournament?.status === 'historical' && tournament.awardsEngineVersion === '5.17.0' && tournament.awardsStatus === 'official' && tournament.awardDetails?.mvp?.playerName;
  }, setup.tournamentId);
  const after = await page.evaluate((id) => {
    const tournament = window.ChuteMundoCore.getState().tournaments.find((item) => item.id === id);
    return {
      status: tournament.status,
      champion: tournament.champion,
      participantChampion: tournament.participantChampion,
      awards: Object.keys(tournament.awardDetails || {}).length,
      title: document.title
    };
  }, setup.tournamentId);
  if (after.status !== 'historical' || after.awards !== 6 || !after.title.includes('5.25.0')) throw new Error(`Cierre oficial incompleto: ${JSON.stringify(after)}`);
  if (after.participantChampion && after.participantChampion !== 'participante_alvaro') throw new Error(`Participante campeón incorrecto: ${JSON.stringify(after)}`);

  const criticalErrors = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|network|service worker/i.test(message));
  if (criticalErrors.length) throw new Error(criticalErrors.join(' | '));
  await page.evaluate(() => window.ChuteMundoCore.setState(window.__cmV517StableOriginal));
  console.log('Chute Mundo v5.17 stable regression OK', { before, after });
} finally {
  await browser.close();
}
