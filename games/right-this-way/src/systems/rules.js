/*
 * Desk decision rules - pure functions, unit tested in tests/rules.test.js.
 *
 * From the design sketch's ✓/✗ table:
 *   G  ✗   GG ✗  (unaccompanied visitors - "each one let through multiplies incidents by 2")
 *   E  ✓   EE ✓  EG ✓   (an employee can host/escort a visitor)
 *   O  ✓   OO ✓  OG ✓  OE ✓
 *
 * Added on top (from the prototype / later levels):
 *   - staff badges: an EXPIRED badge is a real employee who needs a printed
 *     temp badge before you let them in; a BORROWED badge (photo doesn't match)
 *     gets the whole group denied
 *   - visitors not on today's list: call an officer to verify (they step
 *     aside; the officer radios in and they're added or sent home)
 *   - with guest passes enabled, visitors must have a printed pass to enter
 *
 * A "member" here is anything shaped like
 *   { isGuest, valid, hasPass, type: { canEscort }, badge?, tempPass? }
 * where `valid` means "on the list" for visitors, `timing` is their arrival
 * against the appointment time ('on-time' | 'early' | 'late', see
 * appointmentTiming), and `badge` is 'ok' | 'expired' | 'borrowed' for staff.
 *
 * A visitor with their host (staff let in with them) can go in with that host
 * whatever the time. Otherwise: on time -> escort (or the waiting area when no
 * officer is free); more than 15 minutes early -> the waiting area until it's
 * nearly time; more than 15 minutes late -> an officer checks whether they
 * can be rescheduled.
 */
import { SYSTEM_TEXT, DESK_REASON } from '../data/incidentText.js';

export const DeskAction = Object.freeze({
  ALLOW: 'allow',
  DENY: 'deny',
  ESCORT: 'escort', // officer escort (or waiting area until one is free)
  VERIFY: 'officerVerify', // an officer checks with their host (not on the list, or too late)
  WAIT: 'wait', // to the waiting area (early for their appointment, or no officer free)
});

/**
 * A visitor's arrival against their appointment time (clock minutes): more
 * than `grace` minutes before it is 'early' (they wait in the waiting area
 * until it's nearly time), more than `grace` after it is 'late' (an officer
 * checks whether they can be rescheduled), otherwise 'on-time'.
 */
export function appointmentTiming(apptMinutes, nowMinutes, grace = 15) {
  if (apptMinutes - nowMinutes > grace) return 'early';
  if (nowMinutes - apptMinutes > grace) return 'late';
  return 'on-time';
}

/** True if the group contains someone allowed to escort the visitors in it. */
export const hasHost = (members) => members.some((m) => !m.isGuest && m.type.canEscort);

export const isBorrowed = (m) => !m.isGuest && m.badge === 'borrowed';
export const isExpired = (m) => !m.isGuest && m.badge === 'expired';
export const notOnList = (m) => m.isGuest && !m.valid;

/** Classifies a group by the sketch's table: 'ok' (✓) or 'unaccompanied' (✗). */
export function groupVerdict(members) {
  const guests = members.filter((m) => m.isGuest);
  if (guests.length === 0 || hasHost(members)) return 'ok';
  return 'unaccompanied';
}

/**
 * Scores the decision for ONE person at the desk (everyone is approved
 * individually, pairs included). `hostAllowed`: someone on staff in their
 * group has already been let in, so a visitor allowed now is accompanied.
 * `checked`: the player looked at their ID / looked them up first. A right
 * call made without checking scores UNCHECKED_ENTRY (nothing), so waving
 * everyone through doesn't pay. Mistakes cost more than right calls earn,
 * the worst (a borrowed badge) the most, and each says why (`reason`).
 * @returns {{ delta: number, correct: boolean, unchecked?: boolean, outcomes: Array<{ member, delta, text, reason }> }}
 */
