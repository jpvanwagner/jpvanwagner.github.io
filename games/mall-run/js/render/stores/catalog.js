/* Store catalogue: every type of shop the mall can generate — names, brand colours, sign style,
   which facade styles suit it, and how its interior is furnished.

   Interior builders work in STORE-LOCAL space: x runs 0..w along the facade, y is up (0 = this floor),
   the shop window is at z = 0 and the shop extends back to z = -D. K.solid / K.glow / K.glass are GeoBatches. */
import { shade } from "../geo.js";

const PROD = ["#c85440", "#3fa89b", "#e39ab4", "#7a5aa0", "#f0c85a", "#5a6b7a", "#4a8a80", "#e9e2d0", "#2f3a4a", "#d8834f"];

/* ---------------- shared furniture helpers ---------------- */
export function mannequin(K, x, z, ry, top, bottom, skirt) {
  const S = K.solid, skin = "#efe9e0";
  S.push(x, 0, z, ry);
  S.box(0, 0.06, 0, 0.5, 0.12, 0.5, "#3a3a3a");                 // plinth
  S.cyl(0, 0.35, 0, 0.025, 0.5, "#888");
  if (skirt) S.cone(0, 0.85, 0, 0.3, 0.55, bottom);
  else { S.cyl(-0.1, 0.62, 0, 0.075, 0.9, bottom, true); S.cyl(0.1, 0.62, 0, 0.075, 0.9, bottom, true); }
  S.box(0, 1.08, 0, 0.36, 0.24, 0.2, bottom);
  S.box(0, 1.42, 0, 0.42, 0.5, 0.22, top);
  S.cyl(-0.27, 1.32, 0.02, 0.05, 0.6, top, true, 0.1, 0.12); S.cyl(0.27, 1.32, 0.02, 0.05, 0.6, top, true, 0.1, -0.12);
  S.cyl(0, 1.72, 0, 0.045, 0.1, skin, true);
  S.sphere(0, 1.86, 0, 0.11, skin, 1.15);
  S.pop();
}

function shelfUnit(K, x0, x1, z, y0, rows, depth, frame, fill) {
  const S = K.solid, w = x1 - x0;
  S.box((x0 + x1) / 2, y0 + rows * 0.42 / 2 + 0.05, z - depth / 2, w, rows * 0.42 + 0.1, 0.04, shade(frame, 0.85)); // back
  for (let r = 0; r <= rows; r++) S.box((x0 + x1) / 2, y0 + r * 0.42, z - depth / 2 + 0.02, w, 0.035, depth, frame);
  S.box(x0, y0 + rows * 0.21, z - depth / 2 + 0.02, 0.04, rows * 0.42, depth, frame);
  S.box(x1, y0 + rows * 0.21, z - depth / 2 + 0.02, 0.04, rows * 0.42, depth, frame);
  if (fill) for (let r = 0; r < rows; r++) fill(r, y0 + r * 0.42 + 0.02, x0 + 0.05, x1 - 0.05, z - depth / 2 + 0.02);
}

/** Wall shelving along the back wall. */
function backShelves(K, w, D, rows, frame, fill) {
  const segs = Math.max(1, Math.round((w - 1) / 2.4));
  const sw = (w - 1) / segs;
  for (let i = 0; i < segs; i++) shelfUnit(K, 0.5 + i * sw + 0.05, 0.5 + (i + 1) * sw - 0.05, -D + 0.45, 0.25, rows, 0.4, frame, fill);
}

function table(K, x, z, w, d, h, top, legs) {
  const S = K.solid;
  S.box(x, h - 0.03, z, w, 0.06, d, top);
  const lx = w / 2 - 0.06, lz = d / 2 - 0.06;
  [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].forEach(([a, b]) => S.box(x + a, h / 2, z + b, 0.05, h, 0.05, legs || shade(top, 0.6)));
}

function stackedGoods(K, x0, x1, y, z, colors, h, rng, gap) {
  let x = x0;
  while (x < x1 - 0.12) {
    const bw = 0.16 + rng.next() * 0.3;
    if (x + bw > x1) break;
    const bh = h * (0.6 + rng.next() * 0.4);
    K.solid.box(x + bw / 2, y + bh / 2, z, bw - (gap || 0.02), bh, 0.28, rng.pick(colors));
    x += bw;
  }
}

