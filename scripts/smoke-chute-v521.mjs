import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteMundoCore && window.ChuteV521History && window.ChuteV517Finalization && window.ChuteVersion?.bootCompleted);

  await page.evaluate(() => {
    const core = window.ChuteMundoCore;
    window.__cmV521Original = structuredClone(core.getState());
    const original = core.getState();
    const teams = [
      { id: 'a', name: 'Atlético A', initials: 'ATA', players: [
        { name: 'Arquero A', position: 'Arquero' }, { name: 'Goleador A', position: 'Delantero' },
        { name: 'Asistente A', position: 'Medio' }, { name: 'Defensa A', position: 'Defensa' }
      ] },
      { id: 'b', name: 'Barrio B', initials: 'BRB', players: [
        { name: 'Arquero B', position: 'Arquero' }, { name: 'Delantero B', position: 'Delantero' },
        { name: 'Medio B', position: 'Medio' }, { name: 'Defensa B', position: 'Defensa' }
      ] },
      { id: 'c', name: 'Ciudad C', initials: 'CDC', players: [
        { name: 'Arquero C', position: 'Arquero' }, { name: 'Delantero C', position: 'Delantero' },
        { name: 'Medio C', position: 'Medio' }, { name: 'Defensa C', position: 'Defensa' }
      ] }
    ];
    const lineup = (names) => ({ starters: names, changes: [] });
    const tournaments = [
      {
        id: 't1', name: '8vo Torneo - Copa', type: 'cup_groups', status: 'historical', eraId: 'leagues', champion: 'a', runnerUp: 'b', third: 'c', teamIds: ['a', 'b', 'c'],
        awardsStatus: 'official',
        awardDetails: {
          scorer: { playerName: 'Goleador A', teamId: 'a', title: 'Goleador' },
          assist: { playerName: 'Asistente A', teamId: 'a', title: 'Máximo asistidor' },
          mvp: { playerName: 'Goleador A', teamId: 'a', title: 'Mejor jugador' },
          goalkeeper: { playerName: 'Arquero B', teamId: 'b', title: 'Mejor arquero' }
        },
        playerScorers: [['Goleador A', 'a', 2, 3]], playerAssists: [['Asistente A', 'a', 2, 2]],
        matches: [
          { id: 'm1', stage: 'regular', home: 'a', away: 'b', homeGoals: 2, awayGoals: 1, date: '2026-01-01', venue: 'Cancha Uno', participationTracked: true,
            lineups: { home: lineup(['Arquero A', 'Goleador A', 'Asistente A', 'Defensa A']), away: lineup(['Arquero B', 'Delantero B', 'Medio B', 'Defensa B']) },
            goals: [
              { id: 'g1', side: 'home', teamId: 'a', playerName: 'Goleador A', assistName: 'Asistente A', minute: '10' },
              { id: 'g2', side: 'home', teamId: 'a', playerName: 'Goleador A', assistName: 'Asistente A', minute: '30' },
              { id: 'g3', side: 'away', teamId: 'b', playerName: 'Delantero B', assistName: '', minute: '60' }
            ] },
          { id: 'm2', stage: 'knockout', round: '3er Lugar', home: 'b', away: 'c', homeGoals: 0, awayGoals: 0, homePens: 4, awayPens: 3, date: '2026-01-02', venue: 'Cancha Dos', participationTracked: true,
            lineups: { home: lineup(['Arquero B', 'Delantero B', 'Medio B', 'Defensa B']), away: lineup(['Arquero C', 'Delantero C', 'Medio C', 'Defensa C']) }, goals: [] }
        ]
      },
      { id: 't2', name: 'Primera División', type: 'division_season', status: 'active', eraId: 'divisions', teamIds: ['a', 'c'],
        matches: [{ id: 'm3', stage: 'regular', home: 'a', away: 'c', homeGoals: 1, awayGoals: 1, date: '2026-07-20', venue: 'Cancha Central', participationTracked: true,
          lineups: { home: lineup(['Arquero A', 'Goleador A', 'Asistente A', 'Defensa A']), away: lineup(['Arquero C', 'Delantero C', 'Medio C', 'Defensa C']) },
          goals: [
            { id: 'g4', side: 'home', teamId: 'a', playerName: 'Goleador A', assistName: 'Asistente A', minute: '12' },
            { id: 'g5', side: 'away', teamId: 'c', playerName: 'Delantero C', assistName: 'Medio C', minute: '70' }
          ] }] }
    ];
    core.setState({ ...original, teams, tournaments, friendlies: [], participants: original.participants || [], activity: original.activity || [] });
    core.navigate('estadisticas');
  });

  await page.waitForSelector('#cmV521History', { state: 'visible' });
  await page.waitForSelector('[data-cm-v521-panel="eternal"].active');
  const shell = await page.evaluate(() => ({
    version: window.ChuteV521History.version,
    title: document.title,
    tabs: [...document.querySelectorAll('[data-cm-v521-tab]')].map((button) => button.textContent.trim()),
    filters: document.querySelectorAll('[data-cm-v521-filter]').length,
    text: document.getElementById('cmV521History')?.innerText || ''
  }));
  if (shell.version !== '5.21.0' || !shell.title.includes('5.21.0') || shell.tabs.length !== 6 || shell.filters !== 5) throw new Error(`Estructura v5.21 inválida: ${JSON.stringify(shell)}`);
  for (const label of ['La Tabla Eterna', 'Rankings Históricos', 'Salón de la Gloria', 'Archivo de Campeones', 'Libro de Récords', 'Historia Frente a Frente']) if (!shell.text.includes(label)) throw new Error(`Falta ${label}.`);

  const eternal = page.locator('[data-cm-v521-panel="eternal"] tr', { hasText: 'Atlético A' });
  if ((await eternal.count()) !== 1 || !(await eternal.innerText()).includes('4')) throw new Error(`La Tabla Eterna no acumuló 4 puntos para Atlético A: ${await eternal.innerText()}`);

  await page.locator('[data-cm-v521-tab="rankings"]').click();
  await page.waitForSelector('[data-cm-v521-panel="rankings"].active');
  const scorerRow = page.locator('[data-cm-v521-ranking-panel="goals"] tr', { hasText: 'Goleador A' });
  if ((await scorerRow.count()) !== 1 || !(await scorerRow.innerText()).includes('4')) throw new Error(`Goleadores acumulados incorrectos: ${await scorerRow.innerText()}`);
  await page.locator('[data-cm-v521-ranking="assists"]').click();
  const assistRow = page.locator('[data-cm-v521-ranking-panel="assists"] tr', { hasText: 'Asistente A' });
  if ((await assistRow.count()) !== 1 || !(await assistRow.innerText()).includes('3')) throw new Error(`Asistencias acumuladas incorrectas: ${await assistRow.innerText()}`);
  await page.locator('[data-cm-v521-ranking="keepers"]').click();
  const keeperText = await page.locator('[data-cm-v521-ranking-panel="keepers"]').innerText();
  if (!keeperText.includes('Arquero B') || !keeperText.includes('Las Fortalezas Defensivas')) throw new Error(`Ranking de porteros incompleto: ${keeperText}`);

  await page.locator('[data-cm-v521-tab="honours"]').click();
  const honoursText = await page.locator('[data-cm-v521-panel="honours"]').innerText();
  if (!honoursText.includes('Bota de Oro') || !honoursText.includes('Balón de Oro del Torneo') || !honoursText.includes('Atlético A')) throw new Error(`Palmarés incompleto: ${honoursText}`);

  await page.locator('[data-cm-v521-tab="archive"]').click();
  const archiveText = await page.locator('[data-cm-v521-panel="archive"]').innerText();
  if (!archiveText.includes('8vo Torneo - Copa') || !archiveText.includes('Atlético A') || !archiveText.includes('Barrio B') || !archiveText.includes('Ciudad C')) throw new Error(`Archivo de Campeones incompleto: ${archiveText}`);

  await page.selectOption('[data-cm-v521-filter="era"]', 'divisions');
  await page.locator('[data-cm-v521-tab="eternal"]').click();
  const divisionText = await page.locator('[data-cm-v521-panel="eternal"]').innerText();
  if (!divisionText.includes('Atlético A') || !divisionText.includes('Ciudad C') || divisionText.includes('Barrio B')) throw new Error(`Filtro por era incorrecto: ${divisionText}`);

  await page.selectOption('[data-cm-v521-filter="era"]', 'all');
  await page.selectOption('[data-cm-v521-filter="tournament"]', 't1');
  const t1Text = await page.locator('[data-cm-v521-panel="eternal"]').innerText();
  if (!t1Text.includes('Atlético A') || !t1Text.includes('3')) throw new Error(`Filtro por torneo incorrecto: ${t1Text}`);

  await page.selectOption('[data-cm-v521-filter="tournament"]', 'all');
  await page.locator('[data-cm-v521-tab="records"]').click();
  const recordsText = await page.locator('[data-cm-v521-panel="records"]').innerText();
  if (!recordsText.includes('Más puntos históricos') || !recordsText.includes('Mayor goleada') || !recordsText.includes('Jugador más premiado')) throw new Error(`Libro de Récords incompleto: ${recordsText}`);

  await page.locator('[data-cm-v521-tab="h2h"]').click();
  await page.selectOption('[data-cm-v521-h2h="a"]', 'a');
  await page.selectOption('[data-cm-v521-h2h="b"]', 'b');
  const h2hText = await page.locator('[data-cm-v521-panel="h2h"]').innerText();
  if (!h2hText.includes('Atlético A') || !h2hText.includes('Barrio B') || !h2hText.includes('2–1')) throw new Error(`Frente a Frente incompleto: ${h2hText}`);

  const mobile = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
  if (mobile.width > mobile.viewport + 3) throw new Error(`Desborde móvil en Archivo Histórico: ${JSON.stringify(mobile)}`);

  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|network|service worker/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));
  await page.evaluate(() => window.ChuteMundoCore.setState(window.__cmV521Original));
  console.log('Chute Mundo v5.21 historical center smoke OK', { shell, mobile });
} finally {
  await context.close();
  await browser.close();
}
