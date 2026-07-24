import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteMundoCore && window.ChuteV521History && window.ChuteV522StatsRefinement && window.ChuteVersion?.bootCompleted);

  await page.evaluate(() => {
    const core = window.ChuteMundoCore;
    window.__cmV522Original = structuredClone(core.getState());
    const original = core.getState();
    const makePlayers = (prefix) => [
      { name: `Arquero ${prefix}`, position: 'Arquero' },
      { name: `Goleador ${prefix}`, position: 'Delantero' },
      { name: `Asistente ${prefix}`, position: 'Medio' },
      { name: `Defensa ${prefix}`, position: 'Defensa' }
    ];
    const teams = [
      { id: 'polpetta', name: 'Polpetta', players: makePlayers('Polpetta') },
      { id: 'parrilla', name: 'Parrilla', players: makePlayers('Parrilla') },
      { id: 'guanaco', name: 'Guanaco', players: makePlayers('Guanaco') },
      { id: 'perla', name: 'Perla', players: makePlayers('Perla') },
      { id: 'trucha', name: 'Trucha', players: makePlayers('Trucha') },
      { id: 'pantera', name: 'Pantera', players: makePlayers('Pantera') }
    ];
    const lineup = (prefix) => ({ starters: [`Arquero ${prefix}`, `Goleador ${prefix}`, `Asistente ${prefix}`, `Defensa ${prefix}`], changes: [] });
    const tournaments = [
      {
        id: 'hist', name: '8vo Torneo - Copa', type: 'cup_groups', status: 'historical', eraId: 'leagues',
        champion: 'polpetta', runnerUp: 'parrilla', third: 'guanaco', teamIds: teams.map((team) => team.id),
        awardsStatus: 'official',
        awardDetails: {
          scorer: { playerName: 'Goleador Polpetta', teamId: 'polpetta', title: 'Goleador' },
          assist: { playerName: 'Asistente Polpetta', teamId: 'polpetta', title: 'Máximo asistidor' },
          mvp: { playerName: 'Goleador Polpetta', teamId: 'polpetta', title: 'Mejor jugador' },
          goalkeeper: { playerName: 'Arquero Parrilla', teamId: 'parrilla', title: 'Mejor arquero' }
        },
        playerScorers: [['Goleador Polpetta', 'polpetta', 3, 4]],
        playerAssists: [['Asistente Polpetta', 'polpetta', 3, 3]],
        matches: [
          { id: 'm1', stage: 'regular', home: 'polpetta', away: 'parrilla', homeGoals: 2, awayGoals: 1, date: '2026-01-01', venue: '', participationTracked: true,
            lineups: { home: lineup('Polpetta'), away: lineup('Parrilla') },
            goals: [
              { id: 'g1', side: 'home', teamId: 'polpetta', playerName: 'Goleador Polpetta', assistName: 'Asistente Polpetta', minute: '10' },
              { id: 'g2', side: 'home', teamId: 'polpetta', playerName: 'Goleador Polpetta', assistName: 'Asistente Polpetta', minute: '30' },
              { id: 'g3', side: 'away', teamId: 'parrilla', playerName: 'Goleador Parrilla', assistName: '', minute: '60' }
            ] },
          { id: 'm2', stage: 'knockout', round: '3er Lugar', home: 'parrilla', away: 'guanaco', homeGoals: 0, awayGoals: 0, homePens: 4, awayPens: 3, date: '2026-01-02', venue: "Wladi's House - Campo 1", participationTracked: true,
            lineups: { home: lineup('Parrilla'), away: lineup('Guanaco') }, goals: [] },
          { id: 'm3', stage: 'regular', home: 'perla', away: 'trucha', homeGoals: 1, awayGoals: 2, date: '2026-01-03', venue: "Carloco's House - Campo 1", participationTracked: true,
            lineups: { home: lineup('Perla'), away: lineup('Trucha') }, goals: [] }
        ]
      },
      { id: 'active', name: 'Liga Actual', type: 'league', status: 'active', eraId: 'divisions', teamIds: ['polpetta', 'guanaco'],
        matches: [{ id: 'm4', stage: 'regular', home: 'polpetta', away: 'guanaco', homeGoals: 1, awayGoals: 1, date: '2026-07-20', venue: "Carlo's House", participationTracked: true,
          lineups: { home: lineup('Polpetta'), away: lineup('Guanaco') },
          goals: [
            { id: 'g4', side: 'home', teamId: 'polpetta', playerName: 'Goleador Polpetta', assistName: 'Asistente Polpetta', minute: '12' },
            { id: 'g5', side: 'away', teamId: 'guanaco', playerName: 'Goleador Guanaco', assistName: 'Asistente Guanaco', minute: '70' }
          ] }] },
      { id: 'first', name: 'Primera División', type: 'division_season', status: 'upcoming', eraId: 'divisions', teamIds: ['polpetta', 'perla', 'trucha'], matches: [] },
      { id: 'second', name: 'Segunda División', type: 'division_season', status: 'upcoming', eraId: 'divisions', teamIds: ['parrilla', 'guanaco', 'pantera'], matches: [] }
    ];
    core.setState({ ...original, teams, tournaments, friendlies: [], participants: original.participants || [], activity: original.activity || [] });
    core.navigate('estadisticas');
  });

  await page.waitForSelector('#cmV521History[data-cm-v522-ready="true"]', { state: 'visible' });
  await page.waitForSelector('.cm-v522-summary');
  await page.waitForFunction(() => {
    const matches = window.ChuteMundoCore.getState().tournaments.flatMap((tournament) => tournament.matches || []);
    return matches.every((match) => match.venue && !/Campo 1|Carlo's House/.test(match.venue));
  });

  const shell = await page.evaluate(() => ({
    appVersion: window.ChuteVersion.version,
    refinementVersion: window.ChuteV522StatsRefinement.version,
    title: document.title,
    tabs: [...document.querySelectorAll('[data-cm-v521-tab] b')].map((node) => node.textContent.trim()),
    toolbarPosition: getComputedStyle(document.querySelector('.cm-v521-toolbar')).position,
    compactHeight: document.querySelector('[data-cm-v521-tab]')?.getBoundingClientRect().height || 0,
    summary: document.querySelector('.cm-v522-summary')?.innerText || '',
    graphPaths: document.querySelectorAll('.cm-v522-chart-wrap path').length,
    colors: ['Polpetta', 'Parrilla', 'Guanaco', 'Perla', 'Trucha', 'Pantera'].map((name) => window.ChuteV522StatsRefinement.teamColor(name)),
    venues: window.ChuteMundoCore.getState().tournaments.flatMap((tournament) => (tournament.matches || []).map((match) => match.venue))
  }));
  if (shell.appVersion !== '5.22.0' || shell.refinementVersion !== '5.22.0' || !shell.title.includes('5.22.0')) throw new Error(`Versiones inválidas: ${JSON.stringify(shell)}`);
  for (const label of ['Resumen', 'Jugadores', 'Equipos y Palmarés', 'Torneos', 'Récords', 'Frente a Frente']) if (!shell.tabs.includes(label)) throw new Error(`Falta pestaña compacta ${label}: ${JSON.stringify(shell.tabs)}`);
  if (shell.tabs.some((label) => /Análisis histórico/i.test(label)) || shell.toolbarPosition !== 'static' || shell.compactHeight > 55) throw new Error(`Navegación o filtros incorrectos: ${JSON.stringify(shell)}`);
  if (!shell.summary.includes('Líderes acumulados') || !shell.summary.includes('Evolución de la Tabla Eterna') || shell.graphPaths < 3) throw new Error(`Resumen o gráfico incompleto: ${JSON.stringify(shell)}`);
  const expectedColors = ['#7c3aed', '#dc2626', '#f97316', '#fb923c', '#38bdf8', '#111827'];
  if (JSON.stringify(shell.colors) !== JSON.stringify(expectedColors)) throw new Error(`Colores de equipos incorrectos: ${JSON.stringify(shell.colors)}`);
  if (!shell.venues.includes("Carloco's House") || !shell.venues.includes("Wladi's House") || shell.venues.some((venue) => /Campo 1|Carlo's House/.test(venue))) throw new Error(`Sedes sin consolidar: ${JSON.stringify(shell.venues)}`);

  await page.locator('[data-cm-v521-tab="rankings"]').click();
  await page.waitForSelector('[data-cm-v521-panel="rankings"].active');
  const goalsHeaders = await page.locator('[data-cm-v521-ranking-panel="goals"] thead').innerText();
  if (!goalsHeaders.includes('PJ') || goalsHeaders.includes('Torneos')) throw new Error(`Columnas de goleadores incorrectas: ${goalsHeaders}`);
  await page.locator('[data-cm-v521-ranking="assists"]').click();
  const assistsHeaders = await page.locator('[data-cm-v521-ranking-panel="assists"] thead').innerText();
  if (!assistsHeaders.includes('PJ') || assistsHeaders.includes('Torneos')) throw new Error(`Columnas de asistencias incorrectas: ${assistsHeaders}`);
  await page.locator('[data-cm-v521-ranking="keepers"]').click();
  const keepersHeaders = await page.locator('[data-cm-v521-ranking-panel="keepers"] table').first().locator('thead').innerText();
  if (!keepersHeaders.includes('PJ') || keepersHeaders.includes('Torneos')) throw new Error(`Columnas de porteros incorrectas: ${keepersHeaders}`);

  await page.locator('[data-cm-v521-tab="honours"]').click();
  const teamHistory = await page.locator('.cm-v522-team-history').innerText();
  if (!teamHistory.includes('Campeón en') || !teamHistory.includes('Subcampeón en') || !teamHistory.includes('Tercer lugar en') || !teamHistory.includes('Primera División') || !teamHistory.includes('Segunda División')) throw new Error(`Trayectoria de equipos incompleta: ${teamHistory}`);

  await page.locator('[data-cm-v521-tab="archive"]').click();
  const tournamentStats = await page.locator('.cm-v522-tournament-stats').innerText();
  const tournamentStatsNormalized = tournamentStats.toLocaleLowerCase('es');
  if (!tournamentStatsNormalized.includes('rendimiento por competencia') || !tournamentStatsNormalized.includes('sedes consolidadas') || !tournamentStats.includes("Carloco's House") || !tournamentStats.includes("Wladi's House")) throw new Error(`Estadísticas de torneos incompletas: ${tournamentStats}`);

  const mobile = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
  if (mobile.width > mobile.viewport + 3) throw new Error(`Desborde móvil en v5.22: ${JSON.stringify(mobile)}`);

  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|network|service worker/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));
  await page.evaluate(() => window.ChuteMundoCore.setState(window.__cmV522Original));
  console.log('Chute Mundo v5.22 statistics refinement smoke OK', { shell, mobile });
} finally {
  await context.close();
  await browser.close();
}
