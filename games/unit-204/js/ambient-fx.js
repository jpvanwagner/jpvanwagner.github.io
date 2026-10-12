'use strict';
/* ============================== AMBIENT TOUCHES ==============================
   Small live effects the newer sites share, so their rooms feel lived in the way the apartment does: rain falling
   across an outdoor area (with splashes on the ground) on a rainy shift, a bird crossing the sky now and then, dust
   motes drifting under a light, exhaust puffing from an idling machine, and soft contact shadows under heavy things
   (tinted by the time of day, so they sit in the scene instead of floating on it). Every moving one respects the
   Ambient animation setting. Sites call these from their walls() (shadows, cached) and dynamic() (the rest). */
const AmbFX = {
  moving() { return Settings.get('motion'); },
  /* a soft shadow on the floor under something standing there (call before drawing the thing) */
  shadow(g, xa, xb, za, zb, k = 1) {
    const sh = Decor.time.shadow, cx = (xa + xb) / 2, cz = (za + zb) / 2, rx = (xb - xa) / 2 + .25, rz = (zb - za) / 2 + .2;
    fillPoly(g, floorEllipse(cx, cz, rx, rz, 18), rgba(sh, .16 * k)); fillPoly(g, floorEllipse(cx, cz, rx * .8, rz * .75, 16), rgba(sh, .14 * k));
  },
  /* rain over an outdoor area: streaks, and little splashes on the ground */
  rain(g, t) {
    if (!Decor.time.rain) return;
    const mo = this.moving(), n = mo ? 90 : 40;
    g.fillStyle = 'rgba(220,230,245,0.45)';
    for (let i = 0; i < n; i++) { const x = (hash(i) * (SW + 60) + (mo ? t * 40 : 0)) % (SW + 60) - 30, y = (hash(i + 77) * SH + (mo ? t * 260 * (.8 + hash(i + 5) * .4) : 0)) % SH;
      for (let k = 0; k < 5; k++) g.fillRect(Math.round(x + k * .5), Math.round(y + k), 1, 1); }
    if (mo) for (let i = 0; i < 14; i++) { const k = (t * 3 + hash(i) * 7) % 1, x = hash(i + 9) * SW, y = CAM.hy + 30 + hash(i + 19) * (SH - CAM.hy - 30); if (k < .3) pxRect(g, x - 1, y, 3, 1, 'rgba(230,240,255,0.5)'); }
  },
  /* a bird crossing the sky every so often (a little V, flapping) */
  birds(g, t, seed = 0) {
    if (!this.moving() || Decor.time.rain) return;
    const period = 23 + seed % 7, k = ((t + seed * 5) % period) / 9; if (k > 1) return;
    const x = -10 + k * (SW + 20), y = 18 + (seed % 5) * 6 + Math.sin(k * 9) * 3, up = Math.floor(t * 6) % 2;
    pxRect(g, x, y, 1, 1, '#2a2c32'); pxRect(g, x - 2, y - up, 2, 1, '#2a2c32'); pxRect(g, x + 1, y - up, 2, 1, '#2a2c32');
  },
  /* dust drifting in the light under a fixture at (x, z), from height y down */
  motes(g, t, x, z, y = 5.4, n = 6) {
    if (!this.moving()) return;
    for (let i = 0; i < n; i++) { const yy = y - ((t * .12 + hash(i + x * 3)) % 1) * (y - .6), xx = x + Math.sin(t * .6 + i * 2) * .5 + (hash(i * 7 + z) - .5) * 1.2, p = P(xx, yy, z + (hash(i + 3) - .5)); pxRect(g, p[0], p[1], 1, 1, 'rgba(255,248,220,0.55)'); }
  },
  /* exhaust puffing up from a stack at screen point p */
  exhaust(g, t, p, dark = false) {
    if (!this.moving()) return;
    for (let i = 0; i < 4; i++) { const k = (t * .9 + i * .25) % 1, r = 1 + k * 3; pxEllipse(g, p[0] + k * 6 + Math.sin(t * 2 + i) * 2, p[1] - k * 16, r, r * .8, dark ? `rgba(70,70,74,${.5 * (1 - k)})` : `rgba(200,200,204,${.45 * (1 - k)})`); }
  },
  /* everything an open-air area gets every frame */
  outdoor(g, t, seed) { this.birds(g, t, seed); this.rain(g, t); }
};
