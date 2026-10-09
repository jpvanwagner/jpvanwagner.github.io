'use strict';
/* ============================== RENDER ============================== */
/* Round shapes. On the pixel layer they're filled row by row, so circles come out as stepped pixel circles. */
function pixEll(x, y, rx, ry, c) {
  ctx.fillStyle = c; const cy = Math.round(y);
  for (let dy = -Math.ceil(ry); dy < Math.ceil(ry); dy++) {
    const v = (dy + 0.5) / ry; if (Math.abs(v) >= 1) continue;
    const hw = rx * Math.sqrt(1 - v * v), x0 = Math.round(x - hw), x1 = Math.round(x + hw);
    if (x1 > x0) ctx.fillRect(x0, cy + dy, x1 - x0, 1);
  }
}
function circ(x, y, r, c) { if (PIXMODE) return pixEll(x, y, r, r, c); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); ctx.fill(); }
function ell(x, y, rx, ry, c) { if (PIXMODE) return pixEll(x, y, rx, ry, c); ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2); ctx.fill(); }
/* The pixel layer: the whole world (backdrop, teeth, gums, characters, pickups, effects) is drawn here at one
   canvas pixel per game pixel, then scaled up with hard edges for a late-Genesis look. Only text (tips, score
   popups, prompts, banners) is drawn straight to the screen, so it stays sharp. */
const pixCvs = document.createElement('canvas'), pixCtx = pixCvs.getContext('2d', { willReadFrequently: true });
/* Genesis colour: each channel is cut down to 8 levels (the Mega Drive's 9-bit palette), so edges come out
   as hard pixels and gradients as flat bands of colour, with only a light ordered dither where two bands meet;
   see-through effects become a checkerboard. The pattern is pinned to the world, so it doesn't crawl as the camera scrolls. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const DITHER = 0.18;   // 0 = flat colour bands, 1 = full dithering; just a thin seam where two bands meet
const QLUT = BAYER.map(b => { const a = new Uint8Array(256); for (let v = 0; v < 256; v++) a[v] = Math.round(Math.min(7, Math.floor(v * 7 / 255 + 0.5 - DITHER / 2 + b * DITHER)) * 255 / 7); return a; });
function genesisColors(ox, oy) {
  const w = pixCvs.width, h = pixCvs.height, img = pixCtx.getImageData(0, 0, w, h), d = img.data;
  for (let y = 0; y < h; y++) {
    const row = ((y + oy) & 3) * 4;
    for (let x = 0, i = y * w * 4; x < w; x++, i += 4) {
      const a = d[i + 3]; if (!a) continue;
      const k = row + ((x + ox) & 3), lut = QLUT[k];
      d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]];
      d[i + 3] = a / 255 > BAYER[k] ? 255 : 0;
    }
  }
  pixCtx.putImageData(img, 0, 0);
}
function beginPixels(camX, camY, screenSpace) {
  const w = Math.ceil(VW) + 3, h = VH + 3;
  if (pixCvs.width !== w || pixCvs.height !== h) { pixCvs.width = w; pixCvs.height = h; }
  pixCtx.setTransform(1, 0, 0, 1, 0, 0); pixCtx.clearRect(0, 0, w, h); pixCtx.imageSmoothingEnabled = false;
  if (!screenSpace) pixCtx.translate(-Math.floor(camX), -Math.floor(camY));
  ctx = pixCtx; PIXMODE = true;
}
function endPixels(camX, camY) {
  genesisColors(Math.floor(camX) & 3, Math.floor(camY) & 3);
  ctx = screenCtx; PIXMODE = false;
  ctx.imageSmoothingEnabled = false; ctx.drawImage(pixCvs, Math.floor(camX), Math.floor(camY));
}
function eyes(cx, cy, d, angry) {
  ctx.fillStyle = '#fff'; ctx.fillRect(cx - 4, cy - 1, 3, 3); ctx.fillRect(cx + 1, cy - 1, 3, 3);
  ctx.fillStyle = '#1b0f2e'; ctx.fillRect(cx - 3 + (d > 0 ? 1 : 0), cy, 1, 2); ctx.fillRect(cx + 2 + (d > 0 ? 1 : 0), cy, 1, 2);
  if (angry) { ctx.fillRect(cx - 5, cy - 2, 3, 1); ctx.fillRect(cx + 2, cy - 2, 3, 1); }
}
function ptext(str, x, y, color, size, align, shadow) {
  ctx.font = (size || 8) + 'px "Press Start 2P"'; ctx.textAlign = align || 'left'; ctx.textBaseline = 'top';
  if (shadow !== false) { ctx.fillStyle = shadow || '#1b0f2e'; ctx.fillText(str, Math.round(x) + 1, Math.round(y) + 1); }
  ctx.fillStyle = color; ctx.fillText(str, Math.round(x), Math.round(y));
}
function roundTop(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h); ctx.closePath();
}

const THEMES = {
  front: { sky: ['#ff7ab6', '#d6337f', '#7a1450'], upper: '#ff9ac4', upperTooth: 'rgba(255,255,255,.75)', far: '#4a0a33', pool: ['rgba(150,240,255,.82)', 'rgba(40,170,220,.9)'], poolTop: '#e8fdff' },
  back: { sky: ['#9b4dff', '#d61f8a', '#4f0d48'], upper: '#ff8fbe', upperTooth: 'rgba(235,230,255,.55)', far: '#2e0838', pool: ['rgba(150,240,255,.78)', 'rgba(40,150,210,.9)'], poolTop: '#e8fdff' },
  root: { sky: ['#2a0c3d', '#1d0828', '#0d0414'], far: '#000', pool: ['rgba(255,80,90,.85)', 'rgba(140,10,40,.95)'], poolTop: '#ffb0b0' },
  tongue: { sky: ['#ff5c86', '#c2185b', '#4a0626'], upper: '#ff8fab', upperTooth: 'rgba(255,255,255,.6)', far: '#2a0216', pool: ['rgba(170,240,255,.8)', 'rgba(60,170,220,.9)'], poolTop: '#f0feff' }
};
const SKINS = {
  gum: { top: '#ff9cc6', body: '#f0558f', dark: '#a8285e', line: '#7a1a48', hi: '#ffd6e8', dot: '#d8417a' },
  tongue: { top: '#ff8aa6', body: '#e8406a', dark: '#9a1a40', line: '#6a0a2a', hi: '#ffc6d4', dot: '#ffb3c6' }
};

function render() {
  ctx.setTransform(RS, 0, 0, RS, 0, 0);
  ctx.imageSmoothingEnabled = false;
  if (!G.L) { ctx.fillStyle = '#12061f'; ctx.fillRect(0, 0, VW, VH); return; }
  const th = THEMES[G.L.theme];
  let sx = 0, sy = 0;
  if (G.shake > 0.2) { sx = rand(-G.shake, G.shake); sy = rand(-G.shake, G.shake); G.shake *= 0.85; } else G.shake = 0;
  const pcx = G.cam.x + sx, pcy = G.cam.y + sy;
  ctx.save();
  ctx.translate(-snap(pcx), -snap(pcy));
  // pass 1, on the pixel layer: backdrop and scenery
  beginPixels(pcx, pcy, true);
  drawBackground(th);
  ctx.translate(-Math.floor(pcx), -Math.floor(pcy));
  const T = G.L.terrain;
  if (G.L.theme === 'root') drawChasm();
  if (G.L.exit.kind === 'hole') drawCrevice(G.L.exit);
  if (G.L.tongue) drawTongue(G.L.tongue);
  for (const u of G.ulcers) drawUlcer(u);
  for (const t of T) if (t.kind === 'backface' && t.x < G.cam.x + VW + 10 && t.x + t.w > G.cam.x - 10) drawBackface(t);
  for (const t of T) {
    if (t.x > G.cam.x + VW + 10 || t.x + t.w < G.cam.x - 10) continue;
    if (t.kind === 'gum') { if (!t.hidden) drawGum(t); }
    else if (t.kind === 'mound') drawGumBody(t);
    else if (t.kind === 'rock') drawRock(t);
    else if (t.kind === 'ceil') drawCeil(t);
  }
  for (const t of T) {
    if (t.x > G.cam.x + VW + 10 || t.x + t.w < G.cam.x - 10) continue;
    if (t.kind === 'tooth') drawTooth(t);
  }
  for (const t of T) {
    if (t.x > G.cam.x + VW + 10 || t.x + t.w < G.cam.x - 10) continue;
    if (t.kind === 'tooth') { drawCollar(t); if (t.braces) drawBracket(t); }
    else if (t.kind === 'backface') drawCollar(t);
    else if (t.kind === 'cingulum' || t.kind === 'ridge') drawToothLedge(t);
    else if (t.kind === 'shelf') drawShelf(t);
    else if (t.kind === 'floss') drawFloss(t);
    else if (t.kind === 'wire') drawFloss(t, true);
    else if (t.kind === 'ledge') drawLedge(t);
    else if (t.kind === 'gumpad') drawGumpad(t);
    else if (t.kind === 'plug') drawPlug(t);
    else if (t.kind === 'gate') drawGate(t);
  }
  if (G.L.exit.kind === 'hole') drawCreviceLips(G.L.exit);
  drawArchwire();
  for (const t of T) if (t.kind === 'tooth' && t.braces && t.x < G.cam.x + VW + 10 && t.x + t.w > G.cam.x - 10) drawBracketTie(t);
  if (G.arenaWall) drawArenaWall(G.arenaWall);
  for (const n of G.nodes) drawNode(n);
  for (const c of G.coats) drawCoatPatch(c, true);
  drawExit();
  for (const n of G.nerves) drawNerve(n);
  endPixels(pcx, pcy);
  // tip signs, sharp, straight to the screen
  if (G.signs && G.signs.length) { const key = signMetrics().size + ':' + G.signs.length; if (G.signsLaid !== key) { layoutSigns(); G.signsLaid = key; } }
  for (const s of G.signs || []) drawSign(s);
  // pass 2, on the pixel layer: everything that moves
  beginPixels(pcx, pcy);
  for (const s of G.spots) drawSpot(s);
  for (const g of G.gems) if (!g.taken) drawGem(g);
  for (const m of G.mints) if (!m.taken) drawMint(m);
  if (G.boss && G.boss.state === 'rainWarn') for (const mx of G.boss.marks) { if (G.t % 8 < 5) { const fy = Math.round(tongueY(G.L.tongue, mx, G.t)); ctx.fillStyle = '#ff2e63'; ctx.fillRect(mx - 6, fy - 2, 12, 2); ptext('!', mx - 3, fy - 14, '#ff2e63', 8); } }
  for (const e of G.enemies) e.draw();
  if (G.boss) G.boss.draw();
  for (const b of G.bubbles) drawBubble(b);
  for (const d of G.drops) drawDrop(d);
  if (G.player) G.player.draw();
  for (const b of G.bolts) { ctx.fillStyle = b.deflected ? '#ffe14d' : '#2ce8f5'; ctx.fillRect(Math.round(b.x), Math.round(b.y), b.w, b.h); ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(b.x) + 1, Math.round(b.y) + 1, b.w - 2, 1); }
  for (const f of G.foes) {
    if (f.kind === 'acid') { circ(f.x, f.y, f.r + 1, '#2a6a10'); circ(f.x, f.y, f.r, '#8cff3c'); }
    else if (f.kind === 'gunk') { circ(f.x, f.y, f.r + 1, '#6a5a2a'); circ(f.x, f.y, f.r, '#e8dcae'); circ(f.x - 1, f.y - 2, 1.6, '#fffbe8'); }
    else { circ(f.x, f.y, f.r + 1, '#45283c'); circ(f.x, f.y, f.r, '#7bd132'); circ(f.x - 1, f.y - 1, f.r * 0.4, '#d4ff8a'); }
  }
  drawParticles();
  endPixels(pcx, pcy);
  drawPrompts();
  for (const q of G.pops) { const hw = q.text.length * 4 + 4; ptext(q.text, clamp(q.x, G.cam.x + hw, G.cam.x + VW - hw), q.y, q.color, 8, 'center'); }   // popups stay on screen
  ctx.restore();
  if (G.L.def.dark && G.player) drawDarkness();
  if (G.special) { beginPixels(0, 0, true); drawSpecial(); endPixels(0, 0); drawSpecial(); }   // the effect in pixels, its name sharp
  drawBanner();
  if (G.cleanMsg && G.cleanMsg.t > 0 && G.state === 'play') {
    const a = Math.min(1, G.cleanMsg.t / 20);
    ctx.globalAlpha = a; ctx.fillStyle = 'rgba(10,4,24,.75)'; ctx.fillRect(0, VH - 40, VW, 18);
    ptext(G.cleanMsg.text, VW / 2, VH - 35, G.t % 20 < 10 ? '#3dff6a' : '#ffffff', 8, 'center'); ctx.globalAlpha = 1;
  }
  if (G.state === 'pause' || G.state === 'clear' || G.state === 'over' || G.state === 'won') { ctx.fillStyle = 'rgba(10,4,24,.35)'; ctx.fillRect(0, 0, VW, VH); }
  if (G.state === 'dying' && G.deathReason === 'rot') { ctx.fillStyle = 'rgba(120,160,20,' + Math.min(0.45, G.dieT / 120) + ')'; ctx.fillRect(0, 0, VW, VH); }
  if (G.fade > 0) { ctx.fillStyle = 'rgba(10,4,24,' + Math.min(1, G.fade) + ')'; ctx.fillRect(0, 0, VW, VH); }
}

function drawBackground(th) {
  const L = G.L, cx = G.cam.x, cy = G.cam.y;
  const sky = ctx.createLinearGradient(0, 0, 0, VH);
  sky.addColorStop(0, th.sky[0]); sky.addColorStop(0.55, th.sky[1]); sky.addColorStop(1, th.sky[2]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, VW, VH);
  const t = G.t;
  if (L.theme === 'root') {
    // glowing nerve veins and dentin tubules deep in the walls
    for (let layer = 0; layer < 2; layer++) {
      const par = layer ? 0.45 : 0.2;
      ctx.strokeStyle = layer ? 'rgba(255,90,120,.35)' : 'rgba(255,60,160,.18)'; ctx.lineWidth = layer ? 2 : 3;
      for (let i = -1; i < 6; i++) {
        const bx = i * 120 - ((cx * par) % 120), by = 40 + hash(i + layer * 9 + Math.floor(cx * par / 120)) * 120 - cy * par * 0.3;
        ctx.beginPath(); ctx.moveTo(bx, by);
        for (let k = 1; k <= 8; k++) ctx.lineTo(bx + k * 18, by + Math.sin(k * 1.3 + i + t * 0.02) * 10);
        ctx.stroke();
      }
    }
    ctx.fillStyle = 'rgba(255,200,230,.25)';
    for (let i = 0; i < 30; i++) { const x = (hash(i) * 600 - cx * 0.6) % 600; ctx.fillRect((x + 600) % 600 - 50, (hash(i + 7) * VH + t * 0.1 * (1 + hash(i))) % VH, 1, 1); }
    return;
  }
  // distant throat
  const tx = VW / 2 - ((cx * 0.05) % 60), ty = VH * 0.66 - cy * 0.05;
  const throat = ctx.createRadialGradient(tx, ty, 4, tx, ty, VH * 0.42);
  throat.addColorStop(0, th.far); throat.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.55; ctx.fillStyle = throat; ctx.fillRect(tx - VH * 0.5, ty - VH * 0.5, VH, VH); ctx.globalAlpha = 1;
  if (L.theme === 'tongue') {
    // swinging uvula
    const ux = VW * 0.62 - cx * 0.08 % (VW * 1.5), sw = Math.sin(t * 0.02) * 6;
    ctx.fillStyle = '#ff7aa0'; ctx.beginPath(); ctx.moveTo(ux - 16, -4); ctx.quadraticCurveTo(ux - 10 + sw, 50, ux + sw, 62); ctx.quadraticCurveTo(ux + 10 + sw, 50, ux + 16, -4); ctx.fill();
    circ(ux + sw, 58, 8, '#ff7aa0'); circ(ux + sw - 2, 55, 3, '#ffb3c6');
  }
  if (L.theme === 'back') {
    // the roof of the mouth: palate ridges (rugae)
    ctx.strokeStyle = 'rgba(255,170,215,.35)'; ctx.lineWidth = 3;
    for (let i = -1; i < 9; i++) {
      const bx = i * 70 - ((cx * 0.25) % 70);
      ctx.beginPath(); ctx.moveTo(bx, 46 - cy * 0.2); ctx.bezierCurveTo(bx + 20, 30 - cy * 0.2, bx + 40, 62 - cy * 0.2, bx + 64, 44 - cy * 0.2); ctx.stroke();
    }
  }
  drawUpperArch(th, cx, cy);
  // floating saliva bubbles
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    const bx = ((hash(i) * 900 - cx * 0.5) % 900 + 900) % 900 - 100, by = VH - ((t * (0.15 + hash(i + 3) * 0.2) + hash(i + 5) * VH) % (VH + 20));
    ctx.beginPath(); ctx.arc(bx, by, 2 + hash(i + 9) * 4, 0, Math.PI * 2); ctx.stroke();
  }
}

/* The upper teeth, in the background: the same sixteen teeth as the lower arch (molars at the back, canines
   and incisors at the front), hanging from the upper gum, a little smaller and further away. */
