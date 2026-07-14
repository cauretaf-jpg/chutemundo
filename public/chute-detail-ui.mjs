function waitForCore() {
  if (window.ChuteMundoCore) return Promise.resolve(window.ChuteMundoCore);
  return new Promise((resolve) => document.addEventListener('chute:ready', (event) => resolve(event.detail), { once: true }));
}

const core = await waitForCore();
const model = window.ChuteDetailModel;
if (!model) throw new Error('El modelo detallado de Chute Mundo no está disponible.');

const { esc, playerName, playerPosition, photo, logo, ensureMatchEvents, playerStatistics, disciplineRows } = model;
let scheduled = false;
let rendering = false;
let playerSearch = '';
let playerTeamFilter = 'all';
let playerPositionFilter = 'all';

function teamStats(teamId) {
  const rows = { pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, titles: 0 };
  for (const tournament of core.getState().tournaments || []) {
    if (tournament.champion === teamId) rows.titles += 1;
    for (const match of tournament.matches || []) {
      if (!core.matchPlayed(match)) continue;
      const home = core.resolveHome(tournament, match);
      const away = core.resolveAway(tournament, match);
      if (home !== teamId && away !== teamId) continue;
      const gf = home === teamId ? Number(match.homeGoals) : Number(match.awayGoals);
      const gc = home === teamId ? Number(match.awayGoals) : Number(match.homeGoals);
      rows.pj += 1; rows.gf += gf; rows.gc += gc;
      if (gf > gc) rows.pg += 1; else if (gf < gc) rows.pp += 1; else rows.pe += 1;
    }
  }
  return { ...rows, dg: rows.gf - rows.gc, performance: rows.pj ? Math.round(((rows.pg * 3 + rows.pe) / (rows.pj * 3)) * 100) : 0 };
}

function ensureExtraPages() {
  const nav = document.querySelector('.nav');
  const main = document.querySelector('main.container');
  if (!nav || !main) return;
  if (!nav.querySelector('[data-page="jugadores"]')) {
    const button = document.createElement('button');
    button.className = 'nav-button';
    button.dataset.page = 'jugadores';
    button.textContent = 'Jugadores';
    const statsButton = nav.querySelector('[data-page="estadisticas"]');
    nav.insertBefore(button, statsButton || nav.lastElementChild);
  }
  if (!nav.querySelector('[data-page="disciplina"]')) {
    const button = document.createElement('button');
    button.className = 'nav-button';
    button.dataset.page = 'disciplina';
    button.textContent = 'Disciplina';
    const adminButton = nav.querySelector('[data-page="administracion"]');
    nav.insertBefore(button, adminButton || null);
  }
  if (!document.getElementById('jugadores')) {
    const section = document.createElement('section');
    section.id = 'jugadores';
    section.className = 'page';
    section.hidden = true;
    section.innerHTML = `
      <div class="page-title"><p class="eyebrow">PLANTELES OFICIALES</p><h1>Jugadores</h1><p>Fichas con rostro, posición y rendimiento acumulado.</p></div>
      <article class="panel cm-filter-panel">
        <label>Buscar<input id="cmPlayerSearch" placeholder="Nombre del jugador"></label>
        <label>Equipo<select id="cmPlayerTeam"><option value="all">Todos los equipos</option></select></label>
        <label>Posición<select id="cmPlayerPosition"><option value="all">Todas</option><option>Arquero</option><option>Defensa</option><option>Medio</option><option>Delantero</option></select></label>
      </article>
      <div id="cmPlayersGrid" class="cm-player-grid"></div>`;
    main.appendChild(section);
  }
  if (!document.getElementById('disciplina')) {
    const section = document.createElement('section');
    section.id = 'disciplina';
    section.className = 'page';
    section.hidden = true;
    section.innerHTML = `
      <div class="page-title"><p class="eyebrow">CONTROL DISCIPLINARIO</p><h1>Amarillas, rojas y sanciones</h1><p>Las tarjetas se calculan directamente desde los eventos registrados en cada partido.</p></div>
      <div id="cmDisciplineMetrics" class="metrics"></div>
      <article class="panel"><div class="panel-head"><div><p class="eyebrow">REGLAMENTO</p><h2>Suspensiones</h2></div></div><div id="cmDisciplineRules"></div></article>
      <article class="panel"><div class="panel-head"><div><p class="eyebrow">REGISTRO</p><h2>Tabla disciplinaria</h2></div></div><div id="cmDisciplineTable"></div></article>`;
    main.appendChild(section);
  }
}

