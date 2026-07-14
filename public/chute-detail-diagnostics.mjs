function waitForCore() {
  if (window.ChuteMundoCore) return Promise.resolve(window.ChuteMundoCore);
  return new Promise((resolve) => document.addEventListener('chute:ready', (event) => resolve(event.detail), { once: true }));
}
const core = await waitForCore();
const model = window.ChuteDetailModel;
let scheduled = false;

function counts() {
  const state = core.getState();
  const matches = (state.tournaments || []).flatMap((tournament) => tournament.matches || []);
  const players = (state.teams || []).reduce((sum, team) => sum + (team.players?.length || 0), 0);
  const goals = matches.reduce((sum, match) => sum + (match.goals?.length || 0), 0);
  const cards = matches.reduce((sum, match) => sum + (match.cards?.length || 0), 0);
  return { teams: state.teams.length, players, tournaments: state.tournaments.length, matches: matches.length, played: matches.filter(core.matchPlayed).length, goals, cards };
}

function renderReadiness() {
  const form = document.getElementById('tournamentForm');
  if (!form) return;
  let notice = document.getElementById('cmTournamentReadiness');
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'cmTournamentReadiness';
    notice.className = 'notice info';
    form.prepend(notice);
  }
  const selected = document.querySelectorAll('#teamPicker input:checked').length;
  const admin = core.isAdmin();
  const cloud = core.cloudLoaded;
  notice.className = `notice ${admin && cloud ? 'success' : 'warning'}`;
  notice.innerHTML = admin && cloud
    ? `<strong>Creación habilitada.</strong> Sesión administradora activa y Firebase conectado. Equipos seleccionados: ${selected}.`
    : `<strong>Creación bloqueada.</strong> ${!admin ? 'Debes iniciar sesión como administrador.' : 'Firebase todavía no termina de cargar.'} Equipos seleccionados: ${selected}.`;
}

function renderDiagnostics() {
  const page = document.getElementById('administracion');
  if (!page) return;
  let panel = document.getElementById('cmDiagnosticsPanel');
  if (!panel) {
    panel = document.createElement('article');
    panel.id = 'cmDiagnosticsPanel';
    panel.className = 'panel cm-debug-card';
    page.appendChild(panel);
  }
  const value = counts();
  panel.innerHTML = `<div class="panel-head"><div><p class="eyebrow">DIAGNÓSTICO V4</p><h2>Estado completo del sistema</h2></div><button id="cmRefreshDiagnostics" class="secondary">Actualizar</button></div>
    <div class="cm-debug-grid">
      <div><strong>${core.isAdmin() ? 'Autenticado' : 'Solo lectura'}</strong><span>Sesión: ${core.authUser?.email || 'sin usuario'}</span></div>
      <div><strong>${core.cloudLoaded ? 'Conectado' : 'Pendiente'}</strong><span>Firebase · historial ${core.cloudHasHistory ? 'completo' : 'en reparación'}</span></div>
      <div><strong>${value.teams} equipos</strong><span>${value.players} jugadores con ficha</span></div>
      <div><strong>${value.tournaments} torneos</strong><span>${value.played}/${value.matches} partidos jugados</span></div>
      <div><strong>${value.goals} goles detallados</strong><span>Con goleador/asistencia/minuto</span></div>
      <div><strong>${value.cards} tarjetas</strong><span>Amarillas y rojas estructuradas</span></div>
    </div>
    <div class="actions" style="margin-top:14px"><button id="cmTestFirebaseWrite" class="primary" ${core.isAdmin() && core.cloudLoaded ? '' : 'disabled'}>Probar escritura Firebase</button><button id="cmRepairDetailedModel" class="secondary">Reparar datos detallados</button></div>
    <p class="muted" id="cmDiagnosticResult">La prueba de escritura no modifica resultados: vuelve a guardar el estado actual y confirma los permisos.</p>`;
}

function refresh() {
  model?.migrateState(core);
  renderReadiness();
  renderDiagnostics();
}
function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => { scheduled = false; refresh(); });
}

document.addEventListener('click', async (event) => {
  if (event.target.id === 'cmRefreshDiagnostics') refresh();
  if (event.target.id === 'cmRepairDetailedModel') {
    model.migrateState(core);
    core.persistLocal();
    core.render();
    window.ChuteDetailUI?.applyEnhancements?.();
    core.showToast('Modelo de partidos revisado y reparado.');
  }
  if (event.target.id === 'cmTestFirebaseWrite') {
    const result = document.getElementById('cmDiagnosticResult');
    event.target.disabled = true;
    if (result) result.textContent = 'Probando escritura…';
    try {
      await core.saveCloud();
      if (result) result.textContent = `Prueba correcta · ${new Date().toLocaleString('es-CL')}. Firebase aceptó la escritura.`;
      core.showToast('Firebase aceptó la escritura.');
    } catch (error) {
      if (result) result.textContent = `Prueba rechazada: ${error.code || error.message || 'error desconocido'}.`;
      core.showToast(`Firebase rechazó la prueba: ${error.code || error.message || 'error desconocido'}.`);
    } finally {
      event.target.disabled = !(core.isAdmin() && core.cloudLoaded);
    }
  }
});
document.addEventListener('change', (event) => { if (event.target.closest('#teamPicker')) renderReadiness(); });
new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
refresh();
