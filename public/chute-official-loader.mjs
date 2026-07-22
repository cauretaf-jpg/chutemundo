const loadSplitModule = async ({ prefix, count, version, label = 'módulo' }) => {
  const parts = Array.from({ length: count }, (_, index) =>
    `/${prefix}-${String(index).padStart(2, '0')}.txt?v=${version}`
  );
  const responses = await Promise.all(parts.map((url) => fetch(url, { cache: 'no-store' })));
  const failed = responses.find((response) => !response.ok);
  if (failed) throw new Error(`No se pudo cargar ${label} (${failed.status}).`);
  const source = (await Promise.all(responses.map((response) => response.text()))).join('');
  const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  try {
    await import(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
};

window.ChuteSplitLoader = loadSplitModule;

try {
  await loadSplitModule({ prefix: 'chute-official-part', count: 6, version: '5.20.1', label: 'el sistema principal' });
} catch (error) {
  console.error('No se pudo iniciar Chute Mundo oficial.', error);
  const status = document.getElementById('syncStatus');
  if (status) status.textContent = 'Error de carga';
  const notice = document.getElementById('sourceNotice');
  if (notice) {
    notice.className = 'notice warning';
    notice.textContent = 'No se pudo iniciar el sistema. Recarga la página o revisa la conexión.';
  }
}
