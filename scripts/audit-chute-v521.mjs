import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const readPublic = (name) => readFile(path.join(publicDir, name), 'utf8');
const parts = await Promise.all(Array.from({ length: 10 }, (_, index) => readPublic(`chute-v521-history-part-${String(index).padStart(2, '0')}.txt`)));
const [official, index, sw, loader, css, sync, bootstrap] = await Promise.all([
  readPublic('chute-official.mjs'), readPublic('index.html'), readPublic('sw.js'), readPublic('chute-v521-history.mjs'),
  readPublic('chute-v521-history.css'), readPublic('chute-v521-history-sync.mjs'), readPublic('chute-bootstrap.mjs')
]);
const history = parts.join('');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

check(pkg.version === '5.21.0', 'package.json no está en v5.21.0.');
check(index.includes('Chute Mundo v5.21.0 · Competición') && index.includes('/chute-official.mjs?v=5.21.0'), 'index.html no usa v5.21.0.');
check(bootstrap.includes("const APP_VERSION = '5.21.0'"), 'El bootstrap no fija v5.21.0.');
check(loader.includes("count: 10") && loader.includes("version: '5.21.0'"), 'El cargador histórico no declara sus diez partes.');
check(official.includes('/chute-v521-history.mjs?v=5.21.0') && official.includes('/chute-v521-history-sync.mjs?v=5.21.0'), 'La entrada no carga el Archivo Histórico v5.21.');
check(!official.includes('/chute-v520-stats.mjs'), 'La entrada todavía carga el centro v5.20.');
for (const label of ['La Tabla Eterna', 'Rankings Históricos', 'Salón de la Gloria', 'Archivo de Campeones', 'Libro de Récords', 'Historia Frente a Frente']) check(history.includes(label), `Falta la sección ${label}.`);
for (const filter of ['era', 'tournament', 'format', 'status', 'team']) check(history.includes(`data-cm-v521-filter="${filter}"`), `Falta el filtro global ${filter}.`);
check(history.includes('points: row.pg * 3 + row.pe'), 'La Tabla Eterna no calcula puntos acumulados.');
check(history.includes('playerAwardRecords') && history.includes('teamHonoursRows'), 'El palmarés no procesa premios de equipos y jugadores.');
check(history.includes('champion') && history.includes('runnerUp') && history.includes('third'), 'El Archivo de Campeones no contiene el podio completo.');
check(history.includes('careerMetricRows') && history.includes('goalkeeperCareerRows') && history.includes('teamCleanSheetRows'), 'Faltan rankings acumulados.');
check(history.includes('streakRecords') && history.includes('recordBook') && history.includes('h2hSummary'), 'Faltan récords o enfrentamientos directos.');
check(css.includes('.cm-v521-tabs') && css.includes('.cm-v521-record-grid') && css.includes('@media(max-width:500px)'), 'El diseño no cubre navegación, récords y móvil.');
check(sync.includes('__cmV521HistorySync'), 'La sincronización v5.21 está incompleta.');
check(sw.includes("const CACHE = 'chute-mundo-v5.21.0'") && sw.includes('chute-v521-history-part-'), 'La PWA no precarga v5.21.');
check(!sw.includes('chute-v520-stats.mjs'), 'La PWA todavía precarga el centro v5.20.');

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory)) {
    const full = path.join(directory, entry);
    const info = await stat(full);
    if (info.isDirectory()) output.push(...await walk(full));
    else output.push(full);
  }
  return output;
}
const files = await walk(publicDir);
check(files.filter((file) => /chute-v521-history-part-\d{2}\.txt$/.test(file)).length === 10, 'No existen las diez partes del Archivo Histórico.');

if (failures.length) {
  console.error('Auditoría Chute Mundo v5.21 fallida:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Auditoría Chute Mundo v5.21 OK');
console.log('- Tabla Eterna y rankings acumulados.');
console.log('- Palmarés oficial y Archivo de Campeones.');
console.log('- Récords y enfrentamientos directos filtrables.');
