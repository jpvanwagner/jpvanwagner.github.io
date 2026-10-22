// Back of house rules: cooking slots, the warmer, plates on the prep counter.
// The kitchen keeps cooking whether or not you're looking at it.
import { G, bus, nextId, ticketById } from '../state.js';
import { CFG } from '../config.js';
import { COOKED, BINS, DISHES, componentInfo } from '../data/menu.js';
import { completeItem, openTickets } from './tickets.js';
import { inRole, skill, hasTrait, f, credit } from './crew.js';

export function doneness(def, t, turned) {
  let q;
  if (t < def.done) q = 0.2 + 0.4 * (t / def.done);
  else if (t <= def.done + def.hold) q = 1;
  else if (t < def.ruin) q = 0.85 - 0.45 * ((t - def.done - def.hold) / (def.ruin - def.done - def.hold));
  else q = 0.1;
  if (def.turn && !turned) q *= 0.7;
  return q;
}

export function cookStage(def, t) {
  if (t < def.done * 0.999) return 'cooking';
  if (t <= def.done + def.hold) return 'perfect';
  if (t < def.ruin) return 'over';
  return 'burnt';
}

export const needsTurn = (def, slot) => def.turn && !slot.turned && slot.t >= def.done * 0.35;

const K = () => G.kitchen;
export const plateById = (id) => K().plates.find((p) => p.id === id);
export const activePlate = () => plateById(K().activePlateId);

export function startPlate(ticketId, itemIndex) {
  const k = K();
  const ticket = ticketById(ticketId);
  const item = ticket?.items[itemIndex];
  if (!item || item.done || item.inProgress) return null;
  if (k.plates.length >= CFG.maxPlates) {
    bus.emit('toast', { kind: 'bad', text: 'The prep counter is full. Send or trash a plate first.' });
    return null;
  }
  item.inProgress = true;
  const plate = { id: nextId(), ticketId, itemIndex, dish: item.key, comps: [], baked: false, bakeQ: null, inOven: false };
  k.plates.push(plate);
  k.activePlateId = plate.id;
  bus.emit('kitchen:change');
  return plate;
}

export function selectPlate(id) { K().activePlateId = id; bus.emit('kitchen:change'); }

export function addBin(key) {
  const plate = activePlate();
  if (!plate) return hint('Start a plate from a ticket first.');
  if (plate.inOven) return hint('That one is in the oven.');
  if (plate.comps.some((c) => c.key === key)) return hint(`${BINS[key].name} is already on the plate.`);
  plate.comps.push({ key, quality: null });
  bus.emit('kitchen:change');
}

export function drop(station, key) {
  const slots = K().slots[station];
  const i = slots.indexOf(null);
  if (i < 0) return hint(`No room — every ${station} spot is busy.`);
  slots[i] = { key, t: 0, turned: false, warned: false };
  bus.emit('kitchen:change');
}

export function bakeActive() {
  const plate = activePlate();
  if (!plate) return hint('Pick a pizza plate first.');
  if (!DISHES[plate.dish].bake) return hint(`${DISHES[plate.dish].short} doesn't go in the oven.`);
  if (plate.baked || plate.inOven) return hint('That pizza has already been baked.');
  if (!plate.comps.some((c) => c.key === 'dough')) return hint('Stretch the dough first.');
  const slots = K().slots.oven;
  const i = slots.indexOf(null);
  if (i < 0) return hint('The oven is full.');
  slots[i] = { key: 'pizza', t: 0, turned: false, warned: false, plateId: plate.id };
  plate.inOven = true;
  bus.emit('kitchen:change');
}

export function turnSlot(station, i) {
  const s = K().slots[station][i];
  if (!s) return;
  const def = COOKED[s.key];
  if (needsTurn(def, s)) { s.turned = true; s.turnedAt = performance.now(); bus.emit('kitchen:change'); return true; }
  return false;
}

// Real ms after a turn/toss during which a click on that slot won't pull it (stops a quick
// second click, or a double-click, from yanking half-cooked food off the heat).
const PULL_GUARD_MS = 600;

export function pullSlot(station, i) {
  const k = K();
  const s = k.slots[station][i];
  if (!s) return;
  const def = COOKED[s.key];
  const q = doneness(def, s.t, s.turned);
  k.slots[station][i] = null;
  if (s.key === 'pizza') {
    const plate = plateById(s.plateId);
    if (plate) { plate.inOven = false; plate.baked = true; plate.bakeQ = q; k.activePlateId = plate.id; }
  } else {
    k.warmer.push({ id: nextId(), key: s.key, quality: q, age: 0 });
  }
  bus.emit('kitchen:change');
  bus.emit('sfx', 'pull');
}

/** Click a slot: turn it if it needs turning, otherwise pull it. */
export function tapSlot(station, i) {
  if (turnSlot(station, i)) return;
  const s = K().slots[station][i];
  if (s?.turnedAt && performance.now() - s.turnedAt < PULL_GUARD_MS) return;
  pullSlot(station, i);
}

export function addFromWarmer(id) {
  const k = K();
  const plate = activePlate();
  if (!plate) return hint('Start a plate from a ticket first.');
  const w = k.warmer.find((x) => x.id === id);
  if (!w) return;
  if (plate.comps.some((c) => c.key === w.key)) return hint(`There's already ${COOKED[w.key].name.toLowerCase()} on that plate.`);
  k.warmer.splice(k.warmer.indexOf(w), 1);
  plate.comps.push({ key: w.key, quality: w.quality });
  bus.emit('kitchen:change');
}

