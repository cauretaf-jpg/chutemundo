import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const detail = await readFile(path.join(publicDir, 'chute-detail.mjs'), 'utf8');
const official = await readFile(path.join(publicDir, 'chute-official.mjs'), 'utf8');
const lineups = await readFile(path.join(publicDir, 'chute-v513-lineups.mjs'), 'utf8');
const unified = await readFile(path.join(publicDir, 'chute-v514-unified-match.mjs'), 'utf8');
const polished = await readFile(path.join(publicDir, 'chute-v515-match-center.mjs'), 'utf8');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

const failures = [];
const notes = [];
const requireCheck = (condition, message) => { if (!condition) failures.push(message); };

requireCheck(packageJson.version === '5.15.0', 'package.json no esta en v5.15.0.');
requireCheck(detail.indexOf('chute-runtime-v58.mjs') < detail.indexOf('chute-mutation-guard.mjs'), 'El runtime optimizado debe cargarse antes de los modulos periodicos.');
requireCheck(!detail.includes('chute-v56-card-metadata.mjs'), 'El parche redundante de metadatos sigue importandose.');
requireCheck(detail.includes('function loadStatistics()'), 'No existe carga diferida del centro estadistico.');
requireCheck(detail.includes('chute-v58-analysis.mjs'), 'No se carga el analisis historico v5.8.');
requireCheck(detail.includes('[data-cm-mobile-page="estadisticas"]'), 'La navegacion movil no activa la carga estadistica.');
requireCheck(detail.includes('cm-v581-bracket-tabs'), 'No existe la navegacion movil por etapas de la llave.');
requireCheck(detail.includes('MutationObserver(() => {\n    if (!statisticsPage.hidden)'), 'No existe respaldo automatico al mostrar Estadisticas.');
requireCheck(official.includes('ChuteSplitLoader') && official.includes('chute-v59-part'), 'No se carga el centro v5.9 mediante ChuteSplitLoader.');
requireCheck(official.includes('chute-v510-safety.mjs') && official.includes('chute-v510-dashboard.mjs'), 'No se cargan los modulos v5.10.');
requireCheck(official.includes('chute-v511-core.mjs') && official.includes('chute-v511-tournaments.mjs') && official.includes('chute-v511-match-share.mjs'), 'No se cargan los modulos v5.11.');
requireCheck(official.includes('chute-v512-integrity.mjs'), 'No se carga el modulo v5.12.');
requireCheck(official.includes('chute-v5121-storage-preflight.mjs') && official.includes('chute-v5121-search-fix.mjs') && official.includes('chute-v5121-backup-fix.mjs'), 'No se cargan los ajustes v5.12.1.');
requireCheck(official.includes('chute-v513-lineups.mjs?v=5.13.0'), 'No se carga el modulo de planteles y alineaciones v5.13.');
requireCheck(official.includes('chute-v514-unified-match.mjs?v=5.14.0'), 'No se carga el centro de partido unificado v5.14.');
requireCheck(official.includes('chute-v515-match-center.mjs?v=5.15.0'), 'No se carga la mejora visual y de eventos v5.15.');
requireCheck(official.indexOf('chute-v5121-storage-preflight.mjs') < official.indexOf('chute-v512-integrity.mjs'), 'La preparacion de almacenamiento debe cargarse antes del modulo de integridad.');
requireCheck(official.indexOf('chute-v5121-backup-fix.mjs') < official.indexOf('chute-v513-lineups.mjs'), 'Las alineaciones deben cargarse despues de los ajustes de estabilidad.');
requireCheck(official.indexOf('chute-v513-lineups.mjs') < official.indexOf('chute-v514-unified-match.mjs'), 'El partido unificado debe cargarse despues de las alineaciones.');
requireCheck(official.indexOf('chute-v514-unified-match.mjs') < official.indexOf('chute-v515-match-center.mjs'), 'La mejora v5.15 debe cargarse despues del partido unificado.');
requireCheck(official.indexOf('chute-v510-safety.mjs') < official.indexOf('chute-v583-tournament-admin.mjs'), 'La papelera debe interceptar la eliminacion antes del administrador v5.8.3.');
requireCheck(lineups.includes("const VERSION = '5.13.0'"), 'El modulo de alineaciones no declara v5.13.0.');
requireCheck(lineups.includes("'Davis Bronson', 'MED', 45") && lineups.includes("'Jackie Sánchez', 'MED', 45"), 'Las posiciones oficiales corregidas no estan presentes.');
requireCheck(lineups.includes("'Rocco Carusso': 'Rocco Caruso'") && lineups.includes("'Julio Vega': 'Arnold Vega'"), 'Faltan migraciones de nombres historicos.');
requireCheck(lineups.includes('participationStats') && lineups.includes('registerSubstitution'), 'Falta el control de minutos o sustituciones.');
requireCheck(unified.includes("const VERSION = '5.14.0'"), 'El centro de partido unificado no declara v5.14.0.');
requireCheck(unified.includes('openUnifiedMatch') && unified.includes('makeDetailedReadOnly'), 'Falta la ruta unica de apertura publica y administradora.');
requireCheck(unified.includes('eligiblePlayers') && unified.includes('data-cm-v514-substitute'), 'Falta el reingreso o el registro unificado de cambios.');
requireCheck(unified.includes("button.textContent = 'Ver partido'") && unified.includes("document.querySelectorAll('[data-edit-match]')"), 'No se eliminan los accesos duplicados de partido.');
requireCheck(!unified.includes('usedPlayers(lineup)'), 'El modulo unificado sigue bloqueando el reingreso de jugadores.');
requireCheck(polished.includes("const VERSION = '5.15.0'"), 'El centro visual no declara v5.15.0.');
requireCheck(polished.includes('syncSubstitutionEvents') && polished.includes("kind: 'substitution'"), 'Los cambios no se guardan como eventos oficiales.');
requireCheck(polished.includes('unifiedEvents') && polished.includes('renderTimeline'), 'La cronologia no integra todos los tipos de evento.');
requireCheck(polished.includes('data-cm-v515-substitute') && polished.includes('undoSubstitution'), 'Falta el registro o la correccion unificada de cambios.');
requireCheck(polished.includes('cm-v515-player-slot') && polished.includes('cm-v515-waiting-chips'), 'Falta la mejora visual de alineaciones.');

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
  console.error('Auditoria v5.15.0 fallida:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Auditoria v5.15.0 OK');
notes.forEach((note) => console.log(`- ${note}`));
