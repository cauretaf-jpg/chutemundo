function waitForCore() {
  if (window.ChuteMundoCore) return Promise.resolve(window.ChuteMundoCore);
  return new Promise((resolve) => document.addEventListener('chute:ready', (event) => resolve(event.detail), { once: true }));
}

const core = await waitForCore();
const model = window.ChuteDetailModel;
if (!model) throw new Error('El modelo detallado no está disponible para el centro de seguridad.');

const { esc } = model;
const VERSION = '5.10.0';
const RETENTION_DAYS = 30;
const UNDO_KEY = 'chute_mundo_v510_last_undo';
const originalSetState = core.setState.bind(core);
let restoring = false;
let saving = false;
let refreshQueued = false;
let lastSignature = '';
let lastTransition = null;

const clone = (value) => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const isProtected = (tournament) => Boolean(tournament?.protected === true || /^t\d+$/i.test(String(tournament?.id || '')));
const actor = () => core.authUser?.email || 'Administrador';
const device = () => /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'Móvil' : 'Escritorio';

function installStyles() {
  if (document.getElementById('cmV510Styles')) return;
  const link = document.createElement('link');
  link.id = 'cmV510Styles';
  link.rel = 'stylesheet';
  link.href = `/chute-v510.css?v=${VERSION}`;
  document.head.appendChild(link);
}

function ensureTrash(targetState) {
  targetState.trash = targetState.trash && typeof targetState.trash === 'object' ? targetState.trash : {};
  targetState.trash.tournaments = Array.isArray(targetState.trash.tournaments) ? targetState.trash.tournaments : [];
  return targetState.trash.tournaments;
}

function addActivity(targetState, text, type = 'administration', metadata = {}) {
  targetState.activity = Array.isArray(targetState.activity) ? targetState.activity : [];
  targetState.activity.unshift({
    id: core.uid('activity'),
    text,
    type,
    actor: metadata.actor || actor(),
    device: metadata.device || device(),
    at: metadata.at || Date.now(),
    ...metadata
  });
  targetState.activity = targetState.activity.slice(0, 100);
}

function deletionGuard(sourceState, tournament) {
  if (!tournament) return { allowed: false, reason: 'El torneo ya no existe.' };
  if (isProtected(tournament)) return { allowed: false, reason: 'Los torneos del historial oficial están protegidos.' };
  if (tournament.type === 'division_season') {
    const number = Number(tournament.config?.seasonNumber || 0);
    const later = (sourceState.tournaments || []).find((item) => item.type === 'division_season' && Number(item.config?.seasonNumber || 0) > number);
    if (later) return { allowed: false, reason: `No se puede retirar porque “${later.name}” es una temporada posterior.` };
  }
  return { allowed: true, reason: '' };
}

function moveTournamentToTrashState(sourceState, tournamentId, metadata = {}) {
  const next = clone(sourceState);
  const index = (next.tournaments || []).findIndex((item) => item.id === tournamentId);
  const tournament = index >= 0 ? next.tournaments[index] : null;
  const guard = deletionGuard(next, tournament);
  if (!guard.allowed) throw new Error(guard.reason);
  const now = Number(metadata.now || Date.now());
  next.tournaments.splice(index, 1);
  const trash = ensureTrash(next);
  trash.unshift({
    id: core.uid('trash'),
    tournament,
    originalIndex: index,
    deletedAt: now,
    expiresAt: now + RETENTION_DAYS * 24 * 60 * 60 * 1000,
    deletedBy: metadata.actor || actor(),
    device: metadata.device || device()
  });
  addActivity(next, `Se envió el torneo ${tournament.name} a la papelera.`, 'tournament_trash', { actor: metadata.actor, device: metadata.device, tournamentId, at: now });
  return next;
}

