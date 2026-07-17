document.title = 'Chute Mundo v5.8.2 · Competición oficial';
const heroVersion = document.querySelector('.hero .eyebrow');
if (heroVersion) heroVersion.textContent = 'CHUTE MUNDO v5.8.2';

function installAnalysisTheme() {
  let link = document.getElementById('cmV582AnalysisTheme');
  if (link) return link;
  link = document.createElement('link');
  link.id = 'cmV582AnalysisTheme';
  link.rel = 'stylesheet';
  link.href = '/chute-v582-analysis-theme.css?v=5.8.2';
  document.head.appendChild(link);
  return link;
}

installAnalysisTheme();
window.ChuteThemeV582 = { version: '5.8.2', refresh: installAnalysisTheme };
