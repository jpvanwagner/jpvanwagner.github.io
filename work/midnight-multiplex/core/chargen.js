/* ════════════════════════════════════════════════════════════════════════════
 * MIDNIGHT AT THE MULTIPLEX — CHARACTER GENERATOR
 * ────────────────────────────────────────────────────────────────────────────
 * Location: midmulti/core/chargen.js
 *
 * WHAT THIS FILE IS
 * ──────────────────────────────────────────────────────────────────────────
 * The complete character creation flow for Midnight at the Multiplex.
 * Extracted from the original single-file prototype so it can be loaded
 * independently from the title screen (core/title.js) and the in-game
 * runtime (core/game.js).
 *
 * CHARGEN FLOW
 * ─────────────────────────────────────────────────
 *   INTRO (opening crawl)  →  CHARSHEET (one screen: identity, residence,
 *   stats + abilities from one point pool, hobbies, clique — traits open as
 *   modals over it)  →  REVIEW  →  the tutorial offer / WAKE_UP (Day 1).
 *
 * At CHARSHEET the player can RANDOMIZE everything. Typing `auto` / `autoroll`
 * / `randomize all` anywhere builds a complete random character and jumps to
 * REVIEW. From REVIEW, `random` rerolls; `attributes` / `hobbies` / `clique`
 * reopen that modal on CHARSHEET.
 *
 * (The older step-by-step wizard — SCENARIO, SETTING, IDENTITY, TENURE,
 * PROFILE, INTERESTS, ATTRIBUTES — was removed 2026-09-28; see git history.
 * TENURE_OPTIONS and the tenure helpers remain for when CHARSHEET gets a
 * tenure field — see docs/TODO.md BUG-8.)
 *
 * REQUIREMENTS (loaded from midmulti.html before this file)
 * ─────────────────────────────────────────────────
 * Globals this module relies on:
 *   State, Screens, blankCharacter()           — game state + screens map
 *   sfx, render(), goto(name), back(), flash() — UI helpers
 *   escHTML, span, pad, rule, center           — text helpers
 *   randInt, randPick, randPickN               — random helpers
 *   header(title)                              — section header
 *   HELP_MECHANICS screen                      — chargen "help" jumps here
 *
 * When chargen completes, REVIEW "start" saves, then hands off to the tutorial
 * runner (core/tutorial.js), which returns through ENTER_GAME to FIRST_SHIFT.
 *
 * COMMON THINGS TO CHANGE
 * ──────────────────────────────────────────────────────────────────────────
 *   - Add/remove a stat:      edit STAT_KEYS and STAT_INFO below
 *   - Adjust age brackets:    edit ageBracket() and AGE_MODS
 *   - Add a gender option:    edit GENDER_OPTIONS
 *   - Add an orientation:     edit ORIENTATION_OPTIONS
 *   - Add a hobby:            edit HOBBIES (each entry has cliqueAffinity)
 *   - Add a skill/ability:    edit SKILLS (set reqStats / reqHobbiesAny)
 *   - Add a clique:           edit CLIQUES (compat list, age locks via tenure)
 *   - Add a place to live:    edit LOCATIONS (in this file)
 *   - Add town landmarks:     edit TOWN_LANDMARKS / TOWN_DISTRICTS
 *   - Add a town-name option: edit TOWN_NAMES
 *   - Change starting points: edit `points: 12` in blankCharacter() (core/game.js)
 *   - Tune skill-cost curve:  edit skillCostFor() near the bottom
 *   - Change the intro crawl: edit CRAWL_PARAGRAPHS and INTRO_TITLE_BLOCK
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

//═══════════════════════════════════════════════════════════════════════════
// TOWN-NAME RANDOM POOL
//═══════════════════════════════════════════════════════════════════════════

const TOWN_NAMES = [
  'Coldwater', 'Northbrook', 'Linden Falls', 'Pinevale', 'Stoneharbor',
  'Glen Ridge', 'Maple Bay', 'Ashport', 'Riverbend', 'Cedar Crest',
  'Westfield', 'Birchwood', 'Lake Shore', 'Greenfield', 'Auburn Hills',
  'Saint Helena', 'Fairhaven', 'Brookhaven', 'Edgewater', 'Hartfield',
  'Millbrook', 'Oakridge', 'Heron Lake', 'Silver Creek', 'Park Lawn',
];

//═══════════════════════════════════════════════════════════════════════════
// SCENARIOS  —  the game calendar
//═══════════════════════════════════════════════════════════════════════════
//
// New games always use 'campaign' ("The Long Year": Sun Jun 6, 1999 → New
// Year's Eve, three acts). 'summer' and 'winter' are the design notes' two
// separate scenarios, kept for old saves and as act date anchors. Which of
// these is canonical is an open design question (CONFLICTS.md §C4).
//
// Each entry: `tutorialStart` = the JS Date for Day 1 (a Sunday);
// `mainStartDay` = the dayNumber the main game starts (the Saturday);
// `endDay` = the last dayNumber. core/game.js reads State.world.scenario for
// date math (formatDate / currentDate). Season checks (isWinter / seasonLine
// in core/locations/_helpers.js) still key off 'winter' — see docs/TODO.md
// BUG-7.
//
const SCENARIOS = {
  summer: {
    key: 'summer',
    label: 'Summer Job',
    blurb: 'Saturday, June 12, 1999 – Tuesday, September 7, 1999. (~88 days)',
    tutorialStart: new Date(1999, 5,  6),    // Sun Jun 6, 1999
    mainStartDay: 7,                          // Sat Jun 12, 1999
    endDay:       95,                         // Tue Sep 7, 1999
    short: 'Long days, hot lobby, summer blockbusters. The Horrors have all summer to find you.',
    weather: 'hot/humid; thunderstorms; dog-day afternoons',
    flavor: 'school-just-let-out, bored teenagers, summer release schedule',
  },
  winter: {
    key: 'winter',
    label: 'Winter Break',
    blurb: 'Saturday, December 18, 1999 – Monday, January 3, 2000. (~17 days)',
    tutorialStart: new Date(1999, 11, 12),   // Sun Dec 12, 1999
    mainStartDay: 7,                          // Sat Dec 18, 1999
    endDay:       23,                         // Mon Jan 3, 2000
    short: 'Short, cold, frantic. Holiday rush, Y2K panic, awards-season prestige pictures.',
    weather: 'cold; snow; salted parking lots; black ice',
    flavor: 'holiday rush, Y2K dread, family in town, pre-millennium tension',
  },
  // #8: one campaign in three acts (summer → fall → winter break) to a NYE
  // showdown. summer/winter kept only for save back-compat + act date anchors;
  // chargen always uses 'campaign'. (Act transitions are narrative, built later.)
  campaign: {
    key: 'campaign',
    label: 'The Long Year',
    blurb: 'Summer 1999 \u2014 New Year\u2019s Eve 2000. Three acts: summer, fall, winter break.',
    tutorialStart: new Date(1999, 5, 6),
    mainStartDay: 7,
    endDay: 209,
    short: 'Three acts across one long year, building to the New Year\u2019s Eve showdown.',
    weather: 'shifts with the season \u2014 hot summer, crisp fall, hard winter',
    flavor: 'summer schedule \u2192 fall \u2192 holiday rush + Y2K dread, to NYE',
  },
};

// Add minutes to the world clock, rolling over hours and days.
// Advance the world clock. Always plays a brief "tick-tick" sfx to denote
// the passage of time, since a few seconds of UI changes alone can be hard
// to notice. Pass `silent: true` if you want to bump time without the sound
// (e.g. during chargen / scenario setup).
//

//═══════════════════════════════════════════════════════════════════════════
// STATS  —  the seven primary attributes
//═══════════════════════════════════════════════════════════════════════════
// ─── STATS ────────────────────────────────────────────────────────────────
// Order matters: this is the canonical iteration order for stat lists.
// Each stat has a short letter used as a one-key shorthand at the stat screen.
// ─── STATS ────────────────────────────────────────────────────────────────
//
// Seven core stats. Each starts at base 5 during chargen; point-buy max is 9.
// Final shown value = base + age modifier + hobby modifiers (cliques no longer
// modify stats per design TO-DO).
//
// LUCK is the chaos stat — used for random outcomes, surprise breaks, and
// escaping the worst rolls (e.g. "the horrors"). Doesn't usually fold into
// social or physical checks; it's its own dimension.
//
// To rename a stat label/short/desc: edit STAT_INFO below. The short letter
// is what shows in the stats partition column header — keep it 1 char.

// ─── DATA SOURCE: core/gameData.js (window.GameData) ───────────────────
// Stats, skills, hobbies, cliques, and age modifiers are NO LONGER hardcoded
// here — they're derived at load from the shared catalog in core/gameData.js
// so chargen, Saymaker, the dialogue runtime, and the game can never drift.
// To edit the actual data (add a skill, tune a gate, change a hobby bonus),
// edit core/gameData.js, not this file. The adapters below only reshape that
// catalog into the internal shapes chargen's logic already expects.
const _MD = (typeof window !== 'undefined' && window.GameData) ? window.GameData : null;
if (!_MD) console.error('[chargen] core/gameData.js (window.GameData) not loaded before chargen.js — load it first.');

const STAT_KEYS = _MD ? _MD.statKeys.slice() : ['brawn','reflexes','grit','intelligence','savvy','charm','luck'];
// chargen UI shows uppercase stat labels; the catalog stores title-case.
const STAT_INFO = (() => {
  const out = {};
  (_MD ? _MD.STATS : []).forEach(s => { out[s.key] = { label: s.label.toUpperCase(), short: s.short, desc: s.desc }; });
  return out;
})();

// ─── AGE BRACKETS ─────────────────────────────────────────────────────────
// Ages 15–22 map to one of three brackets. Modifiers are roughly net-zero
// across brackets, so no age is strictly best — they just lean differently.
//
// Renamed for clarity per design TO-DO. Old names are kept as an alias map
// so existing saves still resolve to the right bracket.

function ageBracket(age) {
  // #9: playable ages are 15-22 now. Three brackets across that span; the old
  // ADULT (26-30) bracket is gone. Internal KEYS stay MINOR/TEEN/TWENTIES so
  // AGE_MODS wiring + existing save files keep working.
  if (age >= 15 && age <= 17) return 'MINOR';
  if (age >= 18 && age <= 19) return 'TEEN';
  if (age >= 20 && age <= 22) return 'TWENTIES';
  return null;
}

// Legacy bracket-name aliases for save-file back-compat.
// (Old names: COLTISH, MAGNETIC, SETTLED, WEATHERED.)
const AGE_BRACKET_ALIASES = {
  COLTISH:   'MINOR',
  MAGNETIC:  'TEEN',
  SETTLED:   'TWENTIES',
  WEATHERED: 'ADULT',
};

// human-facing labels for the age brackets. The internal KEYS stay stable
// (MINOR/TEEN/TWENTIES/ADULT) so AGE_MODS wiring + save files keep working, but
// what the player SEES changed: old "Minor" (14-16) now reads "Teen", and old
// "Teen" (17-20) now reads "Adolescent".
// AGE BRACKET LABELS — what the player SEES for their age band. Keys
// (MINOR/TEEN/TWENTIES/ADULT) are internal (AGE_MODS + saves use them); only the
// strings below are shown. These center on AGE / life-stage rather than school.
// HOW TO MODIFY: edit the right-hand strings. (Alt palettes are noted in chat.)
const AGE_BRACKET_LABELS = {
  MINOR:    'Teen',            // 15-17
  TEEN:     'Young Adult',     // 18-19
  TWENTIES: 'Twentysomething', // 20-22
  ADULT:    'Adult',           // legacy / unused (ages capped at 22 now)
};
function bracketLabel(age) {
  const b = ageBracket(age);
  return b ? (AGE_BRACKET_LABELS[b] || b) : '—';
}

const AGE_MODS = _MD ? _MD.AGE_MODS : {
  MINOR:    { brawn: 0, reflexes:+1, grit:+1, intelligence:-1, savvy:-1, charm: 0, luck:+1, flavor: 'Wiry, energetic, still figuring people out.' },
  TEEN:     { brawn: 0, reflexes:+1, grit:-1, intelligence: 0, savvy:-1, charm:+1, luck: 0, flavor: 'Peak teen confidence. Less worldly than you act.' },
  TWENTIES: { brawn:-1, reflexes:-1, grit: 0, intelligence:+1, savvy:+1, charm: 0, luck: 0, flavor: 'Body cooling slightly, mind sharpening fast.' },
  ADULT:    { brawn:+1, reflexes:-1, grit: 0, intelligence: 0, savvy:+1, charm:-1, luck: 0, flavor: 'Filled out, seen things, less limber, less polished.' },
};

// ─── GENDER ───────────────────────────────────────────────────────────────
// Affects romance options and some general social compatibility. Brief
// blurbs are shown next to each option on the GENDER screen.
// Gender + orientation are now sourced from the shared catalog
// (core/gameData.js). Edit them there, not here.
const GENDER_OPTIONS = (_MD ? _MD.GENDERS : []).map(g => ({
  key: g.key, label: g.label, blurb: g.blurb,
  // chargen's custom-describe flow keys off label/'other'; flag carried through.
  selfDescribe: !!g.selfDescribe,
}));

// #2: PRONOUNS ARE TIED TO GENDER. A standard gender locks to its pronoun set;
// only the open-ended genders let you change pronouns (they/them) or supply your
// own. genderAllowedPronouns() returns the pronoun KEYS a gender may use; the
// first entry is that gender's default (applied automatically when gender changes).
const GENDER_PRONOUNS = {
  male: ['he'],
  female: ['she'],
  nonbinary: ['they', 'she', 'he', 'custom'],
  genderfluid: ['they', 'she', 'he', 'custom'],
  other: ['they', 'he', 'she', 'custom'],
};
function genderAllowedPronouns(gKey) { return GENDER_PRONOUNS[gKey] || ['they', 'custom']; }
function defaultPronounFor(gKey) { return genderAllowedPronouns(gKey)[0] || 'they'; }

// #2: the grammatical forms a CUSTOM pronoun set needs so the game can write
// sentences correctly. Pre-filled with they/them defaults; the player edits each.
const PRONOUN_FORMS = [
  { key: 'subj',     label: 'Subject',        eg: 'they  (they walk)',        def: 'they' },
  { key: 'obj',      label: 'Object',         eg: 'them  (you see them)',     def: 'them' },
  { key: 'poss',     label: 'Possessive',     eg: 'their  (their coat)',      def: 'their' },
  { key: 'possPron', label: 'Possessive (n.)',eg: 'theirs  (that is theirs)', def: 'theirs' },
  { key: 'reflex',   label: 'Reflexive',      eg: 'themself  (by themself)',  def: 'themself' },
];

// ─── SEXUAL ORIENTATION ───────────────────────────────────────────────────
// Affects which romance arcs open or close. There\'s no "best" answer —
// every option has storylines waiting for it.
const ORIENTATION_OPTIONS = (_MD ? _MD.ORIENTATIONS : []).map(o => ({
  key: o.key, label: o.label, blurb: o.blurb, attractedTo: o.attractedTo,
}));

//═══════════════════════════════════════════════════════════════════════════
// TOWN MAP  —  landmarks, districts, transit times. Used by LOCATION screen
// and (in the future) by the in-game navigation system.
//═══════════════════════════════════════════════════════════════════════════
// ─── TOWN MAP DATA ────────────────────────────────────────────────────────
// From MAP_Town.txt (Joe's master doc). The town is a 10×10 grid (cols A-J,
// rows 1-10). Each cell may be a landmark, residence area, or empty space.
// Districts are 4×3 blocks named for compass quadrants; Downtown straddles
// the center.
//
// Used by:
//   - LOCATION chargen screen (residence pick)
//   - Travel-time math (eventually — see TRAVEL_TIMES below)
//   - Neighbor proximity (history events)
//   - Friend/coworker home placement
//
// To extend: add new landmark cells to TOWN_LANDMARKS. The grid is referenced
// in code as `${col}${row}` (e.g. 'H3' for The Grande).

const TOWN_LANDMARKS = {
  // The Grande & Northpark Shopping Centre — the multiplex / mall (work location).
  H3: { name: 'The Grande & Northpark Shopping Centre',         kind: 'work',     blurb: 'The multiplex. Your workplace.' },
  // Bars & restaurants
  A4: { name: 'The Clock',                      kind: 'bar',      blurb: 'Cheap restaurant, local teen hangout. Will serve underage if you know the right people.', hours: '1p-3a daily, closed Tue' },
  D7: { name: 'Lighthouse Lounge',              kind: 'bar',      blurb: 'Classy cocktail bar atop the Resort. Preps, jocks, and hipsters in equal measure.', hours: '6p-12a Mon-Thu, 6p-2a Fri-Sat, closed Sun' },
  D9: { name: 'Bookstore / Coffee Shop',        kind: 'cafe',     blurb: 'Author signings, poetry slams, acoustic shows, open mics. Popular with everyone.', hours: '7a-9p Mon-Thu, 7a-11p Fri-Sun' },
  E8: { name: "Alden's",                        kind: 'bar',      blurb: 'Dive bar. Karaoke Wed-Sat.', hours: '4p-12a Mon-Thu, 4p-2a Fri-Sun' },
  E9: { name: 'The State',                      kind: 'landmark', blurb: 'Abandoned theatre with a mid-priced restaurant attached. Everyone wonders about the theatre.', hours: 'restaurant 5p-10p daily' },
  F8: { name: 'The Union',          kind: 'bar',      blurb: 'Bar with karaoke Thursdays, local shows Fri-Sat.', hours: '5p-12a Mon-Thu, 4p-2a Fri-Sun' },
  F9: { name: 'Cheap Restaurant',               kind: 'food',     blurb: 'Diner.', hours: '7a-11p daily, closes 2p Sun' },
  H4: { name: 'Cheaper Chain Restaurant',       kind: 'food',     blurb: 'You know the place.', hours: '10a-9p Mon-Thu, 10a-11p Fri-Sat, closed Sun' },
  I5: { name: 'Outdoorsy Store',                kind: 'shop',     blurb: 'Tents, tackle, hiking boots.', hours: '10a-9p daily' },
  // Wilderness / vandelay
  J6: { name: 'Vandelay Peaceful Rest Center',  kind: 'wilds',    blurb: 'Abandoned asylum and surrounding woods. Popular with goths and emos.' },
  J7: { name: 'Vandelay (wilds)',               kind: 'wilds',    blurb: 'Wooded edge of Vandelay grounds.' },
  J8: { name: 'Vandelay (wilds)',               kind: 'wilds',    blurb: 'Wooded edge of Vandelay grounds.' },
  J9: { name: 'Vandelay Medical Center',        kind: 'hospital', blurb: 'The hospital.', hours: '24/7' },
  // Grocery / parks
  F7: { name: 'Fredrick\'s',                    kind: 'shop',     blurb: 'Large regional chain grocery store.', hours: '8a-11p daily' },
  H7: { name: 'Fredrick\'s',                    kind: 'shop',     blurb: 'Large regional chain grocery store.', hours: '8a-11p daily' },
  C4: { name: 'Party Store',                    kind: 'shop',     blurb: 'Beer, smokes, scratch-offs.', hours: '12p-10p Mon-Thu, 10a-12a Fri-Sat, closed Sun' },
  A2: { name: 'Campground',                     kind: 'park',     blurb: 'Open to public 10a-5p. Semi-popular hangout and thoroughfare.' },
  F2: { name: 'Thrift Store',                   kind: 'shop',     blurb: 'Goodwill-type place.' },
  G10:{ name: 'East Bay Park',                  kind: 'park',     blurb: 'Park and beach. Officially 6a-10p but de-facto 24/7 for gatherings.' },
  H10:{ name: 'East Bay Park',                  kind: 'park',     blurb: 'Park and beach. Officially 6a-10p but de-facto 24/7 for gatherings.' },
  E6: { name: 'Neighborhood Park',              kind: 'park',     blurb: 'Has a playground and grills. Family spot.' },
  G5: { name: "Olga's",                         kind: 'shop',     blurb: 'Local organic grocery. Pricey. Hipster magnet.', hours: '8a-9p daily' },
};

// Districts (cell ranges) — used to group residence options.
const TOWN_DISTRICTS = [
  { key: 'upper_east', label: 'Upper East Side',  cells: ['F1','G1','H1','I1','J1','F2','G2','H2','I2','J2','F3','G3','I3','J3'] /* H3 is the multiplex */ },
  { key: 'east',       label: 'East Side',        cells: ['F4','G4','H4','I4','J4','F5','G5','H5','I5','J5','F6','G6','H6','I6','J6','F7','G7','I7','J7'] },
  { key: 'lower_east', label: 'Lower East Side',  cells: ['F8','G8','I8','J8','F9','G9','I9','J9','F10','G10','H10','I10','J10'] },
  { key: 'upper_west', label: 'Upper West Side',  cells: ['A1','B1','C1','D1','E1','A2','B2','C2','D2','E2','A3','B3','C3','D3','E3'] },
  { key: 'west',       label: 'West Side',        cells: ['A4','B4','C4','D4','E4','A5','B5','C5','D5','E5','A6','B6','C6','D6','E6','A7','B7','C7','D7','E7'] },
  { key: 'lower_west', label: 'Lower West Side',  cells: ['A8','B8','C8','D8','E8','A9','B9','C9','D9','E9','A10','B10','C10','D10','E10'] },
  { key: 'downtown',   label: 'Downtown',         cells: ['C8','C9','D8','E8','F8','F9'] },
];