function restoreTournamentState(sourceState, trashId, metadata = {}) {
  const next = clone(sourceState);
  const trash = ensureTrash(next);
  const index = trash.findIndex((item) => item.id === trashId);
  if (index < 0) throw new Error('El torneo ya no está en la papelera.');
  const entry = trash[index];
  const tournament = entry.tournament;
  if ((next.tournaments || []).some((item) => item.id === tournament.id)) throw new Error('Ya existe un torneo con el mismo identificador.');
  if ((next.tournaments || []).some((item) => item.name.toLocaleLowerCase('es') === tournament.name.toLocaleLowerCase('es'))) throw new Error('Ya existe un torneo con el mismo nombre.');
  trash.splice(index, 1);
  const targetIndex = Math.min(Math.max(0, Number(entry.originalIndex || 0)), next.tournaments.length);
  next.tournaments.splice(targetIndex, 0, tournament);
  addActivity(next, `Se restauró el torneo ${tournament.name} desde la papelera.`, 'tournament_restore', { actor: metadata.actor, device: metadata.device, tournamentId: tournament.id });
  return next;
}

function permanentlyDeleteState(sourceState, trashId, metadata = {}) {
  const next = clone(sourceState);
  const trash = ensureTrash(next);
  const index = trash.findIndex((item) => item.id === trashId);
  if (index < 0) throw new Error('El elemento ya no está en la papelera.');
  const entry = trash[index];
  if (Date.now() < Number(entry.expiresAt || 0) && metadata.force !== true) throw new Error('La eliminación definitiva queda disponible al finalizar los 30 días de recuperación.');
  trash.splice(index, 1);
  addActivity(next, `Se eliminó definitivamente el torneo ${entry.tournament?.name || 'sin nombre'}.`, 'tournament_delete_permanent', { actor: metadata.actor, device: metadata.device, tournamentId: entry.tournament?.id || '' });
  return next;
}

function inferChange(before, after) {
  const beforeTournaments = before.tournaments || [];
  const afterTournaments = after.tournaments || [];
  if (afterTournaments.length < beforeTournaments.length) return 'Retiro de torneo';
  if (afterTournaments.length > beforeTournaments.length) return 'Creación o restauración de torneo';
  const beforeTrash = before.trash?.tournaments?.length || 0;
  const afterTrash = after.trash?.tournaments?.length || 0;
  if (afterTrash !== beforeTrash) return afterTrash > beforeTrash ? 'Envío a papelera' : 'Cambio en papelera';
  const beforeMatches = beforeTournaments.flatMap((tournament) => (tournament.matches || []).map((match) => [tournament.id, match.id, match.homeGoals, match.awayGoals, match.goals?.length || 0, match.cards?.length || 0]));
  const afterMatches = afterTournaments.flatMap((tournament) => (tournament.matches || []).map((match) => [tournament.id, match.id, match.homeGoals, match.awayGoals, match.goals?.length || 0, match.cards?.length || 0]));
  if (JSON.stringify(beforeMatches) !== JSON.stringify(afterMatches)) return 'Actualización de partido';
  return 'Cambio administrativo';
}

function saveUndoSnapshot(before, after) {
  try {
    const beforeSig = JSON.stringify(before);
    const afterSig = JSON.stringify(after);
    if (beforeSig === afterSig) return;
    if (lastTransition && lastTransition.afterSig === beforeSig && lastTransition.beforeSig === afterSig && Date.now() - lastTransition.at < 20000) {
      lastTransition = null;
      return;
    }
    localStorage.setItem(UNDO_KEY, JSON.stringify({ state: before, description: inferChange(before, after), at: Date.now() }));
    lastTransition = { beforeSig, afterSig, at: Date.now() };
  } catch (error) {
    console.warn('No se pudo guardar el punto de deshacer.', error);
  }
}

core.setState = (nextState) => {
  if (!restoring) saveUndoSnapshot(clone(core.getState()), clone(nextState));
  return originalSetState(nextState);
};

function undoSnapshot() {
  try {
    const parsed = JSON.parse(localStorage.getItem(UNDO_KEY) || 'null');
    return parsed?.state ? parsed : null;
  } catch {
    return null;
  }
}

async function commit(previous, next, successText) {
  if (saving) return false;
  saving = true;
  core.setState(next);
  try {
    await core.saveCloud();
    core.showToast(successText);
    scheduleRender();
    return true;
  } catch (error) {
    console.error(error);
    restoring = true;
    originalSetState(previous);
    restoring = false;
    core.showToast(`Firebase rechazó el cambio: ${error.code || error.message || 'error desconocido'}.`);
    return false;
  } finally {
    saving = false;
  }
}

