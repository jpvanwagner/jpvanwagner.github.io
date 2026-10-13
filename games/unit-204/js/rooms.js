'use strict';
/* ============================== ROOMS ==============================
   Each room is a box seen in one-point perspective (see P() in util.js): back wall, two side walls, floor and
   ceiling, with fixtures built from projected boxes and quads. The still parts are drawn once into a cached
   layer whose window glass is cut out; each frame the sky and tree go behind it, and the light, dust, fan and
   flicker go on top. Every feature in a room also shows its condition in the room view: the stain you see
   from the doorway is the one you'll find in the close-up. */
const cond = id => Game.cond[id];
const flags = id => Game.flags[id] || {};
function hull(pts) {                               // convex hull (monotone chain) of projected points
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const boxPts = (x0, x1, y0, y1, z0, z1) => { const o = []; for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) o.push(P(x, y, z)); return o; };
function box3(g, x0, x1, y0, y1, z0, z1, c) {      // c = { front, top, side, bottom }
  if (x0 > 0 && c.side) fillPoly(g, [P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)], c.side);
  if (x1 < 0 && c.side) fillPoly(g, [P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0)], c.side);
  if (y1 < CAM.eye && c.top) fillPoly(g, [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], c.top);
  if (y0 > CAM.eye && c.bottom) fillPoly(g, [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], c.bottom);
  fillPoly(g, [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)], c.front);
}
/* a small flat drawing (a sign, a label) laid onto a side-wall-facing surface in perspective: src's left column
   sits at z = zl and its right column at z = zr, on the plane x, between heights y0 and y1 (one source column at a
   time, so the lettering foreshortens with the face it's on, the same as the close-up shows it) */
function decalX(g, src, x, zl, zr, y0, y1) {
  const W = src.width; g.save(); g.imageSmoothingEnabled = false;
  for (let i = 0; i < W; i++) { const za = zl + (zr - zl) * i / W, zb = zl + (zr - zl) * (i + 1) / W, a = P(x, y1, za), b = P(x, y0, za), c = P(x, y1, zb);
    const dx = Math.round(Math.min(a[0], c[0])), w = Math.max(1, Math.round(Math.abs(c[0] - a[0]))); g.drawImage(src, i, 0, 1, src.height, dx, Math.round(a[1]), w, Math.max(1, Math.round(b[1] - a[1]))); }
  g.restore();
}
/* lit EXIT signs: a room's art records each one as it draws (ExitGlow.add), and the glow goes on after the room's
   darkness, so a sign still shines with the lights off. a is how bright (a flickering, half-dead one is dimmer). */
const ExitGlow = {
  cur: null, list: {},
  add(x, y, a = 1) { if (this.cur) (this.list[this.cur] = this.list[this.cur] || []).push({ x, y, a }); },
  draw(g, id) {
    const L = this.list[id]; if (!L) return;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const s of L) { softGlow(g, s.x, s.y, 26, 14, '#ff3a2a', .2 * s.a); softGlow(g, s.x, s.y, 11, 5, '#ffd8cc', .22 * s.a); softGlow(g, s.x, s.y + 16, 30, 10, '#ff3a2a', .07 * s.a); }   // the halo, the face, and red on the wall under it
    g.restore();
  }
};
/* a sign drawn once into its own little canvas (cached by key) for decalX */
const _decals = {};
function decal(key, w, h, draw) { if (!_decals[key]) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); _decals[key] = c; } return _decals[key]; }

/* one outline around several shapes together (a forklift's body, its mast, and a raised load; a person's head and
   arms): the shapes are filled into a little mask, its outer edge traced (Moore neighborhood), and the trace simplified,
   so a hotspot hugs something that isn't convex instead of stretching a hull over the gaps. Cached by shape. */
const _outlines = new Map();
function unionOutline(polys) {
  polys = polys.filter(p => p && p.length > 2);
  const key = polys.map(p => p.map(q => Math.round(q[0]) + ',' + Math.round(q[1])).join(';')).join('|');
  if (_outlines.has(key)) return _outlines.get(key);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of polys) for (const [x, y] of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const ox = Math.floor(x0) - 2, oy = Math.floor(y0) - 2, W = Math.ceil(x1) - ox + 3, H = Math.ceil(y1) - oy + 3;
  const c = unionOutline.c || (unionOutline.c = document.createElement('canvas')); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#000';
  for (const p of polys) { g.beginPath(); p.forEach(([x, y], i) => i ? g.lineTo(x - ox, y - oy) : g.moveTo(x - ox, y - oy)); g.closePath(); g.fill(); }
  const d = g.getImageData(0, 0, W, H).data, on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 127;
  let sx = -1, sy = -1; for (let y = 0; y < H && sx < 0; y++) for (let x = 0; x < W; x++) if (on(x, y)) { sx = x; sy = y; break; }
  if (sx < 0) return polys[0];
  const D = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]], trace = [[sx, sy]];
  let cx = sx, cy = sy, bx = sx - 1, by = sy;
  for (let guard = 0; guard < 40000; guard++) {
    let i0 = D.findIndex(([dx, dy]) => cx + dx === bx && cy + dy === by), moved = false;
    for (let k = 1; k <= 8; k++) { const [dx, dy] = D[(i0 + k) % 8]; if (on(cx + dx, cy + dy)) { const [px, py] = D[(i0 + k - 1) % 8]; bx = cx + px; by = cy + py; cx += dx; cy += dy; moved = true; break; } }
    if (!moved || (cx === sx && cy === sy)) break;
    trace.push([cx, cy]);
  }
  // simplify (Ramer-Douglas-Peucker) and put it back in screen space, on pixel centers
  const rdp = (pts, eps) => { if (pts.length < 3) return pts; const [a, b] = [pts[0], pts[pts.length - 1]]; let best = 0, bi = 0;
    for (let i = 1; i < pts.length - 1; i++) { const [x, y] = pts[i], dd = Math.abs((b[1] - a[1]) * x - (b[0] - a[0]) * y + b[0] * a[1] - b[1] * a[0]) / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1); if (dd > best) { best = dd; bi = i; } }
    return best > eps ? [...rdp(pts.slice(0, bi + 1), eps).slice(0, -1), ...rdp(pts.slice(bi), eps)] : [a, b]; };
  const half = Math.floor(trace.length / 2), out = [...rdp(trace.slice(0, half + 1), 1.1).slice(0, -1), ...rdp(trace.slice(half).concat([trace[0]]), 1.1).slice(0, -1)].map(([x, y]) => [x + ox + .5, y + oy + .5]);
  if (_outlines.size > 400) _outlines.clear(); _outlines.set(key, out); return out;
}
function floorEllipse(cx, cz, rx, rz, n = 20) { const o = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; o.push(P(cx + Math.cos(a) * rx, 0, cz + Math.sin(a) * rz)); } return o; }
function clipDo(g, pts, fn) { g.save(); poly(g, pts); g.clip(); fn(); g.restore(); }
function speckPoly(g, pts, color, density, seed) { const b = polyBox(pts); clipDo(g, pts, () => speckle(g, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, color, (b.x1 - b.x0) * (b.y1 - b.y0) * density, seed)); }
function lineW(g, a, b, c) { pxLine(g, a[0], a[1], b[0], b[1], c); }
function cutOut(g, pts) { g.save(); g.globalCompositeOperation = 'destination-out'; fillPoly(g, pts, '#000'); g.restore(); }

