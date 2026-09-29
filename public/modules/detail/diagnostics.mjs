function waitForCore() {
  if (window.ChuteMundoCore) return Promise.resolve(window.ChuteMundoCore);
  return new Promise((resolve) => document.addEventListener('chute:ready', (event) => resolve(event.detail), { once: true }));
}

const core = await waitForCore();
const model = window.ChuteDetailModel;
let scheduled = false;
let diagnosticsBusy = false;
let diagnosticMessage = 'La prueba de escritura no modifica resultados: vuelve a guardar el estado actual y confirma los permisos.';
let tournamentActionMessage = '';

function counts() {
  const state = core.getState();
  const matches = (state.tournaments || []).flatMap((tournament) => tournament.matches || []);
  const players = (state.teams || []).reduce((sum, team) => sum + (team.players?.length || 0), 0);
  const goals = matches.reduce((sum, match) => sum + (match.goals?.length || 0), 0);
  const cards = matches.reduce((sum, match) => sum + (match.cards?.length || 0), 0);
  return {
    teams: state.teams.length,
    players,
    tournaments: state.tournaments.length,
    matches: matches.length,
    played: matches.filter(core.matchPlayed).length,
    goals,
    cards
  };
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
  const signature = `${admin}|${cloud}|${selected}|${tournamentActionMessage}`;
  if (notice.dataset.signature === signature) return;

  notice.dataset.signature = signature;
  notice.className = `notice ${admin && cloud ? 'success' : 'warning'}`;
  const baseMessage = admin && cloud
    ? `<strong>Creación habilitada.</strong> Sesión administradora activa y Firebase conectado. Equipos seleccionados: ${selected}.`
    : `<strong>Creación bloqueada.</strong> ${!admin ? 'Debes iniciar sesión como administrador.' : 'Firebase todavía no termina de cargar.'} Equipos seleccionados: ${selected}.`;
  notice.innerHTML = `${baseMessage}${tournamentActionMessage ? `<div class="cm-action-feedback">${tournamentActionMessage}</div>` : ''}`;
}

function ensureDiagnosticsPanel() {
  const page = document.getElementById('administracion');
  if (!page) return null;

  let panel = document.getElementById('cmDiagnosticsPanel');
  if (panel) return panel;

  panel = document.createElement('article');
  panel.id = 'cmDiagnosticsPanel';
  panel.className = 'panel cm-debug-card';
  panel.innerHTML = `
    <div class="panel-head">
      <div><p class="eyebrow">DIAGNÓSTICO V4</p><h2>Estado completo del sistema</h2></div>
      <button id="cmRefreshDiagnostics" class="secondary" type="button">Actualizar</button>
    </div>
    <div class="cm-debug-grid">
      <div><strong id="cmDiagAuthTitle"></strong><span id="cmDiagAuthDetail"></span></div>
      <div><strong id="cmDiagCloudTitle"></strong><span id="cmDiagCloudDetail"></span></div>
      <div><strong id="cmDiagTeamsTitle"></strong><span id="cmDiagTeamsDetail"></span></div>
      <div><strong id="cmDiagTournamentsTitle"></strong><span id="cmDiagTournamentsDetail"></span></div>
      <div><strong id="cmDiagGoalsTitle"></strong><span>Con goleador/asistencia/minuto</span></div>
      <div><strong id="cmDiagCardsTitle"></strong><span>Amarillas y rojas estructuradas</span></div>
    </div>
    <div class="actions" style="margin-top:14px">
      <button id="cmTestFirebaseWrite" class="primary" type="button">Probar escritura Firebase</button>
      <button id="cmRepairDetailedModel" class="secondary" type="button">Reparar datos detallados</button>
    </div>
    <p class="muted" id="cmDiagnosticResult"></p>`;
  page.appendChild(panel);
  return panel;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element && element.textContent !== String(value)) element.textContent = String(value);
}

