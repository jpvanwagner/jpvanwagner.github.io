/* Builds one shopfront + interior in store-local space (see catalog.js for the coordinate frame).
   Returns the walk-in entrances [{x, w}] so shoppers can use them. */
import { STORE_TYPES, furnish, MENU_ITEMS } from "./catalog.js";
import { signTexture, bladeTexture, posterTexture, menuTexture } from "../textures.js";
import { shade } from "../geo.js";
import { STORE_H, STORE_DEPTH } from "../../config.js";

const FH = 4.0;          // facade height of one storey (floor to slab / ceiling)
const PIL = 0.3;         // pilaster width at each end of a shop
const FRAME = "#2f3034";

export function buildStore(K, typeId, w, opts) {
  const rng = K.rng, T = K.theme;
  const type = STORE_TYPES[typeId];
  if (typeId === "parking") return buildParking(K, w, opts);
  const name = rng.pick(type.names);
  const pal = rng.pick(type.palettes);
  const brand = { name, primary: pal[0], secondary: pal[1], signText: pal[2], walls: type.walls, floor: type.floor };
  let facade = rng.pick(type.facades);
  if (facade === "recessed" && w < 6) facade = "glass";
  const D = STORE_DEPTH, x0 = PIL, x1 = w - PIL, ow = x1 - x0;
  const S = K.solid, GL = K.glass, GW = K.glow;
  const pilaster = opts.upper ? shade(T.fascia, 0.97) : shade(T.wall, 1.04);

  // ---- pilasters + sign band
  S.box(PIL / 2, FH / 2, 0.03, PIL, FH, 0.32, pilaster);
  S.box(w - PIL / 2, FH / 2, 0.03, PIL, FH, 0.32, pilaster);
  const signStyle = rng.pick(type.sign);
  const font = rng.pick(type.fonts);
  const bandCol = signStyle === "letters" ? brand.primary : signStyle === "neon" ? "#17141d" : shade(T.fascia, 0.95);
  S.box(w / 2, (STORE_H + FH) / 2, -0.03, ow, FH - STORE_H, 0.22, bandCol);
  const sw = Math.min(ow * 0.82, 6.5), sh = Math.min(0.72, sw / 4);
  if (signStyle === "panel") {
    S.box(w / 2, 3.52, 0.1, sw + 0.12, sh + 0.12, 0.08, shade(brand.primary, 0.7));
    K.sign(signTexture(name, { bg: brand.primary, fg: brand.signText, font, upper: font === "condensed" || font === "head" }), w / 2, 3.52, 0.145, sw, sh);
  } else if (signStyle === "letters") {
    K.sign(signTexture(name, { fg: brand.signText, font, transparent: true, upper: font === "head" }), w / 2, 3.52, 0.09, sw, sh);
  } else {
    K.sign(signTexture(name, { bg: "#17141d", fg: brand.signText, font, neon: true, upper: true }), w / 2, 3.52, 0.09, sw, sh);
  }
  // projecting blade sign (lower floor only) — readable from far down the corridor
  if (!opts.upper && rng.chance(0.55) && typeId !== "theater") {
    const bt = bladeTexture(name, { bg: signStyle === "neon" ? "#17141d" : brand.primary, fg: brand.signText, font, neon: signStyle === "neon" });
    const bx = rng.chance(0.5) ? 0.75 : w - 0.75;
    S.box(bx, 3.85, 0.55, 0.05, 0.3, 0.05, FRAME); S.box(bx, 3.72, 0.55, 0.06, 0.04, 1.0, FRAME);
    K.sign(bt, bx + 0.035, 3.3, 0.6, 0.95, 0.48, Math.PI / 2);
    K.sign(bt, bx - 0.035, 3.3, 0.6, 0.95, 0.48, -Math.PI / 2);
    S.box(bx, 3.3, 0.6, 0.06, 0.52, 0.99, shade(brand.primary, 0.6));
  }

  // ---- interior shell
  const wallC = brand.walls;
  S.box(w / 2, 0.005, -D / 2, ow, 0.01, D, brand.floor);
  S.box(w / 2, FH / 2, -D - 0.05, ow + 0.2, FH, 0.1, wallC);
  S.box(x0 + 0.04, FH / 2, -D / 2, 0.08, FH, D, shade(wallC, 0.93));
  S.box(x1 - 0.04, FH / 2, -D / 2, 0.08, FH, D, shade(wallC, 0.93));
  S.box(w / 2, 3.35, -D / 2 - 0.1, ow, 0.1, D, type.dark ? "#141218" : shade(wallC, 0.97));
  for (let lx = x0 + 1.2; lx < x1 - 0.6; lx += 2.4) for (let lz = -1.6; lz > -D + 0.8; lz -= 2.4)
    GW.box(lx, 3.29, lz, 0.9, 0.02, 0.9, type.dark ? "#a08ad0" : "#fffaf0");

  // ---- the shopfront itself
  const doors = [];
  const glassPane = (a, b, y0, y1, z) => {
    if (b - a < 0.05) return;
    GL.box((a + b) / 2, (y0 + y1) / 2, z, b - a, y1 - y0, 0.03, "#cfe4ea");
    const n = Math.max(1, Math.round((b - a) / 1.6));
    for (let i = 0; i <= n; i++) S.box(a + (b - a) * i / n, (y0 + y1) / 2, z, 0.06, y1 - y0, 0.07, FRAME);
    S.box((a + b) / 2, y1, z, b - a, 0.07, 0.08, FRAME);
  };
  const bulkhead = (a, b, z) => { if (b - a > 0.05) S.box((a + b) / 2, 0.24, z, b - a, 0.48, 0.12, shade(brand.primary, 0.85)); };
  const platform = (a, b) => { if (b - a > 0.3) S.box((a + b) / 2, 0.15, -0.9, b - a - 0.1, 0.3, 1.4, shade(wallC, 0.85)); };
  const doorway = (dc, dw, z, leaves) => {
    S.box(dc - dw / 2, 1.35, z, 0.1, 2.7, 0.12, FRAME); S.box(dc + dw / 2, 1.35, z, 0.1, 2.7, 0.12, FRAME);
    S.box(dc, 2.72, z, dw + 0.1, 0.08, 0.12, FRAME);
    GL.box(dc, (2.76 + STORE_H) / 2, z, dw, STORE_H - 2.76, 0.03, "#cfe4ea");
    S.box(dc, 0.006, z - 0.2, dw, 0.012, 0.9, "#6a6460");   // entry mat
    if (leaves) for (const sgn of [-1, 1]) {               // glass doors swung open into the shop
      const hx = dc + sgn * dw / 2, a = sgn * 1.25, lw = dw / 2 - 0.04;
      S.push(hx, 0, z, a);
      GL.push(hx, 0, z, a);
      GL.box(-sgn * lw / 2, 1.35, 0, lw, 2.6, 0.03, "#d8ecf0");
      S.box(-sgn * lw / 2, 1.35, 0, lw, 0.05, 0.05, "#b0b4b8");
      S.box(-sgn * (lw - 0.08), 1.2, 0.06, 0.03, 0.5, 0.03, "#d0d4d8");
      GL.pop(); S.pop();
    }
    doors.push({ x: dc, w: dw });
  };

  if (facade === "glass" || facade === "awning" || facade === "side") {
    const dw = Math.min(2.2, ow * 0.4);
    const dc = facade === "side" ? (rng.chance(0.5) ? x0 + 0.4 + dw / 2 : x1 - 0.4 - dw / 2) : w / 2;
    const a = dc - dw / 2 - 0.05, b = dc + dw / 2 + 0.05;
    bulkhead(x0, a, -0.05); bulkhead(b, x1, -0.05);
    glassPane(x0, a, 0.48, STORE_H, -0.05); glassPane(b, x1, 0.48, STORE_H, -0.05);
    platform(x0, a); platform(b, x1);
    doorway(dc, dw, -0.05, rng.chance(0.6));
    if (facade === "awning") awning(K, x0, x1, brand);
  } else if (facade === "recessed") {
    const dw = 2.0, R = 1.8, dc = w / 2, a = dc - dw / 2, b = dc + dw / 2;
    // angled display windows lead the eye (and shoppers) into the entrance
    const pts = [[x0, 0], [a - 0.05, -R], [b + 0.05, -R], [x1, 0]];
    for (const [p, q] of [[pts[0], pts[1]], [pts[3], pts[2]]]) {
      const yb = 0.48;
      GL.quad([p[0], yb, p[1]], [q[0], yb, q[1]], [q[0], STORE_H, q[1]], [p[0], STORE_H, p[1]], "#cfe4ea");
      GL.quad([q[0], yb, q[1]], [p[0], yb, p[1]], [p[0], STORE_H, p[1]], [q[0], STORE_H, q[1]], "#cfe4ea");
      S.quad([p[0], 0, p[1]], [q[0], 0, q[1]], [q[0], yb, q[1]], [p[0], yb, p[1]], shade(brand.primary, 0.85));
      S.quad([q[0], 0, q[1]], [p[0], 0, p[1]], [p[0], yb, p[1]], [q[0], yb, q[1]], shade(brand.primary, 0.85));
      S.box(q[0], STORE_H / 2, q[1], 0.08, STORE_H, 0.08, FRAME);
    }
    S.box(w / 2, STORE_H + 0.02, -R / 2, ow, 0.06, R, shade(T.fascia, 0.9));           // soffit
    S.box(dc, 0.008, -R / 2, b - a + 0.2, 0.016, R, "#d9d2c4");                       // terrazzo vestibule
    for (let i = 0; i < 2; i++) GW.box(dc - 0.5 + i, STORE_H - 0.02, -R / 2, 0.25, 0.02, 0.25, "#fffaf0");
    platform(x0, a - 0.2); platform(b + 0.2, x1);
    doorway(dc, dw, -R, rng.chance(0.5));
  } else if (facade === "open" || facade === "counter") {
    S.box(w / 2, STORE_H - 0.08, 0.0, ow, 0.16, 0.24, "#7a7c80");                    // roll-up grille housing
    S.box(x0 + 0.04, STORE_H / 2, 0.0, 0.06, STORE_H, 0.12, "#8a8c90"); S.box(x1 - 0.04, STORE_H / 2, 0.0, 0.06, STORE_H, 0.12, "#8a8c90");
    S.box(w / 2, 0.006, 0, ow, 0.012, 0.18, "#8a8c90");
    if (facade === "open") doors.push({ x: w / 2, w: ow - 1.2 });
    else {
      const items = MENU_ITEMS[name] || ["Combo", "Side", "Drink", "Dessert", "Snack", "Special", "Kids", "Value"];
      K.sign(menuTexture(name, items, brand.primary), w / 2, 2.55, -D + 0.17, Math.min(3.4, ow - 0.6), Math.min(1.7, (ow - 0.6) / 2));
    }
  } else if (facade === "theater") {
    theaterFront(K, w, x0, x1, brand, doors);
  }

  furnish(K, typeId, w, D, brand);
  return { doors, name };
}

