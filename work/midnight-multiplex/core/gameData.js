/* ============================================================================
 *  MIDNIGHT AT THE MULTIPLEX — SHARED GAME DATA  (core/gameData.js)
 * ============================================================================
 *
 *  THIS FILE IS THE SINGLE SOURCE OF TRUTH for the game's character vocabulary.
 *  It's plain JavaScript (no build step) and is exposed as window.GameData.
 *  chargen, Saymaker, the dialogue runtime, and the 3D engine all read FROM
 *  here, so adding an entry HERE makes it show up everywhere automatically.
 *
 *  ┌──────────────────────────────────────────────────────────────────────┐
 *  │  TWO DIFFERENT THINGS BOTH ONCE CALLED "SKILLS" — DON'T MIX THEM UP:   │
 *  ├──────────────────────────────────────────────────────────────────────┤
 *  │  • ABILITIES  → the `SKILLS` array (kept that internal name for save   │
 *  │    compatibility). These are the CHARGEN PERKS a player buys/earns at  │
 *  │    character creation (Light Fingers, Tinkerer, …). Players see the    │
 *  │    word "Abilities". Each has a stat `gate` and can be granted free by  │
 *  │    a hobby.                                                            │
 *  │  • SKILLS     → the `ACTION_SKILLS` array. These are the ACTION VERBS  │
 *  │    the engine rolls when you DO something (jump, climb, force, hide,   │
 *  │    sneak…). Each is governed by ONE primary stat, MAX 3 per stat.      │
 *  └──────────────────────────────────────────────────────────────────────┘
 *
 *  This file holds, in order:
 *    1. STATS         — the seven primary attributes (canonical, don't rename)
 *    2. ACTION_SKILLS — action verbs, governed by a stat, ≤3 per stat
 *    3. SKILLS         = ABILITIES — chargen perks with stat gates
 *    4. HOBBIES       — stat mods + clique lean + free-ability grants
 *    5. CLIQUES       — social groups + compatibility/rep bias
 *    6. GENDERS / ORIENTATIONS — pronouns + attraction
 *
 *  ──────────────────────────────────────────────────────────────────────────
 *  HOW TO ADD / EDIT (by hand, or just ask me — every catalog has a copy-paste
 *  TEMPLATE right above its array, plus a normalize pass so a partial entry
 *  still works: as long as you give a unique `key` and a `label`, any field you
 *  omit gets a safe default and duplicate keys are warned about, not crashed).
 *
 *  GENERAL RULES THAT APPLY TO EVERY CATALOG BELOW:
 *    • `key` is a unique, stable, lowercase_with_underscores id. It's written
 *      into save files and dialogue conditions, so NEVER reuse or rename a key
 *      once the game has shipped saves.
 *    • `label` is what the player sees. Change it freely.
 *    • Keep commas between entries and quotes around text.
 *    • chargen shows hobbies & abilities ALPHABETICALLY (sorted by label at
 *      load), so you can add entries in any order; selection numbers follow the
 *      sorted order automatically.
 *
 *  CANONICAL STAT KEYS (never rename without updating every tool):
 *    brawn, reflexes, grit, intelligence, savvy, charm, luck
 *
 *  NOTE ON LUCK: luck is NOT a check stat you roll against a difficulty. It
 *  biases the FREQUENCY of good outcomes (more positive encounters, extra cash
 *  while leaf-blowing, escaping bad rolls). So no ability `gate` and no action
 *  skill should require luck; it's a global "good fortune" dial.
 * ========================================================================== */
