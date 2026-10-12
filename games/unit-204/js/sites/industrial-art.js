'use strict';
/* ============================== LOT 204: INDUSTRIAL ART ==============================
   Everything drawn for the industrial site (js/sites/industrial.js holds the data): the four areas of a tenant's
   warehouse and light-manufacturing building (the loading dock, a racking aisle, the production floor, and the
   maintenance shop with its chemical storage), every feature's 240x135 close-up, the left-behind things' sprites,
   and the title backdrop. Same pixel style as the apartment: one-point perspective rooms built from P() and Q
   (js/util.js) and box3() (js/rooms.js), hard pixels, flat shading bands.
   Everything here hangs off one global, INDA, so nothing collides with the other sites' files. Each room view reads
   the same condition as its close-up (cond('i_forklift')), so what you see from across the dock is what you find. */
const INDA = (() => {
  /* ---------- a 3x5 pixel font for signs, stencils, plates, and labels (crisp at any size, no web font to wait on) ---------- */
  const GLYPH = {
    A: '.#./#.#/###/#.#/#.#', B: '##./#.#/##./#.#/##.', C: '.##/#../#../#../.##', D: '##./#.#/#.#/#.#/##.', E: '###/#../##./#../###',
    F: '###/#../##./#../#..', G: '.##/#../#.#/#.#/.##', H: '#.#/#.#/###/#.#/#.#', I: '###/.#./.#./.#./###', J: '..#/..#/..#/#.#/.#.',
    K: '#.#/#.#/##./#.#/#.#', L: '#../#../#../#../###', M: '#.#/###/###/#.#/#.#', N: '##./#.#/#.#/#.#/#.#', O: '.#./#.#/#.#/#.#/.#.',
    P: '##./#.#/##./#../#..', Q: '.#./#.#/#.#/##./.##', R: '##./#.#/##./#.#/#.#', S: '.##/#../.#./..#/##.', T: '###/.#./.#./.#./.#.',
    U: '#.#/#.#/#.#/#.#/###', V: '#.#/#.#/#.#/#.#/.#.', W: '#.#/#.#/###/###/#.#', X: '#.#/#.#/.#./#.#/#.#', Y: '#.#/#.#/.#./.#./.#.',
    Z: '###/..#/.#./#../###', 0: '###/#.#/#.#/#.#/###', 1: '.#./##./.#./.#./###', 2: '##./..#/.#./#../###', 3: '##./..#/.#./..#/##.',
    4: '#.#/#.#/###/..#/..#', 5: '###/#../##./..#/##.', 6: '.##/#../###/#.#/###', 7: '###/..#/.#./.#./.#.', 8: '###/#.#/###/#.#/###',
    9: '###/#.#/###/..#/##.', '.': '.../.../.../.../.#.', ',': '.../.../.../.#./#..', '!': '.#./.#./.#./.../.#.', '-': '.../.../###/.../...',
    '/': '..#/..#/.#./#../#..', ':': '.../.#./.../.#./...', "'": '.#./.#./.../.../...', '?': '##./..#/.#./.../.#.', '(': '.#./#../#../#../.#.',
    ')': '.#./..#/..#/..#/.#.', '#': '#.#/###/#.#/###/#.#', '%': '#.#/..#/.#./#../#.#', '+': '.../.#./###/.#./...', '"': '#.#/#.#/.../.../...',
    '&': '.#./#.#/.#./#.#/.##', '=': '.../###/.../###/...'
  };
  const GL = {}; for (const [k, v] of Object.entries(GLYPH)) GL[k] = v.split('/');
  /* how wide a line of text is, in pixels, at scale k */
  const tw = (s, k = 1) => Math.max(0, String(s).length * 4 * k - k);
  /* text at x, y (top left), or centered on x when align is 'c', or right-aligned to x when 'r' */
  function txt(g, s, x, y, col, k = 1, align) {
    s = String(s).toUpperCase(); if (align === 'c') x -= tw(s, k) / 2; else if (align === 'r') x -= tw(s, k);
    x = Math.round(x); y = Math.round(y); g.fillStyle = col;
    for (let i = 0; i < s.length; i++) { const gl = GL[s[i]]; if (gl) gl.forEach((row, j) => { for (let c = 0; c < 3; c++) if (row[c] === '#') g.fillRect(x + (i * 4 + c) * k, y + j * k, k, k); }); }
  }

  /* ---------- close-up surfaces ---------- */
  const R = (g, x, y, w, h, c) => pxRect(g, x, y, w, h, c);
  /* bare concrete seen up close: gray, with sand and aggregate speckle and a few darker pores */
  function concrete(g, x, y, w, h, base = '#a8a69e', seed = 1) {
    R(g, x, y, w, h, base); speckle(g, x, y, w, h, mix(base, '#000000', .14), w * h / 9, seed); speckle(g, x, y, w, h, mix(base, '#ffffff', .18), w * h / 12, seed + 3);
    speckle(g, x, y, w, h, mix(base, '#3a3428', .3), w * h / 70, seed + 7);
  }
  /* painted concrete block (CMU): 16x8 blocks in running bond with recessed mortar joints */
  function cmu(g, x, y, w, h, base = '#d8d6ce', seed = 1, bw = 24, bh = 12) {
    R(g, x, y, w, h, base); speckle(g, x, y, w, h, mix(base, '#000000', .08), w * h / 14, seed); speckle(g, x, y, w, h, mix(base, '#ffffff', .25), w * h / 20, seed + 5);
    const j = mix(base, '#5a564c', .32), lt = mix(base, '#ffffff', .3);
    for (let r = 0, yy = y; yy < y + h; yy += bh, r++) {
      R(g, x, yy, w, 1, j); R(g, x, yy + 1, w, 1, lt);
      for (let xx = x - (r % 2 ? bw / 2 : 0); xx < x + w; xx += bw) if (xx > x) { R(g, xx, yy, 1, Math.min(bh, y + h - yy), j); R(g, xx + 1, yy + 1, 1, Math.min(bh - 1, y + h - yy - 1), lt); }
    }
  }
  /* ribbed steel siding or a roll-up door's slats: horizontal (door) or vertical (wall) ribs, with a lit edge and a shadow */
  function ribbed(g, x, y, w, h, base = '#c9ccd0', step = 6, vertical = true) {
    R(g, x, y, w, h, base);
    const hi = mix(base, '#ffffff', .35), sh = mix(base, '#1a1c22', .3);
    if (vertical) for (let xx = x; xx < x + w; xx += step) { R(g, xx, y, 1, h, hi); R(g, xx + step - 2, y, 1, h, sh); }
    else for (let yy = y; yy < y + h; yy += step) { R(g, x, yy, w, 1, hi); R(g, x, yy + step - 2, w, 1, sh); }
  }
  /* diamond tread plate (the leveler deck, the dock plate) */
  function tread(g, x, y, w, h, base = '#8e939c') {
    R(g, x, y, w, h, base); const hi = mix(base, '#ffffff', .3), sh = mix(base, '#000000', .3);
    for (let yy = y + 2, r = 0; yy < y + h - 1; yy += 4, r++) for (let xx = x + 2 + (r % 2) * 3; xx < x + w - 2; xx += 6) { R(g, xx, yy, 2, 1, hi); R(g, xx + 1, yy + 1, 2, 1, sh); }
  }
  /* yellow-and-black hazard stripes on a diagonal (or any two colors) */
  function stripes(g, x, y, w, h, a = '#f2c418', b = '#1d1f26', p = 6, flip = false) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = Math.floor(((flip ? w - i : i) + j) / p) % 2; g.fillStyle = k ? b : a; g.fillRect(x + i, y + j, 1, 1); }
  }
  /* a hex bolt head, with a washer */
  function bolt(g, x, y, c = '#9aa0aa') { pxEllipse(g, x, y, 2, 2, mix(c, '#000000', .35)); R(g, x - 1, y - 1, 3, 3, c); R(g, x - 1, y - 1, 2, 1, mix(c, '#ffffff', .4)); }
  /* a safety sign: a colored header band with its signal word, then the message in lines underneath.
     kind: danger (red), warning (orange), caution (yellow), notice (blue), safety (green), plain (just the lines) */
  const SIGN = { danger: ['#c8202a', '#ffffff', 'DANGER'], warning: ['#f07a1a', '#1d1f26', 'WARNING'], caution: ['#f2c418', '#1d1f26', 'CAUTION'], notice: ['#2a5aa8', '#ffffff', 'NOTICE'], safety: ['#2a8a4a', '#ffffff', 'SAFETY FIRST'] };
  function sign(g, x, y, w, h, kind, lines, k = 1, fade = 0) {
    R(g, x - 1, y - 1, w + 2, h + 2, '#3a3a40'); R(g, x, y, w, h, '#f8f6ee');
    const s = SIGN[kind], bh = s ? 5 * k + 4 : 0;
    if (s) { R(g, x, y, w, bh, s[0]); if (kind === 'danger') pxEllipse(g, x + w / 2, y + bh / 2, Math.min(w / 2 - 2, tw(s[2], k) / 2 + 4), bh / 2 - 1, '#1d1f26'); txt(g, s[2], x + w / 2, y + 2, s[1], k, 'c'); }
    (lines || []).forEach((l, i) => txt(g, l, x + w / 2, y + bh + 3 + i * (6 * k + 1), kind === 'exitred' ? '#c8202a' : '#1d1f26', k, 'c'));
    if (fade) { g.fillStyle = `rgba(248,246,238,${fade})`; g.fillRect(x, y, w, h); }
  }

  /* ---------- the room shell: steel deck and bar joists up top, painted block walls with ribbed siding above, sealed
     concrete underfoot with saw-cut control joints. An area paints itself with this (r.shell), then its walls() go on top ---------- */
  function shell(g, r) {
    const { x0, x1, h, zb } = r.box, zn = 1.6, p = Decor.pal(r.id), d = Decor.cur, accent = d && d.accent && d.accent[r.id];
    const wall = p.wall, block = r.cmu || 2.4, sh = Decor.time.shadow;
    // the roof deck: dark ribbed steel running front to back, with open-web bar joists across it
    const ceil = [P(x0, h, zn), P(x1, h, zn), P(x1, h, zb), P(x0, h, zb)];
    fillPoly(g, ceil, '#4a4e56');
    clipDo(g, ceil, () => {
      for (let x = x0; x <= x1; x += .5) lineW(g, P(x, h, zn), P(x, h, zb), (Math.round(x * 2) % 2) ? '#565a62' : '#3e424a');
      for (let z = zb - 1; z > 3; z -= 2.2) {                                     // bar joists: a top chord, a bottom chord, and a zigzag web between them
        lineW(g, P(x0, h - .05, z), P(x1, h - .05, z), '#6a6e76'); lineW(g, P(x0, h - .45, z), P(x1, h - .45, z), '#5e626a');
        for (let x = x0, k = 0; x < x1; x += .6, k++) lineW(g, P(x, h - (k % 2 ? .05 : .45), z), P(x + .6, h - (k % 2 ? .45 : .05), z), '#555960');
      }
    });
    // the joist chords hang below the deck, so they cross the top of the back wall too
    fillPoly(g, Q.back(r.box, x0, x1, h - .5, h), '#3e424a');
    // walls: block below, ribbed metal siding above
    const L = [P(x0, 0, zn), P(x0, 0, zb), P(x0, h, zb), P(x0, h, zn)], Rw = [P(x1, 0, zn), P(x1, 0, zb), P(x1, h, zb), P(x1, h, zn)], B = Q.back(r.box, x0, x1, 0, h - .5);
    const metal = r.metal || '#c4c8cc', mL = mix(metal, sh, .16), mR = mix(metal, sh, .1);
    fillPoly(g, L, mL); fillPoly(g, Rw, mR); fillPoly(g, B, metal);
    for (let x = x0 + .3; x < x1; x += .3) lineW(g, P(x, block, zb), P(x, h - .5, zb), (Math.round(x / .3) % 2) ? mix(metal, '#ffffff', .25) : mix(metal, '#30343c', .2));
    for (let z = 2, k = 0; z < zb; z += .3, k++) { lineW(g, P(x0, block, z), P(x0, h, z), k % 2 ? mix(mL, '#ffffff', .2) : mix(mL, '#30343c', .2)); lineW(g, P(x1, block, z), P(x1, h, z), k % 2 ? mix(mR, '#ffffff', .2) : mix(mR, '#30343c', .2)); }
    const bl = mix(wall, sh, .14), br = mix(wall, sh, .08);
    fillPoly(g, Q.left(r.box, zn, zb, 0, block), bl); fillPoly(g, Q.right(r.box, zn, zb, 0, block), br); fillPoly(g, Q.back(r.box, x0, x1, 0, block), wall);
    // block coursing: a mortar line every course, and staggered head joints on the back wall
    const mor = mix(wall, '#5a564c', .22);
    for (let y = .33, k = 0; y < block; y += .33, k++) {
      lineW(g, P(x0, y, zb), P(x1, y, zb), mor); lineW(g, P(x0, y, zn), P(x0, y, zb), mix(bl, '#5a564c', .2)); lineW(g, P(x1, y, zn), P(x1, y, zb), mix(br, '#5a564c', .2));
      for (let x = x0 + (k % 2 ? .66 : 0); x < x1; x += 1.33) lineW(g, P(x, y, zb), P(x, y + .33, zb), mor);
    }
    speckPoly(g, Q.back(r.box, x0, x1, 0, block), 'rgba(0,0,0,0.05)', .25, 7); speckPoly(g, Q.left(r.box, zn, zb, 0, block), 'rgba(0,0,0,0.05)', .25, 8); speckPoly(g, Q.right(r.box, zn, zb, 0, block), 'rgba(0,0,0,0.05)', .25, 9);
    // the cap where block meets siding, and a painted band (the tenant's accent color, when there is one)
    const band = accent || mix(wall, '#3a3a40', .45);
    fillPoly(g, Q.back(r.box, x0, x1, block - .12, block), band); fillPoly(g, Q.left(r.box, zn, zb, block - .12, block), mix(band, sh, .14)); fillPoly(g, Q.right(r.box, zn, zb, block - .12, block), mix(band, sh, .08));
    // the floor: sealed concrete, saw-cut joints every few feet, scuffed by years of forklift tires
    const f = p.floor || { base: '#a8a8a2', dk: '#94948e', lt: '#bcbcb4' }, fl = [P(x0, 0, zn), P(x1, 0, zn), P(x1, 0, zb), P(x0, 0, zb)];
    fillPoly(g, fl, f.base);
    clipDo(g, fl, () => {
      for (let i = 0; i < 9; i++) { const cx = x0 + hash(i + r.id.length) * (x1 - x0), cz = 4 + hash(i + 9) * (zb - 5); for (const k of [1, .7, .45]) fillPoly(g, floorBlob(cx, cz, 1.6 * k, .9 * k, i * 5 + 2, .4, 16), rgba(i % 2 ? f.lt : f.dk, .14)); }
      speckle(g, 0, CAM.hy, SW, SH - CAM.hy, rgba(f.dk, .8), 3000, 11); speckle(g, 0, CAM.hy, SW, SH - CAM.hy, rgba(f.lt, .8), 2200, 12);
      const joint = mix(f.base, '#3a3a36', .35);
      for (let x = Math.ceil(x0 / 4) * 4; x < x1; x += 4) lineW(g, P(x, 0, 2.2), P(x, 0, zb), joint);
      for (let z = zb - 4; z > 2; z -= 4) lineW(g, P(x0, 0, z), P(x1, 0, z), joint);
      for (let i = 0; i < 14; i++) { const x = x0 + hash(i * 3 + 1) * (x1 - x0), z = 4 + hash(i * 7 + 2) * (zb - 5), a = P(x, 0, z), b = P(x + .8 + hash(i) * 1.6, 0, z + (hash(i + 4) - .5) * .4); pxLine(g, a[0], a[1], b[0], b[1], 'rgba(30,30,34,0.18)'); }   // tire scuffs
    });
    fillPoly(g, Q.floor(x0, x1, zb - .35, zb), rgba(sh, .16));                     // contact shadow along the back wall
    fillPoly(g, Q.back(r.box, x0, x1, 0, .12), mix(wall, '#2a2a2e', .5)); fillPoly(g, Q.left(r.box, zn, zb, 0, .12), mix(bl, '#2a2a2e', .5)); fillPoly(g, Q.right(r.box, zn, zb, 0, .12), mix(br, '#2a2a2e', .5));   // a dark cove base
    lineW(g, P(x0, 0, zb), P(x0, h, zb), 'rgba(30,30,40,0.35)'); lineW(g, P(x1, 0, zb), P(x1, h, zb), 'rgba(30,30,40,0.35)'); lineW(g, P(x0, h - .5, zb), P(x1, h - .5, zb), 'rgba(20,20,26,0.4)');
  }
  /* a wide opening in a side wall to the next area (no door leaf): the next area's floor and a glimpse of its light */
  function opening(g, r, side, za, zb, h = 3.6, inside = '#6a6e76', floorC = '#8a8a84') {
    const q = side === 'left' ? Q.left : Q.right, x = side === 'left' ? r.box.x0 : r.box.x1;
    fillPoly(g, q(r.box, za, zb, 0, h), inside);
    fillPoly(g, q(r.box, za, zb, 0, .5), floorC); fillPoly(g, q(r.box, za, za + (zb - za) * .45, 0, h), 'rgba(10,10,16,0.25)');
    fillPoly(g, q(r.box, za - .18, za, 0, h + .18), '#e0b020'); fillPoly(g, q(r.box, zb, zb + .18, 0, h + .18), '#e0b020'); fillPoly(g, q(r.box, za - .18, zb + .18, h, h + .18), '#8a8e96');   // yellow-painted jambs
    for (let y = .3; y < 1.4; y += .5) { fillPoly(g, q(r.box, za - .18, za, y, y + .25), '#1d1f26'); fillPoly(g, q(r.box, zb, zb + .18, y, y + .25), '#1d1f26'); }   // striped where a forklift would clip them
    lineW(g, P(x, 0, za), P(x, h, za), 'rgba(20,20,26,0.5)'); lineW(g, P(x, 0, zb), P(x, h, zb), 'rgba(20,20,26,0.5)');
  }
  /* the same opening in the back wall, for an area whose side walls are lined with racks */
  function backOpening(g, r, xa, xb, h = 3.2, inside = '#6a6e76', floorC = '#8a8a84') {
    fillPoly(g, Q.back(r.box, xa, xb, 0, h), inside); fillPoly(g, Q.back(r.box, xa, xb, 0, .4), floorC);
    fillPoly(g, Q.back(r.box, xa - .18, xa, 0, h + .18), '#e0b020'); fillPoly(g, Q.back(r.box, xb, xb + .18, 0, h + .18), '#e0b020'); fillPoly(g, Q.back(r.box, xa - .18, xb + .18, h, h + .18), '#8a8e96');
    for (let y = .3; y < 1.4; y += .5) { fillPoly(g, Q.back(r.box, xa - .18, xa, y, y + .25), '#1d1f26'); fillPoly(g, Q.back(r.box, xb, xb + .18, y, y + .25), '#1d1f26'); }
  }
  /* a high-bay light: a cord down from the deck and an aluminum dome; lit = the glowing lens underneath */
  function highbay(g, r, x, z, lit = true, drop = 1) {
    const h = r.box.h, top = P(x, h, z), base = P(x, h - drop, z), s = clamp(300 / z / 30, .5, 2);
    pxLine(g, top[0], top[1], base[0], base[1], '#2a2c32');
    const w = Math.max(3, Math.round(6 * s)), dh = Math.max(2, Math.round(4 * s));
    fillPoly(g, [[base[0] - 1, base[1]], [base[0] + 1, base[1]], [base[0] + w, base[1] + dh], [base[0] - w, base[1] + dh]], '#9aa0aa');
    pxRect(g, base[0] - w, base[1] + dh - 1, w * 2, 1, '#6a6e78'); pxRect(g, base[0] - Math.max(1, w - 2), base[1] + 1, Math.max(1, w - 3), 1, '#c8ccd4');
    pxRect(g, base[0] - w + 1, base[1] + dh, w * 2 - 2, Math.max(1, Math.round(s)), lit ? '#fff6d0' : '#6a6e78');
  }
  /* the light it throws: a soft cone and a pool on the floor (drawn live, so it can go dark) */
  function highbayGlow(g, r, x, z, drop = 1, a = .12) {
    const p = P(x, r.box.h - drop, z), f = P(x, 0, z);
    softGlow(g, p[0], p[1] + 3, 26, 10, '#fff4d0', a * 1.6);
    softGlow(g, f[0], f[1], 300 / z * 2.2, 300 / z * .6, '#fff6dc', a);
  }
  /* a wall-mounted fire extinguisher on its hook, with the red marker sign above it, on a side or back wall */
  function extinguisherBack(g, r, x, y = .9) {
    const zb = r.box.zb, a = P(x - .12, y + .55, zb), b = P(x + .12, y, zb), w = Math.max(2, b[0] - a[0]), hh = Math.max(4, b[1] - a[1]);
    pxRect(g, a[0], a[1], w, hh, '#c8202a'); pxRect(g, a[0], a[1], Math.max(1, w / 3), hh, '#e85050'); pxRect(g, a[0] + w / 2 - 1, a[1] - 2, 2, 2, '#2a2a30');
    const s = Q.back(r.box, x - .2, x + .2, y + .8, y + 1.25); fillPoly(g, s, '#c8202a'); const c = polyBox(s); pxRect(g, c.cx - 1, c.y0 + 1, 2, Math.max(1, c.y1 - c.y0 - 2), '#ffffff');
  }
  function extinguisherSide(g, r, side, z, y = .9) {
    const x = side === 'left' ? r.box.x0 : r.box.x1, q = side === 'left' ? Q.left : Q.right;
    fillPoly(g, q(r.box, z - .1, z + .1, y, y + .55), '#c8202a'); const top = P(x, y + .58, z); pxRect(g, top[0] - 1, top[1], 2, 2, '#2a2a30');
    fillPoly(g, q(r.box, z - .16, z + .16, y + .8, y + 1.2), '#c8202a');
  }
  /* a small sign on the back wall, readable from the floor (a colored band and a line of tiny text) */
  function wallSign(g, r, xa, xb, ya, yb, band, text, tcol = '#1d1f26') {
    const q = Q.back(r.box, xa, xb, ya, yb), b = polyBox(q);
    pxRect(g, b.x0 - 1, b.y0 - 1, b.x1 - b.x0 + 2, b.y1 - b.y0 + 2, '#3a3a40'); pxRect(g, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, '#f6f4ec');
    if (band) pxRect(g, b.x0, b.y0, b.x1 - b.x0, Math.max(2, Math.round((b.y1 - b.y0) * .35)), band);
    if (text) txt(g, text, b.cx, b.y1 - 6, tcol, 1, 'c');
    return b;
  }
  /* a lit EXIT sign: red letters on white, glowing a little */
  function exitSign(g, x, y, lit = true) {
    pxRect(g, x - 9, y - 1, 19, 8, '#3a3a40'); pxRect(g, x - 8, y, 17, 6, lit ? '#fbf6f0' : '#c8c4bc'); txt(g, 'EXIT', x + 1, y + 1, lit ? '#d82020' : '#8a6060', 1, 'c');
  }

  return { GL, tw, txt, R, concrete, cmu, ribbed, tread, stripes, bolt, sign, shell, opening, backOpening, highbay, highbayGlow, extinguisherBack, extinguisherSide, wallSign, exitSign };
})();

