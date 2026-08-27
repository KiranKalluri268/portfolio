import { describe, expect, it } from "vitest";
import { COARSE_RESOLUTION_FRACTION, detectVsyncQuantisation, findPlateau, median } from "../frameStats";

/**
 * The three sets below are real `?curve=1` output, taken on 2026-08-27, and they
 * are the reason this module exists. Two of them are the display's refresh
 * interval wearing a frame time's clothes; one of them is not. Nothing in the
 * scene was in a position to tell the difference, so the curve was trusted and
 * was reporting the screen.
 *
 * Keeping the real numbers rather than tidy synthetic ones matters here: the
 * awkward readings (17.4 on the Realme, 23.0 on the iPhone) are exactly the ones
 * a made-up fixture would not have contained.
 */

/** 144Hz laptop, one interval = 6.944ms. Every value is 1, 2, 3 or 4 of them. */
const LAPTOP_144HZ = [
  20.9, 20.9, 20.9, 13.9, 7.0, 7.0, 7.0, 7.0, 27.5, 21.0, 21.0, 21.0, 21.0, 20.9,
  21.1, 21.0, 21.0, 20.9, 20.5,
];

/** Realme 9 Speed Edition, also 144Hz — but it never draws a frame in one
 *  interval, so the fastest reading is two of them. This is the set that proves
 *  the fastest reading cannot be assumed to be a single interval. */
const REALME_144HZ = [
  20.8, 14.0, 20.8, 13.9, 13.9, 13.9, 13.9, 13.9, 20.7, 13.9, 20.8, 17.4, 14.0,
  14.0, 20.8, 14.0, 14.0, 14.0, 14.0,
];

/** iPhone 16 Pro. ProMotion varies the refresh rate to match the renderer, so
 *  these are close to real work and sit on no grid. */
const IPHONE_PROMOTION = [
  23.0, 22.0, 21.0, 17.0, 17.0, 17.0, 17.0, 17.0, 22.0, 22.0, 22.0, 22.0, 22.0,
  22.0, 21.5, 21.0, 20.0, 18.0, 17.0,
];

describe("detectVsyncQuantisation", () => {
  it("catches a 144Hz laptop reporting its display", () => {
    const { quantised, intervalMs } = detectVsyncQuantisation(LAPTOP_144HZ);
    expect(quantised).toBe(true);
    // 6.944ms, recovered from readings the runner had already rounded to 0.1ms,
    // so the estimate cannot be tighter than that rounding. Bounds rather than
    // toBeCloseTo, which would be asserting precision the input never had.
    expect(intervalMs).toBeGreaterThan(6.5);
    expect(intervalMs).toBeLessThan(7.5);
  });

  it("catches it even when no frame ever takes a single interval", () => {
    // The Realme's fastest pose is 13.9ms, which is two intervals of a 144Hz
    // screen. Taking the fastest reading as the interval would find 13.9 and
    // 20.8 to be 1x and 1.5x, miss nothing, and report a 72Hz display that does
    // not exist - so this asserts the divisor search, not just the outcome.
    const { quantised, intervalMs } = detectVsyncQuantisation(REALME_144HZ);
    expect(quantised).toBe(true);
    expect(intervalMs).toBeGreaterThan(6.5);
    expect(intervalMs).toBeLessThan(7.5);
  });

  it("does not cry wolf over genuinely variable frame times", () => {
    expect(detectVsyncQuantisation(IPHONE_PROMOTION).quantised).toBe(false);
  });

  it("does not call a single repeated value a grid", () => {
    // One value is a grid of one and explains nothing. Left unguarded this is the
    // easiest false positive there is: a perfectly steady scene would be reported
    // as an instrument fault.
    expect(detectVsyncQuantisation([16.7, 16.7, 16.7, 16.7]).quantised).toBe(false);
  });

  it("says nothing useful about too few readings", () => {
    expect(detectVsyncQuantisation([16.7])).toEqual({ quantised: false, intervalMs: null, resolutionFraction: null });
    expect(detectVsyncQuantisation([])).toEqual({ quantised: false, intervalMs: null, resolutionFraction: null });
  });

  it("ignores readings that are not positive numbers", () => {
    const withJunk = [...LAPTOP_144HZ, 0, -1, Number.NaN, Number.POSITIVE_INFINITY];
    expect(detectVsyncQuantisation(withJunk).quantised).toBe(true);
  });
});

