// The floor plan of the trattoria, in world units (≈ metres).
// x runs left→right, z runs top→bottom on the overhead map; y is up.
//
//   ┌──────────── kitchen ─────────┬── office ──┬──── bar ────┐
//   │ pots pan fryer  OVEN    prep │   desk     │   back bar  │
//   ├────── pass ─────┤            ├─── door ───┤ counter     │
//   │                     dining room              stools     │
//   │ queue                                                   │
//   │ ↑   host                                                │
//   └door─────────────────────────────────────────────────────┘

export const WORLD = { w: 26, d: 18 };

export const ZONES = {
  kitchen: { x0: 0, z0: 0, x1: 12, z1: 5.6 },
  office:  { x0: 12, z0: 0, x1: 18, z1: 5.6 },
  bar:     { x0: 20.6, z0: 0, x1: 26, z1: 13 },
  dining:  { x0: 0, z0: 5.6, x1: 26, z1: 18 },
};

// Walls: [x0, z0, x1, z1, height]. Interior walls are low so the overhead map reads.
export const WALLS = [
  [0, -0.1, 26, 0.1, 2.6],          // back
  [-0.1, 0, 0.1, 18, 1.3],          // left
  [25.9, 0, 26.1, 18, 1.3],         // right
  [0, 17.9, 1.0, 18.1, 1.0],        // front, left of door
  [3.0, 17.9, 26, 18.1, 1.0],       // front, right of door
  [0, 5.5, 3.4, 5.7, 1.1],          // kitchen half-wall (left of pass)
  [9.6, 5.5, 12, 5.7, 1.1],         // kitchen half-wall (right of pass)
  [11.9, 0, 12.1, 5.6, 2.2],        // kitchen | office
  [12, 5.5, 14.4, 5.7, 2.2],        // office front
  [15.8, 5.5, 18.1, 5.7, 2.2],
  [17.9, 0, 18.1, 5.6, 2.2],        // office | bar
];

export const DOOR = { x: 2.0, z: 17.6, outside: { x: 2.0, z: 19.5 } };
export const HOST_STAND = { x: 4.4, z: 16.2 };

// Waiting line runs up the left wall from the door.
export const QUEUE_SPOTS = Array.from({ length: 9 }, (_, i) => ({ x: 1.15, z: 16.3 - i * 1.15 }));

// Kitchen line along the back wall. The wood-fired oven is the showpiece: centred on the back
// wall with its mouth facing the dining room, so guests see the fire through the pass.
export const KITCHEN = {
  pot:    { x: 1.25, z: 0.75, w: 2.1, d: 1.1 },
  pan:    { x: 3.0, z: 0.75, w: 1.3, d: 1.1 },
  fryer:  { x: 4.3, z: 0.75, w: 1.2, d: 1.1 },
  oven:   { x: 6.6, z: 1.15, w: 3.0, d: 1.9 },
  prep:   { x: 10.0, z: 0.75, w: 3.4, d: 1.1 },
  pass:   { x: 6.5, z: 5.6, w: 6.2, d: 0.7 },
  // Plating island in front of the oven: warmer on the left, plates on the right. Kept low
  // (counter height) so it doesn't hide the oven mouth from the dining room.
  island: { x: 6.0, z: 3.55, w: 5.6, d: 0.8 },
  cookSpot: { x: 6.6, z: 2.65 },
};

// Bar: counter runs top→bottom; the bartender works between counter and back bar.
export const BAR = {
  counter: { x0: 21.9, z0: 1.2, x1: 22.7, z1: 11.6 },
  backBar: { x0: 25.2, z0: 0.6, x1: 25.9, z1: 12.2 },
  workGlass: { x: 22.35, z: 6.6 },
  bartenderSpot: { x: 23.8, z: 6.6 },
  pickup: { x: 21.2, z: 11.2 },        // where runners collect finished drinks
};

export const PASS_PICKUP = { x: 6.5, z: 6.5 };
export const STAFF_HOME = [{ x: 8.6, z: 6.6 }, { x: 4.4, z: 6.6 }, { x: 12.0, z: 6.6 }];

// Tables. kind: 'sq' (square), 'rect' (long), 'bar' (pair of stools).
// `upgrade` tables only exist once the matching upgrade is bought.
export const TABLES = [
  { id: 1, label: 'T1', kind: 'sq',   cap: 2, x: 5.6,  z: 8.4 },
  { id: 2, label: 'T2', kind: 'sq',   cap: 2, x: 5.6,  z: 11.9 },
  { id: 3, label: 'T3', kind: 'sq',   cap: 4, x: 9.6,  z: 8.4 },
  { id: 4, label: 'T4', kind: 'sq',   cap: 4, x: 9.6,  z: 11.9 },
  { id: 5, label: 'T5', kind: 'sq',   cap: 4, x: 13.8, z: 8.4 },
  { id: 6, label: 'T6', kind: 'rect', cap: 6, x: 14.4, z: 12.1 },
  { id: 7, label: 'T7', kind: 'sq',   cap: 2, x: 17.9, z: 8.4 },
  { id: 8, label: 'T8', kind: 'sq',   cap: 4, x: 11.6, z: 15.5, upgrade: 'extraTable' },
  { id: 9, label: 'T9', kind: 'rect', cap: 6, x: 17.4, z: 15.5, upgrade: 'bigTable' },
  { id: 10, label: 'B1', kind: 'bar', cap: 2, x: 21.25, z: 2.9 },
  { id: 11, label: 'B2', kind: 'bar', cap: 2, x: 21.25, z: 5.8 },
  { id: 12, label: 'B3', kind: 'bar', cap: 2, x: 21.25, z: 8.7 },
];

/** Table footprint (half sizes) and seat positions + facing, derived from kind/cap.
 *  Facing is a y-rotation where 0 looks toward +z (models face +z by default). */
export function tableGeometry(t) {
  let hw = 0, hd = 0, pts;
  if (t.kind === 'bar') {
    pts = [[t.x, t.z - 0.55], [t.x, t.z + 0.55]];
  } else if (t.kind === 'rect') {
    hw = 1.25; hd = 0.55;
    pts = [
      [t.x - 0.7, t.z - hd - 0.45], [t.x + 0.7, t.z - hd - 0.45],
      [t.x - 0.7, t.z + hd + 0.45], [t.x + 0.7, t.z + hd + 0.45],
      [t.x - hw - 0.45, t.z], [t.x + hw + 0.45, t.z],
    ];
  } else {
    hw = hd = t.cap === 2 ? 0.42 : 0.62;
    const off = hw + 0.45;
    pts = t.cap === 2
      ? [[t.x - off, t.z], [t.x + off, t.z]]
      : [[t.x, t.z - off], [t.x + off, t.z], [t.x, t.z + off], [t.x - off, t.z]];
  }
  const seats = pts.map(([x, z]) => {
    // Bar guests face the counter (+x); everyone else faces the table.
    const tx = t.kind === 'bar' ? x + 1 : t.x, tz = t.kind === 'bar' ? z : t.z;
    return { x, z, face: Math.atan2(tx - x, tz - z) };
  });
  return { hw, hd, seats };
}
