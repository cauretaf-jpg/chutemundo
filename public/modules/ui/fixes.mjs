const core = window.ChuteMundoCore;
if (!core) throw new Error('Chute Mundo no está listo para las correcciones v5.24.2.');

const VERSION = '5.24.2';
let refreshQueued = false;

function loadStyles() {
  if (document.getElementById('cmV5242UiFixesStyles')) return;
  const link = document.createElement('link');
  link.id = 'cmV5242UiFixesStyles';
  link.rel = 'stylesheet';
  link.href = `/chute-v5242-ui-fixes.css?v=${VERSION}`;
  document.head.appendChild(link);
}

function tournamentFromHub() {
  const hub = document.getElementById('cmTournamentHub');
  const id = hub?.dataset.tournamentId || '';
  return (core.getState?.().tournaments || []).find((item) => item.id === id) || null;
}

function setVisible(element, visible) {
  if (!element) return;
  const hidden = !visible;
  if (element.hidden !== hidden) element.hidden = hidden;
  const aria = visible ? 'false' : 'true';
  if (element.getAttribute('aria-hidden') !== aria) element.setAttribute('aria-hidden', aria);
}

function qualityCounts(tournament) {
  try {
    const issues = window.ChuteV517Finalization?.qualityIssues?.(tournament) || [];
    return {
      critical: issues.filter((item) => item.level === 'critical').length,
      warnings: issues.filter((item) => item.level === 'warning').length
    };
  } catch {
    return { critical: 0, warnings: 0 };
  }
}

function syncTournamentToolbar() {
  const hub = document.getElementById('cmTournamentHub');
  const tools = hub?.querySelector('[data-v511-tools]');
  const tournament = tournamentFromHub();
  if (!tools || !tournament) return;

  const random = tools.querySelector('[data-v511-random]');
  const start = tools.querySelector('[data-v511-start]');
  const finish = tools.querySelector('[data-cm-v517-finish], [data-v511-finish]');
  const quality = tools.querySelector('[data-cm-v517-quality]');
  const schedule = tools.querySelector('[data-v511-schedule]');
  const upcoming = tournament.status === 'upcoming';
  const active = tournament.status === 'active';

  setVisible(random, upcoming);
  setVisible(start, upcoming);
  setVisible(schedule, true);

  if (finish?.hasAttribute('data-v511-finish')) {
    finish.removeAttribute('data-v511-finish');
    finish.dataset.cmV517Finish = '';
  }

  if (quality) {
    quality.dataset.cmV5242Redundant = '';
    setVisible(quality, false);
  }

  setVisible(finish, active);
  if (finish && active) {
    const { critical, warnings } = qualityCounts(tournament);
    finish.disabled = !core.canEdit?.();
    finish.classList.toggle('danger', critical > 0);
    finish.classList.toggle('primary', critical === 0);
    const text = critical > 0
      ? `✓ Revisar torneo · ${critical} bloqueos`
      : warnings > 0
        ? `✓ Revisar y finalizar · ${warnings} avisos`
        : '✓ Revisar y finalizar torneo';
    const title = critical > 0
      ? 'Abre el control de calidad. El torneo no puede finalizar mientras existan bloqueos.'
      : 'Abre la revisión final antes de cerrar el torneo.';
    if (finish.textContent !== text) finish.textContent = text;
    if (finish.title !== title) finish.title = title;
  }

  tools.dataset.cmV5242Toolbar = tournament.status;
}

function participantElements() {
  const host = document.getElementById('cmV521History');
  return {
    host,
    tab: host?.querySelector('[data-cm-v523-tab="participants"]') || null,
    panel: host?.querySelector('[data-cm-v523-panel="participants"]') || null
  };
}

function ensureParticipantPanel() {
  const { tab, panel } = participantElements();
  if (!tab || !panel) return false;
  panel.dataset.cmV521Panel = 'participants';
  panel.setAttribute('role', 'tabpanel');
  tab.setAttribute('role', 'tab');
  tab.setAttribute('aria-controls', 'cmV5242ParticipantsPanel');
  panel.id = 'cmV5242ParticipantsPanel';
  return true;
}

function activateParticipants() {
  if (!ensureParticipantPanel()) return;
  const { host, tab, panel } = participantElements();
  host.querySelectorAll('[data-cm-v521-tab], [data-cm-v523-tab]').forEach((button) => {
    const active = button === tab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  host.querySelectorAll('[data-cm-v521-panel]').forEach((item) => {
    const active = item === panel;
    item.classList.toggle('active', active);
    setVisible(item, active);
  });
  localStorage.setItem('cm_v523_stats_tab', 'participants');
}

function deactivateParticipants() {
  const { tab, panel } = participantElements();
  if (tab) {
    tab.classList.remove('active');
    tab.setAttribute('aria-selected', 'false');
  }
  if (panel) {
    panel.classList.remove('active');
    setVisible(panel, false);
  }
  localStorage.removeItem('cm_v523_stats_tab');
}

function syncStatsTabs() {
  if (!ensureParticipantPanel()) return;
  const { host, tab, panel } = participantElements();
  const nativeActive = host.querySelector('[data-cm-v521-tab].active:not([data-cm-v523-tab])');
  if (nativeActive) {
    deactivateParticipants();
    return;
  }
  if (tab.classList.contains('active') || localStorage.getItem('cm_v523_stats_tab') === 'participants') {
    activateParticipants();
    return;
  }
  panel.classList.remove('active');
  setVisible(panel, false);
}

function refresh() {
  refreshQueued = false;
  syncTournamentToolbar();
  syncStatsTabs();
}

function scheduleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(refresh);
}

document.addEventListener('click', (event) => {
  const participantTab = event.target.closest?.('[data-cm-v523-tab="participants"]');
  if (participantTab) {
    event.preventDefault();
    event.stopImmediatePropagation();
    activateParticipants();
    return;
  }
  const nativeStatsTab = event.target.closest?.('#cmV521History [data-cm-v521-tab]:not([data-cm-v523-tab])');
  if (nativeStatsTab) {
    deactivateParticipants();
    requestAnimationFrame(syncStatsTabs);
  }
  setTimeout(scheduleRefresh, 40);
}, true);

new MutationObserver(scheduleRefresh).observe(document.body, {
  childList: true,
  subtree: true
});

document.addEventListener('chute:ready', scheduleRefresh);
loadStyles();
scheduleRefresh();

window.ChuteV5242UiFixes = Object.freeze({
  version: VERSION,
  refresh,
  syncTournamentToolbar,
  syncStatsTabs,
  activateParticipants,
  deactivateParticipants
});