'use strict';
/* ============================== LAYOUT: fit any screen ==============================
   The view is always VH world pixels tall; its width (VW_MIN-VW_MAX) follows the screen's shape, so
   wide screens see more level and tall phones get a taller view instead of a thin letterbox strip.
   On a portrait touch screen the controls get their own band under the game.
   The canvas itself is drawn at the screen's real resolution (RS device pixels per game pixel), so text
   and edges stay sharp at any size; the pixel-art sprites are scaled up with smoothing off. */
const cvs = $('game'), stage = $('stage');
let ctx = cvs.getContext('2d');                 // whatever is being drawn on right now (the screen, or the pixel layer)
const screenCtx = ctx;
function layout() {
  const W = window.innerWidth, H = window.innerHeight;
  const touch = document.body.classList.contains('touch');
  const portrait = H > W;
  document.body.classList.toggle('portrait', touch && portrait);
  document.body.classList.toggle('landscape', touch && !portrait);
  const pad = $('touch');
  let availH = H, band = 0;
  if (touch && portrait) {
    const b = clamp(W * 0.17, 58, 92);
    band = Math.round(b * 2.15 + 28);
    availH = H - band;
    pad.style.setProperty('--b', b + 'px');
  } else pad.style.removeProperty('--b');
  const aspect = clamp(W / availH, VW_MIN / VH, VW_MAX / VH);
  let w = Math.min(W, availH * aspect), h = w / aspect;
  if (h > availH) { h = availH; w = h * aspect; }
  w = Math.floor(w); h = Math.floor(h);
  // portrait phones: the game and its controls sit together as one centered block
  const groupTop = Math.max(0, (H - h - band) / 2);
  stage.style.width = w + 'px'; stage.style.height = h + 'px';
  stage.style.top = (band ? groupTop + h / 2 : H / 2) + 'px';
  pad.style.bottom = band ? Math.max(0, H - groupTop - h - band) + 'px' : '';
  pad.style.height = band ? band + 'px' : '';
  VW = Math.round(VH * aspect);
  CSSPX = h / VH;
  const dpr = window.devicePixelRatio || 1;
  RS = Math.max(1, Math.min(h * dpr / VH, Math.sqrt(4.5e6 / (VW * VH))));     // cap the canvas around 4.5 megapixels
  const cw = Math.round(VW * RS), ch = Math.round(VH * RS);
  if (cvs.width !== cw || cvs.height !== ch) { cvs.width = cw; cvs.height = ch; }
  stage.classList.toggle('narrow', VW < 330);
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => setTimeout(layout, 120));
layout();