const UPPER = { scale: 0.62, par: 0.5, gap: 3 };
function drawUpperArch(th, cx, cy) {
  const sc = UPPER.scale, crown = 64 * WS, gumY = -cy * 0.2 + 2;
  const teeth = ARCH.map((k, i) => ({ style: k, w: TOOTH_KINDS[k].w * WS, mirror: i >= ARCH.length / 2 }));
  const archW = teeth.reduce((a, t) => a + t.w + UPPER.gap * WS, 0) + 40 * WS;
  const off = cx * UPPER.par / sc, view = VW / sc;
  ctx.save(); ctx.translate(0, gumY); ctx.scale(sc, sc);
  const placed = [];
  for (let rep = Math.floor(off / archW) - 1; rep * archW - off < view; rep++) {
    let x = rep * archW - off + 20 * WS;
    for (const t of teeth) { if (x + t.w > -20 && x < view + 20) placed.push({ ...t, x, kind: 'tooth', seed: rep * 31 + x }); x += t.w + UPPER.gap * WS; }
  }
  // teeth, drawn upside down so their biting edges point down
  ctx.save(); ctx.translate(0, crown); ctx.scale(1, -1);
  for (const t of placed) {
    const f = { x: t.x, y: 0, w: t.w, style: t.style, mirror: t.mirror, kind: 'tooth', gl: crown, gr: crown };
    drawTooth(f);
  }
  ctx.restore();
  // the upper gum over the tooth necks, scalloped: it dips between teeth and arches over each one
  const sk = SKINS.gum, gy = x => { for (const t of placed) if (x >= t.x - UPPER.gap * WS && x < t.x + t.w) { const u = clamp((x - t.x) / t.w, 0, 1); return 4 + 7 * Math.pow(Math.abs(u - 0.5) * 2, 3); } return 11; };
  const x0 = -10, x1 = view + 10, top = (-gumY - 4) / sc;
  const gr = ctx.createLinearGradient(0, 12, 0, top); gr.addColorStop(0, sk.top); gr.addColorStop(0.18, sk.body); gr.addColorStop(1, sk.dark);
  ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x0, top);
  for (let x = x0; x <= x1; x += 3) ctx.lineTo(x, gy(x));
  ctx.lineTo(x1, top); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = sk.hi; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let x = x0; x <= x1; x += 3) ctx.lineTo(x, gy(x) - 1.5);
  ctx.stroke();
  ctx.restore();
  // a touch of haze, so they sit behind the action
  ctx.fillStyle = th.sky[0]; ctx.globalAlpha = 0.18; ctx.fillRect(0, 0, VW, gumY + crown * sc + 4); ctx.globalAlpha = 1;
}
function drawGum(t) {
  if (t.off) {                     // melted: once it starts regrowing, it knits back together from the middle outward
    if (!t.dis || t.dis > GUM_GROW) return;
    const g = 1 - t.dis / GUM_GROW, half = t.w / 2 * g, mid = t.x + t.w / 2;
    ctx.save(); ctx.beginPath(); ctx.rect(mid - half, G.cam.y - 10, half * 2, VH + 40); ctx.clip();
    ctx.translate(0, (1 - g) * 5 * WS);
    drawGumBody(t); ctx.restore();
    if (G.t % 5 === 0 && onScreen(t.x, t.y, 10)) { const sx = Math.random() < 0.5 ? mid - half : mid + half; spawnP(sx, t.y + (1 - g) * 5 * WS, { vx: rand(-0.3, 0.3), vy: -0.5, color: '#ffd6e8', life: 16, size: 1, g: 0 }); }
    return;
  }
  drawGumBody(t);
}
/* Fills the current path with gum shading that fades from the gum's own surface downward, column by column,
   so slopes and joins between pieces always match. anchor(x) = the surface height at x. */
const gumGrads = new Map();
function gumGrad(sk, y) {
  const key = sk.top + (Math.round(y * 4) / 4);
  let g = gumGrads.get(key);
  if (!g) { if (gumGrads.size > 600) gumGrads.clear(); g = ctx.createLinearGradient(0, y, 0, y + 50); g.addColorStop(0, sk.top); g.addColorStop(0.25, sk.body); g.addColorStop(1, sk.dark); gumGrads.set(key, g); }
  return g;
}
function shadeGumPath(sk, x0, x1, anchor, bottom) {
  ctx.save(); ctx.clip();
  for (let x = Math.floor(x0); x < x1; x++) { const y = anchor(x + 0.5); ctx.fillStyle = gumGrad(sk, y); ctx.fillRect(x, y - 14, 1.25, bottom - y + 14); }
  ctx.restore();
}
/* Gum: flat pieces, and mounds that rise from the gum beside them. Both share one look: the colour fades from
   the surface down, anchored at the flat gum's height, so a mound runs on from its neighbour with no seam. */
