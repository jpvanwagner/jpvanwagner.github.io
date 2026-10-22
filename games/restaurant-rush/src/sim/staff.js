// Floor staff in the shift: runners carry finished tickets to tables, bussers clear dirty
// tables, the host seats the line. Who does what, and how well, comes from the crew roster
// (src/sim/crew.js): Feet sets walking speed, Charm lifts moods, traits add quirks.
// The cooks and bartenders are figures at their stations; their work happens in
// src/sim/kitchen.js and src/sim/bar.js.
import { CFG } from '../config.js';
import { G, bus, nextId, partyById, tableById, ticketById } from '../state.js';
import { STAFF_HOME, PASS_PICKUP, BAR, KITCHEN, HOST_STAND, tableGeometry } from '../data/layout.js';
import { createActor, walkTo } from './actors.js';
import { isFreeAt } from './pathfind.js';
import { receiveTicket, queue, canSeat, seatParty } from './guests.js';
import { onRole, inRole, staffById, skill, hasTrait, f, credit } from './crew.js';

const BUS_TIME = 2.2;        // seconds to clear a table at Feet 5
const HAND_OFF = 0.5;        // seconds to pick up or set down a ticket
const DROP_CHANCE = 0.07;    // butterfingers: chance per delivery of a fumble

const APRON = { runner: 0xf7f3ec, busser: 0x8f1d21 };
const HOST_JACKET = 0x5e0f13;

export function spawnStaff() {
  // Runners and bussers walk the floor from spots along the pass.
  const floor = [...onRole('runner'), ...onRole('busser')];
  floor.forEach((p, i) => {
    const home = STAFF_HOME[i % STAFF_HOME.length];
    createActor({
      kind: 'staff', role: p.role, staffId: p.id, name: p.name, x: home.x + Math.floor(i / 3) * 0.6, z: home.z, home,
      speed: CFG.staffSpeed * (0.7 + 0.6 * f(p, 'feet')),
      job: null, waitLeft: 0, step: null,
      look: { shirt: 0x161214, apron: APRON[p.role], skin: p.look.skin, hair: p.look.hair },
    });
  });
  const host = inRole('host');
  if (host) {
    createActor({
      kind: 'staff', role: 'host', staffId: host.id, name: host.name, x: HOST_STAND.x, z: HOST_STAND.z + 0.6, face: Math.PI,
      job: null, step: null, look: { shirt: HOST_JACKET, skin: host.look.skin, hair: host.look.hair },
    });
  }
  // You, at the oven and the bar. A hired line cook and bartender work beside you.
  createActor({ kind: 'cook', x: KITCHEN.cookSpot.x, z: KITCHEN.cookSpot.z, face: Math.PI, look: { shirt: 0xf7f3ec } });
  createActor({ kind: 'bartender', x: BAR.bartenderSpot.x, z: BAR.bartenderSpot.z, face: -Math.PI / 2, look: { shirt: 0x161214, apron: 0x8f1d21 } });
  const cook = inRole('lineCook');
  if (cook) createActor({ kind: 'cook', staffId: cook.id, name: cook.name, x: 3.0, z: 1.85, face: Math.PI, look: { shirt: 0xf7f3ec, skin: cook.look.skin, hair: cook.look.hair } });
  const bt = inRole('bartender');
  if (bt) createActor({ kind: 'bartender', staffId: bt.id, name: bt.name, x: BAR.bartenderSpot.x, z: BAR.bartenderSpot.z - 3.2, face: -Math.PI / 2, look: { shirt: 0x161214, apron: 0xc9a24a, skin: bt.look.skin, hair: bt.look.hair } });
  hostWait = 2;
}

export function queueJob(job) {
  if (job.type === 'bus' && G.jobs.some((j) => j.type === 'bus' && j.tableId === job.tableId)) return;
  G.jobs.push({ id: nextId(), takenBy: null, ...job });
  if (job.type === 'bus') { const t = tableById(job.tableId); if (t) t.bussing = true; }
}

export function cancelJobsFor(ticketId) {
  G.jobs = G.jobs.filter((j) => j.ticketId !== ticketId || j.takenBy);
}

/** A free spot beside the table for a staff member to stand at. */
function approachPoint(t, from) {
  const g = tableGeometry(t);
  const cands = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = t.x + Math.sin(a) * (g.hw + 0.8), z = t.z + Math.cos(a) * (g.hd + 0.8);
    if (isFreeAt(x, z) && !g.seats.some((s) => Math.hypot(s.x - x, s.z - z) < 0.4)) cands.push({ x, z });
  }
  if (!cands.length) return { x: t.x, z: t.z + g.hd + 0.8 };
  cands.sort((a, b) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z));
  return cands[0];
}

const handOff = (p) => HAND_OFF * (hasTrait(p, 'chatterbox') ? 1.8 : 1);

function goToPickup(s, ticket) {
  const pickup = ticket.kind === 'food' ? PASS_PICKUP : BAR.pickup;
  s.step = 'toPickup';
  walkTo(s, pickup, () => { s.step = 'pickup'; s.waitLeft = handOff(staffById(s.staffId)); s.face = ticket.kind === 'food' ? Math.PI : Math.PI / 2; });
}

