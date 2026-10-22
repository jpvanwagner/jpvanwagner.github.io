/* Core game state + simulation (no rendering here).
   The runner, entities and NPCs live in path space: (s along the path, lat = metres right of centre, level 0/1).
   UI-facing side effects are pushed onto G.events and drained by main.js each frame. */
import * as C from "../config.js";
import { Path, ARC_LEN, fwdX, fwdZ, rightX, rightZ } from "./path.js";
import { Spawner } from "./spawner.js";
import { Crowd } from "./crowd.js";
import { SETTINGS } from "../settings.js";

export const G = {
  state: "title",          // title | play | crashing | quiz | paused | ended
  path: null, spawner: null, crowd: null,
  r: null,                 // runner
  entities: [],            // coins / powers / obstacles / barrier
  events: [],
  score: 0, distance: 0, level: 0, speed: 6, startS: 0,
  bank: 0, coinMultIdx: 0, coinMult: 1,
  buffs: null, upper: null, nextCorner: 0, crash: null,
  deaths: 0, revives: 0, lastDJ: 0, time: 0, nextId: 1,
  quietUntilS: 0           // no question can be triggered before the runner passes this point
};

function emit(type, data) { G.events.push(Object.assign({ type }, data)); }
export function popup(text, color) { emit("popup", { text, color }); }

/* ------------------------------------------------------------------ reset */
export function resetGame() {
  G.path = new Path(SETTINGS.turns);
  G.startS = 10;
  G.path.ensure(G.startS + C.VIEW_DIST + 120);
  G.r = {
    s: G.startS, lane: 0, lat: 0, latV: 0, level: 0,
    y: 0, vy: 0, air: false, fastFall: false, slideT: 0, landT: 0,
    mode: "run",            // run | climb | drop | crash
    script: null, flip: 0, offX: 0, offZ: 0, blink: 0,
    bufJump: 0, bufSlide: 0, runPhase: 0, laneTilt: 0
  };
  G.entities = []; G.events = [];
  G.score = 0; G.distance = 0; G.level = 0; G.speed = SETTINGS.startSpeed || C.START_SPEED;
  G.bank = 0; G.coinMultIdx = 0; G.coinMult = C.COIN_MULT_TIERS[0];
  G.buffs = { speedStacks: 0, speedTime: 0, immuneStacks: 0, immuneTime: 0, magnetTime: 0, djArm: 0, djSide: 1 };
  G.stats = { coins: 0, asked: 0, correct: 0, bestMult: 1, turns: 0, balconies: 0 };
  G.upper = null; G.nextCorner = 0; G.crash = null;
  G.deaths = 0; G.revives = 0; G.lastDJ = 0; G.time = 0; G.quietUntilS = 0;
  G.spawner = new Spawner(G);
  G.crowd = new Crowd(G);
  G.spawner.update();
  G.crowd.update(0);
}

/* ------------------------------------------------------------------ frames */
/** Runner-track frame: follows the path, except past an untaken corner, where it runs straight on into the wall. */
export function trackPoint(s, lat, out) {
  out = out || {};
  const c = G.path.corners[G.nextCorner];
  if (c && !c.taken && s > c.s) {
    const d = s - c.s;
    out.x = c.x + fwdX(c.h) * d + rightX(c.h) * lat;
    out.z = c.z + fwdZ(c.h) * d + rightZ(c.h) * lat;
    out.h = c.h; out.curv = 0;
    return out;
  }
  return G.path.point(s, lat, out);
}

export function runnerWorld(out) {
  const r = G.r;
  out = trackPoint(r.s, r.lat, out);
  out.x += r.offX; out.z += r.offZ;
  out.y = runnerY();
  return out;
}

export function runnerY() {
  const r = G.r;
  if (r.mode === "climb" || r.mode === "drop") return r.y;      // scripts drive absolute height
  return r.level * C.UPPER_H + r.y;
}

