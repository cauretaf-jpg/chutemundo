import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  getIdTokenResult
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const VERSION = window.CHUTE_APP_VERSION || '6.0.0';
const LEGACY_ADMIN_EMAIL = 'cauretaf@gmail.com';
const LOCAL_STORAGE_KEY = 'chute_mundo_firebase_official_v3';
let auth = null;
let db = null;
let sharedStateRef = null;

async function loadFirebaseConfig() {
  const response = await fetch('/firebase-config.json?v=' + encodeURIComponent(VERSION), { cache: 'no-store' });
  if (!response.ok) throw new Error('No se pudo leer la configuración Firebase.');
  return response.json();
}

async function initializeFirebaseServices() {
  const config = await loadFirebaseConfig();
  const firebaseApp = initializeApp(config);
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
  sharedStateRef = doc(db, 'chuteMundo', 'sharedState');
}

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const clone = (value) => JSON.parse(JSON.stringify(value));
const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

let legacyState = null;
let state = emptyState();
let authUser = null;
let authClaims = {};
let cloudLoaded = false;
let cloudHasHistory = false;
let usingFallback = true;
let selectedTournamentId = null;
let saveTimer = null;
let toastTimer = null;
let migrationRunning = false;

function emptyState() {
  return {
    version: VERSION,
    config: {},
    rules: [],
    participants: [],
    teams: [],
    classics: [],
    friendlies: [],
    tournaments: [],
    discipline: { records: [] },
    divisions: { A: [], B: [] },
    fifaRanking: [],
    playerIds: {},
    playerIdentitySchema: 'player-ids-v1',
    activity: []
  };
}

function playerName(player) {
  return Array.isArray(player) ? player[0] : (player?.name || '');
}

function teamInitials(name = '') {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 4).toUpperCase();
}

function normalizeMatch(match, tournamentId = '') {
  const source = match && typeof match === 'object' ? match : {};
  const converted = {
    ...source,
    id: source.id || uid('match'),
    tournamentId: source.tournamentId || tournamentId,
    stage: source.stage || source.phase || 'regular',
    round: source.round || source.stage || 'Partido',
    label: source.label || source.stage || 'Partido',
    group: source.group || null,
    home: source.home ?? source.playedHomeId ?? source.homeTeamId ?? null,
    away: source.away ?? source.playedAwayId ?? source.awayTeamId ?? null,
    homeRef: source.homeRef || null,
    awayRef: source.awayRef || null,
    homeGoals: source.homeGoals ?? source.homeScore ?? null,
    awayGoals: source.awayGoals ?? source.awayScore ?? null,
    homePens: source.homePens ?? source.homePenalties ?? null,
    awayPens: source.awayPens ?? source.awayPenalties ?? null,
    date: source.date || '',
    time: source.time || '',
    venue: source.venue || '',
    notes: source.notes || '',
    homeGoalLog: source.homeGoalLog || '',
    awayGoalLog: source.awayGoalLog || '',
    homeCardLog: source.homeCardLog || '',
    awayCardLog: source.awayCardLog || '',
    goals: Array.isArray(source.goals) ? source.goals : [],
    cards: Array.isArray(source.cards) ? source.cards : [],
    specialEvents: Array.isArray(source.specialEvents) ? source.specialEvents : [],
    lineups: source.lineups && typeof source.lineups === 'object' ? source.lineups : null,
    autoAdvance: Boolean(source.autoAdvance)
  };

  if (!converted.homeRef && source.homeSource) converted.homeRef = convertOldSource(source.homeSource);
  if (!converted.awayRef && source.awaySource) converted.awayRef = convertOldSource(source.awaySource);
  return converted;
}

function convertOldSource(source) {
  if (!source) return null;
  if (source.type === 'group') return `GROUP_${source.group}_${source.rank}`;
  if (source.type === 'match') {
    const prefix = String(source.matchId || '').toUpperCase().includes('Q') ? 'QF' : 'S';
    const number = String(source.matchId || '').match(/(\d+)/)?.[1] || '1';
    return `${prefix}${number}_${source.result === 'loser' ? 'L' : 'W'}`;
  }
  return null;
}

function normalizeMetricCollection(raw, kind) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw).map(([key, value]) => {
    if (Array.isArray(value)) return value.length && typeof value[0] === 'string' ? value : [key, ...value];
    if (value && typeof value === 'object') {
      const name = value.name ?? value.playerName ?? value.player ?? value.scorer ?? value.assist ?? key;
      const team = value.teamId ?? value.team ?? value.clubId ?? value.club ?? '';
      const appearances = value.appearances ?? value.matches ?? value.games ?? value.pj ?? 0;
      const metric = kind === 'goals'
        ? (value.goals ?? value.value ?? value.total ?? value.count ?? 0)
        : (value.assists ?? value.value ?? value.total ?? value.count ?? 0);
      return [String(name || key), String(team || ''), Number(appearances) || 0, Number(metric) || 0];
    }
    return [String(key), '', 0, Number(value) || 0];
  });
}

function normalizeTournament(tournament, separateMatches = []) {
  const source = tournament && typeof tournament === 'object' ? tournament : {};
  const typeMap = { groups: 'cup_groups', knockout: 'direct_knockout' };
  const groups = Array.isArray(source.groups)
    ? source.groups
    : source.groups && typeof source.groups === 'object'
      ? Object.entries(source.groups).map(([name, teamIds]) => ({ name: `Grupo ${name}`, teamIds }))
      : [];
  const embeddedMatches = Array.isArray(source.matches)
    ? source.matches
    : separateMatches.filter((match) => match.tournamentId === source.id);

  return {
    ...source,
    id: source.id || uid('tour'),
    name: source.name || 'Torneo sin nombre',
    type: typeMap[source.type] || source.type || 'league',
    status: source.status || (source.champion ? 'historical' : 'upcoming'),
    createdAt: source.createdAt || source.created || new Date().toLocaleDateString('es-CL'),
    config: { ...(source.config || {}), legs: Number(source.config?.legs || source.legs || 1) },
    teamIds: Array.isArray(source.teamIds) ? source.teamIds : (Array.isArray(source.teams) ? source.teams : []),
    groups,
    matches: embeddedMatches.map((match) => normalizeMatch(match, source.id)),
    manualStandings: Array.isArray(source.manualStandings) ? source.manualStandings : [],
    playerScorers: normalizeMetricCollection(source.playerScorers, 'goals'),
    playerAssists: normalizeMetricCollection(source.playerAssists, 'assists'),
    notes: Array.isArray(source.notes) ? source.notes : [],
    champion: source.champion || null,
    runnerUp: source.runnerUp || null,
    third: source.third || null,
    participantLocal: source.participantLocal || '',
    participantAway: source.participantAway || '',
    participantChampion: source.participantChampion || '',
    participantRunnerUp: source.participantRunnerUp || '',
    participantThird: source.participantThird || ''
  };
}

function normalizeState(value) {
  let parsedValue = value;
  if (typeof parsedValue === 'string') {
    try { parsedValue = JSON.parse(parsedValue); }
    catch (error) { console.error('Estado Firebase JSON inválido.', error); parsedValue = {}; }
  }
  const source = parsedValue && typeof parsedValue === 'object' ? parsedValue : {};
  const separateMatches = Array.isArray(source.matches) ? source.matches : [];
  const teams = Array.isArray(source.teams) ? source.teams.map((team) => ({
    ...team,
    id: team.id || uid('team'),
    name: team.name || 'Equipo sin nombre',
    initials: team.initials || teamInitials(team.name),
    coach: team.coach || '',
    archived: Boolean(team.archived),
    players: Array.isArray(team.players) ? team.players : []
  })) : [];

  return {
    ...emptyState(),
    ...source,
    version: VERSION,
    config: source.config || {},
    rules: Array.isArray(source.rules) ? source.rules : [],
    participants: Array.isArray(source.participants) ? source.participants : [],
    teams,
    classics: Array.isArray(source.classics) ? source.classics : [],
    friendlies: Array.isArray(source.friendlies) ? source.friendlies.map((match) => normalizeMatch(match, 'friendly')) : [],
    tournaments: Array.isArray(source.tournaments)
      ? source.tournaments.map((tournament) => normalizeTournament(tournament, separateMatches))
      : [],
    discipline: source.discipline || { records: [] },
    divisions: source.divisions || { A: [], B: [] },
    fifaRanking: Array.isArray(source.fifaRanking) ? source.fifaRanking : [],
    playerIds: source.playerIds && typeof source.playerIds === 'object' ? source.playerIds : {},
    playerIdentitySchema: source.playerIdentitySchema || 'player-ids-v1',
    activity: Array.isArray(source.activity) ? source.activity : []
  };
}