function drawGumBody(t) {
  const sk = SKINS[t.skin], b = G.cam.y + VH + 2;
  const xs = Math.max(t.x, Math.floor(G.cam.x) - 2), xe = Math.min(t.x + t.w, Math.ceil(G.cam.x + VW) + 2);
  if (xe <= xs) return;
  const mound = t.kind === 'mound', base = t.y, R = 7;
  const shape = mound
    ? x => { const u = (x - t.x) / t.w; return u >= t.rise ? t.y : t.y0 + (t.y - t.y0) * (1 - Math.cos(Math.PI * u / t.rise)) / 2; }
    : x => { let y = t.y; if (!t.seamless) { const el = x - t.x, er = t.x + t.w - x; if (t.roundL && el < R) y += (R - el) * (R - el) / 8; if (t.roundR && er < R) y += (R - er) * (R - er) / 8; } return y; };
  const surf = x => shape(x) + dentAt(t, x);
  const gr = ctx.createLinearGradient(0, base, 0, base + 50); gr.addColorStop(0, sk.top); gr.addColorStop(0.25, sk.body); gr.addColorStop(1, sk.dark);
  const x0 = mound ? xs - 1 : xs, x1 = mound ? xe + 1 : xe;                  // mounds tuck 1px under their neighbours
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.moveTo(x0, b); ctx.lineTo(x0, surf(xs));
  for (let x = xs; x < xe; x += 2) ctx.lineTo(x, surf(x));
  ctx.lineTo(xe, surf(xe)); ctx.lineTo(x1, surf(xe)); ctx.lineTo(x1, b); ctx.closePath();
  if (mound) shadeGumPath(sk, x0, x1, shape, b); else ctx.fill();
  ctx.strokeStyle = sk.hi; ctx.lineWidth = 1.5; ctx.beginPath();
  const hl0 = mound || !t.roundL ? xs - 1 : xs + 2, hl1 = mound || !t.roundR ? xe + 1 : xe - 2;   // highlight runs on into joined neighbours
  for (let x = hl0; x < hl1; x += 2) ctx.lineTo(x, surf(x) + 1.5);
  ctx.lineTo(hl1, surf(Math.min(hl1, xe)) + 1.5);
  ctx.stroke();
  ctx.fillStyle = sk.dot;
  for (let x = xs - (xs % 7); x < xe; x += 7) { const h = hash(x * 1.7); if (h < 0.6) ctx.fillRect(x, Math.round(shape(x) + 7 + h * 28 + dentAt(t, x) * 0.5), 2, 1); }
  ctx.fillStyle = sk.line;
  if (t.seamless) return;
  if (t.roundL && t.x >= xs) ctx.fillRect(t.x, t.y + 6, 1, b - t.y);
  if (t.roundR && t.x + t.w <= xe) ctx.fillRect(t.x + t.w - 1, t.y + 6, 1, b - t.y);
}

/* A tooth's outline: the biting edge follows its real shape; the sides pinch in a little toward the neck. */
function toothOutline(t, bottom) {
  const x = t.x, w = t.w, n = Math.max(12, Math.round(w / 3));
  ctx.beginPath();
  ctx.moveTo(x + 4, bottom);
  ctx.quadraticCurveTo(x - 1.5, (bottom + t.y) / 2 + 6, x, t.y + WS * toothTopOffset(t.style, 0, t.mirror));
  for (let i = 1; i <= n; i++) { const u = i / n; ctx.lineTo(x + u * w, t.y + WS * toothTopOffset(t.style, u, t.mirror)); }
  ctx.quadraticCurveTo(x + w + 1.5, (bottom + t.y) / 2 + 6, x + w - 4, bottom);
  ctx.closePath();
}
const toothTop = (t, u) => t.y + WS * toothTopOffset(t.style, u, t.mirror);
function cuspTip(t) { let best = 0.5, by = 1e9; for (let u = 0.05; u <= 0.95; u += 0.01) { const y = toothTop(t, u); if (y < by) { by = y; best = u; } } return best; }
function cuspGrooves(t) {             // the notches between a molar's cusps
  const out = [];
  for (let u = 0.12; u <= 0.88; u += 0.01) if (toothTop(t, u) > toothTop(t, u - 0.01) && toothTop(t, u) >= toothTop(t, u + 0.01)) out.push(u);
  return out;
}
function cuspPeaks(t) {               // the tops of a molar's cusps
  const out = [];
  for (let u = 0.08; u <= 0.92; u += 0.01) if (toothTop(t, u) < toothTop(t, u - 0.01) && toothTop(t, u) <= toothTop(t, u + 0.01)) out.push(u);
  return out;
}
/* Anatomy details shared by the fronts and backs of teeth. */
function toothDetails(t, gy, back) {
  const x = t.x, w = t.w, k = t.style, h = gy - t.y;
  if (k === 'i1' || k === 'i2' || k === 'c') {           // translucent biting edge
    ctx.strokeStyle = back ? 'rgba(200,190,170,.5)' : 'rgba(150,200,255,.55)'; ctx.lineWidth = 3; ctx.beginPath();
    for (let u = 0.04; u <= 0.96; u += 0.04) ctx.lineTo(x + u * w, toothTop(t, u) + 2.5);
    ctx.stroke();
  }
  if (k === 'i1') {                                       // little mamelon bumps
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    for (const u of [0.17, 0.5, 0.83]) ctx.fillRect(Math.round(x + u * w - 4), Math.round(toothTop(t, u) + 1), 8, 1);
  }
  if (k === 'c' || k === 'p1' || k === 'p2') {            // a ridge running down from the cusp tip
    const u = cuspTip(t), tx = x + u * w, ty = toothTop(t, u);
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(tx, ty + 3); ctx.quadraticCurveTo(tx + 1, ty + h * 0.3, tx - 1, ty + h * 0.55); ctx.stroke();
    ctx.strokeStyle = back ? 'rgba(130,110,90,.35)' : 'rgba(110,130,180,.35)'; ctx.lineWidth = 1;
    for (const d of [-8, 8]) { ctx.beginPath(); ctx.moveTo(tx + d * 0.6, ty + 6); ctx.quadraticCurveTo(tx + d, ty + h * 0.3, tx + d * 1.4, ty + h * 0.5); ctx.stroke(); }
  }
  if (k[0] === 'm') {                                     // grooves between the cusps, ending in little pits
    ctx.strokeStyle = back ? 'rgba(130,110,90,.4)' : 'rgba(100,120,170,.4)'; ctx.lineWidth = 1.2;
    for (const u of cuspGrooves(t)) {
      const gx = x + u * w, g0 = toothTop(t, u), len = 4 + hash(x + u * 7) * 3;     // just a short notch where two cusps meet
      ctx.beginPath(); ctx.moveTo(gx, g0 + 1); ctx.lineTo(gx, g0 + len); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.6)';               // a highlight on each cusp
    for (const u of cuspPeaks(t)) ctx.fillRect(Math.round(x + u * w - 7), Math.round(toothTop(t, u) + 3), 14, 1);
  }
}
function drawTooth(t) {
  const gy = Math.max(t.gl == null ? 0 : t.gl, t.gr == null ? 0 : t.gr) || G.cam.y + VH;
  const x = t.x, y = t.y, w = t.w, bottom = gy + 6;
  const gr = ctx.createLinearGradient(x, 0, x + w, 0);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#eef4ff'); gr.addColorStop(1, '#b4c6e6');
  toothOutline(t, bottom); ctx.fillStyle = gr; ctx.fill();
  ctx.strokeStyle = '#2d1f4f'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.save(); toothOutline(t, bottom); ctx.clip();
  toothDetails(t, gy, false);
  ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(x + 8, y + 14, 4, Math.max(8, (gy - y) * 0.45));
  ctx.fillStyle = 'rgba(80,100,160,.2)'; ctx.fillRect(x + w - 10, y + 4, 9, gy - y);
  drawWear(t, gy);
  ctx.restore();
  if ((G.t + x) % 240 < 12) { const s = (G.t + x) % 240 < 6 ? 1 : 2, sy = toothTop(t, 0.15) + 7; ctx.fillStyle = '#fff'; ctx.fillRect(x + 12 - s, sy, s * 2 + 1, 1); ctx.fillRect(x + 12, sy - s, 1, s * 2 + 1); }
}
/* A little wear and tear so no two teeth look alike: a chipped corner, a hairline crack, a stain or a worn edge. */
function drawWear(t, gy) {
  const seed = t.x * 1.7 + (t.kind === 'backface' ? 7 : 0), k = hash(seed * 1.31), left = hash(seed * 2.7) < 0.5, x = t.x, w = t.w;
  if (k < 0.07) {                    // a faint hairline craze line
    const u = 0.35 + hash(seed) * 0.3, cx = x + u * w, cy = toothTop(t, u), len = (8 + hash(seed + 5) * 6) * WS;
    ctx.strokeStyle = 'rgba(120,130,170,.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, cy + 3);
    ctx.lineTo(cx + 1, cy + len * 0.5); ctx.lineTo(cx, cy + len); ctx.stroke();
  } else if (k < 0.32) {             // a little yellowing toward the gumline
    const sg = ctx.createLinearGradient(0, gy - (gy - t.y) * 0.45, 0, gy);
    sg.addColorStop(0, 'rgba(220,190,110,0)'); sg.addColorStop(1, 'rgba(220,190,110,.35)');
    ctx.fillStyle = sg; ctx.fillRect(x, gy - (gy - t.y) * 0.45, w, (gy - t.y) * 0.45);
  } else if (k < 0.47) {             // a faint stain
    ctx.fillStyle = 'rgba(190,150,70,.22)'; ctx.beginPath(); ctx.ellipse(x + w * (0.3 + hash(seed + 2) * 0.4), t.y + (gy - t.y) * 0.55, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
  } else if (k < 0.65) {
    ctx.strokeStyle = 'rgba(90,100,150,.35)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let u = 0.1; u <= 0.9; u += 0.05) ctx.lineTo(x + u * w, toothTop(t, u) + 3.5);
    ctx.stroke();
  }
}
/* The back of a tooth, seen whole from its top edge down to the gums. */
function drawBackface(t) {
  const x = t.x, y = t.y, w = t.w, b = t.y + t.h + 6;
  const g = ctx.createLinearGradient(0, y, 0, b); g.addColorStop(0, '#fbf6e8'); g.addColorStop(0.55, '#e9e0c9'); g.addColorStop(1, '#c9b386');
  toothOutline(t, b); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#3a2a4f'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.save(); toothOutline(t, b); ctx.clip();
  const sg = ctx.createLinearGradient(x, 0, x + w, 0);
  sg.addColorStop(0, 'rgba(255,255,255,.4)'); sg.addColorStop(0.25, 'rgba(255,255,255,0)'); sg.addColorStop(0.75, 'rgba(90,70,110,0)'); sg.addColorStop(1, 'rgba(90,70,110,.35)');
  ctx.fillStyle = sg; ctx.fillRect(x - 2, y - 2, w + 4, b - y + 4);
  ctx.fillStyle = 'rgba(120,96,80,.16)';                                   // marginal ridges
  ctx.fillRect(x + 8, y + 20, 3, b - y - 42); ctx.fillRect(x + w - 11, y + 20, 3, b - y - 42);
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.ellipse(x + w / 2, b - 42 * WS, w / 2 - 10, 14, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = 'rgba(200,160,70,.35)';                                  // yellowed near the gumline
  for (let k = 0; k < 9; k++) ctx.fillRect(Math.round(x + 4 + hash(x + k) * (w - 8)), Math.round(b - 20 - hash(x + k + 3) * 14), 4, 3);
  toothDetails(t, b, true);
  drawWear(t, b);
  ctx.restore();
}
function drawToothLedge(t) {
  const x = t.x, y = t.y, w = t.w;
  ctx.fillStyle = 'rgba(60,40,70,.25)'; ctx.fillRect(x + 2, y + 6, w - 4, 4);           // shadow on the tooth below
  if (t.kind === 'cingulum') {      // the smooth bulge of enamel on the back of a tooth
    ctx.fillStyle = '#5a4a6a'; ctx.beginPath(); ctx.roundRect(x - 1, y - 1, w + 2, 8, 4); ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + 7); g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#d6c9a8');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, 6, 3); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 3, y + 1, w - 6, 1);
  } else {                          // a crusty ridge of tartar
    ctx.fillStyle = '#6a5226'; ctx.beginPath(); ctx.roundRect(x - 1, y - 1, w + 2, 8, 3); ctx.fill();
    ctx.fillStyle = '#e2c870'; ctx.beginPath(); ctx.roundRect(x, y, w, 6, 3); ctx.fill();
    for (let k = 2; k < w - 2; k += 5) circ(x + k, y + 0.5 + hash(x + k) * 1.5, 2, '#e8d07a');
    ctx.fillStyle = '#b8963a'; for (let k = 4; k < w - 3; k += 7) ctx.fillRect(x + k, y + 3, 2, 1);
  }
}
function drawCollar(t) {
  if (t.gl == null && t.gr == null) return;
  const gl = t.gl == null ? t.gr : t.gl, gr = t.gr == null ? t.gl : t.gr;
  const sk = SKINS[t.skinL] || SKINS.gum, x = t.x, w = t.w, b = G.cam.y + VH + 2, mid = (gl + gr) / 2;
  ctx.beginPath(); ctx.moveTo(x - 3, b); ctx.lineTo(x - 3, gl);
  ctx.quadraticCurveTo(x - 1, gl - 7, x + 6, gl - 3);
  ctx.quadraticCurveTo(x + w / 2, mid + 2, x + w - 6, gr - 3);
  ctx.quadraticCurveTo(x + w + 1, gr - 7, x + w + 3, gr);
  ctx.lineTo(x + w + 3, b); ctx.closePath();
  shadeGumPath(sk, x - 3, x + w + 3, k => lerp(gl, gr, clamp((k - x) / w, 0, 1)), b);
  ctx.fillStyle = sk.dot;                                   // the same speckles as the open gum
  for (let k = Math.ceil((x - 3) / 7) * 7; k < x + w + 3; k += 7) { const h = hash(k * 1.7); if (h < 0.6) ctx.fillRect(k, Math.round(lerp(gl, gr, (k - x) / w) + 9 + h * 28), 2, 1); }
  ctx.strokeStyle = sk.hi; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x - 3, gl + 1.5); ctx.quadraticCurveTo(x, gl - 5, x + 6, gl - 1.5); ctx.quadraticCurveTo(x + w / 2, mid + 3.5, x + w - 6, gr - 1.5); ctx.quadraticCurveTo(x + w, gr - 5, x + w + 3, gr + 1.5); ctx.stroke();
}
function drawShelf(t) {
  // a ledge on the back of the teeth (the cingulum): solid enamel you can drop through
  const x = t.x, y = t.y, w = t.w;
  ctx.fillStyle = '#2d1f4f'; ctx.beginPath(); ctx.roundRect(x - 2, y - 1, w + 4, 8, 3); ctx.fill();
  const gr = ctx.createLinearGradient(0, y, 0, y + 7); gr.addColorStop(0, '#fffaf0'); gr.addColorStop(1, '#bdb3c8');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(x - 1, y, w + 2, 6, 3); ctx.fill();
  ctx.fillStyle = 'rgba(214,180,80,.5)'; for (let k = 6; k < w - 4; k += 11) ctx.fillRect(x + k, y + 4, 4, 1);
  ctx.fillStyle = '#fff'; ctx.fillRect(x + 2, y + 1, w - 4, 1);
  // drop-through hint arrows underneath
  if ((G.t >> 4) % 2 && G.L.def.id === 'back') { ctx.fillStyle = 'rgba(255,255,255,.35)'; for (let k = 14; k < w - 8; k += 30) { ctx.fillRect(x + k, y + 9, 3, 1); ctx.fillRect(x + k + 1, y + 10, 1, 1); } }
}
function drawFloss(t, wire) {
  const s = t.sag, y = t.y + 1;
  const path = off => { ctx.beginPath(); ctx.moveTo(t.x, y + off); if (s.d > 0.1) ctx.lineTo(s.x, y + s.d + off); ctx.lineTo(t.x + t.w, y + off); ctx.stroke(); };
  if (wire) {                       // the braces archwire stretched across a gap: springy, and you can drop through it
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,20,40,.5)'; path(1);
    ctx.strokeStyle = '#a9b4c8'; path(0);
    ctx.lineWidth = 1; ctx.strokeStyle = '#ffffff'; path(-1.5);
    return;
  }
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,60,70,.45)'; path(1.5);
  ctx.strokeStyle = '#e9fffb'; path(0);
  ctx.lineWidth = 1; ctx.strokeStyle = '#7ff0dc'; path(0.5);
  ctx.fillStyle = '#7ff0dc'; ctx.fillRect(t.x - 2, y - 2, 3, 5); ctx.fillRect(t.x + t.w - 1, y - 2, 3, 5);
}
/* Braces, layered like the real thing: the bracket's base and slot sit on the tooth, the archwire runs through
   the slot, a colored elastic loops over the wire, and the four gray tie wings hold the elastic down at the corners. */
