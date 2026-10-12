'use strict';
/* ============================== DOORS, DRAWERS & BLINDS ==============================
   Everything that opens: every kitchen cabinet door, the sink cabinet, both fridge doors, the oven, the dishwasher,
   both vanity doors, the bedroom closet, the balcony blinds, and the bedroom mini-blinds. Touch one in the room to
   open or close it. Doors swing on their hinges (or drop, or fold) over a short animation, and while a door is open
   you can see inside: shelves, pipes, racks, whatever the tenant left, and sometimes a finding (some features live
   inside cabinets and the closet, and only show up once you open them).
   Doors that belong to a feature (the fridge, sink cabinet, oven, dishwasher, closet, and balcony blinds) share that
   feature's flag with its close-up. The closed doors are part of the cached room layer; anything open or moving is
   drawn live, every frame. The left-behind rug rolls up too. */
const DOOR_TIME = .38;
const KCAB = { front: '#a8743f', inner: '#8a5a2c', box: '#2a1c10', back: '#3a2818' };
const DOORS = {
  kitchen: [
    ...[[-4.87, -4.13], [-3.92, -3.18], [-2.97, -2.23], [-2.02, -1.08], [1.68, 2.02]].map(([x0, x1], i) => ({ id: 'ku' + (i + 1), group: 'kup', name: 'Upper cabinet', kind: 'swing', hinge: i % 2 ? 'r' : 'l',
      x0, x1, y0: 2.15, y1: 3.45, z: 11.6, depth: .38, col: KCAB, inside: 'cab', walk: { x: (x0 + x1) / 2, z: 10.2 }, look: 'An upper cabinet door. Oak-look laminate, brass knob.' })),
    ...[[-4.89, -4.21], [-4.09, -3.41], [-3.29, -2.61], [1.51, 2.1]].map(([x0, x1], i) => ({ id: 'kl' + (i + 1), group: 'klow', name: 'Lower cabinet', kind: 'swing', hinge: i % 2 ? 'r' : 'l',
      x0, x1, y0: .1, y1: .62, z: 11.05, depth: .8, col: KCAB, inside: 'lowcab', walk: { x: (x0 + x1) / 2, z: 10.2 }, look: 'A lower cabinet door.' })),
    { id: 'sinkL', flag: ['sink', 'open'], name: 'Sink cabinet', kind: 'swing', hinge: 'l', x0: -.89, x1: .25, y0: .1, y1: .84, z: 11.05, depth: .8, col: KCAB, inside: 'sink', pair: 'sinkR' },   // full height: a sink cabinet has no drawers
    { id: 'sinkR', flag: ['sink', 'open'], name: 'Sink cabinet', kind: 'swing', hinge: 'r', x0: .25, x1: 1.39, y0: .1, y1: .84, z: 11.05, depth: .8, col: KCAB, inside: null },
    { id: 'freezer', group: 'freezer', name: 'Freezer door', kind: 'swing', hinge: 'l', x0: 3.6, x1: 4.27, y0: .02, y1: 2.85, z: 10.9, depth: .9, max: 1.55,
      col: { front: '#25272e', inner: '#dfe6ea', box: '#e8f0f4', back: '#cfdce2' }, inside: 'freezer', walk: { x: 3.7, z: 10.2 }, look: 'The freezer side of the fridge.' },
    { id: 'fridge', group: 'fridge', flag: ['fridge', 'open'], name: 'Fridge', kind: 'swing', hinge: 'r', x0: 4.33, x1: 5, y0: .02, y1: 2.85, z: 10.9, depth: .9, max: 1.55,
      col: { front: '#25272e', inner: '#e6ecee', box: '#f2f8fa', back: '#d8e6ea' }, inside: 'fridge' },
    { id: 'oven', group: 'oven', flag: ['stove', 'ovenOpen'], name: 'Oven', kind: 'drop', x0: 2.3, x1: 3.3, y0: .2, y1: .65, z: 11.15, depth: .7,
      col: { front: '#1c1d21', inner: '#2a2b30', box: '#0c0c0e', back: '#18181c' }, inside: 'oven' },
    { id: 'dishwasher', group: 'dishwasher', flag: ['dishwasher', 'open'], name: 'Dishwasher', kind: 'drop', x0: -2.5, x1: -1.2, y0: .02, y1: .86, z: 11.05, depth: .8,
      col: { front: '#ecebe6', inner: '#b9bcc4', box: '#26282e', back: '#1c1d22' }, inside: 'dish' }
  ],
  bath: [
    { id: 'van1', group: 'vanity', name: 'Vanity door', kind: 'swing', hinge: 'l', x0: 1.2, x1: 2.4, y0: .1, y1: .74, z: 10.2, depth: .7,
      col: { front: '#e6e3d6', inner: '#cfccbf', box: '#2a2620', back: '#3a352c' }, inside: 'vanity', walk: { x: 1.8, z: 9.3 }, look: 'The left vanity door.' },
    { id: 'van2', group: 'vanity', name: 'Vanity door', kind: 'swing', hinge: 'r', x0: 2.5, x1: 3.7, y0: .1, y1: .74, z: 10.2, depth: .7,
      col: { front: '#e6e3d6', inner: '#cfccbf', box: '#2a2620', back: '#3a352c' }, inside: 'vanity', walk: { x: 3, z: 9.3 }, look: 'The right vanity door.' }
  ],
  bedroom: [
    { id: 'closet', group: 'closet', flag: ['closet', 'open'], name: 'Closet', kind: 'bifold', x0: -5.45, x1: -2.15, y0: 0, y1: 2.85, z: 12.5, depth: .7, inside: 'closet' },
    { id: 'bblinds', name: 'Mini-blinds', kind: 'miniblinds', x0: 1.4, x1: 4.6, y0: 1, y1: 3, z: 12.47, startOpen: true, walk: { x: 3, z: 11.4 },
      look: 'Cheap aluminum mini-blinds over the bedroom window.', openLine: 'You pull the cord. The blinds rattle up.', closeLine: 'You let the blinds down. They clatter into place.' }
  ],
  living: [
    { id: 'blinds', flag: ['patio', 'blindsOpen'], name: 'Vertical blinds', kind: 'vblinds', x0: 2.7, x1: 5.5, y0: .12, y1: 2.9, z: 12.97 }
  ]
};
const DOOR = {}; for (const [room, list] of Object.entries(DOORS)) for (const d of list) { d.room = room; DOOR[d.id] = d; }

