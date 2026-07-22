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
const playoff = await readFile(path.join(publicDir, 'chute-v5162-playoff-seeding.mjs'), 'utf8');
const v517Loader = await readFile(path.join(publicDir, 'chute-v517-finalization.mjs'), 'utf8');
const v517 = (await Promise.all(Array.from({ length: 8 }, (_, index) => readFile(path.join(publicDir, `chute-v517-finalization-part-${String(index).padStart(2, '0')}.txt`), 'utf8')))).join('');
const v518Loader = await readFile(path.join(publicDir, 'chute-v518-era-stats.mjs'), 'utf8');
const v518 = (await Promise.all(Array.from({ length: 6 }, (_, index) => readFile(path.join(publicDir, `chute-v518-era-stats-part-${String(index).padStart(2, '0')}.txt`), 'utf8')))).join('');
const v5181 = await readFile(path.join(publicDir, 'chute-v5181-stats-polish.mjs'), 'utf8');
const v5181Css = await readFile(path.join(publicDir, 'chute-v5181-stats-polish.css'), 'utf8');
const v5182 = await readFile(path.join(publicDir, 'chute-v5182-stats-loader.mjs'), 'utf8');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

const failures = [];
const notes = [];
const requireCheck = (condition, message) => { if (!condition) failures.push(message); };

