/*
 * Facility floor plan - pure data, no three.js.
 *
 * Coordinate system (top-down map): +x is screen-right, +z is screen-DOWN.
 * Rectangles are { x0, x1, z0, z1 }. Points are { x, z }.
 *
 * Everything spatial lives here: rooms, walls, doors, furniture, decor,
 * named spots (queue slots, waiting seats, workstations, patrol route...) and
 * security cameras. The renderer (world/WorldBuilder.js) draws it and the nav
 * grid (nav/NavGrid.js) rasterises it, so editing the map is a data-only
 * change. Run `npm test` afterwards: the nav test checks every spot is reachable.
 *
 * Mirrors the design sketch: the visitor center sits at the bottom-right,
 * the queue runs right-to-left toward the desk, the 3x3 waiting area is below
 * the queue, and the facility interior is everything else.
 *
 *  z=-60 +---------+--------+-----------+--------+----------+
 *        | Exec    | Records| Training  |  IT    | Restrooms|
 *  z=-42 +--d------+---d----+-----d-----+---d----+----d-----+
 *        |                 North Hallway                    |
 *  z=-34 +---------+-------+==+---------------+---------+===+
 *        | Server  |Private|  |  Conference   |Breakroom|   |   <- link corridors
 *  z=-14 +--d------+--d----+  +------d--------+---d-----+   +
 *        |                  Main Hallway                    |
 *  z=-4  +------d-----------+post+-------d------------------+
 *        |   Open Office    |    |       Cafeteria          |
 *  z=10  |                  +-d--+--------------------------+
 *        |                  |DESK <- queue <- <- entrance   |
 *        |                  |            [3x3 waiting]      |
 *  z=34  +------------------+-------------------------------+
 *       x=-50              x=0  x=10                      x=50
 */

export const BOUNDS = { x0: -51, x1: 60, z0: -61, z1: 35 }; // what the map view frames
// What people can walk on: the facility plus the front edge of the parking lot
// and the sidewalk south of it (arrivals from the off-screen part of the lot).
export const NAV_BOUNDS = { x0: -51, x1: 64.5, z0: -61, z1: 50 };
export const WALL_HEIGHT = 3.2;
export const WALL_THICKNESS = 0.6;

// ---------------------------------------------------------------------------
// Rooms: floors, labels, room lookup (for camera deterrence & incident text)
// ---------------------------------------------------------------------------
export const ROOMS = [
  // North row
  { id: 'exec', label: 'Executive Suite', secure: true, floor: 'wood', x0: -50, x1: -24, z0: -60, z1: -42 },
  { id: 'records', label: 'Records Archive', secure: true, floor: 'server', x0: -24, x1: -6, z0: -60, z1: -42 },
  { id: 'training', label: 'Training Room', secure: false, floor: 'carpetWarm', x0: -6, x1: 18, z0: -60, z1: -42 },
  { id: 'it', label: 'IT Help Desk', secure: true, floor: 'carpetBlue', x0: 18, x1: 34, z0: -60, z1: -42 },
  { id: 'restrooms', label: 'Restrooms', secure: false, floor: 'tileBlue', x0: 34, x1: 50, z0: -60, z1: -42 },
  { id: 'northhall', label: 'North Hallway', secure: false, floor: 'hall', x0: -50, x1: 50, z0: -42, z1: -34 },
  // Middle row (links connect the north and main hallways)
  { id: 'server', label: 'Server Room', secure: true, floor: 'server', x0: -50, x1: -28, z0: -34, z1: -14 },
  { id: 'private', label: 'Private Offices', secure: true, floor: 'carpetGreen', x0: -28, x1: -8, z0: -34, z1: -14 },
  { id: 'westlink', label: 'West Link', secure: false, floor: 'hall', x0: -8, x1: -2, z0: -34, z1: -14, noLabel: true },
  { id: 'conference', label: 'Conference', secure: false, floor: 'carpetBlue', x0: -2, x1: 22, z0: -34, z1: -14 },
  { id: 'breakroom', label: 'Breakroom', secure: false, floor: 'tile', x0: 22, x1: 44, z0: -34, z1: -14 },
  { id: 'eastlink', label: 'East Link', secure: false, floor: 'hall', x0: 44, x1: 50, z0: -34, z1: -14, noLabel: true },
  // Main hallway and south half
  { id: 'hallway', label: 'Main Hallway', secure: false, floor: 'hall', x0: -50, x1: 50, z0: -14, z1: -4 },
  { id: 'open', label: 'Open Office', secure: true, floor: 'carpetBlue', x0: -50, x1: 0, z0: -4, z1: 34 },
  { id: 'post', label: 'Security Post', secure: false, floor: 'hall', x0: 0, x1: 10, z0: -4, z1: 10 },
  { id: 'cafeteria', label: 'Cafeteria', secure: false, floor: 'tile', x0: 10, x1: 50, z0: -4, z1: 10 },
  { id: 'lobbyrestroom', label: 'Restroom', secure: false, floor: 'tileBlue', x0: 44.6, x1: 50, z0: 27, z1: 34, small: true }, // single stall, visitors may use it alone
  { id: 'lobby', label: 'Visitor Center', secure: false, floor: 'lobby', x0: 0, x1: 50, z0: 10, z1: 34 },
  { id: 'outside', label: 'Outside', secure: false, floor: 'concrete', x0: 50, x1: 60, z0: 6, z1: 34, noLabel: true },
];

