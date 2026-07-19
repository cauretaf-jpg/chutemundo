function waitForCore() {
  if (window.ChuteMundoCore) return Promise.resolve(window.ChuteMundoCore);
  return new Promise((resolve) => document.addEventListener('chute:ready', (event) => resolve(event.detail), { once: true }));
}

const core = await waitForCore();
const model = window.ChuteDetailModel;
if (!model) throw new Error('El modelo detallado no está disponible para el centro de jornada.');

const { esc, logo } = model;
const VERSION = '5.10.0';
let lastSignature = '';
let refreshQueued = false;

const state = () => core.getState();
const played = (match) => core.matchPlayed(match);
const matchesOf = (tournament) => (tournament?.matches || []).filter((match) => match.stage !== 'bye');

function activeTournament() {
  const tournaments = state().tournaments || [];
  return [...tournaments].reverse().find((tournament) => tournament.status === 'active')
    || [...tournaments].reverse().find((tournament) => tournament.status === 'upcoming')
    || tournaments.at(-1)
    || null;
}

function matchContext(tournament, match) {
  const home = match.home || core.resolveHome(tournament, match);
  const away = match.away || core.resolveAway(tournament, match);
  return home && away ? { tournament, match, home, away, pair: `${tournament.id}__${match.id}` } : null;
}

function nextPending(tournament) {
  if (!tournament) return null;
  for (const match of matchesOf(tournament)) {
    if (played(match)) continue;
    const context = matchContext(tournament, match);
    if (context) return context;
  }
  return null;
}

function latestResults(limit = 3) {
  const rows = [];
  for (const tournament of state().tournaments || []) {
    for (const match of matchesOf(tournament)) {
      if (!played(match)) continue;
      const context = matchContext(tournament, match);
      if (!context) continue;
      rows.push({ ...context, timestamp: Date.parse(match.date || '') || Number(match.registrationStartedAt || match.updatedAt || 0) });
    }
  }
  return rows.sort((a, b) => b.timestamp - a.timestamp || String(b.tournament.id).localeCompare(String(a.tournament.id))).slice(0, limit);
}

function standings(tournament) {
  if (!tournament) return [];
  const rows = new Map((tournament.teamIds || []).map((teamId) => [teamId, { teamId, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 }]));
  for (const match of matchesOf(tournament)) {
    if (!played(match)) continue;
    const context = matchContext(tournament, match);
    if (!context || !rows.has(context.home) || !rows.has(context.away)) continue;
    const home = rows.get(context.home);
    const away = rows.get(context.away);
    const hg = Number(match.homeGoals || 0);
    const ag = Number(match.awayGoals || 0);
    home.pj += 1; away.pj += 1;
    home.gf += hg; home.gc += ag; away.gf += ag; away.gc += hg;
    if (hg > ag) { home.pg += 1; away.pp += 1; home.pts += 3; }
    else if (ag > hg) { away.pg += 1; home.pp += 1; away.pts += 3; }
    else { home.pe += 1; away.pe += 1; home.pts += 1; away.pts += 1; }
  }
  return [...rows.values()]
    .map((row) => ({ ...row, dg: row.gf - row.gc }))
    .sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || core.teamName(a.teamId).localeCompare(core.teamName(b.teamId), 'es'));
}

function individualLeaders(tournament) {
  const goals = new Map();
  const assists = new Map();
  for (const match of matchesOf(tournament)) {
    if (!played(match)) continue;
    for (const event of match.goals || []) {
      const teamId = event.teamId || (event.side === 'away' ? core.resolveAway(tournament, match) : core.resolveHome(tournament, match));
      const scorer = String(event.playerName || event.scorerName || '').trim();
      const assist = String(event.assistName || '').trim();
      if (scorer) {
        const key = `${teamId}::${scorer}`;
        goals.set(key, { name: scorer, teamId, value: (goals.get(key)?.value || 0) + 1 });
      }
      if (assist) {
        const key = `${teamId}::${assist}`;
        assists.set(key, { name: assist, teamId, value: (assists.get(key)?.value || 0) + 1 });
      }
    }
  }
  const fallback = (rows, label) => (rows || []).map((row) => ({
    name: row.name || row.playerName || row.player || label,
    teamId: row.teamId || row.team || '',
    value: Number(row.value ?? row.goals ?? row.assists ?? row.total ?? 0)
  }));
  const goalRows = goals.size ? [...goals.values()] : fallback(tournament?.playerScorers, 'Sin registro');
  const assistRows = assists.size ? [...assists.values()] : fallback(tournament?.playerAssists, 'Sin registro');
  const sort = (rows) => rows.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'es'))[0] || null;
  return { scorer: sort(goalRows), assist: sort(assistRows) };
}

function normalizeName(value = '') {
  return String(value).trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
}

