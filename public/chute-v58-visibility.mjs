function syncAnalysisVisibility() {
  const switcher = document.getElementById('cmV58ModeSwitch');
  const root = document.getElementById('cmV58AnalysisRoot');
  if (switcher) switcher.style.setProperty('display', 'flex', 'important');
  if (root) root.style.setProperty('display', root.hidden ? 'none' : 'grid', 'important');
}

function refreshAfterInteraction(event) {
  syncAnalysisVisibility();
  if (event?.target?.closest?.('[data-cm-v58-filter],[data-cm-v58-compare],[data-cm-v58-reset],[data-cm-v58-mode]')) {
    window.setTimeout(() => {
      window.ChuteAnalysisV58?.refresh?.();
      syncAnalysisVisibility();
    }, 40);
  }
}

const root = document.getElementById('cmV58AnalysisRoot');
if (root) {
  const observer = new MutationObserver(syncAnalysisVisibility);
  observer.observe(root, { attributes: true, attributeFilter: ['hidden'] });
}
document.addEventListener('click', (event) => queueMicrotask(() => refreshAfterInteraction(event)));
document.addEventListener('change', (event) => queueMicrotask(() => refreshAfterInteraction(event)));
syncAnalysisVisibility();

window.ChuteVisibilityV58 = { sync: syncAnalysisVisibility };
