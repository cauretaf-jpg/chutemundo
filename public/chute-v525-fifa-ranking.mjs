const core = window.ChuteMundoCore;
const model = window.ChuteDetailModel || {};
if (!core) throw new Error('Chute Mundo no está listo para el Ranking FIFA v5.25.');

const VERSION = '5.25.0';
const BASE_RATING = 1000;
const K_FACTOR = 24;
const FRIENDLY_FACTOR = 0.25;
const PODIUM_BONUS = Object.freeze({ champion: 50, runnerUp: 25, third: 10 });
const esc = model.esc || ((value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])));
const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const norm = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const sourceState = () => core.getState?.() || { teams: [], tournaments: [], friendlies: [] };
const played = (match) => core.matchPlayed?.(match) ?? (match?.homeGoals !== null && match?.homeGoals !== '' && match?.awayGoals !== null && match?.awayGoals !== '');
let refreshQueued = false;

function loadStyles() {
  if (document.getElementById('cmV525FifaStyles')) return;
  const link = document.createElement('link');
  link.id = 'cmV525FifaStyles';
  link.rel = 'stylesheet';
  link.href = `/chute-v525-fifa-ranking.css?v=${VERSION}`;
  document.head.appendChild(link);
}

function parseDate(value) {
  if (!value) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value).trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : null;
}

function teamName(teamId, source = sourceState()) {
  return (source.teams || []).find((team) => team.id === teamId)?.name || core.teamName?.(teamId) || teamId || 'Equipo';
}

function logoUrl(teamId) {
  return model.logoUrl?.(teamId) || '';
}

function matchTeams(tournament, match) {
  const home = match?.home || match?.homeTeamId || core.resolveHome?.(tournament, match);
  const away = match?.away || match?.awayTeamId || core.resolveAway?.(tournament, match);
  return { home, away };
}

function penaltyWinner(match, home, away) {
  const homePens = match?.homePens !== null && match?.homePens !== undefined && match?.homePens !== '' ? num(match.homePens) : null;
  const awayPens = match?.awayPens !== null && match?.awayPens !== undefined && match?.awayPens !== '' ? num(match.awayPens) : null;
  if (homePens !== null && awayPens !== null && homePens !== awayPens) return homePens > awayPens ? home : away;
  const attempts = Array.isArray(match?.penaltyShootout) ? match.penaltyShootout : [];
  if (!attempts.length) return null;
  const scoredHome = attempts.filter((attempt) => attempt.side === 'home' && attempt.result === 'scored').length;
  const scoredAway = attempts.filter((attempt) => attempt.side === 'away' && attempt.result === 'scored').length;
  return scoredHome === scoredAway ? null : scoredHome > scoredAway ? home : away;
}

function actualScores(match, home, away) {
  const hg = num(match.homeGoals);
  const ag = num(match.awayGoals);
  if (hg > ag) return { home: 1, away: 0, penalties: false };
  if (ag > hg) return { home: 0, away: 1, penalties: false };
  const winner = penaltyWinner(match, home, away);
  if (winner === home) return { home: 0.75, away: 0.5, penalties: true };
  if (winner === away) return { home: 0.5, away: 0.75, penalties: true };
  return { home: 0.5, away: 0.5, penalties: false };
}

function stageMultiplier(match) {
  const text = norm(`${match?.stage || ''} ${match?.round || ''} ${match?.label || ''}`);
  if (/3er|3 er|tercer|third/.test(text)) return 1.1;
  if (/semi/.test(text)) return 1.25;
  if (/final/.test(text) && !/semi/.test(text)) return 1.35;
  return 1;
}

function goalDifferenceMultiplier(match) {
  const margin = Math.abs(num(match?.homeGoals) - num(match?.awayGoals));
  if (margin >= 4) return 1.35;
  if (margin === 3) return 1.25;
  if (margin === 2) return 1.15;
  return 1;
}

function expectedScore(rating, opponentRating) {
  return 1 / (1 + (10 ** ((opponentRating - rating) / 400)));
}

