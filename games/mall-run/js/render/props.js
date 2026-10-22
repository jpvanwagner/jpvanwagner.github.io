/* Gameplay props: coins (instanced), power-up orbs, obstacles (kiosk, rope, banner) and the walkway barrier. */
import * as THREE from "three";
import { GeoBatch, shade, makeProto } from "./geo.js";
import { signTexture, glyphTexture } from "./textures.js";
import { MAT } from "./world.js";
import { POWER_COLORS, POWER_GLYPH } from "../config.js";

/* ---------------- coins ---------------- */
export class Coins {
  constructor(scene, max) {
    const g = new THREE.CylinderGeometry(0.27, 0.27, 0.06, 18);
    g.rotateX(Math.PI / 2);
    const rim = new THREE.TorusGeometry(0.27, 0.025, 4, 18);
    const geo = mergeSimple([g, rim]);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshPhongMaterial({ color: 0xf2c043, emissive: 0x6a4300, specular: 0xfff1b0, shininess: 70 }), max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.max = max;
    scene.add(this.mesh);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3();
  }
  begin() { this.n = 0; }
  put(x, y, z, spin, scale) {
    if (this.n >= this.max) return;
    this.e.set(0, spin, 0); this.q.setFromEuler(this.e);
    this.m.compose(this.v.set(x, y, z), this.q, this.s.set(scale, scale, scale));
    this.mesh.setMatrixAt(this.n++, this.m);
  }
  end() { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; }
}

function mergeSimple(geos) {
  const b = new GeoBatch();
  for (const g of geos) b.add(makeProto(g), new THREE.Matrix4(), "#ffffff");
  const geo = b.geometry(); geo.deleteAttribute("color");
  return geo;
}

/* ---------------- power-up orbs ---------------- */
const GEM = new THREE.OctahedronGeometry(0.32, 0);
export function makePower(kind) {
  const col = POWER_COLORS[kind] || "#6fe0cf";
  const g = new THREE.Group();
  const gem = new THREE.Mesh(GEM, new THREE.MeshPhongMaterial({ color: col, emissive: col, emissiveIntensity: 0.55, shininess: 90, flatShading: true }));
  gem.userData.ownMat = true;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyphTexture(POWER_GLYPH[kind] || "?", col), depthWrite: false, transparent: true }));
  sp.scale.set(1.15, 1.15, 1); sp.userData.ownMat = true;
  g.add(gem); g.add(sp);
  g.userData.gem = gem;
  return g;
}

/* ---------------- static obstacle meshes (built once, shared geometry) ---------------- */
const cache = {};
function batchMesh(build) {
  const S = new GeoBatch(), GL = new GeoBatch(), GW = new GeoBatch();
  const signs = [];
  build({ S, GL, GW, sign: (tex, x, y, z, w, h, ry) => signs.push({ tex, x, y, z, w, h, ry }) });
  const grp = { solid: S.empty ? null : S.geometry(), glass: GL.empty ? null : GL.geometry(), glow: GW.empty ? null : GW.geometry(), signs };
  return grp;
}
function instantiate(def) {
  const g = new THREE.Group();
  if (def.solid) g.add(new THREE.Mesh(def.solid, MAT.solid));
  if (def.glow) g.add(new THREE.Mesh(def.glow, MAT.glow));
  if (def.glass) { const m = new THREE.Mesh(def.glass, MAT.glass); m.renderOrder = 2; g.add(m); }
  for (const s of def.signs) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), new THREE.MeshBasicMaterial({ map: s.tex, side: THREE.DoubleSide }));
    m.position.set(s.x, s.y, s.z); m.rotation.y = s.ry || 0; m.userData.ownMat = true; m.userData.ownGeo = true;
    g.add(m);
  }
  return g;
}