function takeJob(s) {
  const bussers = onRole('busser').length > 0;
  const allowed = s.role === 'busser' ? ['bus'] : bussers ? ['deliver'] : ['deliver', 'bus'];
  // Deliveries first, oldest first.
  const job = G.jobs.find((j) => !j.takenBy && j.type === 'deliver' && allowed.includes('deliver'))
    || G.jobs.find((j) => !j.takenBy && allowed.includes(j.type));
  if (!job) return;
  job.takenBy = s.id;
  s.job = job;
  if (job.type === 'deliver') {
    goToPickup(s, ticketById(job.ticketId));
  } else {
    const t = tableById(job.tableId);
    const p = staffById(s.staffId);
    s.step = 'toTable';
    const secs = BUS_TIME * (1.45 - 0.9 * f(p, 'feet')) * (skill('busser', p) ? 0.5 : 1) * (hasTrait(p, 'chatterbox') ? 1.3 : 1);
    walkTo(s, approachPoint(t, s), () => { s.step = 'busing'; s.waitLeft = Math.max(0.6, secs); faceTable(s, t); });
  }
}

function faceTable(s, t) { s.face = Math.atan2(t.x - s.x, t.z - s.z); }

function finishJob(s) {
  G.jobs = G.jobs.filter((j) => j !== s.job);
  s.job = null;
  s.step = null;
  s.carrying = null;
  walkTo(s, s.home, () => { s.face = Math.PI; });
}

export function updateStaff(dt) {
  updateHost(dt);
  for (const s of G.actors) {
    if (s.kind !== 'staff' || s.role === 'host') continue;
    if (!s.job) { takeJob(s); continue; }
    const job = s.job;
    const person = staffById(s.staffId);
    if (s.waitLeft > 0) { s.waitLeft -= dt; if (s.waitLeft > 0) continue; }

    if (job.type === 'deliver') {
      const ticket = ticketById(job.ticketId);
      const p = ticket && partyById(ticket.partyId);
      if (!ticket || ticket.status === 'void' || !p || p.state === 'leaving') {
        if (ticket && ticket.status !== 'delivered') ticket.status = 'void';
        finishJob(s); continue;
      }
      if (s.step === 'pickup') {
        s.carrying = ticket.kind;
        ticket.status = 'carrying';
        bus.emit('ticket:update', ticket);
        const t = tableById(ticket.tableId);
        s.step = 'toTable';
        walkTo(s, approachPoint(t, s), () => { s.step = 'serve'; s.waitLeft = handOff(person); faceTable(s, t); });
      } else if (s.step === 'serve') {
        // Butterfingers: once per delivery at most, the tray hits the floor and it's back to the pass.
        if (hasTrait(person, 'butterfingers') && !job.dropped && Math.random() < DROP_CHANCE) {
          job.dropped = true;
          s.carrying = null;
          p.mood = Math.max(0, p.mood - 5);
          bus.emit('toast', { kind: 'bad', text: `${s.name} dropped the ${ticket.tableLabel} ${ticket.kind === 'food' ? 'plates' : 'drinks'}! Going back for more.` });
          goToPickup(s, ticket);
          continue;
        }
        ticket.status = 'delivered';
        receiveTicket(p, ticket);
        // A good word at the table: Charm above 4 lifts the mood, chatterboxes more so.
        const lift = (person ? (person.stats.charm - 4) * 0.8 : 0) + (hasTrait(person, 'chatterbox') ? 4 : 0)
          + (ticket.kind === 'food' && skill('runner', person) ? 5 : 0);
        if (lift) p.mood = Math.max(0, Math.min(100, p.mood + lift));
        credit(person);
        bus.emit('ticket:update', ticket);
        finishJob(s);
      }
    } else if (job.type === 'bus' && s.step === 'busing') {
      const t = tableById(job.tableId);
      if (t) { t.state = 'clean'; t.items = []; t.bussing = false; }
      bus.emit('table:clean', t);
      credit(person);
      finishJob(s);
      s.carrying = 'dishes';
      setTimeoutSim(s, 2.5, () => { s.carrying = null; });
    }
  }
}

// ── The host ────────────────────────────────────────────────────────────────
// Seats the longest-waiting party that has a table that fits. Higher Charm seats faster and
// picks the snuggest table; low Charm sometimes wastes a big table on a small party.
// A party you've selected yourself is left for you.
let hostWait = 2;
function updateHost(dt) {
  const hp = inRole('host');
  if (!hp) return;
  if ((hostWait -= dt) > 0) return;
  hostWait = 0.5;
  for (const p of queue()) {
    if (p.state !== 'queue' || p.id === G.selectedPartyId) continue;
    const fits = G.tables.filter((t) => canSeat(p, t)).sort((a, b) => a.cap - b.cap);
    if (!fits.length) continue;
    const sloppy = Math.random() < (1 - f(hp, 'charm')) * 0.5;
    const t = sloppy ? fits[fits.length - 1] : fits[0];
    if (!seatParty(p, t, { by: hp.name })) continue;
    if (skill('host', hp)) p.mood = Math.min(100, p.mood + 8);
    credit(hp);
    hostWait = 7.5 - 5 * f(hp, 'charm');
    return;
  }
}

/** How fast guests in line lose patience (1 = normal). The host's Charm and a local face help. */
export function queuePatience() {
  const hp = inRole('host');
  let k = hp ? 1 - 0.4 * f(hp, 'charm') : 1;
  if (['host', 'runner', 'busser'].some((r) => onRole(r).some((p) => hasTrait(p, 'localFace')))) k *= 0.75;
  return k;
}

// Tiny helper so the dish tub disappears a moment after bussing.
function setTimeoutSim(s, secs, fn) { s.after = { left: secs, fn }; }
export function tickAfters(dt) {
  for (const a of G.actors) {
    if (a.after && (a.after.left -= dt) <= 0) { const fn = a.after.fn; a.after = null; fn(); }
  }
}
