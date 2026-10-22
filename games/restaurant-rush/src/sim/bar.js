// Bar rules: one working glass at a time. Pick a drink off a ticket, build it, serve it.
// A hired bartender works the tickets you aren't on, and sets out glass and ice for yours.
import { G, bus, ticketById } from '../state.js';
import { DRINKS, GLASSES, POURS, GARNISHES } from '../data/menu.js';
import { completeItem } from './tickets.js';
import { inRole, skill, hasTrait, f, credit } from './crew.js';

const B = () => G.bar;
const changed = () => bus.emit('bar:change');

export function selectTarget(ticketId, idx) {
  const b = B();
  const t = ticketById(ticketId);
  if (!t || t.items[idx].done) return;
  if (t.items[idx].inProgress) return bus.emit('toast', { kind: 'info', text: `${inRole('bartender')?.name || 'Someone'} is already making that one.` });
  b.target = { ticketId, idx };
  if (inRole('bartender') && !b.glass && !Object.keys(b.pours).length) {
    const def = DRINKS[t.items[idx].key];
    b.glass = def.glass;
    b.ice = def.ice;
  }
  changed();
}

export const targetDrink = () => {
  const b = B();
  if (!b.target) return null;
  const t = ticketById(b.target.ticketId);
  if (!t || t.status !== 'open' || t.items[b.target.idx].done) { b.target = null; return null; }
  return { ticket: t, item: t.items[b.target.idx], def: DRINKS[t.items[b.target.idx].key] };
};

export function setGlass(g) {
  const b = B();
  if (b.glass && totalPoured() > 0) return bus.emit('toast', { kind: 'info', text: 'Dump the glass before switching.' });
  b.glass = b.glass === g ? null : g;
  changed();
}

export function toggleIce() {
  const b = B();
  if (!b.glass) return bus.emit('toast', { kind: 'info', text: 'Pick a glass first.' });
  b.ice = !b.ice;
  changed();
}

export const totalPoured = () => Object.values(B().pours).reduce((a, b) => a + b, 0);

/** Called every frame while a pour button is held. Returns false if nothing poured. */
export function pour(key, dt) {
  const b = B();
  if (!b.glass) { bus.emit('toast', { kind: 'info', text: 'Pick a glass first.' }); return false; }
  const cap = GLASSES[b.glass].cap;
  if (totalPoured() >= cap + 0.25) return false; // overflowing onto the mat
  b.pours[key] = (b.pours[key] || 0) + POURS[key].rate * dt;
  changed();
  return true;
}

export function shake() {
  const b = B();
  if (!b.glass || totalPoured() <= 0) return bus.emit('toast', { kind: 'info', text: 'Nothing to shake yet.' });
  b.shaken = true;
  bus.emit('bar:shake');
  changed();
}

export function setGarnish(g) {
  const b = B();
  if (!b.glass) return bus.emit('toast', { kind: 'info', text: 'Pick a glass first.' });
  b.garnish = b.garnish === g ? null : g;
  changed();
}

export function dump() {
  Object.assign(B(), { glass: null, ice: false, pours: {}, shaken: false, garnish: null });
  changed();
}

export function evaluateDrink(def, b = B()) {
  const lines = [];
  let s = 0;
  const glassOk = b.glass === def.glass;
  s += glassOk ? 20 : 0;
  lines.push([glassOk, `Glass: ${GLASSES[def.glass].name}`]);
  const iceOk = !!b.ice === !!def.ice;
  s += iceOk ? 10 : 0;
  lines.push([iceOk, def.ice ? 'Ice' : 'No ice']);
  const req = Object.entries(def.pours);
  let pourScore = 0;
  for (const [k, tgt] of req) {
    const got = b.pours[k] || 0;
    const err = Math.abs(got - tgt) / tgt;
    pourScore += Math.max(0, 1 - err * 1.6);
    lines.push([err < 0.2, `${POURS[k].name}: ${got.toFixed(1)} / ${tgt} oz`]);
  }
  s += (pourScore / req.length) * 50;
  for (const [k, amt] of Object.entries(b.pours)) {
    if (!def.pours[k] && amt > 0.15) { s -= 12; lines.push([false, `Shouldn't have ${POURS[k].name}`]); }
  }
  if (b.glass && totalPouredOf(b) > GLASSES[b.glass].cap) { s -= 10; lines.push([false, 'Overpoured']); }
  const shakeOk = !!def.shake === !!b.shaken;
  s += shakeOk ? 10 : def.shake ? 0 : 5;
  if (def.shake || b.shaken) lines.push([shakeOk, def.shake ? 'Shaken' : 'Should not be shaken']);
  const garnishOk = (def.garnish || null) === (b.garnish || null);
  s += garnishOk ? 10 : 0;
  if (def.garnish || b.garnish) lines.push([garnishOk, def.garnish ? `Garnish: ${GARNISHES[def.garnish].name}` : 'No garnish']);
  return { q: Math.max(0.05, Math.min(1, s / 100)), lines };
}

