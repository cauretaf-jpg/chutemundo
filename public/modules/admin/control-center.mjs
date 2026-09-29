const core = window.ChuteMundoCore;
const model = window.ChuteDetailModel;
if (!core || !model) throw new Error('Chute Mundo no está listo para el Centro de Control v5.23.');

const VERSION = '5.23.0';
const HOME_DEFAULT = 'participante_alvaro';
const AWAY_DEFAULT = 'participante_carlos';
const esc = model.esc || ((value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])));
const clone = (value) => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const norm = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const played = (match) => core.matchPlayed?.(match) ?? (match?.homeGoals !== null && match?.awayGoals !== null);
const state = () => core.getState?.() || { config: {}, participants: [], teams: [], tournaments: [] };

let adminTab = localStorage.getItem('cm_v523_admin_tab') || 'status';
let participantFilter = localStorage.getItem('cm_v523_participant_filter') || 'all';
let sideFilter = localStorage.getItem('cm_v523_side_filter') || 'all';
let divisionFilter = localStorage.getItem('cm_v523_division_filter') || 'all';
let migrationRunning = false;
let refreshQueued = false;
let saving = false;

function participant(id, source = state()) { return (source.participants || []).find((item) => item.id === id) || null; }
function participantName(id, source = state()) { return participant(id, source)?.name || id || 'Sin participante'; }
function participantColor(id, source = state()) { return participant(id, source)?.color || '#64748b'; }
function activeParticipants(source = state()) { return (source.participants || []).filter((item) => !item.archived); }
function rules() { return { pointsWin: 3, pointsDraw: 1, pointsLoss: 0, tieBreakOrder: ['points', 'goalDifference', 'goalsFor', 'goalsAgainst', 'headToHead'], unresolvedTie: 'administrative_playoff', yellowLimit: 2, suspensionMatches: 1, directRedSuspension: 1, carrySuspensions: true }; }

function ensureDefaults() {
  if (migrationRunning) return false;
  const current = state(); const next = clone(current); let changed = false;
  next.participants = Array.isArray(next.participants) ? next.participants : [];
  next.config = next.config && typeof next.config === 'object' ? next.config : {};
  for (const expected of [{ id: HOME_DEFAULT, name: 'Álvaro', color: '#e74c3c', defaultSide: 'home', archived: false }, { id: AWAY_DEFAULT, name: 'Carlos', color: '#3498db', defaultSide: 'away', archived: false }]) {
    let person = next.participants.find((item) => item.id === expected.id);
    if (!person) { next.participants.push(expected); changed = true; continue; }
    for (const [key, value] of Object.entries(expected)) if (person[key] === undefined || person[key] === null || person[key] === '') { person[key] = value; changed = true; }
  }
  const participantConfig = { defaultHomeId: HOME_DEFAULT, defaultAwayId: AWAY_DEFAULT, schema: 'participants-v2' };
  if (JSON.stringify(next.config.participants || {}) !== JSON.stringify(participantConfig)) { next.config.participants = participantConfig; changed = true; }
  if (JSON.stringify(next.config.competitionRules || {}) !== JSON.stringify(rules())) { next.config.competitionRules = rules(); changed = true; }
  for (const tournament of next.tournaments || []) {
    if (!tournament.participantLocal) { tournament.participantLocal = HOME_DEFAULT; changed = true; }
    if (!tournament.participantAway) { tournament.participantAway = AWAY_DEFAULT; changed = true; }
    tournament.config = tournament.config && typeof tournament.config === 'object' ? tournament.config : {};
    if (tournament.type === 'division_season') {
      const discipline = { yellowLimit: 2, doubleYellowIsRed: true, suspensionMatches: 1, directRedSuspension: 1, carryBetweenSeasons: true, ...(tournament.config.discipline || {}) };
      discipline.yellowLimit = 2;
      if (JSON.stringify(tournament.config.discipline || {}) !== JSON.stringify(discipline)) { tournament.config.discipline = discipline; changed = true; }
      if (JSON.stringify(tournament.config.tieBreakOrder || []) !== JSON.stringify(rules().tieBreakOrder)) { tournament.config.tieBreakOrder = [...rules().tieBreakOrder]; changed = true; }
    }
    for (const match of tournament.matches || []) {
      if (!match.participantHome) { match.participantHome = tournament.participantLocal || HOME_DEFAULT; changed = true; }
      if (!match.participantAway) { match.participantAway = tournament.participantAway || AWAY_DEFAULT; changed = true; }
    }
  }
  if (!changed) return false;
  migrationRunning = true;
  try { core.setState(next); core.persistLocal?.(); if (core.canEdit?.() && core.cloudLoaded) void core.saveCloud?.(); }
  finally { migrationRunning = false; }
  return true;
}

