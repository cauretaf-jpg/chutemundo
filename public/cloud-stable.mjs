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
  getDoc,
  onSnapshot,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyB_3UwWm0LbFWw_3KXHlvdKFT6VZVK8sFw',
  authDomain: 'chutemundobd.firebaseapp.com',
  projectId: 'chutemundobd',
  storageBucket: 'chutemundobd.firebasestorage.app',
  messagingSenderId: '30253946795',
  appId: '1:30253946795:web:947a88cfa76db7e979e4ee'
};

const ADMIN_EMAIL = 'cauretaf@gmail.com';
const LOCAL_STORAGE_KEY = 'chute_mundo_firebase_v2';
const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
const sharedStateRef = doc(db, 'chuteMundo', 'sharedState');

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char]));

const seedTeams = [
  ['polpetta', 'Sportivo La Polpetta', 'SLP'],
  ['guanaco', 'C.S.D. El Guanaco', 'GUA'],
  ['trucha', 'Sporting La Trucha', 'SLT'],
  ['pantera', 'Atlético Pantera', 'PAN'],
  ['parrilla', 'La Parrilla F.C.', 'PAR'],
  ['perla', 'La Perla United', 'LPU']
].map(([id, name, initials]) => ({
  id, name, initials, coach: '', archived: false
}));

function freshState() {
  return {
    version: '2.2.0',
    teams: seedTeams.map((team) => ({ ...team })),
    tournaments: [],
    matches: [],
    activity: [{
      id: uid('activity'),
      text: 'Base nueva de Chute Mundo preparada para Firebase.',
      at: Date.now()
    }]
  };
}

function normalizeState(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    version: source.version || '2.2.0',
    teams: Array.isArray(source.teams) && source.teams.length ? source.teams : seedTeams.map((team) => ({ ...team })),
    tournaments: Array.isArray(source.tournaments)
      ? source.tournaments
      : (Array.isArray(source.tours) ? source.tours.map((item) => ({
          id: item.id,
          name: item.name,
          type: item.type,
          legs: item.legs || 1,
          teamIds: item.teamIds || item.teams || [],
          groups: item.groups || null,
          createdAt: item.createdAt || item.created || Date.now()
        })) : []),
    matches: Array.isArray(source.matches) ? source.matches : [],
    activity: Array.isArray(source.activity) ? source.activity : []
  };
}

let state;
try {
  state = normalizeState(JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || 'null'));
} catch {
  state = freshState();
}

let authUser = null;
let cloudLoaded = false;
let cloudActive = false;
let selectedTournamentId = null;
let saveTimer = null;
let toastTimer = null;

function persistLocal() {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
}

function isAdmin() {
  return Boolean(authUser && authUser.email && authUser.email.toLowerCase() === ADMIN_EMAIL);
}

function canEdit() {
  return isAdmin() && cloudLoaded && cloudActive;
}

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

function addActivity(text) {
  state.activity.unshift({ id: uid('activity'), text, at: Date.now() });
  state.activity = state.activity.slice(0, 50);
}

function setStatus(text) {
  const target = $('#syncStatus');
  if (target) target.textContent = text;
}

function showToast(text) {
  const target = $('#toast');
  if (!target) return;
  target.textContent = text;
  target.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    target.hidden = true;
  }, 3200);
}

function navigate(page) {
  $$('.page').forEach((section) => {
    section.hidden = section.id !== page;
  });
  $$('.nav-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.page === page);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function writeCloudState() {
  if (!canEdit()) return;
  setStatus('Guardando…');
  await setDoc(sharedStateRef, {
    state,
    version: '2.2.0',
    updatedAt: serverTimestamp(),
    updatedBy: ADMIN_EMAIL
  }, { merge: true });
  setStatus('Sincronizado');
}

function queueSave() {
  persistLocal();
  if (!canEdit()) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await writeCloudState();
    } catch (error) {
      console.error('Cloud save failed', error);
      setStatus('Error al guardar');
      showToast('Firebase rechazó el guardado. Revisa las reglas de Firestore.');
    }
  }, 350);
}

