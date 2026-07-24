const core = window.ChuteMundoCore;
const model = window.ChuteDetailModel;
if (!core || !model) throw new Error('Chute Mundo no está listo para Participantes y Administración v5.23.');

const VERSION = '5.23.0';
const HOME_DEFAULT = 'participante_alvaro';
const AWAY_DEFAULT = 'participante_carlos';
const esc = model.esc || ((value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])));
const clone = (value) => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const normalize = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const played = (match) => core.matchPlayed?.(match) ?? (match?.homeGoals !== null && match?.awayGoals !== null);
const state = () => core.getState?.() || { participants: [], teams: [], tournaments: [], config: {} };

let migrationRunning = false;
let adminTab = localStorage.getItem('cm_v523_admin_tab') || 'status';
let participantFilter = localStorage.getItem('cm_v523_participant_filter') || 'all';
let sideFilter = localStorage.getItem('cm_v523_side_filter') || 'all';
let divisionFilter = localStorage.getItem('cm_v523_division_filter') || 'all';
let refreshQueued = false;
let saving = false;

function participantById(id, source = state()) {
  return (source.participants || []).find((participant) => participant.id === id) || null;
}

function participantName(id, source = state()) {
  return participantById(id, source)?.name || id || 'Sin participante';
}

function participantColor(id, source = state()) {
  return participantById(id, source)?.color || '#64748b';
}

function activeParticipants(source = state()) {
  return (source.participants || []).filter((participant) => !participant.archived);
}

function competitionRules() {
  return {
    pointsWin: 3,
    pointsDraw: 1,
    pointsLoss: 0,
    tieBreakOrder: ['points', 'goalDifference', 'goalsFor', 'goalsAgainst', 'headToHead'],
    unresolvedTie: 'administrative_playoff',
    yellowLimit: 2,
    suspensionMatches: 1,
    directRedSuspension: 1,
    carrySuspensions: true
  };
}

function ensureParticipantDefaults() {
  if (migrationRunning) return false;
  const source = state();
  const next = clone(source);
  next.participants = Array.isArray(next.participants) ? next.participants : [];
  next.config = next.config && typeof next.config === 'object' ? next.config : {};
  let changed = false;

  const defaults = [
    { id: HOME_DEFAULT, name: 'Álvaro', color: '#e74c3c', defaultSide: 'home', archived: false },
    { id: AWAY_DEFAULT, name: 'Carlos', color: '#3498db', defaultSide: 'away', archived: false }
  ];
  for (const expected of defaults) {
    const current = next.participants.find((participant) => participant.id === expected.id);
    if (!current) {
      next.participants.push(expected);
      changed = true;
      continue;
    }
    for (const [key, value] of Object.entries(expected)) {
      if (current[key] === undefined || current[key] === null || current[key] === '') {
        current[key] = value;
        changed = true;
      }
    }
  }

  const participantConfig = {
    defaultHomeId: HOME_DEFAULT,
    defaultAwayId: AWAY_DEFAULT,
    schema: 'participants-v2'
  };
  if (JSON.stringify(next.config.participants || {}) !== JSON.stringify(participantConfig)) {
    next.config.participants = participantConfig;
    changed = true;
  }
  const officialRules = competitionRules();
  if (JSON.stringify(next.config.competitionRules || {}) !== JSON.stringify(officialRules)) {
    next.config.competitionRules = officialRules;
    changed = true;
  }

  for (const tournament of next.tournaments || []) {
    if (!tournament.participantLocal) {
      tournament.participantLocal = HOME_DEFAULT;
      changed = true;
    }
    if (!tournament.participantAway) {
      tournament.participantAway = AWAY_DEFAULT;
      changed = true;
    }
    tournament.config = tournament.config && typeof tournament.config === 'object' ? tournament.config : {};
    if (tournament.type === 'division_season') {
      const discipline = { yellowLimit: 2, doubleYellowIsRed: true, suspensionMatches: 1, directRedSuspension: 1, carryBetweenSeasons: true, ...(tournament.config.discipline || {}) };
      discipline.yellowLimit = 2;
      if (JSON.stringify(tournament.config.discipline || {}) !== JSON.stringify(discipline)) {
        tournament.config.discipline = discipline;
        changed = true;
      }
      if (JSON.stringify(tournament.config.tieBreakOrder || []) !== JSON.stringify(officialRules.tieBreakOrder)) {
        tournament.config.tieBreakOrder = [...officialRules.tieBreakOrder];
        changed = true;
      }
    }
    for (const match of tournament.matches || []) {
      if (!match.participantHome) {
        match.participantHome = tournament.participantLocal || HOME_DEFAULT;
        changed = true;
      }
      if (!match.participantAway) {
        match.participantAway = tournament.participantAway || AWAY_DEFAULT;
        changed = true;
      }
    }
  }

  if (!changed) return false;
  migrationRunning = true;
  try {
    core.setState(next);
    core.persistLocal?.();
    if (core.canEdit?.() && core.cloudLoaded) void core.saveCloud?.();
  } finally {
    migrationRunning = false;
  }
  return true;
}

