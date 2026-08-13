/** Geometry for the projects grid as a surface in space.
 *
 * The grid used to be a lens: an infinite lattice whose cards shrank by a fixed
 * ratio per ring, with the spacing being the integral of that fall-off so the
 * whole field converged into a finite disc. That was a way of faking depth in
 * two dimensions, and it cost a composited DOM layer per card to draw.
 *
 * This is the same lattice held in three. The cards are evenly spaced and the
 * size fall-off is the camera's, not a function — a card further away is
 * smaller because it is further away.
 *
 * At rest the surface is a globe seen from outside: it bulges towards you and
 * its edges fall away. Dragging inverts it — through flat, and out the other
 * side into the view from inside the sphere, where the edges wrap towards you.
 * The inversion is the thing you feel when the grid starts moving.
 *
 * The lattice helpers themselves are shared with `grid-math.ts`, which still
 * owns what a cell is and which project sits in it.
 */

import { ROW_STAGGER, type Cell, type Vec, latticePoint } from "./grid-math";

/** Centre-to-centre spacing, in card widths. Above 1 so cards have air around
 *  them rather than touching. */
export const PITCH = 1.22;

/** The curvature at a standstill, as 1/px. Positive is convex: the middle of
 *  the field nearest, its edges falling away — a globe seen from outside. */
export const REST_CURVATURE = 0.0026;

/** The curvature at full speed. Negative is concave: the edges wrap towards
 *  you and the middle is furthest — the sphere seen from inside.
 *
 *  Smaller in magnitude than the resting one on purpose. Concave brings cards
 *  towards the camera, and unlike falling away that has somewhere it cannot go
 *  past; see `zLimitFor`. */
export const MOVING_CURVATURE = -0.0018;

/** Speed, in cells per second, at which the dome reaches full curvature. The
 *  grid's own physics is already in cells per second and framerate-independent,
 *  so nothing has to be corrected for refresh rate here. */
export const FULL_CURVATURE_SPEED = 6;

/** How far the dome's peak trails behind the drag at full speed, in cells.
 *  Leaning it away from the direction of travel is what makes the field read as
 *  being pulled rather than simply inflating. */
export const MAX_LEAN = 1.15;

/** Curvature for a given speed: the resting dome at a standstill, tightening
 *  towards the ceiling as the grid moves and never past it however hard it is
 *  thrown. */
export function curvatureFor(speed: number) {
  const reach = Math.min(1, speed / FULL_CURVATURE_SPEED);
  return REST_CURVATURE + (MOVING_CURVATURE - REST_CURVATURE) * reach;
}

/** How far the surface may travel along z, given which way it is curved.
 *
 * Falling away from the camera is harmless — a card just gets small. Coming
 * towards it is not: the paraboloid grows without bound, and at the curvatures
 * that read well a card at the corner of the screen would reach the camera and
 * turn inside out. So the concave side is held to about a third of the way to
 * the lens and the convex side is left alone. */
export function zLimitFor(curvature: number, cameraDistance: number) {
  return cameraDistance * (curvature < 0 ? 0.45 : 2.5);
}

/** The radius past which the surface stops curving, so `zLimitFor` is never
 *  exceeded. Clamping the radius rather than z keeps the surface's slope
 *  honest — a clamped z would leave a crease where the two disagreed. */
export function radiusLimitFor(curvature: number, cameraDistance: number) {
  if (curvature === 0) return Number.MAX_VALUE;
  return Math.sqrt((2 * zLimitFor(curvature, cameraDistance)) / Math.abs(curvature));
}

/** The surface's height at a point, in pixels from the dome's peak. Shared with
 *  the vertex shader, which runs the same arithmetic per vertex — this one is
 *  for placing a card's centre so the renderer can still sort by depth. */
export function domeHeight(dx: number, dy: number, curvature: number, radiusLimit: number) {
  const r = Math.hypot(dx, dy);
  const scale = r > 0.0001 ? Math.min(r, radiusLimit) / r : 1;
  const cx = dx * scale;
  const cy = dy * scale;
  return (-(cx * cx + cy * cy) * curvature) / 2;
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

/** How much smaller a card at the rim is than the one in the middle, at the
 *  resting curvature. Perspective alone gives some of this — a card further
 *  away is smaller — but not enough to read as a lens, so the size is graded
 *  by hand on top of it. */
export const MAX_SIZE_FALLOFF = 0.35;

/** A card's size against the one at the centre, given how far out it is and
 *  which way the surface is curved.
 *
 * At rest the middle is large and the rim small. Moving inverts the surface,
 * and this inverts with it — the rim swells and the middle shrinks — so the
 * size follows the shape rather than fighting it. */
export function sizeFalloffAt(radius: number, span: number, curvature: number) {
  if (span <= 0) return 1;
  const radial = Math.min(1, radius / span);
  // Against the resting curvature, so it is 1 at a standstill and goes
  // negative as the surface turns itself inside out.
  const direction = Math.max(-1.5, Math.min(1.5, curvature / REST_CURVATURE));
  return 1 - direction * MAX_SIZE_FALLOFF * radial;
}

/** Where a cell sits on the flat surface, in pixels from the focus. */
export function surfacePoint(cell: Cell, focus: Vec, pitch: { x: number; y: number }): Vec {
  const point = latticePoint(cell);
  return { x: (point.x - focus.x) * pitch.x, y: -(point.y - focus.y) * pitch.y };
}