function drawBracket(t) {                                  // base and slot (under the wire)
  ctx.save(); ctx.translate(Math.round(t.x + t.w / 2), t.braces); ctx.scale(WS, WS);       // drawn at 1x, sized to the teeth
  ctx.fillStyle = 'rgba(40,30,70,.3)'; ctx.fillRect(-7, -5, 17, 14);              // shadow on the tooth
  ctx.fillStyle = '#3a4258'; ctx.fillRect(-9, -8, 18, 16);                        // the base pad
  ctx.fillStyle = '#aeb9cc'; ctx.fillRect(-8, -7, 16, 14);
  ctx.fillStyle = '#c9d2e2'; ctx.fillRect(-3, -7, 6, 14);                         // the raised body between the wings
  ctx.fillStyle = '#e8eef8'; ctx.fillRect(-3, -7, 1, 14);
  ctx.fillStyle = '#5a6278'; ctx.fillRect(-8, -1.5, 16, 3);                       // the slot the wire sits in
  ctx.restore();
}
const BAND_COLORS = ['#2ce8f5', '#ffcc00', '#ff6fb1', '#3dff6a', '#b05cff'];
function drawBracketTie(t) {                               // elastic over the wire, tie wings over the elastic
  const c = BAND_COLORS[Math.floor(t.x / 40) % BAND_COLORS.length];
  ctx.save(); ctx.translate(Math.round(t.x + t.w / 2), t.braces); ctx.scale(WS, WS);
  ctx.strokeStyle = 'rgba(20,10,40,.6)'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.roundRect(-6.5, -5.5, 13, 11, 3.5); ctx.stroke();
  ctx.strokeStyle = c; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(-2, -6.4, 4, 0.8); ctx.fillRect(-2, 4.8, 3, 0.6);
  for (const [wx, wy] of [[-9, -8], [4, -8], [-9, 3], [4, 3]]) {                   // tie wings, pinning the elastic down
    ctx.fillStyle = '#2d3448'; ctx.fillRect(wx, wy, 5, 5);
    ctx.fillStyle = '#9aa6bc'; ctx.fillRect(wx + 0.75, wy + 0.75, 3.5, 3.5);
    ctx.fillStyle = '#eef3fb'; ctx.fillRect(wx + 0.75, wy + 0.75, 3.5, 1);
  }
  ctx.restore();
}
function drawArchwire() {
  const teeth = G.L.terrain.filter(t => t.kind === 'tooth' && t.braces);
  for (let i = 0; i + 1 < teeth.length; i++) {
    const a = teeth[i], b = teeth[i + 1], x1 = a.x + a.w / 2, x2 = b.x + b.w / 2, y = a.braces;
    if (x2 < G.cam.x - 10 || x1 > G.cam.x + VW + 10) continue;
    if (G.L.terrain.some(w => w.kind === 'wire' && w.x > x1 && w.x < x2)) {        // that span is a walkable wire piece
      const w = G.L.terrain.find(k => k.kind === 'wire' && k.x > x1 && k.x < x2);
      ctx.fillStyle = '#a9b4c8'; ctx.fillRect(x1, y - 1, w.x - x1, 4); ctx.fillRect(w.x + w.w, y - 1, x2 - w.x - w.w, 4);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x1, y - 1, w.x - x1, 1); ctx.fillRect(w.x + w.w, y - 1, x2 - w.x - w.w, 1);
      continue;
    }
    ctx.fillStyle = 'rgba(20,20,40,.45)'; ctx.fillRect(x1, y + 1, x2 - x1, 4);
    ctx.fillStyle = '#a9b4c8'; ctx.fillRect(x1, y - 1, x2 - x1, 4);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x1, y - 1, x2 - x1, 1);
  }
}
function drawLedge(t) {
  // a gnarled root jutting out of the shaft wall
  const x = t.x, y = t.y, w = t.w;
  ctx.fillStyle = '#4a1a3a'; ctx.beginPath(); ctx.roundRect(x - 1, y - 1, w + 2, 8, 3); ctx.fill();
  ctx.fillStyle = '#d99a7a'; ctx.beginPath(); ctx.roundRect(x, y, w, 6, 3); ctx.fill();
  ctx.fillStyle = '#ffd6b0'; ctx.fillRect(x + 2, y + 1, w - 4, 1);
  ctx.strokeStyle = '#8a4a52'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + w / 2, y + 6); ctx.quadraticCurveTo(x + w / 2 + 4, y + 12, x + w / 2 - 2, y + 18); ctx.stroke();
}
function drawRock(t) {
  const x = t.x, y = t.y, w = t.w, h = Math.min(t.h, G.cam.y + VH + 2 - y);
  if (h <= 0) return;
  ctx.fillStyle = '#3a1030'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  const gr = ctx.createLinearGradient(0, y, 0, y + Math.min(60, h)); gr.addColorStop(0, '#f6cfa6'); gr.addColorStop(0.3, '#d99a7a'); gr.addColorStop(1, '#7a3d4a');
  ctx.fillStyle = gr; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#ffe3c4'; ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = 'rgba(90,30,50,.35)';
  for (let k = 3; k < w - 2; k += 6) { const hh = hash(x + k); ctx.fillRect(x + k, y + 5 + hh * Math.min(30, h - 8), 1, 2 + hh * 3); }
}
function drawCeil(t) {
  const bottom = t.y + t.h, top = Math.max(t.y, G.cam.y - 2);
  if (bottom < G.cam.y) return;
  const gr = ctx.createLinearGradient(0, bottom - 60, 0, bottom); gr.addColorStop(0, '#1d0614'); gr.addColorStop(1, '#5a1a3a');
  ctx.fillStyle = gr; ctx.fillRect(t.x, top, t.w, bottom - top);
  ctx.fillStyle = '#5a1a3a';
  for (let x = t.x; x < t.x + t.w; x += 9) { const r = 3 + hash(x) * 3; circ(x + 4, bottom - 1, r, '#5a1a3a'); }
  ctx.fillStyle = 'rgba(255,170,200,.35)';
  for (let x = t.x + 5; x < t.x + t.w; x += 37) { const d = (G.t * 0.5 + hash(x) * 200) % 120; if (d < 60) ctx.fillRect(x, bottom + 2 + d, 1, 2); }
}
function drawPlug(t) {
  if (t.off) return;
  const x = t.x, y = t.y, w = t.w, h = t.h;
  ctx.fillStyle = '#5a4520'; ctx.beginPath(); ctx.roundRect(x - 1, y - 2, w + 2, h + 3, 4); ctx.fill();
  ctx.fillStyle = '#e8cf6a'; ctx.beginPath(); ctx.roundRect(x, y - 1, w, h + 1, 4); ctx.fill();
  for (let k = 0; k < w; k += 6) { circ(x + k + 3, y - 1 + hash(x + k) * 2, 3, '#e8cf6a'); ctx.fillStyle = '#a88a4a'; ctx.fillRect(x + k + 2, y + 3 + hash(k + x) * (h - 5), 2, 1); }
  if (onScreen(x, y, 10) && G.t % 30 === 0) spawnP(x + rand(4, w - 4), y - 2, { vx: 0, vy: -0.3, color: '#b6ff3b', life: 40, size: 1, g: -0.003, shape: 'stink' });
}
function drawGate(t) {
  if (t.off) return;
  if (G.L.theme === 'tongue') {     // a wall of stench, thins out as it lifts
    const a = 1 - t.open;
    for (let i = 0; i < 16; i++) {
      const yy = G.cam.y + i * 15 + Math.sin(G.t * 0.05 + i) * 4, r = 10 + hash(i) * 6 + Math.sin(G.t * 0.07 + i * 2) * 2;
      circ(t.x + 6 + Math.sin(G.t * 0.04 + i * 1.7) * 5, yy, r, 'rgba(140,210,60,' + (0.35 * a) + ')');
      circ(t.x + 6 + Math.sin(G.t * 0.06 + i) * 3, yy + 4, r * 0.6, 'rgba(190,240,110,' + (0.3 * a) + ')');
    }
    return;
  }
  const off = t.open * t.h, y0 = Math.max(t.y, G.cam.y - 10), y1 = t.y + t.h - off;
  if (y1 <= y0) return;
  ctx.fillStyle = '#5a6278'; ctx.fillRect(t.x + 3, y0, 6, y1 - y0);
  ctx.fillStyle = '#e8eef8'; ctx.fillRect(t.x + 4, y0, 2, y1 - y0);
  const cols = ['#2ce8f5', '#ffcc00', '#ff6fb1', '#3dff6a'];
  for (let y = y1 - 16, k = 0; y > y0 - 12; y -= 24, k++) {
    ctx.fillStyle = '#3a4258'; ctx.fillRect(t.x - 2, y - 1, 16, 12);
    ctx.fillStyle = '#c9d2e2'; ctx.fillRect(t.x - 1, y, 14, 10);
    ctx.fillStyle = cols[k % 4]; ctx.fillRect(t.x - 2, y + 3, 16, 3);
  }
}
function drawGumpad(t) {
  let a = 1;
  ctx.save();
  if (t.off) {                     // regrowing gum pads swell back into place
    if (!t.dis || t.dis > GUM_GROW) { ctx.restore(); return; }
    const g = 1 - t.dis / GUM_GROW;
    ctx.translate(t.x + t.w / 2, t.y + 4); ctx.scale(g, 0.4 + 0.6 * g); ctx.translate(-(t.x + t.w / 2), -(t.y + 4));
  }
  ctx.globalAlpha = a;
  ctx.fillStyle = '#7a1a48'; ctx.beginPath(); ctx.roundRect(t.x - 1, t.y - 1, t.w + 2, 9, 4); ctx.fill();
  const gr = ctx.createLinearGradient(0, t.y, 0, t.y + 7); gr.addColorStop(0, '#ffb6d6'); gr.addColorStop(1, '#e0508a');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(t.x, t.y, t.w, 7, 3); ctx.fill();
  ctx.fillStyle = '#ffd6e8'; ctx.fillRect(t.x + 3, t.y + 1, t.w - 6, 1);
  ctx.fillStyle = '#d8417a'; for (let k = 5; k < t.w - 3; k += 8) ctx.fillRect(t.x + k, t.y + 4, 2, 1);
  ctx.globalAlpha = 1; ctx.restore();
}
function drawArenaWall(wl) {
  const fl = 190 * WS, h = fl - G.L.top, y = fl - h * wl.rise + (G.L.tongue ? 30 * WS : 0);
  const root = G.L.theme === 'root';
  const gr = ctx.createLinearGradient(wl.x, 0, wl.x + 12, 0); gr.addColorStop(0, root ? '#7a3d4a' : '#9a1a40'); gr.addColorStop(1, root ? '#d99a7a' : '#ff7aa0');
  ctx.fillStyle = gr; ctx.fillRect(wl.x, y, 12, fl - y);
  ctx.fillStyle = '#ffc6d4'; for (let k = Math.ceil(y); k < fl; k += 9) ctx.fillRect(wl.x + 9, k, 2, 4);
}
function drawExit() {
  const ex = G.L.exit;
  if (ex.kind === 'door') {
    const x = ex.x + 18 * WS, y = 150 * WS, lit = G.clean;
    ctx.fillStyle = '#5a2a1a'; ctx.fillRect(x + 8, y + 14, 3, 32);
    ctx.fillStyle = '#1b0f2e'; ctx.fillRect(x - 3, y - 1, 26, 17);
    ctx.fillStyle = lit ? '#3dff6a' : '#7a6a8a'; ctx.fillRect(x - 2, y, 24, 15);
    ptext('→', x + 10, y + 3, lit ? '#ffffff' : '#c9b8ec', 8, 'center', false);
    if (lit && G.t % 30 < 15) ptext(ex.label, x + 10, y - 12, '#ffffff', 8, 'center');
  } else if (ex.kind === 'up' && G.clean) {
    if (G.t % 20 < 12) ptext('↑', ex.x + ex.w / 2 - 2, 30 * WS + Math.sin(G.t * 0.15) * 3, '#3dff6a', 8, 'center');
  }
}
function drawNerve(n) {
  // an exposed nerve lying in a jagged crack in the dentin, with fine tendrils spreading through the rock below.
  // Dull when calm; it flickers as a warning, then crackles with light when it fires.
  if (!onScreen(n.x, n.y, 40)) return;
  const on = n.t >= 100, warn = n.t >= 70 && n.t < 100, y = n.y, x0 = n.x - 6, x1 = n.x + n.w + 6;
  const glow = on ? 1 : warn ? 0.5 + 0.5 * Math.sin(n.t * 0.8) : 0;
  const depth = x => { const u = (x - x0) / (x1 - x0); return Math.sin(u * Math.PI) * (5 + hash(Math.round(x / 3) + n.x) * 2.5); };
  // tendrils first, so the crack sits over their roots
  ctx.lineWidth = 1;
  for (let k = 0; k < 5; k++) {
    let tx = n.x + (k + 0.5) / 5 * n.w + (hash(n.x + k) - 0.5) * 8, ty = y + depth(tx) - 1, dir = hash(n.x * 2 + k) < 0.5 ? -1 : 1;
    ctx.strokeStyle = glow ? 'rgba(255,200,110,' + (0.35 + 0.4 * glow) + ')' : 'rgba(150,40,70,.45)';
    ctx.beginPath(); ctx.moveTo(tx, ty);
    for (let seg = 0; seg < 4; seg++) {
      tx += dir * (2 + hash(k * 7 + seg + n.x) * 4); ty += 3 + hash(k * 3 + seg + n.x) * 4; ctx.lineTo(tx, ty);
      if (seg === 1) { ctx.moveTo(tx, ty); ctx.lineTo(tx - dir * 4, ty + 5); ctx.moveTo(tx, ty); }
    }
    ctx.stroke();
  }
  // the crack itself: ragged edges, dark and moist inside
  ctx.beginPath(); ctx.moveTo(x0, y);
  for (let x = x0; x <= x1; x += 3) ctx.lineTo(x, y - 0.5 + (hash(x * 0.7 + n.x) - 0.5) * 1.2);
  for (let x = x1; x >= x0; x -= 3) ctx.lineTo(x, y + depth(x));
  ctx.closePath();
  ctx.fillStyle = glow ? 'rgba(120,40,40,1)' : '#4a1428'; ctx.fill();
  ctx.save(); ctx.clip();
  // twisted fibers bedded in the crack: nerve, artery and vein
  const strand = (k, amp, ph) => y + 2.2 + Math.sin((n.x + k) * 0.22 + ph) * amp;
  const fibers = [[glow ? '#fff2c0' : '#d9b48a', 1.2, 0, 2.6], [glow ? '#ffffff' : '#ecd2ac', 1.2, 0.4, 1], ['#b0283f', 1, 2.1, 1], ['#4a50b0', 1, 4.2, 1]];
  for (const [col, amp, ph, lw] of fibers) {
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
    for (let k = -6; k <= n.w + 6; k += 2) { const yy = strand(k, amp, ph); if (k > -6) ctx.lineTo(n.x + k, yy); else ctx.moveTo(n.x + k, yy); }
    ctx.stroke();
  }
  ctx.restore();
  // where the nerve swells up out of the crack
  for (let k = 0; k < 3; k++) {
    const hx = n.x + (k + 0.5) / 3 * n.w + (hash(n.x + k * 5) - 0.5) * 6;
    ell(hx, y + 0.5, 3 + hash(k + n.x) * 2, 1.6, glow ? '#fff0b0' : '#d9b48a');
    ctx.fillStyle = glow ? '#ffffff' : '#f2dcb8'; ctx.fillRect(Math.round(hx - 1), Math.round(y - 0.5), 2, 1);
  }
  ctx.fillStyle = 'rgba(255,227,196,.7)';                        // chipped rim catching the light
  for (let x = x0 + 2; x < x1 - 2; x += 5) if (hash(x + n.x * 3) < 0.6) ctx.fillRect(x, y - 1, 2, 1);
  if (glow) {                        // soft light around the bundle while it's live
    ctx.globalCompositeOperation = 'lighter';
    ell(n.x + n.w / 2, y + 1, n.w / 2 + 8, 8, 'rgba(255,190,80,' + (0.22 * glow) + ')');
    ctx.globalCompositeOperation = 'source-over';
  }
  if (warn && n.t % 4 === 0) spawnP(n.x + rand(0, n.w), y - 1, { vx: rand(-0.5, 0.5), vy: rand(-1.2, -0.3), color: '#ffe14d', life: 10, size: 1, g: 0.05 });
  if (on) {                          // little arcs jumping off the bundle
    ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 1;
    for (let a = 0; a < 3; a++) {
      const ax = n.x + hash(a + Math.floor(G.t / 3)) * n.w;
      ctx.beginPath(); ctx.moveTo(ax, y);
      ctx.lineTo(ax + 2, y - 4 - hash(a + G.t) * 4); ctx.lineTo(ax - 1, y - 8 - hash(a * 3 + G.t) * 5); ctx.lineTo(ax + 3, y - 12 - hash(a * 7 + G.t) * 3);
      ctx.stroke();
    }
  }
}
/* Tip text is sized for the screen it's on: about 24 CSS px tall on a desktop, a bit bigger on touch screens. */
const signCache = {};
function signMetrics() {
  const touch = document.body.classList.contains('touch');
  const size = Math.round(clamp((touch ? 22 : 24) / CSSPX, touch ? 9 : 6, 16) * 4) / 4;
  if (signCache.size === size) return signCache;
  const font = size + 'px VT323';
  ctx.font = font;
  const up = ctx.measureText('MbdhklT'), dn = ctx.measureText('gjpqy');
  const asc = clamp(up.actualBoundingBoxAscent || size * 0.6, size * 0.4, size * 0.8), desc = clamp(dn.actualBoundingBoxDescent || size * 0.15, size * 0.05, size * 0.3), gap = size * 0.2;
  return Object.assign(signCache, { size, font, asc, desc, gap, line: asc + desc + gap });
}
/* Tip boxes change size with the screen, so they're spread out here whenever that size changes: each one
   moves the shortest distance (up, down, then sideways) needed to stay clear of the ones before it. */
