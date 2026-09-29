function waitForCore() {
  if (window.ChuteMundoCore) return Promise.resolve(window.ChuteMundoCore);
  return new Promise((resolve) => document.addEventListener('chute:ready', (event) => resolve(event.detail), { once: true }));
}

const core = await waitForCore();

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-cm-add-goal], [data-cm-add-card]');
  if (!button) return;
  const side = button.dataset.cmAddGoal || button.dataset.cmAddCard;
  const isGoal = button.hasAttribute('data-cm-add-goal');
  const minute = document.getElementById(isGoal ? `cmGoalMinute-${side}` : `cmCardMinute-${side}`)?.value || '';
  const person = document.getElementById(isGoal ? `cmScorer-${side}` : `cmCardPlayer-${side}`)?.value || '';
  if (minute && person) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  core.showToast(!person
    ? (isGoal ? 'Selecciona al goleador.' : 'Selecciona al jugador o director técnico.')
    : 'Selecciona uno de los minutos oficiales del juego.');
}, true);

window.ChuteEventGuardV55 = { ready: true };
