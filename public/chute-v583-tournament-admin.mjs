function waitForCore() {
  if (window.ChuteMundoCore) return Promise.resolve(window.ChuteMundoCore);
  return new Promise((resolve) => document.addEventListener('chute:ready', (event) => resolve(event.detail), { once: true }));
}

const core = await waitForCore();
const model = window.ChuteDetailModel;
if (!model) throw new Error('El modelo detallado no está disponible para administrar torneos.');

const { esc } = model;
const VERSION = '5.8.3';
let refreshQueued = false;
let saving = false;

const clone = (value) => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const isProtected = (tournament) => Boolean(tournament?.protected === true || /^t\d+$/i.test(String(tournament?.id || '')));
const played = (tournament) => (tournament?.matches || []).filter((match) => match.stage !== 'bye' && core.matchPlayed(match));

function installStyles() {
  if (document.getElementById('cmV583TournamentAdminStyles')) return;
  const link = document.createElement('link');
  link.id = 'cmV583TournamentAdminStyles';
  link.rel = 'stylesheet';
  link.href = `/chute-v583-tournament-admin.css?v=${VERSION}`;
  document.head.appendChild(link);
}

function summary(tournament) {
  const matches = (tournament?.matches || []).filter((match) => match.stage !== 'bye');
  const completed = played(tournament);
  return {
    teams: tournament?.teamIds?.length || 0,
    matches: matches.length,
    played: completed.length,
    goals: completed.reduce((total, match) => total + Number(match.homeGoals || 0) + Number(match.awayGoals || 0), 0)
  };
}

function guardDeletion(tournament) {
  if (!tournament) return { allowed: false, reason: 'El torneo ya no existe.' };
  if (isProtected(tournament)) return { allowed: false, reason: 'Los torneos del historial oficial están protegidos.' };
  if (tournament.type === 'division_season') {
    const number = Number(tournament.config?.seasonNumber || 0);
    const later = (core.getState().tournaments || []).find((item) => item.type === 'division_season' && Number(item.config?.seasonNumber || 0) > number);
    if (later) return { allowed: false, reason: `No se puede eliminar porque “${later.name}” es una temporada posterior.` };
  }
  return { allowed: true, reason: '' };
}

function typeLabel(type) {
  return ({ league: 'Liga', league_playoff: 'Liga + Playoff', cup_groups: 'Copa con grupos', direct_knockout: 'Eliminación directa', division_final: 'División con final', division_season: 'Temporada por divisiones' })[type] || type || 'Torneo';
}

function addActivity(state, text) {
  state.activity = Array.isArray(state.activity) ? state.activity : [];
  state.activity.unshift({ id: core.uid('activity'), text, at: Date.now() });
  state.activity = state.activity.slice(0, 50);
}

function actionsFor(tournament, location) {
  const actions = document.createElement('div');
  actions.className = `cm-v583-tournament-actions is-${location}`;
  actions.dataset.cmV583ActionsFor = tournament.id;

  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'cm-v583-action-edit';
  edit.dataset.cmEditTournament = tournament.id;
  edit.textContent = 'Editar torneo';
  actions.appendChild(edit);

  const guard = guardDeletion(tournament);
  if (guard.allowed) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'cm-v583-action-delete';
    remove.dataset.cmDeleteTournament = tournament.id;
    remove.textContent = 'Eliminar';
    actions.appendChild(remove);
  } else {
    const lock = document.createElement('span');
    lock.className = 'cm-v583-protected';
    lock.textContent = 'Historial protegido';
    lock.title = guard.reason;
    actions.appendChild(lock);
  }
  return actions;
}

function refresh() {
  refreshQueued = false;
  if (!core.canEdit()) {
    document.querySelectorAll('.cm-v583-tournament-actions').forEach((element) => element.remove());
    return;
  }
  document.querySelectorAll('.cm-tournament-catalog-card').forEach((card) => {
    const id = card.querySelector('[data-open-tournament]')?.dataset.openTournament;
    const tournament = core.tournamentById(id || '');
    if (tournament && !card.querySelector(':scope > .cm-v583-tournament-actions')) card.appendChild(actionsFor(tournament, 'catalog'));
  });
  const hub = document.getElementById('cmTournamentHub');
  const heading = hub?.querySelector('.cm-hub-heading');
  const tournament = core.tournamentById(hub?.dataset.tournamentId || '');
  if (heading && tournament && !heading.querySelector('.cm-v583-tournament-actions')) heading.appendChild(actionsFor(tournament, 'hub'));
}

function scheduleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(refresh);
}

function openEdit(id) {
  if (!core.canEdit()) return core.showToast('Inicia sesión como administrador para editar torneos.');
  const tournament = core.tournamentById(id);
  if (!tournament) return core.showToast('El torneo ya no existe.');
  const data = summary(tournament);
  const notes = Array.isArray(tournament.notes) ? tournament.notes.join('\n') : '';
  core.openModal(`<div class="cm-v583-admin-modal" data-tournament-id="${esc(id)}"><div class="cm-v583-modal-heading"><div><p class="eyebrow">ADMINISTRACIÓN</p><h2>Editar torneo</h2><p>La edición conserva los partidos y estadísticas existentes.</p></div>${isProtected(tournament) ? '<span class="cm-v583-official-badge">Historial oficial</span>' : ''}</div><form id="cmV583EditForm"><label>Nombre<input id="cmV583Name" required maxlength="90" value="${esc(tournament.name)}"></label><div class="cm-v583-form-grid"><label>Estado<select id="cmV583Status"><option value="upcoming" ${tournament.status === 'upcoming' ? 'selected' : ''}>Próximo</option><option value="active" ${tournament.status === 'active' ? 'selected' : ''}>En disputa</option><option value="historical" ${tournament.status === 'historical' ? 'selected' : ''}>Finalizado</option></select></label><label>Fecha o periodo<input id="cmV583CreatedAt" maxlength="60" value="${esc(tournament.createdAt || '')}"></label></div><label>Notas<textarea id="cmV583Notes" rows="5">${esc(notes)}</textarea></label><div class="cm-v583-readonly-summary"><span><b>${esc(typeLabel(tournament.type))}</b>Formato</span><span><b>${data.teams}</b>Equipos</span><span><b>${data.played}/${data.matches}</b>Partidos</span><span><b>${data.goals}</b>Goles</span></div><p class="cm-v583-structure-note">El formato, los equipos y el fixture quedan bloqueados para evitar la pérdida de resultados.</p><div class="cm-v583-modal-actions"><button type="button" class="secondary" data-close-modal>Cancelar</button><button class="primary" type="submit">Guardar cambios</button></div></form></div>`);
}

function openDelete(id) {
  if (!core.canEdit()) return core.showToast('Inicia sesión como administrador para eliminar torneos.');
  const tournament = core.tournamentById(id);
  const guard = guardDeletion(tournament);
  if (!guard.allowed) return core.showToast(guard.reason);
  const data = summary(tournament);
  const warning = data.played ? `Contiene ${data.played} partidos jugados y ${data.goals} goles.` : 'No contiene resultados, pero se eliminará su fixture.';
  core.openModal(`<div class="cm-v583-admin-modal cm-v583-delete-modal" data-tournament-id="${esc(id)}"><div class="cm-v583-danger-heading"><span>!</span><div><p class="eyebrow">ACCIÓN IRREVERSIBLE</p><h2>Eliminar torneo</h2><p>${esc(warning)}</p></div></div><div class="cm-v583-delete-summary"><strong>${esc(tournament.name)}</strong><span>${data.teams} equipos · ${data.matches} partidos</span></div><form id="cmV583DeleteForm"><label>Escribe el nombre exacto para confirmar<input id="cmV583Confirmation" required autocomplete="off" placeholder="${esc(tournament.name)}"></label><p class="cm-v583-delete-note">También se quitarán sus resultados de tablas históricas, rankings, goleadores, asistencias y disciplina.</p><div class="cm-v583-modal-actions"><button type="button" class="secondary" data-close-modal>Cancelar</button><button class="cm-v583-confirm-delete" type="submit">Eliminar definitivamente</button></div></form></div>`);
}

