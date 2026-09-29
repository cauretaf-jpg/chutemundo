const VERSION = window.CHUTE_APP_VERSION || '6.0.0';
const load = (path) => import(`${path}?v=${encodeURIComponent(VERSION)}`);

await load('/modules/core/bootstrap.mjs');
await load('/modules/core/assets.mjs');
await load('/modules/core/split-loader.mjs');
await load('/modules/auth/password-reset.mjs');
await load('/modules/detail/index.mjs');
await load('/modules/data/player-ids.mjs');
await load('/modules/assets/photo-aliases.mjs');
await load('/modules/assets/player-photo-overrides.mjs');
await load('/modules/core/safety.mjs');
await load('/modules/tournaments/admin.mjs');
await window.ChuteSplitLoader({ prefix: 'modules/matches/live-part', count: 8, version: VERSION, label: 'el centro de partido' });
await load('/modules/matches/live-access.mjs');
await load('/modules/dashboard/index.mjs');
await load('/modules/core/pwa.mjs');
await load('/modules/tournaments/operations.mjs');
await load('/modules/matches/share.mjs');
await load('/modules/data/storage-preflight.mjs');
await load('/modules/admin/integrity.mjs');
await load('/modules/ui/search.mjs');
await load('/modules/data/backups.mjs');
await load('/modules/matches/lineups.mjs');
await load('/modules/matches/editor.mjs');
await load('/modules/matches/center.mjs');
await load('/modules/statistics/events.mjs');
await load('/modules/tournaments/playoff-seeding.mjs');
await load('/modules/tournaments/finalization.mjs');
await load('/modules/statistics/history.mjs');
await load('/modules/statistics/history-sync.mjs');
await load('/modules/statistics/refinement.mjs');
await load('/modules/statistics/historical-dates.mjs');
await load('/modules/admin/control-center.mjs');
await load('/modules/ui/form-dirty-guard.mjs');
await load('/modules/tournaments/catalog.mjs');
await load('/modules/tournaments/render-guard.mjs');
await load('/modules/tournaments/history-collapse.mjs');
await load('/modules/statistics/guard.mjs');
await load('/modules/ui/fixes.mjs');
await load('/modules/statistics/fifa.mjs');
await load('/modules/statistics/historical-player-stats.mjs');
await load('/modules/ui/enhancements.mjs');

window.ChuteVersion?.apply?.();
document.dispatchEvent(new CustomEvent('chute:boot-complete', {
  detail: { version: VERSION, core: window.ChuteMundoCore }
}));
