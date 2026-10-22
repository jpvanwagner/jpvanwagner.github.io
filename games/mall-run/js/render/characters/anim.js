/* Procedural animation for the rigs in rig.js.
   Each frame we compute a TARGET pose from the character's state (gait cycle, jump, slide, crash...),
   then ease the real pose toward it — so every transition (land, slide, get-up) blends smoothly.

   Sign conventions (bones rest pointing down/up with identity rotation, character faces -Z):
     thigh/upper-arm  rotation.x > 0  swings the limb FORWARD
     shin             rotation.x < 0  bends the knee
     forearm          rotation.x > 0  bends the elbow
     spine/chest      rotation.x < 0  leans FORWARD                                                      */
import { B, BONES } from "./rig.js";

const N = BONES.length;

/* periodic Catmull-Rom through [phase, value] keys (phase 0..1) */
function curve(keys) {
  const n = keys.length;
  return function (p) {
    p = p - Math.floor(p);
    let i = 0;
    while (i < n - 1 && keys[i + 1][0] <= p) i++;
    const k0 = keys[(i - 1 + n) % n], k1 = keys[i], k2 = keys[(i + 1) % n], k3 = keys[(i + 2) % n];
    const t0 = k1[0], t1 = i + 1 < n ? k2[0] : k2[0] + 1;
    const t = (p - t0) / (t1 - t0 || 1), t2 = t * t, t3 = t2 * t;
    const a = k0[1], b = k1[1], c = k2[1], d = k3[1];
    return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  };
}

// ---- running (left-foot contact at p = 0)
const RUN_THIGH = curve([[0, 0.5], [0.14, 0.12], [0.32, -0.62], [0.48, -0.25], [0.64, 0.55], [0.8, 1.0], [0.92, 0.78]]);
const RUN_KNEE = curve([[0, 0.28], [0.12, 0.62], [0.3, 0.3], [0.44, 1.35], [0.58, 2.05], [0.72, 1.6], [0.86, 0.7]]);
const RUN_ANKLE = curve([[0, 0.2], [0.14, 0.12], [0.32, -0.6], [0.5, -0.35], [0.75, 0.15]]);
// ---- walking
const WALK_THIGH = curve([[0, 0.36], [0.25, 0.02], [0.5, -0.32], [0.62, -0.22], [0.8, 0.22]]);
const WALK_KNEE = curve([[0, 0.06], [0.14, 0.22], [0.4, 0.08], [0.6, 0.55], [0.72, 1.05], [0.88, 0.35]]);
const WALK_ANKLE = curve([[0, 0.22], [0.14, 0.0], [0.48, -0.25], [0.62, -0.35], [0.8, 0.1]]);

class Pose {
  constructor() { this.r = new Float32Array(N * 3); this.hipY = 0; this.hipZ = 0; }
  set(b, x, y, z) { const i = b * 3; this.r[i] = x; this.r[i + 1] = y || 0; this.r[i + 2] = z || 0; }
  add(b, x, y, z) { const i = b * 3; this.r[i] += x; this.r[i + 1] += y || 0; this.r[i + 2] += z || 0; }
  zero() { this.r.fill(0); this.hipY = 0; this.hipZ = 0; }
  lerpFrom(o, t) {          // this = lerp(this, o, t)
    for (let i = 0; i < this.r.length; i++) this.r[i] += (o.r[i] - this.r[i]) * t;
    this.hipY += (o.hipY - this.hipY) * t; this.hipZ += (o.hipZ - this.hipZ) * t;
  }
  copy(o) { this.r.set(o.r); this.hipY = o.hipY; this.hipZ = o.hipZ; }
}

function mix(P, Q, w) { if (w <= 0) return; if (w >= 1) { P.copy(Q); return; } P.lerpFrom(Q, w); }

const TAU = Math.PI * 2;

function runPose(P, p, intensity) {
  P.zero();
  const a = intensity;
  for (const [s, ph] of [["L", p], ["R", p + 0.5]]) {
    P.set(B["th" + s], RUN_THIGH(ph) * a, 0, (s === "L" ? -1 : 1) * 0.04);
    P.set(B["shin" + s], -RUN_KNEE(ph) * (0.35 + 0.65 * a));
    P.set(B["foot" + s], RUN_ANKLE(ph) * a);
    const sw = Math.cos(TAU * (ph - 0.33));
    P.set(B["ua" + s], 0.8 * sw * a - 0.05, 0, (s === "L" ? -1 : 1) * 0.14);
    P.set(B["fa" + s], 1.45 + 0.3 * sw);
    P.set(B["hand" + s], 0.1, 0, 0);
  }
  const tw = Math.cos(TAU * (p - 0.33));
  P.set(B.hips, 0, 0.12 * tw * a, 0.04 * Math.sin(TAU * p) * a);
  P.set(B.spine, -0.2 * a - 0.04, 0, 0);
  P.set(B.chest, -0.04, -0.2 * tw * a, 0);
  P.set(B.neck, 0.12 * a, 0.05 * tw * a, 0);
  P.set(B.head, 0.1 * a, 0.03 * tw, 0);
  P.set(B.hair, 0.35 + 0.25 * Math.sin(TAU * p * 2 + 1.2), 0.15 * tw, 0);
  P.hipY = (-0.05 + 0.04 * Math.cos(2 * TAU * (p - 0.4))) * a;
}

