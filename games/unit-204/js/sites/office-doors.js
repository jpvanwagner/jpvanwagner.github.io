'use strict';
/* ============================== SUITE 204: DOORS THAT OPEN ==============================
   The break room's cabinets, sink cabinet, fridge, and freezer, run by js/openables.js like the apartment's kitchen:
   touch a door to swing it open on its hinge (with its thickness and inner liner), see inside, pick up what the
   tenant left, and touch it again to close it. The sink cabinet and the fridge share their feature's 'open' flag, so
   opening one in the close-up opens it in the room too. js/sites/office.js folds these into its tables. */
const OFD = (() => {
  const CAB = { front: '#ebe7de', inner: '#d6d2c8', box: '#3a3630', back: '#4a453c' };
  const FRIDGE = { front: '#f2f2ee', inner: '#e6ecee', box: '#f2f8fa', back: '#d8e6ea' };
  const R = (g, x, y, w, h, c) => pxRect(g, x, y, Math.max(1, w), Math.max(1, h), c);
  /* a spot inside a door's box: u across (0..1), y up, v deep (0..1) */
  const at = (d, u, y, v) => P(d.x0 + (d.x1 - d.x0) * u, y, d.z + d.depth * v);
  const uppers = [-4.15, -3.3, -2.45, -1.6, -.75, .1].map((x, i) => ({ id: 'ou' + (i + 1), group: 'o_up', name: 'Upper cabinet', kind: 'swing', hinge: i % 2 ? 'r' : 'l',
    x0: x + .06, x1: x + .79, y0: 2.18, y1: 3.42, z: 11.15, depth: .3, col: CAB, inside: 'ocab', shelves: [2.8], shelfCol: '#c8c2b4',
    walk: { x: x + .42, z: 10.2 }, look: 'An upper cabinet. Almond laminate and a little chrome pull, like every break room since 1985.' }));
  const lowers = [-4.15, -.75, .1, .95, 1.8].map((x, i) => ({ id: 'ol' + (i + 1), group: 'o_low', name: 'Base cabinet', kind: 'swing', hinge: i % 2 ? 'r' : 'l',
    x0: x + .05, x1: x + .8, y0: .1, y1: .84, z: 10.9, depth: .55, col: CAB, inside: 'ocab', shelves: [.47], shelfCol: '#c8c2b4',
    walk: { x: x + .42, z: 10.2 }, look: 'A base cabinet door under the counter.' }));
  /* under the sink: the trap and supply lines, and whatever the sink's condition puts there */
  function sinkInside(g, d) {
    const v = cond('o_sink'), dd = { ...d, x1: -.9 };
    for (const [u0, u1] of [[.22, .4], [.6, .78]]) { const a = at(dd, (u0 + u1) / 2, .84, .5), b = at(dd, (u0 + u1) / 2, .5, .5); pxLine(g, a[0], a[1], b[0], b[1], '#c9ccd4', 2); }
    { const a = at(dd, .31, .5, .5), b = at(dd, .31, .38, .5), c = at(dd, .55, .38, .5), e = at(dd, .55, .55, .85); pxLine(g, a[0], a[1], b[0], b[1], '#e8e8e2', 2); pxLine(g, b[0], b[1], c[0], c[1], '#e8e8e2', 2); pxLine(g, c[0], c[1], e[0], e[1], '#e8e8e2', 2); }   // the trap, out to the wall
    for (const u of [.42, .66]) { const p = at(dd, u, .3, .9), q = at(dd, u, .84, .7); R(g, p[0] - 1, p[1] - 2, 3, 3, '#c9ccd4'); pxLine(g, p[0], p[1] - 2, q[0], q[1], '#9aa0ab'); }   // the shut-offs and supply lines
    if (v === 2) { const b = at(dd, .78, .1, .5); R(g, b[0] - 5, b[1] - 12, 10, 12, '#d8d8d0'); R(g, b[0] - 5, b[1] - 12, 10, 2, '#c8202a'); const s = at(dd, .42, .5, .85); R(g, s[0] - 2, s[1], 4, 2, '#b8a070'); }   // the instant-hot tank, and the saddle valve
    if (v === 3) { fillPoly(g, [at(dd, 0, .11, 0), at(dd, 1, .11, 0), at(dd, 1, .11, 1), at(dd, 0, .11, 1)], 'rgba(70,110,140,0.6)'); const p = at(dd, .42, .3, .9); if (Settings.get('motion') && (Game.t * 1.5) % 1 < .5) R(g, p[0], p[1] + 2, 1, 2, '#9fc8dc'); }
    if (v === 4) { for (const [u, c] of [[.2, '#f4f2ea'], [.32, '#e8e0c0']]) { const b = at(dd, u, .1, .4); R(g, b[0] - 2, b[1] - 9, 5, 9, c); R(g, b[0] - 1, b[1] - 11, 3, 2, '#3a6ad0'); } fillPoly(g, [at(dd, .1, .11, .2), at(dd, .45, .11, .2), at(dd, .45, .11, .7), at(dd, .1, .11, .7)], 'rgba(200,210,150,0.5)'); }
  }
  /* the fridge: wire shelves, the light, a crisper, and what the tenant left (or didn't) */
  function fridgeInside(g, d) {
    const v = cond('o_fridge'), warm = v === 3;
    const lb = at(d, .5, 1.9, .3); R(g, lb[0] - 2, lb[1], 4, 2, warm ? '#c8c0a0' : '#fff8d0');
    fillPoly(g, [at(d, .05, .2, 0), at(d, .95, .2, 0), at(d, .95, .5, 0), at(d, .05, .5, 0)], '#dce6e8');           // the crisper
    if (v === 0 || v === 1) { const b = at(d, .7, .56, .7); R(g, b[0] - 3, b[1] - 5, 6, 5, '#f2a018'); R(g, b[0] - 3, b[1] - 5, 6, 1, '#2a5aa8'); }   // a box of baking soda
    if (v === 2) { for (const [u, y, c, w] of [[.2, .56, '#e8e8e0', 7], [.45, .56, '#c8202a', 6], [.75, .56, '#f4f2ea', 5], [.25, 1.06, '#d8e8d8', 8], [.6, 1.06, '#8a6a3a', 7], [.35, 1.56, '#f4f2ea', 6]]) { const b = at(d, u, y, .6); R(g, b[0] - w / 2, b[1] - 5, w, 5, c); }
      for (let i = 0; i < 10; i++) { const b = at(d, .15 + hash(i) * .7, .62 + Math.floor(hash(i + 4) * 3) * .5, .6); R(g, b[0], b[1], 1, 1, i % 2 ? '#7aa860' : '#e8f0e0'); } }
    if (warm) fillPoly(g, [at(d, 0, .02, 0), at(d, 1, .02, 0), at(d, 1, .02, .4), at(d, 0, .02, .4)], 'rgba(120,170,200,0.5)');
  }
  const DOORS = {
    o_break: [
      ...uppers, ...lowers,
      { id: 'osinkL', flag: ['o_sink', 'open'], name: 'Sink cabinet', kind: 'swing', hinge: 'l', x0: -3, x1: -1.95, y0: .1, y1: .84, z: 10.9, depth: .55, col: CAB, inside: 'osink', pair: 'osinkR', drawInside: sinkInside },
      { id: 'osinkR', flag: ['o_sink', 'open'], name: 'Sink cabinet', kind: 'swing', hinge: 'r', x0: -1.95, x1: -.9, y0: .1, y1: .84, z: 10.9, depth: .55, col: CAB, inside: null },
      { id: 'o_fridgedoor', flag: ['o_fridge', 'open'], name: 'Fridge', kind: 'swing', hinge: 'r', x0: 3.02, x1: 4.38, y0: .14, y1: 1.98, z: 10.7, depth: .65, max: 1.55, col: FRIDGE, inside: 'ofridge', shelves: [.56, 1.06, 1.56], shelfCol: '#b8c4c8', drawInside: fridgeInside },
      { id: 'o_freezer', group: 'o_freezer', name: 'Freezer door', kind: 'swing', hinge: 'r', x0: 3.02, x1: 4.38, y0: 2.02, y1: 2.72, z: 10.7, depth: .6, max: 1.55, col: FRIDGE, inside: 'ofreezer', shelves: [2.36], shelfCol: '#c8d4d8',
        drawInside: (g, d) => speckle(g, ...(b => [b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0])(polyBox(Openables.opening(d))), '#ffffff', 24, 6),
        walk: { x: 3.7, z: 10.2 }, look: 'The freezer on top of the fridge.' }
    ]
  };
  /* what can turn up behind each group of doors (null = nothing) */
  const CONTAINERS = {
    o_up: { doors: uppers.map(d => d.id), items: ['o_bossmug', null, null] },
    o_low: { doors: lowers.map(d => d.id), items: ['o_zipdisk', 'o_tps', null] },
    o_freezer: { doors: ['o_freezer'], items: [null] }
  };
  /* a plain touch on these features in the room opens them, the same as from the close-up */
  const ROOM_TOUCH = { o_fridge: 'handle', o_sink: 'cabinet', o_window: 'cord', o_panel: 'latch' };   // (the blinds go up and down from the room, too)
  return { DOORS, CONTAINERS, ROOM_TOUCH };
})();
