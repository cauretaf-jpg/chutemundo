import fs from 'node:fs';
import path from 'node:path';

const read = (file) => fs.readFileSync(file, 'utf8');
const errors = [];
const ok = (condition, message) => { if (!condition) errors.push(message); };

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const version = read('public/version.js');
const index = read('public/index.html');
const app = read('public/app.mjs');
const sw = read('public/sw.js');
const bootstrap = read('public/modules/core/bootstrap.mjs');
const splitLoader = read('public/modules/core/split-loader.mjs');
const live = read('public/modules/matches/live-access.mjs');
const enhancements = read('public/modules/ui/enhancements.mjs');
const playerIds = read('public/modules/data/player-ids.mjs');
const core0 = read('public/modules/core/app-part-00.txt');
const core1 = read('public/modules/core/app-part-01.txt');
const rules = read('firestore.rules');
const vercel = read('vercel.json');

ok(version.includes("const VERSION = '6.0.2'") && version.includes('CHUTE_APP_VERSION = VERSION'), 'version.js no declara v6.0.2.');
ok(index.includes('/version.js'), 'index.html no carga la versión canónica.');
ok(index.includes('/app.mjs?v=6.0.2'), 'index.html no carga app.mjs.');
ok(!index.includes('/chute-official.mjs'), 'index.html todavía carga el entrypoint versionado antiguo.');
ok(app.includes('/modules/core/bootstrap.mjs') && app.includes('/modules/statistics/fifa.mjs'), 'app.mjs no usa la arquitectura modular.');
ok(!app.includes('/modules/dashboard/index.mjs'), 'Inicio todavía carga el dashboard redundante Centro de Jornada.');
ok(read('public/modules/statistics/history-part-09.txt').includes('/styles/history.css'), 'El Archivo Histórico no carga su stylesheet semántico.');
ok(app.includes('/modules/data/player-ids.mjs'), 'app.mjs no activa IDs permanentes de jugadores.');
ok(splitLoader.includes("prefix: 'modules/core/app-part'"), 'El núcleo dividido sigue usando el prefijo antiguo.');
ok(bootstrap.includes('window.CHUTE_APP_VERSION'), 'Bootstrap no consume la versión canónica.');
ok(!live.includes('setInterval(refresh, 1500)'), 'El modo partido mantiene polling cada 1,5 s.');
ok(sw.includes("importScripts('/version.js')") && sw.includes('/app.mjs'), 'Service worker no consume el entrypoint semántico.');
ok(enhancements.includes('historicalRows') && enhancements.includes('ensureMobileNavigation') && enhancements.includes('openPlayerProfile'), 'Faltan mejoras v6 esenciales.');
ok(playerIds.includes("SCHEMA = 'player-ids-v1'") && playerIds.includes('playerId') && playerIds.includes('assistPlayerId'), 'Falta la migración estable de IDs.');
ok(core0.includes('playerIds: {}'), 'El estado vacío no reserva playerIds.');
ok(core1.includes('playerIdentitySchema'), 'normalizeState no conserva el esquema de identidad.');
ok(rules.includes('request.auth.token.admin == true') && rules.includes("request.auth.token.role == 'admin'"), 'Firestore no está preparado para claims de administrador.');
ok(vercel.includes('max-age=31536000'), 'Vercel no define caché larga para activos.');
ok(!fs.existsSync('supabaseClient.js') && !fs.existsSync('supabase/schema.sql'), 'Supabase sigue en el runtime activo.');
ok(!fs.existsSync('data.js') && !fs.existsSync('app.js') && !fs.existsSync('index.html'), 'El runtime legado raíz sigue activo.');

const runtimeFiles = ['public/app.mjs', ...walk('public/modules').filter((file) => /\.(?:mjs|js|txt)$/.test(file))];
const legacyPath = /['"`]\/chute-v\d/i;
for (const file of runtimeFiles) {
  const source = read(file);
  if (legacyPath.test(source)) errors.push(`${file} todavía referencia una ruta /chute-v*.`);
}

const workflows = fs.existsSync('.github/workflows') ? fs.readdirSync('.github/workflows').filter((name) => /\.ya?ml$/.test(name)) : [];
ok(workflows.length === 1 && workflows[0] === 'ci.yml', `Workflows activos inesperados: ${workflows.join(', ')}`);

if (errors.length) {
  console.error('Auditoría ChuteMundo 6: FALLÓ');
  errors.forEach((error) => console.error(' - ' + error));
  process.exit(1);
}

console.log('Auditoría ChuteMundo 6: OK');
console.log('Arquitectura semántica, PWA, datos, IDs y CI consolidados.');
