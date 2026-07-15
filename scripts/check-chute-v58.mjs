import { readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const parts = (await readdir(publicDir)).filter((name) => /^chute-official-part-.*\.txt$/.test(name)).sort();
const runtimePath = path.join(root, '.chute-runtime-check.mjs');
await writeFile(runtimePath, (await Promise.all(parts.map((name) => readFile(path.join(publicDir, name), 'utf8')))).join(''));
const files = [runtimePath,
  ...['chute-official-loader.mjs','chute-official.mjs','password-reset.mjs','chute-runtime-v58.mjs','chute-mutation-guard.mjs','chute-detail.mjs','chute-detail-model.mjs','chute-detail-ui.mjs','chute-detail-events.mjs','chute-detail-diagnostics.mjs','chute-group-editor.mjs','chute-data-hygiene.mjs','chute-premium-ui.mjs','chute-tournament-hub.mjs','chute-matches-v52.mjs','chute-stats-v52.mjs','chute-v57-controllers.mjs','chute-v58-analysis.mjs','chute-v58-visibility.mjs','chute-game-minute-stats.mjs','chute-v54.mjs','chute-v54-form-guard.mjs','chute-v55-event-guard.mjs','chute-v55.mjs','chute-v56-discipline.mjs'].map((name) => path.join(publicDir, name)),
  path.join(root, 'scripts/audit-chute-v58.mjs'), path.join(root, 'scripts/smoke-chute-v58.mjs')
];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
await rm(runtimePath, { force: true });
console.log(`Sintaxis v5.8 validada en ${files.length} archivos.`);
