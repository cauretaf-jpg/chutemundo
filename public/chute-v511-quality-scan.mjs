const I = window.ChuteV511Internal;
if (!I) throw new Error('El núcleo de Chute Mundo v5.11 no está disponible.');
const { core, esc, norm, state, played, playerName, matchesOf } = I;

function qualityIssues(sourceState = state()) {
  const issues = [];
  const teamIds = new Set((sourceState.teams || []).map((team) => team.id));
  const rosterMap = new Map((sourceState.teams || []).map((team) => [team.id, new Set((team.players || []).map((player) => norm(playerName(player))))]));
  for (const tournament of sourceState.tournaments || []) {
    const pending = matchesOf(tournament).filter((match) => !played(match));
    if (tournament.status === 'active' && !pending.length) issues.push({ severity: 'warning', title: 'Torneo activo sin partidos pendientes', detail: tournament.name, tournamentId: tournament.id });
    if (tournament.status === 'historical' && !tournament.champion) issues.push({ severity: 'error', title: 'Torneo finalizado sin campeón', detail: tournament.name, tournamentId: tournament.id });
    for (const teamId of tournament.teamIds || []) if (!teamIds.has(teamId)) issues.push({ severity: 'error', title: 'Equipo inexistente en torneo', detail: `${tournament.name}: ${teamId}`, tournamentId: tournament.id });
    for (const match of matchesOf(tournament)) {
      const home = match.home || core.resolveHome(tournament, match);
      const away = match.away || core.resolveAway(tournament, match);
      const target = { tournamentId: tournament.id, matchId: match.id };
      if ((match.homeGoals === null || match.homeGoals === '') !== (match.awayGoals === null || match.awayGoals === '')) issues.push({ severity: 'error', title: 'Marcador incompleto', detail: `${tournament.name} · ${match.label || match.round}`, ...target });
      if (played(match)) {
        if (!match.date) issues.push({ severity: 'warning', title: 'Partido finalizado sin fecha', detail: `${core.teamName(home)} vs. ${core.teamName(away)}`, ...target });
        if (!match.time) issues.push({ severity: 'info', title: 'Partido finalizado sin hora', detail: `${core.teamName(home)} vs. ${core.teamName(away)}`, ...target });
        if (!match.venue) issues.push({ severity: 'info', title: 'Partido finalizado sin sede', detail: `${core.teamName(home)} vs. ${core.teamName(away)}`, ...target });
        const detailedGoals = (match.goals || []).length;
        const scoreGoals = Number(match.homeGoals || 0) + Number(match.awayGoals || 0);
        if (detailedGoals && detailedGoals !== scoreGoals) issues.push({ severity: 'error', title: 'Marcador y goles detallados no coinciden', detail: `${tournament.name} · ${core.teamName(home)} ${match.homeGoals}-${match.awayGoals} ${core.teamName(away)}`, ...target });
        if (match.stage === 'knockout' && Number(match.homeGoals) === Number(match.awayGoals) && (match.homePens === null || match.awayPens === null || Number(match.homePens) === Number(match.awayPens))) issues.push({ severity: 'error', title: 'Empate de eliminación sin penales válidos', detail: `${tournament.name} · ${match.label || match.round}`, ...target });
      }
      const ids = new Set();
      for (const event of [...(match.goals || []), ...(match.cards || [])]) {
        if (event.id && ids.has(event.id)) issues.push({ severity: 'error', title: 'Evento duplicado', detail: `${tournament.name} · ${event.playerName || 'Evento sin jugador'}`, ...target });
        if (event.id) ids.add(event.id);
        const teamId = event.teamId || (event.side === 'away' ? away : home);
        if (teamId && event.playerName && rosterMap.has(teamId) && !rosterMap.get(teamId).has(norm(event.playerName))) issues.push({ severity: 'warning', title: 'Jugador no pertenece al plantel actual', detail: `${event.playerName} · ${core.teamName(teamId)}`, ...target });
        if (event.assistName && rosterMap.has(teamId) && !rosterMap.get(teamId).has(norm(event.assistName))) issues.push({ severity: 'warning', title: 'Asistente no pertenece al plantel actual', detail: `${event.assistName} · ${core.teamName(teamId)}`, ...target });
      }
    }
  }
  return issues;
}

function qualitySignature(issues = qualityIssues()) {
  return JSON.stringify(issues.map((issue) => [issue.severity, issue.title, issue.detail, issue.tournamentId, issue.matchId]));
}

function qualityMarkup(issues = qualityIssues()) {
  const signature = qualitySignature(issues);
  const counts = {
    error: issues.filter((item) => item.severity === 'error').length,
    warning: issues.filter((item) => item.severity === 'warning').length,
    info: issues.filter((item) => item.severity === 'info').length
  };
  return `<section id="cmV511Quality" class="cm-v511-admin-section" data-cm-v511-quality-signature="${esc(signature)}"><header><div><p class="eyebrow">CONTROL DE CALIDAD</p><h2>Integridad de los datos</h2><p>Detecta inconsistencias antes de que afecten estadísticas, premios o tarjetas.</p></div><div class="cm-v511-quality-counts"><span class="error">${counts.error} errores</span><span class="warning">${counts.warning} avisos</span><span>${counts.info} datos pendientes</span></div></header>${issues.length ? `<div class="cm-v511-quality-list">${issues.slice(0, 60).map((issue) => `<article class="${issue.severity}"><span></span><div><strong>${esc(issue.title)}</strong><small>${esc(issue.detail)}</small></div><button type="button" data-cm-v511-quality='${esc(JSON.stringify(issue))}'>Abrir</button></article>`).join('')}</div>` : '<div class="cm-v511-empty"><strong>Base consistente</strong><span>No se detectaron problemas en los controles disponibles.</span></div>'}</section>`;
}

Object.assign(I, { qualityIssues, qualitySignature, qualityMarkup });
