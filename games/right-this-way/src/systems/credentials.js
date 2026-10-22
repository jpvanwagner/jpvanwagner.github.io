/*
 * Staff ID badges and the persistent staff roster.
 *
 * Every employee and officer is a roster member who keeps the same name, face
 * and badge from day to day (see core/career.js). A badge is valid for
 * BADGE_VALID_MONTHS from the day it was issued; the ID card shows the expiry
 * date and the HUD shows today's date, and nothing else gives it away.
 *
 *  - Expired badge: the person is legit but needs a temporary pass (printed
 *    like a guest pass) to get in today, and a new badge printed at some point
 *    during the day. Once you print one, they carry it on later days.
 *  - Borrowed badge: someone else's card (the photo doesn't match the face).
 *    Deny them.
 *
 * Officers' badges are issued by The Organization.
 */
import { mismatchedAppearance, randomAppearance } from '../data/appearance.js';
import { DEPARTMENTS, genderOf } from '../data/names.js';
import { PersonType } from '../config/entityTypes.js';
import { pick } from '../core/rng.js';
import { ORGANIZATION } from '../data/organization.js';

const DAY = 24 * 60 * 60 * 1000;

/** Midnight today (the first day of a new career). */
export const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const addDays = (date, n) => {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + n);
  return d;
};

export const addMonths = (date, n) => {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return d;
};

/** 'YYYY-MM-DD' in local time (stable across reloads and time zones). */
export const toISODate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const fromISODate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** "OCT 04, 2026" - the same format on badges and in the HUD, so they're easy to compare. */
export const formatDate = (d) =>
  d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();

export const formatWeekday = (d) => d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

/** A fresh badge issued on `date`. */
export function issueBadge(date, months) {
  return { issued: toISODate(date), expires: toISODate(addMonths(date, months)) };
}

export const badgeExpired = (member, date) => fromISODate(member.expires).getTime() < date.getTime();

/**
 * A new roster member. `issuedDaysAgo` spreads the starting badges out so a
 * few are already past their six months on day one.
 */
export function makeRosterMember(type, { name, date, months, issuedDaysAgo = 0 }) {
  const officer = type === PersonType.OFFICER;
  return {
    id: `${officer ? 'O' : 'E'}-${Math.floor(10000 + Math.random() * 89999)}`,
    type: type.code,
    name,
    appearance: randomAppearance(type, genderOf(name)),
    department: officer ? ORGANIZATION.name : pick(DEPARTMENTS),
    clearance: officer ? 'L3' : pick(['L1', 'L2', 'L2', 'L3']),
    idNumber: `${officer ? 'SEC' : 'EMP'}-${String(Math.floor(10000 + Math.random() * 89999))}`,
    ...issueBadge(addDays(date, -issuedDaysAgo), months),
  };
}

/** Print a replacement badge: valid for another `months` from `date`. */
export function renewBadge(member, date, months) {
  Object.assign(member, issueBadge(date, months));
  return member;
}

/**
 * The card a roster member hands over today. A borrowed card belongs to the
 * roster member but the person holding it looks different.
 */
export function idCardFor(member, { borrowed = false } = {}) {
  return {
    idNumber: member.idNumber,
    department: member.department,
    clearance: member.clearance,
    issued: fromISODate(member.issued),
    expires: fromISODate(member.expires),
    photo: member.appearance,
    borrowed, // for debugging / tests only - never shown directly
  };
}

/** What the person holding a borrowed card actually looks like. */
export const impostorAppearance = (member) => mismatchedAppearance(member.appearance);

export const daysBetween = (a, b) => Math.round((b.getTime() - a.getTime()) / DAY);
