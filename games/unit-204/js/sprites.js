'use strict';
/* ============================== CHARACTERS ==============================
   Chunky, big-headed adventure-game people drawn with rectangles, then outlined. Everything is drawn facing
   right; the scene flips them to face left. Frames are cached.
   You: the inspector. Navy company polo, khakis, lanyard, Bluetooth earpiece, clipboard. It's 2008.
   Dana: the leasing assistant. Mustard cardigan over a striped top, skinny jeans, flats and a BlackBerry. */
const SPR_W = 30, SPR_H = 70;
const LOOKS = {
  you: { skin: '#f0c39b', skinD: '#cf9a72', hair: '#5a3a22', hairL: '#7a5232', top: '#2b3f73', topD: '#1e2c55', topL: '#3d5694', legs: '#b8a070', legsD: '#93804f', shoe: '#4a2f1e', eye: '#1a1420' },
  dana: { skin: '#b57e55', skinD: '#8f5f3e', hair: '#2e1b12', hairL: '#4a2c1c', top: '#d9a53a', topD: '#a97c22', topL: '#ecc160', legs: '#2c3a5c', legsD: '#1f2944', shoe: '#6d6d7a', eye: '#1a1420' }
};
function drawPerson(g, who, o) {
  // o: { step (-1..1 leg swing), bob, blink, talk, pose: 'idle'|'clip'|'phone'|'point', led }
  const L = LOOKS[who], R = (x, y, w, h, c) => pxRect(g, x, y + (o.bob || 0), w, h, c);
  const isDana = who === 'dana', s = o.step || 0;
  const top = isDana ? 27 : 25;           // shoulder line
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
  // back arm
  const armSwing = Math.round(-s * 2);
  R(6 + armSwing, top + 1, 4, 8, L.topD); R(6 + armSwing, top + 9, 3, 9, isDana ? L.topD : L.skinD); R(6 + armSwing, top + 18, 3, 2, L.skinD);
  // torso
  R(8, top, 14, hip - top, L.top); R(8, top, 3, hip - top, L.topD); R(19, top + 1, 3, hip - top - 1, L.topL);
  if (isDana) {
    R(12, top + 1, 6, hip - top - 2, '#e8f4f2'); for (let y = top + 2; y < hip - 1; y += 3) R(12, y, 6, 1, '#3fb3a6');
    R(11, top + 1, 1, hip - top - 2, L.topD); R(18, top + 1, 1, hip - top - 2, L.topD);
    R(11, top, 8, 1, L.skin); R(13, top + 1, 4, 1, L.skin);                         // neckline
    R(8, hip - 3, 14, 1, L.topD); pxRect(g, 13, hip + 1, 1, 1, '#c9a227');        // cardigan hem, belt buckle
  } else {
    R(12, top, 6, 2, L.topL); R(14, top + 2, 2, 4, L.topD); R(14, top + 2, 1, 3, '#d8dce8');   // polo collar + placket
    R(18, top + 4, 2, 2, '#f28c28');                                                         // company logo
    R(8, hip - 1, 14, 2, '#3a2416'); R(14, hip - 1, 2, 2, '#c9a227');                         // belt
    // lanyard + badge
    for (let i = 0; i < 8; i++) { R(11 + (i >> 2), top + 1 + i, 1, 1, '#c7362f'); R(18 - (i >> 2), top + 1 + i, 1, 1, '#c7362f'); }
    R(13, top + 9, 4, 5, '#f3f3f3'); R(13, top + 9, 4, 1, '#4a8fe0'); R(14, top + 11, 2, 2, '#c98b62');
  }
  // head
  const hy = isDana ? 6 : 4;
  R(10, hy + 16, 7, 3, L.skinD);                                   // neck
  R(8, hy, 16, 17, L.skin); R(8, hy, 3, 17, L.skinD);                // face + shaded back of head
  R(23, hy + 9, 1, 3, L.skin);                                       // nose
  R(10, hy + 8, 3, 4, L.skinD); R(11, hy + 9, 1, 2, L.skin);         // ear
  // eyes / brows / mouth
  if (o.blink) { R(16, hy + 9, 2, 1, L.eye); R(20, hy + 9, 2, 1, L.eye); }
  else { R(16, hy + 8, 2, 3, L.eye); R(20, hy + 8, 2, 3, L.eye); R(16, hy + 8, 1, 1, '#ffffff'); R(20, hy + 8, 1, 1, '#ffffff'); }
  R(15, hy + 6, 3, 1, L.hair); R(20, hy + 6, 3, 1, L.hair);
  if (o.talk) { R(18, hy + 13, 4, 2, '#5a1e1e'); R(18, hy + 13, 4, 1, L.skinD); } else R(18, hy + 13, 4, 1, L.skinD);
  // hair
  if (isDana) {
    R(7, hy - 2, 17, 5, L.hair); R(6, hy, 5, 22, L.hair); R(7, hy + 20, 7, 4, L.hair);   // long hair down the back
    R(12, hy + 3, 11, 2, L.hair); R(19, hy + 5, 5, 2, L.hair); R(22, hy + 6, 2, 2, L.hair); // side-swept bangs
    R(9, hy - 1, 8, 1, L.hairL); R(14, hy + 3, 5, 1, L.hairL);
    R(11, hy + 12, 1, 2, '#e8c34a');                                                           // earring
  } else {
    R(7, hy - 2, 17, 6, L.hair); R(7, hy + 2, 4, 9, L.hair); R(20, hy + 2, 4, 2, L.hair); R(16, hy + 2, 4, 1, L.hair);   // side part with a swoop
    R(9, hy - 1, 9, 1, L.hairL); R(12, hy - 2, 3, 1, L.hairL);
    R(9, hy + 11, 2, 3, '#c8ccd6'); R(10, hy + 12, 1, 1, o.led ? '#58b4ff' : '#2a4f80');        // Bluetooth earpiece
  }
  // front arm + held item
  if (o.pose === 'clip') {                                        // clipboard up, reading
    R(18, top + 1, 4, 7, L.top); R(19, top + 8, 4, 3, L.skin);
    R(15, top + 1, 9, 12, '#a8743f'); R(16, top + 2, 7, 10, '#fffdf4'); R(17, top, 5, 2, '#c0c4cc');
    for (let y = top + 4; y < top + 11; y += 2) R(17, y, 5, 1, '#9aa4c4');
    R(22, top + 6, 3, 3, L.skin);
  } else if (o.pose === 'phone') {                                 // BlackBerry up
    R(18, top + 1, 4, 8, L.top); R(19, top + 8, 4, 4, L.skin);
    R(19, top + 3, 5, 7, '#1d1f26'); R(20, top + 4, 3, 3, o.led ? '#9fe0ff' : '#5fa0c0'); R(20, top + 8, 3, 1, '#555a66');
  } else if (o.pose === 'point') {
    R(19, top + 1, 4, 5, L.top); R(22, top + 3, 6, 3, isDana ? L.top : L.skin); R(27, top + 3, 2, 2, L.skin);
  } else {
    const sw = Math.round(s * 2);
    R(19 + sw, top + 1, 4, 8, L.topL); R(20 + sw, top + 9, 3, 9, isDana ? L.top : L.skin); R(20 + sw, top + 18, 3, 2, L.skin);
    if (!isDana) { R(21 + sw, top + 12, 6, 9, '#a8743f'); R(22 + sw, top + 13, 4, 7, '#fffdf4'); R(22 + sw, top + 11, 4, 2, '#c0c4cc'); }
    else { R(20 + sw, top + 17, 3, 4, '#1d1f26'); }
  }
}
const Sprites = {
  cache: new Map(),
  get(who, o) {
    const key = who + JSON.stringify(o);
    let c = this.cache.get(key);
    if (!c) {
      c = document.createElement('canvas'); c.width = SPR_W; c.height = SPR_H;
      drawPerson(c.getContext('2d'), who, o); outline(c, '#120e18');
      if (this.cache.size > 300) this.cache.clear();
      this.cache.set(key, c);
    }
    return c;
  },
  portrait(canvas, who, talk) {                // dialogue portrait: the head, blown up
    const g = canvas.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#4a3f66'; g.fillRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = '#5a4d7a'; for (let y = 0; y < canvas.height; y += 4) g.fillRect(0, y, canvas.width, 1);
    const s = this.get(who, { talk, led: true });
    g.drawImage(s, 3, 0, 26, 30, 2, 2, 40, 46);
  }
};
