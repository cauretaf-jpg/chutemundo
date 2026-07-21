function waitForCore() {
  if (window.ChuteMundoCore) return Promise.resolve(window.ChuteMundoCore);
  return new Promise((resolve) => document.addEventListener('chute:ready', (event) => resolve(event.detail), { once: true }));
}

const core = await waitForCore();
const VERSION = '5.13.0';
const SCHEMA = 'chute-pc-rosters-2026-07-v1';
const clone = (value) => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const esc = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const norm = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const positionFromCode = (value) => ({ ARQ: 'Arquero', DEF: 'Defensa', MED: 'Medio', DEL: 'Delantero' })[value] || value || 'Jugador';
const minuteNumber = (value) => value === 'Penales' ? 120 : Math.max(0, Number.parseInt(String(value ?? '0'), 10) || 0);

const ROSTERS = Object.freeze({
  trucha: [
    ['Eddy Pino', 'ARQ', true], ['Donald Ortega', 'DEF', true], ['Ricky Watkins', 'DEL', true], ['Wilfredo Fernández', 'MED', true],
    ['Dino Richi', 'DEL', 0], ['Jerold Bogan', 'MED', 0], ['Dominic Mortensen', 'DEF', 0],
    ['Mario Luna', 'DEF', 20], ['Kelly Rivera', 'MED', 20], ['Angelo Carboni', 'MED', 20], ['Eric Perry', 'DEL', 20],
    ['Burt McCloskey', 'DEF', 45], ['Faustino Soriano', 'DEL', 45], ['Boris Lentz', 'MED', 45]
  ],
  guanaco: [
    ['Rosendo Acosta', 'ARQ', true], ['Bo de la Rosa', 'DEF', true], ['Chuck Chong', 'MED', true], ['Lonny Ventura', 'DEL', true],
    ['Wilton Blackwood', 'MED', 0], ['Carmelo Wilkinson', 'DEF', 0], ['Irwin Medeiros', 'DEL', 0],
    ['Donovan Vinson', 'MED', 20], ['Harley Peralta', 'MED', 20], ['Sonny Saldana', 'DEL', 20], ['Robbie Solomon', 'DEF', 20],
    ['Davis Bronson', 'MED', 45], ['Warner Ferrara', 'DEF', 45], ['Sid Koslowski', 'DEL', 45]
  ],
  pantera: [
    ['Rita Malone', 'ARQ', true], ['Sabrina Mendoza', 'DEF', true], ['Rebeca Sanders', 'MED', true], ['Roxie Jones', 'DEL', true],
    ['Mandy Wallace', 'DEF', 0], ['Margaret Castillo', 'MED', 0], ['Nancy King', 'DEL', 0],
    ['Nora Cruz', 'DEF', 20], ['Lina Yamamoto', 'MED', 20], ['Sherry Terry', 'MED', 20], ['Sharon Ortiz', 'DEL', 20],
    ['Belinda Sparks', 'DEF', 45], ['Jackie Sánchez', 'MED', 45], ['Cindy Fitzgerald', 'DEL', 45]
  ],
  parrilla: [
    ['Alex Meres', 'ARQ', true], ['Arthur Turok', 'DEF', true], ['Rolando Akira', 'MED', true], ['Freddy Manfredo', 'DEL', true],
    ['Claudio Conde', 'DEF', 0], ['Peta Zeta', 'MED', 0], ['El Guatón Nelson', 'DEL', 0],
    ['Nick Cabezón', 'DEL', 20], ["Randolph D'Luna", 'MED', 20], ['El Profesor', 'MED', 20], ['John Giovanni', 'DEF', 20],
    ['Joe Pavo', 'DEF', 45], ['Rod Lete', 'MED', 45], ['Luis Felipe', 'DEL', 45]
  ],
  perla: [
    ['Eusebio Flowers', 'ARQ', true], ['Lucius Chase', 'DEF', true], ['Archie Jackson', 'MED', true], ['Steven Ramos', 'DEL', true],
    ['Jacinto Chavarría', 'DEF', 0], ['Marty Love', 'DEL', 0], ['Eric Reyes', 'MED', 0],
    ['Edison Cabrera', 'DEF', 20], ['Sammy Portillo', 'MED', 20], ['Toyo Takahashi', 'MED', 20], ['Omar Watson', 'DEL', 20],
    ['Melvin Clayton', 'DEF', 45], ['Randolf Salazar', 'MED', 45], ['Arnold Vega', 'DEL', 45], ['El Kraken', 'DEL', 45]
  ],
  polpetta: [
    ['Vito Volta', 'ARQ', true], ['Enzo Mancini', 'DEF', true], ['Fiorino Panicucci', 'MED', true], ['Freddo Bellini', 'DEL', true],
    ['Fabio Clemenza', 'DEF', 0], ['Paolo Fontana', 'DEL', 0], ['Milo Gorgazzi', 'MED', 0],
    ['Mario De Luca', 'MED', 20], ['Nicola Pisani', 'MED', 20], ['Giorgio Valentino', 'DEF', 20], ['Alessandro Zito', 'DEL', 20],
    ['Rocco Caruso', 'DEF', 45], ['Giulio Locatelli', 'DEL', 45], ['Donnie Spumoni', 'MED', 45]
  ]
});

