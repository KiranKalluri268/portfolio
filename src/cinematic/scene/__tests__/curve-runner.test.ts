// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCurveRunner } from "../curveRunner";

/**
 * The curve runner drives the camera and prints a report. The report is the
 * product — it is what gets pasted into CINEMATIC_MEASUREMENTS.md and what every
 * phase gate is judged against — so it is worth testing that it says true things,
 * including when the numbers it was given are not trustworthy.
 *
 * jsdom is enough: the runner only ever touches a `<div>` it makes itself.
 */

type GpuTimerLike = {
  supported: boolean;
  begin: (tag: unknown) => void;
  end: () => void;
  collect: () => Array<{ tag: unknown; ms: number }>;
  dispose: () => void;
};

const JOURNEY = {
  crossingEnd: 5.0,
  blackoutEnd: 6.5,
  tunnelEnd: 11.5,
  arrivalEnd: 13.0,
  approachEnd: 27.0,
};

/** Matches SETTLE_FRAMES + SAMPLE_FRAMES in curveRunner.js. */
const FRAMES_PER_POSE = 40;
/** poses are every 1.5 units from 0 to 27 inclusive. */
const POSE_COUNT = 19;

/**
 * A GPU timer that resolves each query exactly `latency` frames after it was
 * begun, which is what a real driver does and what the pose tagging exists to
 * cope with.
 */
function fakeGpuTimer({ ms = 40, latency = 3, supported = true } = {}) {
  let frame = 0;
  let queued: Array<{ tag: unknown; ms: number; readyAt: number }> = [];
  let open: unknown = null;
  return {
    supported,
    begin(tag: unknown) {
      open = tag;
    },
    end() {
      if (open === null) return;
      queued.push({ tag: open, ms, readyAt: frame + latency });
      open = null;
    },
    collect() {
      frame++;
      const ready = queued.filter((q) => q.readyAt <= frame);
      queued = queued.filter((q) => q.readyAt > frame);
      return ready.map(({ tag, ms: value }) => ({ tag, ms: value }));
    },
    dispose() {},
  };
}

/** Runs a whole sweep, feeding one wall-clock frame time per frame. */
function sweep({
  frameMs,
  gpuTimer = null,
  measureScale = null,
}: {
  frameMs: (poseIndex: number, frameInPose: number) => number;
  gpuTimer?: GpuTimerLike | null;
  measureScale?: number | null;
}) {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const runner = createCurveRunner({
    journey: JOURNEY,
    getTier: () => "high",
    onPose: () => {},
    gpuTimer,
    measureScale,
  });

  // Generous frame budget: the flush frames after the last pose are extra.
  for (let i = 0; i < FRAMES_PER_POSE * POSE_COUNT + 50 && !runner.finished; i++) {
    const pose = runner.currentPose;
    if (gpuTimer?.supported) gpuTimer.begin(pose);
    runner.update(frameMs(pose, i % FRAMES_PER_POSE));
    if (gpuTimer?.supported) gpuTimer.end();
  }

  const report = log.mock.calls.map((c) => String(c[0])).join("\n");
  runner.dispose();
  log.mockRestore();
  return { runner, report };
}

afterEach(() => {
  document.getElementById("curve-runner")?.remove();
});