/* ---------------- interiors ---------------- */
const I = {
  apparel(K, w, D, b) {
    const { rng } = K;
    backShelves(K, w, D, 4, "#d9cfbf", (r, y, x0, x1, z) => stackedGoods(K, x0, x1, y, z, [b.primary, b.secondary, "#e9e2d0", "#2f3a4a", rng.pick(PROD)], 0.16, rng, 0.03));
    const racks = Math.max(1, Math.floor((w - 1) / 3.2));
    for (let i = 0; i < racks; i++) {
      const x = 0.9 + (i + 0.5) * (w - 1.8) / racks, z = -D * (0.45 + (i % 2) * 0.12);
      K.solid.cyl(x, 0.65, z, 0.03, 1.3, "#9a9a9a"); K.solid.cyl(x, 0.03, z, 0.35, 0.05, "#777");
      K.solid.torus(x, 1.3, z, 0.55, "#bdbdbd", Math.PI / 2);
      for (let k = 0; k < 9; k++) {
        const a = k / 9 * Math.PI * 2;
        K.solid.box(x + Math.cos(a) * 0.55, 0.92, z + Math.sin(a) * 0.55, 0.06, 0.72, 0.42, rng.pick(PROD), -a);
      }
    }
    if (w >= 6) { mannequin(K, 1.2, -0.9, rng.range(-0.4, 0.4), b.primary, "#2f3a4a", rng.chance(0.4)); mannequin(K, w - 1.2, -0.9, rng.range(-0.4, 0.4), b.secondary, rng.pick(PROD), rng.chance(0.5)); }
  },
  shoes(K, w, D, b) {
    const { rng } = K;
    backShelves(K, w, D, 5, "#f3efe7", (r, y, x0, x1, z) => {
      for (let x = x0 + 0.18; x < x1 - 0.1; x += 0.4) K.solid.box(x, y + 0.06, z + 0.04, 0.24, 0.1, 0.26, rng.pick(PROD));   // a pair of shoes
    });
    K.solid.box(w / 2, 0.22, -D * 0.5, Math.min(3, w - 2), 0.44, 0.6, b.primary);       // try-on bench
    table(K, w / 2, -1.4, Math.min(2.4, w - 2), 0.8, 0.75, "#f6f2ea");
    for (let i = 0; i < 4; i++) K.solid.box(w / 2 - 0.8 + i * 0.5, 0.82, -1.4, 0.12, 0.1, 0.28, rng.pick(PROD));
  },
  electronics(K, w, D, b) {
    const { rng } = K;
    const cols = Math.max(2, Math.floor((w - 1.2) / 1.05)), x0 = (w - cols * 1.05) / 2;
    K.solid.box(w / 2, 1.6, -D + 0.12, w - 0.8, 2.4, 0.1, "#1d1f24");
    for (let r = 0; r < 2; r++) for (let c = 0; c < cols; c++) {
      const hue = rng.pick(["#3fa6d8", "#5ad0b0", "#e86a9a", "#f2c14e", "#8a7ae0", "#6ad06a"]);
      K.glow.box(x0 + c * 1.05 + 0.52, 1.15 + r * 0.72, -D + 0.19, 0.96, 0.62, 0.02, hue);
    }
    for (let t = 0; t < Math.max(1, Math.floor(w / 4)); t++) {
      const x = 1.6 + t * 3.6; if (x > w - 1.2) break;
      table(K, x, -D * 0.45, 2.0, 0.9, 0.9, "#f4f4f4", "#cfcfcf");
      for (let k = 0; k < 3; k++) {
        K.solid.box(x - 0.6 + k * 0.6, 0.92, -D * 0.45, 0.42, 0.02, 0.3, "#2b2b2f");
        K.solid.box(x - 0.6 + k * 0.6, 1.06, -D * 0.45 - 0.14, 0.42, 0.28, 0.02, "#2b2b2f", 0, -0.2);
        K.glow.box(x - 0.6 + k * 0.6, 1.06, -D * 0.45 - 0.125, 0.38, 0.24, 0.01, "#9ad8f0", 0, -0.2);
      }
    }
  },
  books(K, w, D, b) {
    const { rng } = K;
    const spines = ["#7a2f2f", "#2f4a6a", "#3f6a3f", "#c9a24a", "#e9e2d0", "#5a3a6a", "#c85440", "#2b2822", "#3fa89b"];
    backShelves(K, w, D, 5, "#7a5a3a", (r, y, x0, x1, z) => stackedGoods(K, x0, x1, y, z, spines, 0.33, rng, 0.0));
    for (const sx of [0.55, w - 0.55]) {          // side bookcases
      K.solid.push(sx, 0, -D * 0.55, sx < w / 2 ? Math.PI / 2 : -Math.PI / 2);
      shelfUnit(K, -1.6, 1.6, 0.2, 0.25, 5, 0.38, "#7a5a3a", (r, y, a, c, z) => stackedGoods(K, a, c, y, z, spines, 0.33, rng, 0));
      K.solid.pop();
    }
    table(K, w / 2, -2.2, Math.min(2.6, w - 2.4), 1.2, 0.8, "#8a6a4a");
    for (let i = 0; i < 6; i++) K.solid.box(w / 2 - 0.9 + (i % 3) * 0.9, 0.86 + Math.floor(i / 3) * 0.05, -2.2 + (i > 2 ? 0.25 : -0.25), 0.35, 0.08 + rng.next() * 0.1, 0.25, rng.pick(spines));
  },
  toys(K, w, D, b) {
    const { rng } = K;
    backShelves(K, w, D, 4, "#f4f1ea", (r, y, x0, x1, z) => {
      for (let x = x0 + 0.2; x < x1 - 0.15; x += 0.38) {
        if (rng.chance(0.4)) K.solid.sphere(x, y + 0.14, z, 0.13, rng.pick(PROD), 1, true);
        else K.solid.box(x, y + 0.15, z, 0.26, 0.3, 0.22, rng.pick(PROD));
      }
    });
    // giant teddy bear in the window
    const bx = Math.min(1.6, w * 0.25), bz = -1.2, fur = "#b07a3c";
    K.solid.sphere(bx, 0.55, bz, 0.5, fur); K.solid.sphere(bx, 1.25, bz, 0.36, fur);
    K.solid.sphere(bx - 0.26, 1.55, bz, 0.12, fur); K.solid.sphere(bx + 0.26, 1.55, bz, 0.12, fur);
    K.solid.sphere(bx, 1.2, bz + 0.3, 0.13, "#e2c39a"); K.solid.sphere(bx, 1.24, bz + 0.42, 0.04, "#2b2018");
    K.solid.sphere(bx - 0.12, 1.36, bz + 0.3, 0.035, "#2b2018"); K.solid.sphere(bx + 0.12, 1.36, bz + 0.3, 0.035, "#2b2018");
    K.solid.sphere(bx - 0.42, 0.75, bz + 0.1, 0.17, fur); K.solid.sphere(bx + 0.42, 0.75, bz + 0.1, 0.17, fur);
    K.solid.sphere(bx - 0.25, 0.2, bz + 0.35, 0.17, fur); K.solid.sphere(bx + 0.25, 0.2, bz + 0.35, 0.17, fur);
    // toy rocket
    const rx = w - 1.5;
    K.solid.cyl(rx, 0.9, -1.4, 0.28, 1.4, "#f4f1ea"); K.solid.cone(rx, 1.9, -1.4, 0.28, 0.6, "#c85440");
    K.solid.box(rx, 0.35, -1.4, 0.9, 0.5, 0.06, "#c85440"); K.glow.sphere(rx, 1.1, -1.12, 0.1, "#9ad8f0");
    table(K, w / 2, -D * 0.5, 2.2, 1.0, 0.7, b.secondary);
    for (let i = 0; i < 5; i++) K.solid.box(w / 2 - 0.8 + i * 0.4, 0.8, -D * 0.5, 0.24, 0.2, 0.24, rng.pick(PROD));
  },
  cafe(K, w, D, b) {
    const { rng } = K;
    const cz = -D + 1.6;
    K.solid.box(w / 2, 0.52, cz, w - 1.4, 1.04, 0.7, b.primary);               // counter
    K.solid.box(w / 2, 1.07, cz, w - 1.3, 0.06, 0.8, "#2b2822");
    K.solid.box(w / 2 - 1, 1.32, cz, 0.6, 0.45, 0.45, "#bfc3c6");               // espresso machine
    K.glow.box(w / 2 - 1, 1.42, cz + 0.23, 0.3, 0.08, 0.01, "#ff7a3a");
    K.glass.box(w / 2 + 0.7, 1.3, cz, 1.2, 0.42, 0.55, "#cfe6ee");              // pastry case
    for (let i = 0; i < 4; i++) K.solid.sphere(w / 2 + 0.25 + i * 0.3, 1.18, cz, 0.08, rng.pick(["#c9874a", "#e8c48a", "#7a4a2a", "#e39ab4"]), 0.6);
    K.solid.box(w / 2, 2.7, -D + 0.12, Math.min(3.6, w - 1.5), 0.9, 0.06, "#1f1d1c");   // menu board
    K.glow.box(w / 2, 2.7, -D + 0.16, Math.min(3.4, w - 1.7), 0.75, 0.01, "#3a3532");
    for (let t = 0; t < Math.max(1, Math.floor((w - 1) / 2.6)); t++) {
      const x = 1.3 + t * 2.6, z = -2.0 - (t % 2) * 0.6;
      K.solid.cyl(x, 0.37, z, 0.04, 0.74, "#333"); K.solid.cyl(x, 0.75, z, 0.38, 0.04, "#efe6d6");
      for (const dx of [-0.55, 0.55]) { K.solid.box(x + dx, 0.23, z, 0.38, 0.05, 0.38, "#6a4a2e"); K.solid.box(x + dx * 1.35, 0.45, z, 0.05, 0.45, 0.38, "#6a4a2e"); }
      K.solid.cyl(x - 0.1, 0.81, z, 0.05, 0.1, "#ffffff");
    }
    for (let i = 0; i < 3; i++) K.glow.sphere(1.2 + i * (w - 2.4) / 2, 2.85, -2.2, 0.14, "#ffd9a0");
  },
  candy(K, w, D, b) {
    const { rng } = K;
    const bright = ["#e84a6a", "#f0c85a", "#5ad0b0", "#8a7ae0", "#ff9a3a", "#6ad06a", "#ffffff", "#e39ab4"];
    backShelves(K, w, D, 4, "#ffffff", (r, y, x0, x1, z) => {
      K.glass.box((x0 + x1) / 2, y + 0.17, z, x1 - x0, 0.33, 0.3, "#e8f4f8");
      for (let x = x0 + 0.22; x < x1 - 0.2; x += 0.42) K.solid.box(x, y + 0.1, z, 0.36, 0.18, 0.26, rng.pick(bright));
    });
    for (let i = 0; i < 2; i++) {                    // giant lollipops
      const x = i ? w - 1.1 : 1.1;
      K.solid.cyl(x, 0.8, -1.0, 0.04, 1.6, "#ffffff");
      K.solid.cyl(x, 1.85, -1.0, 0.42, 0.08, rng.pick(bright), false, Math.PI / 2);
      K.solid.cyl(x, 1.85, -0.97, 0.26, 0.09, "#ffffff", false, Math.PI / 2);
    }
    const gx = w / 2;                                 // gumball machine
    K.solid.cyl(gx, 0.45, -2.2, 0.2, 0.9, "#c8303a"); K.glass.sphere(gx, 1.2, -2.2, 0.38, "#eef8fb");
    for (let i = 0; i < 14; i++) K.solid.sphere(gx + rng.range(-0.22, 0.22), 1.05 + rng.range(0, 0.3), -2.2 + rng.range(-0.22, 0.22), 0.07, rng.pick(bright), 1, true);
  },
  jewelry(K, w, D, b) {
    const { rng } = K;
    K.solid.box(w / 2, 1.5, -D + 0.1, w - 0.8, 3, 0.05, "#2a2630");
    const cases = Math.max(1, Math.floor((w - 1.4) / 2.2));
    for (let i = 0; i < cases; i++) {
      const x = 0.9 + (i + 0.5) * (w - 1.8) / cases;
      for (const z of [-D * 0.4, -D * 0.75]) {
        K.solid.box(x, 0.45, z, 1.8, 0.9, 0.6, "#26222c");
        K.glass.box(x, 1.12, z, 1.8, 0.44, 0.6, "#dff0f6");
        K.solid.box(x, 0.92, z, 1.7, 0.02, 0.5, "#e9e2d0");
        for (let k = 0; k < 6; k++) K.glow.sphere(x - 0.7 + k * 0.28, 0.98, z + rng.range(-0.15, 0.15), 0.035, rng.pick(["#fff6c8", "#ffffff", "#c8f0ff", "#ffc8e0"]), 1, true);
      }
    }
    for (let i = 0; i < 3; i++) K.glow.cyl(1 + i * (w - 2) / 2, 3.0, -D * 0.55, 0.12, 0.3, "#fff2c8", true);
  },
  records(K, w, D, b) {
    const { rng } = K;
    const bins = Math.max(1, Math.floor((w - 1) / 2.2));
    for (let i = 0; i < bins; i++) {
      const x = 1 + (i + 0.5) * (w - 2) / bins;
      for (const z of [-2.0, -4.2]) {
        K.solid.box(x, 0.4, z, 1.8, 0.8, 0.8, "#5a3a26");
        for (let k = 0; k < 7; k++) K.solid.box(x - 0.75 + k * 0.25, 0.95, z, 0.32, 0.32, 0.02, rng.pick(PROD), 0, -0.5, 0);
      }
    }
    for (let i = 0; i < Math.floor(w / 1.4); i++) K.solid.box(0.9 + i * 1.3, 2.0 + (i % 2) * 0.3, -D + 0.15, 0.9, 0.9, 0.02, rng.pick(PROD));
    for (let i = 0; i < Math.floor(w / 2.5); i++) { K.solid.cyl(1.4 + i * 2.4, 2.75, -D + 0.17, 0.3, 0.02, "#151515", false, Math.PI / 2); K.solid.cyl(1.4 + i * 2.4, 2.75, -D + 0.18, 0.1, 0.02, rng.pick(PROD), false, Math.PI / 2); }
  },
  sports(K, w, D, b) {
    const { rng } = K;
    backShelves(K, w, D, 4, "#d9d9d9", (r, y, x0, x1, z) => {
      for (let x = x0 + 0.2; x < x1 - 0.15; x += 0.34) K.solid.sphere(x, y + 0.14, z, 0.13, rng.pick(["#d8762f", "#ffffff", "#e9d24a", "#3a3a3a", "#c85440"]), 1, true);
    });
    for (let i = 0; i < Math.max(1, Math.floor(w / 4)); i++) {     // bikes
      const x = 1.6 + i * 3.4; if (x > w - 1.2) break;
      K.solid.torus(x - 0.5, 0.36, -1.5, 0.34, "#222"); K.solid.torus(x + 0.5, 0.36, -1.5, 0.34, "#222");
      K.solid.box(x, 0.62, -1.5, 1.0, 0.06, 0.05, b.primary, 0, 0, 0.25); K.solid.box(x - 0.15, 0.55, -1.5, 0.06, 0.45, 0.05, b.primary, 0, 0, 0.3);
      K.solid.box(x - 0.25, 0.84, -1.5, 0.22, 0.05, 0.1, "#222"); K.solid.box(x + 0.42, 0.9, -1.5, 0.05, 0.05, 0.5, "#555");
    }
    for (let i = 0; i < Math.floor((w - 1) / 1.2); i++) K.solid.box(0.9 + i * 1.2, 2.6, -D + 0.2, 0.7, 0.8, 0.04, rng.pick(PROD));   // jerseys
  },
  florist(K, w, D, b) {
    const { rng } = K;
    const petals = ["#e84a6a", "#f0c85a", "#ffffff", "#e39ab4", "#ff8a3a", "#b48ad8"];
    for (let r = 0; r < 2; r++) for (let x = 0.9; x < w - 0.7; x += 0.75) {
      const z = -0.9 - r * 0.8, y0 = r ? 0.35 : 0;
      K.solid.cyl(x, y0 + 0.2, z, 0.2, 0.4, "#8a8f94", true);
      const c = rng.pick(petals);
      for (let k = 0; k < 3; k++) { const ox = rng.range(-0.14, 0.14), oz = rng.range(-0.14, 0.14); K.solid.cyl(x + ox, y0 + 0.6, z + oz, 0.012, 0.5, "#3f6a3f", true); K.solid.sphere(x + ox, y0 + 0.88, z + oz, 0.08, c, 1, true); }
    }
    for (let i = 0; i < 3; i++) { const x = 1 + i * (w - 2) / 2; K.solid.cyl(x, 0.3, -D + 1, 0.3, 0.6, "#c9784f"); K.solid.cone(x, 1.3, -D + 1, 0.55, 1.6, "#3f7a4a"); }
    K.solid.box(w / 2, 0.5, -D * 0.6, Math.min(2.4, w - 2), 1.0, 0.7, "#e9e2d0");
  },
  home(K, w, D, b) {
    const { rng } = K;
    K.solid.box(w / 2, 0.01, -D * 0.5, Math.min(4, w - 1.6), 0.02, 2.6, b.secondary);    // rug
    K.solid.box(w / 2, 0.25, -D * 0.5 - 0.9, 2.4, 0.5, 0.9, b.primary);                // sofa
    K.solid.box(w / 2, 0.6, -D * 0.5 - 1.25, 2.4, 0.6, 0.25, b.primary);
    K.solid.box(w / 2 - 1.15, 0.4, -D * 0.5 - 0.9, 0.2, 0.35, 0.9, shade(b.primary, 0.8)); K.solid.box(w / 2 + 1.15, 0.4, -D * 0.5 - 0.9, 0.2, 0.35, 0.9, shade(b.primary, 0.8));
    table(K, w / 2, -D * 0.5 + 0.4, 1.2, 0.6, 0.42, "#8a6a4a");
    for (let i = 0; i < Math.floor(w / 2.2); i++) {          // lamps
      const x = 0.9 + i * 2.1, z = i % 2 ? -1.2 : -D + 1.0;
      K.solid.cyl(x, 0.02, z, 0.18, 0.04, "#333"); K.solid.cyl(x, 0.75, z, 0.02, 1.5, "#333");
      K.glow.cone(x, 1.62, z, 0.28, 0.32, rng.pick(["#ffe2a8", "#fff2d0", "#ffd0b0"]));
    }
  },
  arcade(K, w, D, b) {
    const { rng } = K;
    const n = Math.max(2, Math.floor((w - 1) / 1.1));
    for (let i = 0; i < n; i++) {
      const x = 0.8 + (i + 0.5) * (w - 1.6) / n;
      for (const z of [-D + 0.6, -D * 0.45]) {
        const back = z < -D * 0.5;
        K.solid.push(x, 0, z, back ? 0 : Math.PI);
        K.solid.box(0, 0.9, 0, 0.8, 1.8, 0.75, rng.pick(["#2a2a40", "#40202a", "#203a3a"]));
        K.solid.pop();
        const sz = back ? z + 0.38 : z - 0.38;
        K.glow.box(x, 1.25, sz, 0.6, 0.45, 0.01, rng.pick(["#3fe0ff", "#ff4ab0", "#f0ff4a", "#7aff6a"]));
        K.glow.box(x, 1.72, sz, 0.7, 0.14, 0.01, rng.pick(["#ff6a3a", "#ffd34d", "#b48ad8"]));
      }
    }
    K.glow.box(w / 2, 3.1, -D + 0.12, w - 1, 0.05, 0.02, "#ff4ab0"); K.glow.box(w / 2, 0.08, -D + 0.12, w - 1, 0.05, 0.02, "#3fe0ff");
  },
  food(K, w, D, b) {
    const { rng } = K;
    const cz = -1.4;
    K.solid.box(w / 2, 0.55, cz, w - 1.0, 1.1, 0.7, b.primary);          // service counter
    K.solid.box(w / 2, 1.12, cz, w - 0.9, 0.05, 0.85, "#d9dcde");
    for (let x = 1.1; x < w - 0.8; x += 1.0) K.solid.box(x, 1.2, cz, 0.5, 0.1, 0.35, rng.pick(["#c85440", "#f0c85a", "#e9e2d0", "#6a8a3a"]));
    K.glass.box(w / 2, 1.45, cz + 0.3, w - 1.2, 0.5, 0.03, "#e8f4f8");    // sneeze guard
    K.solid.box(w / 2, 0.5, -D + 0.9, w - 0.8, 1.0, 0.7, "#c6cacc");     // kitchen line
    K.solid.box(w / 2, 1.9, -D + 0.6, w - 0.8, 0.6, 0.5, "#b8bcbe");     // hood
    for (let x = 1.2; x < w - 1; x += 1.6) K.glow.box(x, 1.58, -D + 0.6, 0.6, 0.04, 0.3, "#ff8a3a");
  },
  concessions(K, w, D, b) {
    I.food(K, w, D, b);
    const x = w - 1.3;
    K.solid.box(x, 1.4, -1.4, 0.8, 0.5, 0.6, "#c8303a"); K.glass.box(x, 1.95, -1.4, 0.75, 0.6, 0.55, "#fff8e0");
    for (let i = 0; i < 18; i++) K.solid.sphere(x + K.rng.range(-0.3, 0.3), 1.75 + K.rng.range(0, 0.25), -1.4 + K.rng.range(-0.22, 0.22), 0.05, "#fff1b8", 1, true);
  },
  theater(K, w, D, b) {
    K.solid.box(w / 2, 0.01, -D / 2, w - 0.6, 0.02, D - 0.2, "#7a1f2a");     // red carpet
    for (let i = 0; i < 2; i++) { const x = i ? w - 1.2 : 1.2; K.solid.box(x, 0.5, -D * 0.6, 0.2, 1.0, 0.2, "#c9a24a"); }
    K.solid.box(w / 2, 1.0, -D + 0.3, 2.4, 2.0, 0.2, "#3a1a20");            // auditorium doors
    K.solid.box(w / 2, 1.0, -D + 0.42, 0.04, 2.0, 0.02, "#c9a24a");
    K.glow.box(w / 2, 2.25, -D + 0.42, 1.2, 0.25, 0.01, "#ff4a4a");
    for (let i = 0; i < 3; i++) K.glow.sphere(1.5 + i * (w - 3) / 2, 3.0, -D * 0.5, 0.18, "#ffd9a0");
  }
};

