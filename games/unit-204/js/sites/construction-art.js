'use strict';
/* ============================== SITE 204: CONSTRUCTION ART ==============================
   The four areas of an active jobsite, all outdoors: the gate and laydown yard, the second-floor deck (with the
   scaffold along its edge), the utility trench, and the trailer yard with its temporary power. They have no walls or
   ceiling, so each paints its own sky, ground, and fences (r.shell), then its walls() put the work on top. Each room
   view reads the same condition as its close-up (cond('c_rebar')), so what you see across the yard is what you find.
   Same pixel style as the other sites: one-point perspective from P() and Q (js/util.js) and box3() (js/rooms.js).
   The sign font and a few close-up helpers are borrowed from the industrial site's INDA (read only). Everything
   here hangs off one global, CONA. The close-ups are in js/sites/construction-zoom.js. */
const CONA = (() => {
  const { txt, R, stripes } = INDA;
  const lights = () => !Decor.time.rain;
  /* where each piece of visitor PPE sits along the gate table (x), so the hotspots in construction.js match */
  const PPE_X = { hardhat: -4.05, vest: -3.5, glasses: -2.95, ears: -2.45, boots: -3.2 };

  /* ---------- where things are (shared with the data file, so a hotspot always sits on its drawing) ---------- */
  const G = {
    gate: { gate: [-1.2, 1.2], board: [-3.8, -1.6], stacks: [-6.2, -4.4, 12.8, 15.4], toilet: [10.8, 12.0], cooler: [12.2, 12.8], truck: [2.2, 5.4, 13, 15.8],
      rebar: [10.4, 13], stairs: [8.2, 9.8], chop: [2.2, 3.4, 10.6, 11.2], cutter: [1.75, 10.9], ppe: { x0: -4.4, x1: -2.0, z: 6.4, top: .9 }, toPower: [8.2, 10.4] },
    deck: { edge: 4.2, scaf: [4.3, 5.9], scafZ: [7, 15.4], tagZ: 8.2, hole: [-2.4, -1, 9, 10.4], worker: [1.4, 15.2], anchor: [2.6, 15.8], rail: [10.4, 16], stairs: [8.2, 9.8] },
    trench: { x: [-3.4, -1.4], z: [6.2, 15.6], box: [9, 13], depth: 2.8, ladder: 7.6, spoil: [-6.4, -3.8, 8, 14.4], sign: [12, 13.2], pump: [-.7, -.1, 7.0, 7.5], exc: [1, 4.8, 12.4, 15.4], locate: [.8, 3.8, 6.2, 9], door: [8.2, 10] },
    power: { trailer: [-4.4, 3.6, 14.2, 16], door: [-.6, .6], steps: [13.2, 14.2], pole: [5.6, 15.6], panel: [-6.4, -5.6, 10.6, 11.4], cut: [1.4, 4, 7.4, 8.6], silica: [-2.8, -.8, 10.4, 11.6], fuel: [-6.2, -4.8, 13.0, 14.6], doors: [8.2, 10], gang: [3.6, 5.0, 11.0, 11.8] }
  };

  /* ---------- sky, far view, and ground ---------- */
  function sky(g) {
    const T = Decor.time;
    for (let i = 0; i < 8; i++) { const y0 = Math.floor(i * CAM.hy / 8), y1 = Math.floor((i + 1) * CAM.hy / 8); R(g, 0, y0, SW, y1 - y0 + 1, mix(i < 5 ? T.sky[0] : T.sky[1], i < 5 ? T.sky[1] : T.sky[2], i < 5 ? i / 5 : (i - 5) / 3)); }
    if (!T.rain) for (let i = 0; i < 5; i++) { const cx = 30 + i * 100 + hash(i + 40) * 50, cy = 12 + hash(i + 7) * 26; pxEllipse(g, cx, cy, 18, 4, mix(T.sky[1], '#ffffff', .6)); pxEllipse(g, cx + 8, cy - 2, 10, 3, '#ffffff'); }
    else for (let i = 0; i < 6; i++) { const cx = hash(i + 3) * SW, cy = 10 + hash(i + 9) * 30; pxEllipse(g, cx, cy, 34, 7, mix(T.sky[0], '#5a6070', .3)); }
  }
  /* the town beyond the fence: a band of rooftops and trees sitting on the horizon */
  function farView(g, seed = 1, base = CAM.hy) {
    const T = Decor.time, haze = mix(T.building, T.sky[2], .55);
    for (let x = -10, i = 0; x < SW + 10; i++) { const w = 18 + hash(seed + i) * 30, h = 6 + hash(seed + i + 50) * 22; R(g, x, base - h, w - 2, h, mix(haze, '#5a6070', hash(seed + i + 9) * .25));
      for (let wy = base - h + 3; wy < base - 2; wy += 4) for (let wx = x + 3; wx < x + w - 5; wx += 5) R(g, wx, wy, 2, 2, mix(haze, '#ffffff', .25)); x += w; }
    for (let i = 0; i < 14; i++) { const cx = hash(seed + i * 3) * SW, r = 5 + hash(seed + i * 5) * 6; pxEllipse(g, cx, base - r * .6, r, r * .8, mix('#4a6a3a', T.sky[2], .35)); }
  }
  const GROUND = { dirt: { base: '#9a8262', dk: '#806a4c', lt: '#b09a78' }, gravel: { base: '#8e8a80', dk: '#76726a', lt: '#a8a49a' }, slab: { base: '#b4b2aa', dk: '#9c9a92', lt: '#c8c6be' } };
  function ground(g, r, kind) {
    const f = GROUND[kind], { x0, x1 } = r.box;
    R(g, 0, CAM.hy, SW, SH - CAM.hy, f.base);
    speckle(g, 0, CAM.hy, SW, SH - CAM.hy, rgba(f.dk, .9), 4200, 21 + r.id.length); speckle(g, 0, CAM.hy, SW, SH - CAM.hy, rgba(f.lt, .9), 2800, 33);
    if (kind === 'gravel') speckle(g, 0, CAM.hy + 20, SW, SH - CAM.hy, rgba('#5a5650', .8), 1800, 44);
    if (kind !== 'slab') {   // tire ruts, and a few puddles of color in the dirt
      for (let i = 0; i < 6; i++) { const cx = x0 + hash(i + r.id.length) * (x1 - x0), cz = 4 + hash(i + 9) * 11; fillPoly(g, floorBlob(cx, cz, 1.6, .7, i * 5 + 2, .4, 14), rgba(i % 2 ? f.lt : f.dk, .25)); }
      for (const dx of [-.7, .7]) { const pts = []; for (let z = 2; z <= 16; z += .5) pts.push(P(-1 + dx + Math.sin(z * .5) * .8, 0, z)); for (let k = 1; k < pts.length; k++) pxLine(g, pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], rgba(f.dk, .55), 2); }
    }
  }
  /* chain-link fence on any quad: posts, a top rail, and diamond mesh; screen = a green windscreen behind it */
  function mesh(g, pts, col = 'rgba(150,158,166,0.7)') {
    const b = polyBox(pts); clipDo(g, pts, () => { g.fillStyle = col; for (let y = Math.floor(b.y0); y < b.y1; y++) for (let x = Math.floor(b.x0) + (y % 2); x < b.x1; x += 4) { g.fillRect(x, y, 1, 1); } });
  }
  function fenceBack(g, r, xa, xb, h = 2.4, screen = true) {
    const zb = r.box.zb, q = Q.back(r.box, xa, xb, 0, h);
    if (screen) fillPoly(g, Q.back(r.box, xa, xb, .15, h - .2), '#2f5a3a'); mesh(g, q);
    lineW(g, P(xa, h, zb), P(xb, h, zb), '#8a9098');
    for (let x = xa; x <= xb + .01; x += 2.6) lineW(g, P(x, 0, zb), P(x, h + .05, zb), '#7a8088');
  }
  function fenceSide(g, r, side, za, zb2, h = 2.4) {
    const x = side === 'left' ? r.box.x0 : r.box.x1, q = (side === 'left' ? Q.left : Q.right)(r.box, za, zb2, 0, h);
    fillPoly(g, (side === 'left' ? Q.left : Q.right)(r.box, za, zb2, .15, h - .2), '#2a5034'); mesh(g, q);
    lineW(g, P(x, h, za), P(x, h, zb2), '#8a9098');
    for (let z = za; z <= zb2 + .01; z += 2.4) lineW(g, P(x, 0, z), P(x, h + .05, z), '#7a8088');
  }
  /* the street beyond the back fence: a sidewalk, two lanes, and the buildings across the way */
  function street(g, r) {
    const T = Decor.time, x0 = -20, x1 = 20;
    fillPoly(g, [P(x0, 0, 16), P(x1, 0, 16), P(x1, 0, 18), P(x0, 0, 18)], '#c4c0b6');
    fillPoly(g, [P(x0, 0, 18), P(x1, 0, 18), P(x1, 0, 26), P(x0, 0, 26)], '#55585e');
    for (let x = -18; x < 18; x += 3) lineW(g, P(x, 0, 22), P(x + 1.4, 0, 22), '#e8d070');
    for (let i = 0; i < 6; i++) { const xa = -16 + i * 6 + hash(i + 2) * 2, w = 3 + hash(i + 5) * 2, h = 3 + hash(i + 8) * 5, c = mix(T.building, '#8a8478', hash(i) * .5);
      fillPoly(g, [P(xa, 0, 27), P(xa + w, 0, 27), P(xa + w, h, 27), P(xa, h, 27)], c);
      for (let y = .8; y < h - .5; y += 1.1) for (let x = xa + .4; x < xa + w - .5; x += .9) fillPoly(g, [P(x, y, 27), P(x + .45, y, 27), P(x + .45, y + .6, 27), P(x, y + .6, 27)], mix(c, '#2a3040', .45)); }
  }
  function outdoor(g, r, kind, opts = {}) { sky(g); farView(g, r.id.length * 7); ground(g, r, kind); if (opts.street !== false) street(g, r); }

  /* a small sign sized to its words: a 1px dark border, a light face, the text with a pixel of margin all round.
     (x, y) is the sign's top left, or its top right when align is 'r', or its top middle when align is 'c' */
  function label(g, x, y, str, align = 'l', bg = '#f4f2ea', fg = '#1d1f26') {
    const w = String(str).length * 4 + 3, x0 = clamp(Math.round(align === 'r' ? x - w : align === 'c' ? x - w / 2 : x), 2, SW - w - 2), y0 = Math.round(y);   // never off the edge of the screen
    R(g, x0 - 1, y0 - 1, w + 2, 9, '#3a3c42'); R(g, x0, y0, w, 7, bg); txt(g, str, x0 + 2, y0 + 1, fg); return w;
  }
  /* people are drawn by js/crew.js (shared with the warehouse) */
  const person = (...a) => Crew.person(...a), drawCrew = (...a) => Crew.draw(...a), personPts = c => Crew.pts(c);

  /* ============================== THE GATE AND LAYDOWN YARD ==============================
     You came in through the gate in the back fence. The site's posted board hangs beside it; block and lumber on
     the laydown pallets in the back left corner; the toilet and water cooler on the left fence; the dump truck in
     the back right; and on the right, the building going up, its second-floor deck edge overhead, rebar sticking
     out of the footing below it, and the ladder up. The visitor PPE table is on the left, by the sign-in sheet. */
  const gate = {
    shell(g, r) { outdoor(g, r, 'dirt'); },
    walls(g, r) {
      for (const [a, b, c, d] of [[G.gate.truck[0], G.gate.truck[1], G.gate.truck[2] + .4, G.gate.truck[3]], [G.gate.stacks[0], G.gate.stacks[1] + .4, G.gate.stacks[2], G.gate.stacks[3]], [-6.5, -5.3, G.gate.toilet[0], G.gate.cooler[1]], [G.gate.ppe.x0, G.gate.ppe.x1, G.gate.ppe.z, G.gate.ppe.z + .6], [G.gate.chop[0], G.gate.chop[1], G.gate.chop[2], G.gate.chop[3]]]) AmbFX.shadow(g, a, b, c, d);   // contact shadows first
      const zb = r.box.zb, GT = G.gate, sv = cond('c_signboard'), kv = cond('c_stacks'), tv = cond('c_toilet'), rv = cond('c_rebar'), dv = cond('c_truck');
      // the back fence, with the gate in it (latched shut, or swung wide open onto the sidewalk)
      fenceBack(g, r, r.box.x0, GT.gate[0]); fenceBack(g, r, GT.gate[1], r.box.x1);
      if (sv === 3) { for (const [hx, ex] of [[GT.gate[0], GT.gate[0] + .6], [GT.gate[1], GT.gate[1] - .6]]) { const q = [P(hx, 0, zb), P(ex, 0, zb - 2.2), P(ex, 2.4, zb - 2.2), P(hx, 2.4, zb)]; mesh(g, q, 'rgba(170,176,184,0.85)'); strokePoly(g, q, '#8a9098'); }
        }
      else { const q = Q.back(r.box, GT.gate[0], GT.gate[1], 0, 2.4); mesh(g, q, 'rgba(170,176,184,0.85)'); strokePoly(g, q, '#8a9098'); const c = P(0, 1.2, zb); R(g, c[0] - 1, c[1] - 2, 3, 4, '#4a4c52'); }
      // the posted board: the site sign, the emergency numbers, and the OSHA poster
      { const [xa, xb] = GT.board, q = Q.back(r.box, xa, xb, .7, 2.3), c = polyBox(q); fillPoly(g, q, '#f4f2ea'); strokePoly(g, q, '#3a3c42');
        R(g, c.x0 + 1, c.y0 + 1, c.x1 - c.x0 - 2, 4, '#2a5aa8'); txt(g, 'SITE 204', (c.x0 + c.x1) / 2, c.y0 + 7, '#1d1f26', 1, 'c');
        if (sv !== 2) { R(g, c.x0 + 2, c.y0 + 14, 9, 10, '#f2e8c0'); R(g, c.x0 + 2, c.y0 + 14, 9, 2, '#c8202a'); R(g, c.x1 - 11, c.y0 + 14, 9, 10, '#f8f6ee'); R(g, c.x1 - 11, c.y0 + 14, 9, 2, '#2a5aa8'); }
        if (sv === 1) { g.fillStyle = 'rgba(244,242,234,0.55)'; g.fillRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0); fillPoly(g, Q.back(r.box, xa - .1, xa + .9, .7, 2.0), '#2f5a3a'); } }
      // laydown: block on pallets (tapered, stacked straight up, or leaning off its dunnage), and a lumber pile
      { const [xa, xb, za, zb2] = GT.stacks, block = { front: '#b8b6ae', top: '#cac8c0', side: '#a4a29a' };
        box3(g, xa, xb, 0, .12, za, za + 1.2, { front: '#a07a48', top: '#b08a58', side: '#8a6a3a' });
        if (kv === 3) fillPoly(g, [P(xa, .12, za), P(xb, .12, za), P(xb + .5, 1.9, za), P(xa + .5, 1.9, za)], block.front);
        else { const h = kv === 2 ? 3.2 : 1.1; box3(g, xa, xb, .12, h, za, za + 1.2, block); if (kv !== 2) box3(g, xa + .2, xb - .2, h, h + .6, za + .1, za + 1.1, block);
          for (let y = .4; y < (kv === 2 ? 3.2 : 1.7); y += .33) lineW(g, P(xa + (y > 1.1 && kv !== 2 ? .2 : 0), y, za), P(xb - (y > 1.1 && kv !== 2 ? .2 : 0), y, za), '#8a8880'); }
        box3(g, xa, xb + .4, 0, .8, za + 1.6, zb2, { front: '#c8a070', top: '#d8b484', side: '#a8844a' });
        for (let y = .2; y < .8; y += .2) lineW(g, P(xa, y, za + 1.6), P(xb + .4, y, za + 1.6), '#8a6a3a');
        if (kv === 1) fillPoly(g, [P(xa - .2, .8, za + 1.6), P(xb + .2, .8, za + 1.6), P(xb + .8, .5, za + 1.2), P(xa + .4, .4, za + 1.3)], '#3a6ad0'); }
      // the portable toilet and the water cooler on the left fence
      { const [za, zb2] = GT.toilet, x0 = r.box.x0;
        box3(g, x0, x0 + 1.1, 0, 2.9, za, zb2, { front: '#3a6ad0', side: '#2a5ab0', top: '#4a7ae0' }); box3(g, x0 - .05, x0 + 1.15, 2.9, 3.05, za - .05, zb2 + .05, { front: '#e8e8e0', side: '#d8d8d0' });
        const d = [P(x0 + 1.1, .2, za + .15), P(x0 + 1.1, .2, zb2 - .15), P(x0 + 1.1, 2.6, zb2 - .15), P(x0 + 1.1, 2.6, za + .15)]; fillPoly(g, d, tv === 2 ? '#2a4a90' : '#3a5ac0');
        const lk = P(x0 + 1.1, 1.3, za + .3); R(g, lk[0] - 1, lk[1], 2, 2, tv === 2 ? '#c8202a' : '#2a8a4a');
        const [ca, cb] = GT.cooler; box3(g, x0 + .2, x0 + .8, 0, .9, ca, cb, { front: '#8a8e96', side: '#6a6e76', top: '#a8acb4' });
        box3(g, x0 + .25, x0 + .75, .9, 1.45, ca + .05, cb - .05, { front: '#f07a1a', side: '#c85a0a', top: tv === 3 ? '#8a5a2a' : '#f8f8f0' });
        if (tv !== 3) { const p = P(x0 + .6, 1.0, ca + .05); R(g, p[0] - 1, p[1], 2, 1, '#2a2c32'); } }
      // the building going up, along the right: dark ground floor, columns, the deck edge overhead, its rail
      { const x1 = r.box.x1;
        fillPoly(g, Q.right(r.box, 1.6, zb, 0, 3.0), '#3a3c44');
        for (const z of [3.4, 7.4, 11.4, 15.4]) box3(g, x1 - .25, x1, 0, 3.0, z, z + .35, { front: '#a8a8a2', side: '#909088' });
        fillPoly(g, Q.right(r.box, 1.6, zb, 3.0, 3.35), '#c4c2ba'); lineW(g, P(x1, 3.0, 1.6), P(x1, 3.0, zb), '#7a7870');
        for (const y of [3.9, 4.45]) lineW(g, P(x1, y, 1.6), P(x1, y, zb), '#8a8e96');
        for (let z = 2.2; z < zb; z += 2.4) { lineW(g, P(x1, 3.35, z), P(x1, 4.5, z), '#6a6e76'); const f = P(x1, 4.45, z + 1.2); R(g, f[0], f[1], 2, 2, '#f07a1a'); }
        for (const z of [3.4, 7.4, 11.4, 15.4]) box3(g, x1 - .25, x1, 3.35, 5.8, z, z + .35, { front: '#9a4a3a', side: '#7a3a2a' }); }
      // rebar out of the footing under the deck edge, capped or not, with scrap lumber beside it in some cases
      { const [za, zb2] = GT.rebar, x1 = r.box.x1;
        box3(g, x1 - 1.4, x1, 0, .3, za, zb2, { front: '#a8a8a2', top: '#bcbab2', side: '#929088' });
        for (let z = za + .2, k = 0; z < zb2; z += .45, k++) for (const x of [x1 - 1.0, x1 - .4]) {
          const a = P(x, .3, z), b = P(x, 1.15, z); pxLine(g, a[0], a[1], b[0], b[1], '#8a4a2a');
          if (rv === 0 || rv === 1) R(g, b[0] - 2, b[1] - 2, 4, 3, '#f07a1a');
          else if (rv === 2) R(g, b[0] - 1, b[1] - 1, 3, 2, '#f8a040'); }
        if (rv === 0 || rv === 1) for (const x of [x1 - 1.0, x1 - .4]) lineW(g, P(x, 1.18, za + .2), P(x, 1.18, zb2 - .2), '#f07a1a');
        if (rv === 1) for (let i = 0; i < 4; i++) box3(g, x1 - 2.4 + i * .15, x1 - 1.6 + i * .1, i * .08, i * .08 + .08, za - .6 + i * .1, za - .4 + i * .1, { front: '#c8a070', top: '#d8b484' });
        if (rv === 2) { const a = P(x1 - 2.6, .05, za - .4), b = P(x1 - 1.6, .05, za - .7); pxLine(g, a[0], a[1], b[0], b[1], '#c8a070', 2); for (let k = 0; k < 3; k++) { const p = P(x1 - 2.4 + k * .3, .1, za - .5); R(g, p[0], p[1] - 2, 1, 2, '#8a8e96'); } } }
      // the stair tower up to the deck: a scaffold-frame tower standing off the building face, built in depth: base plates,
      // four posts, ledgers at each lift, X braces on its open side, two stair flights with treads and handrails, a planked
      // landing between them, and a guardrail with a toeboard around the top
      { const [za, zb2] = GT.stairs, x1 = r.box.x1 - .05, xa = x1 - 1.4, mid = (xa + x1) / 2, L1 = 1.7, L2 = 3.35, steel = '#b4b8c0', steelD = '#7a7e86', wood = '#b89060', woodD = '#8a6a3a';
        const post = (x, z, c, w = 2) => { const a = P(x, 0, z), b = P(x, L2 + 1.15, z); pxLine(g, a[0], a[1], b[0], b[1], c, w); const f = P(x, 0, z); R(g, f[0] - 2, f[1] - 1, 4, 2, '#3a3c42'); };
        const run = (p0, p1, c, w = 1) => { const a = P(...p0), b = P(...p1); pxLine(g, a[0], a[1], b[0], b[1], c, w); };
        post(x1, za, steelD); post(x1, zb2, steelD);                                                            // the far posts, against the building
        for (const y of [.1, L1, L2]) { run([x1, y, za], [x1, y, zb2], steelD); run([xa, y, zb2], [x1, y, zb2], steelD); }
        // the stair flights: up the near half from the front to the landing, then back up the far half to the top
        const flight = (x0, x1f, y0, y1, z0, z1) => { const q = [P(x0, y0, z0), P(x1f, y0, z0), P(x1f, y1, z1), P(x0, y1, z1)]; fillPoly(g, q, '#6a6e76');
          for (let k = 1; k < 8; k++) { const y = y0 + (y1 - y0) * k / 8, z = z0 + (z1 - z0) * k / 8; run([x0, y, z], [x1f, y, z], '#c8ccd4'); } };
        flight(mid + .05, x1 - .1, L1, L2, zb2 - .15, za + .15);                                                    // the upper flight, toward you
        fillPoly(g, [P(xa, L1, za), P(x1, L1, za), P(x1, L1, zb2), P(xa, L1, zb2)], woodD);                         // the landing, from above
        for (let x = xa + .2; x < x1; x += .3) run([x, L1 + .01, za], [x, L1 + .01, zb2], wood);
        flight(xa + .1, mid - .05, 0, L1, za + .15, zb2 - .15);                                                    // the lower flight, away from you
        fillPoly(g, [P(xa, L2, za), P(x1, L2, za), P(x1, L2, zb2), P(xa, L2, zb2)], '#6a5038');                     // the top landing's underside
        for (const [x0, x1f, y0, y1, z0, z1] of [[xa + .1, xa + .1, 0, L1, za + .15, zb2 - .15], [mid + .05, mid + .05, L1, L2, zb2 - .15, za + .15]]) run([x0, y0 + .9, z0], [x1f, y1 + .9, z1], '#f2c418', 2);   // handrails
        // the near posts, ledgers, and X braces on the open side
        post(xa, za, steel); post(xa, zb2, steel);
        for (const y of [.1, L1, L2]) { run([xa, y, za], [x1, y, za], steel); run([xa, y, za], [xa, y, zb2], steel); }
        for (const [y0, y1] of [[.1, L1], [L1, L2]]) { run([xa, y0, za], [xa, y1, zb2], steelD); run([xa, y0, zb2], [xa, y1, za], steelD); }
        for (const y of [L2 + .55, L2 + 1.1]) { run([xa, y, za], [xa, y, zb2], '#d8dce4'); run([xa, y, za], [x1, y, za], '#d8dce4'); }   // the top guardrail
        fillPoly(g, [P(xa, L2, za), P(xa, L2, zb2), P(xa, L2 + .15, zb2), P(xa, L2 + .15, za)], wood);                    // its toeboard
        const p = P(xa, 2.6, za); label(g, p[0] - 28, p[1] - 8, 'STAIRS'); }
      // the chop saw on a pair of sawhorses, where the crew cuts blocking (the worker at it is drawn live, with the rest of the crew)
      { const [xa, xb, za, zb2] = GT.chop; box3(g, xa, xb, .85, .95, za, zb2, { front: '#c8a070', top: '#d8b484', side: '#a8844a' });
        for (const x of [xa + .2, xb - .2]) { const a = P(x - .2, 0, za + .25), b = P(x, .85, za + .25), c = P(x + .2, 0, za + .25); pxLine(g, a[0], a[1], b[0], b[1], '#8a6a3a', 2); pxLine(g, c[0], c[1], b[0], b[1], '#8a6a3a', 2); }
        const m = P(xa + .3, .95, za + .2); R(g, m[0] - 4, m[1] - 3, 9, 3, '#3a3c42'); pxEllipse(g, m[0], m[1] - 5, 4, 4, '#b8bcc4'); R(g, m[0] - 1, m[1] - 9, 3, 3, '#d8a020');
        for (let k = 0; k < 3; k++) { const p = P(xa + .6 + k * .12, .95, za + .1 + k * .08); R(g, p[0], p[1] - 1, 8, 1, '#d8b484'); } }
      // the dump truck in the back right, its spotter, and maybe someone walking behind it
      { const [xa, xb, za, zb2] = GT.truck;
        // seen from behind: the cab roof over the dump body, the body's flared sides and its tailgate (hinged at the top, ribbed),
        // the chassis rails, dual rear wheels with mud flaps, the bumper with its lights and plate
        box3(g, xa + .5, xb - .5, 2.6, 3.4, zb2 - .8, zb2, { front: '#e8e6de', side: '#c8c6be', top: '#f4f2ea' });   // the cab, up front
        box3(g, xa, xb, 1.25, 2.95, za + .45, zb2 - .6, { front: '#f2a018', side: '#c88008', top: '#5a4a3a' });       // the dump body (its top: a load of dirt)
        const tg = [P(xa + .05, 1.3, za + .44), P(xb - .05, 1.3, za + .44), P(xb - .05, 2.9, za + .44), P(xa + .05, 2.9, za + .44)]; fillPoly(g, tg, '#e89410');
        for (let x = xa + .4; x < xb - .2; x += .45) lineW(g, P(x, 1.35, za + .43), P(x, 2.85, za + .43), '#c87a08');   // tailgate ribs
        for (const x of [xa + .15, xb - .15]) { const h = P(x, 2.9, za + .43); R(g, h[0] - 1, h[1], 3, 3, '#3a3c42'); }  // top hinges
        lineW(g, P(xa, 2.95, za + .44), P(xb, 2.95, za + .44), '#ffc040');
        box3(g, xa + .6, xb - .6, .55, 1.25, za + .5, zb2 - .6, { front: '#2a2c32', side: '#1d1f26' });             // the chassis
        for (const [x0, x1] of [[xa, xa + .9], [xb - .9, xb]]) { box3(g, x0, x1, 0, 1.05, za + .7, za + 1.6, { front: '#1d1f26', side: '#141418', top: '#2a2c32' });
          for (const x of [x0 + .22, x1 - .22]) { const c = P(x, .5, za + .69); pxEllipse(g, c[0], c[1], 2, 2, '#6a6e76'); }   // dual tires and their hubs
          const fl = [P(x0 + .05, .2, za + .6), P(x1 - .05, .2, za + .6), P(x1 - .05, .95, za + .6), P(x0 + .05, .95, za + .6)]; fillPoly(g, fl, '#2a2c32'); }   // mud flaps
        box3(g, xa + .2, xb - .2, .85, 1.0, za + .35, za + .45, { front: '#4a4c52', top: '#6a6e76' });               // the bumper
        for (const x of [xa + .3, xb - .45]) { const p = P(x, 1.05, za + .4); R(g, p[0], p[1] - 3, 4, 3, '#d82020'); }
        { const p = P((xa + xb) / 2 - .25, .88, za + .34); R(g, p[0], p[1] - 3, 7, 3, '#f4f2ea'); }
        }
      // the visitor PPE table by the sign-in sheet: plywood on two sawhorses, facing you as you come in
      { const T0 = G.gate.ppe; box3(g, T0.x0, T0.x1, T0.top - .06, T0.top, T0.z, T0.z + .6, { front: '#c8a070', top: '#d8b484', side: '#a8844a' });
        for (const x of [T0.x0 + .3, T0.x1 - .3]) { const a = P(x - .25, 0, T0.z + .3), b = P(x, T0.top - .06, T0.z + .3), c = P(x + .25, 0, T0.z + .3); pxLine(g, a[0], a[1], b[0], b[1], '#8a6a3a', 2); pxLine(g, c[0], c[1], b[0], b[1], '#8a6a3a', 2); }
        const cb = P(T0.x1 - .25, T0.top, T0.z + .3); R(g, cb[0] - 4, cb[1] - 3, 8, 4, '#8a6a3a'); R(g, cb[0] - 3, cb[1] - 3, 6, 3, '#f4f2ea');
        const sp = P(T0.x0 - .3, 0, T0.z + .3); R(g, sp[0], sp[1] - 30, 2, 30, '#6a6e76'); label(g, sp[0] + 1, sp[1] - 40, 'VISITOR PPE', 'c', '#e8f4ea', '#1a5a2a'); }
      // the opening in the left fence, out to the trailer yard
      { const [za, zb2] = G.gate.toPower; fenceSide(g, r, 'left', 1.6, za); fenceSide(g, r, 'left', zb2, r.box.zb);
        const p = P(r.box.x0, 2.0, zb2 + .2); label(g, Math.max(2, p[0] + 2), p[1], 'TRAILER'); }
    },
    /* the crew: the cutter at the chop saw (whose gear is the crew-PPE finding), a laborer carrying lumber across the
       yard, and whoever the truck's condition puts behind it; plus, on a bad day, someone from the sidewalk */
    crew() {
      const GT = G.gate, cv = cond('c_crew'), dv = cond('c_truck'), [xa, xb, za] = GT.truck, t = Game.t;
      const gear = [{ muffs: true }, { hat: 'back', vest: 'open', muffs: true }, { glasses: false, muffs: true }, { hat: false, vest: false, glasses: false, shirt: '#8a8a8a' }][cv] || {};
      const out = [{ id: 'cutter', x: GT.cutter[0], z: GT.cutter[1], o: { act: 'saw', face: 1, ...gear }, block: true }];
      const lx = -1.4 + Math.sin(t * .28) * 2.2; out.push({ id: 'laborer', x: lx, z: 12.7, o: { act: 'walk', carry: true, face: Math.cos(t * .28) > 0 ? 1 : -1, shirt: '#7a5a3a' } });
      if (dv === 0) out.push({ id: 'spotter', x: xa - .7, z: za - .2, o: { face: 1, act: 'idle' } });
      if (dv === 3) out.push({ id: 'walker', x: (xa + xb) / 2 + Math.sin(t * .5) * .6, z: za - .3, o: { act: 'walk', vest: false, glasses: false, shirt: '#8a5a3a', face: Math.cos(t * .5) > 0 ? 1 : -1 } });
      if (cond('c_signboard') === 3) out.push({ id: 'stroller', x: .2 + Math.sin(t * .3) * .5, z: 17, o: { act: 'walk', vest: false, hat: false, glasses: false, shirt: '#c85a7a', hair: '#6a3a1a', face: 1 } });
      return out;
    },
    /* the PPE on the table, until you put it on (drawn every frame so it disappears the moment you take it) */
    dynamic(g, r, t) {
      AmbFX.birds(g, t, 3); AmbFX.exhaust(g, t, P(G.gate.truck[1] - .55, 3.5, G.gate.truck[3] - .7), true);   // from the stack behind the cab
      drawCrew(g, gate.crew(), t);
      const T0 = G.gate.ppe, y = T0.top, z = T0.z + .3, at = x => P(x, y, z), X = CONA.PPE_X;
      if (!PPE.has('hardhat')) { const p = at(X.hardhat); R(g, p[0] - 5, p[1] - 4, 10, 4, '#f4f4ee'); R(g, p[0] - 4, p[1] - 7, 8, 3, '#f4f4ee'); R(g, p[0] - 6, p[1] - 1, 12, 1, '#d8d8d0'); }
      if (!PPE.has('vest')) { const p = at(X.vest); R(g, p[0] - 5, p[1] - 3, 10, 3, '#f07a1a'); R(g, p[0] - 5, p[1] - 2, 10, 1, '#f4f2dc'); }
      if (!PPE.has('glasses')) { const p = at(X.glasses); R(g, p[0] - 4, p[1] - 2, 8, 2, '#c8e0f0'); R(g, p[0] - 4, p[1] - 3, 8, 1, '#2a2c32'); }
      if (!PPE.has('ears')) { const p = at(X.ears); R(g, p[0] - 4, p[1] - 4, 3, 4, '#f2c418'); R(g, p[0] + 1, p[1] - 4, 3, 4, '#f2c418'); R(g, p[0] - 3, p[1] - 5, 6, 1, '#2a2c32'); }
      if (!PPE.has('boots')) { const p = P(X.boots, 0, T0.z - .2); R(g, p[0] - 7, p[1] - 5, 6, 5, '#6a4a2a'); R(g, p[0] + 1, p[1] - 5, 6, 5, '#6a4a2a'); }
      if (cond('c_stacks') === 1 && Settings.get('motion')) { const [xa, xb, za] = G.gate.stacks, k = Math.sin(t * 6) * .15; fillPoly(g, [P(xb + .2, .8, za + 1.6), P(xb + .9 + k, .7 + k, za + 1.3), P(xb + .7, .4, za + 1.4)], '#3a6ad0'); }
      if (cond('c_truck') === 3 && Settings.get('motion') && Math.floor(t * 2) % 2) { const p = P((G.gate.truck[0] + G.gate.truck[1]) / 2, 2.0, G.gate.truck[2] + .4); R(g, p[0] - 2, p[1], 4, 2, '#f8f8f0'); }
    }
  };

  /* ============================== THE SECOND-FLOOR DECK ==============================
     Up the ladder: a concrete deck with steel columns poking up for the next floor. The left edge has a cable
     guardrail; the back is the leading edge, where an ironworker in a harness is working; the scaffold runs along
     the right edge at deck level; and a plywood cover sits over a floor opening. The town is down there. */
  const deck = {
    shell(g, r) {
      sky(g); farView(g, 91, CAM.hy + 6);
      const T = Decor.time; R(g, 0, CAM.hy + 6, SW, SH - CAM.hy - 6, mix(T.building, '#7a8a6a', .5)); speckle(g, 0, CAM.hy + 6, SW, SH, rgba('#4a5a3a', .6), 2400, 8);
      for (let i = 0; i < 9; i++) { const x = hash(i + 4) * SW, y = CAM.hy + 12 + hash(i + 7) * 60, w = 20 + hash(i) * 40; R(g, x, y, w, 10 + hash(i + 2) * 14, mix('#8a8478', T.building, hash(i + 5))); R(g, x, y, w, 2, '#5a5650'); }
      const D = G.deck, slab = [P(r.box.x0, 0, 1.6), P(D.edge, 0, 1.6), P(D.edge, 0, r.box.zb), P(r.box.x0, 0, r.box.zb)];
      fillPoly(g, slab, GROUND.slab.base); clipDo(g, slab, () => { speckle(g, 0, CAM.hy, SW, SH, rgba(GROUND.slab.dk, .9), 3600, 3); speckle(g, 0, CAM.hy, SW, SH, rgba(GROUND.slab.lt, .9), 2400, 5);
        for (let z = 4; z < 16; z += 4) lineW(g, P(r.box.x0, 0, z), P(D.edge, 0, z), mix(GROUND.slab.base, '#3a3a36', .3)); });
      fillPoly(g, [P(r.box.x0, 0, r.box.zb), P(D.edge, 0, r.box.zb), P(D.edge, -.4, r.box.zb), P(r.box.x0, -.4, r.box.zb)], '#8a8880');
    },
    walls(g, r) {
      const D = G.deck, zb = r.box.zb, ev = cond('c_deckedge'), hv = cond('c_hole'), wv = cond('c_harness'), pv = cond('c_planks'), sv = cond('c_scafrail'), tv = cond('c_scaftag');
      // steel columns sticking up for the next floor, with their splice plates
      for (const [x, z] of [[-6.2, 4.2], [-6.2, 10], [-6.2, 15.6], [D.edge - .3, 4.2], [D.edge - .3, 10], [-1.6, 15.6], [D.anchor[0], 15.6]]) { box3(g, x - .15, x + .15, 0, 4.2, z, z + .3, { front: '#9a4a3a', side: '#7a3a2a' }); const p = P(x, 2.2, z); R(g, p[0] - 2, p[1], 4, 3, '#7a3a2a'); }
      // the floor opening and its cover
      { const [xa, xb, za, zb2] = D.hole, q = Q.floor(xa, xb, za, zb2);
        if (hv === 3) fillPoly(g, q, '#1d1f26');
        else { if (hv === 2) fillPoly(g, q, '#1d1f26'); const sh = hv === 2 ? .5 : 0, cq = Q.floor(xa - .1 + sh, xb + .1 + sh, za - .1, zb2 + .1); fillPoly(g, cq, '#c8a070'); strokePoly(g, cq, '#8a6a3a');
          if (hv !== 2) { const c = polyBox(cq); txt(g, 'HOLE', (c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2 - 2, hv === 1 ? 'rgba(200,32,42,0.35)' : '#c8202a', 1, 'c'); } } }
      // the cable guardrail along the left edge: posts, two cables, flags (or a section left open)
      { const [za, zb2] = D.rail, x = r.box.x0 + .05, top = ev === 2 ? 1.1 : 1.4, gap = ev === 3 ? [10.4, 12.8] : null;
        for (let z = za; z <= zb2; z += 2.2) { if (gap && z > gap[0] && z < gap[1]) continue; lineW(g, P(x, 0, z), P(x, top + .05, z), '#6a6e76'); }
        for (const y of [top, top / 2]) { const segs = gap ? [[za, gap[0]], [gap[1], zb2]] : [[za, zb2]];
          for (const [a, b] of segs) { const n = 8, pts = []; for (let i = 0; i <= n; i++) { const z = a + (b - a) * i / n, sag = ev === 2 && y === top ? Math.sin(i / n * Math.PI) * .25 : 0; pts.push(P(x, y - sag, z)); } for (let k = 1; k < pts.length; k++) lineW(g, pts[k - 1], pts[k], '#a8acb4'); } }
        if (gap) for (const z of gap) { const a = P(x, top, z), b = P(x + .2, .1, z + (z === gap[0] ? .5 : -.5)); pxLine(g, a[0], a[1], b[0], b[1], '#a8acb4'); }
        if (ev !== 1) for (let z = za + .6; z < zb2; z += 2.4) { if (gap && z > gap[0] && z < gap[1]) continue; const p = P(x, top, z); R(g, p[0], p[1], 2, 3, '#f07a1a'); } }
      // the stair tower's landing at the left edge (where you came up), with its gate
      { const [za, zb2] = D.stairs, x = r.box.x0; fillPoly(g, Q.left(r.box, za, zb2, -.2, 0), '#8a8e96');
        for (const z of [za, zb2]) lineW(g, P(x, -.5, z), P(x, 1.5, z), '#b4b8c0'); lineW(g, P(x, 1.5, za), P(x, 1.5, zb2), '#b4b8c0'); lineW(g, P(x, .8, za), P(x, .8, za + .4), '#f2c418');
        const p = P(x, 1.7, za); label(g, Math.max(2, p[0] + 3), p[1] - 8, 'STAIRS'); }
      // the scaffold along the right edge, in depth: frames (inner and outer posts, ledgers across) coming up from below the deck,
      // runners along both sides, X braces on the outer face, a planked platform at deck level with gaps between the boards,
      // a toeboard, a top rail and a midrail, the wall ties, and the inspection tag. Leaning out at the top, on a bad day.
      { const [xa, xb] = D.scaf, [za, zb2] = D.scafZ, out = tv === 3 ? .5 : 0, X = (x, y) => x + out * (y + 1.2) / 3.6;
        const steel = '#b4b8c0', steelD = '#7a7e86', zs = [za, (za + zb2) / 2, zb2], top = 2.2;
        const run = (x0, y0, z0, x1, y1, z1, c, w = 1) => { const a = P(X(x0, y0), y0, z0), b = P(X(x1, y1), y1, z1); pxLine(g, a[0], a[1], b[0], b[1], c, w); };
        // the far (inner, by the deck) posts and runners first
        for (const z of zs) run(xa, -1.2, z, xa, top, z, steelD, 2);
        for (const y of [0, top]) run(xa, y, za, xa, y, zb2, steelD);
        // the platform: boards along the run with gaps, a missing one on a bad day, the ends past the last ledger
        const boards = [0, 1, 2, 3], bw = (xb - xa) / 4;
        for (const k of boards) { if (pv === 2 && k === 1) continue; const x0 = xa + k * bw + .02, x1 = x0 + bw - .04, c = pv === 1 ? (k % 2 ? '#8a6a48' : '#9a7a58') : (k % 2 ? '#b08858' : '#b89060');
          fillPoly(g, [P(X(x0, 0), 0, za - .25), P(X(x1, 0), 0, za - .25), P(X(x1, 0), 0, zb2 + .25), P(X(x0, 0), 0, zb2 + .25)], c);
          fillPoly(g, [P(X(x0, 0), 0, za - .25), P(X(x1, 0), 0, za - .25), P(X(x1, -.08), -.08, za - .25), P(X(x0, -.08), -.08, za - .25)], '#7a5a34'); }   // board ends, showing their thickness
        if (pv === 1) speckPoly(g, [P(X(xa, 0), 0, za), P(X(xb, 0), 0, za), P(X(xb, 0), 0, zb2), P(X(xa, 0), 0, zb2)], 'rgba(60,40,20,0.5)', .5, 21);
        if (pv === 3) { const a = P(X(xa + .5, 0), 0, 11.5), b = P(X(xa + .9, 0), 0, 13.5); pxLine(g, a[0], a[1], b[0], b[1], '#2a1a0a'); const p = P(X(xa + .8, 0), 0, 12.4); R(g, p[0] - 3, p[1] - 6, 6, 6, '#f07a1a'); }   // a split board, and a bucket
        // ledgers across each frame, and the outer posts
        for (const z of zs) { for (const y of [0, top]) run(xa, y, z, xb, y, z, steel); run(xb, -1.2, z, xb, top, z, steel, 2); }
        // X braces on the outer face, both lifts
        for (let i = 0; i < zs.length - 1; i++) { run(xb, -1.2, zs[i], xb, 0, zs[i + 1], steelD); run(xb, 0, zs[i], xb, -1.2, zs[i + 1], steelD); run(xb, 0, zs[i], xb, top, zs[i + 1], steelD); run(xb, top, zs[i], xb, 0, zs[i + 1], steelD); }
        // the outer guardrail and toeboard (all of it, open at the end, or none at all)
        if (sv !== 3) { const end = sv === 2 ? zs[1] : zb2;
          fillPoly(g, [P(X(xb, 0), 0, za), P(X(xb, 0), 0, end), P(X(xb, .15), .15, end), P(X(xb, .15), .15, za)], '#c8a070');
          for (const y of [1.4, .7]) run(xb, y, za, xb, y, end, sv === 1 && y === 1.4 ? '#c8a030' : '#e0e4ec', 2);
          if (sv === 1) { const w = P(X(xb, 1.4), 1.4, zs[1]); R(g, w[0] - 1, w[1] - 1, 3, 3, '#a88010'); }
          if (sv !== 2) for (const y of [1.4, .7]) run(xa, y, zb2, xb, y, zb2, '#e0e4ec'); }
        if (tv !== 2) for (const z of [9.4, 13]) { const a = P(D.edge - .2, 1.6, z), b = P(X(xa, 1.6), 1.6, z); pxLine(g, a[0], a[1], b[0], b[1], '#3a3e46', 2); }   // wall ties to the columns
        const tp = P(X(xa, 1.2), 1.2, D.tagZ); R(g, tp[0] - 2, tp[1], 5, 6, tv === 1 ? '#e8e0b0' : '#2a9a4a'); R(g, tp[0] - 1, tp[1] + 2, 3, 2, '#f4f2ea'); }
      // the ironworker at the leading edge, and their lanyard (to the anchor, to a pipe, or dragging)
      { const [wx, wz] = D.worker, [ax, az] = D.anchor;
        const s = CAM.f / wz, back = P(wx, 1.45, wz);
        if (wv === 0 || wv === 1) { const a = P(ax, 1.8, az); R(g, a[0] - 2, a[1] - 1, 4, 3, '#f2c418'); pxLine(g, back[0], back[1], a[0], a[1], '#2a2c32'); }
        else if (wv === 2) { box3(g, -.4, 2.6, 0, .12, 14.4, 14.55, { front: '#8a8e96', top: '#a8acb4' }); const a = P(.4, .12, 14.4); pxLine(g, back[0], back[1], a[0], a[1], '#2a2c32'); }
        else { const a = P(wx - .6, 0, wz - .5); pxLine(g, back[0], back[1], a[0], a[1], '#2a2c32'); }
        R(g, back[0] - Math.round(.2 * s), back[1] - 1, Math.round(.4 * s), 2, '#2a2c32'); }
    },
    /* the ironworker at the leading edge, a carpenter on the scaffold (up on a bucket, some days), and a framer kneeling at the far side */
    crew() {
      const D = G.deck, hv = cond('c_harness'), pv = cond('c_planks');
      return [
        { id: 'ironworker', x: D.worker[0], z: D.worker[1], o: { act: 'reach', hat: '#f2c418', face: 1 } },
        pv === 3 ? { id: 'scaffolder', x: D.scaf[0] + .8, z: 12.4, o: { act: 'hammer', y: .45, face: -1, shirt: '#6a7a5a' } } : { id: 'scaffolder', x: D.scaf[0] + .8, z: 13.4, o: { act: 'hammer', face: -1, shirt: '#6a7a5a' } },
        { id: 'framer', x: -3.4, z: 13.2, o: { act: 'hammer', kneel: true, face: 1, shirt: '#8a4a3a', muffs: true }, block: true }
      ];
    },
    dynamic(g, r, t) {
      AmbFX.birds(g, t, 11);
      drawCrew(g, deck.crew(), t);
      if (cond('c_harness') === 3 && Settings.get('motion')) { const [wx, wz] = G.deck.worker, p = P(wx, 1.6, wz); if (Math.floor(t * 1.5) % 2) R(g, p[0] + 4, p[1] - 10, 1, 1, '#f8f8f0'); }
    }
  };

  /* ============================== THE UTILITY TRENCH ==============================
     A trench for the new water line runs from the front of the area to the back fence, left of center: we look down
     into it over the near lip, at its far wall. The trench box sits in the middle of it; spoil is piled to the left;
     the ladder is near the front; the pump sits on the right lip; the excavator works at the back; and the
     utility locate marks are painted on the ground at the front right. */
  /* ---------- the excavator, side-on: a 20-ton track hoe drawn in its own units (s px per unit at its depth), boom left ----------
     tracks with rollers, an idler, the drive sprocket, and the pads; the swing bearing; the house with its engine
     grille, counterweight, and exhaust stack; the cab with glass and its operator; the boom and its two lift
     cylinders; the stick and its cylinder; and the bucket with teeth, over the trench. Returns its outline. */
  function excavator(g, T, ev, xa, xb, outlineOnly = false) {
    const cz = (T.exc[2] + T.exc[3]) / 2, cx = (T.exc[0] + T.exc[1]) / 2 + .2, s = CAM.f / cz, [ox, oy] = P(cx, 0, cz);
    const X = v => Math.round(ox + v * s), Y = v => Math.round(oy - v * s), box = (x0, y0, x1, y1, c) => R(g, X(x0), Y(y1), Math.max(1, X(x1) - X(x0)), Math.max(1, Y(y0) - Y(y1)), c);
    const bucketX = (xa + xb) / 2 - cx, bucketY = ev === 3 ? 1.1 : 2.3, elbow = [-2.9, 3.5], pivot = [-.7, 1.55], tip = [bucketX + .25, bucketY + .6];
    const pts = [[X(-2.1), Y(0)], [X(2.1), Y(0)], [X(2.1), Y(2.5)], [X(elbow[0]), Y(elbow[1] + .3)], [X(tip[0] - .6), Y(tip[1])], [X(tip[0] - .6), Y(bucketY - .5)], [X(-2.1), Y(.2)]];
    if (outlineOnly) return pts;
    const thick = (a, b, w, c) => pxLine(g, X(a[0]), Y(a[1]), X(b[0]), Y(b[1]), c, Math.max(1, Math.round(w * s)));
    // tracks: a long rounded belt of pads around an idler, rollers, and the toothed drive sprocket
    const YL = '#f2c418', YD = '#c89a08', YLL = '#ffe060', K = '#2a2c32', K2 = '#3e4048';
    box(-1.75, 0, 1.75, .75, K); pxEllipse(g, X(-1.75), Y(.375), Math.round(.38 * s), Math.round(.38 * s), K); pxEllipse(g, X(1.75), Y(.375), Math.round(.38 * s), Math.round(.38 * s), K);
    for (let v = -1.9; v < 1.95; v += .22) { R(g, X(v), Y(.75), 1, Math.max(1, Math.round(.08 * s)), K2); R(g, X(v), Y(.06), 1, Math.max(1, Math.round(.06 * s)), K2); }   // track pads, top and bottom
    box(-1.6, .2, 1.6, .55, '#4a4c54');
    for (const v of [-1.1, -.5, .1, .7]) pxEllipse(g, X(v), Y(.24), Math.max(1, Math.round(.14 * s)), Math.max(1, Math.round(.14 * s)), '#6a6e76');   // bottom rollers
    pxEllipse(g, X(-1.72), Y(.375), Math.round(.27 * s), Math.round(.27 * s), '#5a5e66'); pxEllipse(g, X(-1.72), Y(.375), Math.max(1, Math.round(.1 * s)), Math.max(1, Math.round(.1 * s)), '#8a8e96');   // idler
    pxEllipse(g, X(1.72), Y(.375), Math.round(.3 * s), Math.round(.3 * s), '#4a4c54'); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; R(g, X(1.72 + Math.cos(a) * .3), Y(.375 + Math.sin(a) * .3), 1, 1, '#8a8e96'); }   // drive sprocket and its teeth
    box(-.5, .75, .5, .95, '#3a3c42');                                                             // the swing bearing
    // the house: engine deck, grille, counterweight at the back, the exhaust stack
    box(-1.5, .95, 1.75, 1.95, YL); box(-1.5, .95, 1.75, 1.08, YD); box(.4, 1.95, 1.75, 2.05, YD);
    for (let v = .5; v < 1.3; v += .15) R(g, X(v), Y(1.85), 1, Math.max(1, Math.round(.6 * s)), YD);   // engine grille
    box(1.15, .95, 2.05, 1.85, '#d8aa0a'); box(1.15, 1.75, 2.05, 1.85, YLL); R(g, X(2.0), Y(1.85), 1, Math.round(.9 * s), '#a87a08');   // the counterweight
    box(1.0, 2.05, 1.08, 2.55, '#3a3c42');                                                       // exhaust stack
    box(-1.3, 1.95, 1.0, 2.0, YLL);
    // the cab: frame, tinted glass with a glint, and the operator in a hard hat
    box(-1.55, .95, -.35, 2.85, YD); box(-1.48, 1.35, -.42, 2.75, '#3a5a72'); box(-1.48, 1.35, -.95, 2.75, '#4a6a84');
    { const hx = X(-.85), hy = Y(2.2); R(g, hx - 2, hy - 3, 5, 5, '#c8946a'); R(g, hx - 3, hy - 5, 7, 3, '#f4f4ee'); R(g, hx - 3, hy + 2, 7, 5, '#f07a1a'); }   // the operator
    pxLine(g, X(-1.4), Y(2.65), X(-1.05), Y(1.5), '#9ac8e0'); box(-1.55, 2.82, -.35, 2.9, YLL);
    // the boom, two lift cylinders under it, and the hoses along its back
    thick(pivot, elbow, .42, YD); thick([pivot[0], pivot[1] + .08], [elbow[0], elbow[1] + .08], .3, YL); thick([pivot[0] + .1, pivot[1] + .2], [elbow[0] + .1, elbow[1] + .25], .06, YLL);
    thick([-.35, 1.2], [-1.75, 2.75], .14, '#3a3c42'); thick([-1.05, 1.95], [-1.75, 2.75], .08, '#d8dce4');   // lift cylinder: barrel and chrome rod
    thick([pivot[0], pivot[1] + .3], [elbow[0] + .2, elbow[1] + .35], .04, K);
    // the stick down to the bucket, its cylinder on top
    thick(elbow, tip, .3, YD); thick([elbow[0] + .05, elbow[1] + .05], [tip[0] + .05, tip[1] + .05], .18, YL);
    thick([elbow[0] + .5, elbow[1] + .55], [elbow[0] - .1, elbow[1] + .45], .1, '#3a3c42'); pxEllipse(g, X(elbow[0]), Y(elbow[1]), Math.max(1, Math.round(.14 * s)), Math.max(1, Math.round(.14 * s)), '#8a8e96');
    // the bucket: a curled scoop, teeth along its lip
    { const bx = tip[0], by = bucketY; box(bx - .55, by - .35, bx + .3, by + .55, '#4a4c52'); box(bx - .55, by - .35, bx - .35, by + .45, '#3a3c42'); box(bx - .2, by + .4, bx + .3, by + .65, YD);
      for (let k = 0; k < 4; k++) R(g, X(bx - .5 + k * .22), Y(by - .35), Math.max(1, Math.round(.08 * s)), Math.max(2, Math.round(.15 * s)), '#a8acb4');
      if (ev === 3) box(bx - .5, by - .2, bx + .25, by + .3, '#3a6ad0'); }   // a length of pipe hanging in it
    return pts;
  }
  const trench = {
    shell(g, r) { outdoor(g, r, 'dirt'); },
    walls(g, r) {
      AmbFX.shadow(g, G.trench.exc[0], G.trench.exc[1], G.trench.exc[2], G.trench.exc[3], 1.3); AmbFX.shadow(g, G.trench.pump[0], G.trench.pump[1], G.trench.pump[2], G.trench.pump[3]);
      const T = G.trench, zb = r.box.zb, [xa, xb] = T.x, [za, zb2] = T.z, d = T.depth, bv = cond('c_trenchbox'), sv = cond('c_spoil'), lv = cond('c_trladder'), wv = cond('c_water'), ev = cond('c_excavator'), lc = cond('c_locate');
      fenceBack(g, r, r.box.x0, r.box.x1); fenceSide(g, r, 'left', 1.6, r.box.zb); fenceSide(g, r, 'right', 1.6, T.door[0]); fenceSide(g, r, 'right', T.door[1], r.box.zb);
      { const p = P(r.box.x1, 2.0, T.door[0] - .2); label(g, Math.min(SW - 2, p[0] - 2), p[1], 'TRAILER', 'r'); }
      { const q = Q.right(r.box, T.sign[0], T.sign[1], 1.0, 1.8), c = polyBox(q); fillPoly(g, q, '#f4f2ea'); strokePoly(g, q, '#3a3c42'); R(g, c.x0 + 1, c.y0 + 1, c.x1 - c.x0 - 2, 3, '#2a5aa8'); txt(g, '811', (c.x0 + c.x1) / 2, c.y0 + 6, '#c8202a', 1, 'c'); }
      // the cut: the ground opening, its far wall going down, and the floor at the bottom (wet, maybe)
      const cut = Q.floor(xa, xb, za, zb2);
      clipDo(g, cut, () => {
        fillPoly(g, cut, '#4a3a28');
        fillPoly(g, [P(xa, 0, za), P(xa, 0, zb2), P(xa, -d, zb2), P(xa, -d, za)], '#6a5038'); speckPoly(g, [P(xa, 0, za), P(xa, 0, zb2), P(xa, -d, zb2), P(xa, -d, za)], 'rgba(40,30,20,0.4)', .3, 12);
        for (let y = -.5; y > -d; y -= .55) lineW(g, P(xa, y, za), P(xa, y, zb2), 'rgba(40,28,18,0.35)');
        fillPoly(g, [P(xa, -d, za), P(xb, -d, za), P(xb, -d, zb2), P(xa, -d, zb2)], wv === 2 ? '#5a7a8a' : '#3a2c1e');
        if (wv === 1) fillPoly(g, [P(xa, -d, zb2 - 1.6), P(xb, -d, zb2 - 1.6), P(xb, -d, zb2), P(xa, -d, zb2)], '#5a7a8a');
        if (bv === 1) for (let i = 0; i < 6; i++) { const p = P(xa + .1 + hash(i) * .3, -d + .05, za + 2 + i * 1.2); R(g, p[0], p[1] - 1, 2, 1, '#8a6a48'); }
        // the trench box: steel panels on both walls, spreader pipes across
        if (bv !== 3) { const [ba, bb] = T.box, lift = bv === 2 ? .9 : .3;
          fillPoly(g, [P(xa + .05, -d + lift, ba), P(xa + .05, -d + lift, bb), P(xa + .05, .3, bb), P(xa + .05, .3, ba)], '#7a8088');
          for (let z = ba + .5; z < bb; z += .8) lineW(g, P(xa + .05, -d + lift, z), P(xa + .05, .3, z), '#5a6068');
          for (const z of [ba + .4, bb - .4]) for (const y of [-.7, -1.9]) lineW(g, P(xa, y, z), P(xb, y, z), '#c8a030'); }
        // the worker: inside the box, beyond its end, or in the bare trench
        // the struck gas line, crossing the trench near the front
        if (lc === 3) { lineW(g, P(xa, -1.2, 8.6), P(xb, -1.2, 8.6), '#f2c418'); lineW(g, P(xa, -1.25, 8.6), P(xb, -1.25, 8.6), '#c89a08'); }
      });
      fillPoly(g, [P(xb, 0, za), P(xb, 0, zb2), P(xb + .25, .03, zb2), P(xb + .25, .03, za)], '#7a6040'); lineW(g, P(xa, 0, za), P(xa, 0, zb2), '#b09a78'); lineW(g, P(xa, 0, zb2), P(xb, 0, zb2), '#b09a78');
      // the spoil pile on the left: well back, or crowding the edge with pipe sections beside it
      { const [s0, s1, s2, s3] = T.spoil, toe = sv === 2 ? xa - .05 : xa - 1.2, mid = (toe + s0) / 2;
        // a long mound of clay, rounded at both ends: its trench-facing slope lit, the far slope in shade
        const N = 14, zs = Array.from({ length: N + 1 }, (_, i) => s2 + (s3 - s2) * i / N), top = z => Math.sqrt(Math.max(0, Math.sin(Math.PI * (z - s2) / (s3 - s2)))) * (1.5 + Math.sin(z * 2.1) * .12);
        const ridge = zs.map(z => P(mid + Math.sin(z * 1.3) * .15, top(z), z));
        fillPoly(g, [...zs.map(z => P(s0, 0, z)), ...ridge.slice().reverse()], '#6e5034');
        fillPoly(g, [...zs.map(z => P(toe, 0, z)), ...ridge.slice().reverse()], '#9a7a52');
        speckPoly(g, [...zs.map(z => P(toe, 0, z)), ...ridge.slice().reverse()], 'rgba(60,44,28,0.45)', .35, 77);
        for (let k = 1; k < ridge.length; k++) lineW(g, ridge[k - 1], ridge[k], '#b09468');
        const pts = [P(s0, 0, s2), P(toe, 0, s2), P(toe, 0, s3), P(s0, 0, s3)];
        if (sv === 2) for (const z of [9, 10.2]) { const a = P(xa - .55, .22, z), b = P(xa - .55, .22, z + 1.1), r0 = Math.max(2, Math.round(.22 * CAM.f / z)), r1 = Math.max(2, Math.round(.22 * CAM.f / (z + 1.1)));   // lengths of blue water main, lying along the edge
          fillPoly(g, [[a[0] - r0, a[1]], [b[0] - r1, b[1]], [b[0] + r1, b[1]], [a[0] + r0, a[1]]], '#3a6ad0'); pxLine(g, a[0] + r0 - 1, a[1] - 1, b[0] + r1 - 1, b[1] - 1, '#5a8ae8');
          pxEllipse(g, a[0], a[1], r0, r0, '#2a5ab0'); pxEllipse(g, a[0], a[1], Math.max(1, r0 - 1), Math.max(1, r0 - 1), '#1d1f26'); }
        if (sv === 1) { const p = P(xa - .3, 0, 10.6); pxLine(g, p[0], p[1], p[0] - 6, p[1] - 10, '#8a6a3a'); const b = P(xa - .4, 0, 12); R(g, b[0] - 3, b[1] - 5, 6, 5, '#f07a1a'); }
        if (sv === 3) for (const x of [xb + .6, xb + .9]) { const pts2 = []; for (let z = 8; z <= 14; z += .5) pts2.push(P(x + Math.sin(z * 3) * .06, 0, z)); for (let k = 1; k < pts2.length; k++) lineW(g, pts2[k - 1], pts2[k], '#3a2c1e'); } }
      // the ladder out of the trench, near the front (or way at the back, or not there at all)
      if (lv !== 3) { const z = lv === 2 ? 15 : T.ladder, top = lv === 2 ? 0 : 1.2;
        const rails = (y0, y1) => { for (const x of [xa + .25, xb - .25]) lineW(g, P(x, y0, z), P(x, y1, z), '#c8ccd4'); for (let y = -d + .4; y < top; y += .4) if (y >= y0 && y <= y1) lineW(g, P(xa + .25, y, z), P(xb - .25, y, z), lv === 1 ? '#7a6040' : '#a8acb4'); };
        clipDo(g, cut, () => rails(-d, 0)); if (top > 0) rails(0, top); }   // below grade it only shows through the cut
      // the pump on the right lip, its hose down into the trench, and the gas meter clipped to the ladder
      { const [pa, pb, pz0, pz1] = T.pump, sP = CAM.f / pz0, [px0, py0] = P(pa, 0, pz0), u = v => Math.max(1, Math.round(v * sP));
        // a gas trash pump in its roll cage: the red engine and its pull-start, the gray pump body and its suction port, the fuel tank on top
        R(g, px0, py0 - u(.06), u(.6), u(.06), '#3a3c42');                                                     // the skid
        R(g, px0 + u(.02), py0 - u(.3), u(.3), u(.24), '#d82020'); R(g, px0 + u(.02), py0 - u(.3), u(.3), u(.04), '#ff5a4a'); pxEllipse(g, px0 + u(.1), py0 - u(.18), u(.05), u(.05), '#2a2c32');   // the engine, its starter
        R(g, px0 + u(.34), py0 - u(.26), u(.22), u(.2), '#8a8e96'); pxEllipse(g, px0 + u(.45), py0 - u(.16), u(.07), u(.07), '#4a4c52');   // the pump volute and its port
        R(g, px0 + u(.06), py0 - u(.4), u(.22), u(.1), '#d82020'); R(g, px0 + u(.12), py0 - u(.43), u(.06), u(.03), '#2a2c32');   // the tank and its cap
        for (const [x0, x1] of [[0, 0], [.6, .6]]) R(g, px0 + u(x0), py0 - u(.46), 1, u(.42), '#2a2c32'); R(g, px0, py0 - u(.46), u(.6), 1, '#2a2c32');   // the roll cage
        if (wv !== 2) { const a = [px0 + u(.45), py0 - u(.16)], b = P(xb, .02, pz0 + 1.2), c = P(xb - .5, -.8, pz0 + 2.4); pxLine(g, a[0], a[1], b[0], b[1], '#2a2c32', 2); clipDo(g, cut, () => pxLine(g, b[0], b[1], c[0], c[1], '#2a2c32', 2)); } }
      // the locate marks at the front right: yellow for gas, orange for telephone, and little flags
      if (lc !== 2) { const [la, lb, lz0, lz1] = T.locate, fade = lc === 1 ? .35 : 1;
        for (const [x, c] of [[la + .6, '#f2c418'], [la + 1.8, '#f07a1a']]) { for (let z = lz0; z < lz1; z += .6) lineW(g, P(x, 0, z), P(x, 0, z + .35), rgba(c, fade));
          for (const z of [lz0 + .4, lz1 - .6]) { const p = P(x + .15, 0, z); R(g, p[0], p[1] - 8, 1, 8, '#a8a8a2'); R(g, p[0] + 1, p[1] - 8, 4, 3, rgba(c, Math.max(fade, .6))); } } }
      // the excavator at the back, side-on, its boom reaching over the trench (bucket up high, or down with a person under it)
      excavator(g, T, ev, xa, xb);
      if (ev === 0) box3(g, xb + .2, xb + .5, 0, .35, 12.6, 15, { front: '#a07a48', top: '#b08a58' });   // the stop log along the edge
    },
    /* the pipe layer in the trench, the excavator's spotter (or a crew without vests), and a laborer cleaning up the trench's far end */
    crew() {
      const T = G.trench, [xa, xb] = T.x, d = T.depth, bv = cond('c_trenchbox'), ev = cond('c_excavator');
      const out = [{ id: 'piper', x: (xa + xb) / 2, z: bv === 2 ? 14.2 : 11, o: { y: -d, hat: '#f2c418', act: 'shovel', face: -1 }, clip: true },
        { id: 'shoveler', x: -4.1, z: 6.9, o: { act: 'shovel', face: 1, shirt: '#6a6a7a' } }];
      if (ev === 0) out.push({ id: 'spotter', x: xb + 1.6, z: 11.6, o: { face: -1 } , block: true });
      if (ev === 2) out.push({ id: 'crew2', x: xb + 1.4, z: 11.8, o: { vest: false, shirt: '#6a6a6a', face: -1 }, block: true }, { id: 'crew3', x: xb + 2.3, z: 11.9, o: { vest: false, shirt: '#8a6a4a', face: -1 }, block: true });
      if (ev === 3) out.push({ id: 'under', x: (xa + xb) / 2, z: 13.4, o: { y: -d, hat: '#f2c418', act: 'reach', face: 1 }, clip: true });
      return out;
    },
    dynamic(g, r, t) {
      const T = G.trench, [xa, xb] = T.x;
      AmbFX.birds(g, t, 7); AmbFX.exhaust(g, t, P((T.exc[0] + T.exc[1]) / 2 + 1.24, 2.6, (T.exc[2] + T.exc[3]) / 2), true);   // from the excavator's stack
      drawCrew(g, trench.crew(), t, Q.floor(xa, xb, T.z[0], T.z[1]));
      if (cond('c_water') !== 2 && Settings.get('motion')) { const [pa, , pz0] = T.pump, p = P(pa + .4, .55, pz0 + .2), k = Math.floor(t * 4) % 3; R(g, p[0] + k, p[1] - 3 - k * 2, 2, 2, 'rgba(200,200,200,0.6)'); }
      if (cond('c_water') === 3 && Math.floor(t * 3) % 2) { const p = P(xa + .3, 1.2, T.ladder); R(g, p[0] - 2, p[1] - 2, 4, 3, '#ff3030'); }
      if (cond('c_locate') === 3 && Settings.get('motion')) for (let k = 0; k < 4; k++) { const p = P((xa + xb) / 2 + Math.sin(t * 3 + k) * .3, -1 + ((t * .8 + k * .3) % 1.4), 8.6); R(g, p[0], p[1], 2, 1, 'rgba(240,240,220,0.5)'); }
    }
  };

  /* ============================== THE TRAILER YARD ==============================
     The job trailer across the back, its steps and door, with the first aid kit inside; the utility pole and its
     lines overhead; the temporary power pedestal on the left with cords running to the cut station on the right; a
     masonry saw cutting block behind that; and fuel cans and propane by the trailer's left end. */
  const power = {
    shell(g, r) { outdoor(g, r, 'gravel'); },
    walls(g, r) {
      for (const k of ['gang', 'silica', 'cut', 'panel', 'fuel']) { const [a, b, c, d] = G.power[k]; AmbFX.shadow(g, a, b, c, d); } AmbFX.shadow(g, G.power.trailer[0], G.power.trailer[1], G.power.trailer[2] - .3, G.power.trailer[3], 1.2);
      const W = G.power, zb = r.box.zb, tv = cond('c_trailer'), lv = cond('c_powerline'), pv = cond('c_panel'), cv = cond('c_cords'), kv = cond('c_cutsaw'), sv = cond('c_silica'), fv = cond('c_fuel');
      fenceBack(g, r, r.box.x0, r.box.x1); for (const side of ['left', 'right']) { fenceSide(g, r, side, 1.6, W.doors[0]); fenceSide(g, r, side, W.doors[1], zb); }
      { const a = P(r.box.x0, 2.0, W.doors[1] + .2), b = P(r.box.x1, 2.0, W.doors[1] + .2); label(g, Math.max(2, a[0] + 2), a[1], 'TRENCH'); label(g, Math.min(SW - 2, b[0] - 2), b[1], 'GATE', 'r'); }
      // the utility pole at the back right, its crossarm, and the lines running off to the left
      { const [px, pz] = W.pole, base = P(px, 0, pz), top = P(px, 6.4, pz); pxLine(g, base[0], base[1], top[0], top[1], '#6a4a2a', 3);
        lineW(g, P(px - 1.2, 6.0, pz), P(px + 1.2, 6.0, pz), '#5a3a1a'); for (const dx of [-1, 0, 1]) { const a = P(px + dx, 6.05, pz); R(g, a[0] - 1, a[1] - 2, 2, 2, '#c8ccd4'); const b = P(-14, 5.8 + dx * .1, pz + 1); pxLine(g, a[0], a[1], b[0], b[1], '#2a2c32'); }
        const sg = P(px - .2, 2.4, pz); label(g, sg[0], sg[1], 'LOOK UP', 'c', '#f2c418'); }
      // the job trailer: white siding, a window, the door, its steps (with a handrail, or not)
      { const [xa, xb, za, zb2] = W.trailer; box3(g, xa, xb, .5, 3.3, za, zb2, { front: '#eceae2', side: '#d4d2ca', top: '#f4f2ea' });
        for (let x = xa + .2; x < xb; x += .4) lineW(g, P(x, .55, za), P(x, 3.25, za), '#d4d2ca');
        box3(g, xa, xb, 0, .5, za + .3, zb2, { front: '#3a3c42' });
        for (const [wa, wb] of [[xa + .6, xa + 2], [xb - 2, xb - .6]]) { fillPoly(g, [P(wa, 1.6, za), P(wb, 1.6, za), P(wb, 2.6, za), P(wa, 2.6, za)], '#5a7a9a'); strokePoly(g, [P(wa, 1.6, za), P(wb, 1.6, za), P(wb, 2.6, za), P(wa, 2.6, za)], '#8a8e96'); }
        const [da, db] = W.door; fillPoly(g, [P(da, .5, za), P(db, .5, za), P(db, 2.8, za), P(da, 2.8, za)], '#c8c6be'); strokePoly(g, [P(da, .5, za), P(db, .5, za), P(db, 2.8, za), P(da, 2.8, za)], '#8a8880');
        const fa = P(db + .2, 1.6, za); R(g, fa[0], fa[1] - 4, 6, 6, '#f4f4ee'); R(g, fa[0] + 2, fa[1] - 3, 2, 4, '#2a9a4a'); R(g, fa[0] + 1, fa[1] - 2, 4, 2, '#2a9a4a');
        const [s0, s1] = W.steps; for (let k = 0; k < 4; k++) box3(g, da - .2, db + .2, k * .13, k * .13 + .06, s0 + k * .25, s0 + k * .25 + .25, { front: '#8a8e96', top: '#a8acb4' });
        if (tv !== 2) for (const x of [da - .25, db + .25]) { const a = P(x, .9, s0), b = P(x, 1.3, s1); pxLine(g, a[0], a[1], b[0], b[1], '#f2c418'); const f = P(x, 0, s0); pxLine(g, f[0], f[1], a[0], a[1], '#c89a08'); }
        }
      // whatever ended up near the overhead lines: a ladder against the trailer, or a lift basket up by the wires
      if (lv === 1) { const p = P(W.trailer[1] - .3, 3.3, W.trailer[2]); R(g, p[0] - 1, p[1] - 6, 3, 4, '#ffffc0'); }
      if (lv === 2) { const a = P(W.trailer[1] + .2, 0, W.trailer[2] - .8), b = P(W.trailer[1] + .2, 5.6, W.trailer[2]); pxLine(g, a[0] - 3, a[1], b[0] - 3, b[1], '#c8ccd4', 2); pxLine(g, a[0] + 3, a[1], b[0] + 3, b[1], '#c8ccd4', 2); }
      if (lv === 3) {   // an articulating boom lift: a wheeled chassis, the turntable, a two-piece boom, and the basket up by the wires
        box3(g, 1.2, 2.6, .3, .75, 12.4, 13.4, { front: '#f07a1a', top: '#ff9a40', side: '#c85a0a' });
        for (const x of [1.45, 2.35]) { const c = P(x, .28, 12.4); pxEllipse(g, c[0], c[1], 4, 4, '#1d1f26'); pxEllipse(g, c[0], c[1], 2, 2, '#8a8e96'); }
        box3(g, 1.6, 2.2, .75, 1.15, 12.6, 13.2, { front: '#d85a0a', top: '#f07a1a' });
        const j0 = P(1.9, 1.1, 12.9), j1 = P(1.2, 3.2, 13.6), j2 = P(2.4, 5.0, 14.6);
        pxLine(g, j0[0], j0[1], j1[0], j1[1], '#f07a1a', 4); pxLine(g, j1[0], j1[1], j2[0], j2[1], '#f07a1a', 3); pxLine(g, j0[0] + 2, j0[1] - 1, j1[0] + 2, j1[1] + 3, '#d8dce4');   // the boom and a cylinder
        R(g, j2[0] - 7, j2[1] - 2, 14, 5, '#f2c418'); pxLine(g, j2[0] - 7, j2[1] - 7, j2[0] + 7, j2[1] - 7, '#c89a08'); for (const dx of [-7, 0, 7]) pxLine(g, j2[0] + dx, j2[1] - 7, j2[0] + dx, j2[1] - 2, '#c89a08');   // the basket and its rails
        R(g, j2[0] - 2, j2[1] - 10, 4, 4, '#c8946a'); R(g, j2[0] - 3, j2[1] - 12, 6, 2, '#f2c418'); }
      // the temporary power pedestal on its post, a puddle around it in some cases
      { const [xa, xb, za, zb2] = W.panel; if (pv === 3) fillPoly(g, floorBlob((xa + xb) / 2 + .4, (za + zb2) / 2, 1.1, .6, 9, .3, 14), 'rgba(90,120,140,0.6)');
        box3(g, xa + .3, xa + .5, 0, 2.6, za + .3, za + .5, { front: '#8a6a3a', side: '#6a4a2a' });
        box3(g, xa + .1, xb, 1.2, 2.1, za, zb2, { front: '#8a8e96', side: '#6a6e76', top: '#a8acb4' });
        if (pv !== 2) fillPoly(g, [P(xb, 1.25, za + .1), P(xb, 1.25, zb2 - .1), P(xb, 2.05, zb2 - .1), P(xb, 2.05, za + .1)], pv === 1 ? '#9a9286' : '#a8acb4');
        else { const p = P(xb, 1.6, (za + zb2) / 2); R(g, p[0] - 2, p[1] - 3, 4, 6, '#2a2c32'); } }
      // the cords from the pedestal to the cut station: along the fence and under a cord ramp, or across the walkway
      { const from = P(W.panel[1], 1.3, (W.panel[2] + W.panel[3]) / 2), path = CONA.cordPath(cv);
        let prev = from; for (const [x, z] of path) { const p = P(x, 0, z); pxLine(g, prev[0], prev[1], p[0], p[1], '#f2a018', 2); prev = p; }
        if (cv === 0) { fillPoly(g, Q.floor(-1, 0, 6.4, 6.8), '#f2c418'); fillPoly(g, Q.floor(-1, 0, 6.5, 6.7), '#1d1f26'); }
        if (cv === 2) { const p = P(-1, 0, 10.4); R(g, p[0] - 2, p[1] - 2, 5, 3, '#1d1f26'); }
        if (cv === 3) { fillPoly(g, floorBlob(-.6, 10, .9, .5, 31, .3, 14), 'rgba(90,120,140,0.6)'); const p = P(-.8, 0, 10.1); R(g, p[0], p[1] - 1, 3, 1, '#d8883a'); } }
      // the gang box: a yellow steel job box on skids, lid down, a padlock hasp on the front (js/sites/construction.js opens it)
      { const [xa, xb, za, zb2] = W.gang; box3(g, xa - .05, xb + .05, 0, .12, za + .05, zb2, { front: '#3a3c42', top: '#4a4c52' }); box3(g, xa, xb, .12, 1.0, za, zb2, { front: '#d8a020', side: '#b88a10', top: '#e8b838' });
        lineW(g, P(xa, .92, za), P(xb, .92, za), '#a87a08'); for (let x = xa + .2; x < xb; x += .3) lineW(g, P(x, .2, za), P(x, .85, za), '#c8920e');
        const h = P((xa + xb) / 2, .8, za); R(g, h[0] - 2, h[1], 4, 4, '#5a5e66'); }
      // the cut station: plywood on sawhorses, a circular saw, and a grinder
      { const [xa, xb, za, zb2] = W.cut; box3(g, xa, xb, .85, .95, za, zb2, { front: '#c8a070', top: '#d8b484', side: '#a8844a' });
        for (const x of [xa + .3, xb - .3]) { const a = P(x - .3, 0, za + .3), b = P(x, .85, za + .3), c = P(x + .3, 0, za + .3); pxLine(g, a[0], a[1], b[0], b[1], '#8a6a3a', 2); pxLine(g, c[0], c[1], b[0], b[1], '#8a6a3a', 2); }
        const s = P(xa + .8, .95, za + .4); R(g, s[0] - 4, s[1] - 4, 9, 4, '#2a6ad0'); R(g, s[0] - 2, s[1] - 6, 3, 2, '#2a2c32');
        const gr = P(xb - .8, .95, za + .4); R(g, gr[0] - 4, gr[1] - 3, 8, 3, '#d8a020'); pxEllipse(g, gr[0] + 4, gr[1] - 2, 2, 3, kv === 3 ? '#c8c8c0' : '#5a5e66'); }
      // the masonry saw cart behind it: wet (with its hose), or cutting dry in a gray cloud
      { const [xa, xb, za, zb2] = W.silica;
        // a wet masonry saw on its stand: splayed legs, the gray water tray, the sliding cart with a block on it, the blade under its red guard, the motor
        for (const [x, z] of [[xa + .1, za + .1], [xb - .1, za + .1], [xa + .1, zb2 - .1], [xb - .1, zb2 - .1]]) { const a = P(x, 0, z), b = P(x + (x < (xa + xb) / 2 ? .15 : -.15), .7, z); pxLine(g, a[0], a[1], b[0], b[1], '#5a5e66', 2); }
        box3(g, xa, xb, .7, .95, za, zb2, { front: '#8a8e96', top: '#4a5a6a', side: '#6a6e76' });                     // the water tray (wet inside)
        box3(g, xa + .3, xa + 1.3, .95, 1.05, za + .2, zb2 - .2, { front: '#5a5e66', top: '#6a6e76' }); box3(g, xa + .45, xa + 1.15, 1.05, 1.35, za + .3, zb2 - .3, { front: '#b8b6ae', top: '#cac8c0' });   // the cart, and a block on it
        box3(g, xb - .2, xb - .05, .95, 1.9, za + .45, za + .75, { front: '#3a3c42' }); lineW(g, P(xb - .1, 1.9, za + .6), P(xa + .9, 1.75, za + .6), '#3a3c42');   // the column and the arm
        const c = P(xa + 1.0, 1.45, za + .5); pxEllipse(g, c[0], c[1] + 2, 6, 6, '#c8ccd4'); g.fillStyle = '#d82020'; g.beginPath(); g.arc(c[0], c[1] + 2, 7, Math.PI, Math.PI * 2); g.closePath(); g.fill();   // blade and guard
        box3(g, xa + 1.3, xa + 1.8, 1.55, 1.85, za + .4, za + .7, { front: '#d82020', top: '#e85050' });                // the motor
        if (sv === 0) { const a = P(xa + 1.6, 1.0, za), b = P(xa - 1, 0, za - 1.4); pxLine(g, a[0], a[1], b[0], b[1], '#2a8a4a'); fillPoly(g, floorBlob(xa + 1.2, za - .4, .7, .3, 5, .3, 12), 'rgba(140,140,130,0.6)'); }
        if (sv === 1) { box3(g, xb + .1, xb + .7, 0, .9, za, za + .6, { front: '#f2c418', top: '#d8aa0a' }); }
        if (sv === 2) { const b = P(xa - 1.4, 0, za - .6); pxLine(g, b[0], b[1], b[0] + 6, b[1] - 16, '#8a6a3a'); fillPoly(g, floorBlob(xa - 1.4, za - .4, 1.0, .5, 13, .4, 14), 'rgba(200,200,196,0.55)'); }
        if (sv === 3) { const q = []; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; q.push([c[0] + Math.cos(a) * (22 + hash(i) * 8), c[1] - 6 + Math.sin(a) * (14 + hash(i + 3) * 6)]); } fillPoly(g, q, 'rgba(200,200,196,0.75)'); } }
      // fuel by the trailer's left end: red safety cans and propane cylinders on a rack (or a soda bottle and a smoker)
      { const [xa, xb, za, zb2] = W.fuel;
        // red safety cans: a squat can, a carry handle, and the spring-lid spout on top
        for (const [x, z] of [[xa + .2, za + .2], [xa + .8, za + .2]]) { box3(g, x, x + .45, 0, .5, z, z + .35, { front: '#d82020', top: '#e85050', side: '#a81818' }); lineW(g, P(x + .05, .62, z + .15), P(x + .4, .62, z + .15), '#2a2c32');
          const sp = P(x + .35, .5, z + .1); R(g, sp[0] - 1, sp[1] - 3, 3, 3, '#f2c418'); lineW(g, P(x + .1, .48, z), P(x + .35, .48, z), '#f2c418'); }
        if (fv === 2) box3(g, xb - .4, xb - .2, 0, .5, za + .2, za + .3, { front: 'rgba(200,220,160,0.8)', top: '#3a8a3a' });
        // propane cylinders: rounded shoulders, a valve collar on top, a foot ring (one leaning, untied, on a bad day)
        for (const [k, z] of [[0, za + 1.0], [1, za + 1.4]]) { const lean = fv === 2 && k === 1 ? .25 : 0, x0 = xa + .2, x1 = xa + .55;
          fillPoly(g, [P(x0, .08, z), P(x1, .08, z), P(x1 + lean * .85, 1.05, z), P(x0 + lean * .85, 1.05, z)], '#e8e8e0');
          const top = P((x0 + x1) / 2 + lean * .9, 1.12, z), w = Math.round((P(x1, 0, z)[0] - P(x0, 0, z)[0]) / 2); pxEllipse(g, top[0], top[1], w, Math.max(2, Math.round(w * .6)), '#e8e8e0');   // the rounded shoulder
          R(g, top[0] - Math.round(w * .5), top[1] - Math.round(w * .9), Math.round(w), Math.round(w * .5), '#a8acb4'); R(g, top[0] - 1, top[1] - Math.round(w * 1.2), 2, 2, '#c8a030');   // collar and valve
          const ft = P(x0, 0, z), ft2 = P(x1, 0, z); R(g, ft[0], ft[1] - 2, ft2[0] - ft[0], 2, '#a8acb4');
          lineW(g, P(x0 + .05 + lean * .4, .55, z), P(x1 - .05 + lean * .4, .55, z), '#c8c8c0'); }
        if (fv !== 2) lineW(g, P(xa + .1, .9, za + .95), P(xa + .7, .9, za + 1.5), '#8a8e96');
        const ex = P(xa + 1.2, .6, zb2); R(g, ex[0] - 2, ex[1] - 8, 4, 8, '#d82020'); }
    },
    /* the mason at the block saw, a carpenter at the cut station, the super on the trailer steps with the phone, and,
       depending on the day, a smoker by the fuel or someone hurt on the steps */
    crew() {
      const W = G.power, [sa, , sz] = W.silica, tv = cond('c_trailer'), fv = cond('c_fuel');
      const out = [{ id: 'mason', x: sa - .5, z: sz + .4, o: { act: 'saw', face: 1, muffs: true, hat: '#f4f4ee' }, block: true },
        { id: 'carpenter', x: W.cut[1] + .45, z: (W.cut[2] + W.cut[3]) / 2, o: { act: 'saw', face: -1, muffs: true, shirt: '#3a6a5a' }, block: true }];
      if (tv !== 3) out.push({ id: 'super', x: -1.5, z: 13.05, o: { act: 'phone', face: 1, hat: '#ffffff', shirt: '#4a5a8a' }, block: true });
      else out.push({ id: 'hurt', x: W.door[1] + .5, z: W.steps[0] - .4, o: { kneel: true, shirt: '#8a5a3a', vest: false, face: -1 } });
      if (fv === 3) out.push({ id: 'smoker', x: W.fuel[0] + .3, z: W.fuel[2] - .5, o: { vest: false, glasses: false, shirt: '#5a5a6a', smoke: true, face: 1 } });
      return out;
    },
    dynamic(g, r, t) {
      const W = G.power;
      AmbFX.birds(g, t, 17);
      drawCrew(g, power.crew(), t);
      if (cond('c_silica') === 3 && Settings.get('motion')) { const [xa, , za] = W.silica, c = P(xa + 1.6, 1.3, za + .5); for (let k = 0; k < 6; k++) R(g, c[0] - 18 + ((t * 20 + k * 9) % 40), c[1] - 14 + hash(k) * 12, 2, 1, 'rgba(230,230,226,0.7)'); }
      if (cond('c_panel') === 3 && Settings.get('motion') && Math.floor(t * 5) % 7 === 0) { const p = P(W.panel[1], 1.3, W.panel[2]); R(g, p[0], p[1] + 2, 2, 2, '#f8f8a0'); }
    }
  };

  /* ============================== LEFT BEHIND ============================== */
  const SPRITES = {
    c_tape: ['..oooooo..', '.oYYYYYYo.', 'oYYoooYYYo', 'oYoKKKoYYo', 'oYoKKKoYYo', 'oYYoooYYYo', '.oYYYYYYoo', '..oooooo.o'],
    c_level: ['oooooooooooooo', 'oYYYYYoboYYYYo', 'oYYYYYoboYYYYo', 'oooooooooooooo'],
    c_thermos: ['..ooo...', '.oKKKo..', 'oEEEEEo.', 'oEEEEEoo', 'oEWEEEo.', 'oEEEEEo.', 'oEEEEEo.', 'oEEEEEo.', '.ooooo..'],
    c_hammer: ['ooooo.......', 'oKKKKoooooo.', 'oKKKKoNNNNNo', '.ooooooooooo'],
    c_cone: ['....oo....', '...oOOo...', '...oWWo...', '..oOOOOo..', '..oWWWWo..', '.oOOOOOOo.', 'oooooooooo']
  };

  /* ============================== TITLE: Site 204 from across the street ============================== */
  let cache = null;
  const title = (g, t) => {
    if (!cache) {
      cache = document.createElement('canvas'); cache.width = SW; cache.height = SH; const h = cache.getContext('2d'), T = Decor.time;
      sky(h); farView(h, 5);
      R(h, 0, CAM.hy, SW, SH - CAM.hy, GROUND.dirt.base); speckle(h, 0, CAM.hy, SW, SH - CAM.hy, rgba(GROUND.dirt.dk, .9), 3000, 2);
      // the frame of the building going up: columns, beams, a deck, and the tower crane over it all
      const fx0 = 150, fx1 = 420, base = 196;
      for (let k = 0; k < 3; k++) { const y = base - k * 38; R(h, fx0, y - 4, fx1 - fx0, 4, '#b4b2aa'); }
      for (let x = fx0; x <= fx1; x += 45) R(h, x, base - 110, 4, 110, '#9a4a3a');
      for (let k = 1; k < 3; k++) for (let x = fx0; x < fx1; x += 45) R(h, x, base - k * 38 - 8, 45, 3, '#9a4a3a');
      R(h, fx0, base - 114, fx1 - fx0 + 4, 4, '#9a4a3a');
      for (let y = base - 40; y < base; y += 8) R(h, fx1 + 6, y, 24, 2, '#b4b8c0'); for (const x of [fx1 + 6, fx1 + 28]) R(h, x, base - 76, 2, 76, '#b4b8c0');
      R(h, 98, 18, 4, base - 18, '#f2c418'); for (let y = 22; y < base; y += 8) { R(h, 94, y, 12, 1, '#c89a08'); }
      R(h, 60, 16, 300, 4, '#f2c418'); for (let x = 64; x < 356; x += 8) R(h, x, 20, 1, 4, '#c89a08'); R(h, 60, 20, 28, 10, '#5a5e66');
      const hx = 290; R(h, hx, 20, 1, 60, '#2a2c32'); R(h, hx - 6, 80, 12, 8, '#b8b6ae');
      // the fence along the front, and the sign on it
      for (let x = 0; x < SW; x++) for (let y = 206; y < 246; y++) if ((x + y) % 4 === 0 || (x - y + 400) % 4 === 0) h.fillRect(x, y, 1, 1);
      R(h, 0, 206, SW, 40, 'rgba(47,90,58,0.55)'); R(h, 0, 204, SW, 2, '#8a9098'); for (let x = 10; x < SW; x += 60) R(h, x, 204, 3, 46, '#7a8088');
      R(h, 20, 212, 100, 26, '#f4f2ea'); R(h, 20, 212, 100, 6, '#2a5aa8'); txt(h, 'SITE 204', 70, 222, '#1d1f26', 2, 'c'); txt(h, 'HARD HAT AREA', 70, 232, '#c8202a', 1, 'c');
      R(h, 0, 250, SW, 20, '#c4c0b6'); for (let x = 0; x < SW; x += 24) R(h, x, 250, 1, 20, '#a8a49a');
      for (const [x, w] of [[200, 18], [260, 16]]) { R(h, x, 238, w, 12, '#f07a1a'); R(h, x + 3, 236, w - 6, 2, '#f4f2dc'); }
    }
    g.drawImage(cache, 0, 0);
    const sw = Math.sin(t * .4) * 6; R(g, 290 + sw, 20, 1, 60, '#2a2c32');
  };
  /* the extension cord's route across the trailer yard: along the fence and under a ramp, or straight across the walkway */
  const cordPath = cv => cv === 0 ? [[-5.4, 7.0], [1.6, 7.0], [1.8, 7.6]] : [[-4.6, 9.6], [-2.4, 9.4], [0, 9.2], [1.6, 8.0]];
  return { G, PPE_X, cordPath, person, personPts, drawCrew, excavatorPts: () => excavator(null, G.trench, cond('c_excavator'), G.trench.x[0], G.trench.x[1], true), sky, farView, ground, mesh, fenceBack, fenceSide, street, outdoor, person, gate, deck, trench, power, SPRITES, title };
})();
