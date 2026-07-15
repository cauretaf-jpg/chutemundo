function waitForCore() {
  if (window.ChuteMundoCore) return Promise.resolve(window.ChuteMundoCore);
  return new Promise((resolve) => document.addEventListener('chute:ready', (event) => resolve(event.detail), { once: true }));
}

const core = await waitForCore();
const model = window.ChuteDetailModel;
if (!model) throw new Error('El modelo detallado no está disponible para las estadísticas de controladores.');

const { esc } = model;
const filters = { era: 'all', tournament: 'all' };
let lastSignature = '';

function state() { return core.getState(); }
function isPlayed(match) { return core.matchPlayed(match); }
function points(goalsFor, goalsAgainst) { return goalsFor > goalsAgainst ? 3 : goalsFor === goalsAgainst ? 1 : 0; }
function format(value) { return Number(value || 0).toFixed(2); }

function tournamentEra(tournament) {
  return tournament?.type === 'division_season' || tournament?.era === 'division' ? 'division' : 'league';
}

function eraLabel(value) {
  return value === 'division' ? 'Era de divisiones' : value === 'league' ? 'Era de ligas' : 'Todas las eras';
}

function matchDate(match) {
  if (!match?.date) return null;
  const raw = String(match.date).trim();
  const value = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T${match.time || '00:00'}:00` : raw;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function playedRecords(tournaments) {
  return tournaments.flatMap((tournament, tournamentIndex) => (tournament.matches || [])
    .filter((match) => match.stage !== 'bye')
    .map((match, matchIndex) => ({
      tournament,
      match,
      tournamentIndex,
      matchIndex,
      home: core.resolveHome(tournament, match),
      away: core.resolveAway(tournament, match)
    })))
    .filter(({ match, home, away }) => isPlayed(match) && home && away)
    .sort((left, right) => {
      const leftTime = matchDate(left.match)?.getTime();
      const rightTime = matchDate(right.match)?.getTime();
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return leftTime - rightTime;
      return left.tournamentIndex - right.tournamentIndex || left.matchIndex - right.matchIndex;
    });
}

function emptyController(key, name, role) {
  return {
    key, name, role,
    pj: 0, pg: 0, pe: 0, pp: 0,
    gf: 0, gc: 0, pts: 0,
    cleanSheets: 0,
    finalsWon: 0,
    titles: 0,
    winStreak: 0,
    unbeatenStreak: 0,
    bestWinStreak: 0,
    bestUnbeatenStreak: 0,
    biggestWin: null,
    form: []
  };
}

function finalWinnerSide(match) {
  const homeGoals = Number(match.homeGoals);
  const awayGoals = Number(match.awayGoals);
  if (homeGoals > awayGoals) return 'home';
  if (awayGoals > homeGoals) return 'away';
  if (match.homePens !== null && match.homePens !== '' && match.awayPens !== null && match.awayPens !== '') {
    if (Number(match.homePens) > Number(match.awayPens)) return 'home';
    if (Number(match.awayPens) > Number(match.homePens)) return 'away';
  }
  return null;
}

function isFinal(match) {
  const round = String(match.round || match.label || '').trim();
  return match.stage === 'knockout' && /final/i.test(round) && !/semi/i.test(round);
}

function registerResult(row, goalsFor, goalsAgainst, context) {
  row.pj += 1;
  row.gf += goalsFor;
  row.gc += goalsAgainst;
  row.pts += points(goalsFor, goalsAgainst);
  if (goalsAgainst === 0) row.cleanSheets += 1;

  const result = goalsFor > goalsAgainst ? 'G' : goalsFor < goalsAgainst ? 'P' : 'E';
  row.form.push(result);
  if (result === 'G') {
    row.pg += 1;
    row.winStreak += 1;
  } else {
    row.winStreak = 0;
    if (result === 'E') row.pe += 1;
    else row.pp += 1;
  }
  if (result !== 'P') row.unbeatenStreak += 1;
  else row.unbeatenStreak = 0;
  row.bestWinStreak = Math.max(row.bestWinStreak, row.winStreak);
  row.bestUnbeatenStreak = Math.max(row.bestUnbeatenStreak, row.unbeatenStreak);

  const margin = goalsFor - goalsAgainst;
  if (margin > 0 && (!row.biggestWin || margin > row.biggestWin.margin || (margin === row.biggestWin.margin && goalsFor > row.biggestWin.goalsFor))) {
    row.biggestWin = { margin, goalsFor, goalsAgainst, tournamentName: context.tournament.name };
  }
}

function registerTitles(rows, tournaments) {
  for (const tournament of tournaments) {
    if (tournament.participantChampion === 'participante_alvaro') {
      rows.home.titles += 1;
      continue;
    }
    if (tournament.participantChampion === 'participante_carlos') {
      rows.away.titles += 1;
      continue;
    }
    if (!tournament.champion) continue;
    const final = [...(tournament.matches || [])].reverse().find((match) => isFinal(match) && isPlayed(match));
    if (!final) continue;
    const winnerSide = finalWinnerSide(final);
    const winnerTeam = winnerSide === 'home' ? core.resolveHome(tournament, final) : winnerSide === 'away' ? core.resolveAway(tournament, final) : null;
    if (winnerTeam !== tournament.champion) continue;
    if (winnerSide) rows[winnerSide].titles += 1;
  }
}

function controllerRows(tournaments) {
  const rows = {
    home: emptyController('home', 'Álvaro', 'Local'),
    away: emptyController('away', 'Carlos', 'Visita')
  };

  for (const record of playedRecords(tournaments)) {
    const homeGoals = Number(record.match.homeGoals);
    const awayGoals = Number(record.match.awayGoals);
    registerResult(rows.home, homeGoals, awayGoals, record);
    registerResult(rows.away, awayGoals, homeGoals, record);

    if (isFinal(record.match)) {
      const winner = finalWinnerSide(record.match);
      if (winner) rows[winner].finalsWon += 1;
    }
  }
  registerTitles(rows, tournaments);

  return Object.values(rows).map((row) => ({
    ...row,
    dg: row.gf - row.gc,
    ppg: row.pj ? row.pts / row.pj : 0,
    winPct: row.pj ? row.pg / row.pj * 100 : 0,
    form: row.form.slice(-5)
  }));
}

function tournamentsForEra(era = filters.era) {
  return (state().tournaments || []).filter((tournament) => era === 'all' || tournamentEra(tournament) === era);
}

function selectedTournaments() {
  const candidates = tournamentsForEra();
  if (filters.tournament !== 'all' && !candidates.some((tournament) => tournament.id === filters.tournament)) filters.tournament = 'all';
  return filters.tournament === 'all' ? candidates : candidates.filter((tournament) => tournament.id === filters.tournament);
}

function formMarkup(form) {
  if (!form.length) return '<span class="cm-v57-no-form">Sin partidos</span>';
  return `<span class="cm-v57-form">${form.map((result) => `<i class="${result.toLowerCase()}">${result}</i>`).join('')}</span>`;
}

function controllerCard(row) {
  const biggest = row.biggestWin
    ? `${row.biggestWin.goalsFor}–${row.biggestWin.goalsAgainst} · ${esc(row.biggestWin.tournamentName)}`
    : 'Sin victorias';
  return `<article class="cm-v57-controller-card ${row.key}" data-cm-v57-controller="${row.key}">
    <header>
      <div><p class="eyebrow">${row.role.toUpperCase()}</p><h2>${row.name}</h2><span>${row.key === 'home' ? 'Controla siempre al equipo local' : 'Controla siempre al equipo visitante'}</span></div>
      <div class="cm-v57-points"><b>${row.pts}</b><span>puntos</span></div>
    </header>
    <div class="cm-v57-main-stats">
      <article><b>${row.pj}</b><span>Partidos</span></article>
      <article><b>${row.pg}</b><span>Victorias</span></article>
      <article><b>${row.pe}</b><span>Empates</span></article>
      <article><b>${row.pp}</b><span>Derrotas</span></article>
    </div>
    <dl>
      <div><dt>GF</dt><dd>${row.gf}</dd></div><div><dt>GC</dt><dd>${row.gc}</dd></div><div><dt>DG</dt><dd>${row.dg > 0 ? '+' : ''}${row.dg}</dd></div>
      <div><dt>Puntos/PJ</dt><dd>${format(row.ppg)}</dd></div><div><dt>% victorias</dt><dd>${row.winPct.toFixed(1)}%</dd></div><div><dt>Vallas invictas</dt><dd>${row.cleanSheets}</dd></div>
      <div><dt>Mejor racha ganadora</dt><dd>${row.bestWinStreak}</dd></div><div><dt>Mejor invicto</dt><dd>${row.bestUnbeatenStreak}</dd></div><div><dt>Finales ganadas</dt><dd>${row.finalsWon}</dd></div>
      <div><dt>Títulos registrados</dt><dd>${row.titles}</dd></div><div class="wide"><dt>Mayor victoria</dt><dd>${biggest}</dd></div><div class="wide"><dt>Forma reciente</dt><dd>${formMarkup(row.form)}</dd></div>
    </dl>
  </article>`;
}

function tournamentComparison(tournaments) {
  const rows = tournaments.map((tournament) => {
    const [home, away] = controllerRows([tournament]);
    const matches = home.pj;
    const leader = home.pts === away.pts ? 'Empate' : home.pts > away.pts ? 'Álvaro' : 'Carlos';
    return { tournament, home, away, matches, leader };
  }).filter((row) => row.matches > 0);

  if (!rows.length) return '<article class="cm-v57-empty"><h3>Sin partidos jugados</h3><p>No existen resultados para el filtro seleccionado.</p></article>';
  return `<article class="cm-v57-breakdown"><header><div><p class="eyebrow">DESGLOSE</p><h2>Comparación por torneo</h2></div><span>${rows.length} torneo${rows.length === 1 ? '' : 's'}</span></header>
    <div class="cm-v57-table-wrap"><table><thead><tr><th>Torneo</th><th>Era</th><th>PJ</th><th>Álvaro</th><th>Carlos</th><th>GF–GC local</th><th>GF–GC visita</th><th>Ventaja</th></tr></thead><tbody>
      ${rows.map(({ tournament, home, away, matches, leader }) => `<tr><td><strong>${esc(tournament.name)}</strong></td><td>${eraLabel(tournamentEra(tournament))}</td><td>${matches}</td><td>${home.pts} pts · ${home.pg}-${home.pe}-${home.pp}</td><td>${away.pts} pts · ${away.pg}-${away.pe}-${away.pp}</td><td>${home.gf}–${home.gc}</td><td>${away.gf}–${away.gc}</td><td><span class="cm-v57-leader ${leader === 'Álvaro' ? 'home' : leader === 'Carlos' ? 'away' : 'draw'}">${leader}</span></td></tr>`).join('')}
    </tbody></table></div></article>`;
}

function filterMarkup(candidates) {
  return `<section class="cm-v57-controller-filters">
    <div><p class="eyebrow">FILTROS DE CONTROLADORES</p><h2>Álvaro local · Carlos visita</h2><p>Todos los partidos se atribuyen por lado del tablero, sin importar el equipo utilizado.</p></div>
    <label>Era<select data-cm-v57-filter="era"><option value="all">Todas las eras</option><option value="league">Era de ligas</option><option value="division">Era de divisiones</option></select></label>
    <label>Torneo<select data-cm-v57-filter="tournament"><option value="all">Todos los torneos de la era</option>${candidates.map((tournament) => `<option value="${esc(tournament.id)}">${esc(tournament.name)}</option>`).join('')}</select></label>
    <button type="button" data-cm-v57-reset>Restablecer</button>
  </section>`;
}

function render() {
  const center = document.getElementById('cmStatsCenter');
  if (!center) return;
  const activeTab = center.dataset.activeTab || center.querySelector('[data-cm-stats-tab].active')?.dataset.cmStatsTab || 'summary';
  if (activeTab !== 'controllers') {
    center.classList.remove('cm-v57-controllers-active');
    lastSignature = '';
    return;
  }

  const content = center.querySelector('.cm-v52-stats-content');
  if (!content) return;
  center.classList.add('cm-v57-controllers-active');

  const candidates = tournamentsForEra();
  const selected = selectedTournaments();
  const matches = playedRecords(selected);
  const rows = controllerRows(selected);
  const leader = rows[0].pts === rows[1].pts ? 'Empate' : rows[0].pts > rows[1].pts ? 'Álvaro' : 'Carlos';
  const signature = JSON.stringify({
    filters,
    activeTab,
    tournaments: selected.map((tournament) => [tournament.id, tournament.name, tournament.era, tournament.type, tournament.participantChampion, tournament.champion]),
    matches: matches.map(({ tournament, match }) => [tournament.id, match.id, match.homeGoals, match.awayGoals, match.homePens, match.awayPens])
  });
  if (signature === lastSignature && content.querySelector('#cmV57Controllers')) return;
  lastSignature = signature;

  content.innerHTML = `<section id="cmV57Controllers" class="cm-v57-controllers">
    ${filterMarkup(candidates)}
    <section class="cm-v57-kpis">
      <article><span>Era</span><b>${eraLabel(filters.era)}</b><small>${selected.length} competencia${selected.length === 1 ? '' : 's'}</small></article>
      <article><span>Partidos</span><b>${matches.length}</b><small>Todos con Álvaro local y Carlos visita</small></article>
      <article><span>Ventaja en puntos</span><b>${leader}</b><small>${rows[0].pts}–${rows[1].pts} puntos</small></article>
      <article><span>Balance de goles</span><b>${rows[0].gf}–${rows[1].gf}</b><small>Local frente a visita</small></article>
    </section>
    <section class="cm-v57-controller-grid">${rows.map(controllerCard).join('')}</section>
    ${tournamentComparison(selected)}
  </section>`;

  const eraSelect = content.querySelector('[data-cm-v57-filter="era"]');
  const tournamentSelect = content.querySelector('[data-cm-v57-filter="tournament"]');
  if (eraSelect) eraSelect.value = filters.era;
  if (tournamentSelect) tournamentSelect.value = filters.tournament;
}

function refresh() {
  try { render(); }
  catch (error) { console.error('No se pudieron actualizar las estadísticas de controladores v5.7.', error); }
}

document.addEventListener('change', (event) => {
  const select = event.target.closest('[data-cm-v57-filter]');
  if (!select) return;
  const key = select.dataset.cmV57Filter;
  filters[key] = select.value;
  if (key === 'era') filters.tournament = 'all';
  lastSignature = '';
  refresh();
});

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-cm-v57-reset]')) {
    filters.era = 'all';
    filters.tournament = 'all';
    lastSignature = '';
    refresh();
    return;
  }
  if (event.target.closest('[data-cm-stats-tab]')) window.setTimeout(refresh, 80);
});

document.addEventListener('submit', () => window.setTimeout(() => { lastSignature = ''; refresh(); }, 350));

refresh();
window.setInterval(refresh, 700);
window.ChuteControllersV57 = { filters, tournamentEra, tournamentsForEra, selectedTournaments, playedRecords, controllerRows, refresh };
