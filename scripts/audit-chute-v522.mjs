import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const readPublic = (name) => readFile(path.join(publicDir, name), 'utf8');
const [official, index, sw, bootstrap, refinement, refinementCss, historyLoader, historyCss] = await Promise.all([
  readPublic('chute-official.mjs'),
  readPublic('index.html'),
  readPublic('sw.js'),
  readPublic('chute-bootstrap.mjs'),
  readPublic('chute-v522-stats-refinement.mjs'),
  readPublic('chute-v522-stats-refinement.css'),
  readPublic('chute-v521-history.mjs'),
  readPublic('chute-v521-history.css')
]);
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

check(pkg.version === '5.22.0', 'package.json no está en v5.22.0.');
check(index.includes('Chute Mundo v5.22.0 · Competición') && index.includes('/chute-official.mjs?v=5.22.0'), 'index.html no usa v5.22.0.');
check(bootstrap.includes("const APP_VERSION = '5.22.0'"), 'El bootstrap no fija v5.22.0.');
check(official.includes('/chute-v521-history.mjs?v=5.22.0') && official.includes('/chute-v522-stats-refinement.mjs?v=5.22.0'), 'La entrada no carga el refinamiento estadístico v5.22.');
check(sw.includes("const CACHE = 'chute-mundo-v5.22.0'") && sw.includes('chute-v522-stats-refinement.mjs?v=5.22.0'), 'La PWA no precarga v5.22.');
check(historyLoader.includes('count: 10'), 'El cargador del Archivo Histórico perdió sus diez partes.');
check(historyCss.includes('.cm-v521-toolbar{position:sticky'), 'La base histórica cambió inesperadamente; la corrección debe vivir en v5.22.');
check(refinementCss.includes('.cm-v521-toolbar{position:static!important'), 'Los filtros globales siguen flotantes.');
check(refinementCss.includes('.cm-v521-tabs{display:flex!important') && refinementCss.includes('border-radius:999px'), 'La navegación estadística no está compactada.');
for (const [team, color] of Object.entries({ polpetta: '#7c3aed', parrilla: '#dc2626', guanaco: '#f97316', perla: '#fb923c', trucha: '#38bdf8', pantera: '#111827' })) {
  check(refinement.includes(`${team}: '${color}'`), `Falta el color oficial de ${team}.`);
}
check(refinement.includes('Evolución de la Tabla Eterna') && refinement.includes('smoothPath') && refinement.includes('cm-v522-chart-legend'), 'El gráfico histórico estético está incompleto.');
check(refinement.includes("const DEFAULT_VENUE = \"Carloco's House\""), 'No se define Carloco\'s House como sede predeterminada.');
check(refinement.includes("return \"Wladi's House\"") && refinement.includes("return DEFAULT_VENUE"), 'La consolidación de sedes está incompleta.');
check(refinement.includes('match.venue = venue') && refinement.includes('core.saveCloud'), 'La migración de sedes no persiste los cambios.');
check(refinement.includes('Líderes acumulados') && refinement.includes('Torneos finalizados'), 'El nuevo Resumen no entrega datos concretos.');
check(refinement.includes('Campeón en') && refinement.includes('Subcampeón en') && refinement.includes('Tercer lugar en') && refinement.includes('Próximamente'), 'La trayectoria de equipos no muestra los podios y próximos torneos.');
check(refinement.includes("removeColumnByHeader(table, 'Torneos')"), 'Los rankings todavía conservan la columna Torneos.');
check(refinement.includes('Rendimiento por competencia') && refinement.includes('Registro oficial de escenarios'), 'Faltan las estadísticas ampliadas de torneos o sedes.');
check(refinement.includes("h2h: ['Frente a Frente'") && !refinement.includes("analysis: ['Análisis histórico'"), 'La navegación conserva el botón duplicado de Análisis histórico.');

if (failures.length) {
  console.error('Auditoría Chute Mundo v5.22 fallida:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Auditoría Chute Mundo v5.22 OK');
console.log('- Filtros estáticos y navegación compacta.');
console.log('- Resumen, gráfico y colores oficiales.');
console.log('- Podios, torneos, rankings y sedes consolidadas.');