// Bus stops — derived from MAP_Town.txt.
const BUS_STOPS = [
  { cell: 'H3', name: 'Northpark Shopping Centre' },
  { cell: 'D7', name: 'Resort' },
  { cell: 'B4', name: 'Near The Clock' },
];

// Travel-time formulas (spaces/5min + penalty). To compute time between
// cells A and B, count grid distance (Chebyshev or Manhattan; let's go
// Manhattan for simplicity), then apply the right formula below.
//
// Used eventually by the routine/work-shift system — not active yet.
const TRAVEL_TIMES = {
  walking: { spacesPer5: 2, randomEvery: null,  penaltyMin: 0  },
  biking:  { spacesPer5: 4, randomEvery: null,  penaltyMin: 0  },
  driving: { spacesPer5: 6, randomEvery: 4,     penaltyMin: 5  },  // +random 5min per 4 spaces (traffic)
  bussing: { spacesPer5: 5, everyN: 3,          penaltyMin: 5  },  // +5min per 3 spaces (stops)
  parents: { spacesPer5: 5, randomEvery: 4,     penaltyMin: 5  },
  taxi:    { spacesPer5: 6, randomEvery: 4,     penaltyMin: 5  },
  police:  { spacesPer5: 6, randomEvery: null,  penaltyMin: 0  },
};

// ─── LOCATIONS ("Where you live") ─────────────────────────────────────────
// Generated from master-doc residence options. Each entry is a (district,
// housing type) pair — the player picks one of these on chargen.
//
// Some downtown cells have specific named residences (e.g. above Alden's,
// noisy; above The Union, noisy). Those appear as their own entries.
// "Out of town" and "Way out of town" options add commute time but offer
// cheaper rent and quieter neighbors.
//
// To add a residence: append a new entry. `district` should match a key
// from TOWN_DISTRICTS (or null for special places like the Campground).
const _LOCATIONS_ALL = [
  // Upper East Side (F1-J3, excluding H3 which is the multiplex itself)
  { key: 'upper_east_apt',     district: 'upper_east', label: 'Upper East Side — apartment',
    blurb: 'Apartment in the Upper East Side. Quieter than downtown, walkable to Northpark Shopping Centre.' },
  { key: 'upper_east_rent',    district: 'upper_east', label: 'Upper East Side — rented house',
    blurb: 'A whole house, but it\'s the landlord\'s.' },
  { key: 'upper_east_own',     district: 'upper_east', label: 'Upper East Side — house (own)',
    blurb: 'You own this. Mortgage every month. Yours.' },
  { key: 'upper_east_parents', district: 'upper_east', label: 'Upper East Side — with parents',
    blurb: 'Free room. Free meals. Free questions about your hours.' },

  // East Side (F4-J7) — includes Olga's-apartment option at G5
  { key: 'east_apt',           district: 'east',       label: 'East Side — apartment',
    blurb: 'Middle-of-town apartment. Decent commute.' },
  { key: 'east_rent',          district: 'east',       label: 'East Side — rented house',
    blurb: 'Rented house, mid-priced.' },
  { key: 'east_own',           district: 'east',       label: 'East Side — house (own)',
    blurb: 'Your own house on the East Side.' },
  { key: 'east_parents',       district: 'east',       label: 'East Side — with parents',
    blurb: 'East Side, parents\' place. The good neighborhood.' },
  { key: 'above_olgas',        district: 'east',       cell: 'G5', label: "Apartment above Olga's",
    blurb: 'Smells like fresh bread some mornings. Medium-expensive rent.' },

  // Lower East Side (F8-J10)
  { key: 'lower_east_apt',     district: 'lower_east', label: 'Lower East Side — apartment',
    blurb: 'Apartment near the park and beach.' },
  { key: 'lower_east_rent',    district: 'lower_east', label: 'Lower East Side — rented house',
    blurb: 'Rented house close to East Bay.' },
  { key: 'lower_east_own',     district: 'lower_east', label: 'Lower East Side — house (own)',
    blurb: 'Owned house, lake breeze in summer.' },
  { key: 'lower_east_parents', district: 'lower_east', label: 'Lower East Side — with parents',
    blurb: 'Parents\' place near the beach.' },

  // Upper West Side (A1-E3)
  { key: 'upper_west_apt',     district: 'upper_west', label: 'Upper West Side — apartment',
    blurb: 'Quiet residential apartment.' },
  { key: 'upper_west_rent',    district: 'upper_west', label: 'Upper West Side — rented house',
    blurb: 'Rented house on the quiet side of town.' },
  { key: 'upper_west_own',     district: 'upper_west', label: 'Upper West Side — house (own)',
    blurb: 'Owned house on the Upper West.' },
  { key: 'upper_west_parents', district: 'upper_west', label: 'Upper West Side — with parents',
    blurb: 'Parents\' Upper West Side house. Suburb energy.' },

  // West Side (A4-E7)
  { key: 'west_apt',           district: 'west',       label: 'West Side — apartment',
    blurb: 'West Side apartment.' },
  { key: 'west_rent',          district: 'west',       label: 'West Side — rented house',
    blurb: 'Rented house, West Side.' },
  { key: 'west_own',           district: 'west',       label: 'West Side — house (own)',
    blurb: 'Owned house, West Side.' },
  { key: 'west_parents',       district: 'west',       label: 'West Side — with parents',
    blurb: 'Parents\' West Side house.' },

  // Lower West Side (A8-E10)
  { key: 'lower_west_apt',     district: 'lower_west', label: 'Lower West Side — apartment',
    blurb: 'Apartment in the Lower West.' },
  { key: 'lower_west_rent',    district: 'lower_west', label: 'Lower West Side — rented house',
    blurb: 'Rented house, Lower West Side.' },
  { key: 'lower_west_own',     district: 'lower_west', label: 'Lower West Side — house (own)',
    blurb: 'Your own Lower West house.' },
  { key: 'lower_west_parents', district: 'lower_west', label: 'Lower West Side — with parents',
    blurb: 'Parents\' Lower West house.' },

  // Downtown specials
  { key: 'downtown_c8',  district: 'downtown', cell: 'C8', label: 'Downtown — C8',
    blurb: 'Downtown apartment.' },
  { key: 'downtown_c9',  district: 'downtown', cell: 'C9', label: 'Downtown — C9',
    blurb: 'Downtown apartment.' },
  { key: 'downtown_d8',  district: 'downtown', cell: 'D8', label: 'Downtown — D8',
    blurb: 'Downtown apartment.' },
  { key: 'above_aldens', district: 'downtown', cell: 'E8', label: "Apartment above Alden's",
    blurb: 'Above the dive bar. NOISY — especially karaoke nights.' },
  { key: 'above_hannah', district: 'downtown', cell: 'F8', label: 'Apartment above The Union',
    blurb: 'Above the bar. NOISY — especially weekend shows.' },
  { key: 'downtown_f9',  district: 'downtown', cell: 'F9', label: 'Downtown — F9',
    blurb: 'Above the cheap restaurant. Smells like a diner.' },
  { key: 'resort',       district: 'downtown', cell: 'D7', label: 'Resort (D7) — $100/night',
    blurb: 'Expensive. The Lighthouse Lounge is one floor up. For the rare character with money to burn.' },
  { key: 'trailer_park', district: null, cell: 'D3', label: 'Trailer Park (D3-E4)',
    blurb: 'Cheap rent. The Clock is around the corner.' },
  { key: 'campground',   district: null, cell: 'A2', label: 'Campground (A2)',
    blurb: 'Living rough. Open to the public during daytime hours so privacy is limited.' },

  // Out of town options — universally add commute time, but cheaper.
  { key: 'oot_apt',     district: null, label: 'Out of Town — apartment',
    blurb: '+10min commute. Quieter. Cheaper rent.' },
  { key: 'oot_rent',    district: null, label: 'Out of Town — rented house',
    blurb: '+10min commute. Whole rented house.' },
  { key: 'oot_own',     district: null, label: 'Out of Town — house (own)',
    blurb: '+10min commute. Owned outright (or close to).' },
  { key: 'oot_parents', district: null, label: 'Out of Town — with parents',
    blurb: '+10min commute. Free room, far from work.' },

  { key: 'woot_apt',     district: null, label: 'Way Out of Town — apartment',
    blurb: '+15min commute. The cheapest options. Lowest disadvantage chance.' },
  { key: 'woot_rent',    district: null, label: 'Way Out of Town — rented house',
    blurb: '+15min commute. Whole rented house for cheap.' },
  { key: 'woot_own',     district: null, label: 'Way Out of Town — house (own)',
    blurb: '+15min commute. Owned house, way out.' },
  { key: 'woot_parents', district: null, label: 'Way Out of Town — with parents',
    blurb: '+15min commute. Free room, far away from everything.' },
];
// #10: house ownership removed — rent (apartment / rented house) or live with
// parents only. Strip every '*_own' residence so it never appears anywhere.
const LOCATIONS = _LOCATIONS_ALL.filter(l => !/_own$/.test(l.key));

