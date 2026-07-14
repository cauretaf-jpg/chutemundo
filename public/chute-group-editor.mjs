function waitForCore() {
  if (window.ChuteMundoCore) return Promise.resolve(window.ChuteMundoCore);
  return new Promise((resolve) => document.addEventListener('chute:ready', (event) => resolve(event.detail), { once: true }));
}

const core = await waitForCore();
const VERSION = '4.1.0';

if (!document.querySelector('link[href*="chute-groups.css"]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `/chute-groups.css?v=${VERSION}`;
  document.head.appendChild(link);
}

let assignments = { A: [], B: [] };
let draggingId = null;
let editorMessage = '';

function selectedTeamIds() {
  return Array.from(document.querySelectorAll('#teamPicker input:checked')).map((input) => input.value);
}

function teamName(teamId) {
  return core.teamName(teamId);
}

function teamLogo(teamId) {
  const model = window.ChuteDetailModel;
  const src = model?.logoUrl?.(teamId) || `https://raw.githubusercontent.com/cauretaf-jpg/TorneosChute/main/public/team-logos/${teamId}.png`;
  return `<img class="cm-group-logo" src="${src}" alt="${teamName(teamId)}" loading="lazy" onerror="this.classList.add('logo-fallback')">`;
}

function ensureEditor() {
  const picker = document.getElementById('teamPicker');
  if (!picker) return null;
  let editor = document.getElementById('cmCupGroupEditor');
  if (editor) return editor;

  editor = document.createElement('section');
  editor.id = 'cmCupGroupEditor';
  editor.className = 'cm-cup-group-editor';
  editor.hidden = true;
  editor.innerHTML = `
    <div class="cm-group-editor-head">
      <div>
        <p class="eyebrow">DISTRIBUCIÓN PERSONALIZADA</p>
        <h3>Organiza los grupos de la copa</h3>
        <p>Arrastra los equipos entre columnas. En celular utiliza los botones de traslado.</p>
      </div>
      <div class="cm-group-editor-actions">
        <button id="cmAutoGroups" class="secondary" type="button">Distribuir automáticamente</button>
        <button id="cmSwapGroups" class="secondary" type="button">Intercambiar grupos</button>
      </div>
    </div>
    <div class="cm-group-columns">
      <article class="cm-group-zone" data-group="A">
        <header><div><span>GRUPO A</span><strong id="cmGroupCountA">0 equipos</strong></div><small>Clasifican 1.º y 2.º</small></header>
        <div class="cm-group-list" data-group-list="A"></div>
      </article>
      <article class="cm-group-zone" data-group="B">
        <header><div><span>GRUPO B</span><strong id="cmGroupCountB">0 equipos</strong></div><small>Clasifican 1.º y 2.º</small></header>
        <div class="cm-group-list" data-group-list="B"></div>
      </article>
    </div>
    <div id="cmGroupEditorStatus" class="notice info"></div>`;

  picker.insertAdjacentElement('afterend', editor);
  return editor;
}

function distributeAutomatically(ids = selectedTeamIds()) {
  assignments = { A: [], B: [] };
  ids.forEach((teamId, index) => assignments[index % 2 === 0 ? 'A' : 'B'].push(teamId));
  editorMessage = 'Distribución automática aplicada. Puedes modificarla arrastrando los equipos.';
  renderEditor();
}

function syncAssignments() {
  const selected = selectedTeamIds();
  const selectedSet = new Set(selected);
  assignments.A = assignments.A.filter((id) => selectedSet.has(id));
  assignments.B = assignments.B.filter((id) => selectedSet.has(id));
  const assigned = new Set([...assignments.A, ...assignments.B]);

  selected.forEach((teamId) => {
    if (assigned.has(teamId)) return;
    const target = assignments.A.length <= assignments.B.length ? 'A' : 'B';
    assignments[target].push(teamId);
    assigned.add(teamId);
  });

  renderEditor();
}

function teamCard(teamId, group, index) {
  const destination = group === 'A' ? 'B' : 'A';
  const arrow = group === 'A' ? '→' : '←';
  return `<article class="cm-group-team" draggable="true" data-team-id="${teamId}" data-group="${group}">
    <span class="cm-group-drag" aria-hidden="true">⠿</span>
    ${teamLogo(teamId)}
    <div><strong>${teamName(teamId)}</strong><small>Posición ${index + 1}</small></div>
    <button class="cm-group-move" type="button" data-move-team="${teamId}" data-move-to="${destination}" aria-label="Mover ${teamName(teamId)} al Grupo ${destination}">${arrow}</button>
  </article>`;
}

function validation() {
  const selected = selectedTeamIds();
  const assigned = [...assignments.A, ...assignments.B];
  const unique = new Set(assigned);

  if (selected.length < 4) return { valid: false, text: 'Selecciona al menos cuatro equipos para configurar los grupos.' };
  if (assigned.length !== selected.length || unique.size !== selected.length) return { valid: false, text: 'Todos los equipos seleccionados deben aparecer una sola vez en los grupos.' };
  if (assignments.A.length < 2 || assignments.B.length < 2) return { valid: false, text: 'Cada grupo debe tener al menos dos equipos.' };
  if (Math.abs(assignments.A.length - assignments.B.length) > 1) return { valid: false, text: 'Los grupos deben quedar equilibrados; la diferencia máxima es de un equipo.' };

  return {
    valid: true,
    text: `Distribución válida: Grupo A con ${assignments.A.length} y Grupo B con ${assignments.B.length}. Los cruces serán 1.º A vs. 2.º B y 1.º B vs. 2.º A.`
  };
}

function renderEditor() {
  const editor = ensureEditor();
  const type = document.getElementById('tournamentType')?.value;
  if (!editor) return;
  editor.hidden = type !== 'cup_groups';
  if (editor.hidden) return;

  const listA = editor.querySelector('[data-group-list="A"]');
  const listB = editor.querySelector('[data-group-list="B"]');
  const htmlA = assignments.A.map((teamId, index) => teamCard(teamId, 'A', index)).join('');
  const htmlB = assignments.B.map((teamId, index) => teamCard(teamId, 'B', index)).join('');
  if (listA.dataset.signature !== assignments.A.join('|')) {
    listA.dataset.signature = assignments.A.join('|');
    listA.innerHTML = htmlA || '<p class="cm-group-empty">Arrastra equipos aquí</p>';
  }
  if (listB.dataset.signature !== assignments.B.join('|')) {
    listB.dataset.signature = assignments.B.join('|');
    listB.innerHTML = htmlB || '<p class="cm-group-empty">Arrastra equipos aquí</p>';
  }

  document.getElementById('cmGroupCountA').textContent = `${assignments.A.length} equipo${assignments.A.length === 1 ? '' : 's'}`;
  document.getElementById('cmGroupCountB').textContent = `${assignments.B.length} equipo${assignments.B.length === 1 ? '' : 's'}`;
  const result = validation();
  const status = document.getElementById('cmGroupEditorStatus');
  status.className = `notice ${result.valid ? 'success' : 'warning'}`;
  status.innerHTML = `${result.valid ? '<strong>Grupos listos.</strong>' : '<strong>Revisa la distribución.</strong>'} ${editorMessage || result.text}`;
  if (editorMessage && result.valid) status.innerHTML += `<div>${result.text}</div>`;
}

function readAssignmentsFromDom() {
  assignments.A = Array.from(document.querySelectorAll('[data-group-list="A"] .cm-group-team')).map((card) => card.dataset.teamId);
  assignments.B = Array.from(document.querySelectorAll('[data-group-list="B"] .cm-group-team')).map((card) => card.dataset.teamId);
  editorMessage = 'Distribución personalizada actualizada.';
  renderEditor();
}

function moveTeam(teamId, destination, beforeId = null) {
  assignments.A = assignments.A.filter((id) => id !== teamId);
  assignments.B = assignments.B.filter((id) => id !== teamId);
  const list = assignments[destination];
  const beforeIndex = beforeId ? list.indexOf(beforeId) : -1;
  if (beforeIndex >= 0) list.splice(beforeIndex, 0, teamId);
  else list.push(teamId);
  editorMessage = `${teamName(teamId)} fue movido al Grupo ${destination}.`;
  renderEditor();
}

function reorderPickerForCore() {
  const picker = document.getElementById('teamPicker');
  if (!picker) return;
  const labels = Array.from(picker.querySelectorAll('.team-check'));
  const labelByTeam = new Map(labels.map((label) => [label.querySelector('input')?.value, label]));
  const ordered = [];
  const longest = Math.max(assignments.A.length, assignments.B.length);
  for (let index = 0; index < longest; index += 1) {
    if (assignments.A[index]) ordered.push(assignments.A[index]);
    if (assignments.B[index]) ordered.push(assignments.B[index]);
  }
  const orderedSet = new Set(ordered);
  [...ordered, ...labels.map((label) => label.querySelector('input')?.value).filter((id) => id && !orderedSet.has(id))]
    .forEach((teamId) => {
      const label = labelByTeam.get(teamId);
      if (label) picker.appendChild(label);
    });
}

function submitCapture(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== 'tournamentForm') return;
  if (document.getElementById('tournamentType')?.value !== 'cup_groups') return;
  syncAssignments();
  const result = validation();
  if (!result.valid) {
    event.preventDefault();
    event.stopImmediatePropagation();
    editorMessage = result.text;
    renderEditor();
    core.showToast(result.text);
    document.getElementById('cmCupGroupEditor')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  reorderPickerForCore();
  editorMessage = 'Creando la copa con esta distribución…';
  renderEditor();
}

function afterElement(container, y) {
  const cards = [...container.querySelectorAll('.cm-group-team:not(.dragging)')];
  return cards.reduce((closest, card) => {
    const box = card.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    return offset < 0 && offset > closest.offset ? { offset, element: card } : closest;
  }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}

document.addEventListener('change', (event) => {
  if (event.target.matches('#tournamentType')) {
    editorMessage = '';
    if (event.target.value === 'cup_groups') syncAssignments();
    else renderEditor();
  }
  if (event.target.closest('#teamPicker') || event.target.matches('#selectAllTeams')) {
    editorMessage = '';
    window.setTimeout(syncAssignments, 0);
  }
});

document.addEventListener('click', (event) => {
  const auto = event.target.closest('#cmAutoGroups');
  if (auto) {
    distributeAutomatically();
    core.showToast('Equipos distribuidos automáticamente.');
    return;
  }
  const swap = event.target.closest('#cmSwapGroups');
  if (swap) {
    assignments = { A: [...assignments.B], B: [...assignments.A] };
    editorMessage = 'Los grupos A y B fueron intercambiados.';
    renderEditor();
    return;
  }
  const move = event.target.closest('[data-move-team]');
  if (move) moveTeam(move.dataset.moveTeam, move.dataset.moveTo);
});

document.addEventListener('dragstart', (event) => {
  const card = event.target.closest('.cm-group-team');
  if (!card) return;
  draggingId = card.dataset.teamId;
  card.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', draggingId);
});

document.addEventListener('dragover', (event) => {
  const list = event.target.closest('[data-group-list]');
  if (!list || !draggingId) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  const card = document.querySelector(`.cm-group-team[data-team-id="${CSS.escape(draggingId)}"]`);
  if (!card) return;
  const after = afterElement(list, event.clientY);
  if (after) list.insertBefore(card, after); else list.appendChild(card);
  list.closest('.cm-group-zone')?.classList.add('drag-over');
});

document.addEventListener('dragleave', (event) => {
  const zone = event.target.closest('.cm-group-zone');
  if (zone && !zone.contains(event.relatedTarget)) zone.classList.remove('drag-over');
});

document.addEventListener('drop', (event) => {
  const list = event.target.closest('[data-group-list]');
  if (!list || !draggingId) return;
  event.preventDefault();
  list.closest('.cm-group-zone')?.classList.remove('drag-over');
  readAssignmentsFromDom();
});

document.addEventListener('dragend', (event) => {
  event.target.closest('.cm-group-team')?.classList.remove('dragging');
  document.querySelectorAll('.cm-group-zone.drag-over').forEach((zone) => zone.classList.remove('drag-over'));
  draggingId = null;
  readAssignmentsFromDom();
});

document.addEventListener('submit', submitCapture, true);

ensureEditor();
syncAssignments();

window.ChuteGroupEditor = {
  getGroups: () => ({ A: [...assignments.A], B: [...assignments.B] }),
  distributeAutomatically,
  validation,
  render: renderEditor
};
