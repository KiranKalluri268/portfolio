import { describe, expect, it } from "vitest";
import { centreOnScreen } from "../blackhole-centre";

describe("the black hole's centre on screen", () => {
  const canvas = { left: 0, top: 0, width: 1440, height: 900 };

  it("is the middle of the canvas with no compose shift", () => {
    expect(centreOnScreen({ shift: [0, 0] }, canvas)).toEqual({ x: 720, y: 450 });
  });

  it("moves by half-screens: x across, y up", () => {
    // The projects stop at 1440x900: measured on screen at about (1165, 380).
    const { x, y } = centreOnScreen({ shift: [0.642, 0.156] }, canvas);
    expect(x).toBeCloseTo(1182.2, 1);
    expect(y).toBeCloseTo(379.8, 1);
  });

  it("follows the canvas when it is not at the viewport's corner", () => {
    expect(centreOnScreen({ shift: [0, 0] }, { left: 10, top: 20, width: 100, height: 50 })).toEqual({ x: 60, y: 45 });
  });
});
