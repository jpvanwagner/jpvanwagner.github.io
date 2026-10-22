/*
 * Global tunables.
 *
 * Every number that affects game feel lives here so balancing never requires
 * digging through system code. Levels (see levels.js) may override any key in
 * SETTINGS via their `settings` block.
 *
 * Units: all durations are REAL seconds of simulation time (pausing stops them).
 * The on-screen clock is cosmetic: CLOCK_MINUTES_PER_SECOND converts sim
 * seconds into in-game minutes.
 */

export const SETTINGS = {
  // --- Countdown bars --------------------------------------------------------
  // Every "time to act" countdown (entry window, incident windows, line and
  // waiting-area patience, restroom requests) runs this many times longer than its
  // listed value. The listed values are the design doc's (5s entry, 3s incidents);
  // 4 = every bar drains at a quarter of that speed.
  TIMER_SCALE: 4,
  // How far apart things happen: arrivals, incidents from loose visitors, drills,
  // and how long neglect takes to turn into door-forcing / camera-ignoring.
  // 2.5 = everything 2.5x less often than the listed values.
  EVENT_SCALE: 2.5,
  // (Both are applied in resolveSettings(), after level overrides.)

  // --- Shift / clock ---------------------------------------------------------
  SHIFT_START_MINUTES: 7 * 60, // 07:00 AM
  SHIFT_LENGTH_MINUTES: 4 * 60, // 4 in-game hours (levels ramp this up: 4h, 6h, 8h)
  DOUBLE_SHIFT_CHANCE: 0.1, // Level 2+: someone calls off and you pull a double (16h)
  DOUBLE_SHIFT_MINUTES: 16 * 60,
  CLOCK_MINUTES_PER_SECOND: 0.5, // 2 real seconds = 1 in-game minute (a 4-hour shift is 8 real minutes)

  // --- Staffing --------------------------------------------------------------
  DUTY_OFFICERS: 5, // Officers in the escort pool (arrive first each shift; levels may change it)

  // --- Officer routine -------------------------------------------------------
  PATROL_INTERVAL_MINUTES: 60, // a free officer patrols every hour on the hour
  PATROL_GRACE_MINUTES: 15, // if nobody is free, someone must start within this or the client is upset
  // Two set routes (layout.PATROL_ROUTES) alternate hour by hour, each checking both
  // ends of every room on it. At normal walking pace they take about 40 (main floor)
  // and 25 (north wing) in-game minutes.
  PATROL_SPEED_MULT: 1, // x WALK_SPEED
  PATROL_CHECKPOINT_PAUSE: 0.6, // seconds spent looking around at each room end
  OFFICER_CHECKIN_CHANCE: [0.3, 0.6], // chance a free officer checks the waiting area (empty / occupied)

  // --- Arrivals --------------------------------------------------------------
  ARRIVAL_INTERVAL: [4, 7], // Seconds between groups arriving (random range)
  RUSH_HOUR_FRACTION: 0.2, // First 20% of the shift uses the "rush" mix
  QUEUE_SLOTS: 8, // Places in line (a pair shares one place)
  NOT_ON_LIST_CHANCE: 0.12, // Visitor whose name isn't on today's list
  LATE_ADDITION_CHANCE: 0.5, // ...who turns out to be expected after all (officer verification)
  EARLY_VISITOR_CHANCE: 0.12, // Visitors more than APPOINTMENT_GRACE_MINUTES early (they wait)
  LATE_VISITOR_CHANCE: 0.1, // ...or more than that late (an officer checks about rescheduling)
  APPOINTMENT_GRACE_MINUTES: 15,
  RESCHEDULE_CHANCE: 0.65, // A late visitor's host can fit them in later today
  BORROWED_BADGE_CHANCE: 0.05, // Staff arrival carrying someone else's badge
  APPOINTMENT_LIST_SIZE: 36, // Names on the visitor computer's list (grows if needed)
  PREPARKED_CARS: 6, // Front-row parking spots already taken when the shift starts
  PARK_UP_FRONT_CHANCE: 0.75, // Arrivals who park in a free front-row spot (the rest walk in from further out)
  CAR_SPEED: 14, // World units per second in the parking lot

  // --- Staff roster & badges (core/career.js, systems/credentials.js) ---------
  ROSTER_EMPLOYEES: 48, // The same people come back every day
  ROSTER_OFFICERS: 12,
  BADGE_VALID_MONTHS: 6, // A badge expires six months after it was issued
  ROSTER_BADGE_AGE_DAYS: 215, // Day-one badges were issued up to this long ago (so ~15% start expired)
  BADGE_REPRINT_TIME: 5, // Seconds to print a replacement badge

  // --- Desk ------------------------------------------------------------------
  ENTRY_WINDOW: 5, // Design doc: "Entry Response - 5s window" - the window at full rush
  // Adaptive pacing (systems/pacing.js): the window starts this many times longer
  // (2 = half speed) and tightens toward ENTRY_WINDOW as the line and waiting area fill;
  // it relaxes again when they empty.
  ENTRY_START_MULT: 2,
  ENTRY_PACE_WEIGHTS: { line: 0.6, waiting: 0.4 }, // how much each fills the "busy" meter
  ENTRY_PACE_EASE: 0.5, // max change of the window, in seconds per second
  BADGE_PRINT_TIME: 3, // Seconds to print a guest pass (level 2+) or a staff temp badge
  VERIFY_RADIO_TIME: 6, // Seconds an officer spends radioing in about a visitor who isn't on the list
  RACE_PENALTY_FREEZE: 4, // Desk freeze when an escort beats the pass printer

  // --- Patience --------------------------------------------------------------
  QUEUE_PATIENCE: 40, // Guests in line this long tailgate past the checkpoint
  WAITING_PATIENCE: 30, // Guests in the waiting area this long wander off

  // --- Waiting area ----------------------------------------------------------
  WAITING_CAPACITY: 9, // Design doc: "MAX CAPACITY (9)" - 3x3 seats

  // --- Visits ----------------------------------------------------------------
  VISIT_DURATION: [30, 60], // Seconds an escorted guest spends at the meeting (15-30 in-game min)
  HOST_STAND_IN_CHANCE: 0.6, // Host not around: chance a colleague meets the visitors instead
  LOUNGE_AFTER_MEETING_CHANCE: 0.25, // Host leaves visitors in a lounge instead of walking them out
  LOUNGE_PATIENCE_MINUTES: [45, 60], // In-game minutes visitors sit in a lounge before wandering off

  // --- Restrooms -------------------------------------------------------------
  RESTROOM_TIME: [4, 8], // Seconds in the restroom
  VISITOR_RESTROOM_CHANCE: 0.45, // Visitors who need the restroom during their stay
  RESTROOM_REQUEST_WINDOW: 6, // A visitor's request for a guard to the restroom (x TIMER_SCALE)

  // --- Incidents -------------------------------------------------------------
  INCIDENT_WINDOW: 3, // Design doc: "Incident Response - 3s window"
  UNESCORTED_INCIDENT_INTERVAL: 6, // Design doc: incident every 6s if unaccompanied
  DRILL_INTERVAL: 30, // Design doc: employee drill every 30s
  MULTIPLIER_PER_UNESCORTED: 2, // Design doc: "each one let through multiplies incidents by 2"
  MULTIPLIER_CAP: 8,

  // --- Cameras / deterrence --------------------------------------------------
  // A visitor neglected (unescorted) longer than this no longer cares about cameras.
  CAMERA_DETERRENCE_LIMIT: 45,
  // A visitor neglected longer than this will force a closed secure door.
  FORCE_DOOR_NEGLECT: 30,

  // --- Doors -----------------------------------------------------------------
  DOOR_LEFT_OPEN_CHANCE: 0.12, // Chance staff prop a door open behind them (level 3)
  DOOR_PROPPED_WINDOW: 12, // Time to get a propped door closed (x TIMER_SCALE)
  EMPLOYEE_CLOSES_DOOR_CHANCE: 0.35, // An employee walking past a propped door shuts it
  DOOR_CLOSE_DELAY: 0.8,

  // --- Movement --------------------------------------------------------------
  WALK_SPEED: 11, // World units per second
  WANDER_SPEED: 7,

  // --- Scoring ---------------------------------------------------------------
  SCORE: {
    CORRECT_ENTRY: 1, // The right call, after checking their ID / looking them up
    UNCHECKED_ENTRY: 0, // The right call, but without checking: a lucky guess earns nothing
    WRONG_ENTRY: -1, // Minor mistakes: needless verify, early / late handled wrong, no guest pass
    DENIED_VALID: -2, // Turned away someone who belongs here (valid or expired badge, listed visitor)
    EXPIRED_NO_TEMP: -2, // Let staff in on an expired badge without a temp badge
    UNESCORTED: -3, // Let a visitor in without an escort or host
    NO_APPOINTMENT: -3, // Let a visitor in who isn't on the list
    BORROWED_BADGE: -5, // Let someone in on somebody else's badge: a security breach
    ENTRY_TIMEOUT: -1, // Entry window expired (repeats each window)
    INCIDENT_ADDRESSED: 1,
    INCIDENT_MISSED: -1, // Design doc: "-1 if not addressed" (scaled by multiplier)
    RACE_CONDITION: -1,
    VISIT_COMPLETED: 1, // Escorted guest finished their visit and left
    BADGE_NOT_RENEWED: -1, // End of shift: an expired badge you never re-printed
  },
};

