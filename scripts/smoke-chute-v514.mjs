import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ChuteV514UnifiedMatch && window.ChuteV513Lineups && window.ChuteMundoCore);
  await page.evaluate(() => window.ChuteMundoCore.navigate('partidos'));
  await page.waitForFunction(() => !document.getElementById('partidos')?.hidden && document.querySelector('[data-cm-v52-open-match]'));
  await page.waitForFunction(() => {
    const buttons = [...document.querySelectorAll('[data-cm-v52-open-match], [data-cm-hub-match]')];
    return buttons.length > 0 && buttons.every((button) => button.textContent.trim() === 'Ver partido') && !document.querySelector('[data-edit-match]');
  });

  const initial = await page.evaluate(() => {
    const hiddenLegacy = [...document.querySelectorAll('.cm-v59-live-launch, .cm-v591-live-access, #cmV591LivePanel')]
      .every((element) => getComputedStyle(element).display === 'none');
    const api = window.ChuteV514UnifiedMatch;
    const lineupOut = {
      starters: ['Eddy Pino', 'Donald Ortega', 'Ricky Watkins', 'Wilfredo Fernández'],
      changes: [{ minute: 20, playerOut: 'Donald Ortega', playerIn: 'Dino Richi', createdAt: 1 }]
    };
    const eligibleAfterExit = api.eligiblePlayers('trucha', lineupOut, 30).map((entry) => entry.name || entry[0]);
    const lineupReturn = {
      ...lineupOut,
      changes: [...lineupOut.changes, { minute: 30, playerOut: 'Dino Richi', playerIn: 'Donald Ortega', createdAt: 2 }]
    };
    return {
      title: document.title,
      version: api.version,
      hiddenLegacy,
      buttonText: document.querySelector('[data-cm-v52-open-match]')?.textContent.trim(),
      editButtons: document.querySelectorAll('[data-edit-match]').length,
      canReenter: eligibleAfterExit.includes('Donald Ortega'),
      fieldAfterReturn: api.currentLineup(lineupReturn, 30),
      width: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth
    };
  });

  if (!/5\.(14|15)/.test(initial.title) || initial.version !== '5.14.0' || initial.buttonText !== 'Ver partido' || initial.editButtons !== 0 || !initial.hiddenLegacy || !initial.canReenter || !initial.fieldAfterReturn.includes('Donald Ortega') || initial.fieldAfterReturn.includes('Dino Richi') || initial.width > initial.viewport + 3) {
    throw new Error(`Estado unificado inválido: ${JSON.stringify(initial)}`);
  }

  await page.locator('[data-cm-v52-open-match]').first().click();
  await page.waitForSelector('.cm-match-editor.cm-v514-readonly');
  const readonly = await page.evaluate(() => ({
    notice: Boolean(document.querySelector('.cm-v514-readonly-notice')),
    entriesHidden: [...document.querySelectorAll('.cm-v514-readonly .cm-event-entry')].every((element) => getComputedStyle(element).display === 'none'),
    inputsDisabled: [...document.querySelectorAll('.cm-v514-readonly input, .cm-v514-readonly select')].every((element) => element.disabled)
  }));
  if (!readonly.notice || !readonly.entriesHidden || !readonly.inputsDisabled) throw new Error(`Vista pública editable: ${JSON.stringify(readonly)}`);

  await page.locator('[data-close-modal]').click();
  const adminPair = await page.evaluate(() => {
    const core = window.ChuteMundoCore;
    core.canEdit = () => true;
    const row = core.getState().tournaments.flatMap((tournament) => (tournament.matches || []).map((match) => ({ tournament, match })))
      .find(({ tournament, match }) => match.stage !== 'bye' && (match.home || core.resolveHome(tournament, match)) && (match.away || core.resolveAway(tournament, match)));
    if (!row) return '';
    window.ChuteV514UnifiedMatch.openUnifiedMatch(row.tournament.id, row.match.id);
    return `${row.tournament.id}__${row.match.id}`;
  });
  if (!adminPair) throw new Error('No se encontró un partido resuelto para probar la vista administradora.');
  await page.waitForSelector('.cm-v59-live.cm-v514-unified-live');
  await page.waitForSelector('#cmV513Lineups');
  await page.waitForFunction(() => document.querySelector('[data-cm-v514-substitute], [data-cm-v515-substitute]'));

  const admin = await page.evaluate(() => ({
    unified: Boolean(document.querySelector('.cm-v514-unified-badge')),
    detailedEditor: Boolean(document.querySelector('.cm-match-editor')),
    substitutionButton: Boolean(document.querySelector('[data-cm-v514-substitute], [data-cm-v515-substitute]')),
    oldSubstitutionButton: Boolean(document.querySelector('[data-cm-v513-substitute]')),
    polished: Boolean(document.querySelector('.cm-v515-lineups')) || !window.ChuteV515MatchCenter,
    width: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth
  }));
  if (!admin.unified || admin.detailedEditor || !admin.substitutionButton || admin.oldSubstitutionButton || !admin.polished || admin.width > admin.viewport + 3) {
    throw new Error(`Vista administradora no unificada: ${JSON.stringify(admin)}`);
  }

  console.log('Chute Mundo v5.14 regression smoke OK', { initial, readonly, admin });
} finally {
  await browser.close();
}
