// Dynamic 3D props: food cooking on the line, plates on the island and pass, the working
// glass at the bar, and whatever has been set down on each table.
import * as THREE from 'three';
import { scene } from './scene.js';
import { world, mat, COLORS } from './world.js';
import { G, bus } from '../state.js';
import { COOKED, BINS, DISHES, DRINKS, GLASSES, POURS, GARNISHES } from '../data/menu.js';
import { tableGeometry } from '../data/layout.js';

const RAW = { spaghetti: 0xf8eec4, fettuccine: 0xf8eec4, meatballs: 0xc9806e, calamari: 0xf1ece2, pizza: 0xf2e2c0 };
const BURNT = 0x2a1a10;
const cA = new THREE.Color(), cB = new THREE.Color();

export function cookColor(key, t) {
  const def = COOKED[key];
  if (t < def.done) return cA.set(RAW[key]).lerp(cB.set(def.color), t / def.done).getHex();
  if (t <= def.done + def.hold) return def.color;
  const k = Math.min(1, (t - def.done - def.hold) / (def.ruin - def.done - def.hold));
  return cA.set(def.color).lerp(cB.set(BURNT), k * 0.85).getHex();
}

// ── Food components ─────────────────────────────────────────────────────────
const geo = {
  disc: new THREE.CylinderGeometry(1, 1, 1, 24),
  ball: new THREE.SphereGeometry(1, 12, 8),
  nest: new THREE.TorusKnotGeometry(0.045, 0.012, 64, 6, 3, 5),
  ring: new THREE.TorusGeometry(0.018, 0.007, 6, 12),
  leaf: new THREE.BoxGeometry(0.03, 0.006, 0.018),
};
function piece(g, geometry, color, sx, sy, sz, x, y, z, own = false) {
  const m = new THREE.Mesh(geometry, own ? new THREE.MeshStandardMaterial({ color, roughness: 0.7 }) : mat(color, { roughness: 0.7 }));
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
  return m;
}
const scatter = (n, r, fn) => { for (let i = 0; i < n; i++) { const a = i * 2.4 + 0.3, d = r * Math.sqrt((i + 0.5) / n); fn(Math.cos(a) * d, Math.sin(a) * d, i); } };

/** A mesh group for one plate component, built on a ~0.13 radius footprint. `y` is the stack height. */
export function componentMesh(key, y = 0, tint = null) {
  const g = new THREE.Group();
  const col = tint ?? (COOKED[key] || BINS[key])?.color ?? 0xcccccc;
  switch (key) {
    case 'dough': g.userData.crust = piece(g, geo.disc, col, 0.13, 0.016, 0.13, 0, y + 0.008, 0, true); break;
    case 'sauce': case 'marinara': piece(g, geo.disc, col, key === 'sauce' ? 0.112 : 0.06, 0.006, key === 'sauce' ? 0.112 : 0.06, key === 'marinara' ? 0.04 : 0, y + 0.018, 0); break;
    case 'alfredo': piece(g, geo.disc, col, 0.08, 0.008, 0.08, 0, y + 0.03, 0); break;
    case 'oliveoil': piece(g, geo.disc, col, 0.1, 0.002, 0.07, 0, y + 0.016, 0); break;
    case 'mozzarella': scatter(7, 0.09, (x, z) => piece(g, geo.ball, col, 0.022, 0.008, 0.022, x, y + 0.024, z)); break;
    case 'pepperoni': scatter(7, 0.09, (x, z) => piece(g, geo.disc, col, 0.017, 0.004, 0.017, x, y + 0.028, z)); break;
    case 'basil': case 'parsley': scatter(key === 'basil' ? 5 : 9, 0.08, (x, z, i) => { const m = piece(g, geo.leaf, col, 1, 1, 1, x, y + 0.04, z); m.rotation.y = i; }); break;
    case 'parmesan': scatter(10, 0.07, (x, z) => piece(g, geo.leaf, col, 0.4, 1, 0.4, x, y + 0.05, z)); break;
    case 'spaghetti': case 'fettuccine': { const m = piece(g, geo.nest, col, 1, 0.45, 1, 0, y + 0.02, 0, true); g.userData.crust = m; break; }
    case 'meatballs': scatter(3, 0.04, (x, z) => { const m = piece(g, geo.ball, col, 0.024, 0.022, 0.024, x, y + 0.045, z, true); (g.userData.parts ||= []).push(m); }); break;
    case 'calamari': scatter(8, 0.08, (x, z, i) => { const m = piece(g, geo.ring, col, 1, 1, 1, x, y + 0.02, z, true); m.rotation.x = Math.PI / 2 + i; (g.userData.parts ||= []).push(m); }); break;
    case 'lemon': piece(g, geo.disc, col, 0.025, 0.012, 0.025, -0.08, y + 0.02, 0.05); break;
    case 'tomato': scatter(5, 0.07, (x, z) => piece(g, geo.disc, col, 0.03, 0.008, 0.03, x, y + 0.012, z)); break;
    default: piece(g, geo.ball, col, 0.03, 0.03, 0.03, 0, y + 0.03, 0);
  }
  return g;
}