(function () {
    'use strict';

    // ── 1. STATS ────────────────────────────────────────────────────────────
    // The seven primary attributes. `short` is the 1-character column header
    // used in the terminal stat screen. Order here is the canonical display
    // order everywhere.
    // ── #6: ACTION SKILLS ─────────────────────────────────────────────────
    // "Skills" are the verbs the engine checks when the player attempts a
    // physical/social action: jumping a counter, climbing a barrier, sneaking
    // past a guard, breaking glass, etc. Each skill is GOVERNED BY one primary
    // stat and there are AT MOST 3 skills per stat (a hard design rule — keep it
    // to three so the system stays legible). A skill check rolls the governing
    // stat (+ any situational modifier the obstacle defines) against a target.
    //
    // To add a skill: give it a unique `key`, a `label`, the governing `stat`
    // (one of the STAT keys above), and a one-line `desc`. Keep ≤3 per stat.
    const ACTION_SKILLS = [
        // BRAWN — force.
        { key: 'jump',    label: 'Jump',    stat: 'brawn',        desc: 'Leap over low obstacles like ropes and counters.' },
        { key: 'force',   label: 'Force',   stat: 'brawn',        desc: 'Break glass, shoulder doors, smash through objects.' },
        { key: 'haul',    label: 'Haul',    stat: 'brawn',        desc: 'Carry, drag, or shove heavy things out of the way.' },
        // REFLEXES — finesse + speed.
        { key: 'climb',   label: 'Climb',   stat: 'reflexes',     desc: 'Scramble over tall barriers, railings, and ledges.' },
        { key: 'vault',   label: 'Vault',   stat: 'reflexes',     desc: 'Smoothly clear a waist-high obstacle without slowing.' },
        { key: 'dodge',   label: 'Dodge',   stat: 'reflexes',     desc: 'Slip past swinging doors, falls, and shoves.' },
        // GRIT — toughness + nerve.
        { key: 'endure',  label: 'Endure',  stat: 'grit',         desc: 'Shrug off pain, cuts, and exhaustion; resist knockback.' },
        { key: 'brace',   label: 'Brace',   stat: 'grit',         desc: 'Hold your ground when pushed; steady under pressure.' },
        // INTELLIGENCE — know-how.
        { key: 'tinker',  label: 'Tinker',  stat: 'intelligence', desc: 'Jimmy locks, rewire switches, fix small machines.' },
        { key: 'recall',  label: 'Recall',  stat: 'intelligence', desc: 'Remember layouts, faces, schedules, and trivia.' },
        // SAVVY — perception + streetwise.
        { key: 'hide',    label: 'Hide',    stat: 'savvy',        desc: 'Tuck into shadows and blind spots to avoid notice.' },
        { key: 'sneak',   label: 'Sneak',   stat: 'savvy',        desc: 'Move quietly past people who would otherwise hear you.' },
        { key: 'spot',    label: 'Spot',    stat: 'savvy',        desc: 'Notice hidden things, tells, and shortcuts.' },
        // CHARM — social.
        { key: 'persuade',label: 'Persuade',stat: 'charm',        desc: 'Talk someone into (or out of) something.' },
        { key: 'bluff',   label: 'Bluff',   stat: 'charm',        desc: 'Sell a lie or a bluff with a straight face.' },
        // LUCK — wildcard.
        { key: 'scrounge',label: 'Scrounge',stat: 'luck',         desc: 'Stumble onto something useful when you need it.' },
    ];
    // Quick lookup: skill key → governing stat.
    const SKILL_STAT = {};
    ACTION_SKILLS.forEach(s => { SKILL_STAT[s.key] = s.stat; });

    const STATS = [
        { key: 'brawn',        short: 'B', label: 'Brawn',        desc: 'Lifting, hitting, jumping high, physical intimidation.' },
        { key: 'reflexes',     short: 'R', label: 'Reflexes',     desc: 'Dodging, sneaking, jumping far, fine motor, reaction time.' },
        { key: 'grit',         short: 'G', label: 'Grit',         desc: 'Endurance, resolve, staying calm, resisting persuasion.' },
        { key: 'intelligence', short: 'I', label: 'Intelligence', desc: 'Recall, deduction, technical know-how, pattern recognition.' },
        { key: 'savvy',        short: 'S', label: 'Savvy',        desc: 'Perception, reading rooms, spotting lies, knowing shortcuts.' },
        { key: 'charm',        short: 'C', label: 'Charm',        desc: 'Persuasion, performance, romance, being remembered.' },
        { key: 'luck',         short: 'L', label: 'Luck',         desc: 'Wildcard. Biases random events toward good fortune.' },
    ];

    // Point-buy rules for chargen (kept here so the rule lives with the data).
    const STAT_RULES = {
        base: 5,          // every stat starts here
        min: 1,           // floor after modifiers
        pointBuyMax: 9,   // ceiling you can buy up to during chargen
        pointBudget: 12,  // points spent across stats; leftover = skill budget
    };

    // Age brackets and their stat modifiers (applied on top of point-buy, before
    // hobby mods). Roughly net-zero across brackets so no age is strictly best —
    // they just lean differently. Brackets: MINOR 14-16, TEEN 17-20,
    // TWENTIES 21-25, ADULT 26-30.
    const AGE_MODS = {
        MINOR:    { brawn: 0, reflexes:+1, grit:+1, intelligence:-1, savvy:-1, charm: 0, luck:+1, flavor: 'Wiry, energetic, still figuring people out.' },
        TEEN:     { brawn: 0, reflexes:+1, grit:-1, intelligence: 0, savvy:-1, charm:+1, luck: 0, flavor: 'Peak teen confidence. Less worldly than you act.' },
        TWENTIES: { brawn:-1, reflexes:-1, grit: 0, intelligence:+1, savvy:+1, charm: 0, luck: 0, flavor: 'Body cooling slightly, mind sharpening fast.' },
        ADULT:    { brawn:+1, reflexes:-1, grit: 0, intelligence: 0, savvy:+1, charm:-1, luck: 0, flavor: 'Filled out, seen things, less limber, less polished.' },
    };

    // display labels for the brackets (keys stay stable for save/wiring
    // compatibility; only what the player SEES changed). Old "Minor"→"Teen",
    // old "Teen"→"Adolescent".
    const AGE_BRACKET_LABELS = {
        MINOR: 'Adolescent', TEEN: 'Teen', TWENTIES: 'Twenties', ADULT: 'Adult',
    };

    // ══ 3. ABILITIES (the `SKILLS` array) ═════════════════════════════════════
    // CHARGEN PERKS the player buys or earns at character creation. (The array
    // is named SKILLS for save-compat; players see "Abilities".) Each ability
    // has a stat `gate` that decides who qualifies, and may be granted FREE by a
    // hobby (see HOBBIES.grantsSkills) — a free grant bypasses both the gate and
    // the point cost.
    //
    //   ┌── HOW TO ADD AN ABILITY ──────────────────────────────────────────┐
    //   │ Copy the TEMPLATE, paste it into the SKILLS array, give it a unique │
    //   │ `key` + a `label`. Only key+label are required (normalizeAbility    │
    //   │ fills the rest). Reload — chargen lists it automatically (sorted by │
    //   │ label).                                                             │
    //   └────────────────────────────────────────────────────────────────────┘
    //
    //   TEMPLATE (paste into SKILLS):
    //     { key: 'my_ability', label: 'My Ability',
    //       desc: 'What it lets you do.',
    //       gate: { stats: { charm: [6, null] }, note: 'Charm 6+.' } },
    //
    //   FIELDS:
    //     key   (required) unique lowercase_with_underscores id (saved).
    //     label (required) display name shown to the player.
    //     desc  one-line description / flavor.
    //     gate  who qualifies:
    //           gate.stats — { statKey: [min, max] }. The character's FINAL stat
    //                        (after age + hobby mods) must be in range; use null
    //                        for an open end, e.g. [7, null] = 7+. Omit/{} = no
    //                        stat requirement (anyone can take it).
    //           gate.note  — human-readable summary shown as a hint. (Optional;
    //                        if omitted, normalizeAbility builds one from stats.)
    //     (Don't gate on luck — see the LUCK note in the file header.)
    //
    // Stat thresholds below are STARTING DEFAULTS (proposed, easily tuned).
    const SKILLS = [
        // — Physical / Reflexes —
        { key: 'light_fingers',        label: 'Light Fingers',          desc: 'Pick locks, palm small things, and not get caught.',
          gate: { stats: { reflexes: [6, null], savvy: [5, null] }, note: 'Reflexes 6+, Savvy 5+ (or free from Klepto).' } },
        { key: 'hairpin_houdini',      label: 'Hairpin Houdini',        desc: 'Better lock-picking than Light Fingers, but clumsier and likelier to get caught.',
          gate: { stats: { reflexes: [7, null] }, note: 'Reflexes 7+.' } },
        { key: 'bench_bro',            label: 'Bench Bro',              desc: 'Move heavy things. People remember it.',
          gate: { stats: { brawn: [7, null] }, note: 'Brawn 7+ (or free from Athlete).' } },
        { key: 'brick_house',          label: 'Brick House',            desc: 'Shrug off physical intimidation; hard to push around.',
          gate: { stats: { brawn: [6, null], grit: [6, null] }, note: 'Brawn 6+, Grit 6+.' } },
        { key: 'jumping_jack',         label: 'Jumping Jack',           desc: "Clear gaps and obstacles others can't.",
          gate: { stats: { reflexes: [7, null] }, note: 'Reflexes 7+.' } },

        // — Mental / Intelligence —
        { key: 'photographic_memory',  label: 'Photographic Memory',    desc: 'Recall exact details of rooms and conversations.',
          gate: { stats: { intelligence: [8, null] }, note: 'Intelligence 8+ (or free from Writer).' } },
        { key: 'human_calculator',     label: 'Human Calculator',       desc: 'Mental math; lightning-fast on the register.',
          gate: { stats: { intelligence: [7, null] }, note: 'Intelligence 7+.' } },
        { key: 'tinkerer',             label: 'Tinkerer',               desc: 'Fix things on the fly — a jammed projector, a dead cabinet.',
          gate: { stats: { intelligence: [6, null] }, note: 'Intelligence 6+ (or free from Grease Monkey).' } },
        { key: 'speed_reader',         label: 'Speed Reader',           desc: 'Absorb text fast; skim a document for the one line that matters.',
          gate: { stats: { intelligence: [6, null] }, note: 'Intelligence 6+ (or free from Bookworm).' } },

        // — Social / Charm —
        { key: 'smooth_talker',        label: 'Smooth Talker',          desc: 'De-escalate conflicts. Calm down angry customers.',
          gate: { stats: { charm: [6, null], savvy: [5, null] }, note: 'Charm 6+, Savvy 5+.' } },
        { key: 'flirtatious',          label: 'Flirtatious',            desc: 'Romance arcs progress faster; some events open earlier.',
          gate: { stats: { charm: [7, null] }, note: 'Charm 7+.' } },
        { key: 'easy_smile',           label: 'Easy Smile',             desc: 'A small Charm bonus in social events.',
          gate: { stats: { charm: [5, null] }, note: 'Charm 5+.' } },
        { key: 'bargainer',            label: 'Bargainer',              desc: 'Haggle prices down; wring out a better deal.',
          gate: { stats: { charm: [6, null], savvy: [6, null] }, note: 'Charm 6+, Savvy 6+.' } },
        { key: 'social_chameleon',     label: 'Social Chameleon',       desc: 'Blend into any clique; reduced rep penalties with opposed groups.',
          gate: { stats: { savvy: [7, null] }, note: 'Savvy 7+.' } },
        // "Trust Me, Bro": a brazen-confidence skill — push a dubious claim and
        // have people go along with it on sheer audacity. Distinct from Smooth
        // Talker (which calms) — this one BLUFFS. Leans Charm with a dash of
        // Luck flavor (but Luck isn't a gate per the note at top of file).
        { key: 'trust_me_bro',         label: 'Trust Me, Bro',          desc: 'Bluff your way past with pure confidence; people just... go with it.',
          gate: { stats: { charm: [6, null], grit: [5, null] }, note: 'Charm 6+, Grit 5+. Bluffing takes nerve.' } },

        // — Perception / Savvy —
        { key: 'eagle_eye',            label: 'Eagle Eye',              desc: 'Notice details others miss, especially in busy places.',
          gate: { stats: { savvy: [6, null] }, note: 'Savvy 6+.' } },
        { key: 'gossip_radar',         label: 'Gossip Radar',           desc: 'Pick up rumors and relationship intel early.',
          gate: { stats: { savvy: [6, null], charm: [5, null] }, note: 'Savvy 6+, Charm 5+.' } },
        { key: 'armchair_psychologist',label: 'Armchair Psychologist',  desc: "Read people's motives; spot a lie before it lands.",
          gate: { stats: { savvy: [7, null], intelligence: [6, null] }, note: 'Savvy 7+, Intelligence 6+.' } },

        // — Endurance / Grit —
        { key: 'night_owl',            label: 'Night Owl',              desc: 'Reduced exhaustion penalty for staying up late.',
          gate: { stats: { grit: [6, null] }, note: 'Grit 6+.' } },
        { key: 'morning_person',       label: 'Morning Person',         desc: 'Reduced penalty for early-morning starts.',
          gate: { stats: { grit: [6, null] }, note: 'Grit 6+.' } },
        { key: 'meditation',           label: 'Meditation',             desc: 'Actively lower Stress; steady yourself against "the veil."',
          gate: { stats: { grit: [7, null] }, note: 'Grit 7+.' } },
        { key: 'horror_proof',         label: 'Horror-Proof',           desc: 'Resist fear effects from The Horrors.',
          gate: { stats: { grit: [8, null] }, note: 'Grit 8+.' } },

        // — Tech —
        // [#5 NEW] HOW TO EDIT: an ability = { key, label, desc, gate:{stats:{STAT:[min,max]}, note} }.
        // The gate hides it until the stat minimums are met (see skillEligibility).
        // To wire a real in-game effect, search the engine/game for the ability key.
        { key: 'leet',                 label: '1337',                   desc: 'l33t-grade code-fu: bend terminals, phone systems, and locked machines to your will. R3sp3ct.',
          gate: { stats: { intelligence: [7, null], savvy: [6, null] }, note: 'Intelligence 7+, Savvy 6+.' } },
    ];

    // ══ 4. HOBBIES ════════════════════════════════════════════════════════════
    // Identity ("who I am / what I'm known for"). A hobby nudges stats, leans the
    // character toward certain cliques, and can hand out a free ability.
    //
    //   ┌── HOW TO ADD A HOBBY ─────────────────────────────────────────────┐
    //   │ Copy the TEMPLATE, paste it into the HOBBIES array, give it a       │
    //   │ unique `key` + a `label`. Only key+label are required (normalize    │
    //   │ fills the rest). Reload — chargen lists it automatically.           │
    //   └────────────────────────────────────────────────────────────────────┘
    //
    //   TEMPLATE (paste into HOBBIES):
    //     { key: 'my_hobby', label: 'My Hobby',
    //       mods: { savvy:+1, brawn:-1 },             // stat changes (optional)
    //       cliqueAffinity: { nerd:+1, jock:-1 },     // rep lean (optional)
    //       grantsSkills: ['my_ability'],             // free ABILITIES (optional)
    //       locksClique: '',                          // force a clique (optional)
    //       blurb: 'One-line flavor shown in chargen.' },
    //
    //   FIELDS:
    //     key            (required) unique lowercase_with_underscores id (saved).
    //     label          (required) display name.
    //     mods           { statKey: +/-N } applied on top of age modifiers. {}=none.
    //     cliqueAffinity { cliqueKey: +/-N } reputation lean. {}=neutral.
    //     grantsSkills   array of ABILITY keys (from the SKILLS array above) this
    //                    hobby gives FREE — bypasses the ability's gate + cost.
    //                    NOTE: these are ABILITY keys, not ACTION_SKILL keys.
    //     locksClique    if set to a clique key, taking this hobby forces that
    //                    clique. '' = no lock.
    //     blurb          flavor shown in chargen.
    const HOBBIES = [
        { key: 'klepto',         label: 'Klepto',           mods: { reflexes:+1, savvy:+1, charm:-1 }, cliqueAffinity: { stoner:+1, goth:+1, mallrat:+1, prep:-1 }, grantsSkills: ['light_fingers'], blurb: 'Sticky fingers and a clean conscience about it. You take what you want.' },
        { key: 'photographer',   label: 'Photographer',     mods: { savvy:+1, charm:+1, brawn:-1 },    cliqueAffinity: { hipster:+1, geek:+1, nerd:+1, jock:-1 }, grantsSkills: [],               blurb: 'Carries a camera everywhere; always framing something in their mind.' },
        { key: 'athlete',        label: 'Athlete',          mods: { brawn:+1, reflexes:+1, intelligence:-1 }, cliqueAffinity: { jock:+2, prep:+1, geek:-1, nerd:-1 }, grantsSkills: ['bench_bro'], blurb: 'Weights, cardio, plays a sport. Visibly fit.' },
        { key: 'grease_monkey',  label: 'Grease Monkey',    mods: { brawn:+1, intelligence:+1, charm:-1 }, cliqueAffinity: { lifer:+2, oldhead:+1, jock:+1, prep:-1 }, grantsSkills: ['tinkerer'], blurb: 'Fixes cars. Smells like oil. Knows everything mechanical.' },
        { key: 'larper',         label: 'LARPer',           mods: { charm:+1, reflexes:+1, savvy:-1 },  cliqueAffinity: { nerd:+2, geek:+1, jock:-1, prep:-1 }, grantsSkills: [],               blurb: 'Foam swords in the park on weekends. Has a backstory.' },
        { key: 'mega_stoner',    label: 'Mega-Stoner',      mods: { charm:+1, grit:-1, brawn:-1 },      cliqueAffinity: { stoner:+2, oldhead:+1, prep:-2, jock:-1 }, grantsSkills: [],               locksClique: 'stoner', blurb: 'Bowls before breakfast. Locks you into the Stoners.' },
        { key: 'emo_poet',       label: 'Emo Poet',         mods: { charm:+1, intelligence:+1, savvy:-1 }, cliqueAffinity: { emo:+2, goth:+1, jock:-1, prep:-1 }, grantsSkills: [],            locksClique: 'emo', blurb: 'Black notebooks, black eyeliner, black coffee. Sad smartie.' },
        { key: 'theatre_kid',    label: 'Theatre Kid',      mods: { charm:+1, intelligence:+1, brawn:-1 }, cliqueAffinity: { prep:+1, nerd:+1, hipster:+1, jock:-1 }, grantsSkills: [],            blurb: 'You never really outgrow it. Projection, memorization, easy charisma.' },
        { key: 'mallrat',        label: 'Mallrat',          mods: { savvy:+1, charm:+1, intelligence:-1 }, cliqueAffinity: { mallrat:+2, prep:+1, stoner:+1, nerd:-1 }, grantsSkills: [],            locksClique: 'mallrat', blurb: 'Knows the mall by heart — every shortcut, every sale, every clerk.' },
        { key: 'writer',         label: 'Writer',           mods: { intelligence:+1, charm:+1, reflexes:-1 }, cliqueAffinity: { hipster:+1, nerd:+1, goth:+1, jock:-1 }, grantsSkills: ['photographic_memory'], blurb: 'Notebook full of half-finished somethings. Observes everything.' },
        { key: 'bookworm',       label: 'Bookworm',         mods: { intelligence:+1, charm:-1 },        cliqueAffinity: { nerd:+1, geek:+1, jock:-1 }, grantsSkills: ['speed_reader'], blurb: "Always carrying a paperback. Knows things others don't." },
        { key: 'skater',         label: 'Skater',           mods: { reflexes:+1, savvy:+1, intelligence:-1 }, cliqueAffinity: { stoner:+1, goth:+1, prep:-1, jock:-1 }, grantsSkills: [],         blurb: 'Ollies, kickflips, scraped knees. Anti-everything.' },
        { key: 'mall_ninja',     label: 'Mall Ninja',       mods: { savvy:+1, brawn:+1, charm:-1 },     cliqueAffinity: { mallrat:+1, geek:+1, prep:-1 }, grantsSkills: [],               blurb: 'Tactical everything. Definitely has a butterfly knife.' },
        { key: 'technophile',    label: 'Technophile',      mods: { intelligence:+1, savvy:+1, charm:-1 },        cliqueAffinity: { geek:+2, gamer:+1, nerd:+1, jock:-1, prep:-1 }, grantsSkills: [],               blurb: 'Linux elitist who builds their own rigs. Thermal paste under the nails, IRC-admin energy, knows every IRQ.' },
        { key: 'pc_gamer',       label: 'PC Gamer',         mods: { intelligence:+1, reflexes:+1, brawn:-1, charm:-1 }, cliqueAffinity: { gamer:+2, geek:+1, nerd:+1, jock:-1 }, grantsSkills: [], locksClique: 'gamer', blurb: 'Better than console gamers, and will tell you so.' },
        { key: 'console_gamer',  label: 'Console Gamer',    mods: { reflexes:+1, charm:+1, intelligence:-1 }, cliqueAffinity: { gamer:+2, jock:+1, nerd:+1 }, grantsSkills: [],         locksClique: 'gamer', blurb: 'Better than PC gamers, and will tell you so.' },
        { key: 'music_snob',     label: 'Music Snob',       mods: { charm:+1, savvy:+1, grit:-1 },      cliqueAffinity: { hipster:+2, goth:+1, stoner:+1, prep:-1 }, grantsSkills: [],               blurb: 'Has opinions. Mixtapes for everyone. Knows the local scene.' },
        { key: 'comic_collector',label: 'Comic Collector',  mods: { intelligence:+1, charm:-1 },        cliqueAffinity: { nerd:+2, geek:+1, jock:-1 }, grantsSkills: [],               blurb: 'Long boxes, bagged and boarded. Knows every continuity.' },
        { key: 'anime_fan',      label: 'Otaku',        mods: { intelligence:+1, charm:+1, brawn:-1 }, cliqueAffinity: { nerd:+2, geek:+1, emo:+1 }, grantsSkills: [],            blurb: 'Fansubs traded on VHS, conversational in three anime openings.' },
        { key: 'raver',          label: 'Raver',            mods: { reflexes:+1, charm:+1, intelligence:-1 }, cliqueAffinity: { stoner:+1, hipster:+1, mallrat:+1, prep:-1 }, grantsSkills: [],         blurb: 'PLUR, glowsticks, knows where the party actually is.' },
        { key: 'cinephile',      label: 'Cinephile',        mods: { intelligence:+1, savvy:+1, brawn:-1 }, cliqueAffinity: { hipster:+1, nerd:+1, geek:+1, lifer:+1 }, grantsSkills: [],            blurb: 'Overpriced VHS box sets and strong opinions about aspect ratios.' },
        { key: 'horror_fan',     label: 'Horror Fan',       mods: { grit:+1, intelligence:+1, charm:-1 }, cliqueAffinity: { goth:+1, emo:+1, nerd:+1, geek:+1 }, grantsSkills: [],             blurb: 'Unbothered by gore; oddly calm when things get strange.' },
        { key: 'thrifter',       label: 'Thrifter',         mods: { savvy:+1, charm:+1, brawn:-1 },      cliqueAffinity: { hipster:+2, goth:+1, emo:+1, prep:-1 }, grantsSkills: [],               blurb: 'Finds the gem in the bin. Dresses better than you for less.' },
        { key: 'partier',        label: 'Partier',          mods: { charm:+1, grit:-1, intelligence:-1 }, cliqueAffinity: { jock:+1, prep:+1, mallrat:+1, stoner:+1, nerd:-1 }, grantsSkills: [],             blurb: 'Always knows whose place, what night, and who to bring.' },
        { key: 'gardener',       label: 'Gardener',         mods: { grit:+1, intelligence:+1, reflexes:-1 }, cliqueAffinity: { lifer:+1, oldhead:+1, hipster:+1 }, grantsSkills: [],          blurb: 'Patient hands, dirt under the nails, surprising biology knowledge.' },
        { key: 'martial_artist', label: 'Martial Artist',   mods: { brawn:+1, reflexes:+1, charm:-1 },   cliqueAffinity: { jock:+1, geek:+1, nerd:+1 }, grantsSkills: [],               blurb: 'Years in the dojo. Calm until you really need them not to be.' },
        { key: 'dancer',         label: 'Dancer',           mods: { reflexes:+1, charm:+1, brawn:-1 },   cliqueAffinity: { prep:+1, hipster:+1, emo:+1 }, grantsSkills: [],               blurb: 'Moves like the floor owes them money. Great balance.' },
        { key: 'home_cook',      label: 'Home Cook',        mods: { intelligence:+1, charm:+1, brawn:-1 }, cliqueAffinity: { lifer:+1, hipster:+1, prep:+1 }, grantsSkills: [],            blurb: 'Can make a real meal out of whatever\u2019s in the crisper drawer.' },
        { key: 'baker',          label: 'Baker',            mods: { intelligence:+1, grit:+1, brawn:-1 }, cliqueAffinity: { lifer:+1, prep:+1, nerd:+1 }, grantsSkills: [],             blurb: 'Precise, patient, and always arrives with something warm.' },
        { key: 'card_collector', label: 'Trading-Card Collector', mods: { intelligence:+1, savvy:+1, charm:-1 }, cliqueAffinity: { nerd:+1, geek:+1, mallrat:+1 }, grantsSkills: [],      blurb: 'Mint condition, top-loadered, knows the secondary-market price.' },
        { key: 'tabletop_rpger', label: 'Tabletop RPGer',   mods: { intelligence:+1, charm:+1, brawn:-1 }, cliqueAffinity: { nerd:+2, geek:+1, goth:+1 }, grantsSkills: [],            blurb: 'GMs a Friday game. Thinks in stats and saving throws.' },
        { key: 'paintballer',    label: 'Paintballer',      mods: { brawn:+1, reflexes:+1, charm:-1 },   cliqueAffinity: { jock:+1, gamer:+1, geek:+1 }, grantsSkills: [],               blurb: 'Weekend warrior. Reads cover and angles instinctively.' },
        { key: 'crafter',        label: 'Crafter',          mods: { intelligence:+1, savvy:+1, brawn:-1 }, cliqueAffinity: { lifer:+1, prep:+1, oldhead:+1 }, grantsSkills: [],            blurb: 'Glue gun, bedazzler, and a bin of supplies. Makes the thing instead of buying it.' },

        // ── [#5 NEW HOBBIES] ──────────────────────────────────────────────────
        // HOW TO EDIT (these and every hobby above): each is
        //   { key, label, mods:{STAT:+/-n}, cliqueAffinity:{clique:+/-n},
        //     grantsSkills:[abilityKey], locksClique?, blurb }
        // mods nudge starting stats; cliqueAffinity biases which clique fits;
        // grantsSkills hands a free ABILITY; locksClique forces a clique; blurb
        // is the one-liner shown in the picker. Copy any line to add your own.
        { key: 'drugstore_cowboy', label: 'Drugstore Cowboy', mods: { charm:+1, grit:+1, intelligence:-1 }, cliqueAffinity: { lifer:+1, oldhead:+1, jock:+1, hipster:+1, prep:-1 }, grantsSkills: [], blurb: 'Hat, boots, big buckle \u2014 never roped a steer, never been south of the county line. The mystique still works on the right folks.' },
        { key: 'cooties',          label: 'Cooties',          mods: { charm:-2, savvy:+1 },                cliqueAffinity: { prep:-2, jock:-1, mallrat:-1, churchie:-1, goth:+1, punk:+1 }, grantsSkills: [], blurb: 'Is it the smell? The breath? The face? Nobody can say \u2014 but folks who aren\u2019t already your friends keep their distance for reasons you\u2019ll never see.' },
        { key: 'webmaster',        label: 'Webmaster',        mods: { intelligence:+1, savvy:+1, charm:-1 }, cliqueAffinity: { geek:+2, nerd:+1, gamer:+1, jock:-1, prep:-1 }, grantsSkills: [], blurb: 'Hit counter, guestbook, a spinning \u201cunder construction\u201d GIF \u2014 you run your own site and a few people have actually seen it. Minor legend in the right circles.' },
        { key: 'tinfoil_hat',      label: 'Tinfoil Hat',      mods: { intelligence:+1, savvy:+1, charm:-1 }, cliqueAffinity: { goth:+1, stoner:+1, punk:+1, nerd:+1, prep:-1, jock:-1 }, grantsSkills: [], blurb: 'Black helicopters, the fluoride, the men in black \u2014 you know what\u2019s really going on. The truth is out there, and also in your head.' },
    ];

    // ══ 5. CLIQUES ════════════════════════════════════════════════════════════
    // Social groupings. Cliques DO NOT modify stats (by design) — they shape who
    // likes you and who you can pair with.
    //
    //   ┌── HOW TO ADD A CLIQUE ────────────────────────────────────────────┐
    //   │ Copy the TEMPLATE, paste it into the CLIQUES array, give it a       │
    //   │ unique `key` + a `label`. Only key+label are required. Reload —     │
    //   │ chargen lists it automatically.                                     │
    //   └────────────────────────────────────────────────────────────────────┘
    //
    //   TEMPLATE (paste into CLIQUES):
    //     { key: 'my_clique', label: 'My Clique',
    //       compatible: ['nerd'],               // pairable cliques (optional)
    //       repBias: { nerd:+1, jock:-1 },       // who likes/dislikes you (opt.)
    //       blurb: 'One-line flavor.' },
    //
    //   FIELDS:
    //     key        (required) unique lowercase_with_underscores id (saved).
    //     label      (required) display name.
    //     compatible array of other clique keys this one can be PAIRED with at
    //                chargen (more can open up via gameplay). [] = none.
    //     repBias    { cliqueKey: +/-N } starting reputation lean (+ they like
    //                you, - friction). {} = neutral to everyone.
    //     blurb      flavor shown in chargen.
    //     auto       (optional) 'kid' | 'oldhead' marks an age/tenure
    //                auto-assigned clique; autoBy is a human note of the rule.
    const CLIQUES = [
        { key: 'independent', label: 'Independent', compatible: [], repBias: {}, blurb: 'No clique, no tribe. Comes and goes alone, by choice.' },
        { key: 'loner',       label: 'Loner',       compatible: [], repBias: {}, blurb: 'No clique, no tribe. Comes and goes alone, by force of circumstance.' },
        { key: 'kid',         label: 'Kid',         compatible: [], repBias: { kid:+1 }, auto: 'kid', autoBy: 'age 14-17', blurb: "Under 18, in school. Whatever you land in eventually, right now you're a kid." },
        { key: 'oldhead',     label: 'Oldhead',     compatible: ['stoner','lifer'], repBias: { stoner:+1, lifer:+1, prep:-1 }, auto: 'oldhead', autoBy: 'age 28+ or tenure >3y', blurb: '"I\'ve seen managers come and go."' },
        { key: 'goth',        label: 'Goth',        compatible: ['stoner','nerd','emo'], repBias: { stoner:+1, nerd:+1, emo:+1, prep:-2, jock:-2 }, blurb: 'Eyeliner, Bauhaus, and big coats. Earnestness beneath the gloom.' },
        { key: 'mallrat',     label: 'Mallrat',     compatible: ['prep','stoner'], repBias: { prep:+1, stoner:+1 }, blurb: 'The mall is their third place. There at open and at close.' },
        { key: 'jock',        label: 'Jock',        compatible: ['prep'], repBias: { prep:+1, geek:-1, nerd:-2, goth:-2 }, blurb: 'Letterman energy. Lives for the team and the after-party.' },
        { key: 'stoner',      label: 'Stoner',      compatible: ['goth','oldhead','mallrat'], repBias: { goth:+1, oldhead:+1, mallrat:+1, prep:-2, jock:-1 }, blurb: 'Mellow, generous, perpetually almost-late.' },
        { key: 'hipster',     label: 'Hipster',     compatible: ['geek','goth'], repBias: { hipster:+2, geek:+1, goth:+1, prep:-1, jock:-1 }, blurb: 'Liked it before it was cool. Probably still does.' },
        { key: 'prep',        label: 'Prep',        compatible: ['jock','mallrat'], repBias: { jock:+1, mallrat:+1, goth:-2, nerd:-1, stoner:-2 }, blurb: 'Polished, connected, allowance-funded.' },
        { key: 'emo',         label: 'Emo',         compatible: ['goth','nerd'], repBias: { goth:+1, nerd:+1, jock:-1, prep:-1 }, blurb: 'Heart on the sleeve, lyrics in the margin.' },
        { key: 'lifer',       label: 'Lifer',       compatible: ['oldhead','mallrat'], repBias: { oldhead:+1, mallrat:+1 }, blurb: 'This job is the plan. Quietly runs the place.' },
        { key: 'nerd',        label: 'Nerd',        compatible: ['geek','goth','emo'], repBias: { geek:+1, goth:+1, jock:-2, prep:-1 }, blurb: 'D&D, fantasy novels, anime tapes, comic boxes, and joy.' },
        { key: 'geek',        label: 'Geek',        compatible: ['nerd','gamer','hipster'], repBias: { nerd:+1, gamer:+1, hipster:+1, jock:-1, prep:-1 }, blurb: 'Tech-obsessed and proud. Will fix your computer, with commentary.' },
        { key: 'gamer',       label: 'Gamer',       compatible: ['geek','nerd'], repBias: { geek:+1, nerd:+1, prep:-1 }, blurb: 'Console or PC, the rivalry is eternal. Reflexes for days.' },
        { key: 'punk',        label: 'Punk',        compatible: ['goth','emo','hipster'], repBias: { goth:+1, emo:+1, hipster:+1, prep:-2, jock:-1 }, blurb: 'Anti-authority, pro-noise. Patches over everything.' },
        { key: 'metalhead',   label: 'Metalhead',   compatible: ['stoner','goth'], repBias: { stoner:+1, goth:+1, prep:-2 }, blurb: 'Denim, leather, and an encyclopedic memory for B-sides.' },
        { key: 'churchie',    label: 'Churchie',    compatible: ['prep','lifer'], repBias: { prep:+1, lifer:+1, jock:+1, goth:-1, stoner:-2 }, blurb: 'Youth-group crew. Wholesome on the surface, complicated underneath.' },
        { key: 'theater_kid', label: 'Theater Kid', compatible: ['prep','nerd','hipster'], repBias: { prep:+1, nerd:+1, hipster:+1, jock:-1 }, blurb: 'Loud, warm, dramatic. The Preview is their natural habitat. (Distinct from the Theatre Kid hobby.)' },
    ];

    // ── 5. GENDERS ─────────────────────────────────────────────────────────────
    // Affects romance options and some social compatibility. Each:
    //   key       — canonical id (also what dialogue Gender conditions store).
    //   label     — shown in chargen and elsewhere.
    //   pronouns  — { subj, obj, poss } for dialogue/romance text generation.
    //   blurb     — flavor shown on the chargen GENDER screen.
    //   selfDescribe (optional) — true for the "other" option, which prompts the
    //                 player to type a custom label (stored on the character as
    //                 customGender; conditions still see key 'other').
    // To add a gender: copy an entry, give it a unique key, fill the fields.
    const GENDERS = [
        { key: 'male',        label: 'Male',                  pronouns: { subj: 'he',   obj: 'him',  poss: 'his'   }, blurb: 'He / him.' },
        { key: 'female',      label: 'Female',                pronouns: { subj: 'she',  obj: 'her',  poss: 'her'   }, blurb: 'She / her.' },
        { key: 'nonbinary',   label: 'Nonbinary',             pronouns: { subj: 'they', obj: 'them', poss: 'their' }, blurb: 'They / them (or whatever fits).' },
        { key: 'genderfluid', label: 'Genderfluid',           pronouns: { subj: 'they', obj: 'them', poss: 'their' }, blurb: 'A gender that shifts over time \u2014 between, both, or beyond male and female.' },   // more accurate (the game uses fixed they/them pronouns, so don\u2019t imply daily pronoun changes)
        { key: 'other',       label: 'Other / self-describe', pronouns: { subj: 'they', obj: 'them', poss: 'their' }, blurb: 'Type your own right below.', selfDescribe: true },   // the describe field is inline on the same screen now
    ];

    // ── 5b. PRONOUN SETS (#1) ────────────────────────────────────────────────
    // Pronouns are tracked SEPARATELY from gender so the game can refer to the
    // player correctly regardless of gender label. Each set:
    //   key   — id stored on the character as c.pronouns
    //   label — shown in chargen + on the character sheet (e.g. "they / them")
    //   subj/obj/poss/possPron/reflex — the actual words the game substitutes.
    // 'custom' is filled from the player's own typed pronouns (c.customPronouns).
    // To add a preset: copy a row, give it a unique key.
    const PRONOUN_SETS = [
        { key: 'he',     label: 'he / him',     subj: 'he',   obj: 'him',  poss: 'his',   possPron: 'his',    reflex: 'himself'    },
        { key: 'she',    label: 'she / her',    subj: 'she',  obj: 'her',  poss: 'her',   possPron: 'hers',   reflex: 'herself'    },
        { key: 'they',   label: 'they / them',  subj: 'they', obj: 'them', poss: 'their', possPron: 'theirs', reflex: 'themselves' },
        { key: 'custom', label: 'custom',       subj: 'they', obj: 'them', poss: 'their', possPron: 'theirs', reflex: 'themself'   },
    ];
    // Parse a typed pronoun string like "ze/zir/zir" or "they / them" into a set.
    // Accepts 2-5 slash-separated parts (subj[/obj[/poss[/possPron[/reflex]]]]);
    // missing parts are filled with sensible defaults derived from what's given.
    function parsePronouns(str) {
        const parts = String(str || '').split('/').map(s => s.trim()).filter(Boolean);
        if (!parts.length) return { ...PRONOUN_SETS[2] };   // default they/them
        const subj = parts[0];
        const obj  = parts[1] || subj;
        const poss = parts[2] || (obj + '\u2019s');
        return { key: 'custom', label: parts.slice(0, 2).join(' / ') || subj,
                 subj, obj, poss, possPron: parts[3] || (poss + (poss.endsWith('s') ? '' : 's')), reflex: parts[4] || (obj + 'self') };
    }
    // Resolve the pronoun set the game should USE for a character: their explicit
    // c.pronouns choice (custom uses c.customPronouns), else the gender default.
    function resolvePronouns(character) {
        const c = character || {};
        // #2: a custom set defined in chargen carries every grammatical form.
        if (c.pronouns === 'custom' && c.customPronounForms) {
            const f = c.customPronounForms;
            return { key: 'custom', label: (f.subj || 'they') + ' / ' + (f.obj || 'them'),
                     subj: f.subj || 'they', obj: f.obj || 'them', poss: f.poss || 'their',
                     possPron: f.possPron || 'theirs', reflex: f.reflex || 'themself' };
        }
        if (c.pronouns === 'custom' && c.customPronouns) return parsePronouns(c.customPronouns);
        const set = PRONOUN_SETS.find(p => p.key === c.pronouns);
        if (set && set.key !== 'custom') return { ...set };
        // fall back to the chosen gender's default pronouns
        const g = (c.gender && GENDERS.find(x => x.key === c.gender)) || null;
        if (g && g.pronouns) return { key: 'gender', label: g.pronouns.subj + ' / ' + g.pronouns.obj, subj: g.pronouns.subj, obj: g.pronouns.obj, poss: g.pronouns.poss, possPron: g.pronouns.poss, reflex: g.pronouns.obj + 'self' };
        return { ...PRONOUN_SETS[2] };
    }

    // Affects which romance arcs open or close. No "best" option — every one has
    // storylines. Each:
    //   key, label, blurb as usual.
    //   attractedTo — high-level model the romance system can compute against:
    //       'opposite' | 'same' | 'any' | 'none'
    //     (asexual/aromantic use 'none' for the SEXUAL axis; romance may still
    //      occur — the romance system decides how to read this. 'questioning'
    //      and 'other' use 'any' so arcs stay open.)
    const ORIENTATIONS = [
        { key: 'straight',    label: 'Straight',                  attractedTo: 'opposite', blurb: 'Attracted to the opposite gender.' },
        { key: 'gay',         label: 'Gay / Lesbian',             attractedTo: 'same',     blurb: 'Attracted to the same gender.' },
        { key: 'bisexual',    label: 'Bisexual',                  attractedTo: 'any',      blurb: 'Attracted to two or more genders.' },
        { key: 'pansexual',   label: 'Pansexual',                 attractedTo: 'any',      blurb: 'Attraction not constrained by gender.' },
        { key: 'asexual',     label: 'Asexual',                   attractedTo: 'none',     blurb: 'Little or no sexual attraction; romance still possible.' },
        { key: 'aromantic',   label: 'Aromantic',                 attractedTo: 'none',     blurb: 'Little or no romantic attraction; friendships and connections still flourish.' },
        { key: 'questioning', label: 'Questioning',               attractedTo: 'any',      blurb: 'Still figuring it out.' },
        { key: 'other',       label: 'Other / prefer not to say', attractedTo: 'any',      blurb: 'Romance arcs open based on situation.' },
    ];

    // ── 7. CONDITION/CHECK VOCABULARY (used by Saymaker + dialogue runtime) ─────
    // The kinds of things a dialogue condition or skill-check can test, and the
    // comparison operators allowed. Saymaker builds its dropdowns from these so
    // an author can never reference a type/operator that the runtime can't read.
    const CONDITION_TYPES = ['Stat', 'Skill', 'Hobby', 'Clique', 'Item', 'Gender', 'Orientation', 'Romance', 'Appearance'];
    const OPERATORS = ['==', '>=', '<=', '>', '<', '!='];

    // ── helper: which skills a given set of hobbies grants for free ────────────
    function grantedSkillsFor(hobbyKeys) {
        const out = new Set();
        (hobbyKeys || []).forEach(hk => {
            const h = HOBBIES.find(x => x.key === hk);
            if (h && h.grantsSkills) h.grantsSkills.forEach(s => out.add(s));
        });
        return Array.from(out);
    }

    // ── #1: NORMALIZE PASSES ───────────────────────────────────────────────────
    // Mirror items.js: apply DEFAULTS so a hand-added entry only NEEDS key+label,
    // drop malformed entries (no key), and warn (don't crash) on duplicate keys.
    // Any extra field you add to an entry is preserved untouched.
    function warnDupes(arr, name) {
        const seen = {};
        arr.forEach(e => { if (e && e.key) { if (seen[e.key]) console.warn('[gameData] DUPLICATE ' + name + ' key (later wins):', e.key); seen[e.key] = true; } });
    }
    function dropKeyless(arr, name) {
        for (let i = arr.length - 1; i >= 0; i--) { if (!arr[i] || !arr[i].key) { console.warn('[gameData] skipping ' + name + ' entry with no key:', arr[i]); arr.splice(i, 1); } }
    }
    // ABILITIES (the SKILLS array)
    dropKeyless(SKILLS, 'ability');
    SKILLS.forEach(s => {
        if (s.label === undefined) s.label = s.key;
        if (s.desc  === undefined) s.desc  = '';
        if (!s.gate || typeof s.gate !== 'object') s.gate = { stats: {}, note: 'Anyone can take it.' };
        if (!s.gate.stats || typeof s.gate.stats !== 'object') s.gate.stats = {};
        if (s.gate.note === undefined) {
            const parts = Object.keys(s.gate.stats).map(k => k + ' ' + (s.gate.stats[k][0] != null ? s.gate.stats[k][0] + '+' : 'any'));
            s.gate.note = parts.length ? parts.join(', ') + '.' : 'Anyone can take it.';
        }
    });
    warnDupes(SKILLS, 'ability');
    // HOBBIES
    dropKeyless(HOBBIES, 'hobby');
    HOBBIES.forEach(h => {
        if (h.label === undefined) h.label = h.key;
        if (!h.mods || typeof h.mods !== 'object') h.mods = {};
        if (!h.cliqueAffinity || typeof h.cliqueAffinity !== 'object') h.cliqueAffinity = {};
        if (!Array.isArray(h.grantsSkills)) h.grantsSkills = h.grantsSkills ? [h.grantsSkills] : [];
        if (h.locksClique === undefined) h.locksClique = '';
        if (h.blurb === undefined) h.blurb = '';
    });
    warnDupes(HOBBIES, 'hobby');
    // CLIQUES
    dropKeyless(CLIQUES, 'clique');
    CLIQUES.forEach(c => {
        if (c.label === undefined) c.label = c.key;
        if (!Array.isArray(c.compatible)) c.compatible = c.compatible ? [c.compatible] : [];
        if (!c.repBias || typeof c.repBias !== 'object') c.repBias = {};
        if (c.blurb === undefined) c.blurb = '';
    });
    warnDupes(CLIQUES, 'clique');

    // Convenience lookups by key.
    const byKey = (arr) => arr.reduce((m, x) => (m[x.key] = x, m), {});

    window.GameData = {
        STATS, STAT_RULES, AGE_MODS, AGE_BRACKET_LABELS, SKILLS, HOBBIES, CLIQUES, GENDERS, ORIENTATIONS,
        PRONOUN_SETS, parsePronouns, resolvePronouns,
        ACTION_SKILLS, SKILL_STAT,
        CONDITION_TYPES, OPERATORS,
        // lookups
        actionSkillsByKey: byKey(ACTION_SKILLS),
        actionSkillKeys:   ACTION_SKILLS.map(s => s.key),
        // skills grouped by their governing stat (≤3 each) — handy for UI.
        actionSkillsByStat: ACTION_SKILLS.reduce((m, s) => ((m[s.stat] = m[s.stat] || []).push(s), m), {}),
        statsByKey:   byKey(STATS),
        skillsByKey:  byKey(SKILLS),
        hobbiesByKey: byKey(HOBBIES),
        cliquesByKey: byKey(CLIQUES),
        gendersByKey: byKey(GENDERS),
        orientationsByKey: byKey(ORIENTATIONS),
        // helpers
        grantedSkillsFor,
        // plain key lists (handy for dropdowns)
        statKeys:        STATS.map(s => s.key),
        skillKeys:       SKILLS.map(s => s.key),
        hobbyKeys:       HOBBIES.map(h => h.key),
        cliqueKeys:      CLIQUES.map(c => c.key),
        genderKeys:      GENDERS.map(g => g.key),
        orientationKeys: ORIENTATIONS.map(o => o.key),
    };
})();