/* ---------- shared pieces ---------- */
function shell(g, r) {
  // a room can paint its own shell instead (an outdoor area: sky, ground, fences), then its fixtures go on top as usual
  if (r.shell) { r.shell(g, r); r.walls && r.walls(g, r); Anomalies.draw(g, r); Decor.drawExtras(g, r); return; }
  const { x0, x1, h, zb } = r.box, zn = 1.6, p = Decor.pal(r.id), sh = Decor.time.shadow;
  fillPoly(g, [P(x0, h, zn), P(x1, h, zn), P(x1, h, zb), P(x0, h, zb)], p.ceil);
  fillPoly(g, [P(x0, h, zb - 1.2), P(x1, h, zb - 1.2), P(x1, h, zb), P(x0, h, zb)], p.ceilBand);
  speckPoly(g, [P(x0, h, zn), P(x1, h, zn), P(x1, h, zb), P(x0, h, zb)], 'rgba(0,0,0,0.05)', .2, 41);
  const fl = [P(x0, 0, zn), P(x1, 0, zn), P(x1, 0, zb), P(x0, 0, zb)];
  fillPoly(g, fl, r.floorBase(p)); clipDo(g, fl, () => r.floor(g, r, p));
  fillPoly(g, Q.floor(x0, x1, zb - .45, zb), rgba(sh, .14));                       // contact shadow along the back wall
  const L = [P(x0, 0, zn), P(x0, 0, zb), P(x0, h, zb), P(x0, h, zn)], R = [P(x1, 0, zn), P(x1, 0, zb), P(x1, h, zb), P(x1, h, zn)], B = Q.back(r.box, x0, x1, 0, h);
  fillPoly(g, L, p.wallL); fillPoly(g, R, p.wallR); fillPoly(g, B, p.back);
  for (const [pts, s] of [[L, 5], [R, 6], [B, 7]]) { speckPoly(g, pts, 'rgba(0,0,0,0.04)', .2, s); speckPoly(g, pts, 'rgba(255,255,255,0.05)', .16, s + 20); }
  // flat, hue-shifted shading bands toward the ceiling and into the corners (pixel-art style, no dithering)
  for (const [x, c] of [[x0, p.wallL], [x1, p.wallR]]) {
    fillPoly(g, [P(x, h - .55, zn), P(x, h - .55, zb), P(x, h, zb), P(x, h, zn)], p.band1(c));
    fillPoly(g, [P(x, h - .2, zn), P(x, h - .2, zb), P(x, h, zb), P(x, h, zn)], p.band2(c));
  }
  fillPoly(g, Q.back(r.box, x0, x1, h - .4, h), p.band1(p.back)); fillPoly(g, Q.back(r.box, x0, x1, h - .14, h), p.band2(p.back));
  fillPoly(g, Q.back(r.box, x0, x0 + .22, 0, h), p.band1(p.back)); fillPoly(g, Q.back(r.box, x1 - .22, x1, 0, h), p.band1(p.back));
  // baseboards
  const bb = '#f4f1e8';
  fillPoly(g, Q.back(r.box, x0, x1, 0, .3), bb); fillPoly(g, Q.left(r.box, zn, zb, 0, .3), '#e4dfd2'); fillPoly(g, Q.right(r.box, zn, zb, 0, .3), '#e8e3d6');
  lineW(g, P(x0, .3, zb), P(x1, .3, zb), '#bdb6a4'); lineW(g, P(x0, .3, 3), P(x0, .3, zb), '#bdb6a4'); lineW(g, P(x1, .3, 3), P(x1, .3, zb), '#bdb6a4');
  // corners
  lineW(g, P(x0, 0, zb), P(x0, h, zb), 'rgba(40,30,40,0.35)'); lineW(g, P(x1, 0, zb), P(x1, h, zb), 'rgba(40,30,40,0.35)');
  lineW(g, P(x0, h, zb), P(x1, h, zb), 'rgba(40,30,40,0.25)');
  r.walls && r.walls(g, r);
  if (r.id === 'living') Openables.drawRug(g);
  Anomalies.draw(g, r);
  Decor.drawExtras(g, r);
}
function carpetFloor(g, r, p) {
  const f = p.floor;
  for (let i = 0; i < 7; i++) { const cx = (hash(i + 3) - .5) * 10, cz = 4 + hash(i + 8) * 8, rx = 1 + hash(i) * 1.6, rz = .6 + hash(i + 1) * .8; for (const k of [1, .82, .64, .46]) fillPoly(g, floorBlob(cx, cz, rx * k, rz * k, i * 7 + 3, .3, 18), rgba(i % 2 ? f.lt : f.dk, .1)); }   // tonal patches, feathered so there's no hard oval
  speckle(g, 0, CAM.hy, SW, SH - CAM.hy, f.dk, 4200, 11); speckle(g, 0, CAM.hy, SW, SH - CAM.hy, f.lt, 3000, 12);
}
function boardsFloor(g, r, p) {
  const { x0, x1, zb } = r.box, cols = p.floor, seam = mix(cols[0], '#2a1408', .45);
  for (let i = 0, x = x0; x < x1; x += .55, i++) {
    fillPoly(g, [P(x, 0, 1.6), P(x + .55, 0, 1.6), P(x + .55, 0, zb), P(x, 0, zb)], cols[i % 4]);
    lineW(g, P(x, 0, 2.2), P(x, 0, zb), seam);
    for (let z = 2 + hash(i) * 3; z < zb; z += 2.6 + hash(i + z) * 2) lineW(g, P(x, 0, z), P(x + .55, 0, z), seam);
    for (let z = 2.5 + hash(i + 5) * 2; z < zb; z += 1.7 + hash(i * z) * 1.5) lineW(g, P(x + .12 + hash(z) * .3, 0, z), P(x + .14 + hash(z) * .3, 0, z + .5), mix(cols[i % 4], '#3a1a08', .18));   // grain
    speckPoly(g, [P(x, 0, 1.6), P(x + .55, 0, 1.6), P(x + .55, 0, zb), P(x, 0, zb)], 'rgba(60,30,10,0.12)', .3, i);
  }
}
function tileFloor(size) {
  return (g, r, p) => {
    const { x0, x1, zb } = r.box, [a, b, g0] = p.floor;
    // every tile floor gets grout lines; a palette without its own grout color gets a soft dark one from the darker tile
    const grout = g0 || rgba(mix(b, '#2a1a10', .55), .45);
    for (let z = zb; z > 1.8; z -= size) for (let x = x0, i = 0; x < x1; x += size, i++) {
      const pts = [P(x, 0, z - size), P(x + size, 0, z - size), P(x + size, 0, z), P(x, 0, z)];
      fillPoly(g, pts, (Math.round(x / size) + Math.round(z / size)) % 2 ? a : b);
      if (grout) strokePoly(g, pts, grout, 1);
    }
  };
}
function doorOnSide(g, r, side, za, zb2, inside, label) {
  const q = side === 'left' ? Q.left : Q.right, x = side === 'left' ? r.box.x0 : r.box.x1;
  const op = q(r.box, za, zb2, 0, 2.9);
  fillPoly(g, op, inside);
  // a glimpse of the next room: floor strip + light falloff
  fillPoly(g, q(r.box, za, zb2, 0, .5), dither('#000000', 4));
  fillPoly(g, q(r.box, za, za + (zb2 - za) * .5, 0, 2.9), dither('#000000', 3));
  const tr = '#f6f3ea';
  fillPoly(g, q(r.box, za - .15, za, 0, 3.05), tr); fillPoly(g, q(r.box, zb2, zb2 + .15, 0, 3.05), tr); fillPoly(g, q(r.box, za - .15, zb2 + .15, 2.9, 3.05), tr);
  lineW(g, P(x, 0, za), P(x, 2.9, za), '#bdb6a4'); lineW(g, P(x, 0, zb2), P(x, 2.9, zb2), '#bdb6a4');
}
function sixPanelDoor(g, r, xa, xb, ajar) {
  const zb = r.box.zb, w = xb - xa;
  fillPoly(g, Q.back(r.box, xa - .14, xb + .14, 0, 3.05), '#f6f3ea');
  if (ajar) {                                      // open a crack: the leaf swings into the room on its left hinges, the dark room shows past its edge
    fillPoly(g, Q.back(r.box, xa, xb, 0, 2.9), '#2a2630'); fillPoly(g, Q.back(r.box, xb - .5, xb, 0, 2.9), '#3a3540');
    const th = .32, ex = xa + w * Math.cos(th), ez = zb - w * Math.sin(th), leaf = [P(xa, 0, zb), P(ex, 0, ez), P(ex, 2.9, ez), P(xa, 2.9, zb)];
    fillPoly(g, leaf, '#ece7da'); strokePoly(g, leaf, 'rgba(120,110,95,0.5)');
    for (let c = 0; c < 2; c++) for (const [ya, yb] of [[.25, 1.25], [1.45, 2.2], [2.35, 2.75]]) {   // panels, foreshortened with the leaf
      const a = .12 + c * .44, b = a + .32, pt = (k, y) => P(xa + w * k * Math.cos(th), y, zb - w * k * Math.sin(th));
      fillPoly(g, [pt(a, ya), pt(b, ya), pt(b, yb), pt(a, yb)], '#e0dacb'); lineW(g, pt(a, yb), pt(b, yb), '#c8c1b0');
    }
    const e0 = P(ex, 0, ez), e1 = P(ex, 2.9, ez); pxLine(g, e0[0], e0[1], e1[0], e1[1], '#cfc8b6', 2);   // the leaf's edge, catching the light
    const k = P(xa + (w - .18) * Math.cos(th), 1.2, zb - (w - .18) * Math.sin(th)); pxRect(g, k[0] - 1, k[1] - 1, 3, 3, '#c9a227'); pxRect(g, k[0] - 1, k[1] - 1, 1, 1, '#f2d870');
    return;
  }
  fillPoly(g, Q.back(r.box, xa, xb, 0, 2.9), '#ece7da');
  for (let c = 0; c < 2; c++) for (const [ya, yb] of [[.25, 1.25], [1.45, 2.2], [2.35, 2.75]]) {
    const pa = xa + w * (.12 + c * .44), pb = pa + w * .32;
    fillPoly(g, Q.back(r.box, pa, pb, ya, yb), '#e0dacb'); lineW(g, P(pa, yb, zb), P(pb, yb, zb), '#c8c1b0'); lineW(g, P(pa, ya, zb), P(pa, yb, zb), '#c8c1b0');
  }
  const k = P(xb - .18, 1.2, zb); pxRect(g, k[0] - 1, k[1] - 1, 3, 3, '#c9a227'); pxRect(g, k[0] - 1, k[1] - 1, 1, 1, '#f2d870');
}
function windowBack(g, r, xa, xb, ya, yb, opts = {}) {
  const tr = '#f8f6ef';
  fillPoly(g, Q.back(r.box, xa - .14, xb + .14, ya - .14, yb + .12), tr);
  if (opts.sill) { const zb = r.box.zb; box3(g, xa - .25, xb + .25, ya - .2, ya - .12, zb - .22, zb, { front: '#ffffff', top: '#e8e4d8', side: '#e0dccf' }); }
  cutOut(g, Q.back(r.box, xa, xb, ya, yb));
  if (opts.mullion) { const ym = (ya + yb) / 2; fillPoly(g, Q.back(r.box, xa, xb, ym - .05, ym + .05), tr); }
}
function toggleIn(g, q, on) {                     // a rocker inside a switch plate: lit side up when it's on
  const c = polyBox(q), h = Math.max(3, Math.round((c.y1 - c.y0) * .5));
  pxRect(g, c.cx - 1, c.cy - h / 2, 2, h, '#d8cfb6'); pxRect(g, c.cx - 1, on ? c.cy - h / 2 : c.cy, 2, Math.ceil(h / 2), '#ffffff');
}
function lightSwitch(g, r, x, y, on = true) { const q = Q.back(r.box, x, x + .18, y, y + .3); fillPoly(g, q, '#f2ecdc'); strokePoly(g, q, '#a8a08c'); toggleIn(g, q, on); }
function sideSwitch(g, r, side, za, zb2, ya, yb, on = true) { const q = (side === 'left' ? Q.left : Q.right)(r.box, za, zb2, ya, yb); fillPoly(g, q, '#f2ecdc'); strokePoly(g, q, '#a8a08c'); toggleIn(g, q, on); }
function ring(cx, y, cz, rx, rz, n = 20) { const o = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; o.push(P(cx + Math.cos(a) * rx, y, cz + Math.sin(a) * rz)); } return o; }
function cobweb(g, x, y, dx, dy, seed) {         // a little web tucked into a corner
  for (let i = 0; i < 4; i++) { const a = i / 3 * Math.PI / 2; pxLine(g, x, y, x + Math.cos(a) * 9 * dx, y + Math.sin(a) * 7 * dy, 'rgba(240,240,240,0.35)'); }
  for (const k of [.45, .8]) for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI / 2, b = (i + 1) / 3 * Math.PI / 2; pxLine(g, x + Math.cos(a) * 9 * dx * k, y + Math.sin(a) * 7 * dy * k, x + Math.cos(b) * 9 * dx * k, y + Math.sin(b) * 7 * dy * k, 'rgba(240,240,240,0.25)'); }
}
function floorVent(g, xa, xb, za, zb2) { fillPoly(g, Q.floor(xa, xb, za, zb2), '#c8c4b8'); for (let z = za + .05; z < zb2; z += .08) lineW(g, P(xa + .04, 0, z), P(xb - .04, 0, z), '#6e6a60'); }
function scuffs(g, r, seed) {                       // faint scuffs above the baseboard on the back wall
  for (let i = 0; i < 4; i++) { const x = r.box.x0 + 1 + hash(seed + i) * (r.box.x1 - r.box.x0 - 2), y = .34 + hash(seed + i + 9) * .25, a = P(x, y, r.box.zb), b = P(x + .15 + hash(i) * .25, y + (hash(i + 3) - .5) * .05, r.box.zb); pxLine(g, a[0], a[1], b[0], b[1], 'rgba(60,50,40,0.18)'); }
}
function outletBack(g, r, x, y) { const q = Q.back(r.box, x, x + .16, y, y + .24); fillPoly(g, q, '#f2ecdc'); strokePoly(g, q, '#a8a08c'); }