const ALIASES = Object.freeze({
  'Warner Ferrera': 'Warner Ferrara',
  'Rocco Carusso': 'Rocco Caruso',
  'Jackie Sanchez': 'Jackie Sánchez',
  'Jacinto Chavarria': 'Jacinto Chavarría',
  'Julio Vega': 'Arnold Vega',
  'Randolph Salazar': 'Randolf Salazar',
  'El Guaton Nelson': 'El Guatón Nelson',
  'Nick Cabezon': 'Nick Cabezón',
  'Wilfredo Fernandez': 'Wilfredo Fernández'
});

const canonicalName = (value = '') => ALIASES[value] || value;
const entryName = (entry) => canonicalName(Array.isArray(entry) ? entry[0] : entry?.name || '');
const entryPosition = (entry) => positionFromCode(Array.isArray(entry) ? entry[1] : entry?.position || '');
const teamRoster = (teamId, source = core.getState()) => source.teams?.find((team) => team.id === teamId)?.players || [];
const rosterPlayer = (teamId, name, source = core.getState()) => teamRoster(teamId, source).find((entry) => entryName(entry) === canonicalName(name)) || null;
const availability = (entry) => entry?.start ? null : Math.max(0, Number(entry?.minute ?? 0));
const availabilityLabel = (entry) => entry?.start ? 'Empieza en cancha' : `Disponible desde ${availability(entry)}′`;

function replaceAliasesDeep(value) {
  if (typeof value === 'string') return canonicalName(value);
  if (Array.isArray(value)) return value.map(replaceAliasesDeep);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceAliasesDeep(item)]));
}

function canonicalRoster(teamId, currentPlayers = []) {
  const current = new Map(currentPlayers.map((entry) => [norm(entryName(entry)), entry]));
  return (ROSTERS[teamId] || []).map(([name, code, status]) => {
    const previous = current.get(norm(name));
    const base = Array.isArray(previous)
      ? { name: canonicalName(previous[0]), position: positionFromCode(previous[1]) }
      : { ...(previous || {}) };
    delete base.start;
    delete base.minute;
    return {
      ...base,
      name,
      position: positionFromCode(code),
      ...(status === true ? { start: true } : { minute: Number(status) }),
      chutePcRoster: true
    };
  });
}

function migrateState(source) {
  const next = replaceAliasesDeep(clone(source || {}));
  next.config = { ...(next.config || {}), rosterSchema: SCHEMA };
  next.teams = (next.teams || []).map((team) => ROSTERS[team.id]
    ? { ...team, players: canonicalRoster(team.id, team.players || []) }
    : team);
  return next;
}

function stateNeedsMigration(source) {
  if (source?.config?.rosterSchema !== SCHEMA) return true;
  return Object.entries(ROSTERS).some(([teamId, roster]) => {
    const team = source.teams?.find((item) => item.id === teamId);
    if (!team || team.players?.length !== roster.length) return true;
    return roster.some(([name, code, status], index) => {
      const entry = team.players[index];
      return entryName(entry) !== name
        || entryPosition(entry) !== positionFromCode(code)
        || (status === true ? !entry?.start : Number(entry?.minute) !== Number(status));
    });
  });
}

function defaultStarters(teamId, source = core.getState()) {
  return teamRoster(teamId, source).filter((entry) => entry?.start).map(entryName).slice(0, 4);
}

function ensureSide(side, teamId, source) {
  const starters = Array.isArray(side?.starters) && side.starters.length
    ? side.starters.map(canonicalName)
    : defaultStarters(teamId, source);
  return {
    teamId,
    starters: [...new Set(starters)].slice(0, 4),
    changes: Array.isArray(side?.changes)
      ? side.changes.map((change) => ({ ...change, playerOut: canonicalName(change.playerOut), playerIn: canonicalName(change.playerIn), minute: minuteNumber(change.minute) }))
      : []
  };
}

