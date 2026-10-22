/* Builds and recycles the mall around the path: corridor shells, two-level walkways, junctions and shops.
   Each path piece (48 m block or square junction) becomes one THREE.Group of a few merged meshes.
   Building is time-sliced (generator functions) so new blocks never cause a frame hitch. */
import * as THREE from "three";
import * as C from "../config.js";
import { GeoBatch, shade } from "./geo.js";
import { makeRng } from "../rng.js";
import { STORE_TYPES } from "./stores/catalog.js";
import { buildStore } from "./stores/facade.js";
import { floorTexture, arrowTexture, signTexture } from "./textures.js";
import { registerDoor } from "../game/crowd.js";

const H = C.UPPER_H, VH = C.VOID_HALF, HALF = C.CW / 2;
const WARM = "#fff4dc";

/* ---------------- materials (shared) ---------------- */
export const MAT = {
  solid: new THREE.MeshLambertMaterial({ vertexColors: true }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
  glass: new THREE.MeshPhongMaterial({ vertexColors: true, transparent: true, opacity: 0.3, shininess: 110, specular: 0x777777, depthWrite: false }),
  floors: new Map(), signs: new Map()
};
function floorMat(theme) {
  let m = MAT.floors.get(theme.name);
  if (!m) { m = new THREE.MeshPhongMaterial({ map: floorTexture(theme), shininess: 60, specular: theme.name === "garage" ? 0x111111 : 0x3a3a3a }); MAT.floors.set(theme.name, m); }
  return m;
}
function signMat(tex) {
  let m = MAT.signs.get(tex);
  if (!m) {
    const tr = tex.userData && tex.userData.transparent;
    m = new THREE.MeshBasicMaterial({ map: tex, transparent: !!tr, alphaTest: tr ? 0.15 : 0 });
    MAT.signs.set(tex, m);
  }
  return m;
}
const PLANE = new THREE.PlaneGeometry(1, 1);

/* ---------------- build context ---------------- */
function makeK(rng, theme) {
  const K = { solid: new GeoBatch(), glow: new GeoBatch(), glass: new GeoBatch(), floor: new GeoBatch(true), signs: [], rng, theme };
  const all = [K.solid, K.glow, K.glass, K.floor];
  K.push = (x, y, z, ry, m) => all.forEach(b => b.push(x, y, z, ry, m));
  K.pop = () => all.forEach(b => b.pop());
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  K.sign = (tex, x, y, z, w, h, ry) => {
    e.set(0, ry || 0, 0); q.setFromEuler(e);
    const m = K.solid.M.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(w, h, 1)));
    K.signs.push({ tex, m });
  };
  return K;
}

/** Local frame for a wall: origin (ox, y, oz), facing normal (nx, nz); local +x runs along the wall. */
function wallFrame(ox, y, oz, nx, nz) {
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(nz, 0, -nx), new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx, 0, nz));
  m.setPosition(ox, y, oz);
  return m;
}

/* ---------------- shared shell pieces ---------------- */
function ceilQuad(b, xa, xb, za, zb, y, color) {          // horizontal quad facing DOWN
  const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb), z0 = Math.min(za, zb), z1 = Math.max(za, zb);
  b.quad([x0, y, z1], [x0, y, z0], [x1, y, z0], [x1, y, z1], color);
}
function floorQuad(b, xa, xb, za, zb, y) {                 // horizontal quad facing UP with world-ish UVs (4 m tiles)
  const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb), z0 = Math.min(za, zb), z1 = Math.max(za, zb);
  b.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], "#ffffff", [[x0 / 4, z1 / 4], [x1 / 4, z1 / 4], [x1 / 4, z0 / 4], [x0 / 4, z0 / 4]]);
}

