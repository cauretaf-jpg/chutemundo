const VERSION = '5.22.0';
const core = window.ChuteMundoCore;
const history = window.ChuteV521History;
if (!core || !history) throw new Error('Chute Mundo v5.22 requiere el Archivo Histórico v5.21.');

const DEFAULT_VENUE = "Carloco's House";
const TEAM_COLORS = Object.freeze({
  polpetta: '#7c3aed',
  parrilla: '#dc2626',
  guanaco: '#f97316',
  perla: '#fb923c',
  trucha: '#38bdf8',
  pantera: '#111827'
});
const FALLBACK_COLORS = ['#0f766e', '#2563eb', '#be123c', '#a16207', '#4f46e5', '#15803d', '#9333ea', '#0369a1'];
const TAB_LABELS = Object.freeze({
  eternal: ['Resumen', 'Panorama general'],
  rankings: ['Jugadores', 'Goles, asistencias y porteros'],
  honours: ['Equipos y Palmarés', 'Trayectoria y premios'],
  archive: ['Torneos', 'Estadísticas por competencia'],
  records: ['Récords', 'Marcas históricas'],
  h2h: ['Frente a Frente', 'Rivalidades']
});

const model = window.ChuteDetailModel || {};
const esc = model.esc || ((value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])));
const norm = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const state = () => core.getState?.() || { teams: [], tournaments: [], friendlies: [] };
const teamById = (teamId, source = state()) => (source.teams || []).find((team) => team.id === teamId) || null;
const teamName = (teamId, source = state()) => teamById(teamId, source)?.name || core.teamName?.(teamId) || teamId || 'Por definir';
const logoUrl = (teamId) => model.logoUrl?.(teamId) || '';
const matchPlayed = (match) => core.matchPlayed?.(match) ?? (match?.homeGoals !== null && match?.homeGoals !== '' && match?.awayGoals !== null && match?.awayGoals !== '');
const clone = (value) => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));

let enhancing = false;
let enhanceQueued = false;
let venueMigrationRunning = false;
let lastVenueSignature = '';