function ensureMatchLineups(match, homeId, awayId, source) {
  const before = JSON.stringify(match.lineups || null);
  match.lineups = {
    home: ensureSide(match.lineups?.home, homeId, source),
    away: ensureSide(match.lineups?.away, awayId, source)
  };
  return before !== JSON.stringify(match.lineups);
}

function currentLineup(lineup, minute = 120) {
  const field = [...(lineup?.starters || [])];
  const changes = [...(lineup?.changes || [])].sort((a, b) => minuteNumber(a.minute) - minuteNumber(b.minute) || Number(a.createdAt || 0) - Number(b.createdAt || 0));
  for (const change of changes) {
    if (minuteNumber(change.minute) > minuteNumber(minute)) continue;
    const index = field.indexOf(change.playerOut);
    if (index >= 0 && !field.includes(change.playerIn)) field.splice(index, 1, change.playerIn);
  }
  return field;
}

function usedPlayers(lineup) {
  return new Set([...(lineup?.starters || []), ...(lineup?.changes || []).flatMap((change) => [change.playerOut, change.playerIn])]);
}

function matchContext(pair, source = core.getState()) {
  const [tournamentId, matchId] = String(pair || '').split('__');
  const tournament = source.tournaments?.find((item) => item.id === tournamentId);
  const match = tournament?.matches?.find((item) => item.id === matchId);
  if (!tournament || !match) return null;
  const home = match.home || core.resolveHome(tournament, match);
  const away = match.away || core.resolveAway(tournament, match);
  if (!home || !away) return null;
  return { tournament, match, home, away, pair: `${tournamentId}__${matchId}` };
}

function readLiveMetadata(match) {
  const date = document.getElementById('cmV59Date');
  const time = document.getElementById('cmV59Time');
  const venue = document.getElementById('cmV59Venue');
  const homePens = document.getElementById('cmV59HomePens');
  const awayPens = document.getElementById('cmV59AwayPens');
  if (date) match.date = date.value;
  if (time) match.time = time.value;
  if (venue) match.venue = venue.value.trim();
  if (homePens) match.homePens = homePens.value === '' ? null : Number(homePens.value);
  if (awayPens) match.awayPens = awayPens.value === '' ? null : Number(awayPens.value);
}

function ensureLineupsInLiveState(pair) {
  const current = core.getState();
  const next = clone(current);
  const ctx = matchContext(pair, next);
  if (!ctx) return false;
  const changed = ensureMatchLineups(ctx.match, ctx.home, ctx.away, next);
  if (changed) core.setState(next);
  return changed;
}

function sideMarkup(ctx, side, minute) {
  const teamId = side === 'away' ? ctx.away : ctx.home;
  const lineup = ctx.match.lineups?.[side] || ensureSide(null, teamId, core.getState());
  const roster = teamRoster(teamId);
  const field = currentLineup(lineup, minute);
  const used = usedPlayers(lineup);
  const outgoing = field.filter((name) => entryPosition(rosterPlayer(teamId, name)) !== 'Arquero');
  const eligible = roster.filter((entry) => !entry.start && availability(entry) <= minute && !field.includes(entryName(entry)) && !used.has(entryName(entry)));
  const waiting = roster.filter((entry) => !entry.start && availability(entry) > minute && !used.has(entryName(entry)));
  const history = lineup.changes?.length
    ? [...lineup.changes].sort((a, b) => minuteNumber(a.minute) - minuteNumber(b.minute)).map((change) => `<li><b>${minuteNumber(change.minute)}′</b><span>${esc(change.playerIn)} por ${esc(change.playerOut)}</span></li>`).join('')
    : '<li class="is-empty">Sin cambios registrados.</li>';
  return `<article class="cm-v513-lineup-side" data-cm-v513-side="${side}">
    <header><div><small>${side === 'home' ? 'LOCAL' : 'VISITA'}</small><h4>${esc(core.teamName(teamId))}</h4></div><span>${field.length}/4 en cancha</span></header>
    <div class="cm-v513-field">${field.map((name) => {
      const entry = rosterPlayer(teamId, name);
      return `<span class="${entryPosition(entry) === 'Arquero' ? 'is-goalkeeper' : ''}"><b>${esc(name)}</b><small>${esc(entryPosition(entry))}${entryPosition(entry) === 'Arquero' ? ' · fijo' : ''}</small></span>`;
    }).join('')}</div>
    <div class="cm-v513-change-form">
      <label>Sale<select data-cm-v513-out="${side}">${outgoing.map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join('')}</select></label>
      <label>Entra<select data-cm-v513-in="${side}">${eligible.map((entry) => `<option value="${esc(entryName(entry))}">${esc(entryName(entry))} · ${availability(entry)}′</option>`).join('')}</select></label>
      <button type="button" data-cm-v513-substitute="${side}" ${!outgoing.length || !eligible.length ? 'disabled' : ''}>Registrar cambio</button>
    </div>
    ${waiting.length ? `<p class="cm-v513-waiting"><b>Aún no disponibles:</b> ${waiting.map((entry) => `${esc(entryName(entry))} (${availability(entry)}′)`).join(' · ')}</p>` : ''}
    <ol class="cm-v513-change-history">${history}</ol>
  </article>`;
}

