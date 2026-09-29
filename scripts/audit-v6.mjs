import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const errors = [];
const ok = (condition, message) => { if (!condition) errors.push(message); };

const version = read('public/version.js');
const index = read('public/index.html');
const official = read('public/chute-official.mjs');
const bootstrap = read('public/chute-bootstrap.mjs');
const live = read('public/chute-v591-live-access.mjs');
const sw = read('public/sw.js');
const v6 = read('public/chute-v6.mjs');
const vercel = read('vercel.json');

ok(version.includes("CHUTE_APP_VERSION = '6.0.0'"), 'version.js no declara v6.0.0.');
ok(index.includes('/version.js'), 'index.html no carga la versión canónica.');
ok(index.includes('/chute-official.mjs?v=6.0.0'), 'index.html no carga el entrypoint v6.');
ok(official.includes("chute-v6.mjs"), 'El entrypoint no carga la capa v6.');
ok(bootstrap.includes("window.CHUTE_APP_VERSION"), 'Bootstrap no consume la versión canónica.');
ok(!live.includes('setInterval(refresh, 1500)'), 'El acceso al modo partido mantiene polling cada 1,5 s.');
ok(sw.includes("importScripts('/version.js')"), 'Service worker no consume la versión canónica.');
ok(v6.includes('historicalRows'), 'Falta el ranking histórico v6.');
ok(v6.includes('ensureMobileNavigation'), 'Falta la navegación móvil v6.');
ok(v6.includes('openPlayerProfile'), 'Falta el perfil ampliado de jugadores.');
ok(v6.includes('Firebase · fuente oficial'), 'No está explícito el modelo de fuente oficial.');
ok(vercel.includes('max-age=31536000'), 'Vercel no define caché larga para activos versionados.');

if (errors.length) {
  console.error('Auditoría Chute Mundo 6: FALLÓ');
  for (const error of errors) console.error(' - ' + error);
  process.exit(1);
}

console.log('Auditoría Chute Mundo 6: OK');
console.log('Versionado, PWA, ranking histórico, perfiles, navegación y almacenamiento consolidados.');
