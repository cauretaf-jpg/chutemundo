document.title = 'Chute Mundo v5.5 · Competición oficial';
const heroVersion = document.querySelector('.hero .eyebrow');
if (heroVersion) heroVersion.textContent = 'CHUTE MUNDO v5.5';
const brandDetail = document.querySelector('.brand small');
if (brandDetail) brandDetail.textContent = 'Competición, divisiones, sedes, planteles y estadísticas · Firebase';
const description = document.querySelector('meta[name="description"]');
if (description) description.content = 'Plataforma deportiva de Chute Mundo con divisiones, sedes reutilizables y registro de eventos con minutos oficiales.';

for (const [href, marker] of [
  ['/chute-detail.css?v=5.5.0', 'chute-detail.css'],
  ['/chute-premium.css?v=5.5.0', 'chute-premium.css'],
  ['/chute-premium-overrides.css?v=5.5.0', 'chute-premium-overrides.css'],
  ['/chute-tournament-hub.css?v=5.5.0', 'chute-tournament-hub.css'],
  ['/chute-matches-v52.css?v=5.5.0', 'chute-matches-v52.css'],
  ['/chute-stats-v52.css?v=5.5.0', 'chute-stats-v52.css'],
  ['/chute-v53-adjustments.css?v=5.5.0', 'chute-v53-adjustments.css'],
  ['/chute-v54.css?v=5.5.0', 'chute-v54.css'],
  ['/chute-v55.css?v=5.5.0', 'chute-v55.css']
]) {
  if (!document.querySelector(`link[href*="${marker}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
}

await import('/chute-mutation-guard.mjs?v=5.5.0');
await import('/chute-detail-model.mjs?v=5.5.0');
await Promise.all([
  import('/chute-detail-ui.mjs?v=5.5.0'),
  import('/chute-detail-events.mjs?v=5.5.0'),
  import('/chute-detail-diagnostics.mjs?v=5.5.0'),
  import('/chute-group-editor.mjs?v=5.5.0')
]);
await import('/chute-data-hygiene.mjs?v=5.5.0');
await import('/chute-premium-ui.mjs?v=5.5.0');
await import('/chute-tournament-hub.mjs?v=5.5.0');
await Promise.all([
  import('/chute-matches-v52.mjs?v=5.5.0'),
  import('/chute-stats-v52.mjs?v=5.5.0')
]);
await import('/chute-game-minute-stats.mjs?v=5.5.0');
await import('/chute-v54.mjs?v=5.5.0');
await import('/chute-v54-form-guard.mjs?v=5.5.0');
await import('/chute-v55.mjs?v=5.5.0');