function renderLiveLineups() {
  const root = document.querySelector('[data-cm-v59-live-pair]');
  if (!root) return;
  const pair = root.dataset.cmV59LivePair;
  const ctx = matchContext(pair);
  if (!ctx) return;
  const minute = minuteNumber(document.getElementById('cmV59Minute')?.value || 0);
  const previewMatch = clone(ctx.match);
  ensureMatchLineups(previewMatch, ctx.home, ctx.away, core.getState());
  const preview = { ...ctx, match: previewMatch };
  const signature = JSON.stringify({ pair, minute, lineups: previewMatch.lineups, schema: core.getState().config?.rosterSchema });
  let section = root.querySelector('#cmV513Lineups');
  if (section?.dataset.signature === signature) return;
  const markup = `<section id="cmV513Lineups" class="cm-v513-lineups" data-signature="${esc(signature)}">
    <header><div><p class="eyebrow">ALINEACIONES DE CHUTE PC</p><h3>Jugadores en cancha y sustituciones</h3><p>Los suplentes solo pueden ingresar cuando alcanzan el minuto indicado en su carta. El arquero titular permanece fijo.</p></div><span>Minuto ${minute}′</span></header>
    <div class="cm-v513-lineup-grid">${sideMarkup(preview, 'home', minute)}${sideMarkup(preview, 'away', minute)}</div>
  </section>`;
  if (section) section.outerHTML = markup;
  else root.querySelector('.cm-v59-live-sides')?.insertAdjacentHTML('beforebegin', markup);
}

let saving = false;
async function registerSubstitution(pair, side) {
  if (saving) return;
  const minute = minuteNumber(document.getElementById('cmV59Minute')?.value || 0);
  const playerOut = document.querySelector(`[data-cm-v513-out="${side}"]`)?.value || '';
  const playerIn = document.querySelector(`[data-cm-v513-in="${side}"]`)?.value || '';
  if (!playerOut || !playerIn) return core.showToast('Selecciona quién sale y quién entra.');
  const previous = clone(core.getState());
  const next = clone(previous);
  const ctx = matchContext(pair, next);
  if (!ctx) return core.showToast('El partido ya no está disponible.');
  const teamId = side === 'away' ? ctx.away : ctx.home;
  ensureMatchLineups(ctx.match, ctx.home, ctx.away, next);
  const lineup = ctx.match.lineups[side];
  const field = currentLineup(lineup, minute);
  const incoming = rosterPlayer(teamId, playerIn, next);
  if (!field.includes(playerOut)) return core.showToast('El jugador que sale ya no está en cancha.');
  if (entryPosition(rosterPlayer(teamId, playerOut, next)) === 'Arquero') return core.showToast('El arquero titular permanece durante todo el partido.');
  if (!incoming || incoming.start || availability(incoming) > minute) return core.showToast(`${playerIn} todavía no está habilitado para ingresar.`);
  if (field.includes(playerIn) || usedPlayers(lineup).has(playerIn)) return core.showToast(`${playerIn} ya participó en este partido.`);
  readLiveMetadata(ctx.match);
  lineup.changes.push({ id: core.uid('sub'), minute, playerOut, playerIn, createdAt: Date.now() });
  ctx.match.updatedAt = Date.now();
  next.activity = Array.isArray(next.activity) ? next.activity : [];
  next.activity.unshift({ id: core.uid('activity'), text: `Cambio en ${core.teamName(teamId)}: ${playerIn} por ${playerOut} (${minute}′).`, at: Date.now() });
  next.activity = next.activity.slice(0, 50);
  saving = true;
  try {
    core.setState(next);
    await core.saveCloud();
    core.showToast(`Cambio registrado: ${playerIn} por ${playerOut}.`);
    window.ChuteV59?.openLiveMatch?.(pair);
  } catch (error) {
    console.error(error);
    core.setState(previous);
    core.showToast(`No se pudo guardar el cambio: ${error.code || error.message || 'error desconocido'}.`);
    window.ChuteV59?.openLiveMatch?.(pair);
  } finally {
    saving = false;
  }
}

