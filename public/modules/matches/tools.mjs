function waitForCore() {
  if (window.ChuteMundoCore) return Promise.resolve(window.ChuteMundoCore);
  return new Promise((resolve) => document.addEventListener('chute:ready', (event) => resolve(event.detail), { once: true }));
}

const core = await waitForCore();
const model = window.ChuteDetailModel;
if (!model) throw new Error('El modelo detallado no está disponible para las herramientas de partido v5.5.');

const { esc } = model;
const FIRST = window.ChuteDivisionsV54?.FIRST || '1.ª División';
const SECOND = window.ChuteDivisionsV54?.SECOND || '2.ª División';
const OFFICIAL_MINUTES = ['0', '10', '20', '30', '45', '50', '60', '70', '80', '90', '105', '120'];
const divisionFilters = new Map();
let venueAdminSignature = '';
let savingVenueConfig = false;

function state() { return core.getState(); }
function normalizeName(value = '') { return String(value).trim().replace(/\s+/g, ' '); }
function localStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    at: date.getTime()
  };
}

function ensureVenueConfig() {
  const current = state();
  current.config = current.config && typeof current.config === 'object' ? current.config : {};
  if (!Array.isArray(current.config.venues)) {
    const historical = [];
    for (const tournament of current.tournaments || []) {
      for (const match of tournament.matches || []) {
        const name = normalizeName(match.venue);
        if (name && !historical.some((item) => item.toLowerCase() === name.toLowerCase())) historical.push(name);
      }
    }
    current.config.venues = historical;
  }
  current.config.venues = current.config.venues.map(normalizeName).filter(Boolean).filter((name, index, rows) => rows.findIndex((item) => item.toLowerCase() === name.toLowerCase()) === index);
  current.config.lastVenue = normalizeName(current.config.lastVenue || '');
  return current.config;
}

function venueNames(extra = '') {
  const config = ensureVenueConfig();
  const rows = [...config.venues];
  const extraName = normalizeName(extra);
  if (extraName && !rows.some((item) => item.toLowerCase() === extraName.toLowerCase())) rows.push(extraName);
  return rows;
}

async function saveVenueConfig(message) {
  core.persistLocal();
  renderVenueAdmin(true);
  if (!core.canEdit() || savingVenueConfig) {
    if (message) core.showToast(message);
    return;
  }
  savingVenueConfig = true;
  try {
    await core.saveCloud();
    if (message) core.showToast(`${message} Sincronizado con Firebase.`);
  } catch (error) {
    console.error(error);
    if (message) core.showToast(`${message} Guardado localmente.`);
  } finally {
    savingVenueConfig = false;
  }
}

function addVenue(rawName, { select = false } = {}) {
  const name = normalizeName(rawName);
  if (!name) return { ok: false, message: 'Escribe el nombre de la sede.' };
  const config = ensureVenueConfig();
  const existing = config.venues.find((item) => item.toLowerCase() === name.toLowerCase());
  const finalName = existing || name;
  if (!existing) config.venues.push(finalName);
  if (select) config.lastVenue = finalName;
  return { ok: true, name: finalName, created: !existing };
}

function deleteVenue(name) {
  const config = ensureVenueConfig();
  config.venues = config.venues.filter((item) => item.toLowerCase() !== String(name).toLowerCase());
  if (config.lastVenue.toLowerCase() === String(name).toLowerCase()) config.lastVenue = '';
}

