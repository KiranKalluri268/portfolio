// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The handshake every page-entry animation depends on. If it is wrong, the
 * projects grid, the skill web and the résumé all play behind the menu's cover
 * and the visitor sees a finished page with no arrival — a failure that looks
 * exactly like the animation never having been written.
 *
 * Module state, so each test needs a fresh copy of it.
 */
async function freshModule() {
  vi.resetModules();
  return import("../navigation-cover");
}

describe("navigation cover", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs the waiter immediately when nothing is covering the page", async () => {
    const { whenUncovered } = await freshModule();
    const run = vi.fn();

    whenUncovered(run);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it("holds the waiter while the cover is up", async () => {
    const { raiseCover, whenUncovered } = await freshModule();
    const run = vi.fn();

    raiseCover();
    whenUncovered(run);

    expect(run).not.toHaveBeenCalled();
  });

  it("releases every waiter only once the cover has finished lifting", async () => {
    const { raiseCover, dropCoverIn, whenUncovered } = await freshModule();
    const first = vi.fn();
    const second = vi.fn();

    raiseCover();
    whenUncovered(first);
    whenUncovered(second);
    dropCoverIn(500);

    // Still up: the animation must not start on a screen nobody can see.
    vi.advanceTimersByTime(499);
    expect(first).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("does not run a waiter that cancelled itself", async () => {
    const { raiseCover, dropCoverIn, whenUncovered } = await freshModule();
    const run = vi.fn();

    raiseCover();
    const cancel = whenUncovered(run);
    cancel();
    dropCoverIn(0);
    vi.advanceTimersByTime(1);

    expect(run).not.toHaveBeenCalled();
  });

  it("returns a cancel function even on the immediate path", async () => {
    const { whenUncovered } = await freshModule();

    // The caller cleans up in an effect teardown and cannot know which path it
    // took; returning undefined here would throw on unmount.
    expect(() => whenUncovered(() => {})()).not.toThrow();
  });

  it("ignores a drop when no cover was ever raised", async () => {
    const { dropCoverIn, whenUncovered } = await freshModule();
    const run = vi.fn();

    dropCoverIn(100);
    vi.advanceTimersByTime(200);
    whenUncovered(run);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it("clears its waiting list so a second lift does not re-run them", async () => {
    const { raiseCover, dropCoverIn, whenUncovered } = await freshModule();
    const run = vi.fn();

    raiseCover();
    whenUncovered(run);
    dropCoverIn(10);
    vi.advanceTimersByTime(10);
    expect(run).toHaveBeenCalledTimes(1);

    raiseCover();
    dropCoverIn(10);
    vi.advanceTimersByTime(10);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
