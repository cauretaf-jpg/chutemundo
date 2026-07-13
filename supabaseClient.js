const SUPABASE_CONFIG_KEY = "chutemundo_supabase_config_v1";
const SUPABASE_ENABLED_KEY = "chutemundo_supabase_enabled_v1";

let supabaseEnabled = false;
let saveTimer = null;
let lastError = null;

const DEFAULT_SUPABASE_CONFIG = {
  url: "",
  anonKey: "",
  table: "chutemundo_app_states",
  recordKey: "main",
  bucket: "chutemundo-assets"
};

function cleanBaseUrl(url) {
  return (url || "").trim().replace(/\/+$/, "");
}

function readSupabaseConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(SUPABASE_CONFIG_KEY) || "null");
    return { ...DEFAULT_SUPABASE_CONFIG, ...(saved || {}), url: cleanBaseUrl(saved?.url || "") };
  } catch {
    return { ...DEFAULT_SUPABASE_CONFIG };
  }
}

function saveSupabaseConfig(config) {
  const clean = {
    url: cleanBaseUrl(config.url || ""),
    anonKey: config.anonKey || "",
    table: config.table || DEFAULT_SUPABASE_CONFIG.table,
    recordKey: config.recordKey || DEFAULT_SUPABASE_CONFIG.recordKey,
    bucket: config.bucket || DEFAULT_SUPABASE_CONFIG.bucket
  };
  localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(clean));
  return clean;
}

function initSupabase() {
  const config = readSupabaseConfig();
  lastError = null;

  if (!config.url || !config.anonKey) {
    supabaseEnabled = false;
    return false;
  }

  supabaseEnabled = true;
  localStorage.setItem(SUPABASE_ENABLED_KEY, "true");
  return true;
}

function isEnabled() {
  const config = readSupabaseConfig();
  return supabaseEnabled && !!config.url && !!config.anonKey;
}

function disconnectSupabase() {
  localStorage.removeItem(SUPABASE_ENABLED_KEY);
  supabaseEnabled = false;
  clearTimeout(saveTimer);
  saveTimer = null;
}

function supabaseHeaders(config, extra = {}) {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
    ...extra
  };
}

function encodeTableName(name) {
  return encodeURIComponent(name).replace(/%2E/g, ".");
}

async function readError(response) {
  try {
    const data = await response.json();
    return data.message || data.error || JSON.stringify(data);
  } catch {
    return response.statusText || `HTTP ${response.status}`;
  }
}

async function saveState(state) {
  if (!isEnabled()) return { ok: false, error: "Supabase no está conectado." };

  const config = readSupabaseConfig();
  const table = encodeTableName(config.table);
  const payload = {
    id: config.recordKey || "main",
    state_json: state,
    updated_at: new Date().toISOString()
  };

  try {
    const response = await fetch(`${config.url}/rest/v1/${table}?on_conflict=id`, {
      method: "POST",
      headers: supabaseHeaders(config, {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      }),
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(await readError(response));

    if (window.ChuteStorage) {
      ChuteStorage.saveStorageMeta({ lastCloudSyncAt: new Date().toISOString(), mode: "cloud" });
      ChuteStorage.updateStorageBadge();
    }

    lastError = null;
    return { ok: true };
  } catch (error) {
    lastError = error.message || String(error);
    return { ok: false, error: lastError };
  }
}

function queueSave(state) {
  if (!isEnabled()) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveState(state), 1200);
}

async function loadState() {
  if (!isEnabled()) return { ok: false, error: "Supabase no está conectado." };

  const config = readSupabaseConfig();
  const table = encodeTableName(config.table);
  const id = encodeURIComponent(config.recordKey || "main");

  try {
    const response = await fetch(`${config.url}/rest/v1/${table}?select=state_json,updated_at&id=eq.${id}`, {
      method: "GET",
      headers: supabaseHeaders(config, {
        Accept: "application/json"
      })
    });

    if (!response.ok) throw new Error(await readError(response));

    const rows = await response.json();
    const data = Array.isArray(rows) ? rows[0] : null;
    if (!data || !data.state_json) return { ok: false, error: "No existe un respaldo en Supabase para esa clave." };

    if (window.ChuteStorage) {
      ChuteStorage.saveStorageMeta({ lastCloudSyncAt: data.updated_at || new Date().toISOString(), mode: "cloud" });
      ChuteStorage.updateStorageBadge();
    }

    lastError = null;
    return { ok: true, state: data.state_json };
  } catch (error) {
    lastError = error.message || String(error);
    return { ok: false, error: lastError };
  }
}

async function uploadTeamImage(teamId, file) {
  if (!isEnabled() || !file) return null;
  const config = readSupabaseConfig();
  const extension = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `escudos/${teamId}-${Date.now()}.${extension}`;
  const publicPath = path.split("/").map(encodeURIComponent).join("/");

  try {
    const response = await fetch(`${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}/${publicPath}`, {
      method: "POST",
      headers: supabaseHeaders(config, {
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true"
      }),
      body: file
    });

    if (!response.ok) throw new Error(await readError(response));

    lastError = null;
    return `${config.url}/storage/v1/object/public/${encodeURIComponent(config.bucket)}/${publicPath}`;
  } catch (error) {
    lastError = error.message || String(error);
    return null;
  }
}

function getLastError() {
  return lastError;
}

function restoreIfEnabled() {
  const wasEnabled = localStorage.getItem(SUPABASE_ENABLED_KEY) === "true";
  if (!wasEnabled) return false;
  return initSupabase();
}

window.SupabaseService = {
  defaultConfig: DEFAULT_SUPABASE_CONFIG,
  getConfig: readSupabaseConfig,
  saveConfig: saveSupabaseConfig,
  init: initSupabase,
  restoreIfEnabled,
  isEnabled,
  disconnect: disconnectSupabase,
  saveState,
  queueSave,
  loadState,
  uploadTeamImage,
  getLastError,
  hasLibrary: () => true
};

// Carga las mejoras después de que app.js haya inicializado el estado y la interfaz.
window.addEventListener("DOMContentLoaded", () => {
  if (document.querySelector('script[data-chutemundo-enhancements="true"]')) return;

  const script = document.createElement("script");
  script.src = "chutemundo-enhancements.js?v=1.4.0";
  script.dataset.chutemundoEnhancements = "true";
  script.onerror = () => console.error("No se pudieron cargar las mejoras de Chute Mundo.");
  document.body.appendChild(script);
});
