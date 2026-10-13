'use strict';
/* ============================== LOT 204: INDUSTRIAL ==============================
   A property manager's safety and condition walk of a tenant's warehouse and light-manufacturing building, October
   2008 (see docs/SITES.md). Four areas, in a row from the street side in: the loading dock (where you suit up), a
   racking aisle, the production floor, and the maintenance shop with its chemical storage. The four codes mean
   OK, Note, Correct, and Stop here. The inspector isn't OSHA: they look, write it up, require correction under the
   lease (charged back to the tenant where it costs the owner money), and for imminent danger they stop the work or
   clear the area and call it in. Citations in the text link to the in-game Field Safety Handbook.
   The drawing lives in js/sites/industrial-art.js (INDA); this file is the data: the areas and their hotspots, the
   checklist and what every sense and tool finds on it, the small finds, the left-behind things, and the paperwork.
   Every id starts with i_. */
(() => {
  const A = INDA, G = A.G, X = INDX;
  /* a quad facing you at depth z (the front of something standing in the room) */
  const Qz = (z, xa, xb, ya, yb) => [P(xa, ya, z), P(xb, ya, z), P(xb, yb, z), P(xa, yb, z)];
  /* a rectangle around a point on screen, w by h pixels */
  const around = (p, w, h, dy = 0) => [[p[0] - w / 2, p[1] - h / 2 + dy], [p[0] + w / 2, p[1] - h / 2 + dy], [p[0] + w / 2, p[1] + h / 2 + dy], [p[0] - w / 2, p[1] + h / 2 + dy]];
  const has = id => (Game.anomalies || []).includes(id);

  /* ============================== AREAS ============================== */
  const ROOMS = {
    i_dock: {
      name: 'Loading Dock', box: { x0: -6.5, x1: 6.5, h: 6.5, zb: 16 }, amb: .5, cmu: 2.4, metal: '#c8ccd0',
      floor: () => {}, floorBase: p => p.floor.base, shell: A.shell,
      walk: { x0: -5.8, x1: 5.8, z0: 5, z1: 14.6 }, start: { x: -2.9, z: 6.6 },
      windows: [],
      doors: [{ id: 'i_toRacks', side: 'right', za: G.dock.toRacks[0], zb: G.dock.toRacks[1], to: 'i_racks', name: 'Racking aisle', walk: { x: 5.8, z: 11.4 }, spawn: { x: -3.1, z: 14.2 } }],
      features: {
        i_dockdoor: { pts: () => Q.back(ROOMS.i_dock.box, G.dock.D1[0] - .3, G.dock.D1[1] + .3, 0, G.dock.dh + .3), walk: { x: -4.7, z: 13.4 } },
        i_restraint: { pts: () => [...Q.back(ROOMS.i_dock.box, G.dock.D2[0], G.dock.D2[1] + 1, .02, G.dock.dh)], walk: { x: .6, z: 13.4 } },
        i_leveler: { pts: () => Q.floor(G.dock.D2[0] + .25, G.dock.D2[1] - .25, 13.7, 16.4), walk: { x: 0, z: 13 } },
        i_forklift: { pts: () => INDA.forkliftOutline(), walk: { x: 3, z: 8.6 } },
        i_charger: { pts: () => { const b = ROOMS.i_dock.box; return unionOutline([Q.left(b, 12.4, 14.6, 1.25, 3.2), hull(boxPts(b.x0 + .05, b.x0 + 1.35, 0, 1.2, 12.8, 14.3)), Q.left(b, 12.6, 13.6, 1.1, 1.4)]); }, walk: { x: -4.2, z: 12.6 } },
        i_firstaid: { pts: () => { const [za, zb, ya, yb] = G.dock.aid, x1 = ROOMS.i_dock.box.x1, open = cond('i_firstaid') === 2 || !!(Game.flags.i_firstaid && Game.flags.i_firstaid.open); return hull([...boxPts(x1 - .25, x1, ya, yb, za, zb), ...(open ? [P(x1 - 1.13, ya, zb - .15), P(x1 - 1.13, yb, zb - .15)] : [])]); }, walk: { x: 5.6, z: 8.2 } },
        i_dockfloor: { pts: () => Q.floor(-4.2, 0, 8.8, 11.6), walk: { x: -1.4, z: 8.4 } }
      },
      scenery: [
        ...ppeScenery(),
        { id: 'i_s_ppeboard', name: 'PPE station', pts: () => Qz(G.dock.rack.z + .1, G.dock.rack.x0, G.dock.rack.x1, .1, 2.95), walk: { x: -3.4, z: 6.4 },
          look: () => PPE.all().every(id => PPE.has(id)) ? "The PPE station, picked over. You're wearing most of it." : 'A pegboard PPE station by the dock entrance: hard hats, safety glasses, vests, earplugs and muffs, and loaner steel-toes. Click a piece to put it on.',
          touch: 'Pegboard and steel shelving. Somebody keeps it stocked.', smell: 'New rubber and foam earplugs.' },
        { id: 'i_s_ppesign', name: 'PPE notice', pts: () => Qz(G.dock.rack.z, G.dock.rack.x1 - .62, G.dock.rack.x1 - .08, 2.08, 2.55), walk: { x: -3.4, z: 6.4 },
          look: 'NOTICE: Past this point, safety glasses, steel-toe boots, and a hi-vis vest. Hard hats in the racking aisle (overhead loads). Hearing protection on the production floor. Visitors too.',
          touch: 'Laminated, and zip-tied to the pegboard. Somebody meant it.' },
        { id: 'i_s_rules', name: 'Dock rules sign', pts: () => Q.back(ROOMS.i_dock.box, -2.55, -1.87, 1.45, 2.35), walk: { x: -2.2, z: 13.4 },
          look: 'DOCK RULES: 1. Chock or lock every trailer. 2. Gate across any open door. 3. Horn at every doorway. 4. 5 MPH. 5. No riders. Rule 5 is underlined twice.' },
        { id: 'i_s_door3', name: 'Dock door 3', pts: () => Q.back(ROOMS.i_dock.box, G.dock.D3[0], G.dock.D3[1], 0, G.dock.dh), walk: { x: 4.7, z: 13.4 },
          look: 'Door 3, shut, with its leveler stored flat. Nothing scheduled at this door today.', touch: 'Cold steel slats. It rattles a little in the wind.', hammer: 'BWONG. The whole door rings like a gong. Everybody on the dock looks up.' },
        { id: 'i_s_extdock', name: 'Fire extinguisher', pts: () => Q.right(ROOMS.i_dock.box, 13.4, 13.8, .85, 2.15), walk: { x: 5.6, z: 13.4 },
          look: 'A 10-pound ABC extinguisher on its hook, sign above it. The tag was punched in September. Pin and seal in place, needle in the green.', touch: 'Full and heavy. Mounted where you can grab it.' }
      ],
      walls: A.dock.walls, dynamic: A.dock.dynamic
    }
  };
  /* the pieces on the PPE station, each its own hotspot (clicking one puts it on: js/ppe.js) */
  function ppeScenery() {
    const z = G.dock.rack.z - .02, S = G.dock.ppe;
    const look = { hardhat: 'White hard hats on the shelf, Type I, Class E. The notice says the racking aisle is a hard hat area: loads overhead.', glasses: 'A box of clear wraparound safety glasses, Z87+ on every temple.',
      vest: 'Orange hi-vis vests on a hook, Class 2, with reflective stripes. Required anywhere forklifts run.', ears: 'A foam earplug dispenser, and a pair of earmuffs hung over it. For the production floor.', boots: 'A pair of steel-toe boots in your size. Visitor loaners, sprayed and bagged after every use.' };
    return Object.keys(S).map(id => ({ id: 'i_ppe_' + id, name: PPE_ITEMS[id].name, ppe: id, when: () => !PPE.has(id), pts: () => { const [xa, xb, ya, yb] = S[id]; return growPoly(Qz(z, xa, xb, ya, yb), 2); },
      walk: { x: -3.4, z: 6.4 }, look: look[id], touch: PPE_ITEMS[id].on, smell: id === 'boots' ? 'Disinfectant spray. Mostly.' : 'New plastic.' }));
  }

  /* ============================== THE CHECKLIST ============================== */
  const FEATURES = [
    /* ---------------- LOADING DOCK ---------------- */
    { id: 'i_dockdoor', room: 'i_dock', name: 'Dock Door 1 & Edge', say: 'dock edge at door 1', art: 'i_dockdoor',
      hint: "An open dock door with no trailer in it is a four-foot drop. Check what stands between the floor and the yard.",
      osha: 'An open dock edge four feet or more above the yard needs a barrier, a gate, chain, or bar, or the door down (1910.28(b)(1)). Keep the edge stripe bright so nobody walks or drives off it (1910.22(a)).',
      parts: [{ id: 'door', name: 'roll-up door', r: [44, 0, 152, 9] }, { id: 'edge', name: 'dock edge', r: [40, 100, 160, 24] }, { id: 'gate', name: 'safety gate', r: [26, 54, 188, 46] }, { id: 'yard', name: 'the yard outside', r: [44, 9, 152, 45] }],
      base: { yard: { look: 'The truck yard, four feet down: asphalt, parking stripes, and a few trailers waiting on the far side.', smell: 'Diesel and cold asphalt.', tape: "You'd need a much longer tape. And a death wish." },
        door: { look: 'The roll-up door, all the way up on its coil. The pull rope dangles by the jamb.', touch: "You could pull it down from here. It isn't your door, but you make a note." },
        edge: { smell: 'Rubber, diesel, and October.' }, '*': { talk: 'You call "Hello?" out into the yard. A pigeon answers.' } },
      variants: [
        { cat: 0, desc: 'Door 1 is up with no trailer in it, and a yellow steel gate is latched across the opening.', key: ['gate'],
          resp: { gate: { look: 'A swing gate: two striped rails, knee and waist high, latched at the far post.', touch: { t: 'You lean on the top rail. Solid, and the latch pin is all the way home.', clue: 'gate' }, tape: { t: 'The top rail is 42 inches off the floor. Textbook.', clue: 'gate' } },
            edge: { look: { t: 'A bright yellow-and-black stripe along the edge. Fresh paint this year.', clue: 'gate' }, tape: '48 inches from the dock floor to the pavement. The gate is what keeps that from mattering.' } },
          why: 'The open door has a latched gate across it and a bright edge stripe. That is what the rule asks for: nothing to do (1910.28(b)(1)).' },
        { cat: 1, desc: 'Door 1 is up on an empty yard. The safety gate is there, but it has been swung back into the dock.', key: ['unlatched', 'faded'],
          resp: { gate: { look: { t: 'The gate is swung open, its latch pin dangling on a chain. Someone pulled it back to load and never closed it.', clue: 'unlatched' }, touch: { t: 'You swing it shut and drop the pin. It latches fine. Nothing broken, just left open.', clue: 'unlatched' } },
            edge: { look: { t: 'The edge stripe is worn down to gray where the forklifts cross it.', clue: 'faded' }, touch: { t: 'Smooth, worn paint. The steel nosing under it is fine.', clue: 'faded' }, tape: '48 inches down to the pavement.' } },
          why: "The gate works; it was just left open, and the stripe is worn. Note it: keep the gate latched whenever there's no trailer (1910.28(b)(1)), and repaint the edge (1910.22(a))." },
        { cat: 2, cost: 450, desc: 'Door 1 is rolled up on an empty yard, and nothing stands across the opening.', key: ['drop', 'nogate'],
          resp: { edge: { look: { t: 'Straight down to the asphalt. No gate, no chain, no bar.', clue: 'nogate' }, tape: { t: '48 inches from the dock floor to the pavement. A four-foot drop with nothing in the way.', clue: 'drop' }, touch: 'You stay a respectful step back from the edge.' },
            gate: { look: { t: 'No gate. Two empty mounting brackets on the jamb where one used to hang.', clue: 'nogate' }, screwdriver: { t: 'The brackets are fine; the gate itself is gone. Probably leaning in a corner somewhere, or in a dumpster.', clue: 'nogate' } } },
          why: "An open dock door with no trailer and no barrier is an unprotected four-foot edge (1910.28(b)(1)). Correction notice: door down or a gate across whenever there's no trailer. The replacement gate is charged back. Photo it." },
        { cat: 3, desc: 'Door 1 is wide open on an empty yard. A loaded pallet sits right on the edge, and forklift tracks run up to it.', key: ['pallet', 'tracks'],
          resp: { edge: { look: { t: "The pallet's front boards hang out over thin air. Whoever set it there was driving a forklift right at an open four-foot drop.", clue: 'pallet' }, tape: { t: 'The pallet overhangs the edge by about 10 inches. Below that, 48 inches of nothing.', clue: 'pallet' }, touch: "You are not touching a loaded pallet balanced on a dock edge." },
            gate: { look: { t: 'No gate, no chain. Fresh black tire tracks run straight to the edge and stop.', clue: 'tracks' }, flashlight: { t: 'The tracks are fresh rubber, this morning. The truck backed off with inches to spare.', clue: 'tracks' } } },
          why: 'Forklift work at an open, unguarded four-foot edge can put a truck, a load, or a person over it at any moment (1910.28(b)(1)). Stop the work at that door, get the door down or a barrier up, and call it in.' }
      ] },
    { id: 'i_restraint', room: 'i_dock', name: 'Trailer Restraint & Chocks', say: 'trailer restraint at door 2', art: 'i_restraint',
      hint: "Before a forklift drives into a trailer, the trailer can't be able to roll. Check the light, the hook, and the wheels.",
      osha: 'Trailer wheels are chocked, or the trailer is locked to the dock with a restraint, before a forklift drives into it (1910.178(k)(1); 1910.26(d)).',
      parts: [{ id: 'light', name: 'signal light', r: [8, 4, 30, 42] }, { id: 'chock', name: 'wheel chock', r: [206, 100, 34, 32] }, { id: 'hook', name: 'vehicle restraint', r: [38, 62, 48, 50] }, { id: 'wheels', name: 'rear wheels', r: [116, 74, 96, 58] }, { id: 'trailer', name: 'trailer', r: [62, 0, 178, 64] }],
      base: { trailer: { look: 'A 53-foot dry van, backed in to door 2 and half loaded with shrink-wrapped pallets.', touch: 'Cold aluminum, ribbed.', smell: 'Cardboard and road grime.' },
        wheels: { look: 'Tandem rear axles, eight tires.', tape: "Good tread. Not your department." }, light: { touch: 'You are outside, at the driver\'s light. The buttons are inside by the door.' } },
      variants: [
        { cat: 0, desc: 'The restraint light by door 2 is green, and a yellow chock sits snug against a rear tire.', key: ['locked'],
          resp: { light: { look: { t: 'Green outside for the driver, green inside for the forklift. The restraint has the trailer.', clue: 'locked' } },
            hook: { look: { t: "The restraint's hook is up over the trailer's rear bumper bar, holding it to the dock.", clue: 'locked' }, touch: { t: 'You tug the bar. The hook has it. That trailer is not going anywhere.', clue: 'locked' } },
            chock: { look: 'A heavy yellow chock wedged against the tire, chained to the building.', touch: { t: 'Solid rubber, snug against the tread.', clue: 'locked' } } },
          why: 'Locked to the dock and chocked. A forklift can drive in safely. Nothing to do (1910.178(k)(1)).' },
        { cat: 1, desc: 'The light by door 2 is green. The wheel chock looks like it has seen things.', key: ['split'],
          resp: { light: { look: 'Green. The restraint is engaged.' }, hook: { look: 'The hook is up over the bumper bar. Holding fine.', touch: 'Solid.' },
            chock: { look: { t: 'The chock is split down its back, and the chain that keeps it at the dock is gone.', clue: 'split' }, touch: { t: 'It wobbles when you press it, and a chunk of rubber flakes off in your hand.', clue: 'split' } } },
          why: 'The restraint is doing the real work; the chock is just worn out. Note it: replace the chock and its chain (1910.26(d)).' },
        { cat: 2, cost: 150, desc: "The restraint light by door 2 is red, and a forklift has been in and out of this trailer all morning.", key: ['red', 'bare'],
          resp: { light: { look: { t: 'Red. The restraint is not engaged, and the inside light says the same.', clue: 'red' } },
            hook: { look: { t: 'The hook is stowed down on the dock face. Nothing is holding the trailer.', clue: 'red' }, touch: "Down and idle. The crew's job is to raise it before they load." },
            chock: { look: { t: 'No chock at the wheels. It is lying out on the apron, ten feet away.', clue: 'bare' } }, wheels: { look: { t: 'Bare tires. Nothing in front of them but asphalt.', clue: 'bare' } } },
          why: "A trailer being loaded with no chock and no restraint can roll away under a forklift (1910.178(k)(1)). Correction notice: no loading until it's secured, and retrain the dock crew. The restraint service call is charged back. Photo it." },
        { cat: 3, desc: 'The restraint light by door 2 is red, and the trailer looks farther from the building than it should.', key: ['gap', 'creep'],
          resp: { light: { look: { t: 'Red. Nothing has the trailer.', clue: 'gap' } }, hook: { look: 'Stowed down. Not engaged.' },
            trailer: { look: { t: "There's a dark gap between the dock bumpers and the trailer, and the leveler lip barely reaches its floor.", clue: 'gap' }, tape: { t: 'Six inches from the bumper to the trailer. It was tight to the dock when it backed in.', clue: 'creep' } },
            wheels: { look: { t: 'No chocks. Every time a forklift drives in, the trailer shoves out a little more.', clue: 'creep' } }, chock: { look: { t: 'No chock. Just asphalt.', clue: 'creep' } } },
          why: 'A trailer creeping away from the dock with forklifts driving in and out can drop a truck and its driver into the gap (1910.178(k)(1)). Stop all loading at door 2, chock it and lock it to the dock, and call it in.' }
      ] },
    { id: 'i_leveler', room: 'i_dock', name: 'Dock Leveler', say: 'dock leveler at door 2', art: 'i_leveler', floor: true,
      hint: 'Stand on the leveler and look at the lip, the hinge, and the pit along its sides.',
      osha: 'A dock leveler has to hold the load on it, stay put, and be kept in good repair (1910.26(a), (c); 1910.22(d)(2)). The leveler belongs to the building, so damage to it is charged back.',
      parts: [{ id: 'lip', name: 'leveler lip', r: [42, 0, 198, 26] }, { id: 'pit', name: 'leveler pit', r: [12, 22, 30, 113] }, { id: 'deck', name: 'leveler deck', r: [42, 26, 198, 109] }],
      base: { deck: { look: 'Diamond-plate steel, scuffed silver by forklift tires.', touch: 'Grippy tread under your boots.', hammer: { t: 'Bong. Solid steel.', sfx: 'thud' } },
        pit: { smell: 'Dust and hydraulic oil, faintly.', touch: "You don't put your hand in a leveler pit. Ever." }, lip: { smell: 'Steel and trailer floor.' } },
      variants: [
        { cat: 0, desc: 'The leveler deck is flat, and its lip lies square on the trailer bed.', key: ['flush'],
          resp: { lip: { look: { t: 'The lip lies flat on the trailer floor, full width. No step, no gap.', clue: 'flush' }, hammer: { t: 'Solid. No rattle at the hinge.', clue: 'flush', sfx: 'thud' } }, pit: { look: 'The pit is swept clean.', flashlight: { t: 'Down in the pit: clean concrete and a dry hydraulic cylinder. Somebody actually sweeps under here.', clue: 'flush' } } },
          why: 'Flat, secure, and in good repair. Nothing to do.' },
        { cat: 1, desc: 'The leveler works fine. The pit along its sides is another story.', key: ['debris'],
          resp: { pit: { look: { t: 'The gap along the deck is packed with shrink wrap, banding, and pallet chips.', clue: 'debris' }, flashlight: { t: 'A drift of wrap and wood chips around the hydraulic cylinder. It jams the toe guards, and it burns.', clue: 'debris' } }, lip: { look: 'Flat on the trailer bed.' } },
          why: "A pit full of trash is housekeeping, not damage (1910.22(a)(1)). Note it, and ask the tenant to clean it out." },
        { cat: 2, cost: 650, desc: 'The leveler deck has a long scar across it, and something is missing at its side.', key: ['gouge', 'guard'],
          resp: { deck: { look: { t: 'A long, bright gouge across the deck where a fork tip dragged.', clue: 'gouge' }, touch: { t: "Your finger catches in it. The plate is cut, not scuffed.", clue: 'gouge' }, tape: { t: 'Thirty inches of gouge, an eighth of an inch deep.', clue: 'gouge' } },
            pit: { look: { t: "The toe guard on this side is torn half off. With the deck raised, nothing keeps a foot out of the pit.", clue: 'guard' }, screwdriver: { t: "The guard's hinge bolts sheared off. It was hit, not worn out.", clue: 'guard' } } },
          why: "A forklift gouged the deck and tore a toe guard off the owner's leveler. Damage to the owner's equipment: correction notice, and the repair is charged back (1910.22(d)(2)). Photo it." },
        { cat: 3, desc: 'The leveler lip sits a little crooked on the trailer bed.', key: ['crack', 'pop'],
          resp: { lip: { look: { t: 'A crack runs along the hinge line, and the lip sags at one corner.', clue: 'crack' }, hammer: { t: 'The lip clanks and shifts under the tap. The hinge is broken through.', clue: 'crack', sfx: 'thud' }, touch: { t: 'You step on the corner and it drops half an inch with a loud pop.', clue: 'pop' } },
            deck: { flashlight: { t: 'Bright, fresh metal in the crack. It is still spreading.', clue: 'crack' } } },
          why: 'A cracked lip hinge can let go under a loaded forklift and drop it between the dock and the trailer (1910.26(a)). Stop: tag the leveler out of service, no traffic over it, and call it in.' }
      ] },
    { id: 'i_forklift', room: 'i_dock', name: 'Forklift', art: 'i_forklift',
      hint: 'Check the plate, the horn, the belt, and what is under it. And where the forks are.',
      osha: 'Forklifts are examined before each shift, and one that needs repair comes out of service (1910.178(q)(1), (q)(7)). Only trained, evaluated drivers run them (1910.178(l)), and nobody rides the forks (1910.178(m)(12)).',
      parts: [{ id: 'plate', name: 'capacity plate', r: [122, 72, 24, 14] }, { id: 'horn', name: 'horn button', r: [100, 36, 20, 14] }, { id: 'mirror', name: 'mirror', r: [86, 6, 20, 18] }, { id: 'belt', name: 'seat belt', r: [152, 52, 18, 30] },
        { id: 'checklist', name: 'checklist', r: [180, 26, 20, 28] }, { id: 'forks', name: 'forks and mast', r: [0, 6, 84, 120] }, { id: 'floor', name: 'floor under the truck', r: [84, 124, 156, 11] }, { id: 'body', name: 'forklift', r: [84, 6, 156, 118] }],
      base: { body: { look: 'A sit-down electric forklift, 5,000-pound class. FL-2, says the stencil.', touch: 'Warm battery hum through the cowl. It has been working.', smell: 'Warm electronics and rubber.', talk: "You ask the forklift if it's been good. It beeps, once, unprompted. Unsettling." },
        floor: { look: 'Concrete and tire scuffs.' }, mirror: { look: 'A convex mirror on the guard post.' }, belt: { look: 'An orange lap belt.', touch: 'It clicks and retracts.' } },
      variants: [
        { cat: 0, desc: 'A sit-down electric forklift, parked with its forks down. A checklist is clipped to the guard.', key: ['checked'],
          resp: { horn: { touch: { t: 'BEEEP. Loud and clear.', clue: 'checked', sfx: 'beep' } }, checklist: { look: { t: "Today's pre-shift check: tires, forks, chains, horn, lights, brakes, belt. Every box ticked, initialed R.G.", clue: 'checked' } },
            plate: { look: { t: 'Capacity 5,000 lb at a 24-inch load center. Crisp and readable.', clue: 'checked' } }, floor: { flashlight: 'Dry under the mast. No drips.' }, forks: { look: 'Forks flat on the floor, tips down. Parked right.' } },
          why: 'Checked today, plate readable, horn and belt working, forks down. Nothing to do (1910.178(q)(7)).' },
        { cat: 1, desc: 'The forklift is parked right, but it looks a little tired.', key: ['mirror', 'nolist'],
          resp: { mirror: { look: { t: 'The mirror is cracked and knocked crooked. It shows you the ceiling.', clue: 'mirror' } }, checklist: { look: { t: "An empty clip. No checklist today. The driver may well have done the check; there's just nothing written down.", clue: 'nolist' } },
            plate: { look: 'The decals are sun-faded, but the capacity plate still reads 5,000 lb.' }, horn: { touch: { t: 'BEEEP.', sfx: 'beep' } }, forks: { look: 'Forks down. Good.' } },
          why: 'A cracked mirror and no written checklist are good-practice gaps: OSHA requires the daily check, not the paper (1910.178(q)(7)). Note them.' },
        { cat: 2, cost: 275, desc: 'The forklift is parked in the lane with a dark puddle under its mast.', key: ['leak', 'horn'],
          resp: { floor: { look: { t: 'A puddle of hydraulic fluid under the mast, rainbow at the edges.', clue: 'leak' }, touch: { t: 'Slick and oily. Fresh.', clue: 'leak' }, smell: 'Hydraulic oil.' },
            forks: { flashlight: { t: 'Fluid is weeping down the lift cylinder from a blown seal.', clue: 'leak' } }, horn: { touch: { t: 'You press the horn. Click. Nothing. Dead.', clue: 'horn' } }, checklist: { look: 'No checklist. Of course not.' } },
          why: "A dead horn and a leaking lift cylinder mean the truck should be parked until it's fixed (1910.178(q)(1)); this one is still running. Correction notice, and the slab cleanup under it is charged back. Photo it." },
        { cat: 3, desc: 'The forks are raised high in the air, with a pallet up on them.', key: ['ride', 'raised'],
          resp: { forks: { look: { t: 'The forks are up about ten feet with a loose pallet on them, and a box cutter and a pick list sitting on the pallet. Someone has been riding up there to reach the top shelf.', clue: 'ride' },
              tape: { t: 'About ten feet to the bottom of the pallet. No cage, no rail, nothing to clip to.', clue: 'raised' } },
            floor: { look: { t: "Boot prints in the dust on the pallet's edge, right above you.", clue: 'ride' } }, checklist: { look: 'No checklist.' }, horn: { touch: { t: "Beep. The horn works. That isn't the problem.", sfx: 'beep' } } },
          why: 'Lifting a person on a bare pallet is how people fall ten feet onto concrete; only a secured work platform is allowed (1910.178(m)(12)), and raised forks left unattended are their own hazard. Stop: lower the forks, find the supervisor, and call it in.' }
      ] },
    { id: 'i_charger', room: 'i_dock', name: 'Battery Charging Area', art: 'i_charger',
      hint: 'Battery charging needs no smoking, protection, and water close by for acid splashes. Use your nose.',
      osha: 'Charging areas have no smoking, protection for the chargers, ventilation, and a way to flush and neutralize spilled electrolyte (1910.178(g)(1), (g)(2), (g)(10)). Where acid can splash, an eyewash is close by (1910.151(c)).',
      parts: [{ id: 'sign', name: 'danger sign', r: [6, 4, 72, 34] }, { id: 'kit', name: 'spill kit', r: [180, 100, 40, 35] }, { id: 'eyewash', name: 'eyewash', r: [178, 22, 60, 78] }, { id: 'charger', name: 'charger', r: [84, 4, 62, 64] }, { id: 'battery', name: 'battery', r: [50, 66, 128, 60] }],
      base: { charger: { look: 'An industrial charger, 36 volts, its display counting the charge up.', touch: 'Warm, humming.', smell: 'Warm dust.' },
        battery: { look: 'A forklift battery: a steel tray of big lead-acid cells, each with a vent cap.' }, sign: { look: 'DANGER: NO SMOKING, NO OPEN FLAMES. BATTERY CHARGING AREA.' } },
      variants: [
        { cat: 0, desc: 'The charging area: chargers on the wall, a battery on its stand, and an eyewash and spill kit at the end of the row.', key: ['flush'],
          resp: { eyewash: { touch: { t: 'You push the flag. Both nozzles pop up and run clean, cool water. The tag says it is tested every week.', clue: 'flush', sfx: 'drip' }, look: 'A plumbed eyewash with a yellow push flag. Nothing in the way.' },
            kit: { look: { t: 'An unopened bag of acid neutralizer, goggles, gloves, and an apron. Ready.', clue: 'flush' } }, battery: { smell: 'Nothing much. A clean charge, good ventilation.' } },
          why: 'Signs, bollards, an eyewash that works, and a neutralizer kit. Nothing to do.' },
        { cat: 1, desc: 'The charging area is set up right, but the battery tops look crusty.', key: ['crust'],
          resp: { battery: { look: { t: 'White crust around the vent caps and terminals: dried electrolyte spray.', clue: 'crust' }, smell: { t: 'Faintly sour. Old acid.', clue: 'crust' }, touch: "Not with bare hands. You poke it with the pencil: chalky crust." },
            kit: { look: { t: 'The neutralizer bag is half used and folded over.', clue: 'crust' } }, eyewash: { touch: { t: 'It runs clean.', sfx: 'drip' } } },
          why: 'Crusty battery tops and a half-used neutralizer bag are upkeep, not a violation. Note it: clean the tops and restock the kit (1910.178(g)(2)).' },
        { cat: 2, cost: 180, desc: 'The charging area is crowded. Something is stacked at the end of the row.', key: ['blocked', 'dry'],
          resp: { eyewash: { look: { t: "A stack of pallets stands right in front of the eyewash. You'd have to climb over them with your eyes burning.", clue: 'blocked' }, touch: { t: 'You reach over the pallets and push the flag. A cough, a sputter, nothing. The supply valve is shut off.', clue: 'dry' } },
            kit: { look: { t: 'The spill kit bucket is empty.', clue: 'dry' } } },
          why: 'An eyewash that is blocked and dry, where workers handle battery acid, is a violation (1910.151(c)). Correction notice: clear it, turn the water back on, test it weekly, and restock the neutralizer (1910.178(g)(2)). The plumber is charged back.' },
        { cat: 3, desc: 'One of the batteries on charge looks puffy, and there is a smell.', key: ['sulfur', 'swollen', 'heat'],
          resp: { battery: { smell: { t: 'Rotten eggs. The battery is cooking.', clue: 'sulfur' }, look: { t: 'The steel case is bulging, and the cells are hissing and spitting.', clue: 'swollen', sfx: 'hiss' }, touch: { t: 'You hold your hand near it, not on it. Heat, from a foot away.', clue: 'heat' } },
            charger: { look: 'Still charging, into a battery that is boiling.' } },
          why: 'A swollen, hissing battery with a rotten-egg smell is boiling over and venting hydrogen: fire, explosion, and acid all at once (1910.178(g)(10), (g)(11)). Stop: clear the area, kill the charger at the wall only if you can do it safely, no sparks, and call it in.' }
      ] },
    { id: 'i_firstaid', room: 'i_dock', name: 'First Aid Cabinet', art: 'i_firstaid',
      hint: 'Open the first aid cabinet. Is it stocked, and has anyone checked it lately?',
      osha: "First aid supplies have to be readily available, and someone on site is trained to use them when there's no clinic close by (1910.151(b)). Where corrosives can splash, add an eyewash (1910.151(c)).",
      parts: [{ id: 'log', name: 'inspection log', r: [178, 40, 40, 56] }, { id: 'door', name: 'cabinet', r: [52, 8, 124, 122] }],
      base: { door: { touch: [{ if: 'open', t: 'You close the cabinet.', toggle: 'open', sfx: 'click' }, { t: 'You swing the cabinet open.', toggle: 'open', sfx: 'click' }], smell: 'Band-aids and rubbing alcohol.' } },
      variants: [
        { cat: 0, desc: 'A white steel first aid cabinet with a green cross, and a log card beside it.', key: ['stocked'],
          resp: { door: { look: [{ if: 'open', t: 'Bandages, gauze, tape, burn gel, two eyewash bottles, gloves, a CPR mask, and cold packs. Full, and nothing expired.', clue: 'stocked' }, { t: 'A white steel first aid cabinet. Touch it to open it.' }] },
            log: { look: { t: 'Initialed every month this year. Last check: October 1, by D. Okafor.', clue: 'stocked' } } },
          why: 'Stocked, in date, and checked every month. Nothing to do (1910.151(b)).' },
        { cat: 1, desc: 'A white steel first aid cabinet with a green cross, and a log card beside it.', key: ['low', 'late'],
          resp: { door: { look: [{ if: 'open', t: 'Mostly stocked, but the bandage box is down to a few, and the burn gel is gone.', clue: 'low' }, { t: 'A white steel first aid cabinet. Touch it to open it.' }] },
            log: { look: { t: 'Initials every month through July. Nobody has signed it since.', clue: 'late' } } },
          why: "Still well stocked; a few things used up and a log that lapsed. Note it: restock, and get the monthly check back on someone's calendar." },
        { cat: 2, cost: 95, desc: 'The first aid cabinet door hangs open.', key: ['empty', 'expired'],
          resp: { door: { look: { t: 'Nearly empty: a roll of tape, one glove, and two eyewash bottles that expired in 2006.', clue: 'empty' }, touch: { t: "The latch is broken; it won't stay shut. You pick up an eyewash bottle: EXP 03/06.", clue: 'expired' } },
            log: { look: { t: 'The log card is blank. Not one initial.', clue: 'empty' } } },
          why: 'An empty first aid cabinet with expired eyewash means supplies are not readily available (1910.151(b)). Correction notice; the restock is charged back. Photo it.' }
      ] },
    { id: 'i_dockfloor', room: 'i_dock', name: 'Dock Floor & Pallets', art: 'i_dockfloor', floor: true,
      hint: 'Look at the floor where the forklifts turn. Trash, broken pallets, and slick spots all count.',
      osha: "Floors are kept clean, orderly, and dry (1910.22(a)(1), (a)(2)); materials are stacked so they can't slide or fall, and piles don't become trip hazards (1910.176(b), (c)).",
      parts: [{ id: 'bin', name: 'banding bin', r: [118, 6, 32, 50] }, { id: 'stack', name: 'pallet stack', r: [152, 6, 88, 112] }, { id: 'lane', name: 'turning lane', r: [0, 40, 240, 95] }],
      base: { lane: { touch: 'Sealed concrete, gritty with dust.', smell: 'Cardboard dust and tire rubber.' }, bin: { look: 'A blue drum for scrap banding and wrap.' } },
      variants: [
        { cat: 0, desc: 'The turning lane in front of doors 1 and 2: swept, with empty pallets stacked flat out of the way.', key: ['clean'],
          resp: { lane: { look: { t: 'Swept and clear. The lane lines are bright.', clue: 'clean' }, touch: { t: 'Dry and gritty. Good traction.', clue: 'clean' } }, stack: { look: 'Empty pallets stacked flat and square, chest high.', touch: { t: "You push the stack. It doesn't budge.", clue: 'clean' } }, bin: { look: 'The banding bin, half full. Where it all belongs.' } },
          why: 'Clean lane, pallets stacked flat and out of the way. Nothing to do.' },
        { cat: 1, desc: 'The turning lane is littered with curls of shrink wrap and loose strapping.', key: ['wrap'],
          resp: { lane: { look: { t: 'Shrink wrap and black strapping scattered across the lane.', clue: 'wrap' }, touch: { t: 'The wrap is slick underfoot, and the strapping wants to wrap your ankle.', clue: 'wrap' } }, bin: { look: 'The bin is right there. Half empty. Sigh.' }, stack: { look: 'The pallets are stacked fine.' } },
          why: 'Wrap and strapping on the floor is housekeeping (1910.22(a)(1)). Note it; the bin is ten feet away.' },
        { cat: 2, cost: 120, desc: 'A heap of broken pallets lies in the lane, and the stack beside it leans hard.', key: ['nails', 'lean'],
          resp: { lane: { look: { t: 'Broken pallet boards everywhere, nails pointing up.', clue: 'nails' }, touch: { t: 'You nearly put your palm on a nail. Two inches, rusty, straight up.', clue: 'nails' } },
            stack: { look: { t: 'The stack is built out of broken pallets and leans a good six inches off plumb.', clue: 'lean' }, touch: { t: 'It sways when you push it. You stop pushing it.', clue: 'lean' }, tape: { t: 'Six and a half feet tall and seven inches out of plumb.', clue: 'lean' } } },
          why: "Broken pallets with nails up and a leaning stack in a travel lane are trip and tip-over hazards (1910.22(a)(3); 1910.176(b)). Correction notice; hauling the scrap away is charged back. Photo it." },
        { cat: 3, desc: 'Something is shining on the floor in the turning lane.', key: ['slick'],
          resp: { lane: { look: { t: 'A wide slick of oil right across the turning lane, smeared by tire tracks.', clue: 'slick' }, touch: { t: 'Your boot slides. Slick as ice.', clue: 'slick' }, smell: { t: 'Hydraulic oil.', clue: 'slick' }, flashlight: { t: 'The slick runs ten feet, rainbow in the light. Forklifts are still driving through it.', clue: 'slick' } } },
          why: 'Oil across the forklift turning lane can slide a truck into a rack or a person (1910.22(a)(2)). Stop: block off the lane, put down absorbent, find the leak, and call it in.' }
      ] }
  ];

  /* ============================== SMALL FINDS ============================== */
  const ANOMALIES = [
    { id: 'i_a_lamp', room: 'i_dock', name: 'Burned-out light', cat: 1, pts: () => around(P(4.5, 5.3, 12.5), 18, 14), walk: { x: 4.5, z: 10.4 },
      look: 'One of the high-bay lights is dark. Dead lamp, or a dead ballast.', flashlight: "Your flashlight doesn't reach that high. It's dark either way.",
      why: 'A burned-out lamp is upkeep, not a hazard; the dock is still well lit. Note it.', draw() {} },
    { id: 'i_a_pigeon', room: 'i_dock', name: 'Pigeon in the rafters', cat: 0, pts: () => around(P(-1.8, 6.1, 14.5), 14, 10), walk: { x: -1.8, z: 12 },
      look: 'A pigeon on a bar joist, watching you write things down.', talk: 'You coo at it. It coos back. A connection.',
      why: "Pigeons find their way into every warehouse with a dock door. Not a finding, unless it starts nesting on the sprinkler pipe.",
      draw(g) { const p = P(-1.8, 6.05, 14.5); pxRect(g, p[0] - 2, p[1] - 2, 5, 3, '#8a8e9a'); pxRect(g, p[0] + 2, p[1] - 3, 2, 2, '#6a6e7a'); pxRect(g, p[0] + 3, p[1] - 3, 1, 1, '#c86a28'); pxRect(g, p[0] - 3, p[1] - 1, 2, 1, '#5a5e6a'); } },
    { id: 'i_a_seal', room: 'i_dock', name: 'Torn dock seal', cat: 1, pts: r => Q.back(r.box, G.dock.D3[1], G.dock.D3[1] + .4, .4, 2.4), walk: { x: 5.6, z: 13.4 },
      look: 'The foam pad on door 3 is torn open where trailers rub it. Yellow foam is showing through.', touch: 'Crumbly foam under torn vinyl.',
      why: 'Trailers chew up dock seals; that is what they are for. Wear and tear on the building: note it for replacement.',
      draw(g, r) { const zb = r.box.zb, x = G.dock.D3[1] + .19; fillPoly(g, [P(x - .08, 1.9, zb), P(x + .1, 1.7, zb), P(x + .06, .9, zb), P(x - .1, 1.1, zb)], '#d8b040'); lineW(g, P(x - .1, 1.92, zb), P(x - .12, 1.0, zb), '#3a3c42'); } },
    { id: 'i_a_board', room: 'i_dock', name: 'Safety scoreboard', cat: 0, pts: r => Q.back(r.box, -5.85, -4.85, 4.2, 4.75), walk: { x: -4.4, z: 13.4 },
      look: "A board over the dock: 'THIS FACILITY HAS WORKED 212 DAYS WITHOUT A LOST-TIME ACCIDENT.' The 212 is on flip cards. Somebody flips them every morning.", touch: 'You resist the urge to flip it to 213.',
      why: 'A safety scoreboard is a good sign, not a finding. Nothing to do.',
      draw(g, r) { const q = Q.back(r.box, -5.85, -4.85, 4.2, 4.75), b = polyBox(q); pxRect(g, b.x0 - 1, b.y0 - 1, b.x1 - b.x0 + 2, b.y1 - b.y0 + 2, '#2a2c32'); pxRect(g, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, '#2a8a4a'); A.txt(g, '212', b.cx, b.y0 + 2, '#ffffff', 1, 'c'); } },
    { id: 'i_a_tape', room: 'i_dock', name: 'Peeling floor tape', cat: 1, pts: () => Q.floor(-2.6, -.6, 7.7, 8.4), walk: { x: -1.6, z: 7.2 },
      look: 'The yellow floor tape marking the walkway is peeling up at one end.', touch: 'You press it down. It springs right back up. Old adhesive.',
      why: 'Lifting floor tape is housekeeping; it gets re-taped. Note it before it becomes a trip.',
      draw(g) { for (let x = -2.6; x < -.6; x += .1) fillPoly(g, Q.floor(x, x + .1, 7.9, 8.05), '#e0b820'); const a = P(-.75, .05, 7.95), b = P(-.55, 0, 8.2); pxLine(g, a[0], a[1], b[0], b[1], '#f2c418', 2); } }
  ];
  /* the burned-out light is drawn by the room itself (its glow goes out too) */

  /* ============================== REGISTER ============================== */
  const ALL = { ...ROOMS, ...X.ROOMS };
  for (const [k, r] of Object.entries(ALL)) r.id = k;
  INDC.attach(ALL);                                               // the crew at work, and the machines you walk around (js/sites/industrial-crew.js)
  Sites.register({
    music: 'warehouse',
    id: 'industrial', place: 'Lot', kind: 'Industrial', tag: 'A Safety Inspection Adventure',
    form: 'SAFETY INSPECTION', report: 'Site Safety Report', exit: { id: 'i_exitdoor', name: 'Exit Door' }, start: 'i_dock', calls: false,
    words: { tenant: 'tenant', deposit: 'lease', damage: 'violation', where: 'building', air: 'cardboard, oil, and forklift exhaust' },
    dana: {
      small: ["The forklift drivers wave at me like I'm famous. I'm in a hard hat and safety glasses. I look like a bug.",
        "Their break room vending machine only takes quarters. Who even has quarters? I respect it, though.",
        "My cousin drives a reach truck. He says the racking aisle is 'like Tetris, except it can kill you.'",
        "These earplugs make everything sound like I'm underwater. I kind of love it.",
        "I'm putting 'OSHA-adjacent' on my MySpace profile.",
        "Steel-toes are surprisingly comfortable? Don't tell anyone. I have a reputation for flats."],
      barks: ["Watch the forklift lane, boss. They have the right of way and a lot of momentum.", "It's loud in here. Like, HUH? loud.", "Every time a backup alarm beeps, I jump. Every single time."],
      wear: ["What's a Note versus a Correct?", "A Note is housekeeping: a little clutter, a faded sign, something to tidy up. A Correct is a rule broken: a guard off, a blocked exit, PPE missing. It gets written up and fixed on the tenant's dime, with a photo."],
      hazard: ["When is something Stop Work?", "When somebody could get hurt bad today: a machine that isn't locked out, a load hanging over people, a cracked grinding wheel, a forklift that shouldn't be running. You stop it and you call it in. Paperwork second."],
      photos: "If we tell the tenant to correct something, they'll want proof. And a Stop Work photo goes straight to their safety manager. Extra photos never hurt.",
      smell: 'Vanilla body spray and forklift propane.', flashlight: "'Ow! Point that at a machine guard or something!'" },
    opener: unit => `Lot ${unit}! Okay, it's a safety walk, so gear up first: the PPE station's right here by the dock. Then dock, racks, production floor, shop. Look at everything, write up whatever's off, and hit Finish when you're done.`,
    ppe: { need: { i_dock: ['glasses', 'boots', 'vest'], i_racks: ['glasses', 'boots', 'vest', 'hardhat'], i_floor: ['glasses', 'boots', 'vest', 'ears'], i_shop: ['glasses', 'boots'] }, where: "The PPE station's back on the dock, by where we came in." },
    title: A.title,
    sop: X.SOP,
    tables: {
      ROOMS: ALL, FEATURES: [...FEATURES, ...X.FEATURES], ANOMALIES: [...ANOMALIES, ...X.ANOMALIES], ZOOM_ART: A.ZOOM_ART || {},
      CATS: X.CATS, BRIEFING: X.BRIEFING, BLANK: X.BLANK, CLUTTER: X.CLUTTER, CLUTTER_SPOTS: X.CLUTTER_SPOTS, FLOOR_CLUTTER: Object.keys(X.CLUTTER),
      ITEM_SPRITES: A.SPRITES || {},
      DOORS: INDL.DOORS, CONTAINERS: INDL.CONTAINERS, ROOM_TOUCH: { i_firstaid: 'door' },                    // the shop lockers (js/sites/industrial-crew.js)
      // gray areas: calls a reasonable inspector could defend, worth partial credit (js/partial-marks.js)
      ACCEPTABLE: {
        'i_restraint:1': [0], 'i_forklift:1': [0], 'i_upright:1': [0], 'i_sprinkrack:1': [0], 'i_belt:1': [0], 'i_conveyor:1': [0], 'i_grinder:1': [0], 'i_cylinders:1': [0], 'i_hoist:1': [0],
        i_a_gum: [1], i_a_pigeon: [1], i_a_scrap: [0], i_a_tape: [0], i_a_seal: [0]
      },
      // painted block colors, a tenant accent band, and the slab (sealed, or bare and dustier)
      PAINTS: Object.fromEntries(['i_dock', 'i_racks', 'i_floor', 'i_shop'].map(k => [k, [['Gray primer', '#c8c8c0'], ['Warehouse white', '#e2e0d8'], ['Pale blue', '#c4d0d8'], ['Buff', '#d8ccb0']]])),
      ACCENTS: Object.fromEntries(['i_dock', 'i_racks', 'i_floor', 'i_shop'].map(k => [k, ['#f2c418', '#2a5aa8', '#3f7a3a']])),
      FLOORS: Object.fromEntries(['i_dock', 'i_racks', 'i_floor', 'i_shop'].map(k => [k, [{ base: '#a8a8a2', dk: '#94948e', lt: '#bcbcb4' }, { base: '#b0aca0', dk: '#9a968a', lt: '#c4c0b4' }, { base: '#9ea4a6', dk: '#8a9092', lt: '#b4babc' }]])),
      UNITS: ['104', '112', '120', '208', '216', '301', '310', '402', '415', '503']
    }
  });
})();
