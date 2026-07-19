const core = window.ChuteMundoCore;
const v59 = window.ChuteV59;

if (!core || !v59) throw new Error('Chute Mundo v5.9 no está disponible para activar el acceso al modo partido.');

const VERSION = '5.9.1';
let refreshQueued = false;

function filteredRows() {
  const tournamentId = document.getElementById('matchTournamentFilter')?.value || 'all';
  const status = document.getElementById('matchStatusFilter')?.value || 'all';
  return (core.getState().tournaments || [])
    .flatMap((tournament) => (tournament.matches || []).map((match) => ({ tournament, match })))
    .filter(({ tournament }) => tournamentId === 'all' || tournament.id === tournamentId)
    .filter(({ match }) => match.stage !== 'bye')
    .filter(({ match }) => status === 'all' || (status === 'played' ? core.matchPlayed(match) : !core.matchPlayed(match)));
}

function ensureStyles() {
  if (document.getElementById('cmV591LiveAccessStyles')) return;
  const style = document.createElement('style');
  style.id = 'cmV591LiveAccessStyles';
  style.textContent = `
    #matchesList .cm-v59-live-launch{display:none!important}
    .cm-v591-live-panel{display:flex;align-items:center;justify-content:space-between;gap:18px;margin:0 0 18px;padding:18px 20px;border:1px solid #cfe1d8;border-radius:18px;background:linear-gradient(135deg,#f7fbf9,#edf7f2);box-shadow:0 8px 22px rgba(8,62,45,.06)}
    .cm-v591-live-panel h2{margin:2px 0 5px;color:#123126}.cm-v591-live-panel p{margin:0;color:#64736d}.cm-v591-live-panel button,.cm-v591-live-access{border:1px solid #0b7557;border-radius:999px;background:#0b7557;color:#fff;padding:10px 15px;font-weight:900;cursor:pointer;white-space:nowrap}
    .cm-v591-live-access.is-locked{background:#edf7f2;color:#086348}.cm-v591-live-access:disabled{border-color:#ccd8d2;background:#f1f4f2;color:#839089;cursor:not-allowed}
    .cm-v591-live-status{display:inline-flex;align-items:center;gap:7px;margin-top:8px;color:#0b7557;font-size:.78rem;font-weight:850}.cm-v591-live-status::before{content:'';width:8px;height:8px;border-radius:50%;background:#20a878}
    @media(max-width:760px){.cm-v591-live-panel{display:grid;padding:16px}.cm-v591-live-panel button{width:100%}.match-main .cm-v591-live-access{grid-column:1/-1;width:100%;margin-top:7px}}
  `;
  document.head.appendChild(style);
}

function ensurePanel() {
  const page = document.getElementById('partidos');
  if (!page) return;
  let panel = document.getElementById('cmV591LivePanel');
  if (!panel) {
    panel = document.createElement('article');
    panel.id = 'cmV591LivePanel';
    panel.className = 'cm-v591-live-panel';
    page.querySelector('.page-title')?.insertAdjacentElement('afterend', panel);
  }
  const active = core.canEdit();
  panel.innerHTML = `<div><p class="eyebrow">CENTRO DE PARTIDO</p><h2>Modo partido</h2><p>${active ? 'Sesión administradora activa. Abre cualquier encuentro para registrar marcador y eventos.' : 'El acceso está visible en cada encuentro. Inicia sesión para registrar el partido.'}</p><span class="cm-v591-live-status">${active ? 'Listo para registrar' : 'Requiere acceso administrador'}</span></div>${active ? '' : '<button type="button" data-cm-v591-login>Ingresar como administrador</button>'}`;
}

function ensureMatchButtons() {
  const rows = filteredRows();
  const cards = [...document.querySelectorAll('#matchesList .match-card')];
  cards.forEach((card, index) => {
    const row = rows[index];
    if (!row) return;
    const pair = `${row.tournament.id}__${row.match.id}`;
    const home = row.match.home || core.resolveHome(row.tournament, row.match);
    const away = row.match.away || core.resolveAway(row.tournament, row.match);
    const target = card.querySelector('.match-main') || card;
    let button = target.querySelector('.cm-v591-live-access');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'mini-button cm-v591-live-access';
      target.appendChild(button);
    }
    button.dataset.cmV591Live = pair;
    button.disabled = !(home && away);
    button.classList.toggle('is-locked', !core.canEdit());
    button.textContent = home && away ? (core.canEdit() ? 'Modo partido' : 'Modo partido 🔒') : 'Partido por definir';
    button.title = home && away ? (core.canEdit() ? 'Abrir centro de partido' : 'Inicia sesión para registrar el partido') : 'Este encuentro depende de resultados anteriores';
  });
}

function refresh() {
  refreshQueued = false;
  ensurePanel();
  ensureMatchButtons();
}

function scheduleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(refresh);
}

document.addEventListener('click', (event) => {
  const login = event.target.closest('[data-cm-v591-login]');
  if (login) {
    event.preventDefault();
    document.getElementById('authButton')?.click();
    return;
  }
  const live = event.target.closest('[data-cm-v591-live]');
  if (!live || live.disabled) return;
  event.preventDefault();
  event.stopPropagation();
  if (!core.canEdit()) {
    document.getElementById('authButton')?.click();
    return;
  }
  v59.openLiveMatch(live.dataset.cmV591Live);
}, true);

['matchTournamentFilter', 'matchStatusFilter', 'authButton'].forEach((id) => {
  document.getElementById(id)?.addEventListener('change', () => setTimeout(scheduleRefresh, 0));
  document.getElementById(id)?.addEventListener('click', () => setTimeout(scheduleRefresh, 0));
});

const matchesPage = document.getElementById('partidos');
if (matchesPage) new MutationObserver(scheduleRefresh).observe(matchesPage, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });

ensureStyles();
refresh();
window.setInterval(refresh, 1500);
window.ChuteV591 = { version: VERSION, refresh, filteredRows };
