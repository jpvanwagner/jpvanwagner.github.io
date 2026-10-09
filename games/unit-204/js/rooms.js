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
function floorEllipse(cx, cz, rx, rz, n = 20) { const o = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; o.push(P(cx + Math.cos(a) * rx, 0, cz + Math.sin(a) * rz)); } return o; }
function clipDo(g, pts, fn) { g.save(); poly(g, pts); g.clip(); fn(); g.restore(); }
function speckPoly(g, pts, color, density, seed) { const b = polyBox(pts); clipDo(g, pts, () => speckle(g, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, color, (b.x1 - b.x0) * (b.y1 - b.y0) * density, seed)); }
function lineW(g, a, b, c) { pxLine(g, a[0], a[1], b[0], b[1], c); }
function cutOut(g, pts) { g.save(); g.globalCompositeOperation = 'destination-out'; fillPoly(g, pts, '#000'); g.restore(); }

/* ---------- shared pieces ---------- */
function shell(g, r) {
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
  Decor.drawExtras(g, r);
}
function carpetFloor(g, r, p) {
  const f = p.floor;
  for (let i = 0; i < 7; i++) { const cx = (hash(i + 3) - .5) * 10, cz = 4 + hash(i + 8) * 8; fillPoly(g, floorEllipse(cx, cz, 1 + hash(i) * 1.6, .6 + hash(i + 1) * .8), rgba(i % 2 ? f.lt : f.dk, .35)); }   // tonal patches
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
    const { x0, x1, zb } = r.box, [a, b, grout] = p.floor;
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
  fillPoly(g, Q.back(r.box, xa, xb, 0, 2.9), '#ece7da');
  for (let c = 0; c < 2; c++) for (const [ya, yb] of [[.25, 1.25], [1.45, 2.2], [2.35, 2.75]]) {
    const pa = xa + w * (.12 + c * .44), pb = pa + w * .32;
    fillPoly(g, Q.back(r.box, pa, pb, ya, yb), '#e0dacb'); lineW(g, P(pa, yb, zb), P(pb, yb, zb), '#c8c1b0'); lineW(g, P(pa, ya, zb), P(pa, yb, zb), '#c8c1b0');
  }
  if (ajar) fillPoly(g, Q.back(r.box, xb - .08, xb, 0, 2.9), '#2a2630');
  const k = P(xb - .18, 1.2, zb); pxRect(g, k[0] - 1, k[1] - 1, 3, 3, '#c9a227'); pxRect(g, k[0] - 1, k[1] - 1, 1, 1, '#f2d870');
}
function windowBack(g, r, xa, xb, ya, yb, opts = {}) {
  const tr = '#f8f6ef';
  fillPoly(g, Q.back(r.box, xa - .14, xb + .14, ya - .14, yb + .12), tr);
  if (opts.sill) { const zb = r.box.zb; box3(g, xa - .25, xb + .25, ya - .2, ya - .12, zb - .22, zb, { front: '#ffffff', top: '#e8e4d8', side: '#e0dccf' }); }
  cutOut(g, Q.back(r.box, xa, xb, ya, yb));
  if (opts.mullion) { const ym = (ya + yb) / 2; fillPoly(g, Q.back(r.box, xa, xb, ym - .05, ym + .05), tr); }
}
function lightSwitch(g, r, x, y) { const q = Q.back(r.box, x, x + .18, y, y + .3); fillPoly(g, q, '#f2ecdc'); strokePoly(g, q, '#a8a08c'); const c = polyBox(q); pxRect(g, c.cx - 1, c.cy - 2, 2, 3, '#e6dcc4'); }
function outletBack(g, r, x, y) { const q = Q.back(r.box, x, x + .16, y, y + .24); fillPoly(g, q, '#f2ecdc'); strokePoly(g, q, '#a8a08c'); }