function allRecordedMatches(source = core.getState()) {
  const official = (source.tournaments || []).flatMap((tournament) => (tournament.matches || []).map((match) => {
    const home = match.home || core.resolveHome(tournament, match);
    const away = match.away || core.resolveAway(tournament, match);
    return { match, home, away };
  }));
  const friendlies = (source.friendlies || []).map((match) => ({ match, home: match.home, away: match.away }));
  return [...official, ...friendlies].filter((row) => row.home && row.away && core.matchPlayed(row.match));
}

function matchLength(match) {
  const values = [Number(match.duration) || 0];
  for (const item of [...(match.goals || []), ...(match.cards || []), ...(match.lineups?.home?.changes || []), ...(match.lineups?.away?.changes || [])]) {
    values.push(minuteNumber(item.minute));
  }
  return Math.max(90, ...values);
}

function participationStats(teamId, playerName, source = core.getState()) {
  const name = canonicalName(playerName);
  const result = { appearances: 0, starts: 0, substituteAppearances: 0, minutes: 0, average: 0 };
  for (const row of allRecordedMatches(source)) {
    const side = row.home === teamId ? 'home' : row.away === teamId ? 'away' : null;
    if (!side) continue;
    const lineup = row.match.lineups?.[side];
    if (!lineup?.starters?.length) continue;
    const starts = lineup.starters.includes(name);
    let enteredAt = starts ? 0 : null;
    let played = starts;
    if (starts) result.starts += 1;
    for (const change of [...(lineup.changes || [])].sort((a, b) => minuteNumber(a.minute) - minuteNumber(b.minute))) {
      const minute = minuteNumber(change.minute);
      if (change.playerOut === name && enteredAt !== null) {
        result.minutes += Math.max(0, minute - enteredAt);
        enteredAt = null;
      }
      if (change.playerIn === name && enteredAt === null) {
        enteredAt = minute;
        played = true;
        result.substituteAppearances += 1;
      }
    }
    if (enteredAt !== null) result.minutes += Math.max(0, matchLength(row.match) - enteredAt);
    if (played) result.appearances += 1;
  }
  result.average = result.appearances ? Math.round(result.minutes / result.appearances) : 0;
  return result;
}

let lastPlayerKey = '';
let lastTeamId = '';
function parsePlayerKey(value = '') {
  const separator = value.indexOf('__');
  return separator < 0 ? { teamId: '', name: '' } : { teamId: value.slice(0, separator), name: decodeURIComponent(value.slice(separator + 2)) };
}

function decoratePlayerProfile(modal) {
  if (!lastPlayerKey || modal.dataset.cmV513Player === lastPlayerKey) return;
  const { teamId, name } = parsePlayerKey(lastPlayerKey);
  const entry = rosterPlayer(teamId, name);
  if (!entry) return;
  modal.dataset.cmV513Player = lastPlayerKey;
  const stats = participationStats(teamId, name);
  modal.querySelector('.cm-v59-profile-hero div')?.insertAdjacentHTML('beforeend', `<em class="cm-v513-availability ${entry.start ? 'is-starter' : ''}">${esc(availabilityLabel(entry))}</em>`);
  const metrics = modal.querySelector('.cm-v59-profile-metrics');
  if (metrics) metrics.insertAdjacentHTML('beforeend', `<article class="cm-v513-participation"><b>${stats.starts}</b><span>Titularidades</span></article><article class="cm-v513-participation"><b>${stats.substituteAppearances}</b><span>Ingresos</span></article><article class="cm-v513-participation"><b>${stats.minutes}</b><span>Minutos</span></article><article class="cm-v513-participation"><b>${stats.average || '—'}</b><span>Promedio</span></article>`);
}