function matchParticipants(tournament, match, source = state()) {
  return {
    home: match.participantHome || tournament.participantLocal || source.config?.participants?.defaultHomeId || HOME_DEFAULT,
    away: match.participantAway || tournament.participantAway || source.config?.participants?.defaultAwayId || AWAY_DEFAULT
  };
}

function matchWinnerSide(match) {
  const homeGoals = number(match.homeGoals);
  const awayGoals = number(match.awayGoals);
  if (homeGoals > awayGoals) return 'home';
  if (awayGoals > homeGoals) return 'away';
  if (number(match.homePens) > number(match.awayPens)) return 'home';
  if (number(match.awayPens) > number(match.homePens)) return 'away';
  return null;
}

function isFinal(match) {
  const label = normalize(`${match?.round || ''} ${match?.label || ''}`);
  return match?.stage === 'knockout' && label.includes('final') && !label.includes('semi');
}

function isThirdPlace(match) {
  return /3er|3\.er|tercer|3o|3º/i.test(`${match?.round || ''} ${match?.label || ''}`);
}

function tournamentEra(tournament) {
  return tournament?.type === 'division_season' || tournament?.eraId === 'divisions' || tournament?.era === 'division' ? 'divisions' : 'leagues';
}

function filteredTournamentsForParticipants(source = state()) {
  const era = document.querySelector('[data-cm-v521-filter="era"]')?.value || 'all';
  const tournamentId = document.querySelector('[data-cm-v521-filter="tournament"]')?.value || 'all';
  const format = document.querySelector('[data-cm-v521-filter="format"]')?.value || 'all';
  const status = document.querySelector('[data-cm-v521-filter="status"]')?.value || 'all';
  const teamId = document.querySelector('[data-cm-v521-filter="team"]')?.value || 'all';
  return (source.tournaments || []).filter((tournament) => {
    if (era !== 'all' && tournamentEra(tournament) !== era) return false;
    if (tournamentId !== 'all' && tournament.id !== tournamentId) return false;
    if (status !== 'all' && tournament.status !== status) return false;
    if (format !== 'all') {
      const group = tournament.type === 'division_season' ? 'divisions' : tournament.type === 'direct_knockout' ? 'knockout' : tournament.type === 'cup_groups' ? 'cups' : 'leagues';
      if (group !== format) return false;
    }
    if (teamId !== 'all' && !(tournament.teamIds || []).includes(teamId)) return false;
    return true;
  });
}

function emptyParticipantRow(participant) {
  return {
    id: participant.id,
    name: participant.name,
    color: participant.color || '#64748b',
    archived: Boolean(participant.archived),
    pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, points: 0,
    localPj: 0, localPg: 0, awayPj: 0, awayPg: 0,
    cleanSheets: 0, finals: 0, finalsWon: 0,
    titles: 0, runners: 0, thirds: 0,
    teams: new Set(), tournaments: new Set(),
    currentWin: 0, currentUnbeaten: 0, bestWin: 0, bestUnbeaten: 0,
    biggestWin: null
  };
}

function registerParticipantResult(row, side, teamId, goalsFor, goalsAgainst, tournament) {
  row.pj += 1;
  row.gf += goalsFor;
  row.gc += goalsAgainst;
  row.teams.add(teamId);
  row.tournaments.add(tournament.id);
  if (side === 'home') row.localPj += 1;
  else row.awayPj += 1;
  if (goalsAgainst === 0) row.cleanSheets += 1;
  if (goalsFor > goalsAgainst) {
    row.pg += 1;
    row.points += 3;
    row.currentWin += 1;
    row.currentUnbeaten += 1;
    if (side === 'home') row.localPg += 1;
    else row.awayPg += 1;
    const margin = goalsFor - goalsAgainst;
    if (!row.biggestWin || margin > row.biggestWin.margin || (margin === row.biggestWin.margin && goalsFor > row.biggestWin.gf)) {
      row.biggestWin = { margin, gf: goalsFor, gc: goalsAgainst, tournament: tournament.name };
    }
  } else if (goalsFor === goalsAgainst) {
    row.pe += 1;
    row.points += 1;
    row.currentWin = 0;
    row.currentUnbeaten += 1;
  } else {
    row.pp += 1;
    row.currentWin = 0;
    row.currentUnbeaten = 0;
  }
  row.bestWin = Math.max(row.bestWin, row.currentWin);
  row.bestUnbeaten = Math.max(row.bestUnbeaten, row.currentUnbeaten);
}