function renderAuthState() {
  const button = $('#authButton');
  if (button) button.textContent = isAdmin() ? 'Cerrar sesión' : 'Ingresar';

  const adminNotice = $('#adminNotice');
  if (adminNotice) adminNotice.hidden = isAdmin();

  const readOnlyNotice = $('#readOnlyNotice');
  if (readOnlyNotice) readOnlyNotice.hidden = !cloudActive || isAdmin();

  $$('.admin-only').forEach((element) => {
    element.hidden = !isAdmin();
  });
}

function renderTournamentControls() {
  const typeField = $('#tournamentType');
  const help = $('#formatHelp');
  const legs = $('#tournamentLegs');
  if (!typeField || !help || !legs) return;

  const helpText = {
    league: 'Todos contra todos. La tabla se calcula automáticamente desde los resultados.',
    groups: 'Dos grupos equilibrados. Los dos primeros de cada grupo avanzan a semifinales.',
    knockout: 'Llaves eliminatorias. Los empates se resuelven por penales.'
  };

  help.textContent = helpText[typeField.value] || '';
  legs.disabled = typeField.value !== 'league';
}

function updateSelectedCount() {
  const picker = $('#teamPicker');
  const counter = $('#selectedCount');
  const selectAll = $('#selectAllTeams');
  if (!picker || !counter || !selectAll) return;

  const selected = $$('input:checked', picker);
  const total = activeTeams().length;
  counter.textContent = `${selected.length} seleccionado${selected.length === 1 ? '' : 's'}`;
  selectAll.checked = total > 0 && selected.length === total;
}