describe("median", () => {
  it("takes the middle of an odd-length set", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("averages the two middle values of an even-length set", () => {
    // This is how 17.4ms appeared on the Realme: thirty samples alternating
    // between two and three intervals of a 144Hz screen, averaged into a number
    // that no frame ever took.
    expect(median([13.89, 20.83])).toBeCloseTo(17.36, 2);
  });

  it("survives an empty set", () => {
    expect(median([])).toBe(0);
  });
});

/** The same phone, the same 144Hz screen, measured at 2x render scale. Still on
 *  the grid - Android Chrome presents on vsync boundaries whatever the cost - but
 *  now at forty-nine intervals rather than three, where one interval is a rounding
 *  error rather than a floor. */
const REALME_AT_2X = [
  305.5, 305.5, 284.7, 55.7, 34.7, 20.8, 20.9, 20.8, 336.9, 340.1, 340.2, 340.3,
  329.6, 333.2, 326.3, 319.4, 302.0, 270.8, 236.1,
];

describe("how much the quantisation matters", () => {
  it("is severe when the readings are only a few intervals", () => {
    const { quantised, resolutionFraction } = detectVsyncQuantisation(REALME_144HZ);
    expect(quantised).toBe(true);
    // Peak 20.8ms is three intervals, so one interval is a third of it and any
    // change smaller than that is invisible.
    expect(resolutionFraction).toBeGreaterThan(COARSE_RESOLUTION_FRACTION);
    expect(resolutionFraction).toBeCloseTo(1 / 3, 1);
  });

  it("is negligible when the readings are tens of intervals", () => {
    const { quantised, resolutionFraction } = detectVsyncQuantisation(REALME_AT_2X);
    // Still detected - these really are multiples of 6.944ms, which is not luck:
    // 340.3 is 49.0, 305.5 is 44.0, 284.7 is 41.0, 236.1 is 34.0.
    expect(quantised).toBe(true);
    // But one interval is 2% of the peak, so the numbers are usable. Reporting
    // this as "do not trust" is how a good sweep gets thrown away.
    expect(resolutionFraction).toBeLessThan(COARSE_RESOLUTION_FRACTION);
    expect(resolutionFraction).toBeCloseTo(0.02, 2);
  });

  it("has no opinion when there is no grid", () => {
    expect(detectVsyncQuantisation(IPHONE_PROMOTION).resolutionFraction).toBeNull();
  });
});

/**
 * The fall, from all four real sweeps, in pose order from 13.5 to 27 units.
 * Laptop columns are GPU time; the phones had no GPU timing, so those are frame
 * times taken at 2x render scale.
 */
const FALL = {
  laptopMedium: [53.04, 53.03, 53.05, 53.08, 53.12, 53.01, 52.59, 51.17, 46.10, 40.59],
  laptopHigh: [105.66, 106.32, 106.02, 106.29, 105.98, 105.41, 104.48, 101.50, 91.51, 79.28],
  iphone: [147, 149, 149, 149, 150, 150, 158, 152, 139, 126],
  realme: [340.1, 340.2, 340.3, 329.6, 333.2, 326.3, 319.4, 302.0, 270.8, 236.1],
};

/** Pose index to viewport units, then to progress through the fall. */
const unitsAt = (index: number) => 13.5 + index * 1.5;
const progressOf = (units: number) => (units - 13) / 14;

describe("findPlateau", () => {
  it("agrees across four devices where the peak does not", () => {
    // This is the whole argument for the change. Read as peaks, these same four
    // sweeps proposed 0.68, 0.46, 0.25 and 0.14 for one constant - because the
    // flat top varies by 1-7% and max() was ranking scatter.
    const midpoints = Object.values(FALL).map((costs) => {
      const plateau = findPlateau(costs);
      if (!plateau) throw new Error("no plateau");
      const mid = (unitsAt(plateau.startIndex) + unitsAt(plateau.endIndex)) / 2;
      return Number(progressOf(mid).toFixed(2));
    });

    // Every device lands in the same half-pose window.
    expect(Math.max(...midpoints) - Math.min(...midpoints)).toBeLessThanOrEqual(0.06);
    for (const midpoint of midpoints) {
      expect(midpoint).toBeGreaterThan(0.3);
      expect(midpoint).toBeLessThan(0.45);
    }
  });

  it("puts the shipped 0.30 inside the plateau on every device", () => {
    // Which is why that constant is left where it is rather than re-derived.
    for (const costs of Object.values(FALL)) {
      const plateau = findPlateau(costs);
      if (!plateau) throw new Error("no plateau");
      expect(progressOf(unitsAt(plateau.startIndex))).toBeLessThanOrEqual(0.3);
      expect(progressOf(unitsAt(plateau.endIndex))).toBeGreaterThanOrEqual(0.3);
    }
  });

  it("excludes the decline at the end of the fall", () => {
    // Every device falls away after about 22 units, and that tail must not be
    // counted as part of the flat top or the midpoint drifts late.
    const plateau = findPlateau(FALL.laptopHigh);
    expect(plateau).not.toBeNull();
    expect(unitsAt(plateau!.endIndex)).toBeLessThan(27);
  });

  it("does not wander across a dip to reach a distant high pose", () => {
    // Contiguity is the point: a spike the far side of a trough is not the same
    // plateau, however close its value is.
    const plateau = findPlateau([100, 99, 40, 40, 98, 97]);
    expect(plateau).toEqual({ startIndex: 0, endIndex: 1, peakIndex: 0 });
  });

  it("handles a single pose and none at all", () => {
    expect(findPlateau([42])).toEqual({ startIndex: 0, endIndex: 0, peakIndex: 0 });
    expect(findPlateau([])).toBeNull();
  });
});