function setTint(g, color) {
  if (g.userData.crust) g.userData.crust.material.color.setHex(color);
  if (g.userData.parts) g.userData.parts.forEach((m) => m.material.color.setHex(color));
}

const plateGeo = new THREE.CylinderGeometry(0.15, 0.12, 0.02, 24);
export function plateMesh(comps, { tray = false } = {}) {
  const g = new THREE.Group();
  const p = new THREE.Mesh(tray ? new THREE.CylinderGeometry(0.15, 0.15, 0.008, 24) : plateGeo, mat(tray ? 0x3a3a3a : COLORS.white, { roughness: 0.3 }));
  p.position.y = 0.01;
  p.receiveShadow = true;
  g.add(p);
  comps.forEach((c) => g.add(componentMesh(c.key, 0.02, c.tint ?? null)));
  return g;
}

// ── Kitchen props (rebuilt on change, recolored every tick) ─────────────────
const kitchenGroup = new THREE.Group();
const passGroup = new THREE.Group();
const tableGroups = new Map();
let slotMeshes = [];

function rebuildKitchen() {
  kitchenGroup.clear();
  slotMeshes = [];
  const k = G.kitchen;
  if (!k) return;
  k.slots.oven.forEach((s, i) => {
    if (!s) return;
    const plate = k.plates.find((p) => p.id === s.plateId);
    const g = new THREE.Group();
    (plate?.comps || [{ key: 'dough' }]).forEach((c) => g.add(componentMesh(c.key, 0)));
    const sp = slotWorldPos('oven', i);
    g.position.set(sp.x, sp.y, sp.z);
    g.scale.setScalar(1.4);
    kitchenGroup.add(g);
    slotMeshes.push({ s, g: g.children.find((c) => c.userData.crust) || g.children[0] });
  });
  const place = (list, spots, scale = 1) => list.forEach((s, i) => {
    if (!s || !spots[i]) return;
    const g = componentMesh(s.key, 0);
    g.position.set(spots[i].x, spots[i].y, spots[i].z);
    g.scale.setScalar(scale);
    kitchenGroup.add(g);
    slotMeshes.push({ s, g });
  });
  place(k.slots.pot, world.pots, 2.2);
  place(k.slots.pan, world.pans, 2.4);
  place(k.slots.fryer, world.fryer, 2.2);
  // Warmer: small steel bowls.
  k.warmer.slice(0, world.warmerSpots.length).forEach((w, i) => {
    const sp = world.warmerSpots[i];
    const g = plateMesh([{ key: w.key }], { tray: true });
    g.position.set(sp.x, sp.y, sp.z);
    g.scale.setScalar(1.3);
    kitchenGroup.add(g);
  });
  // Plates on the island.
  k.plates.forEach((p, i) => {
    const sp = world.plateSpots[i];
    if (!sp || p.inOven) return;
    const comps = p.comps.map((c) => ({ key: c.key }));
    const g = plateMesh(comps);
    if (p.baked) g.children.slice(1).forEach((c) => setTint(c, cookColor('pizza', 10 + (1 - p.bakeQ) * 6)));
    g.position.set(sp.x, sp.y, sp.z);
    g.scale.setScalar(1.8);
    if (p.id === k.activePlateId) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.2, 32), new THREE.MeshBasicMaterial({ color: COLORS.red }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.005;
      g.add(ring);
    }
    kitchenGroup.add(g);
  });
  tickKitchen();
}

function tickKitchen() {
  for (const { s, g } of slotMeshes) setTint(g, cookColor(s.key, s.t));
}

