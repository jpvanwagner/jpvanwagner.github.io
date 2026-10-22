// Grid A* over the floor plan, with line-of-sight smoothing so walkers cut corners naturally.
import { WORLD, WALLS, TABLES, tableGeometry, KITCHEN, BAR } from '../data/layout.js';

const CELL = 0.25;
const COLS = Math.ceil(WORLD.w / CELL);
const ROWS = Math.ceil(WORLD.d / CELL);
let blocked = new Uint8Array(COLS * ROWS);

function blockRect(x0, z0, x1, z1, pad = 0) {
  const c0 = Math.max(0, Math.floor((x0 - pad) / CELL)), c1 = Math.min(COLS - 1, Math.floor((x1 + pad) / CELL));
  const r0 = Math.max(0, Math.floor((z0 - pad) / CELL)), r1 = Math.min(ROWS - 1, Math.floor((z1 + pad) / CELL));
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) blocked[r * COLS + c] = 1;
}

/** Rebuild the walkability grid (call when tables change, e.g. after an upgrade). */
export function buildGrid(activeTables) {
  blocked = new Uint8Array(COLS * ROWS);
  for (const [x0, z0, x1, z1] of WALLS) blockRect(x0, z0, x1, z1, 0.2);
  // The whole kitchen and office are off-limits to guests and runners.
  blockRect(0, 0, 18, 5.5, 0);
  // Bar counter and back bar.
  blockRect(BAR.counter.x0, BAR.counter.z0, BAR.counter.x1, BAR.counter.z1, 0.15);
  blockRect(BAR.backBar.x0, BAR.backBar.z0, BAR.backBar.x1, BAR.backBar.z1, 0.1);
  blockRect(KITCHEN.pass.x - KITCHEN.pass.w / 2, 5.3, KITCHEN.pass.x + KITCHEN.pass.w / 2, 5.95, 0.1);
  for (const t of activeTables) {
    const g = tableGeometry(t);
    if (t.kind !== 'bar') blockRect(t.x - g.hw, t.z - g.hd, t.x + g.hw, t.z + g.hd, 0.2);
  }
  // Host stand.
  blockRect(4.0, 15.9, 4.8, 16.5, 0.1);
}
buildGrid(TABLES.filter((t) => !t.upgrade));

const idx = (c, r) => r * COLS + c;
const free = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && !blocked[idx(c, r)];

function nearestFree(c, r) {
  if (free(c, r)) return [c, r];
  for (let rad = 1; rad < 12; rad++) {
    for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
      if (Math.max(Math.abs(dr), Math.abs(dc)) === rad && free(c + dc, r + dr)) return [c + dc, r + dr];
    }
  }
  return [c, r];
}

function lineOfSight(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const steps = Math.ceil(Math.hypot(dx, dz) / (CELL * 0.5));
  for (let i = 1; i < steps; i++) {
    const x = a.x + (dx * i) / steps, z = a.z + (dz * i) / steps;
    if (!free(Math.floor(x / CELL), Math.floor(z / CELL))) return false;
  }
  return true;
}

/** Returns a list of {x,z} waypoints from `from` to `to` (to is always the last point). */
export function findPath(from, to) {
  const [sc, sr] = nearestFree(Math.floor(from.x / CELL), Math.floor(from.z / CELL));
  const [gc, gr] = nearestFree(Math.floor(to.x / CELL), Math.floor(to.z / CELL));
  const start = idx(sc, sr), goal = idx(gc, gr);
  const g = new Float32Array(COLS * ROWS).fill(Infinity);
  const came = new Int32Array(COLS * ROWS).fill(-1);
  const closed = new Uint8Array(COLS * ROWS);
  const open = [start];
  g[start] = 0;
  const h = (i) => { const c = i % COLS, r = (i / COLS) | 0; return Math.hypot(c - gc, r - gr); };
  const f = new Float32Array(COLS * ROWS).fill(Infinity);
  f[start] = h(start);
  let found = false;
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
    const cur = open[bi];
    open[bi] = open[open.length - 1]; open.pop();
    if (cur === goal) { found = true; break; }
    if (closed[cur]) continue;
    closed[cur] = 1;
    const c = cur % COLS, r = (cur / COLS) | 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nc = c + dc, nr = r + dr;
      if (!free(nc, nr)) continue;
      if (dr && dc && (!free(c + dc, r) || !free(c, r + dr))) continue; // no corner cutting
      const ni = idx(nc, nr);
      const ng = g[cur] + (dr && dc ? 1.4142 : 1);
      if (ng < g[ni]) { g[ni] = ng; f[ni] = ng + h(ni); came[ni] = cur; open.push(ni); }
    }
  }
  if (!found) return [{ x: to.x, z: to.z }];
  const cells = [];
  for (let i = goal; i !== -1; i = came[i]) cells.push({ x: (i % COLS + 0.5) * CELL, z: (((i / COLS) | 0) + 0.5) * CELL });
  cells.reverse();
  // String-pull: keep only waypoints we can't see past.
  const out = [];
  let anchor = { x: from.x, z: from.z };
  for (let i = 1; i < cells.length; i++) {
    if (!lineOfSight(anchor, cells[i])) { out.push(cells[i - 1]); anchor = cells[i - 1]; }
  }
  out.push({ x: to.x, z: to.z });
  return out;
}

export const isFreeAt = (x, z) => free(Math.floor(x / CELL), Math.floor(z / CELL));
