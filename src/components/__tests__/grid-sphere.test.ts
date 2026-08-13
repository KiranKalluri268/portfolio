import { describe, expect, it } from "vitest";

import {
  MOVING_CURVATURE,
  REST_CURVATURE,
  SIZE_LARGE,
  SIZE_SMALL,
  cellFocus,
  curvatureFor,
  domeHeight,
  latticePoint,
  nearestCell,
  projectIndexFor,
  radiusLimitFor,
  reachFromCurvature,
  sizeAt,
  visibleCells,
  zLimitFor,
} from "../projects/grid-sphere";

describe("latticePoint", () => {
  it("lines rows up into columns rather than staggering them", () => {
    // The old lattice offset odd rows half a cell, which read as brickwork and
    // bent the columns into a zigzag once the field was curved.
    expect(latticePoint({ col: 2, row: 0 })).toEqual({ x: 2, y: 0 });
    expect(latticePoint({ col: 2, row: 1 })).toEqual({ x: 2, y: 1 });
    expect(latticePoint({ col: 2, row: -3 })).toEqual({ x: 2, y: -3 });
  });
});

describe("nearestCell", () => {
  it("rounds to the cell under the focus", () => {
    expect(nearestCell({ x: 2.1, y: 0.05 })).toEqual({ col: 2, row: 0 });
    expect(nearestCell({ x: -1.6, y: 3.4 })).toEqual({ col: -2, row: 3 });
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

describe("curvatureFor", () => {
  it("rests convex and turns concave at speed", () => {
    expect(curvatureFor(0)).toBeCloseTo(REST_CURVATURE, 10);
    expect(curvatureFor(1000)).toBeCloseTo(MOVING_CURVATURE, 10);
  });

  it("passes through flat rather than jumping between the two", () => {
    // Somewhere in the middle the surface is momentarily a plane, which is what
    // makes the inversion read as one movement.
    const speeds = Array.from({ length: 60 }, (_, i) => i * 0.2);
    const curvatures = speeds.map(curvatureFor);
    expect(Math.min(...curvatures.map(Math.abs))).toBeLessThan(REST_CURVATURE / 8);
    expect(curvatures.some((c) => c > 0)).toBe(true);
    expect(curvatures.some((c) => c < 0)).toBe(true);
  });

  it("never goes past the ceiling however hard it is thrown", () => {
    expect(curvatureFor(1e6)).toBeCloseTo(MOVING_CURVATURE, 10);
  });
});

describe("sizeAt", () => {
  const span = 800;

  it("puts the large card in the middle and the small one at the rim, at rest", () => {
    expect(sizeAt(0, span, 0)).toBeCloseTo(SIZE_LARGE);
    expect(sizeAt(span, span, 0)).toBeCloseTo(SIZE_SMALL);
  });

  it("swaps them outright at full speed", () => {
    expect(sizeAt(0, span, 1)).toBeCloseTo(SIZE_SMALL);
    expect(sizeAt(span, span, 1)).toBeCloseTo(SIZE_LARGE);
  });

  it("holds the two sizes as the only ones, whatever the reach", () => {
    for (const reach of [0, 0.25, 0.5, 0.75, 1]) {
      for (const radius of [0, 200, 500, span, span * 3]) {
        const size = sizeAt(radius, span, reach);
        expect(size).toBeGreaterThanOrEqual(SIZE_SMALL - 1e-9);
        expect(size).toBeLessThanOrEqual(SIZE_LARGE + 1e-9);
      }
    }
  });

  it("stops growing past the rim rather than running away", () => {
    expect(sizeAt(span * 5, span, 1)).toBeCloseTo(sizeAt(span, span, 1));
  });
});

describe("reachFromCurvature", () => {
  it("reads nothing at rest and everything at the moving curvature", () => {
    expect(reachFromCurvature(REST_CURVATURE)).toBeCloseTo(0);
    expect(reachFromCurvature(MOVING_CURVATURE)).toBeCloseTo(1);
  });

  it("is the inverse of curvatureFor, so the sizes cannot lead the shape", () => {
    for (const speed of [0, 1, 2.5, 4, 6]) {
      const expected = Math.min(1, speed / 6);
      expect(reachFromCurvature(curvatureFor(speed))).toBeCloseTo(expected, 5);
    }
  });
});

describe("domeHeight", () => {
  const limit = Number.MAX_VALUE;

  it("is zero at the peak and falls away when convex", () => {
    expect(domeHeight(0, 0, REST_CURVATURE, limit)).toBeCloseTo(0, 10);
    expect(domeHeight(300, 0, REST_CURVATURE, limit)).toBeLessThan(0);
  });

  it("comes towards the camera when concave", () => {
    expect(domeHeight(300, 0, MOVING_CURVATURE, limit)).toBeGreaterThan(0);
  });

  it("is flat when there is no curvature at all", () => {
    expect(domeHeight(900, 400, 0, limit)).toBeCloseTo(0, 10);
  });

  it("stops curving past the radius limit rather than reaching the camera", () => {
    // Left unbounded, a card at the corner of the screen would pass the lens
    // and turn inside out.
    const camera = 1086;
    const radius = radiusLimitFor(MOVING_CURVATURE, camera);
    const atLimit = domeHeight(radius, 0, MOVING_CURVATURE, radius);
    const wellPast = domeHeight(radius * 4, 0, MOVING_CURVATURE, radius);
    expect(wellPast).toBeCloseTo(atLimit);
    expect(Math.abs(atLimit)).toBeLessThanOrEqual(zLimitFor(MOVING_CURVATURE, camera) + 1e-6);
    expect(Math.abs(atLimit)).toBeLessThan(camera);
  });
});

describe("visibleCells", () => {
  it("returns a bounded set from an unbounded lattice", () => {
    const cells = visibleCells({ x: 0, y: 0 }, 3, 2);
    expect(cells.length).toBe(7 * 5);
  });

  it("follows the focus rather than sitting at the origin", () => {
    const cells = visibleCells({ x: 40, y: -12 }, 1, 1);
    expect(cells.every((cell) => Math.abs(cell.col - 40) <= 2)).toBe(true);
    expect(cells.every((cell) => Math.abs(cell.row + 12) <= 2)).toBe(true);
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