function disciplineSnapshot(targetTournament) {
  if (!targetTournament || targetTournament.type !== 'division_season') return [];
  const playerStates = new Map();
  const suspended = [];
  const ordered = (state().tournaments || []).filter((tournament) => tournament.type === 'division_season');
  const keyFor = (teamId, name) => `${teamId}::${normalizeName(name)}`;
  const getPlayer = (teamId, name) => {
    const key = keyFor(teamId, name);
    if (!playerStates.has(key)) playerStates.set(key, { teamId, name, yellowCarry: 0, pending: 0 });
    return playerStates.get(key);
  };

  for (const tournament of ordered) {
    const limit = Number(tournament.config?.discipline?.yellowLimit || 2);
    for (const match of matchesOf(tournament)) {
      const context = matchContext(tournament, match);
      if (!context) continue;
      for (const teamId of [context.home, context.away]) {
        for (const player of playerStates.values()) {
          if (player.teamId !== teamId || player.pending <= 0) continue;
          if (tournament.id === targetTournament.id && !played(match)) suspended.push({ ...player, matchId: match.id });
          player.pending -= 1;
        }
      }
      if (!played(match)) continue;
      for (const [side, teamId] of [['home', context.home], ['away', context.away]]) {
        const grouped = new Map();
        for (const card of match.cards || []) {
          if (card.side !== side || card.role === 'coach') continue;
          const name = String(card.playerName || '').trim();
          if (!name) continue;
          const normalized = normalizeName(name);
          if (!grouped.has(normalized)) grouped.set(normalized, { name, cards: [] });
          grouped.get(normalized).cards.push(card);
        }
        for (const group of grouped.values()) {
          const player = getPlayer(teamId, group.name);
          const yellows = group.cards.filter((card) => card.type === 'yellow').length;
          const doubleYellow = group.cards.some((card) => card.reason === 'double_yellow' || card.secondYellow === true || card.type === 'second_yellow_red') || yellows >= 2;
          const directRed = group.cards.some((card) => card.type === 'red' && card.reason !== 'double_yellow');
          if (doubleYellow || directRed) {
            player.yellowCarry = 0;
            player.pending = Math.max(player.pending, 1);
          } else if (yellows === 1) {
            player.yellowCarry += 1;
            if (player.yellowCarry >= limit) {
              player.yellowCarry = 0;
              player.pending = Math.max(player.pending, 1);
            }
          }
        }
      }
    }
  }
  const unique = new Map(suspended.map((player) => [keyFor(player.teamId, player.name), player]));
  return [...unique.values()];
}

function scoreMarkup(context) {
  return `${esc(core.teamName(context.home))} <b>${Number(context.match.homeGoals)}–${Number(context.match.awayGoals)}</b> ${esc(core.teamName(context.away))}`;
}

function nextMatchMarkup(context) {
  if (!context) return '<div class="cm-v510-empty"><strong>Sin partidos pendientes</strong><span>El torneo no tiene encuentros disponibles para registrar.</span></div>';
  const locked = !core.canEdit();
  return `<div class="cm-v510-next-match">
    <div>${logo(context.home, 'cm-v510-team-logo')}<strong>${esc(core.teamName(context.home))}</strong></div>
    <span><small>${esc(context.match.round || 'Próximo partido')}</small><b>VS</b><em>${esc(context.match.date || 'Fecha por definir')}</em></span>
    <div>${logo(context.away, 'cm-v510-team-logo')}<strong>${esc(core.teamName(context.away))}</strong></div>
  </div><button type="button" class="cm-v510-live-button ${locked ? 'is-locked' : ''}" data-cm-v510-live="${esc(context.pair)}">${locked ? 'Abrir modo partido 🔒' : 'Abrir modo partido'}</button>`;
}

function tableMarkup(rows) {
  if (!rows.length) return '<p class="cm-v510-muted">La tabla se completará al registrar resultados.</p>';
  return `<div class="cm-v510-table-wrap"><table><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>DG</th><th>PTS</th></tr></thead><tbody>${rows.slice(0, 5).map((row, index) => `<tr><td>${index + 1}</td><td>${esc(core.teamName(row.teamId))}</td><td>${row.pj}</td><td>${row.dg > 0 ? '+' : ''}${row.dg}</td><td><b>${row.pts}</b></td></tr>`).join('')}</tbody></table></div>`;
}

