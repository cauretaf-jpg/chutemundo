import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyB_3UwWm0LbFWw_3KXHlvdKFT6VZVK8sFw',
  authDomain: 'chutemundobd.firebaseapp.com',
  projectId: 'chutemundobd',
  storageBucket: 'chutemundobd.firebasestorage.app',
  messagingSenderId: '30253946795',
  appId: '1:30253946795:web:947a88cfa76db7e979e4ee'
};

const ADMIN_EMAIL = 'cauretaf@gmail.com';
const LOCAL_KEY = 'chute_mundo_cloud_v2_state';
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const stateRef = doc(db, 'chuteMundo', 'sharedState');

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const baseTeams = [
  ['polpetta', 'Sportivo La Polpetta', 'SLP'],
  ['guanaco', 'C.S.D. El Guanaco', 'GUA'],
  ['trucha', 'Sporting La Trucha', 'SLT'],
  ['pantera', 'Atlético Pantera', 'PAN'],
  ['parrilla', 'La Parrilla F.C.', 'PAR'],
  ['perla', 'La Perla United', 'LPU']
].map(([id, name, initials]) => ({ id, name, initials, coach: '', archived: false }));

function freshState() {
  return {
    version: '2.1.1',
    teams: baseTeams,
    tournaments: [],
    matches: [],
    activity: [{ id: uid('activity'), text: 'Base compartida de Chute Mundo preparada.', at: Date.now() }]
  };
}

function normalize(input) {
  const next = input && typeof input === 'object' ? input : {};
  return {
    version: next.version || '2.1.1',
    teams: Array.isArray(next.teams) && next.teams.length ? next.teams : baseTeams,
    tournaments: Array.isArray(next.tournaments) ? next.tournaments : [],
    matches: Array.isArray(next.matches) ? next.matches : [],
    activity: Array.isArray(next.activity) ? next.activity : []
  };
}

let state;
try {
  state = normalize(JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'));
} catch {
  state = freshState();
}
let isAdmin = false;
let cloudReady = false;
let cloudHasData = false;
let selectedTournamentId = null;
let saveTimer = null;

function teamById(id) {
  return state.teams.find((team) => team.id === id);
}

function teamName(id) {
  return teamById(id)?.name || 'Por definir';
}

function activeTeams() {
  return state.teams.filter((team) => !team.archived);
}

function tournamentById(id) {
  return state.tournaments.find((tournament) => tournament.id === id);
}

function matchesForTournament(id) {
  return state.matches.filter((match) => match.tournamentId === id);
}

function saveLocal() {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
}

function addActivity(text) {
  state.activity.unshift({ id: uid('activity'), text, at: Date.now() });
  state.activity = state.activity.slice(0, 40);
}

function setStatus(text, kind = '') {
  const element = $('#syncStatus');
  if (!element) return;
  element.textContent = text;
  element.dataset.kind = kind;
}

function toast(text) {
  const element = $('#toast');
  element.textContent = text;
  element.hidden = false;
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    element.hidden = true;
  }, 3200);
}

function canWrite() {
  return isAdmin && cloudReady && cloudHasData;
}

function scheduleCloudSave() {
  saveLocal();
  if (!canWrite()) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      setStatus('Guardando…', 'saving');
      await setDoc(stateRef, {
        state,
        updatedAt: serverTimestamp(),
        updatedBy: ADMIN_EMAIL,
        version: '2.1.1'
      }, { merge: true });
      setStatus('Sincronizado', 'ready');
    } catch (error) {
      console.error(error);
      setStatus('Error al guardar', 'error');
      toast('Firebase rechazó el guardado. Revisa las reglas de Firestore.');
    }
  }, 350);
}

async function cloudSave() {
  if (!canWrite()) return;
  setStatus('Guardando…', 'saving');
  await setDoc(stateRef, {
    state,
    updatedAt: serverTimestamp(),
    updatedBy: ADMIN_EMAIL,
    version: '2.1.1'
  }, { merge: true });
  setStatus('Sincronizado', 'ready');
}

