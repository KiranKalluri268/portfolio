/** Geometry for the projects grid.
 *
 * An endless staggered lattice of cards seen through a lens: whatever sits
 * under the focus point is large and opaque, and everything falls away from it
 * by a fixed ratio per ring.
 *
 * The one idea that makes the whole thing work is that a ring is **not** a
 * state a card is in. Scale and opacity are continuous functions of how far a
 * card is from the focus, and the focus moves continuously as the grid is
 * dragged. A card halfway between the second and third ring is simply at
 * distance 2.5. Nothing has to animate between layers, because there are no
 * layers to animate between — which is also why the movement stays smooth at
 * any speed.
 *
 * A consequence worth knowing: because size falls off geometrically, so does
 * the spacing, and that sum converges. The whole infinite grid therefore maps
 * into a finite disc a little over one viewport wide, with the far rings piling
 * up at a horizon. Cards past `CULL_DISTANCE` are a few pixels across and are
 * not rendered at all.
 */

/** The focused card, as a fraction of the viewport's width and height.
 *
 * Not just a size: it sets how much of the grid is on screen. The horizon the
 * rings pile up against is this times the pitch times the summed fall-off (see
 * `horizon`), so a smaller focus card brings more rings into view. The card's own
 * dimensions in CSS are driven from this too, through a custom property, so the
 * two cannot fall out of step. */
export const FOCUS_SCALE = 0.4;

/** The first step out is the steep one: the ring around the focused card is
 *  40% of it, which is what makes the middle card read as singled out. */
export const FIRST_RING_RATIO = 0.4;

/** Every step after that is gentler — each ring 60% of the one inside it — so
 *  the outer rings stay legible for longer instead of collapsing to specks the
 *  moment they leave the centre. */
export const LATER_RING_RATIO = 0.6;

/** How large a card at `distance` is against the focused one.
 *
 * Two ratios, not one: the first ring drops by FIRST_RING_RATIO and everything
 * beyond it by LATER_RING_RATIO. Still continuous — the exponent is the real
 * distance, not a ring index — so a card crossing between rings grows smoothly
 * rather than stepping. */
export function ringFalloff(distance: number) {
  const near = Math.min(Math.max(distance, 0), 1);
  const far = Math.max(distance - 1, 0);
  return FIRST_RING_RATIO ** near * LATER_RING_RATIO ** far;
}

/** Centre-to-centre spacing at the focus, in card widths. Above 1 so cards in
 *  the middle have air around them rather than touching. */
export const PITCH = 1.16;

/** The smallest a card may be, against the focused one, before it is dropped.
 *  Below this it is a few pixels on a phone: invisible, but still mounted and
 *  transformed every frame. */
const MIN_VISIBLE_FRACTION = 0.045;

/** Rings past this are not rendered. Derived from the ring ratio rather than
 *  fixed, so it follows if that changes — a steeper fall-off reaches the
 *  invisible sooner and should stop sooner. Capped so a gentle ratio cannot
 *  mount hundreds of cells. */
export const CULL_DISTANCE = Math.min(
  4.2,
  1 + Math.log(MIN_VISIBLE_FRACTION / FIRST_RING_RATIO) / Math.log(LATER_RING_RATIO),
);

/** Odd rows are shifted half a cell, so the grid reads as a field rather than
 *  a table and no two columns ever line up all the way down. */
export const ROW_STAGGER = 0.5;

export interface Cell {
  col: number;
  row: number;
}

export interface Vec {
  x: number;
  y: number;
}

/** Where a cell sits in lattice space, before the lens is applied. */
export function latticePoint({ col, row }: Cell): Vec {
  return { x: col + (Math.abs(row % 2) === 1 ? ROW_STAGGER : 0), y: row };
}

/** Distance used for scale and opacity.
 *
 * Chebyshev rather than Euclidean, so a ring is the square of cells around the
 * focus — the shape the eye reads as "the ones next to it" — and a diagonal
 * neighbour is treated as the same ring as an orthogonal one. */
export function ringDistance(offset: Vec) {
  return Math.max(Math.abs(offset.x), Math.abs(offset.y));
}

export function scaleAt(distance: number) {
  return FOCUS_SCALE * ringFalloff(distance);
}

export function opacityAt(distance: number) {
  return ringFalloff(distance);
}