function journeyMarkup(tournament) {
  if (!tournament) return '<section id="cmV510Journey" class="cm-v510-journey"><div class="cm-v510-empty"><strong>No hay torneos registrados</strong><span>Crea una competencia para activar el centro de jornada.</span></div></section>';
  const next = nextPending(tournament);
  const latest = latestResults(3);
  const leaders = individualLeaders(tournament);
  const suspended = disciplineSnapshot(tournament);
  const pending = matchesOf(tournament).filter((match) => !played(match)).length;
  const completed = matchesOf(tournament).filter(played).length;
  return `<section id="cmV510Journey" class="cm-v510-journey" data-tournament-id="${esc(tournament.id)}">
    <header class="cm-v510-journey-head"><div><p class="eyebrow">CENTRO DE JORNADA</p><h2>${esc(tournament.name)}</h2><p>${completed} partidos jugados · ${pending} pendientes</p></div><button type="button" data-cm-v510-open-tournament="${esc(tournament.id)}">Abrir torneo</button></header>
    <div class="cm-v510-journey-grid">
      <article class="cm-v510-primary-card"><span class="cm-v510-card-label">PRÓXIMO ENCUENTRO</span>${nextMatchMarkup(next)}</article>
      <article><span class="cm-v510-card-label">TABLA ACTUAL</span>${tableMarkup(standings(tournament))}</article>
      <article><span class="cm-v510-card-label">LÍDERES</span><div class="cm-v510-leaders"><div><small>Goleador</small><b>${leaders.scorer ? esc(leaders.scorer.name) : '—'}</b><span>${leaders.scorer ? `${leaders.scorer.value} goles · ${esc(core.teamName(leaders.scorer.teamId))}` : 'Sin eventos individuales'}</span></div><div><small>Asistidor</small><b>${leaders.assist ? esc(leaders.assist.name) : '—'}</b><span>${leaders.assist ? `${leaders.assist.value} asistencias · ${esc(core.teamName(leaders.assist.teamId))}` : 'Sin eventos individuales'}</span></div></div></article>
      <article><span class="cm-v510-card-label">DISCIPLINA</span>${suspended.length ? `<div class="cm-v510-suspended"><b>${suspended.length} suspendido${suspended.length === 1 ? '' : 's'}</b>${suspended.slice(0, 4).map((player) => `<span>${esc(player.name)} · ${esc(core.teamName(player.teamId))}</span>`).join('')}</div>` : '<div class="cm-v510-clear"><b>Sin suspensiones pendientes</b><span>El plantel está disponible para la siguiente jornada.</span></div>'}</article>
    </div>
    <article class="cm-v510-results"><div><span class="cm-v510-card-label">ÚLTIMOS RESULTADOS</span><button type="button" data-page="partidos">Ver partidos</button></div>${latest.length ? latest.map((context) => `<p>${scoreMarkup(context)}<small>${esc(context.tournament.name)} · ${esc(context.match.round || '')}</small></p>`).join('') : '<p class="cm-v510-muted">Todavía no hay resultados registrados.</p>'}</article>
  </section>`;
}

function installStyles() {
  if (document.getElementById('cmV510Styles')) return;
  const link = document.createElement('link');
  link.id = 'cmV510Styles';
  link.rel = 'stylesheet';
  link.href = `/chute-v510.css?v=${VERSION}`;
  document.head.appendChild(link);
}

function render() {
  refreshQueued = false;
  const page = document.getElementById('inicio');
  if (!page) return;
  const tournament = activeTournament();
  const signature = JSON.stringify({
    admin: core.canEdit(),
    tournament: tournament ? [tournament.id, tournament.name, tournament.status, (tournament.matches || []).map((match) => [match.id, match.homeGoals, match.awayGoals, match.date, match.goals?.length || 0, match.cards?.length || 0])] : null,
    activity: (state().activity || []).slice(0, 2).map((item) => [item.id, item.at])
  });
  let root = document.getElementById('cmV510Journey');
  if (root && signature === lastSignature) return;
  lastSignature = signature;
  const markup = journeyMarkup(tournament);
  if (root) root.outerHTML = markup;
  else (document.getElementById('sourceNotice') || page.querySelector('.hero'))?.insertAdjacentHTML('afterend', markup);
}

function scheduleRender() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(render);
}

document.addEventListener('click', (event) => {
  const live = event.target.closest('[data-cm-v510-live]');
  if (live) {
    event.preventDefault();
    if (!core.canEdit()) document.getElementById('authButton')?.click();
    else window.ChuteV59?.openLiveMatch?.(live.dataset.cmV510Live);
    return;
  }
  const tournament = event.target.closest('[data-cm-v510-open-tournament]');
  if (tournament) {
    event.preventDefault();
    const trigger = document.querySelector(`[data-open-tournament="${CSS.escape(tournament.dataset.cmV510OpenTournament)}"]`);
    if (trigger) trigger.click();
    else core.navigate('torneos');
  }
}, true);

const home = document.getElementById('inicio');
if (home) new MutationObserver(scheduleRender).observe(home, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });

installStyles();
document.title = 'Chute Mundo v5.10 · Competición oficial';
const heroVersion = document.querySelector('.hero .eyebrow');
if (heroVersion) heroVersion.textContent = 'CHUTE MUNDO v5.10';
render();
window.setInterval(render, 1600);
window.ChuteV510Dashboard = { version: VERSION, activeTournament, nextPending, standings, individualLeaders, disciplineSnapshot, refresh: render };