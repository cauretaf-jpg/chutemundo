(() => {
  "use strict";

  const VERSION = "1.4.0";
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function addStyles() {
    if ($("cmEnhancementStyles")) return;
    const style = document.createElement("style");
    style.id = "cmEnhancementStyles";
    style.textContent = `
      .cm-stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
      .cm-stat{border:1px solid var(--border,#dbe2ea);border-radius:14px;padding:15px;background:var(--card,#fff)}
      .cm-stat strong{display:block;font-size:1.65rem}.cm-stat span,.cm-note{color:var(--muted,#64748b);font-size:.86rem}
      .cm-toolbar,.cm-shortcuts{display:flex;flex-wrap:wrap;gap:10px;align-items:end;justify-content:space-between}
      .cm-toolbar .form-group{margin:0;min-width:190px}.cm-progress{display:flex;gap:8px;align-items:center;min-width:130px}
      .cm-bar{width:75px;height:8px;background:rgba(100,116,139,.2);border-radius:99px;overflow:hidden}.cm-bar i{display:block;height:100%;background:#22c55e}
      .cm-feedback{margin-top:12px;padding:10px 12px;border-radius:10px;background:rgba(59,130,246,.09);font-size:.9rem}
      @media(max-width:720px){.cm-stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cm-toolbar{align-items:stretch}.cm-toolbar .form-group{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function addStatisticsUi() {
    const section = $("estadisticas");
    if (!section || $("cmCompleteStats")) return;
    const anchor = section.querySelector(":scope > .card");
    const holder = document.createElement("div");
    holder.innerHTML = `
      <div class="card" id="cmCompleteStats">
        <div class="cm-toolbar"><div><h2>Resumen Estadístico Completo</h2><p class="muted">Indicadores según la era seleccionada.</p></div><button class="btn secondary small" id="cmRefreshStats">Actualizar</button></div>
        <div id="cmStatsGrid" class="cm-stats-grid"></div>
      </div>
      <div class="card" id="cmTournamentStatsCard">
        <div class="cm-toolbar"><div><h2>Todos los Torneos</h2><p class="muted">Avance y resultados de cada competencia.</p></div><div class="form-group"><label for="cmTournamentStatus">Estado</label><select id="cmTournamentStatus"><option value="all">Todos</option><option value="active">Activos</option><option value="upcoming">Próximos</option><option value="historical">Históricos</option></select></div></div>
        <div id="cmTournamentStats"></div>
      </div>
      <div class="card" id="cmParticipantCard">
        <div class="cm-toolbar"><div><h2>Estadísticas de Participantes</h2><p class="muted">Rendimiento de quienes controlan Local y Visita.</p></div><div class="form-group"><label for="participantEraFilter">Era</label><select id="participantEraFilter"><option value="all">Toda la Historia</option><option value="classic">Era Clásica</option><option value="division">Era Divisiones</option></select></div></div>
        <div id="participantStats"></div>
      </div>`;
    const reference = anchor ? anchor.nextSibling : section.firstChild;
    [...holder.children].forEach(node => section.insertBefore(node, reference));
    $("cmRefreshStats").addEventListener("click", renderExtraStatistics);
    $("cmTournamentStatus").addEventListener("change", renderTournamentStats);
    $("participantEraFilter").addEventListener("change", () => renderParticipantStats());
  }

  function addTournamentUi() {
    const section = $("torneos");
    if (!section) return;
    if (!$("cmTournamentShortcuts")) {
      const card = document.createElement("div");
      card.className = "card";
      card.id = "cmTournamentShortcuts";
      card.innerHTML = `<div class="cm-shortcuts"><div><h2>Gestión de Torneos</h2><p class="muted">Crea uno nuevo o replica la configuración del último.</p></div><div class="actions"><button class="btn primary" id="cmNewTournament">+ Nuevo torneo</button><button class="btn secondary" id="cmNextTournament">Crear siguiente</button><button class="btn secondary" id="cmViewStats">Ver estadísticas</button></div></div>`;
      section.insertBefore(card, section.firstChild);
      $("cmNewTournament").addEventListener("click", focusForm);
      $("cmNextTournament").addEventListener("click", createNextEnhanced);
      $("cmViewStats").addEventListener("click", () => { switchSection("estadisticas"); $("cmCompleteStats")?.scrollIntoView({behavior:"smooth"}); });
    }
    replaceButton("createTournamentBtn", "Crear y abrir torneo", createEnhanced);
    replaceButton("createNextTournamentBtn", "Crear próximo torneo", createNextEnhanced);
    const actions = $("createTournamentBtn")?.closest(".actions");
    if (actions && !$("cmTournamentFeedback")) {
      const note = document.createElement("div");
      note.id = "cmTournamentFeedback";
      note.className = "cm-feedback";
      note.textContent = "Se guardará en el navegador y se sincronizará con Supabase cuando esté conectado.";
      actions.after(note);
    }
  }

  function replaceButton(id, text, handler) {
    const old = $(id);
    if (!old || old.dataset.cmEnhanced) return;
    const button = old.cloneNode(true);
    button.dataset.cmEnhanced = "1";
    button.textContent = text;
    old.replaceWith(button);
    button.addEventListener("click", handler);
  }

  function focusForm() {
    switchSection("torneos");
    $("tName")?.scrollIntoView({behavior:"smooth",block:"center"});
    setTimeout(() => $("tName")?.focus(), 300);
  }

  function tournamentData(name, type, status, legs, teamIds) {
    return {
      id: uid("tour"), name, type, status, createdAt: new Date().toLocaleDateString("es-CL"),
      config:{legs}, teamIds:[...teamIds], matches:[], champion:null, runnerUp:null, third:null,
      notes:[], playerScorers:[], playerAssists:[], groups:[], manualStandings:[],
      participantLocal:state.participants[0]?.id||"", participantAway:state.participants[1]?.id||"",
      participantChampion:"", participantRunnerUp:"", participantThird:""
    };
  }

  function saveTournament(tournament) {
    buildTournamentFixtures(tournament, tournament.teamIds, Number(tournament.config.legs || 1));
    state.tournaments.push(tournament);
    saveState({syncCloud:true});
    refreshComputedData();
    renderAll();
    openTournament(tournament.id);
  }

  function createEnhanced() {
    const name = $("tName")?.value.trim() || "";
    const type = $("tType")?.value || "league";
    const status = $("tStatus")?.value || "upcoming";
    const legs = Number($("tLegs")?.value || 1);
    const teams = [...document.querySelectorAll("#teamPicker .team-check:checked")].map(input => input.value);
    let error = "";
    if (!name) error = "Escribe el nombre del torneo.";
    else if (state.tournaments.some(t => t.name.trim().toLowerCase() === name.toLowerCase())) error = "Ya existe un torneo con ese nombre.";
    else if (teams.length < 2) error = "Selecciona al menos 2 equipos.";
    else if ((type === "league_playoff" || type === "cup_groups") && teams.length < 4) error = "Este formato necesita al menos 4 equipos.";
    else if (type === "direct_knockout" && teams.length > 8) error = "La eliminación directa admite hasta 8 equipos.";
    if (error) return alert(error);
    const tournament = tournamentData(name, type, status, legs, teams);
    saveTournament(tournament);
    $("tName").value = "";
    $("tStatus").value = "upcoming";
    if ($("checkAllTeams")) $("checkAllTeams").checked = false;
    document.querySelectorAll("#teamPicker .team-check").forEach(input => input.checked = false);
    renderTournamentFormatUI();
  }

  function createNextEnhanced() {
    if (!state.tournaments.length) return focusForm();
    const last = state.tournaments.at(-1);
    const next = getNextTournamentName(last.name, last.type);
    let name = next.name;
    let number = 2;
    while (state.tournaments.some(t => t.name.trim().toLowerCase() === name.toLowerCase())) name = `${next.name} (${number++})`;
    const tournament = tournamentData(name, next.type, "upcoming", Number(last.config?.legs || 1), last.teamIds);
    tournament.notes.push(`Creado a partir de ${last.name}.`);
    saveTournament(tournament);
  }

  const validMatches = tournament => (tournament.matches || []).filter(match => match.stage !== "bye");

  function eraData() {
    const era = $("eraFilter")?.value || "all";
    const tournaments = state.tournaments.filter(t => isTournamentInEra(t, era));
    const official = tournaments.flatMap(t => validMatches(t));
    const cutoff = new Date("2026-04-01");
    const friendlies = state.friendlies.filter(match => {
      if (era === "all") return true;
      const date = match.date ? new Date(match.date.split("/").reverse().join("-")) : null;
      return ((!date || date < cutoff) ? "classic" : "division") === era;
    });
    return {era,tournaments,official,friendlies};
  }

  function renderOverview() {
    const box = $("cmStatsGrid");
    if (!box) return;
    const {era,tournaments,official,friendlies} = eraData();
    const all = [...official,...friendlies];
    const played = all.filter(matchPlayed);
    const goals = played.reduce((sum,m) => sum + Number(m.homeGoals||0) + Number(m.awayGoals||0),0);
    const cards = all.reduce((sum,m) => sum + (m.cards?.length || 0),0);
    const topScorer = aggregatePlayers("scorers","all","all",era)[0];
    const topAssist = aggregatePlayers("assists","all","all",era)[0];
    const leader = buildGlobalStandings(era)[0];
    const players = state.teams.reduce((sum,t) => sum + (t.players?.length || 0),0);
    const stats = [
      [state.teams.length,"Equipos",`${players} jugadores`],
      [tournaments.length,"Torneos",`${tournaments.filter(t=>t.champion).length} finalizados`],
      [official.filter(matchPlayed).length,"Oficiales jugados",`${official.filter(m=>!matchPlayed(m)).length} pendientes`],
      [friendlies.filter(matchPlayed).length,"Amistosos jugados",`${friendlies.length} registrados`],
      [goals,"Goles",played.length?`${(goals/played.length).toFixed(2)} por partido`:"Sin partidos"],
      [cards,"Tarjetas","Amarillas y rojas"],
      [leader?teamName(leader.teamId):"—","Líder histórico",leader?`${leader.pts} puntos`:"Sin datos"],
      [topScorer?.name||"—","Máximo goleador",topScorer?`${topScorer.value} goles`:"Sin datos"],
      [topAssist?.name||"—","Máximo asistidor",topAssist?`${topAssist.value} asistencias`:"Sin datos"],
      [state.participants.length,"Participantes","Controladores"]
    ];
    box.innerHTML = stats.map(([value,label,note]) => `<div class="cm-stat"><strong>${esc(value)}</strong><span>${esc(label)}</span><div class="cm-note">${esc(note)}</div></div>`).join("");
  }

  function renderTournamentStats() {
    const box = $("cmTournamentStats");
    if (!box) return;
    const filter = $("cmTournamentStatus")?.value || "all";
    const tournaments = [...state.tournaments].filter(t => filter === "all" || t.status === filter).reverse();
    if (!tournaments.length) { box.innerHTML = '<p class="empty">No hay torneos para este filtro.</p>'; return; }
    box.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Torneo</th><th>Formato</th><th>Estado</th><th>Equipos</th><th>Avance</th><th>Goles</th><th>Campeón</th><th></th></tr></thead><tbody>${tournaments.map(t => {
      const matches = validMatches(t), played = matches.filter(matchPlayed);
      const goals = played.reduce((sum,m) => sum + Number(m.homeGoals||0) + Number(m.awayGoals||0),0);
      const progress = matches.length ? Math.round(played.length/matches.length*100) : 0;
      return `<tr><td><strong>${esc(t.name)}</strong><br><span class="muted">${esc(t.createdAt||"")}</span></td><td>${esc(typeLabel(t.type))}</td><td><span class="badge">${esc(statusLabel(t.status))}</span></td><td>${t.teamIds?.length||0}</td><td><div class="cm-progress"><div class="cm-bar"><i style="width:${progress}%"></i></div>${played.length}/${matches.length}</div></td><td>${goals}</td><td>${t.champion?esc(teamName(t.champion)):"—"}</td><td><button class="btn primary small" data-cm-open="${esc(t.id)}">Abrir</button></td></tr>`;
    }).join("")}</tbody></table></div>`;
    box.querySelectorAll("[data-cm-open]").forEach(button => button.addEventListener("click", () => openTournament(button.dataset.cmOpen)));
  }

  function renderExtraStatistics() {
    const era = $("eraFilter")?.value || "all";
    if ($("participantEraFilter")) $("participantEraFilter").value = era;
    renderOverview();
    renderTournamentStats();
    renderParticipantStats();
  }

  function init() {
    if (typeof state === "undefined") return;
    addStyles();
    addStatisticsUi();
    addTournamentUi();
    const baseRenderAll = renderAll;
    renderAll = (...args) => {
      const result = baseRenderAll(...args);
      addStatisticsUi();
      addTournamentUi();
      renderExtraStatistics();
      return result;
    };
    window.renderAll = renderAll;
    $("eraFilter")?.addEventListener("change", renderExtraStatistics);
    renderExtraStatistics();
    window.ChuteMundoEnhancements = {version:VERSION,render:renderExtraStatistics,createTournament:createEnhanced};
  }

  init();
})();
