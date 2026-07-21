function waitForCore() {
  if (window.ChuteMundoCore) return Promise.resolve(window.ChuteMundoCore);
  return new Promise((resolve) => document.addEventListener('chute:ready', (event) => resolve(event.detail), { once: true }));
}

const core = await waitForCore();
const model = window.ChuteDetailModel;
const statsApi = window.ChuteV516EventsStats;
if (!model || !statsApi) throw new Error('Chute Mundo v5.17 requiere el modelo detallado y las estadísticas v5.16.');

const VERSION = '5.17.0';
const clone = (value) => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const esc = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const normalize = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/[^a-z0-9]+/g, ' ').trim();
const playerName = (entry) => Array.isArray(entry) ? String(entry[0] || '') : String(entry?.name || '');
const playerPosition = (entry) => Array.isArray(entry) ? String(entry[1] || '') : String(entry?.position || entry?.role || '');
const played = (match) => core.matchPlayed(match);
const minuteNumber = (value) => Math.max(0, Number.parseInt(String(value ?? '0'), 10) || 0);
let refreshQueued = false;
let savingAwards = false;

function tournamentFromHub(source = core.getState()) {
  const id = document.getElementById('cmTournamentHub')?.dataset.tournamentId || '';
  return source.tournaments?.find((item) => item.id === id) || null;
}

function teamById(teamId, source = core.getState()) {
  return source.teams?.find((team) => team.id === teamId) || null;
}

function rosterEntry(teamId, name, source = core.getState()) {
  return teamById(teamId, source)?.players?.find((entry) => playerName(entry) === name) || null;
}

function matchContext(tournament, match) {
  const home = match.home || core.resolveHome(tournament, match);
  const away = match.away || core.resolveAway(tournament, match);
  return home && away ? { tournament, match, home, away, pair: `${tournament.id}__${match.id}` } : null;
}

function penaltyScore(match) {
  const attempts = Array.isArray(match.penaltyShootout) ? match.penaltyShootout : [];
  const recordedHome = match.homePens !== null && match.homePens !== undefined && match.homePens !== '' ? Number(match.homePens) : null;
  const recordedAway = match.awayPens !== null && match.awayPens !== undefined && match.awayPens !== '' ? Number(match.awayPens) : null;
  const home = recordedHome ?? attempts.filter((item) => item.side === 'home' && item.result === 'scored').length;
  const away = recordedAway ?? attempts.filter((item) => item.side === 'away' && item.result === 'scored').length;
  const active = Boolean(match.shootoutStarted || attempts.length || recordedHome !== null || recordedAway !== null);
  return { home, away, active, attempts };
}

function resultInfo(tournament, match) {
  const context = matchContext(tournament, match);
  if (!context || !played(match)) return null;
  const homeGoals = Number(match.homeGoals || 0);
  const awayGoals = Number(match.awayGoals || 0);
  const penalties = penaltyScore(match);
  let winner = null;
  let decidedByPenalties = false;
  if (homeGoals > awayGoals) winner = context.home;
  else if (awayGoals > homeGoals) winner = context.away;
  else if (penalties.active && penalties.home !== penalties.away) {
    winner = penalties.home > penalties.away ? context.home : context.away;
    decidedByPenalties = true;
  }
  return {
    ...context,
    homeGoals,
    awayGoals,
    homePens: penalties.home,
    awayPens: penalties.away,
    winner,
    decidedByPenalties,
    score: `${homeGoals}–${awayGoals}`,
    completeScore: decidedByPenalties ? `${homeGoals}–${awayGoals} · pen. ${penalties.home}–${penalties.away}` : `${homeGoals}–${awayGoals}`
  };
}

function eventTeamId(event, context) {
  return event.teamId || (event.side === 'away' ? context.away : context.home);
}

function appearedInMatch(match, side, name) {
  if (match.participationTracked) {
    const lineup = match.lineups?.[side];
    if (lineup?.starters?.includes(name)) return true;
    if ((lineup?.changes || []).some((change) => change.playerIn === name)) return true;
  }
  return (match.goals || []).some((event) => event.playerName === name || event.assistName === name)
    || (match.cards || []).some((event) => event.playerName === name)
    || (match.penaltyShootout || []).some((event) => event.playerName === name);
}