function participantStats(tournaments, source = state()) {
  const map = new Map((source.participants || []).map((participant) => [participant.id, emptyParticipantRow(participant)]));
  const ensure = (id) => {
    if (!map.has(id)) map.set(id, emptyParticipantRow({ id, name: participantName(id, source), color: participantColor(id, source), archived: true }));
    return map.get(id);
  };

  for (const tournament of tournaments) {
    const records = [];
    for (const match of tournament.matches || []) {
      if (match.stage === 'bye' || !played(match)) continue;
      if (divisionFilter !== 'all' && String(match.group || '') !== divisionFilter) continue;
      const homeTeam = match.home || core.resolveHome?.(tournament, match);
      const awayTeam = match.away || core.resolveAway?.(tournament, match);
      if (!homeTeam || !awayTeam) continue;
      const assigned = matchParticipants(tournament, match, source);
      const home = ensure(assigned.home);
      const away = ensure(assigned.away);
      const hg = number(match.homeGoals);
      const ag = number(match.awayGoals);
      registerParticipantResult(home, 'home', homeTeam, hg, ag, tournament);
      registerParticipantResult(away, 'away', awayTeam, ag, hg, tournament);
      records.push({ match, assigned, homeTeam, awayTeam });
      if (isFinal(match)) {
        home.finals += 1;
        away.finals += 1;
        const winner = matchWinnerSide(match);
        if (winner === 'home') home.finalsWon += 1;
        if (winner === 'away') away.finalsWon += 1;
      }
    }

    const final = [...records].reverse().find(({ match }) => isFinal(match));
    const third = [...records].reverse().find(({ match }) => isThirdPlace(match));
    const award = (explicitId, fallbackRecord, desiredTeam, type) => {
      let id = explicitId;
      if (!id && fallbackRecord) {
        if (fallbackRecord.homeTeam === desiredTeam) id = fallbackRecord.assigned.home;
        if (fallbackRecord.awayTeam === desiredTeam) id = fallbackRecord.assigned.away;
      }
      if (id) ensure(id)[type] += 1;
    };
    award(tournament.participantChampion, final, tournament.champion, 'titles');
    award(tournament.participantRunnerUp, final, tournament.runnerUp, 'runners');
    award(tournament.participantThird, third, tournament.third, 'thirds');
  }

  return [...map.values()].map((row) => ({
    ...row,
    dg: row.gf - row.gc,
    performance: row.pj ? ((row.pg * 3 + row.pe) / (row.pj * 3)) * 100 : 0,
    ppg: row.pj ? row.points / row.pj : 0,
    teams: [...row.teams],
    tournaments: [...row.tournaments]
  })).filter((row) => row.pj || !row.archived)
    .filter((row) => participantFilter === 'all' || row.id === participantFilter)
    .sort((a, b) => b.points - a.points || b.pg - a.pg || b.dg - a.dg || b.gf - a.gf || a.name.localeCompare(b.name, 'es'));
}

function participantOptions(selected, includeAll = true) {
  const source = state();
  return `${includeAll ? `<option value="all" ${selected === 'all' ? 'selected' : ''}>Todos los participantes</option>` : ''}${(source.participants || []).map((participant) => `<option value="${esc(participant.id)}" ${participant.id === selected ? 'selected' : ''}>${esc(participant.name)}${participant.archived ? ' · archivado' : ''}</option>`).join('')}`;
}

function participantAvatar(participant) {
  if (participant.avatarUrl) return `<img src="${esc(participant.avatarUrl)}" alt="" loading="lazy">`;
  return `<span style="--participant:${esc(participant.color || '#64748b')}">${esc(String(participant.name || '?').slice(0, 1).toUpperCase())}</span>`;
}