function isOpen(id) {
  const d = DOOR[id]; if (!d) return !!Game.opened[id];
  if (d.flag) return !!(Game.flags[d.flag[0]] || {})[d.flag[1]];
  return !!Game.opened[id];
}
const ease = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;

const Openables = {
  anim: {},                                   // door id -> { from, open, t }
  reset() { this.anim = {}; },
  amt(id) {
    const s = this.anim[id]; if (!s) return isOpen(id) ? 1 : 0;
    const k = clamp((Game.t - s.t) / (Settings.get('motion') ? DOOR_TIME : .01), 0, 1);
    return lerp(s.from, s.open ? 1 : 0, ease(k));
  },
  start(id, open) {
    const d = DOOR[id]; this.anim[id] = { from: this.amt(id), open, t: Game.t };
    if (d && d.pair) this.anim[d.pair] = { from: this.amt(d.pair), open, t: Game.t };
    if (d && d.flag) for (const o of Object.values(DOOR)) if (o !== d && o.flag && o.flag[0] === d.flag[0] && o.flag[1] === d.flag[1]) this.anim[o.id] = { from: this.amt(o.id), open, t: Game.t };
  },
  /* a feature's flag just changed (from the close-up or Touch in the room): animate any door that follows it */
  flagged(fid, flag, open) {
    for (const d of Object.values(DOOR)) if (d.flag && d.flag[0] === fid && d.flag[1] === flag) { this.start(d.id, open); break; }
    Game.refreshHots();
  },
  doors(room) { return DOORS[room] || []; },
  hostOf(what) { return Decor.cur && Decor.cur.inside && Decor.cur.inside[what]; },     // which door a finding or oddity hides behind
  opening(d) { return d.kind === 'lid' ? [P(d.x0, d.y1, d.z), P(d.x1, d.y1, d.z), P(d.x1, d.y1, d.z + d.depth), P(d.x0, d.y1, d.z + d.depth)] : [P(d.x0, d.y0, d.z), P(d.x1, d.y0, d.z), P(d.x1, d.y1, d.z), P(d.x0, d.y1, d.z)]; },   // a lid opens on the top face
  item(d) { const k = Decor.cur && Decor.cur.contents[d.id]; return k && !Game.taken.has('in-' + d.id) ? k : null; },
  itemSpot(d) { if (d.kind === 'lid') return { x: (d.x0 + d.x1) / 2, y: d.y1 - .32, z: d.z + d.depth * .5 }; return { x: (d.x0 + d.x1) / 2, y: d.kind === 'swing' && d.inside === 'cab' ? d.y0 + .03 : d.y0 + .04, z: d.z + d.depth * .55 }; },

  /* ---------- drawing ---------- */
  drawLive(g, r, t) {
    for (const d of this.doors(r.id)) {
      const a = this.amt(d.id);
      if (d.kind === 'vblinds') { this.vblinds(g, r, d, a, t); continue; }
      if (d.kind === 'miniblinds') { this.miniblinds(g, r, d, a); continue; }
    }
    // every open door's insides first, then the doors themselves, so one door's interior never paints over another's leaf
    const open = this.doors(r.id).filter(d => !/blinds/.test(d.kind) && this.amt(d.id) > .004);
    for (const d of open) if (d.inside !== null || !Object.values(DOOR).some(o => o.pair === d.id)) this.interior(g, r, d, this.amt(d.id));   // a pair's second door shares the first one's interior
    for (const d of open) { const a = this.amt(d.id); if (d.kind === 'swing') this.swing(g, d, a); else if (d.kind === 'drop') this.drop(g, d, a); else if (d.kind === 'bifold') this.bifold(g, d, a); else if (d.kind === 'lid') this.lid(g, d, a); }
  },
  /* the inside of a cabinet, the fridge, or the closet, seen only through its opening: from off to the side, the back wall
     and shelves would otherwise poke out past the front of the box */
  interior(g, r, d, a) { const o = d.pair ? { ...d, x1: DOOR[d.pair].x1 } : d; clipDo(g, this.opening(o), () => this.interiorRaw(g, r, d, a)); },
  interiorRaw(g, r, d, a) {
    if (d.pair) d = { ...d, x1: DOOR[d.pair].x1 };                    // a pair of doors opens onto one cabinet: its inside spans both
    const c = d.col || {}, op = this.opening(d), back = [P(d.x0, d.y0, d.z + d.depth), P(d.x1, d.y0, d.z + d.depth), P(d.x1, d.y1, d.z + d.depth), P(d.x0, d.y1, d.z + d.depth)];
    if (d.inside === 'closet') { this.closetInside(g, r, d); }
    else {
      fillPoly(g, op, c.box || '#1f1610'); fillPoly(g, back, c.back || '#2a1c10');
      const it = d.inside, mid = (y, col) => { lineW(g, P(d.x0, y, d.z + .02), P(d.x1, y, d.z + .02), col); lineW(g, P(d.x0, y, d.z + d.depth), P(d.x1, y, d.z + d.depth), col); };
      if (it === 'cab') mid((d.y0 + d.y1) / 2, '#c8a070');
      if (d.kind === 'lid') fillPoly(g, [P(d.x0, d.y0, d.z), P(d.x1, d.y0, d.z), P(d.x1, d.y0, d.z + d.depth), P(d.x0, d.y0, d.z + d.depth)], c.back || '#2a2c32');   // the floor of a chest, seen from above
      if (d.shelves) for (const y of d.shelves) mid(y, d.shelfCol || '#8a8e96');                      // a site's cabinet or locker shelves
      if (d.drawInside) d.drawInside(g, d, a);                                                        // and whatever a site keeps in there (js/sites/*)
      if (it === 'lowcab' || it === 'vanity') fillPoly(g, [P(d.x0, d.y0, d.z), P(d.x1, d.y0, d.z), P(d.x1, d.y0, d.z + d.depth), P(d.x0, d.y0, d.z + d.depth)], it === 'vanity' ? '#4a443a' : '#e6dfd0');
      if (it === 'vanity') { const x = (d.hinge === 'l' ? d.x1 : d.x0) + (d.hinge === 'l' ? -.15 : .15), p = P(x, d.y1, d.z + .35), q = P(x, d.y0 + .25, d.z + .35); pxLine(g, p[0], p[1], q[0], q[1], '#e8e8e2', 2); }
      if (it === 'fridge' || it === 'freezer') {
        for (const y of it === 'fridge' ? [.55, 1.05, 1.55, 2.05] : [.7, 1.4, 2.1]) mid(y, '#b8c4c8');
        if (it === 'fridge') { const lb = P((d.x0 + d.x1) / 2, 2.6, d.z + .3); pxRect(g, lb[0] - 2, lb[1], 4, 2, cond('fridge') === 3 ? '#c8c0a0' : '#fff8d0');
          fillPoly(g, [P(d.x0 + .05, .1, d.z), P(d.x1 - .05, .1, d.z), P(d.x1 - .05, .5, d.z), P(d.x0 + .05, .5, d.z)], cond('fridge') === 2 ? '#c8d0d0' : '#dce6e8');
          if (cond('fridge') === 2) { const p = P(d.x0 + .1, .3, d.z), q = P(d.x1 - .1, .45, d.z); pxLine(g, p[0], p[1], q[0], q[1], '#8a9090'); } }
        else speckle(g, ...(b => [b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0])(polyBox(op)), '#ffffff', 30, 4);
      }
      if (it === 'oven') for (const y of [.3, .45]) lineW(g, P(d.x0 + .05, y, d.z + .05), P(d.x1 - .05, y, d.z + .05), '#5a5e68');
      if (it === 'dish') for (const y of [.25, .55]) lineW(g, P(d.x0 + .05, y, d.z + .2), P(d.x1 - .05, y, d.z + .2), '#9aa0ab');
      if (it === 'sink') {                                   // the basins drop below the counter, with the drains and trap
        // the same plumbing as the close-up, drawn from its coordinates: close-up pixel (cx, cy) -> a point in the cabinet
        const z = d.z, M = (cx, cy, dz = .45) => P(-.89 + (cx - 34) * .01326, .86 - (cy - 64) * .01233, z + dz);
        const L = (pts, c, w = 2, dz) => { for (let k = 1; k < pts.length; k++) { const p = M(...pts[k - 1], dz), q = M(...pts[k], dz); pxLine(g, p[0], p[1], q[0], q[1], c, w); } };
        const box = (x0, y0, x1, y1, c, dz) => fillPoly(g, [M(x0, y0, dz), M(x1, y0, dz), M(x1, y1, dz), M(x0, y1, dz)], c);
        box(50, 64, 110, 82, '#8e939c', .2); box(130, 64, 190, 82, '#8e939c', .2);                                       // the basins' undersides
        box(148, 82, 172, 86, '#c9ccd4'); box(150, 86, 170, 110, '#6a6e78'); box(155, 92, 165, 98, '#c43a3a');             // the disposal under the right basin
        L([[80, 84], [80, 104]], '#e8e8e2'); L([[83, 100], [150, 100]], '#e8e8e2');                                        // left tailpiece; the disposal's outlet across to the tee
        L([[80, 104], [80, 116], [90, 122], [100, 116], [101, 106], [125, 106]], '#e8e8e2');                              // the trap
        L([[125, 106], [125, 106]], '#5a5e68', 3, .75);                                                                     // where it meets the wall
        for (const [vx, tx] of [[112, 117], [129, 123]]) { box(vx - 3, 87, vx + 3, 92, '#c9ccd4', .7); L([[vx, 88], [tx, 66]], '#9aa0ab', 1, .6); }   // shut-offs and supply lines
        box(190, 96, 200, 108, '#ece2c8', .75); L([[160, 112], [166, 120], [192, 118], [194, 104]], '#1a1a1a', 1);         // the outlet, and the disposal's cord
        if (cond('sink') === 3) fillPoly(g, [P(-.9, .1, z), P(1.4, .1, z), P(1.4, .16, z), P(-.9, .16, z)], '#3d6a8a');
      }
    }
    // findings and oddities that live behind this door
    for (const f of FEATURES) if (f.inside && this.hostOf(f.id) === d.id && a > .3) INSIDE_DRAW[f.id](g, d, cond(f.id));
    for (const an of Anomalies.inside(r.id)) if (this.hostOf(an.id) === d.id && a > .3) an.drawInside(g, d);
    const k = this.item(d);
    if (d.id === 'kl4' && a > .35) drawGasValve(g, d);                 // the range's gas shut-off lives in this cabinet
    if (k && a > .35) { const s = this.itemSpot(d), p = P(s.x, s.y, s.z), sc = clamp(8 / s.z, .8, 1.6); CLUTTER[k].draw(g, Math.round(p[0]), Math.round(p[1]), sc); }
  },
  swing(g, d, a) {
    const th = a * (d.max || 1.75), s = d.hinge === 'l' ? 1 : -1, h = d.hinge === 'l' ? d.x0 : d.x1, w = d.x1 - d.x0;
    const xe = h + s * w * Math.cos(th), ze = d.z - w * Math.sin(th);
    const pts = [P(h, d.y0, d.z), P(xe, d.y0, ze), P(xe, d.y1, ze), P(h, d.y1, d.z)];
    // which face you see, read off the screen: the door's outline winds one way while its outside faces you, and flips once you see its inside
    let area = 0; for (let i = 0; i < 4; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % 4]; area += x1 * y2 - x2 * y1; }
    const outer = area * s < 0;
    const c = d.col, big = /fridge|freezer/.test(d.id), t = big ? .14 : .035;            // the door's thickness: a fridge door is a deep box, a cabinet door a slab
    const nx = s * Math.sin(th) * t, nz = Math.cos(th) * t;                               // toward the cabinet when the door is shut
    const back = [P(h + nx, d.y0, d.z + nz), P(xe + nx, d.y0, ze + nz), P(xe + nx, d.y1, ze + nz), P(h + nx, d.y1, d.z + nz)];
    // the face turned toward you is drawn last, on its own plane: the outside of the door (pts) or its inside liner (back, which sits
    // the door's thickness toward the cabinet); the other face is behind it, and the edges join the two
    const edge = [P(xe, d.y0, ze), P(xe + nx, d.y0, ze + nz), P(xe + nx, d.y1, ze + nz), P(xe, d.y1, ze)], top = [P(h, d.y1, d.z), P(xe, d.y1, ze), P(xe + nx, d.y1, ze + nz), P(h + nx, d.y1, d.z + nz)];
    fillPoly(g, outer ? back : pts, mix(outer ? (c.inner || c.front) : c.front, '#000000', .25));
    fillPoly(g, edge, mix(c.front, '#000000', .3));                                        // the free edge
    fillPoly(g, top, mix(c.front, '#ffffff', .12));                                        // the top edge
    fillPoly(g, outer ? pts : back, outer ? c.front : (c.inner || c.front));
    strokePoly(g, outer ? pts : back, 'rgba(20,12,6,0.5)');
    if (big && !outer) for (const y of [.6, 1.25, 1.9]) {                                  // door bins, standing off the inside liner (never through the door)
      const k0 = .1, k1 = .9, a0 = [h + nx + (xe - h) * k0, d.z + nz + (ze - d.z) * k0], a1 = [h + nx + (xe - h) * k1, d.z + nz + (ze - d.z) * k1];
      fillPoly(g, [P(a0[0], y, a0[1]), P(a1[0], y, a1[1]), P(a1[0] + nx * .7, y, a1[1] + nz * .7), P(a0[0] + nx * .7, y, a0[1] + nz * .7)], '#cfdce2');
      lineW(g, P(a0[0] + nx * .7, y, a0[1] + nz * .7), P(a1[0] + nx * .7, y, a1[1] + nz * .7), '#a8b8c0');
      lineW(g, P(a0[0] + nx * .7, y + .12, a0[1] + nz * .7), P(a0[0] + nx * .7, y, a0[1] + nz * .7), '#a8b8c0');
    }
    if (outer) { const k = P(xe - s * .1 * Math.cos(th), (d.y0 + d.y1) / 2, ze + .1 * Math.sin(th)); pxRect(g, k[0] - 1, k[1] - 1, 2, 3, d.id === 'freezer' || d.id === 'fridge' ? '#c9ccd4' : '#d9c27a'); }
  },
  /* a chest lid, hinged along the back of the top: it lifts toward the back and past upright */
  lid(g, d, a) {
    const th = a * 1.95, zh = d.z + d.depth, ye = d.y1 + d.depth * Math.sin(th), ze = zh - d.depth * Math.cos(th), t = .06, c = d.col;
    const pts = [P(d.x0, d.y1, zh), P(d.x1, d.y1, zh), P(d.x1, ye, ze), P(d.x0, ye, ze)];
    fillPoly(g, [P(d.x0, ye, ze), P(d.x1, ye, ze), P(d.x1, ye + t * Math.cos(th), ze + t * Math.sin(th)), P(d.x0, ye + t * Math.cos(th), ze + t * Math.sin(th))], mix(c.front, '#000000', .3));   // the lid's front edge
    fillPoly(g, pts, th < 1.25 ? c.front : (c.inner || mix(c.front, '#000000', .25)));
    strokePoly(g, pts, 'rgba(20,12,6,0.45)');
  },
  drop(g, d, a) {
    const th = a * Math.PI / 2, hgt = d.y1 - d.y0, ye = d.y0 + hgt * Math.cos(th), ze = d.z - hgt * Math.sin(th);
    const pts = [P(d.x0, d.y0, d.z), P(d.x1, d.y0, d.z), P(d.x1, ye, ze), P(d.x0, ye, ze)], t = .07;   // a drop-down door is a few inches thick
    const ty = t * Math.sin(th), tz = t * Math.cos(th);                                                 // its thickness, below the face once it's down
    fillPoly(g, [P(d.x0, d.y0 - ty, d.z + tz), P(d.x1, d.y0 - ty, d.z + tz), P(d.x1, ye - ty, ze + tz), P(d.x0, ye - ty, ze + tz)], mix(d.col.front, '#000000', .35));
    fillPoly(g, [P(d.x0, ye, ze), P(d.x1, ye, ze), P(d.x1, ye - ty, ze + tz), P(d.x0, ye - ty, ze + tz)], mix(d.col.front, '#000000', .2));   // the front edge, the handle side
    for (const x of [d.x0, d.x1]) fillPoly(g, [P(x, d.y0, d.z), P(x, ye, ze), P(x, ye - ty, ze + tz), P(x, d.y0 - ty, d.z + tz)], mix(d.col.front, '#000000', .28));   // the sides
    fillPoly(g, pts, th < .95 ? d.col.front : d.col.inner);
    if (d.id === 'oven' && th > .6) {                                                   // the oven door's inside, face up: an enamel liner, the window, and the handle at the far edge
      const at = (u, v) => P(d.x0 + (d.x1 - d.x0) * u, d.y0 + (ye - d.y0) * v, d.z + (ze - d.z) * v);
      fillPoly(g, [at(.04, .05), at(.96, .05), at(.96, .95), at(.04, .95)], '#3c3e46');
      fillPoly(g, [at(.18, .25), at(.82, .25), at(.82, .75), at(.18, .75)], '#22242a'); fillPoly(g, [at(.22, .3), at(.5, .3), at(.4, .7), at(.22, .7)], 'rgba(160,170,190,0.18)');
      lineW(g, at(.1, 1.02), at(.9, 1.02), '#c9ccd4');
    }
    if (d.id === 'dishwasher' && th > .6) {                                             // the dishwasher door's inside: the stainless liner and the soap cup
      const at = (u, v) => P(d.x0 + (d.x1 - d.x0) * u, d.y0 + (ye - d.y0) * v, d.z + (ze - d.z) * v);
      fillPoly(g, [at(.06, .06), at(.94, .06), at(.94, .94), at(.06, .94)], '#c4c8d0'); fillPoly(g, [at(.42, .45), at(.58, .45), at(.58, .6), at(.42, .6)], '#9aa0ab');
    }          // from above you see the inside of a door once it's mostly down strokePoly(g, pts, 'rgba(10,10,10,0.5)');
    if (d.id === 'oven' && th > .6) fillPoly(g, [P(d.x0 + .1, ye + .01, ze + .08), P(d.x1 - .1, ye + .01, ze + .08), P(d.x1 - .1, d.y0 + .01, d.z - .1), P(d.x0 + .1, d.y0 + .01, d.z - .1)], '#15161a');
  },
  bifold(g, d, a) {                                         // two pairs of panels fold out toward each jamb
    const phi = a * 1.35, w2 = (d.x1 - d.x0) / 4;
    for (const side of [1, -1]) {
      const h = side > 0 ? d.x0 : d.x1, p1x = h + side * w2 * Math.cos(phi), p1z = d.z - w2 * Math.sin(phi), p2x = h + side * 2 * w2 * Math.cos(phi);
      const A = [P(h, d.y0, d.z), P(p1x, d.y0, p1z), P(p1x, d.y1, p1z), P(h, d.y1, d.z)], B = [P(p1x, d.y0, p1z), P(p2x, d.y0, d.z), P(p2x, d.y1, d.z), P(p1x, d.y1, p1z)];
      fillPoly(g, A, side > 0 ? '#e4e6e8' : '#f2f2ee'); fillPoly(g, B, side > 0 ? '#f2f2ee' : '#d8dadc');
      for (const pts of [A, B]) { strokePoly(g, pts, '#b8bcc4'); const b = polyBox(pts); for (let y = b.y0 + 4; y < b.y0 + (b.y1 - b.y0) * .45; y += 3) pxRect(g, b.x0 + 2, y, Math.max(1, b.x1 - b.x0 - 4), 1, '#c8ccd2'); }
      if (side > 0 && cond('closet') === 2) { const b = polyBox(B); fillPoly(g, blobPts(b.cx, b.y0 + (b.y1 - b.y0) * .65, Math.max(2, (b.x1 - b.x0) * .25), 3, 5, .6, 10), '#3a2a1a'); }
    }
  },
  closetInside(g, r, d) {
    const zb = d.z, deep = zb + d.depth;
    fillPoly(g, [P(d.x0, d.y0, zb), P(d.x1, d.y0, zb), P(d.x1, d.y1, zb), P(d.x0, d.y1, zb)], '#2e2a32');
    fillPoly(g, [P(d.x0, d.y0, deep), P(d.x1, d.y0, deep), P(d.x1, d.y1, deep), P(d.x0, d.y1, deep)], '#3a3640');
    fillPoly(g, [P(d.x0, d.y0, zb), P(d.x1, d.y0, zb), P(d.x1, d.y0, deep), P(d.x0, d.y0, deep)], '#4a4450');
    if (cond('closetin') !== 2) { fillPoly(g, [P(d.x0, 2.15, zb), P(d.x1, 2.15, zb), P(d.x1, 2.2, deep), P(d.x0, 2.2, deep)], '#c8c2b0'); lineW(g, P(d.x0 + .1, 1.95, zb + .35), P(d.x1 - .1, 1.95, zb + .35), '#b9bcc4');
      // the hangers: bunched here, gaps there, the way hangers end up
      for (const [i, hx] of [-5.1, -4.92, -4.3, -3.55, -3.42, -2.75].entries()) { const p = P(hx + (i % 2 ? .02 : 0), 1.95, zb + .35); pxLine(g, p[0], p[1], p[0] - 3, p[1] + 4, '#9aa0ab'); pxLine(g, p[0], p[1], p[0] + 3, p[1] + 4, '#9aa0ab'); pxLine(g, p[0] - 3, p[1] + 4, p[0] + 3, p[1] + 4, '#9aa0ab'); } }
  },
  vblinds(g, r, d, a, t = 0) {                              // vertical blinds: slats turn edge-on and stack at the left
    const n = 9, step = (d.x1 - d.x0) / n, pv = cond('patio'), zb = d.z;
    const fl = flags('fan'), fanOn = fl.spin && cond('fan') !== 2, still = !Settings.get('motion');
    const sway = still ? 0 : (.22 + (fanOn ? clamp((Game.t - fl.spin) / 2, 0, 1) * .78 : 0)) * (1 - a);   // the slats always drift a little in the air from the vents; the ceiling fan's draft swings them more
    for (let i = 0; i < n; i++) {
      const broken = pv === 2 && i >= 3 && i <= 5;
      const x = lerp(d.x0 + i * step, d.x0 - .02 + i * .045, a), w = lerp(step * .58, .045, a);
      const top = broken ? (i === 4 ? 2.1 : 2.9) : d.y0;
      if (broken && i !== 4) continue;
      const slow = fanOn ? 1 : .55, dx = sway * .045 * Math.sin(t * 1.9 * slow + i * 1.3) + sway * .02 * Math.sin(t * 3.1 * slow + i * .7);    // bottoms swing, tops stay on the track
      fillPoly(g, [P(x, top, zb), P(x + w, top, zb), P(x + w + dx, d.y1, zb), P(x + dx, d.y1, zb)], i % 2 ? '#efeadf' : '#e6e0d2');
      if (pv === 1 && (i === 2 || i === 6) && a < .5) { const p = P(x, .7, zb), q = P(x + w, .55, zb); pxLine(g, p[0], p[1], q[0], q[1], '#bdb6a4'); }
    }
    fillPoly(g, [P(d.x0 - .05, 2.9, zb), P(d.x1 + .05, 2.9, zb), P(d.x1 + .05, 2.97, zb), P(d.x0 - .05, 2.97, zb)], '#d8d2c2');
  },
  miniblinds(g, r, d, a) {                                  // horizontal mini-blinds: a = 1 is all the way up
    const down = 1 - a, yb = d.y1 - (d.y1 - d.y0) * down;
    fillPoly(g, [P(d.x0 - .08, d.y1, d.z), P(d.x1 + .08, d.y1, d.z), P(d.x1 + .08, d.y1 + .1, d.z), P(d.x0 - .08, d.y1 + .1, d.z)], '#e8e6e0');
    for (let y = d.y1 - .06; y > yb; y -= .09) { fillPoly(g, [P(d.x0, y - .06, d.z), P(d.x1, y - .06, d.z), P(d.x1, y, d.z), P(d.x0, y, d.z)], '#f2f0ea'); lineW(g, P(d.x0, y - .06, d.z), P(d.x1, y - .06, d.z), '#c8c6c0'); }
    if (down > .02) { fillPoly(g, [P(d.x0 - .02, yb - .05, d.z), P(d.x1 + .02, yb - .05, d.z), P(d.x1 + .02, yb, d.z), P(d.x0 - .02, yb, d.z)], '#d8d6d0'); }
    const c = P(d.x1 - .1, d.y1, d.z), c2 = P(d.x1 - .1, Math.max(yb - .4, d.y0 - .3), d.z); pxLine(g, c[0], c[1], c2[0], c2[1], '#d8d6d0');
    for (const an of Anomalies.inside(r.id)) if (this.hostOf(an.id) === d.id && down > .5) an.drawInside(g, d);
  },
  drawRug(g) {
    if (Decor.rugDown()) {
      const pts = floorEllipse(0, 8.8, 2.6, 1.5, 28); fillPoly(g, pts, '#7a2a2a');
      fillPoly(g, floorEllipse(0, 8.8, 2.3, 1.28, 28), '#c8a060'); fillPoly(g, floorEllipse(0, 8.8, 1.9, 1.04, 28), '#8a3a2a');
      fillPoly(g, floorEllipse(0, 8.8, 1.2, .64, 20), '#2a4a6a'); fillPoly(g, floorEllipse(0, 8.8, .5, .28, 16), '#d8b060');
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, p = P(Math.cos(a) * 1.55, 0, 8.8 + Math.sin(a) * .85); pxRect(g, p[0], p[1], 2, 1, '#d8b060'); }
    } else if (Decor.cur && Decor.cur.rug) {                       // rolled up against the right side
      const a = P(3.6, .15, 7.6), b = P(3.6, .15, 10.4);
      pxLine(g, a[0], a[1], b[0], b[1], '#5a1e1e', 5); pxLine(g, a[0], a[1] - 1, b[0], b[1] - 1, '#8a3a2a', 2);
      pxEllipse(g, a[0] + 1, a[1] + 1, 3, 3, '#c8a060'); pxEllipse(g, a[0] + 1, a[1] + 1, 1, 1, '#7a2a2a');
    }
  },

  /* ---------- hotspots ---------- */
  leafPts(d) {                                  // where an open door's leaf ends up (so you can click it to close)
    if (d.kind === 'lid') { const th = 1.95, zh = d.z + d.depth, ye = d.y1 + d.depth * Math.sin(th), ze = zh - d.depth * Math.cos(th); return hull([P(d.x0, d.y1, zh), P(d.x1, d.y1, zh), P(d.x1, ye, ze), P(d.x0, ye, ze), P(d.x0, d.y0, d.z), P(d.x1, d.y0, d.z)]); }
    if (d.kind === 'drop') { const hgt = d.y1 - d.y0; return [P(d.x0, d.y0, d.z), P(d.x1, d.y0, d.z), P(d.x1, d.y0 + .02, d.z - hgt), P(d.x0, d.y0 + .02, d.z - hgt)]; }
    const th = d.max || 1.75, s = d.hinge === 'l' ? 1 : -1, h = d.hinge === 'l' ? d.x0 : d.x1, w = d.x1 - d.x0, xe = h + s * w * Math.cos(th), ze = d.z - w * Math.sin(th);
    return hull([P(h, d.y0, d.z), P(xe, d.y0, ze), P(xe, d.y1, ze), P(h, d.y1, d.z)]);
  },
  rugData: { id: 'rug', name: 'Area rug', walk: { x: 2.8, z: 7 },
    look: 'An area rug the tenant left behind. It really ties the room together.', smell: 'Faintly of bowling alley.', talk: 'You tell the rug it really ties the room together. It knows.',
    openLine: () => cond('carpet') === 2 ? 'You roll up the rug. Underneath it: a big dark stain. Of course.' : 'You roll up the rug and lean it out of the way.', closeLine: 'You unroll the rug. The room is tied together again.' },
  hots(room) {
    const out = [];
    if (room === 'living' && Decor.cur && Decor.cur.rug)
      out.push({ kind: 'openable', id: 'rug', name: 'Area rug', walk: this.rugData.walk, data: this.rugData,
        pts: Decor.rugDown() ? floorEllipse(0, 8.8, 2.6, 1.5, 12) : hull([P(3.3, 0, 7.6), P(3.9, 0, 7.6), P(3.3, .35, 10.4), P(3.9, 0, 10.4), P(3.3, .35, 7.6)]) });
    for (const d of this.doors(room)) {
      if (!d.flag) out.push({ kind: 'openable', id: d.id, name: d.name, pts: d.kind === 'miniblinds' ? [P(d.x0, isOpen(d.id) ? 2.6 : d.y0, d.z), P(d.x1, isOpen(d.id) ? 2.6 : d.y0, d.z), P(d.x1, d.y1 + .1, d.z), P(d.x0, d.y1 + .1, d.z)] : isOpen(d.id) ? this.leafPts(d) : d.kind === 'lid' ? hull(boxPts(d.x0, d.x1, d.y0, d.y1, d.z, d.z + d.depth)) : this.opening(d), walk: d.walk || doorWalk(d), data: d });
      if (d.id === 'kl4' && isOpen(d.id)) out.push({ kind: 'scenery', id: 'gasvalve', name: 'Gas shut-off valve', pts: gasValvePts(d), walk: d.walk, data: { name: 'Gas shut-off valve', valve: true,
        look: () => `The gas line for the range, with a yellow-handled shut-off. The handle is ${Game.gasOff ? 'across the pipe: off' : 'in line with the pipe: on'}. Click it to turn it.`, smell: 'Old iron and dust.', talk: 'Lefty loosey.' } });
      const k = isOpen(d.id) && this.item(d);
      if (k) {
        const s = this.itemSpot(d), p = P(s.x, s.y, s.z), sc = clamp(8 / s.z, .8, 1.6), def = CLUTTER[k];
        out.push({ kind: 'scenery', id: 'in-' + d.id, name: def.name, pts: [[p[0] - 7 * sc, p[1] - 7 * sc], [p[0] + 7 * sc, p[1] - 7 * sc], [p[0] + 7 * sc, p[1] + 2], [p[0] - 7 * sc, p[1] + 2]],
          walk: d.walk || doorWalk(d), data: { ...def, item: k } });
      }
    }
    return out;
  },
  toggle(d) {
    if (d.id === 'rug') {
      const now = !Game.opened.rug; Game.opened.rug = now; if (now) Achievements.unlock('dude'); Audio2.synth('unscrew'); Audio2.sfx('swish', .7);
      Rooms.invalidate(Game.room); Game.refreshHots(); return now ? d.openLine() : d.closeLine;
    }
    const now = !isOpen(d.id); Game.opened[d.id] = now; this.start(d.id, now);
    Audio2.sfx(d.kind === 'miniblinds' ? 'swish' : 'click', .7); if (d.kind === 'swing' || d.kind === 'lid') Audio2.synth('creak');
    Game.refreshHots();
    if (d.openLine) return now ? d.openLine : d.closeLine;
    const inside = FEATURES.some(f => f.inside && this.hostOf(f.id) === d.id) || Anomalies.inside(d.room).some(a => this.hostOf(a.id) === d.id);
    if (now && d.id === 'kl4') return `You open the ${lower(d.name)}. A gas line runs up the back, with a yellow shut-off handle: the range's gas valve.` + (this.item(d) ? ' Something else is in there, too.' : '');
    return now ? `You open the ${lower(d.name)}.` + (this.item(d) || inside ? ' There\'s something in there.' : ' Empty.') : `You close the ${lower(d.name)}.`;
  }
};
function doorWalk(d) { return { x: clamp((d.x0 + d.x1) / 2, ROOMS[d.room].walk.x0, ROOMS[d.room].walk.x1), z: ROOMS[d.room].walk.z1 - .1 }; }

