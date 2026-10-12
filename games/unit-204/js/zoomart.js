'use strict';
/* ============================== CLOSE-UP ART ==============================
   Each feature's close-up is drawn at 240x135 with hard pixels. art[id](g, v, fl, t): v = condition index,
   fl = flags set by your actions (each holds the time it was set), t = seconds (for ambient animation). */
const Z = {
  wall(g, x, y, w, h, base, seed) { pxRect(g, x, y, w, h, base); speckle(g, x, y, w, h, 'rgba(0,0,0,0.06)', w * h / 18, seed); speckle(g, x, y, w, h, 'rgba(255,255,255,0.08)', w * h / 22, seed + 7); },
  popcorn(g, base = '#ece6d8') { pxRect(g, 0, 0, ZW, ZH, base); speckle(g, 0, 0, ZW, ZH, '#d6cebd', 900, 3); speckle(g, 0, 0, ZW, ZH, '#fbf8f0', 700, 9); },
  sunbeam(g, x, w, lvl = 3) { if (!Decor.time.sun) return; g.fillStyle = dither(Decor.time.sun, lvl); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, 0); g.lineTo(x + w - 70, ZH); g.lineTo(x - 70, ZH); g.fill(); },
  vignette(g) {
    g.fillStyle = dither('#000000', 3); g.fillRect(0, 0, ZW, 3); g.fillRect(0, ZH - 3, ZW, 3); g.fillRect(0, 0, 3, ZH); g.fillRect(ZW - 3, 0, 3, ZH);
    g.fillStyle = dither('#000000', 1); g.fillRect(3, 3, ZW - 6, 4); g.fillRect(3, ZH - 7, ZW - 6, 4);
  },
  plate(g, x, y, w, h, c = '#f1ece0') { pxRect(g, x - 1, y - 1, w + 2, h + 2, '#8b8574'); pxRect(g, x, y, w, h, c); pxRect(g, x, y, w, 1, '#ffffff'); pxRect(g, x, y + h - 1, w, 1, '#cfc8b6'); },
  screw(g, x, y) { pxEllipse(g, x, y, 1, 1, '#9a9a92'); pxRect(g, x - 1, y, 3, 1, '#5a5a52'); },
  dripY(t, period, len) { return ((t % period) / period) * len; },
  item(g, where, x, y, k = 3) {          // whatever the tenant left in this spot, if it's still there (and it becomes a part you can use)
    const d = DOOR[where], it = d && Openables.item(d);
    if (it) { CLUTTER[it].draw(g, x, y, k); if (Z.cur) (CloseupExtras.spots[Z.cur] = CloseupExtras.spots[Z.cur] || []).push({ door: where, kind: it, x, y, k }); }
  }
};
/* the drawings on the bedroom wall (2: a marker dinosaur, 3: the liger), on their own so the room can draw the very same thing */
function bwallDrawing(g, v) {
  if (v === 2) {
    const P2 = '#7b3fc4', L2 = (a, b, c, d) => pxLine(g, a, b, c, d, P2, 2);
    for (let a = 3.3; a < 6.2; a += .05) pxRect(g, 120 + Math.cos(a) * 40, 70 + Math.sin(a) * 22, 2, 2, P2);
    L2(80, 70, 160, 70); L2(152, 56, 176, 24); L2(160, 62, 184, 28); for (let a = 0; a < 6.28; a += .2) pxRect(g, 182 + Math.cos(a) * 9, 22 + Math.sin(a) * 6, 2, 2, P2);
    pxRect(g, 186, 20, 2, 2, P2); L2(84, 70, 60, 82); L2(96, 70, 96, 90); L2(110, 70, 110, 90); L2(134, 70, 134, 90); L2(148, 70, 148, 90);
    for (let i = 0; i < 6; i++) { L2(92 + i * 10, 52 - (i % 3), 97 + i * 10, 44 - (i % 3)); L2(97 + i * 10, 44 - (i % 3), 102 + i * 10, 51 - (i % 3)); }
    for (let a = 0; a < 6.28; a += .25) pxRect(g, 30 + Math.cos(a) * 10, 22 + Math.sin(a) * 10, 2, 2, '#f2a020');
    for (let i = 0; i < 8; i++) { const a = i * .785; pxLine(g, 30 + Math.cos(a) * 13, 22 + Math.sin(a) * 13, 30 + Math.cos(a) * 18, 22 + Math.sin(a) * 18, '#f2a020'); }
    for (let i = 0; i < 6; i++) { pxLine(g, 150 + i * 9, 96, 154 + i * 9, 88, P2); pxLine(g, 154 + i * 9, 88, 158 + i * 9, 98, P2); }
    scribble(g, 'RAWR!', 184, 50, 1.4, P2, 2, 5, .6);             // a speech line for the dinosaur, and the artist's signature
    scribble(g, 'KAYDEN', 34, 92, 1.1, P2, 1, 17, .15, 6.2);
  }
  if (v === 3) {                           // the liger, after Napoleon Dynamite's pencil sketch: facing left, a person-ish face in a bob of mane, a long low body
    const K = '#34343c', KL = 'rgba(52,52,60,0.45)', SH = 'rgba(52,52,60,0.18)', PAPER = 'rgba(255,255,255,0.22)';   // with spikes down its back, a tall tail ending in a spiky ball, striped legs, and claws
    const line = (pts, c = K) => { for (let k = 1; k < pts.length; k++) pxLine(g, pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], c); };
    const sketch = (pts, closed) => { const q = closed ? [...pts, pts[0]] : pts; line(q); line(q.map(([x, y]) => [x + 1, y + (hash(x) > .5 ? 1 : 0)]), KL); };   // a second, wobbly pass, like a pencil going over it
    const stripes = (x0, y0, x1, y1, n, len) => { for (let k = 0; k < n; k++) { const t = (k + .5) / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; pxLine(g, x - len / 2, y, x + len / 2, y + 1, K); pxLine(g, x - len / 2 + 1, y + 1, x + len / 2 - 1, y + 2, KL); } };
    // the tail: rising from the rump, striped, up to a spiky ball
    fillPoly(g, [[168, 60], [176, 56], [186, 22], [180, 20]], PAPER); sketch([[168, 60], [180, 20]]); sketch([[176, 56], [186, 22]]);
    for (let y = 26; y < 56; y += 5) { const x = 168 + (60 - y) * .3; pxLine(g, x + 1, y, x + 7, y - 1, K); }
    pxEllipse(g, 184, 15, 5, 5, PAPER); for (let a = 0; a < 6.28; a += .2) pxRect(g, 184 + Math.cos(a) * 5, 15 + Math.sin(a) * 5, 1, 1, K);
    for (let k = 0; k < 9; k++) { const a = k / 9 * 6.28 + .2; pxLine(g, 184 + Math.cos(a) * 5, 15 + Math.sin(a) * 5, 184 + Math.cos(a) * 10, 15 + Math.sin(a) * 10, K); }
    // the far legs, then the body, then the near legs: front legs crouched forward, back legs planted, all with claws
    const legs = [[[90, 72], [99, 75], [93, 87], [80, 90], [69, 91], [68, 87], [79, 85], [86, 82]], [[146, 80], [156, 79], [159, 93], [149, 94]], [[103, 76], [113, 79], [106, 91], [92, 94], [80, 95], [79, 91], [91, 89], [98, 86]], [[160, 76], [170, 74], [176, 93], [165, 94]]];   // front legs crouched: elbow down, forearm reaching forward
    legs.forEach((leg, n) => { fillPoly(g, leg, PAPER); sketch(leg, true); const b = polyBox(leg); stripes(b.x0 + 3, b.y0 + 3, b.x0 + (b.x1 - b.x0) * .6, b.y1 - 3, 3, 6);
      const fx = n % 2 ? b.x1 - 2 : b.x0, fy = b.y1; for (let c = 0; c < 4; c++) pxLine(g, fx + c * 3 - (n % 2 ? 0 : 3), fy, fx + c * 3 - (n % 2 ? 2 : 6), fy + 3, K); });   // claws
    const body = [[78, 62], [100, 58], [130, 58], [168, 56], [176, 63], [174, 74], [164, 81], [148, 86], [128, 88], [108, 86], [94, 82], [82, 76]];   // a long, low body with a sagging belly
    fillPoly(g, body, PAPER); clipDo(g, body, () => { for (let x = 90; x < 176; x += 3) pxLine(g, x, 84, x + 6, 72, SH); });   // the belly, shaded in pencil
    sketch(body, true); stripes(92, 72, 168, 70, 7, 8);
    for (const [sx, h] of [[104, 9], [122, 12], [140, 13], [158, 10]]) { fillPoly(g, [[sx - 4, 58], [sx + 1, 58 - h], [sx + 4, 57]], PAPER); sketch([[sx - 4, 58], [sx + 1, 58 - h], [sx + 4, 57]]); pxLine(g, sx - 2, 57, sx, 58 - h + 3, SH); }   // spikes down the back
    // the head: a rounded bob of mane, a person-ish face inside it, small ears, an open mouth with the tongue out
    const mane = [[46, 78], [44, 52], [50, 40], [62, 35], [74, 38], [82, 48], [84, 78], [78, 80], [76, 64], [52, 64], [52, 80]];
    fillPoly(g, mane, PAPER); sketch(mane, true); for (let x = 47; x < 82; x += 3) pxLine(g, x, 42 + Math.abs(x - 64) * .2, x - 1, 76, SH);
    for (const ex of [54, 72]) sketch([[ex - 3, 46], [ex, 40], [ex + 3, 46]]);                                    // ears
    const face = blobPts(64, 60, 10, 13, 7, .05, 16); fillPoly(g, face, 'rgba(255,255,255,0.4)'); sketch(face, true);
    for (const ex of [59, 69]) { pxLine(g, ex - 2, 56, ex + 2, 56, K); pxRect(g, ex - 1, 57, 2, 1, K); pxLine(g, ex - 2, 54, ex + 2, 53, KL); }   // eyes and brows
    pxLine(g, 64, 58, 63, 63, K); pxLine(g, 63, 63, 66, 63, K);                                                       // nose
    pxEllipse(g, 64, 68, 3, 2, K); pxEllipse(g, 64, 68, 2, 1, '#e8b0b0'); pxRect(g, 63, 69, 3, 2, '#d88a8a');      // the open mouth, tongue out
    // the writing, scrawled in purple marker
    scribble(g, 'LIGER', 22, 6, 2.2, '#7b3fc4', 2, 3);
    scribble(g, 'BRED FOR ITS SKILLS IN MAGIC', 26, 99, 1.1, '#7b3fc4', 1, 11, .1, 6.3);
  }
}
const ZOOM_ART = {
  carpet(g, v, fl, t) {
    const cf = Decor.pal('living').floor; pxRect(g, 0, 0, ZW, ZH, cf.base); speckle(g, 0, 0, ZW, ZH, cf.dk, 2600, 1); speckle(g, 0, 0, ZW, ZH, cf.lt, 1900, 2);
    pxRect(g, 150, 0, 90, 6, '#efe9dc'); pxRect(g, 150, 6, 90, 1, '#a89c86');                     // baseboard by the window
    g.fillStyle = Decor.time.sun ? dither(Decor.time.sun, 4) : 'rgba(0,0,0,0)'; g.beginPath(); g.moveTo(40, 0); g.lineTo(150, 0); g.lineTo(120, 92); g.lineTo(0, 92); g.fill();   // window light
    g.fillStyle = dither('#7d6b4c', 5); g.fillRect(92, 0, 5, 92); g.fillRect(0, 44, 140, 4);              // window frame shadow
    if (v === 0) for (let x = 0; x < ZW; x += 24) { g.fillStyle = dither('#efe0bb', 4); g.fillRect(x, 0, 12, ZH); }
    if (v === 1) { g.fillStyle = dither('#857a66', 7); g.fillRect(36, 96, 168, 39); g.fillStyle = dither('#857a66', 4); g.fillRect(28, 96, 184, 39); speckle(g, 40, 98, 160, 36, '#6f6554', 300, 5); }
    if (v === 2) {
      fillPoly(g, blobPts(117, 62, 54, 34, 61, .4, 26), rgba('#8a7650', .2));
      fillPoly(g, blobPts(117, 62, 38, 24, 63, .45, 24), '#8a7650'); fillPoly(g, blobPts(114, 61, 30, 18, 67, .45, 20), '#77633f'); fillPoly(g, blobPts(111, 60, 18, 11, 71, .5, 16), '#6a5634');
      speckle(g, 82, 42, 70, 40, '#5a4a2c', 140, 8); speckle(g, 70, 30, 95, 60, '#9a8660', 120, 12);
    }
    if (v === 3) for (const [i, [x, y]] of [[186, 24], [202, 34], [216, 20]].entries()) { fillPoly(g, blobPts(x, y, 4.5, 3, i * 13, .6, 10), '#7a5a34'); fillPoly(g, blobPts(x, y, 2.5, 1.8, i * 13 + 5, .6, 8), '#2a1a10'); }
    if (Decor.rugDown()) {                   // the rug the tenant left: it really ties the room together
      const R0 = [[70, 38, '#7a2a2a'], [64, 34, '#c8a060'], [56, 29, '#8a3a2a'], [40, 21, '#2a4a6a'], [18, 9, '#d8b060']];
      for (const [rx, ry, c] of R0) pxEllipse(g, 117, 62, rx, ry, c);
      for (let a = 0; a < 6.28; a += .26) pxRect(g, 117 + Math.cos(a) * 48, 62 + Math.sin(a) * 25, 3, 2, '#d8b060');
      for (let a = 0; a < 6.28; a += .12) pxRect(g, 117 + Math.cos(a) * 72, 62 + Math.sin(a) * 40, 1, 2, '#e8d8b0');
      speckle(g, 50, 26, 134, 72, 'rgba(0,0,0,0.12)', 160, 3);
    }
    Z.vignette(g);
  },
  tvwall(g, v, fl, t) {
    Z.wall(g, 0, 0, ZW, ZH, Decor.zoomWall('living'), 4);
    Z.sunbeam(g, 150, 60, 3);
    pxRect(g, 0, 120, ZW, 15, '#f2ede2'); pxRect(g, 0, 120, ZW, 1, '#a8a08c'); pxRect(g, 0, 124, ZW, 1, '#dcd5c4');
    // the cable jack: a tall single plate with a threaded F-connector (hex nut, threaded barrel, a pin hole in the middle)
    Z.plate(g, 186, 84, 20, 32, '#ece2c8'); Z.screw(g, 196, 88); Z.screw(g, 196, 112);
    fillPoly(g, [[190, 100], [193, 95], [199, 95], [202, 100], [199, 105], [193, 105]], '#8f9098');                // hex nut
    fillPoly(g, [[191, 100], [193.5, 96], [198.5, 96], [201, 100], [198.5, 104], [193.5, 104]], '#c4c6cc'); pxRect(g, 193, 96, 6, 1, '#e8eaee');
    pxEllipse(g, 196, 100, 3, 3, '#a6a8b0'); for (let r = 1; r <= 3; r++) pxRect(g, 193, 97 + r * 1.5, 7, 1, '#7c7e88');   // threaded barrel
    pxEllipse(g, 196, 100, 1, 1, '#2a2a30'); pxRect(g, 196, 100, 1, 1, '#d8a050');                                     // the hole, a copper pin
    const holes = [[88, 26], [152, 26], [88, 62], [152, 62]];
    if (v === 0) for (const x of [70, 100, 130, 160]) { pxRect(g, x, 32, 1, 1, '#4a3c2c'); pxRect(g, x + 1, 33, 1, 1, '#b8a682'); }
    if (v === 1) {
      if (!fl.removed) for (const [x, y] of holes) { pxRect(g, x - 2, y - 2, 5, 5, '#f8f8f2'); pxRect(g, x - 2, y + 2, 5, 1, '#c8c2b0'); Z.screw(g, x, y); }
      else for (const [x, y] of holes) { pxRect(g, x - 2, y - 2, 4, 4, '#e8dcc0'); pxRect(g, x - 1, y - 1, 2, 2, '#3a2e22'); }
    }
    if (v === 2) {                           // a TV mount ripped off the wall: two ragged holes where the anchors tore out, and small ones beside them
      const wall = Decor.zoomWall('living');
      for (const [cx, cy, r, sd] of [[96, 40, 13, 3], [150, 44, 11, 9], [96, 66, 4, 5], [150, 70, 4, 7]]) {
        const torn = blobPts(cx, cy, r + 5, (r + 5) * .9, sd, .5, 16), edge = blobPts(cx, cy, r + 1.5, (r + 1.5) * .9, sd + 1, .45, 16), hole = blobPts(cx, cy, r, r * .88, sd + 2, .4, 14);
        fillPoly(g, torn, mix(wall, '#ffffff', .35)); strokePoly(g, torn, mix(wall, '#000000', .22));   // the paper face, torn and lifted around the hole
        fillPoly(g, edge, '#ece6da'); speckle(g, cx - r - 2, cy - r - 2, r * 2 + 4, r * 2 + 4, '#d0c8b8', r * 3, sd);   // crumbly gypsum
        fillPoly(g, hole, '#2a221c');                                                                    // into the cavity
        g.save(); poly(g, hole); g.clip();
        fillPoly(g, blobPts(cx, cy + r * .5, r, r * .5, sd + 3, .3, 10), '#3a3028');                   // light falls on the lower inside edge; the top stays in shadow
        pxRect(g, cx - r, cy - r, r * 2, Math.max(1, Math.round(r * .35)), '#140f0c');
        if (r > 8) { pxRect(g, cx + 2, cy - 3, 3, 9, '#6a5a48'); pxRect(g, cx + 2, cy - 3, 3, 1, '#8a7a66'); }   // a stud's edge back in the dark
        g.restore(); strokePoly(g, hole, '#5a4c3e');
        if (r > 8) for (const a of [.6, 2.4, 4.1]) pxCrack(g, cx + Math.cos(a) * (r + 5), cy + Math.sin(a) * (r + 5) * .9, a, 7, mix(wall, '#000000', .3), sd + a * 10 | 0, 1);   // hairline cracks
      }
      fillPoly(g, [[92, 44], [99, 41], [101, 47], [95, 49]], '#e8e2d2'); pxRect(g, 94, 45, 4, 1, '#b8b0a0');   // half a plastic anchor still hanging in one
      speckle(g, 84, 119, 80, 2, '#f8f4ea', 28, 4); speckle(g, 88, 121, 70, 2, '#e8e0d0', 14, 6);           // gypsum dust settled on the baseboard below
    }
    if (v === 3) { g.fillStyle = dither('#e6d6b4', 3); g.fillRect(70, 18, 100, 52); }
    Z.vignette(g);
  },
  fan(g, v, fl, t) {
    Z.popcorn(g);
    const haz = v === 2, wobT = haz && fl.wobble ? t - fl.wobble : 99, wob = wobT < 2.6 ? Math.sin(t * 22) * 3 * (1 - wobT / 2.6) : 0;
    const drop = haz ? 6 : 0, hx = 120 + wob, hy = 40 + drop;
    // canopy, mounted flat against the ceiling (with a soft contact shadow); on the bad one it hangs low off a loose bracket
    if (!haz) { g.fillStyle = 'rgba(80,70,60,0.14)'; g.beginPath(); g.ellipse(120, 1, 26, 6, 0, 0, 7); g.fill(); }
    else { pxRect(g, 104, 0, 32, drop + 1, '#2a2620'); pxRect(g, 110, 0, 20, 3, '#4a4a52'); pxLine(g, 114, 2, 112, drop + 2, '#d64545'); pxLine(g, 126, 2, 128, drop + 2, '#1a1a1a'); }
    pxRect(g, 104, drop, 32, 10, '#b9bcc4'); pxRect(g, 106, drop, 6, 10, '#d9dce4'); pxRect(g, 108, drop + 10, 24, 3, '#9ea2ac'); pxRect(g, 104, drop + 9, 32, 1, '#7d8290');
    // downrod into the motor housing
    pxRect(g, 117 + wob * .5, drop + 13, 6, hy - 6 - drop - 13, '#9a9ea8'); pxRect(g, 117 + wob * .5, drop + 13, 2, hy - 6 - drop - 13, '#c4c8d0');
    // blades, each bolted to the housing by an iron
    const spinning = (fl.spin && !haz) || wobT < 2.6, ang0 = spinning ? t * 9 : 0, blades = [];
    for (let i = 0; i < 5; i++) { const a = ang0 + i * Math.PI * 2 / 5 + .3; blades.push([a, Math.sin(a), i]); }
    blades.sort((a, b) => a[1] - b[1]);
    let tieAt = null;
    for (const [a, s, i] of blades) {
      const c = Math.cos(a), droop = v === 1 ? 4 : 0;
      const tip = [hx + c * 112, hy + s * 20 + droop], root = [hx + c * 28, hy + s * 6], iron = [hx + c * 16, hy + s * 4];
      const nx = -s * 9, ny = c * 2.4, col = v === 1 ? '#b99c76' : '#a0703c', dark = v === 1 ? '#9c805c' : '#7a5228';
      pxLine(g, iron[0], iron[1], root[0], root[1], '#5d626e', 3);
      fillPoly(g, [[root[0] + nx * .5, root[1] + ny * .5], [tip[0] + nx, tip[1] + ny], [tip[0] - nx, tip[1] - ny], [root[0] - nx * .5, root[1] - ny * .5]], s > 0 ? col : dark);
      pxLine(g, root[0], root[1], tip[0], tip[1], v === 1 ? '#c9b08c' : '#8a5e30');
      pxRect(g, root[0] - 2, root[1] - 1, 4, 3, '#4a4e58');
      if (i === 2 && !spinning) tieAt = { A: [hx + c * 80, hy + s * 15 + droop * .7], n: [nx * .85, ny * .85], d: [c * 112 - c * 28, s * 14].map((q, _, v) => q / Math.hypot(...v)) };
    }
    // motor housing
    pxRect(g, hx - 20, hy - 6, 40, 11, '#a9adb7'); pxRect(g, hx - 20, hy - 6, 8, 11, '#c8ccd4'); pxRect(g, hx - 20, hy - 6, 40, 2, '#d9dce4');
    pxEllipse(g, hx, hy + 5, 20, 3, '#8d93a1'); pxRect(g, hx - 20, hy + 1, 40, 1, '#7d8290');
    // switch housing, then the light kit hung from it, then the pull chain out of the switch housing's side
    pxRect(g, hx - 24, hy + 7, 48, 6, '#9ea2ac'); pxRect(g, hx - 24, hy + 7, 10, 6, '#c4c8d0'); pxRect(g, hx - 24, hy + 12, 48, 1, '#6f7480');
    pxRect(g, hx - 18, hy + 13, 36, 2, '#8d93a1');
    const lit = !ROOMS.living.lightsOff, glass = lit ? '#f8f2e2' : '#ddd6c6';
    pxRect(g, hx - 18, hy + 14, 36, 7, '#8a8478'); pxEllipse(g, hx, hy + 21, 18, 10, '#8a8478');    // a gray rim, so the glass stands out from the white ceiling
    pxRect(g, hx - 17, hy + 15, 34, 6, glass); pxEllipse(g, hx, hy + 21, 17, 9, glass); pxEllipse(g, hx, hy + 26, 12, 3, lit ? '#eadcb8' : '#cfc8b6'); pxEllipse(g, hx - 5, hy + 19, 7, 4, lit ? '#ffffff' : '#ece6d8');
    speckle(g, hx - 10, hy + 22, 20, 6, '#5a5040', 3, 4);
    if (lit) { g.fillStyle = 'rgba(255,246,216,0.16)'; g.beginPath(); g.ellipse(hx, hy + 24, 34, 18, 0, 0, 7); g.fill(); }
    const sw = spinning ? Math.sin(t * 6) * 2 : 0;
    pxRect(g, hx + 22, hy + 13, 3, 2, '#8d93a1');
    pxLine(g, hx + 23, hy + 15, hx + 23 + sw, hy + 60, '#c9a227'); for (let y = hy + 18; y < hy + 60; y += 4) pxRect(g, hx + 23 + sw * (y - hy - 15) / 45, y, 1, 1, '#f2d870');
    pxEllipse(g, hx + 23 + sw, hy + 62, 2, 2, '#e8c34a');
    if (tieAt && tieOnFan()) {                                      // the tie, wrapped over the blade it was tossed onto
      drawTieOverBlade(g, tieAt.A, tieAt.n, tieAt.d, 2.4, t);
      const [x, y] = tieAt.A.map(Math.round); Z.tieRect = [x - 14, y - 8, 30, 54];
    }
    Z.vignette(g);
  },
  sink(g, v, fl, t) {
    const water = Sink.running(), grind = Sink.grinding(), jig = grind ? (Math.floor(t * 30) % 2) : 0;
    Z.wall(g, 0, 0, ZW, 24, Decor.zoomWall('kitchen'), 6);                                  // the backsplash wall
    pxRect(g, 0, 22, ZW, 8, '#9d9282'); speckle(g, 0, 22, ZW, 8, '#7d7366', 60, 2); pxRect(g, 0, 22, ZW, 1, '#b4ab9c');   // the back of the counter
    pxRect(g, 0, 30, ZW, 34, '#8c8378'); speckle(g, 0, 30, ZW, 34, '#6c6458', 300, 3); speckle(g, 0, 30, ZW, 34, '#b4ab9c', 200, 4);
    // two basins with real depth: the rim, the back wall falling away, the side walls sloping in, the floor and its drain
    for (const bx of [44, 124]) {
      pxRect(g, bx, 33, 72, 28, '#d3d7de'); pxRect(g, bx, 33, 72, 1, '#eef0f4');                                         // rim
      fillPoly(g, [[bx + 3, 36], [bx + 69, 36], [bx + 62, 47], [bx + 10, 47]], '#a4a9b2');                               // back wall
      fillPoly(g, [[bx + 3, 36], [bx + 10, 47], [bx + 10, 58], [bx + 3, 58]], '#878c96'); fillPoly(g, [[bx + 69, 36], [bx + 62, 47], [bx + 62, 58], [bx + 69, 58]], '#959aa4');   // sides
      pxRect(g, bx + 10, 47, 52, 11, '#7a7f89'); pxRect(g, bx + 10, 47, 52, 1, '#6a6f78');                                  // floor
      for (let x = bx + 14; x < bx + 60; x += 6) pxRect(g, x, 49 + (x % 4), 3, 1, '#868b95');                                // brushed steel
    }
    pxEllipse(g, 80, 53, 5, 2, '#3a3d44'); pxEllipse(g, 80, 53, 3, 1, '#1d1f24'); pxRect(g, 79, 52, 3, 1, '#9aa0aa');           // the left drain: a basket strainer
    pxEllipse(g, 160, 53, 6, 3, '#1d1f24');                                                                                      // the right drain: the disposal's black rubber splash guard
    for (let a = 0; a < 6; a++) { const an = a / 6 * Math.PI * 2 + jig * .3; pxLine(g, 160, 53, 160 + Math.cos(an) * 5, 53 + Math.sin(an) * 2, '#3a3d44'); }
    if (water) {                             // the stream from the spout, and the splash in the left basin
      const wx = fl.spout ? 147 : 91;                                       // whichever basin the spout is swung over
      for (let y = 18; y < 52; y++) pxRect(g, wx + ((y + Math.floor(t * 20)) % 5 === 0 ? 1 : 0), y, 2, 1, (y + Math.floor(t * 24)) % 4 ? '#bfe3f4' : '#ffffff');
      pxEllipse(g, wx + 1, 53, 7 + (Math.floor(t * 12) % 2), 2, 'rgba(210,240,255,0.8)'); pxRect(g, wx - 7 + (Math.floor(t * 9) % 3) * 4, 50, 1, 1, '#ffffff');
    }
    // the faucet: deck plate, two lever handles (hot left, cold right), and a gooseneck spout over the left basin
    pxRect(g, 104, 25, 32, 6, '#c9ccd4'); pxRect(g, 104, 25, 32, 1, '#eef0f4');
    pxRect(g, 118, 8, 4, 18, '#c9ccd4'); pxRect(g, 119, 8, 1, 18, '#ffffff');
    if (fl.spout) { pxRect(g, 118, 5, 32, 4, '#c9ccd4'); pxRect(g, 118, 5, 32, 1, '#ffffff'); pxRect(g, 146, 6, 4, 11, '#c9ccd4'); pxRect(g, 146, 16, 4, 1, '#8a8e98'); }   // the spout swung right
    else { pxRect(g, 92, 5, 30, 4, '#c9ccd4'); pxRect(g, 92, 5, 30, 1, '#ffffff'); pxRect(g, 90, 6, 4, 11, '#c9ccd4'); pxRect(g, 90, 16, 4, 1, '#8a8e98'); }
    for (const [hx, on, dot] of [[108, Sink.on('hot'), '#d64545'], [132, Sink.on('cold'), '#3a7ad6']]) {
      pxRect(g, hx - 2, 22, 5, 4, '#b9bcc4'); const tip = on ? [hx + (hx < 120 ? -7 : 7), 21] : [hx, 15];        // a lever turned out to the side is running
      pxLine(g, hx, 22, tip[0], tip[1], '#d9dce4', 2); pxRect(g, hx, 23, 1, 1, dot);
    }
    if (v === 1) { speckle(g, 104, 24, 32, 8, '#f6f6f0', 40, 5); pxRect(g, 89, 15, 6, 2, '#f0f0e8'); speckle(g, 88, 14, 8, 4, '#ffffff', 10, 6); }
    // the disposal switch, all the way up on the backsplash wall
    Z.plate(g, 208, 3, 14, 18, '#ece2c8');
    if (v === 2) { pxLine(g, 209, 10, 221, 14, '#6b604a'); pxRect(g, 213, 10, 4, 3, '#5a5040'); pxRect(g, 212, 11, 6, 2, '#bdb4a0'); }
    else { const up = !!fl.disposal; pxRect(g, 213, up ? 6 : 12, 4, 6, '#d8ccb0'); pxRect(g, 212, up ? 6 : 15, 6, 3, '#f4ecd8'); }
    // the cabinet run under it, the same as the room: oak face frame, the dishwasher's edge on the left, a drawer-over-door bay on the right
    const rp = (x, y, w, h, base) => {      // a raised-panel front: the door, its inset panel, a shadow along the top and left, light along the bottom and right
      pxRect(g, x, y, w, h, base); pxRect(g, x + 6, y + 6, w - 12, h - 12, '#b98a52');
      pxRect(g, x + 6, y + 6, w - 12, 1, '#8a5a2c'); pxRect(g, x + 6, y + 6, 1, h - 12, '#8a5a2c');
      pxRect(g, x + 6, y + h - 7, w - 12, 1, '#d0a46a'); pxRect(g, x + w - 7, y + 6, 1, h - 12, '#c49660');
    };
    pxRect(g, 0, 64, ZW, 71, '#b48048'); pxRect(g, 0, 64, ZW, 2, '#9a6a38');
    pxRect(g, 0, 66, 10, 69, '#ecebe6'); pxRect(g, 0, 66, 10, 9, '#d8d6ce'); pxRect(g, 9, 66, 1, 69, '#c8c6be');                // the dishwasher, white, with its control strip
    rp(214, 67, 30, 15, '#a8743f'); pxRect(g, 222, 73, 6, 2, '#d9c27a');                                                         // the drawer
    rp(214, 86, 30, 49, '#a8743f'); pxRect(g, 218, 92, 2, 8, '#d9c27a');                                                         // and the door under it
    if (!fl.open) {                          // two doors, the full height of the cabinet, raised panels like every other door in the kitchen
      for (const dx of [34, 122]) rp(dx, 66, 84, 69, v === 3 ? '#a2703c' : '#a8743f');
      pxRect(g, 112, 94, 3, 10, '#d9c27a'); pxRect(g, 125, 94, 3, 10, '#d9c27a');
      if (v === 3) { g.fillStyle = dither('#4f3218', 9); g.fillRect(34, 124, 172, 11); }
      Z.vignette(g); return;
    }
    pxRect(g, 34, 66, 172, 69, '#241a12'); pxRect(g, 34, 66, 172, 3, '#120c08'); pxRect(g, 34, 69, 172, 34, '#2c2016');   // inside: the back wall, darker up top
    for (const x of [16, 206]) { pxRect(g, x, 64, 18, 71, '#a8743f'); pxRect(g, x + 4, 70, 10, 59, '#b98a52'); pxRect(g, x + (x < 100 ? 17 : 0), 64, 1, 71, '#8a5a2c'); }   // the doors, swung open, edge-on to you
    // the basins' undersides, dropping through the counter
    for (const bx of [50, 130]) { pxRect(g, bx, 64, 60, 16, '#8e939c'); pxEllipse(g, bx + 30, 80, 29, 4, '#8e939c'); pxRect(g, bx, 64, 6, 16, '#a9aeb7'); pxRect(g, bx + 54, 64, 6, 17, '#6f747e'); }
    const J = grind ? jig : 0;
    // the disposal, hung under the right basin: mounting ring, motor housing, and its cord to the outlet
    pxRect(g, 148, 82, 24, 4, '#c9ccd4'); pxRect(g, 150 + J, 86, 20, 24, '#2a2c32'); pxRect(g, 150 + J, 86, 4, 24, '#3e4148'); pxRect(g, 152 + J, 108, 16, 4, '#1d1f24');
    pxRect(g, 155 + J, 92, 10, 6, '#c43a3a'); pxRect(g, 156 + J, 94, 8, 1, '#f2d870');                                     // its label
    pxLine(g, 160, 112, 166, 120, '#1a1a1a'); pxLine(g, 166, 120, 192, 118, '#1a1a1a'); pxLine(g, 192, 118, 194, 104, '#1a1a1a');
    pxRect(g, 190, 96, 10, 12, '#ece2c8'); pxRect(g, 192, 100, 6, 4, '#2a2a2a');                                              // the outlet on the back wall, plugged in
    // the drains: the left tailpiece and the disposal's outlet meet at a tee, the tee drops into the trap, the trap runs into the wall
    const PVC = '#e8e8e2', PVD = '#bdbdb4';
    pxRect(g, 78, 84, 5, 18, PVC); pxRect(g, 76, 84, 9, 3, '#c9ccd4');                                                         // left tailpiece, with its slip nut
    pxRect(g, 83, 98, 67, 5, PVC); pxRect(g, 83, 102, 67, 1, PVD); pxRect(g, 146, 96, 6, 9, '#3e4148');                     // the disposal's outlet elbow, across to the tee
    pxRect(g, 76, 96, 9, 9, PVC); pxRect(g, 76, 104, 9, 1, PVD);                                                               // the tee
    pxRect(g, 78, 105, 5, 9, PVC); fillPoly(g, [[78, 113], [83, 113], [86, 118], [96, 118], [99, 113], [104, 113], [102, 121], [94, 124], [86, 124], [79, 121]], PVC);   // down into the U of the trap
    pxRect(g, 99, 106, 5, 8, PVC); pxRect(g, 99, 104, 24, 5, PVC); pxRect(g, 99, 108, 24, 1, PVD);                           // up, and across to the wall
    pxEllipse(g, 125, 106, 5, 5, '#c9ccd4'); pxEllipse(g, 125, 106, 3, 3, '#5a5e68');                                         // where it goes into the wall
    // the water supply: two shut-off valves, braided lines up to the faucet
    for (const [vx, tx] of [[112, 117], [129, 123]]) {             // on the back wall between the basins, straight up to the faucet's shanks
      pxLine(g, vx, 88, tx, 66, '#9aa0ab', 2); for (let k = 1; k < 6; k++) { const a = k / 6; pxRect(g, Math.round(vx + (tx - vx) * a), Math.round(88 - 22 * a), 1, 1, '#d9dce4'); }   // braided steel
      pxRect(g, vx - 3, 88, 7, 5, '#c9ccd4'); pxEllipse(g, vx, 86, 3, 2, '#e0e2e8');                                         // valve body and oval handle
    }
    if (v === 3) {                           // a weeping compression nut on the cold line, and a soaked cabinet floor
      pxRect(g, 34, 124, 172, 11, '#2f4a5a'); g.fillStyle = dither('#6aa0c0', 3 + Math.round(Math.sin(t * 3) * 2)); g.fillRect(34, 124, 172, 11);
      const dy = Z.dripY(t, 1.1, 26); pxRect(g, 129, 93 + dy, 1, 2, '#9fd4f0');
      speckle(g, 34, 100, 172, 24, '#3e4a2c', 50, 7);
    } else { pxRect(g, 36, 124, 168, 11, '#e6dfd0'); for (let x = 40; x < 200; x += 12) pxRect(g, x, 128, 6, 1, '#d4ccba'); }   // shelf liner
    Z.vignette(g);
  },
  stove(g, v, fl, t) {
    Z.wall(g, 0, 0, ZW, ZH, Decor.zoomWall('kitchen'), 6);
    pxRect(g, 0, 40, 20, 4, '#8a8174'); pxRect(g, 220, 40, 20, 4, '#8a8174'); pxRect(g, 0, 44, 20, 91, '#b07a42'); pxRect(g, 220, 44, 20, 91, '#b07a42'); pxRect(g, 19, 44, 1, 91, '#7a4f28'); pxRect(g, 220, 44, 1, 91, '#7a4f28');
    pxRect(g, 20, 4, 200, 52, '#1c1d21'); pxRect(g, 20, 4, 200, 2, '#3a3b42');
    for (const [x, y] of [[66, 18], [174, 18], [66, 42], [174, 42]]) {
      pxEllipse(g, x, y, 14, 7, v === 1 ? '#3a2f40' : '#2c2d33'); pxEllipse(g, x, y, 7, 3, '#4a4b52'); pxEllipse(g, x, y, 5, 2, '#26272c');
      pxRect(g, x - 22, y - 1, 44, 2, '#3c3e44'); pxRect(g, x - 1, y - 10, 2, 20, '#3c3e44');
      if (v === 1) { g.fillStyle = dither('#7a6290', 3); g.fillRect(x - 20, y - 8, 40, 16); }
      if (v === 0) pxRect(g, x - 4, y - 2, 3, 1, '#6a6b72');
    }
    pxRect(g, 20, 56, 200, 18, '#2a2b30'); pxRect(g, 20, 56, 200, 1, '#4a4b52');
    [50, 90, 150, 190].forEach((x, i) => {
      if (v === 2 && i === 0) { g.fillStyle = '#3a2a1a'; g.beginPath(); g.ellipse(x, 66, 9, 6, .3, 0, 7); g.fill(); pxRect(g, x - 6, 66, 4, 6, '#2a1d12'); pxRect(g, x + 2, 62, 3, 2, '#5a4430'); return; }
      pxEllipse(g, x, 65, 6, 6, '#d9dce4'); pxEllipse(g, x, 65, 4, 4, '#b9bcc4'); pxRect(g, x - 1, 59, 2, 5, '#5a5e68');
      if (v !== 1) for (let k = 0; k < 4; k++) pxRect(g, x - 9 + k * 6, 72, 2, 1, '#9a9ea8');
    });
    pxRect(g, 20, 74, 200, 61, '#1c1d21');
    if (fl.ovenOpen) {                       // the door folds down toward you: the oven cavity, two racks and whatever's on them
      pxRect(g, 30, 76, 180, 46, '#0c0c0e'); pxRect(g, 30, 76, 180, 3, '#050506');
      for (const y of [92, 108]) { pxRect(g, 34, y, 172, 1, '#6a6e78'); for (let x = 36; x < 206; x += 8) pxRect(g, x, y - 1, 1, 3, '#4a4e58'); }
      speckle(g, 34, 80, 172, 40, '#3a2a1a', 60, 9); Z.item(g, 'oven', 120, 107);
      pxRect(g, 24, 122, 192, 13, '#26272c'); pxRect(g, 24, 122, 192, 2, '#3a3b42'); pxRect(g, 40, 126, 160, 7, v === 2 ? '#1a1c22' : '#15161a');
      if (v === 2) pxCrack(g, 70, 128, .1, 50, '#8a8e98', 11, 1);
      Z.vignette(g); return;
    }
    pxRect(g, 30, 78, 180, 4, '#c9ccd4'); pxRect(g, 30, 78, 180, 1, '#ffffff');
    pxRect(g, 44, 88, 152, 42, '#0f1013'); g.fillStyle = dither('#3a3c44', 5); g.fillRect(48, 90, 40, 38);
    if (v === 2) { g.save(); g.beginPath(); g.rect(44, 88, 152, 42); g.clip(); pxCrack(g, 66, 94, .3, 70, '#b9bcc4', 11); pxCrack(g, 66, 94, 1.1, 30, '#b9bcc4', 5); g.restore(); }
    if (v === 0) { pxLine(g, 150, 92, 170, 126, '#2c2e36'); pxLine(g, 156, 92, 176, 126, '#2c2e36'); }
    Z.vignette(g);
  },
  counter(g, v, fl, t) {
    Z.wall(g, 0, 0, ZW, 10, Decor.zoomWall('kitchen'), 6);
    pxRect(g, 0, 8, ZW, 26, '#a49a8a'); speckle(g, 0, 8, ZW, 26, '#8a8072', 150, 2); pxRect(g, 0, 32, ZW, 2, '#6a6256');
    pxRect(g, 0, 34, ZW, 64, '#7d7468'); speckle(g, 0, 34, ZW, 64, '#5e564c', 900, 3); speckle(g, 0, 34, ZW, 64, '#9c9384', 700, 4); speckle(g, 0, 34, ZW, 64, '#c9c0b0', 220, 5);
    Z.sunbeam(g, 120, 70, 2);
    pxRect(g, 12, 50, 34, 20, '#c1121f'); pxRect(g, 12, 50, 34, 2, '#e23040'); pxRect(g, 16, 56, 18, 3, '#ffffff'); pxRect(g, 16, 61, 12, 2, '#f4c2c6');   // a red DVD-by-mail envelope
    pxRect(g, 0, 98, ZW, 18, '#8a8174'); pxRect(g, 0, 98, ZW, 3, '#a89f90'); pxRect(g, 0, 113, ZW, 3, '#5e564c');
    pxRect(g, 0, 116, ZW, 19, '#b07a42'); pxRect(g, 0, 116, ZW, 2, '#7a4f28'); pxRect(g, 118, 118, 4, 17, '#7a4f28');
    if (v === 1) { for (let i = 0; i < 26; i++) { const x = 110 + hash(i) * 110, y = 40 + hash(i + 40) * 50; pxLine(g, x, y, x + 6 + hash(i + 9) * 10, y + hash(i + 3) * 4 - 2, '#a69d8e'); } g.fillStyle = dither('#b0a898', 5); g.fillRect(150, 46, 60, 34); }
    if (v === 2) {
      fillPoly(g, blobPts(120, 64, 33, 17, 41, .22, 26), '#4a3018'); fillPoly(g, blobPts(120, 64, 27, 13, 43, .25, 22), '#6b4a2a'); fillPoly(g, blobPts(121, 64, 20, 10, 47, .3, 18), '#8a6a46');
      pxEllipse(g, 116, 62, 8, 4, '#a08060'); pxEllipse(g, 128, 67, 5, 3, '#a08060'); pxRect(g, 114, 60, 3, 1, '#c8aa86'); pxRect(g, 126, 65, 2, 1, '#c8aa86');
    }
    if (v === 3) {                           // a bite out of the bullnose: raw particleboard fills exactly the missing piece
      const chip = [[147, 98], [152, 96], [158, 98], [165, 96], [173, 97], [180, 99], [177, 104], [170, 109], [161, 111], [153, 108], [149, 103]];
      g.save(); poly(g, chip); g.clip();
      pxRect(g, 140, 90, 46, 26, '#c8a878'); speckle(g, 140, 90, 46, 26, '#9c7a4a', 120, 4); speckle(g, 140, 90, 46, 26, '#e2c89c', 50, 5);
      g.fillStyle = 'rgba(70,45,20,0.35)'; g.fillRect(140, 104, 46, 12);                    // deeper in, darker
      g.restore();
      strokePoly(g, chip, '#4e4234');                                                         // the broken laminate edge
      pxRect(g, 182, 102, 2, 1, '#c8a878'); pxRect(g, 144, 112, 1, 1, '#c8a878');           // crumbs
    }
    Z.vignette(g);
  },
  mirror(g, v, fl, t) {
    Z.wall(g, 0, 0, ZW, ZH, Decor.zoomWall('bath'), 8);
    pxRect(g, 0, 122, ZW, 13, '#f2f0e6'); pxRect(g, 0, 122, ZW, 2, '#9fb6ad');
    const flick = v === 3 && !ROOMS.bath.lightsOff && flickerDark(t, 26, 11, .75);
    pxRect(g, 40, 2, 160, 6, '#b9bcc4'); pxRect(g, 40, 2, 160, 1, '#e9ecf2');
    [60, 100, 140, 180].forEach((x, i) => {
      pxRect(g, x - 2, 6, 4, 4, '#8d93a1');
      const lit = !(flick && i !== 0);
      pxEllipse(g, x, 13, 6, 5, lit ? '#fff4c8' : '#a8a28e'); pxEllipse(g, x - 2, 11, 2, 2, lit ? '#ffffff' : '#c8c2ae');
      if (v === 3 && i === 2) { pxRect(g, x - 3, 6, 6, 3, '#6b4a2a'); if (flick && Math.sin(t * 31) > .6) { pxRect(g, x + 5, 4, 1, 1, '#fff27a'); pxRect(g, x + 7, 2, 1, 1, '#ffffff'); pxRect(g, x - 6, 3, 1, 1, '#fff27a'); } }
    });
    if (!(v === 3 && flick)) { g.fillStyle = dither('#fff4c8', 2); g.fillRect(30, 18, 180, 40); }
    pxRect(g, 48, 20, 144, 82, '#7e9aa0'); pxRect(g, 50, 22, 140, 78, '#a9c4c9');
    pxRect(g, 60, 30, 26, 70, '#93b0b6'); pxRect(g, 64, 34, 18, 66, '#8aa6ac'); pxRect(g, 130, 60, 60, 40, '#9ab6bc');   // reflected door frame & wall
    if (v === 1) {                           // desilvering: the backing behind the glass going dark from the edges in, so it reads under the reflection, not on it
      g.save(); g.beginPath(); g.rect(50, 22, 140, 78); g.clip();
      const creep = (cx, cy, rx, ry, seed) => blobPts(cx, cy, rx, ry, seed, .55, 18);
      for (const [cx, cy, rx, ry, sd] of [[70, 100, 22, 10, 3], [104, 101, 16, 6, 7], [140, 100, 20, 9, 11], [176, 99, 18, 12, 5], [50, 70, 6, 22, 9], [190, 52, 6, 18, 13], [190, 96, 10, 14, 17]]) {
        fillPoly(g, creep(cx, cy, rx * 1.35, ry * 1.35, sd), 'rgba(70,82,84,0.35)');          // the soft gray halo where the silver is thinning
        fillPoly(g, creep(cx, cy, rx, ry, sd + 1), 'rgba(34,40,42,0.55)');                     // the dark patch itself, showing through
        fillPoly(g, creep(cx, cy + ry * .3, rx * .55, ry * .5, sd + 2), 'rgba(18,22,24,0.55)');
      }
      speckle(g, 50, 86, 140, 14, 'rgba(30,34,36,0.45)', 60, 8);                                  // pinpoint spots where it's starting
      g.restore();
    }
    for (let i = 0; i < 3; i++) pxLine(g, 120 + i * 18, 24, 100 + i * 18, 96, '#c9e0e4');      // the glass's own shine, over everything behind it
    if (v === 1) { pxRect(g, 50, 98, 140, 1, 'rgba(220,236,238,0.45)'); pxRect(g, 52, 24, 1, 74, 'rgba(220,236,238,0.35)'); }   // the glass edge catching light, in front of the damage
    if (v === 2) {
      for (let a = 0; a < 6.28; a += .08) pxRect(g, 120 + Math.cos(a) * 26, 60 + Math.sin(a) * 24, 1, 1, '#eef6f6');
      pxRect(g, 110, 50, 2, 6, '#eef6f6'); pxRect(g, 128, 50, 2, 6, '#eef6f6');
      for (let a = .5; a < 2.65; a += .07) pxRect(g, 120 + Math.cos(a) * 15, 63 + Math.sin(a) * 10, 1, 1, '#eef6f6');
    }
    if (v === 3 && flick) { g.fillStyle = dither('#000000', 6); g.fillRect(0, 0, ZW, ZH); }
    pxRect(g, 60, 104, 120, 18, '#e8e4d6'); pxRect(g, 60, 104, 120, 2, '#ffffff'); pxRect(g, 112, 100, 16, 4, '#c9ccd4');
    Z.vignette(g);
  },
  tub(g, v, fl, t) {
    pxRect(g, 0, 0, ZW, 86, v === 3 ? '#cfcfc6' : '#d8d8d0');
    for (let row = 0; row < 9; row++) for (let col = -1; col < 13; col++) {
      const x = col * 20 + (row % 2 ? 10 : 0), y = row * 10 - 4;
      const tilt = v === 3 && row >= 7 && (col === 4 || col === 9) ? 1 : 0;
      pxRect(g, x + 1, y + 1 + tilt, 18, 8, '#f4f4ee'); pxRect(g, x + 1, y + 1 + tilt, 18, 1, '#ffffff'); pxRect(g, x + 2, y + 2 + tilt, 4, 1, '#ffffff');
    }
    if (v === 3) { g.fillStyle = dither('#5d5a4a', 10); for (let y = 66; y < 86; y += 10) g.fillRect(0, y - 4, ZW, 1); g.fillRect(0, 76, ZW, 10); g.fillStyle = dither('#7a7660', 6); g.fillRect(0, 60, ZW, 26); }
    if (v === 4) {                           // a round crater, three little dents in the middle
      fillPoly(g, blobPts(122, 42, 15, 14, 3, .08, 24), '#c8c8c0'); pxEllipse(g, 122, 42, 12, 11, '#b0b0a6'); pxEllipse(g, 120, 40, 9, 8, '#a0a096');
      for (const [x, y] of [[118, 37], [126, 38], [122, 45]]) { pxEllipse(g, x, y, 2, 2, '#6a6a62'); pxRect(g, x - 1, y - 1, 1, 1, '#4a4a44'); }
      for (let k = 0; k < 5; k++) pxCrack(g, 122 + Math.cos(k * 1.3) * 14, 42 + Math.sin(k * 1.3) * 13, k * 1.3, 8, '#8a8a80', 7 + k * 5, 2);
    }
    if (v === 2) { pxCrack(g, 62, 36, 0, 14, '#8a8a80', 3); pxCrack(g, 62, 36, 2, 12, '#8a8a80', 5); pxCrack(g, 62, 36, 4, 12, '#8a8a80', 7); pxCrack(g, 152, 56, .5, 14, '#8a8a80', 9); pxCrack(g, 152, 56, 2.6, 12, '#8a8a80', 13); pxCrack(g, 152, 56, 4.4, 10, '#8a8a80', 17); }
    Z.sunbeam(g, 40, 50, 2);
    pxRect(g, 196, 60, 18, 6, '#c9ccd4'); pxRect(g, 196, 60, 18, 1, '#ffffff'); pxRect(g, 210, 66, 4, 4, '#9a9ea8');
    const ck = v === 1 ? '#d9c98a' : '#f4f4ee';
    pxRect(g, 0, 86, ZW, 6, ck); pxRect(g, 0, 86, ZW, 1, '#ffffff');
    if (v === 1) for (let i = 0; i < 18; i++) pxRect(g, hash(i) * 236, 87 + hash(i + 3) * 4, 3, 1, '#a89a5a');
    if (v === 3) for (const x of [30, 90, 170]) pxRect(g, x, 87, 10, 3, '#3a3a30');
    pxRect(g, 0, 92, ZW, 43, '#f6f6f2'); pxRect(g, 0, 92, ZW, 4, '#ffffff'); pxRect(g, 0, 100, ZW, 1, '#d6d6ce'); g.fillStyle = dither('#c8ccd0', 4); g.fillRect(0, 110, ZW, 25);
    Z.vignette(g);
  },
  toilet(g, v, fl, t) {
    // a three-quarter view from standing height: the wall behind, and a tile floor it really sits on
    Z.wall(g, 0, 0, ZW, 70, Decor.zoomWall('bath'), 8);
    pxRect(g, 0, 66, ZW, 5, '#f2f0e6'); pxRect(g, 0, 70, ZW, 1, '#c8c2b2');                          // baseboard
    pxRect(g, 0, 71, ZW, 64, '#d9d2c2');
    for (let k = 1; k < 6; k++) { const y = Math.round(71 + Math.pow(k / 6, 1.5) * 64); pxRect(g, 0, y, ZW, 1, '#bfb7a6'); }   // tile rows, wider toward you
    for (let x0 = -200; x0 <= 440; x0 += 44) pxLine(g, 120 + (x0 - 120) * .42, 71, x0, 135, '#bfb7a6');                       // and their joints, running back to the wall
    const O = '#8c8e98', W = '#ffffff', T = '#f4f2ec', S = '#dcdad2', D = '#c2c0b8';
    if (v === 3) { g.fillStyle = dither('#6b5232', 9); g.beginPath(); g.ellipse(120, 124, 70, 10, 0, 0, 7); g.fill(); g.fillStyle = dither('#9fc0d0', 4 + Math.round(Math.sin(t * 2) * 2)); g.beginPath(); g.ellipse(126, 126, 46, 6, 0, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(50,40,30,0.25)'; g.beginPath(); g.ellipse(120, 123, 42, 5, 0, 0, 7); g.fill();   // contact shadow on the floor
    // the water supply: a shut-off on the wall and a braided line up to the tank
    pxRect(g, 64, 56, 6, 5, '#c9ccd4'); pxEllipse(g, 66, 55, 2, 2, '#e0e2e8'); pxLine(g, 69, 58, 84, 50, '#9aa0ab', 2);
    // the tank: rounded at the bottom corners, shaded on the left, with a thick lid and a chrome lever
    pxRect(g, 79, 10, 82, 42, O); pxRect(g, 80, 11, 80, 40, T); pxRect(g, 80, 11, 9, 40, S); pxRect(g, 153, 11, 7, 40, W); pxRect(g, 80, 49, 80, 2, D);
    pxRect(g, 79, 51, 2, 1, Decor.zoomWall('bath')); pxRect(g, 159, 51, 2, 1, Decor.zoomWall('bath'));
    pxRect(g, 75, 1, 90, 10, O); pxRect(g, 76, 2, 88, 4, W); pxRect(g, 76, 6, 88, 4, '#e4e2da'); pxRect(g, 76, 9, 88, 1, D);   // lid: its top face, then its front edge
    if (v === 2) { pxLine(g, 104, 2, 110, 10, '#6a6a62'); pxLine(g, 105, 2, 111, 10, '#a8a8a0'); }
    pxRect(g, 82, 16, 6, 6, '#b9bcc4'); pxRect(g, 74, 17, 14, 3, '#c9ccd4'); pxRect(g, 74, 17, 14, 1, W); pxRect(g, 74, 19, 14, 1, '#9aa0ae');
    // the seat cover, raised and leaning back on the tank: the same size and shape as the seat it closes over (its
    // rounded front end is now at the top), so we see its underside: a rim, a shallow recessed panel, and two bumpers
    const lidW = y => { const k = y < 36 ? Math.sqrt(Math.max(0, 1 - Math.pow((36 - y) / 30, 2))) : 1; return Math.round((y < 36 ? 41 : 41 - (y - 36) * .12) * k); };
    for (let y = 6; y < 58; y++) { const w = lidW(y); if (!w) continue; pxRect(g, 120 - w - 1, y, w * 2 + 2, 1, O); pxRect(g, 120 - w, y, w * 2, 1, '#f2f0e8'); pxRect(g, 120 - w, y, 3, 1, S); pxRect(g, 120 + w - 3, y, 3, 1, W); }
    for (let y = 13; y < 52; y++) { const w = lidW(y) - 7; if (w > 0) { pxRect(g, 120 - w, y, w * 2, 1, '#e6e4dc'); pxRect(g, 120 - w, y, 2, 1, D); } }   // the recessed panel
    for (const x of [100, 140]) { pxEllipse(g, x, 17, 3, 2, '#c8c6be'); pxRect(g, x - 2, 16, 3, 1, W); }                                                   // rubber bumpers
    // the bowl's body, under the seat: an elongated bowl that narrows, then flares into a pedestal on the floor
    for (let y = 74; y < 123; y++) {
      const k = (y - 74) / 49, w = Math.round(y < 108 ? 38 - 14 * Math.pow((y - 74) / 34, .9) : 24 + 7 * Math.pow((y - 108) / 15, 1.4));
      pxRect(g, 120 - w - 1, y, w * 2 + 2, 1, O); pxRect(g, 120 - w, y, w * 2, 1, T); pxRect(g, 120 - w, y, Math.max(3, Math.round(w * .32)), 1, S); pxRect(g, 120 + w - 5, y, 3, 1, W);
      if (y > 92 && y < 108) pxRect(g, 120 - Math.round(w * .55), y, 1, 1, D);                       // the curve of the trapway
    }
    pxRect(g, 89, 121, 62, 2, O);                                                                     // where the pedestal meets the floor
    for (const x of [93, 147]) { pxEllipse(g, x, 117, 3, 3, W); pxEllipse(g, x, 118, 3, 2, S); pxRect(g, x - 3, 120, 7, 1, O); }   // bolt caps
    // the seat: a ring with real thickness (its front edge shows), and the water in the bowl
    pxEllipse(g, 120, 74, 41, 15, O); pxEllipse(g, 120, 74, 40, 14, D);                              // underside / front edge of the seat
    pxEllipse(g, 120, 70, 41, 15, O); pxEllipse(g, 120, 70, 40, 14, W); pxEllipse(g, 120, 71, 39, 12, '#f2f0e8');   // its top
    pxEllipse(g, 120, 70, 28, 9, O); pxEllipse(g, 120, 70, 27, 8, S);                                // the opening, and the bowl's inner wall
    pxEllipse(g, 120, 72, 21, 5, '#bcd8e4'); pxRect(g, 108, 70, 9, 1, '#e2f2f8');                    // the water
    pxRect(g, 92, 56, 6, 4, '#c9ccd4'); pxRect(g, 142, 56, 6, 4, '#c9ccd4');                          // seat hinges
    if (v === 1) { const r = 2 + (t * 6) % 10; for (let a = 0; a < 6.28; a += .3) pxRect(g, 120 + Math.cos(a) * r * 1.6, 72 + Math.sin(a) * r * .4, 1, 1, '#e2f2f8'); }
    Z.vignette(g);
  },
  outlet(g, v, fl, t) {
    Z.wall(g, 0, 0, ZW, ZH, Decor.zoomWall('bath'), 8);
    const pc = v === 3 ? '#e6d59a' : '#f6f3ea';
    if (fl.open && v === 1) {
      pxRect(g, 84, 14, 72, 110, '#6a6a62'); pxRect(g, 88, 18, 64, 102, '#2a2a28');
      pxRect(g, 92, 30, 56, 70, '#d8d4c8'); pxLine(g, 96, 40, 112, 100, '#1a1a1a', 2); pxLine(g, 144, 40, 128, 100, '#eeeeee', 2); pxLine(g, 120, 24, 120, 104, '#c9a227', 2);
      g.fillStyle = dither('#3a2410', 10); g.fillRect(90, 34, 60, 40); pxRect(g, 98, 44, 10, 6, '#1a1008'); pxRect(g, 130, 52, 12, 5, '#1a1008');
    } else {
      Z.plate(g, 64, 6, 112, 124, pc);
      if (v === 2) { g.fillStyle = Decor.zoomWall('bath'); g.beginPath(); g.moveTo(176, 6); g.lineTo(140, 6); g.lineTo(176, 40); g.fill(); pxLine(g, 140, 6, 176, 40, '#8b8574'); pxRect(g, 156, 8, 18, 4, '#7a7a72'); pxLine(g, 120, 30, 150, 22, '#9a9484'); }
      Z.screw(g, 120, 12); Z.screw(g, 120, 124);
      pxRect(g, 86, 20, 68, 98, pc); pxRect(g, 86, 20, 68, 1, '#ffffff'); pxRect(g, 86, 117, 68, 1, '#cfc8b6');
      for (const y of [26, 88]) { pxRect(g, 100, y, 40, 22, v === 3 ? '#efe0a6' : '#fbf8f0'); pxRect(g, 109, y + 5, 2, 9, '#222'); pxRect(g, 128, y + 5, 2, 11, '#222'); pxEllipse(g, 120, y + 17, 2, 2, '#222'); }
      pxRect(g, 104, 54, 32, 10, '#1d1d1f'); pxRect(g, 104, 54, 32, 1, '#4a4a50'); pxRect(g, 112, 58, 16, 2, '#9a9aa0');
      pxRect(g, 104, 70, 32, 10, v === 3 ? '#efe0a6' : '#ffffff'); pxRect(g, 104, 79, 32, 1, '#cfc8b6'); pxRect(g, 112, 74, 16, 2, '#d64545');
      if (v === 1) { for (const y of [26, 88]) { g.fillStyle = dither('#5a3a1a', 9); g.fillRect(102, y + 2, 36, 18); pxRect(g, 108, y + 4, 4, 13, '#2a1a0a'); pxRect(g, 127, y + 4, 4, 14, '#2a1a0a'); } if (Math.sin(t * 40) > .97) pxRect(g, 112, 30, 1, 1, '#fff27a'); }
      if (v === 0 || v === 2) pxRect(g, 148, 24, 2, 2, Math.sin(t * 3) > 0 ? '#7bd36b' : '#3a6a34');
    }
    Z.vignette(g);
  },
  smoke(g, v, fl, t) {
    Z.popcorn(g);
    if (fl.open && v === 3) {
      pxEllipse(g, 120, 66, 54, 34, '#d8d8d0'); pxEllipse(g, 120, 66, 50, 30, '#e8e8e2'); pxRect(g, 98, 56, 44, 18, '#2a2a28'); pxRect(g, 100, 58, 40, 14, '#3a3a38');
      pxLine(g, 150, 60, 170, 92, '#d64545', 2); pxLine(g, 154, 60, 176, 90, '#1a1a1a', 2); pxLine(g, 158, 60, 182, 94, '#e8c34a', 2); pxRect(g, 168, 92, 16, 6, '#f2f2ea');
      Z.vignette(g); return;
    }
    const body = v === 1 ? '#ddd2a2' : '#f0f0ea', rim = v === 1 ? '#c4b884' : '#d6d6ce';
    pxEllipse(g, 122, 70, 72, 48, 'rgba(0,0,0,0.12)');
    pxEllipse(g, 120, 66, 72, 48, rim); pxEllipse(g, 120, 64, 68, 44, body);
    for (const r of [56, 46, 36]) for (let a = 0; a < 6.28; a += .12) if (Math.floor(a * 8) % 2) pxRect(g, 120 + Math.cos(a) * r, 64 + Math.sin(a) * r * .64, 2, 1, rim);
    pxEllipse(g, 120, 66, 14, 10, rim); pxEllipse(g, 120, 65, 12, 8, v === 1 ? '#e8dcaa' : '#fafaf6');
    const ledOn = v !== 3 && Utilities.on('smoke') && (t % 1.4) < .18;
    pxEllipse(g, 157, 45, 3, 2, v === 3 || !Utilities.on('smoke') ? '#3a3a38' : ledOn ? '#7bff6b' : '#2f6a2a');
    if (v === 2) { pxEllipse(g, 86, 50, 14, 9, '#c8c8c0'); pxEllipse(g, 86, 50, 9, 5, '#b0b0a8'); pxCrack(g, 86, 50, .2, 50, '#7a7a72', 21); pxCrack(g, 86, 50, 2.6, 30, '#7a7a72', 23); }
    Z.vignette(g);
  },
  closet(g, v, fl, t) {
    Z.wall(g, 0, 0, ZW, ZH, Decor.zoomWall('bedroom'), 10);
    pxRect(g, 16, 0, 208, 10, '#c0c4cc'); pxRect(g, 16, 8, 208, 2, '#7d8290');
    if (fl.open) {                           // doors folded back: shelf, rod, hangers, and whatever got left on the floor
      pxRect(g, 44, 10, 152, 125, '#3a3540'); pxRect(g, 44, 10, 152, 3, '#24202a'); speckle(g, 44, 10, 152, 125, 'rgba(0,0,0,0.15)', 200, 4);
      pxRect(g, 44, 26, 152, 4, '#e8e4dc'); pxRect(g, 44, 30, 152, 1, '#8a8690'); pxRect(g, 44, 38, 152, 2, '#c8ccd4');
      for (const [x, tilt] of [[58, 0], [68, 1], [76, -1], [103, 0], [139, 2], [148, 0], [181, -1]]) {   // hangers bunched together in places, with gaps, a couple hanging crooked
        pxLine(g, x, 39, x - 8, 48 + tilt, '#9aa0ab'); pxLine(g, x, 39, x + 8, 48 - tilt, '#9aa0ab'); pxLine(g, x - 8, 48 + tilt, x + 8, 48 - tilt, '#9aa0ab'); pxRect(g, x, 35, 1, 4, '#9aa0ab'); pxRect(g, x - 1, 35, 2, 1, '#c8ccd4');
      }
      pxRect(g, 44, 126, 152, 9, '#2a2630'); Z.item(g, 'closet', 120, 126, 2);   // a closet is wide: things on its floor are smaller in frame
      for (const x of [20, 196]) { pxRect(g, x, 12, 24, 123, '#e8e8e4'); pxRect(g, x + 11, 12, 2, 123, '#c8ccd2'); for (let k = 22; k < 66; k += 4) pxRect(g, x + 2, k, 20, 1, '#c8ccd2'); }
      if (v === 2) { fillPoly(g, blobPts(30, 92, 6, 8, 3, .6, 10), '#3a2a1a'); }
      Z.vignette(g); return;
    }
    if (v === 1) for (const x of [40, 96, 150, 200]) { pxEllipse(g, x, 5, 3, 3, '#e6e0cc'); pxRect(g, x - 4, 7, 8, 2, '#5a5040'); }
    const sag = v === 1 ? 3 : 0;
    for (let i = 0; i < 4; i++) {
      const x = 20 + i * 50, y = 12 + (i >= 2 ? sag : 0);
      pxRect(g, x, y, 49, 123, '#f4f4f0'); pxRect(g, x, y, 49, 1, '#ffffff'); pxRect(g, x + 48, y, 1, 123, '#c8ccd2');
      pxRect(g, x + 6, y + 8, 37, 48, '#e6e8ea'); for (let k = y + 10; k < y + 54; k += 4) { pxRect(g, x + 7, k, 35, 2, '#ffffff'); pxRect(g, x + 7, k + 2, 35, 1, '#c8ccd2'); }
      pxRect(g, x + 6, y + 64, 37, 50, '#e6e8ea'); pxRect(g, x + 8, y + 66, 33, 46, '#f4f4f0');
    }
    if (v === 1) { pxRect(g, 120, 12, 1, 123, '#5a6470'); g.fillStyle = dither('#3a4048', 6); g.fillRect(120, 12, 100, 3); }
    pxEllipse(g, 160, 68 + sag, 4, 4, '#c9a227'); pxEllipse(g, 159, 67 + sag, 2, 2, '#f2d870');
    if (v === 2) {                           // a fist-sized hole in the lower panel of the second leaf: torn veneer, then the paper honeycomb inside
      const cx = 95, cy = 94, outer = [], inner = [];
      for (let a = 0; a < 6.28; a += .3) { const ro = 13 + hash(a * 9) * 4, ri = 8 + hash(a * 5 + 2) * 4; outer.push([cx + Math.cos(a) * ro, cy + Math.sin(a) * ro * 1.15]); inner.push([cx + Math.cos(a) * ri, cy + Math.sin(a) * ri * 1.15]); }
      fillPoly(g, outer, '#d6cfbd');                                                         // veneer peeled back around the hole
      for (let i = 0; i < outer.length; i += 2) { const [x, y] = outer[i]; pxLine(g, x, y, cx + (x - cx) * 1.18, cy + (y - cy) * 1.18, '#b8b0a0'); }   // splinters
      fillPoly(g, inner, '#22180e');
      g.save(); poly(g, inner); g.clip();                                                    // honeycomb cells, only where the hole is
      for (let row = 0, y = cy - 18; y < cy + 20; y += 5, row++) for (let x = cx - 20 + (row % 2) * 4; x < cx + 20; x += 8) {
        pxLine(g, x, y, x + 2, y - 2, '#b08a5a'); pxLine(g, x + 2, y - 2, x + 5, y - 2, '#b08a5a'); pxLine(g, x + 5, y - 2, x + 7, y, '#b08a5a'); pxLine(g, x, y, x + 2, y + 2, '#8a6a42'); pxLine(g, x + 5, y + 2, x + 7, y, '#8a6a42');
      }
      g.restore();
      strokePoly(g, inner, '#6a5a44');
    }
    Z.vignette(g);
  },
  window(g, v, fl, t) {
    Z.wall(g, 0, 0, ZW, ZH, Decor.zoomWall('bedroom'), 10);
    pxRect(g, 30, 0, 180, 104, '#f4f4f0');
    const T = Decor.time, lc = Decor.pal('bedroom').leaves, sky = g.createLinearGradient(0, 6, 0, 92); sky.addColorStop(0, T.sky[0]); sky.addColorStop(.6, T.sky[1]); sky.addColorStop(1, T.sky[2]);
    g.fillStyle = sky; g.fillRect(36, 6, 168, 86);
    pxRect(g, 150, 46, 54, 46, '#b07a5a'); for (let y = 52; y < 92; y += 8) for (let x = 154; x < 204; x += 10) pxRect(g, x, y, 5, 4, '#f3e2b0');   // building across the street
    const sway = Math.sin(t * .9) * 3 * (Settings.get('motion') ? 1 : 0);
    pxLine(g, 36, 70, 120 + sway, 46, '#5a3f2a', 3); pxLine(g, 80, 58, 110 + sway, 24, '#5a3f2a', 2);
    for (let i = 0; i < 6; i++) foliage(g, 66 + hash(i) * 92, 18 + hash(i + 9) * 40, 18 + hash(i + 4) * 8, 11 + hash(i + 7) * 5, lc, 90 + i * 13, sway * (.6 + hash(i + 3) * .8));
    if (T.rain) for (let i = 0; i < 40; i++) { const rx = 36 + hash(i) * 168, ry = 6 + ((hash(i * 3) * 86 + t * 70) % 86); pxLine(g, rx, ry, rx - 1, Math.min(91, ry + 5), 'rgba(220,232,245,0.75)'); }
    Birds.draw(g, 'window', t);                                   // now and then, a visitor (js/windows.js)
    pxRect(g, 30, 46, 180, 6, '#f4f4f0'); pxRect(g, 30, 51, 180, 1, '#c8ccd2'); pxRect(g, 30, 0, 6, 104, '#f4f4f0'); pxRect(g, 204, 0, 6, 104, '#f4f4f0');
    pxRect(g, 112, 92, 16, 6, '#d9dce4'); pxRect(g, 116, 90, 8, 3, '#b9bcc4');
    if (v === 1) { g.fillStyle = dither('#eef2f4', 8); g.fillRect(36, 6, 168, 40); g.fillRect(36, 52, 168, 40); speckle(g, 36, 52, 168, 40, '#ffffff', 120, 5); }
    if (v === 2) { const cx = 96, cy = 72; for (let a = 0; a < 6.28; a += .55) pxCrack(g, cx, cy, a, 30, '#ffffff', a * 10 | 0); for (const r of [6, 12]) for (let a = 0; a < 6.28; a += .25) pxRect(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r * .8, 1, 1, '#ffffff'); }
    pxRect(g, 24, 98, 192, 8, '#ffffff'); pxRect(g, 24, 106, 192, 3, '#c8ccd2');
    g.fillStyle = Decor.time.sun ? dither(Decor.time.sun, 3) : 'rgba(0,0,0,0)'; g.beginPath(); g.moveTo(36, 109); g.lineTo(204, 109); g.lineTo(230, 135); g.lineTo(50, 135); g.fill();
    if (v === 3) {
      // mildew on the sill only (thickest in the corners, where water sits), never on the glass, plus water streaks down the wall below
      speckle(g, 26, 99, 188, 7, 'rgba(36,40,28,0.75)', 90, 3); speckle(g, 26, 99, 188, 7, 'rgba(70,96,52,0.7)', 50, 4);
      for (const cx of [27, 196]) { speckle(g, cx, 98, 17, 8, 'rgba(30,34,22,0.85)', 40, 6); speckle(g, cx, 98, 17, 8, 'rgba(80,104,58,0.7)', 18, 7); }
      for (const x of [60, 110, 170]) { g.fillStyle = dither('#8a7a4a', 6); g.fillRect(x, 109, 6, 26); }
    }
    Z.vignette(g);
  },
  bwall(g, v, fl, t) {
    Z.wall(g, 0, 0, ZW, 108, Decor.zoomWall('bedroom', 'left'), 10);
    Z.sunbeam(g, 30, 50, 3);
    pxRect(g, 0, 108, ZW, 27, '#f4f4f0'); pxRect(g, 0, 108, ZW, 2, '#9aa4ae'); pxRect(g, 0, 114, ZW, 1, '#dcdfe2');
    pxRect(g, 0, 130, ZW, 5, '#8a96a8'); speckle(g, 0, 130, ZW, 5, '#6a7686', 60, 2);
    if (v === 1) { g.fillStyle = dither('#7d8794', 5); g.fillRect(56, 44, 130, 12); g.fillStyle = dither('#7d8794', 3); g.fillRect(48, 40, 146, 20); for (let i = 0; i < 12; i++) pxLine(g, 60 + i * 10, 46 + hash(i) * 6, 70 + i * 10, 48 + hash(i + 1) * 6, '#8a929c'); }
    bwallDrawing(g, v);                                           // the drawing itself (shared with the room: js/rooms.js)
    Z.vignette(g);
  },
  frontdoor(g, v, fl, t) {
    Z.wall(g, 0, 0, ZW, ZH, Decor.zoomWall('living'), 12);
    pxRect(g, 0, 119, ZW, 4, '#b8b2a4'); const cf = Decor.pal('living').floor; pxRect(g, 0, 123, ZW, 12, cf.base); speckle(g, 0, 123, ZW, 12, cf.dk, 160, 4);
    pxRect(g, 6, 0, 174, 122, '#f6f3ea');                                                            // the casing around the opening
    const ang = CloseupExtras.boltAngle(fl, v, t), thrown = !!fl.bolt && v !== 3;
    if (fl.open) {                           // swung in toward you: the hallway outside, the door's edge, and the jamb with its strike plates
      pxRect(g, 10, 0, 166, 119, '#c9b48e'); pxRect(g, 10, 76, 166, 3, '#f2ece0');                       // the hall wall across the way, and its chair rail
      pxRect(g, 10, 100, 166, 19, '#5a1e2a'); for (let x = 14; x < 176; x += 16) pxRect(g, x, 104 + (x / 16 % 2) * 6, 8, 2, '#6e2a36');   // hall carpet
      pxRect(g, 112, 8, 52, 92, '#7d4a2c'); pxRect(g, 112, 8, 52, 2, '#5a3018'); pxRect(g, 132, 4, 12, 4, '#c9a227');   // the neighbor's door
      pxRect(g, 176, 0, 16, 119, '#ece6d6'); pxRect(g, 176, 0, 2, 119, '#d0c8b6'); pxRect(g, 191, 0, 1, 119, '#c8c0ae');   // the jamb, face on
      pxRect(g, 180, 48, 8, 14, '#c9a227'); pxRect(g, 182, 52, 4, 6, '#3a2a10'); pxRect(g, 180, 76, 8, 12, '#c9a227'); pxRect(g, 182, 79, 4, 6, '#3a2a10');
      if (v === 2) {                         // the jamb split around the strike plate, raw wood showing
        const split = [[177, 38], [186, 41], [184, 49], [188, 57], [184, 65], [188, 74], [182, 81], [177, 86]];
        g.save(); poly(g, split); g.clip(); pxRect(g, 176, 36, 14, 52, '#c8a070'); for (let x = 178; x < 189; x += 3) pxLine(g, x, 36, x + 1, 88, '#a8804c'); g.restore();
        strokePoly(g, split, '#7a5a32'); fillPoly(g, [[178, 50], [185, 52], [185, 64], [178, 62]], '#c9a227'); pxRect(g, 180, 55, 3, 5, '#3a2a10');
      }
      // the door leaf, swung most of the way open on its left hinges: narrow, and taller than the opening because it's closer
      fillPoly(g, [[10, 0], [62, -10], [62, 134], [10, 119]], '#ece7da'); fillPoly(g, [[62, -10], [68, -9], [68, 133], [62, 134]], '#cfc8b6');   // face and edge
      for (const [ya, yb] of [[6, 26], [34, 72], [80, 110]]) fillPoly(g, [[18, ya + 1], [54, ya - 5], [54, yb + 3], [18, yb]], '#e0dacb');
      if (thrown) { pxRect(g, 68, 52, 7, 5, '#c9a227'); pxRect(g, 68, 52, 7, 1, '#f2d870'); }           // the bolt, thrown, sticking out of the edge
      pxRect(g, 68, 79, 4, 4, '#c9a227');                                                                 // the latch
      pxEllipse(g, 56, 56, 4, 6, '#c9a227'); pxEllipse(g, 56, 80, 5, 7, '#e8c34a');                    // deadbolt and knob, edge on
      Z.vignette(g); return;
    }
    pxRect(g, 10, 0, 166, 116, '#ece7da');                                                            // the steel door, shut
    for (const [x, w] of [[22, 62], [100, 62]]) for (const [y, h] of [[4, 20], [32, 40], [80, 30]]) { pxRect(g, x, y, w, h, '#e0dacb'); pxRect(g, x, y, w, 1, '#c8c1b0'); pxRect(g, x, y, 1, h, '#c8c1b0'); pxRect(g, x + 1, y + h - 1, w - 1, 1, '#f8f6f0'); }
    pxEllipse(g, 93, 28, 4, 4, '#c9a227'); pxEllipse(g, 93, 28, 2, 2, '#2a2a30'); pxRect(g, 92, 27, 1, 1, '#8a8aa0');   // peephole, centered on the door
    pxRect(g, 175, 0, 2, 116, '#b8b0a0');                                                              // the gap where the door meets the jamb
    pxRect(g, 180, 0, 60, 135, '#f6f3ea'); pxRect(g, 186, 0, 2, 122, '#e0dacb');                      // the casing beside the lock
    if (v === 2) {                           // the jamb split behind the casing: hairline cracks and a little bulge, all you can see with the door shut
      pxCrack(g, 182, 40, 1.5, 34, '#9a8a70', 5, 1); pxCrack(g, 184, 58, 1.62, 26, '#9a8a70', 9, 1); fillPoly(g, [[178, 46], [184, 48], [184, 70], [178, 72]], 'rgba(120,96,64,0.18)');
    }
    // the deadbolt: a brass rose with a thumb-turn that really turns (up and down is open, sideways is locked)
    pxEllipse(g, 157, 52, 9, 9, '#a07a10'); pxEllipse(g, 157, 52, 8, 8, '#c9a227'); pxEllipse(g, 157, 51, 6, 6, '#e8c34a');
    const ca = Math.cos(ang), sa = Math.sin(ang);
    fillPoly(g, [[157 - sa * 7 - ca * 2, 52 + ca * 7 - sa * 2], [157 - sa * 7 + ca * 2, 52 + ca * 7 + sa * 2], [157 + sa * 7 + ca * 2, 52 - ca * 7 + sa * 2], [157 + sa * 7 - ca * 2, 52 - ca * 7 - sa * 2]], '#8a6a10');
    fillPoly(g, [[157 - sa * 6 - ca, 52 + ca * 6 - sa], [157 - sa * 6 + ca, 52 + ca * 6 + sa], [157 + sa * 6 + ca, 52 - ca * 6 + sa], [157 + sa * 6 - ca, 52 - ca * 6 - sa]], '#f2d870');
    // the knob
    pxEllipse(g, 157, 81, 9, 9, '#c9a227'); pxEllipse(g, 157, 81, 7, 7, '#e8c34a'); pxEllipse(g, 155, 79, 2, 2, '#fff2b0');
    // the bottom: sweep and threshold
    pxRect(g, 10, 114, 166, 3, v === 1 ? '#6a6a62' : '#2a2a2a');
    if (v === 1) { pxRect(g, 10, 117, 166, 2, '#fff2c0'); for (let x = 18; x < 170; x += 21) pxRect(g, x, 114, 3, 2, '#fff2c0'); }
    Z.vignette(g);
  },
  fridge(g, v, fl, t) {
    Z.wall(g, 0, 0, ZW, ZH, Decor.zoomWall('kitchen'), 6);
    pxRect(g, 0, 118, ZW, 17, '#e8dcc0'); for (let x = 0; x < ZW; x += 30) pxRect(g, x, 118, 1, 17, '#cbbd9c');
    if (v === 3) { fillPoly(g, blobPts(110, 126, 70, 7, 5, .4, 22), rgba('#8ab8d0', .65)); pxRect(g, 70, 125, 30, 1, '#d8f0ff'); }
    pxRect(g, 18, 2, 220, 116, '#1d1f25'); pxRect(g, 18, 2, 220, 2, '#3a3d46'); pxRect(g, 18, 110, 220, 8, '#141518');   // cabinet, kick plate
    pxRect(g, 20, 4, 96, 104, '#25272e'); pxRect(g, 20, 4, 4, 104, '#33363f');                                     // freezer door
    pxRect(g, 98, 30, 4, 50, '#c9ccd4'); pxRect(g, 98, 30, 1, 50, '#ffffff');                                      // freezer handle
    for (const [x, y, c] of [[34, 22, '#e8c34a'], [58, 30, '#d64545'], [44, 60, '#4a8fe0']]) { pxRect(g, x, y, 6, 6, c); pxRect(g, x + 1, y + 1, 2, 2, '#ffffff'); }
    pxRect(g, 30, 74, 20, 26, '#fbf6e8'); pxRect(g, 30, 74, 20, 4, '#d43a2a'); pxRect(g, 34, 82, 12, 1, '#8a8a90'); pxRect(g, 34, 86, 9, 1, '#8a8a90'); pxRect(g, 38, 72, 4, 4, '#3a9a4a');   // takeout menu under a magnet
    if (v === 2) { fillPoly(g, blobPts(70, 58, 14, 9, 3, .55, 14), '#15161b'); fillPoly(g, blobPts(68, 55, 9, 3, 8, .5, 10), '#3a3d46'); pxRect(g, 64, 54, 6, 1, '#5a5e68'); }
    if (isOpen('freezer')) {                 // the freezer side open too (from the room): frosty shelves, and the door swung out to the left
      pxRect(g, 24, 4, 92, 104, '#e8f0f4'); pxRect(g, 24, 4, 92, 3, '#ffffff');
      for (const y of [30, 56, 82]) { pxRect(g, 26, y, 88, 2, '#c8dce4'); pxRect(g, 26, y + 2, 88, 1, '#a8bcc4'); }
      speckle(g, 26, 8, 88, 98, '#ffffff', 40, 5);
      Z.item(g, 'freezer', 70, 54);
      pxRect(g, 4, 2, 16, 116, '#dfe6ea'); pxRect(g, 18, 2, 2, 116, '#b8c4c8'); for (const y of [24, 54, 84]) pxRect(g, 4, y, 14, 4, '#c8d4d8');
    }
    if (!fl.open) {
      pxRect(g, 118, 4, 118, 104, '#25272e'); pxRect(g, 118, 4, 4, 104, '#2f3139');
      pxRect(g, 118, 4, 2, 104, v === 1 ? '#4a4a44' : '#121317');                                            // the door seal
      pxRect(g, 124, 30, 4, 50, '#c9ccd4'); pxRect(g, 127, 30, 1, 50, '#ffffff'); pxRect(g, 123, 30, 1, 50, '#8a8e98');   // the fridge handle, on the fridge door's own edge
      if (v === 1) { pxRect(g, 118, 96, 3, 12, '#6a6a62'); pxRect(g, 119, 100, 1, 4, '#d8d0b0'); }
      pxRect(g, 140, 16, 70, 30, '#2a2c33'); pxRect(g, 146, 22, 58, 18, '#3a3d46');                             // water and ice dispenser
    } else {                                 // door open: the light's on, and you can see what's inside
      const warm = v === 3, inner = warm ? '#d8d6c8' : '#f2f8fa';
      pxRect(g, 118, 4, 104, 104, inner); pxRect(g, 118, 4, 104, 3, warm ? '#c0beb0' : '#ffffff');
      pxEllipse(g, 170, 9, 5, 2, warm ? '#d8d0a0' : '#fffbe0');
      for (const y of [36, 66]) { pxRect(g, 120, y, 100, 2, '#c8dce4'); pxRect(g, 120, y + 2, 100, 1, '#a8bcc4'); }
      pxRect(g, 122, 82, 46, 24, v === 2 ? '#d0dee4' : '#e0eef2'); pxRect(g, 172, 82, 46, 24, '#e0eef2'); pxRect(g, 122, 82, 96, 1, '#a8bcc4');
      if (v === 2) { pxCrack(g, 130, 84, 1.2, 22, '#6a7a84', 3, 1); pxCrack(g, 150, 84, 1.6, 18, '#6a7a84', 9, 1); }
      if (warm) speckle(g, 122, 10, 96, 70, '#a8b8c0', 60, 3);
      Z.item(g, 'fridge', 160, 65);
      pxRect(g, 222, 2, 16, 116, '#e6ecee'); pxRect(g, 222, 2, 2, 116, '#b8c4c8'); for (const y of [24, 54, 84]) pxRect(g, 224, y, 14, 4, '#c8d4d8');   // the open door's shelves
    }
    Z.vignette(g);
  },
  thermostat(g, v, fl, t) {
    Z.wall(g, 0, 0, ZW, ZH, Decor.zoomWall('living'), 14);
    Z.sunbeam(g, 160, 60, 2);
    if (v === 3) {                           // cover off: the base plate and the wires behind it
      pxRect(g, 78, 22, 84, 88, '#9a9a92'); pxRect(g, 78, 22, 84, 2, '#b8b8b0'); pxRect(g, 112, 50, 16, 26, '#2a2622');
      for (const [c, dx, dy] of [['#d64545', -14, 18], ['#f4f4ec', 4, 24], ['#3a9a4a', 16, 14], ['#2a5ad0', -6, 30]]) { pxLine(g, 120, 62, 120 + dx, 62 + dy, c, 2); pxLine(g, 120 + dx, 62 + dy, 120 + dx * 1.3, 70 + dy, c, 2); }
      fillPoly(g, blobPts(106, 82, 6, 5, 7, .5, 10), '#5a3a1a'); pxRect(g, 103, 79, 6, 5, '#c8a050'); speckle(g, 96, 72, 22, 18, '#3a2410', 18, 4);
      Z.screw(g, 84, 28); Z.screw(g, 156, 104); Z.vignette(g); return;
    }
    const body = v === 1 ? '#e2d4a2' : '#ece2c8', tilt = v === 2;
    g.save(); if (tilt) { g.translate(120, 66); g.rotate(.09); g.translate(-120, -66); }
    pxRect(g, 70, 18, 100, 96, '#b8ae94'); pxRect(g, 72, 16, 96, 96, body); pxRect(g, 72, 16, 96, 3, '#fbf6e8');
    const pw = Utilities.on('hvac');           // with the FURNACE/AC breaker off, the screen goes dark
    pxRect(g, 90, 36, 60, 26, '#6a8a6a'); pxRect(g, 92, 38, 56, 22, pw ? '#9fd0a4' : '#4a5a4c');
    if (pw) { g.font = "14px 'Silkscreen', monospace"; g.fillStyle = '#2a4a2a'; g.fillText('68', 106, 55); }
    for (const x of [96, 128]) { pxRect(g, x, 68, 18, 12, v === 1 ? '#d2c290' : '#d8ceb4'); pxRect(g, x + 7, v === 1 ? 72 : 71, 4, 3, v === 1 ? '#c2b282' : '#8a7a5a'); }
    pxRect(g, 100, 92, 40, 3, '#c8bc9e');
    g.restore();
    if (tilt) { pxLine(g, 74, 70, 168, 60, '#5a4a30', 2); pxLine(g, 120, 64, 128, 92, '#6a5a3a'); pxRect(g, 160, 22, 10, 4, '#2a2622'); }
    Z.vignette(g);
  },
  patio(g, v, fl, t) {
    const T = Decor.time, sky = g.createLinearGradient(0, 0, 0, 120); sky.addColorStop(0, T.sky[0]); sky.addColorStop(1, T.sky[2]);
    g.fillStyle = sky; g.fillRect(0, 0, ZW, 120);
    pxRect(g, 0, 70, ZW, 4, '#5a5a62'); for (let x = 4; x < ZW; x += 12) pxRect(g, x, 74, 2, 46, '#5a5a62');   // balcony rail
    foliage(g, 200, 26, 40, 22, Decor.pal('living').leaves, 77, Math.sin(t) * 2 * (Settings.get('motion') ? 1 : 0));
    if (T.rain) for (let i = 0; i < 26; i++) { const x = hash(i) * ZW, y = (hash(i * 3) * 120 + t * 70) % 120; pxLine(g, x, y, x - 1, y + 5, 'rgba(220,232,245,0.7)'); }
    pxRect(g, 150, 0, 10, 122, '#c0c4cc'); pxRect(g, 150, 0, 2, 122, '#e0e3ea');      // door frame where the panels meet
    pxRect(g, 158, 58, 18, 22, '#d9dce4'); pxRect(g, 161, v === 3 ? 66 : 62, 12, 4, v === 3 ? '#8a8e98' : '#b9bcc4');   // latch
    if (v === 3) { pxRect(g, 160, 74, 3, 3, '#2a2a30'); pxLine(g, 166, 70, 172, 80, '#8a8e98'); }
    const slats = 10, w = 150 / slats;
    if (fl.blindsOpen) {                    // drawn open: slats turned edge-on and stacked at the left
      for (let i = 0; i < slats; i++) { if (v === 2 && i >= 3 && i <= 6 && i !== 4) continue; pxRect(g, 2 + i * 4, 0, 3, v === 2 && i === 4 ? 52 : 120, i % 2 ? '#efeadf' : '#d8d2c2'); }
      pxRect(g, 0, 0, 152, 4, '#d8d2c2'); pxRect(g, 0, 120, ZW, 15, '#9a9ea8'); pxRect(g, 0, 124, ZW, 2, '#6a6e78'); if (v === 1) speckle(g, 0, 124, ZW, 8, '#5a5040', 120, 6);
      Z.vignette(g); return;
    }
    for (let i = 0; i < slats; i++) {
      if (v === 2 && i >= 3 && i <= 6) { if (i === 4) pxRect(g, i * w + 1, 0, w - 3, 52, '#ece6d8'); if (i === 5) pxRect(g, i * w + 1, 0, w - 3, 30, '#e6e0d2'); continue; }
      pxRect(g, i * w + 1, 0, w - 3, 120, i % 2 ? '#efeadf' : '#e6e0d2'); pxRect(g, i * w + 1, 0, 1, 120, '#ffffff');
      if (v === 1 && (i === 1 || i === 7)) { pxLine(g, i * w + 1, 92, i * w + w - 2, 84, '#b8b2a2'); pxLine(g, i * w + 1, 93, i * w + w - 2, 85, '#f8f4ea'); }
    }
    pxRect(g, 0, 0, 152, 4, '#d8d2c2');
    pxRect(g, 0, 120, ZW, 15, '#9a9ea8'); pxRect(g, 0, 124, ZW, 2, '#6a6e78');
    if (v === 1) speckle(g, 0, 124, ZW, 8, '#5a5040', 120, 6);
    Z.vignette(g);
  },
  dishwasher(g, v, fl, t) {
    Z.wall(g, 0, 0, ZW, 6, Decor.zoomWall('kitchen'), 6);
    pxRect(g, 0, 4, ZW, 8, '#8a8174'); pxRect(g, 0, 10, ZW, 2, '#5e564c');                    // countertop edge
    pxRect(g, 0, 12, 30, 106, '#b07a42'); pxRect(g, 210, 12, 30, 106, '#b07a42'); pxRect(g, 28, 12, 2, 106, '#7a4f28'); pxRect(g, 210, 12, 2, 106, '#7a4f28');
    const kf = Decor.pal('kitchen').floor; pxRect(g, 0, 118, ZW, 17, kf[0]); for (let x = 0; x < ZW; x += 40) pxRect(g, x + (x / 40 % 2 ? 20 : 0), 118, 20, 17, kf[1]);
    if (v === 3) { fillPoly(g, blobPts(120, 126, 80, 8, 4, .4, 20), 'rgba(80,60,40,0.45)'); pxRect(g, 70, 119, 50, 1, '#f8f0e0'); }
    pxRect(g, 30, 12, 180, 20, '#d8d6ce'); for (let i = 0; i < 5; i++) pxRect(g, 52 + i * 18, 20, 10, 5, '#ecebe6'); pxRect(g, 186, 21, 3, 3, '#d64545');
    if (!fl.open) {
      pxRect(g, 30, 32, 180, 86, '#ecebe6'); pxRect(g, 30, 32, 180, 2, '#ffffff'); pxRect(g, 44, 38, 152, 4, '#9a9ea8'); pxRect(g, 44, 38, 152, 1, '#c8ccd4');
      if (v === 2) { fillPoly(g, blobPts(118, 80, 22, 14, 9, .45, 16), '#cfcdc4'); fillPoly(g, blobPts(114, 78, 12, 7, 13, .5, 12), '#b8b6ae'); pxLine(g, 160, 14, 176, 28, '#8a8e98'); }
    } else {
      pxRect(g, 30, 32, 180, 72, '#2a2c32'); pxRect(g, 30, 32, 180, 4, '#18191d');
      for (const y of [52, 82]) { pxRect(g, 36, y, 168, 2, '#b9bcc4'); for (let x = 40; x < 202; x += 7) { pxRect(g, x, y - 12, 1, 12, '#9aa0ab'); if (v === 1) pxRect(g, x, y - 12, 1, 2, '#b8602a'); } }
      if (v === 3) pxLine(g, 30, 102, 120, 102, '#1a1a1a', 2);
      Z.item(g, 'dishwasher', 150, 81);
      pxRect(g, 26, 104, 188, 14, '#d8d6ce'); pxRect(g, 26, 104, 188, 2, '#ffffff');
    }
    Z.vignette(g);
  },
  kfloor(g, v, fl, t) {
    // looking down at the same checkerboard vinyl as the room: square tiles in its two colors, with grout lines and a little bevel
    const [a, b, g0] = Decor.pal('kitchen').floor, grout = g0 || mix(b, '#2a1a10', .3), S = 40;
    for (let y = -10, r = 0; y < ZH; y += S, r++) for (let x = -20, c = 0; x < ZW; x += S, c++) {
      const col = (r + c) % 2 ? a : b; pxRect(g, x, y, S, S, col);
      pxRect(g, x + 2, y + 2, S - 4, 1, mix(col, '#ffffff', .35)); pxRect(g, x + 2, y + 2, 1, S - 4, mix(col, '#ffffff', .2));
      pxRect(g, x + 2, y + S - 3, S - 4, 1, mix(col, '#000000', .08));
      pxRect(g, x, y, S, 2, grout); pxRect(g, x, y, 2, S, grout);
    }
    speckle(g, 0, 0, ZW, ZH, 'rgba(0,0,0,0.05)', 500, 3);
    Z.sunbeam(g, 120, 70, 2);
    if (v === 1) {                           // a worn lane: soft-edged, wider where people turn
      const lane = []; for (let i = 0; i <= 12; i++) { const k = i / 12, x = k * 260 - 10, y = 122 - k * 96 + Math.sin(k * 5) * 6; lane.push([x, y - 14 - hash(i) * 8]); }
      for (let i = 12; i >= 0; i--) { const k = i / 12, x = k * 260 - 10, y = 122 - k * 96 + Math.sin(k * 5) * 6; lane.push([x + 6, y + 14 + hash(i + 20) * 8]); }
      fillPoly(g, lane, 'rgba(140,128,104,0.34)'); speckle(g, 20, 20, 210, 110, 'rgba(90,80,60,0.22)', 220, 7);
      for (let i = 0; i < 9; i++) { const k = (i + .5) / 9, x = k * 240, y = 122 - k * 96 + Math.sin(k * 5) * 6; pxLine(g, x - 6, y + 2, x + 6, y - 1, 'rgba(70,60,46,0.4)'); }   // scuffs along the lane
    }
    if (v === 2) stain(g, blobPts(150, 70, 30, 20, 21, .35, 20), 'rgba(50,30,14,0.75)', 'rgba(20,10,4,0.85)', 21);
    if (v === 3) {                           // one tile (the one at 100,30) peeling up at its corner, the glue showing underneath
      fillPoly(g, [[100, 30], [142, 30], [142, 72], [100, 72]], '#6a4a2a'); speckle(g, 102, 32, 38, 38, '#3a2a1a', 40, 3);   // the bare, gluey subfloor
      fillPoly(g, [[136, 70], [150, 54], [154, 60], [142, 76]], 'rgba(20,12,4,0.4)');                                     // the lifted corner's shadow
      fillPoly(g, [[102, 32], [140, 32], [140, 50], [150, 56], [138, 70], [102, 70]], b);                                  // the tile, its corner curled toward you
      pxLine(g, 140, 50, 150, 56, '#ffffff'); pxLine(g, 150, 56, 138, 70, '#ffffff'); pxLine(g, 102, 32, 140, 32, 'rgba(255,255,255,0.7)');
      pxLine(g, 138, 70, 102, 70, mix(b, '#000000', .25));
    }
    Z.vignette(g);
  },
  vent(g, v, fl, t) {
    // looking straight up at a ceiling exhaust fan: a square white grille of angled louvers in a bevelled frame,
    // the dark housing showing between the slats (and the blower wheel spinning back there when it's on)
    Z.popcorn(g);
    if (v === 3) { for (let i = 0; i < 260; i++) { const a = hash(i) * 6.28, d = 52 + hash(i + 7) * 40; pxRect(g, 120 + Math.cos(a) * d * 1.2, 62 + Math.sin(a) * d * .7, hash(i + 2) > .7 ? 2 : 1, 1, i % 3 ? '#2a3020' : '#4a5a30'); } }
    const on = ROOMS.bath.ventOn && v !== 3, X0 = 74, Y0 = 18, N = 94, spin = on ? t * 18 : 0;
    const rrect = (x, y, w, h, r, c) => { g.fillStyle = c; for (let j = 0; j < h; j++) { const d = j < r ? r - j - .5 : j >= h - r ? j - (h - r) + .5 : -1, ins = d < 0 ? 0 : Math.round(r - Math.sqrt(Math.max(0, r * r - d * d))); g.fillRect(x + ins, y + j, w - 2 * ins, 1); } };
    if (v === 2) {
      // the grille has dropped: the hole in the drywall, the galvanized housing, and the blower wheel inside
      rrect(X0 + 4, Y0 + 4, N - 8, N - 12, 2, '#b8b2a4');                                         // the cut edge of the ceiling
      pxRect(g, X0 + 8, Y0 + 8, N - 16, N - 20, '#8e949e'); pxRect(g, X0 + 8, Y0 + 8, N - 16, 4, '#aab0ba'); pxRect(g, X0 + 8, Y0 + 8, 4, N - 20, '#a2a8b2');   // housing walls
      pxRect(g, X0 + 14, Y0 + 14, N - 28, N - 32, '#4a4e56');                                    // its back, in shadow
      const cx = 120, cy = Y0 + 41; pxEllipse(g, cx, cy, 24, 24, '#2a2d33');
      for (let k = 0; k < 28; k++) { const a = spin + k / 28 * 6.28; pxLine(g, cx + Math.cos(a) * 15, cy + Math.sin(a) * 15, cx + Math.cos(a + .25) * 23, cy + Math.sin(a + .25) * 23, '#7a808a'); }   // the blower wheel's fins
      pxEllipse(g, cx, cy, 14, 14, '#3a3e46'); pxEllipse(g, cx, cy, 6, 6, '#6a707a'); pxEllipse(g, cx - 1, cy - 1, 2, 2, '#9aa0aa');
      pxRect(g, X0 + 14, cy - 2, 14, 4, '#6a707a'); pxRect(g, X0 + 66, Y0 + 16, 10, 7, '#5a5e68'); pxRect(g, X0 + 67, Y0 + 17, 8, 2, '#c8a030');   // motor bracket and the plug
      // the springs: one still holds the grille by a corner, the other dangles loose
      pxLine(g, X0 + 22, Y0 + 70, X0 + 18, Y0 + 92, '#c8ccd4', 1); pxLine(g, X0 + 26, Y0 + 70, X0 + 18, Y0 + 92, '#c8ccd4', 1);
      pxLine(g, X0 + 70, Y0 + 26, X0 + 74, Y0 + 40, '#c8ccd4', 1); pxLine(g, X0 + 74, Y0 + 26, X0 + 74, Y0 + 40, '#c8ccd4', 1);
      // the grille, hanging down toward you from that one clip, tipped and foreshortened, with a crack across it
      const q = [[X0 - 2, Y0 + 88], [X0 + 84, Y0 + 96], [X0 + 100, Y0 + 120], [X0 - 10, Y0 + 116]];
      fillPoly(g, q.map(([x, y]) => [x + 2, y + 3]), 'rgba(40,30,20,0.25)'); fillPoly(g, q, '#ecebe4');
      const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
      for (let k = .14; k < .9; k += .09) { const a = lerp(q[0], q[3], k), b = lerp(q[1], q[2], k); pxLine(g, a[0] + 6, a[1], b[0] - 6, b[1], '#9a968c'); pxLine(g, a[0] + 6, a[1] + 1, b[0] - 6, b[1] + 1, '#ffffff'); }
      strokePoly(g, q, '#b0aca2');
      pxLine(g, X0 + 30, Y0 + 92, X0 + 40, Y0 + 104, '#4a4640', 1); pxLine(g, X0 + 40, Y0 + 104, X0 + 36, Y0 + 112, '#4a4640', 1); pxLine(g, X0 + 40, Y0 + 104, X0 + 52, Y0 + 110, '#4a4640', 1);
    } else {
      pxRect(g, X0 + 3, Y0 + 3, N, N, 'rgba(60,50,40,0.18)');                                  // a soft shadow on the ceiling
      rrect(X0, Y0, N, N, 3, '#b4b0a6'); rrect(X0 + 1, Y0 + 1, N - 2, N - 2, 3, '#f4f3ee');      // the frame
      pxRect(g, X0 + 4, Y0 + 2, N - 8, 1, '#ffffff'); pxRect(g, X0 + 4, Y0 + N - 3, N - 8, 1, '#cfccc4');
      const L = X0 + 10, T = Y0 + 10, W = N - 20, H = N - 20;
      pxRect(g, L - 2, T - 2, W + 4, H + 4, '#d6d3ca'); pxRect(g, L, T, W, H, '#2a2826');       // a bevel down to the louver field, dark behind
      if (on) for (let k = 0; k < 6; k++) { const yy = T + ((k * 12 + t * 60) % H); pxRect(g, L, yy, W, 1, '#4a4844'); }   // the blower turning, glimpsed between slats
      for (let y = T + 1; y < T + H - 2; y += 5) { pxRect(g, L, y, W, 1, '#ffffff'); pxRect(g, L, y + 1, W, 1, '#e6e4dc'); pxRect(g, L, y + 2, W, 1, '#b6b2a8'); }   // angled louvers, lit edge first
      pxRect(g, L + W / 2 - 2, T, 4, H, '#e6e4dc'); pxRect(g, L + W / 2 - 2, T, 1, H, '#ffffff'); pxRect(g, L + W / 2 + 1, T, 1, H, '#b6b2a8');   // the center rib
      if (v === 1) { speckle(g, L, T, W, H, '#9a968c', 520, 5); speckle(g, L, T, W, H, '#7a766c', 200, 6); for (let y = T + 3; y < T + H; y += 5) speckle(g, L, y, W, 1, 'rgba(120,116,106,0.8)', 40, y); speckle(g, X0, Y0, N, 6, '#a8a49a', 60, 9); }   // furry with dust, caught on every slat
      if (v === 3) { speckle(g, X0, Y0 + N - 10, N, 10, '#2a3020', 50, 4); speckle(g, X0 + N - 8, Y0, 8, N, '#3a4a28', 30, 5); }
    }
    Z.vignette(g);
  },
  towelbar(g, v, fl, t) {
    Z.wall(g, 0, 0, ZW, ZH, Decor.zoomWall('bath', 'right'), 16);
    const fin = v === 1 ? '#a8acb4' : '#c9ccd4';
    pxEllipse(g, 36, 52, 9, 9, '#b9bcc4'); pxEllipse(g, 36, 52, 6, 6, fin); Z.screw(g, 36, 52);
    if (v === 2) {
      fillPoly(g, blobPts(200, 52, 13, 11, 4, .55, 12), '#e6e0cc'); fillPoly(g, blobPts(200, 53, 8, 7, 9, .5, 10), '#5a5040'); pxRect(g, 198, 50, 4, 7, '#f0ece0');
      pxLine(g, 40, 52, 182, 112, fin, 4); pxLine(g, 40, 51, 182, 111, '#ffffff'); pxEllipse(g, 186, 114, 8, 8, '#b9bcc4');
      speckle(g, 186, 64, 30, 50, '#e6e0cc', 26, 3);
    } else {
      pxRect(g, 40, 49, 156, 6, fin); pxRect(g, 40, 49, 156, 1, '#ffffff'); pxRect(g, 40, 54, 156, 1, '#8a8e98');
      pxEllipse(g, 204, 52, 9, 9, '#b9bcc4'); pxEllipse(g, 204, 52, 6, 6, fin); Z.screw(g, 204, 52);
      if (v === 1) { pxRect(g, 200, 61, 8, 1, '#8a8478'); speckle(g, 60, 49, 120, 6, '#9a9ea8', 60, 7); }
    }
    pxRect(g, 0, 122, ZW, 13, '#f2f0e6'); pxRect(g, 0, 122, ZW, 2, '#9fb6ad');
    Z.vignette(g);
  },
  dome(g, v, fl, t) {
    Z.popcorn(g);
    const lit = !ROOMS.bedroom.lightsOff && !(v === 3 && flickerDark(t, 30, 21, .75));
    if (v === 3) fillPoly(g, blobPts(120, 24, 58, 18, 31, .35, 20), 'rgba(110,70,30,0.5)');
    // a flush-mount dome, seen from below at a slight angle: a thin metal ring against the ceiling, a frosted
    // glass bowl hanging under it, and a little brass finial holding the glass on
    if (lit) { const gr = g.createRadialGradient(120, 50, 10, 120, 50, 110); gr.addColorStop(0, 'rgba(255,246,216,0.28)'); gr.addColorStop(1, 'rgba(255,246,216,0)'); g.fillStyle = gr; g.fillRect(0, 0, ZW, ZH); }
    pxEllipse(g, 120, 24, 57, 7, '#b4aea0'); pxEllipse(g, 120, 23, 56, 6, '#e4dfd4'); pxEllipse(g, 120, 22, 50, 4, '#f2eee6');   // the metal ring
    const glass = v === 1 ? (lit ? '#fff0c0' : '#e8dcb0') : (lit ? '#fffaee' : '#e6e2d8'), edge = lit ? '#e8dcc0' : '#c8c2b4';
    for (let y = 26; y < 84; y++) {                                   // the bowl, row by row: round at the bottom, a rim at the top
      const k = (y - 26) / 58, w = Math.round(55 * Math.sqrt(Math.max(0, 1 - k * k)));
      pxRect(g, 120 - w - 1, y, w * 2 + 2, 1, edge); pxRect(g, 120 - w, y, w * 2, 1, glass);
      pxRect(g, 120 - w, y, Math.max(1, Math.round(w * .18)), 1, mix(glass, edge, .6)); pxRect(g, 120 + w - Math.max(1, Math.round(w * .12)), y, Math.max(1, Math.round(w * .12)), 1, mix(glass, edge, .4));
    }
    for (const [yb, wb] of [[44, 47], [62, 37]]) for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI; pxRect(g, 120 + Math.cos(a) * wb, yb + Math.sin(a) * 4, 1, 1, mix(glass, edge, .5)); }   // frosted bands
    fillPoly(g, blobPts(100, 40, 14, 7, 3, .2, 12), lit ? '#ffffff' : '#f4f0e8');                                       // the shine
    pxRect(g, 116, 82, 8, 4, '#a8841c'); pxRect(g, 117, 82, 6, 3, '#d8b040'); pxRect(g, 118, 82, 2, 1, '#f8e080'); pxRect(g, 119, 86, 2, 2, '#a8841c');   // finial
    if (v === 1) { for (let i = 0; i < 9; i++) { const x = 98 + hash(i) * 44, y = 66 + hash(i + 3) * 10; pxRect(g, x, y, 3, 2, 'rgba(58,48,32,0.75)'); pxRect(g, x - 1, y - 1, 1, 1, 'rgba(90,80,64,0.7)'); } }   // dead bugs in the bottom of the glass
    if (v === 2) { pxCrack(g, 80, 40, .3, 60, '#8a8478', 13, 1); fillPoly(g, [[160, 50], [172, 46], [170, 60], [161, 62]], '#d0cabb'); pxLine(g, 160, 50, 161, 62, '#8a8478'); }
    Z.vignette(g);
  },
  bfloor(g, v, fl, t) {
    const cols = Decor.pal('bedroom').floor, seam = mix(cols[0], '#2a1408', .45);
    for (let y = 0, i = 0; y < ZH; y += 22, i++) { pxRect(g, 0, y, ZW, 22, cols[i % 4]); pxRect(g, 0, y, ZW, 1, seam); for (let x = (i * 57) % 120; x < ZW; x += 120) pxRect(g, x, y, 1, 22, seam);
      for (let k = 0; k < 6; k++) pxRect(g, (hash(i * 9 + k) * ZW) | 0, y + 4 + hash(i + k) * 14, 14 + hash(k) * 20, 1, mix(cols[i % 4], '#3a1a08', .15)); }
    Z.sunbeam(g, 140, 70, 2);
    if (v === 1) for (const [x, y] of [[60, 40], [180, 40], [60, 100], [180, 100]]) { pxEllipse(g, x, y, 4, 3, mix(cols[0], '#2a1408', .4)); pxRect(g, x - 2, y - 1, 4, 2, mix(cols[0], '#1a0800', .55)); }
    if (v === 2) for (let i = 0; i < 7; i++) { const x0 = 20 + i * 12, y0 = 20 + hash(i) * 20; pxLine(g, x0, y0, x0 + 150, y0 + 80 + hash(i + 4) * 12, '#f0d8b0'); pxLine(g, x0, y0 + 1, x0 + 150, y0 + 81 + hash(i + 4) * 12, mix(cols[0], '#1a0800', .5)); }
    if (v === 3) { fillPoly(g, blobPts(120, 70, 100, 50, 61, .3, 22), 'rgba(40,20,8,0.3)'); fillPoly(g, [[0, 62], [240, 56], [240, 66], [0, 72]], mix(cols[1], '#ffffff', .25)); pxLine(g, 0, 72, 240, 66, 'rgba(20,10,0,0.6)', 2); pxLine(g, 0, 62, 240, 56, '#f8d8b0'); }
    Z.vignette(g);
  },
  ucab(g, v, fl, t) {
    pxRect(g, 0, 0, ZW, ZH, '#3a2818'); pxRect(g, 16, 4, 208, 127, '#4a3420'); speckle(g, 16, 4, 208, 127, 'rgba(0,0,0,0.12)', 400, 3);
    pxRect(g, 0, 0, 16, ZH, '#a8743f'); pxRect(g, 224, 0, 16, ZH, '#a8743f');            // the cabinet sides
    pxRect(g, 16, 4, 208, 10, '#5a4028');                                               // top of the cabinet
    const sag = v === 2 ? 8 : 0;
    fillPoly(g, [[16, 66], [120, 66 + sag], [224, 66], [224, 74], [120, 74 + sag], [16, 74]], v === 1 ? '#d8c8a0' : '#e6dcc4');
    pxRect(g, 16, 120, 208, 11, '#e6dcc4');
    if (v === 1) for (const [x, y] of [[60, 66], [96, 66], [150, 120], [180, 120], [70, 120]]) { pxEllipse(g, x, y + 2, 9, 2, '#a88a5a'); pxEllipse(g, x, y + 2, 7, 1, '#d8c8a0'); }
    if (v === 2) { pxLine(g, 112, 66, 128, 74 + sag, '#5a3a1a', 2); pxLine(g, 118, 67 + sag, 124, 72 + sag, '#2a1a0a'); speckle(g, 100, 76, 40, 6, '#c8b08a', 16, 5); }
    if (v === 3) { stain(g, blobPts(130, 14, 70, 14, 31, .35, 20), 'rgba(110,70,30,0.6)', 'rgba(70,40,15,0.6)', 31); for (let i = 0; i < 4; i++) pxRect(g, 186 + i, 14 + i * 6, 2, 5, 'rgba(90,60,30,0.6)'); pxRect(g, 186, 40 + Z.dripY(t, 1.6, 20), 1, 2, '#9fd4f0'); }
    Z.item(g, Openables.hostOf('ucab'), 120, 118);
    Z.vignette(g);
  },
  lcab(g, v, fl, t) {
    pxRect(g, 0, 0, ZW, ZH, '#2a1c10'); pxRect(g, 20, 6, 200, 70, '#3a2818');               // back panel
    fillPoly(g, [[0, 135], [20, 76], [220, 76], [240, 135]], '#e6dfd0');                // cabinet floor, in perspective
    pxRect(g, 0, 0, 20, 135, '#a8743f'); pxRect(g, 220, 0, 20, 135, '#a8743f');
    if (v === 1) for (let i = 0; i < 14; i++) { const x = 30 + hash(i) * 170, y = 84 + hash(i + 3) * 44; pxLine(g, x, y, x + 10 + hash(i + 5) * 20, y + hash(i + 7) * 4 - 2, '#a89a80'); }
    if (v === 2) { for (let i = 0; i < 40; i++) { const x = 30 + hash(i) * 180, y = 82 + hash(i + 9) * 48; pxRect(g, x, y, 2, 1, '#1a120a'); }   // variant 2 is the hazard here (no damage variant)
      fillPoly(g, blobPts(186, 64, 12, 9, 11, .6, 12), '#0a0806'); speckle(g, 170, 50, 34, 26, '#c8a878', 30, 6); }
    Z.item(g, Openables.hostOf('lcab'), 120, 112);
    Z.vignette(g);
  },
  vanitycab(g, v, fl, t) {
    pxRect(g, 0, 0, ZW, ZH, '#2a2620'); pxRect(g, 20, 0, 200, 80, '#3a352c');
    fillPoly(g, [[0, 135], [20, 80], [220, 80], [240, 135]], v === 3 ? '#3a3428' : '#4a443a');
    pxRect(g, 0, 0, 20, ZH, '#e6e3d6'); pxRect(g, 220, 0, 20, ZH, '#e6e3d6');
    pxRect(g, 112, 0, 16, 40, '#e8e8e2'); pxRect(g, 112, 40, 60, 12, '#e8e8e2'); pxRect(g, 160, 40, 12, 40, '#e8e8e2'); pxRect(g, 106, 30, 28, 8, '#d0d0c8');   // drain and trap
    pxRect(g, 60, 10, 3, 60, '#c9ccd4'); pxRect(g, 180, 10, 3, 60, '#c9ccd4'); pxRect(g, 56, 62, 10, 6, '#b9bcc4'); pxRect(g, 176, 62, 10, 6, '#b9bcc4');
    if (v === 1) for (const [x, y] of [[70, 104], [150, 118], [100, 122]]) strokePoly(g, blobPts(x, y, 14, 4, x, .2, 14), 'rgba(220,210,180,0.5)');
    if (v === 2) { stain(g, blobPts(130, 112, 34, 9, 7, .4, 16), '#1a1612', '#0a0806', 7); pxLine(g, 100, 112, 160, 112, '#5a4a3a'); }
    if (v === 3) { fillPoly(g, blobPts(130, 112, 70, 14, 3, .3, 20), 'rgba(60,100,130,0.5)'); speckle(g, 30, 84, 180, 50, '#3a4a2a', 120, 6); pxRect(g, 128, 52 + Z.dripY(t, 1.2, 40), 1, 2, '#9fd4f0'); pxRect(g, 124, 50, 10, 3, '#a8b8c0'); }
    Z.item(g, Openables.hostOf('vanitycab'), 70, 118);
    Z.vignette(g);
  },
  closetin(g, v, fl, t) {
    Z.wall(g, 0, 0, ZW, ZH, mix(Decor.zoomWall('bedroom'), '#2a2630', .35), 22);
    pxRect(g, 0, 0, ZW, 8, '#c8c2b0');
    if (v !== 2) { pxRect(g, 0, 18, ZW, 6, '#e8e4dc'); for (let x = 4; x < ZW; x += 8) pxRect(g, x, 24, 1, 8, '#b8b2a2'); pxRect(g, 0, 40, ZW, 4, '#c8ccd4'); pxRect(g, 0, 40, ZW, 1, '#ffffff'); }
    else { pxRect(g, 0, 18, 120, 6, '#e8e4dc'); fillPoly(g, [[120, 18], [240, 34], [240, 40], [120, 24]], '#e8e4dc'); pxLine(g, 6, 40, 230, 126, '#c8ccd4', 3); fillPoly(g, blobPts(232, 40, 9, 8, 5, .6, 10), '#5a5040'); }
    if (v !== 2) for (let i = 0; i < 6; i++) { const x = 30 + i * 34; pxLine(g, x, 40, x - 12, 54, '#9aa0ab'); pxLine(g, x, 40, x + 12, 54, '#9aa0ab'); pxLine(g, x - 12, 54, x + 12, 54, '#9aa0ab'); }
    if (v === 1) for (let i = 0; i < 9; i++) { const x = 20 + i * 24, y = 66 + hash(i) * 10; pxLine(g, x, y, x + 14, y + 2, 'rgba(40,40,50,0.5)'); }
    if (v === 3) { for (let i = 0; i < 380; i++) { const x = 130 + hash(i) * 110, y = 50 + hash(i + 4) * 85; if (hash(i + 8) * 110 > x - 130 + 20) pxRect(g, x, y, hash(i + 2) > .7 ? 2 : 1, 1, i % 3 ? '#1e2418' : '#3a4a28'); } }
    pxRect(g, 0, 122, ZW, 13, '#2a2630');
    Z.item(g, Openables.hostOf('closetin'), 120, 126, 2);
    Z.vignette(g);
  }
};
function drawZoom(g, feat, v, fl, t) {
  g.save(); g.imageSmoothingEnabled = false;
  Z.cur = feat.id; CloseupExtras.spots[feat.id] = []; Z.tieRect = null;
  ZOOM_ART[feat.art](g, v, fl || {}, t || 0);
  CloseupExtras.draw(g, feat, v, fl || {}, t || 0);
  Decor.tint(g, ZW, ZH); Z.cur = null;
  g.restore();
}
