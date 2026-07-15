document.title = 'Chute Mundo v5.8 · Competición oficial';
const heroVersion = document.querySelector('.hero .eyebrow');
if (heroVersion) heroVersion.textContent = 'CHUTE MUNDO v5.8';
const brandDetail = document.querySelector('.brand small');
if (brandDetail) brandDetail.textContent = 'Competición, análisis histórico, divisiones, disciplina, sedes, planteles y estadísticas · Firebase';
const description = document.querySelector('meta[name="description"]');
if (description) description.content = 'Plataforma deportiva de Chute Mundo con análisis histórico, divisiones, disciplina, sedes y estadísticas optimizadas.';

function loadStyle(href, marker) {
  if (document.querySelector(`link[href*="${marker}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

for (const [href, marker] of [
  ['/chute-detail.css?v=5.8.0', 'chute-detail.css'],
  ['/chute-premium.css?v=5.8.0', 'chute-premium.css'],
  ['/chute-premium-overrides.css?v=5.8.0', 'chute-premium-overrides.css'],
  ['/chute-tournament-hub.css?v=5.8.0', 'chute-tournament-hub.css'],
  ['/chute-matches-v52.css?v=5.8.0', 'chute-matches-v52.css'],
  ['/chute-v53-adjustments.css?v=5.8.0', 'chute-v53-adjustments.css'],
  ['/chute-v54.css?v=5.8.0', 'chute-v54.css'],
  ['/chute-v55.css?v=5.8.0', 'chute-v55.css'],
  ['/chute-v56.css?v=5.8.0', 'chute-v56.css']
]) loadStyle(href, marker);

await import('/chute-runtime-v58.mjs?v=5.8.0');
await import('/chute-mutation-guard.mjs?v=5.8.0');
await import('/chute-detail-model.mjs?v=5.8.0');
await Promise.all([
  import('/chute-detail-ui.mjs?v=5.8.0'),
  import('/chute-detail-events.mjs?v=5.8.0'),
  import('/chute-detail-diagnostics.mjs?v=5.8.0'),
  import('/chute-group-editor.mjs?v=5.8.0')
]);
await import('/chute-data-hygiene.mjs?v=5.8.0');
await import('/chute-premium-ui.mjs?v=5.8.0');
await import('/chute-tournament-hub.mjs?v=5.8.0');
await import('/chute-matches-v52.mjs?v=5.8.0');
await import('/chute-v54.mjs?v=5.8.0');
await import('/chute-v54-form-guard.mjs?v=5.8.0');
await import('/chute-v56-discipline.mjs?v=5.8.0');
await import('/chute-v55-event-guard.mjs?v=5.8.0');
await import('/chute-v55.mjs?v=5.8.0');

let statsPromise = null;
function loadStatistics() {
  if (statsPromise) return statsPromise;
  loadStyle('/chute-stats-v52.css?v=5.8.0', 'chute-stats-v52.css');
  loadStyle('/chute-v57.css?v=5.8.0', 'chute-v57.css');
  loadStyle('/chute-v58.css?v=5.8.0', 'chute-v58.css');
  statsPromise = Promise.all([
    import('/chute-stats-v52.mjs?v=5.8.0'),
    import('/chute-game-minute-stats.mjs?v=5.8.0')
  ]).then(async () => {
    await import('/chute-v57-controllers.mjs?v=5.8.0');
    await import('/chute-v58-analysis.mjs?v=5.8.0');
    window.ChuteRuntimeV58?.invalidate('statistics-loaded');
    return true;
  }).catch((error) => {
    statsPromise = null;
    console.error('No se pudo cargar el centro estadístico de Chute Mundo.', error);
    window.ChuteMundoCore?.showToast?.('No se pudieron cargar las estadísticas. Intenta nuevamente.');
    throw error;
  });
  return statsPromise;
}

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-page="estadisticas"]')) loadStatistics();
}, true);

if (!document.getElementById('estadisticas')?.hidden) loadStatistics();

window.ChuteLazyV58 = {
  loadStatistics,
  get statisticsLoaded() { return Boolean(statsPromise); }
};
