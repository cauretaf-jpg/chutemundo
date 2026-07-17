import { readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const parts = (await readdir(publicDir)).filter((name) => /^chute-official-part-.*\.txt$/.test(name)).sort();
const runtimePath = path.join(root, '.chute-runtime-check.mjs');
const v59RuntimePath = path.join(root, '.chute-v59-runtime-check.mjs');
await writeFile(runtimePath, (await Promise.all(parts.map((name) => readFile(path.join(publicDir, name), 'utf8')))).join(''));
const v59Parts = (await readdir(publicDir)).filter((name) => /^chute-v59-part-\d{2}\.txt$/.test(name)).sort();
await writeFile(v59RuntimePath, (await Promise.all(v59Parts.map((name) => readFile(path.join(publicDir, name), 'utf8')))).join(''));
const files = [runtimePath, v59RuntimePath,
  ...['chute-official-loader.mjs','chute-official.mjs','password-reset.mjs','chute-runtime-v58.mjs','chute-mutation-guard.mjs','chute-detail.mjs','chute-detail-model.mjs','chute-detail-ui.mjs','chute-detail-events.mjs','chute-detail-diagnostics.mjs','chute-group-editor.mjs','chute-data-hygiene.mjs','chute-premium-ui.mjs','chute-tournament-hub.mjs','chute-matches-v52.mjs','chute-stats-v52.mjs','chute-v57-controllers.mjs','chute-v58-analysis.mjs','chute-v58-visibility.mjs','chute-game-minute-stats.mjs','chute-v54.mjs','chute-v54-form-guard.mjs','chute-v55-event-guard.mjs','chute-v55.mjs','chute-v56-discipline.mjs','chute-v582-analysis-theme.mjs','chute-v583-tournament-admin.mjs'].map((name) => path.join(publicDir, name)),
  path.join(root, 'scripts/audit-chute-v58.mjs'), path.join(root, 'scripts/smoke-chute-v58.mjs'), path.join(root, 'scripts/smoke-chute-v59.mjs')
];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
await rm(runtimePath, { force: true });
await rm(v59RuntimePath, { force: true });
console.log(`Sintaxis v5.9 validada en ${files.length} archivos.`);
