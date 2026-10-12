'use strict';
/* ============================== SITE 204: CONSTRUCTION ==============================
   An active jobsite: Brickroad is building a two-story addition, and a general contractor runs the site. Under OSHA's
   multi-employer policy the GC controls safety for every trade there; the owner's inspector (you) walks it, documents
   what's wrong, requires correction under the contract, and stops work for imminent danger. Four areas, all outdoors:
   the gate and laydown yard, the second-floor deck and its scaffold, the utility trench, and the trailer yard with the
   temporary power. The Focus Four (falls, struck-by, caught-in or between, and electrocution) turn up in every one.
   Every citation is 29 CFR 1926 (construction). The drawing is in js/sites/construction-art.js (room views) and
   js/sites/construction-zoom.js (close-ups). Every id starts with c_. */
(() => {
  const A = CONA, G = A.G;
  const BOX = { x0: -6.5, x1: 6.5, h: 6.5, zb: 16 };
  /* a rectangle around a point on screen, w by h pixels */
  const around = (p, w, h, dy = 0) => [[p[0] - w / 2, p[1] - h / 2 + dy], [p[0] + w / 2, p[1] - h / 2 + dy], [p[0] + w / 2, p[1] + h / 2 + dy], [p[0] - w / 2, p[1] + h / 2 + dy]];
  const area = (name, art, extra) => ({ name, box: { ...BOX }, amb: .7, overlay: (g, r, t) => AmbFX.rain(g, t), floor: () => {}, floorBase: () => '#9a8262', shell: art.shell, walls: art.walls, dynamic: art.dynamic, windows: [], scenery: [], ...extra });
  const box = id => ROOMS[id].box;
  /* the crew (js/sites/construction-art.js): one person's screen outline, and the ones who stand still as walk-around blocks */
  const crewOf = id => ({ c_gate: A.gate, c_deck: A.deck, c_trench: A.trench, c_power: A.power })[id].crew();
  const crewPts = (room, who) => { const c = crewOf(room).find(p => p.id === who); return c ? A.personPts(c) : [[0, 0], [1, 0], [1, 1]]; };
  const crewBlocks = room => crewOf(room).filter(c => c.block).map(c => ({ x0: c.x - .25, x1: c.x + .25, z0: c.z - .2, z1: c.z + .2, pts: () => A.personPts(c) }));
  /* a crew member you can talk to (Look and Talk), standing where the art puts them */
  const crewScenery = (room, who, name, walk, look, talk, extra) => ({ id: 'c_crew_' + who, name, pts: () => crewPts(room, who), walk, look, talk, ...(extra || {}) });

  /* ============================== AREAS ============================== */
  const ROOMS = {
    c_gate: area('Gate & Laydown', A.gate, {
      walk: { x0: -5.4, x1: 4.8, z0: 4.6, z1: 12.2 }, start: { x: -.6, z: 5.2 },
      blocks: () => [{ x0: G.gate.ppe.x0, x1: G.gate.ppe.x1, z0: G.gate.ppe.z, z1: G.gate.ppe.z + .6, h: .95 }, { x0: -6.5, x1: -5.3, z0: G.gate.toilet[0], z1: G.gate.cooler[1], h: 3.05 },
        { x0: G.gate.chop[0], x1: G.gate.chop[1], z0: G.gate.chop[2], z1: G.gate.chop[3], h: 1.1 }, ...crewBlocks('c_gate')],
      doors: [
        { id: 'c_gateToPower', side: 'left', za: G.gate.toPower[0], zb: G.gate.toPower[1], to: 'c_power', name: 'Trailer yard', walk: { x: -5.4, z: 9.3 }, spawn: { x: 5.2, z: 9.1 } },
        { id: 'c_gateToDeck', side: 'right', za: G.gate.stairs[0], zb: G.gate.stairs[1], to: 'c_deck', name: 'Stairs to the deck', walk: { x: 4.8, z: 9.0 }, spawn: { x: -5.2, z: 9.0 } }
      ],
      features: {
        c_crew: { pts: () => hull([...crewPts('c_gate', 'cutter'), ...boxPts(G.gate.chop[0], G.gate.chop[1], 0, 1.1, G.gate.chop[2], G.gate.chop[3])]), walk: { x: .9, z: 10.2 } },
        c_signboard: { pts: () => Q.back(box('c_gate'), G.gate.board[0] - .1, G.gate.gate[1] + .1, .6, 2.5), walk: { x: -1.2, z: 12.2 } },
        c_stacks: { pts: () => hull(boxPts(G.gate.stacks[0], G.gate.stacks[1] + .4, 0, 3.3, G.gate.stacks[2], G.gate.stacks[3])), walk: { x: -4.4, z: 12 } },
        c_toilet: { pts: () => hull(boxPts(-6.5, -5.3, 0, 3.05, G.gate.toilet[0], G.gate.cooler[1])), walk: { x: -4.8, z: 11.4 } },
        c_rebar: { pts: () => hull(boxPts(5.1, 6.5, 0, 1.3, G.gate.rebar[0], G.gate.rebar[1])), walk: { x: 4.6, z: 11.6 } },
        c_truck: { pts: () => hull([...boxPts(G.gate.truck[0] - .1, G.gate.truck[1] + .1, 0, 2.9, G.gate.truck[2] + .3, G.gate.truck[3]), P(G.gate.truck[0] - .9, 0, G.gate.truck[2] - .3), P(G.gate.truck[0] - .9, 2, G.gate.truck[2] - .3)]), walk: { x: 3.6, z: 12.2 } }
      }
    }),
    c_deck: area('Second-Floor Deck', A.deck, {
      floorBase: () => '#b4b2aa',
      walk: { x0: -5.6, x1: 3.6, z0: 4.6, z1: 14.6 }, start: { x: -5.2, z: 9.0 },
      blocks: () => [{ x0: G.deck.hole[0], x1: G.deck.hole[1], z0: G.deck.hole[2], z1: G.deck.hole[3], h: .05 }, ...crewBlocks('c_deck')],
      doors: [{ id: 'c_deckToGate', side: 'left', za: G.deck.stairs[0], zb: G.deck.stairs[1], to: 'c_gate', name: 'Stairs down', walk: { x: -5.6, z: 9.0 }, spawn: { x: 4.6, z: 9.0 } }],
      features: {
        c_deckedge: { pts: () => Q.left(box('c_deck'), G.deck.rail[0], G.deck.rail[1], 0, 1.6), walk: { x: -5.4, z: 12.4 } },
        c_hole: { pts: () => Q.floor(G.deck.hole[0] - .2, G.deck.hole[1] + .7, G.deck.hole[2] - .2, G.deck.hole[3] + .2), walk: { x: -1.7, z: 8.2 } },
        c_harness: { pts: () => hull(boxPts(G.deck.worker[0] - .5, G.deck.anchor[0] + .3, 0, 2.2, G.deck.worker[1] - .2, G.deck.anchor[1])), walk: { x: 1.4, z: 14.2 } },
        c_planks: { pts: () => hull(boxPts(G.deck.scaf[0], G.deck.scaf[1], -.05, .2, 9.8, G.deck.scafZ[1])), walk: { x: 3.4, z: 11 } },
        c_scafrail: { pts: () => [P(G.deck.scaf[1], .3, 9.8), P(G.deck.scaf[1], .3, G.deck.scafZ[1]), P(G.deck.scaf[1], 1.55, G.deck.scafZ[1]), P(G.deck.scaf[1], 1.55, 9.8)], walk: { x: 3.4, z: 12.6 } },
        c_scaftag: { pts: () => hull([...around(P(G.deck.scaf[0], 1.3, G.deck.tagZ), 16, 18), P(G.deck.edge - .3, 1.7, 9.4), P(G.deck.edge - .3, 1.5, 9.4)]), walk: { x: 3.4, z: 8.4 } }
      },
      scenery: [
        crewScenery('c_deck', 'framer', 'Framer', { x: -2.4, z: 12.8 }, 'A framer kneeling on the deck, nailing down plates for next week\'s walls. Muffs on, glasses on, knee pads.',
          '"Morning. You the owner\'s rep? Super\'s down in the trailer." They go back to nailing.'),
        crewScenery('c_deck', 'scaffolder', 'Carpenter on the scaffold', { x: 3.4, z: 12.8 }, 'A carpenter on the scaffold, nailing sheathing to the steel studs.', '"Can\'t chat, I\'m on the clock and on a scaffold." Fair enough.'),
        { id: 'c_s_view', name: 'The view', pts: () => [[60, 46], [300, 46], [300, 88], [60, 88]], walk: { x: 0, z: 13.6 },
          look: 'The whole town from up here: the water tower, the strip mall, and the steeple on Third Street. The leading edge is right there, so you enjoy it from back here.', touch: "It's air. Keep it that way.", talk: 'You yell "HELLO." A dog somewhere yells back.' },
        { id: 'c_s_column', name: 'Steel column', pts: () => hull(boxPts(-1.8, -1.4, 0, 4.2, 15.6, 15.9)), walk: { x: -1.6, z: 14.4 },
          look: 'A steel column standing up for the third floor, primer red, with a splice plate bolted on. Somebody wrote MIKE <3 DEB on it in soapstone.', touch: 'Cold steel. Solid.', hammer: 'PANG. It rings like a bell.' }
      ]
    }),
    c_trench: area('Utility Trench', A.trench, {
      walk: { x0: -.9, x1: 5.6, z0: 4.6, z1: 12 }, start: { x: 4.6, z: 9 },
      blocks: () => [{ x0: G.trench.pump[0], x1: G.trench.pump[1], z0: G.trench.pump[2], z1: G.trench.pump[3], h: .45 }, ...crewBlocks('c_trench')],
      doors: [{ id: 'c_trenchToPower', side: 'right', za: G.trench.door[0], zb: G.trench.door[1], to: 'c_power', name: 'Trailer yard', walk: { x: 5.6, z: 9.1 }, spawn: { x: -5.2, z: 9.1 } }],
      features: {
        c_trenchbox: { pts: () => hull(boxPts(G.trench.x[0], G.trench.x[1], -2.8, .3, G.trench.box[0], G.trench.box[1] + 1.4)), walk: { x: -.9, z: 10.4 } },
        c_spoil: { pts: () => hull(boxPts(G.trench.spoil[0], G.trench.spoil[1] + .3, 0, 1.75, G.trench.spoil[2], G.trench.spoil[3])), walk: { x: -.9, z: 8.4 } },
        c_trladder: { pts: () => { const z = cond('c_trladder') === 2 ? 15 : G.trench.ladder; return hull(boxPts(G.trench.x[0] + .1, G.trench.x[1] - .1, z > 12 ? -2 : -.5, 1.3, z - .1, z + .1)); }, walk: { x: -.9, z: 7.4 } },
        c_water: { pts: () => hull([...boxPts(G.trench.pump[0], G.trench.pump[1], 0, .6, G.trench.pump[2], G.trench.pump[3]), ...Q.floor(G.trench.x[0], G.trench.x[1], 6.6, 8.6)]), walk: { x: -.4, z: 6.2 } },
        c_excavator: { pts: () => hull(A.excavatorPts()), walk: { x: 1.6, z: 11.6 } },
        c_locate: { pts: () => hull([...Q.floor(G.trench.locate[0], G.trench.locate[1], G.trench.locate[2], G.trench.locate[3]), P(G.trench.locate[0] + .7, .5, G.trench.locate[2] + .4), P(G.trench.locate[0] + 2, .5, G.trench.locate[2] + .4)]), walk: { x: 2.2, z: 5.4 } }
      },
      scenery: [
        crewScenery('c_trench', 'shoveler', 'Laborer', { x: -.9, z: 6.6 }, 'A laborer squaring up the end of the trench with a flat shovel. Hard hat, glasses, vest, and a sunburn.',
          '"Eleven years on this shovel. Ask me anything about dirt." You ask what kind this is. "Clay. Type B. Sticky, and heavier than it looks."'),
        { id: 'c_s_811', name: 'Call 811 sign', pts: () => Q.right(box('c_trench'), G.trench.sign[0], G.trench.sign[1], 1.0, 1.8), walk: { x: 5.4, z: 11.6 },
          look: "A sign zip-tied to the fence: KNOW WHAT'S BELOW. CALL 811 BEFORE YOU DIG. It's free, and it's the law in this state.", touch: 'Zip-tied on tight.' }
      ]
    }),
    c_power: area('Trailer & Temp Power', A.power, {
      floorBase: () => '#8e8a80',
      walk: { x0: -5.6, x1: 5.6, z0: 4.6, z1: 12.8 }, start: { x: 5.2, z: 9.1 },
      blocks: () => { const W = G.power, b = [{ x0: W.panel[0], x1: W.panel[1], z0: W.panel[2], z1: W.panel[3], h: 2.6 }, { x0: W.cut[0], x1: W.cut[1], z0: W.cut[2], z1: W.cut[3], h: 1.15 },
        { x0: W.silica[0], x1: W.silica[1], z0: W.silica[2], z1: W.silica[3], h: 1.4 }, { x0: W.fuel[0], x1: W.fuel[1], z0: W.fuel[2], z1: W.fuel[3], h: 1.4 }, ...crewBlocks('c_power')];
        b.push({ x0: W.gang[0], x1: W.gang[1], z0: W.gang[2], z1: W.gang[3], h: 1.0 });
        if (cond('c_powerline') === 3) b.push({ x0: 1.2, x1: 2.4, z0: 12.4, z1: 13.4, h: 5.2 }); return b; },
      doors: [
        { id: 'c_powerToGate', side: 'right', za: G.power.doors[0], zb: G.power.doors[1], to: 'c_gate', name: 'Gate', walk: { x: 5.6, z: 9.1 }, spawn: { x: -5.2, z: 9.3 } },
        { id: 'c_powerToTrench', side: 'left', za: G.power.doors[0], zb: G.power.doors[1], to: 'c_trench', name: 'Trench', walk: { x: -5.6, z: 9.1 }, spawn: { x: 5.2, z: 9.1 } }
      ],
      features: {
        c_trailer: { pts: () => hull([P(G.power.door[0] - .5, 0, G.power.steps[0]), P(G.power.door[1] + .9, 0, G.power.steps[0]), P(G.power.door[1] + .9, 2.9, G.power.trailer[2]), P(G.power.door[0] - .5, 2.9, G.power.trailer[2])]), walk: { x: 0, z: 12.6 } },
        c_powerline: { pts: () => hull([P(G.power.pole[0] - .3, 0, G.power.pole[1]), P(G.power.pole[0] + .3, 0, G.power.pole[1]), P(G.power.pole[0] + 1.3, 6.4, G.power.pole[1]), P(-2, 6.0, G.power.pole[1] + .2), P(-2, 5.6, G.power.pole[1] + .2)]), walk: { x: 4.4, z: 12.6 } },
        c_panel: { pts: () => hull(boxPts(G.power.panel[0], G.power.panel[1], 0, 2.6, G.power.panel[2], G.power.panel[3])), walk: { x: -5, z: 10.2 } },
        c_cords: { pts: () => { const path = A.cordPath(cond('c_cords'));
          return [...path.map(([x, z]) => P(x, 0, z - .35)), ...path.slice().reverse().map(([x, z]) => P(x, 0, z + .35))]; }, walk: { x: -1, z: 8.6 } },
        c_cutsaw: { pts: () => hull(boxPts(G.power.cut[0], G.power.cut[1], 0, 1.15, G.power.cut[2], G.power.cut[3])), walk: { x: 2.6, z: 6.6 } },
        c_silica: { pts: () => hull(boxPts(G.power.silica[0] - .7, G.power.silica[1], 0, 2.0, G.power.silica[2], G.power.silica[3])), walk: { x: -1.8, z: 9.6 } },
        c_fuel: { pts: () => hull(boxPts(G.power.fuel[0] - .1, G.power.fuel[1] + .2, 0, 1.9, G.power.fuel[2] - .7, G.power.fuel[3])), walk: { x: -4.4, z: 12.2 } }
      },
      scenery: [
        crewScenery('c_power', 'carpenter', 'Carpenter', { x: 4.6, z: 9.4 }, 'A carpenter at the cut station, ripping blocking. Muffs, glasses, gloves, and a pencil behind one ear.',
          '"WHAT?" They lift one earmuff. "Oh. Morning." The muff goes back down.'),
        crewScenery('c_power', 'super', 'Superintendent', { x: -.6, z: 12.4 }, "The superintendent, on the trailer steps with a phone at one ear. From the sound of it, the concrete supplier is having a bad morning too.",
          '"Yeah, hang on." They cover the phone. "Whatever you find, write it up and I\'ll get it fixed today. Promise." Back to the phone.', { when: () => cond('c_trailer') !== 3 }),
        { id: 'c_s_trailerwin', name: 'Trailer window', pts: () => Q.back({ ...BOX, zb: G.power.trailer[2] }, G.power.trailer[1] - 2, G.power.trailer[1] - .6, 1.6, 2.6), walk: { x: 2.4, z: 12.6 },
          look: 'Through the trailer window: plans pinned to the wall, a coffee maker, a hard hat full of donuts, and the super, on the phone, pacing.', touch: 'You tap. The super holds up one finger without looking.' }
      ]
    })
  };

  /* the visitor PPE on the gate table, each its own hotspot (clicking one puts it on: js/ppe.js) */
  const PPE_LOOK = { hardhat: 'White visitor hard hats, Type I. Nobody gets past this table without one.', vest: 'Orange hi-vis vests, Class 2. Trucks back up across this yard all day.',
    glasses: 'A box of clear safety glasses, Z87+ on every temple.', ears: 'Foam earplugs and a pair of muffs. The cut station is loud.', boots: 'Loaner safety-toe boots, sprayed and bagged after every use.' };
  ROOMS.c_gate.scenery = [
    ...Object.keys(A.PPE_X).map(id => ({ id: 'c_ppe_' + id, name: PPE_ITEMS[id].name, ppe: id, when: () => !PPE.has(id),
      pts: () => id === 'boots' ? around(P(A.PPE_X.boots, 0, G.gate.ppe.z - .2), 18, 9, -3) : around(P(A.PPE_X[id], G.gate.ppe.top, G.gate.ppe.z + .3), 13, 9, -3),
      walk: { x: -3.2, z: 5.4 }, look: PPE_LOOK[id], touch: PPE_ITEMS[id].on, smell: id === 'boots' ? 'Disinfectant spray. Mostly.' : 'New plastic.' })),
    { id: 'c_s_signin', name: 'Sign-in sheet', pts: () => around(P(G.gate.ppe.x1 - .25, G.gate.ppe.top, G.gate.ppe.z + .3), 12, 8, -2), walk: { x: -2.4, z: 5.4 },
      look: "The visitor sign-in sheet. You write your name, the time, and 'Brickroad, owner's rep.' The line above yours says 'Mom' in a kid's handwriting.", touch: 'You sign in. Every visitor does, so the super knows who to count if something goes wrong.' },
    { id: 'c_s_ppesign', name: 'PPE sign', pts: () => { const p = P(G.gate.ppe.x0 - .3, 0, G.gate.ppe.z + .3); return [[p[0] - 24, p[1] - 42], [p[0] + 26, p[1] - 42], [p[0] + 26, p[1] - 6], [p[0] - 24, p[1] - 6]]; }, walk: { x: -3.6, z: 5.4 },
      look: 'VISITOR PPE: hard hat, safety glasses, hi-vis vest, and safety-toe boots past this point. Hearing protection at the cut station. NO EXCEPTIONS. Somebody added: (THIS MEANS YOU, KEVIN)', touch: 'Plywood and spray paint. Sturdy.' },
    { id: 'c_s_frame', name: 'The building', pts: () => Q.right(box('c_gate'), 11.4, 15.8, 3.0, 5.8), walk: { x: 4.2, z: 12 },
      look: "Brickroad's new addition: two floors of steel and concrete. The second-floor deck is poured; the steel for the roof goes up next week, if the weather holds.", touch: 'Out of reach.' }
  ];

  /* ============================== DOORS THAT OPEN ==============================
     The gang box's lid lifts on its back hinge (js/openables.js 'lid'), and the trailer door swings out on its hinge,
     each to what's inside; touch again to close them. */
  const GANG = { front: '#d8a020', inner: '#b88a10', box: '#2a2c32', back: '#3a3c42' };
  const DOORS = {
    c_power: [
      { id: 'c_gangbox', group: 'c_gang', name: 'Gang box', kind: 'lid', x0: G.power.gang[0], x1: G.power.gang[1], y0: .14, y1: 1.0, z: G.power.gang[2], depth: G.power.gang[3] - G.power.gang[2], col: GANG, inside: 'gang',
        walk: { x: 4.3, z: 10.3 }, look: "A yellow steel gang box, the crew's lockbox for tools overnight. The padlock is hanging open on the hasp.",
        drawInside: (g, d) => { const c = P(d.x0 + .4, .2, d.z + .5); pxEllipse(g, c[0], c[1] - 2, 5, 2, '#f2a018'); pxEllipse(g, c[0], c[1] - 2, 2, 1, '#2a2c32');   // a coiled cord
          const dr = P(d.x1 - .35, .2, d.z + .3); pxRect(g, dr[0] - 4, dr[1] - 3, 7, 3, '#2a6ad0'); pxRect(g, dr[0] - 1, dr[1] - 6, 3, 3, '#2a2c32'); } },   // a cordless drill
      { id: 'c_trailerdoor', group: 'c_trailer', name: 'Trailer door', kind: 'swing', hinge: 'l', x0: G.power.door[0], x1: G.power.door[1], y0: .5, y1: 2.8, z: G.power.trailer[2], depth: 1.4,
        col: { front: '#c8c6be', inner: '#b8b6ae', box: '#2e3038', back: '#5a6a7a' }, inside: 'trailer', walk: { x: 0, z: 12.6 },
        look: 'The job trailer door, steel, with a sign: HARD HATS PAST THIS POINT. ALL VISITORS SIGN IN. Somebody added: (THE COFFEE IS FOR CLOSERS).',
        drawInside: (g, d) => { const z = d.z + d.depth; fillPoly(g, [P(d.x0, 1.5, z), P(d.x1, 1.5, z), P(d.x1, 2.4, z), P(d.x0, 2.4, z)], '#f4f2ea');   // plans pinned to the far wall
          for (let k = 0; k < 4; k++) lineW(g, P(d.x0 + .1, 1.6 + k * .2, z), P(d.x1 - .1, 1.6 + k * .2, z), '#3a6ad0');
          fillPoly(g, [P(d.x0, .5, d.z + .6), P(d.x1, .5, d.z + .6), P(d.x1, 1.25, d.z + .6), P(d.x0, 1.25, d.z + .6)], '#6a5a4a');   // the desk
          const hh = P(d.x1 - .25, 1.25, d.z + .7); pxRect(g, hh[0] - 3, hh[1] - 3, 7, 3, '#f4f4ee'); pxRect(g, hh[0] - 2, hh[1] - 4, 2, 1, '#c87a4a'); } }   // a hard hat full of donuts
    ]
  };
  const CONTAINERS = { c_gang: { doors: ['c_gangbox'], items: ['c_level', 'c_hammer', 'c_tape'] }, c_trailer: { doors: ['c_trailerdoor'], items: ['c_thermos', null] } };

  /* ============================== THE CHECKLIST ============================== */
  const FEATURES = [
    /* ---------------- GATE AND LAYDOWN ---------------- */
    { id: 'c_crew', room: 'c_gate', name: 'Crew PPE', say: 'worker at the chop saw', art: 'c_crew',
      hint: 'Check what the crew is wearing: hard hat, glasses, vest, and hearing protection at a saw.',
      osha: 'Hard hats where anything can fall or strike the head (1926.100(a)); eye protection when cutting (1926.102(a)(1)); hearing protection over the noise limit (1926.101(a)); PPE fits and is worn the way it was made to be (1926.95(c)).',
      parts: [{ id: 'hat', name: 'hard hat', r: [70, 0, 70, 30] }, { id: 'eyes', name: 'eyes', r: [80, 28, 54, 16] }, { id: 'ears', name: 'ears', r: [66, 26, 82, 24] }, { id: 'vest', name: 'vest', r: [56, 56, 104, 79] }, { id: 'saw', name: 'chop saw', r: [160, 50, 80, 85] }],
      base: { saw: { look: 'A 12-inch miter saw on a pair of sawhorses, guard working, cutting 2x4 blocking.', touch: "You don't touch a saw someone else is running." } },
      variants: [
        { cat: 0, desc: 'A worker cutting blocking at the chop saw, fully suited up.', key: ['kit'],
          resp: { hat: { look: { t: 'A white hard hat, brim forward.', clue: 'kit' } }, eyes: { look: { t: 'Safety glasses.', clue: 'kit' } }, ears: { look: 'Earmuffs.' }, vest: { look: 'Orange vest, zipped.' } },
          why: 'Hard hat, glasses, muffs, and a vest. Nothing to do (1926.95; 1926.100; 1926.102).' },
        { cat: 1, desc: 'The worker at the chop saw has their hard hat on backwards.', key: ['backwards'],
          resp: { hat: { look: { t: 'Brim backwards. The sticker inside says it is rated for reverse wear, so that part is fine.', clue: 'backwards' } }, vest: { look: { t: 'Vest unzipped and flapping, near a spinning blade.', clue: 'backwards' } } },
          why: 'Allowed backwards by its label, but zip the vest near a saw. Note it (1926.95(c)).' },
        { cat: 2, cost: 60, desc: 'The worker at the chop saw has no safety glasses.', key: ['eyes'],
          resp: { eyes: { look: { t: 'Bare eyes, a foot from the blade, sawdust flying.', clue: 'eyes' } }, hat: { look: 'Hard hat on.' } },
          why: 'Cutting without eye protection (1926.102(a)(1)). Correction: glasses on; the GC enforces it. Photo it.' },
        { cat: 3, desc: 'The worker at the chop saw has no hard hat, no glasses, and no vest.', key: ['nokit'],
          resp: { hat: { look: { t: 'No hard hat.', clue: 'nokit' } }, vest: { look: { t: 'A gray T-shirt. No vest, in the truck lane while the dump truck backs in.', clue: 'nokit' } }, eyes: { look: { t: 'No glasses.', clue: 'nokit' } } },
          why: 'No PPE at all, standing in the path of a backing truck. Stop: get them out of the lane, suit them up, and call it in (1926.95(a); 1926.100(a); 1926.601(b)(4)).' }
      ] },
    { id: 'c_signboard', room: 'c_gate', name: 'Gate & Posted Board', say: 'gate and the posted board', art: 'c_signboard',
      hint: 'Every site posts how to get help, and keeps the public out.',
      osha: 'Emergency numbers are posted where there is no 911 service (1926.50(f)), the OSHA poster goes up where workers can see it (1903.2(a)), and work next to a sidewalk is barricaded or flagged (1926.200(g); 1926.201).',
      parts: [{ id: 'sign', name: 'site sign', r: [10, 12, 128, 34] }, { id: 'numbers', name: 'emergency numbers', r: [12, 48, 60, 44] }, { id: 'poster', name: 'OSHA poster', r: [76, 48, 60, 44] }, { id: 'gate', name: 'the gate', r: [150, 4, 90, 110] }],
      base: { sign: { look: 'SITE 204. HARD HAT AREA. PPE REQUIRED PAST GATE. SUPER: 555-0142.' } },
      variants: [
        { cat: 0, desc: 'The site board by the gate, with the emergency numbers and the OSHA poster.', key: ['posted'],
          resp: { numbers: { look: { t: 'CALL 911. Mercy Hospital, 2.1 miles. First aid kit in the trailer.', clue: 'posted' } }, poster: { look: { t: "Job Safety and Health: It's the Law. Current version.", clue: 'posted' } }, gate: { look: 'Shut and latched. You came in the pedestrian side.', touch: 'Latched tight.' } },
          why: 'Posted and shut. Nothing to do (1926.50(f); 1903.2(a)).' },
        { cat: 1, desc: "The site board is hard to read.", key: ['faded'],
          resp: { sign: { look: { t: "Faded, and half behind the fence's windscreen. You have to lean to read it.", clue: 'faded' } }, numbers: { look: { t: 'Still there, just sun-bleached.', clue: 'faded' } } },
          why: 'Faded but still there. Note it: move it out from behind the windscreen (1926.200).' },
        { cat: 2, cost: 75, desc: "Parts of the posted board are empty.", key: ['blank'],
          resp: { numbers: { look: { t: 'Four bits of tape where the emergency numbers used to be.', clue: 'blank' } }, poster: { look: { t: 'No OSHA poster. Just tape.', clue: 'blank' } } },
          why: 'No posted emergency info and no OSHA poster (1926.50(f); 1903.2(a)). Correction: repost both; charged to the GC. Photo it.' },
        { cat: 3, desc: 'The gate is standing open onto the sidewalk.', key: ['open', 'public'],
          resp: { gate: { look: { t: 'Wide open. A woman with a stroller is cutting through the yard while a loader backs across the sidewalk.', clue: 'public' }, touch: { t: 'Nobody is watching it. No flagger, no barricade.', clue: 'open' } } },
          why: 'Members of the public walking through a working yard with equipment backing. Stop: hold the loader, walk them out, shut the gate or post a flagger, and call it in (1926.200(g); 1926.201; 1926.202).' }
      ] },
    { id: 'c_stacks', room: 'c_gate', name: 'Block & Lumber Stacks', say: 'block and lumber stacks', art: 'c_stacks',
      hint: 'Material in stacks must be stable. Check the height and the lean.',
      osha: 'Stacks are stable and self-supporting (1926.250(a)(1)); loose block over 6 feet is tapered back (1926.250(b)(7)); used lumber is de-nailed before stacking (1926.250(b)(8)).',
      parts: [{ id: 'block', name: 'block stack', r: [16, 6, 108, 108] }, { id: 'lumber', name: 'lumber pile', r: [128, 30, 108, 82] }, { id: 'dunnage', name: 'dunnage', r: [10, 110, 228, 14] }],
      base: { dunnage: { look: 'Wood dunnage under both stacks, level on the dirt.' } },
      variants: [
        { cat: 0, desc: 'Concrete block on pallets, and a stack of lumber.', key: ['stable'],
          resp: { block: { look: { t: 'Two tiers, the top one stepped back.', clue: 'stable' }, tape: { t: 'Five feet tall, tapered.', clue: 'stable' } }, lumber: { look: 'Banded, stickered, and no nails.' } },
          why: 'Stable, tapered, and de-nailed. Nothing to do (1926.250).' },
        { cat: 1, desc: 'The tarp on the lumber is flapping.', key: ['tarp'],
          resp: { lumber: { look: { t: 'A blue tarp snapping in the wind, half off the stack.', clue: 'tarp' }, touch: { t: 'Loose ties.', clue: 'tarp' } } },
          why: 'A loose tarp is housekeeping. Note it: tie it down.' },
        { cat: 2, cost: 160, desc: 'The block is stacked very tall.', key: ['tall', 'nails'],
          resp: { block: { tape: { t: 'Eight feet, straight up, no taper.', clue: 'tall' }, look: { t: 'One tall column of block.', clue: 'tall' } }, lumber: { look: { t: 'Used lumber with nails sticking up.', clue: 'nails' } } },
          why: 'Block over 6 feet with no taper, and nails in stacked lumber (1926.250(b)(7), (b)(8)). Correction: restack and de-nail; charged to the GC. Photo it.' },
        { cat: 3, desc: 'The block stack is leaning.', key: ['lean'],
          resp: { block: { look: { t: 'The whole stack has slid off its dunnage and is leaning toward the walkway. Two blocks already fell.', clue: 'lean' } }, dunnage: { look: { t: 'Sunk into soft mud on one side.', clue: 'lean' } } },
          why: 'A leaning block stack can come down on whoever walks by. Stop: barricade it, restack it with equipment, and call it in (1926.250(a)(1)).' }
      ] },
    { id: 'c_rebar', room: 'c_gate', name: 'Rebar & Housekeeping', say: 'rebar sticking up from the footing', art: 'c_rebar',
      hint: 'Rebar sticking up under a work area needs a real cap. Look at what is on the ends.',
      osha: 'Protruding rebar is guarded so nobody can be impaled (1926.701(b)); scrap with nails is kept out of work areas (1926.25(a)).',
      parts: [{ id: 'caps', name: 'rebar caps', r: [14, 26, 222, 20] }, { id: 'rebar', name: 'rebar', r: [14, 36, 222, 50] }, { id: 'ground', name: 'the ground', r: [0, 96, 240, 39] }, { id: 'above', name: 'the deck above', r: [0, 0, 240, 26] }],
      base: { above: { look: 'The second-floor deck edge right overhead.' } },
      variants: [
        { cat: 0, desc: 'Rebar sticking up from the footing, capped.', key: ['capped'],
          resp: { caps: { look: { t: 'Orange steel-reinforced caps over every row. IMPALEMENT RATED.', clue: 'capped' }, touch: { t: 'Solid. They would stop a fall.', clue: 'capped' } } },
          why: 'Rated caps over every row. Nothing to do (1926.701(b)).' },
        { cat: 1, desc: 'Rebar with caps, and a pile of scrap beside it.', key: ['scrap'],
          resp: { ground: { look: { t: 'A pile of cutoffs waiting for the dumpster.', clue: 'scrap' } }, caps: { look: 'Capped.' } },
          why: 'A small scrap pile at shift end is housekeeping. Note it (1926.25(a)).' },
        { cat: 2, cost: 120, desc: 'The rebar has little round caps.', key: ['mushroom', 'nails'],
          resp: { caps: { look: { t: "Flat plastic mushroom caps. They keep you from scratching yourself. They won't stop a fall.", clue: 'mushroom' } }, ground: { look: { t: 'A board with nails up.', clue: 'nails' } } },
          why: 'Mushroom caps are not impalement protection under a work area, and nails up in a walkway (1926.701(b); 1926.25(a)). Correction: rated caps or troughs; charged to the GC. Photo it.' },
        { cat: 3, desc: "Bare rebar is sticking straight up, and someone's working above it.", key: ['bare'],
          resp: { rebar: { look: { t: 'Bare ends, no caps.', clue: 'bare' } }, above: { look: { t: 'Boots on the deck edge right above it.', clue: 'bare' } } },
          why: 'Bare rebar under a work area is an impalement waiting for a fall. Stop: stop work above, cap or bend it now, and call it in (1926.701(b)).' }
      ] },
    { id: 'c_truck', room: 'c_gate', name: 'Dump Truck & Backing', say: 'dump truck backing in', art: 'c_truck',
      hint: 'Backing trucks need an alarm and a spotter. Listen when it reverses.',
      osha: 'Vehicles with an obstructed rear view need a working reverse alarm or a spotter (1926.601(b)(4)); nobody walks in a blind spot.',
      parts: [{ id: 'alarm', name: 'backup alarm', r: [104, 94, 34, 26] }, { id: 'mirror', name: 'mirror', r: [200, 16, 36, 40] }, { id: 'spotter', name: 'spotter', r: [10, 40, 50, 95] }, { id: 'behind', name: 'behind the truck', r: [70, 110, 160, 25] }],
      base: { mirror: { look: 'The driver can only see the back corners in it.' } },
      variants: [
        { cat: 0, desc: 'The dump truck backs in, with a spotter.', key: ['beep'],
          resp: { alarm: { look: 'A backup alarm under the frame.', touch: { t: 'BEEP. BEEP. BEEP. It works.', clue: 'beep' } }, spotter: { look: { t: 'A spotter in a vest with a STOP paddle, in view of the mirror.', clue: 'beep' } } },
          why: 'Alarm and spotter. Nothing to do (1926.601(b)(4)).' },
        { cat: 1, desc: 'The truck mirror is muddy.', key: ['mud'],
          resp: { mirror: { look: { t: 'Caked in mud.', clue: 'mud' } }, alarm: { touch: 'BEEP. Works.' } },
          why: 'A muddy mirror is upkeep. Note it.' },
        { cat: 2, cost: 200, desc: "The truck's backup alarm is silent.", key: ['dead'],
          resp: { alarm: { look: { t: 'The wires are cut and hanging.', clue: 'dead' }, touch: { t: 'Silent.', clue: 'dead' } }, spotter: { look: { t: 'No spotter either.', clue: 'dead' } } },
          why: 'No alarm and no spotter on a truck that can\'t see behind it (1926.601(b)(4)). Correction: park it until repaired; charged to the GC. Photo it.' },
        { cat: 3, desc: "Someone's walking right behind the backing truck.", key: ['blind'],
          resp: { behind: { look: { t: "A laborer is walking behind the truck while it backs up. The driver can't see them.", clue: 'blind' } }, alarm: { touch: { t: 'BEEP. BEEP. They have earbuds in.', clue: 'blind' } } },
          why: 'A worker in the blind spot of a backing truck. Stop: yell, wave, stop the truck, and call it in (1926.601(b)(4); General Duty Clause).' }
      ] },
    { id: 'c_toilet', room: 'c_gate', name: 'Toilet & Drinking Water', say: 'toilet and water cooler', art: 'c_toilet',
      hint: "Toilets, handwashing, and cool water. People can't work without them.",
      osha: 'Drinking water is provided (1926.51(a)); toilets are provided by crew size (1926.51(c)(1)); handwashing (1926.51(f)). Heat illness is a General Duty Clause hazard.',
      parts: [{ id: 'toilet', name: 'portable toilet', r: [8, 0, 96, 124] }, { id: 'wash', name: 'hand-wash station', r: [110, 70, 40, 54] }, { id: 'cooler', name: 'water cooler', r: [160, 26, 50, 96] }, { id: 'cups', name: 'cups and thermometer', r: [210, 8, 26, 60] }],
      base: { toilet: { smell: 'Blue chemical. Strong.' } },
      variants: [
        { cat: 0, desc: 'A portable toilet, a hand-wash station, and a water cooler.', key: ['stocked'],
          resp: { cooler: { look: { t: 'Full of ice water.', clue: 'stocked' }, touch: { t: 'Cold.', clue: 'stocked' } }, cups: { look: 'A sleeve of cups.' }, wash: { look: 'Soap and water.' } },
          why: 'Stocked and serviced. Nothing to do (1926.51).' },
        { cat: 1, desc: 'The hand-wash station is out of soap.', key: ['nosoap'],
          resp: { wash: { look: { t: 'Soap: EMPTY.', clue: 'nosoap' } } },
          why: 'A restock. Note it (1926.51(f)).' },
        { cat: 2, cost: 150, desc: 'The portable toilet is taped off.', key: ['broken'],
          resp: { toilet: { look: { t: 'OUT OF ORDER tape across the door, and it is overflowing. 45 on site, one toilet.', clue: 'broken' }, smell: { t: 'Oh no.', clue: 'broken' } } },
          why: 'One broken toilet for a crew of 45 (1926.51(c)(1)). Correction: service and add units; charged to the GC. Photo it.' },
        { cat: 3, desc: "The water cooler is empty, and it's hot out.", key: ['dry'],
          resp: { cooler: { look: { t: 'Empty and dry. No cups.', clue: 'dry' } }, cups: { look: { t: 'The thermometer on the post reads 97 degrees.', clue: 'dry' } } },
          why: 'No water on a 97-degree day is a heat illness waiting to happen. Treat it as urgent: water and shade now, and call it in (1926.51(a); General Duty Clause).' }
      ] },
    /* ---------------- THE DECK ---------------- */
    { id: 'c_deckedge', room: 'c_deck', name: 'Deck Edge Guardrail', say: 'cable guardrail along the deck edge', art: 'c_deckedge',
      hint: 'Six feet up or more, an open edge needs a guardrail. Measure it.',
      osha: 'Edges 6 feet or more above a lower level get fall protection (1926.501(b)(1)); a top rail is 42 inches, plus or minus 3, with a midrail, and wire rope is flagged every 6 feet (1926.502(b)(1), (b)(2), (b)(9)).',
      parts: [{ id: 'top', name: 'top cable', r: [0, 20, 240, 26] }, { id: 'mid', name: 'midrail', r: [0, 60, 240, 24] }, { id: 'posts', name: 'posts', r: [80, 20, 100, 92] }, { id: 'drop', name: 'the drop', r: [0, 88, 240, 24] }],
      base: { drop: { look: 'Twelve feet to the dirt.' } },
      variants: [
        { cat: 0, desc: 'A cable guardrail along the deck edge.', key: ['42'],
          resp: { top: { tape: { t: '42 inches. Right on.', clue: '42' }, touch: { t: 'Taut. It barely gives.', clue: '42' } }, posts: { look: 'Orange flags every 6 feet.' } },
          why: 'Right height, taut, and flagged. Nothing to do (1926.502(b)).' },
        { cat: 1, desc: 'The guardrail cable has no flags.', key: ['flags'],
          resp: { top: { look: { t: 'No flags on this run of cable.', clue: 'flags' } }, posts: { look: { t: 'Hard to see against the sky.', clue: 'flags' } } },
          why: 'Flag the cable so people see it. Note it (1926.502(b)(9)).' },
        { cat: 2, cost: 180, desc: 'The guardrail cable looks low.', key: ['low'],
          resp: { top: { tape: { t: '34 inches, and it drops to 30 when you push on it.', clue: 'low' }, touch: { t: 'It sags.', clue: 'low' } } },
          why: 'A top rail under 39 inches that sags is not a guardrail (1926.502(b)(1), (b)(4)). Correction: retension and raise it; charged to the GC. Photo it.' },
        { cat: 3, desc: 'A section of guardrail is missing.', key: ['gap'],
          resp: { posts: { look: { t: 'A whole section unhooked for a delivery, never put back. Material stacked right at the gap.', clue: 'gap' } }, drop: { look: { t: 'Twelve feet straight down.', clue: 'gap' } } },
          why: 'An open edge with people working nearby. Stop: close it or tie everyone off, and call it in (1926.501(b)(1)).' }
      ] },
    { id: 'c_hole', room: 'c_deck', name: 'Floor Opening Cover', say: 'plywood cover on the deck', art: 'c_hole',
      hint: 'A cover over a hole has to be strong, fastened down, and marked.',
      osha: 'Holes 2 inches or more are covered (1926.501(b)(4)); covers hold twice the load, are secured, and are marked HOLE or COVER (1926.502(i)).',
      parts: [{ id: 'cover', name: 'plywood cover', r: [56, 26, 132, 86] }, { id: 'mark', name: 'marking', r: [80, 50, 80, 36] }, { id: 'edge', name: 'edges', r: [36, 18, 168, 100] }],
      base: { edge: { look: 'The deck around it.' } },
      variants: [
        { cat: 0, desc: 'A plywood cover on the deck, marked.', key: ['secured'],
          resp: { mark: { look: { t: 'HOLE. DO NOT REMOVE. In red paint.', clue: 'secured' } }, cover: { touch: { t: "Screwed down at every corner. It doesn't budge.", clue: 'secured' } } },
          why: 'Secured and marked. Nothing to do (1926.502(i)).' },
        { cat: 1, desc: 'The plywood cover marking is faded.', key: ['faded'],
          resp: { mark: { look: { t: 'The paint is worn almost off.', clue: 'faded' } }, cover: { touch: 'Still screwed down.' } },
          why: 'Repaint the marking. Note it (1926.502(i)(4)).' },
        { cat: 2, cost: 90, desc: 'The plywood cover has slid.', key: ['loose'],
          resp: { cover: { touch: { t: 'No screws. It slides with a kick.', clue: 'loose' }, look: { t: 'Kicked aside. You can see the dark edge of the hole.', clue: 'loose' } }, mark: { look: { t: 'No marking at all.', clue: 'loose' } } },
          why: 'An unsecured, unmarked cover (1926.502(i)(3), (i)(4)). Correction: screw it down and mark it; charged to the GC. Photo it.' },
        { cat: 3, desc: "There's an open hole in the deck.", key: ['open'],
          resp: { edge: { look: { t: 'A 30-inch hole straight down to the first floor. No cover at all.', clue: 'open' }, tape: { t: '30 inches across.', clue: 'open' } } },
          why: 'An open floor hole. Stop: cover or guard it now, and call it in (1926.501(b)(4)).' }
      ] },
    { id: 'c_harness', room: 'c_deck', name: 'Fall Arrest at the Edge', say: 'ironworker at the leading edge', art: 'c_harness',
      hint: 'At an unprotected edge, a harness only works if it is clipped to something rated.',
      osha: 'Workers at an unprotected edge 6 feet or more up use fall arrest (1926.501(b)(1), (b)(2)); anchors hold 5,000 pounds per worker (1926.502(d)(15)); the harness fits and is inspected (1926.502(d)(21)).',
      parts: [{ id: 'harness', name: 'harness', r: [80, 18, 64, 92] }, { id: 'lanyard', name: 'lanyard', r: [110, 20, 90, 100] }, { id: 'anchor', name: 'anchor', r: [190, 10, 50, 40] }, { id: 'edge', name: 'the edge', r: [0, 104, 240, 31] }],
      base: { harness: { look: 'A full-body harness over the vest.' } },
      variants: [
        { cat: 0, desc: 'An ironworker at the leading edge, tied off to the column.', key: ['tied'],
          resp: { lanyard: { look: { t: 'Clipped to a beam strap anchor on the column, tag and all.', clue: 'tied' } }, anchor: { look: { t: 'Rated 5,000 pounds.', clue: 'tied' } }, harness: { look: 'Snug. D-ring between the shoulder blades.' } },
          why: 'Rated anchor, snug harness. Nothing to do (1926.502(d)).' },
        { cat: 1, desc: "The ironworker's leg straps are hanging loose.", key: ['loose'],
          resp: { harness: { look: { t: 'Leg straps unbuckled.', clue: 'loose' } }, lanyard: { look: 'Clipped to the anchor.' } },
          why: 'Remind them to buckle up. Note it (1926.95(c)).' },
        { cat: 2, cost: 100, desc: "The ironworker's lanyard runs down to the floor.", key: ['conduit'],
          resp: { lanyard: { look: { t: 'Clipped to a piece of conduit lying on the deck.', clue: 'conduit' } }, anchor: { look: { t: 'The rated anchor is right there, unused.', clue: 'conduit' } } },
          why: 'Conduit is not an anchor (1926.502(d)(15)). Correction: clip to the rated anchor; retraining charged to the GC. Photo it.' },
        { cat: 3, desc: "The ironworker's lanyard is dragging on the deck.", key: ['untied'],
          resp: { lanyard: { look: { t: 'Unclipped, dragging behind them at the edge.', clue: 'untied' } }, edge: { look: { t: 'They are a step from the edge.', clue: 'untied' } } },
          why: 'Working at an unprotected edge, not tied off. Stop: get them back, tie them off, and call it in (1926.501(b)(1), (b)(2)).' }
      ] },
    { id: 'c_planks', room: 'c_deck', name: 'Scaffold Planks', say: 'scaffold planking', art: 'c_planks',
      hint: 'Fully planked, sound boards, and ends past the supports.',
      osha: 'Platforms are fully planked, at least 18 inches wide, with gaps no more than 1 inch (1926.451(b)(1), (b)(2)); plank ends extend 6 to 12 inches past their supports (1926.451(b)(4)); no boxes or buckets to gain height (1926.451(f)(14)).',
      parts: [{ id: 'planks', name: 'planks', r: [16, 56, 216, 72] }, { id: 'ends', name: 'plank ends', r: [200, 44, 40, 30] }, { id: 'bucket', name: 'on the platform', r: [130, 20, 60, 70] }],
      base: { planks: { touch: 'Wood planks, scaffold grade.' } },
      variants: [
        { cat: 0, desc: 'Fully planked scaffold.', key: ['full'],
          resp: { planks: { look: { t: 'Five planks, tight together.', clue: 'full' } }, ends: { tape: { t: 'Eight inches past the support.', clue: 'full' } } },
          why: 'Fully planked, ends right. Nothing to do (1926.451(b)).' },
        { cat: 1, desc: 'The scaffold planks are muddy.', key: ['mud'],
          resp: { planks: { look: { t: 'Caked in mud and grit.', clue: 'mud' }, touch: { t: 'Slick.', clue: 'mud' } } },
          why: 'Clean the planks. Note it (1926.451(f)(13)).' },
        { cat: 2, cost: 140, desc: 'One scaffold plank is missing.', key: ['gap', 'short'],
          resp: { planks: { look: { t: 'A plank-wide gap down the middle.', clue: 'gap' } }, ends: { tape: { t: 'Three inches past the support. Needs six.', clue: 'short' } } },
          why: 'A missing plank and short ends (1926.451(b)(1), (b)(4)). Correction: replank; charged to the GC. Photo it.' },
        { cat: 3, desc: 'A worker is standing on a bucket on the scaffold.', key: ['bucket', 'crack'],
          resp: { bucket: { look: { t: 'A worker on an upside-down bucket to reach higher.', clue: 'bucket' } }, planks: { look: { t: 'A split running down one plank under them.', clue: 'crack' } } },
          why: 'A bucket on a cracked plank. Stop: get them down, pull the plank, and call it in (1926.451(b)(1), (f)(14)).' }
      ] },
    { id: 'c_scafrail', room: 'c_deck', name: 'Scaffold Guardrail', say: 'scaffold guardrail', art: 'c_scafrail',
      hint: 'Top rail, midrail, and toeboard, all the way around.',
      osha: 'Scaffolds over 10 feet have guardrails (1926.451(g)(1)): a top rail 38 to 45 inches, a midrail (1926.451(g)(4)(ii), (iv)), and toeboards where people work below (1926.451(h)(4)(ii)).',
      parts: [{ id: 'top', name: 'top rail', r: [0, 18, 240, 16] }, { id: 'mid', name: 'midrail', r: [0, 60, 240, 14] }, { id: 'toe', name: 'toeboard', r: [0, 100, 240, 16] }, { id: 'end', name: 'end of the run', r: [160, 10, 80, 100] }],
      base: { top: { look: 'The outer rail.' } },
      variants: [
        { cat: 0, desc: 'The scaffold has top rails, midrails, and toeboards.', key: ['railed'],
          resp: { top: { tape: { t: '42 inches.', clue: 'railed' } }, toe: { look: { t: 'Four-inch toeboards.', clue: 'railed' } }, end: { look: 'Railed at the end too.' } },
          why: 'Complete. Nothing to do (1926.451(g)).' },
        { cat: 1, desc: 'Part of the scaffold guardrail is wired on.', key: ['wire'],
          resp: { top: { look: { t: 'Tie wire twisted where a pin went missing.', clue: 'wire' }, touch: { t: 'Holds, for now.', clue: 'wire' } } },
          why: 'Replace the pin. Note it.' },
        { cat: 2, cost: 160, desc: 'The end of the scaffold is open.', key: ['open'],
          resp: { end: { look: { t: 'No rail at the end of the run.', clue: 'open' }, tape: { t: 'Fourteen feet down.', clue: 'open' } } },
          why: 'An open end over 10 feet (1926.451(g)(1)). Correction: rail it; charged to the GC. Photo it.' },
        { cat: 3, desc: 'The scaffold has no guardrails at all.', key: ['none'],
          resp: { top: { look: { t: 'Nothing. A crew is working right at the open side.', clue: 'none' } }, toe: { look: { t: 'A wrench just went over the side. CLANG.', clue: 'none' } } },
          why: 'No guardrails with a crew working, and tools falling. Stop: get them off or tied off, barricade below, and call it in (1926.451(g)(1), (h)(1)).' }
      ] },
    { id: 'c_scaftag', room: 'c_deck', name: 'Scaffold Tag & Ties', say: 'scaffold tag and its ties', art: 'c_scaftag',
      hint: 'A competent person checks the scaffold every shift. Tall scaffolds are tied to the building.',
      osha: 'A competent person inspects the scaffold before each shift (1926.451(f)(3)); scaffolds taller than 4 times their base width are tied to the structure (1926.451(c)(1)).',
      parts: [{ id: 'tag', name: 'inspection tag', r: [156, 14, 40, 56] }, { id: 'ties', name: 'wall ties', r: [36, 26, 160, 50] }, { id: 'gap', name: 'the gap', r: [40, 96, 160, 26] }],
      base: { ties: { look: 'Wire ties from the scaffold to the column.' } },
      variants: [
        { cat: 0, desc: 'The scaffold has a green tag, and it is tied to the building.', key: ['today'],
          resp: { tag: { look: { t: 'Green SAFE tag, signed this morning.', clue: 'today' } }, ties: { touch: { t: 'Tight.', clue: 'today' } } },
          why: 'Inspected and tied. Nothing to do (1926.451(f)(3)).' },
        { cat: 1, desc: 'The scaffold tag is from yesterday.', key: ['old'],
          resp: { tag: { look: { t: 'Signed yesterday, not today.', clue: 'old' } } },
          why: 'Get today\'s inspection done. Note it (1926.451(f)(3)).' },
        { cat: 2, cost: 220, desc: "The scaffold's wall ties have been cut.", key: ['cut'],
          resp: { ties: { look: { t: 'Cut and hanging.', clue: 'cut' }, touch: { t: 'Nothing holding it to the building.', clue: 'cut' } } },
          why: 'A tall scaffold with no ties (1926.451(c)(1)). Correction: retie it before anyone works on it; charged to the GC. Photo it.' },
        { cat: 3, desc: 'The scaffold is pulling away from the building.', key: ['lean'],
          resp: { gap: { look: { t: 'A two-foot gap opening at the top. The scaffold is leaning out.', clue: 'lean' }, tape: { t: 'Two feet and growing.', clue: 'lean' } } },
          why: 'A scaffold leaning away from the building. Stop: everyone off, and call it in (1926.451(c)(1), (f)(4)).' }
      ] },
    /* ---------------- TRENCH ---------------- */
    { id: 'c_trenchbox', room: 'c_trench', name: 'Trench Walls & Box', say: 'trench box and the walls', art: 'c_trenchbox',
      hint: 'Five feet deep or more, a trench needs protection. Measure the depth and look at the box.',
      osha: 'A trench 5 feet or deeper needs a protective system: sloping, shoring, or a trench box (1926.652(a)(1)); a box may sit no more than 2 feet above the trench floor (1926.652(g)(2)).',
      parts: [{ id: 'box', name: 'trench box', r: [40, 0, 160, 110] }, { id: 'wall', name: 'trench wall', r: [0, 0, 40, 118] }, { id: 'worker', name: 'worker', r: [90, 50, 120, 80] }, { id: 'floor', name: 'trench floor', r: [0, 110, 240, 25] }],
      base: { wall: { look: 'Brown clay. Type B soil.' } },
      variants: [
        { cat: 0, desc: 'A trench box in the trench, a worker inside it.', key: ['boxed'],
          resp: { box: { look: { t: 'Steel panels and spreaders.', clue: 'boxed' }, tape: { t: '18 inches from the floor.', clue: 'boxed' } }, worker: { look: 'Inside the box.' } },
          why: 'Boxed, and they are inside it. Nothing to do (1926.652).' },
        { cat: 1, desc: 'Clods of dirt at the bottom of the trench wall.', key: ['clods'],
          resp: { floor: { look: { t: 'Small clods have fallen at the toe of the wall.', clue: 'clods' } } },
          why: 'Have the competent person recheck the walls. Note it (1926.651(k)(1)).' },
        { cat: 2, cost: 250, desc: 'The worker is outside the box.', key: ['outside', 'gap'],
          resp: { worker: { look: { t: 'Standing past the end of the box.', clue: 'outside' } }, box: { tape: { t: '3 feet between the box and the floor.', clue: 'gap' } } },
          why: 'Working outside the box, and the box sits too high (1926.652(a)(1), (g)(2)). Correction: no entry until fixed; charged to the GC. Photo it.' },
        { cat: 3, desc: 'A worker is in the trench, and there is no box.', key: ['bare'],
          resp: { wall: { tape: { t: 'Six feet deep, straight walls.', clue: 'bare' } }, worker: { look: { t: 'Down there, no protection.', clue: 'bare' } } },
          why: 'An unprotected trench over 5 feet can collapse in seconds. Stop: get them out now, and call it in (1926.652(a)(1)).' }
      ] },
    { id: 'c_spoil', room: 'c_trench', name: 'Spoil Pile & Edge', say: 'spoil pile by the trench', art: 'c_spoil',
      hint: 'Dirt and material stay at least 2 feet back from the edge. Watch for cracks.',
      osha: 'Spoil, tools, and material stay at least 2 feet back from the edge (1926.651(j)(2)); signs of a cave-in mean everyone out (1926.651(k)(2)).',
      parts: [{ id: 'pile', name: 'spoil pile', r: [0, 40, 148, 92] }, { id: 'edge', name: 'trench edge', r: [100, 60, 60, 70] }, { id: 'ground', name: 'the ground beyond', r: [160, 30, 80, 105] }],
      base: { pile: { look: 'A pile of excavated clay.' } },
      variants: [
        { cat: 0, desc: 'The spoil pile is set back from the trench edge.', key: ['back'],
          resp: { edge: { tape: { t: '3 feet from the edge to the toe of the pile.', clue: 'back' } } },
          why: 'Set back. Nothing to do (1926.651(j)(2)).' },
        { cat: 1, desc: 'A shovel and a bucket at the trench edge.', key: ['tools'],
          resp: { edge: { look: { t: 'A shovel and a bucket right at the lip.', clue: 'tools' } } },
          why: 'Move them back. Note it (1926.651(j)(2)).' },
        { cat: 2, cost: 180, desc: 'The spoil is piled right at the trench edge.', key: ['edge'],
          resp: { edge: { tape: { t: '6 inches back, and pipe sections beside it.', clue: 'edge' } } },
          why: 'Spoil at the edge (1926.651(j)(2)). Correction: pull it back 2 feet; charged to the GC. Photo it.' },
        { cat: 3, desc: 'There are cracks in the ground along the trench.', key: ['cracks'],
          resp: { ground: { look: { t: 'Tension cracks running parallel to the trench, and dirt trickling in.', clue: 'cracks' } } },
          why: 'Tension cracks are a cave-in about to happen. Stop: everyone out, and call it in (1926.651(k)(2)).' }
      ] },
    { id: 'c_trladder', room: 'c_trench', name: 'Ladder Out of the Trench', say: 'ladder out of the trench', art: 'c_trladder',
      hint: 'In a trench 4 feet or deeper, a ladder within 25 feet, sticking 3 feet out.',
      osha: 'A ladder or ramp within 25 feet of every worker in a trench 4 feet or deeper (1926.651(c)(2)); ladders extend 3 feet above the landing (1926.1053(b)(1)).',
      parts: [{ id: 'ladder', name: 'ladder', r: [86, 0, 70, 135] }, { id: 'top', name: 'top of the ladder', r: [86, 0, 70, 40] }, { id: 'trench', name: 'the trench', r: [40, 40, 160, 95] }],
      base: { trench: { look: 'The trench, seven feet deep.' } },
      variants: [
        { cat: 0, desc: 'A ladder in the trench.', key: ['close'],
          resp: { top: { tape: { t: '3 feet above the edge.', clue: 'close' } }, ladder: { tape: { t: '15 feet from the worker.', clue: 'close' } } },
          why: 'Close and tall enough. Nothing to do (1926.651(c)(2)).' },
        { cat: 1, desc: 'The trench ladder rungs are muddy.', key: ['mud'],
          resp: { ladder: { look: { t: 'Caked in mud.', clue: 'mud' } } },
          why: 'Clean them. Note it (1926.1053(b)(2)).' },
        { cat: 2, cost: 100, desc: 'The trench ladder is far away.', key: ['far'],
          resp: { ladder: { tape: { t: '40 feet from the worker, flush with the edge.', clue: 'far' } } },
          why: 'Too far, too short (1926.651(c)(2); 1926.1053(b)(1)). Correction: move it; charged to the GC. Photo it.' },
        { cat: 3, desc: 'There is no ladder in the trench.', key: ['none'],
          resp: { trench: { look: { t: 'No way out but climbing the box.', clue: 'none' } } },
          why: 'No way out of a trench. Stop: get a ladder in before anyone stays down there, and call it in (1926.651(c)(2)).' }
      ] },
    { id: 'c_water', room: 'c_trench', name: 'Water & Air in the Trench', say: 'pump and gas meter', art: 'c_water',
      hint: 'Water weakens trench walls. Bad air can kill. Read the meter.',
      osha: 'Water is controlled before work continues (1926.651(h)(1)); the air is tested where a hazardous atmosphere could exist (1926.651(g)(1)).',
      parts: [{ id: 'meter', name: 'gas meter', r: [20, 16, 54, 60] }, { id: 'pump', name: 'pump', r: [166, 0, 74, 34] }, { id: 'floor', name: 'trench floor', r: [0, 96, 240, 39] }],
      base: { pump: { look: 'A trash pump on the lip.' } },
      variants: [
        { cat: 0, desc: 'A pump on the trench lip, a gas meter on the ladder.', key: ['clear'],
          resp: { meter: { look: { t: 'O2 20.9 percent. LEL 0. All green.', clue: 'clear' } }, floor: { look: 'Dry.' } },
          why: 'Dry and clean air. Nothing to do (1926.651(g), (h)).' },
        { cat: 1, desc: 'A puddle at the low end of the trench.', key: ['puddle'],
          resp: { floor: { look: { t: 'An inch of water at the low end.', clue: 'puddle' } } },
          why: 'Keep pumping. Note it (1926.651(h)(1)).' },
        { cat: 2, cost: 120, desc: 'The trench has water in it.', key: ['flooded'],
          resp: { floor: { look: { t: 'Water over the boot tops. No pump running.', clue: 'flooded' } } },
          why: 'Working in water (1926.651(h)(1)). Correction: pump it out first; charged to the GC. Photo it.' },
        { cat: 3, desc: 'The gas meter is alarming.', key: ['alarm'],
          resp: { meter: { look: { t: 'H2S 25 PPM. LEL 18 percent. ALARM.', clue: 'alarm' } }, floor: { smell: { t: 'Rotten eggs.', clue: 'alarm' } } },
          why: 'Toxic, flammable air. Stop: everyone out, ventilate, and call it in (1926.651(g)(1)).' }
      ] },
    { id: 'c_excavator', room: 'c_trench', name: 'Excavator at the Edge', say: 'excavator at the trench', art: 'c_excavator',
      hint: 'Never under a load. Equipment near the edge needs a stop or a signal.',
      osha: 'Nobody is under a load being handled by digging equipment (1926.651(e)); equipment near an edge has a warning system (1926.651(f)); workers near traffic wear vests (1926.651(d)).',
      parts: [{ id: 'bucket', name: 'bucket', r: [100, 20, 50, 60] }, { id: 'stop', name: 'stop log', r: [0, 86, 240, 16] }, { id: 'crew', name: 'crew', r: [170, 40, 70, 60] }, { id: 'under', name: 'under the bucket', r: [100, 76, 60, 59] }],
      base: { bucket: { look: 'The excavator bucket.' } },
      variants: [
        { cat: 0, desc: 'The excavator works at the trench edge, with a stop log and a spotter.', key: ['safe'],
          resp: { stop: { look: { t: 'A timber stop log at the edge.', clue: 'safe' } }, crew: { look: { t: 'A spotter in a vest.', clue: 'safe' } } },
          why: 'Warning system and spotter. Nothing to do (1926.651(f)).' },
        { cat: 1, desc: "The excavator's swing area isn't taped off.", key: ['tape'],
          resp: { crew: { look: { t: 'No tape around the swing radius.', clue: 'tape' } } },
          why: 'Tape off the swing. Note it (good practice).' },
        { cat: 2, cost: 150, desc: 'The crew near the excavator has no vests.', key: ['vests'],
          resp: { crew: { look: { t: 'Gray shirts. No vests.', clue: 'vests' } }, stop: { look: { t: 'No stop log.', clue: 'vests' } } },
          why: 'No vests and no warning system (1926.651(d), (f)). Correction: vests and a stop log; charged to the GC. Photo it.' },
        { cat: 3, desc: 'Someone is standing under the loaded bucket.', key: ['under'],
          resp: { under: { look: { t: 'A worker directly under a bucket holding pipe.', clue: 'under' } } },
          why: 'Never under a suspended load. Stop: get them out, and call it in (1926.651(e)).' }
      ] },
    { id: 'c_locate', room: 'c_trench', name: 'Utility Locates', say: 'utility locate marks', art: 'c_locate',
      hint: 'Before digging, utilities are marked. Yellow is gas.',
      osha: 'Utilities are located before digging (1926.651(b)(1), (b)(2)), and a competent person inspects daily (1926.651(k)(1)).',
      parts: [{ id: 'paint', name: 'paint marks', r: [10, 60, 180, 50] }, { id: 'flags', name: 'flags', r: [20, 40, 120, 40] }, { id: 'log', name: 'inspection log', r: [196, 0, 44, 44] }, { id: 'line', name: 'the trench', r: [0, 104, 180, 30] }],
      base: { flags: { look: 'Little marker flags.' } },
      variants: [
        { cat: 0, desc: 'Fresh locate paint and flags, and a signed log.', key: ['marked'],
          resp: { paint: { look: { t: 'Yellow for gas, orange for phone. Fresh.', clue: 'marked' } }, log: { look: { t: 'Signed this morning.', clue: 'marked' } } },
          why: 'Marked and inspected. Nothing to do (1926.651(b), (k)).' },
        { cat: 1, desc: 'The locate paint has faded.', key: ['faded'],
          resp: { paint: { look: { t: 'Washed out by rain.', clue: 'faded' } } },
          why: 'Refresh the locate. Note it (1926.651(b)(2)).' },
        { cat: 2, cost: 200, desc: 'No locate marks anywhere.', key: ['none'],
          resp: { paint: { look: { t: 'No paint. No flags.', clue: 'none' } }, log: { look: { t: 'Blank.', clue: 'none' } } },
          why: 'Digging without a locate (1926.651(b)(1)). Correction: stop digging and call 811; charged to the GC. Photo it.' },
        { cat: 3, desc: "There's a hissing sound from the trench.", key: ['hit'],
          resp: { line: { look: { t: 'A yellow gas line, gouged by the bucket.', clue: 'hit' }, smell: { t: 'Gas.', clue: 'hit' } } },
          why: 'A struck gas line. Stop: evacuate upwind, no sparks, and call 911 and the gas company (1926.651(b)(3)).' }
      ] },
    /* ---------------- TRAILER YARD ---------------- */
    { id: 'c_trailer', room: 'c_power', name: 'Trailer, Steps & First Aid', say: 'trailer steps and the first aid kit', art: 'c_trailer',
      hint: 'A kit, someone trained to use it, and a handrail on the steps.',
      osha: 'A first aid kit and a trained person (1926.50(c), (d)); stairs with 4 or more risers get a handrail (1926.1052(c)(1)).',
      parts: [{ id: 'kit', name: 'first aid kit', r: [150, 16, 64, 54] }, { id: 'log', name: 'kit log', r: [212, 18, 26, 46] }, { id: 'rail', name: 'handrails', r: [44, 66, 120, 30] }, { id: 'steps', name: 'steps', r: [56, 96, 100, 39] }],
      base: { steps: { look: 'Metal steps up to the trailer door.' } },
      variants: [
        { cat: 0, desc: 'A first aid kit by the trailer door, and steps with handrails.', key: ['ready'],
          resp: { kit: { look: { t: 'Stocked.', clue: 'ready' } }, log: { look: { t: 'Checked this week.', clue: 'ready' } }, rail: { touch: 'Solid.' } },
          why: 'Ready. Nothing to do (1926.50).' },
        { cat: 1, desc: 'The first aid kit is running low.', key: ['low'],
          resp: { kit: { look: { t: 'Bandages almost gone.', clue: 'low' } } },
          why: 'Restock it. Note it (1926.50(d)(2)).' },
        { cat: 2, cost: 120, desc: 'The trailer steps have no handrail.', key: ['norail'],
          resp: { rail: { look: { t: 'Five steps, no handrail.', clue: 'norail' } } },
          why: 'Four or more risers need a rail (1926.1052(c)(1)). Correction: add one; charged to the GC. Photo it.' },
        { cat: 3, desc: "Someone's hurt on the trailer steps, and the kit is gone.", key: ['hurt'],
          resp: { kit: { look: { t: 'An empty hook. NO KIT.', clue: 'hurt' } }, steps: { look: { t: 'A worker holding a bleeding hand.', clue: 'hurt' } } },
          why: 'An injured worker and no kit. Stop: call 911, start first aid, and call it in (1926.50(c)).' }
      ] },
    { id: 'c_powerline', room: 'c_power', name: 'Overhead Power Lines', say: 'power lines over the yard', art: 'c_powerline',
      hint: 'Look up. Equipment and ladders stay well away from the lines.',
      osha: 'Equipment stays at least 10 feet from lines up to 50 kV (1926.1408; 1926.600(a)(6)); no conductive ladders near lines (1926.1053(b)(12)); temporary lights are guarded (1926.405(a)(2)(ii)(E)).',
      parts: [{ id: 'lines', name: 'power lines', r: [0, 0, 240, 30] }, { id: 'pole', name: 'utility pole', r: [190, 0, 50, 135] }, { id: 'below', name: 'under the lines', r: [0, 30, 190, 105] }],
      base: { pole: { look: 'A wood utility pole.' } },
      variants: [
        { cat: 0, desc: 'Power lines overhead, and a LOOK UP sign.', key: ['clear'],
          resp: { below: { look: { t: 'Nothing anywhere near them.', clue: 'clear' } }, lines: { tape: { t: 'About 25 feet up.', clue: 'clear' } } },
          why: 'Clear. Nothing to do (1926.1408).' },
        { cat: 1, desc: 'The temporary light string has a bare bulb.', key: ['bulb'],
          resp: { below: { look: { t: 'One bulb missing its cage.', clue: 'bulb' } } },
          why: 'Guard the bulb. Note it (1926.405(a)(2)(ii)(E)).' },
        { cat: 2, cost: 130, desc: 'An aluminum ladder near the power lines.', key: ['ladder'],
          resp: { below: { look: { t: 'An aluminum ladder carried upright under the lines.', clue: 'ladder' } } },
          why: 'A conductive ladder near lines (1926.1053(b)(12)). Correction: fiberglass, and keep away; retraining charged to the GC. Photo it.' },
        { cat: 3, desc: 'The lift basket is up near the power lines.', key: ['lift'],
          resp: { below: { look: { t: 'A lift basket about 5 feet from the wires, someone in it.', clue: 'lift' } } },
          why: 'Within 10 feet of an energized line. Stop: move away slowly, and call it in and the utility (1926.1408; 1926.600(a)(6)).' }
      ] },
    { id: 'c_panel', room: 'c_power', name: 'Temporary Power Panel', say: 'temporary power pedestal', art: 'c_panel',
      hint: 'Every 120-volt outlet on site is GFCI protected. Press TEST.',
      osha: 'Temporary 120-volt, 15 and 20 amp receptacles are GFCI protected (1926.404(b)(1)(ii)); covers stay on (1926.405(b)(2)); live parts are guarded (1926.403(b)).',
      parts: [{ id: 'gfci', name: 'GFCI receptacles', r: [50, 22, 100, 76] }, { id: 'cover', name: 'breaker cover', r: [150, 16, 44, 84] }, { id: 'base', name: 'base', r: [20, 100, 200, 35] }],
      base: { base: { look: 'The post, set in the dirt.' } },
      variants: [
        { cat: 0, desc: 'A temporary power pedestal with GFCI outlets.', key: ['trips'],
          resp: { gfci: { touch: { t: 'You press TEST. Click. It trips. You reset it.', clue: 'trips', sfx: 'click' } }, cover: { look: { t: 'Closed and labeled.', clue: 'trips' } } },
          why: 'Protected and closed. Nothing to do (1926.404(b)(1)).' },
        { cat: 1, desc: 'The power pedestal is caked in mud.', key: ['dirty'],
          resp: { cover: { look: { t: "Labels smudged and hard to read.", clue: 'dirty' } } },
          why: 'Clean and relabel. Note it.' },
        { cat: 2, cost: 200, desc: 'The breaker cover is missing.', key: ['open', 'notrip'],
          resp: { cover: { look: { t: 'No cover. Open knockouts.', clue: 'open' } }, gfci: { touch: { t: 'TEST does nothing.', clue: 'notrip' } } },
          why: 'Open knockouts and a dead GFCI (1926.404(b)(1)(ii); 1926.405(b)(2)). Correction: electrician today; charged to the GC. Photo it.' },
        { cat: 3, desc: 'The power pedestal is standing in water.', key: ['water'],
          resp: { base: { look: { t: 'Standing water around the base, and live lugs showing.', clue: 'water' } } },
          why: 'Live parts in water. Stop: keep everyone back, electrician kills power, and call it in (1926.403(b); 1926.416(a)(1)).' }
      ] },
    { id: 'c_cords', room: 'c_power', name: 'Extension Cords', say: 'extension cords across the yard', art: 'c_cords',
      hint: 'Heavy-duty cords, no splices, a ground pin, and protected where they cross traffic.',
      osha: 'Cords are hard or extra-hard usage (1926.405(a)(2)(ii)(J)), kept in good repair with no splices that weaken them (1926.416(e)(1)), and protected from damage.',
      parts: [{ id: 'jacket', name: 'cord jacket', r: [0, 50, 240, 34] }, { id: 'plug', name: 'plug', r: [176, 92, 52, 30] }, { id: 'ramp', name: 'where it crosses', r: [56, 56, 80, 34] }],
      base: { plug: { look: 'The plug end.' } },
      variants: [
        { cat: 0, desc: 'Heavy-duty cords under a cord ramp.', key: ['rated'],
          resp: { jacket: { look: { t: '12/3 SJOW.', clue: 'rated' } }, plug: { look: { t: 'Three prongs, ground intact.', clue: 'rated' } } },
          why: 'Rated and protected. Nothing to do (1926.405).' },
        { cat: 1, desc: 'A cord across the walkway.', key: ['across'],
          resp: { jacket: { look: { t: 'Lying across the walkway, not hung or covered.', clue: 'across' } } },
          why: 'Hang it or cover it. Note it.' },
        { cat: 2, cost: 60, desc: 'The cord has tape on it.', key: ['splice', 'ground'],
          resp: { jacket: { look: { t: 'A taped splice. It\'s light-duty lamp cord.', clue: 'splice' } }, plug: { look: { t: 'The ground pin is cut off.', clue: 'ground' } } },
          why: 'Splices, light cord, and no ground (1926.405(a)(2)(ii)(J); 1926.416(e)(1)). Correction: out of service; charged to the GC. Photo it.' },
        { cat: 3, desc: 'The cord is lying in a puddle.', key: ['copper'],
          resp: { jacket: { look: { t: 'Bare copper showing, in the water.', clue: 'copper' } } },
          why: 'Exposed conductors in water. Stop: unplug at the source, then remove it, and call it in (1926.416(e)(1)).' }
      ] },
    { id: 'c_cutsaw', room: 'c_power', name: 'Cut Station Tools', say: 'saw and grinder at the cut station', art: 'c_cutsaw',
      hint: 'Saw guards snap back. Grinder guards stay on.',
      osha: 'Guards stay on and work (1926.300(b)); circular saws have a lower guard that returns (1926.304(d)); damaged tools come out of service (1926.300(a)).',
      parts: [{ id: 'saw', name: 'circular saw', r: [30, 14, 100, 96] }, { id: 'guard', name: 'lower guard', r: [30, 70, 80, 40] }, { id: 'grinder', name: 'grinder', r: [140, 26, 96, 70] }, { id: 'cord', name: 'cord', r: [190, 110, 50, 20] }],
      base: { saw: { look: 'A worm-drive saw.' } },
      variants: [
        { cat: 0, desc: 'A circular saw and a grinder at the cut station.', key: ['guarded'],
          resp: { guard: { touch: { t: 'It snaps right back.', clue: 'guarded' } }, grinder: { look: { t: 'Guard on.', clue: 'guarded' } } },
          why: 'Guards on and working. Nothing to do (1926.300(b)).' },
        { cat: 1, desc: 'The saw blade looks dull.', key: ['dull'],
          resp: { saw: { look: { t: 'Dull, and burned cut marks on the plywood.', clue: 'dull' } } },
          why: 'Swap the blade. Note it.' },
        { cat: 2, cost: 80, desc: 'Something is stuck in the saw guard.', key: ['stick'],
          resp: { guard: { look: { t: 'A stick wedged in the lower guard so it stays open.', clue: 'stick' } }, grinder: { look: { t: 'Grinder guard removed.', clue: 'stick' } } },
          why: 'Defeated guards (1926.300(b); 1926.304(d)). Correction: out of service; charged to the GC. Photo it.' },
        { cat: 3, desc: 'The grinder disc is cracked.', key: ['crack'],
          resp: { grinder: { look: { t: 'A crack across the disc.', clue: 'crack' } }, cord: { look: { t: 'Copper showing through the cord.', clue: 'crack' } } },
          why: 'A cracked disc can explode. Stop: unplug it, tag it out, and call it in (1926.300(a)).' }
      ] },
    { id: 'c_silica', room: 'c_power', name: 'Masonry Saw & Silica', say: 'masonry saw cutting block', art: 'c_silica',
      hint: 'Cutting block makes silica dust. Water or a vacuum keeps it down.',
      osha: 'Cutting masonry uses water or vacuum controls (1926.1153(c)(1), Table 1); no dry sweeping or compressed air (1926.1153(f)); and a written exposure plan (1926.1153(g)).',
      parts: [{ id: 'blade', name: 'blade', r: [76, 6, 70, 70] }, { id: 'water', name: 'water feed', r: [40, 60, 140, 50] }, { id: 'air', name: 'the air', r: [150, 0, 90, 60] }, { id: 'vac', name: 'vacuum', r: [176, 50, 60, 70] }],
      base: { blade: { look: 'A diamond blade.' } },
      variants: [
        { cat: 0, desc: 'A masonry saw cutting wet.', key: ['wet'],
          resp: { water: { look: { t: 'Water at the blade. Slurry, no dust.', clue: 'wet' } } },
          why: 'Wet cutting. Nothing to do (1926.1153).' },
        { cat: 1, desc: "The dust vacuum's bag is bulging.", key: ['bag'],
          resp: { vac: { look: { t: 'The bag is full.', clue: 'bag' } } },
          why: 'Empty it. Note it.' },
        { cat: 2, cost: 150, desc: 'Someone is sweeping dust near the saw.', key: ['sweep'],
          resp: { air: { look: { t: 'Dry sweeping, gray cloud.', clue: 'sweep' } } },
          why: 'Dry sweeping silica (1926.1153(f)). Correction: wet or vacuum it; charged to the GC. Photo it.' },
        { cat: 3, desc: "There's a gray cloud around the masonry saw.", key: ['dry'],
          resp: { air: { look: { t: 'Dry-cutting. A thick gray cloud.', clue: 'dry' }, smell: { t: 'Dust.', clue: 'dry' } } },
          why: 'Uncontrolled silica dust. Stop the cutting until controls are on, and call it in (1926.1153(c)(1)).' }
      ] },
    { id: 'c_fuel', room: 'c_power', name: 'Fuel & Propane', say: 'fuel cans and propane', art: 'c_fuel',
      hint: 'Approved cans, chained cylinders, an extinguisher, and no smoking.',
      osha: 'Gas in approved containers (1926.152(a)(1)); cylinders secured (1926.350(a)(9)); an extinguisher within 100 feet (1926.150(c)(1)); no smoking near fuel (1926.151(a)(3)).',
      parts: [{ id: 'cans', name: 'fuel cans', r: [10, 56, 90, 64] }, { id: 'cylinders', name: 'propane cylinders', r: [112, 20, 74, 100] }, { id: 'ext', name: 'extinguisher', r: [192, 34, 44, 64] }, { id: 'sign', name: 'sign', r: [8, 4, 88, 34] }],
      base: { sign: { look: 'NO SMOKING. NO FLAMES.' } },
      variants: [
        { cat: 0, desc: 'Red safety cans and propane cylinders, chained.', key: ['stored'],
          resp: { cans: { look: { t: 'Approved safety cans.', clue: 'stored' } }, cylinders: { touch: { t: 'Chained and capped.', clue: 'stored' } }, ext: { look: 'Tagged this month.' } },
          why: 'Stored right. Nothing to do (1926.150; 1926.152).' },
        { cat: 1, desc: "The extinguisher tag isn't current.", key: ['tag'],
          resp: { ext: { look: { t: 'Last checked in September.', clue: 'tag' } } },
          why: 'Do the monthly check. Note it (1926.150(c)(1)).' },
        { cat: 2, cost: 90, desc: 'Gasoline in a soda bottle, and a cylinder loose.', key: ['bottle', 'loose'],
          resp: { cans: { look: { t: 'A soda bottle full of gas.', clue: 'bottle' } }, cylinders: { touch: { t: 'One leans, no chain.', clue: 'loose' } } },
          why: 'Unapproved container, unsecured cylinder (1926.152(a)(1); 1926.350(a)(9)). Correction: fix both; charged to the GC. Photo it.' },
        { cat: 3, desc: "Someone's smoking by the fuel cans.", key: ['smoke'],
          resp: { cans: { look: { t: 'A lit cigarette, inches from the cans.', clue: 'smoke' }, smell: { t: 'Gas and smoke.', clue: 'smoke' } } },
          why: 'Smoking at the fuel. Stop: put it out, and call it in (1926.151(a)(3)).' }
      ] }
  ];

  /* ============================== SMALL FINDS ============================== */
  const ANOMALIES = [
    { id: 'c_a_cone', room: 'c_gate', name: 'Knocked-over cone', cat: 1, pts: () => around(P(1.6, 0, 9.4), 18, 10, -3), walk: { x: 1.6, z: 8.6 },
      look: 'A traffic cone on its side.', touch: 'You stand it back up.', why: 'Housekeeping. Note it.',
      draw(g) { const p = P(1.6, 0, 9.4); pxRect(g, p[0] - 6, p[1] - 4, 10, 4, '#f07a1a'); pxRect(g, p[0] - 3, p[1] - 4, 2, 4, '#f4f2dc'); } },
    { id: 'c_a_coffee', room: 'c_gate', name: 'Coffee cup', cat: 0, pts: () => around(P(-1.2, 0, 7), 10, 10, -4), walk: { x: -1.2, z: 6.2 },
      look: "A gas station coffee cup. Somebody's morning.", why: 'Trash. Not a finding.',
      draw(g) { const p = P(-1.2, 0, 7); pxRect(g, p[0] - 2, p[1] - 6, 4, 6, '#f4f2ea'); pxRect(g, p[0] - 2, p[1] - 4, 4, 1, '#8a5a2a'); } },
    { id: 'c_a_glove', room: 'c_gate', name: 'Glove on the fence', cat: 0, pts: () => Q.back(box('c_gate'), 1.5, 1.9, 1.6, 2.0), walk: { x: 1.4, z: 12 },
      look: 'A single work glove stuck on the fence, waving.', why: 'Lost glove. Not a finding.',
      draw(g, r) { fillPoly(g, Q.back(r.box, 1.55, 1.85, 1.65, 1.95), '#f2c418'); } },
    { id: 'c_a_chalk', room: 'c_deck', name: 'Chalk lines', cat: 0, pts: () => Q.floor(-4.4, -3, 11, 13), walk: { x: -3.6, z: 10.4 },
      look: 'Blue chalk layout lines for walls going up next week.', why: 'Layout. Not a finding.',
      draw(g) { for (const z of [11.2, 12.4]) lineW(g, P(-4.4, 0, z), P(-3, 0, z), '#4a7ae0'); lineW(g, P(-3.6, 0, 11), P(-3.6, 0, 13), '#4a7ae0'); } },
    { id: 'c_a_bolts', room: 'c_deck', name: 'Bucket of bolts', cat: 1, pts: () => around(P(-4.8, 0, 12.6), 12, 10, -4), walk: { x: -4.4, z: 12 },
      look: 'A bucket of bolts near the edge.', why: 'Move it back from the edge. Note it.',
      draw(g) { const p = P(-4.8, 0, 12.6); pxRect(g, p[0] - 3, p[1] - 6, 6, 6, '#f07a1a'); pxRect(g, p[0] - 2, p[1] - 6, 4, 1, '#8a8e96'); } },
    { id: 'c_a_pigeon', room: 'c_deck', name: 'Pigeon', cat: 0, pts: () => around(P(-6.2, 4.3, 15.7), 12, 8), walk: { x: -5, z: 14 },
      look: 'A pigeon on top of the column. It looks unimpressed.', why: 'Not a finding.',
      draw(g) { const p = P(-6.2, 4.3, 15.7); pxRect(g, p[0] - 2, p[1] - 3, 5, 3, '#8a8e9a'); } },
    { id: 'c_a_tape', room: 'c_trench', name: 'Caution tape down', cat: 1, pts: () => Q.floor(.4, 2.2, 10.2, 10.8), walk: { x: 1.2, z: 9.6 },
      look: 'Caution tape lying on the ground.', why: 'Put it back up. Note it.',
      draw(g) { lineW(g, P(.4, 0, 10.5), P(2.2, 0, 10.4), '#f2c418'); } },
    { id: 'c_a_cooler', room: 'c_trench', name: 'Lunch cooler', cat: 0, pts: () => around(P(4.4, 0, 8.4), 14, 10, -4), walk: { x: 4, z: 7.6 },
      look: 'A red lunch cooler with RAY on it.', why: 'Not a finding.',
      draw(g) { const p = P(4.4, 0, 8.4); pxRect(g, p[0] - 5, p[1] - 6, 10, 6, '#d82020'); pxRect(g, p[0] - 5, p[1] - 6, 10, 1, '#f4f2ea'); } },
    { id: 'c_a_bulb', room: 'c_power', name: 'Burned-out floodlight', cat: 1, pts: () => Q.back({ ...BOX, zb: G.power.trailer[2] }, -4, -3.2, 3.0, 3.4), walk: { x: -3, z: 12.4 },
      look: 'A dead floodlight over the trailer.', why: 'Replace the lamp. Note it.',
      draw(g, r) { fillPoly(g, Q.back({ ...r.box, zb: G.power.trailer[2] }, -3.9, -3.3, 3.05, 3.3), '#3a3c42'); } },
    { id: 'c_a_radio', room: 'c_power', name: 'Job radio', cat: 0, pts: () => around(P(1.8, 0, 12.8), 12, 10, -4), walk: { x: 1.8, z: 12.2 },
      look: 'A radio playing country.', why: 'Not a finding.',
      draw(g) { const p = P(1.8, 0, 12.8); pxRect(g, p[0] - 4, p[1] - 5, 8, 5, '#f2c418'); pxRect(g, p[0] - 2, p[1] - 4, 3, 3, '#2a2c32'); } },
    { id: 'c_a_puddle', room: 'c_power', name: 'Puddle', cat: 1, pts: () => around(P(1.2, 0, 10.8), 22, 8, -2), walk: { x: 1.2, z: 10 },
      look: 'A puddle in the gravel.', why: 'Fill it. Note it.',
      draw(g) { fillPoly(g, floorBlob(1.2, 10.8, .7, .3, 5, .3, 12), 'rgba(90,120,140,0.5)'); } }
  ];

  /* ============================== LEFT BEHIND ============================== */
  const spr = kind => (g, x, y, k) => drawSprite(g, A.SPRITES[kind], x, y + 1, sprScale(k), SPR_PAL);
  const CLUTTER = {
    c_tape: { name: 'Tape measure', look: 'A 25-foot tape measure.', touch: 'You pull out a foot. SNAP.', smell: 'Metal.', draw: spr('c_tape') },
    c_level: { name: 'Level', look: 'A yellow two-foot level.', touch: 'Dead level on the dirt.', smell: 'Aluminum.', draw: spr('c_level') },
    c_thermos: { name: 'Thermos', look: 'A green thermos. Coffee, still warm.', touch: 'Warm.', smell: 'Coffee.', draw: spr('c_thermos') },
    c_hammer: { name: 'Framing hammer', look: 'A framing hammer.', touch: 'Heavy.', smell: 'Wood.', draw: spr('c_hammer') },
    c_cone: { name: 'Small cone', look: 'A little orange cone.', touch: 'Floppy.', smell: 'Rubber.', draw: spr('c_cone') }
  };
  const CLUTTER_SPOTS = {
    c_gate: [[-1.6, 8.6], [2.8, 7.2], [-3.4, 9.8], [.6, 11.2], [3.6, 10.4]],
    c_deck: [[-3, 7.6], [1.6, 8.8], [-.4, 12.4], [2.4, 11.6], [-4.4, 9.6]],
    c_trench: [[1.4, 10.8], [3.2, 6.8], [.2, 11.6], [4.8, 11.2], [2.6, 9.6]],
    c_power: [[-2.6, 6.4], [.6, 11.6], [-3.6, 9.2], [4.6, 6.2], [-1, 12.2]]
  };

  /* ============================== THE PAPERWORK ============================== */
  const CATS = [
    { name: 'OK / Compliant', short: 'OK', hint: 'Meets the rules. Nothing to do.' },
    { name: 'Note / Housekeeping', short: 'Note', hint: 'Minor: mention it. No correction notice.' },
    { name: 'Correct / Violation', short: 'Correct', hint: 'A violation: written correction, charged to the contractor. Needs a photo.' },
    { name: 'Stop / Imminent Danger', short: 'Stop', hint: 'Stop the work, clear the area, make it safe, and call it in.' }
  ];
  const BRIEFING = [
    { title: 'Site walk', art: 'door', text: "Brickroad is building <b>Site 204</b>, a two-story addition. The general contractor runs the site, but it's our building and our name on the permit, so we walk it." },
    { title: 'Suit up first', art: 'dana', text: 'The <b>visitor PPE table</b> is right by the gate: <b>hard hat</b>, <b>safety glasses</b>, <b>hi-vis vest</b>, <b>safety-toe boots</b>, and <b>hearing protection</b> for the trailer yard.' },
    { title: 'The Focus Four', art: 'verbs', text: 'Most construction deaths come from four things: <b>falls</b>, <b>struck-by</b>, <b>caught-in or between</b>, and <b>electrocution</b>. Every area here has some of each.' },
    { title: 'Four calls', art: 'cats', text: 'Mark everything <b>OK</b>, <b>Note</b>, <b>Correct</b> (written up and charged to the contractor, with a photo), or <b>Stop</b> (imminent danger).' },
    { title: 'Look it up', art: 'zoom', text: 'The binder has the site <b>SOP</b> and the <b>Field Safety Handbook</b>. Construction rules are <b>29 CFR 1926</b>.' },
    { title: "We're not OSHA", art: 'camera', text: "We can't fine anybody. We document, require correction under the contract, and for imminent danger we <b>stop the work</b> and <b>call it in</b>." }
  ];
  const SOP = `
    <div class="pg title-pg"><p class="pg-co">BRICKROAD PROPERTY MGMT.</p><h2>Standard Operating Procedure 9.6</h2><p class="pg-sub">Construction Site Walks</p><p class="pg-note">Hard hat before clipboard.</p><span class="coffee" aria-hidden="true"></span></div>
    <div class="pg"><h3>The four calls</h3>
      <div class="sop-cat c0" data-sop="c0"><b>0 &middot; OK</b><p>Compliant. Nothing to do.</p></div>
      <div class="sop-cat c1" data-sop="c1"><b>1 &middot; Note</b><p>Housekeeping: a loose tarp, a missing flag, a muddy rung. Mention it; no charge.</p></div></div>
    <div class="pg">
      <div class="sop-cat c2" data-sop="c2"><b>2 &middot; Correct</b><p>A violation: a <em>written correction notice</em> to the GC, charged under the contract, and <em>always a photo</em>.</p></div>
      <div class="sop-cat c3" data-sop="c3"><b>3 &middot; Stop</b><p>Imminent danger. <em>Stop the work, clear the area, and call it in.</em></p></div></div>
    <div class="pg sop-tips"><h3>Field method</h3><ul>
      <li data-sop="ppe"><b>PPE first.</b> The visitor table is at the gate.</li>
      <li data-sop="look"><b>Look</b> for a close-up, then <b>touch</b>, <b>smell</b>, and <b>use tools</b>.</li>
      <li data-sop="measure"><b>Measure</b>: rail heights, trench depth, ladder reach.</li>
      <li data-sop="photo">Every <b>Correct</b> and <b>Stop</b> gets a <b>photo</b>.</li>
      <li data-sop="safe"><b>Stop</b> means stop: tell the super, then call it in.</li>
      <li data-sop="finish">Then hit <b>Finish</b>.</li></ul></div>
    <div class="pg sop-tips"><h3>The Focus Four</h3><ul>
      <li><b>Falls:</b> guardrails at 42 inches, covered holes, harnesses tied off (1926.501; 1926.502).</li>
      <li><b>Struck-by:</b> backup alarms, spotters, hard hats (1926.601(b)(4); 1926.100).</li>
      <li><b>Caught-in:</b> trench boxes over 5 feet, spoil back 2 feet (1926.652; 1926.651(j)(2)).</li>
      <li><b>Electrocution:</b> GFCIs, good cords, 10 feet from power lines (1926.404(b)(1); 1926.1408).</li></ul></div>
    <div class="pg sop-tips"><h3>OSHA-10</h3><ul>
      <li>Most crews carry an <b>OSHA-10</b> card: ten hours on the Focus Four, PPE, health hazards, and their rights.</li>
      <li>The card is training, not a license. It doesn't make a site safe; people do.</li>
      <li>If a contractor won't fix an imminent danger, Pat calls OSHA: 1-800-321-OSHA.</li></ul></div>`;
  const BLANK = {
    ceiling: { look: ['Open sky.', 'Sky. A few clouds.'], touch: "It's the sky.", smell: 'Diesel and dust.', talk: 'You yell. A bird flies off.', flashlight: "It's daytime.", camera: 'A photo of the sky. Not useful.', clipboard: 'Nothing to mark.', hammer: "You can't hammer the sky.", any: 'The sky.' },
    wall: { look: ['A chain-link fence with green windscreen.', 'The fence.'], touch: 'Chain-link.', smell: 'Dust.', talk: 'The fence says nothing.', hammer: 'Jingle.', flashlight: "It's daytime.", camera: 'A photo of a fence. Not useful.', clipboard: 'Nothing to mark.', any: 'The fence.' }
  };

  /* ============================== REGISTER ============================== */
  for (const [k, r] of Object.entries(ROOMS)) r.id = k;
  const ids = Object.keys(ROOMS);
  Sites.register({
    music: 'jobsite',
    id: 'construction', place: 'Site', kind: 'Construction', tag: 'A Jobsite Safety Adventure',
    form: 'SITE SAFETY WALK', report: 'Site Safety Report', start: 'c_gate', calls: false,
    words: { tenant: 'contractor', deposit: 'contract', damage: 'violation', where: 'site' },
    opener: unit => `Site ${unit}! Gear up at the visitor table first: hard hat, glasses, vest, boots, and earplugs. Then the deck, the trench, and the trailer yard. Hit Finish when you're done.`,
    ppe: { need: { c_deck: ['hardhat', 'glasses', 'vest', 'boots'], c_trench: ['hardhat', 'glasses', 'vest', 'boots'], c_power: ['hardhat', 'glasses', 'vest', 'boots', 'ears'] }, where: "The visitor PPE table is back at the gate." },
    title: A.title,
    sop: SOP,
    tables: {
      ROOMS, FEATURES, ANOMALIES, ZOOM_ART: A.ZOOM_ART || {},
      CATS, BRIEFING, BLANK, CLUTTER, CLUTTER_SPOTS, DOORS, CONTAINERS,
      // gray areas: calls a reasonable inspector could defend, worth partial credit (js/partial-marks.js)
      ACCEPTABLE: {
        'c_signboard:1': [0], 'c_stacks:1': [0], 'c_rebar:1': [0], 'c_truck:1': [0], 'c_crew:1': [0], 'c_planks:1': [0], 'c_trladder:1': [0], 'c_water:1': [0],
        'c_excavator:1': [0], 'c_panel:1': [0], 'c_cutsaw:1': [0], 'c_silica:1': [0],
        c_a_coffee: [1], c_a_cone: [0], c_a_puddle: [0]
      }, FLOOR_CLUTTER: Object.keys(CLUTTER), ITEM_SPRITES: A.SPRITES,
      PAINTS: Object.fromEntries(ids.map(k => [k, [['Jobsite', '#c8c8c0']]])),
      FLOORS: Object.fromEntries(ids.map(k => [k, [{ base: '#9a8262', dk: '#806a4c', lt: '#b09a78' }]])),
      UNITS: ['104', '118', '206', '212', '301', '315', '402', '410', '508', '516']
    }
  });
})();
