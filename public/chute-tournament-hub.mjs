function waitForCore() {
  if (window.ChuteMundoCore) return Promise.resolve(window.ChuteMundoCore);
  return new Promise((resolve) => document.addEventListener('chute:ready', (event) => resolve(event.detail), { once: true }));
}

const core = await waitForCore();
const model = window.ChuteDetailModel;
if (!model) throw new Error('El modelo detallado no está disponible para organizar los torneos.');

const { esc, logoUrl, photo, playerStatistics, ensureMatchEvents } = model;
const activeTabs = new Map();
const fixtureFilters = new Map();
let selectedTournamentId = null;
let hubSignature = '';
let catalogSignature = '';
let rendering = false;

function state() { return core.getState(); }
function played(match) { return core.matchPlayed(match); }
function resolvedHome(tournament, match) { return core.resolveHome(tournament, match); }
function resolvedAway(tournament, match) { return core.resolveAway(tournament, match); }
function matchEvents(tournament, match) { return ensureMatchEvents(match, resolvedHome(tournament, match), resolvedAway(tournament, match)); }
function statusLabel(status) { return ({ active: 'En disputa', upcoming: 'Próximo', historical: 'Finalizado' })[status] || 'Competencia'; }
function typeLabel(type) { return ({ league: 'Liga', league_playoff: 'Liga + Playoff', cup_groups: 'Copa con grupos', direct_knockout: 'Eliminación directa', division_final: 'División con final' })[type] || type || 'Torneo'; }

function referenceLabel(reference = '') {
  const labels = { GROUP_A_1: '1.º Grupo A', GROUP_A_2: '2.º Grupo A', GROUP_B_1: '1.º Grupo B', GROUP_B_2: '2.º Grupo B', TABLE_1: '1.º de la tabla', TABLE_2: '2.º de la tabla', TABLE_3: '3.º de la tabla', TABLE_4: '4.º de la tabla', S1_W: 'Ganador Semifinal 1', S2_W: 'Ganador Semifinal 2', S1_L: 'Perdedor Semifinal 1', S2_L: 'Perdedor Semifinal 2', QF1_W: 'Ganador Cuarto 1', QF2_W: 'Ganador Cuarto 2', QF3_W: 'Ganador Cuarto 3', QF4_W: 'Ganador Cuarto 4' };
  return labels[reference] || reference.replaceAll('_', ' ') || 'Por definir';
}

function side(tournament, match, key) {
  const teamId = key === 'home' ? resolvedHome(tournament, match) : resolvedAway(tournament, match);
  const reference = key === 'home' ? match.homeRef : match.awayRef;
  return { teamId, name: teamId ? core.teamName(teamId) : referenceLabel(reference) };
}

function scoreText(match) {
  if (!played(match)) return 'VS';
  const base = `${Number(match.homeGoals)} – ${Number(match.awayGoals)}`;
  const hasPens = match.homePens !== null && match.homePens !== undefined && match.awayPens !== null && match.awayPens !== undefined;
  return hasPens ? `${base} · pen. ${match.homePens}-${match.awayPens}` : base;
}

