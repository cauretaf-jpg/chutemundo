import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const ADMIN_EMAIL = 'cauretaf@gmail.com';
let resetAuth = null;
let sending = false;

async function loadFirebaseConfig() {
  const response = await fetch('/cloud-stable.mjs', { cache: 'no-store' });
  if (!response.ok) throw new Error('No se pudo leer la configuración de Firebase.');
  const source = await response.text();
  const match = source.match(/const FIREBASE_CONFIG = (\{[\s\S]*?\n\});/);
  if (!match) throw new Error('No se encontró la configuración de Firebase.');
  return new Function(`return ${match[1]};`)();
}

async function getResetAuth() {
  if (resetAuth) return resetAuth;
  const config = await loadFirebaseConfig();
  const app = getApps().find((item) => item.name === 'password-reset')
    || initializeApp(config, 'password-reset');
  resetAuth = getAuth(app);
  return resetAuth;
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
  feedback.style.color = type === 'error' ? '#a72d37' : '#245441';
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
    const auth = await getResetAuth();
    await sendPasswordResetEmail(auth, ADMIN_EMAIL);
    showFeedback(`Revisa ${ADMIN_EMAIL}. Firebase envió un enlace para crear una contraseña nueva.`);
    if (button) button.textContent = 'Enlace enviado';
  } catch (error) {
    console.error('Password reset failed', error);
    showFeedback('No se pudo enviar el enlace. Revisa que el usuario exista en Firebase Authentication y vuelve a intentarlo.', 'error');
    if (button) {
      button.disabled = false;
      button.textContent = 'Olvidé mi contraseña';
    }
  } finally {
    sending = false;
  }
}

function enhanceLoginModal() {
  const form = document.getElementById('loginForm');
  if (!form || document.getElementById('forgotPasswordButton')) return;

  const button = document.createElement('button');
  button.id = 'forgotPasswordButton';
  button.type = 'button';
  button.className = 'text-button';
  button.style.display = 'block';
  button.style.margin = '10px auto 0';
  button.textContent = 'Olvidé mi contraseña';
  button.addEventListener('click', sendReset);
  form.appendChild(button);
}

const observer = new MutationObserver(enhanceLoginModal);
observer.observe(document.body, { childList: true, subtree: true });
enhanceLoginModal();