// ─── HOBBIES ──────────────────────────────────────────────────────────────
// Each hobby provides STAT MODIFIERS (applied on top of age mods) and may
// influence clique sympathy or romance arcs.
//
// SHAPE:
//   { key, label, blurb,
//     mods: { brawn:+1, intelligence:-1, ... },          // stat changes
//     cliqueAffinity: { goth:+1, jock:-1, ... },  // rep-gain bias by clique
//     locksClique: 'stoner' | undefined,          // forces a clique pick
//   }
//
// At least 1 hobby is required. Up to 3 may be chosen. Modifiers stack.
//
// ─── TENURE AT THE GRANDE ─────────────────────────────────────────────────
// From master design doc. How long have you worked at the theatre? Affects
// task speed, customer service success rate, manager relationships, and
// some unlocked options. New (under 3 months) → Lifer (6+ years).
//
// AGE RULES (per master doc):
//   - 14 is the minimum age to work at the theatre.
//   - Managers must be 18+.
//   - Anyone with 2+ years tenure (key 'y2' and up) is AUTO-LOCKED into the
//     Oldhead clique regardless of age (see ageLockedClique() variant below).
//
// To add a tenure option: append an entry. `minYears` is used in calculations
// (commute familiarity, etc.).
const TENURE_OPTIONS = [
  { key: 'new',   label: 'New (1-3 months)',  shortLabel: 'new',        minYears: 0.1,  blurb: "Still figuring out where the spare reel cores are kept." },
  { key: 'm6',    label: '6 months',          shortLabel: '6mo',        minYears: 0.5,  blurb: "Long enough to be trusted on a register alone." },
  { key: 'm9',    label: '9 months',          shortLabel: '9mo',        minYears: 0.75, blurb: "Long enough that other staff stop asking if you're new." },
  { key: 'y1',    label: '1 year',            shortLabel: '1y',         minYears: 1,    blurb: "You've seen one full season cycle." },
  { key: 'y2',    label: '2 years',           shortLabel: '2y',         minYears: 2,    blurb: "You're an Oldhead now. The bowtie is in your bag." },
  { key: 'y3',    label: '3 years',           shortLabel: '3y',         minYears: 3,    blurb: "Newer staff ask you what to do." },
  { key: 'y4',    label: '4 years',           shortLabel: '4y',         minYears: 4,    blurb: "You can call out broken projectors by ear from the lobby." },
  { key: 'y5',    label: '5 years',           shortLabel: '5y',         minYears: 5,    blurb: "Managers from three years ago still come back to visit." },
  { key: 'y6',    label: '6+ years (Lifer)',  shortLabel: '6y+ Lifer',  minYears: 6,    blurb: "You ARE the institution." },
];

// Filter tenure options by age — younger players can't have 6 years.
// Maximum possible tenure: (age - 15) years (min working age is 15).
function tenureOptionsForAge(age) {
  if (!age) return TENURE_OPTIONS;
  const maxYears = Math.max(0, age - 15);
  // "New (1-3 months)" is always possible — even a brand-new 15-year-old hire.
  // (Its minYears is 0.1, so at age 15 the filter used to return NOTHING and
  // randomizeWholeCharacter() crashed on randPick([]).key — TODO BUG-18.)
  return TENURE_OPTIONS.filter(t => t.key === 'new' || t.minYears <= maxYears);
}

// #9: NO automatic Oldhead status any more — job tenure no longer force-locks
// the player into the Oldhead clique (they can still choose it). Kept as a
// function so callers don't change; it just always returns false now.
function tenureLocksOldhead(tenureKey) {
  return false;
}

// ─── HOBBIES (derived from core/gameData.js) ───────────────────────────────
// Reshaped from window.GameData.HOBBIES into chargen's working shape:
//   { key, label, blurb, mods, cliqueAffinity, locks }
// `locks` mirrors the catalog's `locksClique`. To edit hobby data, edit
// core/gameData.js — not here.
const HOBBIES = (_MD ? _MD.HOBBIES : []).map(h => ({
  key: h.key,
  label: h.label,
  blurb: h.blurb,
  mods: Object.assign({}, h.mods),
  cliqueAffinity: Object.assign({}, h.cliqueAffinity || {}),
  locks: h.locksClique || undefined,
  grantsSkills: (h.grantsSkills || []).slice(),
})).sort((a, b) => a.label.localeCompare(b.label));   // alphabetical in chargen

// ─── SKILLS (derived from core/gameData.js) ────────────────────────────────
// Reshaped from window.GameData.SKILLS into chargen's working shape.
//   reqStats       — copied from the catalog's gate.stats { stat:[min,max] }.
//   reqHobbiesAny  — hobbies that GRANT this skill for free (reversed from each
//                    hobby's grantsSkills in the catalog). Having any of these
//                    hobbies auto-includes the skill at no point cost.
// To edit skills/gates, edit core/gameData.js — not here.
const SKILLS = (() => {
  const md = _MD;
  if (!md) return [];
  // Reverse the hobby→grantsSkills map into skill→[hobbyKeys].
  const grantedBy = {};
  md.HOBBIES.forEach(h => (h.grantsSkills || []).forEach(sk => {
    (grantedBy[sk] = grantedBy[sk] || []).push(h.key);
  }));
  return md.SKILLS.map(s => {
    const out = { key: s.key, label: s.label, blurb: s.desc };
    if (s.gate && s.gate.stats) out.reqStats = JSON.parse(JSON.stringify(s.gate.stats));
    if (grantedBy[s.key]) out.reqHobbiesAny = grantedBy[s.key].slice();
    return out;
  }).sort((a, b) => a.label.localeCompare(b.label));   // alphabetical in chargen
})();

// ─── CLIQUES (derived from core/gameData.js) ───────────────────────────────
// Reshaped from window.GameData.CLIQUES. Cliques don't modify stats
// (mods:{}). `auto` marks age/tenure auto-assigned cliques (kid/oldhead).
// To edit clique data, edit core/gameData.js — not here.
const CLIQUES = (_MD ? _MD.CLIQUES : []).map(c => ({
  key: c.key,
  label: c.label,
  blurb: c.blurb,
  repBias: Object.assign({}, c.repBias || {}),
  mods: {},
  compatible: (c.compatible || []).slice(),
  auto: c.auto || undefined,
}));

// Kid and Oldhead are AUTO-assigned by age/tenure (never hand-picked), so the
// selectable clique LIST excludes any `auto` clique. CLIQUES itself still holds
// them for label lookups when one is auto-locked in.
const SELECTABLE_CLIQUES = CLIQUES.filter(c => !c.auto);

// ─── AGE & TENURE BASED CLIQUE LOCKS ──────────────────────────────────────
// Per design: Kid is automatic for ages 14-17. Oldhead is automatic for
// ages 28+ OR for tenure of 2+ years regardless of age.
//
// Pass age (and optionally tenureKey from State.character.tenure) — returns
// the clique key that's force-applied, or null if none.
function ageLockedClique(age, tenureKey) {
  if (tenureKey && tenureLocksOldhead(tenureKey)) return 'oldhead';
  if (age >= 15 && age <= 17) return 'kid';   // #9: no age-based Oldhead lock
  return null;
}

// ─── NAME POOL ────────────────────────────────────────────────────────────
// Used by random generation. 1999-appropriate names. Add freely.
// FIRST_NAMES now lives in stats/names.js (one editable pool shared by chargen
// random names AND tutorial NPCs). Reference it here with a tiny fallback in
// case that file failed to load.
const FIRST_NAMES = (typeof window !== 'undefined' && window.NamePool && window.NamePool.FIRST_NAMES)
  ? window.NamePool.FIRST_NAMES
  : ['Jordan','Casey','Taylor','Morgan','Sam','Alex','Jess','Kai'];

//═══════════════════════════════════════════════════════════════════════════
// HELPERS
//═══════════════════════════════════════════════════════════════════════════

//═══════════════════════════════════════════════════════════════════════════
// CHARGEN HELPERS
//═══════════════════════════════════════════════════════════════════════════
// ─── STAT TOTALS (with all modifiers applied) ─────────────────────────────
// Final stat = base (point-buy) + age + sum of hobby mods.
// Cliques no longer modify stats per design TO-DO. Legacy saves with
// clique.mods still get applied for back-compat — see CLIQUES table.
function statTotal(key) {
  const c = State.character;
  // Default to 5 if a stat is missing (handles legacy saves where 'luck'
  // didn't exist).
  let v = (c.stats[key] != null) ? c.stats[key] : 5;
  // Resolve old bracket names (COLTISH/MAGNETIC/SETTLED/WEATHERED) to new ones.
  let ag = ageBracket(c.age);
  if (ag && AGE_BRACKET_ALIASES[ag]) ag = AGE_BRACKET_ALIASES[ag];
  if (ag && AGE_MODS[ag]) v += AGE_MODS[ag][key] || 0;
  for (const hk of c.hobbies) {
    const h = HOBBIES.find(x => x.key === hk);
    if (h && h.mods && h.mods[key]) v += h.mods[key];
  }
  if (c.clique) {
    const cl = CLIQUES.find(x => x.key === c.clique);
    if (cl && cl.mods && cl.mods[key]) v += cl.mods[key];
  }
  return v;
}

// ─── SKILL ELIGIBILITY ────────────────────────────────────────────────────
// Returns null if eligible, else a string explaining why not.
// an ability is FREE when a hobby the player chose grants it (the hobby's
// grantsSkills lists this ability's key → reqHobbiesAny). Returns the granting
// hobby's label if free for this character, else null.
function abilityFreeFrom(skill) {
  const c = State.character;
  if (!skill.reqHobbiesAny || !skill.reqHobbiesAny.length) return null;
  const h = skill.reqHobbiesAny.find(hk => c.hobbies.includes(hk));
  if (!h) return null;
  const hobby = (typeof HOBBIES !== 'undefined') ? HOBBIES.find(x => x.key === h) : null;
  return hobby ? hobby.label : h;
}
// ensure every free ability is granted (cost 0) and drop free abilities the
// player no longer qualifies for (e.g. they removed the granting hobby). Free
// abilities never consume the shared budget and don't advance the paid-cost
// ladder (refreshSkillCostNext counts only paid picks via cost>0... we keep the
// ladder based on total picks but free ones are cost 0, so they don't drain
// budget).
// Called by toggleHobby() whenever the hobbies change (BUG-17: before that,
// dropping a hobby left its free ability stuck on the sheet).
function autoGrantFreeAbilities() {
  const c = State.character;
  if (!c.skills) c.skills = [];
  // Add any newly-free abilities not yet held.
  (typeof SKILLS !== 'undefined' ? SKILLS : []).forEach(s => {
    const free = abilityFreeFrom(s);
    const held = c.skills.find(x => x.key === s.key);
    if (free && !held) {
      c.skills.push({ key: s.key, paidFromStat: null, cost: 0, free: true });
    }
  });
  // Remove free-granted abilities whose granting hobby is gone.
  for (let i = c.skills.length - 1; i >= 0; i--) {
    const entry = c.skills[i];
    if (entry.free) {
      const s = SKILLS.find(x => x.key === entry.key);
      if (!s || !abilityFreeFrom(s)) c.skills.splice(i, 1);
    }
  }
}

function skillEligibility(skill) {
  const c = State.character;
  // Stat reqs
  if (skill.reqStats) {
    for (const k of Object.keys(skill.reqStats)) {
      const [lo, hi] = skill.reqStats[k];
      const v = statTotal(k);
      if (lo != null && v < lo) return `requires ${STAT_INFO[k].label} ≥ ${lo} (you have ${v})`;
      if (hi != null && v > hi) return `requires ${STAT_INFO[k].label} ≤ ${hi} (you have ${v})`;
    }
  }
  // Special case: trust_me_bro → any stat ≥ 8
  if (skill.key === 'trust_me_bro') {
    const max = Math.max(...STAT_KEYS.map(statTotal));
    if (max < 8) return `requires any one stat at 8+ (your highest is ${max})`;
  }
  // Hobby reqs (any-of)
  if (skill.reqHobbiesAny && skill.reqHobbiesAny.length) {
    if (!skill.reqHobbiesAny.some(h => c.hobbies.includes(h))) {
      const labels = skill.reqHobbiesAny.map(h => HOBBIES.find(x=>x.key===h).label).join(' or ');
      return `requires hobby: ${labels}`;
    }
  }
  // Hobby reqs (all-of)
  if (skill.reqHobbiesAll && skill.reqHobbiesAll.length) {
    for (const h of skill.reqHobbiesAll) {
      if (!c.hobbies.includes(h))
        return `requires hobby: ${HOBBIES.find(x=>x.key===h).label}`;
    }
  }
  return null;
}

// ─── HOBBY THAT LOCKS A CLIQUE ────────────────────────────────────────────
// Returns the locked clique key, or '' if no lock applies.
function lockedCliqueFromHobbies(hobbies) {
  for (const hk of hobbies) {
    const h = HOBBIES.find(x => x.key === hk);
    if (h && h.locksClique) return h.locksClique;
  }
  return '';
}

//═══════════════════════════════════════════════════════════════════════════
// CHARGEN HEADER  —  the "(so far: ...)" summary atop every chargen screen
//═══════════════════════════════════════════════════════════════════════════
// Like header() but also renders a one-line summary of the choices the
// player has made SO FAR in chargen. Used at the top of every chargen step
// so the player can see what they've already picked.
//
// To customize the summary fields shown: edit the field list below.
// chargen entered via debug RESPEC → backing out returns to the debug room
// with the ORIGINAL character. Returns true if it handled the exit.
function respecReturn(cancel) {
  if (!State._respecFromDebug) return false;
  State._respecFromDebug = false;
  if (typeof sfx !== 'undefined') sfx.back();
  if (cancel && State._debugCharSnapshot) { try { State.character = JSON.parse(JSON.stringify(State._debugCharSnapshot)); } catch (e) {} }
  if (typeof window.openDebugRoomFromMenu === 'function') window.openDebugRoomFromMenu(State.debugReturn || 'DEBUG_ROOM');
  else goto('DEBUG_ROOM_MAP');
  return true;
}

// Chargen title bar: "NEW GAME › <STEP>" over a full-width double rule. REVIEW is
// its only caller now. (The old wizard's "STEP k OF 7" counter, progress dots and
// running "so far" summary went away with the wizard screens on 2026-09-28.)
// HOW TO MODIFY: HW is the header width.
function chargenHeader(title) {
  const HW = 76;
  const stepName = String(title || '').replace(/^NEW GAME\s*[>\u203a]\s*/i, '');
  return '   ' + span('accent', 'NEW GAME  \u203a  ' + stepName) + '\n' +
         '   ' + span('accent', '\u2550'.repeat(HW));
}

