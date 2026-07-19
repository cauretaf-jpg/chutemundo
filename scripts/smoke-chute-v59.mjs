import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteMundoCore && window.ChuteV59 && /^Chute Mundo v5\.(9|10)/.test(document.title));
  await page.click('.nav [data-page="equipos"]');
  await page.waitForFunction(() => document.getElementById('cmV59ProfilesRoot') && document.querySelectorAll('.cm-v59-player-card').length >= 6);

  const profiles = await page.evaluate(() => ({
    version: window.ChuteV59.version,
    players: document.querySelectorAll('.cm-v59-player-card').length,
    teams: window.ChuteMundoCore.getState().teams.length,
    minutes: window.ChuteV59.officialMinutes.length,
    playerApi: typeof window.ChuteV59.playerProfileData,
    teamApi: typeof window.ChuteV59.teamProfileData,
    liveApi: typeof window.ChuteV59.openLiveMatch
  }));
  if (profiles.version !== '5.9.0' || profiles.players < 6 || profiles.teams < 6 || profiles.minutes !== 13 || profiles.playerApi !== 'function' || profiles.teamApi !== 'function' || profiles.liveApi !== 'function') throw new Error(`Centro v5.9 incompleto: ${JSON.stringify(profiles)}`);

  await page.click('.cm-v59-player-card');
  await page.waitForFunction(() => !document.getElementById('modal').hidden && document.querySelectorAll('.cm-v59-profile-metrics article').length >= 8);
  const player = await page.evaluate(() => ({ title: document.querySelector('.cm-v59-profile-modal h2')?.textContent, metrics: document.querySelectorAll('.cm-v59-profile-metrics article').length, tables: document.querySelectorAll('.cm-v59-profile-modal table').length }));
  if (!player.title || player.metrics < 8 || player.tables < 1) throw new Error(`Perfil de jugador incompleto: ${JSON.stringify(player)}`);
  await page.click('[data-close-modal]');

  await page.click('[data-cm-v59-profile-mode="teams"]');
  await page.waitForFunction(() => document.querySelectorAll('.cm-v59-team-card').length >= 6);
  await page.click('.cm-v59-team-card');
  await page.waitForFunction(() => !document.getElementById('modal').hidden && document.querySelector('.cm-v59-team-hero'));
  const team = await page.evaluate(() => ({ metrics: document.querySelectorAll('.cm-v59-profile-metrics article').length, roster: document.querySelectorAll('.cm-v59-roster-list button').length, rivals: document.querySelectorAll('.cm-v59-table-wrap tbody tr').length }));
  if (team.metrics < 8 || team.roster < 10 || team.rivals < 1) throw new Error(`Perfil de equipo incompleto: ${JSON.stringify(team)}`);
  await page.click('[data-close-modal]');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('[data-cm-v59-profile-mode="players"]');
  const mobile = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, width: document.documentElement.scrollWidth, root: Boolean(document.getElementById('cmV59ProfilesRoot')) }));
  if (!mobile.root || mobile.width > mobile.viewport + 3) throw new Error(`Desborde móvil v5.9: ${JSON.stringify(mobile)}`);

  const critical = errors.filter((message) => !/favicon|firestore|permission-denied|Failed to load resource|QUIC_NETWORK|ERR_NAME_NOT_RESOLVED/i.test(message));
  if (critical.length) throw new Error(critical.join(' | '));
  console.log('Chute Mundo v5.9 smoke OK', { profiles, player, team, mobile });
} finally {
  await browser.close();
}