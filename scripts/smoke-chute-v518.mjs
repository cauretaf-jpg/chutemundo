import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteV518EraStats && window.ChuteMundoCore && window.ChuteV516EventsStats);

  const setup = await page.evaluate(() => {
    const core = window.ChuteMundoCore;
    const api = window.ChuteV518EraStats;
    const original = structuredClone(core.getState());
    window.__cmV518Original = original;
    const teams = original.teams.slice(0, 2);
    if (teams.length < 2 || teams.some((team) => (team.players || []).length < 4)) return { error: 'Faltan equipos con plantel.' };
    const name = (entry) => Array.isArray(entry) ? entry[0] : entry.name;
    const names = teams.map((team) => team.players.map(name));
    const baseMatch = (id, extras = {}) => ({
      id, stage: 'regular', round: 'Fecha 1', label: 'Partido 1', home: teams[0].id, away: teams[1].id,
      homeGoals: 1, awayGoals: 0, goals: [], cards: [], specialEvents: [], date: '2026-08-01', venue: "Wladi's House", ...extras
    });
    const state = {
      ...original,
      tournaments: [
        { id: 'era-old', name: '7mo Torneo - Liga', type: 'league', status: 'historical', teamIds: teams.map((team) => team.id), matches: [baseMatch('old-match')], playerScorers: [], playerAssists: [] },
        { id: 'era-cutoff', name: '8vo Torneo - Copa', type: 'cup_groups', status: 'active', teamIds: teams.map((team) => team.id), matches: [baseMatch('cutoff-match')], playerScorers: [], playerAssists: [] },
        { id: 'era-division', name: '1ra Temporada de Divisiones', type: 'division_final', status: 'active', teamIds: teams.map((team) => team.id), matches: [baseMatch('division-match', {
          goals: [{ id: 'goal-v518', side: 'home', teamId: teams[0].id, playerName: names[0][1], assistName: '', minute: '20' }],
          participationTracked: true,
          lineups: {
            home: { goalkeeper: names[0][0], starters: names[0].slice(0, 4), changes: [] },
            away: { goalkeeper: names[1][0], starters: names[1].slice(0, 4), changes: [] }
          }
        })], playerScorers: [], playerAssists: [] }
      ]
    };
    const migrated = api.migrateState(state);
    const eras = migrated.tournaments.map((tournament) => [tournament.id, tournament.eraId]);
    const coverage = Object.fromEntries(migrated.tournaments.map((tournament) => [tournament.id, tournament.coverage]));
    const incomplete = structuredClone(migrated.tournaments[2]);
    incomplete.matches[0].participationTracked = false;
    incomplete.matches[0].lineups = null;
    const issues = api.divisionsCriticalIssues(incomplete);
    core.setState(migrated);
    return { eras, coverage, issues, scorer: names[0][1] };
  });
  if (setup.error) throw new Error(setup.error);
  if (JSON.stringify(setup.eras) !== JSON.stringify([['era-old','leagues'],['era-cutoff','leagues'],['era-division','divisions']])) throw new Error(`Corte de eras incorrecto: ${JSON.stringify(setup.eras)}`);
  if (setup.coverage['era-cutoff'].scorers !== 'none' || setup.coverage['era-cutoff'].lineups !== 'none') throw new Error(`La ausencia histórica se convirtió en cero/completo: ${JSON.stringify(setup.coverage['era-cutoff'])}`);
  if (setup.coverage['era-division'].scorers !== 'complete' || setup.coverage['era-division'].assists !== 'complete' || setup.coverage['era-division'].lineups !== 'complete') throw new Error(`Cobertura moderna incompleta: ${JSON.stringify(setup.coverage['era-division'])}`);
  if (!setup.issues.some((issue) => /alineación|participación/i.test(issue))) throw new Error(`No se bloquea el cierre incompleto: ${JSON.stringify(setup.issues)}`);

  await page.waitForTimeout(300);
  await page.evaluate(() => window.ChuteMundoCore.navigate('estadisticas'));
  await page.waitForFunction(() => document.getElementById('estadisticas')?.hidden === false && document.getElementById('cmV518Stats')?.getClientRects().length > 0);
  await page.waitForSelector('[data-cm-v518-panel="summary"].active');
  const initial = await page.evaluate(() => ({
    tabs: document.querySelectorAll('[data-cm-v518-tab]').length,
    filters: document.querySelectorAll('[data-cm-v518-filter]').length,
    oldHidden: [...document.querySelectorAll('#estadisticas > .cm-v518-source-hidden')].every((element) => getComputedStyle(element).display === 'none'),
    title: document.title,
    width: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth
  }));
  if (initial.tabs !== 6 || initial.filters !== 3 || !initial.oldHidden || !initial.title.includes('5.18') || initial.width > initial.viewport + 3) throw new Error(`Centro estadístico incompleto: ${JSON.stringify(initial)}`);

  await page.selectOption('[data-cm-v518-filter="era"]', 'leagues');
  await page.locator('[data-cm-v518-tab="tournaments"]').click();
  await page.waitForSelector('[data-cm-v518-panel="tournaments"].active');
  const leagues = await page.evaluate(() => ({
    text: document.querySelector('[data-cm-v518-panel="tournaments"]')?.textContent || '',
    options: [...document.querySelector('[data-cm-v518-filter="tournament"]').options].map((option) => option.textContent)
  }));
  if (!leagues.text.includes('Sin registro') || leagues.options.some((name) => /Divisiones/i.test(name))) throw new Error(`Filtro de Era de ligas inválido: ${JSON.stringify(leagues)}`);

  await page.selectOption('[data-cm-v518-filter="era"]', 'divisions');
  await page.locator('[data-cm-v518-tab="players"]').click();
  await page.waitForSelector('[data-cm-v518-panel="players"].active');
  const divisions = await page.evaluate((scorer) => ({
    text: document.querySelector('[data-cm-v518-panel="players"]')?.textContent || '',
    scorerVisible: [...document.querySelectorAll('[data-cm-v518-panel="players"] tbody tr')].some((row) => row.textContent.includes(scorer)),
    eraNote: document.querySelector('[data-cm-v518-era-note]')?.textContent || ''
  }), setup.scorer);
  if (!divisions.scorerVisible || !divisions.text.includes('Métricas modernas') || !divisions.eraNote.includes('Era de divisiones')) throw new Error(`Vista moderna inválida: ${JSON.stringify(divisions)}`);

  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|network/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));
  await page.evaluate(() => window.ChuteMundoCore.setState(window.__cmV518Original));
  console.log('Chute Mundo v5.18 smoke OK', { initial, leagues, divisions, coverage: setup.coverage });
} finally {
  await browser.close();
}
