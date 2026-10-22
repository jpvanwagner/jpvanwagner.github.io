// Parties: arrival, the waiting line, seating, ordering, eating, paying, leaving — and mood.
import { CFG } from '../config.js';
import { G, bus, nextId, partyById, tableById } from '../state.js';
import { DOOR, QUEUE_SPOTS, tableGeometry } from '../data/layout.js';
import { DRINKS, FOOD_KEYS, DRINK_KEYS } from '../data/menu.js';
import { SURNAMES, SHIRTS, SKIN, HAIR, pick, rand } from '../data/names.js';
import { createActor, removeActor, walkTo } from './actors.js';
import { cancelTicketsFor, createTickets } from './tickets.js';
import { queueJob, queuePatience } from './staff.js';
import { onRole } from './crew.js';
import { dishPrice, dishTaste } from './fame.js';

const SIZE_WEIGHTS = [[1, 10], [2, 38], [3, 16], [4, 22], [5, 7], [6, 7]];

function rollSize() {
  let r = Math.random() * SIZE_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  for (const [n, w] of SIZE_WEIGHTS) { if ((r -= w) <= 0) return n; }
  return 2;
}

export const queue = () => G.parties.filter((p) => p.state === 'arriving' || p.state === 'queue')
  .sort((a, b) => a.arrivedAt - b.arrivedAt);

function queueSlotOffset(i) {
  // Members cluster beside their spot in two short rows.
  return { dx: 0.15 + (i % 3) * 0.38, dz: i < 3 ? -0.2 : 0.22 };
}

function layoutQueue() {
  queue().forEach((p, qi) => {
    const spot = QUEUE_SPOTS[Math.min(qi, QUEUE_SPOTS.length - 1)];
    if (p.queueIndex === qi) return;
    p.queueIndex = qi;
    p.members.forEach((m, i) => {
      const o = queueSlotOffset(i);
      walkTo(m, { x: spot.x + o.dx, z: spot.z + o.dz }, (a) => { a.face = Math.PI; });
    });
  });
}

/** A new party at the door. `critic: true` sends the day's food critic (always alone). */
export function spawnParty({ critic = false } = {}) {
  const waiting = queue().length;
  if (waiting >= CFG.maxQueue && !critic) {
    G.stats.turnedAway++;
    bus.emit('toast', { kind: 'bad', text: 'A party saw the line out the door and left.' });
    return;
  }
  const size = critic ? 1 : rollSize();
  const p = {
    id: nextId(), name: pick(SURNAMES), size, mood: CFG.moodStart, state: 'arriving', stateT: 0, critic,
    arrivedAt: G.time, queueIndex: -1, tableId: null, members: [],
    // What each guest actually wants. ~70% order a drink.
    wants: Array.from({ length: size }, (_, seat) => ({
      seat,
      food: pick(FOOD_KEYS),
      drink: critic || Math.random() < 0.7 ? pick(DRINK_KEYS) : null,
    })),
    entered: null, served: [], foodIn: false, drinksIn: false, hasDrinks: false,
    eatLeft: 0, complaint: null, complained: false, bill: 0,
  };
  const outside = DOOR.outside;
  for (let i = 0; i < size; i++) {
    p.members.push(createActor({
      kind: 'guest', partyId: p.id, x: outside.x + (i % 2) * 0.3, z: outside.z + i * 0.4,
      speed: CFG.walkSpeed * rand(0.9, 1.1),
      look: { shirt: critic ? 0x161214 : pick(SHIRTS), skin: pick(SKIN), hair: pick(HAIR), tall: rand(0.92, 1.08), critic },
    }));
  }
  G.parties.push(p);
  G.stats.guests += size;
  setState(p, 'queue');
  layoutQueue();
  bus.emit('party:arrive', p);
  if (critic) bus.emit('toast', { kind: 'info', text: `A food critic just walked in (${p.name}). Their review counts five times over.` });
}

function setState(p, s) {
  p.state = s;
  p.stateT = 0;
  bus.emit('party:state', p);
}

export function canSeat(p, t) {
  return p && t && t.state === 'clean' && !t.partyId && t.cap >= p.size
    && (p.state === 'queue' || p.state === 'arriving');
}

