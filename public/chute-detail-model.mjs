const ASSET_BASE = 'https://raw.githubusercontent.com/cauretaf-jpg/TorneosChute/main/public';
const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const slugify = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const playerSlug = (name) => name === "Randolph D'Luna" ? 'randolph-dluna' : slugify(name);
const playerName = (player) => Array.isArray(player) ? player[0] : player?.name || '';
const playerPosition = (player) => Array.isArray(player) ? player[1] : player?.position || '';
const logoUrl = (teamId) => `${ASSET_BASE}/team-logos/${teamId}.png`;
const photoUrl = (teamId, name) => `${ASSET_BASE}/player-photos/${teamId}/${playerSlug(name)}.png`;
const uid = (prefix = 'event') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function parseGoalLog(text, side, teamId) {
  if (!text?.trim()) return [];
  return text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [scorer = '', assist = '', minute = ''] = line.split('|').map((part) => part.trim());
    return {
      id: uid('goal'), side, teamId,
      playerName: scorer,
      assistName: assist && assist.toLowerCase() !== 'sin asistencia' ? assist : '',
      minute: String(minute || '').replace(/[^0-9+]/g, ''),
      legacy: true
    };
  });
}

function parseCardLog(text, side, teamId) {
  if (!text?.trim()) return [];
  return text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const red = /roja|🟥/i.test(line);
    const minute = line.match(/(\d+)\s*['’]?/)?.[1] || '';
    const name = line
      .replace(/[🟥🟨]/g, '')
      .replace(/\d+\s*['’]?/, '')
      .replace(/\((Roja|Amarilla)\)/i, '')
      .trim() || 'Sin identificar';
    return { id: uid('card'), side, teamId, playerName: name, role: 'player', type: red ? 'red' : 'yellow', minute, legacy: true };
  });
}

function normalizeCard(card, match) {
  const side = card.side || (card.teamId === match.away ? 'away' : 'home');
  return {
    id: card.id || uid('card'),
    side,
    teamId: card.teamId || (side === 'away' ? match.away : match.home),
    playerName: card.playerName || card.name || 'Sin identificar',
    role: card.role || 'player',
    type: card.type === 'R' || card.type === 'red' ? 'red' : 'yellow',
    minute: String(card.minute || ''),
    note: card.note || ''
  };
}

function ensureMatchEvents(match, homeId, awayId) {
  match.home = match.home || homeId || null;
  match.away = match.away || awayId || null;
  if (!Array.isArray(match.goals) || !match.goals.length) {
    match.goals = [
      ...parseGoalLog(match.homeGoalLog, 'home', match.home),
      ...parseGoalLog(match.awayGoalLog, 'away', match.away)
    ];
  } else {
    match.goals = match.goals.map((goal) => ({
      id: goal.id || uid('goal'),
      side: goal.side || (goal.teamId === match.away ? 'away' : 'home'),
      teamId: goal.teamId || (goal.side === 'away' ? match.away : match.home),
      playerName: goal.playerName || goal.scorer || '',
      assistName: goal.assistName || goal.assist || '',
      minute: String(goal.minute || ''),
      note: goal.note || ''
    }));
  }
  const parsedCards = [
    ...parseCardLog(match.homeCardLog, 'home', match.home),
    ...parseCardLog(match.awayCardLog, 'away', match.away)
  ];
  match.cards = Array.isArray(match.cards) && match.cards.length
    ? match.cards.map((card) => normalizeCard(card, match))
    : parsedCards;
  match.notes = match.notes || '';
  return match;
}

function syncLegacyLogs(match) {
  const goalLine = (goal) => `${goal.playerName} | ${goal.assistName || 'Sin asistencia'} | ${goal.minute ? `${goal.minute}'` : '-'}`;
  const cardLine = (card) => `${card.type === 'red' ? '🟥' : '🟨'} ${card.minute ? `${card.minute}' ` : ''}${card.playerName} (${card.type === 'red' ? 'Roja' : 'Amarilla'})`;
  match.homeGoalLog = (match.goals || []).filter((goal) => goal.side === 'home').map(goalLine).join('\n');
  match.awayGoalLog = (match.goals || []).filter((goal) => goal.side === 'away').map(goalLine).join('\n');
  match.homeCardLog = (match.cards || []).filter((card) => card.side === 'home').map(cardLine).join('\n');
  match.awayCardLog = (match.cards || []).filter((card) => card.side === 'away').map(cardLine).join('\n');
}

function migrateState(core) {
  const state = core.getState();
  let changed = false;
  const officialActive = state.tournaments?.find((tournament) => tournament.id === 't8');
  if (officialActive && officialActive.status !== 'active') {
    officialActive.status = 'active';
    changed = true;
  }
  if (officialActive) {
    for (const tournament of state.tournaments || []) {
      if (tournament.id !== 't8' && tournament.status === 'active' && tournament.champion) {
        tournament.status = 'historical';
        changed = true;
      }
    }
  }
  for (const team of state.teams || []) {
    const nextImage = team.imageUrl || logoUrl(team.id);
    if (team.imageUrl !== nextImage) { team.imageUrl = nextImage; changed = true; }
  }
  for (const tournament of state.tournaments || []) {
    for (const match of tournament.matches || []) {
      const beforeGoals = Array.isArray(match.goals) ? match.goals.length : -1;
      const beforeCards = Array.isArray(match.cards) ? match.cards.length : -1;
      ensureMatchEvents(match, core.resolveHome(tournament, match), core.resolveAway(tournament, match));
      if (beforeGoals !== match.goals.length || beforeCards !== match.cards.length) changed = true;
    }
  }
  for (const match of state.friendlies || []) ensureMatchEvents(match, match.home, match.away);
  if (changed) {
    core.persistLocal();
    if (core.isAdmin() && core.cloudLoaded) core.queueSave();
  }
  return state;
}

function allMatches(core, tournaments = null) {
  const state = core.getState();
  const list = tournaments || state.tournaments || [];
  return list.flatMap((tournament) => (tournament.matches || []).map((match) => ({ tournament, match, home: core.resolveHome(tournament, match), away: core.resolveAway(tournament, match) })));
}

function playerStatistics(core, tournaments = null) {
  const map = new Map();
  const ensure = (teamId, name, role = 'player') => {
    const key = `${teamId}__${name}`;
    if (!map.has(key)) map.set(key, { key, teamId, name, role, goals: 0, assists: 0, yellows: 0, reds: 0, appearances: 0 });
    if (role === 'coach') map.get(key).role = 'coach';
    return map.get(key);
  };
  const state = core.getState();
  for (const team of state.teams || []) {
    for (const player of team.players || []) ensure(team.id, playerName(player));
  }
  const selected = tournaments || state.tournaments || [];
  for (const tournament of selected) {
    const structuredGoals = new Map();
    const structuredAssists = new Map();
    const appearanceByPlayer = new Map();
    const eventKey = (teamId, name) => `${teamId}__${name}`;
    for (const match of tournament.matches || []) {
      const home = core.resolveHome(tournament, match);
      const away = core.resolveAway(tournament, match);
      ensureMatchEvents(match, home, away);
      for (const goal of match.goals || []) {
        const teamId = goal.teamId || (goal.side === 'away' ? away : home);
        if (goal.playerName) {
          ensure(teamId, goal.playerName).goals += 1;
          const key = eventKey(teamId, goal.playerName);
          structuredGoals.set(key, (structuredGoals.get(key) || 0) + 1);
        }
        if (goal.assistName) {
          ensure(teamId, goal.assistName).assists += 1;
          const key = eventKey(teamId, goal.assistName);
          structuredAssists.set(key, (structuredAssists.get(key) || 0) + 1);
        }
      }
      for (const card of match.cards || []) {
        const teamId = card.teamId || (card.side === 'away' ? away : home);
        const row = ensure(teamId, card.playerName, card.role || 'player');
        if (card.type === 'red') row.reds += 1; else row.yellows += 1;
      }
    }
    for (const row of tournament.playerScorers || []) {
      const [name, teamId, appearances, value] = row;
      const key = eventKey(teamId, name);
      const target = ensure(teamId, name);
      target.goals += Math.max(0, Number(value || 0) - Number(structuredGoals.get(key) || 0));
      appearanceByPlayer.set(key, Math.max(appearanceByPlayer.get(key) || 0, Number(appearances || 0)));
    }
    for (const row of tournament.playerAssists || []) {
      const [name, teamId, appearances, value] = row;
      const key = eventKey(teamId, name);
      const target = ensure(teamId, name);
      target.assists += Math.max(0, Number(value || 0) - Number(structuredAssists.get(key) || 0));
      appearanceByPlayer.set(key, Math.max(appearanceByPlayer.get(key) || 0, Number(appearances || 0)));
    }
    for (const [key, appearances] of appearanceByPlayer) {
      const target = map.get(key);
      if (target) target.appearances += appearances;
    }
  }
  return [...map.values()].map((row) => ({ ...row, contributions: row.goals + row.assists })).sort((a, b) => b.contributions - a.contributions || b.goals - a.goals || a.name.localeCompare(b.name, 'es'));
}

function disciplineRows(core) {
  const config = core.getState().config?.discipline || {};
  return playerStatistics(core).filter((row) => row.yellows || row.reds).map((row) => {
    const suspended = row.reds > 0 || row.yellows >= Number(config.yellowAccumulationSuspension || 3);
    const reason = row.reds > 0 ? 'Expulsión directa' : suspended ? 'Acumulación de amarillas' : '';
    return { ...row, suspended, reason };
  }).sort((a, b) => Number(b.suspended) - Number(a.suspended) || b.reds - a.reds || b.yellows - a.yellows);
}

function photo(teamId, name, className = 'player-photo') {
  return `<img class="${className}" src="${esc(photoUrl(teamId, name))}" alt="${esc(name)}" loading="lazy" onerror="this.classList.add('photo-fallback')">`;
}
function logo(teamId, className = 'club-logo') {
  return `<img class="${className}" src="${esc(logoUrl(teamId))}" alt="${esc(teamId)}" loading="lazy" onerror="this.classList.add('logo-fallback')">`;
}

window.ChuteDetailModel = {
  ASSET_BASE, esc, slugify, playerName, playerPosition, logoUrl, photoUrl, photo, logo,
  uid, ensureMatchEvents, syncLegacyLogs, migrateState, allMatches, playerStatistics, disciplineRows
};