/** The countdowns TIMER_SCALE stretches (patrol grace is in clock minutes, see CLOCK_MINUTES_PER_SECOND). */
export const SCALED_TIMERS = ['ENTRY_WINDOW', 'INCIDENT_WINDOW', 'QUEUE_PATIENCE', 'WAITING_PATIENCE', 'RESTROOM_REQUEST_WINDOW', 'DOOR_PROPPED_WINDOW'];

/** The intervals EVENT_SCALE stretches. */
export const SCALED_EVENTS = ['ARRIVAL_INTERVAL', 'UNESCORTED_INCIDENT_INTERVAL', 'DRILL_INTERVAL', 'CAMERA_DETERRENCE_LIMIT', 'FORCE_DOOR_NEGLECT'];

const scale = (v, k) => (Array.isArray(v) ? v.map((x) => x * k) : v * k);

/** Returns SETTINGS merged with a level's overrides (shallow, plus SCORE), with TIMER_SCALE applied. */
export function resolveSettings(level) {
  const overrides = level?.settings ?? {};
  const s = {
    ...SETTINGS,
    ...overrides,
    SCORE: { ...SETTINGS.SCORE, ...(overrides.SCORE ?? {}) },
  };
  for (const key of SCALED_TIMERS) s[key] = scale(s[key], s.TIMER_SCALE);
  for (const key of SCALED_EVENTS) s[key] = scale(s[key], s.EVENT_SCALE);
  return s;
}
