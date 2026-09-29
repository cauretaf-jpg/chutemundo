const innerHtmlDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');

function protectPanel() {
  const panel = document.getElementById('cmDivisionSeasonConfig');
  if (!panel || panel.dataset.cmV54Guarded === 'true' || !innerHtmlDescriptor) return;
  panel.dataset.cmV54Guarded = 'true';
  panel.dataset.cmV54Locked = panel.childElementCount ? 'true' : 'false';
  Object.defineProperty(panel, 'innerHTML', {
    configurable: true,
    get() { return innerHtmlDescriptor.get.call(this); },
    set(value) {
      if (this.dataset.cmV54Locked === 'true') return;
      innerHtmlDescriptor.set.call(this, value);
      window.setTimeout(() => { this.dataset.cmV54Locked = this.childElementCount ? 'true' : 'false'; }, 0);
    }
  });
}

function unlockPanel() {
  const panel = document.getElementById('cmDivisionSeasonConfig');
  if (panel) panel.dataset.cmV54Locked = 'false';
}

document.addEventListener('change', (event) => {
  if (event.target.id === 'tournamentType') unlockPanel();
}, true);

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-cm-reset-composition]')) unlockPanel();
}, true);

protectPanel();
window.setInterval(protectPanel, 400);
window.ChuteV54FormGuard = { protectPanel, unlockPanel };
