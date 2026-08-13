/** Geometry for the projects grid as a surface in space.
 *
 * The grid used to be a lens: an infinite lattice whose cards shrank by a fixed
 * ratio per ring, with the spacing being the integral of that fall-off so the
 * whole field converged into a finite disc. That was a way of faking depth in
 * two dimensions, and it cost a composited DOM layer per card to draw.
 *
 * This is the same lattice held in three. The cards are evenly spaced and the
 * size fall-off is the camera's, not a function — a card further away is
 * smaller because it is further away. At rest the surface is flat. As the grid
 * is dragged it swells into a dome, and the faster it moves the tighter that
 * dome is.
 *
 * The lattice helpers themselves are shared with `grid-math.ts`, which still
 * owns what a cell is and which project sits in it.
 */

import { ROW_STAGGER, type Cell, type Vec, latticePoint } from "./grid-math";

/** Centre-to-centre spacing, in card widths. Above 1 so cards have air around
 *  them rather than touching. */
export const PITCH = 1.22;

/** The dome's curvature at full speed, as 1/px. The surface is a paraboloid,
 *  which is a sphere to well past the angles reached here and costs two
 *  multiplies rather than a trig call per card per frame. */
export const MAX_CURVATURE = 0.0013;

/** Speed, in cells per second, at which the dome reaches full curvature. The
 *  grid's own physics is already in cells per second and framerate-independent,
 *  so nothing has to be corrected for refresh rate here. */
export const FULL_CURVATURE_SPEED = 6;

/** How far the dome's peak trails behind the drag at full speed, in cells.
 *  Leaning it away from the direction of travel is what makes the field read as
 *  being pulled rather than simply inflating. */
export const MAX_LEAN = 1.15;

/** Curvature for a given speed: nothing at rest, and never past the ceiling
 *  however hard the grid is thrown. */
export function curvatureFor(speed: number) {
  return MAX_CURVATURE * Math.min(1, speed / FULL_CURVATURE_SPEED);
}

/** Where the dome's peak sits, in cells, given the velocity that is moving the
 *  grid. Opposite the travel, so the surface trails the finger. */
export function leanFor(velocity: Vec): Vec {
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed === 0) return { x: 0, y: 0 };
  const amount = MAX_LEAN * Math.min(1, speed / FULL_CURVATURE_SPEED);
  return { x: (-velocity.x / speed) * amount, y: (-velocity.y / speed) * amount };
}

export interface Displacement {
  /** Towards the camera is positive, and the peak of the dome is zero. */
  z: number;
  tiltX: number;
  tiltY: number;
}

/** The dome's displacement and surface tilt at a point, measured in pixels from
 *  its peak.
 *
 * `z` is negative everywhere but the peak: the middle of the dome is nearest
 * and everything falls away from it, which is what gives the swell. The tilts
 * are the surface's own slope there, so a card sits on the dome rather than
 * hanging in front of it. */
export function domeAt(dx: number, dy: number, curvature: number): Displacement {
  if (curvature === 0) return { z: 0, tiltX: 0, tiltY: 0 };
  return {
    z: (-(dx * dx + dy * dy) * curvature) / 2,
    // The slope of that surface: d/dy for the tilt about x, d/dx for the tilt
    // about y. Signed so a card's face turns to follow the dome outwards.
    tiltX: dy * curvature,
    tiltY: -dx * curvature,
  };
}

/** Cells covering a rectangular window around the focus.
 *
 * The lens made this a disc, because its fall-off meant everything past a
 * radius collapsed onto a horizon. An even lattice has no horizon, so the
 * window is simply what reaches the edges of the screen with a margin for the
 * dome pushing cards around. */
export function visibleCells(focus: Vec, halfCols: number, halfRows: number): Cell[] {
  const cells: Cell[] = [];
  const rowFrom = Math.floor(focus.y - halfRows);
  const rowTo = Math.ceil(focus.y + halfRows);
  for (let row = rowFrom; row <= rowTo; row++) {
    // Odd rows are shifted half a cell, so the column window shifts with them.
    const shift = Math.abs(row % 2) === 1 ? ROW_STAGGER : 0;
    const colFrom = Math.floor(focus.x - halfCols - shift);
    const colTo = Math.ceil(focus.x + halfCols - shift);
    for (let col = colFrom; col <= colTo; col++) {
      cells.push({ col, row });
    }
  }
  return cells;
}

/** Where a cell sits on the flat surface, in pixels from the focus. */
export function surfacePoint(cell: Cell, focus: Vec, pitch: { x: number; y: number }): Vec {
  const point = latticePoint(cell);
  return { x: (point.x - focus.x) * pitch.x, y: -(point.y - focus.y) * pitch.y };
}
