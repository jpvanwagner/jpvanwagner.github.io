/* Procedural low-poly people. Each character is ONE SkinnedMesh (one draw call) built from rounded
   parts rigidly bound to a 19-bone skeleton. Characters face -Z; the root sits at the feet. */
import * as THREE from "three";

export const BONES = ["root", "hips", "spine", "chest", "neck", "head", "hair",
  "uaL", "faL", "handL", "uaR", "faR", "handR",
  "thL", "shinL", "footL", "thR", "shinR", "footR"];
export const B = {}; BONES.forEach((n, i) => { B[n] = i; });
const PARENT = { hips: "root", spine: "hips", chest: "spine", neck: "chest", head: "neck", hair: "head",
  uaL: "chest", faL: "uaL", handL: "faL", uaR: "chest", faR: "uaR", handR: "faR",
  thL: "hips", shinL: "thL", footL: "shinL", thR: "hips", shinR: "thR", footR: "shinR" };

export const CHAR_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });

/* ---- part prototypes (non-indexed) ---- */
function P(g) { return g; }
const G = {
  sphere: P(new THREE.SphereGeometry(1, 12, 8)),
  sphereLo: P(new THREE.SphereGeometry(1, 8, 6)),
  cap: P(new THREE.SphereGeometry(1, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.56)),
  capBack: P(new THREE.SphereGeometry(1, 12, 8, Math.PI * 0.12, Math.PI * 0.76, 0, Math.PI * 0.78)),  // covers back + sides
  box: P(new THREE.BoxGeometry(1, 1, 1)),
  cyl: P(new THREE.CylinderGeometry(1, 1, 1, 10, 1)),
  cone: P(new THREE.CylinderGeometry(0.62, 1, 1, 12, 1, true)),
  torus: P(new THREE.TorusGeometry(1, 0.12, 5, 10))
};
function capsule(r, len) { return P(new THREE.CapsuleGeometry(r, len, 3, 9)); }
const capCache = new Map();
function cap(r, len) { const k = r.toFixed(3) + ":" + len.toFixed(3); let g = capCache.get(k); if (!g) { g = capsule(r, len); capCache.set(k, g); } return g; }

/* ---- appearance ---- */
export const SKINS = ["#f2cfae", "#e8b98c", "#d39b6a", "#b07a4f", "#8a5a3a", "#5e3c26"];
const HAIRS = ["#2b1d14", "#3a2a1c", "#5a3a22", "#8a5a2a", "#c9a24a", "#e0c27a", "#7a2f1f", "#9a9a9a", "#1a1a1a"];
const SHIRTS = ["#7a9e6b", "#a5738c", "#6b83a8", "#c9784f", "#4a8a80", "#b08a5a", "#e9e2d0", "#3a4a5a", "#c85440", "#f0c85a", "#e39ab4", "#5a3a6a", "#2f5a8a", "#ffffff"];
const PANTS = ["#33465e", "#3a4a5a", "#222228", "#7a5a3a", "#5a6b7a", "#c9bda0", "#4a4a4a", "#2f3a4a", "#6a3a3a"];
const SHOES = ["#f4f1ea", "#2b2b2b", "#7a4a2a", "#c85440", "#3a4a6a", "#e9e2d0"];

export function randomAppearance(rng, kid) {
  const build = rng.chance(0.5) ? "a" : "b";
  const styles = build === "a" ? ["short", "short", "buzz", "cap", "afro", "bald", "short"] : ["long", "ponytail", "bun", "long", "afro", "short", "ponytail"];
  return {
    build, kid: !!kid,
    height: kid ? rng.range(1.05, 1.35) : rng.range(1.58, 1.9) * (build === "b" ? 0.96 : 1),
    girth: kid ? rng.range(0.9, 1.1) : rng.pick([rng.range(0.86, 0.95), rng.range(0.95, 1.1), rng.range(1.1, 1.28)]),
    skin: rng.pick(SKINS), hair: rng.chance(0.08) ? "#9a9a9a" : rng.pick(HAIRS), hairStyle: rng.pick(styles),
    shirt: rng.pick(SHIRTS), shirtStyle: rng.pick(["tee", "tee", "long", "jacket", "tank"]),
    pants: rng.pick(PANTS), legStyle: build === "b" ? rng.pick(["pants", "skirt", "shorts", "pants"]) : rng.pick(["pants", "pants", "shorts"]),
    shoes: rng.pick(SHOES), jacket: rng.pick(["#3a4a5a", "#7a5a3a", "#2b2b2b", "#8a3f3f", "#4a6a5a"]),
    bag: !kid && rng.chance(0.45) ? rng.pick(["#e39ab4", "#f4f1ea", "#c9a24a", "#3fa89b", "#c85440", "#2b2b2b"]) : null,
    bagSide: rng.chance(0.5) ? "L" : "R",
    backpack: rng.chance(kid ? 0.5 : 0.12) ? rng.pick(["#c85440", "#3a5a8a", "#2f7a4a", "#f0c85a"]) : null,
    glasses: rng.chance(0.18), capColor: rng.pick(["#c85440", "#2f5a8a", "#2b2b2b", "#3f9d5a"])
  };
}

