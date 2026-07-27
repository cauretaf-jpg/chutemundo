const model = window.ChuteDetailModel;
if (!model) throw new Error('Chute Mundo no está listo para cargar la fotografía de Arnold Vega.');

const VERSION = '5.25.3';
// Se usa un JPEG local, no un data:image/jpeg;base64, para asegurar decodificación y caché consistentes.
const ARNOLD_URL = '/player-photos/perla/arnold-vega.jpg?v=e3debd61';
const previousPhotoUrl = model.photoUrl?.bind(model);
const previousPhoto = model.photo?.bind(model);
const normalize = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const isArnoldName = (name) => ['arnold vega', 'julio vega'].includes(normalize(name));
const isArnold = (teamId, name) => teamId === 'perla' && isArnoldName(name);

function arnoldPhoto(name, className = 'player-photo') {
  return `<img class="${model.esc?.(className) || className}" src="${ARNOLD_URL}" alt="${model.esc?.(name) || name}" loading="lazy">`;
}

model.photoUrl = (teamId, name) => isArnold(teamId, name) ? ARNOLD_URL : previousPhotoUrl?.(teamId, name) || '';
model.photo = (teamId, name, className = 'player-photo') => isArnold(teamId, name)
  ? arnoldPhoto(name, className)
  : previousPhoto?.(teamId, name, className) || '';

function isArnoldImage(image) {
  const alt = normalize(image?.alt || '');
  const src = String(image?.getAttribute?.('src') || '').toLowerCase();
  return isArnoldName(alt) || /player-photos\/perla\/(?:arnold|julio)-vega\.(?:png|webp|jpe?g)/.test(src);
}

function repairImage(image) {
  if (!image || !isArnoldImage(image)) return false;
  image.classList.remove('photo-fallback');
  if (image.getAttribute('src') !== ARNOLD_URL) image.setAttribute('src', ARNOLD_URL);
  image.onerror = () => {
    image.onerror = null;
    image.classList.remove('photo-fallback');
    image.setAttribute('src', `/player-photos/perla/arnold-vega.jpg?retry=${Date.now()}`);
  };
  return true;
}

function repairExistingImages(root = document) {
  if (root instanceof HTMLImageElement) repairImage(root);
  root.querySelectorAll?.('img').forEach(repairImage);
}

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node instanceof Element) repairExistingImages(node);
    }
  }
});
observer.observe(document.documentElement, { childList: true, subtree: true });

repairExistingImages();
document.addEventListener('chute:ready', () => repairExistingImages());
document.addEventListener('chute:boot-complete', () => repairExistingImages());

window.ChuteV5253ArnoldPhoto = Object.freeze({
  version: VERSION,
  arnoldUrl: ARNOLD_URL,
  isArnoldName,
  repairImage,
  repairExistingImages
});
