'use strict';
/* ============================== HELPERS ============================== */
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const list = a => a.length < 3 ? a.join(' and ') : a.slice(0, -1).join(', ') + ', and ' + a[a.length - 1];   // ['a','b','c'] -> 'a, b, and c' (Oxford comma, always)
const lower = s => s.split(' ').map(w => w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w) ? w : w.toLowerCase()).join(' ');   // 'TV Wall' -> 'TV wall'
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function store(key, val) {           // localStorage can throw (private mode, blocked iframes): never let it break the game
  try { if (val === undefined) return JSON.parse(localStorage.getItem(key)); localStorage.setItem(key, JSON.stringify(val)); } catch (e) { return null; }
}

/* ---------- one-point perspective ----------
   Rooms are simple boxes seen from the front. World units are feet-ish: x across, y up, z into the screen. */
const CAM = { f: 300, cx: SW / 2, hy: 92, eye: 2.2 };
function P(x, y, z) { return [CAM.cx + CAM.f * x / z, CAM.hy - CAM.f * (y - CAM.eye) / z]; }
function floorAt(sx, sy) {          // screen point -> spot on the floor (null above the horizon)
  if (sy <= CAM.hy + 2) return null;
  const z = CAM.f * CAM.eye / (sy - CAM.hy);
  return { x: (sx - CAM.cx) * z / CAM.f, z };
}
function poly(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); }
function fillPoly(g, pts, style) { poly(g, pts); g.fillStyle = style; g.fill(); }
function strokePoly(g, pts, style, w = 1) { poly(g, pts); g.strokeStyle = style; g.lineWidth = w; g.stroke(); }
function growPoly(pts, d) {                                       // push every corner d pixels out from the middle
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  return pts.map(([x, y]) => [x + Math.sign(Math.round(x - cx)) * d, y + Math.sign(Math.round(y - cy)) * d]);
}
function inPoly(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function polyBox(pts) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
// Quads on the room's surfaces. Each takes the room box r = { x0, x1, h, zb }.
const Q = {
  back: (r, xa, xb, ya, yb) => [P(xa, ya, r.zb), P(xb, ya, r.zb), P(xb, yb, r.zb), P(xa, yb, r.zb)],
  left: (r, za, zb, ya, yb) => [P(r.x0, ya, za), P(r.x0, ya, zb), P(r.x0, yb, zb), P(r.x0, yb, za)],
  right: (r, za, zb, ya, yb) => [P(r.x1, ya, za), P(r.x1, ya, zb), P(r.x1, yb, zb), P(r.x1, yb, za)],
  floor: (xa, xb, za, zb) => [P(xa, 0, za), P(xb, 0, za), P(xb, 0, zb), P(xa, 0, zb)],
  ceil: (r, xa, xb, za, zb) => [P(xa, r.h, za), P(xb, r.h, za), P(xb, r.h, zb), P(xa, r.h, zb)]
};

/* ---------- shading ----------
   dither(hex, level) is a plain translucent shade (level 0..16 = 0..100%), used for most light and shadow.
   ditherPx() is real ordered dithering (a 4x4 Bayer pattern), kept as a light accent only:
   characters' shadows. With dithering off in Settings, ditherPx falls back too. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const _pats = new Map();
const _patCtx = document.createElement('canvas').getContext('2d');
function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgba(hex, a) { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; }
/* a soft pool of light: bright in the middle, fading to nothing, with no hard edge (an oval when ry != rx) */
function softGlow(g, x, y, rx, ry, hex, a) {
  g.save(); g.translate(x, y); g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  gr.addColorStop(0, rgba(hex, a)); gr.addColorStop(.45, rgba(hex, a * .55)); gr.addColorStop(1, rgba(hex, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
}
function dither(hex, level) { return rgba(hex, clamp(level, 0, 16) / 16); }
function ditherPx(hex, level) {      // level 0..16
  level = clamp(Math.round(level), 0, 16);
  if (!Settings.get('dither')) return rgba(hex, level / 16);
  if (level >= 16) return hex;
  const key = hex + level;
  let p = _pats.get(key);
  if (!p) {
    const c = document.createElement('canvas'); c.width = c.height = 4;
    const g = c.getContext('2d'); g.fillStyle = hex;
    for (let i = 0; i < 16; i++) if (BAYER[i] < level) g.fillRect(i % 4, i >> 2, 1, 1);
    p = _patCtx.createPattern(c, 'repeat'); _pats.set(key, p);
  }
  return p;
}
function clearDitherCache() { _pats.clear(); }

/* ---------- crisp pixel shapes (no anti-aliasing) ---------- */
function pxRect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function pxEllipse(g, cx, cy, rx, ry, c) {
  g.fillStyle = c;
  for (let dy = -ry; dy <= ry; dy++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ry + .5) * (ry + .5)))));
    g.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1);
  }
}
function pxLine(g, x0, y0, x1, y1, c, w = 1) {
  g.fillStyle = c; x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) {
    g.fillRect(x0, y0, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
function pxCrack(g, x, y, ang, len, c, seed, depth = 0) {   // branching crack
  let px = x, py = y;
  for (let i = 0; i < len; i += 3) {
    const a = ang + (hash(seed + i) - .5) * .9;
    const nx = px + Math.cos(a) * 3, ny = py + Math.sin(a) * 3;
    pxLine(g, px, py, nx, ny, c); px = nx; py = ny;
    if (depth < 2 && hash(seed * 3 + i) > .82) pxCrack(g, px, py, a + (hash(seed + i * 7) > .5 ? .8 : -.8), len * .45, c, seed + i * 13, depth + 1);
  }
}
function speckle(g, x, y, w, h, c, n, seed) { g.fillStyle = c; for (let i = 0; i < n; i++) g.fillRect(Math.floor(x + hash(seed + i) * w), Math.floor(y + hash(seed + i + 99) * h), 1, 1); }

/* ---------- organic shapes: damage shouldn't look like perfect circles and boxes ---------- */
function blobPts(cx, cy, rx, ry, seed, rough = .35, n = 18) {
  const o = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, k = 1 - rough / 2 + rough * (hash(seed + i * 1.7) * .7 + hash(seed + ((i + 1) % n) * 1.7) * .3);
    o.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return o;
}
function floorBlob(cx, cz, rx, rz, seed, rough = .35, n = 18) {   // a blob lying on the floor, in world units
  return blobPts(cx, cz, rx, rz, seed, rough, n).map(([x, z]) => P(x, 0, z));
}
function stain(g, pts, outer, inner, seed) {                    // a soaked-in stain: darker core, ragged edge
  const b = polyBox(pts), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  fillPoly(g, pts, outer);
  if (inner) fillPoly(g, pts.map(([x, y], i) => { const k = .5 + hash(seed + i) * .18; return [cx + (x - cx) * k + 1, cy + (y - cy) * k]; }), inner);
}
/* foliage: a clump of little two-tone leaves, lit from the top left, instead of a round blob */
/* a spray of leaves: twigs fanning out from the branch, each carrying pointed leaves on both sides, so the clump
   has a ragged, leafy outline instead of a round one. cols: [mid, light, dark, (accent)] */
function foliage(g, cx, cy, rx, ry, cols, seed, sway = 0) {
  const dark = cols[2 % cols.length], L = Math.max(2, Math.min(6, Math.round(rx / 4))), twigs = 4 + Math.round(hash(seed) * 3) + Math.floor(rx / 9);
  const bx = cx - sway * .3, by = cy + ry * .55;                       // where the spray leaves the branch
  const leaf = (x, y, a, len, c) => {                                   // a pointed leaf: wide at the base, a single pixel at the tip
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
    pxLine(g, x, y, x + (ex - x) * .6, y + (ey - y) * .6, c, 2); pxRect(g, ex, ey, 1, 1, c);
  };
  for (const layer of [0, 1]) for (let i = 0; i < twigs; i++) {
    const spread = (i / (twigs - 1) - .5) * 2.4 + (hash(seed + i * 3) - .5) * .5, a = -Math.PI / 2 + spread;
    const len = Math.min(rx, ry * 1.4) * (.75 + hash(seed + i * 5) * .45), bend = sway * (.6 + hash(seed + i) * .6);
    const ex = bx + Math.cos(a) * len * (rx / Math.max(1, ry)) * .7 + bend, ey = by + Math.sin(a) * len;
    if (layer) pxLine(g, bx, by, ex, ey, '#5a3f2a');
    const n = Math.max(3, Math.round(len / (L * .8)));
    for (let k = 1; k <= n; k++) {
      const f = k / n, x = bx + (ex - bx) * f, y = by + (ey - by) * f;
      for (const side of [-1, 1]) {
        const h = hash(seed + i * 11 + k * 3 + side); if (h < .12) continue;
        const la = a + side * (.75 + h * .5) + .25, ll = L * (.7 + hash(seed + k + i + side * 5) * .5);
        if (!layer) { leaf(x + 1, y + 1, la, ll + 1, dark); continue; }   // a darker layer behind gives the clump depth
        const up = Math.sin(la) < -.2, c = up && h > .45 ? cols[1 % cols.length] : (h > .9 && cols[3]) ? cols[3] : cols[0];
        leaf(x, y, la, ll, c);
      }
    }
    if (layer) leaf(ex, ey, a, L, cols[1 % cols.length]);              // a leaf at the tip of every twig
  }
}
/* a light that stutters now and then (not constantly): returns true while it is dark during a short burst */
function flickerDark(t, period, seed, chance = 1) {
  if (!Settings.get('motion')) return false;
  const k = Math.floor(t / period); if (hash(k * 3.1 + seed) > chance) return false;
  const d = t - k * period - hash(k * 7.3 + seed) * (period - 1.5);
  if (d < 0 || d > .6) return false;                         // a short stutter, not a strobe
  return Math.floor(d * 12 + hash(k + seed) * 3) % 4 === 0;  // mostly lit even then: a blink or two
}

/* ---------- hand lettering: marker writing, scrawled but readable ----------
   Each letter is a few strokes on a 4x6 grid. Every corner wobbles a little, the letters bob along the line and
   drift uphill, the way a kid writes on a wall. Only the letters the game needs are here. */
const HAND = {
  W: [[[0, 0], [1, 6], [2, 2.5], [3, 6], [4, 0]]],
  Y: [[[0, 0], [2, 3]], [[4, 0], [2, 3], [2, 6]]],
  H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
  P: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]]],
  U: [[[0, 0], [0, 5], [1, 6], [3, 6], [4, 5], [4, 0]]],
  V: [[[0, 0], [2, 6], [4, 0]]],
  5: [[[4, 0], [0, 0], [0, 3], [3, 3], [4, 4], [4, 5], [3, 6], [0, 6]]],
  '!': [[[2, 0], [2, 4]], [[2, 5.6], [2, 6]]],
  A: [[[0, 6], [2, 0], [4, 6]], [[1, 3.6], [3, 3.6]]],
  B: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]], [[3, 3], [4, 4], [4, 5], [3, 6], [0, 6]]],
  C: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5]]],
  D: [[[0, 0], [0, 6], [3, 6], [4, 4.5], [4, 1.5], [3, 0], [0, 0]]],
  E: [[[4, 0], [0, 0], [0, 6], [4, 6]], [[0, 3], [3, 3]]],
  F: [[[4, 0], [0, 0], [0, 6]], [[0, 3], [3, 3]]],
  G: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 3.4], [2.2, 3.4]]],
  I: [[[1, 0], [3, 0]], [[2, 0], [2, 6]], [[1, 6], [3, 6]]],
  K: [[[0, 0], [0, 6]], [[4, 0], [0, 3.6]], [[1.4, 2.6], [4, 6]]],
  L: [[[0, 0], [0, 6], [4, 6]]],
  M: [[[0, 6], [0, 0], [2, 3.2], [4, 0], [4, 6]]],
  N: [[[0, 6], [0, 0], [4, 6], [4, 0]]],
  O: [[[1, 0], [3, 0], [4, 1.2], [4, 4.8], [3, 6], [1, 6], [0, 4.8], [0, 1.2], [1, 0]]],
  R: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]], [[2, 3], [4, 6]]],
  S: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 2], [1, 3], [3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]],
  T: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]],
  ':': [[[2, 1.6], [2, 2.2]], [[2, 4.6], [2, 5.2]]]
};
function scribble(g, text, x, y, k, color, w = 1, seed = 1, rise = .35, gap = 5.4) {
  let cx = x;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i].toUpperCase(), st = HAND[ch];
    if (!st) { cx += 3 * k; continue; }
    const by = y - i * rise * k + Math.sin(i * 1.3 + seed) * .7 * k, sk = (hash(seed + i * 3.1) - .5) * .25, sc = 1 + (hash(seed + i * 5.7) - .5) * .22;
    const J = (px, py, j) => [cx + (px + (6 - py) * sk) * k * sc + (hash(seed + i * 9 + j) - .5) * .7 * k, by + py * k * sc + (hash(seed + i * 7 + j + 50) - .5) * .7 * k];
    let j = 0;
    for (const line of st) { for (let n = 0; n < line.length - 1; n++) { const a = J(...line[n], j++), b = J(...line[n + 1], j); pxLine(g, a[0], a[1], b[0], b[1], color, w); } j += 3; }
    cx += (gap + (hash(seed + i) - .5) * .6) * k;
  }
}
