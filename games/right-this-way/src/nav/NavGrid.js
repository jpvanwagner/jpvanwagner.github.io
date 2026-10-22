/*
 * Grid-based navigation (A* + line-of-sight smoothing).
 *
 * Replaces the prototype's hand-written waypoint graph: the floor plan in
 * data/layout.js is rasterised into cells, so moving a wall or a desk updates
 * pathfinding automatically and nobody can clip through walls.
 *
 * Obstacles are inflated by the agent radius, so paths are computed for the
 * person's centre point. Door cells are walkable only if the caller's
 * `canPass(doorId)` predicate allows it (badge access, escort, forcing...).
 *
 * Pure JS (no three.js) so it is unit-testable.
 */

const SQRT2 = Math.SQRT2;
const NEIGHBORS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
];

export class NavGrid {
  /**
   * @param {object} opts
   * @param {{x0,x1,z0,z1}} opts.bounds
   * @param {Array<{x0,x1,z0,z1}>} opts.obstacles  wall pieces + blocking furniture
   * @param {Array<{id, rect}>} opts.doors           door footprints
   * @param {number} [opts.cell=0.5]                 cell size in world units
   * @param {number} [opts.inflate=0.8]              agent radius
   */
  constructor({ bounds, obstacles, doors, cell = 0.5, inflate = 0.8 }) {
    this.bounds = bounds;
    this.cell = cell;
    this.inflate = inflate;
    this.cols = Math.ceil((bounds.x1 - bounds.x0) / cell);
    this.rows = Math.ceil((bounds.z1 - bounds.z0) / cell);
    const n = this.cols * this.rows;
    this.blocked = new Uint8Array(n);
    this.doorIndex = new Int16Array(n).fill(-1);
    this.doorIds = doors.map((d) => d.id);

    for (const r of obstacles) this.#markRect(r, inflate, (i) => (this.blocked[i] = 1));

    // Door zones: the strip an agent's centre occupies while its body is in the doorway.
    doors.forEach((d, idx) => {
      const { rect } = d;
      const horizontal = rect.x1 - rect.x0 > rect.z1 - rect.z0;
      const grown = horizontal
        ? { x0: rect.x0, x1: rect.x1, z0: rect.z0 - inflate, z1: rect.z1 + inflate }
        : { x0: rect.x0 - inflate, x1: rect.x1 + inflate, z0: rect.z0, z1: rect.z1 };
      this.#markRect(grown, 0, (i) => {
        if (!this.blocked[i]) this.doorIndex[i] = idx;
      });
    });
  }

  #markRect(r, pad, fn) {
    const [c0, r0] = this.toCell(r.x0 - pad, r.z0 - pad);
    const [c1, r1] = this.toCell(r.x1 + pad, r.z1 + pad);
    for (let cz = Math.max(0, r0); cz <= Math.min(this.rows - 1, r1); cz++) {
      for (let cx = Math.max(0, c0); cx <= Math.min(this.cols - 1, c1); cx++) {
        const { x, z } = this.cellCenter(cx, cz);
        if (x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad) fn(cz * this.cols + cx);
      }
    }
  }

  toCell(x, z) {
    return [Math.floor((x - this.bounds.x0) / this.cell), Math.floor((z - this.bounds.z0) / this.cell)];
  }

  cellCenter(cx, cz) {
    return { x: this.bounds.x0 + (cx + 0.5) * this.cell, z: this.bounds.z0 + (cz + 0.5) * this.cell };
  }

  inside(cx, cz) {
    return cx >= 0 && cz >= 0 && cx < this.cols && cz < this.rows;
  }

  /** Door id at a world position, or null. */
  doorAt(x, z) {
    const [cx, cz] = this.toCell(x, z);
    if (!this.inside(cx, cz)) return null;
    const idx = this.doorIndex[cz * this.cols + cx];
    return idx >= 0 ? this.doorIds[idx] : null;
  }

  isWalkable(x, z, canPass = () => true) {
    const [cx, cz] = this.toCell(x, z);
    return this.#walkable(cx, cz, canPass);
  }

  #walkable(cx, cz, canPass) {
    if (!this.inside(cx, cz)) return false;
    const i = cz * this.cols + cx;
    if (this.blocked[i]) return false;
    const d = this.doorIndex[i];
    return d < 0 || canPass(this.doorIds[d]);
  }

  /** Nearest walkable cell to a point (breadth-first ring search). */
  #nearestWalkable(cx, cz, canPass, maxRadius = 8) {
    if (this.#walkable(cx, cz, canPass)) return [cx, cz];
    for (let r = 1; r <= maxRadius; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          if (this.#walkable(cx + dx, cz + dz, canPass)) return [cx + dx, cz + dz];
        }
      }
    }
    return null;
  }

  /**
   * A* path from `from` to `to` (world points). Returns a smoothed list of
   * waypoints ending exactly at `to`, or null when unreachable.
   */
  findPath(from, to, canPass = () => true) {
    const start = this.#nearestWalkable(...this.toCell(from.x, from.z), canPass);
    const goal = this.#nearestWalkable(...this.toCell(to.x, to.z), canPass);
    if (!start || !goal) return null;

    const { cols, rows, blocked, doorIndex } = this;
    const n = cols * rows;
    // Scratch buffers are reused between searches; `stamp` marks which entries are current.
    if (!this.scratch) {
      this.scratch = { g: new Float32Array(n), came: new Int32Array(n), seen: new Uint32Array(n), closed: new Uint32Array(n), stamp: 0 };
    }
    const sc = this.scratch;
    const stamp = ++sc.stamp;
    const { g, came, seen, closed } = sc;
    const doorOk = this.doorIds.map((id) => !!canPass(id));
    const open = (i) => {
      if (blocked[i]) return false;
      const d = doorIndex[i];
      return d < 0 || doorOk[d];
    };

    const startI = start[1] * cols + start[0];
    const goalI = goal[1] * cols + goal[0];
    const gx = goal[0];
    const gz = goal[1];
    const h = (cx, cz) => {
      const dx = Math.abs(cx - gx);
      const dz = Math.abs(cz - gz);
      // Slightly weighted octile heuristic: much faster, paths are smoothed anyway.
      return 1.2 * (dx + dz + (SQRT2 - 2) * Math.min(dx, dz));
    };

    const heap = (this.heap ??= new MinHeap());
    heap.size = 0;
    g[startI] = 0;
    came[startI] = -1;
    seen[startI] = stamp;
    heap.push(startI, h(start[0], start[1]));
    let found = false;
    while (heap.size) {
      const cur = heap.pop();
      if (cur === goalI) {
        found = true;
        break;
      }
      if (closed[cur] === stamp) continue;
      closed[cur] = stamp;
      const cx = cur % cols;
      const cz = (cur - cx) / cols;
      for (let k = 0; k < 8; k++) {
        const nb = NEIGHBORS[k];
        const dx = nb[0];
        const dz = nb[1];
        const cost = nb[2];
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= cols || nz >= rows) continue;
        const ni = nz * cols + nx;
        if (!open(ni)) continue;
        // No corner cutting on diagonals
        if (dx && dz && (!open(cz * cols + nx) || !open(nz * cols + cx))) continue;
        const ng = g[cur] + cost;
        if (seen[ni] !== stamp || ng < g[ni]) {
          seen[ni] = stamp;
          g[ni] = ng;
          came[ni] = cur;
          heap.push(ni, ng + h(nx, nz));
        }
      }
    }
    if (!found) return null;

    const cells = [];
    for (let i = goalI; i !== -1; i = came[i]) cells.push(i);
    cells.reverse();
    const raw = cells.map((i) => this.cellCenter(i % cols, Math.floor(i / cols)));
    raw[0] = { x: from.x, z: from.z };
    // Keep the exact destination if it is reachable, otherwise the nearest cell.
    if (this.isWalkable(to.x, to.z, canPass)) raw[raw.length - 1] = { x: to.x, z: to.z };
    return this.smooth(raw, canPass);
  }

  /** String-pulling: drop waypoints that have direct line of sight past them. */
  smooth(points, canPass) {
    if (points.length <= 2) return points.slice(1);
    const out = [];
    let anchor = points[0];
    for (let i = 1; i < points.length - 1; i++) {
      if (!this.lineOfSight(anchor, points[i + 1], canPass)) {
        out.push(points[i]);
        anchor = points[i];
      }
    }
    out.push(points[points.length - 1]);
    return out;
  }

  lineOfSight(a, b, canPass) {
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.ceil(dist / (this.cell * 0.4));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      if (!this.isWalkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, canPass)) return false;
    }
    return true;
  }
}

/** Binary min-heap of (index, priority) pairs backed by growable typed arrays. */
class MinHeap {
  constructor(capacity = 4096) {
    this.items = new Int32Array(capacity);
    this.prio = new Float32Array(capacity);
    this.size = 0;
  }
  push(item, p) {
    if (this.size === this.items.length) {
      const items = new Int32Array(this.size * 2);
      const prio = new Float32Array(this.size * 2);
      items.set(this.items);
      prio.set(this.prio);
      this.items = items;
      this.prio = prio;
    }
    const { items, prio } = this;
    let i = this.size++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (prio[parent] <= p) break;
      items[i] = items[parent];
      prio[i] = prio[parent];
      i = parent;
    }
    items[i] = item;
    prio[i] = p;
  }
  pop() {
    const { items, prio } = this;
    const top = items[0];
    const n = --this.size;
    if (n > 0) {
      const item = items[n];
      const p = prio[n];
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const m = r < n && prio[r] < prio[l] ? r : l;
        if (prio[m] >= p) break;
        items[i] = items[m];
        prio[i] = prio[m];
        i = m;
      }
      items[i] = item;
      prio[i] = p;
    }
    return top;
  }
}