function venueAdminMarkup() {
  const config = ensureVenueConfig();
  const rows = config.venues;
  return `<p class="eyebrow">SEDES</p>
    <div class="cm-v55-venue-admin-head"><div><h2>Catálogo de sedes</h2><p class="muted">Crea las canchas o lugares disponibles. La última selección quedará preparada para el siguiente partido.</p></div><span>${rows.length} sede${rows.length === 1 ? '' : 's'}</span></div>
    <form id="cmVenueForm" class="cm-v55-venue-form"><label>Nueva sede<input id="cmVenueName" maxlength="70" autocomplete="off" placeholder="Ej. Cancha Municipal"></label><button class="primary" type="submit">Agregar sede</button></form>
    <div class="cm-v55-venue-list">${rows.length ? rows.map((name) => `<article class="${config.lastVenue === name ? 'is-default' : ''}"><div><strong>${esc(name)}</strong><small>${config.lastVenue === name ? 'Última sede seleccionada' : 'Disponible para partidos'}</small></div><div><button type="button" data-cm-default-venue="${esc(name)}">Usar por defecto</button><button type="button" class="danger-button" data-cm-delete-venue="${esc(name)}">Eliminar</button></div></article>`).join('') : '<p class="empty">Todavía no hay sedes creadas.</p>'}</div>`;
}

function renderVenueAdmin(force = false) {
  const root = document.getElementById('administracion');
  if (!root) return;
  let panel = document.getElementById('cmVenueAdmin');
  if (!panel) {
    panel = document.createElement('article');
    panel.id = 'cmVenueAdmin';
    panel.className = 'panel admin-only cm-v55-venue-admin';
    const danger = root.querySelector('.panel.danger');
    if (danger) danger.insertAdjacentElement('beforebegin', panel);
    else root.appendChild(panel);
  }
  panel.hidden = !core.isAdmin();
  const config = ensureVenueConfig();
  const signature = JSON.stringify({ admin: core.isAdmin(), venues: config.venues, last: config.lastVenue });
  if (!force && signature === venueAdminSignature) return;
  venueAdminSignature = signature;
  panel.innerHTML = venueAdminMarkup();
}

function minuteOptions(selected = '') {
  return `<option value="">Selecciona minuto</option>${OFFICIAL_MINUTES.map((minute) => `<option value="${minute}" ${String(selected) === minute ? 'selected' : ''}>${minute}′</option>`).join('')}`;
}

function replaceMinuteInput(id) {
  const input = document.getElementById(id);
  if (!input || input.tagName === 'SELECT') return;
  const select = document.createElement('select');
  select.id = id;
  select.required = true;
  select.dataset.cmOfficialMinute = 'true';
  select.innerHTML = minuteOptions(input.value);
  input.replaceWith(select);
}

function venueOptions(selected = '') {
  const names = venueNames(selected);
  return `<option value="">${names.length ? 'Selecciona sede' : 'Crea una sede'}</option>${names.map((name) => `<option value="${esc(name)}" ${name === selected ? 'selected' : ''}>${esc(name)}</option>`).join('')}`;
}

function replaceVenueInput(editor, match) {
  const current = document.getElementById('cmMatchVenue');
  if (!current || current.tagName === 'SELECT') return;
  const config = ensureVenueConfig();
  const selected = normalizeName(match.venue || config.lastVenue || '');
  const label = current.closest('label');
  if (!label) return;
  label.classList.add('cm-v55-venue-label');
  label.innerHTML = `Sede<div class="cm-v55-venue-control"><select id="cmMatchVenue">${venueOptions(selected)}</select><button type="button" data-cm-quick-venue>+ Nueva sede</button></div><div class="cm-v55-quick-venue" hidden><input data-cm-quick-venue-name maxlength="70" placeholder="Nombre de la sede"><div><button type="button" class="primary" data-cm-save-quick-venue>Agregar</button><button type="button" data-cm-cancel-quick-venue>Cancelar</button></div></div><small>Se recordará la última sede seleccionada.</small>`;
}

function matchContext(editor) {
  if (!editor) return null;
  const tournament = core.tournamentById(editor.dataset.tournament);
  const match = tournament?.matches.find((item) => item.id === editor.dataset.match);
  return tournament && match ? { tournament, match } : null;
}

function setCurrentInputs(editor, match) {
  if (!editor || !match) return;
  const pending = !core.matchPlayed(match);
  const stamp = localStamp();
  const dateInput = document.getElementById('cmMatchDate');
  const timeInput = document.getElementById('cmMatchTime');
  if (pending && !match.registrationStartedAt) {
    if (dateInput) dateInput.value = stamp.date;
    if (timeInput) timeInput.value = stamp.time;
    editor.dataset.cmPendingStamp = 'true';
  }
}

