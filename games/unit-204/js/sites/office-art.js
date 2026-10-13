'use strict';
/* ============================== SUITE 204: OFFICE ART ==============================
   The commercial office's pictures: a tiny pixel font for signs and labels, the shared pieces every office room is
   built from (a drop ceiling of acoustic tile on a T-bar grid, fluorescent troffers, rubber cove base, carpet
   tile), every feature's 240x135 close-up (ZOOM), the pixel sprites for what the tenant left behind, and the
   title screen's corridor outside Suite 204. Everything lives inside one object, OFC, so nothing here can collide
   with another site's names; js/sites/office.js (loaded next) builds the rooms and the checklist from it.
   Variant numbers in the close-ups match the order of each feature's variants in office.js. */
const OFC = (() => {
  /* ---------- a 3x5 pixel font, for signs, labels, and lettering on glass ---------- */
  const FONT = {
    A: '.#./#.#/###/#.#/#.#', B: '##./#.#/##./#.#/##.', C: '.##/#../#../#../.##', D: '##./#.#/#.#/#.#/##.', E: '###/#../##./#../###',
    F: '###/#../##./#../#..', G: '.##/#../#.#/#.#/.##', H: '#.#/#.#/###/#.#/#.#', I: '###/.#./.#./.#./###', J: '..#/..#/..#/#.#/.#.',
    K: '#.#/#.#/##./#.#/#.#', L: '#../#../#../#../###', M: '#.#/###/###/#.#/#.#', N: '##./#.#/#.#/#.#/#.#', O: '###/#.#/#.#/#.#/###',
    P: '##./#.#/##./#../#..', Q: '.#./#.#/#.#/##./.##', R: '##./#.#/##./#.#/#.#', S: '.##/#../.#./..#/##.', T: '###/.#./.#./.#./.#.',
    U: '#.#/#.#/#.#/#.#/###', V: '#.#/#.#/#.#/#.#/.#.', W: '#.#/#.#/###/###/#.#', X: '#.#/#.#/.#./#.#/#.#', Y: '#.#/#.#/.#./.#./.#.',
    Z: '###/..#/.#./#../###', 0: '###/#.#/#.#/#.#/###', 1: '.#./##./.#./.#./###', 2: '##./..#/.#./#../###', 3: '##./..#/.#./..#/##.',
    4: '#.#/#.#/###/..#/..#', 5: '###/#../##./..#/##.', 6: '.##/#../###/#.#/###', 7: '###/..#/.#./.#./.#.', 8: '###/#.#/###/#.#/###',
    9: '###/#.#/###/..#/##.', '!': '.#./.#./.#./.../.#.', '-': '.../.../###/.../...', '.': '.../.../.../.../.#.', '/': '..#/..#/.#./#../#..',
    ':': '.../.#./.../.#./...', "'": '.#./.#./.../.../...', '%': '#.#/..#/.#./#../#.#', '?': '##./..#/.#./.../.#.'
  };
  /* text in the pixel font at (x, y), each pixel k by k; mirror draws it backwards, the way lettering on glass reads from the other side */
  function ftext(g, s, x, y, col, k = 1, mirror = false) {
    g.fillStyle = col; const chars = [...String(s).toUpperCase()], w = ftw(s, k);
    chars.forEach((ch, i) => {
      const gl = FONT[ch]; if (!gl) return;
      gl.split('/').forEach((row, j) => [...row].forEach((c, n) => {
        if (c !== '#') return;
        const px = mirror ? x + w - (i * 4 + n + 1) * k : x + (i * 4 + n) * k;
        g.fillRect(Math.round(px), Math.round(y + j * k), k, k);
      }));
    });
  }
  const ftw = (s, k = 1) => String(s).length * 4 * k - k;     // how wide a string comes out

  /* ---------- shared close-up pieces ---------- */
  const wallOf = (room, which) => Decor.zoomWall(room, which);
  /* rubber cove base along the bottom of a wall (offices have these instead of wood baseboards) */
  function cove(g, y, h = 8, x = 0, w = ZW) { pxRect(g, x, y, w, h, '#34343a'); pxRect(g, x, y, w, 1, '#56565e'); pxRect(g, x, y + h - 2, w, 2, '#26262c'); }
  /* mineral-fiber ceiling tile: off-white with little fissures and pinholes */
  function acoustic(g, x, y, w, h, base = '#ebe8de', seed = 3) {
    pxRect(g, x, y, w, h, base); const dk = mix(base, '#6a6250', .32);
    for (let i = 0; i < w * h / 90; i++) { const px = x + hash(seed + i) * w, py = y + hash(seed + i + 50) * h; pxRect(g, px, py, 1 + Math.floor(hash(seed + i * 3) * 3), 1, dk); }
    speckle(g, x, y, w, h, mix(base, '#8a8270', .4), w * h / 24, seed + 7); speckle(g, x, y, w, h, '#ffffff', w * h / 40, seed + 9);
  }
  /* a ceiling seen from below: tiles on a white T-bar grid, cell pixels square, starting at (ox, oy) */
  function ceilGrid(g, cell, ox, oy, base = '#ebe8de') {
    acoustic(g, 0, 0, ZW, ZH, base, 5);
    for (let x = ox; x < ZW + cell; x += cell) { pxRect(g, x - 1, 0, 4, ZH, '#f8f8f4'); pxRect(g, x + 3, 0, 1, ZH, 'rgba(60,56,48,0.25)'); }
    for (let y = oy; y < ZH + cell; y += cell) { pxRect(g, 0, y - 1, ZW, 4, '#f8f8f4'); pxRect(g, 0, y + 3, ZW, 1, 'rgba(60,56,48,0.25)'); }
  }
  /* carpet tile, quarter-turned so neighbors run the other way (that faint checkerboard every office has) */
  function carpetTiles(g, pal, size = 40, ox = 0, oy = 0) {
    pxRect(g, 0, 0, ZW, ZH, pal.base);
    for (let ty = oy - size; ty < ZH; ty += size) for (let tx = ox - size; tx < ZW; tx += size) {
      const n = Math.round(tx / size) + Math.round(ty / size), turn = n % 2 === 0, tone = hash(n * 7.1) > .5 ? pal.lt : pal.dk;
      pxRect(g, tx, ty, size, size, mix(pal.base, tone, .18));
      if (turn) for (let y = ty + 1; y < ty + size; y += 3) pxRect(g, tx, y, size, 1, rgba(pal.dk, .45));
      else for (let x = tx + 1; x < tx + size; x += 3) pxRect(g, x, ty, 1, size, rgba(pal.dk, .45));
      pxRect(g, tx, ty, size, 1, rgba(mix(pal.dk, '#000000', .4), .5)); pxRect(g, tx, ty, 1, size, rgba(mix(pal.dk, '#000000', .4), .5));   // the seams
    }
    speckle(g, 0, 0, ZW, ZH, pal.lt, 1400, 21); speckle(g, 0, 0, ZW, ZH, pal.dk, 1600, 22); speckle(g, 0, 0, ZW, ZH, mix(pal.base, '#c8b070', .5), 160, 23);   // a few warm flecks
  }
  /* a ragged hole torn in drywall: lifted paper, crumbly gypsum, the dark cavity, a stud's edge in the bigger ones */
  function tornHole(g, cx, cy, r, sd, wall) {
    const torn = blobPts(cx, cy, r + 4, (r + 4) * .9, sd, .5, 16), hole = blobPts(cx, cy, r, r * .88, sd + 2, .4, 14);
    fillPoly(g, torn, mix(wall, '#ffffff', .35)); strokePoly(g, torn, mix(wall, '#000000', .22));
    fillPoly(g, blobPts(cx, cy, r + 1.5, (r + 1.5) * .9, sd + 1, .45, 16), '#ece6da'); speckle(g, cx - r - 2, cy - r - 2, r * 2 + 4, r * 2 + 4, '#d0c8b8', r * 3, sd);
    fillPoly(g, hole, '#2a221c'); clipDo(g, hole, () => { pxRect(g, cx - r, cy, r * 2, r, '#3a3028'); pxRect(g, cx - r, cy - r, r * 2, Math.max(1, Math.round(r * .35)), '#140f0c'); });
    strokePoly(g, hole, '#5a4c3e');
  }
  /* a tile floor seen from above, from a site palette [a, b, grout] */
  function tileTop(g, pal, size, ox, oy, y0 = 0, y1 = ZH) {
    const [a, b, gr] = pal, grout = gr || mix(b, '#2a1a10', .45);
    for (let y = oy - size; y < y1; y += size) for (let x = ox - size; x < ZW; x += size) {
      const n = Math.round(x / size) + Math.round(y / size); pxRect(g, x, Math.max(y, y0), size, Math.min(size, y1 - Math.max(y, y0)), n % 2 ? a : b);
    }
    for (let x = ox; x < ZW; x += size) pxRect(g, x, y0, 1, y1 - y0, grout);
    for (let y = oy; y < y1; y += size) if (y >= y0) pxRect(g, 0, y, ZW, 1, grout);
    speckle(g, 0, y0, ZW, y1 - y0, 'rgba(0,0,0,0.05)', (y1 - y0) * 6, 31); speckle(g, 0, y0, ZW, y1 - y0, 'rgba(255,255,255,0.12)', (y1 - y0) * 4, 32);
  }
  /* sealed concrete, with a control joint and a soft sheen */
  function concreteTop(g, pal, x, y, w, h) {
    pxRect(g, x, y, w, h, pal.base); speckle(g, x, y, w, h, pal.dk, w * h / 6, 41); speckle(g, x, y, w, h, pal.lt, w * h / 9, 42);
    pxRect(g, x, y + Math.round(h * .45), w, h - Math.round(h * .45), 'rgba(255,255,255,0.04)');
  }
  const lit = room => !ROOMS[room] || !ROOMS[room].lightsOff;

  /* ============================== CLOSE-UPS ============================== */
  const ZOOM = {
    /* ---------------- LOBBY ---------------- */
    /* the inside of the glass entry doors: a pair of leaves in a bronze storefront frame, the corridor through the glass,
       the suite's name and number backwards on the left leaf (the round's own number, not always 204) */
    o_entry(g, v, fl, t) {
      const wall = wallOf('o_lobby'), fp = Decor.pal('o_lobby').floor;
      Z.wall(g, 0, 0, ZW, ZH, wall, 31);
      tileTop(g, fp, 46, 20, 126, 126, ZH); pxRect(g, 0, 126, ZW, 1, mix(fp[0], '#000000', .3));
      const BZ = '#5e4a34', BH = '#82694a', BD = '#3a2c1e', unit = String(Game.unit || '204'), across = String((+unit || 204) + 1);
      pxRect(g, 10, 0, 204, 126, BZ); pxRect(g, 10, 0, 2, 126, BH); pxRect(g, 212, 0, 2, 126, BD);   // the storefront frame
      // the corridor outside, seen through both leaves: the far wall, the door across the hall, the carpet, a sconce
      const gx = 22, gy = 14, gw = 180, gh = 92;
      pxRect(g, gx, gy, gw, gh, '#d8cdb8'); speckle(g, gx, gy, gw, gh, 'rgba(0,0,0,0.05)', 220, 4);
      pxRect(g, gx, 92, gw, 14, '#5c6676'); for (let x = gx; x < gx + gw; x += 6) pxRect(g, x, 94 + (x % 4), 3, 1, '#6c7686'); pxRect(g, gx, 89, gw, 3, '#3a3a40');
      pxRect(g, 134, 30, 40, 62, '#e6dccb'); pxRect(g, 138, 34, 32, 58, '#8a5e36'); for (let y = 36; y < 92; y += 5) pxRect(g, 139, y, 30, 1, '#7a5230');
      pxRect(g, 150, 40, 14, 5, '#c9a227'); ftext(g, across, 151, 41, '#3a2a10'); pxRect(g, 141, 62, 6, 2, '#c9ccd4');
      pxRect(g, 60, 40, 8, 10, '#f6ead0'); softGlow(g, 64, 42, 26, 18, '#fff2cc', .35);
      g.fillStyle = 'rgba(150,190,205,0.18)'; g.fillRect(gx, gy, gw, gh);                                // the glass, tinted
      for (const [a, b] of [[40, 70], [52, 96], [136, 70], [148, 96]]) pxLine(g, a, gy + 1, a - 30 + b - 70, gy + gh - 2, 'rgba(255,255,255,0.22)');   // reflections, a pair on each leaf
      pxRect(g, gx, 60, gw, 4, 'rgba(255,255,255,0.42)');                                                 // a frosted band, so nobody walks into the glass
      // the suite's lettering, on the left leaf's glass only: SUITE over the number, backwards from in here
      for (const [str, y] of [['SUITE', 26], [unit, 42]]) { const w = str.length * 8 - 2; ftext(g, str, 64 - Math.round(w / 2), y, '#ffffff', 2, true); }
      // the two leaves: outer stiles, the meeting stiles in the middle with a gap between, top and bottom rails
      for (const [x0, x1] of [[16, 111], [113, 208]]) {
        pxRect(g, x0, 6, x1 - x0, 8, BZ); pxRect(g, x0, 104, x1 - x0, 18, BZ);                              // rails
        pxRect(g, x0, 6, 8, 116, BZ); pxRect(g, x1 - 8, 6, 8, 116, BZ);                                     // stiles
        pxRect(g, x0, 6, x1 - x0, 1, BH); pxRect(g, x0, 6, 1, 116, BH); pxRect(g, x1 - 1, 6, 1, 116, BD); pxRect(g, x0, 121, x1 - x0, 1, BD);
        pxRect(g, x0 + 8, 14, 1, 90, BD); pxRect(g, x1 - 9, 14, 1, 90, BH);                                 // the glazing stops
      }
      pxRect(g, 111, 6, 2, 116, '#1e160e');                                                                 // the gap where the leaves meet
      pxRect(g, 10, 122, 204, 4, '#a8a69e'); for (let x = 12; x < 212; x += 3) pxRect(g, x, 123, 1, 2, '#8a887e');   // threshold
      // the closer up top on the right leaf, and its arm to the frame
      pxRect(g, 128, 8, 56, 8, '#b4b0a6'); pxRect(g, 128, 8, 56, 1, '#d8d4ca'); pxRect(g, 128, 15, 56, 1, '#7a766c'); pxRect(g, 126, 9, 3, 6, '#8a867c'); pxRect(g, 183, 9, 3, 6, '#8a867c');
      pxLine(g, 180, 10, 196, 3, '#9a968c', 2); pxLine(g, 196, 3, 208, 2, '#9a968c', 2); pxEllipse(g, 196, 3, 1, 1, '#5a564c');
      if (v === 1) {                                     // the closer is weeping its hydraulic fluid
        g.fillStyle = 'rgba(70,50,20,0.65)'; g.fillRect(140, 16, 2, 10); g.fillRect(141, 26, 1, 14); pxEllipse(g, 141, 41, 1, 2, 'rgba(70,50,20,0.7)');
        speckle(g, 130, 15, 30, 3, 'rgba(60,40,10,0.6)', 18, 3);
      }
      // the lock, on the right leaf's meeting stile: a deadbolt (thumb-turn, or a key cylinder on the bad one) over its lever
      const lx = 117;
      if (v === 3) { pxEllipse(g, lx, 52, 3, 3, '#8a6e1a'); pxEllipse(g, lx, 52, 2, 2, '#c9a227'); pxRect(g, lx, 50, 1, 4, '#2a1a00'); pxRect(g, lx - 1, 51, 1, 1, '#2a1a00'); pxRect(g, lx - 1, 50, 1, 1, '#f2d870'); }   // (sized to sit inside the 8-pixel stile)
      else {
        pxEllipse(g, lx, 52, 3, 3, '#8a8e98'); pxEllipse(g, lx, 52, 2, 2, '#c9ccd4');
        if (fl.bolt) pxRect(g, lx - 3, 51, 7, 2, '#e8eaee'); else pxRect(g, lx, 49, 2, 7, '#e8eaee');
      }
      for (const [rx, dir] of [[lx, 1], [107, -1]]) { pxEllipse(g, rx, 72, 3, 3, '#8a8e98'); pxEllipse(g, rx, 72, 2, 2, '#c9ccd4'); const ax = dir > 0 ? rx : rx - 21; pxRect(g, ax, 70, 22, 4, '#c9ccd4'); pxRect(g, ax, 70, 22, 1, '#eef0f4'); pxEllipse(g, dir > 0 ? rx + 20 : rx - 20, 72, 2, 2, '#b9bcc4'); }   // a lever on each leaf
      if (v === 2) {                                     // where the tenant's card reader was: a pale square, four screw holes, a ragged hole, cut wires
        pxRect(g, 216, 44, 20, 28, mix(wall, '#ffffff', .3)); for (const [x, y] of [[218, 46], [233, 46], [218, 69], [233, 69]]) { pxRect(g, x, y, 2, 2, '#3a3028'); pxRect(g, x, y - 1, 2, 1, '#f8f4ec'); }
        fillPoly(g, blobPts(226, 58, 4, 4, 9, .5, 10), '#ece6da'); fillPoly(g, blobPts(226, 58, 3, 3, 11, .4, 9), '#1e1812');
        pxLine(g, 226, 58, 230, 66, '#9a9ea8', 2); pxLine(g, 230, 66, 229, 74, '#9a9ea8', 2); pxRect(g, 228, 74, 1, 3, '#d43a2a'); pxRect(g, 230, 74, 1, 2, '#f4f4ee');
        pxRect(g, 208, 58, 3, 3, '#2a2018');                                    // a hole drilled right through the frame, too
      }
      Z.vignette(g);
    },
    /* the EXIT sign over the door, up by the ceiling */
    o_exitsign(g, v, fl, t) {
      acoustic(g, 0, 0, ZW, 12, '#ebe8de', 8); pxRect(g, 0, 11, ZW, 3, '#f8f8f4'); pxRect(g, 0, 14, ZW, 1, 'rgba(60,56,48,0.3)');
      Z.wall(g, 0, 15, ZW, 100, wallOf('o_lobby'), 12);
      pxRect(g, 0, 112, ZW, 23, '#5e4a34'); pxRect(g, 0, 112, ZW, 2, '#82694a'); pxRect(g, 20, 122, 200, 13, '#4a5a66');   // the door's head frame, the top of its glass
      const dark = v === 3, on = !dark;
      if (on) softGlow(g, 120, 64, 90, 50, '#ff4a3a', v === 1 ? .12 : .2);                // red light washing the wall
      pxRect(g, 108, 18, 24, 9, '#e8e6e0'); pxRect(g, 108, 18, 24, 1, '#ffffff'); pxRect(g, 112, 26, 16, 2, '#c8c4ba');   // the canopy it hangs from
      fillPoly(g, [[66, 28], [174, 28], [176, 30], [176, 94], [174, 96], [66, 96], [64, 94], [64, 30]], '#a8a49a');
      fillPoly(g, [[67, 29], [173, 29], [175, 31], [175, 93], [173, 95], [67, 95], [65, 93], [65, 31]], '#f4f2ec');
      pxRect(g, 66, 90, 108, 5, '#dcd8ce'); pxRect(g, 72, 35, 96, 52, '#fbfaf6'); strokePoly(g, [[72, 35], [167, 35], [167, 86], [72, 86]], '#e2ded4');
      for (const [x, d] of [[76, -1], [162, 1]]) { for (let i = 0; i < 4; i++) { pxRect(g, x + d * i, 52 - i, 2, 1, '#e0dcd2'); pxRect(g, x + d * i, 60 + i, 2, 1, '#e0dcd2'); } }   // the arrow knockouts, unused
      'EXIT'.split('').forEach((ch, i) => {
        const col = dark ? '#8a5048' : v === 1 && i < 2 ? '#d04838' : '#ff2c1c';
        ftext(g, ch, 83 + i * 20, 43, col, 5);
        if (on && !(v === 1 && i < 2)) ftext(g, ch, 84 + i * 20, 44, 'rgba(255,200,180,0.35)', 5);   // a hot core in the lit letters
      });
      if (on) { g.fillStyle = 'rgba(255,90,70,0.10)'; g.fillRect(72, 35, 96, 52); }
      pxEllipse(g, 78, 86, 2, 2, '#5a5e58'); pxEllipse(g, 78, 86, 1, 1, dark ? '#2a3a2a' : (t % 2 < 1.6 ? '#6aff6a' : '#2f8a2f'));   // the charging light
      pxEllipse(g, 162, 86, 3, 3, '#9a968c'); pxEllipse(g, 162, 86, 2, 2, '#c8c4ba'); pxRect(g, 161, 85, 1, 1, '#ffffff');   // the TEST button
      if (fl.test && t - fl.test < 1.2 && on) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(72, 35, 96, 52); }
      if (v === 2) {                                    // a crushed corner and cracks across the housing
        fillPoly(g, [[158, 28], [176, 28], [176, 46], [168, 40], [164, 34]], '#3a3430'); strokePoly(g, [[158, 28], [164, 34], [168, 40], [176, 46]], '#7a766c');
        pxRect(g, 166, 33, 2, 1, '#d43a2a'); pxRect(g, 169, 37, 2, 1, '#f4f4ee');
        pxCrack(g, 160, 33, 2.5, 34, '#9a968a', 11, 1); pxCrack(g, 165, 38, 1.9, 26, '#9a968a', 17, 1);
        pxRect(g, 150, 108, 3, 2, '#f4f2ec'); pxRect(g, 158, 110, 2, 1, '#f4f2ec');   // flakes of plastic on the header
      }
      Z.vignette(g);
    },
    /* the fire extinguisher in its semi-recessed cabinet */
    o_extinguisher(g, v, fl, t) {
      Z.wall(g, 0, 0, ZW, ZH, wallOf('o_lobby'), 14); cove(g, 127);
      pxRect(g, 64, 4, 112, 128, '#b8b4aa'); pxRect(g, 65, 5, 110, 126, '#f2f0ea'); pxRect(g, 65, 5, 110, 1, '#ffffff');   // the trim
      pxRect(g, 72, 12, 96, 112, '#cfcbc2'); pxRect(g, 72, 12, 96, 6, '#b8b4aa');                                        // the recess, shadowed at the top
      if (fl.open || v === 2) { pxRect(g, 100, 28, 26, 4, '#8a8a8e'); pxRect(g, 112, 24, 4, 8, '#8a8a8e'); }               // the bracket, behind
      // the extinguisher: red cylinder, label, black valve, chrome handle, gauge, pin, hose to the nozzle
      const cx = 119;
      pxRect(g, 104, 50, 31, 60, '#c41e18'); pxEllipse(g, cx, 50, 15, 6, '#c41e18'); pxEllipse(g, cx, 110, 15, 3, '#9a1410');
      pxRect(g, 106, 48, 5, 60, '#e8483a'); pxRect(g, 129, 48, 5, 60, '#8a1410'); pxRect(g, 107, 46, 4, 2, '#f07060');
      pxRect(g, 109, 64, 21, 22, '#f4f2ec'); pxRect(g, 109, 64, 21, 3, '#2a5ac8'); for (let y = 71; y < 84; y += 3) pxRect(g, 111, y, 15 - (y % 6), 1, '#8a8a90'); ftext(g, 'ABC', 113, 77, '#c41e18');
      pxRect(g, 112, 38, 14, 10, '#26262a'); pxRect(g, 112, 38, 14, 1, '#4a4a50');
      pxLine(g, 104, 34, 130, 32, '#c9ccd4', 2); pxLine(g, 106, 40, 126, 39, '#a9acb4', 2);                               // lever and carry handle
      pxEllipse(g, 132, 41, 4, 4, '#3a3a40'); pxEllipse(g, 132, 41, 3, 3, '#f8f8f4');
      pxRect(g, 129, 40, 1, 1, '#d43a2a'); pxRect(g, 130, 38, 1, 1, '#d43a2a'); pxRect(g, 131, 38, 3, 1, '#3ac04a'); pxRect(g, 134, 38, 1, 1, '#d43a2a'); pxRect(g, 135, 40, 1, 1, '#d43a2a');   // red, green, red
      if (v === 3) pxLine(g, 132, 41, 129, 42, '#1a1a1a'); else pxLine(g, 132, 41, 132, 38, '#1a1a1a');                  // the needle
      if (v !== 3) { pxEllipse(g, 109, 36, 2, 2, '#c9ccd4'); pxRect(g, 109, 36, 1, 1, '#5a5a62'); pxLine(g, 111, 36, 114, 38, '#f2c418'); pxRect(g, 113, 38, 2, 2, '#f2c418'); }   // the pin, with its yellow tamper seal
      pxLine(g, 124, 46, 100, 50, '#1a1a1c', 2); pxLine(g, 100, 50, 97, 66, '#1a1a1c', 2); pxLine(g, 97, 66, 99, 92, '#1a1a1c', 2); pxRect(g, 96, 92, 6, 7, '#2a2a2e'); pxRect(g, 97, 99, 4, 3, '#1a1a1c');
      if (v === 3) { speckle(g, 92, 96, 14, 10, '#f4f2ea', 30, 5); speckle(g, 74, 112, 92, 12, '#f4f2ea', 110, 6); speckle(g, 104, 84, 30, 26, 'rgba(244,242,234,0.8)', 40, 7); }   // dry chemical, everywhere
      // the inspection tag, on a string from the handle
      pxLine(g, 128, 40, 140, 46, '#e8e4d8'); pxRect(g, 136, 46, 13, 20, '#fbf8ee'); pxRect(g, 136, 46, 13, 4, '#f2c418'); pxRect(g, 141, 47, 3, 2, '#2a2a2a');
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { const x = 138 + c * 4, y = 52 + r * 3, hit = v !== 3 && (r * 3 + c === 9 || (v !== 1 && r * 3 + c < 9)); pxRect(g, x, y, 2, 1, hit ? '#1a1a1a' : '#c8c4b8'); }
      // the door: a white steel frame with a clear acrylic window and red lettering
      if (fl.open) {
        fillPoly(g, [[58, 10], [72, 12], [72, 124], [58, 128]], '#e8e6e0'); pxLine(g, 58, 10, 58, 128, '#a8a49a'); pxRect(g, 64, 40, 6, 50, 'rgba(200,225,235,0.4)');
      } else {
        pxRect(g, 72, 12, 96, 112, '#f6f4ee'); pxRect(g, 72, 12, 96, 1, '#ffffff'); pxRect(g, 72, 123, 96, 1, '#b8b4aa');
        ftext(g, 'FIRE EXTINGUISHER', 86, 15, '#c41e18');
        pxRect(g, 158, 64, 4, 10, '#9a9ea8'); pxRect(g, 158, 64, 4, 1, '#d9dce4');                                       // the latch
      }
      // what's in the window frame: clear acrylic, hazed acrylic, or what's left of it
      if (!fl.open) {
        if (v !== 2) {
          g.fillStyle = v === 1 ? 'rgba(236,236,230,0.38)' : 'rgba(200,225,235,0.16)'; g.fillRect(82, 24, 76, 88);
          pxLine(g, 92, 26, 84, 50, 'rgba(255,255,255,0.45)'); pxLine(g, 104, 26, 88, 62, 'rgba(255,255,255,0.3)');
          if (v === 1) for (let i = 0; i < 9; i++) { const x = 86 + hash(i) * 66, y = 28 + hash(i + 3) * 80; pxLine(g, x, y, x + 6 + hash(i + 5) * 8, y + hash(i + 7) * 4 - 2, 'rgba(255,255,255,0.5)'); }
        } else {
          for (const sh of [[[82, 24], [100, 24], [82, 46]], [[158, 24], [136, 24], [158, 40]], [[82, 112], [82, 96], [94, 112]], [[158, 112], [158, 90], [146, 112]]]) { fillPoly(g, sh, 'rgba(210,235,242,0.55)'); strokePoly(g, sh, 'rgba(255,255,255,0.7)'); }
          for (const [x, y] of [[90, 118], [104, 120], [131, 117], [146, 119], [118, 121]]) fillPoly(g, [[x, y], [x + 4, y + 1], [x + 1, y + 3]], '#d8eef4');
        }
        if (v === 1) for (const [x, y] of [[66, 30], [66, 88], [173, 50], [120, 130], [88, 5]]) pxRect(g, x, y, 3, 2, '#8a8a86');   // chipped paint on the trim
        pxRect(g, 82, 24, 76, 1, '#b8b4aa'); pxRect(g, 82, 24, 1, 88, '#b8b4aa');
      }
      Z.vignette(g);
    },
    /* the reception desk: a raised transaction ledge over a maple front, from where a visitor stands */
    o_desk(g, v, fl, t) {
      Z.wall(g, 0, 0, ZW, 34, wallOf('o_lobby'), 16);
      const top = '#e4ded0', edge = '#cbc2ae', veneer = '#c49a62', rev = '#6e4c2a';
      fillPoly(g, [[0, 30], [226, 30], [226, 48], [0, 48]], top); speckle(g, 0, 30, 226, 18, '#cfc6b4', 220, 4); speckle(g, 0, 30, 226, 18, '#f4f0e6', 120, 5);
      pxRect(g, 0, 30, 226, 1, '#f6f2ea'); pxRect(g, 0, 48, 226, 6, edge); pxRect(g, 0, 53, 226, 1, '#a8a08c');
      pxRect(g, 0, 54, 222, 66, veneer);
      for (let x = 0; x < 222; x += 7) pxRect(g, x + (x % 3), 56, 1, 62, 'rgba(110,70,30,0.18)');   // the grain
      for (const x of [72, 146]) { pxRect(g, x, 54, 3, 66, rev); pxRect(g, x + 3, 54, 1, 66, '#d8b07a'); }
      pxRect(g, 0, 118, 222, 13, '#aeb2ba'); for (let y = 120; y < 131; y += 2) pxRect(g, 0, y, 222, 1, '#9ea2aa'); pxRect(g, 0, 118, 222, 1, '#d4d8de');
      pxRect(g, 0, 131, ZW, 4, Decor.pal('o_lobby').floor[1]);
      // the desk's end: everything carries around the same corner at the same heights (the top and its edge band, the
      // veneer in shade, the kick plate), and past it, the lobby wall and floor
      Z.wall(g, 234, 30, 6, 101, wallOf('o_lobby'), 16); pxRect(g, 234, 30, 6, 101, 'rgba(0,0,0,0.08)');   // the wall beyond, in the desk's shadow
      pxRect(g, 222, 30, 12, 18, mix(top, '#000000', .06)); pxRect(g, 222, 30, 12, 1, '#f6f2ea'); pxRect(g, 233, 30, 1, 24, '#a8a08c');   // the top, around the corner
      pxRect(g, 222, 48, 12, 6, mix(edge, '#000000', .12)); pxRect(g, 222, 53, 12, 1, '#a8a08c');
      pxRect(g, 222, 54, 12, 64, mix(veneer, '#000000', .22)); pxRect(g, 222, 54, 1, 64, '#d8b07a'); for (let x = 224; x < 234; x += 4) pxRect(g, x, 56, 1, 62, 'rgba(80,50,20,0.18)');   // the end panel, its corner catching light
      pxRect(g, 222, 118, 12, 13, '#9ea2aa'); pxRect(g, 222, 118, 12, 1, '#c4c8ce'); pxRect(g, 233, 54, 1, 77, 'rgba(0,0,0,0.25)');
      if (v === 1) {                                   // the front edge worn pale where everyone leans to sign in
        g.fillStyle = 'rgba(250,248,240,0.65)'; g.fillRect(40, 46, 150, 6); g.fillStyle = 'rgba(250,248,240,0.35)'; g.fillRect(28, 42, 174, 4);
        for (let i = 0; i < 16; i++) { const x = 40 + hash(i) * 150, y = 33 + hash(i + 4) * 12; pxLine(g, x, y, x + 5 + hash(i + 2) * 10, y + hash(i + 6) * 2, '#c8bfaa'); }
      }
      if (v === 2) for (const [x, sd] of [[84, 3], [156, 9]]) {   // two ragged cable holes, cut through without grommets
        fillPoly(g, blobPts(x, 39, 10, 5, sd, .35, 16), '#f8f4ea'); fillPoly(g, blobPts(x, 39, 8, 4, sd + 2, .3, 14), '#1a140e');
        clipDo(g, blobPts(x, 39, 8, 4, sd + 2, .3, 14), () => pxRect(g, x - 8, 40, 16, 4, '#5a4632'));
        pxCrack(g, x + 9, 38, .2, 10, '#a89c86', sd, 1); speckle(g, x - 14, 44, 28, 6, '#d8c8a0', 10, sd + 5);
      }
      if (v === 3) {                                   // the corner, smashed in: raw particleboard where the veneer and edge broke away
        const chunk = [[200, 46], [214, 44], [226, 48], [222, 74], [212, 92], [204, 84], [198, 66]];
        fillPoly(g, chunk, '#c8a878'); speckle(g, 196, 44, 32, 50, '#9c7a4a', 120, 4); speckle(g, 196, 44, 32, 50, '#e2c89c', 60, 5);
        strokePoly(g, chunk, '#5a4028'); for (const [x, y] of [[198, 66], [204, 84], [212, 92]]) pxLine(g, x, y, x - 4, y + 3, '#e2c08a');
        pxRect(g, 186, 128, 6, 3, '#c49a62'); pxRect(g, 196, 130, 4, 2, '#c8a878');                                    // a chunk of it on the floor
      }
      Z.vignette(g);
    },
    /* the wall behind reception, where the tenant's logo hung */
    o_logowall(g, v, fl, t) {
      const wall = wallOf('o_lobby'); Z.wall(g, 0, 0, ZW, ZH, wall, 18); cove(g, 127);
      const holes = []; for (let i = 0; i < 8; i++) holes.push([46 + i * 21, 42], [46 + i * 21, 66]);
      if (v === 1) {
        fillPoly(g, [[34, 28], [206, 28], [206, 96], [34, 96]], mix(wall, '#3a3020', .07));   // unfaded paint where the panel kept the light off
        g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(0, 0, ZW, 28); g.fillRect(0, 96, ZW, 31);
        for (const [x, y] of holes.filter((h, i) => i % 3 === 0)) { pxRect(g, x, y, 1, 1, '#3a3028'); pxRect(g, x, y - 1, 1, 1, '#ffffff'); }
      }
      if (v === 2) for (let i = 0; i < 8; i++) {      // letters glued on and pried off: the paper face torn away, brown paper and glue showing
        const x = 52 + i * 19, sd = i * 13 + 3, shape = blobPts(x, 54, 7 + hash(i) * 2, 13, sd, .45, 14);
        fillPoly(g, shape, '#c4a676'); strokePoly(g, shape, mix(wall, '#000000', .25));
        for (let k = 0; k < 3; k++) fillPoly(g, blobPts(x + (hash(i + k) - .5) * 8, 46 + k * 7, 2.5, 2, sd + k, .5, 8), '#ece4d4');
        for (let k = 0; k < 4; k++) pxLine(g, x - 5, 44 + k * 6, x + 4, 45 + k * 6 + (k % 2), '#d8c070');   // ridges of dried adhesive
      }
      if (v === 2) { tornHole(g, 40, 40, 3, 5, wall); tornHole(g, 200, 40, 3, 7, wall); tornHole(g, 40, 70, 3, 9, wall); tornHole(g, 200, 70, 3, 11, wall); }
      if (v === 3) {                                  // the tenant's logo, still up: brushed aluminum letters on standoffs, a swoosh, a tagline
        for (let a = 3.5; a < 5.9; a += .03) pxRect(g, 120 + Math.cos(a) * 74, 74 + Math.sin(a) * 30, 2, 2, '#2a8a9a');
        ftext(g, 'SYNERGEX', 59, 44, 'rgba(30,24,20,0.25)', 4); ftext(g, 'SYNERGEX', 56, 41, '#aeb2ba', 4);
        ftext(g, 'SYNERGEX', 56, 41, '#d8dce2', 4); g.save(); g.beginPath(); g.rect(0, 51, ZW, 10); g.clip(); ftext(g, 'SYNERGEX', 56, 41, '#9aa0aa', 4); g.restore();
        ftext(g, 'PAPER SOLUTIONS', 90, 70, '#4a5058');
      }
      Z.vignette(g);
    },
    /* the entry floor from above: the door's threshold, the walk-off mat, porcelain tile */
    o_lobbyfloor(g, v, fl, t) {
      const fp = Decor.pal('o_lobby').floor; tileTop(g, fp, 46, 20, 18);
      if (v === 1) { g.fillStyle = 'rgba(120,110,90,0.12)'; g.fillRect(70, 112, 100, 23); for (let i = 0; i < 6; i++) pxLine(g, 80 + i * 14, 118 + (i % 3) * 4, 88 + i * 14, 119 + (i % 3) * 4, 'rgba(40,40,40,0.35)'); }
      if (v === 2) { pxRect(g, 18, 64, 2, 2, '#6a665e'); for (let k = 0; k < 5; k++) pxCrack(g, 19, 65, k * 1.25 + .3, 10 + hash(k) * 10, '#6a665e', 7 + k * 9, 1); }
      pxRect(g, 0, 0, ZW, 9, '#5e4a34'); pxRect(g, 0, 8, ZW, 1, '#3a2c1e'); pxRect(g, 0, 9, ZW, 7, '#aaa8a0'); for (let x = 1; x < ZW; x += 3) pxRect(g, x, 10, 1, 5, '#8c8a82');   // the door's bottom rail, the threshold
      const M = { x: 44, y: 24, w: 152, h: 88 };
      pxRect(g, M.x, M.y, M.w, M.h, '#2a2b30'); pxRect(g, M.x, M.y, M.w, 1, '#4a4c54'); pxRect(g, M.x, M.y, 1, M.h, '#4a4c54');
      pxRect(g, M.x + 5, M.y + 5, M.w - 10, M.h - 10, '#3c3e46'); for (let y = M.y + 6; y < M.y + M.h - 5; y += 3) pxRect(g, M.x + 5, y, M.w - 10, 1, '#32343a');
      speckle(g, M.x + 5, M.y + 5, M.w - 10, M.h - 10, '#5a5c64', 160, 3);
      if (v === 1) { g.fillStyle = 'rgba(140,140,140,0.22)'; g.fillRect(92, M.y + 5, 56, M.h - 10); speckle(g, 92, M.y + 5, 56, M.h - 10, '#7a7c84', 90, 5); for (let i = 0; i < 5; i++) pxRect(g, 94 + i * 11, M.y + M.h - 6, 3, 2, '#4a4c54'); }
      if (v === 3) {                                  // the corner, curled up off the floor, its tan backing showing and torn
        clipDo(g, [[M.x - 1, M.y - 1], [M.x + 41, M.y - 1], [M.x - 1, M.y + 35]], () => tileTop(g, fp, 46, 20, 18));   // the floor it lifted off of
        fillPoly(g, [[M.x + 40, M.y], [M.x, M.y + 34], [M.x + 6, M.y + 40], [M.x + 46, M.y + 6]], 'rgba(20,16,24,0.35)');   // its shadow
        const flap = [[M.x + 40, M.y], [M.x, M.y + 34], [M.x + 10, M.y + 12], [M.x + 22, M.y - 10]];
        fillPoly(g, flap, '#9a8a6c'); speckle(g, M.x, M.y - 10, 42, 46, '#7a6a50', 60, 9); strokePoly(g, flap, '#2a2b30');
        pxLine(g, M.x + 14, M.y + 6, M.x + 24, M.y - 4, '#5a4a34'); pxLine(g, M.x + 15, M.y + 7, M.x + 21, M.y + 1, '#e8dcc0');   // a tear in the backing
      }
      Z.vignette(g);
    }
  };

  /* a fire extinguisher standing in the room at (x, z), from yb to yt, radius rad: a red cylinder shaded round (dark at
     both edges, a highlight down its lit side), a domed shoulder, a white label band, the black valve head with its
     chrome lever; an ABC has a gauge and a short black hose, a CO2 has no gauge and a big black discharge horn on its hose */
  function extRoom(g, x, z, yb, yt, rad, kind = 'abc', empty = false) {
    const b = P(x, yb, z), tp = P(x, yt, z), w = Math.max(2, Math.round(rad * CAM.f / z)), h = Math.round(b[1] - tp[1]), x0 = Math.round(b[0] - w);
    const cols = ['#7a1410', '#a81a14', '#c41e18', '#e8483a', '#d42a20', '#c41e18', '#a81a14', '#7a1410'];
    for (let i = 0; i < 2 * w; i++) pxRect(g, x0 + i, tp[1], 1, h, cols[Math.min(cols.length - 1, Math.floor(i / (2 * w) * cols.length))]);
    pxEllipse(g, b[0], tp[1], w - 1, Math.max(1, Math.round(w * .45)), '#c41e18'); pxRect(g, x0 + Math.round(w * .55), tp[1] - 1, Math.max(1, Math.round(w * .4)), 1, '#f07060');   // the shoulder, lit
    pxEllipse(g, b[0], b[1], w, Math.max(1, Math.round(w * .3)), '#5a0e0a');                                                  // the base
    const ly = Math.round(tp[1] + h * .35), lh = Math.max(2, Math.round(h * .28)); pxRect(g, x0 + 1, ly, 2 * w - 2, lh, kind === 'co2' ? '#f4f2ec' : '#f4f2ec'); pxRect(g, x0 + 1, ly, 2 * w - 2, 1, kind === 'co2' ? '#1a1a1a' : '#2a5ac8');   // the label
    const vh = Math.max(2, Math.round(w * .9)); pxRect(g, Math.round(b[0] - w * .45), tp[1] - vh - 1, Math.max(2, Math.round(w * .9)), vh, '#26262a');   // the valve head
    pxLine(g, Math.round(b[0] - w * .9), tp[1] - vh - 2, Math.round(b[0] + w * .9), tp[1] - vh - 3, '#c9ccd4');                // the lever
    if (kind === 'abc') { pxRect(g, Math.round(b[0] + w * .45), tp[1] - vh, 2, 2, '#f8f8f4'); pxRect(g, Math.round(b[0] + w * .45) + 1, tp[1] - vh, 1, 1, empty ? '#d43a2a' : '#3ac04a');   // the gauge
      pxLine(g, Math.round(b[0] - w * .45), tp[1] - vh + 1, x0 - 1, Math.round(tp[1] + h * .2), '#1a1a1c'); pxLine(g, x0 - 1, Math.round(tp[1] + h * .2), x0 - 1, Math.round(tp[1] + h * .55), '#1a1a1c'); }   // its hose
    else { pxLine(g, Math.round(b[0] - w * .45), tp[1] - vh + 1, x0 - 2, Math.round(tp[1] + h * .3), '#1a1a1c'); fillPoly(g, [[x0 - 4, Math.round(tp[1] + h * .3)], [x0, Math.round(tp[1] + h * .3)], [x0 + 1, Math.round(tp[1] + h * .75)], [x0 - 5, Math.round(tp[1] + h * .75)]], '#1a1a1c'); }   // the CO2 horn
  }

  return { FONT, ftext, ftw, extRoom, cove, acoustic, ceilGrid, carpetTiles, tornHole, tileTop, concreteTop, lit, ZOOM };
})();
