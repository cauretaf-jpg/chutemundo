const VERSION = '5.10.0';
const parts = Array.from({ length: 4 }, (_, index) => `/chute-v510-safety-part-${String(index).padStart(2, '0')}.txt?v=${VERSION}`);
const responses = await Promise.all(parts.map((url) => fetch(url, { cache: 'no-store' })));
const failed = responses.find((response) => !response.ok);
if (failed) throw new Error(`No se pudo cargar el centro de seguridad (${failed.status}).`);
const source = (await Promise.all(responses.map((response) => response.text()))).join('');
const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}