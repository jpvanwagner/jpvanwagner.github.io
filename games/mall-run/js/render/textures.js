/* Procedural canvas textures: floor tiles, store signs, movie posters, menu boards, blob shadow. */
import * as THREE from "three";

let maxAniso = 4;
export function setAnisotropy(n) { maxAniso = n; }

function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function tex(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}

const cache = new Map();
function cached(key, make) { let t = cache.get(key); if (!t) { t = make(); cache.set(key, t); } return t; }

/* ---------- floors: 1 texture repeat = 4 m ---------- */
export function floorTexture(theme) {
  return cached("floor:" + theme.name, () => {
    const c = canvas(256, 256), g = c.getContext("2d");
    if (theme.name === "garage") {
      g.fillStyle = theme.floorA; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 2200; i++) { g.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)"; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
      g.strokeStyle = "rgba(0,0,0,0.12)"; g.lineWidth = 2; g.strokeRect(0, 0, 256, 256);
    } else {
      // 2x2 big tiles, alternating, with a thin inlay border and grout
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
        g.fillStyle = (x + y) % 2 ? theme.floorB : theme.floorA; g.fillRect(x * 128, y * 128, 128, 128);
      }
      for (let i = 0; i < 1400; i++) { g.fillStyle = "rgba(255,255,255," + (Math.random() * 0.08) + ")"; g.fillRect(Math.random() * 256, Math.random() * 256, 3, 1); }
      g.strokeStyle = theme.floorLines || "rgba(0,0,0,0.13)"; g.lineWidth = theme.floorLines ? 3 : 2;
      for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, 256); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(256, i * 128); g.stroke(); }
    }
    return tex(c, true);
  });
}

/* ---------- signs ---------- */
const FONTS = {
  sans: '700 {s}px "General Sans","Trebuchet MS",sans-serif',
  head: '700 {s}px "Termina Test","General Sans","Trebuchet MS",sans-serif',
  serif: 'italic 700 {s}px Georgia,"Times New Roman",serif',
  slab: '700 {s}px "Rockwell","Courier New",monospace',
  script: 'italic 700 {s}px "Brush Script MT","Segoe Script","Comic Sans MS",cursive',
  round: '800 {s}px "Arial Rounded MT Bold","Trebuchet MS",sans-serif',
  condensed: '700 {s}px "Impact","Arial Narrow",sans-serif'
};

/** style: { bg, fg, font, neon, border, upper, transparent } */
export function signTexture(text, style) {
  const key = "sign:" + text + JSON.stringify(style);
  return cached(key, () => {
    const W = 512, H = 128, c = canvas(W, H), g = c.getContext("2d");
    if (!style.transparent) {
      g.fillStyle = style.bg; g.fillRect(0, 0, W, H);
      if (style.border) { g.strokeStyle = style.border; g.lineWidth = 8; g.strokeRect(6, 6, W - 12, H - 12); }
    }
    const t = style.upper ? text.toUpperCase() : text;
    let size = 78;
    const f = FONTS[style.font] || FONTS.sans;
    g.font = f.replace("{s}", size);
    while (g.measureText(t).width > W * 0.86 && size > 20) { size -= 3; g.font = f.replace("{s}", size); }
    g.textAlign = "center"; g.textBaseline = "middle";
    if (style.neon) { g.shadowColor = style.fg; g.shadowBlur = 18; g.fillStyle = "#ffffff"; g.fillText(t, W / 2, H / 2 + 3); g.shadowBlur = 8; }
    else if (style.transparent) { g.shadowColor = "rgba(0,0,0,0.35)"; g.shadowBlur = 6; g.shadowOffsetY = 3; }
    g.fillStyle = style.neon ? style.fg : style.fg;
    g.fillText(t, W / 2, H / 2 + 3);
    if (style.neon) { g.globalAlpha = 0.6; g.fillStyle = "#fff"; g.fillText(t, W / 2, H / 2 + 3); }
    const tx = tex(c);
    tx.userData = { transparent: !!style.transparent };
    return tx;
  });
}

/** Square-ish two-line sign for signs that stick out from the wall. */
export function bladeTexture(text, style) {
  const key = "blade:" + text + JSON.stringify(style);
  return cached(key, () => {
    const W = 256, H = 128, c = canvas(W, H), g = c.getContext("2d");
    g.fillStyle = style.bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(255,255,255,0.5)"; g.lineWidth = 4; g.strokeRect(6, 6, W - 12, H - 12);
    const words = text.split(" ");
    let lines = [text];
    if (words.length > 1) { const mid = Math.ceil(words.length / 2); lines = [words.slice(0, mid).join(" "), words.slice(mid).join(" ")]; }
    const f = FONTS[style.font] || FONTS.sans;
    let size = lines.length > 1 ? 44 : 54;
    g.font = f.replace("{s}", size);
    while (Math.max(...lines.map(l => g.measureText(l).width)) > W * 0.86 && size > 14) { size -= 2; g.font = f.replace("{s}", size); }
    g.textAlign = "center"; g.textBaseline = "middle";
    if (style.neon) { g.shadowColor = style.fg; g.shadowBlur = 12; }
    g.fillStyle = style.fg;
    lines.forEach((l, i) => g.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * size * 1.05 + 2));
    return tex(c);
  });
}

