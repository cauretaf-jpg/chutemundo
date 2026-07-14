import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push(`console: ${message.text()}`);
});

try {
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => Boolean(window.ChuteMundoCore && window.ChuteDetailModel && window.ChuteDetailUI && window.ChuteDetailEvents && window.ChuteGroupEditor), null, { timeout: 60_000 });
  await page.waitForTimeout(1500);

  const summary = await page.evaluate(() => {
    const state = window.ChuteMundoCore.getState();
    const serialized = JSON.stringify(state);
    const restored = window.ChuteMundoCore.normalizeState(serialized);
    return {
      version: window.ChuteMundoCore.version,
      uiVersion: document.querySelector('.hero .eyebrow')?.textContent || '',
      teams: state.teams.length,
      tournaments: state.tournaments.length,
      players: state.teams.reduce((sum, team) => sum + (team.players?.length || 0), 0),
      playerNav: Boolean(document.querySelector('[data-page="jugadores"]')),
      disciplineNav: Boolean(document.querySelector('[data-page="disciplina"]')),
      teamCards: document.querySelectorAll('.cm-team-card').length,
      serializedType: typeof serialized,
      restoredTeams: restored.teams.length,
      restoredTournaments: restored.tournaments.length,
      serializedBytes: new Blob([serialized]).size
    };
  });

  if (summary.version !== '4.0.1') throw new Error(`Versión del núcleo incorrecta: ${summary.version}`);
  if (!summary.uiVersion.includes('4.1.0')) throw new Error(`Versión visual incorrecta: ${summary.uiVersion}`);
  if (summary.teams < 6) throw new Error(`Equipos insuficientes: ${summary.teams}`);
  if (summary.tournaments < 7) throw new Error(`Torneos insuficientes: ${summary.tournaments}`);
  if (summary.players < 80) throw new Error(`Jugadores insuficientes: ${summary.players}`);
  if (!summary.playerNav || !summary.disciplineNav) throw new Error('Faltan páginas detalladas.');
  if (summary.teamCards < 6) throw new Error('No se renderizaron las fichas de equipos.');
  if (summary.serializedType !== 'string') throw new Error('El estado Firebase no se serializó como texto.');
  if (summary.restoredTeams !== summary.teams || summary.restoredTournaments !== summary.tournaments) throw new Error('El estado JSON no se restauró correctamente.');
  if (summary.serializedBytes >= 950_000) throw new Error(`El estado está demasiado cerca del límite de Firestore: ${summary.serializedBytes} bytes.`);

  await page.evaluate(() => window.ChuteMundoCore.navigate('administracion'));
  await page.waitForSelector('#cmDiagnosticsPanel');
  const buttonStability = await page.evaluate(async () => {
    const original = document.getElementById('cmRefreshDiagnostics');
    const panel = document.getElementById('cmDiagnosticsPanel');
    let mutationCount = 0;
    const observer = new MutationObserver((mutations) => { mutationCount += mutations.length; });
    observer.observe(panel, { childList: true, subtree: true, characterData: true });
    await new Promise((resolve) => setTimeout(resolve, 700));
    observer.disconnect();
    return {
      sameButton: original === document.getElementById('cmRefreshDiagnostics'),
      mutationCount
    };
  });
  if (!buttonStability.sameButton) throw new Error('El botón de diagnóstico fue reemplazado continuamente.');
  if (buttonStability.mutationCount > 12) throw new Error(`El panel de diagnóstico continúa en un ciclo de renderizado: ${buttonStability.mutationCount} mutaciones.`);

  await page.click('#cmRefreshDiagnostics');
  await page.waitForFunction(() => document.getElementById('cmDiagnosticResult')?.textContent.includes('Diagnóstico actualizado'), null, { timeout: 5_000 });

  await page.evaluate(() => {
    window.ChuteMundoCore.navigate('torneos');
    const adminPanel = document.querySelector('#torneos .admin-only');
    if (adminPanel) adminPanel.hidden = false;
    const type = document.getElementById('tournamentType');
    type.value = 'cup_groups';
    type.dispatchEvent(new Event('change', { bubbles: true }));
    const inputs = Array.from(document.querySelectorAll('#teamPicker input')).slice(0, 6);
    inputs.forEach((input) => { input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); });
  });
  await page.waitForFunction(() => !document.getElementById('cmCupGroupEditor')?.hidden && document.querySelectorAll('.cm-group-team').length === 6, null, { timeout: 5_000 });

  const initialGroups = await page.evaluate(() => window.ChuteGroupEditor.getGroups());
  if (initialGroups.A.length !== 3 || initialGroups.B.length !== 3) throw new Error(`Distribución automática incorrecta: ${JSON.stringify(initialGroups)}`);
  if (!await page.locator('.cm-group-team').first().getAttribute('draggable')) throw new Error('Los equipos no están habilitados para arrastrar.');

  const draggedId = await page.locator('[data-group-list="A"] .cm-group-team').first().getAttribute('data-team-id');
  await page.locator(`[data-group-list="A"] .cm-group-team[data-team-id="${draggedId}"]`).dragTo(page.locator('[data-group-list="B"]'));
  await page.waitForFunction(() => window.ChuteGroupEditor.getGroups().A.length === 2 && window.ChuteGroupEditor.getGroups().B.length === 4);
  const unbalanced = await page.evaluate(() => window.ChuteGroupEditor.validation());
  if (unbalanced.valid) throw new Error('El editor aceptó grupos desequilibrados.');

  await page.evaluate((movedId) => {
    const groups = window.ChuteGroupEditor.getGroups();
    const returnId = groups.B.find((teamId) => teamId !== movedId);
    document.querySelector(`[data-move-team="${CSS.escape(returnId)}"]`)?.click();
  }, draggedId);
  await page.waitForFunction(() => window.ChuteGroupEditor.validation().valid);

  const customGroups = await page.evaluate(() => window.ChuteGroupEditor.getGroups());
  const expectedOrder = [];
  for (let index = 0; index < Math.max(customGroups.A.length, customGroups.B.length); index += 1) {
    if (customGroups.A[index]) expectedOrder.push(customGroups.A[index]);
    if (customGroups.B[index]) expectedOrder.push(customGroups.B[index]);
  }
  const orderedForGenerator = await page.evaluate(() => {
    document.getElementById('tournamentForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    return Array.from(document.querySelectorAll('#teamPicker input:checked')).map((input) => input.value);
  });
  if (JSON.stringify(orderedForGenerator) !== JSON.stringify(expectedOrder)) {
    throw new Error(`El generador recibió un orden distinto a los grupos elegidos. Esperado ${JSON.stringify(expectedOrder)}, recibido ${JSON.stringify(orderedForGenerator)}.`);
  }

  await page.evaluate(() => window.ChuteMundoCore.navigate('jugadores'));
  await page.waitForSelector('.cm-player-card', { timeout: 10_000 });
  if (await page.locator('.cm-player-card').count() < 80) throw new Error('No se renderizaron las fichas de jugadores.');

  const matchContext = await page.evaluate(() => {
    const tournament = window.ChuteMundoCore.getState().tournaments.find((item) => item.matches?.length);
    const match = tournament?.matches.find((item) => {
      const home = window.ChuteMundoCore.resolveHome(tournament, item);
      const away = window.ChuteMundoCore.resolveAway(tournament, item);
      return home && away;
    });
    return tournament && match ? { tournamentId: tournament.id, matchId: match.id } : null;
  });
  if (!matchContext) throw new Error('No hay partido resoluble para probar.');
  await page.evaluate(({ tournamentId, matchId }) => window.ChuteDetailEvents.openDetailedMatch(tournamentId, matchId), matchContext);
  await page.waitForSelector('.cm-match-editor');
  for (const selector of ['[data-cm-add-goal="home"]', '[data-cm-add-goal="away"]', '[data-cm-add-card="home"]', '[data-cm-add-card="away"]', '#cmMatchDate', '#cmMatchTime', '#cmMatchVenue']) {
    if (!(await page.locator(selector).count())) throw new Error(`Falta control: ${selector}`);
  }

  const critical = pageErrors.filter((message) => !/favicon|ERR_BLOCKED_BY_CLIENT|QUIC_NETWORK_IDLE_TIMEOUT/i.test(message));
  if (critical.length) throw new Error(`Errores de página: ${critical.join(' | ')}`);
  console.log('Smoke OK', { ...summary, buttonStability, customGroups, orderedForGenerator });
} finally {
  await browser.close();
}