function parseDate(match) {
  if (!match?.date) return null;
  const source = /^\d{4}-\d{2}-\d{2}$/.test(String(match.date)) ? `${match.date}T${match.time || '00:00'}:00` : String(match.date);
  const date = new Date(source);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateLabel(match, compact = false) {
  const date = parseDate(match);
  const time = match?.time || '';
  if (!date) return [match?.date, time].filter(Boolean).join(' · ') || 'Fecha por definir';
  const formatted = new Intl.DateTimeFormat('es-CL', compact ? { day: '2-digit', month: 'short' } : { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(date).replaceAll('.', '');
  return `${formatted}${time ? ` · ${time}` : ''}`;
}

function allMatches(tournament) { return (tournament.matches || []).filter((match) => match.stage !== 'bye'); }
function progress(tournament) {
  const matches = allMatches(tournament);
  const complete = matches.filter(played).length;
  return { matches, played: complete, pending: matches.length - complete, percent: matches.length ? Math.round((complete / matches.length) * 100) : 0 };
}

function computeStandings(teamIds, matches) {
  const rows = Object.fromEntries(teamIds.map((teamId) => [teamId, { teamId, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 }]));
  for (const match of matches) {
    if (!played(match)) continue;
    const home = rows[match.home]; const away = rows[match.away];
    if (!home || !away) continue;
    const hg = Number(match.homeGoals); const ag = Number(match.awayGoals);
    home.pj += 1; away.pj += 1; home.gf += hg; home.gc += ag; away.gf += ag; away.gc += hg;
    if (hg > ag) { home.pg += 1; away.pp += 1; home.pts += 3; }
    else if (ag > hg) { away.pg += 1; home.pp += 1; away.pts += 3; }
    else { home.pe += 1; away.pe += 1; home.pts += 1; away.pts += 1; }
  }
  return Object.values(rows).map((row) => ({ ...row, dg: row.gf - row.gc })).sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.gc - b.gc || core.teamName(a.teamId).localeCompare(core.teamName(b.teamId), 'es')).map((row, index) => ({ ...row, pos: index + 1 }));
}

function standingsFor(tournament, group = null) {
  if (group) return computeStandings(group.teamIds, tournament.matches.filter((match) => match.stage === 'group' && match.group === group.name));
  if (tournament.manualStandings?.length) return [...tournament.manualStandings].sort((a, b) => a.pos - b.pos);
  return computeStandings(tournament.teamIds, tournament.matches.filter((match) => match.stage === 'regular'));
}

function resultForTeam(tournament, match, teamId) {
  if (!played(match)) return null;
  const home = resolvedHome(tournament, match); const away = resolvedAway(tournament, match);
  if (home !== teamId && away !== teamId) return null;
  const gf = home === teamId ? Number(match.homeGoals) : Number(match.awayGoals);
  const gc = home === teamId ? Number(match.awayGoals) : Number(match.homeGoals);
  return gf > gc ? 'G' : gf < gc ? 'P' : 'E';
}
function formForTeam(tournament, teamId) { return allMatches(tournament).filter((match) => played(match) && [resolvedHome(tournament, match), resolvedAway(tournament, match)].includes(teamId)).map((match) => resultForTeam(tournament, match, teamId)).filter(Boolean).slice(-5); }
function formMarkup(form) { return form.length ? `<span class="cm-form">${form.map((result) => `<i class="cm-form-${result.toLowerCase()}">${result}</i>`).join('')}</span>` : '<span class="cm-form-empty">—</span>'; }

function standingsMarkup(tournament, rows, highlight = 0, title = 'Tabla de posiciones') {
  return `<article class="cm-hub-table-card"><header><div><p class="eyebrow">CLASIFICACIÓN</p><h3>${esc(title)}</h3></div><span>${rows.length} equipos</span></header><div class="cm-hub-table-scroll"><table class="cm-hub-table"><thead><tr><th>Pos.</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>PTS</th><th>Forma</th></tr></thead><tbody>${rows.map((row, index) => `<tr class="${index < highlight ? 'cm-hub-qualified' : ''}"><td><b class="cm-hub-position">${row.pos || index + 1}</b></td><td><span class="cm-hub-team-cell"><img src="${esc(logoUrl(row.teamId))}" alt=""><strong>${esc(core.teamName(row.teamId))}</strong></span></td><td>${row.pj}</td><td>${row.pg}</td><td>${row.pe}</td><td>${row.pp}</td><td>${row.gf}</td><td>${row.gc}</td><td class="${row.dg > 0 ? 'positive' : row.dg < 0 ? 'negative' : ''}">${row.dg > 0 ? '+' : ''}${row.dg}</td><td><strong class="cm-hub-points">${row.pts}</strong></td><td>${formMarkup(formForTeam(tournament, row.teamId))}</td></tr>`).join('')}</tbody></table></div></article>`;
}

function tournamentPlayers(tournament) { return playerStatistics(core, [tournament]).filter((row) => row.goals || row.assists || row.yellows || row.reds); }
function rankingTable(tournament, field, label) {
  const rows = tournamentPlayers(tournament).filter((row) => row[field] > 0).sort((a, b) => b[field] - a[field] || b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name, 'es'));
  if (!rows.length) return `<article class="cm-hub-ranking-card"><header><p class="eyebrow">${esc(label.toUpperCase())}</p><h3>Sin registros</h3></header><p class="empty">Todavía no hay ${esc(label.toLowerCase())} registrados en este torneo.</p></article>`;
  return `<article class="cm-hub-ranking-card"><header><div><p class="eyebrow">${esc(label.toUpperCase())}</p><h3>Tabla de ${esc(label.toLowerCase())}</h3></div><span>${rows.length} jugadores</span></header><div class="cm-hub-ranking-list">${rows.map((row, index) => `<div class="cm-hub-ranking-row"><b class="cm-hub-rank">${index + 1}</b>${photo(row.teamId, row.name, 'cm-hub-player-face')}<div class="cm-hub-player-copy"><strong>${esc(row.name)}</strong><span><img src="${esc(logoUrl(row.teamId))}" alt="">${esc(core.teamName(row.teamId))}</span></div><div class="cm-hub-player-value"><b>${row[field]}</b><span>${field === 'goals' ? 'goles' : 'asist.'}</span></div><div class="cm-hub-player-extra">${row.appearances || 0} PJ · ${row.contributions} G+A</div></div>`).join('')}</div></article>`;
}

function matchEventPreview(tournament, match) {
  matchEvents(tournament, match);
  const events = [...(match.goals || []).map((goal) => ({ minute: goal.minute, text: `⚽ ${goal.playerName}${goal.assistName ? ` · ${goal.assistName}` : ''}` })), ...(match.cards || []).map((card) => ({ minute: card.minute, text: `${card.type === 'red' ? '🟥' : '🟨'} ${card.playerName}` })), ...(match.specialEvents || []).map((event) => ({ minute: event.minute, text: `✦ ${event.playerName || ''} ${event.note || ''}`.trim() }))].sort((a, b) => Number.parseInt(a.minute || '999', 10) - Number.parseInt(b.minute || '999', 10));
  if (!events.length) return '';
  return `<div class="cm-hub-event-preview">${events.slice(0, 4).map((event) => `<span><b>${esc(event.minute ? `${event.minute}'` : '—')}</b>${esc(event.text)}</span>`).join('')}${events.length > 4 ? `<small>+${events.length - 4} eventos</small>` : ''}</div>`;
}

function matchCard(tournament, match) {
  const home = side(tournament, match, 'home'); const away = side(tournament, match, 'away');
  matchEvents(tournament, match);
  const events = (match.goals?.length || 0) + (match.cards?.length || 0) + (match.specialEvents?.length || 0);
  return `<article class="cm-hub-match ${played(match) ? 'is-played' : 'is-pending'}"><header><span>${esc(match.group || match.round || 'Partido')}</span><small>${esc(match.label || '')}</small><em>${played(match) ? 'Finalizado' : 'Pendiente'}</em></header><div class="cm-hub-match-board"><div class="cm-hub-match-team">${home.teamId ? `<img src="${esc(logoUrl(home.teamId))}" alt="">` : '<span class="cm-hub-logo-placeholder"></span>'}<strong>${esc(home.name)}</strong></div><div class="cm-hub-match-score"><b>${esc(scoreText(match))}</b>${played(match) ? '<span>Resultado final</span>' : '<span>Por jugar</span>'}</div><div class="cm-hub-match-team away">${away.teamId ? `<img src="${esc(logoUrl(away.teamId))}" alt="">` : '<span class="cm-hub-logo-placeholder"></span>'}<strong>${esc(away.name)}</strong></div></div>${matchEventPreview(tournament, match)}<footer><span>◷ ${esc(dateLabel(match))}${match.venue ? ` · ${esc(match.venue)}` : ''}</span><span>${events} evento${events === 1 ? '' : 's'}</span><div><button type="button" data-cm-hub-match="${esc(tournament.id)}__${esc(match.id)}">Ver ficha</button>${played(match) ? `<button type="button" data-cm-share-match="${esc(tournament.id)}__${esc(match.id)}">Compartir</button>` : ''}</div></footer></article>`;
}

function fixtureGroupKey(match) { if (match.stage === 'group') return `${match.group || 'Grupos'} · ${match.round || 'Jornada'}`; if (match.stage === 'regular') return match.round || 'Fase regular'; return match.round || 'Fase final'; }
function fixtureMarkup(tournament) {
  const filter = fixtureFilters.get(tournament.id) || 'all';
  const visible = allMatches(tournament).filter((match) => filter === 'all' || (filter === 'played' ? played(match) : !played(match)));
  const groups = new Map();
  for (const match of visible) { const key = fixtureGroupKey(match); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(match); }
  return `<section class="cm-hub-fixture"><div class="cm-hub-filterbar" role="group" aria-label="Filtrar fixture">${[['all','Todos'],['pending','Pendientes'],['played','Jugados']].map(([value,label]) => `<button class="${filter === value ? 'active' : ''}" data-cm-fixture-filter="${value}">${label}<span>${value === 'all' ? allMatches(tournament).length : value === 'played' ? allMatches(tournament).filter(played).length : allMatches(tournament).filter((match) => !played(match)).length}</span></button>`).join('')}</div><div class="cm-hub-fixture-groups">${[...groups.entries()].map(([label, matches]) => `<section class="cm-hub-round"><header><h3>${esc(label)}</h3><span>${matches.length} partido${matches.length === 1 ? '' : 's'}</span></header><div class="cm-hub-match-grid">${matches.map((match) => matchCard(tournament, match)).join('')}</div></section>`).join('') || '<article class="cm-hub-empty">No hay partidos para este filtro.</article>'}</div></section>`;
}

function bracketSide(tournament, match, key) { const info = side(tournament, match, key); const value = key === 'home' ? match.homeGoals : match.awayGoals; return `<div class="cm-hub-bracket-side">${info.teamId ? `<img src="${esc(logoUrl(info.teamId))}" alt="">` : '<span></span>'}<strong>${esc(info.name)}</strong><b>${played(match) ? Number(value) : '—'}</b></div>`; }
function bracketMarkup(tournament) {
  const knockout = tournament.matches.filter((match) => match.stage === 'knockout');
  if (!knockout.length) return '<article class="cm-hub-empty">Este formato no tiene una fase de eliminación.</article>';
  const order = ['Octavos de Final', 'Cuartos de Final', 'Semifinales', '3er Lugar', 'Final'];
  const rounds = [...new Set(knockout.map((match) => match.round))].sort((a, b) => { const ai = order.indexOf(a); const bi = order.indexOf(b); return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi); });
  return `<section class="cm-hub-bracket"><div class="cm-hub-bracket-grid">${rounds.map((round) => `<div class="cm-hub-bracket-round ${round === 'Final' ? 'is-final' : ''}"><header><h3>${esc(round)}</h3><span>${knockout.filter((match) => match.round === round).length} cruce${knockout.filter((match) => match.round === round).length === 1 ? '' : 's'}</span></header>${knockout.filter((match) => match.round === round).map((match) => `<article class="cm-hub-bracket-game">${bracketSide(tournament, match, 'home')}${bracketSide(tournament, match, 'away')}<button data-cm-hub-match="${esc(tournament.id)}__${esc(match.id)}">Abrir partido</button></article>`).join('')}</div>`).join('')}</div></section>`;
}

