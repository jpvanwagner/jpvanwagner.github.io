# Map format

What Mapster reads and writes. Every map is one `buildData` object, stored as
JSON inside an HTML page: Mapster's **Export** writes a playable page with it in
`<script type="application/json" id="map-data">`, and **Load Project** reads
that block back out of any `.html` file (single- or double-quoted `id`).
`core/engine.js` builds the 3D scene from the same object.

---

## `buildData` — the top level

```jsonc
{
  "map":  [ /* floors */ ],      // map[floor][z][x] = cell
  "name": "my_map",
  "settings": { /* engine/camera/minimap/fog display settings — see below */ },
  "fogSettings": [ { "enabled": false, "color": "#0a0e18", "density": 20,
                     "outdoor": true, "weather": "none", "weatherInt": 50 } ],
  "start": { "x": 6, "z": 13, "f": 0 }   // player spawn tile
}
```

- `map` is `[floor][z][x]` — an array of floors, each a 2-D grid of **cells**.
  A single-floor map has `map.length === 1`.
- `fogSettings` is **per-floor** (index matches the floor index).
- `start` is the spawn tile; `f` is the floor.

### `settings` (commonly used keys)

| Key | Meaning |
|-----|---------|
| `bgMode` | background (`black`, `night`, `sky`, …) |
| `camMode` | `iso_45`, `fps_toggle`, … |
| `fpsStartView` | `third` / `first` |
| `movementMode` | `camera` (view-relative WASD) or `fixed` |
| `tiltEnabled`, `zoomMode`, `startZoomDist`, `fpsZoomDist` | camera tuning |
| `minimapMode`, `compassMode`, `minimapCorner` | HUD |
| `showVisionCones` | draw guard cones (tutorials only) |
| `allowEmptyWalk` | can the player stand on empty (floorless) tiles |
| `disableLocations`, `zoneDefs`, `edgeBehavior`/`edgeWarp*` | zones & edges |

---

## The cell schema

Each cell is an object. Every field is optional (absent/`null` = nothing there):

```jsonc
{
  "f":  { … } | null,   // FLOOR tile
  "o":  { … } | null,   // OBJECT sitting on the tile (start, car, key, arcade, bench, npc, sign, stairs, ladder, elevator, warp…)
  "c":  { … } | null,   // CEILING
  "n":  { … } | null,   // NORTH edge (wall / door / window / counter / attachment host)
  "s":  { … } | null,   // SOUTH edge
  "e":  { … } | null,   // EAST edge
  "w":  { … } | null,   // WEST edge
  "d1": { … } | null,   // diagonal NW–SE
  "d2": { … } | null    // diagonal NE–SW
}
```

**Floors** go in `f`, **things standing on the tile** in `o`, and **walls /
doors / windows** on the four edge slots `n/s/e/w` (they live on edges so two
tiles share one wall). Diagonals `d1`/`d2` are for angled walls.

### The element shape

Every floor/object/edge element shares this shape:

```jsonc
{
  "n": "terrazzo",     // display name
  "v": "terrazzo",     // VARIANT KEY — what the engine switches on to render/behave
  "c": "#efece4",      // primary colour
  "ac": "#666",        // accent colour (floors)
  "s": "🚗",           // optional glyph (objects)
  "meta": { … }        // per-variant properties (see below)
}
```

`v` (the variant) is the important field — the engine dispatches on it. `meta`
carries the behaviour.

### Representative examples (from real maps)

```jsonc
// floor
{ "n":"terrazzo","v":"terrazzo","c":"#efece4","ac":"#666","meta":{} }

// solid wall (on an edge slot, e.g. cell.n)
{ "n":"solid","v":"solid","c":"#233240","meta":{ "solid":true } }

// LOCKED swing door (edge slot) — needs the key named by reqKey
{ "n":"door_swing","v":"door_swing","c":"#7c2d12",
  "meta":{ "locked":true, "reqKey":"MultiplexKey", "dir":0, "hp":0 } }

// player start (object slot)
{ "n":"start","v":"start","c":"#f43f5e","s":"⭐","meta":{} }

// a CAR (object slot) — carDir = which way the front points (n/e/s/w).
// Give it a keyId to make it the key-holding car (grab the key with G).
{ "n":"car","v":"car","c":"#8a2f2f","s":"🚗",
  "meta":{ "solid":true, "jumpable":false, "carDir":"s",
           "keyId":"MultiplexKey", "keyLabel":"multiplex key" } }

// a PARKING STALL floor — asphalt (c) with a painted line (ac) down its WEST edge;
// a row of these is a row of parking spaces
{ "n":"Parking Stall","v":"parking","c":"#3d434c","ac":"#f5f5f0","meta":{} }

// an ELEVATOR (object slot) — put one on the SAME tile on every floor it serves.
// It doesn't block; SPACE inside rides to the next floor up (from the top, back down).
// rot turns its open doors (0 = doors facing south, then clockwise)
{ "n":"Elevator","v":"elevator","c":"#9aa3ad","s":"🛗","meta":{ "rot":0, "solid":false } }

// an exit waypoint (object slot) — crossing an unlocked door on this tile
// fires engineOnExitReached (used to end a tutorial lesson / advance the flow)
{ "n":"exit_sign","v":"exit_sign","c":"#d11f1f","s":"🚪",
  "meta":{ "solid":false, "exitWaypoint":true, "text":"You step inside…" } }
```

### Attachments (posters, switches, mirrors, neon, sconces…)

Things mounted **on a wall** ride along in the host edge's
`meta.attachments` array rather than being their own cell element:

```jsonc
{ "n":"solid","v":"solid","c":"#334155",
  "meta":{ "solid":true,
           "attachments":[ { "v":"switch", "offset":0, "offsetY":0.1,
                             "color":"#ffd23f", "linkId":"main" } ] } }
```

Common attachment `v`: `poster`, `switch`, `neon`/`neon_text`/`neon_stripe`,
`sconce`, `mirror`/`mirror_full`, `sink`, `urinal`, `towel`, `register`.

---

## How an exported map loads

1. The exported page loads THREE.js r128 from the CDN, then the runtime modules
   from `core/`, `vfx/` and `textures/` (paths set by **Export Folder Depth**).
2. Any Saymaker dialogue attached to an NPC/object is inlined as
   `<script type="application/json" id="dlg-<id>">`, so conversations play
   offline.
3. On `load`, `initEngine()` (in `core/engine.js`) reads `#map-data`, builds the
   THREE.js scene and starts the player at `start`.

The Preview button does the same thing inside an iframe, using the editor's own
folder as the base path.
