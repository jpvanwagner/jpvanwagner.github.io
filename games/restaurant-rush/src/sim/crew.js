// The crew: who's on today and in which role, what their stats do in the sim, wages, hiring,
// training, and learning on the job. Pure logic (the office screens call into this).
import { G, career, saveCareer } from '../state.js';
import {
  ROLES, STAT_KEYS, STAT_MAX, SKILL_AT, TRAITS, wageFor, hireFeeFor, trainCost, xpToNext, makePerson, rng,
} from '../data/staff.js';

export const MAX_STAFF = 8;          // people on the books at once
export const CANDIDATES_PER_DAY = 3;

// ── Who's working ───────────────────────────────────────────────────────────
export const staffById = (id) => career.staff.find((p) => p.id === id);
export const onRole = (role) => career.staff.filter((p) => p.role === role);
export const inRole = (role) => onRole(role)[0] || null;
export const working = () => career.staff.filter((p) => p.role);
export const hasTrait = (p, t) => !!p && p.trait === t;

/** Has the person in `role` (or `p`) unlocked that role's skill? */
export function skill(role, p = inRole(role)) {
  return !!p && p.role === role && p.stats[ROLES[role].stat] >= SKILL_AT;
}

/** Stat as a 0–1 factor (5 → 0.5). */
export const f = (p, stat) => (p ? p.stats[stat] / STAT_MAX : 0);

/** Put someone in a role (or null to bench them). Fails if the role is full. */
export function assign(p, role) {
  if (role && p.role !== role && onRole(role).length >= ROLES[role].slots) return false;
  p.role = role;
  saveCareer();
  return true;
}

export const wage = (p) => wageFor(p.stats);
/** Today's payroll: only people with a role get paid. */
export const payroll = () => working().reduce((n, p) => n + wage(p), 0);

// ── Hiring ──────────────────────────────────────────────────────────────────
/** The day's job applicants. Same day, same people, so reloading doesn't reroll them. */
export function candidates(day = career.day) {
  const r = rng(day * 7919 + 13);
  const taken = new Set(career.staff.map((p) => p.name));
  const out = [];
  for (let i = 0; i < CANDIDATES_PER_DAY; i++) {
    let p;
    for (let tries = 0; tries < 8; tries++) {
      p = makePerson(r);
      if (!taken.has(p.name)) break;
    }
    taken.add(p.name);
    // Later days bring more experienced applicants (and pricier ones).
    const bump = Math.min(3, Math.floor((day - 1) / 4));
    for (const k of STAT_KEYS) p.stats[k] = Math.min(p.potential[k], p.stats[k] + (k === p.strong ? bump : Math.floor(bump / 2)));
    p.slot = i;
    p.fee = hireFeeFor(p.stats);
    p.hired = career.hiredToday.day === day && career.hiredToday.slots.includes(i);
    out.push(p);
  }
  return out;
}

export function hire(c) {
  if (c.hired || career.cash < c.fee || career.staff.length >= MAX_STAFF) return null;
  career.cash -= c.fee;
  const p = { ...c, id: career.nextStaffId++, role: null };
  delete p.slot; delete p.fee; delete p.hired;
  career.staff.push(p);
  if (career.hiredToday.day !== career.day) career.hiredToday = { day: career.day, slots: [] };
  career.hiredToday.slots.push(c.slot);
  saveCareer();
  return p;
}

export function letGo(p) {
  career.staff = career.staff.filter((x) => x !== p);
  saveCareer();
}

// ── Training ────────────────────────────────────────────────────────────────
export const costToTrain = (p, stat) => (p.stats[stat] >= STAT_MAX ? null : trainCost(p.stats[stat], p.potential[stat]));
export const isStretch = (p, stat) => p.stats[stat] >= p.potential[stat];

export function train(p, stat) {
  const cost = costToTrain(p, stat);
  if (cost == null || career.cash < cost) return false;
  career.cash -= cost;
  p.stats[stat] += 1;
  // Stretching past potential raises the ceiling with it, so on-the-job learning can follow.
  if (p.stats[stat] > p.potential[stat]) p.potential[stat] = p.stats[stat];
  p.xp[stat] = 0;
  saveCareer();
  return true;
}

// ── Learning on the job ─────────────────────────────────────────────────────
/** Credit a job done in the shift (called by the sim). */
export function credit(p, n = 1) {
  if (!p) return;
  G.crewDid[p.id] = (G.crewDid[p.id] || 0) + 1;
  G.crewXp[p.id] = (G.crewXp[p.id] || 0) + n * (hasTrait(p, 'quickStudy') ? 1.5 : 1);
}

/** End of shift: turn the shift's experience into stat points. Returns what changed. */
export function applyShiftXp() {
  const ups = [];
  for (const p of working()) {
    p.shifts = (p.shifts || 0) + 1;
    const stat = ROLES[p.role].stat;
    const had = p.stats[stat];
    p.xp[stat] = (p.xp[stat] || 0) + (G.crewXp[p.id] || 0);
    while (p.stats[stat] < p.potential[stat] && p.xp[stat] >= xpToNext(p.stats[stat])) {
      p.xp[stat] -= xpToNext(p.stats[stat]);
      p.stats[stat] += 1;
    }
    if (p.stats[stat] >= p.potential[stat]) p.xp[stat] = Math.min(p.xp[stat], xpToNext(p.stats[stat]) - 1);
    ups.push({ p, stat, from: had, to: p.stats[stat], jobs: G.crewDid[p.id] || 0, unlocked: had < SKILL_AT && p.stats[stat] >= SKILL_AT });
  }
  saveCareer();
  return ups;
}

/** How well someone suits a role, 0–3 stars, from the role's stat. */
export function fit(p, role) {
  const v = p.stats[ROLES[role].stat];
  return v >= 7 ? 3 : v >= 5 ? 2 : v >= 3 ? 1 : 0;
}

export const traitName = (p) => (p.trait ? TRAITS[p.trait].name : null);
