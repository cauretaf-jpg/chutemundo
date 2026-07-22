const core = window.ChuteMundoCore;
if (!core) throw new Error('Chute Mundo no está listo para sincronizar Estadísticas v5.20.');

const VERSION = '5.20.0';
let refreshQueued = false;

function queueStatisticsRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  queueMicrotask(() => {
    refreshQueued = false;
    window.ChuteV520Stats?.refresh?.();
  });
}

function installSetStateBridge() {
  if (typeof core.setState !== 'function' || core.setState.__cmV520StatsSync) return false;
  const previous = core.setState.bind(core);
  const synchronizedSetState = (next, ...args) => {
    const result = previous(next, ...args);
    queueStatisticsRefresh();
    return result;
  };
  Object.defineProperty(synchronizedSetState, '__cmV520StatsSync', { value: true });
  Object.defineProperty(synchronizedSetState, 'previous', { value: previous });
  core.setState = synchronizedSetState;
  return true;
}

installSetStateBridge();
document.addEventListener('chute:state', queueStatisticsRefresh);
document.addEventListener('chute:ready', () => {
  installSetStateBridge();
  queueStatisticsRefresh();
});

window.ChuteV520StatsSync = {
  version: VERSION,
  installSetStateBridge,
  queueStatisticsRefresh
};