/** Screen distance to a card `steps` cells away along one axis.
 *
 * The integral of the scale function: each step out is spaced by the size of
 * the cards there, so the gap between neighbours stays proportional to them and
 * the grid neither overlaps nor gaps as it compresses. It converges — the limit
 * is the horizon the far rings pile up against. */
const NEAR_DECAY = -Math.log(FIRST_RING_RATIO);
const FAR_DECAY = -Math.log(LATER_RING_RATIO);
/** The area under the first ring's steeper fall-off, done once. */
const NEAR_SPAN = (1 - FIRST_RING_RATIO) / NEAR_DECAY;

/** The integral of `ringFalloff` from 0 to `t` — how far out a card `t` cells
 *  from the focus lands, in units of the focused card's width. Piecewise,
 *  because the fall-off is. */
function warpSpan(t: number) {
  if (t <= 1) return (1 - FIRST_RING_RATIO ** t) / NEAR_DECAY;
  return NEAR_SPAN + (FIRST_RING_RATIO * (1 - LATER_RING_RATIO ** (t - 1))) / FAR_DECAY;
}

export function warp(steps: number, pitch: number) {
  return pitch * FOCUS_SCALE * warpSpan(Math.abs(steps)) * Math.sign(steps);
}

/** The horizon: the screen distance no card ever passes, in viewport units. */
export function horizon(pitch: number) {
  return pitch * FOCUS_SCALE * (NEAR_SPAN + FIRST_RING_RATIO / FAR_DECAY);
}

export interface Placement {
  /** Centre offset from the middle of the viewport, in viewport units. */
  x: number;
  y: number;
  scale: number;
  opacity: number;
  distance: number;
}

/** Where a cell lands on screen, given where the focus currently is.
 *
 * The warp is applied per axis rather than radially. Radially, a lattice bends
 * into a bowl and diagonal neighbours crowd; per axis, rows stay rows and the
 * spacing along each one stays honest. */
export function place(cell: Cell, focus: Vec, aspect: { x: number; y: number }): Placement {
  const point = latticePoint(cell);
  const offset = { x: point.x - focus.x, y: point.y - focus.y };
  const distance = ringDistance(offset);
  return {
    x: warp(offset.x, PITCH * aspect.x),
    y: warp(offset.y, PITCH * aspect.y),
    scale: scaleAt(distance),
    opacity: opacityAt(distance),
    distance,
  };
}

/** Cells worth rendering for a given focus. Everything beyond the cull radius
 *  is too small to see, and there are infinitely many of them. */
export function visibleCells(focus: Vec, cull: number = CULL_DISTANCE): Cell[] {
  const cells: Cell[] = [];
  const rowFrom = Math.floor(focus.y - cull);
  const rowTo = Math.ceil(focus.y + cull);
  for (let row = rowFrom; row <= rowTo; row++) {
    // The stagger shifts odd rows, so the column window shifts with them.
    const shift = Math.abs(row % 2) === 1 ? ROW_STAGGER : 0;
    const colFrom = Math.floor(focus.x - cull - shift);
    const colTo = Math.ceil(focus.x + cull - shift);
    for (let col = colFrom; col <= colTo; col++) {
      const point = latticePoint({ col, row });
      if (ringDistance({ x: point.x - focus.x, y: point.y - focus.y }) <= cull) {
        cells.push({ col, row });
      }
    }
  }
  return cells;
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

/** The cell nearest a focus point, for snapping and for keyboard moves.
 *
 * All four candidates around the point are compared rather than rounding the
 * row and then the column. Rounding in sequence is wrong here: the row's parity
 * decides the half-cell stagger, so crossing a row boundary shifts the whole
 * lattice sideways and the "nearest" column jumps with it. Snapping to that
 * chased a target that moved as it was approached, and the grid drifted instead
 * of coming to rest. */
export function nearestCell(focus: Vec): Cell {
  let best: Cell = { col: Math.round(focus.x), row: Math.round(focus.y) };
  let bestDistance = Infinity;
  for (const row of [Math.floor(focus.y), Math.ceil(focus.y)]) {
    const shift = Math.abs(row % 2) === 1 ? ROW_STAGGER : 0;
    for (const col of [Math.floor(focus.x - shift), Math.ceil(focus.x - shift)]) {
      const point = latticePoint({ col, row });
      const distance = Math.hypot(point.x - focus.x, point.y - focus.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { col, row };
      }
    }
  }
  return best;
}

export function cellFocus(cell: Cell): Vec {
  return latticePoint(cell);
}
