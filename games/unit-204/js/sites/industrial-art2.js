'use strict';
/* ============================== LOT 204: INDUSTRIAL ART, PART 2 ==============================
   The racking aisle, the production floor, and the maintenance shop: how each area draws itself (with every
   feature showing its condition from across the room), their close-ups, the left-behind sprites, and the title
   screen's truck yard outside Lot 204. Uses the shared pieces in INDA (js/sites/industrial-art.js). */
INDA.G.racks = { bays: [7.5, 10.3, 13.1, 15.8], levels: [1.6, 3.0, 4.4], loadH: 1.1, face: 4.4, back: 6.4, spr: 6.25, exit: [-.8, .8], doors: [[-3.9, -2.4], [2.4, 3.9]], ladder: [2.9, 9.0] };
INDA.G.prod = { saw: [-4.8, -2.6, 8.2, 9.4], belt: [3.2, 5.0, 9.2, 10.4], conv: [-5.6, .4, 13.2, 14.2], exit: [1.4, 3.0], noise: [10, 11.4], hose: [10.8, 12.0], doors: [8.4, 10] };
INDA.G.shop = { bench: [-3.0, .2], shelf: [.8, 4.2], flam: [8, 9.6], cyl: [11, 12.6], press: [10.6, 12.8], hoist: { x: .4, z: 10.6 }, door: [8.2, 9.9] };
(() => {
  const { txt, R, concrete, cmu, ribbed, tread, stripes, bolt, sign } = INDA, ZA = INDA.ZOOM_ART;
  const GR = INDA.G.racks, GP = INDA.G.prod, GS = INDA.G.shop;
  const Qx = (x, za, zb, ya, yb) => [P(x, ya, za), P(x, ya, zb), P(x, yb, zb), P(x, yb, za)];
  const Qz = (z, xa, xb, ya, yb) => [P(xa, ya, z), P(xb, ya, z), P(xb, yb, z), P(xa, yb, z)];
  const BLUE = '#2a5aa8', ORANGE = '#e8781a', CART = '#c8a070', CART2 = '#b08850', WRAP = 'rgba(230,240,250,0.35)';
  const lights = r => !r.lightsOff;
  /* a carton stack on a pallet, as a box in the room */
  function loadBox(g, x0, x1, y0, h, z0, z1, c = CART) {
    box3(g, x0, x1, y0, y0 + .14, z0, z1, { front: '#a07a48', top: '#b08a58', side: '#8a6a3a' });
    box3(g, x0 + .05, x1 - .05, y0 + .14, y0 + h, z0 + .05, z1 - .05, { front: c, top: mix(c, '#ffffff', .18), side: mix(c, '#000000', .14) });
    lineW(g, P(x0 + .05, y0 + .14 + (h - .14) / 2, z0 + .05), P(x1 - .05, y0 + .14 + (h - .14) / 2, z0 + .05), mix(c, '#000000', .2));
  }

  /* ============================== THE RACKING AISLE ==============================
     Pallet racks down both sides (blue uprights, orange beams, three levels of cartons), a marked aisle down the
     middle to an emergency exit in the back wall, sprinkler mains running over each rack, and a rolling ladder. */
  INDA.racks = {
    walls(g, r) {
      const zb = r.box.zb, uv = cond('i_upright'), pv = cond('i_plaque'), bv = cond('i_beamlock'), av = cond('i_aisle'), sv = cond('i_sprinkrack'), lv = cond('i_ladder');
      // the aisle: yellow edge lines, and a hatched pedestrian crossing at the front
      for (const x of [-4.05, 3.95]) for (let z = 4.8; z < zb - .2; z += av === 1 ? 1.1 : .6) fillPoly(g, Q.floor(x, x + .1, z, z + (av === 1 ? .35 : .5)), av === 1 ? 'rgba(216,184,40,0.45)' : '#d8b828');
      for (let x = -3.6; x < 3.6; x += .6) fillPoly(g, Q.floor(x, x + .3, 6.6, 7.1), av === 1 ? 'rgba(240,240,232,0.35)' : '#ecece4');
      // the emergency exit at the end of the aisle
      const [ea, eb] = GR.exit;
      fillPoly(g, Q.back(r.box, ea - .1, eb + .1, 0, 3.1), '#8a8e96'); fillPoly(g, Q.back(r.box, ea, eb, 0, 3), '#b8bcc4');
      fillPoly(g, Q.back(r.box, ea + .1, eb - .1, 1.3, 1.45), '#d8dce4'); lineW(g, P(ea + .1, 1.3, zb), P(eb - .1, 1.3, zb), '#5a5e66');   // the panic bar
      { const p = P(0, 3.4, zb); INDA.exitSign(g, p[0], p[1] - 4, lights(r)); }
      if (av === 3) for (const [x, y] of [[-.7, 0], [.1, 0], [-.4, .8], [.4, .8], [-.1, 1.6]]) loadBox(g, x, x + .7, y, .8, zb - .9, zb - .2, CART2);   // product stacked against the exit
      // the racks, far bays first so the near ones overlap
      for (const side of [-1, 1]) {
        const bays = GR.bays, face = GR.face * side, back = GR.back * side, xin = Math.min(face, back), xout = Math.max(face, back);
        for (let b = bays.length - 2; b >= 0; b--) {
          const z0 = bays[b] + .12, z1 = bays[b + 1] - .12;
          for (let l = 0; l < GR.levels.length; l++) {
            let y = GR.levels[l], h = GR.loadH, c = (b + l) % 3 ? CART : '#c89a64';
            const sag = side > 0 && b === 0 && pv === 3 && l > 0 ? .18 : 0;
            if (side > 0 && b >= 1 && l === 2 && sv === 2) h = 1.65;                                   // stacked to the sprinklers
            if (side > 0 && b === 0 && pv === 3 && l > 0) c = '#5a6a7a';                              // steel drums, far too heavy for these beams
            let x0 = xin + .1, x1 = xout - .1;
            if (side < 0 && b === 1 && l === 1 && bv === 1) x1 += .35;                                  // a pallet hanging over the beam
            if (side < 0 && b === 1 && l === 2 && bv === 3) { box3(g, -4.6, -3.7, y - .4, y + .7, z0 + .3, z1 - .4, { front: CART, top: '#d8b484', side: '#a07c4a' }); continue; }   // half off the beam, tipping into the aisle
            loadBox(g, x0, x1, y - sag, h, z0, z1, c);
            if (side < 0 && b === 1 && l === 2 && bv === 2) { const a = P(-4.5, y + .1, z0 + .2), q = P(-4.5, y + .05, z1 - .4); pxLine(g, a[0], a[1], q[0], q[1] + 2, '#6a4a2a', 2); }   // a cracked pallet up top
            if (side > 0 && b >= 1 && l === 2 && sv === 1) { const a = P(4.5, y + h, z0 + .6); pxLine(g, a[0], a[1], a[0] - 2, a[1] + 10, 'rgba(240,248,255,0.7)'); pxLine(g, a[0] + 3, a[1], a[0] + 1, a[1] + 14, 'rgba(240,248,255,0.6)'); }   // shrink wrap hanging
          }
          // beams on the aisle face, between this bay's uprights
          for (const l of GR.levels) {
            const sag = side > 0 && b === 0 && pv === 3 && l > GR.levels[0] ? .16 : 0, a = P(face, l, z0 - .1), m = P(face, l - sag, (z0 + z1) / 2), q = P(face, l, z1 + .1);
            pxLine(g, a[0], a[1], m[0], m[1], ORANGE, Math.max(2, Math.round(300 / z0 * .022))); pxLine(g, m[0], m[1], q[0], q[1], ORANGE, Math.max(2, Math.round(300 / z1 * .022)));
          }
        }
        // the uprights (front posts on the aisle face)
        for (const z of bays) {
          const kink = side < 0 && z === bays[0] && uv === 3, a = P(face, 0, z), t = P(face, GR.levels[2] + 1.2, z), w = Math.max(2, Math.round(300 / z * .03));
          if (kink) { const m = P(face + .25, .9, z); pxLine(g, a[0], a[1], m[0], m[1], BLUE, w); pxLine(g, m[0], m[1], t[0] + 3, t[1], BLUE, w); }
          else pxLine(g, a[0], a[1], t[0], t[1], BLUE, w);
          if (side < 0 && z === bays[0]) {                                                             // the column guard at the aisle end, and the plate
            box3(g, face - .05, face + .25, 0, .7, z - .2, z + .1, { front: '#f2c418', side: '#c89a08', top: '#ffe060' });
            if (uv === 1) for (let i = 0; i < 4; i++) { const p = P(face + .26, .2 + i * .12, z - .1 + i * .05); pxRect(g, p[0], p[1], 2, 1, '#8a8e96'); }
            if (uv === 2) { const p = P(face + .02, .55, z); pxRect(g, p[0] - 1, p[1] - 2, 3, 4, '#1a2a4a'); }
          }
          if (side > 0 && z === bays[0] && pv !== 2) { const p = P(face, 1.25, z); pxRect(g, p[0] - 2, p[1] - 3, 5, 6, pv === 1 ? '#e8e0c4' : '#f6f4ec'); pxRect(g, p[0] - 2, p[1] - 3, 5, 1, '#c8202a'); }   // the capacity plaque
        }
        // the sprinkler main over the rack, with a head over each bay
        const sx = side * 5.4, sy = GR.spr; lineW(g, P(sx, sy, 4), P(sx, sy, zb), '#c43a3a');
        for (const z of [8.9, 11.7, 14.5]) {
          const p = P(sx, sy, z), crook = side > 0 && z === 11.7 && sv === 3;
          pxRect(g, p[0] - 1, p[1], 2, 3, '#c8ccd4'); pxRect(g, p[0] + (crook ? 1 : -2), p[1] + 3, 5, 1, '#d8b440');
          if (crook && Settings.get('motion') && Math.floor(Game.t * 2) % 3 === 0) pxRect(g, p[0] + 2, p[1] + 5 + Math.floor(Game.t * 10) % 6, 1, 2, '#9fd4f0');
        }
      }
      // the rolling ladder (parked by the right rack, or out in the walkway, or jacked up on a pallet)
      { const at = lv === 1 ? [-.4, 10.4] : GR.ladder, lift = lv === 3 ? .16 : 0, [lx, lz] = at;
        if (lv === 3) box3(g, lx - .1, lx + 1.1, 0, .16, lz - .1, lz + 1.2, { front: '#a07a48', top: '#b08a58', side: '#8a6a3a' });
        for (const dx of [0, 1]) { const a = P(lx + dx, lift, lz), b = P(lx + dx, lift + 2.5, lz + 1); pxLine(g, a[0], a[1], b[0], b[1], '#8a8e96', 2); }
        for (let k = 1; k < 6; k++) { const a = P(lx, lift + k * .45, lz + k * .18), b = P(lx + 1, lift + k * .45, lz + k * .18); pxLine(g, a[0], a[1], b[0], b[1], '#b4b8c0', 2); }
        for (const dx of [0, 1]) { const a = P(lx + dx, lift + 2.5, lz + 1), b = P(lx + dx, lift + 3.4, lz + 1.05); pxLine(g, a[0], a[1], b[0], b[1], '#f2c418', 2); }   // handrails
        for (const dx of [0, 1]) { const p = P(lx + dx, lift, lz); pxRect(g, p[0] - 1, p[1] - 1, 3, 2, '#2a2c32'); } }
      // a convex mirror on the back wall, for the blind cross aisle behind the racks
      { const p = P(-3.2, 3.6, zb - .3); pxEllipse(g, p[0], p[1], 4, 4, '#2a2c32'); pxEllipse(g, p[0], p[1], 3, 3, '#a8c0d8'); pxRect(g, p[0] - 1, p[1] - 2, 1, 1, '#ffffff'); }
      if (av === 2) for (const [x, z] of [[-3.8, 13.2], [-3.1, 14.2], [-3.8, 14.6]]) loadBox(g, x, x + .8, 0, .9, z, z + .8, CART2);   // pallets staged in the aisle by the exit
      // the aisle number, hanging from the deck over the middle of the aisle (with somebody's smiley sticker on it)
      { const a = P(0, r.box.h, 12), p = P(0, 5.3, 12); pxLine(g, a[0] - 4, a[1], p[0] - 4, p[1], '#5a5e66'); pxLine(g, a[0] + 4, a[1], p[0] + 4, p[1], '#5a5e66'); pxRect(g, p[0] - 7, p[1], 14, 9, '#2a5aa8'); INDA.txt(g, '4', p[0], p[1] + 2, '#ffffff', 1, 'c'); pxRect(g, p[0] + 3, p[1] + 2, 2, 2, '#f2c418'); }
      INDA.backOpening(g, r, ...GR.doors[0]); INDA.backOpening(g, r, ...GR.doors[1]);   // back to the dock (left), on to the production floor (right)
      for (const [x, z] of [[-2.4, 6], [2.4, 6], [-2.4, 11.5], [2.4, 11.5]]) INDA.highbay(g, r, x, z, lights(r), .9);
    },
    dynamic(g, r, t) { if (lights(r)) for (const [x, z] of [[-2.4, 6], [2.4, 6], [-2.4, 11.5], [2.4, 11.5]]) INDA.highbayGlow(g, r, x, z, .9, .1); }
  };

  /* ============================== THE PRODUCTION FLOOR ==============================
     A cut-off saw on its table at the front left, a belt-driven machine on the right, a roller conveyor across the
     back, the hearing protection station on the left wall, an air hose reel on the right wall, and the emergency exit
     in the back right corner with its extinguisher. */
  INDA.prod = {
    walls(g, r) {
      const zb = r.box.zb, sv = cond('i_saw'), bv = cond('i_belt'), cv = cond('i_conveyor'), nv = cond('i_noise'), hv = cond('i_airhose'), ev = cond('i_exitdoor');
      // floor paint: gray work cells with yellow borders
      for (const [xa, xb, za, zb2] of [[-5.4, -2, 7.6, 10], [2.6, 5.6, 8.6, 11]]) { for (const z of [za, zb2]) fillPoly(g, Q.floor(xa, xb, z, z + .08), '#d8b828'); for (const x of [xa, xb]) fillPoly(g, Q.floor(x, x + .08, za, zb2), '#d8b828'); }
      // the exit door and its extinguisher (back right)
      const [ea, eb] = GP.exit;
      fillPoly(g, Q.back(r.box, ea - .1, eb + .1, 0, 3.1), '#8a8e96'); fillPoly(g, Q.back(r.box, ea, eb, 0, 3), ev === 3 ? '#a8acb4' : '#b8bcc4');
      fillPoly(g, Q.back(r.box, ea + .1, eb - .1, 1.3, 1.45), '#d8dce4');
      if (ev === 3) { const a = P(ea + .7, 1.4, zb), b = P(ea + 1.0, 1.1, zb); pxLine(g, a[0], a[1], b[0], b[1], '#5a5e66', 2); pxRect(g, b[0] - 1, b[1], 4, 4, '#c8a030'); }   // chained and padlocked
      { const p = P((ea + eb) / 2, 3.4, zb); INDA.exitSign(g, p[0], p[1] - 4, lights(r) && ev !== 1); }
      if (ev === 2) loadBox(g, eb + .4, eb + 1.2, 0, 1.1, zb - 1, zb - .3, '#5a6a7a');               // a parts cart parked in front of the extinguisher
      INDA.extinguisherBack(g, r, eb + .8, .9);
      // the conveyor across the back: a roller bed on legs, with cartons riding it
      { const [xa, xb, za, zb2] = GP.conv;
        for (const x of [xa + .3, (xa + xb) / 2, xb - .3]) box3(g, x, x + .12, 0, 1, za + .2, za + .32, { front: '#6a6e76', side: '#5a5e66' });
        box3(g, xa, xb, .9, 1.1, za, zb2, { front: '#3a5a8a', top: '#c8ccd4', side: '#2a4a7a' });
        for (let x = xa + .2; x < xb; x += .3) lineW(g, P(x, 1.1, za), P(x, 1.1, zb2), '#8a8e96');
        for (const x of [xa + 1.4, xa + 3.6, xa + 5.8]) loadBox(g, x, x + .8, 1.1, .7, za + .1, zb2 - .1);
        // the tail pulley at the left end, guarded or not
        if (cv === 2) { const p = P(xa, 1.0, za); pxEllipse(g, p[0], p[1], 3, 3, '#c8ccd4'); pxRect(g, p[0] - 1, p[1] - 1, 2, 2, '#4a4c52'); }
        else box3(g, xa - .3, xa, .7, 1.25, za, zb2, { front: '#f2c418', side: '#c89a08', top: '#ffe060' });
        // the e-stop on its post, or buried behind boxes
        box3(g, xb + .2, xb + .32, 0, 1.4, za, za + .12, { front: '#6a6e76' }); const sp = P(xb + .26, 1.45, za); pxRect(g, sp[0] - 2, sp[1] - 2, 4, 3, '#d82020');
        if (cv === 2) loadBox(g, xb + .05, xb + .9, 0, 1.3, za - .9, za - .1, CART2);
        if (cv === 3) { const a = P(xa + 4.2, 0, za - .4), b = P(xa + 4.2, 0, zb2 + .4); pxLine(g, a[0], a[1], b[0], b[1], 'rgba(30,30,34,0.5)', 2); pxLine(g, a[0] + 6, a[1], b[0] + 4, b[1], 'rgba(30,30,34,0.5)', 2); }   // a worn path ducking under the line
        if (cv === 1) for (let i = 0; i < 10; i++) { const p = P(xa + hash(i) * (xb - xa), 0, za - .2 + hash(i + 3) * .4); pxRect(g, p[0], p[1], 3, 1, '#c8a878'); } }
      // the hearing protection station on the left wall: a sign and a dispenser
      { const [za, zb2] = GP.noise, q = Q.left(r.box, za, zb2, 2.0, 2.9); fillPoly(g, q, '#f6f4ec'); const c = polyBox(q); pxRect(g, c.x0, c.y0, c.x1 - c.x0, 3, '#2a5aa8');
        const d = Q.left(r.box, za + .3, za + .9, 1.0, 1.6); fillPoly(g, d, nv === 1 ? '#d8dce4' : '#e8f0f4'); strokePoly(g, d, '#8a8e96');
        if (nv !== 1) { const db = polyBox(d); for (let i = 0; i < 6; i++) pxRect(g, db.x0 + 1 + (i % 3) * 2, db.y1 - 3 - Math.floor(i / 3) * 2, 1, 1, '#f28c28'); }
        if (nv === 2) { const db = polyBox(d); pxRect(g, db.x0, db.y0, db.x1 - db.x0, db.y1 - db.y0, '#3a3a40'); } }   // the station's been taken down: just its bracket
      AmbFX.shadow(g, GP.saw[0], GP.saw[1], GP.saw[2], GP.saw[3]); AmbFX.shadow(g, GP.belt[0], GP.belt[1], GP.belt[2], GP.belt[3], 1.2);
      // the cut-off saw on its table (front left)
      { const [xa, xb, za, zb2] = GP.saw;
        box3(g, xa, xb, .9, 1.0, za, zb2, { front: '#6a6e76', top: '#8a8e96', side: '#5a5e66' });
        for (const x of [xa + .1, xb - .2]) box3(g, x, x + .1, 0, .9, za + .1, za + .2, { front: '#4a4c52' });
        box3(g, -3.9, -3.3, 1.0, 1.7, za + .3, za + .9, { front: '#2a5aa8', top: '#3a6ab8', side: '#1a4a98' });   // the motor head
        const bc = P(-3.6, 1.25, za + .2);
        if (sv === 3) { pxEllipse(g, bc[0], bc[1], 6, 6, '#c8ccd4'); for (let a = 0; a < 6.28; a += .5) pxRect(g, bc[0] + Math.cos(a + Game.t * 9) * 6, bc[1] + Math.sin(a + Game.t * 9) * 6, 1, 1, '#5a5e66'); }   // spinning, nothing over it
        else { fillPoly(g, [[bc[0] - 7, bc[1] - 5], [bc[0] + 7, bc[1] - 5], [bc[0] + 8, bc[1] + 4], [bc[0] - 8, bc[1] + 4]], sv === 1 ? 'rgba(200,200,190,0.85)' : 'rgba(220,235,245,0.6)'); strokePoly(g, [[bc[0] - 7, bc[1] - 5], [bc[0] + 7, bc[1] - 5], [bc[0] + 8, bc[1] + 4], [bc[0] - 8, bc[1] + 4]], '#f2c418'); }
        if (sv === 2) { const p = P(-3.0, 1.3, za + .2); pxRect(g, p[0], p[1], 4, 3, '#1a1a1e'); }
        for (let i = 0; i < 8; i++) { const p = P(xa + hash(i * 2) * 2, 0, za - .3 + hash(i + 5) * .5); pxRect(g, p[0], p[1], 1, 1, '#c8b890'); } }
      // the belt-driven machine (right): a motor below, a belt guard up the side
      { const [xa, xb, za, zb2] = GP.belt;
        box3(g, xa, xb, 0, 1.6, za, zb2, { front: '#3a6a5a', top: '#4a7a6a', side: '#2a5a4a' });
        box3(g, xa + .3, xb - .3, 1.6, 2.4, za + .2, zb2 - .2, { front: '#3a6a5a', top: '#4a7a6a', side: '#2a5a4a' });
        if (bv === 2 || bv === 3) { const p = P(xa, .8, za + .4), q = P(xa, 2.0, za + .6); pxLine(g, p[0], p[1], q[0], q[1], '#1a1a1e', 2); pxEllipse(g, p[0], p[1], 3, 3, '#8a8e96'); pxEllipse(g, q[0], q[1], 2, 2, '#8a8e96'); }   // the belt and pulleys, bare
        else { box3(g, xa - .2, xa, .5, 2.2, za + .2, za + .9, { front: '#f2c418', side: '#c89a08', top: '#ffe060' }); if (bv === 1) { const p = P(xa - .1, 1.2, za + .2); pxRect(g, p[0], p[1], 3, 2, '#a88010'); } }
        if (bv === 3) { const p = P(xa - .4, .2, za + .3); pxRect(g, p[0] - 2, p[1] - 6, 5, 6, '#3a3c42'); } }   // a stool pulled right up to the open belt
      // the air hose reel on the right wall, its hose
      { const [za, zb2] = GP.hose, c = P(r.box.x1, 2.2, (za + zb2) / 2); pxEllipse(g, c[0], c[1], 5, 5, '#d82020'); pxEllipse(g, c[0], c[1], 2, 2, '#3a3c42');
        if (hv === 1) { const pts = [c, P(5.7, 0, 11.4), P(5.7, 0, 8.4), P(2, 0, 8.0), P(-1, 0, 7.4)]; for (let k = 1; k < pts.length; k++) pxLine(g, pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], '#e8c030', 2); }   // run across the walkway
        else { const p = P(r.box.x1, 1.2, za + .3); pxLine(g, c[0], c[1] + 4, p[0], p[1], '#e8c030', 2); } }
      // the posted PPE hazard assessment on the back wall: a framed sheet with a signature line
      { const q = Q.back(r.box, -6, -4.8, 2.2, 3.2), c = polyBox(q); fillPoly(g, q, '#f6f4ec'); strokePoly(g, q, '#5a5e66'); pxRect(g, c.x0 + 2, c.y0 + 2, c.x1 - c.x0 - 4, 2, '#2a5aa8');
        for (let k = 0; k < 4; k++) pxRect(g, c.x0 + 3, c.y0 + 6 + k * 3, (c.x1 - c.x0 - 6) * (k % 2 ? .6 : .85), 1, '#9a9ea6'); pxRect(g, c.x1 - 9, c.y1 - 3, 6, 1, '#2a2c32'); }
      INDA.opening(g, r, 'left', ...GP.doors); INDA.opening(g, r, 'right', ...GP.doors);
      for (const [x, z] of [[-3, 6.5], [3, 6.5], [-3, 12], [3, 12]]) INDA.highbay(g, r, x, z, lights(r), .9);
    },
    dynamic(g, r, t) {
      if (lights(r)) for (const [x, z] of [[-3, 6.5], [3, 6.5], [-3, 12], [3, 12]]) INDA.highbayGlow(g, r, x, z, .9, .1);
      if (Settings.get('motion')) { const [xa, , za] = GP.conv; for (let k = 0; k < 3; k++) { const x = xa + ((t * .4 + k * 2.4) % 7.6), p = P(x, 1.15, za + .5); pxRect(g, p[0], p[1] - 4, 6, 4, '#d8b484'); } }   // cartons riding the line
    }
  };

  /* ============================== THE MAINTENANCE SHOP ==============================
     A steel workbench with the bench grinder on the back wall, the chemical shelf and eyewash station beside it,
     the yellow flammables cabinet and the gas cylinder cart on the right wall, a punch press under repair on the
     left wall with its disconnect, and a chain hoist on a beam overhead. */
  INDA.shop = {
    walls(g, r) {
      const zb = r.box.zb, gv = cond('i_grinder'), lv = cond('i_loto'), yv = cond('i_cylinders'), fv = cond('i_flamcab'), cv = cond('i_chemshelf'), hv = cond('i_hoist');
      // the workbench and grinder
      { const [xa, xb] = GS.bench; box3(g, xa, xb, .85, .95, zb - .9, zb, { front: '#6a6e76', top: '#8a8e96' }); for (const x of [xa + .1, xb - .2]) box3(g, x, x + .1, 0, .85, zb - .8, zb - .7, { front: '#4a4c52' });
        fillPoly(g, Q.back(r.box, xa, xb, 1.2, 2.6), '#c8a878'); for (let x = xa + .2; x < xb; x += .25) for (let y = 1.3; y < 2.5; y += .25) { const p = P(x, y, zb); pxRect(g, p[0], p[1], 1, 1, '#8a6a48'); }   // pegboard
        const gx = (xa + xb) / 2, wob = gv === 3 && Settings.get('motion') ? Math.round(Math.sin(Game.t * 30)) : 0;
        box3(g, gx - .3, gx + .3, .95, 1.25, zb - .6, zb - .3, { front: '#3a5a3a', top: '#4a6a4a' });
        for (const s of [-1, 1]) { const c = P(gx + s * .45, 1.3, zb - .5); pxEllipse(g, c[0] + wob, c[1], 4, 4, '#8a8e96'); pxEllipse(g, c[0] + wob, c[1], 2, 2, gv === 1 ? '#c8c8c0' : '#a8a49a'); if (gv !== 3) pxRect(g, c[0] - 3 + wob, c[1] - 6, 6, 2, 'rgba(220,235,245,0.7)'); } }
      // the chemical shelf and the eyewash station
      { const [xa, xb] = GS.shelf; for (const y of [.1, 1.0, 1.9, 2.8]) box3(g, xa, xb, y, y + .06, zb - .5, zb, { front: '#8a8e96', top: '#a8acb4' });
        for (const x of [xa, xb - .06]) box3(g, x, x + .06, 0, 2.9, zb - .5, zb - .44, { front: '#6a6e76' });
        const bottles = [[.2, 1.06, '#3a6ad0'], [.6, 1.06, '#f2f2ea'], [1.1, 1.06, '#e8c030'], [1.6, 1.06, '#d43a2a'], [.3, 1.96, '#3f9a3a'], [.9, 1.96, '#f2f2ea'], [1.5, 1.96, '#3a6ad0'], [2.4, .16, '#5a6a7a'], [2.9, .16, '#5a6a7a']];
        for (const [dx, y, c] of bottles) { const lb = cv === 2 && c === '#f2f2ea'; box3(g, xa + dx, xa + dx + .3, y, y + .55, zb - .4, zb - .15, { front: c, top: mix(c, '#ffffff', .2) }); if (!lb) { const p = P(xa + dx + .05, y + .2, zb - .4); pxRect(g, p[0], p[1], 2, 2, '#ffffff'); } }
        if (cv === 3) fillPoly(g, floorBlob(xa + 2.6, zb - .8, .9, .35, 61, .4, 16), 'rgba(160,190,90,0.55)');
        const ex = xb + .7, ey = P(ex, 1.4, zb); if (cv !== 2) { fillPoly(g, Q.back(r.box, ex - .35, ex + .35, .2, 2.6), '#e8f0e8'); pxRect(g, ey[0] - 4, ey[1] - 2, 9, 3, '#2a9a4a'); pxEllipse(g, ey[0] - 2, ey[1] + 3, 2, 1, '#c8ccd4'); pxEllipse(g, ey[0] + 3, ey[1] + 3, 2, 1, '#c8ccd4'); }   // the plumbed eyewash
        const sd = Q.back(r.box, xb - .9, xb - .3, 3.2, 3.8); fillPoly(g, sd, cv === 1 ? '#e8dcb0' : '#f4f0e0'); const sb = polyBox(sd); pxRect(g, sb.x0, sb.y0, sb.x1 - sb.x0, 2, '#d43a2a'); }   // the SDS box
      // the flammables cabinet on the right wall
      { const [za, zb2] = GS.flam, x1 = r.box.x1; box3(g, x1 - .9, x1, 0, 2.2, za, zb2, { front: '#f2c418', side: '#d8aa0a', top: '#ffe060' });
        const q = Q.right({ ...r.box, x1: x1 - .9 }, za + .1, zb2 - .1, 1.4, 1.8), c = polyBox(q); if (fv !== 1) { pxRect(g, c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0, '#d82020'); }
        if (fv === 1) { box3(g, x1 - 1.6, x1 - 1.0, 0, .5, za - .5, za, { front: '#6a6e76', top: '#4a4c52' }); }   // a rag pile in an open bin
        if (fv >= 2) { box3(g, x1 - .8, x1 - .5, 2.2, 2.55, za + .2, za + .6, { front: '#d82020', top: '#e85050' }); box3(g, x1 - .8, x1 - .45, 2.2, 2.5, za + .8, za + 1.1, { front: '#f2f2ea', top: '#ffffff' }); }   // cans on the roof, a milk jug of gas
        if (fv === 3) { const p = P(x1 - 1.6, .3, za + .4); pxRect(g, p[0] - 4, p[1] - 6, 8, 6, '#3a3c42'); pxRect(g, p[0] - 3, p[1] - 5, 6, 3, '#ff6a2a'); fillPoly(g, floorBlob(x1 - 1.4, za + 1, .4, .2, 3, .4, 12), 'rgba(140,140,120,0.5)'); } }   // a glowing heater by an open solvent pan
      // the gas cylinders on their cart
      { const [za, zb2] = GS.cyl, x1 = r.box.x1;
        const cyls = yv === 3 ? [[za + .2, '#3f9a3a'], [za + .5, '#d43a2a']] : [[za + .2, '#3f9a3a'], [za + .5, '#3f9a3a'], [zb2 - .5, '#d43a2a'], [zb2 - .2, '#d43a2a']];
        if (yv !== 3) box3(g, x1 - .7, x1 - .1, 1.2, 1.32, za + .65, za + .75, { front: '#8a8e96' });       // the fire-rated divider
        for (const [z, c] of cyls) { box3(g, x1 - .55, x1 - .25, 0, 2.4, z - .12, z + .12, { front: c, side: mix(c, '#000000', .2) }); const p = P(x1 - .4, 2.45, z); pxRect(g, p[0] - 1, p[1] - 3, 3, 3, yv === 2 ? '#c8a030' : '#8a8e96'); }
        if (yv !== 2) lineW(g, P(x1 - .55, 1.6, za), P(x1 - .55, 1.6, zb2), '#c8ccd4');                     // the chain across them
        if (yv === 3) { const p = P(x1 - 1.6, .15, zb2 - .3), q = P(x1 - .3, .15, zb2); pxLine(g, p[0], p[1], q[0], q[1], '#d43a2a', 4); }   // one on the floor
        if (yv === 1) { const p = P(x1 - .4, 1.4, za + .5); txt(g, 'MT', p[0], p[1], '#ffffff'); } }
      // the punch press on the left wall, its disconnect box
      { const [za, zb2] = GS.press, x0 = r.box.x0;
        box3(g, x0, x0 + 1.3, 0, 2.6, za, zb2, { front: '#3a5a8a', top: '#4a6a9a', side: '#2a4a7a' }); box3(g, x0 + .2, x0 + 1.1, 1.4, 1.6, za - .3, za, { front: '#5a6a7a' });
        const d = Q.left(r.box, zb2 + .3, zb2 + .8, 1.4, 2.1); fillPoly(g, d, '#8a8e96'); strokePoly(g, d, '#5a5e66'); const c = polyBox(d);
        pxRect(g, c.cx - 1, c.cy - 3, 3, 6, lv === 3 ? '#3a3c42' : '#d82020');
        if (lv === 0 || lv === 1) { pxRect(g, c.cx + 2, c.cy, 3, 4, '#d82020'); pxRect(g, c.cx + 2, c.cy + 4, 4, 5, lv === 1 ? '#c8c0a0' : '#f8f4e0'); }   // a red lock and its tag
        if (lv === 2) pxRect(g, c.cx + 2, c.cy + 2, 4, 6, '#f8f4e0');                                                         // a tag, but no lock
        if (lv === 3) { const p = P(x0 + 1.3, .3, za + .5); pxRect(g, p[0] - 1, p[1] - 4, 6, 4, '#2a3a5a'); pxRect(g, p[0] + 5, p[1] - 2, 3, 2, '#2a2a30'); } }   // boots sticking out of the press
      // the hoist beam and chain hoist
      { const { x, z } = GS.hoist, h = r.box.h; lineW(g, P(-3, h - .7, z), P(4, h - .7, z), '#f2c418'); lineW(g, P(-3, h - .55, z), P(4, h - .55, z), '#c89a08');
        const top = P(x, h - .7, z), hook = P(x, hv === 3 ? 1.6 : 2.6, z); pxRect(g, top[0] - 3, top[1], 6, 5, '#d8b828'); pxLine(g, top[0], top[1] + 5, hook[0], hook[1], '#8a8e96');
        pxRect(g, hook[0] - 1, hook[1], 3, 3, '#e8c030');
        if (hv === 3) { loadBox(g, x - .5, x + .5, .9, .6, z - .4, z + .4, '#5a6a7a'); }   // a gearbox hanging at chest height
        else { const p = P(x + .2, 2.6, z); pxLine(g, p[0], p[1], p[0] + 4, p[1] + 10, hv === 2 ? '#c8a830' : '#2a8a4a', 2); } }
      INDA.opening(g, r, 'left', ...GS.door);
      INDA.extinguisherSide(g, r, 'right', 13.6);
      if (typeof INDL !== 'undefined') INDL.draw(g, r);                       // the employee lockers on the back wall (js/sites/industrial-crew.js)
      for (const [x, z] of [[-2.6, 7], [2.6, 7], [0, 12]]) INDA.highbay(g, r, x, z, lights(r), 1.1);
    },
    dynamic(g, r, t) {
      if (lights(r)) for (const [x, z] of [[-2.6, 7], [2.6, 7], [0, 12]]) INDA.highbayGlow(g, r, x, z, 1.1, .1);
      if (cond('i_grinder') === 0 && Settings.get('motion') && Math.floor(t * 3) % 4 === 0) { const p = P(-1.75, 1.3, r.box.zb - .5); for (let i = 0; i < 3; i++) pxRect(g, p[0] + 2 + i * 2, p[1] + 2 + i, 1, 1, '#ffd060'); }
    }
  };

  /* ============================== CLOSE-UPS ============================== */
  const wallOf = room => Decor.pal(room).wall;
  /* a pallet rack upright up close: blue C-channel with teardrop holes */
  function upright(g, x, y0, y1, w = 14, col = BLUE) {
    R(g, x, y0, w, y1 - y0, col); R(g, x, y0, 2, y1 - y0, mix(col, '#ffffff', .25)); R(g, x + w - 2, y0, 2, y1 - y0, mix(col, '#000000', .3));
    for (let y = y0 + 4; y < y1 - 4; y += 8) { pxEllipse(g, x + w / 2, y, 2, 2, mix(col, '#000000', .55)); R(g, x + w / 2 - 1, y + 2, 2, 2, mix(col, '#000000', .55)); }
  }
  /* an orange box beam */
  function beam(g, x, y, w, h = 9, sag = 0) {
    for (let i = 0; i < w; i++) { const d = sag * Math.sin(i / w * Math.PI); R(g, x + i, y + d, 1, h, ORANGE); R(g, x + i, y + d, 1, 2, '#ff9a3a'); R(g, x + i, y + d + h - 2, 1, 2, '#a85010'); }
  }
  /* a stack of cartons on a pallet, from the front */
  function cartons(g, x, y, w, h, seed = 1, c = CART) {
    R(g, x, y + h - 8, w, 8, '#b08850'); R(g, x, y + h - 8, w, 2, '#c8a068'); for (const bx of [x + 2, x + w / 2 - 3, x + w - 8]) R(g, bx, y + h - 6, 6, 6, '#7a5a34');
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) { const bw = w / 3, bh = (h - 8) / 3, cx = x + col * bw, cy = y + row * bh; R(g, cx, cy, bw - 1, bh - 1, mix(c, '#000000', hash(seed + row * 3 + col) * .12)); R(g, cx + bw / 2 - 2, cy, 4, bh - 1, 'rgba(160,120,70,0.5)'); }
    R(g, x, y, w, h - 8, 'rgba(220,235,250,0.12)');
  }
  const deck = (g, y, base = '#a8a69e') => concrete(g, 0, y, ZW, ZH - y, base, 3);
  const skyCol = () => Decor.time.sky[1];

  Object.assign(ZA, {
    /* ---------------- RACKING AISLE ---------------- */
    i_upright(g, v, fl, t) {
      cmu(g, 0, 0, ZW, 112, wallOf('i_racks'), 3); deck(g, 112);
      const kink = v === 3;
      if (kink) { for (let y = 0; y < 112; y++) { const off = y > 60 ? Math.round((y - 60) * .35) : Math.round(Math.max(0, 60 - y) * .05); upright(g, 108 + (y > 60 ? (y - 60) * .3 : 0), y, y + 1, 18); } fillPoly(g, [[108, 70], [126, 68], [132, 82], [112, 84]], '#1a3a7a'); pxCrack(g, 116, 72, .4, 16, '#0a1a3a', 4, 1); }
      else upright(g, 108, 0, 112, 18);
      R(g, 96, 104, 44, 10, '#6a6e78'); R(g, 96, 104, 44, 2, '#8a8e98');                                  // the footplate
      for (const x of [100, 130]) { if (v === 2 && x === 130) { pxEllipse(g, x + 2, 108, 2, 2, '#1a1a1e'); continue; } bolt(g, x + 2, 108); }   // anchor bolts (one missing)
      // the column guard
      R(g, 60, 72, 30, 42, '#f2c418'); R(g, 60, 72, 30, 3, '#ffe060'); for (let y = 78; y < 112; y += 10) stripes(g, 60, y, 30, 4, '#1d1f26', '#f2c418', 4);
      if (v === 1) for (let i = 0; i < 6; i++) pxLine(g, 64 + i * 4, 80 + (i % 3) * 7, 72 + i * 4, 82 + (i % 3) * 7, '#8a8e96');
      if (v === 2) { fillPoly(g, [[110, 40], [126, 38], [124, 54], [112, 56]], '#1a3a7a'); pxLine(g, 110, 40, 112, 56, '#0a1a3a'); R(g, 112, 44, 10, 2, '#c8ccd4'); }   // a forklift dent, paint scraped bright
      beam(g, 126, 30, 114, 10, kink ? 6 : 0); beam(g, 0, 30, 108, 10);
      cartons(g, 140, -20, 96, 50, 3); cartons(g, 0, -22, 100, 52, 5);
      Z.vignette(g);
    },
    i_plaque(g, v, fl, t) {
      cmu(g, 0, 0, ZW, ZH, wallOf('i_racks'), 5);
      const sag = v === 3 ? 10 : 0;
      upright(g, 10, 0, ZH, 16); upright(g, 214, 0, ZH, 16);
      if (v === 3) { for (const x of [36, 92, 148]) { R(g, x, 18 + sag, 48, 52, '#5a6a7a'); R(g, x, 18 + sag, 48, 3, '#7a8a9a'); for (const y of [30, 50]) R(g, x, y + sag, 48, 2, '#4a5a6a'); } }
      else cartons(g, 32, 4, 176, 66, 7);
      beam(g, 26, 72, 188, 11, sag);
      cartons(g, 32, 90 + (v === 3 ? 6 : 0), 176, 45, 9);
      if (v !== 2) {                                                     // the capacity plaque on the upright
        const pc = v === 1 ? '#e8e0c4' : '#f6f4ec'; R(g, 4, 30, 30, 34, '#3a3a40'); R(g, 5, 31, 28, 32, pc); R(g, 5, 31, 28, 6, v === 1 ? '#c87070' : '#c8202a');
        txt(g, 'MAX', 19, 33, '#ffffff', 1, 'c'); txt(g, '4000', 19, 41, v === 1 ? '#8a8a8a' : '#1d1f26', 1, 'c'); txt(g, 'LB', 19, 48, v === 1 ? '#8a8a8a' : '#1d1f26', 1, 'c'); txt(g, 'LVL', 19, 55, v === 1 ? '#8a8a8a' : '#1d1f26', 1, 'c');
        if (v === 1) { R(g, 6, 44, 26, 10, '#f8f4e0'); R(g, 8, 46, 20, 1, '#8a8a8a'); R(g, 8, 49, 14, 1, '#8a8a8a'); }   // a shipping label stuck half over it
      } else { R(g, 6, 30, 26, 32, 'rgba(0,0,0,0.08)'); for (const [x, y] of [[8, 32], [30, 32], [8, 60], [30, 60]]) R(g, x, y, 2, 2, '#4a4a52'); }   // where a plaque used to be
      if (v === 3) { txt(g, '55 GAL', 60, 38 + sag, '#e8e8e2'); txt(g, '55 GAL', 116, 38 + sag, '#e8e8e2'); }
      Z.vignette(g);
    },
    i_beamlock(g, v, fl, t) {
      cmu(g, 0, 0, ZW, ZH, wallOf('i_racks'), 7);
      upright(g, 0, 0, ZH, 20);
      beam(g, 20, 70, 220, 12);
      // the beam's end connector and its safety clip
      R(g, 20, 66, 16, 20, '#c86010'); R(g, 22, 68, 12, 16, '#d87020');
      if (v !== 2) { R(g, 24, 64, 4, 10, '#c8ccd4'); R(g, 23, 64, 6, 2, '#eef0f4'); }                   // the clip, pushed home
      else { pxEllipse(g, 26, 66, 2, 2, '#1a1a1e'); }
      // the pallet and load on the beam
      const out = v === 1 ? 14 : v === 3 ? 40 : 0, tilt = v === 3 ? 10 : 0;
      fillPoly(g, [[44 - out, 54 + tilt], [230, 54], [230, 70], [44 - out, 70 + tilt]], v === 2 ? '#9a7a48' : '#b08850');
      if (v === 2) { pxLine(g, 80, 56, 120, 68, '#4a3018', 2); pxLine(g, 120, 56, 104, 70, '#4a3018'); R(g, 140, 60, 18, 3, '#4a3018'); }   // cracked, broken deck boards
      for (const x of [60, 130, 200]) R(g, x - out * (1 - x / 230), 62 + tilt * (1 - x / 230), 10, 8, '#7a5a34');
      fillPoly(g, [[48 - out, 0 + tilt], [226, 0], [226, 54], [48 - out, 54 + tilt]], CART); for (let x = 50; x < 226; x += 30) R(g, x - out * (1 - x / 230), 0, 2, 54, 'rgba(160,120,70,0.5)');
      if (v === 3) { R(g, 0, 110, 60, 25, CART2); R(g, 8, 104, 30, 10, CART); txt(g, 'FRAGILE', 4, 118, '#c8202a'); }   // boxes already fallen into the aisle
      if (v === 0) { R(g, 40, 90, 200, 2, '#8a8e96'); for (let x = 44; x < 236; x += 8) R(g, x, 88, 1, 6, '#8a8e96'); }   // wire decking below
      Z.vignette(g);
    },
    i_aisle(g, v, fl, t) {
      const W = wallOf('i_racks'); cmu(g, 0, 0, ZW, 92, W, 9); deck(g, 92);
      // the exit door, its panic bar, and the sign
      R(g, 84, 6, 72, 88, '#8a8e96'); R(g, 88, 10, 64, 84, '#b8bcc4'); R(g, 92, 46, 56, 6, '#d8dce4'); R(g, 92, 50, 56, 1, '#6a6e76');
      R(g, 98, 0, 44, 8, '#3a3a40'); R(g, 100, 1, 40, 6, '#fbf6f0'); txt(g, 'EXIT', 120, 2, '#d82020', 1, 'c');
      // the aisle's painted lines, running toward you
      const fade = v === 1 ? .4 : 1;
      for (const [x0, x1] of [[40, -40], [200, 280]]) for (let y = 94; y < ZH; y += 6) { if (v === 1 && hash(y + x0) > .6) continue; const k = (y - 92) / 43; fillPoly(g, [[x0 + (x1 - x0) * k - 2, y], [x0 + (x1 - x0) * k + 2, y], [x0 + (x1 - x0) * ((y + 4 - 92) / 43) + 2, y + 4], [x0 + (x1 - x0) * ((y + 4 - 92) / 43) - 2, y + 4]], rgba('#d8b828', fade)); }
      if (v === 2) { cartons(g, 150, 54, 70, 50, 11, CART2); cartons(g, 30, 60, 60, 44, 13, CART2); R(g, 90, 112, 60, 2, '#d82020'); txt(g, '20 IN', 108, 104, '#d82020'); }   // pallets narrowing the way out
      if (v === 3) { cartons(g, 80, 30, 80, 66, 15, CART2); cartons(g, 94, 0, 52, 34, 17, CART2); }   // product stacked against the exit door
      Z.vignette(g);
    },
    i_sprinkrack(g, v, fl, t) {
      R(g, 0, 0, ZW, 40, '#4a4e56'); for (let x = 0; x < ZW; x += 8) R(g, x, 0, 4, 40, '#565a62');            // the roof deck above
      R(g, 0, 20, ZW, 12, '#c43a3a'); R(g, 0, 20, ZW, 2, '#e86a5a'); R(g, 0, 30, ZW, 2, '#8a2418');
      const crook = v === 3 ? 8 : 0;
      R(g, 116, 32, 8, 6, '#c8ccd4'); fillPoly(g, [[114, 38], [126, 38], [128 + crook, 46], [116 + crook, 46]], '#d8b440');
      R(g, 106 + crook, 46, 28, 3, '#d8b440'); R(g, 117 + crook * .7, 40, 6, 6, '#e86a3a');
      if (v === 3) { fillPoly(g, [[132, 34], [140, 30], [142, 36]], '#a8acb4'); if (Math.floor(t * 3) % 3 === 0) R(g, 130, 50 + Math.floor(t * 20) % 20, 2, 3, '#9fd4f0'); txt(g, 'CAGE', 140, 40, '#c8ccd4'); }   // the head's guard bent back, a drip
      // the top of the load, and the gap between them
      const top = v === 2 ? 58 : 92;
      cartons(g, 30, top, 180, ZH - top + 30, 19);
      if (v === 1) { pxLine(g, 60, top, 54, top + 30, 'rgba(240,248,255,0.8)'); pxLine(g, 70, top, 66, top + 38, 'rgba(240,248,255,0.7)'); pxLine(g, 64, top, 60, top + 26, 'rgba(240,248,255,0.6)'); }
      // the gap, measured
      R(g, 218, 49, 2, top - 49, '#f2c418'); R(g, 214, 49, 10, 1, '#f2c418'); R(g, 214, top - 1, 10, 1, '#f2c418'); txt(g, v === 2 ? '10' : '30', 206, (49 + top) / 2 - 2, '#f2c418', 1, 'r');
      Z.vignette(g);
    },
    i_ladder(g, v, fl, t) {
      cmu(g, 0, 0, ZW, 112, wallOf('i_racks'), 11); deck(g, 112);
      const lift = v === 3 ? 18 : 0;
      if (v === 3) { R(g, 40, 104, 160, 12, '#b08850'); R(g, 40, 104, 160, 2, '#c8a068'); for (const x of [46, 112, 180]) R(g, x, 112, 14, 6, '#7a5a34'); }   // a pallet under it
      // rails, steps, the top platform with its handrails, and the wheels
      for (const [x0, x1] of [[60, 80], [170, 150]]) pxLine(g, x0, 116 - lift, x1, 10 - lift, '#8a8e96', 4);
      for (let k = 0; k < 6; k++) { const y = 104 - lift - k * 16, x0 = 62 + k * 3.5, x1 = 168 - k * 3.5, broken = v === 2 && k === 2; R(g, x0, y, x1 - x0, 5, broken ? '#6a6e76' : '#b4b8c0'); for (let x = x0 + 2; x < x1; x += 4) R(g, x, y + 1, 2, 3, '#8a8e96'); if (broken) pxCrack(g, x0 + 30, y, .2, 30, '#2a2c32', 5, 1); }
      for (const x of [70, 160]) { pxLine(g, x, 10 - lift, x, -20, '#f2c418', 3); }
      for (const x of [62, 166]) { pxEllipse(g, x, 120 - lift, 6, 6, '#2a2c32'); pxEllipse(g, x, 120 - lift, 2, 2, '#8a8e96'); }
      // the step lock: a spring step that pushes rubber feet down when you stand on it
      R(g, 96, 112 - lift, 40, 8, '#2a2c32'); R(g, 98, 110 - lift, 36, 3, v === 2 ? '#5a5e66' : '#3f9a3a');
      if (v === 1) { R(g, 0, 128, ZW, 4, '#d8b828'); txt(g, 'WALKWAY', 180, 120, '#d8b828'); }               // parked across the walkway line
      Z.vignette(g);
    },
    /* ---------------- PRODUCTION FLOOR ---------------- */
    i_saw(g, v, fl, t) {
      concrete(g, 0, 0, ZW, ZH, '#8a8e96', 21);
      R(g, 0, 84, ZW, 20, '#6a6e76'); R(g, 0, 84, ZW, 3, '#9aa0aa');                                      // the table
      R(g, 92, 10, 70, 46, '#2a5aa8'); R(g, 92, 10, 70, 4, '#3a6ab8');                                     // the saw head
      const bx = 128, by = 66, spin = v === 3 ? t * 30 : 0;
      pxEllipse(g, bx, by, 26, 26, '#c8ccd4'); for (let k = 0; k < 24; k++) { const a = spin + k / 24 * 6.28; fillPoly(g, [[bx + Math.cos(a) * 24, by + Math.sin(a) * 24], [bx + Math.cos(a + .12) * 28, by + Math.sin(a + .12) * 28], [bx + Math.cos(a + .2) * 24, by + Math.sin(a + .2) * 24]], '#8a8e96'); }
      pxEllipse(g, bx, by, 5, 5, '#5a5e66');
      if (v !== 3) {                                                     // the guard: a polycarbonate hood over the blade, bolted at each side
        const cl = v === 1 ? 'rgba(200,200,190,0.82)' : 'rgba(220,235,245,0.5)';
        fillPoly(g, [[96, 40], [160, 40], [166, 96], [90, 96]], cl); strokePoly(g, [[96, 40], [160, 40], [166, 96], [90, 96]], '#f2c418');
        if (v === 1) for (let i = 0; i < 18; i++) pxLine(g, 96 + hash(i) * 60, 46 + hash(i + 2) * 46, 104 + hash(i) * 60, 50 + hash(i + 4) * 46, 'rgba(255,255,255,0.4)');
        bolt(g, 96, 46); if (v !== 2) bolt(g, 160, 46); else { pxEllipse(g, 160, 46, 2, 2, '#1a1a1e'); fillPoly(g, [[160, 40], [172, 44], [170, 96], [166, 96]], 'rgba(20,20,30,0.5)'); txt(g, '2 IN', 176, 60, '#f2c418'); }
      } else { R(g, 180, 20, 26, 14, '#3a3c42'); R(g, 182, 22, 22, 10, '#d8d8d0'); R(g, 182, 24, 22, 3, '#c8b890'); txt(g, 'TAPE', 186, 28, '#5a4a3a'); }   // the interlock switch, taped down
      R(g, 186, 6, 16, 12, '#2a2c32'); R(g, 188, 8, 12, 8, v === 3 ? '#40e060' : '#5a1a18');            // the running light
      for (let i = 0; i < 30; i++) R(g, 60 + hash(i) * 120, 96 + hash(i + 1) * 8, 2, 1, '#e8d8a8');         // sawdust and chips
      Z.vignette(g);
    },
    i_belt(g, v, fl, t) {
      R(g, 0, 0, ZW, ZH, '#3a6a5a'); R(g, 0, 0, ZW, 3, '#4a7a6a'); speckle(g, 0, 0, ZW, ZH, '#2a5a4a', 300, 3);
      const sp = t * (v === 3 ? 8 : 6), drive = () => {
        pxEllipse(g, 70, 100, 18, 18, '#8a8e96'); pxEllipse(g, 70, 100, 6, 6, '#4a4c52'); pxEllipse(g, 170, 34, 26, 26, '#8a8e96'); pxEllipse(g, 170, 34, 8, 8, '#4a4c52');
        pxLine(g, 70, 82, 170, 8, '#1a1a1e', 4); pxLine(g, 70, 118, 170, 60, '#1a1a1e', 4);
        for (let k = 0; k < 4; k++) { const a = sp + k * 1.57; pxLine(g, 170, 34, 170 + Math.cos(a) * 20, 34 + Math.sin(a) * 20, '#5a5e66', 2); }
      };
      drive();
      if (v === 0 || v === 1) {                                          // a yellow expanded-metal guard bolted over the whole drive
        fillPoly(g, [[40, 70], [70, 70], [200, 0], [204, 0], [204, 70], [96, 128], [40, 128]], 'rgba(242,196,24,0.9)');
        for (let y = 0; y < 128; y += 5) for (let x = 40 + (y % 10 ? 3 : 0); x < 204; x += 6) R(g, x, y, 3, 2, 'rgba(60,50,10,0.55)');
        clipDo(g, [[40, 70], [70, 70], [200, 0], [204, 0], [204, 70], [96, 128], [40, 128]], () => { g.globalAlpha = .25; drive(); g.globalAlpha = 1; });
        if (v === 1) { fillPoly(g, blobPts(140, 60, 16, 10, 7, .5, 12), 'rgba(140,110,10,0.8)'); pxCrack(g, 132, 56, .3, 14, '#5a4a0a', 3, 1); }
        for (const [x, y] of [[44, 74], [198, 4], [198, 64], [44, 124]]) bolt(g, x, y);
      } else {
        txt(g, '18 IN', 200, 110, '#f2c418');                                                              // the bare shaft end, spinning at knee height
        R(g, 196, 96, 30, 6, '#c8ccd4'); for (let k = 0; k < 3; k++) R(g, 200 + ((sp * 6 + k * 9) % 26), 96, 2, 6, '#6a6e76');
      }
      if (v === 3) { fillPoly(g, [[0, 30], [36, 40], [52, 50], [44, 56], [30, 50], [0, 46]], '#e0b088'); for (let k = 0; k < 4; k++) R(g, 44 + k * 3, 48 + k * 2, 6, 3, '#e0b088'); R(g, 0, 32, 20, 16, '#2a3a5a'); }   // a hand reaching for the belt
      Z.vignette(g);
    },
    i_conveyor(g, v, fl, t) {
      concrete(g, 0, 90, ZW, 45, '#8a8e96', 31); R(g, 0, 0, ZW, 90, wallOf('i_floor'));
      R(g, 0, 40, ZW, 14, '#3a5a8a'); R(g, 0, 40, ZW, 2, '#5a7aaa');                                     // the side rail
      for (let x = 0; x < ZW; x += 10) { R(g, x, 32, 8, 8, '#c8ccd4'); R(g, x, 32, 8, 2, '#eef0f4'); }    // rollers
      for (const x of [40, 200]) R(g, x, 54, 8, 40, '#6a6e76');
      if (Settings.get('motion') && v !== 3) { const x = ((t * 30) % 300) - 60; cartons(g, x, 0, 50, 36, 23); }
      // the tail pulley, guarded or bare, at the left end
      if (v === 2) { pxEllipse(g, 14, 40, 12, 12, '#c8ccd4'); pxEllipse(g, 14, 40, 4, 4, '#4a4c52'); for (let k = 0; k < 4; k++) { const a = t * 6 + k * 1.57; pxLine(g, 14, 40, 14 + Math.cos(a) * 10, 40 + Math.sin(a) * 10, '#6a6e76', 2); } }
      else { R(g, 0, 22, 30, 36, '#f2c418'); for (let y = 24; y < 56; y += 4) for (let x = 2 + (y % 8 ? 2 : 0); x < 28; x += 5) R(g, x, y, 3, 2, 'rgba(60,50,10,0.55)'); }
      // the pull cord along the line, and the e-stop
      if (v !== 2) { pxLine(g, 30, 60, 220, 60, '#f2c418'); for (let x = 50; x < 220; x += 40) R(g, x, 59, 2, 3, '#d82020'); }
      R(g, 212, 64, 22, 30, '#6a6e76'); pxEllipse(g, 223, 72, 7, 5, '#d82020'); pxEllipse(g, 223, 70, 6, 3, '#f04040');
      if (v === 2) cartons(g, 196, 46, 46, 50, 25, CART2);                                                // the e-stop buried behind product
      if (v === 1) for (let i = 0; i < 40; i++) R(g, hash(i) * ZW, 96 + hash(i + 7) * 36, 3, 1, '#c8a878');
      if (v === 3) { R(g, 0, 120, ZW, 2, 'rgba(30,30,34,0.4)'); pxLine(g, 100, 135, 120, 92, 'rgba(30,30,34,0.5)', 3); pxLine(g, 130, 135, 140, 92, 'rgba(30,30,34,0.5)', 3); R(g, 104, 96, 30, 6, '#2a3a5a'); txt(g, 'NO CROSSOVER', 120, 112, '#f2c418', 1, 'c'); }   // scuffed knees under the line: a duck-under path
      Z.vignette(g);
    },
    i_noise(g, v, fl, t) {
      cmu(g, 0, 0, ZW, ZH, wallOf('i_floor'), 41);
      sign(g, 18, 8, 104, 64, 'notice', ['HEARING', 'PROTECTION', 'REQUIRED', 'IN THIS AREA'], 1);
      if (v === 2) { R(g, 140, 30, 70, 70, 'rgba(0,0,0,0.1)'); for (const [x, y] of [[142, 32], [206, 32], [142, 96], [206, 96]]) R(g, x, y, 3, 3, '#4a4a52'); }   // the dispenser's gone: just its screw holes
      else {
        R(g, 140, 30, 70, 70, '#e8f0f4'); R(g, 140, 30, 70, 4, '#2a5aa8'); txt(g, 'EARPLUGS', 175, 36, '#2a5aa8', 1, 'c');
        R(g, 148, 44, 54, 40, 'rgba(200,220,235,0.6)');
        if (v !== 1) for (let i = 0; i < 40; i++) pxEllipse(g, 152 + hash(i) * 46, 60 + hash(i + 3) * 22, 2, 1, i % 3 ? '#f28c28' : '#f2c418');
        R(g, 168, 86, 14, 8, '#8a8e96');
      }
      // the sound meter clipped to the wall, reading out
      const db = v === 3 ? 98 : v === 2 ? 92 : 84; R(g, 30, 86, 70, 40, '#2a2c32'); R(g, 34, 90, 62, 16, '#3a5a3a'); txt(g, db + ' DBA', 65, 95, db >= 90 ? '#ff6a5a' : '#8aff8a', 1, 'c');
      if (v === 3 && Math.floor(t * 8) % 2) { for (let i = 0; i < 3; i++) pxLine(g, 220 - i * 6, 110 + i * 3, 236, 110 + i * 3, '#f2c418'); txt(g, 'SCREECH', 180, 120, '#f2c418'); }
      Z.vignette(g);
    },
    i_airhose(g, v, fl, t) {
      cmu(g, 0, 0, ZW, 100, wallOf('i_floor'), 51); concrete(g, 0, 100, ZW, 35, '#8a8e96', 52);
      pxEllipse(g, 70, 46, 30, 30, '#d82020'); pxEllipse(g, 70, 46, 20, 20, '#e8c030'); pxEllipse(g, 70, 46, 6, 6, '#3a3c42');   // the reel, hose wound on it
      for (let a = 0; a < 6.28; a += .3) pxRect(g, 70 + Math.cos(a) * 14, 46 + Math.sin(a) * 14, 2, 2, '#c8a020');
      // the regulator and its gauge
      R(g, 130, 16, 30, 24, '#8a8e96'); pxEllipse(g, 145, 28, 9, 9, '#f4f4ee'); pxEllipse(g, 145, 28, 9, 9, '#5a5e66'); pxEllipse(g, 145, 28, 8, 8, '#f8f8f4');
      const psi = v === 2 || v === 3 ? 90 : 30, a = Math.PI * (.75 + psi / 120 * 1.5); pxLine(g, 145, 28, 145 + Math.cos(a) * 7, 28 + Math.sin(a) * 7, '#d82020'); txt(g, psi + ' PSI', 145, 40, '#2a2c32', 1, 'c');
      // the hose and the blowgun
      if (v === 1) { pxLine(g, 90, 60, 120, 120, '#e8c030', 3); pxLine(g, 120, 120, 236, 126, '#e8c030', 3); R(g, 0, 112, ZW, 3, '#d8b828'); }   // across the walkway
      else pxLine(g, 90, 60, 190, 76, '#e8c030', 3);
      R(g, 186, 70, 20, 10, '#3a3c42'); R(g, 206, 72, 18, 5, '#8a8e96');
      if (v === 0 || v === 1) { R(g, 214, 70, 10, 8, '#d82020'); txt(g, '30', 210, 82, '#d82020'); }        // a safety tip, stamped
      else R(g, 222, 73, 6, 3, '#c8ccd4');                                                                  // a plain open pipe
      if (v === 3) { R(g, 200, 84, 36, 50, '#2a3a5a'); for (let i = 0; i < 12; i++) R(g, 226 - hash(i) * 30, 78 + hash(i + 3) * 20, 1, 1, '#d8d8d0'); txt(g, 'HISS', 196, 120, '#ffffff'); }   // aimed at someone's coveralls
      Z.vignette(g);
    },
    i_exitdoor(g, v, fl, t) {
      cmu(g, 0, 0, ZW, ZH, wallOf('i_floor'), 61);
      R(g, 30, 14, 96, 121, '#8a8e96'); R(g, 36, 20, 84, 115, v === 3 ? '#a8acb4' : '#b8bcc4'); R(g, 40, 70, 76, 8, '#d8dce4'); R(g, 40, 76, 76, 2, '#6a6e76');
      R(g, 48, 2, 60, 12, '#3a3a40'); R(g, 50, 3, 56, 10, v === 1 ? '#c8c4bc' : '#fbf6f0'); txt(g, 'EXIT', 78, 6, v === 1 ? '#8a6060' : '#d82020', 1, 'c');
      if (v === 3) { pxLine(g, 50, 72, 110, 72, '#5a5e66', 3); for (let x = 52; x < 108; x += 6) pxEllipse(g, x, 74, 2, 2, '#5a5e66'); R(g, 98, 74, 12, 12, '#c8a030'); R(g, 101, 70, 6, 6, '#8a8e96'); txt(g, 'LOCKED', 78, 96, '#d82020', 1, 'c'); }   // chained and padlocked
      // the extinguisher and its tag
      R(g, 170, 12, 22, 22, '#c8202a'); R(g, 178, 16, 6, 14, '#ffffff');
      R(g, 172, 40, 18, 52, '#c8202a'); R(g, 172, 40, 5, 52, '#e85050'); R(g, 176, 32, 10, 10, '#2a2a30'); pxLine(g, 186, 38, 196, 60, '#2a2a30', 2);
      R(g, 194, 64, 20, 30, '#f4f0e0'); txt(g, 'TAG', 204, 66, '#2a2a30', 1, 'c'); for (let k = 0; k < 4; k++) R(g, 197, 74 + k * 5, 14, 1, '#8a8a8a');
      if (v === 1) { R(g, 197, 89, 14, 3, '#f4f0e0'); txt(g, 'OCT?', 204, 89, '#c8202a', 1, 'c'); }
      if (v === 2) { cartons(g, 150, 60, 80, 75, 61, '#5a6a7a'); txt(g, 'PARTS', 190, 100, '#e8e8e2', 1, 'c'); }   // a parts cart in front of it
      Z.vignette(g);
    },
    /* ---------------- MAINTENANCE SHOP ---------------- */
    i_grinder(g, v, fl, t) {
      R(g, 0, 0, ZW, 92, '#c8a878'); for (let x = 6; x < ZW; x += 10) for (let y = 6; y < 92; y += 10) R(g, x, y, 2, 2, '#8a6a48');   // pegboard
      R(g, 0, 92, ZW, 43, '#6a6e76'); R(g, 0, 92, ZW, 3, '#9aa0aa');                                      // the bench
      const wob = v === 3 && Settings.get('motion') ? Math.round(Math.sin(t * 40) * 2) : 0;
      R(g, 92 + wob, 70, 56, 26, '#3a5a3a'); R(g, 92 + wob, 70, 56, 3, '#4a6a4a');                      // the motor
      for (const [cx, side] of [[62, -1], [178, 1]]) {
        const x = cx + wob; pxEllipse(g, x, 60, 30, 30, '#8a8e96'); pxEllipse(g, x, 60, 22, 22, v === 1 ? '#c8c8c0' : '#a8a49a'); pxEllipse(g, x, 60, 4, 4, '#5a5e66');
        if (v === 1) for (let k = 0; k < 4; k++) pxEllipse(g, x, 60, 18 - k * 3, 18 - k * 3, 'rgba(255,255,255,0.12)');
        if (v === 3 && side < 0) pxCrack(g, x - 18, 50, .3, 26, '#1a1a1e', 7, 1);
        // the work rest below the wheel and the tongue guard above it
        const gap = v === 2 ? 9 : 3, tg = v === 2 ? 12 : 4;
        R(g, x - 26 * side - (side < 0 ? 0 : 20), 84 + gap - 2, 20, 6, '#5a5e66');
        if (v !== 3) { R(g, x - 10, 26 - tg, 20, 5, '#5a5e66'); R(g, x - 16, 16, 32, 10, 'rgba(220,235,245,0.6)'); }   // eye shield
      }
      if (v === 2) { txt(g, '3/8', 30, 100, '#f2c418'); txt(g, '1 IN', 160, 8, '#f2c418'); }
      if (v === 3) { for (const x of [96, 144]) pxEllipse(g, x, 98, 3, 2, '#1a1a1e'); txt(g, 'NO BOLTS', 120, 110, '#f2c418', 1, 'c'); }
      for (const [x, y] of [[98, 96], [142, 96]]) if (v !== 3) bolt(g, x, y);
      Z.vignette(g);
    },
    i_loto(g, v, fl, t) {
      cmu(g, 0, 0, ZW, ZH, wallOf('i_shop'), 71);
      R(g, 60, 12, 100, 112, '#8a8e96'); R(g, 64, 16, 92, 104, '#a4a8b2'); txt(g, '480V', 110, 22, '#1d1f26', 1, 'c');   // the disconnect
      R(g, 54, 30, 14, 40, '#d82020');                                                                 // the handle
      const on = v === 3; R(g, 48, on ? 26 : 56, 26, 12, '#d82020'); txt(g, on ? 'ON' : 'OFF', 98, on ? 40 : 76, '#1d1f26');
      if (v === 0 || v === 1) {                                          // a personal lock through the hasp, and a tag with a name
        R(g, 44, 74, 20, 10, '#c8ccd4'); R(g, 46, 84, 16, 18, '#d82020'); pxEllipse(g, 54, 76, 6, 5, '#c8ccd4');
        R(g, 30, 102, 48, 32, v === 1 ? '#d8d0b0' : '#f8f4e0'); R(g, 30, 102, 48, 8, '#d82020'); txt(g, 'DANGER', 54, 104, '#ffffff', 1, 'c');
        txt(g, 'DO NOT', 54, 114, '#1d1f26', 1, 'c'); txt(g, 'OPERATE', 54, 120, '#1d1f26', 1, 'c'); txt(g, v === 1 ? 'R?Y' : 'R.DIAZ', 54, 127, v === 1 ? '#8a8a8a' : '#1d4a9a', 1, 'c');
      }
      if (v === 2) { R(g, 30, 102, 48, 32, '#f8f4e0'); R(g, 30, 102, 48, 8, '#d82020'); txt(g, 'DANGER', 54, 104, '#ffffff', 1, 'c'); txt(g, 'DO NOT', 54, 114, '#1d1f26', 1, 'c'); txt(g, 'OPERATE', 54, 120, '#1d1f26', 1, 'c'); pxLine(g, 54, 102, 52, 74, '#c8c8c0'); }   // a tag, no lock
      // the procedure card taped up
      R(g, 172, 20, 56, 70, '#f8f4e0'); R(g, 172, 20, 56, 8, '#2a5aa8'); txt(g, 'LOTO', 200, 22, '#ffffff', 1, 'c'); for (let k = 0; k < 8; k++) R(g, 176, 32 + k * 7, 46 - (k * 5) % 14, 1, '#6a6a72');
      if (v === 3) { R(g, 170, 104, 60, 31, '#3a5a8a'); R(g, 180, 110, 24, 10, '#2a3a5a'); R(g, 206, 112, 18, 8, '#2a2a30'); txt(g, 'HUMMMM', 120, 126, '#f2c418', 1, 'c'); }   // a mechanic's boots under the press, power on
      Z.vignette(g);
    },
    i_cylinders(g, v, fl, t) {
      cmu(g, 0, 0, ZW, 112, wallOf('i_shop'), 81); concrete(g, 0, 112, ZW, 23, '#8a8e96', 82);
      const cyl = (x, c, label, cap = true, standing = true) => {
        if (!standing) { R(g, x - 40, 106, 110, 22, c); pxEllipse(g, x + 70, 117, 4, 11, mix(c, '#000000', .2)); R(g, x - 52, 112, 12, 10, '#c8a030'); return; }
        R(g, x, 18, 26, 94, c); R(g, x, 18, 5, 94, mix(c, '#ffffff', .25)); R(g, x + 21, 18, 5, 94, mix(c, '#000000', .25)); pxEllipse(g, x + 13, 18, 13, 6, mix(c, '#ffffff', .15));
        if (cap) { R(g, x + 6, 4, 14, 14, '#8a8e96'); R(g, x + 6, 4, 14, 3, '#c8ccd4'); } else { R(g, x + 9, 6, 8, 12, '#c8a030'); R(g, x + 6, 10, 14, 4, '#d8b440'); }
        txt(g, label, x + 13, 60, '#ffffff', 1, 'c');
      };
      if (v === 3) { cyl(36, '#3f9a3a', 'OXY'); cyl(66, '#d43a2a', 'ACET'); cyl(150, '#d43a2a', '', false, false); if (Math.floor(t * 6) % 2) txt(g, 'HISSS', 176, 92, '#ffffff'); txt(g, '2 FT', 64, 4, '#f2c418'); }
      else {
        cyl(20, '#3f9a3a', 'OXY', v !== 2); cyl(50, '#3f9a3a', v === 1 ? 'MT' : 'OXY', v !== 2);
        R(g, 84, 40, 6, 72, '#8a8e96'); R(g, 68, 120, 41, 9, '#3a3c42'); R(g, 69, 121, 39, 7, '#f4f2ea'); txt(g, 'FIRE WALL', 88, 122, '#c8202a', 1, 'c');   // stenciled at its foot, clear of the cylinders               // the 5-foot fire-rated divider
        cyl(150, '#d43a2a', 'ACET', v !== 2); cyl(184, '#d43a2a', 'ACET', v !== 2);
        if (v !== 2) { pxLine(g, 16, 54, 80, 54, '#c8ccd4', 2); pxLine(g, 146, 54, 214, 54, '#c8ccd4', 2); }   // the chains
        else { txt(g, 'NO CHAIN', 120, 120, '#f2c418', 1, 'c'); }
      }
      Z.vignette(g);
    },
    i_flamcab(g, v, fl, t) {
      cmu(g, 0, 0, ZW, 112, wallOf('i_shop'), 91); concrete(g, 0, 112, ZW, 23, '#8a8e96', 92);
      R(g, 50, 14, 140, 110, '#f2c418'); R(g, 50, 14, 140, 4, '#ffe060'); R(g, 119, 22, 2, 98, '#c89a08');   // two doors
      R(g, 112, 66, 6, 14, '#5a5e66'); R(g, 122, 66, 6, 14, '#5a5e66');
      R(g, 64, 30, 46, 30, '#d82020'); txt(g, 'FLAMMABLE', 87, 34, '#ffffff', 1, 'c'); txt(g, 'KEEP FIRE', 87, 44, '#ffffff', 1, 'c'); txt(g, 'AWAY', 87, 52, '#ffffff', 1, 'c');
      if (v === 1) { R(g, 196, 90, 40, 34, '#6a6e76'); for (let i = 0; i < 8; i++) R(g, 198 + hash(i) * 30, 84 + hash(i + 2) * 12, 8, 6, ['#d8c8a0', '#c8b890', '#e8e0c8'][i % 3]); }   // oily rags in an open bin
      if (v >= 2) { R(g, 60, 0, 22, 14, '#d82020'); R(g, 64, -2, 6, 4, '#c8ccd4'); R(g, 92, 2, 16, 12, '#d82020'); R(g, 150, 0, 18, 14, '#f2f2ea'); R(g, 154, -2, 8, 3, '#3a6ad0'); txt(g, 'GAS', 159, 6, '#d82020', 1, 'c'); }   // cans on the roof, gas in a milk jug
      if (v === 3) { R(g, 196, 96, 40, 28, '#3a3c42'); for (let x = 200; x < 232; x += 4) R(g, x, 100, 2, 16, Math.floor(t * 4 + x) % 3 ? '#ff6a2a' : '#ffa040'); R(g, 4, 116, 46, 8, '#8a8e96'); R(g, 6, 114, 42, 4, 'rgba(180,170,120,0.8)'); for (let i = 0; i < 4; i++) pxRect(g, 10 + i * 10, 108 - ((t * 10 + i * 7) % 20), 1, 3, 'rgba(200,200,160,0.6)'); }   // a red-hot heater and an open solvent pan
      Z.vignette(g);
    },
    i_chemshelf(g, v, fl, t) {
      cmu(g, 0, 0, ZW, ZH, wallOf('i_shop'), 101);
      for (const y of [44, 90]) { R(g, 0, y, 170, 5, '#8a8e96'); R(g, 0, y, 170, 2, '#a8acb4'); }
      const bot = (x, y, w, h, c, label) => { R(g, x, y - h, w, h, c); R(g, x + w / 2 - 2, y - h - 4, 4, 4, '#3a3c42'); if (label) { R(g, x + 2, y - h + 6, w - 4, h / 2, '#f8f4e0'); R(g, x + 2, y - h + 6, w - 4, 3, label); } };
      bot(10, 44, 18, 30, '#3a6ad0', '#d82020'); bot(34, 44, 16, 26, '#f2f2ea', v === 2 ? null : '#f2c418'); bot(56, 44, 20, 34, '#e8c030', '#d82020'); bot(82, 44, 14, 24, '#f2f2ea', v === 2 ? null : '#3a6ad0');
      bot(10, 90, 30, 38, '#5a6a7a', '#d82020'); bot(46, 90, 18, 30, '#3f9a3a', '#f2c418'); bot(70, 90, 22, 34, '#f2f2ea', v === 2 ? null : '#3a6ad0');
      if (v === 2) txt(g, '???', 80, 64, '#d82020', 1, 'c');
      if (v === 3) { fillPoly(g, blobPts(80, 124, 60, 9, 11, .4, 16), 'rgba(160,190,90,0.6)'); for (let i = 0; i < 5; i++) pxRect(g, 60 + i * 10, 100 - ((t * 12 + i * 9) % 30), 1, 4, 'rgba(200,230,150,0.6)'); txt(g, 'ACID', 24, 66, '#ffffff'); txt(g, 'BLEACH', 52, 98, '#ffffff'); }
      // the SDS binder box and the eyewash station
      R(g, 120, 4, 44, 34, v === 1 ? '#e8dcb0' : '#f4f0e0'); R(g, 120, 4, 44, 8, '#d82020'); txt(g, 'SDS', 142, 6, '#ffffff', 1, 'c'); R(g, 126, 18, 32, 16, '#2a5aa8');
      if (v === 1) txt(g, '2004', 142, 24, '#f2c418', 1, 'c');
      if (v !== 2) { R(g, 182, 8, 50, 30, '#2a9a4a'); txt(g, 'EYEWASH', 207, 12, '#ffffff', 1, 'c'); txt(g, 'STATION', 207, 20, '#ffffff', 1, 'c'); R(g, 190, 52, 34, 8, '#c8ccd4'); for (const x of [196, 218]) pxEllipse(g, x, 50, 5, 3, '#f2c418'); R(g, 204, 60, 6, 70, '#8a8e96'); R(g, 194, 66, 26, 6, '#2a9a4a'); }
      else { R(g, 182, 8, 50, 30, 'rgba(0,0,0,0.08)'); txt(g, 'NONE', 207, 50, '#5a5e66', 1, 'c'); }
      Z.vignette(g);
    },
    i_hoist(g, v, fl, t) {
      R(g, 0, 0, ZW, ZH, '#4a4e56'); for (let x = 0; x < ZW; x += 8) R(g, x, 0, 4, ZH, '#565a62');
      R(g, 0, 8, ZW, 16, '#f2c418'); R(g, 0, 8, ZW, 3, '#ffe060'); R(g, 0, 22, ZW, 2, '#a88010'); txt(g, '2 TON', 40, 13, '#1d1f26');
      R(g, 100, 24, 40, 28, '#d8b828'); R(g, 100, 24, 40, 3, '#ffe060'); R(g, 106, 30, 28, 8, '#2a2c32'); txt(g, 'SWL 2T', 120, 31, '#f2c418', 1, 'c');
      const hookY = v === 3 ? 92 : 100; for (let y = 52; y < hookY; y += 4) { R(g, 119, y, 3, 3, '#8a8e96'); R(g, 120, y + 1, 1, 1, '#2a2c32'); }
      fillPoly(g, [[114, hookY], [126, hookY], [128, hookY + 12], [122, hookY + 18], [114, hookY + 14], [118, hookY + 10]], '#e8c030');
      if (v === 3) { R(g, 84, hookY + 12, 72, 40, '#5a6a7a'); R(g, 84, hookY + 12, 72, 4, '#7a8a9a'); pxLine(g, 120, hookY + 6, 90, hookY + 12, '#2a8a4a', 3); pxLine(g, 120, hookY + 6, 150, hookY + 12, '#2a8a4a', 3); R(g, 20, 104, 40, 31, '#2a3a5a'); R(g, 32, 94, 16, 12, '#e0b088'); }   // a load hanging over someone's head
      else {
        // the sling hanging from the hook, its tag
        const sc = v === 2 ? '#c8a830' : '#2a8a4a'; pxLine(g, 122, hookY + 14, 150, 132, sc, 6);
        if (v === 2) for (let i = 0; i < 8; i++) R(g, 134 + i * 2, 118 + i * 2, 3, 1, '#f4f0e0');   // frayed, cut fibers
        if (v !== 2) { R(g, 152, 112, 22, 16, v === 1 ? '#a8a8a0' : '#f4f0e0'); txt(g, '2000', 163, 114, '#1d1f26', 1, 'c'); txt(g, 'LB', 163, 120, '#1d1f26', 1, 'c'); }
      }
      Z.vignette(g);
    }
  });

  /* ============================== LEFT BEHIND ============================== */
  INDA.SPRITES = {
    i_boxcutter: ['............', '.....oooooo.', '..oooYYYYYoo', 'ooggoYYYYYo.', '..oooooooo..'],
    i_radio: ['....o.......', '....o.......', '.oooooooooo.', 'oYYYYYYYYYYo', 'oYKKKYgggYYo', 'oYKKKYgYgYYo', 'oYKKKYgggYYo', 'oYYYYYYYYYYo', '.oooooooooo.'],
    i_cooler: ['.oooooooooo.', 'oWWWWWWWWWWo', 'oRRRRRRRRRRo', 'oRRRRWWRRRRo', 'oRRRRRRRRRRo', 'oRRRRRRRRRRo', '.oooooooooo.'],
    i_gloves: ['.o.o.o......', '.YoYoYo.....', '.YYYYYYo....', 'oYYYYYYYo...', '.oYYYYYYo...', '..oYYYYo....', '..oooooo....'],
    i_tapegun: ['...oooo.....', '..oKKKKo....', '.oKgggKoooo.', '.oKgWgKKKKo.', '.oKgggKo....', '..oKKKo.....', '...oKo......', '...ooo......']
  };

  /* ============================== TITLE: the truck yard outside Lot 204 ============================== */
  let cache = null;
  INDA.title = (g, t) => {
    if (!cache) {
      cache = document.createElement('canvas'); cache.width = SW; cache.height = SH; const h = cache.getContext('2d'), T = Decor.time;
      const sky = h.createLinearGradient(0, 0, 0, CAM.hy); sky.addColorStop(0, T.sky[0]); sky.addColorStop(1, T.sky[2]); h.fillStyle = sky; h.fillRect(0, 0, SW, CAM.hy + 4);
      for (let i = 0; i < 4; i++) { const cx = 40 + i * 120 + hash(i) * 40, cy = 14 + hash(i + 3) * 20; pxEllipse(h, cx, cy, 16, 4, '#f4f8fb'); pxEllipse(h, cx + 10, cy - 2, 10, 3, '#ffffff'); }
      // the asphalt yard, with parking stripes running toward the building
      fillPoly(h, [P(-12, 0, 1.5), P(12, 0, 1.5), P(12, 0, 30), P(-12, 0, 30)], '#4a4c52'); speckle(h, 0, CAM.hy, SW, SH - CAM.hy, '#5a5c62', 2400, 7);
      for (const x of [-6, -3, 3, 6]) for (let z = 2; z < 20; z += 2) fillPoly(h, [P(x - .08, 0, z), P(x + .08, 0, z), P(x + .08, 0, z + 1.2), P(x - .08, 0, z + 1.2)], '#e8e0a0');
      // the warehouse: a long tilt-up wall with dock doors, a sign, and a light pole
      const zb = 22, box = { x0: -12, x1: 12, h: 6, zb };
      fillPoly(h, Q.back(box, -12, 12, 0, 6), '#c8c0b0'); fillPoly(h, Q.back(box, -12, 12, 5.4, 6), '#2a5aa8');
      for (const x of [-9, -5, -1, 3, 7]) { fillPoly(h, Q.back(box, x, x + 2.6, 0, 3.2), '#1d1f26'); fillPoly(h, Q.back(box, x + .1, x + 2.5, .2, 3.2), x === -1 ? '#c4c8ce' : '#9aa0a8'); for (let y = .4; y < 3.2; y += .3) { const a = P(x + .1, y, zb), b = P(x + 2.5, y, zb); pxLine(h, a[0], a[1], b[0], b[1], 'rgba(40,40,46,0.3)'); } }
      const s = P(-3, 4.8, zb); pxRect(h, s[0], s[1] - 2, 52, 13, '#f4f4ee'); pxRect(h, s[0], s[1] - 2, 52, 3, '#c82020'); txt(h, 'LOT 204', s[0] + 26, s[1] + 3, '#1d1f26', 1, 'c');
      // a trailer backed into a door, a light pole, a fence line
      box3(h, 3.2, 5.4, 0, 3.4, 12, zb, { front: '#e8e8e2', side: '#c8c8c0', top: '#f4f4ee' });
      for (const x of [-10.5, 9.5]) { const a = P(x, 0, 8), b = P(x, 7, 8); pxLine(h, a[0], a[1], b[0], b[1], '#6a6e76', 2); pxRect(h, b[0] - 5, b[1], 10, 3, '#3a3c42'); }
    }
    g.drawImage(cache, 0, 0);
  };
})();
