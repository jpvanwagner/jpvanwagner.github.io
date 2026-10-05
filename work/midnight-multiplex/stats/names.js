/* ============================================================================
 *  stats/names.js  —  RANDOM NAME POOL  (NEW MODULE, easily editable)
 * ----------------------------------------------------------------------------
 *  ONE place to manage the random first-name pool used everywhere:
 *    • the chargen "roll a random name" button / full-random builder, and
 *    • every NPC generated in the tutorials (each draws a UNIQUE name, and the
 *      player's own name is never reused for an NPC).
 *
 *  ✎ HOW TO EDIT:  just add, remove, or change entries in FIRST_NAMES below —
 *    one quoted name per entry, commas between. No other file needs touching.
 *
 *  EXPOSES  window.NamePool:
 *    .FIRST_NAMES            the array itself
 *    .pick(exclude)         → a random name ≠ exclude
 *    .pickUnique(used, ex)  → a random name not in `used[]` and ≠ ex; it PUSHES
 *                            the chosen name into `used` so callers get no repeats
 *                            (falls back to a numbered name if the pool is exhausted)
 * ========================================================================== */
(function () {
  'use strict';

  const FIRST_NAMES = [
    // ── neutral / period-flavored ───────────────────────────────────────────
    'Jordan', 'Casey', 'Taylor', 'Morgan', 'Riley', 'Quinn', 'Avery', 'Reese',
    'Jaime', 'Sam', 'Alex', 'Drew', 'Charlie', 'Robin', 'Devon', 'Sky',
    'Jess', 'Kai', 'River', 'Phoenix', 'Dakota', 'Sage',
    // ── gendered options for variety ────────────────────────────────────────
    'Brittany', 'Tiffany', 'Heather', 'Megan', 'Amanda', 'Jennifer', 'Stephanie',
    'Brandon', 'Joshua', 'Tyler', 'Ryan', 'Justin', 'Kyle', 'Dustin', 'Cody',
    // ── first names from the CREDITS (folks the game is dedicated to) ────────
    'Joe', 'Luke', 'Britney', 'Bob', 'Matt', 'Lani', 'Lee', 'Carrie', 'Scott', 'Jenn',
    'Sara', 'David', 'Kimberly', 'Jacqueline', 'Adam', 'Alicia', 'Jacob', 'Amber',
    'James', 'Miyun', 'John', 'Teresa', 'Colin', 'Jasen', 'Corbin', 'George',
    'Michelle', 'Jeff', 'Jackie',
    // ── first names of famous actors & directors (for fun NPC flavor) ───────
    'Steven', 'Quentin', 'Martin', 'Sofia', 'Spike', 'Wes', 'Stanley', 'Ridley',
    'Christopher', 'Denzel', 'Meryl', 'Sigourney', 'Winona', 'Keanu', 'Uma',
    'Samuel', 'Harrison', 'Sidney', 'Greta', 'Guillermo', 'Viola', 'Octavia',
    'Frances', 'Cate', 'Gary', 'Jodie', 'Ethan', 'Julianne', 'Wesley', 'Forest',
    'Angela', 'Laurence', 'Toni', 'Parker', 'Steve', 'Philip', 'Hayao', 'Akira',
    'Federico', 'Ingmar', 'Orson', 'Gena', 'Pam', 'Whoopi', 'Jada', 'Halle',
    'Ava', 'Spike', 'Tim', 'Kathryn', 'Penny', 'Nora',
  ];

  function pick(exclude) {
    const pool = exclude ? FIRST_NAMES.filter(n => n !== exclude) : FIRST_NAMES;
    const src = pool.length ? pool : FIRST_NAMES;
    return src[Math.floor(Math.random() * src.length)];
  }

  function pickUnique(used, exclude) {
    used = used || [];
    const pool = FIRST_NAMES.filter(n => n !== exclude && used.indexOf(n) === -1);
    let name;
    if (pool.length) name = pool[Math.floor(Math.random() * pool.length)];
    else name = 'Guest ' + (used.length + 1);   // pool exhausted — numbered fallback
    used.push(name);
    return name;
  }

  window.NamePool = { FIRST_NAMES, pick, pickUnique };
})();