function friendlyContainers(source = sourceState()) {
  const raw = Array.isArray(source.friendlies) ? source.friendlies : [];
  return raw.flatMap((entry, index) => {
    if (Array.isArray(entry?.matches)) return entry.matches.map((match, matchIndex) => ({ tournament: entry, match, tournamentIndex: index, matchIndex, friendly: true }));
    return [{ tournament: { id: entry?.tournamentId || `friendly-${index + 1}`, name: entry?.tournamentName || 'Amistoso', status: 'historical', type: 'friendly' }, match: entry, tournamentIndex: index, matchIndex: 0, friendly: true }];
  });
}

function matchRecords(tournaments, source = sourceState(), { includeFriendlies = true } = {}) {
  const official = (tournaments || []).flatMap((tournament, tournamentIndex) => (tournament.matches || []).map((match, matchIndex) => ({ tournament, match, tournamentIndex, matchIndex, friendly: false })));
  const combined = includeFriendlies ? [...official, ...friendlyContainers(source)] : official;
  return combined.map((record, sequence) => {
    const { home, away } = matchTeams(record.tournament, record.match);
    const time = parseDate(record.match?.date) ?? parseDate(record.tournament?.startDate || record.tournament?.date || record.tournament?.createdAt) ?? (record.tournamentIndex * 100000 + record.matchIndex + sequence);
    return { ...record, home, away, time, sequence };
  }).filter((record) => record.match?.stage !== 'bye' && played(record.match) && record.home && record.away)
    .sort((left, right) => left.time - right.time || left.sequence - right.sequence);
}

function tournamentBonusEvents(tournaments) {
  return (tournaments || []).map((tournament, index) => {
    const matches = (tournament.matches || []).filter((match) => match?.stage !== 'bye' && played(match));
    if (!matches.length && !tournament.champion && !tournament.runnerUp && !tournament.third) return null;
    const latest = Math.max(0, ...matches.map((match, matchIndex) => parseDate(match.date) ?? (index * 100000 + matchIndex)));
    return { tournament, time: latest + 0.5, sequence: index };
  }).filter(Boolean).sort((left, right) => left.time - right.time || left.sequence - right.sequence);
}

function filterTournamentsForUi(source = sourceState()) {
  const era = document.querySelector('[data-cm-v521-filter="era"]')?.value || 'all';
  const tournamentId = document.querySelector('[data-cm-v521-filter="tournament"]')?.value || 'all';
  const format = document.querySelector('[data-cm-v521-filter="format"]')?.value || 'all';
  const status = document.querySelector('[data-cm-v521-filter="status"]')?.value || 'all';
  return (source.tournaments || []).filter((tournament) => {
    const division = tournament.type === 'division_season' || tournament.eraId === 'divisions' || tournament.era === 'division';
    const eraId = division ? 'divisions' : 'leagues';
    if (era !== 'all' && era !== eraId) return false;
    if (tournamentId !== 'all' && tournament.id !== tournamentId) return false;
    if (status !== 'all') {
      const statusId = tournament.status === 'historical' || tournament.champion ? 'historical' : tournament.status === 'active' ? 'active' : 'upcoming';
      if (status !== statusId) return false;
    }
    if (format !== 'all') {
      const type = norm(`${tournament.type || ''} ${tournament.name || ''}`);
      const group = type.includes('division') ? 'division' : type.includes('cup') || type.includes('copa') || type.includes('knockout') ? 'cup' : type.includes('playoff') || type.includes('play off') ? 'playoff' : type.includes('league') || type.includes('liga') ? 'league' : 'other';
      if (format !== group) return false;
    }
    return true;
  });
}

