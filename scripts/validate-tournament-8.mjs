import fs from 'node:fs';

const tournament = JSON.parse(fs.readFileSync('public/tournament-8.json', 'utf8'));
const played = tournament.matches.filter((match) => match.homeGoals !== null && match.awayGoals !== null);
const goals = tournament.matches.reduce((sum, match) => sum + (match.goals?.length || 0), 0);
const assists = tournament.matches.reduce((sum, match) => sum + (match.goals || []).filter((goal) => goal.assistName).length, 0);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(tournament.id === 't8', 'El identificador debe ser t8.');
assert(tournament.name === '8vo Torneo - Copa', 'El nombre del torneo no coincide.');
assert(tournament.type === 'cup_groups', 'El formato debe ser copa con grupos.');
assert(tournament.status === 'active', 'El torneo debe quedar activo.');
assert(tournament.groups.length === 2, 'Deben existir dos grupos.');
assert(JSON.stringify(tournament.groups[0].teamIds) === JSON.stringify(['polpetta', 'parrilla', 'guanaco']), 'El Grupo A no coincide.');
assert(JSON.stringify(tournament.groups[1].teamIds) === JSON.stringify(['perla', 'pantera', 'trucha']), 'El Grupo B no coincide.');
assert(tournament.matches.length === 10, 'El fixture debe contener diez partidos.');
assert(played.length === 4, 'Deben existir cuatro partidos jugados.');
assert(goals === 12, 'Deben existir doce goles detallados.');
assert(assists === 6, 'Deben existir seis asistencias confirmadas.');
assert(tournament.matches.every((match) => Array.isArray(match.cards) && match.cards.length === 0), 'No deben existir tarjetas registradas.');

console.log('8vo torneo validado', { played: played.length, matches: tournament.matches.length, goals, assists });
