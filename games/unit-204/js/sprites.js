'use strict';
/* ============================== CHARACTERS ==============================
   Chunky, big-headed adventure-game people drawn with rectangles, then outlined. Everything is drawn facing
   right; the scene flips them to face left. Frames are cached.
   You: the inspector. Navy company polo, khakis, lanyard and a clipboard. It's 2008.
   Dana: the leasing assistant. Mustard cardigan over a striped top, skinny jeans, flats and a BlackBerry. */
const SPR_W = 48, SPR_H = 70, SPR_OX = 9;   // wide enough for an arm pointing straight out; the body sits in the middle (drawn at x 8..24, shifted by SPR_OX)
const LOOKS = {
  you: { skin: '#f0c39b', skinD: '#cf9a72', hair: '#5a3a22', hairL: '#7a5232', hairD: '#3e2716', top: '#2b3f73', topD: '#1e2c55', topL: '#3d5694', legs: '#b8a070', legsD: '#93804f', shoe: '#4a2f1e', eye: '#1a1420' },
  mgr: { skin: '#e2b08a', skinD: '#c08a64', hair: '#9a9aa2', hairL: '#c4c4cc', hairD: '#76767e', top: '#6a2f45', topD: '#4a1f30', topL: '#86405a', legs: '#34343e', legsD: '#26262e', shoe: '#1e1e24', eye: '#1a1420' },
  dana: { skin: '#b57e55', skinD: '#8f5f3e', hair: '#2e1b12', hairL: '#5a3622', hairD: '#1e110a', top: '#d9a53a', topD: '#a97c22', topL: '#ecc160', legs: '#2c3a5c', legsD: '#1f2944', shoe: '#6d6d7a', eye: '#1a1420' }
};
function drawPerson(g, who, o) {
  // o: { step (-1..1 leg swing), bob, breath (idle: shoulders and head up a pixel), blink, talk, pose: 'clip'|'phone'|'point'|'pointUp' }
  const L = LOOKS[who], R = (x, y, w, h, c) => pxRect(g, x, y + (o.bob || 0), w, h, c);
  const isDana = who === 'dana', s = o.step || 0, br = o.breath ? 1 : 0;
  const top = (isDana ? 27 : 25) - br;    // shoulder line (rises a pixel on the in-breath)
  const hip = isDana ? 45 : 44, foot = 65;
  // legs (slanted when walking)
  for (let y = hip; y < foot; y++) {
    const t = (y - hip) / (foot - hip), off = Math.round(s * 3 * t);
    pxRect(g, 10 + off, y, 4, 1, L.legsD);           // back leg
    pxRect(g, 15 - off, y, 4, 1, L.legs);            // front leg
    if (!isDana && y < hip + 3) pxRect(g, 13, y, 2, 1, L.legs);
  }
  const fb = Math.round(s * 3), ff = -Math.round(s * 3);
  pxRect(g, 9 + fb, foot, 6, 3, isDana ? '#55555f' : '#3a2416'); pxRect(g, 14 + ff, foot, 7, 3, L.shoe);
  if (isDana) { pxRect(g, 15 + ff, foot, 5, 1, L.skin); }
  /* arms: every arm is the same two segments, an 8px upper arm and an 8px forearm, hinged at the elbow and
     hung from the shoulder, with the hand drawn at the wrist. Poses only change the two angles (90 is straight
     down, 0 is straight forward, -90 is straight up), so an arm can't stretch, shrink, or lose its hand. */
  const UP = 8, FORE = 8, rad = d => d * Math.PI / 180, longSleeves = isDana || who === 'mgr';
  const limb = (x0, y0, x1, y1, w, c) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0))); for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; R(Math.round(x - w / 2), Math.round(y - w / 2), w, w, c); } };
  const arm = (sx, sy, a1, a2, sleeve, skin) => {
    const ex = sx + UP * Math.cos(rad(a1)), ey = sy + UP * Math.sin(rad(a1)), wx = ex + FORE * Math.cos(rad(a2)), wy = ey + FORE * Math.sin(rad(a2));
    if (longSleeves) { limb(sx, sy, ex, ey, 4, sleeve); limb(ex, ey, wx, wy, 3, sleeve); }
    else { const mx = sx + (ex - sx) * .6, my = sy + (ey - sy) * .6; limb(mx, my, ex, ey, 3, skin); limb(ex, ey, wx, wy, 3, skin); limb(sx, sy, mx, my, 4, sleeve); }   // polo: short sleeve
    return [wx, wy];
  };
  const hand = (x, y, c = L.skin) => R(Math.round(x - 1.5), Math.round(y - 1.5), 3, 3, c);
  // back arm, behind the body, swinging against the front one
  { const a = 90 + s * 14, [wx, wy] = arm(9.5, top + 3, a, a + 4, L.topD, L.skinD); hand(wx, wy + 1, L.skinD); }
  // torso
  R(9, top, 12, 1, L.top); R(8, top + 1, 14, hip - top - 1, L.top); R(8, top + 1, 3, hip - top - 1, L.topD); R(19, top + 1, 3, hip - top - 1, L.topL);   // shoulders slope in at the top row
  R(8, hip - 5, 1, 5, L.topD);
  if (isDana) {
    R(12, top + 1, 6, hip - top - 2, '#e8f4f2'); for (let y = top + 2; y < hip - 1; y += 3) R(12, y, 6, 1, '#3fb3a6');
    R(11, top + 1, 1, hip - top - 2, L.topD); R(18, top + 1, 1, hip - top - 2, L.topD);
    R(11, top, 8, 1, L.skin); R(13, top + 1, 4, 1, L.skin);                         // neckline
    R(8, hip - 3, 14, 1, L.topD); pxRect(g, 13, hip + 1, 1, 1, '#c9a227');        // cardigan hem, belt buckle
  } else if (who === 'mgr') {                                                                 // blazer over a pale blouse
    R(12, top, 6, hip - top - 2, '#ece6da'); R(11, top, 2, 9, L.topL); R(17, top, 2, 9, L.topL); R(13, top + 9, 4, 1, L.topD);
    R(8, hip - 1, 14, 2, L.topD); R(18, top + 5, 2, 1, '#c9a227');                             // pin on the lapel
  } else {
    R(12, top, 6, 2, L.topL); R(14, top + 2, 2, 4, L.topD); R(14, top + 2, 1, 3, '#d8dce8');   // polo collar + placket
    R(18, top + 4, 2, 2, '#f28c28');                                                         // company logo
    R(8, hip - 1, 14, 2, '#3a2416'); R(14, hip - 1, 2, 2, '#c9a227');                         // belt
    // lanyard + badge
    for (let i = 0; i < 8; i++) { R(11 + (i >> 2), top + 1 + i, 1, 1, '#c7362f'); R(18 - (i >> 2), top + 1 + i, 1, 1, '#c7362f'); }
    R(13, top + 9, 4, 5, '#f3f3f3'); R(13, top + 9, 4, 1, '#4a8fe0'); R(14, top + 11, 2, 2, '#c98b62');
  }
  // a hi-vis vest over the polo, once you've put one on at a site's PPE rack (js/ppe.js)
  const ppe = o.ppe || '';
  if (ppe.includes('vest')) { const V = '#d4f03a', VD = '#a8c020', T = '#ecebe0'; R(8, top + 1, 4, hip - top - 2, V); R(18, top + 1, 4, hip - top - 2, V); R(8, top + 1, 1, hip - top - 2, VD); for (const y of [top + 8, hip - 6]) { R(8, y, 4, 2, T); R(18, y, 4, 2, T); } }
  // head: a rounded skull and jaw (rows narrow at the crown and the chin), not a box
  const hy = (isDana ? 6 : 4) - br;
  R(11, hy + 15, 7, 4, L.skinD);                                    // neck
  const FACE = [[10, 12], [9, 14], [8, 16], [8, 16], [8, 16], [8, 16], [8, 16], [8, 16], [8, 16], [8, 16], [8, 16], [8, 16], [8, 16], [8, 16], [9, 15], [10, 13], [12, 9]];
  FACE.forEach(([x, w], i) => { R(x, hy + i, w, 1, L.skin); R(x, hy + i, Math.max(0, 11 - x), 1, L.skinD); });   // face, with the back of the head shaded
  R(23, hy + 9, 1, 3, L.skin); R(23, hy + 11, 1, 1, L.skinD);        // nose
  R(10, hy + 8, 3, 4, L.skinD); R(11, hy + 9, 1, 2, L.skin);         // ear
  // eyes, brows, mouth
  const down = o.pose === 'clip' || o.pose === 'phone';            // reading: eyes drop to what's in hand
  if (o.blink) { R(16, hy + 9, 2, 1, L.eye); R(20, hy + 9, 2, 1, L.eye); }
  else if (down) { R(16, hy + 9, 2, 2, L.eye); R(20, hy + 9, 2, 2, L.eye); R(17, hy + 10, 1, 1, '#ffffff'); R(21, hy + 10, 1, 1, '#ffffff'); R(16, hy + 8, 2, 1, L.skinD); R(20, hy + 8, 2, 1, L.skinD); }
  else { R(16, hy + 8, 2, 3, L.eye); R(20, hy + 8, 2, 3, L.eye); R(16, hy + 8, 1, 1, '#ffffff'); R(20, hy + 8, 1, 1, '#ffffff'); }
  const brow = L.hairD;                                              // thin, arched brows: low at the ends, a pixel higher in the middle
  if (isDana) { R(15, hy + 7, 1, 1, brow); R(16, hy + 6, 2, 1, brow); R(20, hy + 6, 2, 1, brow); R(22, hy + 7, 1, 1, brow); }   // hers arch the same way on both sides, outer tips down
  else for (const bx of [15, 19]) { R(bx, hy + 7, 1, 1, brow); R(bx + 1, hy + 6, 2, 1, brow); }
  if (o.talk) { R(18, hy + 14, 4, 2, '#5a1e1e'); R(18, hy + 14, 4, 1, L.skinD); } else { R(18, hy + 14, 4, 1, L.skinD); R(21, hy + 13, 1, 1, L.skinD); }   // mouths sit a pixel lower
  // hair, with strands: a darker shade between locks and a lighter one where the light catches
  const strands = (x0, x1, y0, y1, step, seed) => { for (let x = x0; x < x1; x += step) { const len = 1 + ((x * 7 + seed) % 3); R(x, y0 + ((x + seed) % 2), 1, Math.min(y1 - y0, len + 1), L.hairD); } };
  if (isDana) {
    R(9, hy - 2, 12, 1, L.hair); R(7, hy - 1, 17, 4, L.hair); R(6, hy + 1, 5, 21, L.hair); R(7, hy + 20, 7, 4, L.hair);   // long hair down the back
    R(7, hy + 3, 6, 5, L.hair); R(12, hy + 3, 12, 1, L.hair); R(12, hy + 4, 12, 1, L.hair);   // the crown down to the ear, and side-swept bangs, clear of the brows
    strands(9, 22, hy - 1, hy + 3, 3, 1); for (let y = hy + 4; y < hy + 22; y += 4) R(7 + (y % 3), y, 1, 3, L.hairD);   // locks down the back
    R(10, hy - 1, 6, 1, L.hairL); R(14, hy + 3, 4, 1, L.hairL); R(8, hy + 6, 1, 6, L.hairL);
    R(11, hy + 12, 1, 2, '#e8c34a');                                                           // earring
  } else if (who === 'mgr') {
    R(10, hy - 2, 11, 1, L.hair); R(8, hy - 1, 15, 3, L.hair); R(7, hy + 1, 4, 9, L.hair); R(21, hy + 1, 2, 1, L.hair);   // short silver hair, combed back
    strands(9, 22, hy - 1, hy + 2, 2, 3); R(10, hy - 2, 7, 1, L.hairL); R(8, hy + 3, 1, 5, L.hairL);
    // glasses: dark frames round both eyes, a bridge, an arm back to the ear, and a glint on the lenses
    const F = '#3a2c3c', lens = '#e4f0f6';
    R(14, hy + 6, 10, 6, L.skin);                                                                        // clear the default eyes and brows first
    for (const gx of [14, 19]) {
      R(gx, hy + 7, 4, 1, F); R(gx, hy + 11, 4, 1, F); R(gx, hy + 7, 1, 5, F); R(gx + 3, hy + 7, 1, 5, F);   // the frame
      R(gx + 1, hy + 8, 2, 3, lens);                                                                     // clear lens
      if (o.blink) R(gx + 1, hy + 9, 2, 1, L.eye); else { R(gx + 2, hy + (down ? 9 : 8), 1, 2, L.eye); R(gx + 1, hy + 8, 1, 1, '#ffffff'); }   // the eye behind it, and a glint
      R(gx, hy + 5, 1, 1, L.hairD); R(gx + 1, hy + 4, 2, 1, L.hairD);                                    // brows above the frames
    }
    R(18, hy + 8, 1, 1, F); R(11, hy + 8, 3, 1, F);                                                     // the bridge, a pixel between the lenses, and the arm back to the ear
  } else {
    R(9, hy - 2, 12, 1, L.hair); R(7, hy - 1, 17, 4, L.hair); R(7, hy + 2, 4, 8, L.hair); R(20, hy + 2, 4, 2, L.hair); R(16, hy + 2, 4, 1, L.hair);   // side part with a swoop
    strands(9, 23, hy - 1, hy + 3, 3, 0); R(14, hy - 2, 1, 4, L.hairD);                      // the part
    R(9, hy - 1, 4, 1, L.hairL); R(16, hy - 1, 5, 1, L.hairL); R(21, hy + 2, 2, 1, L.hairL);
  }
  // the rest of your PPE: safety glasses, earmuffs, and a hard hat over the hair
  if (ppe.includes('glasses')) { R(15, hy + 7, 9, 1, '#3a3c48'); R(15, hy + 8, 9, 3, 'rgba(200,230,250,0.5)'); R(11, hy + 8, 4, 1, '#3a3c48'); R(16, hy + 8, 1, 1, '#ffffff'); }
  if (ppe.includes('hardhat')) { const H = '#f4f4ee', HD = '#d0d0c8'; R(11, hy - 5, 9, 1, H); R(9, hy - 4, 13, 1, H); R(8, hy - 3, 15, 4, H); R(8, hy - 1, 15, 2, HD); R(14, hy - 5, 2, 5, '#ffffff'); R(7, hy + 1, 19, 2, HD); R(19, hy + 1, 7, 1, H); R(16, hy - 2, 3, 2, '#f28c28'); }   // the company sticker
  if (ppe.includes('ears')) { R(9, hy + 6, 5, 7, '#f2c418'); R(9, hy + 6, 1, 7, '#c89a08'); R(10, hy - 3, 2, 9, '#2a2c32'); }
  // front arm + held item
  const board = (x, y, wood = '#a8743f', paper = '#fffdf4', h = 10) => {   // clipboard (or the manager's folder): board, paper, a clip, a few lines
    x = Math.round(x); y = Math.round(y);
    R(x, y, 6, h, wood); R(x + 1, y + 1, 4, h - 2, paper); R(x + 1, y - 1, 4, 2, '#c0c4cc');
    for (let yy = y + 3; yy < y + h - 1; yy += 2) R(x + 1, yy, 3, 1, '#9aa4c4');
  };
  /* the clipboard held down in front at the waist, tipped back toward the holder (a three-quarter view, so the
     paper shows): bottom edge in the hand, top leaning in toward the chest */
  const heldBoard = (bx, by, wood = '#a8743f', paper = '#fffdf4') => {
    bx = Math.round(bx); by = Math.round(by);
    for (let j = 0; j < 10; j++) { const x = bx - Math.round((9 - j) * .3); R(x, by + j, 5, 1, wood); if (j > 0 && j < 9) R(x + 1, by + j, 3, 1, j % 2 ? paper : '#c8d0e4'); }
    R(bx - 2, by - 1, 3, 2, '#c0c4cc');                                                        // the clip
  };
  const SX = 20.5, SY = top + 3, sleeveC = L.topL;                 // front shoulder
  const wood = who === 'mgr' ? '#c8a050' : '#a8743f', paper = who === 'mgr' ? '#e8d8a8' : '#fffdf4';   // the manager carries a manila folder
  if (o.pose === 'clip') {                                        // a glance: elbow at the side, forearm up, clipboard tipped up to read
    const [wx, wy] = arm(SX, SY, 92, -52, sleeveC, L.skin);                  // elbow down at the side, forearm up and forward
    const bx = Math.round(wx - 6), by = Math.round(wy - 9);
    R(bx, by, 8, 11, wood); R(bx + 1, by + 1, 6, 9, paper); R(bx + 2, by - 1, 4, 2, '#c0c4cc');                 // the board, tipped up to read: wide enough to be a clipboard
    for (let yy = by + 3; yy < by + 9; yy += 2) R(bx + 2, yy, 4 - ((yy >> 1) % 2), 1, '#9aa4c4');
    hand(bx + 1, by + 9, L.skinD); R(bx - 1, by + 9, 2, 2, longSleeves ? L.topD : L.skinD);                  // the far hand, holding the bottom corner from behind
    hand(wx, wy);                                                                                             // the near hand on the right edge
  } else if (o.pose === 'phone') {                                 // BlackBerry held up in front of her, thumb on the keys
    const [wx, wy] = arm(SX, SY, 78, -62, sleeveC, L.skin), px = Math.round(wx - 2), py = Math.round(wy - 7);
    R(px, py, 5, 8, '#1d1f26'); R(px + 1, py + 1, 3, 3, '#bfe6ff'); R(px + 1, py + 1, 3, 1, '#7fb8e0');
    R(px + 1, py + 5, 1, 1, '#8a8f9c'); R(px + 3, py + 5, 1, 1, '#8a8f9c'); R(px + 2, py + 6, 1, 1, '#8a8f9c');
    hand(wx, wy); R(Math.round(wx + 1), Math.round(wy - 3), 1, 2, L.skin);            // thumb up on the keys
  } else if (o.pose === 'point') {                                 // arm straight out, index finger pointing
    const [wx, wy] = arm(SX, SY, 8, 0, sleeveC, L.skin); hand(wx, wy); R(Math.round(wx + 1.5), Math.round(wy - 1.5), 3, 1, L.skin); R(Math.round(wx - 1.5), Math.round(wy + 1.5), 2, 1, L.skinD);
  } else if (o.pose === 'pointUp') {                               // arm raised up and forward, index finger pointing up at an angle, thumb showing
    const [wx, wy] = arm(SX, SY, -40, -60, sleeveC, L.skin), hx = Math.round(wx), hy2 = Math.round(wy);
    hand(wx, wy); for (let i = 1; i <= 3; i++) R(hx + i, hy2 - 1 - i, 1, 1, L.skin);    // the index finger, on the diagonal
    R(hx - 2, hy2 - 2, 1, 2, L.skin); R(hx - 1, hy2 + 1, 2, 1, L.skinD);               // thumb, curled fingers
  } else if (isDana) {                                            // arm at her side, swinging when she walks
    const a = 90 - s * 14, [wx, wy] = arm(SX, SY, a, a - 4, sleeveC, L.skin); hand(wx, wy + 1);
  } else if (o.walk) {                                            // walking: the clipboard tucked under the arm, against the side, the hand cupping its bottom
    board(18, top + 5, wood, paper, 12);                          // pinned against the ribs, sticking out a little in front
    const [wx, wy] = arm(SX, SY, 88 - s * 5, 55 - s * 5, sleeveC, L.skin); hand(wx, wy); R(Math.round(wx - 1.5), Math.round(wy - 2.5), 2, 1, L.skin);   // fingers hooked over its front edge
  } else {                                                        // standing: held down in front at the waist, tipped back toward the holder
    const [wx, wy] = arm(SX, SY, 80, 58, sleeveC, L.skin);
    heldBoard(wx - 2, wy - 10, wood, paper); hand(wx, wy); R(Math.round(wx - 1), Math.round(wy - 2.5), 2, 1, L.skin);   // fingers over the bottom edge
  }
}
/* Scale-true drawing: instead of drawing a 30x70 person and stretching the picture (which turns a 2px eye into
   1px on one side of the face and 2px on the other), every rectangle is scaled on its own. Small features
   (2 or 3px) keep a whole-pixel size, so both eyes always match; bigger shapes snap their edges, so
   neighbours still meet without gaps. */