export function seatParty(p, t, { by = null } = {}) {
  if (!canSeat(p, t)) return false;
  p.tableId = t.id;
  t.partyId = p.id;
  t.state = 'occupied';
  p.mood = Math.min(100, p.mood + CFG.seatedBoost);
  const seats = tableGeometry(t).seats;
  let arrived = 0;
  setState(p, 'toTable');
  p.members.forEach((m, i) => {
    const s = seats[i];
    walkTo(m, s, (a) => {
      a.seated = true;
      a.face = s.face;
      if (++arrived === p.size) {
        p.menuLeft = rand(...CFG.menuTime);
        setState(p, 'menu');
      }
    });
  });
  if (G.selectedPartyId === p.id) G.selectedPartyId = null;
  layoutQueue();
  bus.emit('toast', { kind: 'info', text: `${by ? `${by} seated` : 'Seated'} the ${p.name} party (${p.size}) at ${t.label}.` });
  return true;
}

/** The server took the order: `entered` is [{seat, food, drink}] as the player keyed it in. */
export function submitOrder(p, entered) {
  p.entered = entered;
  p.hasDrinks = entered.some((e) => e.drink);
  p.drinksIn = !p.hasDrinks;
  createTickets(p, entered);
  setState(p, 'waitFood');
}

/** A runner set a finished ticket down at the table. */
export function receiveTicket(p, ticket) {
  const t = tableById(p.tableId);
  let delta = 0, wrong = 0, bad = 0;
  for (const it of ticket.items) {
    const want = p.wants[it.seat];
    const wanted = ticket.kind === 'food' ? want.food : want.drink;
    const right = it.key === wanted;
    p.served.push({ ...it, kind: ticket.kind, right });
    if (!right) { wrong++; delta -= 14; continue; }
    if (it.quality < 0.45) bad++;
    delta += (it.quality - 0.6) * 28;
    if (ticket.kind === 'food') { delta += dishTaste(it.key); p.bill += dishPrice(it.key); }
    else p.bill += DRINKS[it.key].price;
  }
  if (t) t.items.push(...ticket.items.map((it) => ({ kind: ticket.kind, key: it.key, seat: it.seat })));
  p.mood = Math.max(0, Math.min(100, p.mood + delta / Math.max(1, ticket.items.length) * 1.6));
  if (wrong) {
    G.stats.wrongItems += wrong;
    bus.emit('toast', { kind: 'bad', text: `${t?.label}: "This isn't what I ordered!" (${wrong} wrong)` });
    if (!p.complained) p.complaint = 'wrong';
  } else if (bad && !p.complained && Math.random() < 0.6) {
    p.complaint = ticket.kind === 'food' ? 'quality' : 'drinks';
  }
  if (ticket.kind === 'food') {
    p.foodIn = true;
    p.eatLeft = rand(...CFG.eatTime);
    setState(p, 'eating');
  } else {
    p.drinksIn = true;
    bus.emit('party:state', p);
  }
}

export function presentCheck(p) {
  if (p.state !== 'readyCheck') return;
  setState(p, 'paying');
  p.payLeft = CFG.payTime;
}

function finishPaying(p) {
  const tipPct = CFG.tipMax * Math.max(0, Math.min(1, (p.mood - 20) / 80));
  const tip = Math.round(p.bill * tipPct);
  G.stats.revenue += p.bill;
  G.stats.tips += tip;
  G.stats.served += p.size;
  rate(p);
  bus.emit('money', { amount: p.bill + tip, tableId: p.tableId });
  bus.emit('toast', { kind: 'good', text: `${tableById(p.tableId)?.label} paid $${p.bill} + $${tip} tip.` });
  leave(p);
}

function rate(p, forced) {
  const stars = forced ?? Math.max(1, Math.min(5, Math.round((1 + (p.mood / 100) * 4) * 2) / 2));
  G.stats.ratings.push(stars);
  p.stars = stars;
  if (p.critic) {
    G.stats.critic = { stars, name: p.name };
    bus.emit('toast', { kind: stars >= 4 ? 'good' : stars >= 3 ? 'info' : 'bad', text: `The critic left: ${stars} stars. ${stars >= 4 ? 'The review will be glowing.' : stars >= 3 ? 'Polite, but no rave.' : 'Ouch. That review will sting.'}` });
  }
}