function rebuildPass() {
  passGroup.clear();
  let i = 0;
  for (const t of G.tickets) {
    if (t.status !== 'ready') continue;
    for (const it of t.items) {
      if (t.kind === 'food') {
        const sp = world.passSpots[i++ % world.passSpots.length];
        const g = plateMesh(DISHES[it.key].build.map((key) => ({ key })));
        g.position.set(sp.x, sp.y, sp.z);
        g.scale.setScalar(1.6);
        passGroup.add(g);
      } else {
        const g = miniGlass(it.key);
        const bp = world.barPickup;
        g.position.set(bp.x + ((i % 3) - 1) * 0.12, bp.y, bp.z + Math.floor(i / 3) * 0.12);
        i++;
        passGroup.add(g);
      }
    }
  }
}

// ── Table props ─────────────────────────────────────────────────────────────
function miniGlass(drinkKey) {
  const g = new THREE.Group();
  const color = drinkColor(drinkKey);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.13, 10), mat(color, { transparent: true, opacity: 0.85, roughness: 0.1 }));
  m.position.y = 0.065;
  g.add(m);
  return g;
}

function drinkColor(key) {
  const def = DRINKS[key];
  if (!def) return 0xdfe9ee;
  return mixColor(def.pours);
}
export function mixColor(pours) {
  const c = new THREE.Color(0, 0, 0);
  let tot = 0;
  for (const [k, amt] of Object.entries(pours)) {
    if (!POURS[k] || amt <= 0) continue;
    c.add(new THREE.Color(POURS[k].color).multiplyScalar(amt));
    tot += amt;
  }
  return tot ? c.multiplyScalar(1 / tot).getHex() : 0xdfe9ee;
}

function rebuildTable(t) {
  const handle = world.tables[t.id];
  if (!handle) return;
  handle.items.clear();
  if (t.kind === 'bar') {
    t.items.forEach((it, i) => {
      const g = it.kind === 'drink' ? miniGlass(it.key) : it.kind === 'food' ? plateMesh(DISHES[it.key].build.map((key) => ({ key }))) : new THREE.Group();
      g.position.set(0, 0, (it.seat ? 0.45 : -0.45) + (it.kind === 'drink' ? 0.15 : -0.05));
      if (it.kind === 'drink') g.position.x = 0.12;
      handle.items.add(g);
    });
    return;
  }
  const seats = handle.seatsLocal;
  t.items.forEach((it) => {
    const s = seats?.[it.seat] || { x: 0, z: 0 };
    let g;
    if (it.kind === 'food') g = plateMesh(DISHES[it.key].build.map((key) => ({ key })));
    else if (it.kind === 'drink') g = miniGlass(it.key);
    else { g = new THREE.Group(); const n = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.01, 0.18), mat(COLORS.white)); g.add(n); }
    const k = it.kind === 'drink' ? 0.42 : 0.62;
    g.position.set(s.x * k + (it.kind === 'drink' ? s.z * 0.25 : 0), 0, s.z * k - (it.kind === 'drink' ? s.x * 0.25 : 0));
    if (t.state === 'dirty' && it.kind === 'food') g.children.slice(1).forEach((c, i) => { c.visible = i % 2 === 0; });
    handle.items.add(g);
  });
}

// ── Bar working glass ───────────────────────────────────────────────────────
const PROFILES = {
  pint:     { pts: [[0, 0], [0.032, 0], [0.034, 0.005], [0.042, 0.15], [0.045, 0.16]], base: 0.006, rim: 0.155 },
  wine:     { pts: [[0, 0], [0.036, 0], [0.036, 0.004], [0.005, 0.01], [0.005, 0.09], [0.03, 0.105], [0.045, 0.14], [0.042, 0.18], [0.036, 0.205]], base: 0.098, rim: 0.2 },
  rocks:    { pts: [[0, 0], [0.042, 0], [0.044, 0.095]], base: 0.012, rim: 0.092 },
  highball: { pts: [[0, 0], [0.032, 0], [0.034, 0.16]], base: 0.012, rim: 0.157 },
  coupe:    { pts: [[0, 0], [0.032, 0], [0.032, 0.004], [0.004, 0.012], [0.004, 0.095], [0.035, 0.105], [0.058, 0.125], [0.062, 0.135]], base: 0.1, rim: 0.133 },
};
function radiusAt(profile, y) {
  const p = profile.pts;
  for (let i = 1; i < p.length; i++) {
    if (y <= p[i][1]) {
      const [r0, y0] = p[i - 1], [r1, y1] = p[i];
      return y1 === y0 ? r1 : r0 + ((y - y0) / (y1 - y0)) * (r1 - r0);
    }
  }
  return p[p.length - 1][0];
}