function renderTeamPickerLogos() {
  document.querySelectorAll('#teamPicker .team-check').forEach((label) => {
    const input = label.querySelector('input');
    if (!input || label.querySelector('.cm-picker-logo')) return;
    const image = document.createElement('img');
    image.className = 'cm-picker-logo';
    image.src = model.logoUrl(input.value);
    image.alt = core.teamName(input.value);
    image.onerror = () => image.classList.add('logo-fallback');
    const oldBadge = label.querySelector('.team-badge');
    if (oldBadge) oldBadge.replaceWith(image); else label.insertBefore(image, input.nextSibling);
  });
}

function renderTeams() {
  const root = document.getElementById('teamList');
  if (!root) return;
  const state = core.getState();
  const signature = state.teams.map((team) => `${team.id}:${team.players?.length || 0}:${team.coach}`).join('|');
  if (root.dataset.cmSignature === signature && root.querySelector('.cm-team-grid')) return;
  root.dataset.cmSignature = signature;
  root.innerHTML = `<div class="cm-team-grid">${state.teams.map((team) => {
    const stats = teamStats(team.id);
    return `<button class="cm-team-card" type="button" data-cm-team="${esc(team.id)}">
      <div class="cm-team-card-head">${logo(team.id, 'cm-club-logo')}<div><strong>${esc(team.name)}</strong><span>${esc(team.coach || 'Sin DT')}</span></div></div>
      <div class="cm-team-card-stats"><span><b>${team.players?.length || 0}</b> jugadores</span><span><b>${stats.titles}</b> títulos</span><span><b>${stats.pj}</b> PJ</span><span><b>${stats.performance}%</b> rendimiento</span></div>
    </button>`;
  }).join('')}</div>`;
}

function teamProfileHtml(teamId) {
  const state = core.getState();
  const team = state.teams.find((item) => item.id === teamId);
  if (!team) return '<p>Equipo no encontrado.</p>';
  const stats = teamStats(teamId);
  const players = playerStatistics(core).filter((row) => row.teamId === teamId);
  const playerMap = new Map(players.map((row) => [row.name, row]));
  return `<div class="cm-team-profile">
    <div class="cm-profile-hero">${logo(team.id, 'cm-club-logo-xl')}<div><p class="eyebrow">FICHA DEL CLUB</p><h2>${esc(team.name)}</h2><p>DT: <strong>${esc(team.coach || 'Sin registrar')}</strong></p></div></div>
    <div class="cm-profile-metrics"><span><b>${stats.pj}</b>PJ</span><span><b>${stats.pg}</b>PG</span><span><b>${stats.gf}</b>GF</span><span><b>${stats.gc}</b>GC</span><span><b>${stats.dg}</b>DG</span><span><b>${stats.titles}</b>Títulos</span></div>
    <h3>Plantel · ${team.players?.length || 0} jugadores</h3>
    <div class="cm-roster-grid">${(team.players || []).map((player) => {
      const name = playerName(player); const position = playerPosition(player); const row = playerMap.get(name) || {};
      return `<article class="cm-roster-card">${photo(team.id, name, 'cm-player-face')}<div><strong>${esc(name)}</strong><span>${esc(position)}</span><small>${row.goals || 0} G · ${row.assists || 0} A · ${row.yellows || 0} 🟨 · ${row.reds || 0} 🟥</small></div></article>`;
    }).join('')}</div>
  </div>`;
}