async function loadLegacyState() {
  const [historyResponse, tournament8Response] = await Promise.all([
    fetch('/official-history.json?v=' + encodeURIComponent(window.CHUTE_APP_VERSION || '6.0.0'), { cache: 'no-store' }),
    fetch('/tournament-8.json?v=4.1.1', { cache: 'no-store' })
  ]);
  if (!historyResponse.ok) throw new Error(`No se pudo leer el historial oficial (${historyResponse.status}).`);
  if (!tournament8Response.ok) throw new Error(`No se pudo leer el 8vo torneo (${tournament8Response.status}).`);

  const normalized = normalizeState(await historyResponse.json());
  const tournament8 = normalizeTournament(await tournament8Response.json());
  const existingIndex = normalized.tournaments.findIndex((tournament) => tournament.id === tournament8.id);
  if (existingIndex >= 0) normalized.tournaments[existingIndex] = tournament8;
  else normalized.tournaments.push(tournament8);

  normalized.activity = [{
    id: uid('activity'),
    text: `Historial oficial recuperado: ${normalized.tournaments.length} torneos.`,
    at: Date.now()
  }];
  return normalized;
}

function persistLocal() {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
}

function isAdmin() {
  return Boolean(authUser && (
    authClaims?.admin === true ||
    authClaims?.role === 'admin' ||
    (authUser.email && authUser.email.toLowerCase() === LEGACY_ADMIN_EMAIL)
  ));
}

function canEdit() {
  return isAdmin() && cloudLoaded;
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
  toastTimer = setTimeout(() => { target.hidden = true; }, 3600);
}

function teamById(id) {
  return state.teams.find((team) => team.id === id) || null;
}

function teamName(id) {
  return teamById(id)?.name || 'Por definir';
}

function participantName(id) {
  return state.participants.find((participant) => participant.id === id)?.name || 'Sin asignar';
}

function tournamentById(id) {
  return state.tournaments.find((tournament) => tournament.id === id) || null;
}

function matchPlayed(match) {
  return match && match.homeGoals !== null && match.homeGoals !== '' && match.awayGoals !== null && match.awayGoals !== '';
}

function typeLabel(type) {
  return ({
    league: 'Liga',
    league_playoff: 'Liga + Playoff',
    cup_groups: 'Copa con grupos',
    direct_knockout: 'Eliminación directa',
    division_final: 'División con final'
  })[type] || type;
}

function statusLabel(status) {
  return ({ upcoming: 'Próximo', active: 'Activo', historical: 'Histórico' })[status] || status;
}

function allOfficialMatches(tournaments = state.tournaments) {
  return tournaments.flatMap((tournament) => tournament.matches.map((match) => ({ ...match, tournamentId: tournament.id })));
}

function sortStandings(rows) {
  return rows.sort((a, b) =>
    b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.gc - b.gc || teamName(a.teamId).localeCompare(teamName(b.teamId), 'es')
  ).map((row, index) => ({ ...row, pos: index + 1 }));
}

function computeStandingsFromMatches(teamIds, matches) {
  const table = Object.fromEntries(teamIds.map((teamId) => [teamId, { teamId, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 }]));
  matches.filter(matchPlayed).forEach((match) => {
    const homeId = match.home;
    const awayId = match.away;
    const home = table[homeId];
    const away = table[awayId];
    if (!home || !away) return;
    const homeGoals = Number(match.homeGoals);
    const awayGoals = Number(match.awayGoals);
    home.pj += 1; away.pj += 1;
    home.gf += homeGoals; home.gc += awayGoals;
    away.gf += awayGoals; away.gc += homeGoals;
    if (homeGoals > awayGoals) { home.pg += 1; away.pp += 1; home.pts += 3; }
    else if (awayGoals > homeGoals) { away.pg += 1; home.pp += 1; away.pts += 3; }
    else { home.pe += 1; away.pe += 1; home.pts += 1; away.pts += 1; }
  });
  Object.values(table).forEach((row) => { row.dg = row.gf - row.gc; });
  return sortStandings(Object.values(table));
}

function getTournamentStandings(tournament) {
  if (tournament.manualStandings?.length) return [...tournament.manualStandings].sort((a, b) => a.pos - b.pos);
  return computeStandingsFromMatches(tournament.teamIds, tournament.matches.filter((match) => match.stage === 'regular'));
}

function getGroupStandings(tournament, groupName) {
  const group = tournament.groups.find((item) => item.name === groupName);
  if (!group) return [];
  return computeStandingsFromMatches(group.teamIds, tournament.matches.filter((match) => match.stage === 'group' && match.group === groupName));
}

function determineWinnerId(match, tournament = null) {
  if (!matchPlayed(match)) return null;
  const home = tournament ? resolveHome(tournament, match) : match.home;
  const away = tournament ? resolveAway(tournament, match) : match.away;
  if (Number(match.homeGoals) > Number(match.awayGoals)) return home;
  if (Number(match.awayGoals) > Number(match.homeGoals)) return away;
  if (match.homePens !== null && match.awayPens !== null) {
    if (Number(match.homePens) > Number(match.awayPens)) return home;
    if (Number(match.awayPens) > Number(match.homePens)) return away;
  }
  return null;
}

function determineLoserId(match, tournament = null) {
  const winner = determineWinnerId(match, tournament);
  if (!winner) return null;
  const home = tournament ? resolveHome(tournament, match) : match.home;
  const away = tournament ? resolveAway(tournament, match) : match.away;
  return winner === home ? away : home;
}

function resolveRef(tournament, reference) {
  if (!reference) return null;
  if (reference.startsWith('TABLE_')) return getTournamentStandings(tournament)[Number(reference.split('_')[1]) - 1]?.teamId || null;
  const groupMatch = reference.match(/^GROUP_([AB])_(\d+)$/);
  if (groupMatch) return getGroupStandings(tournament, `Grupo ${groupMatch[1]}`)[Number(groupMatch[2]) - 1]?.teamId || null;
  const bracketReference = reference.match(/^(QF|S)(\d+)_(W|L)$/);
  if (bracketReference) {
    const [, prefix, number, result] = bracketReference;
    const round = prefix === 'QF' ? 'Cuartos de Final' : 'Semifinales';
    const labelOptions = prefix === 'QF' ? [`Cuarto ${number}`, `Cuartos ${number}`] : [`Semifinal ${number}`];
    const source = tournament.matches.find((match) => match.stage === 'knockout' && match.round === round && labelOptions.includes(match.label));
    if (!source || !matchPlayed(source)) return null;
    return result === 'W' ? determineWinnerId(source, tournament) : determineLoserId(source, tournament);  }
  return reference;
}

function resolveHome(tournament, match) {
  return match.home || resolveRef(tournament, match.homeRef);
}

function resolveAway(tournament, match) {
  return match.away || resolveRef(tournament, match.awayRef);
}

function parseGoalLog(text) {
  if (!text?.trim()) return [];
  return text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [scorer = '', assist = '', minute = ''] = line.split('|').map((part) => part.trim());
    return { scorer, assist, minute };
  });
}

