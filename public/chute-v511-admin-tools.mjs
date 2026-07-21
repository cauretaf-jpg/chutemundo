const I = window.ChuteV511Internal;
if (!I) throw new Error('El núcleo de Chute Mundo v5.11 no está disponible.');
const { core, esc, clone, state, playerKey, nowDate, nowTime, MAX_BACKUPS, createBackup, listBackups, originalSetState, openTournament, openMatch, qualityIssues, qualitySignature, qualityMarkup } = I;
let refreshQueued = false;
let backupSignature = '';

function formatBackupDate(value) {
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

async function renderBackups({ force = false } = {}) {
  const root = document.getElementById('cmV511Backups');
  if (!root) return;
  try {
    const rows = await listBackups();
    const signature = JSON.stringify([core.canEdit(), rows.map((row) => [row.id, row.at, row.reason, row.bytes, row.appVersion])]);
    if (!force && signature === backupSignature && root.children.length) return;
    backupSignature = signature;
    root.innerHTML = `<header><div><p class="eyebrow">RESPALDOS AUTOMÁTICOS</p><h2>Versiones de la base</h2><p>Se guarda una copia local antes de cambios importantes. Se conservan las últimas ${MAX_BACKUPS} versiones de este dispositivo.</p></div><button type="button" data-cm-v511-backup-now ${core.canEdit() ? '' : 'disabled'}>Crear respaldo ahora</button></header>${rows.length ? `<div class="cm-v511-backup-list">${rows.map((row) => `<article><div><strong>${esc(row.reason)}</strong><small>${esc(formatBackupDate(row.at))} · ${(row.bytes / 1024).toFixed(1)} KB · v${esc(row.appVersion)}</small></div><div><button type="button" data-cm-v511-backup-download="${esc(row.id)}">Descargar</button><button type="button" data-cm-v511-backup-restore="${esc(row.id)}" ${core.canEdit() ? '' : 'disabled'}>Restaurar</button></div></article>`).join('')}</div>` : '<div class="cm-v511-empty"><strong>Sin versiones todavía</strong><span>La primera copia se creará antes del próximo cambio.</span></div>'}`;
  } catch (error) {
    root.innerHTML = `<div class="cm-v511-empty"><strong>No se pudieron leer los respaldos</strong><span>${esc(error.message || 'Error local')}</span></div>`;
  }
}

function ensureAdminSections() {
  const page = document.getElementById('administracion');
  if (!page) return;
  let backups = document.getElementById('cmV511Backups');
  if (!backups) {
    backups = document.createElement('section');
    backups.id = 'cmV511Backups';
    backups.className = 'cm-v511-admin-section';
    page.appendChild(backups);
    void renderBackups({ force: true });
  }
  const issues = qualityIssues();
  const signature = qualitySignature(issues);
  let qualityRoot = document.getElementById('cmV511Quality');
  if (!qualityRoot) {
    const holder = document.createElement('div');
    holder.innerHTML = qualityMarkup(issues);
    page.appendChild(holder.firstElementChild);
  } else if (qualityRoot.dataset.cmV511QualitySignature !== signature) qualityRoot.outerHTML = qualityMarkup(issues);
}

function markInteractive(element, datasetName, value) {
  if (!element || !value) return;
  element.dataset[datasetName] = value;
  element.classList.add('cm-v511-link');
  element.tabIndex = 0;
}

function decorateHistoricalLinks() {
  document.querySelectorAll('#globalTable tbody tr').forEach((row) => {
    const cell = row.cells?.[1];
    const team = (state().teams || []).find((item) => item.name === cell?.textContent.trim());
    markInteractive(cell, 'cmV511Team', team?.id);
  });
  document.querySelectorAll('#topScorers tbody tr, #topAssists tbody tr').forEach((row) => {
    const name = row.cells?.[1]?.textContent.trim();
    const teamNameText = row.cells?.[2]?.textContent.trim();
    const team = (state().teams || []).find((item) => item.name === teamNameText);
    if (team && name) markInteractive(row.cells?.[1], 'cmV511Player', playerKey(team.id, name));
    markInteractive(row.cells?.[2], 'cmV511Team', team?.id);
  });
  document.querySelectorAll('#tournamentStats tbody tr').forEach((row) => {
    const tournament = (state().tournaments || []).find((item) => item.name === row.cells?.[0]?.textContent.trim());
    markInteractive(row.cells?.[0], 'cmV511Tournament', tournament?.id);
  });
  document.querySelectorAll('#honoursList .rank-row strong, #homeRanking .rank-row strong').forEach((element) => {
    const team = (state().teams || []).find((item) => item.name === element.textContent.trim());
    markInteractive(element, 'cmV511Team', team?.id);
  });
}

function fillDefaultDateTime() {
  const date = document.getElementById('matchDate');
  if (date && !date.value) date.value = nowDate();
  const liveDate = document.getElementById('cmV59Date');
  if (liveDate && !liveDate.value) liveDate.value = nowDate();
  const liveTime = document.getElementById('cmV59Time');
  if (liveTime && !liveTime.value) liveTime.value = nowTime();
  const form = document.getElementById('resultForm');
  if (form && !document.getElementById('matchTime')) {
    const dateLabel = date?.closest('label');
    const label = document.createElement('label');
    label.textContent = 'Hora';
    const input = document.createElement('input');
    input.id = 'matchTime';
    input.type = 'time';
    input.value = nowTime();
    label.appendChild(input);
    dateLabel?.insertAdjacentElement('afterend', label);
  }
}

function refreshUi() {
  refreshQueued = false;
  I.ensureInstallButton();
  I.ensureSearchButton();
  I.enhanceTournamentFlow?.();
  I.enhanceMatchCards?.();
  ensureAdminSections();
  decorateHistoricalLinks();
  fillDefaultDateTime();
  const heroVersion = document.querySelector('.hero .eyebrow');
  if (heroVersion) heroVersion.textContent = 'CHUTE MUNDO v5.11';
  document.title = 'Chute Mundo v5.11 · Competición oficial';
}

function scheduleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(refreshUi);
}

