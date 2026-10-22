// Procedural canvas textures, so the build stays a single self-contained file.
import * as THREE from 'three';

function canvasTex(size, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const jitter = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const f = 1 + (Math.random() - 0.5) * amt;
  const r = Math.min(255, ((n >> 16) & 255) * f), g = Math.min(255, ((n >> 8) & 255) * f), b = Math.min(255, (n & 255) * f);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
};

export function woodPlanks(base = '#6b4430', repeat = [6, 6]) {
  return canvasTex(256, (g, s) => {
    const rows = 8, h = s / rows;
    for (let r = 0; r < rows; r++) {
      let x = -Math.random() * s;
      while (x < s) {
        const w = s * (0.45 + Math.random() * 0.5);
        g.fillStyle = jitter(base, 0.22);
        g.fillRect(x, r * h, w, h);
        g.strokeStyle = 'rgba(0,0,0,0.06)';
        for (let i = 0; i < 4; i++) {
          g.beginPath();
          const y = r * h + Math.random() * h;
          g.moveTo(x, y); g.bezierCurveTo(x + w * 0.3, y + 2, x + w * 0.6, y - 2, x + w, y);
          g.stroke();
        }
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(x, r * h, 1.5, h);
        x += w;
      }
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(0, r * h, s, 1.5);
    }
  }, repeat);
}

export function checker(a = '#f4f1ea', b = '#1a1718', n = 8, repeat = [4, 2]) {
  return canvasTex(256, (g, s) => {
    const q = s / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      g.fillStyle = (x + y) % 2 ? b : a;
      g.fillRect(x * q, y * q, q, q);
    }
    g.strokeStyle = 'rgba(120,120,120,0.35)';
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * q, 0); g.lineTo(i * q, s); g.moveTo(0, i * q); g.lineTo(s, i * q); g.stroke(); }
  }, repeat);
}

export function gingham(repeat = [2, 2]) {
  return canvasTex(128, (g, s) => {
    g.fillStyle = '#fbf8f2';
    g.fillRect(0, 0, s, s);
    const n = 8, q = s / n;
    g.fillStyle = 'rgba(143,29,33,0.55)';
    for (let i = 0; i < n; i += 2) { g.fillRect(i * q, 0, q, s); g.fillRect(0, i * q, s, q); }
    g.fillStyle = 'rgba(110,16,22,0.5)';
    for (let y = 0; y < n; y += 2) for (let x = 0; x < n; x += 2) g.fillRect(x * q, y * q, q, q);
  }, repeat);
}

export function brick(repeat = [8, 1]) {
  return canvasTex(256, (g, s) => {
    g.fillStyle = '#d8cfc2';
    g.fillRect(0, 0, s, s);
    const rows = 8, h = s / rows, w = s / 4;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? w / 2 : 0;
      for (let x = -w; x < s + w; x += w) {
        g.fillStyle = jitter('#8e3b2a', 0.25);
        g.fillRect(x + off + 2, r * h + 2, w - 4, h - 4);
      }
    }
  }, repeat);
}

export function carpet(repeat = [3, 3]) {
  return canvasTex(128, (g, s) => {
    g.fillStyle = '#5e1418';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(214,170,90,0.35)';
    g.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const c = (i + 0.5) * (s / 4);
      for (let j = 0; j < 4; j++) {
        const d = (j + 0.5) * (s / 4);
        g.beginPath(); g.moveTo(c, d - 8); g.lineTo(c + 8, d); g.lineTo(c, d + 8); g.lineTo(c - 8, d); g.closePath(); g.stroke();
      }
    }
  }, repeat);
}

/** A flat label texture (signage). */
export function textTex(text, { w = 512, h = 128, bg = '#141012', fg = '#faf7f2', font = 'italic 700 64px Georgia, serif' } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Glass-tile mosaic for the pizza oven dome: mostly deep red, with black, white and a little gold.
 *  `bands` adds horizontal stripes of white/gold tiles at those fractions of the height. */
export function mosaic(repeat = [8, 3], bands = [0.18, 0.24]) {
  return canvasTex(256, (g, s) => {
    const n = 32, t = s / n;
    g.fillStyle = '#2a1e1c';                     // grout
    g.fillRect(0, 0, s, s);
    const pal = ['#8f1d21', '#8f1d21', '#a1262a', '#7a1619', '#8f1d21', '#161214', '#faf7f2', '#8f1d21'];
    for (let r = 0; r < n; r++) {
      const band = bands.some((b) => Math.abs(r / n - b) < 0.5 / n);
      for (let c = 0; c < n; c++) {
        let col = pal[Math.floor(Math.random() * pal.length)];
        if (band) col = c % 2 ? '#faf7f2' : '#c9a24a';
        else if (Math.random() < 0.03) col = '#c9a24a';
        g.fillStyle = jitter(col, 0.18);
        g.fillRect(c * t + 0.8, r * t + 0.8, t - 1.6, t - 1.6);
      }
    }
  }, repeat);
}

/** Glowing neon lettering on a transparent background (use with additive blending). */
export function neonTex(text, { w = 1024, h = 256, color = '#ff3a3a', font = 'italic 700 150px Georgia, serif' } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round';
  for (const [blur, lw, col] of [[40, 10, color], [18, 7, color], [4, 4, '#ffd6d0']]) {
    g.shadowColor = color; g.shadowBlur = blur;
    g.strokeStyle = col; g.lineWidth = lw;
    g.strokeText(text, w / 2, h / 2 + 6);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A soft warm glow (backlight behind the bottle shelves). */
export function glowTex(inner = '#ffcf8a', outer = '#3a1a10') {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, outer); grad.addColorStop(0.5, inner); grad.addColorStop(1, outer);
  g.fillStyle = grad; g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
