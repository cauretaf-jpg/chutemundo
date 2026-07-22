import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteV516EventsStats && window.ChuteV515MatchCenter && window.ChuteMundoCore);

  const pure = await page.evaluate(() => {
    const api = window.ChuteV516EventsStats;
    const source = {
      config: {},
      teams: [
        { id: 'a', name: 'Equipo A', players: [
          { name: 'Arquero A', position: 'Arquero', start: true },
          { name: 'Jugador A', position: 'Defensa', start: true },
          { name: 'Jugador B', position: 'Medio', start: true },
          { name: 'Jugador C', position: 'Delantero', start: true },
          { name: 'Suplente A', position: 'Medio', minute: 20 }
        ] },
        { id: 'b', name: 'Equipo B', players: [
          { name: 'Arquero B', position: 'Arquero', start: true },
          { name: 'Rival A', position: 'Defensa', start: true },
          { name: 'Rival B', position: 'Medio', start: true },
          { name: 'Rival C', position: 'Delantero', start: true }
        ] }
      ],
      friendlies: [],
      tournaments: [{ id: 't', name: 'Play-Off test', matches: [{
        id: 'm', stage: 'knockout', home: 'a', away: 'b', homeGoals: 1, awayGoals: 1,
        shootoutStarted: true, participationTracked: true,
        lineups: {
          home: { starters: ['Arquero A', 'Jugador A', 'Jugador B', 'Jugador C'], changes: [{ id: 'sub', minute: 20, playerOut: 'Jugador A', playerIn: 'Suplente A', createdAt: 20 }] },
          away: { starters: ['Arquero B', 'Rival A', 'Rival B', 'Rival C'], changes: [] }
        },
        goals: [{ id: 'g', side: 'home', teamId: 'a', playerName: 'Jugador A', assistName: 'Jugador B', minute: '10', createdAt: 10 }],
        cards: [{ id: 'c', side: 'home', teamId: 'a', playerName: 'Suplente A', type: 'yellow', minute: '30', createdAt: 30 }],
        penaltyShootout: [{ id: 'p', kind: 'shootout_penalty', side: 'home', teamId: 'a', playerName: 'Suplente A', result: 'scored', order: 1, createdAt: 40 }]
      }] }]
    };
    const starter = api.playerStats('a', 'Jugador A', source);
    const substitute = api.playerStats('a', 'Suplente A', source);
    const goalkeeper = api.playerStats('a', 'Arquero A', source);
    const untrackedSource = JSON.parse(JSON.stringify(source));
    delete untrackedSource.tournaments[0].matches[0].participationTracked;
    const untracked = api.playerStats('a', 'Jugador A', untrackedSource);
    const realState = window.ChuteMundoCore.getState();
    const realTeam = realState.teams.find((team) => (team.players || []).length >= 5);
    const realStarters = realTeam ? window.ChuteV513Lineups.defaultStarters(realTeam.id) : [];
    const options = realTeam ? api.groupedPlayerOptions(realTeam.id, { starters: realStarters, changes: [] }, 0) : '';
    return { version: api.version, venues: api.venues(source), starter, substitute, goalkeeper, untracked, options };
  });

  if (pure.version !== '5.16.1' || !pure.venues.includes("Wladi's House") || !pure.venues.includes("Carlo's House")) throw new Error(`Sedes o versión inválidas: ${JSON.stringify(pure)}`);
  if (pure.starter.appearances !== 1 || pure.starter.minutes !== 20 || pure.starter.substituted !== 1 || pure.starter.goals !== 1 || pure.starter.assists !== 0) throw new Error(`Estadísticas del titular inválidas: ${JSON.stringify(pure.starter)}`);
  if (pure.substitute.appearances !== 1 || pure.substitute.entries !== 1 || pure.substitute.minutes !== 100 || pure.substitute.penaltiesScored !== 1 || pure.substitute.yellows !== 1) throw new Error(`Estadísticas del suplente inválidas: ${JSON.stringify(pure.substitute)}`);
  if (!pure.goalkeeper.goalkeeper || pure.goalkeeper.appearances !== 1 || pure.goalkeeper.minutes !== 0 || pure.goalkeeper.goalsConceded !== 1) throw new Error(`Estadísticas de portero inválidas: ${JSON.stringify(pure.goalkeeper)}`);
  if (pure.untracked.goals !== 1 || pure.untracked.appearances !== 0 || pure.untracked.minutes !== 0 || pure.untracked.substituted !== 0) throw new Error(`La participación histórica se está inventando: ${JSON.stringify(pure.untracked)}`);
  if (!pure.options.includes('optgroup label="EN CANCHA"') || !pure.options.includes('cm-v516-option-field') || !pure.options.includes('selección flexible')) throw new Error('La selección flexible no distingue jugadores en cancha.');

  const pair = await page.evaluate(() => {
    const core = window.ChuteMundoCore;
    core.canEdit = () => true;
    const row = core.getState().tournaments.flatMap((tournament) => (tournament.matches || []).map((match) => ({ tournament, match })))
      .find(({ tournament, match }) => match.stage !== 'bye' && (match.home || core.resolveHome(tournament, match)) && (match.away || core.resolveAway(tournament, match)));
    if (!row) return '';
    window.ChuteV514UnifiedMatch.openUnifiedMatch(row.tournament.id, row.match.id);
    return `${row.tournament.id}__${row.match.id}`;
  });
  if (!pair) throw new Error('No se encontró un partido para validar v5.16.1.');

  await page.waitForSelector('.cm-v516-match-center');
  await page.waitForSelector('[data-cm-v516-goal-minute="home"]');
  await page.waitForSelector('[data-cm-v516-card-minute="home"]');
  await page.waitForSelector('[data-cm-v516-sub-minute="home"]');

  const visual = await page.evaluate(() => {
    const venue = document.getElementById('cmV59Venue');
    const scorer = document.getElementById('cmV59Scorer-home');
    const globalMinute = document.getElementById('cmV59Minute')?.closest('label');
    return {
      title: document.title,
      venueTag: venue?.tagName,
      venues: [...(venue?.options || [])].map((option) => option.value),
      addVenue: Boolean(document.querySelector('[data-cm-v516-add-venue]')),
      goalMinutes: document.querySelectorAll('[data-cm-v516-goal-minute]').length,
      cardMinutes: document.querySelectorAll('[data-cm-v516-card-minute]').length,
      subMinutes: document.querySelectorAll('[data-cm-v516-sub-minute]').length,
      groups: [...(scorer?.querySelectorAll('optgroup') || [])].map((group) => group.label),
      onFieldOptions: scorer?.querySelectorAll('.cm-v516-option-field').length || 0,
      globalMinuteHidden: globalMinute ? getComputedStyle(globalMinute).display === 'none' : false,
      legacyPenaltyHidden: [...document.querySelectorAll('.cm-v516-legacy-pens-hidden')].every((item) => getComputedStyle(item).display === 'none'),
      undoUnified: Boolean(document.querySelector('[data-cm-v516-undo]')) && !document.querySelector('[data-cm-v59-undo]'),
      width: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth
    };
  });
  if (!/5\.(16|17|18)/.test(visual.title) || visual.venueTag !== 'SELECT' || !visual.venues.includes("Wladi's House") || !visual.venues.includes("Carlo's House") || !visual.addVenue || visual.goalMinutes !== 2 || visual.cardMinutes !== 2 || visual.subMinutes !== 2 || !visual.groups.includes('EN CANCHA') || visual.onFieldOptions < 4 || !visual.globalMinuteHidden || !visual.legacyPenaltyHidden || !visual.undoUnified || visual.width > visual.viewport + 3) throw new Error(`Interfaz v5.16 inválida: ${JSON.stringify(visual)}`);

  const playerKey = await page.evaluate(() => {
    const core = window.ChuteMundoCore;
    const team = core.getState().teams.find((item) => item.players?.length);
    const player = team?.players?.[0];
    const name = Array.isArray(player) ? player[0] : player?.name;
    if (!team || !name) return '';
    window.ChuteV59.openPlayerProfile(`${team.id}__${encodeURIComponent(name)}`);
    return `${team.id}__${encodeURIComponent(name)}`;
  });
  if (!playerKey) throw new Error('No se encontró jugador para validar perfil.');
  await page.waitForSelector('.cm-v516-stats-note');
  const profile = await page.evaluate(() => ({ text: document.querySelector('.cm-v59-profile-modal')?.textContent || '', metrics: document.querySelectorAll('.cm-v59-profile-metrics article').length }));
  if (profile.text.includes('Titularidades') || !profile.text.includes('Partidos jugados') || profile.metrics < 7) throw new Error(`Perfil estadístico inválido: ${JSON.stringify(profile)}`);

  await page.locator('[data-close-modal]').first().click();
  await page.waitForFunction(() => document.getElementById('modal')?.hidden === true);
  await page.evaluate(() => window.ChuteMundoCore.navigate('estadisticas'));
  await page.waitForSelector('#cmV518Stats');
  const statsPage = await page.evaluate(() => ({ text: document.getElementById('cmV518Stats')?.innerText || '', width: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
  if (!statsPage.text.includes('Datos disponibles') || !statsPage.text.includes('Era de divisiones') || statsPage.width > statsPage.viewport + 3) throw new Error(`Centro estadístico superior inválido: ${JSON.stringify(statsPage)}`);

  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|network/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));
  console.log('Chute Mundo v5.16.1 regression smoke OK', { pure, visual, profile, statsPage });
} finally {
  await browser.close();
}
