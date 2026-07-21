const I = window.ChuteV511Internal;
if (!I) throw new Error('Los módulos de Chute Mundo v5.11 no están disponibles.');
const { VERSION, DAILY_BACKUP_KEY, core, nowDate, createBackup, installStyles, installManifest, ensureSearchButton, ensureInstallButton, setInstallPrompt, clearInstallPrompt, promptInstall, applyUpdate, registerServiceWorker, openTournament, openGlobalSearch, renderSearchResults, openAwards, shareResult, shareSchedule, qualityIssues, restoreBackup, downloadBackup, renderBackups, scheduleRefresh, refreshUi, openQualityIssue, openSearchResult, startTournament, finishTournament, randomizeFixture, saveAwards, rememberMatchPair, getLastEditPair } = I;

document.addEventListener('click', (event) => {
  const search = event.target.closest('#cmV511SearchButton');
  if (search) { event.preventDefault(); openGlobalSearch(); return; }
  const install = event.target.closest('#cmV511Install');
  if (install) { event.preventDefault(); void promptInstall(); return; }
  const update = event.target.closest('[data-cm-v511-update]');
  if (update) { event.preventDefault(); applyUpdate(); return; }
  const result = event.target.closest('[data-cm-v511-result]');
  if (result) { event.preventDefault(); openSearchResult(result); return; }
  const random = event.target.closest('[data-cm-v511-random]');
  if (random) { event.preventDefault(); randomizeFixture(random.dataset.cmV511Random); return; }
  const start = event.target.closest('[data-cm-v511-start]');
  if (start) { event.preventDefault(); startTournament(start.dataset.cmV511Start); return; }
  const finish = event.target.closest('[data-cm-v511-finish]');
  if (finish) { event.preventDefault(); finishTournament(finish.dataset.cmV511Finish); return; }
  const schedule = event.target.closest('[data-cm-v511-schedule]');
  if (schedule) { event.preventDefault(); void shareSchedule(schedule.dataset.cmV511Schedule); return; }
  const awards = event.target.closest('[data-cm-v511-awards]');
  if (awards) { event.preventDefault(); openAwards(awards.dataset.cmV511Awards); return; }
  const share = event.target.closest('[data-cm-v511-share-result]');
  if (share) { event.preventDefault(); void shareResult(share.dataset.cmV511ShareResult); return; }
  const team = event.target.closest('[data-cm-v511-team]');
  if (team) { event.preventDefault(); window.ChuteV59?.openTeamProfile?.(team.dataset.cmV511Team); return; }
  const player = event.target.closest('[data-cm-v511-player]');
  if (player) { event.preventDefault(); window.ChuteV59?.openPlayerProfile?.(player.dataset.cmV511Player); return; }
  const tournament = event.target.closest('[data-cm-v511-tournament]');
  if (tournament) { event.preventDefault(); openTournament(tournament.dataset.cmV511Tournament); return; }
  const issueButton = event.target.closest('[data-cm-v511-quality]');
  if (issueButton) {
    event.preventDefault();
    try { openQualityIssue(JSON.parse(issueButton.dataset.cmV511Quality)); } catch { core.showToast('No se pudo abrir el registro afectado.'); }
    return;
  }
  const backupNow = event.target.closest('[data-cm-v511-backup-now]');
  if (backupNow) {
    event.preventDefault();
    void createBackup('Respaldo manual').then(() => { core.showToast('Respaldo creado.'); void renderBackups({ force: true }); });
    return;
  }
  const backupRestore = event.target.closest('[data-cm-v511-backup-restore]');
  if (backupRestore) { event.preventDefault(); void restoreBackup(backupRestore.dataset.cmV511BackupRestore); return; }
  const backupDownload = event.target.closest('[data-cm-v511-backup-download]');
  if (backupDownload) { event.preventDefault(); void downloadBackup(backupDownload.dataset.cmV511BackupDownload); return; }
  rememberMatchPair(event.target);
  window.setTimeout(scheduleRefresh, 0);
}, true);

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    openGlobalSearch();
    return;
  }
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-cm-v511-team], [data-cm-v511-player], [data-cm-v511-tournament]')) {
    event.preventDefault();
    event.target.click();
  }
});

document.addEventListener('submit', (event) => {
  if (event.target.id === 'cmV511AwardsForm') {
    event.preventDefault();
    saveAwards(event.target);
    return;
  }
  const pair = getLastEditPair();
  if (event.target.id === 'resultForm' && pair) {
    const [tournamentId, matchId] = pair.split('__');
    const match = core.tournamentById(tournamentId)?.matches.find((item) => item.id === matchId);
    const time = document.getElementById('matchTime')?.value;
    if (match && time) match.time = time;
  }
}, true);

window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); setInstallPrompt(event); });
window.addEventListener('appinstalled', () => { clearInstallPrompt(); core.showToast('Chute Mundo quedó instalado.'); });
const observed = [document.querySelector('main'), document.getElementById('modal')].filter(Boolean);
observed.forEach((node) => new MutationObserver(scheduleRefresh).observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] }));

installStyles();
installManifest();
ensureSearchButton();
ensureInstallButton();
void registerServiceWorker();
const today = nowDate();
if (localStorage.getItem(DAILY_BACKUP_KEY) !== today) {
  localStorage.setItem(DAILY_BACKUP_KEY, today);
  void createBackup('Respaldo diario automático').catch((error) => console.warn('No se pudo crear el respaldo diario.', error));
}
refreshUi();
window.setInterval(scheduleRefresh, 1800);
window.ChuteV511 = { version: VERSION, createBackup, listBackups: I.listBackups, qualityIssues, randomizeTournamentState: I.randomizeTournamentState, suggestedAwards: I.suggestedAwards, shareResult, shareSchedule, refresh: refreshUi, renderSearchResults };