function teamColor(teamOrName, source = state(), index = 0) {
  const name = typeof teamOrName === 'string' && teamById(teamOrName, source) ? teamName(teamOrName, source) : String(teamOrName || '');
  const key = norm(name);
  for (const [token, color] of Object.entries(TEAM_COLORS)) if (key.includes(token)) return color;
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function canonicalVenue(value) {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_VENUE;
  const key = norm(raw);
  if (key === 'wladi s house' || key === 'wladi s house campo 1') return "Wladi's House";
  if (key === 'carloco s house' || key === 'carloco s house campo 1' || key === 'carlo s house' || key === 'carlo s house campo 1') return DEFAULT_VENUE;
  return raw;
}

function venueSignature(source = state()) {
  return JSON.stringify({
    tournaments: (source.tournaments || []).map((tournament) => [tournament.id, (tournament.matches || []).map((match) => [match.id, match.venue || ''])]),
    friendlies: (source.friendlies || []).map((match) => [match.id, match.venue || ''])
  });
}

function migrateVenues() {
  if (venueMigrationRunning) return false;
  const source = state();
  const before = venueSignature(source);
  if (before === lastVenueSignature) return false;
  const next = clone(source);
  let changed = false;
  for (const tournament of next.tournaments || []) {
    for (const match of tournament.matches || []) {
      const venue = canonicalVenue(match.venue);
      if (match.venue !== venue) {
        match.venue = venue;
        changed = true;
      }
    }
  }
  for (const match of next.friendlies || []) {
    const venue = canonicalVenue(match.venue);
    if (match.venue !== venue) {
      match.venue = venue;
      changed = true;
    }
  }
  lastVenueSignature = changed ? venueSignature(next) : before;
  if (!changed) return false;
  venueMigrationRunning = true;
  try {
    core.setState(next);
    core.persistLocal?.();
    if (core.isAdmin?.() && core.cloudLoaded) void core.saveCloud?.();
  } finally {
    venueMigrationRunning = false;
  }
  return true;
}

function normalizeVenueSelect(select) {
  if (!(select instanceof HTMLSelectElement)) return;
  const target = canonicalVenue(select.value);
  const seen = new Map();
  for (const option of [...select.options]) {
    const canonical = canonicalVenue(option.value || option.textContent);
    if (seen.has(canonical)) {
      option.remove();
      continue;
    }
    seen.set(canonical, option);
    option.value = canonical;
    option.textContent = canonical;
  }
  if (!seen.has(DEFAULT_VENUE)) select.add(new Option(DEFAULT_VENUE, DEFAULT_VENUE));
  if (!seen.has("Wladi's House")) select.add(new Option("Wladi's House", "Wladi's House"));
  select.value = target || DEFAULT_VENUE;
  if (!select.value) select.value = DEFAULT_VENUE;
}

function normalizeVenueControls(root = document) {
  root.querySelectorAll?.('#cmV59Venue,[data-cm-v516-venue],select[name="venue"]').forEach(normalizeVenueSelect);
}

function formatGroup(tournament) {
  const type = norm(tournament?.type);
  const name = norm(tournament?.name);
  if (type.includes('division') || name.includes('division')) return 'division';
  if (type.includes('cup') || type.includes('knockout') || name.includes('copa')) return 'cup';
  if (type.includes('playoff') || name.includes('play off') || name.includes('playoff')) return 'playoff';
  if (type.includes('league') || name.includes('liga')) return 'league';
  return 'other';
}

function statusGroup(tournament) {
  if (tournament?.status === 'historical' || tournament?.champion) return 'historical';
  if (tournament?.status === 'active') return 'active';
  return 'upcoming';
}

function tournamentHasTeam(tournament, teamId) {
  if (!teamId || teamId === 'all') return true;
  if ([tournament?.champion, tournament?.runnerUp, tournament?.third].includes(teamId)) return true;
  if ((tournament?.teamIds || tournament?.teams || []).includes(teamId)) return true;
  return (tournament?.matches || []).some((match) => [match?.home, match?.away, match?.homeTeamId, match?.awayTeamId].includes(teamId));
}

function currentFilters() {
  const value = (name, fallback = 'all') => document.querySelector(`[data-cm-v521-filter="${name}"]`)?.value || fallback;
  return { era: value('era'), tournament: value('tournament'), format: value('format'), status: value('status'), team: value('team') };
}

function orderedTournaments(source = state()) {
  return [...(source.tournaments || [])].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt || left.startDate || left.date || '') || 0;
    const rightTime = Date.parse(right.createdAt || right.startDate || right.date || '') || 0;
    if (leftTime && rightTime && leftTime !== rightTime) return leftTime - rightTime;
    return (source.tournaments || []).indexOf(left) - (source.tournaments || []).indexOf(right);
  });
}

function filteredTournaments(source = state(), { ignoreTeam = false } = {}) {
  const filters = currentFilters();
  return orderedTournaments(source)
    .filter((tournament) => filters.era === 'all' || history.eraOf(tournament, source) === filters.era)
    .filter((tournament) => filters.tournament === 'all' || tournament.id === filters.tournament)
    .filter((tournament) => filters.format === 'all' || formatGroup(tournament) === filters.format)
    .filter((tournament) => filters.status === 'all' || statusGroup(tournament) === filters.status)
    .filter((tournament) => ignoreTeam || filters.team === 'all' || tournamentHasTeam(tournament, filters.team));
}

function resolveMatchTeam(tournament, match, side) {
  return match?.[side] || (side === 'home' ? core.resolveHome?.(tournament, match) : core.resolveAway?.(tournament, match));
}

function matchRows(tournaments) {
  return tournaments.flatMap((tournament) => (tournament.matches || [])
    .filter((match) => match?.stage !== 'bye' && matchPlayed(match))
    .map((match) => ({ tournament, match, home: resolveMatchTeam(tournament, match, 'home'), away: resolveMatchTeam(tournament, match, 'away') })))
    .filter((row) => row.home && row.away);
}

function winnerId(row) {
  const homeGoals = number(row.match.homeGoals);
  const awayGoals = number(row.match.awayGoals);
  if (homeGoals > awayGoals) return row.home;
  if (awayGoals > homeGoals) return row.away;
  if (number(row.match.homePens) > number(row.match.awayPens)) return row.home;
  if (number(row.match.awayPens) > number(row.match.homePens)) return row.away;
  return null;
}