function legacyValue(rows, teamId, name, kind) {
  let value = 0;
  for (const row of rows || []) {
    if (Array.isArray(row)) {
      const [rowName, rowTeam, , amount] = row;
      if (rowName === name && (!rowTeam || rowTeam === teamId)) value = Math.max(value, Number(amount || 0));
    } else if (row && typeof row === 'object') {
      const rowName = row.name || row.playerName || row.player;
      const rowTeam = row.teamId || row.team;
      const amount = row.value ?? row[kind] ?? row.total ?? 0;
      if (rowName === name && (!rowTeam || rowTeam === teamId)) value = Math.max(value, Number(amount || 0));
    }
  }
  return value;
}

function hasPriorRecord(source, tournament, teamId, name) {
  const currentIndex = source.tournaments?.findIndex((item) => item.id === tournament.id) ?? -1;
  const earlier = currentIndex >= 0 ? source.tournaments.slice(0, currentIndex) : (source.tournaments || []).filter((item) => item.id !== tournament.id);
  return earlier.some((item) => {
    if (legacyValue(item.playerScorers, teamId, name, 'goals') || legacyValue(item.playerAssists, teamId, name, 'assists')) return true;
    return (item.matches || []).some((match) => {
      const context = matchContext(item, match);
      if (!context) return false;
      const side = context.home === teamId ? 'home' : context.away === teamId ? 'away' : null;
      return Boolean(side && appearedInMatch(match, side, name));
    });
  });
}

function buildPlayerRows(tournament, source = core.getState()) {
  const rows = [];
  const matches = (tournament.matches || []).filter((match) => match.stage !== 'bye' && played(match));
  const teamFallback = new Map();
  for (const teamId of tournament.teamIds || []) {
    const teamMatches = matches.map((match) => resultInfo(tournament, match)).filter((info) => info && [info.home, info.away].includes(teamId));
    const fallback = { appearances: teamMatches.length, goalsConceded: 0, cleanSheets: 0, wins: 0, draws: 0, losses: 0, shootoutWins: 0 };
    for (const info of teamMatches) {
      const conceded = info.home === teamId ? info.awayGoals : info.homeGoals;
      fallback.goalsConceded += conceded;
      if (conceded === 0) fallback.cleanSheets += 1;
      if (info.winner === teamId) {
        fallback.wins += 1;
        if (info.decidedByPenalties) fallback.shootoutWins += 1;
      } else if (info.winner) fallback.losses += 1;
      else fallback.draws += 1;
    }
    teamFallback.set(teamId, fallback);
  }

  for (const teamId of tournament.teamIds || []) {
    const team = teamById(teamId, source);
    for (const entry of team?.players || []) {
      const name = playerName(entry);
      if (!name) continue;
      const base = statsApi.playerStats(teamId, name, source, tournament.id);
      const row = {
        ...base,
        team,
        teamId,
        name,
        position: playerPosition(entry) || base.position || 'Jugador',
        goalkeeper: normalize(playerPosition(entry)).includes('arquero') || normalize(playerPosition(entry)).includes('portero'),
        decisiveGoals: 0,
        knockoutGoals: 0,
        finalGoals: 0,
        finalAssists: 0,
        shootoutWins: 0,
        teamWins: 0,
        eventAppearances: new Set(),
        finalAppearance: false,
        finalWinner: false,
        finalPenaltyScored: 0,
        priorRecord: hasPriorRecord(source, tournament, teamId, name)
      };
      row.goals = Math.max(row.goals, legacyValue(tournament.playerScorers, teamId, name, 'goals'));
      row.assists = Math.max(row.assists, legacyValue(tournament.playerAssists, teamId, name, 'assists'));

      for (const match of matches) {
        const info = resultInfo(tournament, match);
        if (!info || ![info.home, info.away].includes(teamId)) continue;
        const side = info.home === teamId ? 'home' : 'away';
        const isFinal = normalize(match.round) === 'final' || normalize(match.label) === 'final';
        const isKnockout = match.stage === 'knockout';
        const appeared = appearedInMatch(match, side, name);
        if (appeared) row.eventAppearances.add(match.id);
        if (appeared && info.winner === teamId) row.teamWins += 1;
        if (isFinal && appeared) {
          row.finalAppearance = true;
          row.finalWinner = info.winner === teamId;
        }

        const teamGoals = (match.goals || [])
          .filter((event) => eventTeamId(event, info) === teamId)
          .sort((a, b) => minuteNumber(a.minute) - minuteNumber(b.minute) || Number(a.createdAt || 0) - Number(b.createdAt || 0));
        const opponentGoals = info.home === teamId ? info.awayGoals : info.homeGoals;
        const winnerOrdinal = info.winner === teamId && !info.decidedByPenalties ? opponentGoals + 1 : -1;
        teamGoals.forEach((event, index) => {
          if (event.playerName === name) {
            if (isKnockout) row.knockoutGoals += 1;
            if (isFinal) row.finalGoals += 1;
            if (index + 1 === winnerOrdinal) row.decisiveGoals += 1;
          }
          if (isFinal && event.assistName === name) row.finalAssists += 1;
        });
        for (const penalty of match.penaltyShootout || []) {
          if (penalty.teamId === teamId && penalty.playerName === name && penalty.result === 'scored' && isFinal) row.finalPenaltyScored += 1;
        }
        if (row.goalkeeper && info.decidedByPenalties && info.winner === teamId) row.shootoutWins += 1;
      }

      row.appearancesForAwards = Math.max(row.appearances, row.eventAppearances.size);
      row.contributions = row.goals + row.assists;
      row.mvpScore = row.goals * 5 + row.assists * 3 + row.decisiveGoals * 2 + row.knockoutGoals * 1.5 + row.finalGoals * 2
        + row.penaltiesScored * 0.5 + row.teamWins * 0.4 + row.appearancesForAwards * 0.25 + Math.min(Number(row.minutes || 0) / 360, 2)
        - row.yellows * 0.5 - row.reds * 2;

      const fallback = teamFallback.get(teamId) || { appearances: 0, goalsConceded: 0, cleanSheets: 0, wins: 0, draws: 0, losses: 0, shootoutWins: 0 };
      row.keeperEstimated = row.goalkeeper && !row.appearances && fallback.appearances > 0;
      row.keeperAppearances = row.appearances || fallback.appearances;
      row.keeperGoalsConceded = row.appearances ? row.goalsConceded : fallback.goalsConceded;
      row.keeperCleanSheets = row.appearances ? row.cleanSheets : fallback.cleanSheets;
      row.keeperWins = row.appearances ? row.wins : fallback.wins;
      row.keeperDraws = row.appearances ? row.draws : fallback.draws;
      row.keeperLosses = row.appearances ? row.losses : fallback.losses;
      row.keeperShootoutWins = row.shootoutWins || fallback.shootoutWins;
      row.keeperAverage = row.keeperAppearances ? row.keeperGoalsConceded / row.keeperAppearances : 99;
      row.keeperScore = row.keeperCleanSheets * 5 + row.keeperWins * 2 + row.keeperShootoutWins * 2 + row.keeperAppearances * 0.35 - row.keeperAverage * 2;
      row.finalScore = row.finalGoals * 6 + row.finalAssists * 3.5 + row.finalPenaltyScored + (row.finalWinner && row.finalAppearance ? 2 : 0)
        + (row.goalkeeper && row.finalAppearance && row.finalWinner ? 1.5 : 0) - row.reds * 2;
      rows.push(row);
    }
  }
  return rows;
}

