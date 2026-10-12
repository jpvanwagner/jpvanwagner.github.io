'use strict';
/* ============================== SITES ==============================
   The same inspector, Dana, and toolbox, at four kinds of property:
     residential  UNIT 204   Residential Apartments  (a move-out inspection: the original game)
     office       SUITE 204  Commercial Offices      (a lease-end walkthrough of an office suite)
     industrial   LOT 204    Industrial              (a safety inspection of a tenant's warehouse and shop)
     construction SITE 204   Construction            (a safety walk of a contractor's jobsite)
   A site is a bundle of data: its rooms, features, close-up art, left-behind things, conditions and their labels,
   briefing, SOP pages, and a few words ("tenant", "deposit"...). Picking one on the title screen swaps its data into
   the engine's tables (ROOMS, FEATURES, and the rest), so every system (the walk, the close-ups, the clipboard, the
   report) runs the same way everywhere. The apartment's tables are snapshotted when the page loads and put back when
   you pick it again, so it never changes.
   Each new site lives in its own file in js/sites/ and calls Sites.register({...}) (see SITE_DEFAULTS below for every
   field it can give). */

/* every table a site can bring; 'merge' tables keep the apartment's entries and add the site's (art and item lookups,
   keyed by unique ids), the rest are replaced outright (a site that leaves one out gets an empty one) */
const SITE_TABLES = {
  ROOMS: { t: ROOMS }, FEATURES: { t: FEATURES }, ANOMALIES: { t: ANOMALIES }, DOORS: { t: DOORS },
  CONTAINERS: { t: CONTAINERS }, HIDDEN: { t: HIDDEN }, CLUTTER_SPOTS: { t: CLUTTER_SPOTS }, GHOST_SPANS: { t: GHOST_SPANS },
  PAINTS: { t: PAINTS }, ACCENTS: { t: ACCENTS }, FLOORS: { t: FLOORS }, VIEWS: { t: VIEWS }, BIRD_SPOTS: { t: BIRD_SPOTS },
  CIRCUITS: { t: CIRCUITS }, HAZARD_FIX: { t: HAZARD_FIX }, POWERED: { t: POWERED }, WEBS: { t: WEBS }, ROOM_TOUCH: { t: ROOM_TOUCH },
  ACCEPTABLE: { t: ACCEPTABLE }, MOVIES: { t: MOVIES }, FLOOR_CLUTTER: { t: FLOOR_CLUTTER }, SURFACE_OK: { t: SURFACE_OK },
  BRIEFING: { t: BRIEFING }, CATS: { t: CATS, keep: true }, BLANK: { t: BLANK, keep: true },
  DANA_TOPICS: { t: DANA_TOPICS, keep: true }, DANA_SMALLTALK: { t: DANA_SMALLTALK, keep: true }, UNITS: { t: UNITS, keep: true },
  ZOOM_ART: { t: ZOOM_ART, merge: true }, EXTRAS: { t: EXTRAS, merge: true }, CLUTTER: { t: CLUTTER, merge: true },
  ITEM_SPRITES: { t: ITEM_SPRITES, merge: true }, INSIDE_DRAW: { t: INSIDE_DRAW, merge: true },
  BAG_TEXT: { t: BAG_TEXT, merge: true }, BAG_COMBOS: { t: BAG_COMBOS, merge: true }
};
/* tables rebuilt from others after a swap */
const SITE_DERIVED = () => {
  for (const k of Object.keys(FEATURE)) delete FEATURE[k]; for (const f of FEATURES) FEATURE[f.id] = f; for (const v of Object.values(VIEWS)) FEATURE[v.id] = v;   // views (windows, the calendar) are close-ups too
  for (const k of Object.keys(ANOMALY)) delete ANOMALY[k]; for (const a of ANOMALIES) ANOMALY[a.id] = a;
  for (const k of Object.keys(DOOR)) delete DOOR[k]; for (const [room, list] of Object.entries(DOORS)) for (const d of list) { d.room = room; DOOR[d.id] = d; }
};
const copyOf = v => Array.isArray(v) ? v.slice() : { ...v };
function fillTable(t, v) {
  if (Array.isArray(t)) { t.length = 0; t.push(...v); return; }
  for (const k of Object.keys(t)) delete t[k]; Object.assign(t, v);
}

