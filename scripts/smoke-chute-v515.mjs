import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteV515MatchCenter && window.ChuteV514UnifiedMatch && window.ChuteV513Lineups && window.ChuteMundoCore);

  const pure = await page.evaluate(() => {
    const api = window.ChuteV515MatchCenter;
    const match = {
      goals: [], cards: [], specialEvents: [],
      lineups: {
        home: { starters: ['Arquero A', 'Jugador A', 'Jugador B', 'Jugador C'], changes: [{ id: 'sub_test', minute: 20, playerOut: 'Jugador A', playerIn: 'Jugador D', createdAt: 20 }] },
        away: { starters: [], changes: [] }
      }
    };
    const synced = api.syncSubstitutionEvents(match, 'trucha', 'pantera');
    const events = api.unifiedEvents({ match, home: 'trucha', away: 'pantera' });
    return { version: api.version, synced, special: match.specialEvents[0], events };
  });
  if (pure.version !== '5.15.0' || !pure.synced || pure.special?.kind !== 'substitution' || pure.special?.playerIn !== 'Jugador D' || pure.events.filter((event) => event.kind === 'substitution').length !== 1) {
    throw new Error(`Sincronización de cambios inválida: ${JSON.stringify(pure)}`);
  }

  const pair = await page.evaluate(() => {
    const core = window.ChuteMundoCore;
    core.canEdit = () => true;
    core.saveCloud = async () => {};
    core.persistLocal = () => {};
    const row = core.getState().tournaments.flatMap((tournament) => (tournament.matches || []).map((match) => ({ tournament, match })))
      .find(({ tournament, match }) => match.stage !== 'bye' && (match.home || core.resolveHome(tournament, match)) && (match.away || core.resolveAway(tournament, match)));
    if (!row) return '';
    window.ChuteV514UnifiedMatch.openUnifiedMatch(row.tournament.id, row.match.id);
    return `${row.tournament.id}__${row.match.id}`;
  });
  if (!pair) throw new Error('No se pudo preparar un partido para la prueba v5.15.');

  await page.waitForSelector('.cm-v59-live.cm-v515-match-center');
  await page.waitForSelector('#cmV513Lineups.cm-v515-lineups');
  await page.evaluate(() => {
    const minute = document.getElementById('cmV59Minute');
    minute.value = '45';
    minute.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelector('[data-cm-v515-substitute], [data-cm-v516-substitute]') && !document.querySelector('[data-cm-v514-substitute]'));

  const side = await page.evaluate(() => {
    for (const value of ['home', 'away']) {
      const outSelect = document.querySelector(`[data-cm-v513-out="${value}"]`);
      const inSelect = document.querySelector(`[data-cm-v513-in="${value}"]`);
      if (!outSelect?.options.length || !inSelect?.options.length) continue;
      outSelect.value = outSelect.options[0].value;
      inSelect.value = inSelect.options[0].value;
      return value;
    }
    return '';
  });
  if (!side) throw new Error('No hubo una sustitución habilitada al minuto 45.');

  await page.evaluate(async ({ pair, side }) => {
    await window.ChuteV515MatchCenter.registerSubstitution(pair, side);
  }, { pair, side });

  await page.waitForSelector('.cm-v59-live.cm-v515-match-center');
  await page.waitForSelector('#cmV513Lineups.cm-v515-lineups');
  await page.waitForSelector('.cm-v515-timeline-event.is-substitution');
  await page.waitForFunction(() => document.querySelector('[data-cm-v515-substitute], [data-cm-v516-substitute]') && !document.querySelector('[data-cm-v514-substitute]'));

  const visual = await page.evaluate(() => {
    const lineup = document.getElementById('cmV513Lineups');
    const style = getComputedStyle(lineup);
    const event = document.querySelector('.cm-v515-timeline-event.is-substitution');
    const undo = document.querySelector('[data-cm-v59-undo], [data-cm-v516-undo]');
    const live = document.querySelector('[data-cm-v59-live-pair]');
    const [tournamentId, matchId] = String(live?.dataset.cmV59LivePair || '').split('__');
    const tournament = window.ChuteMundoCore.getState().tournaments.find((item) => item.id === tournamentId);
    const match = tournament?.matches?.find((item) => item.id === matchId);
    return {
      title: document.title,
      background: style.backgroundColor,
      color: style.color,
      playerCards: document.querySelectorAll('.cm-v515-player-slot').length,
      waitingChips: document.querySelectorAll('.cm-v515-waiting-chips i').length,
      eventText: event?.textContent || '',
      timelineCount: document.querySelector('.cm-v515-timeline>header>span')?.textContent || '',
      persistedEvent: (match?.specialEvents || []).some((item) => item.kind === 'substitution' && item.playerIn && item.playerOut),
      persistedChange: ['home', 'away'].some((value) => (match?.lineups?.[value]?.changes || []).length > 0),
      undoEnabled: Boolean(undo && !undo.disabled),
      button: document.querySelector('[data-cm-v515-substitute], [data-cm-v516-substitute]')?.textContent.trim(),
      width: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth
    };
  });

  const readable = visual.background === 'rgb(245, 250, 247)' && visual.color === 'rgb(16, 32, 25)';
  if (!/5\.(15|16|17|18)/.test(visual.title) || !readable || visual.playerCards < 8 || !visual.eventText.includes('ENTRA') || !visual.eventText.includes('SALE') || !visual.timelineCount.includes('evento') || !visual.persistedEvent || !visual.persistedChange || !visual.undoEnabled || visual.button !== 'Confirmar cambio' || visual.width > visual.viewport + 3) {
    throw new Error(`Centro de partido v5.15 inválido: ${JSON.stringify(visual)}`);
  }

  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));
  console.log('Chute Mundo v5.15 regression smoke OK', { pure, visual });
} finally {
  await browser.close();
}