export function nextCorner() { return G.path.corners[G.nextCorner]; }
export function turnWindowOpen() {
  const c = nextCorner(), s = G.r.s;
  return !!(c && !c.taken && !c.missed && G.r.level === 0 && s > c.s - turnWindow() && s < c.s + C.TURN_LATE_GRACE);
}
/** How far before a corner turning opens: a fixed amount of TIME at the current speed. */
export function turnWindow() {
  const v = G.speed * C.METRES_PER_SPEED;
  return Math.max(C.TURN_WINDOW_MIN, Math.min(C.TURN_WINDOW_MAX, v * C.TURN_LEAD_TIME));
}

/* ------------------------------------------------------------------ input actions */
export function inputDir(d) {
  if (G.state !== "play") return;
  const r = G.r;
  if (r.mode === "crash") return;
  const c = nextCorner();
  if (turnWindowOpen() && d === c.dir) { takeTurn(c); return; }
  if (r.level === 1 || r.mode === "climb" || r.mode === "drop") return;   // single file up top
  const nl = Math.max(-1, Math.min(1, r.lane + d));
  if (nl !== r.lane) { r.lane = nl; r.laneTilt = d; }
}

function takeTurn(c, auto) {
  const r = G.r;
  let before = null;
  if (r.s > c.s) before = trackPoint(r.s, r.lat, {});
  c.taken = true;
  if (before) {                                  // late press: blend from the straight line onto the arc
    const after = G.path.point(r.s, r.lat, {});
    r.offX += before.x - after.x; r.offZ += before.z - after.z;
  }
  if (!auto) { popup("NICE TURN!", "#2c6f66"); G.stats.turns++; }
}

export function inputJump() {
  if (G.state !== "play") return;
  const r = G.r;
  if (r.mode === "crash" || r.mode === "climb" || r.mode === "drop") { r.bufJump = C.INPUT_BUFFER; return; }
  // Double-jump armed: jumping from a side lane launches you up to that side's walkway.
  // Double-jump armed: jump from the side lane it picked to launch up to that side's walkway.
  if (G.buffs.djArm > 0 && r.level === 0) {
    const side = G.buffs.djSide;
    if (Math.sign(r.lat) === side && Math.abs(r.lat) > C.LANE * 0.6) { if (activateUpper(side)) return; }
  }
  if (r.level === 1 && G.upper && r.s > G.upper.exitS - C.EXIT_WINDOW) { dropFromUpper(); return; }
  if (r.air) { r.bufJump = C.INPUT_BUFFER; return; }
  doJump();
}

function doJump() {
  const r = G.r;
  r.air = true; r.vy = C.JUMP_V; r.slideT = 0; r.fastFall = false; r.bufJump = 0;
}

export function inputSlide() {
  if (G.state !== "play") return;
  const r = G.r;
  if (r.mode !== "run") { r.bufSlide = C.INPUT_BUFFER; return; }
  if (r.air) { r.fastFall = true; r.vy = Math.min(r.vy, -14); r.bufSlide = C.INPUT_BUFFER * 2; return; }
  r.slideT = C.SLIDE_TIME; r.bufSlide = 0;
}

/* ------------------------------------------------------------------ balcony (double-jump) */
function ballistic(y0, y1, peak) {
  const g = C.GRAVITY, v0 = Math.sqrt(2 * g * (peak - y0));
  const T = v0 / g + Math.sqrt(2 * (peak - y1) / g);
  return { y0, y1, v0, T };
}

