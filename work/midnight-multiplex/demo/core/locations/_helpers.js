/* ════════════════════════════════════════════════════════════════════════════
 * LOCATION HELPERS  (shared across every file in core/locations/)
 * ────────────────────────────────────────────────────────────────────────────
 * Small utility functions referenced by the per-location screens. These used
 * to live in core/game.js next to the screens themselves; they moved out
 * alongside the screens when we modularized.
 *
 * Loaded BEFORE the location files (see midmulti.html script order), so
 * every Screens.* file can call these freely.
 * ════════════════════════════════════════════════════════════════════════════
 */

// True when the player picked the winter scenario (school-year tracks vs the
// summer break track). Lets each location vary its flavor text per season.
function isWinter() {
  return (State.world.scenario || 'summer') === 'winter';
}

// Pick the season-appropriate string. Use this in any location's text where
// the description should differ between summer and winter scenarios.
//   const opener = seasonLine("It is hot.", "It is cold.");
function seasonLine(summerStr, winterStr) {
  return isWinter() ? winterStr : summerStr;
}

// Lowercase human label of the player's home location (e.g. "maple grove").
// Used inside narrative text to refer to where the character lives without
// hard-coding the town name.  LOCATIONS lives in core/chargen.js.
function locFlavor() {
  const c = State.character;
  if (!c.location) return 'somewhere in town';
  const obj = LOCATIONS.find(l => l.key === c.location);
  return obj ? obj.label.toLowerCase() : 'somewhere in town';
}

// Returns true if the player picked the given hobby during chargen.
function hasHobby(key)  { return (State.character.hobbies || []).includes(key); }

// Returns true if the player is in the given clique (primary slot).
function hasClique(key) { return State.character.clique === key; }

// ─── HOME PROFILE ───────────────────────────────────────────────────────────
// Derives WHERE (and how) the player lives from their chargen LOCATION choice,
// so the wake-up scene and any "at home" text reflect it (apartment vs. parents'
// place vs. a house vs. the trailer park vs. the resort vs. a campsite …).
//   { type, name, the, wake[] }
//     type  — 'apt' | 'parents' | 'own' | 'rent' | 'resort' | 'trailer'
//              | 'campground' | 'oot' | 'place'
//     name  — short label for the UI location bar (e.g. "Your Apartment")
//     wake  — 2 narration lines describing waking up there (edit freely)
// HOW TO EDIT: tweak the names / wake lines below, or add a new case.
function homeProfile() {
  const c = State.character || {};
  const key = c.location || '';
  const obj = (typeof LOCATIONS !== 'undefined') && LOCATIONS.find(l => l.key === key);
  const label = (obj && obj.label) ? obj.label.toLowerCase() : '';
  const has = (s) => key.indexOf(s) >= 0 || label.indexOf(s) >= 0;

  let type = 'place', name = 'Your Place';
  if (key === 'resort')                                   { type = 'resort';     name = 'The Resort'; }
  else if (key === 'trailer_park' || has('trailer'))      { type = 'trailer';    name = 'Your Trailer'; }
  else if (key === 'campground' || has('campground'))     { type = 'campground'; name = 'Your Campsite'; }
  else if (key.endsWith('_parents') || has('with parents')) { type = 'parents';  name = "Your Parents' Place"; }
  else if (key.endsWith('_own') || has('house (own)') || has('own)')) { type = 'own'; name = 'Your House'; }
  else if (key.endsWith('_rent') || has('rented'))        { type = 'rent';       name = 'Your Rented House'; }
  else if (key.startsWith('oot_') || key.startsWith('woot_') || has('out of town')) { type = 'oot'; name = 'Your House'; }
  else if (key.endsWith('_apt') || has('apartment'))      { type = 'apt';        name = 'Your Apartment'; }

  const WAKE = {
    apt:        ["Your alarm clock radio clicks over and a tinny polka fades in. Morning light edges the curtains of your little upper-Midwest apartment.",
                 "You're still under the covers. Your first shift at the Grande is this morning."],
    parents:    ["Down the hall you can hear your folks already up — a radio, the coffee maker, a chair scraping. Morning light leaks past your old bedroom curtains.",
                 "You're still under the covers in your childhood room. Your first shift at the Grande is this morning."],
    own:        ["The furnace ticks somewhere below you. Morning light crosses the bedroom of the house you're paying off, one month at a time.",
                 "You're still under the covers. Your first shift at the Grande is this morning."],
    rent:       ["A radiator knocks. Morning light fills the rented house — the landlord's house, really, but yours for now.",
                 "You're still under the covers. Your first shift at the Grande is this morning."],
    resort:     ["The room's heater hums under a wide picture window. Morning light spills across the resort bedspread — $100 a night, and worth every complaint.",
                 "You're still under the resort's stiff, clean sheets. Your first shift at the Grande is this morning."],
    trailer:    ["Rain — or maybe just dew — taps the metal roof a foot above your head. Morning light slants through the trailer's narrow blinds.",
                 "You're still under the covers in the trailer. Your first shift at the Grande is this morning."],
    campground: ["Birdsong and the smell of cold ash. Morning light glows through the nylon of your tent at the campground.",
                 "You're still in your sleeping bag. Your first shift at the Grande is this morning."],
    oot:        ["It's quiet this far out — just the wind and a far-off dog. Morning light reaches across the house at the edge of town.",
                 "You're still under the covers. Your first shift at the Grande is this morning — leave a little early for the commute."],
    place:      ["Your alarm clock radio clicks over and a tinny polka fades in. Morning light edges the curtains.",
                 "You're still under the covers. Your first shift at the Grande is this morning."],
  };
  return { type, name, wake: WAKE[type] || WAKE.place };
}
