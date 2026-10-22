// The people who work at the trattoria: their four stats, the roles they can be put in, and
// the personality traits that make each one different. No DOM, no three.js (tests use this).
//
// Stats run 1–10. Every person also has a *potential* in each stat: training up to it is
// cheap, training past it ("stretch" training) costs a lot more. So you can lean into what
// someone is naturally good at, or pay to shore up a weakness. Working a role also earns
// experience in that role's main stat, up to the person's potential.

export const STATS = {
  hands: { name: 'Hands', desc: 'Kitchen timing and care: how cleanly food comes off the line.' },
  feet:  { name: 'Feet',  desc: 'Speed on the floor: carrying plates and clearing tables.' },
  charm: { name: 'Charm', desc: 'Way with guests: patience in line, moods at the table, tips.' },
  flair: { name: 'Flair', desc: 'Behind the bar: how fast and how well they mix drinks.' },
};
export const STAT_KEYS = Object.keys(STATS);
export const STAT_MAX = 10;

// Roles. `stat` drives the job and earns experience; `skill` unlocks when that stat reaches
// SKILL_AT. `slots` is how many people can hold the role at once.
export const SKILL_AT = 7;
export const ROLES = {
  host: {
    name: 'Host', stat: 'charm', slots: 1, icon: '☰',
    desc: 'Seats waiting parties at a table that fits. Better Charm: quicker, smarter seating, and a calmer line.',
    skill: { name: 'Warm welcome', desc: 'Parties they seat start happier.' },
  },
  runner: {
    name: 'Runner', stat: 'feet', slots: 3, icon: '➜',
    desc: 'Carries finished plates and drinks to tables. Better Feet: faster. Charm helps at the table.',
    skill: { name: 'Check-back', desc: 'Asks how everything is after the food lands: a mood boost for the table.' },
  },
  busser: {
    name: 'Busser', stat: 'feet', slots: 2, icon: '⌫',
    desc: 'Clears and resets dirty tables without being asked. Better Feet: faster turnarounds.',
    skill: { name: 'Quick reset', desc: 'Resets a table in half the time.' },
  },
  lineCook: {
    name: 'Line cook', stat: 'hands', slots: 1, icon: '♨',
    desc: 'Turns and pulls whatever is cooking. Better Hands: pulls closer to perfect.',
    skill: { name: 'Preps ahead', desc: 'Starts pasta, meatballs and calamari for new tickets on their own.' },
  },
  bartender: {
    name: 'Bartender', stat: 'flair', slots: 1, icon: '❦',
    desc: 'Mixes the drink tickets you are not working on, and sets out glass and ice for yours. Better Flair: faster and better drinks.',
    skill: { name: 'Speed rail', desc: 'Mixes drinks much faster.' },
  },
};
export const ROLE_KEYS = Object.keys(ROLES);

// Traits: one per person (or none). `tags` are read by the sim; see src/sim/crew.js.
export const TRAITS = {
  quickStudy:    { name: 'Quick study',    desc: 'Learns on the job half again as fast.' },
  chatterbox:    { name: 'Chatterbox',     desc: 'Guests love the chat (a mood bump at every stop), but every stop takes longer.' },
  butterfingers: { name: 'Butterfingers',  desc: 'Now and then drops what they are carrying and has to go back for it.' },
  perfectionist: { name: 'Perfectionist',  desc: 'Slower in the kitchen and behind the bar, but what they make comes out better.' },
  showboat:      { name: 'Showboat',       desc: 'Behind the bar, bottle flips and long pours earn extra tips.' },
  localFace:     { name: 'Local face',     desc: 'Knows half the neighbourhood: guests in line are more patient while they are on the floor.' },
};
export const TRAIT_KEYS = Object.keys(TRAITS);