/* ---------- outside: sky, buildings, and a swaying oak, seen through every window ---------- */
function drawOutside(g, pts, t, seed, opts = {}) {
  const b = polyBox(pts);
  clipDo(g, pts, () => {
    const T = Decor.time, sky = g.createLinearGradient(0, b.y0 - 10, 0, b.y1 + 20); sky.addColorStop(0, T.sky[0]); sky.addColorStop(.7, T.sky[1]); sky.addColorStop(1, T.sky[2]);
    g.fillStyle = sky; g.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    if (opts.frosted) { g.fillStyle = 'rgba(255,255,255,0.62)'; g.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); for (let y = b.y0; y < b.y1; y += 3) pxRect(g, b.x0, y, b.x1 - b.x0, 1, 'rgba(255,255,255,0.25)'); return; }
    const w = b.x1 - b.x0, h = b.y1 - b.y0, mo = Settings.get('motion') ? 1 : 0;
    // clouds
    for (let i = 0; i < 3; i++) { const cx = b.x0 + ((hash(seed + i) * w + t * 2 * mo) % (w + 40)) - 20, cy = b.y0 + 3 + hash(seed + i + 4) * h * .3; pxEllipse(g, cx, cy, 7, 2, '#f4f8fb'); pxEllipse(g, cx + 4, cy - 1, 4, 2, '#ffffff'); }
    // the building across the street
    pxRect(g, b.x0 + w * .55, b.y0 + h * .45, w * .5, h * .6, T.building); pxRect(g, b.x0 + w * .55, b.y0 + h * .45, w * .5, 2, mix(T.building, '#2a1a10', .3));
    for (let y = b.y0 + h * .45 + 4; y < b.y1; y += 6) for (let x = b.x0 + w * .58; x < b.x1; x += 7) pxRect(g, x, y, 3, 3, hash(x * y) > (T.id === 'golden' || T.rain ? .55 : .8) ? '#ffe9a8' : mix(T.sky[1], '#5a6a80', .3));
    // birds now and then
    const bt = (t * .07 + hash(seed)) % 1;
    if (mo && bt < .35) { const bx = b.x0 + bt / .35 * (w + 20) - 10, by = b.y0 + h * .2 + Math.sin(t * 2) * 2; pxRect(g, bx, by, 1, 1, '#33333a'); pxRect(g, bx - 1, by - 1, 1, 1, '#33333a'); pxRect(g, bx + 1, by - 1, 1, 1, '#33333a'); }
    // the oak
    const sway = Math.sin(t * .8 + seed) * 2.2 * mo, sway2 = Math.sin(t * 1.3 + seed * 2) * 1.2 * mo;
    const tx = b.x0 + w * .22, ty = b.y1 + 4;
    pxLine(g, tx, ty, tx + 6 + sway * .4, b.y0 + h * .35, '#5a3f2a', 3);
    pxLine(g, tx + 4 + sway * .3, b.y0 + h * .55, tx + w * .4 + sway, b.y0 + h * .3, '#5a3f2a', 2);
    pxLine(g, tx + 2, b.y0 + h * .7, tx - w * .2 + sway, b.y0 + h * .45, '#5a3f2a', 2);
    const lc = Decor.pal(Game.room).leaves;
    for (let i = 0; i < 7; i++) {                                  // leafy clumps along the branches
      const lx = tx - w * .2 + hash(seed + i) * w * .65, ly = b.y0 + hash(seed + i + 9) * h * .5, s = 1 + hash(i + 4) * .6;
      foliage(g, lx, ly, 9 * s, 6 * s, lc, seed * 31 + i * 7, sway * (.6 + hash(i + 3) * .7) + sway2 * hash(i + 5));
    }
    if (mo && !T.rain) for (let i = 0; i < 3; i++) {             // a leaf letting go now and then
      const ft = (t * .12 + hash(seed + i * 5)) % 1, lc = Decor.pal(Game.room).leaves;
      pxRect(g, b.x0 + w * (.1 + hash(i + seed) * .5) + ft * w * .4 + Math.sin(t * 3 + i) * 3, b.y0 + ft * (h + 6) - 3, 2, 1, lc[i % lc.length]);
    }
    if (T.rain) for (let i = 0; i < 26; i++) {                 // rain on the glass
      const rx = b.x0 + hash(i + seed) * w, ry = b.y0 + ((hash(i * 3) * h + t * (60 + hash(i) * 40) * mo) % (h + 8)) - 4;
      pxLine(g, rx, ry, rx - 1, ry + 4, 'rgba(220,232,245,0.7)');
    }
  });
}
/* sunlight through a back-wall window lands on the floor as a slanted patch, with leaf shadows moving in it */
const SUN = [.28, -.62, -.75];
function sunPatch(r, xa, xb, ya, yb) {
  const zb = r.box.zb, onFloor = (x, y) => { const k = y / -SUN[1]; return [x + SUN[0] * k, Math.max(.001, zb + SUN[2] * k)]; };
  const pts = [[xa, ya], [xb, ya], [xb, yb], [xa, yb]].map(([x, y]) => onFloor(x, y));
  return pts.map(([x, z]) => P(x, 0, z));
}
function shrink(pts, k) { const c = polyBox(pts); return pts.map(([x, y]) => [c.cx + (x - c.cx) * k, c.cy + (y - c.cy) * k]); }
function drawSun(g, r, t, w) {
  const T = Decor.time; if (!T.sun || r.lightsOff && w.frosted) return;
  const patch = sunPatch(r, w.xa, w.xb, w.ya, w.yb), a = T.sunA * (w.level ?? 5) / 5;
  const glass = Q.back(r.box, w.xa, w.xb, w.ya, w.yb);
  if (w.shaft !== false) {                       // the shaft of light fades out on its way to the floor
    const gb = polyBox(glass), pb = polyBox(patch), lg = g.createLinearGradient(gb.cx, gb.cy, pb.cx, pb.cy);
    lg.addColorStop(0, rgba(T.sun, .08)); lg.addColorStop(.7, rgba(T.sun, .03)); lg.addColorStop(1, rgba(T.sun, 0));
    fillPoly(g, hull([...glass, ...patch]), lg);
  }
  const pools = w.slats ? Array.from({ length: w.slats }, (_, i) => { const st = (w.xb - w.xa) / w.slats; return sunPatch(r, w.xa + i * st + st * .55, w.xa + (i + 1) * st, w.ya, w.yb); }) : [patch];
  for (const pp of pools) for (const k of [1.08, 1, .92, .84, .74]) fillPoly(g, shrink(pp, k), rgba(T.sun, a * .24));   // feathered: brightest in the middle, no hard rim
  if (Settings.get('motion') && !w.frosted) clipDo(g, patch, () => {
    const b = polyBox(patch);
    for (let i = 0; i < 9; i++) {                 // dappled leaf shadows, soft and broken up
      const lx = b.x0 + hash(i + w.xa) * (b.x1 - b.x0) + Math.sin(t * .8 + i) * 3, ly = b.y0 + hash(i + 7 + w.xa) * (b.y1 - b.y0) + Math.cos(t * .6 + i) * 1.5;
      // drawn as flecks of brighter sun, never dark blobs, so the dappling can't be mistaken for dirt or wear on the floor
      for (let k = 0; k < 5; k++) fillPoly(g, blobPts(lx + (hash(i * 5 + k) - .5) * 12, ly + (hash(i * 7 + k) - .5) * 3, 2 + hash(i + k) * 3, 1 + hash(i + k + 3), i * 9 + k, .5, 7), rgba(T.sun, a * .22));
    }
  });
  if (Settings.get('motion')) {                  // dust motes drifting in the shaft
    const sh = hull([...glass, ...patch]), b = polyBox(sh);
    for (let i = 0; i < 14; i++) {
      const x = b.x0 + ((hash(i * 3 + w.xa) * (b.x1 - b.x0) + t * (3 + hash(i) * 4)) % (b.x1 - b.x0)), y = b.y0 + ((hash(i * 5 + w.ya) * (b.y1 - b.y0) + t * (2 + hash(i + 2) * 3)) % (b.y1 - b.y0));
      if (inPoly(sh, x, y) && ((t * 2 + i) % 3) > .6) pxRect(g, x, y, 1, 1, rgba(T.sun, .9));
    }
  }
}

/* ---------- the living room's ceiling fan, built so every part hangs off the one above it:
   ceiling -> canopy -> downrod -> motor housing (blade irons -> blades) -> switch cup -> light bowl, pull chain ---------- */
const FAN = { x: .4, z: 9.4, y: 3.42, rest: .4, tieBlade: 3 };
function tieSpot() {          // where the tie hangs (on a blade) or lies (on the floor after the fan flung it)
  if (Game.opened.tieFell) return { floor: true, x: -1.4, z: 7.4 };
  const a = FAN.rest + FAN.tieBlade * Math.PI * 2 / 5;
  return { x: FAN.x + Math.cos(a) * 1.25, z: FAN.z + Math.sin(a) * 1.25 };
}
function tieOnFan() { return Decor.cur && Decor.cur.tie && !Game.taken.has('tie') && !Game.opened.tieFell; }
function drawTie(g) {
  if (!Decor.cur || !Decor.cur.tie || Game.taken.has('tie')) return;
  const sp = tieSpot();
  if (sp.floor) {                                            // lying flat on the carpet where the fan flung it
    const p = P(sp.x, 0, sp.z); drawTieFlat(g, p[0], p[1] - 2, 1, -1.38);   // the whole length of it, flung out flat
    return;
  }
  // looped over the blade: find the blade's slant and width on screen at the tie, and wrap the tie around it
  const a = FAN.rest + FAN.tieBlade * Math.PI * 2 / 5, p = P(sp.x, FAN.y - .02, sp.z);
  const along = P(sp.x + Math.cos(a) * .2, FAN.y - .02, sp.z + Math.sin(a) * .2), across = P(sp.x - Math.sin(a) * .13, FAN.y - .02, sp.z + Math.cos(a) * .13);
  const dl = Math.hypot(along[0] - p[0], along[1] - p[1]) || 1;
  drawTieOverBlade(g, p, [across[0] - p[0], Math.max(1, Math.abs(across[1] - p[1])) * Math.sign(across[1] - p[1] || 1)], [(along[0] - p[0]) / dl, (along[1] - p[1]) / dl], 1, Game.t);
}
function drawFan(g, r, t) {
  const fv = cond('fan'), fl = flags('fan'), h = r.box.h, haz = fv === 2, droop = fv === 1 ? .05 : 0;
  const wobT = haz && fl.wobble ? t - fl.wobble : 99, wob = wobT < 2.6 ? Math.sin(t * 22) * .09 * (1 - wobT / 2.6) : 0;
  const spinning = (fl.spin && !haz) || wobT < 2.6;
  const cx = FAN.x, cz = FAN.z, x = cx + wob, drop = haz ? .1 : 0;
  // canopy, flush to the ceiling (on the bad fan it hangs low, with a dark gap above it)
  const ceil = P(cx, h, cz), cTop = P(cx, h - drop, cz), cBot = P(cx, h - drop - .16, cz);
  if (haz) pxRect(g, ceil[0] - 6, ceil[1], 12, Math.max(1, cTop[1] - ceil[1]), '#2a221c');
  pxRect(g, cTop[0] - 6, cTop[1], 12, Math.max(2, cBot[1] - cTop[1]), '#c4c7ce'); pxRect(g, cTop[0] - 6, cTop[1], 3, Math.max(2, cBot[1] - cTop[1]), '#e0e3ea');
  pxRect(g, cBot[0] - 4, cBot[1] - 1, 8, 2, '#9ea2ac');
  // downrod to the motor housing
  const hTop = P(x, FAN.y + .1, cz), hMid = P(x, FAN.y, cz), hBot = P(x, FAN.y - .08, cz);
  pxLine(g, cBot[0], cBot[1], hTop[0], hTop[1], '#8d93a1', 2);
  // blades on their irons, far ones first
  const ang = spinning ? t * 9 : FAN.rest, blades = [];
  for (let i = 0; i < 5; i++) blades.push(ang + i * Math.PI * 2 / 5);
  blades.sort((a, b) => Math.sin(b) - Math.sin(a));
  for (const a of blades) {
    const c = Math.cos(a), sn = Math.sin(a), at = rr => P(x + c * rr, FAN.y - (rr > .5 ? droop * (rr - .5) : 0), cz + sn * rr);
    const iron0 = at(.16), iron1 = at(.48), root = at(.42), tip = at(1.7);
    pxLine(g, iron0[0], iron0[1], iron1[0], iron1[1], '#5d626e', 2);
    const near = sn < 0, col = fv === 1 ? (near ? '#b99c76' : '#9c805c') : (near ? '#a0703c' : '#7a5228');
    pxLine(g, root[0], root[1], tip[0], tip[1], col, 3); pxLine(g, root[0], root[1] - 1, tip[0], tip[1] - 1, near ? '#c08a50' : '#5e3e20');
  }
  // motor housing: a squat drum the downrod drops into and the blade irons bolt onto
  pxRect(g, hTop[0] - 9, hTop[1], 18, Math.max(3, hBot[1] - hTop[1]), '#a9adb7'); pxRect(g, hTop[0] - 9, hTop[1], 4, Math.max(3, hBot[1] - hTop[1]), '#c8ccd4');
  pxEllipse(g, hBot[0], hBot[1], 9, 2, '#8d93a1'); pxRect(g, hTop[0] - 9, hTop[1], 18, 1, '#d9dce4');
  // switch cup right under the housing, the light bowl under that, and the pull chain hanging from the cup
  const cup = P(x, FAN.y - .12, cz);
  pxRect(g, cup[0] - 4, hBot[1] + 1, 8, 3, '#9ea2ac'); pxRect(g, cup[0] - 4, hBot[1] + 1, 2, 3, '#c4c8d0');
  const bowlY = hBot[1] + 4, lit = !r.lightsOff;
  pxRect(g, cup[0] - 6, bowlY, 12, 1, '#8d93a1');
  pxEllipse(g, cup[0], bowlY + 3, 7, 4, '#8a8478'); pxRect(g, cup[0] - 7, bowlY, 14, 3, '#8a8478');             // a gray rim, so the white glass doesn't melt into the white ceiling
  pxEllipse(g, cup[0], bowlY + 3, 6, 3, lit ? '#f6e8c0' : '#d8d0bc'); pxRect(g, cup[0] - 6, bowlY + 1, 12, 2, lit ? '#fff8e0' : '#e4ded0'); pxRect(g, cup[0] - 3, bowlY + 2, 3, 2, '#ffffff');
  pxRect(g, cup[0] - 4, bowlY + 5, 8, 1, lit ? '#e2cc98' : '#bab29e');                                              // the frosted bowl's lower curve, a shade darker
  const sw = spinning ? Math.sin(t * 6) * 1.2 : 0;
  pxLine(g, cup[0] + 3, hBot[1] + 4, cup[0] + 4 + sw, hBot[1] + 15, '#c9a227'); pxRect(g, cup[0] + 3 + sw, hBot[1] + 15, 2, 2, '#e8c34a');
  if (lit) softGlow(g, cup[0], bowlY + 10, 70, 28, '#fff6d8', .12);
  drawTie(g);
}