function relativeDays(entry) {
  const remaining = Math.ceil((Number(entry.expiresAt || 0) - Date.now()) / 86400000);
  return Math.max(0, remaining);
}

function dateTime(value) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function activityMarkup() {
  const items = (core.getState().activity || []).slice(0, 30);
  if (!items.length) return '<p class="cm-v510-muted">No hay actividad registrada.</p>';
  return `<div class="cm-v510-activity-list">${items.map((item) => `<article><span class="cm-v510-activity-dot"></span><div><strong>${esc(item.text || 'Cambio registrado')}</strong><small>${esc(item.actor || 'Sistema')} · ${esc(item.device || 'Dispositivo no registrado')} · ${esc(dateTime(item.at))}</small></div></article>`).join('')}</div>`;
}

function trashMarkup() {
  const entries = core.getState().trash?.tournaments || [];
  if (!entries.length) return '<div class="cm-v510-empty"><strong>Papelera vacía</strong><span>Los torneos retirados permanecerán aquí durante 30 días.</span></div>';
  return `<div class="cm-v510-trash-list">${entries.map((entry) => {
    const days = relativeDays(entry);
    const tournament = entry.tournament || {};
    return `<article data-trash-id="${esc(entry.id)}"><div><strong>${esc(tournament.name || 'Torneo sin nombre')}</strong><small>Eliminado por ${esc(entry.deletedBy || 'Administrador')} · ${esc(dateTime(entry.deletedAt))}</small><span>${days ? `${days} día${days === 1 ? '' : 's'} para eliminación definitiva` : 'Periodo de recuperación finalizado'}</span></div><div class="cm-v510-trash-actions"><button type="button" data-cm-v510-restore="${esc(entry.id)}" ${core.canEdit() ? '' : 'disabled'}>Restaurar</button><button type="button" class="danger" data-cm-v510-permanent="${esc(entry.id)}" ${core.canEdit() && days === 0 ? '' : 'disabled'}>Eliminar definitivamente</button></div></article>`;
  }).join('')}</div>`;
}

function safetyMarkup() {
  const undo = undoSnapshot();
  return `<section id="cmV510SafetyCenter" class="cm-v510-safety">
    <header><div><p class="eyebrow">SEGURIDAD Y TRAZABILIDAD</p><h2>Centro administrativo</h2><p>Recupera torneos retirados y revisa las modificaciones realizadas en la base compartida.</p></div><button type="button" data-cm-v510-undo ${core.canEdit() && undo ? '' : 'disabled'}>${undo ? `Deshacer: ${esc(undo.description)}` : 'Sin cambios para deshacer'}</button></header>
    <div class="cm-v510-safety-grid"><article><div class="cm-v510-section-head"><div><span class="cm-v510-card-label">PAPELERA</span><h3>Torneos recuperables</h3></div><b>${core.getState().trash?.tournaments?.length || 0}</b></div>${trashMarkup()}</article><article><div class="cm-v510-section-head"><div><span class="cm-v510-card-label">ACTIVIDAD</span><h3>Historial administrativo</h3></div><b>${(core.getState().activity || []).length}</b></div>${activityMarkup()}</article></div>
  </section>`;
}

function render() {
  refreshQueued = false;
  const page = document.getElementById('administracion');
  if (!page) return;
  const signature = JSON.stringify({
    admin: core.canEdit(),
    trash: (core.getState().trash?.tournaments || []).map((entry) => [entry.id, entry.deletedAt, entry.expiresAt, entry.tournament?.name]),
    activity: (core.getState().activity || []).slice(0, 30).map((item) => [item.id, item.text, item.at, item.actor]),
    undo: undoSnapshot()?.at || 0
  });
  let root = document.getElementById('cmV510SafetyCenter');
  if (root && signature === lastSignature) return;
  lastSignature = signature;
  const markup = safetyMarkup();
  if (root) root.outerHTML = markup;
  else page.querySelector('.page-title')?.insertAdjacentHTML('afterend', markup);
}

function scheduleRender() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(render);
}

function decorateDeleteButtons() {
  document.querySelectorAll('[data-cm-delete-tournament]').forEach((button) => {
    button.textContent = 'Mover a papelera';
    button.title = 'El torneo podrá recuperarse durante 30 días';
  });
}