function walkPose(P, p, a, carry) {
  P.zero();
  for (const [s, ph] of [["L", p], ["R", p + 0.5]]) {
    P.set(B["th" + s], WALK_THIGH(ph) * a);
    P.set(B["shin" + s], -WALK_KNEE(ph) * a);
    P.set(B["foot" + s], WALK_ANKLE(ph) * a);
    const sw = Math.cos(TAU * (ph - 0.5));
    P.set(B["ua" + s], 0.32 * sw * a, 0, (s === "L" ? -1 : 1) * 0.08);
    P.set(B["fa" + s], 0.22 + 0.12 * (sw + 1) * a);
  }
  const tw = Math.cos(TAU * p);
  P.set(B.hips, 0, 0.06 * tw * a, 0.03 * Math.sin(TAU * p));
  P.set(B.spine, -0.03, 0, 0);
  P.set(B.chest, 0, -0.08 * tw * a, 0);
  P.set(B.head, 0.02, 0.02 * tw, 0);
  P.set(B.hair, 0.15 + 0.08 * Math.sin(TAU * p * 2), 0, 0);
  P.hipY = (-0.012 + 0.018 * Math.cos(2 * TAU * p)) * a;
  if (carry === "phone") {                         // eyes glued to the screen
    P.set(B.uaR, 0.35, 0, 0.12); P.set(B.faR, 1.7, 0.4, 0); P.set(B.handR, -0.2);
    P.set(B.neck, -0.25); P.set(B.head, -0.45);
  } else if (carry === "tray") {
    P.set(B.uaL, 0.45, 0, -0.2); P.set(B.faL, 1.35, 0, 0); P.set(B.handL, -1.35 + 0.0);
  }
}

function idlePose(P, t, seed, browse) {
  P.zero();
  const br = Math.sin(t * 1.6 + seed);
  P.set(B.chest, 0.015 * br);
  P.set(B.uaL, 0.05, 0, -0.08); P.set(B.uaR, 0.05, 0, 0.08);
  P.set(B.faL, 0.25); P.set(B.faR, 0.25);
  P.set(B.hips, 0, 0, 0.035 * Math.sin(t * 0.45 + seed));
  P.set(B.thL, 0.03); P.set(B.thR, -0.03, 0, 0.04);
  P.set(B.shinR, -0.08);
  P.set(B.head, browse ? -0.12 : 0, browse ? 0.35 * Math.sin(t * 0.35 + seed * 3) : 0.12 * Math.sin(t * 0.3 + seed), 0);
  P.hipY = -0.005 + 0.003 * br;
}

function jumpPose(P, vy) {
  // rising: stretched, one knee driven up; falling: legs reach forward for the landing
  const up = Math.max(0, Math.min(1, vy / 8)), down = Math.max(0, Math.min(1, -vy / 8));
  P.zero();
  P.set(B.thL, 1.05 + 0.25 * down); P.set(B.shinL, -1.25 + 0.5 * down);
  P.set(B.thR, -0.35 + 0.75 * down); P.set(B.shinR, -1.05 + 0.35 * down);
  P.set(B.footL, 0.1); P.set(B.footR, -0.4 + 0.3 * down);
  P.set(B.uaL, -0.55, 0, -0.35); P.set(B.faL, 1.2);
  P.set(B.uaR, 1.25 - 0.4 * down, 0, 0.3); P.set(B.faR, 0.9);
  P.set(B.spine, -0.12 - 0.1 * up); P.set(B.chest, -0.05, 0.15, 0);
  P.set(B.neck, 0.1); P.set(B.head, 0.12);
  P.set(B.hair, 0.1 + 0.9 * down);
  P.hipY = 0.02;
}

function tuckPose(P) {
  P.zero();
  P.set(B.thL, 1.75); P.set(B.thR, 1.6); P.set(B.shinL, -2.25); P.set(B.shinR, -2.2);
  P.set(B.uaL, 1.0, 0, -0.25); P.set(B.uaR, 1.0, 0, 0.25); P.set(B.faL, 1.0); P.set(B.faR, 1.0);
  P.set(B.spine, -0.5); P.set(B.chest, -0.25); P.set(B.neck, -0.2); P.set(B.hair, 1.2);
}

function slidePose(P, t) {
  // baseball slide: lean way back, lead leg straight out, trailing leg folded under, a hand skimming the floor
  P.zero();
  P.set(B.hips, 1.1, 0.2, 0.05);
  P.set(B.thL, 0.45); P.set(B.shinL, -0.08); P.set(B.footL, 0.4);
  P.set(B.thR, -0.6, 0, 0.15); P.set(B.shinR, -1.9); P.set(B.footR, -0.3);
  P.set(B.spine, -0.35); P.set(B.chest, -0.25, -0.2, 0); P.set(B.neck, -0.25); P.set(B.head, -0.3);
  P.set(B.uaR, -0.6, 0, 0.7); P.set(B.faR, 0.2);
  P.set(B.uaL, 1.6, 0, -0.3); P.set(B.faL, 0.6);
  P.set(B.hair, 1.4 + 0.1 * Math.sin(t * 30));
  P.hipY = -0.6; P.hipZ = 0;
}