function assignedParticipants(tournament, match, source = state()) {
  return { home: match.participantHome || tournament.participantLocal || source.config?.participants?.defaultHomeId || HOME_DEFAULT, away: match.participantAway || tournament.participantAway || source.config?.participants?.defaultAwayId || AWAY_DEFAULT };
}
function winnerSide(match) { const hg = num(match.homeGoals); const ag = num(match.awayGoals); if (hg > ag) return 'home'; if (ag > hg) return 'away'; if (num(match.homePens) > num(match.awayPens)) return 'home'; if (num(match.awayPens) > num(match.homePens)) return 'away'; return null; }
function isFinal(match) { const label = norm(`${match?.round || ''} ${match?.label || ''}`); return match?.stage === 'knockout' && label.includes('final') && !label.includes('semi'); }
function isThird(match) { return /3er|3\.er|tercer|3o|3º/i.test(`${match?.round || ''} ${match?.label || ''}`); }
function eraOf(tournament) { return tournament?.type === 'division_season' || tournament?.eraId === 'divisions' || tournament?.era === 'division' ? 'divisions' : 'leagues'; }

function filteredTournaments(source = state()) {
  const era = document.querySelector('[data-cm-v521-filter="era"]')?.value || 'all';
  const tournamentId = document.querySelector('[data-cm-v521-filter="tournament"]')?.value || 'all';
  const format = document.querySelector('[data-cm-v521-filter="format"]')?.value || 'all';
  const status = document.querySelector('[data-cm-v521-filter="status"]')?.value || 'all';
  const teamId = document.querySelector('[data-cm-v521-filter="team"]')?.value || 'all';
  return (source.tournaments || []).filter((tournament) => {
    if (era !== 'all' && eraOf(tournament) !== era) return false;
    if (tournamentId !== 'all' && tournament.id !== tournamentId) return false;
    if (status !== 'all' && tournament.status !== status) return false;
    if (format !== 'all') {
      const group = tournament.type === 'division_season' ? 'divisions' : tournament.type === 'direct_knockout' ? 'knockout' : tournament.type === 'cup_groups' ? 'cups' : 'leagues';
      if (group !== format) return false;
    }
    return teamId === 'all' || (tournament.teamIds || []).includes(teamId);
  });
}

function emptyRow(person) { return { id: person.id, name: person.name, color: person.color || '#64748b', avatarUrl: person.avatarUrl || '', archived: Boolean(person.archived), pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, points: 0, localPj: 0, localPg: 0, awayPj: 0, awayPg: 0, cleanSheets: 0, finals: 0, finalsWon: 0, titles: 0, runners: 0, thirds: 0, teams: new Set(), tournaments: new Set(), currentWin: 0, currentUnbeaten: 0, bestWin: 0, bestUnbeaten: 0, biggestWin: null }; }
function applyResult(row, side, teamId, gf, gc, tournament) {
  row.pj += 1; row.gf += gf; row.gc += gc; row.teams.add(teamId); row.tournaments.add(tournament.id);
  if (side === 'home') row.localPj += 1; else row.awayPj += 1;
  if (gc === 0) row.cleanSheets += 1;
  if (gf > gc) { row.pg += 1; row.points += 3; row.currentWin += 1; row.currentUnbeaten += 1; if (side === 'home') row.localPg += 1; else row.awayPg += 1; const margin = gf - gc; if (!row.biggestWin || margin > row.biggestWin.margin || margin === row.biggestWin.margin && gf > row.biggestWin.gf) row.biggestWin = { margin, gf, gc, tournament: tournament.name }; }
  else if (gf === gc) { row.pe += 1; row.points += 1; row.currentWin = 0; row.currentUnbeaten += 1; }
  else { row.pp += 1; row.currentWin = 0; row.currentUnbeaten = 0; }
  row.bestWin = Math.max(row.bestWin, row.currentWin); row.bestUnbeaten = Math.max(row.bestUnbeaten, row.currentUnbeaten);
}

