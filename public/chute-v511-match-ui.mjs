const I = window.ChuteV511Internal;
if (!I) throw new Error('El núcleo v5.11 no está disponible.');
const { core, state, played, matchesOf, suspensionNames } = I;

function filteredMatchRows() {
  const tournamentFilter = document.getElementById('matchTournamentFilter')?.value || 'all';
  const status = document.getElementById('matchStatusFilter')?.value || 'all';
  return (state().tournaments || []).flatMap((tournament) => matchesOf(tournament).map((match) => ({ tournament, match })))
    .filter(({ tournament }) => tournamentFilter === 'all' || tournament.id === tournamentFilter)
    .filter(({ match }) => status === 'all' || (status === 'played' ? played(match) : !played(match)));
}

function enhanceMatchCards() {
  const rows = filteredMatchRows();
  const cards = [...document.querySelectorAll('#matchesList .match-card')];
  cards.forEach((card, index) => {
    const row = rows[index];
    if (!row) return;
    const home = row.match.home || core.resolveHome(row.tournament, row.match);
    const away = row.match.away || core.resolveAway(row.tournament, row.match);
    const main = card.querySelector('.match-main') || card;
    let share = main.querySelector('.cm-v511-share-result');
    if (played(row.match) && !share) {
      share = document.createElement('button');
      share.type = 'button';
      share.className = 'mini-button cm-v511-share-result';
      share.textContent = 'Compartir resultado';
      main.appendChild(share);
    }
    if (share) share.dataset.cmV511ShareResult = `${row.tournament.id}__${row.match.id}`;
    const suspended = suspensionNames(row.tournament, row.match);
    let notice = card.querySelector('.cm-v511-suspensions');
    if (suspended.length && !notice) {
      notice = document.createElement('div');
      notice.className = 'cm-v511-suspensions';
      card.appendChild(notice);
    }
    if (notice) {
      notice.textContent = suspended.length ? `⛔ Suspendidos: ${suspended.join(', ')}` : '';
      notice.hidden = suspended.length === 0;
    }
    const teamButtons = main.querySelectorAll('strong');
    if (teamButtons[0] && home) {
      teamButtons[0].dataset.cmV511Team = home;
      teamButtons[0].classList.add('cm-v511-link');
      teamButtons[0].tabIndex = 0;
    }
    if (teamButtons[1] && away) {
      teamButtons[1].dataset.cmV511Team = away;
      teamButtons[1].classList.add('cm-v511-link');
      teamButtons[1].tabIndex = 0;
    }
  });
}

Object.assign(I, { filteredMatchRows, enhanceMatchCards });