function landPose(P) {
  P.zero();
  P.set(B.thL, 0.55); P.set(B.thR, 0.35); P.set(B.shinL, -1.0); P.set(B.shinR, -0.95);
  P.set(B.footL, 0.4); P.set(B.footR, 0.35);
  P.set(B.spine, -0.45); P.set(B.uaL, 0.5, 0, -0.4); P.set(B.uaR, 0.4, 0, 0.4); P.set(B.faL, 0.8); P.set(B.faR, 0.8);
  P.set(B.head, 0.3); P.set(B.hair, 0.9);
  P.hipY = -0.2;
}

// crash: recoil -> topple backwards -> lie on the floor
function crashPose(P, t) {
  P.zero();
  if (t < 0.18) {
    const u = t / 0.18;
    P.set(B.spine, 0.45 * u); P.set(B.chest, 0.3 * u); P.set(B.head, 0.5 * u);
    P.set(B.uaL, 2.4 * u, 0, -0.6 * u); P.set(B.uaR, 2.2 * u, 0, 0.7 * u); P.set(B.faL, 0.6); P.set(B.faR, 0.5);
    P.set(B.thL, 0.4 * u); P.set(B.shinL, -0.5 * u); P.set(B.thR, -0.1); P.set(B.shinR, -0.3);
    P.hipZ = 0.15 * u;
  } else {
    const u = Math.min(1, (t - 0.18) / 0.42), e = u * u * (3 - 2 * u);
    P.set(B.hips, 1.45 * e, 0.15 * e, 0.1 * e);
    P.set(B.spine, 0.45 - 0.5 * e); P.set(B.chest, 0.3 - 0.35 * e); P.set(B.neck, -0.2 * e); P.set(B.head, 0.5 - 0.9 * e, 0.4 * e, 0);
    P.set(B.uaL, 2.4 - 0.6 * e, 0, -0.6 - 0.9 * e); P.set(B.uaR, 2.2 - 0.4 * e, 0, 0.7 + 0.8 * e); P.set(B.faL, 0.6); P.set(B.faR, 0.5 + 0.6 * e);
    P.set(B.thL, 0.4 + 0.5 * e); P.set(B.shinL, -0.5 - 0.4 * e); P.set(B.thR, -0.1 + 0.45 * e); P.set(B.shinR, -0.3 - 0.2 * e);
    P.set(B.footL, 0.3 * e); P.set(B.footR, 0.3 * e);
    P.hipY = -0.78 * e; P.hipZ = 0.15 + 0.5 * e;
    if (t > 0.6) { const b = Math.sin(Math.min(1, (t - 0.6) / 0.2) * Math.PI) * 0.05; P.hipY += b; }
  }
}

export class Animator {
  constructor(ch) {
    this.ch = ch; this.cur = new Pose(); this.tgt = new Pose(); this.tmp = new Pose();
    this.first = true;
  }
  /**
   * s: { gait: 'run'|'walk'|'idle', phase, speedK (0..1 stride intensity), t, seed, carry, browse,
   *      air, vy, flip, slide, land (0..1), crashT (>=0 when crashed), roll, yaw }
   */
  update(s, dt) {
    const T = this.tgt, X = this.tmp;
    if (s.crashT >= 0) crashPose(T, s.crashT);
    else if (s.flip > 0) tuckPose(T);
    else if (s.air) jumpPose(T, s.vy);
    else if (s.slide > 0) slidePose(T, s.t);
    else {
      if (s.gait === "run") runPose(T, s.phase, s.speedK == null ? 1 : s.speedK);
      else if (s.gait === "walk") walkPose(T, s.phase, s.speedK == null ? 1 : s.speedK, s.carry);
      else idlePose(T, s.t, s.seed || 0, s.browse);
      if (s.land > 0) { landPose(X); mix(T, X, Math.min(1, s.land) * 0.85); }
    }
    // Ease toward the target. Cyclic gaits need a stiff follow so the stride keeps its full swing.
    const k = s.crashT >= 0 ? 14 : (s.air || s.flip > 0) ? 16 : s.slide > 0 ? 22 : 30;
    if (this.first) { this.cur.copy(T); this.first = false; }
    else this.cur.lerpFrom(T, 1 - Math.exp(-k * dt));
    this.apply(s);
  }
  apply(s) {
    const bones = this.ch.bones, r = this.cur.r, kk = this.ch.k;
    for (let i = 1; i < N; i++) bones[i].rotation.set(r[i * 3], r[i * 3 + 1], r[i * 3 + 2]);
    const hips = bones[B.hips], rest = this.ch.rest[B.hips];
    hips.position.set(rest.x, rest.y + this.cur.hipY * kk, rest.z + this.cur.hipZ * kk);
    if (s.flip > 0) hips.rotation.x -= s.flip;              // somersault around the hips
    bones[0].rotation.set(0, s.yaw || 0, s.roll || 0);
  }
}