function pick(rows, compare) {
  return [...rows].sort(compare)[0] || null;
}

function awardEntry(key, title, row, reason, status = '') {
  if (!row) return { key, title, playerName: '', teamId: '', teamName: '', reason: status || 'Aún sin datos suficientes.', status: 'pending' };
  return { key, title, playerName: row.name, teamId: row.teamId, teamName: row.team?.name || core.teamName(row.teamId), reason, status: 'ready' };
}

function computeAwards(tournament, source = core.getState()) {
  const rows = buildPlayerRows(tournament, source);
  const completed = (tournament.matches || []).filter((match) => match.stage !== 'bye').every(played);
  const official = tournament.status === 'historical' && completed;
  const scorer = pick(rows.filter((row) => row.goals > 0), (a, b) => b.goals - a.goals || (a.minutes && b.minutes ? (a.minutes / a.goals) - (b.minutes / b.goals) : 0) || b.assists - a.assists || b.decisiveGoals - a.decisiveGoals || a.name.localeCompare(b.name, 'es'));
  const assister = pick(rows.filter((row) => row.assists > 0), (a, b) => b.assists - a.assists || (a.minutes && b.minutes ? (a.minutes / a.assists) - (b.minutes / b.assists) : 0) || b.goals - a.goals || a.name.localeCompare(b.name, 'es'));
  const mvp = pick(rows.filter((row) => row.appearancesForAwards || row.goals || row.assists || row.penaltyAttempts), (a, b) => b.mvpScore - a.mvpScore || b.contributions - a.contributions || b.goals - a.goals || a.name.localeCompare(b.name, 'es'));
  const goalkeeper = pick(rows.filter((row) => row.goalkeeper && row.keeperAppearances), (a, b) => b.keeperScore - a.keeperScore || b.keeperCleanSheets - a.keeperCleanSheets || a.keeperAverage - b.keeperAverage || a.name.localeCompare(b.name, 'es'));
  const revelation = pick(rows.filter((row) => !row.priorRecord && (row.appearancesForAwards >= 2 || row.contributions || row.penaltyAttempts)), (a, b) => b.mvpScore - a.mvpScore || b.contributions - a.contributions || b.appearancesForAwards - a.appearancesForAwards || a.name.localeCompare(b.name, 'es'));
  const finalMatch = (tournament.matches || []).find((match) => match.stage === 'knockout' && (normalize(match.round) === 'final' || normalize(match.label) === 'final'));
  const finalPlayed = Boolean(finalMatch && played(finalMatch));
  const finalMvp = finalPlayed ? pick(rows.filter((row) => row.finalAppearance || row.finalGoals || row.finalAssists || row.finalPenaltyScored), (a, b) => b.finalScore - a.finalScore || b.finalGoals - a.finalGoals || b.finalAssists - a.finalAssists || a.name.localeCompare(b.name, 'es')) : null;

  const awards = {
    scorer: awardEntry('scorer', 'Goleador', scorer, scorer ? `${scorer.goals} goles · ${scorer.assists} asistencias · ${scorer.decisiveGoals} goles decisivos${scorer.minutes ? ` · ${scorer.minutes} minutos` : ''}` : ''),
    assist: awardEntry('assist', 'Máximo asistidor', assister, assister ? `${assister.assists} asistencias · ${assister.goals} goles · ${assister.contributions} participaciones de gol${assister.minutes ? ` · ${assister.minutes} minutos` : ''}` : ''),
    mvp: awardEntry('mvp', 'Mejor jugador', mvp, mvp ? `${mvp.mvpScore.toFixed(1)} puntos de rendimiento · ${mvp.goals} G · ${mvp.assists} A · ${mvp.decisiveGoals} decisivos · ${mvp.appearancesForAwards} PJ${mvp.minutes ? ` · ${mvp.minutes} min.` : ''}` : ''),
    goalkeeper: awardEntry('goalkeeper', 'Mejor arquero', goalkeeper, goalkeeper ? `${goalkeeper.keeperCleanSheets} vallas invictas · ${goalkeeper.keeperGoalsConceded} goles recibidos · promedio ${goalkeeper.keeperAverage.toFixed(2)} · ${goalkeeper.keeperWins}-${goalkeeper.keeperDraws}-${goalkeeper.keeperLosses}${goalkeeper.keeperShootoutWins ? ` · ${goalkeeper.keeperShootoutWins} tanda${goalkeeper.keeperShootoutWins === 1 ? '' : 's'} ganada${goalkeeper.keeperShootoutWins === 1 ? '' : 's'}` : ''}${goalkeeper.keeperEstimated ? ' · estimación defensiva del equipo' : ''}` : ''),
    revelation: awardEntry('revelation', 'Revelación', revelation, revelation ? `Primer registro relevante en la historia · ${revelation.appearancesForAwards} PJ · ${revelation.goals} G · ${revelation.assists} A · ${revelation.penaltiesScored} penales anotados` : '', 'Se calculará cuando un jugador nuevo alcance participación suficiente.'),
    finalMvp: awardEntry('finalMvp', 'Jugador de la final', finalMvp, finalMvp ? `${finalMvp.finalScore.toFixed(1)} puntos en la final · ${finalMvp.finalGoals} G · ${finalMvp.finalAssists} A${finalMvp.finalPenaltyScored ? ` · ${finalMvp.finalPenaltyScored} penal de tanda` : ''}${finalMvp.finalWinner ? ' · campeón' : ''}` : '', finalPlayed ? 'La final no tiene suficientes eventos individuales.' : 'Disponible después de disputar la final.')
  };

  return { version: VERSION, official, completed, statusLabel: official ? 'OFICIALES' : 'PROVISIONALES', calculatedAt: Date.now(), awards, rows };
}