export const FIRST_NAMES = [
  'Marco', 'Gina', 'Teo', 'Sal', 'Lucia', 'Paolo', 'Rosa', 'Dario', 'Ines', 'Bea', 'Nico', 'Amara',
  'Kofi', 'Mei', 'Jonah', 'Priya', 'Luca', 'Sofia', 'Enzo', 'Carla', 'Tomás', 'Yara', 'Omar', 'Hana',
  'Femi', 'Greta', 'Ravi', 'Nell', 'Dante', 'Zuri', 'Pietro', 'Ada', 'Iris', 'Bruno', 'Lena', 'Sami',
];
// One line of backstory per candidate, picked by their strongest stat.
export const BLURBS = {
  hands: ['Grew up rolling gnocchi in a family kitchen.', 'Two years on the line at a hotel brunch.', 'Bakes bread at home every weekend.'],
  feet: ['Ran cross-country in school.', 'Used to bike couriers across the city.', 'Waited tables through university.'],
  charm: ['Can talk to anyone about anything.', 'Worked the front desk at a small hotel.', 'Remembers every regular by name.'],
  flair: ['Tended bar at a jazz club.', 'Practises bottle flips in the mirror.', 'Knows a hundred aperitivo recipes.'],
};

// Pay: a base plus a little per stat point. Training raises a stat, so it raises the wage too.
export const WAGE_BASE = 18;
export const WAGE_PER_POINT = 3;
export const wageFor = (stats) => WAGE_BASE + WAGE_PER_POINT * STAT_KEYS.reduce((n, k) => n + stats[k], 0);
export const hireFeeFor = (stats) => Math.round(wageFor(stats) * 1.5);

// Training cost to raise a stat from `v` to v+1: cheap up to potential, steep past it.
export const trainCost = (v, potential) => Math.round((40 + 22 * v) * (v >= potential ? 2.6 : 1));
// Experience needed to raise a role's stat from `v` by on-the-job learning.
export const xpToNext = (v) => 6 + v * 3;

const SKINS = [0xf1d0b5, 0xe0b48f, 0xc68c64, 0x9a6440, 0x6e4329, 0xf6dcc4];
const HAIRS = [0x2a1d14, 0x5a3a22, 0x8a6a3a, 0x1a1a1a, 0xb9a27a, 0x6a6a6a, 0x9a3a1a];

/** A small seeded random generator, so the same day always shows the same candidates. */
export function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/** Make a person. `strong`/`weak` pick which stat leads and which lags (random if omitted). */
export function makePerson(r, { name, strong, weak, trait } = {}) {
  const keys = [...STAT_KEYS];
  strong ||= keys[Math.floor(r() * keys.length)];
  const rest = keys.filter((k) => k !== strong);
  weak ||= rest[Math.floor(r() * rest.length)];
  const stats = {}, potential = {};
  for (const k of keys) {
    if (k === strong) { stats[k] = 4 + Math.floor(r() * 3); potential[k] = 8 + Math.floor(r() * 3); }
    else if (k === weak) { stats[k] = 1 + Math.floor(r() * 2); potential[k] = 3 + Math.floor(r() * 3); }
    else { stats[k] = 2 + Math.floor(r() * 3); potential[k] = Math.max(stats[k] + 1, 4 + Math.floor(r() * 5)); }
  }
  if (trait === undefined) trait = r() < 0.85 ? TRAIT_KEYS[Math.floor(r() * TRAIT_KEYS.length)] : null;
  const blurbs = BLURBS[strong];
  return {
    name: name || FIRST_NAMES[Math.floor(r() * FIRST_NAMES.length)],
    stats, potential, trait, strong,
    blurb: blurbs[Math.floor(r() * blurbs.length)],
    xp: { hands: 0, feet: 0, charm: 0, flair: 0 },
    role: null, shifts: 0,
    look: { skin: SKINS[Math.floor(r() * SKINS.length)], hair: HAIRS[Math.floor(r() * HAIRS.length)] },
  };
}

/** Day one: just Marco, a quick, chatty runner. */
export function startingCrew() {
  const r = rng(1962);
  const marco = makePerson(r, { name: 'Marco', strong: 'feet', weak: 'flair', trait: 'chatterbox' });
  Object.assign(marco.stats, { hands: 3, feet: 5, charm: 4, flair: 1 });
  Object.assign(marco.potential, { hands: 5, feet: 9, charm: 7, flair: 4 });
  marco.blurb = 'Mama Maggie’s neighbour’s grandson. Has worked here since he was fifteen.';
  marco.role = 'runner';
  marco.id = 1;
  return [marco];
}