function participantsTable(rows, source = state()) {
  if (!rows.length) return '<div class="cm-v523-empty">No hay partidos para los filtros seleccionados.</div>';
  return `<div class="cm-v523-table"><table><thead><tr><th>#</th><th>Participante</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th><th>Rend.</th><th>Títulos</th><th>2.º</th><th>3.º</th><th>Equipos</th></tr></thead><tbody>${rows.map((row, index) => {
    const participant = participantById(row.id, source) || row;
    return `<tr><td><b>${index + 1}</b></td><td><div class="cm-v523-participant-cell">${participantAvatar(participant)}<div><b>${esc(row.name)}</b><small>${row.id === HOME_DEFAULT ? 'Local predeterminado' : row.id === AWAY_DEFAULT ? 'Visita predeterminada' : 'Participante adicional'}</small></div></div></td><td>${row.pj}</td><td>${row.pg}</td><td>${row.pe}</td><td>${row.pp}</td><td>${row.gf}</td><td>${row.gc}</td><td>${row.dg > 0 ? '+' : ''}${row.dg}</td><td><strong>${row.points}</strong></td><td>${Math.round(row.performance)}%</td><td>${row.titles}</td><td>${row.runners}</td><td>${row.thirds}</td><td>${row.teams.length}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function participantCards(rows, source = state()) {
  return `<div class="cm-v523-participant-cards">${rows.slice(0, 4).map((row, index) => {
    const participant = participantById(row.id, source) || row;
    const biggest = row.biggestWin ? `${row.biggestWin.gf}–${row.biggestWin.gc} · ${row.biggestWin.tournament}` : 'Sin victorias';
    return `<article class="${index === 0 ? 'is-leader' : ''}"><header>${participantAvatar(participant)}<div><span>${index === 0 ? 'LÍDER HISTÓRICO' : 'PARTICIPANTE'}</span><h3>${esc(row.name)}</h3></div><strong>${row.points}<small>pts</small></strong></header><dl><div><dt>Partidos</dt><dd>${row.pj}</dd></div><div><dt>Rendimiento</dt><dd>${Math.round(row.performance)}%</dd></div><div><dt>Títulos</dt><dd>${row.titles}</dd></div><div><dt>Finales ganadas</dt><dd>${row.finalsWon}</dd></div><div><dt>Mejor racha</dt><dd>${row.bestWin}</dd></div><div><dt>Mayor victoria</dt><dd>${esc(biggest)}</dd></div></dl></article>`;
  }).join('')}</div>`;
}

function participantStatsPanel() {
  const source = state();
  const tournaments = filteredTournamentsForParticipants(source);
  const rows = participantStats(tournaments, source).filter((row) => sideFilter === 'all' || sideFilter === 'home' && row.localPj || sideFilter === 'away' && row.awayPj);
  const divisions = [...new Set(tournaments.flatMap((tournament) => (tournament.matches || []).map((match) => match.group).filter(Boolean)))];
  return `<section class="cm-v523-stats-panel" data-cm-v523-panel="participants"><div class="cm-v523-panel-intro"><div><span>CONTROLADORES</span><h2>La Liga de los Participantes</h2><p>Álvaro controla al equipo local y Carlos al visitante por defecto. Las nuevas personas se atribuyen partido a partido.</p></div><strong>${rows.reduce((sum, row) => sum + row.pj, 0) / 2}<small>partidos analizados</small></strong></div><section class="cm-v523-local-filters"><label>Participante<select data-cm-v523-filter="participant">${participantOptions(participantFilter)}</select></label><label>Lado<select data-cm-v523-filter="side"><option value="all" ${sideFilter === 'all' ? 'selected' : ''}>Local y visita</option><option value="home" ${sideFilter === 'home' ? 'selected' : ''}>Como local</option><option value="away" ${sideFilter === 'away' ? 'selected' : ''}>Como visita</option></select></label><label>División<select data-cm-v523-filter="division"><option value="all">Todas las divisiones</option>${divisions.map((division) => `<option value="${esc(division)}" ${divisionFilter === division ? 'selected' : ''}>${esc(division)}</option>`).join('')}</select></label><button type="button" data-cm-v523-reset-stats>Restablecer</button></section>${participantCards(rows, source)}<article class="cm-v523-card"><header><div><span>CLASIFICACIÓN ACUMULADA</span><h2>Ranking de participantes</h2></div><b>${rows.length}</b></header>${participantsTable(rows, source)}</article></section>`;
}

function decorateStatistics() {
  const host = document.getElementById('cmV521History');
  if (!host) return;
  const tabs = host.querySelector('.cm-v521-tabs');
  const content = host.querySelector('.cm-v521-content');
  if (!tabs || !content) return;
  let button = tabs.querySelector('[data-cm-v523-tab="participants"]');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.dataset.cmV523Tab = 'participants';
    button.innerHTML = '<b>Participantes</b><small>Controladores y rendimiento</small>';
    tabs.appendChild(button);
  }
  let panel = content.querySelector('[data-cm-v523-panel="participants"]');
  if (!panel) {
    panel = document.createElement('section');
    panel.dataset.cmV523Panel = 'participants';
    panel.hidden = true;
    content.appendChild(panel);
  }
  const signature = JSON.stringify({ participants: state().participants, tournaments: filteredTournamentsForParticipants().map((tournament) => [tournament.id, tournament.participantChampion, tournament.participantRunnerUp, tournament.participantThird, (tournament.matches || []).map((match) => [match.id, match.homeGoals, match.awayGoals, match.homePens, match.awayPens, match.participantHome, match.participantAway, match.group])]), participantFilter, sideFilter, divisionFilter });
  if (panel.dataset.signature !== signature) {
    const markup = participantStatsPanel();
    panel.outerHTML = markup;
    panel = content.querySelector('[data-cm-v523-panel="participants"]');
    panel.dataset.signature = signature;
  }
  if (localStorage.getItem('cm_v523_stats_tab') === 'participants') activateParticipantStatsTab();
}

function activateParticipantStatsTab() {
  const host = document.getElementById('cmV521History');
  if (!host) return;
  host.querySelectorAll('[data-cm-v521-tab]').forEach((button) => { button.classList.remove('active'); button.setAttribute('aria-selected', 'false'); });
  host.querySelectorAll('[data-cm-v521-panel]').forEach((panel) => { panel.classList.remove('active'); panel.hidden = true; });
  const button = host.querySelector('[data-cm-v523-tab="participants"]');
  const panel = host.querySelector('[data-cm-v523-panel="participants"]');
  button?.classList.add('active');
  button?.setAttribute('aria-selected', 'true');
  if (panel) { panel.hidden = false; panel.classList.add('active'); }
  localStorage.setItem('cm_v523_stats_tab', 'participants');
}

