'use strict';
/* ============================== LOT 204: THE CREW ==============================
   The tenant's people at work during the safety walk (drawn by js/crew.js): a dock hand, a picker in the racks, the
   saw and belt-machine operators and two packers on the floor, and the mechanics in the shop. Their gear follows the
   area's conditions (no earmuffs when the hearing protection station is empty; the saw operator's glasses are on the
   bench when that little find turns up), and the ones in a finding's story show up with it (someone reaching into the
   belt, a mechanic under the hoisted gearbox). INDC.attach() in js/sites/industrial.js gives each area its crew, the
   walk-around blocks for its machines, and the crew you can Look at and Talk to. */
const INDC = (() => {
  const GP = INDA.G.prod, GS = INDA.G.shop, GR = INDA.G.racks, D = INDA.G.dock;
  const has = id => Anomalies.active(Game.room).some(a => a.id === id);   // a small find that's out this shift
  const CREW = {
    i_dock: () => [
      { id: 'dockhand', x: .2 + Math.sin(Game.t * .35) * .9, z: 13.6, o: { act: 'walk', face: Math.cos(Game.t * .35) > 0 ? 1 : -1, shirt: '#3a5a7a', hat: false, hair: '#2a1a10' } }
    ],
    i_racks: () => [
      { id: 'picker', x: -1.6, z: 13.4 + Math.sin(Game.t * .25) * .8, o: { act: 'walk', face: 1, shirt: '#5a7a4a', hat: '#f4f4ee' } }
    ],
    i_floor: () => {
      const nv = cond('i_noise'), muffs = nv < 2, bv = cond('i_belt');
      return [
        { id: 'sawop', x: (GP.saw[0] + GP.saw[1]) / 2, z: GP.saw[2] - .45, o: { act: 'saw', face: -1, hat: false, hair: '#4a2a1a', muffs, glasses: !has('i_a_glasses'), shirt: '#6a5a8a' }, block: true },
        { id: 'beltop', x: GP.belt[0] - .45, z: (GP.belt[2] + GP.belt[3]) / 2, o: { act: bv === 3 ? 'reach' : 'idle', face: 1, hat: false, hair: '#1a1a1a', muffs, shirt: '#3a6a8a' }, block: true },
        { id: 'packer1', x: -4.2, z: GP.conv[2] - .5, o: { act: 'reach', face: 1, hat: false, hair: '#6a4a2a', muffs, shirt: '#8a5a5a' } },
        { id: 'packer2', x: -1.6, z: GP.conv[2] - .5, o: { act: 'reach', face: -1, hat: false, hair: '#2a2a2a', muffs, shirt: '#5a6a8a' } }
      ];
    },
    i_shop: () => {
      const lv = cond('i_loto'), hv = cond('i_hoist'), out = [{ id: 'grinder', x: -1.4, z: 14.75, o: { act: 'saw', face: 1, hat: false, hair: '#3a2a1a', shirt: '#4a5a3a' } }];
      if (lv < 3) out.push({ id: 'diaz', x: -4.55, z: (GS.press[0] + GS.press[1]) / 2, o: { act: 'reach', face: -1, hat: false, hair: '#2a1a10', shirt: '#2a4a7a' }, block: true });
      if (hv === 3) out.push({ id: 'under', x: GS.hoist.x, z: GS.hoist.z + .2, o: { act: 'reach', face: 1, hat: false, hair: '#5a3a1a', shirt: '#6a6a6a' } });
      return out;
    }
  };
  /* the machines and fixtures standing inside the walkable floor */
  const BLOCKS = {
    i_dock: () => [{ ...D.fork, h: 3.4 }, { x0: D.rack.x0, x1: D.rack.x1, z0: D.rack.z - .35, z1: D.rack.z + .1, h: 2.7 }],
    i_racks: () => { const [x, z] = cond('i_ladder') === 1 ? [-.4, 10.4] : GR.ladder; return [{ x0: x - .1, x1: x + 1.1, z0: z, z1: z + 1.1, h: 3.5 }]; },
    i_floor: () => [{ x0: GP.saw[0], x1: GP.saw[1], z0: GP.saw[2], z1: GP.saw[3], h: 1.9 }, { x0: GP.belt[0] - .25, x1: GP.belt[1], z0: GP.belt[2], z1: GP.belt[3], h: 2.5 }],
    i_shop: () => []
  };
  const TALK = {
    i_dock: [['dockhand', 'Dock hand', { x: .2, z: 12.6 }, 'A dock hand pacing between the doors with a scanner gun, waiting on the next trailer.', '"Truck\'s late. Truck is always late." They scan a box out of boredom. It beeps.']],
    i_racks: [['picker', 'Order picker', { x: 0, z: 12.4 }, 'An order picker working down the aisle with a scanner and a cart.', '"Aisle four, bay three, level two." They don\'t look up. "Sorry. Quota."']],
    i_floor: [['sawop', 'Saw operator', { x: -3.2, z: 6.8 }, 'The cut-off saw operator, feeding stock one piece at a time.', '"Hang on." The saw spins down. "Safety walk? Glasses are on. Mostly." The saw spins up again.'],
      ['packer1', 'Packer', { x: -3.6, z: 11.6 }, 'A packer boxing parts off the conveyor, fast.', '"Twelve hundred a shift. Talk while I pack." They do not slow down.']],
    i_shop: [['diaz', 'R. Diaz, maintenance', { x: -3.8, z: 11.6 }, 'R. Diaz from maintenance, elbow-deep in the punch press with a wrench.', '"Locked it out myself. Key\'s in my pocket." They pat it. "Nobody turns this on but me."'],
      ['grinder', 'Mechanic', { x: -.6, z: 14.2 }, 'A mechanic at the bench grinder, dressing a chisel. Face shield down.', '"One sec." Sparks. "Okay. What\'s up?"']]
  };
  function attach(rooms) {
    for (const [id, r] of Object.entries(rooms)) {
      const crew = CREW[id]; if (!crew) continue;
      const art = r.dynamic;
      r.crew = crew;
      const lamps = { i_dock: [[-4.5, 12.5], [0, 12.5], [4.5, 12.5]], i_racks: [[-2.4, 6], [2.4, 11.5]], i_floor: [[-3, 6.5], [3, 12]], i_shop: [[.4, 9]] }[id] || [];
      r.dynamic = (g, room, t) => { art && art(g, room, t); for (const [x, z] of lamps) AmbFX.motes(g, t, x, z); Crew.draw(g, crew(), t); };   // dust drifting under the lights, then the crew
      r.blocks = () => [...(BLOCKS[id] ? BLOCKS[id]() : []), ...Crew.blocks(crew())];
      r.scenery = [...(r.scenery || []), ...(TALK[id] || []).map(([who, name, walk, look, talk]) => Crew.hot(crew, who, name, walk, look, talk))];
    }
  }
  return { CREW, BLOCKS, attach };
})();