function playerLabel(row) {
  if (!row) return '<span class="cm-v522-missing">Sin registro</span>';
  const teamId = row.teamId || [...(row.teams || [])][0] || '';
  return `<span class="cm-v522-leader-person">${model.photo?.(teamId, row.name, 'cm-v522-leader-photo') || `<span class="cm-v522-leader-photo">${esc(row.name.slice(0, 1))}</span>`}<span><b>${esc(row.name)}</b><small>${esc(teamName(teamId))}</small></span></span>`;
}

function teamLabel(teamId, source = state()) {
  const logo = logoUrl(teamId);
  return `<span class="cm-v522-team-label">${logo ? `<img src="${esc(logo)}" alt="">` : `<i style="--team-color:${teamColor(teamId, source)}">${esc(teamName(teamId, source).slice(0, 1))}</i>`}<b>${esc(teamName(teamId, source))}</b></span>`;
}

function truncate(value, length = 16) {
  const text = String(value || '');
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function smoothPath(points) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
  let path = `M ${points[0][0]} ${points[0][1]}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const midpoint = [(previous[0] + current[0]) / 2, (previous[1] + current[1]) / 2];
    path += ` Q ${previous[0]} ${previous[1]} ${midpoint[0]} ${midpoint[1]}`;
  }
  const last = points.at(-1);
  path += ` T ${last[0]} ${last[1]}`;
  return path;
}

function evolutionData(tournaments, source = state()) {
  const playedTournaments = tournaments.filter((tournament) => matchRows([tournament]).length);
  const totals = new Map((source.teams || []).map((team) => [team.id, 0]));
  const snapshots = [];
  for (const tournament of playedTournaments) {
    for (const row of matchRows([tournament])) {
      const homeGoals = number(row.match.homeGoals);
      const awayGoals = number(row.match.awayGoals);
      totals.set(row.home, number(totals.get(row.home)) + (homeGoals > awayGoals ? 3 : homeGoals === awayGoals ? 1 : 0));
      totals.set(row.away, number(totals.get(row.away)) + (awayGoals > homeGoals ? 3 : homeGoals === awayGoals ? 1 : 0));
    }
    snapshots.push({ tournament, totals: new Map(totals) });
  }
  const filters = currentFilters();
  let teams = (source.teams || []).filter((team) => snapshots.some((snapshot) => number(snapshot.totals.get(team.id)) > 0));
  if (filters.team !== 'all') teams = teams.filter((team) => team.id === filters.team);
  teams.sort((left, right) => number(snapshots.at(-1)?.totals.get(right.id)) - number(snapshots.at(-1)?.totals.get(left.id)));
  return { snapshots, teams: teams.slice(0, 8) };
}

function evolutionChart(tournaments, source = state()) {
  const { snapshots, teams } = evolutionData(tournaments, source);
  if (!snapshots.length || !teams.length) return '<div class="cm-v522-empty-chart">No hay suficientes partidos para construir la evolución histórica.</div>';
  const width = 1060;
  const height = 390;
  const margins = { left: 52, right: 26, top: 28, bottom: 78 };
  const innerWidth = width - margins.left - margins.right;
  const innerHeight = height - margins.top - margins.bottom;
  const max = Math.max(3, ...snapshots.flatMap((snapshot) => teams.map((team) => number(snapshot.totals.get(team.id)))));
  const x = (index) => snapshots.length === 1 ? margins.left + innerWidth / 2 : margins.left + index * innerWidth / (snapshots.length - 1);
  const y = (value) => margins.top + innerHeight - (value / max) * innerHeight;
  const grid = [0, .25, .5, .75, 1].map((ratio) => {
    const value = Math.round(max * ratio);
    return `<g><line x1="${margins.left}" y1="${y(value)}" x2="${width - margins.right}" y2="${y(value)}"></line><text x="8" y="${y(value) + 4}">${value}</text></g>`;
  }).join('');
  const series = teams.map((team, index) => {
    const color = teamColor(team.name, source, index);
    const points = snapshots.map((snapshot, snapshotIndex) => [x(snapshotIndex), y(number(snapshot.totals.get(team.id)))]);
    const circles = points.map(([cx, cy], snapshotIndex) => `<circle cx="${cx}" cy="${cy}" r="4.5" fill="${color}"><title>${esc(team.name)} · ${number(snapshots[snapshotIndex].totals.get(team.id))} puntos · ${esc(snapshots[snapshotIndex].tournament.name)}</title></circle>`).join('');
    return `<path d="${smoothPath(points)}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>${circles}`;
  }).join('');
  const labels = snapshots.map((snapshot, index) => `<text class="cm-v522-axis-label" x="${x(index)}" y="${height - 23}" transform="rotate(-25 ${x(index)} ${height - 23})">${esc(truncate(snapshot.tournament.name, 18))}</text>`).join('');
  const legend = teams.map((team, index) => `<span><i style="--team-color:${teamColor(team.name, source, index)}"></i>${esc(team.name)}</span>`).join('');
  return `<div class="cm-v522-chart-wrap"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolución de puntos históricos por torneo">${grid}${series}${labels}</svg></div><div class="cm-v522-chart-legend">${legend}</div>`;
}