/* ---- builder ---- */
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Matrix3();

export function buildCharacter(ap) {
  const H = ap.height, k = H / 1.78;                     // proportions are authored for a 1.78 m adult
  const kid = ap.kid, headScale = kid ? 1.18 : 1;
  const wide = ap.build === "a" ? 1.0 : 0.9, hipW = ap.build === "a" ? 0.95 : 1.08, g = ap.girth;

  // ---- skeleton (bind pose: identity rotations, offsets only)
  const off = {
    hips: [0, 0.95, 0], spine: [0, 0.1, 0], chest: [0, 0.2, 0], neck: [0, 0.25, 0], head: [0, 0.08, 0], hair: [0, 0.12, 0.06],
    uaL: [-0.185 * wide * g, 0.2, 0], faL: [0, -0.28, 0], handL: [0, -0.255, 0],
    uaR: [0.185 * wide * g, 0.2, 0], faR: [0, -0.28, 0], handR: [0, -0.255, 0],
    thL: [-0.095 * hipW, -0.04, 0], shinL: [0, -0.42, 0], footL: [0, -0.42, 0],
    thR: [0.095 * hipW, -0.04, 0], shinR: [0, -0.42, 0], footR: [0, -0.42, 0]
  };
  const bones = [], world = {};
  for (const name of BONES) {
    const b = new THREE.Bone(); b.name = name;
    const o = off[name] || [0, 0, 0];
    b.position.set(o[0] * k, o[1] * k, o[2] * k);
    bones.push(b);
    if (PARENT[name]) bones[B[PARENT[name]]].add(b);
    const pw = PARENT[name] ? world[PARENT[name]] : [0, 0, 0];
    world[name] = [pw[0] + b.position.x, pw[1] + b.position.y, pw[2] + b.position.z];
  }

  // ---- mesh parts, each rigidly bound to one bone
  const pos = [], nor = [], colr = [], si = [], sw = [], idx = [];
  function part(geo, bone, x, y, z, sx, sy, sz, color, rx, ry, rz) {
    const bw = world[bone];
    _e.set(rx || 0, ry || 0, rz || 0); _q.setFromEuler(_e);
    _m.compose(_v.set(bw[0] + x * k, bw[1] + y * k, bw[2] + z * k), _q, _s.set(sx * k, sy * k, sz * k));
    _n.getNormalMatrix(_m);
    const c = new THREE.Color(color), P = geo.attributes.position.array, N = geo.attributes.normal.array, bi = B[bone];
    const base = pos.length / 3, cnt = geo.attributes.position.count;
    if (geo.index) { const I = geo.index.array; for (let i = 0; i < I.length; i++) idx.push(base + I[i]); }
    else for (let i = 0; i < cnt; i++) idx.push(base + i);
    for (let i = 0; i < cnt; i++) {
      _v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).applyMatrix4(_m); pos.push(_v.x, _v.y, _v.z);
      _v.set(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]).applyMatrix3(_n).normalize(); nor.push(_v.x, _v.y, _v.z);
      colr.push(c.r, c.g, c.b); si.push(bi, 0, 0, 0); sw.push(1, 0, 0, 0);
    }
  }
  const limb = (bone, r, len, color, x, z) => part(cap(r, len), bone, x || 0, -len / 2 - r * 0.3, z || 0, 1, 1, 1, color);

  const skin = ap.skin, shirt = ap.shirtStyle === "jacket" ? ap.jacket : ap.shirt, pants = ap.pants;
  // legs
  const legTop = ap.legStyle === "pants" ? pants : skin;
  for (const s of ["L", "R"]) {
    if (ap.legStyle === "shorts") { part(cap(0.075 * g, 0.16), "th" + s, 0, -0.1, 0, 1, 1, 1, pants); limb("th" + s, 0.064 * g, 0.34, skin); }
    else limb("th" + s, 0.07 * g, 0.36, legTop);
    limb("shin" + s, 0.056, 0.36, ap.legStyle === "pants" ? pants : skin);
    part(G.box, "foot" + s, 0, -0.025, -0.055, 0.105, 0.075, 0.25, ap.shoes);
    part(G.box, "foot" + s, 0, -0.058, -0.05, 0.11, 0.015, 0.255, "#e9e2d0");      // sole
  }
  // pelvis + skirt
  part(G.sphere, "hips", 0, 0.02, 0, 0.165 * hipW * g, 0.12, 0.12 * g, pants);
  if (ap.legStyle === "skirt") part(G.cone, "hips", 0, -0.14, 0, 0.21 * hipW * g, 0.34, 0.17 * g, pants);
  // torso
  part(G.sphere, "spine", 0, 0.07, 0, 0.15 * g, 0.15, 0.11 * g, ap.shirtStyle === "tank" ? ap.shirt : shirt);
  part(G.sphere, "chest", 0, 0.1, 0, 0.19 * wide * g, 0.17, 0.12 * g, shirt);
  if (ap.shirtStyle === "jacket") {                                             // open jacket shows the shirt
    part(G.box, "chest", 0, 0.05, -0.105 * g, 0.1, 0.26, 0.03, ap.shirt);
    part(G.box, "spine", 0, 0.06, -0.1 * g, 0.09, 0.2, 0.03, ap.shirt);
  }
  if (ap.build === "b" && !kid) part(G.sphere, "chest", 0, 0.08, -0.05 * g, 0.15 * g, 0.08, 0.07, shirt);
  if (g > 1.1) part(G.sphere, "spine", 0, 0.11, -0.015 * g, 0.175 * g, 0.21, 0.14 * g, ap.shirtStyle === "tank" ? ap.shirt : shirt);   // fuller midsection
  part(G.cyl, "neck", 0, 0.03, 0, 0.048 * Math.sqrt(g), 0.12, 0.048 * Math.sqrt(g), skin);
  // arms
  const sleeve = ap.shirtStyle === "long" || ap.shirtStyle === "jacket" ? shirt : skin;
  for (const s of ["L", "R"]) {
    const ua = "ua" + s, fa = "fa" + s, hand = "hand" + s;
    part(G.sphere, ua, 0, -0.01, 0, 0.068 * g, 0.07, 0.068 * g, ap.shirtStyle === "tank" ? skin : shirt);
    if (ap.shirtStyle === "tee") { part(cap(0.058 * g, 0.1), ua, 0, -0.08, 0, 1, 1, 1, shirt); limb(ua, 0.045 * g, 0.22, skin); }
    else limb(ua, 0.05 * g, 0.21, ap.shirtStyle === "tank" ? skin : sleeve);
    limb(fa, 0.042, 0.2, sleeve);
    part(G.sphere, hand, 0, -0.045, 0, 0.042, 0.055, 0.03, skin);
  }
  // head
  const hs = headScale;
  part(G.sphere, "head", 0, 0.1, 0, 0.105 * hs, 0.122 * hs, 0.112 * hs, skin);
  part(G.sphere, "head", 0, 0.035, -0.035, 0.07 * hs, 0.06 * hs, 0.08 * hs, skin);          // jaw
  part(G.sphereLo, "head", 0, 0.085, -0.115 * hs, 0.018, 0.024, 0.018, skin);               // nose
  for (const s of [-1, 1]) {
    part(G.sphereLo, "head", s * 0.04 * hs, 0.115, -0.098 * hs, 0.016, 0.019, 0.01, "#1d1a18");   // eyes
    part(G.box, "head", s * 0.04 * hs, 0.148, -0.1 * hs, 0.04, 0.008, 0.01, shadeHex(ap.hair, 0.8)); // brows
    part(G.sphereLo, "head", s * 0.104 * hs, 0.095, 0.0, 0.02, 0.032, 0.022, skin);                // ears
  }
  part(G.box, "head", 0, 0.045, -0.108 * hs, 0.04, 0.008, 0.01, "#9a4a42");                // mouth
  if (ap.glasses) {
    for (const s of [-1, 1]) part(G.torus, "head", s * 0.042 * hs, 0.113, -0.112 * hs, 0.026, 0.024, 0.02, "#1d1d1d");
    part(G.box, "head", 0, 0.115, -0.114 * hs, 0.03, 0.006, 0.006, "#1d1d1d");
  }
  hair(part, ap, hs);
  // accessories
  if (ap.bag) {
    const h = "hand" + ap.bagSide;
    part(G.box, h, 0, -0.24, 0, 0.09, 0.28, 0.3, ap.bag);
    part(G.box, h, 0, -0.08, 0, 0.012, 0.1, 0.012, "#3a3a3a");
  }
  if (ap.backpack) {
    part(G.box, "chest", 0, 0.04, 0.16 * g, 0.26, 0.32, 0.12, ap.backpack);
    part(G.box, "chest", 0, 0.0, 0.225 * g, 0.2, 0.14, 0.03, shadeHex(ap.backpack, 0.8));
  }
  if (ap.prop === "phone") { part(G.box, "handR", 0, -0.07, -0.02, 0.07, 0.13, 0.012, "#1a1a1a"); }
  if (ap.prop === "tray") {
    part(G.cyl, "handL", 0.0, -0.06, -0.08, 0.2, 0.012, 0.2, "#d8d8d8");
    for (let i = 0; i < 5; i++) part(G.cyl, "handL", Math.cos(i * 1.26) * 0.12, -0.03, -0.08 + Math.sin(i * 1.26) * 0.12, 0.025, 0.05, 0.025, i % 2 ? "#ffffff" : "#c9874a");
  }
  if (ap.apron) part(G.box, "spine", 0, 0.02, -0.12 * g, 0.24, 0.42, 0.02, ap.apron);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colr, 3));
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
  geo.setIndex(idx);

  const mesh = new THREE.SkinnedMesh(geo, CHAR_MAT);
  mesh.add(bones[0]);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.frustumCulled = false;
  const root = new THREE.Group();
  root.add(mesh);
  return { root, mesh, bones, ap, k, rest: bones.map(b => b.position.clone()) };
}

