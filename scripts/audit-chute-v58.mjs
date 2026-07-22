import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const read = (name) => readFile(path.join(publicDir, name), 'utf8');
const detail = await read('chute-detail.mjs');
const official = await read('chute-official.mjs');
const loader = await read('chute-official-loader.mjs');
const mainPart = await read('chute-official-part-00.txt');
const lineups = await read('chute-v513-lineups.mjs');
const unified = await read('chute-v514-unified-match.mjs');
const polished = await read('chute-v515-match-center.mjs');
const v516Loader = await read('chute-v516-events-stats.mjs');
const v516 = (await Promise.all(Array.from({ length: 12 }, (_, index) => read(`chute-v516-events-stats-part-${String(index).padStart(2, '0')}.txt`)))).join('');
const playoff = await read('chute-v5162-playoff-seeding.mjs');
const v517Loader = await read('chute-v517-finalization.mjs');
const v517 = (await Promise.all(Array.from({ length: 8 }, (_, index) => read(`chute-v517-finalization-part-${String(index).padStart(2, '0')}.txt`)))).join('');
const v518Loader = await read('chute-v518-era-stats.mjs');
const v518 = (await Promise.all(Array.from({ length: 6 }, (_, index) => read(`chute-v518-era-stats-part-${String(index).padStart(2, '0')}.txt`)))).join('');
const v5181 = await read('chute-v5181-stats-polish.mjs');
const v5181Css = await read('chute-v5181-stats-polish.css');
const v5182 = await read('chute-v5182-stats-loader.mjs');
const preflight = await read('chute-v5183-stats-preflight.mjs');
const recovery = await read('chute-v5183-stats-recovery.mjs');
const sw = await read('sw.js');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

const failures = [];
const notes = [];
const requireCheck = (condition, message) => { if (!condition) failures.push(message); };