function enhanceMatchEditor() {
  const editor = document.querySelector('.cm-match-editor');
  if (!editor) return;
  const context = matchContext(editor);
  if (!context) return;
  if (editor.dataset.cmV55Enhanced !== 'true') {
    editor.dataset.cmV55Enhanced = 'true';
    replaceVenueInput(editor, context.match);
    for (const side of ['home', 'away']) {
      replaceMinuteInput(`cmGoalMinute-${side}`);
      replaceMinuteInput(`cmCardMinute-${side}`);
    }
    setCurrentInputs(editor, context.match);
    const warning = editor.querySelector('.cm-score-warning');
    if (warning && !warning.querySelector('.cm-v55-auto-time')) warning.insertAdjacentHTML('beforeend', '<span class="cm-v55-auto-time">Fecha y hora se asignan automáticamente al iniciar el registro.</span>');
  }
}

function stampRegistration(editor) {
  const context = matchContext(editor);
  if (!context) return;
  const { match } = context;
  if (!core.matchPlayed(match) && !match.registrationStartedAt) {
    const stamp = localStamp();
    match.date = stamp.date;
    match.time = stamp.time;
    match.registrationStartedAt = stamp.at;
    const dateInput = document.getElementById('cmMatchDate');
    const timeInput = document.getElementById('cmMatchTime');
    if (dateInput) dateInput.value = stamp.date;
    if (timeInput) timeInput.value = stamp.time;
  }
  const venue = normalizeName(document.getElementById('cmMatchVenue')?.value || '');
  if (venue) {
    match.venue = venue;
    const result = addVenue(venue, { select: true });
    if (result.ok) ensureVenueConfig().lastVenue = result.name;
  }
}

function divisionForCard(card) {
  const label = card.querySelector(':scope > header > span')?.textContent?.trim() || '';
  if (label === FIRST || label.includes('1.ª División')) return 'first';
  if (label === SECOND || label.includes('2.ª División')) return 'second';
  return 'other';
}

function applyDivisionFilter(hub) {
  const tournamentId = hub.dataset.tournamentId;
  const value = divisionFilters.get(tournamentId) || 'all';
  const panel = hub.querySelector('[data-cm-tournament-panel="fixture"]');
  if (!panel) return;
  panel.querySelectorAll('.cm-hub-match').forEach((card) => {
    const division = divisionForCard(card);
    card.hidden = value !== 'all' && division !== value;
  });
  panel.querySelectorAll('.cm-hub-round').forEach((round) => {
    const cards = [...round.querySelectorAll('.cm-hub-match')];
    round.hidden = cards.length > 0 && cards.every((card) => card.hidden);
  });
}

function enhanceDivisionFixture() {
  const hub = document.getElementById('cmTournamentHub');
  if (!hub) return;
  const tournament = state().tournaments?.find((item) => item.id === hub.dataset.tournamentId);
  if (tournament?.type !== 'division_season') return;
  const panel = hub.querySelector('[data-cm-tournament-panel="fixture"]');
  const statusBar = panel?.querySelector('.cm-hub-filterbar');
  if (!panel || !statusBar) return;
  let control = panel.querySelector('.cm-v55-division-filter');
  if (!control) {
    control = document.createElement('label');
    control.className = 'cm-v55-division-filter';
    control.innerHTML = `<span>División</span><select data-cm-fixture-division><option value="all">Todas las divisiones</option><option value="first">1.ª División</option><option value="second">2.ª División</option></select>`;
    statusBar.insertAdjacentElement('afterend', control);
  }
  const select = control.querySelector('select');
  select.value = divisionFilters.get(tournament.id) || 'all';
  applyDivisionFilter(hub);
}

function refresh() {
  renderVenueAdmin();
  enhanceMatchEditor();
  enhanceDivisionFixture();
}

