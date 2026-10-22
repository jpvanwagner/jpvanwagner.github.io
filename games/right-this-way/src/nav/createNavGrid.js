/* Builds the facility NavGrid from layout data. */
import { NavGrid } from './NavGrid.js';
import { NAV_BOUNDS, DOORS, FURNITURE } from '../data/layout.js';
import { wallPieces, doorRect } from '../data/layoutGeometry.js';

export function createNavGrid() {
  return new NavGrid({
    bounds: NAV_BOUNDS,
    obstacles: [...wallPieces(), ...FURNITURE.filter((f) => f.block)],
    doors: DOORS.map((d) => ({ id: d.id, rect: doorRect(d) })),
    cell: 0.5,
    inflate: 0.8,
  });
}
