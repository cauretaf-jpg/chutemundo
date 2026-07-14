import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getAuth,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const ADMIN_EMAIL = 'cauretaf@gmail.com';
let helperAuth = null;
let sending = false;
let creating = false;

async function loadFirebaseConfig() {
  const response = await fetch('/cloud-stable.mjs', { cache: 'no-store' });
  if (!response.ok) throw new Error('No se pudo leer la configuración de Firebase.');
  const source = await response.text();
  const match = source.match(/const FIREBASE_CONFIG = (\{[\s\S]*?\n\});/);
  if (!match) throw new Error('No se encontró la configuración de Firebase.');
  return new Function(`return ${match[1]};`)();
}

async function getHelperAuth() {
  if (helperAuth) return helperAuth;
  const config = await loadFirebaseConfig();
  const app = getApps().find((item) => item.name === 'account-helper')
    || initializeApp(config, 'account-helper');
  helperAuth = getAuth(app);
  helperAuth.languageCode = 'es';
  return helperAuth;
}

function showFeedback(message, type = 'info') {
  let feedback = document.getElementById('passwordResetFeedback');
  if (!feedback) {
    feedback = document.createElement('p');
    feedback.id = 'passwordResetFeedback';
    feedback.style.margin = '12px 0 0';
    feedback.style.fontSize = '.86rem';
    feedback.style.lineHeight = '1.45';
    const form = document.getElementById('loginForm');
    form?.appendChild(feedback);
  }
  feedback.textContent = message;
  feedback.style.color = type === 'error' ? '#a72d37' : type === 'success' ? '#17623f' : '#245441';
}

function getPassword() {
  return document.getElementById('loginPassword')?.value || '';
}

async function sendReset() {
  if (sending) return;
  sending = true;
  const button = document.getElementById('forgotPasswordButton');
  if (button) {
    button.disabled = true;
    button.textContent = 'Enviando enlace…';
  }

  try {
    const auth = await getHelperAuth();
    await sendPasswordResetEmail(auth, ADMIN_EMAIL);
    showFeedback(`Solicitud enviada a ${ADMIN_EMAIL}. Si no llega, probablemente la cuenta aún no existe; en ese caso utiliza “Crear cuenta administradora”.`, 'success');
    if (button) button.textContent = 'Solicitud enviada';
  } catch (error) {
    console.error('Password reset failed', error);
    const messages = {
      'auth/operation-not-allowed': 'El acceso con correo y contraseña no está habilitado en Firebase.',
      'auth/too-many-requests': 'Firebase bloqueó temporalmente nuevos intentos. Intenta nuevamente más tarde.',
      'auth/network-request-failed': 'No se pudo conectar con Firebase. Revisa tu conexión.'
    };
    showFeedback(messages[error.code] || `No se pudo solicitar el enlace (${error.code || 'error desconocido'}).`, 'error');
    if (button) {
      button.disabled = false;
      button.textContent = 'Olvidé mi contraseña';
    }
  } finally {
    sending = false;
  }
}

async function createAdministratorAccount() {
  if (creating) return;
  const password = getPassword();
  if (password.length < 6) {
    showFeedback('Escribe en el campo de contraseña una clave nueva de al menos 6 caracteres.', 'error');
    document.getElementById('loginPassword')?.focus();
    return;
  }

  creating = true;
  const button = document.getElementById('createAdminAccountButton');
  if (button) {
    button.disabled = true;
    button.textContent = 'Creando cuenta…';
  }

  try {
    const auth = await getHelperAuth();
    await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, password);
    await signOut(auth);
    showFeedback('Cuenta administradora creada. Ahora presiona “Ingresar” usando la misma contraseña.', 'success');
    if (button) button.textContent = 'Cuenta creada';
  } catch (error) {
    console.error('Admin account creation failed', error);
    const messages = {
      'auth/email-already-in-use': 'La cuenta ya existe en Firebase. No la vuelvas a crear; utiliza recuperación de contraseña o revisa la configuración del correo en Firebase.',
      'auth/weak-password': 'La contraseña es demasiado débil. Utiliza al menos 6 caracteres.',
      'auth/operation-not-allowed': 'El acceso con correo y contraseña no está habilitado en Firebase.',
      'auth/too-many-requests': 'Firebase bloqueó temporalmente nuevos intentos. Intenta nuevamente más tarde.',
      'auth/network-request-failed': 'No se pudo conectar con Firebase. Revisa tu conexión.'
    };
    showFeedback(messages[error.code] || `No se pudo crear la cuenta (${error.code || 'error desconocido'}).`, 'error');
    if (button) {
      button.disabled = false;
      button.textContent = 'Crear cuenta administradora';
    }
  } finally {
    creating = false;
  }
}

function enhanceLoginModal() {
  const form = document.getElementById('loginForm');
  if (!form || document.getElementById('accountHelpActions')) return;

  const wrapper = document.createElement('div');
  wrapper.id = 'accountHelpActions';
  wrapper.style.display = 'grid';
  wrapper.style.gap = '6px';
  wrapper.style.marginTop = '10px';

  const resetButton = document.createElement('button');
  resetButton.id = 'forgotPasswordButton';
  resetButton.type = 'button';
  resetButton.className = 'text-button';
  resetButton.textContent = 'Olvidé mi contraseña';
  resetButton.addEventListener('click', sendReset);

  const createButton = document.createElement('button');
  createButton.id = 'createAdminAccountButton';
  createButton.type = 'button';
  createButton.className = 'secondary';
  createButton.textContent = 'Crear cuenta administradora';
  createButton.addEventListener('click', createAdministratorAccount);

  const hint = document.createElement('small');
  hint.className = 'muted';
  hint.style.lineHeight = '1.4';
  hint.textContent = 'Si nunca creaste la cuenta, escribe una contraseña nueva arriba y utiliza esta opción.';

  wrapper.append(resetButton, createButton, hint);
  form.appendChild(wrapper);
}

const observer = new MutationObserver(enhanceLoginModal);
observer.observe(document.body, { childList: true, subtree: true });
enhanceLoginModal();
