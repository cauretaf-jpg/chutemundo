const VERSION = window.CHUTE_APP_VERSION || '6.0.0';
const load = (path) => import(`${path}?v=${encodeURIComponent(VERSION)}`);

await load('/chute-bootstrap.mjs');
await load('/chute-v511-assets.mjs');
await load('/chute-official-loader.mjs');
await load('/password-reset.mjs');
await load('/chute-detail.mjs');
await load('/chute-v522-photo-fix.mjs');
await load('/chute-v5254-player-photo-fix.mjs');
await load('/chute-v510-safety.mjs');
await load('/chute-v583-tournament-admin.mjs');
await window.ChuteSplitLoader({ prefix: 'chute-v59-part', count: 8, version: VERSION, label: 'el centro de partido' });
await load('/chute-v591-live-access.mjs');
await load('/chute-v510-dashboard.mjs');
await load('/chute-v511-core.mjs');
await load('/chute-v511-tournaments.mjs');
await load('/chute-v511-match-share.mjs');
await load('/chute-v5121-storage-preflight.mjs');
await load('/chute-v512-integrity.mjs');
await load('/chute-v5121-search-fix.mjs');
await load('/chute-v5121-backup-fix.mjs');
await load('/chute-v513-lineups.mjs');
await load('/chute-v514-unified-match.mjs');
await load('/chute-v515-match-center.mjs');
await load('/chute-v516-events-stats.mjs');
await load('/chute-v5162-playoff-seeding.mjs');
await load('/chute-v517-finalization.mjs');
await load('/chute-v521-history.mjs');
await load('/chute-v521-history-sync.mjs');
await load('/chute-v522-stats-refinement.mjs');
await load('/chute-v522-historical-dates.mjs');
await load('/chute-v523-control-center.mjs');
await load('/chute-v524-form-dirty-guard.mjs');
await load('/chute-v524-tournaments.mjs');
await load('/chute-v524-tournament-render-guard.mjs');
await load('/chute-v5241-history-collapse.mjs');
await load('/chute-v520-stats-guard.mjs');
await load('/chute-v5242-ui-fixes.mjs');
await load('/chute-v525-fifa-ranking.mjs');
await load('/chute-v5252-historical-player-stats.mjs');
await load('/chute-v6.mjs');

window.ChuteVersion?.apply?.();
document.dispatchEvent(new CustomEvent('chute:boot-complete', {
  detail: { version: VERSION, core: window.ChuteMundoCore }
}));