function layoutSigns() {
  const m = signMetrics(), pad = m.size * 0.4, gapPx = 3, placed = [];
  ctx.font = m.font;
  const width = lines => Math.max(0, ...(lines || []).map(segs => segs.reduce((a, sg) => a + ctx.measureText(sg.t).width, 0)));
  const hits = (a, b) => a.x < b.x + b.w + gapPx && a.x + a.w + gapPx > b.x && a.y < b.y + b.h + gapPx && a.y + a.h + gapPx > b.y;
  for (const s of G.signs) {
    if (!s.lines) continue;
    const n = Math.max(s.lines.length, s.linesDone ? s.linesDone.length : 0);
    const w = Math.max(width(s.lines), width(s.linesDone)) + pad * 2, h = n * m.line - m.gap + pad * 1.2 + 1.5;
    let best = { ox: 0, oy: 0 };
    const tries = [[0, 0]];
    for (let d = 3; d <= 24; d += 3) tries.push([0, d]);
    for (let d = 6; d <= 200; d += 6) tries.push([d, 0], [-d, 0], [d, 12], [-d, 12]);
    for (let d = 3; d <= 90; d += 3) tries.push([0, -d]);
    for (const [ox, oy] of tries) { const box = { x: s.x + ox, y: s.y + oy, w, h }; if (!placed.some(p => hits(box, p))) { best = { ox, oy }; break; } }
    s.ox = best.ox; s.oy = best.oy; s.box = { x: s.x + s.ox, y: s.y + s.oy, w, h }; placed.push(s.box);
  }
}
function drawSign(s) {
  if (!onScreen(s.x + 50, s.y, 120)) return;
  const lines = G.clean && s.linesDone ? s.linesDone : s.lines;
  if (!lines) return;
  const m = signMetrics(), pad = m.size * 0.4;
  ctx.font = m.font; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  let w = 0;
  for (const segs of lines) { let lw = 0; for (const sg of segs) lw += ctx.measureText(sg.t).width; w = Math.max(w, lw); }
  const bob = Math.sin(G.t * 0.03 + s.x * 0.1) * 0.6, x = s.x + (s.ox || 0), y = s.y + (s.oy || 0) + bob, h = lines.length * m.line - m.gap + pad * 1.2;
  ctx.fillStyle = 'rgba(27,15,46,.82)'; ctx.beginPath(); ctx.roundRect(x, y, w + pad * 2, h, 2); ctx.fill();
  ctx.strokeStyle = G.clean && s.linesDone ? 'rgba(61,255,106,.8)' : 'rgba(255,255,255,.4)'; ctx.lineWidth = 0.75; ctx.stroke();
  lines.forEach((segs, i) => {
    let lx = x + pad;
    for (const sg of segs) { ctx.fillStyle = sg.hi ? '#2ce8f5' : '#ffffff'; ctx.fillText(sg.t, lx, y + pad * 0.6 + m.asc + i * m.line); lx += ctx.measureText(sg.t).width; }
  });
}
function drawSpot(s) {
  if (s.kind === 'boss' || !onScreen(s.x, s.y, 30)) return;
  const x = Math.round(s.x), y = Math.round(s.y), t = s.t;
  if (s.kind === 'cavity' || s.kind === 'decay') {
    if (s.done) {
      ctx.fillStyle = s.kind === 'cavity' ? '#d7e2f0' : '#ffb3c8'; ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x - 5, y + 4); ctx.lineTo(x + 4, y + 5); ctx.lineTo(x + 7, y); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 4, y + 1, 3, 1);
      if (s.doneT % 120 < 10) { ctx.fillRect(x + 2, y - 4, 1, 5); ctx.fillRect(x, y - 2, 5, 1); }
      return;
    }
    ctx.fillStyle = s.kind === 'cavity' ? '#3b1a0e' : '#2a0a2a';
    ctx.beginPath(); ctx.moveTo(x - 8, y - 0.5); ctx.lineTo(x - 6, y + 5); ctx.lineTo(x - 2, y + 7); ctx.lineTo(x + 3, y + 6); ctx.lineTo(x + 7, y + 4); ctx.lineTo(x + 8, y - 0.5); ctx.fill();
    ctx.fillStyle = s.kind === 'cavity' ? '#1a0905' : '#120312'; ctx.fillRect(x - 4, y + 1, 7, 4);
    ctx.fillStyle = s.kind === 'cavity' ? 'rgba(199,154,58,.8)' : 'rgba(150,80,200,.8)'; ctx.fillRect(x - 9, y - 1, 2, 1); ctx.fillRect(x + 7, y - 1, 2, 1);
    const goo = s.kind === 'cavity' ? '#b6ff3b' : '#c58bff';
    for (let i = 0; i < 3; i++) { const ph = (t * 0.05 + i * 2.1) % 3; circ(x - 4 + i * 4, y + 1 - ph * 2, ph < 2.6 ? 1.4 : 0, goo); }
  } else if (s.kind === 'coat') {
    if (s.done) { if (s.doneT < 60 && s.doneT % 10 < 5) { ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 6, 1, 5); ctx.fillRect(x - 3, y - 4, 5, 1); } return; }
    drawCoatPatch(s, false);
  } else if (s.kind === 'plaque') {
    if (s.done) { if (s.doneT < 60 && s.doneT % 10 < 5) { ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 6, 1, 5); ctx.fillRect(x - 3, y - 4, 5, 1); } return; }
    // crusty buildup piled against the tooth where it meets the gum
    if (!s.side) {                   // tartar crusted along the base of a tooth (seen from behind)
      for (let i = -3; i <= 3; i++) { const r = 4.6 - Math.abs(i) * 0.6, ly = y - r * 0.6 + Math.sin(t * 0.05 + i) * 0.3; circ(x + i * 4, ly, r + 1, '#7a5a1a'); circ(x + i * 4, ly, r, i % 2 ? '#e8cf6a' : '#f2dc78'); }
      ctx.fillStyle = '#a88a2a'; for (let i = -2; i <= 2; i++) ctx.fillRect(x + i * 5, y - 3 - (i & 1) * 2, 1, 1);
    } else {
    const dir = s.side, base = x + dir * 8;
    for (let i = 0; i < 6; i++) {
      const lx = base - dir * i * 3, r = 4.5 - i * 0.55, ly = y - r * 0.6 + Math.sin(t * 0.05 + i) * 0.3;
      circ(lx, ly, r + 1, '#7a5a1a'); circ(lx, ly, r, i % 2 ? '#e8cf6a' : '#f2dc78');
    }
    ctx.fillStyle = '#a88a2a'; for (let i = 0; i < 4; i++) ctx.fillRect(base - dir * (2 + i * 3), y - 3 - (i % 2) * 2, 1, 1);
    ctx.fillStyle = '#fff6c0'; ctx.fillRect(base - dir * 2, y - 6, 2, 1);
    }
  }
  // progress bar
  if (s.progress > 0) {
    ctx.fillStyle = '#1b0f2e'; ctx.fillRect(x - 13, y - 15, 26, 5);
    ctx.fillStyle = '#3dff6a'; ctx.fillRect(x - 12, y - 14, Math.round(24 * Math.min(1, s.progress / 100)), 3);
  } else if (G.levelIdx === 0) {
    // bouncing "!" marker so dirty spots are easy to find (Bite Club only: after the tutorial you know what to look for)
    const by = y - 24 + Math.round(Math.abs(Math.sin(t * 0.08)) * -4);
    circ(x, by + 4, 6, '#1b0f2e'); circ(x, by + 4, 5, s.kind === 'plaque' ? '#ffb000' : '#ff2e63');
    ctx.fillStyle = '#1b0f2e'; ctx.beginPath(); ctx.moveTo(x - 2, by + 8); ctx.lineTo(x + 2, by + 8); ctx.lineTo(x, by + 12); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, by + 1, 2, 4); ctx.fillRect(x - 1, by + 6, 2, 1);
  }
}
function drawPrompts() {
  const p = G.player;
  if (!p || G.state !== 'play') return;
  const s = p.grounded ? (G.spots.find(k => !k.done && k.near(p)) || G.nodes.find(n => n.usable() && n.near(p)) || G.coats.find(c => c.near(p))) : null;
  if (!s || p.cleaning) return;
  const label = 'HOLD ' + (document.body.classList.contains('touch') ? 'MED' : 'C');
  const x = Math.round(p.x + p.w / 2), y = Math.round(p.y - 14);
  ctx.font = '8px "Press Start 2P"';
  const w = ctx.measureText(label).width + 6;
  ctx.fillStyle = '#1b0f2e'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 12);
  ctx.fillStyle = G.t % 30 < 15 ? '#3dff6a' : '#ffffff'; ctx.fillRect(x - w / 2, y, w, 10);
  ptext(label, x, y + 1, '#1b0f2e', 8, 'center', false);
}

