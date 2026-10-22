// Global game state, a tiny event bus, and save/load.
import { CFG } from './config.js';
import { TABLES } from './data/layout.js';
import { startingCrew, makePerson, rng } from './data/staff.js';

// ── Event bus ───────────────────────────────────────────────────────────────
const listeners = {};
export const bus = {
  on(evt, fn) { (listeners[evt] ||= []).push(fn); },
  emit(evt, data) { (listeners[evt] || []).forEach((fn) => fn(data)); },
};

// ── Renovations (management) ────────────────────────────────────────────────
// People are hired in the office (see src/sim/crew.js); these are the room and the kit.
export const UPGRADES = {
  extraTable: { name: 'Add a four-top (T8)',    cost: 250, wage: 0,  desc: 'One more table for four in the front of the dining room.' },
  bigTable:   { name: 'Add a family table (T9)', cost: 350, wage: 0, desc: 'A long table for six. Big families, big checks.' },
  extraOven:  { name: 'Bigger pizza oven',      cost: 280, wage: 0,  desc: 'A fourth spot in the oven.' },
  ads:        { name: 'Neighbourhood flyers',   cost: 120, wage: 0,  desc: 'About 25% more guests every shift (it gets busier).' },
};

// ── Persistent career (survives between shifts) ─────────────────────────────
// staff: everyone on the books (see src/data/staff.js); recipes: dish key → level (1–5);
// buzz: word-of-mouth points earned from reviews; hiredToday: candidate slots already taken.
const SAVE_KEY = 'restaurant-rush-save-v1';
const freshCareer = () => ({
  day: 1, cash: 200, upgrades: {}, history: [],
  staff: startingCrew(), nextStaffId: 2, recipes: {}, buzz: 0, hiredToday: { day: 0, slots: [] },
});
export const career = freshCareer();

// Saves from before the staff system bought helpers as upgrades; turn those into people.
const LEGACY_HIRES = {
  runner2:  { name: 'Gina', strong: 'feet', role: 'runner' },
  busser:   { name: 'Teo', strong: 'feet', role: 'busser' },
  lineCook: { name: 'Sal', strong: 'hands', role: 'lineCook' },
  barback:  { name: 'Lucia', strong: 'flair', role: 'bartender' },
};
function migrate(c) {
  if (!c.staff) {
    c.staff = startingCrew();
    c.nextStaffId = 2;
    for (const [key, h] of Object.entries(LEGACY_HIRES)) {
      if (!c.upgrades?.[key]) continue;
      const p = makePerson(rng(c.nextStaffId * 31), { name: h.name, strong: h.strong });
      p.id = c.nextStaffId++;
      p.role = h.role;
      c.staff.push(p);
      delete c.upgrades[key];
    }
  }
  c.recipes ||= {};
  c.buzz ||= 0;
  c.hiredToday ||= { day: 0, slots: [] };
}

export function loadCareer() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) Object.assign(career, JSON.parse(raw));
    migrate(career);
    return !!raw;
  } catch { return false; }
}
export function saveCareer() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(career)); } catch { /* private mode */ }
}
export function resetCareer() {
  for (const k of Object.keys(career)) delete career[k];
  Object.assign(career, freshCareer());
  saveCareer();
}
export const has = (u) => !!career.upgrades[u];

// ── The live shift ──────────────────────────────────────────────────────────
export const G = {
  running: false,
  paused: false,
  speed: 1,
  view: 'floor',             // floor | bar | kitchen | table
  viewTableId: null,
  clock: CFG.shiftStart,     // game minutes since midnight
  time: 0,                   // sim seconds since the shift began
  nextArrival: 4,
  parties: [],
  actors: [],
  tables: [],
  tickets: [],
  jobs: [],
  selectedPartyId: null,
  service: 0,                // 0 lunch, 1 dinner (src/sim/day.js)
  takeOver: false,           // you took over from the crew in the quiet hours
  stats: null,
  kitchen: null,
  bar: null,
  ended: false,
};

let uid = 1;
export const nextId = () => uid++;

export function newShift() {
  Object.assign(G, {
    running: true, paused: false, ended: false, view: 'floor', viewTableId: null,
    clock: CFG.shiftStart, time: 0, nextArrival: 3,
    parties: [], actors: [], tickets: [], jobs: [], selectedPartyId: null,
  });
  G.tables = TABLES.filter((t) => !t.upgrade || has(t.upgrade)).map((t) => ({
    ...t, state: 'clean', partyId: null, dirtyAt: 0, bussing: false, items: [],
  }));
  G.stats = {
    revenue: 0, tips: 0, comps: 0, served: 0, guests: 0, walkouts: 0, turnedAway: 0,
    ratings: [], wrongItems: 0, perfectPlates: 0, drinksMade: 0, platesSent: 0,
    critic: null,      // { stars } once the day's critic has paid
  };
  G.crewXp = {};       // staff id → experience earned this shift
  G.crewDid = {};      // staff id → jobs done this shift (for the end-of-day report)
  const slots = { ...CFG.slots };
  if (has('extraOven')) slots.oven += 1;
  G.kitchen = {
    slots: Object.fromEntries(Object.entries(slots).map(([k, n]) => [k, Array.from({ length: n }, () => null)])),
    warmer: [],          // cooked components waiting to be plated
    plates: [],          // plates on the prep counter
    activePlateId: null,
  };
  G.bar = { glass: null, ice: false, pours: {}, shaken: false, garnish: null, target: null };
}

export const partyById = (id) => G.parties.find((p) => p.id === id);
export const tableById = (id) => G.tables.find((t) => t.id === id);
export const ticketById = (id) => G.tickets.find((t) => t.id === id);

export function fmtClock(min) {
  const h = Math.floor(min / 60), m = Math.floor(min % 60);
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
export const money = (n) => { const v = Math.round(n); return `${v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString()}`; };