//═══════════════════════════════════════════════════════════════════════════
// AUTO-RANDOM SHORTCUTS
//═══════════════════════════════════════════════════════════════════════════
// ─── tryAutoRandom — universal "build a random character" command ─────────
// Any chargen screen calls this at the top of handle(text). If the input
// matches one of the auto-build aliases, this fully randomizes the character
// and jumps to REVIEW, returning true so the screen knows the input was used.
//
// Two flavors:
//   AUTO_RANDOM_WORDS  → full random, ignores existing selections (jumps to REVIEW)
//   RAND_REST_WORDS    → fills in remaining fields only, preserving selections;
//                        does NOT jump to REVIEW, stays on the current screen
//
// To add a new alias: just append to the list below.
const AUTO_RANDOM_WORDS = ['auto','autoroll','randomize all','rand all','random all','all'];
const RAND_REST_WORDS   = ['randomize','random'];

function tryAutoRandom(text) {
  const t = text.toLowerCase().trim();
  if (AUTO_RANDOM_WORDS.includes(t)) {
    randomizeWholeCharacter();
    sfx.confirm();
    flash('Rolled a complete random character — review below.');
    goto('REVIEW');
    return true;
  }
  if (RAND_REST_WORDS.includes(t)) {
    randomizeRemainingCharacter();
    sfx.confirm();
    flash('Filled in remaining choices randomly (kept what you picked).');
    render();    // stay on current screen so player can review fills
    return true;
  }
  return false;
}

//═══════════════════════════════════════════════════════════════════════════
// FULL-CHARACTER RANDOMIZERS  —  called from REVIEW and from the title
//   (auto/random/randomize commands)
//═══════════════════════════════════════════════════════════════════════════
function randomizeWholeCharacter() {
  const c = State.character = blankCharacter();
  c.scenarioChoice = 'campaign';   // #8
  c.skipTutorial   = Math.random() < 0.4;
  c.introSeen      = true;
  c.townName = randPick(TOWN_NAMES);
  c.name = randPick(FIRST_NAMES);
  c.age  = randInt(15, 22);
  // Tenure depends on age — pick from valid options for this age.
  c.tenure = randPick(tenureOptionsForAge(c.age)).key;
  c.gender = randPick(GENDER_OPTIONS.filter(o => o.key !== 'other')).key;
  c.pronouns = defaultPronounFor(c.gender);   // #2: pronouns consistent with the rolled gender
  c.orientation = randPick(ORIENTATION_OPTIONS).key;
  c.location = randPick(LOCATIONS).key;
  c.hobbies  = randPickN(HOBBIES, randInt(1, 3)).map(h => h.key);
  randomizeStats();
  randomizeSkills();
  // Clique resolution priority:
  //   1. Age lock (Kid for 14-17, Oldhead for 28+) — design rule, hard-locked.
  //   2. Hobby lock (Mega-Stoner→Stoner, Mallrat→Mallrat, etc).
  //   3. Random pick (with small chance of no clique).
  const ageLock = ageLockedClique(c.age, c.tenure);
  const hobbyLock = lockedCliqueFromHobbies(c.hobbies);
  c.clique = ageLock
    || hobbyLock
    || (Math.random() < 0.125 ? '' : randPick(CLIQUES.filter(x => !x.auto)).key);
}

// Randomize ONLY the fields that haven't been set yet. Preserves any choice
// the player has already made on prior chargen screens.
//
// USAGE: each chargen screen can invoke this on the alias "randomize"
// (single word, NOT in AUTO_RANDOM_WORDS) — see tryRandomizeRest below.
function randomizeRemainingCharacter() {
  const c = State.character;
  if (!c.scenarioChoice) c.scenarioChoice = 'campaign';   // #8
  if (c.skipTutorial === undefined || c.skipTutorial === null) c.skipTutorial = Math.random() < 0.4;
  if (!c.townName)    c.townName = randPick(TOWN_NAMES);
  if (!c.name)        c.name = randPick(FIRST_NAMES);
  if (!c.age)         c.age  = randInt(15, 22);
  if (!c.tenure)      c.tenure = randPick(tenureOptionsForAge(c.age)).key;
  if (!c.gender)      c.gender = randPick(GENDER_OPTIONS.filter(o => o.key !== 'other')).key;
  if (!c.pronouns || (c.pronouns === 'custom' && !c.customPronounForms) || genderAllowedPronouns(c.gender).indexOf(c.pronouns) < 0) c.pronouns = defaultPronounFor(c.gender);   // #2
  if (!c.orientation) c.orientation = randPick(ORIENTATION_OPTIONS).key;
  if (!c.location)    c.location = randPick(LOCATIONS).key;
  if (!c.hobbies || !c.hobbies.length) {
    c.hobbies = randPickN(HOBBIES, randInt(1, 3)).map(h => h.key);
  }
  // Stats — only randomize if all stats are still at base 5
  const isBase = STAT_KEYS.every(k => c.stats[k] === 5);
  if (isBase) randomizeStats();
  // Skills — only randomize if no skills picked yet
  if (!c.skills || !c.skills.length) randomizeSkills();
  // Clique — fill in if blank, honoring locks
  if (!c.clique) {
    const ageLock = ageLockedClique(c.age, c.tenure);
    const hobbyLock = lockedCliqueFromHobbies(c.hobbies);
    c.clique = ageLock
      || hobbyLock
      || (Math.random() < 0.125 ? '' : randPick(CLIQUES.filter(x => !x.auto)).key);
  }
}

//═══════════════════════════════════════════════════════════════════════════
// INTRO CRAWL  —  shown immediately on NEW GAME, before chargen starts
//═══════════════════════════════════════════════════════════════════════════
// be replayed from the title (`intro` keyword) or REVIEW screen.
//
// The "-re" word endings (Grande, Centre) become a recurring small joke in
// NPC dialogue later — laid down here as a quiet seed.
//
// To tweak the crawl text: just edit the INTRO_LINES array. Each entry is
// a paragraph that will be word-wrapped into the frame.

// Star Wars / Zelda-1 style opening crawl. The TITLE_BLOCK is big block-letter
// "MIDNIGHT AT THE MULTIPLEX" displayed at the top. The CRAWL is in-world
// scene-setting prose — mood, place, era, vibe — NOT a pitch and NOT direct
// mention of mall/theatre names (those are introduced in the actual game).
//
// To tweak: edit CRAWL_PARAGRAPHS below. Each entry is one paragraph that
// will be word-wrapped to fit the frame.

const INTRO_TITLE_BLOCK = [
  'MIDNIGHT',
  'AT THE',
  'MULTIPLEX',
];

// ────────────────────────────────────────────────────────────────────────────
//  ╔══════════════════════════════════════════════════════════════════════╗
//  ║  HOW TO EDIT THE OPENING CRAWL                                       ║
//  ║                                                                      ║
//  ║  ►► THIS FILE: core/chargen.js                                       ║
//  ║                                                                      ║
//  ║  CRAWL_PARAGRAPHS below is the text that scrolls up the screen when  ║
//  ║  the player picks "New Game" from the title menu.                    ║
//  ║                                                                      ║
//  ║  Each entry in the array is one paragraph (or a blank line, when     ║
//  ║  the entry is "").  The renderer wraps each paragraph to fit the     ║
//  ║  panel automatically — just write naturally, no manual line breaks.  ║
//  ║                                                                      ║
//  ║  The scroll animation runs for CRAWL_DURATION_SEC seconds (defined   ║
//  ║  in midmulti.html → @keyframes intro-crawl). Bump that value to      ║
//  ║  slow the scroll down, or shrink it to speed it up.                  ║
//  ║                                                                      ║
//  ║  The title block above the crawl is INTRO_TITLE_BLOCK — replace it   ║
//  ║  if you want different ASCII-art lettering.                          ║
//  ║                                                                      ║
//  ║  WRITING GUIDELINES:                                                 ║
//  ║   - This is setting background only. The PLAYER hasn't been created  ║
//  ║     yet. Do not imply anything about the player's history, age,      ║
//  ║     tenure at the multiplex, or relationships with anyone there.    ║
//  ║   - The town, the year, the building — those are fair game.         ║
//  ║   - End with something atmospheric that doesn't presume anything.   ║
//  ╚══════════════════════════════════════════════════════════════════════╝
const CRAWL_PARAGRAPHS = [
  "It's 1999.",
  "",
  "In a small town far from anywhere that makes the news.",
  "",
  "Tucked into the corner of a mid-sized shopping mall stands a movie theater. Eight screens. Carpet that smells like butter and spilled soda. A marquee with a couple of bulbs burned out.",
  "",
  "It's the kind of place where the projector hums late into the night, where the lobby lights buzz, where the smell of popcorn never fully fades.",
  "",
  "The new century is coming. The seasonal blockbusters are coming. For now, though, the town is just the town, and the theater is just the theater.",
  "",
  "Most nights, nothing happens here.",
  "",
  "Most nights.",
];

//═══════════════════════════════════════════════════════════════════════════
// CHARGEN SCREENS
//═══════════════════════════════════════════════════════════════════════════

Screens.INTRO = {
  render() {
    // start the one-shot opening-crawl music (no looping). Stopped in
    // handle() on exit and defensively when leaving the screen. try/catch so a
    // browser blocking audio-before-gesture never breaks the crawl.
    try { if (window.CrawlMusic) window.CrawlMusic.start(); } catch (e) {}
    // The intro is rendered as raw HTML rather than as plain text (the way
    // most other screens are) because we need an animated container for the
    // Star-Wars-style scroll. The terminal's #display is a <pre>, but block
    // elements with their own CSS animations inside a <pre> render fine in
    // every modern browser; the <pre> just preserves whitespace around the
    // injected blocks.
    //
    // ── HOW THE LAYOUT WORKS ──────────────────────────────────────────
    // The .intro-crawl-viewport is a tall fixed-height window. Inside it,
    // .intro-crawl starts BELOW the visible area and animates upward over
    // ~50 seconds. The title (INTRO_TITLE_BLOCK) sits at the TOP of the
    // crawl block, so it scrolls up first, followed by the paragraphs.
    // CSS in midmulti.html handles the perspective-style scale (text
    // appears larger when it enters at the bottom and shrinks as it
    // recedes toward the top of the viewport).
    //
    // After the crawl animation finishes, a pulsing
    // "TYPE 'continue' TO BEGIN" prompt fades in centered in the viewport.
    //
    // Word-wrap. #2: widened so many more words fit per line (the crawl text
    // is also enlarged via CSS). The viewport is wider than the old 64-col
    // column; 92 keeps paragraphs readable without looking like a thin ribbon.
    // #6a/#6b: lines should carry LOTS of text, and no paragraph should end with
    // a lonely orphan (one or two short words on their own line). We wrap at a
    // generous width, then if the final line is too short, pull words back up.
    const W = 300;                       // very wide; CSS width + smaller font do the visual wrapping
    const ORPHAN_MINLEN = 18;            // a final line shorter than this looks orphaned
    const wrap = (s) => {
      if (!s) return [''];
      const words = s.split(' ');
      const out = [];
      let line = '';
      for (const w of words) {
        if ((line + ' ' + w).trim().length > W) { out.push(line.trim()); line = w; }
        else { line = (line + ' ' + w).trim(); }
      }
      if (line) out.push(line.trim());
      // Orphan fix: while the LAST line is too short and there's a line above it,
      // merge them (the CSS will re-wrap the combined text more evenly).
      while (out.length >= 2 && out[out.length - 1].length < ORPHAN_MINLEN) {
        const last = out.pop();
        out[out.length - 1] = (out[out.length - 1] + ' ' + last).trim();
      }
      return out;
    };

    // The TITLE BLOCK goes inside the crawl. It scrolls up with the rest
    // of the text. Each line gets the accent color and rendered in a
    // bigger class for visual hierarchy.
    // #6c: "AT THE" is rendered smaller than the rest of the title. We special-
    // case any title line that is exactly "AT THE MULTIPLEX" so "AT THE" shrinks
    // while "MULTIPLEX" stays full size.
    const titleHtml = INTRO_TITLE_BLOCK.map(ln => {
      const up = (ln || '').toUpperCase();
      if (up === 'AT THE') {
        return '<div class="intro-title-line intro-title-small">AT THE</div>';
      }
      return '<div class="intro-title-line">' + escHTML(ln) + '</div>';
    }).join('');

    // Build the crawl content as HTML (one wrapped paragraph per div).
    const crawlBody = CRAWL_PARAGRAPHS.map(para => {
      if (!para) return '<div class="intro-blank">&nbsp;</div>';
      return wrap(para).map(line =>
        '<div class="intro-line">' + escHTML(line) + '</div>'
      ).join('');
    }).join('');

    // Assemble. The viewport is the visible window; the .intro-crawl div
    // inside it starts below the visible area and animates upward.
    return [
      '',
      '<div class="intro-crawl-viewport">',
      '  <div class="intro-crawl">',
      '    <div class="intro-title-block">' + titleHtml + '</div>',
      '    <div class="intro-title-spacer">&nbsp;</div>',
      '    <div class="intro-body">' + crawlBody + '</div>',
      '  </div>',
      '  <div class="intro-pulse" id="intro-pulse-prompt">',
      '    <div class="intro-pulse-line">TYPE  <b>continue</b>  TO BEGIN</div>',
      '    <div class="intro-pulse-sub">or  <i>back</i></div>',
      '  </div>',
      '</div>',
      '',
      '   ' + span('accent', '[ continue ]') + '   on to character creation',
      '   ' + span('accent', '[ back ]') + '       return to the title',
    ].join('\n');
  },
  handle(text) {
    // The crawl used to advance on Enter / empty input, which meant any
    // accidental keypress (Enter held, click-and-type-anything) skipped
    // the whole opening. Now the player has to actually type one of the
    // commands. Empty input and unknown commands do nothing.
    const t = text.trim().toLowerCase();
    const c = State.character;
    // any exit from the crawl stops its music immediately.
    const stopMusic = () => { try { if (window.CrawlMusic) window.CrawlMusic.stop(); } catch (e) {} };
    if (t === 'back')                       { stopMusic(); sfx.back();    MultiplexGame.hide(); return; }
    if (t === 'continue' || t === 'c' ||
        t === 'next' || t === 'go' ||
        t === 'begin' || t === 'start')     { stopMusic(); c.introSeen = true; c.scenarioChoice = c.scenarioChoice || 'campaign'; c.tenure = c.tenure || 'new'; c.townName = ''; sfx.confirm(); goto('CHARSHEET'); return; }   // #8 skip SCENARIO + #11 no town-name; straight to the consolidated CHARSHEET
    // Anything else — silently ignore. We deliberately don't error-flash
    // so a player accidentally typing into the terminal during the crawl
    // doesn't get visual noise.
  }
};

// ─── CHARGEN HELPERS ──────────────────────────────────────────────────────────
// (The old step-by-step wizard screens — SCENARIO, SETTING, IDENTITY, TENURE,
// PROFILE, INTERESTS, ATTRIBUTES/STATS/SKILLS, SKILL_PAY — were removed on
// 2026-09-28: New Game goes INTRO → CHARSHEET → REVIEW. See git history for them.)