function awning(K, x0, x1, brand) {
  const n = Math.max(4, Math.round((x1 - x0) / 0.5)), sw = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const a = x0 + i * sw, b = a + sw, c = i % 2 ? "#f4f1ea" : brand.primary;
    K.solid.quad([a, 2.55, 1.0], [b, 2.55, 1.0], [b, 3.05, 0.02], [a, 3.05, 0.02], c);
    K.solid.quad([b, 2.55, 1.0], [a, 2.55, 1.0], [a, 3.05, 0.02], [b, 3.05, 0.02], shade(c, 0.7));
    K.solid.quad([a, 2.35, 1.0], [b, 2.35, 1.0], [b, 2.55, 1.0], [a, 2.55, 1.0], c);
  }
}

function theaterFront(K, w, x0, x1, brand, doors) {
  const S = K.solid, GL = K.glass, GW = K.glow, rng = K.rng;
  // marquee canopy with chaser bulbs
  S.box(w / 2, 2.95, 0.7, x1 - x0 - 0.4, 0.22, 1.5, "#1a1020");
  for (let x = x0 + 0.4; x < x1 - 0.3; x += 0.35) { GW.sphere(x, 2.82, 1.44, 0.055, "#ffe7a0", 1, true); GW.sphere(x, 2.82, -0.02, 0.055, "#ffe7a0", 1, true); }
  // three pairs of glass doors
  const dw = Math.min(5.4, (x1 - x0) * 0.5), dc = w / 2;
  for (let i = 0; i < 3; i++) {
    const cx = dc - dw / 2 + dw / 6 + i * dw / 3;
    GL.box(cx, 1.25, -0.05, dw / 3 - 0.12, 2.5, 0.03, "#b8c8d0");
    S.box(cx - dw / 6 + 0.03, 1.3, -0.05, 0.06, 2.6, 0.08, "#c9a24a"); S.box(cx, 1.2, -0.02, 0.03, 0.5, 0.04, "#c9a24a");
  }
  S.box(dc + dw / 2 - 0.03, 1.3, -0.05, 0.06, 2.6, 0.08, "#c9a24a");
  S.box(dc, 2.62, -0.05, dw, 0.08, 0.1, "#c9a24a");
  doors.push({ x: dc, w: dw * 0.8 });
  // poster cases either side
  const left = dc - dw / 2, right = dc + dw / 2;
  [[x0, left], [right, x1]].forEach(([a, b], side) => {
    S.box((a + b) / 2, 1.4, -0.08, b - a, 2.8, 0.14, "#2a1a24");
    const n = Math.max(1, Math.floor((b - a) / 1.15));
    for (let i = 0; i < n; i++) {
      const px = a + (i + 0.5) * (b - a) / n;
      S.box(px, 1.5, 0.0, 0.92, 1.36, 0.05, "#c9a24a");
      K.sign(posterTexture(rng.int(0, 23)), px, 1.5, 0.03, 0.8, 1.2);
      for (let k = 0; k < 4; k++) GW.sphere(px + (k % 2 ? 0.45 : -0.45), 0.82 + (k > 1 ? 1.36 : 0), 0.04, 0.035, "#ffe7a0", 1, true);
    }
  });
}