function renderDiagnostics() {
  const panel = ensureDiagnosticsPanel();
  if (!panel) return;

  const value = counts();
  setText('cmDiagAuthTitle', core.isAdmin() ? 'Autenticado' : 'Solo lectura');
  setText('cmDiagAuthDetail', `Sesión: ${core.authUser?.email || 'sin usuario'}`);
  setText('cmDiagCloudTitle', core.cloudLoaded ? 'Conectado' : 'Pendiente');
  setText('cmDiagCloudDetail', `Firebase · historial ${core.cloudHasHistory ? 'completo' : 'en reparación'}`);
  setText('cmDiagTeamsTitle', `${value.teams} equipos`);
  setText('cmDiagTeamsDetail', `${value.players} jugadores con ficha`);
  setText('cmDiagTournamentsTitle', `${value.tournaments} torneos`);
  setText('cmDiagTournamentsDetail', `${value.played}/${value.matches} partidos jugados`);
  setText('cmDiagGoalsTitle', `${value.goals} goles detallados`);
  setText('cmDiagCardsTitle', `${value.cards} tarjetas`);
  setText('cmDiagnosticResult', diagnosticMessage);

  const testButton = document.getElementById('cmTestFirebaseWrite');
  if (testButton) {
    testButton.disabled = diagnosticsBusy || !(core.isAdmin() && core.cloudLoaded);
    testButton.textContent = diagnosticsBusy ? 'Probando escritura…' : 'Probar escritura Firebase';
  }
}

function refresh() {
  model?.migrateState(core);
  renderReadiness();
  renderDiagnostics();
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    refresh();
  });
}

function buttonFromEvent(event, id) {
  const button = event.target.closest?.(`#${id}`);
  return button instanceof HTMLButtonElement ? button : null;
}

document.addEventListener('click', async (event) => {
  if (buttonFromEvent(event, 'cmRefreshDiagnostics')) {
    diagnosticMessage = `Diagnóstico actualizado · ${new Date().toLocaleTimeString('es-CL')}.`;
    refresh();
    core.showToast('Diagnóstico actualizado.');
    return;
  }

  if (buttonFromEvent(event, 'cmRepairDetailedModel')) {
    diagnosticMessage = 'Revisando el modelo detallado…';
    renderDiagnostics();
    model?.migrateState(core);
    core.persistLocal();
    core.render();
    window.ChuteDetailUI?.applyEnhancements?.();
    diagnosticMessage = `Modelo revisado correctamente · ${new Date().toLocaleTimeString('es-CL')}.`;
    refresh();
    core.showToast('Modelo de partidos revisado y reparado.');
    return;
  }

  if (buttonFromEvent(event, 'cmTestFirebaseWrite')) {
    diagnosticsBusy = true;
    diagnosticMessage = 'Probando escritura en Firebase…';
    renderDiagnostics();
    try {
      await core.saveCloud();
      diagnosticMessage = `Prueba correcta · ${new Date().toLocaleString('es-CL')}. Firebase aceptó la escritura.`;
      core.showToast('Firebase aceptó la escritura.');
    } catch (error) {
      diagnosticMessage = `Prueba rechazada: ${error.code || error.message || 'error desconocido'}.`;
      core.showToast(`Firebase rechazó la prueba: ${error.code || error.message || 'error desconocido'}.`);
    } finally {
      diagnosticsBusy = false;
      renderDiagnostics();
    }
  }
});

document.addEventListener('click', (event) => {
  const createButton = event.target.closest?.('#tournamentForm button[type="submit"]');
  if (!createButton) return;
  tournamentActionMessage = '<strong>Procesando:</strong> validando nombre, formato y equipos seleccionados…';
  renderReadiness();
});

document.addEventListener('submit', (event) => {
  if (event.target.id !== 'tournamentForm') return;
  const before = core.getState().tournaments.length;
  requestAnimationFrame(() => {
    const after = core.getState().tournaments.length;
    tournamentActionMessage = after > before
      ? '<strong>Torneo agregado.</strong> Guardando la información en Firebase…'
      : '<strong>Solicitud revisada.</strong> Si falta algún dato, aparecerá el motivo en el aviso inferior.';
    renderReadiness();
    window.setTimeout(() => {
      tournamentActionMessage = '';
      renderReadiness();
    }, 5000);
  });
});

document.addEventListener('change', (event) => {
  if (event.target.closest?.('#teamPicker')) renderReadiness();
});

const observer = new MutationObserver((mutations) => {
  const meaningfulMutation = mutations.some((mutation) => {
    const element = mutation.target.nodeType === Node.ELEMENT_NODE ? mutation.target : mutation.target.parentElement;
    return !element?.closest?.('#cmDiagnosticsPanel, #cmTournamentReadiness');
  });
  if (meaningfulMutation) schedule();
});
observer.observe(document.body, { childList: true, subtree: true, characterData: true });

refresh();
