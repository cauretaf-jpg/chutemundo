import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteMundoCore && window.ChuteV519Stats && window.ChuteV519StatsGuard);
  await page.waitForFunction(() => !document.getElementById('inicio')?.hidden && document.getElementById('estadisticas')?.hidden);

  await page.evaluate(() => {
    const core = window.ChuteMundoCore;
    window.__cmV519Original = structuredClone(core.getState());
    const original = core.getState();
    const teams = [
      { id: 'a', name: 'Atlético A', initials: 'ATA', players: [
        { name: 'Arquero A', position: 'Arquero' },
        { name: 'Goleador A', position: 'Delantero' },
        { name: 'Asistente A', position: 'Medio' },
        { name: 'Defensa A', position: 'Defensa' }
      ] },
      { id: 'b', name: 'Barrio B', initials: 'BRB', players: [
        { name: 'Arquero B', position: 'Arquero' },
        { name: 'Delantero B', position: 'Delantero' },
        { name: 'Medio B', position: 'Medio' },
        { name: 'Defensa B', position: 'Defensa' }
      ] }
    ];
    const tournaments = [
      {
        id: 'league-cutoff', name: '8vo Torneo - Copa', type: 'league', status: 'historical', eraId: 'leagues', champion: 'a', runnerUp: 'b', teamIds: ['a','b'],
        matches: [{ id: 'l1', stage: 'regular', home: 'a', away: 'b', homeGoals: 1, awayGoals: 0, date: '2026-01-01', venue: 'Cancha Antigua' }],
        playerScorers: { lead: { playerName: 'Goleador A', team: 'Atlético A', appearances: 1, goals: 2 } },
        playerAssists: { lead: { name: 'Asistente A', teamId: 'a', appearances: 1, assists: 1 } }
      },
      {
        id: 'division-one', name: '1.ª División', type: 'division_season', status: 'active', eraId: 'divisions', teamIds: ['a','b'],
        matches: [{
          id: 'd1', stage: 'regular', home: 'a', away: 'b', homeGoals: 2, awayGoals: 0, date: '2026-07-20', venue: 'Cancha Central', participationTracked: true,
          lineups: {
            home: { starters: ['Arquero A','Goleador A','Asistente A','Defensa A'], changes: [] },
            away: { starters: ['Arquero B','Delantero B','Medio B','Defensa B'], changes: [] }
          },
          goals: [
            { id: 'g1', side: 'home', teamId: 'a', playerName: 'Goleador A', assistName: 'Asistente A', minute: '12' },
            { id: 'g2', side: 'home', teamId: 'a', playerName: 'Goleador A', assistName: 'Asistente A', minute: '68' }
          ],
          cards: []
        }],
        playerScorers: [], playerAssists: []
      }
    ];
    core.setState({ ...original, teams, tournaments, friendlies: [], participants: original.participants || [], activity: original.activity || [] });
  });

  await page.evaluate(() => window.ChuteMundoCore.navigate('estadisticas'));
  await page.waitForSelector('#cmV519Stats', { state: 'visible' });
  await page.waitForSelector('[data-cm-v519-panel="summary"].active');

  const shell = await page.evaluate(() => ({
    version: window.ChuteV519Stats.version,
    title: document.title,
    tabs: [...document.querySelectorAll('[data-cm-v519-tab]')].map((button) => button.textContent.trim()),
    filters: document.querySelectorAll('[data-cm-v519-filter]').length,
    oldRootsVisible: ['cmV518Stats','cmV516Stats','cmStatsCenter','cmV58AnalysisRoot','cmV58ModeSwitch'].filter((id) => document.getElementById(id)?.getClientRects().length),
    oldGlobals: Boolean(window.ChuteV5181StatsPolish || window.ChuteV5182StatsLoader || window.ChuteAnalysisV58),
    oldRequests: performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => /chute-v518-era-stats|chute-v5181-stats-polish|chute-v5182-stats-loader|chute-v58-analysis/.test(name))
  }));
  if (shell.version !== '5.19.0' || !shell.title.includes('5.19') || shell.tabs.length !== 7 || !shell.tabs.includes('Análisis histórico') || shell.filters !== 3 || shell.oldRootsVisible.length || shell.oldGlobals || shell.oldRequests.length) throw new Error(`Arquitectura estadística inválida: ${JSON.stringify(shell)}`);

  await page.locator('[data-cm-v519-tab="scorers"]').click();
  await page.waitForSelector('[data-cm-v519-panel="scorers"].active');
  let scorerValue = await page.locator('[data-cm-v519-panel="scorers"] tr', { hasText: 'Goleador A' }).locator('.cm-v519-value').textContent();
  if (scorerValue.trim() !== '4') throw new Error(`Total general de goles incorrecto: ${scorerValue}`);

  await page.locator('[data-cm-v519-tab="assists"]').click();
  await page.waitForSelector('[data-cm-v519-panel="assists"].active');
  let assistValue = await page.locator('[data-cm-v519-panel="assists"] tr', { hasText: 'Asistente A' }).locator('.cm-v519-value').textContent();
  if (assistValue.trim() !== '3') throw new Error(`Total general de asistencias incorrecto: ${assistValue}`);

  await page.locator('[data-cm-v519-tab="keepers"]').click();
  await page.waitForSelector('[data-cm-v519-panel="keepers"].active');
  const keeperRow = page.locator('[data-cm-v519-panel="keepers"] tr', { hasText: 'Arquero A' });
  if (await keeperRow.count() !== 1 || (await keeperRow.locator('.cm-v519-value').textContent()).trim() !== '1') throw new Error('La tabla de portería imbatida no calculó la valla invicta.');

  await page.selectOption('[data-cm-v519-filter="era"]', 'divisions');
  await page.waitForFunction(() => document.querySelector('[data-cm-v519-filter="era"]')?.value === 'divisions');
  await page.locator('[data-cm-v519-tab="scorers"]').click();
  scorerValue = await page.locator('[data-cm-v519-panel="scorers"] tr', { hasText: 'Goleador A' }).locator('.cm-v519-value').textContent();
  if (scorerValue.trim() !== '2') throw new Error(`Filtro Era de divisiones incorrecto: ${scorerValue}`);

  await page.selectOption('[data-cm-v519-filter="era"]', 'leagues');
  await page.locator('[data-cm-v519-tab="keepers"]').click();
  const leagueKeepers = await page.locator('[data-cm-v519-panel="keepers"]').innerText();
  if (!leagueKeepers.includes('se registra desde la Era de divisiones')) throw new Error(`El filtro de porteros históricos no distingue ausencia de datos: ${leagueKeepers}`);

  await page.selectOption('[data-cm-v519-filter="era"]', 'all');
  await page.selectOption('[data-cm-v519-filter="tournament"]', 'division-one');
  await page.locator('[data-cm-v519-tab="assists"]').click();
  assistValue = await page.locator('[data-cm-v519-panel="assists"] tr', { hasText: 'Asistente A' }).locator('.cm-v519-value').textContent();
  if (assistValue.trim() !== '2') throw new Error(`Filtro por torneo incorrecto: ${assistValue}`);

  await page.selectOption('[data-cm-v519-filter="tournament"]', 'all');
  await page.locator('[data-cm-v519-tab="analysis"]').click();
  await page.waitForSelector('[data-cm-v519-panel="analysis"].active');
  const analysis = await page.evaluate(() => ({
    visible: Boolean(document.querySelector('[data-cm-v519-panel="analysis"].active')?.getClientRects().length),
    chart: Boolean(document.querySelector('.cm-v519-chart svg')),
    h2h: document.querySelectorAll('[data-cm-v519-panel="analysis"] .cm-v519-table').length,
    bars: document.querySelectorAll('.cm-v519-bars > div').length,
    text: document.querySelector('[data-cm-v519-panel="analysis"]')?.innerText || ''
  }));
  if (!analysis.visible || !analysis.chart || analysis.h2h < 2 || analysis.bars !== 7 || !analysis.text.includes('Puntos acumulados') || !analysis.text.includes('Escenarios')) throw new Error(`Análisis histórico incompleto: ${JSON.stringify(analysis)}`);

  const mobile = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
  if (mobile.width > mobile.viewport + 3) throw new Error(`Desborde móvil en Estadísticas: ${JSON.stringify(mobile)}`);

  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|network|message channel|service worker/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));
  await page.evaluate(() => window.ChuteMundoCore.setState(window.__cmV519Original));
  console.log('Chute Mundo v5.19 unified statistics smoke OK', { shell, analysis, mobile });
} finally {
  await context.close();
  await browser.close();
}