// Wave: chargen cursor styling (clickable [-]/[+] + ability rows, focus highlight).
// Injected once. Tweak the colors/highlight here.
function ensureChargenCursorCSS() {
  if (document.getElementById('chargen-cursor-css')) return;
  const st = document.createElement('style'); st.id = 'chargen-cursor-css';
  st.textContent =
    '.cg-row{cursor:pointer;border-radius:2px;}' +
    '.cg-row:hover{background:rgba(120,200,120,0.10);}' +
    '.cg-row-focus{background:rgba(120,200,120,0.18);box-shadow:inset 2px 0 0 #7CFC7C;}' +
    '.cg-btn{cursor:pointer;border-radius:2px;}' +
    '.cg-btn:hover{background:rgba(160,220,160,0.30);}' +
    '.cg-pm{color:#9fe89f;font-weight:bold;}' +
    '.cg-act{padding:0 3px;font-weight:bold;letter-spacing:0.5px;}' +
    // action buttons (ROLL/AUTO/BACK/DONE) are bold + more prominent;
    // the focused one gets a bright inverse chip so it reads as the active control.
    '.cg-act.cg-row-focus{background:#7CFC7C;color:#06210a;box-shadow:none;border-radius:3px;}';
  document.head.appendChild(st);
}

// MUTUALLY-EXCLUSIVE picks — real-world tensions where you can't
// credibly be both. Adding one swaps out / blocks the other. Use reasonable
// judgment when extending these groups. HOW TO MODIFY: add a [keyA, keyB, ...]
// group; everything in a group is mutually exclusive.
const EXCLUSIVE_HOBBIES = [
  ['pc_gamer', 'console_gamer'],     // platform partisans (very 1999)
];
const EXCLUSIVE_ABILITIES = [
  ['night_owl', 'morning_person'],   // opposite chronotypes
];
function areExclusiveHobbies(a, b) { return a !== b && EXCLUSIVE_HOBBIES.some(g => g.includes(a) && g.includes(b)); }
function areExclusiveAbilities(a, b) { return a !== b && EXCLUSIVE_ABILITIES.some(g => g.includes(a) && g.includes(b)); }

// Point-buy: raise/lower one stat from the shared pool (base 5, max 9).
function adjustStat(key, delta) {
  const c = State.character;
  if (delta > 0) {
    if (c.points <= 0) { sfx.error(); flash('No points left.'); return; }
    if (c.stats[key] >= 9) { sfx.error(); flash('That stat is at the point-buy max (9).'); return; }
    c.stats[key]++; c.points--; sfx.type(); render();
  } else {
    if (c.stats[key] <= 5) { sfx.error(); flash('Floor for point buy is 5.  Type "reset" to redo.'); return; }
    c.stats[key]--; c.points++; sfx.type(); render();
  }
}
function randomizeStats() {
  const c = State.character;
  c.stats = { brawn:5, reflexes:5, grit:5, intelligence:5, savvy:5, charm:5, luck:5 };
  c.points = 12;
  // Leave 1-3 points reserved for skills sometimes; otherwise spend most/all.
  const reserve = randPick([0, 0, 0, 1, 2, 3]);
  // #8: give each roll a random FOCUS (1-3 favored stats) and land ~70% of the
  // points there, so builds have genuine peaks and valleys instead of everyone
  // hovering at 6-7. The remaining points scatter for a bit of texture.
  const favored = randPickN(STAT_KEYS, randInt(1, 3)).map(o => (o && o.key) ? o.key : o);
  let guard = 300;
  while (c.points > reserve && guard-- > 0) {
    const k = (favored.length && Math.random() < 0.7) ? randPick(favored) : randPick(STAT_KEYS);
    if (c.stats[k] < 9) { c.stats[k]++; c.points--; }
  }
}

// ─── SKILL COST PROGRESSION ───────────────────────────────────────────────
// Skills are paid from the SAME budget as stats — anything you don't spend
// on stats becomes your skill budget. Cost doubles each pick:
//   1st skill   = 1 point
//   2nd skill   = 2 points
//   3rd skill   = 4 points
//   4th skill   = 8 points
//   5th skill   = 16 points
// Doubling makes deep skill stacks expensive on purpose — typical chargen
// budget is 12 points across both, so a maxed-stats build is usually 1-2
// skills, while a stat-light build can get 3-4.
//
// nthIndex is 1-based: the FIRST skill picked has nthIndex=1 (cost 1).
function skillCostFor(nthIndex) {
  return Math.pow(2, nthIndex - 1);   // 1, 2, 4, 8, 16, ...
}

// Refresh c.skillCostNext given current skill count.
function refreshSkillCostNext() {
  const c = State.character;
  c.skillCostNext = skillCostFor(c.skills.length + 1);
}

function randomizeSkills() {
  const c = State.character;
  // Refund existing first
  while (c.skills.length) {
    const taken = c.skills.pop();
    c.points += taken.cost;
  }
  refreshSkillCostNext();

  // Pick eligible skills until budget runs out or we hit ~3-4 skills.
  while (c.skills.length < 4) {
    const cost = c.skillCostNext;
    if (c.points < cost) break;
    const eligible = SKILLS.filter(s =>
      skillEligibility(s) === null &&
      !c.skills.find(x => x.key === s.key) &&
      !c.skills.find(x => areExclusiveAbilities(x.key, s.key))   // never auto-pick BOTH of an exclusive pair (e.g. Night Owl + Morning Person)
    );
    if (!eligible.length) break;
    const skill = randPick(eligible);
    c.points -= cost;
    c.skills.push({ key: skill.key, paidFromStat: null, cost });
    refreshSkillCostNext();
    // 40% chance to stop after each pick so we don't always max out
    if (Math.random() < 0.4) break;
  }
}

// ─── TRAIT TOGGLES (the CHARSHEET trait modals) ───────────────────────────────
// Pick / unpick a hobby, clique or ability on the character being built, with all
// the rules applied: max 3 hobbies, mutually-exclusive picks, hobby clique locks,
// the shared point pool. Each one re-renders, or flashes why it can't.
// (These used to be methods on the old step-by-step INTERESTS / ATTRIBUTES wizard
// screens; CHARSHEET._modalToggle() is now their only caller.)
// Only HOBBY locks bind the clique; the age clique (Kid) is a soft default.
function hobbyCliqueLock() { return lockedCliqueFromHobbies(State.character.hobbies); }
function hobbyCliqueLockObj() { const l = hobbyCliqueLock(); return l ? CLIQUES.find(x => x.key === l) : null; }
function cliqueIncompatibleWithLock(key) {
  const lock = hobbyCliqueLock(); if (!lock || key === lock) return false;
  const lockObj = hobbyCliqueLockObj();
  if (lockObj && lockObj.auto) { const o = CLIQUES.find(x => x.key === key); return !!(o && o.auto); }
  return !lockObj.compatible.includes(key);
}
function toggleHobby(h) {
  const c = State.character;
  const idx = c.hobbies.indexOf(h.key);
  if (idx >= 0) { c.hobbies.splice(idx, 1); sfx.back(); }
  else {
    if (c.hobbies.length >= 3) { sfx.error(); flash('Max 3 hobbies.'); return; }
    // #4: exclusivity — if an exclusive partner is already chosen, BLOCK this
    // pick (rather than silently swapping) so the tension is obvious; the row
    // shows [█] and the player drops the other first. See EXCLUSIVE_HOBBIES.
    const conflict = c.hobbies.find(k => areExclusiveHobbies(k, h.key));
    if (conflict) { sfx.error(); const cn = (HOBBIES.find(x => x.key === conflict) || {}).label || conflict; flash('Blocked by ' + cn + ' \u2014 mutually exclusive. Drop it first.'); return; }
    c.hobbies.push(h.key); sfx.type();
  }
  autoGrantFreeAbilities();   // hobby-granted abilities follow the hobbies (BUG-17)
  render();
}
function toggleClique(cl) {
  const c = State.character;
  const lock = hobbyCliqueLock(); const lockObj = hobbyCliqueLockObj();
  if (cliqueIncompatibleWithLock(cl.key)) { sfx.error(); flash(cl.label + ' is incompatible with ' + (lockObj ? lockObj.label : 'your lock') + '.'); return; }
  if (lock) {
    if (cl.key === lock) { sfx.type(); flash('You\u2019re already in ' + cl.label + ' (locked in).'); return; }
    c.secondClique = (c.secondClique === cl.key) ? '' : cl.key; sfx.type(); render(); return;
  }
  c.clique = (c.clique === cl.key) ? '' : cl.key; c.secondClique = ''; sfx.type(); render();
}
function toggleAbility(skill) {
  const c = State.character;
  const idx = c.skills.findIndex(x => x.key === skill.key);
  if (idx >= 0) {
    const taken = c.skills[idx];
    if (taken.free || taken.cost === 0) { sfx.error(); flash('Free from a hobby \u2014 change the hobby to remove it.'); return; }
    c.points += taken.cost; c.skills.splice(idx, 1); refreshSkillCostNext();
    sfx.back(); flash('Dropped ' + skill.label + ' (refunded ' + taken.cost + ').'); render(); return;
  }
  if (abilityFreeFrom(skill)) { c.skills.push({ key: skill.key, paidFromStat: null, cost: 0, free: true }); sfx.confirm(); render(); return; }
  // block an ability that's mutually exclusive with one already taken
  // (e.g. Night Owl vs Morning Person). The player drops the other first.
  const xconf = c.skills.find(s => areExclusiveAbilities(s.key, skill.key));
  if (xconf) { const xn = (SKILLS.find(x => x.key === xconf.key) || {}).label || xconf.key; sfx.error(); flash('Can\u2019t take both ' + skill.label + ' and ' + xn + ' \u2014 drop one first.'); return; }
  const reason = skillEligibility(skill); if (reason) { sfx.error(); flash('Not eligible: ' + reason); return; }
  const cost = c.skillCostNext; if (c.points < cost) { sfx.error(); flash('Need ' + cost + ', you have ' + c.points + '.'); return; }
  c.points -= cost; c.skills.push({ key: skill.key, paidFromStat: null, cost }); refreshSkillCostNext();
  sfx.confirm(); flash('Got ' + skill.label + ' (cost ' + cost + ').'); render(); return;
}
// ════════════════════════════════════════════════════════════════════════════
// Screens.CHARSHEET — the consolidated, single-screen character creator.
// Replaces the old multi-step wizard's separate screens with ONE screen the
// player navigates with ↑/↓ (or click) to move between elements and ←/→ (or
// click [−]/[+]) to change the focused one. Traits (hobby/clique/abilities)
// open the existing modal screens over this one. Matches Joe's mockups in
// SPIRIT (retro console look — NOT a literal copy of the PowerPoint boxes).
//
// LAYOUT (kept inside the console's monospace frame):
//   • top identity block : NAME · AGE · GENDER · ORIENTATION
//   • living / social     : LIVES (housing+place) · HOBBY · CLIQUE
//   • two columns         : EQUIPMENT slots (left)  ·  STATS w/ [−]/[+] (right)
//   • bottom explainer    : describes whatever element is focused (the mockup's
//                           bottom "tutorial text" area)
//   • action bar          : DONE · RANDOMIZE · BACK
//
// HOW TO MODIFY:
//   • _els() builds the ↑/↓ navigation order — reorder / add elements there.
//   • _cycle()/adjustStat() change values; _explain() supplies the bottom text.
//   • Equipment is a placeholder system for now (slots render but aren't wired);
//     when the equipment/inventory system lands, populate EQUIP_SLOTS + _equipLabel.
// ════════════════════════════════════════════════════════════════════════════
const EQUIP_SLOTS = ['HAT', 'SHIRT', 'JACKET', 'BELT', 'PANTS', 'SHOES', 'ACCESSORY', 'ACCESSORY'];

