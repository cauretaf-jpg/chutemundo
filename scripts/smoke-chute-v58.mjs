import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteMundoCore && document.title.includes('v5.8'), null, { timeout: 30_000 });
  const beforeStats = await page.evaluate(() => ({
    analysis: Boolean(window.ChuteAnalysisV58),
    statsCss: performance.getEntriesByType('resource').some((entry) => entry.name.includes('chute-stats-v52.css')),
    runtime: window.ChuteRuntimeV58?.stats?.()
  }));
  if (beforeStats.analysis || beforeStats.statsCss) throw new Error(`Las estadísticas no se cargaron de forma diferida: ${JSON.stringify(beforeStats)}`);
  if (!beforeStats.runtime) throw new Error('Chute Runtime v5.8 no está disponible.');

  await page.click('[data-page="estadisticas"]');
  await page.waitForFunction(() => window.ChuteAnalysisV58 && window.ChuteControllersV57, null, { timeout: 30_000 });
  await page.evaluate(() => {
    const core = window.ChuteMundoCore;
    const current = structuredClone(core.getState());
    const ids = current.teams.slice(0, 6).map((team) => team.id);
    if (ids.length < 6) throw new Error('Se requieren seis equipos para la prueba de divisiones.');
    current.tournaments = current.tournaments.filter((tournament) => tournament.id !== 'test_v58_divisions');
    current.tournaments.push({
      id: 'test_v58_divisions', name: 'Temporada de Divisiones de Prueba', type: 'division_season', era: 'division', status: 'historical', teamIds: ids,
      groups: [{ id: 'division-1', name: '1.ª División', teamIds: ids.slice(0, 3) }, { id: 'division-2', name: '2.ª División', teamIds: ids.slice(3, 6) }],
      champion: ids[0], runnerUp: ids[1], third: ids[2],
      matches: [
        { id: 'v58_m1', stage: 'league', group: 'division-1', home: ids[0], away: ids[1], homeGoals: 2, awayGoals: 1, date: '2026-07-01', time: '20:00', venue: 'Sede Norte', goals: [
          { id: 'g1', side: 'away', teamId: ids[1], playerName: 'Jugador Visita', minute: '20' },
          { id: 'g2', side: 'home', teamId: ids[0], playerName: 'Jugador Local', minute: '80' },
          { id: 'g3', side: 'home', teamId: ids[0], playerName: 'Jugador Local', minute: '90' }
        ], cards: [] },
        { id: 'v58_m2', stage: 'league', group: 'division-2', home: ids[3], away: ids[4], homeGoals: 0, awayGoals: 0, date: '2026-07-02', time: '20:00', venue: 'Sede Sur', goals: [], cards: [{ id: 'c1', side: 'home', teamId: ids[3], playerName: 'Jugador Tarjeta', type: 'yellow', minute: '30' }] },
        { id: 'v58_m3', stage: 'knockout', round: 'Final', group: 'division-1', home: ids[0], away: ids[2], homeGoals: 1, awayGoals: 1, homePens: 4, awayPens: 3, date: '2026-07-03', time: '21:00', venue: 'Sede Norte', goals: [
          { id: 'g4', side: 'away', teamId: ids[2], playerName: 'Finalista', minute: '45' },
          { id: 'g5', side: 'home', teamId: ids[0], playerName: 'Jugador Local', minute: '105' }
        ], cards: [] }
      ]
    });
    core.setState(current);
    core.render();
    window.ChuteRuntimeV58.invalidate('smoke-data');
  });

  await page.click('[data-cm-v58-mode="analysis"]');
  await page.waitForSelector('#cmV58AnalysisRoot:not([hidden])');
  await page.selectOption('[data-cm-v58-filter="era"]', 'division');
  await page.waitForFunction(() => document.querySelector('[data-cm-v58-filter="tournament"]')?.textContent.includes('Temporada de Divisiones de Prueba'));

  const desktop = await page.evaluate(() => ({
    filters: document.querySelectorAll('[data-cm-v58-filter]').length,
    rankingSvg: Boolean(document.querySelector('.cm-v58-ranking-svg')),
    rankingLines: document.querySelectorAll('.cm-v58-ranking-svg .team-line').length,
    compareMetrics: document.querySelectorAll('.cm-v58-compare-metric').length,
    matrixRows: document.querySelectorAll('.cm-v58-matrix tbody tr').length,
    decisiveKpis: document.querySelectorAll('.cm-v58-decisive .cm-v58-kpis article').length,
    venueRows: document.querySelectorAll('.cm-v58-venues tbody tr').length,
    minuteRows: document.querySelectorAll('.cm-v58-minute-bars > div').length,
    tournamentOptions: [...document.querySelectorAll('[data-cm-v58-filter="tournament"] option')].map((option) => option.textContent),
    runtime: window.ChuteRuntimeV58.stats()
  }));
  if (desktop.filters !== 6) throw new Error(`Filtros de análisis incompletos: ${JSON.stringify(desktop)}`);
  if (!desktop.rankingSvg || desktop.rankingLines < 2) throw new Error(`Evolución FIFA incompleta: ${JSON.stringify(desktop)}`);
  if (desktop.compareMetrics < 12 || desktop.matrixRows < 4) throw new Error(`Comparador o matriz incompletos: ${JSON.stringify(desktop)}`);
  if (desktop.decisiveKpis !== 6 || desktop.venueRows < 2 || desktop.minuteRows !== 13) throw new Error(`Análisis decisivo, sedes o minutos incompletos: ${JSON.stringify(desktop)}`);
  if (!desktop.tournamentOptions.some((label) => label.includes('Temporada de Divisiones de Prueba'))) throw new Error('El filtro de la Era de divisiones no contiene el torneo simulado.');
  if (desktop.runtime.managedIntervals < 3) throw new Error(`Los intervalos no están siendo administrados por el runtime: ${JSON.stringify(desktop.runtime)}`);

  const teamId = await page.evaluate(() => window.ChuteMundoCore.getState().teams[0].id);
  await page.selectOption('[data-cm-v58-filter="team"]', teamId);
  await page.waitForFunction(() => document.querySelector('.cm-v58-minute-chart header p')?.textContent.includes('Anotados y recibidos'));
  if (await page.locator('.cm-v58-minute-bars > div').count() !== 13) throw new Error('El filtro por equipo alteró los tramos oficiales.');

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, width: document.documentElement.scrollWidth, rootVisible: !document.getElementById('cmV58AnalysisRoot').hidden }));
  if (!mobile.rootVisible || mobile.width > mobile.viewport + 3) throw new Error(`Desborde móvil en Análisis v5.8: ${JSON.stringify(mobile)}`);

  const critical = errors.filter((message) => !/favicon|firestore.googleapis.com|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED/i.test(message));
  if (critical.length) throw new Error(`Errores críticos de página: ${critical.join(' | ')}`);
  console.log('Chute Mundo v5.8 analysis and optimization smoke OK', { beforeStats, desktop, mobile });
} finally {
  await browser.close();
}
