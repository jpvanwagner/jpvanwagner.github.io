'use strict';
/* ============================== ANOMALIES ==============================
   Little oddities that catch your eye but don't matter much: they aren't on the work order. Each shift puts 2 to 4
   in every room. You can Look, Touch, Smell, photograph, and mark them like anything else. Marking one correctly is
   never required, but each correct one is extra credit (see report.js). It never cancels a miss.
   cat is the right call (0 nothing to do, 1 normal wear). */
const ANOMALIES = [
  /* ---------- living room ---------- */
  { id: 'tacks', room: 'living', name: 'Thumbtack holes', cat: 1,
    pts: r => Q.left(r.box, 5.4, 6.6, 1.7, 2.3), walk: { x: -4.6, z: 6.4 },
    look: 'A loose grid of tiny thumbtack holes. A poster lived here. Maybe several.', touch: 'Tiny. Smaller than a pencil tip.', tape: 'Each one is barely a sixteenth of an inch.',
    why: 'Thumbtack holes are far smaller than a quarter inch. Normal wear.',
    draw(g, r) { for (const [z, y] of [[5.6, 2.2], [6.4, 2.2], [5.6, 1.8], [6.4, 1.8], [6, 2.15]]) { const p = P(r.box.x0, y, z); pxRect(g, p[0], p[1], 1, 1, '#5a4a3a'); } } },
  { id: 'coax', room: 'living', name: 'Loose cable wire', cat: 0,
    pts: r => { const a = P(1.5, .55, r.box.zb); return [[a[0] - 6, a[1] - 3], [a[0] + 10, a[1] - 3], [a[0] + 10, a[1] + 16], [a[0] - 6, a[1] + 16]]; }, walk: { x: 1.4, z: 11.8 },
    look: 'A coaxial cable snakes out of the wall jack and just... ends. The cable company will want it back. Or not.', touch: 'The connector is finger-tight. It was never damaged, just left.',
    why: "A loose cable line is the cable company's leftover, not damage. Nothing to do.",
    draw(g, r) { const a = P(1.38, .5, r.box.zb), b = P(1.6, 0, r.box.zb - .3), c = P(2.1, 0, r.box.zb - .6); pxLine(g, a[0], a[1], b[0], b[1], '#1d1f26'); pxLine(g, b[0], b[1], c[0], c[1], '#1d1f26'); pxRect(g, c[0], c[1] - 1, 2, 2, '#c9a227'); } },
  { id: 'fade', room: 'living', name: 'Faded carpet', cat: 1,
    pts: () => Q.floor(2.8, 5.4, 11.4, 12.8), walk: { x: 4, z: 10.8 },
    look: 'The carpet right in front of the balcony door is a shade lighter. Afternoon sun, every afternoon, for years.', touch: 'Same pile as everywhere else. Just paler.',
    why: 'Sun fading comes from daylight and time. Normal wear.',
    draw(g, r) { fillPoly(g, Q.floor(2.8, 5.4, 11.4, 12.8), 'rgba(255,248,224,0.16)'); } },
  { id: 'heights', room: 'living', name: 'Pencil marks on the door frame', cat: 0,
    pts: r => Q.left(r.box, 7.85, 8.1, .7, 2.4), walk: { x: -4.8, z: 8.2 },
    look: "Pencil lines climbing the door frame, with dates: 'M, 2004', 'M, 2006', 'M, 2008'. Someone grew up here.", touch: 'Light pencil. A damp sponge would take them off. You almost don\'t want to.',
    why: 'Light pencil marks wipe off, and the trim gets painted at turnover anyway. Nothing to charge.',
    draw(g, r) { for (const y of [1.1, 1.4, 1.75, 2.05]) { const a = P(r.box.x0, y, 7.9), b = P(r.box.x0, y, 8.08); pxLine(g, a[0], a[1], b[0], b[1], '#6a6a72'); } } },
  { id: 'strips', room: 'living', name: 'Sticky-strip marks', cat: 1,
    pts: r => Q.back(r.box, 3.2, 5, 3.3, 3.75), walk: { x: 4, z: 11.6 },
    look: 'Two faint rectangles above the balcony door where removable hanging strips held something up. The paint is a little shinier there.', touch: 'Smooth. A hint of leftover adhesive.',
    why: 'Faint adhesive marks wipe off or touch up at turnover. Normal wear.',
    draw(g, r) { for (const x of [3.4, 4.5]) fillPoly(g, Q.back(r.box, x, x + .25, 3.4, 3.62), 'rgba(255,255,255,0.18)'); } },

  /* ---------- kitchen ---------- */
  { id: 'pedro', room: 'kitchen', name: 'Bumper sticker', cat: 0,
    pts: () => [P(-2.92, 2.45, 11.6), P(-2.36, 2.45, 11.6), P(-2.36, 2.8, 11.6), P(-2.92, 2.8, 11.6)], walk: { x: -3, z: 10.2 },
    look: "A bumper sticker on a cabinet door: 'VOTE FOR PEDRO'. Bold endorsement.", touch: 'It peels up at the corner. It will come right off.', talk: 'You tell the sticker your vote is secret.',
    why: 'A sticker peels off clean. No damage, nothing to charge.',
    draw(g, r) { fillPoly(g, [P(-2.88, 2.52, 11.6), P(-2.4, 2.52, 11.6), P(-2.4, 2.72, 11.6), P(-2.88, 2.72, 11.6)], '#f4f1e8'); const p = P(-2.82, 2.66, 11.6), q = P(-2.46, 2.66, 11.6); pxLine(g, p[0], p[1], q[0], q[1], '#c43a3a'); const p2 = P(-2.78, 2.58, 11.6), q2 = P(-2.5, 2.58, 11.6); pxLine(g, p2[0], p2[1], q2[0], q2[1], '#2a4a8a'); } },
  { id: 'grease', room: 'kitchen', name: 'Greasy range hood', cat: 1,
    pts: () => hull(boxPts(2.15, 3.45, 2.3, 2.7, 11.45, 12)), walk: { x: 2.8, z: 10.2 },
    look: 'A tacky film of grease on the underside of the range hood. Years of stir-fry.', touch: 'Tacky. Your fingertip comes away shiny.', smell: 'Old cooking oil, faintly.',
    why: 'Grease on a range hood is everyday cooking. Degrease it at turnover. Normal wear.',
    draw(g, r) { fillPoly(g, [P(2.2, 2.3, 11.45), P(3.4, 2.3, 11.45), P(3.4, 2.3, 11.9), P(2.2, 2.3, 11.9)], 'rgba(150,110,40,0.35)'); } },
  { id: 'knob', room: 'kitchen', name: 'Loose cabinet knob', cat: 1,
    pts: () => { const k = P(-1.11, 2.3, 11.6); return [[k[0] - 5, k[1] - 5], [k[0] + 5, k[1] - 5], [k[0] + 5, k[1] + 6], [k[0] - 5, k[1] + 6]]; }, walk: { x: -1.2, z: 10.2 },
    look: 'One cabinet knob sits a little crooked.', touch: 'It spins in place. The screw inside has worked loose.', screwdriver: 'You tighten it from inside the door. Fixed.',
    why: 'A knob that has worked loose over the years is wear. Tighten it at turnover.',
    draw(g, r) { const k = P(-1.11, 2.3, 11.6); pxRect(g, k[0] - 1, k[1] + 1, 2, 1, '#8a6a30'); } },
  { id: 'paintedplate', room: 'kitchen', name: 'Painted-over outlet', cat: 0,
    pts: r => Q.back(r.box, -2.45, -2.2, 1, 1.32), walk: { x: -2.3, z: 10.2 },
    look: 'Somebody painted right over this outlet cover. And the screws. Not the tenant: that is a past paint crew.', touch: 'Lumpy paint drips on the plate.',
    why: 'Paint on an outlet cover is sloppy painting from a past turnover, not tenant damage. Nothing to charge.',
    draw(g, r) { fillPoly(g, Q.back(r.box, -2.4, -2.24, 1.05, 1.29), Decor.pal('kitchen').back); } },
  { id: 'oldring', room: 'kitchen', name: 'Old water ring on the ceiling', cat: 0,
    pts: r => Q.ceil(r.box, -3.6, -2.2, 8.6, 10.2), walk: { x: -2.9, z: 8.4 },
    look: 'A faint, dry brown ring on the ceiling. The edges are crisp, and it has been painted over once already: the stain is bleeding through the paint, so it predates the last turnover.', touch: 'Bone dry and hard. No give, no cool damp spot.', smell: 'Nothing. Just ceiling.', flashlight: 'No fresh staining, no soft spots. An old, dead stain.',
    why: "An old, dry stain: it's dry to the touch, and it bled through a coat of paint from before this tenant, so the leak was fixed long ago. Note it, but nothing to do.",
    draw(g, r) { strokePoly(g, blobPts(...P(-2.9, r.box.h, 9.4), 12, 4, 33, .3, 16), 'rgba(140,100,50,0.4)'); } },

  /* ---------- bathroom ---------- */
  { id: 'toothpaste', room: 'bath', name: 'Toothpaste spatter', cat: 0,
    pts: r => Q.back(r.box, 1.8, 2.8, 1.45, 1.95), walk: { x: 2.3, z: 9.2 },
    look: 'Little white specks of toothpaste all over the lower half of the mirror.', touch: 'Crusty. Wipes off with a fingernail.', smell: 'Spearmint.',
    why: 'Toothpaste wipes off. That is cleaning, not damage.',
    draw(g, r) { speckle(g, ...(b => [b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0])(polyBox(Q.back(r.box, 1.8, 2.8, 1.45, 1.95))), '#ffffff', 22, 5); } },
  { id: 'hair', room: 'bath', name: 'Hair in the drain', cat: 0,
    pts: () => { const p = P(-3.2, .58, 10.2); return [[p[0] - 6, p[1] - 4], [p[0] + 6, p[1] - 4], [p[0] + 6, p[1] + 4], [p[0] - 6, p[1] + 4]]; }, walk: { x: -2, z: 9.2 },
    look: 'A small, dark nest of hair in the tub drain. You look away. You look back. It is still there.', touch: 'Absolutely not.', smell: 'You lean in. You regret it.',
    why: 'Hair in a drain is cleaning. Nothing to charge.',
    draw(g, r) { const p = P(-3.2, .58, 10.2); pxEllipse(g, p[0], p[1], 2, 1, '#9aa0a8'); pxRect(g, p[0] - 1, p[1] - 1, 3, 1, '#2a1a10'); } },
  { id: 'decals', room: 'bath', name: 'Fish decals in the tub', cat: 0,
    pts: () => [P(-3.4, .58, 9.8), P(-1, .58, 9.8), P(-1, .58, 10.8), P(-3.4, .58, 10.8)], walk: { x: -2, z: 9 },
    look: 'Non-slip fish decals on the tub floor. A whole little school of them.', touch: 'Grippy. Peeling at one fin.',
    why: 'Non-slip decals peel off. Nothing to do.',
    draw(g, r) { for (const [x, z, c] of [[-2.8, 10.1, '#4ac0e0'], [-2.2, 10.4, '#f2a040'], [-1.6, 10.05, '#7bd36b']]) { const p = P(x, .582, z); pxRect(g, p[0] - 2, p[1], 4, 1, c); pxRect(g, p[0] + 2, p[1] - 1, 1, 3, c); } } },
  { id: 'grout', room: 'bath', name: 'Dingy grout in the corner', cat: 1,
    pts: r => Q.back(r.box, .3, .45, .55, 1.4), walk: { x: .2, z: 9 },
    look: 'The grout in the corner where the tile meets the tub wall is grayer than the rest.', touch: 'Firm and dry. Just stained.', hammer: 'Solid behind it.',
    why: 'Stained grout in a dry, solid wall is years of showers. Clean or regrout at turnover. Normal wear.',
    draw(g, r) { const a = P(.4, .6, r.box.zb), b = P(.4, 1.35, r.box.zb); pxLine(g, a[0], a[1], b[0], b[1], '#9a9688'); } },
  { id: 'crookedplate', room: 'bath', name: 'Crooked switch plate', cat: 0,
    pts: r => Q.right(r.box, 8.55, 9.5, 1.1, 1.65), walk: { x: 3, z: 8.8 },
    look: 'The double switch plate hangs a few degrees off level. It is driving you a little crazy.', touch: 'You nudge it straight. It slides back crooked.', screwdriver: 'You loosen it, level it, and snug it down. Better. Much better.',
    why: 'A crooked plate is a two-second fix, not damage. Nothing to charge.',
    draw(g, r) { const a = P(r.box.x1, 1.67, 8.6), b = P(r.box.x1, 1.6, 9.45); pxLine(g, a[0], a[1], b[0], b[1], '#a8a08c'); } },

  /* ---------- bedroom ---------- */
  { id: 'glowstars', room: 'bedroom', name: 'Glow-in-the-dark stars', cat: 0,
    pts: r => Q.ceil(r.box, 1.5, 4.5, 9.5, 11.8), walk: { x: 3, z: 8.6 },
    look: 'A constellation of plastic glow-in-the-dark stars stuck to the ceiling. Someone made a lot of wishes up there.', touch: 'Too high. Probably for the best.',
    why: 'Stick-on stars peel right off. Nothing to charge.',
    draw(g, r) { for (let i = 0; i < 9; i++) { const p = P(1.6 + hash(i + 3) * 2.8, r.box.h, 9.6 + hash(i + 9) * 2.1); pxRect(g, p[0], p[1], 2, 1, '#d8f0a0'); pxRect(g, p[0] + .5, p[1] - 1, 1, 3, '#d8f0a0'); } } },
  { id: 'classy', room: 'bedroom', name: 'Sticky note', cat: 0,
    pts: r => Q.back(r.box, -2.7, -2.35, 1.6, 1.95), walk: { x: -2.5, z: 11.4 },
    look: "A yellow sticky note on the closet door frame, in big loopy handwriting: 'STAY CLASSY.'", touch: 'It comes off clean. You stick it back. It seems important to someone.',
    why: 'A sticky note. Peel it off. Nothing to do.',
    draw(g, r) { fillPoly(g, Q.back(r.box, -2.68, -2.38, 1.62, 1.92), '#f8e070'); const a = P(-2.64, 1.8, r.box.zb), b = P(-2.42, 1.8, r.box.zb); pxLine(g, a[0], a[1], b[0], b[1], '#6a6aa0'); } },
  { id: 'tape', room: 'bedroom', name: 'Poster tape marks', cat: 1,
    pts: r => Q.left(r.box, 6.2, 7.6, 1.6, 2.8), walk: { x: -4.8, z: 7 },
    look: 'Four little yellowed squares of old tape, the corners of a poster that is long gone.', touch: 'The tape is brittle. A little paint lifts with one piece.',
    why: 'Old tape marks and a lifted fleck of paint touch up at turnover. Normal wear.',
    draw(g, r) { for (const [z, y] of [[6.3, 2.7], [7.5, 2.7], [6.3, 1.7], [7.5, 1.7]]) fillPoly(g, Q.left(r.box, z, z + .1, y, y + .08), '#e8d890'); } },
  { id: 'plugs', room: 'bedroom', name: 'Outlet safety plugs', cat: 0,
    pts: r => Q.back(r.box, 4.8, 5.15, .38, .78), walk: { x: 4.6, z: 11.4 },
    look: 'Clear plastic safety plugs in both outlet slots. Left over from someone very small.', touch: 'They pop right out. You put them back for the next family.',
    why: 'Leftover safety plugs. Pop them out. Nothing to do.',
    draw(g, r) { const c = polyBox(Q.back(r.box, 4.9, 5.06, .45, .69)); pxRect(g, c.cx - 1, c.y0 + 1, 2, 1, '#bfe8ff'); pxRect(g, c.cx - 1, c.y1 - 2, 2, 1, '#bfe8ff'); } },
  { id: 'scuffs', room: 'bedroom', name: 'Shoe scuffs on the closet doors', cat: 1,
    pts: r => Q.back(r.box, -5.45, -2.15, 0, .4), walk: { x: -3.8, z: 11.2 },
    look: 'Black shoe scuffs along the bottom of the closet doors, right where you would kick them shut.', touch: 'A magic eraser would take most of it off.',
    why: 'Scuffs at kick height are everyday use. Clean them at turnover. Normal wear.',
    draw(g, r) { for (let i = 0; i < 5; i++) { const x = -5.3 + i * .7 + hash(i) * .3, a = P(x, .12 + hash(i + 4) * .15, r.box.zb), b = P(x + .2, .14 + hash(i + 2) * .15, r.box.zb); pxLine(g, a[0], a[1], b[0], b[1], 'rgba(30,30,40,0.5)'); } } },

  /* ---------- behind doors: only there once you open (or lower) the right thing ---------- */
  { id: 'linerpaper', room: 'kitchen', name: 'Peeling shelf liner', cat: 1, inside: true,
    look: 'Old flowered contact paper on the cabinet shelf, peeling up at the corners. Very 1994.', touch: 'Brittle. It crackles.', smell: 'Old glue.',
    why: 'Aged shelf liner peels on its own. Pull it at turnover. Normal wear.',
    drawInside(g, d) { const mid = (d.y0 + d.y1) / 2; fillPoly(g, [P(d.x0 + .03, mid, d.z + .03), P(d.x1 - .03, mid, d.z + .03), P(d.x1 - .03, mid, d.z + d.depth), P(d.x0 + .03, mid, d.z + d.depth)], '#e8d8a8');
      for (let i = 0; i < 4; i++) { const p = P(d.x0 + .1 + i * (d.x1 - d.x0 - .2) / 3, mid, d.z + .2); pxRect(g, p[0], p[1] - 1, 1, 1, '#c86a8a'); } const c = P(d.x1 - .05, mid + .04, d.z + .05); pxRect(g, c[0] - 2, c[1] - 1, 2, 2, '#e8d8a8'); } },
  { id: 'phonenums', room: 'bedroom', name: 'Phone numbers in the closet', cat: 0, inside: true,
    look: "Phone numbers penciled on the inside of the closet frame. 'PIZZA', 'MOM', 'JEN (DON'T CALL)'.", touch: 'Pencil. It smudges.', talk: 'You consider calling Jen. You do not.',
    why: 'Pencil on the inside of a closet frame wipes off or gets painted at turnover. Nothing to charge.',
    drawInside(g, d) { for (let i = 0; i < 4; i++) { const a = P(d.x0 + .05, 1.6 - i * .12, d.z + .1), b = P(d.x0 + .05, 1.6 - i * .12, d.z + .4); pxLine(g, a[0], a[1], b[0], b[1], '#5a5a62'); } } },
  { id: 'bentblinds', room: 'bedroom', name: 'Bent mini-blind slats', cat: 1, inside: true,
    look: 'A few slats of the mini-blinds are bent and kinked, the way they get when a cat looks out the window every day.', touch: 'You try to straighten one. It stays kinked.',
    why: 'Kinked slats on cheap mini-blinds come from everyday use. Normal wear.',
    drawInside(g, d) { for (const [x, y] of [[2, 2.4], [2.3, 2.3], [3.6, 1.8]]) { const a = P(x, y, d.z), b = P(x + .25, y - .08, d.z); pxLine(g, a[0], a[1], b[0], b[1], '#9a988e'); } } }
];
const ANOMALY = {}; for (const a of ANOMALIES) ANOMALY[a.id] = a;
function dealAnomalies() {                 // 2 to 4 per room
  const out = [];
  for (const room of [...new Set(ANOMALIES.map(a => a.room))]) out.push(...shuffle(ANOMALIES.filter(a => a.room === room)).slice(0, 2 + Math.floor(Math.random() * 3)).map(a => a.id));
  return out;
}
const Anomalies = {
  active(room) { return (Game.anomalies || []).map(id => ANOMALY[id]).filter(a => a.room === room); },
  inside(room) { return this.active(room).filter(a => a.inside); },
  draw(g, r) { for (const a of this.active(r.id)) if (!a.inside) a.draw(g, r); },
  /* where an anomaly behind a door can be pointed at, if its door is open (or the blinds are down) */
  insidePts(a) {
    const d = DOOR[Openables.hostOf(a.id)]; if (!d) return null;
    if (d.kind === 'miniblinds') return isOpen(d.id) ? null : [P(1.9, 1.7, d.z), P(3.9, 1.7, d.z), P(3.9, 2.5, d.z), P(1.9, 2.5, d.z)];
    return isOpen(d.id) ? shrink(Openables.opening(d), .5) : null;
  },
  hots(room) {
    const r = ROOMS[room], out = [];
    for (const a of this.active(room)) {
      if (!a.inside) { out.push({ kind: 'anomaly', id: a.id, name: a.name, pts: a.pts(r), walk: a.walk, data: a }); continue; }
      const pts = this.insidePts(a), d = DOOR[Openables.hostOf(a.id)];
      if (pts) out.push({ kind: 'anomaly', id: a.id, name: a.name, pts, walk: d.walk || doorWalk(d), data: { ...a, walk: d.walk || doorWalk(d) } });
    }
    return out;
  }
};
/* what's actually true about anything you can mark: a checklist feature or an anomaly */
function truth(id) {
  if (FEATURE[id]) { const v = FEATURE[id].variants[Game.cond[id]]; return { name: FEATURE[id].name, room: FEATURE[id].room, cat: v.cat, why: v.why, cost: v.cost, key: v.key, required: Game.required.has(id) }; }
  const a = ANOMALY[id]; return { name: a.name, room: a.room, cat: a.cat, why: a.why, key: [], required: false };
}
