import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteV5162PlayoffSeeding && window.ChuteMundoCore);

  const result = await page.evaluate(() => {
    const core = window.ChuteMundoCore;
    const api = window.ChuteV5162PlayoffSeeding;
    const original = core.getState();
    const teams = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, index) => ({ id, name: `Equipo ${index + 1}`, players: [] }));
    const current = {
      id: 'playoff-current', name: 'Liga con Play-Off', type: 'league_playoff', status: 'active', teamIds: teams.map((team) => team.id),
      manualStandings: teams.map((team, index) => ({ teamId: team.id, pos: index + 1 })),
      matches: [
        { id: 's1', stage: 'knockout', round: 'Semifinales', label: 'Semifinal 1', home: 'c', away: 'd', homeRef: 'TABLE_3', awayRef: 'TABLE_4', homeGoals: null, awayGoals: null, goals: [], cards: [], specialEvents: [], lineups: { home: { starters: [] }, away: { starters: [] } } },
        { id: 's2', stage: 'knockout', round: 'Semifinales', label: 'Semifinal 2', home: 'e', away: 'f', homeRef: 'TABLE_5', awayRef: 'TABLE_6', homeGoals: null, awayGoals: null, goals: [], cards: [], specialEvents: [] },
        { id: 'third', stage: 'knockout', round: '3er Lugar', label: '3er Puesto', home: 'e', away: 'f', homeRef: 'TABLE_5', awayRef: 'TABLE_6', homeGoals: null, awayGoals: null },
        { id: 'final', stage: 'knockout', round: 'Final', label: 'Final', home: 'c', away: 'd', homeRef: 'TABLE_3', awayRef: 'TABLE_4', homeGoals: null, awayGoals: null }
      ]
    };
    const historical = {
      id: 'playoff-history', name: 'Histórico', type: 'league_playoff', status: 'historical', teamIds: teams.map((team) => team.id),
      manualStandings: teams.map((team, index) => ({ teamId: team.id, pos: index + 1 })),
      matches: [{ id: 'old-s1', stage: 'knockout', round: 'Semifinales', label: 'Semifinal 1', home: 'c', away: 'd', homeRef: 'TABLE_3', awayRef: 'TABLE_4', homeGoals: 1, awayGoals: 0, goals: [] }]
    };
    const repaired = api.repairState({ teams, tournaments: [current, historical], friendlies: [], participants: [], classics: [], rules: [], activity: [] });
    core.setState(repaired.state);
    const state = core.getState();
    const tournament = state.tournaments.find((item) => item.id === 'playoff-current');
    const semi1 = tournament.matches.find((match) => match.id === 's1');
    const semi2 = tournament.matches.find((match) => match.id === 's2');
    const third = tournament.matches.find((match) => match.id === 'third');
    const final = tournament.matches.find((match) => match.id === 'final');
    const old = state.tournaments.find((item) => item.id === 'playoff-history').matches[0];
    const output = {
      version: api.version,
      changed: repaired.changed,
      semi1: { homeRef: semi1.homeRef, awayRef: semi1.awayRef, home: semi1.home, away: semi1.away, resolvedHome: core.resolveHome(tournament, semi1), resolvedAway: core.resolveAway(tournament, semi1) },
      semi2: { homeRef: semi2.homeRef, awayRef: semi2.awayRef, home: semi2.home, away: semi2.away, resolvedHome: core.resolveHome(tournament, semi2), resolvedAway: core.resolveAway(tournament, semi2) },
      third: { homeRef: third.homeRef, awayRef: third.awayRef },
      final: { homeRef: final.homeRef, awayRef: final.awayRef },
      historical: { home: old.home, away: old.away, homeRef: old.homeRef, awayRef: old.awayRef },
      title: document.title
    };
    core.setState(original);
    return output;
  });

  if (result.version !== '5.16.2' || !result.changed) throw new Error(`Versión o reparación inválida: ${JSON.stringify(result)}`);
  if (result.semi1.homeRef !== 'TABLE_1' || result.semi1.awayRef !== 'TABLE_4' || result.semi1.home !== null || result.semi1.away !== null || result.semi1.resolvedHome !== 'a' || result.semi1.resolvedAway !== 'd') throw new Error(`Semifinal 1 incorrecta: ${JSON.stringify(result.semi1)}`);
  if (result.semi2.homeRef !== 'TABLE_2' || result.semi2.awayRef !== 'TABLE_3' || result.semi2.home !== null || result.semi2.away !== null || result.semi2.resolvedHome !== 'b' || result.semi2.resolvedAway !== 'c') throw new Error(`Semifinal 2 incorrecta: ${JSON.stringify(result.semi2)}`);
  if (result.third.homeRef !== 'S1_L' || result.third.awayRef !== 'S2_L' || result.final.homeRef !== 'S1_W' || result.final.awayRef !== 'S2_W') throw new Error(`Final o tercer lugar incorrectos: ${JSON.stringify(result)}`);
  if (result.historical.home !== 'c' || result.historical.away !== 'd' || result.historical.homeRef !== 'TABLE_3') throw new Error(`Se modificó una semifinal histórica: ${JSON.stringify(result.historical)}`);
  if (!result.title.includes('5.16.2')) throw new Error(`Título sin actualizar: ${result.title}`);

  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|network/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));
  console.log('Chute Mundo v5.16.2 playoff smoke OK', result);
} finally {
  await browser.close();
}