function participantStats(tournaments, source = state()) {
  const map = new Map((source.participants || []).map((person) => [person.id, emptyRow(person)]));
  const get = (id) => { if (!map.has(id)) map.set(id, emptyRow({ id, name: participantName(id, source), color: participantColor(id, source), archived: true })); return map.get(id); };
  for (const tournament of tournaments) {
    const records = [];
    for (const match of tournament.matches || []) {
      if (match.stage === 'bye' || !played(match) || divisionFilter !== 'all' && String(match.group || '') !== divisionFilter) continue;
      const homeTeam = match.home || core.resolveHome?.(tournament, match); const awayTeam = match.away || core.resolveAway?.(tournament, match);
      if (!homeTeam || !awayTeam) continue;
      const assigned = assignedParticipants(tournament, match, source); const home = get(assigned.home); const away = get(assigned.away); const hg = num(match.homeGoals); const ag = num(match.awayGoals);
      applyResult(home, 'home', homeTeam, hg, ag, tournament); applyResult(away, 'away', awayTeam, ag, hg, tournament); records.push({ match, assigned, homeTeam, awayTeam });
      if (isFinal(match)) { home.finals += 1; away.finals += 1; const winner = winnerSide(match); if (winner === 'home') home.finalsWon += 1; if (winner === 'away') away.finalsWon += 1; }
    }
    const final = [...records].reverse().find(({ match }) => isFinal(match)); const third = [...records].reverse().find(({ match }) => isThird(match));
    const award = (explicitId, record, teamId, field) => { let id = explicitId; if (!id && record) { if (record.homeTeam === teamId) id = record.assigned.home; if (record.awayTeam === teamId) id = record.assigned.away; } if (id) get(id)[field] += 1; };
    award(tournament.participantChampion, final, tournament.champion, 'titles'); award(tournament.participantRunnerUp, final, tournament.runnerUp, 'runners'); award(tournament.participantThird, third, tournament.third, 'thirds');
  }
  return [...map.values()].map((row) => ({ ...row, dg: row.gf - row.gc, performance: row.pj ? ((row.pg * 3 + row.pe) / (row.pj * 3)) * 100 : 0, ppg: row.pj ? row.points / row.pj : 0, teams: [...row.teams], tournaments: [...row.tournaments] })).filter((row) => row.pj || !row.archived).filter((row) => participantFilter === 'all' || row.id === participantFilter).filter((row) => sideFilter === 'all' || sideFilter === 'home' && row.localPj || sideFilter === 'away' && row.awayPj).sort((a, b) => b.points - a.points || b.pg - a.pg || b.dg - a.dg || b.gf - a.gf || a.name.localeCompare(b.name, 'es'));
}

function avatar(person) { return person.avatarUrl ? `<img src="${esc(person.avatarUrl)}" alt="" loading="lazy">` : `<span style="--participant:${esc(person.color || '#64748b')}">${esc(String(person.name || '?').slice(0, 1).toUpperCase())}</span>`; }
function personOptions(selected, all = true, source = state()) { return `${all ? `<option value="all" ${selected === 'all' ? 'selected' : ''}>Todos los participantes</option>` : ''}${(source.participants || []).map((person) => `<option value="${esc(person.id)}" ${person.id === selected ? 'selected' : ''}>${esc(person.name)}${person.archived ? ' · archivado' : ''}</option>`).join('')}`; }

