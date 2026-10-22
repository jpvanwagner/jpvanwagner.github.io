// Builds the static trattoria: floors, walls, dining tables, the bar, the kitchen line, the office.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { scene, pickables } from './scene.js';
import { WORLD, WALLS, ZONES, KITCHEN, BAR, HOST_STAND, DOOR, TABLES, tableGeometry } from '../data/layout.js';
import { RESTAURANT } from '../config.js';
import { woodPlanks, checker, gingham, brick, carpet, textTex, mosaic, neonTex, glowTex } from './textures.js';

export const COLORS = {
  red: 0x8f1d21, redDark: 0x5e0f13, black: 0x161214, white: 0xfaf7f2, cream: 0xefe7da,
  steel: 0xb9bcc0, steelDark: 0x6d7176, brass: 0xb8893b, wood: 0x4a2c1d, woodDark: 0x2c1a12,
};

const mats = {};
export function mat(color, opts = {}) {
  const key = `${color}-${JSON.stringify(opts)}`;
  if (!mats[key]) mats[key] = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...opts });
  return mats[key];
}
export const steel = () => mat(COLORS.steel, { roughness: 0.35, metalness: 0.7 });

export function box(w, h, d, material, x = 0, y = 0, z = 0, parent = scene) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function cyl(rt, rb, h, material, x = 0, y = 0, z = 0, parent = scene, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

function floor(x0, z0, x1, z1, material, y = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), material);
  m.rotation.x = -Math.PI / 2;
  m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

/** Handles the rest of the renderer needs (dynamic props are placed relative to these). */
export const world = {
  tables: {},       // id → { group, items, ring, hit, cloth }
  zoneHits: {},
  oven: [], pots: [], pans: [], fryer: [], warmerSpots: [], plateSpots: [], binSpots: {},
  passSpots: [],
  barGlass: null,
};

export function buildWorld() {
  // Ground beyond the walls (sidewalk).
  floor(-8, -4, WORLD.w + 8, WORLD.d + 6, mat(0x2a2422), -0.02);

  // Floors.
  floor(ZONES.dining.x0, ZONES.dining.z0, ZONES.dining.x1, ZONES.dining.z1,
    new THREE.MeshStandardMaterial({ map: woodPlanks('#6b4430', [7, 4]), roughness: 0.7 }));
  floor(ZONES.kitchen.x0, ZONES.kitchen.z0, ZONES.kitchen.x1, ZONES.kitchen.z1,
    new THREE.MeshStandardMaterial({ map: checker('#f4f1ea', '#1a1718', 8, [6, 3]), roughness: 0.5 }), 0.001);
  floor(ZONES.office.x0, ZONES.office.z0, ZONES.office.x1, ZONES.office.z1,
    new THREE.MeshStandardMaterial({ map: carpet([3, 3]), roughness: 0.95 }), 0.001);
  const barWood = new THREE.MeshStandardMaterial({ map: woodPlanks('#3a2318', [3, 6]), roughness: 0.6 });
  floor(18, 0, 26, 5.6, barWood, 0.002);
  floor(20.6, 5.6, 26, 13, barWood, 0.002);
  floor(1.0, 16.9, 3.0, 17.9, mat(COLORS.red, { roughness: 1 }), 0.004); // door mat

  // Walls: cream plaster with a black cap; the back wall is old brick.
  const plaster = mat(COLORS.cream, { roughness: 0.9 });
  const cap = mat(COLORS.black, { roughness: 0.6 });
  const brickMat = new THREE.MeshStandardMaterial({ map: brick([14, 2]), roughness: 0.9 });
  WALLS.forEach(([x0, z0, x1, z1, h], i) => {
    const w = x1 - x0, d = z1 - z0;
    box(w, h, d, i === 0 ? brickMat : plaster, (x0 + x1) / 2, 0, (z0 + z1) / 2);
    box(w + 0.04, 0.06, d + 0.04, cap, (x0 + x1) / 2, h, (z0 + z1) / 2);
  });
  // Half-wall facing the dining room gets brick too (open-kitchen look).
  for (const [x0, x1] of [[0, 3.4], [9.6, 12]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 1.1), new THREE.MeshStandardMaterial({ map: brick([3, 1]), roughness: 0.9 }));
    m.position.set((x0 + x1) / 2, 0.55, 5.71);
    scene.add(m);
  }

  buildKitchen();
  buildPass();
  buildOffice();
  buildBar();
  buildHost();
  buildDecor();
  buildZoneHits();
  // Hundreds of bricks, bottles, legs and trims share a few dozen materials: draw each set at once.
  mergeStatic(scene, new Set([
    ...(world.ovenCutaway || []), world.embers, ...(world.flames || []), ...world.pots.map((p) => p.water), ...pickables,
  ]));
}

/** Merge the static meshes directly under `parent` that share a material (and shadow settings)
 *  into one mesh per material: same picture, far fewer draw calls. Anything in `keep` (animated,
 *  clickable, or toggled) is left alone, as are additive/unusual materials. */
