import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const readPublic = (name) => readFile(path.join(publicDir, name), 'utf8');
const parts = await Promise.all(Array.from({ length: 8 }, (_, index) => readPublic(`chute-v520-stats-part-${String(index).padStart(2, '0')}.txt`)));
const [official, index, sw, loader, bootstrap, css, sync, guard] = await Promise.all([
  readPublic('chute-official.mjs'), readPublic('index.html'), readPublic('sw.js'), readPublic('chute-v520-stats.mjs'),
  readPublic('chute-bootstrap.mjs'), readPublic('chute-v520-stats.css'), readPublic('chute-v520-stats-sync.mjs'), readPublic('chute-v520-stats-guard.mjs')
]);
const stats = parts.join('');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

check(pkg.version === '5.20.1', 'package.json no está en v5.20.1.');
check(index.includes('Chute Mundo v5.20.1') && index.includes('/chute-official.mjs?v=5.20.1'), 'index.html no usa la entrada v5.20.1.');
check(loader.includes("count: 8") && loader.includes("version: '5.20.1'"), 'El cargador estadístico no invalida sus ocho partes en v5.20.1.');
check(official.startsWith("await import('/chute-bootstrap.mjs?v=5.20.1')"), 'El arranque estable no se carga antes del sistema.');
check(official.includes('/chute-v520-stats.mjs?v=5.20.1') && official.includes('/chute-v520-stats-sync.mjs?v=5.20.1') && official.includes('/chute-v520-stats-guard.mjs?v=5.20.1'), 'La entrada no carga el centro v5.20.1 completo.');
check(!official.includes('pageBeforeStatistics') && official.includes('chute:boot-complete'), 'La entrada todavía contiene restauración estadística heredada o no finaliza el arranque.');
for (const legacy of ['chute-v5183-stats-preflight.mjs', 'chute-v519-stats.mjs', 'chute-v58-analysis.mjs']) check(!official.includes(legacy), `La entrada todavía carga ${legacy}.`);
check(bootstrap.includes("const APP_VERSION = '5.20.1'") && bootstrap.includes('resetLegacyRuntimeOnce') && bootstrap.includes('registration.unregister()'), 'El arranque no limpia service workers antiguos.');
check(bootstrap.includes("name.startsWith('chute-mundo-')") && bootstrap.includes('window.location.replace') && bootstrap.includes("core.navigate('inicio')"), 'La limpieza de caché o la restauración de Inicio está incompleta.');
check(bootstrap.includes('MutationObserver') && bootstrap.includes('document.title !== APP_TITLE'), 'La versión del título no está protegida contra módulos heredados.');
check(stats.includes("['analysis', 'Análisis histórico'") && stats.includes("['scorers', 'Goleadores'") && stats.includes("['assists', 'Asistidores'") && stats.includes("['keepers', 'Portería imbatida'"), 'Faltan secciones estadísticas obligatorias.');
check(stats.includes('data-cm-v520-filter="era"') && stats.includes('data-cm-v520-filter="tournament"') && stats.includes('data-cm-v520-filter="team"'), 'Faltan filtros globales de era, torneo o equipo.');
check(stats.includes('function parseMetricEntry') && stats.includes('Math.max(current.value, detail.value)'), 'La lectura histórica no protege contra formatos antiguos o duplicados.');
check(stats.includes('function goalkeeperRows') && stats.includes('participationTracked') && stats.includes('cleanSheets'), 'La tabla de portería imbatida está incompleta.');
check(stats.includes('function analysisPanel') && stats.includes('function rankingChart') && stats.includes('function headToHeadRows') && stats.includes('function minuteRows') && stats.includes('function venueRows'), 'El análisis histórico está incompleto.');
check(stats.includes('scopedMatchRows') && stats.includes("selectedTeam !== 'all'"), 'El análisis no respeta el filtro por equipo.');
check(!stats.includes("document.title = 'Chute Mundo"), 'El centro estadístico todavía modifica el título global.');
check(css.includes('.cm-v520-tabs{display:grid') && css.includes('.cm-v520-analysis-grid') && css.includes('@media(max-width:620px)'), 'El rediseño no cubre escritorio y móvil.');
check(sync.includes('window.ChuteVersion?.version') && sync.includes('__cmV520StatsSync'), 'La sincronización no usa la versión global.');
check(guard.includes('window.ChuteVersion?.version') && guard.includes('divisionsCriticalIssues'), 'La validación de divisiones no usa la versión global.');
check(sw.includes("const CACHE = 'chute-mundo-v5.20.1'") && sw.includes('/chute-bootstrap.mjs?v=5.20.1') && sw.includes('/chute-v520-stats.mjs?v=5.20.1'), 'La PWA no precarga el arranque v5.20.1.');
check(sw.includes('self.clients.claim()') && sw.includes("fetch(request, { cache: 'no-store' })"), 'El service worker no reemplaza inmediatamente la caché anterior.');
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
  console.error('Auditoría Chute Mundo v5.20.1 fallida:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Auditoría Chute Mundo v5.20.1 OK');
console.log('- Título y versión centralizados.');
console.log('- Caché y service workers antiguos se eliminan una sola vez.');
console.log('- El arranque finaliza en Inicio sin navegación automática a Estadísticas.');