requireCheck(packageJson.version === '5.18.2', 'package.json no esta en v5.18.2.');
requireCheck(detail.indexOf('chute-runtime-v58.mjs') < detail.indexOf('chute-mutation-guard.mjs'), 'El runtime optimizado debe cargarse antes de los modulos periodicos.');
requireCheck(!detail.includes('chute-v56-card-metadata.mjs'), 'El parche redundante de metadatos sigue importandose.');
requireCheck(detail.includes('function loadStatistics()') && detail.includes('function loadHistoricalAnalysis()'), 'No existe separacion entre estadisticas actuales y analisis historico.');
requireCheck(detail.includes("import('/chute-v58-analysis.mjs?v=5.18.2')"), 'El analisis historico no se carga bajo demanda.');
requireCheck(!detail.includes("import('/chute-stats-v52.mjs") && !detail.includes("import('/chute-game-minute-stats.mjs") && !detail.includes("import('/chute-v57-controllers.mjs") && !detail.includes("import('/chute-v58-visibility.mjs"), 'La vista normal sigue importando centros estadisticos heredados.');
requireCheck(detail.includes('[data-cm-mobile-page="estadisticas"]'), 'La navegacion movil no activa la carga estadistica.');
requireCheck(detail.includes('cm-v581-bracket-tabs'), 'No existe la navegacion movil por etapas de la llave.');
requireCheck(detail.includes('MutationObserver(() => {\n    if (!statisticsPage.hidden)'), 'No existe respaldo automatico al mostrar Estadisticas.');
requireCheck(official.includes("chute-official-loader.mjs?v=5.16.0"), 'No se conserva el cargador principal estable v5.16.');
requireCheck(official.includes("chute-detail.mjs?v=5.18.2"), 'La entrada no renueva el cargador estadistico.');
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
requireCheck(official.includes('chute-v516-events-stats.mjs?v=5.16.1'), 'No se carga la capa estable de eventos v5.16.1.');
requireCheck(official.includes('chute-v5162-playoff-seeding.mjs?v=5.16.3'), 'No se carga la correccion visual de Play-Off v5.16.3.');
requireCheck(official.includes('chute-v517-finalization.mjs?v=5.17.0'), 'No se carga la capa de finalizacion v5.17.');
requireCheck(official.includes('chute-v518-era-stats.mjs?v=5.18.0'), 'No se carga la capa de eras y estadisticas v5.18.');
requireCheck(official.includes('chute-v5181-stats-polish.mjs?v=5.18.1'), 'No se carga la correccion de analisis y textos v5.18.1.');
requireCheck(official.includes('chute-v5182-stats-loader.mjs?v=5.18.2'), 'No se carga el coordinador estadistico v5.18.2.');
requireCheck(official.indexOf('chute-v517-finalization.mjs') < official.indexOf('chute-v518-era-stats.mjs') && official.indexOf('chute-v518-era-stats.mjs') < official.indexOf('chute-v5181-stats-polish.mjs') && official.indexOf('chute-v5181-stats-polish.mjs') < official.indexOf('chute-v5182-stats-loader.mjs'), 'El orden de las capas estadisticas finales es incorrecto.');
requireCheck(lineups.includes("const VERSION = '5.13.0'"), 'El modulo de alineaciones no declara v5.13.0.');
requireCheck(lineups.includes("'Davis Bronson', 'MED', 45") && lineups.includes("'Jackie Sánchez', 'MED', 45"), 'Las posiciones oficiales corregidas no estan presentes.');
requireCheck(unified.includes('eligiblePlayers') && !unified.includes('usedPlayers(lineup)'), 'El reingreso de jugadores no se conserva.');
requireCheck(polished.includes('syncSubstitutionEvents') && polished.includes("kind: 'substitution'"), 'Los cambios no se guardan como eventos oficiales.');
requireCheck(v516Loader.includes("prefix: 'chute-v516-events-stats-part'") && v516Loader.includes('count: 12') && v516Loader.includes("version: '5.16.1'"), 'El cargador v5.16.1 no solicita sus 12 partes actualizadas.');
requireCheck(v516.includes("const VERSION = '5.16.1'") && v516.includes('data-cm-v516-goal-minute') && v516.includes('function playerStats'), 'La capa funcional v5.16.1 esta incompleta.');
requireCheck(playoff.includes("const VERSION = '5.16.3'") && playoff.includes("homeRef: 'TABLE_1', awayRef: 'TABLE_4'") && playoff.includes('restoreEnhancedTournamentUi'), 'La correccion de Play-Off v5.16.3 esta incompleta.');
requireCheck(v517Loader.includes("prefix: 'chute-v517-finalization-part'") && v517Loader.includes('count: 8') && v517Loader.includes("version: '5.17.0'"), 'El cargador v5.17 no solicita sus ocho partes.');
requireCheck(v517.includes("const VERSION = '5.17.0'") && v517.includes('function computeAwards') && v517.includes('function qualityIssues'), 'El cierre y los premios v5.17 estan incompletos.');
requireCheck(v518Loader.includes("prefix: 'chute-v518-era-stats-part'") && v518Loader.includes('count: 6') && v518Loader.includes("version: '5.18.0'"), 'El cargador v5.18 no solicita sus seis partes.');
requireCheck(v518.includes("const VERSION = '5.18.0'") && v518.includes("const CUTOFF_NAME = '8vo Torneo - Copa'"), 'La version o el punto de corte de eras no son correctos.');
requireCheck(v518.includes("const ERA_LEAGUES = 'leagues'") && v518.includes("const ERA_DIVISIONS = 'divisions'") && v518.includes('function plannedEra'), 'La asignacion explicita de eras no esta implementada.');
requireCheck(v518.includes('function inferCoverage') && v518.includes("none: 'Sin registro'") && v518.includes('function coverageSummary'), 'La cobertura estadistica no distingue ausencia de registro.');
requireCheck(v518.includes('function divisionsCriticalIssues') && v518.includes('falta registrar asistencia o “sin asistencia”'), 'La Era de divisiones no exige registros completos al finalizar.');
requireCheck(v5181.includes("const VERSION = '5.18.1'") && v5181.includes('data-cm-v5181-analysis') && v5181.includes("window.ChuteAnalysisV58.setMode('analysis')"), 'Analisis historico no esta integrado como pestana funcional.');
requireCheck(v5181.includes("setText(pageTitle, 'h1', 'Estadísticas')") && v5181.includes("label.textContent = 'Goleador'") && v5181.includes("hideElement(summary?.querySelector(':scope > .cm-v518-two'))"), 'La limpieza del resumen estadistico no esta completa.');
requireCheck(v5181.includes("tournament.eraId === 'divisions'") && v5181.includes("tournament.era = 'division'"), 'El analisis historico no reconoce las eras v5.18.');
requireCheck(v5181Css.includes('#cmV58ModeSwitch{display:none!important}') && v5181Css.includes('cm-v5181-analysis-open #cmV58AnalysisRoot'), 'Los estilos no reemplazan correctamente el selector historico antiguo.');
requireCheck(v5182.includes("const VERSION = '5.18.2'") && v5182.includes('loadHistoricalAnalysis') && v5182.includes('loadedLegacyStatistics'), 'El coordinador v5.18.2 esta incompleto.');
requireCheck(v5182.includes("document.getElementById('cmStatsCenter')") && v5182.includes("document.getElementById('cmV58ModeSwitch')"), 'No se aislan las capas estadisticas antiguas.');

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
  console.error('Auditoria v5.18.2 fallida:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Auditoria v5.18.2 OK');
notes.forEach((note) => console.log(`- ${note}`));
