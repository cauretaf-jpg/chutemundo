import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const readPublic = (name) => readFile(path.join(publicDir, name), 'utf8');
const [official, index, sw, stats, css, guard, preflight, detail] = await Promise.all([
  readPublic('chute-official.mjs'),
  readPublic('index.html'),
  readPublic('sw.js'),
  readPublic('chute-v519-stats.mjs'),
  readPublic('chute-v519-stats.css'),
  readPublic('chute-v519-stats-guard.mjs'),
  readPublic('chute-v5183-stats-preflight.mjs'),
  readPublic('chute-detail.mjs')
]);
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const failures = [];
const notes = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

check(pkg.version === '5.19.0', 'package.json no está en v5.19.0.');
check(index.includes('Chute Mundo v5.19') && index.includes('/chute-official.mjs?v=5.19.0'), 'index.html no usa la entrada v5.19.0.');
check(official.includes('/chute-v519-stats.mjs?v=5.19.0') && official.includes('/chute-v519-stats-guard.mjs?v=5.19.0'), 'La entrada no carga el centro y guard v5.19.');
check(official.includes('/chute-v5183-stats-preflight.mjs?v=5.18.3'), 'La entrada perdió el normalizador histórico.');
for (const legacy of ['chute-v518-era-stats.mjs','chute-v5181-stats-polish.mjs','chute-v5182-stats-loader.mjs','chute-v5183-stats-recovery.mjs','chute-v58-analysis.mjs','chute-v582-analysis-theme.mjs']) {
  check(!official.includes(legacy), `La entrada todavía carga ${legacy}.`);
}
check(official.includes('pageBeforeStatistics') && official.includes("navigate?.(pageBeforeStatistics)"), 'La entrada no restaura la página activa después del arranque estadístico.');
check(stats.includes("const VERSION = '5.19.0'") && stats.includes("['analysis', 'Análisis histórico']"), 'El centro v5.19 no declara la pestaña Análisis histórico.');
check(stats.includes("['scorers', 'Goleadores']") && stats.includes("['assists', 'Asistencias']") && stats.includes("['keepers', 'Portería imbatida']"), 'Faltan rankings individuales obligatorios.');
check(stats.includes('data-cm-v519-filter="era"') && stats.includes('data-cm-v519-filter="tournament"') && stats.includes('data-cm-v519-filter="team"'), 'Faltan filtros globales de era, torneo o equipo.');
check(stats.includes('function tournamentMetricRows') && stats.includes('Math.max(current.value, detail.value)'), 'La consolidación histórica puede duplicar goles o asistencias.');
check(stats.includes('function goalkeeperRows') && stats.includes('cleanSheets') && stats.includes('goalsConceded'), 'La tabla de portería imbatida está incompleta.');
check(stats.includes('function analysisPanel') && stats.includes('function rankingChart') && stats.includes('function headToHeadRows') && stats.includes('function minuteRows') && stats.includes('function venueRows'), 'El análisis histórico integrado está incompleto.');
check(!stats.includes("import('/chute-v58-analysis.mjs"), 'El centro v5.19 todavía depende del análisis v5.8.');
check(css.includes('#cmV519Stats') && css.includes('.cm-v519-analysis-grid') && css.includes('.cm-v519-leaders') && css.includes('@media(max-width:760px)'), 'El rediseño v5.19 no cubre escritorio y móvil.');
check(css.includes('#cmV58AnalysisRoot') && css.includes('#cmV518Stats'), 'La hoja v5.19 no neutraliza centros estadísticos anteriores.');
check(guard.includes('function divisionsCriticalIssues') && guard.includes('function validShootout') && guard.includes('data-cm-v517-confirm-finish'), 'Se perdió la validación de cierre de la Era de divisiones.');
check(preflight.includes('installSetStateGuard') && preflight.includes('normalizeMetricRows'), 'El normalizador previo a Firebase está incompleto.');
check(sw.includes("const CACHE = 'chute-mundo-v5.19.0'") && sw.includes('/chute-v519-stats.mjs?v=5.19.0') && sw.includes('function networkFirst'), 'La PWA no usa caché v5.19 con estrategia de actualización segura.');
for (const legacy of ['chute-v518-era-stats.mjs','chute-v5181-stats-polish.mjs','chute-v5182-stats-loader.mjs','chute-v58-analysis.mjs']) {
  check(!sw.includes(legacy), `El service worker todavía precarga ${legacy}.`);
}
check(detail.includes('function loadStatistics()'), 'La capa de detalle perdió la delegación de navegación estadística.');

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
const javascript = files.filter((file) => /\.(?:mjs|js)$/.test(file));
const totalBytes = (await Promise.all(javascript.map(async (file) => (await stat(file)).size))).reduce((sum, size) => sum + size, 0);
notes.push(`${javascript.length} módulos JavaScript públicos; ${totalBytes} bytes.`);
notes.push('Las capas estadísticas v5.8/v5.18 permanecen como archivos históricos, pero no forman parte de la entrada ni de la caché v5.19.');

if (failures.length) {
  console.error('Auditoría Chute Mundo v5.19 fallida:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Auditoría Chute Mundo v5.19 OK');
notes.forEach((note) => console.log(`- ${note}`));