function readiness(source = state()) {
  const activeTeams = (source.teams || []).filter((team) => !team.archived);
  const activePeople = activeParticipants(source);
  const ranking = window.ChuteDivisionsV54?.fifaOrder?.() || activeTeams.map((team) => team.id).slice(0, 6);
  const duplicateTeams = new Set(activeTeams.map((team) => normalize(team.name))).size !== activeTeams.length;
  const checks = [
    { label: 'Seis equipos activos', ok: activeTeams.length === 6, detail: `${activeTeams.length} equipos disponibles`, critical: true },
    { label: 'Composición por Ranking FIFA', ok: ranking.length === 6, detail: ranking.length === 6 ? 'Primera y Segunda pueden formarse' : 'Ranking incompleto', critical: true },
    { label: 'Álvaro como local', ok: Boolean(participantById(HOME_DEFAULT, source)), detail: 'Participante predeterminado', critical: true },
    { label: 'Carlos como visita', ok: Boolean(participantById(AWAY_DEFAULT, source)), detail: 'Participante predeterminado', critical: true },
    { label: 'Participantes adicionales', ok: activePeople.length >= 2, detail: `${activePeople.length} activos`, critical: false },
    { label: 'Disciplina oficial', ok: source.config?.competitionRules?.yellowLimit === 2, detail: 'Suspensión al acumular 2 amarillas', critical: true },
    { label: 'Desempate oficial', ok: source.config?.competitionRules?.tieBreakOrder?.at(-1) === 'headToHead', detail: 'Resultado entre ambos como quinto criterio', critical: true },
    { label: 'Equipos sin duplicados', ok: !duplicateTeams, detail: duplicateTeams ? 'Revisar nombres repetidos' : 'Sin duplicados', critical: true },
    { label: 'Firebase', ok: Boolean(core.cloudLoaded), detail: core.cloudLoaded ? 'Base compartida conectada' : 'Conexión todavía cargando', critical: false }
  ];
  return { checks, ready: checks.filter((check) => check.critical).every((check) => check.ok) };
}

function rulesMarkup() {
  return `<div class="cm-v523-rules"><section><span>01</span><div><h3>Tabla de posiciones</h3><p>Victoria: 3 puntos. Empate: 1 punto. Derrota: 0 puntos.</p><ol><li>Puntos.</li><li>Diferencia de gol.</li><li>Goles a favor.</li><li>Menos goles recibidos.</li><li>Resultado entre ambos equipos.</li></ol><small>Si la igualdad continúa, queda como desempate pendiente para partido adicional o resolución administrativa.</small></div></section><section><span>02</span><div><h3>Primera y Segunda División</h3><p>La temporada inaugural distribuye a los seis clubes según el Ranking FIFA: los tres primeros integran Primera y los tres siguientes Segunda.</p><p>La composición puede revisarse antes de confirmar la temporada.</p></div></section><section><span>03</span><div><h3>Clasificación y Play-Off</h3><p>El 1.º y 2.º de cada división clasifican a su Play-Off cuando este se encuentra habilitado. La final puede jugarse a partido único o ida y vuelta.</p></div></section><section><span>04</span><div><h3>Ascenso y descenso</h3><p>El 3.º de Primera desciende directamente. El ascenso corresponde al ganador del Play-Off de Segunda o al líder regular, según la configuración elegida.</p><p>La siguiente temporada se compone automáticamente con el movimiento de ambos clubes.</p></div></section><section><span>05</span><div><h3>Disciplina</h3><p>Dos amarillas acumuladas en partidos distintos generan una fecha de suspensión. Dos amarillas en el mismo partido equivalen a expulsión y suspensión. La roja directa genera al menos una fecha.</p><p>Las sanciones pendientes se arrastran a la siguiente temporada divisional.</p></div></section><section><span>06</span><div><h3>Participantes</h3><p>Álvaro controla al equipo local y Carlos al visitante por defecto. Si juega una tercera persona, se selecciona en el partido correspondiente y sus estadísticas se registran sin modificar el historial anterior.</p></div></section></div>`;
}

function participantAdminList(source = state()) {
  return `<div class="cm-v523-admin-people">${(source.participants || []).map((participant) => `<article data-cm-v523-person="${esc(participant.id)}" class="${participant.archived ? 'is-archived' : ''}">${participantAvatar(participant)}<div><b>${esc(participant.name)}</b><small>${participant.id === HOME_DEFAULT ? 'Local predeterminado' : participant.id === AWAY_DEFAULT ? 'Visita predeterminada' : participant.archived ? 'Archivado' : 'Participante adicional'}</small></div>${core.canEdit?.() ? `<label>Color<input type="color" value="${esc(participant.color || '#64748b')}" data-cm-v523-person-color="${esc(participant.id)}"></label><button type="button" data-cm-v523-save-person="${esc(participant.id)}">Guardar</button>${![HOME_DEFAULT, AWAY_DEFAULT].includes(participant.id) ? `<button type="button" class="secondary" data-cm-v523-archive-person="${esc(participant.id)}">${participant.archived ? 'Reactivar' : 'Archivar'}</button>` : ''}` : ''}</article>`).join('')}</div>`;
}

