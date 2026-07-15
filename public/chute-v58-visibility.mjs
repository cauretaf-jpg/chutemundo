function syncAnalysisVisibility() {
  const switcher = document.getElementById('cmV58ModeSwitch');
  const root = document.getElementById('cmV58AnalysisRoot');
  if (switcher) switcher.style.setProperty('display', 'flex', 'important');
  if (root) root.style.setProperty('display', root.hidden ? 'none' : 'grid', 'important');
}

const root = document.getElementById('cmV58AnalysisRoot');
if (root) {
  const observer = new MutationObserver(syncAnalysisVisibility);
  observer.observe(root, { attributes: true, attributeFilter: ['hidden'] });
}
document.addEventListener('click', () => queueMicrotask(syncAnalysisVisibility));
document.addEventListener('change', () => queueMicrotask(syncAnalysisVisibility));
syncAnalysisVisibility();

window.ChuteVisibilityV58 = { sync: syncAnalysisVisibility };