/* ============================== THE LOADING DOCK ==============================
   Three dock doors in the back wall: door 1 rolled up on an empty yard (the dock edge), door 2 with a trailer backed
   in (its leveler, restraint light, and swing-arm dock light), door 3 shut. The forklift is parked mid-floor, the
   battery chargers line the left wall behind yellow bollards, the first aid cabinet hangs by them, and the PPE
   station stands at the front left where you come in. The way to the racking aisle is the opening on the right. */
INDA.G = {
  dock: { D1: [-5.82, -3.02], D2: [-1.4, 1.4], D3: [3.02, 5.82], dh: 3.3, rack: { x0: -5.9, x1: -4.0, z: 7.4 }, aid: [8.5, 9.4, 1.25, 2.15], charger: [12.3, 15.8], toRacks: [10, 12.8] }
};
(() => {
  const { txt, R } = INDA, G = INDA.G.dock;
  /* the yard outside an open dock door: sky, a fence, far trailers, a light pole, and the asphalt four feet down */
  function yard(g, r, xa, xb, top) {
    const zb = r.box.zb, op = Q.back(r.box, xa, xb, 0, top), b = polyBox(op), T = Decor.time;
    clipDo(g, op, () => {
      const sky = g.createLinearGradient(0, b.y0, 0, CAM.hy); sky.addColorStop(0, T.sky[0]); sky.addColorStop(.8, T.sky[1]); sky.addColorStop(1, T.sky[2]);
      g.fillStyle = sky; g.fillRect(b.x0, b.y0, b.x1 - b.x0, CAM.hy - b.y0 + 1);
      const ground = -1.7, far = z => P(0, ground, z)[1];
      for (const [x0, x1, z, h, c] of [[-46, -14, 150, 5, '#8a8678'], [6, 34, 170, 4, '#9a8e7a'], [-9, 3, 130, 3, '#7a7e86']]) fillPoly(g, [P(x0, ground, z), P(x1, ground, z), P(x1, ground + h, z), P(x0, ground + h, z)], mix(c, T.sky[1], .35));   // warehouses across the street
      R(g, b.x0, far(400) - 1, b.x1 - b.x0, b.y1 - far(400) + 2, '#5a5c60');                                                                // asphalt
      speckle(g, b.x0, far(400), b.x1 - b.x0, b.y1 - far(400), 'rgba(0,0,0,0.25)', 120, 5);
      for (let x = -12; x <= 12; x += 3.2) lineW(g, P(x, ground, 22), P(x, ground, 60), '#d8c860');                                         // parking stripes
      for (const [x, z] of [[-9, 46], [5, 52]]) {                                                                                           // trailers parked in the yard
        const a = P(x - 1.3, ground + .4, z), c = P(x + 1.3, ground + 4.1, z); R(g, a[0], c[1], c[0] - a[0], a[1] - c[1], '#e8e8e2'); R(g, a[0], c[1], c[0] - a[0], 1, '#ffffff');
        R(g, a[0] + 1, a[1], 2, 2, '#1d1f26'); R(g, c[0] - 3, a[1], 2, 2, '#1d1f26'); R(g, a[0], (a[1] + c[1]) / 2, c[0] - a[0], 1, '#c8202a');
      }
      for (let x = -40; x < 40; x += 1.2) { const p = P(x, ground, 70), q = P(x, ground + 2.6, 70); pxLine(g, p[0], p[1], q[0], q[1], 'rgba(120,124,130,0.5)'); }   // chain-link fence
      { const p = P(-30, ground + 2.6, 70), q = P(30, ground + 2.6, 70); pxLine(g, p[0], p[1], q[0], q[1], '#7a7e86'); }
      { const p = P(3.2, ground, 34), q = P(3.2, ground + 9, 34); pxLine(g, p[0], p[1], q[0], q[1], '#5a5e66'); R(g, q[0] - 3, q[1], 5, 2, '#3a3c42'); R(g, q[0] - 2, q[1] + 2, 3, 1, T.id === 'golden' || T.rain ? '#ffe0a0' : '#c8ccd0'); }   // a yard light
    });
  }
  /* black foam dock seals around an opening, the door number above, and the roll-up door's hood */
  function seals(g, r, xa, xb, h, n) {
    fillPoly(g, Q.back(r.box, xa - .38, xa, 0, h + .38), '#24262c'); fillPoly(g, Q.back(r.box, xb, xb + .38, 0, h + .38), '#24262c'); fillPoly(g, Q.back(r.box, xa - .38, xb + .38, h, h + .38), '#2c2e34');
    for (let y = .4; y < h; y += .5) { lineW(g, P(xa - .38, y, r.box.zb), P(xa, y, r.box.zb), '#34363e'); lineW(g, P(xb, y, r.box.zb), P(xb + .38, y, r.box.zb), '#34363e'); }
    fillPoly(g, Q.back(r.box, xa - .5, xb + .5, h + .38, h + .75), '#8a8e96'); lineW(g, P(xa - .5, h + .75, r.box.zb), P(xb + .5, h + .75, r.box.zb), '#b8bcc4');   // the coil hood
    const c = polyBox(Q.back(r.box, (xa + xb) / 2 - .3, (xa + xb) / 2 + .3, h + .85, h + 1.35)); R(g, c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0, '#f2c418'); txt(g, n, c.cx + 1, c.y0 + 2, '#1d1f26', 1, 'c');
  }
  /* the dock's yellow edge stripe across a doorway (worn to almost nothing when faded) */
  function edgeStripe(g, r, xa, xb, faded) {
    const zb = r.box.zb;
    for (let x = xa, k = 0; x < xb; x += .25, k++) fillPoly(g, Q.floor(x, Math.min(xb, x + .25), zb - .3, zb), k % 2 ? (faded ? '#8e8a78' : '#1d1f26') : (faded ? '#b8ae7a' : '#f2c418'));
  }
  /* a leveler deck in front of a doorway: diamond plate, a yellow-striped front edge */
  function leveler(g, r, xa, xb, v) {
    const zb = r.box.zb, z0 = zb - 2.3;
    fillPoly(g, Q.floor(xa - .1, xb + .1, z0 - .05, zb), '#4a4c52');                                                       // the pit frame
    fillPoly(g, Q.floor(xa, xb, z0, zb), v === 2 ? '#7e838c' : '#868b94');
    for (let z = z0 + .15, k = 0; z < zb; z += .22, k++) for (let x = xa + .1 + (k % 2) * .15; x < xb - .1; x += .3) { const p = P(x, 0, z); pxRect(g, p[0], p[1], 1, 1, '#a4a9b2'); }
    for (const x of [xa, xb]) lineW(g, P(x, 0, z0), P(x, 0, zb), '#2a2c30');
    if (v === 1) for (const x of [xa - .08, xb + .02]) for (let i = 0; i < 6; i++) { const p = P(x + hash(i + x) * .06, 0, z0 + .2 + i * .35); pxRect(g, p[0], p[1], 2, 1, i % 2 ? '#e8ecf0' : '#c8a070'); }   // wrap and pallet chips in the pit gaps
    if (v === 2) { const a = P(xa + .5, 0, z0 + .4), b = P(xb - .8, 0, z0 + 1.3); pxLine(g, a[0], a[1], b[0], b[1], '#c8ccd2'); pxLine(g, a[0], a[1] + 1, b[0], b[1] + 1, '#4a4e56'); fillPoly(g, Q.floor(xb, xb + .12, z0 + .2, z0 + 1.1), '#1a1a1e'); }   // a forklift gouge, and a torn toe guard
    if (v === 3) { const a = P(xa + .1, .01, zb - .35), b = P(xb - .1, .01, zb - .3); pxLine(g, a[0], a[1], b[0], b[1], '#1a1a1e'); pxLine(g, a[0] + 4, a[1] - 1, b[0] - 10, b[1], '#2a2a2e'); }   // the crack along the lip hinge
  }
  INDA.dock = {
    walls(g, r) {
      const zb = r.box.zb, [a1, b1] = G.D1, [a2, b2] = G.D2, [a3, b3] = G.D3, h = G.dh;
      // painted floor markings: a yellow pedestrian walkway from the entrance to the racking aisle, and hatching in front of the chargers
      for (const z of [7.9, 8.5]) for (let x = -3.4; x < 6.4; x += .5) fillPoly(g, Q.floor(x, x + .4, z, z + .08), '#d8b828');
      for (let z = 12.4; z < 15.8; z += .5) { const a = P(-4.6, 0, z), b = P(-3.9, 0, z + .5); pxLine(g, a[0], a[1], b[0], b[1], '#d8b828'); }
      lineW(g, P(-3.8, 0, 12.3), P(-3.8, 0, 15.9), '#d8b828');
      // ---- door 1: rolled up on the empty yard (the dock edge feature) ----
      const dv = cond('i_dockdoor');
      seals(g, r, a1, b1, h, '1');
      yard(g, r, a1, b1, h);
      fillPoly(g, Q.back(r.box, a1, b1, h - .25, h), '#9aa0a8'); lineW(g, P(a1, h - .25, zb), P(b1, h - .25, zb), '#5a5e66');   // the door's bottom bar, rolled up
      edgeStripe(g, r, a1, b1, dv === 1);
      leveler(g, r, a1 + .3, b1 - .3, 0);
      if (dv === 0 || dv === 1) {                                                                                                // the dock's swing gate
        for (const x of [a1 + .05, b1 - .2]) box3(g, x, x + .15, 0, 1.9, zb - .3, zb - .15, { front: '#e0b020', side: '#a88010' });
        if (dv === 0) for (const y of [.9, 1.65]) { for (let x = a1 + .2, k = 0; x < b1 - .2; x += .3, k++) fillPoly(g, Q.back({ ...r.box, zb: zb - .25 }, x, Math.min(b1 - .2, x + .3), y, y + .14), k % 2 ? '#1d1f26' : '#f2c418'); }
        else for (const y of [.9, 1.65]) { const p = P(a1 + .12, y, zb - .25), q = P(a1 + 1.1, y - .1, zb - 2.6); pxLine(g, p[0], p[1], q[0], q[1], '#f2c418', 3); pxLine(g, p[0], p[1] + 2, q[0], q[1] + 2, '#a88010'); }   // swung back into the dock, unlatched
      }
      if (dv === 3) {                                                                                                             // a loaded pallet left hanging over the open edge, tire tracks right up to it
        for (const dx of [-.5, .5]) { const a = P(a1 + 1.7 + dx, 0, zb - 3.4), b = P(a1 + 1.7 + dx, 0, zb - .2); pxLine(g, a[0], a[1], b[0], b[1], 'rgba(30,30,34,0.45)', 2); }
        box3(g, a1 + .9, a1 + 2.5, 0, .2, zb - .7, zb + .5, { front: '#b08850', top: '#c8a068', side: '#8a6a3a' });
        box3(g, a1 + 1, a1 + 2.4, .2, 1.3, zb - .6, zb + .4, { front: '#c8a878', top: '#dcc090', side: '#a88858' });
        lineW(g, P(a1 + 1, .75, zb - .6), P(a1 + 2.4, .75, zb - .6), '#a88858');
      }
      // ---- door 2: a trailer backed in, its leveler lip resting on the trailer bed ----
      const rv = cond('i_restraint'), lv = cond('i_leveler'), creep = rv === 3;
      seals(g, r, a2, b2, h, '2');
      fillPoly(g, Q.back(r.box, a2, b2, 0, h), '#1e2024');
      { const z0 = zb + (creep ? .7 : .15), z1 = zb + 18, w = 1.2, top = 3.05;                                                  // the trailer's inside: plank floor, ribbed walls, a translucent roof
        const op = Q.back(r.box, a2, b2, 0, h);
        clipDo(g, op, () => {
          fillPoly(g, [P(-w, top, z0), P(w, top, z0), P(w, top, z1), P(-w, top, z1)], '#d8dce0');
          fillPoly(g, [P(-w, 0, z0), P(-w, 0, z1), P(-w, top, z1), P(-w, top, z0)], '#b8bcc2'); fillPoly(g, [P(w, 0, z0), P(w, 0, z1), P(w, top, z1), P(w, top, z0)], '#c4c8ce');
          for (let z = z0 + .8; z < z1; z += 1.2) { lineW(g, P(-w, 0, z), P(-w, top, z), '#9aa0a8'); lineW(g, P(w, 0, z), P(w, top, z), '#a4a8b0'); }
          fillPoly(g, [P(-w, 0, z0), P(w, 0, z0), P(w, 0, z1), P(-w, 0, z1)], '#9a7a52'); for (let x = -w + .3; x < w; x += .3) lineW(g, P(x, 0, z0), P(x, 0, z1), '#7a5a3a');
          fillPoly(g, [P(-w, 0, z1), P(w, 0, z1), P(w, top, z1), P(-w, top, z1)], '#a8acb2');
          for (const [x, z] of [[-.6, z1 - 1.5], [.6, z1 - 1.5], [-.6, z1 - 3], [.6, z1 - 3.2]]) { box3(g, x - .5, x + .5, 0, .15, z - .5, z + .5, { front: '#a07a48', top: '#b08a58' }); box3(g, x - .48, x + .48, .15, 1.5, z - .48, z + .48, { front: 'rgba(214,220,226,0.92)', top: '#e8ecf0', side: '#c4cad2' }); }
          if (creep) fillPoly(g, Q.floor(-1.6, 1.6, zb, zb + .7), '#0c0c10');                                                     // the gap: the trailer has crept away from the dock
        });
        fillPoly(g, Q.back(r.box, a2, a2 + .1, 0, h), '#c8ccd2'); fillPoly(g, Q.back(r.box, b2 - .1, b2, 0, h), '#c8ccd2');       // the trailer's rear frame inside the seals
      }
      fillPoly(g, Q.back(r.box, a2, b2, h - .25, h), '#9aa0a8');
      leveler(g, r, a2 + .25, b2 - .25, lv);
      { const lip = creep ? .55 : .5, tilt = lv === 3 ? .12 : 0;                                                               // the hinged lip, out onto the trailer bed
        fillPoly(g, [P(a2 + .25, .02, zb), P(b2 - .25, .02, zb), P(b2 - .25, .02 - tilt, zb + lip), P(a2 + .25, .02, zb + lip)], '#7a7f88');
        lineW(g, P(a2 + .25, .02, zb + lip), P(b2 - .25, .02 - tilt, zb + lip), '#c8ccd2'); }
      // the leveler's push-button box and the restraint's light box, on the wall beside door 2
      { const q = Q.back(r.box, b2 + .52, b2 + .92, .9, 1.4); fillPoly(g, q, '#8e939c'); const c = polyBox(q); pxRect(g, c.cx - 1, c.y0 + 2, 2, 2, '#2a8a3a'); pxRect(g, c.cx - 1, c.y0 + 5, 2, 2, '#c8202a'); }
      { const q = Q.back(r.box, b2 + .52, b2 + .92, 1.6, 2.4); fillPoly(g, q, '#24262c'); const c = polyBox(q), red = rv >= 2;
        pxRect(g, c.cx - 2, c.y0 + 2, 4, 3, red ? '#ff3a30' : '#5a1a18'); pxRect(g, c.cx - 2, c.y0 + 7, 4, 3, red ? '#1a3a1a' : '#40e060'); }
      // the swing-arm dock light, aimed into the trailer
      { const p = P(a2 - .6, 2.6, zb), q = P(a2 + .2, 2.4, zb - .8); pxLine(g, p[0], p[1], q[0], q[1], '#3a3c42', 2); pxRect(g, q[0] - 3, q[1] - 2, 6, 4, '#f2c418'); pxRect(g, q[0] - 2, q[1] + 2, 4, 1, '#fff6d0'); }
      // ---- door 3: shut ----
      seals(g, r, a3, b3, h, '3');
      fillPoly(g, Q.back(r.box, a3, b3, 0, h), '#c4c8ce');
      for (let y = .2; y < h; y += .22) lineW(g, P(a3, y, zb), P(b3, y, zb), '#9ca2aa');
      for (let x = a3 + .4; x < b3 - .3; x += .7) fillPoly(g, Q.back(r.box, x, x + .4, 2.2, 2.38), '#3a4a5a');                  // its row of little windows
      fillPoly(g, Q.back(r.box, a3, b3, 0, .1), '#24262c');
      leveler(g, r, a3 + .3, b3 - .3, 0); edgeStripe(g, r, a3, b3, false); edgeStripe(g, r, a2, b2, false);
      { const p = P(b3 - .4, 1.0, zb), q = P(b3 - .4, 2.0, zb); pxLine(g, p[0], p[1], q[0], q[1], '#c8a070'); }                  // pull rope
      // dock rules sign, between doors 1 and 2
      INDA.wallSign(g, r, -2.5, -1.92, 1.5, 2.3, '#2a5aa8', '');
      { const c = polyBox(Q.back(r.box, -2.5, -1.92, 1.5, 2.3)); for (let i = 0; i < 4; i++) pxRect(g, c.x0 + 2, c.y0 + 5 + i * 2, c.x1 - c.x0 - 4, 1, '#8a8e96'); }
      // ---- the right wall: the first aid cabinet and an extinguisher; the left wall: the battery chargers ----
      { const [za, zb2, ya, yb] = G.aid, av = cond('i_firstaid'), x1 = r.box.x1;
        fillPoly(g, Q.right(r.box, za, zb2, ya, yb), '#f4f4ee'); strokePoly(g, Q.right(r.box, za, zb2, ya, yb), '#8a8e96');
        const c = polyBox(Q.right(r.box, za, zb2, ya + .25, yb - .2)); pxRect(g, c.cx - 1, c.y0 + 2, 3, c.y1 - c.y0 - 4, '#2a9a4a'); pxRect(g, c.cx - 4, c.cy - 1, 9, 3, '#2a9a4a');
        if (av === 2) { fillPoly(g, Q.right(r.box, za + .05, zb2 - .05, ya + .05, yb - .05), '#d8d8d0'); for (const y of [ya + .3, ya + .6]) lineW(g, P(x1, y, za), P(x1, y, zb2), '#a8aca8');   // its door hangs open on a near-empty box
          const d = [P(x1, ya, za), P(x1 - .8, ya, za - .3), P(x1 - .8, yb, za - .3), P(x1, yb, za)]; fillPoly(g, d, '#e8e8e2'); strokePoly(g, d, '#8a8e96'); } }
      INDA.extinguisherSide(g, r, 'right', 13.6);
      { const [za, zb2] = G.charger, x0 = r.box.x0, cv = cond('i_charger');
        for (const z of [12.5, 13.7]) { fillPoly(g, Q.left(r.box, z, z + .8, 1.3, 2.5), '#9aa0a8'); fillPoly(g, Q.left(r.box, z + .1, z + .7, 2.1, 2.35), '#2a3a2a'); const p = P(x0, 2.22, z + .4); pxRect(g, p[0], p[1], 2, 1, '#60e060'); }
        fillPoly(g, Q.left(r.box, 12.4, 14.6, 2.75, 3.15), '#c8202a'); { const c = polyBox(Q.left(r.box, 12.4, 14.6, 2.75, 3.15)); pxRect(g, c.x0 + 2, c.cy - 1, c.x1 - c.x0 - 4, 1, '#ffffff'); }
        // the spare battery on its stand, cabled to the charger
        box3(g, x0 + .1, x0 + 1.3, 0, .25, 12.8, 14.3, { front: '#3a3c42', top: '#4a4c52', side: '#2a2c30' });
        box3(g, x0 + .15, x0 + 1.25, .25, 1.15, 12.85, 14.25, { front: cv === 3 ? '#4a4e44' : '#3a5a8a', top: '#2a2c30', side: '#2a4a72' });
        for (let z = 13, k = 0; z < 14.2; z += .24, k++) { const p = P(x0 + .45 + (k % 2) * .4, 1.16, z); pxRect(g, p[0], p[1], 2, 1, k % 2 ? '#c8202a' : '#1a1a1e'); }
        if (cv === 1 || cv === 3) speckle(g, ...(() => { const a = P(x0 + .2, 1.16, 13), b = P(x0 + 1.2, 1.16, 14.2); return [Math.min(a[0], b[0]), Math.min(a[1], b[1]) - 1, Math.abs(b[0] - a[0]) + 2, 3]; })(), '#f4f4ec', 26, 3);
        if (cv === 3) { const p = P(x0 + 1.25, .7, 12.85); fillPoly(g, blobPts(p[0] + 1, p[1], 3, 5, 9, .3, 10), '#4a4e44'); }       // the case bulging
        { const a = P(x0, 1.9, 13.1), b = P(x0 + .7, 1.16, 13.4); pxLine(g, a[0], a[1], b[0], b[1], '#1a1a1e', 2); }
        // the eyewash station at the end of the run, and the spill kit
        fillPoly(g, Q.left(r.box, 15, 15.55, 1.0, 1.9), '#2a9a4a'); { const c = polyBox(Q.left(r.box, 15, 15.55, 1.0, 1.9)); pxRect(g, c.x0 + 1, c.y0 + 2, Math.max(1, c.x1 - c.x0 - 2), 2, '#ffffff'); }
        fillPoly(g, Q.left(r.box, 15.05, 15.5, 2.0, 2.3), '#2a9a4a');
        box3(g, x0 + .1, x0 + .55, 0, .6, 14.5, 14.85, { front: '#f2c418', top: '#1d1f26', side: '#c89a10' });
        if (cv === 2) { box3(g, x0 + .05, x0 + 1.25, 0, .18, 14.8, 15.8, { front: '#a07a48', top: '#b08a58', side: '#8a6a3a' }); box3(g, x0 + .05, x0 + 1.25, .18, .36, 14.8, 15.8, { front: '#9a7444', top: '#b08a58', side: '#86663a' }); box3(g, x0 + .05, x0 + 1.25, .36, .54, 14.8, 15.8, { front: '#a07a48', top: '#b89260', side: '#8a6a3a' }); box3(g, x0 + .1, x0 + 1.2, .54, 1.5, 14.85, 15.75, { front: '#c8a878', top: '#dcc090', side: '#a88858' }); }
        // yellow bollards guarding the chargers
        for (const z of [12.4, 13.5, 14.6]) { box3(g, x0 + 1.55, x0 + 1.75, 0, 1.2, z, z + .2, { front: '#f2c418', top: '#1d1f26', side: '#c89a10' }); const p = P(x0 + 1.65, 1, z); pxRect(g, p[0] - 1, p[1], 3, 1, '#1d1f26'); }
      }
      // ---- the way through to the racking aisle ----
      INDA.opening(g, r, 'right', G.toRacks[0], G.toRacks[1], 3.8, '#7a7c80', '#94948c');
      { const q = Q.right(r.box, G.toRacks[0] + .3, G.toRacks[1] - .3, .3, 3.0); clipDo(g, q, () => { for (let z = G.toRacks[0]; z < G.toRacks[1]; z += .9) { fillPoly(g, Q.right({ ...r.box, x1: r.box.x1 + 3 }, z, z + .1, 0, 3.4), '#2a5a9a'); } for (const y of [1, 2.2]) fillPoly(g, Q.right({ ...r.box, x1: r.box.x1 + 3 }, G.toRacks[0], G.toRacks[1], y, y + .15), '#e07a20'); }); }   // the racks, glimpsed through it
      // ---- the forklift ----
      INDA.forklift(g, cond('i_forklift'));
      // ---- dock floor housekeeping: the turning lane in front of doors 1 and 2 ----
      INDA.dockFloor(g, cond('i_dockfloor'));
      // ---- the PPE station by the entrance (the gear on it is drawn live, so it vanishes as you put it on) ----
      { const { x0, x1, z } = G.rack;
        for (const x of [x0 + .05, x1 - .15]) box3(g, x, x + .1, 0, 2.7, z, z + .1, { front: '#7a7e86', side: '#5a5e66' });
        box3(g, x0, x1, .45, 2.6, z + .05, z + .12, { front: '#d8c8a0', side: '#b8a880' });                                            // pegboard
        for (let y = .6; y < 2.5; y += .15) for (let x = x0 + .12; x < x1 - .05; x += .15) { const p = P(x, y, z + .05); pxRect(g, p[0], p[1], 1, 1, '#a89870'); }
        box3(g, x0, x1, 2.6, 2.95, z + .05, z + .12, { front: '#2a8a4a', side: '#1a6a3a' }); { const c = P((x0 + x1) / 2, 2.85, z + .05); txt(g, 'PPE STATION', c[0], c[1] + 1, '#ffffff', 1, 'c'); }
        box3(g, x0, x1, 1.95, 2.02, z - .25, z + .05, { front: '#5a5e66', top: '#8a8e96' });                                           // a shelf
        box3(g, x0, x1, .05, .1, z - .35, z + .05, { front: '#5a5e66', top: '#7a7e86' });                                              // the boot tray
        { const q = [P(x1 - .62, 2.08, z + .04), P(x1 - .08, 2.08, z + .04), P(x1 - .08, 2.55, z + .04), P(x1 - .62, 2.55, z + .04)]; fillPoly(g, q, '#f6f4ec'); strokePoly(g, q, '#3a3a40'); const c = polyBox(q); pxRect(g, c.x0 + 1, c.y0 + 1, c.x1 - c.x0 - 2, 3, '#2a5aa8'); for (let i = 0; i < 3; i++) pxRect(g, c.x0 + 2, c.y0 + 6 + i * 2, c.x1 - c.x0 - 4, 1, '#8a8e96'); }   // a posted notice: what's required past here
      }
      // high-bay lights
      for (const [x, z] of [[-4.5, 12.5], [0, 12.5], [4.5, 12.5], [-4.5, 15], [0, 15], [4.5, 15]]) INDA.highbay(g, r, x, z, !(Anomalies.active('i_dock').some(a => a.id === 'i_a_lamp') && x === 4.5 && z === 12.5), 1.1);
    },
    dynamic(g, r, t) {
      if (r.lightsOff) return;
      for (const [x, z] of [[-4.5, 12.5], [0, 12.5], [-4.5, 15], [0, 15], [4.5, 15]]) INDA.highbayGlow(g, r, x, z, 1.1, .1);
      if (!Anomalies.active('i_dock').some(a => a.id === 'i_a_lamp')) INDA.highbayGlow(g, r, 4.5, 12.5, 1.1, .1);
      { const q = P(-1.5, 2.4, r.box.zb - .8); softGlow(g, q[0] + 8, q[1] + 10, 30, 22, '#fff6d0', .14); }   // the dock light into the trailer
      INDA.ppeRack(g, r);
      if (cond('i_charger') === 3 && Settings.get('motion')) for (let i = 0; i < 3; i++) { const p = P(r.box.x0 + .7, 1.2, 13.3 + i * .3), k = (t * .6 + i / 3) % 1; pxRect(g, p[0] + Math.sin(t * 2 + i) * 2, p[1] - k * 14, 1, 1, `rgba(230,236,220,${.6 * (1 - k)})`); }   // fumes off the swollen battery
    }
  };
})();

