import fs from 'node:fs';

const history = JSON.parse(fs.readFileSync('public/official-history.json', 'utf8'));
const tournament8 = JSON.parse(fs.readFileSync('public/tournament-8.json', 'utf8'));
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };

const teams = Array.isArray(history.teams) ? history.teams : [];
const tournaments = Array.isArray(history.tournaments) ? [...history.tournaments] : [];
const existing = tournaments.findIndex((tournament) => tournament.id === tournament8.id);
if (existing >= 0) tournaments[existing] = tournament8;
else tournaments.push(tournament8);

check(teams.length > 0, 'El fallback no contiene equipos.');
check(tournaments.length > 0, 'El fallback no contiene torneos.');

const teamIds = new Set();
for (const team of teams) {
  check(Boolean(team?.id), 'Existe un equipo sin ID.');
  if (!team?.id) continue;
  check(!teamIds.has(team.id), `ID de equipo duplicado: ${team.id}`);
  teamIds.add(team.id);
  const names = new Set();
  for (const player of team.players || []) {
    const name = Array.isArray(player) ? player[0] : player?.name;
    if (!name) continue;
    const key = String(name).trim().toLocaleLowerCase('es');
    check(!names.has(key), `Jugador duplicado dentro de ${team.name || team.id}: ${name}`);
    names.add(key);
  }
}

const tournamentIds = new Set();
let matchCount = 0;
for (const tournament of tournaments) {
  check(Boolean(tournament?.id), 'Existe un torneo sin ID.');
  if (!tournament?.id) continue;
  check(!tournamentIds.has(tournament.id), `ID de torneo duplicado: ${tournament.id}`);
  tournamentIds.add(tournament.id);

  for (const field of ['champion','runnerUp','third']) {
    const value = tournament[field];
    if (value) check(teamIds.has(value), `${tournament.id} referencia ${field} desconocido: ${value}`);
  }

  const matchIds = new Set();
  for (const match of tournament.matches || []) {
    matchCount += 1;
    check(Boolean(match?.id), `Partido sin ID en ${tournament.id}`);
    if (match?.id) {
      check(!matchIds.has(match.id), `ID de partido duplicado en ${tournament.id}: ${match.id}`);
      matchIds.add(match.id);
    }
    if (match?.home) check(teamIds.has(match.home), `Local desconocido en ${tournament.id}/${match.id}: ${match.home}`);
    if (match?.away) check(teamIds.has(match.away), `Visita desconocida en ${tournament.id}/${match.id}: ${match.away}`);
    if (match?.home && match?.away) check(match.home !== match.away, `Partido con el mismo equipo a ambos lados: ${tournament.id}/${match.id}`);
    const played = match?.homeGoals !== null && match?.homeGoals !== undefined && match?.homeGoals !== '' &&
      match?.awayGoals !== null && match?.awayGoals !== undefined && match?.awayGoals !== '';
    if (played) {
      check(Number.isFinite(Number(match.homeGoals)), `Marcador local inválido: ${tournament.id}/${match.id}`);
      check(Number.isFinite(Number(match.awayGoals)), `Marcador visita inválido: ${tournament.id}/${match.id}`);
    }
  }
}

check(matchCount > 0, 'El fallback no contiene partidos.');

if (errors.length) {
  console.error('Integridad de datos fallback: FALLÓ');
  for (const error of errors) console.error(' - ' + error);
  process.exit(1);
}

console.log('Integridad de datos fallback: OK', {
  teams: teams.length,
  tournaments: tournaments.length,
  matches: matchCount
});