function compute(tournaments = sourceState().tournaments || [], { includeFriendlies = true, source = sourceState() } = {}) {
  const teams = source.teams || [];
  const table = new Map(teams.map((team) => [team.id, {
    teamId: team.id,
    rating: BASE_RATING,
    bonus: 0,
    pj: 0,
    pg: 0,
    pe: 0,
    pp: 0,
    gf: 0,
    gc: 0,
    lastDelta: 0,
    lastMatch: '',
    officialMatches: 0,
    friendlyMatches: 0,
    titles: 0,
    runners: 0,
    thirds: 0
  }]));
  const get = (teamId) => {
    if (!table.has(teamId)) table.set(teamId, { teamId, rating: BASE_RATING, bonus: 0, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, lastDelta: 0, lastMatch: '', officialMatches: 0, friendlyMatches: 0, titles: 0, runners: 0, thirds: 0 });
    return table.get(teamId);
  };

  const matches = matchRecords(tournaments, source, { includeFriendlies });
  const bonusEvents = tournamentBonusEvents(tournaments);
  let bonusIndex = 0;
  const applyBonusUntil = (time) => {
    while (bonusIndex < bonusEvents.length && bonusEvents[bonusIndex].time <= time) {
      const tournament = bonusEvents[bonusIndex].tournament;
      if (tournament.champion) { const row = get(tournament.champion); row.bonus += PODIUM_BONUS.champion; row.titles += 1; }
      if (tournament.runnerUp) { const row = get(tournament.runnerUp); row.bonus += PODIUM_BONUS.runnerUp; row.runners += 1; }
      if (tournament.third) { const row = get(tournament.third); row.bonus += PODIUM_BONUS.third; row.thirds += 1; }
      bonusIndex += 1;
    }
  };

  for (const record of matches) {
    applyBonusUntil(record.time);
    const home = get(record.home);
    const away = get(record.away);
    const homeBefore = home.rating;
    const awayBefore = away.rating;
    const expectedHome = expectedScore(homeBefore, awayBefore);
    const expectedAway = expectedScore(awayBefore, homeBefore);
    const actual = actualScores(record.match, record.home, record.away);
    const importance = stageMultiplier(record.match);
    const margin = goalDifferenceMultiplier(record.match);
    const scope = record.friendly ? FRIENDLY_FACTOR : 1;
    const deltaHome = K_FACTOR * importance * margin * scope * (actual.home - expectedHome);
    const deltaAway = K_FACTOR * importance * margin * scope * (actual.away - expectedAway);
    home.rating = Math.round((home.rating + deltaHome) * 100) / 100;
    away.rating = Math.round((away.rating + deltaAway) * 100) / 100;
    home.lastDelta = Math.round(deltaHome * 100) / 100;
    away.lastDelta = Math.round(deltaAway * 100) / 100;
    const score = `${num(record.match.homeGoals)}–${num(record.match.awayGoals)}`;
    home.lastMatch = `${record.tournament.name || 'Partido'} · ${score}`;
    away.lastMatch = `${record.tournament.name || 'Partido'} · ${score}`;
    for (const [row, gf, gc] of [[home, num(record.match.homeGoals), num(record.match.awayGoals)], [away, num(record.match.awayGoals), num(record.match.homeGoals)]]) {
      row.pj += 1; row.gf += gf; row.gc += gc;
      if (record.friendly) row.friendlyMatches += 1; else row.officialMatches += 1;
      if (gf > gc) row.pg += 1; else if (gf === gc) row.pe += 1; else row.pp += 1;
    }
  }
  applyBonusUntil(Number.POSITIVE_INFINITY);

  return [...table.values()].map((row) => ({
    ...row,
    dg: row.gf - row.gc,
    points: row.rating + row.bonus,
    ratingChange: row.rating - BASE_RATING,
    winPct: row.pj ? row.pg / row.pj * 100 : 0
  })).filter((row) => row.pj || row.bonus || !(teams.find((team) => team.id === row.teamId)?.archived))
    .sort((left, right) => right.points - left.points || right.rating - left.rating || right.titles - left.titles || right.pg - left.pg || teamName(left.teamId, source).localeCompare(teamName(right.teamId, source), 'es'))
    .map((row, index) => ({ ...row, pos: index + 1 }));
}

function order(source = sourceState()) {
  const active = new Set((source.teams || []).filter((team) => !team.archived).map((team) => team.id));
  return compute(source.tournaments || [], { source, includeFriendlies: true }).filter((row) => active.has(row.teamId)).map((row) => row.teamId);
}

function signed(value, digits = 1) {
  const rounded = Number(value || 0).toFixed(digits);
  return Number(value || 0) > 0 ? `+${rounded}` : rounded;
}

function topCards(rows, source) {
  return rows.slice(0, 3).map((row, index) => `<article class="cm-v525-rank-card ${index === 0 ? 'is-leader' : ''}"><span>${index === 0 ? 'LÍDER FIFA' : `${index + 1}.º LUGAR`}</span><div><img src="${esc(logoUrl(row.teamId))}" alt=""><section><h3>${esc(teamName(row.teamId, source))}</h3><p>${row.pj} partidos · ${row.titles} títulos</p></section></div><strong>${Math.round(row.points)}<small>puntos FIFA</small></strong><footer><b>Rating ${row.rating.toFixed(1)}</b><em class="${row.lastDelta > 0 ? 'positive' : row.lastDelta < 0 ? 'negative' : ''}">${signed(row.lastDelta)}</em></footer></article>`).join('');
}