// ── CONTROL-KEY NAME TEMPLATING (#10) ─────────────────────────────────────────
// One source of truth for which KEY performs each ACTION, plus helpers that turn
// an action name into the bound key's display name. Write instruction/prompt text
// with {interact}/{jump}/{flashlight}/… placeholders and run it through
// GameData.fillKeys() (or window.fillKeys) so the text always shows the REAL key.
// Change a binding here ONCE and every prompt/label/lesson that uses a placeholder
// updates automatically — no more hard-coded "(E)" drifting out of sync.
//   window.keyName('interact')            -> 'G'
//   window.fillKeys('Press {interact}')   -> 'Press G'
// HOW TO MODIFY: add/rename an action below, then use {thatAction} anywhere.
(function () {
  var KEYBINDS = {
    interact: 'G', advance: 'G', take: 'G', pickup: 'G',
    jump: 'Space', climb: 'Space', crouch: 'X', flashlight: 'F', map: 'M',
    rotateLeft: 'Q', rotateRight: 'E', tilt: 'T', firstPerson: 'V',
    command: 'Enter', confirm: 'Enter', back: 'Esc', cancel: 'Esc',
    moveUp: 'W', moveDown: 'S', moveLeft: 'A', moveRight: 'D'
  };
  function keyName(action) {
    if (!action) return '';
    if (KEYBINDS[action] != null) return KEYBINDS[action];
    var k = String(action).toLowerCase();
    for (var a in KEYBINDS) { if (a.toLowerCase() === k) return KEYBINDS[a]; }
    return String(action);            // unknown action → leave the text as-is
  }
  function fillKeys(str) {
    if (str == null) return str;
    return String(str).replace(/\{([a-zA-Z_]+)\}/g, function (m, a) {
      var n = keyName(a);
      return (n === a) ? m : n;        // unknown {placeholder} stays untouched
    });
  }
  if (!window.KEYBINDS) window.KEYBINDS = KEYBINDS;
  if (!window.keyName)  window.keyName  = keyName;
  if (!window.fillKeys) window.fillKeys = fillKeys;
  if (window.GameData) { window.GameData.KEYBINDS = KEYBINDS; window.GameData.keyName = keyName; window.GameData.fillKeys = fillKeys; }
})();

