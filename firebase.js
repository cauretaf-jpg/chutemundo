const FIREBASE_CONFIG_KEY = "torneos_chute_mundo_firebase_config";
const FIREBASE_ENABLED_KEY = "torneos_chute_mundo_firebase_enabled";

let db = null;
let storage = null;
let firebaseEnabled = false;
let unsubscribeListener = null;

function getFirebaseConfig() {
  const saved = localStorage.getItem(FIREBASE_CONFIG_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }
  return null;
}

function saveFirebaseConfig(config) {
  localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
}

function isFirebaseConfigured() {
  return getFirebaseConfig() !== null;
}

function isFirebaseEnabled() {
  return firebaseEnabled && db !== null;
}

async function initFirebase() {
  const config = getFirebaseConfig();
  if (!config) {
    console.log("Firebase no configurado");
    return false;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    db = firebase.firestore();
    storage = firebase.storage();
    firebaseEnabled = true;
    console.log("Firebase inicializado correctamente");
    return true;
  } catch (error) {
    console.error("Error al inicializar Firebase:", error);
    firebaseEnabled = false;
    db = null;
    storage = null;
    return false;
  }
}

async function enableFirebase(config) {
  saveFirebaseConfig(config);
  const success = await initFirebase();
  if (success) {
    localStorage.setItem(FIREBASE_ENABLED_KEY, "true");
    await loadDataFromFirestore();
  }
  return success;
}

function disableFirebase() {
  if (unsubscribeListener) {
    unsubscribeListener();
    unsubscribeListener = null;
  }
  localStorage.removeItem(FIREBASE_ENABLED_KEY);
  firebaseEnabled = false;
  db = null;
}

async function saveDataToFirestore() {
  if (!isFirebaseEnabled()) return false;

  try {
    const stateJson = JSON.stringify(state);
    await db.collection("chute_mundo").doc("main").set({
      stateJson: stateJson,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    localStorage.setItem(STORAGE_KEY, stateJson);
    return true;
  } catch (error) {
    console.error("Error al guardar en Firestore:", error);
    return false;
  }
}

async function loadDataFromFirestore() {
  if (!isFirebaseEnabled()) return null;

  try {
    const doc = await db.collection("chute_mundo").doc("main").get();
    if (doc.exists && doc.data().stateJson) {
      const data = JSON.parse(doc.data().stateJson);
      normalizeState(data);
      state = data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return state;
    }
  } catch (error) {
    console.error("Error al cargar desde Firestore:", error);
  }
  return null;
}

async function setupRealtimeSync() {
  if (!isFirebaseEnabled()) return;

  if (unsubscribeListener) {
    unsubscribeListener();
  }

  unsubscribeListener = db.collection("chute_mundo").doc("main")
    .onSnapshot((doc) => {
      if (doc.exists && doc.data().stateJson) {
        try {
          const serverData = JSON.parse(doc.data().stateJson);
          normalizeState(serverData);
          
          const localData = JSON.stringify(state);
          const serverStr = JSON.stringify(serverData);
          
          if (localData !== serverStr) {
            state = serverData;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            renderAll();
          }
        } catch (e) {
          console.error("Error al procesar datos del servidor:", e);
        }
      }
    }, (error) => {
      console.error("Error en realtime sync:", error);
    });
}

async function syncToFirestore() {
  if (!isFirebaseEnabled()) return;
  
  await saveDataToFirestore();
  setupRealtimeSync();
}

function checkFirebaseOnLoad() {
  const wasEnabled = localStorage.getItem(FIREBASE_ENABLED_KEY) === "true";
  if (wasEnabled && isFirebaseConfigured()) {
    initFirebase().then(enabled => {
      if (enabled) {
        syncToFirestore();
      }
    });
  }
}

function getStorage() {
  return storage;
}

async function uploadTeamImage(teamId, file) {
  if (!storage) {
    console.error("Firebase Storage no disponible");
    return null;
  }

  try {
    const extension = file.name.split('.').pop();
    const fileName = `escudos/${teamId}.${extension}`;
    const ref = storage.ref(fileName);
    
    await ref.put(file);
    const url = await ref.getDownloadURL();
    
    return url;
  } catch (error) {
    console.error("Error al subir imagen:", error);
    return null;
  }
}

async function deleteTeamImage(teamId) {
  if (!storage) return;

  try {
    const ref = storage.ref(`escudos/${teamId}`);
    await ref.delete();
  } catch (error) {
    console.log("No se pudo eliminar la imagen (puede que no exista)");
  }
}

window.FirebaseService = {
  isConfigured: isFirebaseConfigured,
  isEnabled: isFirebaseEnabled,
  enable: enableFirebase,
  disable: disableFirebase,
  save: saveDataToFirestore,
  load: loadDataFromFirestore,
  sync: syncToFirestore,
  getConfig: getFirebaseConfig,
  saveConfig: saveFirebaseConfig,
  checkOnLoad: checkFirebaseOnLoad,
  uploadTeamImage: uploadTeamImage,
  deleteTeamImage: deleteTeamImage,
  getStorage: getStorage
};
