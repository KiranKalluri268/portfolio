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
 * This module replaced `grid-math.ts`, which held the lens: ring ratios, a
 * fall-off function, and the warp integral that made an endless field converge
 * onto a horizon. None of that has anything to describe once the depth is
 * real, so it went with the DOM grid it was written for.
 */

export interface Cell {
  col: number;
  row: number;
}

export interface Vec {
  x: number;
  y: number;
}

/** Where a cell sits in lattice space.
 *
 * Squarely on the grid: no half-cell offset on odd rows. The old lattice
 * staggered them, which reads as brickwork — rows that never line up into
 * columns. A sphere wants a true grid, so that its rows and its columns each
 * bend into one continuous curve rather than into a zigzag. */
export function latticePoint({ col, row }: Cell): Vec {
  return { x: col, y: row };
}

/** The cell nearest a point. With no stagger the row's parity no longer shifts
 *  the lattice sideways, so this is a plain rounding — the four-candidate
 *  search the staggered lattice needed has nothing left to disambiguate. */
export function nearestCell(focus: Vec): Cell {
  return { col: Math.round(focus.x), row: Math.round(focus.y) };
}

/** Which project a cell shows.
 *
 * The lattice is endless and the projects are not, so it tiles. Offsetting each
 * row by a stride that shares no factor with the count keeps a project from
 * sitting directly above itself, which is what would make the repeat obvious. */
export function projectIndexFor({ col, row }: Cell, count: number, stride = 3) {
  if (count <= 0) return 0;
  const raw = col + row * stride;
  return ((raw % count) + count) % count;
}

export function cellFocus(cell: Cell): Vec {
  return latticePoint(cell);
}

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
  const colFrom = Math.floor(focus.x - halfCols);
  const colTo = Math.ceil(focus.x + halfCols);
  for (let row = rowFrom; row <= rowTo; row++) {
    for (let col = colFrom; col <= colTo; col++) {
      cells.push({ col, row });
    }
  }
  return cells;
}

/** The two sizes a card is ever drawn at, as a fraction of its full width.
 *
 * There is no third size and no falloff amount: a card is large or it is
 * small, and where it sits between them is the only thing that varies. At rest
 * the middle of the field is LARGE and the rim is SMALL. At full speed the two
 * swap outright — the middle shrinks to exactly the size the rim cards had at
 * rest, and the rim grows to the size the middle one had. */
export const SIZE_LARGE = 1;
export const SIZE_SMALL = 0.5;

/** How far along from resting to full speed, from the curvature actually being
 *  drawn rather than from the raw velocity.
 *
 * The curvature is eased, so reading the speed directly would let the sizes run
 * ahead of the shape and arrive before it. Taken from the curvature they cannot
 * disagree. */
export function reachFromCurvature(curvature: number) {
  const span = MOVING_CURVATURE - REST_CURVATURE;
  if (span === 0) return 0;
  return Math.max(0, Math.min(1, (curvature - REST_CURVATURE) / span));
}

/** A card's size, given how far out it sits and how far the field has turned
 *  itself inside out. */
export function sizeAt(radius: number, span: number, reach: number) {
  if (span <= 0) return SIZE_LARGE;
  const radial = Math.min(1, radius / span);
  const centre = SIZE_LARGE + (SIZE_SMALL - SIZE_LARGE) * reach;
  const rim = SIZE_SMALL + (SIZE_LARGE - SIZE_SMALL) * reach;
  return centre + (rim - centre) * radial;
}

/** Where a cell sits on the flat surface, in pixels from the focus. */
export function surfacePoint(cell: Cell, focus: Vec, pitch: { x: number; y: number }): Vec {
  const point = latticePoint(cell);
  return { x: (point.x - focus.x) * pitch.x, y: -(point.y - focus.y) * pitch.y };
}