function rankingTable(rows, source) {
  if (!rows.length) return '<div class="cm-v525-empty">No existen partidos para los filtros seleccionados.</div>';
  return `<div class="cm-v525-table-scroll"><table class="cm-v525-table"><thead><tr><th>#</th><th>Equipo</th><th>Puntos FIFA</th><th>Rating ELO</th><th>Bono</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>DG</th><th>Último cambio</th></tr></thead><tbody>${rows.map((row) => `<tr><td><b>${row.pos}</b></td><td><button type="button" data-cm-v525-team="${esc(row.teamId)}"><img src="${esc(logoUrl(row.teamId))}" alt=""><span>${esc(teamName(row.teamId, source))}</span></button></td><td><strong>${Math.round(row.points)}</strong></td><td>${row.rating.toFixed(1)}</td><td>${row.bonus}</td><td>${row.pj}</td><td>${row.pg}</td><td>${row.pe}</td><td>${row.pp}</td><td class="${row.dg > 0 ? 'positive' : row.dg < 0 ? 'negative' : ''}">${row.dg > 0 ? '+' : ''}${row.dg}</td><td><span class="cm-v525-delta ${row.lastDelta > 0 ? 'positive' : row.lastDelta < 0 ? 'negative' : ''}">${signed(row.lastDelta)}</span></td></tr>`).join('')}</tbody></table></div>`;
}

function panelMarkup(source = sourceState()) {
  const tournaments = filterTournamentsForUi(source);
  const specificFilter = Boolean(document.querySelector('[data-cm-v521-filter="tournament"]')?.value !== 'all' || document.querySelector('[data-cm-v521-filter="format"]')?.value !== 'all' || document.querySelector('[data-cm-v521-filter="status"]')?.value !== 'all');
  let rows = compute(tournaments, { source, includeFriendlies: !specificFilter });
  const selectedTeam = document.querySelector('[data-cm-v521-filter="team"]')?.value || 'all';
  if (selectedTeam !== 'all') rows = rows.filter((row) => row.teamId === selectedTeam);
  return `<section class="cm-v525-fifa-panel" data-cm-v521-panel="fifa" data-cm-v525-panel="fifa" hidden><header class="cm-v525-fifa-head"><div><span>RANKING FIFA CHUTE</span><h2>Clasificación dinámica de clubes</h2><p>Modelo ELO propio: mide resultado, fuerza del rival, fase, diferencia de gol y penales. Los amistosos tienen peso reducido.</p></div><strong>${rows.length}<small>equipos clasificados</small></strong></header><section class="cm-v525-formula"><article><span>Base</span><b>${BASE_RATING}</b><small>puntos iniciales</small></article><article><span>Factor K</span><b>${K_FACTOR}</b><small>sensibilidad por partido</small></article><article><span>Amistosos</span><b>×${FRIENDLY_FACTOR}</b><small>impacto reducido</small></article><article><span>Bonos</span><b>50 · 25 · 10</b><small>campeón, 2.º y 3.º</small></article></section><div class="cm-v525-rank-cards">${topCards(rows, source)}</div><article class="cm-v525-ranking-board"><header><div><span>CLASIFICACIÓN ACTUAL</span><h3>Puntos FIFA por equipo</h3></div><p>El rating ELO determina la fuerza esperada. Los bonos de podio se suman al total visible sin alterar la expectativa del siguiente partido.</p></header>${rankingTable(rows, source)}</article><details class="cm-v525-method"><summary>Ver fórmula y multiplicadores</summary><div><p><b>Variación:</b> 24 × importancia × diferencia de gol × alcance × (resultado real − resultado esperado).</p><p><b>Resultado esperado:</b> 1 ÷ [1 + 10^((rating rival − rating propio) ÷ 400)].</p><p><b>Resultado real:</b> victoria 1; empate 0,5; derrota 0; tanda ganada 0,75 y tanda perdida 0,5.</p><p><b>Fases:</b> regular/grupos ×1; tercer lugar ×1,10; semifinal ×1,25; final ×1,35.</p><p><b>Diferencia:</b> 1 gol ×1; 2 ×1,15; 3 ×1,25; 4 o más ×1,35.</p></div></details></section>`;
}