function statsMarkup(source = state()) {
  const tournaments = filteredTournaments(source); const rows = participantStats(tournaments, source);
  const divisions = [...new Set(tournaments.flatMap((tournament) => (tournament.matches || []).map((match) => match.group).filter(Boolean)))];
  const totalMatches = rows.reduce((sum, row) => sum + row.pj, 0) / 2;
  const cards = rows.slice(0, 4).map((row, index) => { const person = participant(row.id, source) || row; const biggest = row.biggestWin ? `${row.biggestWin.gf}–${row.biggestWin.gc} · ${row.biggestWin.tournament}` : 'Sin victorias'; return `<article class="${index === 0 ? 'is-leader' : ''}"><header>${avatar(person)}<div><span>${index === 0 ? 'LÍDER HISTÓRICO' : 'PARTICIPANTE'}</span><h3>${esc(row.name)}</h3></div><strong>${row.points}<small>pts</small></strong></header><dl><div><dt>Partidos</dt><dd>${row.pj}</dd></div><div><dt>Rendimiento</dt><dd>${Math.round(row.performance)}%</dd></div><div><dt>Títulos</dt><dd>${row.titles}</dd></div><div><dt>Finales ganadas</dt><dd>${row.finalsWon}</dd></div><div><dt>Mejor racha</dt><dd>${row.bestWin}</dd></div><div><dt>Mayor victoria</dt><dd>${esc(biggest)}</dd></div></dl></article>`; }).join('');
  const tableRows = rows.map((row, index) => { const person = participant(row.id, source) || row; return `<tr><td><b>${index + 1}</b></td><td><div class="cm-v523-participant-cell">${avatar(person)}<div><b>${esc(row.name)}</b><small>${row.id === HOME_DEFAULT ? 'Local predeterminado' : row.id === AWAY_DEFAULT ? 'Visita predeterminada' : 'Participante adicional'}</small></div></div></td><td>${row.pj}</td><td>${row.pg}</td><td>${row.pe}</td><td>${row.pp}</td><td>${row.gf}</td><td>${row.gc}</td><td>${row.dg > 0 ? '+' : ''}${row.dg}</td><td><strong>${row.points}</strong></td><td>${Math.round(row.performance)}%</td><td>${row.titles}</td><td>${row.runners}</td><td>${row.thirds}</td><td>${row.teams.length}</td></tr>`; }).join('');
  return `<section class="cm-v523-stats-panel" data-cm-v523-panel="participants"><div class="cm-v523-panel-intro"><div><span>CONTROLADORES</span><h2>La Liga de los Participantes</h2><p>Álvaro controla al local y Carlos al visitante por defecto. Las nuevas personas se atribuyen partido a partido.</p></div><strong>${totalMatches}<small>partidos analizados</small></strong></div><section class="cm-v523-local-filters"><label>Participante<select data-cm-v523-filter="participant">${personOptions(participantFilter)}</select></label><label>Lado<select data-cm-v523-filter="side"><option value="all" ${sideFilter === 'all' ? 'selected' : ''}>Local y visita</option><option value="home" ${sideFilter === 'home' ? 'selected' : ''}>Como local</option><option value="away" ${sideFilter === 'away' ? 'selected' : ''}>Como visita</option></select></label><label>División<select data-cm-v523-filter="division"><option value="all">Todas las divisiones</option>${divisions.map((division) => `<option value="${esc(division)}" ${divisionFilter === division ? 'selected' : ''}>${esc(division)}</option>`).join('')}</select></label><button type="button" data-cm-v523-reset-stats>Restablecer</button></section><div class="cm-v523-participant-cards">${cards}</div><article class="cm-v523-card"><header><div><span>CLASIFICACIÓN ACUMULADA</span><h2>Ranking de participantes</h2></div><b>${rows.length}</b></header>${rows.length ? `<div class="cm-v523-table"><table><thead><tr><th>#</th><th>Participante</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th><th>Rend.</th><th>Títulos</th><th>2.º</th><th>3.º</th><th>Equipos</th></tr></thead><tbody>${tableRows}</tbody></table></div>` : '<div class="cm-v523-empty">No hay partidos para los filtros seleccionados.</div>'}</article></section>`;
}

function activateStatsTab() {
  const host = document.getElementById('cmV521History'); if (!host) return;
  host.querySelectorAll('[data-cm-v521-tab]').forEach((button) => { button.classList.remove('active'); button.setAttribute('aria-selected', 'false'); });
  host.querySelectorAll('[data-cm-v521-panel]').forEach((panel) => { panel.classList.remove('active'); panel.hidden = true; });
  host.querySelector('[data-cm-v523-tab="participants"]')?.classList.add('active');
  const panel = host.querySelector('[data-cm-v523-panel="participants"]'); if (panel) { panel.hidden = false; panel.classList.add('active'); }
  localStorage.setItem('cm_v523_stats_tab', 'participants');
}

function renderStats() {
  const host = document.getElementById('cmV521History'); const tabs = host?.querySelector('.cm-v521-tabs'); const content = host?.querySelector('.cm-v521-content'); if (!tabs || !content) return;
  if (!tabs.querySelector('[data-cm-v523-tab="participants"]')) tabs.insertAdjacentHTML('beforeend', '<button type="button" data-cm-v523-tab="participants"><b>Participantes</b><small>Controladores y rendimiento</small></button>');
  let panel = content.querySelector('[data-cm-v523-panel="participants"]'); if (!panel) { panel = document.createElement('section'); panel.dataset.cmV523Panel = 'participants'; panel.hidden = true; content.appendChild(panel); }
  const source = state(); const signature = JSON.stringify({ participants: source.participants, filters: [participantFilter, sideFilter, divisionFilter], tournaments: filteredTournaments(source).map((tournament) => [tournament.id, tournament.participantChampion, tournament.participantRunnerUp, tournament.participantThird, (tournament.matches || []).map((match) => [match.id, match.homeGoals, match.awayGoals, match.homePens, match.awayPens, match.participantHome, match.participantAway, match.group])]) });
  if (panel.dataset.signature !== signature) { panel.outerHTML = statsMarkup(source); panel = content.querySelector('[data-cm-v523-panel="participants"]'); panel.dataset.signature = signature; }
  if (localStorage.getItem('cm_v523_stats_tab') === 'participants') activateStatsTab();
}

