'use strict';
/* ============================== CREW ==============================
   The people who work at the industrial and construction sites (the apartment and the office are empty, mid-turnover):
   small figures drawn at their spot in a room, wearing whatever PPE the room's conditions give them, and animated
   (hammering, sawing, shoveling, walking) off the game clock. An area lists its crew from its conditions; a crew
   member who stands still can be a walk-around block (js/obstacles.js) and a hotspot you can Look at and Talk to. */
const R_CREW = (g, x, y, w, h, c) => pxRect(g, x, y, Math.max(1, w), Math.max(1, h), c);   // a pixel rectangle, never thinner than a pixel
const Crew = {
  /* ---------- people, seen across the yard: a hard hat, glasses, a vest, jeans, and boots (or not) ----------
     o: y (standing height; negative down in the trench), shirt, vest (false = none, 'open' = unzipped), hat (a color,
     false = bare head, 'back' = worn backwards), glasses (false = none), muffs, kneel, smoke, face (1 right, -1 left),
     act: what they're doing, animated off t: 'idle' (a breath now and then), 'walk' (carrying a board), 'hammer',
     'saw' (pushing a saw through a cut), 'shovel', 'reach' (an arm out, working at an edge), 'phone' */
  person(g, x, z, o = {}, t = 0) {
    // drawn with the same sprite style as you and Dana (js/crew-sprites.js), at the same size you'd be standing there
    const mo = Settings.get('motion'), [sx, sy] = P(x, o.y || 0, z), k = clamp(.62 + 2.4 / z, .78, 1.14), seed = o.seed ?? Math.round(Math.abs(x * 7 + z * 13));   // who they are (from their id), never where they're standing, so nobody changes face mid-stride
    let act = o.act || 'idle'; if (o.carry) act = 'carry'; if (o.smoke && act === 'idle') act = 'smoke';
    const rate = { hammer: 4, saw: 5, shovel: 1.6, reach: 1.5, smoke: .25 }[act] || 0, frame = mo && rate ? Math.floor(t * rate + seed) % (act === 'hammer' ? 3 : 2) : 0;
    const walking = act === 'walk' || (act === 'carry' && o.moving !== false && o.act === 'walk'), ph = mo ? t * 6 + seed : 0;
    const spec = { look: o.look ?? seed % CREW_LOOKS.length, shirt: o.shirt, pants: o.pants, hat: o.hat, vest: o.vest, glasses: o.glasses, muffs: !!o.muffs, gloves: !!o.gloves, beard: !!o.beard, flannel: !!o.flannel, kneel: !!o.kneel,
      act: act === 'walk' ? 'idle' : act, frame, step: walking ? Math.round(Math.sin(ph) * 2) / 2 : 0, bob: walking && Math.abs(Math.sin(ph)) > .7 ? -1 : 0,
      breath: !walking && mo && Math.floor(t / 1.2 + seed) % 2 === 1, blink: (t * 1000 + seed * 977) % 4100 < 130 };
    const spr = CrewSprites.get(spec, k), w = spr.width, h = spr.height;
    g.fillStyle = ditherPx('#1a1222', 9); g.beginPath(); g.ellipse(sx, sy - 1, 11 * k, 3 * k, 0, 0, 7); g.fill();   // a contact shadow, like everyone else's
    g.save(); g.imageSmoothingEnabled = false;
    if ((o.face || 1) < 0) { g.translate(Math.round(sx), 0); g.scale(-1, 1); g.drawImage(spr, Math.round(-w / 2), Math.round(sy - h + 2), w, h); }
    else g.drawImage(spr, Math.round(sx - w / 2), Math.round(sy - h + 2), w, h);
    g.restore();
    if (o.smoke && mo) for (let i = 0; i < 3; i++) R_CREW(g, sx + (o.face || 1) * 7 * k + Math.round(Math.sin(t * 2 + i) * 2), sy - (SPR_H - 14) * k - i * 3 - Math.floor(t * 6 % 3), 1, 1, 'rgba(220,220,220,0.7)');
  },
  /* everyone in an area: [{ id, x, z, o, block?, clip? }] from the area's conditions, drawn live so they move */
  draw(g, list, t, clip) { for (const c of list.slice().sort((a, b) => b.z - a.z)) { const o = { seed: [...c.id].reduce((a, ch) => a + ch.charCodeAt(0), 0), ...c.o }; if (c.clip && clip) clipDo(g, clip, () => this.person(g, c.x, c.z, o, t)); else this.person(g, c.x, c.z, o, t); } },
  /* a person's screen outline (for hotspots and for standing in front of the player) */
  pts(c) { const [sx, sy] = P(c.x, c.o.y || 0, c.z), k = clamp(.62 + 2.4 / c.z, .78, 1.14), w = (/saw|reach|hammer|shovel|carry/.test(c.o.act || '') || c.o.carry ? 19 : 13) * k; return [[sx - w, sy - (SPR_H - 4) * k], [sx + w, sy - (SPR_H - 4) * k], [sx + w, sy], [sx - w, sy]]; },
  /* the still ones, as walk-around blocks (js/obstacles.js) */
  blocks(list) { return list.filter(c => c.block).map(c => ({ x0: c.x - .25, x1: c.x + .25, z0: c.z - .2, z1: c.z + .2, pts: () => this.pts(c) })); },
  /* a crew member as a hotspot you can Look at and Talk to: crewFn returns the area's crew, who picks one out */
  hot(crewFn, who, name, walk, look, talk, extra) {
    return { id: 'crew_' + who, name, walk, look, talk, live: true, when: () => crewFn().some(c => c.id === who), pts: () => { const c = crewFn().find(p => p.id === who); return c ? this.pts(c) : [[0, 0], [1, 0], [1, 1]]; }, ...(extra || {}) };
  }
};
