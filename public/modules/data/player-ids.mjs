const core = window.ChuteMundoCore;
if (!core) throw new Error('Chute Mundo no está listo para inicializar identidades de jugadores.');

const SCHEMA = 'player-ids-v1';
const KNOWN_ALIASES = Object.freeze({
  'julio vega': 'arnold vega',
  'rocco carusso': 'rocco caruso',
  'warner ferrera': 'warner ferrara'
});
const CANONICAL_LABELS = Object.freeze({
  'arnold vega': 'Arnold Vega',
  'rocco caruso': 'Rocco Caruso',
  'warner ferrara': 'Warner Ferrara'
});

const clone = (value) => typeof structuredClone === 'function'
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value));

function normalizeName(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function canonicalKey(name = '') {
  const normalized = normalizeName(name);
  return KNOWN_ALIASES[normalized] || normalized;
}

function canonicalLabel(name = '') {
  const key = canonicalKey(name);
  return CANONICAL_LABELS[key] || String(name || '').trim();
}

function slug(value = '') {
  return normalizeName(value).replace(/\s+/g, '-') || 'sin-nombre';
}

function hash(value = '') {
  let h = 0x811c9dc5;
  for (const char of String(value)) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).padStart(7, '0').slice(0, 7);
}

function idFor(name = '') {
  const key = canonicalKey(name);
  return key ? `player_${slug(key)}_${hash(key)}` : '';
}

function addUnique(list, value) {
  if (!value) return list;
  if (!list.includes(value)) list.push(value);
  return list;
}

function register(registry, name, teamId = '', position = '') {
  const rawName = String(name || '').trim();
  if (!rawName) return '';
  const id = idFor(rawName);
  if (!id) return '';
  const canonical = canonicalLabel(rawName);
  const current = registry[id] && typeof registry[id] === 'object' ? registry[id] : {};
  const aliases = Array.isArray(current.aliases) ? [...current.aliases] : [];
  if (normalizeName(rawName) !== normalizeName(canonical)) addUnique(aliases, rawName);
  const teams = Array.isArray(current.teams) ? [...current.teams] : [];
  const positions = Array.isArray(current.positions) ? [...current.positions] : [];
  addUnique(teams, teamId);
  addUnique(positions, position);
  registry[id] = {
    ...current,
    id,
    name: current.name && normalizeName(current.name) === canonicalKey(current.name) ? current.name : canonical,
    aliases,
    teams,
    positions
  };
  return id;
}

function playerName(entry) {
  return Array.isArray(entry) ? String(entry[0] || '') : String(entry?.name || '');
}

function playerPosition(entry) {
  return Array.isArray(entry) ? String(entry[1] || '') : String(entry?.position || entry?.role || '');
}

function annotateMatch(match, registry) {
  if (!match || typeof match !== 'object') return;
  for (const goal of match.goals || []) {
    const scorer = goal.playerName || goal.scorer || '';
    const assist = goal.assistName || goal.assist || '';
    if (scorer) goal.playerId = goal.playerId || register(registry, scorer, goal.teamId || '');
    if (assist) goal.assistPlayerId = goal.assistPlayerId || register(registry, assist, goal.teamId || '');
  }
  for (const card of match.cards || []) {
    const name = card.playerName || card.name || '';
    if (name) card.playerId = card.playerId || register(registry, name, card.teamId || '');
  }
  for (const event of match.specialEvents || []) {
    const name = event.playerName || event.player || event.name || '';
    if (name) event.playerId = event.playerId || register(registry, name, event.teamId || '');
  }
  for (const sub of match.substitutions || []) {
    const inName = sub.inName || sub.playerIn || sub.in || sub.entered || '';
    const outName = sub.outName || sub.playerOut || sub.out || sub.left || '';
    if (inName) sub.inPlayerId = sub.inPlayerId || register(registry, inName, sub.teamId || '');
    if (outName) sub.outPlayerId = sub.outPlayerId || register(registry, outName, sub.teamId || '');
  }
}

function migrateState(source) {
  const next = clone(source || {});
  const registry = next.playerIds && typeof next.playerIds === 'object' ? { ...next.playerIds } : {};

  for (const team of next.teams || []) {
    for (const player of team.players || []) {
      register(registry, playerName(player), team.id || '', playerPosition(player));
    }
  }

  for (const tournament of next.tournaments || []) {
    for (const match of tournament.matches || []) annotateMatch(match, registry);
    for (const row of tournament.playerScorers || []) {
      const name = Array.isArray(row) ? row[0] : row?.name || row?.playerName || '';
      const teamId = Array.isArray(row) ? row[1] : row?.teamId || '';
      if (name) register(registry, name, teamId);
    }
    for (const row of tournament.playerAssists || []) {
      const name = Array.isArray(row) ? row[0] : row?.name || row?.playerName || '';
      const teamId = Array.isArray(row) ? row[1] : row?.teamId || '';
      if (name) register(registry, name, teamId);
    }
  }

  for (const match of next.friendlies || []) annotateMatch(match, registry);

  next.playerIds = registry;
  next.playerIdentitySchema = SCHEMA;
  return next;
}

function migrationSignature(source) {
  const ids = source?.playerIds && typeof source.playerIds === 'object' ? Object.keys(source.playerIds).sort() : [];
  const eventIds = [];
  for (const tournament of source?.tournaments || []) {
    for (const match of tournament.matches || []) {
      for (const goal of match.goals || []) eventIds.push(goal.playerId || '', goal.assistPlayerId || '');
      for (const card of match.cards || []) eventIds.push(card.playerId || '');
    }
  }
  return JSON.stringify([source?.playerIdentitySchema || '', ids, eventIds]);
}

let pendingCloudSave = false;
let saving = false;

async function applyMigration() {
  const before = core.getState();
  const signatureBefore = migrationSignature(before);
  const next = migrateState(before);
  const signatureAfter = migrationSignature(next);
  if (signatureBefore === signatureAfter) return false;
  core.setState(next);
  pendingCloudSave = true;
  return true;
}

async function persistIfAdmin() {
  if (!pendingCloudSave || saving || !core.canEdit?.()) return false;
  saving = true;
  try {
    await core.saveCloud?.();
    pendingCloudSave = false;
    return true;
  } catch (error) {
    console.warn('La migración de IDs quedó local; Firebase se sincronizará en el próximo guardado autorizado.', error);
    return false;
  } finally {
    saving = false;
  }
}

await applyMigration();
await persistIfAdmin();

document.addEventListener('chute:auth-changed', (event) => {
  if (event.detail?.isAdmin) void persistIfAdmin();
});

window.ChutePlayerIds = Object.freeze({
  schema: SCHEMA,
  idFor,
  canonicalKey,
  canonicalLabel,
  migrateState,
  persistIfAdmin,
  registry: () => core.getState()?.playerIds || {}
});
