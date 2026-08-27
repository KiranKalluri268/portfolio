import { describe, expect, it } from "vitest";
import { worldConfig, WORLD_FEATURES } from "../worldConfig";

/**
 * The world arrives one phase at a time, each behind a flag. These tests exist
 * for one failure in particular: a flag left on after a tuning session and
 * shipped, which on this route means an unmeasured feature running inside the
 * most expensive phase of the journey on whatever phone happens to load it.
 *
 * A phase that switches its own flag on will fail the first test here. That is
 * the point — turning one on is a deliberate act with a measurement behind it,
 * so it should have to say so in the diff rather than slipping through.
 */
describe("the world's feature flags", () => {
  it("are all off", () => {
    for (const feature of WORLD_FEATURES) {
      expect(
        worldConfig[feature as keyof typeof worldConfig],
        `worldConfig.${feature} is on. If that is deliberate, this test is the place to say so — ` +
          `and CINEMATIC_WORLD_PLAN.md wants the ?curve=1 numbers that justify it.`,
      ).toBe(false);
    }
  });

  it("cannot be switched on at runtime", () => {
    // Frozen rather than merely conventional. The scene is a long-lived module
    // graph with a dev-tools panel in it, and a flag that can be poked from a
    // console is a flag that can differ between the thing measured and the thing
    // shipped.
    expect(Object.isFrozen(worldConfig)).toBe(true);

    const before = worldConfig.sky;
    try {
      // @ts-expect-error - deliberately writing to a frozen object.
      worldConfig.sky = true;
    } catch {
      // Strict mode throws; sloppy mode silently ignores. Either is fine, so
      // long as the value did not move.
    }
    expect(worldConfig.sky).toBe(before);
  });

  it("covers the phases the plan says it covers", () => {
    // Named explicitly rather than derived. WORLD_FEATURES is Object.keys of the
    // config, so any test comparing the two can never fail however the config
    // changes — it looks like coverage and is not. This literal is the only thing
    // here that can actually catch a flag being added or removed, including one
    // added to the object but never registered.
    expect([...WORLD_FEATURES].sort()).toEqual(
      ["bodies", "contentAnchors", "heroStar", "rings", "sky"],
    );
  });
});