function compactMatch(tournament, match, label) {
  if (!match) return `<article class="cm-hub-featured"><p class="eyebrow">${esc(label)}</p><h3>Sin partidos</h3><p>No hay encuentros disponibles.</p></article>`;
  const home = side(tournament, match, 'home'); const away = side(tournament, match, 'away');
  return `<article class="cm-hub-featured"><p class="eyebrow">${esc(label)}</p><div class="cm-hub-featured-board"><span>${home.teamId ? `<img src="${esc(logoUrl(home.teamId))}" alt="">` : ''}<strong>${esc(home.name)}</strong></span><b>${esc(scoreText(match))}</b><span>${away.teamId ? `<img src="${esc(logoUrl(away.teamId))}" alt="">` : ''}<strong>${esc(away.name)}</strong></span></div><p>${esc(match.group || match.round || 'Partido')} · ${esc(dateLabel(match))}</p><button data-cm-hub-match="${esc(tournament.id)}__${esc(match.id)}">Ver partido</button></article>`;
}

function summaryMarkup(tournament) {
  const tournamentProgress = progress(tournament); const complete = allMatches(tournament).filter(played); const pending = allMatches(tournament).filter((match) => !played(match));
  const next = [...pending].sort((a, b) => (parseDate(a)?.getTime() || Number.MAX_SAFE_INTEGER) - (parseDate(b)?.getTime() || Number.MAX_SAFE_INTEGER))[0] || null; const last = complete.at(-1) || null;
  const players = tournamentPlayers(tournament); const scorer = [...players].sort((a, b) => b.goals - a.goals || b.assists - a.assists)[0] || null; const assister = [...players].sort((a, b) => b.assists - a.assists || b.goals - a.goals)[0] || null;
  const goalCount = complete.reduce((sum, match) => sum + Number(match.homeGoals || 0) + Number(match.awayGoals || 0), 0);
  const podium = tournament.champion ? `<div class="cm-hub-podium"><span><b>2.º</b>${esc(core.teamName(tournament.runnerUp))}</span><span class="champion"><b>1.º</b>${esc(core.teamName(tournament.champion))}</span><span><b>3.º</b>${esc(core.teamName(tournament.third))}</span></div>` : '';
  const notes = tournament.notes?.length ? `<div class="cm-hub-notes">${tournament.notes.map((note) => `<p>${esc(note)}</p>`).join('')}</div>` : '';
  return `<section class="cm-hub-summary"><div class="cm-hub-summary-kpis"><article><b>${tournamentProgress.played}/${tournamentProgress.matches.length}</b><span>Partidos jugados</span></article><article><b>${goalCount}</b><span>Goles registrados</span></article><article><b>${tournamentProgress.pending}</b><span>Partidos pendientes</span></article><article><b>${tournamentProgress.percent}%</b><span>Avance del torneo</span></article></div><div class="cm-hub-summary-grid">${compactMatch(tournament, next, 'PRÓXIMO PARTIDO')}${compactMatch(tournament, last, 'ÚLTIMO RESULTADO')}</div><div class="cm-hub-leaders"><article>${scorer ? `${photo(scorer.teamId, scorer.name, 'cm-hub-leader-face')}<div><p class="eyebrow">GOLEADOR</p><h3>${esc(scorer.name)}</h3><span>${esc(core.teamName(scorer.teamId))}</span><b>${scorer.goals} goles</b></div>` : '<p class="empty">Sin goleadores registrados.</p>'}</article><article>${assister ? `${photo(assister.teamId, assister.name, 'cm-hub-leader-face')}<div><p class="eyebrow">ASISTIDOR</p><h3>${esc(assister.name)}</h3><span>${esc(core.teamName(assister.teamId))}</span><b>${assister.assists} asistencias</b></div>` : '<p class="empty">Sin asistencias registradas.</p>'}</article></div>${podium}${notes}</section>`;
}

