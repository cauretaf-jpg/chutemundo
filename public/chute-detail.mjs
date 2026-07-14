document.title = 'Chute Mundo v5.2 · Competición oficial';
const heroVersion = document.querySelector('.hero .eyebrow');
if (heroVersion) heroVersion.textContent = 'CHUTE MUNDO v5.2';
const brandDetail = document.querySelector('.brand small');
if (brandDetail) brandDetail.textContent = 'Competición, planteles y estadísticas · Firebase';
const description = document.querySelector('meta[name="description"]');
if (description) description.content = 'Plataforma deportiva de Chute Mundo con filtros avanzados, Ranking FIFA y estadísticas detalladas.';

for (const [href, marker] of [
  ['/chute-detail.css?v=5.2.0', 'chute-detail.css'],
  ['/chute-premium.css?v=5.2.0', 'chute-premium.css'],
  ['/chute-premium-overrides.css?v=5.2.0', 'chute-premium-overrides.css'],
  ['/chute-tournament-hub.css?v=5.2.0', 'chute-tournament-hub.css'],
  ['/chute-matches-v52.css?v=5.2.0', 'chute-matches-v52.css'],
  ['/chute-stats-v52.css?v=5.2.0', 'chute-stats-v52.css']
]) {
  if (!document.querySelector(`link[href*="${marker}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
}

await import('/chute-mutation-guard.mjs?v=5.2.0');
await import('/chute-detail-model.mjs?v=5.2.0');
await Promise.all([
  import('/chute-detail-ui.mjs?v=5.2.0'),
  import('/chute-detail-events.mjs?v=5.2.0'),
  import('/chute-detail-diagnostics.mjs?v=5.2.0'),
  import('/chute-group-editor.mjs?v=5.2.0')
]);
await import('/chute-data-hygiene.mjs?v=5.2.0');
await import('/chute-premium-ui.mjs?v=5.2.0');
await import('/chute-tournament-hub.mjs?v=5.2.0');
await Promise.all([
  import('/chute-matches-v52.mjs?v=5.2.0'),
  import('/chute-stats-v52.mjs?v=5.2.0')
]);
