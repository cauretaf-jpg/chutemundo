import { getApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const ADMIN_EMAIL = 'cauretaf@gmail.com';
const auth = getAuth(getApp());
const modal = document.getElementById('modal');
const content = document.getElementById('modalContent');
const toast = document.getElementById('toast');

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(window.__cloudLoginToast);
  window.__cloudLoginToast = setTimeout(() => { toast.hidden = true; }, 3200);
}

function closeModal() {
  if (modal) modal.hidden = true;
  if (content) content.innerHTML = '';
}

function openLogin() {
  if (!modal || !content) return;
  content.innerHTML = `
    <div class="login-dialog">
      <p class="eyebrow">ADMINISTRACIÓN</p>
      <h2>Ingresar a Chute Mundo</h2>
      <p>Usa tu cuenta administradora para crear torneos, registrar resultados y activar la base compartida.</p>
      <form id="isolatedLoginForm">
        <label>Correo<input type="email" value="${ADMIN_EMAIL}" disabled></label>
        <label>Contraseña<input id="isolatedPassword" type="password" autocomplete="current-password" minlength="6" required placeholder="Tu contraseña"></label>
        <div class="modal-actions"><button type="button" class="secondary" id="isolatedCancel">Cancelar</button><button type="submit" class="primary">Ingresar</button></div>
        <button id="isolatedCreate" type="button" class="link-button">Crear mi cuenta por primera vez</button>
      </form>
    </div>
  `;
  modal.hidden = false;

  document.getElementById('isolatedCancel')?.addEventListener('click', closeModal);
  document.getElementById('isolatedLoginForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = document.getElementById('isolatedPassword')?.value || '';
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
      closeModal();
      showToast('Sesión iniciada correctamente.');
    } catch (error) {
      console.error(error);
      showToast(error.code === 'auth/invalid-credential' ? 'Contraseña incorrecta o cuenta inexistente.' : 'No se pudo iniciar sesión.');
    }
  });
  document.getElementById('isolatedCreate')?.addEventListener('click', async () => {
    const password = document.getElementById('isolatedPassword')?.value || '';
    if (password.length < 6) {
      showToast('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    try {
      await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, password);
      closeModal();
      showToast('Cuenta administradora creada.');
    } catch (error) {
      console.error(error);
      showToast(error.code === 'auth/email-already-in-use' ? 'La cuenta ya existe. Usa Ingresar.' : 'No se pudo crear la cuenta.');
    }
  });
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('#authButton');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const email = auth.currentUser?.email?.toLowerCase();
  if (email === ADMIN_EMAIL) {
    await signOut(auth);
    showToast('Sesión cerrada.');
  } else {
    openLogin();
  }
}, true);