const KIOSK_LABEL = { toys: "TOYS", shades: "SHADES", phones: "PHONE CASES", jewelry: "JEWELRY" };
function kioskDef(type) {
  return cache["k" + type] || (cache["k" + type] = batchMesh(({ S, GL, GW, sign }) => {
    const wood = "#a97e4e", top = "#c7a06a";
    S.box(0, 0.5, 0, 2.0, 1.0, 1.5, wood);                          // counter base
    S.box(0, 1.02, 0, 2.1, 0.05, 1.6, top);
    S.box(0, 0.08, 0, 2.05, 0.16, 1.55, shade(wood, 0.6));
    GL.box(0, 1.33, 0, 1.9, 0.56, 1.4, "#d8ecf0");                  // glass case
    S.box(0, 1.62, 0, 1.92, 0.03, 1.42, "#e8e8e8");
    for (const [x, z] of [[-0.95, -0.7], [0.95, -0.7], [-0.95, 0.7], [0.95, 0.7]]) S.box(x, 1.95, z, 0.06, 1.85, 0.06, "#d8d2c4");
    S.box(0, 2.9, 0, 2.3, 0.12, 1.8, "#3fa89b");                     // canopy
    S.box(0, 3.02, 0, 1.6, 0.12, 1.2, shade("#3fa89b", 0.8));
    S.box(0, 2.62, -0.78, 1.9, 0.42, 0.06, "#2b2822");                // sign band (front)
    S.box(0, 2.62, 0.78, 1.9, 0.42, 0.06, "#2b2822");
    sign(signTexture(KIOSK_LABEL[type], { bg: "#2b2822", fg: "#f0c85a", font: "head", upper: true }), 0, 2.62, 0.815, 1.8, 0.4, 0);
    GW.box(0, 2.82, 0, 1.6, 0.02, 1.2, "#fff4dc");
    // goods inside the case
    const y = 1.12;
    if (type === "toys") {
      S.sphere(-0.55, y + 0.15, 0, 0.17, "#b07a3c"); S.sphere(-0.55, y + 0.38, 0, 0.12, "#b07a3c");
      S.box(0.1, y + 0.08, -0.1, 0.4, 0.12, 0.14, "#c0553f"); S.box(0.1, y + 0.1, -0.1, 0.12, 0.04, 0.5, "#3fa89b");
      S.box(0.6, y + 0.09, 0.1, 0.18, 0.18, 0.18, "#7a5aa0"); S.box(0.62, y + 0.27, 0.1, 0.15, 0.15, 0.15, "#f0c85a");
    } else if (type === "shades") {
      for (let i = 0; i < 5; i++) { const x = -0.72 + i * 0.36; S.sphere(x - 0.06, y + 0.06, -0.1, 0.06, "#1d1d1d", 0.8, true); S.sphere(x + 0.06, y + 0.06, -0.1, 0.06, "#1d1d1d", 0.8, true); S.box(x, y + 0.08, -0.1, 0.05, 0.01, 0.01, "#c9a24a"); }
      S.box(0, y + 0.5, 0.55, 1.6, 0.9, 0.05, "#e9e2d0");
    } else if (type === "phones") {
      ["#c0553f", "#3fa89b", "#7a5aa0", "#f0c85a", "#e39ab4"].forEach((c, i) => { S.box(-0.7 + i * 0.35, y + 0.02, 0, 0.17, 0.03, 0.32, c); });
      S.box(0, y + 0.55, 0.55, 1.6, 0.9, 0.05, "#2b2b2b");
      for (let i = 0; i < 4; i++) GW.box(-0.55 + i * 0.37, y + 0.55, 0.52, 0.16, 0.3, 0.01, "#9ad8f0");
    } else {
      for (let i = 0; i < 4; i++) { S.torus(-0.6 + i * 0.4, y + 0.08, 0, 0.09, "#f0c85a", Math.PI / 2); GW.sphere(-0.6 + i * 0.4, y + 0.04, -0.2, 0.025, "#ffffff", 1, true); }
      S.box(0, y + 0.45, 0.55, 1.4, 0.8, 0.05, "#2a2630");
    }
  }));
}
function ropeDef() {
  return cache.rope || (cache.rope = batchMesh(({ S }) => {
    for (const x of [-1.1, 1.1]) {
      S.cyl(x, 0.02, 0, 0.2, 0.04, "#b8952e");
      S.cyl(x, 0.48, 0, 0.035, 0.94, "#d9b84a");
      S.sphere(x, 0.98, 0, 0.065, "#e8c95a");
    }
    // sagging velvet rope as a chain of short segments
    const n = 14, pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n, x = -1.05 + 2.1 * t; pts.push([x, 0.92 - Math.sin(t * Math.PI) * 0.22]); }
    for (let i = 0; i < n; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
      S.cyl((x0 + x1) / 2, (y0 + y1) / 2, 0, 0.035, len + 0.02, "#8c1f2e", true, 0, ang - Math.PI / 2);
    }
  }));
}
const BANNER_TEXT = ["GRAND OPENING!", "BIG SALE TODAY", "50% OFF", "MEGA SALE", "NEW ARRIVALS"];
function bannerDef(i) {
  return cache["b" + i] || (cache["b" + i] = batchMesh(({ S, sign }) => {
    for (const x of [-1.15, 1.15]) { S.cyl(x, 0.02, 0, 0.22, 0.04, "#555"); S.cyl(x, 1.05, 0, 0.035, 2.1, "#bbb"); S.sphere(x, 2.12, 0, 0.05, "#ddd"); }
    S.box(0, 1.62, 0, 2.3, 0.72, 0.03, "#c85440");
    sign(signTexture(BANNER_TEXT[i], { bg: "#c85440", fg: "#ffffff", font: "condensed", upper: true }), 0, 1.62, -0.02, 2.2, 0.55, Math.PI);
    sign(signTexture(BANNER_TEXT[i], { bg: "#c85440", fg: "#ffffff", font: "condensed", upper: true }), 0, 1.62, 0.02, 2.2, 0.55, 0);
    for (let k = 0; k < 6; k++) S.cone(-1.0 + k * 0.4, 1.2, 0, 0.12, 0.16, k % 2 ? "#f0c85a" : "#ffffff");
  }));
}
function barrierDef() {
  return cache.barrier || (cache.barrier = batchMesh(({ S, sign }) => {
    for (const x of [-1.25, 1.25]) { S.box(x, 0.6, 0, 0.1, 1.2, 0.1, "#d8d2c4"); S.box(x, 0.03, 0, 0.5, 0.06, 0.4, "#555"); }
    for (const y of [0.5, 0.95]) for (let k = 0; k < 8; k++) S.box(-1.1 + k * 0.315, y, 0, 0.3, 0.26, 0.05, k % 2 ? "#ffffff" : "#e8752a", 0, 0, 0);
    S.box(0, 1.7, 0, 1.6, 0.5, 0.06, "#e8c547");
    sign(signTexture("CLOSED - JUMP DOWN", { bg: "#e8c547", fg: "#2b2822", font: "condensed", upper: true }), 0, 1.7, 0.04, 1.5, 0.38, 0);
    S.box(0, 1.2, 0, 0.06, 0.5, 0.06, "#555");
  }));
}

export function makeObstacleMesh(e) {
  let def;
  if (e.kind === "kiosk") def = kioskDef(e.kioskType || "toys");
  else if (e.kind === "rope") def = ropeDef();
  else if (e.kind === "banner") def = bannerDef((e.seed || 0) % BANNER_TEXT.length);
  else if (e.type === "barrier") def = barrierDef();
  return def ? instantiate(def) : null;
}

