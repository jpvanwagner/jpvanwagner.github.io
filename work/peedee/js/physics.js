'use strict';
/* ============================== SHARED HELPERS + PHYSICS ==============================
   Everything between the PHYSICS and LEVELS markers is also loaded by tools/validate-levels.mjs,
   which simulates PeeDee's real jump on every level to prove each spot and exit can be reached. */
// <PHYSICS>
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
/* World scale: the mouth is built WS times bigger than PeeDee and friends. Levels are written at 1x in
   levels.js and scaled up when built; PeeDee's movement scales with them so jumps feel the same. */
const WS = 1.8;
const PHYS = {
  RUN: 2.1 * WS, ACC_G: 0.4 * WS, ACC_A: 0.28 * WS, FRIC: 0.7, AIR_FRIC: 0.9,
  JUMP_V: -6 * WS, G_UP: 0.27 * WS, G_DOWN: 0.46 * WS, CUT: -2.2 * WS, TERM: 6.2 * WS,
  COYOTE: 7, BUFFER: 7, PW: 10, PH: 18, STEP: 8 * WS
};
function overlaps(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

/* Moves a body through the world: solid boxes block on every side, one-way ledges only from above. */
/* The tongue's surface height at x: rolling hills, a slow ripple, and any surges rolling along it.
   prev = true gives the height one frame earlier (to tell how fast the surface is heaving up). */
function tongueY(T, x, t, prev) {
  x = clamp(x, T.x0, T.x1);
  const ramp = 60 * WS, f = x < T.flat - ramp ? 1 : x > T.flat ? 0.25 : lerp(1, 0.25, (x - T.flat + ramp) / ramp);
  let y = T.base;
  for (const [a, k, ph] of T.hills) y -= a * f * Math.sin(x * k + ph);
  y += T.wave * Math.sin(x * 0.045 / WS - (prev ? t - 1 : t) * 0.05);
  if (T.pulses) for (const p of T.pulses) { const d = (x - (prev ? p.px : p.x)) / p.w; y -= p.a * Math.exp(-d * d); }
  return y;
}

/* Moves a body through the world: solid boxes block on every side (small lips are stepped up), one-way
   ledges only hold from above, and the tongue is a squishy surface that follows its own ripples. */
function moveBody(b, world) {
  b.hitWall = 0;
  const prevGround = b.ground;
  if (b.ground && b.ground.dy) b.y += b.ground.dy;          // ride bobbing platforms
  b.x += b.vx;
  for (const s of world.solids) {
    if (s.off || !overlaps(b, s)) continue;
    const lip = b.y + b.h - s.y;
    if (prevGround && lip > 0 && lip <= (b.step || 0) &&
        !world.solids.some(o => o !== s && !o.off && overlaps({ x: b.x, y: s.y - b.h, w: b.w, h: b.h }, o))) { b.y = s.y - b.h; continue; }
    if (b.vx > 0) { b.x = s.x - b.w; b.hitWall = 1; }
    else if (b.vx < 0) { b.x = s.x + s.w; b.hitWall = -1; }
    b.vx = 0;
  }
  if (b.x < world.left) { b.x = world.left; b.vx = 0; b.hitWall = -1; }
  if (b.x + b.w > world.right) { b.x = world.right - b.w; b.vx = 0; b.hitWall = 1; }
  const prevBottom = b.y + b.h;
  b.y += b.vy;
  b.grounded = false; b.ground = null; b.bonked = false;
  for (const s of world.solids) {
    if (s.off || !overlaps(b, s)) continue;
    if (b.vy > 0) { b.y = s.y - b.h; b.grounded = true; b.ground = s; }
    else if (b.vy < 0) { b.y = s.y + s.h; b.bonked = true; }
    b.vy = 0;
  }
  if (b.vy >= 0 && !(b.drop > 0)) {
    let best = null;
    for (const p of world.oneways) {
      if (p.off || b.x + b.w <= p.x || b.x >= p.x + p.w) continue;
      const tol = prevGround && prevGround !== p ? Math.max(1, b.step || 0) : 1;   // walk up onto a slightly higher ledge
      if (prevBottom <= p.y + tol + Math.abs(p.dy || 0) && b.y + b.h >= p.y && (!best || p.y < best.y)) best = p;
    }
    if (best) { b.y = best.y - b.h; b.vy = 0; b.grounded = true; b.ground = best; }
  }
  const T = world.tongue;
  if (T && !b.grounded && b.vy >= 0) {
    const cx = b.x + b.w / 2, now = world.time || 0;
    if (cx >= T.x0 && cx <= T.x1) {
      const fy = tongueY(T, cx, now);
      if (b.y + b.h >= fy || (prevGround === T && b.y + b.h >= fy - 5 * WS)) {
        const rise = fy - tongueY(T, cx, now, true);              // negative while the tongue heaves up
        b.y = fy - b.h; b.vy = 0; b.grounded = true; b.ground = T;
        if (rise < -0.9 * WS && !b.noLaunch) { b.vy = rise * 2.6; b.grounded = false; b.ground = null; b.launched = true; }
      }
    }
  }
}

/* One 60 Hz step of PeeDee's movement. inp = { left, right, down, jumpHeld, jumpPressed }. */
function stepPlayer(b, inp, world, P) {
  P = P || PHYS;
  const ev = { jumped: false, dropped: false, landed: 0 };
  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  if (dir) {
    b.vx += dir * (b.grounded ? P.ACC_G : P.ACC_A);
    if (b.vx * dir > P.RUN) b.vx = dir * P.RUN;
  } else {
    b.vx *= b.grounded ? P.FRIC : P.AIR_FRIC;
    if (Math.abs(b.vx) < 0.05) b.vx = 0;
  }
  if (b.grounded) b.coyote = P.COYOTE; else if (b.coyote > 0) b.coyote--;
  if (inp.jumpPressed) b.buffer = P.BUFFER; else if (b.buffer > 0) b.buffer--;
  if (b.drop > 0) b.drop--;
  if (b.buffer > 0 && b.coyote > 0) {
    if (inp.down && b.ground && b.ground.oneway) { b.drop = 12; ev.dropped = true; }
    else { b.vy = P.JUMP_V; b.jumping = true; ev.jumped = true; }
    b.buffer = 0; b.coyote = 0; b.grounded = false; b.ground = null;
  }
  if (b.jumping && !inp.jumpHeld && b.vy < P.CUT) b.vy = P.CUT;
  b.vy += (b.vy < 0 && inp.jumpHeld) ? P.G_UP : P.G_DOWN;
  if (b.vy > P.TERM) b.vy = P.TERM;
  if (b.vy >= 0) b.jumping = false;
  const was = b.grounded, vyBefore = b.vy;
  moveBody(b, world);
  if (b.grounded && !was) ev.landed = vyBefore;
  if (b.grounded && !was && b.ground && b.ground.bouncy && vyBefore > 2.6 * WS) {     // big drops onto the tongue bounce
    b.vy = -vyBefore * 0.5; b.grounded = false; b.ground = null; b.coyote = P.COYOTE; ev.bounced = vyBefore;
  }
  return ev;
}
// </PHYSICS>