/** An axis-aligned rectangle of upper walkway: slab, underside lights, walkway floor, roof above. */
function walkwayRect(K, xa, xb, za, zb) {
  const T = K.theme, S = K.solid;
  const cx = (xa + xb) / 2, cz = (za + zb) / 2, w = Math.abs(xb - xa), d = Math.abs(zb - za);
  S.box(cx, H - C.SLAB / 2, cz, w, C.SLAB, d, shade(T.fascia, 0.92));
  floorQuad(K.floor, xa, xb, za, zb, H + 0.003);
  S.box(cx, C.ROOF_H + 0.15, cz, w, 0.3, d, T.ceil);
  const lx = Math.max(1, Math.round(w / 3)), lz = Math.max(1, Math.round(d / 4));
  for (let i = 0; i < lx; i++) for (let j = 0; j < lz; j++) {
    const px = Math.min(xa, xb) + (i + 0.5) * w / lx, pz = Math.min(za, zb) + (j + 0.5) * d / lz;
    K.glow.box(px, H - C.SLAB - 0.005, pz, 0.45, 0.02, 0.45, WARM);
    K.glow.box(px, C.ROOF_H - 0.005, pz, 0.45, 0.02, 0.45, WARM);
  }
}

/** Railing + slab-edge trim + clerestory along an axis-aligned void edge from (ax,az) to (bx,bz). */
function voidEdge(K, ax, az, bx, bz) {
  const T = K.theme, S = K.solid;
  const alongX = Math.abs(bx - ax) > Math.abs(bz - az);
  const len = alongX ? Math.abs(bx - ax) : Math.abs(bz - az);
  const cx = (ax + bx) / 2, cz = (az + bz) / 2;
  const bw = (t, w) => alongX ? [len, t] : [t, len];
  let [w, d] = bw(0.14);
  S.box(cx, H - 0.22, cz, w, 0.56, d, T.trim);                                  // trim band on slab edge
  [w, d] = bw(0.03); K.glass.box(cx, H + 0.53, cz, w, 0.9, d, "#d6eaee");      // glass balustrade
  [w, d] = bw(0.09); S.box(cx, H + C.RAIL_H, cz, w, 0.07, d, "#c9c6bf");        // handrail
  [w, d] = bw(0.06); S.box(cx, H + 0.06, cz, w, 0.12, d, "#9a978f");            // shoe rail
  const n = Math.max(1, Math.round(len / 2));
  for (let i = 0; i <= n; i++) {
    const t = i / n, px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
    S.box(px, H + C.RAIL_H / 2, pz, 0.05, C.RAIL_H, 0.05, "#a9a69f");
  }
  [w, d] = bw(0.22); S.box(cx, (C.ROOF_H + C.SKY_H) / 2, cz, w, C.SKY_H - C.ROOF_H, d, T.fascia);   // clerestory
}

function column(K, x, z) {
  const T = K.theme, S = K.solid;
  S.cyl(x, C.ROOF_H / 2, z, 0.26, C.ROOF_H, shade(T.fascia, 1.02));
  S.cyl(x, 0.2, z, 0.36, 0.4, shade(T.wall, 0.8));
  S.cyl(x, H + 0.15, z, 0.34, 0.3, shade(T.wall, 0.8));
  S.cyl(x, H - C.SLAB - 0.12, z, 0.32, 0.24, T.trim);
}

function skylight(K, xa, xb, za, zb) {
  ceilQuad(K.glow, xa, xb, za, zb, C.SKY_H, K.theme.sky);
  const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb), z0 = Math.min(za, zb), z1 = Math.max(za, zb);
  for (let z = z0 + 1.5; z < z1; z += 3) K.solid.box((x0 + x1) / 2, C.SKY_H - 0.1, z, x1 - x0, 0.16, 0.16, "#e9e6df");
  for (let x = x0 + 1.6; x < x1 - 0.5; x += 3.2) K.solid.box(x, C.SKY_H - 0.1, (z0 + z1) / 2, 0.16, 0.16, z1 - z0, "#e9e6df");
}

