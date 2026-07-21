import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const detail = await readFile(path.join(publicDir, 'chute-detail.mjs'), 'utf8');
const official = await readFile(path.join(publicDir, 'chute-official.mjs'), 'utf8');
const loader = await readFile(path.join(publicDir, 'chute-official-loader.mjs'), 'utf8');
const mainPart = await readFile(path.join(publicDir, 'chute-official-part-00.txt'), 'utf8');
const lineups = await readFile(path.join(publicDir, 'chute-v513-lineups.mjs'), 'utf8');
const unified = await readFile(path.join(publicDir, 'chute-v514-unified-match.mjs'), 'utf8');
const polished = await readFile(path.join(publicDir, 'chute-v515-match-center.mjs'), 'utf8');
const v516Loader = await readFile(path.join(publicDir, 'chute-v516-events-stats.mjs'), 'utf8');
const v516 = (await Promise.all(Array.from({ length: 12 }, (_, index) => readFile(path.join(publicDir, `chute-v516-events-stats-part-${String(index).padStart(2, '0')}.txt`), 'utf8')))).join('');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

const failures = [];
const notes = [];
const requireCheck = (condition, message) => { if (!condition) failures.push(message); };

requireCheck(packageJson.version === '5.16.0', 'package.json no esta en v5.16.0.');
requireCheck(detail.indexOf('chute-runtime-v58.mjs') < detail.indexOf('chute-mutation-guard.mjs'), 'El runtime optimizado debe cargarse antes de los modulos periodicos.');
requireCheck(!detail.includes('chute-v56-card-metadata.mjs'), 'El parche redundante de metadatos sigue importandose.');
requireCheck(detail.includes('function loadStatistics()'), 'No existe carga diferida del centro estadistico.');
requireCheck(detail.includes('chute-v58-analysis.mjs'), 'No se carga el analisis historico v5.8.');
requireCheck(detail.includes('[data-cm-mobile-page="estadisticas"]'), 'La navegacion movil no activa la carga estadistica.');
requireCheck(detail.includes('cm-v581-bracket-tabs'), 'No existe la navegacion movil por etapas de la llave.');
requireCheck(detail.includes('MutationObserver(() => {\n    if (!statisticsPage.hidden)'), 'No existe respaldo automatico al mostrar Estadisticas.');
requireCheck(official.includes("chute-official-loader.mjs?v=5.16.0"), 'No se invalida la cache del sistema principal v5.16.');
requireCheck(loader.includes("prefix: 'chute-official-part', count: 6, version: '5.16.0'"), 'El cargador principal no solicita las partes v5.16.');
requireCheck(mainPart.includes('const converted = {\n    ...source,'), 'El normalizador sigue descartando campos extendidos del partido.');
requireCheck(mainPart.includes('specialEvents: Array.isArray(source.specialEvents)') && mainPart.includes("lineups: source.lineups && typeof source.lineups === 'object'"), 'El normalizador no conserva eventos especiales o alineaciones.');
requireCheck(official.includes('ChuteSplitLoader') && official.includes('chute-v59-part'), 'No se carga el centro v5.9 mediante ChuteSplitLoader.');
requireCheck(official.includes('chute-v510-safety.mjs') && official.includes('chute-v510-dashboard.mjs'), 'No se cargan los modulos v5.10.');
requireCheck(official.includes('chute-v511-core.mjs') && official.includes('chute-v511-tournaments.mjs') && official.includes('chute-v511-match-share.mjs'), 'No se cargan los modulos v5.11.');
requireCheck(official.includes('chute-v512-integrity.mjs'), 'No se carga el modulo v5.12.');
requireCheck(official.includes('chute-v513-lineups.mjs?v=5.13.0'), 'No se carga el modulo de planteles y alineaciones v5.13.');
requireCheck(official.includes('chute-v514-unified-match.mjs?v=5.14.0'), 'No se carga el centro de partido unificado v5.14.');
requireCheck(official.includes('chute-v515-match-center.mjs?v=5.15.0'), 'No se carga la mejora visual v5.15.');
requireCheck(official.includes('chute-v516-events-stats.mjs?v=5.16.0'), 'No se carga eventos y estadisticas v5.16.');
requireCheck(official.indexOf('chute-v513-lineups.mjs') < official.indexOf('chute-v514-unified-match.mjs') && official.indexOf('chute-v514-unified-match.mjs') < official.indexOf('chute-v515-match-center.mjs') && official.indexOf('chute-v515-match-center.mjs') < official.indexOf('chute-v516-events-stats.mjs'), 'El orden de capas del centro de partido es incorrecto.');
requireCheck(lineups.includes("const VERSION = '5.13.0'"), 'El modulo de alineaciones no declara v5.13.0.');
requireCheck(lineups.includes("'Davis Bronson', 'MED', 45") && lineups.includes("'Jackie Sánchez', 'MED', 45"), 'Las posiciones oficiales corregidas no estan presentes.');
requireCheck(unified.includes('eligiblePlayers') && !unified.includes('usedPlayers(lineup)'), 'El reingreso de jugadores no se conserva.');
requireCheck(polished.includes('syncSubstitutionEvents') && polished.includes("kind: 'substitution'"), 'Los cambios no se guardan como eventos oficiales.');
requireCheck(v516Loader.includes("prefix: 'chute-v516-events-stats-part'") && v516Loader.includes('count: 12'), 'El cargador v5.16 no solicita sus 12 partes.');
requireCheck(v516.includes("const VERSION = '5.16.0'"), 'El modulo funcional no declara v5.16.0.');
requireCheck(v516.includes('data-cm-v516-goal-minute') && v516.includes('data-cm-v516-card-minute') && v516.includes('data-cm-v516-sub-minute'), 'Faltan minutos independientes por evento.');
requireCheck(v516.includes('groupedPlayerOptions') && v516.includes('EN CANCHA') && v516.includes('selección flexible'), 'La seleccion de jugadores no distingue quienes estan en cancha.');
requireCheck(v516.includes("const DEFAULT_VENUES = [\"Wladi's House\", \"Carlo's House\"]") && v516.includes('data-cm-v516-add-venue'), 'Faltan las sedes oficiales o la creacion de nuevas sedes.');
requireCheck(v516.includes('penaltyShootout') && v516.includes('shootoutStarted') && v516.includes('Iniciar tanda después de 120'), 'La tanda de Play-Off no esta implementada correctamente.');
requireCheck(v516.includes('function playerStats') && v516.includes('goalsConcededAverage') && v516.includes('cleanSheets'), 'Faltan estadisticas de jugadores o porteros.');
requireCheck(v516.includes("item.textContent.includes('Titularidades')") && v516.includes('item.remove()'), 'No se elimina Titularidades del perfil.');
requireCheck(v516.includes('data-cm-v516-undo') && v516.includes('undoLatestEvent'), 'La correccion unificada de eventos no esta instalada.');

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
notes.push(`JavaScript publico: ${jsFiles.length} archivos, ${totalBytes} bytes.`);
notes.push(`Llamadas setInterval detectadas: ${intervalCalls}; quedan centralizadas por chute-runtime-v58.`);
notes.push(`MutationObserver explicitos: ${mutationObservers}; protegidos por chute-mutation-guard.`);

const imports = [...detail.matchAll(/import\(['"]([^'"]+)/g)].map((match) => match[1]);
const officialImports = [...official.matchAll(/import\(['"]([^'"]+)/g)].map((match) => match[1]);
const duplicates = [...imports, ...officialImports].filter((item, index, list) => list.indexOf(item) !== index);
requireCheck(duplicates.length === 0, `Importaciones duplicadas: ${duplicates.join(', ')}`);

if (failures.length) {
  console.error('Auditoria v5.16.0 fallida:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Auditoria v5.16.0 OK');
notes.forEach((note) => console.log(`- ${note}`));
