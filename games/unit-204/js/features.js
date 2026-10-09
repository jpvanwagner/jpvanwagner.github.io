'use strict';
/* ============================== INSPECTION CONTENT ==============================
   Every shift, each feature gets one of its possible conditions at random. A condition has:
     cat   0 clean, 1 normal wear & tear, 2 tenant damage, 3 maintenance hazard
     desc  what you see when the close-up opens
     key   clue ids that count as evidence (find one before marking for a bonus)
     cost  deposit charge for damage
     why   the SOP reasoning, shown as feedback and in the report
     resp  { part: { verb or tool: response } }
   A response is a string, an object { t, clue, set, sfx }, or a list of objects where { if: 'flag' }
   picks the first one that applies (flags are set by earlier actions, like opening a cabinet). */
const CATS = [
  { name: 'Clean / No Action', short: 'Clean', hint: 'Works and looks as expected.' },
  { name: 'Normal Wear & Tear', short: 'Wear & Tear', hint: 'Age and everyday use. Never charged.' },
  { name: 'Tenant Damage', short: 'Damage', hint: 'Accident, neglect or abuse. Charge the deposit.' },
  { name: 'Maintenance Hazard', short: 'Hazard', hint: 'Safety risk. Emergency work order.' }
];
const OPEN_FIRST = { if: '!open', t: 'Open the cabinet doors first.' };

