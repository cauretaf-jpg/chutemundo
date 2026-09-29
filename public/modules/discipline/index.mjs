function waitForCore() {
  if (window.ChuteMundoCore) return Promise.resolve(window.ChuteMundoCore);
  return new Promise((resolve) => document.addEventListener('chute:ready', (event) => resolve(event.detail), { once: true }));
}

const core = await waitForCore();
const model = window.ChuteDetailModel;
if (!model) throw new Error('El modelo detallado no está disponible para la disciplina de divisiones.');

const { esc, playerName, photo, logoUrl, syncLegacyLogs, uid } = model;
const TYPE = 'division_season';
const DEFAULT_RULES = Object.freeze({
  yellowLimit: 2,
  doubleYellowIsRed: true,
  suspensionMatches: 1,
  directRedSuspension: 1,
  carryBetweenSeasons: true
});

let lastHubSignature = '';
let lastEditorSignature = '';
let savingRules = false;

function state() { return core.getState(); }
function played(match) { return core.matchPlayed(match); }
function normalize(value = '') { return String(value).trim().replace(/\s+/g, ' ').toLocaleLowerCase('es'); }
function playerKey(teamId, name) { return `${teamId}::${normalize(name)}`; }
function matchKey(tournamentId, matchId) { return `${tournamentId}__${matchId}`; }
function teamPlayers(teamId) { return core.teamById(teamId)?.players || []; }
function rulesFor(tournament) { return { ...DEFAULT_RULES, ...(tournament?.config?.discipline || {}) }; }

function ensureRules() {
  let changed = false;
  for (const tournament of state().tournaments || []) {
    if (tournament.type !== TYPE) continue;
    tournament.config = tournament.config && typeof tournament.config === 'object' ? tournament.config : {};
    const current = tournament.config.discipline || {};
    const next = { ...DEFAULT_RULES, ...current };
    if (JSON.stringify(current) !== JSON.stringify(next)) {
      tournament.config.discipline = next;
      tournament.notes = Array.from(new Set([...(tournament.notes || []), 'Disciplina: dos amarillas generan una fecha de suspensión; dos amarillas en el mismo partido equivalen a expulsión.']));
      changed = true;
    }
  }
  if (!changed) return false;
  core.persistLocal();
  if (core.canEdit() && !savingRules) {
    savingRules = true;
    Promise.resolve(core.saveCloud()).catch((error) => console.error(error)).finally(() => { savingRules = false; });
  }
  return true;
}

function orderedDivisionTournaments() {
  return (state().tournaments || [])
    .map((tournament, index) => ({ tournament, index }))
    .filter(({ tournament }) => tournament.type === TYPE)
    .sort((a, b) => Number(a.tournament.config?.seasonNumber || a.index + 1) - Number(b.tournament.config?.seasonNumber || b.index + 1) || a.index - b.index)
    .map(({ tournament }) => tournament);
}

function getPlayerState(map, teamId, name) {
  const key = playerKey(teamId, name);
  if (!map.has(key)) {
    map.set(key, {
      key, teamId, name,
      yellowCarry: 0,
      totalYellows: 0,
      doubleYellows: 0,
      directReds: 0,
      reds: 0,
      suspensions: 0,
      suspensionsServed: 0,
      pending: 0,
      targets: [],
      tournamentStats: new Map()
    });
  }
  return map.get(key);
}

function tournamentStat(player, tournamentId) {
  if (!player.tournamentStats.has(tournamentId)) {
    player.tournamentStats.set(tournamentId, { yellows: 0, doubleYellows: 0, reds: 0, suspensions: 0 });
  }
  return player.tournamentStats.get(tournamentId);
}

function addSuspended(suspendedByMatch, key, teamId, player) {
  if (!suspendedByMatch.has(key)) suspendedByMatch.set(key, new Map());
  const byTeam = suspendedByMatch.get(key);
  if (!byTeam.has(teamId)) byTeam.set(teamId, new Map());
  byTeam.get(teamId).set(normalize(player.name), player);
}

function cardsByPlayer(match, side) {
  const grouped = new Map();
  for (const card of match.cards || []) {
    if (card.side !== side || card.role === 'coach') continue;
    const name = String(card.playerName || '').trim();
    if (!name) continue;
    const key = normalize(name);
    if (!grouped.has(key)) grouped.set(key, { name, cards: [] });
    grouped.get(key).cards.push(card);
  }
  return grouped;
}