function legacyAwards(calculation) {
  return Object.fromEntries(Object.entries(calculation.awards).map(([key, award]) => [key, award.playerName || '']));
}

function awardsSignature(calculation) {
  return JSON.stringify(Object.values(calculation.awards).map((award) => [award.key, award.playerName, award.teamId, award.reason]));
}

function awardCard(award, highlighted = false) {
  const empty = !award.playerName;
  return `<article class="cm-v517-award-card ${highlighted ? 'is-featured' : ''} ${empty ? 'is-empty' : ''}">
    <header><span>${esc(award.title)}</span><em>${empty ? 'PENDIENTE' : 'CALCULADO'}</em></header>
    <div class="cm-v517-award-main">${empty ? '<div class="cm-v517-award-placeholder">?</div>' : model.photo(award.teamId, award.playerName, 'cm-v517-award-face')}<div><h3>${esc(award.playerName || 'Aún sin datos suficientes')}</h3><p>${esc(award.teamName || 'La información se completará con los partidos registrados.')}</p></div></div>
    <footer>${esc(award.reason)}</footer>
  </article>`;
}

function renderAwardsPanel() {
  const hub = document.getElementById('cmTournamentHub');
  const tournament = tournamentFromHub();
  if (!hub || !tournament) return;
  const tabs = hub.querySelector('.cm-hub-tabs');
  const panels = hub.querySelector('.cm-hub-panels');
  if (!tabs || !panels) return;
  let button = tabs.querySelector('[data-v512-awards-tab]');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.dataset.v512AwardsTab = '';
    button.textContent = 'Premios';
    tabs.appendChild(button);
  }
  button.dataset.cmV517AwardsTab = '';
  let panel = panels.querySelector('[data-v512-awards-panel]');
  if (!panel) {
    panel = document.createElement('section');
    panel.className = 'cm-hub-panel';
    panel.dataset.v512AwardsPanel = '';
    panels.appendChild(panel);
  }
  panel.dataset.cmV517AwardsPanel = '';
  const calculation = computeAwards(tournament);
  const signature = JSON.stringify([tournament.id, tournament.status, awardsSignature(calculation), core.canEdit()]);
  if (panel.dataset.cmV517Signature !== signature) {
    panel.dataset.cmV517Signature = signature;
    panel.dataset.sig = JSON.stringify([tournament.id, tournament.awards, core.canEdit()]);
    const quality = qualityIssues(tournament, calculation);
    panel.innerHTML = `<section class="cm-v517-awards">
      <header class="cm-v517-awards-head"><div><p class="eyebrow">RECONOCIMIENTOS ${calculation.statusLabel}</p><h2>Premios del torneo</h2><p>Se calculan desde goles, asistencias, participación, rendimiento decisivo, disciplina, porteros y tandas de Play-Off.</p></div><span>${calculation.official ? 'Cerrados al finalizar' : 'Se actualizan con cada partido'}</span></header>
      <div class="cm-v517-awards-grid">${awardCard(calculation.awards.mvp, true)}${awardCard(calculation.awards.scorer)}${awardCard(calculation.awards.assist)}${awardCard(calculation.awards.goalkeeper)}${awardCard(calculation.awards.revelation)}${awardCard(calculation.awards.finalMvp)}</div>
      <aside class="cm-v517-quality-summary"><div><b>${quality.filter((item) => item.level === 'critical').length}</b><span>bloqueos</span></div><div><b>${quality.filter((item) => item.level === 'warning').length}</b><span>advertencias</span></div><button type="button" data-cm-v517-quality>Revisar torneo antes de finalizar</button></aside>
    </section>`;
  }
  syncAwardsVisibility();
  if (calculation.official) scheduleOfficialAwards(tournament.id, calculation);
}

