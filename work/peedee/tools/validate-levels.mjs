/* Level checker: proves every jump in PeeDee's Dental Defense is makeable.
   It loads the real physics and level data from js/physics.js and js/levels.js,
   then for every standable surface simulates thousands of runs, hops, full jumps and drop-throughs
   frame by frame with the game's own stepPlayer(). From that it builds a "can get from A to B" graph and
   checks, for each level:
     - every dirty spot can be reached from the start (with plugs/gates still closed),
     - nowhere you can reach is a dead end (every spot is still reachable from it),
     - once everything is clean, the exit can be reached from anywhere you could be standing.
   It runs twice: with the real jump, and with a deliberately weaker "comfortable" jump (93% height
   and 92% run speed) so nothing required is pixel-perfect. The tongue counts as one big surface
   (checked at rest). Exit code 1 if anything fails.
   Usage: node tools/validate-levels.mjs            */
import { readFileSync } from 'node:fs';

// the checker runs the game's own physics and level files
const read = f => readFileSync(new URL('../js/' + f, import.meta.url), 'utf8').replace("'use strict';", '');
const { PHYS, stepPlayer, LEVEL_DEFS, buildLevel, overlaps, tongueY } =
  new Function(read('physics.js') + read('levels.js') + '\nreturn { PHYS, stepPlayer, LEVEL_DEFS, buildLevel, overlaps, tongueY };')();

const COMFY = { ...PHYS, JUMP_V: PHYS.JUMP_V * 0.93, RUN: PHYS.RUN * 0.92 };

function subtract(ivs, a, b) {
  const out = [];
  for (const [x0, x1] of ivs) {
    if (b <= x0 || a >= x1) { out.push([x0, x1]); continue; }
    if (a > x0) out.push([x0, a]);
    if (b < x1) out.push([b, x1]);
  }
  return out;
}

function surfaces(pieces) {
  const solids = pieces.filter(p => p.solid && !p.off);
  const out = [];
  for (const t of pieces) {
    if (t.off || t.kind === 'ceil' || !(t.solid || t.oneway)) continue;
    let ivs = [[t.x, t.x + t.w]];
    for (const s of solids) if (s !== t && s.y < t.y && s.y + s.h > t.y - 1) ivs = subtract(ivs, s.x, s.x + s.w);
    for (const [a, b] of ivs) if (b - a >= 3) out.push({ id: out.length, piece: t, x0: a, x1: b, y: t.y });
  }
  return out;
}

function analyse(L, P, papillaMode, phase) {
  const pieces = L.terrain.map(t => ({ ...t }));
  for (const p of pieces) {
    if (p.kind === 'papilla') { p.y = p.baseY + (papillaMode === 'base' ? 0 : p.amp * papillaMode(p)); p.dy = 0; }
    if (phase === 'clean' && (p.kind === 'plug' || p.kind === 'gate')) p.off = true;
  }
  const surfs = surfaces(pieces);
  const T = L.tongue ? { ...L.tongue, pulses: [] } : null;     // the tongue: one big squishy surface
  if (T) surfs.push({ id: surfs.length, piece: T, x0: T.x0, x1: T.x1, y: null, tongue: true });
  const byPiece = new Map();
  for (const s of surfs) { if (!byPiece.has(s.piece)) byPiece.set(s.piece, []); byPiece.get(s.piece).push(s); }
  const surfAt = (piece, x) => {
    if (T && piece === T) return surfs[surfs.length - 1];
    const list = byPiece.get(piece); if (!list) return null;
    let best = null, bd = 1e9;
    for (const s of list) { const d = x < s.x0 ? s.x0 - x : x > s.x1 ? x - s.x1 : 0; if (d < bd) { bd = d; best = s; } }
    return best;
  };
  const ex = L.exit;
  const exitBox = { x: ex.x, y: ex.y, w: ex.w, h: ex.h };
  const edges = surfs.map(() => new Set());
  const exitFrom = new Set();

  for (const src of surfs) {
    const near = src.tongue ? pieces.filter(p => !p.off) : pieces.filter(p => !p.off && p.x < src.x1 + 260 && p.x + p.w > src.x0 - 260);
    const world = { solids: near.filter(p => p.solid), oneways: near.filter(p => p.oneway), left: 0, right: L.width, tongue: T, time: 0 };
    const actions = ['jump', 'hop', 'walk'].concat(src.piece.oneway ? ['drop'] : []);
    for (let x = src.x0 - P.PW + 1; x <= src.x1 - 1; x += src.tongue ? 40 : 3) {
      const sy = src.tongue ? tongueY(T, x + P.PW / 2, 0) : src.y;
      const start = { x, y: sy - P.PH, w: P.PW, h: P.PH };
      if (world.solids.some(s => overlaps(start, s))) continue;
      for (const dir of [-1, 1]) for (const action of actions) {
        const steers = action === 'walk' ? [Infinity] : [Infinity, 0, 10, 20];
        for (const steer of steers) for (const run of (action === 'walk' ? [false] : [false, true])) {
          const r = sim(L, world, src, x, sy, dir, action, steer, run, P, surfAt, exitBox);
          if (r.surf) edges[src.id].add(r.surf.id);
          if (r.exit) exitFrom.add(src.id);
        }
      }
    }
  }
  // neighbouring surfaces within a small step of each other (like the thin slices along a tooth's outline)
  // are simply walked between, even where a 10px body can't stand on one alone
  for (const a of surfs) for (const b of surfs) {
    if (a === b || a.tongue || b.tongue) continue;
    if (Math.abs(a.x1 - b.x0) <= 1 && Math.abs(a.y - b.y) <= P.STEP) { edges[a.id].add(b.id); edges[b.id].add(a.id); }
  }
  return { surfs, edges, exitFrom, surfAt };
}

