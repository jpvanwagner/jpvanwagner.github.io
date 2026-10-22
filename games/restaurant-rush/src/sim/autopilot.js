// The crew running the room in the quiet hours (see src/sim/day.js): everything you'd normally
// do yourself, done on its own at a steady pace and a decent (not perfect) standard. Your hired
// staff still do their own jobs as usual; this covers the rest. Better staff, better results:
// food quality follows the line cook's Hands, drinks the bartender's Flair.
//
// Whatever the crew has started, it finishes, even after the rush begins and you take over.
import { G } from '../state.js';
import { DISHES } from '../data/menu.js';
import { queue, canSeat, seatParty, submitOrder, presentCheck, resolveComplaint } from './guests.js';
import { queueJob } from './staff.js';
import { completeItem } from './tickets.js';
import { inRole, f, credit } from './crew.js';

const timers = new Map();   // key → { left, run }
const after = (key, secs, run) => { if (!timers.has(key)) timers.set(key, { left: secs, run }); };

export function resetAutopilot() { timers.clear(); }

// How long the crew takes over each job (sim seconds), and how good the result is.
const SEAT = 3, ORDER = 3, CHECK = 2.5, CALM = 3, DRINK = 7;
const cookSeconds = (key) => 11 + (DISHES[key].bake ? 4 : 0);
const BASE_QUALITY = 0.72;
function quality(kind) {
  const p = inRole(kind === 'food' ? 'lineCook' : 'bartender');
  return Math.min(1, BASE_QUALITY + 0.25 * f(p, kind === 'food' ? 'hands' : 'flair') + (Math.random() - 0.5) * 0.08);
}

/** `active`: true in the quiet hours. Timers already running always finish. */
export function updateAutopilot(dt, active) {
  if (active) plan();
  for (const [key, t] of timers) {
    if ((t.left -= dt) > 0) continue;
    timers.delete(key);
    t.run();
  }
}

function plan() {
  // Seat the line (the host does this when there is one).
  if (!inRole('host')) {
    const p = queue().find((x) => x.state === 'queue' && x.id !== G.selectedPartyId && G.tables.some((t) => canSeat(x, t)));
    if (p) after('seat', SEAT, () => {
      const t = G.tables.filter((x) => canSeat(p, x)).sort((a, b) => a.cap - b.cap)[0];
      if (t) seatParty(p, t, { by: 'The crew' });
    });
  }
  for (const p of G.parties) {
    if (p.state === 'readyOrder') after(`order${p.id}`, ORDER, () => { if (p.state === 'readyOrder') submitOrder(p, p.wants.map((w) => ({ ...w }))); });
    if (p.state === 'readyCheck') after(`check${p.id}`, CHECK, () => presentCheck(p));
    if (p.complaint) after(`calm${p.id}`, CALM, () => { if (p.complaint) resolveComplaint(p, 'apologize'); });
  }
  for (const t of G.tables) if (t.state === 'dirty' && !t.bussing) queueJob({ type: 'bus', tableId: t.id });
  // Food and drinks nobody is working on (not your plates, not the drink in your glass).
  for (const t of G.tickets) {
    if (t.status !== 'open') continue;
    t.items.forEach((it, i) => {
      if (it.done || it.inProgress) return;
      if (t.kind === 'drink' && G.bar.target?.ticketId === t.id && G.bar.target.idx === i) return;
      it.inProgress = true;
      it.crew = true;
      after(`item${t.id}:${i}`, t.kind === 'food' ? cookSeconds(it.key) : DRINK, () => {
        it.inProgress = false;
        if (t.status !== 'open' || it.done) return;
        completeItem(t, i, quality(t.kind));
        if (t.kind === 'food') { G.stats.platesSent++; credit(inRole('lineCook')); }
        else { G.stats.drinksMade++; credit(inRole('bartender')); }
      });
    });
  }
}
