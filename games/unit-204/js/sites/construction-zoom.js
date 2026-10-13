'use strict';
/* ============================== SITE 204: CLOSE-UPS ==============================
   Every construction feature's 240x135 close-up, one per condition (v0 OK, v1 Note, v2 Correct, v3 Stop), added to
   CONA.ZOOM_ART. The room views are in js/sites/construction-art.js; the data that says what each one means is in
   js/sites/construction.js. Borrowed from INDA (read only): the sign font and a few surfaces. */
(() => {
  const { txt, R, sign, concrete, stripes, bolt } = INDA, ZA = CONA.ZOOM_ART = {};
  const T = () => Decor.time;
  /* sky in flat bands, top to bottom (the close-ups are outdoors) */
  function skyZ(g, h = ZH) { const s = T().sky; for (let i = 0; i < 6; i++) R(g, 0, Math.floor(i * h / 6), ZW, Math.ceil(h / 6) + 1, mix(i < 4 ? s[0] : s[1], i < 4 ? s[1] : s[2], i < 4 ? i / 4 : (i - 4) / 2)); }
  function dirt(g, y, h = ZH - y, base = '#9a8262', seed = 3) { R(g, 0, y, ZW, h, base); speckle(g, 0, y, ZW, h, mix(base, '#000000', .2), ZW * h / 7, seed); speckle(g, 0, y, ZW, h, mix(base, '#ffffff', .2), ZW * h / 10, seed + 4); }
  function gravel(g, y, h = ZH - y) { dirt(g, y, h, '#8e8a80', 9); speckle(g, 0, y, ZW, h, '#5a5650', ZW * h / 16, 13); }
  function plywood(g, x, y, w, h, c = '#c8a070') { R(g, x, y, w, h, c); for (let yy = y + 3; yy < y + h; yy += 5) R(g, x, yy, w, 1, mix(c, '#8a6a3a', .35)); speckle(g, x, y, w, h, mix(c, '#6a4a2a', .3), w * h / 40, x + y); }
  function chain(g, x, y, w, h, c = 'rgba(150,158,166,0.85)') { g.fillStyle = c; for (let yy = y; yy < y + h; yy++) for (let xx = x + ((yy - y) % 4); xx < x + w; xx += 4) g.fillRect(xx, yy, 1, 1); for (let yy = y; yy < y + h; yy++) for (let xx = x + 3 - ((yy - y) % 4); xx < x + w; xx += 4) if (xx >= x) g.fillRect(xx, yy, 1, 1); }
  function tag(g, x, y, s, col = '#f4f2ea') { R(g, x - 1, y - 1, tw(s) + 4, 9, '#3a3c42'); R(g, x, y, tw(s) + 2, 7, col); txt(g, s, x + 1, y + 1, '#1d1f26'); }
  const tw = s => String(s).length * 4 - 1;
  /* a measurement or call-out label: outlined in near-black so it reads against sky, dirt, or steel */
  function lab(g, s, x, y, col = '#f2c418', k = 1, align) { for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) txt(g, s, x + dx, y + dy, '#1d1f26', k, align); txt(g, s, x, y, col, k, align); }
  /* a worker at close-up size: a 12x26 sprite, colored by what they're wearing (missing pieces drop out) */
  const WORKER = ['....HHHH....', '...HHHHHH...', '..hhHHHHhh..', '....ssss....', '...sGGGGs...', '....ssss....', '.....ss.....', '..VVSSSSVV..', '.VVVSSSSVVV.', '.VVVYSSYVVV.', 'aVVVVSSVVVVa', 'aVVVVVVVVVVa',
    'aVYYYYYYYYVa', 'aVVVVVVVVVVa', 'kVVVVVVVVVVk', '..JJJJJJJJ..', '..JJJJJJJJ..', '..JJJ..JJJ..', '..JJJ..JJJ..', '..JJJ..JJJ..', '..JJJ..JJJ..', '..JJJ..JJJ..', '..JJJ..JJJ..', '..JJJ..JJJ..', '.BBBB..BBBB.', '.BBBB..BBBB.'];
  /* a worker in the same sprite style as you, Dana, and Pat (js/crew-sprites.js), feet at (x, y), sized by s */
  function worker(g, x, y, s, o = {}) {
    const spr = CrewSprites.get({ look: o.look ?? Math.round(x * 7 + y) % CREW_LOOKS.length, shirt: o.shirt, hat: o.hat, vest: o.vest, glasses: o.glasses, muffs: !!o.muffs, gloves: !!o.gloves, kneel: !!o.kneel, act: o.act || 'idle', frame: 0 }, s * .45);
    g.save(); g.imageSmoothingEnabled = false; if (o.face < 0) { g.translate(Math.round(x), 0); g.scale(-1, 1); g.drawImage(spr, Math.round(-spr.width / 2), Math.round(y - spr.height + 2)); } else g.drawImage(spr, Math.round(x - spr.width / 2), Math.round(y - spr.height + 2)); g.restore();
  }


  Object.assign(ZA, {
    /* ============================== GATE AND LAYDOWN ============================== */
    c_signboard(g, v, fl, t) {
      skyZ(g, 70); dirt(g, 96);
      R(g, 0, 70, ZW, 26, '#c4c0b6');
      chain(g, 0, 8, 146, 92); R(g, 0, 6, 150, 2, '#8a9098'); for (const x of [2, 144]) R(g, x, 6, 3, 96, '#7a8088');
      // the board: the site sign, then the emergency numbers and the OSHA poster
      R(g, 8, 10, 132, 86, '#3a3c42'); R(g, 10, 12, 128, 82, '#f4f2ea');
      R(g, 10, 12, 128, 10, '#2a5aa8'); txt(g, 'SITE ' + (Game.unit || '204'), 74, 14, '#ffffff', 1, 'c'); txt(g, 'HARD HAT AREA', 74, 25, '#c8202a', 1, 'c'); txt(g, 'PPE REQUIRED PAST GATE', 74, 32, '#1d1f26', 1, 'c'); txt(g, 'SUPER: 555-0142', 74, 39, '#1d1f26', 1, 'c');
      if (v !== 2) {
        R(g, 12, 48, 60, 44, '#f2e8c0'); R(g, 12, 48, 60, 8, '#c8202a'); txt(g, 'EMERGENCY', 42, 50, '#ffffff', 1, 'c'); txt(g, 'CALL 911', 42, 60, '#1d1f26', 1, 'c'); txt(g, 'MERCY HOSP', 42, 68, '#1d1f26', 1, 'c'); txt(g, '2.1 MI', 42, 75, '#1d1f26', 1, 'c'); txt(g, 'KIT: TRAILER', 42, 83, '#1d1f26', 1, 'c');
        R(g, 76, 48, 60, 44, '#f8f6ee'); R(g, 76, 48, 60, 10, '#2a5aa8'); txt(g, 'JOB SAFETY', 106, 50, '#ffffff', 1, 'c'); txt(g, "IT'S THE LAW", 106, 61, '#1d1f26', 1, 'c'); for (let k = 0; k < 4; k++) R(g, 80, 70 + k * 5, 52 - k * 6, 1, '#9a9ea6');
      } else { for (const [x, y] of [[14, 50], [68, 50], [14, 88], [68, 88], [78, 50], [132, 50], [78, 88], [132, 88]]) R(g, x, y, 3, 2, '#d8d0b0'); txt(g, '?', 42, 66, '#c8c4b8', 2, 'c'); }
      if (v === 1) { g.fillStyle = 'rgba(244,242,234,0.6)'; g.fillRect(10, 12, 128, 82); R(g, 0, 8, 62, 92, 'rgba(47,90,58,0.92)'); for (let y = 10; y < 98; y += 6) R(g, 58 + (y % 12 ? 2 : 0), y, 3, 3, '#2a4a30'); }
      // the gate: latched, or wide open onto the sidewalk with someone walking in
      if (v === 3) { R(g, 150, 6, 2, 94, '#7a8088'); chain(g, 152, 10, 22, 86, 'rgba(170,176,184,0.9)'); R(g, 236, 6, 3, 94, '#7a8088'); worker(g, 196, 112, 2, { vest: false, hat: false, shirt: '#c85a7a', glasses: false });
        for (let x = 150; x < 240; x += 7) R(g, x, 104 + (x % 3), 4, 2, '#6a5a40'); lab(g, 'BEEP', 210, 76, '#f2c418'); }
      else { R(g, 150, 6, 3, 96, '#7a8088'); R(g, 236, 6, 3, 96, '#7a8088'); chain(g, 153, 10, 82, 88, 'rgba(170,176,184,0.9)'); R(g, 153, 50, 82, 2, '#8a9098'); R(g, 190, 48, 6, 8, '#3a3c42'); R(g, 192, 52, 2, 6, '#c8a030'); }
      Z.vignette(g);
    },
    c_crew(g, v, fl, t) {
      skyZ(g, 50); dirt(g, 96); R(g, 0, 50, ZW, 46, '#2f5a3a'); chain(g, 0, 50, ZW, 46);
      if (v === 3) { R(g, 170, 10, 70, 60, '#f2a018'); for (let x = 174; x < 240; x += 10) R(g, x, 10, 2, 60, '#c88008'); R(g, 166, 70, 74, 10, '#2a2c32'); R(g, 176, 72, 8, 6, Math.floor(t * 2) % 2 ? '#ffffff' : '#d8d8d0'); lab(g, 'BEEP', 205, 40, '#ffffff', 1, 'c'); }
      // the worker at the saw, waist up: the same person and sprite as in the yard (js/crew-sprites.js), drawn big
      const gear = [{ muffs: true }, { hat: 'back', vest: 'open', muffs: true }, { glasses: false, muffs: true }, { hat: false, vest: false, glasses: false, shirt: '#8a8a8a' }][v] || {};
      const seed = [...'cutter'].reduce((a, ch) => a + ch.charCodeAt(0), 0), mo = Settings.get('motion');
      const spr = CrewSprites.get({ look: seed % CREW_LOOKS.length, act: 'saw', frame: mo ? Math.floor(t * 5) % 2 : 0, ...gear }, 3);
      g.save(); g.imageSmoothingEnabled = false; g.drawImage(spr, 31, 2); g.restore();
      // the chop saw on the sawhorse, sawdust flying
      R(g, 160, 112, 80, 8, '#c8a070'); R(g, 166, 120, 6, 15, '#8a6a3a'); R(g, 228, 120, 6, 15, '#8a6a3a'); R(g, 176, 100, 50, 12, '#3a3c42');
      pxEllipse(g, 204, 88, 18, 18, '#b8bcc4'); pxEllipse(g, 204, 88, 4, 4, '#4a4c52'); g.fillStyle = '#c8202a'; g.beginPath(); g.arc(204, 88, 20, Math.PI, Math.PI * 1.9); g.lineTo(204, 88); g.fill(); R(g, 196, 62, 18, 10, '#d8a020');
      if (Settings.get('motion')) for (let k = 0; k < 8; k++) R(g, 184 - ((t * 60 + k * 11) % 50), 100 - hash(k) * 16, 1, 1, '#e0bc8c');
      Z.vignette(g);
    },
    c_stacks(g, v, fl, t) {
      skyZ(g, 60); dirt(g, 110); R(g, 0, 60, ZW, 50, '#2f5a3a'); chain(g, 0, 60, ZW, 50);
      // dunnage under both stacks
      R(g, 14, 112, 112, 6, '#a07a48'); R(g, 126, 112, 112, 6, '#a07a48'); for (const x of [20, 66, 110, 140, 186, 226]) R(g, x, 118, 6, 4, '#8a6a3a');
      // block: two tiers, the top one stepped back; or one tall straight stack; or leaning and spilling
      const blk = (x, y) => { R(g, x, y, 15, 7, '#b8b6ae'); R(g, x, y, 15, 1, '#cac8c0'); R(g, x + 3, y + 2, 3, 3, '#8a8880'); R(g, x + 9, y + 2, 3, 3, '#8a8880'); };
      if (v === 3) { g.save(); g.translate(70, 112); g.rotate(.2); for (let r = 0; r < 9; r++) for (let c = 0; c < 6; c++) blk(-48 + c * 16, -8 - r * 8); g.restore(); blk(118, 104); blk(130, 120); }
      else { const rows = v === 2 ? 13 : 6; for (let r = 0; r < rows; r++) for (let c = 0; c < 6; c++) blk(20 + c * 16, 104 - r * 8);
        if (v !== 2) for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) blk(28 + c * 16, 56 - r * 8);
        const top = v === 2 ? 0 : 24; R(g, 118, top + 2, 1, 110 - top, '#f2c418'); lab(g, v === 2 ? '8 FT' : '5 FT', 120, (top + 112) / 2, '#f2c418'); }
      // lumber: banded and stickered; nails sticking up out of used boards in the bad case
      for (let r = 0; r < 6; r++) { R(g, 130, 104 - r * 8, 104, 7, r % 2 ? '#c8a070' : '#d0a878'); R(g, 130, 104 - r * 8, 104, 1, '#e0bc8c'); for (let k = 0; k < 9; k++) R(g, 132 + k * 11, 106 - r * 8, 1, 3, '#a8844a'); }
      if (v !== 2) for (const x of [150, 210]) R(g, x, 64, 2, 48, '#3a3c42');
      if (v === 2) for (let k = 0; k < 9; k++) { const x = 136 + k * 11, y = 64 - (k % 2) * 8; R(g, x, y - 5, 1, 5, '#8a8e96'); R(g, x - 1, y - 6, 3, 1, '#8a8e96'); }
      if (v === 1) { const k = Math.sin(t * 5) * 4; g.fillStyle = '#3a6ad0'; g.beginPath(); g.moveTo(128, 64); g.lineTo(236, 62); g.lineTo(236 + k, 40 - k); g.lineTo(150, 30 + k); g.closePath(); g.fill(); R(g, 128, 64, 108, 2, '#2a5ab0'); }
      Z.vignette(g);
    },
    c_rebar(g, v, fl, t) {
      skyZ(g, 20); R(g, 0, 0, ZW, 20, '#3a3c44'); R(g, 0, 18, ZW, 6, '#b4b2aa'); R(g, 0, 24, ZW, 2, '#7a7870');
      dirt(g, 96); concrete(g, 0, 84, ZW, 16, '#a8a8a2', 4);
      // the deck edge overhead, and boots up there: someone working right above
      for (let x = 30; x < 220; x += 34) { R(g, x, 0, 6, 18, '#9a4a3a'); }
      if (v === 3) { R(g, 100, 8, 10, 8, '#5a3a20'); R(g, 114, 8, 10, 8, '#5a3a20'); R(g, 96, 0, 32, 8, '#3a4a6a'); }
      // the rebar: two rows sticking up out of the footing
      for (let i = 0; i < 10; i++) for (const row of [0, 1]) { const x = 20 + i * 22 + row * 8, y0 = 86 - row * 4, top = 38 + row * 4;
        R(g, x, top, 3, y0 - top, '#8a4a2a'); for (let y = top + 2; y < y0; y += 4) R(g, x, y, 3, 1, '#6a3a1a');
        if (v === 2) { pxEllipse(g, x + 1, top - 1, 4, 2, '#f8a040'); R(g, x - 2, top - 1, 7, 1, '#c87a20'); }
        else if (v === 3) R(g, x, top - 1, 3, 2, '#b06a40'); }
      if (v === 0 || v === 1) for (const row of [0, 1]) { const top = 38 + row * 4; R(g, 14 + row * 8, top - 8, 218, 9, '#f07a1a'); R(g, 14 + row * 8, top - 8, 218, 2, '#ff9a40'); R(g, 14 + row * 8, top, 218, 1, '#c85a0a');
        if (row === 0) txt(g, 'IMPALEMENT RATED', 120, top - 6, '#ffffff', 1, 'c'); }
      if (v === 1) for (let k = 0; k < 7; k++) { R(g, 150 + k * 9, 110 - (k % 3) * 4, 22, 4, '#c8a070'); R(g, 150 + k * 9, 110 - (k % 3) * 4, 22, 1, '#e0bc8c'); }
      if (v === 2) { R(g, 140, 112, 80, 6, '#b08a58'); for (let k = 0; k < 5; k++) { R(g, 148 + k * 15, 106, 1, 6, '#8a8e96'); R(g, 147 + k * 15, 105, 3, 1, '#8a8e96'); } }
      Z.vignette(g);
    },
    c_truck(g, v, fl, t) {
      skyZ(g, 70); dirt(g, 100);
      // the back of the dump truck: the tailgate, the frame, two sets of duals, and the lights
      R(g, 50, 10, 140, 70, '#f2a018'); for (let x = 54; x < 190; x += 12) R(g, x, 10, 2, 70, '#c88008'); R(g, 50, 10, 140, 3, '#ffc040');
      R(g, 44, 80, 152, 14, '#2a2c32'); for (const x of [58, 160]) { pxEllipse(g, x + 10, 104, 16, 16, '#1d1f26'); pxEllipse(g, x + 10, 104, 7, 7, '#6a6e76'); }
      R(g, 50, 82, 12, 8, '#d82020'); R(g, 178, 82, 12, 8, '#d82020'); R(g, 66, 82, 8, 8, v === 3 ? '#ffffff' : '#e8e8e0');
      // the backup alarm under the frame: intact, or its wires cut and hanging
      R(g, 108, 96, 26, 12, '#3a3c42'); for (let k = 0; k < 4; k++) R(g, 112 + k * 5, 99, 2, 6, '#1d1f26');
      if (v === 2) { pxLine(g, 112, 108, 108, 120, '#d82020'); pxLine(g, 128, 108, 132, 118, '#2a2c32'); R(g, 107, 120, 2, 2, '#c8a030'); }
      if (v === 0 || v === 3) lab(g, 'BEEP', 122, 112, '#f2c418', 1, 'c');
      // the side mirror: clean, or caked with mud
      R(g, 200, 20, 4, 30, '#3a3c42'); R(g, 204, 18, 26, 34, '#3a3c42'); R(g, 206, 20, 22, 30, v === 1 ? '#7a6a4a' : '#8ab0d0'); if (v === 1) speckle(g, 206, 20, 22, 30, '#5a4a30', 120, 5);
      if (v === 0) { worker(g, 26, 132, 3, {}); R(g, 40, 60, 3, 20, '#6a6e76'); R(g, 34, 52, 16, 10, '#d82020'); txt(g, 'STOP', 42, 54, '#ffffff', 1, 'c'); }
      if (v === 3) worker(g, 160, 136, 3, { vest: false, shirt: '#8a5a3a', glasses: false });
      Z.vignette(g);
    },
    c_toilet(g, v, fl, t) {
      skyZ(g, 60); dirt(g, 110); chain(g, 0, 50, ZW, 60);
      // the portable toilet
      R(g, 12, 6, 88, 116, '#3a6ad0'); R(g, 8, 0, 96, 8, '#e8e8e0'); R(g, 18, 14, 76, 104, v === 2 ? '#2a4a90' : '#3a5ac0'); for (let y = 20; y < 116; y += 10) R(g, 18, y, 76, 1, '#2a4ab0');
      R(g, 80, 60, 8, 12, '#2a2c32'); R(g, 81, 62, 6, 4, v === 2 ? '#c8202a' : '#2a9a4a'); txt(g, v === 2 ? 'OCC' : 'VAC', 84, 74, '#ffffff', 1, 'c');
      if (v === 2) { stripes(g, 14, 50, 84, 8, '#f2c418', '#1d1f26', 5); txt(g, 'OUT OF ORDER', 56, 66, '#ffffff', 1, 'c'); pxEllipse(g, 56, 124, 40, 4, '#6a5a2a'); lab(g, '45 ON SITE', 56, 30, '#f2c418', 1, 'c'); }
      // the hand-wash station
      R(g, 112, 72, 36, 50, '#e8e8e0'); R(g, 116, 76, 28, 10, '#d8d8d0'); R(g, 126, 88, 8, 8, v === 1 ? '#d8d8d0' : '#8ad0e8'); txt(g, 'SOAP', 130, 98, '#5a5e66', 1, 'c'); if (v === 1) txt(g, 'EMPTY', 130, 106, '#c8202a', 1, 'c');
      // the water cooler on its stand, with cups (or empty, with the thermometer reading hot)
      R(g, 160, 70, 50, 52, '#8a8e96'); R(g, 164, 28, 42, 42, '#f07a1a'); R(g, 164, 28, 42, 6, v === 3 ? '#8a5a2a' : '#f8f8f0'); txt(g, 'WATER', 185, 46, '#ffffff', 1, 'c'); R(g, 182, 62, 6, 6, '#2a2c32');
      if (v !== 3) { R(g, 212, 36, 12, 30, '#f4f2ea'); for (let y = 38; y < 64; y += 4) R(g, 212, y, 12, 1, '#d8d6ce'); }
      if (v === 3) { R(g, 218, 10, 10, 50, '#f4f2ea'); R(g, 222, 14, 2, 40, '#d8d6ce'); R(g, 222, 22, 2, 32, '#d82020'); pxEllipse(g, 223, 56, 3, 3, '#d82020'); txt(g, '97F', 223, 64, '#c8202a', 1, 'c'); txt(g, 'DRY', 185, 54, '#1d1f26', 1, 'c'); }
      Z.vignette(g);
    },

    /* ============================== THE DECK ============================== */
    c_deckedge(g, v, fl, t) {
      skyZ(g, 80); CONA.farView(g, 23, 80); R(g, 0, 80, ZW, 55, mix(T().building, '#7a8a6a', .5)); for (let i = 0; i < 6; i++) R(g, hash(i) * 220, 90 + hash(i + 3) * 30, 30, 12, '#8a8478');
      concrete(g, 0, 112, ZW, 23, '#b4b2aa', 11); R(g, 0, 112, ZW, 2, '#8a8880');
      // posts and two cables: 42 inches and a midrail, flagged; low and sagging; or a section taken down
      const gap = v === 3 ? [86, 170] : null, top = v === 2 ? 46 : 30;
      for (const x of [20, 86, 170, 230]) R(g, x, top - 2, 4, 114 - top, '#6a6e76');
      for (const [y, sag] of [[top, v === 2 ? 10 : 0], [(top + 112) / 2, v === 2 ? 5 : 0]]) for (let x = 0; x < ZW; x++) { if (gap && x > gap[0] + 4 && x < gap[1]) continue; const k = Math.sin((x % 150) / 150 * Math.PI) * sag; R(g, x, Math.round(y + k), 1, 2, '#5a5e66'); }
      if (gap) { pxLine(g, gap[0] + 4, top, gap[0] + 14, 110, '#5a5e66'); pxLine(g, gap[1], top, gap[1] - 8, 110, '#5a5e66'); lab(g, '12 FT DROP', 128, 92, '#ffffff', 1, 'c'); for (let k = 0; k < 3; k++) R(g, 110 + k * 10, 108, 8, 4, '#c8a070'); }
      if (v !== 1) for (let x = 40; x < ZW; x += 46) { if (gap && x > gap[0] && x < gap[1]) continue; R(g, x, top + 1, 4, 7, '#f07a1a'); }
      R(g, 4, top, 1, 112 - top, '#f2c418'); lab(g, v === 2 ? '34 IN' : '42 IN', 7, (top + 112) / 2, '#f2c418');
      Z.vignette(g);
    },
    c_hole(g, v, fl, t) {
      concrete(g, 0, 0, ZW, ZH, '#b4b2aa', 17); for (let x = 0; x < ZW; x += 60) R(g, x, 0, 1, ZH, '#9c9a92');
      // the opening: a dark hole down to the floor below, with rebar ends at its edge
      const hole = [72, 38, 96, 62];
      if (v >= 2) { R(g, hole[0], hole[1], hole[2], hole[3], '#1d1f26'); R(g, hole[0] + 4, hole[1] + 4, hole[2] - 8, hole[3] - 8, '#2a2c32'); for (let x = hole[0]; x < hole[0] + hole[2]; x += 12) R(g, x, hole[1] - 2, 2, 4, '#8a4a2a'); speckle(g, hole[0] + 10, hole[1] + 20, hole[2] - 20, hole[3] - 30, '#4a4c52', 40, 3); }
      if (v === 3) { lab(g, '30 IN', 120, 104, '#f2c418', 1, 'c'); R(g, 72, 102, 96, 1, '#f2c418'); }
      // the cover: screwed down and marked, faded, or kicked aside
      if (v !== 3) { const dx = v === 2 ? 52 : 0, dy = v === 2 ? 14 : 0; plywood(g, 60 + dx, 30 + dy, 120, 78);
        R(g, 60 + dx, 108 + dy, 120, 3, '#8a6a3a'); for (let k = 0; k < 3; k++) R(g, 60 + dx, 108 + dy + k, 120, 1, k % 2 ? '#a8804e' : '#7a5a34');   // the sheet's edge, plies and all
        // the stencil, sprayed on (faded on a weathered sheet; on a kicked one it's still there, just not over the hole)
        CONA.spray(g, 'HOLE', 120 + dx, 62 + dy, '#d8401a', 4, 7, v === 1 ? .32 : .92); CONA.spray(g, 'DO NOT REMOVE', 120 + dx, 92 + dy, '#d8401a', 1, 3, v === 1 ? .28 : .85);
        if (v !== 2) for (const [x, y] of [[64, 34], [176, 34], [64, 104], [176, 104], [120, 34], [120, 104]]) { R(g, x, y, 2, 2, '#5a5e66'); R(g, x, y, 1, 1, '#8a8e96'); } }   // its screws, only where it's still fastened
      Z.vignette(g);
    },
    c_harness(g, v, fl, t) {
      skyZ(g, 100); CONA.farView(g, 31, 100); concrete(g, 0, 110, ZW, 25, '#b4b2aa', 5); R(g, 0, 108, ZW, 3, '#8a8880');
      // the column and the beam strap anchor on it
      R(g, 200, 0, 24, 110, '#9a4a3a'); R(g, 204, 0, 4, 110, '#7a3a2a'); R(g, 196, 18, 32, 10, '#f2c418'); R(g, 208, 28, 6, 8, '#c8ccd4');
      // the worker from behind: a harness over the vest, the D-ring between the shoulder blades
      const x = 110; R(g, x - 26, 20, 52, 60, '#f07a1a'); R(g, x - 26, 52, 52, 4, '#f4f2dc'); R(g, x - 10, 6, 20, 16, '#c8946a'); R(g, x - 13, 0, 26, 8, '#f2c418'); R(g, x - 16, 6, 32, 3, '#f2c418');
      R(g, x - 22, 80, 44, 30, '#3a4a6a'); R(g, x - 1, 82, 2, 28, '#2a3a52');
      R(g, x - 22, 20, 5, 60, '#1d1f26'); R(g, x + 17, 20, 5, 60, '#1d1f26'); pxLine(g, x - 20, 30, x + 20, 70, '#1d1f26', 3); pxLine(g, x + 20, 30, x - 20, 70, '#1d1f26', 3);
      pxEllipse(g, x, 30, 4, 4, '#c8ccd4'); pxEllipse(g, x, 30, 2, 2, '#1d1f26');
      if (v === 1) { pxLine(g, x - 20, 80, x - 28, 104, '#1d1f26', 3); pxLine(g, x + 20, 80, x + 26, 106, '#1d1f26', 3); }
      else { R(g, x - 22, 84, 20, 4, '#1d1f26'); R(g, x + 2, 84, 20, 4, '#1d1f26'); }
      // the lanyard: to the anchor, to a conduit on the floor, or dragging loose
      if (v === 0 || v === 1) { pxLine(g, x, 30, 210, 34, '#2a2c32', 2); R(g, 206, 32, 6, 4, '#c8ccd4'); }
      else if (v === 2) { R(g, 0, 118, ZW, 4, '#8a8e96'); R(g, 0, 118, ZW, 1, '#a8acb4'); pxLine(g, x, 30, 150, 118, '#2a2c32', 2); R(g, 147, 116, 6, 5, '#c8ccd4'); }
      else { pxLine(g, x, 30, 70, 112, '#2a2c32', 2); pxLine(g, 70, 112, 40, 126, '#2a2c32', 2); R(g, 36, 124, 6, 4, '#c8ccd4'); }
      Z.vignette(g);
    },
    c_planks(g, v, fl, t) {
      skyZ(g, 50); CONA.farView(g, 41, 50); R(g, 0, 50, ZW, 85, mix(T().building, '#7a8a6a', .5));
      // looking along the scaffold platform: planks between frames, their ends past the supports
      for (const x of [26, 214]) R(g, x, 10, 5, 125, '#b4b8c0');
      const planks = v === 2 ? [0, 1, 3, 4] : [0, 1, 2, 3, 4];
      for (const k of planks) { const y = 58 + k * 14; R(g, 16, y, 216, 12, v === 1 ? '#9a7a58' : '#b89060'); R(g, 16, y, 216, 1, '#d0a878'); for (let x = 24; x < 232; x += 30) R(g, x, y + 4, 12, 1, '#8a6a3a'); if (v === 1) speckle(g, 16, y, 216, 12, '#5a4028', 140, k); }
      if (v === 2) { R(g, 16, 86, 216, 12, '#1d1f26'); lab(g, 'MISSING', 120, 89, '#f2c418', 1, 'c'); R(g, 214, 58, 18, 12, '#1d1f26'); lab(g, '3 IN', 200, 46, '#f2c418'); R(g, 214, 54, 1, 4, '#f2c418'); }
      else { R(g, 232, 54, 1, 4, '#f2c418'); lab(g, '8 IN', 214, 46, '#f2c418'); }
      for (const x of [26, 214]) R(g, x - 4, 54, 13, 4, '#8a8e96');
      if (v === 3) { pxLine(g, 60, 100, 170, 106, '#2a1a0a', 2); pxLine(g, 110, 102, 118, 110, '#2a1a0a'); R(g, 150, 64, 20, 24, '#f07a1a'); R(g, 148, 62, 24, 4, '#d85a0a'); R(g, 150, 30, 20, 34, '#3a4a6a'); R(g, 148, 26, 24, 6, '#5a3a20'); }
      Z.vignette(g);
    },
    c_scafrail(g, v, fl, t) {
      skyZ(g, 110); CONA.farView(g, 51, 110); R(g, 0, 110, ZW, 25, mix(T().building, '#7a8a6a', .5));
      plywood(g, 0, 112, ZW, 23, '#b89060');
      for (const x of [16, 120, 222]) R(g, x, 0, 5, 135, '#b4b8c0');
      // the outer rail: top rail, midrail, toeboard (wire where a pin's gone, missing at the end, or none at all)
      if (v !== 3) { const end = v === 2 ? 120 : 240;
        for (const y of [24, 66]) { R(g, 0, y, end, 4, '#8a8e96'); R(g, 0, y, end, 1, '#c8ccd4'); }
        R(g, 0, 104, end, 10, '#c8a070'); R(g, 0, 104, end, 1, '#e0bc8c');
        if (v === 1) { R(g, 118, 22, 8, 8, '#c8a030'); pxLine(g, 117, 21, 127, 31, '#a88010'); pxLine(g, 127, 21, 117, 31, '#a88010'); }
        R(g, 2, 24, 1, 88, '#f2c418'); lab(g, '42 IN', 5, 48, '#f2c418');
        if (v === 2) { lab(g, 'OPEN END', 180, 40, '#f2c418', 1, 'c'); lab(g, '14 FT', 180, 90, '#ffffff', 1, 'c'); } }
      else { lab(g, 'NO RAILS', 120, 50, '#f2c418', 1, 'c'); R(g, 70, 120, 10, 6, '#8a8e96'); pxLine(g, 160, 118, 166, 135, '#8a8e96', 2); lab(g, 'CLANG', 190, 124, '#ffffff'); }
      Z.vignette(g);
    },
    c_scaftag(g, v, fl, t) {
      skyZ(g, ZH); CONA.farView(g, 61, 116); R(g, 0, 116, ZW, 19, mix(T().building, '#7a8a6a', .5));
      // the building's column on the left, the scaffold frame on the right, and the ties between them
      const out = v === 3 ? 30 : 0;
      R(g, 0, 0, 36, ZH, '#9a4a3a'); R(g, 30, 0, 6, ZH, '#7a3a2a'); concrete(g, 0, 100, 60, 35, '#b4b2aa', 2);
      R(g, 196 + out, 0, 6, ZH, '#b4b8c0'); R(g, 228 + out, 0, 6, ZH, '#b4b8c0'); pxLine(g, 199 + out, 20, 231 + out, 90, '#8a8e96', 2);
      plywood(g, 150 + out, 100, 90, 12, '#b89060');
      if (v !== 2) for (const y of [30, 70]) { R(g, 36, y, 160 + out, 2, '#5a5e66'); R(g, 36, y + 2, 160 + out, 1, '#3a3e46'); }
      else for (const y of [30, 70]) { R(g, 36, y, 20, 2, '#5a5e66'); pxLine(g, 56, y, 60, y + 14, '#5a5e66'); R(g, 180, y, 16, 2, '#5a5e66'); pxLine(g, 180, y, 176, y + 12, '#5a5e66'); }
      if (v === 3) { R(g, 60, 104, 120, 12, '#1d1f26'); lab(g, 'GAP 2 FT', 120, 106, '#f2c418', 1, 'c'); lab(g, 'LEANING OUT', 210, 6, '#f2c418', 1, 'c'); }
      // the inspection tag on the access frame
      const tx = 160 + out; R(g, tx, 20, 32, 48, v === 1 ? '#e8e0b0' : '#2a9a4a'); R(g, tx + 14, 14, 4, 8, '#c8ccd4'); txt(g, v === 1 ? 'OK' : 'SAFE', tx + 16, 24, '#ffffff', 1, 'c');
      R(g, tx + 3, 34, 26, 30, '#f4f2ea'); txt(g, v === 1 ? 'OCT 12' : 'OCT 13', tx + 16, 38, '#1d1f26', 1, 'c'); R(g, tx + 6, 48, 20, 1, '#1d1f26'); R(g, tx + 8, 54, 12, 1, '#2a5aa8');
      Z.vignette(g);
    },

    /* ============================== THE TRENCH ============================== */
    c_trenchbox(g, v, fl, t) {
      // looking down into the trench: the far wall, the floor, and the box between them (or not)
      R(g, 0, 0, ZW, ZH, '#6a5038'); speckle(g, 0, 0, ZW, ZH, '#4a3a28', 1800, 7); for (let y = 14; y < ZH; y += 18) R(g, 0, y, ZW, 1, 'rgba(40,28,18,0.4)');
      R(g, 0, 118, ZW, 17, '#3a2c1e');
      if (v === 1) for (let i = 0; i < 12; i++) R(g, hash(i) * 230, 116 + hash(i + 3) * 8, 4, 3, '#8a6a48');
      if (v !== 3) { const lift = v === 2 ? 30 : 10, x0 = v === 2 ? 40 : 60;
        R(g, x0, 0, 120, 118 - lift, '#7a8088'); for (let x = x0 + 10; x < x0 + 120; x += 20) R(g, x, 0, 3, 118 - lift, '#5a6068'); R(g, x0, 118 - lift - 4, 120, 4, '#5a6068');
        for (const y of [30, 70]) { R(g, x0 - 6, y, 132, 5, '#c8a030'); R(g, x0 - 6, y, 132, 1, '#e8c050'); }
        R(g, x0 + 122, 118 - lift, 1, lift, '#f2c418'); lab(g, v === 2 ? '3 FT' : '18 IN', x0 + 125, 118 - lift / 2 - 2, '#f2c418'); }
      // the worker: inside the box, standing beyond its end, or in the bare trench
      const wx = v === 2 ? 200 : 110; worker(g, wx, 122, 3, { hat: '#f2c418' });
      if (v === 3) { R(g, 4, 2, 1, 116, '#f2c418'); lab(g, '6 FT', 7, 56, '#f2c418'); }
      Z.vignette(g);
    },
    c_spoil(g, v, fl, t) {
      skyZ(g, 40); dirt(g, 40);
      // the trench opening along the right, and the spoil pile beside it (back from the edge, or right at it)
      R(g, 150, 40, 90, 95, '#3a2c1e'); R(g, 150, 40, 4, 95, '#6a5038'); speckle(g, 150, 40, 90, 95, '#2a1e12', 400, 3);
      const toe = v === 2 ? 148 : 108; CONA.spoilZoom(g, toe, fl);
      if (v === 0) { R(g, toe, 124, 150 - toe, 1, '#f2c418'); lab(g, '3 FT', (toe + 150) / 2, 116, '#f2c418', 1, 'c'); }
      if (v === 1) { pxLine(g, 140, 120, 128, 70, '#8a6a3a', 2); R(g, 124, 66, 10, 6, '#8a8e96'); R(g, 132, 104, 14, 16, '#f07a1a'); R(g, 130, 102, 18, 3, '#d85a0a'); }
      if (v === 2) { for (const y of [100, 114]) { R(g, 90, y, 56, 12, '#3a6ad0'); R(g, 90, y, 56, 2, '#5a8ae8'); pxEllipse(g, 146, y + 6, 3, 6, '#1d1f26'); } lab(g, '6 IN', 140, 88, '#f2c418', 1, 'c'); }
      if (v === 3) { for (const x of [196, 214]) { let y = 40; while (y < ZH) { const ny = y + 6; pxLine(g, x + Math.sin(y) * 2, y, x + Math.sin(ny) * 2, ny, '#1d1f26'); y = ny; } } R(g, 150, 70, 10, 30, '#7a5a3a');
        for (let k = 0; k < 6; k++) R(g, 152 + hash(k) * 6, 100 + ((t * 30 + k * 8) % 30), 2, 2, '#8a6a48'); }
      Z.vignette(g);
    },
    c_trladder(g, v, fl, t) {
      skyZ(g, 36); dirt(g, 36); R(g, 40, 36, 160, 99, '#3a2c1e'); R(g, 40, 36, 160, 6, '#6a5038'); speckle(g, 40, 42, 160, 93, '#2a1e12', 300, 4);
      // the ladder: 3 feet above the edge, or flush with it, or gone (just scuffs on the box where people climb)
      if (v !== 3) { const top = v === 2 ? 36 : 2;
        for (const x of [92, 148]) { R(g, x, top, 6, ZH - top, '#c8ccd4'); R(g, x + 4, top, 2, ZH - top, '#9aa0aa'); }
        for (let y = top + 12; y < ZH; y += 16) { R(g, 98, y, 50, 4, v === 1 ? '#7a6040' : '#a8acb4'); if (v === 1) speckle(g, 98, y - 2, 50, 7, '#5a4028', 30, y); }
        if (v !== 2) { R(g, 160, 2, 1, 34, '#f2c418'); lab(g, '3 FT', 163, 16, '#f2c418'); txt(g, '15 FT AWAY', 120, 124, '#ffffff', 1, 'c'); }
        else lab(g, '40 FT AWAY', 120, 124, '#f2c418', 1, 'c'); }
      else { R(g, 60, 60, 120, 75, '#7a8088'); for (let x = 70; x < 180; x += 20) R(g, x, 60, 3, 75, '#5a6068'); for (const [x, y] of [[90, 80], [110, 96], [130, 110], [100, 120]]) R(g, x, y, 8, 3, '#4a3a28'); lab(g, 'NO LADDER', 120, 46, '#f2c418', 1, 'c'); }
      Z.vignette(g);
    },
    c_water(g, v, fl, t) {
      // looking down into the cut from its lip: the ground along the top, the far wall in layers of fill, clay, and
      // gravel, the two side walls narrowing toward it in shade, and the floor at the bottom
      R(g, 0, 0, ZW, 30, '#9a8262'); speckle(g, 0, 0, ZW, 30, '#806a4c', 480, 4); speckle(g, 0, 0, ZW, 30, '#b09a78', 300, 5);
      const bands = [['#7a5a3c', 30], ['#6a4e34', 44], ['#8a6a48', 58], ['#5e4630', 74], ['#6e5238', 88]];
      for (const [k, [c, y]] of bands.entries()) { const y1 = k + 1 < bands.length ? bands[k + 1][1] : 102; R(g, 30, y, 180, y1 - y, c); for (let x = 30; x < 210; x += 6) R(g, x, y + Math.round(Math.sin(x * .13 + k) * 1.5), 6, 1, mix(c, '#000000', .2)); }
      speckle(g, 30, 30, 180, 72, '#4a3a28', 800, 21); speckle(g, 30, 58, 180, 16, '#b0a080', 110, 22);   // pebbles; a gravel layer
      fillPoly(g, [[0, 30], [30, 30], [30, 102], [0, 128]], '#4e3a28'); speckle(g, 0, 30, 30, 98, '#3a2a1c', 220, 23);   // the side walls, in shade
      fillPoly(g, [[240, 30], [210, 30], [210, 102], [240, 128]], '#5a4430'); speckle(g, 210, 30, 30, 98, '#3e2e1e', 220, 24);
      R(g, 0, 28, ZW, 2, '#b09a78');                                                                          // the far lip, worn smooth
      fillPoly(g, [[30, 102], [210, 102], [240, 128], [240, 135], [0, 135], [0, 128]], '#3a2c1e'); speckle(g, 0, 102, ZW, 33, '#2a2016', 300, 25);   // the floor
      // water: a puddle at the low end, or the whole floor flooded over the boot tops
      if (v === 1) { pxEllipse(g, 176, 122, 40, 7, '#4a6a7a'); pxEllipse(g, 176, 121, 38, 5, '#5a7a8a'); R(g, 160, 119, 14, 1, '#8ab0c0'); }
      if (v === 2) { fillPoly(g, [[26, 104], [214, 104], [240, 124], [240, 135], [0, 135], [0, 124]], '#5a7a8a'); for (let x = 0; x < ZW; x += 18) R(g, x + Math.floor(t * 8 % 18), 108, 8, 1, '#8ab0c0');
        worker(g, 120, 134, 2, { hat: '#f2c418' }); fillPoly(g, [[96, 112], [144, 112], [144, 135], [96, 135]], 'rgba(90,122,138,0.85)'); R(g, 98, 112, 44, 1, '#8ab0c0'); }   // standing in it, shins under water
      // the ladder up the near-left corner: aluminum rails lit on one edge, its rungs, its feet in the floor
      const lad = y => [44 + (135 - y) * .06, 76 + (135 - y) * .03];
      for (let y = 8; y < 135; y += 14) { const [a, b] = lad(y); R(g, Math.round(a), y, Math.round(b - a), 3, '#a8acb4'); R(g, Math.round(a), y, Math.round(b - a), 1, '#d8dce4'); }
      for (const side of [0, 1]) for (let y = 0; y < 135; y++) { const x = Math.round(lad(y)[side]); R(g, x - 2, y, 4, 1, '#8a8e96'); R(g, x - 2, y, 1, 1, '#d8dce4'); R(g, x + 1, y, 1, 1, '#5a5e66'); }
      // the four-gas meter, clipped to a rung: a yellow rubber boot with its thickness showing down the right side, a
      // black face, the screen, the sensor grille, two buttons, and the alarm light across the top
      { const mx = 22, my = 18, mw = 48, mh = 62, on = Math.floor(t * 4) % 2;
        R(g, mx + 14, my - 4, 20, 6, '#3a3c42'); R(g, mx + 16, my - 4, 16, 2, '#6a6e76');                          // the belt clip, over the rung
        R(g, mx + mw, my + 3, 4, mh - 3, '#b88a08'); R(g, mx + 3, my + mh, mw, 4, '#9a7406');                      // its side and bottom, in depth
        R(g, mx + 1, my, mw - 2, mh, '#f2c418'); R(g, mx, my + 1, mw, mh - 2, '#f2c418'); R(g, mx + 2, my + 1, mw - 4, 2, '#ffe060');   // the boot, corners rounded
        R(g, mx + 4, my + 6, mw - 8, mh - 12, '#2a2c32');                                                           // the face
        R(g, mx + 8, my + 1, mw - 16, 3, v === 3 ? (on ? '#ff3030' : '#7a1a1a') : '#2a8a2a');                       // the alarm bar
        R(g, mx + 6, my + 9, mw - 12, 34, v === 3 ? (on ? '#5a1a1a' : '#2a3a2a') : '#2a3a2a'); R(g, mx + 6, my + 9, mw - 12, 1, '#4a5a4a');   // the screen
        const lines = v === 3 ? [['O2 18.2', '#ff6060'], ['LEL 18', '#ff6060'], ['H2S 25', '#ff6060'], ['CO 9', '#8af08a']] : [['O2 20.9', '#8af08a'], ['LEL 0', '#8af08a'], ['H2S 0', '#8af08a'], ['CO 0', '#8af08a']];
        lines.forEach(([s, c], k) => txt(g, s, mx + mw / 2, my + 11 + k * 8, c, 1, 'c'));
        for (let k = 0; k < 4; k++) R(g, mx + 12 + k * 6, my + 47, 3, 1, '#6a6e76');                               // the sensor grille
        for (const bx of [mx + 10, mx + mw - 18]) { R(g, bx, my + 51, 8, 4, '#4a4c52'); R(g, bx, my + 51, 8, 1, '#8a8e96'); } }   // buttons
      // the trash pump up on the lip (or nowhere, and the water's rising): its roll cage, the red engine with cooling
      // fins and a pull-start, the fuel tank and cap, the gray pump body, a ribbed suction hose down to a strainer
      if (v !== 2) { const px = 164, py = 4;
        const tube = (x0, y0, x1, y1) => { pxLine(g, x0, y0, x1, y1, '#2a2c32', 3); pxLine(g, x0, y0 - 1, x1, y1 - 1, '#6a6e76'); };
        tube(px, py + 30, px + 64, py + 30); tube(px + 6, py + 24, px + 70, py + 24);                                // the skid frame, in depth
        R(g, px + 6, py + 6, 30, 20, '#b81818'); R(g, px + 6, py + 6, 30, 3, '#e85050'); for (let x = px + 9; x < px + 34; x += 3) R(g, x, py + 10, 1, 14, '#8a1010');   // the engine and its fins
        R(g, px + 36, py + 8, 4, 18, '#8a1010');                                                                     // its side, in depth
        pxEllipse(g, px + 4, py + 16, 6, 7, '#3a3c42'); pxEllipse(g, px + 4, py + 16, 4, 5, '#5a5e66'); R(g, px - 1, py + 14, 3, 3, '#1d1f26');   // the pull-start housing and its handle
        R(g, px + 10, py - 4, 22, 9, '#d82020'); R(g, px + 10, py - 4, 22, 2, '#ff6a5a'); R(g, px + 32, py - 2, 3, 7, '#a81818'); R(g, px + 18, py - 6, 5, 2, '#1d1f26');   // the tank and its cap
        R(g, px + 34, py + 2, 8, 4, '#4a4c52'); R(g, px + 40, py + 1, 3, 3, '#2a2c32');                              // the muffler
        pxEllipse(g, px + 52, py + 15, 11, 11, '#8a8e96'); pxEllipse(g, px + 51, py + 14, 9, 9, '#a8acb4'); pxEllipse(g, px + 52, py + 15, 4, 4, '#4a4c52');   // the volute
        R(g, px + 62, py + 6, 10, 5, '#5a5e66'); R(g, px + 70, py + 4, 4, 9, '#3a3c42');                            // the discharge, off to the right
        tube(px, py + 2, px, py + 30); tube(px + 64, py, px + 64, py + 30); tube(px, py + 2, px + 64, py); tube(px + 6, py - 4, px + 70, py - 6);   // the roll cage
        // the suction hose, black and ribbed, from the pump's inlet down the right wall to a strainer in the low spot
        const pts = []; for (let k = 0; k <= 24; k++) { const u = k / 24; pts.push([(1 - u) * (1 - u) * (px + 52) + 2 * u * (1 - u) * 222 + u * u * 178, (1 - u) * (1 - u) * (py + 24) + 2 * u * (1 - u) * 70 + u * u * 118]); }
        for (let k = 1; k < pts.length; k++) pxLine(g, pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], '#1d1f26', 5);
        for (let k = 1; k < pts.length; k++) { const [x, y] = pts[k]; R(g, Math.round(x) - 2, Math.round(y), 4, 1, '#4a4c52'); }   // the ribs
        R(g, 172, 114, 12, 8, '#6a6e76'); for (let x = 174; x < 183; x += 3) R(g, x, 116, 1, 4, '#2a2c32'); R(g, 172, 114, 12, 1, '#a8acb4'); }   // the strainer
      Z.vignette(g);
    },
    c_excavator(g, v, fl, t) {
      skyZ(g, 80); dirt(g, 80);
      // the trench edge, the excavator's bucket overhead, and the stop log at the edge
      R(g, 0, 100, ZW, 35, '#3a2c1e'); R(g, 0, 98, ZW, 4, '#6a5038');
      // the machine at the left: its tracks, the cab corner with glass and an operator, the boom coming off it
      R(g, 0, 60, 50, 22, '#2a2c32'); for (let x = 2; x < 50; x += 6) R(g, x, 60, 3, 22, '#3e4048'); for (const x of [10, 26, 42]) pxEllipse(g, x, 74, 4, 4, '#6a6e76');
      R(g, 0, 24, 54, 36, '#f2c418'); R(g, 0, 24, 54, 4, '#ffe060'); R(g, 0, 56, 54, 4, '#c89a08'); R(g, 4, 0, 30, 26, '#c89a08'); R(g, 7, 3, 24, 20, '#3a5a72'); pxLine(g, 10, 20, 18, 5, '#9ac8e0');
      R(g, 18, 9, 7, 6, '#c8946a'); R(g, 17, 6, 9, 4, '#f4f4ee');
      // the boom up to the elbow, its lift cylinder (chrome rod), the stick down to the bucket and its cylinder
      pxLine(g, 46, 30, 104, 8, '#c89a08', 12); pxLine(g, 46, 28, 104, 6, '#f2c418', 8); pxLine(g, 50, 46, 80, 26, '#3a3c42', 5); pxLine(g, 80, 26, 96, 16, '#d8dce4', 3);
      pxLine(g, 104, 8, 122, 36, '#c89a08', 10); pxLine(g, 104, 6, 122, 34, '#f2c418', 6); pxEllipse(g, 104, 8, 4, 4, '#8a8e96'); pxLine(g, 96, 2, 116, 22, '#3a3c42', 3);
      // the bucket: a curled scoop, its pin, and teeth
      g.fillStyle = '#4a4c52'; g.beginPath(); g.moveTo(108, 30); g.lineTo(144, 30); g.lineTo(140, 50); g.lineTo(122, 56); g.lineTo(108, 48); g.closePath(); g.fill(); R(g, 108, 30, 36, 3, '#6a6e76'); pxEllipse(g, 122, 36, 3, 3, '#8a8e96');
      for (let x = 110; x < 140; x += 7) { R(g, x, 50, 4, 6, '#a8acb4'); R(g, x + 1, 55, 2, 2, '#8a8e96'); }
      if (v === 3) { pxLine(g, 124, 50, 124, 62, '#2a2c32', 2); R(g, 104, 62, 40, 14, '#3a6ad0'); pxEllipse(g, 104, 69, 3, 7, '#2a5ab0'); worker(g, 124, 134, 2.4, { hat: '#f2c418', act: 'reach' }); lab(g, 'UNDER LOAD', 180, 84, '#f2c418', 1, 'c'); }
      if (v === 0) { R(g, 0, 90, ZW, 8, '#a07a48'); R(g, 0, 90, ZW, 2, '#b08a58'); txt(g, 'STOP LOG', 40, 92, '#1d1f26'); }
      if (v === 0) worker(g, 210, 96, 2, {}); if (v === 2) { worker(g, 200, 96, 2, { vest: false, shirt: '#6a6a6a' }); worker(g, 180, 96, 2, { vest: false, shirt: '#8a6a4a' }); }
      if (v === 1) lab(g, 'NO TAPE', 200, 70, '#ffffff', 1, 'c');
      if (v === 0) { for (let x = 150; x < ZW; x += 10) R(g, x, 70, 6, 2, '#f2c418'); }
      Z.vignette(g);
    },
    c_locate(g, v, fl, t) {
      skyZ(g, 30); dirt(g, 30);
      // the locate paint: yellow for gas, orange for phone, with flags, and the competent person's log on a stake
      if (v !== 2) { const a = v === 1 ? .3 : 1;
        for (const [y, c, s] of [[70, '#f2c418', 'G'], [100, '#f07a1a', 'T']]) { for (let x = 10; x < 180; x += 20) R(g, x, y, 12, 4, rgba(c, a)); txt(g, s, 190, y - 2, rgba(c, a), 2); for (const x of [30, 130]) { R(g, x, y - 26, 1, 26, '#a8a8a2'); R(g, x + 1, y - 26, 10, 7, rgba(c, Math.max(a, .5))); } } }
      R(g, 210, 0, 3, 60, '#8a6a3a'); R(g, 196, 4, 34, 40, '#8a6a3a'); R(g, 198, 6, 30, 36, '#f4f2ea');
      if (v === 2) txt(g, 'BLANK', 213, 18, '#c8202a', 1, 'c'); else { txt(g, 'OCT 13', 213, 9, '#1d1f26', 1, 'c'); txt(g, 'TYPE B', 213, 18, '#1d1f26', 1, 'c'); R(g, 202, 30, 20, 1, '#2a5aa8'); }
      if (v === 3) { R(g, 0, 112, 180, 10, '#3a2c1e'); R(g, 0, 114, 180, 5, '#f2c418'); R(g, 80, 110, 14, 10, '#1d1f26'); for (let k = 0; k < 6; k++) R(g, 86 + Math.sin(t * 4 + k) * 6, 104 - k * 4 - (t * 10 % 4), 2, 1, 'rgba(240,240,220,0.8)'); lab(g, 'HISS', 110, 96, '#ffffff'); }
      Z.vignette(g);
    },

    /* ============================== THE TRAILER YARD ============================== */
    c_trailer(g, v, fl, t) {
      // the trailer's face: ribbed white siding, shaded where each rib turns, over a dark skirt, on gravel
      skyZ(g, 20); R(g, 0, 0, ZW, 96, '#eceae2'); for (let x = 0; x < ZW; x += 8) { R(g, x, 0, 1, 96, '#d0cec6'); R(g, x + 1, 0, 1, 96, '#f6f4ec'); }
      R(g, 0, 96, ZW, 6, '#3a3c42'); R(g, 0, 96, ZW, 1, '#5a5e66'); gravel(g, 102);
      // the door, set into its frame: the trim stands proud, the slab sits back in shadow, with a lever, a kick plate, and a little wired-glass light
      R(g, 66, 4, 74, 94, '#f4f2ea'); R(g, 66, 4, 74, 1, '#ffffff'); R(g, 139, 4, 1, 94, '#c8c6be');
      R(g, 71, 9, 64, 89, '#9a988e'); R(g, 73, 11, 62, 87, '#d8d6ce'); R(g, 73, 11, 62, 2, '#b8b6ae'); R(g, 73, 11, 2, 87, '#c4c2ba');
      R(g, 92, 18, 22, 26, '#3a4a5a'); R(g, 93, 19, 20, 24, '#5a7a9a'); for (let y = 22; y < 42; y += 5) for (let x = 95; x < 112; x += 5) R(g, x, y, 1, 1, '#8aa0b4'); R(g, 94, 20, 6, 2, '#a8c0d4');
      R(g, 123, 52, 9, 3, '#8a8e96'); R(g, 123, 55, 9, 1, '#5a5e66'); R(g, 125, 50, 4, 7, '#6a6e76');   // the lever on its rose
      R(g, 75, 86, 58, 10, '#b8bcc4'); R(g, 75, 86, 58, 1, '#d8dce4');                                   // the kick plate
      // the steps: a steel stair unit, its grated treads getting wider and lower as they come toward you, each one a lit
      // tread on top of a shadowed riser, between two stringers
      for (let k = 0; k < 5; k++) {
        const y = 94 + k * 8, x0 = 58 - k * 4, x1 = 148 + k * 4, tread = 3 + Math.round(k * .4);
        R(g, x0, y, x1 - x0, tread, '#b4b8c0'); for (let x = x0 + 2; x < x1 - 1; x += 3) R(g, x, y + 1, 1, tread - 1, '#8a8e96');   // the grating
        R(g, x0, y, x1 - x0, 1, '#d8dce4');                                                                  // the nosing catches the light
        R(g, x0, y + tread, x1 - x0, 8 - tread, '#4a4e56'); R(g, x0, y + tread, x1 - x0, 1, '#2a2c32');      // the open riser, dark behind
        R(g, x0 - 3, y, 3, 8, '#6a6e76'); R(g, x1, y, 3, 8, '#5a5e66');                                      // the stringers
      }
      // handrails (or none): a post at the top landing and one at the bottom on each side, the rail and a mid-rail sloping
      // down between them; the near post's foot sits on the gravel
      if (v !== 2) for (const s of [-1, 1]) {
        const xt = s < 0 ? 54 : 152, xb = s < 0 ? 38 : 168, top = [xt, 64], bot = [xb, 104];
        R(g, xt - 1, top[1], 3, 32, '#c89a08'); R(g, xt - 1, top[1], 1, 32, '#f2c418');                     // the landing post (farther: thinner)
        R(g, xb - 2, bot[1], 4, 31, '#c89a08'); R(g, xb - 2, bot[1], 2, 31, '#f2c418'); R(g, xb - 3, 133, 6, 2, '#5a5e66');   // the bottom post, on its base plate
        pxLine(g, top[0], top[1], bot[0], bot[1], '#f2c418', 3); pxLine(g, top[0], top[1] + 2, bot[0], bot[1] + 2, '#a87a08');   // the top rail, lit above and shaded under
        pxLine(g, top[0], top[1] + 16, bot[0], bot[1] + 16, '#e0b010', 2);                                    // the mid-rail
      }
      else for (const [x, y] of [[54, 94], [38, 126], [152, 94], [168, 126]]) { R(g, x - 2, y, 4, 2, '#5a5e66'); R(g, x - 1, y - 1, 2, 1, '#2a2c32'); }   // bolt plates where rails used to be, the rails nowhere
      // the first aid cabinet beside the door: a white steel box with real depth (its left side shows, it throws a shadow
      // on the siding), a hinge, a latch, and the cross; open and picked over when it's running low; gone when it's gone
      const kx = 158, ky = 20, kw = 50, kh = 44;
      if (v !== 3) {
        R(g, kx + 3, ky + kh, kw, 3, 'rgba(40,40,44,0.25)'); R(g, kx + kw, ky + 3, 3, kh, 'rgba(40,40,44,0.25)');   // its shadow on the wall
        R(g, kx - 5, ky + 2, 5, kh - 2, '#c8c8c0'); R(g, kx - 5, ky, 5, 2, '#e8e8e2'); R(g, kx - 5, ky + kh - 1, 5, 1, '#a8a8a0');   // its left side, in depth
        if (v === 1) {   // open: the door swung out to the left, the shelves mostly bare
          R(g, kx, ky, kw, kh, '#e8e8e0'); R(g, kx + 2, ky + 2, kw - 4, kh - 4, '#d8d8d0'); R(g, kx + 2, ky + 21, kw - 4, 2, '#b8b8b0');
          R(g, kx + 5, ky + 12, 8, 9, '#f4f4ee'); R(g, kx + 7, ky + 15, 4, 3, '#c8202a'); R(g, kx + 30, ky + 33, 10, 6, '#d8b0a0');   // one box of gauze, one lone bandage
          for (const [x, y] of [[kx + 16, ky + 18], [kx + 26, ky + 18], [kx + 8, ky + 37], [kx + 18, ky + 37]]) R(g, x, y, 8, 3, 'rgba(160,160,150,0.35)');   // clean spots where things used to sit
          R(g, kx - 22, ky - 1, 22, kh + 2, '#f4f4ee'); R(g, kx - 22, ky - 1, 2, kh + 2, '#d8d8d0'); R(g, kx - 16, ky + 14, 10, 16, '#2a9a4a'); R(g, kx - 19, ky + 19, 16, 6, '#2a9a4a'); }   // the open door, seen edge-on-ish
        else { R(g, kx, ky, kw, kh, '#f4f4ee'); R(g, kx, ky, kw, 1, '#ffffff'); R(g, kx + kw - 1, ky, 1, kh, '#d8d8d0');
          R(g, kx + 20, ky + 7, 10, 26, '#2a9a4a'); R(g, kx + 12, ky + 15, 26, 10, '#2a9a4a'); txt(g, 'FIRST AID', kx + kw / 2, ky + 36, '#2a9a4a', 1, 'c');
          for (const y of [ky + 6, ky + kh - 10]) R(g, kx + 1, y, 2, 5, '#a8acb4'); R(g, kx + kw - 5, ky + 18, 3, 8, '#8a8e96'); }   // hinges and the latch
      } else {   // gone: four screw holes and a clean rectangle of unfaded siding where it hung
        R(g, kx, ky, kw, kh, '#f4f2ea'); for (let x = kx; x < kx + kw; x += 8) R(g, x + ((8 - kx % 8) % 8), ky, 1, kh, '#dcdad2');
        for (const [x, y] of [[kx + 4, ky + 4], [kx + kw - 6, ky + 4], [kx + 4, ky + kh - 6], [kx + kw - 6, ky + kh - 6]]) { R(g, x, y, 2, 2, '#5a5e66'); }
      }
      // the kit's weekly check log, on a clipboard hung from a nail: a little askew, its pages curling
      R(g, 215, 25, 22, 38, 'rgba(40,40,44,0.22)'); R(g, 213, 22, 22, 38, '#8a6a3a'); R(g, 215, 25, 18, 33, '#f4f2ea');
      for (let k = 0; k < 5; k++) { R(g, 217, 29 + k * 5, 14, 1, '#9a9ea6'); if (v !== 3 && k < 4) R(g, 228, 28 + k * 5, 3, 1, '#2a5aa8'); }
      R(g, 220, 21, 8, 4, '#a8acb4'); R(g, 223, 18, 2, 3, '#5a5e66'); R(g, 231, 55, 2, 3, '#e4e2da');
      if (v === 3) worker(g, 106, 134, 2, { vest: false, shirt: '#8a5a3a', kneel: true });   // somebody hurt, waiting on the steps, holding one hand
      Z.vignette(g);
    },
    c_powerline(g, v, fl, t) {
      skyZ(g, ZH); CONA.farView(g, 71, 120); gravel(g, 120);
      // the pole, its crossarm and insulators, and the three lines
      R(g, 196, 0, 10, 135, '#6a4a2a'); R(g, 170, 14, 62, 6, '#5a3a1a'); for (const x of [176, 200, 224]) { R(g, x, 8, 4, 6, '#c8ccd4'); pxLine(g, x + 2, 9, 0, 12 + (x - 176) / 6, '#2a2c32'); }
      R(g, 160, 50, 32, 22, '#f2c418'); txt(g, 'LOOK', 176, 54, '#1d1f26', 1, 'c'); txt(g, 'UP', 176, 62, '#1d1f26', 1, 'c');
      if (v === 0) { R(g, 6, 14, 1, 100, '#f2c418'); lab(g, '25 FT', 10, 60, '#f2c418'); }
      if (v === 1) { pxLine(g, 0, 60, 150, 70, '#2a2c32'); for (const x of [40, 100]) { R(g, x - 1, 64 + x / 20, 3, 4, '#2a2c32'); pxEllipse(g, x, 72 + x / 20, 4, 5, '#ffffc0'); } R(g, 98, 66, 5, 10, 'rgba(0,0,0,0)'); for (const x of [40]) { R(g, x - 4, 68 + x / 20, 1, 8, '#2a2c32'); R(g, x + 4, 68 + x / 20, 1, 8, '#2a2c32'); } }
      if (v === 2) { pxLine(g, 20, 120, 120, 30, '#c8ccd4', 3); pxLine(g, 34, 124, 134, 34, '#c8ccd4', 3); for (let k = 1; k < 10; k++) pxLine(g, 20 + k * 10, 120 - k * 9, 34 + k * 10, 124 - k * 9, '#a8acb4'); worker(g, 40, 134, 2, {}); }
      if (v === 3) { R(g, 60, 26, 50, 22, '#f2c418'); R(g, 60, 26, 50, 3, '#ffe060'); pxLine(g, 80, 48, 110, 135, '#f07a1a', 5); worker(g, 84, 44, 2, { hat: '#f2c418' }); R(g, 116, 14, 1, 14, '#f2c418'); lab(g, '5 FT', 119, 18, '#f2c418'); }
      Z.vignette(g);
    },
    c_panel(g, v, fl, t) {
      gravel(g, 0); if (v === 3) { pxEllipse(g, 110, 120, 110, 16, '#5a7a8a'); for (let x = 20; x < 200; x += 22) R(g, x + (t * 6 % 22), 116, 8, 1, '#8ab0c0'); }
      R(g, 30, 0, 14, 135, '#8a6a3a');
      // the pedestal: hinged covers over GFCI receptacles, labeled breakers (or a missing cover and open knockouts)
      R(g, 44, 10, 150, 96, '#8a8e96'); R(g, 44, 10, 150, 4, '#a8acb4');
      for (const [x, y] of [[54, 26], [104, 26], [54, 62], [104, 62]]) { R(g, x, y, 40, 30, '#e8e8e0'); R(g, x + 6, y + 6, 10, 6, '#3a3c42'); R(g, x + 24, y + 6, 10, 6, '#3a3c42'); R(g, x + 6, y + 16, 12, 5, '#c8202a'); R(g, x + 22, y + 16, 12, 5, '#2a2c32'); txt(g, 'TEST', x + 12, y + 23, '#5a5e66', 1, 'c'); }
      if (v !== 2) { R(g, 154, 20, 34, 76, v === 1 ? '#9a9286' : '#a8acb4'); for (let k = 0; k < 4; k++) { R(g, 158, 26 + k * 17, 26, 10, '#f4f2ea'); txt(g, 'CKT' + (k + 1), 171, 28 + k * 17, v === 1 ? '#a8a49a' : '#1d1f26', 1, 'c'); } }
      else { R(g, 154, 20, 34, 76, '#2a2c32'); for (const [x, y] of [[160, 30], [176, 50], [162, 78]]) pxEllipse(g, x, y, 4, 4, '#1d1f26'); R(g, 166, 40, 4, 30, '#c8883a'); lab(g, 'NO TRIP', 120, 98, '#f2c418', 1, 'c'); }
      if (v === 1) speckle(g, 44, 10, 150, 96, '#7a6a4a', 600, 3);
      if (v === 3) { R(g, 60, 100, 120, 8, '#c8883a'); lab(g, 'LIVE LUGS', 120, 112, '#f2c418', 1, 'c'); }
      Z.vignette(g);
    },
    c_cords(g, v, fl, t) {
      gravel(g, 0); if (v === 3) pxEllipse(g, 130, 90, 90, 22, '#5a7a8a');
      // the cord: printed jacket, a three-prong plug (or two), a cord ramp (or a taped splice, or bare copper)
      for (let x = 0; x < ZW; x++) { const y = 70 + Math.sin(x / 40) * 10; R(g, x, y, 1, 7, '#f2a018'); R(g, x, y, 1, 1, '#ffc040'); }
      txt(g, v === 0 ? '12/3 SJOW' : v === 2 ? '18/2 SPT' : '12/3 SJOW', 40, 66 + Math.sin(1) * 10, '#5a3a08');
      if (v === 0) { R(g, 60, 62, 70, 24, '#f2c418'); R(g, 60, 62, 70, 3, '#ffe060'); stripes(g, 64, 70, 62, 10, '#f2c418', '#1d1f26', 4); }
      R(g, 180, 96, 34, 22, '#2a2c32'); R(g, 214, 100, 8, 3, '#c8c8c0'); R(g, 214, 110, 8, 3, '#c8c8c0'); if (v !== 2) R(g, 214, 105, 6, 3, '#a8a8a0');
      if (v === 2) { R(g, 108, 66, 22, 12, '#1d1f26'); lab(g, 'TAPE', 119, 56, '#ffffff', 1, 'c'); lab(g, 'NO GROUND', 197, 122, '#f2c418', 1, 'c'); }
      if (v === 3) { R(g, 120, 68, 16, 10, '#c8883a'); for (let k = 0; k < 4; k++) R(g, 122 + k * 4, 70, 2, 6, '#e8a050'); lab(g, 'COPPER', 128, 54, '#f2c418', 1, 'c'); }
      if (v === 1) lab(g, 'WALKWAY', 120, 100, '#ffffff', 1, 'c');
      Z.vignette(g);
    },
    c_cutsaw(g, v, fl, t) {
      plywood(g, 0, 70, ZW, 65, '#c8a070'); R(g, 0, 0, ZW, 70, '#9a9a92'); speckle(g, 0, 0, ZW, 70, '#7a7a72', 400, 3);
      // the circular saw: the blade, the lower guard (snapping back, or wedged open with a stick)
      pxEllipse(g, 70, 72, 36, 36, v === 1 ? '#8a7a6a' : '#c8ccd4'); for (let a = 0; a < 24; a++) { const r = 36, x = 70 + Math.cos(a / 24 * Math.PI * 2) * r, y = 72 + Math.sin(a / 24 * Math.PI * 2) * r; R(g, x - 1, y - 1, 2, 2, '#8a8e96'); } pxEllipse(g, 70, 72, 6, 6, '#4a4c52');
      g.fillStyle = '#8a8e96'; g.beginPath(); g.arc(70, 72, 40, Math.PI * 1.02, Math.PI * 1.98); g.lineTo(110, 70); g.lineTo(30, 70); g.closePath(); g.fill();   // the fixed upper guard
      R(g, 28, 68, 92, 6, '#5a5e66');                                                                     // the shoe
      R(g, 84, 22, 40, 24, '#2a6ad0'); R(g, 84, 22, 40, 4, '#4a8af0'); pxEllipse(g, 104, 34, 7, 7, '#1a4ab0');   // the motor housing
      pxLine(g, 108, 22, 140, 6, '#2a2c32', 8); pxLine(g, 140, 6, 150, 14, '#2a2c32', 8); R(g, 120, 8, 6, 6, '#d82020');   // the rear handle and trigger
      R(g, 44, 26, 18, 14, '#2a2c32');                                                                    // the front knob
      if (v !== 2) { g.fillStyle = '#c8202a'; g.beginPath(); g.arc(70, 72, 38, .1, Math.PI - .1); g.lineTo(32, 76); g.closePath(); g.fill(); }
      else { R(g, 96, 96, 34, 5, '#a07a48'); txt(g, 'STICK', 113, 104, '#1d1f26', 1, 'c'); }
      if (v === 1) for (let x = 120; x < 220; x += 10) R(g, x, 112, 8, 2, '#3a2a1a');
      // the grinder: guard on, or off, or a cracked disc
      R(g, 150, 30, 70, 20, '#d8a020'); R(g, 214, 26, 16, 28, '#3a3c42'); pxEllipse(g, 160, 64, 18, 18, v === 3 ? '#c8c8c0' : '#5a5e66'); pxEllipse(g, 160, 64, 4, 4, '#2a2c32');
      if (v !== 2) { g.fillStyle = '#8a8e96'; g.beginPath(); g.arc(160, 64, 20, Math.PI, Math.PI * 2); g.closePath(); g.fill(); }
      if (v === 3) { pxLine(g, 160, 64, 174, 78, '#1d1f26'); pxLine(g, 166, 70, 172, 62, '#1d1f26'); txt(g, 'CRACKED', 160, 88, '#c8202a', 1, 'c'); R(g, 200, 120, 30, 4, '#f2a018'); R(g, 210, 119, 8, 6, '#c8883a'); }
      Z.vignette(g);
    },
    c_silica(g, v, fl, t) {
      R(g, 0, 0, ZW, ZH, '#9a9a92'); gravel(g, 100);
      // the masonry saw: a block on the table under the blade, the water line (or a vacuum, or a broom)
      R(g, 40, 70, 140, 30, '#d82020'); R(g, 40, 70, 140, 4, '#e85050'); R(g, 60, 50, 80, 20, '#b8b6ae'); R(g, 60, 50, 80, 2, '#cac8c0');
      pxEllipse(g, 110, 40, 30, 30, '#8a8e96'); pxEllipse(g, 110, 40, 6, 6, '#4a4c52'); R(g, 78, 8, 64, 20, '#c8202a');
      if (v === 0) { pxLine(g, 150, 20, 230, 0, '#2a8a4a', 2); for (let k = 0; k < 5; k++) R(g, 100 + k * 4, 56 + (t * 20 + k * 4) % 12, 2, 2, '#8ab0c0'); R(g, 50, 96, 120, 6, 'rgba(140,140,130,0.8)'); txt(g, 'WET CUT', 110, 112, '#1d1f26', 1, 'c'); }
      if (v === 1) { R(g, 180, 60, 50, 60, '#f2c418'); pxEllipse(g, 205, 54, 22, 14, '#d8d0b8'); txt(g, 'FULL', 205, 80, '#1d1f26', 1, 'c'); pxLine(g, 150, 30, 182, 70, '#2a2c32', 3); }
      if (v === 2) { pxLine(g, 200, 40, 190, 130, '#8a6a3a', 2); R(g, 176, 126, 30, 6, '#d8b048'); for (let i = 0; i < 40; i++) R(g, 150 + hash(i) * 80, 96 + hash(i + 7) * 36, 3, 2, 'rgba(220,220,214,0.85)'); lab(g, 'DRY SWEEP', 205, 30, '#ffffff', 1, 'c'); }
      if (v === 3) { for (let i = 0; i < 160; i++) { const a = hash(i) * Math.PI * 2, r = hash(i + 50) * 70; R(g, 110 + Math.cos(a) * r * 1.4, 40 + Math.sin(a) * r * .8, 3, 3, 'rgba(210,210,206,0.8)'); } txt(g, 'DRY CUT', 110, 112, '#c8202a', 1, 'c'); }
      Z.vignette(g);
    },
    c_fuel(g, v, fl, t) {
      R(g, 0, 0, ZW, 100, '#eceae2'); for (let x = 0; x < ZW; x += 8) R(g, x, 0, 1, 100, '#d4d2ca'); gravel(g, 100);
      sign(g, 10, 6, 84, 30, 'danger', ['NO SMOKING', 'NO FLAMES']);
      // the safety cans (and a soda bottle of gas), the propane rack, and the extinguisher
      for (const x of [14, 52]) { R(g, x, 70, 32, 44, '#d82020'); R(g, x, 70, 32, 4, '#e85050'); R(g, x + 20, 62, 8, 8, '#f2c418'); lab(g, 'GAS', x + 16, 86, '#f2c418', 1, 'c'); }
      if (v === 2) { R(g, 90, 88, 12, 26, 'rgba(200,220,160,0.85)'); R(g, 92, 82, 8, 6, '#3a8a3a'); txt(g, 'GAS?', 96, 76, '#c8202a', 1, 'c'); }
      for (const [k, x] of [[0, 118], [1, 148]]) { const lean = v === 2 && k === 1 ? 10 : 0, cx = x + 12 + lean;   // propane cylinders: body, rounded shoulder, collar, valve, foot ring
        g.fillStyle = '#e8e8e0'; g.beginPath(); g.moveTo(x, 116); g.lineTo(x + 24, 116); g.lineTo(x + 24 + lean, 44); g.lineTo(x + lean, 44); g.closePath(); g.fill();
        pxEllipse(g, cx, 44, 12, 10, '#e8e8e0'); R(g, cx - 2, 26, 4, 10, '#a8acb4'); R(g, cx - 7, 30, 14, 4, '#a8acb4'); R(g, cx - 1, 24, 3, 3, v === 2 ? '#c8a030' : '#8a8e96');
        R(g, x - 1, 112, 26, 6, '#a8acb4'); R(g, x + 2 + lean / 2, 70, 20, 1, '#c8c8c0'); lab(g, 'LP', cx - lean / 3, 80, '#5a5e66', 1, 'c'); }
      if (v !== 2) { R(g, 112, 54, 66, 3, '#8a8e96'); R(g, 112, 90, 66, 3, '#8a8e96'); }
      R(g, 196, 44, 18, 50, '#d82020'); R(g, 200, 36, 10, 8, '#2a2c32'); R(g, 216, 50, 18, 26, '#f4f2ea'); txt(g, v === 1 ? 'SEP' : 'OCT', 225, 58, '#1d1f26', 1, 'c'); if (v === 1) txt(g, 'OCT?', 225, 66, '#c8202a', 1, 'c');
      if (v === 3) { worker(g, 90, 134, 2, { vest: false, shirt: '#5a5a6a' }); R(g, 96, 82, 6, 1, '#f4f2ea'); R(g, 102, 82, 1, 1, '#ff6a2a'); for (let k = 0; k < 4; k++) R(g, 103 + Math.sin(t * 3 + k) * 2, 78 - k * 4 - (t * 8 % 4), 1, 1, 'rgba(220,220,220,0.8)'); }
      Z.vignette(g);
    }
  });
})();
