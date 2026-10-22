/* Ambient shoppers. They never collide with the runner — they just make the mall feel alive:
   strolling under the walkways, window-shopping, and walking in and out of store entrances. */
import * as C from "../config.js";
import { ARC_LEN } from "./path.js";

/* Store entrances, registered by the world builder as it builds each block. */
export const DOORS = [];
export function registerDoor(d) { DOORS.push(d); }
function pruneDoors(behind) { while (DOORS.length && DOORS[0].s < behind) DOORS.shift(); }

const WALK_IN = C.CW / 2 + 3.2;       // lateral position well inside a shop

export class Crowd {
  constructor(G) {
    this.G = G;
    this.npcs = [];
    this.nextSpawnS = G.r.s + 15;
    this.upperBlock = null;           // {side, s0, s1} kept clear while the runner is upstairs
  }

  nearJunction(s, pad) {
    const cs = this.G.path.corners;
    for (let i = Math.max(0, this.G.nextCorner - 1); i < cs.length; i++) {
      const c = cs[i];
      if (c.s - pad > s) break;
      if (s > c.s - pad && s < c.s + ARC_LEN + pad) return true;
    }
    return false;
  }

  clearUpperAhead(side, s0, s1) {
    this.upperBlock = { side, s0: s0 - 6, s1: s1 + 10 };
    this.npcs = this.npcs.filter(n => !(n.level === 1 && Math.sign(n.lat) === side && n.s > s0 - 6 && n.s < s1 + 10));
  }

  blocked(level, side, s) {
    const b = this.upperBlock;
    return level === 1 && b && side === b.side && s > b.s0 && s < b.s1;
  }

  spawnOne(s, near) {
    const G = this.G;
    const level = Math.random() < 0.32 ? 1 : 0;
    const side = Math.random() < 0.5 ? -1 : 1;
    if (this.blocked(level, side, s)) return;
    if (level === 1 && this.nearJunction(s, 6)) return;
    const n = { id: G.nextId++, s, level, lat: 0, vs: 0, vlat: 0, face: 0, state: "stroll", t: 0,
      seed: (Math.random() * 1e9) | 0, phase: Math.random(), speed: 0, wander: Math.random() * 6.28 };
    const roll = Math.random();
    // exiting a shop: start inside, behind the wall, so they never pop into view
    const door = roll < 0.3 ? this.findDoor(s, level, 30) : null;
    if (door) {
      n.state = "exit"; n.s = door.s + (Math.random() - 0.5) * door.w * 0.5; n.lat = door.side * WALK_IN; n.level = door.level;
      n.goalLat = door.side * (C.CW / 2 - 1.3 - Math.random() * 1.0);
      n.face = door.side > 0 ? -Math.PI / 2 : Math.PI / 2;
    } else if (roll < 0.45 && !near) {
      n.state = "idle"; n.t = 3 + Math.random() * 9;
      n.lat = side * (C.CW / 2 - 0.7); n.face = side * Math.PI / 2;     // looking into a shop window
    } else {
      n.lat = side * (level === 1 ? C.BALCONY_LAT + (Math.random() - 0.5) * 1.2 : 3.9 + Math.random() * 1.4);
      n.vs = (Math.random() < 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.7);
      n.face = n.vs > 0 ? 0 : Math.PI;
    }
    this.npcs.push(n);
  }

  findDoor(s, level, range) {
    let best = null, bd = range;
    for (const d of DOORS) {
      if (d.level !== level) continue;
      const dd = Math.abs(d.s - s);
      if (dd < bd && !this.blocked(level, d.side, d.s)) { bd = dd; best = d; }
    }
    return best;
  }

  update(dt) {
    const G = this.G, rs = G.r.s;
    if (this.upperBlock && !G.upper) this.upperBlock = null;
    pruneDoors(rs - 30);

    // fill the view initially, then trickle new shoppers in at the far end of the fog
    let guard = 0;
    while (this.nextSpawnS < rs + C.VIEW_DIST && guard++ < 60) {
      this.nextSpawnS += 5 + Math.random() * 4;
      if (this.npcs.length < C.NPC_MAX) this.spawnOne(this.nextSpawnS, this.nextSpawnS < rs + 40);
    }

    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const n = this.npcs[i];
      if (n.s < rs - 15 || n.s > rs + C.VIEW_DIST + 40 || n.state === "gone") { this.npcs.splice(i, 1); continue; }
      this.step(n, dt);
    }
  }

  step(n, dt) {
    const side = Math.sign(n.lat) || 1;
    if (n.state === "stroll") {
      n.wander += dt * 0.5;
      n.vlat = Math.sin(n.wander) * 0.12;
      const lim = n.level === 1 ? [C.VOID_HALF + 0.6, C.CW / 2 - 0.5] : [3.7, C.CW / 2 - 0.6];
      const a = Math.abs(n.lat);
      if (a < lim[0]) n.vlat = side * 0.3; else if (a > lim[1]) n.vlat = -side * 0.3;
      // upstairs walkways don't go round junction corners: turn back before one
      if (n.level === 1 && this.nearJunction(n.s + Math.sign(n.vs) * 3, 3)) n.vs = -n.vs;
      if (this.blocked(n.level, side, n.s + n.vs)) n.vs = -n.vs;
      // occasionally pop into a shop as they pass its entrance
      if (!n.decided) {
        const d = this.findDoor(n.s, n.level, 1.2);
        if (d && d.side === side) {
          n.decided = true;
          if (Math.random() < 0.4) { n.state = "enter"; n.door = d; }
        }
      } else if (!this.findDoor(n.s, n.level, 2)) n.decided = false;
    } else if (n.state === "enter") {
      // line up in front of the doorway, then walk straight in
      const d = n.door, ds = d.s - n.s, front = side * (C.CW / 2 - 1.0);
      if (Math.abs(ds) > 0.25 && Math.abs(n.lat) < C.CW / 2 - 0.3) {
        n.vs = Math.sign(ds) * Math.min(1.1, Math.abs(ds) * 2 + 0.25);
        const dl = front - n.lat;
        n.vlat = Math.sign(dl) * Math.min(0.8, Math.abs(dl) * 1.5);
      } else { n.vs = ds * 2; n.vlat = side * 1.1; }
      if (Math.abs(n.lat) > WALK_IN) n.state = "gone";
    } else if (n.state === "exit") {
      const dl = n.goalLat - n.lat;
      n.vs = 0; n.vlat = Math.sign(dl) * Math.min(1.1, Math.abs(dl) * 1.5 + 0.2);
      if (Math.abs(dl) < 0.1) { n.state = "stroll"; n.vs = (Math.random() < 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.6); n.decided = true; }
    } else if (n.state === "idle") {
      n.vs = 0; n.vlat = 0; n.t -= dt;
      if (n.t <= 0) { n.state = "stroll"; n.vs = (Math.random() < 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.6); n.decided = true; }
    }
    n.s += n.vs * dt; n.lat += n.vlat * dt;
    n.speed = Math.hypot(n.vs, n.vlat);
    if (n.speed > 0.08) {
      const want = Math.atan2(n.vlat, n.vs);
      let d = want - n.face; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      n.face += d * Math.min(1, dt * 6);
    }
    n.phase += dt * n.speed / 1.35;              // one stride cycle ≈ 1.35 m
  }
}
