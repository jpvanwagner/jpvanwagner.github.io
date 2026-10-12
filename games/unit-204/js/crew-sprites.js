'use strict';
/* ============================== CREW SPRITES ==============================
   The workers at the warehouse and the jobsite, drawn the same way as you, Dana, and Pat (js/sprites.js): chunky,
   big-headed, built from rectangles on the same 48x70 frame with the same rounded face, the same two-segment arms
   (an upper arm and a forearm hinged at the elbow, so nothing stretches), scaled rectangle by rectangle, and outlined.
   On top of that: work clothes and PPE (a hard hat with a brim, clear safety glasses, earmuffs over the hat, a hi-vis
   vest with reflective tape, gloves, work boots), and what they're doing (hammering, sawing, shoveling, carrying a
   board, on the phone, smoking, kneeling). Everyone faces right; js/crew.js flips them. Frames are cached. */
const CREW_LOOKS = [
  { skin: '#f0c39b', skinD: '#cf9a72', hair: '#6a4422', hairD: '#4a2e16' },
  { skin: '#b57e55', skinD: '#8f5f3e', hair: '#1e140c', hairD: '#120a06' },
  { skin: '#8a5a3a', skinD: '#6a4028', hair: '#161010', hairD: '#0c0808' },
  { skin: '#e2b08a', skinD: '#c08a64', hair: '#b0a8a0', hairD: '#8a827a' },
  { skin: '#c88f62', skinD: '#a06c44', hair: '#3a2416', hairD: '#24160c' },
  { skin: '#f2c9a8', skinD: '#d4a07c', hair: '#c87a2a', hairD: '#9a5a1a' }
];
function drawWorker(g, o) {
  const L = CREW_LOOKS[o.look % CREW_LOOKS.length], R = (x, y, w, h, c) => pxRect(g, x, y + (o.bob || 0), w, h, c);
  const s = o.step || 0, br = o.breath ? 1 : 0, kneel = !!o.kneel, dy = kneel ? 9 : 0;
  const shirt = o.shirt || '#4a6a9a', shirtD = mix(shirt, '#000000', .25), shirtL = mix(shirt, '#ffffff', .18);
  const legs = o.pants || '#3a4a6a', legsD = mix(legs, '#000000', .25), boot = '#7a4e26', bootD = '#5a3618';
  const top = 25 - br + dy, hip = 44 + dy, foot = 65;
  /* ---------- legs and work boots (a stride when walking; one knee down when kneeling) ---------- */
  if (kneel) {
    R(13, hip, 11, 4, legs); R(20, hip, 4, foot - hip, legs); R(19, foot - 1, 8, 4, boot);                    // front leg: thigh out level, shin straight down, boot flat
    R(10, hip, 4, foot - 1 - hip, legsD); R(2, foot - 1, 9, 3, legsD); R(0, foot - 1, 3, 3, bootD);          // back leg: knee on the ground, shin back along it
  } else {
    for (let y = hip; y < foot; y++) { const t = (y - hip) / (foot - hip), off = Math.round(s * 3 * t); pxRect(g, 10 + off, y, 4, 1, legsD); pxRect(g, 15 - off, y, 4, 1, legs); }
    const fb = Math.round(s * 3), ff = -Math.round(s * 3);
    pxRect(g, 9 + fb, foot - 1, 7, 4, bootD); pxRect(g, 14 + ff, foot - 1, 8, 4, boot); pxRect(g, 14 + ff, foot + 2, 8, 1, '#3a2410');   // boots: tall, chunky, a dark sole
  }
  /* ---------- arms: the same two-segment arms as everyone else ---------- */
  const rad = d => d * Math.PI / 180, UP = 8, FORE = 8;
  const limb = (x0, y0, x1, y1, w, c) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0))); for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; R(Math.round(x - w / 2), Math.round(y - w / 2), w, w, c); } };
  const arm = (sx, sy, a1, a2, c) => { const ex = sx + UP * Math.cos(rad(a1)), ey = sy + UP * Math.sin(rad(a1)), wx = ex + FORE * Math.cos(rad(a2)), wy = ey + FORE * Math.sin(rad(a2)); limb(sx, sy, ex, ey, 4, c); limb(ex, ey, wx, wy, 3, c); return [wx, wy]; };
  const handC = o.gloves ? '#c8a050' : L.skin, handD = o.gloves ? '#a8843a' : L.skinD;
  const hand = (x, y, c = handC) => R(Math.round(x - 1.5), Math.round(y - 1.5), 3, 3, c);
  const SX = 20.5, SY = top + 3, BX = 9.5, BY = top + 3, act = o.act || 'idle', f = o.frame || 0;
  const tool = (x, y, ang, len, c, w = 1) => { for (let i = 0; i <= len; i++) R(Math.round(x + Math.cos(rad(ang)) * i), Math.round(y + Math.sin(rad(ang)) * i), w, w, c); return [x + Math.cos(rad(ang)) * len, y + Math.sin(rad(ang)) * len]; };
  // the back arm, behind the body
  { let a1 = 95 + s * 14, a2 = 99 + s * 14;
    if (act === 'saw') { a1 = 40 + (f % 2) * 6; a2 = 0; } else if (act === 'shovel') { a1 = f ? 50 : 30; a2 = f ? 10 : -30; } else if (act === 'carry') { a1 = -40; a2 = -110; } else if (act === 'hammer') { a1 = 70; a2 = 40; }
    const [wx, wy] = arm(BX, BY, a1, a2, shirtD); hand(wx, wy + 1, handD); }
  /* ---------- torso: a work shirt (or a T-shirt), and the hi-vis vest over it ---------- */
  R(9, top, 12, 1, shirt); R(8, top + 1, 14, hip - top - 1, shirt); R(8, top + 1, 3, hip - top - 1, shirtD); R(19, top + 1, 3, hip - top - 1, shirtL);
  if (o.flannel) for (let y = top + 2; y < hip - 1; y += 4) R(8, y, 14, 1, shirtD), R(12, top + 1, 1, hip - top - 2, shirtD);
  R(12, top, 6, 2, shirtL); R(14, top + 2, 2, 3, shirtD);                                                     // collar and placket
  if (o.vest !== false) {
    const V = '#f07a1a', VD = '#c85a0a', VL = '#ff9a40', T = '#ecebe0';
    if (o.vest === 'open') { R(8, top + 1, 4, hip - top - 2, V); R(18, top + 1, 4, hip - top - 2, VL); R(8, top + 1, 1, hip - top - 2, VD);
      for (const y of [top + 8, hip - 6]) { R(8, y, 4, 2, T); R(18, y, 4, 2, T); } }
    else { R(8, top + 1, 14, hip - top - 2, V); R(8, top + 1, 3, hip - top - 2, VD); R(19, top + 1, 3, hip - top - 2, VL); R(12, top, 6, 2, shirtL); R(15, top + 2, 1, hip - top - 4, VD);   // zipped, collar showing
      for (const y of [top + 8, hip - 6]) R(8, y, 14, 2, T); R(11, top + 1, 2, 7, T); R(17, top + 1, 2, 7, T); }   // reflective tape, around and up over the shoulders
  }
  R(8, hip - 1, 14, 2, '#2a2024'); R(14, hip - 1, 2, 2, '#9a8a5a');                                         // belt
  /* ---------- head: the same rounded face, ear, eyes, brows, and mouth ---------- */
  const hy = 4 - br + dy;
  R(11, hy + 15, 7, 4, L.skinD);
  const FACE = [[10, 12], [9, 14], [8, 16], [8, 16], [8, 16], [8, 16], [8, 16], [8, 16], [8, 16], [8, 16], [8, 16], [8, 16], [8, 16], [8, 16], [9, 15], [10, 13], [12, 9]];
  FACE.forEach(([x, w], i) => { R(x, hy + i, w, 1, L.skin); R(x, hy + i, Math.max(0, 11 - x), 1, L.skinD); });
  R(23, hy + 9, 1, 3, L.skin); R(23, hy + 11, 1, 1, L.skinD); R(10, hy + 8, 3, 4, L.skinD); R(11, hy + 9, 1, 2, L.skin);
  if (o.blink) { R(16, hy + 9, 2, 1, '#1a1420'); R(20, hy + 9, 2, 1, '#1a1420'); }
  else { R(16, hy + 8, 2, 3, '#1a1420'); R(20, hy + 8, 2, 3, '#1a1420'); R(16, hy + 8, 1, 1, '#ffffff'); R(20, hy + 8, 1, 1, '#ffffff'); }
  for (const bx of [15, 19]) { R(bx, hy + 7, 1, 1, L.hairD); R(bx + 1, hy + 6, 2, 1, L.hairD); }
  if (o.beard) { R(14, hy + 12, 10, 4, L.hair); R(13, hy + 14, 9, 2, L.hairD); R(18, hy + 13, 4, 1, L.skinD); } else R(18, hy + 14, 4, 1, L.skinD);
  /* ---------- hair, then the hard hat over it (dome, ridge, and a brim forward, or backward) ---------- */
  const hat = o.hat === false ? null : (o.hat === 'back' || !o.hat ? '#f4f4ee' : o.hat);
  if (!hat) { R(9, hy - 2, 12, 1, L.hair); R(7, hy - 1, 17, 4, L.hair); R(7, hy + 2, 4, 8, L.hair); R(20, hy + 2, 4, 2, L.hair); for (let x = 9; x < 23; x += 3) R(x, hy - 1, 1, 2, L.hairD); }
  else {
    R(7, hy + 2, 4, 7, L.hair); R(8, hy + 9, 2, 2, L.hairD);                                                 // hair showing at the back, under the hat
    const hD = mix(hat, '#000000', .2), hL = mix(hat, '#ffffff', .4);
    R(11, hy - 5, 9, 1, hat); R(9, hy - 4, 13, 1, hat); R(8, hy - 3, 15, 4, hat); R(8, hy - 1, 15, 2, hD);      // the dome
    R(14, hy - 5, 2, 5, hL); R(11, hy - 4, 2, 1, hL);                                                           // the center ridge and a shine
    if (o.hat === 'back') { R(3, hy + 1, 19, 2, hD); R(3, hy + 1, 6, 1, hat); } else { R(7, hy + 1, 19, 2, hD); R(19, hy + 1, 7, 1, hat); }   // the brim
  }
  /* ---------- safety glasses and earmuffs ---------- */
  if (o.glasses !== false) { R(15, hy + 7, 9, 1, '#3a3c48'); R(15, hy + 8, 9, 3, 'rgba(200,230,250,0.55)'); R(11, hy + 8, 4, 1, '#3a3c48'); R(16, hy + 8, 1, 1, '#ffffff'); }
  if (o.muffs) { R(9, hy + 6, 5, 7, '#f2c418'); R(9, hy + 6, 1, 7, '#c89a08'); R(10, hy + 7, 3, 5, '#e0b010'); R(10, hat ? hy - 3 : hy - 2, 2, 9, '#2a2c32'); }
  /* ---------- the front arm, by what they're doing ---------- */
  const sleeve = o.vest !== false && o.vest !== 'open' ? shirtL : shirtL;
  if (act === 'hammer') {                                        // hammer up, mid-swing, down on the nail
    const A = [[-60, -120], [-10, -40], [40, 30]][f % 3], [wx, wy] = arm(SX, SY, A[0], A[1], sleeve);
    const hd = A[1] + 90, [ex, ey] = tool(wx, wy, A[1], 6, '#8a5a2a'); tool(ex - Math.cos(rad(hd)) * 2, ey - Math.sin(rad(hd)) * 2, hd, 4, '#6a6e76', 2); hand(wx, wy);
  } else if (act === 'saw') {                                    // both hands forward on the saw, pushing it through the cut
    const [wx, wy] = arm(SX, SY, 30 + (f % 2) * 6, -5, sleeve); hand(wx, wy);
  } else if (act === 'shovel') {                                 // the shovel across the body: dig, then lift
    const A = f ? [40, -20] : [70, 50], [wx, wy] = arm(SX, SY, A[0], A[1], sleeve);
    const ang = f ? 30 : 70, [bx, by] = tool(wx - Math.cos(rad(ang)) * 10, wy - Math.sin(rad(ang)) * 10, ang, 22, '#8a6a3a'); R(Math.round(bx) - 2, Math.round(by) - 1, 5, 4, '#7a7e86'); hand(wx, wy);
  } else if (act === 'reach') {                                  // working at arm's length
    const [wx, wy] = arm(SX, SY, 4 + (f % 2) * 4, 0, sleeve); hand(wx, wy); R(Math.round(wx + 1), Math.round(wy - 2), 2, 1, handC);
  } else if (act === 'phone') {                                  // a phone held up in front, thumbing through it (the way Dana holds her BlackBerry)
    const [wx, wy] = arm(SX, SY, 78, -62, sleeve), px = Math.round(wx - 2), py = Math.round(wy - 7);
    R(px, py, 5, 8, '#1d1f26'); R(px + 1, py + 1, 3, 3, '#bfe6ff'); hand(wx, wy); R(Math.round(wx + 1), Math.round(wy - 3), 1, 2, handC);
  } else if (act === 'smoke') {                                  // a cigarette, between drags
    const A = f ? [100, -60] : [90, 60], [wx, wy] = arm(SX, SY, A[0], A[1], sleeve); hand(wx, wy); R(Math.round(wx + 1), Math.round(wy - 1), 3, 1, '#f4f2ea'); R(Math.round(wx + 4), Math.round(wy - 1), 1, 1, '#ff6a2a');
  } else if (act === 'carry') {                                  // a 2x4 up on the shoulder
    const [wx, wy] = arm(SX, SY, -30, -100, sleeve); for (let x = 0; x < 34; x++) R(x - 4, top - 2 - Math.round(x * .06), 1, 2, x % 9 ? '#d8b484' : '#c8a070'); hand(wx, wy);
  } else {                                                       // at the side, swinging when walking
    const a = 85 - s * 14, [wx, wy] = arm(SX, SY, a, a - 4, sleeve); hand(wx, wy + 1);
  }
}
const CrewSprites = {
  cache: new Map(),
  get(o, k = 1) {
    k = Math.round(k * 20) / 20;
    const key = k + JSON.stringify(o);
    let c = this.cache.get(key);
    if (!c) {
      c = document.createElement('canvas'); c.width = Math.round(SPR_W * k); c.height = Math.round(SPR_H * k);
      drawWorker(scaledCtx(c.getContext('2d'), k), o); outline(c, '#120e18');
      if (this.cache.size > 900) this.cache.clear();
      this.cache.set(key, c);
    }
    return c;
  }
};
