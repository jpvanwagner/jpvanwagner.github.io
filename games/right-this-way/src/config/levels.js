/*
 * Levels ("Added complexity: further levels" in the design sketch).
 *
 * Each level is a feature-flag set plus optional SETTINGS overrides and an
 * arrival mix. Systems read `game.level.features.X` instead of checking level
 * numbers, so new levels are pure data.
 *
 * Features:
 *   badgeChecks       - Staff IDs must be inspected in the ID-check modal (photo,
 *                       expiry date) to spot expired or borrowed badges.
 *   appointmentChecks - Visitors must be looked up on the desk computer's list
 *                       of today's appointments.
 *   guestPasses       - Visitors need a printed guest pass ("Badge / get guest pass").
 *                       Escorts arriving before the pass is printed cause the
 *                       race-condition desk freeze.
 *   staffPropDoors - Staff sometimes leave secure doors propped open.
 *
 * `briefing` is the list of objectives shown in the popup before the shift.
 *
 * Arrival mixes are weights for group compositions. Codes: G guest, E employee,
 * O officer; a two-letter code is a pair arriving together.
 */

const MIX_RUSH = { E: 34, EE: 16, G: 12, EG: 12, GG: 4, O: 3, OO: 2, OG: 7, OE: 10 };
const MIX_DAY = { E: 16, EE: 6, G: 24, EG: 14, GG: 12, O: 4, OO: 2, OG: 12, OE: 10 };

export const LEVELS = [
  {
    id: 1,
    name: 'Morning Rush',
    tagline: 'A 4-hour shift: check IDs, look up visitors, and keep every visitor escorted.',
    briefing: [
      'Staff: {verb} <b>Check ID</b>. Photo doesn\u2019t match? Deny. Expired (check today\u2019s date by the clock)? Don\u2019t deny: <b>Temp badge &amp; allow</b> (T), and print them a <b>new badge</b> before the day ends.',
      'Visitors: {verb} <b>Verify appointment</b> and find their name on the desk computer. Not on the list, or more than 15 minutes late? <b>Officer verify</b>. More than 15 minutes early? <b>Waiting area</b>.',
      'No visitor walks in alone: <b>Call escort</b>, or let the employee / officer they came with escort them.',
      'Answer incidents before their bar runs out. Keep an officer free for the <b>hourly patrol</b>, and for visitors who need the restroom or are waiting in a lounge.',
    ],
    features: { guestPasses: false, badgeChecks: true, appointmentChecks: true, staffPropDoors: false },
    settings: { DUTY_OFFICERS: 6, SHIFT_LENGTH_MINUTES: 4 * 60 },
    mix: { rush: MIX_RUSH, day: MIX_DAY },
  },
  {
    id: 2,
    name: 'Guest Passes',
    tagline: 'A 6-hour shift, and visitors need a printed guest pass before their escort arrives.',
    briefing: [
      'Everything from Morning Rush, plus <b>guest passes</b>.',
      'Print a visitor\u2019s pass before their escort reaches them. If the escort gets there first, the desk freezes.',
      'You can print passes for visitors in the waiting area too, right up until their escort arrives.',
    ],
    features: { guestPasses: true, badgeChecks: true, appointmentChecks: true, staffPropDoors: false },
    settings: { ENTRY_WINDOW: 7, DUTY_OFFICERS: 5, SHIFT_LENGTH_MINUTES: 6 * 60 },
    mix: { rush: MIX_RUSH, day: MIX_DAY },
  },
  {
    id: 3,
    name: 'Propped Doors',
    tagline: 'Everything at once: an 8-hour shift, faster arrivals, and staff who prop doors open.',
    briefing: [
      'Everything from Guest Passes, with faster arrivals and a longer shift.',
      'Staff sometimes <b>prop secure doors open</b> (amber). {verb} a door to close it before a visitor slips through.',
    ],
    features: { guestPasses: true, badgeChecks: true, appointmentChecks: true, staffPropDoors: true },
    settings: { ENTRY_WINDOW: 7, ARRIVAL_INTERVAL: [3, 6], DUTY_OFFICERS: 5, SHIFT_LENGTH_MINUTES: 8 * 60 },
    mix: { rush: MIX_RUSH, day: { ...MIX_DAY, G: 28, GG: 16 } },
  },
];

/**
 * The optional tutorial ("Training Day"): no random arrivals, drills or
 * patrols (`scripted`); systems/TutorialSystem.js stages each situation and
 * the timers are generous. Guest passes are switched on mid-tutorial.
 */
export const TUTORIAL = {
  id: 0,
  name: 'Training Day',
  tutorial: true,
  tagline: 'Optional: every mechanic, one step at a time. Skip any step, or skip to the real game.',
  briefing: [],
  features: { guestPasses: false, badgeChecks: true, appointmentChecks: true, staffPropDoors: false, scripted: true },
  settings: {
    ENTRY_WINDOW: 30,
    INCIDENT_WINDOW: 10,
    QUEUE_PATIENCE: 300,
    WAITING_PATIENCE: 300,
    RESTROOM_REQUEST_WINDOW: 20,
    LOUNGE_PATIENCE_MINUTES: [600, 600],
    SHIFT_LENGTH_MINUTES: 24 * 60,
    DUTY_OFFICERS: 3,
  },
  mix: { rush: { E: 1 }, day: { E: 1 } },
};

export const getLevel = (id) => LEVELS.find((l) => l.id === Number(id)) ?? (Number(id) === 0 ? TUTORIAL : LEVELS[0]);
