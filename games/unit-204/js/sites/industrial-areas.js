'use strict';
/* ============================== LOT 204: THE OTHER THREE AREAS ==============================
   The racking aisle, the production floor, and the maintenance shop: their hotspots, their checklists (what every
   sense and tool finds), the small finds, what gets left behind, and the paperwork the site shares (the four safety
   codes, the briefing, and the SOP). js/sites/industrial.js folds all of this in with the loading dock and registers
   the site. The drawing is in js/sites/industrial-art2.js. Every id starts with i_. */
const INDX = (() => {
  const GR = INDA.G.racks, GP = INDA.G.prod, GS = INDA.G.shop;
  const BOX = { x0: -6.5, x1: 6.5, h: 6.5, zb: 16 };
  const Qx = (x, za, zb, ya, yb) => [P(x, ya, za), P(x, ya, zb), P(x, yb, zb), P(x, yb, za)];
  const around = (p, w, h, dy = 0) => [[p[0] - w / 2, p[1] - h / 2 + dy], [p[0] + w / 2, p[1] - h / 2 + dy], [p[0] + w / 2, p[1] + h / 2 + dy], [p[0] - w / 2, p[1] + h / 2 + dy]];
  const area = (name, extra) => ({ name, box: { ...BOX }, amb: .5, cmu: 2.4, metal: '#c8ccd0', floor: () => {}, floorBase: p => p.floor.base, shell: INDA.shell, windows: [], ...extra });

  /* ============================== AREAS ============================== */
  const ROOMS = {
    i_racks: area('Racking Aisle', {
      walk: { x0: -3.9, x1: 3.9, z0: 4.6, z1: 15 }, start: { x: -3.4, z: 5.6 },
      doors: [
        { id: 'i_racksToDock', back: GR.doors[0], to: 'i_dock', name: 'Loading dock', walk: { x: -3.1, z: 14.6 }, spawn: { x: 5.2, z: 11.4 } },
        { id: 'i_racksToFloor', back: GR.doors[1], to: 'i_floor', name: 'Production floor', walk: { x: 3.1, z: 14.6 }, spawn: { x: -5.2, z: 9.2 } }
      ],
      features: {
        i_upright: { pts: () => hull([...Qx(-4.4, 7.1, 7.9, 0, 5.6), P(-4.2, 0, 7.2), P(-4.2, .7, 7.2)]), walk: { x: -3.4, z: 6.8 } },
        i_plaque: { pts: () => Qx(GR.face, GR.bays[0], GR.bays[1], .9, 3.3), walk: { x: 3.4, z: 7.4 } },
        i_beamlock: { pts: () => Qx(-GR.face, GR.bays[1], GR.bays[2], 3.0, 5.6), walk: { x: -3.3, z: 9.8 } },
        i_aisle: { pts: () => hull([...Q.back(ROOMS.i_racks.box, -1, 1, 0, 3.6), P(-1.6, 0, 11.5), P(1.6, 0, 11.5)]), walk: { x: 0, z: 12.6 } },
        i_sprinkrack: { pts: () => Qx(GR.face, GR.bays[1], GR.bays[3], 4.4, 6.5), walk: { x: 3.4, z: 10.4 } },
        i_ladder: { pts: () => { const [x, z] = cond('i_ladder') === 1 ? [-.4, 10.4] : GR.ladder; return hull(boxPts(x - .1, x + 1.1, 0, 3.5, z, z + 1.1)); }, walk: { x: 1.4, z: 10 } }
      },
      scenery: [
        { id: 'i_s_mirror', name: 'Aisle mirror', pts: () => around(P(-3.2, 3.6, 15.7), 12, 12), walk: { x: -2.8, z: 14.6 },
          look: 'A convex mirror up on the back wall, so a forklift and a person can see each other coming around the end of the rack.', touch: "Out of reach. It's angled right, at least." },
        { id: 'i_s_racksign', name: 'Aisle sign', pts: () => around(P(0, 5.3, 12), 16, 12, 4), walk: { x: 0, z: 10.6 },
          look: 'AISLE 4. Somebody stuck a smiley face sticker on the 4.', touch: 'Way up there.' }
      ],
      walls: INDA.racks.walls, dynamic: INDA.racks.dynamic
    }),
    i_floor: area('Production Floor', {
      walk: { x0: -5.8, x1: 5.8, z0: 4.6, z1: 12.4 }, start: { x: -5.2, z: 5.5 },
      doors: [
        { id: 'i_floorToRacks', side: 'left', za: GP.doors[0], zb: GP.doors[1], to: 'i_racks', name: 'Racking aisle', walk: { x: -5.8, z: 9.2 }, spawn: { x: 3.1, z: 14.2 } },
        { id: 'i_floorToShop', side: 'right', za: GP.doors[0], zb: GP.doors[1], to: 'i_shop', name: 'Maintenance shop', walk: { x: 5.8, z: 9.2 }, spawn: { x: -4.4, z: 9.0 } }
      ],
      features: {
        i_saw: { pts: () => hull(boxPts(GP.saw[0], GP.saw[1], 0, 1.8, GP.saw[2], GP.saw[3])), walk: { x: -3.7, z: 7.4 } },
        i_belt: { pts: () => hull(boxPts(GP.belt[0] - .25, GP.belt[1], 0, 2.4, GP.belt[2], GP.belt[3])), walk: { x: 4.1, z: 8.4 } },
        i_conveyor: { pts: () => hull(boxPts(GP.conv[0] - .3, GP.conv[1] + .4, 0, 1.9, GP.conv[2], GP.conv[3])), walk: { x: -2.4, z: 12.2 } },
        i_noise: { pts: () => Q.left(ROOMS.i_floor.box, GP.noise[0], GP.noise[1], .9, 3.0), walk: { x: -5.4, z: 10.6 } },
        i_airhose: { pts: () => Q.right(ROOMS.i_floor.box, GP.hose[0], GP.hose[1], 1.1, 3.0), walk: { x: 5.4, z: 11.2 } },
        i_exitdoor: { pts: () => Q.back(ROOMS.i_floor.box, GP.exit[0] - .1, GP.exit[1] + 1.3, 0, 3.6), walk: { x: 2.4, z: 12.2 } }
      },
      scenery: [
        { id: 'i_s_hazassess', name: 'Hazard assessment', pts: () => Q.back(ROOMS.i_floor.box, -6, -4.8, 2.2, 3.2), walk: { x: -5, z: 12 },
          look: "A posted PPE hazard assessment for the production floor, signed and dated: safety glasses at all times, hearing protection past the yellow line, face shields at the grinder. Exactly what 1910.132(d) asks for.", touch: 'Laminated. Somebody takes this seriously.' }
      ],
      walls: INDA.prod.walls, dynamic: INDA.prod.dynamic
    }),
    i_shop: area('Maintenance Shop', {
      walk: { x0: -4.9, x1: 4.6, z0: 4.6, z1: 14.6 }, start: { x: -4.6, z: 5.6 },
      doors: [{ id: 'i_shopToFloor', side: 'left', za: GS.door[0], zb: GS.door[1], to: 'i_floor', name: 'Production floor', walk: { x: -4.9, z: 9.0 }, spawn: { x: 5.2, z: 9.2 } }],
      features: {
        i_grinder: { pts: () => hull([...Q.back(ROOMS.i_shop.box, GS.bench[0], GS.bench[1], .8, 2.7), ...boxPts(GS.bench[0], GS.bench[1], .85, .95, 15.1, 16)]), walk: { x: -1.4, z: 14.4 } },
        i_chemshelf: { pts: () => Q.back(ROOMS.i_shop.box, GS.shelf[0], GS.shelf[1] + 1.1, 0, 3.9), walk: { x: 2.6, z: 14.4 } },
        i_flamcab: { pts: () => hull(boxPts(5.6, 6.5, 0, 2.6, GS.flam[0], GS.flam[1])), walk: { x: 4.4, z: 8.8 } },
        i_cylinders: { pts: () => hull([...boxPts(5.6, 6.5, 0, 2.6, GS.cyl[0], GS.cyl[1]), P(4.9, 0, 12.3)]), walk: { x: 4.4, z: 11.6 } },
        i_loto: { pts: () => hull([...boxPts(-6.5, -5.2, 0, 2.6, GS.press[0], GS.press[1]), ...Q.left(ROOMS.i_shop.box, GS.press[1] + .3, GS.press[1] + .8, 1.4, 2.1)]), walk: { x: -4.4, z: 11.6 } },
        i_hoist: { pts: () => { const { x, z } = GS.hoist; return hull([P(x - .4, 6, z), P(x + .4, 6, z), P(x + .4, 1.4, z), P(x - .4, 1.4, z)]); }, walk: { x: .4, z: 9.2 } }
      },
      scenery: [
        { id: 'i_s_shopext', name: 'Fire extinguisher', pts: () => Q.right(ROOMS.i_shop.box, 13.4, 13.9, .85, 2.15), walk: { x: 4.6, z: 13.4 },
          look: 'A 10-pound ABC extinguisher on its hook by the door. Tag punched in September.', touch: 'Full and heavy. Right where you need it.' }
      ],
      walls: INDA.shop.walls, dynamic: INDA.shop.dynamic
    })
  };

  /* ============================== THE CHECKLIST ============================== */
  const FEATURES = [
    /* ---------------- RACKING AISLE ---------------- */
    { id: 'i_upright', room: 'i_racks', name: 'Rack Upright & Guard', say: 'rack upright at the aisle end', art: 'i_upright',
      hint: 'Forklifts hit the ends of racks. Look at the column, the footplate, and its anchors.',
      osha: "There's no rack-specific OSHA rule; a damaged rack is cited under the General Duty Clause, and stored material has to be stable (1910.176(b)). Industry guidance (ANSI MH16.1) wants every upright anchored and damage inspected.",
      parts: [{ id: 'column', name: 'upright column', r: [104, 0, 30, 104] }, { id: 'plate', name: 'footplate and anchors', r: [92, 100, 52, 18] }, { id: 'guard', name: 'column guard', r: [56, 70, 38, 44] }, { id: 'beam', name: 'beams', r: [0, 26, 240, 18] }],
      base: { beam: { look: 'Orange box beams, locked into the upright.', touch: 'Solid.' }, '*': { talk: 'You ask the rack how much it can hold. It points at the plaque.' } },
      variants: [
        { cat: 0, desc: 'A blue rack upright at the end of the aisle, a yellow guard in front of it.', key: ['plumb'],
          resp: { column: { look: { t: 'Straight, no dents, paint intact.', clue: 'plumb' }, tape: { t: 'Dead plumb top to bottom.', clue: 'plumb' } }, plate: { look: { t: 'Two anchor bolts through the footplate into the slab, both tight.', clue: 'plumb' }, touch: 'Snug.' }, guard: { look: 'A yellow steel column guard, bolted down. Untouched.' } },
          why: 'Straight, anchored, and guarded. Nothing to do.' },
        { cat: 1, desc: 'A blue rack upright behind a column guard that has taken a few hits.', key: ['scuff'],
          resp: { guard: { look: { t: 'Gray scrapes across the yellow guard where forklifts kissed it. The guard did its job.', clue: 'scuff' }, touch: { t: 'Still bolted tight. Just scuffed.', clue: 'scuff' } }, column: { look: 'The upright behind it is straight and clean.', tape: 'Plumb.' }, plate: { look: 'Both anchors in.' } },
          why: "Scrapes on a column guard are the guard doing its job; the upright itself is fine. Note it." },
        { cat: 2, cost: 650, desc: 'The rack upright at the end of the aisle has a dent in it, at fork height.', key: ['dent', 'anchor'],
          resp: { column: { look: { t: 'A dent in the column face about two feet up, blue paint scraped to bright steel. A forklift strike.', clue: 'dent' }, tape: { t: 'The dent is 3/4 inch deep. The upright is still close to plumb.', clue: 'dent' }, touch: { t: 'A crisp crease. It should be flat.', clue: 'dent' } },
            plate: { look: { t: 'One anchor bolt is missing from the footplate. Just an empty hole in the slab.', clue: 'anchor' }, screwdriver: { t: 'Nothing to tighten. The bolt is gone.', clue: 'anchor' } } },
          why: 'A dented upright and a missing anchor weaken the whole bay. Correction: unload the bay and repair it to the rack maker\'s spec; the slab repair is charged back (General Duty Clause; 1910.176(b)). Photo it.' },
        { cat: 3, desc: "The rack upright at the end of the aisle doesn't look straight.", key: ['kink', 'lean'],
          resp: { column: { look: { t: 'The upright is kinked about three feet up, buckled and torn at the bend. Fully loaded pallets sit above it.', clue: 'kink' }, tape: { t: 'Out of plumb by four inches over its height. The bay is leaning.', clue: 'lean' }, touch: "You don't touch it. You back away from it." },
            beam: { look: { t: 'The beam over the kink sags where the upright gave.', clue: 'lean' } } },
          why: "A buckled upright under full loads can let a bay fold into the aisle at any moment. Stop: barricade the aisle, get people out from under it, unload from the top down, and call it in (General Duty Clause; 1910.176(b))." }
      ] },
    { id: 'i_plaque', room: 'i_racks', name: 'Capacity Plaque & Beams', say: 'capacity plaque and the first bay', art: 'i_plaque',
      hint: 'Every rack has a limit. Find where it is posted, then look at what is on the beams.',
      osha: 'Stored material is stacked so it is stable and secure (1910.176(b)). Capacity plaques come from industry guidance (ANSI MH16.1); an overloaded rack is a General Duty Clause citation.',
      parts: [{ id: 'plaque', name: 'capacity plaque', r: [2, 28, 34, 38] }, { id: 'beam', name: 'lower beam', r: [24, 66, 192, 24] }, { id: 'load', name: 'the load', r: [30, 0, 180, 66] }],
      base: { load: { smell: 'Cardboard and shrink wrap.' } },
      variants: [
        { cat: 0, desc: 'A capacity plaque on the upright, and a bay of cartons on straight beams.', key: ['posted'],
          resp: { plaque: { look: { t: 'MAX 4,000 LB PER LEVEL, evenly distributed. Clear and bolted on.', clue: 'posted' } }, beam: { look: { t: 'Straight as a ruler.', clue: 'posted' }, tape: { t: 'No sag you can measure.', clue: 'posted' } }, load: { look: 'Cartons on pallets, centered, well under the limit.' } },
          why: 'Posted, and loaded within it. Nothing to do.' },
        { cat: 1, desc: 'The capacity plaque is hard to read under a shipping label.', key: ['label'],
          resp: { plaque: { look: { t: 'Faded, and somebody slapped a shipping label half over it. You can just make out 4,000 LB.', clue: 'label' }, touch: { t: 'You peel the label back. The number is still there underneath.', clue: 'label' } }, beam: { look: 'Straight.' } },
          why: "The limit is still there, just hard to read. Note it: clean it up or replace the plaque so every operator can see it." },
        { cat: 2, cost: 120, desc: "There's no capacity plaque on this rack row.", key: ['blank'],
          resp: { plaque: { look: { t: 'Four little screw holes where a plaque used to be. Nothing now. No plaques anywhere down the row.', clue: 'blank' }, touch: { t: 'Bare paint.', clue: 'blank' } }, beam: { look: 'Straight, for now.' } },
          why: "Nobody can stay under a limit they can't see. Correction: post capacity plaques on every rack row; charged back (General Duty Clause; ANSI MH16.1 guidance). Photo it." },
        { cat: 3, desc: 'The beams in this bay are bowing under steel drums.', key: ['bow', 'drums'],
          resp: { beam: { look: { t: 'The beam sags in the middle like a hammock.', clue: 'bow' }, tape: { t: 'The beam is bowed down about 1 1/4 inches at the middle. Rack guidance says a beam this long should sag no more than about half an inch.', clue: 'bow' } },
            load: { look: { t: 'Full 55-gallon drums, two per pallet. That is roughly 1,600 pounds a pallet.', clue: 'drums' }, smell: 'Oil.' }, plaque: { look: 'MAX 4,000 LB PER LEVEL. These levels are well past that.' } },
          why: "A beam bowed that far under that much weight can let go, dropping drums into the aisle. Stop: keep people out of the aisle, unload the bay, and call it in (General Duty Clause; 1910.176(b))." }
      ] },
    { id: 'i_beamlock', room: 'i_racks', name: 'Beam Clips & Pallets', say: 'beam clips and the upper pallets', art: 'i_beamlock',
      hint: 'Up high, a beam should be locked in and every load sitting square on its pallet.',
      osha: 'Material stored in tiers has to be stacked, blocked, or interlocked so it is stable and secure against sliding or collapse (1910.176(b)).',
      parts: [{ id: 'clip', name: 'beam safety clip', r: [18, 60, 22, 28] }, { id: 'pallet', name: 'pallet on the beam', r: [40, 50, 196, 24] }, { id: 'load', name: 'the load', r: [40, 0, 196, 52] }, { id: 'deck', name: 'wire decking', r: [36, 84, 204, 14] }],
      base: { deck: { look: 'Wire mesh decking, under the pallets.' } },
      variants: [
        { cat: 0, desc: 'Pallets sit square on locked beams.', key: ['clip'],
          resp: { clip: { look: { t: 'A safety clip pushed through the connector, so a forklift bump can\'t lift the beam out.', clue: 'clip' }, touch: { t: 'Seated.', clue: 'clip' } }, pallet: { look: 'Square on the beams, sound boards.' }, load: { look: 'Shrink-wrapped and centered.' } },
          why: 'Locked beams, sound pallets, centered loads. Nothing to do (1910.176(b)).' },
        { cat: 1, desc: 'One pallet sticks out past the beam.', key: ['overhang'],
          resp: { pallet: { look: { t: 'The pallet hangs out over the aisle face a few inches. Set down a little crooked.', clue: 'overhang' }, tape: { t: 'Overhangs the beam by 4 inches. Still well supported.', clue: 'overhang' } }, clip: { look: 'Clipped.' } },
          why: 'A little overhang on a well-supported pallet is a housekeeping note: square it up next time it moves (1910.176(b)).' },
        { cat: 2, cost: 240, desc: 'The clip is missing from this beam, and the pallet on it looks rough.', key: ['noclip', 'broken'],
          resp: { clip: { look: { t: 'No clip. Just an empty hole in the connector.', clue: 'noclip' } }, pallet: { look: { t: 'Cracked deck boards, one missing, holding a full load up high.', clue: 'broken' }, touch: { t: 'A board flexes under your fingers.', clue: 'broken' } } },
          why: 'Without its clip a beam can pop loose when a forklift bumps it, and a broken pallet can drop its load. Correction: replace the clips, pull the bad pallet; charged back (1910.176(b)). Photo it.' },
        { cat: 3, desc: 'A load up top is hanging half off its beam.', key: ['hanging'],
          resp: { load: { look: { t: 'Half the load is off the beam, tipped out over the aisle. Two boxes have already fallen.', clue: 'hanging' } }, pallet: { look: { t: 'The pallet slid. One edge is on the beam, the rest is on air.', clue: 'hanging' } }, deck: { look: 'Fallen boxes on the floor below. FRAGILE. Not anymore.' } },
          why: 'A load hanging off a top beam can come down on anyone in the aisle. Stop: close the aisle, and have it taken down with a forklift from a safe distance (1910.176(b)).' }
      ] },
    { id: 'i_aisle', room: 'i_racks', name: 'Aisle & Emergency Exit', say: 'aisle to the emergency exit', art: 'i_aisle',
      hint: 'Aisles have to stay clear, and the exit at the end has to open.',
      osha: 'Exit routes stay free of obstructions (1910.37(a)(3)) and at least 28 inches wide (1910.36(g)(2)); permanent aisles are kept clear and marked (1910.176(a)).',
      parts: [{ id: 'exit', name: 'emergency exit door', r: [84, 0, 72, 96] }, { id: 'lines', name: 'aisle markings', r: [0, 92, 240, 43] }, { id: 'way', name: 'the way out', r: [30, 40, 180, 60] }],
      base: { exit: { smell: 'Outside air, faintly, around the door seal.' } },
      variants: [
        { cat: 0, desc: 'A clear aisle with crisp lines, straight to a lit EXIT door.', key: ['clear'],
          resp: { lines: { look: { t: 'Fresh yellow lines, both sides.', clue: 'clear' }, tape: { t: 'The aisle is 10 feet wide, clear end to end.', clue: 'clear' } }, exit: { look: 'A steel door with a panic bar, EXIT lit above it.', touch: { t: 'You push the bar. It opens to daylight, alarm chirps, and you let it close.', clue: 'clear' } } },
          why: 'Clear, marked, and the exit opens. Nothing to do.' },
        { cat: 1, desc: 'The aisle lines are worn away in spots.', key: ['faded'],
          resp: { lines: { look: { t: 'The yellow lines have worn to bare concrete where the forklifts turn.', clue: 'faded' } }, exit: { touch: 'The door opens fine.' } },
          why: 'Worn aisle paint is housekeeping. Note it: repaint the lines (1910.176(a)).' },
        { cat: 2, cost: 200, desc: 'Pallets are staged in the aisle near the exit.', key: ['narrow'],
          resp: { way: { look: { t: 'Three pallets parked in the aisle, leaving a squeeze between them and the rack.', clue: 'narrow' }, tape: { t: '20 inches between the pallets and the rack. An exit route needs at least 28.', clue: 'narrow' } }, exit: { look: 'The door itself is clear.' } },
          why: 'Staging pallets in the exit route squeezes it under 28 inches (1910.36(g)(2); 1910.37(a)(3)). Correction: clear the route and stage somewhere else; the cleanup is charged back. Photo it.' },
        { cat: 3, desc: 'Boxes are stacked against the emergency exit.', key: ['blocked'],
          resp: { exit: { look: { t: 'Cartons stacked right against the door, past the panic bar.', clue: 'blocked' }, touch: { t: "You push. The door won't move an inch.", clue: 'blocked' } }, way: { look: 'If there were a fire at the dock end, this is where everybody in the aisle would be headed.' } },
          why: "A blocked emergency exit traps people in a fire. Stop: clear it now, and call it in (1910.37(a)(3))." }
      ] },
    { id: 'i_sprinkrack', room: 'i_racks', name: 'Top Shelf & Sprinklers', say: 'top shelf and the sprinkler over it', art: 'i_sprinkrack',
      hint: 'Look up. Sprinklers need room to spray.',
      osha: 'Keep stored material at least 18 inches below sprinkler deflectors (1910.159(c)(10)).',
      parts: [{ id: 'head', name: 'sprinkler head', r: [100, 30, 40, 22] }, { id: 'gap', name: 'the gap', r: [200, 48, 40, 50] }, { id: 'top', name: 'top of the load', r: [30, 52, 170, 83] }],
      base: { head: { touch: 'Out of reach. Good.' } },
      variants: [
        { cat: 0, desc: 'Plenty of space between the top load and the sprinkler heads.', key: ['clearance'],
          resp: { gap: { tape: { t: '30 inches from the top of the load to the sprinkler deflector. 18 is the minimum.', clue: 'clearance' }, look: { t: 'Lots of air up there.', clue: 'clearance' } }, head: { look: 'An upright sprinkler head with a wire guard. Clean.' } },
          why: 'More than 18 inches of clearance. Nothing to do (1910.159(c)(10)).' },
        { cat: 1, desc: 'Shrink wrap hangs off the top of the load.', key: ['wrap'],
          resp: { top: { look: { t: 'Loose shrink wrap flapping off the top pallet.', clue: 'wrap' } }, gap: { tape: '30 inches clear.' } },
          why: 'Loose wrap up high is housekeeping. Note it: trim it before it ends up in the aisle.' },
        { cat: 2, cost: 180, desc: 'The top loads are stacked up close to the sprinklers.', key: ['close'],
          resp: { gap: { tape: { t: '10 inches from the top carton to the sprinkler deflector. It needs 18.', clue: 'close' } }, top: { look: { t: 'The top pallet is double-stacked. Somebody ran out of room.', clue: 'close' } } },
          why: 'Storage within 18 inches of a sprinkler blocks its spray (1910.159(c)(10)). Correction: take the top layer down; charged back. Photo it.' },
        { cat: 3, desc: 'One sprinkler head looks bent.', key: ['bent', 'drip'],
          resp: { head: { look: { t: 'The head is knocked crooked and its wire guard is bent back. A mast strike.', clue: 'bent' }, flashlight: { t: 'A slow drip at the fitting.', clue: 'drip' } }, gap: { look: 'Plenty of clearance, but the head itself is damaged.' } },
          why: "A damaged sprinkler head can fail in a fire, or let go and flood the aisle. Treat it as urgent: keep forklifts clear, and call it in for the sprinkler contractor today (1910.159(c))." }
      ] },
    { id: 'i_ladder', room: 'i_racks', name: 'Rolling Ladder', say: 'rolling warehouse ladder', art: 'i_ladder',
      hint: 'Ladders have to lock, and they have to be used like ladders.',
      osha: 'Ladders are inspected before use, and a damaged one is tagged and taken out of service (1910.23(b)(9)-(10)).',
      parts: [{ id: 'steps', name: 'steps', r: [60, 20, 110, 90] }, { id: 'lock', name: 'step lock', r: [94, 104, 44, 18] }, { id: 'wheels', name: 'wheels', r: [50, 110, 130, 20] }, { id: 'rails', name: 'handrails', r: [60, 0, 110, 20] }],
      base: { rails: { look: 'Yellow handrails at the top platform.' } },
      variants: [
        { cat: 0, desc: 'A rolling ladder parked by the rack, out of the way.', key: ['locks'],
          resp: { lock: { touch: { t: 'You step on the bottom step. The rubber feet drop and the ladder locks in place.', clue: 'locks', sfx: 'click' } }, steps: { look: 'Sound, ribbed steel steps.', touch: 'Solid.' }, wheels: { look: 'Wheels in good shape.' } },
          why: 'It locks, and it is parked out of the way. Nothing to do (1910.23).' },
        { cat: 1, desc: 'The rolling ladder is parked out in the walkway.', key: ['parked'],
          resp: { wheels: { look: { t: 'Parked right across the painted walkway.', clue: 'parked' } }, lock: { touch: 'It locks fine.' } },
          why: "A ladder left in the walkway is a trip and a bump. Note it: park it out of the way (1910.22(a)(3))." },
        { cat: 2, cost: 140, desc: 'The rolling ladder looks worn.', key: ['crack', 'nolock'],
          resp: { steps: { look: { t: 'The third step is cracked across.', clue: 'crack' }, touch: { t: 'It flexes under your hand.', clue: 'crack' } }, lock: { touch: { t: "You step on it. Nothing locks. The ladder rolls a foot.", clue: 'nolock' } } },
          why: 'A cracked step and a dead wheel lock mean the ladder comes out of service, tagged Do Not Use (1910.23(b)(9)-(10)). Correction: repair or replace; charged back. Photo it.' },
        { cat: 3, desc: 'The rolling ladder is standing on a pallet.', key: ['pallet'],
          resp: { wheels: { look: { t: "It's set on top of a pallet to reach higher. The wheels aren't even touching the floor.", clue: 'pallet' } }, lock: { touch: { t: "The lock can't reach anything. The whole ladder rocks.", clue: 'pallet' } }, steps: { look: 'Somebody climbed this, recently: boot marks on every step.' } },
          why: 'A ladder balanced on a pallet can tip and drop someone from the top of the rack. Stop: take it down now, and call it in (1910.23; 1910.28(b)(1)).' }
      ] },
    /* ---------------- PRODUCTION FLOOR ---------------- */
    { id: 'i_saw', room: 'i_floor', name: 'Cut-Off Saw', say: 'cut-off saw and its guard', art: 'i_saw',
      hint: "The blade is the business end. Check what's between it and a hand.",
      osha: 'The point of operation is guarded so no part of the operator can get in (1910.212(a)(1), (a)(3)(ii)). A machine missing its guard is locked out until the guard is back (1910.147).',
      parts: [{ id: 'guard', name: 'blade guard', r: [88, 38, 82, 60] }, { id: 'blade', name: 'blade', r: [100, 40, 56, 54] }, { id: 'switch', name: 'interlock switch', r: [176, 4, 40, 34] }, { id: 'table', name: 'saw table', r: [0, 84, 240, 51] }],
      base: { table: { look: 'A steel table, sawdust in the corners.', smell: 'Hot metal and wood dust.' } },
      variants: [
        { cat: 0, desc: 'A cut-off saw with its guard bolted down.', key: ['guarded'],
          resp: { guard: { look: { t: 'A clear polycarbonate hood over the blade, bolted at both sides.', clue: 'guarded' }, touch: { t: 'Firm. No play.', clue: 'guarded' } }, switch: { touch: { t: 'You lift the guard an inch; the interlock clicks and the motor won\'t start.', clue: 'guarded', sfx: 'click' } } },
          why: 'Guarded and interlocked. Nothing to do (1910.212(a)(1)).' },
        { cat: 1, desc: "The saw's guard is scratched and cloudy.", key: ['cloudy'],
          resp: { guard: { look: { t: 'So scratched and clouded that an operator would have to lean in to see the cut line.', clue: 'cloudy' } }, switch: { touch: 'The interlock works.' } },
          why: "The guard is still there and working; it just can't be seen through. Note it: replace the window before somebody starts working around it (1910.212(a)(2))." },
        { cat: 2, cost: 160, desc: "One side of the saw's guard isn't fastened.", key: ['gap'],
          resp: { guard: { look: { t: "The right-side bolt is gone, and the guard has swung out. There's a gap beside the blade.", clue: 'gap' }, tape: { t: 'A 2-inch gap. Plenty of room for fingers.', clue: 'gap' }, screwdriver: { t: 'No bolt to tighten. The hole is empty.', clue: 'gap' } } },
          why: 'A loose guard with a finger-sized gap is no guard (1910.212(a)(1), (a)(3)(ii)). Correction: replace the bolt; charged back. Photo it.' },
        { cat: 3, desc: "The saw is running, and there's nothing over the blade.", key: ['noguard', 'taped'],
          resp: { blade: { look: { t: 'The blade is spinning in the open. The guard is gone.', clue: 'noguard' }, smell: 'Hot metal.' }, switch: { look: { t: 'The interlock switch is taped down so the saw runs without the guard.', clue: 'taped' } }, guard: { look: { t: 'No guard. Two empty bolt holes.', clue: 'noguard' } } },
          why: 'An unguarded, interlock-defeated saw running on the floor can take fingers or a hand. Stop: shut it down, lock it out until the guard is back, and call it in (1910.212(a)(1); 1910.147).' }
      ] },
    { id: 'i_belt', room: 'i_floor', name: 'Belt Drive Guard', say: 'belt drive on the green machine', art: 'i_belt',
      hint: 'Belts and pulleys within seven feet of the floor should be fully enclosed.',
      osha: 'Belts, pulleys, chains, and shafts within 7 feet of the floor are enclosed (1910.219(d)(1), (e)(1)); a spinning shaft end is guarded (1910.219(c)(4)).',
      parts: [{ id: 'guard', name: 'belt guard', r: [40, 0, 164, 128] }, { id: 'shaft', name: 'shaft end', r: [190, 90, 40, 20] }, { id: 'motor', name: 'motor pulley', r: [50, 80, 40, 40] }],
      base: { motor: { look: 'The motor pulley, down low.', smell: 'Warm motor.' } },
      variants: [
        { cat: 0, desc: 'A belt drive behind a yellow mesh guard.', key: ['enclosed'],
          resp: { guard: { look: { t: 'An expanded-metal guard covers the whole drive, bolted at every corner.', clue: 'enclosed' }, touch: { t: "Tight. Fingers can't get through the mesh.", clue: 'enclosed' } } },
          why: 'Fully enclosed. Nothing to do (1910.219(d)(1)).' },
        { cat: 1, desc: 'The belt guard has a dent in it.', key: ['dent'],
          resp: { guard: { look: { t: 'Dented in where something hit it, but still covering everything.', clue: 'dent' }, touch: { t: "No gap. The dent doesn't reach the belt.", clue: 'dent' } } },
          why: 'Dented but still covering the drive. Note it (1910.219(m)).' },
        { cat: 2, cost: 280, desc: 'The belt drive is out in the open, spinning.', key: ['bare'],
          resp: { guard: { look: { t: 'No guard. The belt and both pulleys are spinning in the open.', clue: 'bare' } }, shaft: { look: { t: 'A bare shaft end spinning at knee height.', clue: 'bare' }, tape: { t: '18 inches off the floor. Right at pant-leg height.', clue: 'bare' } } },
          why: 'An unguarded belt and a spinning shaft end grab clothes and hands (1910.219(c)(4), (d)(1)). Correction: put the guard back; charged back. Photo it.' },
        { cat: 3, desc: 'Someone is reaching into the running belt drive.', key: ['reach'],
          resp: { guard: { look: { t: "No guard, the machine running, and an operator's arm reaching in past the belt to clear a jam.", clue: 'reach' } }, motor: { look: { t: 'The belt is a hand-width from their fingers, still turning.', clue: 'reach' } }, shaft: { look: 'The bare shaft end, still spinning at knee height.' } },
          why: 'Reaching into a running, unguarded belt is how hands get pulled in. Stop: get their hand out, shut it down, lock it out, and call it in (1910.212(a)(1); 1910.147).' }
      ] },
    { id: 'i_conveyor', room: 'i_floor', name: 'Conveyor Line', say: 'conveyor line', art: 'i_conveyor',
      hint: 'Check the ends of the line, the stop, and how people get across it.',
      osha: 'Nip points on conveyors are guarded (1910.212(a)(1)), and an emergency stop has to be reachable.',
      parts: [{ id: 'tail', name: 'tail pulley', r: [0, 20, 34, 40] }, { id: 'estop', name: 'emergency stop', r: [206, 58, 34, 40] }, { id: 'cord', name: 'pull cord', r: [30, 56, 190, 8] }, { id: 'under', name: 'under the line', r: [0, 90, 240, 45] }],
      base: { cord: { look: 'A yellow pull cord along the line.' } },
      variants: [
        { cat: 0, desc: 'A roller conveyor with a guarded tail pulley and an e-stop on a post.', key: ['stops'],
          resp: { estop: { touch: { t: 'You press the mushroom button. The line stops dead. You twist it to reset.', clue: 'stops', sfx: 'click' } }, tail: { look: { t: 'A yellow mesh cage over the tail pulley.', clue: 'stops' } }, cord: { touch: 'Taut. Pulling it would stop the line.' } },
          why: 'Guarded, and the stop is reachable and works. Nothing to do.' },
        { cat: 1, desc: 'Cardboard dust under the line.', key: ['dust'],
          resp: { under: { look: { t: 'Cardboard dust and scraps under the conveyor.', clue: 'dust' }, smell: { t: 'Paper dust.', clue: 'dust' } }, estop: { touch: 'Works.' } },
          why: 'Debris under the line is housekeeping. Note it: sweep it up (1910.22(a)(1)).' },
        { cat: 2, cost: 220, desc: 'The tail pulley is spinning in the open, and the e-stop is hard to get to.', key: ['bare', 'buried'],
          resp: { tail: { look: { t: 'The guard is off the tail pulley. The roller and belt meet in a bare nip point.', clue: 'bare' } }, estop: { look: { t: 'Cartons stacked in front of the e-stop post.', clue: 'buried' }, touch: { t: "You can't reach it without moving boxes.", clue: 'buried' } } },
          why: 'An unguarded nip point and a buried stop button (1910.212(a)(1)). Correction: guard the pulley and clear the stop; charged back. Photo it.' },
        { cat: 3, desc: 'There are scuff marks under the running conveyor.', key: ['duck'],
          resp: { under: { look: { t: "A worn path right under the line: people duck under the running conveyor because there's no crossover.", clue: 'duck' }, touch: { t: 'Knee scuffs on the concrete.', clue: 'duck' } } },
          why: 'Crawling under a running conveyor puts heads and hands at the rollers. Stop: halt the line, require a crossover, and call it in (1910.212(a)(1); General Duty Clause).' }
      ] },
    { id: 'i_noise', room: 'i_floor', name: 'Hearing Protection Station', say: 'hearing protection station', art: 'i_noise',
      hint: 'If you have to shout to talk at arm\'s length, it is loud enough to matter.',
      osha: 'At 85 dBA averaged over a shift, there is a hearing conservation program and protection is provided (1910.95(c), (i)); the limit is 90 dBA (1910.95(b)(1)).',
      parts: [{ id: 'sign', name: 'sign', r: [16, 6, 108, 68] }, { id: 'dispenser', name: 'earplug dispenser', r: [138, 28, 74, 74] }, { id: 'meter', name: 'sound meter', r: [28, 84, 74, 44] }],
      base: { sign: { look: 'HEARING PROTECTION REQUIRED IN THIS AREA.' } },
      variants: [
        { cat: 0, desc: 'A hearing protection sign and a full earplug dispenser.', key: ['stocked'],
          resp: { dispenser: { look: { t: 'Full of orange foam plugs.', clue: 'stocked' }, touch: { t: 'You twist the knob; a plug drops out.', clue: 'stocked' } }, meter: { look: { t: '84 dBA averaged. Loud, protected.', clue: 'stocked' } } },
          why: 'Posted, stocked, and the readings are in range. Nothing to do (1910.95).' },
        { cat: 1, desc: 'The earplug dispenser is empty.', key: ['empty'],
          resp: { dispenser: { look: { t: 'Empty.', clue: 'empty' }, touch: { t: 'You twist the knob. Nothing.', clue: 'empty' } } },
          why: 'An empty dispenser in a hearing-protection area is a restock. Note it (1910.95(i)(1)).' },
        { cat: 2, cost: 300, desc: 'The sign is up, but the dispenser is gone.', key: ['none', 'loud'],
          resp: { dispenser: { look: { t: 'Just its screw holes. No dispenser, no plugs, no muffs anywhere.', clue: 'none' } }, meter: { look: { t: '92 dBA averaged. Over the limit.', clue: 'loud' } } },
          why: 'Over 90 dBA with no protection available (1910.95(b)(1), (i)). Correction: provide protection and a hearing program; charged back. Photo it.' },
        { cat: 3, desc: 'Something on the floor is screaming.', key: ['shriek'],
          resp: { meter: { look: { t: '98 dBA and climbing. A grinding shriek from the line.', clue: 'shriek' } }, sign: { look: 'The sign is right. Nobody can hear you read it.' } },
          why: 'A failing bearing shrieking at nearly 100 dBA beside workers can fail outright. Treat it as urgent: shut it down for repair, and call it in (1910.95; General Duty Clause).' }
      ] },
    { id: 'i_airhose', room: 'i_floor', name: 'Air Hose & Blowgun', say: 'air hose reel', art: 'i_airhose',
      hint: 'Compressed air for cleaning has to be turned down, and never aimed at a person.',
      osha: 'Compressed air for cleaning is reduced below 30 psi, with chip guarding and PPE (1910.242(b)).',
      parts: [{ id: 'gauge', name: 'regulator gauge', r: [128, 14, 34, 34] }, { id: 'nozzle', name: 'blowgun', r: [184, 66, 50, 18] }, { id: 'reel', name: 'hose reel', r: [38, 14, 64, 64] }, { id: 'hose', name: 'hose', r: [80, 56, 160, 79] }],
      base: { reel: { look: 'A red hose reel on the wall.' } },
      variants: [
        { cat: 0, desc: 'An air hose on its reel, with a safety blowgun.', key: ['30psi'],
          resp: { nozzle: { look: { t: 'A safety nozzle stamped OSHA 30 PSI.', clue: '30psi' } }, gauge: { look: { t: '30 psi at the regulator.', clue: '30psi' } }, hose: { look: 'Coiled on the reel.' } },
          why: 'Turned down and tipped. Nothing to do (1910.242(b)).' },
        { cat: 1, desc: 'The air hose is lying across the walkway.', key: ['across'],
          resp: { hose: { look: { t: 'The hose runs right across the walkway.', clue: 'across' } }, gauge: { look: '30 psi.' } },
          why: 'A hose across a walkway is a trip. Note it: reel it in (1910.22(a)(3)).' },
        { cat: 2, cost: 90, desc: 'The blowgun has a plain open tip.', key: ['openpipe', '90psi'],
          resp: { nozzle: { look: { t: 'An open pipe tip. No safety nozzle.', clue: 'openpipe' } }, gauge: { look: { t: '90 psi. Full line pressure.', clue: '90psi' } } },
          why: 'An open-pipe blowgun at 90 psi throws chips like shrapnel (1910.242(b)). Correction: safety nozzle and a regulator; charged back. Photo it.' },
        { cat: 3, desc: "Someone's been blowing dust off themselves with the air hose.", key: ['body'],
          resp: { nozzle: { look: { t: 'Aimed at a pair of coveralls hanging by the reel, still dusty, and the gun is at 90 psi.', clue: 'body' } }, gauge: { look: { t: '90 psi.', clue: 'body' } }, hose: { look: 'Somebody uses this to clean themselves off at the end of a shift.' } },
          why: 'Compressed air against skin can drive air into the bloodstream or blow out an eardrum. Stop: no air on people, ever, and call it in (1910.242(b); General Duty Clause).' }
      ] },
    { id: 'i_exitdoor', room: 'i_floor', name: 'Exit Door & Extinguisher', say: 'exit door and extinguisher', art: 'i_exitdoor',
      hint: 'Exits open from the inside, and extinguishers stay in reach.',
      osha: 'Exit doors open from the inside without a key or tool (1910.36(d)(1)); extinguishers stay mounted and reachable, checked monthly (1910.157(c)(1), (e)(2)).',
      parts: [{ id: 'door', name: 'exit door', r: [30, 14, 96, 121] }, { id: 'sign', name: 'EXIT sign', r: [46, 0, 64, 16] }, { id: 'ext', name: 'extinguisher', r: [166, 10, 30, 84] }, { id: 'tag', name: 'inspection tag', r: [192, 62, 26, 34] }],
      base: { sign: { look: 'EXIT, in red.' } },
      variants: [
        { cat: 0, desc: 'An exit door with a panic bar, and an extinguisher beside it.', key: ['opens'],
          resp: { door: { touch: { t: 'The panic bar gives; the door opens. You let it close.', clue: 'opens' } }, ext: { look: 'Mounted, sign above it.' }, tag: { look: { t: 'Punched every month this year.', clue: 'opens' } } },
          why: 'The exit opens and the extinguisher is mounted and current. Nothing to do.' },
        { cat: 1, desc: 'The EXIT sign is dark, and the extinguisher tag is behind.', key: ['tag', 'dark'],
          resp: { tag: { look: { t: 'September is punched. October is blank.', clue: 'tag' } }, sign: { look: { t: 'The EXIT sign is dark. Dead lamp.', clue: 'dark' } }, door: { touch: 'Opens fine.' } },
          why: 'A missed monthly check and a dead sign lamp are upkeep. Note them (1910.157(e)(2); 1910.37(b)(6)).' },
        { cat: 2, cost: 100, desc: 'A parts cart is parked in front of the extinguisher.', key: ['cart'],
          resp: { ext: { look: { t: 'A heavy parts cart parked right in front of it.', clue: 'cart' }, touch: { t: "You'd have to move the cart to get it off the hook.", clue: 'cart' } } },
          why: "A blocked extinguisher doesn't help anyone in a fire (1910.157(c)(1)). Correction: keep it clear; charged back. Photo it." },
        { cat: 3, desc: 'The exit door is chained shut.', key: ['chained'],
          resp: { door: { look: { t: 'A chain through the panic bar, padlocked.', clue: 'chained' }, touch: { t: "It won't open. Not even a crack.", clue: 'chained' } } },
          why: 'An emergency exit locked from inside during a shift traps people in a fire. Stop: unlock it now, and call it in (1910.36(d)(1)).' }
      ] },
    /* ---------------- MAINTENANCE SHOP ---------------- */
    { id: 'i_grinder', room: 'i_shop', name: 'Bench Grinder', say: 'bench grinder', art: 'i_grinder',
      hint: 'Measure the gaps: the rest under the wheel and the guard over it.',
      osha: 'Work rest within 1/8 inch of the wheel, tongue guard within 1/4 inch, and the grinder bolted down (1910.215(a)(4), (b)(9); 1910.212(b)).',
      parts: [{ id: 'rest', name: 'work rest', r: [20, 80, 200, 14] }, { id: 'tongue', name: 'tongue guard', r: [40, 10, 160, 20] }, { id: 'wheel', name: 'grinding wheels', r: [30, 28, 180, 60] }, { id: 'base', name: 'mounting bolts', r: [86, 90, 68, 24] }],
      base: { base: { look: 'The grinder on the steel bench.' } },
      variants: [
        { cat: 0, desc: 'A bench grinder, bolted down, eye shields on.', key: ['gaps'],
          resp: { rest: { tape: { t: 'The work rest is 1/8 inch from the wheel.', clue: 'gaps' } }, tongue: { tape: { t: 'The tongue guard is 1/4 inch from the wheel.', clue: 'gaps' } }, base: { touch: { t: 'Bolted tight.', clue: 'gaps' } } },
          why: 'Gaps in spec, bolted down, shields on. Nothing to do (1910.215).' },
        { cat: 1, desc: 'The grinding wheels look shiny and worn.', key: ['glazed'],
          resp: { wheel: { look: { t: 'Glazed and grooved. They need dressing.', clue: 'glazed' } }, rest: { tape: '1/8 inch. Fine.' } },
          why: 'Glazed wheels just need dressing. Note it.' },
        { cat: 2, cost: 80, desc: 'The gaps around the grinding wheels look wide.', key: ['wide'],
          resp: { rest: { tape: { t: 'The work rest is 3/8 inch from the wheel. Enough to jam a part.', clue: 'wide' } }, tongue: { tape: { t: 'The tongue guard is a full inch off the wheel.', clue: 'wide' } } },
          why: 'A wide rest gap can jam a workpiece and shatter the wheel (1910.215(a)(4), (b)(9)). Correction: adjust both; charged back. Photo it.' },
        { cat: 3, desc: 'The bench grinder is walking on the bench.', key: ['crack', 'loose'],
          resp: { wheel: { look: { t: 'A crack across the left wheel. The guards are off.', clue: 'crack' } }, base: { look: { t: 'No bolts. It walks across the bench when it runs.', clue: 'loose' }, touch: { t: 'The bench shakes.', clue: 'loose' } } },
          why: 'A cracked wheel can burst like a grenade. Stop: unplug it, tag it Do Not Use, and call it in (1910.215(a)(2), (d)(1); 1910.212(b)).' }
      ] },
    { id: 'i_loto', room: 'i_shop', name: 'Press Under Repair', say: 'punch press under repair', art: 'i_loto',
      hint: 'A machine being worked on should be locked off, with a name on the lock.',
      osha: 'Energy sources are locked out with each worker\'s own lock and tag before servicing, and the machine is tried to prove it is dead (1910.147(c)(5), (d)(4), (d)(6)).',
      parts: [{ id: 'handle', name: 'disconnect handle', r: [44, 24, 30, 60] }, { id: 'lock', name: 'lock and tag', r: [28, 72, 52, 63] }, { id: 'card', name: 'procedure card', r: [170, 18, 60, 74] }, { id: 'press', name: 'the press', r: [160, 100, 80, 35] }],
      base: { card: { look: 'A lockout procedure card for this press, step by step.' } },
      variants: [
        { cat: 0, desc: "The press's disconnect is locked off, with a tag.", key: ['locked'],
          resp: { lock: { look: { t: 'A red personal lock through the hasp, and a DANGER tag: R. DIAZ, MAINTENANCE.', clue: 'locked' } }, handle: { look: { t: 'OFF.', clue: 'locked' }, touch: "Locked. It won't move." }, press: { touch: { t: 'You press START. Nothing. Proven dead.', clue: 'locked', ach: 'triedit' } } },
          why: 'Locked, tagged, and tried. Exactly right. Nothing to do (1910.147).' },
        { cat: 1, desc: 'The lockout tag is smudged and hard to read.', key: ['smudge'],
          resp: { lock: { look: { t: "A lock, and a tag with a greasy name you can't quite read.", clue: 'smudge' } }, handle: { look: 'OFF, locked.' } },
          why: "Locked out properly; the tag just needs a readable name. Note it (1910.147(c)(5)(ii))." },
        { cat: 2, cost: 60, desc: "There's a tag on the disconnect, but no lock.", key: ['tagonly'],
          resp: { lock: { look: { t: 'A DANGER tag hanging from the hasp. No lock.', clue: 'tagonly' } }, handle: { touch: { t: 'It moves. Anyone could switch it on.', clue: 'tagonly' } } },
          why: "A tag alone on a disconnect that takes a lock isn't lockout (1910.147(c)(3), (d)(4)). Correction: lock it; retraining charged back. Photo it." },
        { cat: 3, desc: "Someone's working inside the press, and it's humming.", key: ['live'],
          resp: { handle: { look: { t: 'ON. Nothing locked.', clue: 'live' } }, press: { look: { t: "A mechanic's boots sticking out from under the press. The motor is humming.", clue: 'live' } } },
          why: 'Someone inside a live machine with nothing locked out can be crushed. Stop: get them out, lock it out, and call it in (1910.147(c)(1), (d)).' }
      ] },
    { id: 'i_cylinders', room: 'i_shop', name: 'Gas Cylinders', say: 'gas cylinders', art: 'i_cylinders',
      hint: 'Cylinders stand up, chained, capped, and oxygen stays apart from fuel gas.',
      osha: 'Cylinders are stored upright, secured, and capped (1910.101(b)); oxygen is kept 20 feet from fuel gas or behind a 5-foot fire wall (1910.253(b)(4)(iii)).',
      parts: [{ id: 'oxy', name: 'oxygen cylinders', r: [16, 0, 64, 112] }, { id: 'fuel', name: 'acetylene cylinders', r: [146, 0, 70, 112] }, { id: 'wall', name: 'fire wall', r: [82, 28, 14, 84] }, { id: 'chain', name: 'chains', r: [10, 50, 210, 10] }],
      base: { wall: { look: 'A steel divider between them.' } },
      variants: [
        { cat: 0, desc: 'Oxygen and acetylene cylinders, chained, with a fire wall between them.', key: ['secured'],
          resp: { chain: { touch: { t: 'Chained tight. None of them rock.', clue: 'secured' } }, oxy: { look: 'Capped, upright.' }, wall: { tape: { t: 'The fire wall is 5 feet tall. Good.', clue: 'secured' } } },
          why: 'Upright, chained, capped, and separated. Nothing to do (1910.101(b); 1910.253).' },
        { cat: 1, desc: 'An empty oxygen cylinder is marked MT.', key: ['mt'],
          resp: { oxy: { look: { t: 'One cylinder is chalked MT. Empties go back to the supplier.', clue: 'mt' } }, chain: { touch: 'Chained.' } },
          why: 'An empty, marked, chained cylinder waiting for pickup. Note it.' },
        { cat: 2, cost: 110, desc: 'The cylinders are standing loose, caps off.', key: ['loose'],
          resp: { chain: { look: { t: 'No chains.', clue: 'loose' } }, oxy: { touch: { t: 'It rocks when you touch it.', clue: 'loose' }, look: 'Caps off, valves bare.' } },
          why: "An unsecured cylinder can fall and snap its valve off, and then it's a rocket (1910.101(b)). Correction: chain and cap them; charged back. Photo it." },
        { cat: 3, desc: 'One cylinder is lying on the floor, hissing.', key: ['hiss', 'close'],
          resp: { fuel: { look: { t: 'An acetylene cylinder on its side on the floor, valve hissing.', clue: 'hiss' }, smell: { t: 'Garlic. Acetylene.', clue: 'hiss' } }, oxy: { tape: { t: 'The oxygen is 2 feet from the acetylene. No fire wall.', clue: 'close' } } },
          why: 'Leaking fuel gas next to oxygen is a fire or explosion waiting for a spark. Stop: clear the area, no flames or switches, and call the fire department (1910.253(b)(4)(iii)).' }
      ] },
    { id: 'i_flamcab', room: 'i_shop', name: 'Flammables Cabinet', say: 'flammables cabinet', art: 'i_flamcab',
      hint: 'Flammable liquids go in the yellow cabinet, closed, away from heat.',
      osha: 'Flammable liquids are kept in approved cabinets, no more than 60 gallons each (1910.106(d)(3)), and containers are labeled (1910.1200(f)).',
      parts: [{ id: 'doors', name: 'cabinet doors', r: [50, 14, 140, 110] }, { id: 'top', name: 'top of the cabinet', r: [56, 0, 128, 16] }, { id: 'floor', name: 'beside it', r: [190, 80, 50, 55] }],
      base: { doors: { look: 'A yellow flammables cabinet: FLAMMABLE, KEEP FIRE AWAY.' } },
      variants: [
        { cat: 0, desc: 'A yellow flammables cabinet, doors closed.', key: ['closed'],
          resp: { doors: { touch: { t: 'Self-closing doors, latched.', clue: 'closed' } }, top: { look: { t: 'Nothing on top.', clue: 'closed' } } },
          why: 'Closed, labeled, and nothing stored on top. Nothing to do (1910.106(d)(3)).' },
        { cat: 1, desc: 'There are oily rags in a bin beside the flammables cabinet.', key: ['rags'],
          resp: { floor: { look: { t: 'An open bin of oily rags.', clue: 'rags' }, smell: { t: 'Solvent.', clue: 'rags' } } },
          why: 'Oily rags belong in a lidded metal can. Note it (fire code; 1910.22(a)(1)).' },
        { cat: 2, cost: 90, desc: 'Gas cans are sitting on top of the flammables cabinet.', key: ['ontop', 'jug'],
          resp: { top: { look: { t: 'Two cans on the roof of the cabinet, and a milk jug of gasoline.', clue: 'ontop' } }, doors: { touch: { t: "The doors won't close all the way: it's full.", clue: 'jug' } } },
          why: 'Gas in a milk jug, and overflow cans on top (1910.106(d)(3); 1910.1200(f)). Correction: approved containers, inside; charged back. Photo it.' },
        { cat: 3, desc: 'A space heater is glowing next to an open pan of solvent.', key: ['heater'],
          resp: { floor: { look: { t: 'A space heater, glowing red, a foot from an open solvent pan.', clue: 'heater' }, smell: { t: 'Strong solvent vapor.', clue: 'heater' } } },
          why: 'Solvent vapor and a glowing heater is a fire waiting to happen. Stop: kill the heater, ventilate, and call it in (1910.106; General Duty Clause).' }
      ] },
    { id: 'i_chemshelf', room: 'i_shop', name: 'Chemical Shelf & Eyewash', say: 'chemical shelf and the eyewash', art: 'i_chemshelf',
      hint: 'Labels on everything, a Safety Data Sheet for everything, and an eyewash close by.',
      osha: 'Every container is labeled and every chemical has a Safety Data Sheet (1910.1200(f), (g)(8)); where corrosives can splash, an eyewash is right there (1910.151(c)).',
      parts: [{ id: 'bottles', name: 'chemical containers', r: [0, 0, 110, 92] }, { id: 'sds', name: 'SDS box', r: [118, 2, 48, 38] }, { id: 'eyewash', name: 'eyewash station', r: [180, 6, 54, 124] }, { id: 'floor', name: 'under the shelf', r: [0, 96, 170, 39] }],
      base: { floor: { look: 'Concrete under the shelf.' } },
      variants: [
        { cat: 0, desc: 'A chemical shelf with labeled containers, the SDS box, and an eyewash station.', key: ['labeled'],
          resp: { bottles: { look: { t: 'Every container labeled.', clue: 'labeled' } }, sds: { look: { t: 'An SDS binder, current, for every product on the shelf.', clue: 'labeled' } }, eyewash: { touch: { t: 'You push the paddle. Both nozzles flush clean water.', clue: 'labeled' } } },
          why: 'Labeled, documented, and the eyewash works. Nothing to do (1910.1200; 1910.151(c)).' },
        { cat: 1, desc: 'The SDS binder looks a little old.', key: ['oldsds'],
          resp: { sds: { look: { t: 'The binder is from 2004, and the new degreaser on the shelf is not in it.', clue: 'oldsds' } }, eyewash: { touch: 'Works.' } },
          why: 'One missing sheet is an update. Note it: add the new product (1910.1200(g)(8)).' },
        { cat: 2, cost: 150, desc: "Some bottles aren't labeled, and there's no eyewash.", key: ['blank', 'noeyewash'],
          resp: { bottles: { look: { t: 'Three bottles with no labels at all.', clue: 'blank' }, smell: 'Something sharp.' }, eyewash: { look: { t: 'No eyewash anywhere in the room. Acid is poured here.', clue: 'noeyewash' } } },
          why: 'Unlabeled chemicals and no eyewash where corrosives are poured (1910.1200(f); 1910.151(c)). Correction: label everything, install an eyewash; charged back. Photo it.' },
        { cat: 3, desc: "There's a sharp smell and a puddle under the chemical shelf.", key: ['mix'],
          resp: { floor: { look: { t: 'Acid and bleach both leaking into the same puddle.', clue: 'mix' }, smell: { t: 'Sharp and eye-watering. Chlorine.', clue: 'mix' } } },
          why: 'Acid and bleach together give off chlorine gas. Stop: clear the room, ventilate, spill response, and call it in (1910.1200; General Duty Clause).' }
      ] },
    { id: 'i_hoist', room: 'i_shop', name: 'Hoist & Slings', say: 'chain hoist and its slings', art: 'i_hoist',
      hint: 'Rated loads, tagged slings, and nobody under the hook.',
      osha: 'Slings are tagged with their capacity and inspected every day (1910.184(d), (e)(1)); nobody stands under a suspended load (1910.184(c)(8)).',
      parts: [{ id: 'hoist', name: 'chain hoist', r: [96, 20, 48, 34] }, { id: 'sling', name: 'sling', r: [110, 100, 70, 35] }, { id: 'tag', name: 'sling tag', r: [150, 108, 26, 22] }, { id: 'beam', name: 'beam', r: [0, 6, 240, 20] }],
      base: { beam: { look: '2 TON on the beam.' } },
      variants: [
        { cat: 0, desc: 'A chain hoist with a tagged sling on the hook.', key: ['tagged'],
          resp: { tag: { look: { t: 'A capacity tag: 2,000 lb vertical. Inspected today.', clue: 'tagged' } }, hoist: { look: 'Rated 2 tons.' }, sling: { look: 'A green web sling. No cuts.' } },
          why: 'Rated, tagged, and inspected. Nothing to do (1910.184).' },
        { cat: 1, desc: 'The sling tag is grimy.', key: ['grimy'],
          resp: { tag: { look: { t: 'Greasy, but you can still read 2,000 LB.', clue: 'grimy' } } },
          why: 'A dirty but readable tag. Note it (1910.184(e)(1)).' },
        { cat: 2, cost: 85, desc: 'The sling on the hook is frayed.', key: ['frayed'],
          resp: { sling: { look: { t: 'Cut fibers along the edge, and no tag.', clue: 'frayed' } }, tag: { look: { t: 'No tag at all.', clue: 'frayed' } } },
          why: 'A frayed, untagged sling comes out of service (1910.184(d), (e)(1)). Correction: remove and replace it; charged back. Photo it.' },
        { cat: 3, desc: "There's a load hanging from the hoist, at head height.", key: ['under'],
          resp: { sling: { look: { t: 'A gearbox hanging at chest height, and someone working right under it.', clue: 'under' } }, hoist: { look: 'Holding, for now.' } },
          why: 'Never under a suspended load. Stop: get them out from under it, set it down, and call it in (1910.184(c)(8)).' }
      ] }
  ];

  /* ============================== SMALL FINDS ============================== */
  const ANOMALIES = [
    { id: 'i_a_plank', room: 'i_racks', name: 'Loose pallet board', cat: 1, pts: () => hull(boxPts(-3.4, -2.2, 0, .2, 13.6, 14)), walk: { x: -2.8, z: 12.8 },
      look: 'A pallet deck board lying loose by the rack, nails up.', touch: 'Carefully. Two nails sticking up.', tape: 'Three feet long, two rusty nails.',
      why: 'A loose board with nails up is housekeeping. Note it: into the scrap bin.',
      draw(g) { const a = P(-3.4, .06, 13.8), b = P(-2.2, .06, 13.8); pxLine(g, a[0], a[1], b[0], b[1], '#b08a58', 2); for (const k of [.25, .7]) { const p = P(-3.4 + k * 1.2, .1, 13.8); pxRect(g, p[0], p[1] - 2, 1, 2, '#6a6e76'); } } },
    { id: 'i_a_gum', room: 'i_racks', name: 'Gum on the upright', cat: 0, pts: () => around(P(4.4, 1.0, 13.1), 8, 8), walk: { x: 3.4, z: 12.8 },
      look: 'A wad of gum stuck to a rack upright. Spearmint, it looks like.', touch: 'You decline.', why: 'Gross, not a finding.',
      draw(g) { const p = P(4.4, 1.0, 13.1); pxRect(g, p[0] - 1, p[1] - 1, 3, 2, '#e8a8c0'); } },
    { id: 'i_a_scrap', room: 'i_racks', name: 'Shrink-wrap ball', cat: 1, pts: () => around(P(-1.6, 0, 9), 16, 10), walk: { x: -1.6, z: 8.2 },
      look: 'A wad of used shrink wrap kicked into the aisle.', touch: 'Static-y plastic.', why: 'Loose wrap in the aisle is housekeeping. Note it.',
      draw(g) { const p = P(-1.6, 0, 9); pxEllipse(g, p[0], p[1] - 2, 5, 3, 'rgba(230,240,250,0.8)'); pxEllipse(g, p[0] + 2, p[1] - 3, 2, 1, '#ffffff'); } },
    { id: 'i_a_glasses', room: 'i_floor', name: 'Safety glasses on the bench', cat: 1, pts: () => around(P(-4.2, 1.0, 8.6), 12, 8), walk: { x: -3.7, z: 7.4 },
      look: "A pair of safety glasses left on the saw table. Whoever owns them isn't wearing them right now.", touch: 'Still warm. Somebody just took them off.',
      why: 'Glasses off near a running saw is a coaching moment for the supervisor. Note it (1910.133(a)(1)).',
      draw(g) { const p = P(-4.2, 1.0, 8.6); pxRect(g, p[0] - 3, p[1] - 1, 6, 2, 'rgba(200,230,255,0.9)'); pxRect(g, p[0] - 3, p[1] - 2, 6, 1, '#2a2c32'); } },
    { id: 'i_a_target', room: 'i_floor', name: 'Production board', cat: 0, pts: () => Q.back(ROOMS.i_floor.box, -3.4, -1.6, 2.6, 3.6), walk: { x: -2.4, z: 12 },
      look: "A whiteboard: TODAY'S TARGET 1,200. ACTUAL 1,180. Someone drew a sad face next to the 20.", why: 'A production board. Not a finding.',
      draw(g, r) { const q = Q.back(r.box, -3.4, -1.6, 2.6, 3.6), b = polyBox(q); pxRect(g, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, '#f4f4ee'); pxRect(g, b.x0 + 2, b.y0 + 2, b.x1 - b.x0 - 4, 1, '#2a5aa8'); pxRect(g, b.x0 + 2, b.y0 + 5, (b.x1 - b.x0) * .5, 1, '#d82020'); } },
    { id: 'i_a_puddle', room: 'i_floor', name: 'Coolant drips', cat: 1, pts: () => around(P(4.1, 0, 9), 18, 8), walk: { x: 4.1, z: 8.2 },
      look: 'A few drips of coolant under the machine.', touch: 'Slippery.', smell: 'Sweet, like coolant.', why: 'Small drips are housekeeping. Note it: wipe up, check the line (1910.22(a)(2)).',
      draw(g) { const p = P(4.1, 0, 9); pxEllipse(g, p[0], p[1] - 1, 6, 1, 'rgba(120,200,160,0.5)'); } },
    { id: 'i_a_calendar', room: 'i_shop', name: 'Parts calendar', cat: 0, pts: () => Q.back(ROOMS.i_shop.box, -4.6, -3.6, 2.75, 3.75), walk: { x: -4.6, z: 14.4 },
      look: 'A bearing supplier\'s calendar, still on September. The photo is a very shiny ball bearing.', why: 'Shop decor. Not a finding.',
      draw(g, r) { const q = Q.back(r.box, -4.6, -3.6, 2.75, 3.75), b = polyBox(q); pxRect(g, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, '#f4f0e0'); pxRect(g, b.x0 + 2, b.y0 + 2, b.x1 - b.x0 - 4, (b.y1 - b.y0) / 2, '#8a9aaa'); } },
    { id: 'i_a_creeper', room: 'i_shop', name: 'Mechanic\'s creeper', cat: 1, pts: () => around(P(-2, 0, 7.6), 22, 8), walk: { x: -2, z: 6.6 },
      look: "A mechanic's creeper left out in the middle of the floor.", touch: 'It rolls when you nudge it. Exactly the problem.', why: 'A creeper in the walkway is a trip. Note it: hang it up.',
      draw(g) { const a = P(-2.6, .08, 7.6), b = P(-1.4, .08, 7.6); pxRect(g, a[0], a[1] - 2, b[0] - a[0], 2, '#d82020'); pxRect(g, a[0], a[1], 2, 1, '#1a1a1e'); pxRect(g, b[0] - 2, b[1], 2, 1, '#1a1a1e'); } },
    { id: 'i_a_weld', room: 'i_shop', name: 'Torn welding curtain', cat: 1, pts: () => Q.back(ROOMS.i_shop.box, 5.4, 6.4, 0, 2), walk: { x: 4.4, z: 14.4 },
      look: 'A red welding curtain in the back corner, torn near the bottom.', why: 'A small rip in a welding screen. Note it: patch it before the next hot work (1910.252(b)(2)(iii)).',
      draw(g, r) { fillPoly(g, Q.back(r.box, 5.4, 6.4, 0, 2), 'rgba(200,40,40,0.55)'); const p = P(5.8, .4, r.box.zb); pxLine(g, p[0], p[1], p[0] + 3, p[1] - 6, '#2a1010'); } }
  ];

  /* ============================== LEFT BEHIND ============================== */
  const spr = kind => (g, x, y, k) => drawSprite(g, INDA.SPRITES[kind], x, y + 1, sprScale(k), SPR_PAL);
  const CLUTTER = {
    i_boxcutter: { name: 'Box cutter', look: 'A yellow box cutter, blade retracted. Every warehouse has a hundred and none when you need one.', touch: 'You check: blade retracted. Good habit.', smell: 'Cardboard.', draw: spr('i_boxcutter') },
    i_radio: { name: 'Work radio', look: 'A beat-up job site radio, tuned to classic rock. It has survived being dropped off a forklift, by the look of it.', touch: 'Heavy, rubber-cornered, and sticky.', smell: 'Sawdust and battery.', draw: spr('i_radio') },
    i_cooler: { name: 'Lunch cooler', look: "A red lunch cooler with GARY on it in marker. Gary's lunch is still inside.", touch: 'Cold. Gary is going to want this back.', smell: 'Bologna.', draw: spr('i_cooler') },
    i_gloves: { name: 'Work gloves', look: 'A pair of yellow leather work gloves, molded to somebody\'s hands.', touch: 'Stiff and broken in.', smell: 'Leather and sweat.', draw: spr('i_gloves') },
    i_tapegun: { name: 'Tape gun', look: 'A packing tape gun with half a roll left. The most borrowed tool in any warehouse.', touch: 'You pull the trigger. SCREEEECH.', smell: 'Adhesive.', draw: spr('i_tapegun') }
  };
  const CLUTTER_SPOTS = {
    i_dock: [[-1.2, 7], [2.2, 7.6], [-3, 9.6], [4.4, 8.4], [1.2, 12.4]],
    i_racks: [[-2.6, 6.4], [1.4, 7.6], [-1.2, 13.4], [1.6, 14.4], [-3, 11.6]],
    i_floor: [[-1.4, 6.4], [1, 9.6], [-2.2, 11.2], [4.8, 11.4], [-4.4, 6.4]],
    i_shop: [[-1.6, 13.6], [2.6, 7.6], [-3.6, 7.2], [3.4, 12.8], [.6, 6.4]]
  };

  /* ============================== THE PAPERWORK ============================== */
  const CATS = [
    { name: 'OK / Compliant', short: 'OK', hint: 'Meets the rules. Nothing to do.' },
    { name: 'Note / Housekeeping', short: 'Note', hint: 'Minor: mention it. No correction notice.' },
    { name: 'Correct / Violation', short: 'Correct', hint: 'A violation: written correction, charged back to the tenant. Needs a photo.' },
    { name: 'Stop / Imminent Danger', short: 'Stop', hint: 'Stop the work, clear the area, make it safe, and call it in.' }
  ];
  const BRIEFING = [
    { title: 'Safety walk', art: 'door', text: "Brickroad owns <b>Lot 204</b>, a warehouse and light-manufacturing building, and the tenant runs it. Twice a year we walk it for <b>safety</b> and <b>condition</b>: the lease says they keep it safe, and a hurt worker or a fire is the owner's problem too." },
    { title: 'Suit up first', art: 'dana', text: 'There is a <b>PPE station</b> on the loading dock. Before you walk anywhere, put on what the areas call for: <b>safety glasses</b>, <b>steel-toe boots</b>, a <b>hi-vis vest</b>, a <b>hard hat</b> in the racks, and <b>hearing protection</b> on the production floor. Skip it and it counts against you.' },
    { title: 'Your tools', art: 'verbs', text: 'Same as always: hover over the <b>top edge</b> for the toolbar; <b>right-click</b> cycles Walk, Look, Touch, Smell, and Talk. Your <b>tape measure</b> matters here: guardrail heights, gaps, clearances.' },
    { title: 'Four calls', art: 'cats', text: 'Mark everything <b>OK</b>, <b>Note</b> (housekeeping), <b>Correct</b> (a violation: written up and charged back, with a photo), or <b>Stop</b> (imminent danger: stop the work, make it safe, and call it in).' },
    { title: 'Look it up', art: 'zoom', text: 'The binder has the site <b>SOP</b> and the <b>Field Safety Handbook</b>: OSHA rules in plain language. Citations in your notes are links. The yellow <b>Safety</b> button in a close-up says what applies.' },
    { title: "We're not OSHA", art: 'camera', text: "You can't fine anybody. You <b>document</b> it, require a <b>correction</b> under the lease, and for imminent danger you <b>stop the work</b> and <b>call it in</b> on Dana's BlackBerry. Photos for everything you write up." }
  ];
  const SOP = `
    <div class="pg title-pg"><p class="pg-co">BRICKROAD PROPERTY MGMT.</p><h2>Standard Operating Procedure 9.4</h2><p class="pg-sub">Industrial Safety Walks</p><p class="pg-note">PPE before clipboard. Every time.</p><span class="coffee" aria-hidden="true"></span></div>
    <div class="pg"><h3>The four calls</h3>
      <div class="sop-cat c0" data-sop="c0"><b>0 &middot; OK</b><p>Compliant, and in good shape. Nothing to do.</p></div>
      <div class="sop-cat c1" data-sop="c1"><b>1 &middot; Note</b><p>Housekeeping or a good-practice gap: a faded line, an empty earplug box, a smudged tag. Mention it; no correction notice, no charge.</p></div></div>
    <div class="pg">
      <div class="sop-cat c2" data-sop="c2"><b>2 &middot; Correct</b><p>A violation of the rules or the lease, or damage to the building: a missing guard, a blocked extinguisher, no capacity plaques. A <em>written correction notice</em>, the cost charged back to the tenant, and <em>always a photo</em>.</p></div>
      <div class="sop-cat c3" data-sop="c3"><b>3 &middot; Stop</b><p>Imminent danger: someone could be killed or badly hurt right now. A buckled rack, a chained exit, someone inside a live machine. <em>Stop the work, clear the area, make it safe if you can, and call it in.</em></p></div></div>
    <div class="pg sop-tips"><h3>Field method</h3><ul>
      <li data-sop="ppe"><b>PPE first.</b> The station is on the dock. Each area posts what it needs.</li>
      <li data-sop="look"><b>Look</b> at a feature for a close-up, then <b>touch</b>, <b>smell</b>, and <b>use tools</b> on its parts.</li>
      <li data-sop="measure"><b>Measure</b>: guard gaps, clearances, aisle widths. Numbers end arguments.</li>
      <li data-sop="photo">Every <b>Correct</b> and every <b>Stop</b> gets a <b>photo</b>.</li>
      <li data-sop="safe"><b>Stop</b> means stop: tell the supervisor, keep people back, then call it in on Dana's BlackBerry.</li>
      <li data-sop="finish">When you've seen everything, hit <b>Finish</b>.</li></ul></div>
    <div class="pg sop-tips"><h3>What we look for</h3><ul>
      <li><b>Dock:</b> edges guarded, trailers locked or chocked, forklifts in good repair (1910.178).</li>
      <li><b>Racks:</b> anchored, undamaged, posted limits, 18 inches under the sprinklers (1910.159(c)(10)).</li>
      <li><b>Machines:</b> guards on, interlocks working, lockout for repairs (1910.212; 1910.147).</li>
      <li><b>Exits:</b> clear, lit, and opening from the inside (1910.36; 1910.37).</li>
      <li><b>Chemicals:</b> labeled, documented, and an eyewash close by (1910.1200; 1910.151(c)).</li></ul></div>
    <div class="pg sop-tips"><h3>We're not OSHA</h3><ul>
      <li>OSHA covers the tenant's employees; the lease makes the tenant keep the building safe.</li>
      <li>We can't fine. We document, require correction, and charge back what it costs the owner.</li>
      <li>If a tenant won't fix an imminent danger, Pat calls OSHA: 1-800-321-OSHA.</li>
      <li>The <b>Field Safety Handbook</b> tab has the rules in plain language.</li></ul></div>`;
  const BLANK = {
    ceiling: { look: ['The roof deck: ribbed steel and bar joists, thirty feet up.', 'Steel deck and joists. A pigeon feather drifts down.'], touch: "It's thirty feet up.", smell: 'Dust and machine oil, rising.', talk: 'Your voice echoes off the deck.', flashlight: "The beam doesn't reach. It's a warehouse.", camera: 'A photo of a roof. Not useful.', clipboard: 'Nothing up there to mark.', hammer: "You'd need a lift.", any: 'The roof deck, way up.' },
    wall: { look: ['Painted concrete block, and steel siding above.', 'Block wall. Scuffed at forklift height, like every warehouse.'], touch: 'Cold, hard block.', smell: 'Concrete dust.', talk: 'The wall says nothing.', hammer: 'Tunk. Solid block.', flashlight: 'Raking light across the block: scuffs, no cracks.', camera: 'A photo of block wall. Not useful.', clipboard: "There's nothing there to mark.", any: 'Nothing there.' }
  };
  return { ROOMS, FEATURES, ANOMALIES, CLUTTER, CLUTTER_SPOTS, CATS, BRIEFING, SOP, BLANK };
})();