function metricToken(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function metricTeamId(value, name = '') {
  const token = String(value || '').trim();
  const normalized = metricToken(token);
  const direct = state.teams.find((team) => team.id === token || metricToken(team.id) === normalized || metricToken(team.name) === normalized);
  if (direct) return direct.id;
  const candidates = state.teams.filter((team) => {
    const players = Array.isArray(team.players) ? team.players : team.players && typeof team.players === 'object' ? Object.values(team.players) : [];
    return players.some((entry) => metricToken(Array.isArray(entry) ? entry[0] : entry?.name) === metricToken(name));
  });
  return candidates.length === 1 ? candidates[0].id : token;
}

function metricRow(row, kind) {
  let name = '';
  let team = '';
  let appearances = 0;
  let value = 0;
  if (Array.isArray(row)) {
    name = row[0] ?? '';
    team = row[1] ?? '';
    appearances = row[2] ?? 0;
    value = row[3] ?? row[2] ?? 0;
  } else if (row && typeof row === 'object') {
    name = row.name ?? row.playerName ?? row.player ?? row.scorer ?? row.assist ?? '';
    team = row.teamId ?? row.team ?? row.clubId ?? row.club ?? '';
    appearances = row.appearances ?? row.matches ?? row.games ?? row.pj ?? 0;
    value = kind === 'goals'
      ? (row.goals ?? row.value ?? row.total ?? row.count ?? 0)
      : (row.assists ?? row.value ?? row.total ?? row.count ?? 0);
  }
  name = String(name || '').trim();
  const teamId = metricTeamId(team, name);
  return {
    name,
    teamId,
    appearances: Number.isFinite(Number(appearances)) ? Number(appearances) : 0,
    value: Number.isFinite(Number(value)) ? Number(value) : 0
  };
}

function tournamentMetricRows(tournament, field, kind) {
  const raw = tournament?.[field];
  const source = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.values(raw) : [];
  return source.map((row) => metricRow(row, kind)).filter((row) => row.name && row.teamId);
}

function playerRows(kind, tournaments = state.tournaments) {
  const map = new Map();
  const field = kind === 'goals' ? 'playerScorers' : 'playerAssists';
  tournaments.forEach((tournament) => {
    const manualRows = tournamentMetricRows(tournament, field, kind);
    manualRows.forEach(({ name, teamId, appearances, value }) => {
      const key = `${name}__${teamId}`;
      const current = map.get(key) || { name, teamId, appearances: 0, value: 0 };
      current.appearances += appearances;
      current.value += value;
      map.set(key, current);
    });
    (tournament.matches || []).filter(matchPlayed).forEach((match) => {
      const home = resolveHome(tournament, match);
      const away = resolveAway(tournament, match);
      [
        [home, parseGoalLog(match.homeGoalLog)],
        [away, parseGoalLog(match.awayGoalLog)]
      ].forEach(([teamId, entries]) => entries.forEach((entry) => {
        const name = kind === 'goals' ? entry.scorer : entry.assist;
        if (!name || !teamId || (kind === 'assists' && name.toLowerCase() === 'sin asistencia')) return;
        const key = `${name}__${teamId}`;
        if (manualRows.some((row) => row.name === name && row.teamId === teamId)) return;
        const current = map.get(key) || { name, teamId, appearances: 0, value: 0 };
        current.value += 1;
        map.set(key, current);
      }));
    });
  });
  return [...map.values()].sort((a, b) => b.value - a.value || b.appearances - a.appearances || a.name.localeCompare(b.name, 'es'));
}

function tournamentEra(tournament) {
  if (tournament.era) return tournament.era;
  const name = String(tournament.name || '').toLowerCase();
  return name.includes('división') || name.includes('division') ? 'division' : 'classic';
}

function filteredTournaments() {
  const era = $('#eraFilter')?.value || 'all';
  return era === 'all' ? state.tournaments : state.tournaments.filter((tournament) => tournamentEra(tournament) === era);
}

function buildGlobalStandings(tournaments = state.tournaments) {
  const table = Object.fromEntries(state.teams.map((team) => [team.id, { teamId: team.id, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 }]));
  tournaments.forEach((tournament) => {
    if (tournament.manualStandings?.length) {
      tournament.manualStandings.forEach((source) => {
        const row = table[source.teamId];
        if (!row) return;
        ['pj', 'pg', 'pe', 'pp', 'gf', 'gc', 'pts'].forEach((key) => { row[key] += Number(source[key] || 0); });
      });
    }
    tournament.matches.filter(matchPlayed).forEach((match) => {
      if (tournament.manualStandings?.length && match.stage === 'regular') return;
      const homeId = resolveHome(tournament, match);
      const awayId = resolveAway(tournament, match);
      const home = table[homeId];
      const away = table[awayId];
      if (!home || !away) return;
      const homeGoals = Number(match.homeGoals);
      const awayGoals = Number(match.awayGoals);
      home.pj += 1; away.pj += 1;
      home.gf += homeGoals; home.gc += awayGoals;
      away.gf += awayGoals; away.gc += homeGoals;
      if (homeGoals > awayGoals) { home.pg += 1; away.pp += 1; home.pts += 3; }
      else if (awayGoals > homeGoals) { away.pg += 1; home.pp += 1; away.pts += 3; }
      else { home.pe += 1; away.pe += 1; home.pts += 1; away.pts += 1; }
    });
  });
  Object.values(table).forEach((row) => { row.dg = row.gf - row.gc; });
  return sortStandings(Object.values(table)).filter((row) => row.pj > 0);
}

function addActivity(text) {
  state.activity = Array.isArray(state.activity) ? state.activity : [];
  state.activity.unshift({ id: uid('activity'), text, at: Date.now() });
  state.activity = state.activity.slice(0, 50);
}

async function writeCloudState({ force = false } = {}) {
  if (!isAdmin() || !cloudLoaded) throw new Error('La sesión administrativa o Firebase todavía no están disponibles.');
  setStatus('Guardando…');
  const normalizedState = normalizeState(state);
  const serializedState = JSON.stringify(normalizedState);
  await setDoc(sharedStateRef, {
    state: serializedState,
    stateEncoding: 'json-v1',
    stateBytes: new Blob([serializedState]).size,
    version: VERSION,
    updatedAt: serverTimestamp(),
    updatedBy: authUser?.email || 'admin',
    migratedFrom: 'data.js'
  }, { merge: true });
  cloudHasHistory = true;
  usingFallback = false;
  persistLocal();
  setStatus('Sincronizado');
}

function queueSave() {
  persistLocal();
  if (!isAdmin() || !cloudLoaded) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try { await writeCloudState(); }
    catch (error) { console.error(error); setStatus('Error al guardar'); showToast(`Firebase rechazó el guardado: ${error.code || error.message || 'error desconocido'}.`); }
  }, 400);
}

async function migrateOfficialHistory({ confirmReplace = false } = {}) {
  if (!isAdmin()) return showToast('Inicia sesión con la cuenta administradora.');
  if (!legacyState || migrationRunning) return;
  if (confirmReplace && !window.confirm('Se reemplazará la base compartida por el historial oficial original. ¿Continuar?')) return;
  migrationRunning = true;
  try {
    state = clone(legacyState);
    addActivity(`Historial oficial restaurado en Firebase (${state.tournaments.length} torneos).`);
    await writeCloudState({ force: true });
    selectedTournamentId = state.tournaments.find((tournament) => tournament.status === 'active')?.id || state.tournaments.at(-1)?.id || null;
    render();
    showToast('Historial oficial restaurado y sincronizado.');
  } catch (error) {
    console.error(error);
    showToast(`No se pudo guardar el historial en Firebase: ${error.code || error.message || 'error desconocido'}.`);
  } finally {
    migrationRunning = false;
  }
}

async function tryAutomaticMigration() {
  if (!isAdmin() || !cloudLoaded || cloudHasHistory || !legacyState || migrationRunning) return;
  await migrateOfficialHistory();
}