/* what a site gives (everything here is optional except id, rooms, and features) */
const SITE_DEFAULTS = {
  place: 'Unit',                       // the word before the number: Unit 204, Suite 204, Lot 204, Site 204
  kind: 'Residential Apartments',      // the picker's subtitle
  tag: 'A Move-Out Inspection Adventure',
  form: 'MOVE-OUT INSPECTION',         // the clipboard form's header
  report: 'Move-Out Report',           // the report's title
  start: 'living',                     // the room you start in
  calls: true,                         // whether the old tenant phones about the deposit afterward
  music: 'lounge',                     // the song on the radio while you inspect (js/music.js)
  words: { tenant: 'tenant', deposit: 'deposit', damage: 'tenant damage', wear: 'normal wear and tear', where: 'unit', manager: 'Pat', promo: 'the Maple Court turnovers' },
  opener: unit => `Okay! Unit ${unit}. Walls, floors, fixtures, inside everything. Write up whatever looks off. Toolbar's up top, and hit Finish when you're done, boss.`,
  ppe: null,                           // { items: [{ id, name, look }], need: { room: [ids] } } on sites where you suit up first
  sop: 'sopPages',                     // the <template> with the SOP binder's pages
  title: null                          // (g, t) => draws the title screen's backdrop, or null for the apartment hallway
};
const SITES = {};
const Sites = {
  order: ['residential', 'office', 'industrial', 'construction'],
  cur: 'residential',
  /* the apartment, exactly as it loaded */
  snapshot() {
    const tables = {}; for (const [k, d] of Object.entries(SITE_TABLES)) tables[k] = copyOf(d.t);
    SITES.residential = { ...SITE_DEFAULTS, id: 'residential', tables, words: { ...SITE_DEFAULTS.words } };
    this.base = tables;
  },
  register(def) { SITES[def.id] = { ...SITE_DEFAULTS, ...def, words: { ...SITE_DEFAULTS.words, ...(def.words || {}) }, tables: def.tables || {} }; },
  get site() { return SITES[this.cur] || SITES.residential; },
  available() { return this.order.filter(id => SITES[id]); },
  /* swap a site's data into the engine */
  use(id) {
    if (!SITES[id]) id = 'residential';
    const s = SITES[id], base = this.base;
    for (const [k, d] of Object.entries(SITE_TABLES)) {
      const mine = s.tables[k];
      if (d.merge) fillTable(d.t, Array.isArray(base[k]) ? [...base[k], ...(mine || [])] : { ...base[k], ...(mine || {}) });
      else if (mine) fillTable(d.t, copyOf(mine));
      else fillTable(d.t, d.keep || id === 'residential' ? copyOf(base[k]) : (Array.isArray(base[k]) ? [] : {}));
    }
    SITE_DERIVED();
    if (s.tables.CLUTTER && !s.tables.FLOOR_CLUTTER) fillTable(FLOOR_CLUTTER, Object.keys(s.tables.CLUTTER).filter(k => !CLUTTER[k].multi && !CLUTTER[k].inside));   // what can be left lying around
    this.cur = id; store('unit204-site', id);
    if (typeof Music !== 'undefined') setTimeout(() => Music.render(s.music || 'lounge'), 300);   // its radio song, ready by the time you start
    if (typeof Rooms !== 'undefined') Rooms.invalidate();
    if (typeof SopBook !== 'undefined' && SopBook.use) SopBook.use('sop');   // the binder opens on this site's SOP
    this.label();
  },
  /* the site's name everywhere it shows: the title, the form, the report */
  label() {
    const s = this.site, unit = (typeof Game !== 'undefined' && Game.unit) || '204';
    document.title = `${s.place} 204`;
    const set = (sel, txt) => { for (const el of document.querySelectorAll(sel)) el.textContent = txt; };
    set('.logo', `${s.place.toUpperCase()} 204`); set('.title-inner .tag', s.tag);
    set('.site-place', s.place.toUpperCase()); set('.site-place-word', s.place); set('.site-form', s.form); set('.site-report', s.report);
    document.body.dataset.site = s.id;
  },
  /* a word that changes with the site (Sites.w('deposit')) */
  w(k) { return this.site.words[k] || SITE_DEFAULTS.words[k] || k; }
};
/* the apartment's own tables, before any other site's file (js/sites/*.js) registers */
Sites.snapshot();
