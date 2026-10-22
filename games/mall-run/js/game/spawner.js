/* Places coins, power-ups and obstacles along the path ahead of the runner. */
import * as C from "../config.js";
import { ARC_LEN } from "./path.js";
import { SETTINGS } from "../settings.js";
import { randomPowerKind } from "./game.js";

export class Spawner {
  constructor(G) {
    this.G = G;
    this.lastS = G.r.s + 30;        // last spawn slot
    this.lastObstacleS = G.r.s + 40;
    this.lastPowerS = G.r.s + 40 - C.POWER_MIN_GAP;   // first orb no sooner than ~40 m in
    this.run = { lane: 0, left: 0 };
    this.noLowerUntil = -1;         // lower-floor spawning paused while the runner is upstairs
  }

  minObstacleGap() { return 17 + this.G.speed * 0.8; }

  nearCorner(s) {
    const cs = this.G.path.corners;
    for (let i = this.G.nextCorner; i < cs.length; i++) {
      const c = cs[i];
      if (c.s - 16 > s) break;
      if (s >= c.s - 16 && s <= c.s + ARC_LEN + 8) return true;
    }
    return false;
  }

  add(e) { e.id = this.G.nextId++; this.G.entities.push(e); return e; }

  coin(s, lane, y, level, lat) {
    return this.add({ type: "coin", s, lat: lat !== undefined ? lat : lane * C.LANE, y: y || 0.9, level: level || 0 });
  }

  update() {
    const G = this.G, horizon = G.r.s + C.VIEW_DIST;
    while (this.lastS < horizon) {
      this.lastS += C.SLOT;
      const s = this.lastS;
      const up = G.upper;
      if (up && s > up.startS && s < up.exitS + 30) {
        if (s < up.exitS - 6 && s > up.startS + 12 && Math.random() < 0.85) this.coin(s, 0, 0.9, 1, up.side * C.BALCONY_LAT);
        continue;
      }
      if (s < this.noLowerUntil) continue;
      const atCorner = this.nearCorner(s);
      const r = Math.random();
      if (!atCorner && r < C.POWER_CHANCE && s - this.lastPowerS >= C.POWER_MIN_GAP && s > G.quietUntilS) {
        this.lastPowerS = s;
        const lane = Math.floor(Math.random() * 3) - 1;
        this.add({ type: "power", s, lat: lane * C.LANE, level: 0, kind: randomPowerKind(), bob: Math.random() * 6.28 });
        if (this.run.lane === lane) this.run.left = 0;
      } else if (!atCorner && SETTINGS.obstacles && s > G.quietUntilS + 4 && r < C.POWER_CHANCE + C.OBSTACLE_CHANCE && (s - this.lastObstacleS) >= this.minObstacleGap()) {
        this.obstacle(s);
      } else {
        this.coinTrail(s);
      }
    }
  }

  coinTrail(s) {
    const run = this.run;
    if (run.left > 0) { this.coin(s, run.lane); run.left--; return; }
    if (Math.random() < 0.42) {
      run.lane = Math.floor(Math.random() * 3) - 1; run.left = 5 + Math.floor(Math.random() * 6);
      this.coin(s, run.lane); run.left--;
    }
  }

  obstacle(s) {
    const G = this.G;
    const kind = C.OBSTACLES[(Math.random() * C.OBSTACLES.length) | 0];
    const lane = kind === "sample" ? (Math.random() < 0.5 ? -1 : 1) : Math.floor(Math.random() * 3) - 1;
    const e = { type: "obstacle", kind, s, lat: lane * C.LANE, lane, level: 0,
      kioskType: C.KIOSK_TYPES[(Math.random() * C.KIOSK_TYPES.length) | 0], seed: (Math.random() * 1e9) | 0 };
    if (kind === "person" || kind === "sample") e.vs = 0.9 + Math.random() * 0.8;   // walking toward you (m/s)
    // clear coins that would sit inside the obstacle
    for (let i = G.entities.length - 1; i >= 0; i--) {
      const o = G.entities[i];
      if (o.type === "coin" && Math.abs(o.s - s) < 5 && Math.abs(o.lat - e.lat) < 1) G.entities.splice(i, 1);
    }
    this.add(e);
    this.lastObstacleS = s;
    if (kind === "rope") {                     // coin arc over the rope rewards the jump
      [[-4, 1.4], [-2, 2.0], [0, 2.3], [2, 2.0], [4, 1.4]].forEach(([d, y]) => this.coin(s + d, lane, y));
      if (this.run.lane === lane) this.run.left = 0;
      this.lastS = Math.max(this.lastS, s + 4);
    } else if (this.run.lane === lane) {
      this.run.lane = lane === 0 ? (Math.random() < 0.5 ? -1 : 1) : 0;   // trail steers around it
    } else if (Math.random() < 0.5) {
      this.coin(s + 3, lane === 0 ? 1 : 0);
    }
  }

  enterUpper(up) {
    const G = this.G;
    // nothing from the lower floor should be waiting where you land
    // (everything ahead is re-spawned from here, so drop what was already placed)
    G.entities = G.entities.filter(e => !(e.level === 0 && ((e.type !== "obstacle" && e.s > up.startS) ||
                                                            (e.type === "obstacle" && e.s > up.exitS - 30))));
    this.lastS = Math.max(up.startS, G.r.s);
    this.noLowerUntil = up.exitS + 30;
    this.lastObstacleS = up.exitS + 30;
  }

  leaveUpper(s) {
    this.noLowerUntil = Math.max(this.noLowerUntil, s + 25);
    this.lastObstacleS = Math.max(this.lastObstacleS, s + 25);
  }
}
