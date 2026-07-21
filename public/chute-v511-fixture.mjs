const I = window.ChuteV511Internal;
if (!I) throw new Error('El núcleo v5.11 no está disponible.');
const { core, clone, norm, played, matchesOf } = I;

function randomPermutation(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const random = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[random]] = [copy[random], copy[index]];
  }
  if (copy.length > 1 && copy.every((value, index) => value === values[index])) [copy[0], copy[1]] = [copy[1], copy[0]];
  return copy;
}

function randomizeTournamentState(sourceState, tournamentId) {
  const next = clone(sourceState);
  const tournament = next.tournaments.find((item) => item.id === tournamentId);
  if (!tournament) throw new Error('El torneo ya no existe.');
  if (tournament.status !== 'upcoming') throw new Error('Solo se puede regenerar el fixture antes de iniciar el torneo.');
  if (matchesOf(tournament).some(played)) throw new Error('El torneo ya tiene resultados registrados.');
  if ((tournament.teamIds || []).length < 2) throw new Error('El torneo necesita al menos dos equipos.');
  const original = [...tournament.teamIds];
  const shuffled = randomPermutation(original);
  const map = new Map(original.map((id, index) => [id, shuffled[index]]));
  tournament.teamIds = shuffled;
  tournament.groups = (tournament.groups || []).map((group) => ({ ...group, teamIds: (group.teamIds || []).map((id) => map.get(id) || id) }));
  tournament.matches = (tournament.matches || []).map((match) => ({
    ...match,
    home: match.home ? map.get(match.home) || match.home : match.home,
    away: match.away ? map.get(match.away) || match.away : match.away,
    date: '', time: '', venue: '', notes: '', registrationStartedAt: null, updatedAt: Date.now(),
    homeGoals: null, awayGoals: null, homePens: null, awayPens: null,
    goals: [], cards: [], homeGoalLog: '', awayGoalLog: '', homeCardLog: '', awayCardLog: ''
  }));
  tournament.fixtureGeneratedAt = Date.now();
  tournament.champion = null;
  tournament.runnerUp = null;
  tournament.third = null;
  return next;
}

function matchWinner(tournament, match) {
  if (!played(match)) return null;
  const home = match.home || core.resolveHome(tournament, match);
  const away = match.away || core.resolveAway(tournament, match);
  const hg = Number(match.homeGoals);
  const ag = Number(match.awayGoals);
  if (hg > ag) return home;
  if (ag > hg) return away;
  if (match.homePens !== null && match.awayPens !== null) return Number(match.homePens) > Number(match.awayPens) ? home : away;
  return null;
}

function standings(tournament, matchFilter = (match) => match.stage === 'regular') {
  const rows = new Map((tournament.teamIds || []).map((teamId) => [teamId, { teamId, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 }]));
  for (const match of matchesOf(tournament).filter(matchFilter)) {
    if (!played(match)) continue;
    const homeId = match.home || core.resolveHome(tournament, match);
    const awayId = match.away || core.resolveAway(tournament, match);
    const home = rows.get(homeId);
    const away = rows.get(awayId);
    if (!home || !away) continue;
    const hg = Number(match.homeGoals);
    const ag = Number(match.awayGoals);
    home.pj += 1;
    away.pj += 1;
    home.gf += hg;
    home.gc += ag;
    away.gf += ag;
    away.gc += hg;
    if (hg > ag) { home.pg += 1; away.pp += 1; home.pts += 3; }
    else if (ag > hg) { away.pg += 1; home.pp += 1; away.pts += 3; }
    else { home.pe += 1; away.pe += 1; home.pts += 1; away.pts += 1; }
  }
  return [...rows.values()].map((row) => ({ ...row, dg: row.gf - row.gc }))
    .sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || core.teamName(a.teamId).localeCompare(core.teamName(b.teamId), 'es'));
}

function calculatePodium(tournament) {
  const final = [...matchesOf(tournament)].reverse().find((match) => norm(match.round) === 'final' && played(match));
  if (final) {
    const winner = matchWinner(tournament, final);
    const home = final.home || core.resolveHome(tournament, final);
    const away = final.away || core.resolveAway(tournament, final);
    tournament.champion = winner;
    tournament.runnerUp = winner === home ? away : home;
  } else {
    const table = standings(tournament, (match) => ['regular', 'group'].includes(match.stage));
    tournament.champion ||= table[0]?.teamId || null;
    tournament.runnerUp ||= table[1]?.teamId || null;
    tournament.third ||= table[2]?.teamId || null;
  }
  const third = matchesOf(tournament).find((match) => (norm(match.round).includes('3er') || norm(match.round).includes('tercer')) && played(match));
  if (third) tournament.third = matchWinner(tournament, third);
}

Object.assign(I, { randomizeTournamentState, matchWinner, standings, calculatePodium });
