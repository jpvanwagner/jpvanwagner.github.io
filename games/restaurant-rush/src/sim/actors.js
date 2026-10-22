// Walkers: guests and staff. The renderer mirrors each actor with a little figure.
import { G, nextId, bus } from '../state.js';
import { findPath } from './pathfind.js';

export function createActor(opts) {
  const a = {
    id: nextId(), kind: 'guest', x: 0, z: 0, face: 0, path: [], speed: 2.4,
    seated: false, carrying: null, onArrive: null, walkPhase: Math.random() * 6,
    ...opts,
  };
  G.actors.push(a);
  bus.emit('actor:add', a);
  return a;
}

export function removeActor(a) {
  const i = G.actors.indexOf(a);
  if (i >= 0) G.actors.splice(i, 1);
  bus.emit('actor:remove', a);
}

/** Walk to `to` via the floor grid. `cb` fires on arrival. `offset` nudges the final point. */
export function walkTo(a, to, cb, { direct = false } = {}) {
  a.seated = false;
  a.path = direct ? [{ x: to.x, z: to.z }] : findPath(a, to);
  a.onArrive = cb || null;
}

export function updateActors(dt) {
  for (const a of G.actors) {
    if (!a.path.length) continue;
    let budget = a.speed * dt;
    while (budget > 0 && a.path.length) {
      const p = a.path[0];
      const dx = p.x - a.x, dz = p.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d < 1e-4) { a.path.shift(); continue; }
      a.face = Math.atan2(dx, dz);
      if (d <= budget) { a.x = p.x; a.z = p.z; budget -= d; a.path.shift(); }
      else { a.x += (dx / d) * budget; a.z += (dz / d) * budget; budget = 0; }
    }
    a.walkPhase += dt * 10;
    if (!a.path.length && a.onArrive) {
      const cb = a.onArrive;
      a.onArrive = null;
      cb(a);
    }
  }
}

export const isWalking = (a) => a.path.length > 0;
