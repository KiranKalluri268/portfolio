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
 * The surface is a globe seen from *inside*: the middle of the field is
 * furthest away and its edges wrap towards you. It is only ever that. Dragging
 * eases the wrap out towards flat and letting go lets it close back in, which
 * is what you feel when the grid moves — it used to start convex and pass
 * through flat into this at speed, and the inversion was more of an event than
 * a grid being dragged should produce.
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

/** The gap between cards, as a fraction of a card's *height*.
 *
 *  A hairline, and the same on both breakpoints. The field is one surface cut
 *  into cells rather than a scattering of cards, so the gap is the width of the
 *  cut and nothing more — at the 0.22 this used to be, every card was an object
 *  floating on black with its own glow, and the surface they were all supposed
 *  to be lying on could not be seen at all. */
export const GAP_RATIO = 0.02;
export const GAP_RATIO_NARROW = 0.02;

/** Centre-to-centre spacing, in pixels, on each axis.
 *
 * One gap, used both ways. Taking it as a fraction of each axis separately —
 * a share of the width between columns and of the height between rows — opens
 * a much wider channel between the columns than between the rows, because the
 * cards are far wider than they are tall. The height is what the gap is
 * measured against, so the rows keep the spacing they had and the columns come
 * in to meet them.
 *
 * Returned from one function because the layout and the drag mapping both need
 * it and both need the same answer; reading a size from two places is what once
 * made a phone's cards travel at a different rate from the finger. */
export function pitchFor(cardWidth: number, cardHeight: number, narrow: boolean) {
  const gap = cardHeight * (narrow ? GAP_RATIO_NARROW : GAP_RATIO);
  return { x: cardWidth + gap, y: cardHeight + gap, gap };
}

/** How far the rim of the screen stands in front of the middle at a standstill,
 *  as a fraction of the camera's distance. Negative is concave: the middle of
 *  the field furthest away, its edges wrapping towards you.
 *
 *  A *sag*, not a curvature. Curvature is per-pixel, so one number bent a phone
 *  and a desktop by completely different amounts — and once the cells grew to
 *  the size the design asks for, the old 0.0026 wrapped the field into a ball
 *  hanging in the middle of a desktop screen with black all around it, rather
 *  than a surface filling the frame. Said as a share of the depth the camera
 *  already has, the bow across the screen is the same shape on every screen and
 *  the cell size can change without re-fitting it.
 *
 *  Its magnitude has a ceiling in `zLimitFor`, which is where the surface stops
 *  curving: past that the rim of the screen would sit beyond the radius the
 *  curve stops at, and the field would go flat at the edges just where it
 *  should be bending hardest. */
export const REST_SAG = -0.34;

/** The sag at full speed. Still concave, only flatter: the wrap eases out as
 *  the field is dragged and closes back in as it settles.
 *
 *  Negative, and that is the whole rule — the surface never reaches flat and
 *  never turns inside out. */
export const MOVING_SAG = -0.14;

/** Turns a sag into a curvature, given the camera's distance and how far it is
 *  from the middle of the screen to its corner. Both in pixels, which is what
 *  one world unit is here. */
export function curvatureUnit(cameraDistance: number, halfDiagonal: number) {
  if (halfDiagonal <= 0) return 0;
  return (2 * cameraDistance) / (halfDiagonal * halfDiagonal);
}

/** The curvatures those sags come out as on a given screen. */
export const REST_CURVATURE = (unit: number) => REST_SAG * unit;
export const MOVING_CURVATURE = (unit: number) => MOVING_SAG * unit;

/** Speed, in cells per second, at which the dome reaches full curvature. The
 *  grid's own physics is already in cells per second and framerate-independent,
 *  so nothing has to be corrected for refresh rate here. */
export const FULL_CURVATURE_SPEED = 6;

/** How far the dome's peak trails behind the drag at full speed, in cells.
 *  Leaning it away from the direction of travel is what makes the field read as
 *  being pulled rather than simply inflating. */
export const MAX_LEAN = 1.15;

/** Curvature for a given speed on a given screen: the full wrap at a
 *  standstill, easing out towards the flatter moving shape as the grid is
 *  dragged and never past it however hard it is thrown. Concave throughout.
 *  `unit` comes from `curvatureUnit`. */
export function curvatureFor(speed: number, unit: number) {
  const reach = Math.min(1, speed / FULL_CURVATURE_SPEED);
  return (REST_SAG + (MOVING_SAG - REST_SAG) * reach) * unit;
}

/** How far the surface may travel along z.
 *
 * The paraboloid grows without bound and the surface is concave everywhere, so
 * it grows in the one direction that has somewhere it cannot go past: towards
 * the lens. Left alone, a cell far enough out would reach the camera and turn
 * inside out. Held to somewhat over half the way there — far enough that the
 * radius the curve stops at stays a third clear of the screen's own corner at
 * the sags above, so the bend is still bending everywhere anyone can see it.
 *
 * This used to be two limits chosen by the sign of the curvature, the convex
 * side left far looser because falling away is harmless. With the field concave
 * at every speed there is no convex side left to loosen. */
export function zLimitFor(cameraDistance: number) {
  return cameraDistance * 0.6;
}

/** The radius past which the surface stops curving, so `zLimitFor` is never
 *  exceeded. Clamping the radius rather than z keeps the surface's slope
 *  honest — a clamped z would leave a crease where the two disagreed. */
export function radiusLimitFor(curvature: number, cameraDistance: number) {
  if (curvature === 0) return Number.MAX_VALUE;
  return Math.sqrt((2 * zLimitFor(cameraDistance)) / Math.abs(curvature));
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

/* Every cell is drawn at its full size, and there is deliberately no function
 * here that scales one down for sitting near the rim.
 *
 * There used to be: `sizeAt` graded a card between a large and a small size by
 * how far out it sat, and swapped the two over as the field inverted. That
 * cannot coexist with a continuous surface. Two neighbouring cells share an
 * edge, and if one is drawn at 0.5 and the other at 0.6 that shared edge is two
 * different lengths — the lattice tears along every seam, which is precisely
 * the thing the sketch draws as unbroken. The fall-off is the camera's instead:
 * a cell near the rim is smaller because the sphere has carried it further
 * away, which is the same effect arrived at honestly.
 */

/** Where a cell sits on the flat surface, in pixels from the focus. */
export function surfacePoint(cell: Cell, focus: Vec, pitch: { x: number; y: number }): Vec {
  const point = latticePoint(cell);
  return { x: (point.x - focus.x) * pitch.x, y: -(point.y - focus.y) * pitch.y };
}
