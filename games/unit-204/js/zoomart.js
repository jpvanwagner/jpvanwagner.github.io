'use strict';
/* ============================== CLOSE-UP ART ==============================
   Each feature's close-up is drawn at 240x135 with hard pixels. art[id](g, v, fl, t): v = condition index,
   fl = flags set by your actions (each holds the time it was set), t = seconds (for ambient animation). */
const Z = {
  wall(g, x, y, w, h, base, seed) { pxRect(g, x, y, w, h, base); speckle(g, x, y, w, h, 'rgba(0,0,0,0.06)', w * h / 18, seed); speckle(g, x, y, w, h, 'rgba(255,255,255,0.08)', w * h / 22, seed + 7); },
  popcorn(g, base = '#ece6d8') { pxRect(g, 0, 0, ZW, ZH, base); speckle(g, 0, 0, ZW, ZH, '#d6cebd', 900, 3); speckle(g, 0, 0, ZW, ZH, '#fbf8f0', 700, 9); },
  sunbeam(g, x, w, lvl = 3) { if (!Decor.time.sun) return; g.fillStyle = dither(Decor.time.sun, lvl); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, 0); g.lineTo(x + w - 70, ZH); g.lineTo(x - 70, ZH); g.fill(); },
  vignette(g) {
    g.fillStyle = dither('#000000', 3); g.fillRect(0, 0, ZW, 3); g.fillRect(0, ZH - 3, ZW, 3); g.fillRect(0, 0, 3, ZH); g.fillRect(ZW - 3, 0, 3, ZH);
    g.fillStyle = dither('#000000', 1); g.fillRect(3, 3, ZW - 6, 4); g.fillRect(3, ZH - 7, ZW - 6, 4);
  },
  plate(g, x, y, w, h, c = '#f1ece0') { pxRect(g, x - 1, y - 1, w + 2, h + 2, '#8b8574'); pxRect(g, x, y, w, h, c); pxRect(g, x, y, w, 1, '#ffffff'); pxRect(g, x, y + h - 1, w, 1, '#cfc8b6'); },
  screw(g, x, y) { pxEllipse(g, x, y, 1, 1, '#9a9a92'); pxRect(g, x - 1, y, 3, 1, '#5a5a52'); },
  dripY(t, period, len) { return ((t % period) / period) * len; }
};
const ZOOM_ART = {
  carpet(g, v, fl, t) {
    const cf = Decor.pal('living').floor; pxRect(g, 0, 0, ZW, ZH, cf.base); speckle(g, 0, 0, ZW, ZH, cf.dk, 2600, 1); speckle(g, 0, 0, ZW, ZH, cf.lt, 1900, 2);
    pxRect(g, 150, 0, 90, 6, '#efe9dc'); pxRect(g, 150, 6, 90, 1, '#a89c86');                     // baseboard by the window
    g.fillStyle = Decor.time.sun ? dither(Decor.time.sun, 4) : 'rgba(0,0,0,0)'; g.beginPath(); g.moveTo(40, 0); g.lineTo(150, 0); g.lineTo(120, 92); g.lineTo(0, 92); g.fill();   // window light
    g.fillStyle = dither('#7d6b4c', 5); g.fillRect(92, 0, 5, 92); g.fillRect(0, 44, 140, 4);              // window frame shadow
    if (v === 0) for (let x = 0; x < ZW; x += 24) { g.fillStyle = dither('#efe0bb', 4); g.fillRect(x, 0, 12, ZH); }
    if (v === 1) { g.fillStyle = dither('#857a66', 7); g.fillRect(36, 96, 168, 39); g.fillStyle = dither('#857a66', 4); g.fillRect(28, 96, 184, 39); speckle(g, 40, 98, 160, 36, '#6f6554', 300, 5); }
    if (v === 2) {
      g.fillStyle = dither('#8a7650', 3); g.beginPath(); g.ellipse(117, 62, 52, 33, 0, 0, 7); g.fill();
      pxEllipse(g, 117, 62, 36, 23, '#8a7650'); pxEllipse(g, 115, 61, 30, 18, '#77633f'); pxEllipse(g, 112, 60, 18, 11, '#6a5634');
      speckle(g, 82, 42, 70, 40, '#5a4a2c', 140, 8); speckle(g, 70, 30, 95, 60, '#9a8660', 120, 12);
    }
    if (v === 3) for (const [x, y] of [[186, 24], [202, 34], [216, 20]]) { pxEllipse(g, x, y, 4, 3, '#7a5a34'); pxEllipse(g, x, y, 2, 2, '#2a1a10'); pxRect(g, x - 1, y - 1, 1, 1, '#4a3a2a'); }
    Z.vignette(g);
  },
  tvwall(g, v, fl, t) {
    Z.wall(g, 0, 0, ZW, ZH, Decor.zoomWall('living'), 4);
    Z.sunbeam(g, 150, 60, 3);
    pxRect(g, 0, 120, ZW, 15, '#f2ede2'); pxRect(g, 0, 120, ZW, 1, '#a8a08c'); pxRect(g, 0, 124, ZW, 1, '#dcd5c4');
    Z.plate(g, 184, 94, 22, 22, '#ece2c8'); pxEllipse(g, 195, 105, 4, 4, '#c0b490'); pxEllipse(g, 195, 105, 2, 2, '#8a8a82'); pxRect(g, 195, 105, 1, 1, '#333');
    const holes = [[88, 26], [152, 26], [88, 62], [152, 62]];
    if (v === 0) for (const x of [70, 100, 130, 160]) { pxRect(g, x, 32, 1, 1, '#4a3c2c'); pxRect(g, x + 1, 33, 1, 1, '#b8a682'); }
    if (v === 1) {
      if (!fl.removed) for (const [x, y] of holes) { pxRect(g, x - 2, y - 2, 5, 5, '#f8f8f2'); pxRect(g, x - 2, y + 2, 5, 1, '#c8c2b0'); Z.screw(g, x, y); }
      else for (const [x, y] of holes) { pxRect(g, x - 2, y - 2, 4, 4, '#e8dcc0'); pxRect(g, x - 1, y - 1, 2, 2, '#3a2e22'); }
    }
    if (v === 2) for (const [cx, cy] of [[96, 40], [150, 44]]) {
      g.fillStyle = '#f4ead6'; g.beginPath();
      for (let a = 0; a < 6.3; a += .5) { const r = 16 + hash(cx + a * 10) * 6; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * .9); } g.fill();
      g.fillStyle = '#3a2f28'; g.beginPath();
      for (let a = 0; a < 6.3; a += .45) { const r = 11 + hash(cx + a * 7) * 5; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * .9); } g.fill();
      g.fillStyle = dither('#e7a2a8', 6); g.fillRect(cx - 6, cy - 4, 10, 9);
      speckle(g, cx - 14, cy + 16, 28, 6, '#efe6d2', 22, cx);
    }
    if (v === 3) { g.fillStyle = dither('#e6d6b4', 3); g.fillRect(70, 18, 100, 52); }
    Z.vignette(g);
  },
  fan(g, v, fl, t) {
    Z.popcorn(g);
    const wob = (v === 2 && fl.wobble && t - fl.wobble < 2.6) ? Math.sin(t * 22) * 3 * (1 - (t - fl.wobble) / 2.6) : 0;
    const drop = v === 2 ? 5 : 0;
    if (v === 2) { pxRect(g, 102, 0, 36, drop + 1, '#2a2620'); pxLine(g, 138, 2, 160, 8, '#b3ab98'); pxLine(g, 160, 8, 172, 6, '#b3ab98'); }
    pxRect(g, 104, drop, 32, 12, '#b9bcc4'); pxRect(g, 106, drop, 6, 12, '#d9dce4'); pxRect(g, 104, drop + 11, 32, 2, '#7d8290');
    pxRect(g, 117 + wob / 2, drop + 13, 6, 14, '#9a9ea8');
    const hx = 120 + wob, hy = 40 + drop;
    const spin = fl.spin ? t * 7 : 0, ang0 = (v === 2 && fl.wobble && t - fl.wobble < 2.6) ? t * 9 : spin;
    const blades = [];
    for (let i = 0; i < 5; i++) { const a = ang0 + i * Math.PI * 2 / 5 + .3; blades.push([a, Math.sin(a)]); }
    blades.sort((a, b) => a[1] - b[1]);
    for (const [a] of blades) {
      const c = Math.cos(a), s = Math.sin(a), droop = v === 1 ? 4 : 0;
      const tip = [hx + c * 112, hy + s * 20 + droop], base = [hx + c * 20, hy + s * 5];
      const nx = -s * 9, ny = c * 2.4;
      const col = v === 1 ? '#b99c76' : '#a0703c', dark = v === 1 ? '#9c805c' : '#7a5228';
      fillPoly(g, [[base[0] + nx * .5, base[1] + ny * .5], [tip[0] + nx, tip[1] + ny], [tip[0] - nx, tip[1] - ny], [base[0] - nx * .5, base[1] - ny * .5]], s > 0 ? col : dark);
      pxLine(g, base[0], base[1], tip[0], tip[1], v === 1 ? '#c9b08c' : '#8a5e30');
      pxRect(g, base[0] - 2, base[1] - 1, 5, 3, '#8d93a1');
    }
    pxEllipse(g, hx, hy, 18, 8, '#9ea2ac'); pxEllipse(g, hx, hy - 2, 16, 5, '#c4c8d0'); pxRect(g, hx - 16, hy + 3, 32, 2, '#6f7480');
    pxEllipse(g, hx, hy + 22, 24, 13, '#e9e3d6'); pxEllipse(g, hx - 4, hy + 19, 15, 7, '#f8f5ee'); pxRect(g, hx - 24, hy + 10, 48, 2, '#8d93a1');
    speckle(g, hx - 10, hy + 22, 20, 8, '#5a5040', 3, 4);
    pxLine(g, hx + 34, hy + 18, hx + 34 + wob, hy + 66, '#c9a227'); pxEllipse(g, hx + 34 + wob, hy + 68, 2, 2, '#e8c34a');
    Z.vignette(g);
  },
  sink(g, v, fl, t) {
    Z.wall(g, 0, 0, ZW, 30, Decor.zoomWall('kitchen'), 6);
    pxRect(g, 0, 22, ZW, 8, '#9d9282'); speckle(g, 0, 22, ZW, 8, '#7d7366', 60, 2);
    pxRect(g, 0, 30, ZW, 34, '#8c8378'); speckle(g, 0, 30, ZW, 34, '#6c6458', 300, 3); speckle(g, 0, 30, ZW, 34, '#b4ab9c', 200, 4);
    for (const bx of [44, 124]) { pxRect(g, bx, 34, 72, 26, '#c3c7ce'); pxRect(g, bx + 3, 36, 66, 22, '#8e939c'); pxRect(g, bx + 3, 36, 66, 3, '#6f747e'); pxEllipse(g, bx + 36, 50, 4, 2, '#4a4e56'); }
    pxRect(g, 117, 30, 6, 6, '#d9dce4'); pxRect(g, 118, 4, 4, 28, '#c9ccd4'); pxRect(g, 118, 4, 22, 4, '#c9ccd4'); pxRect(g, 136, 4, 4, 10, '#c9ccd4'); pxRect(g, 119, 4, 1, 28, '#ffffff');
    pxRect(g, 104, 24, 8, 4, '#b9bcc4'); pxRect(g, 128, 24, 8, 4, '#b9bcc4');
    if (v === 1) { speckle(g, 114, 26, 14, 8, '#f6f6f0', 40, 5); pxRect(g, 135, 13, 6, 2, '#f0f0e8'); speckle(g, 134, 12, 8, 4, '#ffffff', 10, 6); }
    Z.plate(g, 206, 6, 20, 28, '#ece2c8');
    if (v === 2) { pxLine(g, 207, 18, 225, 22, '#6b604a'); pxRect(g, 214, 17, 4, 3, '#5a5040'); pxRect(g, 213, 18, 6, 2, '#bdb4a0'); }
    else { pxRect(g, 214, 12, 4, 14, '#d8ccb0'); pxRect(g, 213, 12, 6, 6, '#f4ecd8'); }
    // cabinet
    pxRect(g, 30, 64, 180, 71, '#7a4f28');
    if (!fl.open) {
      for (const dx of [34, 122]) { pxRect(g, dx, 68, 84, 67, v === 3 ? '#b07a42' : '#b48048'); pxRect(g, dx + 6, 74, 72, 55, '#a26f3a'); pxRect(g, dx + 8, 76, 68, 51, '#b98a52'); for (let y = 78; y < 126; y += 5) pxRect(g, dx + 9, y, 66, 1, '#ad7c45'); }
      pxRect(g, 112, 96, 3, 10, '#d9c27a'); pxRect(g, 125, 96, 3, 10, '#d9c27a');
      if (v === 3) { g.fillStyle = dither('#4f3218', 9); g.fillRect(34, 124, 172, 11); }
    } else {
      pxRect(g, 34, 68, 172, 67, '#1f1610'); pxRect(g, 34, 68, 172, 6, '#120c08');
      pxRect(g, 18, 66, 16, 69, '#b48048'); pxRect(g, 206, 66, 16, 69, '#b48048');
      pxRect(g, 86, 74, 6, 28, '#e8e8e2'); pxRect(g, 148, 74, 6, 28, '#e8e8e2'); pxRect(g, 86, 98, 68, 6, '#e8e8e2'); pxRect(g, 116, 98, 6, 22, '#e8e8e2');
      pxRect(g, 60, 74, 2, 30, '#c9ccd4'); pxRect(g, 176, 74, 2, 30, '#c9ccd4'); pxRect(g, 57, 104, 8, 5, '#b9bcc4'); pxRect(g, 173, 104, 8, 5, '#b9bcc4');
      if (v === 3) {
        pxRect(g, 34, 122, 172, 13, '#2f4a5a'); g.fillStyle = dither('#6aa0c0', 3 + Math.round(Math.sin(t * 3) * 2)); g.fillRect(34, 122, 172, 13);
        const dy = Z.dripY(t, 1.1, 14); pxRect(g, 177, 109 + dy, 1, 2, '#9fd4f0');
        speckle(g, 34, 100, 172, 22, '#3e4a2c', 50, 7);
      } else pxRect(g, 40, 120, 160, 15, '#e6dfd0');
    }
    Z.vignette(g);
  },
  stove(g, v, fl, t) {
    Z.wall(g, 0, 0, ZW, ZH, Decor.zoomWall('kitchen'), 6);
    pxRect(g, 0, 40, 20, 4, '#8a8174'); pxRect(g, 220, 40, 20, 4, '#8a8174'); pxRect(g, 0, 44, 20, 91, '#b07a42'); pxRect(g, 220, 44, 20, 91, '#b07a42'); pxRect(g, 19, 44, 1, 91, '#7a4f28'); pxRect(g, 220, 44, 1, 91, '#7a4f28');
    pxRect(g, 20, 4, 200, 52, '#1c1d21'); pxRect(g, 20, 4, 200, 2, '#3a3b42');
    for (const [x, y] of [[66, 18], [174, 18], [66, 42], [174, 42]]) {
      pxEllipse(g, x, y, 14, 7, v === 1 ? '#3a2f40' : '#2c2d33'); pxEllipse(g, x, y, 7, 3, '#4a4b52'); pxEllipse(g, x, y, 5, 2, '#26272c');
      pxRect(g, x - 22, y - 1, 44, 2, '#3c3e44'); pxRect(g, x - 1, y - 10, 2, 20, '#3c3e44');
      if (v === 1) { g.fillStyle = dither('#7a6290', 3); g.fillRect(x - 20, y - 8, 40, 16); }
      if (v === 0) pxRect(g, x - 4, y - 2, 3, 1, '#6a6b72');
    }
    pxRect(g, 20, 56, 200, 18, '#2a2b30'); pxRect(g, 20, 56, 200, 1, '#4a4b52');
    [50, 90, 150, 190].forEach((x, i) => {
      if (v === 2 && i === 0) { g.fillStyle = '#3a2a1a'; g.beginPath(); g.ellipse(x, 66, 9, 6, .3, 0, 7); g.fill(); pxRect(g, x - 6, 66, 4, 6, '#2a1d12'); pxRect(g, x + 2, 62, 3, 2, '#5a4430'); return; }
      pxEllipse(g, x, 65, 6, 6, '#d9dce4'); pxEllipse(g, x, 65, 4, 4, '#b9bcc4'); pxRect(g, x - 1, 59, 2, 5, '#5a5e68');
      if (v !== 1) for (let k = 0; k < 4; k++) pxRect(g, x - 9 + k * 6, 72, 2, 1, '#9a9ea8');
    });
    pxRect(g, 20, 74, 200, 61, '#1c1d21'); pxRect(g, 30, 78, 180, 4, '#c9ccd4'); pxRect(g, 30, 78, 180, 1, '#ffffff');
    pxRect(g, 44, 88, 152, 42, '#0f1013'); g.fillStyle = dither('#3a3c44', 5); g.fillRect(48, 90, 40, 38);
    if (v === 2) { g.save(); g.beginPath(); g.rect(44, 88, 152, 42); g.clip(); pxCrack(g, 66, 94, .3, 70, '#b9bcc4', 11); pxCrack(g, 66, 94, 1.1, 30, '#b9bcc4', 5); g.restore(); }
    if (v === 0) { pxLine(g, 150, 92, 170, 126, '#2c2e36'); pxLine(g, 156, 92, 176, 126, '#2c2e36'); }
    Z.vignette(g);
  },
  counter(g, v, fl, t) {
    Z.wall(g, 0, 0, ZW, 10, Decor.zoomWall('kitchen'), 6);
    pxRect(g, 0, 8, ZW, 26, '#a49a8a'); speckle(g, 0, 8, ZW, 26, '#8a8072', 150, 2); pxRect(g, 0, 32, ZW, 2, '#6a6256');
    pxRect(g, 0, 34, ZW, 64, '#7d7468'); speckle(g, 0, 34, ZW, 64, '#5e564c', 900, 3); speckle(g, 0, 34, ZW, 64, '#9c9384', 700, 4); speckle(g, 0, 34, ZW, 64, '#c9c0b0', 220, 5);
    Z.sunbeam(g, 120, 70, 2);
    pxRect(g, 12, 50, 34, 20, '#c1121f'); pxRect(g, 12, 50, 34, 2, '#e23040'); pxRect(g, 16, 56, 18, 3, '#ffffff'); pxRect(g, 16, 61, 12, 2, '#f4c2c6');   // a red DVD-by-mail envelope
    pxRect(g, 0, 98, ZW, 18, '#8a8174'); pxRect(g, 0, 98, ZW, 3, '#a89f90'); pxRect(g, 0, 113, ZW, 3, '#5e564c');
    pxRect(g, 0, 116, ZW, 19, '#b07a42'); pxRect(g, 0, 116, ZW, 2, '#7a4f28'); pxRect(g, 118, 118, 4, 17, '#7a4f28');
    if (v === 1) { for (let i = 0; i < 26; i++) { const x = 110 + hash(i) * 110, y = 40 + hash(i + 40) * 50; pxLine(g, x, y, x + 6 + hash(i + 9) * 10, y + hash(i + 3) * 4 - 2, '#a69d8e'); } g.fillStyle = dither('#b0a898', 5); g.fillRect(150, 46, 60, 34); }
    if (v === 2) {
      pxEllipse(g, 120, 64, 32, 17, '#4a3018'); pxEllipse(g, 120, 64, 26, 13, '#6b4a2a'); pxEllipse(g, 120, 64, 20, 10, '#8a6a46');
      pxEllipse(g, 116, 62, 8, 4, '#a08060'); pxEllipse(g, 128, 67, 5, 3, '#a08060'); pxRect(g, 114, 60, 3, 1, '#c8aa86'); pxRect(g, 126, 65, 2, 1, '#c8aa86');
    }
    if (v === 3) { g.fillStyle = '#2a2420'; g.beginPath(); g.moveTo(150, 98); g.lineTo(178, 98); g.lineTo(172, 108); g.lineTo(156, 110); g.fill(); pxRect(g, 152, 99, 22, 9, '#c8a878'); speckle(g, 152, 99, 22, 9, '#9c7a4a', 40, 4); }
    Z.vignette(g);
  },
  mirror(g, v, fl, t) {
    Z.wall(g, 0, 0, ZW, ZH, Decor.zoomWall('bath'), 8);
    pxRect(g, 0, 122, ZW, 13, '#f2f0e6'); pxRect(g, 0, 122, ZW, 2, '#9fb6ad');
    const flick = v === 3 && Settings.get('motion') && (Math.sin(t * 31) > .55 || Math.sin(t * 7.3) > .9);
    pxRect(g, 40, 2, 160, 6, '#b9bcc4'); pxRect(g, 40, 2, 160, 1, '#e9ecf2');
    [60, 100, 140, 180].forEach((x, i) => {
      pxRect(g, x - 2, 6, 4, 4, '#8d93a1');
      const lit = !(flick && i !== 0);
      pxEllipse(g, x, 13, 6, 5, lit ? '#fff4c8' : '#a8a28e'); pxEllipse(g, x - 2, 11, 2, 2, lit ? '#ffffff' : '#c8c2ae');
      if (v === 3 && i === 2) { pxRect(g, x - 3, 6, 6, 3, '#6b4a2a'); if (Math.sin(t * 31) > .9) { pxRect(g, x + 5, 4, 1, 1, '#fff27a'); pxRect(g, x + 7, 2, 1, 1, '#ffffff'); pxRect(g, x - 6, 3, 1, 1, '#fff27a'); } }
    });
    if (!(v === 3 && flick)) { g.fillStyle = dither('#fff4c8', 2); g.fillRect(30, 18, 180, 40); }
    pxRect(g, 48, 20, 144, 82, '#7e9aa0'); pxRect(g, 50, 22, 140, 78, '#a9c4c9');
    pxRect(g, 60, 30, 26, 70, '#93b0b6'); pxRect(g, 64, 34, 18, 66, '#8aa6ac'); pxRect(g, 130, 60, 60, 40, '#9ab6bc');   // reflected door frame & wall
    for (let i = 0; i < 3; i++) pxLine(g, 120 + i * 18, 24, 100 + i * 18, 96, '#c9e0e4');
    if (v === 1) { for (let i = 0; i < 40; i++) { const x = 50 + hash(i) * 140, y = 92 + hash(i + 5) * 8; pxRect(g, x, y, 2 + hash(i + 2) * 4, 1 + hash(i + 3) * 3, '#2a2e30'); } speckle(g, 50, 22, 4, 78, '#2a2e30', 30, 8); speckle(g, 186, 22, 4, 78, '#2a2e30', 30, 9); }
    if (v === 2) {
      for (let a = 0; a < 6.28; a += .08) pxRect(g, 120 + Math.cos(a) * 26, 60 + Math.sin(a) * 24, 1, 1, '#eef6f6');
      pxRect(g, 110, 50, 2, 6, '#eef6f6'); pxRect(g, 128, 50, 2, 6, '#eef6f6');
      for (let a = .5; a < 2.65; a += .07) pxRect(g, 120 + Math.cos(a) * 15, 63 + Math.sin(a) * 10, 1, 1, '#eef6f6');
    }
    if (v === 3 && flick) { g.fillStyle = dither('#000000', 6); g.fillRect(0, 0, ZW, ZH); }
    pxRect(g, 60, 104, 120, 18, '#e8e4d6'); pxRect(g, 60, 104, 120, 2, '#ffffff'); pxRect(g, 112, 100, 16, 4, '#c9ccd4');
    Z.vignette(g);
  },
  tub(g, v, fl, t) {
    pxRect(g, 0, 0, ZW, 86, v === 3 ? '#cfcfc6' : '#d8d8d0');
    for (let row = 0; row < 9; row++) for (let col = -1; col < 13; col++) {
      const x = col * 20 + (row % 2 ? 10 : 0), y = row * 10 - 4;
      const tilt = v === 3 && row >= 7 && (col === 4 || col === 9) ? 1 : 0;
      pxRect(g, x + 1, y + 1 + tilt, 18, 8, '#f4f4ee'); pxRect(g, x + 1, y + 1 + tilt, 18, 1, '#ffffff'); pxRect(g, x + 2, y + 2 + tilt, 4, 1, '#ffffff');
    }
    if (v === 3) { g.fillStyle = dither('#5d5a4a', 10); for (let y = 66; y < 86; y += 10) g.fillRect(0, y - 4, ZW, 1); g.fillRect(0, 76, ZW, 10); g.fillStyle = dither('#7a7660', 6); g.fillRect(0, 60, ZW, 26); }
    if (v === 2) { pxCrack(g, 62, 36, 0, 14, '#8a8a80', 3); pxCrack(g, 62, 36, 2, 12, '#8a8a80', 5); pxCrack(g, 62, 36, 4, 12, '#8a8a80', 7); pxCrack(g, 152, 56, .5, 14, '#8a8a80', 9); pxCrack(g, 152, 56, 2.6, 12, '#8a8a80', 13); pxCrack(g, 152, 56, 4.4, 10, '#8a8a80', 17); }
    Z.sunbeam(g, 40, 50, 2);
    pxRect(g, 196, 60, 18, 6, '#c9ccd4'); pxRect(g, 196, 60, 18, 1, '#ffffff'); pxRect(g, 210, 66, 4, 4, '#9a9ea8');
    const ck = v === 1 ? '#d9c98a' : '#f4f4ee';
    pxRect(g, 0, 86, ZW, 6, ck); pxRect(g, 0, 86, ZW, 1, '#ffffff');
    if (v === 1) for (let i = 0; i < 18; i++) pxRect(g, hash(i) * 236, 87 + hash(i + 3) * 4, 3, 1, '#a89a5a');
    if (v === 3) for (const x of [30, 90, 170]) pxRect(g, x, 87, 10, 3, '#3a3a30');
    pxRect(g, 0, 92, ZW, 43, '#f6f6f2'); pxRect(g, 0, 92, ZW, 4, '#ffffff'); pxRect(g, 0, 100, ZW, 1, '#d6d6ce'); g.fillStyle = dither('#c8ccd0', 4); g.fillRect(0, 110, ZW, 25);
    Z.vignette(g);
  },
  toilet(g, v, fl, t) {
    Z.wall(g, 0, 0, ZW, 104, Decor.zoomWall('bath'), 8);
    pxRect(g, 0, 104, ZW, 31, '#d9d2c2'); for (let x = 0; x < ZW; x += 24) pxRect(g, x, 104, 1, 31, '#bfb7a6'); pxRect(g, 0, 118, ZW, 1, '#bfb7a6');
    pxRect(g, 0, 100, ZW, 4, '#f2f0e6');
    if (v === 3) { g.fillStyle = dither('#6b5232', 9); g.beginPath(); g.ellipse(120, 116, 64, 12, 0, 0, 7); g.fill(); g.fillStyle = dither('#9fc0d0', 4 + Math.round(Math.sin(t * 2) * 2)); g.beginPath(); g.ellipse(124, 117, 40, 6, 0, 0, 7); g.fill(); }
    pxRect(g, 72, 12, 96, 36, '#f6f6f2'); pxRect(g, 72, 12, 6, 36, '#e2e2da'); pxRect(g, 160, 12, 8, 36, '#ffffff'); pxRect(g, 72, 46, 96, 2, '#cfcfc6');
    pxRect(g, 66, 2, 108, 10, '#ffffff'); pxRect(g, 66, 10, 108, 2, '#d6d6ce');
    if (v === 2) { pxLine(g, 100, 2, 108, 11, '#6a6a62'); pxLine(g, 101, 2, 109, 11, '#a8a8a0'); }
    pxRect(g, 68, 18, 14, 4, '#c9ccd4'); pxRect(g, 68, 18, 14, 1, '#ffffff');
    pxEllipse(g, 120, 66, 46, 20, '#f6f6f2'); pxEllipse(g, 120, 62, 40, 14, '#e8e8e0'); pxEllipse(g, 120, 62, 32, 10, '#bcd8e4');
    if (v === 1) { const r = 2 + (t * 6) % 10; for (let a = 0; a < 6.28; a += .3) pxRect(g, 120 + Math.cos(a) * r * 2, 62 + Math.sin(a) * r * .8, 1, 1, '#e2f2f8'); }
    pxRect(g, 104, 84, 32, 20, '#f6f6f2'); pxRect(g, 104, 84, 4, 20, '#e2e2da'); pxEllipse(g, 98, 100, 4, 2, '#ffffff'); pxEllipse(g, 142, 100, 4, 2, '#ffffff');
    pxRect(g, 74, 44, 92, 4, '#ffffff');
    Z.vignette(g);
  },
  outlet(g, v, fl, t) {
    Z.wall(g, 0, 0, ZW, ZH, Decor.zoomWall('bath'), 8);
    const pc = v === 3 ? '#e6d59a' : '#f6f3ea';
    if (fl.open && v === 1) {
      pxRect(g, 84, 14, 72, 110, '#6a6a62'); pxRect(g, 88, 18, 64, 102, '#2a2a28');
      pxRect(g, 92, 30, 56, 70, '#d8d4c8'); pxLine(g, 96, 40, 112, 100, '#1a1a1a', 2); pxLine(g, 144, 40, 128, 100, '#eeeeee', 2); pxLine(g, 120, 24, 120, 104, '#c9a227', 2);
      g.fillStyle = dither('#3a2410', 10); g.fillRect(90, 34, 60, 40); pxRect(g, 98, 44, 10, 6, '#1a1008'); pxRect(g, 130, 52, 12, 5, '#1a1008');
    } else {
      Z.plate(g, 64, 6, 112, 124, pc);
      if (v === 2) { g.fillStyle = Decor.zoomWall('bath'); g.beginPath(); g.moveTo(176, 6); g.lineTo(140, 6); g.lineTo(176, 40); g.fill(); pxLine(g, 140, 6, 176, 40, '#8b8574'); pxRect(g, 156, 8, 18, 4, '#7a7a72'); pxLine(g, 120, 30, 150, 22, '#9a9484'); }
      Z.screw(g, 120, 12); Z.screw(g, 120, 124);
      pxRect(g, 86, 20, 68, 98, pc); pxRect(g, 86, 20, 68, 1, '#ffffff'); pxRect(g, 86, 117, 68, 1, '#cfc8b6');
      for (const y of [26, 88]) { pxRect(g, 100, y, 40, 22, v === 3 ? '#efe0a6' : '#fbf8f0'); pxRect(g, 109, y + 5, 2, 9, '#222'); pxRect(g, 128, y + 5, 2, 11, '#222'); pxEllipse(g, 120, y + 17, 2, 2, '#222'); }
      pxRect(g, 104, 54, 32, 10, '#1d1d1f'); pxRect(g, 104, 54, 32, 1, '#4a4a50'); pxRect(g, 112, 58, 16, 2, '#9a9aa0');
      pxRect(g, 104, 70, 32, 10, v === 3 ? '#efe0a6' : '#ffffff'); pxRect(g, 104, 79, 32, 1, '#cfc8b6'); pxRect(g, 112, 74, 16, 2, '#d64545');
      if (v === 1) { for (const y of [26, 88]) { g.fillStyle = dither('#5a3a1a', 9); g.fillRect(102, y + 2, 36, 18); pxRect(g, 108, y + 4, 4, 13, '#2a1a0a'); pxRect(g, 127, y + 4, 4, 14, '#2a1a0a'); } if (Math.sin(t * 40) > .97) pxRect(g, 112, 30, 1, 1, '#fff27a'); }
      if (v === 0 || v === 2) pxRect(g, 148, 24, 2, 2, Math.sin(t * 3) > 0 ? '#7bd36b' : '#3a6a34');
    }
    Z.vignette(g);
  },
  smoke(g, v, fl, t) {
    Z.popcorn(g);
    if (fl.open && v === 3) {
      pxEllipse(g, 120, 66, 54, 34, '#d8d8d0'); pxEllipse(g, 120, 66, 50, 30, '#e8e8e2'); pxRect(g, 98, 56, 44, 18, '#2a2a28'); pxRect(g, 100, 58, 40, 14, '#3a3a38');
      pxLine(g, 150, 60, 170, 92, '#d64545', 2); pxLine(g, 154, 60, 176, 90, '#1a1a1a', 2); pxLine(g, 158, 60, 182, 94, '#e8c34a', 2); pxRect(g, 168, 92, 16, 6, '#f2f2ea');
      Z.vignette(g); return;
    }
    const body = v === 1 ? '#ddd2a2' : '#f0f0ea', rim = v === 1 ? '#c4b884' : '#d6d6ce';
    pxEllipse(g, 122, 70, 72, 48, 'rgba(0,0,0,0.12)');
    pxEllipse(g, 120, 66, 72, 48, rim); pxEllipse(g, 120, 64, 68, 44, body);
    for (const r of [56, 46, 36]) for (let a = 0; a < 6.28; a += .12) if (Math.floor(a * 8) % 2) pxRect(g, 120 + Math.cos(a) * r, 64 + Math.sin(a) * r * .64, 2, 1, rim);
    pxEllipse(g, 120, 66, 14, 10, rim); pxEllipse(g, 120, 65, 12, 8, v === 1 ? '#e8dcaa' : '#fafaf6');
    const ledOn = v !== 3 && (t % 1.4) < .18;
    pxEllipse(g, 157, 45, 3, 2, v === 3 ? '#3a3a38' : ledOn ? '#7bff6b' : '#2f6a2a');
    if (v === 2) { pxEllipse(g, 86, 50, 14, 9, '#c8c8c0'); pxEllipse(g, 86, 50, 9, 5, '#b0b0a8'); pxCrack(g, 86, 50, .2, 50, '#7a7a72', 21); pxCrack(g, 86, 50, 2.6, 30, '#7a7a72', 23); }
    Z.vignette(g);
  },
  closet(g, v, fl, t) {
    Z.wall(g, 0, 0, ZW, ZH, Decor.zoomWall('bedroom'), 10);
    pxRect(g, 16, 0, 208, 10, '#c0c4cc'); pxRect(g, 16, 8, 208, 2, '#7d8290');
    if (v === 1) for (const x of [40, 96, 150, 200]) { pxEllipse(g, x, 5, 3, 3, '#e6e0cc'); pxRect(g, x - 4, 7, 8, 2, '#5a5040'); }
    const sag = v === 1 ? 3 : 0;
    for (let i = 0; i < 4; i++) {
      const x = 20 + i * 50, y = 12 + (i >= 2 ? sag : 0);
      pxRect(g, x, y, 49, 123, '#f4f4f0'); pxRect(g, x, y, 49, 1, '#ffffff'); pxRect(g, x + 48, y, 1, 123, '#c8ccd2');
      pxRect(g, x + 6, y + 8, 37, 48, '#e6e8ea'); for (let k = y + 10; k < y + 54; k += 4) { pxRect(g, x + 7, k, 35, 2, '#ffffff'); pxRect(g, x + 7, k + 2, 35, 1, '#c8ccd2'); }
      pxRect(g, x + 6, y + 64, 37, 50, '#e6e8ea'); pxRect(g, x + 8, y + 66, 33, 46, '#f4f4f0');
    }
    if (v === 1) { pxRect(g, 120, 12, 1, 123, '#5a6470'); g.fillStyle = dither('#3a4048', 6); g.fillRect(120, 12, 100, 3); }
    pxEllipse(g, 160, 68 + sag, 4, 4, '#c9a227'); pxEllipse(g, 159, 67 + sag, 2, 2, '#f2d870');
    if (v === 2) {
      g.fillStyle = '#ffffff'; g.beginPath(); for (let a = 0; a < 6.3; a += .4) { const r = 15 + hash(a * 9) * 6; g.lineTo(76 + Math.cos(a) * r, 92 + Math.sin(a) * r); } g.fill();
      g.fillStyle = '#3a2a1a'; g.beginPath(); for (let a = 0; a < 6.3; a += .35) { const r = 11 + hash(a * 5) * 5; g.lineTo(76 + Math.cos(a) * r, 92 + Math.sin(a) * r); } g.fill();
      for (let y = 82; y < 104; y += 5) for (let x = 66; x < 88; x += 6) { pxRect(g, x + (y % 10 ? 3 : 0), y, 4, 1, '#b08a5a'); pxRect(g, x + (y % 10 ? 3 : 0), y, 1, 4, '#b08a5a'); }
      speckle(g, 60, 108, 34, 6, '#f4f4f0', 14, 4);
    }
    Z.vignette(g);
  },
  window(g, v, fl, t) {
    Z.wall(g, 0, 0, ZW, ZH, Decor.zoomWall('bedroom'), 10);
    pxRect(g, 30, 0, 180, 104, '#f4f4f0');
    const T = Decor.time, lc = Decor.pal('bedroom').leaves, sky = g.createLinearGradient(0, 6, 0, 92); sky.addColorStop(0, T.sky[0]); sky.addColorStop(.6, T.sky[1]); sky.addColorStop(1, T.sky[2]);
    g.fillStyle = sky; g.fillRect(36, 6, 168, 86);
    pxRect(g, 150, 46, 54, 46, '#b07a5a'); for (let y = 52; y < 92; y += 8) for (let x = 154; x < 204; x += 10) pxRect(g, x, y, 5, 4, '#f3e2b0');   // building across the street
    const sway = Math.sin(t * .9) * 3 * (Settings.get('motion') ? 1 : 0);
    pxLine(g, 36, 70, 120 + sway, 46, '#5a3f2a', 3); pxLine(g, 80, 58, 110 + sway, 24, '#5a3f2a', 2);
    for (let i = 0; i < 46; i++) { const x = 60 + hash(i) * 100 + sway * (hash(i + 3) * 1.4), y = 14 + hash(i + 9) * 52; pxEllipse(g, x, y, 4 + hash(i + 4) * 4, 3 + hash(i + 7) * 2, lc[i % lc.length]); }
    if (T.rain) for (let i = 0; i < 40; i++) { const rx = 36 + hash(i) * 168, ry = 6 + ((hash(i * 3) * 86 + t * 70) % 86); pxLine(g, rx, ry, rx - 1, Math.min(91, ry + 5), 'rgba(220,232,245,0.75)'); }
    pxRect(g, 30, 46, 180, 6, '#f4f4f0'); pxRect(g, 30, 51, 180, 1, '#c8ccd2'); pxRect(g, 30, 0, 6, 104, '#f4f4f0'); pxRect(g, 204, 0, 6, 104, '#f4f4f0');
    pxRect(g, 112, 92, 16, 6, '#d9dce4'); pxRect(g, 116, 90, 8, 3, '#b9bcc4');
    if (v === 1) { g.fillStyle = dither('#eef2f4', 8); g.fillRect(36, 6, 168, 40); g.fillRect(36, 52, 168, 40); speckle(g, 36, 52, 168, 40, '#ffffff', 120, 5); }
    if (v === 2) { const cx = 96, cy = 72; for (let a = 0; a < 6.28; a += .55) pxCrack(g, cx, cy, a, 30, '#ffffff', a * 10 | 0); for (const r of [6, 12]) for (let a = 0; a < 6.28; a += .25) pxRect(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r * .8, 1, 1, '#ffffff'); }
    pxRect(g, 24, 98, 192, 8, '#ffffff'); pxRect(g, 24, 106, 192, 3, '#c8ccd2');
    g.fillStyle = Decor.time.sun ? dither(Decor.time.sun, 3) : 'rgba(0,0,0,0)'; g.beginPath(); g.moveTo(36, 109); g.lineTo(204, 109); g.lineTo(230, 135); g.lineTo(50, 135); g.fill();
    if (v === 3) {
      speckle(g, 26, 98, 188, 8, '#1a1a14', 160, 3); speckle(g, 26, 98, 188, 8, '#3f5a2a', 70, 4); speckle(g, 30, 86, 180, 12, '#1a1a14', 60, 5);
      for (const x of [60, 110, 170]) { g.fillStyle = dither('#8a7a4a', 6); g.fillRect(x, 109, 6, 26); }
    }
    Z.vignette(g);
  },
  bwall(g, v, fl, t) {
    Z.wall(g, 0, 0, ZW, 108, Decor.zoomWall('bedroom', 'left'), 10);
    Z.sunbeam(g, 30, 50, 3);
    pxRect(g, 0, 108, ZW, 27, '#f4f4f0'); pxRect(g, 0, 108, ZW, 2, '#9aa4ae'); pxRect(g, 0, 114, ZW, 1, '#dcdfe2');
    pxRect(g, 0, 130, ZW, 5, '#8a96a8'); speckle(g, 0, 130, ZW, 5, '#6a7686', 60, 2);
    if (v === 1) { g.fillStyle = dither('#7d8794', 5); g.fillRect(56, 44, 130, 12); g.fillStyle = dither('#7d8794', 3); g.fillRect(48, 40, 146, 20); for (let i = 0; i < 12; i++) pxLine(g, 60 + i * 10, 46 + hash(i) * 6, 70 + i * 10, 48 + hash(i + 1) * 6, '#8a929c'); }
    if (v === 2) {
      const P2 = '#7b3fc4', L2 = (a, b, c, d) => pxLine(g, a, b, c, d, P2, 2);
      for (let a = 3.3; a < 6.2; a += .05) pxRect(g, 120 + Math.cos(a) * 40, 70 + Math.sin(a) * 22, 2, 2, P2);
      L2(80, 70, 160, 70); L2(152, 56, 176, 24); L2(160, 62, 184, 28); for (let a = 0; a < 6.28; a += .2) pxRect(g, 182 + Math.cos(a) * 9, 22 + Math.sin(a) * 6, 2, 2, P2);
      pxRect(g, 186, 20, 2, 2, P2); L2(84, 70, 60, 82); L2(96, 70, 96, 90); L2(110, 70, 110, 90); L2(134, 70, 134, 90); L2(148, 70, 148, 90);
      for (let i = 0; i < 6; i++) { L2(92 + i * 10, 52 - (i % 3), 97 + i * 10, 44 - (i % 3)); L2(97 + i * 10, 44 - (i % 3), 102 + i * 10, 51 - (i % 3)); }
      for (let a = 0; a < 6.28; a += .25) pxRect(g, 30 + Math.cos(a) * 10, 22 + Math.sin(a) * 10, 2, 2, '#f2a020');
      for (let i = 0; i < 8; i++) { const a = i * .785; pxLine(g, 30 + Math.cos(a) * 13, 22 + Math.sin(a) * 13, 30 + Math.cos(a) * 18, 22 + Math.sin(a) * 18, '#f2a020'); }
      for (let i = 0; i < 6; i++) { pxLine(g, 150 + i * 9, 96, 154 + i * 9, 88, P2); pxLine(g, 154 + i * 9, 88, 158 + i * 9, 98, P2); }
    }
    Z.vignette(g);
  }
};
function drawZoom(g, feat, v, fl, t) {
  g.save(); g.imageSmoothingEnabled = false;
  ZOOM_ART[feat.art](g, v, fl || {}, t || 0);
  Decor.tint(g, ZW, ZH);
  g.restore();
}
