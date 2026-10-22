/* ============================================================================
 *  build_parking.js — authors the FIRST tutorial map: the PARKING LOT.
 *  Emits three paired files into maps/tutorial/ (same convention as
 *  maps/debug_room.*):
 *    parking_lot.data.json  — raw buildData (engine fetch fallback)
 *    parking_lot.data.js    — window.__MAPDATA_parking_lot = {...} (file:// safe)
 *    parking_lot.html       — <script id='map-data'> wrapper you OPEN IN MAPSTER
 *
 *  Now it actually LOOKS like a lot: an OPEN south lot (no surrounding walls —
 *  the map edge bounds you), rows of OTHER parked cars, painted stall lines, your
 *  car among them, then the mall building to the north (glass entrance → lobby →
 *  LOCKED theater doors needing 'MultiplexKey', which lives inside your car).
 *
 *  EDIT: open parking_lot.html in Mapster, or tweak the numbers here + re-run
 *  `node tools/build_parking.js` from the project root.
 * ========================================================================== */
const fs = require('fs');
const W = 13, H = 16;
const KEY_ID = 'MultiplexKey';

const emptyCell = () => ({ f: null, o: null, c: null, n: null, s: null, e: null, w: null, d1: null, d2: null });
const pavement  = () => ({ n: 'pavement', v: 'pavement', c: '#5f6469', ac: '#54585c', meta: { outdoor: true } });
const stallLine = () => ({ n: 'pavement', v: 'pavement', c: '#c9ad5f', ac: '#c9ad5f', meta: { outdoor: true } });   // painted stall stripe
const terrazzo  = () => ({ n: 'terrazzo', v: 'terrazzo', c: '#efece4', ac: '#666', meta: {} });
const marble    = () => ({ n: 'marble',   v: 'marble',   c: '#eef0f2', ac: '#666', meta: {} });
const solidWall = () => ({ n: 'solid', v: 'solid', c: '#233240', meta: { solid: true } });
const glassDoor = () => ({ n: 'door_slide', v: 'door_slide', c: '#0ea5e9', meta: { locked: false, dir: 0, hp: 0 } });
const lockedDoor= () => ({ n: 'door_swing', v: 'door_swing', c: '#7c2d12', meta: { locked: true, reqKey: KEY_ID, dir: 0, hp: 0 } });
const startObj  = () => ({ n: 'start', v: 'start', c: '#f43f5e', s: '\u2b50', meta: {} });
const myCar     = (dir) => ({ n: 'car', v: 'car', c: '#3b5ba5', s: '\ud83d\ude97', meta: { solid: true, jumpable: false, carDir: dir || 'n', keyId: KEY_ID, keyLabel: 'multiplex key', sparkle: true, sparkleY: 1.15, sparkleColor: '#fff6a8' } });   // glint on the roof = "this one's yours" (removed once you take the key)
const otherCar  = (dir, col) => ({ n: 'car', v: 'car', c: col, s: '\ud83d\ude97', meta: { solid: true, jumpable: false, carDir: dir || 'n' } });

const grid = Array.from({ length: H }, () => Array.from({ length: W }, emptyCell));
// floors: theater(1) | lobby(2-5) | OPEN LOT(6-15). z0 is the building's back wall row.
for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
  if (z >= 6) grid[z][x].f = pavement();
  else if (z === 1) grid[z][x].f = marble();
  else grid[z][x].f = terrazzo();
}

// ── THE MALL BUILDING (north, z=0..5). Walls only here — the LOT is OPEN. ──
for (let x = 0; x < W; x++) grid[0][x].n = solidWall();                 // building back wall
for (let z = 0; z <= 5; z++) { grid[z][0].w = solidWall(); grid[z][W - 1].e = solidWall(); }  // building side walls
// mall EXTERIOR wall between lobby (z=5) and lot (z=6): on z=6 north edges, GLASS door at x=6
for (let x = 0; x < W; x++) grid[6][x].n = (x === 6) ? glassDoor() : solidWall();
// LOCKED theater doors between lobby (z=2) and theater (z=1): on z=2 north edges, door at x=6
for (let x = 0; x < W; x++) grid[2][x].n = (x === 6) ? lockedDoor() : solidWall();
// (The lot's south / east / west have NO walls — you can roam the open lot; the
//  map edge stops you. That's what makes it read as outdoors, not a room.)

