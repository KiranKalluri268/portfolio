// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import hero from "@/data/hero.json";
import {
  FLY_MS,
  GREETING_MS,
  greetingSequenceMs,
  GROWTH_STARTS_AT,
  holdsFor,
  MAX_SCALE,
  MIN_HOLD_MS,
  scaleAt,
  scaleFor,
  SWELL_OVERRUN_MS,
  swellFor,
} from "../hero-greeting-timing";

/**
 * The entry greeting is a toll on top of a toll: the entry gate already holds
 * the visitor for two seconds before the curtain starts opening. These are the
 * two things about it that are easy to break silently — that it is only ever
 * spent on someone who actually went through the gate, and that it still ends.
 */

let hasEntered = false;
vi.mock("@/context/AudioContextProvider", () => ({
  useAudio: () => ({ hasEntered }),
}));
vi.mock("@/context/SmoothScrollContext", () => ({
  useScrollActions: () => ({ scrollNext: vi.fn(), scrollToSection: vi.fn() }),
}));

let reduceMotion = false;
vi.mock("@/hooks/useMediaQuery", () => ({
  useReducedMotion: () => reduceMotion,
}));

import Hero from "../hero";
import { ENTRY_RELEASE_MS } from "../entry-timing";

beforeEach(() => {
  vi.useFakeTimers();
  hasEntered = false;
  reduceMotion = false;
});

afterEach(() => {
  vi.useRealTimers();
});

/** Each beat only schedules the next one from inside an effect, and effects do
 *  not flush until act() returns - so advancing the whole sequence in one jump
 *  fires the first timer and stops. Stepping keeps the chain running.
 *
 *  The step is the slop: a beat's next timer cannot be scheduled until the flush
 *  that follows it, so the virtual clock lags the real schedule by up to one
 *  step per beat. At 50ms and eighteen greetings that was most of a second, and
 *  the sequence appeared not to have finished when it had. */
const STEP_MS = 10;

function advance(ms: number) {
  for (let left = ms; left > 0; left -= STEP_MS) {
    const step = Math.min(left, STEP_MS);
    act(() => {
      vi.advanceTimersByTime(step);
    });
  }
}

/** Mount before Enter is pressed and then flip the flag, which is the only way
 *  the greeting ever runs: seeding hasEntered true is the "arrived from another
 *  page" case, and that one goes straight to the name. */
function enterThroughGate() {
  const view = render(<Hero />);
  hasEntered = true;
  act(() => {
    view.rerender(<Hero />);
  });
  return view;
}

describe("the entry greeting", () => {
  it("runs once the curtain opens, ending on Telugu", () => {
    enterThroughGate();
    advance(ENTRY_RELEASE_MS);

    const opening = hero.greetingCycle.opening;
    const indian = hero.greetingCycle.indian;
    const holds = holdsFor(opening.length + indian.length);

    for (const [index, text] of opening.entries()) {
      expect(screen.getByText(text)).toBeTruthy();
      advance(holds[index]);
    }
    for (const [index, entry] of indian.entries()) {
      expect(screen.getByText(entry.text)).toBeTruthy();
      advance(holds[opening.length + index]);
    }

    expect(indian[indian.length - 1].language).toBe("Telugu");
  });

  it("hands the headline to the name, and does not outstay the budget", () => {
    enterThroughGate();

    const budget = greetingSequenceMs(
      hero.greetingCycle.opening.length + hero.greetingCycle.indian.length,
    );
    // The budget is a decision, not a consequence, so it is written down, and
    // it has been raised twice on purpose: 4.5s at thirteen greetings, 6.2s
    // when five more went in in their own scripts, 6.4s when Malayalam took it
    // to nineteen. Every one of those was taken knowing it buys length, because
    // every beat already sits on the readable floor and cannot be shortened -
    // more words can only mean more time.
    //
    // Which is exactly why the number is asserted rather than derived. Six and
    // a half seconds on top of the entry gate's two is the outside edge of what
    // this is worth; a greeting that drifted to nine would pass every other
    // check in this file.
    expect(budget).toBeLessThanOrEqual(6400);
    expect(budget).toBeGreaterThan(FLY_MS);

    advance(ENTRY_RELEASE_MS + budget + 500);
    expect(screen.queryByText("నమస్కారం")).toBeNull();
    // The name types from empty, so its first character is the proof the
    // handover happened at all.
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      hero.namePrefix.slice(0, 1),
    );
  });

  it("is not replayed on someone already through the gate", () => {
    const { unmount } = enterThroughGate();
    advance(ENTRY_RELEASE_MS + 100);
    expect(screen.queryByText(hero.greetingCycle.opening[0])).toBeTruthy();
    unmount();

    // Arriving at the home page from elsewhere on the site mounts the hero with
    // hasEntered already true. Same flag, but this mount began with it set, so
    // it starts at the name: that visitor has already seen the greeting.
    hasEntered = true;
    render(<Hero />);
    advance(100);
    expect(screen.queryByText(hero.greetingCycle.opening[0])).toBeNull();
  });

  it("is skipped entirely under reduced motion", () => {
    reduceMotion = true;
    enterThroughGate();
    advance(ENTRY_RELEASE_MS + 5000);
    for (const entry of hero.greetingCycle.indian) {
      expect(screen.queryByText(entry.text)).toBeNull();
    }
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      hero.name,
    );
  });
});