function ensureStatsPanel() {
  const host = document.getElementById('cmV521History');
  const tabs = host?.querySelector('.cm-v521-tabs');
  const content = host?.querySelector('.cm-v521-content');
  if (!host || !tabs || !content) return false;
  let tab = tabs.querySelector('[data-cm-v525-tab="fifa"]');
  if (!tab) {
    tab = document.createElement('button');
    tab.type = 'button';
    tab.setAttribute('role', 'tab');
    tab.dataset.cmV525Tab = 'fifa';
    tab.innerHTML = '<b>Ranking FIFA</b><small>Fuerza actual de los clubes</small>';
    tabs.insertBefore(tab, tabs.children[1] || null);
  }
  let panel = content.querySelector('[data-cm-v525-panel="fifa"]');
  const source = sourceState();
  const signature = JSON.stringify({
    filters: [...document.querySelectorAll('[data-cm-v521-filter]')].map((field) => [field.dataset.cmV521Filter, field.value]),
    teams: (source.teams || []).map((team) => [team.id, team.name, team.archived]),
    tournaments: (source.tournaments || []).map((tournament) => [tournament.id, tournament.type, tournament.status, tournament.champion, tournament.runnerUp, tournament.third, (tournament.matches || []).map((match) => [match.id, match.home, match.away, match.homeGoals, match.awayGoals, match.homePens, match.awayPens, match.stage, match.round, match.label, match.date])]),
    friendlies: source.friendlies || []
  });
  if (!panel || panel.dataset.signature !== signature) {
    panel?.remove();
    content.insertAdjacentHTML('afterbegin', panelMarkup(source));
    panel = content.querySelector('[data-cm-v525-panel="fifa"]');
    panel.dataset.signature = signature;
  }
  if (localStorage.getItem('cm_v525_stats_tab') === 'fifa') activateFifa();
  return true;
}