/* ---------- the dock's forklift, parked side-on (forks to the left), and the turning lane's housekeeping ---------- */
INDA.G.dock.fork = { x0: .5, x1: 5.2, z0: 10, z1: 11.5 };
INDA.G.dock.ppe = {                     // where each piece sits on the PPE station: [xa, xb, ya, yb], on its front face
  hardhat: [-5.75, -5.1, 2.02, 2.36], glasses: [-4.95, -4.5, 2.02, 2.2], vest: [-4.75, -4.15, .95, 1.85], ears: [-5.75, -5.2, 1.2, 1.75], boots: [-5.6, -4.65, .1, .45]
};
INDA.forklift = function (g, v) {
  const { z0, z1 } = INDA.G.dock.fork, Y = '#f0b023', Yd = '#c8901a', Ys = '#a87010', K = '#24262c', fy = v === 3 ? 3.3 : .05;
  fillPoly(g, floorBlob(3.1, 10.75, 2.4, .85, 3, .15, 20), 'rgba(20,20,30,0.22)');
  if (v === 2) { fillPoly(g, floorBlob(1.9, 10.9, .75, .45, 21, .5, 16), 'rgba(40,30,20,0.6)'); fillPoly(g, floorBlob(1.85, 10.85, .45, .25, 23, .5, 12), 'rgba(90,70,40,0.55)'); const p = P(1.7, 0, 10.7); pxRect(g, p[0], p[1], 3, 1, 'rgba(200,180,255,0.6)'); }   // hydraulic fluid under the mast
  // the far fork tine and the far mast rail first
  box3(g, .55, 1.8, fy, fy + .1, z1 - .45, z1 - .3, { front: '#3a3c42', top: '#5a5c62' });
  const top = v === 3 ? 4.7 : 2.95;
  box3(g, 1.85, 2.05, .05, Math.min(2.95, top), z1 - .2, z1 - .1, { front: '#2a2c30' });
  // the mast: outer rails, and the inner rails run up out of them when the carriage is raised
  fillPoly(g, [P(1.85, .05, z0 + .1), P(2.05, .05, z0 + .1), P(2.05, 2.95, z0 + .1), P(1.85, 2.95, z0 + .1)], '#3a3c42');
  if (v === 3) fillPoly(g, [P(1.88, 2.4, z0 + .12), P(2.02, 2.4, z0 + .12), P(2.02, top, z0 + .12), P(1.88, top, z0 + .12)], '#4a4c52');
  for (const y of [.6, 1.8, 2.85]) lineW(g, P(1.85, y, z0 + .1), P(2.05, y, z0 + .1), '#5a5c62');
  { const a = P(2.12, .3, z0 + .3), b = P(2.12, Math.min(top, 2.8), z0 + .3); pxLine(g, a[0], a[1], b[0], b[1], '#c8ccd2'); }       // the lift cylinder's chrome rod
  // carriage, backrest, and the near tine
  fillPoly(g, [P(1.68, fy, z0 + .15), P(1.85, fy, z0 + .15), P(1.85, fy + 1.25, z0 + .15), P(1.68, fy + 1.25, z0 + .15)], '#2a2c30');
  for (let y = fy + .3; y < fy + 1.2; y += .3) lineW(g, P(1.68, y, z0 + .15), P(1.85, y, z0 + .15), '#4a4c52');
  box3(g, .55, 1.8, fy, fy + .1, z0 + .3, z0 + .45, { front: '#4a4c52', top: '#6a6c72', bottom: '#2a2c30' });
  if (v === 3) {                                                                                                    // a loose pallet up on the raised forks, someone's box cutter and pick list on it
    box3(g, .45, 1.75, fy + .1, fy + .3, z0 + .1, z1 - .1, { front: '#b08850', top: '#c8a068', bottom: '#8a6a3a', side: '#9a7440' });
    for (const x of [.6, 1.1, 1.55]) fillPoly(g, [P(x, fy + .1, z0 + .1), P(x + .12, fy + .1, z0 + .1), P(x + .12, fy + .3, z0 + .1), P(x, fy + .3, z0 + .1)], '#8a6a3a');
    { const p = P(1.1, fy + .3, z0 + .6); pxRect(g, p[0] - 3, p[1] - 1, 6, 2, '#f4f4ec'); pxRect(g, p[0] + 4, p[1] - 1, 3, 1, '#f2c418'); }
  }
  // the counterweight and the chassis
  box3(g, 4.55, 5.15, .3, 1.5, z0, z1, { front: '#34363c', top: '#44464c', side: '#2a2c30' });
  { const a = P(4.55, 1.5, z0), b = P(5.15, 1.5, z0); pxRect(g, a[0], a[1], b[0] - a[0], 1, '#5a5c62'); }
  box3(g, 2.2, 4.6, .3, 1.12, z0 + .05, z1 - .05, { front: Y, top: Yd, side: Ys });
  lineW(g, P(2.2, .78, z0 + .05), P(4.55, .78, z0 + .05), Ys);
  box3(g, 2.25, 2.95, 1.12, 1.5, z0 + .15, z1 - .15, { front: Yd, top: Y });                                                // the cowl and dash
  box3(g, 3.65, 4.3, 1.12, 1.42, z0 + .25, z1 - .25, { front: K, top: '#3a3c42' });                                         // the seat
  box3(g, 4.18, 4.4, 1.42, 2.05, z0 + .3, z1 - .3, { front: K });
  // the steering wheel, and the horn button in its middle
  { const a = P(2.95, 1.45, z0 + .7), b = P(3.2, 1.85, z0 + .7); pxLine(g, a[0], a[1], b[0], b[1], K, 2); pxEllipse(g, b[0], b[1], 4, 1, K); pxRect(g, b[0] - 1, b[1] - 1, 2, 1, '#c8202a'); }
  // wheels: the big drive wheel under the mast, the steer wheel under the counterweight
  for (const [x, y, rr] of [[2.85, .42, .42], [4.45, .36, .36]]) { const c = P(x, y, z0), s = 300 * rr / z0; pxEllipse(g, c[0], c[1], s, s, '#1a1a1e'); pxEllipse(g, c[0], c[1], s * .55, s * .55, '#8a8e96'); pxEllipse(g, c[0], c[1], s * .25, s * .25, '#4a4c52'); pxRect(g, c[0] - s * .4, c[1] - s * .4, 2, 1, '#c8ccd2'); }
  // the overhead guard: posts and a slatted roof
  for (const x of [2.55, 4.4]) { const a = P(x, 1.12, z0 + .05), b = P(x, 2.8, z0 + .05); pxLine(g, a[0], a[1], b[0], b[1], K, 2); }
  box3(g, 2.4, 4.6, 2.75, 2.88, z0, z1, { front: K, bottom: '#3a3c42' });
  for (let x = 2.6; x < 4.6; x += .3) lineW(g, P(x, 2.75, z0), P(x, 2.75, z1), '#1a1a1e');
  { const p = P(4.45, 2.88, z0 + .2); pxRect(g, p[0] - 1, p[1] - 3, 3, 3, '#f28c28'); }                                    // amber beacon
  // the capacity plate on the cowl, the mirror on the guard, and the checklist clipped to the post
  { const p = P(2.35, 1.38, z0 + .15); pxRect(g, p[0], p[1], 4, 3, v === 1 ? '#a8a49a' : '#d8dce0'); }
  { const p = P(2.5, 2.7, z0 - .1); pxRect(g, p[0] - 4, p[1] - 3, 4, 3, '#24262c'); pxRect(g, p[0] - 3, p[1] - 2, 2, 1, v === 1 ? '#6a7a8a' : '#a8c4d8'); if (v === 1) pxRect(g, p[0] - 4, p[1] - 1, 1, 1, '#ffffff'); }
  { const p = P(4.4, 1.85, z0); pxRect(g, p[0] - 2, p[1] - 1, 4, 1, '#5a5c62'); if (v === 0) { pxRect(g, p[0] - 2, p[1], 4, 5, '#f4f4ec'); pxRect(g, p[0] - 1, p[1] + 2, 2, 1, '#8a8e96'); } }
  { const p = P(3.85, .55, z0 + .05); INDA.txt(g, 'FL-2', p[0], p[1], '#1d1f26', 1, 'c'); }
};
INDA.dockFloor = function (g, v) {
  const pallet = (x0, x1, y0, z0, z1, c = '#b08850') => { box3(g, x0, x1, y0, y0 + .14, z0, z1, { front: c, top: mix(c, '#ffffff', .15), side: mix(c, '#000000', .15) }); for (let x = x0 + .1; x < x1; x += .42) lineW(g, P(x, y0 + .14, z0), P(x, y0 + .14, z1), mix(c, '#000000', .3)); };
  if (v === 3) { fillPoly(g, floorBlob(-1.7, 10.2, 1.8, .75, 41, .45, 22), 'rgba(24,20,16,0.55)'); fillPoly(g, floorBlob(-1.8, 10.2, 1.3, .5, 43, .45, 18), 'rgba(60,50,30,0.5)');
    for (const [dx, c] of [[-.5, 'rgba(200,120,220,0.6)'], [0, 'rgba(120,200,220,0.6)'], [.6, 'rgba(230,210,120,0.55)']]) { const a = P(-2.1 + dx, 0, 9.9), b = P(-1.6 + dx, 0, 10.1); pxLine(g, a[0], a[1], b[0], b[1], c); }
    for (const dx of [-.4, .4]) { const a = P(-3.4 + dx, 0, 11.4), b = P(.2 + dx, 0, 9.2); pxLine(g, a[0], a[1], b[0], b[1], 'rgba(20,16,12,0.5)', 2); } }   // tire tracks smeared through it
  if (v === 2) {                                                                                                      // broken pallets in a heap, nails up, and a stack leaning hard
    for (let i = 0; i < 8; i++) { const x = -4 + hash(i + 2) * 3, z = 9 + hash(i + 7) * 1.6, a = P(x, .02 + hash(i) * .1, z), b = P(x + .5 + hash(i + 3) * .4, .02, z + (hash(i + 4) - .5) * .5); pxLine(g, a[0], a[1], b[0], b[1], i % 2 ? '#b08850' : '#9a7444', 3); pxRect(g, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 3, 1, 3, '#c8ccd2'); }
    for (let k = 0; k < 6; k++) pallet(-3.6 + k * .08, -2.4 + k * .08, k * .15, 9.9, 10.9, k % 2 ? '#a07c48' : '#b08850');
  } else for (let k = 0; k < 5; k++) pallet(-3.6, -2.4, k * .15, 9.9, 10.9, k % 2 ? '#a07c48' : '#b08850');
  if (v !== 2) { box3(g, -2.0, -1.5, 0, .7, 10.3, 10.7, { front: '#2a5aa8', top: '#1d2a48', side: '#22488a' }); const p = P(-1.75, .7, 10.5); pxRect(g, p[0] - 2, p[1] - 3, 1, 3, '#24262c'); pxRect(g, p[0] + 1, p[1] - 2, 1, 2, '#24262c'); }   // a bin for banding and wrap
  if (v === 1) {                                                                                                      // shrink wrap and strapping all over the lane
    for (let i = 0; i < 9; i++) { const x = -4 + hash(i + 11) * 4, z = 8.9 + hash(i + 17) * 2.4, p = P(x, 0, z); fillPoly(g, blobPts(p[0], p[1], 4 + hash(i) * 3, 1.5, i * 3 + 1, .7, 9), 'rgba(236,240,244,0.8)'); pxRect(g, p[0] - 2, p[1], 3, 1, '#ffffff'); }
    for (let i = 0; i < 3; i++) { const a = P(-3.8 + i * 1.2, 0, 9 + i * .4), b = P(-2.8 + i * 1.2, 0, 9.5 + i * .3), c = P(-2.2 + i * 1.2, 0, 9.1 + i * .4); pxLine(g, a[0], a[1], b[0], b[1], '#24262c'); pxLine(g, b[0], b[1], c[0], c[1], '#24262c'); }
  }
};
/* the PPE station's gear, drawn live: each piece disappears from the board once you've put it on */
INDA.ppeRack = function (g, r) {
  const S = INDA.G.dock.ppe, z = INDA.G.dock.rack.z - .02, q = ([xa, xb, ya, yb]) => polyBox([P(xa, ya, z), P(xb, ya, z), P(xb, yb, z), P(xa, yb, z)]);
  if (!PPE.has('hardhat')) { const b = q(S.hardhat); for (const [dx, c] of [[0, '#f4f4ee'], [(b.x1 - b.x0) * .52, '#f4f4ee']]) { const w = (b.x1 - b.x0) * .46, cx = b.x0 + dx + w / 2; pxEllipse(g, cx, b.y1 - 4, w / 2, (b.y1 - b.y0) * .55, c); pxRect(g, cx - w / 2 - 1, b.y1 - 2, w + 2, 2, '#d8d8d0'); pxRect(g, cx - w / 4, b.y0 + 3, 2, 2, '#ffffff'); pxRect(g, cx - 1, b.y1 - 6, 2, 2, '#2a8a4a'); } }
  if (!PPE.has('glasses')) { const b = q(S.glasses); pxRect(g, b.x0, b.y0 + 1, b.x1 - b.x0, b.y1 - b.y0 - 1, '#e8e4d8'); pxRect(g, b.x0, b.y0 + 1, b.x1 - b.x0, 2, '#2a5aa8'); for (let x = b.x0 + 1; x < b.x1 - 3; x += 4) { pxRect(g, x, b.y0 - 1, 3, 2, '#bfe3f4'); pxRect(g, x, b.y0 - 1, 1, 1, '#ffffff'); } }
  if (!PPE.has('vest')) { const b = q(S.vest), w = b.x1 - b.x0, h = b.y1 - b.y0; fillPoly(g, [[b.x0 + w * .2, b.y0], [b.x0 + w * .38, b.y0], [b.x0 + w * .5, b.y0 + h * .25], [b.x0 + w * .62, b.y0], [b.x0 + w * .8, b.y0], [b.x1, b.y0 + h * .3], [b.x1, b.y1], [b.x0, b.y1], [b.x0, b.y0 + h * .3]], '#f28c28');
    pxRect(g, b.x0, b.y0 + h * .55, w, 2, '#d8dce0'); pxRect(g, b.x0, b.y0 + h * .8, w, 2, '#d8dce0'); pxRect(g, b.x0 + w * .48, b.y0 + h * .25, 1, h * .75, '#c86a18'); pxRect(g, b.x0 + w * .45, b.y0 - 2, 2, 2, '#5a5e66'); }
  if (!PPE.has('ears')) { const b = q(S.ears), w = b.x1 - b.x0, h = b.y1 - b.y0;          // a clear foam-plug dispenser full of orange plugs, a pair of yellow muffs hung beside it
    pxRect(g, b.x0, b.y0 + h * .35, w * .55, h * .65, '#d8e4ea'); for (let i = 0; i < 6; i++) pxRect(g, b.x0 + 1 + (i % 3) * 2, b.y0 + h * .45 + Math.floor(i / 3) * 3, 1, 2, '#f28c28'); pxRect(g, b.x0, b.y1 - 2, w * .55, 2, '#5a5e66');
    const mx = b.x0 + w * .78; pxLine(g, mx - 3, b.y0 + 4, mx, b.y0, '#24262c'); pxLine(g, mx, b.y0, mx + 3, b.y0 + 4, '#24262c'); pxRect(g, mx - 4, b.y0 + 4, 3, 5, '#f2c418'); pxRect(g, mx + 2, b.y0 + 4, 3, 5, '#f2c418'); }
  if (!PPE.has('boots')) { const b = q(S.boots), w = (b.x1 - b.x0) / 2; for (const x of [b.x0, b.x0 + w + 1]) { pxRect(g, x + 1, b.y0, w * .45, b.y1 - b.y0 - 2, '#7a4a24'); pxRect(g, x + 1, b.y1 - 4, w - 2, 3, '#7a4a24'); pxRect(g, x + 1, b.y1 - 1, w - 1, 1, '#24262c'); pxRect(g, x + 2, b.y0 + 1, 2, 1, '#c8a070'); } }
};