function activateUpper(side) {
  const r = G.r;
  let exitS = r.s + C.BALCONY_LEN;
  for (let i = G.nextCorner; i < G.path.corners.length; i++) {
    const c = G.path.corners[i];
    if (c.s > r.s) { exitS = Math.min(exitS, c.s - 18); break; }
  }
  if (exitS - r.s < 45) { popup("NO ROOM - WAIT FOR A STRAIGHT", "#a44f74"); return false; }
  G.buffs.djArm = 0; G.stats.balconies++;
  G.upper = { side, startS: r.s, exitS };
  const yNow = runnerY();
  const b = ballistic(yNow, C.UPPER_H, C.UPPER_H + 1.8);
  r.mode = "climb"; r.air = true; r.slideT = 0;
  r.script = { t: 0, b, lat0: r.lat, lat1: side * C.BALCONY_LAT, latA: 0.38, latB: 0.97, flip: true };
  r.y = yNow;
  G.spawner.enterUpper(G.upper);
  G.crowd.clearUpperAhead(side, r.s, exitS);
  G.entities.push({ id: G.nextId++, type: "barrier", s: exitS, lat: side * C.BALCONY_LAT, level: 1, side });
  popup("UP TO THE BALCONY!", "#2c6f66");
  emit("whoosh", {});
  return true;
}

function dropFromUpper() {
  const r = G.r, side = G.upper.side;
  const b = ballistic(C.UPPER_H, 0, C.UPPER_H + 1.6);
  r.mode = "drop"; r.air = true; r.slideT = 0;
  r.script = { t: 0, b, lat0: r.lat, lat1: side * C.LANE, latA: 0.12, latB: 0.5, flip: false };
  r.y = C.UPPER_H;
  r.lane = side;
  G.upper.dropped = true;
  popup("BACK DOWN!", "#a44f74");
}

function finishScript() {
  const r = G.r, sc = r.script;
  r.lat = sc.lat1; r.latV = 0; r.y = 0; r.vy = 0; r.air = false; r.flip = 0; r.landT = 0.3;
  if (r.mode === "climb") { r.level = 1; }
  else { r.level = 0; G.upper = null; G.spawner.leaveUpper(r.s); }
  r.mode = "run"; r.script = null;
  if (r.bufJump > 0 && r.level === 0) doJump();
}

/* ------------------------------------------------------------------ coins & power-ups */
function bankAdd(n) {
  G.bank += n;
  while (G.bank >= C.BANK_SIZE && G.coinMultIdx < C.COIN_MULT_TIERS.length - 1) {
    G.bank -= C.BANK_SIZE; G.coinMultIdx++; G.coinMult = C.COIN_MULT_TIERS[G.coinMultIdx]; G.stats.bestMult = Math.max(G.stats.bestMult, G.coinMult);
    popup("COINS x" + G.coinMult, "#2c6f66");
  }
  if (G.coinMultIdx >= C.COIN_MULT_TIERS.length - 1) G.bank = Math.min(G.bank, C.BANK_SIZE);
}

export function applyPower(kind) {
  const B = G.buffs;
  if (kind === "speed") { B.speedStacks++; B.speedTime = C.PU_SPEED_TIME; popup("SPEED BOOST!", "#2c6f66"); }
  else if (kind === "immunity") {
    B.immuneStacks++;
    const d = Math.min(C.PU_IMMUNE_CAP, C.PU_IMMUNE_BASE * Math.pow(2, B.immuneStacks - 1));
    B.immuneTime = d; popup("IMMUNITY " + d + "s", "#2c6f66");
  }
  else if (kind === "bigcoin") { bankAdd(C.PU_BIGCOIN); G.score += C.PU_BIGCOIN * G.coinMult; popup("BIG COIN +" + C.PU_BIGCOIN, "#b06a2e"); }
  else if (kind === "magnet") { B.magnetTime = C.PU_MAGNET_TIME; popup("COIN MAGNET!", "#2c6f66"); }
  else if (kind === "doublejump") {
    B.djArm = C.PU_DJ_ARM; B.djSide = Math.random() < 0.5 ? -1 : 1;     // which walkway you can reach this time
    popup("DOUBLE-JUMP: " + (B.djSide < 0 ? "LEFT" : "RIGHT") + " SIDE!", "#2c6f66");
  }
}

export function randomPowerKind() {
  if (G.distance - G.lastDJ > 600) { G.lastDJ = G.distance; return "doublejump"; }
  const k = ["speed", "immunity", "bigcoin", "magnet", "doublejump", "doublejump"];
  const pick = k[(Math.random() * k.length) | 0];
  if (pick === "doublejump") G.lastDJ = G.distance;
  return pick;
}

