import { describe, expect, it } from "vitest";

import {
  AXIS_LOCK_THRESHOLD,
  MIN_MOMENTUM_VELOCITY,
  VelocityTracker,
  clamp,
  dragTarget,
  momentumTarget,
  resolveAxis,
  scrollPerPixel,
  settleSeconds,
} from "../projects-swipe";

describe("resolveAxis", () => {
  it("stays undecided until the gesture clears the tap threshold", () => {
    expect(resolveAxis(0, 0)).toBeNull();
    expect(resolveAxis(AXIS_LOCK_THRESHOLD - 1, 0)).toBeNull();
    expect(resolveAxis(0, AXIS_LOCK_THRESHOLD - 1)).toBeNull();
  });

  it("commits to the dominant direction once it clears the threshold", () => {
    expect(resolveAxis(40, 5)).toBe("horizontal");
    expect(resolveAxis(-40, 5)).toBe("horizontal");
    expect(resolveAxis(5, 40)).toBe("vertical");
    expect(resolveAxis(5, -40)).toBe("vertical");
  });

  it("gives an even diagonal to the page, never the carousel", () => {
    // Scrolling the page is the primary gesture; an ambiguous swipe must not
    // steal it, or the section feels like it is fighting the user.
    expect(resolveAxis(30, 30)).toBe("vertical");
    expect(resolveAxis(-30, 30)).toBe("vertical");
  });
});

describe("scrollPerPixel", () => {
  it("maps the section's vertical travel onto its horizontal travel", () => {
    expect(scrollPerPixel(4000, 2000)).toBe(2);
    expect(scrollPerPixel(1000, 2000)).toBe(0.5);
  });

  it("returns zero when there is nothing to travel, rather than dividing by zero", () => {
    expect(scrollPerPixel(4000, 0)).toBe(0);
    expect(Number.isFinite(scrollPerPixel(4000, 0))).toBe(true);
  });
});

describe("dragTarget", () => {
  const range = { min: 1000, max: 5000, ratio: 2 };

  it("tracks the finger 1:1 through the configured ratio", () => {
    expect(dragTarget({ startScroll: 3000, deltaX: -100, ...range })).toBe(3200);
    expect(dragTarget({ startScroll: 3000, deltaX: 100, ...range })).toBe(2800);
  });

  it("moves backwards when dragging right, which pulls earlier panels back", () => {
    const target = dragTarget({ startScroll: 3000, deltaX: 50, ...range });
    expect(target).toBeLessThan(3000);
  });

  it("clamps at both ends so a swipe cannot leave the section", () => {
    expect(dragTarget({ startScroll: 1000, deltaX: 9999, ...range })).toBe(1000);
    expect(dragTarget({ startScroll: 5000, deltaX: -9999, ...range })).toBe(5000);
  });
});

describe("momentumTarget", () => {
  const range = { min: 0, max: 10000, ratio: 2 };

  it("coasts onward in the direction of the flick", () => {
    const forward = momentumTarget({ scroll: 5000, velocityX: -1, ...range });
    expect(forward).toBeGreaterThan(5000);

    const backward = momentumTarget({ scroll: 5000, velocityX: 1, ...range });
    expect(backward).toBeLessThan(5000);
  });

  it("stops where it was left when the finger was not moving on release", () => {
    // Drag slowly, hold, release: no glide, or the carousel drifts on its own.
    const held = momentumTarget({
      scroll: 5000,
      velocityX: MIN_MOMENTUM_VELOCITY / 2,
      ...range,
    });
    expect(held).toBe(5000);
  });

  it("coasts further for a faster flick", () => {
    const gentle = momentumTarget({ scroll: 5000, velocityX: -0.5, ...range });
    const hard = momentumTarget({ scroll: 5000, velocityX: -2, ...range });
    expect(hard).toBeGreaterThan(gentle);
  });

  it("never coasts past the ends of the section", () => {
    expect(momentumTarget({ scroll: 9900, velocityX: -50, ...range })).toBe(10000);
    expect(momentumTarget({ scroll: 100, velocityX: 50, ...range })).toBe(0);
  });
});

describe("settleSeconds", () => {
  it("takes longer for a longer glide, within fixed bounds", () => {
    const short = settleSeconds(50, 800);
    const long = settleSeconds(800, 800);
    expect(short).toBeLessThan(long);
    expect(short).toBeGreaterThanOrEqual(0.25);
    expect(long).toBeLessThanOrEqual(0.9);
  });

  it("is instant when there is no distance to cover", () => {
    expect(settleSeconds(0, 800)).toBe(0);
  });

  it("does not run away for a glide longer than the viewport", () => {
    expect(settleSeconds(100000, 800)).toBeLessThanOrEqual(0.9);
  });
});

describe("VelocityTracker", () => {
  it("measures px per ms in the direction of travel", () => {
    const tracker = new VelocityTracker();
    tracker.add(0, 0);
    tracker.add(100, 100);
    expect(tracker.velocity()).toBeCloseTo(1);
  });

  it("reports no velocity from a single point or a stationary finger", () => {
    const tracker = new VelocityTracker();
    expect(tracker.velocity()).toBe(0);
    tracker.add(50, 0);
    expect(tracker.velocity()).toBe(0);
    tracker.add(50, 50);
    expect(tracker.velocity()).toBe(0);
  });

  it("uses only the end of the gesture, so a slow drag can still end in a flick", () => {
    const tracker = new VelocityTracker(100);
    // Long slow drag...
    for (let time = 0; time <= 1000; time += 100) tracker.add(time * 0.01, time);
    // ...then a fast flick in the last moments.
    tracker.add(200, 1050);
    expect(tracker.velocity()).toBeGreaterThan(1);
  });

  it("forgets everything on reset", () => {
    const tracker = new VelocityTracker();
    tracker.add(0, 0);
    tracker.add(100, 100);
    tracker.reset();
    expect(tracker.velocity()).toBe(0);
  });
});

describe("clamp", () => {
  it("bounds a value both ways", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});