function buildLedger() {
  const players = new Map();
  const suspendedByMatch = new Map();
  const sanctions = [];
  const tournaments = orderedDivisionTournaments();

  for (const tournament of tournaments) {
    const rules = rulesFor(tournament);
    for (const match of tournament.matches || []) {
      if (match.stage === 'bye') continue;
      const home = core.resolveHome(tournament, match);
      const away = core.resolveAway(tournament, match);
      if (!home || !away) continue;
      const key = matchKey(tournament.id, match.id);

      for (const teamId of [home, away]) {
        for (const player of players.values()) {
          if (player.teamId !== teamId || player.pending <= 0) continue;
          player.pending -= 1;
          player.targets.push({ tournamentId: tournament.id, matchId: match.id, teamId, served: played(match) });
          addSuspended(suspendedByMatch, key, teamId, player);
          if (played(match)) player.suspensionsServed += 1;
        }
      }

      if (!played(match)) continue;

      for (const [side, teamId] of [['home', home], ['away', away]]) {
        const groups = cardsByPlayer(match, side);
        for (const { name, cards } of groups.values()) {
          const player = getPlayerState(players, teamId, name);
          const stat = tournamentStat(player, tournament.id);
          const yellowCards = cards.filter((card) => card.type === 'yellow');
          const doubleCards = cards.filter((card) => card.reason === 'double_yellow' || card.secondYellow === true || card.type === 'second_yellow_red');
          const directReds = cards.filter((card) => card.type === 'red' && !doubleCards.includes(card));
          const inferredDouble = doubleCards.length > 0 || yellowCards.length >= 2;
          const yellowCount = yellowCards.length + doubleCards.length;

          player.totalYellows += yellowCount;
          stat.yellows += yellowCount;
          player.doubleYellows += inferredDouble ? 1 : 0;
          stat.doubleYellows += inferredDouble ? 1 : 0;
          player.directReds += directReds.length;
          player.reds += directReds.length + (inferredDouble ? 1 : 0);
          stat.reds += directReds.length + (inferredDouble ? 1 : 0);

          let suspension = false;
          let reason = '';
          if (inferredDouble && rules.doubleYellowIsRed) {
            player.yellowCarry = 0;
            suspension = true;
            reason = 'Doble amarilla';
          } else if (yellowCards.length === 1) {
            player.yellowCarry += 1;
            if (player.yellowCarry >= Number(rules.yellowLimit || 2)) {
              player.yellowCarry = 0;
              suspension = true;
              reason = 'Acumulación de amarillas';
            }
          }
          if (directReds.length) {
            suspension = true;
            reason = reason || 'Roja directa';
          }

          if (suspension) {
            const matches = Math.max(1, Number(directReds.length ? rules.directRedSuspension : rules.suspensionMatches) || 1);
            player.pending += matches;
            player.suspensions += matches;
            stat.suspensions += matches;
            sanctions.push({ tournamentId: tournament.id, matchId: match.id, teamId, playerName: name, reason, matches });
          }
        }
      }
    }
  }

  return { players, suspendedByMatch, sanctions, tournaments };
}

function suspendedPlayers(ledger, tournamentId, matchId, teamId) {
  return ledger.suspendedByMatch.get(matchKey(tournamentId, matchId))?.get(teamId) || new Map();
}

function statusFor(player) {
  const pendingTarget = player.targets.find((target) => !target.served);
  if (pendingTarget || player.pending > 0) return { key: 'suspended', label: player.pending > 0 ? 'Pendiente próxima fecha' : 'Suspendido' };
  if (player.yellowCarry > 0) return { key: 'risk', label: 'En riesgo' };
  return { key: 'available', label: 'Disponible' };
}

function divisionName(tournament, teamId) {
  return (tournament.groups || []).find((group) => (group.teamIds || []).includes(teamId))?.name || 'División';
}

function rowsForTournament(tournament, ledger = buildLedger()) {
  const teamIds = new Set(tournament.teamIds || []);
  const rows = [];
  for (const player of ledger.players.values()) {
    if (!teamIds.has(player.teamId)) continue;
    const stat = player.tournamentStats.get(tournament.id) || { yellows: 0, doubleYellows: 0, reds: 0, suspensions: 0 };
    const targetInTournament = player.targets.some((target) => target.tournamentId === tournament.id);
    const status = statusFor(player);
    if (!stat.yellows && !stat.reds && !stat.suspensions && !targetInTournament && status.key === 'available') continue;
    rows.push({ ...player, ...stat, status, division: divisionName(tournament, player.teamId) });
  }
  return rows.sort((a, b) => a.division.localeCompare(b.division, 'es') || ({ suspended: 0, risk: 1, available: 2 })[a.status.key] - ({ suspended: 0, risk: 1, available: 2 })[b.status.key] || b.yellows - a.yellows || a.name.localeCompare(b.name, 'es'));
}

