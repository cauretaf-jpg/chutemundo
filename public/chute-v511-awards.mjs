const I = window.ChuteV511Internal;
if (!I) throw new Error('El núcleo v5.11 no está disponible.');
const { core, esc, norm, playerName, playerKey, matchesOf } = I;

function tournamentPlayerRows(tournament) {
  const map = new Map();
  const ensure = (teamId, name) => {
    const key = `${teamId}__${name}`;
    if (!map.has(key)) map.set(key, { key, teamId, name, goals: 0, assists: 0, cards: 0, finalGoals: 0 });
    return map.get(key);
  };
  for (const match of matchesOf(tournament)) {
    const home = match.home || core.resolveHome(tournament, match);
    const away = match.away || core.resolveAway(tournament, match);
    for (const goal of match.goals || []) {
      const teamId = goal.teamId || (goal.side === 'away' ? away : home);
      if (goal.playerName) {
        const row = ensure(teamId, goal.playerName);
        row.goals += 1;
        if (norm(match.round) === 'final') row.finalGoals += 1;
      }
      if (goal.assistName) ensure(teamId, goal.assistName).assists += 1;
    }
    for (const card of match.cards || []) {
      if (card.playerName) ensure(card.teamId || (card.side === 'away' ? away : home), card.playerName).cards += 1;
    }
  }
  for (const row of tournament.playerScorers || []) ensure(row[1], row[0]).goals = Math.max(ensure(row[1], row[0]).goals, Number(row[3] || 0));
  for (const row of tournament.playerAssists || []) ensure(row[1], row[0]).assists = Math.max(ensure(row[1], row[0]).assists, Number(row[3] || 0));
  return [...map.values()].map((row) => ({ ...row, contributions: row.goals + row.assists }))
    .sort((a, b) => b.contributions - a.contributions || b.goals - a.goals || a.name.localeCompare(b.name, 'es'));
}

function suggestedAwards(tournament) {
  const rows = tournamentPlayerRows(tournament);
  const scorer = [...rows].sort((a, b) => b.goals - a.goals || b.assists - a.assists)[0];
  const assister = [...rows].sort((a, b) => b.assists - a.assists || b.goals - a.goals)[0];
  const finalPlayer = [...rows].sort((a, b) => b.finalGoals - a.finalGoals || b.contributions - a.contributions)[0];
  return { mvp: rows[0] || null, scorer: scorer?.goals ? scorer : null, assister: assister?.assists ? assister : null, final_player: finalPlayer?.finalGoals ? finalPlayer : rows[0] || null };
}

const AWARD_CATEGORIES = [
  ['mvp', 'Mejor jugador'], ['scorer', 'Goleador'], ['assister', 'Máximo asistidor'],
  ['goalkeeper', 'Mejor arquero'], ['revelation', 'Revelación'], ['best_goal', 'Mejor gol'], ['final_player', 'Jugador de la final']
];

function playerOptionsForTournament(tournament, selected = '') {
  const options = [];
  for (const teamId of tournament.teamIds || []) {
    const team = core.teamById(teamId);
    for (const player of team?.players || []) {
      const name = playerName(player);
      const value = playerKey(teamId, name);
      options.push(`<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(name)} · ${esc(team.name)}</option>`);
    }
  }
  return `<option value="">Sin asignar</option>${options.join('')}`;
}

function openAwards(tournamentId) {
  const tournament = core.tournamentById(tournamentId);
  if (!tournament) return;
  const suggestions = suggestedAwards(tournament);
  const fields = AWARD_CATEGORIES.map(([key, label]) => {
    const saved = tournament.awards?.[key];
    const suggested = saved?.teamId && saved?.playerName ? playerKey(saved.teamId, saved.playerName) : suggestions[key] ? playerKey(suggestions[key].teamId, suggestions[key].name) : '';
    return `<label>${esc(label)}<select data-cm-v511-award="${key}">${playerOptionsForTournament(tournament, suggested)}</select><input data-cm-v511-award-note="${key}" maxlength="120" placeholder="Nota opcional" value="${esc(saved?.note || '')}"></label>`;
  }).join('');
  core.openModal(`<div class="cm-v511-awards-modal" data-tournament-id="${esc(tournamentId)}"><p class="eyebrow">PREMIOS Y RECONOCIMIENTOS</p><h2>${esc(tournament.name)}</h2><p>Las sugerencias usan goles, asistencias y rendimiento registrado. Puedes modificarlas manualmente.</p><form id="cmV511AwardsForm"><div class="cm-v511-awards-grid">${fields}</div><div class="modal-actions"><button type="button" class="secondary" data-close-modal>Cancelar</button><button type="submit" class="primary">Guardar premios</button></div></form></div>`);
}

function awardsSignature(tournament) {
  return JSON.stringify(AWARD_CATEGORIES.map(([key]) => [key, tournament.awards?.[key]?.teamId || '', tournament.awards?.[key]?.playerName || '', tournament.awards?.[key]?.note || '']));
}

function awardsMarkup(tournament) {
  const rows = AWARD_CATEGORIES.map(([key, label]) => ({ key, label, ...tournament.awards?.[key] })).filter((row) => row.playerName);
  if (!rows.length) return '';
  return `<section class="cm-v511-awards" data-cm-v511-awards-signature="${esc(awardsSignature(tournament))}"><div class="cm-v511-section-head"><div><p class="eyebrow">RECONOCIMIENTOS</p><h3>Premios del torneo</h3></div></div><div class="cm-v511-awards-list">${rows.map((row) => `<button type="button" data-cm-v511-player="${esc(playerKey(row.teamId, row.playerName))}"><span>★</span><div><strong>${esc(row.label)}</strong><b>${esc(row.playerName)}</b><small>${esc(core.teamName(row.teamId))}${row.note ? ` · ${esc(row.note)}` : ''}</small></div></button>`).join('')}</div></section>`;
}

Object.assign(I, { tournamentPlayerRows, suggestedAwards, AWARD_CATEGORIES, openAwards, awardsSignature, awardsMarkup });
