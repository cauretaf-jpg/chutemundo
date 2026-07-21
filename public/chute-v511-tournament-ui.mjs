const I = window.ChuteV511Internal;
if (!I) throw new Error('El núcleo v5.11 no está disponible.');
const { core, esc, state, played, matchesOf, awardsMarkup, awardsSignature } = I;

function suspensionNames(tournament, match) {
  if (!window.ChuteDisciplineV56 || tournament.type !== 'division_season') return [];
  try {
    const ledger = window.ChuteDisciplineV56.buildLedger();
    const home = match.home || core.resolveHome(tournament, match);
    const away = match.away || core.resolveAway(tournament, match);
    const names = [];
    for (const teamId of [home, away]) {
      const suspended = window.ChuteDisciplineV56.suspendedPlayers(ledger, tournament.id, match.id, teamId);
      for (const player of suspended.values()) names.push(`${player.name} (${core.teamName(teamId)})`);
    }
    return names;
  } catch { return []; }
}

function tournamentFlowSignature(tournament) {
  return JSON.stringify({
    id: tournament.id,
    status: tournament.status,
    pending: matchesOf(tournament).filter((match) => !played(match)).length,
    played: matchesOf(tournament).filter(played).length,
    admin: core.canEdit(),
    fixture: tournament.fixtureGeneratedAt || 0,
    awards: tournament.awards || null
  });
}

function tournamentFlowMarkup(tournament) {
  const pending = matchesOf(tournament).filter((match) => !played(match)).length;
  const hasPlayed = matchesOf(tournament).some(played);
  const admin = core.canEdit();
  const signature = tournamentFlowSignature(tournament);
  return `<section class="cm-v511-flow" data-cm-v511-flow="${esc(tournament.id)}" data-cm-v511-signature="${esc(signature)}"><div><p class="eyebrow">GESTIÓN DEL TORNEO</p><h3>${tournament.status === 'upcoming' ? 'Preparación' : tournament.status === 'active' ? 'Torneo en curso' : 'Torneo finalizado'}</h3><span>${pending} partido${pending === 1 ? '' : 's'} pendiente${pending === 1 ? '' : 's'}</span></div><div class="cm-v511-flow-actions">${tournament.status === 'upcoming' ? `<button type="button" data-cm-v511-random="${esc(tournament.id)}" ${admin && !hasPlayed ? '' : 'disabled'}>Generar fixture aleatorio</button><button type="button" class="primary" data-cm-v511-start="${esc(tournament.id)}" ${admin ? '' : 'disabled'}>Iniciar torneo</button>` : ''}${tournament.status === 'active' ? `<button type="button" class="primary" data-cm-v511-finish="${esc(tournament.id)}" ${admin ? '' : 'disabled'}>Finalizar torneo</button>` : ''}<button type="button" data-cm-v511-schedule="${esc(tournament.id)}">Tarjeta de programación</button><button type="button" data-cm-v511-awards="${esc(tournament.id)}">Premios</button></div></section>`;
}

function placeTournamentEnhancements(container, tournament, heading, panels) {
  if (!container || !tournament || !heading) return;
  let flow = container.querySelector(':scope > .cm-v511-flow');
  const flowSignature = tournamentFlowSignature(tournament);
  if (!flow) heading.insertAdjacentHTML('afterend', tournamentFlowMarkup(tournament));
  else if (flow.dataset.cmV511Signature !== flowSignature) flow.outerHTML = tournamentFlowMarkup(tournament);
  const awards = awardsMarkup(tournament);
  const awardSignature = awardsSignature(tournament);
  let awardsRoot = container.querySelector(':scope > .cm-v511-awards');
  if (awardsRoot && !awards) awardsRoot.remove();
  else if (awardsRoot && awardsRoot.dataset.cmV511AwardsSignature !== awardSignature) awardsRoot.outerHTML = awards;
  else if (!awardsRoot && awards) {
    if (panels) panels.insertAdjacentHTML('beforebegin', awards);
    else container.insertAdjacentHTML('beforeend', awards);
  }
}

function enhanceTournamentFlow() {
  const hub = document.getElementById('cmTournamentHub');
  if (hub) {
    const tournament = core.tournamentById(hub.dataset.tournamentId || '');
    placeTournamentEnhancements(hub, tournament, hub.querySelector('.cm-hub-heading'), hub.querySelector('.cm-hub-panels'));
  }
  const detail = document.getElementById('tournamentDetail');
  const openName = detail?.querySelector('.tournament-head h2')?.textContent?.trim();
  const tournament = (state().tournaments || []).find((item) => item.name === openName);
  const firstPanel = detail?.querySelector(':scope > .panel');
  if (detail && tournament && firstPanel) {
    let flow = detail.querySelector(':scope > .cm-v511-flow');
    const signature = tournamentFlowSignature(tournament);
    if (!flow) firstPanel.insertAdjacentHTML('afterend', tournamentFlowMarkup(tournament));
    else if (flow.dataset.cmV511Signature !== signature) flow.outerHTML = tournamentFlowMarkup(tournament);
    const awards = awardsMarkup(tournament);
    let awardsRoot = detail.querySelector(':scope > .cm-v511-awards');
    if (awardsRoot && !awards) awardsRoot.remove();
    else if (awardsRoot && awardsRoot.dataset.cmV511AwardsSignature !== awardsSignature(tournament)) awardsRoot.outerHTML = awards;
    else if (!awardsRoot && awards) detail.insertAdjacentHTML('beforeend', awards);
  }
}

Object.assign(I, { suspensionNames, tournamentFlowSignature, tournamentFlowMarkup, enhanceTournamentFlow });