/* how each inside-a-cabinet finding looks from the room, once the door is open */
const INSIDE_DRAW = {
  ucab(g, d, v) {
    const z = d.z, mid = (d.y0 + d.y1) / 2;
    if (v === 1) for (const [x, y] of [[.3, mid + .02], [.65, d.y0 + .03]]) { const p = P(d.x0 + (d.x1 - d.x0) * x, y, z + .25); pxEllipse(g, p[0], p[1], 2, 1, '#6a4a2a'); }
    if (v === 2) { const a = P(d.x0 + .05, mid, z + .05), b = P(d.x1 - .05, mid - .15, z + .05); pxLine(g, a[0], a[1], b[0], b[1], '#c8a070', 2); }
    if (v === 3) fillPoly(g, blobPts(...P((d.x0 + d.x1) / 2, d.y1 - .1, z + .3), 6, 3, 14, .5, 12), 'rgba(90,60,20,0.6)');
  },
  lcab(g, d, v) {
    const z = d.z;
    if (v === 1) for (let i = 0; i < 4; i++) { const a = P(d.x0 + .1 + i * .12, d.y0 + .01, z + .2), b = P(d.x0 + .18 + i * .12, d.y0 + .01, z + .4); pxLine(g, a[0], a[1], b[0], b[1], '#a89a80'); }
    if (v === 2) { for (let i = 0; i < 9; i++) { const p = P(d.x0 + .08 + hash(i) * (d.x1 - d.x0 - .16), d.y0 + .01, z + .2 + hash(i + 4) * .5); pxRect(g, p[0], p[1], 1, 1, '#1a120a'); } const h = P(d.x1 - .2, d.y0 + .12, z + d.depth); pxEllipse(g, h[0], h[1], 2, 2, '#0a0806'); }
  },
  vanitycab(g, d, v) {
    const z = d.z;
    if (v === 1) strokePoly(g, blobPts(...P((d.x0 + d.x1) / 2, d.y0 + .01, z + .35), 8, 2, 7, .3, 12), 'rgba(200,190,160,0.6)');
    if (v === 2) { const p = P((d.x0 + d.x1) / 2, d.y0 + .01, z + .3); fillPoly(g, blobPts(p[0], p[1], 6, 2, 3, .5, 10), '#1a1612'); }
    if (v === 3) { fillPoly(g, blobPts(...P((d.x0 + d.x1) / 2, d.y0 + .01, z + .35), 10, 3, 9, .4, 14), 'rgba(60,100,130,0.6)'); speckle(g, ...(b => [b.x0, b.y0, b.x1 - b.x0, (b.y1 - b.y0) * .5])(polyBox(Openables.opening(d))), '#3a4a2a', 20, 6); }
  },
  closetin(g, d, v) {
    const deep = d.z + d.depth;
    if (v === 1) for (let i = 0; i < 6; i++) { const a = P(d.x0 + .3 + i * .5, 1.5 + hash(i) * .3, deep), b = P(d.x0 + .45 + i * .5, 1.48 + hash(i) * .3, deep); pxLine(g, a[0], a[1], b[0], b[1], 'rgba(30,30,40,0.6)'); }
    if (v === 2) { const a = P(d.x0 + .1, 1.95, d.z + .35), b = P(d.x0 + 1.6, .2, d.z + .35); pxLine(g, a[0], a[1], b[0], b[1], '#b9bcc4', 2); const s = P(d.x1 - .5, 2.17, deep); pxRect(g, s[0] - 6, s[1], 12, 2, '#8a8478'); }
    if (v === 3) for (let i = 0; i < 70; i++) { const p = P(d.x1 - .2 - hash(i) * 1.3, .2 + hash(i + 3) * 2.2, deep); pxRect(g, p[0], p[1], hash(i + 5) > .7 ? 2 : 1, 1, i % 3 ? '#1e2418' : '#3a4a28'); }
  }
};
