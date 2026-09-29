const core = window.ChuteMundoCore;
if (!core) throw new Error('Chute Mundo no está listo para validar la Era de divisiones.');

const VERSION = window.ChuteVersion?.version || '5.20.1';
const esc = window.ChuteDetailModel?.esc || ((value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])));
const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const played = (match) => core.matchPlayed?.(match) ?? (match?.homeGoals !== null && match?.awayGoals !== null);

function validShootout(match) {
  if (numeric(match.homeGoals) !== numeric(match.awayGoals) || match.stage !== 'knockout') return true;
  const scoreValid = Number.isFinite(Number(match.homePens)) && Number.isFinite(Number(match.awayPens)) && numeric(match.homePens) !== numeric(match.awayPens);
  return scoreValid && Array.isArray(match.penaltyShootout) && match.penaltyShootout.length > 0;
}

function divisionsCriticalIssues(tournament) {
  if (tournament?.eraId !== 'divisions') return [];
  const issues = [];
  for (const match of (tournament.matches || []).filter((item) => item?.stage !== 'bye' && played(item))) {
    const label = String(match.label || match.round || 'Partido').trim();
    if (!match.participationTracked || !match.lineups?.home?.starters?.length || !match.lineups?.away?.starters?.length) issues.push(`${label}: falta alineación o participación.`);
    const expected = numeric(match.homeGoals) + numeric(match.awayGoals);
    const goals = Array.isArray(match.goals) ? match.goals : [];
    if (goals.length !== expected || goals.some((goal) => !goal.playerName)) issues.push(`${label}: los goleadores no coinciden con el marcador.`);
    if (goals.some((goal) => !Object.prototype.hasOwnProperty.call(goal, 'assistName'))) issues.push(`${label}: falta asistencia o “sin asistencia”.`);
    if (!match.date || !match.venue) issues.push(`${label}: falta fecha o sede.`);
    if (!validShootout(match)) issues.push(`${label}: la tanda está incompleta.`);
  }
  return [...new Set(issues)];
}

function decorateTournamentForm() {
  const form = document.getElementById('tournamentForm');
  if (!form || form.querySelector('[data-cm-v520-era]')) return;
  const note = document.createElement('div');
  note.dataset.cmV520Era = '';
  note.className = 'notice info';
  note.innerHTML = '<b>Era de divisiones</b><span>Registro completo de partido y estadísticas.</span>';
  form.querySelector('#formatHelp')?.insertAdjacentElement('afterend', note);
}

window.addEventListener('click', (event) => {
  const confirm = event.target.closest?.('[data-cm-v517-confirm-finish]');
  if (!confirm) return;
  const tournament = core.tournamentById?.(confirm.dataset.cmV517ConfirmFinish);
  const issues = tournament ? divisionsCriticalIssues(tournament) : [];
  if (!issues.length) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  core.openModal?.(`<section><p class="eyebrow">ERA DE DIVISIONES</p><h2>Faltan datos para finalizar</h2><ul>${issues.slice(0, 30).map((issue) => `<li>${esc(issue)}</li>`).join('')}</ul><div class="modal-actions"><button class="secondary" data-close-modal>Volver</button></div></section>`);
}, true);

document.addEventListener('submit', (event) => {
  if (event.target.id === 'tournamentForm') setTimeout(decorateTournamentForm, 350);
}, true);

new MutationObserver(decorateTournamentForm).observe(document.body, { childList: true, subtree: true });
decorateTournamentForm();
window.ChuteV520StatsGuard = { version: VERSION, validShootout, divisionsCriticalIssues };