function syncAwardsVisibility() {
  const hub = document.getElementById('cmTournamentHub');
  if (!hub) return;
  const button = hub.querySelector('[data-cm-v517-awards-tab]');
  const panel = hub.querySelector('[data-cm-v517-awards-panel]');
  if (!button || !panel) return;
  const nativeActive = hub.querySelector('.cm-hub-tabs button.active:not([data-cm-v517-awards-tab])');
  if (nativeActive) {
    button.classList.remove('active');
    panel.classList.remove('active');
  }
  const active = button.classList.contains('active') && !nativeActive;
  panel.hidden = !active;
  panel.style.display = active ? 'block' : 'none';
  panel.setAttribute('aria-hidden', active ? 'false' : 'true');
}

function showAwards() {
  const hub = document.getElementById('cmTournamentHub');
  if (!hub) return;
  const button = hub.querySelector('[data-cm-v517-awards-tab]');
  const panel = hub.querySelector('[data-cm-v517-awards-panel]');
  hub.querySelectorAll('.cm-hub-tabs button').forEach((item) => item.classList.toggle('active', item === button));
  hub.querySelectorAll('.cm-hub-panel').forEach((item) => item.classList.toggle('active', item === panel));
  if (panel) { panel.hidden = false; panel.style.display = 'block'; panel.setAttribute('aria-hidden', 'false'); }
}