function decorateRosterButtons(root = document) {
  root.querySelectorAll('[data-cm-v59-player]').forEach((button) => {
    if (button.querySelector('.cm-v513-roster-tag')) return;
    const { teamId, name } = parsePlayerKey(button.dataset.cmV59Player || '');
    const entry = rosterPlayer(teamId, name);
    if (!entry) return;
    button.querySelector('span')?.insertAdjacentHTML('beforeend', `<em class="cm-v513-roster-tag ${entry.start ? 'is-starter' : ''}">${esc(availabilityLabel(entry))}</em>`);
  });
}

function decorateTeamProfile(modal) {
  if (!lastTeamId || modal.dataset.cmV513Team === lastTeamId) return;
  modal.dataset.cmV513Team = lastTeamId;
  decorateRosterButtons(modal);
}

function decorateUi() {
  renderLiveLineups();
  decorateRosterButtons(document);
  const modal = document.querySelector('.cm-v59-profile-modal');
  if (modal) {
    if (lastPlayerKey && modal.querySelector('h2')?.textContent?.trim() === parsePlayerKey(lastPlayerKey).name) decoratePlayerProfile(modal);
    else decorateTeamProfile(modal);
  }
}

let migrationBusy = false;
async function ensureCanonicalState() {
  if (migrationBusy) return;
  const current = core.getState();
  if (!stateNeedsMigration(current)) return;
  migrationBusy = true;
  const next = migrateState(current);
  try {
    core.setState(next);
    if (core.canEdit()) await core.saveCloud();
    window.ChuteV59?.refresh?.();
  } catch (error) {
    console.error('No se pudo guardar la migración de planteles.', error);
  } finally {
    migrationBusy = false;
  }
}

function installStyles() {
  if (document.getElementById('cmV513Styles')) return;
  const link = document.createElement('link');
  link.id = 'cmV513Styles';
  link.rel = 'stylesheet';
  link.href = `/chute-v513-lineups.css?v=${VERSION}`;
  document.head.appendChild(link);
}

window.addEventListener('click', (event) => {
  const player = event.target.closest?.('[data-cm-v59-player]');
  if (player) { lastPlayerKey = player.dataset.cmV59Player || ''; lastTeamId = ''; }
  const team = event.target.closest?.('[data-cm-v59-team]');
  if (team) { lastTeamId = team.dataset.cmV59Team || ''; lastPlayerKey = ''; }
  const saveOrFinish = event.target.closest?.('[data-cm-v59-save-live], [data-cm-v59-finish]');
  if (saveOrFinish) {
    const root = saveOrFinish.closest('[data-cm-v59-live-pair]');
    if (root) ensureLineupsInLiveState(root.dataset.cmV59LivePair);
  }
  const substitution = event.target.closest?.('[data-cm-v513-substitute]');
  if (substitution) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const root = substitution.closest('[data-cm-v59-live-pair]');
    if (root && !substitution.disabled) void registerSubstitution(root.dataset.cmV59LivePair, substitution.dataset.cmV513Substitute);
  }
}, true);

document.addEventListener('change', (event) => {
  if (event.target.id === 'cmV59Minute') queueMicrotask(renderLiveLineups);
}, true);

const observer = new MutationObserver(() => requestAnimationFrame(decorateUi));
observer.observe(document.body, { childList: true, subtree: true });

installStyles();
await ensureCanonicalState();
const originalPlayerProfile = window.ChuteV59?.openPlayerProfile?.bind(window.ChuteV59);
const originalTeamProfile = window.ChuteV59?.openTeamProfile?.bind(window.ChuteV59);
if (originalPlayerProfile) window.ChuteV59.openPlayerProfile = (key) => { lastPlayerKey = key; lastTeamId = ''; return originalPlayerProfile(key); };
if (originalTeamProfile) window.ChuteV59.openTeamProfile = (teamId) => { lastTeamId = teamId; lastPlayerKey = ''; return originalTeamProfile(teamId); };

document.title = 'Chute Mundo v5.13 · Alineaciones oficiales';
const heroVersion = document.querySelector('.hero .eyebrow');
if (heroVersion) heroVersion.textContent = 'CHUTE MUNDO v5.13';
decorateUi();
window.setInterval(() => { void ensureCanonicalState(); decorateUi(); }, 1800);

window.ChuteV513Lineups = {
  version: VERSION,
  schema: SCHEMA,
  rosters: ROSTERS,
  aliases: ALIASES,
  migrateState,
  stateNeedsMigration,
  canonicalRoster,
  defaultStarters,
  currentLineup,
  participationStats,
  ensureMatchLineups,
  availabilityLabel
};