function statusMarkup(source = state()) {
  const result = readiness(source);
  return `<section class="cm-v523-readiness ${result.ready ? 'is-ready' : 'is-pending'}"><div><span>${result.ready ? 'SISTEMA PREPARADO' : 'REVISIÓN NECESARIA'}</span><h2>${result.ready ? 'Listo para comenzar las divisiones' : 'Faltan elementos antes de comenzar'}</h2><p>${result.ready ? 'La composición, reglas, participantes, disciplina y ascenso/descenso están configurados.' : 'Revisa los indicadores críticos antes de crear la primera temporada.'}</p></div><strong>${result.checks.filter((check) => check.ok).length}/${result.checks.length}</strong></section><div class="cm-v523-checks">${result.checks.map((check) => `<article class="${check.ok ? 'ok' : check.critical ? 'error' : 'warning'}"><i>${check.ok ? '✓' : check.critical ? '!' : '·'}</i><div><b>${esc(check.label)}</b><span>${esc(check.detail)}</span></div></article>`).join('')}</div>`;
}

function adminHost() {
  const page = document.getElementById('administracion');
  if (!page) return null;
  const title = page.querySelector('.page-title');
  let host = document.getElementById('cmV523Admin');
  if (host) return host;
  host = document.createElement('div');
  host.id = 'cmV523Admin';
  title?.insertAdjacentElement('afterend', host);
  const legacyColumns = [...page.children].find((child) => child.classList?.contains('two-columns'));
  const danger = [...page.children].find((child) => child.classList?.contains('danger'));
  host.innerHTML = `<nav class="cm-v523-admin-tabs"><button data-cm-v523-admin-tab="status">Estado</button><button data-cm-v523-admin-tab="participants">Participantes</button><button data-cm-v523-admin-tab="rules">Reglamento</button><button data-cm-v523-admin-tab="data">Datos y respaldos</button><button data-cm-v523-admin-tab="maintenance">Mantenimiento</button></nav><div class="cm-v523-admin-panels"><section data-cm-v523-admin-panel="status"></section><section data-cm-v523-admin-panel="participants"></section><section data-cm-v523-admin-panel="rules"></section><section data-cm-v523-admin-panel="data"></section><section data-cm-v523-admin-panel="maintenance"></section></div>`;
  const dataPanel = host.querySelector('[data-cm-v523-admin-panel="data"]');
  if (legacyColumns) dataPanel.appendChild(legacyColumns);
  const maintenance = host.querySelector('[data-cm-v523-admin-panel="maintenance"]');
  maintenance.insertAdjacentHTML('beforeend', '<article class="cm-v523-maintenance"><span>MANTENIMIENTO</span><h2>Herramientas técnicas</h2><p>Las operaciones destructivas permanecen separadas y cerradas por defecto.</p><div class="cm-v523-maintenance-actions"><button type="button" data-cm-v523-refresh>Revisar sistema</button><button type="button" data-cm-v523-normalize>Normalizar participantes y reglas</button></div></article>');
  if (danger) {
    const details = document.createElement('details');
    details.className = 'cm-v523-risk';
    details.innerHTML = '<summary>Zona de riesgo</summary>';
    details.appendChild(danger);
    maintenance.appendChild(details);
  }
  return host;
}

function activateAdminTab(tab) {
  adminTab = ['status', 'participants', 'rules', 'data', 'maintenance'].includes(tab) ? tab : 'status';
  localStorage.setItem('cm_v523_admin_tab', adminTab);
  const host = document.getElementById('cmV523Admin');
  host?.querySelectorAll('[data-cm-v523-admin-tab]').forEach((button) => button.classList.toggle('active', button.dataset.cmV523AdminTab === adminTab));
  host?.querySelectorAll('[data-cm-v523-admin-panel]').forEach((panel) => { panel.hidden = panel.dataset.cmV523AdminPanel !== adminTab; });
}

