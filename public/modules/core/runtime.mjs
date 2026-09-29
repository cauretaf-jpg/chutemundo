const nativeSetInterval = window.setInterval.bind(window);
const nativeClearInterval = window.clearInterval.bind(window);
const managed = new Map();
const listeners = new Map();
let nextManagedId = -1;
let heartbeatId = null;
let invalidationVersion = 0;

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function heartbeatDelay() {
  return document.hidden ? 1200 : 200;
}

function runManagedIntervals() {
  if (document.hidden) return;
  const current = now();
  for (const task of managed.values()) {
    if (current < task.nextAt) continue;
    task.nextAt = current + task.delay;
    try {
      task.callback(...task.args);
    } catch (error) {
      console.error('Error en una tarea periódica administrada por Chute Runtime v5.8.', error);
    }
  }
}

function restartHeartbeat() {
  if (heartbeatId !== null) nativeClearInterval(heartbeatId);
  heartbeatId = nativeSetInterval(runManagedIntervals, heartbeatDelay());
}

window.setInterval = function chuteManagedSetInterval(callback, delay = 0, ...args) {
  if (typeof callback !== 'function' || Number(delay) > 2000) {
    return nativeSetInterval(callback, delay, ...args);
  }
  const id = nextManagedId--;
  const normalizedDelay = Math.max(250, Number(delay) || 0);
  managed.set(id, {
    callback,
    args,
    delay: normalizedDelay,
    nextAt: now() + normalizedDelay
  });
  return id;
};

window.clearInterval = function chuteManagedClearInterval(id) {
  if (managed.delete(id)) return;
  nativeClearInterval(id);
};

function invalidate(reason = 'manual') {
  invalidationVersion += 1;
  const event = new CustomEvent('chute:invalidate', {
    detail: { reason, version: invalidationVersion, at: Date.now() }
  });
  document.dispatchEvent(event);
  for (const callback of listeners.values()) {
    try {
      callback(event.detail);
    } catch (error) {
      console.error('Error al invalidar una vista de Chute Mundo.', error);
    }
  }
}

function register(key, callback) {
  listeners.set(key, callback);
  return () => listeners.delete(key);
}

function wrapCore(core) {
  if (!core || core.__cmV58Wrapped) return;
  core.__cmV58Wrapped = true;
  for (const methodName of ['setState', 'queueSave']) {
    const original = core[methodName];
    if (typeof original !== 'function') continue;
    core[methodName] = function wrappedCoreMethod(...args) {
      const result = original.apply(this, args);
      queueMicrotask(() => invalidate(`core:${methodName}`));
      return result;
    };
  }
}

function attachCore() {
  if (window.ChuteMundoCore) wrapCore(window.ChuteMundoCore);
}

document.addEventListener('chute:ready', (event) => wrapCore(event.detail));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    const current = now();
    for (const task of managed.values()) task.nextAt = current;
    invalidate('visibility');
  }
  restartHeartbeat();
});
document.addEventListener('submit', () => queueMicrotask(() => invalidate('submit')));
document.addEventListener('change', () => queueMicrotask(() => invalidate('change')));
document.addEventListener('click', (event) => {
  if (event.target.closest('button,[data-page],[data-cm-stats-tab]')) {
    queueMicrotask(() => invalidate('click'));
  }
});

restartHeartbeat();
attachCore();

window.ChuteRuntimeV58 = {
  invalidate,
  register,
  stats() {
    return {
      managedIntervals: managed.size,
      listeners: listeners.size,
      hidden: document.hidden,
      invalidationVersion,
      heartbeatDelay: heartbeatDelay()
    };
  }
};