/* the toilet, side-on against the bathroom's left wall. What makes it read as a toilet from across the room:
   a slim tank with a flush lever, the lid standing up against the tank, an open oval seat with water in it, and a
   bowl that pinches in to a narrow foot. Every piece gets a soft gray outline so the white doesn't melt into the tub. */
function drawToilet(g, v) {
  const T = '#f8f8f4', S = '#d6d8d2', W = '#ffffff', O = '#868ba0', cz = 8.3;
  fillPoly(g, ring(-3.36, .004, cz, .5, .36, 18), 'rgba(40,40,70,0.16)');                                // contact shadow
  box3(g, -4, -3.72, .74, 1.36, 8, 8.6, { front: T, side: S, top: W });                                   // tank
  strokePoly(g, hull([P(-3.72, .74, 8), P(-3.72, .74, 8.6), P(-3.72, 1.36, 8.6), P(-3.72, 1.36, 8), P(-4, 1.36, 8), P(-4, 1.36, 8.6)]), O);
  const lidT = hull([...ring(-3.85, 1.42, cz, .17, .34, 16), ...ring(-3.85, 1.36, cz, .17, .34, 16)]);
  fillPoly(g, lidT, W); strokePoly(g, lidT, O);                                                           // tank lid, rounded ends
  if (v === 2) { const c = P(-3.86, 1.42, 8.08); pxCrack(g, c[0], c[1], .2, 9, '#6a6a62', 5, 2); }
  { const h = P(-3.72, 1.27, 8.08); pxRect(g, h[0], h[1], 4, 1, '#9aa0ae'); pxRect(g, h[0], h[1] - 1, 2, 1, '#c9ccd4'); }   // chrome flush lever
  const rim = ring(-3.24, .6, cz, .46, .29, 24), mid = ring(-3.3, .34, cz, .32, .2, 18), foot = ring(-3.42, 0, cz, .2, .15, 14);
  const footP = hull([...mid, ...foot]), bowlP = hull([...rim, ...mid]);
  fillPoly(g, footP, '#e2e3dc'); strokePoly(g, footP, O);                                                // the narrow foot
  fillPoly(g, bowlP, S); strokePoly(g, bowlP, O);                                                        // the bowl, curving in
  fillPoly(g, hull([...ring(-3.16, .46, cz, .32, .2, 16), ...rim]), T);                                   // the lit side of the bowl
  fillPoly(g, rim, W); strokePoly(g, rim, O);                                                            // seat
  const hole = ring(-3.2, .605, cz, .3, .17, 20);
  fillPoly(g, hole, '#c4ccd4'); fillPoly(g, ring(-3.18, .607, cz, .2, .11, 16), v === 3 ? '#b8c8a0' : '#9cc4dc');   // the opening, and water
  { const b = P(-3.42, .62, cz); pxRect(g, b[0] - 1, b[1], 3, 1, '#9aa0ae'); }                          // a seat hinge
  // the lid, raised and leaning back on the tank: as wide as the seat and as long, so it would close right over it
  const lid = [P(-3.6, .64, cz - .27), P(-3.6, .64, cz + .27)];
  for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI; lid.push(P(-3.71, 1.13 + Math.sin(a) * .27, cz + Math.cos(a) * .28)); }
  const lidP = hull(lid); fillPoly(g, lidP, '#f2f2ec'); strokePoly(g, lidP, O);
  { const m = [P(-3.62, .72, cz - .19), P(-3.62, .72, cz + .19)]; for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI; m.push(P(-3.705, 1.11 + Math.sin(a) * .19, cz + Math.cos(a) * .2)); } strokePoly(g, hull(m), 'rgba(134,139,160,0.45)'); }   // its recessed panel
}

/* the bedroom wall's drawing, projected from the close-up onto the left wall: each screen column of the wall
   picks up the matching slice of the close-up (averaged, then inked twice so thin pencil and marker lines survive) */