function openTrash(tournamentId) {
  if (!core.canEdit()) return document.getElementById('authButton')?.click();
  const tournament = core.tournamentById(tournamentId);
  const guard = deletionGuard(core.getState(), tournament);
  if (!guard.allowed) return core.showToast(guard.reason);
  const matches = (tournament.matches || []).filter((match) => match.stage !== 'bye');
  const completed = matches.filter((match) => core.matchPlayed(match));
  core.openModal(`<div class="cm-v510-confirm danger" data-cm-v510-trash-tournament="${esc(tournamentId)}"><p class="eyebrow">PAPELERA DE TORNEOS</p><h2>${esc(tournament.name)}</h2><p>Se retirará de tablas, estadísticas y calendarios, pero podrá recuperarse durante 30 días con sus ${completed.length} partidos registrados.</p><label>Escribe el nombre exacto para confirmar<input id="cmV510TrashConfirmation" autocomplete="off" placeholder="${esc(tournament.name)}"></label><div><button type="button" class="secondary" data-close-modal>Cancelar</button><button type="button" class="danger-button" data-cm-v510-confirm-trash="${esc(tournamentId)}">Mover a papelera</button></div></div>`);
}

async function moveToTrash(tournamentId) {
  const tournament = core.tournamentById(tournamentId);
  if (!tournament || !core.canEdit()) return core.showToast('No se puede retirar este torneo ahora.');
  if ((document.getElementById('cmV510TrashConfirmation')?.value.trim() || '') !== tournament.name) return core.showToast('El nombre escrito no coincide exactamente.');
  const previous = clone(core.getState());
  try {
    const next = moveTournamentToTrashState(previous, tournamentId);
    core.closeModal();
    const saved = await commit(previous, next, `Torneo “${tournament.name}” enviado a la papelera.`);
    if (saved) core.navigate('torneos');
  } catch (error) { core.showToast(error.message); }
}

function openRestore(trashId) {
  const entry = core.getState().trash?.tournaments?.find((item) => item.id === trashId);
  if (!entry) return core.showToast('El torneo ya no está en la papelera.');
  core.openModal(`<div class="cm-v510-confirm"><p class="eyebrow">RESTAURAR</p><h2>${esc(entry.tournament?.name || 'Torneo')}</h2><p>Volverá a torneos con todos sus partidos, resultados y estadísticas.</p><div><button type="button" class="secondary" data-close-modal>Cancelar</button><button type="button" class="primary" data-cm-v510-confirm-restore="${esc(trashId)}">Restaurar torneo</button></div></div>`);
}

function openPermanent(trashId) {
  const entry = core.getState().trash?.tournaments?.find((item) => item.id === trashId);
  if (!entry) return core.showToast('El elemento ya no está en la papelera.');
  if (relativeDays(entry) > 0) return core.showToast('El periodo de recuperación todavía está activo.');
  core.openModal(`<div class="cm-v510-confirm danger"><p class="eyebrow">ELIMINACIÓN DEFINITIVA</p><h2>${esc(entry.tournament?.name || 'Torneo')}</h2><p>Esta operación no se puede revertir. Escribe <b>ELIMINAR</b> para confirmar.</p><label>Confirmación<input id="cmV510PermanentText" autocomplete="off"></label><div><button type="button" class="secondary" data-close-modal>Cancelar</button><button type="button" class="danger-button" data-cm-v510-confirm-permanent="${esc(trashId)}">Eliminar definitivamente</button></div></div>`);
}

function openUndo() {
  const snapshot = undoSnapshot();
  if (!snapshot) return core.showToast('No hay un cambio disponible para deshacer.');
  core.openModal(`<div class="cm-v510-confirm"><p class="eyebrow">DESHACER CAMBIO</p><h2>${esc(snapshot.description)}</h2><p>Se restaurará el estado anterior guardado en este dispositivo. La operación se sincronizará con Firebase.</p><small>${esc(dateTime(snapshot.at))}</small><div><button type="button" class="secondary" data-close-modal>Cancelar</button><button type="button" class="primary" data-cm-v510-confirm-undo>Deshacer ahora</button></div></div>`);
}