const barGroup = new THREE.Group();
const glassHolder = new THREE.Group();
barGroup.add(glassHolder);
let liquid = null, foam = null, iceGroup = null, garnishGroup = null, lastGlass = null;
const pourBottle = new THREE.Group();
const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 6), mat(0xffffff, { transparent: true, opacity: 0.8 }));
let shakeT = 0;
export const barPourState = { key: null };

function buildGlass(type) {
  glassHolder.clear();
  liquid = foam = iceGroup = garnishGroup = null;
  if (!type) return;
  const prof = PROFILES[type];
  const glass = new THREE.Mesh(
    new THREE.LatheGeometry(prof.pts.map(([r, y]) => new THREE.Vector2(r, y)), 32),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transmission: 0.0, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  glass.renderOrder = 2;
  glassHolder.add(glass);
  liquid = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, roughness: 0.15 }));
  liquid.renderOrder = 1;
  glassHolder.add(liquid);
  iceGroup = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.022), new THREE.MeshStandardMaterial({ color: 0xeef7fb, transparent: true, opacity: 0.7, roughness: 0.05 }));
    c.position.set(Math.cos(i * 2.1) * 0.014, 0, Math.sin(i * 2.1) * 0.014);
    c.rotation.set(i, i * 0.7, 0);
    iceGroup.add(c);
  }
  glassHolder.add(iceGroup);
  foam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.006, 24), mat(0xf3e6cf, { roughness: 0.9 }));
  glassHolder.add(foam);
  garnishGroup = new THREE.Group();
  glassHolder.add(garnishGroup);
}

function updateBarGlass() {
  const b = G.bar;
  if (!b) return;
  if (b.glass !== lastGlass) { lastGlass = b.glass; buildGlass(b.glass); }
  if (!b.glass) { pourBottle.visible = false; return; }
  const prof = PROFILES[b.glass];
  const cap = GLASSES[b.glass].cap;
  const total = Object.values(b.pours).reduce((a, x) => a + x, 0);
  const frac = Math.min(1.02, total / cap);
  const yTop = prof.base + (prof.rim - prof.base) * frac;
  if (frac > 0.01) {
    const pts = [new THREE.Vector2(0, prof.base)];
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const y = prof.base + ((yTop - prof.base) * i) / steps;
      pts.push(new THREE.Vector2(Math.max(0.002, radiusAt(prof, y) - 0.003), y));
    }
    pts.push(new THREE.Vector2(0, yTop));
    liquid.geometry.dispose();
    liquid.geometry = new THREE.LatheGeometry(pts, 24);
    liquid.material.color.setHex(mixColor(b.pours));
    liquid.visible = true;
  } else liquid.visible = false;
  iceGroup.visible = b.ice;
  iceGroup.position.y = Math.max(prof.base + 0.015, yTop - 0.012);
  const fr = radiusAt(prof, yTop) - 0.004;
  foam.visible = (b.shaken || (b.pours.lager || 0) > 0.5) && frac > 0.05;
  foam.scale.set(fr, 1, fr);
  foam.position.y = yTop + 0.003;
  // Garnish on the rim.
  if (garnishGroup.userData.key !== b.garnish) {
    garnishGroup.clear();
    garnishGroup.userData.key = b.garnish;
    if (b.garnish) {
      const col = GARNISHES[b.garnish].color;
      const rimR = radiusAt(prof, prof.rim);
      if (b.garnish === 'beans') {
        for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(geo.ball, mat(col)); m.scale.set(0.007, 0.005, 0.009); m.position.set((i - 1) * 0.012, 0, 0); garnishGroup.add(m); }
        garnishGroup.position.set(0, yTop + 0.008, 0);
      } else {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.005, 20, 1, false, 0, Math.PI), mat(col));
        m.rotation.z = Math.PI / 2;
        garnishGroup.add(m);
        garnishGroup.position.set(0, prof.rim + 0.004, -rimR);
      }
    }
  }
  if (garnishGroup.userData.key === 'beans') garnishGroup.position.y = yTop + 0.008;
  // Pouring bottle + stream.
  const key = barPourState.key;
  pourBottle.visible = !!key;
  stream.visible = !!key;
  if (key) {
    const col = POURS[key].color;
    pourBottle.children.forEach((c) => c.material.color.setHex(POURS[key].tap ? 0xc0c4c8 : col));
    stream.material.color.setHex(col);
    const top = 0.42, bottomY = yTop;
    stream.scale.y = top - bottomY;
    stream.position.set(0, bottomY + (top - bottomY) / 2, 0);
  }
}

