document.title = 'Chute Mundo v5 · Competición oficial';
const heroVersion = document.querySelector('.hero .eyebrow');
if (heroVersion) heroVersion.textContent = 'CHUTE MUNDO v5.0';
const brandDetail = document.querySelector('.brand small');
if (brandDetail) brandDetail.textContent = 'Competición, planteles y estadísticas · Firebase';
const description = document.querySelector('meta[name="description"]');
if (description) description.content = 'Plataforma deportiva de Chute Mundo: torneos, grupos, partidos, planteles y estadísticas detalladas.';

for (const [href, marker] of [
  ['/chute-detail.css?v=5.0.0', 'chute-detail.css'],
  ['/chute-premium.css?v=5.0.0', 'chute-premium.css']
]) {
  if (!document.querySelector(`link[href*="${marker}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
}

await import('/chute-mutation-guard.mjs?v=5.0.0');
await import('/chute-detail-model.mjs?v=5.0.0');
await Promise.all([
  import('/chute-detail-ui.mjs?v=5.0.0'),
  import('/chute-detail-events.mjs?v=5.0.0'),
  import('/chute-detail-diagnostics.mjs?v=5.0.0'),
  import('/chute-group-editor.mjs?v=5.0.0')
]);
await import('/chute-premium-ui.mjs?v=5.0.0');
