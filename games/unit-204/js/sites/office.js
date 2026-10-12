'use strict';
/* ============================== SUITE 204: COMMERCIAL OFFICES ==============================
   A lease-end inspection of an office suite. Synergex Paper Solutions (eight years on a ten-year lease, "right-sizing")
   moved out on Friday, October 3, 2008, and the landlord needs to know what comes back to them out of the security
   deposit before the space is marketed again. Same four codes as the apartment, because a commercial lease works
   the same way: wear is the landlord's cost of doing business; damage, and the tenant's alterations they never
   restored (cut-in cable holes, card readers, signage, abandoned cabling), are charged to the deposit with a photo;
   anything dangerous gets an emergency work order, whoever caused it. OSHA comes in where it genuinely applies to
   the building and whoever works in it next: exit doors and signs, extinguishers, the electrical panel's clear
   space, live parts, cords, sprinkler clearance, walking surfaces, first aid, and chemicals.
   Four areas, like the apartment's four rooms: the lobby and reception, the open-plan workspace, the break room,
   and the server / electrical room. All the pictures (close-ups, item sprites, the title corridor) come from
   js/sites/office-art.js (OFC); this file holds the rooms, the checklist, and the words.
   Every id starts with o_ so nothing collides with another site's tables. */
(() => {
  const A = OFC;
  const box = id => ROOMS[id].box;

  /* ============================== ROOM PIECES ============================== */
  /* a drop ceiling: a white T-bar grid on the ceiling plane, one unit to a tile */
  function ceilingGrid(g, r, from = 3) {
    const { x0, x1, h, zb } = r.box;
    for (let x = Math.ceil(x0); x <= x1; x++) lineW(g, P(x, h, from), P(x, h, zb), 'rgba(255,255,255,0.75)');
    for (let z = Math.ceil(from); z <= zb; z++) { lineW(g, P(x0, h, z), P(x1, h, z), 'rgba(255,255,255,0.75)'); lineW(g, P(x0, h - .01, z + .04), P(x1, h - .01, z + .04), 'rgba(90,84,70,0.16)'); }
  }
  /* a 2x4 fluorescent troffer in the grid: a white frame, a lens, and three tubes (dark when the lights are off) */
  function troffer(g, r, xa, xb, za, zb2, o = {}) {
    const h = r.box.h, on = !r.lightsOff && !o.dead;
    fillPoly(g, Q.ceil(r.box, xa, xb, za, zb2), '#d6d6d0');
    fillPoly(g, Q.ceil(r.box, xa + .06, xb - .06, za + .08, zb2 - .08), on ? '#fbfcf2' : '#c6cac4');
    for (let k = 1; k < 4; k++) { const x = xa + (xb - xa) * k / 4; lineW(g, P(x, h, za + .12), P(x, h, zb2 - .12), on ? (o.tube === k ? '#b8bcb6' : '#ffffff') : '#b4b8b2'); }
    if (o.crack) { const c = P((xa + xb) / 2 + .1, h, (za + zb2) / 2); pxLine(g, c[0] - 4, c[1] - 1, c[0] + 3, c[1] + 2, '#8a8e88'); pxRect(g, c[0] + 3, c[1] - 2, 3, 2, '#5a5c58'); }
  }
  function troffGlow(g, r, x, z, k = 1) { if (r.lightsOff) return; const c = P(x, r.box.h, z), f = P(x, 0, z); softGlow(g, c[0], c[1] + 3, 40 * k, 9 * k, '#fffef0', .22); softGlow(g, f[0], f[1], 70 * k, 14 * k, '#fffaf0', .07); }
  /* office walls end in black rubber cove base, not white wood: paint over the shell's baseboards */
  function coveBase(g, r, col = '#34343a') {
    const { x0, x1, zb } = r.box, p = Decor.pal(r.id);
    fillPoly(g, Q.back(r.box, x0, x1, 0, .3), p.back); fillPoly(g, Q.left(r.box, 1.6, zb, 0, .3), p.wallL); fillPoly(g, Q.right(r.box, 1.6, zb, 0, .3), p.wallR);
    fillPoly(g, Q.back(r.box, x0, x1, 0, .14), col); fillPoly(g, Q.left(r.box, 1.6, zb, 0, .14), mix(col, '#000000', .1)); fillPoly(g, Q.right(r.box, 1.6, zb, 0, .14), mix(col, '#000000', .05));
    lineW(g, P(x0, .14, zb), P(x1, .14, zb), '#55555c');
  }
  function plateBack(g, r, xa, xb, ya, yb, c = '#ece6d6') { const q = Q.back(r.box, xa, xb, ya, yb); fillPoly(g, q, c); strokePoly(g, q, '#9a9484'); return polyBox(q); }
  function rockerIn(g, b, on) { pxRect(g, b.cx - 1, b.y0 + 2, 2, b.y1 - b.y0 - 4, '#d8cfb6'); pxRect(g, b.cx - 1, on ? b.y0 + 2 : b.cy, 2, Math.ceil((b.y1 - b.y0 - 4) / 2), '#ffffff'); }
  /* a light switch that's yours to flip: lights off darkens the room (and the troffers go gray) */
  function lightUse(id, what) {
    return () => {
      const r = ROOMS[id]; r.lightsOff = !r.lightsOff; Audio2.sfx('click'); Rooms.invalidate(id);
      if (r.lightsOff) return `Click. You switch off ${what}.`;
      if (id === 'o_open' && cond('o_troffer') === 3) return `Click. ${what[0].toUpperCase() + what.slice(1)} flicker on. The one hanging out of the grid buzzes and stutters.`;
      return `Click. ${what[0].toUpperCase() + what.slice(1)} blink, ping, and come on. Fluorescent, every one of them.`;
    };
  }
  /* a hollow-metal door in a side wall, painted, with a lever (doorOnSide draws the opening) */
  function sideDoor(g, r, side, za, zb2, inside) { doorOnSide(g, r, side, za, zb2, inside); }

  /* ============================== THE ROOMS ============================== */
  const ROOMS_O = {
    /* ---------------- LOBBY & RECEPTION ---------------- */
    o_lobby: {
      name: 'Lobby & Reception', box: { x0: -6, x1: 6, h: 4, zb: 12.5 }, amb: .35,
      floor: tileFloor(1), floorBase: p => p.floor[0],
      walk: { x0: -5.2, x1: 5.2, z0: 4.8, z1: 11.8 }, start: { x: .8, z: 7.2 },
      windows: [],
      doors: [{ id: 'o_toOpen', side: 'right', za: 8.4, zb: 10.2, to: 'o_open', name: 'Open office', walk: { x: 5.2, z: 9.3 }, spawn: { x: 5.8, z: 12.8 } }],
      features: {
        o_entry: { pts: () => Q.back(box('o_lobby'), -1.75, 1.75, 0, 3.0), walk: { x: .2, z: 11.6 } },
        o_exitsign: { pts: () => Q.back(box('o_lobby'), -.58, .58, 3.06, 3.68), walk: { x: .6, z: 11.4 } },
        o_extinguisher: { pts: () => Q.back(box('o_lobby'), 3.22, 3.88, .88, 2.32), walk: { x: 3.5, z: 11.6 } },
        o_desk: { pts: () => hull(boxPts(-5.3, -2, 0, 1.3, 9.15, 10.2)), walk: { x: -3.4, z: 8.4 } },
        o_logowall: { pts: () => Q.back(box('o_lobby'), -5.5, -2.1, 1.42, 3.2), walk: { x: -1.6, z: 11.4 } },
        o_lobbyfloor: { pts: () => Q.floor(-1.62, 1.62, 10.7, 12.42), walk: { x: .2, z: 10.2 } }
      },
      scenery: [
        { id: 'o_lswitch', name: 'Light switch', pts: () => Q.back(box('o_lobby'), 2.5, 2.8, 1.18, 1.62), walk: { x: 2.6, z: 11.6 }, use: lightUse('o_lobby', 'the lobby lights'),
          look: 'A two-gang switch by the door: the lobby lights, and the logo wall\'s spotlight (no logo, no point).' },
        { id: 'o_lthermo', name: 'Thermostat', pts: () => Q.back(box('o_lobby'), 4.42, 4.92, 1.52, 1.98), walk: { x: 4.6, z: 11.6 },
          look: 'A beige programmable thermostat, set to 72 and locked under a clear plastic cage. The building runs the HVAC; this just asks nicely.',
          touch: 'The cage is locked. Somebody really wanted it to be 72.', smell: 'Warm plastic.', talk: 'You ask the thermostat if it\'s hot in here or just you. It says 72.' },
        { id: 'o_evac', name: 'Evacuation map', pts: () => Q.right(box('o_lobby'), 10.8, 12.1, 1.38, 2.42), walk: { x: 5.2, z: 11.2 },
          look: 'A framed evacuation map from the building: YOU ARE HERE, two stairwells, and the meeting point in the parking lot by the light pole. Every workplace needs an emergency action plan (29 CFR 1910.38); this is the building\'s half of it.',
          touch: 'Screwed to the wall, behind plexiglass. Good.', smell: 'Nothing.', talk: 'You tell the map you know where you are. The map insists.' }
      ],
      walls(g, r) {
        const zb = r.box.zb, p = Decor.pal('o_lobby');
        ceilingGrid(g, r);
        for (const [xa, xb, za, zb2] of [[-.4, .4, 6.4, 7.9], [-3.6, -2.8, 9.4, 10.9], [2.8, 3.6, 9.4, 10.9], [-3.6, -2.8, 5.4, 6.9], [2.8, 3.6, 5.4, 6.9]]) troffer(g, r, xa, xb, za, zb2);
        coveBase(g, r);
        // the logo wall behind reception
        { const lv = cond('o_logowall');
          if (lv === 1) fillPoly(g, Q.back(r.box, -5.2, -2.4, 1.8, 2.9), mix(p.back, '#3a3020', .07));
          if (lv === 2) for (let i = 0; i < 8; i++) { const c = P(-5 + i * .35, 2.35, zb); fillPoly(g, blobPts(c[0], c[1], 2, 4, i * 7, .5, 8), '#c4a676'); }
          if (lv === 3) { const c = P(-3.8, 2.55, zb); A.ftext(g, 'SYNERGEX', c[0] - 15, c[1] - 2, '#aeb2ba'); A.ftext(g, 'SYNERGEX', c[0] - 15, c[1] - 3, '#dfe2e8'); const s = P(-3.8, 2.15, zb); pxLine(g, s[0] - 14, s[1], s[0] + 14, s[1] - 1, '#2a8a9a'); } }
        // the storefront: bronze frame, two glass leaves, the corridor outside
        { const ev = cond('o_entry'), BZ = '#5e4a34';
          fillPoly(g, Q.back(r.box, -1.78, 1.78, 0, 3.02), BZ);
          for (const [a, b] of [[-1.6, -.14], [.14, 1.6]]) {
            const gl = Q.back(r.box, a, b, .42, 2.8); fillPoly(g, gl, '#d6cbb6');
            fillPoly(g, Q.back(r.box, a, b, .42, .7), '#5c6676');                                   // the corridor's carpet
            if (a < 0) { fillPoly(g, Q.back(r.box, -1.1, -.5, .7, 2.45), '#8a5e36'); const k = P(-.6, 1.4, zb); pxRect(g, k[0], k[1], 1, 1, '#c9ccd4'); }   // the door across the hall
            fillPoly(g, gl, 'rgba(150,190,205,0.2)'); const s0 = P(a + .25, 2.7, zb), s1 = P(a + .05, 1.6, zb); pxLine(g, s0[0], s0[1], s1[0], s1[1], 'rgba(255,255,255,0.3)');
            fillPoly(g, Q.back(r.box, a, b, 1.55, 1.62), 'rgba(255,255,255,0.45)');                 // the frosted safety band
          }
          { const c = P(0, 2.2, zb); A.ftext(g, 'SUITE 204', c[0] - 17, c[1], '#ffffff', 1, true); }
          for (const x of [-.14, .14]) { const k = P(x * 1.4, 1.35, zb), l = P(x * 1.4, 1.12, zb); pxRect(g, k[0] - 1, k[1] - 1, 2, 2, ev === 3 && x > 0 ? '#c9a227' : '#c9ccd4'); pxRect(g, l[0] - (x < 0 ? 0 : 4), l[1], 5, 1, '#c9ccd4'); }
          { const c = P(.6, 2.92, zb); pxRect(g, c[0], c[1], 9, 2, '#b4b0a6'); if (ev === 1) { pxRect(g, c[0] + 2, c[1] + 2, 1, 4, 'rgba(70,50,20,0.7)'); } }
          if (ev === 2) { const c = P(1.95, 1.3, zb); pxRect(g, c[0] - 1, c[1] - 3, 5, 6, mix(p.back, '#ffffff', .3)); pxRect(g, c[0] + 1, c[1], 1, 1, '#2a2018'); pxRect(g, c[0] + 2, c[1] + 1, 1, 3, '#9a9ea8'); }
        }
        // the EXIT sign over the door
        { const xv = cond('o_exitsign'), q = Q.back(r.box, -.45, .45, 3.16, 3.58), b = polyBox(q);
          fillPoly(g, q, '#f4f2ec'); strokePoly(g, q, '#a8a49a');
          const col = xv === 3 ? '#8a5048' : '#ff2c1c'; A.ftext(g, 'EXIT', Math.round(b.cx - 7), Math.round(b.cy - 2), col);
          if (xv === 1) A.ftext(g, 'EX', Math.round(b.cx - 7), Math.round(b.cy - 2), '#c04a3a');
          if (xv === 2) { pxRect(g, b.x1 - 3, b.y0, 3, 2, '#3a3430'); pxLine(g, b.x1 - 4, b.y0 + 1, b.x1 - 9, b.y1 - 2, '#9a968a'); } }
        // the extinguisher cabinet
        { const xv = cond('o_extinguisher'), q = Q.back(r.box, 3.3, 3.8, .95, 2.25), b = polyBox(q);
          fillPoly(g, q, '#f2f0ea'); strokePoly(g, q, '#a8a49a');
          const w = Q.back(r.box, 3.38, 3.72, 1.08, 2.08); fillPoly(g, w, '#cfcbc2'); fillPoly(g, Q.back(r.box, 3.47, 3.63, 1.15, 1.85), '#c41e18');
          if (xv !== 2) fillPoly(g, w, xv === 1 ? 'rgba(236,236,230,0.45)' : 'rgba(200,225,235,0.25)');
          if (xv === 2) { pxRect(g, b.x0 + 2, b.y0 + 3, 2, 2, '#d8eef4'); const f = P(3.55, 0, zb - .15); pxRect(g, f[0] - 2, f[1] - 1, 2, 1, '#d8eef4'); pxRect(g, f[0] + 2, f[1], 1, 1, '#d8eef4'); }
          if (xv === 3) { const f = P(3.55, 0, zb - .25); speckle(g, f[0] - 7, f[1] - 3, 14, 4, '#f4f2ea', 22, 4); }
          A.ftext(g, 'FIRE', Math.round(b.cx - 7), Math.round(b.y0 + 1), '#c41e18'); }
        { const s = plateBack(g, r, 2.5, 2.8, 1.2, 1.6); rockerIn(g, { ...s, x1: s.cx, cx: s.x0 + (s.x1 - s.x0) * .3 }, !r.lightsOff); rockerIn(g, { ...s, cx: s.x0 + (s.x1 - s.x0) * .7 }, false); }
        { const q = Q.back(r.box, 4.5, 4.85, 1.6, 1.9), b = polyBox(q); fillPoly(g, q, '#e6dcc4'); strokePoly(g, q, '#9a9484'); pxRect(g, b.x0 + 2, b.y0 + 2, b.x1 - b.x0 - 4, 2, '#8fc49a'); strokePoly(g, Q.back(r.box, 4.45, 4.9, 1.55, 1.95), 'rgba(200,220,230,0.6)'); }
        { const q = Q.right(r.box, 10.9, 12, 1.45, 2.35); fillPoly(g, q, '#2a2a30'); fillPoly(g, Q.right(r.box, 11, 11.9, 1.53, 2.27), '#f4f2ea');
          for (let k = 0; k < 4; k++) lineW(g, P(r.box.x1, 1.7 + k * .14, 11.1), P(r.box.x1, 1.7 + k * .14, 11.75), k % 2 ? '#c43a3a' : '#6a7080'); }
        sideDoor(g, r, 'right', 8.4, 10.2, '#c8c0ae');
        outletBack(g, r, -1.95, .4); outletBack(g, r, 4.2, .4);
        // the walk-off mat inside the door
        { const fv = cond('o_lobbyfloor'), mat = Q.floor(-1.5, 1.5, 10.8, 12.35);
          fillPoly(g, Q.floor(-1.58, 1.58, 10.74, 12.4), '#2a2b30'); fillPoly(g, mat, '#3c3e46');
          for (let z = 10.95; z < 12.3; z += .14) lineW(g, P(-1.45, 0, z), P(1.45, 0, z), '#34363c');
          if (fv === 1) fillPoly(g, Q.floor(-.45, .45, 10.85, 12.3), 'rgba(150,150,150,0.22)');
          if (fv === 2) { const c = P(2.25, 0, 11.6); for (let k = 0; k < 4; k++) pxLine(g, c[0], c[1], c[0] + Math.cos(k * 1.6) * 4, c[1] + Math.sin(k * 1.6) * 2, '#6a665e'); }
          if (fv === 3) { fillPoly(g, Q.floor(-1.58, -.9, 10.74, 11.2), Decor.pal('o_lobby').floor[0]); fillPoly(g, [P(-1.0, 0, 10.8), P(-1.5, 0, 11.3), P(-1.48, .22, 11.0), P(-1.22, .26, 10.86)], '#9a8a6c'); strokePoly(g, [P(-1.0, 0, 10.8), P(-1.5, 0, 11.3), P(-1.48, .22, 11.0), P(-1.22, .26, 10.86)], '#2a2b30'); } }
        // the reception desk, in front of everything on the back wall
        { const dv = cond('o_desk'), V = '#c49a62';
          box3(g, -5.2, -2.1, 0, 1.2, 9.3, 10.2, { front: V, side: '#9a7444', top: '#d8d0bc' });
          for (const x of [-4.17, -3.13]) lineW(g, P(x, .14, 9.3), P(x, 1.2, 9.3), '#6e4c2a');
          fillPoly(g, [P(-5.2, 0, 9.3), P(-2.1, 0, 9.3), P(-2.1, .14, 9.3), P(-5.2, .14, 9.3)], '#aeb2ba');
          box3(g, -5.3, -2.0, 1.2, 1.3, 9.15, 9.55, { front: '#cbc2ae', top: '#e4ded0', side: '#b8b09c' });
          if (dv === 1) lineW(g, P(-4.6, 1.3, 9.16), P(-2.6, 1.3, 9.16), '#f8f4ea');
          if (dv === 2) for (const x of [-4.3, -3.0]) { const c = P(x, 1.3, 9.35); pxEllipse(g, c[0], c[1], 2, 1, '#1a140e'); pxRect(g, c[0] - 3, c[1] - 1, 1, 1, '#f8f4ea'); }
          if (dv === 3) fillPoly(g, [P(-2.1, 1.2, 9.3), P(-2.45, 1.2, 9.3), P(-2.4, .7, 9.3), P(-2.1, .45, 9.3)], '#c8a878'); }
      },
      dynamic(g, r, t) {
        for (const [x, z] of [[0, 7.15], [-3.2, 10.15], [3.2, 10.15], [-3.2, 6.15], [3.2, 6.15]]) troffGlow(g, r, x, z, .8);
        const xv = cond('o_exitsign'); if (xv !== 3) { const c = P(0, 3.37, r.box.zb); softGlow(g, c[0], c[1], 22, 10, '#ff4a3a', xv === 1 ? .12 : .2); }
      }
    },
    /* ---------------- OPEN-PLAN WORKSPACE ---------------- */
    o_open: {
      name: 'Open Office', box: { x0: -7, x1: 7, h: 4, zb: 14 }, amb: .45,
      floor: (g, r, p) => carpetTileFloor(g, r, p), floorBase: p => p.floor.base,
      walk: { x0: -6.2, x1: 6.2, z0: 4.8, z1: 13.2 }, start: { x: -5.4, z: 7.4 },
      windows: [{ xa: -6.4, xb: .6, ya: 1, yb: 3.1, slats: 10, level: 4 }],
      doors: [
        { id: 'o_toLobby', back: [5.3, 6.7], to: 'o_lobby', name: 'Lobby', walk: { x: 6, z: 13.2 }, spawn: { x: 5.2, z: 9.3 } },
        { id: 'o_toBreak', side: 'right', za: 9.6, zb: 11.4, to: 'o_break', name: 'Break room', walk: { x: 6.2, z: 10.5 }, spawn: { x: -4.4, z: 8.3 } },
        { id: 'o_toServer', back: [3.2, 4.8], to: 'o_server', name: 'Server / electrical room', walk: { x: 4, z: 13.2 }, spawn: { x: -3.4, z: 7.3 } }
      ],
      features: {
        o_carpet: { pts: () => Q.floor(-3, 2, 7.2, 11), walk: { x: -.4, z: 6.6 } },
        o_ceiling: { pts: () => Q.ceil(box('o_open'), 2, 3, 9, 10), walk: { x: 2.4, z: 7.8 } },
        o_troffer: { pts: () => { const q = Q.ceil(box('o_open'), -1.4, -.6, 9, 10.6); if (cond('o_troffer') === 3) q.push(P(-.5, 3.4, 10.7)); return hull(q); }, walk: { x: -1, z: 7.8 } },
        o_window: { pts: () => Q.back(box('o_open'), -6.55, .75, .85, 3.25), walk: { x: -2.8, z: 13 } },
        o_floorbox: { pts: () => Q.floor(2.2, 3.1, 7.9, 8.6), walk: { x: 2.6, z: 7.2 } },
        o_wall: { pts: () => Q.left(box('o_open'), 9, 13.6, .25, 2.8), walk: { x: -6, z: 10.4 } }
      },
      scenery: [
        { id: 'o_oswitch', name: 'Light switches', pts: () => Q.left(box('o_open'), 8.5, 8.95, 1.15, 1.62), walk: { x: -6, z: 8.6 }, use: lightUse('o_open', 'the office lights'),
          look: 'A bank of three switches for the open office lights. Someone label-made each one LIGHTS.' },
        { id: 'o_othermo', name: 'Thermostat', pts: () => Q.back(box('o_open'), 1.3, 1.75, 1.55, 1.98), walk: { x: 1.5, z: 13 },
          look: 'A thermostat with a sticky note: "DO NOT TOUCH. - Mgmt." Under it, in another pen: "COLD!!"', touch: 'You leave it. Some wars aren\'t yours.', smell: 'Plastic.' },
        { id: 'o_pull', name: 'Fire alarm pull station', pts: () => Q.right(box('o_open'), 12.4, 12.8, 1.15, 1.75), walk: { x: 6, z: 12.2 },
          look: 'A red fire alarm pull station: PULL DOWN. The building\'s, and it looks fine. You are not testing this one.', touch: 'You rest a hand on it. You feel the whole building tense up. You let go.',
          talk: "You don't ask it anything. It's a fire alarm.", hammer: 'Absolutely not.' },
        { id: 'o_column', name: 'Column', pts: () => hull(boxPts(4.6, 5.3, 0, 4, 8.6, 9.3)), walk: { x: 4.2, z: 8 },
          look: 'A drywall-wrapped structural column. Every open office has one exactly where the best desk would go.', touch: 'Solid. Corner bead dented a little at bumper height. That\'s just a column\'s life.', hammer: 'Thunk. Steel inside, drywall outside.' },
        { id: 'o_sprinkle', name: 'Sprinkler head', pts: () => { const c = P(-3, 4, 9.5); return [[c[0] - 4, c[1] - 2], [c[0] + 4, c[1] - 2], [c[0] + 4, c[1] + 4], [c[0] - 4, c[1] + 4]]; }, walk: { x: -3, z: 8 },
          look: 'A chrome pendent sprinkler head in the middle of a ceiling tile, clean, with plenty of clearance. The cubicles never got near it.', touch: 'Out of reach, and you don\'t touch sprinkler heads anyway.' }
      ],
      walls(g, r) {
        const zb = r.box.zb, p = Decor.pal('o_open'), tv = cond('o_troffer');
        ceilingGrid(g, r);
        for (const [xa, xb, za, zb2] of [[-4.4, -3.6, 6, 7.6], [2.6, 3.4, 6, 7.6], [-4.4, -3.6, 10.4, 12], [4.6, 5.4, 11, 12.6], [.6, 1.4, 11.6, 13.2]]) troffer(g, r, xa, xb, za, zb2);
        if (tv !== 3) troffer(g, r, -1.4, -.6, 9, 10.6, { tube: tv === 1 ? 2 : 0, crack: tv === 2 });
        { const cv = cond('o_ceiling');                                    // the one ceiling tile on the checklist
          const q = Q.ceil(r.box, 2.03, 2.97, 9.03, 9.97);
          if (cv === 1) fillPoly(g, q, 'rgba(210,190,130,0.35)');
          if (cv === 2) { fillPoly(g, Q.ceil(r.box, 3.03, 3.97, 9.03, 9.97), '#1c1a18'); const c = polyBox(q); pxLine(g, c.x0 + 2, c.y0 + 1, c.x1 - 3, c.y1 - 1, '#8a8678'); }
          if (cv === 3) { const c = polyBox(q); fillPoly(g, blobPts(c.cx, c.cy, 8, 3, 21, .4, 14), 'rgba(150,110,50,0.45)'); fillPoly(g, blobPts(c.cx, c.cy, 4, 2, 23, .4, 12), 'rgba(110,76,30,0.55)'); } }
        coveBase(g, r);
        { const sp = P(-3, 4, 9.5); pxEllipse(g, sp[0], sp[1] + 1, 2, 1, '#c9ccd4'); pxRect(g, sp[0], sp[1] + 2, 1, 1, '#9a9ea8'); }
        // the ribbon window: anodized frame, mullions, a deep sill (the blinds are drawn live, over the sky)
        { const wv = cond('o_window');
          fillPoly(g, Q.back(r.box, -6.55, .75, .85, 3.25), '#a4a8b0'); cutOut(g, Q.back(r.box, -6.4, .6, 1, 3.1));
          for (const x of [-4.07, -1.73]) fillPoly(g, Q.back(r.box, x - .07, x + .07, 1, 3.1), '#a4a8b0');
          box3(g, -6.6, .8, .8, .88, zb - .3, zb, { front: '#e2ded4', top: '#d4d0c4', side: '#c8c4b8' });
          if (wv === 3) { const a = P(-1.6, 1.05, zb), b = P(-.1, 2.9, zb); pxLine(g, a[0], a[1], (a[0] + b[0]) / 2 + 3, (a[1] + b[1]) / 2, '#ffffff'); pxLine(g, (a[0] + b[0]) / 2 + 3, (a[1] + b[1]) / 2, b[0], b[1], '#ffffff'); } }
        // the server room door, solid, with its sign
        { fillPoly(g, Q.back(r.box, 3.06, 4.94, 0, 3.05), '#d8d6d0'); fillPoly(g, Q.back(r.box, 3.2, 4.8, 0, 2.9), '#9aa2ac'); fillPoly(g, Q.back(r.box, 3.2, 4.8, 0, .1), '#7a828c');
          const s = polyBox(Q.back(r.box, 3.6, 4.4, 2.1, 2.4)); pxRect(g, s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0, '#2a3a5a'); pxRect(g, s.x0 + 2, s.cy - 1, s.x1 - s.x0 - 4, 1, '#f4f4ee');
          const k = P(4.62, 1.2, zb); pxRect(g, k[0] - 3, k[1], 4, 1, '#c9ccd4'); pxRect(g, k[0], k[1] - 1, 2, 3, '#c9ccd4'); }
        { const q = Q.back(r.box, 1.35, 1.7, 1.6, 1.92), b = polyBox(q); fillPoly(g, q, '#e6dcc4'); strokePoly(g, q, '#9a9484'); pxRect(g, b.x0 + 2, b.y0 + 2, b.x1 - b.x0 - 4, 2, '#8fc49a'); const n = P(1.72, 1.9, zb); pxRect(g, n[0], n[1], 3, 3, '#f8e070'); }
        outletBack(g, r, 2.2, .4); outletBack(g, r, -5.2, .4);
        // the partition wall on the left, where the whiteboards were
        { const wv = cond('o_wall'), x0 = r.box.x0;
          if (wv === 1) { for (let i = 0; i < 9; i++) { const z = 9.6 + i * .45, a = P(x0, .82 + hash(i) * .1, z), b = P(x0, .84 + hash(i) * .1, z + .25); pxLine(g, a[0], a[1], b[0], b[1], 'rgba(60,60,70,0.4)'); } }
          if (wv === 2) { fillPoly(g, Q.left(r.box, 10, 13, 1.2, 2.6), 'rgba(255,255,255,0.08)'); for (let i = 0; i < 5; i++) { const a = P(x0, 2.4 - i * .25, 10.3 + i * .2), b = P(x0, 2.4 - i * .25, 11.4 + i * .3); pxLine(g, a[0], a[1], b[0], b[1], i === 4 ? '#c43a3a' : '#2a4ab0'); } const ar = P(x0, 2.1, 11.6), ar2 = P(x0, 1.6, 12.3); pxLine(g, ar[0], ar[1], ar2[0], ar2[1], '#2a4ab0'); }
          if (wv === 3) { fillPoly(g, Q.left(r.box, 10, 13, 1.1, 2.6), mix(p.wallL, '#ffffff', .1)); for (const [z, y] of [[10.3, 2.4], [12.7, 2.4], [10.3, 1.3], [12.7, 1.3]]) { const c = P(x0, y, z); fillPoly(g, blobPts(c[0], c[1], 2, 3, z * 9, .5, 8), '#ece6da'); pxRect(g, c[0] - 1, c[1] - 1, 1, 2, '#2a221c'); } } }
        { const q = Q.left(r.box, 8.55, 8.9, 1.2, 1.57); fillPoly(g, q, '#f2ecdc'); strokePoly(g, q, '#a8a08c'); const b = polyBox(q); for (let k = 0; k < 3; k++) pxRect(g, b.x0 + 1 + k * 2, b.cy - 1, 1, 3, r.lightsOff ? '#d8cfb6' : '#ffffff'); }
        { const q = Q.right(r.box, 12.45, 12.75, 1.2, 1.7); fillPoly(g, q, '#c8241c'); strokePoly(g, q, '#7a1410'); const b = polyBox(q); pxRect(g, b.x0 + 1, b.cy, b.x1 - b.x0 - 2, 1, '#f4f4ee'); }
        sideDoor(g, r, 'right', 9.6, 11.4, '#d4ccb4');
        // the doorway back out to the lobby, in the back wall's right end
        { fillPoly(g, Q.back(r.box, 5.16, 6.84, 0, 3.05), '#f6f3ea'); fillPoly(g, Q.back(r.box, 5.3, 6.7, 0, 2.9), '#c9b996'); fillPoly(g, Q.back(r.box, 5.3, 6.7, 0, .5), dither('#000000', 4)); fillPoly(g, Q.back(r.box, 5.3, 6.0, 0, 2.9), dither('#000000', 3)); }
        // cubicle ghosts: darker, less-trodden carpet where the workstations stood, and the dents their feet left
        for (const [xa, xb, za, zb2] of [[-5.6, -3.2, 10.2, 12.6], [-1.4, 1.2, 11.4, 13.2], [3.4, 5.8, 10.4, 12.8]]) {
          fillPoly(g, Q.floor(xa, xb, za, zb2), rgba(mix(p.floor.base, '#1a2030', .3), .22));
          for (const [x, z] of [[xa, za], [xb, za], [xa, zb2], [xb, zb2]]) { const c = P(x, 0, z); pxRect(g, c[0] - 1, c[1], 2, 1, 'rgba(20,20,30,0.4)'); }
        }
        { const cv = cond('o_carpet');                                   // the carpet tile in the aisle
          if (cv === 1) { fillPoly(g, Q.floor(-.9, .5, 5, 13), rgba(mix(p.floor.base, '#c8c8c0', .4), .25)); fillPoly(g, floorBlob(-2.2, 9.6, .6, .4, 7, .3, 14), rgba(mix(p.floor.base, '#d0d0c8', .4), .3)); }
          if (cv === 2) { stain(g, floorBlob(-1.6, 8.8, .55, .32, 37, .55, 16), 'rgba(20,20,26,0.55)', 'rgba(10,10,14,0.75)', 37); for (let k = 0; k < 3; k++) { const a = P(-1.2, 0, 8.7 + k * .1), b = P(-.4 + k * .1, 0, 8.6 + k * .12); pxLine(g, a[0], a[1], b[0], b[1], 'rgba(20,20,26,0.35)'); } }
          if (cv === 3) for (const [x, z] of [[-.9, 9.2], [0, 9.2], [-.45, 10]]) { const q = Q.floor(x - .45, x + .45, z - .4, z + .4); strokePoly(g, q, 'rgba(255,255,255,0.4)'); const a = P(x + .45, .06, z - .4); pxRect(g, a[0] - 3, a[1] - 1, 4, 2, 'rgba(255,255,255,0.35)'); pxLine(g, P(x - .45, 0, z - .4)[0], P(x - .45, 0, z - .4)[1] + 1, a[0], a[1] + 2, 'rgba(10,10,20,0.4)'); } }
        // the floor box in the aisle where the cubicles plugged in
        { const fv = cond('o_floorbox'), q = Q.floor(2.25, 3.05, 7.95, 8.55), b = polyBox(q);
          fillPoly(g, q, '#b8a060'); fillPoly(g, Q.floor(2.31, 3, 8.01, 8.5), fv === 1 ? '#a8aab0' : '#8e9096');
          if (fv === 2) { fillPoly(g, Q.floor(2.66, 2.98, 8.04, 8.48), '#1a1a1c'); for (let k = 0; k < 4; k++) { const a = P(2.8 + k * .04, .05, 8.25), c = P(3.6 + k * .2, 0, 7.6 - k * .15); pxLine(g, a[0], a[1], c[0], c[1], k % 2 ? '#9aa0a8' : '#7a8088'); } }
          if (fv === 3) { fillPoly(g, Q.floor(2.33, 2.65, 8.04, 8.48), '#141416'); const c = P(2.5, .06, 8.25); pxLine(g, c[0] - 2, c[1] + 2, c[0] - 2, c[1] - 2, '#1a1a1a'); pxLine(g, c[0] + 1, c[1] + 2, c[0] + 2, c[1] - 2, '#f4f4ee'); pxRect(g, c[0] - 2, c[1] - 3, 1, 1, '#d8904a'); pxRect(g, c[0] + 2, c[1] - 3, 1, 1, '#d8904a'); }
          pxRect(g, b.cx, b.y0 + 1, 1, b.y1 - b.y0 - 2, 'rgba(60,50,30,0.5)'); }
        box3(g, 4.6, 5.3, 0, 4, 8.6, 9.3, { front: mix(p.wall, '#ffffff', .05), side: p.wallL });   // the column
        fillPoly(g, [P(4.6, 0, 8.6), P(5.3, 0, 8.6), P(5.3, .14, 8.6), P(4.6, .14, 8.6)], '#34343a');
      },
      dynamic(g, r, t) {
        drawBlinds(g, r, t);
        for (const [x, z] of [[-4, 6.8], [3, 6.8], [-4, 11.2], [5, 11.8], [1, 12.4]]) troffGlow(g, r, x, z);
        const tv = cond('o_troffer');
        if (tv === 3) drawDroppedTroffer(g, r, t);
        else if (!r.lightsOff) troffGlow(g, r, -1, 9.8);
        if (cond('o_ceiling') === 3 && Settings.get('motion')) { const c = polyBox(Q.ceil(r.box, 2.03, 2.97, 9.03, 9.97)), f = P(2.5, 0, 9.5), k = (t * .8) % 1; pxRect(g, c.cx, c.cy + (f[1] - c.cy) * k, 1, 2, '#bfe3f4'); if (k > .9) pxRect(g, f[0] - 2, f[1], 4, 1, 'rgba(190,227,244,0.7)'); }
      }
    },
    /* ---------------- BREAK ROOM ---------------- */
    o_break: {
      name: 'Break Room', box: { x0: -5, x1: 5, h: 4, zb: 11.5 }, amb: .3,
      floor: tileFloor(.7), floorBase: p => p.floor[0],
      walk: { x0: -4.4, x1: 4.4, z0: 4.8, z1: 10.3 }, start: { x: -3.8, z: 8.4 },
      windows: [],
      doors: [{ id: 'o_toOpen2', side: 'left', za: 7.4, zb: 9.2, to: 'o_open', name: 'Open office', walk: { x: -4.4, z: 8.3 }, spawn: { x: 6, z: 10.5 } }],
      features: {
        o_sink: { pts: () => hull(boxPts(-3, -.9, 0, 1.15, 10.85, 11.5)), walk: { x: -2, z: 9.8 } },
        o_gfci: { pts: () => Q.back(box('o_break'), -.62, -.26, 1.08, 1.5), walk: { x: -.4, z: 9.8 } },
        o_fridge: { pts: () => hull(boxPts(3, 4.4, 0, 2.75, 10.7, 11.5)), walk: { x: 3.4, z: 9.8 } },
        o_microwave: { pts: () => hull(boxPts(1.1, 2.3, .96, 1.62, 10.95, 11.4)), walk: { x: 1.6, z: 9.8 } },
        o_vct: { pts: () => Q.floor(-2.6, 2.2, 7, 10.4), walk: { x: 0, z: 6.6 } },
        o_firstaid: { pts: () => Q.right(box('o_break'), 7.9, 8.9, 1.25, 2.35), walk: { x: 4.2, z: 8.4 } }
      },
      scenery: [
        { id: 'o_bswitch', name: 'Light switch', pts: () => Q.left(box('o_break'), 9.5, 9.85, 1.15, 1.6), walk: { x: -4.2, z: 9.6 }, use: lightUse('o_break', 'the break room lights'), look: 'The switch for the break room lights.' },
        { id: 'o_poster', name: 'Workplace posters', pts: () => Q.right(box('o_break'), 9.5, 10.9, 1.2, 2.5), walk: { x: 4.2, z: 9.6 },
          look: "The required posters, in a laminated frame: OSHA's 'Job Safety and Health: It's the Law!' (29 CFR 1903.2), minimum wage, and equal opportunity. The building leaves this frame up for whoever moves in next.",
          touch: 'Laminated. Someone has drawn a tiny mustache on the minimum wage guy. It wipes off.', smell: 'Laminate.', talk: 'You read the poster your rights. It already knows them.' },
        { id: 'o_vend', name: 'Vending machine outline', pts: () => Q.floor(-4.6, -3.6, 10.2, 11.4), walk: { x: -3.8, z: 9.6 },
          look: 'Four little dents in the tile and a gray rectangle of dust where the snack machine stood. The vendor picked it up Friday. Clean, not damage: the dust mops right up.',
          touch: 'Dust. A single quarter, stuck to the floor with soda. You leave it for luck.' }
      ],
      walls(g, r) {
        const zb = r.box.zb, p = Decor.pal('o_break');
        ceilingGrid(g, r); troffer(g, r, -1.4, -.6, 7.4, 9); troffer(g, r, 1.6, 2.4, 7.4, 9);
        coveBase(g, r);
        { const q = Q.floor(-4.6, -3.6, 10.2, 11.4); fillPoly(g, q, 'rgba(120,116,104,0.28)'); for (const [x, z] of [[-4.5, 10.3], [-3.7, 10.3], [-4.5, 11.3], [-3.7, 11.3]]) { const c = P(x, 0, z); pxRect(g, c[0], c[1], 2, 1, 'rgba(40,36,30,0.5)'); } }
        // the counter run: upper cabinets, backsplash, base cabinets, and a laminate top
        const CAB = '#e2ded4', CAB2 = '#d2cec4', TOP = '#b9b2a4';
        box3(g, -4.2, .9, 2.1, 3.5, 11.15, zb, { front: CAB, side: CAB2, bottom: '#c4c0b6' });
        for (let x = -4.15; x < .85; x += .85) { fillPoly(g, [P(x + .06, 2.18, 11.15), P(x + .79, 2.18, 11.15), P(x + .79, 3.42, 11.15), P(x + .06, 3.42, 11.15)], mix(CAB, '#ffffff', .2)); const k = P(x + .7, 2.3, 11.15); pxRect(g, k[0], k[1], 1, 3, '#8a9098'); }
        box3(g, .9, 2.6, 2.4, 3.5, 11.15, zb, { front: CAB, side: CAB2, bottom: '#c4c0b6' });
        fillPoly(g, Q.back(r.box, -4.2, 2.6, .96, 1.12), TOP);
        box3(g, -4.2, 2.6, 0, .88, 10.9, zb, { front: CAB, side: CAB2 });
        for (let x = -4.15; x < 2.55; x += .85) { if (x > -3.1 && x < -.9) continue; fillPoly(g, [P(x + .05, .1, 10.9), P(x + .8, .1, 10.9), P(x + .8, .84, 10.9), P(x + .05, .84, 10.9)], mix(CAB, '#ffffff', .2)); const k = P(x + .7, .7, 10.9); pxRect(g, k[0], k[1], 1, 3, '#8a9098'); }
        { const sv = cond('o_sink');                                     // the sink's two doors
          for (const [xa, xb] of [[-3, -1.95], [-1.95, -.9]]) { fillPoly(g, [P(xa + .04, .1, 10.9), P(xb - .04, .1, 10.9), P(xb - .04, .84, 10.9), P(xa + .04, .84, 10.9)], mix(CAB, '#ffffff', .2)); }
          if (sv === 3) fillPoly(g, [P(-3, .05, 10.9), P(-.9, .05, 10.9), P(-.9, .2, 10.9), P(-3, .2, 10.9)], 'rgba(110,90,60,0.5)');
          box3(g, -4.25, 2.65, .88, .96, 10.85, zb, { front: '#9a9284', top: TOP, side: '#8a8274' });
          speckPoly(g, [P(-4.25, .96, 10.85), P(2.65, .96, 10.85), P(2.65, .96, zb), P(-4.25, .96, zb)], '#a39c8e', .5, 8);
          fillPoly(g, [P(-2.75, .96, 11.0), P(-1.15, .96, 11.0), P(-1.15, .96, 11.4), P(-2.75, .96, 11.4)], '#a9aeb7'); fillPoly(g, [P(-2.65, .96, 11.06), P(-1.25, .96, 11.06), P(-1.25, .96, 11.34), P(-2.65, .96, 11.34)], '#7f848e');
          { const a = P(-1.95, .96, 11.44), b = P(-1.95, 1.42, 11.44), c = P(-1.95, 1.4, 11.2); pxLine(g, a[0], a[1], b[0], b[1], '#d9dce4', 2); pxLine(g, b[0], b[1], c[0], c[1] + 2, '#d9dce4', 2); }
          if (sv === 2) { const a = P(-1.0, .96, 11.4), b = P(-1.0, 1.2, 11.4); pxLine(g, a[0], a[1], b[0], b[1], '#c9ccd4'); pxRect(g, b[0] - 2, b[1], 3, 1, '#c9ccd4'); }
        }
        // the counter outlet, between the sink and the microwave
        { const gv = cond('o_gfci'), q = Q.back(r.box, -.58, -.3, 1.12, 1.46), b = polyBox(q);
          fillPoly(g, q, gv === 1 ? '#e6d39a' : gv === 3 ? '#d8c088' : '#efe6d2'); strokePoly(g, q, '#8b8574');
          pxRect(g, b.cx - 1, b.cy - 1, 3, 2, '#c8c2b2');
          if (gv === 3) { pxRect(g, b.x0 + 1, b.y0 + 1, b.x1 - b.x0 - 2, 3, 'rgba(90,58,26,0.6)'); }
          if (gv === 2) pxRect(g, b.x1 - 2, b.y0, 2, 2, Decor.pal('o_break').back); }
        outletBack(g, r, 2.1, 1.12);
        // the microwave on the counter
        { const mv = cond('o_microwave');
          box3(g, 1.1, 2.3, .96, 1.6, 11.0, 11.42, { front: '#26262a', top: '#3a3a40', side: '#1c1c20' });
          fillPoly(g, [P(1.16, 1.02, 11.0), P(1.86, 1.02, 11.0), P(1.86, 1.54, 11.0), P(1.16, 1.54, 11.0)], mv === 2 ? '#20180e' : '#141416');
          { const d = P(1.93, 1.5, 11.0); pxRect(g, d[0], d[1], 4, 1, '#5ae07a'); for (let k = 0; k < 3; k++) pxRect(g, d[0], d[1] + 3 + k * 2, 4, 1, '#4a4a52'); }
          const cd = P(2.3, 1.0, 11.2), pl = P(2.15, 1.25, zb); pxLine(g, cd[0], cd[1], pl[0], pl[1], '#1a1a1c');
          if (mv === 3) { const f = P(2.55, .96, 10.95); pxLine(g, cd[0], cd[1], f[0], f[1] + 2, '#1a1a1c'); pxRect(g, f[0], f[1] + 1, 2, 1, '#d8904a'); } }
        // the fridge, white, top freezer
        { const fv = cond('o_fridge');
          if (fv === 3) fillPoly(g, floorBlob(3.6, 10.45, .7, .35, 9, .5, 16), rgba('#9fc8dc', .5));
          box3(g, 3, 4.4, 0, 2.75, 10.7, zb, { front: '#f2f2ee', side: '#d8d8d2', top: '#e4e4de' });
          fillPoly(g, [P(3.02, 1.98, 10.7), P(4.38, 1.98, 10.7), P(4.38, 2.02, 10.7), P(3.02, 2.02, 10.7)], '#9a9a96');
          for (const [ya, yb] of [[2.2, 2.6], [1.1, 1.8]]) { const a = P(3.12, ya, 10.68), b = P(3.12, yb, 10.68); pxLine(g, a[0], a[1], b[0], b[1], '#b8b8b4', 2); }
          fillPoly(g, [P(3.02, .02, 10.7), P(4.38, .02, 10.7), P(4.38, .14, 10.7), P(3.02, .14, 10.7)], '#3a3a3c');
          if (fv === 1) { const c = P(4.33, .3, 10.7); pxRect(g, c[0], c[1] - 3, 1, 4, '#5a5a56'); } }
        // the first aid cabinet on the right wall
        { const av = cond('o_firstaid'), q = Q.right(r.box, 8, 8.8, 1.3, 2.3), b = polyBox(q);
          fillPoly(g, q, '#f6f6f2'); strokePoly(g, q, '#a8a8a2');
          if (av === 2) fillPoly(g, [P(r.box.x1 - .25, 1.25, 8.0), P(r.box.x1, 1.3, 8.05), P(r.box.x1, 2.0, 8.05), P(r.box.x1 - .32, 1.95, 8.0)], '#e8e8e2');
          pxRect(g, b.cx - 1, b.cy - 4, 2, 7, '#d42a2a'); pxRect(g, b.cx - 3, b.cy - 2, 7, 2, '#d42a2a'); }
        { const q = Q.right(r.box, 9.5, 10.9, 1.2, 2.5); fillPoly(g, q, '#2a2a30'); fillPoly(g, Q.right(r.box, 9.58, 10.15, 1.28, 2.42), '#f4f0e0'); fillPoly(g, Q.right(r.box, 10.22, 10.82, 1.28, 2.42), '#e8eef4');
          const t0 = P(r.box.x1, 2.3, 9.7), t1 = P(r.box.x1, 2.3, 10.05); pxLine(g, t0[0], t0[1], t1[0], t1[1], '#2a4a8a'); }
        { const q = Q.left(r.box, 9.55, 9.82, 1.2, 1.55); fillPoly(g, q, '#f2ecdc'); strokePoly(g, q, '#a8a08c'); toggleIn(g, q, !r.lightsOff); }
        sideDoor(g, r, 'left', 7.4, 9.2, '#c9b996');
      },
      dynamic(g, r, t) {
        troffGlow(g, r, -1, 8.2); troffGlow(g, r, 2, 8.2);
        if (cond('o_gfci') === 3 && Settings.get('motion') && (t * 1.3) % 1 < .1) { const c = polyBox(Q.back(r.box, -.58, -.3, 1.12, 1.46)); softGlow(g, c.cx, c.cy, 8, 6, '#ffe08a', .4); pxRect(g, c.cx, c.cy - 2, 1, 1, '#ffffff'); }
        if (cond('o_fridge') === 3 && Settings.get('motion') && (t * .5) % 1 < .5) { const c = P(3.8, 0, 10.5); pxRect(g, c[0] - 3, c[1], 3, 1, 'rgba(230,245,255,0.6)'); }
      }
    },
    /* ---------------- SERVER / ELECTRICAL ROOM ---------------- */
    o_server: {
      name: 'Server Room', box: { x0: -4, x1: 4, h: 4, zb: 10 }, amb: .7,
      floor: (g, r, p) => concreteFloor(g, r, p), floorBase: p => p.floor.base,
      walk: { x0: -3.4, x1: 3.4, z0: 4.8, z1: 8.1 }, start: { x: -3, z: 7.3 },
      windows: [],
      doors: [{ id: 'o_toOpen3', side: 'left', za: 6.4, zb: 8.2, to: 'o_open', name: 'Open office', walk: { x: -3.4, z: 7.3 }, spawn: { x: 4, z: 12.8 } }],
      features: {
        o_panel: { pts: () => Q.back(box('o_server'), -3.38, -2.02, .76, 2.66), walk: { x: -2.7, z: 8 } },
        o_rack: { pts: () => hull(boxPts(.3, 1.7, 0, 3.15, 8.4, 9.4)), walk: { x: 1, z: 7.6 } },
        o_ups: { pts: () => hull(boxPts(2.0, 2.9, 0, 1.3, 8.6, 9.6)), walk: { x: 2.4, z: 7.8 } },
        o_minisplit: { pts: () => Q.back(box('o_server'), -1.75, .25, 2.9, 3.55), walk: { x: -.8, z: 8 } },
        o_sprinkler: { pts: () => { const c = P(1, 3.55, 8.9); return [[c[0] - 9, c[1] - 12], [c[0] + 9, c[1] - 12], [c[0] + 9, c[1] + 7], [c[0] - 9, c[1] + 7]]; }, walk: { x: 1, z: 7.4 } }
      },
      scenery: [
        { id: 'o_sswitch', name: 'Light switch', pts: () => Q.left(box('o_server'), 8.4, 8.75, 1.15, 1.6), walk: { x: -3.3, z: 8 }, use: lightUse('o_server', 'the server room light'), look: 'The light switch, with a label-maker label: LIGHTS (NOT THE SERVERS).' },
        { id: 'o_backboard', name: 'Phone backboard', pts: () => Q.right(box('o_server'), 7.4, 9.6, .9, 3.1), walk: { x: 3.3, z: 8 },
          look: 'A fire-rated plywood backboard with the phone company\'s demarc and two rows of punch-down blocks, a rainbow of phone wire, and extension numbers written right on the wood. That\'s what the plywood is for.',
          touch: 'You run a finger down a punch-down block. Hundreds of little wires, and you are not unplugging any of them.', smell: 'Plywood and warm electronics.', talk: '"Hello?" Somewhere, a phone extension rings once. You decide that was a coincidence.' },
        { id: 'o_cext', name: 'CO2 extinguisher', pts: () => Q.right(box('o_server'), 5.6, 6.1, .5, 1.5), walk: { x: 3.3, z: 6.2 },
          look: 'A CO2 extinguisher on a hook, the right kind for a room full of electronics. Tag punched for September. The building\'s, and it\'s fine (29 CFR 1910.157(c)(4)).', touch: 'Heavy, cold, and full.', smell: 'Nothing.' }
      ],
      shell(g, r) {
        // the server room has no drop ceiling: an open deck painted dark, with the sprinkler main across it
        const { x0, x1, h, zb } = r.box, zn = 1.6, p = Decor.pal('o_server');
        fillPoly(g, [P(x0, h, zn), P(x1, h, zn), P(x1, h, zb), P(x0, h, zb)], '#4a4c52');
        for (let x = Math.ceil(x0); x <= x1; x += .5) lineW(g, P(x, h, 3), P(x, h, zb), '#3e4046');
        const fl = [P(x0, 0, zn), P(x1, 0, zn), P(x1, 0, zb), P(x0, 0, zb)]; fillPoly(g, fl, r.floorBase(p)); clipDo(g, fl, () => r.floor(g, r, p));
        const L = [P(x0, 0, zn), P(x0, 0, zb), P(x0, h, zb), P(x0, h, zn)], R = [P(x1, 0, zn), P(x1, 0, zb), P(x1, h, zb), P(x1, h, zn)], B = Q.back(r.box, x0, x1, 0, h);
        fillPoly(g, L, p.wallL); fillPoly(g, R, p.wallR); fillPoly(g, B, p.back);
        for (const [pts, s] of [[L, 5], [R, 6], [B, 7]]) speckPoly(g, pts, 'rgba(0,0,0,0.04)', .2, s);
        fillPoly(g, Q.back(r.box, x0, x1, h - .4, h), p.band1(p.back)); fillPoly(g, Q.floor(x0, x1, zb - .45, zb), rgba(Decor.time.shadow, .14));
        lineW(g, P(x0, 0, zb), P(x0, h, zb), 'rgba(40,30,40,0.35)'); lineW(g, P(x1, 0, zb), P(x1, h, zb), 'rgba(40,30,40,0.35)');
        coveBase(g, r);                                                  // (the engine draws walls(), the oddities, and the left-behind things next)
      },
      walls(g, r) {
        const zb = r.box.zb, p = Decor.pal('o_server');
        // the cable ladder overhead, and the sprinkler main
        for (const z of [8.3, 9.1]) lineW(g, P(-1, 3.5, z), P(3.6, 3.5, z), '#8a8e96');
        for (let x = -1; x < 3.6; x += .3) lineW(g, P(x, 3.5, 8.3), P(x, 3.5, 9.1), '#7a7e86');
        { const a = P(-4, 3.72, 8.9), b = P(4, 3.72, 8.9); pxLine(g, a[0], a[1], b[0], b[1], '#2e3034', 2); pxLine(g, a[0], a[1] - 1, b[0], b[1] - 1, '#5a5e64'); }
        drawSprinklerRoom(g, r);
        // the electrical panel, its clear-space floor marking, and what's (not) in front of it
        { const pv = cond('o_panel'), fl = flags('o_panel'), q = Q.back(r.box, -3.3, -2.1, .8, 2.6);
          const hatch = Q.floor(-3.6, -1.8, 8.8, 9.98); fillPoly(g, hatch, '#d8b820'); clipDo(g, hatch, () => { for (let x = -4; x < -1.6; x += .25) lineW(g, P(x, 0, 9.98), P(x + .5, 0, 8.8), '#2a2a2a'); });
          fillPoly(g, q, '#a4a8ae'); fillPoly(g, Q.back(r.box, -3.24, -2.16, .86, 2.54), pv === 3 || fl.open ? '#3a3c40' : '#b4b8be');
          if (pv === 3 || fl.open) { const bus = Q.back(r.box, -2.75, -2.65, .95, 2.4); fillPoly(g, bus, pv === 3 ? '#d08a4a' : '#c4c6ca'); for (let y = 1; y < 2.4; y += .18) { fillPoly(g, Q.back(r.box, -3.1, -2.8, y, y + .1), '#1c1c20'); fillPoly(g, Q.back(r.box, -2.6, -2.3, y, y + .1), '#1c1c20'); } }
          else { const s = polyBox(Q.back(r.box, -3.0, -2.4, 2.2, 2.42)); pxRect(g, s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0, '#1a1a1a'); pxRect(g, s.x0 + 1, s.y0 + 1, s.x1 - s.x0 - 2, 2, '#c42a2a'); const k = P(-2.25, 1.7, zb); pxRect(g, k[0], k[1], 2, 4, '#2a2a2e'); }
          if (pv === 2) { box3(g, -3.4, -2.5, 0, .8, 8.9, 9.6, { front: '#b8905a', top: '#c8a06a', side: '#9a7444' }); box3(g, -2.5, -1.7, 0, .55, 9.05, 9.7, { front: '#ae8650', top: '#c09460', side: '#8a6a3e' }); box3(g, -3.2, -2.7, .8, 1.25, 9.0, 9.45, { front: '#d8d0b8', top: '#e4dcc4', side: '#b8b098' });
            const s = P(-2.95, 1.1, 9.0); pxRect(g, s[0] - 2, s[1] - 2, 5, 4, '#2a3a34'); } }
        // the mini-split AC head, and its line set down the wall
        { const mv = cond('o_minisplit'), body = mv === 1 ? '#ece6d2' : '#f4f4f0';
          box3(g, -1.7, .2, 2.95, 3.45, zb - .35, zb, { front: body, bottom: '#c8c8c4', side: '#d8d8d4' });
          fillPoly(g, [P(-1.62, 2.98, zb - .35), P(.12, 2.98, zb - .35), P(.12, 3.06, zb - .35), P(-1.62, 3.06, zb - .35)], '#3a3a3e');
          if (mv === 2) { const a = P(-1.0, 2.98, zb - .36), b = P(-.6, 2.86, zb - .36); pxLine(g, a[0], a[1], b[0], b[1], '#e8e8e4'); }
          { const d = P(-.05, 3.3, zb - .36); pxRect(g, d[0] - 4, d[1], 3, 1, '#4aa0e8'); }
          { const a = P(.3, 2.9, zb), b = P(.3, 0, zb); pxLine(g, a[0], a[1], b[0], b[1], '#e8e8e4', 3); }
          if (mv === 3) { const a = P(-1.4, 2.9, zb), b = P(-1.6, .15, zb); g.fillStyle = 'rgba(40,50,70,0.22)'; g.fillRect(Math.min(a[0], b[0]) - 1, a[1], 5, b[1] - a[1]); fillPoly(g, floorBlob(-1.5, 9.7, .5, .2, 3, .4, 12), 'rgba(150,190,210,0.4)'); } }
        // the rack and the UPS
        drawRackRoom(g, r);
        { const uv = cond('o_ups'), bulge = uv === 3 ? .06 : 0;
          box3(g, 2.0, 2.8 + bulge, 0, 1.3, 8.7, 9.6, { front: '#26262a', top: uv === 2 ? '#4a3a2a' : '#3a3a40', side: '#18181a' });
          const lcd = Q.back({ ...r.box, zb: 8.7 }, 2.15, 2.6, 1.0, 1.15); fillPoly(g, lcd, uv === 3 ? '#e85a4a' : uv === 1 ? '#e8b84a' : '#7ac8d8');
          for (let y = .2; y < .85; y += .1) lineW(g, P(2.12, y, 8.7), P(2.68, y, 8.7), '#121214');
          if (uv === 1) speckPoly(g, Q.back({ ...r.box, zb: 8.7 }, 2.1, 2.7, .2, .85), '#8a8a86', .5, 4);
          if (uv === 2) { const a = P(2.3, 1.3, 8.7), b = P(2.32, .7, 8.7); pxLine(g, a[0], a[1], b[0], b[1], 'rgba(90,58,26,0.75)', 2); } }
        { const q = Q.right(r.box, 7.4, 9.6, .9, 3.1); fillPoly(g, q, '#c8a46a'); strokePoly(g, q, '#8a6a3a');
          for (const [za, zb2] of [[7.6, 8.3], [8.6, 9.3]]) fillPoly(g, Q.right(r.box, za, zb2, 1.6, 2.6), '#f0ece0');
          for (let y = 1.7; y < 2.6; y += .12) lineW(g, P(r.box.x1, y, 7.65), P(r.box.x1, y, 8.25), y % .24 < .12 ? '#3a7ac8' : '#c86a3a'); }
        { const q = Q.right(r.box, 5.65, 6.05, .55, 1.45), b = polyBox(q); pxRect(g, b.x0 + 1, b.y0 + 2, b.x1 - b.x0 - 2, b.y1 - b.y0 - 2, '#c41e18'); pxRect(g, b.x0 + 1, b.y0, 2, 2, '#1a1a1a'); }
        { const q = Q.left(r.box, 8.45, 8.72, 1.2, 1.55); fillPoly(g, q, '#f2ecdc'); strokePoly(g, q, '#a8a08c'); toggleIn(g, q, !r.lightsOff); }
        sideDoor(g, r, 'left', 6.4, 8.2, '#c4bca8');
        // a single bare-tube strip light hung from the deck
        { const a = P(-.8, 3.6, 7), b = P(.8, 3.6, 7); pxRect(g, a[0], a[1], b[0] - a[0], 2, r.lightsOff ? '#b4b8b2' : '#fffff4'); pxRect(g, a[0], a[1] - 1, b[0] - a[0], 1, '#8a8e96'); }
      },
      dynamic(g, r, t) {
        if (!r.lightsOff) { const c = P(0, 3.6, 7); softGlow(g, c[0], c[1] + 2, 60, 12, '#fffef0', .2); }
        const rv = cond('o_rack'), uv = cond('o_ups'), blink = k => Math.floor(t * 6 + k * 1.7) % 3 === 0;
        if (rv === 2) for (let k = 0; k < 6; k++) { const c = P(.5 + k * .14, 2.55, 8.4); if (blink(k)) pxRect(g, c[0], c[1], 1, 1, '#6aff6a'); }
        { const c = P(2.2, .9, 8.7); pxRect(g, c[0], c[1], 1, 1, uv === 3 ? (Math.floor(t * 4) % 2 ? '#ff4a3a' : '#5a1a14') : uv === 1 ? '#f2c418' : '#6aff6a'); }
        if (cond('o_minisplit') === 3 && Settings.get('motion')) { const a = P(-1.4, 2.92, r.box.zb - .1), f = P(-1.45, 0, 9.7), k = (t * 1.3) % 1; pxRect(g, a[0], a[1] + (f[1] - a[1]) * k, 1, 2, '#bfe3f4'); }
        if (uv === 3 && Settings.get('motion')) for (let k = 0; k < 3; k++) { const c = P(2.2 + k * .25, 1.4, 9.1), y = (t * 9 + k * 4) % 8; pxRect(g, c[0] + Math.sin(t * 5 + k) * 1.5, c[1] - y, 1, 1, 'rgba(255,240,220,0.35)'); }
      }
    }
  };
  for (const [k, r] of Object.entries(ROOMS_O)) r.id = k;

  /* ---------- floors ---------- */
  /* carpet tile, quarter-turned, from a palette { base, dk, lt } */
  function carpetTileFloor(g, r, p) {
    const f = p.floor, { x0, x1, zb } = r.box;
    for (let z = zb; z > 1.8; z -= 1) for (let x = x0, i = 0; x < x1; x += 1, i++) {
      const n = Math.round(x) + Math.round(z), q = Q.floor(x, x + 1, z - 1, z);
      fillPoly(g, q, mix(f.base, n % 2 ? f.lt : f.dk, .14));
    }
    speckle(g, 0, CAM.hy, SW, SH - CAM.hy, f.dk, 3600, 11); speckle(g, 0, CAM.hy, SW, SH - CAM.hy, f.lt, 2400, 12);
    for (let z = Math.floor(zb); z > 2; z--) lineW(g, P(x0, 0, z), P(x1, 0, z), rgba(mix(f.dk, '#000000', .3), .22));
    for (let x = Math.ceil(x0); x < x1; x++) lineW(g, P(x, 0, 2.2), P(x, 0, zb), rgba(mix(f.dk, '#000000', .3), .22));
  }
  /* sealed concrete, with saw-cut control joints and a little sheen */
  function concreteFloor(g, r, p) {
    const f = p.floor, { x0, x1, zb } = r.box;
    speckle(g, 0, CAM.hy, SW, SH - CAM.hy, f.dk, 5200, 14); speckle(g, 0, CAM.hy, SW, SH - CAM.hy, f.lt, 3800, 15);
    for (const z of [5, 7.5]) lineW(g, P(x0, 0, z), P(x1, 0, z), rgba(mix(f.dk, '#000000', .4), .45));
    lineW(g, P(0, 0, 2), P(0, 0, zb), rgba(mix(f.dk, '#000000', .4), .45));
    for (let k = 0; k < 5; k++) fillPoly(g, floorBlob(-2 + k * 1.1, 6 + hash(k) * 3, .9, .4, k * 5, .3, 14), 'rgba(255,255,255,0.035)');
  }
  /* ---------- the open office's blinds: horizontal mini-blinds, lowered a third of the way, slats tilted open ---------- */
  function drawBlinds(g, r, t) {
    const wv = cond('o_window'), zb = r.box.zb, bottom = 2.35;
    for (const [xa, xb] of [[-6.4, -4.14], [-4.0, -1.8], [-1.66, .6]]) {
      fillPoly(g, Q.back(r.box, xa, xb, 3.0, 3.1), '#c8cacc');
      for (let y = 2.97, i = 0; y > bottom; y -= .065, i++) {
        const snapped = wv === 2 && xa === -4.0 && y < 2.8 && y > 2.45;
        const col = wv === 1 ? '#e6e6e0' : '#d8dadc';
        if (snapped) { if (i % 3 === 0) { const a = P(-3.3, y, zb), b = P(-2.9, y - .12, zb); pxLine(g, a[0], a[1], b[0], b[1], col); } lineW(g, P(xa, y, zb), P(-3.4, y, zb), col); lineW(g, P(-2.5, y, zb), P(xb, y, zb), col); continue; }
        lineW(g, P(xa, y, zb), P(xb, y, zb), col);
        if (wv === 1 && (i === 3 || i === 6)) { const m = P((xa + xb) / 2, y - .03, zb); pxRect(g, m[0] - 2, m[1], 4, 1, '#b8bab8'); }
      }
      fillPoly(g, Q.back(r.box, xa, xb, bottom - .04, bottom), '#b8babc');
    }
    if (wv === 2) for (const x of [-3.2, -2.8]) { const f = P(x, .9, zb - .15); pxRect(g, f[0] - 2, f[1], 5, 1, '#d8dadc'); }
  }
  /* the troffer that's dropped out of the grid: one end still up, the other hanging on its whip */
  function drawDroppedTroffer(g, r, t) {
    const h = r.box.h, on = !r.lightsOff && !(Settings.get('motion') && flickerDark(t, 7, 3, .9));
    fillPoly(g, Q.ceil(r.box, -1.4, -.6, 9, 10.6), '#1c1a18');                                                      // the hole in the grid
    const pts = [P(-1.4, h, 9), P(-.6, h, 9), P(-.6, h - .55, 10.6), P(-1.4, h - .55, 10.6)];
    fillPoly(g, pts, '#d6d6d0'); fillPoly(g, shrink(pts, .82), on ? '#fbfcf2' : '#c6cac4');
    const w0 = P(-.8, h, 10.5), w1 = P(-.8, h - .5, 10.5); pxLine(g, w0[0], w0[1], w1[0] + 2, w1[1], '#6a6e76', 2);
    if (on) { const c = polyBox(pts); softGlow(g, c.cx, c.cy + 6, 40, 12, '#fffef0', .2); }
  }
  /* the sprinkler drop over the rack, in the room view */
  function drawSprinklerRoom(g, r) {
    const sv = cond('o_sprinkler'), c = P(1, 3.72, 8.9), d = P(1, 3.5, 8.9);
    pxLine(g, c[0], c[1], d[0], d[1], '#3a3c40', 2); pxRect(g, d[0] - 2, d[1], 5, 1, sv === 3 ? '#e8e2d0' : '#c9a227'); pxRect(g, d[0], d[1] - 2, 1, 2, sv === 3 ? '#e0d8c0' : '#e02a1a');
    if (sv === 2) { for (let k = 0; k < 3; k++) { const a = P(-2 + k * 1.6, 3.66, 8.9), b = P(-1.2 + k * 1.6, 3.55, 8.9); pxLine(g, a[0], a[1], b[0], b[1] + 2, '#3a5ac8'); pxLine(g, b[0], b[1] + 2, a[0] + 22, a[1], '#3a5ac8'); } }
    if (sv === 4) { box3(g, -.2, .9, 2.4, 3.3, 8.7, 9.3, { front: '#b8905a', top: '#c8a06a', side: '#9a7444' }); box3(g, .9, 1.9, 2.5, 3.32, 8.75, 9.3, { front: '#ae8650', top: '#c09460', side: '#8a6a3e' }); }
  }
  /* the rack in the room view: four black posts, and whatever's (still) in it */
  function drawRackRoom(g, r) {
    const rv = cond('o_rack'), lean = rv === 3 ? .18 : 0, X = (x, y) => x + y * lean / 3.15;
    const post = (x, z, c) => fillPoly(g, [P(X(x, 0), 0, z), P(X(x + .08, 0), 0, z), P(X(x + .08, 3.15), 3.15, z), P(X(x, 3.15), 3.15, z)], c);
    post(.3, 9.4, '#141416'); post(1.62, 9.4, '#141416');
    if (rv === 2 || rv === 3) {
      for (const [y0, y1, c] of rv === 2 ? [[2.4, 2.6, '#2a2a30'], [2.1, 2.35, '#3a4a6a'], [1.6, 1.95, '#1c1c20'], [1.2, 1.5, '#2a2a2e']] : [[2.5, 2.95, '#5a5e66']]) fillPoly(g, [P(X(.38, y0), y0, 8.4), P(X(1.62, y0), y0, 8.4), P(X(1.62, y1), y1, 8.4), P(X(.38, y1), y1, 8.4)], c);
      if (rv === 2) for (let k = 0; k < 7; k++) { const a = P(.45 + k * .17, 2.45, 8.4), b = P(.5 + k * .15, 1.0 - hash(k) * .5, 8.4); pxLine(g, a[0], a[1], b[0], b[1], ['#3a7ac8', '#e8c34a', '#d43a2a', '#9aa0a8'][k % 4]); }
    }
    if (rv === 1) for (const x of [.6, 1.3]) { const c = P(x, .5, 8.4); pxRect(g, c[0], c[1], 1, 3, '#3a5ac8'); }
    post(.3, 8.4, '#202024'); post(1.62, 8.4, '#202024');
    fillPoly(g, [P(X(.3, 3.07), 3.07, 8.4), P(X(1.7, 3.07), 3.07, 8.4), P(X(1.7, 3.15), 3.15, 8.4), P(X(.3, 3.15), 3.15, 8.4)], '#202024');
    for (const x of [.34, 1.66]) { const f = P(x, 0, 8.4); pxRect(g, f[0] - 2, f[1] - (rv === 3 && x < 1 ? 2 : 0), 5, 1, '#3a3a40'); }
    if (rv === 1) { const f = P(1, 0, 8.2); pxLine(g, f[0] - 8, f[1], f[0] + 6, f[1] + 1, 'rgba(220,220,214,0.5)'); }
  }

  /* ============================== THE CHECKLIST ==============================
     Same format as js/features.js (see its header comment). Variant order matters: the close-up art and the room
     view both draw by variant number. Costs are what the landlord would charge back for the repair or the
     restoration, which run higher than an apartment's. */
  const SHUT = { if: '!open', t: 'Open it first.' };
  const DOORS_SHUT = { if: '!open', t: 'Open the cabinet doors first.' };
  const FEATURES_O = [
    /* ---------------- LOBBY & RECEPTION ---------------- */
    { id: 'o_entry', room: 'o_lobby', name: 'Entry Doors & Lock', say: 'entry door', art: 'o_entry',
      hint: 'Work the lock from the inside, the way someone would in a fire. Then the closer, and the frame around the door.',
      osha: 'An exit door has to open from the inside, every time, without a key, a tool, or special knowledge (1910.36(d)(1)). Whoever swaps a lock cylinder here keeps that true, and keeps the route outside clear while they work (1910.37(a)(3)).',
      parts: [{ id: 'closer', name: 'door closer', r: [116, 4, 64, 16] }, { id: 'deadbolt', name: 'deadbolt', r: [189, 44, 18, 16] }, { id: 'lever', name: 'lever handle', r: [172, 64, 36, 16] },
        { id: 'frame', name: 'door frame and wall', r: [208, 0, 32, 124] }, { id: 'bottom', name: 'bottom of the door', r: [16, 104, 192, 22] }, { id: 'glass', name: 'door glass', r: [28, 18, 158, 88] }],
      base: { glass: { look: 'Through the glass: the building corridor, the door to Suite 205 across the hall, and SUITE 204 in white vinyl, backwards from in here.', touch: 'Cool glass. Fingerprints at exactly the height people push on it.', talk: 'You wave at the corridor. The corridor does not wave back.' },
        lever: { look: 'A satin-chrome lever. Commercial grade, the kind you can open with an elbow when your hands are full.', touch: 'You press the lever and pull. The latch retracts cleanly. Out you could go.' },
        bottom: { look: 'A bronze bottom rail and an aluminum threshold. A thin rubber sweep.', touch: 'The sweep is soft and intact.' },
        frame: { look: 'A bronze aluminum storefront frame, and plain wall beside it.', touch: 'Solid.' },
        closer: { look: 'A surface door closer with its arm up to the frame. It keeps the door from slamming and makes sure it shuts.' } },
      variants: [
        { cat: 0, desc: "The suite's glass entry door: a bronze frame, SUITE 204 in white letters on the glass (backwards, from in here).", key: ['lock'],
          resp: { deadbolt: { touch: [{ if: 'bolt', t: 'Clack. You turn the thumb-turn back and the bolt draws in.', toggle: 'bolt', sfx: 'click' }, { t: 'Clunk. The thumb-turn throws the deadbolt, and turns back just as easily. Locked from outside, and still one twist to get out from in here.', toggle: 'bolt', clue: 'lock', sfx: 'click' }], look: 'A thumb-turn deadbolt. A quarter turn, no key.' },
            closer: { touch: { t: 'You swing the door open and let go. The closer eases it shut, and the latch clicks home.', clue: 'lock', sfx: 'click' } } },
          why: 'It locks, closes, and opens from the inside without a key, which is what an exit door has to do (29 CFR 1910.36(d)(1)). Nothing to do.' },
        { cat: 1, desc: 'The door works, but the closer looks greasy.', key: ['closer'],
          resp: { closer: { look: { t: 'A dark film of hydraulic oil on the closer body, and a drip line down the rail. The seals are going.', clue: 'closer' }, touch: { t: 'You open the door and let go. It swings shut fast and slams, BANG. The closer has lost its fluid.', clue: 'closer', sfx: 'thud' }, smell: 'Machine oil.' },
            deadbolt: { touch: [{ if: 'bolt', t: 'Clack. The bolt draws in.', toggle: 'bolt', sfx: 'click' }, { t: 'Clunk. The deadbolt throws and turns back fine.', toggle: 'bolt', sfx: 'click' }] } },
          why: "A door closer that has leaked out its hydraulic fluid after years of use slams instead of easing shut. It wore out; nobody broke it. Normal wear: maintenance swaps the closer." },
        { cat: 2, cost: 450, desc: 'There are holes in the wall beside the door frame.', key: ['reader'],
          resp: { frame: { look: { t: "Where the tenant's card reader was: a pale square on the wall, four screw holes, a ragged hole with two cut low-voltage wires poking out, and another hole drilled right through the aluminum frame.", clue: 'reader' },
              touch: { t: 'Thin gray low-voltage cable, cut off flush. Twelve volts at most: not a hazard, just a hole.', clue: 'reader' }, tape: { t: 'The reader plate covered about 3 by 5 inches. The hole through the frame is 3/8 inch.', clue: 'reader' } },
            deadbolt: { touch: [{ if: 'bolt', t: 'Clack. The bolt draws in.', toggle: 'bolt', sfx: 'click' }, { t: 'Clunk. The lock itself is fine.', toggle: 'bolt', sfx: 'click' }] } },
          why: "The tenant added a card reader and took it out without restoring the wall or the frame. Unrestored alterations are the tenant's to fix under the lease: patch the wall, repair the frame, and charge it, with a photo." },
        { cat: 3, desc: 'The deadbolt looks fine at a glance.', key: ['keyed', 'trapped'],
          resp: { deadbolt: { look: { t: 'There is no thumb-turn. It is a key cylinder, on the inside. A double-cylinder deadbolt.', clue: 'keyed' }, touch: { t: "You try to turn it. It won't move without a key. Lock this from outside and anyone in here is locked in.", clue: 'trapped', sfx: 'click' },
              screwdriver: { t: 'Behind the trim, fresh scratches: somebody swapped the thumb-turn for a keyed cylinder, recently.', clue: 'keyed', sfx: 'unscrew' } },
            lever: { touch: { t: 'The lever works. But if the deadbolt is thrown, the lever is just a handle.', clue: 'trapped' } } },
          why: 'An exit door has to open from the inside without a key, a tool, or special knowledge (29 CFR 1910.36(d)(1)). A keyed deadbolt on the inside can trap people in a fire. Hazard: swap the cylinder back before anyone works in here.' }
      ] },
    { id: 'o_exitsign', room: 'o_lobby', name: 'EXIT Sign', art: 'o_exitsign',
      hint: 'Press the test button on an exit sign. It should stay lit on its battery.',
      osha: 'Every exit is marked by a lit EXIT sign, letters at least 6 inches high, lit to at least 5 foot-candles (1910.37(b)(2), (b)(6), and (b)(7)). Relamping it means a real ladder (1910.23) and the circuit off (1910.333(b)(2)).',
      parts: [{ id: 'test', name: 'test button', r: [156, 80, 14, 12] }, { id: 'led', name: 'charging light', r: [72, 80, 14, 12] }, { id: 'face', name: 'sign face', r: [72, 34, 96, 56] }, { id: 'housing', name: 'housing', r: [60, 16, 120, 86] }],
      base: { housing: { look: 'A white thermoplastic exit sign on a canopy, over the main door.', touch: 'You can just reach it on tiptoe. Solid on its mount.' }, led: { look: 'A tiny charging light for the backup battery.' } },
      variants: [
        { cat: 0, desc: 'A lit EXIT sign over the entry door.', key: ['lit'],
          resp: { test: { touch: { t: 'You hold TEST. The sign drops to its battery and stays bright. You let go; back on house power.', clue: 'lit', sfx: 'click', set: 'test' } },
            face: { look: { t: 'Bright, even red letters.', clue: 'lit' }, tape: { t: 'The letters are 6 inches tall: exactly the minimum (29 CFR 1910.37(b)(7)).', clue: 'lit' } }, led: { look: 'Green. The battery is charging.' } },
          why: 'Lit, readable, and it holds on battery power. Nothing to do.' },
        { cat: 1, desc: 'The EXIT sign is lit, but unevenly.', key: ['lamp'],
          resp: { face: { look: { t: 'The E and the X are dimmer than the I and the T. One of its two lamps is out; the other still lights the whole face.', clue: 'lamp' }, flashlight: 'Hard to tell with a flashlight. The difference is in the glow.' },
            test: { touch: { t: 'On battery, it stays lit, a little lopsided. The battery is fine; one lamp is just burned out.', clue: 'lamp', sfx: 'click', set: 'test' } }, led: { look: 'Green.' } },
          why: "One lamp burned out, but the sign is still lit and readable. Lamps burn out with time: normal wear. Relamp it at turnover (it has to stay lit, 29 CFR 1910.37(b)(6))." },
        { cat: 2, cost: 160, desc: "The sign's housing is cracked, and one corner is crushed.", key: ['crack'],
          resp: { housing: { look: { t: 'A crushed corner and cracks running across the housing. A ladder or a hand truck caught it on moving day.', clue: 'crack' }, touch: { t: 'The corner flexes, broken. The sign is still firm on its canopy.', clue: 'crack' } },
            test: { touch: { t: 'It stays lit on battery. Only the housing is broken.', clue: 'crack', sfx: 'click', set: 'test' } }, led: { look: 'Green.' } },
          why: 'Impact damage from moving out: the housing is crushed, but the sign still lights and tests fine. Tenant damage: replace the fixture and charge it, with a photo.' },
        { cat: 3, desc: 'The EXIT sign is dark.', key: ['dark', 'battery'],
          resp: { face: { look: { t: 'Dull red plastic letters. No glow at all.', clue: 'dark' } }, test: { touch: { t: 'You hold TEST. Nothing. Not even a flicker: the backup battery is dead too.', clue: 'battery', sfx: 'click' } },
            led: { look: { t: 'Off. No charging light, no house power.', clue: 'dark' } }, housing: { touch: 'Cold. It isn\'t doing anything.' } },
          why: 'Exit signs have to be lit and readable at all times (29 CFR 1910.37(b)(2) and (b)(6)). A dark sign with a dead battery means nobody finds this door in a power cut or a smoky hallway. Hazard: emergency work order.' }
      ] },
    { id: 'o_extinguisher', room: 'o_lobby', name: 'Fire Extinguisher', art: 'o_extinguisher',
      hint: 'Open the cabinet. Check the gauge, the pin, and the tag.',
      osha: 'Extinguishers stay mounted, easy to reach, and fully charged (1910.157(c)(1) and (c)(4)), with a look every month and a full service every year (1910.157(e)(2) and (e)(3)). The building owns this one; a used one gets swapped, not hung back.',
      parts: [{ id: 'gauge', name: 'pressure gauge', r: [125, 34, 12, 12] }, { id: 'pin', name: 'pin and tamper seal', r: [104, 30, 14, 10] }, { id: 'tag', name: 'inspection tag', r: [134, 42, 16, 24] },
        { id: 'hose', name: 'hose and nozzle', r: [92, 44, 14, 58] }, { id: 'cylinder', name: 'extinguisher', r: [104, 44, 32, 68] }, { id: 'door', name: 'cabinet door', r: [72, 10, 96, 116] }],
      base: { door: { touch: [{ if: 'open', t: 'You swing the cabinet door shut. Click.', toggle: 'open', sfx: 'click' }, { t: 'You pop the latch and swing the cabinet door open.', toggle: 'open', sfx: 'click' }], look: 'A semi-recessed steel cabinet with a clear window, FIRE EXTINGUISHER across the top.' },
        cylinder: { look: 'A 10-pound ABC dry-chemical extinguisher. Good for paper, grease, and electrical fires: an office\'s whole menu.', touch: [SHUT, { t: 'You lift it a little on its hook. Heavy, the way it should be.' }] },
        tag: { look: 'The inspection tag: an annual service date, and a grid of months somebody punches each time they check it.' } },
      variants: [
        { cat: 0, desc: 'A fire extinguisher in its wall cabinet by reception.', key: ['green'],
          resp: { gauge: { look: { t: 'The needle sits right in the green. Fully charged.', clue: 'green' } }, pin: { look: { t: 'The pin is in, and the yellow tamper seal is intact.', clue: 'green' } },
            tag: { look: { t: 'Serviced March 2008. Every month punched through September.', clue: 'green' } } },
          why: 'Mounted, easy to reach, fully charged, and inspected on schedule (29 CFR 1910.157(c)(1), (c)(4), and (e)). Nothing to do.' },
        { cat: 1, desc: "The cabinet's paint is chipped, and its window is hazy.", key: ['scuff'],
          resp: { door: { look: { t: 'Chipped paint along the trim, and the acrylic window has gone hazy and scratched. Years of lobby traffic and cleaning spray.', clue: 'scuff' }, touch: [{ if: 'open', t: 'You swing the cabinet door shut. Click.', toggle: 'open', sfx: 'click' }, { t: 'You pop the latch and open it. The hinge is fine.', toggle: 'open', clue: 'scuff', sfx: 'click' }] },
            gauge: { look: 'In the green.' }, tag: { look: 'Current. Punched through September.' } },
          why: "Chipped paint and a hazed-over window on a cabinet that has hung in a lobby for years is age and traffic. The extinguisher inside is charged and current. Normal wear." },
        { cat: 2, cost: 120, desc: "The cabinet's window is smashed.", key: ['glass'],
          resp: { door: { look: { t: 'Shards of acrylic left in the corners of the frame, and more in the bottom of the cabinet. This is a plain latch cabinet, not a break-glass one. Something hit it.', clue: 'glass' }, touch: [{ if: 'open', t: 'You ease the door shut. Shards rattle.', toggle: 'open', sfx: 'click' }, { t: 'You open the door carefully. A shard drops out.', toggle: 'open', clue: 'glass', sfx: 'click' }],
              tape: { t: 'The window opening is 8 by 20 inches. Nothing left in it but the corners.', clue: 'glass' } },
            gauge: { look: 'In the green. The extinguisher itself is fine.' }, tag: { look: 'Current.' } },
          why: 'A smashed cabinet window is not wear: something hit it, probably a dolly on moving day. The extinguisher inside is fine. Replace the window and charge it, with a photo.' },
        { cat: 3, desc: "The extinguisher's tag is still punched, but something about it looks off.", key: ['empty', 'pin'],
          resp: { gauge: { look: { t: 'The needle is down in the red. Empty.', clue: 'empty' } }, pin: { look: { t: 'No pin, no tamper seal. It has been used.', clue: 'pin' } },
            hose: { look: { t: 'White powder caked in the nozzle, and a dusting of it all over the bottom of the cabinet. Somebody fought a fire with this and hung it back up.', clue: 'empty' }, smell: 'Dry chemical: a dusty, faintly sour smell.' },
            cylinder: { touch: [SHUT, { t: 'You lift it. Way too light.', clue: 'empty' }] }, tag: { look: 'Punched through September. Whatever happened, happened after.' } },
          why: 'An extinguisher has to be fully charged and ready (29 CFR 1910.157(c)(4)). This one was used and hung back up empty, pin and seal gone. Hazard: swap it today, whoever used it.' }
      ] },
    { id: 'o_desk', room: 'o_lobby', name: 'Reception Desk', art: 'o_desk',
      hint: "The desk is the landlord's built-in. Check the ledge for wear, holes, and the corners for knocks.",
      parts: [{ id: 'corner', name: 'desk corner', r: [196, 40, 44, 56] }, { id: 'ledge', name: 'transaction ledge', r: [0, 28, 222, 26] }, { id: 'front', name: 'front panel', r: [0, 54, 222, 64] }, { id: 'kick', name: 'kick plate', r: [0, 118, 222, 17] }],
      base: { front: { look: 'Maple veneer panels with dark reveals. Very 2000.', touch: 'Smooth veneer.', hammer: 'Thock. Solid particleboard core.' }, kick: { look: 'A brushed steel kick plate, covered in shoe scuffs. That\'s its job.', touch: 'Cool steel.' }, corner: { look: 'The end of the desk, turning back toward the wall.' },
        ledge: { smell: 'Lemon furniture polish, and ten thousand sign-in sheets.', talk: '"Hi, I\'m here for my two o\'clock." Nobody is.' } },
      variants: [
        { cat: 0, desc: 'A built-in reception desk with a raised transaction ledge, maple below.', key: ['solid'],
          resp: { ledge: { look: 'Clean and intact.', touch: { t: 'Smooth, solid surface. No chips, no holes.', clue: 'solid' }, flashlight: { t: 'Raking light shows nothing but fine polish marks.', clue: 'solid' } }, corner: { touch: { t: 'Crisp edges. Not a ding.', clue: 'solid' } } },
          why: 'Clean and undamaged. Nothing to do.' },
        { cat: 1, desc: "The ledge's front edge has gone pale and dull.", key: ['worn'],
          resp: { ledge: { look: { t: 'The front edge is worn pale and the surface is fine-scratched where a thousand visitors leaned in to sign the clipboard.', clue: 'worn' }, touch: { t: 'Dull and smooth, but intact. Surface wear only.', clue: 'worn' } }, corner: { touch: 'Solid.' } },
          why: 'Worn finish where people lean and sign in every day is what a reception desk is for. Normal wear.' },
        { cat: 2, cost: 380, desc: 'There are two holes in the transaction ledge.', key: ['holes'],
          resp: { ledge: { look: { t: 'Two ragged holes cut straight through the ledge, no grommets, laminate chipped around both. Cable holes for a monitor and a phone.', clue: 'holes' }, tape: { t: 'Each hole is about 2 inches across, rough cut.', clue: 'holes' }, flashlight: { t: 'You can see down through them into the desk. Sawdust still in the bottom.', clue: 'holes' }, touch: { t: 'Sharp, chipped laminate around the edges.', clue: 'holes' } } },
          why: "The desk is the landlord's built-in millwork. The tenant cut cable holes through it without permission and didn't restore it. That's chargeable: refinish or replace the ledge, with a photo." },
        { cat: 2, cost: 290, desc: 'Something is wrong with the corner of the desk.', key: ['corner'],
          resp: { corner: { look: { t: 'The corner is smashed in: veneer and edge banding broken away, raw particleboard showing, a chunk of it on the floor.', clue: 'corner' }, touch: { t: 'Crumbly particleboard and sharp splinters of veneer.', clue: 'corner' }, tape: { t: 'The damage runs about 8 inches down the corner, the height of a loaded hand truck.', clue: 'corner' } } },
          why: 'A smashed corner is impact damage from moving furniture out, not wear. Repair the millwork and charge it, with a photo.' }
      ] },
    { id: 'o_logowall', room: 'o_lobby', name: 'Logo Wall', art: 'o_logowall',
      hint: "Where a tenant's sign came down, look closely at what it left behind. Size matters.",
      parts: [{ id: 'logo', name: 'where the sign was', r: [30, 20, 180, 84] }, { id: 'wall', name: 'logo wall', r: [0, 0, 240, 135] }],
      base: { wall: { look: 'The feature wall behind reception, painted an accent color for the logo.', touch: 'Eggshell paint over drywall.', smell: 'Nothing.' } },
      variants: [
        { cat: 0, desc: 'The wall behind reception, freshly painted.', key: ['paint'],
          resp: { logo: { look: 'Not a trace of a sign. The tenant had it patched and painted.', touch: { t: 'Smooth. The patches are sanded flush.', clue: 'paint' }, flashlight: { t: 'Even in raking light, nothing shows.', clue: 'paint' } } },
          why: "The tenant took their sign down and restored the wall, as the lease asks. Nothing to do." },
        { cat: 1, desc: 'A faint rectangle where the logo panel hung.', key: ['fade', 'small'],
          resp: { logo: { look: { t: 'A faint rectangle: the paint around it faded a shade; the paint behind the panel didn\'t. And a few tiny screw holes.', clue: 'fade' }, tape: { t: 'The screw holes are about 1/8 inch. Small stuff.', clue: 'small' }, touch: { t: 'Tiny, clean holes. No torn paper.', clue: 'small' } } },
          why: 'Paint that faded around a sign, and a few small screw holes, are ordinary wear for a wall that held a sign for years. Patch and paint at turnover.' },
        { cat: 2, cost: 340, desc: 'The logo is gone, and the wall behind it is torn up.', key: ['torn', 'glue'],
          resp: { logo: { look: { t: 'A row of letter-shaped scars: the drywall\'s paper face torn off down to brown paper, ridges of dried adhesive, and four ragged holes where the standoffs ripped out.', clue: 'torn' },
              touch: { t: 'Hard ridges of construction adhesive. These letters were glued on, then pried off.', clue: 'glue' }, tape: { t: 'Each scar is about 4 by 7 inches; the standoff holes are an inch across.', clue: 'torn' }, smell: 'Faint solvent, from the glue.' } },
          why: "The letters were glued on with construction adhesive and pried off, tearing the drywall's paper face. That means skim-coating and paint, well past wear. Chargeable, with a photo." },
        { cat: 2, cost: 260, desc: "The tenant's logo is still on the wall.", key: ['left'],
          resp: { logo: { look: { t: "SYNERGEX, in brushed aluminum letters on standoffs, with a teal swoosh and PAPER SOLUTIONS underneath. They left their sign.", clue: 'left' }, touch: { t: 'Each letter is bolted to the wall on little standoffs. It all has to come down.', clue: 'left' }, talk: 'You ask the logo where everybody went. It keeps smiling. Synergy.' } },
          why: "The lease says the tenant takes their signage down and restores the wall. They left it. Removal and patching get charged back, with a photo." }
      ] },
    { id: 'o_lobbyfloor', room: 'o_lobby', name: 'Entry Floor & Mat', say: 'entry floor', art: 'o_lobbyfloor', floor: true,
      hint: 'The main exit has to be safe to walk through. Check the mat edges and the tile around it.',
      osha: 'Walking surfaces are kept free of trip hazards (1910.22(a)(3)) and as dry as practical (1910.22(a)(2)), and an exit route has to stay clear all the way out (1910.37(a)(3)).',
      parts: [{ id: 'corner', name: 'mat corner', r: [40, 10, 48, 52] }, { id: 'threshold', name: 'threshold', r: [0, 0, 240, 16] }, { id: 'mat', name: 'walk-off mat', r: [44, 24, 152, 88] }, { id: 'tile', name: 'tile floor', r: [0, 0, 240, 135] }],
      base: { threshold: { look: 'An aluminum threshold under the door, ribbed for grip.' }, tile: { look: 'Large porcelain tiles, gray grout.', smell: 'Floor cleaner, faintly.' }, mat: { look: 'A charcoal walk-off mat with a rubber border.' } },
      variants: [
        { cat: 0, desc: 'Porcelain tile, and a walk-off mat lying flat inside the door.', key: ['flat'],
          resp: { mat: { touch: { t: 'It lies flat, beveled edges all the way around.', clue: 'flat' } }, corner: { touch: { t: 'Flat. It doesn\'t catch a toe.', clue: 'flat' } }, tile: { touch: { t: 'Dry and solid.', clue: 'flat' }, hammer: { t: 'Tap, tap. No hollow tiles.', clue: 'flat', sfx: 'thud' } } },
          why: 'Flat, dry, and clean, right at the main exit. Nothing to do.' },
        { cat: 1, desc: 'The mat is worn down the middle, and the tile has a dull path.', key: ['worn'],
          resp: { mat: { look: { t: 'Eight years of shoes: the middle is crushed flat and gray, the ribs worn smooth. Still flat at the edges.', clue: 'worn' }, touch: { t: 'Thin in the middle, but no curl.', clue: 'worn' } }, tile: { look: { t: 'A dull traffic path in the tile finish beyond the mat.', clue: 'worn' } } },
          why: 'A walk-off mat worn thin, and a dull path in the tile, are years of people coming and going. Normal wear.' },
        { cat: 2, cost: 210, desc: 'A floor tile beside the mat is cracked.', key: ['crack'],
          resp: { tile: { look: { t: 'A star of cracks out of a single impact point. Something heavy was dropped here.', clue: 'crack' }, hammer: { t: 'Tap. Still solid underneath, and flat. Not a trip hazard, just broken.', clue: 'crack', sfx: 'thud' }, tape: { t: 'The cracks run about 9 inches across the tile.', clue: 'crack' }, touch: 'Flush, no sharp lip.' } },
          why: "A single tile cracked from an impact point, still solid and flat: something heavy hit it on moving day. Replace the tile and charge it, with a photo." },
        { cat: 3, desc: 'One corner of the mat is up off the floor.', key: ['curl'],
          resp: { corner: { look: { t: 'The corner has curled up a good two inches, and the backing is torn.', clue: 'curl' }, touch: { t: 'You press it down. It springs right back up. It would catch anybody coming through the door.', clue: 'curl' }, tape: { t: 'The corner stands 2 inches proud of the floor.', clue: 'curl' } } },
          why: 'A curled, torn mat corner at the main door is a trip hazard (29 CFR 1910.22(a)(3)), right in the exit route. Hazard: pull the mat today.' }
      ] },
    /* ---------------- OPEN OFFICE ---------------- */
    { id: 'o_carpet', room: 'o_open', name: 'Carpet Tile', art: 'o_carpet', floor: true,
      hint: 'Carpet tile shows where the desks and chairs were. Feel it, smell it, and check the seams.',
      osha: 'Lifted or curled carpet in an aisle is a trip hazard and gets fixed or guarded before anyone works here (1910.22(a)(3)); the aisles are exit routes, too (1910.37(a)(3)).',
      parts: [{ id: 'seam', name: 'tile seams', r: [76, 36, 88, 48] }, { id: 'lane', name: 'aisle', r: [0, 96, 240, 39] }, { id: 'field', name: 'carpet', r: [0, 0, 240, 96] }],
      base: { field: { look: 'Gray-blue carpet tile, two feet square, laid quarter-turned so the seams disappear.', smell: 'Carpet, and the ghost of eight years of microwave popcorn.' }, '*': { talk: 'You compliment the carpet tile. It remains commercial grade.' } },
      variants: [
        { cat: 0, desc: 'Carpet tile, freshly vacuumed.', key: ['clean'],
          resp: { field: { touch: { t: 'Dense and springy. Clean.', clue: 'clean' }, flashlight: { t: 'Raking light: an even pile, no stains.', clue: 'clean' } }, seam: { touch: { t: 'Tight, flat seams.', clue: 'clean' } }, lane: { look: 'The aisle looks the same as everywhere else.' } },
          why: 'Clean and flat. Nothing to do.' },
        { cat: 1, desc: 'A flattened lane runs down the aisle, and there\'s a fuzzy patch near a desk spot.', key: ['lane', 'caster'],
          resp: { lane: { look: { t: 'A matted, grayer lane down the aisle, exactly where everybody walked to the coffee.', clue: 'lane' }, touch: { t: 'Crushed pile, but intact. Not sticky, not loose.', clue: 'lane' }, tape: { t: 'The worn lane is about 30 inches wide, the width of the aisle.', clue: 'lane' } },
            field: { look: { t: 'A round, fuzzy, pilled patch where a desk chair rolled back and forth for years.', clue: 'caster' }, touch: { t: 'Fuzzy and a little thin. Caster wear, from a chair with no chair mat.', clue: 'caster' } } },
          why: 'Traffic lanes and chair-caster wear are what eight years of an office do to carpet tile. Normal wear: carpet ages with use.' },
        { cat: 2, cost: 260, desc: 'A big black smudge in the carpet, near where the printer stood.', key: ['toner'],
          resp: { field: { look: { t: 'A black splotch with gray smears around it, like someone tried to wipe it up.', clue: 'toner' }, touch: { t: 'Your fingertip comes away black and powdery. Toner.', clue: 'toner' }, smell: { t: 'Hot plastic and printer. Definitely toner.', clue: 'toner' },
              flashlight: { t: 'Water rings around the edge. Someone tried to clean toner with water, which sets it for good.', clue: 'toner' }, tape: 'The stain runs about 20 inches, across two tiles.' } },
          why: 'Spilled toner, ground in and then set with water, is a permanent stain. That is an accident, not wear: replace the tiles and charge them, with a photo.' },
        { cat: 3, desc: 'Some of the carpet tiles in the aisle look puffy.', key: ['trip'],
          resp: { seam: { look: { t: 'Three tiles have come unglued and buckled where the cubicle panels were wrenched off them. Their edges stand up.', clue: 'trip' }, touch: { t: 'You press one down. It pops right back up. A toe would catch it.', clue: 'trip' }, tape: { t: 'The edges sit about an inch proud of the floor.', clue: 'trip' } } },
          why: 'Buckled tiles standing an inch up in the aisle are a trip hazard (29 CFR 1910.22(a)(3)), in the path to the exit. Hazard: fix them before anyone works here.' }
      ] },
    { id: 'o_ceiling', room: 'o_open', name: 'Ceiling Tiles', art: 'o_ceiling',
      hint: 'Look up. Stains, sags, and gaps in a drop ceiling are all telling you something different.',
      osha: 'Whoever swaps ceiling tiles uses a real stepladder, never a rolling chair or the top step (1910.23). A wet tile is heavy: pull it before it drops on someone.',
      parts: [{ id: 'tile', name: 'ceiling tile', r: [85, 32, 70, 70] }, { id: 'grid', name: 'drop ceiling', r: [0, 0, 240, 135] }],
      base: { grid: { look: 'Two-by-two acoustic tiles on a white T-bar grid. The ceiling of every office you have ever been in.', touch: 'Out of reach without a ladder.' }, tile: { touch: 'You can just touch it with your clipboard.' } },
      variants: [
        { cat: 0, desc: 'A clean drop ceiling.', key: ['dry'],
          resp: { tile: { look: { t: 'Even, white, and seated flat in the grid.', clue: 'dry' }, flashlight: { t: 'No stains, no gaps. Dry.', clue: 'dry' } } },
          why: 'Clean, dry, and complete. Nothing to do.' },
        { cat: 1, desc: 'A few tiles have gone yellowish, and they sag a little.', key: ['sag'],
          resp: { tile: { look: { t: 'Yellowed and drooping slightly in the middle, the way old mineral-fiber tile does after years of humid summers.', clue: 'sag' }, touch: { t: 'Dry and firm. Just old.', clue: 'sag' }, smell: 'Dust. No must, no damp.' } },
          why: 'Old tiles yellow and droop a little with age and humidity. They are dry and sound. Normal wear: swap them at the next build-out.' },
        { cat: 2, cost: 140, desc: 'There\'s a gap in the ceiling grid.', key: ['broken'],
          resp: { tile: { look: { t: 'This tile is cracked across, and the one beside it is gone: a black hole into the plenum, with fresh data cable hanging in it.', clue: 'broken' }, flashlight: { t: 'Up in the hole: ductwork, and cables the tenant\'s contractor pulled. Broken tile edges where they shoved through.', clue: 'broken' } },
            grid: { look: { t: 'One empty square in the grid. Someone never put the tile back.', clue: 'broken' } } },
          why: "The tenant's cabling contractor cracked tiles and left one out. That is damage from their work, not age: replace them and charge it, with a photo." },
        { cat: 3, desc: 'There\'s a brown stain on a ceiling tile.', key: ['wet', 'drip'],
          resp: { tile: { look: { t: 'A brown stain with darker rings, and the tile is bellied down in the middle.', clue: 'wet' }, touch: { t: 'You poke it with the clipboard. Soggy, and cold. Water above.', clue: 'wet' }, smell: { t: 'Musty.', clue: 'wet' }, flashlight: { t: 'A drop gathers in the middle of the stain and falls. Drip. Drip.', clue: 'drip', sfx: 'drip' } } },
          why: 'A wet, sagging tile with a spreading stain means an active leak above, and a soaked tile can drop on someone. Hazard: emergency work order to find the leak, and pull the tile before it falls.' }
      ] },
    { id: 'o_troffer', room: 'o_open', name: 'Light Fixture', art: 'o_troffer',
      hint: 'Turn the lights on and look up at the fixture: the tubes, the lens, and how it sits in the grid.',
      osha: 'Before anyone relamps or re-hangs a fixture: the breaker locked off and tested dead (1910.333(b)(2)), and a stepladder, not a desk (1910.23). Fixtures fasten to the ceiling grid mechanically (NEC 410.36(B)).',
      parts: [{ id: 'whip', name: 'power whip', r: [176, 0, 48, 40] }, { id: 'lens', name: 'lens', r: [42, 26, 156, 84] }, { id: 'frame', name: 'fixture frame', r: [30, 14, 180, 108] }],
      base: { frame: { look: 'A 2-by-4 fluorescent troffer, three T8 tubes behind a prismatic lens.', touch: 'Out of reach, and warm anyway.' }, whip: { look: 'Where the fixture\'s flexible power whip runs up into the ceiling.', touch: 'Out of reach.' }, lens: { smell: 'Warm dust. Fluorescent lights have a smell. This is it.' } },
      variants: [
        { cat: 0, desc: 'A fluorescent light fixture in the ceiling grid.', key: ['bright'],
          resp: { lens: { look: { t: 'Three bright tubes behind a clean lens. Even light.', clue: 'bright' } }, frame: { flashlight: { t: 'Seated square in the grid, clips engaged.', clue: 'bright' } } },
          why: 'Lit, clean, and secure. Nothing to do.' },
        { cat: 1, desc: 'One tube in the fixture is dark.', key: ['tube'],
          resp: { lens: { look: { t: 'The middle tube is out, and the ends of the other two have gone gray-black. Old tubes, at the end of their life.', clue: 'tube' }, flashlight: 'The dead tube is seated fine. It just burned out.' }, frame: { look: { t: 'Seated square in the grid.', clue: 'tube' } } },
          why: 'Fluorescent tubes burn out and blacken at the ends on their own. Relamping is routine maintenance. Normal wear.' },
        { cat: 2, cost: 85, desc: "The fixture's lens is cracked.", key: ['lens'],
          resp: { lens: { look: { t: 'A crack across the lens, and a corner broken clean out. A ladder top, or a cable pull, hit it.', clue: 'lens' }, flashlight: { t: 'Through the missing corner: bare tube ends and the fixture\'s white reflector.', clue: 'lens' } } },
          why: "A cracked, broken-out lens is impact damage from the tenant's contractors, not age. Replace the lens and charge it, with a photo." },
        { cat: 3, desc: 'One end of the fixture is hanging below the ceiling.', key: ['drop', 'whip'],
          resp: { frame: { look: { t: 'One end has dropped out of the grid and hangs a foot and a half down. Forty pounds of steel, held up by one end and its wires.', clue: 'drop' }, flashlight: { t: 'No tie wires, no clips at the low end. Somebody popped it out to run cable and never put it back.', clue: 'drop' } },
            whip: { look: { t: 'The flexible power whip is taking the weight. It is not meant to.', clue: 'whip' } }, lens: { look: 'It buzzes, and flickers now and then.' } },
          why: 'A light fixture hanging out of the grid by its power whip can fall on a desk or a head. Fixtures in a drop ceiling have to be fastened to the grid (NEC 410.36(B)). Hazard: kill the circuit and get it re-secured today.' }
      ] },
    { id: 'o_window', room: 'o_open', name: 'Windows & Blinds', art: 'o_window',
      hint: 'Look at the blinds and the glass. Cracked glass high up is never just cosmetic.',
      parts: [{ id: 'wand', name: 'blind wand', r: [206, 8, 12, 56] }, { id: 'blinds', name: 'mini-blinds', r: [22, 4, 184, 52] }, { id: 'glass', name: 'window glass', r: [22, 56, 196, 56] }, { id: 'sill', name: 'window sill', r: [0, 114, 240, 21] }],
      base: { glass: { look: 'Second floor, over the parking lot, and the office park across the way.', talk: 'You wave at the building across the street. Nobody over there waves back. Nobody over there ever waves back.', touch: 'Cool, double-glazed.' },
        sill: { look: 'A deep laminate sill. Every office plant in the building once lived on one of these.', touch: 'Dusty, and a little sticky where a plant leaked.' }, wand: { touch: 'You twist the wand. The slats tilt shut, then open again. Satisfying.' } },
      variants: [
        { cat: 0, desc: 'A ribbon of windows with aluminum mini-blinds.', key: ['clear'],
          resp: { glass: { look: { t: 'Clear glass, clean frames. The parking lot, the office park, a tree being a tree.', clue: 'clear' } }, blinds: { look: { t: 'Every slat straight and present.', clue: 'clear' }, touch: 'They clatter politely.' } },
          why: 'Clean glass, straight blinds. Nothing to do.' },
        { cat: 1, desc: 'The blinds are faded, with a few kinked slats.', key: ['kink'],
          resp: { blinds: { look: { t: 'Faded slats, and a few kinked where somebody bent them down to see out. Every day. For eight years.', clue: 'kink' }, touch: { t: 'You try to straighten a kink. It stays kinked.', clue: 'kink' } } },
          why: 'Kinked, faded slats on cheap mini-blinds are years of being pulled aside to check the weather. Normal wear.' },
        { cat: 2, cost: 95, desc: 'There\'s a gap in the blinds.', key: ['snapped'],
          resp: { blinds: { look: { t: 'A section of slats is snapped off and hanging at angles, and a couple are lying on the sill. Something tore through them.', clue: 'snapped' }, tape: { t: 'The torn section is about 16 inches wide.', clue: 'snapped' } }, sill: { look: { t: 'Two broken slats on the sill.', clue: 'snapped' } } },
          why: 'Snapped and missing slats are breakage, not age. Replace the blind and charge it, with a photo.' },
        { cat: 3, desc: 'A line runs across one of the windows.', key: ['crack'],
          resp: { glass: { look: { t: 'A long crack across the pane, from the bottom corner up toward the top. Second floor, over the sidewalk.', clue: 'crack' }, touch: { t: 'You can feel it with a fingernail: the inner pane is cracked through.', clue: 'crack' }, tape: { t: 'The crack runs about 5 feet.', clue: 'crack' }, hammer: 'Absolutely not.' } },
          why: 'A cracked window can let go and drop glass on whoever is below. Hazard, however it happened: tape it, keep people back from below, and call the glazier today.' }
      ] },
    { id: 'o_floorbox', room: 'o_open', name: 'Floor Box', art: 'o_floorbox',
      hint: 'Floor boxes fed the cubicles. Open the lid and see what the tenant left in there.',
      osha: 'Live parts at 50 volts or more stay guarded, and boxes keep their covers on (1910.303(g)(2) and 1910.305(b)(2)). Capping these means the breaker locked off and the wires tested dead first (1910.333(b)(2)).',
      parts: [{ id: 'lid', name: 'floor box', r: [76, 36, 88, 64] }, { id: 'carpet', name: 'carpet around it', r: [0, 0, 240, 135] }],
      base: { carpet: { look: 'Carpet tile, cut neatly around the floor box.' }, lid: { look: 'A flush floor box: a brass flange, and two flip lids where the cubicle power and data came up.' } },
      variants: [
        { cat: 0, desc: 'A flush floor box in the carpet, lids closed.', key: ['capped'],
          resp: { lid: { touch: { t: 'You flip a lid up: empty, the power properly capped off inside a closed box, the data cables pulled. You flip it shut.', clue: 'capped', sfx: 'click' }, flashlight: { t: 'Blank covers, wire nuts on everything. Done right.', clue: 'capped' } } },
          why: 'The cubicle feeds were removed and the box was left closed and safe. Nothing to do.' },
        { cat: 1, desc: 'The floor box cover is scuffed bare.', key: ['scuff'],
          resp: { lid: { look: { t: 'The finish is worn off the lids and the flange is scratched, from eight years of chair wheels and feet.', clue: 'scuff' }, touch: { t: 'Flat and closed. Inside, everything is capped.', clue: 'scuff', sfx: 'click' } }, carpet: { look: 'The carpet around it is matted too.' } },
          why: 'A scuffed floor box cover in a busy aisle is everyday wear. Normal wear.' },
        { cat: 2, cost: 320, desc: 'A bundle of cut cables spills out of the floor box.', key: ['cable'],
          resp: { lid: { look: { t: 'A fat bundle of gray data cable, cut off at the box and left coiled across the carpet, the little colored pairs showing at the ends.', clue: 'cable' }, touch: { t: 'Cat 5 network cable. Low voltage, no hazard: just abandoned.', clue: 'cable' }, tape: { t: 'The coil runs about four feet out into the aisle.', clue: 'cable' } } },
          why: "The lease makes the tenant remove their data cabling when they leave. They cut it off and left it coiled in the box and the aisle. Removal is charged back, with a photo." },
        { cat: 3, desc: 'The floor box lid is open, and wires stick out of it.', key: ['live', 'bare'],
          resp: { lid: { look: { t: 'Three wires, black, white, and green, cut off and sticking up. No wire nuts. Bare copper at the ends.', clue: 'bare' }, flashlight: { t: 'Bare copper on the black and the white. The cubicle installers cut the power whip and never capped it.', clue: 'bare' },
              touch: { t: 'You hold your pocket voltage tester near the black wire (never your fingers). It chirps. It\'s live.', clue: 'live', sfx: 'beep' }, screwdriver: 'Not near live wires. Not today, not ever.' } },
          why: 'Cut-off power conductors with bare ends in an open floor box are a shock hazard, right where someone will step or vacuum. Live parts stay guarded and boxes keep their covers on (29 CFR 1910.303(g)(2) and 1910.305(b)(2)). Hazard: kill the circuit, cap it, and close the box.' }
      ] },
    { id: 'o_wall', room: 'o_open', name: 'Partition Wall', art: 'o_wall',
      hint: 'Long office walls collect chair scuffs and whiteboards. Does it wipe off? How big are the holes?',
      parts: [{ id: 'outlet', name: 'outlet', r: [186, 96, 20, 22] }, { id: 'base', name: 'cove base', r: [0, 122, 240, 13] }, { id: 'wall', name: 'wall', r: [0, 0, 240, 122] }],
      base: { outlet: { look: 'A duplex outlet.', touch: 'Cool, with a tight grip.' }, base: { look: 'Black rubber cove base.', touch: 'Glued tight.' } },
      variants: [
        { cat: 0, desc: 'A long partition wall, clean.', key: ['clean'],
          resp: { wall: { touch: { t: 'Smooth. Freshly wiped.', clue: 'clean' }, flashlight: { t: 'No marks in raking light.', clue: 'clean' } } },
          why: 'Clean and undamaged. Nothing to do.' },
        { cat: 1, desc: 'Gray scuffs along the wall, and a scatter of little holes.', key: ['scuff', 'small'],
          resp: { wall: { look: { t: 'Gray scuffs at chair-back height, all along the wall, and thumbtack holes up higher.', clue: 'scuff' }, touch: { t: 'The scuffs half wipe off with your thumb.', clue: 'scuff' }, tape: { t: 'The scuffs sit about 30 inches up: chair backs. The holes are all under 1/8 inch.', clue: 'small' } } },
          why: 'Chair-back scuffs and thumbtack holes are what a busy office does to a wall. Normal wear: touch up at turnover.' },
        { cat: 2, cost: 180, desc: 'Somebody wrote all over the wall.', key: ['marker'],
          resp: { wall: { look: { t: "A flow chart, in marker, right on the paint: SYNERGY, arrow, LEVERAGE, arrow, PROFIT. And GO TEAM! underneath. The whiteboard was already gone. Somebody didn't notice.", clue: 'marker' },
              touch: { t: "You rub a letter. Nothing. Permanent marker, not dry-erase.", clue: 'marker' }, smell: { t: 'Faint marker fumes.', clue: 'marker' }, talk: 'You ask the chart what comes after PROFIT. It doesn\'t say. Nobody ever does.' } },
          why: 'Permanent marker on painted drywall needs primer and paint. That is beyond normal use, so it gets charged, with a photo.' },
        { cat: 2, cost: 220, desc: 'There are holes in the wall where a whiteboard hung.', key: ['torn'],
          resp: { wall: { look: { t: "Four ragged holes where a big whiteboard was wrenched off its anchors, torn paper around each, and a cleaner rectangle where it hung.", clue: 'torn' }, tape: { t: 'Each hole is about an inch and a half across, way past 1/4 inch.', clue: 'torn' }, touch: { t: 'Crumbly gypsum, and one plastic anchor still hanging in a hole.', clue: 'torn' } } },
          why: 'Holes bigger than 1/4 inch with torn drywall are damage: the board was yanked off, not taken down. Patch, paint, and charge it, with a photo.' }
      ] },
    /* ---------------- BREAK ROOM ---------------- */
    { id: 'o_sink', room: 'o_break', name: 'Sink & Cabinet', art: 'o_sink',
      hint: 'Open the cabinet under the sink and get a light (and your nose) in there.',
      osha: "Janitorial chemicals live in labeled containers with a Safety Data Sheet on file (1910.1200(f)(6) and (g)(8)). Never bleach with ammonia: together they make chloramine gas. Whoever clears these out ventilates first.",
      parts: [{ id: 'faucet', name: 'faucet', r: [96, 2, 48, 26] }, { id: 'basin', name: 'sink basin', r: [66, 28, 110, 34] }, { id: 'cabinet', name: 'cabinet under the sink', r: [26, 68, 188, 67] }],
      base: { cabinet: { touch: [{ if: 'open', t: 'You close the cabinet doors.', toggle: 'open', sfx: 'click' }, { t: 'You open the cabinet doors.', toggle: 'open', sfx: 'click' }], look: [{ if: 'open', t: 'Pipes, shut-off valves, and a lot of shadow. Try the flashlight.' }, { t: 'Two laminate doors with wire pulls.' }], smell: 'Old coffee grounds.' },
        basin: { look: 'A single stainless basin, a coffee-stained drain, and the ghost of a thousand rinsed mugs.' },
        faucet: { look: 'A chrome single-lever gooseneck faucet.', touch: 'You lift the lever. Water runs hot after a few seconds. You shut it off.' } },
      variants: [
        { cat: 0, desc: 'A stainless break room sink, laminate cabinet below. Clean and dry.', key: ['dry'],
          resp: { cabinet: { flashlight: [DOORS_SHUT, { t: 'Dry, clean, nothing left behind. Tight fittings.', clue: 'dry', sfx: 'light' }] }, basin: { touch: { t: 'Dry and clean.', clue: 'dry' }, smell: 'Lemon dish soap.' } },
          why: 'Clean, dry, and working. Nothing to do.' },
        { cat: 1, desc: 'White crust rings the base of the faucet.', key: ['scale'],
          resp: { faucet: { look: { t: 'Hard-water scale around the base and the aerator. Years of filling the coffee pot.', clue: 'scale' }, touch: { t: 'Chalky and rough, but it runs fine.', clue: 'scale' } }, cabinet: { flashlight: [DOORS_SHUT, { t: 'Dry under here.' }] } },
          why: 'Mineral buildup from years of hard water is normal wear. A cleaning item, not a charge.' },
        { cat: 2, cost: 240, desc: 'A little chrome tap stands on the counter beside the faucet.', key: ['saddle', 'hole'],
          resp: { cabinet: { flashlight: [DOORS_SHUT, { t: "Under there: an instant-hot water tank, and a saddle valve clamped onto the cold supply line with a little copper tube running to it. A tenant install.", clue: 'saddle', sfx: 'light' }], look: [{ if: 'open', t: 'A black tank labeled HOT, plugged in, and a little copper line.' }, { t: 'Two laminate doors with wire pulls.' }] },
            basin: { look: 'A single stainless basin.' } },
          why: "The tenant plumbed in an instant-hot tap: a hole drilled in the counter, and a saddle valve clamped onto the supply line (saddle valves are famous for leaking). It's their alteration, never restored. Removal and repair are charged back, with a photo." },
        { cat: 3, desc: 'The cabinet doors are swollen at the bottom.', key: ['leak', 'wet'],
          resp: { cabinet: { touch: [{ if: 'open', t: 'You press the cabinet floor: soaked and spongy. You close the doors.', toggle: 'open', clue: 'wet', sfx: 'click' }, { t: 'The doors stick, then pop open. The cabinet floor is soaked.', toggle: 'open', clue: 'wet', sfx: 'click' }],
              flashlight: [DOORS_SHUT, { t: 'The cold supply line is weeping at its compression nut. Drip... drip...', clue: 'leak', sfx: 'drip' }], smell: { t: 'Mildew. Strong.', clue: 'wet' } } },
          why: 'An active leak under the sink is a maintenance hazard: water damage and mold get worse every hour. Emergency work order.' },
        { cat: 3, desc: 'There\'s a sharp smell near the sink.', key: ['fumes', 'mixed'],
          resp: { cabinet: { smell: { t: 'Chlorine and ammonia at once. Your eyes water. You back off fast.', clue: 'fumes' }, flashlight: [DOORS_SHUT, { t: 'A jug of bleach and an unlabeled spray bottle of ammonia cleaner, both leaking into the same puddle.', clue: 'mixed', sfx: 'light' }],
              look: [{ if: 'open', t: 'Abandoned janitorial bottles in a puddle, and a haze you can almost see.', clue: 'mixed' }, { t: 'Two laminate doors with wire pulls. The smell is coming from behind them.' }] } },
          why: 'Bleach and ammonia leaking together give off chloramine gas. Hazard: air the room out, keep people out, and have the bottles removed. Abandoned, unlabeled chemicals have no place in a workplace (29 CFR 1910.1200).' }
      ] },
    { id: 'o_gfci', room: 'o_break', name: 'Counter Outlet', art: 'o_gfci',
      hint: 'An outlet by a sink has to be a working GFCI. Press TEST, and sniff it.',
      osha: 'Electrical equipment has to be free of hazards (1910.303(b)(1)); a scorched outlet comes out of service. Replacing it: breaker off, locked, and tested dead first (1910.333(b)(2)). The GFCI by the sink itself is the electrical code (NEC 210.8(B)).',
      parts: [{ id: 'test', name: 'TEST button', r: [98, 42, 44, 11] }, { id: 'reset', name: 'RESET button', r: [98, 53, 44, 11] }, { id: 'plate', name: 'cover plate', r: [64, 6, 112, 92] }],
      base: { reset: { touch: { t: 'Click. Nothing to reset.', sfx: 'click' } }, plate: { look: 'A GFCI outlet above the backsplash, between the sink and the microwave.' } },
      variants: [
        { cat: 0, desc: 'A GFCI outlet on the backsplash.', key: ['trip'],
          resp: { test: { touch: { t: 'Click. It trips, and the green light goes out. RESET, and it comes back. Working.', clue: 'trip', sfx: 'click' } }, plate: { touch: 'Cool.', smell: 'Nothing. Good.' } },
          why: 'It trips and resets, the way a GFCI by a sink should (NEC 210.8(B)). Nothing to do.' },
        { cat: 1, desc: 'The outlet plate has gone yellow.', key: ['yellow'],
          resp: { plate: { look: { t: 'Old-almond yellow, from years next to the coffee maker.', clue: 'yellow' }, touch: 'Cool.' }, test: { touch: { t: 'Click, it trips. Reset, and it works.', clue: 'yellow', sfx: 'click' } } },
          why: 'Plastic yellowing with age is normal wear. It works and tests fine.' },
        { cat: 2, cost: 25, desc: 'The outlet plate is cracked, with a piece missing.', key: ['plate'],
          resp: { plate: { look: { t: 'A corner of the plate is snapped off. A yanked coffee maker cord, probably.', clue: 'plate' }, touch: { t: 'Cool. Only the plastic is broken; the device is fine.', clue: 'plate' } }, test: { touch: { t: 'Click, it trips. Reset, it works.', clue: 'plate', sfx: 'click' } } },
          why: "A broken plate is minor tenant damage. The outlet itself tests fine, so it isn't a hazard. Replace the plate and charge it, with a photo." },
        { cat: 3, desc: 'Brown marks around the plug slots.', key: ['warm', 'burn'],
          resp: { plate: { touch: { t: 'Warm, with nothing plugged in. A faint buzz from inside.', clue: 'warm', sfx: 'buzz' }, smell: { t: 'Burnt plastic.', clue: 'burn' }, look: { t: 'Scorch marks fanning out of the slots. Something drew a lot of current here for a long time. A space heater and a coffee maker, maybe.', clue: 'burn' } },
            test: { touch: { t: "Click. Nothing. It won't trip. It isn't protecting anything.", clue: 'warm', sfx: 'click' } } },
          why: "Heat, scorching, and a GFCI that won't trip, next to a sink: a fire and shock hazard (29 CFR 1910.303(b)(1)). Kill the breaker and get an electrician." }
      ] },
    { id: 'o_fridge', room: 'o_break', name: 'Refrigerator', art: 'o_fridge',
      hint: 'Open the fridge. Feel how cold it is, smell it, and look underneath.',
      parts: [{ id: 'handle', name: 'door handle', r: [64, 48, 12, 48] }, { id: 'gasket', name: 'door seal', r: [168, 44, 12, 78] }, { id: 'freezer', name: 'freezer', r: [62, 2, 116, 40] }, { id: 'inside', name: 'inside the fridge', r: [80, 46, 88, 74] }, { id: 'floor', name: 'floor in front', r: [0, 124, 240, 11] }],
      base: { handle: { touch: [{ if: 'open', t: 'You shut the door. Fwump.', toggle: 'open', sfx: 'thud' }, { t: 'The door opens with a soft fwump and the light comes on.', toggle: 'open', sfx: 'swish' }], look: 'A long white plastic handle.' },
        inside: { look: [SHUT, { t: 'Two glass shelves and a crisper.' }], touch: [SHUT, { t: 'Cold shelves.' }], smell: [SHUT, { t: 'Cold, faintly of baking soda.' }] },
        freezer: { look: 'The freezer on top.', touch: 'Cold through the door.' }, floor: { look: 'The tile in front of the fridge.' }, gasket: { look: 'The rubber door seal.' } },
      variants: [
        { cat: 0, desc: 'A white top-freezer fridge, wiped down and empty.', key: ['cold'],
          resp: { inside: { touch: [SHUT, { t: 'Cold, dry, and clean. 38 degrees on the dial.', clue: 'cold' }], look: [SHUT, { t: 'Empty and clean. Somebody even left a box of baking soda.', clue: 'cold' }] }, gasket: { touch: 'Soft and grippy all the way around.' } },
          why: 'Cold, clean, empty, and sealing. Nothing to do.' },
        { cat: 1, desc: "The fridge door doesn't quite seal at the bottom corner.", key: ['gasket'],
          resp: { gasket: { look: { t: 'The gasket is cracked at the bottom corner and stiff with age.', clue: 'gasket' }, touch: { t: 'Hard, split rubber. Old, not abused.', clue: 'gasket' }, flashlight: { t: 'Light leaks through the split.', clue: 'gasket' } }, inside: { touch: [SHUT, { t: 'Cold enough.' }] } },
          why: 'Door gaskets harden and crack over the years. Normal wear: replace at turnover.' },
        { cat: 2, cost: 75, desc: 'Something smells sour near the fridge.', key: ['food', 'mold'],
          resp: { inside: { look: [SHUT, { t: "Full. Abandoned lunches in stacked containers, a carton of milk from August, a takeout box, and one container labeled GARY in marker.", clue: 'food' }], smell: [SHUT, { t: 'Sour milk and something worse. You close your eyes, which does not help.', clue: 'food' }],
              flashlight: [SHUT, { t: 'Green and white fuzz in three of the containers. Mold, well established.', clue: 'mold', sfx: 'light' }], touch: [SHUT, { t: 'Cold. The fridge works fine; the food does not.', clue: 'food' }] } },
          why: "The lease says the space comes back broom-clean with the tenant's things gone. A fridge full of abandoned, moldy lunches is a cleanout the landlord now pays for, so it is charged back, with a photo." },
        { cat: 3, desc: 'There is a puddle at the base of the fridge.', key: ['warm', 'leak'],
          resp: { inside: { touch: [SHUT, { t: "It's barely cool. The compressor isn't running.", clue: 'warm' }], smell: [SHUT, { t: 'Warm and stale.', clue: 'warm' }] },
            floor: { look: { t: 'Water pooling out from under the front.', clue: 'leak' }, touch: { t: 'Wet, and the tile seam is lifting.', clue: 'leak' }, flashlight: { t: 'Behind the grille: the defrost drain overflowing, dripping steadily.', clue: 'leak', sfx: 'drip' } } },
          why: "A fridge that isn't cooling and is leaking water is a maintenance hazard: floor damage, mold, and a slip waiting to happen. Work order today." }
      ] },
    { id: 'o_microwave', room: 'o_break', name: 'Microwave', art: 'o_microwave',
      hint: 'Open it up and run it. Then follow the cord.',
      osha: 'Cord-and-plug equipment gets a look before use, and a damaged cord comes out of service right away (1910.334(a)(2)); a plug with its ground pin cut off is never used (1910.334(a)(3)).',
      parts: [{ id: 'panel', name: 'control panel', r: [156, 18, 48, 78] }, { id: 'cord', name: 'power cord', r: [204, 84, 36, 40] }, { id: 'door', name: 'door', r: [30, 16, 122, 80] }],
      base: { door: { touch: [{ if: 'open', t: 'You shut the door. Beep.', toggle: 'open', sfx: 'click' }, { t: 'You press the button and the door pops open.', toggle: 'open', sfx: 'click' }], look: [{ if: 'open', t: 'The cavity, the glass turntable, and the little mica cover over the waveguide on the right wall.' }, { t: 'A black countertop microwave. The building furnishes the break room.' }] },
        panel: { look: 'A keypad, a POPCORN button worn shinier than the rest, and a clock blinking 12:00. Of course.' }, cord: { look: 'The power cord, running back to the outlet.' } },
      variants: [
        { cat: 0, desc: 'A black microwave on the counter.', key: ['runs'],
          resp: { panel: { touch: [{ if: 'open', t: 'It won\'t start with the door open. Good.', sfx: 'click' }, { t: 'Beep. It hums, the turntable turns, the light comes on. Thirty seconds of nothing, cooked perfectly.', clue: 'runs', set: 'run', sfx: 'beep' }] },
            door: { flashlight: [SHUT, { t: 'Clean walls, clean turntable, intact waveguide cover.', clue: 'runs', sfx: 'light' }] }, cord: { touch: 'Supple, intact, plugged straight into the wall.' } },
          why: 'It runs, it is clean, and the cord is intact. Nothing to do.' },
        { cat: 1, desc: 'The microwave has seen a lot of lunches.', key: ['worn'],
          resp: { panel: { look: { t: 'The numbers on the most-used buttons are rubbed off: 1, 3, and START. And POPCORN, obviously.', clue: 'worn' }, touch: [{ if: 'open', t: 'Not with the door open.', sfx: 'click' }, { t: 'Beep. It runs fine.', set: 'run', sfx: 'beep' }] },
            door: { look: [{ if: 'open', t: 'Faded splatter stains baked into the ceiling, and rings on the turntable. Years of soup.', clue: 'worn' }, { t: 'A black countertop microwave.' }] }, cord: { touch: 'Intact.' } },
          why: 'Worn buttons and baked-in stains are years of lunches. A cleaning item at most. Normal wear.' },
        { cat: 2, cost: 210, desc: 'Something has burned inside the microwave.', key: ['arc'],
          resp: { door: { look: [{ if: 'open', t: 'The mica waveguide cover is burned through, a black hole with a brown halo, and there are little pits scorched into the walls.', clue: 'arc' }, { t: 'A brown haze on the inside of the window.' }], smell: [SHUT, { t: 'Burnt popcorn and something electrical.', clue: 'arc' }] },
            panel: { touch: [{ if: 'open', t: 'Not with the door open.', sfx: 'click' }, { t: 'You start it. It hums, then crackles: a blue spark behind the scorched cover. You stop it fast.', clue: 'arc', sfx: 'buzz' }] } },
          why: 'A burned-through waveguide cover and arc pits come from running metal in it: a fork, a foil-wrapped burrito. That is misuse, not age. Tenant damage: replace it and charge, with a photo.' },
        { cat: 3, desc: 'The microwave\'s cord hangs off the counter, unplugged.', key: ['fray', 'ground'],
          resp: { cord: { look: { t: 'The cord is frayed through near the plug, copper strands showing under a half-unwound wrap of electrical tape.', clue: 'fray' }, touch: 'You are not touching bare copper. You know better.',
              flashlight: { t: 'And the plug: two prongs and a stub. Someone cut the ground pin off to fit a two-prong extension cord.', clue: 'ground' } },
            panel: { touch: "You're not plugging this in to find out." } },
          why: 'A frayed cord with copper showing is a shock and fire hazard, and a damaged cord comes out of service right away (29 CFR 1910.334(a)(2)). The cut-off ground pin makes it worse. Tag it out and replace it.' }
      ] },
    { id: 'o_vct', room: 'o_break', name: 'Break Room Floor', art: 'o_vct', floor: true,
      hint: 'Walk the floor. Look for a worn path, gouges where things were dragged, and anything you could trip on.',
      osha: 'A cracked, lifted tile is a trip hazard and gets fixed or guarded before anyone works here (1910.22(a)(3)).',
      parts: [{ id: 'tile', name: 'one tile', r: [86, 56, 38, 38] }, { id: 'floor', name: 'vinyl floor', r: [0, 0, 240, 135] }],
      base: { floor: { look: 'Vinyl composition tile in two colors, a checkerboard of office.', smell: 'Floor wax, and coffee.' }, tile: { look: 'One twelve-inch tile.' } },
      variants: [
        { cat: 0, desc: 'Vinyl tile floor, waxed and shiny.', key: ['flat'],
          resp: { floor: { look: { t: 'An even shine, wall to wall.', clue: 'flat' }, touch: { t: 'Flat and tight.', clue: 'flat' } }, tile: { touch: { t: 'Firm, sealed edges.', clue: 'flat' } } },
          why: 'Clean, flat, and sealed. Nothing to do.' },
        { cat: 1, desc: 'A dull path crosses the floor.', key: ['path'],
          resp: { floor: { look: { t: 'The wax is gone in a lane from the door to the coffee spot, with black heel scuffs. Years of refills.', clue: 'path' }, touch: { t: 'Dull but smooth. The wear is only in the finish.', clue: 'path' } } },
          why: 'A worn traffic path is what years of walking do to vinyl. Strip and wax at turnover. Normal wear.' },
        { cat: 2, cost: 240, desc: 'Long gouges run across the tile.', key: ['gouge'],
          resp: { floor: { look: { t: 'Three long parallel gouges, right through the tile, where something heavy was dragged out without a dolly.', clue: 'gouge' }, touch: { t: 'Your fingernail drops into them. Deep.', clue: 'gouge' }, tape: { t: 'The gouges run about four feet, toward the door.', clue: 'gouge' } } },
          why: 'Gouges through the tile come from dragging, not walking. Replace the tiles and charge them, with a photo.' },
        { cat: 3, desc: 'One tile looks cracked.', key: ['trip'],
          resp: { tile: { look: { t: 'Cracked into pieces, and one corner has lifted, sharp, a quarter inch up.', clue: 'trip' }, touch: { t: 'The corner flaps up and down. It would catch a toe, or a mop.', clue: 'trip' }, tape: { t: 'The broken corner stands a good quarter inch proud.', clue: 'trip' } } },
          why: 'A lifted, sharp tile corner is a trip hazard (29 CFR 1910.22(a)(3)). Fix it before anyone works here.' }
      ] },
    { id: 'o_firstaid', room: 'o_break', name: 'First Aid Cabinet', art: 'o_firstaid',
      hint: 'Open it. Is it stocked, and is the cabinet itself in one piece?',
      osha: 'First aid supplies have to be readily available (1910.151(b)), and where anyone works with corrosive chemicals, there is a place to flush the eyes (1910.151(c)). The next tenant restocks; the building keeps the cabinet.',
      parts: [{ id: 'latch', name: 'latch', r: [148, 56, 14, 18] }, { id: 'cabinet', name: 'first aid cabinet', r: [74, 10, 92, 112] }],
      base: { cabinet: { touch: [{ if: 'open', t: 'You close the cabinet. Click.', toggle: 'open', sfx: 'click' }, { t: 'You flip the latch and open the cabinet.', toggle: 'open', sfx: 'click' }], look: [{ if: 'open', t: 'Shelves of first aid supplies.' }, { t: 'A white steel first aid cabinet with a red cross.' }], smell: 'Rubbing alcohol and adhesive bandages.' },
        latch: { touch: [{ if: 'open', t: 'You close it. Click.', toggle: 'open', sfx: 'click' }, { t: 'You flip the latch.', toggle: 'open', sfx: 'click' }] } },
      variants: [
        { cat: 0, desc: 'A wall-mounted first aid cabinet.', key: ['stocked'],
          resp: { cabinet: { look: [{ if: 'open', t: 'Bandages, gauze, gloves, burn gel, an eyewash bottle, scissors. All stocked, all in date.', clue: 'stocked' }, { t: 'A white steel first aid cabinet with a red cross.' }], flashlight: [SHUT, { t: 'Everything sealed and in date.', clue: 'stocked' }] } },
          why: 'Stocked, mounted, and easy to find (29 CFR 1910.151(b) wants first aid supplies readily available). Nothing to do.' },
        { cat: 1, desc: 'The first aid cabinet looks a little light.', key: ['used'],
          resp: { cabinet: { look: [{ if: 'open', t: 'Raided: empty bandage boxes, one lonely gauze pad, and the burn gel used up. Nothing broken, just used.', clue: 'used' }, { t: 'A white steel first aid cabinet with a red cross.' }], touch: [{ if: 'open', t: 'You close the cabinet. Click.', toggle: 'open', sfx: 'click' }, { t: 'You open it. Hinges fine, latch fine.', toggle: 'open', clue: 'used', sfx: 'click' }] } },
          why: 'Supplies get used; that is what they are for. Restocking is routine. Normal wear.' },
        { cat: 2, cost: 110, desc: 'The first aid cabinet door is crooked.', key: ['hinge'],
          resp: { cabinet: { look: { t: 'The door hangs by its bottom hinge, wrenched sideways. The top hinge is torn out of the steel.', clue: 'hinge' }, touch: { t: 'It swings on one bent hinge. It won\'t close.', clue: 'hinge' }, screwdriver: { t: "The hinge screws pulled right through the metal. That can't be tightened, only replaced.", clue: 'hinge', sfx: 'unscrew' } },
            latch: { touch: 'There is nothing for it to latch to.' } },
          why: "A door wrenched off its hinge is breakage. The cabinet is the building's: replace it and charge, with a photo." }
      ] },
    /* ---------------- SERVER / ELECTRICAL ROOM ---------------- */
    { id: 'o_panel', room: 'o_server', name: 'Electrical Panel', art: 'o_panel',
      hint: 'Measure the clear space in front of the panel. Then open it and read the directory.',
      osha: 'A panel keeps a clear working space at least 30 inches wide and 3 feet deep, never used for storage (1910.303(g)(1)); every circuit labeled (1910.303(f)(2)); live parts guarded (1910.303(g)(2)). Only a qualified electrician works inside it, breaker locked off (1910.333(b)(2)).',
      parts: [{ id: 'latch', name: 'door latch', r: [150, 48, 14, 20] }, { id: 'directory', name: 'panel directory', r: [36, 14, 36, 90] }, { id: 'breakers', name: 'breakers', r: [78, 12, 84, 94] }, { id: 'floor', name: 'floor in front of the panel', r: [0, 114, 240, 21] }],
      base: { latch: { touch: [{ if: 'open', t: 'You swing the panel door shut and latch it.', toggle: 'open', sfx: 'click' }, { t: 'You flip the latch and swing the panel door open.', toggle: 'open', sfx: 'creak' }] },
        breakers: { look: [SHUT, { t: 'Two columns of breakers behind the dead-front cover.' }], touch: [SHUT, { t: "You don't flip breakers in a tenant's panel to see what happens. Not today." }] },
        directory: { look: [{ if: '!open', t: "The directory is on the inside of the door. Open it." }, { t: 'A typed circuit directory: LIGHTS, RECEPT, BREAK RM, SERVER, HVAC. Every slot accounted for.' }] },
        floor: { look: 'Sealed concrete, with yellow-and-black hatch tape marking the space in front of the panel: keep clear.' } },
      variants: [
        { cat: 0, desc: 'A gray panelboard, with the floor in front of it marked off.', key: ['clear', 'labels'],
          resp: { floor: { tape: { t: 'Clear floor: 4 feet deep in front, 3 feet wide. Comfortably over the 30 inches by 3 feet a panel needs (29 CFR 1910.303(g)(1)).', clue: 'clear' }, look: { t: 'Nothing stored inside the hatched space.', clue: 'clear' } },
            directory: { look: [{ if: '!open', t: 'The directory is on the inside of the door. Open it.' }, { t: 'Typed and complete. Every breaker labeled.', clue: 'labels' }] } },
          why: 'Clear working space, a complete directory, and every cover on. Nothing to do.' },
        { cat: 1, desc: 'A gray panelboard. The directory looks well thumbed.', key: ['faded'],
          resp: { directory: { look: [{ if: '!open', t: 'The directory is on the inside of the door. Open it.' }, { t: "Handwritten in pencil years ago, smudged and faded: LITES?, RECPT, BRK RM, SRVR. Every circuit still identifiable, barely.", clue: 'faded' }] },
            floor: { tape: { t: 'Clear floor: 4 feet deep. Fine.' } } },
          why: 'A faded, smudged directory is age. It still identifies every circuit (29 CFR 1910.303(f)(2) wants them labeled). Retype it at turnover: normal wear.' },
        { cat: 2, cost: 150, desc: 'Boxes are stacked in front of the panel.', key: ['blocked'],
          resp: { floor: { tape: { t: 'From the panel to the boxes: 14 inches. It needs 3 feet (29 CFR 1910.303(g)(1)).', clue: 'blocked' }, look: { t: 'Old files, a box of Christmas lights, and a CRT monitor, stacked right in the hatched keep-clear space.', clue: 'blocked' } },
            latch: { touch: [{ if: 'open', t: 'You squeeze the door shut past the boxes.', toggle: 'open', sfx: 'click' }, { t: 'The door only swings halfway before it hits the boxes. In an emergency, nobody gets to the main breaker fast.', toggle: 'open', clue: 'blocked', sfx: 'creak' }] } },
          why: "Panels need a clear working space at least 30 inches wide and 3 feet deep, never used for storage (29 CFR 1910.303(g)(1)). The tenant's leftover boxes cut that to 14 inches. Removal is charged back, with a photo." },
        { cat: 3, desc: "The panel's door is hanging open.", key: ['exposed', 'missing'],
          resp: { breakers: { look: { t: 'No dead-front cover. Live copper bus bars, breaker terminals, and bare wire ends, right there to touch.', clue: 'exposed' }, touch: 'Absolutely not.', screwdriver: 'Not a chance. That is live.', flashlight: { t: 'The cover is leaning against the wall behind the door, never put back. The tenant\'s electrician took it off to pull their circuits.', clue: 'missing' } },
            latch: { touch: "The door won't close; the cover's screws are jammed in the hinge. You leave it." } },
          why: 'With the dead-front cover off, live bus bars and terminals are right there to touch. Live parts have to stay guarded (29 CFR 1910.303(g)(2)). Hazard: keep everyone out of this room and get an electrician today.' }
      ] },
    { id: 'o_rack', room: 'o_server', name: 'Server Rack', art: 'o_rack',
      hint: 'Give the rack a gentle push at the base. Then look at what is (still) in it.',
      osha: "Tall racks are anchored so they can't tip; OSHA's General Duty Clause covers a hazard like a top-heavy, unanchored rack even without a rule of its own. Anything still powered gets unplugged before it is unbolted.",
      parts: [{ id: 'top', name: 'top of the rack', r: [60, 0, 124, 40] }, { id: 'rails', name: 'rack rails', r: [74, 40, 92, 72] }, { id: 'base', name: 'rack base', r: [40, 112, 160, 23] }],
      base: { rails: { look: 'Square-hole rails, numbered in rack units.' }, top: { look: 'The top of the rack, under the cable ladder.' }, base: { look: 'The rack\'s feet, bolted to the slab.' } },
      variants: [
        { cat: 0, desc: "An empty four-post rack. The landlord's, bolted to the floor.", key: ['solid'],
          resp: { base: { touch: { t: 'You lean on it. It doesn\'t move a millimeter. Anchored.', clue: 'solid' }, look: { t: 'Four anchor bolts, all tight.', clue: 'solid' } }, rails: { look: { t: 'Empty and clean. The tenant took their gear and their cables, the way they were supposed to.', clue: 'solid' } } },
          why: 'Empty, anchored, and clean. Nothing to do.' },
        { cat: 1, desc: 'An empty rack, scuffed, with a few leftover straps.', key: ['scuff'],
          resp: { rails: { look: { t: 'Paint rubbed off the posts where servers slid in and out for years, and a couple of hook-and-loop straps still hanging.', clue: 'scuff' } }, base: { look: { t: 'Scrape marks on the concrete around the feet.', clue: 'scuff' }, touch: { t: 'Solid. Anchored.', clue: 'scuff' } } },
          why: 'Scuffed paint and scraped floor around an equipment rack are years of normal use. Normal wear.' },
        { cat: 2, cost: 400, desc: 'The rack is still full of the tenant\'s gear.', key: ['abandoned'],
          resp: { rails: { look: { t: "A patch panel, a network switch still blinking away, an old server, and a waterfall of patch cables. The tenant just... left it.", clue: 'abandoned' }, touch: { t: 'The switch is warm. Somebody is paying to power this.', clue: 'abandoned' }, smell: 'Warm dust and electronics.' },
            base: { touch: { t: 'Solid. Anchored.', clue: 'abandoned' } } },
          why: "The tenant's network gear and cabling are theirs to remove at lease end. They left it. Removal and disposal get charged back, with a photo." },
        { cat: 3, desc: 'The rack looks a little off.', key: ['rock', 'anchor'],
          resp: { base: { touch: { t: 'You barely push. It rocks toward you, and the heavy box at the top sways. You let go fast.', clue: 'rock' }, look: { t: 'One foot is lifted off the slab. Its anchor bolt pulled out, bent.', clue: 'anchor' } },
            top: { look: { t: 'A heavy old UPS still bolted way up top. All the weight is in the wrong place.', clue: 'rock' } } },
          why: "A tall rack that rocks on a pulled anchor, with heavy gear still up top, can tip onto someone. Hazard (OSHA's General Duty Clause covers it): keep clear, and get it emptied and re-anchored today." }
      ] },
    { id: 'o_ups', room: 'o_server', name: 'UPS', art: 'o_ups',
      hint: 'Read the UPS display. Feel the case, and use your nose.',
      osha: "A failing lead-acid battery can vent hydrogen sulfide and hydrogen. Air the room out before anyone works on it, and where battery acid can splash, there has to be somewhere to flush the eyes (1910.151(c)).",
      parts: [{ id: 'display', name: 'display', r: [88, 14, 64, 24] }, { id: 'vents', name: 'front vents', r: [84, 56, 72, 58] }, { id: 'side', name: 'side panel', r: [164, 2, 16, 120] }, { id: 'top', name: 'top', r: [76, 0, 104, 10] }],
      base: { side: { look: 'The side of the UPS.' }, top: { look: 'The top of the UPS.' }, vents: { look: 'Intake vents for the battery fans.' } },
      variants: [
        { cat: 0, desc: 'A floor-standing UPS beside the rack, the building\'s, keeping the phone system alive.', key: ['ok'],
          resp: { display: { look: { t: 'ONLINE, battery 100%. Green across the board.', clue: 'ok' } }, side: { touch: { t: 'Barely warm. The fans whisper.', clue: 'ok' } }, vents: { touch: 'A gentle draft. Clear.' } },
          why: 'Online, charged, cool, and clean. Nothing to do.' },
        { cat: 1, desc: 'The UPS display is amber.', key: ['age'],
          resp: { display: { look: { t: 'REPL BATT: the batteries are five years old and reaching the end of their life. Everything else is green.', clue: 'age' } }, vents: { look: { t: 'Gray dust furring the intake vents.', clue: 'age' }, touch: 'The draft is weaker through the dust.' }, side: { touch: 'Barely warm.' } },
          why: 'UPS batteries age out after a few years, and vents collect dust. Swap the batteries and vacuum it: normal wear.' },
        { cat: 2, cost: 180, desc: 'A brown streak runs down the front of the UPS.', key: ['spill'],
          resp: { top: { look: { t: 'A coffee ring, and the dried trail of a whole cup down the front and into the vents. Somebody used it as a side table.', clue: 'spill' }, smell: 'Stale coffee.' },
            vents: { look: { t: 'Dried coffee in the vent slots, and the front bezel cracked at the corner.', clue: 'spill' } }, display: { look: 'ONLINE. It survived. This time.' } },
          why: 'Spilled coffee into the vents and a cracked bezel are misuse, not wear. Clean and repair the unit and charge it, with a photo.' },
        { cat: 3, desc: 'There is a strange smell near the UPS.', key: ['sulfur', 'hot', 'swollen'],
          resp: { side: { look: { t: 'The side panel bows outward. The batteries inside have swollen.', clue: 'swollen' }, touch: { t: 'Hot. Far too hot to keep your hand on.', clue: 'hot' } }, vents: { smell: { t: 'Rotten eggs. A battery is venting.', clue: 'sulfur', sfx: 'hiss' } },
            display: { look: { t: 'FAULT, blinking red.', clue: 'hot' } }, top: { look: 'A shimmer of heat over the top.' } },
          why: 'A rotten-egg smell and a hot, bulging case mean a lead-acid battery is failing and venting gas. Hazard: do not touch it, air the room out, keep people out, and call the vendor.' }
      ] },
    { id: 'o_minisplit', room: 'o_server', name: 'Wall AC Unit', art: 'o_minisplit',
      hint: 'Server rooms run hot. Is the AC unit cooling? And what is under it?',
      osha: "Water and electrical gear don't mix: keep it off the panel and the cords. Whoever fixes the drain works with the unit's disconnect off and locked (1910.147).",
      parts: [{ id: 'louver', name: 'air louver', r: [36, 60, 168, 14] }, { id: 'panel', name: 'front panel', r: [26, 20, 188, 40] }, { id: 'line', name: 'line set and drain', r: [196, 72, 24, 63] }, { id: 'wall', name: 'wall under the unit', r: [0, 74, 190, 61] }],
      base: { panel: { look: 'A ductless mini-split head, mounted high on the wall. The server room\'s own air conditioning.' }, line: { look: 'The insulated refrigerant lines and a little condensate drain tube, down the wall.' }, wall: { look: 'Painted drywall.' } },
      variants: [
        { cat: 0, desc: 'A wall-mounted AC unit, humming away.', key: ['cold'],
          resp: { louver: { touch: { t: 'Cold air, steady and strong.', clue: 'cold' } }, panel: { look: { t: 'Display: 64 degrees. Quiet.', clue: 'cold' } }, wall: { touch: 'Dry.' } },
          why: 'Cooling, clean, and dry. Nothing to do.' },
        { cat: 1, desc: 'The AC unit is yellowed and dusty.', key: ['dust'],
          resp: { panel: { look: { t: 'Yellowed plastic, and gray fuzz packed into the intake grille on top.', clue: 'dust' } }, louver: { touch: { t: 'Cool air, a little weak through the dirty filters.', clue: 'dust' } } },
          why: 'Dusty filters and yellowed plastic are age. Clean the filters at turnover: normal wear.' },
        { cat: 2, cost: 150, desc: 'Part of the AC unit is hanging down.', key: ['louver'],
          resp: { louver: { look: { t: 'The louver vane is snapped in half, one end dangling, and the front panel is cracked. Something long hit it. A ladder, or a rack rail on its way out.', clue: 'louver' }, touch: { t: 'Cold air still comes out. The broken vane flaps in it.', clue: 'louver' } } },
          why: 'A snapped louver and cracked panel are impact damage, not age. Repair it and charge, with a photo.' },
        { cat: 3, desc: 'There is a dark streak on the wall under the AC unit.', key: ['drip', 'wet'],
          resp: { wall: { look: { t: 'Water running down the wall from under the unit, toward the electrical panel.', clue: 'wet' }, touch: { t: 'Soaked drywall. Soft.', clue: 'wet' } },
            line: { look: { t: 'The condensate drain tube has been cut off short (to make room for a cable run, probably), and the unit is dripping onto the wall.', clue: 'drip', sfx: 'drip' } }, louver: { touch: 'Cold air. The cooling works; the draining doesn\'t.' } },
          why: 'Condensate running down the wall in a room full of electrical gear, toward the panel, is a shock and equipment hazard. Hazard: shut the unit off and get the drain fixed today.' }
      ] },
    { id: 'o_sprinkler', room: 'o_server', name: 'Sprinkler Head', art: 'o_sprinkler',
      hint: 'Look up at the sprinkler head over the rack, and measure the clearance under it.',
      osha: 'Keep at least 18 inches between sprinkler heads and anything stored below them (1910.159(c)(10)). A painted or loaded head gets replaced by the sprinkler contractor, never cleaned in place (NFPA 25).',
      parts: [{ id: 'head', name: 'sprinkler head', r: [106, 40, 28, 30] }, { id: 'pipe', name: 'sprinkler pipe', r: [0, 22, 240, 16] }, { id: 'below', name: 'space below the head', r: [0, 72, 240, 63] }],
      base: { pipe: { look: 'Black steel sprinkler pipe across the open ceiling, with a drop down to a pendent head.', touch: 'Out of reach. And you don\'t hang on sprinkler pipe.' }, head: { touch: 'You do not touch sprinkler heads. Ever.', hammer: 'ABSOLUTELY not.' } },
      variants: [
        { cat: 0, desc: 'A sprinkler head on a drop over the rack.', key: ['clear'],
          resp: { head: { look: { t: 'A brass pendent head, its red glass bulb intact and clean.', clue: 'clear' } }, below: { tape: { t: '26 inches from the deflector to the top of the rack. Over the 18 inches it needs (29 CFR 1910.159(c)(10)).', clue: 'clear' } } },
          why: 'Clean, intact, and clear below. Nothing to do.' },
        { cat: 1, desc: 'A sprinkler head over the rack, a little fuzzy.', key: ['dust'],
          resp: { head: { look: { t: 'A light coat of gray dust on the deflector and frame. Server rooms make dust.', clue: 'dust' } }, below: { tape: { t: '26 inches of clearance. Fine.' } }, pipe: { look: 'Dusty on top.' } },
          why: "Light dust on a sprinkler head is age. Don't wipe it yourself; note it, and the sprinkler contractor checks it at the annual inspection. Normal wear." },
        { cat: 2, cost: 180, desc: 'Cables run along the sprinkler pipe.', key: ['ziptie'],
          resp: { pipe: { look: { t: "A bundle of data cable zip-tied right to the sprinkler pipe, sagging between the ties. The sprinkler pipe holds up sprinklers and nothing else (NFPA 13).", clue: 'ziptie' }, tape: { t: 'Twelve zip ties over about 10 feet of pipe.', clue: 'ziptie' } } },
          why: "The tenant's cabling contractor hung cable from the sprinkler pipe, which the fire code forbids. Removing it and rehanging it properly is charged back, with a photo." },
        { cat: 3, desc: 'The sprinkler head is speckled.', key: ['paint'],
          resp: { head: { look: { t: 'Paint overspray on the bulb and the deflector: somebody painted the ceiling around it without bagging the head.', clue: 'paint' }, flashlight: { t: 'The bulb is coated. A painted head may not open in a fire, or may open late.', clue: 'paint' } } },
          why: 'A painted sprinkler head may not work in a fire, and it can only be replaced, never cleaned (NFPA 25). With the fire protection in this room impaired, that is a hazard: call the sprinkler contractor today.' },
        { cat: 2, cost: 120, desc: 'Boxes are stacked up near the ceiling.', key: ['stacked'],
          resp: { below: { tape: { t: 'From the deflector to the top box: 7 inches. It needs 18 (29 CFR 1910.159(c)(10)).', clue: 'stacked' }, look: { t: "Banker's boxes stacked on the rack, almost to the sprinkler. Labeled XMAS DECOR and TPS 2004-2006.", clue: 'stacked' } } },
          why: "Storage has to stay at least 18 inches below sprinkler heads so the spray can reach a fire (29 CFR 1910.159(c)(10)). The tenant's boxes are 7 inches away. Removal is charged back, with a photo." }
      ] }
  ];

  /* ============================== ODDITIES ==============================
     Small finds drawn straight into the rooms (js/anomalies.js format). 0 is nothing to do, 1 is normal wear. */
  const dot = (g, p, c, w = 1, h = 1) => pxRect(g, p[0], p[1], w, h, c);
  const around = (p, w, h) => [[p[0] - w, p[1] - h], [p[0] + w, p[1] - h], [p[0] + w, p[1] + h], [p[0] - w, p[1] + h]];
  const ANOMALIES_O = [
    /* ---------- lobby ---------- */
    { id: 'o_plantring', room: 'o_lobby', name: 'Ring on the tile', cat: 0,
      pts: () => Q.floor(3.6, 4.8, 6.9, 7.9), walk: { x: 4.2, z: 6.4 },
      look: 'A chalky white ring on the tile where a big potted ficus stood for years. Every lobby had one.', touch: 'Mineral crust. It scratches off with a fingernail.', smell: 'Potting soil, faintly.',
      why: 'Mineral rings on porcelain tile scrub right off. Cleaning, not damage.',
      draw(g, r) { strokePoly(g, floorBlob(4.2, 7.4, .42, .3, 3, .15, 18), 'rgba(240,236,226,0.75)'); strokePoly(g, floorBlob(4.2, 7.4, .36, .25, 5, .15, 16), 'rgba(240,236,226,0.35)'); } },
    { id: 'o_velcro', room: 'o_lobby', name: 'Hook-and-loop squares on the desk', cat: 0,
      pts: () => around(P(-4.4, 1.0, 9.3), 7, 4), walk: { x: -4.4, z: 8.4 },
      look: 'Two little squares of hook-and-loop tape on the front of the desk, where a PLEASE SIGN IN sign hung.', touch: 'They peel off clean, leaving a little adhesive. A rag takes that.',
      why: 'Stick-on squares peel off without a mark. Nothing to charge.',
      draw(g, r) { for (const x of [-4.6, -4.2]) dot(g, P(x, 1.02, 9.3), '#f4f2ea', 2, 2); } },
    { id: 'o_tackholes', room: 'o_lobby', name: 'Thumbtack holes', cat: 1,
      pts: r => Q.left(r.box, 6.2, 7.6, 1.6, 2.3), walk: { x: -5, z: 6.8 },
      look: 'A loose grid of thumbtack holes. A corkboard of company news lived here: birthdays, the softball schedule, a SAFETY FIRST flyer.', touch: 'Tiny. Smaller than a pencil tip.', tape: 'Each one is barely a sixteenth of an inch.',
      why: 'Thumbtack holes are far smaller than a quarter inch. Normal wear.',
      draw(g, r) { for (const [z, y] of [[6.4, 2.2], [7.3, 2.2], [6.4, 1.7], [7.3, 1.7], [6.85, 2.0], [6.6, 1.9]]) dot(g, P(r.box.x0, y, z), '#5a4a3a'); } },
    { id: 'o_bellmark', room: 'o_lobby', name: 'Ring on the ledge', cat: 0,
      pts: () => around(P(-2.55, 1.3, 9.35), 6, 3), walk: { x: -2.6, z: 8.4 },
      look: 'A faint round mark on the transaction ledge where a little silver service bell sat. Ding.', touch: 'It buffs out with your sleeve. Mostly.', talk: 'You say "ding." Nobody comes.',
      why: 'A faint mark that buffs out is cleaning, not damage.',
      draw(g, r) { const c = P(-2.55, 1.3, 9.35); strokePoly(g, blobPts(c[0], c[1], 3, 1, 4, .1, 10), 'rgba(150,140,120,0.45)'); } },
    { id: 'o_brochure', room: 'o_lobby', name: 'Screw holes by the door', cat: 1,
      pts: r => Q.right(r.box, 6.2, 7.2, 1.0, 1.8), walk: { x: 5, z: 6.8 },
      look: 'Four small screw holes where a brochure rack hung. PAPER: THE FUTURE IS HERE, presumably.', touch: 'Clean little holes. No torn paper.', tape: 'Each hole is about 1/8 inch.',
      why: 'Small, clean screw holes from a hung rack are normal wear. Spackle and paint at turnover.',
      draw(g, r) { for (const [z, y] of [[6.35, 1.7], [7.05, 1.7], [6.35, 1.1], [7.05, 1.1]]) dot(g, P(r.box.x1, y, z), '#5a4a3a'); } },
    /* ---------- open office ---------- */
    { id: 'o_dents', room: 'o_open', name: 'Desk-leg dents', cat: 1,
      pts: () => Q.floor(1.2, 2.8, 5.6, 6.8), walk: { x: 2, z: 5.2 },
      look: 'Four deep dents in the carpet tile in a rectangle, where a heavy desk sat for eight years.', touch: 'Crushed pile. It will mostly spring back with a little steam.', tape: 'They\'re 5 feet apart. Executive desk. Somebody important sat here.',
      why: 'Furniture dents come with any carpet that had furniture on it. Normal wear.',
      draw(g, r) { for (const [x, z] of [[1.4, 5.8], [2.6, 5.8], [1.4, 6.6], [2.6, 6.6]]) dot(g, P(x, 0, z), 'rgba(20,24,34,0.55)', 2, 1); } },
    { id: 'o_pushpins', room: 'o_open', name: 'Pushpins in the column', cat: 0,
      pts: () => [P(4.62, 1.3, 8.6), P(5.28, 1.3, 8.6), P(5.28, 2.2, 8.6), P(4.62, 2.2, 8.6)], walk: { x: 4.6, z: 7.8 },
      look: 'A dozen colored pushpins still stuck in the column, holding up nothing. There was a sign-up sheet here once. CHILI COOK-OFF, maybe.', touch: 'They pull right out. You put them back. Somebody might come back for the chili.',
      why: 'Pushpins pull out and leave pinholes. Nothing to charge.',
      draw(g, r) { ['#d43a2a', '#2c4f9a', '#f2c418', '#4f9a4a', '#d43a2a', '#2c4f9a'].forEach((c, i) => dot(g, P(4.7 + hash(i) * .5, 1.4 + hash(i + 5) * .7, 8.6), c)); } },
    { id: 'o_memo', room: 'o_open', name: 'Sticky note', cat: 0,
      pts: r => Q.back(r.box, 1.95, 2.35, 1.45, 1.8), walk: { x: 2.1, z: 13 },
      look: "A yellow sticky note at eye level: 'Did you get the memo about the new cover sheets?' Underneath, in different handwriting: 'YES.'", touch: 'It peels off clean.', talk: 'You tell the note you got the memo. Yeah.',
      why: 'A sticky note. Peel it off. Nothing to do.',
      draw(g, r) { fillPoly(g, Q.back(r.box, 2.0, 2.3, 1.5, 1.76), '#f8e070'); const a = P(2.04, 1.62, r.box.zb), b = P(2.25, 1.62, r.box.zb); pxLine(g, a[0], a[1], b[0], b[1], '#6a6aa0'); } },
    { id: 'o_tapemarks', room: 'o_open', name: 'Tape on the carpet', cat: 0,
      pts: () => Q.floor(-2.9, -1.8, 11.5, 12.5), walk: { x: -2.4, z: 10.8 },
      look: 'A square of yellow floor tape marking where the big copier stood. PRINTER ZONE, it says, in marker.', touch: 'It peels up with a little effort. No residue on carpet tile.',
      why: 'Floor tape peels off. Nothing to charge.',
      draw(g, r) { strokePoly(g, Q.floor(-2.8, -1.9, 11.6, 12.4), '#e8c418'); } },
    { id: 'o_labelsw', room: 'o_open', name: 'Label on the switches', cat: 0,
      pts: r => Q.left(r.box, 8.45, 9.0, 1.6, 1.78), walk: { x: -6, z: 8.6 },
      look: "A label-maker label above the switches: DO NOT TOUCH. EVER. And under that, another: SERIOUSLY.", touch: 'It peels off clean. You leave it, out of respect.',
      why: 'A label peels off. Nothing to do.',
      draw(g, r) { fillPoly(g, Q.left(r.box, 8.55, 8.9, 1.64, 1.72), '#f4f4ee'); } },
    /* ---------- break room ---------- */
    { id: 'o_fridgenote', room: 'o_break', name: 'Note on the fridge', cat: 0,
      pts: () => [P(3.5, 1.2, 10.7), P(3.95, 1.2, 10.7), P(3.95, 1.62, 10.7), P(3.5, 1.62, 10.7)], walk: { x: 3.6, z: 9.8 },
      look: "A note taped to the fridge: 'PLEASE LABEL YOUR FOOD. THIS MEANS YOU, GARY.' Somebody has added: 'WHO IS GARY'.", touch: 'Tape. It comes off clean.', talk: 'You ask the note who Gary is. The note does not know either.',
      why: 'A taped-up note comes right off. Nothing to do.',
      draw(g, r) { fillPoly(g, [P(3.55, 1.25, 10.69), P(3.9, 1.25, 10.69), P(3.9, 1.58, 10.69), P(3.55, 1.58, 10.69)], '#fbfaf2'); for (let k = 0; k < 3; k++) { const a = P(3.6, 1.5 - k * .08, 10.69), b = P(3.85, 1.5 - k * .08, 10.69); pxLine(g, a[0], a[1], b[0], b[1], k ? '#6a6a72' : '#c43a3a'); } } },
    { id: 'o_coffeering', room: 'o_break', name: 'Coffee rings', cat: 0,
      pts: () => { const c = P(.3, .96, 11.2); return around(c, 9, 4); }, walk: { x: .3, z: 9.8 },
      look: 'Brown coffee rings on the counter, overlapping like the Olympic logo, where the coffee maker and a hundred mugs sat.', touch: 'They wipe right off with a damp rag.', smell: 'Burnt coffee. Office coffee.',
      why: 'Coffee rings wipe off. Cleaning, not damage.',
      draw(g, r) { for (const [x, z] of [[.1, 11.15], [.35, 11.25], [.55, 11.12]]) strokePoly(g, blobPts(...P(x, .961, z), 3, 1, x * 9, .1, 10), 'rgba(110,70,30,0.45)'); } },
    { id: 'o_chairscuff', room: 'o_break', name: 'Chair scuffs on the wall', cat: 1,
      pts: r => Q.right(r.box, 5.8, 7.6, .6, .95), walk: { x: 4.2, z: 6.6 },
      look: 'Gray scuffs at chair-back height, where the lunch table chairs knocked the wall a few thousand times.', touch: 'Surface marks. They\'ll mostly wipe off.',
      why: 'Chair-back scuffs are everyday use. Clean or touch up at turnover. Normal wear.',
      draw(g, r) { for (let i = 0; i < 5; i++) { const a = P(r.box.x1, .8 + hash(i) * .1, 5.9 + i * .35), b = P(r.box.x1, .82 + hash(i) * .1, 6.1 + i * .35); pxLine(g, a[0], a[1], b[0], b[1], 'rgba(60,60,70,0.45)'); } } },
    { id: 'o_oldstain', room: 'o_break', name: 'Old ceiling stain', cat: 0,
      pts: r => Q.ceil(r.box, -3.8, -2.4, 8.8, 10.2), walk: { x: -3, z: 8.4 },
      look: 'A faint, dry brown ring on one ceiling tile, crisp-edged. It was painted over at least once.', touch: 'You poke it with the clipboard. Dry and firm.', flashlight: 'No fresh staining, no sag. An old, dead stain from a leak fixed long ago.',
      why: 'An old, dry stain from a long-fixed leak. Note it, but nothing to do.',
      draw(g, r) { strokePoly(g, blobPts(...P(-3.1, r.box.h, 9.5), 8, 3, 33, .3, 16), 'rgba(140,100,50,0.4)'); } },
    { id: 'o_magnet', room: 'o_break', name: 'Fridge magnet', cat: 0,
      pts: () => around(P(3.7, 2.4, 10.7), 4, 4), walk: { x: 3.6, z: 9.8 },
      look: "A magnet for a pizza place that delivers 'TO YOUR DESK!', with a 2006 coupon still under it.", touch: 'It slides off with a little snap.',
      why: 'A magnet. Take it or leave it. Nothing to charge.',
      draw(g, r) { const c = P(3.7, 2.4, 10.69); pxRect(g, c[0] - 2, c[1] - 2, 4, 3, '#d43a2a'); pxRect(g, c[0] - 1, c[1] - 1, 2, 1, '#f2c418'); } },
    /* ---------- server room ---------- */
    { id: 'o_zipties', room: 'o_server', name: 'Snipped zip ties', cat: 0,
      pts: () => Q.floor(-.4, .9, 6.6, 7.6), walk: { x: .2, z: 6.2 },
      look: 'A scatter of snipped zip-tie tails on the floor. The cable guys were here, and left in a hurry.', touch: 'Little white plastic slivers. A broom handles these.',
      why: 'Zip-tie clippings are sweeping, not damage.',
      draw(g, r) { for (let i = 0; i < 9; i++) { const c = P(-.3 + hash(i) * 1.1, 0, 6.7 + hash(i + 4) * .8); pxRect(g, c[0], c[1], 2, 1, '#f4f4ee'); } } },
    { id: 'o_dnu', room: 'o_server', name: 'Label on the outlet', cat: 0,
      pts: r => Q.back(r.box, -.7, -.15, .3, .75), walk: { x: -.4, z: 8 },
      look: "An outlet with a label-maker label: DO NOT UNPLUG!!! Nothing is plugged into it. Whatever it was, it's gone now, and the world kept turning.", touch: 'The label peels off.', talk: 'You promise the outlet you will not unplug anything. It seems relieved.',
      why: 'A label. Peel it off. Nothing to do.',
      draw(g, r) { outletBack(g, r, -.5, .38); fillPoly(g, Q.back(r.box, -.62, -.24, .64, .7), '#f4f4ee'); } },
    { id: 'o_floorscuff', room: 'o_server', name: 'Caster marks on the floor', cat: 1,
      pts: () => Q.floor(-.4, 2.4, 7.4, 8.2), walk: { x: .8, z: 6.8 },
      look: 'Black caster marks on the sealed concrete, every one of them headed for the rack. Years of servers going in and out.', touch: 'Rubber marks. A floor machine takes most of them.',
      why: 'Caster marks from moving equipment are everyday use in a server room. Normal wear.',
      draw(g, r) { for (let i = 0; i < 5; i++) { const a = P(-.2 + i * .5, 0, 7.5 + hash(i) * .5), b = P(.1 + i * .5, 0, 7.8 + hash(i) * .4); pxLine(g, a[0], a[1], b[0], b[1], 'rgba(30,30,34,0.5)'); } } },
    { id: 'o_extnums', room: 'o_server', name: 'Numbers on the backboard', cat: 0,
      pts: r => Q.right(r.box, 7.5, 9.5, 1.1, 1.5), walk: { x: 3.3, z: 8 },
      look: "Phone extensions scrawled on the plywood in marker: 204 RECEPT, 211 BILL, 212 MILTON (BASEMENT?).", touch: 'Marker on plywood. That is exactly what a phone backboard is for.',
      why: 'Notes on a telecom backboard are what it is for. Nothing to charge.',
      draw(g, r) { for (let k = 0; k < 3; k++) { const a = P(r.box.x1, 1.4 - k * .1, 7.6), b = P(r.box.x1, 1.4 - k * .1, 8.4 + hash(k) * .5); pxLine(g, a[0], a[1], b[0], b[1], '#2a2a40'); } } }
  ];

  /* ============================== LEFT BEHIND ==============================
     What Synergex didn't take with them. Each draws its pixel sprite (OFC.SPRITES, in office-art.js); paper lands at a slant. */
  const sprite = (kind, paper) => (g, x, y, k) => {
    const rows = A.SPRITES[kind], s = k >= 2.5 && rows.length * 3 > 26 ? 2 : sprScale(k);   // the bag's slots are short: tall things go in at 2x
    if (paper) drawPaper(g, rows, x, y + 1, s, SPR_PAL); else drawSprite(g, rows, x, y + 1, s, SPR_PAL);
  };
  const CLUTTER_O = {
    o_tps: { name: 'TPS report cover sheet', look: "A TPS report cover sheet, the new kind. Did you get the memo? There's a memo about it.", touch: 'Crisp, official, and completely pointless.', smell: 'Copier toner and bureaucracy.', draw: sprite('o_tps', true) },
    o_toner: { name: 'Toner cartridge', look: 'An empty toner cartridge, sifting a little black dust. PC LOAD LETTER, presumably.', touch: 'Your fingers come away gray. Of course they do.', smell: 'Hot plastic. The smell of every printer jam ever.', draw: sprite('o_toner') },
    o_cardfile: { name: 'Rotary card file', look: 'A rotary card file, the kind everybody calls by its brand name. Hundreds of contacts on little cards, half of them with fax numbers.', touch: 'You spin it. Fwip-fwip-fwip. Deeply satisfying.', smell: 'Old index cards.', draw: sprite('o_cardfile') },
    o_plant: { name: 'Desk plant', look: 'A pothos in a plastic pot, still hanging on. It survived eight years of fluorescent light. Nobody took it to the new office.', touch: 'The soil is bone dry. You feel a little responsible now.', smell: 'Dusty leaves.', take: 'You take the plant. You are going to water it. You promise.', draw: sprite('o_plant') },
    o_motposter: { name: 'Motivational poster', look: "A framed poster: a mountain at sunrise, and under it in white capitals, ACHIEVEMENT. Smaller: 'The only limit is the one you set for yourself.'", touch: 'The frame is cheap and the glass is plastic. Like most promises.', smell: 'Dust.', draw: sprite('o_motposter') },
    o_nameplate: { name: 'Desk nameplate', look: "A brass desk nameplate: BILL L., VICE PRESIDENT. Yeah. If you could go ahead and pick that up, that'd be great.", touch: 'Heavy for its size. Brass-colored, anyway.', smell: 'Brass polish and authority.', draw: sprite('o_nameplate') },
    o_fax: { name: 'Fax machine', look: "A beige fax machine with one fax still in the tray: 'URGENT: PLEASE CONFIRM RECEIPT OF THIS FAX.' Nobody confirmed.", touch: 'Heavy. The handset has a curly cord that has been twisted into a knot.', smell: 'Thermal paper.', draw: sprite('o_fax') },
    o_crt: { name: 'CRT monitor', look: 'A 17-inch CRT monitor, beige, deep as it is wide. Flat panels killed it, and it knows.', touch: 'You try to lift it. It weighs as much as a small dog. A dense, beige dog.', smell: 'Static.', draw: sprite('o_crt') },
    o_zipdisk: { name: 'Zip disk', look: "A 100 MB Zip disk labeled BACKUP FINAL FINAL (2). Whatever was on it is gone forever now.", touch: 'It rattles faintly. That is not a good sign for a disk.', smell: 'Plastic.', draw: sprite('o_zipdisk') },
    o_keyboard: { name: 'Keyboard', look: 'A beige keyboard. The Ctrl, C, and V keys are worn shiny. Someone was very productive.', touch: 'Crumbs rain out when you tilt it. A whole lunch, in installments.', smell: 'Crumbs and hand lotion.', draw: sprite('o_keyboard') },
    o_bossmug: { name: "'World's Best Boss' mug", look: "A white mug: WORLD'S BEST BOSS. Bought by the boss, you suspect. Still has a coffee ring inside.", touch: 'You hook a finger through the handle. You feel, briefly, like the best boss.', smell: 'Old coffee. Leadership.', draw: sprite('o_bossmug') },
    o_trophy: { name: 'Little gold trophy', look: "A gold plastic figure on a fake-wood base. The plaque: THE SCRANTIES 2007, WHITEST SNEAKERS.", touch: 'Light as a feather. Hollow plastic. It\'s the thought that counts.', smell: 'Plastic and pride.', draw: sprite('o_trophy') }
  };
  const BAG_TEXT_O = {
    o_tps: { touch: 'You fill in the cover sheet for nothing in particular. It feels important anyway.' },
    o_toner: { touch: 'You shake it. A small black cloud. You stop shaking it.' },
    o_cardfile: { touch: 'You flip to the Ks. Somebody named Kowalski has three fax numbers. Why does anyone need three fax numbers?' },
    o_plant: { touch: 'You turn a leaf toward the light. It seems grateful. Plants can\'t seem grateful. And yet.' },
    o_motposter: { touch: 'You stare at the mountain. You feel nothing. Then, faintly: achievement.' },
    o_nameplate: { touch: "You set it in front of you. BILL L., VICE PRESIDENT. You are going to need you to come in on Saturday." },
    o_fax: { touch: 'You press START. It shrieks the fax handshake at you, a sound from another era.' },
    o_crt: { touch: 'You knock on the side. Deep, hollow, and heavy. They don\'t make them like this anymore, for good reasons.' },
    o_zipdisk: { touch: 'You slide the shutter open. The disk inside is scratched in a perfect circle. BACKUP FINAL FINAL (2) is no more.' },
    o_keyboard: { touch: 'You type your name. Every key sticks a little. You type it again anyway.' },
    o_bossmug: { touch: "You raise it in a toast. To the world's best boss. Whoever they are." },
    o_trophy: { touch: 'You hold it up. You give a short, gracious speech to nobody. You thank the academy.' }
  };
  const BAG_COMBOS_O = {
    'o_tps+stapler': 'You staple the TPS cover sheet to nothing. Ka-chunk. It is now properly filed.',
    'o_bossmug+o_trophy': "You put the trophy in the mug. WORLD'S BEST BOSS, WHITEST SNEAKERS. A complete legacy.",
    'o_nameplate+o_trophy': 'You set the trophy beside the nameplate. BILL L., VICE PRESIDENT, now an award-winning one.',
    'o_crt+o_keyboard': 'You set the keyboard in front of the monitor. All you need is a beige tower and 1999.',
    'o_fax+o_tps': 'You fax the TPS cover sheet to nobody. The machine shrieks, thinks about it, and prints CONFIRMATION: FAILED.',
    'o_plant+o_bossmug': 'You water the plant from the mug. There was a little cold coffee in it. The plant does not seem to mind.',
    'o_cardfile+o_zipdisk': 'You file the Zip disk under B, for BACKUP. It does not fit. Nothing about this era fit.'
  };

  /* ============================== THE WORDS ============================== */
  const BRIEFING_O = [
    { title: 'Lease-end inspection', art: 'door', text: 'Synergex Paper Solutions just moved out of <b>Suite 204</b> after eight years. Before the landlord markets the space or returns a cent of the <b>security deposit</b>, every area gets a proper lease-end walkthrough. That\'s you.' },
    { title: 'Your tools', art: 'verbs', text: 'Hover over the <b>top edge</b> of the screen for your toolbar. <b>Right-click</b> anywhere to cycle Walk, Look, Touch, Smell, and Talk. Keys <b>1-5</b> work too.' },
    { title: 'Get a closer look', art: 'zoom', text: '<b>Look</b> at a feature to bring up a close-up. Then use your <b>senses</b> and <b>tools</b> (tape measure, flashlight, screwdriver, hammer, pencil) on its parts. Anything useful lands in your field notes.' },
    { title: 'Mark it', art: 'cats', text: 'Same four codes as the apartments: <b>Clean</b>, <b>Normal Wear &amp; Tear</b>, <b>Tenant Damage</b>, or a <b>Maintenance Hazard</b>. The commercial twist: whatever the tenant <b>added and didn\'t restore</b> (cable holes, card readers, signage, abandoned cabling) counts as tenant damage. The <b>SOP binder</b> has examples.' },
    { title: 'Document it', art: 'camera', text: 'Damage and unrestored alterations only come out of the deposit with a <b>photo</b>, and hazards always need one. Snap pictures with your <b>digital camera</b> from the clipboard form or the close-up.' },
    { title: 'Safety counts', art: 'dana', text: 'An office is a workplace, so OSHA\'s rules matter for whoever works here next: <b>exits</b> that open, lit <b>EXIT signs</b>, charged <b>extinguishers</b>, a clear <b>electrical panel</b>, no live wires. Check the <b>yellow Safety</b> button in a close-up. <b>Dana</b> is tagging along; talk to her for tips. Hit <b>Finish</b> in the toolbar when you\'re done.' }
  ];
  const SOP_O = `
    <div class="pg title-pg">
      <p class="pg-co">BRICKROAD PROPERTY MGMT.</p>
      <h2>Standard Operating Procedure 7.1</h2>
      <p class="pg-sub">Commercial Lease-End Condition Codes</p>
      <p class="pg-note">Keep this binder in the truck. Do not use it to prop open a fire door.</p>
      <span class="coffee" aria-hidden="true"></span>
    </div>
    <div class="pg">
      <h3>The four codes</h3>
      <div class="sop-cat c0" data-sop="c0"><b>0 &middot; Clean / No Action</b><p>Works, looks as expected, and was surrendered the way the lease asks: broom-clean, the tenant's things gone, alterations restored. Nothing to do.</p></div>
      <div class="sop-cat c1" data-sop="c1"><b>1 &middot; Normal Wear &amp; Tear</b><p>What years of ordinary business do: traffic lanes and caster wear in carpet tile, scuffs at chair height, thumbtack and small screw holes (&frac14;&Prime; or less), a burned-out tube, yellowed plastic, a dull floor finish. <em>Never charged to the security deposit.</em></p></div>
    </div>
    <div class="pg">
      <div class="sop-cat c2" data-sop="c2"><b>2 &middot; Tenant Damage</b><p>Harm from accident, neglect, or misuse (stains, burns, gouges, smashed fixtures, holes over &frac14;&Prime;), <b>plus</b> the tenant's alterations and property left unrestored: cut-in cable holes, card readers, signage, abandoned cabling, storage, a fridge full of lunches. <em>Charged to the deposit, and only with a photo.</em></p></div>
      <div class="sop-cat c3" data-sop="c3"><b>3 &middot; Maintenance Hazard</b><p>Anything that could hurt the next person through the door: an exit that won't open, a dark exit sign, an empty extinguisher, live parts, active leaks, fumes, things that could fall or tip, trip hazards in an exit route. <em>Emergency work order and a photo.</em> A hazard is coded 3 even if the tenant caused it; billing comes after.</p></div>
    </div>
    <div class="pg sop-tips">
      <h3>Alterations and cabling</h3>
      <ul>
        <li><b>The lease decides.</b> Most leases make the tenant remove what they added unless the landlord agreed in writing to keep it.</li>
        <li><b>Cabling comes out.</b> Data cable left in floor boxes, ceilings, or racks is the tenant's to remove (and so is anything hung from sprinkler pipe).</li>
        <li><b>Holes they cut, they patch:</b> desks, frames, walls. A tidy patch is wear; a torn one is damage.</li>
        <li><b>Signage</b> comes down and the wall gets restored. Glue scars and standoff holes are chargeable.</li>
        <li><b>Low voltage isn't a hazard.</b> Cut data or card-reader wire is a cleanup charge. Cut <b>power</b> wire is a hazard.</li>
      </ul>
    </div>
    <div class="pg sop-tips">
      <h3>Field method</h3>
      <ul>
        <li data-sop="look"><b>Look</b> at a feature to bring up a close-up. Then <b>touch</b>, <b>smell</b>, and <b>use tools</b> on its parts.</li>
        <li data-sop="measure"><b>Measure</b> holes, stains, and clearances. Size and distance often decide the code.</li>
        <li data-sop="smell"><b>Smell</b> catches what eyes miss: burning plastic, battery gas, mildew, chemicals.</li>
        <li data-sop="photo">Use the <b>clipboard</b> to mark a feature, and attach a <b>photo</b> to every damage or hazard finding.</li>
        <li data-sop="finish">When you've seen everything, hit <b>Finish</b> to file the lease-end report.</li>
      </ul>
    </div>
    <div class="pg sop-tips">
      <h3>Charges and photos</h3>
      <ul>
        <li data-sop="nophoto"><b>No photo, no charge.</b> A disputed charge without evidence gets dropped, and the landlord pays for the repair.</li>
        <li data-sop="age"><b>Old things are worth less.</b> Charge the life an item had left, not the price of a new one.</li>
        <li data-sop="wear"><b>Wear is the landlord's cost</b> of renting the space for eight years. If a charge turns out to be wear, take it off.</li>
        <li data-sop="promise"><b>Only the property manager</b> approves changes to the deposit statement.</li>
      </ul>
      <p class="pg-scrawl">fridge cleanouts ARE chargeable (ask Pat abt the 2006 one)</p>
    </div>
    <div class="pg sop-tips">
      <h3>OSHA in the office</h3>
      <ul>
        <li><b>We aren't OSHA.</b> We observe, report, require correction under the lease, and for anything imminent we clear the area and call it in.</li>
        <li><b>Exit doors</b> open from the inside without a key, tool, or special knowledge (29 CFR 1910.36(d)(1)); exit routes stay clear (29 CFR 1910.37(a)(3)).</li>
        <li><b>EXIT signs</b> stay lit, letters at least 6 inches tall (29 CFR 1910.37(b)(6) and (b)(7)).</li>
        <li><b>Extinguishers</b> are mounted, reachable, and fully charged (29 CFR 1910.157(c)(1) and (c)(4)), checked monthly (29 CFR 1910.157(e)(2)).</li>
      </ul>
    </div>
    <div class="pg sop-tips">
      <h3>OSHA in the office (cont.)</h3>
      <ul>
        <li><b>Panels</b> keep 30 inches wide by 3 feet deep clear, never storage (29 CFR 1910.303(g)(1)); live parts stay guarded (29 CFR 1910.303(g)(2)).</li>
        <li><b>Cords:</b> a damaged cord comes out of service (29 CFR 1910.334(a)(2)); no daisy-chained power strips (29 CFR 1910.303(b)(2)).</li>
        <li><b>Sprinklers:</b> 18 inches clear below every head (29 CFR 1910.159(c)(10)).</li>
        <li><b>Floors:</b> no trip hazards in walkways (29 CFR 1910.22(a)(3)).</li>
        <li><b>First aid</b> supplies readily available (29 CFR 1910.151(b)); the poster is up (29 CFR 1903.2).</li>
      </ul>
    </div>`;
  const BLANK_O = {
    web: { look: ['A cobweb. Even offices get them.'], any: "A cobweb. The cleaning crew's problem." },
    ceiling: {
      look: ['Acoustic ceiling tile on a white grid. Every office in America.', 'The drop ceiling. No stains, no gaps, no sag here.', 'Two-by-two ceiling tiles. You count them without meaning to. Old office habit.'],
      touch: "You can't reach it without a ladder.", smell: 'You sniff upward. Ceiling smells like ceiling.', talk: 'You address the ceiling. The ceiling has no comment, like most middle management.',
      hammer: "You'd need a ladder, and the tile's fine anyway.", flashlight: 'You sweep the beam across the tiles. Clean, dry, seated.', camera: 'A photo of a perfectly good ceiling. The file can live without it.',
      clipboard: 'The ceiling looks fine. Nothing to mark.', any: 'The ceiling. Nothing wrong with it.'
    },
    window: { look: ['The window frame: anodized aluminum, solidly sealed.', 'Window frame. The glass is where the view is.'], touch: 'Solid. No drafts.', smell: 'Outside air, faintly.', talk: "You tell the window it's doing a great job.", flashlight: 'Clean seals along the frame.', camera: 'Try the glass itself for a better shot.', clipboard: 'The frame is fine. Nothing to mark.', any: "It's the window frame. Look at the glass for a closer view." },
    frosted: { look: ['Frosted glass.'], any: 'Frosted glass. Nothing to see, on purpose.' },
    wall: {
      look: ['Just wall. Builder-grade eggshell.', 'Plain painted drywall. Nothing wrong with it.', 'Nothing special there.'],
      touch: 'Smooth, dry, solid. Just a wall.', smell: 'Faint paint smell, and toner. Every office smells a little of toner.', talk: 'You talk to the wall. It has heard every meeting in this suite. It says nothing.',
      hammer: 'Tap, tap. A metal stud behind it. Solid.', flashlight: 'Raking light across the wall: no patches, no holes. Clean.', camera: 'A photo of plain wall. Not useful.', clipboard: "There's nothing there to mark.", any: 'Nothing there.'
    }
  };
  const DANA_TOPICS_O = [
    { q: 'Any tips for this room?', a: () => {
      const todo = FEATURES.filter(f => f.room === Game.room && !Game.marks[f.id]);
      if (!todo.length) return "You've marked everything in here. Next room? Or poke around. Little stuff counts too.";
      const f = todo[Game.hintIx++ % todo.length]; Game.danaPoint(f.id);
      return `The ${lower(f.name)}: ${f.hint} I'll show you.`;
    } },
    { q: "What's the difference between wear and damage?", a: () => "Wear is what eight years of business does: carpet lanes, chair scuffs, small screw holes, burned-out tubes. Damage is what an accident or carelessness does, plus anything they added and didn't put back: cable holes, their sign, a card reader, abandoned cabling. Wear is on the landlord. Damage comes out of the deposit, with a photo." },
    { q: 'When is something a hazard?', a: () => "If it could hurt whoever works here next: an exit you can't open, a dark exit sign, an empty extinguisher, live wires, a leak, fumes, something that could fall or tip, a trip hazard by the door. It's a hazard even if the tenant caused it. Safety first, billing later." },
    { q: 'Does OSHA even care about an empty suite?', a: () => "OSHA covers employers and their workers, not buildings. But somebody works here next: the cleaners, the electrician, the next tenant's whole staff. So the real rules still matter: exits, exit signs, extinguishers, panel clearance, live parts. The binder has the list, and every close-up's yellow Safety button has the details." },
    { q: 'Why all the photos?', a: () => "Commercial tenants dispute deposits with lawyers, not phone calls. No photo, no charge. And maintenance needs pictures of hazards before they send someone out." },
    { q: 'How are we doing?', a: () => {
      const done = Object.keys(Game.marks).length;
      const cold = Object.keys(ROOMS).filter(id => !FEATURES.some(f => f.room === id && Game.seen.has(f.id))).map(id => ROOMS[id].name.toLowerCase());
      return `You've written up ${done} ${done === 1 ? 'thing' : 'things'} so far. How many are left? No idea, boss. That's why they send an inspector.` +
        (cold.length ? ` You haven't really looked around the ${list(cold)} yet.` : ' Did you open every cabinet, work every lock, and look up at the ceilings?');
    } },
    { q: 'Can I borrow your BlackBerry?', a: () => { setTimeout(() => { UI.close('dialogueScreen'); BlackBerry.open(); }, 900); return BlackBerry.pending().length ? "For Gus? Sure. He's under GUS (MAINT). Don't read my texts." : "Sure. Don't read my texts. ...You're going to read my texts."; } },
    { q: 'So... how are you?', a: () => DANA_SMALLTALK[Game.smallTalk++ % DANA_SMALLTALK.length] },
    { q: "Let's get back to it.", a: null }
  ];
  /* sub-par but defensible calls: partial credit (js/partial-marks.js) */
  const ACCEPTABLE_O = {
    o_plantring: [1], o_bellmark: [1], o_pushpins: [1], o_tapemarks: [1], o_coffeering: [1], o_zipties: [1], o_velcro: [1], o_oldstain: [1],
    o_tackholes: [0], o_brochure: [0], o_dents: [0], o_floorscuff: [0], o_chairscuff: [0],
    'o_ceiling:1': [0], 'o_troffer:1': [0], 'o_minisplit:1': [0], 'o_sprinkler:1': [0], 'o_gfci:1': [0], 'o_firstaid:1': [0], 'o_panel:1': [0], 'o_rack:1': [0], 'o_floorbox:1': [0], 'o_exitsign:1': [0]
  };
  /* close-up parts that only exist in one condition */
  const EXTRAS_O = {
    o_sink: { parts: () => Game.cond.o_sink === 2 ? [{ id: 'tap', name: 'little chrome tap', r: [176, 8, 18, 20] }] : [] },
    o_floorbox: { parts: () => Game.cond.o_floorbox === 2 ? [{ id: 'lid', name: 'cut cables', r: [150, 64, 90, 64] }] : [] },
    o_panel: { parts: () => Game.cond.o_panel === 2 ? [{ id: 'floor', name: 'boxes in front of the panel', r: [48, 44, 142, 91] }] : [] }
  };
  /* the tap's own responses ride on the sink's variant 2 */
  FEATURES_O.find(f => f.id === 'o_sink').variants[2].resp.tap = {
    look: { t: 'A little chrome instant-hot tap, set in a hole the tenant drilled through the counter. A red dot for HOT.', clue: 'hole' },
    touch: { t: 'You press it. A trickle of lukewarm water. The tank under the sink is unplugged.', clue: 'hole' }, tape: { t: 'The hole under its base is 1 3/8 inches, drilled clean through the laminate.', clue: 'hole' }
  };

  /* ============================== REGISTER ============================== */
  Sites.register({
    music: 'office',
    id: 'office', place: 'Suite', kind: 'Commercial Offices', tag: 'A Lease-End Inspection Adventure',
    form: 'LEASE-END INSPECTION', report: 'Lease-End Report',
    start: 'o_lobby',
    calls: false,   // the apartment's deposit calls are about residents and an $800 deposit; a business tenant's dispute is a letter from counsel
    words: { tenant: 'tenant', deposit: 'security deposit', damage: 'tenant damage', where: 'suite', manager: 'Pat' },
    opener: unit => `Suite ${unit}! Synergex moved out Friday, and the landlord wants to know what comes out of their security deposit. Walls, floors, ceilings, the server room, all of it. If they broke it or didn't put it back, write it up; if it could hurt somebody, flag it. Finish is up top, boss.`,
    ppe: null,      // nothing to suit up for in an office (you would look very silly in a hard hat)
    sop: SOP_O,
    title: A.title,
    tables: {
      ROOMS: ROOMS_O, FEATURES: FEATURES_O, ZOOM_ART: A.ZOOM, ANOMALIES: ANOMALIES_O,
      CLUTTER: CLUTTER_O, ITEM_SPRITES: A.SPRITES, BAG_TEXT: BAG_TEXT_O, BAG_COMBOS: BAG_COMBOS_O,
      FLOOR_CLUTTER: [...Object.keys(CLUTTER_O), 'stapler'],
      SURFACE_OK: ['o_tps', 'o_zipdisk', 'o_bossmug', 'o_nameplate', 'o_trophy', 'o_plant', 'o_cardfile', 'o_keyboard', 'stapler'],
      CLUTTER_SPOTS: {
        o_lobby: [[-4.2, 6.6], [3.4, 6.0], [4.6, 8.6], [1.6, 8.8], [-1.4, 6.0], [2.8, 10.8], [-4.6, 1.31, 9.3, 'counter'], [-3.4, 1.31, 9.3, 'counter']],
        o_open: [[-5, 6.4], [4.6, 6.4], [-2.6, 10.2], [2.4, 12], [5.6, 12.6], [-5.6, 12.2], [.6, 6.2], [-.6, 12.6]],
        o_break: [[-3.2, 6.4], [3.2, 6.2], [1.4, 8.8], [-.8, 7.4], [-3.6, .962, 11.15, 'counter'], [-.1, .962, 11.0, 'counter'], [2.4, .962, 11.1, 'counter']],
        o_server: [[-2.6, 6.4], [2.6, 6.4], [-.8, 7.6], [3.2, 7.4], [2.45, 1.31, 9.1, 'counter']]
      },
      GHOST_SPANS: { o_lobby: [{ side: 'left', z0: 9.2, z1: 12.2 }], o_open: [{ side: 'right', z0: 6, z1: 9.2 }] },
      PAINTS: {
        o_lobby: [['Agreeable greige', '#cfc6b6'], ['Gray-blue', '#a9b6c4'], ['Builder white', '#ece8de'], ['Mocha', '#bfae96']],
        o_open: [['Builder white', '#e9e5da'], ['Greige', '#c9c1b2'], ['Gray-blue', '#b2bfcc'], ['Pale sage', '#c4cbb6']],
        o_break: [['Builder white', '#ebe7dc'], ['Latte', '#d2bf9f'], ['Gray-blue', '#a8b8c6'], ['Pistachio', '#c9d3a4']],
        o_server: [['Builder white', '#e6e2d8'], ['Primer gray', '#c7c7c2'], ['Greige', '#cbc3b4']]
      },
      ACCENTS: { o_lobby: ['#5a6b80', '#7a4a3a', '#3f5a5a'] },
      FLOORS: {
        o_lobby: [['#b8b4ac', '#aaa69e', '#8f8b84'], ['#c9c0b0', '#bcb3a2', '#9a917f'], ['#9ea3a8', '#92979c', '#7a7f84']],
        o_open: [{ base: '#6f7a8a', dk: '#5f6a7a', lt: '#828c9c' }, { base: '#7d7a72', dk: '#6c6961', lt: '#8f8b82' }, { base: '#5f6e66', dk: '#515f58', lt: '#71807a' }, { base: '#857a82', dk: '#736870', lt: '#968c94' }],
        o_break: [['#e4dcc8', '#b8c4c8', '#c8c0ac'], ['#ece6d6', '#c8b89a', '#d0c8b4'], ['#dcdcd4', '#a8b4a0', '#c4c4bc']],
        o_server: [{ base: '#a8a69e', dk: '#96948c', lt: '#bab8b0' }, { base: '#9a9c9e', dk: '#8a8c8e', lt: '#acaeb0' }]
      },
      DOORS: OFD.DOORS, CONTAINERS: OFD.CONTAINERS, ROOM_TOUCH: OFD.ROOM_TOUCH,   // the break room's cabinets and fridge (js/sites/office-doors.js)
      BRIEFING: BRIEFING_O, BLANK: BLANK_O, DANA_TOPICS: DANA_TOPICS_O, ACCEPTABLE: ACCEPTABLE_O, EXTRAS: EXTRAS_O,
      ROOM_TOUCH: { o_fridge: 'handle', o_microwave: 'door', o_firstaid: 'cabinet', o_extinguisher: 'door' },
      UNITS: ['110', '118', '206', '212', '300', '315', '402', '410', '501', '515']
    }
  });
})();
