/* Procedural canvas textures (no image assets needed). */
import * as THREE from 'three';

function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export const checkerTexture = ([a, b]) =>
  canvasTexture(128, (ctx, s) => {
    ctx.fillStyle = b;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, s / 2, s / 2);
    ctx.fillRect(s / 2, s / 2, s / 2, s / 2);
  });

export const carpetTexture = (color) =>
  canvasTexture(64, (ctx, s) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.045})`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
  });

export const tileTexture = (color, line = 'rgba(0,0,0,0.07)') =>
  canvasTexture(64, (ctx, s) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, s, s);
  });

/** Plank floor (wood) with subtle grain. */
export const woodTexture = (color) =>
  canvasTexture(128, (ctx, s) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 16) {
      ctx.fillStyle = `rgba(60,35,15,${0.05 + Math.random() * 0.08})`;
      ctx.fillRect(0, y, s, 16);
      ctx.fillStyle = 'rgba(40,25,10,0.18)';
      ctx.fillRect(0, y, s, 1);
      const seam = Math.random() * s;
      ctx.fillRect(seam, y, 1, 16);
    }
  });

export const plainTexture = (color) => tileTexture(color, 'rgba(0,0,0,0.025)');

/** Floor label ("SERVER ROOM") as a transparent texture; text shrinks to fit. */
export function labelTexture(text, color, { width = 512, height = 96, font = 700 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const label = text.toUpperCase();
  let size = Math.round(height * 0.5);
  const setFont = () => (ctx.font = `${font} ${size}px Inter, system-ui, sans-serif`);
  setFont();
  while (size > 10 && ctx.measureText(label).width > width * 0.94) {
    size -= 2;
    setFont();
  }
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, width / 2, height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * A hover label for a room or area: one or more centred lines with a soft
 * outline (readable over busy floors). The canvas is as wide as the longest
 * line, so callers size the plane from its aspect ratio.
 */
export function areaLabelTexture(lines, color, { line = 64, font = 800, halo = 'rgba(255, 252, 240, 0.92)' } = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const setFont = () => (ctx.font = `${font} ${line * 0.72}px Inter, system-ui, sans-serif`);
  const upper = lines.map((l) => l.toUpperCase());
  setFont();
  canvas.width = Math.ceil(Math.max(...upper.map((l) => ctx.measureText(l).width)) + line * 0.5);
  canvas.height = Math.ceil(line * upper.length + line * 0.2);
  setFont();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = line * 0.16;
  ctx.strokeStyle = halo;
  ctx.fillStyle = color;
  upper.forEach((l, i) => {
    const y = line * 0.1 + line * (i + 0.5);
    ctx.strokeText(l, canvas.width / 2, y);
    ctx.fillText(l, canvas.width / 2, y);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