async function restoreBackup(id) {
  const record = (await listBackups()).find((item) => item.id === id);
  if (!record) return core.showToast('El respaldo ya no existe.');
  if (!window.confirm(`Se restaurará la versión de ${formatBackupDate(record.at)}. ¿Continuar?`)) return;
  const previous = clone(state());
  try {
    const restored = core.normalizeState(JSON.parse(record.state));
    await createBackup('Antes de restaurar una versión', previous);
    core.setState(restored);
    await core.saveCloud();
    core.showToast('Versión restaurada y sincronizada.');
    backupSignature = '';
    scheduleRefresh();
    void renderBackups({ force: true });
  } catch (error) {
    I.setInternalStateWrite(true);
    originalSetState(previous);
    I.setInternalStateWrite(false);
    core.showToast(`No se pudo restaurar: ${error.message || 'error desconocido'}.`);
  }
}

async function downloadBackup(id) {
  const record = (await listBackups()).find((item) => item.id === id);
  if (!record) return core.showToast('El respaldo ya no existe.');
  const blob = new Blob([record.state], { type: 'application/json' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `chute-mundo-respaldo-${new Date(record.at).toISOString().replace(/[:.]/g, '-')}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
}

function openQualityIssue(issue) {
  if (!issue) return;
  if (issue.matchId) openMatch(issue.tournamentId, issue.matchId);
  else if (issue.tournamentId) openTournament(issue.tournamentId);
}

Object.assign(I, { formatBackupDate, renderBackups, ensureAdminSections, decorateHistoricalLinks, fillDefaultDateTime, refreshUi, scheduleRefresh, restoreBackup, downloadBackup, openQualityIssue });
