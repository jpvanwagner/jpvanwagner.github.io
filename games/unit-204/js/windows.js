'use strict';
/* ============================== WINDOWS & BIRDS ==============================
   Every window in the unit can be looked at up close. The bedroom window is a checklist feature; the kitchen window
   (over the sink) and the little frosted one in the bathroom are just views: you can look, touch, and photograph
   them, but there's nothing to write up, so they never land on the form or the report.
   Look long enough and a bird turns up: one flaps across the sky in the distance, or lands on the outside sill,
   pecks around, and flies off. Photograph it for an achievement (through the frosted glass, it's a blur, which is
   its own achievement). */
const VIEWS = {
  kwindow: { id: 'kwindow', room: 'kitchen', name: 'Kitchen Window', art: 'kwindow', view: true,
    parts: [{ id: 'valance', name: 'valance', r: [34, 0, 172, 22] }, { id: 'latch', name: 'latch', r: [108, 54, 24, 10] }, { id: 'osill', name: 'outside ledge', r: [46, 92, 148, 12] }, { id: 'glass', name: 'glass', r: [46, 22, 148, 70] }, { id: 'isill', name: 'windowsill', r: [36, 104, 168, 10] }],
    base: {
      glass: { look: 'The parking lot, a green dumpster, a lamppost, and a strip of sky. The view of a person who does dishes.', touch: 'Cool glass, a little greasy from years of steam off the sink.', smell: 'Dish soap and window cleaner.', talk: 'You tell the parking lot it looks nice today. It does not.', flashlight: 'Your own reflection, holding a flashlight.' },
      latch: { touch: { t: 'The latch turns and catches. It locks fine.', sfx: 'click' }, look: 'A white sash lock, locked.' },
      osill: { look: 'A concrete ledge outside the glass. Popular with birds, judging by the evidence.', touch: "It's on the other side of the glass." },
      isill: { look: 'A narrow sill with a ring where a little plant used to sit.', touch: 'Dry. A few crumbs of potting soil.', smell: 'Faintly of basil, from memory.' },
      valance: { look: 'A rust-orange valance, very 2008. It stays with the unit, sadly.', touch: 'Stiff with kitchen grease. You wipe your fingers on your pants.', smell: 'Every meal ever cooked in here, at once.' }
    },
    variants: [{ cat: 0, desc: 'The window over the sink, with a rust-orange valance. Outside: the parking lot.', key: [], resp: {}, why: '' }] },
  bwindow: { id: 'bwindow', room: 'bath', name: 'Bathroom Window', art: 'bwindow', view: true, frosted: true,
    parts: [{ id: 'crank', name: 'latch', r: [110, 92, 20, 10] }, { id: 'glass', name: 'frosted glass', r: [66, 26, 108, 66] }, { id: 'isill', name: 'windowsill', r: [56, 92, 128, 12] }],
    base: {
      glass: { look: "Frosted glass: light, shapes, and nothing else. That's the point of it.", touch: 'Bumpy, like a shower door. Cold.', smell: 'Mildew-resistant caulk and a hint of lavender air freshener.', talk: 'Hello? The frosted glass keeps its secrets.', flashlight: 'The beam scatters into a soft white glow.' },
      crank: { touch: { t: 'The latch flips open and shut. Works.', sfx: 'click' }, look: 'A little latch at the bottom of the frame.' },
      isill: { look: 'A tiled sill, high over the tub. A dusty fake fern used to live here; you can see its outline.', touch: 'Dusty, and dry.', smell: 'Dust, and a ghost of lavender.' }
    },
    variants: [{ cat: 0, desc: 'A small frosted window, high over the tub.', key: [], resp: {}, why: '' }] }
};
for (const v of Object.values(VIEWS)) FEATURE[v.id] = v;           // close-ups only: never in FEATURES, so never dealt, marked, or graded
ROOMS.kitchen.features.kwindow = { pts: () => Q.back(ROOMS.kitchen.box, -.85, 1.45, 1.5, 3.05), walk: { x: .3, z: 10.2 } };
ROOMS.bath.features.bwindow = { pts: () => Q.back(ROOMS.bath.box, -2.9, -1.3, 2.7, 3.45), walk: { x: -1.6, z: 9 } };
const isView = fid => !!(FEATURE[fid] && FEATURE[fid].view);