export function evaluateMember(m, action, { hostAllowed = false, officerFree = true, checked = true, features = {}, score }) {
  const outcomes = [];
  const wrong = (text, reason, delta = score.WRONG_ENTRY) => outcomes.push({ member: m, delta, text, reason });

  if (action === DeskAction.DENY) {
    if (isBorrowed(m)) {
      /* right */
    } else if (notOnList(m)) wrong(SYSTEM_TEXT.notVerified, DESK_REASON.deniedUnlisted, score.DENIED_VALID);
    else if (isExpired(m)) wrong(SYSTEM_TEXT.deniedValid, DESK_REASON.deniedExpired, score.DENIED_VALID);
    else wrong(SYSTEM_TEXT.deniedValid, DESK_REASON.deniedValid(m.isGuest), score.DENIED_VALID);
  } else if (!m.isGuest) {
    if (isBorrowed(m)) wrong(SYSTEM_TEXT.borrowedBadge, DESK_REASON.borrowedBadge, score.BORROWED_BADGE);
    else if (isExpired(m) && !m.tempPass) wrong(SYSTEM_TEXT.expiredNoPass, DESK_REASON.expiredNoPass, score.EXPIRED_NO_TEMP);
  } else if (action === DeskAction.VERIFY) {
    if (m.valid && (hostAllowed || m.timing !== 'late')) wrong(SYSTEM_TEXT.needlessVerify, DESK_REASON.needlessVerify);
  } else if (!m.valid) {
    wrong(SYSTEM_TEXT.noAppointment, DESK_REASON.noAppointment, score.NO_APPOINTMENT);
  } else if (action === DeskAction.ALLOW) {
    if (!hostAllowed) wrong(SYSTEM_TEXT.letInUnescorted, DESK_REASON.letInUnescorted, score.UNESCORTED);
    else if (features.guestPasses && !m.hasPass) wrong(SYSTEM_TEXT.noPass, DESK_REASON.noPass);
  } else if (m.timing === 'late') {
    wrong(SYSTEM_TEXT.tooLate, DESK_REASON.tooLate); // escort / waiting area: they needed rescheduling first
  } else if (action === DeskAction.ESCORT && m.timing === 'early') {
    wrong(SYSTEM_TEXT.tooEarly, DESK_REASON.tooEarly);
  } else if (action === DeskAction.WAIT && m.timing !== 'early' && officerFree) {
    wrong(SYSTEM_TEXT.neededEscort, DESK_REASON.neededEscort);
  }

  if (outcomes.length) return { delta: outcomes.reduce((s, o) => s + o.delta, 0), correct: false, outcomes };
  if (!checked) {
    const reason = DESK_REASON.unchecked(m.isGuest);
    return { delta: score.UNCHECKED_ENTRY ?? 0, correct: true, unchecked: true, outcomes: [{ member: m, delta: score.UNCHECKED_ENTRY ?? 0, text: 'unchecked', reason }] };
  }
  return { delta: score.CORRECT_ENTRY, correct: true, outcomes: [{ member: m, delta: score.CORRECT_ENTRY, text: 'correct', reason: 'correct' }] };
}

/**
 * The same action applied to every member in order (staff first, as they
 * stand at the desk). Returns the summed result; handy for tests.
 */
export function evaluateDecision(members, action, { features = {}, score }) {
  let hostAllowed = false;
  const results = members.map((m) => {
    const r = evaluateMember(m, action, { hostAllowed, features, score });
    if (!m.isGuest && action === DeskAction.ALLOW) hostAllowed = true;
    return r;
  });
  const outcomes = results.flatMap((r) => (r.correct ? [] : r.outcomes));
  if (!outcomes.length) return { delta: score.CORRECT_ENTRY, correct: true, outcomes: [{ member: null, delta: score.CORRECT_ENTRY, text: 'correct' }] };
  return { delta: outcomes.reduce((s, o) => s + o.delta, 0), correct: false, outcomes };
}

/** Incident score multiplier from the number of unescorted visitors inside. */
export function incidentMultiplier(unescortedCount, { MULTIPLIER_PER_UNESCORTED, MULTIPLIER_CAP }) {
  return Math.min(MULTIPLIER_CAP, MULTIPLIER_PER_UNESCORTED ** unescortedCount);
}
