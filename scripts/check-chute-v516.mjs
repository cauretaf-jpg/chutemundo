import { readFile, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

const root = process.cwd();
const parts = await Promise.all(Array.from({ length: 12 }, (_, index) =>
  readFile(path.join(root, 'public', `chute-v516-events-stats-part-${String(index).padStart(2, '0')}.txt`), 'utf8')
));
const target = path.join(os.tmpdir(), 'chute-v516-concatenated.mjs');
await writeFile(target, parts.join(''), 'utf8');
const result = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8' });
await rm(target, { force: true });
if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || 'El módulo concatenado v5.16 es inválido.\n');
  process.exit(result.status || 1);
}
console.log('Módulo concatenado Chute Mundo v5.16 OK');