/* ---------------- catalogue ---------------- */
// facade: which entrance styles fit. sign: panel | letters | neon. palettes: [primary, secondary, signText]
export const STORE_TYPES = {
  apparel: { names: ["Threadline", "Mod Squad", "Velvet & Vine", "Denim Depot", "Hemline", "Gal Pal", "Urban Thread", "Stitch"], facades: ["recessed", "glass", "glass", "open"], sign: ["letters", "panel"], fonts: ["serif", "head", "sans", "condensed"],
    palettes: [["#2f3a4a", "#e9e2d0", "#ffffff"], ["#e39ab4", "#f4f1ea", "#7a2f4a"], ["#3fa89b", "#f4f1ea", "#ffffff"], ["#1d1d1f", "#c9a24a", "#c9a24a"]], floor: "#cbbfa8", walls: "#f1ece2" },
  shoes: { names: ["Sole Mates", "Kick Rack", "Lace Place", "Heel & Toe", "Footloose"], facades: ["glass", "side", "recessed"], sign: ["panel", "letters"], fonts: ["condensed", "round", "head"],
    palettes: [["#c85440", "#f4f1ea", "#ffffff"], ["#2f3a4a", "#f0c85a", "#f0c85a"], ["#222228", "#ffffff", "#ffffff"]], floor: "#a88a6a", walls: "#ece6da" },
  electronics: { names: ["Byte Bazaar", "Circuit Circus", "Pixel Planet", "Gadget Garage", "Static Shack"], facades: ["open", "glass"], sign: ["neon", "panel"], fonts: ["head", "condensed"],
    palettes: [["#1d2a3a", "#3fa6d8", "#3fe0ff"], ["#222228", "#e8c547", "#e8c547"], ["#2a1d3a", "#e86a9a", "#ff6ab0"]], floor: "#cfd3d6", walls: "#e6e9ec" },
  books: { names: ["Paperback Alley", "Dog-Ear Books", "Chapter & Verse", "The Reading Nook", "Inkwell"], facades: ["recessed", "side", "glass"], sign: ["letters", "panel"], fonts: ["serif", "slab"],
    palettes: [["#3a2a1a", "#c9a24a", "#f3e2b8"], ["#2f4a3a", "#e9e2d0", "#f4f1ea"], ["#5a2a2a", "#f0e2c8", "#f0e2c8"]], floor: "#8a6a4a", walls: "#e8dcc4" },
  toys: { names: ["Toy Tornado", "Fun Factory", "Blocks & Bears", "Kid Kingdom", "Wind-Up"], facades: ["glass", "open"], sign: ["panel"], fonts: ["round", "script"],
    palettes: [["#f0c85a", "#c85440", "#c85440"], ["#3fa6d8", "#f0c85a", "#ffffff"], ["#e84a6a", "#5ad0b0", "#ffffff"]], floor: "#e9d9b0", walls: "#fff6e0" },
  cafe: { names: ["Bean There", "Daily Grind", "Mocha Joe's", "Steam Room", "Cup & Saucer"], facades: ["awning", "glass", "open"], sign: ["letters", "panel"], fonts: ["script", "serif", "slab"],
    palettes: [["#3a2418", "#e9d7b8", "#f3e2b8"], ["#2f5a4a", "#f4f1ea", "#ffffff"], ["#c85440", "#f4f1ea", "#ffffff"]], floor: "#7a5a3a", walls: "#efe2cc" },
  candy: { names: ["Sweet Tooth", "Sugar Rush", "Gumdrop Shop", "Taffy Town"], facades: ["open", "glass"], sign: ["panel", "neon"], fonts: ["round", "script"],
    palettes: [["#e39ab4", "#ffffff", "#ffffff"], ["#5ad0b0", "#ffffff", "#ffffff"], ["#e84a6a", "#fff1b8", "#fff1b8"]], floor: "#f6e8f0", walls: "#fff3f8" },
  jewelry: { names: ["Glitter & Gold", "Facet", "Carat Cove", "Lustre"], facades: ["recessed", "glass"], sign: ["letters"], fonts: ["serif"],
    palettes: [["#1d1d22", "#c9a24a", "#e6c76a"], ["#2a2440", "#e9e2d0", "#f4f1ea"]], floor: "#3a3540", walls: "#3a3644" },
  records: { names: ["Spin City Records", "Groove Hut", "B-Side", "Needle Drop", "Wax Works"], facades: ["side", "glass", "open"], sign: ["neon", "panel"], fonts: ["condensed", "slab", "script"],
    palettes: [["#1d1d22", "#e86a9a", "#ff6ab0"], ["#2a2a2a", "#f0c85a", "#f0c85a"], ["#3a1d3a", "#5ad0b0", "#7affe0"]], floor: "#4a4040", walls: "#d8d0c4" },
  sports: { names: ["Fit Kit", "Full Court", "Varsity Sports", "Trailhead"], facades: ["open", "glass"], sign: ["panel"], fonts: ["condensed", "head"],
    palettes: [["#2a5a3a", "#ffffff", "#ffffff"], ["#1d3a6a", "#e8c547", "#ffffff"], ["#c85440", "#ffffff", "#ffffff"]], floor: "#b8a07a", walls: "#ececec" },
  florist: { names: ["Petal Pushers", "Bloom Room", "Stems", "Fern Gully"], facades: ["side", "awning", "open"], sign: ["letters", "panel"], fonts: ["script", "serif"],
    palettes: [["#3f6a3f", "#f4f1ea", "#ffffff"], ["#e39ab4", "#3f6a3f", "#ffffff"]], floor: "#c9c0a8", walls: "#e8efe0" },
  home: { names: ["Cozy Corner", "Lumen Lamps", "Nest", "Hearth & Home"], facades: ["glass", "recessed"], sign: ["letters", "panel"], fonts: ["serif", "sans"],
    palettes: [["#c9784f", "#e9e2d0", "#ffffff"], ["#5a6b7a", "#f0d8a8", "#ffffff"]], floor: "#a88a6a", walls: "#efe8dc" },
  arcade: { names: ["Pixel Palace", "Game Over", "Token Town", "High Score"], facades: ["open"], sign: ["neon"], fonts: ["head", "condensed"],
    palettes: [["#120f1c", "#ff4ab0", "#ff4ab0"], ["#0f1820", "#3fe0ff", "#3fe0ff"], ["#140f10", "#f0ff4a", "#f0ff4a"]], floor: "#221d2e", walls: "#1d1828", dark: true },
  food: { names: ["Pretzel Twist", "Wok This Way", "Taco Loco", "Slice of Heaven", "Burger Barn", "Corn Dog Co.", "Yum Bowl", "Smoothie Shack"], facades: ["counter"], sign: ["panel", "neon"], fonts: ["round", "condensed", "script", "slab"],
    palettes: [["#c85440", "#f0c85a", "#ffffff"], ["#e8a23a", "#5a2a1a", "#ffffff"], ["#3f9d5a", "#f4f1ea", "#ffffff"], ["#e84a6a", "#fff1b8", "#ffffff"], ["#3fa6d8", "#ffffff", "#ffffff"]], floor: "#d8d8d0", walls: "#e8e2d4" },
  concessions: { names: ["Popcorn Palace", "Snack Attack"], facades: ["counter"], sign: ["neon"], fonts: ["round"],
    palettes: [["#c8303a", "#f0c85a", "#fff1b8"]], floor: "#7a1f2a", walls: "#3a2a30", dark: true },
  theater: { names: ["Cinema 6", "Starlight Cinemas", "The Bijou", "Galaxy Screens"], facades: ["theater"], sign: ["neon"], fonts: ["head", "condensed"],
    palettes: [["#1a1020", "#f0c85a", "#ffd34d"], ["#1a1020", "#ff4a6a", "#ff6a8a"]], floor: "#7a1f2a", walls: "#2a1a24", dark: true, minW: 12 }
};