function sim(L, world, src, x, sy, dir, action, steer, run, P, surfAt, exitBox) {
  const b = { x, y: sy - P.PH, w: P.PW, h: P.PH, vx: run ? dir * P.RUN : 0, vy: 0, grounded: true, ground: src.piece,
    coyote: 0, buffer: 0, drop: 0, jumping: false, step: P.STEP };
  const res = { surf: null, exit: false };
  let air = false;
  for (let f = 0; f < 180; f++) {
    const press = f === 0 && action !== 'walk';
    const inp = {
      left: dir < 0 && f < steer, right: dir > 0 && f < steer, down: action === 'drop' && f < 2,
      jumpHeld: action === 'jump' || (action === 'hop' && f < 6) || (action === 'drop' && f < 1), jumpPressed: press
    };
    stepPlayer(b, inp, world, P);
    if (overlaps(b, exitBox)) res.exit = true;
    if (b.y > L.deathY) return res;
    if (!b.grounded) air = true;
    else {
      const s = surfAt(b.ground, b.x + b.w / 2);
      if (s && s !== src) { res.surf = s; return res; }
      if (air || f > 90) return res;
    }
  }
  return res;
}

function reach(from, edges) {
  const seen = new Set([from]), q = [from];
  while (q.length) { const n = q.shift(); for (const m of edges[n]) if (!seen.has(m)) { seen.add(m); q.push(m); } }
  return seen;
}

let failed = false;
const say = (ok, msg) => { if (!ok) failed = true; console.log((ok ? '  ok   ' : '  FAIL ') + msg); };

for (const def of LEVEL_DEFS) {
  const L = buildLevel(def);
  console.log('\n' + def.name);
  const modes = L.terrain.some(t => t.kind === 'papilla' && t.amp)
    ? [['bobbing: base', 'base'], ['bobbing: even high', p => (Math.round(p.x / 10) % 2 ? 1 : -1)], ['bobbing: odd high', p => (Math.round(p.x / 10) % 2 ? -1 : 1)]]
    : [['', 'base']];
  for (const [P, pname] of [[PHYS, 'real jump'], [COMFY, 'comfortable jump']]) {
    for (const [mname, mode] of modes) {
      const tag = pname + (mname ? ', ' + mname : '');
      const dirty = analyse(L, P, mode, 'dirty');
      const clean = analyse(L, P, mode, 'clean');
      // start surface: the highest surface under the start point (PeeDee drops onto it in the cave)
      const sy = L.start.y != null ? L.start.y : -1e9;
      const startSurf = dirty.surfs.filter(s => !s.tongue && L.start.x >= s.x0 && L.start.x < s.x1 && s.y >= sy).sort((a, b) => a.y - b.y)[0]
        || dirty.surfs.find(s => s.tongue);
      if (!startSurf) { say(false, tag + ': no start surface'); continue; }
      const reachable = reach(startSurf.id, dirty.edges);
      const spotSurf = L.spots.map(sp => sp.y == null ? dirty.surfs.find(s => s.tongue)
        : dirty.surfs.find(s => !s.tongue && Math.abs(s.y - sp.y) < 1 && sp.x >= s.x0 - 6 && sp.x <= s.x1 + 6));
      const missingSurf = L.spots.filter((sp, i) => !spotSurf[i]);
      say(!missingSurf.length, tag + ': every spot sits on a surface' + (missingSurf.length ? ' (orphans: ' + missingSurf.map(s => s.kind + '@' + s.x).join(', ') + ')' : ''));
      const unreached = L.spots.filter((sp, i) => spotSurf[i] && !reachable.has(spotSurf[i].id));
      say(!unreached.length, tag + ': all ' + L.spots.length + ' spots reachable' + (unreached.length ? ' (unreachable: ' + unreached.map(s => s.kind + '@' + s.x).join(', ') + ')' : ''));
      const traps = [];
      for (const id of reachable) {
        const r = reach(id, dirty.edges);
        if (spotSurf.some(s => s && !r.has(s.id))) traps.push(dirty.surfs[id]);
      }
      say(!traps.length, tag + ': no dead ends while cleaning' + (traps.length ? ' (stuck on: ' + traps.map(s => s.piece.kind + '@' + s.x0 + ',' + s.y).join('; ') + ')' : ''));
      // after cleaning: map each reachable surface into the clean-phase graph and check the exit
      const cleanIds = new Set();
      for (const id of reachable) { const s = dirty.surfs[id]; const c = s.tongue ? clean.surfs.find(k => k.tongue) : clean.surfAt(s.piece, (s.x0 + s.x1) / 2); if (c) cleanIds.add(c.id); }
      const noExit = [];
      for (const id of cleanIds) { const r = reach(id, clean.edges); if (![...r].some(n => clean.exitFrom.has(n))) noExit.push(clean.surfs[id]); }
      say(!noExit.length, tag + ': exit reachable once clean' + (noExit.length ? ' (not from: ' + noExit.map(s => s.piece.kind + '@' + s.x0 + ',' + s.y).join('; ') + ')' : ''));
    }
  }
}
console.log(failed ? '\nLEVEL CHECK FAILED' : '\nAll levels pass.');
process.exit(failed ? 1 : 0);