/* Parking garage: no shops — parked cars in bays behind a curb, under a concrete deck. */
function buildParking(K, w, opts) {
  const S = K.solid, GW = K.glow, rng = K.rng, D = STORE_DEPTH;
  S.box(w / 2, 0.005, -D / 2, w, 0.01, D, "#8f938c");
  S.box(w / 2, FH / 2, -D - 0.1, w, FH, 0.2, "#a9ada6");
  S.box(w / 2, 3.6, -D / 2, w, 0.12, D, "#9ea29b");
  S.box(w / 2, 0.08, -0.15, w, 0.16, 0.3, "#c9c9c0");                               // curb
  S.box(0.2, FH / 2, -0.3, 0.4, FH, 0.4, "#b4b8b1");                                 // pillar
  S.box(0.2, 0.6, -0.08, 0.42, 1.2, 0.02, "#e8c547");
  const n = Math.max(1, Math.floor(w / 2.8)), bw = w / n;
  for (let i = 0; i < n; i++) {
    const cx = (i + 0.5) * bw;
    S.box(i * bw + 0.05, 0.012, -D / 2, 0.1, 0.012, D - 1, "#f2f2ea");               // stall line
    if (rng.chance(0.78)) car(K, cx, -D * 0.55, rng.pick(["#c85440", "#3a5a8a", "#e9e2d0", "#2b2b2b", "#7a8a8a", "#3f6a3f", "#c9a24a"]), rng.chance(0.5));
    GW.box(cx, 3.53, -D / 2, 0.15, 0.03, 1.4, "#f4fbff");
  }
  if (!opts.upper) K.sign(signTexture(opts.bayLabel || "LEVEL P1", { bg: "#2a5a8a", fg: "#ffffff", font: "head", upper: true }), w / 2, 3.2, 0.05, 2.4, 0.6);
  return { doors: [], name: "parking" };
}

function car(K, x, z, color, flip) {
  const S = K.solid;
  K.push(x, 0, z, flip ? Math.PI : 0);
  S.box(0, 0.55, 0, 1.75, 0.55, 4.2, color);
  S.box(0, 1.02, -0.2, 1.55, 0.45, 2.2, shade(color, 0.85));
  K.glass.box(0, 1.02, -0.2, 1.58, 0.36, 2.0, "#9fb4c0");
  for (const [wx, wz] of [[-0.85, 1.3], [0.85, 1.3], [-0.85, -1.3], [0.85, -1.3]]) S.cyl(wx, 0.33, wz, 0.33, 0.25, "#1d1d1d", false, 0, Math.PI / 2);
  K.glow.box(-0.6, 0.65, 2.11, 0.3, 0.12, 0.02, "#fff2c8"); K.glow.box(0.6, 0.65, 2.11, 0.3, 0.12, 0.02, "#fff2c8");
  K.glow.box(-0.6, 0.7, -2.11, 0.3, 0.1, 0.02, "#c83030"); K.glow.box(0.6, 0.7, -2.11, 0.3, 0.1, 0.02, "#c83030");
  K.pop();
}
