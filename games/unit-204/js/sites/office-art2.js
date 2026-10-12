'use strict';
/* ============================== SUITE 204: OFFICE ART, PART 2 ==============================
   The open office, break room, and server room close-ups, the pixel sprites for what the tenant left behind, and
   the title screen's corridor outside Suite 204. Adds to OFC (js/sites/office-art.js), using its shared pieces
   (the drop ceiling, carpet tile, cove base, the pixel font). Variant numbers match office.js. */
(() => {
  const { ftext, cove, acoustic, ceilGrid, carpetTiles, tornHole, tileTop, concreteTop, lit } = OFC;
  const wall = (room, which) => Decor.zoomWall(room, which);
  const steel = (g, x, y, w, h) => { pxRect(g, x, y, w, h, '#c4c8d0'); pxRect(g, x, y, w, 1, '#eef0f4'); pxRect(g, x, y + h - 1, w, 1, '#8a8e98'); };
  /* a stretch of counter laminate (gray, flecked) with a front edge */
  function laminate(g, x, y, w, h) { pxRect(g, x, y, w, h, '#b9b4aa'); speckle(g, x, y, w, h, '#a29c90', w * h / 10, 61); speckle(g, x, y, w, h, '#d2cdc2', w * h / 14, 62); pxRect(g, x, y + h - 3, w, 3, '#8f8a80'); }
  /* a pixel-art drop of water, a few frames of shine */
  const drip = (g, x, y) => { pxRect(g, x, y, 2, 3, '#9fd4f0'); pxRect(g, x, y, 1, 1, '#ffffff'); };

  Object.assign(OFC.ZOOM, {
    /* ---------------- OPEN OFFICE ---------------- */
    /* carpet tile from above: the aisle along the bottom, a tile seam crossing the middle */
    o_carpet(g, v, fl, t) {
      const pal = Decor.pal('o_open').floor; carpetTiles(g, pal, 44, 32, 36);
      if (v === 1) {                                   // a flattened, shinier lane, and a fuzzy pilled patch where a chair rolled for years
        g.fillStyle = 'rgba(210,210,220,0.16)'; g.fillRect(0, 98, ZW, 37); for (let x = 0; x < ZW; x += 5) pxRect(g, x, 100 + (x % 3) * 9, 3, 1, 'rgba(255,255,255,0.18)');
        for (let i = 0; i < 70; i++) { const a = hash(i) * 6.28, d = hash(i + 9) * 22; pxRect(g, 196 + Math.cos(a) * d * 1.3, 40 + Math.sin(a) * d * .8, 1, 1, i % 2 ? pal.lt : '#d8d4cc'); }
      }
      if (v === 2) {                                   // toner: a black smudge with a gray halo, ground in, set with water (a tide line)
        fillPoly(g, blobPts(122, 60, 40, 24, 13, .4, 18), 'rgba(40,40,46,0.35)'); stain(g, blobPts(122, 60, 30, 17, 14, .45, 16), 'rgba(16,16,20,0.75)', 'rgba(8,8,10,0.85)', 14);
        strokePoly(g, blobPts(122, 60, 42, 26, 15, .35, 20), 'rgba(90,90,96,0.6)'); speckle(g, 70, 28, 110, 70, '#141418', 120, 16);
      }
      if (v === 3) {                                   // two tiles buckled up off the floor in the aisle: a ridge, light on top, a shadow under
        const T = [[76, 80], [120, 80], [124, 54], [80, 50]], U = [[120, 80], [164, 82], [160, 56], [124, 54]];
        fillPoly(g, [[78, 84], [166, 86], [164, 92], [80, 90]], 'rgba(10,10,20,0.45)');
        for (const q of [T, U]) { fillPoly(g, q, mix(pal.base, '#ffffff', .12)); strokePoly(g, q, mix(pal.dk, '#000000', .35)); }
        pxLine(g, 120, 80, 124, 54, '#ffffff'); pxLine(g, 80, 50, 160, 56, mix(pal.lt, '#ffffff', .3));
        for (let x = 80; x < 162; x += 3) pxRect(g, x, 66 + Math.round(Math.sin(x / 9) * 2), 2, 1, rgba(pal.dk, .6));
      }
      Z.vignette(g);
    },
    /* looking up at the drop ceiling: tiles on a white T-bar grid, one tile square in the middle */
    o_ceiling(g, v, fl, t) {
      ceilGrid(g, 70, 15, -38);
      if (v === 1) for (const [x, y] of [[85, 32], [155, -38], [15, 32]]) { g.fillStyle = 'rgba(200,170,90,0.28)'; g.fillRect(x + 3, y + 3, 64, 64); g.fillStyle = 'rgba(90,70,30,0.12)'; g.fillRect(x + 3, y + 46, 64, 21); }
      if (v === 2) {                                   // a tile left out: the dark plenum, ductwork, and cable bundles above
        pxRect(g, 158, 35, 64, 64, '#1e1c22'); pxRect(g, 158, 50, 64, 18, '#5a5e66'); pxRect(g, 158, 50, 64, 2, '#7a7e86');
        pxLine(g, 160, 80, 220, 74, '#3a6ad0', 2); pxLine(g, 160, 84, 220, 80, '#d8d8d0', 2); pxLine(g, 160, 88, 220, 90, '#e8c030', 1);
        for (const k of [0, 1]) { const x = 88 + k * 4; pxCrack(g, x + 30, 35, 1.7, 30, '#8a8270', 11 + k, 1); }   // the cracked tile next to it
        pxRect(g, 112, 33, 14, 3, '#cfcabc');
      }
      if (v === 3) {                                   // a wet tile, sagging, its stain in rings
        g.fillStyle = 'rgba(70,50,20,0.18)'; g.fillRect(88, 35, 64, 64);
        stain(g, blobPts(120, 66, 26, 22, 31, .35, 18), 'rgba(150,110,50,0.45)', 'rgba(110,70,30,0.65)', 31);
        for (const k of [.55, .8, 1]) strokePoly(g, blobPts(120, 66, 26 * k, 22 * k, 31, .35, 18), 'rgba(100,70,30,0.6)');
        pxRect(g, 88, 92, 64, 7, 'rgba(40,30,10,0.25)'); drip(g, 120, 96 + Math.floor((t * 6) % 30));
      }
      Z.vignette(g);
    },
    /* a 2x4 troffer from below: the white frame, the prismatic lens, three tubes glowing through, its whip in the corner */
    o_troffer(g, v, fl, t) {
      ceilGrid(g, 70, -30, -50); const on = lit('o_open');
      const hang = v === 3, F = hang ? [[30, 14], [210, 26], [214, 128], [26, 110]] : [[30, 14], [210, 14], [210, 122], [30, 122]];
      if (hang) { fillPoly(g, [[30, 14], [210, 14], [210, 26]], '#1a181e'); fillPoly(g, [[26, 110], [214, 128], [214, 135], [26, 135]], 'rgba(10,10,20,0.3)'); }
      fillPoly(g, F, '#e8e8e2'); strokePoly(g, F, '#9a9a94');
      const L = F.map(([x, y], i) => [x + (i === 0 || i === 3 ? 12 : -12), y + (i < 2 ? 12 : -12)]);
      fillPoly(g, L, on ? '#f6f8ee' : '#c8ccc4');
      for (let k = 0; k < 3; k++) {                    // the tubes behind the lens
        const dead = v === 1 && k === 2, y = 38 + k * 26, col = !on || dead ? '#b4b8b0' : '#ffffff';
        clipDo(g, L, () => { pxRect(g, 40, y + (hang ? k * 4 : 0), 160, 8, col); if (dead) { pxRect(g, 40, y, 14, 8, '#4a4a50'); pxRect(g, 186, y, 14, 8, '#5a5a60'); } });
      }
      clipDo(g, L, () => { for (let y = 26; y < 122; y += 4) for (let x = 42 + (y % 8 ? 2 : 0); x < 198; x += 4) pxRect(g, x, y, 1, 1, 'rgba(120,130,140,0.25)'); });   // prismatic diamonds
      if (v === 2) {                                   // a lens cracked and broken out: a jagged hole, the tube showing bare
        const hole = [[118, 50], [150, 46], [160, 70], [136, 86], [112, 74]]; fillPoly(g, hole, on ? '#ffffff' : '#b4b8b0'); strokePoly(g, hole, '#7a7e86');
        for (const a of [.3, 1.6, 2.6, 4.2, 5.4]) pxCrack(g, 136, 66, a, 30, '#7a7e86', Math.round(a * 10), 1);
      }
      if (on && v !== 3) { g.fillStyle = 'rgba(255,255,240,0.08)'; g.fillRect(0, 0, ZW, ZH); }
      pxLine(g, 196, 18, 214, 0, '#7a7e86', 3); pxLine(g, 196, 18, 214, 0, '#a8acb4', 1); pxRect(g, 192, 16, 8, 6, '#8a8e98');   // the flex whip into the plenum
      if (hang) { pxLine(g, 206, 24, 222, 0, '#5a5e66', 3); pxLine(g, 26, 110, 26, 122, '#9a9a94'); }
      Z.vignette(g);
    },
    /* the window wall: an aluminum frame, the office park outside, mini-blinds a third of the way down, the wand */
    o_window(g, v, fl, t) {
      const T = Decor.time, sky = g.createLinearGradient(0, 0, 0, 112); sky.addColorStop(0, T.sky[0]); sky.addColorStop(1, T.sky[2]);
      pxRect(g, 0, 0, ZW, ZH, '#9aa0aa'); g.fillStyle = sky; g.fillRect(22, 4, 196, 108);
      for (const [x, w, h, c] of [[30, 50, 50, '#8a7a6c'], [96, 70, 64, '#a89c8a'], [176, 40, 44, '#7a8290']]) {   // the office park across the lot
        pxRect(g, x, 112 - h, w, h, c); for (let y = 116 - h; y < 108; y += 6) for (let xx = x + 3; xx < x + w - 3; xx += 6) pxRect(g, xx, y, 3, 3, T.id === 'golden' ? '#ffe9a8' : '#6a8aa8');
      }
      pxRect(g, 22, 104, 196, 8, '#6a7a5a'); for (let x = 28; x < 214; x += 22) pxRect(g, x, 100, 12, 6, ['#c43a3a', '#3a6ad0', '#dcdcdc', '#3a3a40'][(x / 22 | 0) % 4]);   // the parking lot
      pxRect(g, 118, 4, 4, 108, '#b4bac4');                // the mullion
      if (v === 3) {                                   // a crack running across the right pane, from a chip at the frame
        pxCrack(g, 214, 70, 3.3, 80, '#ffffff', 41, 1); pxCrack(g, 214, 70, 3.6, 40, '#e8f0f8', 42, 1); pxRect(g, 212, 68, 4, 4, '#e8f0f8');
        for (const [x, y] of [[176, 74], [150, 80]]) { pxRect(g, x - 8, y - 2, 16, 4, 'rgba(230,220,180,0.85)'); }   // somebody's masking tape
      }
      // the blinds: aluminum slats from the head rail down to y 56, ladder cords between
      pxRect(g, 20, 0, 200, 5, '#e8e8e2');
      for (let y = 6; y < 56; y += 4) {
        const gap = v === 2 && y > 22 && y < 44, kink = v === 1 && (y === 26 || y === 42);
        if (gap) { if (y === 26) { pxLine(g, 60, y, 96, y + 9, '#c8c8c0', 2); } continue; }
        const col = v === 1 ? (y % 8 ? '#e6dfc4' : '#ddd5b4') : (y % 8 ? '#e8e8e2' : '#dcdcd6');
        if (kink) { pxRect(g, 22, y, 70, 3, col); pxLine(g, 92, y, 104, y + 3, col, 3); pxRect(g, 104, y + 2, 114, 3, col); }
        else { pxRect(g, 22, y, 196, 3, col); pxRect(g, 22, y + 2, 196, 1, 'rgba(0,0,0,0.12)'); }
      }
      for (const x of [56, 118, 184]) pxRect(g, x, 4, 1, 52, '#f4f4ee');                       // ladder cords
      if (v === 2) for (const x of [56, 184]) pxLine(g, x, 22, x + 3, 46, '#f4f4ee');
      pxRect(g, 210, 8, 3, 56, '#d8d8d2'); pxRect(g, 209, 60, 5, 6, '#bcbcb4');                // the wand
      pxRect(g, 0, 112, ZW, 23, '#c4c8d0'); pxRect(g, 0, 112, ZW, 2, '#eef0f4'); speckle(g, 0, 116, ZW, 18, 'rgba(90,90,96,0.35)', 160, 43);   // the sill
      Z.vignette(g);
    },
    /* a flush floor box in carpet tile, its two hinged brass lids */
    o_floorbox(g, v, fl, t) {
      const pal = Decor.pal('o_open').floor; carpetTiles(g, pal, 44, 20, 14);
      const open = v >= 2, x = 76, y = 36, w = 88, h = 64;
      pxRect(g, x - 4, y - 4, w + 8, h + 8, '#8a7a52'); pxRect(g, x - 4, y - 4, w + 8, 2, '#c8b278');
      if (!open) {
        for (const k of [0, 1]) { const lx = x + k * 45; pxRect(g, lx, y, 43, h, v === 1 ? '#b8a878' : '#a89058'); pxRect(g, lx, y, 43, 2, '#d8c088'); pxRect(g, lx + 16, y + 28, 11, 6, '#6a5a34'); }
        if (v === 1) for (let i = 0; i < 26; i++) pxLine(g, x + 4 + hash(i) * 80, y + 4 + hash(i + 3) * 56, x + 10 + hash(i) * 80, y + 6 + hash(i + 7) * 56, '#e8d8a8');   // scuffed bright
      } else {
        pxRect(g, x, y, w, h, '#2a2a30'); pxRect(g, x + 4, y + 4, 38, h - 8, '#4a4a52'); pxRect(g, x + 46, y + 4, 38, h - 8, '#3e3e46');
        fillPoly(g, [[x, y], [x + w, y], [x + w + 10, y - 26], [x - 10, y - 26]], '#a89058'); pxRect(g, x - 10, y - 26, w + 20, 2, '#d8c088');   // the lid, flipped up
        if (v === 2) {                                 // a bundle of cut data cable, coiled out of the box across the carpet
          for (let k = 0; k < 7; k++) { const c = ['#3a6ad0', '#3a6ad0', '#8a8e98', '#3a6ad0', '#e8c030', '#8a8e98', '#3a6ad0'][k]; pxLine(g, x + 20 + k * 6, y + 30, 150 + k * 4, 70 + k * 6, c, 2); pxLine(g, 150 + k * 4, 70 + k * 6, 236, 82 + k * 7, c, 2); pxRect(g, 236, 81 + k * 7, 2, 3, '#e8b070'); }
        } else {                                       // cut-off power conductors standing up, bare copper at the ends
          for (const [k, c] of [[0, '#1d1f26'], [1, '#f2f2ea'], [2, '#3f9a3a'], [3, '#1d1f26'], [4, '#f2f2ea']]) { const bx = x + 14 + k * 13; pxLine(g, bx, y + 40, bx + (k - 2) * 4, y + 8, c, 3); pxRect(g, bx + (k - 2) * 4 - 1, y + 4, 3, 5, '#e8904a'); }
          pxRect(g, x + 50, y + 44, 30, 10, '#6a6a72');
        }
      }
      Z.vignette(g);
    },
    /* a long painted partition wall, rubber cove base, one duplex outlet low on the right */
    o_wall(g, v, fl, t) {
      const W = wall('o_open', 'right'); Z.wall(g, 0, 0, ZW, 122, W, 51); cove(g, 122, 13);
      Z.plate(g, 188, 98, 16, 20, '#f1ece0'); for (const y of [101, 109]) { pxRect(g, 193, y, 2, 4, '#3a3a40'); pxRect(g, 198, y, 2, 4, '#3a3a40'); }
      if (v === 1) {
        for (let i = 0; i < 9; i++) { const x = 10 + i * 25 + hash(i) * 10, y = 78 + hash(i + 2) * 22; pxLine(g, x, y, x + 14 + hash(i) * 10, y + 2, 'rgba(60,60,66,0.45)'); pxLine(g, x + 2, y + 1, x + 10, y + 2, 'rgba(60,60,66,0.3)'); }
        for (let i = 0; i < 16; i++) pxRect(g, 30 + hash(i * 3) * 150, 18 + hash(i * 5) * 50, 1, 1, '#4a4440');
      }
      if (v === 2) {                                   // permanent marker: a sales chart, arrows, and opinions
        const K = '#1d2a6a', R2 = '#c0270f';
        pxLine(g, 30, 90, 30, 20, K, 2); pxLine(g, 30, 90, 120, 90, K, 2); pxLine(g, 34, 80, 60, 70, R2, 2); pxLine(g, 60, 70, 84, 76, R2, 2); pxLine(g, 84, 76, 112, 30, R2, 2); pxLine(g, 106, 30, 112, 30, R2, 2); pxLine(g, 112, 30, 112, 36, R2, 2);
        ftext(g, 'Q3', 40, 24, K, 2); ftext(g, 'SYNERGY!', 128, 22, K, 2); ftext(g, 'THINK OUTSIDE', 130, 48, R2, 1); ftext(g, 'THE BOX', 142, 56, R2, 1);
        for (let a = 0; a < 6.28; a += .2) pxRect(g, 176 + Math.cos(a) * 34, 54 + Math.sin(a) * 16, 2, 1, K);
        ftext(g, 'BILL WAS HERE', 128, 82, '#3a3a40', 1);
      }
      if (v === 3) {                                   // a whiteboard's ghost, four torn anchor holes, and the tray's screw marks
        strokePoly(g, [[24, 14], [176, 14], [176, 92], [24, 92]], mix(W, '#ffffff', .22)); g.fillStyle = rgba(mix(W, '#ffffff', .3), .4); g.fillRect(25, 15, 151, 77);
        for (const [x, y, r, s] of [[36, 24, 4, 7], [164, 24, 5, 9], [36, 82, 4, 11], [164, 80, 6, 13]]) tornHole(g, x, y, r, s, W);
        for (const x of [60, 100, 140]) { pxRect(g, x, 95, 2, 2, '#5a4a3a'); }
      }
      Z.vignette(g);
    },
    /* ---------------- BREAK ROOM ---------------- */
    /* the break room sink: backsplash, gray laminate counter, a stainless basin, laminate doors below */
    o_sink(g, v, fl, t) {
      Z.wall(g, 0, 0, ZW, 24, wall('o_break'), 61); laminate(g, 0, 22, ZW, 46);
      pxRect(g, 66, 28, 110, 34, '#c8ccd4'); pxRect(g, 66, 28, 110, 1, '#eef0f4'); fillPoly(g, [[70, 32], [172, 32], [164, 44], [78, 44]], '#a4a9b2'); pxRect(g, 78, 44, 86, 14, '#8a8f98'); pxEllipse(g, 121, 52, 4, 2, '#3a3d44');
      pxRect(g, 106, 22, 28, 5, '#c9ccd4'); pxRect(g, 118, 4, 4, 19, '#c9ccd4'); pxRect(g, 119, 4, 1, 19, '#ffffff'); pxRect(g, 104, 2, 18, 4, '#c9ccd4'); pxRect(g, 102, 4, 4, 9, '#c9ccd4'); pxRect(g, 130, 16, 8, 3, '#d9dce4');
      if (v === 1) { speckle(g, 104, 20, 32, 8, '#f6f6f0', 50, 5); pxRect(g, 104, 25, 32, 2, '#ecece4'); }
      if (v === 2) { pxRect(g, 182, 22, 8, 5, '#c9ccd4'); pxRect(g, 184, 10, 4, 13, '#d9dce4'); pxRect(g, 177, 8, 11, 3, '#d9dce4'); pxRect(g, 186, 12, 2, 2, '#d43a2a'); }   // the instant-hot tap
      // the cabinet: two laminate doors
      pxRect(g, 0, 68, ZW, 67, '#cfc8b8'); for (const x of [0, 216]) { pxRect(g, x + 2, 70, 22, 65, '#e2dccc'); pxRect(g, x + 2, 70, 22, 1, '#f2eee2'); }   // the cabinet run on either side for (const dx of [28, 122]) { pxRect(g, dx, 70, 90, 65, v === 3 ? '#d4ccba' : '#e2dccc'); pxRect(g, dx, 70, 90, 1, '#f2eee2'); pxRect(g, dx + (dx < 100 ? 80 : 6), 92, 3, 14, '#9aa0aa'); }
      if (v === 3) {                                   // swollen bottoms: the particleboard bubbling out under the laminate, and a drip
        for (const dx of [28, 122]) { fillPoly(g, [[dx, 122], [dx + 90, 122], [dx + 92, 135], [dx - 2, 135]], '#c8b890'); for (let x = dx + 2; x < dx + 88; x += 7) pxEllipse(g, x, 126, 3, 2, '#d8c8a0'); }
        g.fillStyle = dither('#6a4a2a', 6); g.fillRect(30, 112, 180, 10); drip(g, 120, 126 + Math.floor((t * 5) % 8));
      }
      if (v === 4) {                                   // the left door ajar: bleach and ammonia jugs, both leaking, one unlabeled
        pxRect(g, 28, 70, 40, 65, '#1e1a16'); fillPoly(g, [[28, 70], [16, 66], [16, 135], [28, 135]], '#e2dccc');
        pxRect(g, 34, 92, 14, 30, '#f4f4f0'); pxRect(g, 38, 88, 6, 5, '#3a6ad0'); pxRect(g, 36, 100, 10, 8, '#3a6ad0');
        pxRect(g, 50, 96, 14, 26, '#e8e4c8'); pxRect(g, 53, 92, 7, 5, '#e8c030');
        g.fillStyle = 'rgba(200,220,180,0.5)'; g.fillRect(30, 122, 40, 4); for (let i = 0; i < 4; i++) pxRect(g, 40 + i * 6, 64 - ((t * 10 + i * 7) % 20), 1, 3, 'rgba(220,240,200,0.6)');
      }
      Z.vignette(g);
    },
    /* the GFCI on the backsplash: plate, two receptacles, TEST and RESET between them */
    o_gfci(g, v, fl, t) {
      const B = wall('o_break'); Z.wall(g, 0, 0, ZW, ZH, B, 71); pxRect(g, 0, 112, ZW, 23, '#b9b4aa'); pxRect(g, 0, 112, ZW, 2, '#d2cdc2');
      const pc = v === 1 ? '#e6d59a' : '#f1ece0'; Z.plate(g, 64, 6, 112, 92, pc);
      pxRect(g, 82, 14, 76, 76, v === 1 ? '#ebe0b0' : '#f8f6ee'); pxRect(g, 82, 14, 76, 1, '#ffffff');
      for (const y of [18, 66]) { pxRect(g, 104, y, 6, 12, '#2a2a30'); pxRect(g, 130, y, 6, 12, '#2a2a30'); pxEllipse(g, 120, y + 16, 3, 2, '#2a2a30'); }
      pxRect(g, 98, 42, 44, 11, '#ece4d0'); pxRect(g, 98, 53, 44, 11, '#d8cfb6'); ftext(g, 'TEST', 112, 45, '#3a3a40'); ftext(g, 'RESET', 110, 56, '#3a3a40');
      Z.screw(g, 120, 10); Z.screw(g, 120, 94);
      if (v === 2) { fillPoly(g, [[64, 70], [92, 98], [64, 98]], B); strokePoly(g, [[64, 70], [92, 98]], '#8b8574'); pxCrack(g, 92, 70, .8, 30, '#8b8574', 7, 1); }
      if (v === 3) for (const y of [18, 66]) { fillPoly(g, blobPts(120, y + 8, 22, 12, y, .5, 14), 'rgba(80,46,16,0.55)'); for (const x of [104, 130]) { pxRect(g, x - 1, y - 2, 8, 16, 'rgba(60,30,10,0.55)'); } }
      Z.vignette(g);
    },
    /* a white top-freezer fridge, the fresh-food door swung open toward you on the right */
    o_fridge(g, v, fl, t) {
      Z.wall(g, 0, 0, ZW, 124, wall('o_break'), 81); pxRect(g, 0, 124, ZW, 11, '#d8d0bc');
      pxRect(g, 60, 0, 120, 124, '#f2f2ee'); pxRect(g, 62, 2, 116, 40, '#ffffff'); pxRect(g, 62, 41, 116, 2, '#c8c8c0'); pxRect(g, 150, 14, 4, 22, '#d8d8d0');   // freezer door and its handle
      pxRect(g, 64, 48, 12, 48, '#d8d8d0'); pxRect(g, 66, 50, 4, 44, '#ececE6');                // the pull on the cabinet
      const cold = v !== 3;
      pxRect(g, 78, 46, 90, 76, cold ? '#e8f2f6' : '#ece8de');                                  // the inside
      for (const y of [70, 94]) { pxRect(g, 80, y, 86, 2, '#c8d4dc'); pxRect(g, 80, y + 2, 86, 1, '#a8b4bc'); }
      pxRect(g, 82, 104, 82, 16, '#dceaf0'); pxRect(g, 82, 104, 82, 1, '#ffffff');               // the crisper
      if (cold) { g.fillStyle = 'rgba(200,230,255,0.15)'; g.fillRect(78, 46, 90, 76); }
      if (v === 2) {                                   // abandoned lunches, gone furry
        pxRect(g, 86, 58, 22, 12, '#f4f0e0'); pxRect(g, 86, 58, 22, 2, '#3a6ad0'); speckle(g, 88, 60, 18, 8, '#6a9a3a', 20, 3);
        pxRect(g, 114, 60, 18, 10, '#f8f8f4'); pxRect(g, 116, 56, 14, 4, '#d43a2a'); speckle(g, 114, 60, 18, 10, '#4a7a3a', 14, 5);
        pxRect(g, 140, 80, 20, 14, '#e8e0c8'); pxRect(g, 142, 76, 16, 4, '#c8a070'); speckle(g, 140, 80, 20, 14, '#5a8a40', 24, 7);   // a takeout box
        pxRect(g, 96, 82, 10, 12, '#f4f4f0'); pxRect(g, 98, 79, 6, 3, '#3a6ad0');                 // a milk carton, past saving
      }
      if (v === 3) { g.fillStyle = 'rgba(140,180,210,0.5)'; g.fillRect(40, 125, 160, 8); fillPoly(g, blobPts(120, 129, 70, 5, 51, .3, 16), 'rgba(160,200,230,0.55)'); drip(g, 100, 120); }
      fillPoly(g, [[166, 46], [190, 40], [190, 132], [166, 122]], '#e8e8e2');                   // the open door, edge on
      pxRect(g, 168, 44, 12, 78, v === 1 ? '#bcbcb4' : '#d0d0c8');                               // its gasket
      if (v === 1) { fillPoly(g, [[168, 112], [180, 108], [180, 122], [168, 122]], '#8a8a82'); pxLine(g, 169, 114, 179, 110, '#5a5a52'); }   // cracked and flattened at the corner
      for (const y of [56, 80, 104]) pxRect(g, 182, y, 6, 2, '#c8d4dc');
      Z.vignette(g);
    },
    /* a black countertop microwave: the door with its mesh window, the keypad, the cord out the back */
    o_microwave(g, v, fl, t) {
      Z.wall(g, 0, 0, ZW, 104, wall('o_break'), 91); laminate(g, 0, 102, ZW, 33);
      pxRect(g, 26, 10, 182, 92, '#1d1f26'); pxRect(g, 26, 10, 182, 2, '#3a3d46');
      pxRect(g, 30, 16, 122, 80, '#26282e'); pxRect(g, 40, 24, 100, 64, '#141418');
      for (let y = 25; y < 88; y += 2) for (let x = 41 + (y % 4 ? 1 : 0); x < 140; x += 2) pxRect(g, x, y, 1, 1, 'rgba(90,96,110,0.45)');   // the window's mesh
      pxRect(g, 148, 30, 4, 50, '#3a3d46');
      pxRect(g, 156, 18, 48, 78, '#2a2c32'); pxRect(g, 162, 22, 36, 10, '#3a5a3a'); ftext(g, '12:00', 166, 25, '#8aff8a');
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) pxRect(g, 164 + c * 11, 38 + r * 10, 8, 6, v === 1 && (r + c) % 2 ? '#5a5c64' : '#8a8e98');
      pxRect(g, 164, 80, 30, 9, '#c43a3a'); ftext(g, 'START', 168, 82, '#ffffff');
      if (v === 1) { speckle(g, 44, 70, 90, 16, 'rgba(160,120,60,0.45)', 40, 3); pxEllipse(g, 70, 82, 10, 3, 'rgba(160,110,50,0.4)'); }
      if (v === 2) { pxRect(g, 120, 28, 16, 20, '#3a2a1a'); fillPoly(g, blobPts(128, 38, 14, 12, 9, .5, 12), 'rgba(40,20,8,0.9)'); for (const [x, y] of [[100, 40], [108, 60], [94, 72]]) pxRect(g, x, y, 2, 2, '#5a3a20'); pxRect(g, 60, 74, 24, 2, '#c8ccd4'); }
      // the cord out the back to the outlet, or hanging off the counter frayed
      if (v === 3) { pxLine(g, 206, 84, 226, 100, '#1d1f26', 3); pxLine(g, 226, 100, 230, 132, '#1d1f26', 3); pxRect(g, 227, 110, 5, 6, '#e8904a'); pxRect(g, 226, 128, 9, 7, '#2a2a30'); pxRect(g, 228, 134, 2, 1, '#c8ccd4'); }
      else { pxLine(g, 206, 86, 222, 96, '#1d1f26', 3); pxLine(g, 222, 96, 236, 92, '#1d1f26', 3); }
      Z.vignette(g);
    },
    /* the break room's vinyl composition tile, from above */
    o_vct(g, v, fl, t) {
      const pal = Decor.pal('o_break').floor; tileTop(g, pal, 38, 10, 18);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, 0, ZW, ZH);
      if (v === 0) Z.sunbeam(g, 130, 60, 2);
      if (v === 1) { const lane = []; for (let i = 0; i <= 10; i++) lane.push([i * 26 - 10, 40 + i * 6 + Math.sin(i) * 4]); for (let i = 10; i >= 0; i--) lane.push([i * 26, 74 + i * 6 + Math.sin(i) * 4]); fillPoly(g, lane, 'rgba(110,100,84,0.28)'); speckle(g, 0, 40, ZW, 90, 'rgba(70,60,46,0.25)', 200, 7); }
      if (v === 2) for (let k = 0; k < 4; k++) { const y = 30 + k * 22; pxLine(g, 14, y, 226, y + 14 - k * 3, '#6a6050', 1); pxLine(g, 14, y + 1, 226, y + 15 - k * 3, 'rgba(255,255,255,0.4)', 1); }
      if (v === 3) {                                   // the tile at (86, 56) cracked across, one corner lifted and sharp
        pxCrack(g, 88, 60, .6, 50, '#3a2a1a', 23, 1);
        fillPoly(g, [[110, 94], [124, 80], [130, 88], [116, 98]], 'rgba(20,12,4,0.45)'); fillPoly(g, [[106, 94], [124, 78], [124, 94]], pal[1]); pxLine(g, 106, 94, 124, 78, '#ffffff');
      }
      Z.vignette(g);
    },
    /* the wall-mounted first aid cabinet: white steel, a red cross, the latch on the right */
    o_firstaid(g, v, fl, t) {
      Z.wall(g, 0, 0, ZW, ZH, wall('o_break', 'left'), 101);
      pxRect(g, 76, 12, 92, 112, 'rgba(30,20,30,0.25)'); pxRect(g, 74, 10, 92, 112, '#d8d8d2');      // the box and its shadow
      const shelves = full => {                        // what's inside: bandage boxes, gauze, tape, ointment
        pxRect(g, 80, 16, 80, 100, '#f4f4ee'); for (const y of [46, 78]) pxRect(g, 80, y, 80, 3, '#c8c8c0');
        const items = full ? [[84, 24, 18, 22, '#3a6ad0'], [104, 30, 14, 16, '#f2f2ea'], [120, 26, 16, 20, '#d43a2a'], [140, 30, 16, 16, '#f2c418'], [84, 58, 22, 20, '#f2f2ea'], [110, 62, 12, 16, '#3f9a3a'], [126, 56, 30, 22, '#e8e0c8'], [86, 90, 30, 24, '#3a6ad0'], [122, 94, 34, 20, '#f2f2ea']] : [[84, 30, 18, 16, '#3a6ad0'], [126, 64, 14, 14, '#e8e0c8']];
        for (const [x, y, w, h, c] of items) { pxRect(g, x, y, w, h, c); pxRect(g, x, y, w, 1, 'rgba(255,255,255,0.6)'); }
        if (!full) { pxRect(g, 110, 92, 20, 22, '#e8e0c8'); pxRect(g, 112, 94, 16, 18, '#f8f6ee'); }   // an empty bandage box, flap open
      };
      if (v === 2) {                                   // the door wrenched off its top hinge, hanging crooked
        shelves(true); fillPoly(g, [[70, 40], [150, 18], [168, 124], [92, 136]], '#e8e8e2'); strokePoly(g, [[70, 40], [150, 18], [168, 124], [92, 136]], '#9a9a94');
        pxRect(g, 112, 66, 14, 34, '#d43a2a'); fillPoly(g, [[100, 76], [138, 70], [140, 82], [102, 88]], '#d43a2a'); pxRect(g, 74, 12, 4, 8, '#8a8a84');
      } else if (v === 1) {                            // the door ajar: thin pickings inside
        shelves(false); fillPoly(g, [[74, 10], [110, 4], [110, 128], [74, 122]], '#ececE6'); strokePoly(g, [[74, 10], [110, 4], [110, 128], [74, 122]], '#9a9a94');
        pxRect(g, 86, 52, 10, 22, '#d43a2a'); pxRect(g, 82, 58, 18, 10, '#d43a2a');
      } else {
        pxRect(g, 76, 12, 88, 108, '#f2f2ec'); pxRect(g, 76, 12, 88, 2, '#ffffff');
        pxRect(g, 112, 36, 16, 44, '#d43a2a'); pxRect(g, 98, 50, 44, 16, '#d43a2a'); ftext(g, 'FIRST AID', 102, 92, '#d43a2a');
        pxRect(g, 150, 58, 8, 14, '#9aa0aa'); pxRect(g, 151, 59, 6, 2, '#c8ccd4');
      }
      Z.vignette(g);
    },
    /* ---------------- SERVER ROOM ---------------- */
    /* the panelboard, door open: the directory on the door, the breakers, and the floor marked off in front */
    o_panel(g, v, fl, t) {
      Z.wall(g, 0, 0, ZW, 114, wall('o_server'), 111); concreteTop(g, Decor.pal('o_server').floor, 0, 114, ZW, 21);
      if (v !== 2) for (let x = -10; x < ZW; x += 12) fillPoly(g, [[x, 116], [x + 6, 116], [x + 12, 134], [x + 6, 134]], '#f2c418');   // yellow-and-black floor tape: keep clear
      if (v !== 2) for (let x = -4; x < ZW; x += 12) fillPoly(g, [[x, 116], [x + 6, 116], [x + 12, 134], [x + 6, 134]], '#1d1f26');
      pxRect(g, 74, 8, 92, 104, '#8a8e98'); pxRect(g, 76, 10, 88, 100, '#a4a8b2');                     // the can
      pxRect(g, 32, 10, 42, 100, '#9a9ea8'); pxRect(g, 36, 14, 34, 90, v === 1 ? '#e8e0c4' : '#f8f6ee');   // the open door, and the directory on it
      for (let k = 0; k < 18; k++) { const y = 16 + k * 5; pxRect(g, 38, y, 2, 3, '#3a3a40'); pxRect(g, 42, y + 1, 10 + (k * 7) % 16, 1, v === 1 && k % 3 ? 'rgba(80,80,90,0.45)' : '#3a3a40'); }
      if (v === 1) speckle(g, 36, 14, 34, 90, 'rgba(120,100,70,0.4)', 60, 5);
      if (v === 3) {                                   // the dead-front off: copper bus bars and terminals, bare
        pxRect(g, 78, 12, 84, 94, '#3a3a40'); for (const x of [112, 126]) pxRect(g, x, 16, 6, 86, '#d8904a');
        for (let k = 0; k < 9; k++) for (const side of [0, 1]) { const y = 18 + k * 9, x = side ? 132 : 86; pxRect(g, x, y, 22, 6, '#1d1f26'); pxLine(g, side ? x : x + 22, y + 3, side ? x - 16 : x + 34, y + 3 + (k % 2), ['#1d1f26', '#d43a2a', '#3a6ad0'][k % 3], 2); }
        fillPoly(g, [[170, 20], [214, 12], [222, 112], [176, 116]], '#a4a8b2'); strokePoly(g, [[170, 20], [214, 12], [222, 112], [176, 116]], '#6a6e78');   // the cover, leaned against the wall
      } else {
        pxRect(g, 78, 12, 84, 94, '#c4c8d0');
        for (let k = 0; k < 9; k++) for (const side of [0, 1]) { const y = 16 + k * 10, x = side ? 124 : 82; pxRect(g, x, y, 34, 7, '#2a2c32'); pxRect(g, x + (side ? 2 : 24), y + 2, 8, 3, '#e8e8e2'); }
        pxRect(g, 150, 48, 14, 20, '#6a6e78'); pxRect(g, 152, 54, 10, 6, '#3a3a40');
      }
      if (v === 2) {                                   // the tenant's boxes, stacked right in the working space
        for (const [x, y, w, h] of [[52, 92, 64, 43], [112, 98, 74, 37], [70, 52, 60, 42], [126, 62, 52, 36]]) { pxRect(g, x, y, w, h, '#c8a070'); pxRect(g, x, y, w, 2, '#d8b484'); pxRect(g, x + w / 2 - 6, y, 12, h, 'rgba(160,120,70,0.5)'); pxRect(g, x, y + h - 2, w, 2, '#a07c4a'); }
        ftext(g, 'SYNERGEX', 76, 70, '#5a3a1a'); ftext(g, 'FY06 FILES', 120, 112, '#5a3a1a');
      }
      Z.vignette(g);
    },
    /* the four-post equipment rack, bolted to the floor */
    o_rack(g, v, fl, t) {
      Z.wall(g, 0, 0, ZW, 114, wall('o_server'), 121); concreteTop(g, Decor.pal('o_server').floor, 0, 112, ZW, 23);
      const lean = v === 3 ? 6 : 0, X = (x, y) => x + lean * (1 - y / 112);
      fillPoly(g, [[X(64, 0), 0], [X(176, 0), 0], [176, 112], [64, 112]], v === 2 ? '#1a1b20' : '#26282e');
      for (const x of [66, 166]) fillPoly(g, [[X(x, 0), 0], [X(x + 8, 0), 0], [x + 8, 112], [x, 112]], v === 1 ? '#3a3d46' : '#2e3038');
      for (let y = 4; y < 110; y += 4) { pxRect(g, X(68, y), y, 2, 1, '#6a6e78'); pxRect(g, X(170, y), y, 2, 1, '#6a6e78'); }       // the rail holes
      if (v === 1) { speckle(g, 64, 0, 112, 112, '#5a5e68', 60, 3); for (const y of [30, 64]) { pxRect(g, X(80, y), y, 6, 18, '#3a3a40'); pxRect(g, X(80, y), y + 6, 6, 3, '#1d1f26'); } }
      if (v === 2 || v === 3) {                        // gear: switches with blinking lights, a patch panel, a server, and the cable spaghetti
        const gear = v === 2 ? [[8, 10, '#3a3d46'], [20, 10, '#3a3d46'], [34, 14, '#2a2c32'], [52, 22, '#4a4c54'], [80, 24, '#3a3d46']] : [[4, 26, '#4a4c54'], [32, 22, '#3a3d46']];
        for (const [y, h, c] of gear) { pxRect(g, X(74, y), y, 92, h, c); pxRect(g, X(74, y), y, 92, 1, '#6a6e78'); for (let k = 0; k < 10; k++) pxRect(g, X(80 + k * 8, y), y + 3, 2, 2, (Math.floor(t * 4 + k * y) % 3) ? '#7bff6b' : '#3a6a3a'); }
        if (v === 2) for (let k = 0; k < 12; k++) pxLine(g, 84 + k * 7, 15, 70 + (k * 13) % 30, 60 + k * 4, ['#3a6ad0', '#d43a2a', '#f2c418', '#f2f2ea'][k % 4], 1);
      }
      // the base: anchor plates and bolts (one pulled up and loose when it leans)
      for (const x of [56, 168]) { pxRect(g, x, 110, 22, 6, '#4a4c54'); pxRect(g, x + 4, 108, 4, 4, '#9aa0aa'); pxRect(g, x + 14, 108, 4, 4, '#9aa0aa'); }
      if (v === 3) { pxRect(g, 60, 100, 4, 10, '#9aa0aa'); pxRect(g, 58, 98, 8, 3, '#c8ccd4'); pxRect(g, 52, 114, 30, 4, 'rgba(20,20,20,0.4)'); fillPoly(g, blobPts(66, 120, 10, 4, 3, .4, 10), '#8a8a84'); }
      Z.vignette(g);
    },
    /* the building's floor-standing UPS: a black tower with a little LCD */
    o_ups(g, v, fl, t) {
      Z.wall(g, 0, 0, ZW, 122, wall('o_server'), 131); concreteTop(g, Decor.pal('o_server').floor, 0, 122, ZW, 13);
      const bulge = v === 3 ? 4 : 0;
      fillPoly(g, [[76, 0], [180, 0], [180 + bulge, 60], [180, 122], [76, 122]], '#1d1f26'); pxRect(g, 76, 0, 104, 10, '#2e3038');
      fillPoly(g, [[164, 2], [180, 2], [180 + bulge, 60], [180, 120], [164, 120]], '#26282e');
      const disp = v === 0 ? ['#2a4a2a', '#8aff8a', 'ONLINE 100%'] : v === 1 ? ['#4a3a10', '#ffc040', 'REPLACE BATT'] : v === 3 ? ['#4a1010', '#ff6a5a', 'OVERTEMP!'] : ['#2a4a2a', '#8aff8a', 'ONLINE 98%'];
      pxRect(g, 88, 14, 64, 24, '#3a3d46'); pxRect(g, 92, 18, 56, 16, disp[0]); ftext(g, disp[2], 94, 23, disp[1]);
      if (v === 3 && Math.floor(t * 3) % 2) pxRect(g, 152, 40, 4, 4, '#ff3a2a');
      for (let y = 58; y < 112; y += 4) pxRect(g, 86, y, 68, 2, '#0e0f12');                     // the vents
      if (v === 1) speckle(g, 84, 56, 72, 58, '#8a8a84', 140, 3);
      if (v === 2) { fillPoly(g, [[110, 40], [126, 40], [124, 120], [112, 120]], 'rgba(110,70,30,0.6)'); pxCrack(g, 90, 44, .3, 40, '#5a5c64', 9, 1); }
      if (v === 3) { for (let i = 0; i < 4; i++) pxRect(g, 184 + i * 6, 30 - ((t * 12 + i * 9) % 30), 1, 4, 'rgba(255,240,200,0.4)'); pxRect(g, 182, 56, 3, 10, 'rgba(255,255,255,0.3)'); }
      Z.vignette(g);
    },
    /* the wall-mounted ductless AC head over the panel side of the room, its line set cover running down */
    o_minisplit(g, v, fl, t) {
      const W = wall('o_server'); Z.wall(g, 0, 0, ZW, ZH, W, 141);
      const body = v === 1 ? '#ece4c4' : '#f6f6f2';
      pxRect(g, 28, 22, 188, 40, 'rgba(30,20,30,0.2)'); pxRect(g, 26, 20, 188, 40, body); pxRect(g, 26, 20, 188, 2, '#ffffff');
      pxRect(g, 26, 58, 188, 4, mix(body, '#000000', .1)); for (let x = 40; x < 200; x += 8) pxRect(g, x, 24, 4, 1, 'rgba(0,0,0,0.08)');
      pxRect(g, 180, 30, 20, 4, '#3a3a40'); pxRect(g, 196, 31, 2, 2, (Math.floor(t * 2) % 2) || v === 3 ? '#7bff6b' : '#3a6a3a');
      if (v === 2) { pxRect(g, 36, 62, 90, 12, body); fillPoly(g, [[126, 62], [204, 62], [196, 92], [124, 74]], '#e8e8e2'); pxCrack(g, 120, 22, 1.4, 38, '#9a9a94', 5, 1); }
      else { pxRect(g, 36, 60, 168, 14, mix(body, '#000000', .14)); for (let x = 38; x < 202; x += 6) pxRect(g, x, 62, 4, 10, mix(body, '#000000', .25)); }
      if (v === 1) speckle(g, 36, 60, 168, 14, '#8a8a84', 120, 3);
      pxRect(g, 196, 62, 22, 73, '#ececE6'); pxRect(g, 196, 62, 2, 73, '#ffffff');               // the line set cover
      if (v === 3) { for (const [x, w, k] of [[62, 3, .55], [67, 2, .4], [71, 2, .3]]) fillPoly(g, [[x, 74], [x + w, 74], [x + w + 4, 135], [x + 3, 135]], rgba(mix(W, '#2a1a10', .6), k)); fillPoly(g, blobPts(70, 132, 14, 3, 5, .4, 12), rgba(mix(W, '#2a1a10', .6), .4)); drip(g, 66, 74 + Math.floor((t * 14) % 60)); }   // condensate trails down the wall
      Z.vignette(g);
    },
    /* looking up: a red sprinkler main, a drop, and a pendent head over the rack */
    o_sprinkler(g, v, fl, t) {
      ceilGrid(g, 80, 20, -20, '#e6e3d8');
      pxRect(g, 0, 22, ZW, 16, '#c43a3a'); pxRect(g, 0, 22, ZW, 3, '#e86a5a'); pxRect(g, 0, 35, ZW, 3, '#8a2418');
      for (const x of [40, 200]) { pxRect(g, x, 18, 10, 24, '#6a6e78'); pxRect(g, x + 2, 16, 6, 4, '#9aa0aa'); }   // the hangers
      pxRect(g, 114, 38, 12, 6, '#c43a3a'); pxRect(g, 110, 44, 20, 8, '#c8ccd4'); pxRect(g, 116, 52, 8, 10, '#d8b440');   // the drop and the head's frame
      pxRect(g, 117, 54, 6, 8, v === 3 ? '#d43a2a' : '#e86a3a');                                        // the glass bulb
      pxRect(g, 106, 62, 28, 4, '#d8b440'); for (let x = 108; x < 132; x += 4) pxRect(g, x, 66, 2, 2, '#c8a030');   // the deflector
      if (v === 1) speckle(g, 104, 42, 32, 28, '#a8a49a', 90, 5);
      if (v === 2) for (let k = 0; k < 4; k++) { pxLine(g, 0, 40 + k * 2, ZW, 42 + k * 2, ['#3a6ad0', '#3a6ad0', '#8a8e98', '#f2c418'][k], 1); for (let x = 20; x < ZW; x += 46) pxRect(g, x, 20, 2, 26, '#1d1f26'); }
      if (v === 3) { speckle(g, 104, 42, 32, 28, '#f0ecdc', 110, 7); speckle(g, 0, 22, ZW, 16, '#f0ecdc', 60, 9); }   // ceiling paint, overspray on the head and pipe
      if (v === 4) for (const [x, y, w] of [[10, 78, 70], [84, 74, 80], [168, 80, 66]]) { pxRect(g, x, y, w, 61, '#c8a070'); pxRect(g, x, y, w, 2, '#d8b484'); pxRect(g, x + w / 2 - 5, y, 10, 61, 'rgba(160,120,70,0.5)'); }
      else { g.fillStyle = 'rgba(20,20,30,0.15)'; g.fillRect(0, 72, ZW, 63); pxRect(g, 64, 110, 112, 25, '#26282e'); }   // the top of the rack, far below
      Z.vignette(g);
    }
  });

  /* ============================== LEFT BEHIND: pixel sprites (palette SPR_PAL in js/itemsprites.js) ============================== */
  OFC.SPRITES = {
    o_tps: ['oooooooooo', 'oWkkkkkkWo', 'oWWWWWWWWo', 'oWkgkkgkWo', 'oWWWWWWWWo', 'oWkkgkkgWo', 'oWWWWWWWWo', 'oWRRWWWWWo', 'oWWWWWkkWo', 'oooooooooo'],
    o_toner: ['............', '.oooooooooo.', 'oKKKKKKKKKKo', 'oKgggggggKKo', 'oKKKKKKKKKKo', 'oKKKKKKKKKKo', '.oooooooooo.'],
    o_cardfile: ['...oooooo...', '..oWWWWWWo..', '.oWWWWWWWWo.', '.oWkWkWkWWo.', 'ooWWWWWWWWoo', 'oKoooooooooK', 'oKKKKKKKKKKo', '.oooooooooo.'],
    o_plant: ['...E.e.E....', '..EeE.eEe...', '.eE.EeE.Ee..', '..EeEeEeE...', '...eEEEe....', '....oNNo....', '...oNNNNo...', '...oNNNNo...', '....oooo....'],
    o_motposter: ['oooooooooooo', 'onbbbbbbbbno', 'onbbbWbbbbno', 'onbbWWWbbbno', 'onbWkkkWbbno', 'onWkkkkkWbno', 'onKKKKKKKKno', 'onKWWWWWWKno', 'onKKKKKKKKno', 'oooooooooooo'],
    o_nameplate: ['..............', '.oooooooooooo.', 'oYyyyyyyyyyyYo', 'oYyKKyKyKKyyYo', 'oYyyyyyyyyyyYo', '.oNNNNNNNNNNo.', '..oooooooooo..'],
    o_fax: ['.....oooooo...', '....oWWWWWo...', '..oooWkkWWooo.', '.owwwwwwwwwwwo', 'owwKKwwggggwwo', 'owwKKwwggggwwo', 'owwwwwwwwwwwwo', 'owwwwwwwwwwwwo', '.ooooooooooooo'],
    o_crt: ['.oooooooooo..', 'owwwwwwwwwwo.', 'owKKKKKKKKwwo', 'owKbbKKKKKwwo', 'owKbKKKKKKwwo', 'owKKKKKKKKwwo', 'owwwwwwwwwwwo', '.ooowwwwooooo', '..owwwwwwo...', '..oooooooo...'],
    o_zipdisk: ['oooooooo', 'oBBBBBBo', 'oBWWWWBo', 'oBWkkWBo', 'oBBBBBBo', 'oBggggBo', 'oooooooo'],
    o_keyboard: ['oooooooooooooooo', 'owWwWwWwWwWwWwWo', 'owWwWwWwWwWwWwWo', 'owwWwWwWwWwWwwwo', 'owwwWWWWWWWWwwwo', 'oooooooooooooooo'],
    o_bossmug: ['.oooooo..', 'oWWWWWWo.', 'oWkWkWWooo', 'oWWWWWWo.o', 'oWkkkWWo.o', 'oWWWWWWooo', 'oWWWWWWo..', '.oooooo...'],
    o_trophy: ['..oYYo..', '.oYYYYo.', 'oYoYYoYo', '.oYYYYo.', '..oYYo..', '...oo...', '..oyyo..', '.oNNNNo.', '.oooooo.']
  };

  /* ============================== TITLE: the corridor outside Suite 204 ============================== */
  let cache = null;
  OFC.title = (g, t) => {
    if (!cache) {
      cache = document.createElement('canvas'); cache.width = SW; cache.height = SH; const h = cache.getContext('2d'), r = { x0: -3.4, x1: 3.4, h: 4, zb: 17 };
      fillPoly(h, [P(r.x0, r.h, 1.5), P(r.x1, r.h, 1.5), P(r.x1, r.h, r.zb), P(r.x0, r.h, r.zb)], '#e8e5dc');               // the drop ceiling
      for (let z = 2; z < r.zb; z += 1.2) lineW(h, P(r.x0, r.h, z), P(r.x1, r.h, z), '#f8f8f4');
      for (const x of [-2, -.7, .7, 2]) lineW(h, P(x, r.h, 1.5), P(x, r.h, r.zb), '#f8f8f4');
      for (let z = 3; z < r.zb; z += 3.6) fillPoly(h, [P(-.7, r.h, z), P(.7, r.h, z), P(.7, r.h, z + 1.2), P(-.7, r.h, z + 1.2)], '#fbfcf2');   // troffers
      fillPoly(h, [P(r.x0, 0, 1.5), P(r.x0, 0, r.zb), P(r.x0, r.h, r.zb), P(r.x0, r.h, 1.5)], '#b9b4a6');
      fillPoly(h, [P(r.x1, 0, 1.5), P(r.x1, 0, r.zb), P(r.x1, r.h, r.zb), P(r.x1, r.h, 1.5)], '#c2bdaf');
      fillPoly(h, [P(r.x0, 0, 1.5), P(r.x1, 0, 1.5), P(r.x1, 0, r.zb), P(r.x0, 0, r.zb)], '#5f6a7a');                        // carpet tile, office blue-gray
      for (let z = 2; z < r.zb; z += .8) lineW(h, P(r.x0, 0, z), P(r.x1, 0, z), 'rgba(40,46,60,0.25)');
      for (let x = r.x0; x < r.x1; x += .8) lineW(h, P(x, 0, 1.5), P(x, 0, r.zb), 'rgba(40,46,60,0.2)');
      for (const side of ['left', 'right']) {          // cove base, and the other suites' doors with their sidelights
        const q = side === 'left' ? Q.left : Q.right;
        fillPoly(h, q(r, 1.5, r.zb, 0, .2), '#34343a');
        for (const za of side === 'left' ? [4.5, 10.5] : [7.5, 13]) {
          fillPoly(h, q(r, za - .1, za + 1.5, 0, 2.95), '#7a6248'); fillPoly(h, q(r, za, za + 1.2, 0, 2.85), '#a07c56'); fillPoly(h, q(r, za + 1.2, za + 1.45, .2, 2.85), '#9ec4e8');
          fillPoly(h, q(r, za + .2, za + .9, 2.3, 2.55), '#d8d4c8');
        }
      }
      // Suite 204 at the end: a glass storefront door in a bronze frame, the suite number on the glass
      fillPoly(h, Q.back(r, r.x0, r.x1, 0, r.h), '#c8c2b2');
      fillPoly(h, Q.back(r, -1.3, 1.3, 0, 3.1), '#5e4a34'); fillPoly(h, Q.back(r, -1.15, 1.15, .1, 2.95), '#3a4a5a');
      fillPoly(h, Q.back(r, -1.1, -.05, .15, 2.9), '#6a8aa8'); fillPoly(h, Q.back(r, .05, 1.1, .15, 2.9), '#6a8aa8');
      fillPoly(h, Q.back(r, -.15, .15, .1, 2.95), '#5e4a34'); for (const x of [-.25, .25]) fillPoly(h, Q.back(r, x - .03, x + .03, .9, 1.9), '#c8ccd4');
      const p = P(-.8, 2.25, r.zb); ftext(h, 'SUITE', p[0], p[1], '#f4f0e0'); const p2 = P(-.55, 2.0, r.zb); ftext(h, '204', p2[0] + 2, p2[1] - 2, '#f4f0e0');
      const ex = P(0, 3.55, r.zb); pxRect(h, ex[0] - 9, ex[1] - 3, 18, 7, '#c43a3a'); ftext(h, 'EXIT', ex[0] - 7, ex[1] - 2, '#ffffff');   // the exit sign over it
    }
    g.drawImage(cache, 0, 0);
    g.fillStyle = 'rgba(255,255,240,0.05)'; g.fillRect(0, 0, SW, SH);
  };
})();
