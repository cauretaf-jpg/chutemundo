const model = window.ChuteDetailModel;
if (!model) throw new Error('Chute Mundo no está listo para corregir las fotografías de jugadores.');

const VERSION = '5.25.4';
const PHOTO_URLS = Object.freeze({
  arnold: '/player-photos/overrides/arnold-vega.png?v=d49747d5',
  rocco: '/player-photos/overrides/rocco-caruso.png?v=00fb4cbb',
  warner: '/player-photos/overrides/warner-ferrara.png?v=4b60b06e'
});

const previousPhotoUrl = model.photoUrl?.bind(model);
const previousPhoto = model.photo?.bind(model);
const normalize = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const ARNOLD_NAMES = new Set(['arnold vega', 'julio vega']);
const ROCCO_NAMES = new Set(['rocco caruso', 'rocco carusso']);
const WARNER_NAMES = new Set(['warner ferrara']);

function resolveOverride(teamId, name) {
  const normalized = normalize(name);
  if (teamId === 'perla' && ARNOLD_NAMES.has(normalized)) return PHOTO_URLS.arnold;
  if (ROCCO_NAMES.has(normalized)) return PHOTO_URLS.rocco;
  if (teamId === 'trucha' && WARNER_NAMES.has(normalized)) return PHOTO_URLS.warner;
  return '';
}

function overridePhoto(name, className, url) {
  return `<img class="${model.esc?.(className) || className}" src="${url}" alt="${model.esc?.(name) || name}" loading="lazy">`;
}

model.photoUrl = (teamId, name) => resolveOverride(teamId, name) || previousPhotoUrl?.(teamId, name) || '';
model.photo = (teamId, name, className = 'player-photo') => {
  const url = resolveOverride(teamId, name);
  return url ? overridePhoto(name, className, url) : previousPhoto?.(teamId, name, className) || '';
};

function resolveImageOverride(image) {
  const normalized = normalize(image?.alt || '');
  if (ARNOLD_NAMES.has(normalized)) return PHOTO_URLS.arnold;
  if (ROCCO_NAMES.has(normalized)) return PHOTO_URLS.rocco;
  if (WARNER_NAMES.has(normalized)) return PHOTO_URLS.warner;

  const src = String(image?.getAttribute?.('src') || '').toLowerCase();
  if (/player-photos\/(?:perla|overrides)\/(?:arnold|julio)-vega\.(?:png|webp|jpe?g)/.test(src)) return PHOTO_URLS.arnold;
  if (/player-photos\/[^/]+\/rocco-caruss?o\.(?:png|webp|jpe?g)/.test(src)) return PHOTO_URLS.rocco;
  if (/player-photos\/(?:trucha|overrides)\/warner-ferrara\.(?:png|webp|jpe?g)/.test(src)) return PHOTO_URLS.warner;
  return '';
}

function repairImage(image) {
  if (!image) return false;
  const url = resolveImageOverride(image);
  if (!url) return false;
  image.classList.remove('photo-fallback');
  if (image.getAttribute('src') !== url) image.setAttribute('src', url);
  image.onerror = () => {
    image.onerror = null;
    image.classList.remove('photo-fallback');
    image.setAttribute('src', `${url.split('?')[0]}?retry=${Date.now()}`);
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

window.ChuteV5254PlayerPhotoFix = Object.freeze({
  version: VERSION,
  photoUrls: PHOTO_URLS,
  resolveOverride,
  repairImage,
  repairExistingImages
});