function summaryMarkup(tournaments, source = state()) {
  const matches = matchRows(tournaments);
  const goals = matches.reduce((sum, row) => sum + number(row.match.homeGoals) + number(row.match.awayGoals), 0);
  const standings = history.teamStandings(tournaments, source, { respectTeam: false });
  const scorers = history.careerMetricRows(tournaments, 'goals', source);
  const assists = history.careerMetricRows(tournaments, 'assists', source);
  const keepers = history.goalkeeperCareerRows(tournaments, source);
  const closed = tournaments.filter((tournament) => statusGroup(tournament) === 'historical').length;
  const upcoming = tournaments.filter((tournament) => statusGroup(tournament) === 'upcoming').length;
  return `<section class="cm-v522-summary">
    <div class="cm-v522-kpis">
      <article><span>Torneos finalizados</span><b>${closed}</b><small>${upcoming} próximos</small></article>
      <article><span>Partidos oficiales</span><b>${matches.length}</b><small>${tournaments.length} competencias</small></article>
      <article><span>Goles registrados</span><b>${goals}</b><small>${matches.length ? (goals / matches.length).toFixed(2) : '0.00'} por partido</small></article>
      <article><span>Líder histórico</span><b>${esc(standings[0] ? teamName(standings[0].teamId, source) : 'Sin registro')}</b><small>${standings[0]?.points || 0} puntos</small></article>
    </div>
    <div class="cm-v522-summary-grid">
      <article class="cm-v522-leaders"><header><span>REFERENTES HISTÓRICOS</span><h3>Líderes acumulados</h3></header>
        <div><span><small>Goleador</small>${playerLabel(scorers[0])}<strong>${scorers[0]?.value || 0} goles</strong></span>
        <span><small>Asistidor</small>${playerLabel(assists[0])}<strong>${assists[0]?.value || 0} asistencias</strong></span>
        <span><small>Portero</small>${playerLabel(keepers[0])}<strong>${keepers[0]?.cleanSheets || 0} imbatidas</strong></span></div>
      </article>
      <article class="cm-v522-chart-card"><header><div><span>ANÁLISIS HISTÓRICO</span><h3>Evolución de la Tabla Eterna</h3><p>Los colores representan la identidad de cada equipo.</p></div></header>${evolutionChart(tournaments, source)}</article>
    </div>
  </section>`;
}

function placementLists(teamId, tournaments) {
  return {
    champions: tournaments.filter((tournament) => tournament.champion === teamId),
    runners: tournaments.filter((tournament) => tournament.runnerUp === teamId),
    thirds: tournaments.filter((tournament) => tournament.third === teamId),
    upcoming: tournaments.filter((tournament) => statusGroup(tournament) === 'upcoming' && tournamentHasTeam(tournament, teamId))
  };
}

function tournamentPills(tournaments, empty = '—', className = '') {
  return tournaments.length ? `<div class="cm-v522-tournament-pills ${className}">${tournaments.map((tournament) => `<span>${esc(tournament.name)}</span>`).join('')}</div>` : `<span class="cm-v522-missing">${esc(empty)}</span>`;
}