function pairFromElement(element) {
  const candidates = [
    element?.dataset?.cmHubMatch,
    element?.dataset?.cmV591Live,
    element?.dataset?.cmV510Live,
    element?.dataset?.cmV59LivePair,
    element?.dataset?.editMatch,
    element?.closest?.('[data-cm-v59-live-pair]')?.dataset?.cmV59LivePair
  ];
  return candidates.find((value) => String(value || '').includes('__')) || '';
}

function contextFromPair(pair, source = core.getState()) {
  const [tournamentId, matchId] = String(pair || '').split('__');
  const tournament = source.tournaments?.find((item) => item.id === tournamentId);
  const match = tournament?.matches?.find((item) => item.id === matchId);
  return tournament && match ? resultInfo(tournament, match) : null;
}

function penaltyBadge(info, compact = false) {
  return `<div class="cm-v517-penalty-result ${compact ? 'is-compact' : ''}"><span>Definido por penales</span><b>${info.homePens}–${info.awayPens}</b><small>Gana ${esc(core.teamName(info.winner))}</small></div>`;
}

function decoratePenaltyResults() {
  document.querySelectorAll('.cm-v517-penalty-result').forEach((item) => item.remove());
  const selectors = '[data-cm-hub-match],[data-cm-v591-live],[data-cm-v510-live],[data-edit-match]';
  document.querySelectorAll(selectors).forEach((control) => {
    const info = contextFromPair(pairFromElement(control));
    if (!info?.decidedByPenalties) return;
    const card = control.closest('.cm-hub-match,.cm-hub-bracket-game,.match-card,.cm-v59-match-card,.cm-v510-primary-card') || control.parentElement;
    if (!card || card.querySelector('.cm-v517-penalty-result')) return;
    const score = card.querySelector('.cm-hub-match-score,.cm-v59-match-score,.score-box,.cm-v510-next-match > span');
    if (score) score.insertAdjacentHTML('beforeend', penaltyBadge(info, true));
    else control.insertAdjacentHTML('beforebegin', penaltyBadge(info, true));
  });

  const live = document.querySelector('[data-cm-v59-live-pair]');
  if (live) {
    const info = contextFromPair(live.dataset.cmV59LivePair);
    if (info?.decidedByPenalties) {
      const score = live.querySelector('.cm-v59-live-scoreboard,.cm-v59-live-score');
      if (score && !score.querySelector('.cm-v517-penalty-result')) score.insertAdjacentHTML('beforeend', penaltyBadge(info));
    }
  }

  const latest = (core.getState().tournaments || []).flatMap((tournament) => (tournament.matches || []).map((match) => resultInfo(tournament, match)))
    .filter((info) => info?.decidedByPenalties)
    .sort((a, b) => Number(b.match.updatedAt || b.match.registrationStartedAt || Date.parse(b.match.date || '') || 0) - Number(a.match.updatedAt || a.match.registrationStartedAt || Date.parse(a.match.date || '') || 0));
  document.querySelectorAll('.cm-v510-results p').forEach((paragraph) => {
    const text = normalize(paragraph.textContent);
    const info = latest.find((row) => text.includes(normalize(core.teamName(row.home))) && text.includes(normalize(core.teamName(row.away))) && text.includes(normalize(`${row.homeGoals} ${row.awayGoals}`)));
    if (info && !paragraph.querySelector('.cm-v517-penalty-result')) paragraph.insertAdjacentHTML('beforeend', penaltyBadge(info, true));
  });
}

function qualityIssues(tournament, calculation = computeAwards(tournament)) {
  const issues = [];
  const matches = (tournament.matches || []).filter((match) => match.stage !== 'bye');
  for (const match of matches) {
    const context = matchContext(tournament, match);
    const label = `${match.round || 'Partido'} · ${context ? `${core.teamName(context.home)} vs ${core.teamName(context.away)}` : 'cruce por definir'}`;
    if (!context) issues.push({ level: 'critical', text: `${label}: faltan participantes.` });
    if (!played(match)) { issues.push({ level: 'critical', text: `${label}: partido pendiente.` }); continue; }
    const detailedGoals = (match.goals || []).length;
    const scoreboardGoals = Number(match.homeGoals || 0) + Number(match.awayGoals || 0);
    if (detailedGoals && detailedGoals !== scoreboardGoals) issues.push({ level: 'critical', text: `${label}: el marcador no coincide con los goles detallados.` });
    if ((match.goals || []).some((goal) => !String(goal.playerName || '').trim())) issues.push({ level: 'critical', text: `${label}: existe un gol sin autor.` });
    if (!match.date) issues.push({ level: 'warning', text: `${label}: no tiene fecha.` });
    if (!match.venue) issues.push({ level: 'warning', text: `${label}: no tiene sede.` });
    if (!match.participationTracked) issues.push({ level: 'warning', text: `${label}: no tiene participación o alineaciones confirmadas.` });
    if (match.stage === 'knockout' && Number(match.homeGoals) === Number(match.awayGoals)) {
      const penalties = penaltyScore(match);
      if (!penalties.active || penalties.home === penalties.away) issues.push({ level: 'critical', text: `${label}: el empate de Play-Off no tiene una tanda válida que defina al ganador.` });
    }
  }
  if (!calculation.awards.mvp.playerName) issues.push({ level: 'warning', text: 'Premios: no existen datos suficientes para determinar al mejor jugador.' });
  if (!calculation.awards.goalkeeper.playerName) issues.push({ level: 'warning', text: 'Premios: no existen datos suficientes para determinar al mejor arquero.' });
  return issues;
}