function buildPourBottle() {
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.025, 0.07, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
  neck.position.y = 0.13;
  pourBottle.add(body, neck);
  pourBottle.rotation.z = 2.1;
  pourBottle.position.set(0.1, 0.5, 0);
  barGroup.add(pourBottle, stream);
  pourBottle.visible = stream.visible = false;
}

// ── Lifecycle ───────────────────────────────────────────────────────────────
export function initProps() {
  scene.add(kitchenGroup, passGroup, barGroup);
  buildPourBottle();
  bus.on('kitchen:change', rebuildKitchen);
  bus.on('kitchen:tick', tickKitchen);
  bus.on('ticket:update', rebuildPass);
  bus.on('ticket:new', rebuildPass);
  bus.on('bar:shake', () => { shakeT = 0.7; });
}

export function resetProps() {
  kitchenGroup.clear(); passGroup.clear(); slotMeshes = [];
  lastGlass = undefined;
  for (const t of G.tables) {
    const h = world.tables[t.id];
    if (!h) continue;
    // Seat positions relative to the table, for laying out plates.
    h.seatsLocal = tableGeometry(t).seats.map((s) => ({ x: s.x - t.x, z: s.z - t.z }));
    h.items.clear();
    tableGroups.set(t.id, '');
  }
  rebuildKitchen();
}

export function updateProps(realDt, simTime) {
  // Rebuild a table's props only when its contents change.
  for (const t of G.tables) {
    const sig = `${t.state}|${t.items.map((i) => i.kind + i.key + i.seat).join(',')}`;
    if (tableGroups.get(t.id) !== sig) { tableGroups.set(t.id, sig); rebuildTable(t); }
  }
  const bg = world.barGlass;
  if (bg) {
    barGroup.position.set(bg.x, bg.y, bg.z);
    updateBarGlass();
    if (shakeT > 0) {
      shakeT -= realDt;
      glassHolder.position.y = Math.abs(Math.sin(shakeT * 30)) * 0.03;
      glassHolder.rotation.z = Math.sin(shakeT * 40) * 0.15;
    } else { glassHolder.position.y = 0; glassHolder.rotation.z = 0; }
  }
  // Oven: cut away in the kitchen station, whole everywhere else. Then the fire flicker.
  if (world.ovenCutaway) for (const m of world.ovenCutaway) m.visible = G.view !== 'kitchen';
  if (world.fireLight) {
    const flick = Math.sin(simTime * 13) * 0.6 + Math.sin(simTime * 7.3) * 0.5;
    world.fireLight.intensity = 5.5 + flick;
    world.mouthGlow.intensity = 3.6 + flick * 0.6;
    world.embers.scale.y = 0.45 + Math.sin(simTime * 9) * 0.05;
    world.flames.forEach((f, i) => {
      const k = 0.75 + 0.3 * Math.sin(simTime * (11 + i * 2.3) + i * 1.7);
      f.scale.set(1, k, 1);
      f.position.y = f.userData.base + (k - 1) * 0.22;
    });
  }
  // Pots bubble while something cooks.
  world.pots.forEach((p, i) => {
    const busy = G.kitchen?.slots.pot[i];
    p.water.position.y = 1.22 + (busy ? Math.sin(simTime * 18 + i) * 0.004 : 0);
  });
}

/** Where a cooking slot sits in the world (for the kitchen hotspots). */
export function slotWorldPos(station, i) {
  if (station === 'oven') {
    // Pizzas fan out across the oven deck.
    const ov = world.ovenCenter;
    const n = G.kitchen.slots.oven.length;
    const a = (i / Math.max(1, n - 1) - 0.5) * 2.0;
    return { x: ov.x + Math.sin(a) * 0.75, y: ov.y, z: ov.z + Math.cos(a) * 0.3 - 0.1 };
  }
  return { pot: world.pots, pan: world.pans, fryer: world.fryer }[station][i];
}