/* ------------------------------------------------------------------ crash / revive */
export function die(reason, kind) {
  if (G.state !== "play") return;
  const r = G.r;
  G.deaths++;
  G.crash = { t: 0, dur: 1.0, reason, kind: kind || "obstacle" };
  r.mode = "crash"; r.slideT = 0; r.air = false; r.script = null; r.flip = 0;
  if (r.level === 0) r.y = 0;
  G.state = "crashing";
  emit("crash", { reason });
}

export function updateCrash(dt) {
  const cr = G.crash, r = G.r;
  cr.t += dt;
  if (cr.t < 0.35) r.s -= dt * (cr.kind === "wall" ? 5 : 3) * (1 - cr.t / 0.35);   // knock-back
  G.crowd.update(dt);
  if (cr.t >= cr.dur) { const reason = cr.reason; G.crash = null; G.state = "quiz-pending"; emit("question", { mode: "revive", reason }); }
}

/** Called when a question closes: enforce a question-free stretch ahead. */
export function questionClosed() {
  G.quietUntilS = G.r.s + C.QUESTION_COOLDOWN;
  // nothing in this stretch may trigger another question: no orbs, no obstacles
  G.entities = G.entities.filter(e => !((e.type === "power" || e.type === "obstacle") && e.s < G.quietUntilS + 4));
}
function quiet() { return G.r.s < G.quietUntilS; }

export function revive() {
  const r = G.r;
  G.revives++;
  r.blink = C.REVIVE_IMMUNITY;
  G.buffs.immuneTime = Math.max(G.buffs.immuneTime, C.REVIVE_IMMUNITY);
  const c = nextCorner();
  if (c && c.missed) {                         // put the runner round the corner they missed
    c.taken = true; c.missed = false;
    r.s = c.s + ARC_LEN + 2; G.nextCorner++;
    emit("snapCamera", {});
  }
  if (G.upper && r.level === 1) {               // ran into the balcony barrier: land them downstairs past it
    const side = G.upper.side;
    r.s = G.upper.exitS + 4; r.level = 0; r.lane = side; r.lat = side * C.LANE;
    G.upper = null; G.spawner.leaveUpper(r.s);
    emit("snapCamera", {});
  }
  r.mode = "run"; r.y = 0; r.vy = 0; r.air = false; r.slideT = 0; r.flip = 0; r.offX = 0; r.offZ = 0;
  r.lat = Math.max(-C.LANE, Math.min(C.LANE, r.lat));
  if (r.level === 0) r.lat = r.lane * C.LANE;
  r.latV = 0;
  G.state = "play";
}

/* ------------------------------------------------------------------ title-screen attract mode */
export function attractUpdate(dt) {
  const r = G.r;
  G.time += dt;
  r.s += 7 * dt; r.runPhase += dt * 2.05;
  const c = nextCorner();
  if (c && !c.taken && r.s > c.s - 8) c.taken = true;
  if (c && c.taken && r.s > c.s + ARC_LEN + 1) G.nextCorner++;
  G.path.ensure(r.s + C.VIEW_DIST + 120);
  G.crowd.update(dt);
  G.spawner.update();
  for (let i = G.entities.length - 1; i >= 0; i--) if (G.entities[i].s < r.s - 20) G.entities.splice(i, 1);
}

/* ------------------------------------------------------------------ main update */
function damp(k, dt) { return 1 - Math.exp(-k * dt); }

