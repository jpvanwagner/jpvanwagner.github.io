/* 2D overlay drawn on top of the 3D view: popups, obstacle action labels, and the level-up flourish. */
import { F_HEAD } from "../config.js";

const cv = document.getElementById("fx"), ctx = cv.getContext("2d");
const flashEl = document.getElementById("flash");
let W = 1, H = 1;
const popups = [];
let levelFlash = 0, levelNum = 0, flashA = 0;

export function resizeFx(w, h, dpr) {
  W = w; H = h;
  cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function addPopup(text, color) { popups.push({ text, color, life: 1, y: H * 0.5 }); }
export function doFlash(col, a) { flashEl.style.background = col; flashA = a || 0.55; flashEl.style.opacity = flashA; }
export function startLevelFlash(level) { levelFlash = 1.6; levelNum = level; }
export function clearFx() { popups.length = 0; levelFlash = 0; flashA = 0; flashEl.style.opacity = 0; }

/** labels: [{x, y, size, alpha, text, how, color}] in CSS pixels */
export function drawFx(dt, labels) {
  ctx.clearRect(0, 0, W, H);
  if (flashA > 0) { flashA = Math.max(0, flashA - 2.4 * dt); flashEl.style.opacity = flashA; }

  for (const L of labels) {
    ctx.save(); ctx.globalAlpha = L.alpha;
    ctx.fillStyle = L.color; ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(1, L.size * 0.14); ctx.lineJoin = "round";
    ctx.font = "700 " + L.size + "px " + F_HEAD; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.strokeText(L.text, L.x, L.y); ctx.fillText(L.text, L.x, L.y);
    ctx.font = "700 " + Math.max(8, L.size * 0.55) + "px " + F_HEAD;
    ctx.strokeStyle = "#2b2822"; ctx.lineWidth = Math.max(1, L.size * 0.12);
    ctx.strokeText(L.how, L.x, L.y + L.size * 0.9); ctx.fillStyle = "#fff"; ctx.fillText(L.how, L.x, L.y + L.size * 0.9);
    ctx.restore();
  }

  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.y -= 60 * dt; p.life -= 1.2 * dt;
    if (p.life <= 0) { popups.splice(i, 1); continue; }
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));
    ctx.font = "700 " + Math.round(Math.min(H * 0.032, W * 0.06)) + "px " + F_HEAD; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = 4; ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineJoin = "round";
    ctx.strokeText(p.text, W / 2, p.y); ctx.fillStyle = p.color; ctx.fillText(p.text, W / 2, p.y);
    ctx.restore();
  }

  if (levelFlash > 0) { drawLevelFlash(); levelFlash -= dt; }
}

function drawLevelFlash() {
  const t = 1 - levelFlash / 1.6, a = Math.sin(Math.min(1, t * 1.3) * Math.PI);
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#e39ab4"); g.addColorStop(0.5, "#7a5aa0"); g.addColorStop(1, "#3fa89b");
  ctx.globalAlpha = 0.35 * a; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.5 * a; ctx.fillStyle = "#ffd34d";
  ctx.beginPath(); ctx.arc(W / 2, H * 0.42, Math.min(W, H) * 0.18, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.4 * a; ctx.strokeStyle = "#f4f1ea"; ctx.lineWidth = 1.5;
  const hy = H * 0.55;
  for (let i = 0; i < 10; i++) { const yy = hy + (H - hy) * Math.pow((i + (t * 3 % 1)) / 10, 1.8); ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); }
  for (let x = -8; x <= 8; x++) { ctx.beginPath(); ctx.moveTo(W / 2, hy); ctx.lineTo(W / 2 + x * W * 0.16, H); ctx.stroke(); }
  ctx.globalAlpha = a; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "700 " + Math.round(Math.min(H * 0.075, W * 0.12)) + "px " + F_HEAD;
  ctx.strokeStyle = "#7a5aa0"; ctx.lineWidth = Math.round(H * 0.01);
  ctx.strokeText("LEVEL " + (levelNum + 1), W / 2, H * 0.42); ctx.fillStyle = "#e39ab4"; ctx.fillText("LEVEL " + (levelNum + 1), W / 2, H * 0.42);
  ctx.font = "700 " + Math.round(Math.min(H * 0.03, W * 0.05)) + "px " + F_HEAD; ctx.fillStyle = "#f4f1ea";
  ctx.fillText("SPEEDING UP", W / 2, H * 0.49);
  ctx.restore();
}
