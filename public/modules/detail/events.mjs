function waitForCore() {
  if (window.ChuteMundoCore) return Promise.resolve(window.ChuteMundoCore);
  return new Promise((resolve) => document.addEventListener('chute:ready', (event) => resolve(event.detail), { once: true }));
}

const core = await waitForCore();
const model = window.ChuteDetailModel;
if (!model) throw new Error('El modelo detallado no está disponible.');
const { esc, playerName, photo, logo, uid, ensureMatchEvents, syncLegacyLogs } = model;

function getContext(tournamentId, matchId) {
  const tournament = core.tournamentById(tournamentId);
  const match = tournament?.matches.find((item) => item.id === matchId);
  if (!tournament || !match) return null;
  const home = core.resolveHome(tournament, match);
  const away = core.resolveAway(tournament, match);
  if (!home || !away) return null;
  ensureMatchEvents(match, home, away);
  return { tournament, match, home, away };
}

function teamPlayers(teamId) {
  return core.teamById(teamId)?.players || [];
}

function playerOptions(teamId, selected = '', includeCoach = false) {
  const team = core.teamById(teamId);
  const players = teamPlayers(teamId);
  const options = players.map((player) => {
    const name = playerName(player);
    return `<option value="${esc(name)}" ${name === selected ? 'selected' : ''}>${esc(name)}</option>`;
  }).join('');
  const coach = includeCoach && team?.coach ? `<option value="coach::${esc(team.coach)}">DT · ${esc(team.coach)}</option>` : '';
  return `${coach}${options}`;
}

function eventList(context, side) {
  const { match, home, away } = context;
  const teamId = side === 'home' ? home : away;
  const goals = (match.goals || []).filter((goal) => goal.side === side);
  const cards = (match.cards || []).filter((card) => card.side === side);
  return `<div class="cm-side-events">
    <div class="cm-event-block"><h4>Goles registrados · ${goals.length}</h4>${goals.length ? goals.map((goal) => `<div class="cm-event-record">${photo(teamId,goal.playerName,'cm-event-face')}<div><strong>⚽ ${esc(goal.playerName)}</strong><span>${goal.minute ? `${esc(goal.minute)}'` : 'Sin minuto'}${goal.assistName ? ` · Asistencia: ${esc(goal.assistName)}` : ' · Sin asistencia'}</span></div><button type="button" class="cm-icon-button" data-cm-delete-goal="${esc(goal.id)}" data-side="${side}" title="Eliminar gol">×</button></div>`).join('') : '<p class="empty">Sin goleadores detallados.</p>'}</div>
    <div class="cm-event-block"><h4>Tarjetas registradas · ${cards.length}</h4>${cards.length ? cards.map((card) => `<div class="cm-event-record">${photo(teamId,card.playerName,'cm-event-face')}<div><strong>${card.type === 'red' ? '🟥' : '🟨'} ${esc(card.playerName)}</strong><span>${card.role === 'coach' ? 'Director técnico' : 'Jugador'}${card.minute ? ` · ${esc(card.minute)}'` : ''}</span></div><button type="button" class="cm-icon-button" data-cm-delete-card="${esc(card.id)}" data-side="${side}" title="Eliminar tarjeta">×</button></div>`).join('') : '<p class="empty">Sin tarjetas.</p>'}</div>
  </div>`;
}

function sideEditor(context, side) {
  const { home, away } = context;
  const teamId = side === 'home' ? home : away;
  const team = core.teamById(teamId);
  return `<section class="cm-match-side" data-side="${side}">
    <div class="cm-match-side-head">${logo(teamId,'cm-match-logo')}<div><span>${side === 'home' ? 'LOCAL' : 'VISITA'}</span><h3>${esc(team?.name || 'Equipo')}</h3></div></div>
    ${eventList(context,side)}
    <div class="cm-event-entry">
      <h4>Agregar gol</h4>
      <label>Goleador<select id="cmScorer-${side}"><option value="">Selecciona</option>${playerOptions(teamId)}</select></label>
      <label>Asistencia<select id="cmAssist-${side}"><option value="">Sin asistencia</option>${playerOptions(teamId)}</select></label>
      <label>Minuto<input id="cmGoalMinute-${side}" type="number" min="1" max="130" placeholder="Ej. 34"></label>
      <button type="button" class="primary" data-cm-add-goal="${side}">Agregar gol</button>
    </div>
    <div class="cm-event-entry">
      <h4>Agregar tarjeta</h4>
      <label>Tipo<select id="cmCardType-${side}"><option value="yellow">🟨 Amarilla</option><option value="red">🟥 Roja</option></select></label>
      <label>Jugador o DT<select id="cmCardPlayer-${side}"><option value="">Selecciona</option>${playerOptions(teamId,'',true)}</select></label>
      <label>Minuto<input id="cmCardMinute-${side}" type="number" min="1" max="130" placeholder="Ej. 62"></label>
      <button type="button" class="secondary" data-cm-add-card="${side}">Agregar tarjeta</button>
    </div>
  </section>`;
}