const FEATURES = [
  /* ---------------- LIVING ROOM ---------------- */
  { id: 'carpet', room: 'living', name: 'Carpet', art: 'carpet',
    hint: 'Carpet tells you more by feel and smell than by looking. Get down there.',
    parts: [{ id: 'corner', name: 'carpet by the window', r: [168, 4, 68, 44] }, { id: 'center', name: 'middle of the carpet', r: [62, 30, 110, 62] }, { id: 'lane', name: 'path to the hallway', r: [0, 96, 240, 39] }],
    base: { '*': { talk: 'You compliment the carpet. It remains beige.' }, corner: { look: 'Just carpet meeting baseboard.' } },
    variants: [
      { cat: 0, desc: 'Builder-beige carpet. Fresh vacuum stripes run across the whole room.', key: ['c'],
        resp: { center: { look: "That's no stain, just the shadow of the window frame.", touch: { t: 'Soft and springy. Freshly shampooed.', clue: 'c' }, smell: { t: "Carpet deodorizer. 'Mountain Breeze,' allegedly.", clue: 'c' } },
          lane: { look: 'The vacuum lines run right through the walkway. No matting.', touch: { t: 'The pile springs right back up.', clue: 'c' } } },
        why: 'Clean, springy carpet with no stains or matting. Nothing to do.' },
      { cat: 1, desc: 'Beige carpet. A greyish, flattened lane runs from the front door toward the hall.', key: ['lane'],
        resp: { lane: { look: 'Grey and flat, but no spots. Years of feet.', touch: { t: 'The fibers are crushed flat but intact. Not sticky, not crunchy.', clue: 'lane' }, tape: { t: 'The worn lane is about 20 inches wide, exactly where people walk.', clue: 'lane' }, smell: 'Dust. Just dust.' },
          center: { touch: 'Soft enough out here, away from the walkway.' } },
        why: "Matting in a walking path is the textbook example of normal wear. Carpet ages with use; that's never chargeable." },
      { cat: 2, cost: 325, desc: 'A big dark blotch spreads across the middle of the room.', key: ['urine', 'soak', 'ring'],
        resp: { center: { look: 'A dark, uneven stain about the size of a pizza.', smell: { t: "Ammonia. Sharp. That's pet urine, and not just once.", clue: 'urine' }, touch: { t: 'Stiff and crunchy. It soaked through to the pad.', clue: 'soak' },
          tape: { t: 'The stain is about 16 inches across.', clue: 'soak' }, flashlight: { t: 'At a low angle the beam picks out older rings around it. Repeat accidents.', clue: 'ring' }, pencil: 'You circle the stain lightly for the carpet crew.' } },
        why: "Pet urine that soaked into the pad is damage, not wear. The pad and that section get replaced and charged to the deposit." },
      { cat: 2, cost: 180, desc: 'Something has left little black marks in the carpet near the window.', key: ['burn'],
        resp: { corner: { look: 'Three little black craters melted into the pile.', touch: { t: 'Hard, melted nubs. The nylon fused when it burned.', clue: 'burn' }, smell: { t: 'Stale cigarette smoke, baked into the fibers.', clue: 'burn' }, tape: { t: 'Each burn is about a quarter inch. Three of them.', clue: 'burn' } } },
        why: "Cigarette burns are damage from carelessness. Burned carpet can't be cleaned, so the section is replaced and charged." }
    ] },
  { id: 'tvwall', room: 'living', name: 'TV Wall', art: 'tvwall',
    hint: "If there's hardware left in a wall, take it out and measure what's underneath.",
    parts: [{ id: 'jack', name: 'cable jack', r: [182, 92, 26, 26] }, { id: 'upper', name: 'wall where the TV hung', r: [40, 8, 160, 70] }, { id: 'lower', name: 'lower wall', r: [0, 80, 240, 55] }],
    base: { jack: { look: "A coax cable jack, for the 'HD-ready' TV.", touch: "It's a cable jack. It's fine." }, lower: { look: 'Smooth paint, a little scuffing near the floor.', touch: 'Smooth.' } },
    variants: [
      { cat: 1, desc: 'A few tiny nail holes where pictures used to hang.', key: ['nail'],
        resp: { upper: { look: 'Four tiny holes in a neat row. Picture nails.', tape: { t: 'Each hole is under 1/8 inch. Picture-nail size.', clue: 'nail' }, touch: { t: 'Clean little holes. No torn paper, no cracks.', clue: 'nail' }, pencil: 'You circle each hole so the painter can find them.' } },
        why: 'Small nail holes from hanging pictures are normal wear. Painters spackle them as part of every turnover.' },
      { cat: 1, desc: 'Four plastic anchors are still in the wall, screws and all, where a TV mount used to be.', key: ['anchor'],
        resp: { upper: {
          look: [{ if: 'removed', t: 'Four neat little holes where the anchors were.' }, { t: "Anchors with the screws still in. You can't see the holes under them yet." }],
          screwdriver: [{ if: 'removed', t: 'Nothing left to unscrew.' }, { t: 'You back out the screws and pop the anchors. Underneath: four neat holes.', set: 'removed', sfx: 'unscrew' }],
          tape: [{ if: 'removed', t: 'Each hole is exactly 1/4 inch, within normal wear per the SOP.', clue: 'anchor' }, { t: 'The anchors fill the holes. Take them out first, then measure.' }],
          touch: [{ if: 'removed', t: 'Clean edges. A dab of spackle each.', clue: 'anchor' }, { t: 'The anchors are snug. Somebody installed them properly.' }] } },
        why: 'Anchor holes 1/4 inch or smaller are normal wear. Pulling the anchors showed small, clean holes and no torn drywall.' },
      { cat: 2, cost: 220, desc: 'The TV mount was ripped right out of the wall.', key: ['torn'],
        resp: { upper: { look: 'Two ragged holes with torn paper and crumbled gypsum.', tape: { t: 'Both holes are 3 to 4 inches across, way past 1/4 inch.', clue: 'torn' }, touch: { t: 'Crumbly edges. The drywall face is torn away.', clue: 'torn' }, flashlight: { t: 'You can see straight into the stud cavity. Pink insulation.', clue: 'torn' } } },
        why: "Holes bigger than 1/4 inch with torn drywall are damage. The mount was yanked out, not taken down, so the patch is charged." },
      { cat: 0, desc: 'A clean, freshly painted wall.', key: ['paint'],
        resp: { upper: { look: 'Not a mark on it. Somebody patched and touched up before leaving.', touch: { t: 'Smooth and fully cured. The patches are sanded flush.', clue: 'paint' }, flashlight: { t: 'Even at a low angle, no bumps or holes show.', clue: 'paint' } } },
        why: 'The tenant patched and painted properly. Nothing to do here.' }
    ] },
  { id: 'fan', room: 'living', name: 'Ceiling Fan', art: 'fan',
    hint: 'With ceiling fans, run it and check the mount.',
    parts: [{ id: 'canopy', name: 'mounting canopy', r: [92, 0, 56, 24] }, { id: 'chain', name: 'pull chain', r: [146, 58, 16, 62] }, { id: 'light', name: 'light kit', r: [92, 56, 54, 34] }, { id: 'blades', name: 'fan blades', r: [0, 22, 240, 36] }],
    base: { light: { look: 'A frosted glass bowl. Three dead moths, standard issue.', touch: 'Warm. The bulbs work.' }, chain: { look: 'A pull chain with a little brass bead.' }, blades: { look: 'Five oak-look blades.' } },
    variants: [
      { cat: 0, desc: 'A five-blade brushed-nickel fan with a frosted light kit.', key: ['smooth'],
        resp: { chain: { touch: { t: 'Click. It spins up smooth and quiet.', set: 'spin', clue: 'smooth', sfx: 'click' } }, canopy: { look: 'Snug against the ceiling.', screwdriver: { t: 'Every canopy screw is tight.', clue: 'smooth', sfx: 'unscrew' }, touch: { t: "Solid. It doesn't budge.", clue: 'smooth' } }, blades: { look: 'Level and freshly dusted.' } },
        why: 'It runs smoothly and the mount is tight. Nothing to do.' },
      { cat: 1, desc: 'The fan works, but the oak-look blades are faded and a little droopy.', key: ['droop'],
        resp: { blades: { look: { t: 'Two blades sag slightly. Years of heat and humidity.', clue: 'droop' }, tape: { t: 'The blade tips droop about 1/4 inch. Cosmetic.', clue: 'droop' } }, chain: { touch: { t: 'It spins with a soft, steady tick. Old, but solid.', set: 'spin', clue: 'droop', sfx: 'click' } }, canopy: { screwdriver: { t: "The canopy screws are tight. It's well mounted.", sfx: 'unscrew' }, touch: 'Solid.' } },
        why: 'Faded, slightly drooping blades on a fan that runs fine are age. Wear and tear, not a safety issue.' },
      { cat: 3, desc: 'The canopy is hanging half an inch below the ceiling.', key: ['wobble', 'bracket'],
        resp: { canopy: { look: "There's a dark gap between the canopy and the ceiling. That's not right.", screwdriver: { t: 'The screws are stripped. The bracket is barely holding onto the box. This could come down.', clue: 'bracket', sfx: 'unscrew' }, touch: { t: 'It shifts when you push it. Loose.', clue: 'bracket' } },
          chain: { touch: [{ if: 'wobble', t: "You're not turning that back on." }, { t: 'It lurches into a violent wobble. The mount groans. You kill it fast.', set: 'wobble', clue: 'wobble', sfx: 'creak' }] } },
        why: 'A fan that could fall is a life-safety hazard. Stop use and file an emergency work order, however it got that way.' }
    ] },
  /* ---------------- KITCHEN ---------------- */
  { id: 'sink', room: 'kitchen', name: 'Sink & Cabinet', art: 'sink',
    hint: 'Always open the cabinet and get a light under a sink.',
    parts: [{ id: 'switch', name: 'disposal switch', r: [198, 8, 34, 34] }, { id: 'faucet', name: 'faucet', r: [98, 0, 44, 38] }, { id: 'basin', name: 'sink basin', r: [40, 30, 160, 32] }, { id: 'cabinet', name: 'cabinet under the sink', r: [30, 66, 180, 69] }],
    base: { cabinet: { touch: [{ if: 'open', t: 'The doors are already open.' }, { t: 'You open the cabinet doors.', set: 'open', sfx: 'click' }], look: [{ if: 'open', t: 'Too dark to see much under there.' }, { t: 'Closed cabinet doors. Oak-look laminate.' }], smell: 'Old cabinet. Faint lemon.' },
      basin: { look: 'Stainless double basin.' }, faucet: { touch: 'Hot and cold both run. Decent pressure.' }, switch: { touch: { t: 'Click. The disposal grinds to life, then stops.', sfx: 'click' }, look: 'A disposal switch on the backsplash.' } },
    variants: [
      { cat: 0, desc: 'Stainless double sink, oak cabinet below. Clean and dry.', key: ['dry'],
        resp: { cabinet: { flashlight: [OPEN_FIRST, { t: 'Dry, clean, shelf liner still in. Even the P-trap is spotless.', clue: 'dry' }] }, basin: { touch: { t: 'Dry and clean.', clue: 'dry' }, smell: 'Lemon dish soap.' } },
        why: 'Clean, dry and working. Nothing to do.' },
      { cat: 1, desc: 'White mineral crust rings the faucet base.', key: ['scale'],
        resp: { faucet: { look: { t: 'Hard-water scale around the base and aerator. Years of tap water.', clue: 'scale' }, touch: { t: 'Chalky and rough. It runs fine, just crusty.', clue: 'scale' } }, cabinet: { flashlight: [OPEN_FIRST, { t: 'Dry under here.' }] } },
        why: 'Mineral buildup from years of hard water is normal wear. A cleaning item at turnover, not a charge.' },
      { cat: 2, cost: 45, desc: 'The disposal switch plate is cracked and the toggle has snapped off.', key: ['snap'],
        resp: { switch: { look: { t: 'The toggle is snapped off at the base. The plate is cracked.', clue: 'snap' }, touch: { t: 'Just a jagged stub. Someone forced it.', clue: 'snap' }, screwdriver: { t: 'Behind the plate the wiring is fine. Only the switch is broken.', clue: 'snap', sfx: 'unscrew' } }, cabinet: { flashlight: [OPEN_FIRST, { t: 'Dry under here.' }] } },
        why: "A snapped toggle and cracked plate are physical breakage: tenant damage. The wiring behind it is fine, so it isn't a hazard." },
      { cat: 3, desc: 'The cabinet doors are swollen along the bottom edge.', key: ['leak', 'wet', 'mildew'],
        resp: { cabinet: { touch: [{ if: 'open', t: 'The cabinet floor is soaked and spongy.', clue: 'wet' }, { t: 'The doors stick, then pop open. The cabinet floor is soaked.', set: 'open', clue: 'wet', sfx: 'click' }],
          flashlight: [OPEN_FIRST, { t: 'The supply line is weeping at the compression nut. Drip... drip...', clue: 'leak', sfx: 'drip' }], smell: { t: 'Mildew. Strong.', clue: 'mildew' } } },
        why: 'An active leak under the sink is a maintenance hazard: water damage and mold get worse every hour. Emergency work order.' }
    ] },
  { id: 'stove', room: 'kitchen', name: 'Gas Range', art: 'stove',
    hint: 'With a gas range, trust your nose.',
    parts: [{ id: 'knobs', name: 'control knobs', r: [26, 56, 188, 16] }, { id: 'burners', name: 'burners', r: [26, 6, 188, 48] }, { id: 'oven', name: 'oven door', r: [36, 76, 168, 59] }],
    base: { oven: { touch: { t: 'The door opens with a creak, then closes.', sfx: 'creak' } }, burners: { look: 'Four sealed burners under cast-iron grates.' } },
    variants: [
      { cat: 0, desc: 'A black gas range. Grates scrubbed, drip pans spotless.', key: ['fresh'],
        resp: { burners: { smell: { t: 'Faint dish soap. No gas smell.', clue: 'fresh' } }, knobs: { touch: { t: 'Every knob clicks off firmly.', clue: 'fresh' } }, oven: { look: 'Clean glass, clean racks.' } },
        why: 'Clean, no gas odor, every knob shuts off. Nothing to do.' },
      { cat: 1, desc: 'The grates are heat-tinted and the knob numbers are rubbed off.', key: ['worn'],
        resp: { knobs: { look: { t: 'The numbers are worn off from years of cooking.', clue: 'worn' }, touch: { t: 'They click off firmly. Just worn.', clue: 'worn' } }, burners: { smell: 'Just old cooking. No gas.', look: 'Heat discoloration on the grates. Normal for a gas range.' } },
        why: 'Worn knob markings and heat-tinted grates come from years of normal cooking. Wear and tear.' },
      { cat: 2, cost: 160, desc: 'The front-left knob is a melted lump and the oven door glass is cracked.', key: ['melt', 'glass'],
        resp: { knobs: { look: { t: 'Melted plastic. Something was left sitting on a hot burner.', clue: 'melt' }, touch: { t: 'The knob is fused, but it still clicks off.', clue: 'melt' } }, oven: { look: { t: 'The inner glass has a long crack. Something hit it hard.', clue: 'glass' }, tape: { t: 'The crack runs about 10 inches.', clue: 'glass' } }, burners: { smell: 'Old burnt plastic. No gas.' } },
        why: 'A melted knob and cracked oven glass come from misuse, not age. Tenant damage: replace both and charge the deposit.' },
      { cat: 3, desc: 'Looks fine at a glance.', key: ['gas', 'knob'],
        resp: { burners: { smell: { t: "Rotten eggs! That's mercaptan, the gas odorant. A burner valve is leaking.", clue: 'gas', sfx: 'hiss' }, look: 'Clean grates. Nothing looks wrong.', flashlight: "Nothing to see. Gas leaks don't show up in pictures." }, knobs: { touch: { t: 'The back-right knob spins freely. It never clicks to OFF.', clue: 'knob' } } },
        why: 'A gas smell means a leak, the most urgent hazard there is. Shut off the gas, open the windows and file an emergency work order.' }
    ] },
  { id: 'counter', room: 'kitchen', name: 'Countertop', art: 'counter',
    hint: 'Touch tells you whether a mark is on the surface or goes deeper.',
    parts: [{ id: 'backsplash', name: 'backsplash', r: [0, 0, 240, 34] }, { id: 'edge', name: 'front edge', r: [0, 98, 240, 22] }, { id: 'surface', name: 'countertop surface', r: [0, 34, 240, 64] }],
    base: { backsplash: { look: 'Four-inch laminate backsplash. Peak 2006.', touch: 'Solid.' }, edge: { look: 'A rounded bullnose edge.', touch: 'Smooth.' } },
    variants: [
      { cat: 0, desc: 'Faux-granite laminate countertop. Wiped clean.', key: ['clean'],
        resp: { surface: { touch: { t: 'Smooth. No residue, no chips.', clue: 'clean' }, flashlight: { t: 'Raking light shows no scratches worth noting.', clue: 'clean' } } },
        why: 'Clean and intact. Nothing to do.' },
      { cat: 1, desc: 'Faint knife scratches and a dull, worn spot near the stove.', key: ['dull'],
        resp: { surface: { look: { t: 'Fine scratches and a dull patch where everyone chops.', clue: 'dull' }, touch: { t: "Surface scratches only. The laminate's intact.", clue: 'dull' } } },
        why: 'Fine scratches and a dull work area are what years of cooking do to laminate. Wear and tear.' },
      { cat: 2, cost: 400, desc: 'A big scorched ring where someone set down a hot pan.', key: ['scorch'],
        resp: { surface: { look: 'A brown ring with a bubbled, lifting middle.', touch: { t: 'Bubbled and soft. The laminate has come loose from the board underneath.', clue: 'scorch' }, tape: { t: 'The ring is about 8 inches across.', clue: 'scorch' }, smell: 'Faint burnt glue.' } },
        why: "A scorched, bubbled ring from a hot pan is damage. Laminate can't be repaired in place, so the section is replaced and charged." },
      { cat: 2, cost: 260, desc: 'Something is off about the front edge.', key: ['chip'],
        resp: { edge: { look: { t: 'A 3-inch chunk is missing from the bullnose. Particle board shows through.', clue: 'chip' }, touch: { t: 'A sharp edge, with particle board exposed.', clue: 'chip' }, tape: { t: 'The missing chunk is about 3 inches long.', clue: 'chip' } } },
        why: 'A broken-off edge is impact damage, not wear. Chargeable.' }
    ] },
  /* ---------------- BATHROOM ---------------- */
  { id: 'mirror', room: 'bath', name: 'Mirror & Vanity Light', art: 'mirror',
    hint: 'Check the light bar too, not just the glass.',
    parts: [{ id: 'lightbar', name: 'vanity light bar', r: [40, 0, 160, 18] }, { id: 'edge', name: 'bottom edge of the mirror', r: [50, 98, 140, 20] }, { id: 'glass', name: 'mirror glass', r: [50, 20, 140, 78] }],
    base: { glass: { talk: "Mirror, mirror... nope. Doesn't work on these." }, lightbar: { look: 'A brushed-nickel bar with four globe bulbs.' } },
    variants: [
      { cat: 0, desc: 'A frameless mirror under a four-bulb vanity light.', key: ['ok'],
        resp: { glass: { look: { t: 'You look tired. The mirror looks great.', clue: 'ok' }, touch: { t: 'Smooth and streak-free.', clue: 'ok' } }, lightbar: { touch: { t: 'You flip the switch. All four bulbs come on steady.', clue: 'ok', sfx: 'light' } } },
        why: 'Clean glass and a working light. Nothing to do.' },
      { cat: 1, desc: "The mirror's edges are going dark and blotchy.", key: ['silver'],
        resp: { edge: { look: { t: 'Black blotches creep along the bottom edge. The silver backing is aging.', clue: 'silver' }, touch: 'Smooth. The blotches are behind the glass.', flashlight: { t: 'The blotches are under the glass, in the silver layer. Years of steam.', clue: 'silver' } }, lightbar: { touch: { t: 'All four bulbs light up steady.', sfx: 'light' } } },
        why: "Desilvering at the edges is the mirror's backing aging from years of bathroom steam. Normal wear." },
      { cat: 2, cost: 90, desc: 'Someone scratched a smiley face into the glass.', key: ['key'],
        resp: { glass: { look: 'A big scratched smiley grins back at you.', touch: { t: 'You can feel the grooves. That was gouged in on purpose.', clue: 'key' }, flashlight: { t: "The light catches deep, deliberate scratches. That won't buff out.", clue: 'key' } }, lightbar: { touch: { t: 'The light works fine.', sfx: 'light' } } },
        why: 'Deliberate scratches in the glass are vandalism. The mirror is replaced and charged to the deposit.' },
      { cat: 3, desc: 'The vanity light flickers and buzzes.', key: ['spark', 'burn'],
        resp: { lightbar: { look: { t: 'One socket is scorched brown. A tiny spark jumps when it flickers.', clue: 'spark' }, smell: { t: 'Burning plastic and ozone.', clue: 'burn', sfx: 'buzz' }, touch: 'Not without the breaker off. You value your eyebrows.', screwdriver: "Absolutely not while it's live." }, glass: { look: "The mirror's fine. The light above it is not." } },
        why: 'A scorched, sparking fixture is a fire and shock hazard. Kill the breaker and file an emergency work order.' }
    ] },
  { id: 'tub', room: 'bath', name: 'Tub & Tile', art: 'tub',
    hint: 'Tap tile with your hammer. Solid is good. Hollow and mushy is bad.',
    parts: [{ id: 'caulk', name: 'caulk line', r: [0, 86, 240, 14] }, { id: 'tiles', name: 'wall tile', r: [0, 0, 240, 86] }, { id: 'tub', name: 'tub', r: [0, 100, 240, 35] }],
    base: { tub: { look: 'A white fiberglass tub.', touch: 'Smooth. Not even a ring.' }, tiles: { look: 'Glossy white tile.' } },
    variants: [
      { cat: 0, desc: "White tile over a fiberglass tub. The grout's clean.", key: ['solid'],
        resp: { tiles: { hammer: { t: 'Tap, tap. Solid all over.', clue: 'solid', sfx: 'thud' }, touch: 'Firm.' }, caulk: { touch: { t: 'Fresh, flexible caulk.', clue: 'solid' } } },
        why: 'Solid tile, fresh caulk. Nothing to do.' },
      { cat: 1, desc: 'The caulk along the tub is yellowed and cracking.', key: ['caulk'],
        resp: { caulk: { look: { t: "Yellowed, hairline-cracked caulk. It's old.", clue: 'caulk' }, touch: { t: 'Stiff and brittle, but still sealed. No soft spots.', clue: 'caulk' } }, tiles: { hammer: { t: 'Solid behind the tile.', sfx: 'thud' } } },
        why: 'Caulk is a consumable. Yellowing and cracking after years of showers is normal wear; re-caulk at turnover.' },
      { cat: 2, cost: 150, desc: 'Two tiles are cracked in a star pattern, as if something heavy hit them.', key: ['impact'],
        resp: { tiles: { look: 'Star-shaped cracks spreading from one spot on each tile.', hammer: { t: 'Solid behind them. The cracks are surface impact, not water.', clue: 'impact', sfx: 'thud' }, touch: { t: 'Sharp edges at the impact points.', clue: 'impact' } } },
        why: "Star cracks from a single impact point mean something hit the tile. It's solid behind, so it's tenant damage, not a leak." },
      { cat: 3, desc: 'The grout along the bottom rows has gone dark.', key: ['rot', 'soft', 'musty'],
        resp: { tiles: { hammer: { t: 'Hollow, mushy thuds near the bottom. The backer board is rotting.', clue: 'rot', sfx: 'thud' }, touch: { t: 'A tile flexes when you push it. Soft behind.', clue: 'soft' }, smell: { t: 'Musty. Damp wood.', clue: 'musty' } }, caulk: { look: 'Dark grout and gaps in the caulk line.' } },
        why: 'Soft, hollow-sounding tile means water is getting into the wall and rotting it. Left alone, that means mold and structural damage. Hazard.' }
    ] },
  { id: 'toilet', room: 'bath', name: 'Toilet', art: 'toilet',
    hint: 'Flush it, and check the base.',
    parts: [{ id: 'handle', name: 'flush handle', r: [66, 16, 18, 12] }, { id: 'lid', name: 'tank lid', r: [64, 0, 112, 12] }, { id: 'tank', name: 'tank', r: [70, 12, 100, 36] }, { id: 'base', name: 'base', r: [64, 100, 112, 35] }, { id: 'bowl', name: 'bowl', r: [74, 48, 92, 52] }],
    base: { bowl: { look: 'Clean water. Mercifully.', touch: "You're a professional, but not THAT professional." }, lid: { look: 'A white porcelain tank lid.' } },
    variants: [
      { cat: 0, desc: 'A white two-piece toilet. Clean and quiet.', key: ['flush'],
        resp: { handle: { touch: { t: 'Whoosh. It refills and shuts off. Perfect.', clue: 'flush', sfx: 'flush' } }, base: { touch: { t: 'Rock solid on the floor.', clue: 'flush' } } },
        why: 'It flushes, refills and is solid on the floor. Nothing to do.' },
      { cat: 1, desc: 'A white toilet that keeps hissing faintly.', key: ['flapper'],
        resp: { handle: { touch: { t: "It flushes, then hisses for ages. The flapper's worn out.", clue: 'flapper', sfx: 'flush' } }, tank: { look: { t: 'Under the lid: the rubber flapper is warped and old.', clue: 'flapper' }, touch: { t: 'You lift the lid. The flapper is stiff, warped rubber.', clue: 'flapper' } }, base: { touch: 'Solid. No leaks.' } },
        why: "A worn rubber flapper is a part that wears out on its own. Swap it at turnover; that's normal wear." },
      { cat: 2, cost: 75, desc: 'The tank lid is cracked clean through.', key: ['crack'],
        resp: { lid: { look: { t: 'A crack runs straight across the lid. Dropped, probably.', clue: 'crack' }, touch: { t: 'The two halves shift against each other.', clue: 'crack' } }, handle: { touch: { t: 'It flushes fine.', sfx: 'flush' } } },
        why: "A cracked tank lid is breakage. Porcelain doesn't crack from age. Tenant damage." },
      { cat: 3, desc: "There's a dark ring on the floor around the base.", key: ['rock', 'sewer', 'flange'],
        resp: { base: { touch: { t: 'The whole toilet rocks. Water seeps out from under it.', clue: 'rock' }, smell: { t: 'Sewer gas. The wax seal has failed.', clue: 'sewer' }, flashlight: { t: "The vinyl around the base is dark and soft. It's been leaking a while.", clue: 'flange' } }, handle: { touch: { t: 'It flushes, and a little water seeps out at the base.', clue: 'rock', sfx: 'flush' } } },
        why: 'A rocking toilet leaking at the base is a sanitation and subfloor hazard. Emergency work order.' }
    ] },
  { id: 'outlet', room: 'bath', name: 'GFCI Outlet', art: 'outlet',
    hint: 'Push the TEST button on GFCI outlets. And sniff around them.',
    parts: [{ id: 'test', name: 'TEST button', r: [98, 52, 44, 14] }, { id: 'reset', name: 'RESET button', r: [98, 68, 44, 14] }, { id: 'plate', name: 'cover plate', r: [64, 6, 112, 124] }],
    base: { reset: { touch: { t: 'Click. Nothing to reset.', sfx: 'click' } }, plate: { look: 'A GFCI outlet in a standard plate.' } },
    variants: [
      { cat: 0, desc: 'A GFCI outlet by the sink.', key: ['trip'],
        resp: { test: { touch: { t: 'Click. The power cuts. You press RESET and it comes back. Working.', clue: 'trip', sfx: 'click' } }, plate: { touch: 'Cool to the touch.', smell: 'Nothing. Good.' } },
        why: 'It trips and resets properly. Nothing to do.' },
      { cat: 3, desc: 'Brown scorch marks surround the plug slots.', key: ['warm', 'melt', 'burn'],
        resp: { plate: { touch: { t: 'Warm. You hear a faint buzz from inside the box.', clue: 'warm', sfx: 'buzz' }, smell: { t: 'Burnt plastic.', clue: 'burn' }, screwdriver: [{ if: 'open', t: 'The plate is already off.' }, { t: 'You flip the breaker and pull the plate: melted wire insulation behind it.', clue: 'melt', sfx: 'unscrew', set: 'open' }] }, test: { touch: { t: "It won't trip. The GFCI isn't protecting anything.", clue: 'warm', sfx: 'click' } } },
        why: "Heat, buzzing and scorch marks mean the wiring is failing. It's a fire hazard: shut off the breaker and file an emergency work order." },
      { cat: 2, cost: 15, desc: 'The cover plate is cracked, with a chunk missing.', key: ['plate'],
        resp: { plate: { look: { t: 'A corner of the plate is snapped off. Probably a vacuum cord.', clue: 'plate' }, touch: { t: 'Cool. Only the plastic is broken.', clue: 'plate' } }, test: { touch: { t: "Click, it trips. Reset, and it works. Only the plate's broken.", clue: 'plate', sfx: 'click' } } },
        why: "A broken cover plate is minor tenant damage. The outlet itself tests fine, so it isn't a hazard. Replace the plate." },
      { cat: 1, desc: 'The cover plate has yellowed with age.', key: ['yellow'],
        resp: { plate: { look: { t: 'Old-almond yellow. It used to be white.', clue: 'yellow' }, touch: 'Cool to the touch.' }, test: { touch: { t: 'Click, it trips. Reset, and it works.', clue: 'yellow', sfx: 'click' } } },
        why: 'Plastic yellowing with age is normal wear. It works and tests fine.' }
    ] },
  /* ---------------- BEDROOM ---------------- */
  { id: 'smoke', room: 'bedroom', name: 'Smoke Detector', art: 'smoke',
    hint: "Push the test button. If it's dead, find out why.",
    parts: [{ id: 'button', name: 'test button', r: [104, 54, 32, 26] }, { id: 'led', name: 'indicator light', r: [148, 38, 18, 14] }, { id: 'cover', name: 'detector cover', r: [44, 16, 152, 100] }],
    base: { cover: { look: 'A round ceiling smoke detector.' }, led: { look: 'A tiny indicator light.' } },
    variants: [
      { cat: 0, desc: 'A ceiling smoke detector. The little green light blinks.', key: ['beep'],
        resp: { button: { touch: { t: 'BEEEP BEEEP BEEEP. Loud and proud.', clue: 'beep', sfx: 'beep' } }, led: { look: 'Blinking green. Powered.' } },
        why: 'It powers up and the alarm sounds. Nothing to do.' },
      { cat: 1, desc: "The detector's plastic has yellowed with age.", key: ['old'],
        resp: { cover: { look: { t: 'Yellowed plastic. The sticker says it was made in 2001.', clue: 'old' } }, button: { touch: { t: 'BEEEP. Still works.', clue: 'old', sfx: 'beep' } }, led: { look: 'Blinking green.' } },
        why: 'Yellowed plastic on a detector that still tests fine is age. Normal wear (though it should be replaced soon).' },
      { cat: 2, cost: 35, desc: 'The cover is cracked and dented, like someone jabbed it with a broom handle.', key: ['dent'],
        resp: { cover: { look: { t: 'A crushed dent and a crack across the cover.', clue: 'dent' }, touch: { t: "The cover's broken, but it's still mounted firmly.", clue: 'dent' } }, button: { touch: { t: 'BEEEP. It still sounds. Only the cover is broken.', clue: 'dent', sfx: 'beep' } }, led: { look: 'Blinking green.' } },
        why: "The cover was broken by an impact, but the alarm still works. Replace the unit and charge the deposit; it isn't disabled." },
      { cat: 3, desc: 'There is no light on the detector at all.', key: ['dead', 'battery'],
        resp: { led: { look: { t: 'Dark. No power light.', clue: 'dead' } }, button: { touch: { t: 'Nothing. Silence.', clue: 'dead' } }, cover: { screwdriver: [{ if: 'open', t: "It's already open." }, { t: "You twist it off the base. The battery's gone and the power lead is unplugged.", clue: 'battery', set: 'open', sfx: 'unscrew' }], touch: [{ if: 'open', t: 'Empty battery slot. Unplugged lead.' }, { t: 'It twists a little on its base.' }] } },
        why: 'A disabled smoke alarm is a life-safety hazard, whoever disabled it. Restore it and file an emergency work order before anyone moves in.' }
    ] },
  { id: 'closet', room: 'bedroom', name: 'Closet Doors', art: 'closet',
    hint: 'Work the doors. Then look at the track.',
    parts: [{ id: 'knob', name: 'knob', r: [150, 58, 18, 18] }, { id: 'track', name: 'top track', r: [16, 0, 208, 12] }, { id: 'panel', name: 'door panel', r: [20, 12, 200, 123] }],
    base: { panel: { look: 'White louvered bifold doors.' }, knob: { look: 'A brass knob.' } },
    variants: [
      { cat: 0, desc: 'White bifold closet doors.', key: ['glide'],
        resp: { knob: { touch: { t: 'The doors fold open smoothly and close flush.', clue: 'glide', sfx: 'click' } }, track: { look: { t: 'A straight, clean track.', clue: 'glide' } } },
        why: 'Smooth, straight and intact. Nothing to do.' },
      { cat: 1, desc: 'The bifold doors sag and drag at the bottom.', key: ['roller'],
        resp: { knob: { touch: { t: 'It drags, scrapes and catches. The rollers are worn smooth.', clue: 'roller', sfx: 'creak' } }, track: { look: { t: 'Worn plastic rollers and a dirty track. Years of use.', clue: 'roller' } }, panel: { screwdriver: { t: 'You snug the pivot. It helps a bit, but the rollers need replacing.', sfx: 'unscrew' } } },
        why: 'Worn rollers and a sagging bifold come from years of opening and closing. Normal wear.' },
      { cat: 2, cost: 120, desc: 'Something has happened to one of the door panels.', key: ['hole'],
        resp: { panel: { look: "A fist-sized hole with splintered edges. Hollow-core doors don't stand a chance.", tape: { t: 'About 5 inches across.', clue: 'hole' }, touch: { t: 'Splintered veneer, with cardboard honeycomb inside.', clue: 'hole' }, flashlight: { t: 'Through the hole: the empty honeycomb core.', clue: 'hole' } }, knob: { touch: { t: 'The doors still fold fine.', sfx: 'click' } } },
        why: 'A hole punched through a door is damage. Hollow-core doors get replaced, not patched. Chargeable.' }
    ] },
  { id: 'window', room: 'bedroom', name: 'Window', art: 'window',
    hint: 'Check both sides of the glass, and the sill.',
    parts: [{ id: 'latch', name: 'latch', r: [108, 92, 24, 12] }, { id: 'sill', name: 'windowsill', r: [24, 104, 192, 31] }, { id: 'glass', name: 'glass', r: [36, 6, 168, 86] }],
    base: { latch: { touch: { t: 'The latch locks firmly.', sfx: 'click' } }, glass: { talk: 'The tree outside waves. You wave back.' }, sill: { look: 'A white vinyl sill.' } },
    variants: [
      { cat: 0, desc: 'A vinyl double-hung window looking out on an oak tree.', key: ['clear'],
        resp: { glass: { look: { t: 'Crystal clear. The tree outside is doing its swaying thing.', clue: 'clear' } }, sill: { touch: { t: 'Dry and clean.', clue: 'clear' } } },
        why: 'Clear glass, dry sill, working latch. Nothing to do.' },
      { cat: 1, desc: "The glass is foggy and it won't wipe off.", key: ['seal'],
        resp: { glass: { touch: { t: 'Both sides of the glass are dry. The fog is BETWEEN the panes; the seal failed with age.', clue: 'seal' }, look: 'A milky haze across the glass.', flashlight: { t: 'The haze is trapped inside the double pane.', clue: 'seal' } }, sill: { touch: 'Dry.' } },
        why: "Fog trapped between the panes means the factory seal failed over time. It's age, not anything the tenant did." },
      { cat: 2, cost: 260, desc: 'A spiderweb crack spreads across the lower pane.', key: ['impact'],
        resp: { glass: { look: { t: 'The cracks all spread from one point. Something hit it from inside.', clue: 'impact' }, touch: { t: "The outer pane's smooth; the inner pane cracked from an impact.", clue: 'impact' }, tape: { t: 'The crack spans about 14 inches.', clue: 'impact' } }, sill: { touch: 'Dry.' } },
        why: 'A spiderweb crack from a single impact point is accidental damage, not age. Glass replacement is charged.' },
      { cat: 3, desc: 'Black spots speckle the windowsill.', key: ['mold', 'wet'],
        resp: { sill: { look: 'Black and green speckles spreading along the sill and the bottom of the frame.', smell: { t: "Musty and sour. That's mold.", clue: 'mold' }, touch: { t: "Wet. The sill's saturated; the frame is leaking.", clue: 'wet' }, flashlight: { t: 'Water stains run down the drywall under the sill.', clue: 'wet' } } },
        why: 'Active moisture and mold growth are a health hazard and a sign of a leak. Emergency work order and remediation.' }
    ] },
  { id: 'bwall', room: 'bedroom', name: 'Bedroom Wall', art: 'bwall',
    hint: "With marks on a wall, the question is: does it wipe off?",
    parts: [{ id: 'base', name: 'baseboard', r: [0, 108, 240, 27] }, { id: 'wall', name: 'wall', r: [0, 0, 240, 108] }],
    base: { base: { look: 'White baseboard. A little dusty.', touch: 'Solid.' } },
    variants: [
      { cat: 0, desc: 'A plain beige bedroom wall.', key: ['clean'],
        resp: { wall: { touch: { t: 'Smooth. Not a scuff.', clue: 'clean' }, flashlight: { t: 'No marks, even in raking light.', clue: 'clean' } } },
        why: 'Clean paint. Nothing to do.' },
      { cat: 1, desc: 'Light grey scuffs where a headboard used to rub.', key: ['scuff'],
        resp: { wall: { look: 'Faint grey scuffs at headboard height.', touch: { t: 'They partly wipe off with your thumb. Surface scuffs.', clue: 'scuff' }, tape: { t: 'The scuffs are about 40 inches up, right at headboard height.', clue: 'scuff' } } },
        why: 'Light scuffs from furniture rubbing are what everyday living does to paint. Normal wear; touch up at turnover.' },
      { cat: 2, cost: 140, desc: 'A giant purple dinosaur has been drawn on the wall in marker.', key: ['marker'],
        resp: { wall: { look: "A purple dinosaur, signed 'KAYDEN, AGE 5'. Honestly, not bad.", touch: { t: "It doesn't smudge at all. Permanent marker.", clue: 'marker' }, smell: { t: 'Faint marker fumes.', clue: 'marker' }, tape: 'About 3 feet tall. Kayden had ambitions.' } },
        why: 'Permanent marker on a wall needs primer and paint. That goes beyond normal use, so it gets charged.' }
    ] }
];
const FEATURE = {}; for (const f of FEATURES) FEATURE[f.id] = f;

