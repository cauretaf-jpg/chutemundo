import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (name) => readFile(path.join(root, name), 'utf8');
const [pkgRaw, official, bootstrap, sw, index, vercel, fifaSource, fifaCss, workflow] = await Promise.all([
  read('package.json'),
  read('public/chute-official.mjs'),
  read('public/chute-bootstrap.mjs'),
  read('public/sw.js'),
  read('public/index.html'),
  read('vercel.json'),
  read('public/chute-v525-fifa-ranking.mjs'),
  read('public/chute-v525-fifa-ranking.css'),
  read('.github/workflows/validate-chute-v58.yml')
]);
const pkg = JSON.parse(pkgRaw);
const vercelConfig = JSON.parse(vercel);
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

check(pkg.version === '5.25.0', 'package.json no está en v5.25.0.');
check(bootstrap.includes("const APP_VERSION = '5.25.0'"), 'El bootstrap no fija v5.25.0.');
check(index.includes('Chute Mundo v5.25.0 · Competición') && index.includes('data-chute-version="5.25.0"'), 'index.html no expone v5.25.0.');
check(official.includes("/chute-v525-fifa-ranking.mjs?v=5.25.0"), 'El Ranking FIFA v5.25 no está importado.');
check(sw.includes("const CACHE = 'chute-mundo-v5.25.0'"), 'La caché PWA no usa v5.25.0.');
check(sw.includes('/chute-v525-fifa-ranking.mjs?v=5.25.0') && sw.includes('/chute-v525-fifa-ranking.css?v=5.25.0'), 'La PWA no precarga el Ranking FIFA.');
check(fifaSource.includes('const BASE_RATING = 1000') && fifaSource.includes('const K_FACTOR = 24'), 'Faltan la base 1000 o K=24.');
check(fifaSource.includes('return 1.25') && fifaSource.includes('return 1.35') && fifaSource.includes('return 1.1'), 'Faltan multiplicadores de semifinal, final o tercer lugar.');
check(fifaSource.includes('FRIENDLY_FACTOR = 0.25') && fifaSource.includes('home: 0.75, away: 0.5'), 'Falta el peso reducido de amistosos o el tratamiento de penales.');
check(fifaSource.includes('champion: 50, runnerUp: 25, third: 10'), 'Faltan bonos de podio.');
check(fifaSource.includes('Bota de Oro') && fifaSource.includes('Balón de Oro') && fifaSource.includes('Guante de Oro') && fifaSource.includes('Figura de la Final'), 'El Reglamento no documenta todos los premios.');
check(fifaSource.includes('target.fifaRows') && fifaSource.includes('window.ChuteStatsV52 = target'), 'El Ranking FIFA no alimenta la composición inaugural de divisiones.');
check(fifaCss.includes('@media(max-width:720px)') && fifaCss.includes('.cm-v525-fifa-panel[hidden]'), 'Falta adaptación móvil o protección de visibilidad.');
check(vercelConfig.ignoreCommand?.includes('prj_Tn8vMpjKJvvou7kGDwDqOkSuwFRl'), 'El proyecto duplicado de Vercel no está excluido.');
check(workflow.includes('name: Validate Chute Mundo v5.25') && workflow.includes('smoke-chute-v525.mjs'), 'El workflow no fue renombrado o no ejecuta la prueba v5.25.');
check(!fifaSource.includes('setInterval('), 'El Ranking FIFA no debe usar intervalos periódicos.');

if (failures.length) {
  console.error('Auditoría Chute Mundo v5.25 fallida:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Auditoría Chute Mundo v5.25 OK');
console.log('- Ranking FIFA ELO integrado a Estadísticas y Divisiones.');
console.log('- Reglamento de premios y fórmula FIFA documentados.');
console.log('- Proyecto duplicado de Vercel excluido de futuras compilaciones.');
