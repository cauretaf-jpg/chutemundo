import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteMundoCore && window.ChuteV524Tournaments && window.ChuteVersion?.bootCompleted);

  await page.evaluate(() => {
    const core = window.ChuteMundoCore;
    window.__cmV524Original = structuredClone(core.getState());
    core.isAdmin = () => true;
    core.canEdit = () => true;
    core.saveCloud = async () => true;
    const teams = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: `Equipo ${id.toUpperCase()}`, initials: id.toUpperCase(), players: [] }));
    const match = (id, played = true) => ({ id, stage: 'regular', round: 'Fecha 1', home: 'a', away: 'b', homeGoals: played ? 1 : null, awayGoals: played ? 0 : null });
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
    core.setState({ ...core.getState(), teams, tournaments: [...historical, ...upcoming, active] });
    core.navigate('torneos');
    window.ChuteV524Tournaments.render();
  });

  await page.waitForSelector('#cmV524CreateToggle', { state: 'visible' });
  await page.waitForSelector('#cmV524ActiveTournament', { state: 'visible' });
  const summary = await page.locator('#cmV524TournamentSummary').innerText();
  if (!summary.includes('En juego') || !summary.includes('Próximos') || !summary.includes('Finalizados')) throw new Error(`Resumen incompleto: ${summary}`);
  const activeText = await page.locator('#cmV524ActiveTournament').innerText();
  if (!activeText.includes('Temporada Actual') || !activeText.includes('1/2 partidos') || !activeText.includes('Continuar torneo')) throw new Error(`Competición actual incompleta: ${activeText}`);

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

  let cards = await page.locator('#tournamentList > .cm-v524-tournament-card').count();
  if (cards !== 3) throw new Error(`El móvil debe mostrar 3 torneos inicialmente, mostró ${cards}.`);
  await page.locator('#cmV524ShowMore').click();
  cards = await page.locator('#tournamentList > .cm-v524-tournament-card').count();
  if (cards !== 6) throw new Error(`Ver más debía mostrar 6 torneos, mostró ${cards}.`);
  await page.locator('#cmV524ShowLess').click();
  cards = await page.locator('#tournamentList > .cm-v524-tournament-card').count();
  if (cards !== 3) throw new Error(`Ver menos debía volver a 3 torneos, mostró ${cards}.`);

  await page.fill('#cmV524TournamentSearch', 'Histórico 8');
  await page.waitForFunction(() => document.querySelectorAll('#tournamentList > .cm-v524-tournament-card').length === 1);
  const searched = await page.locator('#tournamentList').innerText();
  if (!searched.includes('Torneo Histórico 8')) throw new Error(`La búsqueda no encontró el torneo esperado: ${searched}`);
  await page.locator('#cmV524ClearFilters').click();
  await page.selectOption('#tournamentStatusFilter', 'upcoming');
  await page.waitForFunction(() => document.querySelectorAll('#tournamentList > .cm-v524-tournament-card').length === 2);
  const upcomingText = await page.locator('#tournamentList').innerText();
  if (!upcomingText.includes('Próximo Torneo 1') || upcomingText.includes('Torneo Histórico')) throw new Error(`El filtro de próximos falló: ${upcomingText}`);

  const mobile = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth, title: document.title }));
  if (mobile.width > mobile.viewport + 3) throw new Error(`Desborde móvil en v5.24: ${JSON.stringify(mobile)}`);
  if (!mobile.title.includes('5.24.0')) throw new Error(`La versión visible no es v5.24.0: ${mobile.title}`);

  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|network|service worker/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));
  await page.evaluate(() => window.ChuteMundoCore.setState(window.__cmV524Original));
  console.log('Chute Mundo v5.24 tournament organization smoke OK', { summary, activeText, mobile });
} finally {
  await context.close();
  await browser.close();
}