export function update(dt) {
  const r = G.r, B = G.buffs;
  G.time += dt;
  if (r.blink > 0) r.blink -= dt;
  if (B.speedTime > 0) B.speedTime -= dt;
  if (B.immuneTime > 0) B.immuneTime -= dt;
  if (B.magnetTime > 0) B.magnetTime -= dt;
  if (B.djArm > 0) B.djArm -= dt;
  if (r.bufJump > 0) r.bufJump -= dt;
  if (r.bufSlide > 0) r.bufSlide -= dt;

  // speed: base ramps with distance + area; boost multiplies briefly
  const base = Math.min(C.MAX_SPEED, (SETTINGS.startSpeed || C.START_SPEED) + G.level * C.SPEED_PER_LEVEL + G.distance * C.SPEED_RAMP);
  G.speed = base * (B.speedTime > 0 ? (1 + Math.min(C.PU_SPEED_CAP - 1, Math.pow(2, Math.max(0, B.speedStacks - 1)))) : 1);
  const v = G.speed * C.METRES_PER_SPEED;

  // advance
  const prevS = r.s;
  r.s += v * dt;
  const dS = r.s - prevS;
  G.distance = Math.max(G.distance, r.s - G.startS);
  G.score += C.SCORE_PER_METER * dS;
  r.runPhase += dt * (1.45 + 0.085 * v);          // stride cadence follows speed (no foot skating)
  G.path.ensure(r.s + C.VIEW_DIST + 120);

  // decay the late-turn blend offset
  const k = 1 - damp(10, dt); r.offX *= k; r.offZ *= k;

  // ---- lateral: critically damped spring toward the lane (or walkway centre)
  if (r.mode === "climb" || r.mode === "drop") {
    const sc = r.script; sc.t += dt;
    const u = Math.min(1, sc.t / sc.b.T);
    const lu = Math.max(0, Math.min(1, (u - sc.latA) / (sc.latB - sc.latA)));
    const sm = lu * lu * (3 - 2 * lu);
    r.lat = sc.lat0 + (sc.lat1 - sc.lat0) * sm;
    const t = Math.min(sc.t, sc.b.T);
    r.y = sc.b.y0 + sc.b.v0 * t - 0.5 * C.GRAVITY * t * t;
    r.vy = sc.b.v0 - C.GRAVITY * t;
    if (sc.flip) { const fu = Math.max(0, Math.min(1, (u - 0.12) / 0.62)); r.flip = fu * fu * (3 - 2 * fu) * Math.PI * 2; }
    if (u >= 1) finishScript();
  } else {
    const target = r.level === 1 && G.upper ? G.upper.side * C.BALCONY_LAT : r.lane * C.LANE;
    const w = C.LANE_OMEGA;
    const a = w * w * (target - r.lat) - 2 * w * r.latV;
    r.latV += a * dt; r.lat += r.latV * dt;
    r.laneTilt *= 1 - damp(6, dt);

    // ---- vertical
    if (r.air) {
      r.vy -= C.GRAVITY * (r.vy < 0 ? 1.15 : 1) * dt;   // a touch heavier on the way down = snappier hop
      r.y += r.vy * dt;
      if (r.y <= 0) {
        r.y = 0; r.vy = 0; r.air = false; r.landT = r.fastFall ? 0.12 : 0.22; r.fastFall = false;
        if (r.bufSlide > 0) { r.slideT = C.SLIDE_TIME; r.bufSlide = 0; }
        else if (r.bufJump > 0) doJump();
      }
    } else {
      if (r.bufJump > 0) doJump();
      else if (r.bufSlide > 0 && r.slideT <= 0) { r.slideT = C.SLIDE_TIME; r.bufSlide = 0; }
    }
    if (r.slideT > 0) r.slideT -= dt;
    if (r.landT > 0) r.landT -= dt;
  }

  // ---- area change
  const newLevel = Math.floor(G.distance / C.LEVEL_DISTANCE);
  if (newLevel !== G.level) { G.level = newLevel; emit("levelUp", { level: newLevel }); }

  // ---- corners: commit with the turn direction before (or just into) the junction, or run into the wall
  const c = nextCorner();
  if (c) {
    // right after a question, a corner you'd miss turns for you instead of asking again
    if (!c.taken && !c.missed && quiet() && r.level === 0 && r.s >= c.s - 1) { takeTurn(c, true); popup("AUTO TURN", "#a44f74"); }
    if (!c.taken && !c.missed && r.s >= c.s + C.TURN_LATE_GRACE) c.missed = true;
    if (c.missed && r.s - c.s >= C.CW - 0.55) { r.s = c.s + C.CW - 0.55; die("Missed the turn!", "wall"); return; }
    if (c.taken && r.s > c.s + ARC_LEN + 1) G.nextCorner++;
  }

  // ---- balcony end
  if (G.upper && r.level === 1 && r.mode === "run" && quiet() && r.s >= G.upper.exitS - 4) dropFromUpper();
  if (G.upper && r.level === 1 && r.mode === "run" && r.s >= G.upper.exitS - 0.7) {
    r.s = G.upper.exitS - 0.7; die("Ran into the barrier!", "wall"); return;
  }

  collide(prevS, dt);
  G.spawner.update();
  G.crowd.update(dt);
  G.path.prune(r.s - 80);
}