export function furnish(K, type, w, D, brand) {
  const f = I[type];
  if (f) f(K, w, D, brand);
}

export const MENU_ITEMS = {
  "Pretzel Twist": ["Classic", "Cinnamon", "Bites", "Lemonade", "Cheese Dip", "Jalapeno", "Sugar", "Combo"],
  "Wok This Way": ["Orange Chkn", "Lo Mein", "Fried Rice", "Egg Roll", "Teriyaki", "Broccoli", "Bowl", "Plate"],
  "Taco Loco": ["Tacos", "Burrito", "Nachos", "Quesadilla", "Churros", "Salsa", "Bowl", "Horchata"],
  "Slice of Heaven": ["Cheese", "Pepperoni", "Veggie", "Garlic Knots", "Calzone", "Salad", "Soda", "2 Slices"],
  "Burger Barn": ["Burger", "Cheeseburger", "Fries", "Onion Rings", "Shake", "Nuggets", "Hot Dog", "Combo"],
  "Corn Dog Co.": ["Corn Dog", "Cheese Dog", "Fries", "Lemonade", "Mini Dogs", "Funnel", "Combo", "Soda"],
  "Yum Bowl": ["Poke", "Ramen", "Bibimbap", "Gyoza", "Tea", "Edamame", "Udon", "Mochi"],
  "Smoothie Shack": ["Berry", "Mango", "Green", "PB Banana", "Acai", "Tropical", "Protein", "Juice"],
  "Popcorn Palace": ["Popcorn", "Large", "Nachos", "Candy", "Soda", "Hot Dog", "ICEE", "Combo"],
  "Snack Attack": ["Popcorn", "Pretzel", "Nachos", "Candy", "Soda", "Hot Dog", "ICEE", "Combo"]
};