function navigate(page) {
  $$('.page').forEach((section) => { section.hidden = section.id !== page; });
  $$('.nav-button[data-page]').forEach((button) => button.classList.toggle('active', button.dataset.page === page));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderAuthState() {
  $('#authButton').textContent = isAdmin() ? 'Cerrar sesión' : 'Ingresar';
  $$('.admin-only').forEach((element) => { element.hidden = !isAdmin(); });
  const migrateButton = $('#migrateHistory');
  if (migrateButton) migrateButton.hidden = !(isAdmin() && !cloudHasHistory);
  const syncButton = $('#syncNow');
  if (syncButton) syncButton.hidden = !(isAdmin() && cloudLoaded);
}

function renderSourceNotice() {
  const notice = $('#sourceNotice');
  if (!notice) return;
  if (cloudHasHistory) {
    notice.className = 'notice success';
    notice.textContent = `Base Firebase activa: ${state.tournaments.length} torneos y ${allOfficialMatches().filter(matchPlayed).length} resultados sincronizados.`;
  } else {
    notice.className = 'notice warning';
    notice.textContent = `Historial recuperado desde la base original (${state.tournaments.length} torneos). Inicia sesión como administrador para guardarlo definitivamente en Firebase.`;
  }
}

function metricCard(value, label, detail = '') {
  return `<article><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span>${detail ? `<small class="muted">${escapeHtml(detail)}</small>` : ''}</article>`;
}

function renderHome() {
  const matches = allOfficialMatches().filter((match) => match.stage !== 'bye');
  const played = matches.filter(matchPlayed);
  const goals = played.reduce((sum, match) => sum + Number(match.homeGoals || 0) + Number(match.awayGoals || 0), 0);
  const players = state.teams.reduce((sum, team) => sum + (team.players?.length || 0), 0);
  $('#homeMetrics').innerHTML = [
    metricCard(state.teams.filter((team) => !team.archived).length, 'Equipos', `${players} jugadores`),
    metricCard(state.tournaments.length, 'Torneos', `${state.tournaments.filter((tournament) => tournament.champion).length} finalizados`),
    metricCard(played.length, 'Partidos jugados', `${matches.length - played.length} pendientes`),
    metricCard(goals, 'Goles registrados', played.length ? `${(goals / played.length).toFixed(2)} por partido` : '')
  ].join('');

  const active = [...state.tournaments].reverse().find((tournament) => tournament.status === 'active');
  $('#activeTournamentCard').innerHTML = active ? (() => {
    const matchesActive = active.matches.filter((match) => match.stage !== 'bye');
    const playedActive = matchesActive.filter(matchPlayed).length;
    const leader = active.type === 'cup_groups'
      ? getGroupStandings(active, active.groups[0]?.name || 'Grupo A')[0]
      : getTournamentStandings(active)[0];
    return `<h3>${escapeHtml(active.name)}</h3><p>${escapeHtml(typeLabel(active.type))} · ${playedActive}/${matchesActive.length} partidos</p><p>${active.type === 'cup_groups' ? 'Líder Grupo A' : 'Líder actual'}: <strong>${leader ? escapeHtml(teamName(leader.teamId)) : 'Sin tabla'}</strong></p><button class="primary mini-button" data-open-tournament="${active.id}">Abrir torneo</button>`;
  })() : '<p class="empty">No hay un torneo activo.</p>';

  $('#homeRanking').innerHTML = rankingMarkup(buildGlobalStandings().slice(0, 5));
  $('#recentTournaments').innerHTML = [...state.tournaments].slice(-4).reverse().map(tournamentListItem).join('') || '<p class="empty">No hay torneos.</p>';
}

function tournamentListItem(tournament) {
  const matches = tournament.matches.filter((match) => match.stage !== 'bye');
  const played = matches.filter(matchPlayed).length;
  return `<article class="list-item"><div><strong>${escapeHtml(tournament.name)}</strong><small>${escapeHtml(typeLabel(tournament.type))} · ${tournament.teamIds.length} equipos · ${played}/${matches.length} jugados</small>${tournament.champion ? `<em>Campeón: ${escapeHtml(teamName(tournament.champion))}</em>` : ''}</div><button class="mini-button" data-open-tournament="${tournament.id}">Abrir</button></article>`;
}

function renderTournamentControls() {
  const type = $('#tournamentType')?.value || 'league';
  const descriptions = {
    league: 'Todos contra todos. Puedes usar una o dos ruedas.',
    league_playoff: 'Fase regular y semifinales entre los cuatro primeros.',
    cup_groups: 'Dos grupos; los dos mejores de cada grupo avanzan a semifinales.',
    direct_knockout: 'Llaves directas para 2 a 8 equipos.',
    division_final: 'Fase regular y final entre primero y segundo.'
  };
  $('#formatHelp').textContent = descriptions[type];
  $('#tournamentLegs').disabled = type === 'direct_knockout';
}

function renderTeamPicker() {
  const picker = $('#teamPicker');
  if (!picker) return;
  const selected = $$('input:checked', picker).map((input) => input.value);
  const teams = state.teams.filter((team) => !team.archived);
  picker.innerHTML = teams.map((team) => `<label class="team-check"><input type="checkbox" value="${team.id}" ${selected.includes(team.id) ? 'checked' : ''}><span class="team-badge">${escapeHtml(team.initials)}</span><span>${escapeHtml(team.name)}</span></label>`).join('');
  updateSelectedCount();
}

function updateSelectedCount() {
  const picker = $('#teamPicker');
  if (!picker) return;
  const selected = $$('input:checked', picker).length;
  const total = $$('input', picker).length;
  $('#selectedCount').textContent = `${selected} seleccionado${selected === 1 ? '' : 's'}`;
  $('#selectAllTeams').checked = total > 0 && selected === total;
}

function renderTournamentList() {
  const filter = $('#tournamentStatusFilter')?.value || 'all';
  const tournaments = [...state.tournaments].filter((tournament) => filter === 'all' || tournament.status === filter).reverse();
  $('#tournamentList').innerHTML = tournaments.map(tournamentListItem).join('') || '<p class="empty">No hay torneos para este filtro.</p>';
}

function renderStandingsTable(rows, highlight = 0) {
  if (!rows.length) return '<p class="empty">Sin datos de tabla.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>PTS</th></tr></thead><tbody>${rows.map((row, index) => `<tr class="${index < highlight ? 'playoff-zone' : ''}"><td>${row.pos || index + 1}</td><td>${escapeHtml(teamName(row.teamId))}</td><td>${row.pj}</td><td>${row.pg}</td><td>${row.pe}</td><td>${row.pp}</td><td>${row.gf}</td><td>${row.gc}</td><td>${row.dg ?? row.gf - row.gc}</td><td><strong>${row.pts}</strong></td></tr>`).join('')}</tbody></table></div>`;
}

function matchMarkup(tournament, match) {
  const home = resolveHome(tournament, match);
  const away = resolveAway(tournament, match);
  const played = matchPlayed(match);
  const score = played ? `${match.homeGoals} - ${match.awayGoals}${match.homePens !== null && match.awayPens !== null ? ` (${match.homePens}-${match.awayPens} pen.)` : ''}` : 'Pendiente';
  return `<article class="match-card"><div class="match-main"><strong>${escapeHtml(teamName(home))}</strong><span class="score">${escapeHtml(score)}</span><strong class="away">${escapeHtml(teamName(away))}</strong>${canEdit() && home && away ? `<button class="mini-button" data-edit-match="${tournament.id}__${match.id}">${played ? 'Editar' : 'Registrar'}</button>` : ''}</div><div class="match-meta">${escapeHtml(match.round || '')} · ${escapeHtml(match.label || '')}${match.venue ? ` · ${escapeHtml(match.venue)}` : ''}</div></article>`;
}

function updateTournamentPodium(tournament) {
  const finalMatch = [...tournament.matches].reverse().find((match) => match.stage === 'knockout' && String(match.round).toLowerCase() === 'final' && matchPlayed(match));
  if (finalMatch) {
    tournament.champion = determineWinnerId(finalMatch, tournament);
    tournament.runnerUp = determineLoserId(finalMatch, tournament);
    tournament.status = 'historical';
  }
  const thirdMatch = tournament.matches.find((match) => match.stage === 'knockout' && String(match.round).toLowerCase().includes('3er') && matchPlayed(match));
  if (thirdMatch) tournament.third = determineWinnerId(thirdMatch, tournament);
}

function renderTournamentDetail() {
  const root = $('#tournamentDetail');
  const tournament = tournamentById(selectedTournamentId);
  if (!tournament) { root.innerHTML = ''; return; }
  updateTournamentPodium(tournament);
  let html = `<article class="panel"><div class="tournament-head"><div><p class="eyebrow">DETALLE</p><h2>${escapeHtml(tournament.name)}</h2><div class="badges"><span class="badge">${escapeHtml(typeLabel(tournament.type))}</span><span class="badge ${escapeHtml(tournament.status)}">${escapeHtml(statusLabel(tournament.status))}</span><span class="badge">${escapeHtml(tournament.createdAt)}</span></div></div></div><div class="participant-chips section-block">${tournament.teamIds.map((id) => `<span class="chip">${escapeHtml(teamName(id))}</span>`).join('')}</div></article>`;

  if (tournament.champion) {
    html += `<div class="podium"><div class="podium-item second"><b>2°</b>${escapeHtml(teamName(tournament.runnerUp))}</div><div class="podium-item first"><b>1°</b>${escapeHtml(teamName(tournament.champion))}</div><div class="podium-item third"><b>3°</b>${escapeHtml(teamName(tournament.third))}</div></div>`;
  }
  if (tournament.notes?.length) html += `<article class="panel">${tournament.notes.map((note) => `<div class="notice warning">${escapeHtml(note)}</div>`).join('')}</article>`;

  if (tournament.type === 'cup_groups') {
    tournament.groups.forEach((group) => {
      html += `<article class="panel section-block"><h3>${escapeHtml(group.name)}</h3>${renderStandingsTable(getGroupStandings(tournament, group.name), 2)}<div class="match-list section-block">${tournament.matches.filter((match) => match.stage === 'group' && match.group === group.name).map((match) => matchMarkup(tournament, match)).join('')}</div></article>`;
    });
  } else if (['league', 'league_playoff', 'division_final'].includes(tournament.type)) {
    const highlight = tournament.type === 'league_playoff' ? 4 : tournament.type === 'division_final' ? 2 : 0;
    html += `<article class="panel section-block"><h3>Tabla de posiciones</h3>${renderStandingsTable(getTournamentStandings(tournament), highlight)}</article>`;
    const regular = tournament.matches.filter((match) => match.stage === 'regular');
    if (regular.length) html += `<article class="panel section-block"><h3>Fase regular</h3><div class="match-list">${regular.map((match) => matchMarkup(tournament, match)).join('')}</div></article>`;
  }

  const knockout = tournament.matches.filter((match) => match.stage === 'knockout');
  if (knockout.length) {
    const rounds = [...new Set(knockout.map((match) => match.round))];
    html += rounds.map((round) => `<article class="panel section-block"><h3>${escapeHtml(round)}</h3><div class="match-list">${knockout.filter((match) => match.round === round).map((match) => matchMarkup(tournament, match)).join('')}</div></article>`).join('');
  }
  root.innerHTML = html;
}

function renderMatches() {
  const tournamentFilter = $('#matchTournamentFilter');
  const previous = tournamentFilter.value || 'all';
  tournamentFilter.innerHTML = `<option value="all">Todos los torneos</option>${state.tournaments.map((tournament) => `<option value="${tournament.id}">${escapeHtml(tournament.name)}</option>`).join('')}`;
  tournamentFilter.value = state.tournaments.some((tournament) => tournament.id === previous) ? previous : 'all';
  const status = $('#matchStatusFilter').value || 'all';
  const rows = state.tournaments.flatMap((tournament) => tournament.matches.map((match) => ({ tournament, match })))
    .filter(({ tournament }) => tournamentFilter.value === 'all' || tournament.id === tournamentFilter.value)
    .filter(({ match }) => match.stage !== 'bye')
    .filter(({ match }) => status === 'all' || (status === 'played' ? matchPlayed(match) : !matchPlayed(match)));
  $('#matchesList').innerHTML = rows.map(({ tournament, match }) => `<div><p class="eyebrow">${escapeHtml(tournament.name)}</p>${matchMarkup(tournament, match)}</div>`).join('') || '<p class="empty">No hay partidos para este filtro.</p>';
}

function renderTeams() {
  renderTeamPicker();
  $('#teamList').innerHTML = state.teams.map((team) => `<article class="team-row"><div class="team-ident"><span class="team-badge">${escapeHtml(team.initials)}</span><div><strong>${escapeHtml(team.name)}</strong><small>${team.coach ? `DT: ${escapeHtml(team.coach)}` : 'Sin DT'} · ${team.players?.length || 0} jugadores</small></div></div></article>`).join('') || '<p class="empty">No hay equipos.</p>';
}

function rankingMarkup(rows) {
  if (!rows.length) return '<p class="empty">Sin resultados.</p>';
  return rows.map((row, index) => `<div class="rank-row"><b>${index + 1}</b><div><strong>${escapeHtml(teamName(row.teamId))}</strong><small>${row.pj} PJ · ${row.gf}-${row.gc} goles · DG ${row.dg}</small></div><strong>${row.pts} pts</strong></div>`).join('');
}

function renderPlayerTable(rows, label) {
  if (!rows.length) return '<p class="empty">No hay datos individuales registrados.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>#</th><th>Jugador</th><th>Equipo</th><th>Part.</th><th>${escapeHtml(label)}</th></tr></thead><tbody>${rows.map((row, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(teamName(row.teamId))}</td><td>${row.appearances}</td><td><strong>${row.value}</strong></td></tr>`).join('')}</tbody></table></div>`;
}

function computeClassic(classic, tournaments) {
  const matches = [];
  tournaments.forEach((tournament) => tournament.matches.filter(matchPlayed).forEach((match) => {
    const home = resolveHome(tournament, match);
    const away = resolveAway(tournament, match);
    if ((home === classic.a && away === classic.b) || (home === classic.b && away === classic.a)) matches.push({ tournament, match, home, away });
  }));
  let aWins = 0; let bWins = 0; let draws = 0; let goalsA = 0; let goalsB = 0;
  matches.forEach(({ match, home }) => {
    const scoreA = home === classic.a ? Number(match.homeGoals) : Number(match.awayGoals);
    const scoreB = home === classic.a ? Number(match.awayGoals) : Number(match.homeGoals);
    goalsA += scoreA; goalsB += scoreB;
    if (scoreA > scoreB) aWins += 1; else if (scoreB > scoreA) bWins += 1; else draws += 1;
  });
  return { matches: matches.length, aWins, bWins, draws, goalsA, goalsB };
}

function computeParticipants(tournaments) {
  const rows = Object.fromEntries(state.participants.map((participant) => [participant.id, { ...participant, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0, titles: 0, runners: 0, thirds: 0 }]));
  tournaments.forEach((tournament) => {
    tournament.matches.filter(matchPlayed).forEach((match) => {
      const local = rows[tournament.participantLocal];
      const away = rows[tournament.participantAway];
      if (!local || !away) return;
      const homeGoals = Number(match.homeGoals); const awayGoals = Number(match.awayGoals);
      local.pj += 1; away.pj += 1; local.gf += homeGoals; local.gc += awayGoals; away.gf += awayGoals; away.gc += homeGoals;
      if (homeGoals > awayGoals) { local.pg += 1; away.pp += 1; local.pts += 3; }
      else if (awayGoals > homeGoals) { away.pg += 1; local.pp += 1; away.pts += 3; }
      else { local.pe += 1; away.pe += 1; local.pts += 1; away.pts += 1; }
    });
    if (rows[tournament.participantChampion]) rows[tournament.participantChampion].titles += 1;
    if (rows[tournament.participantRunnerUp]) rows[tournament.participantRunnerUp].runners += 1;
    if (rows[tournament.participantThird]) rows[tournament.participantThird].thirds += 1;
  });
  return Object.values(rows).sort((a, b) => b.titles - a.titles || b.pts - a.pts);
}

function computeRecords(tournaments) {
  const matches = tournaments.flatMap((tournament) => tournament.matches.filter(matchPlayed).map((match) => ({ tournament, match, home: resolveHome(tournament, match), away: resolveAway(tournament, match) }))).filter((row) => row.home && row.away);
  const biggest = [...matches].sort((a, b) => Math.abs(Number(b.match.homeGoals) - Number(b.match.awayGoals)) - Math.abs(Number(a.match.homeGoals) - Number(a.match.awayGoals)))[0];
  const mostGoals = [...matches].sort((a, b) => (Number(b.match.homeGoals) + Number(b.match.awayGoals)) - (Number(a.match.homeGoals) + Number(a.match.awayGoals)))[0];
  const totals = { matches: matches.length, goals: matches.reduce((sum, row) => sum + Number(row.match.homeGoals) + Number(row.match.awayGoals), 0) };
  const titles = new Map();
  tournaments.forEach((tournament) => { if (tournament.champion) titles.set(tournament.champion, (titles.get(tournament.champion) || 0) + 1); });
  const mostTitles = [...titles.entries()].sort((a, b) => b[1] - a[1])[0];
  return { biggest, mostGoals, totals, mostTitles };
}

function renderStats() {
  const tournaments = filteredTournaments();
  const standings = buildGlobalStandings(tournaments);
  const matches = tournaments.flatMap((tournament) => tournament.matches.filter((match) => match.stage !== 'bye'));
  const played = matches.filter(matchPlayed);
  const goals = played.reduce((sum, match) => sum + Number(match.homeGoals || 0) + Number(match.awayGoals || 0), 0);
  const scorers = playerRows('goals', tournaments);
  const assists = playerRows('assists', tournaments);
  $('#statsOverview').innerHTML = [
    metricCard(tournaments.length, 'Torneos'),
    metricCard(played.length, 'Partidos jugados'),
    metricCard(goals, 'Goles', played.length ? `${(goals / played.length).toFixed(2)} por partido` : ''),
    metricCard(standings[0] ? teamName(standings[0].teamId) : '—', 'Líder histórico', standings[0] ? `${standings[0].pts} puntos` : ''),
    metricCard(scorers[0]?.name || '—', 'Máximo goleador', scorers[0] ? `${scorers[0].value} goles` : ''),
    metricCard(assists[0]?.name || '—', 'Máximo asistidor', assists[0] ? `${assists[0].value} asistencias` : '')
  ].join('');
  $('#globalTable').innerHTML = renderStandingsTable(standings);

  const honours = state.teams.map((team) => ({
    teamId: team.id,
    titles: tournaments.filter((tournament) => tournament.champion === team.id).length,
    runners: tournaments.filter((tournament) => tournament.runnerUp === team.id).length,
    thirds: tournaments.filter((tournament) => tournament.third === team.id).length
  })).filter((row) => row.titles || row.runners || row.thirds).sort((a, b) => b.titles - a.titles || b.runners - a.runners || b.thirds - a.thirds);
  $('#honoursList').innerHTML = honours.length ? honours.map((row, index) => `<div class="rank-row"><b>${index + 1}</b><div><strong>${escapeHtml(teamName(row.teamId))}</strong><small>${row.runners} subcampeonatos · ${row.thirds} terceros</small></div><strong>${row.titles} títulos</strong></div>`).join('') : '<p class="empty">Sin títulos.</p>';

  $('#tournamentStats').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Torneo</th><th>Formato</th><th>Estado</th><th>Equipos</th><th>Jugados</th><th>Goles</th><th>Campeón</th></tr></thead><tbody>${[...tournaments].reverse().map((tournament) => {
    const tournamentMatches = tournament.matches.filter((match) => match.stage !== 'bye');
    const tournamentPlayed = tournamentMatches.filter(matchPlayed);
    const tournamentGoals = tournamentPlayed.reduce((sum, match) => sum + Number(match.homeGoals || 0) + Number(match.awayGoals || 0), 0);
    return `<tr><td>${escapeHtml(tournament.name)}</td><td>${escapeHtml(typeLabel(tournament.type))}</td><td>${escapeHtml(statusLabel(tournament.status))}</td><td>${tournament.teamIds.length}</td><td>${tournamentPlayed.length}/${tournamentMatches.length}</td><td>${tournamentGoals}</td><td>${tournament.champion ? escapeHtml(teamName(tournament.champion)) : '—'}</td></tr>`;
  }).join('')}</tbody></table></div>`;
  $('#topScorers').innerHTML = renderPlayerTable(scorers, 'Goles');
  $('#topAssists').innerHTML = renderPlayerTable(assists, 'Asistencias');

  $('#classicSummary').innerHTML = state.classics.map((classic) => {
    const result = computeClassic(classic, tournaments);
    return `<div class="record-card"><strong>${escapeHtml(classic.name)}</strong><p>${escapeHtml(teamName(classic.a))} ${result.aWins} triunfos · ${result.draws} empates · ${result.bWins} triunfos ${escapeHtml(teamName(classic.b))}</p><small class="muted">${result.matches} partidos · goles ${result.goalsA}-${result.goalsB}</small></div>`;
  }).join('') || '<p class="empty">Sin clásicos configurados.</p>';

  const participants = computeParticipants(tournaments);
  $('#participantStats').innerHTML = participants.length ? `<div class="table-wrap"><table><thead><tr><th>Participante</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>PTS</th><th>Títulos</th></tr></thead><tbody>${participants.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${row.pj}</td><td>${row.pg}</td><td>${row.pe}</td><td>${row.pp}</td><td>${row.gf}</td><td>${row.gc}</td><td>${row.pts}</td><td>${row.titles}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Sin participantes asignados.</p>';

  const records = computeRecords(tournaments);
  $('#recordsGrid').innerHTML = [
    records.biggest ? `<div class="record-card"><strong>Mayor goleada</strong><span>${escapeHtml(teamName(records.biggest.home))} ${records.biggest.match.homeGoals}-${records.biggest.match.awayGoals} ${escapeHtml(teamName(records.biggest.away))}</span><small class="muted">${escapeHtml(records.biggest.tournament.name)}</small></div>` : '',
    records.mostGoals ? `<div class="record-card"><strong>Partido con más goles</strong><span>${escapeHtml(teamName(records.mostGoals.home))} ${records.mostGoals.match.homeGoals}-${records.mostGoals.match.awayGoals} ${escapeHtml(teamName(records.mostGoals.away))}</span><small class="muted">${Number(records.mostGoals.match.homeGoals) + Number(records.mostGoals.match.awayGoals)} goles</small></div>` : '',
    `<div class="record-card"><strong>Totales históricos</strong><span>${records.totals.matches} partidos · ${records.totals.goals} goles</span><small class="muted">${records.totals.matches ? (records.totals.goals / records.totals.matches).toFixed(2) : '0'} goles por partido</small></div>`,
    records.mostTitles ? `<div class="record-card"><strong>Más títulos</strong><span>${escapeHtml(teamName(records.mostTitles[0]))}</span><small class="muted">${records.mostTitles[1]} campeonatos</small></div>` : ''
  ].filter(Boolean).join('');
}

function renderAdmin() {
  const info = $('#cloudInfo');
  if (cloudHasHistory) info.textContent = `Firebase contiene ${state.tournaments.length} torneos. Los cambios se comparten entre dispositivos.`;
  else if (isAdmin()) info.textContent = 'El historial está visible como respaldo local y se está preparando para guardarlo en Firebase.';
  else info.textContent = 'El historial está visible. Inicia sesión como administrador para dejarlo guardado en Firebase.';
}

function render() {
  renderAuthState();
  renderSourceNotice();
  renderHome();
  renderTournamentControls();
  renderTournamentList();
  renderTournamentDetail();
  renderMatches();
  renderTeams();
  renderStats();
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
  openModal(`<h2>Ingreso administrador</h2><p>Utiliza una cuenta de Firebase autorizada para modificar torneos y resultados.</p><form id="loginForm"><label>Correo<input id="loginEmail" type="email" required autocomplete="username"></label><label>Contraseña<input id="loginPassword" type="password" required minlength="6" autocomplete="current-password"></label><div class="modal-actions"><button type="button" class="secondary" data-close-modal>Cancelar</button><button class="primary" type="submit">Ingresar</button></div></form>`);
  $('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const email = $('#loginEmail').value.trim();
      await signInWithEmailAndPassword(auth, email, $('#loginPassword').value);
      closeModal();
      showToast('Sesión iniciada.');
    } catch (error) {
      console.error(error);
      showToast('No se pudo iniciar sesión. Revisa las credenciales y permisos.');
    }
  });
}