const totalPouredOf = (b) => Object.values(b.pours).reduce((a, x) => a + x, 0);

export function serveDrink() {
  const tgt = targetDrink();
  const b = B();
  if (!tgt) return bus.emit('toast', { kind: 'info', text: 'Pick a drink from a ticket first.' });
  if (!b.glass) return bus.emit('toast', { kind: 'info', text: 'There is nothing to serve.' });
  const { q } = evaluateDrink(tgt.def);
  completeItem(tgt.ticket, b.target.idx, q);
  G.stats.drinksMade++;
  bus.emit('toast', { kind: q >= 0.8 ? 'good' : q >= 0.5 ? 'info' : 'bad', text: `${tgt.def.short || tgt.def.name} in the well: ${Math.round(q * 100)}%` });
  b.target = null;
  dump();
  // Jump to the next open drink so you can keep going.
  const next = G.tickets.find((t) => t.kind === 'drink' && t.status === 'open' && t.items.some((i) => !i.done && !i.inProgress));
  if (next) selectTarget(next.id, next.items.findIndex((i) => !i.done && !i.inProgress));
}

// ── The hired bartender ─────────────────────────────────────────────────────
// Takes the oldest drink you aren't working on. Flair sets both speed (about 9 s a drink at
// Flair 5) and quality; perfectionists are slower and better; showboats earn extra tips.
const MIX_SECONDS = 9;
export function updateBar(dt) {
  const bt = inRole('bartender');
  const b = B();
  if (!bt) { b.auto = null; return; }
  const a = b.auto;
  if (a) {
    const t = ticketById(a.ticketId);
    const it = t?.items[a.idx];
    if (!t || t.status !== 'open' || !it || it.done) { if (it) it.inProgress = false; b.auto = null; return; }
    if ((a.left -= dt) > 0) return;
    it.inProgress = false;
    const fl = f(bt, 'flair');
    const q = Math.max(0.2, Math.min(1, 0.52 + 0.45 * fl + (Math.random() * 2 - 1) * (1 - fl) * 0.25 + (hasTrait(bt, 'perfectionist') ? 0.08 : 0)));
    completeItem(t, a.idx, q);
    G.stats.drinksMade++;
    credit(bt);
    if (hasTrait(bt, 'showboat')) {
      const tip = Math.max(1, Math.round(DRINKS[it.key].price * 0.25));
      G.stats.tips += tip;
      bus.emit('toast', { kind: 'good', text: `${bt.name} flips the bottle for ${t.tableLabel}: +$${tip} in tips.` });
    }
    b.auto = null;
    bus.emit('bar:change');
    return;
  }
  for (const t of G.tickets) {
    if (t.kind !== 'drink' || t.status !== 'open') continue;
    const idx = t.items.findIndex((it, i) => !it.done && !it.inProgress && !(b.target && b.target.ticketId === t.id && b.target.idx === i));
    if (idx < 0) continue;
    t.items[idx].inProgress = true;
    const secs = MIX_SECONDS * (1.4 - 0.8 * f(bt, 'flair')) * (hasTrait(bt, 'perfectionist') ? 1.3 : 1) * (skill('bartender', bt) ? 0.6 : 1);
    b.auto = { ticketId: t.id, idx, left: Math.max(2, secs), name: bt.name };
    bus.emit('bar:change');
    return;
  }
}
