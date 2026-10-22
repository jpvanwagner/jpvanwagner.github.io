/* #19: Build the Mapster-authored DEBUG ROOM as a standalone exported map.
 *
 * Rather than hand-write fragile JSON, this constructs the map using the SAME
 * cell schema Mapster uses, then runs it through Mapster's export template so
 * the output is byte-for-byte a normal Mapster export — guaranteed loadable by
 * the engine and re-openable in Mapster.
 *
 * The template is a copy kept in tools/map_export_template.txt (Mapster itself
 * no longer lives in this project). It's the text of Mapster's
 * <script id="export-template"> block; if Mapster's exporter changes, paste
 * the new block's contents over that file.
 *
 * Run: node tools/build_debug_room.js
 * Out: maps/debug_room.html (+ debug_room.data.json, debug_room.data.js)
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const W = 20, H = 22, FLOORS = 1;
// #16: rows z >= OUTDOOR_Z are an OUTDOOR patio you can walk into to test
// weather/time/fog. The indoor room is z < OUTDOOR_Z.
const OUTDOOR_Z = 15;

const emptyCell = () => ({ f: null, o: null, c: null, n: null, s: null, e: null, w: null, d1: null, d2: null });
const grid = () => Array.from({ length: H }, () => Array.from({ length: W }, emptyCell));
const map = Array.from({ length: FLOORS }, grid);

// ---- helpers ---------------------------------------------------------------
const floor = (x, z, v, c, ac, meta) => { map[0][z][x].f = { n: v, v, c, ac: ac || null, meta: meta || {} }; };
const obj   = (x, z, v, c, s, meta) => { map[0][z][x].o = { n: v, v, c, s: s || '', meta: meta || {} }; };
const edge  = (x, z, dir, v, c, meta) => { map[0][z][x][dir] = { n: v, v, c, meta: meta || {} }; };

// Floor everywhere (a couple of patterns so #3 textures are visible).
for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
  let v = 'concrete', c = '#9aa0a6';
  if (z >= OUTDOOR_Z)  { v = 'pavement'; c = '#777c82'; }          // #16: outdoor patio
  else if (z < 4)            { v = 'tile';     c = '#d8d8d8'; }          // entry checker
  else if (z >= 4 && z < 8 && x < 8) { v = 'marble';  c = '#eef0f2'; } // marble quadrant
  else if (z >= 8 && x >= 8)         { v = 'carpet';  c = '#0a0a12'; } // arcade carpet
  else if (z >= 8 && x < 8)          { v = 'terrazzo';c = '#efece4'; }
  const fmeta = (v === 'carpet') ? { arcadeStyle: 'cosmic' } : {};
  if (z >= OUTDOOR_Z) fmeta.outdoor = true;                            // #16: mark outdoor cells
  floor(x, z, v, c, '#666', fmeta);
  // #12: indoor cells (z < OUTDOOR_Z) get a ceiling so the engine flags them as
  // indoors; the outdoor patio stays open to the sky.
  if (z < OUTDOOR_Z) map[0][z][x].c = { n: 'ceiling', v: 'ceiling', c: '#1a1d24', meta: {} };
}

// Perimeter solid walls.
for (let x = 0; x < W; x++) { edge(x, 0, 'n', 'solid', '#0891b2', { solid: true }); edge(x, H - 1, 's', 'solid', '#0891b2', { solid: true }); }
for (let z = 0; z < H; z++) { edge(0, z, 'w', 'solid', '#0891b2', { solid: true }); edge(W - 1, z, 'e', 'solid', '#0891b2', { solid: true }); }

// ---- ALL DOOR TYPES along an interior wall (row z=4) -----------------------
// Internal wall across the room at z=4 with a gap of doors.
for (let x = 1; x < W - 1; x++) edge(x, 4, 'n', 'solid', '#475569', { solid: true });
// Swing door (plain).
edge(2, 4, 'n', 'door_swing', '#78350f', { locked: false, dir: 0, hp: 0 });
// Swing door WITH a light gap (#7).
edge(4, 4, 'n', 'door_swing', '#78350f', { locked: false, dir: 0, hp: 0, lightGap: true });
// Locked swing door (needs MasterKey).
edge(6, 4, 'n', 'door_swing', '#7c2d12', { locked: true, reqKey: 'MasterKey', dir: 0, hp: 0 });
// Slide door.
edge(8, 4, 'n', 'door_slide', '#0ea5e9', { locked: false, dir: 0, hp: 0 });
// Archway (open passage).
edge(10, 4, 'n', 'arch', '#6366f1', { solid: false });
// (Counters were moved OUT of this door-test wall — see the concession counter
// below — so this wall only demonstrates DOOR types.)

// ---- SMASHABLE WINDOWS on the east interior section ------------------------
// A run of breakable glass on row z=9 (interior). The first two break freely
// (breakReqType 'none') so the smash mechanic is always testable; the rest use
// a LOW brawn gate so they break with a typical character.
for (let x = 2; x <= 6; x++) {
  const free = (x <= 3);
  edge(x, 9, 'n', 'glass_full', '#bae6fd', {
    solid: true, breakable: true, hp: 1, canvasWidth: 1, paintOpacity: 1.0,
    allowDraw: true,
    breakReqType: free ? 'none' : 'stat', breakReqStat: 'brawn', breakReqValue: 3,
    breakReqHobby: '', borderOn: true, borderColor: '#c0c0c0', blocksLight: false, paintData: null
  });
}
// A window insert (passes light) on the west wall.
edge(1, 6, 'w', 'window_insert', '#0891b2', { solid: true, breakable: false, blocksLight: false, canvasWidth: 1, paintOpacity: 1.0, allowDraw: true, paintData: null });

// ---- LIGHTSWITCHES (wall attachments) + lights -----------------------------
// A wall switch on the south wall that toggles linked lights.
edge(3, H - 1, 's', 'solid', '#334155', {
  solid: true,
  attachments: [{ v: 'switch', offset: 0, offsetY: 0.1, color: '#ffffff', neonText: '00' }],
  linkId: 'main'
});
// Ceiling-ish point lights (objects) linked to 'main'.
obj(4, 6, 'light', '#fff3c0', '💡', { intensity: 1.2, lightColor: '#fff3c0', linkId: 'main', solid: false, flicker: false });
obj(11, 6, 'light', '#cfe8ff', '💡', { intensity: 1.1, lightColor: '#cfe8ff', linkId: 'main', solid: false, flicker: false });
// An uplight puck (always on) so the room isn't pitch black if the switch is off.
obj(8, 11, 'uplight', '#ffffff', '🔦', { intensity: 0.8, lightColor: '#ffffff', linkId: 'always', solid: false });

// Neon text sign (#5) on the north wall of the entry.
edge(8, 0, 'n', 'solid', '#0891b2', {
  solid: true,
  attachments: [{ v: 'neon_text', offset: 0, offsetY: 0.3, color: '#f43f5e', neonText: 'DBG' }]
});
// Neon stripes on the east wall.
edge(W - 1, 10, 'e', 'solid', '#0891b2', {
  solid: true,
  attachments: [{ v: 'neon_stripe', offset: 0, offsetY: 0, color: '#22d3ee', neonText: '00', stripeCount: 3, orientation: 'h' }]
});
// #8: a genuinely reflective MIRROR on the west wall (CubeCamera-backed). Stand
// in front of it to see the reflection. A sign-free spot at z=6.
edge(0, 6, 'w', 'solid', '#334155', {
  solid: true,
  attachments: [{ v: 'mirror_full', offset: 0, offsetY: 0.2, color: '#ffffff' }]
});

// ---- DIRECTORY kiosk -------------------------------------------------------
obj(13, 11, 'dir', '#9333ea', '🗂️', { solid: true });

// ---- CONCESSION COUNTER (#8 FIX) -------------------------------------------
// One coherent service counter (x=10..13 at z=9) instead of stray segments: a
// jumpable test segment, two plain segments, and a lift-up counter-door gate —
// reads as an actual concession stand and tests vaulting AND the counter gate.
// (x=10..13 is clear of the smashable-glass run at x=2..6.)
edge(10, 9, 'n', 'counter', '#b45309', { solid: true, jumpable: true, connects: true, jumpReqType: 'stat', jumpReqStat: 'reflexes', jumpReqValue: 4 });
edge(11, 9, 'n', 'counter', '#b45309', { solid: true, connects: true });
edge(12, 9, 'n', 'counter', '#b45309', { solid: true, connects: true });
edge(13, 9, 'n', 'counter_door', '#b45309', { connects: true, counterDoorStyle: 'lift', dir: 0 });

// ---- WARP POINTS (#17) -----------------------------------------------------
// #18: several clearly-named zones, reachable via the directory's fast-travel.
obj(1, 1, 'warp_point', '#10b981', '📍', { warpPointName: 'Entry Hall', directoryFastTravel: true });
obj(W - 2, H - 2, 'warp_point', '#10b981', '📍', { warpPointName: 'Arcade Corner', directoryFastTravel: true });
obj(1, OUTDOOR_Z + 1, 'warp_point', '#10b981', '📍', { warpPointName: 'Back Patio', directoryFastTravel: true });
obj(13, 6, 'warp_point', '#10b981', '📍', { warpPointName: 'Concession Stand', directoryFastTravel: true });
obj(3, 8, 'warp_point', '#10b981', '📍', { warpPointName: 'Lobby Seating', directoryFastTravel: true });
// A PORTAL that opens the leafblower minigame (#17 example).
obj(2, 12, 'warp_pad', '#a855f7', '🌀', { solid: false, isWarp: true, portalAction: 'minigame', portalMinigame: 'minigames/leafblower_cleanup.html' });
// A PORTAL that warps to the Arcade Corner warp point.
obj(5, 12, 'warp_pad', '#6366f1', '🌀', { solid: false, isWarp: true, portalAction: 'warp', warpMap: '', warpX: W - 2, warpY: H - 2, warpF: 0 });

// ---- SIT SPOTS (#18) -------------------------------------------------------
// Benches + a stool you can sit on (press Space facing them). Sitting is a real
// pose (createHumanoid.setSeated) and a good test of restedness recovery.
obj(2, 8, 'bench', '#8a5a2b', '🪑', { solid: true, sittable: true, rot: 1 });
obj(2, 10, 'bench', '#8a5a2b', '🪑', { solid: true, sittable: true, rot: 1 });
obj(4, 8, 'bench', '#8a5a2b', '🪑', { solid: true, sittable: true, rot: 3 });
obj(W - 3, H - 3, 'arcade_sit', '#22d3ee', '🕹️', { solid: true, sittable: true });

// ---- NPCs with generated sheets (#11) + a patrol NPC (#8) ------------------
// Load the item manifest so NPCs get real stat sheets + clothing.
const itemsCode = fs.readFileSync(path.join(ROOT, 'core', 'items.js'), 'utf8');
const vm = require('vm');
const sb = { window: {}, document: {} }; vm.createContext(sb); vm.runInContext(itemsCode, sb);
const MI = sb.window.GameItems;
function npc(x, z, name, ai, extra) {
  const sheet = MI.generateNpcSheet((x * 131 + z * 17 + name.length) >>> 0);
  obj(x, z, 'npc', '#ffccaa', '🧍', Object.assign({
    name, ai: ai || 'stand', rot: 2, skin: '#ffccaa', cloth: '#3a6ea5',
    dialogue: 'Welcome to the debug room.', dialogueFile: '', reqFacing: false,
    solid: true,                              // #13: NPCs block the player (walk-through is opt-in)
    // #6: NO vision cones in the debug room — only the stealth tutorial uses them.
    stats: sheet.stats, npcAge: sheet.age, npcClique: sheet.clique, worn: sheet.kit.worn, pocket: sheet.kit.pocket
  }, extra || {}));
}
npc(6, 6, 'Leafblower Station', 'stand', { debugAction: 'minigame:minigames/leafblower_cleanup.html', cloth: '#7c3aed', dialogue: 'Interact to launch the leafblower minigame.' });
npc(9, 6, 'Sound & Music Booth', 'stand', { cloth: '#0ea5e9', debugMenu: {
  root: 'start',
  nodes: {
    start: { text: 'Sound & Music test booth. What do you want to hear?', options: [
      { label: 'Sound effects \u00BB', goto: 'sfx' },
      { label: 'Music \u00BB',         goto: 'music' },
      { label: '(leave)', back: true },
    ]},
    sfx: { text: 'Pick a sound — I\'ll play it. (stays open so you can spam them)', options: [
      { label: 'Lightswitch click',   action: 'sound:lightswitch' },
      { label: 'Confirmation click',  action: 'sound:confirmClick' },
      { label: 'Electrical spark',    action: 'sound:spark' },
      { label: 'Woman scream',        action: 'sound:screamWoman' },
      { label: 'Man scream',          action: 'sound:screamMan' },
      { label: 'Door open',           action: 'sound:doorOpen' },
      { label: 'Door close',          action: 'sound:doorClose' },
      { label: 'Sliding door open',   action: 'sound:slidingDoorOpen' },
      { label: 'Sliding door close',  action: 'sound:slidingDoorClose' },
      { label: 'Leaf blower \u2014 low',  action: 'sound:blower1' },
      { label: 'Leaf blower \u2014 med',  action: 'sound:blower2' },
      { label: 'Leaf blower \u2014 high', action: 'sound:blower3' },
      { label: '\u2039 Back', goto: 'start' },
    ]},
    music: { text: 'Music tracks:', options: [
      { label: 'Opening crawl theme', action: 'music:crawl' },
      { label: 'Start jingle',        action: 'music:jingle' },
      { label: 'Stop music',          action: 'music:stop' },
      { label: '\u2039 Back', goto: 'start' },
    ]},
  }
}, dialogue: 'A booth for testing sounds and music.' });
npc(6, 2, 'Character Sheet', 'stand', { debugAction: 'sheet', cloth: '#10b981', dialogue: 'Interact to open the character sheet.' });
npc(11, 2, 'Wanderer', 'wander', { wanderChance: 0.02, dialogue: 'I just wander around in here.' });
// Patrol NPC walking a square loop in the arcade quadrant.
npc(10, 10, 'Patroller', 'patrol', {
  dialogue: 'On patrol — watch me hop between my waypoints.',
  patrolMode: 'pingpong', canOpenDoors: true, canOpenLockedDoors: false, ifBlocked: 'wait',
  waypoints: [{ x: 10, z: 10 }, { x: 14, z: 10 }, { x: 14, z: 12 }, { x: 10, z: 12 }]
});

// ---- #16: INDOOR/OUTDOOR WALL + DOOR + SIGN -------------------------------
// Wall separating the indoor room (z < OUTDOOR_Z) from the outdoor patio, with
// a sliding door to step through and a sign explaining the area.
for (let x = 1; x < W - 1; x++) edge(x, OUTDOOR_Z, 'n', 'solid', '#475569', { solid: true });
edge(10, OUTDOOR_Z, 'n', 'door_slide', '#0ea5e9', { locked: false, dir: 0, hp: 0 });   // door to outside
// Sign beside the door (a non-solid sign object with read-on-interact text).
obj(8, OUTDOOR_Z - 1, 'sign', '#b45309', '🪧', {
  solid: false,
  name: 'Sign',
  dialogue: 'OUTDOOR TEST PATIO — step through the sliding door to test weather, '
          + 'time of day, and fog out here. Talk to the WORLD CONTROLS attendant outside.'
});

// ---- #16: OUTDOOR NPCs (world controls + respec) --------------------------
npc(10, OUTDOOR_Z + 3, 'World Controls', 'stand', { cloth: '#0e7490', solid: true, debugMenu: {
  root: 'start',
  nodes: {
    start: { text: 'World controls. Change the environment to test it.', options: [
      { label: 'Weather \u00BB',     goto: 'weather' },
      { label: 'Time of day \u00BB', goto: 'time' },
      { label: 'Fog \u00BB',         goto: 'fog' },
      { label: 'Restedness \u00BB',  goto: 'rest' },
      { label: '(leave)', back: true },
    ]},
    rest: { text: 'Adjust how rested the character is (watch the status):', options: [
      { label: 'Fully rested',      action: 'rest:100' },
      { label: 'A little tired',    action: 'rest:60' },
      { label: 'Exhausted',         action: 'rest:20' },
      { label: 'Take a nap (+40)',  action: 'rest:+40' },
      { label: 'Tire out (-25)',    action: 'rest:-25' },
      { label: '\u2039 Back', goto: 'start' },
    ]},
    weather: { text: 'Set the weather:', options: [
      { label: 'Clear',      action: 'weather:none' },
      { label: 'Rain',       action: 'weather:rain' },
      { label: 'Snow',       action: 'weather:snow' },
      { label: '\u2039 Back', goto: 'start' },
    ]},
    time: { text: 'Set the time of day (affects light):', options: [
      { label: 'Dawn (6:00)',     action: 'time:6' },
      { label: 'Midday (13:00)',  action: 'time:13' },
      { label: 'Dusk (19:00)',    action: 'time:19' },
      { label: 'Night (23:00)',   action: 'time:23' },
      { label: '\u2039 Back', goto: 'start' },
    ]},
    fog: { text: 'Fog controls:', options: [
      { label: 'Fog on',          action: 'fog:on' },
      { label: 'Fog off',         action: 'fog:off' },
      { label: 'Fog color: grey', action: 'fogcolor:#888888' },
      { label: 'Fog color: green',action: 'fogcolor:#3a5a3a' },
      { label: 'Fog color: red',  action: 'fogcolor:#5a2a2a' },
      { label: '\u2039 Back', goto: 'start' },
    ]},
  }
}, dialogue: 'I control the weather out here.' });
npc(14, OUTDOOR_Z + 3, 'Respec Booth', 'stand', { cloth: '#9333ea', solid: true, debugMenu: {
  root: 'start',
  nodes: {
    start: { text: 'Want to rebuild this character from scratch? (reverts when you leave the debug room)', options: [
      { label: 'Yes — re-run character creation', action: 'respec' },
      { label: 'No thanks', back: true },
    ]},
  }
}, dialogue: 'I can re-roll your whole character.' });


// ---- Player start ----------------------------------------------------------
obj(8, 2, 'start', '#f43f5e', '⭐', {});
const startX = 8, startZ = 2, startFlr = 0;

// ---- Assemble export buildData (matches Mapster's exporter) ----------------
const buildData = {
  map,
  name: 'debug_room',
  settings: {
    bgMode: 'black', allowEmptyWalk: false, camMode: 'fps_toggle', fpsStartView: 'third', fpsZoomDist: 6,
    startZoomDist: 6,                          // #21: open more zoomed-in
    zoomMode: 'incremental', tiltEnabled: true, ambUrl: '', bgmUrl: '',
    edgeWarpUrl: '', edgeBehavior: 'block', edgeWarpX: 0, edgeWarpY: 0,
    minimapMode: 'toggle', compassMode: 'on', textPosition: 'bottom',
    flashlight: true, allowWindowDraw: true, showVisionCones: false, camN: true, camE: true, camS: true, camW: true,
    minimapCorner: 'tl', disableLocations: false, zoneDisplay: 'off', fogDisplay: 'off',
    fogDiscoverable: false, flashlightMinimap: 'off', flashlightRevealSize: 4, zoneDefs: []
  },
  fogSettings: [{ enabled: false, color: '#222222', density: 20, outdoor: false, weather: 'none', weatherInt: 50 }],
  start: { x: startX, z: startZ, f: startFlr }
};

// ---- Load Mapster's export template (local copy) + substitute --------------
let templateStr = fs.readFileSync(path.join(__dirname, 'map_export_template.txt'), 'utf8');
if (!templateStr.includes('__JSON__')) throw new Error('map_export_template.txt is not an export template');

// Exported map lives at maps/debug_room.html → the project root (core/, vfx/,
// textures/ — including core/helpManager.js) is one level up.
const rootPrefix = '../';
const mapsterPrefix = '../';

const jsonStr = JSON.stringify(buildData).replace(/</g, '\\u003c');
templateStr = templateStr.replace(/__MAP_NAME__/g, 'debug_room');
templateStr = templateStr.replace('__JSON__', () => jsonStr);
templateStr = templateStr.replace('__DIALOGUE_BLOBS__', '');   // no external dialogue files
templateStr = templateStr.replace(/__ROOT_PREFIX__/g, rootPrefix);
templateStr = templateStr.replace(/__MAPSTER_PREFIX__/g, mapsterPrefix);
templateStr = templateStr.replace(/scr__ipt/g, 'script');

const outDir = path.join(ROOT, 'maps');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'debug_room.html');
fs.writeFileSync(outPath, templateStr.trimStart());
// #12: also emit the raw map data as standalone JSON so the in-UI map view
// (midmulti.html) can fetch + embed it into the live engine without parsing the
// exported HTML.
const dataPath = path.join(outDir, 'debug_room.data.json');
fs.writeFileSync(dataPath, JSON.stringify(buildData));
console.log('wrote', dataPath);
// And as a JS global so the in-UI view works under file:// (no fetch/CORS).
const dataJsPath = path.join(outDir, 'debug_room.data.js');
fs.writeFileSync(dataJsPath, 'window.__MAPDATA_debug_room = ' + JSON.stringify(buildData) + ';\n');
console.log('wrote', dataJsPath);
console.log('wrote', outPath, '(' + templateStr.length + ' bytes)');
console.log('cells with floor:', map[0].flat().filter(c => c.f).length);
console.log('objects:', map[0].flat().filter(c => c.o).length);
