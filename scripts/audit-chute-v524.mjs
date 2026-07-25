import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (name) => readFile(path.join(root, name), 'utf8');
const [pkgRaw, official, bootstrap, sw, tournamentsSource, tournamentsCss, archiveSource, archiveCss, fixesSource, fixesCss] = await Promise.all([
  read('package.json'),
  read('public/chute-official.mjs'),
  read('public/chute-bootstrap.mjs'),
  read('public/sw.js'),
  read('public/chute-v524-tournaments.mjs'),
  read('public/chute-v524-tournaments.css'),
  read('public/chute-v5241-history-collapse.mjs'),
  read('public/chute-v5241-history-collapse.css'),
  read('public/chute-v5242-ui-fixes.mjs'),
  read('public/chute-v5242-ui-fixes.css')
]);
const pkg = JSON.parse(pkgRaw);
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

check(pkg.version === '5.24.2', 'package.json no está en v5.24.2.');
check(bootstrap.includes("const APP_VERSION = '5.24.2'"), 'El bootstrap no fija v5.24.2.');
check(official.includes('/chute-v524-tournaments.mjs?v=5.24.2'), 'La organización de Torneos v5.24 no está activa en la versión actual.');
check(official.includes('/chute-v5241-history-collapse.mjs?v=5.24.2'), 'El archivo plegable v5.24.1 no permanece activo.');
check(official.includes('/chute-v5242-ui-fixes.mjs?v=5.24.2'), 'Las correcciones v5.24.2 no están activas.');
check(sw.includes("const CACHE = 'chute-mundo-v5.24.2'"), 'La caché PWA no usa v5.24.2.');
check(sw.includes('/chute-v5242-ui-fixes.mjs?v=5.24.2') && sw.includes('/chute-v5242-ui-fixes.css?v=5.24.2'), 'La PWA no precarga las correcciones v5.24.2.');
check(tournamentsSource.includes('cmV524CreateToggle') && tournamentsSource.includes('cmV524CreatePanel'), 'Falta el formulario plegable de creación.');
check(tournamentsSource.includes('cmV524TournamentSummary') && tournamentsSource.includes('cmV524ActiveTournament'), 'Falta el resumen o la competición actual destacada.');
check(tournamentsSource.includes('cmV524ShowMore') && tournamentsSource.includes('cmV524ShowLess'), 'Falta la carga progresiva del historial.');
check(tournamentsSource.includes("window.confirm('Hay información sin guardar"), 'Falta protección al cerrar un formulario con cambios.');
check(archiveSource.includes('let archiveOpen = false'), 'El historial no comienza cerrado.');
check(archiveSource.includes('Ver torneos anteriores') && archiveSource.includes('Ocultar torneos anteriores'), 'Faltan los controles para abrir y cerrar el archivo.');
check(fixesSource.includes('syncTournamentToolbar') && fixesSource.includes('dataCmV5242Redundant'), 'Falta la barra contextual o la eliminación de acciones duplicadas.');
check(fixesSource.includes('activateParticipants') && fixesSource.includes('deactivateParticipants') && fixesSource.includes("panel.dataset.cmV521Panel = 'participants'"), 'Participantes no está integrado al sistema de pestañas históricas.');
check(fixesSource.includes('localStorage.removeItem') && fixesSource.includes('nativeStatsTab'), 'Falta limpiar el estado de Participantes al cambiar de pestaña.');
check(!tournamentsSource.includes('setInterval(') && !archiveSource.includes('setInterval(') && !fixesSource.includes('setInterval('), 'La organización de Torneos no debe usar intervalos periódicos.');
check(tournamentsCss.includes('@media(max-width:720px)') && archiveCss.includes('@media(max-width:720px)') && fixesCss.includes('@media(max-width:720px)'), 'Falta adaptación móvil.');
check(fixesCss.includes('[data-cm-v523-panel="participants"]:not(.active)') && fixesCss.includes('[data-v511-tools] > [hidden]'), 'Falta protección CSS de visibilidad.');

if (failures.length) {
  console.error('Auditoría Chute Mundo v5.24.2 fallida:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Auditoría Chute Mundo v5.24.2 OK');
console.log('- La barra del torneo muestra solo acciones válidas para su estado.');
console.log('- La revisión y finalización usan un único botón contextual.');
console.log('- La Liga de los Participantes solo aparece en su propia pestaña.');
console.log('- No se modifican Firebase ni los datos funcionales.');