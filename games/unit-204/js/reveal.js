'use strict';
/* ============================== SHOW EVERYTHING ==============================
   The sparkle on the toolbar (or H) briefly outlines everything you can look at or use, in the room or in the
   close-up you're in: a pulse of light around each thing, fading out over a couple of seconds, so nothing gets
   missed just because it blends into the wall. */
const REVEAL_SECS = 2.4;
const Reveal = {
  t0: -99,
  go() { this.t0 = performance.now() / 1000; Audio2.synth('blip'); if (!UI.isOpen('inspectScreen')) Game.tell('You take a slow look around the room.'); },
  /* 0 when off, rising quickly then fading */
  level() { const e = performance.now() / 1000 - this.t0; if (e < 0 || e > REVEAL_SECS) return 0; return Math.min(1, e / .2) * Math.min(1, (REVEAL_SECS - e) / .8); },
  pulse() { return .65 + .35 * Math.sin((performance.now() / 1000 - this.t0) * 9); },
  drawRoom(g, hots) {
    const k = this.level(); if (!k) return;
    g.save();
    for (const h of hots) {
      const p = growPoly(h.pts, 1.5);
      fillPoly(g, p, `rgba(255,236,170,${(.22 * k).toFixed(3)})`);
      g.setLineDash([]); strokePoly(g, growPoly(h.pts, 2.5), `rgba(30,20,40,${(.55 * k).toFixed(3)})`);   // a dark edge outside the light one, so it shows on any wall
      strokePoly(g, p, isExit(h) ? `rgba(120,220,255,${(k * this.pulse()).toFixed(3)})` : `rgba(255,245,150,${(k * this.pulse()).toFixed(3)})`);   // ways out in cyan, like their hover outline
    }
    g.restore();
  },
  drawZoom(g, parts) {
    const k = this.level(); if (!k) return;
    g.save();
    for (const p of parts) {
      const [x, y, w, h] = p.r; if (w * h > ZW * ZH * .8) continue;            // skip the 'whole wall' background parts
      g.fillStyle = `rgba(255,236,170,${(.14 * k).toFixed(3)})`; g.fillRect(x, y, w, h);
      g.strokeStyle = `rgba(255,240,150,${(.95 * k * this.pulse()).toFixed(3)})`; g.lineWidth = 1; g.strokeRect(x - .5, y - .5, w + 1, h + 1);
    }
    g.restore();
  }
};