function drawWallArt(g, r, v) {
  const src = document.createElement('canvas'); src.width = 240; src.height = 108; bwallDrawing(src.getContext('2d'), v);
  // kid-sized: the whole sheet spans about 2.5 units of wall and 1.1 high (the drawing itself about 1.5 by .9), centered at a five-year-old's reach
  const K = 1.5 / 146, zOf = x => 10.4 + (x - 117) * K, yOf = y => 1.3 - (y - 54) * K, x0 = r.box.x0;
  const X0 = Math.round(P(x0, 1, zOf(0))[0]), X1 = Math.round(P(x0, 1, zOf(240))[0]);
  const sxAt = X => { const z = CAM.f * x0 / (X - CAM.cx); return 117 + (z - 10.4) / K; };
  g.save(); g.imageSmoothingEnabled = true;
  for (let X = Math.min(X0, X1); X < Math.max(X0, X1); X++) {
    const a = clamp(sxAt(X), 0, 240), b = clamp(sxAt(X + 1), 0, 240), z = zOf((a + b) / 2), top = P(x0, yOf(0), z)[1], bot = P(x0, yOf(108), z)[1];
    if (Math.abs(b - a) < .01) continue;
    for (let n = 0; n < 2; n++) g.drawImage(src, Math.min(a, b), 0, Math.max(.5, Math.abs(b - a)), 108, X, top, 1, bot - top);
  }
  g.restore();
}
/* ---------- the four rooms ---------- */
const ROOMS = {
  living: {
    name: 'Living Room', box: { x0: -6, x1: 6, h: 4, zb: 13 }, amb: .6,
    floor: carpetFloor, floorBase: p => p.floor.base,
    walk: { x0: -5.2, x1: 5.2, z0: 4.8, z1: 12.2 }, start: { x: 1.5, z: 6.4 },
    windows: [{ xa: 2.7, xb: 5.5, ya: .05, yb: 2.95, slats: 9, level: 5 }],
    doors: [
      { id: 'toBed', side: 'left', za: 8.2, zb: 9.8, to: 'bedroom', name: 'Hallway to the bedroom', walk: { x: -5.2, z: 9 }, spawn: { x: 5, z: 9.2 } },
      { id: 'toKitchen', side: 'right', za: 8.6, zb: 10.6, to: 'kitchen', name: 'Kitchen', walk: { x: 5.2, z: 9.6 }, spawn: { x: -4.2, z: 9 } },
    ],
    features: {
      carpet: { pts: () => Q.floor(-2.7, 2.7, 7, 10.6), walk: { x: 0, z: 6.6 } },
      tvwall: { pts: () => Q.back(ROOMS.living.box, -2.1, 2.2, .9, 3.25), walk: { x: .1, z: 11.8 } },
      fan: { pts: () => [P(-1.4, 4, 9.4), P(2.2, 4, 9.4), P(2.2, 2.8, 9.4), P(-1.4, 2.8, 9.4)], walk: { x: .4, z: 8 } },
      frontdoor: { pts: () => Q.back(ROOMS.living.box, -5.4, -3.6, 0, 2.95), walk: { x: -4.5, z: 12 } },
      thermostat: { pts: () => Q.back(ROOMS.living.box, -2.85, -2.35, 1.75, 2.15), walk: { x: -2.6, z: 11.8 } },
      patio: { pts: () => Q.back(ROOMS.living.box, 2.6, 5.6, 0, 3.05), walk: { x: 4, z: 11.6 } }
    },
    scenery: [
      { id: 'switch', name: 'Light switch', pts: () => Q.back(ROOMS.living.box, -3.48, -3.24, 1.22, 1.68), walk: { x: -3.2, z: 11.8 }, light: true,
        look: 'The switch for the ceiling fan light.' },
      { id: 'fanswitch', name: 'Fan switch', pts: () => Q.back(ROOMS.living.box, -3.24, -3, 1.22, 1.68), walk: { x: -3.1, z: 11.8 }, fan: true,
        look: 'The switch for the ceiling fan. Worth a try: an inspection means checking that things work.' },
    ],
    walls(g, r) {
      const zb = r.box.zb;
      // where the TV used to hang
      const v = cond('tvwall');
      if (v !== 3) fillPoly(g, Q.back(r.box, -1.3, 1.5, 1.5, 2.8), mix(Decor.pal('living').back, '#ffffff', .14));
      if (v === 0) for (const x of [-1, -.4, .3, 1]) { const p = P(x, 2.95, zb); pxRect(g, p[0], p[1], 1, 1, '#5a4a38'); }
      if (v === 1 && !flags('tvwall').removed) for (const [x, y] of [[-.6, 2.5], [.8, 2.5], [-.6, 1.8], [.8, 1.8]]) { const p = P(x, y, zb); pxRect(g, p[0] - 1, p[1] - 1, 2, 2, '#ffffff'); }
      if (v === 1 && flags('tvwall').removed) for (const [x, y] of [[-.6, 2.5], [.8, 2.5], [-.6, 1.8], [.8, 1.8]]) { const p = P(x, y, zb); pxRect(g, p[0], p[1], 1, 1, '#4a3a2a'); }
      if (v === 2) for (const [i, [x, y]] of [[-.4, 2.2], [.7, 2.2]].entries()) { const p = P(x, y, zb); fillPoly(g, blobPts(p[0], p[1], 4, 3, 7 + i * 5, .6, 10), '#f2e8d4'); fillPoly(g, blobPts(p[0] + .5, p[1], 2.4, 1.6, 3 + i * 9, .6, 9), '#3a2f28'); }
      outletBack(g, r, 1.3, .45);
      sixPanelDoor(g, r, -5.4, -3.6);
      { const p = P(-4.5, 2.15, zb); pxRect(g, p[0], p[1], 1, 1, '#555'); const d = P(-3.78, 1.55, zb); pxRect(g, d[0] - 1, d[1], 2, 2, '#c9a227'); }
      { const q = Q.back(r.box, -3.45, -3.03, 1.28, 1.62); fillPoly(g, q, '#f2ecdc'); strokePoly(g, q, '#a8a08c');   // two-gang plate: light, fan
        toggleIn(g, Q.back(r.box, -3.42, -3.26, 1.3, 1.6), !r.lightsOff); toggleIn(g, Q.back(r.box, -3.22, -3.06, 1.3, 1.6), !!flags('fan').spin); }
      scuffs(g, r, 3); cobweb(g, ...P(r.box.x0, r.box.h, zb), 1, 1, 2); floorVent(g, 4.5, 5.3, 5, 5.35);
      { const tv = cond('thermostat');                      // thermostat
        if (tv === 3) { fillPoly(g, Q.back(r.box, -2.74, -2.46, 1.84, 2.06), '#9a9a92'); const a = P(-2.6, 1.95, zb), b = P(-2.66, 1.84, zb); pxLine(g, a[0], a[1], b[0], b[1], '#d64545'); pxLine(g, a[0] + 1, a[1], b[0] + 3, b[1] + 1, '#e8e8e2'); }
        else if (tv === 2) { fillPoly(g, [P(-2.8, 1.8, zb), P(-2.4, 1.86, zb), P(-2.43, 2.14, zb), P(-2.82, 2.08, zb)], '#ece2c8'); const a = P(-2.78, 1.96, zb), b = P(-2.45, 2.0, zb); pxLine(g, a[0], a[1], b[0], b[1], '#8a7a5a'); }
        else { fillPoly(g, Q.back(r.box, -2.8, -2.4, 1.8, 2.1), tv === 1 ? '#e2d4a2' : '#ece2c8'); const c = polyBox(Q.back(r.box, -2.75, -2.45, 1.92, 2.04)); pxRect(g, c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0, '#8fc49a'); } }
      // sliding door frame + blinds
      fillPoly(g, Q.back(r.box, 2.6, 5.6, 0, 3.05), '#c0c4cc'); cutOut(g, Q.back(r.box, 2.7, 5.5, .05, 2.95));
      fillPoly(g, Q.back(r.box, 4.06, 4.14, .05, 2.95), '#a9aeb8');
      fillPoly(g, Q.back(r.box, 2.55, 5.65, 2.9, 3.1), '#f2efe6');
      // the blinds themselves are drawn live (they open and close): see Openables.vblinds
      doorOnSide(g, r, 'left', 8.2, 9.8, '#6e6a72');
      doorOnSide(g, r, 'right', 8.6, 10.6, '#d9c890');
      // carpet condition seen from the room
      const c = cond('carpet');
      if (c === 0) for (let x = -5.5; x < 5.5; x += 1.1) fillPoly(g, Q.floor(x, x + .55, 3.5, 12.8), dither('#efe0bb', 3));
      if (c === 1) {                         // a worn traffic lane: matted, flattened pile, a little grayer and shinier than the rest, soft at the edges
        const f = Decor.pal('living').floor, worn = mix(f.base, '#9a968c', .45), path = [[-4.5, 12.5], [-4, 11.6], [-3.2, 10.5], [-2.3, 9.3], [-1.5, 8.1], [-.8, 6.8], [-.3, 5.4], [0, 4.2]];
        for (const [k, a] of [[1.5, .14], [1.15, .2], [.85, .28]]) for (const [i, [x, z]] of path.entries()) fillPoly(g, floorBlob(x, z, .55 * k + (i === 3 ? .15 : 0), .5 * k, i * 5 + 1, .35, 14), rgba(worn, a));
        for (const [i, [x, z]] of path.entries()) { const q = P(x, 0, z); speckle(g, q[0] - 12, q[1] - 3, 24, 6, rgba(f.lt, .55), 26, i + 40); speckle(g, q[0] - 10, q[1] - 2, 20, 4, rgba(f.dk, .35), 14, i + 60); }   // crushed fibers catching the light
      }
      if (c === 2) stain(g, floorBlob(.2, 8.7, 1.15, .72, 31, .5, 22), rgba('#7a6642', .6), '#7d6a44', 31);
      if (c === 3) for (const [i, [x, z]] of [[3.4, 11.9], [3.9, 12.2], [4.3, 11.7]].entries()) { const p = P(x, 0, z); fillPoly(g, blobPts(p[0], p[1], 1.6, .8, i * 7, .7, 7), '#2a1a10'); }
    },
    dynamic(g, r, t) { drawFan(g, r, t); }
  },
  kitchen: {
    name: 'Kitchen', box: { x0: -5, x1: 5, h: 4, zb: 12 }, amb: .45,
    floor: tileFloor(1), floorBase: p => p.floor[0],
    walk: { x0: -4.4, x1: 4.4, z0: 4.8, z1: 10.4 }, start: { x: -3.6, z: 9 },
    windows: [{ xa: -.7, xb: 1.3, ya: 1.5, yb: 2.85, level: 3, shaft: false }],
    doors: [{ id: 'toLiving', side: 'left', za: 8, zb: 9.8, to: 'living', name: 'Living room', walk: { x: -4.4, z: 8.9 }, spawn: { x: 4.6, z: 9.6 } }],
    features: {
      counter: { pts: () => hull(boxPts(-4.95, -1.15, .1, 1.02, 10.9, 12)), walk: { x: -3, z: 10.2 } },
      sink: { pts: () => hull(boxPts(-1.1, 1.7, 0, 1.15, 10.9, 12)), walk: { x: .3, z: 10.2 } },
      stove: { pts: () => hull(boxPts(2.15, 3.45, 0, 1.2, 11.1, 12)), walk: { x: 2.8, z: 10.2 } },
      fridge: { pts: () => hull(boxPts(3.6, 5, 0, 2.85, 10.9, 12)), walk: { x: 3.9, z: 10.2 } },
      dishwasher: { pts: () => [P(-2.5, 0, 11.05), P(-1.2, 0, 11.05), P(-1.2, .86, 11.05), P(-2.5, .86, 11.05)], walk: { x: -1.9, z: 10.2 } },
      kfloor: { pts: () => Q.floor(-1.6, 4.5, 7.6, 10.75), walk: { x: 1, z: 8.4 } },   // reaches the fridge, so the whole traffic path is clickable
      ucab: { when: () => isOpen(Openables.hostOf('ucab')), pts: () => shrink(Openables.opening(DOOR[Openables.hostOf('ucab')]), .86), get walk() { const d = DOOR[Openables.hostOf('ucab')]; return d.walk || doorWalk(d); } },
      lcab: { when: () => isOpen(Openables.hostOf('lcab')), pts: () => shrink(Openables.opening(DOOR[Openables.hostOf('lcab')]), .86), get walk() { const d = DOOR[Openables.hostOf('lcab')]; return d.walk || doorWalk(d); } }
    },
    scenery: [
      { id: 'hood', name: 'Range hood', pts: () => hull([...boxPts(2.15, 3.45, 2.3, 2.7, 11.45, 12)]), walk: { x: 2.8, z: 10.2 }, hood: true,
        look: 'A stainless range hood over the stove, with a fan and a little light. The filter is greasy, like every range hood filter.' },
      { id: 'kswitch', name: 'Light switch', pts: () => Q.left(ROOMS.kitchen.box, 7.4, 7.8, 1.15, 1.6), walk: { x: -4.2, z: 7.6 }, light: true,
        look: 'The switch for the fluorescent light.' },
      { id: 'breaker', name: 'Breaker panel', pts: () => Q.left(ROOMS.kitchen.box, PANEL_Z[0], PANEL_Z[1], PANEL_Y[0], PANEL_Y[1]), walk: { x: -4.2, z: 7 }, panel: true,
        look: "The unit's breaker panel. Every circuit in the apartment, labeled in somebody's handwriting. Open it (just click it) to cut the power to one.",
        smell: 'Dust and warm metal. No burning smell here, at least.', talk: 'You ask the panel how it is. It hums.' }
    ],
    walls(g, r) {
      const zb = r.box.zb;
      fillPoly(g, Q.back(r.box, -5, 2.1, .9, 1.45), '#d8cfb8');                 // backsplash
      for (let x = -5; x < 2.1; x += .3) lineW(g, P(x, .96, zb), P(x, 1.45, zb), '#cbc1a8');
      // range hood, drawn before the cabinets so its hidden side never shows through the one beside it; a little light under it
      box3(g, 2.15, 3.45, 2.3, 2.7, 11.45, zb, { front: '#c3c7ce', side: '#9a9ea8', bottom: '#7d8290' });
      { const a = P(2.45, 2.3, 11.5), b = P(3.15, 2.3, 11.5); pxRect(g, a[0], a[1] - 1, Math.max(2, b[0] - a[0]), 1, Game.hoodOn ? '#fff4c8' : '#6a6e78'); }
      // upper cabinets
      for (const [xa, xb] of [[-5, -.95], [1.55, 2.15]]) {
        box3(g, xa, xb, 2.05, 3.55, 11.6, zb, { front: '#b48048', side: '#9a6a38' });
        for (let x = xa + .05; x < xb - .1; x += .95) { const xe = Math.min(x + .9, xb - .05); fillPoly(g, [P(x + .08, 2.15, 11.6), P(xe - .08, 2.15, 11.6), P(xe - .08, 3.45, 11.6), P(x + .08, 3.45, 11.6)], '#a8743f'); const k = P(xe - .16, 2.3, 11.6); pxRect(g, k[0], k[1], 1, 2, '#d9c27a'); }
      }
      windowBack(g, r, -.7, 1.3, 1.5, 2.85, { mullion: true });
      fillPoly(g, Q.back(r.box, -.85, 1.45, 2.85, 3.05), '#c2603a');           // a valance, very 2008
      // lower cabinets + countertop
      box3(g, -5, 2.1, 0, .88, 11.05, zb, { front: '#b48048', side: '#9a6a38' });
      for (const [xa, xb] of [[-.89, .25], [.25, 1.39]]) {                       // the sink's two tall doors, with the same raised panels as every other cabinet
        fillPoly(g, [P(xa + .03, .1, 11.05), P(xb - .03, .1, 11.05), P(xb - .03, .84, 11.05), P(xa + .03, .84, 11.05)], '#a8743f');
        fillPoly(g, [P(xa + .12, .18, 11.05), P(xb - .12, .18, 11.05), P(xb - .12, .76, 11.05), P(xa + .12, .76, 11.05)], '#b98a52');
        lineW(g, P(xa + .12, .76, 11.05), P(xb - .12, .76, 11.05), '#8a5a2c'); lineW(g, P(xa + .12, .18, 11.05), P(xa + .12, .76, 11.05), '#8a5a2c');
      }
      for (let x = -4.95; x < 2; x += .8) { if (x > -1 && x < 1) continue;   // the sink's doors stand in for these three bays
        fillPoly(g, [P(x + .06, .1, 11.05), P(x + .74, .1, 11.05), P(x + .74, .62, 11.05), P(x + .06, .62, 11.05)], '#a8743f'); fillPoly(g, [P(x + .06, .67, 11.05), P(x + .74, .67, 11.05), P(x + .74, .84, 11.05), P(x + .06, .84, 11.05)], '#a8743f'); }
      box3(g, -5.05, 2.15, .88, .96, 10.95, zb, { front: '#8a8174', top: '#7d7468', side: '#6e665a' });
      speckPoly(g, [P(-5.05, .96, 10.95), P(2.15, .96, 10.95), P(2.15, .96, zb), P(-5.05, .96, zb)], '#5e564c', .5, 8);
      const sv = cond('sink');
      if (sv === 3) fillPoly(g, [P(-1, .05, 11.05), P(1.6, .05, 11.05), P(1.6, .2, 11.05), P(-1, .2, 11.05)], dither('#4f3218', 8));
      fillPoly(g, [P(-.55, .96, 11.25), P(1.15, .96, 11.25), P(1.15, .96, 11.8), P(-.55, .96, 11.8)], '#a9aeb7');
      fillPoly(g, [P(-.5, .96, 11.32), P(.25, .96, 11.32), P(.25, .96, 11.74), P(-.5, .96, 11.74)], '#7f848e');
      fillPoly(g, [P(.35, .96, 11.32), P(1.1, .96, 11.32), P(1.1, .96, 11.74), P(.35, .96, 11.74)], '#7f848e');
      // the faucet: the gooseneck reaches over the left basin
      { const a = P(.3, .96, 11.9), b = P(.3, 1.45, 11.9), c = P(flags('sink').spout ? .72 : -.1, 1.45, 11.55); pxLine(g, a[0], a[1], b[0], b[1], '#d9dce4', 2); pxLine(g, b[0], b[1], c[0], c[1], '#d9dce4', 2); }
      if (sv === 2) { const p = P(1.85, 1.15, zb); pxRect(g, p[0], p[1], 3, 4, '#ece2c8'); pxRect(g, p[0] + 1, p[1] + 1, 1, 1, '#5a5040'); } else { const p = P(1.85, 1.15, zb); pxRect(g, p[0], p[1], 3, 4, '#ece2c8'); pxRect(g, p[0] + 1, p[1], 1, 2, '#d8ccb0'); }
      const cv = cond('counter');
      if (cv === 2) { const rg = blobPts(-3, 11.52, .42, .24, 17, .3, 18).map(([x, z]) => P(x, .961, z)), hole = blobPts(-3, 11.52, .26, .14, 23, .3, 14).map(([x, z]) => P(x, .961, z)); fillPoly(g, rg, rgba('#3a2410', .62)); fillPoly(g, hole, '#7a7064'); }
      if (cv === 3) fillPoly(g, [P(-2, .88, 10.95), P(-1.7, .88, 10.95), P(-1.75, .96, 10.95), P(-1.95, .96, 10.95)], '#c8a878');
      if (cv === 1) fillPoly(g, blobPts(1.6, 11.35, .4, .22, 5, .35, 14).map(([x, z]) => P(x, .961, z)), rgba('#b0a898', .32));
      // dishwasher, in place of two cabinet doors
      { const dv = cond('dishwasher'), z = 11.05;
        {
          fillPoly(g, [P(-2.5, .02, z), P(-1.2, .02, z), P(-1.2, .86, z), P(-2.5, .86, z)], '#ecebe6');
          fillPoly(g, [P(-2.5, .74, z), P(-1.2, .74, z), P(-1.2, .86, z), P(-2.5, .86, z)], '#d8d6ce');
          lineW(g, P(-2.4, .68, z), P(-1.3, .68, z), '#9a9ea8'); { const p = P(-1.35, .8, z); pxRect(g, p[0], p[1], 1, 1, '#d64545'); }
          if (dv === 2) { const c = P(-1.8, .38, z); fillPoly(g, blobPts(c[0], c[1], 4, 3, 8, .6, 10), '#c8c6be'); }
        }
        if (dv === 3) fillPoly(g, floorBlob(-1.85, 10.75, .6, .25, 12, .5, 14), rgba('#7a6a50', .45)); }
      { const kv = cond('kfloor');                            // the floor in front of the sink and stove
        if (kv === 1) {                                    // the worn lane from the sink to the fridge: dull, a little gray, with scuffs (matches the close-up)
          fillPoly(g, [P(-.4, 0, 10.6), P(.6, 0, 10.6), P(4.3, 0, 9.6), P(3.6, 0, 9.0)], 'rgba(120,110,90,0.3)');
          for (let i = 0; i < 7; i++) { const x = -.1 + i * .6, z = 10.2 - i * .17, a = P(x, 0, z), b = P(x + .25, 0, z - .05); lineW(g, a, b, 'rgba(80,70,56,0.35)'); }
        }
        if (kv === 2) stain(g, floorBlob(2.4, 9.6, .38, .26, 44, .4, 16), 'rgba(40,24,12,0.55)', 'rgba(20,12,6,0.6)', 44);
        if (kv === 3) { const a = P(.2, 0, 9.4), b = P(1.2, 0, 9.4), c = P(1.2, .04, 9.0), d = P(.2, .04, 9.0); fillPoly(g, [a, b, c, d], 'rgba(20,10,0,0.25)'); lineW(g, P(.2, .04, 9.0), P(1.2, .04, 9.0), '#fff8e8'); } }
      // range
      const stv = cond('stove');
      box3(g, 2.15, 3.45, 0, .92, 11.15, zb, { front: '#1c1d21', top: '#2a2b30', side: '#141518' });
      fillPoly(g, Q.back(r.box, 2.15, 3.45, .92, 1.2), '#2a2b30');
      for (const [x, z] of [[2.45, 11.4], [3.15, 11.4], [2.45, 11.8], [3.15, 11.8]]) { const p = P(x, .93, z); pxEllipse(g, p[0], p[1], 3, 1, '#3c3e44'); }
      fillPoly(g, [P(2.3, .2, 11.15), P(3.3, .2, 11.15), P(3.3, .65, 11.15), P(2.3, .65, 11.15)], '#0f1013');
      for (let i = 0; i < 4; i++) { const p = P(2.3 + i * .32, .8, 11.15); pxRect(g, p[0], p[1], 2, 2, stv === 2 && i === 0 ? '#3a2a1a' : '#c9ccd4'); }
      // fridge (a side-by-side: freezer on the left, fresh food on the right)
      const fv = cond('fridge');
      if (fv === 3) fillPoly(g, floorBlob(4.2, 10.45, .75, .4, 9, .5, 16), rgba('#9fc8dc', .55));
      box3(g, 3.6, 5, 0, 2.85, 10.9, zb, { front: '#23252b', side: '#1a1b20', top: '#2e3038' });
      fillPoly(g, [P(4.27, 0, 10.9), P(4.33, 0, 10.9), P(4.33, 2.85, 10.9), P(4.27, 2.85, 10.9)], '#0f1013');
      for (const x of [4.15, 4.45]) { const a = P(x, 1.1, 10.88), b = P(x, 2.1, 10.88); pxLine(g, a[0], a[1], b[0], b[1], '#c9ccd4', 2); }
      fillPoly(g, [P(3.75, 1.6, 10.9), P(4.05, 1.6, 10.9), P(4.05, 1.95, 10.9), P(3.75, 1.95, 10.9)], '#3a3c44');
      fillPoly(g, [P(3.62, .05, 10.9), P(4.98, .05, 10.9), P(4.98, .16, 10.9), P(3.62, .16, 10.9)], '#141518');   // kick plate
      if (fv === 2) { const c = P(3.95, 1.25, 10.9); fillPoly(g, blobPts(c[0], c[1], 3.5, 2.5, 4, .6, 10), '#3a3d46'); pxLine(g, c[0] - 3, c[1] - 1, c[0] + 2, c[1] + 1, '#5a5e68'); }
      for (const [x, y, col] of [[3.72, 2.3, '#e8c34a'], [3.95, 2.45, '#d64545'], [3.8, .9, '#4a8fe0'], [4.05, 2.15, '#f4f4ec']]) { const p = P(x, y, 10.9); pxRect(g, p[0], p[1], 2, 2, col); }   // fridge magnets
      // calendar + switch on the left wall
      drawWallCalendar(g, r);                                       // js/calendar.js: this shift's calendar, on its month
      sideSwitch(g, r, 'left', 7.45, 7.75, 1.2, 1.55, !r.lightsOff);
      outletBack(g, r, -2.4, 1.05); scuffs(g, r, 8);
      doorOnSide(g, r, 'left', 8, 9.8, '#cdb996');
      drawBreakerPanel(g, r);                                       // after the doorway: an open panel door sticks out in front of its trim
      // fluorescent ceiling box
      fillPoly(g, Q.ceil(r.box, -1, 1.2, 7.5, 9.5), '#d0d4d8'); fillPoly(g, Q.ceil(r.box, -.9, 1.1, 7.6, 9.4), '#f8fbff');
    },
    dynamic(g, r, t) {
      r.flickerDark = !r.lightsOff && flickerDark(t, 120, 3, .35);       // the old fluorescent stutters now and then
      if (Game.hoodOn) { const c = P(2.8, .95, 11.4); softGlow(g, c[0], c[1], 34, 10, '#fff2c0', .22); }   // the hood light, warm on the stovetop
      if (r.lightsOff || r.flickerDark) fillPoly(g, Q.ceil(r.box, -.9, 1.1, 7.6, 9.4), '#b8bcc4');
      else fillPoly(g, Q.floor(-2, 2.3, 5, 10), rgba('#f6fbff', .1));
      Sink.drawRoom(g, t);                                              // the faucet, if it's running
    }
  },
  bath: {
    name: 'Bathroom', box: { x0: -4, x1: 4, h: 4, zb: 11 }, amb: .25,
    floor: tileFloor(.8), floorBase: p => p.floor[0],
    walk: { x0: -2.6, x1: 3.2, z0: 5.2, z1: 9.2 }, start: { x: 2.6, z: 7.4 },
    windows: [{ xa: -2.8, xb: -1.4, ya: 2.75, yb: 3.4, level: 3, frosted: true, shaft: false }],
    doors: [{ id: 'toBedroom', side: 'right', za: 6.6, zb: 8.4, to: 'bedroom', name: 'Bedroom', walk: { x: 3.4, z: 7.5 }, spawn: { x: -.8, z: 11.4 } }],
    features: {
      mirror: { pts: () => Q.back(ROOMS.bath.box, 1.2, 3.55, 1.3, 3.05), walk: { x: 2.4, z: 9.4 } },
      tub: { pts: () => hull([...boxPts(-4, .45, 0, .58, 9.45, 11), ...Q.back(ROOMS.bath.box, -4, .45, .58, 2.5)]), walk: { x: -1.6, z: 9 } },
      toilet: { pts: () => hull([...boxPts(-4, -3.65, .7, 1.48, 7.95, 8.65), ...boxPts(-3.72, -2.76, 0, .66, 7.98, 8.62), P(-3.66, 1.26, 8.3)]), walk: { x: -2.4, z: 8.3 } },
      outlet: { pts: () => Q.back(ROOMS.bath.box, 3.5, 3.92, .92, 1.42), walk: { x: 3.1, z: 9.4 } },
      vent: { pts: () => Q.ceil(ROOMS.bath.box, 1.1, 2.1, 7.4, 8.3), walk: { x: 1.6, z: 7 } },
      towelbar: { pts: () => Q.right(ROOMS.bath.box, 9.9, 10.6, 1.3, 1.9), walk: { x: 3, z: 9 } },
      vanitycab: { when: () => isOpen(Openables.hostOf('vanitycab')), pts: () => shrink(Openables.opening(DOOR[Openables.hostOf('vanitycab')]), .86), get walk() { const d = DOOR[Openables.hostOf('vanitycab')]; return d.walk || doorWalk(d); } }
    },
    scenery: [
      { id: 'bswitch', name: 'Light switch', pts: () => Q.right(ROOMS.bath.box, 8.6, 9, 1.15, 1.6), walk: { x: 3, z: 8.6 }, light: true, look: 'The switch for the vanity light.' },
      { id: 'vswitch', name: 'Vent fan switch', pts: () => Q.right(ROOMS.bath.box, 9.05, 9.45, 1.15, 1.6), walk: { x: 3, z: 8.8 }, vent: true, look: 'The switch for the vent fan.' },
      { id: 'curtain', name: 'Shower curtain', pts: () => [P(.2, .6, 9.45), P(.5, .6, 9.45), P(.5, 2.75, 9.45), P(.2, 2.75, 9.45)], walk: { x: .2, z: 8.8 },
        look: 'A sea-foam shower curtain with little seashells. The previous tenant left it. Kindly? Or lazily?', smell: 'Mildew, faintly. Curtains are disposable. Not a finding.', touch: 'Vinyl. Slightly slimy. You regret this.' }
    ],
    walls(g, r) {
      const zb = r.box.zb, tv = cond('tub');
      // tile surround
      fillPoly(g, Q.back(r.box, -4, .45, .55, 2.5), '#f4f4ee'); fillPoly(g, Q.left(r.box, 9.45, zb, .55, 2.5), '#e8e8e2');
      for (let y = .55; y < 2.5; y += .22) lineW(g, P(-4, y, zb), P(.45, y, zb), tv === 3 && y < 1 ? '#6a6658' : '#cfcfc6');
      for (let x = -4; x < .45; x += .4) lineW(g, P(x, .55, zb), P(x, 2.5, zb), '#d8d8d0');
      for (let y = .55; y < 2.5; y += .22) lineW(g, P(-4, y, 9.45), P(-4, y, zb), '#d0d0c8');
      if (tv === 2) for (const [i, [x, y]] of [[-2.6, 1.6], [-.9, 1.2]].entries()) { const p = P(x, y, zb), n = 3 + i; pxRect(g, p[0], p[1], 1, 1, '#8a8a80');   // uneven cracks out of one impact point
        for (let k = 0; k < n; k++) pxCrack(g, p[0], p[1], i * 1.3 + k * 6.28 / n + (hash(k * 5 + i) - .5) * 1.1, 3 + hash(k + i * 4) * 8, '#8a8a80', 3 + k * 7 + i * 31, 2); }
      if (tv === 4) { const p = P(-1.8, 1.25, zb); pxEllipse(g, p[0], p[1], 3, 3, '#b8b8ae'); pxEllipse(g, p[0], p[1], 2, 2, '#9a9a90'); pxRect(g, p[0] - 1, p[1] - 1, 1, 1, '#6a6a62'); pxRect(g, p[0] + 1, p[1] - 1, 1, 1, '#6a6a62'); pxRect(g, p[0], p[1] + 1, 1, 1, '#6a6a62'); }
      // tub
      box3(g, -4, .45, 0, .58, 9.45, zb, { front: '#f6f6f2', top: '#ffffff', side: '#e2e2da' });
      fillPoly(g, [P(-3.8, .58, 9.6), P(.25, .58, 9.6), P(.25, .58, 10.85), P(-3.8, .58, 10.85)], '#dfe3e3');
      lineW(g, P(-4, .58, zb), P(.45, .58, zb), tv === 1 ? '#c9b870' : tv === 3 ? '#3a3a30' : '#ffffff');
      { const p = P(-3.2, 1.05, zb); pxRect(g, p[0], p[1], 4, 2, '#c9ccd4'); }
      windowBack(g, r, -2.8, -1.4, 2.75, 3.4);
      // shower curtain rod + curtain
      lineW(g, P(.45, 2.78, 9.45), P(-4, 2.78, 9.45), '#c9ccd4');
      for (let i = 0; i < 4; i++) fillPoly(g, [P(.2 + i * .075, .6, 9.45), P(.275 + i * .075, .6, 9.45), P(.275 + i * .075, 2.75, 9.45), P(.2 + i * .075, 2.75, 9.45)], i % 2 ? '#8fd0c4' : '#cdeee6');
      // vanity, mirror, light bar
      const mv = cond('mirror');
      fillPoly(g, Q.back(r.box, 1.3, 3.5, 1.35, 2.6), '#7e9aa0'); fillPoly(g, Q.back(r.box, 1.34, 3.46, 1.39, 2.56), '#a9c4c9');
      for (let i = 0; i < 3; i++) lineW(g, P(2 + i * .35, 2.5, zb), P(1.7 + i * .35, 1.45, zb), '#c9e0e4');
      if (mv === 1) fillPoly(g, Q.back(r.box, 1.34, 3.46, 1.39, 1.5), dither('#2a2e30', 7));
      if (mv === 2) { const c = P(2.4, 2, zb); for (let a = 0; a < 6.28; a += .4) pxRect(g, c[0] + Math.cos(a) * 5, c[1] + Math.sin(a) * 4, 1, 1, '#eef6f6'); }
      fillPoly(g, Q.back(r.box, 1.4, 3.4, 2.68, 2.86), '#b9bcc4');
      box3(g, 1.1, 3.85, 0, .85, 10.2, zb, { front: '#f2f0e6', side: '#dcd9cc', top: '#e8e2d2' });
      fillPoly(g, [P(1.12, .85, 10.18), P(3.83, .85, 10.18), P(3.83, .92, 10.18), P(1.12, .92, 10.18)], '#e8e2d2');
      for (const x of [1.2, 2.5]) fillPoly(g, [P(x, .1, 10.2), P(x + 1.2, .1, 10.2), P(x + 1.2, .74, 10.2), P(x, .74, 10.2)], '#e6e3d6');
      { const p = P(2.45, .86, 10.6); pxEllipse(g, p[0], p[1], 7, 2, '#ffffff'); pxEllipse(g, p[0], p[1], 5, 1, '#dfe3e3'); }
      // GFCI outlet
      // a few pixels bigger than a plain outlet, so the scorched one reads from across the room
      const ov = cond('outlet'), oq = Q.back(r.box, 3.54, 3.84, .96, 1.38); fillPoly(g, oq, ov === 3 ? '#e6d59a' : '#f6f3ea'); strokePoly(g, oq, '#8b8574');
      { const c = polyBox(oq); pxRect(g, c.cx - 2, c.cy - 3, 4, 2, '#c8c2b2'); pxRect(g, c.cx - 2, c.cy + 1, 4, 2, '#c8c2b2'); }   // TEST and RESET
      if (ov === 1) { const c = polyBox(oq); pxRect(g, c.cx - 3, c.cy - 4, 6, 7, 'rgba(90,58,26,0.45)'); pxRect(g, c.cx - 2, c.cy - 3, 4, 5, '#5a3a1a'); pxRect(g, c.cx - 1, c.cy - 2, 2, 2, '#2a1a0a'); }
      // toilet against the left wall
      const tlv = cond('toilet');
      if (tlv === 3) fillPoly(g, floorBlob(-3.35, 8.3, .78, .52, 13, .45, 18), rgba('#6b5232', .55));
      drawToilet(g, tlv);
      // towel bar + switch on the right wall
      { const bv = cond('towelbar'), a = P(4, 1.6, 9.95), b = bv === 2 ? P(4, 1.2, 10.5) : P(4, 1.6, 10.55);
        pxLine(g, a[0], a[1], b[0], b[1], bv === 1 ? '#a8acb4' : '#c9ccd4');
        pxRect(g, a[0] - 1, a[1] - 2, 2, 4, '#b9bcc4');
        if (bv === 2) { const h = P(4, 1.6, 10.55); fillPoly(g, blobPts(h[0], h[1], 2, 3, 6, .6, 8), '#d8d2c0'); pxRect(g, h[0], h[1], 1, 1, '#5a5040'); }
        else pxRect(g, b[0] - 1, b[1] - 2, 2, 4, '#b9bcc4'); }
      sideSwitch(g, r, 'right', 8.65, 8.95, 1.2, 1.55, !r.lightsOff); sideSwitch(g, r, 'right', 9.1, 9.4, 1.2, 1.55, !!r.ventOn);
      { const vv = cond('vent');                              // the vent fan in the ceiling
        if (vv === 3) for (let i = 0; i < 40; i++) { const p = P(.8 + hash(i) * 1.6, r.box.h, 7.1 + hash(i + 5) * 1.5); pxRect(g, p[0], p[1], 1, 1, i % 3 ? '#3a4030' : '#5a6a40'); }
        fillPoly(g, Q.ceil(r.box, 1.05, 2.15, 7.35, 8.35), '#9a968a'); fillPoly(g, Q.ceil(r.box, 1.1, 2.1, 7.4, 8.3), '#e4e2da'); fillPoly(g, Q.ceil(r.box, 1.2, 2, 7.5, 8.2), vv === 2 ? '#2a2826' : '#cfccc2');   // its frame, edged in gray
        if (vv !== 2) for (let z = 7.55; z < 8.2; z += .1) lineW(g, P(1.22, r.box.h, z), P(1.98, r.box.h, z), vv === 1 ? '#a8a49a' : '#8a877e');
        if (vv === 2) fillPoly(g, [P(1.2, r.box.h, 7.5), P(2, r.box.h, 7.5), P(2.05, r.box.h - .35, 7.8), P(1.25, r.box.h - .3, 7.85)], '#d8d6ce');
        if (vv === 1) fillPoly(g, Q.ceil(r.box, 1.2, 2, 7.5, 8.2), 'rgba(140,136,128,0.4)'); }
      cobweb(g, ...P(r.box.x1, r.box.h, r.box.zb), -1, 1, 5);
      doorOnSide(g, r, 'right', 6.6, 8.4, '#97a7b8');
    },
    dynamic(g, r, t) {
      const zb = r.box.zb, mv = cond('mirror'), mo = Settings.get('motion');
      const flick = mv === 3 && !r.lightsOff && flickerDark(t, 26, 11, .75);   // the bad light bar stutters every so often
      if (r.ventOn && mo) { const k = Math.floor(t * 14) % 2; for (let z = 7.55 + k * .05; z < 8.2; z += .1) lineW(g, P(1.24, r.box.h, z), P(1.96, r.box.h, z), '#5a574e'); }
      [1.65, 2.15, 2.65, 3.15].forEach((x, i) => { const p = P(x, 2.8, zb); pxEllipse(g, p[0], p[1] + 1, 2, 2, r.lightsOff ? '#b8b2a0' : (flick && i ? '#a8a28e' : '#fff4c8')); });
      if (!r.lightsOff && !flick) { const p = P(2.4, 2.8, zb); softGlow(g, p[0], p[1] + 8, 64, 32, '#fff4c8', .16); }
      r.flickerDark = flick;
      // the scorched GFCI spits a spark every so often while its breaker is on
      if (cond('outlet') === 1 && Utilities.on('bgfci') && mo && (t * 1.7) % 1 < .12) {
        const c = polyBox(Q.back(r.box, 3.54, 3.84, .96, 1.38)), k = Math.floor(t * 30) % 3;
        softGlow(g, c.cx, c.cy, 10, 8, '#ffe08a', .35);
        for (const [dx, dy] of [[-4, -3], [4, -2], [-3, 3], [5, 3], [0, -5]].slice(k, k + 3)) pxLine(g, c.cx, c.cy, c.cx + dx, c.cy + dy, '#fff6c0');
        pxRect(g, c.cx - 1, c.cy - 1, 2, 2, '#ffffff');
      }
    }
  },
  bedroom: {
    name: 'Bedroom', box: { x0: -6, x1: 6, h: 4, zb: 12.5 }, amb: .55,
    floor: boardsFloor, floorBase: p => p.floor[0],
    walk: { x0: -5.2, x1: 5.2, z0: 4.8, z1: 11.7 }, start: { x: 4.4, z: 9.2 },
    windows: [{ xa: 1.4, xb: 4.6, ya: 1, yb: 3, level: 5 }],
    doors: [
      { id: 'toLiving2', side: 'right', za: 8.4, zb: 10, to: 'living', name: 'Living room', walk: { x: 5.3, z: 9.2 }, spawn: { x: -4.6, z: 9 } },
      { id: 'toBath', back: [-1.6, .05], to: 'bath', name: 'Bathroom', walk: { x: -.8, z: 11.6 }, spawn: { x: 2.8, z: 7.5 } }
    ],
    features: {
      closet: { pts: () => Q.back(ROOMS.bedroom.box, -5.45, -2.15, 0, 2.85), walk: { x: -3.8, z: 11.4 } },
      window: { pts: () => Q.back(ROOMS.bedroom.box, 1.25, 4.75, .75, 3.15), walk: { x: 3, z: 11.4 } },
      bwall: { pts: () => Q.left(ROOMS.bedroom.box, 8.4, 12.3, .35, 2.7), walk: { x: -4.8, z: 10.2 } },
      smoke: { pts: () => { const c = P(1.2, 4, 8.6); return [[c[0] - 14, c[1] - 6], [c[0] + 14, c[1] - 6], [c[0] + 14, c[1] + 8], [c[0] - 14, c[1] + 8]]; }, walk: { x: 1.2, z: 7.4 } },
      dome: { pts: () => { const c = P(-1, 4, 9.6); return [[c[0] - 16, c[1] - 4], [c[0] + 16, c[1] - 4], [c[0] + 16, c[1] + 8], [c[0] - 16, c[1] + 8]]; }, walk: { x: -1, z: 8.4 } },
      bfloor: { pts: () => Q.floor(-4.8, -.6, 8.4, 11.6), walk: { x: -2.6, z: 8 } },
      closetin: { when: () => isOpen(Openables.hostOf('closetin')), pts: () => shrink(Openables.opening(DOOR[Openables.hostOf('closetin')]), .86), get walk() { const d = DOOR[Openables.hostOf('closetin')]; return d.walk || doorWalk(d); } }
    },
    scenery: [
      { id: 'rswitch', name: 'Light switch', pts: () => Q.right(ROOMS.bedroom.box, 7.7, 8.1, 1.15, 1.6), walk: { x: 5, z: 8 }, light: true, look: 'The switch for the ceiling light.' }
    ],
    walls(g, r) {
      const zb = r.box.zb;
      // closet bifold doors
      const cv = cond('closet');
      fillPoly(g, Q.back(r.box, -5.6, -2, 0, 3), '#f6f3ea');
      for (let i = 0; i < 4; i++) {
        const xa = -5.45 + i * .825, sag = cv === 1 && i >= 2 ? .06 : 0;
        fillPoly(g, Q.back(r.box, xa, xa + .8, sag, 2.85 - sag), '#f2f2ee');
        for (let y = 1.6; y < 2.7; y += .12) lineW(g, P(xa + .1, y, zb), P(xa + .7, y, zb), '#c8ccd2');
        fillPoly(g, Q.back(r.box, xa + .1, xa + .7, .2, 1.4), '#e6e8ea');
        lineW(g, P(xa + .8, 0, zb), P(xa + .8, 2.85, zb), '#b8bcc4');
      }
      if (cv === 2) { const p = P(-4.21, .85, zb); fillPoly(g, blobPts(p[0], p[1], 3.4, 3.8, 5, .5, 12), '#d6cfbd'); fillPoly(g, blobPts(p[0], p[1], 2.4, 2.8, 7, .5, 10), '#3a2a1a'); }   // lower panel of the second leaf, as in the close-up
      { const k = P(-3.6, 1.3, zb); pxRect(g, k[0], k[1], 2, 2, '#c9a227'); }
      sixPanelDoor(g, r, -1.6, .05, true);
      // window
      const wv = cond('window');
      windowBack(g, r, 1.4, 4.6, 1, 3, { sill: true, mullion: true });
      if (wv === 3) {                                                // mildew along the sill, thickest in its corners; nothing on the glass
        const a = P(1.3, .9, zb - .2), b = P(4.7, .9, zb - .2);
        speckle(g, a[0], a[1], b[0] - a[0], 2, 'rgba(36,40,28,0.6)', 22, 3);
        for (const x of [a[0], b[0] - 6]) speckle(g, x, a[1] - 1, 6, 3, 'rgba(40,52,30,0.75)', 9, 4);
        for (const x of [1.9, 3, 4.1]) { const s = P(x, .82, zb); g.fillStyle = dither('#8a7a4a', 6); g.fillRect(s[0], s[1], 2, 6); }   // water streaks under the sill
      }
      // the wall where the bed was
      const bw = cond('bwall');
      if (bw === 1) fillPoly(g, Q.left(r.box, 9, 11.6, 1.1, 1.4), dither('#6d7784', 5));
      if (bw >= 2) drawWallArt(g, r, bw);                          // the marker dinosaur or the liger: the close-up's own drawing, in perspective
      // smoke detector + dome light
      // both ceiling fixtures are soft, ceiling-toned shapes with a faint shadow rim (like the fan and the bath vent), not hard gray outlines
      { const c = P(1.2, 4, 8.6); pxEllipse(g, c[0], c[1] + 1, 8, 3, 'rgba(110,104,90,0.28)'); pxEllipse(g, c[0], c[1] + 1, 7, 2, cond('smoke') === 1 ? '#e6dcb4' : '#efece4'); pxRect(g, c[0] - 6, c[1] + 2, 12, 1, 'rgba(120,112,96,0.3)'); pxRect(g, c[0] + 3, c[1], 1, 1, 'rgba(63,154,58,0.7)'); }   // with its little green light
      { const dv = cond('dome'), c = P(-1, 4, 9.6);
        if (dv === 3) fillPoly(g, blobPts(c[0], c[1] + 1, 17, 4, 31, .4, 16), 'rgba(110,70,30,0.45)');
        pxEllipse(g, c[0], c[1] + 2, 13, 4, 'rgba(110,100,84,0.3)'); pxEllipse(g, c[0], c[1] + 2, 12, 3, dv === 1 ? '#ece2c2' : '#f3f0e6'); pxRect(g, c[0] - 11, c[1] + 4, 22, 1, 'rgba(150,140,120,0.35)'); pxRect(g, c[0] - 6, c[1] + 1, 5, 1, 'rgba(255,255,255,0.7)');   // a faint rim against the ceiling
        if (dv === 1) for (const dx of [-4, 1, 5]) pxRect(g, c[0] + dx, c[1] + 3, 1, 1, 'rgba(58,48,32,0.6)');
        if (dv === 2) { pxLine(g, c[0] - 7, c[1] + 1, c[0] + 3, c[1] + 4, 'rgba(110,100,84,0.6)'); pxRect(g, c[0] + 9, c[1] + 2, 3, 2, '#c8c2b0'); } }
      { const fv = cond('bfloor');
        if (fv === 1) for (const [x, z] of [[-3.9, 9.9], [-2.1, 9.9], [-3.9, 11.2], [-2.1, 11.2]]) { const p = P(x, 0, z); pxRect(g, p[0], p[1], 2, 1, 'rgba(40,20,10,0.5)'); }
        if (fv === 2) for (let i = 0; i < 6; i++) { const a = P(-4.4 + i * .2, 0, 9 + hash(i) * .3), b = P(-2.4 + i * .25, 0, 10.6 + hash(i + 3) * .4); pxLine(g, a[0], a[1], b[0], b[1], 'rgba(240,210,170,0.6)'); }
        if (fv === 3) { fillPoly(g, floorBlob(-1.4, 10.6, .9, .7, 51, .4, 16), 'rgba(40,20,10,0.25)'); lineW(g, P(-2.1, .06, 10.8), P(-.7, .06, 10.8), '#e8a870'); lineW(g, P(-2.1, .03, 10.95), P(-.7, .03, 10.95), 'rgba(30,10,0,0.5)'); } }
      sideSwitch(g, r, 'right', 7.75, 8.05, 1.2, 1.55, !r.lightsOff);
      outletBack(g, r, 4.9, .45); scuffs(g, r, 12); floorVent(g, -5.4, -4.6, 5.4, 5.75); cobweb(g, ...P(r.box.x0, r.box.h, zb), 1, 1, 9);
      doorOnSide(g, r, 'right', 8.4, 10, '#c9b693');
    },
    dynamic(g, r, t) {
      const wv = cond('window'), q = Q.back(r.box, 1.4, 4.6, 1, 3), b = polyBox(q);
      if (wv === 1) fillPoly(g, q, dither('#eef2f4', 8));
      if (wv === 2) { const c = P(2.4, 1.5, r.box.zb); for (let a = 0; a < 6.28; a += .7) pxLine(g, c[0], c[1], c[0] + Math.cos(a) * 9, c[1] + Math.sin(a) * 6, '#ffffff'); }
      const sv = cond('smoke'), c = P(1.2, 4, 8.6);
      if (sv !== 3 && (t % 1.4) < .18) pxRect(g, c[0] + 4, c[1] + 2, 1, 1, '#7bff6b');
      r.flickerDark = !r.lightsOff && cond('dome') === 3 && flickerDark(t, 30, 21, .75);
      if (!r.lightsOff && !r.flickerDark) { const p = P(-1, 4, 9.6); softGlow(g, p[0], p[1] + 16, 96, 36, '#fff8e6', .15); }
    }
  }
};

