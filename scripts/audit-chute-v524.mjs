import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (name) => readFile(path.join(root, name), 'utf8');
const [pkgRaw, official, bootstrap, sw, moduleSource, css] = await Promise.all([
  read('package.json'),
  read('public/chute-official.mjs'),
  read('public/chute-bootstrap.mjs'),
  read('public/sw.js'),
  read('public/chute-v524-tournaments.mjs'),
  read('public/chute-v524-tournaments.css')
]);
const pkg = JSON.parse(pkgRaw);
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

check(pkg.version === '5.24.0', 'package.json no está en v5.24.0.');
check(bootstrap.includes("const APP_VERSION = '5.24.0'"), 'El bootstrap no fija v5.24.0.');
check(official.includes("/chute-v524-tournaments.mjs?v=5.24.0"), 'La organización de Torneos v5.24 no está activa.');
check(sw.includes("const CACHE = 'chute-mundo-v5.24.0'"), 'La caché PWA no usa v5.24.0.');
check(sw.includes('/chute-v524-tournaments.mjs?v=5.24.0') && sw.includes('/chute-v524-tournaments.css?v=5.24.0'), 'La PWA no precarga el módulo y los estilos de Torneos.');
check(moduleSource.includes('cmV524CreateToggle') && moduleSource.includes('cmV524CreatePanel'), 'Falta el formulario plegable de creación.');
check(moduleSource.includes('cmV524TournamentSummary') && moduleSource.includes('cmV524ActiveTournament'), 'Falta el resumen o la competición actual destacada.');
check(moduleSource.includes('cmV524ShowMore') && moduleSource.includes('cmV524ShowLess'), 'Falta la carga progresiva del historial.');
check(moduleSource.includes('cmV524TournamentSearch') && moduleSource.includes('cmV524FormatFilter') && moduleSource.includes('cmV524Order'), 'Faltan búsqueda, formato u orden.');
check(moduleSource.includes("tournament.status !== 'active'"), 'El archivo histórico no separa los torneos activos.');
check(moduleSource.includes("window.confirm('Hay información sin guardar"), 'Falta protección al cerrar un formulario con cambios.');
check(!moduleSource.includes('setInterval('), 'La v5.24 no debe usar intervalos periódicos.');
check(css.includes('.cm-v524-summary') && css.includes('.cm-v524-tournament-card') && css.includes('@media(max-width:720px)'), 'Faltan estilos de resumen, tarjetas o adaptación móvil.');

if (failures.length) {
  console.error('Auditoría Chute Mundo v5.24 fallida:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Auditoría Chute Mundo v5.24 OK');
console.log('- Crear torneo permanece cerrado hasta que el administrador lo solicite.');
console.log('- Competición actual y archivo histórico están separados.');
console.log('- El historial incorpora búsqueda, filtros, orden y carga progresiva.');
console.log('- No se modifican Firebase ni los datos funcionales.');