function readiness(source = state()) {
  const teams = (source.teams || []).filter((team) => !team.archived); const people = activeParticipants(source); const ranking = window.ChuteDivisionsV54?.fifaOrder?.() || teams.map((team) => team.id).slice(0, 6); const duplicate = new Set(teams.map((team) => norm(team.name))).size !== teams.length;
  const checks = [
    { label: 'Seis equipos activos', ok: teams.length === 6, detail: `${teams.length} equipos disponibles`, critical: true },
    { label: 'Composición por Ranking FIFA', ok: ranking.length === 6, detail: ranking.length === 6 ? 'Primera y Segunda pueden formarse' : 'Ranking incompleto', critical: true },
    { label: 'Álvaro como local', ok: Boolean(participant(HOME_DEFAULT, source)), detail: 'Participante predeterminado', critical: true },
    { label: 'Carlos como visita', ok: Boolean(participant(AWAY_DEFAULT, source)), detail: 'Participante predeterminado', critical: true },
    { label: 'Participantes adicionales', ok: people.length >= 2, detail: `${people.length} activos`, critical: false },
    { label: 'Disciplina oficial', ok: source.config?.competitionRules?.yellowLimit === 2, detail: 'Suspensión con 2 amarillas', critical: true },
    { label: 'Desempate oficial', ok: source.config?.competitionRules?.tieBreakOrder?.at(-1) === 'headToHead', detail: 'Resultado entre ambos', critical: true },
    { label: 'Equipos sin duplicados', ok: !duplicate, detail: duplicate ? 'Revisar nombres repetidos' : 'Sin duplicados', critical: true },
    { label: 'Firebase', ok: Boolean(core.cloudLoaded), detail: core.cloudLoaded ? 'Base compartida conectada' : 'Conexión todavía cargando', critical: false }
  ];
  return { checks, ready: checks.filter((check) => check.critical).every((check) => check.ok) };
}

function rulesMarkup() { return `<div class="cm-v523-rules"><section><span>01</span><div><h3>Tabla de posiciones</h3><p>Victoria: 3 puntos. Empate: 1. Derrota: 0.</p><ol><li>Puntos.</li><li>Diferencia de gol.</li><li>Goles a favor.</li><li>Menos goles recibidos.</li><li>Resultado entre ambos equipos.</li></ol><small>Si continúa la igualdad, queda pendiente un partido de desempate o resolución administrativa.</small></div></section><section><span>02</span><div><h3>Primera y Segunda División</h3><p>La temporada inaugural distribuye los seis clubes según el Ranking FIFA: tres en Primera y tres en Segunda.</p></div></section><section><span>03</span><div><h3>Clasificación y Play-Off</h3><p>El 1.º y 2.º de cada división clasifican a su Play-Off cuando se encuentra habilitado. La final puede ser única o ida y vuelta.</p></div></section><section><span>04</span><div><h3>Ascenso y descenso</h3><p>El 3.º de Primera desciende. Asciende el ganador del Play-Off de Segunda o el líder regular, según la configuración.</p></div></section><section><span>05</span><div><h3>Disciplina</h3><p>Dos amarillas acumuladas generan una fecha de suspensión. Dos amarillas en el mismo partido equivalen a expulsión. La sanción pendiente se arrastra.</p></div></section><section><span>06</span><div><h3>Participantes</h3><p>Álvaro controla al local y Carlos al visitante. Una nueva persona se selecciona partido a partido sin modificar el historial anterior.</p></div></section></div>`; }
function avatarAdmin(person) { return avatar(person); }
function peopleMarkup(source = state()) { return `<div class="cm-v523-admin-people">${(source.participants || []).map((person) => `<article data-cm-v523-person="${esc(person.id)}" class="${person.archived ? 'is-archived' : ''}">${avatarAdmin(person)}<div><b>${esc(person.name)}</b><small>${person.id === HOME_DEFAULT ? 'Local predeterminado' : person.id === AWAY_DEFAULT ? 'Visita predeterminada' : person.archived ? 'Archivado' : 'Participante adicional'}</small></div>${core.canEdit?.() ? `<label>Color<input type="color" value="${esc(person.color || '#64748b')}" data-cm-v523-person-color="${esc(person.id)}"></label><button type="button" data-cm-v523-save-person="${esc(person.id)}">Guardar</button>${![HOME_DEFAULT, AWAY_DEFAULT].includes(person.id) ? `<button type="button" class="secondary" data-cm-v523-archive-person="${esc(person.id)}">${person.archived ? 'Reactivar' : 'Archivar'}</button>` : ''}` : ''}</article>`).join('')}</div>`; }
function statusMarkup(source = state()) { const result = readiness(source); return `<section class="cm-v523-readiness ${result.ready ? 'is-ready' : 'is-pending'}"><div><span>${result.ready ? 'SISTEMA PREPARADO' : 'REVISIÓN NECESARIA'}</span><h2>${result.ready ? 'Listo para comenzar las divisiones' : 'Faltan elementos antes de comenzar'}</h2><p>${result.ready ? 'Composición, reglas, participantes, disciplina y movimientos están configurados.' : 'Revisa los indicadores críticos.'}</p></div><strong>${result.checks.filter((check) => check.ok).length}/${result.checks.length}</strong></section><div class="cm-v523-checks">${result.checks.map((check) => `<article class="${check.ok ? 'ok' : check.critical ? 'error' : 'warning'}"><i>${check.ok ? '✓' : check.critical ? '!' : '·'}</i><div><b>${esc(check.label)}</b><span>${esc(check.detail)}</span></div></article>`).join('')}</div>`; }