function openDetailedMatch(tournamentId, matchId) {
  const context = getContext(tournamentId, matchId);
  if (!context) return core.showToast('El partido todavía depende de una fase anterior o no pudo resolverse.');
  const { tournament, match, home, away } = context;
  const knockout = match.stage === 'knockout';
  const goalCountHome = match.goals.filter((goal) => goal.side === 'home').length;
  const goalCountAway = match.goals.filter((goal) => goal.side === 'away').length;
  core.openModal(`<div class="cm-match-editor" data-tournament="${esc(tournamentId)}" data-match="${esc(matchId)}">
    <div class="cm-match-editor-title"><div><p class="eyebrow">${esc(tournament.name)}</p><h2>${esc(match.round)} · ${esc(match.label)}</h2></div><span class="badge ${esc(tournament.status)}">${esc(tournament.status)}</span></div>
    <form id="cmMatchGeneralForm">
      <div class="cm-scoreboard">
        <div>${logo(home,'cm-score-logo')}<strong>${esc(core.teamName(home))}</strong><input id="cmHomeGoals" type="number" min="0" required value="${match.homeGoals ?? goalCountHome}"><small>${goalCountHome} goles con autor registrado</small></div>
        <span>—</span>
        <div>${logo(away,'cm-score-logo')}<strong>${esc(core.teamName(away))}</strong><input id="cmAwayGoals" type="number" min="0" required value="${match.awayGoals ?? goalCountAway}"><small>${goalCountAway} goles con autor registrado</small></div>
      </div>
      ${knockout ? `<div class="form-grid"><label>Penales ${esc(core.teamName(home))}<input id="cmHomePens" type="number" min="0" value="${match.homePens ?? ''}"></label><label>Penales ${esc(core.teamName(away))}<input id="cmAwayPens" type="number" min="0" value="${match.awayPens ?? ''}"></label></div>` : ''}
      <div class="form-grid cm-four-fields"><label>Fecha<input id="cmMatchDate" type="date" value="${esc(match.date || '')}"></label><label>Hora<input id="cmMatchTime" type="time" value="${esc(match.time || '')}"></label><label>Lugar<input id="cmMatchVenue" value="${esc(match.venue || '')}" placeholder="Sede o cancha"></label><label>Notas<input id="cmMatchNotes" value="${esc(match.notes || '')}" placeholder="Observaciones"></label></div>
      <div class="cm-score-warning">El marcador puede ser mayor que los eventos detallados cuando se conservan resultados históricos sin goleadores registrados.</div>
      <button class="primary wide" type="submit">Guardar marcador y datos generales</button>
    </form>
    <div class="cm-match-event-columns">${sideEditor(context,'home')}${sideEditor(context,'away')}</div>
  </div>`);
}

async function saveContext(context, message) {
  syncLegacyLogs(context.match);
  core.persistLocal();
  core.render();
  window.ChuteDetailUI?.applyEnhancements?.();
  try {
    await core.saveCloud();
    core.showToast(`${message} Sincronizado con Firebase.`);
  } catch (error) {
    console.error(error);
    core.showToast(`${message} Guardado localmente; Firebase respondió: ${error.code || error.message || 'error desconocido'}.`);
  }
}

async function addGoal(tournamentId, matchId, side) {
  const context = getContext(tournamentId, matchId);
  if (!context) return;
  const scorer = document.getElementById(`cmScorer-${side}`)?.value || '';
  const assist = document.getElementById(`cmAssist-${side}`)?.value || '';
  const minute = document.getElementById(`cmGoalMinute-${side}`)?.value || '';
  if (!scorer) return core.showToast('Selecciona al goleador.');
  if (assist && assist === scorer) return core.showToast('El goleador y el asistidor deben ser personas distintas.');
  const teamId = side === 'home' ? context.home : context.away;
  context.match.goals.push({ id: uid('goal'), side, teamId, playerName: scorer, assistName: assist, minute: String(minute), createdAt: Date.now() });
  const scoreField = side === 'home' ? 'homeGoals' : 'awayGoals';
  context.match[scoreField] = Number(context.match[scoreField] || 0) + 1;
  await saveContext(context, `Gol de ${scorer} agregado.`);
  openDetailedMatch(tournamentId,matchId);
}