describe("the curve runner's report", () => {
  it("finishes and reports every pose", () => {
    const { runner, report } = sweep({ frameMs: () => 16.7 });
    expect(runner.finished).toBe(true);
    // First, last, and the arrival in between.
    expect(report).toContain("0  crossing");
    expect(report).toContain("27  fall");
    expect(report).toContain("12  arrival");
  });

  it("warns when the frame column is really the display's refresh rate", () => {
    // A 144Hz screen: every pose lands on a whole number of 6.944ms intervals,
    // which is what all three real devices did and what nothing in the scene was
    // able to notice.
    //
    // Three distinct multiples, including a single interval. Two would not pin the
    // rate down: 13.9 and 20.8 alone are as well explained by a 72Hz screen at 1x
    // and 1.5x, and the detector correctly reports the coarsest grid that fits.
    const interval = 1000 / 144;
    const { report } = sweep({
      frameMs: (pose) => interval * (1 + (pose % 3)),
    });
    expect(report).toContain("WARNING:");
    expect(report).toMatch(/quantised to about 6\.9ms/);
    expect(report).toContain("floor");
  });

  it("downgrades the warning to a note when the grid is fine enough to ignore", () => {
    // The same 144Hz grid, but every pose is tens of intervals rather than a
    // handful - the shape of a sweep taken at a raised render scale. Real numbers
    // from the Realme at 2x. Calling this untrustworthy would throw away a good
    // sweep.
    const { report } = sweep({
      frameMs: (pose) => [305.5, 340.3, 236.1, 20.8][pose % 4],
    });
    expect(report).not.toContain("WARNING:");
    expect(report).toContain("rounding error rather than a floor");
    expect(report).not.toContain("do not trust");
  });

  it("says nothing about quantisation when frame times genuinely vary", () => {
    const { report } = sweep({
      frameMs: (pose) => 17 + (pose % 7) * 0.9,
    });
    expect(report).not.toContain("NOTE:");
  });

  it("reports GPU time and reads its peaks from it", () => {
    // Wall clock pinned flat at one vsync interval, GPU time genuinely peaking at
    // one pose. A report that reads the wall column cannot find that peak; one
    // that reads the GPU column must.
    const peakPose = 12; // 18.0 units, inside the fall
    const { report } = sweep({
      frameMs: () => 1000 / 144,
      gpuTimer: fakeGpuTimerVarying((pose) => (pose === peakPose ? 90 : 40)),
    });

    expect(report).toContain("GPU timing available");
    expect(report).toContain("peak overall: 18 units (fall) at 90.00ms GPU");
  });

  it("attributes late GPU results to the pose that produced them", () => {
    // The whole reason queries carry a tag. With a 3-frame latency the last
    // samples of every pose resolve during the next one, and the final pose's
    // resolve after the sweep would otherwise have ended.
    const perPose = fakeGpuTimerVarying((pose) => 10 + pose);
    const { report } = sweep({
      frameMs: () => 16.7,
      gpuTimer: perPose,
    });
    // Pose 18 is the last one, 27.0 units, cost 28ms. If the tail were dropped
    // its GPU cell would be empty.
    expect(report).toMatch(/27\s+fall\s+16\.7ms\s+60fps\s+28\.00ms/);
    // And the first pose keeps its own value rather than a later one.
    expect(report).toMatch(/0\s+crossing\s+16\.7ms\s+60fps\s+10\.00ms/);
  });

  it("falls back to the frame column when there is no GPU timing", () => {
    const { report } = sweep({
      frameMs: (pose) => (pose === 12 ? 30 : 17),
      gpuTimer: fakeGpuTimer({ supported: false }),
    });
    expect(report).toContain("no GPU timing on this device");
    expect(report).toContain("peak overall: 18 units (fall) at 30.00ms frame");
  });

  it("records the render scale it measured at", () => {
    const { report } = sweep({ frameMs: () => 16.7, measureScale: 2 });
    expect(report).toContain("measured at 2x render scale");
  });
});

/** As fakeGpuTimer, but the cost depends on which pose the query was tagged with. */
function fakeGpuTimerVarying(costFor: (pose: number) => number, latency = 3) {
  let frame = 0;
  let queued: Array<{ tag: number; ms: number; readyAt: number }> = [];
  let open: number | null = null;
  return {
    supported: true,
    begin(tag: unknown) {
      open = tag as number;
    },
    end() {
      if (open === null) return;
      queued.push({ tag: open, ms: costFor(open), readyAt: frame + latency });
      open = null;
    },
    collect() {
      frame++;
      const ready = queued.filter((q) => q.readyAt <= frame);
      queued = queued.filter((q) => q.readyAt > frame);
      return ready.map(({ tag, ms }) => ({ tag, ms }));
    },
    dispose() {},
  };
}