function hair(part, ap, hs) {
  const c = ap.hair, st = ap.hairStyle, r = 0.118 * hs;
  if (st === "bald") return;
  if (st === "cap") {
    part(G.cap, "head", 0, 0.115, 0.004, r * 1.04, r * 1.0, r * 1.04, ap.capColor, 0.42);
    part(G.box, "head", 0, 0.125, -0.15 * hs, 0.17, 0.014, 0.1, ap.capColor, -0.1);
    part(G.capBack, "head", 0, 0.1, 0.01, r * 1.02, r * 1.05, r * 1.04, c);
    return;
  }
  if (st === "afro") { part(G.sphere, "head", 0, 0.16, 0.03, 0.165 * hs, 0.15 * hs, 0.155 * hs, c); return; }
  const thin = st === "buzz" ? 1.0 : 1.06;
  part(G.cap, "head", 0, 0.105, 0.008, r * thin, r * (st === "buzz" ? 1.06 : 1.08), r * thin * 1.02, c, st === "buzz" ? 0.38 : 0.5);   // tilted back: hairline above the eyes
  if (st !== "buzz") part(G.capBack, "head", 0, 0.09, 0.012, r * 1.05, r * 1.12, r * 1.06, c);
  if (st === "short") part(G.box, "head", 0.02, 0.2, -0.085 * hs, 0.17, 0.035, 0.06, c, 0.3, 0, 0.1);   // swept fringe
  if (st === "long") {
    part(G.box, "hair", 0, -0.13, 0.03, 0.23 * hs, 0.32, 0.07, c);
    for (const s of [-1, 1]) part(G.box, "head", s * 0.105 * hs, 0.01, -0.01, 0.04, 0.2, 0.12, c);
  }
  if (st === "ponytail") {
    part(G.sphere, "hair", 0, -0.02, 0.02, 0.045, 0.045, 0.045, shadeHex(c, 0.7));
    part(G.sphere, "hair", 0, -0.13, 0.05, 0.055, 0.12, 0.05, c);
  }
  if (st === "bun") part(G.sphere, "head", 0, 0.22, 0.07, 0.07, 0.065, 0.07, c);
}

function shadeHex(hex, f) { const c = new THREE.Color(hex); c.multiplyScalar(f); return c; }

let shadowMat = null;
function SHADOW_MAT(tex) { return shadowMat || (shadowMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); }

/** Small rounded blob shadow under a character. */
export function makeShadow(tex, size) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), SHADOW_MAT(tex));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 1;
  return m;
}