async function persistChange(previous, next, successText) {
  if (saving) return false;
  saving = true;
  core.setState(next);
  core.closeModal();
  try {
    await core.saveCloud();
    core.showToast(successText);
    window.ChuteTournamentHub?.refresh?.();
    scheduleRefresh();
    return true;
  } catch (error) {
    console.error(error);
    core.setState(previous);
    core.showToast(`Firebase rechazó el cambio: ${error.code || error.message || 'error desconocido'}. No se aplicaron cambios.`);
    return false;
  } finally {
    saving = false;
  }
}

async function saveEdit(form) {
  const id = form.closest('[data-tournament-id]')?.dataset.tournamentId || '';
  const current = core.tournamentById(id);
  if (!current || !core.canEdit()) return core.showToast('No se puede editar este torneo ahora.');
  const name = document.getElementById('cmV583Name')?.value.trim() || '';
  if (!name) return core.showToast('Escribe un nombre para el torneo.');
  if (core.getState().tournaments.some((item) => item.id !== id && item.name.toLowerCase() === name.toLowerCase())) return core.showToast('Ya existe otro torneo con ese nombre.');
  const previous = clone(core.getState());
  const next = clone(previous);
  const target = next.tournaments.find((item) => item.id === id);
  const oldName = target.name;
  target.name = name;
  target.status = document.getElementById('cmV583Status')?.value || target.status;
  target.createdAt = document.getElementById('cmV583CreatedAt')?.value.trim() || target.createdAt;
  target.notes = (document.getElementById('cmV583Notes')?.value || '').split('\n').map((line) => line.trim()).filter(Boolean);
  target.updatedAt = Date.now();
  addActivity(next, oldName === name ? `Se actualizó ${name}.` : `Se renombró ${oldName} como ${name}.`);
  await persistChange(previous, next, `Torneo “${name}” actualizado y sincronizado.`);
}

async function removeTournament(form) {
  const id = form.closest('[data-tournament-id]')?.dataset.tournamentId || '';
  const tournament = core.tournamentById(id);
  const guard = guardDeletion(tournament);
  if (!core.canEdit()) return core.showToast('Inicia sesión como administrador para eliminar torneos.');
  if (!guard.allowed) return core.showToast(guard.reason);
  if ((document.getElementById('cmV583Confirmation')?.value.trim() || '') !== tournament.name) return core.showToast('El nombre escrito no coincide exactamente.');
  const previous = clone(core.getState());
  const next = clone(previous);
  next.tournaments = next.tournaments.filter((item) => item.id !== id);
  addActivity(next, `Se eliminó el torneo ${tournament.name}.`);
  const removed = await persistChange(previous, next, `Torneo “${tournament.name}” eliminado de Firebase.`);
  if (removed) core.navigate('torneos');
}

document.addEventListener('click', (event) => {
  const edit = event.target.closest('[data-cm-edit-tournament]');
  if (edit) { event.preventDefault(); event.stopPropagation(); openEdit(edit.dataset.cmEditTournament); return; }
  const remove = event.target.closest('[data-cm-delete-tournament]');
  if (remove) { event.preventDefault(); event.stopPropagation(); openDelete(remove.dataset.cmDeleteTournament); return; }
  setTimeout(scheduleRefresh, 0);
}, true);

document.addEventListener('submit', (event) => {
  if (event.target.id === 'cmV583EditForm') { event.preventDefault(); void saveEdit(event.target); }
  if (event.target.id === 'cmV583DeleteForm') { event.preventDefault(); void removeTournament(event.target); }
});

const page = document.getElementById('torneos');
if (page) new MutationObserver(scheduleRefresh).observe(page, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });

installStyles();
document.title = 'Chute Mundo v5.8.3 · Competición oficial';
const heroVersion = document.querySelector('.hero .eyebrow');
if (heroVersion) heroVersion.textContent = 'CHUTE MUNDO v5.8.3';
refresh();
window.setInterval(refresh, 1500);
window.ChuteTournamentAdminV583 = { version: VERSION, refresh, openEdit, openDelete, isProtected, guardDeletion, summary };
