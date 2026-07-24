const model = window.ChuteDetailModel;
if (!model) throw new Error('Chute Mundo no está listo para corregir fotografías.');

const VERSION = '5.22.1';
const SALAZAR_URL = 'https://raw.githubusercontent.com/cauretaf-jpg/TorneosChute/main/public/player-photos/perla/randolph-salazar.png?v=7ef9a3a6';
const previousPhotoUrl = model.photoUrl?.bind(model);
const previousPhoto = model.photo?.bind(model);
const normalize = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const isSalazar = (teamId, name) => teamId === 'perla' && ['randolph salazar', 'randolf salazar'].includes(normalize(name));

model.photoUrl = (teamId, name) => isSalazar(teamId, name) ? SALAZAR_URL : previousPhotoUrl?.(teamId, name) || '';
model.photo = (teamId, name, className = 'player-photo') => {
  if (!isSalazar(teamId, name)) return previousPhoto?.(teamId, name, className) || '';
  return `<img class="${model.esc?.(className) || className}" src="${SALAZAR_URL}" alt="${model.esc?.(name) || name}" loading="lazy" onerror="this.classList.add('photo-fallback')">`;
};

window.ChuteV522PhotoFix = Object.freeze({ version: VERSION, salazarUrl: SALAZAR_URL });
