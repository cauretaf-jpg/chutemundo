const tournaments = window.ChuteV524Tournaments;
const list = document.getElementById('tournamentList');
if (!tournaments || !list) throw new Error('La interfaz de Torneos v5.24 no está disponible para su protección de renderizado.');

let queued = false;
function repairLegacyRender() {
  if (queued) return;
  const children = list.children.length;
  const customCards = list.querySelectorAll(':scope > .cm-v524-tournament-card').length;
  const customEmpty = Boolean(list.querySelector(':scope > .cm-v524-empty'));
  if (!children || customCards || customEmpty) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    tournaments.render();
  });
}

new MutationObserver(repairLegacyRender).observe(list, { childList: true });
repairLegacyRender();
window.ChuteV524TournamentRenderGuard = Object.freeze({ version: '5.24.0', repair: repairLegacyRender });
