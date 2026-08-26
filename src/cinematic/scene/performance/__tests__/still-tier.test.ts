import { describe, expect, it, vi } from "vitest";

import { ThreeDQualityManager } from "../ThreeDQualityManager";

/**
 * `still` is the bottom rung of the tier ladder and the only one the manager
 * cannot apply itself: there is no cheaper way to draw the journey, only the
 * decision not to draw it. So it asks, and the scene answers by handing the
 * visitor back to the presentation the site already ships.
 *
 * These cover the three things that decision has to get right: it fires for a
 * device that genuinely cannot cope, it does *not* fire for one that is merely
 * marginal, and it is unreachable once the visitor has entered.
 */

type Manager = {
  update(timestampMs: number, options?: { representative?: boolean }): void;
  lockOutStill(): void;
  warmupComplete: boolean;
  currentTier: string;
};

function makeManager(overrides: Record<string, unknown> = {}) {
  const onStillRequired = vi.fn();
  const manager = new ThreeDQualityManager({
    initialTier: "low",
    warmupMs: 3000,
    healthyFrameMs: 22,
    heavyFrameMs: 25,
    panicFrameMs: 50,
    stillFrameMs: 50,
    onStillRequired,
    ...overrides,
  }) as Manager;
  return { manager, onStillRequired };
}

/** Run warmup to completion at a fixed frame cost. */
function warmUpAt(manager: Manager, frameMs: number) {
  let now = 0;
  // Bounded so a frame cost above maxFrameGapMs cannot spin here forever.
  for (let i = 0; i < 5000 && !manager.warmupComplete; i++) {
    now += frameMs;
    manager.update(now, { representative: true });
  }
  return now;
}

describe("the still rung", () => {
  it("asks for still when even low cannot hold 20fps", () => {
    const { manager, onStillRequired } = makeManager();
    warmUpAt(manager, 90);

    expect(onStillRequired).toHaveBeenCalledTimes(1);
    expect(onStillRequired.mock.calls[0][0]).toMatchObject({
      reason: "warmup-below-low",
      tier: "low",
    });
    expect(onStillRequired.mock.calls[0][0].p90).toBeGreaterThan(50);
  });

  it("leaves a merely marginal device on low", () => {
    // A Realme 9 Speed Edition measures 24.3-27.7ms at `low` in the fall, which
    // straddles the 25ms heavy line and runs the journey perfectly well. If
    // `still` were pinned to the heavy line instead of the panic line, this
    // phone would lose a tier it can hold.
    const { manager, onStillRequired } = makeManager();
    warmUpAt(manager, 27);

    expect(onStillRequired).not.toHaveBeenCalled();
    expect(manager.currentTier).toBe("low");
  });

  it("never asks twice", () => {
    const { manager, onStillRequired } = makeManager();
    warmUpAt(manager, 90);

    let now = 100000;
    for (let i = 0; i < 200; i++) {
      now += 90;
      manager.update(now, { representative: true });
    }

    expect(onStillRequired).toHaveBeenCalledTimes(1);
  });

  it("is unreachable once the visitor has entered", () => {
    // Entry-only by design: tearing three.js down mid-flight, while someone is
    // scrolling a camera through a wormhole, is worse than any frame rate.
    const { manager, onStillRequired } = makeManager();
    manager.lockOutStill();
    warmUpAt(manager, 90);

    expect(onStillRequired).not.toHaveBeenCalled();
    expect(manager.currentTier).toBe("low");
  });

  it("asks for still when the benchmark never finishes on the bottom rung", () => {
    // Every frame longer than maxFrameGapMs, so none of them ever counts as a
    // warmup sample and the wall-clock deadline is what ends it. This used to
    // fall through and do nothing, leaving the worst hardware there is on `low`.
    const { manager, onStillRequired } = makeManager({
      maxFrameGapMs: 250,
      benchmarkDeadlineMs: 15000,
    });

    let now = 0;
    for (let i = 0; i < 200 && !manager.warmupComplete; i++) {
      now += 400;
      manager.update(now, { representative: true });
    }

    expect(onStillRequired).toHaveBeenCalledTimes(1);
    expect(onStillRequired.mock.calls[0][0]).toMatchObject({
      reason: "benchmark-deadline",
    });
  });

  it("carries on with the ordinary rungs when nobody is listening", () => {
    // A caller that passes no handler must not be silently stranded: the
    // refusal has to fall through to the tier logic rather than return early.
    const manager = new ThreeDQualityManager({
      initialTier: "medium",
      warmupMs: 3000,
      healthyFrameMs: 22,
      heavyFrameMs: 25,
      panicFrameMs: 50,
    }) as Manager;

    warmUpAt(manager, 90);

    expect(manager.currentTier).toBe("low");
  });
});