function renderPlayers() {
  const select = document.getElementById('cmPlayerTeam');
  const grid = document.getElementById('cmPlayersGrid');
  if (!select || !grid) return;
  const state = core.getState();
  const current = select.value || playerTeamFilter;
  const options = `<option value="all">Todos los equipos</option>${state.teams.map((team) => `<option value="${esc(team.id)}">${esc(team.name)}</option>`).join('')}`;
  if (select.innerHTML !== options) { select.innerHTML = options; select.value = state.teams.some((team) => team.id === current) ? current : 'all'; }
  const statsRows = playerStatistics(core);
  const stats = new Map(statsRows.map((row) => [row.key, row]));
  const cards = [];
  for (const team of state.teams) {
    if (playerTeamFilter !== 'all' && team.id !== playerTeamFilter) continue;
    for (const player of team.players || []) {
      const name = playerName(player); const position = playerPosition(player);
      if (playerPositionFilter !== 'all' && position !== playerPositionFilter) continue;
      if (playerSearch && !name.toLowerCase().includes(playerSearch.toLowerCase())) continue;
      const row = stats.get(`${team.id}__${name}`) || { goals:0, assists:0, contributions:0, yellows:0, reds:0, appearances:0 };
      cards.push(`<article class="cm-player-card" data-cm-team="${esc(team.id)}">
        <div class="cm-player-image-wrap">${photo(team.id, name, 'cm-player-face-lg')}<span class="cm-position-tag">${esc(position)}</span></div>
        <div class="cm-player-card-body"><div class="cm-player-title"><strong>${esc(name)}</strong>${logo(team.id, 'cm-mini-logo')}</div><span>${esc(team.name)}</span>
        <div class="cm-player-numbers"><b>${row.goals}<small>Goles</small></b><b>${row.assists}<small>Asist.</small></b><b>${row.contributions}<small>G+A</small></b><b>${row.yellows}<small>🟨</small></b><b>${row.reds}<small>🟥</small></b></div></div>
      </article>`);
    }
  }
  const signature = `${playerSearch}|${playerTeamFilter}|${playerPositionFilter}|${cards.length}|${statsRows.reduce((sum,row)=>sum+row.contributions+row.yellows+row.reds,0)}`;
  if (grid.dataset.cmSignature !== signature) {
    grid.dataset.cmSignature = signature;
    grid.innerHTML = cards.join('') || '<article class="panel"><p class="empty">No hay jugadores que coincidan con el filtro.</p></article>';
  }
}