function ruleCards(tournament) {
  const rules = rulesFor(tournament);
  return `<div class="cm-v56-rules">
    <article><b>🟨 + 🟨</b><span>Mismo partido</span><p>La segunda amarilla se convierte en expulsión y genera ${rules.suspensionMatches} fecha de suspensión.</p></article>
    <article><b>${rules.yellowLimit} amarillas</b><span>Partidos distintos</span><p>Al alcanzar el límite, el jugador se pierde el siguiente partido oficial.</p></article>
    <article><b>🟥 Roja directa</b><span>Sanción automática</span><p>Una fecha de suspensión por defecto.</p></article>
    <article><b>↪ Arrastre</b><span>Entre temporadas</span><p>Una sanción pendiente pasa a la siguiente temporada de divisiones.</p></article>
  </div>`;
}

function disciplineTable(tournament, rows) {
  if (!rows.length) return '<article class="cm-v56-empty"><h3>Sin sanciones ni amarillas acumuladas</h3><p>Los registros aparecerán automáticamente al agregar tarjetas en partidos de divisiones.</p></article>';
  const divisions = [...new Set(rows.map((row) => row.division))];
  return divisions.map((division) => {
    const divisionRows = rows.filter((row) => row.division === division);
    return `<section class="cm-v56-division-discipline"><header><div><p class="eyebrow">DISCIPLINA</p><h3>${esc(division)}</h3></div><span>${divisionRows.length} jugador${divisionRows.length === 1 ? '' : 'es'}</span></header><div class="cm-v56-table-wrap"><table><thead><tr><th>Jugador</th><th>Equipo</th><th>Amarillas</th><th>Doble amarilla</th><th>Rojas</th><th>Sanciones</th><th>Estado</th></tr></thead><tbody>${divisionRows.map((row) => `<tr><td><span class="cm-v56-player">${photo(row.teamId, row.name, 'cm-v56-face')}<strong>${esc(row.name)}</strong></span></td><td><span class="cm-v56-team"><img src="${esc(logoUrl(row.teamId))}" alt="">${esc(core.teamName(row.teamId))}</span></td><td><b>${row.yellows}</b>${row.yellowCarry ? '<small>1 acumulada</small>' : ''}</td><td>${row.doubleYellows}</td><td>${row.reds}</td><td>${row.suspensions}</td><td><span class="cm-v56-status ${row.status.key}">${esc(row.status.label)}</span></td></tr>`).join('')}</tbody></table></div></section>`;
  }).join('');
}

function disciplineMarkup(tournament) {
  const ledger = buildLedger();
  const rows = rowsForTournament(tournament, ledger);
  const totalYellows = rows.reduce((sum, row) => sum + row.yellows, 0);
  const suspended = rows.filter((row) => row.status.key === 'suspended').length;
  const risk = rows.filter((row) => row.status.key === 'risk').length;
  const reds = rows.reduce((sum, row) => sum + row.reds, 0);
  return `<section class="cm-v56-discipline">
    ${ruleCards(tournament)}
    <div class="cm-v56-kpis"><article><b>${totalYellows}</b><span>Amarillas</span></article><article><b>${reds}</b><span>Expulsiones</span></article><article><b>${risk}</b><span>En riesgo</span></article><article><b>${suspended}</b><span>Suspendidos</span></article></div>
    ${disciplineTable(tournament, rows)}
  </section>`;
}

function hubSignature(tournament) {
  return JSON.stringify({
    id: tournament.id,
    cards: (tournament.matches || []).map((match) => [match.id, match.homeGoals, match.awayGoals, (match.cards || []).map((card) => [card.id, card.playerName, card.type, card.reason, card.minute])]),
    rules: rulesFor(tournament)
  });
}

