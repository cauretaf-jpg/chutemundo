const core = window.ChuteMundoCore;
if (!core) throw new Error('Chute Mundo no está listo para sincronizar el Archivo Histórico v5.21.');

const VERSION = '5.21.0';
let refreshQueued = false;

function queueHistoryRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  queueMicrotask(() => {
    refreshQueued = false;
    window.ChuteV521History?.refresh?.();
  });
}

function installSetStateBridge() {
  if (typeof core.setState !== 'function' || core.setState.__cmV521HistorySync) return false;
  const previous = core.setState.bind(core);
  const synchronizedSetState = (next, ...args) => {
    const result = previous(next, ...args);
    queueHistoryRefresh();
    return result;
  };
  Object.defineProperty(synchronizedSetState, '__cmV521HistorySync', { value: true });
  Object.defineProperty(synchronizedSetState, 'previous', { value: previous });
  core.setState = synchronizedSetState;
  return true;
}

installSetStateBridge();
document.addEventListener('chute:state', queueHistoryRefresh);
document.addEventListener('chute:ready', () => {
  installSetStateBridge();
  queueHistoryRefresh();
});

window.ChuteV521HistorySync = { version: VERSION, installSetStateBridge, queueHistoryRefresh };
