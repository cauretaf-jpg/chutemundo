const DARK_MODE_KEY = "torneos_chute_mundo_dark_mode";
const APP_VERSION = "1.3-copas-corregidas";

let state = loadState();
let openEditors = new Set();
let currentTournamentId = null;
let currentFriendlyId = null;

function byId(id) {
  return document.getElementById(id);
}

function exists(id) {
  return !!document.getElementById(id);
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function playerName(p) {
  return Array.isArray(p) ? p[0] : (p?.name || "");
}

function playerPosition(p) {
  return Array.isArray(p) ? p[1] : (p?.position || "");
}

function playerAbilities(p) {
  if (Array.isArray(p) || !p) return null;
  const { name, position, start, minute, ...abilities } = p;
  return Object.keys(abilities).length > 0 ? abilities : null;
}

function playerStart(p) {
  return Array.isArray(p) ? false : (p?.start || false);
}

function playerMinute(p) {
  return Array.isArray(p) ? undefined : p?.minute;
}

function loadState() {
  if (window.ChuteStorage) {
    return ChuteStorage.loadLocalState(DEFAULT_DATA, normalizeState, clone);
  }

  const saved = localStorage.getItem("torneos_chute_mundo_pro_v1");

  if (!saved) {
    const fresh = clone(DEFAULT_DATA);
    normalizeState(fresh);
    localStorage.setItem("torneos_chute_mundo_pro_v1", JSON.stringify(fresh));
    return fresh;
  }

  try {
    const parsed = JSON.parse(saved);
    normalizeState(parsed);
    return parsed;
  } catch {
    const fresh = clone(DEFAULT_DATA);
    normalizeState(fresh);
    localStorage.setItem("torneos_chute_mundo_pro_v1", JSON.stringify(fresh));
    return fresh;
  }
}

function saveState(options = {}) {
  normalizeState(state);

  if (window.ChuteStorage) {
    ChuteStorage.saveLocalState(state);
  } else {
    localStorage.setItem("torneos_chute_mundo_pro_v1", JSON.stringify(state));
  }

  if (options.syncCloud && window.SupabaseService && SupabaseService.isEnabled()) {
    SupabaseService.queueSave(state);
  }
}

function resetState() {
  state = clone(DEFAULT_DATA);
  normalizeState(state);
  saveState();
  openEditors.clear();
  currentTournamentId = null;
  currentFriendlyId = null;
  renderAll();
}

function hardResetStorage() {
  if (window.ChuteStorage) { ChuteStorage.clearLocalState(); } else { localStorage.removeItem("torneos_chute_mundo_pro_v1"); }
  state = clone(DEFAULT_DATA);
  normalizeState(state);
  saveState();
  openEditors.clear();
  currentTournamentId = null;
  currentFriendlyId = null;
  renderAll();
}

function normalizeState(data) {
  if (!data.config) data.config = clone(DEFAULT_DATA.config);
  if (!data.config.fifa) data.config.fifa = clone(DEFAULT_DATA.config.fifa);
  if (!data.config.fifa.weights) data.config.fifa.weights = clone(DEFAULT_DATA.config.fifa.weights);
  if (!data.config.fifa.bonus) data.config.fifa.bonus = clone(DEFAULT_DATA.config.fifa.bonus);
  if (!data.config.discipline) data.config.discipline = clone(DEFAULT_DATA.config.discipline);

  if (!Array.isArray(data.rules)) data.rules = [];
  if (!Array.isArray(data.teams)) data.teams = [];
  if (!Array.isArray(data.classics)) data.classics = [];
  if (!Array.isArray(data.friendlies)) data.friendlies = [];
  if (!Array.isArray(data.tournaments)) data.tournaments = [];
  if (!data.discipline) data.discipline = { records: [] };
  if (!Array.isArray(data.discipline.records)) data.discipline.records = [];
  if (!data.divisions) data.divisions = { A: [], B: [] };
  if (!Array.isArray(data.divisions.A)) data.divisions.A = [];
  if (!Array.isArray(data.divisions.B)) data.divisions.B = [];
  if (!Array.isArray(data.fifaRanking)) data.fifaRanking = [];
  if (!Array.isArray(data.participants)) data.participants = [];

  data.teams.forEach(team => {
    if (!Array.isArray(team.players)) team.players = [];
    if (!team.coach) team.coach = "";
    if (!team.imageUrl) team.imageUrl = "";
  });

  data.friendlies.forEach(match => normalizeMatch(match, true));
  data.tournaments.forEach(tournament => normalizeTournament(tournament));
}

function normalizeTournament(tournament) {
  if (!tournament.config) tournament.config = { legs: 1 };
  if (tournament.config.legs === undefined || tournament.config.legs === null) {
    tournament.config.legs = 1;
  }

  if (!Array.isArray(tournament.teamIds)) tournament.teamIds = [];
  if (!Array.isArray(tournament.matches)) tournament.matches = [];
  if (!Array.isArray(tournament.playerScorers)) tournament.playerScorers = [];
  if (!Array.isArray(tournament.playerAssists)) tournament.playerAssists = [];
  if (!Array.isArray(tournament.notes)) tournament.notes = [];
  if (!Array.isArray(tournament.manualStandings)) tournament.manualStandings = [];
  if (!Array.isArray(tournament.groups)) tournament.groups = [];

  // Compatibilidad con copas creadas en versiones antiguas: si existen
  // partidos/grupos pero se perdió la lista principal de participantes,
  // la reconstruimos sin modificar resultados ni tablas guardadas.
  if (!tournament.teamIds.length) {
    const recoveredIds = [
      ...tournament.groups.flatMap(group => Array.isArray(group.teamIds) ? group.teamIds : []),
      ...tournament.matches.flatMap(match => [match.home, match.away]).filter(Boolean)
    ];
    tournament.teamIds = [...new Set(recoveredIds)];
  }

  if (!tournament.participantLocal) tournament.participantLocal = "";
  if (!tournament.participantAway) tournament.participantAway = "";
  if (!tournament.participantChampion) tournament.participantChampion = "";
  if (!tournament.participantRunnerUp) tournament.participantRunnerUp = "";
  if (!tournament.participantThird) tournament.participantThird = "";

  tournament.matches.forEach(match => normalizeMatch(match, false));
  normalizeCupGroupNames(tournament);
}

function normalizeMatch(match, isFriendly = false) {
  if (match.homeGoals === undefined) match.homeGoals = null;
  if (match.awayGoals === undefined) match.awayGoals = null;
  if (match.homePens === undefined) match.homePens = null;
  if (match.awayPens === undefined) match.awayPens = null;
  if (match.date === undefined) match.date = "";
  if (match.time === undefined) match.time = "";
  if (match.venue === undefined) match.venue = "";
  if (match.homeGoalLog === undefined) match.homeGoalLog = "";
  if (match.awayGoalLog === undefined) match.awayGoalLog = "";
  if (match.homeCardLog === undefined) match.homeCardLog = "";
  if (match.awayCardLog === undefined) match.awayCardLog = "";
  if (match.cards === undefined) match.cards = [];
  if (!Array.isArray(match.cards)) match.cards = [];
  if (isFriendly && !match.stage) match.stage = "friendly";
  if (!match.participantHome) match.participantHome = "";
  if (!match.participantAway) match.participantAway = "";
}


function normalizeCupGroupNames(tournament) {
  if (!tournament || tournament.type !== "cup_groups") return;

  const replacements = {
    "Grupo 1": "Grupo A",
    "Grupo 2": "Grupo B"
  };

  tournament.groups.forEach(group => {
    if (replacements[group.name]) group.name = replacements[group.name];
  });

  tournament.matches.forEach(match => {
    if (match.group && replacements[match.group]) {
      match.group = replacements[match.group];
    }
  });
}

function openModal() {
  if (exists("modalOverlay")) {
    byId("modalOverlay").style.display = "flex";
  }
}

function closeModal() {
  if (exists("modalOverlay")) {
    byId("modalOverlay").style.display = "none";
  }
  if (exists("modalContent")) {
    byId("modalContent").innerHTML = "";
  }
}

function setDebugStatus(text) {
  if (exists("debugStatus")) byId("debugStatus").textContent = text;
}

function updateDebugCounts() {
  if (exists("debugTeams")) byId("debugTeams").textContent = state.teams.length;
  if (exists("debugTournaments")) byId("debugTournaments").textContent = state.tournaments.length;
  if (exists("debugFriendlies")) byId("debugFriendlies").textContent = state.friendlies.length;
}

function teamName(id) {
  const team = state.teams.find(t => t.id === id);
  return team ? team.name : "Por definir";
}

function teamNameWithLogo(id) {
  const team = state.teams.find(t => t.id === id);
  if (!team) return `<span class="team-inline"><span class="team-avatar-inline">?</span> Por definir</span>`;
  
  const imageUrl = team.imageUrl || `escudos/${team.id}.png`;
  const initials = getTeamInitials(team.name);
  
  return `<span class="team-inline">
    <span class="team-avatar-inline">
      <img src="${imageUrl}" alt="${team.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
      <span style="display:none">${initials}</span>
    </span>
    ${team.name}
  </span>`;
}

function teamLogoHtml(id, size = 48) {
  const team = state.teams.find(t => t.id === id);
  if (!team) return `<span class="team-logo-placeholder" style="width:${size}px;height:${size}px">?</span>`;
  
  const imageUrl = team.imageUrl || `escudos/${team.id}.png`;
  const initials = getTeamInitials(team.name);
  
  return `<span class="team-logo" style="width:${size}px;height:${size}px">
    <img src="${imageUrl}" alt="${team.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
    <span style="display:none;font-size:${size * 0.35}px">${initials}</span>
  </span>`;
}

function getTeam(id) {
  return state.teams.find(t => t.id === id) || null;
}

function getTeamPlayers(id) {
  const team = getTeam(id);
  return team ? team.players : [];
}

function getParticipantById(id) {
  if (!id) return null;
  return state.participants.find(p => p.id === id) || null;
}

function getParticipantForRole(tournament, role) {
  if (role === "home") {
    return getParticipantById(tournament.participantLocal);
  } else if (role === "away") {
    return getParticipantById(tournament.participantAway);
  }
  return null;
}

function classicByTeams(a, b) {
  return state.classics.find(c =>
    (c.a === a && c.b === b) || (c.a === b && c.b === a)
  ) || null;
}

function matchPlayed(match) {
  return match.homeGoals !== null && match.awayGoals !== null;
}

function titleCase(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function typeLabel(type) {
  const map = {
    league: "Liga",
    league_playoff: "Liga + Playoff",
    cup_groups: "Copa con grupos",
    direct_knockout: "Eliminación directa",
    division_final: "División + Final"
  };
  return map[type] || type;
}

function tournamentFormatInfo(type) {
  const formats = {
    league: {
      title: "Liga",
      description: "Todos los equipos juegan entre sí. Puedes elegir solo ida o ida y vuelta.",
      minTeams: 2,
      legsLabel: "Fase regular"
    },
    league_playoff: {
      title: "Liga + Playoff",
      description: "Primero se juega una fase regular y luego clasifican cuatro equipos a semifinales.",
      minTeams: 4,
      legsLabel: "Fase regular"
    },
    cup_groups: {
      title: "Copa con grupos",
      description: "Los equipos se distribuyen automáticamente entre Grupo A y Grupo B. Los dos mejores de cada grupo avanzan a semifinales.",
      minTeams: 4,
      legsLabel: "Fase de grupos"
    },
    direct_knockout: {
      title: "Eliminación directa",
      description: "Cruces directos desde cuartos o semifinales, según la cantidad de equipos. No utiliza fase regular.",
      minTeams: 2,
      legsLabel: "No aplica"
    },
    division_final: {
      title: "División con final",
      description: "Todos juegan una fase regular y los dos primeros disputan la final.",
      minTeams: 2,
      legsLabel: "Fase regular"
    }
  };

  return formats[type] || formats.league;
}

function statusLabel(status) {
  const map = {
    upcoming: "Próximo",
    active: "Activo",
    historical: "Histórico"
  };
  return map[status] || status;
}

function formatDateTime(match) {
  if (!match.date && !match.time) return "-";
  if (match.date && match.time) return `${match.date}<br>${match.time}`;
  return match.date || match.time;
}

function sortStandings(rows) {
  return rows
    .sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.dg !== a.dg) return b.dg - a.dg;
      if (b.gf !== a.gf) return b.gf - a.gf;
      if (a.gc !== b.gc) return a.gc - b.gc;
      return teamName(a.teamId).localeCompare(teamName(b.teamId));
    })
    .map((row, index) => ({ ...row, pos: index + 1 }));
}

function computeStandingsFromMatches(teamIds, matches, options = {}) {
  const ignoreFriendly = options.ignoreFriendly !== false;
  const table = {};

  teamIds.forEach(id => {
    table[id] = {
      teamId: id,
      pj: 0,
      pg: 0,
      pe: 0,
      pp: 0,
      gf: 0,
      gc: 0,
      dg: 0,
      pts: 0
    };
  });

  matches
    .filter(matchPlayed)
    .filter(m => ignoreFriendly ? m.stage !== "friendly" : true)
    .forEach(m => {
      const home = table[m.home];
      const away = table[m.away];
      if (!home || !away) return;

      home.pj++;
      away.pj++;
      home.gf += Number(m.homeGoals);
      home.gc += Number(m.awayGoals);
      away.gf += Number(m.awayGoals);
      away.gc += Number(m.homeGoals);

      if (Number(m.homeGoals) > Number(m.awayGoals)) {
        home.pg++;
        away.pp++;
        home.pts += 3;
      } else if (Number(m.homeGoals) < Number(m.awayGoals)) {
        away.pg++;
        home.pp++;
        away.pts += 3;
      } else {
        home.pe++;
        away.pe++;
        home.pts += 1;
        away.pts += 1;
      }
    });

  Object.values(table).forEach(r => {
    r.dg = r.gf - r.gc;
  });

  return sortStandings(Object.values(table));
}

function getTournamentStandings(tournament) {
  if (tournament.manualStandings && tournament.manualStandings.length) {
    return [...tournament.manualStandings].sort((a, b) => a.pos - b.pos);
  }

  const regularMatches = tournament.matches.filter(m => m.stage === "regular");
  return computeStandingsFromMatches(tournament.teamIds, regularMatches);
}

function getGroupStandings(tournament, groupName) {
  const group = tournament.groups.find(g => g.name === groupName);
  if (!group) return [];

  const matches = tournament.matches.filter(
    m => m.stage === "group" && m.group === groupName
  );

  return computeStandingsFromMatches(group.teamIds, matches);
}

function resolveRef(tournament, ref) {
  if (!ref) return null;

  if (ref.startsWith("TABLE_")) {
    const pos = Number(ref.split("_")[1]);
    const table = getTournamentStandings(tournament);
    return table[pos - 1]?.teamId || null;
  }

  if (ref.startsWith("GROUP_A_")) {
    const pos = Number(ref.split("_")[2]);
    const table = getGroupStandings(tournament, "Grupo A");
    return table[pos - 1]?.teamId || null;
  }

  if (ref.startsWith("GROUP_B_")) {
    const pos = Number(ref.split("_")[2]);
    const table = getGroupStandings(tournament, "Grupo B");
    return table[pos - 1]?.teamId || null;
  }

  const bracketRef = String(ref).match(/^(QF|S)(\d+)_(W|L)$/);
  if (bracketRef) {
    const [, prefix, num, resultType] = bracketRef;
    const round = prefix === "QF" ? "Cuartos de Final" : "Semifinales";
    const label = prefix === "QF" ? `Cuarto ${num}` : `Semifinal ${num}`;
    const bracketMatch = tournament.matches.find(
      m => m.stage === "knockout" && m.round === round && m.label === label
    );

    if (!bracketMatch || !matchPlayed(bracketMatch)) return null;

    const winner = determineWinnerId(bracketMatch, tournament);
    const loser = determineLoserId(bracketMatch, tournament);

    return resultType === "W" ? winner : loser;
  }

  return ref;
}
function resolveHome(tournament, match) {
  return match.home || resolveRef(tournament, match.homeRef);
}

function resolveAway(tournament, match) {
  return match.away || resolveRef(tournament, match.awayRef);
}

function determineWinnerId(match, tournament = null) {
  if (!matchPlayed(match)) return null;

  const home = tournament ? resolveHome(tournament, match) : match.home;
  const away = tournament ? resolveAway(tournament, match) : match.away;

  if (Number(match.homeGoals) > Number(match.awayGoals)) return home;
  if (Number(match.homeGoals) < Number(match.awayGoals)) return away;

  if (match.homePens !== null && match.awayPens !== null) {
    if (Number(match.homePens) > Number(match.awayPens)) return home;
    if (Number(match.homePens) < Number(match.awayPens)) return away;
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

function countSummary() {
  const tournamentMatches = state.tournaments.flatMap(t => t.matches);
  const officialMatches = tournamentMatches.filter(m => m.stage !== "friendly");
  const playedOfficial = officialMatches.filter(matchPlayed).length;
  const totalOfficial = officialMatches.length;
  const totalFriendlies = state.friendlies.length;
  const playedFriendlies = state.friendlies.filter(matchPlayed).length;

  return {
    teams: state.teams.length,
    tournaments: state.tournaments.length,
    officialMatches: totalOfficial,
    friendlies: totalFriendlies,
    played: playedOfficial + playedFriendlies,
    pending: (totalOfficial + totalFriendlies) - (playedOfficial + playedFriendlies)
  };
}

function getCurrentChampionTournament() {
  const finished = state.tournaments.filter(t => t.champion);
  return finished.length ? finished[finished.length - 1] : null;
}

function parseGoalLog(text) {
  if (!text || !text.trim()) return [];

  return text
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split("|").map(p => p.trim());
      return {
        scorer: parts[0] || "",
        assist: parts[1] || "",
        minute: parts[2] || ""
      };
    });
}

function buildTournamentScorers(tournament) {
  const map = {};

  (tournament.playerScorers || []).forEach(row => {
    const key = `${row[0]}__${row[1]}`;
    map[key] = {
      name: row[0],
      teamId: row[1],
      matches: Number(row[2] || 0),
      value: Number(row[3] || 0),
      source: "manual",
      scope: "official",
      tournamentId: tournament.id
    };
  });

  tournament.matches.forEach(match => {
    if (!matchPlayed(match)) return;

    const home = resolveHome(tournament, match);
    const away = resolveAway(tournament, match);

    parseGoalLog(match.homeGoalLog || "").forEach(entry => {
      if (!entry.scorer || !home) return;
      const key = `${entry.scorer}__${home}`;
      if (!map[key]) {
        map[key] = {
          name: entry.scorer,
          teamId: home,
          matches: 0,
          value: 0,
          source: "log",
          scope: "official",
          tournamentId: tournament.id
        };
      }
      map[key].value += 1;
    });

    parseGoalLog(match.awayGoalLog || "").forEach(entry => {
      if (!entry.scorer || !away) return;
      const key = `${entry.scorer}__${away}`;
      if (!map[key]) {
        map[key] = {
          name: entry.scorer,
          teamId: away,
          matches: 0,
          value: 0,
          source: "log",
          scope: "official",
          tournamentId: tournament.id
        };
      }
      map[key].value += 1;
    });
  });

  return Object.values(map).sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    return a.name.localeCompare(b.name);
  });
}

function buildTournamentAssists(tournament) {
  const map = {};

  (tournament.playerAssists || []).forEach(row => {
    const key = `${row[0]}__${row[1]}`;
    map[key] = {
      name: row[0],
      teamId: row[1],
      matches: Number(row[2] || 0),
      value: Number(row[3] || 0),
      source: "manual",
      scope: "official",
      tournamentId: tournament.id
    };
  });

  tournament.matches.forEach(match => {
    if (!matchPlayed(match)) return;

    const home = resolveHome(tournament, match);
    const away = resolveAway(tournament, match);

    parseGoalLog(match.homeGoalLog || "").forEach(entry => {
      if (!entry.assist || entry.assist.toLowerCase() === "sin asistencia" || !home) return;
      const key = `${entry.assist}__${home}`;
      if (!map[key]) {
        map[key] = {
          name: entry.assist,
          teamId: home,
          matches: 0,
          value: 0,
          source: "log",
          scope: "official",
          tournamentId: tournament.id
        };
      }
      map[key].value += 1;
    });

    parseGoalLog(match.awayGoalLog || "").forEach(entry => {
      if (!entry.assist || entry.assist.toLowerCase() === "sin asistencia" || !away) return;
      const key = `${entry.assist}__${away}`;
      if (!map[key]) {
        map[key] = {
          name: entry.assist,
          teamId: away,
          matches: 0,
          value: 0,
          source: "log",
          scope: "official",
          tournamentId: tournament.id
        };
      }
      map[key].value += 1;
    });
  });

  return Object.values(map).sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    return a.name.localeCompare(b.name);
  });
}

