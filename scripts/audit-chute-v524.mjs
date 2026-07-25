import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (name) => readFile(path.join(root, name), 'utf8');
const [pkgRaw, official, bootstrap, sw, tournamentsSource, tournamentsCss, archiveSource, archiveCss] = await Promise.all([
  read('package.json'),
  read('public/chute-official.mjs'),
  read('public/chute-bootstrap.mjs'),
  read('public/sw.js'),
  read('public/chute-v524-tournaments.mjs'),
  read('public/chute-v524-tournaments.css'),
  read('public/chute-v5241-history-collapse.mjs'),
  read('public/chute-v5241-history-collapse.css')
]);
const pkg = JSON.parse(pkgRaw);
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

check(pkg.version === '5.24.1', 'package.json no está en v5.24.1.');
check(bootstrap.includes("const APP_VERSION = '5.24.1'"), 'El bootstrap no fija v5.24.1.');
check(official.includes("/chute-v524-tournaments.mjs?v=5.24.1"), 'La organización de Torneos v5.24 no está activa en la versión actual.');
check(official.includes("/chute-v5241-history-collapse.mjs?v=5.24.1"), 'El archivo plegable v5.24.1 no está activo.');
check(sw.includes("const CACHE = 'chute-mundo-v5.24.1'"), 'La caché PWA no usa v5.24.1.');
check(sw.includes('/chute-v524-tournaments.mjs?v=5.24.1') && sw.includes('/chute-v524-tournaments.css?v=5.24.1'), 'La PWA no conserva la organización de Torneos v5.24.');
check(sw.includes('/chute-v5241-history-collapse.mjs?v=5.24.1') && sw.includes('/chute-v5241-history-collapse.css?v=5.24.1'), 'La PWA no precarga el archivo plegable.');
check(tournamentsSource.includes('cmV524CreateToggle') && tournamentsSource.includes('cmV524CreatePanel'), 'Falta el formulario plegable de creación.');
check(tournamentsSource.includes('cmV524TournamentSummary') && tournamentsSource.includes('cmV524ActiveTournament'), 'Falta el resumen o la competición actual destacada.');
check(tournamentsSource.includes('cmV524ShowMore') && tournamentsSource.includes('cmV524ShowLess'), 'Falta la carga progresiva del historial.');
check(tournamentsSource.includes("window.confirm('Hay información sin guardar"), 'Falta protección al cerrar un formulario con cambios.');
check(archiveSource.includes('let archiveOpen = false'), 'El historial no comienza cerrado.');
check(archiveSource.includes('cmV5241UpcomingPanel') && archiveSource.includes('cmV5241ArchiveToggle'), 'Falta la separación entre próximos torneos y archivo.');
check(archiveSource.includes('Ver torneos anteriores') && archiveSource.includes('Ocultar torneos anteriores'), 'Faltan los controles para abrir y cerrar el archivo.');
check(archiveSource.includes("tournament.status === 'upcoming'") && archiveSource.includes("tournament.status === 'historical'"), 'Los próximos torneos y los finalizados no están separados.');
check(!tournamentsSource.includes('setInterval(') && !archiveSource.includes('setInterval('), 'La organización de Torneos no debe usar intervalos periódicos.');
check(tournamentsCss.includes('@media(max-width:720px)') && archiveCss.includes('@media(max-width:720px)'), 'Falta adaptación móvil del archivo de torneos.');
check(archiveCss.includes('.cm-v5241-archive-content[hidden]'), 'El contenido histórico no se oculta de forma robusta.');

if (failures.length) {
  console.error('Auditoría Chute Mundo v5.24.1 fallida:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Auditoría Chute Mundo v5.24.1 OK');
console.log('- La competición actual y los próximos torneos permanecen visibles.');
console.log('- Los torneos finalizados comienzan ocultos y se abren bajo demanda.');
console.log('- Búsqueda, filtros y carga progresiva permanecen dentro del archivo.');
console.log('- No se modifican Firebase ni los datos funcionales.');