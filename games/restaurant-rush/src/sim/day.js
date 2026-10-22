// The working day: lunch and dinner. Each service has a rush in the middle that you run, and
// quiet hours either side where the crew runs the room on its own (src/sim/autopilot.js) while
// the clock moves faster. Between the two services the place closes for the afternoon.
// Used by the game (src/main.js) and the test bot (tests/simbot.mjs), so both play the same day.
import { CFG } from '../config.js';
import { G, bus, has } from '../state.js';
import { spawnParty, updateParties, queue, leave } from './guests.js';
import { updateActors } from './actors.js';
import { updateStaff, tickAfters } from './staff.js';
import { updateKitchen } from './kitchen.js';
import { updateBar } from './bar.js';
import { updateAutopilot, resetAutopilot } from './autopilot.js';
import { rank, rankIndex, CRITIC_FROM_RANK } from './fame.js';

// Times are game minutes since midnight. `rush`: when you're on. `peak`/`width`: the arrival
// curve (busiest at the peak, calm `width` minutes either side). `busy`: dinner draws more.
const T = (h, m = 0) => h * 60 + m;
export const SERVICES = [
  { id: 'lunch', name: 'Lunch', open: T(11), rush: [T(12), T(13, 30)], peak: T(12, 40), width: 45, lastArrival: T(14), close: T(14, 30), busy: 1 },
  { id: 'dinner', name: 'Dinner', open: T(17), rush: [T(18, 30), T(20, 30)], peak: T(19, 30), width: 60, lastArrival: T(21, 30), close: T(22), busy: 1.15 },
];
/** How much faster the clock runs in quiet hours while the crew has it. */
export const QUIET_SPEED = 4;

export const service = () => SERVICES[G.service] || SERVICES[0];
export const inRush = () => G.clock >= service().rush[0] && G.clock < service().rush[1];
/** Quiet hours with the crew in charge (unless you've taken over). */
export const crewRunning = () => G.running && !inRush() && !G.takeOver && !G.serviceOver;
export const phase = () => (inRush() ? 'rush' : G.clock < service().rush[0] ? 'before' : 'after');

/** Open a service: lunch (0) or dinner (1). */
export function startService(i) {
  const s = SERVICES[i];
  Object.assign(G, {
    service: i, clock: s.open, nextArrival: G.time + 3, takeOver: false, doorsLocked: false, serviceOver: false,
    phaseSeen: null, serviceStart: { ...G.stats, ratings: G.stats.ratings.length },
  });
  // From the second rank on, the food critic comes once a day, during one of the rushes.
  if (i === 0) G.criticService = rankIndex() >= CRITIC_FROM_RANK ? (Math.random() < 0.5 ? 0 : 1) : null;
  G.criticAt = G.criticService === i ? s.rush[0] + Math.random() * (s.rush[1] - s.rush[0]) * 0.7 : null;
  resetAutopilot();
}

function arrivalGap() {
  const s = service();
  const x = (G.clock - s.peak) / s.width;
  const busy = Math.exp(-x * x);
  let mean = CFG.arrivalCalm + (CFG.arrivalRush - CFG.arrivalCalm) * busy;
  mean /= rank().busy * s.busy;   // word of mouth brings bigger crowds; dinner draws more
  if (has('ads')) mean /= 1.25;
  return mean * (0.6 + Math.random() * 0.8);
}

/**
 * Advance the day by `dt` sim seconds. Returns 'service-over' when lunch has finished (everyone
 * gone), 'day-over' after dinner, otherwise null.
 */
export function simulateDay(dt) {
  const s = service();
  G.time += dt;
  G.clock += dt / CFG.secondsPerGameMinute;
  if (G.clock < s.lastArrival && G.time >= G.nextArrival) {
    spawnParty();
    G.nextArrival = G.time + arrivalGap();
  }
  if (G.criticAt && G.clock >= G.criticAt) { G.criticAt = null; spawnParty({ critic: true }); }
  const ph = phase();
  if (ph !== G.phaseSeen) {
    if (G.phaseSeen !== null || ph === 'rush') bus.emit('phase', { phase: ph, service: s });
    G.phaseSeen = ph;
    if (ph !== 'rush') G.takeOver = false;   // each quiet stretch starts with the crew in charge
  }
  if (G.clock >= s.lastArrival && !G.doorsLocked) {
    G.doorsLocked = true;
    bus.emit('toast', { kind: 'info', text: `${s.name}: the doors are locked. Finish the tables still dining.` });
  }
  if (G.clock >= s.close) for (const p of queue()) leave(p);   // nobody blames you for the line
  updateActors(dt);
  updateParties(dt);
  updateStaff(dt);
  tickAfters(dt);
  updateKitchen(dt);
  updateBar(dt);
  updateAutopilot(dt, crewRunning());
  const done = G.clock >= s.lastArrival && G.parties.length === 0;
  const hardStop = G.clock >= s.close + 30;
  if ((done || hardStop) && !G.serviceOver) {
    if (hardStop) G.parties.forEach((p) => p.state !== 'leaving' && leave(p));
    G.serviceOver = true;
    return G.service < SERVICES.length - 1 ? 'service-over' : 'day-over';
  }
  return null;
}

/** Between services: the afternoon crew resets the room. */
export function resetForNextService() {
  for (const t of G.tables) { t.state = 'clean'; t.partyId = null; t.items = []; t.bussing = false; }
  G.jobs = [];
  G.tickets = G.tickets.filter((t) => t.status !== 'delivered' && t.status !== 'void');
  G.kitchen.warmer = [];
}

/** What a service took in, from its start snapshot. */
export function serviceSummary() {
  const a = G.serviceStart, b = G.stats;
  const ratings = b.ratings.slice(a.ratings);
  return {
    revenue: b.revenue - a.revenue, tips: b.tips - a.tips, served: b.served - a.served,
    walkouts: b.walkouts - a.walkouts + b.turnedAway - a.turnedAway,
    rating: ratings.length ? ratings.reduce((x, y) => x + y, 0) / ratings.length : 0,
  };
}
