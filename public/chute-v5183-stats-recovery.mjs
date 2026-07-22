const core = window.ChuteMundoCore;
if (!core) throw new Error('Chute Mundo no está listo para recuperar estadísticas.');

const VERSION = '5.18.3';
const esc = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const played = (match) => core.matchPlayed?.(match) ?? (match?.homeGoals !== null && match?.awayGoals !== null);
const teamName = (id) => core.teamName?.(id) || id || 'Por definir';
let activeTab = 'summary';
let lastError = window.__CM_V518_IMPORT_ERROR__ || null;

function tournamentMatches(tournament) {
  return Array.isArray(tournament?.matches) ? tournament.matches.filter((match) => match?.stage !== 'bye' && played(match)) : [];
}

function teamRows(state) {
  const map = new Map((state.teams || []).map((team) => [team.id, { teamId: team.id, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, titles: 0 }]));
  for (const tournament of state.tournaments || []) {
    if (map.has(tournament.champion)) map.get(tournament.champion).titles += 1;
    for (const match of tournamentMatches(tournament)) {
      const homeId = match.home || core.resolveHome?.(tournament, match);
      const awayId = match.away || core.resolveAway?.(tournament, match);
      const home = map.get(homeId);
      const away = map.get(awayId);
      if (!home || !away) continue;
      const hg = Number(match.homeGoals || 0);
      const ag = Number(match.awayGoals || 0);
      home.pj += 1; away.pj += 1; home.gf += hg; home.gc += ag; away.gf += ag; away.gc += hg;
      if (hg > ag) { home.pg += 1; away.pp += 1; }
      else if (ag > hg) { away.pg += 1; home.pp += 1; }
      else { home.pe += 1; away.pe += 1; }
    }
  }
  return [...map.values()].filter((row) => row.pj || row.titles).map((row) => ({ ...row, dg: row.gf - row.gc })).sort((a, b) => b.titles - a.titles || b.pg - a.pg || b.dg - a.dg);
}

function playerRows(state, kind) {
  const map = new Map();
  for (const tournament of state.tournaments || []) {
    const rows = kind === 'goals' ? tournament.playerScorers : tournament.playerAssists;
    for (const row of Array.isArray(rows) ? rows : []) {
      if (!Array.isArray(row)) continue;
      const [name, teamId, appearances, value] = row;
      if (!name || !teamId) continue;
      const key = `${teamId}__${name}`;
      const current = map.get(key) || { name, teamId, appearances: 0, value: 0 };
      current.appearances = Math.max(current.appearances, Number(appearances || 0));
      current.value += Number(value || 0);
      map.set(key, current);
    }
  }
  return [...map.values()].filter((row) => row.value).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'es'));
}

