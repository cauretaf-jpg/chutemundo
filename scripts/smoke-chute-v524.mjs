import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteMundoCore && window.ChuteV524Tournaments && window.ChuteV5241HistoryCollapse && window.ChuteV5242UiFixes && window.ChuteVersion?.bootCompleted);

  await page.evaluate(() => {
    const core = window.ChuteMundoCore;
    window.__cmV524Original = structuredClone(core.getState());
    core.isAdmin = () => true;
    core.canEdit = () => true;
    core.saveCloud = async () => true;
    const teams = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: `Equipo ${id.toUpperCase()}`, initials: id.toUpperCase(), players: [] }));
    const participants = [
      { id: 'participante_alvaro', name: 'Álvaro', color: '#e74c3c', defaultSide: 'home', archived: false },
      { id: 'participante_carlos', name: 'Carlos', color: '#3498db', defaultSide: 'away', archived: false }
    ];
    const match = (id, isPlayed = true) => ({ id, stage: 'regular', round: 'Fecha 1', home: 'a', away: 'b', homeGoals: isPlayed ? 1 : null, awayGoals: isPlayed ? 0 : null, participantHome: 'participante_alvaro', participantAway: 'participante_carlos' });
    const historical = Array.from({ length: 8 }, (_, index) => ({
      id: `hist-${index + 1}`,
      name: `Torneo Histórico ${index + 1}`,
      type: index % 2 ? 'cup_groups' : 'league',
      status: 'historical',
      endDate: `202${index % 6}-0${index % 9 + 1}-0${index % 8 + 1}`,
      teamIds: teams.map((team) => team.id),
      champion: 'a',
      matches: [match(`hm-${index + 1}`)]
    }));
    const upcoming = [1, 2].map((index) => ({ id: `next-${index}`, name: `Próximo Torneo ${index}`, type: index === 1 ? 'division_season' : 'direct_knockout', status: 'upcoming', startDate: `2027-0${index}-01`, teamIds: teams.map((team) => team.id), matches: [match(`nm-${index}`, false)] }));
    const active = { id: 'active', name: 'Temporada Actual', type: 'division_season', status: 'active', startDate: '2026-08-01', teamIds: teams.map((team) => team.id), matches: [match('am-1'), match('am-2', false)] };
    core.setState({ ...core.getState(), teams, participants, tournaments: [...historical, ...upcoming, active] });
    core.navigate('torneos');
    window.ChuteV524Tournaments.render();
    window.ChuteV5241HistoryCollapse.render();
    window.ChuteV5242UiFixes.refresh();
  });

  await page.waitForSelector('#cmV524CreateToggle', { state: 'visible' });
  await page.waitForSelector('#cmV524ActiveTournament', { state: 'visible' });
  await page.waitForSelector('#cmV5241UpcomingPanel', { state: 'visible' });
  await page.waitForSelector('#cmV5241ArchiveGate', { state: 'visible' });

  const summary = await page.locator('#cmV524TournamentSummary').innerText();
  if (!summary.includes('En juego') || !summary.includes('Próximos') || !summary.includes('Finalizados')) throw new Error(`Resumen incompleto: ${summary}`);
  const activeText = await page.locator('#cmV524ActiveTournament').innerText();
  if (!activeText.includes('Temporada Actual') || !activeText.includes('1/2 partidos') || !activeText.includes('Continuar torneo')) throw new Error(`Competición actual incompleta: ${activeText}`);
  const upcomingText = await page.locator('#cmV5241UpcomingPanel').innerText();
  if (!upcomingText.includes('Próximo Torneo 1') || !upcomingText.includes('Próximo Torneo 2') || upcomingText.includes('Torneo Histórico')) throw new Error(`Próximos torneos incompletos: ${upcomingText}`);

  if (await page.locator('#cmV524HistoryPanel').isVisible()) throw new Error('Los torneos anteriores deben comenzar ocultos.');
  const archiveButtonText = await page.locator('#cmV5241ArchiveToggle').innerText();
  if (!archiveButtonText.includes('Ver torneos anteriores (8)')) throw new Error(`Botón del archivo incorrecto: ${archiveButtonText}`);

  if (await page.locator('#cmV524CreatePanel').isVisible()) throw new Error('Crear torneo debe comenzar cerrado.');
  await page.locator('#cmV524CreateToggle').click();
  await page.waitForSelector('#cmV524CreatePanel', { state: 'visible' });
  await page.fill('#tournamentName', 'Prueba sin guardar');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.locator('#cmV524CreateToggle').click();
  if (!(await page.locator('#cmV524CreatePanel').isVisible())) throw new Error('El formulario se cerró pese a cancelar la confirmación.');
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#cmV524CancelCreate').click();
  await page.waitForSelector('#cmV524CreatePanel', { state: 'hidden' });

  await page.locator('#cmV5241ArchiveToggle').click();
  await page.waitForSelector('#cmV524HistoryPanel', { state: 'visible' });
  if (!(await page.locator('#cmV5241ArchiveToggle').innerText()).includes('Ocultar torneos anteriores')) throw new Error('El botón no cambió al estado de cierre.');

  let cards = await page.locator('#tournamentList > .cm-v524-tournament-card').count();
  if (cards !== 3) throw new Error(`El archivo móvil debe mostrar 3 torneos inicialmente, mostró ${cards}.`);
  const initialArchive = await page.locator('#tournamentList').innerText();
  if (initialArchive.includes('Próximo Torneo')) throw new Error(`El archivo mezcló próximos torneos: ${initialArchive}`);

  await page.locator('#cmV524ShowMore').click();
  cards = await page.locator('#tournamentList > .cm-v524-tournament-card').count();
  if (cards !== 6) throw new Error(`Ver más debía mostrar 6 torneos anteriores, mostró ${cards}.`);
  await page.locator('#cmV524ShowLess').click();
  cards = await page.locator('#tournamentList > .cm-v524-tournament-card').count();
  if (cards !== 3) throw new Error(`Ver menos debía volver a 3 torneos anteriores, mostró ${cards}.`);

  await page.fill('#cmV524TournamentSearch', 'Histórico 8');
  await page.waitForFunction(() => document.querySelectorAll('#tournamentList > .cm-v524-tournament-card').length === 1);
  const searched = await page.locator('#tournamentList').innerText();
  if (!searched.includes('Torneo Histórico 8')) throw new Error(`La búsqueda no encontró el torneo esperado: ${searched}`);
  await page.locator('#cmV524ClearFilters').click();
  await page.locator('#cmV5241ArchiveToggle').click();
  await page.waitForSelector('#cmV524HistoryPanel', { state: 'hidden' });

  await page.locator('#cmV524ActiveTournament [data-open-tournament="active"]').click();
  await page.waitForSelector('#cmTournamentHub [data-v511-tools]', { state: 'visible' });
  await page.evaluate(() => window.ChuteV5242UiFixes.refresh());
  const toolbar = await page.evaluate(() => {
    const tools = document.querySelector('#cmTournamentHub [data-v511-tools]');
    const visible = (selector) => {
      const element = tools?.querySelector(selector);
      return Boolean(element && !element.hidden && element.getClientRects().length);
    };
    return {
      random: visible('[data-v511-random]'),
      start: visible('[data-v511-start]'),
      finish: visible('[data-cm-v517-finish]'),
      quality: visible('[data-cm-v517-quality]'),
      schedule: visible('[data-v511-schedule]'),
      finishText: tools?.querySelector('[data-cm-v517-finish]')?.textContent || '',
      visibleButtons: [...tools.querySelectorAll('button')].filter((button) => !button.hidden && button.getClientRects().length).length
    };
  });
  if (toolbar.random || toolbar.start || toolbar.quality || !toolbar.finish || !toolbar.schedule || toolbar.visibleButtons !== 2 || !toolbar.finishText.includes('Revisar torneo')) throw new Error(`Barra contextual incorrecta: ${JSON.stringify(toolbar)}`);

  await page.evaluate(() => window.ChuteMundoCore.navigate('estadisticas'));
  await page.waitForSelector('#cmV521History', { state: 'visible' });
  await page.waitForSelector('[data-cm-v523-tab="participants"]');
  await page.locator('[data-cm-v523-tab="participants"]').click();
  await page.waitForSelector('[data-cm-v523-panel="participants"].active', { state: 'visible' });
  const participantState = await page.evaluate(() => ({
    title: document.querySelector('[data-cm-v523-panel="participants"]')?.textContent || '',
    visiblePanels: [...document.querySelectorAll('#cmV521History [data-cm-v521-panel]')].filter((panel) => !panel.hidden && panel.getClientRects().length).length
  }));
  if (!participantState.title.includes('La Liga de los Participantes') || participantState.visiblePanels !== 1) throw new Error(`Participantes no quedó aislado: ${JSON.stringify(participantState)}`);

  const nativeTab = page.locator('#cmV521History [data-cm-v521-tab]:not([data-cm-v523-tab])').first();
  await nativeTab.click();
  await page.waitForFunction(() => {
    const panel = document.querySelector('[data-cm-v523-panel="participants"]');
    return panel?.hidden && !panel.classList.contains('active') && panel.getClientRects().length === 0;
  });
  const nativeState = await page.evaluate(() => ({
    participantVisible: document.querySelector('[data-cm-v523-panel="participants"]')?.getClientRects().length > 0,
    visiblePanels: [...document.querySelectorAll('#cmV521History [data-cm-v521-panel]')].filter((panel) => !panel.hidden && panel.getClientRects().length).length
  }));
  if (nativeState.participantVisible || nativeState.visiblePanels !== 1) throw new Error(`Participantes siguió visible en otra pestaña: ${JSON.stringify(nativeState)}`);

  const mobile = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth, title: document.title }));
  if (mobile.width > mobile.viewport + 3) throw new Error(`Desborde móvil en regresión v5.24.2: ${JSON.stringify(mobile)}`);
  if (!mobile.title.includes('5.25.0')) throw new Error(`La versión visible no es v5.25.0: ${mobile.title}`);

  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|network|service worker/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));
  await page.evaluate(() => window.ChuteMundoCore.setState(window.__cmV524Original));
  console.log('Chute Mundo v5.24.2 regression smoke OK on v5.25.0', { summary, activeText, upcomingText, toolbar, participantState, nativeState, mobile });
} finally {
  await context.close();
  await browser.close();
}