/* ---------- birds ---------- */
const BIRD_KINDS = [
  { name: 'sparrow', b: '#8a6a48', w: '#5e4630', u: '#d8c4a0', y: '#e8b040' },
  { name: 'cardinal', b: '#d43a2a', w: '#9a2418', u: '#e8604a', y: '#f2a040' },
  { name: 'blue jay', b: '#4a7ad0', w: '#2c4f9a', u: '#e8ecf0', y: '#2a2a30' },
  { name: 'pigeon', b: '#8a909c', w: '#6a707c', u: '#b8bcc8', y: '#3a3a40' },
  { name: 'robin', b: '#6a625a', w: '#4a443e', u: '#d8742a', y: '#e8c040' }
];
const BIRD_ART = {
  sit: ['......bb.', '.....bkby', 'w...bbbb.', 'ww.wwbuu.', '.wwwwuuu.', '..wwuuu..', '....l.l..'],
  peck: ['.........', '.........', 'w...bb...', 'ww.wwbbb.', '.wwwwbkby', '..wwuuu..', '....l.l..'],
  up: ['...ww....', '....ww...', 'wbbbbbbky', '..uuuu...'],
  down: ['.........', 'wbbbbbbky', '..uuuww..', '.....ww..']
};
/* where birds go in each window's close-up: a band of sky to fly across, and the outside sill to land on */
const BIRD_SPOTS = {
  window: { sky: [36, 204, 10, 40], perch: [52, 188, 91] },
  kwindow: { sky: [46, 194, 26, 50], perch: [60, 180, 93] },
  bwindow: { sky: [66, 174, 30, 56], perch: [76, 164, 90], blur: true }
};
const Birds = {
  st: {},
  /* the current bird at this window (or null), advancing its little life on the clock */
  at(fid, t) {
    const sp = BIRD_SPOTS[fid]; if (!sp) return null;
    let s = this.st[fid];
    if (!s || t < s.t0 - 30) s = this.st[fid] = { next: t + 2 + Math.random() * 3, bird: null, t0: t };   // first one soon after you look
    if (s.bird && t > s.bird.end) { s.bird = null; s.next = t + 4 + Math.random() * 7; }
    if (!s.bird && t >= s.next && !(Decor.time && Decor.time.rain && Math.random() < .5)) {
      const kind = pick(BIRD_KINDS), dir = Math.random() < .5 ? 1 : -1, perch = Math.random() < .45;
      s.bird = perch
        ? { perch: true, kind, dir, t0: t, px: sp.perch[0] + Math.random() * (sp.perch[1] - sp.perch[0]), stay: 5 + Math.random() * 5, end: t + 1 + 6 + Math.random() * 5 }
        : { perch: false, kind, dir, t0: t, y: sp.sky[2] + Math.random() * (sp.sky[3] - sp.sky[2]), dur: 2.6 + Math.random() * 1.6 };
      if (!perch) s.bird.end = t + s.bird.dur;
      if (perch) s.bird.end = t + 1 + s.bird.stay + 1;
      s.t0 = t;
    }
    return s.bird;
  },
  /* where the bird is and how it looks right now: { x, y, frame, flip, s } or null */
  pose(fid, t) {
    const b = this.at(fid, t), sp = BIRD_SPOTS[fid]; if (!b) return null;
    const flap = Math.floor(t * 8) % 2 ? 'up' : 'down';
    if (!b.perch) { const k = (t - b.t0) / b.dur, x0 = b.dir > 0 ? sp.sky[0] - 10 : sp.sky[1] + 10, x1 = b.dir > 0 ? sp.sky[1] + 10 : sp.sky[0] - 10;
      return { x: x0 + (x1 - x0) * k, y: b.y + Math.sin(k * 9) * 2, frame: flap, flip: b.dir < 0, s: 1 }; }
    const e = t - b.t0, py = sp.perch[2], from = b.px - b.dir * 70;
    if (e < 1) { const k = e; return { x: from + (b.px - from) * k, y: py - 40 * (1 - k) * (1 - k) - 4 * Math.sin(k * Math.PI), frame: flap, flip: b.dir < 0, s: 2 }; }      // gliding in
    if (e < 1 + b.stay) {                                                 // on the sill: a hop now and then, and a peck
      const q = e - 1, hop = Math.floor(q / 1.7), dx = Math.round(hash(hop + b.px) * 8 - 4), pecking = (q % 1.7) > 1.2;
      return { x: b.px + dx, y: py, frame: pecking ? 'peck' : 'sit', flip: (hop % 3 === 2) ? b.dir > 0 : b.dir < 0, s: 2, sitting: true };
    }
    const k = e - 1 - b.stay; return { x: b.px + b.dir * k * 80, y: py - 46 * k * k - 6 * k, frame: flap, flip: b.dir < 0, s: 2 };   // and off it goes
  },
  draw(g, fid, t) {
    const p = this.pose(fid, t); if (!p) return;
    const rows = BIRD_ART[p.frame], K = (this.at(fid, t) || {}).kind || BIRD_KINDS[0], pal = { b: K.b, w: K.w, u: K.u, y: K.y, k: '#14121a', l: '#6a5040' };
    const blur = BIRD_SPOTS[fid].blur, w = rows[0].length, h = rows.length, x0 = Math.round(p.x - w * p.s / 2), y0 = Math.round(p.y - h * p.s);
    g.save();
    if (blur) { g.globalAlpha = .28; }                                    // behind frosted glass: a soft bird-shaped smudge
    for (const [ox, oy] of blur ? [[-1, 0], [1, 0], [0, -1], [0, 1], [0, 0]] : [[0, 0]])
      rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '.') return; const xi = p.flip ? w - 1 - i : i; g.fillStyle = blur ? '#5a5a66' : pal[ch]; g.fillRect(x0 + xi * p.s + ox * 2, y0 + j * p.s + oy * 2, p.s, p.s); }));
    g.restore();
  },
  /* is there a bird in frame at this window right now? */
  visible(fid, t) { const p = this.pose(fid, t), sp = BIRD_SPOTS[fid]; return !!p && p.x > sp.sky[0] && p.x < sp.sky[1]; },
  kind(fid, t) { const b = this.at(fid, t); return b ? b.kind.name : null; },
  reset() { this.st = {}; }
};