function openResultModal(tournamentId, matchId) {
  const tournament = tournamentById(tournamentId);
  const match = tournament?.matches.find((item) => item.id === matchId);
  if (!tournament || !match) return;
  const home = resolveHome(tournament, match);
  const away = resolveAway(tournament, match);
  if (!home || !away) return showToast('Este partido depende de resultados anteriores.');
  const knockout = match.stage === 'knockout';
  openModal(`<h2>${escapeHtml(match.round)}</h2><p>${escapeHtml(teamName(home))} vs. ${escapeHtml(teamName(away))}</p><form id="resultForm"><div class="form-grid"><label>${escapeHtml(teamName(home))}<input id="homeGoals" type="number" min="0" required value="${match.homeGoals ?? ''}"></label><label>${escapeHtml(teamName(away))}<input id="awayGoals" type="number" min="0" required value="${match.awayGoals ?? ''}"></label></div>${knockout ? `<div class="form-grid"><label>Penales ${escapeHtml(teamName(home))}<input id="homePens" type="number" min="0" value="${match.homePens ?? ''}"></label><label>Penales ${escapeHtml(teamName(away))}<input id="awayPens" type="number" min="0" value="${match.awayPens ?? ''}"></label></div>` : ''}<label>Fecha<input id="matchDate" type="date" value="${escapeHtml(match.date || '')}"></label><label>Lugar<input id="matchVenue" value="${escapeHtml(match.venue || '')}"></label><div class="modal-actions"><button type="button" class="secondary" data-close-modal>Cancelar</button><button class="primary" type="submit">Guardar resultado</button></div></form>`);
  $('#resultForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const homeGoals = Number($('#homeGoals').value);
    const awayGoals = Number($('#awayGoals').value);
    if (!Number.isInteger(homeGoals) || !Number.isInteger(awayGoals) || homeGoals < 0 || awayGoals < 0) return showToast('Ingresa marcadores válidos.');
    let homePens = null; let awayPens = null;
    if (knockout && homeGoals === awayGoals) {
      homePens = Number($('#homePens').value); awayPens = Number($('#awayPens').value);
      if (!Number.isInteger(homePens) || !Number.isInteger(awayPens) || homePens < 0 || awayPens < 0 || homePens === awayPens) return showToast('Los penales deben definir un ganador.');
    }
    match.home = home; match.away = away; match.homeGoals = homeGoals; match.awayGoals = awayGoals; match.homePens = homePens; match.awayPens = awayPens; match.date = $('#matchDate').value; match.venue = $('#matchVenue').value.trim();
    updateTournamentPodium(tournament);
    addActivity(`Resultado: ${teamName(home)} ${homeGoals}-${awayGoals} ${teamName(away)}.`);
    queueSave(); closeModal(); render(); showToast('Resultado guardado.');
  });
}