function renderTeams() {
  const picker = $('#teamPicker');
  if (picker) {
    const previouslySelected = $$('input:checked', picker).map((input) => input.value);
    const teams = activeTeams();
    picker.innerHTML = teams.map((team) => `
      <label class="team-check">
        <input type="checkbox" value="${team.id}" ${previouslySelected.includes(team.id) ? 'checked' : ''}>
        <span class="team-badge">${escapeHtml(team.initials || team.name.slice(0, 3).toUpperCase())}</span>
        <span>${escapeHtml(team.name)}</span>
      </label>
    `).join('');
    const empty = $('#noTeams');
    if (empty) empty.hidden = teams.length > 0;
    updateSelectedCount();
  }

  const list = $('#teamList');
  if (!list) return;
  list.innerHTML = state.teams.map((team) => `
    <article class="team-row">
      <div class="team-ident">
        <span class="team-badge">${escapeHtml(team.initials || team.name.slice(0, 3).toUpperCase())}</span>
        <div>
          <strong>${escapeHtml(team.name)}</strong>
          <small>${team.coach ? `DT: ${escapeHtml(team.coach)}` : 'Sin DT registrado'}${team.archived ? ' · Archivado' : ''}</small>
        </div>
      </div>
      ${isAdmin() && !team.archived ? `<button class="mini-button" data-archive-team="${team.id}">Archivar</button>` : ''}
    </article>
  `).join('');
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

function scheduleRoundRobin(tournament, ids, options = {}) {
  const legs = options.legs ?? tournament.legs ?? 1;
  for (let homeIndex = 0; homeIndex < ids.length; homeIndex += 1) {
    for (let awayIndex = homeIndex + 1; awayIndex < ids.length; awayIndex += 1) {
      createMatch(tournament, {
        phase: options.phase || 'league',
        stage: options.stage || 'Liga',
        group: options.group || null,
        homeTeamId: ids[homeIndex],
        awayTeamId: ids[awayIndex]
      });
      if (legs === 2) {
        createMatch(tournament, {
          phase: options.phase || 'league',
          stage: options.stage || 'Liga',
          group: options.group || null,
          homeTeamId: ids[awayIndex],
          awayTeamId: ids[homeIndex]
        });
      }
    }
  }
}

function scheduleGroups(tournament) {
  const groupA = [];
  const groupB = [];
  tournament.teamIds.forEach((id, index) => {
    (index % 2 === 0 ? groupA : groupB).push(id);
  });
  tournament.groups = { A: groupA, B: groupB };

  scheduleRoundRobin(tournament, groupA, { phase: 'group', stage: 'Grupo A', group: 'A', legs: 1 });
  scheduleRoundRobin(tournament, groupB, { phase: 'group', stage: 'Grupo B', group: 'B', legs: 1 });

  const semifinalOne = createMatch(tournament, {
    phase: 'knockout',
    stage: 'Semifinales',
    homeSource: { type: 'group', group: 'A', rank: 1 },
    awaySource: { type: 'group', group: 'B', rank: 2 }
  });
  const semifinalTwo = createMatch(tournament, {
    phase: 'knockout',
    stage: 'Semifinales',
    homeSource: { type: 'group', group: 'B', rank: 1 },
    awaySource: { type: 'group', group: 'A', rank: 2 }
  });

  createMatch(tournament, {
    phase: 'knockout',
    stage: 'Tercer lugar',
    homeSource: { type: 'match', matchId: semifinalOne.id, result: 'loser' },
    awaySource: { type: 'match', matchId: semifinalTwo.id, result: 'loser' }
  });
  createMatch(tournament, {
    phase: 'knockout',
    stage: 'Final',
    homeSource: { type: 'match', matchId: semifinalOne.id, result: 'winner' },
    awaySource: { type: 'match', matchId: semifinalTwo.id, result: 'winner' }
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
  while (remaining.length) {
    slots.push(remaining.shift() || null, remaining.shift() || null);
  }

  let previousRound = [];
  for (let size = bracketSize; size >= 2; size /= 2) {
    const currentRound = [];
    for (let index = 0; index < size / 2; index += 1) {
      const stage = size === 2 ? 'Final' : size === 4 ? 'Semifinales' : 'Cuartos de final';
      const data = { phase: 'knockout', stage };
      if (size === bracketSize) {
        data.homeTeamId = slots[index * 2] || null;
        data.awayTeamId = slots[index * 2 + 1] || null;
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
  const ids = group ? (tournament.groups?.[group] || []) : tournament.teamIds;
  const table = new Map(ids.map((id) => [id, {
    teamId: id, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, points: 0
  }]));

  matchesForTournament(tournament.id)
    .filter((match) => {
      if (!match.completed || match.autoAdvance) return false;
      if (group) return match.phase === 'group' && match.group === group;
      return match.phase === 'league';
    })
    .forEach((match) => {
      const homeId = match.playedHomeId || match.homeTeamId;
      const awayId = match.playedAwayId || match.awayTeamId;
      const home = table.get(homeId);
      const away = table.get(awayId);
      if (!home || !away) return;

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

  return Array.from(table.values()).sort((a, b) =>
    b.points - a.points ||
    (b.gf - b.ga) - (a.gf - a.ga) ||
    b.gf - a.gf ||
    teamName(a.teamId).localeCompare(teamName(b.teamId))
  );
}

function resolveSource(tournament, source) {
  if (!source) return null;

  if (source.type === 'group') {
    const groupMatches = matchesForTournament(tournament.id).filter((match) => match.phase === 'group' && match.group === source.group);
    if (!groupMatches.length || !groupMatches.every((match) => match.completed)) return null;
    return standings(tournament, source.group)[source.rank - 1]?.teamId || null;
  }

  if (source.type === 'match') {
    const match = state.matches.find((item) => item.id === source.matchId);
    if (!match?.completed) return null;
    if (source.result === 'winner') return match.winnerTeamId;
    const homeId = match.playedHomeId || match.homeTeamId;
    const awayId = match.playedAwayId || match.awayTeamId;
    if (!homeId || !awayId) return null;
    return match.winnerTeamId === homeId ? awayId : homeId;
  }

  return null;
}

function sourceLabel(source) {
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
      const homePending = match.homeSource && !home;
      const awayPending = match.awaySource && !away;

      if (home && !away && !awayPending) {
        match.completed = true;
        match.autoAdvance = true;
        match.playedHomeId = home;
        match.winnerTeamId = home;
        changed = true;
      }
      if (away && !home && !homePending) {
        match.completed = true;
        match.autoAdvance = true;
        match.playedAwayId = away;
        match.winnerTeamId = away;
        changed = true;
      }
    });
  }
}

function champion(tournament) {
  return matchesForTournament(tournament.id)
    .find((match) => match.stage === 'Final' && match.completed)?.winnerTeamId || null;
}

function globalRanking() {
  const table = new Map(state.teams.map((team) => [team.id, {
    teamId: team.id, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, points: 0
  }]));

  state.matches.filter((match) => match.completed && !match.autoAdvance).forEach((match) => {
    const homeId = match.playedHomeId || match.homeTeamId;
    const awayId = match.playedAwayId || match.awayTeamId;
    const home = table.get(homeId);
    const away = table.get(awayId);
    if (!home || !away) return;

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

  return Array.from(table.values())
    .filter((row) => row.played > 0)
    .sort((a, b) =>
      b.points - a.points ||
      (b.gf - b.ga) - (a.gf - a.ga) ||
      b.gf - a.gf ||
      teamName(a.teamId).localeCompare(teamName(b.teamId))
    );
}

function rankingMarkup(rows, limit = Number.POSITIVE_INFINITY) {
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
  if (!rows.length) return '<p class="empty">No hay equipos para mostrar.</p>';
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th></tr></thead>
        <tbody>${rows.map((row) => `
          <tr>
            <td>${escapeHtml(teamName(row.teamId))}</td>
            <td>${row.played}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td>
            <td>${row.gf}</td><td>${row.ga}</td><td>${row.gf - row.ga}</td><td><b>${row.points}</b></td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>
  `;
}

function matchMarkup(tournament, match) {
  const homeId = slot(tournament, match, 'home');
  const awayId = slot(tournament, match, 'away');
  const home = homeId ? teamName(homeId) : sourceLabel(match.homeSource);
  const away = awayId ? teamName(awayId) : sourceLabel(match.awaySource);
  const score = match.autoAdvance
    ? 'Pase directo'
    : match.completed
      ? `${match.homeScore} - ${match.awayScore}${match.homePenalties !== null ? ` · Pen. ${match.homePenalties}-${match.awayPenalties}` : ''}`
      : 'Pendiente';

  return `
    <article class="match-card">
      <div><strong>${escapeHtml(home)} <span>vs.</span> ${escapeHtml(away)}</strong><small>${escapeHtml(match.stage)}${match.group ? ` · Grupo ${match.group}` : ''}</small></div>
      <div class="match-actions">
        <b>${score}</b>
        ${isAdmin() && cloudActive && homeId && awayId && !match.autoAdvance ? `<button class="mini-button" data-edit-match="${match.id}">${match.completed ? 'Editar' : 'Cargar'}</button>` : ''}
      </div>
    </article>
  `;
}

function renderHome() {
  const metrics = {
    '#metricTeams': activeTeams().length,
    '#metricTournaments': state.tournaments.length,
    '#metricMatches': state.matches.length,
    '#metricResults': state.matches.filter((match) => match.completed && !match.autoAdvance).length
  };
  Object.entries(metrics).forEach(([selector, value]) => {
    const element = $(selector);
    if (element) element.textContent = value;
  });

  const activity = $('#activityList');
  if (activity) {
    activity.innerHTML = state.activity.slice(0, 6).map((item) => `
      <article class="activity-item"><span></span><div>${escapeHtml(item.text)}<small>${new Date(item.at).toLocaleString('es-CL')}</small></div></article>
    `).join('') || '<p class="empty">Sin actividad.</p>';
  }

  const ranking = $('#homeRanking');
  if (ranking) ranking.innerHTML = rankingMarkup(globalRanking(), 5);
}

function renderTournamentList() {
  const list = $('#tournamentList');
  if (!list) return;
  list.innerHTML = state.tournaments.map((tournament) => {
    const matches = matchesForTournament(tournament.id);
    const label = tournament.type === 'league' ? 'Liga' : tournament.type === 'groups' ? 'Copa con grupos' : 'Eliminación directa';
    const winner = champion(tournament);
    return `
      <article class="list-item">
        <div><strong>${escapeHtml(tournament.name)}</strong><small>${label} · ${tournament.teamIds.length} equipos · ${matches.filter((match) => match.completed).length}/${matches.length} resueltos</small>${winner ? `<em>Campeón: ${escapeHtml(teamName(winner))}</em>` : ''}</div>
        <button class="mini-button" data-view-tournament="${tournament.id}">Ver</button>
      </article>
    `;
  }).join('') || '<p class="empty">Todavía no hay torneos.</p>';
}

function renderMatches() {
  const filter = $('#matchFilter');
  const list = $('#matchesList');
  if (!filter || !list) return;

  const previous = filter.value || 'all';
  filter.innerHTML = `<option value="all">Todos los torneos</option>${state.tournaments.map((tournament) => `<option value="${tournament.id}">${escapeHtml(tournament.name)}</option>`).join('')}`;
  filter.value = state.tournaments.some((tournament) => tournament.id === previous) ? previous : 'all';

  list.innerHTML = state.matches
    .filter((match) => filter.value === 'all' || match.tournamentId === filter.value)
    .map((match) => matchMarkup(tournamentById(match.tournamentId), match))
    .join('') || '<p class="empty">No hay partidos.</p>';
}

function renderStats() {
  const ranking = globalRanking();
  const global = $('#globalRanking');
  if (global) global.innerHTML = rankingMarkup(ranking);

  const titles = new Map();
  state.tournaments.forEach((tournament) => {
    const winner = champion(tournament);
    if (winner) titles.set(winner, (titles.get(winner) || 0) + 1);
  });

  const honours = $('#honoursList');
  if (honours) {
    honours.innerHTML = titles.size
      ? Array.from(titles.entries()).sort((a, b) => b[1] - a[1]).map(([teamId, total]) => `
        <div class="rank-row"><b>★</b><div><strong>${escapeHtml(teamName(teamId))}</strong><small>Campeón de ${total} torneo${total === 1 ? '' : 's'}</small></div><strong>${total}</strong></div>
      `).join('')
      : '<p class="empty">El palmarés aparecerá cuando se complete una final.</p>';
  }
}

function renderDetail() {
  const root = $('#tournamentDetail');
  if (!root) return;
  const tournament = tournamentById(selectedTournamentId);
  if (!tournament) {
    root.innerHTML = '';
    return;
  }

  const matches = matchesForTournament(tournament.id);
  const regular = matches.filter((match) => match.phase !== 'knockout');
  const knockout = matches.filter((match) => match.phase === 'knockout');

  let tables = '';
  if (tournament.groups) {
    tables = `<div class="detail-grid">${['A', 'B'].map((group) => `<article class="panel"><h2>Grupo ${group}</h2>${tableMarkup(standings(tournament, group))}</article>`).join('')}</div>`;
  } else if (tournament.type === 'league') {
    tables = `<article class="panel"><h2>Tabla de posiciones</h2>${tableMarkup(standings(tournament))}</article>`;
  }

  const stages = Array.from(new Set(knockout.map((match) => match.stage)));
  const bracket = stages.length
    ? `<article class="panel"><h2>Llaves</h2>${stages.map((stage) => `<div class="stage"><h4>${escapeHtml(stage)}</h4>${knockout.filter((match) => match.stage === stage).map((match) => matchMarkup(tournament, match)).join('')}</div>`).join('')}</article>`
    : '';

  const fixture = regular.length
    ? `<article class="panel"><h2>Fixture</h2>${regular.map((match) => matchMarkup(tournament, match)).join('')}</article>`
    : '';

  root.innerHTML = `
    <div class="page-title"><p class="eyebrow">DETALLE</p><h1>${escapeHtml(tournament.name)}</h1><p>${tournament.teamIds.map((id) => escapeHtml(teamName(id))).join(' · ')}</p></div>
    ${tables}${fixture}${bracket}
  `;
}

function renderAdmin() {
  const info = $('#cloudInfo');
  if (info) {
    info.textContent = cloudActive
      ? (isAdmin() ? 'Tu sesión administra la base compartida.' : 'La base compartida está disponible en modo consulta.')
      : (isAdmin() ? 'No existe una base v2 activa. Puedes crearla sin modificar los datos antiguos.' : 'Inicia sesión para activar la base compartida.');
  }

  const activate = $('#activateCloud');
  const sync = $('#syncNow');
  const reset = $('#resetCloud');
  const importFile = $('#importFile');

  if (activate) activate.hidden = !(isAdmin() && cloudLoaded && !cloudActive);
  if (sync) sync.hidden = !(isAdmin() && cloudActive);
  if (reset) reset.disabled = !canEdit();
  if (importFile) importFile.disabled = !canEdit();
}

function render() {
  renderAuthState();
  renderTournamentControls();
  renderTeams();
  renderHome();
  renderTournamentList();
  renderMatches();
  renderStats();
  renderDetail();
  renderAdmin();
}

function openModal(html) {
  const modal = $('#modal');
  const content = $('#modalContent');
  if (!modal || !content) return;
  content.innerHTML = html;
  modal.hidden = false;
}

function closeModal() {
  const modal = $('#modal');
  const content = $('#modalContent');
  if (modal) modal.hidden = true;
  if (content) content.innerHTML = '';
}

function openLoginModal() {
  openModal(`
    <h2>Ingreso administrador</h2>
    <p>Solo la cuenta configurada puede modificar equipos, torneos y resultados.</p>
    <form id="loginForm">
      <label>Correo<input value="${ADMIN_EMAIL}" disabled></label>
      <label>Contraseña<input id="loginPassword" type="password" required minlength="6" autocomplete="current-password"></label>
      <div class="modal-actions"><button type="button" class="secondary" data-close-modal>Cancelar</button><button class="primary" type="submit">Ingresar</button></div>
      <button id="createAdminAccount" type="button" class="link-button">Crear mi cuenta por primera vez</button>
    </form>
  `);

  const loginForm = $('#loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await signInWithEmailAndPassword(auth, ADMIN_EMAIL, $('#loginPassword').value);
        closeModal();
        showToast('Sesión iniciada.');
      } catch (error) {
        console.error(error);
        showToast(error.code === 'auth/invalid-credential'
          ? 'Contraseña incorrecta o cuenta inexistente.'
          : 'No se pudo iniciar sesión.');
      }
    });
  }

  const createButton = $('#createAdminAccount');
  if (createButton) {
    createButton.addEventListener('click', async () => {
      try {
        await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, $('#loginPassword').value);
        closeModal();
        showToast('Cuenta administradora creada.');
      } catch (error) {
        console.error(error);
        showToast(error.code === 'auth/email-already-in-use'
          ? 'La cuenta ya existe. Usa Ingresar.'
          : 'Usa una contraseña de al menos 6 caracteres.');
      }
    });
  }
}

function openResultModal(matchId) {
  const match = state.matches.find((item) => item.id === matchId);
  const tournament = match ? tournamentById(match.tournamentId) : null;
  if (!match || !tournament) return;

  const homeId = slot(tournament, match, 'home');
  const awayId = slot(tournament, match, 'away');
  if (!homeId || !awayId) {
    showToast('Este partido depende de resultados anteriores.');
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
      ${match.phase === 'knockout' ? `
        <div id="penaltiesFields" class="two-fields" hidden>
          <label>Penales ${escapeHtml(teamName(homeId))}<input id="homePenalties" type="number" min="0" value="${match.homePenalties ?? ''}"></label>
          <label>Penales ${escapeHtml(teamName(awayId))}<input id="awayPenalties" type="number" min="0" value="${match.awayPenalties ?? ''}"></label>
        </div>
        <p class="hint">Si hay empate en una llave, registra penales.</p>
      ` : ''}
      <div class="modal-actions"><button type="button" class="secondary" data-close-modal>Cancelar</button><button class="primary" type="submit">Guardar resultado</button></div>
    </form>
  `);

  const updatePenaltyVisibility = () => {
    const homeValue = $('#homeScore')?.value;
    const awayValue = $('#awayScore')?.value;
    const penaltyFields = $('#penaltiesFields');
    if (penaltyFields) penaltyFields.hidden = !(homeValue !== '' && homeValue === awayValue);
  };

  $('#homeScore')?.addEventListener('input', updatePenaltyVisibility);
  $('#awayScore')?.addEventListener('input', updatePenaltyVisibility);
  updatePenaltyVisibility();

  $('#resultForm')?.addEventListener('submit', (event) => {
    event.preventDefault();

    const homeScore = Number($('#homeScore').value);
    const awayScore = Number($('#awayScore').value);
    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) {
      showToast('Ingresa marcadores válidos.');
      return;
    }

    let winner = homeScore > awayScore ? homeId : awayScore > homeScore ? awayId : null;
    let homePenalties = null;
    let awayPenalties = null;

    if (match.phase === 'knockout' && !winner) {
      homePenalties = Number($('#homePenalties').value);
      awayPenalties = Number($('#awayPenalties').value);
      if (!Number.isInteger(homePenalties) || !Number.isInteger(awayPenalties) || homePenalties < 0 || awayPenalties < 0 || homePenalties === awayPenalties) {
        showToast('Los penales deben definir un ganador.');
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
      : `Resultado registrado: ${teamName(homeId)} ${homeScore}-${awayScore} ${teamName(awayId)}.`);

    queueSave();
    closeModal();
    render();
    showToast('Resultado guardado.');
  });
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `chute-mundo-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
  showToast('Respaldo descargado.');
}

async function importBackup(file) {
  if (!canEdit()) {
    showToast('Inicia sesión y activa la base compartida primero.');
    return;
  }
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed.teams) || !Array.isArray(parsed.matches)) throw new Error('Invalid backup');
    if (!window.confirm('La restauración reemplazará la base compartida. ¿Continuar?')) return;
    state = normalizeState(parsed);
    addActivity('Se restauró un respaldo JSON.');
    await writeCloudState();
    render();
    showToast('Respaldo restaurado.');
  } catch (error) {
    console.error(error);
    showToast('El archivo no parece un respaldo válido.');
  }
}

function bindEvents() {
  $('#authButton')?.addEventListener('click', () => {
    if (isAdmin()) signOut(auth);
    else openLoginModal();
  });

  $('#tournamentType')?.addEventListener('change', renderTournamentControls);
  $('#teamPicker')?.addEventListener('change', updateSelectedCount);
  $('#selectAllTeams')?.addEventListener('change', (event) => {
    $$('#teamPicker input').forEach((input) => {
      input.checked = event.target.checked;
    });
    updateSelectedCount();
  });

  $('#tournamentForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!canEdit()) {
      showToast('Inicia sesión y activa la base compartida antes de crear torneos.');
      return;
    }

    const name = $('#tournamentName').value.trim();
    const type = $('#tournamentType').value;
    const ids = $$('#teamPicker input:checked').map((input) => input.value);
    const minimum = type === 'groups' ? 4 : 2;

    if (!name) return showToast('Escribe un nombre para el torneo.');
    if (ids.length < minimum) return showToast(`Este formato requiere al menos ${minimum} equipos.`);
    if (type === 'knockout' && ids.length > 8) return showToast('La eliminación directa admite hasta 8 equipos.');

    const tournament = {
      id: uid('tournament'),
      name,
      type,
      legs: Number($('#tournamentLegs').value),
      teamIds: ids,
      groups: null,
      createdAt: Date.now()
    };
    state.tournaments.unshift(tournament);

    if (type === 'league') scheduleRoundRobin(tournament, ids);
    if (type === 'groups') scheduleGroups(tournament);
    if (type === 'knockout') scheduleKnockout(tournament);

    addActivity(`Se creó ${type === 'league' ? 'Liga' : type === 'groups' ? 'Copa con grupos' : 'Eliminación directa'}: ${name}.`);
    selectedTournamentId = tournament.id;
    $('#tournamentName').value = '';
    queueSave();
    render();
    showToast('Torneo generado.');
  });

  $('#teamForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!canEdit()) {
      showToast('Inicia sesión y activa la base compartida antes de agregar equipos.');
      return;
    }

    const name = $('#teamName').value.trim();
    if (!name) return;
    if (state.teams.some((team) => team.name.toLowerCase() === name.toLowerCase())) {
      showToast('Ese equipo ya existe.');
      return;
    }

    const initials = ($('#teamInitials').value.trim() || name.split(/\s+/).map((part) => part[0]).join('').slice(0, 4)).toUpperCase();
    state.teams.push({
      id: uid('team'),
      name,
      initials,
      coach: $('#teamCoach').value.trim(),
      archived: false
    });
    addActivity(`Se agregó el equipo ${name}.`);
    event.target.reset();
    queueSave();
    render();
    showToast('Equipo agregado.');
  });

  $('#matchFilter')?.addEventListener('change', renderMatches);
  $('#exportButton')?.addEventListener('click', exportBackup);

  $('#importFile')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (file) await importBackup(file);
    event.target.value = '';
  });

  $('#activateCloud')?.addEventListener('click', async () => {
    if (!isAdmin()) {
      showToast('Inicia sesión primero.');
      return;
    }
    try {
      setStatus('Activando base…');
      await setDoc(sharedStateRef, {
        state,
        version: '2.2.0',
        updatedAt: serverTimestamp(),
        updatedBy: ADMIN_EMAIL
      }, { merge: true });
      cloudActive = true;
      setStatus('Sincronizado');
      render();
      showToast('Base compartida activada.');
    } catch (error) {
      console.error(error);
      setStatus('Error al activar');
      showToast('Firebase rechazó la activación. Revisa las reglas de Firestore.');
    }
  });

  $('#syncNow')?.addEventListener('click', async () => {
    if (!canEdit()) return;
    try {
      await writeCloudState();
      showToast('Sincronización completada.');
    } catch (error) {
      console.error(error);
      showToast('No se pudo sincronizar.');
    }
  });

  $('#resetCloud')?.addEventListener('click', () => {
    if (!canEdit()) {
      showToast('Inicia sesión y activa la base compartida primero.');
      return;
    }
    if (!window.confirm('Se eliminarán torneos y resultados compartidos. ¿Continuar?')) return;

    const teams = state.teams;
    state = freshState();
    state.teams = teams;
    selectedTournamentId = null;
    addActivity('Se reiniciaron torneos y resultados compartidos.');
    queueSave();
    render();
    showToast('Datos reiniciados.');
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
    if (editButton && isAdmin()) openResultModal(editButton.dataset.editMatch);

    const archiveButton = event.target.closest('[data-archive-team]');
    if (archiveButton && isAdmin() && canEdit()) {
      const team = teamById(archiveButton.dataset.archiveTeam);
      if (team && window.confirm(`¿Archivar ${team.name}? Su historial se conservará.`)) {
        team.archived = true;
        addActivity(`Se archivó ${team.name}.`);
        queueSave();
        render();
      }
    }

    if (event.target.matches('[data-close-modal]')) closeModal();
  });

  $('#modal')?.addEventListener('click', (event) => {
    if (event.target.id === 'modal') closeModal();
  });
}

async function initializeCloud() {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (error) {
    console.warn('Persistence could not be set', error);
  }

  onAuthStateChanged(auth, (user) => {
    authUser = user || null;
    if (isAdmin()) {
      setStatus(cloudActive ? 'Sincronizado' : 'Sesión administradora');
    } else {
      setStatus(cloudActive ? 'Consulta en tiempo real' : 'Base pendiente');
    }
    render();
  });

  onSnapshot(sharedStateRef, (snapshot) => {
    cloudLoaded = true;
    if (snapshot.exists() && snapshot.data()?.state) {
      state = normalizeState(snapshot.data().state);
      cloudActive = true;
      persistLocal();
      setStatus(isAdmin() ? 'Sincronizado' : 'Consulta en tiempo real');
    } else {
      cloudActive = false;
      setStatus(isAdmin() ? 'Sesión administradora' : 'Base pendiente');
    }
    render();
  }, (error) => {
    console.error('Firestore listener failed', error);
    cloudLoaded = true;
    cloudActive = false;
    setStatus('Firebase no disponible');
    render();
  });

  try {
    await getDoc(sharedStateRef);
  } catch {
    // The realtime listener above displays the appropriate state.
  }
}

bindEvents();
render();
initializeCloud();