/* ============================== LOT 204: THE SHOP LOCKERS ==============================
   Three gray employee lockers against the shop's back wall, run by js/openables.js: each swings open on its hinge
   to a shelf, a coat hook, and sometimes something its owner left. The closed lockers are drawn in the room
   layer (INDL.draw, called from the shop's walls); open ones are drawn live by the engine. */
const INDL = (() => {
  const COL = { front: '#5a6a8a', inner: '#4e5c78', box: '#23262e', back: '#2e323c' };
  const NAMES = ['T. NGUYEN', 'R. DIAZ', 'B. KOWALSKI'];
  const LOOKS = ['A gray steel employee locker with a name strip: T. NGUYEN. A sticker on the door says I SURVIVED INVENTORY 2007.',
    'A gray steel employee locker: R. DIAZ. A magnet on it holds a kid\'s drawing of a forklift.',
    'A gray steel employee locker: B. KOWALSKI. Somebody wrote GO BEARS on the vent slats.'];
  const lockers = [0, 1, 2].map(i => ({ id: 'lk' + (i + 1), name: 'Locker', kind: 'swing', hinge: 'l', x0: -5.07 + i * .6, x1: -4.51 + i * .6, y0: .16, y1: 2.44, z: 15.45, depth: .46, col: COL, inside: 'locker',
    shelves: [2.1], shelfCol: '#6a7488', walk: { x: -4.8 + i * .6, z: 14.4 }, look: LOOKS[i],
    drawInside: (g, d) => { const h = P((d.x0 + d.x1) / 2, 1.95, d.z + d.depth * .8); pxRect(g, h[0] - 1, h[1], 2, 2, '#a8acb4');
      if (i === 0) { const a = P(d.x0 + .12, 1.9, d.z + d.depth * .7), b = P(d.x1 - .12, .9, d.z + d.depth * .7); pxRect(g, a[0], a[1], b[0] - a[0], b[1] - a[1], '#2a4a7a'); }   // a work jacket on the hook
      if (i === 1) { const p = P((d.x0 + d.x1) / 2, 2.12, d.z + d.depth * .5); pxRect(g, p[0] - 3, p[1] - 3, 7, 3, '#f2c418'); pxRect(g, p[0] - 4, p[1] - 1, 9, 1, '#d8aa0a'); }   // a spare hard hat on the shelf
      if (i === 2) { const p = P(d.x0 + .1, 1.5, d.z + d.depth * .99); pxRect(g, p[0], p[1], 4, 5, '#f4f2ea'); pxRect(g, p[0] + 1, p[1] + 1, 2, 2, '#c85a7a'); } } }));   // a photo taped to the back wall
  /* the closed lockers, painted into the room: one cabinet body, three doors with vents, handles, and name strips */
  function draw(g, r) {
    box3(g, -5.12, -3.28, .1, 2.5, 15.43, 15.95, { front: '#4a5874', side: '#3e4a62', top: '#6a7896' });
    box3(g, -5.12, -3.28, 0, .1, 15.5, 15.95, { front: '#2a2e36' });
    lockers.forEach((d, i) => {
      fillPoly(g, Openables.opening(d), COL.front); strokePoly(g, Openables.opening(d), '#3a465e');
      for (let y = 2.25; y > 1.95; y -= .07) lineW(g, P(d.x0 + .12, y, d.z), P(d.x1 - .12, y, d.z), '#3e4a62');   // vent slats
      const hd = P(d.x1 - .08, 1.2, d.z); pxRect(g, hd[0] - 1, hd[1] - 3, 2, 6, '#c8ccd4');
      const n = Q.back({ ...r.box, zb: d.z }, d.x0 + .1, d.x1 - .1, 1.7, 1.8); fillPoly(g, n, '#f4f2ea');
    });
  }
  const CONTAINERS = { i_lk1: { doors: ['lk1'], items: ['i_gloves', null] }, i_lk2: { doors: ['lk2'], items: ['i_cooler', 'i_radio', null] }, i_lk3: { doors: ['lk3'], items: ['i_tapegun', null, null] } };
  return { DOORS: { i_shop: lockers }, CONTAINERS, NAMES, draw, block: { x0: -5.12, x1: -3.28, z0: 15.43, z1: 15.95, h: 2.5 } };
})();