describe("the pacing curve", () => {
  // The counts that matter are the ones the content file does not have: the
  // whole point of a curve is that editing src/data/hero.json cannot land the
  // sequence on a shape nobody looked at.
  const counts = [3, 5, 8, 13, 21, 34, 60];

  it("leans in, peaks in the middle, and comes to rest on the last word", () => {
    for (const count of counts) {
      const holds = holdsFor(count);
      const fastest = Math.min(...holds);
      const peak = holds.indexOf(fastest);

      // Slowest at the ends, fastest somewhere in between - never at an end,
      // which is all a curve that only accelerates would give.
      expect(peak).toBeGreaterThan(0);
      expect(peak).toBeLessThan(count - 1);

      // It comes to rest, so the last word is the longest of all.
      expect(holds[count - 1]).toBe(Math.max(...holds));

      // Monotonic on both sides: no word may be quicker than the one before it
      // on the way in, or slower than the one after it on the way out. This is
      // what stops a long list flattening into a row of identical flickers.
      for (let i = 1; i <= peak; i += 1) {
        expect(holds[i]).toBeLessThanOrEqual(holds[i - 1]);
      }
      for (let i = peak + 1; i < count; i += 1) {
        expect(holds[i]).toBeGreaterThanOrEqual(holds[i - 1]);
      }

      // And it stays readable however many there are.
      expect(fastest).toBeGreaterThanOrEqual(MIN_HOLD_MS);
    }
  });

  it("keeps the same proportions whatever the count", () => {
    // The arc is the thing that must not change. Compared as fractions of their
    // own total, a short list and a long one are the same gesture.
    const shapeOf = (count: number) => {
      const holds = holdsFor(count);
      const total = holds.reduce((sum, hold) => sum + hold, 0);
      return { first: holds[0] / total, last: holds[count - 1] / total };
    };
    const short = shapeOf(8);
    const long = shapeOf(21);
    expect(long.last / long.first).toBeGreaterThan(1);
    expect(short.last / short.first).toBeGreaterThan(1);
  });

  it("holds the budget until the floor forces it to stretch", () => {
    for (const count of [3, 5, 8, 13]) {
      const total = holdsFor(count).reduce((sum, hold) => sum + hold, 0);
      // Rounding each hold to a whole millisecond is the only drift allowed.
      expect(Math.abs(total - GREETING_MS)).toBeLessThanOrEqual(count);
    }

    // Past that the sequence gets longer rather than subliminal, and it does so
    // gradually - one more greeting is never a cliff.
    const totals = [14, 16, 21, 34].map((count) =>
      holdsFor(count).reduce((sum, hold) => sum + hold, 0),
    );
    expect(totals[0]).toBeGreaterThan(GREETING_MS);
    for (let i = 1; i < totals.length; i += 1) {
      expect(totals[i]).toBeGreaterThan(totals[i - 1]);
    }
  });

  it("ends on the fly-through however long the words took", () => {
    for (const count of counts) {
      const words = holdsFor(count).reduce((sum, hold) => sum + hold, 0);
      expect(greetingSequenceMs(count)).toBe(words + FLY_MS);
    }
  });

  it("still swells to full size whatever the count", () => {
    for (const count of counts) {
      expect(scaleFor(0, count)).toBe(1);
      expect(scaleFor(count - 1, count)).toBeCloseTo(MAX_SCALE);
    }
  });
});

describe("the swell", () => {
  const counts = [6, 13, 17, 21];

  it("holds still until the words are at their fastest", () => {
    // Growing while the sequence is still speeding up asks the eye to read two
    // accelerations at once. It waits for the top of the speed curve.
    for (const t of [0, 0.1, 0.3, GROWTH_STARTS_AT]) {
      expect(scaleAt(t)).toBe(1);
    }
    expect(scaleAt(GROWTH_STARTS_AT + 0.01)).toBeGreaterThan(1);
  });

  it("starts slow and gets faster, all the way to the last word", () => {
    // Sampled evenly across the growing half, each step must be bigger than the
    // one before it. A linear ramp - what this was - gives equal steps, and
    // handed over to the push with a visible corner.
    const steps: number[] = [];
    const span = 1 - GROWTH_STARTS_AT;
    for (let i = 1; i <= 20; i += 1) {
      const from = GROWTH_STARTS_AT + (span * (i - 1)) / 20;
      const to = GROWTH_STARTS_AT + (span * i) / 20;
      steps.push(scaleAt(to) - scaleAt(from));
    }
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    }
    expect(scaleAt(1)).toBeCloseTo(MAX_SCALE);
  });

  it("keeps growing at the same rate through the overrun", () => {
    // The last word carries on swelling past its own beat, because the push is
    // started by a different clock and drifts. If the target were not extended
    // to match, the swell would slow down over that overrun - a sag in the one
    // place the sequence is supposed to be winding up hardest.
    for (const count of counts) {
      const last = count - 1;
      const holds = holdsFor(count);
      const swell = swellFor(last, count);

      expect(swell.duration).toBe(holds[last] + SWELL_OVERRUN_MS);
      expect(swell.scale).toBeGreaterThan(MAX_SCALE);

      const beatRate = (scaleFor(last, count) - scaleFor(last - 1, count)) / holds[last];
      const overrunRate = (swell.scale - scaleFor(last - 1, count)) / swell.duration;
      expect(overrunRate).toBeCloseTo(beatRate, 5);
    }
  });

  it("leaves every earlier beat alone", () => {
    for (const count of counts) {
      const holds = holdsFor(count);
      for (let i = 0; i < count - 1; i += 1) {
        const swell = swellFor(i, count);
        expect(swell.scale).toBe(scaleFor(i, count));
        expect(swell.duration).toBe(holds[i]);
      }
    }
  });
});