function teamHistoryMarkup(tournaments, source = state()) {
  const filters = currentFilters();
  const all = tournaments;
  const teams = (source.teams || []).filter((team) => filters.team === 'all' || team.id === filters.team);
  const rows = teams.map((team) => ({ team, lists: placementLists(team.id, all) }))
    .filter((row) => Object.values(row.lists).some((list) => list.length));
  const upcoming = all.filter((tournament) => statusGroup(tournament) === 'upcoming');
  return `<section class="cm-v522-team-history">
    <header><div><span>TRAYECTORIA POR EQUIPO</span><h2>Podios y próximas competencias</h2><p>Detalle nominal de los torneos ganados, subcampeonatos, terceros lugares y campeonatos pendientes.</p></div><b>${rows.length}</b></header>
    ${upcoming.length ? `<div class="cm-v522-upcoming"><strong>Próximos torneos</strong>${tournamentPills(upcoming, '', 'is-upcoming')}</div>` : ''}
    <div class="cm-v522-table-wrap"><table><thead><tr><th>Equipo</th><th>Campeón en</th><th>Subcampeón en</th><th>Tercer lugar en</th><th>Próximamente</th></tr></thead><tbody>${rows.length ? rows.map(({ team, lists }) => `<tr><td>${teamLabel(team.id, source)}</td><td>${tournamentPills(lists.champions)}</td><td>${tournamentPills(lists.runners)}</td><td>${tournamentPills(lists.thirds)}</td><td>${tournamentPills(lists.upcoming, 'Sin torneo asignado', 'is-upcoming')}</td></tr>`).join('') : '<tr><td colspan="5" class="cm-v522-empty-cell">No hay podios ni torneos próximos para este filtro.</td></tr>'}</tbody></table></div>
  </section>`;
}

function tournamentMetricLeader(tournament, kind, source = state()) {
  return history.careerMetricRows([tournament], kind, source)[0] || null;
}

function tournamentStats(tournaments, source = state()) {
  return tournaments.map((tournament) => {
    const matches = matchRows([tournament]);
    const goals = matches.reduce((sum, row) => sum + number(row.match.homeGoals) + number(row.match.awayGoals), 0);
    const draws = matches.filter((row) => number(row.match.homeGoals) === number(row.match.awayGoals)).length;
    const penalties = matches.filter((row) => number(row.match.homeGoals) === number(row.match.awayGoals) && winnerId(row)).length;
    const cleanSheets = matches.reduce((sum, row) => sum + (number(row.match.awayGoals) === 0 ? 1 : 0) + (number(row.match.homeGoals) === 0 ? 1 : 0), 0);
    const teams = new Set(matches.flatMap((row) => [row.home, row.away]));
    for (const teamId of tournament.teamIds || tournament.teams || []) teams.add(teamId);
    return {
      tournament,
      matches: matches.length,
      goals,
      average: matches.length ? goals / matches.length : 0,
      draws,
      penalties,
      cleanSheets,
      teams: teams.size,
      scorer: tournamentMetricLeader(tournament, 'goals', source),
      assister: tournamentMetricLeader(tournament, 'assists', source)
    };
  });
}

function venueRows(tournaments) {
  const map = new Map();
  for (const row of matchRows(tournaments)) {
    const venue = canonicalVenue(row.match.venue);
    const current = map.get(venue) || { venue, matches: 0, goals: 0, draws: 0 };
    current.matches += 1;
    current.goals += number(row.match.homeGoals) + number(row.match.awayGoals);
    if (number(row.match.homeGoals) === number(row.match.awayGoals)) current.draws += 1;
    map.set(venue, current);
  }
  return [...map.values()].sort((left, right) => right.matches - left.matches || left.venue.localeCompare(right.venue, 'es'));
}