function buildFriendlyScorers() {
  const map = {};

  state.friendlies.forEach(match => {
    if (!matchPlayed(match)) return;

    parseGoalLog(match.homeGoalLog || "").forEach(entry => {
      if (!entry.scorer || !match.home) return;
      const key = `${entry.scorer}__${match.home}`;
      if (!map[key]) {
        map[key] = {
          name: entry.scorer,
          teamId: match.home,
          matches: 0,
          value: 0,
          source: "log",
          scope: "friendly",
          tournamentId: "friendly"
        };
      }
      map[key].value += 1;
    });

    parseGoalLog(match.awayGoalLog || "").forEach(entry => {
      if (!entry.scorer || !match.away) return;
      const key = `${entry.scorer}__${match.away}`;
      if (!map[key]) {
        map[key] = {
          name: entry.scorer,
          teamId: match.away,
          matches: 0,
          value: 0,
          source: "log",
          scope: "friendly",
          tournamentId: "friendly"
        };
      }
      map[key].value += 1;
    });
  });

  return Object.values(map).sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    return a.name.localeCompare(b.name);
  });
}

function buildFriendlyAssists() {
  const map = {};

  state.friendlies.forEach(match => {
    if (!matchPlayed(match)) return;

    parseGoalLog(match.homeGoalLog || "").forEach(entry => {
      if (!entry.assist || entry.assist.toLowerCase() === "sin asistencia" || !match.home) return;
      const key = `${entry.assist}__${match.home}`;
      if (!map[key]) {
        map[key] = {
          name: entry.assist,
          teamId: match.home,
          matches: 0,
          value: 0,
          source: "log",
          scope: "friendly",
          tournamentId: "friendly"
        };
      }
      map[key].value += 1;
    });

    parseGoalLog(match.awayGoalLog || "").forEach(entry => {
      if (!entry.assist || entry.assist.toLowerCase() === "sin asistencia" || !match.away) return;
      const key = `${entry.assist}__${match.away}`;
      if (!map[key]) {
        map[key] = {
          name: entry.assist,
          teamId: match.away,
          matches: 0,
          value: 0,
          source: "log",
          scope: "friendly",
          tournamentId: "friendly"
        };
      }
      map[key].value += 1;
    });
  });

  return Object.values(map).sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    return a.name.localeCompare(b.name);
  });
}

function aggregatePlayers(kind = "scorers", scope = "all", tournamentId = "all", era = "all") {
  let rows = [];

  const FRIENDLY_CUTOFF = new Date("2026-04-01");
  const filteredTournaments = state.tournaments.filter(t => isTournamentInEra(t, era));

  filteredTournaments.forEach(t => {
    const arr = kind === "scorers" ? buildTournamentScorers(t) : buildTournamentAssists(t);
    rows.push(...arr);
  });

  const allFriendlies = kind === "scorers" ? buildFriendlyScorers() : buildFriendlyAssists();
  const friendlyRows = era === "all" ? allFriendlies : allFriendlies.filter(f => {
    const matchDate = f.date ? new Date(f.date.split("/").reverse().join("-")) : null;
    const matchEra = (!matchDate || matchDate < FRIENDLY_CUTOFF) ? "classic" : "division";
    return matchEra === era;
  });
  rows.push(...friendlyRows);

  if (scope !== "all") {
    rows = rows.filter(r => r.scope === scope);
  }

  if (tournamentId !== "all") {
    rows = rows.filter(r => r.tournamentId === tournamentId);
  }

  const map = {};

  rows.forEach(r => {
    const key = `${r.name}__${r.teamId}`;
    if (!map[key]) {
      map[key] = {
        name: r.name,
        teamId: r.teamId,
        matches: 0,
        value: 0
      };
    }
    map[key].value += Number(r.value || 0);
    map[key].matches += Number(r.matches || 0);
  });

  return Object.values(map).sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    return a.name.localeCompare(b.name);
  });
}

function computeTeamProfile(teamId, era = "all") {
  const result = {
    tournaments: 0,
    pj: 0,
    pg: 0,
    pe: 0,
    pp: 0,
    gf: 0,
    gc: 0,
    dg: 0,
    pts: 0,
    performance: "0.0",
    titles: 0,
    runners: 0,
    thirds: 0
  };

  const FRIENDLY_CUTOFF = new Date("2026-04-01");
  const filteredTournaments = state.tournaments.filter(t => isTournamentInEra(t, era));

  filteredTournaments.forEach(t => {
    if (!t.teamIds.includes(teamId)) return;

    result.tournaments++;
    if (t.champion === teamId) result.titles++;
    if (t.runnerUp === teamId) result.runners++;
    if (t.third === teamId) result.thirds++;

    if (t.manualStandings && t.manualStandings.length) {
      const row = t.manualStandings.find(r => r.teamId === teamId);
      if (row) {
        result.pj += row.pj;
        result.pg += row.pg;
        result.pe += row.pe;
        result.pp += row.pp;
        result.gf += row.gf;
        result.gc += row.gc;
        result.pts += row.pts;
      }
    }

    t.matches.filter(matchPlayed).forEach(m => {
      const home = resolveHome(t, m);
      const away = resolveAway(t, m);
      if (home !== teamId && away !== teamId) return;
      if (t.manualStandings && t.manualStandings.length && m.stage === "regular") return;

      result.pj++;
      const gf = home === teamId ? Number(m.homeGoals) : Number(m.awayGoals);
      const gc = home === teamId ? Number(m.awayGoals) : Number(m.homeGoals);
      result.gf += gf;
      result.gc += gc;

      if (gf > gc) {
        result.pg++;
        result.pts += 3;
      } else if (gf < gc) {
        result.pp++;
      } else {
        result.pe++;
        result.pts += 1;
      }
    });
  });

  state.friendlies.filter(matchPlayed).forEach(m => {
    const matchDate = m.date ? new Date(m.date.split("/").reverse().join("-")) : null;
    const matchEra = (!matchDate || matchDate < FRIENDLY_CUTOFF) ? "classic" : "division";
    if (era !== "all" && matchEra !== era) return;
    if (m.home !== teamId && m.away !== teamId) return;

    result.pj++;
    const gf = m.home === teamId ? Number(m.homeGoals) : Number(m.awayGoals);
    const gc = m.home === teamId ? Number(m.awayGoals) : Number(m.homeGoals);

    result.gf += gf;
    result.gc += gc;

    if (gf > gc) {
      result.pg++;
      result.pts += 3;
    } else if (gf < gc) {
      result.pp++;
    } else {
      result.pe++;
      result.pts += 1;
    }
  });

  result.dg = result.gf - result.gc;
  result.performance = result.pj ? ((result.pts / (result.pj * 3)) * 100).toFixed(1) : "0.0";
  return result;
}

function buildGlobalStandings(era = "all") {
  const map = {};

  state.teams.forEach(t => {
    map[t.id] = {
      teamId: t.id,
      pj: 0,
      pg: 0,
      pe: 0,
      pp: 0,
      gf: 0,
      gc: 0,
      dg: 0,
      pts: 0
    };
  });

  const filteredTournaments = era === "all" 
    ? state.tournaments 
    : state.tournaments.filter(t => isTournamentInEra(t, era));

  filteredTournaments.forEach(t => {
    if (t.manualStandings && t.manualStandings.length) {
      t.manualStandings.forEach(r => {
        const row = map[r.teamId];
        if (!row) return;
        row.pj += r.pj;
        row.pg += r.pg;
        row.pe += r.pe;
        row.pp += r.pp;
        row.gf += r.gf;
        row.gc += r.gc;
        row.pts += r.pts;
      });
    }

    t.matches.filter(matchPlayed).forEach(m => {
      const home = resolveHome(t, m);
      const away = resolveAway(t, m);
      if (!home || !away) return;
      if (t.manualStandings && t.manualStandings.length && m.stage === "regular") return;

      const h = map[home];
      const a = map[away];
      if (!h || !a) return;

      h.pj++;
      a.pj++;
      h.gf += Number(m.homeGoals);
      h.gc += Number(m.awayGoals);
      a.gf += Number(m.awayGoals);
      a.gc += Number(m.homeGoals);

      if (Number(m.homeGoals) > Number(m.awayGoals)) {
        h.pg++;
        a.pp++;
        h.pts += 3;
      } else if (Number(m.homeGoals) < Number(m.awayGoals)) {
        a.pg++;
        h.pp++;
        a.pts += 3;
      } else {
        h.pe++;
        a.pe++;
        h.pts += 1;
        a.pts += 1;
      }
    });
  });

  state.friendlies.filter(matchPlayed).forEach(m => {
    const h = map[m.home];
    const a = map[m.away];
    if (!h || !a) return;

    h.pj++;
    a.pj++;
    h.gf += Number(m.homeGoals);
    h.gc += Number(m.awayGoals);
    a.gf += Number(m.awayGoals);
    a.gc += Number(m.homeGoals);

    if (Number(m.homeGoals) > Number(m.awayGoals)) {
      h.pg++;
      a.pp++;
      h.pts += 3;
    } else if (Number(m.homeGoals) < Number(m.awayGoals)) {
      a.pg++;
      h.pp++;
      a.pts += 3;
    } else {
      h.pe++;
      a.pe++;
      h.pts += 1;
      a.pts += 1;
    }
  });

  const rows = Object.values(map).map(r => ({ ...r, dg: r.gf - r.gc }));
  return sortStandings(rows);
}

function computeH2H(a, b) {
  const rows = [];
  let aWins = 0;
  let bWins = 0;
  let draws = 0;
  let gfA = 0;
  let gfB = 0;
  let ptsA = 0;
  let ptsB = 0;

  function processMatch(match, tournamentName, phase, isFriendly = false) {
    const home = match.home;
    const away = match.away;
    if (!((home === a && away === b) || (home === b && away === a))) return;

    let scoreA;
    let scoreB;

    if (home === a) {
      scoreA = Number(match.homeGoals);
      scoreB = Number(match.awayGoals);
    } else {
      scoreA = Number(match.awayGoals);
      scoreB = Number(match.homeGoals);
    }

    gfA += scoreA;
    gfB += scoreB;

    if (scoreA > scoreB) {
      aWins++;
      ptsA += 3;
    } else if (scoreA < scoreB) {
      bWins++;
      ptsB += 3;
    } else {
      draws++;
      ptsA += 1;
      ptsB += 1;
    }

    rows.push({
      tournament: tournamentName,
      phase,
      match: isFriendly ? "Amistoso" : phase,
      result: `${teamName(home)} ${match.homeGoals} - ${match.awayGoals} ${teamName(away)}${match.homePens !== null && match.awayPens !== null ? ` (Penales ${match.homePens}-${match.awayPens})` : ""}`
    });
  }

  state.tournaments.forEach(t => {
    t.matches.filter(matchPlayed).forEach(m => {
      const home = resolveHome(t, m);
      const away = resolveAway(t, m);
      if (!home || !away) return;
      processMatch({ ...m, home, away }, t.name, m.round, false);
    });
  });

  state.friendlies.filter(matchPlayed).forEach(m => {
    processMatch(m, "Amistoso", "Amistoso", true);
  });

  const total = rows.length;
  const maxPts = total * 3;
  const performanceA = maxPts ? ((ptsA / maxPts) * 100).toFixed(1) : "0.0";
  const performanceB = maxPts ? ((ptsB / maxPts) * 100).toFixed(1) : "0.0";

  return {
    rows,
    aWins,
    bWins,
    draws,
    gfA,
    gfB,
    total,
    performanceA,
    performanceB
  };
}

function getRecencyMultiplier(matchDate) {
  if (!matchDate) return 1;

  const now = new Date();
  const match = new Date(matchDate);
  const diffMonths = (now.getFullYear() - match.getFullYear()) * 12 + (now.getMonth() - match.getMonth());

  if (diffMonths <= 6) return 2.0;
  if (diffMonths <= 12) return 1.5;
  if (diffMonths <= 24) return 1.2;
  return 1.0;
}

function computeFifaRanking(era = "all") {
  const points = {};

  state.teams.forEach(team => {
    points[team.id] = 0;
  });

  function addPoints(teamId, value) {
    if (!teamId) return;
    if (points[teamId] === undefined) points[teamId] = 0;
    points[teamId] += value;
  }

  function getMatchDeltas(homeGoals, awayGoals, weight, recency) {
    const goalDiff = Math.abs(Number(homeGoals) - Number(awayGoals));
    const winPoints = (3 * weight) + (goalDiff * 0.5);
    const drawPoints = 1 * weight;

    if (Number(homeGoals) > Number(awayGoals)) {
      return { home: winPoints * recency, away: 0 };
    }
    if (Number(homeGoals) < Number(awayGoals)) {
      return { home: 0, away: winPoints * recency };
    }
    return { home: drawPoints * recency, away: drawPoints * recency };
  }

  const filteredTournaments = state.tournaments.filter(t => isTournamentInEra(t, era));

  filteredTournaments.forEach(t => {
    t.matches.filter(matchPlayed).forEach(m => {
      const home = resolveHome(t, m);
      const away = resolveAway(t, m);
      if (!home || !away) return;

      let weight = state.config.fifa.weights.league;

      if (m.round && String(m.round).toLowerCase().includes("final")) {
        weight = state.config.fifa.weights.final;
      } else if (m.stage === "knockout") {
        weight = state.config.fifa.weights.playoff;
      }

      const recency = getRecencyMultiplier(m.date);
      const delta = getMatchDeltas(m.homeGoals, m.awayGoals, weight, recency);
      addPoints(home, delta.home);
      addPoints(away, delta.away);
    });

    if (t.champion) addPoints(t.champion, Number(state.config.fifa.bonus.champion || 0));
    if (t.runnerUp) addPoints(t.runnerUp, Number(state.config.fifa.bonus.runnerUp || 0));
    if (t.third) addPoints(t.third, Number(state.config.fifa.bonus.third || 0));
  });

  const FRIENDLY_CUTOFF = new Date("2026-04-01");
  state.friendlies.filter(matchPlayed).forEach(m => {
    const matchDate = m.date ? new Date(m.date.split("/").reverse().join("-")) : null;
    const matchEra = (!matchDate || matchDate < FRIENDLY_CUTOFF) ? "classic" : "division";
    if (era !== "all" && matchEra !== era) return;

    const weight = Number(state.config.fifa.weights.friendly || 0.3);
    const recency = getRecencyMultiplier(m.date);
    const delta = getMatchDeltas(m.homeGoals, m.awayGoals, weight, recency);
    addPoints(m.home, delta.home);
    addPoints(m.away, delta.away);
  });

  state.fifaRanking = Object.keys(points)
    .map(teamId => ({ teamId, points: Number(points[teamId].toFixed(2)) }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return teamName(a.teamId).localeCompare(teamName(b.teamId));
    });

  return state.fifaRanking;
}
function computeDivisions() {
  const ranking = computeFifaRanking();
  state.divisions.A = ranking.slice(0, 3).map(r => r.teamId);
  state.divisions.B = ranking.slice(3, 6).map(r => r.teamId);
}

function computeDiscipline(era = "all") {
  const records = {};

  function ensureRecord(name, role, teamId) {
    const key = `${name}__${role}__${teamId}`;
    if (!records[key]) {
      records[key] = {
        id: key,
        name,
        role,
        teamId,
        yellows: 0,
        reds: 0,
        suspended: false,
        reason: ""
      };
    }
    return records[key];
  }

  function processCards(match) {
    (match.cards || []).forEach(card => {
      if (!card.name || !card.teamId) return;

      const role = card.role || "player";
      const rec = ensureRecord(card.name, role, card.teamId);

      if (card.type === "yellow") rec.yellows += 1;
      if (card.type === "red") rec.reds += 1;

      if (card.matchYellowCount && card.matchYellowCount >= Number(state.config.discipline.yellowPerMatchSuspension || 2)) {
        rec.suspended = true;
        rec.reason = "Expulsion por doble amarilla";
      }
    });
  }

  const FRIENDLY_CUTOFF = new Date("2026-04-01");
  const filteredTournaments = state.tournaments.filter(t => isTournamentInEra(t, era));

  filteredTournaments.forEach(t => {
    t.matches.forEach(processCards);
  });

  state.friendlies.forEach(m => {
    const matchDate = m.date ? new Date(m.date.split("/").reverse().join("-")) : null;
    const matchEra = (!matchDate || matchDate < FRIENDLY_CUTOFF) ? "classic" : "division";
    if (era !== "all" && matchEra !== era) return;
    processCards(m);
  });

  Object.values(records).forEach(rec => {
    if (rec.yellows >= Number(state.config.discipline.yellowAccumulationSuspension || 3)) {
      rec.suspended = true;
      if (!rec.reason) rec.reason = "Suspension por acumulacion de amarillas";
    }
    if (rec.reds > 0 && !rec.reason) {
      rec.suspended = true;
      rec.reason = "Expulsion directa";
    }
  });

  state.discipline.records = Object.values(records).sort((a, b) => {
    if (b.suspended !== a.suspended) return Number(b.suspended) - Number(a.suspended);
    if (b.yellows !== a.yellows) return b.yellows - a.yellows;
    return a.name.localeCompare(b.name);
  });
}

function buildAlerts() {
  const alerts = [];

  state.discipline.records.forEach(rec => {
    if (rec.suspended) {
      alerts.push({
        type: "danger",
        text: `${rec.name} (${teamName(rec.teamId)}) esta suspendido: ${rec.reason}.`
      });
    }
  });

  if (!alerts.length) {
    alerts.push({
      type: "ok",
      text: "Sin alertas activas."
    });
  }

  return alerts;
}

function setDarkMode(enabled) {
  localStorage.setItem(DARK_MODE_KEY, enabled ? "1" : "0");
  applyDarkModeState();
}

function applyDarkModeState() {
  const enabled = localStorage.getItem(DARK_MODE_KEY) === "1";
  document.body.classList.toggle("dark-mode", enabled);
  if (exists("darkModeBtn")) {
    byId("darkModeBtn").textContent = enabled ? "☀️ Modo claro" : "🌙 Modo oscuro";
  }
}

function refreshComputedData() {
  computeFifaRanking();
  computeDivisions();
  computeDiscipline();
}

function renderSummary() {
  if (!exists("sumTeams")) return;

  const s = countSummary();
  byId("sumTeams").textContent = s.teams;
  byId("sumTournaments").textContent = s.tournaments;
  byId("sumMatches").textContent = s.officialMatches;
  byId("sumFriendlies").textContent = s.friendlies;
  byId("sumPlayed").textContent = s.played;
  byId("sumPending").textContent = s.pending;
}

function renderAlerts() {
  if (!exists("alertsBox")) return;

  const alerts = buildAlerts();

  byId("alertsBox").innerHTML = `
    <div class="alert-list">
      ${alerts.map(a => `<div class="alert-item ${a.type}">${a.text}</div>`).join("")}
    </div>
  `;
}

function renderDivisions() {
  if (!exists("divisionsPreview")) return;

  byId("divisionsPreview").innerHTML = `
    <div class="division-box">
      <p><strong>División A:</strong> ${state.divisions.A.length ? state.divisions.A.map(teamName).join(", ") : "Sin definir"}</p>
      <p class="inline-note">Top 3 del ranking FIFA.</p>
    </div>
    <div class="division-box">
      <p><strong>División B:</strong> ${state.divisions.B.length ? state.divisions.B.map(teamName).join(", ") : "Sin definir"}</p>
      <p class="inline-note">Bottom 3 del ranking FIFA.</p>
    </div>
  `;
}