function qualityMarkup(tournament, issues) {
  const critical = issues.filter((item) => item.level === 'critical');
  const warning = issues.filter((item) => item.level === 'warning');
  return `<div class="cm-v517-quality-modal"><p class="eyebrow">CONTROL DE CALIDAD</p><h2>Revisión antes de finalizar</h2><p>${issues.length ? 'Revisa los siguientes puntos antes de convertir el torneo en histórico.' : 'El torneo está completo y preparado para cerrarse.'}</p><div class="cm-v517-quality-kpis"><span><b>${critical.length}</b> bloqueos</span><span><b>${warning.length}</b> advertencias</span></div><div class="cm-v517-quality-list">${issues.length ? issues.map((item) => `<article class="is-${item.level}"><b>${item.level === 'critical' ? 'Bloqueo' : 'Advertencia'}</b><span>${esc(item.text)}</span></article>`).join('') : '<article class="is-ok"><b>Correcto</b><span>No se detectaron inconsistencias.</span></article>'}</div><div class="modal-actions"><button type="button" class="secondary" data-close-modal>Volver</button>${critical.length ? '' : `<button type="button" class="primary" data-cm-v517-confirm-finish="${esc(tournament.id)}">${warning.length ? 'Finalizar con advertencias' : 'Finalizar torneo'}</button>`}</div></div>`;
}

function openQuality(tournament) {
  const calculation = computeAwards(tournament);
  const issues = qualityIssues(tournament, calculation);
  core.openModal(qualityMarkup(tournament, issues));
}

async function finalizeTournament(tournamentId) {
  if (savingAwards || !core.canEdit()) return;
  const previous = clone(core.getState());
  const next = clone(previous);
  const tournament = next.tournaments?.find((item) => item.id === tournamentId);
  if (!tournament) return;
  const issues = qualityIssues(tournament, computeAwards(tournament, next));
  if (issues.some((item) => item.level === 'critical')) return core.showToast('El torneo todavía tiene bloqueos pendientes.');
  savingAwards = true;
  try {
    const updated = window.ChuteV511Tournaments.changeStatus(next, tournamentId, 'historical');
    const target = updated.tournaments.find((item) => item.id === tournamentId);
    const calculation = computeAwards(target, updated);
    target.awards = legacyAwards(calculation);
    target.awardDetails = calculation.awards;
    target.awardsStatus = 'official';
    target.awardsCalculatedAt = Date.now();
    target.awardsEngineVersion = VERSION;
    core.setState(updated);
    core.persistLocal?.();
    await core.saveCloud();
    core.closeModal?.();
    const modal = document.getElementById('modal');
    if (modal) modal.hidden = true;
    core.render?.();
    window.ChuteTournamentHub?.refresh?.();
    core.showToast(`Torneo “${target.name}” finalizado con premios oficiales.`);
    scheduleRefresh();
  } catch (error) {
    console.error(error);
    core.setState(previous);
    core.showToast(`No se pudo finalizar: ${error.message || error.code || 'error desconocido'}.`);
  } finally {
    savingAwards = false;
  }
}

