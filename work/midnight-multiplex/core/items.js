/* ============================================================================
 *  core/items.js  —  ITEM MANIFEST + STARTER-KIT + NPC GENERATION
 * ----------------------------------------------------------------------------
 *  This is the ONE source of truth for every item, garment, and piece of gear
 *  in the game. It is plain JavaScript (no build step) and is exposed as
 *  window.GameItems. Mapster, the chargen wardrobe, the character sheet, and
 *  the 3D engine all read from here, so adding an item HERE makes it show up
 *  everywhere automatically.
 *
 *  ┌──────────────────────────────────────────────────────────────────────┐
 *  │  HOW TO ADD AN ITEM  (you can ask me to do this, or do it by hand)     │
 *  ├──────────────────────────────────────────────────────────────────────┤
 *  │  1. Find the right section below (TOPS, OUTERWEAR, … TOOLS, WEAPONS,   │
 *  │     CONSUMABLES). Sections are just comment dividers; order is cosmetic.│
 *  │  2. Copy the TEMPLATE line (just under this box) and paste it into that │
 *  │     section.                                                            │
 *  │  3. Give it a UNIQUE `id` (lowercase_with_underscores). The id is saved │
 *  │     in save files + equip slots, so never reuse or rename an existing   │
 *  │     one once the game has shipped saves.                                │
 *  │  4. Fill in the fields. Only `id` and `name` are strictly required;     │
 *  │     everything else has a sensible default (see DEFAULTS below).        │
 *  │  5. That's it — reload the game. No registration step anywhere else.    │
 *  └──────────────────────────────────────────────────────────────────────┘
 *
 *  COPY-PASTE TEMPLATE (delete the fields you don't need; trailing ones are
 *  optional). Keep it on one line to match the manifest's style, or spread it
 *  across lines — JS doesn't care:
 *
 *    { id:'unique_id', name:'Display Name', slot:'shirt', category:'Tops',
 *      value:20, desc:'One-line description.', where:'(where to buy/find)',
 *      color:C.navy, style:'short', tags:['any'] },
 *
 *  ── FIELD REFERENCE ───────────────────────────────────────────────────────
 *    id        (required) unique string key. lowercase_with_underscores.
 *    name      (required) display name shown to the player.
 *    slot      equipment slot the item occupies when worn, OR null/omit for
 *              non-worn gear that lives in a pocket/inventory. Valid slots:
 *                'shirt' | 'jacket' | 'pants' | 'belt' | 'footwear' |
 *                'headwear' | 'eyewear' | 'accessory'
 *    category  manifest grouping for menus. Existing groups: 'Tops',
 *              'Outerwear', 'Bottoms', 'Footwear', 'Headwear', 'Eyewear',
 *              'Accessories', 'Tools', 'Weapons', 'Consumables'. You may invent
 *              a new group name; it'll just appear as its own heading.
 *    value     price in whole dollars (number), or null if not for sale.
 *    desc      short one-line description.
 *    where     human hint about where it's bought/found, e.g. '(mall, thrift)'.
 *    color     default hex color — drives the WORN 3D model. Use a C.* palette
 *              entry (see PALETTE below) or any '#rrggbb' string. Clothing only.
 *    style     visual cut, used by the 3D model. By slot:
 *                tops:     'long' | 'short' | 'tank' | 'collared' | 'bra' | 'none'
 *                bottoms:  'pants' | 'shorts' | 'swim' | 'skirt' | 'underwear'
 *                footwear: 'sneakers' | 'boots' | 'sandals' | 'dress' |
 *                          'skates' | 'barefoot'
 *    tags      free-form tags the starter-kit picker uses to match a new
 *              character's clique / hobby / age. 'any' = fits anyone. Examples:
 *              'punk','jock','prep','goth','skater','gamer','grunge','mallrat',
 *              'stoner','metalhead','emo','geek','churchie','lifer',
 *              'grease_monkey'. Add your own freely.
 *    era       optional; 1 = period-appropriate for 1999 (the default). Set 0
 *              only if you deliberately add an anachronistic item.
 *
 *  ── NEW FIELDS YOU CAN ADD ────────────────────────────────────────────────
 *    You can attach ANY extra field you like to an item and read it elsewhere;
 *    unknown fields are preserved and ignored by code that doesn't use them.
 *    Suggested conventions for upcoming systems:
 *      weight    (number) for an encumbrance system
 *      damage    (number) for a weapon
 *      heals     (number) HP restored by a consumable
 *      stackable (bool)   whether multiples stack in one inventory slot
 *
 *  ── DEFAULTS (applied at load by normalizeItem() — see bottom) ─────────────
 *    slot:null  category:'Misc'  value:null  desc:''  where:''  color:'#888'
 *    style:'none'  era:1  tags:[]
 *
 *  SLOT MODEL (what a dressed character/NPC wears — see engine.js): shirt,
 *  jacket(optional), pants, belt(optional), footwear, + optional headwear/
 *  eyewear/accessory. Each worn item carries a color the 3D model uses; the
 *  worn color can be OVERRIDDEN per-character in Mapster.
 * ========================================================================== */
