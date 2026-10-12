'use strict';
/* ============================== SHARP PIXEL SCALING ==============================
   Pixel art scaled by a fraction (a 160-pixel picture shown 518 pixels wide) comes out with uneven pixels: some art
   pixels become 3 screen pixels, some 4. This fixes that everywhere, the way emulators do ("sharp bilinear"):
   every canvas in the game keeps drawing at its own small resolution, and once a frame each visible one is copied
   into its on-screen self at the smallest whole-number enlargement that covers its size, hard-edged; the browser
   then shrinks that by the small leftover fraction, smoothly. Every art pixel ends up the same size, edges stay crisp.
   How: each canvas gets a hidden low-res twin. Its getContext() and width/height answer for the twin (so the rest of
   the game never notices), while the real element holds the enlarged copy. Loaded right after util.js, before
   anything grabs a drawing context. */
const Crisp = {
  list: [],
  W: Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width'),
  H: Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height'),
  getCtx: HTMLCanvasElement.prototype.getContext,
  attach(el) {
    if (el._crisp || el.classList.contains('no-crisp')) return;
    const lo = document.createElement('canvas'); lo.width = this.W.get.call(el); lo.height = this.H.get.call(el);
    try { if (lo.width && lo.height) lo.getContext('2d').drawImage(el, 0, 0); } catch (e) { /* nothing drawn yet */ }
    el._crisp = { lo, ctx: this.getCtx.call(el, '2d'), k: 0 };
    el.getContext = (type, opts) => lo.getContext(type, opts);
    Object.defineProperty(el, 'width', { configurable: true, get: () => lo.width, set: v => { lo.width = v; } });
    Object.defineProperty(el, 'height', { configurable: true, get: () => lo.height, set: v => { lo.height = v; } });
    el.style.imageRendering = 'auto';                            // the final, fractional step is smooth on purpose
    this.list.push(el);
  },
  /* the low-res canvas the game draws into, for anything that wants to copy it (screenshots, tests) */
  lo(el) { return el._crisp ? el._crisp.lo : el; },
  frame() {
    for (const el of document.querySelectorAll('#game canvas')) if (!el._crisp) this.attach(el);   // canvases added since (bag slots, medals...)
    const dpr = window.devicePixelRatio || 1;
    this.list = this.list.filter(el => el.isConnected);
    for (const el of this.list) {
      if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;   // hidden: nothing to copy
      const c = el._crisp, lo = c.lo; if (!lo.width || !lo.height) continue;
      const r = el.getBoundingClientRect(); if (!r.width) continue;
      const k = Math.max(1, Math.min(12, Math.ceil(r.width * dpr / lo.width - .02), Math.floor(4096 / lo.width)));
      if (k !== c.k || this.W.get.call(el) !== lo.width * k || this.H.get.call(el) !== lo.height * k) { c.k = k; this.W.set.call(el, lo.width * k); this.H.set.call(el, lo.height * k); }
      c.ctx.imageSmoothingEnabled = false; c.ctx.clearRect(0, 0, lo.width * k, lo.height * k); c.ctx.drawImage(lo, 0, 0, lo.width * k, lo.height * k);
    }
    requestAnimationFrame(() => this.frame());
  },
  init() { for (const el of document.querySelectorAll('canvas')) this.attach(el); requestAnimationFrame(() => this.frame()); }
};
Crisp.init();