/* ---------- outside: sky, buildings and a swaying oak, seen through every window ---------- */
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
    for (let i = 0; i < 34; i++) {
      const lx = tx - w * .25 + hash(seed + i) * w * .75 + sway * (.6 + hash(i + 3) * .7) + sway2 * hash(i + 5), ly = b.y0 - 2 + hash(seed + i + 9) * h * .62;
      const lc = Decor.pal(Game.room).leaves;
      pxEllipse(g, lx, ly, 3 + hash(i + 4) * 3, 2 + hash(i + 7) * 2, lc[(i * 7 + seed) % lc.length]);
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
  if (w.shaft !== false) fillPoly(g, hull([...glass, ...patch]), rgba(T.sun, .07));
  const pools = w.slats ? Array.from({ length: w.slats }, (_, i) => { const st = (w.xb - w.xa) / w.slats; return sunPatch(r, w.xa + i * st + st * .55, w.xa + (i + 1) * st, w.ya, w.yb); }) : [patch];
  for (const pp of pools) { fillPoly(g, pp, rgba(T.sun, a * .55)); fillPoly(g, shrink(pp, .78), rgba(T.sun, a * .6)); }   // two flat bands
  if (Settings.get('motion') && !w.frosted) clipDo(g, patch, () => {
    const b = polyBox(patch);
    for (let i = 0; i < 9; i++) {
      const lx = b.x0 + hash(i + w.xa) * (b.x1 - b.x0) + Math.sin(t * .8 + i) * 3, ly = b.y0 + hash(i + 7 + w.xa) * (b.y1 - b.y0) + Math.cos(t * .6 + i) * 1.5;
      g.fillStyle = rgba(T.shadow, .2); g.beginPath(); g.ellipse(lx, ly, 6 + hash(i) * 6, 2 + hash(i + 1) * 2, 0, 0, 7); g.fill();
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
      { id: 'frontDoor', back: [-5.4, -3.6], name: 'Front door', exit: true, walk: { x: -4.5, z: 12 } }
    ],
    features: {
      carpet: { pts: () => Q.floor(-2.7, 2.7, 7, 10.6), walk: { x: 0, z: 6.6 } },
      tvwall: { pts: () => Q.back(ROOMS.living.box, -2.1, 2.2, .9, 3.25), walk: { x: .1, z: 11.8 } },
      fan: { pts: () => [P(-1.4, 4, 9.4), P(2.2, 4, 9.4), P(2.2, 2.8, 9.4), P(-1.4, 2.8, 9.4)], walk: { x: .4, z: 8 } }
    },
    scenery: [
      { id: 'thermo', name: 'Thermostat', pts: () => Q.back(ROOMS.living.box, -2.85, -2.35, 1.75, 2.15), walk: { x: -2.6, z: 11.8 },
        look: 'A beige digital thermostat, set to a responsible 68.', touch: 'You nudge it to 70. Then back to 68. Company policy.', smell: 'Smells like warm plastic.' },
      { id: 'switch', name: 'Light switch', pts: () => Q.back(ROOMS.living.box, -3.4, -3.05, 1.2, 1.7), walk: { x: -3.2, z: 11.8 }, light: true,
        look: 'A rocker switch for the overhead lights. Very 2008.' },
      { id: 'blinds', name: 'Vertical blinds', pts: () => Q.back(ROOMS.living.box, 2.6, 5.6, 0, 3.05), walk: { x: 4, z: 11.6 },
        look: 'Vertical blinds over the sliding door to the balcony. The oak out there never sits still.', touch: 'Clack-clack-clack. All the slats are still there. A minor miracle.', smell: 'Dust and sunshine.', talk: 'You tell the blinds they look great. They clatter shyly.' },
      { id: 'dvd', name: 'DVD case', pts: () => Q.floor(-3.6, -2.8, 10.2, 10.9), walk: { x: -3.2, z: 9.6 },
        look: "An empty blue-and-yellow rental case. 'Transformers.' Seventeen days overdue.", touch: 'You pick it up. Empty. You put it back. Not your problem.', smell: 'Movie-night popcorn, faintly.' }
    ],
    walls(g, r) {
      const zb = r.box.zb;
      // where the TV used to hang
      const v = cond('tvwall');
      if (v !== 3) fillPoly(g, Q.back(r.box, -1.3, 1.5, 1.5, 2.8), mix(Decor.pal('living').back, '#ffffff', .14));
      if (v === 0) for (const x of [-1, -.4, .3, 1]) { const p = P(x, 2.95, zb); pxRect(g, p[0], p[1], 1, 1, '#5a4a38'); }
      if (v === 1 && !flags('tvwall').removed) for (const [x, y] of [[-.6, 2.5], [.8, 2.5], [-.6, 1.8], [.8, 1.8]]) { const p = P(x, y, zb); pxRect(g, p[0] - 1, p[1] - 1, 2, 2, '#ffffff'); }
      if (v === 1 && flags('tvwall').removed) for (const [x, y] of [[-.6, 2.5], [.8, 2.5], [-.6, 1.8], [.8, 1.8]]) { const p = P(x, y, zb); pxRect(g, p[0], p[1], 1, 1, '#4a3a2a'); }
      if (v === 2) for (const [x, y] of [[-.4, 2.2], [.7, 2.2]]) { const p = P(x, y, zb); pxEllipse(g, p[0], p[1], 3, 2, '#f2e8d4'); pxEllipse(g, p[0], p[1], 2, 1, '#3a2f28'); }
      outletBack(g, r, 1.3, .45);
      sixPanelDoor(g, r, -5.4, -3.6);
      { const p = P(-4.5, 2.15, zb); pxRect(g, p[0], p[1], 1, 1, '#555'); const d = P(-3.78, 1.55, zb); pxRect(g, d[0] - 1, d[1], 2, 2, '#c9a227'); }
      lightSwitch(g, r, -3.32, 1.3);
      fillPoly(g, Q.back(r.box, -2.8, -2.4, 1.8, 2.1), '#ece2c8'); { const c = polyBox(Q.back(r.box, -2.75, -2.45, 1.92, 2.04)); pxRect(g, c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0, '#8fc49a'); }
      // sliding door frame + blinds
      fillPoly(g, Q.back(r.box, 2.6, 5.6, 0, 3.05), '#c0c4cc'); cutOut(g, Q.back(r.box, 2.7, 5.5, .05, 2.95));
      fillPoly(g, Q.back(r.box, 4.06, 4.14, .05, 2.95), '#a9aeb8');
      fillPoly(g, Q.back(r.box, 2.55, 5.65, 2.9, 3.1), '#f2efe6');
      for (let i = 0; i < 9; i++) { const xa = 2.7 + i * (2.8 / 9); fillPoly(g, Q.back(r.box, xa, xa + 2.8 / 9 * .55, .12, 2.9), i % 2 ? '#efeadf' : '#e6e0d2'); }
      doorOnSide(g, r, 'left', 8.2, 9.8, '#6e6a72');
      doorOnSide(g, r, 'right', 8.6, 10.6, '#d9c890');
      // carpet condition seen from the room
      const c = cond('carpet');
      if (c === 0) for (let x = -5.5; x < 5.5; x += 1.1) fillPoly(g, Q.floor(x, x + .55, 3.5, 12.8), dither('#efe0bb', 3));
      if (c === 1) fillPoly(g, [P(-5.1, 0, 12.8), P(-3.9, 0, 12.8), P(.9, 0, 4.2), P(-.7, 0, 4.2)], dither('#857a66', 6));
      if (c === 2) { fillPoly(g, floorEllipse(.2, 8.7, 1.1, .7), dither('#7a6642', 9)); fillPoly(g, floorEllipse(.15, 8.7, .7, .45), '#7d6a44'); }
      if (c === 3) for (const [x, z] of [[3.4, 11.9], [3.9, 12.2], [4.3, 11.7]]) { const p = P(x, 0, z); pxRect(g, p[0], p[1], 2, 1, '#2a1a10'); }
      // the DVD case
      fillPoly(g, Q.floor(-3.55, -2.85, 10.25, 10.85), '#1a3a8a'); fillPoly(g, Q.floor(-3.5, -2.9, 10.65, 10.8), '#f2c418');
    },
    dynamic(g, r, t) {
      // ceiling fan
      const fv = cond('fan'), fl = flags('fan'), cx = .4, cz = 9.4, h = r.box.h;
      const wob = (fv === 2 && fl.wobble && t - fl.wobble < 2.6) ? Math.sin(t * 22) * .12 : 0, drop = fv === 2 ? .07 : 0;
      const spinning = fl.spin || (fv === 2 && fl.wobble && t - fl.wobble < 2.6);
      const c0 = P(cx, h - drop, cz), c1 = P(cx + wob, 3.45, cz);
      pxRect(g, c0[0] - 5, c0[1], 10, 3, '#b9bcc4'); if (fv === 2) pxRect(g, c0[0] - 5, c0[1] - 2, 10, 2, '#3a3430');
      pxLine(g, c0[0], c0[1] + 2, c1[0], c1[1], '#8d93a1', 2);
      const ang = spinning ? t * 9 : .4, blades = [];
      for (let i = 0; i < 5; i++) blades.push(ang + i * Math.PI * 2 / 5);
      blades.sort((a, b) => Math.sin(a) - Math.sin(b));
      for (const a of blades) {
        const tip = P(cx + wob + Math.cos(a) * 1.7, 3.42 - (fv === 1 ? .06 : 0), cz + Math.sin(a) * 1.7), base = P(cx + wob + Math.cos(a) * .3, 3.44, cz + Math.sin(a) * .3);
        const side = Math.sin(a) < 0 ? (fv === 1 ? '#b99c76' : '#a0703c') : (fv === 1 ? '#9c805c' : '#7a5228');
        pxLine(g, base[0], base[1], tip[0], tip[1], side, 3); pxLine(g, base[0], base[1] - 1, tip[0], tip[1] - 1, '#5e3e20');
      }
      pxEllipse(g, c1[0], c1[1], 6, 2, '#9ea2ac'); pxEllipse(g, c1[0], c1[1] + 5, 5, 3, '#f1ece0');
      if (!r.lightsOff) { g.fillStyle = dither('#fff6d8', 1); g.beginPath(); g.ellipse(c1[0], c1[1] + 12, 50, 18, 0, 0, 7); g.fill(); }
    }
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
      stove: { pts: () => hull(boxPts(2.15, 3.45, 0, 1.2, 11.1, 12)), walk: { x: 2.8, z: 10.2 } }
    },
    scenery: [
      { id: 'fridge', name: 'Fridge', pts: () => hull(boxPts(3.6, 5, 0, 2.85, 10.9, 12)), walk: { x: 4, z: 10.2 },
        look: 'A black side-by-side fridge. Empty, except for a single packet of soy sauce.', touch: 'The door seals with a satisfying fwump. Cold and clean.', smell: 'Baking soda. Someone left the box in. Bless them.', talk: "You ask the fridge what's new. It hums." },
      { id: 'calendar', name: 'Wall calendar', pts: () => Q.left(ROOMS.kitchen.box, 10.2, 11, 1.5, 2.5), walk: { x: -4.2, z: 10.2 },
        look: "A free pizza-place calendar, still on October 2008. Someone circled the 9th: 'MOVE OUT!!!'", touch: 'You flip ahead a month. Nobody will know.' },
      { id: 'kswitch', name: 'Light switch', pts: () => Q.left(ROOMS.kitchen.box, 7.4, 7.8, 1.15, 1.6), walk: { x: -4.2, z: 7.6 }, light: true,
        look: 'The switch for the fluorescent light.' }
    ],
    walls(g, r) {
      const zb = r.box.zb;
      fillPoly(g, Q.back(r.box, -5, 2.1, .9, 1.45), '#d8cfb8');                 // backsplash
      // upper cabinets
      for (const [xa, xb] of [[-5, -.95], [1.55, 2.15]]) {
        box3(g, xa, xb, 2.05, 3.55, 11.6, zb, { front: '#b48048', side: '#9a6a38' });
        for (let x = xa + .05; x < xb - .1; x += .95) { const xe = Math.min(x + .9, xb - .05); fillPoly(g, [P(x + .08, 2.15, 11.6), P(xe - .08, 2.15, 11.6), P(xe - .08, 3.45, 11.6), P(x + .08, 3.45, 11.6)], '#a8743f'); const k = P(xe - .16, 2.3, 11.6); pxRect(g, k[0], k[1], 1, 2, '#d9c27a'); }
      }
      windowBack(g, r, -.7, 1.3, 1.5, 2.85, { mullion: true });
      fillPoly(g, Q.back(r.box, -.85, 1.45, 2.85, 3.05), '#c2603a');           // a valance, very 2008
      // range hood
      box3(g, 2.15, 3.45, 2.3, 2.7, 11.45, zb, { front: '#c3c7ce', side: '#9a9ea8', bottom: '#7d8290' });
      // lower cabinets + countertop
      box3(g, -5, 2.1, 0, .88, 11.05, zb, { front: '#b48048', side: '#9a6a38' });
      for (let x = -4.95; x < 2; x += .8) { fillPoly(g, [P(x + .06, .1, 11.05), P(x + .74, .1, 11.05), P(x + .74, .62, 11.05), P(x + .06, .62, 11.05)], '#a8743f'); fillPoly(g, [P(x + .06, .67, 11.05), P(x + .74, .67, 11.05), P(x + .74, .84, 11.05), P(x + .06, .84, 11.05)], '#a8743f'); }
      box3(g, -5.05, 2.15, .88, .96, 10.95, zb, { front: '#8a8174', top: '#7d7468', side: '#6e665a' });
      speckPoly(g, [P(-5.05, .96, 10.95), P(2.15, .96, 10.95), P(2.15, .96, zb), P(-5.05, .96, zb)], '#5e564c', .5, 8);
      const sv = cond('sink');
      if (sv === 3) fillPoly(g, [P(-1, .05, 11.05), P(1.6, .05, 11.05), P(1.6, .2, 11.05), P(-1, .2, 11.05)], dither('#4f3218', 8));
      fillPoly(g, [P(-.55, .96, 11.25), P(1.15, .96, 11.25), P(1.15, .96, 11.8), P(-.55, .96, 11.8)], '#a9aeb7');
      fillPoly(g, [P(-.5, .96, 11.32), P(.25, .96, 11.32), P(.25, .96, 11.74), P(-.5, .96, 11.74)], '#7f848e');
      fillPoly(g, [P(.35, .96, 11.32), P(1.1, .96, 11.32), P(1.1, .96, 11.74), P(.35, .96, 11.74)], '#7f848e');
      { const a = P(.3, .96, 11.9), b = P(.3, 1.45, 11.9), c = P(.3, 1.45, 11.55); pxLine(g, a[0], a[1], b[0], b[1], '#d9dce4', 2); pxLine(g, b[0], b[1], c[0], c[1], '#d9dce4', 2); }
      if (sv === 2) { const p = P(1.85, 1.15, zb); pxRect(g, p[0], p[1], 3, 4, '#ece2c8'); pxRect(g, p[0] + 1, p[1] + 1, 1, 1, '#5a5040'); } else { const p = P(1.85, 1.15, zb); pxRect(g, p[0], p[1], 3, 4, '#ece2c8'); pxRect(g, p[0] + 1, p[1], 1, 2, '#d8ccb0'); }
      const cv = cond('counter');
      if (cv === 2) fillPoly(g, [P(-3.4, .961, 11.3), P(-2.6, .961, 11.3), P(-2.6, .961, 11.75), P(-3.4, .961, 11.75)], dither('#3a2410', 9));
      if (cv === 3) fillPoly(g, [P(-2, .88, 10.95), P(-1.7, .88, 10.95), P(-1.75, .96, 10.95), P(-1.95, .96, 10.95)], '#c8a878');
      if (cv === 1) fillPoly(g, [P(1.2, .961, 11.1), P(2, .961, 11.1), P(2, .961, 11.6), P(1.2, .961, 11.6)], dither('#b0a898', 5));
      // the red DVD-by-mail envelope
      fillPoly(g, [P(-4.4, .962, 11.3), P(-3.9, .962, 11.3), P(-3.9, .962, 11.6), P(-4.4, .962, 11.6)], '#c1121f');
      // range
      const stv = cond('stove');
      box3(g, 2.15, 3.45, 0, .92, 11.15, zb, { front: '#1c1d21', top: '#2a2b30', side: '#141518' });
      fillPoly(g, Q.back(r.box, 2.15, 3.45, .92, 1.2), '#2a2b30');
      for (const [x, z] of [[2.45, 11.4], [3.15, 11.4], [2.45, 11.8], [3.15, 11.8]]) { const p = P(x, .93, z); pxEllipse(g, p[0], p[1], 3, 1, '#3c3e44'); }
      fillPoly(g, [P(2.3, .2, 11.15), P(3.3, .2, 11.15), P(3.3, .65, 11.15), P(2.3, .65, 11.15)], '#0f1013');
      for (let i = 0; i < 4; i++) { const p = P(2.3 + i * .32, .8, 11.15); pxRect(g, p[0], p[1], 2, 2, stv === 2 && i === 0 ? '#3a2a1a' : '#c9ccd4'); }
      // fridge
      box3(g, 3.6, 5, 0, 2.85, 10.9, zb, { front: '#23252b', side: '#1a1b20', top: '#2e3038' });
      fillPoly(g, [P(4.27, 0, 10.9), P(4.33, 0, 10.9), P(4.33, 2.85, 10.9), P(4.27, 2.85, 10.9)], '#0f1013');
      for (const x of [4.15, 4.45]) { const a = P(x, 1.1, 10.88), b = P(x, 2.1, 10.88); pxLine(g, a[0], a[1], b[0], b[1], '#c9ccd4', 2); }
      fillPoly(g, [P(3.75, 1.6, 10.9), P(4.05, 1.6, 10.9), P(4.05, 1.95, 10.9), P(3.75, 1.95, 10.9)], '#3a3c44');
      // calendar + switch on the left wall
      fillPoly(g, Q.left(r.box, 10.25, 10.95, 1.55, 2.45), '#ffffff'); fillPoly(g, Q.left(r.box, 10.25, 10.95, 2.1, 2.45), '#d64545');
      for (let i = 0; i < 4; i++) fillPoly(g, Q.left(r.box, 10.3, 10.9, 1.62 + i * .12, 1.66 + i * .12), '#c8ccd8');
      fillPoly(g, Q.left(r.box, 7.45, 7.75, 1.2, 1.55), '#f2ecdc');
      doorOnSide(g, r, 'left', 8, 9.8, '#cdb996');
      // fluorescent ceiling box
      fillPoly(g, Q.ceil(r.box, -1, 1.2, 7.5, 9.5), '#d0d4d8'); fillPoly(g, Q.ceil(r.box, -.9, 1.1, 7.6, 9.4), '#f8fbff');
    },
    dynamic(g, r, t) {
      if (!r.lightsOff && Settings.get('motion') && Math.sin(t * 13) > .985) fillPoly(g, Q.ceil(r.box, -.9, 1.1, 7.6, 9.4), '#c8ccd2');   // fluorescent flutter
      if (!r.lightsOff) { g.fillStyle = dither('#f6fbff', 2); fillPoly(g, Q.floor(-2, 2.3, 5, 10), dither('#f6fbff', 2)); }
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
      toilet: { pts: () => hull([...boxPts(-4, -3.65, .7, 1.5, 7.8, 8.8), ...boxPts(-3.7, -2.95, 0, .78, 7.95, 8.65)]), walk: { x: -2.4, z: 8.3 } },
      outlet: { pts: () => Q.back(ROOMS.bath.box, 3.5, 3.92, .92, 1.42), walk: { x: 3.1, z: 9.4 } }
    },
    scenery: [
      { id: 'towel', name: 'Towel bar', pts: () => Q.right(ROOMS.bath.box, 9, 10.5, 1.4, 1.8), walk: { x: 3, z: 9 },
        look: 'A towel bar with no towel. They took the towels. And the toilet paper. And the roll.', touch: 'Solidly anchored. One thing in here nobody broke.' },
      { id: 'bswitch', name: 'Light switch', pts: () => Q.right(ROOMS.bath.box, 8.6, 9, 1.15, 1.6), walk: { x: 3, z: 8.6 }, light: true, look: 'The switch for the vanity light.' },
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
      if (tv === 2) for (const [x, y] of [[-2.6, 1.6], [-.9, 1.2]]) { const p = P(x, y, zb); pxLine(g, p[0] - 2, p[1] - 2, p[0] + 2, p[1] + 2, '#8a8a80'); pxLine(g, p[0] + 2, p[1] - 2, p[0] - 2, p[1] + 2, '#8a8a80'); }
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
      const ov = cond('outlet'), oq = Q.back(r.box, 3.58, 3.8, 1, 1.32); fillPoly(g, oq, ov === 3 ? '#e6d59a' : '#f6f3ea'); strokePoly(g, oq, '#8b8574');
      if (ov === 1) { const c = polyBox(oq); pxRect(g, c.cx - 1, c.cy - 2, 2, 3, '#5a3a1a'); }
      // toilet against the left wall
      const tlv = cond('toilet');
      if (tlv === 3) fillPoly(g, floorEllipse(-3.4, 8.3, .8, .55), dither('#6b5232', 9));
      box3(g, -4, -3.65, .72, 1.45, 7.85, 8.75, { front: '#f6f6f2', side: '#e2e2da', top: '#ffffff' });
      box3(g, -4, -3.6, 1.45, 1.52, 7.82, 8.78, { front: '#ffffff', side: '#e8e8e2', top: '#f6f6f2' });
      if (tlv === 2) { const a = P(-3.8, 1.52, 8.1), b = P(-3.8, 1.52, 8.5); pxLine(g, a[0], a[1], b[0], b[1], '#6a6a62'); }
      box3(g, -3.7, -3.0, 0, .55, 8.05, 8.55, { front: '#f2f2ec', side: '#e2e2da', top: '#f6f6f2' });
      box3(g, -3.75, -2.92, .55, .66, 7.95, 8.65, { front: '#ffffff', side: '#ececE6', top: '#f8f8f4' });
      // towel bar + switch on the right wall
      lineW(g, P(4, 1.6, 9.1), P(4, 1.6, 10.4), '#c9ccd4');
      fillPoly(g, Q.right(r.box, 8.65, 8.95, 1.2, 1.55), '#f2ecdc');
      doorOnSide(g, r, 'right', 6.6, 8.4, '#97a7b8');
    },
    dynamic(g, r, t) {
      const zb = r.box.zb, mv = cond('mirror'), mo = Settings.get('motion');
      const flick = mv === 3 && mo && (Math.sin(t * 31) > .55 || Math.sin(t * 7.3) > .9);
      [1.65, 2.15, 2.65, 3.15].forEach((x, i) => { const p = P(x, 2.8, zb); pxEllipse(g, p[0], p[1] + 1, 2, 2, r.lightsOff ? '#b8b2a0' : (flick && i ? '#a8a28e' : '#fff4c8')); });
      if (!r.lightsOff && !flick) { g.fillStyle = dither('#fff4c8', 2); g.beginPath(); const p = P(2.4, 2.8, zb); g.ellipse(p[0], p[1] + 10, 46, 24, 0, 0, 7); g.fill(); }
      r.flickerDark = flick;
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
      smoke: { pts: () => { const c = P(1.2, 4, 8.6); return [[c[0] - 14, c[1] - 6], [c[0] + 14, c[1] - 6], [c[0] + 14, c[1] + 8], [c[0] - 14, c[1] + 8]]; }, walk: { x: 1.2, z: 7.4 } }
    },
    scenery: [
      { id: 'ceilLight', name: 'Ceiling light', pts: () => { const c = P(-1, 4, 9.6); return [[c[0] - 16, c[1] - 4], [c[0] + 16, c[1] - 4], [c[0] + 16, c[1] + 7], [c[0] - 16, c[1] + 7]]; }, walk: { x: -1, z: 8.4 },
        look: 'A frosted dome ceiling light. Builders bought these by the shipping container.', touch: "You can't reach it. You're an inspector, not a basketball player." },
      { id: 'dents', name: 'Floor dents', pts: () => Q.floor(-4.2, -1.8, 9.6, 11.4), walk: { x: -3, z: 9.2 },
        look: 'Four little dents in the laminate where a bed frame stood. Furniture feet. Expected.', touch: 'Shallow. They come with any floor that had furniture on it.' },
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
      if (cv === 2) { const p = P(-4.9, 1, zb); pxEllipse(g, p[0], p[1], 3, 3, '#3a2a1a'); }
      { const k = P(-3.6, 1.3, zb); pxRect(g, k[0], k[1], 2, 2, '#c9a227'); }
      sixPanelDoor(g, r, -1.6, .05, true);
      // window
      const wv = cond('window');
      windowBack(g, r, 1.4, 4.6, 1, 3, { sill: true, mullion: true });
      if (wv === 3) { const a = P(1.2, .86, zb - .2), b = P(4.8, .86, zb - .2); speckle(g, a[0], a[1] - 2, b[0] - a[0], 4, '#1a1a14', 50, 3); }
      // the wall where the bed was
      const bw = cond('bwall');
      if (bw === 1) fillPoly(g, Q.left(r.box, 9, 11.6, 1.1, 1.4), dither('#6d7784', 5));
      if (bw === 2) { const pts = Q.left(r.box, 9.6, 11.2, .9, 2.1), b = polyBox(pts); g.save(); poly(g, pts); g.clip(); for (let i = 0; i < 9; i++) pxLine(g, b.x0 + hash(i) * (b.x1 - b.x0), b.y0 + hash(i + 4) * (b.y1 - b.y0), b.x0 + hash(i + 8) * (b.x1 - b.x0), b.y0 + hash(i + 2) * (b.y1 - b.y0), '#7b3fc4'); g.restore(); }
      // smoke detector + dome light
      { const c = P(1.2, 4, 8.6); pxEllipse(g, c[0], c[1] + 1, 7, 2, cond('smoke') === 1 ? '#ddd2a2' : '#f4f4ee'); pxRect(g, c[0] - 7, c[1] + 2, 14, 1, '#b8b8b0'); }
      { const c = P(-1, 4, 9.6); pxEllipse(g, c[0], c[1] + 2, 12, 3, '#f8f4e8'); pxRect(g, c[0] - 12, c[1] + 4, 24, 1, '#c8c2b0'); }
      fillPoly(g, Q.right(r.box, 7.75, 8.05, 1.2, 1.55), '#f2ecdc');
      doorOnSide(g, r, 'right', 8.4, 10, '#c9b693');
    },
    dynamic(g, r, t) {
      const wv = cond('window'), q = Q.back(r.box, 1.4, 4.6, 1, 3), b = polyBox(q);
      if (wv === 1) fillPoly(g, q, dither('#eef2f4', 8));
      if (wv === 2) { const c = P(2.4, 1.5, r.box.zb); for (let a = 0; a < 6.28; a += .7) pxLine(g, c[0], c[1], c[0] + Math.cos(a) * 9, c[1] + Math.sin(a) * 6, '#ffffff'); }
      const sv = cond('smoke'), c = P(1.2, 4, 8.6);
      if (sv !== 3 && (t % 1.4) < .18) pxRect(g, c[0] + 4, c[1] + 2, 1, 1, '#7bff6b');
      if (!r.lightsOff) { g.fillStyle = dither('#fff8e6', 2); g.beginPath(); const p = P(-1, 4, 9.6); g.ellipse(p[0], p[1] + 22, 70, 26, 0, 0, 7); g.fill(); }
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
      shell(g, r);
      this.cache[id] = c;
    }
    return c;
  },
  /* everything you can point at in a room, smallest first so small things win over big ones */
  hotspots(id) {
    const r = ROOMS[id], out = [];
    for (const [fid, f] of Object.entries(r.features)) out.push({ kind: 'feature', id: fid, name: FEATURE[fid].name, pts: f.pts(), walk: f.walk });
    for (const s of r.scenery) out.push({ kind: 'scenery', id: s.id, name: s.name, pts: s.pts(), walk: s.walk, data: s });
    for (const d of r.doors) {
      const pts = d.back ? Q.back(r.box, d.back[0], d.back[1], 0, 2.95) : (d.side === 'left' ? Q.left : Q.right)(r.box, d.za, d.zb, 0, 2.9);
      out.push({ kind: 'door', id: d.id, name: d.name, pts, walk: d.walk, data: d });
    }
    out.push(...Decor.clutterHots(id));
    for (const h of out) { const b = polyBox(h.pts); h.area = (b.x1 - b.x0) * (b.y1 - b.y0); h.box = b; }
    return out.sort((a, b) => a.area - b.area);
  },
  draw(g, id, t) {
    const r = ROOMS[id];
    for (const [i, w] of r.windows.entries()) drawOutside(g, Q.back(r.box, w.xa, w.xb, w.ya, w.yb), t, i * 7 + id.length, { frosted: w.frosted });
    g.drawImage(this.layer(id), 0, 0);
    for (const w of r.windows) drawSun(g, r, t, w);
    r.dynamic && r.dynamic(g, r, t);
  },
  overlay(g, id, t) {
    const r = ROOMS[id];
    if (r.lightsOff) { g.fillStyle = id === 'bath' ? 'rgba(14,10,24,0.62)' : 'rgba(14,10,24,0.42)'; g.fillRect(0, 0, SW, SH); for (const w of r.windows) if (!w.frosted && Decor.time.sun) fillPoly(g, sunPatch(r, w.xa, w.xb, w.ya, w.yb), rgba(Decor.time.sun, .22)); }
    Decor.tint(g, SW, SH);
    if (r.flickerDark) { g.fillStyle = 'rgba(14,10,24,0.45)'; g.fillRect(0, 0, SW, SH); }
    g.drawImage(vignette(), 0, 0);
  }
};