/* ---------- arrow for junction direction signs ---------- */
export function arrowTexture(dir) {
  return cached("arrow:" + dir, () => {
    const c = canvas(256, 128), g = c.getContext("2d");
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, 256, 128);
    g.save(); g.translate(128, 64); g.scale(dir, 1);
    g.fillStyle = "#222";
    g.beginPath(); g.moveTo(70, 0); g.lineTo(10, -46); g.lineTo(10, -20); g.lineTo(-80, -20); g.lineTo(-80, 20); g.lineTo(10, 20); g.lineTo(10, 46); g.closePath(); g.fill();
    g.restore();
    return tex(c);
  });
}

/* ---------- movie posters ---------- */
const MOVIE_TITLES = ["STAR DRIFT", "MALL COP 3", "THE LAST ARCADE", "NEON NIGHTS", "ROBO PUP", "DEEP FREEZE", "SPACE MALL", "THE PRETZEL", "LASER TAG", "SUMMER CAMP", "GHOST ESCALATOR", "TURBO KID"];
export function posterTexture(i) {
  return cached("poster:" + (i % 24), () => {
    const c = canvas(128, 192), g = c.getContext("2d");
    const hues = [[250, 330], [190, 280], [20, 50], [120, 180], [300, 20], [200, 230]];
    const [h1, h2] = hues[i % hues.length];
    const gr = g.createLinearGradient(0, 0, 0, 192);
    gr.addColorStop(0, "hsl(" + h1 + ",70%,30%)"); gr.addColorStop(1, "hsl(" + h2 + ",80%,55%)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 192);
    g.fillStyle = "hsla(" + (h2 + 40) + ",90%,70%,0.9)";
    g.beginPath(); g.arc(64, 80 + (i % 3) * 8, 26 + (i % 4) * 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(0,0,0,0.55)"; g.beginPath(); g.moveTo(30, 150); g.lineTo(64, 70 + (i % 5) * 6); g.lineTo(98, 150); g.fill();
    g.fillStyle = "#fff"; g.textAlign = "center"; g.font = '700 15px "Impact","Arial Narrow",sans-serif';
    g.fillText(MOVIE_TITLES[i % MOVIE_TITLES.length], 64, 172);
    g.font = "8px sans-serif"; g.fillText("NOW SHOWING", 64, 186);
    g.strokeStyle = "#f4f1ea"; g.lineWidth = 4; g.strokeRect(2, 2, 124, 188);
    return tex(c);
  });
}

/* ---------- menu boards ---------- */
export function menuTexture(title, items, color) {
  return cached("menu:" + title, () => {
    const c = canvas(256, 128), g = c.getContext("2d");
    g.fillStyle = "#1f1d1c"; g.fillRect(0, 0, 256, 128);
    g.fillStyle = color; g.fillRect(0, 0, 256, 26);
    g.fillStyle = "#fff"; g.font = '700 18px "General Sans","Trebuchet MS",sans-serif'; g.textAlign = "center"; g.fillText(title.toUpperCase(), 128, 19);
    g.textAlign = "left"; g.font = '600 13px "General Sans","Trebuchet MS",sans-serif';
    items.forEach((it, k) => {
      const x = k < 4 ? 12 : 134, y = 46 + (k % 4) * 21;
      g.fillStyle = "#f3ead8"; g.fillText(it, x, y);
      g.fillStyle = "#f0c85a"; g.fillText((2 + ((k * 7) % 6)) + ".99", x + 82, y);
    });
    return tex(c);
  });
}

/* ---------- soft blob shadow ---------- */
export function shadowTexture() {
  return cached("shadow", () => {
    const c = canvas(64, 64), g = c.getContext("2d");
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, "rgba(0,0,0,0.55)"); gr.addColorStop(0.6, "rgba(0,0,0,0.22)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = tex(c); t.colorSpace = THREE.NoColorSpace; return t;
  });
}

/* ---------- power-up glyph ---------- */
export function glyphTexture(glyph, color) {
  return cached("glyph:" + glyph + color, () => {
    const c = canvas(128, 128), g = c.getContext("2d");
    const gr = g.createRadialGradient(64, 64, 8, 64, 64, 62);
    gr.addColorStop(0, "rgba(255,255,255,0.95)"); gr.addColorStop(0.45, color); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.fillStyle = "#fff"; g.strokeStyle = "rgba(0,0,0,0.45)"; g.lineWidth = 6;
    g.font = '700 64px "Termina Test","General Sans","Trebuchet MS",sans-serif'; g.textAlign = "center"; g.textBaseline = "middle";
    g.strokeText(glyph, 64, 68); g.fillText(glyph, 64, 68);
    return tex(c);
  });
}