function tablesMarkup(tournament) { if (tournament.groups?.length) return `<section class="cm-hub-tables">${tournament.groups.map((group) => standingsMarkup(tournament, standingsFor(tournament, group), 2, group.name)).join('')}<p class="cm-hub-legend"><span></span> Zona de clasificación a semifinales</p></section>`; const highlight = tournament.type === 'league_playoff' ? 4 : tournament.type === 'division_final' ? 2 : 0; return `<section class="cm-hub-tables">${standingsMarkup(tournament, standingsFor(tournament), highlight)}${highlight ? '<p class="cm-hub-legend"><span></span> Zona de clasificación</p>' : ''}</section>`; }
function statsMarkup(tournament) { return `<section class="cm-hub-stats">${rankingTable(tournament, 'goals', 'Goleadores')}${rankingTable(tournament, 'assists', 'Asistidores')}</section>`; }
function tabsFor(tournament) { return [['summary','Resumen'],['table',tournament.groups?.length ? 'Grupos y tablas' : 'Tabla'],['fixture','Fixture'],['bracket','Llave'],['stats','Goleadores y asistidores']]; }
function hubMarkup(tournament) { const active = activeTabs.get(tournament.id) || 'summary'; const tabs = tabsFor(tournament); return `<section id="cmTournamentHub" class="cm-tournament-hub" data-tournament-id="${esc(tournament.id)}"><div class="cm-hub-heading"><div><p class="eyebrow">CENTRO DEL TORNEO</p><h2>Información ordenada por sección</h2><p>Consulta la tabla, el fixture, la fase final y los líderes sin recorrer toda la página.</p></div><span class="cm-hub-status ${esc(tournament.status)}">${esc(statusLabel(tournament.status))}</span></div><nav class="cm-hub-tabs" aria-label="Secciones del torneo">${tabs.map(([id,label]) => `<button class="${active === id ? 'active' : ''}" data-cm-tournament-tab="${id}">${esc(label)}</button>`).join('')}</nav><div class="cm-hub-panels"><section class="cm-hub-panel ${active === 'summary' ? 'active' : ''}" data-cm-tournament-panel="summary">${summaryMarkup(tournament)}</section><section class="cm-hub-panel ${active === 'table' ? 'active' : ''}" data-cm-tournament-panel="table">${tablesMarkup(tournament)}</section><section class="cm-hub-panel ${active === 'fixture' ? 'active' : ''}" data-cm-tournament-panel="fixture">${fixtureMarkup(tournament)}</section><section class="cm-hub-panel ${active === 'bracket' ? 'active' : ''}" data-cm-tournament-panel="bracket">${bracketMarkup(tournament)}</section><section class="cm-hub-panel ${active === 'stats' ? 'active' : ''}" data-cm-tournament-panel="stats">${statsMarkup(tournament)}</section></div></section>`; }