Screens.CHARSHEET = {
  // ── navigation model: a flat, ordered list of focusable elements ──────────
  _els() {
    const els = [
      { type: 'name' }, { type: 'age' }, { type: 'gender' }, { type: 'pronouns' }, { type: 'orientation' },
      { type: 'location' },
    ];
    STAT_KEYS.forEach(k => els.push({ type: 'stat', key: k }));
    els.push({ type: 'abil' });     // #4: abilities sit WITH stats now (shared-pool enclosure), end of LEFT column
    els.push({ type: 'hobby' });    // #4: RIGHT column (hobbies → clique → equipment)
    els.push({ type: 'clique' });
    // #8: equipment is NOT selectable during chargen (set in-game) — omitted from nav.
    els.push({ type: 'act', act: 'done', label: 'DONE \u25b8' });
    els.push({ type: 'act', act: 'random', label: 'RANDOMIZE' });
    els.push({ type: 'act', act: 'back', label: 'BACK' });
    return els;
  },
  _clamp() {
    if (State.cg == null) State.cg = { cur: 0 };
    const n = this._els().length;
    if (State.cg.cur < 0) State.cg.cur = 0;
    if (State.cg.cur > n - 1) State.cg.cur = n - 1;
  },

  // ── value changers ────────────────────────────────────────────────────────
  _cycle(field, opts, keyProp, dir) {
    const c = State.character;
    if (!opts.length) return;
    const cur = opts.findIndex(o => o[keyProp] === c[field]);
    const next = (cur < 0 ? 0 : (cur + dir + opts.length) % opts.length);
    c[field] = opts[next][keyProp];
    if (field === 'gender') { c.pronouns = defaultPronounFor(c[field]); }   // #2: pronouns derive from gender (locked for he/she; open for they/custom)
    sfx.type(); render();
  },
  // bug2: cycle the PRONOUNS field (he/she/they/custom). Starts from the explicit
  // choice or, if none yet, the gender-derived default.
  _cyclePronouns(dir) {
    const c = State.character;
    const allowed = genderAllowedPronouns(c.gender);
    // #2: a gender with a single pronoun set (he/she) is LOCKED — don't cycle,
    // just explain. Otherwise step through only the pronouns this gender allows.
    if (allowed.length <= 1) { sfx.error(); flash('Pronouns follow your gender here \u2014 choose a different gender to change them.'); return; }
    let cur = allowed.indexOf(c.pronouns); if (cur < 0) cur = 0;
    c.pronouns = allowed[(cur + dir + allowed.length) % allowed.length];
    if (c.pronouns === 'custom') { this._openPronounModal(); return; }
    sfx.type(); render();
  },
  // #2: CUSTOM PRONOUN MODAL — collects every grammatical form the game needs so
  // it can write the player into sentences correctly. Pre-seeds from any prior
  // custom set, else they/them defaults.
  _openPronounModal() {
    const c = State.character;
    const seed = c.customPronounForms || {};
    State.cg.pronounModal = { cur: 0, forms: PRONOUN_FORMS.map(fm => ({ key: fm.key, val: (seed[fm.key] || fm.def) })) };
    sfx.select(); render();
  },
  _closePronounModal(save) {
    const c = State.character, m = State.cg.pronounModal;
    if (save && m) {
      const out = {}; m.forms.forEach(fm => { out[fm.key] = (fm.val || '').trim() || PRONOUN_FORMS.find(p => p.key === fm.key).def; });
      c.customPronounForms = out;
      c.customPronouns = out.subj + ' / ' + out.obj;   // short label for the sheet
      c.pronouns = 'custom';
    } else if (m) {
      // cancelled with nothing defined yet -> fall back to they/them
      if (!c.customPronounForms) c.pronouns = (genderAllowedPronouns(c.gender).indexOf('they') >= 0) ? 'they' : defaultPronounFor(c.gender);
    }
    State.cg.pronounModal = null; sfx.back(); render();
  },
  _pronounModalBox() {
    const m = State.cg.pronounModal, W = 64;
    // (BUG-1: this used a btn() helper that only existed inside other render
    // functions, so opening custom pronouns threw "btn is not defined".)
    const btn = (action, label, cls) => '<span class="cg-btn ' + (cls || '') + '" data-cg="' + action + '">' + label + '</span>';
    const bord = (l, r) => span('frame', l + '\u2500'.repeat(W) + r);
    const padLine = (txt) => span('frame', '\u2502') + txt + ' '.repeat(Math.max(0, W - stripTags(txt).length)) + span('frame', '\u2502');
    const lines = [];
    lines.push(bord('\u250c', '\u2510'));
    lines.push(padLine(span('accent', ' YOUR PRONOUNS')));
    wrapWords('Type each form so the game can write you correctly. Examples are shown in grey; edit any field.', W - 3).forEach(l => lines.push(padLine(' ' + span('stat-name', l))));
    lines.push(bord('\u251c', '\u2524'));
    PRONOUN_FORMS.forEach((fm, i) => {
      const foc = (i === m.cur), val = m.forms[i].val || '';
      const label = pad(fm.label, 16);
      const field = span(foc ? 'accent' : 'stat-value', (val || (foc ? '' : '\u2014')) + (foc ? '_' : ''));
      const eg = span('stat-name', '   e.g. ' + fm.eg);
      const inner = ' ' + (foc ? span('accent', '\u25b8') : ' ') + ' ' + span('stat-name', label) + field + eg;
      lines.push(padLine('<span class="cg-row' + (foc ? ' cg-row-focus' : '') + '" data-cg="pmodal:' + i + '">' + inner + '</span>'));
    });
    lines.push(bord('\u251c', '\u2524'));
    lines.push(padLine(' ' + span('stat-name', '\u2191\u2193 field \u00b7 type to edit \u00b7 ') + btn('pmodal:done', 'DONE', 'cg-act') + span('stat-name', ' \u00b7 Esc cancel')));
    lines.push(bord('\u2514', '\u2518'));
    return lines;
  },

  // ── trait MODALS (overlay over CHARSHEET, per the Screenshot-2 mockup) ─────
  // Opening a hobby/clique/abilities picker no longer leaves CHARSHEET — it
  // raises a boxed panel OVER it. The actual add/remove + all the constraint
  // rules are DELEGATED to the existing screens (INTERESTS._toggleHobby /
  // _toggleClique, ATTRIBUTES._toggleAbil) so there's one source of truth.
  _openModal(kind) { State.cg.modal = { kind: kind, cur: 0 }; sfx.select(); render(); },
  _closeModal() { State.cg.modal = null; sfx.back(); render(); },
  _modalList() {
    const k = State.cg.modal && State.cg.modal.kind;
    if (k === 'hobby') return HOBBIES;
    if (k === 'clique') return SELECTABLE_CLIQUES;
    if (k === 'abil') return SKILLS;
    if (k === 'location') return LOCATIONS;   // #3: residence picker (many options -> modal)
    return [];
  },
  _modalSelected(kind, item) {
    const c = State.character;
    if (kind === 'hobby') return c.hobbies.includes(item.key);
    if (kind === 'clique') return c.clique === item.key || c.secondClique === item.key;
    if (kind === 'abil') return c.skills.some(x => x.key === item.key);
    if (kind === 'location') return c.location === item.key;
    return false;
  },
  _modalToggle(item) {
    if (!item) return;
    const k = State.cg.modal.kind;
    if (k === 'hobby') toggleHobby(item);
    else if (k === 'clique') { toggleClique(item); if (State.character.clique === item.key && State.cg.modal) this._closeModal(); }   // single choice: picking it closes
    else if (k === 'abil') toggleAbility(item);
    else if (k === 'location') { State.character.location = item.key; sfx.select(); this._closeModal(); return; }   // #3: single-select residence, then close
  },
  _modalFlavor(kind, item) {
    if (!item) return '';
    if (kind === 'hobby') {
      const mods = item.mods ? STAT_KEYS.filter(sk => item.mods[sk]).map(sk => (STAT_INFO[sk] ? STAT_INFO[sk].short : sk) + (item.mods[sk] > 0 ? '+' : '') + item.mods[sk]).join(' ') : '';
      return (item.blurb || '') + (mods ? '   [' + mods + ']' : '');
    }
    if (kind === 'clique') return item.blurb || '';
    if (kind === 'location') return item.blurb || '';
    if (kind === 'abil') {
      const c = State.character;
      const owned = c.skills.find(x => x.key === item.key);
      return (item.blurb || item.desc || '') + (owned ? '   (owned)' : '   cost ' + c.skillCostNext);
    }
    return '';
  },
  _modalBox() {
    const m = State.cg.modal, kind = m.kind, list = this._modalList(), c = State.character;
    const TITLE = kind === 'hobby' ? 'HOBBIES   (pick 1\u20133)' : kind === 'clique' ? 'CLIQUE' : kind === 'location' ? 'WHERE YOU LIVE' : 'ABILITIES';
    // The floating "tooltip" header from the mockups (Images 5/6): a short intro
    // explaining the trait group, wrapped to the panel width.
    const INTRO = kind === 'hobby' ? 'Hobbies give small bonuses and/or unlock occasional options. You may pick up to 3.'
                : kind === 'clique' ? 'Your clique is where you fit on the social map \u2014 some are locked by your hobbies or age.'
                : kind === 'location' ? 'Where you live shapes your starting cash and daily routine. Pick one \u2014 you rent or live with family (no ownership).'
                : 'Abilities draw from the SAME pool of points as your stats, and can grant bonuses or unlock unique skills.';
    const W = 72, V = 11;   // #3: wider panel + more rows, using the roomier screen (#2)
    let s = Math.max(0, m.cur - Math.floor(V / 2)); let e = Math.min(list.length, s + V); s = Math.max(0, e - V);
    const bord = (l, r) => span('frame', l + '\u2500'.repeat(W) + r);
    const padLine = (txt) => span('frame', '\u2502') + txt + ' '.repeat(Math.max(0, W - stripTags(txt).length)) + span('frame', '\u2502');
    const lines = [];
    lines.push(bord('\u250c', '\u2510'));
    lines.push(padLine(span('accent', ' ' + TITLE)));
    wrapWords(INTRO, W - 3).forEach(l => lines.push(padLine(' ' + span('stat-name', l))));
    if (kind === 'abil') lines.push(padLine(' ' + span('warn', '\u25c8 SHARED with stats \u2014 points left: ') + span(c.points > 0 ? 'ok' : 'warn', String(c.points))));   // #4
    lines.push(bord('\u251c', '\u2524'));
    for (let i = s; i < e; i++) {
      const item = list[i], foc = (i === m.cur), on = this._modalSelected(kind, item);
      const mark = kind === 'clique' ? (on ? '(\u2022)' : '( )') : (on ? '[x]' : '[ ]');
      let extra = '';
      if (kind === 'abil') { const owned = c.skills.find(x => x.key === item.key); extra = owned ? span('ok', 'owned') : span('stat-name', 'cost ' + c.skillCostNext); }
      const inner = ' ' + (foc ? span('accent', '\u25b8') : ' ') + ' ' + span(on ? 'ok' : '', mark) + ' ' + pad(item.label || item.key, W - 20) + extra;
      lines.push(padLine('<span class="cg-row' + (foc ? ' cg-row-focus' : '') + '" data-cg="modal:' + i + '">' + inner + '</span>'));
    }
    lines.push(padLine(span('stat-name', ' ' + (s > 0 ? '\u25b2' : ' ') + '  ' + (e < list.length ? '\u25bc scroll for more' : ''))));
    lines.push(bord('\u251c', '\u2524'));
    // EXPLANATION of the currently-selected item (the mockup's bottom box).
    // #5: ALWAYS render a fixed 2-line description area (pad with blanks) so the
    // panel height never changes as you scroll between items with longer/shorter
    // blurbs — the box jumping around was the jarring part.
    const flLines = wrapWords(this._modalFlavor(kind, list[m.cur]) || '', W - 3).slice(0, 2);
    while (flLines.length < 2) flLines.push('');
    flLines.forEach(l => lines.push(padLine(' ' + span('stat-name', l))));
    // A real, clickable DONE (players didn't know Esc was the way out, and clicks
    // outside the box used to be swallowed — the "chargen froze" reports).
    const _doneBtn = '<span class="cg-btn cg-act cg-row-focus" data-cg="modal:close">[ DONE ]</span>';
    const _hint = kind === 'clique' || kind === 'location' ? ' \u2191\u2193 select \u00b7 Enter picks \u00b7 ' : ' \u2191\u2193 select \u00b7 Enter toggles \u00b7 ';
    lines.push(padLine(span('stat-name', _hint) + _doneBtn + span('stat-name', ' (or Esc)')));
    lines.push(bord('\u2514', '\u2518'));
    return lines;
  },
  _adjAge(d) {
    const c = State.character;
    if (!c.age || c.age < 15 || c.age > 22) c.age = 18;
    else c.age = Math.max(15, Math.min(22, c.age + d));
    sfx.type(); render();
  },

  // ── bottom explainer text for the focused element ─────────────────────────
  _explain(el) {
    const c = State.character;
    if (!el) return '';
    switch (el.type) {
      case 'name': return 'Your name. Type letters, spaces, apostrophes or hyphens (up to 24).';
      case 'age': {
        const br = (c.age >= 15 && c.age <= 22) ? ageBracket(c.age) : null;
        const m = br ? (AGE_MODS[br] || {}) : {};
        const lab = br ? (AGE_BRACKET_LABELS[br] || br) : '';
        const mods = STAT_KEYS.filter(k => m[k]).map(k => STAT_INFO[k].short + (m[k] > 0 ? '+' : '') + m[k]).join('  ');
        return (br ? (lab + ' \u2014 ' + (m.flavor || '') + (mods ? '   [' + mods + ']' : '')) : 'Choose an age (15\u201322).');
      }
      case 'gender': { const o = GENDER_OPTIONS.find(x => x.key === c.gender); return o ? o.blurb : 'Pick a gender. \u2190/\u2192 to change.'; }
      case 'orientation': { const o = ORIENTATION_OPTIONS.find(x => x.key === c.orientation); return o ? o.blurb : 'Pick an orientation. \u2190/\u2192 to change.'; }
      case 'location': { const o = LOCATIONS.find(x => x.key === c.location); return (o ? (o.blurb + '   (Enter to change)') : 'Where you live (Enter to choose). You rent or live with family \u2014 no ownership.'); }
      case 'hobby': return c.hobbies && c.hobbies.length ? ('Hobbies: ' + c.hobbies.map(hk => (HOBBIES.find(h => h.key === hk) || {}).label || hk).join(', ') + '   \u2014 Enter to change.') : 'Choose your hobbies (Enter). They shift your stats and open cliques.';
      case 'clique': { const o = c.clique ? CLIQUES.find(x => x.key === c.clique) : null; return o ? (o.label + ' \u2014 ' + o.blurb + '   (Enter to change)') : 'Choose a clique (Enter). Where you fit in the social map.'; }
      case 'stat': { const info = STAT_INFO[el.key]; return '[' + info.short + '] ' + info.label + ' \u2014 ' + info.desc + '   (\u2190/\u2192 to spend points; floor 5, max 9)'; }
      case 'abil': return 'Abilities draw from the SAME point pool as your stats. Enter to choose \u2014 each can grant bonuses or unlock unique skills.';
      case 'equip': return 'Equipment slot (' + el.slot + '). The equipment/inventory system isn\u2019t wired up yet \u2014 placeholder for now.';
      case 'act':
        if (el.act === 'done') return 'Finish and review your character.';
        if (el.act === 'random') return 'Fill in everything you haven\u2019t set, at random.';
        return 'Step back.';
    }
    return '';
  },

  render() {
    ensureChargenCursorCSS();
    const c = State.character;
    this._clamp();
    // #7: if REVIEW sent us here to edit a specific trait, open that modal now.
    if (State.buffers && State.buffers.charsheetModal) { State.cg.modal = { kind: State.buffers.charsheetModal, cur: 0 }; State.buffers.charsheetModal = null; }
    // #3: default the CLIQUE to the age/tenure auto (e.g. Kid) when none is chosen,
    // so the slot is populated. It's only a default — picking any clique in the
    // modal replaces it (no hard lock), and toggling your pick off reverts here.
    if (!c.clique) { const _autoCq = ageLockedClique(c.age, c.tenure); if (_autoCq) c.clique = _autoCq; }
    const els = this._els();
    const cur = State.cg.cur;
    const focT = els[cur] ? els[cur].type : '';
    const isFoc = (i) => i === cur;
    const cursor = (on) => on ? span('accent', '\u25b8') : ' ';
    const btn = (action, label, cls) => '<span class="cg-btn ' + (cls || '') + '" data-cg="' + action + '">' + label + '</span>';
    const row = (idx, action, inner) => ' ' + cursor(isFoc(idx)) + '<span class="cg-row' + (isFoc(idx) ? ' cg-row-focus' : '') + '" data-cg="' + action + '">' + inner + '</span>';
    // #5: helpers that mirror the IN-GAME character sheet so chargen reads like
    // editing that very sheet: titled rules (SH) + boxed sections (boxOf).
    const SH = (t, w) => span('accent', t) + ' ' + span('accent', '\u2500'.repeat(Math.max(0, w - t.length - 1)));
    const padV = (str, n) => { str = str || ''; const vis = stripTags(str).length; if (vis === n) return str; if (vis > n) return (typeof sliceRowVisible === 'function') ? sliceRowVisible(str, 0, n) : str; return str + ' '.repeat(n - vis); };
    const boxOf = (title, body, w) => {
      const inner = w - 2, o2 = [], t = ' ' + title + ' ', fill = Math.max(0, inner - 1 - t.length);
      o2.push(span('frame', '\u250c\u2500') + span('accent', t) + span('frame', '\u2500'.repeat(fill) + '\u2510'));
      body.forEach(bl => o2.push(span('frame', '\u2502') + padV(' ' + bl, inner) + span('frame', '\u2502')));
      o2.push(span('frame', '\u2514' + '\u2500'.repeat(inner) + '\u2518'));
      return o2;
    };
    // #5: format a stat-mods object like the in-game sheet ('B+1 R+1 I-1', colored).
    const modStr = (mods) => Object.entries(mods || {}).filter(function (e) { return e[1] && STAT_INFO[e[0]]; }).map(function (e) { const k = e[0], v = e[1]; const t = (STAT_INFO[k] ? STAT_INFO[k].short : k) + (v > 0 ? '+' : '') + v; return span(v > 0 ? 'ok' : 'warn', t); }).join(' ');

    // helper: index of an element type (first match) for the data-cg focus jump
    const ix = (t, extra) => els.findIndex(e => e.type === t && (extra == null || e.key === extra || e.slot === extra || e.idx === extra));

    const _gFoc = (focT === 'gender');
    // #1: gender carries pronouns. For 'Other' the inline field captures the
    // player's PRONOUNS (e.g. "they/them" or "ze/zir"), not a gender word.
    const genderLabel = (GENDER_OPTIONS.find(o => o.key === c.gender) || {}).label || '(choose)';
    // bug2: PRONOUNS are their own visible field. Show the typed custom string
    // (when 'custom'/Other), else the gender-derived set (he/him, she/her, ...).
    const pronounLabel = (c.pronouns === 'custom')
      ? (c.customPronounForms ? (c.customPronounForms.subj + ' / ' + c.customPronounForms.obj) : '\u2014 [Enter]')
      : (function () { const p = (window.GameData && window.GameData.resolvePronouns) ? window.GameData.resolvePronouns(c) : null; return p ? (p.subj + ' / ' + p.obj) : 'they / them'; })();
    const orLabel = (ORIENTATION_OPTIONS.find(o => o.key === c.orientation) || {}).label || '(choose)';
    const locObj = c.location ? LOCATIONS.find(l => l.key === c.location) : null;
    const cliqueObj = c.clique ? CLIQUES.find(x => x.key === c.clique) : null;

    const out = [];
    // #1: the consolidated chargen IS the live character sheet, so the old
    // "(so far: …)" summary + step counter above it is redundant — drop it for a
    // clean one-line title and rule.
    out.push('   ' + span('accent', 'NEW GAME  \u203a  CHARACTER'));
    out.push('   ' + span('frame', '\u2550'.repeat(112)));
    out.push('   ' + span('stat-name', '\u2191\u2193 move \u00b7 \u2190\u2192 change \u00b7 Enter opens traits \u00b7 type to name \u00b7 or click'));
    out.push('');

    // ── identity block ────────────────────────────────────────────────────
    // #5: name/age BANNER box across the top, like the in-game sheet's header.
    const SHEET_W = 112;   // #2: span the window so the screen fills out (less black space)
    const bannerTxt = ((c.name && c.name.length) ? c.name : '(unnamed)') + ((c.age >= 15 && c.age <= 22) ? (', age ' + c.age) : '');
    const _bpad = Math.max(0, SHEET_W - 2 - bannerTxt.length), _bL = Math.floor(_bpad / 2);
    out.push(span('frame', '\u250c' + '\u2500'.repeat(SHEET_W - 2) + '\u2510'));
    out.push(span('frame', '\u2502') + ' '.repeat(_bL) + span('accent', bannerTxt) + ' '.repeat(_bpad - _bL) + span('frame', '\u2502'));
    out.push(span('frame', '\u2514' + '\u2500'.repeat(SHEET_W - 2) + '\u2518'));
    out.push('');
    // #5: TWO-COLUMN sheet matching Image 3 — LEFT: identity, stats, clique;
    // RIGHT: hobbies, abilities, equipment box. Interactive rows keep their
    // data-cg so click + cursor focus still work; _els() walks the left column
    // top-to-bottom then the right, so Up/Down feels natural.
    const LCOL = 54, RCOL = 54, GUT = 4;
    const zip2 = (L, R, into) => { const n = Math.max(L.length, R.length); for (let i2 = 0; i2 < n; i2++) into.push(padV(L[i2] || '', LCOL) + ' '.repeat(GUT) + (R[i2] || '')); };

    // ----- LEFT column: IDENTITY, then POINT POOL (stats + abilities) -----
    const leftCol = [];
    leftCol.push(SH('IDENTITY', LCOL));
    const nameTxt = (c.name && c.name.length) ? c.name : span('stat-name', '(type a name)');
    leftCol.push(row(ix('name'), 'field:name', pad('NAME', 9) + nameTxt + (focT === 'name' ? span('accent', '_') : '')));
    const ageBr = (c.age >= 15 && c.age <= 22) ? span('stat-name', '  ' + (AGE_BRACKET_LABELS[ageBracket(c.age)] || '')) : '';
    leftCol.push(row(ix('age'), 'field:age', pad('AGE', 9) + btn('age:-1', '[\u2212]', 'cg-pm') + span('accent', ' ' + pad(String(c.age || '\u2014'), 2) + ' ') + btn('age:1', '[+]', 'cg-pm') + ageBr));
    if (c.age >= 15 && c.age <= 22) { const _am = modStr(AGE_MODS[ageBracket(c.age)] || {}); if (_am) leftCol.push('   ' + span('stat-name', 'mods: ') + _am); }
    // #5: GENDER + PRONOUNS share one line — pronouns sit in parentheses right
    // beside gender. Both stay independently focusable/clickable (two cg-row spans).
    const _pFoc = isFoc(ix('pronouns'));   // #5: _gFoc already declared above (focused-gender flag)
    const _prLocked = genderAllowedPronouns(c.gender).length <= 1;   // #2: he/she are fixed by gender
    const _gInline = (c.gender === 'other') ? 'Self-desc.' : genderLabel;   // #5b: short inline label so GENDER+(pronouns) fits one 54-col line
    const _genderCell = cursor(_gFoc) + '<span class="cg-row' + (_gFoc ? ' cg-row-focus' : '') + '" data-cg="field:gender">' + pad('GENDER', 8) + btn('gender:-1', '[\u25c4]', 'cg-pm') + span('accent', ' ' + _gInline + ' ') + btn('gender:1', '[\u25ba]', 'cg-pm') + '</span>';
    const _pronInner = _prLocked
      ? span('stat-name', '(') + span('accent', pronounLabel) + span('stat-name', ')')
      : span('stat-name', '(') + span('accent', pronounLabel) + span('stat-name', ') ') + btn('pronouns:-1', '[\u25c4]', 'cg-pm') + btn('pronouns:1', '[\u25ba]', 'cg-pm');
    const _pronCell = '  ' + cursor(_pFoc) + '<span class="cg-row' + (_pFoc ? ' cg-row-focus' : '') + '" data-cg="field:pronouns">' + _pronInner + '</span>';
    leftCol.push(' ' + _genderCell + _pronCell);
    leftCol.push(row(ix('orientation'), 'field:orientation', pad('ORIENT.', 9) + btn('orientation:-1', '[\u25c4]', 'cg-pm') + span('accent', ' ' + orLabel + ' ') + btn('orientation:1', '[\u25ba]', 'cg-pm')));
    leftCol.push(row(ix('location'), 'field:location', pad('LIVES', 9) + span('accent', (locObj ? locObj.label : '(choose)')) + span('stat-name', '   [Enter]')));   // #3: opens the residence modal
    leftCol.push('');
    // #4: STATS + ABILITIES now live TOGETHER inside ONE labelled enclosure so it's
    // unmistakable they draw from a single pool. Points remaining are stated once up top.
    const poolBody = [];
    poolBody.push(span('warn', '\u25c8 ') + span('stat-name', 'STATS & ABILITIES share ONE pool \u2014 left: ') + span(c.points > 0 ? 'ok' : 'warn', String(c.points)));
    poolBody.push(SH('STATS', LCOL - 6));
    STAT_KEYS.forEach(k => { const idx = ix('stat', k); const info = STAT_INFO[k]; poolBody.push(row(idx, 'stat:' + k + ':focus', pad('[' + info.short + '] ' + info.label, 17) + btn('stat:' + k + ':-1', '[\u2212]', 'cg-pm') + span('stat-value', ' ' + pad(String(statTotal(k)), 2) + ' ') + btn('stat:' + k + ':1', '[+]', 'cg-pm'))); });
    poolBody.push('');
    poolBody.push(SH('ABILITIES (' + ((c.skills && c.skills.length) || 0) + ')', LCOL - 6));
    poolBody.push(row(ix('abil'), 'abil', span('warn', '[Enter] to choose \u2014 spends the same points')));
    if (c.skills && c.skills.length) { c.skills.forEach(function (sk) { const a = SKILLS.find(function (x) { return x.key === sk.key; }) || sk; poolBody.push(' ' + span('ok', '\u2022 ') + span('menu-item', a.label || a.key)); }); }
    else { poolBody.push(' ' + span('stat-name', '(none chosen yet)')); }
    boxOf('POINT POOL  (shared by stats & abilities)', poolBody, LCOL).forEach(l => leftCol.push(l));

    // ----- RIGHT column: HOBBIES, CLIQUE, EQUIPMENT -----
    const rightCol = [];
    rightCol.push(SH('HOBBIES (' + ((c.hobbies && c.hobbies.length) || 0) + ')', RCOL));
    rightCol.push(row(ix('hobby'), 'field:hobby', span('stat-name', (c.hobbies && c.hobbies.length) ? 'change your picks' : 'pick up to 3') + span('stat-name', '   [Enter]')));
    if (c.hobbies && c.hobbies.length) { c.hobbies.forEach(function (hk) { const h = HOBBIES.find(function (x) { return x.key === hk; }); if (!h) return; const _hm = modStr(h.mods); rightCol.push(' ' + span('ok', '\u2022 ') + span('menu-item', h.label) + (_hm ? '  ' + _hm : '')); }); }
    else { rightCol.push(' ' + span('stat-name', '(none yet)')); }
    rightCol.push('');
    rightCol.push(SH('CLIQUE', RCOL));
    const _cqMods = cliqueObj ? modStr(cliqueObj.mods) : '';
    rightCol.push(row(ix('clique'), 'field:clique', span('ok', ' \u2022 ') + (cliqueObj ? span('menu-item', cliqueObj.label) : span('stat-name', '(choose)')) + (_cqMods ? '  ' + _cqMods : '') + span('stat-name', '   [Enter]')));
    rightCol.push('');
    const equipBody = EQUIP_SLOTS.map(s => span('stat-name', pad(s, 12) + '\u2014 (set in-game)'));
    boxOf('EQUIPMENT', equipBody, RCOL).forEach(l => rightCol.push(l));

    zip2(leftCol, rightCol, out);
    out.push('');
    // INVENTORY + QUESTS boxes side-by-side (display-only) — mirrors the in-game
    // sheet AND fills the lower screen so there's far less black space (#2).
    zip2(boxOf('INVENTORY', [span('stat-name', '(empty \u2014 found in-game)')], LCOL),
         boxOf('QUESTS', [span('stat-name', '(no active quests yet)')], RCOL), out);
    out.push('');

    // ── bottom explainer (the focused element's tutorial text) ────────────
    out.push(' ' + SH('NOTES', SHEET_W - 2));
    // #5: wrap + pad to a CONSTANT 2 lines so a longer note never pushes the
    // action bar around as you move between fields.
    const exLines = wrapWords(this._explain(els[cur]) || '', SHEET_W - 2).slice(0, 2);
    while (exLines.length < 2) exLines.push('');
    exLines.forEach(l => out.push(' ' + span('stat-name', l)));
    out.push('');

    // ── action bar ────────────────────────────────────────────────────────
    let actLine = '   ';
    els.forEach((e, i) => { if (e.type !== 'act') return; actLine += btn(e.act, (isFoc(i) ? '\u25b8' : ' ') + e.label, 'cg-act' + (isFoc(i) ? ' cg-row-focus' : '')) + '  '; });
    out.push(actLine);
        // overlay the trait modal (if open) over the centre of the base screen
    if (State.cg.modal || State.cg.pronounModal) {
      const box = State.cg.pronounModal ? this._pronounModalBox() : this._modalBox();
      const start = Math.max(3, Math.floor((out.length - box.length) / 2));
      for (let i = 0; i < box.length; i++) { const r = start + i; const ln = '   ' + box[i]; if (r < out.length) out[r] = ln; else out.push(ln); }
    }
    return out.join('\n');
  },

  onKey(e) {
    if (State.cg == null) State.cg = { cur: 0 };
    this._clamp();
    const els = this._els();
    const el = els[State.cg.cur];
    const k = e.key;
    const c = State.character;
    if (State.cg.pronounModal) {
      const pm = State.cg.pronounModal, fld = pm.forms[pm.cur];
      if (k === 'Escape') { this._closePronounModal(false); return true; }
      if (k === 'ArrowUp') { pm.cur = (pm.cur - 1 + pm.forms.length) % pm.forms.length; sfx.type(); render(); return true; }
      if (k === 'ArrowDown' || k === 'Tab') { pm.cur = (pm.cur + 1) % pm.forms.length; sfx.type(); render(); return true; }
      if (k === 'Enter') { if (pm.cur >= pm.forms.length - 1) { this._closePronounModal(true); } else { pm.cur++; sfx.type(); render(); } return true; }
      if (k === 'Backspace') { fld.val = (fld.val || '').slice(0, -1); sfx.type(); render(); return true; }
      if (k && k.length === 1 && /[A-Za-z'\u2019 \-]/.test(k)) { if ((fld.val || '').length < 16) { fld.val = (fld.val || '') + k; sfx.type(); render(); } else sfx.error(); return true; }
      return true;   // swallow everything else while the pronoun modal is open
    }
    if (State.cg.modal) {
      const m = State.cg.modal, list = this._modalList();
      if (k === 'Escape') { this._closeModal(); return true; }
      if (k === 'ArrowUp') { m.cur = (m.cur - 1 + list.length) % list.length; sfx.type(); render(); return true; }
      if (k === 'ArrowDown') { m.cur = (m.cur + 1) % list.length; sfx.type(); render(); return true; }
      if (k === 'Enter' || k === ' ') { this._modalToggle(list[m.cur]); return true; }
      if (k === 'Tab') { this._closeModal(); return true; }
      return true;   // swallow everything else while a modal is open
    }
    if (k === 'ArrowUp') { State.cg.cur = (State.cg.cur - 1 + els.length) % els.length; sfx.type(); render(); return true; }
    if (k === 'ArrowDown') { State.cg.cur = (State.cg.cur + 1) % els.length; sfx.type(); render(); return true; }
    if (k === 'Escape') {
      // Leaving chargen restarts the long intro crawl, so ask first (Esc twice).
      if (State.cg.escArmed && Date.now() - State.cg.escArmed < 2500) { State.cg.escArmed = 0; this.onClick('back'); return true; }
      State.cg.escArmed = Date.now(); sfx.error(); flash('Press Esc again to leave character creation (back to the intro).'); return true;
    }
    // TYPED WORDS: when the NAME field isn't focused, letters spell commands —
    // "done", "random", "back" (players kept typing "done" and nothing happened).
    if (el && el.type !== 'name' && k && k.length === 1 && /[a-z]/i.test(k)) {
      State.cg.typeBuf = ((State.cg.typeBuf || '') + k.toLowerCase()).slice(-8);
      const tb = State.cg.typeBuf;
      if (/done$/.test(tb) || /next$/.test(tb)) { State.cg.typeBuf = ''; this._done(); return true; }
      if (/random$/.test(tb)) { State.cg.typeBuf = ''; this.onClick('random'); return true; }
      if (/back$/.test(tb)) { State.cg.typeBuf = ''; this.onClick('back'); return true; }
    }
    if (!el) return false;

    // name typing
    if (el.type === 'name') {
      if (k === 'Backspace') { c.name = (c.name || '').slice(0, -1); sfx.type(); render(); return true; }
      if (k === 'Enter') { State.cg.cur = (State.cg.cur + 1) % els.length; sfx.type(); render(); return true; }
      if (k && k.length === 1 && /[A-Za-z' \-]/.test(k)) { if ((c.name || '').length < 24) { c.name = (c.name || '') + k; sfx.type(); render(); } else sfx.error(); return true; }
      return true;
    }
    // left / right + enter per element type
    const left = (k === 'ArrowLeft'), right = (k === 'ArrowRight'), enter = (k === 'Enter' || k === ' ');
    switch (el.type) {
      case 'age': if (left) { this._adjAge(-1); return true; } if (right) { this._adjAge(+1); return true; } if (/^[0-9]$/.test(k)) { const n = parseInt(((State.cg.ageBuf || '') + k).slice(-2), 10); State.cg.ageBuf = String(n); c.age = (n >= 15 && n <= 22) ? n : c.age; sfx.type(); render(); return true; } return true;
      case 'gender':
        if (left) { this._cycle('gender', GENDER_OPTIONS, 'key', -1); return true; }
        if (right) { this._cycle('gender', GENDER_OPTIONS, 'key', +1); return true; }
        if (enter) { State.cg.cur = (State.cg.cur + 1) % els.length; sfx.type(); render(); return true; }   // #1: Enter moves on (was a no-op → felt frozen)
        return true;
      case 'pronouns':
        if (left) { this._cyclePronouns(-1); return true; }
        if (right) { this._cyclePronouns(+1); return true; }
        // #2: 'custom' now opens the multi-form modal (set when cycling onto it);
        // Enter re-opens it to edit. No inline typing.
        if (enter && c.pronouns === 'custom') { this._openPronounModal(); return true; }
        if (enter) { State.cg.cur = (State.cg.cur + 1) % els.length; sfx.type(); render(); return true; }   // #1: Enter moves on (non-custom pronouns)
        return true;
      case 'orientation': if (left) { this._cycle('orientation', ORIENTATION_OPTIONS, 'key', -1); return true; } if (right) { this._cycle('orientation', ORIENTATION_OPTIONS, 'key', +1); return true; } if (enter) { State.cg.cur = (State.cg.cur + 1) % els.length; sfx.type(); render(); return true; } return true;
      case 'location': if (enter) { this._openModal('location'); return true; } if (left) { this._cycle('location', LOCATIONS, 'key', -1); return true; } if (right) { this._cycle('location', LOCATIONS, 'key', +1); return true; } return true;
      case 'hobby': if (enter) { this._openModal('hobby'); return true; } return true;
      case 'clique': if (enter) { this._openModal('clique'); return true; } return true;
      case 'stat': if (left) { adjustStat(el.key, -1); return true; } if (right) { adjustStat(el.key, +1); return true; } return true;
      case 'abil': if (enter) { this._openModal('abil'); return true; } return true;
      case 'equip': if (enter) { sfx.error(); flash('Equipment isn\u2019t wired up yet.'); return true; } return true;
      case 'act': if (enter) { this.onClick(el.act); return true; } return true;
    }
    return false;
  },

  onClick(action) {
    if (State.cg == null) State.cg = { cur: 0 };
    const c = State.character;
    const parts = (action || '').split(':');
    if (State.cg.pronounModal) {
      if (parts[0] === 'pmodal') {
        if (parts[1] === 'done') { this._closePronounModal(true); return; }
        const i = parseInt(parts[1], 10); if (!isNaN(i)) { State.cg.pronounModal.cur = i; sfx.type(); render(); }
        return;
      }
      return;
    }
    if (State.cg.modal) {
      if (action === 'modal:close') { this._closeModal(); return; }   // must precede the 'modal:<i>' branch
      if (parts[0] === 'modal') { const i = parseInt(parts[1], 10); if (!isNaN(i)) { State.cg.modal.cur = i; this._modalToggle(this._modalList()[i]); } return; }
      // a click on anything outside the box (DONE ▸, a stat, …) just closes the
      // modal instead of being silently swallowed.
      this._closeModal(); return;
    }
    const els = this._els();
    const focus = (t, extra) => { const i = els.findIndex(e => e.type === t && (extra == null || e.key === extra || e.slot === extra || ('' + e.idx) === extra)); if (i >= 0) State.cg.cur = i; };
    if (parts[0] === 'field') { focus(parts[1]); if (parts[1] === 'hobby') { this._openModal('hobby'); return; } if (parts[1] === 'clique') { this._openModal('clique'); return; } if (parts[1] === 'location') { this._openModal('location'); return; } if (parts[1] === 'pronouns' && c.pronouns === 'custom') { this._openPronounModal(); return; } sfx.type(); render(); return; }
    if (parts[0] === 'age') { focus('age'); this._adjAge(parts[1] === '1' ? +1 : -1); return; }
    if (parts[0] === 'gender') { focus('gender'); this._cycle('gender', GENDER_OPTIONS, 'key', parts[1] === '1' ? +1 : -1); return; }
    if (parts[0] === 'pronouns') { focus('pronouns'); this._cyclePronouns(parts[1] === '1' ? +1 : -1); return; }
    if (parts[0] === 'orientation') { focus('orientation'); this._cycle('orientation', ORIENTATION_OPTIONS, 'key', parts[1] === '1' ? +1 : -1); return; }
    if (parts[0] === 'location') { focus('location'); this._cycle('location', LOCATIONS, 'key', parts[1] === '1' ? +1 : -1); return; }
    if (parts[0] === 'stat') { focus('stat', parts[1]); if (parts[2] === 'focus') { sfx.type(); render(); } else { adjustStat(parts[1], parts[2] === '1' ? +1 : -1); } return; }
    if (parts[0] === 'equip') { focus('equip', parts[1]); sfx.error(); flash('Equipment isn\u2019t wired up yet.'); return; }
    if (action === 'abil') { this._openModal('abil'); return; }
    if (action === 'done') { this._done(); return; }
    if (action === 'random') { sfx.select(); randomizeRemainingCharacter(); render(); return; }
    if (action === 'back') { if (respecReturn(true)) return; sfx.back(); goto('INTRO'); return; }   // a debug-room respec cancels back to the room
  },

  _done() {
    const c = State.character;
    if (!c.name || !/^[A-Za-z][A-Za-z' \-]{0,23}$/.test(c.name)) { sfx.error(); flash('Enter a name first.'); State.cg.cur = 0; render(); return; }
    if (!c.age || c.age < 15 || c.age > 22) { sfx.error(); flash('Pick an age between 15 and 22.'); render(); return; }
    sfx.confirm(); goto('REVIEW');
  },
};

Screens.REVIEW = {
  _acts: [
    { act: 'start', label: 'start' }, { act: 'random', label: 'random' },
    { act: 'attributes', label: 'attributes' }, { act: 'hobbies', label: 'hobbies' },
    { act: 'clique', label: 'clique' }, { act: 'restart', label: 'restart' },
    { act: 'back', label: 'back' },
  ],
  onKey(e) {
    if (State.cg == null || State.cg.cur == null) State.cg = { cur: 0 };
    const n = this._acts.length;
    const k = e.key;
    if (k === 'ArrowUp' || k === 'ArrowLeft' || k === 'w' || k === 'a' || k === 'W' || k === 'A') { State.cg.cur = (State.cg.cur - 1 + n) % n; sfx.type(); render(); return true; }
    if (k === 'ArrowDown' || k === 'ArrowRight' || k === 's' || k === 'd' || k === 'S' || k === 'D') { State.cg.cur = (State.cg.cur + 1) % n; sfx.type(); render(); return true; }
    if (k === 'Escape') { this.handle('back'); return true; }
    if (k === 'Enter' || k === ' ') { this.handle(this._acts[State.cg.cur].act); return true; }
    return false;
  },
  onClick(action) { this.handle(action); },
  render() {
    // generate the player's starter equipment from their final choices
    // (age/clique/hobbies). Done here so it reflects the completed character.
    // Stored on c.worn / c.pocket; regenerated whenever the character is
    // rerolled (random/restart clear it).
    const c = State.character;
    if (c && !c.worn && typeof window !== 'undefined' && window.GameItems) {
      const kit = window.GameItems.generateStarterKit({
        age: c.age, clique: c.clique, hobbies: c.hobbies || [], gender: c.gender
      });
      c.worn = kit.worn;
      c.pocket = kit.pocket;
    }
    // the action words are now clickable + arrow-navigable buttons
    // (the cursor highlights one; ↑↓/←→ move, Enter activates). They delegate to
    // handle() so the (complex) start/respec logic is unchanged.
    const ACTS = Screens.REVIEW._acts;
    if (State.cg == null || State.cg.cur == null) State.cg = { cur: 0 };
    if (State.cg.cur >= ACTS.length) State.cg.cur = 0;
    const cur = State.cg.cur;
    const ab = (i) => { const a = ACTS[i]; const foc = i === cur; return '<span class="cg-btn cg-act' + (foc ? ' cg-row-focus' : '') + '" data-cg="' + a.act + '">' + (foc ? '\u25b8' : ' ') + '[ ' + a.label + ' ]</span>'; };
    return [
      chargenHeader('NEW GAME  >  REVIEW'),
      renderCharacterSheet(),
      '',
      '   ' + span('stat-name', '\u2191\u2193\u2190\u2192 move \u00b7 Enter selects \u00b7 or click'),
      '',   // spacer: the focused button's highlight box overlapped the hint line above it
      '   ' + ab(0) + '  accept and begin the game',
      '   ' + ab(1) + '  reroll EVERYTHING      ' + ab(2) + '  rework stats & abilities',
      '   ' + ab(3) + '  rework hobbies         ' + ab(4) + '  rework clique',
      '   ' + ab(5) + '  start over from scratch ' + ab(6) + '  go back',
    ].join('\n');
  },
  handle(text) {
    if (tryAutoRandom(text)) return;
    const t = text.trim().toLowerCase();
    if (t === 'start' || t === 'begin' || t === 'go' || t === 'accept' || t === '') {
      // if we entered chargen via the debug-room RESPEC, the player just
      // wanted to rebuild their character — return them to the debug room map
      // (where they were), NOT into the real game start flow / main menu.
      if (State._respecFromDebug) {
        State._respecFromDebug = false;
        sfx.confirm();
        // Re-enter the debug room with the freshly respec'd character. Refresh the
        // snapshot AFTER re-entry so leaving the room later won't revert the respec.
        State._respecFromDebug = false;
        State._debugTempChar = false;
        if (typeof window.openDebugRoomFromMenu === 'function') {
          window.openDebugRoomFromMenu(State.debugReturn || 'DEBUG_ROOM');
          State._debugCharSnapshot = State.character ? JSON.parse(JSON.stringify(State.character)) : null;
        } else {
          goto('DEBUG_ROOM_MAP');
        }
        return;
      }
      // Apply scenario choice from chargen
      const c = State.character;
      const scenarioKey = c.scenarioChoice || 'campaign';
      const scen = SCENARIOS[scenarioKey];
      const skip = !!c.skipTutorial;
      // If skipping tutorial, jump straight to mainStartDay (Saturday).
      const startDay = skip ? scen.mainStartDay : 1;
      State.world = {
        dayNumber: startDay,
        hour: 8, minute: 0,
        money: 0, rested: 100,
        scenario: scenarioKey,
        inTutorial: !skip,
      };
      saveSlot(); sfx.confirm();
      Music.playStartJingle();
      // the game-entry target (where we land once any control tutorial is
      // done). Stashed so the tutorial can hand control back here.
      State._gameEntryScreen = 'FIRST_SHIFT';   // #20/#21: post-tutorial arrival scene inside the theater
      // OFFER the hands-on control tutorial (yes / skip all). On finish or skip,
      // it routes to State._gameEntryScreen via ENTER_GAME.
      if (window.MultiplexTutorial && window.MultiplexTutorial.offerAfterChargen) {
        window.MultiplexTutorial.offerAfterChargen('ENTER_GAME');
      } else {
        goto(State._gameEntryScreen);
      }
      return;
    }
    if (t === 'random' || t === 'r' || t === 'reroll') {
      randomizeWholeCharacter(); const c = State.character; c.worn = null; c.pocket = null; sfx.select(); render(); return;
    }
    if (t === 'attributes' || t === 'stats' || t === 'skills' || t === 'abilities') { sfx.back(); State.buffers.charsheetModal = 'abil'; goto('CHARSHEET'); return; }   // #7 -> CHARSHEET
    if (t === 'hobbies') { sfx.back(); State.buffers.charsheetModal = 'hobby'; goto('CHARSHEET'); return; }   // #7 -> CHARSHEET
    if (t === 'clique')  { sfx.back(); State.buffers.charsheetModal = 'clique'; goto('CHARSHEET'); return; }   // #7 -> CHARSHEET
    if (t === 'back')    { sfx.back(); goto('CHARSHEET'); return; }   // #7: back returns to the consolidated screen, not the old wizard
    if (t === 'restart') { sfx.back(); State.character = blankCharacter(); State.character.tenure = 'new'; State.character.townName = ''; State.character.scenarioChoice = 'campaign'; goto('CHARSHEET'); return; }   // #7 -> CHARSHEET (fresh)
    sfx.error(); flash('Type start, random, attributes, hobbies, clique, restart, or back.');
  }
};

// ENTER_GAME — a tiny bridge the control tutorial returns to. It immediately
// routes into the real game world (the target chosen at REVIEW "start"). Having
// it as a screen lets the tutorial runner treat "go to the game" like any other
// returnScreen without chargen needing to know about tutorial internals.
Screens.ENTER_GAME = {
  render() {
    // Route into the real game on the next tick (render must return a string;
    // we can't navigate synchronously from inside it without recursing).
    const target = State._gameEntryScreen || 'FIRST_SHIFT';
    State._gameEntryScreen = null;
    setTimeout(() => { if (State.screen === 'ENTER_GAME') goto(target); }, 0);
    return header('ENTERING THE GRANDE') + '\n\n   Loading…';
  },
  handle() { /* no-op; auto-advances */ }
};

// ─── PUBLIC CHARGEN API ─────────────────────────────────────────────────────
// Exposed for other modules (e.g. the debug room's "generate a random PC when
// none exists" path, #17). makeRandomCharacter() builds a full random character
// and returns it WITHOUT changing the current State.character unless asked.
window.MultiplexChargen = {
  // Build + return a fully random character. Side effect: sets State.character
  // (randomizeWholeCharacter writes there), so callers that want to preserve the
  // existing one should snapshot first.
  makeRandomCharacter() {
    randomizeWholeCharacter();
    return State.character;
  },
  randomizeWholeCharacter,
  blankCharacter,
};