// ── GAME-WIDE PRONOUNS (#1 / C) ───────────────────────────────────────────────
// A single resolver any system can call to refer to ANY character correctly —
// the player, an NPC, or the randomized antagonist. It never throws and always
// returns a usable set (falls back to they/them), so even a half-built character
// reads grammatically. Characters carry: { gender, pronouns:'he'|'she'|'they'|
// 'custom', customPronouns:'ze/zir/zir' }. Missing fields fall back to the
// gender default, then to they/them.
//
//   Pronouns.of(char)                 -> { subj, obj, poss, possPron, reflex, label }
//   Pronouns.fill('{They} dropped {their} ticket.', char)
//       placeholders (case-sensitive for capitalization):
//       {subj}{obj}{poss}{possPron}{reflex} and {Subj}{Obj}{Poss}{PossPron}{Reflex}
//       plus verb helpers {is}/{has}/{s} that agree with they (are/have/-) vs
//       he/she (is/has/s).  e.g. '{They} {is} here' -> 'They are here' / 'He is here'.
//   Pronouns.player()                 -> resolves the current player character.
// HOW TO MODIFY: add presets in PRONOUN_SETS (gameData), or extend fill()'s map.
(function () {
  var GD = window.GameData || {};
  function setFor(char) {
    try {
      if (GD && typeof GD.resolvePronouns === 'function') return GD.resolvePronouns(char || {});
    } catch (e) {}
    return { key: 'they', label: 'they / them', subj: 'they', obj: 'them', poss: 'their', possPron: 'theirs', reflex: 'themselves' };
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function fill(str, char) {
    if (str == null) return str;
    var p = setFor(char);
    var they = (p.subj || 'they').toLowerCase() === 'they';
    var map = {
      subj: p.subj, obj: p.obj, poss: p.poss, possPron: p.possPron, reflex: p.reflex,
      Subj: cap(p.subj), Obj: cap(p.obj), Poss: cap(p.poss), PossPron: cap(p.possPron), Reflex: cap(p.reflex),
      // verb agreement: they ARE / he IS ; they HAVE / he HAS ; they go / he goes
      is: they ? 'are' : 'is', Is: they ? 'Are' : 'Is',
      has: they ? 'have' : 'has', Has: they ? 'Have' : 'Has',
      s: they ? '' : 's', es: they ? '' : 'es'
    };
    return String(str).replace(/\{(subj|obj|poss|possPron|reflex|Subj|Obj|Poss|PossPron|Reflex|is|Is|has|Has|s|es)\}/g,
      function (m, k) { return (map[k] != null) ? map[k] : m; });
  }
  window.Pronouns = {
    of: setFor,
    fill: fill,
    player: function () {
      var pc = (window.State && window.State.character) || (window.Game && window.Game.character) || null;
      return setFor(pc);
    }
  };
  // convenience: a live object many older call-sites expect
  try { Object.defineProperty(window, 'playerPronouns', { get: function () { return window.Pronouns.player(); }, configurable: true }); } catch (e) {}
})();