/* Plain wall used at the inside corner after a turn (no room for a shop there). */
function cornerFiller(K, w, upper) {
  const T = K.theme, S = K.solid, rng = K.rng;
  S.box(w / 2, 2.0, -0.1, w, 4.0, 0.2, shade(upper ? T.fascia : T.wall, 0.97));
  S.box(w / 2, 0.1, 0.02, w, 0.2, 0.06, shade(T.wall, 0.7));
  if (T.name === "garage") return;
  if (upper) { S.box(w * 0.5, 1.6, 0.05, 1.4, 1.8, 0.1, "#3a3a3a"); K.glow.box(w * 0.5, 1.6, 0.11, 1.25, 1.65, 0.01, "#2f6aa0"); return; }
  // vending machines + mall directory + restroom sign
  const vx = w - 1.8;
  for (let i = 0; i < 2; i++) {
    const x = vx + i * 1.0 - 0.5, c = rng.pick(["#c8303a", "#2f5aa0", "#2f7a4a"]);
    S.box(x, 0.95, 0.4, 0.9, 1.9, 0.75, c);
    K.glow.box(x - 0.12, 1.15, 0.78, 0.5, 1.0, 0.01, "#e8f4ff");
    S.box(x + 0.3, 0.9, 0.78, 0.15, 0.4, 0.02, "#222");
  }
  S.box(2.2, 1.0, 0.25, 1.3, 2.0, 0.3, "#3a3a3a");
  K.sign(signTexture("MALL MAP", { bg: "#2b2822", fg: "#f0c85a", font: "head", upper: true }), 2.2, 1.8, 0.41, 1.1, 0.27);
  K.glow.box(2.2, 1.05, 0.41, 1.1, 1.05, 0.01, "#d9e8e0");
  K.sign(signTexture("RESTROOMS →", { bg: "#2f4a6a", fg: "#ffffff", font: "sans" }), w * 0.45, 3.3, 0.02, 2.0, 0.5);
}

/* ---------------- store rows ---------------- */
function storeWidths(rng, total) {
  const out = []; let left = total;
  while (left > 0) {
    let w;
    const r = rng.next();
    if (left >= 24 && r < 0.22) w = 24; else if (left >= 12 && r < 0.82) w = 12; else w = 6;
    if (w > left) w = left;
    out.push(w); left -= w;
  }
  return out;
}

function pickType(rng, theme, w, prev) {
  for (let tries = 0; tries < 8; tries++) {
    const t = rng.pick(theme.stores);
    if (t === prev && theme.stores.length > 1) continue;
    if (STORE_TYPES[t] && STORE_TYPES[t].minW && w < STORE_TYPES[t].minW) continue;
    if (w <= 6 && (t === "theater" || t === "home" || t === "sports")) continue;
    return t;
  }
  return theme.name === "garage" ? "parking" : (w <= 6 ? "candy" : "apparel");
}

/** Builds shops along a wall. Yields after each shop so building is spread over frames.
    frameAt(offset, w) -> Matrix4 for a shop starting `offset` metres along the wall. */
function* storeRow(K, length, frameAt, level, onDoor, skipFirst) {
  const rng = K.rng;
  let off = 0, prev = null;
  for (const w of storeWidths(rng, length)) {
    const m = frameAt(off, w);
    K.push(0, 0, 0, 0, m);
    if (skipFirst > 0 && off < skipFirst) cornerFiller(K, w, level === 1);
    else {
      const type = K.theme.name === "garage" ? "parking" : pickType(rng, K.theme, w, prev);
      prev = type;
      const res = buildStore(K, type, w, { upper: level === 1, bayLabel: level ? "LEVEL P2" : "LEVEL P1" });
      for (const d of res.doors) if (onDoor) onDoor(off, w, d);
    }
    K.pop();
    off += w;
    yield;
  }
}

