function syncAnalysisVisibility() {
  const switcher = document.getElementById('cmV58ModeSwitch');
  const root = document.getElementById('cmV58AnalysisRoot');
  if (switcher) switcher.style.display = 'flex';
  if (root) root.style.display = root.hidden ? 'none' : 'grid';
}

const observer = new MutationObserver(syncAnalysisVisibility);
observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
document.addEventListener('click', () => queueMicrotask(syncAnalysisVisibility));
document.addEventListener('change', () => queueMicrotask(syncAnalysisVisibility));
syncAnalysisVisibility();

window.ChuteVisibilityV58 = { sync: syncAnalysisVisibility };