function decorateTournamentTools() {
  const hub = document.getElementById('cmTournamentHub');
  const tournament = tournamentFromHub();
  const tools = hub?.querySelector('[data-v511-tools]');
  if (!hub || !tournament || !tools) return;
  const calculation = computeAwards(tournament);
  const issues = qualityIssues(tournament, calculation);
  let quality = tools.querySelector('[data-cm-v517-quality]');
  if (!quality) {
    quality = document.createElement('button');
    quality.type = 'button';
    quality.dataset.cmV517Quality = '';
    tools.appendChild(quality);
  }
  const critical = issues.filter((item) => item.level === 'critical').length;
  const warnings = issues.filter((item) => item.level === 'warning').length;
  quality.textContent = `✓ Revisar torneo · ${critical} bloqueos · ${warnings} avisos`;
  quality.classList.toggle('danger', critical > 0);
  const finish = tools.querySelector('[data-v511-finish], [data-cm-v517-finish]');
  if (finish) {
    finish.removeAttribute('data-v511-finish');
    finish.dataset.cmV517Finish = '';
    finish.textContent = tournament.status === 'active' ? '■ Revisar y finalizar' : '■ Torneo finalizado';
    finish.disabled = !core.canEdit() || tournament.status !== 'active';
  }
}

async function scheduleOfficialAwards(tournamentId, calculation) {
  if (!core.canEdit() || savingAwards) return;
  const tournament = core.getState().tournaments?.find((item) => item.id === tournamentId);
  if (!tournament || tournament.status !== 'historical') return;
  const nextSignature = awardsSignature(calculation);
  const storedSignature = JSON.stringify(Object.values(tournament.awardDetails || {}).map((award) => [award.key, award.playerName, award.teamId, award.reason]));
  if (tournament.awardsEngineVersion === VERSION && storedSignature === nextSignature) return;
  savingAwards = true;
  const previous = clone(core.getState());
  const next = clone(previous);
  const target = next.tournaments.find((item) => item.id === tournamentId);
  target.awards = legacyAwards(calculation);
  target.awardDetails = calculation.awards;
  target.awardsStatus = 'official';
  target.awardsCalculatedAt = Date.now();
  target.awardsEngineVersion = VERSION;
  try {
    core.setState(next);
    core.persistLocal?.();
    await core.saveCloud();
  } catch (error) {
    console.warn('No se pudieron fijar los premios oficiales v5.17.', error);
    core.setState(previous);
  } finally {
    savingAwards = false;
  }
}

function installStyles() {
  if (document.getElementById('cmV517Styles')) return;
  const link = document.createElement('link');
  link.id = 'cmV517Styles';
  link.rel = 'stylesheet';
  link.href = `/chute-v517-finalization.css?v=${VERSION}`;
  document.head.appendChild(link);
}

function refresh() {
  refreshQueued = false;
  renderAwardsPanel();
  decoratePenaltyResults();
  decorateTournamentTools();
  syncAwardsVisibility();
}

function scheduleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(refresh);
}

document.addEventListener('click', (event) => {
  const awards = event.target.closest?.('[data-cm-v517-awards-tab]');
  if (awards) {
    event.preventDefault();
    showAwards();
    return;
  }
  const nativeTab = event.target.closest?.('#cmTournamentHub .cm-hub-tabs button:not([data-cm-v517-awards-tab])');
  if (nativeTab) {
    const panel = document.querySelector('[data-cm-v517-awards-panel]');
    const button = document.querySelector('[data-cm-v517-awards-tab]');
    button?.classList.remove('active');
    panel?.classList.remove('active');
    if (panel) { panel.hidden = true; panel.style.display = 'none'; panel.setAttribute('aria-hidden', 'true'); }
  }
  if (event.target.closest?.('[data-cm-v517-quality]')) {
    const tournament = tournamentFromHub();
    if (tournament) openQuality(tournament);
  }
  if (event.target.closest?.('[data-cm-v517-finish]')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const tournament = tournamentFromHub();
    if (tournament) openQuality(tournament);
  }
  const confirmFinish = event.target.closest?.('[data-cm-v517-confirm-finish]');
  if (confirmFinish) {
    event.preventDefault();
    void finalizeTournament(confirmFinish.dataset.cmV517ConfirmFinish);
  }
  setTimeout(scheduleRefresh, 40);
}, true);

new MutationObserver(scheduleRefresh).observe(document.body, { childList: true, subtree: true });
installStyles();
if ('serviceWorker' in navigator) navigator.serviceWorker.register(`/sw.js?v=${VERSION}`).catch((error) => console.warn('No se pudo actualizar la PWA v5.17.', error));
document.title = 'Chute Mundo v5.17 · Resultados, premios y cierre';
document.querySelector('.hero .eyebrow')?.replaceChildren('CHUTE MUNDO v5.17');
scheduleRefresh();

window.ChuteV517Finalization = {
  version: VERSION,
  penaltyScore,
  resultInfo,
  buildPlayerRows,
  computeAwards,
  qualityIssues,
  renderAwardsPanel,
  decoratePenaltyResults,
  finalizeTournament
};
