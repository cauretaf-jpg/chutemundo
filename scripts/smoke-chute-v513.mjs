import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteV513Lineups && window.ChuteMundoCore?.getState()?.config?.rosterSchema);
  const result = await page.evaluate(() => {
    const api = window.ChuteV513Lineups;
    const state = window.ChuteMundoCore.getState();
    const team = (id) => state.teams.find((item) => item.id === id);
    const old = {
      config: {},
      teams: [
        { id: 'polpetta', players: [['Rocco Carusso', 'Defensa']] },
        { id: 'perla', players: [['Julio Vega', 'Delantero'], ['Randolph Salazar', 'Medio']] }
      ],
      tournaments: [{ id: 'x', matches: [{ goals: [{ playerName: 'Julio Vega' }], cards: [{ playerName: 'Rocco Carusso' }] }] }]
    };
    const migrated = api.migrateState(old);
    const lineup = { starters: ['Eusebio Flowers', 'Lucius Chase', 'Archie Jackson', 'Steven Ramos'], changes: [{ minute: 20, playerOut: 'Steven Ramos', playerIn: 'Omar Watson' }] };
    return {
      title: document.title,
      version: api.version,
      schema: state.config.rosterSchema,
      counts: Object.fromEntries(['trucha', 'guanaco', 'pantera', 'parrilla', 'perla', 'polpetta'].map((id) => [id, team(id)?.players?.length || 0])),
      starters: Object.fromEntries(['trucha', 'guanaco', 'pantera', 'parrilla', 'perla', 'polpetta'].map((id) => [id, api.defaultStarters(id).length])),
      warner: team('guanaco')?.players?.find((item) => item.name === 'Warner Ferrara'),
      davis: team('guanaco')?.players?.find((item) => item.name === 'Davis Bronson'),
      jackie: team('pantera')?.players?.find((item) => item.name === 'Jackie Sánchez'),
      parrilla20: team('parrilla')?.players?.filter((item) => item.minute === 20).map((item) => item.name),
      perla45: team('perla')?.players?.filter((item) => item.minute === 45).map((item) => item.name),
      migratedNames: migrated.teams.flatMap((item) => item.players.map((player) => player.name)),
      migratedGoal: migrated.tournaments[0].matches[0].goals[0].playerName,
      migratedCard: migrated.tournaments[0].matches[0].cards[0].playerName,
      before20: api.currentLineup(lineup, 10),
      at20: api.currentLineup(lineup, 20),
      width: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth
    };
  });
  const countsOk = JSON.stringify(result.counts) === JSON.stringify({ trucha: 14, guanaco: 14, pantera: 14, parrilla: 14, perla: 15, polpetta: 14 });
  const startersOk = Object.values(result.starters).every((value) => value === 4);
  const namesOk = result.migratedNames.includes('Rocco Caruso') && result.migratedNames.includes('Arnold Vega') && result.migratedNames.includes('Randolf Salazar');
  const positionsOk = result.davis?.position === 'Medio' && result.jackie?.position === 'Medio' && result.warner?.minute === 45;
  const timingOk = result.parrilla20.includes('Nick Cabezón') && result.parrilla20.includes("Randolph D'Luna") && result.perla45.includes('El Kraken');
  const lineupOk = result.before20.includes('Steven Ramos') && !result.before20.includes('Omar Watson') && result.at20.includes('Omar Watson') && !result.at20.includes('Steven Ramos');
  if (!/5\.(13|14|15)/.test(result.title) || result.version !== '5.13.0' || !String(result.schema).includes('chute-pc') || !countsOk || !startersOk || !namesOk || !positionsOk || !timingOk || !lineupOk || result.migratedGoal !== 'Arnold Vega' || result.migratedCard !== 'Rocco Caruso' || result.width > result.viewport + 3) throw new Error(JSON.stringify(result));
  console.log('Chute Mundo v5.13 regression smoke OK', result);
} finally {
  await browser.close();
}