document.addEventListener('change', (event) => {
  const division = event.target.closest('[data-cm-fixture-division]');
  if (division) {
    const hub = document.getElementById('cmTournamentHub');
    if (hub) {
      divisionFilters.set(hub.dataset.tournamentId, division.value);
      applyDivisionFilter(hub);
    }
    return;
  }
  if (event.target.id === 'cmMatchVenue') {
    const name = normalizeName(event.target.value);
    if (name) {
      addVenue(name, { select: true });
      core.persistLocal();
      renderVenueAdmin(true);
    }
  }
});

document.addEventListener('submit', (event) => {
  if (event.target.id === 'cmVenueForm') {
    event.preventDefault();
    const input = document.getElementById('cmVenueName');
    const result = addVenue(input?.value || '', { select: true });
    if (!result.ok) return core.showToast(result.message);
    if (input) input.value = '';
    saveVenueConfig(result.created ? `Sede “${result.name}” creada.` : `La sede “${result.name}” ya existía.`);
    return;
  }
  if (event.target.id === 'cmMatchGeneralForm') {
    const editor = event.target.closest('.cm-match-editor');
    stampRegistration(editor);
  }
}, true);

document.addEventListener('click', (event) => {
  const defaultButton = event.target.closest('[data-cm-default-venue]');
  if (defaultButton) {
    ensureVenueConfig().lastVenue = defaultButton.dataset.cmDefaultVenue;
    saveVenueConfig(`Sede predeterminada: ${defaultButton.dataset.cmDefaultVenue}.`);
    return;
  }
  const deleteButton = event.target.closest('[data-cm-delete-venue]');
  if (deleteButton) {
    const name = deleteButton.dataset.cmDeleteVenue;
    if (window.confirm(`¿Eliminar la sede “${name}” del catálogo?`)) {
      deleteVenue(name);
      saveVenueConfig(`Sede “${name}” eliminada del catálogo.`);
    }
    return;
  }
  const quickButton = event.target.closest('[data-cm-quick-venue]');
  if (quickButton) {
    const box = quickButton.closest('label')?.querySelector('.cm-v55-quick-venue');
    if (box) { box.hidden = false; box.querySelector('input')?.focus(); }
    return;
  }
  const cancelQuick = event.target.closest('[data-cm-cancel-quick-venue]');
  if (cancelQuick) {
    const box = cancelQuick.closest('.cm-v55-quick-venue');
    if (box) box.hidden = true;
    return;
  }
  const saveQuick = event.target.closest('[data-cm-save-quick-venue]');
  if (saveQuick) {
    const box = saveQuick.closest('.cm-v55-quick-venue');
    const result = addVenue(box?.querySelector('[data-cm-quick-venue-name]')?.value || '', { select: true });
    if (!result.ok) return core.showToast(result.message);
    const select = document.getElementById('cmMatchVenue');
    if (select) { select.innerHTML = venueOptions(result.name); select.value = result.name; }
    if (box) box.hidden = true;
    saveVenueConfig(result.created ? `Sede “${result.name}” creada.` : `Sede “${result.name}” seleccionada.`);
    return;
  }
  const eventButton = event.target.closest('[data-cm-add-goal], [data-cm-add-card]');
  if (eventButton) {
    const side = eventButton.dataset.cmAddGoal || eventButton.dataset.cmAddCard;
    const minuteId = eventButton.hasAttribute('data-cm-add-goal') ? `cmGoalMinute-${side}` : `cmCardMinute-${side}`;
    const minute = document.getElementById(minuteId)?.value || '';
    if (!minute) {
      event.preventDefault();
      event.stopImmediatePropagation();
      core.showToast('Selecciona uno de los minutos oficiales del juego.');
      return;
    }
    stampRegistration(eventButton.closest('.cm-match-editor'));
  }
}, true);

refresh();
window.setInterval(refresh, 700);
window.ChuteMatchToolsV55 = { OFFICIAL_MINUTES, localStamp, venueNames, addVenue, refresh };