function tournamentStatsMarkup(tournaments, source = state()) {
  const rows = tournamentStats(tournaments, source);
  const venues = venueRows(tournaments);
  const mostGoals = [...rows].sort((left, right) => right.goals - left.goals)[0];
  const bestAverage = [...rows].filter((row) => row.matches).sort((left, right) => right.average - left.average)[0];
  const mostMatches = [...rows].sort((left, right) => right.matches - left.matches)[0];
  const mostPenalties = [...rows].sort((left, right) => right.penalties - left.penalties)[0];
  const cards = [
    ['Más goles', mostGoals, mostGoals ? `${mostGoals.goals} goles` : 'Sin datos'],
    ['Mayor promedio', bestAverage, bestAverage ? `${bestAverage.average.toFixed(2)} por partido` : 'Sin datos'],
    ['Más partidos', mostMatches, mostMatches ? `${mostMatches.matches} partidos` : 'Sin datos'],
    ['Más definiciones por penales', mostPenalties, mostPenalties ? `${mostPenalties.penalties} series` : 'Sin datos']
  ];
  return `<section class="cm-v522-tournament-stats">
    <div class="cm-v522-tournament-records">${cards.map(([label, row, value]) => `<article><span>${esc(label)}</span><b>${esc(row?.tournament?.name || '—')}</b><small>${esc(value)}</small></article>`).join('')}</div>
    <article class="cm-v522-data-card"><header><div><span>RADIOGRAFÍA DE TORNEOS</span><h2>Rendimiento por competencia</h2><p>Partidos, goles, promedios, empates, penales y líderes individuales.</p></div><b>${rows.length}</b></header>
      <div class="cm-v522-table-wrap"><table><thead><tr><th>Torneo</th><th>Estado</th><th>Equipos</th><th>PJ</th><th>Goles</th><th>G/PJ</th><th>Empates</th><th>Penales</th><th>Imbatidas</th><th>Goleador</th><th>Asistidor</th><th>Campeón</th></tr></thead><tbody>${rows.length ? rows.map((row) => `<tr><td><b>${esc(row.tournament.name)}</b></td><td>${statusGroup(row.tournament) === 'historical' ? 'Finalizado' : statusGroup(row.tournament) === 'active' ? 'En juego' : 'Próximo'}</td><td>${row.teams}</td><td>${row.matches}</td><td>${row.goals}</td><td>${row.average.toFixed(2)}</td><td>${row.draws}</td><td>${row.penalties}</td><td>${row.cleanSheets}</td><td>${row.scorer ? `${esc(row.scorer.name)} (${row.scorer.value})` : '<span class="cm-v522-missing">S/R</span>'}</td><td>${row.assister ? `${esc(row.assister.name)} (${row.assister.value})` : '<span class="cm-v522-missing">S/R</span>'}</td><td>${row.tournament.champion ? esc(teamName(row.tournament.champion, source)) : '<span class="cm-v522-missing">Sin definir</span>'}</td></tr>`).join('') : '<tr><td colspan="12" class="cm-v522-empty-cell">No hay torneos para este filtro.</td></tr>'}</tbody></table></div>
    </article>
    <article class="cm-v522-data-card"><header><div><span>SEDES CONSOLIDADAS</span><h2>Registro oficial de escenarios</h2><p>Las variantes “Campo 1” y las sedes vacías se consolidan automáticamente.</p></div><b>${venues.length}</b></header>
      <div class="cm-v522-table-wrap is-small"><table><thead><tr><th>Sede</th><th>Partidos</th><th>Goles</th><th>G/PJ</th><th>Empates</th></tr></thead><tbody>${venues.length ? venues.map((row) => `<tr><td><b>${esc(row.venue)}</b></td><td>${row.matches}</td><td>${row.goals}</td><td>${(row.goals / row.matches).toFixed(2)}</td><td>${row.draws}</td></tr>`).join('') : '<tr><td colspan="5" class="cm-v522-empty-cell">No hay partidos con sede para este filtro.</td></tr>'}</tbody></table></div>
    </article>
  </section>`;
}

function removeColumnByHeader(table, label) {
  const headers = [...table.querySelectorAll('thead th')];
  const index = headers.findIndex((header) => norm(header.textContent) === norm(label));
  if (index < 0) return;
  for (const row of table.rows) row.cells[index]?.remove();
}

function refineRankingTables(root) {
  root.querySelectorAll('[data-cm-v521-ranking-panel] table').forEach((table) => removeColumnByHeader(table, 'Torneos'));
}

