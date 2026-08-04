import { describe, expect, it } from "vitest";

import {
  CULL_DISTANCE,
  FOCUS_SCALE,
  PITCH,
  RING_RATIO,
  cellFocus,
  horizon,
  latticePoint,
  nearestCell,
  opacityAt,
  place,
  projectIndexFor,
  ringDistance,
  scaleAt,
  visibleCells,
  warp,
} from "../projects/grid-math";

const SQUARE = { x: 1, y: 1 };

describe("latticePoint", () => {
  it("shifts odd rows half a cell so no two columns line up", () => {
    expect(latticePoint({ col: 2, row: 0 })).toEqual({ x: 2, y: 0 });
    expect(latticePoint({ col: 2, row: 1 })).toEqual({ x: 2.5, y: 1 });
    expect(latticePoint({ col: 2, row: 2 })).toEqual({ x: 2, y: 2 });
  });

  it("staggers rows below the origin too", () => {
    expect(latticePoint({ col: 0, row: -1 }).x).toBe(0.5);
  });
});

describe("scale and opacity", () => {
  it("puts the focused card at half the viewport", () => {
    expect(scaleAt(0)).toBe(FOCUS_SCALE);
    expect(opacityAt(0)).toBe(1);
  });

  it("falls by the ring ratio each step out", () => {
    expect(scaleAt(1)).toBeCloseTo(FOCUS_SCALE * RING_RATIO);
    expect(scaleAt(2)).toBeCloseTo(FOCUS_SCALE * RING_RATIO ** 2);
    expect(opacityAt(1)).toBeCloseTo(RING_RATIO);
  });

  it("is continuous between rings, which is what makes a drag smooth", () => {
    // A card halfway out is genuinely halfway, not snapped to either ring.
    const half = scaleAt(1.5);
    expect(half).toBeLessThan(scaleAt(1));
    expect(half).toBeGreaterThan(scaleAt(2));
  });
});

describe("ringDistance", () => {
  it("treats a diagonal neighbour as the same ring as an orthogonal one", () => {
    expect(ringDistance({ x: 1, y: 0 })).toBe(1);
    expect(ringDistance({ x: 1, y: 1 })).toBe(1);
    expect(ringDistance({ x: 0, y: -1 })).toBe(1);
    expect(ringDistance({ x: 2, y: 1 })).toBe(2);
  });
});

describe("warp", () => {
  it("leaves the focused card at the centre", () => {
    expect(warp(0, PITCH)).toBe(0);
  });

  it("keeps its sign, so cards land on the side they belong", () => {
    expect(warp(2, PITCH)).toBeGreaterThan(0);
    expect(warp(-2, PITCH)).toBeLessThan(0);
    expect(warp(-2, PITCH)).toBeCloseTo(-warp(2, PITCH));
  });

  it("spaces each step by the size of the cards there", () => {
    // The gap between consecutive rings should shrink by the ring ratio, which
    // is what stops the grid gapping as it compresses.
    const first = warp(1, PITCH) - warp(0, PITCH);
    const second = warp(2, PITCH) - warp(1, PITCH);
    const third = warp(3, PITCH) - warp(2, PITCH);
    expect(second / first).toBeCloseTo(RING_RATIO, 5);
    expect(third / second).toBeCloseTo(RING_RATIO, 5);
  });

  it("converges, so the endless grid fits in a finite disc", () => {
    const limit = horizon(PITCH);
    // Approached from below and never passed. Checked at a distance where the
    // ratio has not yet underflowed to zero, or the two are simply equal.
    expect(warp(8, PITCH)).toBeLessThan(limit);
    expect(warp(50, PITCH)).toBeCloseTo(limit, 6);
    // Deliberately not pinned to the current constants — only that the horizon
    // lands somewhere a visitor can actually see, rather than off in the void.
    expect(limit).toBeGreaterThan(0.1);
    expect(limit).toBeLessThan(2);
  });
});

describe("place", () => {
  it("centres whatever the focus is sitting on", () => {
    const p = place({ col: 3, row: 0 }, { x: 3, y: 0 }, SQUARE);
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
    expect(p.scale).toBe(FOCUS_SCALE);
    expect(p.opacity).toBe(1);
  });

  it("grows a card smoothly as the focus moves onto it", () => {
    const approach = [0, 0.25, 0.5, 0.75, 1].map(
      (t) => place({ col: 1, row: 0 }, { x: t, y: 0 }, SQUARE).scale,
    );
    for (let i = 1; i < approach.length; i++) {
      expect(approach[i]).toBeGreaterThan(approach[i - 1]);
    }
    expect(approach[approach.length - 1]).toBe(FOCUS_SCALE);
  });

  it("never lets neighbouring cards overlap", () => {
    // Two cards side by side: the gap between their centres must exceed half
    // of each, or they would collide as the grid compresses.
    for (let step = 0; step < 4; step++) {
      const near = place({ col: step, row: 0 }, { x: 0, y: 0 }, SQUARE);
      const far = place({ col: step + 1, row: 0 }, { x: 0, y: 0 }, SQUARE);
      const gap = far.x - near.x;
      const halves = (near.scale + far.scale) / 2;
      expect(gap).toBeGreaterThan(halves);
    }
  });
});

describe("visibleCells", () => {
  it("returns a bounded set from an unbounded lattice", () => {
    const cells = visibleCells({ x: 0, y: 0 });
    expect(cells.length).toBeGreaterThan(20);
    expect(cells.length).toBeLessThan(200);
  });

  it("drops everything past the horizon", () => {
    for (const cell of visibleCells({ x: 0, y: 0 })) {
      const point = latticePoint(cell);
      expect(ringDistance({ x: point.x, y: point.y })).toBeLessThanOrEqual(CULL_DISTANCE);
    }
  });

  it("follows the focus rather than sitting at the origin", () => {
    const far = visibleCells({ x: 40, y: -25 });
    expect(far.length).toBeGreaterThan(20);
    expect(far.every((cell) => cell.col > 20)).toBe(true);
    expect(far.every((cell) => cell.row < 0)).toBe(true);
  });
});

describe("projectIndexFor", () => {
  it("stays inside the project list however far the grid is dragged", () => {
    for (const cell of [
      { col: 0, row: 0 },
      { col: 999, row: -999 },
      { col: -7, row: 4 },
    ]) {
      const index = projectIndexFor(cell, 10);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(10);
    }
  });

  it("does not stack the same project in a column", () => {
    // The row stride is what breaks up the repeat; without it every card in a
    // column would be the same project.
    const column = [0, 1, 2, 3].map((row) => projectIndexFor({ col: 5, row }, 10));
    expect(new Set(column).size).toBe(4);
  });

  it("copes with an empty list rather than dividing by zero", () => {
    expect(projectIndexFor({ col: 3, row: 2 }, 0)).toBe(0);
  });
});

describe("nearestCell", () => {
  it("rounds to the cell under the focus, allowing for the stagger", () => {
    expect(nearestCell({ x: 2.1, y: 0.05 })).toEqual({ col: 2, row: 0 });
    // Row 1 is shifted half a cell, so 2.5 is the centre of column 2 there.
    expect(nearestCell({ x: 2.5, y: 1 })).toEqual({ col: 2, row: 1 });
  });

  it("round-trips with the focus a cell corresponds to", () => {
    for (const cell of [
      { col: 0, row: 0 },
      { col: 4, row: 3 },
      { col: -2, row: -5 },
    ]) {
      expect(nearestCell(cellFocus(cell))).toEqual(cell);
    }
  });
});