function enhanceHub() {
  const hub = document.getElementById('cmTournamentHub');
  if (!hub) return;
  const tournament = state().tournaments?.find((item) => item.id === hub.dataset.tournamentId);
  if (tournament?.type !== TYPE) return;
  const nav = hub.querySelector('.cm-hub-tabs');
  const panels = hub.querySelector('.cm-hub-panels');
  if (!nav || !panels) return;
  let button = nav.querySelector('[data-cm-v56-discipline-tab]');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.dataset.cmV56DisciplineTab = 'true';
    button.textContent = 'Disciplina';
    nav.appendChild(button);
  }
  let panel = panels.querySelector('[data-cm-v56-discipline-panel]');
  if (!panel) {
    panel = document.createElement('section');
    panel.className = 'cm-hub-panel';
    panel.dataset.cmV56DisciplinePanel = 'true';
    panels.appendChild(panel);
  }
  const signature = hubSignature(tournament);
  if (signature !== lastHubSignature || !panel.children.length) {
    lastHubSignature = signature;
    panel.innerHTML = disciplineMarkup(tournament);
  }
}

function decorateDoubleYellow(editor, context) {
  for (const side of ['home', 'away']) {
    const cards = (context.match.cards || []).filter((card) => card.side === side);
    const section = editor.querySelector(`.cm-match-side[data-side="${side}"]`);
    if (!section) continue;
    section.querySelectorAll('[data-cm-delete-card]').forEach((button) => {
      const card = cards.find((item) => item.id === button.dataset.cmDeleteCard);
      if (!card || !(card.reason === 'double_yellow' || card.secondYellow === true)) return;
      const record = button.closest('.cm-event-record');
      record?.classList.add('cm-v56-double-yellow');
      const strong = record?.querySelector('strong');
      if (strong) strong.innerHTML = `🟨🟨 → 🟥 ${esc(card.playerName)}`;
    });
  }
}

function editorContext(editor) {
  if (!editor) return null;
  const tournament = core.tournamentById(editor.dataset.tournament);
  const match = tournament?.matches.find((item) => item.id === editor.dataset.match);
  if (!tournament || !match) return null;
  return { tournament, match, home: core.resolveHome(tournament, match), away: core.resolveAway(tournament, match) };
}

function disableSuspendedOptions(editor, context, ledger) {
  for (const [side, teamId] of [['home', context.home], ['away', context.away]]) {
    if (!teamId) continue;
    const suspended = suspendedPlayers(ledger, context.tournament.id, context.match.id, teamId);
    const section = editor.querySelector(`.cm-match-side[data-side="${side}"]`);
    let notice = section?.querySelector('.cm-v56-suspension-notice');
    if (suspended.size && section && !notice) {
      notice = document.createElement('div');
      notice.className = 'cm-v56-suspension-notice';
      section.querySelector('.cm-match-side-head')?.insertAdjacentElement('afterend', notice);
    }
    if (notice) {
      notice.innerHTML = suspended.size ? `<strong>⛔ ${suspended.size} suspensión${suspended.size === 1 ? '' : 'es'}</strong><span>${[...suspended.values()].map((player) => esc(player.name)).join(', ')} no puede participar en este partido.</span>` : '';
      notice.hidden = suspended.size === 0;
    }
    for (const id of [`cmScorer-${side}`, `cmAssist-${side}`, `cmCardPlayer-${side}`]) {
      const select = document.getElementById(id);
      if (!select) continue;
      for (const option of select.options) {
        if (!option.value || option.value.startsWith('coach::')) continue;
        const blocked = suspended.has(normalize(option.value));
        option.disabled = blocked;
        if (blocked && option.dataset.cmV56Suspended !== 'true') {
          option.dataset.cmV56Suspended = 'true';
          option.textContent = `${option.textContent} · SUSPENDIDO`;
        }
      }
    }
  }
  decorateDoubleYellow(editor, context);
}

function enhanceEditor() {
  const editor = document.querySelector('.cm-match-editor');
  if (!editor) return;
  const context = editorContext(editor);
  if (!context || context.tournament.type !== TYPE) return;
  const signature = JSON.stringify({
    tournament: context.tournament.id,
    match: context.match.id,
    cards: (context.match.cards || []).map((card) => [card.id, card.playerName, card.type, card.reason]),
    played: played(context.match)
  });
  if (signature === lastEditorSignature && editor.dataset.cmV56Enhanced === 'true') return;
  lastEditorSignature = signature;
  editor.dataset.cmV56Enhanced = 'true';
  disableSuspendedOptions(editor, context, buildLedger());
}

function isSuspendedSelection(context, side, name) {
  if (!name || name.startsWith('coach::')) return false;
  const teamId = side === 'home' ? context.home : context.away;
  return suspendedPlayers(buildLedger(), context.tournament.id, context.match.id, teamId).has(normalize(name));
}