function ensureAdminHost() {
  const page = document.getElementById('administracion'); if (!page) return null; let host = document.getElementById('cmV523Admin'); if (host) return host;
  host = document.createElement('div'); host.id = 'cmV523Admin'; page.querySelector('.page-title')?.insertAdjacentElement('afterend', host);
  const legacy = [...page.children].find((child) => child.classList?.contains('two-columns')); const danger = [...page.children].find((child) => child.classList?.contains('danger'));
  host.innerHTML = `<nav class="cm-v523-admin-tabs"><button data-cm-v523-admin-tab="status">Estado</button><button data-cm-v523-admin-tab="participants">Participantes</button><button data-cm-v523-admin-tab="rules">Reglamento</button><button data-cm-v523-admin-tab="data">Datos y respaldos</button><button data-cm-v523-admin-tab="maintenance">Mantenimiento</button></nav><div class="cm-v523-admin-panels"><section data-cm-v523-admin-panel="status"></section><section data-cm-v523-admin-panel="participants"></section><section data-cm-v523-admin-panel="rules"></section><section data-cm-v523-admin-panel="data"></section><section data-cm-v523-admin-panel="maintenance"></section></div>`;
  if (legacy) host.querySelector('[data-cm-v523-admin-panel="data"]').appendChild(legacy);
  const maintenance = host.querySelector('[data-cm-v523-admin-panel="maintenance"]'); maintenance.insertAdjacentHTML('beforeend', '<article class="cm-v523-maintenance"><span>MANTENIMIENTO</span><h2>Herramientas técnicas</h2><p>Las operaciones destructivas permanecen separadas y cerradas.</p><div class="cm-v523-maintenance-actions"><button type="button" data-cm-v523-refresh>Revisar sistema</button><button type="button" data-cm-v523-normalize>Normalizar participantes y reglas</button></div></article>');
  if (danger) { const details = document.createElement('details'); details.className = 'cm-v523-risk'; details.innerHTML = '<summary>Zona de riesgo</summary>'; details.appendChild(danger); maintenance.appendChild(details); }
  return host;
}
function activateAdmin(tab) { adminTab = ['status', 'participants', 'rules', 'data', 'maintenance'].includes(tab) ? tab : 'status'; localStorage.setItem('cm_v523_admin_tab', adminTab); const host = document.getElementById('cmV523Admin'); host?.querySelectorAll('[data-cm-v523-admin-tab]').forEach((button) => button.classList.toggle('active', button.dataset.cmV523AdminTab === adminTab)); host?.querySelectorAll('[data-cm-v523-admin-panel]').forEach((panel) => { panel.hidden = panel.dataset.cmV523AdminPanel !== adminTab; }); }

