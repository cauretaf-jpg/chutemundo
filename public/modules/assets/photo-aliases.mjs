const model = window.ChuteDetailModel;
if (!model) throw new Error('Chute Mundo no está listo para corregir fotografías.');

const VERSION = '5.22.4';
const SALAZAR_URL = '/player-photos/perla/randolph-salazar.png?v=bb2a2d76';
const previousPhotoUrl = model.photoUrl?.bind(model);
const previousPhoto = model.photo?.bind(model);
const normalize = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const isSalazarName = (name) => ['randolph salazar', 'randolf salazar'].includes(normalize(name));
const isSalazar = (teamId, name) => teamId === 'perla' && isSalazarName(name);

function salazarPhoto(name, className = 'player-photo') {
  return `<img class="${model.esc?.(className) || className}" src="${SALAZAR_URL}" alt="${model.esc?.(name) || name}" loading="lazy">`;
}

model.photoUrl = (teamId, name) => isSalazar(teamId, name) ? SALAZAR_URL : previousPhotoUrl?.(teamId, name) || '';
model.photo = (teamId, name, className = 'player-photo') => isSalazar(teamId, name)
  ? salazarPhoto(name, className)
  : previousPhoto?.(teamId, name, className) || '';

function isSalazarImage(image) {
  const alt = normalize(image?.alt || '');
  const src = String(image?.getAttribute?.('src') || '').toLowerCase();
  return isSalazarName(alt) || /player-photos\/perla\/randol(?:f|ph)-salazar\.(?:png|webp|jpg)/.test(src);
}

function repairImage(image) {
  if (!image || !isSalazarImage(image)) return false;
  image.classList.remove('photo-fallback');
  if (image.getAttribute('src') !== SALAZAR_URL) image.setAttribute('src', SALAZAR_URL);
  image.onerror = () => {
    image.onerror = null;
    image.classList.remove('photo-fallback');
    image.setAttribute('src', `/player-photos/perla/randolph-salazar.png?retry=${Date.now()}`);
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

window.ChuteV522PhotoFix = Object.freeze({
  version: VERSION,
  salazarUrl: SALAZAR_URL,
  repairImage,
  repairExistingImages
});