function drawNode(n) {
  if (!onScreen(n.x, n.y, 30)) return;
  const x = Math.round(n.x), y = Math.round(n.y), t = n.t, sick = n.ready, throb = Math.sin(t * 0.15) * 0.6;
  if (n.kind === 'root') {          // a raw, infected root patch (or freshly healed pink tissue)
    ell(x, y - 1, 10 + throb, 4 + throb * 0.5, sick ? '#3a0a2a' : '#c94a7a');
    ell(x, y - 1.5, 9 + throb, 3.2, sick ? '#8a1a4a' : '#ff9ab8');
    if (sick) { ctx.fillStyle = '#e8d36a'; ctx.fillRect(x - 5, y - 3, 2, 1); ctx.fillRect(x + 3, y - 2, 2, 1); ctx.fillStyle = '#c58bff'; ctx.fillRect(x - 1, y - 4, 1, 1); }
  } else {                          // a swollen, sore patch of tongue
    ell(x, y - 1, 11 + throb, 4.5 + throb * 0.5, sick ? '#8a0a2a' : '#e8406a');
    ell(x, y - 1.5, 10 + throb, 3.6, sick ? '#ff2e4a' : '#ffb3c6');
    if (sick) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3, y - 3, 1, 1); ctx.fillRect(x + 4, y - 3, 1, 1); }
  }
  if (!G.fight) return;
  if (n.progress > 0) {
    ctx.fillStyle = '#1b0f2e'; ctx.fillRect(x - 13, y - 15, 26, 5);
    ctx.fillStyle = n.kind === 'root' ? '#bff6ff' : '#7dffb0'; ctx.fillRect(x - 12, y - 14, Math.round(24 * Math.min(1, n.progress / 100)), 3);
  } else if (sick) {
    const by = y - 26 + Math.round(Math.abs(Math.sin(t * 0.08)) * -4);
    circ(x, by + 5, 8, '#1b0f2e'); circ(x, by + 5, 7, n.kind === 'root' ? '#2ce8f5' : '#3dff8a');
    ptext(n.kind === 'root' ? 'O2' : '+', x + 1, by + 1, '#1b0f2e', 8, 'center', false);
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y - 18, 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - n.cool / 380)); ctx.stroke();
  }
}
function drawBubble(b) {
  if (b.life < 120 && b.life % 8 < 4) return;
  const x = Math.round(b.x), y = Math.round(b.y), wob = Math.sin(b.t * 0.3) * 0.8;
  const o2 = b.kind === 'o2';
  ctx.fillStyle = o2 ? 'rgba(190,246,255,.35)' : 'rgba(125,255,176,.35)';
  ctx.beginPath(); ctx.ellipse(x, y, b.r + wob, b.r - wob, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = o2 ? '#e8fdff' : '#d8ffe8'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 5, y - 5, 3, 2); ctx.fillRect(x - 6, y - 3, 1, 2);
  if (o2) ptext('O2', x + 1, y - 3, '#0a5a8a', 8, 'center', false);
  else { ctx.save(); ctx.translate(x, y + 1); ctx.rotate(-0.5); ell(0, 0, 4.5, 2.5, '#0a8a4a'); ell(0, 0, 3.5, 1.8, '#3dff8a'); ctx.restore(); }
}
function drawDrop(d) {
  if (d.life < 120 && d.life % 8 < 4) return;
  if (d.kind === 'hp') { drawMint({ x: d.x, y: d.y - 2 }); return; }
  const x = Math.round(d.x), y = Math.round(d.y + Math.sin(G.t * 0.12) * 1.5);
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#1b0f2e'; ctx.fillRect(-5, -5, 10, 10);
  ctx.fillStyle = '#ff6fb1'; ctx.fillRect(-4, -4, 8, 8);
  ctx.fillStyle = '#ffd6ee'; ctx.fillRect(-4, -4, 3, 3);
  ctx.restore();
  if (G.t % 30 < 15) { ctx.fillStyle = '#fff'; ctx.fillRect(x + 6, y - 7, 1, 3); ctx.fillRect(x + 5, y - 6, 3, 1); }
}
/* Full-screen specials, drawn over the world in screen space. */
function drawSpecial() {
  const s = G.special; if (!s) return;
  const t = s.t, k = t / 84, info = SPECIALS[s.kind];
  if (!PIXMODE) { ptext(info.name, VW / 2, 30 + (t < 10 ? (10 - t) * -6 : 0), info.color, 16, 'center', '#1b0f2e'); return; }
  if (s.kind === 'floss') {                      // strands of floss whip across the whole screen
    for (let i = 0; i < 6; i++) {
      const head = (t - i * 4) * 14; if (head < 0) continue;
      const y0 = 20 + i * 34, slope = (i % 2 ? -1 : 1) * 30, fromLeft = i % 2 === 0;
      const xA = fromLeft ? -20 : VW + 20, xB = fromLeft ? Math.min(VW + 20, -20 + head) : Math.max(-20, VW + 20 - head);
      const wave = Math.sin(t * 0.5 + i) * 6;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,80,90,.4)';
      ctx.beginPath(); ctx.moveTo(xA, y0 + 2); ctx.quadraticCurveTo((xA + xB) / 2, y0 + slope / 2 + wave + 2, xB, y0 + slope * Math.abs(xB - xA) / VW + 2); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = '#e9fffb';
      ctx.beginPath(); ctx.moveTo(xA, y0); ctx.quadraticCurveTo((xA + xB) / 2, y0 + slope / 2 + wave, xB, y0 + slope * Math.abs(xB - xA) / VW); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = '#7ff0dc'; ctx.stroke();
      if (t < 50) circ(xB, y0 + slope * Math.abs(xB - xA) / VW, 3, '#ffffff');
    }
  } else if (s.kind === 'brush') {
    const x = -140 + k * (VW + 280), y = Math.round(VH * 0.58);
    for (let i = 0; i < 14; i++) circ(x - 30 - i * 14 + Math.sin(i * 2.1) * 6, y + Math.sin(i * 1.7 + t * 0.2) * 22, 5 + (i % 3) * 2, 'rgba(255,255,255,.75)');
    ctx.fillStyle = '#1b0f2e'; ctx.fillRect(x - 130, y - 9, 120, 18);
    ctx.fillStyle = '#2ce8f5'; ctx.fillRect(x - 128, y - 7, 116, 14);
    ctx.fillStyle = '#bff6ff'; ctx.fillRect(x - 124, y - 5, 108, 3);
    ctx.fillStyle = '#1b0f2e'; ctx.fillRect(x - 12, y - 16, 44, 30);
    ctx.fillStyle = '#e8eef8'; ctx.fillRect(x - 10, y - 14, 40, 26);
    for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? '#ffffff' : '#ff6fb1'; ctx.fillRect(x - 8 + i * 4, y - 40 + Math.sin(t * 0.8 + i) * 2, 3, 26); }
    if (t % 4 < 2) { ctx.fillStyle = '#ffe14d'; ctx.fillRect(x - 70, y - 22, 2, 8); ctx.fillRect(x - 40, y + 14, 2, 8); }
  } else if (s.kind === 'rinse') {
    const h = Math.sin(Math.min(1, k * 1.15) * Math.PI) * VH * 1.05;
    const top = VH - h;
    const grd = ctx.createLinearGradient(0, top, 0, VH); grd.addColorStop(0, 'rgba(120,240,255,.85)'); grd.addColorStop(1, 'rgba(20,120,220,.85)');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.moveTo(0, VH);
    for (let x = 0; x <= VW; x += 8) ctx.lineTo(x, top + Math.sin(x * 0.05 + t * 0.3) * 6);
    ctx.lineTo(VW, VH); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (let x = 0; x <= VW; x += 8) ctx.fillRect(x, Math.round(top + Math.sin(x * 0.05 + t * 0.3) * 6), 6, 2);
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) { const bx = (hash(i) * VW + t * (1 + hash(i + 4))) % VW, by = VH - ((t * 3 + hash(i + 9) * VH) % Math.max(1, h)); ctx.beginPath(); ctx.arc(bx, by, 2 + hash(i + 2) * 3, 0, Math.PI * 2); ctx.stroke(); }
  }
  if (t > 26 && t < 36) { ctx.fillStyle = 'rgba(255,255,255,' + (0.5 - Math.abs(t - 31) * 0.1) + ')'; ctx.fillRect(0, 0, VW, VH); }
}

