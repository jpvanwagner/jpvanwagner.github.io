'use strict';
/* ============================== HELPERS ============================== */
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
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
   ditherPx() is real ordered dithering (a 4x4 Bayer pattern, '90s style), kept as a light accent only:
   characters' shadows. With dithering off in Settings, ditherPx falls back too. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const _pats = new Map();
const _patCtx = document.createElement('canvas').getContext('2d');
function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgba(hex, a) { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; }
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