/* ---------------- pieces ---------------- */
function* buildBlock(piece, K) {
  const L = piece.s1 - piece.s0, T = K.theme, S = K.solid;
  floorQuad(K.floor, -HALF, HALF, 0, -L, 0);
  for (const sd of [-1, 1]) {
    walkwayRect(K, sd * VH, sd * HALF, 0, -L);
    voidEdge(K, sd * (VH + 0.05), 0, sd * (VH + 0.05), -L);
    for (let z = -6; z > -L; z -= C.BAY) column(K, sd * (VH + 0.32), z);
  }
  skylight(K, -VH, VH, 0, -L);
  // hanging banners + pendant lights over the atrium
  for (const sd of [-1, 1]) {
    S.box(sd * 1.3, 8.2, -L / 2, 0.9, 2.4, 0.03, sd > 0 ? T.trim : shade(T.trim, 0.75));
    S.box(sd * 1.3, 9.45, -L / 2, 0.04, 0.3, 0.04, "#888");
  }
  for (let z = -12; z > -L; z -= 24) { S.box(0, 8.5, z, 0.02, 2.2, 0.02, "#555"); K.glow.sphere(0, 7.3, z, 0.28, WARM); S.cone(0, 7.55, z, 0.45, 0.3, "#3a3a3a"); }
  yield;

  // shop rows: right wall (x=+6, faces -x) and left wall (x=-6, faces +x), both storeys
  for (const level of [0, 1]) {
    const y = level * H;
    for (const sd of [-1, 1]) {
      const skip = piece.after === sd ? 12 : 0;   // inside corner right after a turn
      // the right wall's local +x runs back toward the block start, so its origin sits at the shop's far end
      const fa = sd > 0 ? (off, w) => wallFrame(HALF, y, -(off + w), -1, 0) : (off) => wallFrame(-HALF, y, -off, 1, 0);
      yield* storeRow(K, L, fa, level, (off, w, d) => {
        // door centre along the wall -> path distance
        const along = sd > 0 ? (off + w) - d.x : off + d.x;
        registerDoor({ s: piece.s0 + along, side: sd, level, w: d.w });
      }, skip);
    }
  }
}

function* buildJunction(piece, K) {
  const d = piece.dir, S = K.solid;
  floorQuad(K.floor, -HALF, HALF, 0, -C.CW, 0);
  // walkways: outer strip, far strip, small inside-corner square
  walkwayRect(K, -d * HALF, -d * VH, 0, -C.CW);
  walkwayRect(K, -d * VH, d * HALF, -C.CW, -C.CW + C.BAL_W);
  walkwayRect(K, d * VH, d * HALF, 0, -C.BAL_W);
  voidEdge(K, -d * (VH + 0.05), 0, -d * (VH + 0.05), -C.CW + C.BAL_W);
  voidEdge(K, -d * VH, -C.CW + C.BAL_W - 0.05, d * HALF, -C.CW + C.BAL_W - 0.05);
  voidEdge(K, d * (VH + 0.05), 0, d * (VH + 0.05), -C.BAL_W);
  voidEdge(K, d * VH, -C.BAL_W - 0.05, d * HALF, -C.BAL_W - 0.05);
  column(K, -d * (VH + 0.32), -C.CW + C.BAL_W - 0.32);
  column(K, d * (VH + 0.32), -C.BAL_W - 0.32);
  skylight(K, -d * VH, d * VH, 0, -C.CW + C.BAL_W);
  skylight(K, d * VH, d * HALF, -C.BAL_W, -C.CW + C.BAL_W);
  // big direction sign hanging under the far walkway, facing the runner
  const arrowMat = new THREE.MeshBasicMaterial({ map: arrowTexture(d) });
  const arrow = new THREE.Mesh(PLANE, arrowMat);
  arrow.position.set(0, 3.3, -C.CW + C.BAL_W + 0.05); arrow.scale.set(2.6, 1.3, 1);
  S.box(0, 3.3, -C.CW + C.BAL_W - 0.02, 2.8, 1.5, 0.08, "#2b2822");
  S.box(-1.0, 3.95, -C.CW + C.BAL_W - 0.02, 0.04, 0.2, 0.04, "#555"); S.box(1.0, 3.95, -C.CW + C.BAL_W - 0.02, 0.04, 0.2, 0.04, "#555");
  arrow.userData.ownMat = true;
  piece.arrow = arrow;
  yield;
  // anchor shop on the far wall, shops on the outer wall (both storeys)
  for (const level of [0, 1]) {
    const y = level * H;
    yield* storeRow(K, C.CW, () => wallFrame(-HALF, y, -C.CW, 0, 1), level, null, 0);
    yield* storeRow(K, C.CW, () => d > 0 ? wallFrame(-HALF, y, 0, 1, 0) : wallFrame(HALF, y, -C.CW, -1, 0), level, null, 0);
  }
}