function collide(prevS, dt) {
  const r = G.r, B = G.buffs, ry = runnerY(), feet = r.mode === "run" ? r.y : 0;
  const ents = G.entities;
  for (let i = ents.length - 1; i >= 0; i--) {
    const e = ents[i];
    const eS0 = e.s;
    if (e.vs && !e.hit) e.s -= e.vs * dt;          // shoppers walking toward you
    if (e.s < r.s - 20) { ents.splice(i, 1); continue; }
    if (e.done) continue;
    const rel = e.s - r.s, prevRel = eS0 - prevS;
    const crossed = prevRel >= -0.05 && rel < 0.05 && rel > -1.5;
    const lvl = e.level || 0;
    if (e.type === "coin") {
      const sameLevel = (lvl === 1) === (ry > C.UPPER_H * 0.6);
      if (!sameLevel) continue;
      const magnet = B.magnetTime > 0;
      const near = Math.abs(rel) < 0.9 || crossed;
      const latOK = magnet || Math.abs(e.lat - r.lat) < 1.0;
      const yOK = magnet || Math.abs((ry - lvl * C.UPPER_H) + 0.9 - e.y) < 1.1;
      if (near && latOK && yOK) { e.done = true; e.gotAt = G.time; G.score += G.coinMult; bankAdd(1); G.stats.coins++; emit("coin", {}); }
    } else if (e.type === "power") {
      if (lvl !== r.level || r.mode !== "run" || e.s < G.quietUntilS) continue;
      if ((Math.abs(rel) < 0.9 || crossed) && Math.abs(e.lat - r.lat) < 1.1) {
        e.done = true; G.state = "quiz-pending"; emit("question", { mode: "power", kind: e.kind });
      }
    } else if (e.type === "obstacle") {
      if (r.level !== 0 || r.mode === "climb" || r.mode === "drop" || r.mode === "crash") continue;
      if (!crossed) continue;
      const halfW = e.kind === "kiosk" ? 1.05 : e.kind === "rope" || e.kind === "banner" ? 1.15 : 0.32;
      if (Math.abs(e.lat - r.lat) > halfW + 0.3) continue;
      e.done = true;
      let safe = B.immuneTime > 0 || quiet();          // (a shopper who wandered into the question-free stretch)
      if (e.kind === "rope") safe = safe || feet > C.ROPE_CLEAR;
      else if (e.kind === "banner") safe = safe || r.slideT > 0;
      if (safe) { if ((e.kind === "person" || e.kind === "sample") && (B.immuneTime > 0 || quiet())) e.hit = G.time; continue; }
      if (e.kind === "person" || e.kind === "sample") e.hit = G.time;
      die(e.kind === "rope" ? "Tripped on the rope!" : e.kind === "banner" ? "Clotheslined by a banner!" :
          e.kind === "kiosk" ? "Smashed into a kiosk!" : e.kind === "sample" ? "Free samples everywhere!" : "Bumped into a shopper!", "obstacle");
      return;
    }
  }
}
