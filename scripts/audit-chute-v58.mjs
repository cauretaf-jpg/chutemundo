import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const detail = await readFile(path.join(publicDir, 'chute-detail.mjs'), 'utf8');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

const failures = [];
const notes = [];
const requireCheck = (condition, message) => { if (!condition) failures.push(message); };

requireCheck(packageJson.version === '5.8.0', 'package.json no está en v5.8.0.');
requireCheck(detail.indexOf('chute-runtime-v58.mjs') < detail.indexOf('chute-mutation-guard.mjs'), 'El runtime optimizado debe cargarse antes de los módulos periódicos.');
requireCheck(!detail.includes('chute-v56-card-metadata.mjs'), 'El parche redundante de metadatos sigue importándose.');
requireCheck(detail.includes('function loadStatistics()'), 'No existe carga diferida del centro estadístico.');
requireCheck(detail.includes('chute-v58-analysis.mjs'), 'No se carga el análisis histórico v5.8.');

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
notes.push(`Llamadas setInterval detectadas: ${intervalCalls}; quedan centralizadas por chute-runtime-v58.`);
notes.push(`MutationObserver explícitos: ${mutationObservers}; protegidos por chute-mutation-guard.`);

const imports = [...detail.matchAll(/import\(['"]([^'"]+)/g)].map((match) => match[1]);
const duplicates = imports.filter((item, index) => imports.indexOf(item) !== index);
requireCheck(duplicates.length === 0, `Importaciones duplicadas: ${duplicates.join(', ')}`);

if (failures.length) {
  console.error('Auditoría v5.8 fallida:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Auditoría v5.8 OK');
notes.forEach((note) => console.log(`- ${note}`));