async function restore(trashId) {
  if (!core.canEdit()) return document.getElementById('authButton')?.click();
  const previous = clone(core.getState());
  try {
    const next = restoreTournamentState(previous, trashId);
    core.closeModal();
    await commit(previous, next, 'Torneo restaurado y sincronizado.');
  } catch (error) { core.showToast(error.message); }
}

async function permanent(trashId) {
  if ((document.getElementById('cmV510PermanentText')?.value.trim() || '') !== 'ELIMINAR') return core.showToast('Escribe ELIMINAR para confirmar.');
  const previous = clone(core.getState());
  try {
    const next = permanentlyDeleteState(previous, trashId);
    core.closeModal();
    await commit(previous, next, 'Torneo eliminado definitivamente.');
  } catch (error) { core.showToast(error.message); }
}

async function undoLast() {
  if (!core.canEdit()) return document.getElementById('authButton')?.click();
  const snapshot = undoSnapshot();
  if (!snapshot) return core.showToast('No hay un cambio disponible para deshacer.');
  const current = clone(core.getState());
  const restored = clone(snapshot.state);
  addActivity(restored, `Se deshizo el cambio: ${snapshot.description}.`, 'undo');
  core.closeModal();
  restoring = true;
  originalSetState(restored);
  restoring = false;
  try {
    await core.saveCloud();
    localStorage.removeItem(UNDO_KEY);
    lastTransition = null;
    core.showToast('Cambio deshecho y sincronizado.');
    scheduleRender();
  } catch (error) {
    restoring = true;
    originalSetState(current);
    restoring = false;
    core.showToast(`No se pudo deshacer: ${error.code || error.message || 'error desconocido'}.`);
  }
}

document.addEventListener('click', (event) => {
  const legacyDelete = event.target.closest('[data-cm-delete-tournament]');
  if (legacyDelete) { event.preventDefault(); event.stopImmediatePropagation(); openTrash(legacyDelete.dataset.cmDeleteTournament); return; }
  const confirmTrash = event.target.closest('[data-cm-v510-confirm-trash]');
  if (confirmTrash) { event.preventDefault(); event.stopImmediatePropagation(); void moveToTrash(confirmTrash.dataset.cmV510ConfirmTrash); return; }
  const restoreButton = event.target.closest('[data-cm-v510-restore]');
  if (restoreButton && !restoreButton.disabled) { event.preventDefault(); openRestore(restoreButton.dataset.cmV510Restore); return; }
  const permanentButton = event.target.closest('[data-cm-v510-permanent]');
  if (permanentButton && !permanentButton.disabled) { event.preventDefault(); openPermanent(permanentButton.dataset.cmV510Permanent); return; }
  const confirmRestore = event.target.closest('[data-cm-v510-confirm-restore]');
  if (confirmRestore) { event.preventDefault(); void restore(confirmRestore.dataset.cmV510ConfirmRestore); return; }
  const confirmPermanent = event.target.closest('[data-cm-v510-confirm-permanent]');
  if (confirmPermanent) { event.preventDefault(); void permanent(confirmPermanent.dataset.cmV510ConfirmPermanent); return; }
  if (event.target.closest('[data-cm-v510-undo]')) { event.preventDefault(); openUndo(); return; }
  if (event.target.closest('[data-cm-v510-confirm-undo]')) { event.preventDefault(); void undoLast(); }
}, true);

const adminPage = document.getElementById('administracion');
if (adminPage) new MutationObserver(scheduleRender).observe(adminPage, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
const tournamentsPage = document.getElementById('torneos');
if (tournamentsPage) new MutationObserver(() => { decorateDeleteButtons(); scheduleRender(); }).observe(tournamentsPage, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });

function refresh() {
  render();
  decorateDeleteButtons();
}

installStyles();
refresh();
window.setInterval(refresh, 1600);
window.ChuteV510Safety = {
  version: VERSION,
  retentionDays: RETENTION_DAYS,
  addActivity,
  deletionGuard,
  moveTournamentToTrashState,
  restoreTournamentState,
  permanentlyDeleteState,
  undoSnapshot,
  openTrash,
  moveToTrash,
  refresh
};