function renderDiscipline() {
  const rows = disciplineRows(core);
  const metrics = document.getElementById('cmDisciplineMetrics');
  const rules = document.getElementById('cmDisciplineRules');
  const table = document.getElementById('cmDisciplineTable');
  if (!metrics || !rules || !table) return;
  const yellow = rows.reduce((sum, row) => sum + row.yellows, 0);
  const red = rows.reduce((sum, row) => sum + row.reds, 0);
  const suspended = rows.filter((row) => row.suspended).length;
  metrics.innerHTML = `<article><b>${yellow}</b><span>Amarillas</span></article><article><b>${red}</b><span>Rojas</span></article><article><b>${suspended}</b><span>Suspendidos</span></article><article><b>${rows.length}</b><span>Jugadores con tarjetas</span></article>`;
  const config = core.getState().config?.discipline || {};
  rules.innerHTML = `<div class="cm-rule-grid"><div><strong>Doble amarilla</strong><span>${Number(config.yellowPerMatchSuspension || 2)} amarillas en el mismo partido</span></div><div><strong>Acumulación</strong><span>${Number(config.yellowAccumulationSuspension || 3)} amarillas acumuladas</span></div><div><strong>Roja directa</strong><span>Suspensión automática</span></div></div>`;
  table.innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>Jugador</th><th>Equipo</th><th>🟨</th><th>🟥</th><th>Estado</th></tr></thead><tbody>${rows.map((row) => `<tr class="${row.suspended ? 'cm-suspended' : ''}"><td><span class="cm-player-inline">${photo(row.teamId,row.name,'cm-table-face')}<strong>${esc(row.name)}</strong></span></td><td>${logo(row.teamId,'cm-table-logo')} ${esc(core.teamName(row.teamId))}</td><td>${row.yellows}</td><td>${row.reds}</td><td>${row.suspended ? `<span class="cm-status-danger">Suspendido · ${esc(row.reason)}</span>` : '<span class="cm-status-ok">Habilitado</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Todavía no hay tarjetas estructuradas.</p>';
}

function renderPlayerStats() {
  const rows = playerStatistics(core);
  const scorerRoot = document.getElementById('topScorers');
  const assistRoot = document.getElementById('topAssists');
  const make = (list, field, label) => list.length ? `<div class="cm-ranking-list">${list.slice(0,15).map((row,index) => `<div class="cm-ranking-row"><b>${index+1}</b>${photo(row.teamId,row.name,'cm-ranking-face')}<div><strong>${esc(row.name)}</strong><span>${esc(core.teamName(row.teamId))}</span></div><em>${row[field]} ${label}</em></div>`).join('')}</div>` : '<p class="empty">Sin registros.</p>';
  if (scorerRoot) scorerRoot.innerHTML = make([...rows].sort((a,b)=>b.goals-a.goals||b.assists-a.assists).filter(row=>row.goals), 'goals', 'goles');
  if (assistRoot) assistRoot.innerHTML = make([...rows].sort((a,b)=>b.assists-a.assists||b.goals-a.goals).filter(row=>row.assists), 'assists', 'asist.');
  const overview = document.getElementById('statsOverview');
  if (overview && !document.getElementById('cmCardsMetric')) {
    const cards = rows.reduce((sum,row)=>sum+row.yellows+row.reds,0);
    overview.insertAdjacentHTML('beforeend', `<article id="cmCardsMetric"><b>${cards}</b><span>Tarjetas registradas</span><small class="muted">${rows.reduce((s,r)=>s+r.yellows,0)} amarillas · ${rows.reduce((s,r)=>s+r.reds,0)} rojas</small></article>`);
  }
}

function renderMatchSummaries() {
  document.querySelectorAll('[data-edit-match]').forEach((button) => {
    const [tournamentId, matchId] = button.dataset.editMatch.split('__');
    const tournament = core.tournamentById(tournamentId);
    const match = tournament?.matches.find((item) => item.id === matchId);
    const card = button.closest('.match-card');
    if (!match || !card) return;
    const home = core.resolveHome(tournament, match); const away = core.resolveAway(tournament, match);
    ensureMatchEvents(match, home, away);
    let summary = card.querySelector('.cm-event-summary');
    if (!summary) { summary = document.createElement('div'); summary.className = 'cm-event-summary'; card.appendChild(summary); }
    const signature = `${match.goals.length}:${match.cards.length}:${match.date}:${match.time}:${match.venue}`;
    if (summary.dataset.signature === signature) return;
    summary.dataset.signature = signature;
    const goals = match.goals.map((goal) => `<span>⚽ ${esc(goal.playerName)}${goal.minute ? ` ${esc(goal.minute)}'` : ''}${goal.assistName ? ` <small>(${esc(goal.assistName)})</small>` : ''}</span>`).join('');
    const cards = match.cards.map((event) => `<span>${event.type === 'red' ? '🟥' : '🟨'} ${esc(event.playerName)}${event.minute ? ` ${esc(event.minute)}'` : ''}</span>`).join('');
    summary.innerHTML = `${match.date || match.time || match.venue ? `<div class="cm-match-meta-detail">${[match.date,match.time,match.venue].filter(Boolean).map(esc).join(' · ')}</div>` : ''}${goals ? `<div class="cm-event-line">${goals}</div>` : ''}${cards ? `<div class="cm-event-line">${cards}</div>` : ''}`;
  });
}

function renderTournamentLogos() {
  document.querySelectorAll('[data-open-tournament]').forEach((button) => {
    const item = button.closest('.list-item');
    const tournament = core.tournamentById(button.dataset.openTournament);
    if (!item || !tournament || item.querySelector('.cm-tournament-logos')) return;
    const strip = document.createElement('div');
    strip.className = 'cm-tournament-logos';
    strip.innerHTML = tournament.teamIds.slice(0,8).map((teamId)=>logo(teamId,'cm-tiny-logo')).join('');
    item.firstElementChild?.appendChild(strip);
  });
}

function applyEnhancements() {
  if (rendering) return;
  rendering = true;
  try {
    ensureExtraPages();
    model.migrateState(core);
    renderTeamPickerLogos();
    renderTeams();
    renderPlayers();
    renderDiscipline();
    renderPlayerStats();
    renderMatchSummaries();
    renderTournamentLogos();
  } finally {
    rendering = false;
  }
}

function scheduleEnhancements() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => { scheduled = false; applyEnhancements(); });
}

document.addEventListener('click', (event) => {
  const teamButton = event.target.closest('[data-cm-team]');
  if (teamButton && !event.target.closest('#cmPlayersGrid')) {
    core.openModal(teamProfileHtml(teamButton.dataset.cmTeam));
  }
});
document.addEventListener('input', (event) => {
  if (event.target.id === 'cmPlayerSearch') { playerSearch = event.target.value.trim(); renderPlayers(); }
});
document.addEventListener('change', (event) => {
  if (event.target.id === 'cmPlayerTeam') { playerTeamFilter = event.target.value; renderPlayers(); }
  if (event.target.id === 'cmPlayerPosition') { playerPositionFilter = event.target.value; renderPlayers(); }
});

const observer = new MutationObserver(scheduleEnhancements);
observer.observe(document.body, { childList: true, subtree: true });
applyEnhancements();
window.ChuteDetailUI = { applyEnhancements, teamProfileHtml };