async function addCard(tournamentId, matchId, side) {
  const context = getContext(tournamentId, matchId);
  if (!context) return;
  const raw = document.getElementById(`cmCardPlayer-${side}`)?.value || '';
  const type = document.getElementById(`cmCardType-${side}`)?.value || 'yellow';
  const minute = document.getElementById(`cmCardMinute-${side}`)?.value || '';
  if (!raw) return core.showToast('Selecciona al jugador o director técnico.');
  const coach = raw.startsWith('coach::');
  const name = coach ? raw.slice(7) : raw;
  const teamId = side === 'home' ? context.home : context.away;
  context.match.cards.push({ id: uid('card'), side, teamId, playerName: name, role: coach ? 'coach' : 'player', type, minute: String(minute), createdAt: Date.now() });
  await saveContext(context, `${type === 'red' ? 'Tarjeta roja' : 'Tarjeta amarilla'} para ${name} agregada.`);
  openDetailedMatch(tournamentId,matchId);
}

async function deleteEvent(tournamentId, matchId, kind, eventId) {
  const context = getContext(tournamentId, matchId);
  if (!context) return;
  if (kind === 'goal') {
    const event = context.match.goals.find((goal) => goal.id === eventId);
    if (!event) return;
    context.match.goals = context.match.goals.filter((goal) => goal.id !== eventId);
    const scoreField = event.side === 'home' ? 'homeGoals' : 'awayGoals';
    context.match[scoreField] = Math.max(0, Number(context.match[scoreField] || 0) - 1);
  } else {
    context.match.cards = context.match.cards.filter((card) => card.id !== eventId);
  }
  await saveContext(context, kind === 'goal' ? 'Gol eliminado.' : 'Tarjeta eliminada.');
  openDetailedMatch(tournamentId,matchId);
}

document.addEventListener('click', (event) => {
  const edit = event.target.closest('[data-edit-match]');
  if (edit) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!core.canEdit()) return core.showToast('Inicia sesión como administrador para editar el partido.');
    const [tournamentId, matchId] = edit.dataset.editMatch.split('__');
    openDetailedMatch(tournamentId,matchId);
    return;
  }
}, true);

document.addEventListener('click', (event) => {
  const editor = event.target.closest('.cm-match-editor');
  if (!editor) return;
  const tournamentId = editor.dataset.tournament;
  const matchId = editor.dataset.match;
  const addGoalButton = event.target.closest('[data-cm-add-goal]');
  if (addGoalButton) { addGoal(tournamentId,matchId,addGoalButton.dataset.cmAddGoal); return; }
  const addCardButton = event.target.closest('[data-cm-add-card]');
  if (addCardButton) { addCard(tournamentId,matchId,addCardButton.dataset.cmAddCard); return; }
  const deleteGoalButton = event.target.closest('[data-cm-delete-goal]');
  if (deleteGoalButton) { deleteEvent(tournamentId,matchId,'goal',deleteGoalButton.dataset.cmDeleteGoal); return; }
  const deleteCardButton = event.target.closest('[data-cm-delete-card]');
  if (deleteCardButton) deleteEvent(tournamentId,matchId,'card',deleteCardButton.dataset.cmDeleteCard);
});

document.addEventListener('submit', async (event) => {
  if (event.target.id !== 'cmMatchGeneralForm') return;
  event.preventDefault();
  const editor = event.target.closest('.cm-match-editor');
  const context = getContext(editor.dataset.tournament,editor.dataset.match);
  if (!context) return;
  const homeGoals = Number(document.getElementById('cmHomeGoals').value);
  const awayGoals = Number(document.getElementById('cmAwayGoals').value);
  if (!Number.isInteger(homeGoals) || !Number.isInteger(awayGoals) || homeGoals < 0 || awayGoals < 0) return core.showToast('Ingresa un marcador válido.');
  context.match.homeGoals = homeGoals;
  context.match.awayGoals = awayGoals;
  const homePens = document.getElementById('cmHomePens');
  const awayPens = document.getElementById('cmAwayPens');
  context.match.homePens = homePens ? (homePens.value === '' ? null : Number(homePens.value)) : null;
  context.match.awayPens = awayPens ? (awayPens.value === '' ? null : Number(awayPens.value)) : null;
  if (homeGoals === awayGoals && homePens && awayPens && context.match.homePens === context.match.awayPens) return core.showToast('En una eliminación empatada, los penales deben definir un ganador.');
  context.match.date = document.getElementById('cmMatchDate').value;
  context.match.time = document.getElementById('cmMatchTime').value;
  context.match.venue = document.getElementById('cmMatchVenue').value.trim();
  context.match.notes = document.getElementById('cmMatchNotes').value.trim();
  await saveContext(context,'Partido actualizado.');
  core.closeModal();
});

window.ChuteDetailEvents = { openDetailedMatch };