export function mergeStatic(parent, keep = new Set()) {
  const sets = new Map();
  const groups = [];
  // Walk plain groups too (a chair is a group of legs, seat and back), carrying their transforms.
  const walk = (node, matrix) => {
    for (const o of [...node.children]) {
      if (keep.has(o)) continue;
      o.updateMatrix();
      const m = new THREE.Matrix4().multiplyMatrices(matrix, o.matrix);
      if (!o.isMesh) {
        if (o.type === 'Group' && !o.userData.pick) { groups.push(o); walk(o, m); }
        continue;
      }
      if (Array.isArray(o.material) || o.material.visible === false || o.material.blending !== THREE.NormalBlending) continue;
      const g = o.geometry;
      if (!g.index || !g.attributes.normal || !g.attributes.uv || Object.keys(g.morphAttributes).length) continue;
      const key = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}`;
      if (!sets.has(key)) sets.set(key, []);
      sets.get(key).push({ o, m });
    }
  };
  walk(parent, new THREE.Matrix4());
  for (const list of sets.values()) {
    if (list.length < 2) continue;
    const geos = list.map(({ o, m }) => {
      const c = new THREE.BufferGeometry();
      for (const a of ['position', 'normal', 'uv']) c.setAttribute(a, o.geometry.attributes[a]);
      c.setIndex(o.geometry.index);
      return c.applyMatrix4(m);
    });
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const first = list[0].o;
    const mesh = new THREE.Mesh(merged, first.material);
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    parent.add(mesh);
    for (const { o } of list) o.parent.remove(o);
  }
  for (const g of groups) if (!g.children.length) g.parent?.remove(g);
}

export function buildTables(activeTables) {
  for (const id of Object.keys(world.tables)) {
    const t = world.tables[id];
    scene.remove(t.group);
    pickables.splice(pickables.indexOf(t.hit), 1);
    delete world.tables[id];
  }
  for (const t of activeTables) buildTable(t);
}

function buildTable(t) {
  const g = new THREE.Group();
  scene.add(g);
  const geo = tableGeometry(t);
  const chairWood = mat(COLORS.woodDark, { roughness: 0.6 });
  const items = new THREE.Group();
  g.add(items);

  if (t.kind === 'bar') {
    // Two stools at the bar: red leather seat, black stem, brass ring.
    for (const s of geo.seats) {
      cyl(0.03, 0.03, 0.7, mat(COLORS.black), s.x, 0, s.z, g, 8);
      cyl(0.18, 0.2, 0.03, mat(COLORS.black), s.x, 0, s.z, g);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 6, 16), mat(COLORS.brass, { metalness: 0.8, roughness: 0.3 }));
      ring.rotation.x = Math.PI / 2; ring.position.set(s.x, 0.3, s.z); g.add(ring);
      cyl(0.2, 0.18, 0.09, mat(COLORS.red, { roughness: 0.45 }), s.x, 0.7, s.z, g);
    }
    items.position.set(BAR.counter.x0 + 0.25, 1.06, t.z);
  } else {
    const w = geo.hw * 2, d = geo.hd * 2;
    // Legs + top + gingham cloth hanging a little over the edge.
    const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [sx, sz] of legs) box(0.06, 0.72, 0.06, mat(COLORS.black), t.x + sx * (w / 2 - 0.1), 0, t.z + sz * (d / 2 - 0.1), g);
    const clothTex = gingham([w * 1.6, d * 1.6]);
    const cloth = box(w + 0.12, 0.04, d + 0.12, new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.9 }), t.x, 0.72, t.z, g);
    // Chianti-bottle candle.
    cyl(0.05, 0.07, 0.12, mat(0xb7934f, { roughness: 1 }), t.x, 0.76, t.z, g, 10);
    cyl(0.025, 0.04, 0.1, mat(0x1f4a2a, { roughness: 0.3 }), t.x, 0.88, t.z, g, 10);
    cyl(0.018, 0.018, 0.07, mat(0xfaf3e0), t.x, 0.98, t.z, g, 8);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc36b }));
    flame.position.set(t.x, 1.07, t.z); flame.scale.y = 1.6; g.add(flame);
    // Bentwood chairs.
    for (const s of geo.seats) {
      const c = new THREE.Group();
      c.position.set(s.x, 0, s.z);
      c.rotation.y = s.face;
      box(0.42, 0.05, 0.42, chairWood, 0, 0.44, 0, c);
      for (const [sx, sz] of legs) box(0.04, 0.44, 0.04, chairWood, sx * 0.17, 0, sz * 0.17, c);
      box(0.42, 0.45, 0.05, chairWood, 0, 0.49, -0.2, c);
      box(0.36, 0.06, 0.4, mat(COLORS.red, { roughness: 0.55 }), 0, 0.49, 0, c); // red seat cushion
      g.add(c);
    }
    items.position.set(t.x, 0.77, t.z);
    world.tables[t.id] = { cloth };
  }

  // Selection ring (shown when this table is a valid seat for the selected party).
  const rr = Math.max(geo.hw, geo.hd, 0.5) + 0.75;
  const ring = new THREE.Mesh(new THREE.RingGeometry(rr - 0.09, rr, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(t.kind === 'bar' ? t.x - 0.1 : t.x, 0.02, t.z);
  if (t.kind === 'rect') ring.scale.set(1.45, 1, 1);
  ring.visible = false;
  g.add(ring);

  // Invisible hit box for clicks.
  const hw = t.kind === 'bar' ? 0.45 : geo.hw + 0.7, hd = t.kind === 'bar' ? 1.1 : geo.hd + 0.7;
  const hit = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, 1.4, hd * 2), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(t.x, 0.7, t.z);
  hit.userData.pick = { type: 'table', id: t.id };
  g.add(hit);
  pickables.push(hit);

  mergeStatic(g, new Set([items, ring, hit]));
  world.tables[t.id] = { ...(world.tables[t.id] || {}), group: g, items, ring, hit };
}

function buildKitchen() {
  const K = KITCHEN;
  const stainless = steel();
  const dark = mat(COLORS.steelDark, { roughness: 0.4, metalness: 0.6 });

  buildOven(K.oven);

  // Pasta range: three pots.
  const p = K.pot;
  box(p.w, 0.9, p.d, stainless, p.x, 0, p.z);
  box(p.w, 0.04, p.d, mat(COLORS.black), p.x, 0.9, p.z);
  for (let i = 0; i < 3; i++) {
    const x = p.x + (i - 1) * 0.68;
    cyl(0.27, 0.25, 0.32, stainless, x, 0.94, p.z + 0.05);
    const water = cyl(0.25, 0.25, 0.01, mat(0x9fb6bb, { roughness: 0.1, metalness: 0.2 }), x, 1.22, p.z + 0.05);
    world.pots.push({ x, y: 1.24, z: p.z + 0.05, water });
  }
  // Sauté station: two black pans.
  const pn = K.pan;
  box(pn.w, 0.9, pn.d, stainless, pn.x, 0, pn.z);
  box(pn.w, 0.04, pn.d, mat(COLORS.black), pn.x, 0.9, pn.z);
  for (let i = 0; i < 2; i++) {
    const x = pn.x + (i ? 0.31 : -0.31);
    cyl(0.25, 0.22, 0.06, mat(0x222222, { roughness: 0.4, metalness: 0.5 }), x, 0.94, pn.z + 0.05);
    box(0.05, 0.03, 0.35, mat(0x222222), x, 0.98, pn.z + 0.42);
    world.pans.push({ x, y: 1.0, z: pn.z + 0.05 });
  }
  // Fryer: two baskets in golden oil.
  const f = K.fryer;
  box(f.w, 0.9, f.d, stainless, f.x, 0, f.z);
  for (let i = 0; i < 2; i++) {
    const x = f.x + (i ? 0.28 : -0.28);
    box(0.46, 0.02, 0.6, mat(0xc79a2c, { roughness: 0.15, metalness: 0.2 }), x, 0.9, f.z);
    box(0.06, 0.25, 0.04, dark, x, 0.9, f.z + 0.36);
    world.fryer.push({ x, y: 0.94, z: f.z });
  }
  // Prep counter with ingredient bins (hotel pans).
  const pr = K.prep;
  box(pr.w, 0.9, pr.d, stainless, pr.x, 0, pr.z);
  const binKeys = ['dough', 'sauce', 'mozzarella', 'pepperoni', 'basil', 'marinara', 'alfredo', 'parmesan', 'parsley', 'lemon', 'tomato', 'oliveoil'];
  binKeys.forEach((key, i) => {
    const col = i % 6, row = Math.floor(i / 6);
    const x = pr.x - pr.w / 2 + 0.3 + col * 0.54, z = pr.z - 0.22 + row * 0.42;
    box(0.46, 0.05, 0.36, dark, x, 0.9, z);
    world.binSpots[key] = { x, y: 0.96, z };
  });

  // Plating island: warmer (under heat lamps) + plate spots.
  const is = K.island;
  box(is.w, 0.92, is.d, stainless, is.x, 0, is.z);
  box(1.7, 0.03, is.d - 0.1, mat(0x3a3a3a, { roughness: 0.5 }), is.x - is.w / 2 + 0.95, 0.92, is.z);
  for (let i = 0; i < 2; i++) {
    const lamp = box(0.7, 0.05, 0.15, mat(0x222222), is.x - is.w / 2 + 0.6 + i * 0.75, 1.65, is.z);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.02, 0.08), new THREE.MeshBasicMaterial({ color: 0xff5a2a }));
    glow.position.set(lamp.position.x, 1.63, is.z);
    scene.add(glow);
  }
  for (let i = 0; i < 6; i++) world.warmerSpots.push({ x: is.x - is.w / 2 + 0.3 + (i % 3) * 0.5, y: 0.95, z: is.z + (i < 3 ? -0.16 : 0.18) });
  for (let i = 0; i < 4; i++) world.plateSpots.push({ x: is.x - 0.6 + i * 0.85, y: 0.93, z: is.z });

}

// Remap a partial sphere's UVs to full-hemisphere coordinates so pieces cut from the same dome
// share one continuous texture.
function hemiUV(geo, phiStart, phiLen, thetaStart, thetaLen) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (phiStart + uv.getX(i) * phiLen) / (Math.PI * 2), 1 - (thetaStart + (1 - uv.getY(i)) * thetaLen) / (Math.PI / 2));
  }
  uv.needsUpdate = true;
  return geo;
}

/** The showpiece: a tiled, wood-fired dome oven centred on the back wall, mouth to the room.
 *  To change the look: `R` is the dome radius, `MOUTH` the half-width of the opening (radians
 *  around the dome) and `MOUTH_TOP` how far down from the crown the opening starts. */
function buildOven(o) {
  const R = 1.25, BASE = 1.1, MOUTH = 0.62, MOUTH_TOP = 0.98;
  const cz = o.z, cx = o.x;
  const brickMat = new THREE.MeshStandardMaterial({ map: brick([3, 1]), roughness: 0.9 });
  // Plinth, with a log store under the deck facing the room.
  box(o.w, BASE, o.d, brickMat, cx, 0, cz);
  box(1.5, 0.62, 0.06, mat(0x120c0a, { roughness: 1 }), cx, 0.2, cz + o.d / 2 + 0.005);
  for (let i = 0; i < 9; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.5, 8), mat(i % 3 ? 0x6a4128 : 0x7d5234, { roughness: 1 }));
    log.rotation.x = Math.PI / 2;
    log.position.set(cx - 0.6 + (i % 5) * 0.3 + (i >= 5 ? 0.15 : 0), 0.3 + (i >= 5 ? 0.12 : 0), cz + o.d / 2 - 0.2);
    scene.add(log);
  }
  box(o.w + 0.08, 0.06, o.d + 0.08, mat(COLORS.black, { roughness: 0.5 }), cx, BASE, cz); // stone lip
  const deck = cyl(R - 0.05, R - 0.05, 0.04, mat(0x5a463a, { roughness: 1 }), cx, BASE + 0.06, cz);
  deck.receiveShadow = true;

  // Dome in glass mosaic. Three.js measures phi from -x, so the room-facing side (+z) is π/2.
  const tiles = new THREE.MeshStandardMaterial({ map: mosaic([6, 2], []), roughness: 0.35, metalness: 0.1 });
  const firebrick = mat(0x8a3a24, { roughness: 0.95, side: THREE.BackSide });
  const y0 = BASE + 0.08;
  const front = Math.PI / 2;
  const backStart = front + MOUTH, backLen = Math.PI * 2 - MOUTH * 2;
  const back = new THREE.Mesh(hemiUV(new THREE.SphereGeometry(R, 40, 16, backStart, backLen, 0, Math.PI / 2), backStart, backLen, 0, Math.PI / 2), tiles);
  const crown = new THREE.Mesh(hemiUV(new THREE.SphereGeometry(R, 12, 10, front - MOUTH, MOUTH * 2, 0, MOUTH_TOP), front - MOUTH, MOUTH * 2, 0, MOUTH_TOP), tiles);
  // Soot-darkened firebrick lining, seen through the mouth (and in the kitchen cutaway).
  const lining = new THREE.Mesh(new THREE.SphereGeometry(R - 0.03, 40, 16, backStart, backLen, 0, Math.PI / 2), firebrick);
  for (const m of [back, crown, lining]) { m.position.set(cx, y0, cz); m.castShadow = m !== lining; scene.add(m); }
  // White-and-gold trim round the base of the dome.
  const trim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.01, 0.035, 6, 48), mat(0xc9a24a, { metalness: 0.6, roughness: 0.35 }));
  trim.rotation.x = Math.PI / 2;
  trim.position.set(cx, y0 + 0.03, cz);
  scene.add(trim);

  // The mouth: a short brick vault in front of the opening, framed by a black-and-brass arch.
  const mouthR = R * Math.sin(MOUTH) * 0.98;           // half-width of the opening
  const mouthZ = cz + R * Math.cos(MOUTH) - 0.02;      // where the opening meets the dome
  const vault = new THREE.Mesh(new THREE.CylinderGeometry(mouthR, mouthR, 0.36, 20, 1, true, -Math.PI / 2, Math.PI), mat(0x9a3b26, { roughness: 0.95, side: THREE.DoubleSide }));
  vault.rotation.x = Math.PI / 2;
  vault.position.set(cx, y0, mouthZ + 0.14);
  scene.add(vault);
  const face = new THREE.Shape();
  face.moveTo(-mouthR - 0.28, 0); face.lineTo(-mouthR - 0.28, mouthR + 0.18);
  face.quadraticCurveTo(0, mouthR + 0.62, mouthR + 0.28, mouthR + 0.18); face.lineTo(mouthR + 0.28, 0);
  const hole = new THREE.Path();
  hole.moveTo(mouthR, 0); hole.absarc(0, 0, mouthR, 0, Math.PI, false); hole.lineTo(mouthR, 0);
  face.holes.push(hole);
  const facade = new THREE.Mesh(new THREE.ExtrudeGeometry(face, { depth: 0.1, bevelEnabled: false, curveSegments: 20 }), mat(COLORS.black, { roughness: 0.45 }));
  facade.position.set(cx, y0, mouthZ + 0.26);
  facade.castShadow = true;
  scene.add(facade);
  const archTrim = new THREE.Mesh(new THREE.TorusGeometry(mouthR + 0.03, 0.03, 6, 24, Math.PI), mat(COLORS.brass, { metalness: 0.8, roughness: 0.3 }));
  archTrim.position.set(cx, y0, mouthZ + 0.37);
  scene.add(archTrim);
  // Name plate over the arch, angled so it reads from the dining room and the overhead map.
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.24), new THREE.MeshBasicMaterial({
    map: textTex('Forno a legna', { w: 512, h: 100, bg: '#141012', fg: '#e8c879', font: 'italic 700 60px Georgia, serif' }),
  }));
  plate.position.set(cx, y0 + mouthR + 0.36, mouthZ + 0.37);
  plate.rotation.x = -0.35;
  scene.add(plate);
  // The kitchen station cuts the front of the oven away so the cook can see the pizzas.
  world.ovenCutaway = [crown, vault, facade, archTrim, plate];

  // Copper flue up to the ceiling.
  const copper = mat(0xb06a3a, { metalness: 0.75, roughness: 0.35 });
  cyl(0.2, 0.26, 0.25, copper, cx, y0 + R - 0.08, cz - 0.15, scene, 20);
  cyl(0.17, 0.17, 1.3, copper, cx, y0 + R + 0.15, cz - 0.15, scene, 20);
  cyl(0.2, 0.2, 0.05, mat(COLORS.black), cx, y0 + R + 0.6, cz - 0.15, scene, 20);

  // Fire at the back-left of the deck: embers, a few flickering flames, and two lights (one in
  // the dome, one spilling out of the mouth so the glow reaches the dining room).
  const emberMat = new THREE.MeshBasicMaterial({ color: 0xff6a1a });
  const embers = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), emberMat);
  embers.scale.set(1.5, 0.45, 0.9);
  embers.position.set(cx - 0.6, y0 + 0.05, cz - 0.55);
  scene.add(embers);
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 6), mat(0x2a160c, { roughness: 1 }));
    log.rotation.z = Math.PI / 2; log.rotation.y = 0.5 + i * 0.4;
    log.position.set(cx - 0.6 + (i - 1.5) * 0.08, y0 + 0.08, cz - 0.55 + (i % 2) * 0.1);
    scene.add(log);
  }
  world.flames = [];
  const flameCols = [0xffd36b, 0xff9a2a, 0xff7a1a, 0xffc04a, 0xff8a2a];
  flameCols.forEach((col, i) => {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.09 + (i % 2) * 0.03, 0.45, 8), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, depthWrite: false }));
    f.position.set(cx - 0.85 + i * 0.13, y0 + 0.3, cz - 0.55 + (i % 2) * 0.12);
    f.userData.base = f.position.y;
    scene.add(f);
    world.flames.push(f);
  });
  const fire = new THREE.PointLight(0xff8a3a, 6, 3.4, 1.5);
  fire.position.set(cx - 0.4, y0 + 0.5, cz - 0.3);
  scene.add(fire);
  const glow = new THREE.PointLight(0xff9a4a, 4, 6.5, 1.6);
  glow.position.set(cx, y0 + 0.35, mouthZ + 1.0);
  scene.add(glow);
  world.fireLight = fire;
  world.mouthGlow = glow;
  world.embers = embers;
  // Pizzas bake toward the front of the deck, where you can see them through the mouth.
  world.ovenCenter = { x: cx + 0.1, y: y0 + 0.03, z: cz + 0.62 };

  // A long-handled peel leaning against the plinth.
  const peel = new THREE.Group();
  box(0.04, 1.5, 0.04, mat(0x8a6a44), 0, 0, 0, peel);
  box(0.36, 0.01, 0.36, steel(), 0, 1.5, 0, peel).rotation.x = Math.PI / 2;
  peel.position.set(cx + o.w / 2 + 0.05, 0, cz + 0.6);
  peel.rotation.z = -0.18;
  scene.add(peel);
}

function buildPass() {
  const p = KITCHEN.pass;
  box(p.w, 1.12, p.d, mat(COLORS.black, { roughness: 0.6 }), p.x, 0, p.z);
  box(p.w + 0.1, 0.04, p.d + 0.1, steel(), p.x, 1.12, p.z);
  // Lamps sit either side of the oven so diners get a clear look at the fire.
  for (const x of [3.9, 5.0, 8.2, 9.3]) {
    box(0.06, 0.6, 0.06, mat(COLORS.black), x, 1.16, p.z);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.2, 16, 1, true), mat(COLORS.red, { side: THREE.DoubleSide }));
    shade.position.set(x, 1.85, p.z);
    scene.add(shade);
  }
  for (let i = 0; i < 8; i++) world.passSpots.push({ x: p.x - p.w / 2 + 0.45 + i * 0.75, y: 1.16, z: p.z });
}

function buildOffice() {
  const z = ZONES.office;
  box(1.8, 0.75, 0.8, mat(COLORS.woodDark, { roughness: 0.5 }), 15, 0, 1.8);   // desk
  box(0.5, 0.35, 0.03, mat(0x222222), 15, 0.75, 1.6);                          // monitor
  box(0.5, 0.5, 0.5, mat(COLORS.red), 15, 0, 2.7);                             // chair
  box(0.6, 1.3, 0.5, mat(0x56514c), z.x0 + 0.5, 0, 0.5);                       // filing cabinet
  box(0.8, 0.9, 0.5, mat(0x2a2a2a), z.x1 - 0.7, 0, 0.5);                       // safe
  // Framed photo of Mama Maggie on the back wall.
  box(0.7, 0.55, 0.04, mat(COLORS.brass, { metalness: 0.6, roughness: 0.4 }), 15, 1.4, 0.14);
  box(0.6, 0.45, 0.02, mat(0x8a7a62), 15, 1.45, 0.17);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5), new THREE.MeshBasicMaterial({ map: textTex('Ufficio', { font: 'italic 700 70px Georgia, serif' }) }));
  sign.rotation.x = -Math.PI / 2;
  sign.position.set(15, 0.01, 4.6);
  scene.add(sign);
}

/** The bar is a stage: the drink-mixing minigame is played from a stool, looking across the
 *  counter at the bartender and a lit back bar. Flair lives here: backlit bottle shelves, gold
 *  arches, a neon sign, glass pendants, and brass trim. */
function buildBar() {
  const c = BAR.counter;
  const cz = (c.z0 + c.z1) / 2, len = c.z1 - c.z0;
  const mahogany = mat(0x4a1a12, { roughness: 0.45 });
  const brass = mat(COLORS.brass, { metalness: 0.8, roughness: 0.3 });
  // Counter body, a glossy black top that overhangs the guest side, and a brass edge.
  box(c.x1 - c.x0, 1.0, len, mahogany, (c.x0 + c.x1) / 2, 0, cz);
  box(c.x1 - c.x0 + 0.3, 0.06, len + 0.12, mat(0x0e0b0c, { roughness: 0.12, metalness: 0.3 }), (c.x0 + c.x1) / 2 - 0.1, 1.0, cz);
  const edge = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len + 0.12, 8), brass);
  edge.rotation.x = Math.PI / 2;
  edge.position.set(c.x0 - 0.25, 1.03, cz);
  scene.add(edge);
  // Guest-side front: red leather panels between brass pilasters, lit from under the lip.
  const leather = mat(COLORS.red, { roughness: 0.5 });
  for (let z = c.z0 + 0.1; z < c.z1 - 0.1; z += 1.04) {
    box(0.03, 0.72, 0.9, leather, c.x0 - 0.01, 0.14, z + 0.47);
    box(0.04, 0.86, 0.06, brass, c.x0 - 0.02, 0.08, z);
  }
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, len), new THREE.MeshBasicMaterial({ color: 0xffb35a }));
  strip.position.set(c.x0 - 0.2, 0.96, cz);
  scene.add(strip);
  // Brass foot rail.
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 8), brass);
  rail.rotation.x = Math.PI / 2;
  rail.position.set(c.x0 - 0.18, 0.2, cz);
  scene.add(rail);

  // Back bar: low cabinet, then three backlit glass shelves of bottles under gold arches.
  const b = BAR.backBar;
  const bz = (b.z0 + b.z1) / 2, blen = b.z1 - b.z0;
  const wallX = b.x1 - 0.02;
  box(b.x1 - b.x0, 0.95, blen, mahogany, (b.x0 + b.x1) / 2, 0, bz);
  box(b.x1 - b.x0 + 0.04, 0.04, blen, mat(0x0e0b0c, { roughness: 0.15 }), (b.x0 + b.x1) / 2, 0.95, bz);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(blen - 0.3, 1.25), new THREE.MeshBasicMaterial({ map: glowTex() }));
  back.rotation.y = -Math.PI / 2;
  back.position.set(wallX, 1.6, bz);
  scene.add(back);
  // Arches: three bays, the middle one centred on the bartender's spot.
  const bays = [BAR.workGlass.z - 3.6, BAR.workGlass.z, BAR.workGlass.z + 3.6];
  for (const z of bays) {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.045, 8, 32, Math.PI), mat(0xc9a24a, { metalness: 0.7, roughness: 0.3 }));
    arch.rotation.y = -Math.PI / 2;
    arch.position.set(wallX - 0.04, 1.1, z);
    arch.scale.set(1, 0.7, 1);
    scene.add(arch);
  }
  for (const z of [bays[0] - 1.75, (bays[0] + bays[1]) / 2, (bays[1] + bays[2]) / 2, bays[2] + 1.75]) {
    if (z < b.z0 || z > b.z1) continue;
    box(0.3, 1.2, 0.08, mahogany, b.x1 - 0.17, 0.98, z);
  }
  const bottleCols = [0x6a0f1c, 0x2f5a2a, 0xe8d9a0, 0xf2661c, 0xc0141e, 0x3a1c0c, 0x9fc7cf, 0x7a2a12, 0x1f4a2a, 0xc9a24a, 0xf1f4f6];
  const glassMat = (col) => mat(col, { roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.88 });
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let shelf = 0; shelf < 3; shelf++) {
    const y = 1.12 + shelf * 0.36;
    const sh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.02, blen - 0.4), mat(0xdfe8ea, { roughness: 0.05, transparent: true, opacity: 0.5 }));
    sh.position.set(b.x1 - 0.2, y, bz);
    scene.add(sh);
    for (let z = b.z0 + 0.35; z < b.z1 - 0.3; z += 0.17 + rnd() * 0.08) {
      const col = bottleCols[Math.floor(rnd() * bottleCols.length)];
      const tall = 0.17 + rnd() * 0.1, fat = 0.032 + rnd() * 0.022;
      const kind = rnd();
      if (kind < 0.2) cyl(fat * 1.3, fat * 1.3, tall * 0.8, glassMat(col), b.x1 - 0.2, y + 0.01, z, scene, 6);   // square-ish bitters
      else cyl(fat, fat * 1.05, tall, glassMat(col), b.x1 - 0.2, y + 0.01, z, scene, 10);
      cyl(0.012, fat * 0.6, 0.08, glassMat(col), b.x1 - 0.2, y + 0.01 + tall, z, scene, 8);
      if (rnd() < 0.35) cyl(0.014, 0.014, 0.025, brass, b.x1 - 0.2, y + 0.09 + tall, z, scene, 8);  // pour spout
    }
  }
  // Neon over the middle bay.
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.48), new THREE.MeshBasicMaterial({
    map: neonTex('Aperitivo'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  neon.rotation.y = -Math.PI / 2;
  neon.position.set(wallX - 0.06, 2.28, BAR.workGlass.z);
  scene.add(neon);
  const neonLight = new THREE.PointLight(0xff3a3a, 2.2, 3.5, 1.6);
  neonLight.position.set(wallX - 0.5, 2.2, BAR.workGlass.z);
  scene.add(neonLight);
  world.neon = neon;

  // Glass globe pendants over the counter, on long black cords.
  for (const z of [2.6, BAR.workGlass.z - 1.7, BAR.workGlass.z + 1.7, 10.4]) {
    cyl(0.006, 0.006, 0.7, mat(COLORS.black), c.x0 + 0.4, 2.35, z, scene, 4);
    cyl(0.05, 0.05, 0.06, brass, c.x0 + 0.4, 2.3, z, scene, 10);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.95 }));
    globe.position.set(c.x0 + 0.4, 2.18, z);
    scene.add(globe);
    const l = new THREE.PointLight(0xffc98a, 5, 5, 1.6);
    l.position.set(c.x0 + 0.4, 2.1, z);
    scene.add(l);
  }

  // Espresso machine (red, of course) on the back bar.
  box(0.5, 0.45, 0.7, mat(COLORS.red, { roughness: 0.3, metalness: 0.3 }), b.x0 + 0.3, 0.95, 10.8);
  box(0.52, 0.06, 0.72, steel(), b.x0 + 0.3, 1.4, 10.8);
  // Beer taps on a brass tower.
  box(0.1, 0.34, 0.75, brass, c.x1 - 0.15, 1.06, 4.92);
  for (let i = 0; i < 3; i++) {
    const z = 4.7 + i * 0.22;
    cyl(0.02, 0.02, 0.12, steel(), c.x1 - 0.22, 1.28, z, scene, 8);
    cyl(0.025, 0.02, 0.2, mat(i === 0 ? COLORS.red : COLORS.black), c.x1 - 0.22, 1.4, z, scene, 8);
  }
  // Mise en place on the counter: citrus bowl, a shaker tin, a jigger, a little bitters bottle.
  const zp = BAR.workGlass.z;
  cyl(0.14, 0.09, 0.07, mat(COLORS.white, { roughness: 0.3 }), c.x0 + 0.35, 1.06, zp - 0.85, scene, 18);
  for (let i = 0; i < 5; i++) {
    const fr = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mat(i % 2 ? 0xf2d43a : 0xf28a1c, { roughness: 0.6 }));
    fr.position.set(c.x0 + 0.35 + Math.cos(i * 1.3) * 0.06, 1.15 + (i > 2 ? 0.04 : 0), zp - 0.85 + Math.sin(i * 1.3) * 0.06);
    scene.add(fr);
  }
  cyl(0.045, 0.038, 0.2, steel(), c.x0 + 0.5, 1.06, zp + 0.75, scene, 14);
  cyl(0.03, 0.02, 0.05, steel(), c.x0 + 0.5, 1.26, zp + 0.75, scene, 10);
  cyl(0.02, 0.015, 0.05, brass, c.x0 + 0.35, 1.06, zp + 0.95, scene, 10);
  cyl(0.025, 0.025, 0.11, glassMat(0x6a1a0c), c.x0 + 0.62, 1.06, zp + 1.0, scene, 6);

  // Bar mat where the working glass sits.
  box(0.5, 0.012, 0.9, mat(0x1c1c1c, { roughness: 1 }), BAR.workGlass.x, 1.06, BAR.workGlass.z);
  world.barGlass = { x: BAR.workGlass.x, y: 1.072, z: BAR.workGlass.z };
  // Service well / pickup marker.
  box(0.5, 0.012, 0.6, brass, c.x0 + 0.25, 1.06, c.z1 - 0.4);
  world.barPickup = { x: c.x0 + 0.25, y: 1.08, z: c.z1 - 0.4 };
  // Patterned tiles on the guest side of the bar, so it reads on the floor map too.
  const tiles = new THREE.Mesh(new THREE.PlaneGeometry(1.3, len + 0.4), new THREE.MeshStandardMaterial({ map: checker('#8f1d21', '#161214', 2, [2, 16]), roughness: 0.6 }));
  tiles.rotation.x = -Math.PI / 2;
  tiles.position.set(c.x0 - 0.75, 0.004, cz);
  tiles.receiveShadow = true;
  scene.add(tiles);
}

function buildHost() {
  const h = HOST_STAND;
  box(0.8, 1.05, 0.55, mat(COLORS.black, { roughness: 0.5 }), h.x, 0, h.z);
  box(0.86, 0.04, 0.6, mat(COLORS.red, { roughness: 0.4 }), h.x, 1.05, h.z);
  box(0.3, 0.02, 0.4, mat(COLORS.white), h.x, 1.09, h.z); // reservation book
  // "Please wait to be seated" sign on a brass stand.
  cyl(0.02, 0.02, 1.1, mat(COLORS.brass, { metalness: 0.7, roughness: 0.3 }), DOOR.x + 1.2, 0, DOOR.z - 1.2, scene, 8);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4), new THREE.MeshBasicMaterial({
    map: textTex('Please wait to be seated', { w: 512, h: 340, font: 'italic 600 44px Georgia, serif' }), side: THREE.DoubleSide,
  }));
  sign.position.set(DOOR.x + 1.2, 1.2, DOOR.z - 1.2);
  sign.rotation.x = -0.9;
  scene.add(sign);
  // Waiting bench along the left wall.
  box(0.45, 0.42, 9.5, mat(COLORS.red, { roughness: 0.55 }), 0.35, 0, 11.8);
  box(0.12, 0.9, 9.5, mat(COLORS.redDark, { roughness: 0.6 }), 0.16, 0, 11.8);
}

function buildDecor() {
  const pot = mat(0x8a4a2a, { roughness: 0.9 });
  const leaf = mat(0x3f6b34, { roughness: 0.9 });
  for (const [x, z] of [[19.6, 17.2], [3.6, 6.4], [25.3, 15.6], [10.3, 17.2]]) {
    cyl(0.22, 0.17, 0.4, pot, x, 0, z, scene, 12);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), leaf);
    crown.position.set(x, 0.95, z);
    crown.castShadow = true;
    scene.add(crown);
  }
  // The family name, painted on the floor just inside the door like an old tile inlay.
  const inlay = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.9), new THREE.MeshBasicMaterial({
    map: textTex(RESTAURANT.name, { w: 1024, h: 220, bg: '#8f1d21', fg: '#faf7f2', font: 'italic 700 150px Georgia, serif' }),
  }));
  inlay.rotation.x = -Math.PI / 2;
  inlay.position.set(7.2, 0.006, 17.15);
  scene.add(inlay);
  // Station signs on the floor map.
  for (const [text, x, z] of [['Cucina', 10.4, 4.6], ['Bar', 24.2, 13.6]]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.55), new THREE.MeshBasicMaterial({
      map: textTex(text, { w: 512, h: 118, bg: '#141012', fg: '#faf7f2', font: 'italic 700 76px Georgia, serif' }), transparent: true, opacity: 0.92,
    }));
    s.rotation.x = -Math.PI / 2;
    s.position.set(x, 0.012, z);
    scene.add(s);
  }
}

function buildZoneHits() {
  const add = (zone, x0, z0, x1, z1) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 2.5, z1 - z0), new THREE.MeshBasicMaterial({ visible: false }));
    m.position.set((x0 + x1) / 2, 1.25, (z0 + z1) / 2);
    m.userData.pick = { type: 'zone', id: zone };
    scene.add(m);
    pickables.push(m);
    world.zoneHits[zone] = m;
  };
  add('kitchen', 0, 0, 12, 6.0);
  add('office', 12, 0, 18, 5.6);
  add('bar', 22.0, 0, 26, 13.4);
}

export { TABLES };