function scaledCtx(g, k) {
  const ax = (x, w) => { const p = Math.round(x * k), d = Math.round((x + w) * k) - p; return [p, w === 1 ? Math.max(1, d) : w <= 3 ? Math.round(w * k) : d]; };
  return {
    set fillStyle(c) { g.fillStyle = c; }, get fillStyle() { return g.fillStyle; },
    fillRect(x, y, w, h) { const [px, pw] = ax(x + SPR_OX, w), [py, ph] = ax(y, h); g.fillRect(px, py, pw, ph); }
  };
}
const Sprites = {
  cache: new Map(),
  get(who, o, k = 1) {
    k = Math.round(k * 20) / 20;                                    // a handful of sizes, each cached
    const key = who + k + JSON.stringify(o);
    let c = this.cache.get(key);
    if (!c) {
      c = document.createElement('canvas'); c.width = Math.round(SPR_W * k); c.height = Math.round(SPR_H * k);
      drawPerson(scaledCtx(c.getContext('2d'), k), who, o); outline(c, '#120e18');
      if (this.cache.size > 600) this.cache.clear();
      this.cache.set(key, c);
    }
    return c;
  },
  portrait(canvas, who, talk) {                // dialogue portrait: the head, blown up
    const g = canvas.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#4a3f66'; g.fillRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = '#5a4d7a'; for (let y = 0; y < canvas.height; y += 4) g.fillRect(0, y, canvas.width, 1);
    const k = 1.25, s = this.get(who, { talk }, k);                  // drawn at portrait size, not stretched: head, neck, and shoulders to the bottom of the frame
    g.drawImage(s, Math.round((1 + SPR_OX) * k), Math.round(1 * k), 40, 40, 0, 0, 40, 40);
  }
};
