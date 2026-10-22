/*
 * Your career at the front desk, kept between shifts and between visits.
 *
 *  - Employer: picked at random the first time, then kept (consistent, but
 *    random). ?company=<id> or the title screen's "New employer" starts over.
 *  - Day: every shift is the next day, so the HUD date moves forward and
 *    badges age.
 *  - Roster: the same employees and officers come back every day with the
 *    same faces and badges, including any badge you re-printed for them.
 *
 * Saved in localStorage when it's available; private windows, blocked storage
 * and tests simply get a fresh career for the session.
 */
import { COMPANIES, getCompany } from '../data/companies.js';
import { NamePool } from './namePool.js';
import { pick } from './rng.js';
import { PersonType } from '../config/entityTypes.js';
import { SETTINGS } from '../config/settings.js';
import { makeRosterMember, today, toISODate, fromISODate, addDays } from '../systems/credentials.js';
import { randomAppearance } from '../data/appearance.js';
import { genderOf } from '../data/names.js';

const KEY = 'right-this-way:career:v1';
const OLD_KEY = 'security-escort:career:v1'; // the game's working title; saves made under it still load

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function saveCareer(career) {
  try {
    storage()?.setItem(KEY, JSON.stringify(career));
  } catch {
    /* storage full or blocked: keep playing without saving */
  }
}

function makeRoster(date, s = SETTINGS) {
  const names = new NamePool();
  const roster = [];
  const add = (type, n) => {
    for (let i = 0; i < n; i++) {
      // Issue dates spread over the last ~7 months: a few badges are already expired.
      const issuedDaysAgo = Math.floor(Math.random() * s.ROSTER_BADGE_AGE_DAYS);
      roster.push(makeRosterMember(type, { name: names.next(), date, months: s.BADGE_VALID_MONTHS, issuedDaysAgo }));
    }
  };
  add(PersonType.EMPLOYEE, s.ROSTER_EMPLOYEES);
  add(PersonType.OFFICER, s.ROSTER_OFFICERS);
  return roster;
}

export function newCareer(companyId = null, s = SETTINGS) {
  const start = today();
  const company = getCompany(companyId) ?? pick(COMPANIES);
  const career = { v: 1, companyId: company.id, startDate: toISODate(start), day: 0, roster: makeRoster(start, s) };
  saveCareer(career);
  return career;
}

/** The saved career, or a new one (also when ?company= asks for a different employer). */
export function loadCareer({ companyId = null } = {}) {
  let saved = null;
  try {
    saved = JSON.parse(storage()?.getItem(KEY) ?? storage()?.getItem(OLD_KEY) ?? 'null');
  } catch {
    saved = null;
  }
  const valid = saved?.v === 1 && getCompany(saved.companyId) && Array.isArray(saved.roster) && saved.roster.length;
  if (!valid || (companyId && getCompany(companyId)?.id !== getCompany(saved.companyId).id)) return newCareer(companyId);
  saved.companyId = getCompany(saved.companyId).id; // (renamed companies keep their careers)
  // Older saves drew faces without regard to names: redraw those once.
  for (const m of saved.roster) {
    if (!m.appearance?.gender) m.appearance = randomAppearance(m.type === 'O' ? PersonType.OFFICER : PersonType.EMPLOYEE, genderOf(m.name));
  }
  return saved;
}

export const careerCompany = (career) => getCompany(career.companyId);

/** Today's date in the game (day 1 is the day the career started). */
export const careerDate = (career) => addDays(fromISODate(career.startDate), Math.max(0, career.day - 1));

/** A new shift is a new day. */
export function startDay(career) {
  career.day += 1;
  saveCareer(career);
  return careerDate(career);
}