function selectedTournament(root) { if (selectedTournamentId) { const selected = state().tournaments.find((tournament) => tournament.id === selectedTournamentId); if (selected) return selected; } const title = root.querySelector('.tournament-head h2')?.textContent?.trim() || root.querySelector('#cmPremiumTournamentHero h2')?.textContent?.trim(); return state().tournaments.find((tournament) => tournament.name === title) || null; }
function detailSignature(tournament) { return JSON.stringify({ id: tournament.id, status: tournament.status, champion: tournament.champion, runnerUp: tournament.runnerUp, third: tournament.third, groups: tournament.groups, matches: allMatches(tournament).map((match) => [match.id, match.home, match.away, match.homeRef, match.awayRef, match.homeGoals, match.awayGoals, match.homePens, match.awayPens, match.date, match.time, match.venue, match.notes, match.goals?.map((goal) => [goal.playerName, goal.assistName, goal.minute]), match.cards?.map((card) => [card.playerName, card.type, card.minute])]) }); }
function enhanceTournament() { const root = document.getElementById('tournamentDetail'); if (!root || !root.children.length) return; const tournament = selectedTournament(root); if (!tournament) return; selectedTournamentId = tournament.id; const signature = detailSignature(tournament); let hub = document.getElementById('cmTournamentHub'); if (signature !== hubSignature || !hub || hub.dataset.tournamentId !== tournament.id) { hubSignature = signature; hub?.remove(); const hero = root.querySelector('#cmPremiumTournamentHero'); if (hero) hero.insertAdjacentHTML('afterend', hubMarkup(tournament)); else root.insertAdjacentHTML('afterbegin', hubMarkup(tournament)); hub = document.getElementById('cmTournamentHub'); } [...root.children].forEach((child) => { const keep = child.id === 'cmPremiumTournamentHero' || child.id === 'cmTournamentHub'; child.classList.toggle('cm-hub-source-hidden', !keep); }); }