function finish(piece, K, group) {
  const add = (b, mat, order) => { if (!b.empty) { const m = b.mesh(mat); if (order) m.renderOrder = order; group.add(m); } };
  add(K.floor, floorMat(K.theme));
  add(K.solid, MAT.solid);
  add(K.glow, MAT.glow);
  add(K.glass, MAT.glass, 2);
  for (const s of K.signs) {
    const m = new THREE.Mesh(PLANE, signMat(s.tex));
    m.matrixAutoUpdate = false; m.matrix.copy(s.m);
    group.add(m);
  }
  if (piece.arrow) group.add(piece.arrow);
}

/* ---------------- manager ---------------- */
export class World {
  constructor(scene) {
    this.scene = scene;
    this.built = new Map();     // piece.id -> { group, piece }
    this.job = null;
    this.startS = 0;
  }
  reset(startS) {
    for (const v of this.built.values()) this.disposeGroup(v.group);
    this.built.clear(); this.job = null; this.startS = startS;
  }
  themeFor(piece) {
    const lvl = Math.max(0, Math.floor((piece.s0 - this.startS) / C.LEVEL_DISTANCE));
    return C.THEMES[lvl % C.THEMES.length];
  }
  startJob(piece) {
    const theme = this.themeFor(piece);
    const K = makeK(makeRng(piece.id * 7919 + 13), theme);
    const gen = piece.kind === "junction" ? buildJunction(piece, K) : buildBlock(piece, K);
    this.job = { piece, K, gen };
  }
  /** Build whatever is missing within view; spend at most budgetMs this frame (Infinity = all now). */
  update(path, runnerS, budgetMs) {
    const t0 = performance.now();
    // drop pieces far behind
    for (const [id, v] of this.built) if (v.piece.s1 < runnerS - 40) { this.disposeGroup(v.group); this.built.delete(id); }
    for (;;) {
      if (!this.job) {
        const next = path.pieces.find(p => !this.built.has(p.id) && p.s0 < runnerS + C.VIEW_DIST + 20 && p.s1 > runnerS - 40);
        if (!next) return;
        this.startJob(next);
      }
      const j = this.job;
      while (true) {
        const r = j.gen.next();
        if (r.done) {
          const group = new THREE.Group();
          group.position.set(j.piece.x, 0, j.piece.z); group.rotation.y = -j.piece.h;
          finish(j.piece, j.K, group);
          group.updateMatrixWorld(true);
          this.scene.add(group);
          this.built.set(j.piece.id, { group, piece: j.piece });
          this.job = null;
          break;
        }
        if (performance.now() - t0 > budgetMs) return;
      }
      if (performance.now() - t0 > budgetMs) return;
    }
  }
  disposeGroup(g) {
    this.scene.remove(g);
    g.traverse(o => {
      if (!o.isMesh) return;
      if (o.geometry !== PLANE) o.geometry.dispose();
      if (o.userData.ownMat) o.material.dispose();
    });
  }
}