function renderAdmin() {
  const host = ensureAdminHost(); if (!host) return; const source = state(); const signature = JSON.stringify({ participants: source.participants, config: source.config?.competitionRules, teams: (source.teams || []).map((team) => [team.id, team.name, team.archived]), cloud: core.cloudLoaded, edit: core.canEdit?.() });
  if (host.dataset.signature !== signature) {
    host.dataset.signature = signature;
    host.querySelector('[data-cm-v523-admin-panel="status"]').innerHTML = `<div class="cm-v523-admin-heading"><span>CENTRO DE CONTROL</span><h2>Estado del sistema</h2><p>Preparación operativa, reglas y conexión.</p></div>${statusMarkup(source)}`;
    host.querySelector('[data-cm-v523-admin-panel="participants"]').innerHTML = `<div class="cm-v523-admin-heading"><span>GESTIÓN DEPORTIVA</span><h2>Participantes</h2><p>Álvaro y Carlos permanecen predeterminados. Agrega otras personas cuando sea necesario.</p></div>${core.canEdit?.() ? '<form id="cmV523ParticipantForm" class="cm-v523-person-form"><label>Nombre<input id="cmV523ParticipantName" required maxlength="50" placeholder="Nombre del participante"></label><label>Color<input id="cmV523ParticipantColor" type="color" value="#16a085"></label><label>Avatar opcional<input id="cmV523ParticipantAvatar" type="url" placeholder="https://..."></label><button type="submit">Agregar participante</button></form>' : '<p class="cm-v523-readonly">Inicia sesión como administrador para editar.</p>'}${peopleMarkup(source)}`;
    host.querySelector('[data-cm-v523-admin-panel="rules"]').innerHTML = `<div class="cm-v523-admin-heading"><span>REGLAMENTO OFICIAL</span><h2>Cómo funciona ChuteMundo</h2><p>Puntuación, clasificación, Play-Off, ascenso, descenso y disciplina.</p></div>${rulesMarkup()}`;
  }
  activateAdmin(adminTab);
}

function renderMatchSelectors() {
  const live = document.querySelector('[data-cm-v59-live-pair]'); if (!live) return; const pair = live.dataset.cmV59LivePair || ''; const [tournamentId, matchId] = pair.split('__'); const source = state(); const tournament = (source.tournaments || []).find((item) => item.id === tournamentId); const match = tournament?.matches?.find((item) => item.id === matchId); if (!tournament || !match) return;
  const assigned = assignedParticipants(tournament, match, source); let section = live.querySelector('.cm-v523-match-participants'); if (!section) { section = document.createElement('section'); section.className = 'cm-v523-match-participants'; live.querySelector('.cm-v59-live-heading')?.insertAdjacentElement('afterend', section); }
  const signature = JSON.stringify({ pair, assigned, participants: source.participants, edit: core.canEdit?.() }); if (section.dataset.signature === signature) return; section.dataset.signature = signature;
  const options = (selected) => (source.participants || []).filter((person) => !person.archived || person.id === selected).map((person) => `<option value="${esc(person.id)}" ${person.id === selected ? 'selected' : ''}>${esc(person.name)}${person.archived ? ' · archivado' : ''}</option>`).join('');
  section.innerHTML = `<header><div><span>PARTICIPANTES</span><b>Quién controla cada lado</b></div><small>Predeterminado: Álvaro local · Carlos visita</small></header><div><label>Equipo local<select data-cm-v523-match-person="home" data-pair="${esc(pair)}" ${core.canEdit?.() ? '' : 'disabled'}>${options(assigned.home)}</select></label><label>Equipo visitante<select data-cm-v523-match-person="away" data-pair="${esc(pair)}" ${core.canEdit?.() ? '' : 'disabled'}>${options(assigned.away)}</select></label></div>`;
}

async function persistMatchPerson(pair, side, id) {
  if (saving || !core.canEdit?.()) return; const [tournamentId, matchId] = pair.split('__'); const previous = clone(state()); const next = clone(previous); const tournament = (next.tournaments || []).find((item) => item.id === tournamentId); const match = tournament?.matches?.find((item) => item.id === matchId); if (!match) return;
  const other = side === 'home' ? match.participantAway || tournament.participantAway || AWAY_DEFAULT : match.participantHome || tournament.participantLocal || HOME_DEFAULT;
  if (id === other) { core.showToast?.('Una misma persona no puede controlar ambos equipos.'); schedule(); return; }
  match[side === 'home' ? 'participantHome' : 'participantAway'] = id; match.updatedAt = Date.now(); saving = true;
  try { core.setState(next); core.persistLocal?.(); await core.saveCloud?.(); core.showToast?.(`${participantName(id, next)} quedó asignado al lado ${side === 'home' ? 'local' : 'visitante'}.`); }
  catch (error) { console.error(error); core.setState(previous); core.showToast?.('No se pudo guardar el participante.'); }
  finally { saving = false; schedule(); }
}