function renderAdmin() {
  const host = adminHost();
  if (!host) return;
  const source = state();
  const status = host.querySelector('[data-cm-v523-admin-panel="status"]');
  status.innerHTML = `<div class="cm-v523-admin-heading"><span>CENTRO DE CONTROL</span><h2>Estado del sistema</h2><p>Preparación operativa, reglas y conexión de ChuteMundo.</p></div>${statusMarkup(source)}`;
  const participants = host.querySelector('[data-cm-v523-admin-panel="participants"]');
  participants.innerHTML = `<div class="cm-v523-admin-heading"><span>GESTIÓN DEPORTIVA</span><h2>Participantes</h2><p>Álvaro y Carlos permanecen como valores predeterminados. Agrega otras personas solo cuando sea necesario.</p></div>${core.canEdit?.() ? `<form id="cmV523ParticipantForm" class="cm-v523-person-form"><label>Nombre<input id="cmV523ParticipantName" required maxlength="50" placeholder="Nombre del participante"></label><label>Color<input id="cmV523ParticipantColor" type="color" value="#16a085"></label><label>Avatar opcional<input id="cmV523ParticipantAvatar" type="url" placeholder="https://..."></label><button type="submit">Agregar participante</button></form>` : '<p class="cm-v523-readonly">Inicia sesión como administrador para agregar o editar participantes.</p>'}${participantAdminList(source)}`;
  const rules = host.querySelector('[data-cm-v523-admin-panel="rules"]');
  rules.innerHTML = `<div class="cm-v523-admin-heading"><span>REGLAMENTO OFICIAL</span><h2>Cómo funciona ChuteMundo</h2><p>Puntuación, clasificación, Play-Off, ascenso, descenso, disciplina y participantes.</p></div>${rulesMarkup()}`;
  activateAdminTab(adminTab);
}

function decorateMatchParticipantSelectors() {
  const live = document.querySelector('[data-cm-v59-live-pair]');
  if (!live) return;
  const pair = live.dataset.cmV59LivePair || '';
  const [tournamentId, matchId] = pair.split('__');
  const source = state();
  const tournament = (source.tournaments || []).find((item) => item.id === tournamentId);
  const match = tournament?.matches?.find((item) => item.id === matchId);
  if (!tournament || !match) return;
  const assigned = matchParticipants(tournament, match, source);
  let section = live.querySelector('.cm-v523-match-participants');
  if (!section) {
    section = document.createElement('section');
    section.className = 'cm-v523-match-participants';
    live.querySelector('.cm-v59-live-heading')?.insertAdjacentElement('afterend', section);
  }
  const signature = JSON.stringify({ pair, assigned, participants: source.participants });
  if (section.dataset.signature === signature) return;
  section.dataset.signature = signature;
  const options = (selected) => (source.participants || []).filter((participant) => !participant.archived || participant.id === selected).map((participant) => `<option value="${esc(participant.id)}" ${participant.id === selected ? 'selected' : ''}>${esc(participant.name)}${participant.archived ? ' · archivado' : ''}</option>`).join('');
  section.innerHTML = `<header><div><span>PARTICIPANTES</span><b>Quién controla cada lado</b></div><small>Predeterminado: Álvaro local · Carlos visita</small></header><div><label>Equipo local<select data-cm-v523-match-person="home" data-pair="${esc(pair)}" ${core.canEdit?.() ? '' : 'disabled'}>${options(assigned.home)}</select></label><label>Equipo visitante<select data-cm-v523-match-person="away" data-pair="${esc(pair)}" ${core.canEdit?.() ? '' : 'disabled'}>${options(assigned.away)}</select></label></div>`;
}

async function persistMatchParticipant(pair, side, participantId) {
  if (saving || !core.canEdit?.()) return;
  const [tournamentId, matchId] = pair.split('__');
  const previous = clone(state());
  const next = clone(previous);
  const tournament = (next.tournaments || []).find((item) => item.id === tournamentId);
  const match = tournament?.matches?.find((item) => item.id === matchId);
  if (!match) return;
  const other = side === 'home' ? match.participantAway || tournament.participantAway || AWAY_DEFAULT : match.participantHome || tournament.participantLocal || HOME_DEFAULT;
  if (participantId === other) {
    core.showToast?.('Una misma persona no puede controlar ambos equipos en este partido.');
    scheduleRefresh();
    return;
  }
  match[side === 'home' ? 'participantHome' : 'participantAway'] = participantId;
  match.updatedAt = Date.now();
  saving = true;
  try {
    core.setState(next);
    core.persistLocal?.();
    await core.saveCloud?.();
    core.showToast?.(`${participantName(participantId, next)} quedó asignado al lado ${side === 'home' ? 'local' : 'visitante'}.`);
  } catch (error) {
    console.error(error);
    core.setState(previous);
    core.showToast?.(`No se pudo guardar el participante: ${error.code || error.message || 'error desconocido'}.`);
  } finally {
    saving = false;
    scheduleRefresh();
  }
}

async function addParticipant(form) {
  if (!core.canEdit?.()) return;
  const name = document.getElementById('cmV523ParticipantName')?.value.trim() || '';
  const color = document.getElementById('cmV523ParticipantColor')?.value || '#16a085';
  const avatarUrl = document.getElementById('cmV523ParticipantAvatar')?.value.trim() || '';
  if (!name) return core.showToast?.('Escribe el nombre del participante.');
  const previous = clone(state());
  const next = clone(previous);
  if ((next.participants || []).some((participant) => normalize(participant.name) === normalize(name))) return core.showToast?.('Ya existe un participante con ese nombre.');
  next.participants.push({ id: core.uid?.('participante') || `participante_${Date.now()}`, name, color, avatarUrl, archived: false, createdAt: Date.now() });
  core.setState(next);
  core.persistLocal?.();
  try { await core.saveCloud?.(); core.showToast?.(`${name} fue agregado como participante.`); }
  catch (error) { console.error(error); core.setState(previous); return core.showToast?.('Firebase rechazó el nuevo participante.'); }
  form.reset();
  document.getElementById('cmV523ParticipantColor').value = '#16a085';
  scheduleRefresh();
}