// ── PAINTED STALL LINES (thin gold stripes marking parking bays) ──
[9, 12].forEach(zr => { for (let x = 1; x <= 11; x += 2) grid[zr][x].f = stallLine(); });

// ── PARKED CARS: two rows flanking a central aisle (x=6). ──
const cols = ['#8a2f2f', '#2f6d4f', '#b8862f', '#3f3f52', '#6d3f6d', '#8c8f94'];   // no blue: YOUR car (#3b5ba5) is the only blue one in the lot
let ci = 0;
[2, 4, 8, 10].forEach(x => { grid[9][x].o  = otherCar('s', cols[ci++ % cols.length]); });   // top row faces the aisle (south)
[2, 4, 8, 10].forEach(x => { grid[12][x].o = otherCar('n', cols[ci++ % cols.length]); });   // bottom row faces north
grid[12][5].o = myCar('s');                    // YOUR car, parked in a bay, facing the lot exit (key is inside)
grid[13][6].o = startObj();                    // you start in the aisle, beside your car
// #4: exit waypoint on the tile just SOUTH of the theater doors — crossing the
// (unlocked) door north fires engineOnExitReached, ending the parking-lot lesson
// and handing off to the tutorial choice.
grid[2][6].o = { n: 'exit_sign', v: 'exit_sign', c: '#d11f1f', s: '\ud83d\udeaa', meta: { solid: false, name: 'Into the theater', exitWaypoint: true, text: 'You step inside\u2026' } };

const buildData = {
  map: [grid],
  name: 'parking_lot',
  settings: {
    bgMode: 'night', allowEmptyWalk: false, camMode: 'fps_toggle', fpsStartView: 'third',
    fpsZoomDist: 6, startZoomDist: 6, zoomMode: 'incremental', tiltEnabled: true,
    ambUrl: '', bgmUrl: '', edgeWarpUrl: '', edgeBehavior: 'block', edgeWarpX: 0, edgeWarpY: 0,
    minimapMode: 'toggle', compassMode: 'on', textPosition: 'bottom', flashlight: true,
    allowWindowDraw: false, showVisionCones: false, camN: true, camE: true, camS: true, camW: true,
    minimapCorner: 'tl', disableLocations: false, zoneDisplay: 'off', fogDisplay: 'off',
    fogDiscoverable: false, flashlightMinimap: 'off', flashlightRevealSize: 4, zoneDefs: [], movementMode: 'camera'
  },
  fogSettings: [{ enabled: false, color: '#0a0e18', density: 20, outdoor: true, weather: 'none', weatherInt: 50 }],
  start: { x: 6, z: 13, f: 0 }
};

const json = JSON.stringify(buildData);
const dir = 'maps/tutorial';
fs.writeFileSync(dir + '/parking_lot.data.json', json);
fs.writeFileSync(dir + '/parking_lot.data.js', 'window.__MAPDATA_parking_lot = ' + json + ';\n');
fs.writeFileSync(dir + '/parking_lot.html',
  '<!doctype html><html><head><meta charset="utf-8"><title>parking_lot (Mapster map)</title></head><body>\n' +
  '<!-- Editable tutorial map. Open THIS file in Mapster via "Load Project" to edit. -->\n' +
  '<script type="application/json" id=\'map-data\'>' + json.replace(/</g, '\\u003c') + '</' + 'script>\n</body></html>\n');
let cars = 0; grid.forEach(r => r.forEach(c => { if (c.o && c.o.v === 'car') cars++; }));
console.log('wrote parking_lot.* (' + W + 'x' + H + '), cars=' + cars + ', open lot, stall lines, no blocking sign');
