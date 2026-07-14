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
