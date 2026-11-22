import fs from 'node:fs';
import path from 'node:path';

const read = (file) => fs.readFileSync(file, 'utf8');
const errors = [];
const ok = (condition, message) => { if (!condition) errors.push(message); };
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
});

const version = read('public/version.js');
const index = read('public/index.html');
const app = read('public/app.mjs');
const sw = read('public/sw.js');
const rules = read('firestore.rules');
const vercel = read('vercel.json');
const safety = read('public/modules/core/safety.mjs');
const playerIds = read('public/modules/data/player-ids.mjs');

ok(version.includes("const VERSION = '6.1.0'"), 'version.js no declara 6.1.0.');
ok(index.includes('/app.mjs?v=6.1.0'), 'index.html no carga app.mjs 6.1.0.');
ok(app.includes('/modules/core/app.mjs'), 'app.mjs no carga el núcleo modular.');
ok(app.includes('/modules/matches/live.mjs'), 'app.mjs no carga el centro de partido modular.');
ok(!fs.existsSync('public/modules/core/split-loader.mjs'), 'split-loader.mjs sigue activo.');
ok(walk('public/modules').every((file) => !file.endsWith('.txt')), 'Persisten fragmentos .txt en public/modules.');
ok(read('public/modules/statistics/history.mjs').includes('/styles/history.css'), 'Estadísticas no carga history.css.');
ok(!app.includes('/modules/dashboard/index.mjs'), 'Inicio volvió a cargar el dashboard redundante.');
ok(sw.includes("importScripts('/version.js')"), 'Service Worker no usa versión canónica.');
ok(playerIds.includes("SCHEMA = 'player-ids-v1'"), 'Falta el registro estable de jugadores.');
ok(safety.includes("const actor = () => 'Administrador'"), 'La trazabilidad pública todavía puede usar el correo del administrador.');
ok(rules.includes('request.auth.token.admin == true') && rules.includes("request.auth.token.role == 'admin'"), 'Firestore no soporta custom claims.');
ok(!vercel.includes('ignoreCommand'), 'vercel.json mantiene ignoreCommand heredado.');

for (const file of ['public/app.mjs', ...walk('public/modules').filter((file) => /\.(?:mjs|js)$/.test(file))]) {
  const source = read(file);
  if (/['"`]\/chute-v\d/i.test(source)) errors.push(`${file} todavía referencia /chute-v*.`);
}

const workflows = fs.readdirSync('.github/workflows').filter((name) => /\.ya?ml$/.test(name));
ok(workflows.length === 1 && workflows[0] === 'ci.yml', `Workflows inesperados: ${workflows.join(', ')}`);

if (errors.length) {
  console.error('Auditoría ChuteMundo 6.1: FALLÓ');
  errors.forEach((error) => console.error(' - ' + error));
  process.exit(1);
}
console.log('Auditoría ChuteMundo 6.1: OK');
