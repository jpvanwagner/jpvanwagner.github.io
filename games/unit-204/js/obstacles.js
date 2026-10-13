'use strict';
/* ============================== OBSTACLES ==============================
   Things standing on the floor that you and Dana walk around instead of through, and that hide whoever is behind
   them. A room lists them as blocks: [{ x0, x1, z0, z1, h, pts? }] (a footprint on the floor in world units, a height,
   and optionally the screen outline of the object; without one it's the box from the footprint and height).
   Walking: a target inside a block is moved just outside it, and a straight line that would cross one bends around
   its corners. Drawing: characters and blocks are painted back to front; a block that has someone behind it is
   repainted on top of them from the cached room layer (plus the room's live layer), clipped to its outline, so a
   machine or a table stands in front of whoever walks behind it. Rooms without blocks (the apartment) are unchanged. */
const Obstacles = {
  PAD: .35,                                       // how close to an object anyone stands
  list(room) { const r = ROOMS[room || Game.room]; return (r && (typeof r.blocks === 'function' ? r.blocks() : r.blocks)) || []; },
  grow(b, d) { return { x0: b.x0 - d, x1: b.x1 + d, z0: b.z0 - d, z1: b.z1 + d }; },
  /* the padded footprints, with any that touch merged into one box (a worker at a sawhorse is walked around as one thing) */
  rects(room) {
    let rs = this.list(room).map(o => this.grow(o, this.PAD)), merged = true;
    while (merged) { merged = false;
      outer: for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i], b = rs[j];
        if (a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1) { rs[i] = { x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), z0: Math.min(a.z0, b.z0), z1: Math.max(a.z1, b.z1) }; rs.splice(j, 1); merged = true; break outer; } } }
    return rs;
  },
  inside(b, x, z) { return x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1; },
  /* does the segment a-b pass through rectangle r (Liang-Barsky clip) */
  crosses(ax, az, bx, bz, r) {
    const q = { x0: r.x0 + .01, x1: r.x1 - .01, z0: r.z0 + .01, z1: r.z1 - .01 }, dx = bx - ax, dz = bz - az;
    let t0 = 0, t1 = 1;
    for (const [p, v] of [[-dx, ax - q.x0], [dx, q.x1 - ax], [-dz, az - q.z0], [dz, q.z1 - az]]) {
      if (Math.abs(p) < 1e-9) { if (v < 0) return false; continue; }
      const t = v / p; if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return t0 < t1;
  },
  /* a spot that isn't inside anything: pushed out the nearest side */
  free(x, z, room) {
    const w = ROOMS[room || Game.room].walk;
    for (let pass = 0; pass < 3; pass++) {
      const b = this.rects(room).find(o => this.inside(o, x, z)); if (!b) break;
      const opts = [[b.x0 - .02, z], [b.x1 + .02, z], [x, b.z0 - .02], [x, b.z1 + .02]].filter(([px, pz]) => px >= w.x0 && px <= w.x1 && pz >= w.z0 && pz <= w.z1);
      if (!opts.length) break;
      [x, z] = opts.sort((p, q) => Math.hypot(p[0] - x, p[1] - z) - Math.hypot(q[0] - x, q[1] - z))[0];
    }
    return { x, z };
  },
  /* the waypoints from a to b, bending around whatever is in the way (a few blocks deep is plenty for a room) */
  route(ax, az, bx, bz, room, depth = 0) {
    const w = ROOMS[room || Game.room].walk, rects = this.rects(room);
    const hit = rects.filter(r => this.crosses(ax, az, bx, bz, r)).sort((p, q) => Math.hypot((p.x0 + p.x1) / 2 - ax, (p.z0 + p.z1) / 2 - az) - Math.hypot((q.x0 + q.x1) / 2 - ax, (q.z0 + q.z1) / 2 - az))[0];
    if (!hit || depth > 3) return [[bx, bz]];
    const e = .04, C = [[hit.x0 - e, hit.z0 - e], [hit.x1 + e, hit.z0 - e], [hit.x1 + e, hit.z1 + e], [hit.x0 - e, hit.z1 + e]].map(([x, z]) => [clamp(x, w.x0, w.x1), clamp(z, w.z0, w.z1)]);
    const ok = (p, q) => !this.crosses(p[0], p[1], q[0], q[1], hit), d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]), A = [ax, az], B = [bx, bz];
    let best = null;
    for (let i = 0; i < 4; i++) {
      if (ok(A, C[i]) && ok(C[i], B)) { const L = d(A, C[i]) + d(C[i], B); if (!best || L < best.L) best = { L, via: [C[i]] }; }
      for (const j of [(i + 1) % 4, (i + 3) % 4]) if (ok(A, C[i]) && ok(C[i], C[j]) && ok(C[j], B)) { const L = d(A, C[i]) + d(C[i], C[j]) + d(C[j], B); if (!best || L < best.L) best = { L, via: [C[i], C[j]] }; }
    }
    if (!best) return [[bx, bz]];
    const out = []; let from = A;
    for (const p of [...best.via, B]) { out.push(...this.route(from[0], from[1], p[0], p[1], room, depth + 1)); from = p; }
    return out;
  },
  /* the screen outline a block repaints over anyone behind it */
  outline(b) { return b.pts ? b.pts() : hull(boxPts(b.x0, b.x1, 0, b.h || 1, b.z0, b.z1)); },
  /* draw the walkers and the blocks back to front */
  draw(g, room, walkers, t) {
    const blocks = this.list(room);
    if (!blocks.length) { for (const w of walkers.slice().sort((a, b) => b.z - a.z)) w.draw(g, t); return; }
    const items = [...walkers.map(w => ({ z: w.z, w })), ...blocks.map(b => ({ z: (b.z0 + b.z1) / 2, b }))].sort((a, b) => b.z - a.z);
    const drawn = [], r = ROOMS[room];
    for (const it of items) {
      if (it.w) { it.w.draw(g, t); drawn.push(it.w); continue; }
      // a block can be several solid pieces (b.parts: a forklift's body, its guard posts and roof, its mast), so whoever
      // stands behind it shows through the gaps instead of vanishing behind one big outline
      const shapes = it.b.parts ? it.b.parts() : [this.outline(it.b)], bx = polyBox(shapes.flat());
      if (!drawn.some(w => { const q = w.rect(); return q.x1 > bx.x0 && q.x0 < bx.x1 && q.y1 > bx.y0 && q.y0 < bx.y1; })) continue;
      g.save(); g.beginPath(); for (const p of shapes) { p.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); } g.clip();
      g.drawImage(Rooms.layer(room), 0, 0); r.dynamic && r.dynamic(g, r, t); Openables.drawLive(g, r, t); g.restore();
    }
  }
};