function relabelTabs(root) {
  root.querySelectorAll('[data-cm-v521-tab]').forEach((button) => {
    const labels = TAB_LABELS[button.dataset.cmV521Tab];
    if (!labels) return;
    const title = button.querySelector('b');
    const subtitle = button.querySelector('small');
    if (title) title.textContent = labels[0];
    if (subtitle) subtitle.textContent = labels[1];
  });
}

function installStyles() {
  if (document.getElementById('cmV522Styles')) return;
  const link = document.createElement('link');
  link.id = 'cmV522Styles';
  link.rel = 'stylesheet';
  link.href = `/chute-v522-stats-refinement.css?v=${VERSION}`;
  document.head.appendChild(link);
}

function enhance() {
  enhanceQueued = false;
  if (enhancing) return;
  const root = document.getElementById('cmV521History');
  if (!root || !root.getClientRects().length) {
    normalizeVenueControls();
    return;
  }
  enhancing = true;
  try {
    migrateVenues();
    normalizeVenueControls();
    relabelTabs(root);
    refineRankingTables(root);
    const source = state();
    const tournaments = filteredTournaments(source);
    const signature = JSON.stringify({
      filters: currentFilters(),
      tournaments: tournaments.map((tournament) => [tournament.id, tournament.status, tournament.champion, tournament.runnerUp, tournament.third, (tournament.matches || []).map((match) => [match.id, match.homeGoals, match.awayGoals, match.homePens, match.awayPens, match.venue, match.lineups, match.goals])]),
      teams: (source.teams || []).map((team) => [team.id, team.name, team.players])
    });
    const summaryPanel = root.querySelector('[data-cm-v521-panel="eternal"]');
    const honoursPanel = root.querySelector('[data-cm-v521-panel="honours"]');
    const archivePanel = root.querySelector('[data-cm-v521-panel="archive"]');
    if (root.dataset.cmV522Signature !== signature || !root.querySelector('.cm-v522-summary') || !root.querySelector('.cm-v522-team-history') || !root.querySelector('.cm-v522-tournament-stats')) {
      root.dataset.cmV522Signature = signature;
      root.querySelectorAll('.cm-v522-summary,.cm-v522-team-history,.cm-v522-tournament-stats').forEach((node) => node.remove());
      summaryPanel?.querySelector('.cm-v521-panel-intro')?.insertAdjacentHTML('afterend', summaryMarkup(tournaments, source));
      const firstHonoursCard = honoursPanel?.querySelector('.cm-v521-card');
      firstHonoursCard?.insertAdjacentHTML('afterend', teamHistoryMarkup(tournaments, source));
      archivePanel?.insertAdjacentHTML('beforeend', tournamentStatsMarkup(tournaments, source));
    }
    root.dataset.cmV522Ready = 'true';
  } finally {
    enhancing = false;
  }
}

function scheduleEnhance() {
  if (enhanceQueued) return;
  enhanceQueued = true;
  requestAnimationFrame(enhance);
}

installStyles();
migrateVenues();
normalizeVenueControls();
new MutationObserver(scheduleEnhance).observe(document.body, { childList: true, subtree: true });
document.addEventListener('change', (event) => {
  if (event.target.matches?.('#cmV59Venue,[data-cm-v516-venue],select[name="venue"]')) normalizeVenueSelect(event.target);
  if (event.target.closest?.('[data-cm-v521-filter],[data-cm-v521-h2h]')) setTimeout(scheduleEnhance, 0);
}, true);
document.addEventListener('submit', () => {
  normalizeVenueControls();
  setTimeout(() => { migrateVenues(); scheduleEnhance(); }, 250);
}, true);
document.addEventListener('click', (event) => {
  if (event.target.closest?.('[data-cm-v521-tab],[data-cm-v521-ranking],[data-page="estadisticas"],[data-cm-page="estadisticas"],[data-cm-mobile-page="estadisticas"]')) setTimeout(scheduleEnhance, 0);
}, true);
document.addEventListener('chute:ready', () => { migrateVenues(); scheduleEnhance(); });
document.addEventListener('chute:boot-complete', scheduleEnhance);
scheduleEnhance();

window.ChuteV522StatsRefinement = Object.freeze({
  version: VERSION,
  refresh: scheduleEnhance,
  canonicalVenue,
  migrateVenues,
  teamColor,
  filteredTournaments,
  evolutionData
});