async function updateParticipant(id, { archive = false } = {}) {
  if (!core.canEdit?.()) return;
  const previous = clone(state());
  const next = clone(previous);
  const participant = (next.participants || []).find((item) => item.id === id);
  if (!participant) return;
  if (archive) participant.archived = !participant.archived;
  else {
    const color = document.querySelector(`[data-cm-v523-person-color="${CSS.escape(id)}"]`)?.value;
    if (color) participant.color = color;
  }
  core.setState(next);
  core.persistLocal?.();
  try { await core.saveCloud?.(); core.showToast?.(archive ? `${participant.name} ${participant.archived ? 'fue archivado' : 'fue reactivado'}.` : `Color de ${participant.name} actualizado.`); }
  catch (error) { console.error(error); core.setState(previous); core.showToast?.('No se pudo guardar el cambio.'); }
  scheduleRefresh();
}

function scheduleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => {
    refreshQueued = false;
    ensureParticipantDefaults();
    renderAdmin();
    decorateStatistics();
    decorateMatchParticipantSelectors();
  });
}

document.addEventListener('click', (event) => {
  const adminButton = event.target.closest('[data-cm-v523-admin-tab]');
  if (adminButton) { activateAdminTab(adminButton.dataset.cmV523AdminTab); return; }
  if (event.target.closest('[data-cm-v523-tab="participants"]')) { activateParticipantStatsTab(); return; }
  if (event.target.closest('[data-cm-v521-tab]')) localStorage.removeItem('cm_v523_stats_tab');
  const save = event.target.closest('[data-cm-v523-save-person]');
  if (save) { void updateParticipant(save.dataset.cmV523SavePerson); return; }
  const archive = event.target.closest('[data-cm-v523-archive-person]');
  if (archive) { void updateParticipant(archive.dataset.cmV523ArchivePerson, { archive: true }); return; }
  if (event.target.closest('[data-cm-v523-refresh]')) { scheduleRefresh(); core.showToast?.('Revisión del sistema actualizada.'); return; }
  if (event.target.closest('[data-cm-v523-normalize]')) { ensureParticipantDefaults(); scheduleRefresh(); core.showToast?.('Participantes y reglas normalizados.'); return; }
  if (event.target.closest('[data-cm-v523-reset-stats]')) {
    participantFilter = 'all'; sideFilter = 'all'; divisionFilter = 'all';
    localStorage.removeItem('cm_v523_participant_filter'); localStorage.removeItem('cm_v523_side_filter'); localStorage.removeItem('cm_v523_division_filter');
    decorateStatistics(); activateParticipantStatsTab();
  }
}, true);

document.addEventListener('change', (event) => {
  const matchPerson = event.target.closest('[data-cm-v523-match-person]');
  if (matchPerson) { void persistMatchParticipant(matchPerson.dataset.pair, matchPerson.dataset.cmV523MatchPerson, matchPerson.value); return; }
  const filter = event.target.closest('[data-cm-v523-filter]');
  if (filter) {
    if (filter.dataset.cmV523Filter === 'participant') { participantFilter = filter.value; localStorage.setItem('cm_v523_participant_filter', participantFilter); }
    if (filter.dataset.cmV523Filter === 'side') { sideFilter = filter.value; localStorage.setItem('cm_v523_side_filter', sideFilter); }
    if (filter.dataset.cmV523Filter === 'division') { divisionFilter = filter.value; localStorage.setItem('cm_v523_division_filter', divisionFilter); }
    decorateStatistics(); activateParticipantStatsTab();
  }
  if (event.target.closest('[data-cm-v521-filter]')) setTimeout(scheduleRefresh, 0);
}, true);

document.addEventListener('submit', (event) => {
  if (event.target.id === 'cmV523ParticipantForm') { event.preventDefault(); void addParticipant(event.target); }
}, true);

document.addEventListener('chute:state', scheduleRefresh);
document.addEventListener('chute:ready', scheduleRefresh);
document.addEventListener('chute:boot-complete', scheduleRefresh);
new MutationObserver(scheduleRefresh).observe(document.body, { childList: true, subtree: true });

const style = document.createElement('link');
style.rel = 'stylesheet';
style.href = `/chute-v523-participants-admin.css?v=${VERSION}`;
style.id = 'cmV523ParticipantsAdminStyles';
if (!document.getElementById(style.id)) document.head.appendChild(style);

ensureParticipantDefaults();
scheduleRefresh();

window.ChuteV523ParticipantsAdmin = Object.freeze({ VERSION, HOME_DEFAULT, AWAY_DEFAULT, ensureParticipantDefaults, participantStats, readiness, scheduleRefresh });