(function () {
  'use strict';

  // ── COLOR PALETTES (era-appropriate) ──────────────────────────────────────
  // Reference these as C.navy, C.denim, etc. in an item's `color` field. You
  // can also use a raw '#rrggbb' string. Add new named colors here freely.
  const C = {
    black:'#1a1a1a', white:'#e8e8e8', gray:'#6b7280', navy:'#1e3a5f',
    red:'#9b2226', maroon:'#5b1a1a', forest:'#1f3d2b', olive:'#5b5a2a',
    denim:'#3b5a78', stonewash:'#7d96ad', khaki:'#b6a06a', tan:'#c2a878',
    purple:'#4a2a6a', plum:'#6a2a5a', teal:'#1f6a6a', mustard:'#c79a2a',
    orange:'#c2622a', pink:'#c2719b', babyblue:'#8fb4d6', lime:'#7aa53a',
    burgundy:'#4a1f2a', brown:'#5a3a22', cream:'#dcd2b8', silver:'#aab0b8'
  };

  // ── THE MANIFEST ──────────────────────────────────────────────────────────
  // Add items by copying the TEMPLATE from the header into the right section.
  // Sections below are comment dividers only — the engine doesn't care about
  // order, just the `id`/`slot`/`category` fields on each entry.
  const ITEMS = [
    // ---- TOPS (slot: shirt) -------------------------------------------------
    { id:'tee_plain',      name:'Plain T-Shirt',         slot:'shirt', category:'Tops', value:8,  desc:'A basic cotton tee.',                     where:'(mall, thrift)', color:C.white,  style:'short',   tags:['any'] },
    { id:'tee_band',       name:'Band T-Shirt',          slot:'shirt', category:'Tops', value:18, desc:'Tour dates on the back.',                 where:'(record store, show)', color:C.black, style:'short', tags:['punk','metalhead','goth','emo','stoner'] },
    { id:'tee_graphic',    name:'Graphic Tee',           slot:'shirt', category:'Tops', value:12, desc:'Loud 90s print.',                         where:'(mall)', color:C.teal,   style:'short',   tags:['mallrat','gamer','geek','skater'] },
    { id:'longsleeve',     name:'Long-Sleeve Shirt',     slot:'shirt', category:'Tops', value:14, desc:'Plain long sleeves.',                     where:'(mall, thrift)', color:C.gray,   style:'long',    tags:['any'] },
    { id:'thermal',        name:'Thermal Henley',        slot:'shirt', category:'Tops', value:16, desc:'Waffle-knit, grunge staple.',             where:'(thrift)', color:C.maroon, style:'long',  tags:['stoner','grunge','metalhead'] },
    { id:'flannel',        name:'Flannel Shirt',         slot:'shirt', category:'Tops', value:20, desc:'Open over a tee, or buttoned.',           where:'(thrift, mall)', color:C.red, style:'collared', tags:['stoner','grunge','skater','metalhead'] },
    { id:'polo',           name:'Polo Shirt',            slot:'shirt', category:'Tops', value:22, desc:'Collar up, of course.',                   where:'(mall)', color:C.navy,   style:'collared',tags:['prep','jock','churchie'] },
    { id:'buttondown',     name:'Button-Down Shirt',     slot:'shirt', category:'Tops', value:28, desc:'Tucked or untucked.',                     where:'(mall, dept store)', color:C.babyblue, style:'collared', tags:['prep','lifer','churchie'] },
    { id:'tank',           name:'Tank Top',              slot:'shirt', category:'Tops', value:9,  desc:'Sleeveless. Beat the heat.',              where:'(mall)', color:C.white,  style:'tank',    tags:['jock','mallrat'] },
    { id:'jersey',         name:'Sports Jersey',         slot:'shirt', category:'Tops', value:35, desc:'Your team. Mesh.',                        where:'(sports shop)', color:C.red, style:'short', tags:['jock'] },
    { id:'crop_tee',       name:'Cropped Tee',           slot:'shirt', category:'Tops', value:10, desc:'90s mall fashion.',                       where:'(mall)', color:C.pink,   style:'short',   tags:['mallrat','prep'] },
    { id:'bra_sport',      name:'Sports Bra',            slot:'shirt', category:'Tops', value:14, desc:'For working out (or layering).',          where:'(sports shop)', color:C.gray, style:'bra', tags:['jock'] },

    // ---- OUTERWEAR (slot: jacket) ------------------------------------------
    { id:'denim_jacket',   name:'Denim Jacket',          slot:'jacket', category:'Outerwear', value:40, desc:'Classic, breaks in nicely.',         where:'(thrift, mall)', color:C.denim, style:'jacket', tags:['any'] },
    { id:'leather_jacket', name:'Leather Jacket',        slot:'jacket', category:'Outerwear', value:90, desc:'Worn-in black leather.',             where:'(thrift, vintage)', color:C.black, style:'jacket', tags:['punk','metalhead','goth'] },
    { id:'letterman',      name:'Letterman Jacket',      slot:'jacket', category:'Outerwear', value:120,desc:'Wool body, leather sleeves.',        where:'(school)', color:C.maroon, style:'jacket', tags:['jock','prep'] },
    { id:'windbreaker',    name:'Windbreaker',           slot:'jacket', category:'Outerwear', value:30, desc:'Loud color-block nylon.',            where:'(mall)', color:C.teal,  style:'jacket', tags:['mallrat','skater','any'] },
    { id:'hoodie',         name:'Zip Hoodie',            slot:'jacket', category:'Outerwear', value:28, desc:'Hood up, hands in pocket.',          where:'(mall)', color:C.gray,  style:'jacket', tags:['skater','gamer','stoner','emo','any'] },
    { id:'trenchcoat',     name:'Long Coat',             slot:'jacket', category:'Outerwear', value:60, desc:'Dramatic. Billows.',                 where:'(thrift, vintage)', color:C.black, style:'jacket', tags:['goth'] },
    { id:'puffer_vest',    name:'Puffer Vest',           slot:'jacket', category:'Outerwear', value:34, desc:'Warm core, free arms.',             where:'(mall)', color:C.forest, style:'vest', tags:['prep','lifer'] },
    { id:'flannel_vest',   name:'Quilted Vest',          slot:'jacket', category:'Outerwear', value:30, desc:'Practical layer.',                   where:'(thrift)', color:C.olive, style:'vest', tags:['grease_monkey','lifer'] },

    // ---- LEGS (slot: pants) -------------------------------------------------
    { id:'jeans',          name:'Blue Jeans',            slot:'pants', category:'Bottoms', value:30, desc:'Five-pocket denim.',                    where:'(mall, thrift)', color:C.denim, style:'pants', tags:['any'] },
    { id:'jeans_black',    name:'Black Jeans',           slot:'pants', category:'Bottoms', value:32, desc:'Goes with everything dark.',            where:'(mall)', color:C.black, style:'pants', tags:['punk','goth','metalhead','emo'] },
    { id:'baggy_jeans',    name:'Baggy Jeans',           slot:'pants', category:'Bottoms', value:34, desc:'JNCO-wide. Very 1999.',                 where:'(mall)', color:C.stonewash, style:'pants', tags:['skater','mallrat','gamer'] },
    { id:'cargo_pants',    name:'Cargo Pants',           slot:'pants', category:'Bottoms', value:36, desc:'Pockets for days.',                     where:'(mall, surplus)', color:C.khaki, style:'pants', tags:['skater','gamer','any'] },
    { id:'khakis',         name:'Khaki Chinos',          slot:'pants', category:'Bottoms', value:32, desc:'Pressed and proper.',                   where:'(dept store)', color:C.khaki, style:'pants', tags:['prep','churchie','lifer'] },
    { id:'work_pants',     name:'Work Trousers',         slot:'pants', category:'Bottoms', value:28, desc:'Durable, a little oil-stained.',        where:'(surplus)', color:C.navy, style:'pants', tags:['grease_monkey','lifer'] },
    { id:'cargo_shorts',   name:'Cargo Shorts',          slot:'pants', category:'Bottoms', value:24, desc:'Knee-length, many pockets.',            where:'(mall)', color:C.tan, style:'shorts', tags:['jock','skater','any'] },
    { id:'athletic_shorts',name:'Athletic Shorts',       slot:'pants', category:'Bottoms', value:18, desc:'Mesh, for the gym.',                    where:'(sports shop)', color:C.navy, style:'shorts', tags:['jock'] },
    { id:'plaid_skirt',    name:'Plaid Skirt',           slot:'pants', category:'Bottoms', value:26, desc:'A 90s staple.',                         where:'(mall)', color:C.maroon, style:'skirt', tags:['mallrat','prep','goth'] },
    { id:'swim_trunks',    name:'Swim Trunks',           slot:'pants', category:'Bottoms', value:20, desc:'For the pool. Loud print.',             where:'(mall)', color:C.teal, style:'swim', tags:['jock'] },
    { id:'boxers',         name:'Boxers',                slot:'pants', category:'Bottoms', value:6,  desc:'Just the basics.',                      where:'(dept store)', color:C.babyblue, style:'underwear', tags:['none'] },

    // ---- BELTS (slot: belt) -------------------------------------------------
    { id:'belt_leather',   name:'Leather Belt',          slot:'belt', category:'Belts', value:12, desc:'Brown or black.',                        where:'(dept store)', color:C.brown, style:'belt', tags:['any'] },
    { id:'belt_studded',   name:'Studded Belt',          slot:'belt', category:'Belts', value:16, desc:'Metal pyramid studs.',                   where:'(mall, Hot Topic)', color:C.black, style:'belt', tags:['punk','emo','goth','metalhead'] },
    { id:'belt_canvas',    name:'Canvas Web Belt',       slot:'belt', category:'Belts', value:8,  desc:'D-ring buckle.',                          where:'(surplus)', color:C.olive, style:'belt', tags:['skater','any'] },
    { id:'chain_wallet',   name:'Chain Wallet',          slot:'belt', category:'Belts', value:14, desc:'Wallet on a chain.',                      where:'(mall)', color:C.silver, style:'chain', tags:['punk','skater','metalhead'] },

    // ---- FOOTWEAR (slot: footwear) -----------------------------------------
    { id:'sneakers',       name:'Sneakers',              slot:'footwear', category:'Footwear', value:45, desc:'Everyday kicks.',                  where:'(mall)', color:C.white, style:'sneakers', tags:['any'] },
    { id:'hightops',       name:'Hi-Top Sneakers',       slot:'footwear', category:'Footwear', value:55, desc:'Basketball-style.',                where:'(sports shop)', color:C.red, style:'sneakers', tags:['jock','gamer','mallrat'] },
    { id:'skate_shoes',    name:'Skate Shoes',           slot:'footwear', category:'Footwear', value:50, desc:'Flat, padded, scuffed.',           where:'(skate shop)', color:C.black, style:'sneakers', tags:['skater'] },
    { id:'combat_boots',   name:'Combat Boots',          slot:'footwear', category:'Footwear', value:60, desc:'Laced high. Stompy.',              where:'(surplus, Hot Topic)', color:C.black, style:'boots', tags:['punk','goth','metalhead','emo'] },
    { id:'work_boots',     name:'Work Boots',            slot:'footwear', category:'Footwear', value:55, desc:'Steel toe, broken in.',            where:'(surplus)', color:C.brown, style:'boots', tags:['grease_monkey','lifer'] },
    { id:'dress_shoes',    name:'Dress Shoes',           slot:'footwear', category:'Footwear', value:50, desc:'Polished leather.',                where:'(dept store)', color:C.black, style:'dress', tags:['prep','churchie','lifer'] },
    { id:'sandals',        name:'Sandals',               slot:'footwear', category:'Footwear', value:18, desc:'Toes out.',                        where:'(mall)', color:C.tan, style:'sandals', tags:['stoner','any'] },
    { id:'rollerblades',   name:'Rollerblades',          slot:'footwear', category:'Footwear', value:80, desc:'Inline skates.',                   where:'(sports shop)', color:C.silver, style:'skates', tags:['skater'] },

    // ---- HEADWEAR / EYEWEAR / ACCESSORY ------------------------------------
    { id:'cap',            name:'Baseball Cap',          slot:'headwear', category:'Accessories', value:14, desc:'Forward, or backward.',          where:'(mall)', color:C.navy, style:'cap', tags:['jock','skater','mallrat','any'] },
    { id:'beanie',         name:'Knit Beanie',           slot:'headwear', category:'Accessories', value:10, desc:'Slouchy.',                       where:'(mall)', color:C.gray, style:'beanie', tags:['stoner','skater','emo','grunge'] },
    { id:'bandana',        name:'Bandana',               slot:'headwear', category:'Accessories', value:5,  desc:'Folded headband-style.',         where:'(mall)', color:C.red, style:'bandana', tags:['metalhead','grease_monkey'] },
    { id:'sunglasses',     name:'Sunglasses',            slot:'eyewear', category:'Accessories', value:20, desc:'Oakley-ish wraparounds.',         where:'(mall)', color:C.black, style:'shades', tags:['any'] },
    { id:'glasses',        name:'Eyeglasses',            slot:'eyewear', category:'Accessories', value:0,  desc:'You need these to see.',          where:'(optometrist)', color:C.silver, style:'glasses', tags:['nerd','geek'] },
    { id:'glasses_3d',     name:'3D Glasses',            slot:'eyewear', category:'Accessories', value:2,  desc:'Red/blue lenses from the Preview.',where:'(theatre)', color:C.red, style:'glasses', tags:['gamer','geek'] },

    // ---- GEAR (from OBJ__Items___Crafting.docx; not worn) ------------------
    { id:'screwdriver',    name:'Screwdriver',           slot:null, category:'Tools', value:3, desc:'Reversible-tip. Handy. (Can also be a weapon.)', where:'(hardware)', tags:['grease_monkey','tinkerer'] },
    { id:'hammer',         name:'Hammer',                slot:null, category:'Tools', value:3, desc:'(Can also be a weapon.)', where:'(hardware)', tags:['grease_monkey'] },
    { id:'duct_tape',      name:'Duct Tape',             slot:null, category:'Tools', value:2, desc:'Fixes most things, briefly.', where:'(hardware)', tags:['any'] },
    { id:'pocket_knife',   name:'Pocket Knife',          slot:null, category:'Tools', value:8, desc:'Folding blade. (Can also be a weapon.)', where:'(surplus)', tags:['skater','grease_monkey'] },
    { id:'sewing_kit',     name:'Sewing Kit',            slot:null, category:'Tools', value:6, desc:'Needles, thread, patches.', where:'(craft store)', tags:['seamster','punk'] },
    { id:'flashlight_sm',  name:'Small Flashlight',      slot:null, category:'Gear', value:5, desc:'Pocket-sized.', where:'(hardware)', tags:['any'] },
    { id:'gameboy',        name:'Game Boy Color',        slot:null, category:'Entertainment', value:70, desc:'Pocket gaming.', where:'(toy store)', tags:['gamer','geek'] },
    { id:'portable_cd',    name:'Portable CD Player',    slot:null, category:'Entertainment', value:60, desc:'Skips if you run.', where:'(electronics)', tags:['emo','goth','metalhead','any'] },
    { id:'walkman_tapes',  name:'Mixtape',               slot:null, category:'Entertainment', value:0, desc:'Hand-labeled. Someone made this for you.', where:'(a friend)', tags:['emo','any'] },
    { id:'camera',         name:'35mm Camera',           slot:null, category:'Entertainment', value:40, desc:'Film, 24 exposures.', where:'(electronics)', tags:['photographer','hipster'] },
    { id:'skateboard',     name:'Skateboard',            slot:null, category:'Gear', value:50, desc:'Scuffed deck, worn trucks.', where:'(skate shop)', tags:['skater'] },
    { id:'notebook',       name:'Spiral Notebook',       slot:null, category:'Misc', value:2, desc:'Lyrics and doodles in the margins.', where:'(drugstore)', tags:['emo','nerd','any'] },
    { id:'cards_mtg',      name:'Magic: The Gathering Deck', slot:null, category:'Entertainment', value:15, desc:'Sleeved and ready.', where:'(hobby shop)', tags:['nerd','geek','gamer'] },
    { id:'lipbalm',        name:'Lip Balm',              slot:null, category:'Misc', value:2, desc:'Cherry flavored.', where:'(drugstore)', tags:['any'] }
  ];

  // apply DEFAULTS so a hand-added item only NEEDS an id + name. Any field
  // you leave off gets a sensible value here; any EXTRA field you add (weight,
  // damage, heals, …) is preserved untouched for other systems to read.
  function normalizeItem(it) {
    if (!it || !it.id) { console.warn('[items] skipping an item with no id:', it); return null; }
    if (it.slot === undefined)     it.slot = null;
    if (it.category === undefined) it.category = 'Misc';
    if (it.value === undefined)    it.value = null;
    if (it.desc === undefined)     it.desc = '';
    if (it.where === undefined)    it.where = '';
    if (it.color === undefined)    it.color = '#888';
    if (it.style === undefined)    it.style = 'none';
    if (it.era === undefined)      it.era = 1;
    if (!Array.isArray(it.tags))   it.tags = it.tags ? [it.tags] : [];
    if (it.name === undefined)     it.name = it.id;
    return it;
  }
  // Normalize in place + drop any malformed entries (no id).
  for (let i = ITEMS.length - 1; i >= 0; i--) { if (!normalizeItem(ITEMS[i])) ITEMS.splice(i, 1); }
  // Warn on duplicate ids (a common hand-edit mistake) without breaking.
  { const seen = {}; ITEMS.forEach(it => { if (seen[it.id]) console.warn('[items] DUPLICATE id (later wins):', it.id); seen[it.id] = true; }); }

  const byId = {}; ITEMS.forEach(it => byId[it.id] = it);

  // Equipment slots a dressed character/NPC has, in render/display order.
  const SLOTS = ['headwear','eyewear','shirt','jacket','belt','pants','footwear','accessory'];
  const SLOT_LABELS = {
    headwear:'Headwear', eyewear:'Eyewear', shirt:'Shirt', jacket:'Jacket/Vest',
    belt:'Belt', pants:'Pants/Legs', footwear:'Footwear', accessory:'Accessory'
  };

  function itemsForSlot(slot) { return ITEMS.filter(it => it.slot === slot); }

  // ── STARTER-KIT GENERATOR ─────────────────────────────────────────────
  // Pick an era/age/clique/hobby-appropriate outfit + a little gear. `choices`
  // = { age, clique, hobbies:[], gender }. Deterministic if `seed` is passed.
  function pickByTags(slot, wantTags, rng) {
    const pool = itemsForSlot(slot);
    if (!pool.length) return null;
    // Prefer items whose tags intersect wantTags; fall back to 'any'.
    const scored = pool.map(it => {
      const t = it.tags || [];
      let s = 0;
      for (const w of wantTags) if (t.includes(w)) s += 3;
      if (t.includes('any')) s += 1;
      return { it, s: s + rng() * 0.9 };
    }).sort((a, b) => b.s - a.s);
    return scored[0].it;
  }

  function mulberry32(seed) {
    let a = (seed >>> 0) || 1;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function generateStarterKit(choices, seed) {
    choices = choices || {};
    const rng = (typeof seed === 'number') ? mulberry32(seed) : Math.random;
    const clique = (choices.clique || '').toLowerCase();
    const hobbies = (choices.hobbies || []).map(h => String(h).toLowerCase());
    const want = [clique, ...hobbies].filter(Boolean);
    if (!want.length) want.push('any');

    const equipped = {};
    // Always-present worn slots.
    equipped.shirt    = pickByTags('shirt', want, rng);
    equipped.pants    = pickByTags('pants', want, rng);
    equipped.footwear = pickByTags('footwear', want, rng);
    // Often-present.
    if (rng() < 0.7) equipped.jacket = pickByTags('jacket', want, rng);
    if (rng() < 0.7) equipped.belt   = pickByTags('belt', want, rng);
    if (rng() < 0.4) equipped.headwear = pickByTags('headwear', want, rng);
    if (rng() < 0.35) equipped.eyewear = pickByTags('eyewear', want, rng);

    // Resolve to { id, color } worn entries (color = the item's default; can be
    // overridden later). null entries dropped.
    const worn = {};
    for (const slot of Object.keys(equipped)) {
      const it = equipped[slot];
      if (it) worn[slot] = { id: it.id, color: it.color || null };
    }

    // A few pieces of pocket gear keyed off clique/hobby (the items doc's spirit).
    const pocket = [];
    const gearPool = ITEMS.filter(it => it.slot === null);
    const gearScored = gearPool.map(it => {
      const t = it.tags || []; let s = 0; for (const w of want) if (t.includes(w)) s += 3; if (t.includes('any')) s += 0.5; return { it, s: s + rng() };
    }).sort((a, b) => b.s - a.s);
    const nGear = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < nGear && i < gearScored.length; i++) pocket.push(gearScored[i].it.id);

    return { worn, pocket };
  }

  // ── NPC STAT-SHEET GENERATOR ──────────────────────────────────────────
  // Random stats (like the player) + a starter kit. `seed` makes it stable for
  // a given placed NPC. Returns { stats, age, clique, kit }.
  const STAT_KEYS = ['brawn','reflexes','grit','intelligence','savvy','charm','luck'];
  function generateNpcSheet(seed, hint) {
    const rng = (typeof seed === 'number') ? mulberry32(seed) : Math.random;
    hint = hint || {};
    const stats = {};
    // Center around 5, vary ±3, clamp 1..9 (matches the player's point-buy range).
    for (const k of STAT_KEYS) stats[k] = Math.max(1, Math.min(9, 5 + Math.round((rng() - 0.5) * 6)));
    const age = hint.age || (14 + Math.floor(rng() * 17));   // 14..30
    // Random clique unless hinted.
    const cliques = ['goth','mallrat','jock','stoner','hipster','prep','emo','lifer','nerd','geek','gamer','punk','metalhead','churchie','theater_kid'];
    const clique = hint.clique || cliques[Math.floor(rng() * cliques.length)];
    const kit = generateStarterKit({ age, clique, hobbies: hint.hobbies || [] }, (seed || 0) + 7);
    return { stats, age, clique, kit };
  }

  // Resolve a worn map { slot:{id,color} } into display rows for a sheet.
  function describeWorn(worn) {
    worn = worn || {};
    const rows = [];
    for (const slot of SLOTS) {
      const w = worn[slot];
      if (!w) continue;
      const it = byId[w.id];
      if (!it) continue;
      rows.push({ slot, label: SLOT_LABELS[slot], name: it.name, color: w.color || it.color || null, style: it.style });
    }
    return rows;
  }

  window.GameItems = {
    ITEMS, byId, SLOTS, SLOT_LABELS, COLORS: C,
    itemsForSlot, generateStarterKit, generateNpcSheet, describeWorn,
    get version() { return 1; }
  };
})();