function renderFifaPreview() {
  if (!exists("fifaPreview")) return;

  const preview = state.fifaRanking.slice(0, 5);

  if (!preview.length) {
    byId("fifaPreview").innerHTML = `<p class="empty">Sin ranking disponible.</p>`;
    return;
  }

  byId("fifaPreview").innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>#</th><th>Equipo</th><th>Puntos</th></tr>
        </thead>
        <tbody>
          ${preview.map((row, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${teamNameWithLogo(row.teamId)}</td>
              <td>${row.points.toFixed(2)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderHome() {
  if (!exists("classicsHome")) return;

  byId("classicsHome").innerHTML = state.classics.map(c => `
    <div class="classic-card">
      <p><span class="badge classic">${titleCase(c.name)}</span></p>
      <p><strong>${teamName(c.a)}</strong> vs <strong>${teamName(c.b)}</strong></p>
      <div class="actions mt-10">
        <button class="btn primary small" onclick="openClassicHistory('${c.id}')">Ver historial</button>
      </div>
    </div>
  `).join("");

  const active = state.tournaments.find(t => t.status === "active");
  const activeBox = byId("activeTournamentCard");

  if (!active) {
    activeBox.innerHTML = `<p class="empty">No hay torneo activo.</p>`;
  } else {
    const standings = getTournamentStandings(active);
    const pending = active.matches.filter(m => !matchPlayed(m)).length;

    activeBox.innerHTML = `
      <p><strong>${active.name}</strong></p>
      <p>
        <span class="badge ok">Activo</span>
        <span class="badge">${typeLabel(active.type)}</span>
      </p>
      <p class="mt-10">Líder actual: <strong>${standings[0] ? teamName(standings[0].teamId) : "—"}</strong></p>
      <p>Partidos pendientes: <strong>${pending}</strong></p>
      <div class="actions mt-10">
        <button class="btn primary small" onclick="openTournament('${active.id}')">Ver torneo</button>
      </div>
    `;
  }

  const championTournament = getCurrentChampionTournament();
  const championBox = byId("currentChampionCard");
  const lastFinishedBox = byId("lastFinishedTournamentCard");

  if (!championTournament) {
    championBox.innerHTML = `<p class="empty">Sin Campeón actual.</p>`;
    lastFinishedBox.innerHTML = `<p class="empty">Sin torneos finalizados.</p>`;
  } else {
    championBox.innerHTML = `
      <p><strong>${teamName(championTournament.champion)}</strong></p>
      <p class="muted">${championTournament.name}</p>
      <div class="actions mt-10">
        <button class="btn primary small" onclick="openTournament('${championTournament.id}')">Ver torneo</button>
      </div>
    `;

    lastFinishedBox.innerHTML = `
      <p><strong>${championTournament.name}</strong></p>
      <p>Campeón: ${teamName(championTournament.champion)}</p>
      <p class="muted">${championTournament.createdAt}</p>
    `;
  }

  renderDivisions();
  renderFifaPreview();
  renderChampionTrajectory();
  renderHistoricalRecords();
  renderTournamentTimeline();
}

function renderChampionTrajectory() {
  if (!exists("championTrajectoryCard")) return;

  const finished = state.tournaments.filter(t => t.champion);
  if (!finished.length) {
    byId("championTrajectoryCard").innerHTML = `<p class="empty">Sin datos.</p>`;
    return;
  }

  const teamStats = {};
  state.teams.forEach(t => {
    teamStats[t.id] = { id: t.id, titles: 0, runners: 0, thirds: 0, name: t.name };
  });

  finished.forEach(t => {
    if (t.champion) teamStats[t.champion].titles++;
    if (t.runnerUp) teamStats[t.runnerUp].runners++;
    if (t.third) teamStats[t.third].thirds++;
  });

  const sorted = Object.values(teamStats).sort((a, b) => b.titles - a.titles || b.runners - a.runners);
  const championTeam = sorted.find(s => s.titles > 0);
  if (!championTeam) {
    byId("championTrajectoryCard").innerHTML = `<p class="empty">Sin datos.</p>`;
    return;
  }

  const trajectory = finished.map(t => {
    const isChampion = t.champion === championTeam.id;
    const isRunnerUp = t.runnerUp === championTeam.id;
    const isThird = t.third === championTeam.id;
    const pos = isChampion ? 1 : isRunnerUp ? 2 : isThird ? 3 : "-";
    return { ...t, pos };
  }).filter(t => t.pos !== "-");

  byId("championTrajectoryCard").innerHTML = `
    <div class="trajectory-header">
      <strong>${championTeam.name}</strong>
      <span class="badge ok">${championTeam.titles} títulos</span>
      <span class="badge">${championTeam.runners} subampeones</span>
      <span class="badge">${championTeam.thirds} terceros</span>
    </div>
    <div class="trajectory-list">
      ${trajectory.map(t => `
        <div class="trajectory-item ${t.pos === 1 ? 'champion' : t.pos === 2 ? 'runnerup' : 'third'}">
          <span class="trajectory-pos">${t.pos === 1 ? '1' : t.pos === 2 ? '2' : '3'}</span>
          <span class="trajectory-name">${t.name}</span>
          <span class="trajectory-date">${t.createdAt}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderHistoricalRecords() {
  if (!exists("historicalRecordsCard")) return;

  const records = computeHistoricalRecords();

  byId("historicalRecordsCard").innerHTML = `
    <div class="records-grid">
      <div class="record-section">
        <h4>Mayor goleada</h4>
        ${records.biggestWin ? `
          <p><strong>${teamName(records.biggestWin.winner)}</strong> ${records.biggestWin.goalsWinner} - ${records.biggestWin.goalsLoser} <strong>${teamName(records.biggestWin.loser)}</strong></p>
          <p class="muted">${records.biggestWin.tournament} - ${records.biggestWin.phase}</p>
        ` : `<p class="empty">Sin datos.</p>`}
      </div>
      <div class="record-section">
        <h4>Partidos con más goles</h4>
        ${records.mostGoals ? `
          <p><strong>${teamName(records.mostGoals.home)}</strong> ${records.mostGoals.homeGoals} - ${records.mostGoals.awayGoals} <strong>${teamName(records.mostGoals.away)}</strong></p>
          <p class="muted">Total: ${records.mostGoals.total} goles</p>
        ` : `<p class="empty">Sin datos.</p>`}
      </div>
      <div class="record-section">
        <h4>Racha más larga de victorias</h4>
        ${records.longestWinStreak ? `
          <p><strong>${teamName(records.longestWinStreak.team)}</strong>: ${records.longestWinStreak.streak} victorias</p>
        ` : `<p class="empty">Sin datos.</p>`}
      </div>
      <div class="record-section">
        <h4>Equipo más reciente sin perder</h4>
        ${records.mostUnbeaten ? `
          <p><strong>${teamName(records.mostUnbeaten.team)}</strong></p>
          <p class="muted">Último partido sin perder: ${records.mostUnbeaten.date || records.mostUnbeaten.tournament}</p>
        ` : `<p class="empty">Sin datos.</p>`}
      </div>
    </div>
  `;
}

function computeHistoricalRecords() {
  const records = { biggestWin: null, mostGoals: null, longestWinStreak: null, mostUnbeaten: null };

  let maxGoalDiff = 0;
  let maxTotalGoals = 0;
  const winStreaks = {};
  const lastUnbeatenMatch = {};
  state.teams.forEach(t => {
    winStreaks[t.id] = 0;
    lastUnbeatenMatch[t.id] = { team: t.id, date: null, match: null };
  });

  state.tournaments.forEach(t => {
    t.matches.filter(matchPlayed).forEach(m => {
      const home = resolveHome(t, m);
      const away = resolveAway(t, m);
      if (!home || !away) return;

      const goalDiff = Math.abs(Number(m.homeGoals) - Number(m.awayGoals));
      const totalGoals = Number(m.homeGoals) + Number(m.awayGoals);

      if (goalDiff > maxGoalDiff) {
        maxGoalDiff = goalDiff;
        records.biggestWin = {
          winner: Number(m.homeGoals) > Number(m.awayGoals) ? home : away,
          loser: Number(m.homeGoals) > Number(m.awayGoals) ? away : home,
          goalsWinner: Math.max(Number(m.homeGoals), Number(m.awayGoals)),
          goalsLoser: Math.min(Number(m.homeGoals), Number(m.awayGoals)),
          tournament: t.name,
          phase: m.round
        };
      }

      if (totalGoals > maxTotalGoals) {
        maxTotalGoals = totalGoals;
        records.mostGoals = {
          home,
          away,
          homeGoals: Number(m.homeGoals),
          awayGoals: Number(m.awayGoals),
          total: totalGoals,
          tournament: t.name,
          phase: m.round
        };
      }

      if (Number(m.homeGoals) > Number(m.awayGoals)) {
        winStreaks[home]++;
        winStreaks[away] = 0;
      } else if (Number(m.homeGoals) < Number(m.awayGoals)) {
        winStreaks[away]++;
        winStreaks[home] = 0;
      } else {
        winStreaks[home] = 0;
        winStreaks[away] = 0;
      }
    });
  });

  let maxStreak = 0;
  let maxStreakTeam = null;
  Object.entries(winStreaks).forEach(([team, streak]) => {
    if (streak > maxStreak) {
      maxStreak = streak;
      maxStreakTeam = team;
    }
  });
  if (maxStreak > 0 && maxStreakTeam) {
    records.longestWinStreak = { team: maxStreakTeam, streak: maxStreak };
  }

  state.tournaments.forEach(t => {
    t.matches.filter(matchPlayed).forEach(m => {
      const home = resolveHome(t, m);
      const away = resolveAway(t, m);
      if (!home || !away) return;

      const matchDate = m.date || t.createdAt || "";
      const homeUnbeaten = Number(m.homeGoals) >= Number(m.awayGoals);
      const awayUnbeaten = Number(m.awayGoals) >= Number(m.homeGoals);

      if (homeUnbeaten && (!lastUnbeatenMatch[home].date || matchDate > lastUnbeatenMatch[home].date)) {
        lastUnbeatenMatch[home] = { team: home, date: matchDate, tournament: t.name };
      }
      if (awayUnbeaten && (!lastUnbeatenMatch[away].date || matchDate > lastUnbeatenMatch[away].date)) {
        lastUnbeatenMatch[away] = { team: away, date: matchDate, tournament: t.name };
      }
    });
  });

  let mostRecentDate = null;
  let mostRecentTeam = null;
  Object.values(lastUnbeatenMatch).forEach(entry => {
    if (entry.date && (!mostRecentDate || entry.date > mostRecentDate)) {
      mostRecentDate = entry.date;
      mostRecentTeam = entry;
    }
  });

  if (mostRecentTeam) {
    records.mostUnbeaten = { team: mostRecentTeam.team, date: mostRecentDate, tournament: mostRecentTeam.tournament };
  }

  return records;
}

function renderTournamentTimeline() {
  if (!exists("tournamentTimelineCard")) return;

  const finished = state.tournaments.filter(t => t.champion);
  if (!finished.length) {
    byId("tournamentTimelineCard").innerHTML = `<p class="empty">Sin datos.</p>`;
    return;
  }

  byId("tournamentTimelineCard").innerHTML = `
    <div class="timeline">
      ${finished.map(t => {
        const podium = [1, 2, 3].map(pos => {
          const teamId = pos === 1 ? t.champion : pos === 2 ? t.runnerUp : t.third;
          const label = pos === 1 ? '1' : pos === 2 ? '2' : '3';
          return teamId ? `<div class="timeline-team pos${pos}"><span class="timeline-pos">${label}</span><span>${teamNameWithLogo(teamId)}</span></div>` : '';
        }).join('');
        return `
          <div class="timeline-item">
            <div class="timeline-info">
              <strong>${t.name}</strong>
              <span class="muted">${t.createdAt}</span>
            </div>
            <div class="timeline-podium">${podium}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderTournamentList() {
  if (!exists("tournamentList")) return;

  const order = byId("tournamentOrder")?.value || "asc";
  let tournaments = [...state.tournaments];

  if (order === "desc") tournaments.reverse();

  byId("tournamentList").innerHTML = `
    <div class="list">
      ${tournaments.map(t => `
        <div class="list-item">
          <div>
            <strong>${t.name}</strong>
            <p>${typeLabel(t.type)} · ${statusLabel(t.status)}</p>
            <p class="muted">${t.createdAt}</p>
          </div>
          <div class="actions">
            <button class="btn primary small" onclick="openTournament('${t.id}')">Abrir</button>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderStandingsTable(rows, highlightTop = 4, type = "league_playoff") {
  if (!rows.length) return `<p class="empty">Sin datos.</p>`;

  const zoneText = type === "division_final" 
    ? `Zona verde: clasificacion a final (${highlightTop} lugares)`
    : highlightTop > 0 
    ? `Zona verde: clasificacion a playoff (${highlightTop} lugares)`
    : "";

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>PTS</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr class="${i < highlightTop ? "playoff-zone" : ""}">
              <td>${r.pos || i + 1}</td>
              <td>${teamNameWithLogo(r.teamId)}</td>
              <td>${r.pj}</td>
              <td>${r.pg}</td>
              <td>${r.pe}</td>
              <td>${r.pp}</td>
              <td>${r.gf}</td>
              <td>${r.gc}</td>
              <td>${r.dg}</td>
              <td><strong>${r.pts}</strong></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    ${zoneText ? `<p class="muted">${zoneText}</p>` : ""}
  `;
}

function renderMatchesTable(tournament, matches) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Partido</th>
            <th>Local</th>
            <th>Resultado</th>
            <th>Visitante</th>
            <th>Editar</th>
          </tr>
        </thead>
        <tbody>
          ${matches.map(m => {
            const home = resolveHome(tournament, m);
            const away = resolveAway(tournament, m);
            const isOpen = openEditors.has(m.id);

            return `
              <tr>
                <td>${m.label}</td>
<td>${home ? teamNameWithLogo(home) : "-"}</td>
                <td>${matchPlayed(m) ? `${m.homeGoals} - ${m.awayGoals}` : "-"}</td>
                <td>${away ? teamNameWithLogo(away) : "-"}</td>
                <td>
                  <button class="btn secondary small" onclick="toggleMatchEditor('${m.id}')">
                    ${isOpen ? "Cerrar" : "Editar"}
                  </button>
                </td>
              </tr>

              ${isOpen ? `
                <tr>
                  <td colspan="5">
                    ${renderMatchEditor(tournament, m, home, away)}
                  </td>
                </tr>
              ` : ""}
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderTournamentPlayerTable(rows, label) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>#</th><th>Jugador</th><th>Equipo</th><th>${label}</th></tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${titleCase(r.name)}</td>
              <td>${teamNameWithLogo(r.teamId)}</td>
              <td><strong>${r.value}</strong></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderMatchesByRound(tournament, rounds) {
  let html = "";
  const requestedRounds = Array.isArray(rounds) ? rounds : [];
  const normalisedOrder = new Map(requestedRounds.map((round, index) => [round, index]));

  const knockoutRounds = [...new Set(
    tournament.matches
      .filter(match => match.stage === "knockout")
      .map(match => match.round)
      .filter(Boolean)
  )].sort((a, b) => {
    const aIndex = normalisedOrder.has(a) ? normalisedOrder.get(a) : 99;
    const bIndex = normalisedOrder.has(b) ? normalisedOrder.get(b) : 99;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return String(a).localeCompare(String(b), "es");
  });

  knockoutRounds.forEach(round => {
    const list = tournament.matches.filter(match => match.stage === "knockout" && match.round === round);
    if (!list.length) return;

    html += `
      <div class="card knockout-round-card">
        <h3>${titleCase(round)}</h3>
        ${renderMatchesTable(tournament, list)}
      </div>
    `;
  });

  return html;
}

function renderTournamentParticipants(tournament) {
  const teamIds = [...new Set(tournament.teamIds || [])];
  const teamCards = teamIds.length
    ? teamIds.map(teamId => `<span class="participant-team-chip">${teamNameWithLogo(teamId)}</span>`).join("")
    : `<span class="picker-empty">No hay equipos inscritos todavía.</span>`;

  return `
    <div class="card tournament-participants-card">
      <div class="section-card-heading">
        <div>
          <h3>Equipos participantes</h3>
          <p class="muted">${teamIds.length} equipo${teamIds.length === 1 ? "" : "s"} inscrito${teamIds.length === 1 ? "" : "s"} en este torneo.</p>
        </div>
      </div>
      <div class="participant-team-chip-list">${teamCards}</div>
    </div>
  `;
}

function openTournament(id) {
  const t = state.tournaments.find(x => x.id === id);
  if (!t) return;

  currentTournamentId = id;

  let html = `
    <div class="card">
      <div class="tournament-header">
        <div>
          <h2>${titleCase(t.name)}</h2>
          <p>
            <span class="badge">${typeLabel(t.type)}</span>
            <span class="badge">${statusLabel(t.status)}</span>
          </p>
        </div>
        <div class="actions">
          <button class="btn secondary small" onclick="editTournament('${t.id}')">Editar</button>
          ${t.status !== "historical" ? `<button class="btn warn small" onclick="finishTournament('${t.id}')">Finalizar torneo</button>` : ""}
          <button class="btn danger small" onclick="confirmDeleteTournament('${t.id}')">Eliminar</button>
        </div>
      </div>
    </div>
  `;

  if (t.status === "historical" && t.champion) {
    const championLogo = teamLogoHtml(t.champion, 80);
    const runnerUpLogo = teamLogoHtml(t.runnerUp, 60);
    const thirdLogo = teamLogoHtml(t.third, 50);
    
    html += `
      <div class="podium-container">
        <div class="podium-item second">
          <div class="podium-position">2</div>
          ${runnerUpLogo}
<div class="podium-team">${teamNameWithLogo(t.runnerUp || "")}</div>
          <div class="podium-label">Subcampeón</div>
        </div>
        <div class="podium-item first">
          <div class="podium-position">1</div>
          ${championLogo}
          <div class="podium-team">${teamNameWithLogo(t.champion)}</div>
          <div class="podium-label"><i class="fas fa-trophy"></i> Campeón</div>
        </div>
        <div class="podium-item third">
          <div class="podium-position">3</div>
          ${thirdLogo}
          <div class="podium-team">${teamNameWithLogo(t.third || "")}</div>
          <div class="podium-label">Tercer Lugar</div>
        </div>
      </div>
    `;
  }

  html += renderTournamentParticipants(t);

  if (t.type === "cup_groups") {
    if (t.groups && t.groups.length) {
      t.groups.forEach(group => {
        const groupStandings = getGroupStandings(t, group.name);
        html += `
          <div class="card">
            <h3>${titleCase(group.name)}</h3>
            ${renderStandingsTable(groupStandings, 2, t.type)}
          </div>
        `;
        
        const groupMatches = t.matches.filter(m => m.stage === "group" && m.group === group.name);
        const groupRounds = [...new Set(groupMatches.map(m => m.round))].sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, "")) || 0;
          const numB = parseInt(b.replace(/\D/g, "")) || 0;
          return numA - numB;
        });
        
        groupRounds.forEach(round => {
          const roundMatches = groupMatches.filter(m => m.round === round);
          html += `
            <div class="card">
              <h4>${titleCase(round)}</h4>
              ${renderMatchesTable(t, roundMatches)}
            </div>
          `;
        });
      });
    } else {
      html += `
        <div class="card">
          <p class="warning">Esta copa no tiene grupos generados. Abre el torneo desde la lista y usa “Editar” solo si necesitas corregir la configuración.</p>
        </div>
      `;
    }
  } else if (t.type === "direct_knockout") {
    html += `
      <div class="card cup-direct-intro">
        <h3>Llaves de eliminación directa</h3>
        <p class="muted">Los equipos se muestran en los cruces iniciales. Los siguientes partidos se completan cuando se registran los resultados anteriores.</p>
      </div>
    `;
  } else {
    const standings = getTournamentStandings(t);
    const playoffCount = t.type === "division_final" ? 2 : 4;

    html += `
      <div class="card">
        <h3>Tabla</h3>
        ${renderStandingsTable(standings, playoffCount, t.type)}
      </div>
    `;

    const regular = t.matches.filter(m => m.stage === "regular");
    const byes = t.matches.filter(m => m.stage === "bye");
    const rounds = [...new Set(regular.map(m => m.round))].sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, "")) || 0;
      const numB = parseInt(b.replace(/\D/g, "")) || 0;
      return numA - numB;
    });

    html += `<div class="card"><h3>Fase Regular</h3>`;
    rounds.forEach(round => {
      const roundMatches = regular.filter(m => m.round === round);
      const byeMatch = byes.find(m => m.round === round);
      html += `<h4>${titleCase(round)}${byeMatch ? `<span class="bye-indicator">Libre: ${teamName(byeMatch.home)}</span>` : ""}</h4>`;
      html += renderMatchesTable(t, roundMatches);
    });
    html += `</div>`;
  }

  html += renderMatchesByRound(t, ["Cuartos", "Cuartos de Final", "Semifinales", "3er Lugar", "Final"]);

  const scorers = buildTournamentScorers(t);
  const assists = buildTournamentAssists(t);

  html += `
    <div class="grid-2">
      <div class="card">
        <h3>Goleadores</h3>
        ${scorers.length ? renderTournamentPlayerTable(scorers.slice(0, 10), "Goles") : "<p class='empty'>Sin datos.</p>"}
      </div>
      <div class="card">
        <h3>Asistencias</h3>
        ${assists.length ? renderTournamentPlayerTable(assists.slice(0, 10), "Asistencias") : "<p class='empty'>Sin datos.</p>"}
      </div>
    </div>
  `;

  byId("tournamentDetail").innerHTML = html;

  switchSection("torneos");
}

function confirmDeleteTournament(tournamentId) {
  const t = state.tournaments.find(x => x.id === tournamentId);
  if (!t) return;

  const ok = confirm(`Eliminar el torneo "${t.name}"? Esta accion no se puede deshacer.`);
  if (!ok) return;

  state.tournaments = state.tournaments.filter(x => x.id !== tournamentId);
  saveState();
  refreshComputedData();
  renderAll();
  byId("tournamentDetail").innerHTML = "";
}

function editTournament(tournamentId) {
  const t = state.tournaments.find(x => x.id === tournamentId);
  if (!t) return;

  const newName = prompt("Nombre del torneo:", t.name);
  if (newName === null) return;

  const types = ["league", "league_playoff", "cup_groups", "direct_knockout", "division_final"];
  const typeNames = { league: "Liga", league_playoff: "Liga + Playoff", cup_groups: "Copa con grupos", direct_knockout: "Eliminación directa", division_final: "División con final" };
  
  const typeIndex = types.indexOf(t.type);
  const currentTypeName = typeNames[t.type] || t.type;
  const newType = prompt(`Tipo de torneo:\n0: Liga\n1: Liga + Playoff\n2: Copa con grupos\n3: Eliminación directa\n4: División con final\n\nNumero (actual: ${currentTypeName}):`, typeIndex);

  if (newType === null) return;

  const currentLegs = t.config?.legs || 1;
  const legsOption = prompt(`Fase regular:\n0: Solo ida\n1: Ida y vuelta\n\nNumero (actual: ${currentLegs === 1 ? "Solo ida" : "Ida y vuelta"}):`, currentLegs === 1 ? 0 : 1);

  if (legsOption === null) return;

  const statuses = ["upcoming", "active", "historical"];
  const statusNames = { upcoming: "Próximo", active: "Activo", historical: "Historico" };
  const statusIndex = statuses.indexOf(t.status);
  const currentStatusName = statusNames[t.status] || t.status;
  const newStatus = prompt(`Estado del torneo:\n0: Próximo\n1: Activo\n2: Historico\n\nNumero (actual: ${currentStatusName}):`, statusIndex);

  if (newStatus === null) return;

  if (newName && newName.trim()) {
    t.name = newName.trim();
  }

  const parsedType = parseInt(newType);
  if (!isNaN(parsedType) && types[parsedType]) {
    t.type = types[parsedType];
  }

  const parsedLegs = parseInt(legsOption);
  const newLegs = parsedLegs === 0 ? 1 : 2;

  const parsedStatus = parseInt(newStatus);
  if (!isNaN(parsedStatus) && statuses[parsedStatus]) {
    t.status = statuses[parsedStatus];
  }

  if (!isNaN(parsedLegs) && newLegs !== currentLegs) {
    const oldMatches = t.matches.filter(m => m.stage === "regular");
    const resultsMap = {};
    oldMatches.forEach(m => {
      const key = `${m.home}__${m.away}`;
      resultsMap[key] = {
        homeGoals: m.homeGoals,
        awayGoals: m.awayGoals,
        date: m.date,
        time: m.time,
        venue: m.venue,
        homeGoalLog: m.homeGoalLog,
        awayGoalLog: m.awayGoalLog
      };
    });

    const knockoutMatches = t.matches.filter(m => m.stage !== "regular");
    const newRegularMatches = generateLeagueMatches(t.teamIds, newLegs);

    newRegularMatches.forEach(m => {
      const key = `${m.home}__${m.away}`;
      if (resultsMap[key]) {
        m.homeGoals = resultsMap[key].homeGoals;
        m.awayGoals = resultsMap[key].awayGoals;
        m.date = resultsMap[key].date;
        m.time = resultsMap[key].time;
        m.venue = resultsMap[key].venue;
        m.homeGoalLog = resultsMap[key].homeGoalLog;
        m.awayGoalLog = resultsMap[key].awayGoalLog;
      }
    });

    t.matches = [...newRegularMatches, ...knockoutMatches];
    if (!t.config) t.config = {};
    t.config.legs = newLegs;
  }

  const participantOptions = state.participants.map(p => `${p.id}:${p.name}`).join("\n") || "Sin participantes";
  const localParticipant = prompt(`Participante Local (maneja Local):\n${participantOptions}`, t.participantLocal || "");
  if (localParticipant !== null) {
    t.participantLocal = localParticipant;
  }
  const awayParticipant = prompt(`Participante Visita (maneja Visita):\n${participantOptions}`, t.participantAway || "");
  if (awayParticipant !== null) {
    t.participantAway = awayParticipant;
  }

  saveState();
  refreshComputedData();
  renderAll();
  openTournament(tournamentId);
}

function finishTournament(tournamentId) {
  const t = state.tournaments.find(x => x.id === tournamentId);
  if (!t) return;

  const teamOptions = t.teamIds.map(id => `<option value="${id}">${teamName(id)}</option>`).join("");
  
  const champion = prompt(`Campeón:\n${teamOptions}`, t.champion || t.teamIds[0]);
  if (champion === null) return;

  const runnerUp = prompt(`Subcampeón:\n${teamOptions}`, t.runnerUp || t.teamIds[1]);
  if (runnerUp === null) return;

  const third = prompt(`Tercer lugar:\n${teamOptions}`, t.third || t.teamIds[2]);
  if (third === null) return;

  t.champion = champion;
  t.runnerUp = runnerUp;
  t.third = third;
  t.status = "historical";

  const participantOptions = state.participants.map(p => `${p.id}:${p.name}`).join("\n") || "Sin participantes";
  const localParticipant = prompt(`Participante Local (maneja Local):\n${participantOptions}`, t.participantLocal || "");
  if (localParticipant !== null) {
    t.participantLocal = localParticipant;
  }
  const awayParticipant = prompt(`Participante Visita (maneja Visita):\n${participantOptions}`, t.participantAway || "");
  if (awayParticipant !== null) {
    t.participantAway = awayParticipant;
  }

  const championParticipant = prompt(`Participante del Campeón:\n${participantOptions}`, t.participantChampion || "");
  if (championParticipant !== null) {
    t.participantChampion = championParticipant;
  }
  const runnerUpParticipant = prompt(`Participante del Subcampeón:\n${participantOptions}`, t.participantRunnerUp || "");
  if (runnerUpParticipant !== null) {
    t.participantRunnerUp = runnerUpParticipant;
  }
  const thirdParticipant = prompt(`Participante del 3.er Lugar:\n${participantOptions}`, t.participantThird || "");
  if (thirdParticipant !== null) {
    t.participantThird = thirdParticipant;
  }

  saveState();
  refreshComputedData();
  renderAll();
  openTournament(tournamentId);

  alert("Felicitaciones! " + teamName(champion) + " es el nuevo Campeón del " + t.name + "!\n\nSubcampeón: " + teamName(runnerUp) + "\nTercer lugar: " + teamName(third));
}

function renderMatchEditor(tournament, match, home, away) {
  const homePlayers = home ? getTeamPlayers(home) : [];
  const awayPlayers = away ? getTeamPlayers(away) : [];

  const homeParticipant = getParticipantForRole(tournament, "home");
  const awayParticipant = getParticipantForRole(tournament, "away");

  const homeTag = homeParticipant ? `<span class="participant-tag" style="background:${homeParticipant.color}">${homeParticipant.name}</span>` : "";
  const awayTag = awayParticipant ? `<span class="participant-tag" style="background:${awayParticipant.color}">${awayParticipant.name}</span>` : "";

  return `
    <div class="match-editor">
      <div class="grid-2">
        <div class="form-group">
          <label>Fecha</label>
          <input
            type="date"
            value="${match.date || ""}"
            onchange="updateMatchTextField('${tournament.id}','${match.id}','date',this.value)"
          />
        </div>

        <div class="form-group">
          <label>Hora</label>
          <input
            type="time"
            value="${match.time || ""}"
            onchange="updateMatchTextField('${tournament.id}','${match.id}','time',this.value)"
          />
        </div>
      </div>

      <div class="grid-2">
        <div class="form-group">
          <label>${home ? teamName(home) : "Local"} ${homeTag} - Goles</label>
          <input
            type="number"
            min="0"
            value="${match.homeGoals ?? ''}"
            onchange="updateMatchValue('${tournament.id}','${match.id}','homeGoals',this.value)"
          />
        </div>

        <div class="form-group">
          <label>${away ? teamName(away) : "Visitante"} ${awayTag} - Goles</label>
          <input
            type="number"
            min="0"
            value="${match.awayGoals ?? ''}"
            onchange="updateMatchValue('${tournament.id}','${match.id}','awayGoals',this.value)"
          />
        </div>
      </div>

      ${!["groups", "group", "fase de grupos", "fase de grupo", "liga", "league", "regular"].includes(match.stage?.toLowerCase()) ? `
        <div class="grid-2">
          <div class="form-group">
            <label>${home ? teamName(home) : "Local"} - Penales</label>
            <input
              type="number"
              min="0"
              value="${match.homePens ?? ''}"
              onchange="updateMatchValue('${tournament.id}','${match.id}','homePens',this.value)"
            />
          </div>

          <div class="form-group">
            <label>${away ? teamName(away) : "Visitante"} - Penales</label>
            <input
              type="number"
              min="0"
              value="${match.awayPens ?? ''}"
              onchange="updateMatchValue('${tournament.id}','${match.id}','awayPens',this.value)"
            />
          </div>
        </div>
      ` : ""}

      <div class="separator"></div>

      <div class="grid-2">
        <div class="form-group">
          <h4><i class="fas fa-futbol"></i> ${home ? teamName(home) : "Local"}</h4>
          
          <div class="tabs-mini">
            <button class="tab-mini active" onclick="switchActionTab('${match.id}', 'home', 'goals')">Goles</button>
            <button class="tab-mini" onclick="switchActionTab('${match.id}', 'home', 'cards')">Tarjetas</button>
          </div>
          
          <div id="goals-home-${match.id}">
            <select id="scorer-home-${match.id}">
              <option value="">Selecciona goleador</option>
              ${homePlayers.map(p => `<option value="${playerName(p)}">${playerName(p)}</option>`).join("")}
            </select>

            <select class="mt-10" id="assist-home-${match.id}">
              <option value="">Sin asistencia</option>
              ${homePlayers.map(p => `<option value="${playerName(p)}">${playerName(p)}</option>`).join("")}
            </select>

            <input class="mt-10" type="number" min="1" id="minute-home-${match.id}" placeholder="Minuto" />

            <div class="actions mt-10">
              <button class="btn primary small" onclick="appendGoalLine('${tournament.id}','${match.id}','home')">
                <i class="fas fa-plus"></i> Agregar gol
              </button>
            </div>

            <textarea
              class="mt-10"
              onchange="updateMatchTextField('${tournament.id}','${match.id}','homeGoalLog',this.value)"
            >${match.homeGoalLog || ""}</textarea>
          </div>
          
          <div id="cards-home-${match.id}" style="display:none">
            <select id="card-type-home-${match.id}">
              <option value="A">Tarjeta Amarilla</option>
              <option value="R">Tarjeta Roja</option>
            </select>

            <select class="mt-10" id="card-player-home-${match.id}">
              <option value="">Selecciona jugador</option>
              ${homePlayers.map(p => `<option value="${playerName(p)}">${playerName(p)}</option>`).join("")}
            </select>

            <input class="mt-10" type="number" min="1" id="card-minute-home-${match.id}" placeholder="Minuto" />

            <div class="actions mt-10">
              <button class="btn warn small" onclick="appendCardLine('${tournament.id}','${match.id}','home')">
                <i class="fas fa-plus"></i> Agregar tarjeta
              </button>
            </div>

            <textarea
              class="mt-10"
              onchange="updateMatchTextField('${tournament.id}','${match.id}','homeCardLog',this.value)"
            >${match.homeCardLog || ""}</textarea>
          </div>
        </div>

        <div class="form-group">
          <h4><i class="fas fa-futbol"></i> ${away ? teamName(away) : "Visitante"}</h4>
          
          <div class="tabs-mini">
            <button class="tab-mini active" onclick="switchActionTab('${match.id}', 'away', 'goals')">Goles</button>
            <button class="tab-mini" onclick="switchActionTab('${match.id}', 'away', 'cards')">Tarjetas</button>
          </div>
          
          <div id="goals-away-${match.id}">
            <select id="scorer-away-${match.id}">
              <option value="">Selecciona goleador</option>
              ${awayPlayers.map(p => `<option value="${playerName(p)}">${playerName(p)}</option>`).join("")}
            </select>

            <select class="mt-10" id="assist-away-${match.id}">
              <option value="">Sin asistencia</option>
              ${awayPlayers.map(p => `<option value="${playerName(p)}">${playerName(p)}</option>`).join("")}
            </select>

            <input class="mt-10" type="number" min="1" id="minute-away-${match.id}" placeholder="Minuto" />

            <div class="actions mt-10">
              <button class="btn primary small" onclick="appendGoalLine('${tournament.id}','${match.id}','away')">
                <i class="fas fa-plus"></i> Agregar gol
              </button>
            </div>

            <textarea
              class="mt-10"
              onchange="updateMatchTextField('${tournament.id}','${match.id}','awayGoalLog',this.value)"
            >${match.awayGoalLog || ""}</textarea>
          </div>
          
          <div id="cards-away-${match.id}" style="display:none">
            <select id="card-type-away-${match.id}">
              <option value="A">Tarjeta Amarilla</option>
              <option value="R">Tarjeta Roja</option>
            </select>

            <select class="mt-10" id="card-player-away-${match.id}">
              <option value="">Selecciona jugador</option>
              ${awayPlayers.map(p => `<option value="${playerName(p)}">${playerName(p)}</option>`).join("")}
            </select>

            <input class="mt-10" type="number" min="1" id="card-minute-away-${match.id}" placeholder="Minuto" />

            <div class="actions mt-10">
              <button class="btn warn small" onclick="appendCardLine('${tournament.id}','${match.id}','away')">
                <i class="fas fa-plus"></i> Agregar tarjeta
              </button>
            </div>

            <textarea
              class="mt-10"
              onchange="updateMatchTextField('${tournament.id}','${match.id}','awayCardLog',this.value)"
            >${match.awayCardLog || ""}</textarea>
          </div>
        </div>
      </div>
    </div>
  `;
}

function switchActionTab(matchId, side, tab) {
  const goalsDiv = byId(`goals-${side}-${matchId}`);
  const cardsDiv = byId(`cards-${side}-${matchId}`);
  
  if (goalsDiv && cardsDiv) {
    if (tab === 'goals') {
      goalsDiv.style.display = 'block';
      cardsDiv.style.display = 'none';
    } else {
      goalsDiv.style.display = 'none';
      cardsDiv.style.display = 'block';
    }
  }
  
  const container = goalsDiv?.parentElement || cardsDiv?.parentElement;
  if (container) {
    container.querySelectorAll('.tab-mini').forEach(btn => {
      btn.classList.remove('active');
    });
    const activeBtn = container.querySelector(`.tab-mini[onclick*="'${tab}'"]`);
    if (activeBtn) activeBtn.classList.add('active');
  }
}

function appendCardLine(tournamentId, matchId, side) {
  const tournament = state.tournaments.find(t => t.id === tournamentId);
  if (!tournament) return;
  
  const match = tournament.matches.find(m => m.id === matchId);
  if (!match) return;

  const cardType = byId(`card-type-${side}-${matchId}`)?.value;
  const player = byId(`card-player-${side}-${matchId}`)?.value;
  const minute = byId(`card-minute-${side}-${matchId}`)?.value;

  if (!player) {
    alert("Selecciona un jugador.");
    return;
  }
  
  if (!minute) {
    alert("Ingresa el minuto.");
    return;
  }

  const cardIcon = cardType === 'R' ? 'ðŸŸ¥' : 'ðŸŸ¨';
  const cardTypeName = cardType === 'R' ? 'Roja' : 'Amarilla';
  const line = `${cardIcon} ${minute}' ${player} (${cardTypeName})`;

  const field = side === 'home' ? 'homeCardLog' : 'awayCardLog';
  match[field] = match[field] ? `${match[field]}\n${line}` : line;

  saveState();
  
  if (currentTournamentId) {
    openTournament(currentTournamentId);
  }
}

function toggleMatchEditor(matchId) {
  if (openEditors.has(matchId)) {
    openEditors.delete(matchId);
  } else {
    openEditors.add(matchId);
  }

  if (currentTournamentId) {
    openTournament(currentTournamentId);
  }
}

function updateMatchValue(tournamentId, matchId, field, raw) {
  const tournament = state.tournaments.find(t => t.id === tournamentId);
  if (!tournament) return;

  const match = tournament.matches.find(m => m.id === matchId);
  if (!match) return;

  match[field] = raw === "" ? null : Number(raw);

  saveState();
  refreshComputedData();
  renderAll();

  if (currentTournamentId) {
    openTournament(currentTournamentId);
  }
}

function updateMatchTextField(tournamentId, matchId, field, value) {
  const tournament = state.tournaments.find(t => t.id === tournamentId);
  if (!tournament) return;

  const match = tournament.matches.find(m => m.id === matchId);
  if (!match) return;

  match[field] = value;

  saveState();
  refreshComputedData();
  renderAll();

  if (currentTournamentId) {
    openTournament(currentTournamentId);
  }
}

function appendGoalLine(tournamentId, matchId, side) {
  const tournament = state.tournaments.find(t => t.id === tournamentId);
  if (!tournament) return;

  const match = tournament.matches.find(m => m.id === matchId);
  if (!match) return;

  const scorerEl = byId(`scorer-${side}-${match.id}`);
  const assistEl = byId(`assist-${side}-${match.id}`);
  const minuteEl = byId(`minute-${side}-${match.id}`);

  const scorer = scorerEl ? scorerEl.value.trim() : "";
  const assist = assistEl ? assistEl.value.trim() : "";
  const minute = minuteEl ? minuteEl.value.trim() : "";

  if (!scorer) {
    alert("Selecciona el goleador.");
    return;
  }

  const line = `${scorer} | ${assist || "Sin asistencia"} | ${minute ? minute + "'" : "-"}`;

  if (side === "home") {
    match.homeGoalLog = match.homeGoalLog ? `${match.homeGoalLog}\n${line}` : line;
    match.homeGoals = Number(match.homeGoals || 0) + 1;
  } else {
    match.awayGoalLog = match.awayGoalLog ? `${match.awayGoalLog}\n${line}` : line;
    match.awayGoals = Number(match.awayGoals || 0) + 1;
  }

  saveState();
  refreshComputedData();
  renderAll();

  if (currentTournamentId) {
    openTournament(currentTournamentId);
  }
}

function renderFriendlies() {
  if (!exists("friendliesList")) return;

  if (!state.friendlies.length) {
    byId("friendliesList").innerHTML = `<p class="empty">No hay amistosos registrados.</p>`;
    return;
  }

  byId("friendliesList").innerHTML = `
    <div class="list">
      ${state.friendlies.map(f => `
        <div class="list-item">
          <div>
            <strong>${teamNameWithLogo(f.home)} vs ${teamNameWithLogo(f.away)}</strong>
            <p>${matchPlayed(f) ? `${f.homeGoals} - ${f.awayGoals}` : "Sin resultado"}</p>
            <p class="muted">${formatDateTime(f)} · ${f.venue || "Sin lugar"}</p>
          </div>
          <div class="actions">
            <button class="btn primary small" onclick="openFriendly('${f.id}')">Abrir</button>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function openFriendly(friendlyId) {
  const f = state.friendlies.find(x => x.id === friendlyId);
  if (!f || !exists("friendlyDetail")) return;

  currentFriendlyId = friendlyId;

  byId("friendlyDetail").innerHTML = `
    <div class="card">
      <h2>Amistoso</h2>
      <p>
        <span class="badge friendly">Amistoso</span>
      </p>
      <p>${teamNameWithLogo(f.home)} vs ${teamNameWithLogo(f.away)}</p>
      <p class="muted">${formatDateTime(f)} · ${f.venue || "Sin lugar"}</p>
    </div>

    <div class="card">
      <h3>Resultado</h3>
      ${renderFriendlyEditor(f)}
    </div>
  `;

  switchSection("amistosos");
}

function renderFriendlyEditor(match) {
  const homePlayers = getTeamPlayers(match.home);
  const awayPlayers = getTeamPlayers(match.away);

  return `
    <div class="match-editor">
      <div class="grid-2">
        <div class="form-group">
          <label>Fecha</label>
          <input
            type="date"
            value="${match.date || ""}"
            onchange="updateFriendlyTextField('${match.id}','date',this.value)"
          />
        </div>

        <div class="form-group">
          <label>Hora</label>
          <input
            type="time"
            value="${match.time || ""}"
            onchange="updateFriendlyTextField('${match.id}','time',this.value)"
          />
        </div>
      </div>

      <div class="form-group">
        <label>Lugar</label>
        <input
          type="text"
          value="${match.venue || ""}"
          onchange="updateFriendlyTextField('${match.id}','venue',this.value)"
        />
      </div>

      <div class="grid-2">
        <div class="form-group">
          <label>${teamName(match.home)} - Goles</label>
          <input
            type="number"
            min="0"
            value="${match.homeGoals ?? ''}"
            onchange="updateFriendlyValue('${match.id}','homeGoals',this.value)"
          />
        </div>

        <div class="form-group">
          <label>${teamName(match.away)} - Goles</label>
          <input
            type="number"
            min="0"
            value="${match.awayGoals ?? ''}"
            onchange="updateFriendlyValue('${match.id}','awayGoals',this.value)"
          />
        </div>
      </div>

      <div class="separator"></div>

      <div class="grid-2">
        <div class="form-group">
          <label>Agregar gol a ${teamName(match.home)}</label>

          <select id="friendly-scorer-home-${match.id}">
            <option value="">Selecciona goleador</option>
            ${homePlayers.map(p => `<option value="${playerName(p)}">${playerName(p)}</option>`).join("")}
          </select>

          <select class="mt-10" id="friendly-assist-home-${match.id}">
            <option value="">Sin asistencia</option>
            ${homePlayers.map(p => `<option value="${playerName(p)}">${playerName(p)}</option>`).join("")}
          </select>

          <input class="mt-10" type="number" min="1" id="friendly-minute-home-${match.id}" placeholder="Minuto" />

          <div class="actions mt-10">
            <button class="btn primary small" onclick="appendFriendlyGoalLine('${match.id}','home')">
              Agregar gol
            </button>
          </div>

          <textarea
            class="mt-10"
            onchange="updateFriendlyTextField('${match.id}','homeGoalLog',this.value)"
          >${match.homeGoalLog || ""}</textarea>
        </div>

        <div class="form-group">
          <label>Agregar gol a ${teamName(match.away)}</label>

          <select id="friendly-scorer-away-${match.id}">
            <option value="">Selecciona goleador</option>
            ${awayPlayers.map(p => `<option value="${playerName(p)}">${playerName(p)}</option>`).join("")}
          </select>

          <select class="mt-10" id="friendly-assist-away-${match.id}">
            <option value="">Sin asistencia</option>
            ${awayPlayers.map(p => `<option value="${playerName(p)}">${playerName(p)}</option>`).join("")}
          </select>

          <input class="mt-10" type="number" min="1" id="friendly-minute-away-${match.id}" placeholder="Minuto" />

          <div class="actions mt-10">
            <button class="btn primary small" onclick="appendFriendlyGoalLine('${match.id}','away')">
              Agregar gol
            </button>
          </div>

          <textarea
            class="mt-10"
            onchange="updateFriendlyTextField('${match.id}','awayGoalLog',this.value)"
          >${match.awayGoalLog || ""}</textarea>
        </div>
      </div>
    </div>
  `;
}

function updateFriendlyValue(matchId, field, raw) {
  const match = state.friendlies.find(f => f.id === matchId);
  if (!match) return;

  match[field] = raw === "" ? null : Number(raw);

  saveState();
  refreshComputedData();
  renderAll();

  if (currentFriendlyId) openFriendly(currentFriendlyId);
}

function updateFriendlyTextField(matchId, field, value) {
  const match = state.friendlies.find(f => f.id === matchId);
  if (!match) return;

  match[field] = value;

  saveState();
  refreshComputedData();
  renderAll();

  if (currentFriendlyId) openFriendly(currentFriendlyId);
}

function appendFriendlyGoalLine(matchId, side) {
  const match = state.friendlies.find(f => f.id === matchId);
  if (!match) return;

  const scorerEl = byId(`friendly-scorer-${side}-${match.id}`);
  const assistEl = byId(`friendly-assist-${side}-${match.id}`);
  const minuteEl = byId(`friendly-minute-${side}-${match.id}`);

  const scorer = scorerEl ? scorerEl.value.trim() : "";
  const assist = assistEl ? assistEl.value.trim() : "";
  const minute = minuteEl ? minuteEl.value.trim() : "";

  if (!scorer) {
    alert("Selecciona el goleador.");
    return;
  }

  const line = `${scorer} | ${assist || "Sin asistencia"} | ${minute ? minute + "'" : "-"}`;

  if (side === "home") {
    match.homeGoalLog = match.homeGoalLog ? `${match.homeGoalLog}\n${line}` : line;
    match.homeGoals = Number(match.homeGoals || 0) + 1;
  } else {
    match.awayGoalLog = match.awayGoalLog ? `${match.awayGoalLog}\n${line}` : line;
    match.awayGoals = Number(match.awayGoals || 0) + 1;
  }

  saveState();
  refreshComputedData();
  renderAll();

  if (currentFriendlyId) openFriendly(currentFriendlyId);
}

function renderRules() {
  if (!exists("rulesList")) return;

  if (!state.rules.length) {
    byId("rulesList").innerHTML = `<p class="empty">No hay reglas cargadas.</p>`;
  } else {
    byId("rulesList").innerHTML = `
      <div class="list">
        ${state.rules.map(rule => `
          <div class="list-item">
            <div>
              <strong>${rule.title}</strong>
              <p>${rule.text}</p>
              <p class="muted">${rule.active ? "Activa" : "Inactiva"}</p>
            </div>
            <div class="actions">
              <button class="btn secondary small" onclick="toggleRule('${rule.id}')">
                ${rule.active ? "Desactivar" : "Activar"}
              </button>
              <button class="btn danger small" onclick="deleteRule('${rule.id}')">Eliminar</button>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  if (exists("ruleYellowMatch")) {
    byId("ruleYellowMatch").value = state.config.discipline.yellowPerMatchSuspension ?? 2;
  }
  if (exists("ruleYellowAccum")) {
    byId("ruleYellowAccum").value = state.config.discipline.yellowAccumulationSuspension ?? 3;
  }
  if (exists("ruleFriendlyWeight")) {
    byId("ruleFriendlyWeight").value = state.config.fifa.weights.friendly ?? 0.3;
  }
  if (exists("ruleChampionPoints")) {
    byId("ruleChampionPoints").value = state.config.fifa.bonus.champion ?? 50;
  }
  if (exists("ruleRunnerPoints")) {
    byId("ruleRunnerPoints").value = state.config.fifa.bonus.runnerUp ?? 25;
  }
  if (exists("ruleThirdPoints")) {
    byId("ruleThirdPoints").value = state.config.fifa.bonus.third ?? 10;
  }
}

function addRule() {
  const title = byId("newRuleTitle")?.value.trim();
  const text = byId("newRuleText")?.value.trim();

  if (!title || !text) {
    alert("Completa el titulo y la descripcion de la regla.");
    return;
  }

  state.rules.push({
    id: uid("rule"),
    title,
    text,
    active: true
  });

  saveState();
  renderRules();

  byId("newRuleTitle").value = "";
  byId("newRuleText").value = "";
}

function toggleRule(ruleId) {
  const rule = state.rules.find(r => r.id === ruleId);
  if (!rule) return;

  rule.active = !rule.active;
  saveState();
  renderRules();
}

function deleteRule(ruleId) {
  state.rules = state.rules.filter(r => r.id !== ruleId);
  saveState();
  renderRules();
}

function saveRulesConfig() {
  state.config.discipline.yellowPerMatchSuspension = Number(byId("ruleYellowMatch")?.value || 2);
  state.config.discipline.yellowAccumulationSuspension = Number(byId("ruleYellowAccum")?.value || 3);
  state.config.fifa.weights.friendly = Number(byId("ruleFriendlyWeight")?.value || 0.3);
  state.config.fifa.bonus.champion = Number(byId("ruleChampionPoints")?.value || 50);
  state.config.fifa.bonus.runnerUp = Number(byId("ruleRunnerPoints")?.value || 25);
  state.config.fifa.bonus.third = Number(byId("ruleThirdPoints")?.value || 10);

  saveState();
  refreshComputedData();
  renderAll();
  alert("Configuracion guardada.");
}

function getSelectedTeamIdsFromPicker() {
  return [...document.querySelectorAll("#teamPicker .team-check:checked")].map(input => input.value);
}

function getCupPreviewGroups(teamIds) {
  const { groupA, groupB } = splitTeamsForCupGroups(teamIds);
  return { groupA, groupB };
}

function renderTournamentFormatUI() {
  const type = byId("tType")?.value || "league";
  const info = tournamentFormatInfo(type);
  const help = byId("tournamentFormatHelp");
  const legs = byId("tLegs");
  const legsLabel = byId("tLegsLabel");
  const pickerSummary = byId("teamPickerSummary");
  const selected = getSelectedTeamIdsFromPicker();

  if (help) {
    help.innerHTML = `
      <strong>${info.title}</strong>
      <span>${info.description}</span>
      <span class="format-minimum">Mínimo: ${info.minTeams} equipos.</span>
    `;
    help.className = `format-help format-help-${type}`;
  }

  if (legsLabel) legsLabel.textContent = info.legsLabel;
  if (legs) {
    const directKnockout = type === "direct_knockout";
    legs.disabled = directKnockout;
    legs.closest(".form-group")?.classList.toggle("field-disabled", directKnockout);
    if (directKnockout) legs.value = "1";
  }

  if (!pickerSummary) return;

  if (!selected.length) {
    pickerSummary.innerHTML = `<span class="picker-empty">Selecciona los equipos que participarán.</span>`;
    return;
  }

  if (type === "cup_groups") {
    const { groupA, groupB } = getCupPreviewGroups(selected);
    const list = ids => ids.length
      ? ids.map(id => `<span class="team-chip">${teamNameWithLogo(id)}</span>`).join("")
      : `<span class="picker-empty">Sin equipos</span>`;

    pickerSummary.innerHTML = `
      <div class="selection-count"><strong>${selected.length}</strong> equipos seleccionados</div>
      <div class="cup-preview-groups">
        <div><span class="group-title">Grupo A</span><div class="team-chip-list">${list(groupA)}</div></div>
        <div><span class="group-title">Grupo B</span><div class="team-chip-list">${list(groupB)}</div></div>
      </div>
    `;
    return;
  }

  pickerSummary.innerHTML = `
    <div class="selection-count"><strong>${selected.length}</strong> equipos seleccionados</div>
    <div class="team-chip-list">${selected.map(id => `<span class="team-chip">${teamNameWithLogo(id)}</span>`).join("")}</div>
  `;
}

function renderTeamPicker() {
  if (!exists("teamPicker")) return;

  const selectedBeforeRender = new Set(getSelectedTeamIdsFromPicker());

  byId("teamPicker").innerHTML = state.teams.map(t => `
    <label class="checkbox-item">
      <input type="checkbox" class="team-check" value="${t.id}" ${selectedBeforeRender.has(t.id) ? "checked" : ""}>
      <span>${t.name}</span>
    </label>
  `).join("");

  const teamChecks = [...document.querySelectorAll("#teamPicker .team-check")];
  if (exists("checkAllTeams")) {
    byId("checkAllTeams").checked = Boolean(teamChecks.length) && teamChecks.every(input => input.checked);
  }

  teamChecks.forEach(check => {
    check.addEventListener("change", () => {
      if (exists("checkAllTeams")) {
        byId("checkAllTeams").checked = teamChecks.length > 0 && teamChecks.every(input => input.checked);
      }
      renderTournamentFormatUI();
    });
  });

  renderTournamentFormatUI();
}

function renderTeamSelects() {
  const options = [`<option value="">Selecciona</option>`]
    .concat(state.teams.map(t => `<option value="${t.id}">${t.name}</option>`))
    .join("");

  if (exists("friendlyHome")) byId("friendlyHome").innerHTML = options;
  if (exists("friendlyAway")) byId("friendlyAway").innerHTML = options;
  if (exists("h2hA")) byId("h2hA").innerHTML = options;
  if (exists("h2hB")) byId("h2hB").innerHTML = options;
}

function renderTeamList() {
  if (!exists("teamList")) return;

  byId("teamList").innerHTML = `
    <div class="list">
      ${state.teams.map(t => {
        const imageUrl = t.imageUrl || `escudos/${t.id}.png`;
        const initials = getTeamInitials(t.name);
        return `
        <div class="list-item">
          <div class="team-list-item">
            <div class="team-avatar">
              <img src="${imageUrl}" alt="${t.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
              <span style="display:none">${initials}</span>
            </div>
            <div class="team-info">
              <strong>${t.name}</strong>
              <p>DT: ${t.coach || "Sin DT"}</p>
              <p class="muted">${t.players.length} jugadores cargados</p>
            </div>
          </div>
          <div class="actions">
            <button class="btn primary small" onclick="openTeam('${t.id}')"><i class="fas fa-user"></i> Ver perfil</button>
            <button class="btn danger small" onclick="confirmDeleteTeam('${t.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `}).join("")}
    </div>
  `;
}

function confirmDeleteTeam(teamId) {
  const team = getTeam(teamId);
  if (!team) return;
  
  if (confirm(`¿Eliminar "${team.name}"? Esta acción no se puede deshacer.`)) {
    deleteTeam(teamId);
  }
}

function deleteTeam(teamId) {
  state.teams = state.teams.filter(t => t.id !== teamId);
  saveState();
  renderTeamList();
  alert("Equipo eliminado.");
}

function openTeam(teamId) {
  if (!exists("teamProfile")) return;

  const team = getTeam(teamId);
  if (!team) return;

  const perf = computeTeamProfile(teamId);
  const fifa = state.fifaRanking.find(r => r.teamId === teamId);
  const imageUrl = team.imageUrl || `escudos/${team.id}.png`;
  const imageExists = team.imageUrl || true;

  byId("teamProfile").innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="team-header-info">
          <div class="team-avatar-large" id="teamAvatar-${teamId}">
            <img src="${imageUrl}" alt="${team.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
            <span style="display:none">${getTeamInitials(team.name)}</span>
          </div>
          <div>
            <h2>${team.name}</h2>
            <p class="muted">${team.coach || "Sin DT"}</p>
          </div>
        </div>
        <button class="btn secondary small" onclick="renderTeamList(); switchSection('equipos');"><i class="fas fa-arrow-left"></i> Volver</button>
      </div>
      
      <div class="grid-2">
        <div class="rule-box">
          <h3><i class="fas fa-chart-line"></i> Estadísticas</h3>
          <p><strong>Puntaje FIFA:</strong> ${fifa ? fifa.points.toFixed(2) : "0.00"}</p>
          <p><strong>Torneos:</strong> ${perf.tournaments}</p>
          <p><strong>PJ:</strong> ${perf.pj}</p>
          <p><strong>PG:</strong> ${perf.pg}</p>
          <p><strong>PE:</strong> ${perf.pe}</p>
          <p><strong>PP:</strong> ${perf.pp}</p>
          <p><strong>GF:</strong> ${perf.gf}</p>
          <p><strong>GC:</strong> ${perf.gc}</p>
          <p><strong>DG:</strong> ${perf.dg}</p>
          <p><strong>Puntos:</strong> ${perf.pts}</p>
          <p><strong>% Rendimiento:</strong> ${perf.performance}%</p>
          <p><strong>Títulos:</strong> ${perf.titles}</p>
          <p><strong>Sub-Campeonatos:</strong> ${perf.runners}</p>
          <p><strong>Terceros lugares:</strong> ${perf.thirds}</p>
        </div>

<div class="rule-box">
          <div class="flex-between">
            <h3><i class="fas fa-user-tie"></i> Director Técnico</h3>
          </div>
          ${team.coachCard ? `
          <div class="coach-card">
            <div class="coach-avatar">${team.coachCard.abbr}</div>
            <div class="coach-info">
              <div class="coach-name">${team.coach}</div>
              <div class="coach-ability"><i class="fas fa-dice"></i> ${team.coachCard.ability}</div>
              <div class="coach-desc">${team.coachCard.abilityDesc}</div>
            </div>
          </div>
          ${team.coachCard.stadium ? `
          <div class="coach-stadium">
            <i class="fas fa-map-marker-alt"></i> ${team.coachCard.stadium} (${team.coachCard.population})
          </div>
          ` : ""}
          ` : ""}
        </div>

        <div class="rule-box">
          <div class="flex-between">
            <h3><i class="fas fa-users"></i> Plantel</h3>
            <button class="btn primary small" onclick="showAddPlayerModal('${teamId}')"><i class="fas fa-plus"></i> Agregar jugador</button>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Jugador</th><th>Posición</th><th>Ingreso</th><th>Habilidades</th><th></th></tr>
              </thead>
              <tbody>
                ${team.players.map((p, i) => {
                  const name = playerName(p);
                  const pos = playerPosition(p);
                  const abilities = playerAbilities(p);
                  const start = playerStart(p);
                  const minute = playerMinute(p);
                  let ingreso = start ? '<span class="badge success">En cancha</span>' : (minute !== undefined ? `<span class="badge">${minute}\`</span>` : '<span class="badge secondary">Reserva</span>');
                  let abilitiesHtml = "";
                  if (abilities) {
                    abilitiesHtml = Object.entries(abilities).map(([key, val]) => {
                      const labels = { quite: "Q", paseCorto: "PC", paseLargo: "PL", amague: "AM", tiro: "TI", ataje: "AT" };
                      return `<span class="ability-badge" title="${key}">${labels[key] || key}:${val}</span>`;
                    }).join(" ");
                  }
                  return `
                    <tr>
                      <td><strong>${name}</strong></td>
                      <td><span class="badge">${pos}</span></td>
                      <td>${ingreso}</td>
                      <td>${abilitiesHtml}</td>
                      <td>
                        <button class="btn danger small" onclick="confirmDeletePlayer('${teamId}', ${i})"><i class="fas fa-trash"></i></button>
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
        ${team.objects ? `
        <div class="rule-box">
          <h3><i class="fas fa-toolbox"></i> Objetos</h3>
          <div class="objects-grid">
            ${team.objects.map(obj => `
              <div class="object-card">
                <div class="object-name">${obj.name}</div>
                <div class="object-minute">${obj.minute}</div>
                <div class="object-effect">${obj.effect}</div>
                <div class="object-desc">${obj.description}</div>
              </div>
            `).join("")}
          </div>
        </div>
        ` : ""}
        ${team.specialActions ? `
        <div class="rule-box">
          <h3><i class="fas fa-bolt"></i> Acciones Especiales</h3>
          ${[0, 10, 20, 30, 45, 50, 60, 80].map(minute => {
            const actions = team.specialActions.filter(a => a.minute === minute);
            if (actions.length === 0) return "";
            return `
              <div class="special-minute-group">
                <h4>${minute}'</h4>
                <div class="objects-grid">
                  ${actions.map(a => `
                    <div class="object-card">
                      <div class="object-name">${a.name}</div>
                      <div class="object-effect">${a.effect}</div>
                      <div class="object-desc">${a.description}</div>
                    </div>
                  `).join("")}
                </div>
              </div>
            `;
          }).join("")}
</div>
        ` : ""}
      </div>
    </div>
  `;

  switchSection("equipos");
}

function getTeamInitials(name) {
  if (!name) return "?";
  const words = name.split(" ");
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 3).toUpperCase();
}

async function handleTeamImageUpload(teamId, input) {
  if (!input.files || !input.files[0]) return;
  
  const file = input.files[0];
  const team = getTeam(teamId);
  if (!team) return;

  const uploadLabel = input.nextElementSibling;
  if (uploadLabel) {
    uploadLabel.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo...';
    uploadLabel.disabled = true;
  }

  try {
    let url = null;

    if (window.SupabaseService && SupabaseService.isEnabled()) {
      url = await SupabaseService.uploadTeamImage(teamId, file);
    }

    if (!url) {
      url = await fileToDataUrl(file);
    }

    team.imageUrl = url;
    saveState();
    openTeam(teamId);
  } catch (error) {
    console.error("Error:", error);
    alert("Error al subir la imagen: " + error.message);
  }
}

async function removeTeamImage(teamId) {
  if (!confirm("¿Eliminar el escudo del equipo?")) return;
  
  const team = getTeam(teamId);
  if (!team) return;

  try {
    team.imageUrl = "";
    saveState();
    openTeam(teamId);
  } catch (error) {
    console.error("Error:", error);
    team.imageUrl = "";
    saveState();
    openTeam(teamId);
  }
}

function showAddPlayerModal(teamId) {
  const team = getTeam(teamId);
  if (!team) return;

  byId("modalContent").innerHTML = `
    <h2><i class="fas fa-user-plus"></i> Agregar Jugador</h2>
    <p class="muted">Equipo: ${team.name}</p>
    
    <div class="form-group">
      <label>Nombre del jugador</label>
      <input type="text" id="newPlayerName" placeholder="Nombre completo" />
    </div>
    
    <div class="form-group">
      <label>Posición</label>
      <select id="newPlayerPosition">
        <option value="Arquero">Arquero</option>
        <option value="Defensa">Defensa</option>
        <option value="Medio">Medio</option>
        <option value="Delantero">Delantero</option>
      </select>
    </div>
    
    <div class="actions">
      <button class="btn primary" onclick="addPlayer('${teamId}')"><i class="fas fa-save"></i> Guardar</button>
      <button class="btn secondary" onclick="closeModal()"><i class="fas fa-times"></i> Cancelar</button>
    </div>
  `;
  
  byId("modalOverlay").style.display = "flex";
}

function addPlayer(teamId) {
  const team = getTeam(teamId);
  if (!team) return;

  const name = byId("newPlayerName")?.value.trim();
  const position = byId("newPlayerPosition")?.value;

  if (!name) {
    alert("Ingresa el nombre del jugador.");
    return;
  }

  team.players.push([name, position]);
  saveState();
  closeModal();
  openTeam(teamId);
}

function confirmDeletePlayer(teamId, playerIndex) {
  const team = getTeam(teamId);
  if (!team) return;

  const player = team.players[playerIndex];
  if (confirm(`¿Eliminar a "${player[0]}" del equipo?`)) {
    team.players.splice(playerIndex, 1);
    saveState();
    openTeam(teamId);
  }
}

function buildFilteredStandings(tournamentId = "all") {
  const era = exists("eraFilter") ? byId("eraFilter").value : "all";
  
  if (tournamentId === "all") {
    return buildGlobalStandings(era);
  }

  const tournament = state.tournaments.find(t => t.id === tournamentId);
  if (!tournament) return buildGlobalStandings();

  const map = {};

  tournament.teamIds.forEach(id => {
    map[id] = {
      teamId: id,
      pj: 0,
      pg: 0,
      pe: 0,
      pp: 0,
      gf: 0,
      gc: 0,
      dg: 0,
      pts: 0
    };
  });

  if (tournament.manualStandings && tournament.manualStandings.length) {
    tournament.manualStandings.forEach(r => {
      const row = map[r.teamId];
      if (!row) return;
      row.pj += r.pj;
      row.pg += r.pg;
      row.pe += r.pe;
      row.pp += r.pp;
      row.gf += r.gf;
      row.gc += r.gc;
      row.pts += r.pts;
    });
  }

  tournament.matches.filter(matchPlayed).forEach(m => {
    const home = resolveHome(tournament, m);
    const away = resolveAway(tournament, m);
    if (!home || !away) return;
    if (tournament.manualStandings && tournament.manualStandings.length && m.stage === "regular") return;

    const h = map[home];
    const a = map[away];
    if (!h || !a) return;

    h.pj++;
    a.pj++;
    h.gf += Number(m.homeGoals);
    h.gc += Number(m.awayGoals);
    a.gf += Number(m.awayGoals);
    a.gc += Number(m.homeGoals);

    if (Number(m.homeGoals) > Number(m.awayGoals)) {
      h.pg++;
      a.pp++;
      h.pts += 3;
    } else if (Number(m.homeGoals) < Number(m.awayGoals)) {
      a.pg++;
      h.pp++;
      a.pts += 3;
    } else {
      h.pe++;
      a.pe++;
      h.pts += 1;
      a.pts += 1;
    }
  });

  const rows = Object.values(map).map(r => ({ ...r, dg: r.gf - r.gc }));
  return sortStandings(rows);
}

function computeTournamentPerformance(tournamentId, era = "all") {
  if (tournamentId === "all") {
    return state.teams.map(t => {
      const perf = computeTeamProfile(t.id, era);
      return {
        teamId: t.id,
        performance: Number(perf.performance),
        pts: perf.pts,
        pj: perf.pj
      };
    });
  }

  const tournament = state.tournaments.find(t => t.id === tournamentId);
  if (!tournament) return [];

  const standings = buildFilteredStandings(tournamentId);
  const totalPts = standings.reduce((sum, r) => sum + r.pts, 0);
  const totalPj = standings.reduce((sum, r) => sum + r.pj, 0);

  return standings.map(r => ({
    teamId: r.teamId,
    performance: totalPj ? ((r.pts / (r.pj * 3)) * 100).toFixed(1) : "0.0",
    pts: r.pts,
    pj: r.pj
  }));
}

function computeTournamentFifaRanking(tournamentId, era = "all") {
  const points = {};

  state.teams.forEach(team => {
    points[team.id] = 0;
  });

  if (tournamentId === "all") {
    const filteredTournaments = state.tournaments.filter(t => isTournamentInEra(t, era));
    filteredTournaments.forEach(t => {
      t.matches.filter(matchPlayed).forEach(m => {
        const home = resolveHome(t, m);
        const away = resolveAway(t, m);
        if (!home || !away) return;

        let weight = state.config.fifa.weights.league;
        if (m.round && String(m.round).toLowerCase().includes("final")) {
          weight = state.config.fifa.weights.final;
        } else if (m.stage === "knockout") {
          weight = state.config.fifa.weights.playoff;
        }

        const recency = getRecencyMultiplier(m.date);
        const goalDiff = Math.abs(Number(m.homeGoals) - Number(m.awayGoals));

        if (Number(m.homeGoals) > Number(m.awayGoals)) {
          points[home] += (3 * weight) + (goalDiff * 0.5);
        } else if (Number(m.homeGoals) < Number(m.awayGoals)) {
          points[away] += (3 * weight) + (goalDiff * 0.5);
        } else {
          points[home] += 1 * weight;
          points[away] += 1 * weight;
        }
      });

      if (t.champion) points[t.champion] += Number(state.config.fifa.bonus.champion || 0);
      if (t.runnerUp) points[t.runnerUp] += Number(state.config.fifa.bonus.runnerUp || 0);
      if (t.third) points[t.third] += Number(state.config.fifa.bonus.third || 0);
    });
  } else {
    const tournament = state.tournaments.find(t => t.id === tournamentId);
    if (tournament) {
      tournament.matches.filter(matchPlayed).forEach(m => {
        const home = resolveHome(tournament, m);
        const away = resolveAway(tournament, m);
        if (!home || !away) return;

        let weight = state.config.fifa.weights.league;
        if (m.round && String(m.round).toLowerCase().includes("final")) {
          weight = state.config.fifa.weights.final;
        } else if (m.stage === "knockout") {
          weight = state.config.fifa.weights.playoff;
        }

        const recency = getRecencyMultiplier(m.date);
        const goalDiff = Math.abs(Number(m.homeGoals) - Number(m.awayGoals));

        if (Number(m.homeGoals) > Number(m.awayGoals)) {
          points[home] += (3 * weight) + (goalDiff * 0.5);
        } else if (Number(m.homeGoals) < Number(m.awayGoals)) {
          points[away] += (3 * weight) + (goalDiff * 0.5);
        } else {
          points[home] += 1 * weight;
          points[away] += 1 * weight;
        }
      });

      if (tournament.champion) points[tournament.champion] += Number(state.config.fifa.bonus.champion || 0);
      if (tournament.runnerUp) points[tournament.runnerUp] += Number(state.config.fifa.bonus.runnerUp || 0);
      if (tournament.third) points[tournament.third] += Number(state.config.fifa.bonus.third || 0);
    }
  }

  return Object.keys(points)
    .map(teamId => ({ teamId, points: Number(points[teamId].toFixed(2)) }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return teamName(a.teamId).localeCompare(teamName(b.teamId));
    });
}

function renderGlobalTable() {
  if (!exists("globalTable")) return;
  const filter = exists("globalTableFilter") ? byId("globalTableFilter").value : "all";
  byId("globalTable").innerHTML = renderStandingsTable(buildFilteredStandings(filter), 0);
}

function renderPalmares() {
  if (!exists("palmares")) return;
  const era = exists("eraFilter") ? byId("eraFilter").value : "all";
  const filteredTournaments = state.tournaments.filter(t => isTournamentInEra(t, era));

  const rows = state.teams.map(t => {
    const titles = filteredTournaments.filter(x => x.champion === t.id).length;
    const runners = filteredTournaments.filter(x => x.runnerUp === t.id).length;
    const thirds = filteredTournaments.filter(x => x.third === t.id).length;
    return { teamId: t.id, titles, runners, thirds };
  }).sort((a, b) => {
    if (b.titles !== a.titles) return b.titles - a.titles;
    if (b.runners !== a.runners) return b.runners - a.runners;
    if (b.thirds !== a.thirds) return b.thirds - a.thirds;
    return teamName(a.teamId).localeCompare(teamName(b.teamId));
  });

  byId("palmares").innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>#</th><th>Equipo</th><th>Títulos</th><th>Subcampeonatos</th><th>3.er lugar</th></tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${teamName(r.teamId)}</td>
              <td>${r.titles}</td>
              <td>${r.runners}</td>
              <td>${r.thirds}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderPerformanceRanking() {
  if (!exists("performanceRanking")) return;
  const filter = exists("performanceFilter") ? byId("performanceFilter").value : "all";
  const era = exists("eraFilter") ? byId("eraFilter").value : "all";

  const rows = computeTournamentPerformance(filter, era).sort((a, b) => {
    if (b.performance !== a.performance) return b.performance - a.performance;
    if (b.pts !== a.pts) return b.pts - a.pts;
    return teamName(a.teamId).localeCompare(teamName(b.teamId));
  });

  byId("performanceRanking").innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>#</th><th>Equipo</th><th>% Rendimiento</th><th>Puntos</th><th>PJ</th></tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${teamNameWithLogo(r.teamId)}</td>
              <td>${Number(r.performance).toFixed(1)}%</td>
              <td>${r.pts}</td>
              <td>${r.pj}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderFifaRanking() {
  if (!exists("fifaRanking")) return;
  const filter = exists("fifaRankingFilter") ? byId("fifaRankingFilter").value : "all";
  const era = exists("eraFilter") ? byId("eraFilter").value : "all";
  const ranking = computeTournamentFifaRanking(filter, era);

  byId("fifaRanking").innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>#</th><th>Equipo</th><th>Puntos</th></tr>
        </thead>
        <tbody>
          ${ranking.map((r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${teamNameWithLogo(r.teamId)}</td>
              <td>${r.points.toFixed(2)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderClassicSummary() {
  if (!exists("classicSummary")) return;

  byId("classicSummary").innerHTML = state.classics.map(c => {
    const h = computeH2H(c.a, c.b);
    return `
      <div class="classic-card">
        <p><span class="badge classic">${titleCase(c.name)}</span></p>
<p>${teamNameWithLogo(c.a)} vs ${teamNameWithLogo(c.b)}</p>
        <p>Partidos: ${h.total}</p>
        <p>${teamName(c.a)} gano: ${h.aWins}</p>
        <p>${teamName(c.b)} gano: ${h.bWins}</p>
        <p>Empates: ${h.draws}</p>
        <div class="actions mt-10">
          <button class="btn primary small" onclick="openClassicHistory('${c.id}')">Abrir historial</button>
        </div>
      </div>
    `;
  }).join("");
}

function showH2H() {
  const a = byId("h2hA")?.value;
  const b = byId("h2hB")?.value;
  const cont = byId("h2hResult");

  if (!cont) return;

  if (!a || !b) {
    cont.innerHTML = `<p class="warning">Selecciona dos equipos.</p>`;
    return;
  }

  if (a === b) {
    cont.innerHTML = `<p class="warning">Debes elegir equipos distintos.</p>`;
    return;
  }

  const h = computeH2H(a, b);
  const cls = classicByTeams(a, b);

  if (!h.rows.length) {
    cont.innerHTML = `<p class="empty">No hay partidos registrados entre esos equipos.</p>`;
    return;
  }

  cont.innerHTML = `
    <div class="card">
      <h3>${cls ? `<span class="badge classic">${titleCase(cls.name)}</span>` : ""} ${teamNameWithLogo(a)} vs ${teamNameWithLogo(b)}</h3>
      <p><strong>Partidos:</strong> ${h.total}</p>
      <p><strong>${teamName(a)} gano:</strong> ${h.aWins}</p>
      <p><strong>${teamName(b)} gano:</strong> ${h.bWins}</p>
      <p><strong>Empates:</strong> ${h.draws}</p>
      <p><strong>Goles ${teamName(a)}:</strong> ${h.gfA}</p>
      <p><strong>Goles ${teamName(b)}:</strong> ${h.gfB}</p>
      <p><strong>% rendimiento ${teamName(a)}:</strong> ${h.performanceA}%</p>
      <p><strong>% rendimiento ${teamName(b)}:</strong> ${h.performanceB}%</p>

      <div class="table-wrap mt-16">
        <table>
          <thead>
            <tr><th>Torneo</th><th>Fase</th><th>Partido</th><th>Resultado</th></tr>
          </thead>
          <tbody>
            ${h.rows.map(r => `
              <tr>
                <td>${titleCase(r.tournament)}</td>
                <td>${titleCase(r.phase)}</td>
                <td>${r.match}</td>
                <td>${r.result}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openClassicHistory(classicId) {
  const classic = state.classics.find(c => c.id === classicId);
  if (!classic) return;

  switchSection("estadisticas");
  if (exists("h2hA")) byId("h2hA").value = classic.a;
  if (exists("h2hB")) byId("h2hB").value = classic.b;
  showH2H();
  
  setTimeout(() => {
    const section = byId("estadisticas");
    if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
    const h2hResult = byId("h2hResult");
    if (h2hResult) {
      setTimeout(() => h2hResult.scrollIntoView({ behavior: "smooth", block: "center" }), 200);
    }
  }, 100);
}

function renderAggPlayerTable(rows, label) {
  if (!rows.length) return `<p class="empty">Sin datos.</p>`;

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>#</th><th>Jugador</th><th>Equipo</th><th>${label}</th></tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${titleCase(r.name)}</td>
              <td>${teamNameWithLogo(r.teamId)}</td>
              <td>${r.value}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderGlobalPlayers() {
  const era = exists("eraFilter") ? byId("eraFilter").value : "all";
  const goalsScope = exists("goalsScopeFilter") ? byId("goalsScopeFilter").value : "all";
  const goalsTournament = exists("goalsTournamentFilter") ? byId("goalsTournamentFilter").value : "all";
  const assistsScope = exists("assistsScopeFilter") ? byId("assistsScopeFilter").value : "all";
  const assistsTournament = exists("assistsTournamentFilter") ? byId("assistsTournamentFilter").value : "all";

  if (exists("globalScorers")) {
    const scorers = aggregatePlayers("scorers", goalsScope, goalsTournament, era);
    byId("globalScorers").innerHTML = renderAggPlayerTable(scorers, "Goles");
  }

  if (exists("globalAssists")) {
    const assists = aggregatePlayers("assists", assistsScope, assistsTournament, era);
    byId("globalAssists").innerHTML = renderAggPlayerTable(assists, "Asistencias");
  }
}

function renderTournamentFilters() {
  const era = exists("eraFilter") ? byId("eraFilter").value : "all";
  const filteredTournaments = state.tournaments.filter(t => isTournamentInEra(t, era));

  const options = [
    `<option value="all">Todas</option>`,
    ...filteredTournaments.map(t => `<option value="${t.id}">${titleCase(t.name)}</option>`),
    `<option value="friendly">Amistosos</option>`
  ].join("");

  if (exists("goalsTournamentFilter")) byId("goalsTournamentFilter").innerHTML = options;
  if (exists("assistsTournamentFilter")) byId("assistsTournamentFilter").innerHTML = options;
  if (exists("globalTableFilter")) byId("globalTableFilter").innerHTML = options;
  if (exists("performanceFilter")) byId("performanceFilter").innerHTML = options;
  if (exists("fifaRankingFilter")) byId("fifaRankingFilter").innerHTML = options;
}

let biggestWinsAll = [];

function renderBiggestWins(showAll = false) {
  if (!exists("biggestWinsTable")) return;

  const all = [];

  state.tournaments.forEach(t => {
    t.matches.filter(matchPlayed).forEach(m => {
      const home = resolveHome(t, m);
      const away = resolveAway(t, m);
      if (!home || !away) return;

      all.push({
        tournament: t.name,
        round: m.round,
        date: m.date || "-",
        result: `${teamName(home)} ${m.homeGoals} - ${m.awayGoals} ${teamName(away)}`,
        diff: Math.abs(Number(m.homeGoals) - Number(m.awayGoals)),
        total: Number(m.homeGoals) + Number(m.awayGoals)
      });
    });
  });

  state.friendlies.filter(matchPlayed).forEach(m => {
    all.push({
      tournament: "Amistoso",
      round: "Amistoso",
      date: m.date || "-",
      result: `${teamName(m.home)} ${m.homeGoals} - ${m.awayGoals} ${teamName(m.away)}`,
      diff: Math.abs(Number(m.homeGoals) - Number(m.awayGoals)),
      total: Number(m.homeGoals) + Number(m.awayGoals)
    });
  });

  all.sort((a, b) => {
    if (b.diff !== a.diff) return b.diff - a.diff;
    return b.total - a.total;
  });

  biggestWinsAll = all;
  const display = showAll ? all.slice(0, 15) : all.slice(0, 5);

  byId("biggestWinsTable").innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>#</th><th>Fecha</th><th>Torneo</th><th>Fase</th><th>Resultado</th><th>Dif</th></tr>
        </thead>
        <tbody>
          ${display.map((r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${r.date}</td>
              <td>${titleCase(r.tournament)}</td>
              <td>${titleCase(r.round)}</td>
              <td>${r.result}</td>
              <td><strong>${r.diff}</strong></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  const btn = byId("showMoreWinsBtn");
  if (btn) {
    btn.textContent = showAll ? "Ver menos" : "Ver más";
  }
}

function getTournamentCategory(tournament) {
  const name = (tournament.name || "").toLowerCase();
  if (name.includes("apertura")) return "Apertura";
  if (name.includes("clausura")) return "Clausura";
  if (name.includes("1era") || name.includes("1era") || name.includes("primera")) return "1era División";
  if (name.includes("2da") || name.includes("2da") || name.includes("segunda")) return "2da División";
  return "Copas";
}

function getTournamentEra(tournament) {
  const name = (tournament.name || "").toLowerCase();
  const division_CUTOFF = new Date("2026-04-01");

  if (name.includes("division") || name.includes("division")) {
    return "division";
  }

  if (name.includes("copa")) {
    const matchDate = tournament.createdAt ? new Date(tournament.createdAt.split("/").reverse().join("-")) : null;
    if (matchDate && matchDate >= division_CUTOFF) {
      return "division";
    }
  }

  return "classic";
}

function isTournamentInEra(tournament, era) {
  if (era === "all") return true;
  return getTournamentEra(tournament) === era;
}

function renderTitlesByCategory() {
  if (!exists("titlesByCategory")) return;

  const rows = state.teams.map(t => {
    let apertura = 0;
    let clausura = 0;
    let primera = 0;
    let segunda = 0;
    let copas = 0;

    state.tournaments.forEach(tournament => {
      if (tournament.champion !== t.id) return;

      const category = getTournamentCategory(tournament);
      if (category === "Apertura") apertura++;
      else if (category === "Clausura") clausura++;
      else if (category === "1era División") primera++;
      else if (category === "2da División") segunda++;
      else copas++;
    });

    return {
      teamId: t.id,
      apertura,
      clausura,
      primera,
      segunda,
      copas,
      total: apertura + clausura + primera + segunda + copas
    };
  }).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.primera !== a.primera) return b.primera - a.primera;
    if (b.segunda !== a.segunda) return b.segunda - a.segunda;
    if (b.apertura !== a.apertura) return b.apertura - a.apertura;
    if (b.clausura !== a.clausura) return b.clausura - a.clausura;
    return b.copas - a.copas;
  });

  byId("titlesByCategory").innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>#</th><th>Equipo</th><th>1era</th><th>2da</th><th>Apertura</th><th>Clausura</th><th>Copas</th><th>Total</th></tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${teamNameWithLogo(r.teamId)}</td>
              <td>${r.primera}</td>
              <td>${r.segunda}</td>
              <td>${r.apertura}</td>
              <td>${r.clausura}</td>
              <td>${r.copas}</td>
              <td><strong>${r.total}</strong></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderDisciplineTable() {
  if (!exists("disciplineTable")) return;
  const era = exists("eraFilter") ? byId("eraFilter").value : "all";
  computeDiscipline(era);

  if (!state.discipline.records.length) {
    byId("disciplineTable").innerHTML = `<p class="empty">No hay sanciones ni tarjetas registradas.</p>`;
    return;
  }

  byId("disciplineTable").innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Nombre</th><th>Rol</th><th>Equipo</th><th>Amarillas</th><th>Rojas</th><th>Suspendido</th><th>Motivo</th></tr>
        </thead>
        <tbody>
          ${state.discipline.records.map(r => `
            <tr>
              <td>${r.name}</td>
              <td>${r.role}</td>
              <td>${teamName(r.teamId)}</td>
              <td>${r.yellows}</td>
              <td>${r.reds}</td>
              <td>${r.suspended ? "Si" : "No"}</td>
              <td>${r.reason || "-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function getMatchParticipantRole(match, teamId, participantId) {
  const participant = state.participants.find(p => p.id === participantId);
  if (!participant || !participant.teams) return null;
  return participant.teams.includes(teamId) ? participantId : null;
}

function computeParticipantStats(era = "all") {
  const stats = {};
  
  state.participants.forEach(p => {
    stats[p.id] = {
      participantId: p.id,
      name: p.name,
      color: p.color,
      pj: 0,
      pg: 0,
      pe: 0,
      pp: 0,
      gf: 0,
      gc: 0,
      pts: 0,
      titles: 0,
      runnerUps: 0,
      thirds: 0
    };
  });

  const FRIENDLY_CUTOFF = new Date("2026-04-01");
  const filteredTournaments = state.tournaments.filter(t => isTournamentInEra(t, era));

  function processMatchResult(participantId, goalsFor, goalsAgainst) {
    const s = stats[participantId];
    if (!s) return;
    s.pj++;
    s.gf += goalsFor;
    s.gc += goalsAgainst;
    if (goalsFor > goalsAgainst) {
      s.pg++;
      s.pts += 3;
    } else if (goalsFor < goalsAgainst) {
      s.pp++;
    } else {
      s.pe++;
      s.pts += 1;
    }
  }

  filteredTournaments.forEach(t => {
    if (!t.participantLocal || !t.participantAway) return;

    t.matches.filter(matchPlayed).forEach(m => {
      const home = resolveHome(t, m);
      const away = resolveAway(t, m);
      if (!home || !away) return;

      const localGoals = Number(m.homeGoals);
      const awayGoals = Number(m.awayGoals);

      if (t.participantLocal) processMatchResult(t.participantLocal, localGoals, awayGoals);
      if (t.participantAway) processMatchResult(t.participantAway, awayGoals, localGoals);
    });

    if (t.champion && t.participantChampion) {
      const s = stats[t.participantChampion];
      if (s) s.titles++;
    }
    if (t.runnerUp && t.participantRunnerUp) {
      const s = stats[t.participantRunnerUp];
      if (s) s.runnerUps++;
    }
    if (t.third && t.participantThird) {
      const s = stats[t.participantThird];
      if (s) s.thirds++;
    }
  });

  state.friendlies.filter(matchPlayed).forEach(m => {
    const matchDate = m.date ? new Date(m.date.split("/").reverse().join("-")) : null;
    const matchEra = (!matchDate || matchDate < FRIENDLY_CUTOFF) ? "classic" : "division";
    if (era !== "all" && matchEra !== era) return;

    if (!m.participantHome || !m.participantAway) return;

    const homeGoals = Number(m.homeGoals);
    const awayGoals = Number(m.awayGoals);

    if (m.participantHome) processMatchResult(m.participantHome, homeGoals, awayGoals);
    if (m.participantAway) processMatchResult(m.participantAway, awayGoals, homeGoals);
  });

  return Object.values(stats).sort((a, b) => {
    if (b.titles !== a.titles) return b.titles - a.titles;
    if (b.pg !== a.pg) return b.pg - a.pg;
    if (b.pts !== a.pts) return b.pts - a.pts;
    return b.gf - b.gc - (a.gf - a.gc);
  });
}

function computeH2HParticipants(era = "all") {
  const participants = state.participants;
  const h2h = {};

  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      const a = participants[i];
      const b = participants[j];
      const key = `${a.id}__${b.id}`;
      
      h2h[key] = {
        a: a.id,
        b: b.id,
        nameA: a.name,
        nameB: b.name,
        colorA: a.color,
        colorB: b.color,
        pj: 0,
        aWins: 0,
        bWins: 0,
        draws: 0,
        gfA: 0,
        gfB: 0
      };
    }
  }

  const FRIENDLY_CUTOFF = new Date("2026-04-01");
  const filteredTournaments = state.tournaments.filter(t => isTournamentInEra(t, era));

  filteredTournaments.forEach(t => {
    if (!t.participantLocal || !t.participantAway) return;

    t.matches.filter(matchPlayed).forEach(m => {
      const home = resolveHome(t, m);
      const away = resolveAway(t, m);
      if (!home || !away) return;

      const localGoals = Number(m.homeGoals);
      const awayGoals = Number(m.awayGoals);

      const key = `${t.participantLocal}__${t.participantAway}`;
      if (h2h[key]) {
        h2h[key].pj++;
        h2h[key].gfA += localGoals;
        h2h[key].gfB += awayGoals;
        if (localGoals > awayGoals) h2h[key].aWins++;
        else if (awayGoals > localGoals) h2h[key].bWins++;
        else h2h[key].draws++;
      }
    });
  });

  state.friendlies.filter(matchPlayed).forEach(m => {
    const matchDate = m.date ? new Date(m.date.split("/").reverse().join("-")) : null;
    const matchEra = (!matchDate || matchDate < FRIENDLY_CUTOFF) ? "classic" : "division";
    if (era !== "all" && matchEra !== era) return;

    if (!m.participantHome || !m.participantAway) return;

    const homeGoals = Number(m.homeGoals);
    const awayGoals = Number(m.awayGoals);

    const key = `${m.participantHome}__${m.participantAway}`;
    if (h2h[key]) {
      h2h[key].pj++;
      h2h[key].gfA += homeGoals;
      h2h[key].gfB += awayGoals;
      if (homeGoals > awayGoals) h2h[key].aWins++;
      else if (awayGoals > homeGoals) h2h[key].bWins++;
      else h2h[key].draws++;
    }
  });

  return Object.values(h2h);
}

function renderParticipantsList() {
  if (!exists("participantsList")) return;

  const html = state.participants.map(p => `
    <div class="participant-card" style="border-left: 4px solid ${p.color || '#666'}">
      <div class="participant-info">
        <span class="participant-name" style="color: ${p.color || '#666'}">${titleCase(p.name)}</span>
        <span class="participant-teams">${p.teams ? p.teams.length : 0} equipos</span>
      </div>
      <div class="participant-actions">
        <button class="btn small" onclick="editParticipant('${p.id}')">Editar</button>
        <button class="btn danger small" onclick="deleteParticipant('${p.id}')">Eliminar</button>
      </div>
    </div>
  `).join("");

  byId("participantsList").innerHTML = state.participants.length ? html : `<p class="empty">No hay participantes registrados.</p>`;
}

function renderParticipantStats() {
  if (!exists("participantStats")) return;
  
  const era = exists("participantEraFilter") ? byId("participantEraFilter").value : "all";
  const stats = computeParticipantStats(era);
  const h2hResults = computeH2HParticipants(era);

  const statsHtml = stats.map(s => {
    const perf = s.pj ? ((s.pts / (s.pj * 3)) * 100).toFixed(1) : "0.0";
    return `
      <div class="participant-stat-card" style="border-left: 4px solid ${s.color || '#666'}">
        <h4 style="color: ${s.color || '#666'}">${titleCase(s.name)}</h4>
        <div class="stat-row"><span>PJ:</span><strong>${s.pj}</strong></div>
        <div class="stat-row"><span>PG:</span><strong>${s.pg}</strong></div>
        <div class="stat-row"><span>PE:</span><strong>${s.pe}</strong></div>
        <div class="stat-row"><span>PP:</span><strong>${s.pp}</strong></div>
        <div class="stat-row"><span>GF:</span><strong>${s.gf}</strong></div>
        <div class="stat-row"><span>GC:</span><strong>${s.gc}</strong></div>
        <div class="stat-row"><span>Dif:</span><strong>${s.gf - s.gc}</strong></div>
        <div class="stat-row"><span>Pts:</span><strong>${s.pts}</strong></div>
        <div class="stat-row"><span>%:</span><strong>${perf}%</strong></div>
        <div class="stat-row"><span>Títulos:</span><strong>${s.titles}</strong></div>
        <div class="stat-row"><span>Sub:</span><strong>${s.runnerUps}</strong></div>
        <div class="stat-row"><span>3°:</span><strong>${s.thirds}</strong></div>
      </div>
    `;
  }).join("");

  const h2hHtml = h2hResults.map(h => {
    if (h.pj === 0) return "";
    return `
      <div class="h2h-card">
        <h4>${titleCase(h.nameA)} vs ${titleCase(h.nameB)}</h4>
        <div class="h2h-teams">
          <span style="color: ${h.colorA}">${titleCase(h.nameA)}</span>
          <span class="h2h-score">${h.gfA} - ${h.gfB}</span>
          <span style="color: ${h.colorB}">${titleCase(h.nameB)}</span>
        </div>
        <div class="h2h-stats">
          <span>PJ: ${h.pj}</span>
          <span class="win-a">${titleCase(h.nameA)}: ${h.aWins}</span>
          <span>Empates: ${h.draws}</span>
          <span class="win-b">${titleCase(h.nameB)}: ${h.bWins}</span>
        </div>
      </div>
    `;
  }).join("");

  byId("participantStats").innerHTML = `
    <h3>Rendimiento de Participantes</h3>
    <div class="participants-stats-grid">${statsHtml}</div>
    ${h2hResults.some(h => h.pj > 0) ? `
      <h3>Enfrentamientos Directos</h3>
      <div class="h2h-list">${h2hHtml}</div>
    ` : ""}
  `;
}

function renderAdminParticipants() {
  if (!exists("adminParticipantsList")) return;
  
  const html = state.participants.map((p, index) => {
    const role = index === 0 ? "Local" : index === 1 ? "Visita" : "Extra";
    return `
      <div class="participant-card" style="border-left: 4px solid ${p.color || '#666'}">
        <div class="participant-info">
          <span class="participant-name" style="color: ${p.color || '#666'}">${titleCase(p.name)}</span>
          <span class="participant-teams">Controla: ${role}</span>
        </div>
        <div class="participant-actions">
          <button class="btn small" onclick="editParticipant('${p.id}')">Editar</button>
          <button class="btn danger small" onclick="deleteParticipant('${p.id}')">Eliminar</button>
        </div>
      </div>
    `;
  }).join("");

  byId("adminParticipantsList").innerHTML = state.participants.length ? html : `<p class="empty">No hay participantes.</p>`;
}

function renderParticipantes() {
  renderParticipantsList();
  renderParticipantStats();
}

function showAddParticipantModal(editId = null) {
  const participant = editId ? state.participants.find(p => p.id === editId) : null;

  byId("modalContent").innerHTML = `
    <h2>${participant ? "Editar" : "Agregar"} Participante</h2>
    <div class="form-group">
      <label for="participantName">Nombre</label>
      <input type="text" id="participantName" value="${participant ? participant.name : ""}" placeholder="Nombre del participante">
    </div>
    <div class="form-group">
      <label for="participantColor">Color</label>
      <input type="color" id="participantColor" value="${participant && participant.color ? participant.color : "#666666"}">
    </div>
    <p class="muted" style="font-size:0.85rem;margin-bottom:16px">Los participantes controlan: Local = ${state.participants[0]?.name || "Álvaro"} y Visita = ${state.participants[1]?.name || "Carlos"}</p>
    <div class="actions mt-10">
      <button class="btn primary" onclick="saveParticipant('${editId || ''}')">Guardar</button>
      <button class="btn" onclick="closeModal()">Cancelar</button>
    </div>
  `;
  openModal();
}

function saveParticipant(editId) {
  const name = byId("participantName").value.trim();
  const color = byId("participantColor").value;

  if (!name) {
    alert("El nombre es obligatorio");
    return;
  }

  if (editId) {
    const participant = state.participants.find(p => p.id === editId);
    if (participant) {
      participant.name = name;
      participant.color = color;
    }
  } else {
    state.participants.push({
      id: uid("participante"),
      name,
      color
    });
  }

  saveState();
  closeModal();
  renderAdminParticipants();
}

function editParticipant(id) {
  showAddParticipantModal(id);
}

function deleteParticipant(id) {
  if (!confirm("Eliminar este participante?")) return;
  state.participants = state.participants.filter(p => p.id !== id);
  saveState();
  renderAdminParticipants();
}

function renderGlobalStats() {
  renderGlobalTable();
  renderPalmares();
  renderPerformanceRanking();
  renderFifaRanking();
  renderClassicSummary();
  renderBiggestWins();
  renderTitlesByCategory();
  renderGlobalPlayers();
  renderDisciplineTable();
}

function switchSection(id) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  if (exists(id)) byId(id).classList.add("active");

  document.querySelectorAll(".nav-btn").forEach(btn => {
    if (!btn.dataset.target) return;
    btn.classList.toggle("active", btn.dataset.target === id);
  });
}

function roundRobin(teamIds) {
  const arr = [...teamIds];
  const hasOdd = arr.length % 2 !== 0;
  if (hasOdd) arr.push(null);

  const rounds = [];
  const total = arr.length;

  for (let r = 0; r < total - 1; r++) {
    const matches = [];
    let byeTeam = null;

    for (let i = 0; i < total / 2; i++) {
      const home = arr[i];
      const away = arr[total - 1 - i];
      if (home === null) {
        byeTeam = away;
      } else if (away === null) {
        byeTeam = home;
      } else {
        matches.push(r % 2 === 0 ? { home, away } : { home: away, away: home });
      }
    }

    rounds.push({ matches, byeTeam });

    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop());
    arr.splice(0, arr.length, fixed, ...rest);
  }

  return rounds;
}

function generateLeagueMatches(teamIds, legs = 1) {
  const rounds = roundRobin(teamIds);
  const out = [];
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const currentTime = now.toTimeString().slice(0, 5);

  rounds.forEach((round, idx) => {
    round.matches.forEach((pair, pIndex) => {
      out.push({
        id: uid("m"),
        stage: "regular",
        round: `Jornada ${idx + 1}`,
        label: `Partido ${pIndex + 1}`,
        home: pair.home,
        away: pair.away,
        homeGoals: null,
        awayGoals: null,
        homePens: null,
        awayPens: null,
        date: today,
        time: currentTime,
        venue: "",
        homeGoalLog: "",
        awayGoalLog: "",
        cards: [],
        byeTeam: round.byeTeam || null
      });
    });
    if (round.byeTeam) {
      out.push({
        id: uid("m"),
        stage: "bye",
        round: `Jornada ${idx + 1}`,
        label: "Libre",
        home: round.byeTeam,
        away: null,
        homeGoals: null,
        awayGoals: null,
        homePens: null,
        awayPens: null,
        date: today,
        time: currentTime,
        venue: "",
        homeGoalLog: "",
        awayGoalLog: "",
        cards: [],
        byeTeam: round.byeTeam
      });
    }
  });

  if (legs === 2) {
    const offset = rounds.length;
    rounds.forEach((round, idx) => {
      round.matches.forEach((pair, pIndex) => {
        out.push({
          id: uid("m"),
          stage: "regular",
          round: `Jornada ${offset + idx + 1}`,
          label: `Partido ${pIndex + 1}`,
          home: pair.away,
          away: pair.home,
          homeGoals: null,
          awayGoals: null,
          homePens: null,
          awayPens: null,
          date: today,
          time: currentTime,
          venue: "",
          homeGoalLog: "",
          awayGoalLog: "",
          cards: [],
          byeTeam: round.byeTeam || null
        });
      });
      if (round.byeTeam) {
        out.push({
          id: uid("m"),
          stage: "bye",
          round: `Jornada ${offset + idx + 1}`,
          label: "Libre",
          home: round.byeTeam,
          away: null,
          homeGoals: null,
          awayGoals: null,
          homePens: null,
          awayPens: null,
          date: today,
          time: currentTime,
          venue: "",
          homeGoalLog: "",
          awayGoalLog: "",
          cards: [],
          byeTeam: round.byeTeam
        });
      }
    });
  }

  return out;
}

function createKnockoutMatch(round, label, options = {}) {
  return {
    id: uid("m"),
    stage: "knockout",
    round,
    label,
    home: options.home || null,
    away: options.away || null,
    homeRef: options.homeRef || null,
    awayRef: options.awayRef || null,
    homeGoals: null,
    awayGoals: null,
    homePens: null,
    awayPens: null,
    date: "",
    time: "",
    venue: "",
    homeGoalLog: "",
    awayGoalLog: "",
    cards: []
  };
}

function appendLeaguePlayoffMatches(tournament) {
  tournament.matches.push(
    createKnockoutMatch("Semifinales", "Semifinal 1", { homeRef: "TABLE_1", awayRef: "TABLE_4" }),
    createKnockoutMatch("Semifinales", "Semifinal 2", { homeRef: "TABLE_2", awayRef: "TABLE_3" }),
    createKnockoutMatch("3er Lugar", "3er Puesto", { homeRef: "S1_L", awayRef: "S2_L" }),
    createKnockoutMatch("Final", "Final", { homeRef: "S1_W", awayRef: "S2_W" })
  );
}

function appendDivisionFinalMatch(tournament) {
  tournament.matches.push(
    createKnockoutMatch("Final", "Final", { homeRef: "TABLE_1", awayRef: "TABLE_2" })
  );
}

function splitTeamsForCupGroups(teamIds) {
  const ids = [...new Set((teamIds || []).filter(Boolean))];
  const groupA = [];
  const groupB = [];

  // Distribución alternada: equilibra los grupos y mantiene predecible
  // el orden que el usuario eligió en el selector.
  ids.forEach((teamId, index) => {
    (index % 2 === 0 ? groupA : groupB).push(teamId);
  });

  return { groupA, groupB };
}

function generateGroupMatches(groupName, teamIds, legs = 1) {
  return generateLeagueMatches(teamIds, legs)
    .filter(match => match.stage === "regular")
    .map(match => ({
      ...match,
      stage: "group",
      group: groupName,
      round: String(match.round).replace("Jornada", "Fecha"),
      byeTeam: null
    }));
}

function appendCupGroupMatches(tournament, teamIds, legs = 1) {
  const { groupA, groupB } = splitTeamsForCupGroups(teamIds);

  tournament.groups = [
    { name: "Grupo A", teamIds: groupA },
    { name: "Grupo B", teamIds: groupB }
  ];

  tournament.matches.push(
    ...generateGroupMatches("Grupo A", groupA, legs),
    ...generateGroupMatches("Grupo B", groupB, legs),
    createKnockoutMatch("Semifinales", "Semifinal 1", { homeRef: "GROUP_A_1", awayRef: "GROUP_B_2" }),
    createKnockoutMatch("Semifinales", "Semifinal 2", { homeRef: "GROUP_B_1", awayRef: "GROUP_A_2" }),
    createKnockoutMatch("3er Lugar", "3er Puesto", { homeRef: "S1_L", awayRef: "S2_L" }),
    createKnockoutMatch("Final", "Final", { homeRef: "S1_W", awayRef: "S2_W" })
  );
}

function generateDirectKnockoutMatches(teamIds) {
  const ids = [...teamIds];
  const matches = [];

  if (ids.length === 2) {
    matches.push(createKnockoutMatch("Final", "Final", { home: ids[0], away: ids[1] }));
    return matches;
  }

  if (ids.length === 3) {
    matches.push(
      createKnockoutMatch("Semifinales", "Semifinal 1", { home: ids[1], away: ids[2] }),
      createKnockoutMatch("Final", "Final", { home: ids[0], awayRef: "S1_W" })
    );
    return matches;
  }

  if (ids.length === 4) {
    matches.push(
      createKnockoutMatch("Semifinales", "Semifinal 1", { home: ids[0], away: ids[3] }),
      createKnockoutMatch("Semifinales", "Semifinal 2", { home: ids[1], away: ids[2] }),
      createKnockoutMatch("3er Lugar", "3er Puesto", { homeRef: "S1_L", awayRef: "S2_L" }),
      createKnockoutMatch("Final", "Final", { homeRef: "S1_W", awayRef: "S2_W" })
    );
    return matches;
  }

  if (ids.length === 5) {
    matches.push(
      createKnockoutMatch("Cuartos de Final", "Cuarto 1", { home: ids[3], away: ids[4] }),
      createKnockoutMatch("Semifinales", "Semifinal 1", { home: ids[0], awayRef: "QF1_W" }),
      createKnockoutMatch("Semifinales", "Semifinal 2", { home: ids[1], away: ids[2] }),
      createKnockoutMatch("3er Lugar", "3er Puesto", { homeRef: "S1_L", awayRef: "S2_L" }),
      createKnockoutMatch("Final", "Final", { homeRef: "S1_W", awayRef: "S2_W" })
    );
    return matches;
  }

  if (ids.length === 6) {
    matches.push(
      createKnockoutMatch("Cuartos de Final", "Cuarto 1", { home: ids[2], away: ids[5] }),
      createKnockoutMatch("Cuartos de Final", "Cuarto 2", { home: ids[3], away: ids[4] }),
      createKnockoutMatch("Semifinales", "Semifinal 1", { home: ids[0], awayRef: "QF1_W" }),
      createKnockoutMatch("Semifinales", "Semifinal 2", { home: ids[1], awayRef: "QF2_W" }),
      createKnockoutMatch("3er Lugar", "3er Puesto", { homeRef: "S1_L", awayRef: "S2_L" }),
      createKnockoutMatch("Final", "Final", { homeRef: "S1_W", awayRef: "S2_W" })
    );
    return matches;
  }

  if (ids.length === 7) {
    matches.push(
      createKnockoutMatch("Cuartos de Final", "Cuarto 1", { home: ids[1], away: ids[6] }),
      createKnockoutMatch("Cuartos de Final", "Cuarto 2", { home: ids[2], away: ids[5] }),
      createKnockoutMatch("Cuartos de Final", "Cuarto 3", { home: ids[3], away: ids[4] }),
      createKnockoutMatch("Semifinales", "Semifinal 1", { home: ids[0], awayRef: "QF1_W" }),
      createKnockoutMatch("Semifinales", "Semifinal 2", { homeRef: "QF2_W", awayRef: "QF3_W" }),
      createKnockoutMatch("3er Lugar", "3er Puesto", { homeRef: "S1_L", awayRef: "S2_L" }),
      createKnockoutMatch("Final", "Final", { homeRef: "S1_W", awayRef: "S2_W" })
    );
    return matches;
  }

  matches.push(
    createKnockoutMatch("Cuartos de Final", "Cuarto 1", { home: ids[0], away: ids[7] }),
    createKnockoutMatch("Cuartos de Final", "Cuarto 2", { home: ids[3], away: ids[4] }),
    createKnockoutMatch("Cuartos de Final", "Cuarto 3", { home: ids[1], away: ids[6] }),
    createKnockoutMatch("Cuartos de Final", "Cuarto 4", { home: ids[2], away: ids[5] }),
    createKnockoutMatch("Semifinales", "Semifinal 1", { homeRef: "QF1_W", awayRef: "QF2_W" }),
    createKnockoutMatch("Semifinales", "Semifinal 2", { homeRef: "QF3_W", awayRef: "QF4_W" }),
    createKnockoutMatch("3er Lugar", "3er Puesto", { homeRef: "S1_L", awayRef: "S2_L" }),
    createKnockoutMatch("Final", "Final", { homeRef: "S1_W", awayRef: "S2_W" })
  );

  return matches;
}

function buildTournamentFixtures(tournament, teamIds, legs = 1) {
  tournament.matches = [];
  tournament.groups = [];

  if (tournament.type === "league") {
    tournament.matches.push(...generateLeagueMatches(teamIds, legs));
    return;
  }

  if (tournament.type === "league_playoff") {
    tournament.matches.push(...generateLeagueMatches(teamIds, legs));
    appendLeaguePlayoffMatches(tournament);
    return;
  }

  if (tournament.type === "cup_groups") {
    appendCupGroupMatches(tournament, teamIds, legs);
    return;
  }

  if (tournament.type === "direct_knockout") {
    tournament.matches.push(...generateDirectKnockoutMatches(teamIds));
    return;
  }

  if (tournament.type === "division_final") {
    tournament.matches.push(...generateLeagueMatches(teamIds, legs));
    appendDivisionFinalMatch(tournament);
  }
}


function getNextTournamentName(lastName, lastType) {
  const name = (lastName || "").toLowerCase();
  
  if (name.includes("apertura")) {
    return { name: lastName.replace(/apertura/i, "Clausura"), type: lastType };
  }
  if (name.includes("clausura")) {
    return { name: lastName.replace(/clausura/i, "Copa"), type: "cup_groups" };
  }
  if (name.includes("copa")) {
    const match = lastName.match(/(\d+)/);
    const num = match ? parseInt(match[1]) + 1 : 2;
    return { name: `${num}do Torneo - Apertura`, type: "league_playoff" };
  }
  
  const match = lastName.match(/(\d+)/);
  const num = match ? parseInt(match[1]) + 1 : 2;
  
  if (lastType === "league") {
    return { name: `${num}do Torneo - Clausura`, type: "league_playoff" };
  }
  if (lastType === "cup_groups") {
    return { name: `${num}do Torneo - Copa`, type: "cup_groups" };
  }
  
  return { name: `${num}do Torneo - Apertura`, type: "league_playoff" };
}

function createNextTournament() {
  if (!state.tournaments.length) {
    alert("No hay torneos anteriores.");
    return;
  }

  const last = state.tournaments[state.tournaments.length - 1];
  const next = getNextTournamentName(last.name, last.type);

  const tournament = {
    id: uid("tour"),
    name: next.name,
    type: next.type,
    status: "upcoming",
    createdAt: new Date().toLocaleDateString("es-CL"),
    config: { legs: 1 },
    teamIds: [...last.teamIds],
    matches: [],
    champion: null,
    runnerUp: null,
    third: null,
    notes: [],
    playerScorers: [],
    playerAssists: [],
    groups: [],
    manualStandings: [],
    participantLocal: state.participants[0]?.id || "",
    participantAway: state.participants[1]?.id || "",
    participantChampion: "",
    participantRunnerUp: "",
    participantThird: ""
  };

  buildTournamentFixtures(tournament, tournament.teamIds, 1);

  state.tournaments.push(tournament);
  saveState();
  refreshComputedData();
  renderAll();
  openTournament(tournament.id);
}
function createTournament() {
  const name = byId("tName")?.value.trim();
  const type = byId("tType")?.value;
  const legs = Number(byId("tLegs")?.value || 1);
  const status = byId("tStatus")?.value || "upcoming";
  const selected = [...document.querySelectorAll(".team-check:checked")].map(x => x.value);

  if (!name) {
    alert("Escribe el nombre del torneo.");
    return;
  }

  if (selected.length < 2) {
    alert("Selecciona al menos 2 equipos.");
    return;
  }

  if (type === "league_playoff" && selected.length < 4) {
    alert("Liga + Playoff necesita al menos 4 equipos para semifinales.");
    return;
  }

  if (type === "cup_groups" && selected.length < 4) {
    alert("Copa con grupos necesita al menos 4 equipos: dos para el Grupo A y dos para el Grupo B.");
    return;
  }

  if (type === "direct_knockout" && selected.length < 2) {
    alert("La eliminación directa necesita al menos 2 equipos.");
    return;
  }

  if (type === "direct_knockout" && selected.length > 8) {
    alert("La eliminación directa automática soporta hasta 8 equipos. Reduce la selección o crea un formato de liga.");
    return;
  }

  const tournament = {
    id: uid("tour"),
    name,
    type,
    status,
    createdAt: new Date().toLocaleDateString("es-CL"),
    config: { legs },
    teamIds: selected,
    matches: [],
    champion: null,
    runnerUp: null,
    third: null,
    notes: [],
    playerScorers: [],
    playerAssists: [],
    groups: [],
    manualStandings: [],
    participantLocal: state.participants[0]?.id || "",
    participantAway: state.participants[1]?.id || "",
    participantChampion: "",
    participantRunnerUp: "",
    participantThird: ""
  };

  buildTournamentFixtures(tournament, selected, legs);

  state.tournaments.push(tournament);
  saveState();
  refreshComputedData();
  renderAll();
  openTournament(tournament.id);
}

function createDivisionsAutomatic() {
  computeDivisions();

  const divisionA = {
    id: uid("tour"),
    name: "División A",
    type: "division_final",
    status: "upcoming",
    createdAt: new Date().toLocaleDateString("es-CL"),
    config: { legs: 1 },
    teamIds: [...state.divisions.A],
    matches: generateLeagueMatches([...state.divisions.A], 1),
    champion: null,
    runnerUp: null,
    third: null,
    notes: ["División creada automáticamente por ranking FIFA."],
    playerScorers: [],
    playerAssists: [],
    groups: [],
    manualStandings: [],
    participantLocal: state.participants[0]?.id || "",
    participantAway: state.participants[1]?.id || "",
    participantChampion: "",
    participantRunnerUp: "",
    participantThird: ""
  };

  divisionA.matches.push({
    id: uid("m"),
    stage: "knockout",
    round: "Final",
    label: "Final División A",
    homeRef: "TABLE_1",
    awayRef: "TABLE_2",
    homeGoals: null,
    awayGoals: null,
    homePens: null,
    awayPens: null,
    date: "",
    time: "",
    venue: "",
    homeGoalLog: "",
    awayGoalLog: "",
    cards: []
  });

  const divisionB = {
    id: uid("tour"),
    name: "División B",
    type: "division_final",
    status: "upcoming",
    createdAt: new Date().toLocaleDateString("es-CL"),
    config: { legs: 1 },
    teamIds: [...state.divisions.B],
    matches: generateLeagueMatches([...state.divisions.B], 1),
    champion: null,
    runnerUp: null,
    third: null,
    notes: ["División creada automáticamente por ranking FIFA."],
    playerScorers: [],
    playerAssists: [],
    groups: [],
    manualStandings: [],
    participantLocal: state.participants[0]?.id || "",
    participantAway: state.participants[1]?.id || "",
    participantChampion: "",
    participantRunnerUp: "",
    participantThird: ""
  };

  divisionB.matches.push({
    id: uid("m"),
    stage: "knockout",
    round: "Final",
    label: "Final División B",
    homeRef: "TABLE_1",
    awayRef: "TABLE_2",
    homeGoals: null,
    awayGoals: null,
    homePens: null,
    awayPens: null,
    date: "",
    time: "",
    venue: "",
    homeGoalLog: "",
    awayGoalLog: "",
    cards: []
  });

  state.tournaments.push(divisionA, divisionB);
  saveState();
  refreshComputedData();
  renderAll();
  alert("Divisiones creadas automáticamente.");
}

function createFriendly() {
  const home = byId("friendlyHome")?.value;
  const away = byId("friendlyAway")?.value;
  const date = byId("friendlyDate")?.value || "";
  const time = byId("friendlyTime")?.value || "";
  const venue = byId("friendlyVenue")?.value.trim() || "";

  if (!home || !away) {
    alert("Selecciona ambos equipos.");
    return;
  }

  if (home === away) {
    alert("Un amistoso debe tener equipos distintos.");
    return;
  }

  state.friendlies.push({
    id: uid("friendly"),
    stage: "friendly",
    home,
    away,
    homeGoals: null,
    awayGoals: null,
    homePens: null,
    awayPens: null,
    date,
    time,
    venue,
    homeGoalLog: "",
    awayGoalLog: "",
    cards: []
  });

  saveState();
  refreshComputedData();
  renderAll();

  if (exists("friendlyDate")) byId("friendlyDate").value = "";
  if (exists("friendlyTime")) byId("friendlyTime").value = "";
  if (exists("friendlyVenue")) byId("friendlyVenue").value = "";
}

function exportState() {
  const date = new Date().toISOString().slice(0, 10);
  const filename = `chutemundo-backup-${date}.json`;

  if (window.ChuteStorage) {
    ChuteStorage.downloadJson(state, filename);
    return;
  }

  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function importState() {
  const text = byId("importArea")?.value.trim();

  if (!text) {
    alert("Pega primero un JSON.");
    return;
  }

  try {
    const parsed = JSON.parse(text);
    const importedState = window.ChuteStorage
      ? ChuteStorage.normalizeImportedPayload(parsed)
      : parsed;

    normalizeState(importedState);
    state = importedState;
    saveState();
    refreshComputedData();
    renderAll();
    alert("Respaldo importado correctamente.");
  } catch (error) {
    alert("JSON inválido o incompatible: " + (error.message || error));
  }
}

async function importStateFromFile(file) {
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const importedState = window.ChuteStorage
      ? ChuteStorage.normalizeImportedPayload(parsed)
      : parsed;

    normalizeState(importedState);
    state = importedState;
    saveState();
    refreshComputedData();
    renderAll();
    alert("Archivo de respaldo importado correctamente.");
  } catch (error) {
    alert("No se pudo importar el archivo: " + (error.message || error));
  }
}

function renderAll() {
  setDebugStatus("Datos cargados correctamente");
  updateDebugCounts();
  refreshComputedData();
  renderSummary();
  renderAlerts();
  renderHome();
  renderTournamentList();
  renderFriendlies();
  renderRules();
  renderTeamPicker();
  renderTeamSelects();
  renderTeamList();
  renderTournamentFilters();
  renderGlobalStats();
  applyDarkModeState();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function initSupabaseUI() {
  if (window.SupabaseService && SupabaseService.restoreIfEnabled()) {
    // Conexión restaurada desde la configuración local.
  }

  const config = window.SupabaseService
    ? SupabaseService.getConfig()
    : { url: "", anonKey: "", table: "chutemundo_app_states", recordKey: "main", bucket: "chutemundo-assets" };

  if (byId("sbUrl")) byId("sbUrl").value = config.url || "";
  if (byId("sbAnonKey")) byId("sbAnonKey").value = config.anonKey || "";
  if (byId("sbTable")) byId("sbTable").value = config.table || "chutemundo_app_states";
  if (byId("sbRecordKey")) byId("sbRecordKey").value = config.recordKey || "main";
  if (byId("sbBucket")) byId("sbBucket").value = config.bucket || "chutemundo-assets";

  updateSupabaseUI();
  if (window.ChuteStorage) ChuteStorage.updateStorageBadge();
}

function updateSupabaseUI() {
  const statusText = byId("supabaseStatusText");
  const syncStatus = byId("supabaseSyncStatus");
  const setupForm = byId("supabaseSetupForm");
  const connectedPanel = byId("supabaseConnectedPanel");
  const lastError = byId("supabaseLastError");

  if (!statusText || !syncStatus) return;

  const enabled = window.SupabaseService && SupabaseService.isEnabled();
  const hasLibrary = window.SupabaseService && SupabaseService.hasLibrary();

  if (enabled) {
    statusText.textContent = "Conectado";
    statusText.style.color = "#2ecc71";
    syncStatus.textContent = "Disponible";
    syncStatus.style.color = "#2ecc71";
    if (setupForm) setupForm.style.display = "none";
    if (connectedPanel) connectedPanel.style.display = "block";
  } else {
    statusText.textContent = hasLibrary ? "No configurado" : "Librería no disponible";
    statusText.style.color = "#e74c3c";
    syncStatus.textContent = "Manual / local";
    syncStatus.style.color = "#f59e0b";
    if (setupForm) setupForm.style.display = "block";
    if (connectedPanel) connectedPanel.style.display = "none";
  }

  if (lastError && window.SupabaseService) {
    const error = SupabaseService.getLastError();
    lastError.textContent = error ? `Último error: ${error}` : "Sin errores recientes.";
  }
}

function readSupabaseFormConfig() {
  return {
    url: byId("sbUrl")?.value.trim() || "",
    anonKey: byId("sbAnonKey")?.value.trim() || "",
    table: byId("sbTable")?.value.trim() || "chutemundo_app_states",
    recordKey: byId("sbRecordKey")?.value.trim() || "main",
    bucket: byId("sbBucket")?.value.trim() || "chutemundo-assets"
  };
}

function connectSupabase() {
  if (!window.SupabaseService) {
    alert("SupabaseService no está disponible.");
    return;
  }

  const config = readSupabaseFormConfig();

  if (!config.url || !config.anonKey) {
    alert("Completa la URL y la anon key de Supabase.");
    return;
  }

  SupabaseService.saveConfig(config);
  const success = SupabaseService.init();

  updateSupabaseUI();

  if (success) {
    alert("Supabase conectado. Usa 'Subir respaldo actual' para guardar el historial en la nube.");
  } else {
    alert("No se pudo conectar Supabase: " + (SupabaseService.getLastError() || "revisa la configuración."));
  }
}

function disconnectSupabase() {
  if (!confirm("¿Desconectar Supabase? Los datos locales seguirán disponibles.")) return;

  if (window.SupabaseService) {
    SupabaseService.disconnect();
  }
  updateSupabaseUI();
}

async function syncSupabaseNow() {
  if (!window.SupabaseService || !SupabaseService.isEnabled()) {
    alert("Conecta Supabase primero.");
    return;
  }

  const result = await SupabaseService.saveState(state);
  updateSupabaseUI();

  if (result.ok) {
    alert("Respaldo subido a Supabase correctamente.");
  } else {
    alert("No se pudo subir a Supabase: " + result.error);
  }
}

async function loadSupabaseBackup() {
  if (!window.SupabaseService || !SupabaseService.isEnabled()) {
    alert("Conecta Supabase primero.");
    return;
  }

  if (!confirm("Esto reemplazará los datos locales por el respaldo guardado en Supabase. ¿Continuar?")) return;

  const result = await SupabaseService.loadState();

  if (!result.ok) {
    updateSupabaseUI();
    alert("No se pudo cargar desde Supabase: " + result.error);
    return;
  }

  normalizeState(result.state);
  state = result.state;
  saveState();
  refreshComputedData();
  renderAll();
  alert("Respaldo cargado desde Supabase correctamente.");
}

function bindEvents() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    if (!btn.dataset.target) return;
    btn.addEventListener("click", () => switchSection(btn.dataset.target));
  });

  if (exists("darkModeBtn")) {
    byId("darkModeBtn").addEventListener("click", () => {
      const enabled = localStorage.getItem(DARK_MODE_KEY) === "1";
      setDarkMode(!enabled);
    });
  }

  if (exists("tType")) {
    byId("tType").addEventListener("change", renderTournamentFormatUI);
  }

  if (exists("tournamentOrder")) {
    byId("tournamentOrder").addEventListener("change", renderTournamentList);
  }

  if (exists("createNextTournamentBtn")) {
    byId("createNextTournamentBtn").addEventListener("click", createNextTournament);
  }

  if (exists("showH2HBtn")) {
    byId("showH2HBtn").addEventListener("click", showH2H);
  }

  if (exists("showMoreWinsBtn")) {
    let showingAll = false;
    byId("showMoreWinsBtn").addEventListener("click", () => {
      showingAll = !showingAll;
      renderBiggestWins(showingAll);
    });
  }

  if (exists("addRuleBtn")) {
    byId("addRuleBtn").addEventListener("click", addRule);
  }

  if (exists("saveRulesConfigBtn")) {
    byId("saveRulesConfigBtn").addEventListener("click", saveRulesConfig);
  }

  if (exists("addTeamBtn")) {
    byId("addTeamBtn").addEventListener("click", () => {
      const name = byId("newTeamName")?.value.trim();
      const coach = byId("newTeamCoach")?.value.trim();

      if (!name) {
        alert("Ingresa el nombre del equipo.");
        return;
      }

      if (state.teams.some(t => t.name.toLowerCase() === name.toLowerCase())) {
        alert("Ese equipo ya existe.");
        return;
      }

      state.teams.push({
        id: uid("team"),
        name,
        coach,
        players: []
      });

      saveState();
      refreshComputedData();
      renderAll();

      byId("newTeamName").value = "";
      byId("newTeamCoach").value = "";
    });
  }

  if (exists("checkAllTeams")) {
    byId("checkAllTeams").addEventListener("change", e => {
      document.querySelectorAll("#teamPicker .team-check").forEach(ch => {
        ch.checked = e.target.checked;
      });
      renderTournamentFormatUI();
    });
  }

  if (exists("createTournamentBtn")) {
    byId("createTournamentBtn").addEventListener("click", createTournament);
  }

  if (exists("createdivision")) {
    byId("createdivision").addEventListener("click", createdivision);
  }

  if (exists("createFriendlyBtn")) {
    byId("createFriendlyBtn").addEventListener("click", createFriendly);
  }

  if (exists("goalsScopeFilter")) {
    byId("goalsScopeFilter").addEventListener("change", renderGlobalPlayers);
  }

  if (exists("goalsTournamentFilter")) {
    byId("goalsTournamentFilter").addEventListener("change", renderGlobalPlayers);
  }

  if (exists("assistsScopeFilter")) {
    byId("assistsScopeFilter").addEventListener("change", renderGlobalPlayers);
  }

  if (exists("assistsTournamentFilter")) {
    byId("assistsTournamentFilter").addEventListener("change", renderGlobalPlayers);
  }

  if (exists("globalTableFilter")) {
    byId("globalTableFilter").addEventListener("change", renderGlobalTable);
  }

  if (exists("performanceFilter")) {
    byId("performanceFilter").addEventListener("change", renderPerformanceRanking);
  }

  if (exists("fifaRankingFilter")) {
    byId("fifaRankingFilter").addEventListener("change", renderFifaRanking);
  }

  if (exists("eraFilter")) {
    byId("eraFilter").addEventListener("change", () => {
      renderTournamentFilters();
      renderGlobalTable();
      renderPalmares();
      renderPerformanceRanking();
      renderFifaRanking();
      renderBiggestWins();
      renderGlobalPlayers();
      renderDisciplineTable();
    });
  }

  if (exists("addParticipantBtn")) {
    byId("addParticipantBtn").addEventListener("click", () => showAddParticipantModal());
  }

  if (exists("createDivisionsBtn")) {
    byId("createDivisionsBtn").addEventListener("click", createDivisionsAutomatic);
  }

  renderAdminParticipants();

  if (exists("exportBtn")) {
    byId("exportBtn").addEventListener("click", exportState);
  }

  if (exists("importBtn")) {
    byId("importBtn").addEventListener("click", importState);
  }

  if (exists("resetBtn")) {
    byId("resetBtn").addEventListener("click", () => {
      const ok = confirm("Esto restaurara el sistema base y eliminara cambios locales. Continuar?");
      if (ok) resetState();
    });
  }

  if (exists("hardResetBtn")) {
    byId("hardResetBtn").addEventListener("click", () => {
      const ok = confirm("Esto borrara el almacenamiento local y restaurara todo desde cero. Continuar?");
      if (ok) hardResetStorage();
    });
  }

  initSupabaseUI();

  if (exists("connectSupabaseBtn")) {
    byId("connectSupabaseBtn").addEventListener("click", connectSupabase);
  }

  if (exists("syncSupabaseBtn")) {
    byId("syncSupabaseBtn").addEventListener("click", syncSupabaseNow);
  }

  if (exists("loadSupabaseBtn")) {
    byId("loadSupabaseBtn").addEventListener("click", loadSupabaseBackup);
  }

  if (exists("disconnectSupabaseBtn")) {
    byId("disconnectSupabaseBtn").addEventListener("click", disconnectSupabase);
  }

  if (exists("importFile")) {
    byId("importFile").addEventListener("change", e => importStateFromFile(e.target.files?.[0]));
  }
}

window.openTournament = openTournament;
window.toggleMatchEditor = toggleMatchEditor;
window.updateMatchValue = updateMatchValue;
window.updateMatchTextField = updateMatchTextField;
window.appendGoalLine = appendGoalLine;
window.appendCardLine = appendCardLine;
window.switchActionTab = switchActionTab;

window.openFriendly = openFriendly;
window.updateFriendlyValue = updateFriendlyValue;
window.updateFriendlyTextField = updateFriendlyTextField;
window.appendFriendlyGoalLine = appendFriendlyGoalLine;

window.toggleRule = toggleRule;
window.deleteRule = deleteRule;
window.openTeam = openTeam;
window.openClassicHistory = openClassicHistory;
window.confirmDeleteTournament = confirmDeleteTournament;
window.confirmDeleteTeam = confirmDeleteTeam;
window.deleteTeam = deleteTeam;
window.showAddPlayerModal = showAddPlayerModal;
window.addPlayer = addPlayer;
window.confirmDeletePlayer = confirmDeletePlayer;
window.handleTeamImageUpload = handleTeamImageUpload;
window.removeTeamImage = removeTeamImage;
window.getTeamInitials = getTeamInitials;
window.editTournament = editTournament;
window.finishTournament = finishTournament;
window.editParticipant = editParticipant;
window.deleteParticipant = deleteParticipant;
window.closeModal = closeModal;
window.createNextTournament = createNextTournament;

bindEvents();
renderAll();

if (window.ChuteStorage) {
  ChuteStorage.updateStorageBadge();
}