export function trashWarmer(id) {
  const k = K();
  k.warmer = k.warmer.filter((w) => w.id !== id);
  bus.emit('kitchen:change');
}

export function evaluatePlate(plate) {
  const dish = DISHES[plate.dish];
  const keys = plate.comps.map((c) => c.key);
  const missing = dish.build.filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !dish.build.includes(k));
  const cookQs = plate.comps.filter((c) => c.quality != null).map((c) => c.quality);
  if (dish.bake) cookQs.push(plate.baked ? plate.bakeQ : 0.15);
  const cook = cookQs.length ? cookQs.reduce((a, b) => a + b, 0) / cookQs.length : 1;
  const q = Math.max(0.05, Math.min(1, cook * (1 - 0.22 * missing.length) - 0.12 * extra.length));
  return { q, missing, extra, cook };
}

export function sendPlate(id) {
  const k = K();
  const plate = plateById(id);
  if (!plate || plate.inOven) return;
  const ticket = ticketById(plate.ticketId);
  const { q, missing, extra } = evaluatePlate(plate);
  k.plates.splice(k.plates.indexOf(plate), 1);
  if (k.activePlateId === id) k.activePlateId = k.plates[0]?.id ?? null;
  if (ticket && ticket.status === 'open') {
    completeItem(ticket, plate.itemIndex, q);
    G.stats.platesSent++;
    if (q >= 0.95) G.stats.perfectPlates++;
  }
  const note = missing.length ? ` (missing ${missing.map((m) => componentInfo(m).name.toLowerCase()).join(', ')})`
    : extra.length ? ' (something extra on it)' : '';
  bus.emit('toast', { kind: q >= 0.8 ? 'good' : q >= 0.5 ? 'info' : 'bad', text: `${DISHES[plate.dish].short} to the pass: ${Math.round(q * 100)}%${note}` });
  bus.emit('kitchen:change');
}

export function trashPlate(id) {
  const k = K();
  const plate = plateById(id);
  if (!plate) return;
  const ticket = ticketById(plate.ticketId);
  if (ticket) ticket.items[plate.itemIndex].inProgress = false;
  for (const st of Object.keys(k.slots)) {
    k.slots[st] = k.slots[st].map((s) => (s && s.plateId === id ? null : s));
  }
  k.plates.splice(k.plates.indexOf(plate), 1);
  if (k.activePlateId === id) k.activePlateId = k.plates[0]?.id ?? null;
  bus.emit('kitchen:change');
}

function hint(text) { bus.emit('toast', { kind: 'info', text }); return null; }

/** When the line cook pulls a slot: aiming a little into the perfect window, off by up to
 *  ±1.2 windows at Hands 0 and dead on at Hands 10 (perfectionists halve the wobble). */
function cookPullAt(def, cook) {
  const wobble = (Math.random() * 2 - 1) * (1 - f(cook, 'hands')) * 1.2 * (hasTrait(cook, 'perfectionist') ? 0.5 : 1);
  return def.done + def.hold * (0.45 + wobble);
}

/** "Preps ahead" (line cook skill): drop pasta, meatballs and calamari for open tickets. */
let prepWait = 0;
function prepAhead(dt, cook) {
  if ((prepWait -= dt) > 0) return;
  prepWait = hasTrait(cook, 'perfectionist') ? 2.4 : 1.4;
  const k = K();
  const need = {};
  for (const t of openTickets('food')) {
    t.items.forEach((it, idx) => {
      if (it.done) return;
      const plate = k.plates.find((p) => p.ticketId === t.id && p.itemIndex === idx);
      for (const key of DISHES[it.key].build) {
        if (COOKED[key] && key !== 'pizza' && !plate?.comps.some((c) => c.key === key)) need[key] = (need[key] || 0) + 1;
      }
    });
  }
  for (const [key, n] of Object.entries(need)) {
    const station = COOKED[key].station;
    const have = k.slots[station].filter((s) => s && s.key === key).length + k.warmer.filter((w) => w.key === key).length;
    if (have < n && k.slots[station].includes(null)) { drop(station, key); return; }
  }
}

let changeTimer = 0;
export function updateKitchen(dt) {
  const k = K();
  const cook = inRole('lineCook');
  if (cook && skill('lineCook', cook)) prepAhead(dt, cook);
  for (const [station, slots] of Object.entries(k.slots)) {
    slots.forEach((s, i) => {
      if (!s) return;
      s.t += dt;
      const def = COOKED[s.key];
      if (cook) {
        if (needsTurn(def, s) && s.t >= def.done * 0.5) s.turned = true;
        s.pullAt ??= cookPullAt(def, cook);
        if (s.t >= s.pullAt) { pullSlot(station, i); credit(cook); return; }
      }
      if (!s.warned && s.t > def.done + def.hold) {
        s.warned = true;
        bus.emit('toast', { kind: 'bad', text: `Kitchen: the ${def.name.toLowerCase()} is overcooking!` });
        bus.emit('alert', { kind: 'kitchen' });
      }
    });
  }
  // Food in the warmer slowly goes cold after a while.
  for (const w of k.warmer) {
    w.age += dt;
    if (w.age > 25) w.quality = Math.max(0.3, w.quality - 0.01 * dt);
  }
  // Drop plates whose tickets were voided (the party walked out).
  for (const p of [...k.plates]) {
    const t = ticketById(p.ticketId);
    if (!t || t.status === 'void') trashPlate(p.id);
  }
  changeTimer += dt;
  if (changeTimer > 0.1) { changeTimer = 0; bus.emit('kitchen:tick'); }
}
