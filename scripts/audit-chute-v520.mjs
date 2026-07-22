import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const readPublic = (name) => readFile(path.join(publicDir, name), 'utf8');
const parts = await Promise.all(Array.from({ length: 8 }, (_, index) => readPublic(`chute-v520-stats-part-${String(index).padStart(2, '0')}.txt`)));
const [official, index, sw, loader, css, sync, guard] = await Promise.all([
  readPublic('chute-official.mjs'), readPublic('index.html'), readPublic('sw.js'), readPublic('chute-v520-stats.mjs'),
  readPublic('chute-v520-stats.css'), readPublic('chute-v520-stats-sync.mjs'), readPublic('chute-v520-stats-guard.mjs')
]);
const stats = parts.join('');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

check(pkg.version === '5.20.0', 'package.json no está en v5.20.0.');
check(index.includes('Chute Mundo v5.20') && index.includes('/chute-official.mjs?v=5.20.0'), 'index.html no usa la entrada v5.20.0.');
check(loader.includes("count: 8") && loader.includes("version: '5.20.0'"), 'El cargador estadístico v5.20 no declara sus ocho partes.');
check(official.includes('/chute-v520-stats.mjs?v=5.20.0') && official.includes('/chute-v520-stats-sync.mjs?v=5.20.0') && official.includes('/chute-v520-stats-guard.mjs?v=5.20.0'), 'La entrada no carga el centro v5.20 completo.');
for (const legacy of ['chute-v5183-stats-preflight.mjs', 'chute-v519-stats.mjs', 'chute-v58-analysis.mjs']) check(!official.includes(legacy), `La entrada todavía carga ${legacy}.`);
check(stats.includes("['analysis', 'Análisis histórico'") && stats.includes("['scorers', 'Goleadores'") && stats.includes("['assists', 'Asistidores'") && stats.includes("['keepers', 'Portería imbatida'"), 'Faltan secciones estadísticas obligatorias.');
check(stats.includes('data-cm-v520-filter="era"') && stats.includes('data-cm-v520-filter="tournament"') && stats.includes('data-cm-v520-filter="team"'), 'Faltan filtros globales de era, torneo o equipo.');
check(stats.includes('function parseMetricEntry') && stats.includes('Math.max(current.value, detail.value)'), 'La lectura histórica no protege contra formatos antiguos o duplicados.');
check(stats.includes('function goalkeeperRows') && stats.includes('participationTracked') && stats.includes('cleanSheets'), 'La tabla de portería imbatida está incompleta.');
check(stats.includes('function analysisPanel') && stats.includes('function rankingChart') && stats.includes('function headToHeadRows') && stats.includes('function minuteRows') && stats.includes('function venueRows'), 'El análisis histórico está incompleto.');
check(stats.includes('scopedMatchRows') && stats.includes("selectedTeam !== 'all'"), 'El análisis no respeta el filtro por equipo.');
check(css.includes('.cm-v520-tabs{display:grid') && css.includes('.cm-v520-analysis-grid') && css.includes('@media(max-width:620px)'), 'El rediseño no cubre escritorio y móvil.');
check(sync.includes('__cmV520StatsSync') && sync.includes('queueStatisticsRefresh'), 'La sincronización v5.20 está incompleta.');
check(guard.includes("const VERSION = '5.20.0'") && guard.includes('divisionsCriticalIssues'), 'La validación de divisiones no está integrada.');
check(sw.includes("const CACHE = 'chute-mundo-v5.20.0'") && sw.includes('/chute-v520-stats.mjs?v=5.20.0') && sw.includes('chute-v520-stats-part-'), 'La PWA no precarga el centro v5.20.');
for (const legacy of ['chute-v5183-stats-preflight.mjs', 'chute-v519-stats.mjs', 'chute-v58-analysis.mjs']) check(!sw.includes(legacy), `La caché todavía precarga ${legacy}.`);

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
check(files.filter((file) => /chute-v520-stats-part-\d{2}\.txt$/.test(file)).length === 8, 'No existen las ocho partes del centro estadístico.');

if (failures.length) {
  console.error('Auditoría Chute Mundo v5.20 fallida:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Auditoría Chute Mundo v5.20 OK');
console.log('- Análisis histórico visible y filtrable.');
console.log('- Rankings de goleadores, asistidores y portería imbatida integrados.');
console.log('- Lectura histórica sin normalización destructiva.');
