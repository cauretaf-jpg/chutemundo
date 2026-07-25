const VERSION = '5.24.0';
let baseline = '';

function form() { return document.getElementById('tournamentForm'); }
function panel() { return document.getElementById('cmV524CreatePanel'); }
function isOpen() { const current = panel(); return Boolean(current && !current.hidden); }

function snapshot() {
  const current = form();
  if (!current) return '';
  return JSON.stringify([...current.querySelectorAll('input,select,textarea')].map((field, index) => ({
    key: field.id || field.name || `${field.tagName}-${index}`,
    type: field.type || field.tagName,
    value: field.type === 'checkbox' || field.type === 'radio' ? Boolean(field.checked) : field.value,
    disabled: Boolean(field.disabled)
  })));
}

function remember() { baseline = snapshot(); }
function resetForm() {
  const current = form();
  if (!current) return;
  current.reset();
  document.getElementById('tournamentType')?.dispatchEvent(new Event('change', { bubbles: true }));
  document.getElementById('teamPicker')?.dispatchEvent(new Event('change', { bubbles: true }));
  remember();
}

function closeThroughOfficialApi({ discard = false } = {}) {
  const api = window.ChuteV524Tournaments;
  if (!api?.closeCreate) return false;
  const nativeConfirm = window.confirm;
  try {
    window.confirm = () => true;
    api.closeCreate();
  } finally {
    window.confirm = nativeConfirm;
  }
  if (discard) resetForm();
  else remember();
  return true;
}

document.addEventListener('click', (event) => {
  const toggle = event.target.closest?.('#cmV524CreateToggle');
  const cancel = event.target.closest?.('#cmV524CancelCreate');
  if (!toggle && !cancel) return;

  if (toggle && !isOpen()) {
    requestAnimationFrame(remember);
    return;
  }
  if (!isOpen()) return;

  const dirty = snapshot() !== baseline;
  if (dirty && !window.confirm('Hay información sin guardar. ¿Cerrar y descartar la creación del torneo?')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  closeThroughOfficialApi({ discard: Boolean(cancel || dirty) });
}, true);

const observer = new MutationObserver(() => {
  if (isOpen()) remember();
});
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });

document.addEventListener('chute:boot-complete', remember);
window.ChuteV524FormDirtyGuard = Object.freeze({ version: VERSION, snapshot, remember });
