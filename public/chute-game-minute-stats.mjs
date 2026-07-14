function waitForCore() {
  if (window.ChuteMundoCore) return Promise.resolve(window.ChuteMundoCore);
  return new Promise((resolve) => document.addEventListener('chute:ready', (event) => resolve(event.detail), { once: true }));
}

const core = await waitForCore();
const model = window.ChuteDetailModel;
if (!model) throw new Error('El modelo detallado no está disponible para los tramos de gol.');

const SEGMENTS = [
  { key: '0', label: "0'", range: '0–9', min: 0, max: 9 },
  { key: '10', label: "10'", range: '10–19', min: 10, max: 19 },
  { key: '20', label: "20'", range: '20–29', min: 20, max: 29 },
  { key: '30', label: "30'", range: '30–44', min: 30, max: 44 },
  { key: '45', label: "45'", range: '45–49', min: 45, max: 49 },
  { key: '50', label: "50'", range: '50–59', min: 50, max: 59 },
  { key: '60', label: "60'", range: '60–69', min: 60, max: 69 },
  { key: '70', label: "70'", range: '70–79', min: 70, max: 79 },
  { key: '80', label: "80'", range: '80–89', min: 80, max: 89 },
  { key: '90', label: "90'", range: '90–104', min: 90, max: 104 },
  { key: '105', label: "105'", range: '105–119', min: 105, max: 119 },
  { key: '120', label: "120'", range: '120+', min: 120, max: Number.POSITIVE_INFINITY },
  { key: 'penalties', label: 'Penales', range: 'definición', penalties: true }
];

let lastSignature = '';
let rendering = false;

function tournamentNumber(tournament) {
  const idNumber = Number(String(tournament.id || '').match(/t(\d+)/i)?.[1]);
  if (Number.isFinite(idNumber)) return idNumber;
  const nameNumber = Number(String(tournament.name || '').match(/(\d+)/)?.[1]);
  return Number.isFinite(nameNumber) ? nameNumber : 999;
}

function selectedTournaments() {
  const filters = window.ChuteStatsV52?.filters || { period: 'all', tournament: 'all' };
  return core.getState().tournaments.filter((tournament) => {
    const number = tournamentNumber(tournament);
    const periodMatches = filters.period === 'all' || (filters.period === 'classic' ? number <= 4 : number >= 5);
    const tournamentMatches = filters.tournament === 'all' || filters.tournament === tournament.id;
    return periodMatches && tournamentMatches;
  });
}

function parseMinute(value) {
  const match = String(value ?? '').match(/\d+/);
  if (!match) return null;
  const minute = Number.parseInt(match[0], 10);
  return Number.isFinite(minute) ? minute : null;
}

function calculateSegments(tournaments) {
  const rows = SEGMENTS.map((segment) => ({ ...segment, value: 0 }));
  let detailedGoals = 0;
  let shootoutGoals = 0;
  let playedMatches = 0;

  for (const tournament of tournaments) {
    for (const match of tournament.matches || []) {
      if (match.stage === 'bye' || !core.matchPlayed(match)) continue;
      playedMatches += 1;
      const home = core.resolveHome(tournament, match);
      const away = core.resolveAway(tournament, match);
      model.ensureMatchEvents(match, home, away);

      for (const goal of match.goals || []) {
        const minute = parseMinute(goal.minute);
        if (minute === null) continue;
        const segment = rows.find((item) => !item.penalties && minute >= item.min && minute <= item.max);
        if (!segment) continue;
        segment.value += 1;
        detailedGoals += 1;
      }

      const homePens = Number(match.homePens);
      const awayPens = Number(match.awayPens);
      if (Number.isFinite(homePens) && Number.isFinite(awayPens) && homePens >= 0 && awayPens >= 0) {
        shootoutGoals += homePens + awayPens;
      }
    }
  }

  const penalties = rows.find((item) => item.penalties);
  if (penalties) penalties.value = shootoutGoals;
  return { rows, detailedGoals, shootoutGoals, playedMatches };
}

function render() {
  if (rendering) return;
  const chart = document.querySelector('.cm-v52-minute-chart');
  if (!chart || !window.ChuteStatsV52) return;

  rendering = true;
  try {
    const tournaments = selectedTournaments();
    const result = calculateSegments(tournaments);
    const filters = window.ChuteStatsV52.filters;
    const signature = JSON.stringify({
      period: filters.period,
      tournament: filters.tournament,
      rows: result.rows.map((row) => [row.key, row.value]),
      tournaments: tournaments.map((tournament) => tournament.id)
    });
    if (signature === lastSignature && chart.classList.contains('cm-v53-minute-chart')) return;
    lastSignature = signature;

    const max = Math.max(1, ...result.rows.map((row) => row.value));
    chart.classList.add('cm-v53-minute-chart');
    chart.innerHTML = `
      <header>
        <div>
          <p class="eyebrow">DISTRIBUCIÓN DE GOLES</p>
          <h2>Goles por tramo de Chute</h2>
          <p>Se muestran todos los tramos oficiales, incluido tiempo extra y definición por penales.</p>
        </div>
        <span>${result.detailedGoals + result.shootoutGoals}</span>
      </header>
      <div class="cm-v53-minute-grid">
        ${result.rows.map((row) => `
          <div class="cm-v53-minute-row ${row.penalties ? 'is-penalties' : ''}" data-cm-minute-segment="${row.key}">
            <span class="cm-v53-minute-label"><strong>${row.label}</strong><small>${row.range}</small></span>
            <i aria-hidden="true"><b style="width:${Math.round((row.value / max) * 100)}%"></b></i>
            <strong>${row.value}</strong>
          </div>
        `).join('')}
      </div>
      <p class="cm-v53-minute-note"><strong>Criterio:</strong> 90 incluye 90–104; 105 incluye 105–119; 120 incluye 120 en adelante. Los penales corresponden a conversiones registradas en definiciones. Solo se distribuyen goles con minuto individual informado.</p>
    `;
  } finally {
    rendering = false;
  }
}

const observer = new MutationObserver(() => window.requestAnimationFrame(render));
observer.observe(document.body, { childList: true, subtree: true });
document.addEventListener('click', () => window.setTimeout(render, 0));
document.addEventListener('change', () => window.setTimeout(render, 0));
render();
window.setInterval(render, 900);

window.ChuteMinuteStatsV53 = { render, calculateSegments, segments: SEGMENTS };