function table(headers, rows, empty = 'Sin datos registrados.') {
  return `<div class="cm-v518-table"><table><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td colspan="${headers.length}">${esc(empty)}</td></tr>`}</tbody></table></div>`;
}

function activateTab(tab) {
  activeTab = ['summary', 'teams', 'players', 'tournaments'].includes(tab) ? tab : 'summary';
  document.querySelectorAll('#cmV518Stats [data-cm-v518-tab]').forEach((button) => button.classList.toggle('active', button.dataset.cmV518Tab === activeTab));
  document.querySelectorAll('#cmV518Stats [data-cm-v518-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.cmV518Panel === activeTab));
}

function renderShell(error = lastError) {
  lastError = error || lastError;
  const page = document.getElementById('estadisticas');
  if (!page) return;
  page.hidden = false;
  const title = page.querySelector('.page-title');
  if (title) title.innerHTML = '<p class="eyebrow">RENDIMIENTO</p><h1>Estadísticas</h1><p>Vista compatible del historial de Chute Mundo.</p>';
  [...page.children].forEach((child) => {
    if (child.id === 'cmV518Stats' || child.classList.contains('page-title')) return;
    child.hidden = true;
    child.style.setProperty('display', 'none', 'important');
  });

  const state = core.getState();
  const tournaments = state.tournaments || [];
  const matches = tournaments.flatMap(tournamentMatches);
  const goals = matches.reduce((sum, match) => sum + Number(match.homeGoals || 0) + Number(match.awayGoals || 0), 0);
  const teams = teamRows(state);
  const scorers = playerRows(state, 'goals');
  const assists = playerRows(state, 'assists');

  let host = document.getElementById('cmV518Stats');
  if (!host) {
    host = document.createElement('div');
    host.id = 'cmV518Stats';
    title?.insertAdjacentElement('afterend', host);
  }
  host.innerHTML = `<section class="cm-v518-toolbar">
      <div class="notice info" style="margin:0"><b>Modo de compatibilidad estadística</b><span>Se recuperó la vista usando un normalizador para registros históricos.</span></div>
      <nav class="cm-v518-tabs" aria-label="Secciones estadísticas">
        <button data-cm-v518-tab="summary">Resumen</button><button data-cm-v518-tab="teams">Equipos</button><button data-cm-v518-tab="players">Jugadores</button><button data-cm-v518-tab="tournaments">Torneos</button><button type="button" data-cm-v5181-analysis>Análisis histórico</button>
      </nav>
    </section>
    <div class="cm-v518-content">
      <section class="cm-v518-panel" data-cm-v518-panel="summary"><div class="cm-v518-metrics">
        <article class="cm-v518-metric"><b>${tournaments.length}</b><span>Torneos</span></article>
        <article class="cm-v518-metric"><b>${matches.length}</b><span>Partidos</span></article>
        <article class="cm-v518-metric"><b>${goals}</b><span>Goles</span></article>
        <article class="cm-v518-metric"><b>${esc(teams[0] ? teamName(teams[0].teamId) : '—')}</b><span>Más títulos</span></article>
        <article class="cm-v518-metric"><b>${esc(scorers[0]?.name || '—')}</b><span>Goleador</span><small>${scorers[0]?.value || 0} goles</small></article>
        <article class="cm-v518-metric"><b>${esc(assists[0]?.name || '—')}</b><span>Asistidor</span><small>${assists[0]?.value || 0} asistencias</small></article>
      </div>${lastError ? `<article class="cm-v518-card"><p class="eyebrow">DIAGNÓSTICO</p><h2>Vista avanzada recuperada</h2><p>Un registro histórico no coincidía con el formato esperado. La información disponible se muestra mediante la capa compatible v${VERSION}.</p></article>` : ''}</section>
      <section class="cm-v518-panel" data-cm-v518-panel="teams"><article class="cm-v518-card"><h2>Equipos</h2>${table(['#','Equipo','Títulos','PJ','PG','PE','PP','GF','GC','DG'], teams.map((row, index) => `<tr><td>${index + 1}</td><td>${esc(teamName(row.teamId))}</td><td>${row.titles}</td><td>${row.pj}</td><td>${row.pg}</td><td>${row.pe}</td><td>${row.pp}</td><td>${row.gf}</td><td>${row.gc}</td><td>${row.dg > 0 ? '+' : ''}${row.dg}</td></tr>`) )}</article></section>
      <section class="cm-v518-panel" data-cm-v518-panel="players"><div class="cm-v518-two"><article class="cm-v518-card"><h2>Goleadores</h2>${table(['#','Jugador','Equipo','Goles'], scorers.map((row, index) => `<tr><td>${index + 1}</td><td>${esc(row.name)}</td><td>${esc(teamName(row.teamId))}</td><td>${row.value}</td></tr>`))}</article><article class="cm-v518-card"><h2>Asistencias</h2>${table(['#','Jugador','Equipo','Asist.'], assists.map((row, index) => `<tr><td>${index + 1}</td><td>${esc(row.name)}</td><td>${esc(teamName(row.teamId))}</td><td>${row.value}</td></tr>`))}</article></div></section>
      <section class="cm-v518-panel" data-cm-v518-panel="tournaments"><article class="cm-v518-card"><h2>Torneos</h2>${table(['Torneo','Estado','Partidos','Goles','Campeón'], tournaments.map((tournament) => { const rows = tournamentMatches(tournament); const totalGoals = rows.reduce((sum, match) => sum + Number(match.homeGoals || 0) + Number(match.awayGoals || 0), 0); return `<tr><td>${esc(tournament.name || 'Torneo')}</td><td>${esc(tournament.status || '—')}</td><td>${rows.length}</td><td>${totalGoals}</td><td>${esc(tournament.champion ? teamName(tournament.champion) : '—')}</td></tr>`; }))}</article></section>
    </div>`;
  activateTab(activeTab);
  document.title = 'Chute Mundo v5.18.3 · Estadísticas recuperadas';
  document.querySelector('.hero .eyebrow')?.replaceChildren('CHUTE MUNDO v5.18.3');
}

document.addEventListener('click', (event) => {
  const tab = event.target.closest?.('#cmV518Stats [data-cm-v518-tab]');
  if (!tab) return;
  event.preventDefault();
  activateTab(tab.dataset.cmV518Tab);
}, true);

function activate(error) {
  lastError = error || lastError;
  window.ChuteV518EraStats = { version: VERSION, renderShell };
  renderShell(lastError);
}

window.ChuteV5183StatsRecovery = { version: VERSION, activate, renderShell };
if (!window.ChuteV518EraStats) activate(lastError);