function navigate(page) {
  $$('.page').forEach((section) => section.hidden = section.id !== page);
  $$('.nav-button').forEach((button) => button.classList.toggle('active', button.dataset.page === page));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderAuth() {
  const button = $('#authButton');
  button.textContent = isAdmin ? 'Cerrar sesión' : 'Ingresar';
  $('#adminNotice').hidden = isAdmin;
  $$('.admin-only').forEach((element) => element.hidden = !isAdmin);
  $('#readOnlyNotice').hidden = isAdmin || !cloudHasData;
}

function renderTeams() {
  const picker = $('#teamPicker');
  const previous = Array.from(picker.querySelectorAll('input:checked')).map((input) => input.value);
  const teams = activeTeams();
  picker.innerHTML = teams.map((team) => `
    <label class="team-check">
      <input type="checkbox" value="${team.id}" ${previous.includes(team.id) ? 'checked' : ''}>
      <span class="team-badge">${escapeHtml(team.initials)}</span>
      <span>${escapeHtml(team.name)}</span>
    </label>
  `).join('');
  $('#noTeams').hidden = teams.length > 0;
  updateSelectedCount();

  $('#teamList').innerHTML = state.teams.map((team) => `
    <article class="list-item team-row">
      <div class="team-ident">
        <span class="team-badge">${escapeHtml(team.initials || team.name.slice(0, 3).toUpperCase())}</span>
        <div>
          <strong>${escapeHtml(team.name)}</strong>
          <small>${team.coach ? `DT: ${escapeHtml(team.coach)}` : 'Sin DT registrado'}${team.archived ? ' · Archivado' : ''}</small>
        </div>
      </div>
      ${isAdmin && !team.archived ? `<button class="mini-button" data-archive-team="${team.id}">Archivar</button>` : ''}
    </article>
  `).join('');
}

function updateSelectedCount() {
  const count = $('#teamPicker input:checked').length;
  const total = activeTeams().length;
  $('#selectedCount').textContent = `${count} seleccionado${count === 1 ? '' : 's'}`;
  $('#selectAllTeams').checked = total > 0 && count === total;
}

function renderTournamentHelp() {
  const type = $('#tournamentType').value;
  const help = {
    league: 'Todos contra todos. La tabla se calcula automáticamente desde los resultados.',
    groups: 'Dos grupos equilibrados. Los dos primeros de cada grupo avanzan a semifinales.',
    knockout: 'Llaves eliminatorias. Los empates se resuelven por penales.'
  };
  $('#formatHelp').textContent = help[type];
  $('#tournamentLegs').disabled = type !== 'league';
}

function createMatch(tournament, data = {}) {
  const match = {
    id: uid('match'),
    tournamentId: tournament.id,
    phase: data.phase || 'league',
    stage: data.stage || 'Liga',
    group: data.group || null,
    homeTeamId: data.homeTeamId || null,
    awayTeamId: data.awayTeamId || null,
    homeSource: data.homeSource || null,
    awaySource: data.awaySource || null,
    homeScore: null,
    awayScore: null,
    homePenalties: null,
    awayPenalties: null,
    playedHomeId: null,
    playedAwayId: null,
    winnerTeamId: null,
    completed: false,
    autoAdvance: false
  };
  state.matches.push(match);
  return match;
}

function scheduleRoundRobin(tournament, teamIds, options = {}) {
  const legs = options.legs ?? tournament.legs ?? 1;
  for (let i = 0; i < teamIds.length; i += 1) {
    for (let j = i + 1; j < teamIds.length; j += 1) {
      createMatch(tournament, {
        phase: options.phase || 'league',
        stage: options.stage || 'Liga',
        group: options.group || null,
        homeTeamId: teamIds[i],
        awayTeamId: teamIds[j]
      });
      if (legs === 2) {
        createMatch(tournament, {
          phase: options.phase || 'league',
          stage: options.stage || 'Liga',
          group: options.group || null,
          homeTeamId: teamIds[j],
          awayTeamId: teamIds[i]
        });
      }
    }
  }
}

function scheduleGroupCup(tournament) {
  const groupA = [];
  const groupB = [];
  tournament.teamIds.forEach((teamId, index) => {
    (index % 2 === 0 ? groupA : groupB).push(teamId);
  });
  tournament.groups = { A: groupA, B: groupB };
  scheduleRoundRobin(tournament, groupA, { phase: 'group', stage: 'Grupo A', group: 'A', legs: 1 });
  scheduleRoundRobin(tournament, groupB, { phase: 'group', stage: 'Grupo B', group: 'B', legs: 1 });

  const semifinalA = createMatch(tournament, {
    phase: 'knockout',
    stage: 'Semifinales',
    homeSource: { type: 'group', group: 'A', rank: 1 },
    awaySource: { type: 'group', group: 'B', rank: 2 }
  });
  const semifinalB = createMatch(tournament, {
    phase: 'knockout',
    stage: 'Semifinales',
    homeSource: { type: 'group', group: 'B', rank: 1 },
    awaySource: { type: 'group', group: 'A', rank: 2 }
  });
  createMatch(tournament, {
    phase: 'knockout',
    stage: 'Tercer lugar',
    homeSource: { type: 'match', matchId: semifinalA.id, result: 'loser' },
    awaySource: { type: 'match', matchId: semifinalB.id, result: 'loser' }
  });
  createMatch(tournament, {
    phase: 'knockout',
    stage: 'Final',
    homeSource: { type: 'match', matchId: semifinalA.id, result: 'winner' },
    awaySource: { type: 'match', matchId: semifinalB.id, result: 'winner' }
  });
}

function scheduleKnockout(tournament) {
  let bracketSize = 2;
  while (bracketSize < tournament.teamIds.length) bracketSize *= 2;

  const remaining = [...tournament.teamIds];
  const byes = bracketSize - remaining.length;
  const slots = [];
  for (let index = 0; index < byes; index += 1) {
    slots.push(remaining.shift(), null);
  }
  while (remaining.length > 0) {
    slots.push(remaining.shift() || null, remaining.shift() || null);
  }

  let previousRound = [];
  for (let size = bracketSize; size >= 2; size /= 2) {
    const currentRound = [];
    for (let index = 0; index < size / 2; index += 1) {
      const data = { phase: 'knockout', stage: size === 2 ? 'Final' : size === 4 ? 'Semifinales' : 'Cuartos de final' };
      if (size === bracketSize) {
        data.homeTeamId = slots[index * 2];
        data.awayTeamId = slots[index * 2 + 1];
      } else {
        data.homeSource = { type: 'match', matchId: previousRound[index * 2].id, result: 'winner' };
        data.awaySource = { type: 'match', matchId: previousRound[index * 2 + 1].id, result: 'winner' };
      }
      currentRound.push(createMatch(tournament, data));
    }
    previousRound = currentRound;
  }
  resolveByes(tournament);
}

function standings(tournament, group = null) {
  const teamIds = group ? tournament.groups?.[group] || [] : tournament.teamIds;
  const rows = new Map(teamIds.map((teamId) => [teamId, {
    teamId, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, points: 0
  }]));

  matchesForTournament(tournament.id)
    .filter((match) => {
      if (!match.completed || match.autoAdvance) return false;
      return group ? match.phase === 'group' && match.group === group : match.phase === 'league';
    })
    .forEach((match) => {
      const homeId = match.playedHomeId || match.homeTeamId;
      const awayId = match.playedAwayId || match.awayTeamId;
      if (!rows.has(homeId) || !rows.has(awayId)) return;
      const home = rows.get(homeId);
      const away = rows.get(awayId);
      const homeScore = Number(match.homeScore);
      const awayScore = Number(match.awayScore);
      home.played += 1;
      away.played += 1;
      home.gf += homeScore;
      home.ga += awayScore;
      away.gf += awayScore;
      away.ga += homeScore;
      if (homeScore > awayScore) {
        home.wins += 1;
        away.losses += 1;
        home.points += 3;
      } else if (awayScore > homeScore) {
        away.wins += 1;
        home.losses += 1;
        away.points += 3;
      } else {
        home.draws += 1;
        away.draws += 1;
        home.points += 1;
        away.points += 1;
      }
    });

  return Array.from(rows.values()).sort((a, b) =>
    b.points - a.points ||
    (b.gf - b.ga) - (a.gf - a.ga) ||
    b.gf - a.gf ||
    teamName(a.teamId).localeCompare(teamName(b.teamId))
  );
}

function resolveSource(tournament, source) {
  if (!source) return null;
  if (source.type === 'match') {
    const match = state.matches.find((item) => item.id === source.matchId);
    if (!match?.completed) return null;
    if (source.result === 'winner') return match.winnerTeamId;
    const homeId = match.playedHomeId || match.homeTeamId;
    const awayId = match.playedAwayId || match.awayTeamId;
    return match.winnerTeamId === homeId ? awayId : homeId;
  }
  if (source.type === 'group') {
    const groupMatches = matchesForTournament(tournament.id).filter((match) => match.phase === 'group' && match.group === source.group);
    if (!groupMatches.length || !groupMatches.every((match) => match.completed)) return null;
    return standings(tournament, source.group)[source.rank - 1]?.teamId || null;
  }
  return null;
}

function sourceText(source) {
  if (!source) return 'Por definir';
  if (source.type === 'group') return `${source.rank}° Grupo ${source.group}`;
  return source.result === 'winner' ? 'Ganador de llave' : 'Perdedor de llave';
}

function slot(tournament, match, side) {
  return match[`${side}TeamId`] || resolveSource(tournament, match[`${side}Source`]) || null;
}

function resolveByes(tournament) {
  let changed = true;
  while (changed) {
    changed = false;
    matchesForTournament(tournament.id).forEach((match) => {
      if (match.completed) return;
      const home = slot(tournament, match, 'home');
      const away = slot(tournament, match, 'away');
      const homeUnresolved = match.homeSource && !home;
      const awayUnresolved = match.awaySource && !away;

      if (home && !away && !awayUnresolved) {
        match.completed = true;
        match.autoAdvance = true;
        match.winnerTeamId = home;
        match.playedHomeId = home;
        changed = true;
      }
      if (away && !home && !homeUnresolved) {
        match.completed = true;
        match.autoAdvance = true;
        match.winnerTeamId = away;
        match.playedAwayId = away;
        changed = true;
      }
    });
  }
}

function champion(tournament) {
  return matchesForTournament(tournament.id).find((match) => match.stage === 'Final' && match.completed)?.winnerTeamId || null;
}

function ranking() {
  const rows = new Map(state.teams.map((team) => [team.id, {
    teamId: team.id, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, points: 0
  }]));
  state.matches.filter((match) => match.completed && !match.autoAdvance).forEach((match) => {
    const homeId = match.playedHomeId || match.homeTeamId;
    const awayId = match.playedAwayId || match.awayTeamId;
    if (!homeId || !awayId || !rows.has(homeId) || !rows.has(awayId)) return;
    const home = rows.get(homeId);
    const away = rows.get(awayId);
    const homeScore = Number(match.homeScore);
    const awayScore = Number(match.awayScore);
    home.played += 1;
    away.played += 1;
    home.gf += homeScore;
    home.ga += awayScore;
    away.gf += awayScore;
    away.ga += homeScore;
    if (homeScore > awayScore) {
      home.wins += 1;
      away.losses += 1;
      home.points += 3;
    } else if (awayScore > homeScore) {
      away.wins += 1;
      home.losses += 1;
      away.points += 3;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  });
  return Array.from(rows.values()).filter((row) => row.played > 0).sort((a, b) =>
    b.points - a.points ||
    (b.gf - b.ga) - (a.gf - a.ga) ||
    b.gf - a.gf ||
    teamName(a.teamId).localeCompare(teamName(b.teamId))
  );
}

function rankMarkup(rows, limit = Infinity) {
  if (!rows.length) return '<p class="empty">Aún no hay resultados registrados.</p>';
  return rows.slice(0, limit).map((row, index) => `
    <div class="rank-row">
      <b>${index + 1}</b>
      <div><strong>${escapeHtml(teamName(row.teamId))}</strong><small>${row.played} PJ · ${row.gf}-${row.ga} goles</small></div>
      <strong>${row.points} pts</strong>
    </div>
  `).join('');
}

function tableMarkup(rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th></tr></thead>
        <tbody>${rows.map((row) => `
          <tr><td>${escapeHtml(teamName(row.teamId))}</td><td>${row.played}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td>${row.gf}</td><td>${row.ga}</td><td>${row.gf - row.ga}</td><td><b>${row.points}</b></td></tr>
        `).join('')}</tbody>
      </table>
    </div>
  `;
}

function matchMarkup(tournament, match) {
  const homeId = slot(tournament, match, 'home');
  const awayId = slot(tournament, match, 'away');
  const score = match.autoAdvance
    ? 'Pase directo'
    : match.completed
      ? `${match.homeScore} - ${match.awayScore}${match.homePenalties !== null ? ` · Pen. ${match.homePenalties}-${match.awayPenalties}` : ''}`
      : 'Pendiente';
  return `
    <article class="match-card">
      <div><strong>${escapeHtml(homeId ? teamName(homeId) : sourceText(match.homeSource))} <span>vs.</span> ${escapeHtml(awayId ? teamName(awayId) : sourceText(match.awaySource))}</strong><small>${escapeHtml(match.stage)}${match.group ? ` · Grupo ${match.group}` : ''}</small></div>
      <div class="match-actions"><b>${score}</b>${isAdmin && homeId && awayId && !match.autoAdvance ? `<button class="mini-button" data-edit-match="${match.id}">${match.completed ? 'Editar' : 'Cargar'}</button>` : ''}</div>
    </article>
  `;
}

function renderHome() {
  $('#metricTeams').textContent = activeTeams().length;
  $('#metricTournaments').textContent = state.tournaments.length;
  $('#metricMatches').textContent = state.matches.length;
  $('#metricResults').textContent = state.matches.filter((match) => match.completed && !match.autoAdvance).length;

  $('#activityList').innerHTML = state.activity.slice(0, 6).map((activity) => `
    <article class="activity-item"><span></span><div>${escapeHtml(activity.text)}<small>${new Date(activity.at).toLocaleString('es-CL')}</small></div></article>
  `).join('') || '<p class="empty">Sin actividad.</p>';

  $('#homeRanking').innerHTML = rankMarkup(ranking(), 5);
}

function renderTournaments() {
  $('#tournamentList').innerHTML = state.tournaments.map((tournament) => {
    const tournamentMatches = matchesForTournament(tournament.id);
    const winner = champion(tournament);
    const label = tournament.type === 'league' ? 'Liga' : tournament.type === 'groups' ? 'Copa con grupos' : 'Eliminación directa';
    return `
      <article class="list-item">
        <div><strong>${escapeHtml(tournament.name)}</strong><small>${label} · ${tournament.teamIds.length} equipos · ${tournamentMatches.filter((match) => match.completed).length}/${tournamentMatches.length} resueltos</small>${winner ? `<em>Campeón: ${escapeHtml(teamName(winner))}</em>` : ''}</div>
        <button class="mini-button" data-view-tournament="${tournament.id}">Ver</button>
      </article>
    `;
  }).join('') || '<p class="empty">Todavía no hay torneos.</p>';
}

function renderMatches() {
  const filter = $('#matchFilter');
  const previous = filter.value || 'all';
  filter.innerHTML = `<option value="all">Todos los torneos</option>${state.tournaments.map((tournament) => `<option value="${tournament.id}">${escapeHtml(tournament.name)}</option>`).join('')}`;
  filter.value = state.tournaments.some((tournament) => tournament.id === previous) ? previous : 'all';
  const matches = state.matches.filter((match) => filter.value === 'all' || match.tournamentId === filter.value);
  $('#matchesList').innerHTML = matches.map((match) => matchMarkup(tournamentById(match.tournamentId), match)).join('') || '<p class="empty">No hay partidos.</p>';
}

function renderStats() {
  $('#globalRanking').innerHTML = rankMarkup(ranking());

  const titles = new Map();
  state.tournaments.forEach((tournament) => {
    const winner = champion(tournament);
    if (winner) titles.set(winner, (titles.get(winner) || 0) + 1);
  });
  $('#honoursList').innerHTML = titles.size
    ? Array.from(titles.entries()).sort((a, b) => b[1] - a[1]).map(([teamId, count]) => `<div class="rank-row"><b>★</b><div><strong>${escapeHtml(teamName(teamId))}</strong><small>Campeón de ${count} torneo${count === 1 ? '' : 's'}</small></div><strong>${count}</strong></div>`).join('')
    : '<p class="empty">El palmarés aparecerá cuando se complete una final.</p>';
}

function renderDetail() {
  const root = $('#tournamentDetail');
  const tournament = tournamentById(selectedTournamentId);
  if (!tournament) {
    root.innerHTML = '';
    return;
  }
  const allMatches = matchesForTournament(tournament.id);
  const regularMatches = allMatches.filter((match) => match.phase !== 'knockout');
  const knockoutMatches = allMatches.filter((match) => match.phase === 'knockout');

  let tables = '';
  if (tournament.groups) {
    tables = `<div class="detail-grid">${['A', 'B'].map((group) => `<section class="panel"><h3>Grupo ${group}</h3>${tableMarkup(standings(tournament, group))}</section>`).join('')}</div>`;
  } else if (tournament.type === 'league') {
    tables = `<section class="panel"><h3>Tabla de posiciones</h3>${tableMarkup(standings(tournament))}</section>`;
  }

  const stages = Array.from(new Set(knockoutMatches.map((match) => match.stage)));
  const brackets = stages.length
    ? `<section class="panel"><h3>Llaves</h3>${stages.map((stage) => `<div class="stage"><h4>${escapeHtml(stage)}</h4>${knockoutMatches.filter((match) => match.stage === stage).map((match) => matchMarkup(tournament, match)).join('')}</div>`).join('')}</section>`
    : '';

  const schedule = regularMatches.length
    ? `<section class="panel"><h3>Fixture</h3>${regularMatches.map((match) => matchMarkup(tournament, match)).join('')}</section>`
    : '';

  root.innerHTML = `<div class="section-title"><h2>${escapeHtml(tournament.name)}</h2><p>${tournament.teamIds.map(teamName).map(escapeHtml).join(' · ')}</p></div>${tables}${brackets}${schedule}`;
}

function renderAdmin() {
  $('#cloudInfo').textContent = cloudHasData
    ? (isAdmin ? 'Tu sesión administra la base compartida.' : 'La base está disponible en modo consulta.')
    : (isAdmin ? 'No hay una base v2 en la nube todavía. Puedes activarla sin modificar los datos antiguos.' : 'Aún no existe una base v2 activa.');

  $('#activateCloud').hidden = !(isAdmin && !cloudHasData);
  $('#syncNow').hidden = !(isAdmin && cloudHasData);
  $('#resetCloud').disabled = !isAdmin || !cloudHasData;
  $('#importFile').disabled = !isAdmin || !cloudHasData;
}

function render() {
  renderAuth();
  renderTournamentHelp();
  renderTeams();
  renderHome();
  renderTournaments();
  renderMatches();
  renderStats();
  renderDetail();
  renderAdmin();
}

function openModal(html) {
  $('#modalContent').innerHTML = html;
  $('#modal').hidden = false;
}

function closeModal() {
  $('#modal').hidden = true;
  $('#modalContent').innerHTML = '';
}

function openLoginModal() {
  openModal(`
    <h2>Ingreso administrador</h2>
    <p>Solo la cuenta administradora puede modificar información compartida.</p>
    <form id="loginForm">
      <label>Correo<input value="${ADMIN_EMAIL}" disabled></label>
      <label>Contraseña<input id="loginPassword" type="password" minlength="6" required autocomplete="current-password"></label>
      <div class="modal-actions"><button type="button" class="secondary" data-close-modal>Cancelar</button><button class="primary" type="submit">Ingresar</button></div>
      <button id="createAccount" type="button" class="link-button">Crear mi cuenta por primera vez</button>
    </form>
  `);

  $('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, $('#loginPassword').value);
      closeModal();
      toast('Sesión iniciada.');
    } catch (error) {
      toast(error.code === 'auth/invalid-credential' ? 'Contraseña incorrecta o cuenta inexistente.' : 'No se pudo iniciar sesión.');
    }
  });

  $('#createAccount').addEventListener('click', async () => {
    try {
      await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, $('#loginPassword').value);
      closeModal();
      toast('Cuenta administradora creada.');
    } catch (error) {
      toast(error.code === 'auth/email-already-in-use' ? 'La cuenta ya existe. Usa Ingresar.' : 'Usa una contraseña de al menos 6 caracteres.');
    }
  });
}

function openResultModal(matchId) {
  const match = state.matches.find((item) => item.id === matchId);
  const tournament = tournamentById(match.tournamentId);
  const homeId = slot(tournament, match, 'home');
  const awayId = slot(tournament, match, 'away');
  if (!homeId || !awayId) {
    toast('Este partido depende de una llave anterior.');
    return;
  }

  openModal(`
    <h2>${escapeHtml(match.stage)}</h2>
    <p>${escapeHtml(teamName(homeId))} vs. ${escapeHtml(teamName(awayId))}</p>
    <form id="resultForm">
      <div class="two-fields">
        <label>${escapeHtml(teamName(homeId))}<input id="homeScore" type="number" min="0" required value="${match.homeScore ?? ''}"></label>
        <label>${escapeHtml(teamName(awayId))}<input id="awayScore" type="number" min="0" required value="${match.awayScore ?? ''}"></label>
      </div>
      ${match.phase === 'knockout' ? `<div id="penaltiesRow" class="two-fields" hidden>
        <label>Penales ${escapeHtml(teamName(homeId))}<input id="homePenalties" type="number" min="0" value="${match.homePenalties ?? ''}"></label>
        <label>Penales ${escapeHtml(teamName(awayId))}<input id="awayPenalties" type="number" min="0" value="${match.awayPenalties ?? ''}"></label>
      </div><p class="hint">Si el marcador empata en una llave, registra penales.</p>` : ''}
      <div class="modal-actions"><button type="button" class="secondary" data-close-modal>Cancelar</button><button class="primary" type="submit">Guardar resultado</button></div>
    </form>
  `);

  const togglePenalties = () => {
    const equal = $('#homeScore').value !== '' && $('#homeScore').value === $('#awayScore').value;
    $('#penaltiesRow')?.toggleAttribute('hidden', !equal);
  };
  $('#homeScore').addEventListener('input', togglePenalties);
  $('#awayScore').addEventListener('input', togglePenalties);
  togglePenalties();

  $('#resultForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const homeScore = Number($('#homeScore').value);
    const awayScore = Number($('#awayScore').value);
    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) {
      toast('Ingresa marcadores válidos.');
      return;
    }

    let winner = homeScore > awayScore ? homeId : awayScore > homeScore ? awayId : null;
    let homePenalties = null;
    let awayPenalties = null;
    if (match.phase === 'knockout' && !winner) {
      homePenalties = Number($('#homePenalties').value);
      awayPenalties = Number($('#awayPenalties').value);
      if (!Number.isInteger(homePenalties) || !Number.isInteger(awayPenalties) || homePenalties < 0 || awayPenalties < 0 || homePenalties === awayPenalties) {
        toast('Los penales deben definir un ganador.');
        return;
      }
      winner = homePenalties > awayPenalties ? homeId : awayId;
    }

    match.playedHomeId = homeId;
    match.playedAwayId = awayId;
    match.homeScore = homeScore;
    match.awayScore = awayScore;
    match.homePenalties = homePenalties;
    match.awayPenalties = awayPenalties;
    match.winnerTeamId = winner;
    match.completed = true;
    match.autoAdvance = false;
    resolveByes(tournament);
    addActivity(match.stage === 'Final'
      ? `${teamName(winner)} ganó ${tournament.name}.`
      : `Resultado registrado: ${teamName(homeId)} ${homeScore}-${awayScore} ${teamName(awayId)}.`
    );
    scheduleCloudSave();
    closeModal();
    render();
    toast('Resultado guardado.');
  });
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `chute-mundo-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast('Respaldo descargado.');
}

async function importBackup(file) {
  if (!isAdmin || !cloudHasData) {
    toast('Inicia sesión y activa la base compartida primero.');
    return;
  }
  try {
    const payload = JSON.parse(await file.text());
    if (!Array.isArray(payload.teams) || !Array.isArray(payload.tournaments) || !Array.isArray(payload.matches)) throw new Error('invalid');
    if (!window.confirm('La restauración reemplazará el estado compartido. ¿Continuar?')) return;
    state = normalize(payload);
    addActivity('Se restauró un respaldo JSON.');
    await cloudSave();
    render();
    toast('Respaldo restaurado.');
  } catch {
    toast('El archivo no parece un respaldo válido.');
  }
}

$('#authButton').addEventListener('click', () => {
  if (isAdmin) signOut(auth);
  else openLoginModal();
});

$('#tournamentType').addEventListener('change', renderTournamentHelp);
$('#teamPicker').addEventListener('change', updateSelectedCount);
$('#selectAllTeams').addEventListener('change', (event) => {
  $('#teamPicker').querySelectorAll('input').forEach((input) => input.checked = event.target.checked);
  updateSelectedCount();
});

$('#tournamentForm').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!canWrite()) {
    toast('Inicia sesión y activa la base compartida antes de crear torneos.');
    return;
  }
  const name = $('#tournamentName').value.trim();
  const type = $('#tournamentType').value;
  const teamIds = Array.from($('#teamPicker').querySelectorAll('input:checked')).map((input) => input.value);
  const min = type === 'groups' ? 4 : 2;
  if (!name) return toast('Escribe un nombre para el torneo.');
  if (teamIds.length < min) return toast(`Este formato requiere al menos ${min} equipos.`);
  if (type === 'knockout' && teamIds.length > 8) return toast('La eliminación directa admite hasta 8 equipos.');

  const tournament = {
    id: uid('tournament'),
    name,
    type,
    legs: Number($('#tournamentLegs').value),
    teamIds,
    groups: null,
    createdAt: Date.now()
  };
  state.tournaments.unshift(tournament);
  if (type === 'league') scheduleRoundRobin(tournament, teamIds);
  if (type === 'groups') scheduleGroupCup(tournament);
  if (type === 'knockout') scheduleKnockout(tournament);
  addActivity(`Se creó ${type === 'league' ? 'Liga' : type === 'groups' ? 'Copa con grupos' : 'Eliminación directa'}: ${name}.`);
  selectedTournamentId = tournament.id;
  $('#tournamentName').value = '';
  scheduleCloudSave();
  render();
  toast('Torneo generado.');
});