function stampManualRegistration(context) {
  if (!played(context.match) && !context.match.registrationStartedAt) {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    context.match.date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    context.match.time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    context.match.registrationStartedAt = now.getTime();
  }
  const venue = String(document.getElementById('cmMatchVenue')?.value || '').trim();
  if (venue) context.match.venue = venue;
}

async function addDoubleYellow(context, side, name, minute) {
  const teamId = side === 'home' ? context.home : context.away;
  stampManualRegistration(context);
  context.match.cards = Array.isArray(context.match.cards) ? context.match.cards : [];
  context.match.cards.push({
    id: uid('card'), side, teamId, playerName: name, role: 'player', type: 'red', reason: 'double_yellow', secondYellow: true,
    minute: String(minute), createdAt: Date.now()
  });
  syncLegacyLogs(context.match);
  core.persistLocal();
  core.render();
  try {
    await core.saveCloud();
    core.showToast(`Segunda amarilla para ${name}: expulsión y una fecha de suspensión.`);
  } catch (error) {
    console.error(error);
    core.showToast(`Segunda amarilla para ${name}: expulsión guardada localmente.`);
  }
  window.ChuteDetailEvents?.openDetailedMatch?.(context.tournament.id, context.match.id);
}

function guardEvent(event) {
  const button = event.target.closest('[data-cm-add-goal], [data-cm-add-card]');
  if (!button) return;
  const editor = button.closest('.cm-match-editor');
  const context = editorContext(editor);
  if (!context || context.tournament.type !== TYPE) return;
  const side = button.dataset.cmAddGoal || button.dataset.cmAddCard;
  const isGoal = button.hasAttribute('data-cm-add-goal');

  if (isGoal) {
    const scorer = document.getElementById(`cmScorer-${side}`)?.value || '';
    const assist = document.getElementById(`cmAssist-${side}`)?.value || '';
    const blocked = [scorer, assist].find((name) => isSuspendedSelection(context, side, name));
    if (blocked) {
      event.preventDefault(); event.stopImmediatePropagation();
      core.showToast(`${blocked} está suspendido y no puede participar en este partido.`);
    }
    return;
  }

  const raw = document.getElementById(`cmCardPlayer-${side}`)?.value || '';
  const minute = document.getElementById(`cmCardMinute-${side}`)?.value || '';
  const type = document.getElementById(`cmCardType-${side}`)?.value || 'yellow';
  if (!raw || !minute || raw.startsWith('coach::')) return;
  if (isSuspendedSelection(context, side, raw)) {
    event.preventDefault(); event.stopImmediatePropagation();
    core.showToast(`${raw} está suspendido y no puede participar en este partido.`);
    return;
  }
  const existing = (context.match.cards || []).filter((card) => card.side === side && card.role !== 'coach' && normalize(card.playerName) === normalize(raw));
  if (existing.some((card) => card.type === 'red' || card.reason === 'double_yellow')) {
    event.preventDefault(); event.stopImmediatePropagation();
    core.showToast(`${raw} ya fue expulsado en este partido.`);
    return;
  }
  if (type === 'yellow' && existing.some((card) => card.type === 'yellow')) {
    event.preventDefault(); event.stopImmediatePropagation();
    addDoubleYellow(context, side, raw, minute);
  }
}

document.addEventListener('click', guardEvent, true);
document.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-cm-v56-discipline-tab]');
  if (!tab) return;
  const hub = tab.closest('#cmTournamentHub');
  if (!hub) return;
  hub.querySelectorAll('.cm-hub-tabs button').forEach((button) => button.classList.toggle('active', button === tab));
  hub.querySelectorAll('.cm-hub-panel').forEach((panel) => panel.classList.toggle('active', panel.hasAttribute('data-cm-v56-discipline-panel')));
});

document.addEventListener('click', () => window.setTimeout(() => { enhanceHub(); enhanceEditor(); }, 80));
document.addEventListener('submit', () => window.setTimeout(() => { enhanceHub(); enhanceEditor(); }, 600));

function refresh() {
  ensureRules();
  enhanceHub();
  enhanceEditor();
}

refresh();
window.setInterval(refresh, 700);
window.ChuteDisciplineV56 = { TYPE, DEFAULT_RULES, buildLedger, rowsForTournament, suspendedPlayers, statusFor, refresh };