for (const [k, r] of Object.entries(ROOMS)) r.id = k;

/* ---------- the vignette: darker corners, dithered ---------- */
let _vig = null;
function vignette() {                 // a soft darkening toward the corners (smooth, not dithered)
  if (_vig) return _vig;
  const c = document.createElement('canvas'); c.width = SW; c.height = SH;
  const g = c.getContext('2d'), grad = g.createRadialGradient(SW / 2, SH / 2, SH * .45, SW / 2, SH / 2, SW * .62);
  grad.addColorStop(0, 'rgba(14,10,22,0)'); grad.addColorStop(1, 'rgba(14,10,22,0.28)');
  g.fillStyle = grad; g.fillRect(0, 0, SW, SH); _vig = c;
  return c;
}

const Rooms = {
  cache: {},
  invalidate(id) { if (id) delete this.cache[id]; else this.cache = {}; _vig = null; },
  def(id) { return ROOMS[id]; },
  layer(id) {
    let c = this.cache[id];
    if (!c) {
      c = document.createElement('canvas'); c.width = SW; c.height = SH;
      const g = c.getContext('2d'), r = ROOMS[id];
      ExitGlow.cur = id; ExitGlow.list[id] = []; shell(g, r); ExitGlow.cur = null;   // (its EXIT signs sign themselves up as they're drawn)
      this.cache[id] = c;
    }
    return c;
  },
  /* everything you can point at in a room, smallest first so small things win over big ones */
  hotspots(id) {
    const r = ROOMS[id], out = [];
    for (const [fid, f] of Object.entries(r.features)) if (!f.when || f.when()) out.push({ kind: 'feature', id: fid, name: FEATURE[fid].name, pts: f.pts(), walk: f.walk });
    for (const s of r.scenery) if (!s.when || s.when()) out.push({ kind: 'scenery', id: s.id, name: s.name, pts: s.pts(), walk: s.walk, data: s, live: !!s.live, ptsFn: s.pts });   // live: a person who moves, re-outlined every frame (Game.liveHots)
    for (const d of r.doors) {
      const pts = d.pts ? d.pts() : d.back ? Q.back(r.box, d.back[0], d.back[1], 0, 2.95) : (d.side === 'left' ? Q.left : Q.right)(r.box, d.za, d.zb, 0, 2.9);   // a way out that's a thing (a stair tower) outlines the thing
      out.push({ kind: 'door', id: d.id, name: d.name, pts, walk: d.walk, data: d });
    }
    out.push(...Decor.clutterHots(id), ...Openables.hots(id), ...Anomalies.hots(id));
    if (id === 'living' && Decor.cur && Decor.cur.tie && !Game.taken.has('tie')) {
      const sp = tieSpot(), p = sp.floor ? P(sp.x, 0, sp.z) : P(sp.x, FAN.y, sp.z);
      out.push({ kind: 'scenery', id: 'tie', name: 'Necktie', pts: sp.floor ? [[p[0] - 19, p[1] - 8], [p[0] + 19, p[1] - 8], [p[0] + 19, p[1] + 4], [p[0] - 19, p[1] + 4]] : [[p[0] - 6, p[1] - 4], [p[0] + 9, p[1] - 4], [p[0] + 9, p[1] + SPR_TIE_DRAPE.length], [p[0] - 6, p[1] + SPR_TIE_DRAPE.length]],
        walk: sp.floor ? { x: sp.x, z: sp.z - .6 } : { x: sp.x, z: sp.z - .4 }, data: { ...CLUTTER.tie, item: 'tie', look: sp.floor ? 'A loud necktie in a heap on the carpet, right where the fan flung it.' : CLUTTER.tie.look } });
    }
    for (const h of out) { const b = polyBox(h.pts); h.area = (b.x1 - b.x0) * (b.y1 - b.y0); h.box = b; }
    return out.sort((a, b) => (a.live ? a.area * .3 : a.area) - (b.live ? b.area * .3 : b.area));   // smallest first, but people beat the big things they stand in front of
  },
  draw(g, id, t) {
    const r = ROOMS[id];
    for (const [i, w] of r.windows.entries()) drawOutside(g, Q.back(r.box, w.xa, w.xb, w.ya, w.yb), t, i * 7 + id.length, { frosted: w.frosted });
    g.drawImage(this.layer(id), 0, 0);
    for (const w of r.windows) {                 // open blinds let in more light
      if (id === 'living') drawSun(g, r, t, Openables.amt('blinds') > .5 ? { ...w, slats: 0 } : w);
      else if (id === 'bedroom') drawSun(g, r, t, { ...w, level: (w.level ?? 5) * (.25 + .75 * Openables.amt('bblinds')) });
      else drawSun(g, r, t, w);
    }
    r.dynamic && r.dynamic(g, r, t);
    Openables.drawLive(g, r, t);
  },
  overlay(g, id, t) {
    const r = ROOMS[id];
    if (r.overlay) r.overlay(g, r, t);                              // weather over everything, outdoors (js/ambient-fx.js)
    if (r.lightsOff) { g.fillStyle = id === 'bath' ? 'rgba(14,10,24,0.62)' : 'rgba(14,10,24,0.42)'; g.fillRect(0, 0, SW, SH); for (const w of r.windows) if (!w.frosted && Decor.time.sun) fillPoly(g, sunPatch(r, w.xa, w.xb, w.ya, w.yb), rgba(Decor.time.sun, .22)); }
    Decor.tint(g, SW, SH);
    if (r.flickerDark) { g.fillStyle = id === 'bath' ? 'rgba(14,10,24,0.3)' : 'rgba(14,10,24,0.22)'; g.fillRect(0, 0, SW, SH); }
    ExitGlow.draw(g, id);
    g.drawImage(vignette(), 0, 0);
  }
};
