import { describe, expect, it } from "vitest";

import {
  MOVING_CURVATURE,
  REST_CURVATURE,
  REST_SAG,
  cellFocus,
  curvatureFor,
  curvatureUnit,
  domeHeight,
  latticePoint,
  nearestCell,
  pitchFor,
  projectIndexFor,
  radiusLimitFor,
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

describe("pitchFor", () => {
  it("leaves the same gap between columns as between rows", () => {
    // Taken as a share of each axis instead, the gap between columns came out
    // far wider than the one between rows, the cards being wider than tall.
    const { x, y } = pitchFor(360, 207, false);
    expect(x - 360).toBeCloseTo(y - 207);
  });

  it("leaves a hairline between cells rather than a gutter", () => {
    // The cells are the surface, not cards lying on it, so the gap is the width
    // of the cut between them and nothing more. Anything wider and each cell
    // reads as its own object floating on black, which is what this grid looked
    // like before it was drawn as one membrane.
    const { gap } = pitchFor(400, 400, false);
    expect(gap).toBeGreaterThan(0);
    expect(gap / 400).toBeLessThan(0.05);
  });

  it("spaces a phone the same way, only the cells being larger", () => {
    // The gap used to be tighter on a phone to claw back space between cards.
    // At a hairline there is nothing left to claw back.
    expect(pitchFor(400, 400, true).gap).toBeCloseTo(pitchFor(400, 400, false).gap);
  });

  it("squares the lattice, so it bends the same across a row as down a column", () => {
    const { x, y } = pitchFor(400, 400, false);
    expect(x).toBeCloseTo(y);
  });
});

describe("curvatureUnit", () => {
  // A desktop and a phone, as the grid actually meets them: the camera stands
  // back by half the viewport's height over the tangent of half its field of
  // view, which is what ProjectsGridGL sets.
  const cameraFor = (height: number) => height / (2 * Math.tan((45 * Math.PI) / 360));
  const screens = [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ];

  it("bows every screen by the same share of its own depth", () => {
    // The point of saying the shape as a sag rather than as a 1/px curvature.
    // With a fixed curvature the same number wrapped a phone almost flat and
    // curled a desktop into a ball.
    for (const { width, height } of screens) {
      const camera = cameraFor(height);
      const halfDiagonal = Math.hypot(width, height) / 2;
      const curvature = REST_CURVATURE(curvatureUnit(camera, halfDiagonal));
      const sag = -domeHeight(halfDiagonal, 0, curvature, Number.MAX_VALUE);
      expect(sag / camera).toBeCloseTo(REST_SAG, 6);
      // Concave: the rim stands in front of the middle, not behind it.
      expect(sag).toBeLessThan(0);
    }
  });

  it("keeps the rim of the screen well inside the radius the surface stops curving at", () => {
    // Past that radius the surface goes flat, and a flat annulus behind a
    // curled ball is what the field looked like when the bow was too strong.
    for (const { width, height } of screens) {
      const camera = cameraFor(height);
      const halfDiagonal = Math.hypot(width, height) / 2;
      const unit = curvatureUnit(camera, halfDiagonal);
      for (const curvature of [REST_CURVATURE(unit), MOVING_CURVATURE(unit)]) {
        expect(radiusLimitFor(curvature, camera)).toBeGreaterThan(halfDiagonal);
      }
    }
  });
});

describe("curvatureFor", () => {
  const unit = curvatureUnit(1086, 849);

  it("rests at the full wrap and eases out at speed", () => {
    expect(curvatureFor(0, unit)).toBeCloseTo(REST_CURVATURE(unit), 10);
    expect(curvatureFor(1000, unit)).toBeCloseTo(MOVING_CURVATURE(unit), 10);
    // Flatter at speed, which for a concave field means nearer zero.
    expect(Math.abs(MOVING_CURVATURE(unit))).toBeLessThan(Math.abs(REST_CURVATURE(unit)));
  });

  it("stays concave at every speed rather than turning inside out", () => {
    // The field used to rest convex and pass through flat into concave at
    // speed, and the moment of inversion was a bigger event than a grid being
    // dragged should produce. Nothing here may reach zero, let alone cross it.
    const speeds = Array.from({ length: 60 }, (_, i) => i * 0.2);
    for (const speed of speeds) {
      expect(curvatureFor(speed, unit)).toBeLessThan(0);
    }
  });

  it("never goes past the ceiling however hard it is thrown", () => {
    expect(curvatureFor(1e6, unit)).toBeCloseTo(MOVING_CURVATURE(unit), 10);
  });
});

describe("domeHeight", () => {
  const limit = Number.MAX_VALUE;
  const unit = curvatureUnit(1086, 849);
  const rest = REST_CURVATURE(unit);
  const moving = MOVING_CURVATURE(unit);

  it("is zero in the middle and wraps towards the camera from there", () => {
    expect(domeHeight(0, 0, rest, limit)).toBeCloseTo(0, 10);
    expect(domeHeight(300, 0, rest, limit)).toBeGreaterThan(0);
  });

  it("wraps at the moving shape too, only less far", () => {
    // Concave at both ends, so the surface never falls away from the camera.
    expect(domeHeight(300, 0, moving, limit)).toBeGreaterThan(0);
    expect(domeHeight(300, 0, moving, limit)).toBeLessThan(domeHeight(300, 0, rest, limit));
  });

  it("is flat when there is no curvature at all", () => {
    expect(domeHeight(900, 400, 0, limit)).toBeCloseTo(0, 10);
  });

  it("stops curving past the radius limit rather than running away", () => {
    const camera = 1086;
    const radius = radiusLimitFor(rest, camera);
    const atLimit = domeHeight(radius, 0, rest, radius);
    const wellPast = domeHeight(radius * 4, 0, rest, radius);
    expect(wellPast).toBeCloseTo(atLimit);
    expect(Math.abs(atLimit)).toBeLessThanOrEqual(zLimitFor(camera) + 1e-6);
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
