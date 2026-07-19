import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteMundoCore && window.ChuteV510Dashboard && window.ChuteV510Safety);
  await page.waitForFunction(() => document.getElementById('cmV510Journey') && document.getElementById('cmV510SafetyCenter'));
  const result = await page.evaluate(() => {
    const core = window.ChuteMundoCore;
    const safety = window.ChuteV510Safety;
    const source = JSON.parse(JSON.stringify(core.getState()));
    const testTournament = { id: 'tour_v510_test', name: 'Torneo temporal v5.10', type: 'league', status: 'upcoming', createdAt: 'Prueba', config: { legs: 1 }, teamIds: source.teams.slice(0, 2).map((team) => team.id), groups: [], matches: [], notes: [], manualStandings: [], playerScorers: [], playerAssists: [], champion: null, runnerUp: null, third: null };
    source.tournaments.push(testTournament);
    const trashed = safety.moveTournamentToTrashState(source, testTournament.id, { now: 1000, actor: 'Prueba automatica', device: 'Navegador' });
    const entry = trashed.trash.tournaments.find((item) => item.tournament.id === testTournament.id);
    const restored = safety.restoreTournamentState(trashed, entry.id, { actor: 'Prueba automatica', device: 'Navegador' });
    return { dashboardVersion: window.ChuteV510Dashboard.version, safetyVersion: safety.version, journey: Boolean(document.getElementById('cmV510Journey')), safety: Boolean(document.getElementById('cmV510SafetyCenter')), moved: !trashed.tournaments.some((item) => item.id === testTournament.id) && Boolean(entry), retained: entry.expiresAt - entry.deletedAt === 30 * 24 * 60 * 60 * 1000, restored: restored.tournaments.some((item) => item.id === testTournament.id) && !restored.trash.tournaments.some((item) => item.id === entry.id), viewport: document.documentElement.clientWidth, width: document.documentElement.scrollWidth };
  });
  if (result.dashboardVersion !== '5.10.0' || result.safetyVersion !== '5.10.0' || !result.journey || !result.safety || !result.moved || !result.retained || !result.restored || result.width > result.viewport + 3) throw new Error(`Centro v5.10 incompleto: ${JSON.stringify(result)}`);
  await page.click('.nav [data-page="administracion"]');
  const adminWidth = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, width: document.documentElement.scrollWidth }));
  if (adminWidth.width > adminWidth.viewport + 3) throw new Error(`Desborde administrativo: ${JSON.stringify(adminWidth)}`);
  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));
  console.log('Chute Mundo v5.10 smoke OK', { result, adminWidth });
} finally {
  await browser.close();
}