function waitForCore() {
  if (window.ChuteMundoCore) return Promise.resolve(window.ChuteMundoCore);
  return new Promise((resolve) => document.addEventListener('chute:ready', (event) => resolve(event.detail), { once: true }));
}

const core = await waitForCore();
let lastCleanSignature = '';
let pendingCloudSave = false;

function matchKey(match) {
  return [
    match.stage || '',
    match.group || '',
    match.round || '',
    match.home || match.homeRef || '',
    match.away || match.awayRef || ''
  ].join('::').toLowerCase();
}

function eventSignature(event) {
  return [event.teamId, event.playerName, event.assistName, event.type, event.minute].join('::');
}

function mergeEvents(primary = [], secondary = []) {
  const result = primary.map((event) => ({ ...event }));
  const signatures = new Set(result.map(eventSignature));
  for (const event of secondary) {
    const signature = eventSignature(event);
    if (!signatures.has(signature)) {
      result.push({ ...event });
      signatures.add(signature);
    }
  }
  return result;
}

function copyUsefulMatchData(target, source) {
  const sourcePlayed = core.matchPlayed(source);
  const targetPlayed = core.matchPlayed(target);
  if (sourcePlayed && !targetPlayed) {
    for (const field of ['homeGoals', 'awayGoals', 'homePens', 'awayPens', 'date', 'time', 'venue', 'notes']) {
      target[field] = source[field] ?? target[field];
    }
  }
  if (sourcePlayed && targetPlayed) {
    if (!target.date && source.date) target.date = source.date;
    if (!target.time && source.time) target.time = source.time;
    if (!target.venue && source.venue) target.venue = source.venue;
    if (!target.notes && source.notes) target.notes = source.notes;
  }
  target.goals = mergeEvents(target.goals || [], source.goals || []);
  target.cards = mergeEvents(target.cards || [], source.cards || []);
  target.specialEvents = mergeEvents(target.specialEvents || [], source.specialEvents || []);
  for (const field of ['homeGoalLog', 'awayGoalLog', 'homeCardLog', 'awayCardLog']) {
    if (!target[field] && source[field]) target[field] = source[field];
  }
}

function sanitizeOfficialTournament() {
  const current = core.getState();
  const official = current.tournaments.find((tournament) => tournament.id === 't8');
  if (!official) return false;

  const duplicateIndexes = current.tournaments
    .map((tournament, index) => ({ tournament, index }))
    .filter(({ tournament }) => tournament.id !== 't8' && tournament.name.trim().toLowerCase() === official.name.trim().toLowerCase() && tournament.type === official.type);

  const activeOthers = current.tournaments.filter((tournament) => tournament.id !== 't8' && tournament.status === 'active');
  const signature = JSON.stringify({ duplicates: duplicateIndexes.map(({ tournament }) => tournament.id), active: activeOthers.map((tournament) => tournament.id) });
  if (!duplicateIndexes.length && !activeOthers.length) {
    if (pendingCloudSave && core.isAdmin() && core.cloudLoaded) {
      pendingCloudSave = false;
      core.queueSave();
    }
    lastCleanSignature = signature;
    return false;
  }
  if (signature === lastCleanSignature && !pendingCloudSave) return false;

  const next = structuredClone(current);
  const officialNext = next.tournaments.find((tournament) => tournament.id === 't8');
  const duplicates = next.tournaments.filter((tournament) => tournament.id !== 't8' && tournament.name.trim().toLowerCase() === officialNext.name.trim().toLowerCase() && tournament.type === officialNext.type);
  const officialMatches = new Map((officialNext.matches || []).map((match) => [matchKey(match), match]));

  for (const duplicate of duplicates) {
    for (const match of duplicate.matches || []) {
      const target = officialMatches.get(matchKey(match));
      if (target) copyUsefulMatchData(target, match);
    }
    if (!officialNext.createdAt && duplicate.createdAt) officialNext.createdAt = duplicate.createdAt;
    if (!officialNext.participantLocal && duplicate.participantLocal) officialNext.participantLocal = duplicate.participantLocal;
    if (!officialNext.participantAway && duplicate.participantAway) officialNext.participantAway = duplicate.participantAway;
  }

  next.tournaments = next.tournaments.filter((tournament) => !duplicates.some((duplicate) => duplicate.id === tournament.id));
  for (const tournament of next.tournaments) {
    if (tournament.id === 't8') tournament.status = 'active';
    else if (tournament.status === 'active') tournament.status = 'historical';
  }
  next.activity = Array.isArray(next.activity) ? next.activity : [];
  if (!next.activity.some((item) => item.text === 'Se unificó el registro oficial del 8vo torneo.')) {
    next.activity.unshift({ id: `activity_t8_hygiene_${Date.now()}`, text: 'Se unificó el registro oficial del 8vo torneo.', at: Date.now() });
  }

  core.setState(next);
  pendingCloudSave = true;
  if (core.isAdmin() && core.cloudLoaded) {
    pendingCloudSave = false;
    core.queueSave();
  }
  lastCleanSignature = signature;
  return true;
}

sanitizeOfficialTournament();
const timer = window.setInterval(() => {
  sanitizeOfficialTournament();
  const official = core.getState().tournaments.find((tournament) => tournament.id === 't8');
  const duplicate = core.getState().tournaments.some((tournament) => tournament.id !== 't8' && tournament.name === official?.name && tournament.type === official?.type);
  if (!duplicate && !pendingCloudSave && core.cloudLoaded) window.clearInterval(timer);
}, 900);

window.ChuteDataHygiene = { sanitize: sanitizeOfficialTournament };