/* Fallback lines for verbs/tools with nothing specific to say. */
const GENERIC = {
  walk: () => "You're already up close.",
  look: p => `Nothing unusual about the ${p}.`,
  touch: p => pick([`Nothing unusual about the ${p} to the touch.`, `The ${p} feels like... a ${p}.`]),
  smell: () => pick(['Nothing but stale apartment air.', 'Your nose finds nothing interesting.', 'Smells like drywall dust and somebody else\'s life.']),
  talk: p => pick([`You ask the ${p} how it's holding up. No comment.`, `The ${p} has nothing to say. Dana pretends not to notice.`]),
  tape: () => 'Nothing worth measuring there.',
  flashlight: () => 'Nothing new in the light.',
  screwdriver: () => 'Nothing to unscrew there.',
  hammer: () => "You'd rather not hit that.",
  pencil: () => 'You doodle a tiny house in the margin instead.'
};

/* Deal out this shift's conditions, making sure there's a healthy mix of every category. */
function dealConditions() {
  for (let tries = 0; tries < 400; tries++) {
    const pickN = {}, n = [0, 0, 0, 0];
    for (const f of FEATURES) { const i = Math.floor(Math.random() * f.variants.length); pickN[f.id] = i; n[f.variants[i].cat]++; }
    if (n[0] >= 2 && n[1] >= 3 && n[2] >= 3 && n[3] >= 2 && n[3] <= 4) return pickN;
  }
  const out = {}; for (const f of FEATURES) out[f.id] = 0; return out;
}