export function leave(p, { walkout = false } = {}) {
  const t = tableById(p.tableId);
  if (walkout) {
    G.stats.walkouts++;
    rate(p, 1);
  }
  // Whatever they never received comes off the rails (walkouts, or the 2:30 hard stop).
  cancelTicketsFor(p.id);
  if (t) {
    t.partyId = null;
    t.state = 'dirty';
    if (!t.items.length) t.items.push({ kind: 'menu' });
    if (onRole('busser').length) queueJob({ type: 'bus', tableId: t.id });
  }
  if (G.selectedPartyId === p.id) G.selectedPartyId = null;
  setState(p, 'leaving');
  p.complaint = null;
  let gone = 0;
  p.members.forEach((m, i) => {
    walkTo(m, { x: DOOR.x + (i % 2) * 0.3, z: DOOR.z }, () => {
      walkTo(m, DOOR.outside, () => {
        removeActor(m);
        if (++gone === p.size) G.parties.splice(G.parties.indexOf(p), 1);
      }, { direct: true });
    });
  });
  layoutQueue();
}

const COMPLAINT_FOR = { readyOrder: 'order', waitFood: 'slow', readyCheck: 'check', eating: 'slow' };

export function updateParties(dt) {
  for (const p of [...G.parties]) {
    p.stateT += dt;
    const drain = CFG.drain[p.state === 'waitFood' && p.foodIn ? 'eating' : p.state];
    if (drain && p.stateT > drain.grace) {
      // The host and a familiar face keep the line patient; the critic is harder to please.
      const k = (p.state === 'queue' || p.state === 'arriving' ? queuePatience() : 1) * (p.critic ? 1.4 : 1);
      p.mood -= drain.rate * k * dt;
    }
    // Waiting on drinks while eating is mildly annoying.
    if (p.state === 'eating' && !p.drinksIn) p.mood -= 0.4 * dt;
    p.mood = Math.max(0, Math.min(100, p.mood));

    switch (p.state) {
      case 'menu':
        if ((p.menuLeft -= dt) <= 0) { setState(p, 'readyOrder'); bus.emit('alert', { kind: 'order', party: p }); }
        break;
      case 'eating':
        p.eatLeft -= dt;
        if (p.eatLeft <= 0 && p.drinksIn) { setState(p, 'readyCheck'); bus.emit('alert', { kind: 'check', party: p }); }
        break;
      case 'paying':
        if ((p.payLeft -= dt) <= 0) finishPaying(p);
        break;
    }

    const seated = ['readyOrder', 'waitFood', 'eating', 'readyCheck'].includes(p.state);
    if (seated && !p.complained && !p.complaint && p.mood < CFG.complainBelow) {
      p.complaint = COMPLAINT_FOR[p.state] || 'slow';
      bus.emit('toast', { kind: 'bad', text: `${tableById(p.tableId)?.label} wants to speak to the manager.` });
    }
    if (p.mood <= 0 && p.state !== 'leaving' && p.state !== 'paying') {
      const where = p.state === 'queue' || p.state === 'arriving' ? 'from the line' : `from ${tableById(p.tableId)?.label}`;
      bus.emit('toast', { kind: 'bad', text: `The ${p.name} party stormed out ${where}.` });
      leave(p, { walkout: true });
    }
  }
}

/** Manager visit: resolve a complaint with one of three responses. */
export const COMPLAINT_TEXT = {
  order: 'We have been sitting here forever and nobody has taken our order.',
  slow: 'Where is our food? We ordered ages ago.',
  check: 'We just want to pay and go. Can we get the check?',
  wrong: 'This is not what we ordered.',
  quality: 'The food was... not great. Burnt, honestly.',
  drinks: 'These drinks taste wrong.',
};

export function resolveComplaint(p, choice) {
  const bill = p.wants.reduce((s, w) => s + dishPrice(w.food) + (w.drink ? DRINKS[w.drink].price : 0), 0);
  const drinks = p.wants.reduce((s, w) => s + (w.drink ? DRINKS[w.drink].price : 0), 0);
  let boost = 0, cost = 0;
  if (choice === 'apologize') boost = 18;
  if (choice === 'dessert') { boost = 35; cost = 6 * p.size; }
  if (choice === 'comp') { boost = 60; cost = Math.round((bill - drinks) * 0.5 + drinks * 0.5); }
  p.mood = Math.min(100, p.mood + boost);
  p.complaint = null;
  p.complained = true;
  G.stats.comps += cost;
  return { boost, cost };
}

export { partyById };
