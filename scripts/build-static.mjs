import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const output = join(root, 'public');
const ignored = new Set(['.git', '.vercel', 'node_modules', 'public', 'scripts']);

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const entry of readdirSync(root)) {
  if (ignored.has(entry)) continue;
  cpSync(join(root, entry), join(output, entry), { recursive: true });
}

console.log('Static output created in public/.');