$('#teamForm').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!canWrite()) {
    toast('Inicia sesión y activa la base compartida antes de agregar equipos.');
    return;
  }
  const name = $('#teamName').value.trim();
  if (!name) return;
  if (state.teams.some((team) => team.name.toLowerCase() === name.toLowerCase())) {
    toast('Ese equipo ya existe.');
    return;
  }
  const initials = ($('#teamInitials').value.trim() || name.split(/\s+/).map((part) => part[0]).join('').slice(0, 4)).toUpperCase();
  state.teams.push({ id: uid('team'), name, initials, coach: $('#teamCoach').value.trim(), archived: false });
  addActivity(`Se agregó el equipo ${name}.`);
  event.target.reset();
  scheduleCloudSave();
  render();
  toast('Equipo agregado.');
});

$('#matchFilter').addEventListener('change', renderMatches);
$('#exportButton').addEventListener('click', exportBackup);
$('#importFile').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (file) await importBackup(file);
  event.target.value = '';
});
$('#activateCloud').addEventListener('click', async () => {
  if (!isAdmin) return toast('Inicia sesión primero.');
  try {
    setStatus('Activando base…', 'saving');
    await setDoc(stateRef, { state, version: '2.1.1', updatedAt: serverTimestamp(), updatedBy: ADMIN_EMAIL }, { merge: true });
    cloudHasData = true;
    setStatus('Sincronizado', 'ready');
    render();
    toast('Base compartida activada.');
  } catch (error) {
    console.error(error);
    setStatus('Error al activar', 'error');
    toast('Firebase rechazó la activación. Publica las reglas de Firestore.');
  }
});
$('#syncNow').addEventListener('click', async () => {
  if (!canWrite()) return;
  try {
    await cloudSave();
    toast('Sincronización completada.');
  } catch {
    toast('No se pudo sincronizar.');
  }
});
$('#resetCloud').addEventListener('click', () => {
  if (!canWrite()) return;
  if (!window.confirm('Se eliminarán torneos y resultados compartidos. ¿Continuar?')) return;
  const teams = state.teams;
  state = freshState();
  state.teams = teams;
  addActivity('Se reiniciaron torneos y resultados compartidos.');
  selectedTournamentId = null;
  scheduleCloudSave();
  render();
  toast('Datos reiniciados.');
});