function catalogSort(tournaments) { const priority = { active: 0, upcoming: 1, historical: 2 }; return tournaments.map((tournament, index) => ({ tournament, index })).sort((a, b) => (priority[a.tournament.status] ?? 9) - (priority[b.tournament.status] ?? 9) || b.index - a.index).map(({ tournament }) => tournament); }
function catalogCard(tournament) { const tournamentProgress = progress(tournament); const logos = tournament.teamIds.slice(0, 7).map((teamId) => `<img src="${esc(logoUrl(teamId))}" alt="${esc(core.teamName(teamId))}">`).join(''); return `<article class="cm-tournament-catalog-card"><div class="cm-tournament-card-top"><span class="cm-hub-status ${esc(tournament.status)}">${esc(statusLabel(tournament.status))}</span><small>${esc(typeLabel(tournament.type))}</small></div><h3>${esc(tournament.name)}</h3><p>${tournament.teamIds.length} equipos · ${tournamentProgress.played}/${tournamentProgress.matches.length} partidos</p><div class="cm-tournament-card-logos">${logos}</div><div class="cm-tournament-card-progress"><span style="width:${tournamentProgress.percent}%"></span></div><footer><div><b>${tournamentProgress.percent}%</b><span>${tournament.champion ? `Campeón: ${esc(core.teamName(tournament.champion))}` : `${tournamentProgress.pending} pendientes`}</span></div><button data-open-tournament="${esc(tournament.id)}">Abrir torneo</button></footer></article>`; }
function renderCatalog() { const root = document.getElementById('tournamentList'); const filter = document.getElementById('tournamentStatusFilter')?.value || 'all'; if (!root) return; const tournaments = catalogSort(state().tournaments.filter((tournament) => filter === 'all' || tournament.status === filter)); const signature = JSON.stringify({ filter, rows: tournaments.map((tournament) => [tournament.id, tournament.status, tournament.champion, progress(tournament).played, progress(tournament).pending]) }); if (signature === catalogSignature && root.querySelector('.cm-tournament-catalog')) return; catalogSignature = signature; root.innerHTML = tournaments.length ? `<div class="cm-tournament-catalog">${tournaments.map(catalogCard).join('')}</div>` : '<p class="empty">No hay torneos para este filtro.</p>'; }
function switchTab(tab) { const hub = document.getElementById('cmTournamentHub'); const tournamentId = hub?.dataset.tournamentId; if (!hub || !tournamentId) return; activeTabs.set(tournamentId, tab); hub.querySelectorAll('[data-cm-tournament-tab]').forEach((button) => button.classList.toggle('active', button.dataset.cmTournamentTab === tab)); hub.querySelectorAll('[data-cm-tournament-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.cmTournamentPanel === tab)); }
function findMatch(pair) { const [tournamentId, matchId] = pair.split('__'); const tournament = state().tournaments.find((item) => item.id === tournamentId); const match = tournament?.matches.find((item) => item.id === matchId); return { tournament, match }; }
async function shareMatch(pair) { const { tournament, match } = findMatch(pair); if (!tournament || !match) return; const home = side(tournament, match, 'home'); const away = side(tournament, match, 'away'); const text = [`CHUTE MUNDO · ${tournament.name}`, `${home.name} ${scoreText(match)} ${away.name}`, `${match.group || match.round || 'Partido'} · ${dateLabel(match)}`, match.notes || ''].filter(Boolean).join('\n'); try { if (navigator.share) await navigator.share({ title: `${home.name} vs. ${away.name}`, text }); else { await navigator.clipboard.writeText(text); core.showToast('Resultado copiado para compartir.'); } } catch (error) { if (error?.name !== 'AbortError') core.showToast('No se pudo compartir el resultado.'); } }
function refresh() { if (rendering) return; rendering = true; try { renderCatalog(); enhanceTournament(); } catch (error) { console.error('No se pudo organizar la vista de torneos.', error); } finally { rendering = false; } }

document.addEventListener('click', (event) => { const openTournament = event.target.closest('[data-open-tournament]'); if (openTournament) { selectedTournamentId = openTournament.dataset.openTournament; hubSignature = ''; } const tab = event.target.closest('[data-cm-tournament-tab]'); if (tab) switchTab(tab.dataset.cmTournamentTab); const filter = event.target.closest('[data-cm-fixture-filter]'); if (filter) { const hub = document.getElementById('cmTournamentHub'); if (hub?.dataset.tournamentId) { fixtureFilters.set(hub.dataset.tournamentId, filter.dataset.cmFixtureFilter); hubSignature = ''; refresh(); switchTab('fixture'); } } const matchButton = event.target.closest('[data-cm-hub-match]'); if (matchButton) { const { tournament, match } = findMatch(matchButton.dataset.cmHubMatch); if (tournament && match) window.ChuteDetailEvents?.openDetailedMatch?.(tournament.id, match.id); } const shareButton = event.target.closest('[data-cm-share-match]'); if (shareButton) shareMatch(shareButton.dataset.cmShareMatch); window.setTimeout(refresh, 0); });
document.addEventListener('change', () => window.setTimeout(refresh, 0));
document.addEventListener('submit', () => window.setTimeout(() => { hubSignature = ''; catalogSignature = ''; refresh(); }, 250));
refresh();
window.setInterval(refresh, 900);
window.ChuteTournamentHub = { refresh, switchTab };