/** Rooms the visitor can be "inside the facility" in (i.e. past the checkpoint). */
export const INTERIOR_ROOMS = new Set(
  ROOMS.map((r) => r.id).filter((id) => !['lobby', 'lobbyrestroom', 'outside'].includes(id)),
);

// Smaller labelled areas, named on hover like rooms (checked before rooms).
export const LABEL_ZONES = [
  { id: 'zone-waiting', label: 'Waiting area', x0: 28.4, x1: 43.6, z0: 23.6, z1: 33.4 },
  { id: 'zone-line', label: 'Line', x0: 8, x1: 40.5, z0: 17.6, z1: 22.4 },
  { id: 'zone-desk', label: 'Security desk', x0: 0.5, x1: 7.5, z0: 14.5, z1: 25.5 },
  { id: 'zone-entrance', label: 'Entrance', x0: 50, x1: 60, z0: 15, z1: 25 },
  { id: 'zone-parking', label: 'Parking', x0: 62, x1: 70, z0: -32, z1: 28 },
];

export const labelZoneAt = (x, z) => LABEL_ZONES.find((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1)?.id ?? null;

export function roomAt(x, z) {
  // Shared edges are resolved by order (first match wins).
  return ROOMS.find((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1)?.id ?? null;
}

// ---------------------------------------------------------------------------
// Walls: axis-aligned segments. Door gaps are cut out automatically.
// ---------------------------------------------------------------------------
export const WALLS = [
  // Outer shell
  { x0: -50, z0: -60, x1: 50, z1: -60 },
  { x0: -50, z0: 34, x1: 50, z1: 34 },
  { x0: -50, z0: -60, x1: -50, z1: 34 },
  { x0: 50, z0: -60, x1: 50, z1: 34 },
  // North row / north hallway
  { x0: -50, z0: -42, x1: 50, z1: -42 },
  { x0: -24, z0: -60, x1: -24, z1: -42 },
  { x0: -6, z0: -60, x1: -6, z1: -42 },
  { x0: 18, z0: -60, x1: 18, z1: -42 },
  { x0: 34, z0: -60, x1: 34, z1: -42 },
  // North hallway / middle row (gaps at the two link corridors)
  { x0: -50, z0: -34, x1: -8, z1: -34 },
  { x0: -2, z0: -34, x1: 44, z1: -34 },
  // Middle row dividers
  { x0: -28, z0: -34, x1: -28, z1: -14 },
  { x0: -8, z0: -34, x1: -8, z1: -14 },
  { x0: -2, z0: -34, x1: -2, z1: -14 },
  { x0: 22, z0: -34, x1: 22, z1: -14 },
  { x0: 44, z0: -34, x1: 44, z1: -14 },
  // Middle row / main hallway (gaps at the link corridors)
  { x0: -50, z0: -14, x1: -8, z1: -14 },
  { x0: -2, z0: -14, x1: 44, z1: -14 },
  // Main hallway bottom edge (gap at x 0..10 is the open security post)
  { x0: -50, z0: -4, x1: 0, z1: -4 },
  { x0: 10, z0: -4, x1: 50, z1: -4 },
  // Open office east wall, security post east wall
  { x0: 0, z0: -4, x1: 0, z1: 34 },
  { x0: 10, z0: -4, x1: 10, z1: 10 },
  // Visitor center north wall (checkpoint door lives here)
  { x0: 0, z0: 10, x1: 50, z1: 10 },
  // Single-stall restroom in the visitor center's south-east corner
  { x0: 44.6, z0: 27, x1: 50, z1: 27 },
  { x0: 44.6, z0: 27, x1: 44.6, z1: 34 },
];

// ---------------------------------------------------------------------------
// Doors. `secure` doors need a badge (staff, or a guest with their escort).
// `alwaysOpen` doors never close (the glass main entrance).
// ---------------------------------------------------------------------------
export const DOORS = [
  { id: 'entrance', label: 'Main Entrance', x: 50, z: 20, width: 6, secure: false, alwaysOpen: true, kind: 'glass' },
  { id: 'checkpoint', label: 'Checkpoint', x: 5, z: 10, width: 4, secure: true, kind: 'swing' },
  { id: 'server', label: 'Server Room', x: -39, z: -14, width: 4, secure: true, kind: 'swing' },
  { id: 'private', label: 'Private Offices', x: -18, z: -14, width: 4, secure: true, kind: 'swing' },
  { id: 'conference', label: 'Conference', x: 14, z: -14, width: 4, secure: false, kind: 'swing' },
  { id: 'breakroom', label: 'Breakroom', x: 33, z: -14, width: 4, secure: false, kind: 'swing' },
  { id: 'open', label: 'Open Office', x: -25, z: -4, width: 4, secure: true, kind: 'swing' },
  { id: 'cafeteria', label: 'Cafeteria', x: 30, z: -4, width: 4, secure: false, kind: 'swing' },
  { id: 'exec', label: 'Executive Suite', x: -37, z: -42, width: 4, secure: true, kind: 'swing' },
  { id: 'records', label: 'Records Archive', x: -15, z: -42, width: 4, secure: true, kind: 'swing' },
  { id: 'training', label: 'Training Room', x: 6, z: -42, width: 4, secure: false, kind: 'swing' },
  { id: 'it', label: 'IT Help Desk', x: 26, z: -42, width: 4, secure: true, kind: 'swing' },
  { id: 'restrooms', label: 'Restrooms', x: 42, z: -42, width: 4, secure: false, kind: 'swing' },
  { id: 'lobbyrestroom', label: 'Restroom', x: 47.3, z: 27, width: 3, secure: false, kind: 'swing' },
];

// ---------------------------------------------------------------------------
// Furniture. `block: true` items are obstacles for navigation.
// ---------------------------------------------------------------------------
const cubicles = [];
for (const cz of [3, 11, 19, 27]) {
  for (const cx of [-43, -33, -23, -13]) {
    cubicles.push({ kind: 'cubicle', block: true, x0: cx - 3, x1: cx + 3, z0: cz - 1, z1: cz + 1 });
  }
}

export const FURNITURE = [
  // Visitor center
  { kind: 'securityDesk', block: true, x0: 3.6, x1: 6.4, z0: 16, z1: 24 },
  { kind: 'plant', block: true, x0: 46.5, x1: 48.5, z0: 11.5, z1: 13.5 },
  { kind: 'plant', block: true, x0: 1.5, x1: 3.5, z0: 31, z1: 33 },
  { kind: 'rope', block: false, x0: 11.5, x1: 40, z0: 17.6, z1: 17.8 },
  { kind: 'rope', block: false, x0: 11.5, x1: 40, z0: 22.2, z1: 22.4 },
  // Server room racks
  { kind: 'rack', block: true, x0: -47, x1: -33, z0: -31, z1: -29.5 },
  { kind: 'rack', block: true, x0: -47, x1: -33, z0: -25.5, z1: -24 },
  { kind: 'rack', block: true, x0: -47, x1: -33, z0: -20, z1: -18.5 },
  // Private offices
  { kind: 'execDesk', block: true, x0: -25, x1: -19, z0: -30, z1: -28 },
  { kind: 'execDesk', block: true, x0: -16, x1: -10, z0: -30, z1: -28 },
  { kind: 'shelf', block: true, x0: -27.4, x1: -26, z0: -26, z1: -18 },
  // Conference
  { kind: 'table', block: true, x0: 2, x1: 16, z0: -27, z1: -21 },
  // Breakroom
  { kind: 'counter', block: true, x0: 25, x1: 41, z0: -33.4, z1: -31.4 },
  { kind: 'roundTable', block: true, x0: 26, x1: 30, z0: -26, z1: -22 },
  { kind: 'roundTable', block: true, x0: 35, x1: 39, z0: -26, z1: -22 },
  { kind: 'cooler', block: true, x0: 42.2, x1: 43.4, z0: -17, z1: -15.8 },
  // Cafeteria
  { kind: 'table', block: true, x0: 15, x1: 21, z0: 2, z1: 5 },
  { kind: 'table', block: true, x0: 33, x1: 39, z0: 2, z1: 5 },
  { kind: 'vending', block: true, x0: 48, x1: 49.6, z0: 0, z1: 6 },
  // Open office
  ...cubicles,
  { kind: 'printer', block: true, x0: -6, x1: -3, z0: 30.5, z1: 32.8 },
  { kind: 'plant', block: true, x0: -49, x1: -47, z0: 31.5, z1: 33.5 },
  // Executive suite
  { kind: 'execDesk', block: true, x0: -42, x1: -34, z0: -55, z1: -52.5 },
  { kind: 'couch', block: true, x0: -48.8, x1: -46.6, z0: -51, z1: -45 },
  { kind: 'plant', block: true, x0: -27, x1: -25, z0: -59, z1: -57 },
  // Records archive
  { kind: 'shelf', block: true, x0: -21, x1: -9, z0: -57.5, z1: -56.5 },
  { kind: 'shelf', block: true, x0: -21, x1: -9, z0: -52.5, z1: -51.5 },
  { kind: 'shelf', block: true, x0: -21, x1: -9, z0: -47.5, z1: -46.5 },
  // Training room
  { kind: 'screen', block: true, x0: -2, x1: 14, z0: -59.6, z1: -59.1 },
  { kind: 'table', block: true, x0: -3, x1: 15, z0: -51, z1: -50 },
  { kind: 'table', block: true, x0: -3, x1: 15, z0: -46.5, z1: -45.5 },
  // IT help desk
  { kind: 'cubicle', block: true, x0: 20, x1: 32, z0: -57, z1: -55 },
  { kind: 'rack', block: true, x0: 31, x1: 33.2, z0: -50, z1: -45 },
  // Restrooms
  { kind: 'stalls', block: true, x0: 36, x1: 48, z0: -59.7, z1: -55 },
  { kind: 'counter', block: true, x0: 44, x1: 49.6, z0: -50, z1: -48.6 },
  // Visitor center restroom (single stall)
  { kind: 'toilet', block: true, x0: 48.2, x1: 49.6, z0: 32.2, z1: 33.6 },
  { kind: 'sink', block: true, x0: 45, x1: 46.4, z0: 32.8, z1: 33.6 },
];

// Non-blocking dressing: rugs, wall art, chairs, small plants (render only).
export const DECOR = [
  { kind: 'rug', color: '#c9b79a', x0: 28.4, x1: 43.6, z0: 23.6, z1: 33.4 }, // waiting area
  { kind: 'rug', color: '#9fb3a0', x0: -44, x1: -32, z0: -50, z1: -45 }, // exec suite
  { kind: 'rug', color: '#c7a98f', x0: 25, x1: 40, z0: -28, z1: -20 }, // breakroom
  { kind: 'rug', color: '#b4c2d4', x0: -26, x1: -10, z0: -27, z1: -17 }, // private offices
  { kind: 'welcome', x0: 45.5, x1: 49.6, z0: 17.8, z1: 22.2 }, // entrance mat
  // Wall art (side: which side of the wall it hangs on)
  { kind: 'art', x: 25, z: 10, axis: 'h', side: 1, color: '#d98c5f' },
  { kind: 'art', x: 40, z: 10, axis: 'h', side: 1, color: '#6f9bc4' },
  { kind: 'art', x: -12, z: -4, axis: 'h', side: -1, color: '#8fb07a' },
  { kind: 'art', x: -30, z: -42, axis: 'h', side: 1, color: '#c46f6f' },
  { kind: 'art', x: 0, z: -34, axis: 'h', side: -1, color: '#d9b45f' },
  { kind: 'art', x: 30, z: -34, axis: 'h', side: -1, color: '#7fa8a8' },
  { kind: 'art', x: -38, z: -60, axis: 'h', side: 1, color: '#9a7fc4' },
  // Small plants
  { kind: 'smallPlant', x: -48.5, z: -12.5 }, { kind: 'smallPlant', x: 48.5, z: -12.5 },
  { kind: 'smallPlant', x: -48.5, z: -40.5 }, { kind: 'smallPlant', x: 48.5, z: -40.5 },
  { kind: 'smallPlant', x: 20.5, z: -15.5 }, { kind: 'smallPlant', x: 32.5, z: -58.5 },
];

// ---------------------------------------------------------------------------
// Named spots. People are routed to spots and spots are reserved so two
// people never stand in the same place (no overlapping at the desk!).
// ---------------------------------------------------------------------------

// Queue slot 0 is in front of the desk. A pair stands side by side (offset in z).
export const QUEUE_SLOTS = Array.from({ length: 8 }, (_, i) => ({ x: 9.5 + i * 4, z: 20 }));
export const PAIR_OFFSET = 1.15;

export const WAITING_SEATS = [];
for (const z of [25.5, 28.5, 31.5]) for (const x of [31, 36, 41]) WAITING_SEATS.push({ x, z });

export const SPAWN_POINT = { x: 57, z: 20 };
export const EXIT_POINT = { x: 57, z: 26 };
export const DESK_PICKUP = { x: 9.5, z: 15 }; // Where an escort meets a guest at the desk
export const PLAYER_POINT = { x: 2, z: 20 }; // The player (security manager) behind the desk

export const OFFICER_POSTS = [
  { x: 2.5, z: -1 },
  { x: 7.5, z: -1 },
  { x: 2.5, z: 5 },
  { x: 7.5, z: 5 },
  { x: 2.5, z: 2 },
  { x: 7.5, z: 2 },
  { x: 2.2, z: 8 },
  { x: 7.8, z: 8 },
];

// Where a free officer stands to check on the waiting area (one at a time).
export const WAITING_CHECKIN_SPOTS = [{ x: 27.5, z: 27.5 }, { x: 36, z: 23.4 }];

// Places free officers meander between when not checking the waiting area.
export const OFFICER_ROAM_SPOTS = [
  { x: 15, z: 13 }, { x: 25, z: 13 }, { x: 43, z: 14 }, { x: 22, z: 31 }, { x: 12, z: 26 },
  { x: -10, z: -9 }, { x: 20, z: -9 }, { x: 40, z: -9 }, { x: 5, z: -9 }, { x: -35, z: -9 },
  { x: 25, z: 7.3 }, { x: 0, z: -38 }, { x: 30, z: -38 }, { x: -30, z: -38 },
  { x: -5, z: -24 }, { x: 47, z: -24 }, { x: 2.5, z: 3 }, { x: 7.5, z: 3 },
];

// Hourly patrols: two SET routes that alternate hour by hour. Each is walked in
// this exact order and checks BOTH ENDS of EVERY room on it (three corners of
// the big open office). Together they cover every room in the facility, so
// any two consecutive patrols check the whole building.
export const PATROL_ROUTES = [
  {
    name: 'Main floor',
    // Security post, cafeteria, up the east end of the hallway, the middle row
    // west-bound, then down the west side and back through the visitor center.
    points: [
      { room: 'post', end: 'south', x: 5, z: 8 },
      { room: 'post', end: 'north', x: 5, z: -2.5 },
      { room: 'cafeteria', end: 'west', x: 12.5, z: 0 },
      { room: 'cafeteria', end: 'east', x: 45.5, z: 8 },
      { room: 'hallway', end: 'east', x: 47, z: -9 },
      { room: 'breakroom', end: 'east', x: 41.5, z: -25 },
      { room: 'breakroom', end: 'west', x: 24.2, z: -24 },
      { room: 'conference', end: 'east', x: 19.5, z: -30 },
      { room: 'conference', end: 'west', x: 0.1, z: -24 },
      { room: 'private', end: 'east', x: -10, z: -20 },
      { room: 'private', end: 'west', x: -26.4, z: -32.2 },
      { room: 'server', end: 'east', x: -30.6, z: -22 },
      { room: 'server', end: 'west', x: -48.35, z: -27.5 },
      { room: 'hallway', end: 'west', x: -47, z: -9 },
      { room: 'open', end: 'north-west', x: -47, z: -1 },
      { room: 'open', end: 'south-west', x: -45, z: 31 },
      { room: 'open', end: 'south-east', x: -3, z: 29 },
      { room: 'lobby', end: 'west', x: 14, z: 30 },
      { room: 'lobby', end: 'east', x: 42, z: 30 },
      { room: 'lobbyrestroom', end: 'stall', x: 47.3, z: 30.6 },
    ],
  },
  {
    name: 'North wing',
    // Up the east link, along the north wing west-bound, back down the west link.
    points: [
      { room: 'eastlink', end: 'north', x: 47, z: -30 },
      { room: 'northhall', end: 'east', x: 47, z: -38 },
      { room: 'restrooms', end: 'east', x: 46, z: -46 },
      { room: 'restrooms', end: 'west', x: 37, z: -52 },
      { room: 'it', end: 'east', x: 32, z: -52 },
      { room: 'it', end: 'west', x: 20, z: -46 },
      { room: 'training', end: 'east', x: 16.4, z: -48.8 },
      { room: 'training', end: 'west', x: -4.35, z: -44 },
      { room: 'records', end: 'east', x: -7.65, z: -54.5 },
      { room: 'records', end: 'west', x: -22.35, z: -49.5 },
      { room: 'exec', end: 'east', x: -26.5, z: -50 },
      { room: 'exec', end: 'west', x: -48, z: -55 },
      { room: 'northhall', end: 'west', x: -47, z: -38 },
      { room: 'westlink', end: 'south', x: -5, z: -17 },
    ],
  },
];

/** Every checkpoint on every route (for tests and tools). */
export const PATROL_CHECKPOINTS = PATROL_ROUTES.flatMap((r) => r.points);

export const WORKSTATIONS = [
  ...cubicles.map((c) => ({ x: (c.x0 + c.x1) / 2, z: c.z1 + 1.3, room: 'open' })),
  { x: -22, z: -31.8, room: 'private' },
  { x: -13, z: -31.8, room: 'private' },
  { x: -38, z: -57.3, room: 'exec' },
  { x: 23, z: -53.6, room: 'it' },
  { x: 29, z: -53.6, room: 'it' },
];

// Break spots staff wander to between work stints
export const BREAK_SPOTS = [
  { x: 28, z: -29.5 }, { x: 33, z: -29.5 }, { x: 38, z: -29.5 },
  { x: 28, z: -19 }, { x: 37, z: -19 }, { x: 40.8, z: -16.4 },
  { x: 18, z: -0.8 }, { x: 18, z: 7.3 }, { x: 36, z: -0.8 }, { x: 36, z: 7.3 }, { x: 46, z: 3 },
  { x: 40, z: -52 }, { x: 46, z: -46 },
];

// Where visitors' appointments take them.
//  - Meeting rooms (`service` unset): a host employee meets them there, so the
//    escort can hand them over and go. The host stands at a `standby` spot.
//  - Service rooms (`service: true`, e.g. a vendor working in the server room):
//    nobody hosts them, so the escort stands by for the whole visit.
export const MEETING_ROOMS = [
  {
    room: 'conference',
    label: 'Conference',
    standby: [{ x: 19.5, z: -17 }, { x: 19.5, z: -21 }, { x: 19.5, z: -25 }],
    seats: [
      { x: 4, z: -29.5 }, { x: 8, z: -29.5 }, { x: 12, z: -29.5 }, { x: 16, z: -29.5 },
      { x: 4, z: -18.5 }, { x: 8, z: -18.5 }, { x: 12, z: -18.5 }, { x: 16, z: -18.5 },
    ],
  },
  {
    room: 'private',
    label: 'Private Offices',
    standby: [{ x: -22, z: -16.5 }, { x: -25, z: -16.5 }, { x: -12, z: -16.5 }],
    seats: [{ x: -22, z: -26 }, { x: -13, z: -26 }, { x: -21, z: -20 }, { x: -13, z: -20 }],
  },
  {
    room: 'cafeteria',
    label: 'Cafeteria',
    standby: [{ x: 26, z: -1 }, { x: 24, z: 7.3 }, { x: 29, z: 7.3 }],
    seats: [{ x: 15, z: 7.3 }, { x: 21, z: 7.3 }, { x: 33, z: 7.3 }, { x: 39, z: 7.3 }],
  },
  {
    room: 'training',
    label: 'Training Room',
    standby: [{ x: 16.4, z: -44 }, { x: -4.35, z: -44 }, { x: 16.4, z: -48.8 }],
    seats: [
      { x: 0, z: -48.8 }, { x: 4, z: -48.8 }, { x: 8, z: -48.8 }, { x: 12, z: -48.8 },
      { x: 0, z: -53.2 }, { x: 4, z: -53.2 }, { x: 8, z: -53.2 }, { x: 12, z: -53.2 },
    ],
  },
  {
    room: 'exec',
    label: 'Executive Suite',
    standby: [{ x: -30, z: -45 }, { x: -44, z: -44 }],
    seats: [{ x: -40, z: -50 }, { x: -36, z: -50 }],
  },
  {
    room: 'server',
    label: 'Server Room',
    service: 'Rack maintenance',
    standby: [{ x: -31, z: -27 }, { x: -31, z: -22 }, { x: -31, z: -17 }],
    seats: [{ x: -42, z: -27.5 }, { x: -38, z: -27.5 }, { x: -42, z: -22 }, { x: -38, z: -22 }],
  },
  {
    room: 'it',
    label: 'IT Help Desk',
    service: 'Equipment repair',
    standby: [{ x: 21, z: -45 }, { x: 28.5, z: -45 }],
    seats: [{ x: 24, z: -49 }, { x: 28, z: -49 }],
  },
  {
    room: 'records',
    label: 'Records Archive',
    service: 'Records audit',
    standby: [{ x: -7.65, z: -49.5 }, { x: -7.65, z: -44.5 }],
    seats: [{ x: -15, z: -54.5 }, { x: -15, z: -49.5 }],
  },
];

// Lounges: a host or escort may leave visitors here unattended (they behave
// for LOUNGE_PATIENCE_MINUTES, then get restless and wander).
export const LOUNGES = [
  { room: 'breakroom', label: 'Breakroom', seats: [{ x: 24.4, z: -24 }, { x: 31.6, z: -24 }, { x: 33.4, z: -24 }, { x: 40.6, z: -24 }] },
  { room: 'cafeteria', label: 'Cafeteria', seats: [{ x: 15, z: -0.8 }, { x: 21, z: -0.8 }, { x: 33, z: -0.8 }, { x: 39, z: -0.8 }] },
];

// Restrooms. Visitors need a guard to walk them to one, except the single
// stall in the visitor center (`visitorsAlone`), next to the waiting area.
export const RESTROOMS = [
  // `waitAt`: where a guard waits while the visitor is inside.
  { room: 'restrooms', label: 'Restrooms', waitAt: { x: 40, z: -46 }, spots: [{ x: 37.5, z: -53.6 }, { x: 40.5, z: -53.6 }, { x: 43.5, z: -53.6 }, { x: 46.5, z: -53.6 }] },
  { room: 'lobbyrestroom', label: 'Visitor Restroom', visitorsAlone: true, waitAt: { x: 47.3, z: 24.6 }, spots: [{ x: 47.3, z: 30.6 }] },
];

// Where visitors wait (out of the line) while an officer radios in to verify
// an appointment that isn't on the list.
export const VERIFY_SPOTS = [{ x: 13, z: 13.2 }, { x: 15.6, z: 13.2 }, { x: 18.2, z: 13.2 }];

// Parking. Front-row spots are visible on the map; the lot is implied to
// continue off-screen to the south, where anyone who can't park up front
// leaves their car and walks in from (`walkIn`). Cars park nose-in facing the
// building; `door` is where the driver gets out.
export const PARKING = {
  spots: Array.from({ length: 15 }, (_, i) => {
    const z = -30 + i * 4;
    return { id: `P${i + 1}`, x: 66, z, door: { x: 62.9, z } };
  }),
  aisleX: 73, // cars drive up and down this lane
  offscreenZ: 75, // where the lane leaves the map
  walkIn: { x: 61.5, z: 49 },
};

// Places an unescorted visitor finds interesting (weighted toward secure rooms).
export const WANDER_SPOTS = [
  { x: -40, z: -27.5, weight: 3 }, { x: -36, z: -22, weight: 3 }, { x: -44, z: -16.4, weight: 2 },
  { x: -18, z: -24, weight: 2 }, { x: -18, z: -32.3, weight: 1 },
  { x: -15, z: -54.5, weight: 3 }, { x: -12, z: -49.5, weight: 3 },
  { x: -38, z: -48, weight: 3 }, { x: -30, z: -55, weight: 2 },
  { x: 26, z: -48, weight: 2 }, { x: 29, z: -52, weight: 1 },
  { x: -38, z: 7, weight: 2 }, { x: -18, z: 15, weight: 2 }, { x: -28, z: 23, weight: 1 },
  { x: 6, z: -31, weight: 1 }, { x: 19, z: -31, weight: 1 },
  { x: 32, z: -29.5, weight: 1 }, { x: 42, z: -21, weight: 1 },
  { x: -10, z: -9, weight: 1 }, { x: 24, z: -9, weight: 1 }, { x: 10, z: -38, weight: 1 },
  { x: 25, z: 7.3, weight: 1 }, { x: 6, z: -55, weight: 1 }, { x: 40, z: -51, weight: 1 },
];

// ---------------------------------------------------------------------------
// Security cameras. `mount` is where the device hangs; `look` is the room
// focus used for the zoomed 3D view.
// ---------------------------------------------------------------------------
export const CAMERAS = [
  { id: 'cam1', label: 'Visitor Center', room: 'lobby', mount: { x: 43.4, z: 33 }, look: { x: 24, z: 22 } },
  { id: 'cam2', label: 'Main Hallway', room: 'hallway', mount: { x: -49, z: -5 }, look: { x: 0, z: -9 } },
  { id: 'cam3', label: 'Server Room', room: 'server', mount: { x: -29, z: -33 }, look: { x: -40, z: -24 } },
  { id: 'cam4', label: 'Private Offices', room: 'private', mount: { x: -9, z: -33 }, look: { x: -18, z: -24 } },
  { id: 'cam5', label: 'Open Office', room: 'open', mount: { x: -1, z: 33 }, look: { x: -25, z: 14 } },
  { id: 'cam6', label: 'Conference', room: 'conference', mount: { x: 21, z: -33 }, look: { x: 9, z: -24 } },
  { id: 'cam7', label: 'Breakroom', room: 'breakroom', mount: { x: 43, z: -33 }, look: { x: 33, z: -24 } },
  { id: 'cam8', label: 'Cafeteria', room: 'cafeteria', mount: { x: 49, z: 9 }, look: { x: 30, z: 3 } },
  { id: 'cam9', label: 'Executive Suite', room: 'exec', mount: { x: -25, z: -59 }, look: { x: -37, z: -51 } },
  { id: 'cam10', label: 'Records Archive', room: 'records', mount: { x: -7, z: -59 }, look: { x: -15, z: -51 } },
  { id: 'cam11', label: 'North Hallway', room: 'northhall', mount: { x: -49, z: -41 }, look: { x: 0, z: -38 } },
  { id: 'cam12', label: 'IT Help Desk', room: 'it', mount: { x: 33, z: -59 }, look: { x: 26, z: -51 } },
];

export const cameraForRoom = (roomId) => CAMERAS.find((c) => c.room === roomId) ?? null;