document.addEventListener('click', (event) => {
  const pageButton = event.target.closest('[data-page]');
  if (pageButton) navigate(pageButton.dataset.page);

  const viewButton = event.target.closest('[data-view-tournament]');
  if (viewButton) {
    selectedTournamentId = viewButton.dataset.viewTournament;
    navigate('torneos');
    renderDetail();
  }

  const editButton = event.target.closest('[data-edit-match]');
  if (editButton && isAdmin) openResultModal(editButton.dataset.editMatch);

  const archiveButton = event.target.closest('[data-archive-team]');
  if (archiveButton && isAdmin) {
    const team = teamById(archiveButton.dataset.archiveTeam);
    if (team && window.confirm(`¿Archivar ${team.name}? Su historial se conservará.`)) {
      team.archived = true;
      addActivity(`Se archivó ${team.name}.`);
      scheduleCloudSave();
      render();
    }
  }

  if (event.target.matches('[data-close-modal]')) closeModal();
});

$('#modal').addEventListener('click', (event) => {
  if (event.target.id === 'modal') closeModal();
});

setPersistence(auth, browserLocalPersistence).catch(console.error);

onAuthStateChanged(auth, (user) => {
  isAdmin = Boolean(user && user.email?.toLowerCase() === ADMIN_EMAIL);
  if (isAdmin) setStatus(cloudHasData ? 'Sincronizado' : 'Sesión administradora', 'ready');
  else setStatus(cloudHasData ? 'Consulta en tiempo real' : 'Sin iniciar sesión', '');
  render();
});

onSnapshot(stateRef, (snapshot) => {
  cloudReady = true;
  if (snapshot.exists() && snapshot.data()?.state) {
    state = normalize(snapshot.data().state);
    cloudHasData = true;
    saveLocal();
    setStatus(isAdmin ? 'Sincronizado' : 'Consulta en tiempo real', 'ready');
  } else {
    cloudHasData = false;
    setStatus(isAdmin ? 'Sesión administradora' : 'Base pendiente', '');
  }
  render();
}, (error) => {
  console.error(error);
  cloudReady = true;
  cloudHasData = false;
  setStatus('Firebase no disponible', 'error');
  render();
});

render();
