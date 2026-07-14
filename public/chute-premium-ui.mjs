function waitForCore() {
  if (window.ChuteMundoCore) return Promise.resolve(window.ChuteMundoCore);
  return new Promise((resolve) => document.addEventListener('chute:ready', (event) => resolve(event.detail), { once: true }));
}

const core = await waitForCore();
const model = window.ChuteDetailModel;
if (!model) throw new Error('El modelo detallado no está disponible para la interfaz premium.');

const { esc, logo, photo, playerStatistics, ensureMatchEvents } = model;
let dashboardSignature = '';
let detailSignature = '';
let mobilePage = 'inicio';
let refreshBusy = false;

const PAGE_ICONS = {
  inicio: '⌂',
  torneos: '🏆',
  partidos: '⚽',
  equipos: '◉',
  jugadores: '♟',
  estadisticas: '▥',
  disciplina: '▣',
  administracion: '⚙'
};

function state() {
  return core.getState();
}

function team(id) {
  return core.teamById(id);
}

function teamIdByName(name = '') {
  const normalized = name.trim().toLowerCase();
  return state().teams.find((item) => item.name.trim().toLowerCase() === normalized)?.id || null;
}

function logoUrl(teamId) {
  return model.logoUrl(teamId);
}

function matchPlayed(match) {
  return core.matchPlayed(match);
}

function matchesOf(tournament) {
  return (tournament?.matches || []).filter((match) => match.stage !== 'bye');
}

function resolvedHome(tournament, match) {
  return core.resolveHome(tournament, match);
}

function resolvedAway(tournament, match) {
  return core.resolveAway(tournament, match);
}

function statusText(status) {
  return ({ active: 'En disputa', upcoming: 'Próximo', historical: 'Finalizado' })[status] || status || 'Competencia';
}

function formatRef(reference = '') {
  const map = {
    GROUP_A_1: '1.º Grupo A', GROUP_A_2: '2.º Grupo A',
    GROUP_B_1: '1.º Grupo B', GROUP_B_2: '2.º Grupo B',
    TABLE_1: '1.º de la tabla', TABLE_2: '2.º de la tabla', TABLE_3: '3.º de la tabla', TABLE_4: '4.º de la tabla',
    S1_W: 'Ganador Semifinal 1', S2_W: 'Ganador Semifinal 2',
    S1_L: 'Perdedor Semifinal 1', S2_L: 'Perdedor Semifinal 2',
    QF1_W: 'Ganador Cuarto 1', QF2_W: 'Ganador Cuarto 2', QF3_W: 'Ganador Cuarto 3', QF4_W: 'Ganador Cuarto 4'
  };
  return map[reference] || reference.replaceAll('_', ' ') || 'Por definir';
}

function sideInfo(tournament, match, side) {
  const teamId = side === 'home' ? resolvedHome(tournament, match) : resolvedAway(tournament, match);
  const reference = side === 'home' ? match.homeRef : match.awayRef;
  return {
    teamId,
    name: teamId ? core.teamName(teamId) : formatRef(reference),
    reference
  };
}

function matchScore(match) {
  if (!matchPlayed(match)) return 'VS';
  const base = `${Number(match.homeGoals)} – ${Number(match.awayGoals)}`;
  if (match.homePens !== null && match.homePens !== undefined && match.awayPens !== null && match.awayPens !== undefined) {
    return `${base} · pen. ${match.homePens}-${match.awayPens}`;
  }
  return base;
}