function drawChasm() {
  // the cave falls away into darkness wherever there's no rock
  const g = ctx.createLinearGradient(0, 196 * WS, 0, 240 * WS);
  g.addColorStop(0, 'rgba(10,0,16,0)'); g.addColorStop(1, 'rgba(4,0,8,1)');
  ctx.fillStyle = g; ctx.fillRect(G.cam.x - 2, 196 * WS, VW + 4, G.cam.y + VH - 194 * WS);
  ctx.fillStyle = 'rgba(255,90,120,.5)';
  for (let i = 0; i < 10; i++) { const x = G.cam.x + ((hash(i) * VW + G.t * 0.2 * (hash(i + 3) - 0.5)) % VW + VW) % VW; ctx.fillRect(Math.round(x), Math.round((214 + hash(i + 7) * 20) * WS + Math.sin(G.t * 0.03 + i) * 2), 1, 1); }
}
/* Where the gum has pulled away between the last two molars: a dark pocket running down past their roots. */
function drawCrevice(ex) {
  const x0 = ex.x - 2 * WS, x1 = ex.x + ex.w + 2 * WS, b = G.cam.y + VH + 2, gy = 190 * WS;
  if (x1 < G.cam.x - 20 || x0 > G.cam.x + VW + 20) return;
  const g = ctx.createLinearGradient(0, gy, 0, b); g.addColorStop(0, '#5a1a3a'); g.addColorStop(0.3, '#1d0614'); g.addColorStop(1, '#000000');
  ctx.fillStyle = g; ctx.fillRect(x0, gy, x1 - x0, b - gy);
  // the bared roots of both teeth, crusted with a little tartar
  for (const [x, d] of [[x0, 1], [x1, -1]]) {
    const rg = ctx.createLinearGradient(0, gy, 0, gy + 70); rg.addColorStop(0, '#efe0b4'); rg.addColorStop(1, 'rgba(120,90,60,0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + d * 7, gy); ctx.quadraticCurveTo(x + d * 6, gy + 40, x + d * 2, gy + 74); ctx.lineTo(x, gy + 74); ctx.closePath(); ctx.fill();
    for (let k = 0; k < 4; k++) circ(x + d * (3 + hash(x + k) * 3), gy + 12 + k * 11 + hash(x * 3 + k) * 5, 1.6 + hash(k + x) * 1.2, 'rgba(214,180,80,.8)');
  }
}
/* Swollen, uneven gum lips hanging over the edges of the crevice (drawn over the teeth's gum collars). */
function drawCreviceLips(ex) {
  const x0 = ex.x - 2 * WS, x1 = ex.x + ex.w + 2 * WS, gy = 194 * WS;
  if (x1 < G.cam.x - 20 || x0 > G.cam.x + VW + 20) return;
  const lip = (x, d, seed) => {               // a swollen fold of gum rolling over the edge and sagging down the root
    const j = k => hash(seed + k * 3.7) * 3;
    ctx.beginPath(); ctx.moveTo(x - d * 12, gy - 1);
    ctx.quadraticCurveTo(x - d * 2, gy - 6 - j(1), x + d * (5 + j(2)), gy + 1);
    ctx.quadraticCurveTo(x + d * (8 + j(3)), gy + 6, x + d * (4 + j(4)), gy + 10);
    ctx.quadraticCurveTo(x + d * (7 + j(5)), gy + 15, x + d * (3 + j(6)), gy + 20 + j(7));
    ctx.quadraticCurveTo(x + d * (4 + j(8)), gy + 26, x, gy + 31 + j(9));
    ctx.lineTo(x - d * 12, gy + 34); ctx.closePath();
    const g = ctx.createLinearGradient(0, gy - 6, 0, gy + 34); g.addColorStop(0, '#ff9cc6'); g.addColorStop(0.35, '#e8457e'); g.addColorStop(1, '#a8285e');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#7a1a44'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,214,232,.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - d * 10, gy + 0.5); ctx.quadraticCurveTo(x - d * 1, gy - 3.5 - j(1), x + d * (3 + j(2)), gy + 1); ctx.stroke();
    ctx.fillStyle = 'rgba(122,26,68,.45)'; ctx.fillRect(Math.round(x + d * 2) - 1, Math.round(gy + 9), 2, 1); ctx.fillRect(Math.round(x + d * 1.5), Math.round(gy + 19), 2, 1);
  };
  lip(x0, 1, 3); lip(x1, -1, 11);
}
function drawTongue(T) {
  const x0 = Math.floor(G.cam.x) - 2, x1 = x0 + VW + 4, b = G.cam.y + VH + 2;
  const sy = x => tongueY(T, x, G.t) + dentAt(T, x);
  const g = ctx.createLinearGradient(0, 160 * WS, 0, 240 * WS);
  g.addColorStop(0, '#ff8aa6'); g.addColorStop(0.45, '#e23a66'); g.addColorStop(1, '#8a1238');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x0, b);
  for (let x = x0; x <= x1; x += 2) ctx.lineTo(x, sy(x));
  ctx.lineTo(x1, b); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#ffc6d4'; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let x = x0; x <= x1; x += 2) ctx.lineTo(x, sy(x) + 1.5);
  ctx.stroke();
  // taste buds along the top, muscle texture underneath
  for (let x = x0 - (x0 % 7); x <= x1; x += 7) {
    const h = hash(x * 0.37);
    circ(x, sy(x) + 3 + h * 3, 1.3, '#ffb6c9');
    if (h < 0.5) { ctx.fillStyle = '#c22a55'; ctx.fillRect(x, Math.round(sy(x) + 14 + h * 30), 3, 1); }
  }
  // surges show as a bright crest
  for (const q of T.pulses) { if (q.x < x0 - 30 || q.x > x1 + 30) continue; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.beginPath(); for (let x = q.x - 18 * WS; x <= q.x + 18 * WS; x += 2) ctx.lineTo(x, sy(x) - 1); ctx.stroke(); }
}
function drawUlcer(u) {
  const T = G.L.tongue; if (!T || !onScreen(u.x, 180 * WS, 30)) return;
  const cx = u.x + u.w / 2, y = Math.round(tongueY(T, cx, G.t) + dentAt(T, cx));
  ell(cx, y + 1, u.w / 2 + 3, 4, '#ff2e4a');
  ell(cx, y + 1, u.w / 2 + 1, 3, '#b3133f');
  ell(cx, y + 1, u.w / 2 - 2, 2, '#f6f0d0');
  if (G.t % 40 < 20) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(cx - 2), y, 2, 1); }
}
function drawCoatPatch(c, marker) {
  // furry white-yellow gunk on the tongue
  const x = Math.round(c.x), y = Math.round(c.y), t = c.t;
  for (let i = -3; i <= 3; i++) circ(x + i * 3.2, y - 1 + Math.abs(i) * 0.3, 3.6 - Math.abs(i) * 0.25, '#9a8a58');
  for (let i = -3; i <= 3; i++) circ(x + i * 3.2, y - 1.8 + Math.abs(i) * 0.3 + Math.sin(t * 0.07 + i) * 0.4, 2.8 - Math.abs(i) * 0.25, i % 2 ? '#f4ecd0' : '#e2d6a8');
  ctx.fillStyle = '#fffbe8'; for (let i = -2; i <= 2; i++) ctx.fillRect(x + i * 4, y - 5 - ((t / 10 + i) % 2), 1, 2);
  if (!marker) return;
  if (c.progress > 0) {
    ctx.fillStyle = '#1b0f2e'; ctx.fillRect(x - 13, y - 15, 26, 5);
    ctx.fillStyle = '#3dff6a'; ctx.fillRect(x - 12, y - 14, Math.round(24 * Math.min(1, c.progress / 100)), 3);
  } else if (G.levelIdx === 0 && t % 30 < 20) ptext('!', x - 3, y - 18, '#ffb000', 8);
}
function drawGem(g) {
  const x = Math.round(g.x), y = Math.round(g.y + Math.sin(G.t * 0.08 + g.x) * 1.5);
  ctx.fillStyle = '#0a5a8a'; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.quadraticCurveTo(x + 5, y, x + 4, y + 2); ctx.arc(x, y + 2, 4, 0, Math.PI); ctx.quadraticCurveTo(x - 5, y, x, y - 6); ctx.fill();
  ctx.fillStyle = '#2ce8f5'; ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.quadraticCurveTo(x + 4, y, x + 3, y + 2); ctx.arc(x, y + 2, 3, 0, Math.PI); ctx.quadraticCurveTo(x - 4, y, x, y - 5); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(x - 2, y, 1, 2);
}
function drawMint(m) {
  const x = Math.round(m.x), y = Math.round(m.y + Math.sin(G.t * 0.07) * 2);
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.5);
  ell(0, 0, 7, 4, '#0a6a3a'); ell(0, 0, 6, 3, '#3dff8a');
  ctx.fillStyle = '#0a6a3a'; ctx.fillRect(-5, 0, 10, 1);
  ctx.restore();
  if (G.t % 40 < 20) { ctx.fillStyle = '#fff'; ctx.fillRect(x + 6, y - 6, 1, 3); ctx.fillRect(x + 5, y - 5, 3, 1); }
}
function drawParticles() {
  for (const q of G.parts) {
    const a = q.life / q.max;
    if (q.wait > 0) continue;
    if (q.shape === 'sparkle') {     // a 16-bit twinkle: a plus that grows, flashes and shrinks away
      const f = 1 - q.life / q.max, r = [0, 1, 2, 3, 2, 1, 0][Math.min(6, Math.floor(f * 7))], x = Math.round(q.x), y = Math.round(q.y);
      ctx.fillStyle = q.color; ctx.fillRect(x - r, y, r * 2 + 1, 1); ctx.fillRect(x, y - r, 1, r * 2 + 1);
      if (r >= 2) { ctx.fillRect(x - 1, y - 1, 1, 1); ctx.fillRect(x + 1, y - 1, 1, 1); ctx.fillRect(x - 1, y + 1, 1, 1); ctx.fillRect(x + 1, y + 1, 1, 1); }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1);
      continue;
    }
    if (q.shape === 'ring') { ctx.strokeStyle = 'rgba(255,255,255,' + a + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(q.x, q.y, (1 - a) * 22, 0, Math.PI * 2); ctx.stroke(); continue; }
    if (q.shape === 'bubble') { ctx.strokeStyle = q.color; ctx.globalAlpha = a; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(q.x, q.y, 1.5 + (1 - a) * 1.5, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; continue; }
    if (q.shape === 'streak') { ctx.globalAlpha = Math.min(1, a * 1.5); ctx.fillStyle = q.color; ctx.fillRect(Math.round(q.x), Math.round(q.y), 7, 1); ctx.globalAlpha = 1; continue; }
    if (q.shape === 'stink') { ctx.globalAlpha = a * 0.8; ctx.fillStyle = q.color; ctx.fillRect(Math.round(q.x + Math.sin((q.max - q.life) * 0.2) * 2), Math.round(q.y), 1, 2); ctx.globalAlpha = 1; continue; }
    ctx.fillStyle = q.color; ctx.fillRect(Math.round(q.x), Math.round(q.y), q.size, q.size);
  }
}
function drawDarkness() {
  const p = G.player, px = p.x + p.w / 2 - G.cam.x, py = p.y + p.h / 2 - G.cam.y;
  const g = ctx.createRadialGradient(px, py, 40, px, py, 170);
  g.addColorStop(0, 'rgba(8,0,16,0)'); g.addColorStop(1, 'rgba(8,0,16,.82)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
}
function drawBanner() {
  if (G.banner <= 0 || G.banner >= 170 || (G.state !== 'play' && G.state !== 'pause')) return;   // waits for any opening dialogue
  const t = 170 - G.banner, slide = t < 15 ? (15 - t) * 20 : G.banner < 15 ? -(15 - G.banner) * 20 : 0;
  // the stripes sweep open as the name slides in, and close up again as it leaves
  const open = clamp(Math.min(t / 12, G.banner / 12), 0, 1), e = open * open * (3 - 2 * open);
  const y = Math.round(VH * 0.36), bw = VW * e, bx = (VW - bw) / 2, bh = 34 * (0.4 + 0.6 * e);
  ctx.fillStyle = 'rgba(10,4,24,' + (0.78 * e) + ')'; ctx.fillRect(bx, y + 17 - bh / 2, bw, bh);
  ctx.fillStyle = '#ff2e63'; ctx.fillRect(bx, y + 17 - bh / 2, bw, 2); ctx.fillStyle = '#2ce8f5'; ctx.fillRect(bx, y + 15 + bh / 2, bw, 2);
  ptext(G.L.def.tag, VW / 2 + slide, y + 6, '#ffcc00', 8, 'center');
  ptext(G.L.name, VW / 2 - slide, y + 18, '#ffffff', 8, 'center');
}
