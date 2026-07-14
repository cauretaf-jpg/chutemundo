document.title = 'Chute Mundo v4 · Torneos y estadísticas';
const heroVersion = document.querySelector('.hero .eyebrow');
if (heroVersion) heroVersion.textContent = 'CHUTE MUNDO v4.0';
const brandDetail = document.querySelector('.brand small');
if (brandDetail) brandDetail.textContent = 'Torneos, planteles y estadísticas · Firebase';
const description = document.querySelector('meta[name="description"]');
if (description) description.content = 'Torneos, partidos, planteles y estadísticas detalladas de Chute Mundo, sincronizados con Firebase.';

if (!document.querySelector('link[href*="chute-detail.css"]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/chute-detail.css?v=4.0.0';
  document.head.appendChild(link);
}
await import('/chute-detail-model.mjs?v=4.0.0');
await Promise.all([
  import('/chute-detail-ui.mjs?v=4.0.0'),
  import('/chute-detail-events.mjs?v=4.0.0'),
  import('/chute-detail-diagnostics.mjs?v=4.0.0')
]);