function roundRobin(teamIds) {
  const teams = [...teamIds];
  if (teams.length % 2) teams.push(null);
  const rounds = [];
  for (let round = 0; round < teams.length - 1; round += 1) {
    const pairs = [];
    for (let index = 0; index < teams.length / 2; index += 1) {
      const a = teams[index]; const b = teams[teams.length - 1 - index];
      if (a && b) pairs.push(round % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
    }
    rounds.push(pairs);
    const fixed = teams[0]; const rest = teams.slice(1); rest.unshift(rest.pop()); teams.splice(0, teams.length, fixed, ...rest);
  }
  return rounds;
}

function newMatch(data = {}) {
  return { id: uid('m'), stage: data.stage || 'regular', round: data.round || 'Jornada', label: data.label || 'Partido', group: data.group || null, home: data.home || null, away: data.away || null, homeRef: data.homeRef || null, awayRef: data.awayRef || null, homeGoals: null, awayGoals: null, homePens: null, awayPens: null, date: '', time: '', venue: '', homeGoalLog: '', awayGoalLog: '', cards: [] };
}

function leagueMatches(teamIds, legs = 1, stage = 'regular', group = null) {
  const rounds = roundRobin(teamIds); const matches = [];
  const append = (pairs, offset, reverse = false) => pairs.forEach((round, roundIndex) => round.forEach((pair, matchIndex) => matches.push(newMatch({ stage, group, round: `${stage === 'group' ? 'Fecha' : 'Jornada'} ${offset + roundIndex + 1}`, label: `Partido ${matchIndex + 1}`, home: reverse ? pair.away : pair.home, away: reverse ? pair.home : pair.away }))));
  append(rounds, 0);
  if (legs === 2) append(rounds, rounds.length, true);
  return matches;
}

function buildFixtures(tournament) {
  const ids = [...tournament.teamIds];
  const legs = tournament.config.legs;
  const ko = (round, label, home = null, away = null, homeRef = null, awayRef = null) => newMatch({ stage: 'knockout', round, label, home, away, homeRef, awayRef });
  tournament.matches = [];
  tournament.groups = [];
  if (tournament.type === 'league') tournament.matches.push(...leagueMatches(ids, legs));
  if (tournament.type === 'league_playoff') tournament.matches.push(
    ...leagueMatches(ids, legs),
    ko('Semifinales', 'Semifinal 1', null, null, 'TABLE_1', 'TABLE_4'),
    ko('Semifinales', 'Semifinal 2', null, null, 'TABLE_2', 'TABLE_3'),
    ko('3er Lugar', '3er Puesto', null, null, 'S1_L', 'S2_L'),
    ko('Final', 'Final', null, null, 'S1_W', 'S2_W')
  );
  if (tournament.type === 'division_final') tournament.matches.push(...leagueMatches(ids, legs), ko('Final', 'Final', null, null, 'TABLE_1', 'TABLE_2'));
  if (tournament.type === 'cup_groups') {
    const groupA = ids.filter((_, index) => index % 2 === 0);
    const groupB = ids.filter((_, index) => index % 2 === 1);
    tournament.groups = [{ name: 'Grupo A', teamIds: groupA }, { name: 'Grupo B', teamIds: groupB }];
    tournament.matches.push(
      ...leagueMatches(groupA, legs, 'group', 'Grupo A'),
      ...leagueMatches(groupB, legs, 'group', 'Grupo B'),
      ko('Semifinales', 'Semifinal 1', null, null, 'GROUP_A_1', 'GROUP_B_2'),
      ko('Semifinales', 'Semifinal 2', null, null, 'GROUP_B_1', 'GROUP_A_2'),
      ko('3er Lugar', '3er Puesto', null, null, 'S1_L', 'S2_L'),
      ko('Final', 'Final', null, null, 'S1_W', 'S2_W')
    );
  }
  if (tournament.type !== 'direct_knockout') return;
  if (ids.length === 2) tournament.matches.push(ko('Final', 'Final', ids[0], ids[1]));
  if (ids.length === 3) tournament.matches.push(ko('Semifinales', 'Semifinal 1', ids[1], ids[2]), ko('Final', 'Final', ids[0], null, null, 'S1_W'));
  if (ids.length === 4) tournament.matches.push(
    ko('Semifinales', 'Semifinal 1', ids[0], ids[3]), ko('Semifinales', 'Semifinal 2', ids[1], ids[2]),
    ko('3er Lugar', '3er Puesto', null, null, 'S1_L', 'S2_L'), ko('Final', 'Final', null, null, 'S1_W', 'S2_W')
  );
  if (ids.length === 5) tournament.matches.push(
    ko('Cuartos de Final', 'Cuarto 1', ids[3], ids[4]),
    ko('Semifinales', 'Semifinal 1', ids[0], null, null, 'QF1_W'), ko('Semifinales', 'Semifinal 2', ids[1], ids[2]),
    ko('3er Lugar', '3er Puesto', null, null, 'S1_L', 'S2_L'), ko('Final', 'Final', null, null, 'S1_W', 'S2_W')
  );
  if (ids.length === 6) tournament.matches.push(
    ko('Cuartos de Final', 'Cuarto 1', ids[2], ids[5]), ko('Cuartos de Final', 'Cuarto 2', ids[3], ids[4]),
    ko('Semifinales', 'Semifinal 1', ids[0], null, null, 'QF1_W'), ko('Semifinales', 'Semifinal 2', ids[1], null, null, 'QF2_W'),
    ko('3er Lugar', '3er Puesto', null, null, 'S1_L', 'S2_L'), ko('Final', 'Final', null, null, 'S1_W', 'S2_W')
  );
  if (ids.length === 7) tournament.matches.push(
    ko('Cuartos de Final', 'Cuarto 1', ids[1], ids[6]), ko('Cuartos de Final', 'Cuarto 2', ids[2], ids[5]), ko('Cuartos de Final', 'Cuarto 3', ids[3], ids[4]),
    ko('Semifinales', 'Semifinal 1', ids[0], null, null, 'QF1_W'), ko('Semifinales', 'Semifinal 2', null, null, 'QF2_W', 'QF3_W'),
    ko('3er Lugar', '3er Puesto', null, null, 'S1_L', 'S2_L'), ko('Final', 'Final', null, null, 'S1_W', 'S2_W')
  );
  if (ids.length === 8) tournament.matches.push(
    ko('Cuartos de Final', 'Cuarto 1', ids[0], ids[7]), ko('Cuartos de Final', 'Cuarto 2', ids[3], ids[4]),
    ko('Cuartos de Final', 'Cuarto 3', ids[1], ids[6]), ko('Cuartos de Final', 'Cuarto 4', ids[2], ids[5]),
    ko('Semifinales', 'Semifinal 1', null, null, 'QF1_W', 'QF2_W'), ko('Semifinales', 'Semifinal 2', null, null, 'QF3_W', 'QF4_W'),
    ko('3er Lugar', '3er Puesto', null, null, 'S1_L', 'S2_L'), ko('Final', 'Final', null, null, 'S1_W', 'S2_W')
  );
}

function mergeStateHistory(remoteState, historicalState) {
  const merged = normalizeState(remoteState || historicalState || emptyState());
  const historical = normalizeState(historicalState || emptyState());
  for (const team of historical.teams) if (!merged.teams.some((item) => item.id === team.id)) merged.teams.push(team);
  for (const participant of historical.participants) if (!merged.participants.some((item) => item.id === participant.id)) merged.participants.push(participant);
  for (const classic of historical.classics) if (!merged.classics.some((item) => item.id === classic.id)) merged.classics.push(classic);
  for (const original of historical.tournaments) {
    const current = merged.tournaments.find((item) => item.id === original.id);
    if (!current) { merged.tournaments.push(original); continue; }
    const matchIds = new Set(current.matches.map((match) => match.id));
    for (const match of original.matches) if (!matchIds.has(match.id)) current.matches.push(match);
    if (!current.manualStandings.length) current.manualStandings = original.manualStandings;
    current.champion ||= original.champion;
    current.runnerUp ||= original.runnerUp;
    current.third ||= original.third;
    if (!current.playerScorers.length) current.playerScorers = original.playerScorers;
    if (!current.playerAssists.length) current.playerAssists = original.playerAssists;
  }
  return normalizeState(merged);
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const pageButton = event.target.closest('[data-page]');
    if (pageButton) navigate(pageButton.dataset.page);
    const openButton = event.target.closest('[data-open-tournament]');
    if (openButton) { selectedTournamentId = openButton.dataset.openTournament; navigate('torneos'); renderTournamentDetail(); }
    const editButton = event.target.closest('[data-edit-match]');
    if (editButton && canEdit()) { const [tournamentId, matchId] = editButton.dataset.editMatch.split('__'); openResultModal(tournamentId, matchId); }
    if (event.target.matches('[data-close-modal]')) closeModal();
  });
  $('#modal').addEventListener('click', (event) => { if (event.target.id === 'modal') closeModal(); });
  $('#authButton').addEventListener('click', () => { if (isAdmin()) signOut(auth); else openLoginModal(); });
  $('#tournamentType').addEventListener('change', renderTournamentControls);
  $('#teamPicker').addEventListener('change', updateSelectedCount);
  $('#selectAllTeams').addEventListener('change', (event) => { $$('#teamPicker input').forEach((input) => { input.checked = event.target.checked; }); updateSelectedCount(); });
  $('#tournamentStatusFilter').addEventListener('change', renderTournamentList);
  $('#matchTournamentFilter').addEventListener('change', renderMatches);
  $('#matchStatusFilter').addEventListener('change', renderMatches);
  $('#eraFilter').addEventListener('change', renderStats);
  $('#migrateHistory').addEventListener('click', () => migrateOfficialHistory());
  $('#syncNow').addEventListener('click', async () => {
    try { await writeCloudState(); showToast('Sincronización completada.'); }
    catch (error) { console.error(error); showToast(`No se pudo sincronizar: ${error.code || error.message || 'error desconocido'}.`); }
  });
  $('#restoreOriginal').addEventListener('click', () => migrateOfficialHistory({ confirmReplace: true }));
  $('#exportButton').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `chute-mundo-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  });
  $('#importFile').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !canEdit()) return showToast('Inicia sesión antes de importar.');
    try {
      const imported = normalizeState(JSON.parse(await file.text()));
      if (!imported.teams.length || !imported.tournaments.length) throw new Error('Respaldo vacío');
      if (!window.confirm(`Se importarán ${imported.tournaments.length} torneos. ¿Continuar?`)) return;
      state = mergeStateHistory(imported, legacyState);
      addActivity('Se restauró un respaldo JSON.');
      await writeCloudState();
      render();
      showToast('Respaldo restaurado.');
    } catch (error) { console.error(error); showToast(`El archivo no es válido: ${error.message || 'error desconocido'}.`); }
  });
  $('#teamForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!canEdit()) return showToast('Inicia sesión como administrador para editar.');
    const name = $('#teamName').value.trim();
    if (!name) return;
    if (state.teams.some((team) => team.name.toLowerCase() === name.toLowerCase())) return showToast('Ese equipo ya existe.');
    state.teams.push({ id: uid('team'), name, coach: $('#teamCoach').value.trim(), initials: ($('#teamInitials').value.trim() || teamInitials(name)).toUpperCase(), archived: false, players: [] });
    event.target.reset();
    addActivity(`Se agregó ${name}.`);
    persistLocal();
    render();
    try { await writeCloudState({ force: true }); showToast('Equipo creado y sincronizado.'); }
    catch (error) { console.error(error); showToast(`Equipo local; Firebase: ${error.code || error.message || 'error desconocido'}.`); }
  });
  $('#tournamentForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!canEdit()) return showToast('Inicia sesión como administrador para crear torneos.');
    const name = $('#tournamentName').value.trim();
    const type = $('#tournamentType').value;
    const teamIds = $$('#teamPicker input:checked').map((input) => input.value);
    const minimum = ['league_playoff', 'cup_groups'].includes(type) ? 4 : 2;
    if (!name) return showToast('Escribe un nombre.');
    if (state.tournaments.some((tournament) => tournament.name.toLowerCase() === name.toLowerCase())) return showToast('Ya existe un torneo con ese nombre.');
    if (teamIds.length < minimum) return showToast(`Este formato requiere al menos ${minimum} equipos.`);
    if (type === 'direct_knockout' && teamIds.length > 8) return showToast('La eliminación directa admite hasta 8 equipos.');
    const tournament = normalizeTournament({ id: uid('tour'), name, type, status: $('#tournamentStatus').value, createdAt: new Date().toLocaleDateString('es-CL'), config: { legs: Number($('#tournamentLegs').value) }, teamIds, matches: [], groups: [], notes: [], playerScorers: [], playerAssists: [], participantLocal: state.participants[0]?.id || '', participantAway: state.participants[1]?.id || '' });
    buildFixtures(tournament);
    state.tournaments.push(tournament);
    selectedTournamentId = tournament.id;
    addActivity(`Se creó ${name}.`);
    event.target.reset();
    $('#tournamentType').value = 'league';
    persistLocal();
    render();
    navigate('torneos');
    try { await writeCloudState({ force: true }); showToast(`Torneo “${name}” creado y sincronizado.`); }
    catch (error) { console.error(error); showToast(`Torneo local; Firebase: ${error.code || error.message || 'error desconocido'}.`); }
  });
}

async function initializeCloud() {
  try { await setPersistence(auth, browserLocalPersistence); } catch (error) { console.warn(error); }
  onAuthStateChanged(auth, async (user) => {
    authUser = user || null;
    authClaims = {};
    if (authUser) {
      try { authClaims = (await getIdTokenResult(authUser, true)).claims || {}; }
      catch (error) { console.warn('No se pudieron leer los roles de Firebase.', error); }
    }
    renderAuthState();
    document.dispatchEvent(new CustomEvent('chute:auth-changed', { detail: { isAdmin: isAdmin(), user: authUser ? { uid: authUser.uid, email: authUser.email || '' } : null } }));
    setStatus(isAdmin() ? 'Sesión administradora activa' : (cloudHasHistory ? 'Consulta en tiempo real' : 'Historial recuperado'));
    render();
  });
  onSnapshot(sharedStateRef, async (snapshot) => {
    cloudLoaded = true;
    const remote = snapshot.exists() && snapshot.data()?.state ? normalizeState(snapshot.data().state) : null;
    const legacyPlayed = legacyState ? allOfficialMatches(legacyState.tournaments).filter(matchPlayed).length : 0;
    const remotePlayed = remote ? allOfficialMatches(remote.tournaments).filter(matchPlayed).length : 0;
    const complete = Boolean(remote && legacyState && remote.tournaments.length >= legacyState.tournaments.length && remotePlayed >= legacyPlayed);
    state = mergeStateHistory(remote, legacyState);
    cloudHasHistory = Boolean(remote);
    usingFallback = !complete;
    persistLocal();
    setStatus(remote ? (complete ? 'Firebase sincronizado' : 'Firebase conectado · historial completado localmente') : 'Historial recuperado');
    selectedTournamentId ||= state.tournaments.find((tournament) => tournament.status === 'active')?.id || state.tournaments.at(-1)?.id || null;
    render();
    if (isAdmin() && !complete) {
      try { await writeCloudState({ force: true }); }
      catch (error) { console.error('No se pudo completar Firebase', error); setStatus(`Firebase rechazó reparación: ${error.code || 'error'}`); }
    }
  }, (error) => {
    console.error(error);
    cloudLoaded = true;
    cloudHasHistory = false;
    usingFallback = true;
    state = mergeStateHistory(loadLocalStateSafe(), legacyState);
    setStatus(`Firebase no disponible: ${error.code || 'error'}`);
    render();
  });
}

function loadLocalStateSafe() {
  try { return normalizeState(JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || 'null')); }
  catch { return emptyState(); }
}

async function start() {
  bindEvents();
  try { await initializeFirebaseServices(); }
  catch (error) { console.error(error); setStatus('Firebase no disponible'); }
  try {
    legacyState = await loadLegacyState();
    state = mergeStateHistory(loadLocalStateSafe(), legacyState);
    selectedTournamentId = state.tournaments.find((tournament) => tournament.status === 'active')?.id || state.tournaments.at(-1)?.id || null;
    persistLocal();
    render();
  } catch (error) {
    console.error(error);
    state = loadLocalStateSafe();
    showToast('No se pudo cargar el historial original.');
    render();
  }
  if (auth && sharedStateRef) await initializeCloud();
  window.ChuteMundoCore = {
    version: VERSION,
    getState: () => state,
    setState: (nextState) => { state = normalizeState(nextState); persistLocal(); render(); },
    persistLocal,
    saveCloud: () => writeCloudState({ force: true }),
    queueSave,
    render,
    navigate,
    showToast,
    isAdmin,
    canEdit,
    teamName,
    teamById,
    tournamentById,
    resolveHome,
    resolveAway,
    matchPlayed,
    normalizeState,
    uid,
    openModal,
    closeModal,
    get authUser() { return authUser; },
    get cloudLoaded() { return cloudLoaded; },
    get cloudHasHistory() { return cloudHasHistory; }
  };
  document.dispatchEvent(new CustomEvent('chute:ready', { detail: window.ChuteMundoCore }));
}

start();
