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

/** The focused card, as a fraction of the viewport. */
export const FOCUS_SCALE = 0.5;

/** How much smaller and fainter each ring is than the one inside it. */
export const RING_RATIO = 0.6;

/** Centre-to-centre spacing at the focus, in card widths. Above 1 so cards in
 *  the middle have air around them rather than touching. */
export const PITCH = 1.16;

/** Rings past this are sub-pixel and never rendered. At 0.6 per ring a card
 *  here is already under 7% of the viewport. */
export const CULL_DISTANCE = 4.2;

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
  return FOCUS_SCALE * RING_RATIO ** distance;
}

export function opacityAt(distance: number) {
  return RING_RATIO ** distance;
}

/** Screen distance to a card `steps` cells away along one axis.
 *
 * The integral of the scale function: each step out is spaced by the size of
 * the cards there, so the gap between neighbours stays proportional to them and
 * the grid neither overlaps nor gaps as it compresses. It converges — the limit
 * is the horizon the far rings pile up against. */
export function warp(steps: number, pitch: number) {
  const decay = -Math.log(RING_RATIO);
  return (pitch * FOCUS_SCALE * (1 - RING_RATIO ** Math.abs(steps))) / decay * Math.sign(steps);
}

/** The horizon: the screen distance no card ever passes, in viewport units. */
export function horizon(pitch: number) {
  return (pitch * FOCUS_SCALE) / -Math.log(RING_RATIO);
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
