const STORAGE_KEY = "torneos_chute_mundo_pro_v1";
const STORAGE_META_KEY = "torneos_chute_mundo_storage_meta_v1";

function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function formatDateTime(value) {
  if (!value) return "Sin registro";
  try {
    return new Intl.DateTimeFormat("es-CL", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getStorageMeta() {
  return safeJsonParse(localStorage.getItem(STORAGE_META_KEY), {
    lastSavedAt: null,
    lastCloudSyncAt: null,
    mode: "local"
  }) || { lastSavedAt: null, lastCloudSyncAt: null, mode: "local" };
}

function saveStorageMeta(patch = {}) {
  const next = { ...getStorageMeta(), ...patch };
  localStorage.setItem(STORAGE_META_KEY, JSON.stringify(next));
  return next;
}

function loadLocalState(defaultData, normalizeState, clone) {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    const fresh = clone(defaultData);
    normalizeState(fresh);
    saveLocalState(fresh);
    return fresh;
  }

  const parsed = safeJsonParse(saved);
  if (!parsed) {
    const fresh = clone(defaultData);
    normalizeState(fresh);
    saveLocalState(fresh);
    return fresh;
  }

  normalizeState(parsed);
  return parsed;
}

function saveLocalState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  saveStorageMeta({ lastSavedAt: nowIso(), mode: "local" });
  updateStorageBadge();
  return true;
}

function clearLocalState() {
  localStorage.removeItem(STORAGE_KEY);
  saveStorageMeta({ lastSavedAt: null, mode: "local" });
  updateStorageBadge();
}

function downloadJson(state, filename = "torneos-chute-mundo-backup.json") {
  const payload = {
    app: "Chutemundo",
    version: "1.2",
    exportedAt: nowIso(),
    state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function normalizeImportedPayload(parsed) {
  if (parsed && parsed.state && parsed.app === "Chutemundo") return parsed.state;
  if (parsed && parsed.state && parsed.version) return parsed.state;
  return parsed;
}

function updateStorageBadge() {
  const badge = document.getElementById("storageStatusText");
  const detail = document.getElementById("storageDetailText");
  if (!badge && !detail) return;

  const meta = getStorageMeta();
  if (badge) {
    badge.textContent = meta.mode === "cloud" ? "Nube preparada" : "Local";
  }
  if (detail) {
    const local = formatDateTime(meta.lastSavedAt);
    const cloud = formatDateTime(meta.lastCloudSyncAt);
    detail.textContent = `Último guardado local: ${local} · Última sincronización nube: ${cloud}`;
  }
}

window.ChuteStorage = {
  key: STORAGE_KEY,
  metaKey: STORAGE_META_KEY,
  loadLocalState,
  saveLocalState,
  clearLocalState,
  downloadJson,
  normalizeImportedPayload,
  getStorageMeta,
  saveStorageMeta,
  updateStorageBadge,
  formatDateTime,
  nowIso
};