async function addPerson(form) {
  if (!core.canEdit?.()) return; const name = document.getElementById('cmV523ParticipantName')?.value.trim() || ''; const color = document.getElementById('cmV523ParticipantColor')?.value || '#16a085'; const avatarUrl = document.getElementById('cmV523ParticipantAvatar')?.value.trim() || ''; if (!name) return core.showToast?.('Escribe el nombre del participante.');
  const previous = clone(state()); const next = clone(previous); if ((next.participants || []).some((person) => norm(person.name) === norm(name))) return core.showToast?.('Ya existe un participante con ese nombre.');
  next.participants.push({ id: core.uid?.('participante') || `participante_${Date.now()}`, name, color, avatarUrl, archived: false, createdAt: Date.now() }); core.setState(next); core.persistLocal?.();
  try { await core.saveCloud?.(); core.showToast?.(`${name} fue agregado.`); form.reset(); document.getElementById('cmV523ParticipantColor').value = '#16a085'; }
  catch (error) { console.error(error); core.setState(previous); core.showToast?.('Firebase rechazó el participante.'); }
  schedule();
}
async function updatePerson(id, archive = false) {
  if (!core.canEdit?.()) return; const previous = clone(state()); const next = clone(previous); const person = (next.participants || []).find((item) => item.id === id); if (!person) return;
  if (archive) person.archived = !person.archived; else { const color = document.querySelector(`[data-cm-v523-person-color="${CSS.escape(id)}"]`)?.value; if (color) person.color = color; }
  core.setState(next); core.persistLocal?.(); try { await core.saveCloud?.(); core.showToast?.(archive ? `${person.name} ${person.archived ? 'fue archivado' : 'fue reactivado'}.` : `Color de ${person.name} actualizado.`); } catch (error) { console.error(error); core.setState(previous); core.showToast?.('No se pudo guardar el cambio.'); } schedule();
}

function schedule() { if (refreshQueued) return; refreshQueued = true; requestAnimationFrame(() => { refreshQueued = false; ensureDefaults(); renderAdmin(); renderStats(); renderMatchSelectors(); }); }

document.addEventListener('click', (event) => {
  const adminButton = event.target.closest('[data-cm-v523-admin-tab]'); if (adminButton) { activateAdmin(adminButton.dataset.cmV523AdminTab); return; }
  if (event.target.closest('[data-cm-v523-tab="participants"]')) { activateStatsTab(); return; }
  if (event.target.closest('[data-cm-v521-tab]')) localStorage.removeItem('cm_v523_stats_tab');
  const save = event.target.closest('[data-cm-v523-save-person]'); if (save) { void updatePerson(save.dataset.cmV523SavePerson); return; }
  const archive = event.target.closest('[data-cm-v523-archive-person]'); if (archive) { void updatePerson(archive.dataset.cmV523ArchivePerson, true); return; }
  if (event.target.closest('[data-cm-v523-refresh]')) { schedule(); core.showToast?.('Revisión actualizada.'); return; }
  if (event.target.closest('[data-cm-v523-normalize]')) { ensureDefaults(); schedule(); core.showToast?.('Participantes y reglas normalizados.'); return; }
  if (event.target.closest('[data-cm-v523-reset-stats]')) { participantFilter = 'all'; sideFilter = 'all'; divisionFilter = 'all'; localStorage.removeItem('cm_v523_participant_filter'); localStorage.removeItem('cm_v523_side_filter'); localStorage.removeItem('cm_v523_division_filter'); schedule(); setTimeout(activateStatsTab, 0); }
}, true);
document.addEventListener('change', (event) => {
  const matchPerson = event.target.closest('[data-cm-v523-match-person]'); if (matchPerson) { void persistMatchPerson(matchPerson.dataset.pair, matchPerson.dataset.cmV523MatchPerson, matchPerson.value); return; }
  const filter = event.target.closest('[data-cm-v523-filter]'); if (filter) { if (filter.dataset.cmV523Filter === 'participant') { participantFilter = filter.value; localStorage.setItem('cm_v523_participant_filter', participantFilter); } if (filter.dataset.cmV523Filter === 'side') { sideFilter = filter.value; localStorage.setItem('cm_v523_side_filter', sideFilter); } if (filter.dataset.cmV523Filter === 'division') { divisionFilter = filter.value; localStorage.setItem('cm_v523_division_filter', divisionFilter); } schedule(); setTimeout(activateStatsTab, 0); return; }
  if (event.target.closest('[data-cm-v521-filter]')) setTimeout(schedule, 0);
}, true);
document.addEventListener('submit', (event) => { if (event.target.id === 'cmV523ParticipantForm') { event.preventDefault(); void addPerson(event.target); } }, true);
document.addEventListener('chute:state', schedule); document.addEventListener('chute:ready', schedule); document.addEventListener('chute:boot-complete', schedule);

const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = `/chute-v523-participants-admin.css?v=${VERSION}`; style.id = 'cmV523ParticipantsAdminStyles'; if (!document.getElementById(style.id)) document.head.appendChild(style);
ensureDefaults(); schedule(); window.setInterval(schedule, 900);
window.ChuteV523ControlCenter = Object.freeze({ VERSION, HOME_DEFAULT, AWAY_DEFAULT, ensureDefaults, participantStats, readiness, schedule });
