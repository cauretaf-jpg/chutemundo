const I = window.ChuteV511Internal;
if (!I) throw new Error('Los módulos de Chute Mundo v5.11 no están disponibles.');
const { core, playerKey, matchesOf, played, persistMutation, openTournament, openMatch, randomizeTournamentState, calculatePodium, AWARD_CATEGORIES, fillDefaultDateTime } = I;
let lastEditPair = '';

function openSearchResult(button) {
  let row;
  try { row = JSON.parse(button.dataset.cmV511Result || '{}'); } catch { return; }
  core.closeModal();
  if (row.type === 'team') window.ChuteV59?.openTeamProfile?.(row.teamId);
  if (row.type === 'player') window.ChuteV59?.openPlayerProfile?.(playerKey(row.teamId, row.playerName));
  if (row.type === 'tournament') openTournament(row.tournamentId);
  if (row.type === 'match') openMatch(row.tournamentId, row.matchId);
}

function startTournament(tournamentId) {
  const current = core.tournamentById(tournamentId);
  if (!current) return core.showToast('El torneo ya no existe.');
  void persistMutation((next) => {
    next.tournaments.forEach((item) => { if (item.id !== tournamentId && item.status === 'active') item.status = 'upcoming'; });
    const tournament = next.tournaments.find((item) => item.id === tournamentId);
    if (!tournament) throw new Error('El torneo ya no existe.');
    tournament.status = 'active';
    tournament.startedAt = Date.now();
  }, 'Torneo iniciado.', `Se inició ${current.name}.`);
}

function finishTournament(tournamentId) {
  const current = core.tournamentById(tournamentId);
  if (!current) return core.showToast('El torneo ya no existe.');
  const unresolved = matchesOf(current).filter((match) => !played(match));
  if (unresolved.length) return core.showToast(`Quedan ${unresolved.length} partidos pendientes. Regístralos antes de finalizar.`);
  void persistMutation((next) => {
    const tournament = next.tournaments.find((item) => item.id === tournamentId);
    if (!tournament) throw new Error('El torneo ya no existe.');
    calculatePodium(tournament);
    tournament.status = 'historical';
    tournament.finishedAt = Date.now();
    tournament.awards ||= {};
  }, 'Torneo finalizado.', `Se finalizó ${current.name}.`);
}

function randomizeFixture(tournamentId) {
  const current = core.tournamentById(tournamentId);
  if (!current) return core.showToast('El torneo ya no existe.');
  if (!window.confirm('Se reorganizarán los cruces pendientes del fixture. ¿Continuar?')) return;
  void persistMutation((next) => {
    const randomized = randomizeTournamentState(next, tournamentId);
    next.tournaments = randomized.tournaments;
  }, 'Fixture aleatorio generado.', `Se generó un fixture aleatorio para ${current.name}.`);
}

function saveAwards(form) {
  const tournamentId = form.closest('[data-tournament-id]')?.dataset.tournamentId || '';
  const selections = {};
  for (const [key, label] of AWARD_CATEGORIES) {
    const value = form.querySelector(`[data-cm-v511-award="${key}"]`)?.value || '';
    if (!value) continue;
    const separator = value.indexOf('__');
    if (separator < 0) continue;
    const teamId = value.slice(0, separator);
    const name = decodeURIComponent(value.slice(separator + 2));
    selections[key] = { label, teamId, playerName: name, note: form.querySelector(`[data-cm-v511-award-note="${key}"]`)?.value.trim() || '', updatedAt: Date.now() };
  }
  core.closeModal();
  void persistMutation((next) => {
    const tournament = next.tournaments.find((item) => item.id === tournamentId);
    if (!tournament) throw new Error('El torneo ya no existe.');
    tournament.awards = selections;
  }, 'Premios guardados.', `Se actualizaron los premios de ${core.tournamentById(tournamentId)?.name || 'un torneo'}.`);
}

function rememberMatchPair(target) {
  const edit = target.closest('[data-edit-match], [data-cm-v591-live]');
  if (!edit) return;
  lastEditPair = edit.dataset.editMatch || edit.dataset.cmV591Live || '';
  window.setTimeout(fillDefaultDateTime, 40);
}

Object.assign(I, { openSearchResult, startTournament, finishTournament, randomizeFixture, saveAwards, rememberMatchPair, getLastEditPair: () => lastEditPair });
