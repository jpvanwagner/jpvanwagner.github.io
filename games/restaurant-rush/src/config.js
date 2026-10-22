// Tuning knobs. Everything time-based is in *sim seconds* (real seconds × game speed).

export const RESTAURANT = {
  title: "Mama Maggie's Restaurant Rush",   // the game's full name
  name: "Mama Maggie's",          // the trattoria (Mama Maggie started it; the family still runs it)
  tagline: 'Cucina di famiglia · since 1962',
};

export const CFG = {
  // Clock: a day is lunch then dinner; their times, rushes and quiet hours are in src/sim/day.js.
  secondsPerGameMinute: 2,       // in a rush, 90 game minutes ≈ 3 real minutes at 1×
  shiftStart: 11 * 60,

  // Arrivals (mean sim seconds between parties), from calm to the peak of a rush.
  arrivalCalm: 24,
  arrivalRush: 11,
  maxQueue: 8,                   // more than this and new arrivals turn away

  walkSpeed: 2.4,                // world units / sim second
  staffSpeed: 3.2,

  // Party timings
  menuTime: [6, 10],             // reading the menu before they're ready to order
  eatTime: [16, 24],
  payTime: 1.2,

  // Mood: 0–100. Each state drains it at a rate (per sim second) after a grace period.
  moodStart: 85,
  drain: {
    queue:      { grace: 6,  rate: 1.1 },
    readyOrder: { grace: 5,  rate: 1.6 },
    waitFood:   { grace: 22, rate: 0.7 },
    eating:     { grace: 0,  rate: 0 },
    readyCheck: { grace: 4,  rate: 1.5 },
  },
  complainBelow: 30,
  seatedBoost: 6,

  // Money
  tipMax: 0.25,                  // tip % at mood 100
  foodCostPct: 0.3,
  baseWages: 90,

  // Kitchen station capacity (upgrades can add more)
  slots: { oven: 3, pot: 3, pan: 2, fryer: 2 },
  maxPlates: 4,
};

export const MOOD_LABELS = [
  [80, 'Delighted'], [60, 'Happy'], [40, 'Okay'], [25, 'Annoyed'], [0, 'Furious'],
];
export function moodLabel(m) {
  for (const [min, label] of MOOD_LABELS) if (m >= min) return label;
  return 'Furious';
}