/* ============================== CLOSE-UPS ==============================
   240x135, one per feature, every variant drawn: the art reads cond v, the flags you've set (fl), and the time t.
   Zoom art keys are the feature ids (i_...), so they can never collide with the apartment's or another site's. */
INDA.ZOOM_ART = {};
(() => {
  const { txt, R, concrete, cmu, ribbed, tread, stripes, bolt, sign } = INDA, ZA = INDA.ZOOM_ART;
  const wallOf = room => Decor.pal(room).wall;
  const skyGrad = (g, y0, y1) => { const T = Decor.time, gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, T.sky[0]); gr.addColorStop(.75, T.sky[1]); gr.addColorStop(1, T.sky[2]); return gr; };
  /* a wooden pallet seen from the front: top deck, three blocks or stringers, gaps between */
  const pallet = (g, x, y, w, h = 8, c = '#b08850') => { R(g, x, y, w, 2, mix(c, '#ffffff', .15)); R(g, x, y + 2, w, h - 4, mix(c, '#000000', .45)); for (const k of [0, .5, 1]) R(g, x + Math.round((w - 8) * k), y + 2, 8, h - 4, c); R(g, x, y + h - 2, w, 2, mix(c, '#000000', .15)); };
  /* a stack of cartons, shrink-wrapped, on a pallet */
  const load = (g, x, y, w, h, seed = 1) => {
    R(g, x, y, w, h, '#c8a070'); for (let yy = y; yy < y + h; yy += 11) { R(g, x, yy, w, 1, '#9a7448'); for (let xx = x + ((yy - y) / 11 % 2 ? 9 : 0); xx < x + w; xx += 18) R(g, xx, yy, 1, Math.min(11, y + h - yy), '#9a7448'); }
    g.fillStyle = 'rgba(230,236,244,0.28)'; g.fillRect(x, y, w, h); for (let i = 0; i < 5; i++) pxLine(g, x + hash(seed + i) * w, y, x + hash(seed + i + 9) * w, y + h, 'rgba(255,255,255,0.35)');
  };

  /* ---------------- LOADING DOCK ---------------- */
  ZA.i_dockdoor = (g, v, fl, t) => {
    cmu(g, 0, 0, ZW, 112, wallOf('i_dock'), 3);
    // the yard, four feet down, through the opening
    g.fillStyle = skyGrad(g, 9, 52); g.fillRect(44, 9, 152, 44);
    for (const [x, w, h, c] of [[46, 46, 8, '#8a8678'], [104, 30, 5, '#7a7e86'], [150, 46, 10, '#9a8e7a']]) R(g, x, 52 - h, w, h, mix(c, Decor.time.sky[1], .3));   // buildings across the street
    for (let x = 44; x < 196; x += 3) R(g, x, 44, 1, 9, 'rgba(110,116,124,0.55)'); R(g, 44, 44, 152, 1, '#7a7e86');   // chain-link fence
    R(g, 44, 52, 152, 58, '#5a5c60'); speckle(g, 44, 52, 152, 58, 'rgba(0,0,0,0.3)', 400, 4); speckle(g, 44, 52, 152, 58, 'rgba(255,255,255,0.08)', 200, 5);
    for (const x of [-60, -10, 40, 90]) pxLine(g, 120 + x * .25, 53, 120 + x * 1.6, 110, '#d8c860');   // parking stripes running off toward the fence
    { R(g, 70, 54, 22, 18, '#e8e8e2'); R(g, 70, 54, 22, 1, '#ffffff'); R(g, 70, 66, 22, 1, '#c8202a'); R(g, 72, 72, 4, 3, '#1d1f26'); R(g, 85, 72, 4, 3, '#1d1f26'); }   // a trailer waiting across the yard
    { pxLine(g, 168, 52, 168, 16, '#5a5e66'); R(g, 163, 14, 10, 3, '#3a3c42'); R(g, 164, 17, 8, 1, '#e8e4c8'); }
    if (Decor.time.rain) for (let i = 0; i < 30; i++) { const x = 44 + hash(i) * 152, y = 9 + ((hash(i + 3) * 100 + t * 90) % 100); pxLine(g, x, y, x - 1, y + 3, 'rgba(220,232,245,0.6)'); }
    // the roll-up door, rolled all the way up: its hood and bottom bar
    R(g, 0, 0, ZW, 6, '#8a8e96'); R(g, 0, 5, ZW, 1, '#5a5e66'); R(g, 44, 6, 152, 4, '#9aa0a8'); R(g, 44, 9, 152, 1, '#4a4e56');
    // black foam dock seals down both sides
    for (const x of [28, 196]) { R(g, x, 6, 16, 106, '#24262c'); for (let y = 12; y < 110; y += 10) R(g, x, y, 16, 1, '#34363e'); R(g, x + (x < 100 ? 15 : 0), 6, 1, 106, '#3a3c44'); }
    // the edge: steel nosing, the painted stripe, and the leveler stored flat in front
    R(g, 44, 106, 152, 5, '#6a6e76'); R(g, 44, 106, 152, 1, '#a8acb4');
    concrete(g, 0, 112, ZW, 23, '#a8a69e', 6);
    if (v === 1) stripes(g, 30, 111, 180, 8, '#b8ae7a', '#7e7a6a', 6); else stripes(g, 30, 111, 180, 8, '#f2c418', '#1d1f26', 6);
    tread(g, 50, 120, 140, 15, '#868b94'); R(g, 50, 120, 140, 1, '#4a4c52');
    { R(g, 218, 18, 16, 22, '#f2c418'); txt(g, '1', 227, 21, '#1d1f26', 3, 'c'); }                                                    // the door number
    if (v === 0 || v === 1) {                                                                                                          // the swing gate
      for (const x of [22, 206]) { R(g, x, 50, 8, 70, '#f2c418'); for (let y = 54; y < 120; y += 12) R(g, x, y, 8, 5, '#1d1f26'); R(g, x, 50, 8, 2, '#ffe27a'); }
      if (v === 0) { for (const y of [60, 84]) { stripes(g, 30, y, 176, 5, '#f2c418', '#1d1f26', 5); R(g, 30, y, 176, 1, '#ffe27a'); R(g, 30, y + 5, 176, 1, '#8a6a10'); }
        R(g, 200, 80, 8, 10, '#5a5e66'); R(g, 203, 76, 2, 6, '#c8ccd2'); }                                                                // latched, pin home
      else { for (const [y0, y1] of [[60, 74], [84, 104]]) { for (let k = 0; k < 6; k++) { const a = k / 6, b = (k + 1) / 6; pxLine(g, 30 - a * 30, y0 + a * (y1 - y0), 30 - b * 30, y0 + b * (y1 - y0), k % 2 ? '#1d1f26' : '#f2c418', 6); } }
        pxLine(g, 208, 82, 210, 96, '#8a8e96'); R(g, 208, 96, 3, 6, '#c8ccd2'); }                                                        // swung back into the dock; the pin dangles on its chain
    } else { for (const y of [62, 86]) { R(g, 25, y, 4, 4, '#4a4e56'); R(g, 211, y, 4, 4, '#4a4e56'); } }                                 // just the empty gate brackets
    if (v === 3) {                                                                                                                    // a loaded pallet left on the very edge, tracks right up to it
      for (const x of [118, 166]) { g.fillStyle = 'rgba(24,24,28,0.45)'; g.fillRect(x, 118, 10, 17); }
      R(g, 112, 118, 64, 3, 'rgba(20,20,24,0.35)');
      pallet(g, 110, 104, 66, 9); R(g, 110, 104, 66, 1, '#8a6a3a');
      R(g, 112, 108, 62, 3, 'rgba(10,10,14,0.5)');                                                                                     // nothing under its far boards
      load(g, 114, 66, 58, 38, 7);
    }
    Z.vignette(g);
  };
  ZA.i_restraint = (g, v, fl, t) => {
    const dx = v === 3 ? 16 : 0, locked = v < 2;
    g.fillStyle = skyGrad(g, 0, 126); g.fillRect(0, 0, ZW, 126);
    for (let x = 0; x < ZW; x += 4) R(g, x, 96, 2, 30, 'rgba(110,116,124,0.25)');                                                        // the yard fence, far off
    // the building's dock face: siding above the dock height, poured concrete below
    ribbed(g, 0, 0, 62, 56, '#b8bec4', 6, true); R(g, 0, 56, 62, 70, '#9a9a94'); speckle(g, 0, 56, 62, 70, 'rgba(0,0,0,0.12)', 120, 3); R(g, 0, 56, 62, 2, '#c8c8c0');
    R(g, 46, 0, 18, 18, '#24262c'); R(g, 46, 16, 18, 2, '#3a3c44');                                                                 // the dock shelter's top pad
    // the driver's signal light: red means stay, green means go
    R(g, 12, 6, 22, 38, '#1d1f26'); R(g, 10, 6, 26, 3, '#2a2c32');
    pxEllipse(g, 23, 17, 6, 6, locked ? '#5a1a18' : '#ff3a30'); pxEllipse(g, 23, 33, 6, 6, locked ? '#40e060' : '#1a3a1a');
    pxRect(g, 20, locked ? 30 : 14, 3, 2, '#ffffff'); if (!locked) softGlow(g, 23, 17, 14, 14, '#ff4030', .35); else softGlow(g, 23, 33, 14, 14, '#60ff80', .3);
    txt(g, locked ? 'GO' : 'STOP', 23, 46, '#f4f4ee', 1, 'c');
    // the dock bumper
    R(g, 54, 58, 10, 22, '#1d1f26'); R(g, 54, 58, 10, 2, '#3a3c42'); bolt(g, 57, 62, '#6a6e76'); bolt(g, 57, 76, '#6a6e76');
    if (v === 3) { R(g, 64, 0, dx + 2, 64, 'rgba(10,10,16,0.25)'); }                                                                  // daylight where the trailer used to be
    // the trailer: aluminum box, rear frame, conspicuity tape, sill and frame rails
    const X = 66 + dx;
    R(g, X, 0, ZW - X, 52, '#e4e6e8'); for (let x = X + 12; x < ZW; x += 12) { R(g, x, 0, 1, 52, '#c8ccd0'); R(g, x + 1, 0, 1, 52, '#f4f6f8'); }
    R(g, X, 0, 7, 56, '#9aa0a8'); R(g, X + 1, 0, 1, 56, '#c8ccd2');
    for (let x = X + 8; x < ZW; x += 10) R(g, x, 44, 5, 3, '#c8202a'), R(g, x + 5, 44, 5, 3, '#f4f4f4');
    R(g, X, 52, ZW - X, 6, '#3a3c42'); R(g, X + 40, 58, ZW - X - 40, 6, '#24262c');
    // the rear impact guard (the bumper bar a restraint hooks), seen end-on, on its strut
    R(g, X + 8, 58, 4, 22, '#2a2c32'); R(g, X + 4, 78, 12, 9, '#3a3c42'); R(g, X + 4, 78, 12, 2, '#5a5e66');
    // the restraint: a steel track on the dock face and its hook carriage
    R(g, 42, 66, 10, 58, '#c89a10'); R(g, 42, 66, 2, 58, '#f2c418'); for (let y = 70; y < 122; y += 8) R(g, 44, y, 6, 1, '#8a6a10');
    if (locked) { R(g, 40, 88, 22, 12, '#f2c418'); R(g, 40, 88, 22, 2, '#ffe27a'); R(g, 58, 72, 6, 28, '#e0b020'); R(g, 58, 70, X + 22 - 58, 6, '#e0b020'); R(g, X + 16, 70, 5, 12, '#c89a10'); R(g, 58, 70, X + 22 - 58, 1, '#ffe27a'); }   // up and over the bar
    else { R(g, 40, 110, 22, 12, '#f2c418'); R(g, 40, 110, 22, 2, '#ffe27a'); R(g, 58, 104, 6, 8, '#c89a10'); }                         // stowed down on the dock face
    // the tandem axles: eight tires, two seen from the side
    R(g, X + 90, 58, 90, 10, '#2a2c32');
    for (const cx of [X + 84, X + 130]) { pxEllipse(g, cx, 104, 21, 21, '#1a1a1e'); pxEllipse(g, cx, 104, 19, 19, '#2a2a30'); for (let a = 0; a < 6.28; a += .35) R(g, cx + Math.cos(a) * 19, 104 + Math.sin(a) * 19, 1, 1, '#3a3a42');
      pxEllipse(g, cx, 104, 10, 10, '#a8acb4'); pxEllipse(g, cx, 104, 8, 8, '#8a8e96'); pxEllipse(g, cx, 104, 3, 3, '#4a4e56'); for (let a = 0; a < 6.28; a += 1.05) R(g, cx + Math.cos(a) * 6, 104 + Math.sin(a) * 6, 1, 1, '#d8dce0'); R(g, cx - 6, 96, 4, 2, '#d8dce0'); }
    R(g, X + 56, 84, 4, 36, '#1d1f26');                                                                                               // mud flap
    // the apron
    R(g, 0, 125, ZW, 10, '#4a4c50'); speckle(g, 0, 125, ZW, 10, 'rgba(0,0,0,0.3)', 80, 9); R(g, 0, 125, ZW, 1, '#6a6c70');
    // the wheel chock
    const cx = X + 152;
    if (v === 0) { fillPoly(g, [[cx, 125], [cx + 22, 125], [cx + 4, 106], [cx, 108]], '#f2c418'); R(g, cx, 108, 3, 17, '#c89a10'); pxLine(g, cx + 4, 106, cx + 21, 124, '#ffe27a'); for (let x = 70; x < cx; x += 3) R(g, x, 126 + (x % 6 ? 0 : 1), 2, 1, '#8a8e96'); }
    if (v === 1) { fillPoly(g, [[cx + 2, 125], [cx + 24, 125], [cx + 6, 107], [cx + 2, 109]], '#d8b020'); pxLine(g, cx + 6, 110, cx + 14, 124, '#3a3020'); pxLine(g, cx + 7, 110, cx + 15, 124, '#8a7010'); R(g, cx + 18, 122, 3, 2, '#d8b020'); }   // split down its back, no chain
    if (v === 2) { fillPoly(g, [[100, 128], [122, 131], [124, 126], [104, 121]], '#f2c418'); R(g, 104, 121, 3, 3, '#c89a10'); }        // lying out on the apron, nowhere near a wheel
    Z.vignette(g);
  };
  ZA.i_leveler = (g, v, fl, t) => {
    // the trailer's plank floor beyond the lip, and the dock floor to the left
    R(g, 0, 0, ZW, 20, '#8a6a42'); for (let x = 0; x < ZW; x += 14) R(g, x, 0, 1, 20, '#5a4228'); speckle(g, 0, 0, ZW, 20, 'rgba(40,24,10,0.3)', 120, 3);
    concrete(g, 0, 20, 34, 115, '#a8a69e', 4); stripes(g, 24, 20, 8, 115, '#f2c418', '#1d1f26', 6);
    // the pit gap along the deck's side
    R(g, 32, 22, 10, 113, '#1a1816'); R(g, 32, 22, 1, 113, '#2a2622');
    if (v === 0) R(g, 33, 120, 9, 15, '#4a4a46');
    if (v === 1) { for (let i = 0; i < 14; i++) { const y = 26 + i * 8 + hash(i) * 4; R(g, 33 + hash(i + 3) * 5, y, 4, 2, i % 3 ? '#e8ecf0' : '#c8a070'); R(g, 34, y + 2, 3, 1, '#ffffff'); } pxLine(g, 34, 40, 40, 70, '#1d1f26'); }
    // the hinged lip, out on the trailer bed
    const sag = v === 3 ? 6 : 0;
    fillPoly(g, [[42, 6], [ZW, 6 + sag], [ZW, 24 + sag * .3], [42, 24]], '#7e838c'); R(g, 42, 6, ZW - 42, 1, '#c8ccd2'); pxLine(g, 42, 6, ZW, 6 + sag, '#c8ccd2');
    for (let x = 48; x < ZW; x += 9) R(g, x, 12 + (x > 140 ? sag * (x - 140) / 100 : 0), 3, 1, '#a4a9b2');
    if (v === 3) fillPoly(g, [[160, 6], [ZW, 6 + sag], [ZW, 0], [160, 0]], 'rgba(20,14,8,0.35)');                                      // a shadowed gap under the sagging corner
    // the hinge knuckles
    for (let x = 42; x < ZW; x += 12) { R(g, x, 24, 8, 4, '#5a5e66'); R(g, x, 24, 8, 1, '#8a8e96'); }
    // the deck
    tread(g, 42, 28, ZW - 42, 107, '#868b94');
    for (let i = 0; i < 6; i++) { const y = 40 + i * 16; pxLine(g, 42, y + 8, ZW, y - 6, 'rgba(40,40,44,0.18)'); }                         // tire scuffs
    if (v === 2) { pxLine(g, 60, 116, 206, 52, '#d8dce4'); pxLine(g, 60, 117, 206, 53, '#3a3e46'); pxLine(g, 62, 117, 204, 55, '#a8acb4');   // a long fork gouge
      fillPoly(g, [[32, 46], [42, 44], [30, 96], [22, 94]], '#9aa0a8'); stripes(g, 24, 60, 6, 20, '#f2c418', '#1d1f26', 4); pxLine(g, 32, 46, 22, 94, '#5a5e66'); R(g, 32, 40, 4, 4, '#c8ccd2'); }   // the toe guard, torn off its hinge and hanging
    if (v === 3) { let x = 50, y = 26; while (x < 230) { const nx = x + 6 + hash(x) * 8, ny = 25 + hash(x + 3) * 4; pxLine(g, x, y, nx, ny, '#141418'); pxLine(g, x, y + 1, nx, ny + 1, '#e8ecf0'); x = nx; y = ny; } }   // the crack, bright fresh metal along it
    Z.vignette(g);
  };
  ZA.i_forklift = (g, v, fl, t) => {
    cmu(g, 0, 0, ZW, 112, wallOf('i_dock'), 9); concrete(g, 0, 112, ZW, 23, '#a8a8a2', 2);
    pxEllipse(g, 150, 126, 92, 6, 'rgba(20,20,28,0.25)');
    if (v === 2) { fillPoly(g, blobPts(76, 128, 34, 5, 11, .4, 16), '#2a2418'); fillPoly(g, blobPts(74, 128, 22, 3, 13, .4, 12), '#4a3e28'); R(g, 62, 127, 6, 1, 'rgba(200,160,255,0.7)'); R(g, 84, 129, 5, 1, 'rgba(140,220,230,0.7)');
      const dy = Z.dripY(t, 1.4, 40); R(g, 87, 86 + dy, 1, 2, '#6a5a3a'); }                                                         // hydraulic fluid dripping off the mast
    const up = v === 3, fy = up ? 26 : 114;
    // the mast: the outer channel, and the inner one riding up out of it when raised
    R(g, 66, 8, 18, 112, '#3a3c42'); R(g, 68, 8, 3, 112, '#5a5c62'); for (const y of [20, 64, 110]) R(g, 66, y, 18, 3, '#2a2c30');
    if (up) { R(g, 70, 0, 10, 20, '#4a4c52'); R(g, 71, 0, 2, 20, '#6a6c72'); }
    R(g, 85, 30, 3, 82, '#c8ccd2'); R(g, 85, 30, 1, 82, '#ffffff');                                                                   // the lift cylinder's chrome rod
    for (let y = up ? 8 : 60; y < (up ? 50 : 112); y += 3) R(g, 80, y, 2, 2, '#8a8e96');                                               // lift chain
    // the carriage and its backrest grid, and the forks
    R(g, 58, fy - 40, 10, 46, '#2a2c30'); for (let y = fy - 36; y < fy + 2; y += 8) R(g, 58, y, 10, 2, '#4a4c52');
    R(g, 2, fy, 64, 5, '#4a4c52'); R(g, 2, fy, 64, 1, '#7a7c82'); R(g, 60, fy - 8, 6, 13, '#4a4c52'); fillPoly(g, [[2, fy + 3], [8, fy], [8, fy + 5], [2, fy + 5]], '#3a3c42');
    if (up) { pallet(g, 0, fy - 9, 62, 9); R(g, 22, fy - 11, 12, 2, '#f4f4ec'); R(g, 36, fy - 11, 6, 2, '#f2c418'); R(g, 40, fy - 11, 2, 1, '#c8ccd2');   // a pick list and a box cutter on the pallet
      for (const x of [10, 30]) { R(g, x, fy - 10, 5, 1, 'rgba(60,50,40,0.6)'); } }                                                    // boot prints in the dust
    // the counterweight
    fillPoly(g, [[196, 64], [228, 64], [236, 72], [236, 118], [196, 118]], '#34363c'); R(g, 196, 64, 32, 2, '#4a4c52');
    txt(g, 'FL-2', 216, 92, '#f2c418', 1, 'c');
    // the chassis, cowl, and seat
    R(g, 84, 70, 116, 42, '#f0b023'); R(g, 84, 70, 116, 2, '#ffd05a'); R(g, 84, 100, 116, 12, '#c8901a'); R(g, 84, 99, 116, 1, '#a87010');
    R(g, 86, 56, 44, 16, '#e0a020'); R(g, 86, 56, 44, 2, '#ffd05a');
    { R(g, 124, 74, 20, 10, v === 1 ? '#b8b4aa' : '#d8dce0'); R(g, 124, 74, 20, 1, '#ffffff'); for (let i = 0; i < 3; i++) R(g, 126, 77 + i * 2, 16 - i * 3, 1, '#5a5e66'); }   // the capacity plate
    R(g, 150, 52, 34, 18, '#1d1f26'); R(g, 150, 52, 34, 2, '#3a3c42'); R(g, 176, 26, 14, 32, '#1d1f26'); R(g, 177, 27, 2, 30, '#3a3c42');
    R(g, 158, 58, 4, 24, '#f28c28'); R(g, 158, 80, 6, 3, '#c8ccd2');                                                                  // the seat belt
    // steering column, wheel, horn button
    pxLine(g, 104, 58, 110, 44, '#24262c', 3); pxEllipse(g, 110, 42, 11, 3, '#1d1f26'); pxEllipse(g, 110, 42, 9, 2, '#2a2c32'); R(g, 108, 41, 4, 2, '#c8202a');
    // wheels
    for (const [cx, cy, rr] of [[112, 110, 17], [212, 113, 13]]) { pxEllipse(g, cx, cy, rr, rr, '#1a1a1e'); pxEllipse(g, cx, cy, rr * .55, rr * .55, '#8a8e96'); pxEllipse(g, cx, cy, rr * .25, rr * .25, '#4a4c52'); for (let a = 0; a < 6.28; a += 1.26) R(g, cx + Math.cos(a) * rr * .4, cy + Math.sin(a) * rr * .4, 1, 1, '#c8ccd2'); }
    // the overhead guard
    pxLine(g, 96, 70, 92, 14, '#1d1f26', 3); pxLine(g, 186, 52, 190, 14, '#1d1f26', 3); R(g, 86, 10, 114, 6, '#1d1f26'); for (let x = 92; x < 198; x += 8) R(g, x, 11, 4, 2, '#3a3c44');
    R(g, 188, 4, 5, 6, '#f28c28'); R(g, 189, 5, 2, 2, '#ffc070');
    // the mirror on the guard's front corner
    R(g, 94, 16, 2, 4, '#24262c');
    if (v === 1) { fillPoly(g, [[88, 20], [102, 18], [103, 28], [89, 30]], '#24262c'); fillPoly(g, [[90, 21], [101, 20], [101, 27], [91, 28]], '#6a7a8a'); pxLine(g, 92, 21, 99, 27, '#ffffff'); pxLine(g, 96, 21, 93, 27, '#e8eef4'); }
    else { R(g, 88, 18, 14, 10, '#24262c'); R(g, 90, 20, 10, 6, '#a8c4d8'); R(g, 91, 21, 3, 2, '#ffffff'); }
    // the checklist clipped to the rear post
    R(g, 184, 28, 12, 3, '#5a5e66');
    if (v === 0) { R(g, 183, 30, 14, 20, '#f4f4ec'); for (let i = 0; i < 6; i++) { R(g, 185, 33 + i * 3, 6, 1, '#8a8e96'); R(g, 192, 32 + i * 3, 2, 2, '#2a8a3a'); } }
    Z.vignette(g);
  };
  ZA.i_charger = (g, v, fl, t) => {
    cmu(g, 0, 0, ZW, 112, wallOf('i_dock'), 12); concrete(g, 0, 112, ZW, 23, '#a8a8a2', 5);
    for (let x = -20; x < ZW; x += 12) pxLine(g, x, 135, x + 20, 112, '#d8b828', 2);                                                     // hatched floor
    sign(g, 6, 5, 58, 31, 'danger', ['NO SMOKING', 'NO FLAMES']);
    // the charger on the wall, cabled down to the battery
    R(g, 68, 6, 58, 58, '#9aa0a8'); R(g, 68, 6, 58, 2, '#c8ccd2'); R(g, 124, 6, 2, 58, '#6a6e76');
    R(g, 76, 14, 40, 12, '#1a2a1a'); txt(g, v === 3 ? 'FAULT' : 'CHG 82%', 96, 17, v === 3 ? '#ff6040' : '#60e060', 1, 'c');
    for (let i = 0; i < 4; i++) R(g, 78 + i * 10, 32, 6, 2, '#5a5e66'); R(g, 78, 40, 4, 4, '#40c040'); R(g, 86, 40, 4, 4, v === 3 ? '#ff4030' : '#5a1a18');
    for (let y = 48; y < 60; y += 3) R(g, 76, y, 40, 1, '#7a7e86');
    pxLine(g, 100, 64, 104, 72, '#1a1a1e', 3); R(g, 98, 70, 12, 6, '#c8202a');                                                         // the connector
    // the battery on its stand: a steel tray of cells, seen a little from above
    R(g, 30, 114, 124, 8, '#3a3c42'); R(g, 34, 122, 6, 10, '#2a2c30'); R(g, 144, 122, 6, 10, '#2a2c30');
    const bul = v === 3 ? 4 : 0;
    R(g, 34, 76, 116, 38, '#3a5a8a'); R(g, 34, 76, 116, 2, '#5a7aa8'); txt(g, '36V', 92, 96, '#d8dce4', 1, 'c');
    if (bul) { fillPoly(g, blobPts(92, 96, 56 + bul, 19 + bul, 5, .08, 20), '#3a5a8a'); fillPoly(g, blobPts(80, 90, 24, 6, 7, .2, 12), '#5a7aa8'); txt(g, '36V', 92, 96, '#d8dce4', 1, 'c'); }
    R(g, 34, 68, 116, 9, '#24262c');
    for (let i = 0; i < 9; i++) { const x = 40 + i * 12; pxEllipse(g, x + 3, 72, 3, 2, i % 2 ? '#c8202a' : '#1d1f26'); if (i < 8) R(g, x + 6, 71, 6, 2, '#7a7e86'); }   // vent caps and the lead connectors between cells
    if (v === 1 || v === 3) { speckle(g, 36, 68, 112, 8, '#f4f4ec', 60, 3); for (let i = 0; i < 6; i++) R(g, 40 + i * 20, 70, 3, 2, '#e8e8e0'); }   // white crust
    if (v === 3) { if (Settings.get('motion')) for (let i = 0; i < 7; i++) { const k = (t * .7 + i / 7) % 1; R(g, 44 + i * 15 + Math.sin(t * 3 + i) * 3, 66 - k * 40, 2, 1, `rgba(230,236,220,${.7 * (1 - k)})`); }
      for (let i = 0; i < 3; i++) R(g, 60 + i * 30, 66 - (Math.floor(t * 8 + i) % 4), 1, 1, '#f4f4ec'); }                             // fumes, and acid spitting from the caps
    // the spill kit
    R(g, 156, 102, 26, 30, '#f2c418'); R(g, 154, 100, 30, 4, v === 2 ? '#c89a10' : '#e0b020'); txt(g, 'SPILL', 169, 110, '#1d1f26', 1, 'c'); txt(g, 'KIT', 169, 117, '#1d1f26', 1, 'c');
    if (v === 1) { fillPoly(g, [[158, 100], [178, 96], [182, 100], [160, 102]], '#e8e4d8'); txt(g, '1/2', 170, 92, '#5a5e66', 1, 'c'); }
    if (v === 2) { fillPoly(g, [[178, 96], [190, 92], [192, 100]], '#e0b020'); R(g, 158, 103, 22, 3, '#2a2a2e'); }                          // lid off: empty
    // the eyewash: sign, bowl on its riser, two nozzles, the yellow push flag
    sign(g, 188, 20, 46, 18, null, []); R(g, 188, 20, 46, 18, '#2a8a4a'); txt(g, 'EYEWASH', 211, 23, '#ffffff', 1, 'c'); pxRect(g, 205, 30, 12, 6, '#ffffff'); R(g, 210, 31, 2, 4, '#2a8a4a'); R(g, 208, 32, 6, 2, '#2a8a4a');
    R(g, 208, 56, 6, 56, '#2a8a4a'); R(g, 209, 56, 1, 56, '#5aba7a');
    pxEllipse(g, 211, 52, 22, 6, '#e0b020'); pxEllipse(g, 211, 51, 19, 4, '#2a2a2e'); R(g, 192, 46, 38, 2, '#ffe27a');
    for (const x of [203, 219]) { R(g, x - 2, 44, 4, 4, '#5a5e66'); R(g, x - 2, 43, 4, 1, v === 2 ? '#9a9688' : '#f2c418'); }
    R(g, 230, 56, 8, 14, '#f2c418'); R(g, 228, 54, 4, 4, '#c89a10');
    if (fl.flush && t - fl.flush < 4 && v < 2) for (const x of [203, 219]) for (let i = 0; i < 6; i++) { const k = ((t * 3 + i / 6) % 1); pxRect(g, x + (x < 211 ? 1 : -1) * k * 8, 40 - Math.sin(k * 3.14) * 10, 1, 2, '#bfe3f4'); }   // two arcs of water
    if (v === 2) { pallet(g, 184, 94, 56, 9, '#a07a48'); pallet(g, 184, 103, 56, 9, '#b08850'); pallet(g, 184, 112, 56, 9, '#a07a48'); pallet(g, 184, 121, 56, 9, '#b08850'); load(g, 186, 60, 54, 34, 4); speckle(g, 190, 46, 40, 6, '#b8b0a0', 30, 2); }   // stacked in front of it
    // a yellow bollard out front
    R(g, 4, 52, 14, 83, '#f2c418'); R(g, 4, 52, 3, 83, '#ffe27a'); R(g, 15, 52, 3, 83, '#c89a10'); pxEllipse(g, 11, 52, 7, 2, '#1d1f26'); for (const y of [70, 90]) R(g, 4, y, 14, 4, '#1d1f26');
    Z.vignette(g);
  };
  ZA.i_firstaid = (g, v, fl, t) => {
    cmu(g, 0, 0, ZW, ZH, mix(wallOf('i_dock'), Decor.time.shadow, .08), 15);
    const open = v === 2 || fl.open;
    // the inspection log card, in a sleeve on the wall
    R(g, 180, 40, 36, 54, '#f8f6ee'); R(g, 180, 40, 36, 54, 'rgba(200,220,240,0.2)'); R(g, 180, 40, 36, 1, '#ffffff'); txt(g, 'LOG', 198, 43, '#1d1f26', 1, 'c');
    const months = v === 0 ? 10 : v === 1 ? 7 : 0;
    for (let i = 0; i < 10; i++) { R(g, 182, 50 + i * 4, 32, 1, '#c8ccd2'); if (i < months) { pxLine(g, 200, 52 + i * 4, 204, 50 + i * 4, '#2a3a8a'); pxLine(g, 204, 50 + i * 4, 207, 53 + i * 4, '#2a3a8a'); } }
    R(g, 196, 36, 4, 6, '#d8d8c8');
    // the cabinet box
    R(g, 54, 6, 120, 124, '#c8ccd0'); R(g, 170, 6, 4, 124, '#9aa0a8');
    if (!open) {
      R(g, 56, 8, 112, 120, '#f4f4ee'); R(g, 56, 8, 112, 2, '#ffffff'); R(g, 56, 126, 112, 2, '#c8ccd0');
      R(g, 100, 46, 24, 56, '#2a9a4a'); R(g, 84, 62, 56, 24, '#2a9a4a'); R(g, 100, 46, 24, 2, '#4aba6a');
      txt(g, 'FIRST AID', 112, 24, '#2a9a4a', 2, 'c');
      R(g, 158, 58, 5, 18, '#8a8e96'); R(g, 158, 58, 5, 2, '#c8ccd2');
      Z.vignette(g); return;
    }
    // open: shelves inside, and the door swung out to the left
    R(g, 56, 8, 112, 120, '#e8e8e2'); R(g, 56, 8, 112, 6, '#d0d0c8');
    for (const y of [46, 84, 122]) { R(g, 56, y, 112, 4, '#c8ccd0'); R(g, 56, y, 112, 1, '#ffffff'); }
    const box = (x, y, w, h, c, lbl) => { R(g, x, y - h, w, h, c); R(g, x, y - h, w, 1, mix(c, '#ffffff', .4)); if (lbl) R(g, x + 2, y - h + 3, w - 4, 2, lbl); };
    if (v === 0 || v === 1) {
      box(60, 46, 22, 20, '#f4f4ee', '#c8202a'); if (v === 0) box(84, 46, 18, 16, '#f4f4ee', '#2a5aa8'); else box(84, 46, 18, 5, '#f4f4ee', '#2a5aa8');   // bandages (running low in a lapsed cabinet)
      for (const x of [108, 118, 128]) { R(g, x, 34, 8, 12, '#f8f8f4'); pxEllipse(g, x + 4, 34, 4, 1, '#e0e0d8'); }                      // gauze rolls
      if (v === 0) for (const x of [142, 150]) { R(g, x, 30, 6, 16, '#f28c28'); R(g, x + 1, 28, 4, 2, '#ffffff'); }                       // burn gel
      for (const x of [60, 74]) { R(g, x, 60, 10, 24, '#bfe3f4'); R(g, x + 3, 56, 4, 4, '#2a5aa8'); R(g, x + 2, 66, 6, 8, '#ffffff'); }   // eyewash bottles
      box(90, 84, 26, 18, '#2a5aa8', '#ffffff'); box(120, 84, 20, 12, '#f2c418', '#1d1f26'); box(144, 84, 20, 14, '#bfe3f4', '#2a5aa8'); // gloves, a CPR mask, cold packs
      box(62, 122, 40, 14, '#f4f4ee', '#2a9a4a'); for (const x of [110, 122]) { pxEllipse(g, x + 4, 116, 5, 5, '#e8e8e2'); pxEllipse(g, x + 4, 116, 2, 2, '#c8ccd0'); }   // a trauma pack and tape rolls
    } else {
      pxEllipse(g, 70, 118, 5, 5, '#e8e8e2'); pxEllipse(g, 70, 118, 2, 2, '#c8ccd0');                                                   // one roll of tape
      fillPoly(g, [[120, 80], [132, 78], [134, 84], [118, 84]], '#7ab0e0');                                                              // one glove
      for (const x of [140, 154]) { R(g, x, 60, 10, 24, '#c8d8d8'); R(g, x + 3, 56, 4, 4, '#2a5aa8'); R(g, x + 2, 66, 6, 8, '#e8e4d0'); speckle(g, x, 56, 10, 28, 'rgba(120,110,90,0.5)', 14, x); }   // two dusty, expired eyewash bottles
      speckle(g, 58, 12, 108, 110, 'rgba(120,110,90,0.25)', 60, 4);
    }
    // the door, swung open (on the broken one it sags off its latch side)
    const sag = v === 2 ? 6 : 0;
    fillPoly(g, [[54, 8], [26, 4], [26, 134 + sag], [54, 128]], '#f4f4ee'); fillPoly(g, [[30, 40], [50, 42], [50, 92], [30, 94]], '#2a9a4a'); pxLine(g, 54, 8, 54, 128, '#9aa0a8'); pxLine(g, 26, 4, 26, 134, '#c8ccd0');
    Z.vignette(g);
  };
  ZA.i_dockfloor = (g, v, fl, t) => {
    concrete(g, 0, 0, ZW, ZH, '#a8a8a2', 21);
    for (let i = 0; i < 8; i++) pxLine(g, hash(i) * 240, 0, hash(i + 4) * 240 - 40, ZH, 'rgba(40,40,44,0.12)', 2);                      // tire scuffs
    for (let x = -30; x < ZW; x += 1) { if (((x * 7) % 9) < 7) R(g, x + 40, 128 - x * .05, 1, 3, '#d8b828'); }                          // the lane line
    if (v === 3) { fillPoly(g, blobPts(80, 82, 70, 36, 41, .4, 26), 'rgba(28,22,16,0.7)'); fillPoly(g, blobPts(78, 80, 52, 24, 43, .4, 20), 'rgba(58,48,30,0.6)');
      for (const [x, y, c] of [[50, 70, 'rgba(200,120,220,0.7)'], [70, 92, 'rgba(120,200,220,0.7)'], [100, 74, 'rgba(230,210,120,0.6)'], [90, 100, 'rgba(160,230,140,0.5)']]) { pxLine(g, x, y, x + 18, y + 3, c); pxLine(g, x + 2, y + 1, x + 14, y + 4, c); }
      for (const x of [50, 96]) { g.fillStyle = 'rgba(16,14,10,0.45)'; for (let y = 0; y < ZH; y += 2) g.fillRect(x + y * .35, y, 14, 1); } }   // tire tracks smeared through it
    // the banding bin
    R(g, 120, 6, 30, 46, '#2a5aa8'); R(g, 120, 6, 30, 3, '#4a7ac8'); R(g, 146, 6, 4, 46, '#1d3a78'); pxLine(g, 126, 6, 122, -4, '#1d1f26'); pxLine(g, 134, 6, 140, -6, '#1d1f26'); pxLine(g, 130, 6, 132, -2, '#e8ecf0');
    // the pallet stack
    const lean = v === 2 ? 3 : 0;
    for (let k = 0; k < 9; k++) { const y = 104 - k * 12, x = 156 + k * lean; pallet(g, x, y, 82, 12, k % 2 ? '#a07c48' : '#b08850'); if (v === 2 && k % 3 === 1) { R(g, x + 30, y, 10, 4, '#3a2a18'); R(g, x + 34, y - 3, 1, 3, '#c8ccd2'); } }
    if (v === 1) { for (let i = 0; i < 9; i++) { const x = 10 + hash(i + 11) * 130, y = 20 + hash(i + 17) * 100; fillPoly(g, blobPts(x, y, 9 + hash(i) * 8, 4, i * 3 + 1, .7, 10), 'rgba(236,240,244,0.75)'); pxLine(g, x - 6, y, x + 4, y - 2, '#ffffff'); }
      for (let i = 0; i < 3; i++) { let x = 20 + i * 36, y = 40 + i * 30; for (let k = 0; k < 6; k++) { const nx = x + 10, ny = y + (k % 2 ? 8 : -6); pxLine(g, x, y, nx, ny, '#1d1f26', 2); x = nx; y = ny; } } }   // shrink wrap and loops of strapping
    if (v === 2) for (let i = 0; i < 7; i++) { const x = 8 + hash(i + 2) * 120, y = 16 + hash(i + 7) * 104, a = hash(i + 9) * 3; const ex = x + Math.cos(a) * 34, ey = y + Math.sin(a) * 12;   // broken boards, nails up
      pxLine(g, x, y, ex, ey, i % 2 ? '#b08850' : '#9a7444', 6); pxLine(g, x, y - 2, ex, ey - 2, '#c8a068'); const nx = (x + ex) / 2, ny = (y + ey) / 2; R(g, nx, ny - 6, 1, 6, '#c8ccd2'); R(g, nx - 1, ny - 6, 3, 1, '#8a8e96'); }
    Z.vignette(g);
  };
})();