function activateFifa() {
  if (!ensureStatsPanel()) return;
  const host = document.getElementById('cmV521History');
  const tab = host.querySelector('[data-cm-v525-tab="fifa"]');
  const panel = host.querySelector('[data-cm-v525-panel="fifa"]');
  host.querySelectorAll('[data-cm-v521-tab], [data-cm-v523-tab], [data-cm-v525-tab]').forEach((button) => {
    const active = button === tab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  host.querySelectorAll('[data-cm-v521-panel], [data-cm-v523-panel], [data-cm-v525-panel]').forEach((item) => {
    const active = item === panel;
    item.classList.toggle('active', active);
    item.hidden = !active;
    item.setAttribute('aria-hidden', active ? 'false' : 'true');
  });
  localStorage.removeItem('cm_v523_stats_tab');
  localStorage.setItem('cm_v525_stats_tab', 'fifa');
}

function deactivateFifa() {
  const host = document.getElementById('cmV521History');
  const tab = host?.querySelector('[data-cm-v525-tab="fifa"]');
  const panel = host?.querySelector('[data-cm-v525-panel="fifa"]');
  tab?.classList.remove('active');
  tab?.setAttribute('aria-selected', 'false');
  if (panel) { panel.classList.remove('active'); panel.hidden = true; panel.setAttribute('aria-hidden', 'true'); }
  localStorage.removeItem('cm_v525_stats_tab');
}

function rulesMarkup() {
  return `<section data-cm-v525-rules class="cm-v525-rules"><article><span>07</span><div><h3>Ranking FIFA Chute</h3><p>Cada club comienza con <b>1000 puntos de rating</b>. La variación de cada partido usa un ELO propio con K=24.</p><div class="cm-v525-rule-formula">Δ = 24 × fase × diferencia × alcance × (resultado real − esperado)</div><ul><li>Resultado esperado: 1 ÷ [1 + 10^((rating rival − rating propio) ÷ 400)].</li><li>Victoria: 1; empate: 0,5; derrota: 0.</li><li>Tanda: ganador 0,75; perdedor 0,5.</li><li>Regular/grupos ×1; tercer lugar ×1,10; semifinal ×1,25; final ×1,35.</li><li>Diferencia de 1 gol ×1; 2 ×1,15; 3 ×1,25; 4 o más ×1,35.</li><li>Amistosos ×0,25.</li><li>Bonos de podio: campeón +50, subcampeón +25 y tercero +10.</li></ul><small>El rating ELO se usa para calcular la fuerza esperada. Los bonos se muestran en el total FIFA, pero no modifican la expectativa del siguiente partido.</small></div></article><article><span>08</span><div><h3>Elección de premios</h3><p>Los reconocimientos son provisionales mientras el torneo está en juego y quedan oficiales cuando todos los partidos terminan y el torneo se cierra.</p><ul><li><b>Bota de Oro:</b> más goles; desempata menor cantidad de minutos por gol, asistencias, goles decisivos y orden alfabético.</li><li><b>Maestro de Asistencias:</b> más asistencias; desempata menor cantidad de minutos por asistencia, goles y orden alfabético.</li><li><b>Balón de Oro:</b> 5 por gol, 3 por asistencia, 2 por gol decisivo, 1,5 por gol de eliminación, 2 por gol en final, 0,5 por penal de tanda, 0,4 por victoria y 0,25 por aparición; resta 0,5 por amarilla y 2 por roja.</li><li><b>Guante de Oro:</b> 5 por valla invicta, 2 por victoria, 2 por tanda ganada y 0,35 por aparición; resta dos veces el promedio de goles recibidos.</li><li><b>Revelación:</b> jugador sin registro previo que alcance dos apariciones o produzca una contribución relevante.</li><li><b>Figura de la Final:</b> 6 por gol, 3,5 por asistencia, 1 por penal de tanda, 2 por integrar al campeón y 1,5 para el arquero ganador; resta 2 por roja.</li></ul><small>Cuando no existe participación individual completa del arquero, el sistema muestra una estimación basada en el rendimiento defensivo del equipo y la identifica como tal.</small></div></article></section>`;
}

function ensureRules() {
  const panel = document.querySelector('[data-cm-v523-admin-panel="rules"]');
  const base = panel?.querySelector('.cm-v523-rules');
  if (!panel || !base) return false;
  const extra = panel.querySelector('[data-cm-v525-rules]');
  if (!extra) base.insertAdjacentHTML('beforeend', rulesMarkup());
  return true;
}

function installLegacyBridge() {
  const target = window.ChuteStatsV52 && typeof window.ChuteStatsV52 === 'object' ? window.ChuteStatsV52 : {};
  target.fifaRows = (tournaments = sourceState().tournaments || []) => compute(tournaments, { source: sourceState(), includeFriendlies: true });
  window.ChuteStatsV52 = target;
}

function refresh() {
  refreshQueued = false;
  installLegacyBridge();
  ensureStatsPanel();
  ensureRules();
}

function scheduleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(refresh);
}

document.addEventListener('click', (event) => {
  const fifaTab = event.target.closest?.('[data-cm-v525-tab="fifa"]');
  if (fifaTab) {
    event.preventDefault();
    event.stopImmediatePropagation();
    activateFifa();
    document.querySelector('#cmV521History .cm-v521-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const otherStats = event.target.closest?.('#cmV521History [data-cm-v521-tab], #cmV521History [data-cm-v523-tab]');
  if (otherStats) deactivateFifa();
  const team = event.target.closest?.('[data-cm-v525-team]');
  if (team) {
    core.navigate?.('equipos');
    window.ChuteV59?.openTeamProfile?.(team.dataset.cmV525Team);
  }
  setTimeout(scheduleRefresh, 30);
}, true);

document.addEventListener('change', (event) => {
  if (event.target.closest?.('[data-cm-v521-filter]')) setTimeout(scheduleRefresh, 40);
}, true);

document.addEventListener('chute:ready', scheduleRefresh);
new MutationObserver(scheduleRefresh).observe(document.body, { childList: true, subtree: true });

loadStyles();
installLegacyBridge();
scheduleRefresh();

window.ChuteFifaV525 = Object.freeze({
  version: VERSION,
  baseRating: BASE_RATING,
  kFactor: K_FACTOR,
  friendlyFactor: FRIENDLY_FACTOR,
  podiumBonus: PODIUM_BONUS,
  expectedScore,
  stageMultiplier,
  goalDifferenceMultiplier,
  compute,
  rows: (tournaments = sourceState().tournaments || []) => compute(tournaments, { source: sourceState(), includeFriendlies: true }),
  order,
  refresh,
  activateFifa
});