/* ---------- the two new close-ups ---------- */
ZOOM_ART.kwindow = (g, v, fl, t) => {
  Z.wall(g, 0, 0, ZW, ZH, Decor.zoomWall('kitchen'), 14);
  const T = Decor.time, sky = g.createLinearGradient(0, 22, 0, 92); sky.addColorStop(0, T.sky[0]); sky.addColorStop(.7, T.sky[1]); sky.addColorStop(1, T.sky[2]);
  pxRect(g, 40, 16, 160, 94, '#f4f4f0');                                                  // the frame
  g.fillStyle = sky; g.fillRect(46, 22, 148, 70);
  pxRect(g, 132, 40, 62, 52, '#9a8a7a'); for (let y = 46; y < 88; y += 9) for (let x = 136; x < 192; x += 11) pxRect(g, x, y, 6, 5, T.sun ? '#d8d0b8' : '#f3e2b0');   // the next building over
  pxRect(g, 46, 74, 148, 18, '#5a5e66'); speckle(g, 46, 74, 148, 18, 'rgba(255,255,255,0.08)', 60, 3);                   // the parking lot
  for (const x of [62, 92, 122, 152, 182]) pxLine(g, x, 76, x - 6, 92, '#d8dce0');
  pxRect(g, 98, 66, 22, 12, '#2f6a3a'); pxRect(g, 98, 66, 22, 2, '#3f8a4a'); pxRect(g, 100, 78, 2, 2, '#1a1a1a'); pxRect(g, 116, 78, 2, 2, '#1a1a1a');   // a green dumpster
  pxLine(g, 76, 34, 76, 80, '#4a4e58', 2); pxRect(g, 72, 32, 10, 3, '#4a4e58'); pxRect(g, 74, 35, 6, 1, T.sun ? '#c8ccd2' : '#ffe9a0');   // a lamppost
  const sway = Settings.get('motion') ? Math.sin(t * .8) * 2 : 0;
  for (let i = 0; i < 4; i++) foliage(g, 48 + hash(i + 3) * 30, 28 + hash(i + 8) * 20, 14 + hash(i) * 6, 10 + hash(i + 2) * 4, Decor.pal('kitchen').leaves || ['#3f7a3a', '#5a9a4a', '#2f5a2a'], 40 + i * 9, sway);
  if (T.rain) for (let i = 0; i < 30; i++) { const rx = 46 + hash(i) * 148, ry = 22 + ((hash(i * 3) * 70 + t * 70) % 70); pxLine(g, rx, ry, rx - 1, Math.min(91, ry + 5), 'rgba(220,232,245,0.75)'); }
  pxRect(g, 46, 92, 148, 6, '#b8b4aa'); pxRect(g, 46, 92, 148, 1, '#d8d4ca'); speckle(g, 50, 93, 140, 4, 'rgba(255,255,255,0.5)', 10, 8);   // the concrete ledge outside
  Birds.draw(g, 'kwindow', t);                                    // in front of the ledge, so a bird can land on it
  pxRect(g, 40, 54, 160, 6, '#f4f4f0'); pxRect(g, 40, 59, 160, 1, '#c8ccd2'); pxRect(g, 112, 52, 16, 4, '#d9dce4'); pxRect(g, 116, 51, 8, 2, '#b9bcc4');   // the meeting rail and its sash lock
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.moveTo(60, 22); g.lineTo(80, 22); g.lineTo(52, 92); g.lineTo(46, 92); g.fill();   // a glint on the glass
  pxRect(g, 36, 104, 168, 8, '#ffffff'); pxRect(g, 36, 111, 168, 2, '#c8ccd2'); pxEllipse(g, 160, 107, 8, 2, 'rgba(120,90,60,0.25)');   // the inside sill, with the ring from a plant
  pxRect(g, 0, 113, ZW, 22, '#d8cfb8'); for (let x = 0; x < ZW; x += 18) pxRect(g, x, 113, 1, 22, '#cbc1a8');                            // backsplash
  // the valance: rust-orange, gathered, with a scalloped edge
  pxRect(g, 34, 2, 172, 16, '#c2603a'); for (let x = 34; x < 206; x += 8) { pxRect(g, x, 2, 1, 16, '#a84e2c'); pxEllipse(g, x + 4, 18, 4, 3, '#c2603a'); }
  pxRect(g, 34, 2, 172, 1, '#d8784e');
  Z.vignette(g);
};
ZOOM_ART.bwindow = (g, v, fl, t) => {
  Z.wall(g, 0, 0, ZW, ZH, Decor.zoomWall('bath'), 21);
  pxRect(g, 0, 104, ZW, 31, '#f4f4f0'); for (let y = 104; y < ZH; y += 10) pxRect(g, 0, y, ZW, 1, '#d8dcdc'); for (let x = 6; x < ZW; x += 20) pxRect(g, x, 104, 1, 31, '#d8dcdc');   // tile, above the tub
  pxRect(g, 60, 20, 120, 84, '#f4f4f0');                                                   // the frame
  const T = Decor.time, gl = g.createLinearGradient(0, 26, 0, 92); gl.addColorStop(0, T.sky[1]); gl.addColorStop(1, T.sky[2]);
  g.fillStyle = gl; g.fillRect(66, 26, 108, 66);
  g.fillStyle = 'rgba(70,110,70,0.25)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(80 + hash(i) * 80, 40 + hash(i + 4) * 30, 16, 11, 0, 0, 7); g.fill(); }   // a tree, out of focus
  Birds.draw(g, 'bwindow', t);
  g.fillStyle = 'rgba(244,246,248,0.55)'; g.fillRect(66, 26, 108, 66); speckle(g, 66, 26, 108, 66, 'rgba(255,255,255,0.6)', 500, 5); speckle(g, 66, 26, 108, 66, 'rgba(160,170,180,0.3)', 200, 6);   // the frosting
  pxRect(g, 56, 92, 128, 10, '#ffffff'); pxRect(g, 56, 101, 128, 2, '#c8ccd2'); g.fillStyle = 'rgba(120,120,110,0.12)'; g.fillRect(132, 93, 22, 7);   // the sill, with a clean patch where a fake fern stood
  pxRect(g, 114, 94, 12, 4, '#d9dce4'); pxRect(g, 116, 93, 8, 2, '#b9bcc4');
  Z.vignette(g);
};
/* the bedroom window gets birds too: its art calls Birds.draw('window') between the view and the frame */