function parseDate(match) {
  if (!match?.date) return null;
  const raw = String(match.date).trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T${match.time || '12:00'}:00` : raw;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatMatchDate(match, compact = false) {
  const parsed = parseDate(match);
  const time = match?.time && match.time !== '00:00' ? match.time : '';
  if (!parsed) return [match?.date, time].filter(Boolean).join(' · ') || 'Fecha por definir';
  const date = new Intl.DateTimeFormat('es-CL', compact
    ? { day: '2-digit', month: 'short' }
    : { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }
  ).format(parsed).replace('.', '');
  return `${date}${time ? ` · ${time}` : ''}`;
}

function sortByDate(rows) {
  return [...rows].sort((a, b) => {
    const dateA = parseDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const dateB = parseDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return dateA - dateB;
  });
}

function computeStandings(teamIds, matches) {
  const table = Object.fromEntries(teamIds.map((teamId) => [teamId, {
    teamId, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0
  }]));
  for (const match of matches) {
    if (!matchPlayed(match)) continue;
    const homeId = match.home;
    const awayId = match.away;
    const home = table[homeId];
    const away = table[awayId];
    if (!home || !away) continue;
    const homeGoals = Number(match.homeGoals);
    const awayGoals = Number(match.awayGoals);
    home.pj += 1; away.pj += 1;
    home.gf += homeGoals; home.gc += awayGoals;
    away.gf += awayGoals; away.gc += homeGoals;
    if (homeGoals > awayGoals) { home.pg += 1; away.pp += 1; home.pts += 3; }
    else if (awayGoals > homeGoals) { away.pg += 1; home.pp += 1; away.pts += 3; }
    else { home.pe += 1; away.pe += 1; home.pts += 1; away.pts += 1; }
  }
  for (const row of Object.values(table)) row.dg = row.gf - row.gc;
  return Object.values(table)
    .sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.gc - b.gc || core.teamName(a.teamId).localeCompare(core.teamName(b.teamId), 'es'))
    .map((row, index) => ({ ...row, pos: index + 1 }));
}

function tournamentStandings(tournament) {
  if (tournament.manualStandings?.length) return [...tournament.manualStandings].sort((a, b) => a.pos - b.pos);
  return computeStandings(tournament.teamIds, tournament.matches.filter((match) => match.stage === 'regular'));
}

function groupStandings(tournament, group) {
  return computeStandings(
    group.teamIds,
    tournament.matches.filter((match) => match.stage === 'group' && match.group === group.name)
  );
}

function activeTournament() {
  return state().tournaments.find((tournament) => tournament.status === 'active')
    || state().tournaments.at(-1)
    || null;
}

function tournamentGoals(tournament) {
  return matchesOf(tournament).filter(matchPlayed).reduce((sum, match) => sum + Number(match.homeGoals || 0) + Number(match.awayGoals || 0), 0);
}

function competitionProgress(tournament) {
  const matches = matchesOf(tournament);
  const played = matches.filter(matchPlayed).length;
  return { matches, played, pending: matches.length - played, percent: matches.length ? Math.round((played / matches.length) * 100) : 0 };
}

function clubLogos(teamIds, className = 'cm-hero-club-logo') {
  return teamIds.map((teamId) => `<img class="${className}" src="${esc(logoUrl(teamId))}" alt="${esc(core.teamName(teamId))}" loading="lazy">`).join('');
}

function miniGroupMarkup(tournament, group) {
  const standings = groupStandings(tournament, group.name ? group : { name: group, teamIds: [] });
  const groupName = group.name || group;
  return `<article class="cm-mini-group">
    <header><strong>${esc(groupName)}</strong><span>Clasifican 2</span></header>
    <div>${standings.map((row, index) => `<div class="cm-mini-table-row ${index < 2 ? 'cm-qualified' : ''}">
      <span class="cm-mini-position">${index + 1}</span>
      <span class="cm-mini-team"><img src="${esc(logoUrl(row.teamId))}" alt=""><span>${esc(core.teamName(row.teamId))}</span></span>
      <span class="cm-mini-number">${row.pj}</span>
      <span class="cm-mini-number">${row.dg > 0 ? '+' : ''}${row.dg}</span>
      <span class="cm-mini-points">${row.pts}</span>
    </div>`).join('')}</div>
  </article>`;
}

function premiumMatchMarkup(tournament, match) {
  const home = sideInfo(tournament, match, 'home');
  const away = sideInfo(tournament, match, 'away');
  return `<article class="cm-premium-match">
    <div class="cm-premium-team">${home.teamId ? `<img src="${esc(logoUrl(home.teamId))}" alt="">` : ''}<span>${esc(home.name)}</span></div>
    <div class="cm-premium-result">${esc(matchScore(match))}</div>
    <div class="cm-premium-team away"><span>${esc(away.name)}</span>${away.teamId ? `<img src="${esc(logoUrl(away.teamId))}" alt="">` : ''}</div>
    <div class="cm-premium-match-meta">${esc(match.round || match.group || 'Partido')}<br>${esc(formatMatchDate(match, true))}</div>
  </article>`;
}

function recentResultMarkup(tournament, match) {
  const home = sideInfo(tournament, match, 'home');
  const away = sideInfo(tournament, match, 'away');
  const winnerId = Number(match.homeGoals) > Number(match.awayGoals) ? home.teamId : Number(match.awayGoals) > Number(match.homeGoals) ? away.teamId : home.teamId;
  return `<div class="cm-result-row">
    ${winnerId ? `<img src="${esc(logoUrl(winnerId))}" alt="">` : '<span></span>'}
    <div><strong>${esc(home.name)} vs. ${esc(away.name)}</strong><span>${esc(match.group || match.round || 'Partido')} · ${esc(formatMatchDate(match, true))}</span></div>
    <span class="cm-result-score">${Number(match.homeGoals)}–${Number(match.awayGoals)}</span>
  </div>`;
}

function featuredFixtureMarkup(tournament, match) {
  if (!match) return `<div class="cm-featured-date">No hay partidos pendientes.</div>`;
  const home = sideInfo(tournament, match, 'home');
  const away = sideInfo(tournament, match, 'away');
  return `<div class="cm-hero-side-label">${matchPlayed(match) ? 'ÚLTIMO RESULTADO' : 'PRÓXIMO PARTIDO'}</div>
    <div class="cm-featured-fixture">
      <div class="cm-featured-club">${home.teamId ? `<img src="${esc(logoUrl(home.teamId))}" alt="">` : ''}<strong>${esc(home.name)}</strong></div>
      <span class="cm-featured-score">${esc(matchScore(match))}</span>
      <div class="cm-featured-club">${away.teamId ? `<img src="${esc(logoUrl(away.teamId))}" alt="">` : ''}<strong>${esc(away.name)}</strong></div>
    </div>
    <div class="cm-featured-date">${esc(match.group || match.round || 'Partido')} · ${esc(formatMatchDate(match))}</div>`;
}

function dashboardStateSignature(tournament) {
  if (!tournament) return 'empty';
  return JSON.stringify({
    id: tournament.id,
    status: tournament.status,
    teams: tournament.teamIds,
    champion: tournament.champion,
    matches: matchesOf(tournament).map((match) => [match.id, match.home, match.away, match.homeGoals, match.awayGoals, match.homePens, match.awayPens, match.date, match.time, match.goals?.length, match.cards?.length])
  });
}

function renderDashboard() {
  const rootPage = document.getElementById('inicio');
  if (!rootPage) return;
  let root = document.getElementById('cmPremiumDashboard');
  if (!root) {
    root = document.createElement('div');
    root.id = 'cmPremiumDashboard';
    root.className = 'cm-premium-dashboard';
    rootPage.prepend(root);
  }

  const tournament = activeTournament();
  const signature = dashboardStateSignature(tournament);
  if (dashboardSignature === signature && root.children.length) return;
  dashboardSignature = signature;

  if (!tournament) {
    root.innerHTML = `<article class="panel"><p class="empty">No hay torneos registrados.</p></article>`;
    return;
  }

  const progress = competitionProgress(tournament);
  const played = progress.matches.filter(matchPlayed);
  const pendingGroup = progress.matches.filter((match) => !matchPlayed(match) && (match.stage === 'group' || match.stage === 'regular'));
  const pendingOther = progress.matches.filter((match) => !matchPlayed(match) && match.stage !== 'group' && match.stage !== 'regular');
  const nextMatch = sortByDate(pendingGroup)[0] || sortByDate(pendingOther)[0] || played.at(-1) || null;
  const recent = played.slice(-4).reverse();
  const playerRows = playerStatistics(core, [tournament]).filter((row) => row.role !== 'coach');
  const scorer = [...playerRows].sort((a, b) => b.goals - a.goals || b.assists - a.assists)[0] || null;
  const assists = [...playerRows].sort((a, b) => b.assists - a.assists || b.goals - a.goals)[0] || null;
  const groupsMarkup = tournament.groups?.length
    ? tournament.groups.map((group) => miniGroupMarkup(tournament, group)).join('')
    : `<div class="cm-mini-group"><header><strong>Tabla general</strong><span>${tournament.teamIds.length} equipos</span></header><div>${tournamentStandings(tournament).slice(0, 8).map((row, index) => `<div class="cm-mini-table-row ${index < 4 ? 'cm-qualified' : ''}"><span class="cm-mini-position">${index + 1}</span><span class="cm-mini-team"><img src="${esc(logoUrl(row.teamId))}" alt=""><span>${esc(core.teamName(row.teamId))}</span></span><span class="cm-mini-number">${row.pj}</span><span class="cm-mini-number">${row.dg > 0 ? '+' : ''}${row.dg}</span><span class="cm-mini-points">${row.pts}</span></div>`).join('')}</div></div>`;

  root.innerHTML = `
    <section class="cm-sport-hero">
      <div class="cm-hero-grid">
        <div class="cm-hero-copy">
          <div class="cm-hero-kicker"><span class="cm-live-dot"></span>${esc(statusText(tournament.status).toUpperCase())} · CHUTE MUNDO</div>
          <h1>${esc(tournament.name)}</h1>
          <p class="cm-hero-subtitle">Sigue la clasificación, los resultados, el fixture y los líderes individuales de la competencia activa.</p>
          <div class="cm-hero-meta"><span>${esc(tournament.type === 'cup_groups' ? 'Copa con grupos' : tournament.type)}</span><span>${tournament.teamIds.length} equipos</span><span>${progress.played}/${progress.matches.length} partidos</span><span>${tournamentGoals(tournament)} goles</span></div>
          <div class="cm-hero-clubs">${clubLogos(tournament.teamIds)}</div>
          <div class="cm-hero-actions"><button class="cm-hero-action-primary" data-cm-open-active>Ver torneo completo</button><button class="cm-hero-action-secondary" data-cm-page="partidos">Abrir partidos</button><button class="cm-hero-action-secondary" data-cm-page="estadisticas">Estadísticas</button></div>
        </div>
        <aside class="cm-hero-side">
          ${featuredFixtureMarkup(tournament, nextMatch)}
          <div class="cm-progress-block"><div class="cm-progress-copy"><span>Progreso del torneo</span><strong>${progress.percent}%</strong></div><div class="cm-progress-track"><div class="cm-progress-value" style="width:${progress.percent}%"></div></div></div>
        </aside>
      </div>
    </section>

    <section class="cm-kpi-grid">
      <article class="cm-kpi-card"><span class="cm-kpi-icon">⚽</span><b>${tournamentGoals(tournament)}</b><span>Goles en el torneo</span></article>
      <article class="cm-kpi-card"><span class="cm-kpi-icon">✓</span><b>${progress.played}</b><span>Partidos finalizados</span></article>
      <article class="cm-kpi-card"><span class="cm-kpi-icon">◷</span><b>${progress.pending}</b><span>Partidos pendientes</span></article>
      <article class="cm-kpi-card"><span class="cm-kpi-icon">★</span><b>${scorer?.goals || 0}</b><span>${scorer ? `Goles de ${esc(scorer.name)}` : 'Sin goleador'}</span></article>
    </section>

    <section class="cm-dashboard-layout">
      <div class="cm-dashboard-main">
        <article class="cm-premium-section">
          <header class="cm-premium-section-head"><div><p class="eyebrow">CLASIFICACIÓN</p><h2>${tournament.groups?.length ? 'Tablas de grupos' : 'Tabla de posiciones'}</h2><p>PJ · diferencia de gol · puntos</p></div><button class="cm-section-link" data-cm-open-active>Ver detalle</button></header>
          <div class="cm-group-table-grid">${groupsMarkup}</div>
        </article>
        <article class="cm-premium-section">
          <header class="cm-premium-section-head"><div><p class="eyebrow">CALENDARIO</p><h2>Próximos partidos</h2><p>Fixture pendiente de la competencia</p></div><button class="cm-section-link" data-cm-page="partidos">Ver todos</button></header>
          <div class="cm-fixture-strip">${[...pendingGroup, ...pendingOther].slice(0, 5).map((match) => premiumMatchMarkup(tournament, match)).join('') || '<p class="empty">No quedan partidos pendientes.</p>'}</div>
        </article>
      </div>
      <aside class="cm-dashboard-side">
        <article class="cm-premium-section cm-leader-card">
          ${scorer ? `<div class="cm-leader-content"><div class="cm-leader-copy"><p class="eyebrow">MÁXIMO GOLEADOR</p><h3>${esc(scorer.name)}</h3><p>${esc(core.teamName(scorer.teamId))}</p><img class="cm-leader-logo" src="${esc(logoUrl(scorer.teamId))}" alt=""><div class="cm-leader-number"><b>${scorer.goals}</b><span>goles · ${scorer.assists} asistencias</span></div></div>${photo(scorer.teamId, scorer.name, 'cm-leader-face')}</div>` : '<div class="cm-leader-content"><div class="cm-leader-copy"><p class="eyebrow">MÁXIMO GOLEADOR</p><h3>Sin registros</h3></div></div>'}
        </article>
        <article class="cm-premium-section">
          <header class="cm-premium-section-head"><div><p class="eyebrow">ÚLTIMOS PARTIDOS</p><h2>Resultados recientes</h2></div></header>
          <div class="cm-result-list">${recent.map((match) => recentResultMarkup(tournament, match)).join('') || '<p class="empty">Aún no hay resultados.</p>'}</div>
        </article>
        ${assists ? `<article class="cm-premium-section"><header class="cm-premium-section-head"><div><p class="eyebrow">CREACIÓN</p><h2>Líder de asistencias</h2><p>${esc(assists.name)} · ${esc(core.teamName(assists.teamId))}</p></div><strong>${assists.assists}</strong></header></article>` : ''}
      </aside>
    </section>`;
}

function tournamentProgressHero(tournament) {
  const progress = competitionProgress(tournament);
  return `<section id="cmPremiumTournamentHero" class="cm-premium-tournament-hero">
    <div class="cm-tournament-hero-grid">
      <div><p class="eyebrow" style="color:#9ed8c2">${esc(statusText(tournament.status).toUpperCase())}</p><h2>${esc(tournament.name)}</h2><p>${tournament.teamIds.length} equipos · ${progress.played} partidos jugados · ${tournamentGoals(tournament)} goles registrados</p><div class="cm-tournament-logo-strip">${clubLogos(tournament.teamIds, '')}</div></div>
      <div class="cm-tournament-progress-ring" style="--progress:${progress.percent}%"><span>${progress.percent}%</span></div>
    </div>
  </section>`;
}

function bracketSide(tournament, match, side) {
  const info = sideInfo(tournament, match, side);
  const score = side === 'home' ? match.homeGoals : match.awayGoals;
  return `<div class="cm-bracket-side">${info.teamId ? `<img src="${esc(logoUrl(info.teamId))}" alt="">` : '<span></span>'}<strong>${esc(info.name)}</strong><span class="cm-bracket-score">${matchPlayed(match) ? Number(score) : '—'}</span></div>`;
}

function bracketMarkup(tournament) {
  const knockout = tournament.matches.filter((match) => match.stage === 'knockout');
  if (!knockout.length) return '';
  const roundOrder = ['Cuartos de Final', 'Semifinales', '3er Lugar', 'Final'];
  const rounds = [...new Set(knockout.map((match) => match.round))].sort((a, b) => roundOrder.indexOf(a) - roundOrder.indexOf(b));
  return `<section id="cmPremiumBracket" class="cm-bracket-premium"><header class="cm-premium-section-head" style="padding:0 0 16px"><div><p class="eyebrow">FASE FINAL</p><h2>Cuadro de eliminación</h2></div></header><div class="cm-bracket-grid">${rounds.map((round) => `<div class="cm-bracket-round ${round === 'Final' ? 'cm-bracket-final' : ''}"><h4>${esc(round)}</h4>${knockout.filter((match) => match.round === round).map((match) => `<article class="cm-bracket-game">${bracketSide(tournament, match, 'home')}${bracketSide(tournament, match, 'away')}</article>`).join('')}</div>`).join('')}</div></section>`;
}

function detailStateSignature(tournament) {
  return tournament ? dashboardStateSignature(tournament) : 'none';
}

function decorateTables(root = document) {
  root.querySelectorAll('table tbody tr').forEach((row) => {
    const cells = row.querySelectorAll('td');
    const teamCell = cells[1];
    if (!teamCell || teamCell.dataset.cmPremiumDecorated === '1') return;
    const name = teamCell.textContent.trim();
    const teamId = teamIdByName(name);
    if (!teamId) return;
    teamCell.dataset.cmPremiumDecorated = '1';
    teamCell.innerHTML = `<span class="cm-table-team-cell"><img src="${esc(logoUrl(teamId))}" alt=""><span>${esc(name)}</span></span>`;
  });
}

function decorateMatchCards(root = document) {
  root.querySelectorAll('.match-card').forEach((card) => {
    const strongs = card.querySelectorAll('.match-main > strong');
    strongs.forEach((strong) => {
      if (strong.querySelector('.cm-match-card-logo')) return;
      const name = strong.textContent.trim();
      const teamId = teamIdByName(name);
      if (!teamId) return;
      const image = document.createElement('img');
      image.className = 'cm-match-card-logo';
      image.src = logoUrl(teamId);
      image.alt = '';
      if (strong.classList.contains('away')) strong.appendChild(image);
      else strong.prepend(image);
    });
  });
}

function enhanceTournamentDetail() {
  const root = document.getElementById('tournamentDetail');
  if (!root || !root.children.length) return;
  const title = root.querySelector('.tournament-head h2')?.textContent?.trim();
  const tournament = state().tournaments.find((item) => item.name === title);
  if (!tournament) return;
  const signature = detailStateSignature(tournament);
  if (detailSignature !== signature || !document.getElementById('cmPremiumTournamentHero')) {
    detailSignature = signature;
    root.querySelector('#cmPremiumTournamentHero')?.remove();
    root.querySelector('#cmPremiumBracket')?.remove();
    root.insertAdjacentHTML('afterbegin', tournamentProgressHero(tournament));
    const firstOriginalPanel = [...root.children].find((element) => element.id !== 'cmPremiumTournamentHero');
    const bracket = bracketMarkup(tournament);
    if (bracket && firstOriginalPanel) firstOriginalPanel.insertAdjacentHTML('afterend', bracket);
  }
  root.querySelectorAll('.panel.section-block').forEach((panel) => {
    const heading = panel.querySelector(':scope > h3')?.textContent || '';
    panel.classList.toggle('cm-group-panel-premium', /^Grupo\s/i.test(heading));
  });
  decorateTables(root);
  decorateMatchCards(root);
}

function ensureMobileNavigation() {
  if (document.getElementById('cmMobileNav')) return;
  const nav = document.createElement('nav');
  nav.id = 'cmMobileNav';
  nav.className = 'cm-mobile-nav';
  nav.setAttribute('aria-label', 'Navegación móvil');
  const primaryPages = [
    ['inicio', 'Inicio'], ['torneos', 'Torneos'], ['partidos', 'Partidos'], ['estadisticas', 'Estadísticas']
  ];
  nav.innerHTML = `${primaryPages.map(([page, label]) => `<button data-cm-mobile-page="${page}"><b>${PAGE_ICONS[page]}</b><span>${label}</span></button>`).join('')}<button data-cm-more><b>•••</b><span>Más</span></button>`;
  document.body.appendChild(nav);

  const sheet = document.createElement('div');
  sheet.id = 'cmMoreSheet';
  sheet.className = 'cm-more-sheet';
  sheet.innerHTML = [['equipos','Equipos'],['jugadores','Jugadores'],['disciplina','Disciplina'],['administracion','Administración']].map(([page,label]) => `<button data-cm-mobile-page="${page}">${PAGE_ICONS[page]} ${label}</button>`).join('');
  document.body.appendChild(sheet);
}

function syncMobileNavigation() {
  const active = document.querySelector('.nav-button.active')?.dataset.page || mobilePage;
  mobilePage = active;
  document.querySelectorAll('[data-cm-mobile-page]').forEach((button) => button.classList.toggle('active', button.dataset.cmMobilePage === active));
}

function navigate(page) {
  mobilePage = page;
  core.navigate(page);
  document.getElementById('cmMoreSheet')?.classList.remove('open');
  syncMobileNavigation();
}

function openActiveTournament() {
  const tournament = activeTournament();
  if (!tournament) return;
  const button = document.querySelector(`[data-open-tournament="${CSS.escape(tournament.id)}"]`);
  if (button) button.click();
  else {
    navigate('torneos');
    window.setTimeout(() => document.querySelector(`[data-open-tournament="${CSS.escape(tournament.id)}"]`)?.click(), 120);
  }
}

function generalEnhancements() {
  document.body.classList.add('cm-premium-theme');
  ensureMobileNavigation();
  decorateTables(document);
  decorateMatchCards(document);
  syncMobileNavigation();
}

function refreshPremiumUi() {
  if (refreshBusy) return;
  refreshBusy = true;
  try {
    renderDashboard();
    enhanceTournamentDetail();
    generalEnhancements();
  } catch (error) {
    console.error('No se pudo actualizar la interfaz premium.', error);
  } finally {
    refreshBusy = false;
  }
}

document.addEventListener('click', (event) => {
  const pageButton = event.target.closest('[data-cm-page]');
  if (pageButton) navigate(pageButton.dataset.cmPage);
  const mobileButton = event.target.closest('[data-cm-mobile-page]');
  if (mobileButton) navigate(mobileButton.dataset.cmMobilePage);
  if (event.target.closest('[data-cm-more]')) document.getElementById('cmMoreSheet')?.classList.toggle('open');
  if (event.target.closest('[data-cm-open-active]')) openActiveTournament();
  if (!event.target.closest('#cmMoreSheet') && !event.target.closest('[data-cm-more]')) document.getElementById('cmMoreSheet')?.classList.remove('open');
  window.setTimeout(refreshPremiumUi, 0);
});

document.addEventListener('change', () => window.setTimeout(refreshPremiumUi, 0));
document.addEventListener('submit', () => window.setTimeout(refreshPremiumUi, 250));

refreshPremiumUi();
window.setInterval(refreshPremiumUi, 900);
window.ChutePremiumUI = { refresh: refreshPremiumUi, renderDashboard, enhanceTournamentDetail };