requireCheck(packageJson.version === '5.18.3', 'package.json no está en v5.18.3.');
requireCheck(detail.indexOf('chute-runtime-v58.mjs') < detail.indexOf('chute-mutation-guard.mjs'), 'El runtime optimizado debe cargarse antes del guard de mutaciones.');
requireCheck(detail.includes('function loadStatistics()') && detail.includes('function loadHistoricalAnalysis()'), 'No existe separación entre estadísticas actuales y análisis histórico.');
requireCheck(!detail.includes("import('/chute-stats-v52.mjs") && !detail.includes("import('/chute-game-minute-stats.mjs") && !detail.includes("import('/chute-v57-controllers.mjs") && !detail.includes("import('/chute-v58-visibility.mjs"), 'La vista normal sigue importando centros estadísticos heredados.');
requireCheck(official.includes('chute-v5183-stats-preflight.mjs?v=5.18.3'), 'La entrada no carga el normalizador histórico v5.18.3.');
requireCheck(official.includes('try {') && official.includes('chute-v5183-stats-recovery.mjs?v=5.18.3'), 'La entrada no posee recuperación del centro estadístico.');
requireCheck(official.indexOf('chute-v5183-stats-preflight.mjs') < official.indexOf('chute-v518-era-stats.mjs'), 'El preflight debe ejecutarse antes del centro v5.18.');
requireCheck(official.includes('chute-v518-era-stats.mjs?v=5.18.3') && official.includes('chute-v5182-stats-loader.mjs?v=5.18.3'), 'La entrada no usa los recursos estadísticos v5.18.3.');
requireCheck(loader.includes("prefix: 'chute-official-part', count: 6, version: '5.16.0'"), 'El cargador principal estable cambió inesperadamente.');
requireCheck(mainPart.includes('const converted = {\n    ...source,') && mainPart.includes('specialEvents: Array.isArray(source.specialEvents)'), 'El normalizador principal no conserva campos extendidos.');
requireCheck(lineups.includes("const VERSION = '5.13.0'"), 'El módulo de alineaciones no declara v5.13.0.');
requireCheck(unified.includes('eligiblePlayers') && !unified.includes('usedPlayers(lineup)'), 'El reingreso de jugadores no se conserva.');
requireCheck(polished.includes('syncSubstitutionEvents') && polished.includes("kind: 'substitution'"), 'Los cambios no se guardan como eventos oficiales.');
requireCheck(v516Loader.includes('count: 12') && v516.includes('function playerStats'), 'La capa funcional v5.16 está incompleta.');
requireCheck(playoff.includes("homeRef: 'TABLE_1', awayRef: 'TABLE_4'"), 'La siembra correcta del Play-Off no está presente.');
requireCheck(v517Loader.includes('count: 8') && v517.includes('function computeAwards') && v517.includes('function qualityIssues'), 'La capa de premios y cierre v5.17 está incompleta.');
requireCheck(v518Loader.includes('count: 6') && v518Loader.includes("version: '5.18.3'"), 'El cargador v5.18 no solicita las partes con caché v5.18.3.');
requireCheck(v518.includes("const CUTOFF_NAME = '8vo Torneo - Copa'") && v518.includes('function inferCoverage') && v518.includes('function renderShell'), 'El centro estadístico avanzado está incompleto.');
requireCheck(v5181.includes('data-cm-v5181-analysis') && v5181Css.includes('#cmV58ModeSwitch{display:none!important}'), 'La pestaña de análisis histórico no está integrada.');
requireCheck(preflight.includes("const VERSION = '5.18.3'") && preflight.includes('normalizeMetricRow') && preflight.includes('inferTeamId') && preflight.includes('Object.values(rows)'), 'El preflight no admite arreglos, objetos y mapas históricos.');
requireCheck(recovery.includes("const VERSION = '5.18.3'") && recovery.includes('Modo de compatibilidad estadística') && recovery.includes('function renderShell'), 'La recuperación visible v5.18.3 está incompleta.');
requireCheck(v5182.includes("const VERSION = '5.18.3'") && v5182.includes('activateRecovery') && v5182.includes('unhandledrejection'), 'El coordinador no captura fallos estadísticos tardíos.');
requireCheck(sw.includes("const CACHE = 'chute-mundo-v5.18.3'") && sw.includes('chute-v5183-stats-preflight.mjs?v=5.18.3') && sw.includes('chute-v5183-stats-recovery.mjs?v=5.18.3'), 'La PWA no precarga la corrección v5.18.3.');

async function walk(directory) {
  const result = [];
  for (const entry of await readdir(directory)) {
    const full = path.join(directory, entry);
    const info = await stat(full);
    if (info.isDirectory()) result.push(...await walk(full));
    else result.push(full);
  }
  return result;
}

const files = await walk(publicDir);
const jsFiles = files.filter((file) => /\.(mjs|js)$/.test(file));
let totalBytes = 0;
let intervalCalls = 0;
let mutationObservers = 0;
for (const file of jsFiles) {
  const content = await readFile(file, 'utf8');
  totalBytes += Buffer.byteLength(content);
  intervalCalls += (content.match(/setInterval\s*\(/g) || []).length;
  mutationObservers += (content.match(/new\s+MutationObserver\s*\(/g) || []).length;
}
notes.push(`JavaScript público: ${jsFiles.length} archivos, ${totalBytes} bytes.`);
notes.push(`Llamadas setInterval detectadas: ${intervalCalls}.`);
notes.push(`MutationObserver explícitos: ${mutationObservers}.`);

const imports = [...detail.matchAll(/import\(['"]([^'"]+)/g)].map((match) => match[1]);
const officialImports = [...official.matchAll(/import\(['"]([^'"]+)/g)].map((match) => match[1]);
const duplicates = [...imports, ...officialImports].filter((item, index, list) => list.indexOf(item) !== index);
requireCheck(duplicates.length === 0, `Importaciones duplicadas: ${duplicates.join(', ')}`);

if (failures.length) {
  console.error('Auditoría v5.18.3 fallida:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Auditoría v5.18.3 OK');
notes.forEach((note) => console.log(`- ${note}`));
