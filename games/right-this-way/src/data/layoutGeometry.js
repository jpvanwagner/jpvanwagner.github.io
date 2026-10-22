/*
 * Derived geometry shared by the renderer and the nav grid:
 * wall pieces with door gaps cut out, and door orientation.
 */
import { WALLS, DOORS, WALL_THICKNESS } from './layout.js';

const isHorizontal = (w) => w.z0 === w.z1;

/** Which way a door's wall runs: 'h' (along x) or 'v' (along z). */
export function doorAxis(door, walls = WALLS) {
  const onH = walls.some(
    (w) => isHorizontal(w) && w.z0 === door.z && door.x >= Math.min(w.x0, w.x1) && door.x <= Math.max(w.x0, w.x1),
  );
  return onH ? 'h' : 'v';
}

/** Footprint rectangle of the door opening (spans the wall thickness). */
export function doorRect(door, thickness = WALL_THICKNESS) {
  const half = door.width / 2;
  const t = thickness / 2;
  return doorAxis(door) === 'h'
    ? { x0: door.x - half, x1: door.x + half, z0: door.z - t, z1: door.z + t }
    : { x0: door.x - t, x1: door.x + t, z0: door.z - half, z1: door.z + half };
}

/** Splits every wall segment around the doors lying on it. Returns rectangles. */
export function wallPieces(walls = WALLS, doors = DOORS, thickness = WALL_THICKNESS) {
  const t = thickness / 2;
  const pieces = [];
  for (const w of walls) {
    const horizontal = isHorizontal(w);
    const a0 = horizontal ? Math.min(w.x0, w.x1) : Math.min(w.z0, w.z1);
    const a1 = horizontal ? Math.max(w.x0, w.x1) : Math.max(w.z0, w.z1);
    const fixed = horizontal ? w.z0 : w.x0;

    const gaps = doors
      .filter((d) => (horizontal ? d.z === fixed && d.x > a0 && d.x < a1 : d.x === fixed && d.z > a0 && d.z < a1))
      .map((d) => {
        const c = horizontal ? d.x : d.z;
        return [c - d.width / 2, c + d.width / 2];
      })
      .sort((p, q) => p[0] - q[0]);

    let cursor = a0 - t; // extend ends so corners overlap cleanly
    const end = a1 + t;
    for (const [g0, g1] of [...gaps, [end, end]]) {
      if (g0 - cursor > 0.01) {
        pieces.push(
          horizontal
            ? { x0: cursor, x1: g0, z0: fixed - t, z1: fixed + t }
            : { x0: fixed - t, x1: fixed + t, z0: cursor, z1: g0 },
        );
      }
      cursor = g1;
    }
  }
  return pieces;
}
