import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (name) => readFile(path.join(root, name), 'utf8');
const [pkgRaw, index, official, bootstrap, sw, control, css, divisions] = await Promise.all([
  read('package.json'), read('public/index.html'), read('public/chute-official.mjs'), read('public/chute-bootstrap.mjs'),
  read('public/sw.js'), read('public/chute-v523-control-center.mjs'), read('public/chute-v523-participants-admin.css'), read('public/chute-v54.mjs')
]);
const pkg = JSON.parse(pkgRaw);
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

check(pkg.version === '5.23.0', 'package.json no está en v5.23.0.');
check(index.includes('Chute Mundo v5.23.0 · Competición') && index.includes('/chute-official.mjs?v=5.23.0'), 'index.html no usa v5.23.0.');
check(bootstrap.includes("const APP_VERSION = '5.23.0'"), 'El bootstrap no fija v5.23.0.');
check(official.includes('/chute-v523-control-center.mjs?v=5.23.0'), 'El Centro de Control v5.23 no está activo.');
check(sw.includes("const CACHE = 'chute-mundo-v5.23.0'") && sw.includes('/chute-v523-control-center.mjs?v=5.23.0'), 'La PWA no precarga v5.23.');
check(control.includes("const HOME_DEFAULT = 'participante_alvaro'") && control.includes("const AWAY_DEFAULT = 'participante_carlos'"), 'Faltan participantes predeterminados.');
check(control.includes('cmV523ParticipantForm') && control.includes('data-cm-v523-match-person'), 'Falta gestión dinámica o asignación por partido.');
check(control.includes('La Liga de los Participantes') && control.includes('Ranking de participantes'), 'Faltan estadísticas de participantes.');
check(control.includes('REGLAMENTO OFICIAL') && control.includes('Resultado entre ambos equipos') && control.includes('Dos amarillas acumuladas'), 'El reglamento oficial está incompleto.');
check(control.includes('Listo para comenzar las divisiones') && control.includes('competitionRules'), 'Falta la revisión de preparación divisional.');
check(divisions.includes("tieBreakOrder: ['points', 'goalDifference', 'goalsFor', 'goalsAgainst', 'headToHead']"), 'La temporada no guarda el desempate oficial.');
check(divisions.includes('function directResult') && divisions.includes('direct.pointsB - direct.pointsA'), 'La tabla no aplica enfrentamiento directo.');
check(divisions.includes('yellowLimit: 2') && divisions.includes('participantHome') && divisions.includes('participantAway'), 'Las divisiones no usan disciplina o participantes oficiales.');
check(css.includes('.cm-v523-admin-tabs') && css.includes('.cm-v523-match-participants') && css.includes('.cm-v523-participant-cards'), 'Faltan estilos de Administración, partido o estadísticas.');

if (failures.length) {
  console.error('Auditoría Chute Mundo v5.23 fallida:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Auditoría Chute Mundo v5.23 OK');
console.log('- Participantes dinámicos con Álvaro local y Carlos visita.');
console.log('- Estadísticas históricas de participantes.');
console.log('- Administración reorganizada y Reglamento Oficial.');
console.log('- Divisiones con enfrentamiento directo y 2 amarillas.');
