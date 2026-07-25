import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (name) => readFile(path.join(root, name), 'utf8');
const [pkgRaw, index, official, bootstrap, sw, control, css, divisions] = await Promise.all([
  read('package.json'), read('public/index.html'), read('public/chute-official.mjs'), read('public/chute-bootstrap.mjs'),
  read('public/sw.js'), read('public/chute-v523-control-center.mjs'), read('public/chute-v523-participants-admin.css'), read('public/chute-v54.mjs')
]);
const pkg = JSON.parse(pkgRaw);
const currentVersion = pkg.version;
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const versionAtLeast523 = /^5\.(?:2[4-9]|[3-9]\d)\.\d+$/.test(currentVersion) || /^5\.23\.\d+$/.test(currentVersion);

check(versionAtLeast523, `package.json debe conservar las funciones incorporadas desde v5.23; versión actual: ${currentVersion}.`);
check(index.includes(`Chute Mundo v${currentVersion} · Competición`) && index.includes(`/chute-official.mjs?v=${currentVersion}`), 'index.html no usa la versión canónica actual.');
check(bootstrap.includes(`const APP_VERSION = '${currentVersion}'`), 'El bootstrap no fija la versión canónica actual.');
check(official.includes(`/chute-v523-control-center.mjs?v=${currentVersion}`), 'El Centro de Control v5.23 no permanece activo en la versión actual.');
check(sw.includes(`const CACHE = 'chute-mundo-v${currentVersion}'`) && sw.includes(`/chute-v523-control-center.mjs?v=${currentVersion}`), 'La PWA no conserva el Centro de Control v5.23.');
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
  console.error('Auditoría de regresión Chute Mundo v5.23 fallida:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Auditoría de regresión v5.23 OK sobre Chute Mundo v${currentVersion}`);
console.log('- Participantes dinámicos con Álvaro local y Carlos visita.');
console.log('- Estadísticas históricas de participantes.');
console.log('- Administración reorganizada y Reglamento Oficial.');
console.log('- Divisiones con enfrentamiento directo y 2 amarillas.');
