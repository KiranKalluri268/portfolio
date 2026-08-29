import { describe, expect, it } from "vitest";
import { resolveArmGain, resolveFov, resolveSkyLayers, resolveWorldConfig, worldConfig, WORLD_FEATURES } from "../worldConfig";

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

describe("URL overrides", () => {
  it("turns a named feature on for this load", () => {
    expect(resolveWorldConfig("?world=sky").sky).toBe(true);
  });

  it("leaves everything else alone", () => {
    const resolved = resolveWorldConfig("?world=sky");
    expect(resolved.bodies).toBe(false);
    expect(resolved.rings).toBe(false);
    expect(resolved.contentAnchors).toBe(false);
    expect(resolved.heroStar).toBe(false);
  });

  it("takes several at once", () => {
    const resolved = resolveWorldConfig("?world=sky,rings");
    expect(resolved.sky).toBe(true);
    expect(resolved.rings).toBe(true);
    expect(resolved.bodies).toBe(false);
  });

  it("ignores whitespace and empty entries", () => {
    expect(resolveWorldConfig("?world= sky , ,rings ").sky).toBe(true);
    expect(resolveWorldConfig("?world= sky , ,rings ").rings).toBe(true);
  });

  it("ignores a name that is not a feature", () => {
    // A typo must leave the journey exactly as it was. Silently adding a
    // property nothing reads would be worse than either failing or ignoring.
    const resolved = resolveWorldConfig("?world=skyy,__proto__,toString");
    expect(resolved.sky).toBe(false);
    expect(Object.keys(resolved).sort()).toEqual([...WORLD_FEATURES].sort());
  });

  it("changes nothing without the parameter", () => {
    for (const search of ["", "?", "?devtools=1", "?world="]) {
      const resolved = resolveWorldConfig(search);
      for (const feature of WORLD_FEATURES) {
        expect(resolved[feature as keyof typeof resolved]).toBe(false);
      }
    }
  });

  it("hands back something that cannot be edited either", () => {
    expect(Object.isFrozen(resolveWorldConfig("?world=sky"))).toBe(true);
  });

  it("never touches the shipped defaults", () => {
    // The override is per-load. If it mutated the module's own object, one
    // visitor's query string would change what the next render did.
    resolveWorldConfig("?world=sky,bodies,rings,contentAnchors,heroStar");
    for (const feature of WORLD_FEATURES) {
      expect(worldConfig[feature as keyof typeof worldConfig]).toBe(false);
    }
  });
});

describe("the arm gain override", () => {
  it("uses the shipped value when nothing asks otherwise", () => {
    expect(resolveArmGain("", 0.035)).toBe(0.035);
    expect(resolveArmGain("?world=sky", 0.035)).toBe(0.035);
  });

  it("takes a number from the URL", () => {
    expect(resolveArmGain("?armGain=0.2", 0.035)).toBe(0.2);
    expect(resolveArmGain("?world=sky&armGain=1", 0.035)).toBe(1);
  });

  it("falls back rather than rendering an invisible or blown-out sky", () => {
    for (const bad of ["", "abc", "-1", "99", "NaN", "Infinity"]) {
      expect(resolveArmGain(`?armGain=${bad}`, 0.035)).toBe(0.035);
    }
  });

  it("allows zero, which is a legitimate answer", () => {
    expect(resolveArmGain("?armGain=0", 0.035)).toBe(0);
  });
});

describe("the sky's layer switches", () => {
  it("draws everything by default", () => {
    expect(resolveSkyLayers("")).toEqual({
      dust: true, glow: true, nebula: true, stars: true,
    });
    expect(resolveSkyLayers("?world=sky")).toEqual({
      dust: true, glow: true, nebula: true, stars: true,
    });
  });

  it("turns off one layer", () => {
    expect(resolveSkyLayers("?sky=nodust").dust).toBe(false);
    expect(resolveSkyLayers("?sky=nodust").glow).toBe(true);
  });

  it("turns off several", () => {
    const layers = resolveSkyLayers("?sky=noglow,nonebula");
    expect(layers.glow).toBe(false);
    expect(layers.nebula).toBe(false);
    expect(layers.dust).toBe(true);
    expect(layers.stars).toBe(true);
  });

  it("needs the no- prefix, so a bare layer name does not switch it off", () => {
    // ?sky=dust reads like "give me dust", and turning it off would be the
    // opposite of what was asked for.
    expect(resolveSkyLayers("?sky=dust").dust).toBe(true);
  });

  it("ignores names that are not layers", () => {
    expect(resolveSkyLayers("?sky=nothing,noconstructor,no")).toEqual({
      dust: true, glow: true, nebula: true, stars: true,
    });
  });

  it("is case-insensitive and tolerates spacing", () => {
    expect(resolveSkyLayers("?sky= NoDust , NOGLOW ").dust).toBe(false);
    expect(resolveSkyLayers("?sky= NoDust , NOGLOW ").glow).toBe(false);
  });

  it("cannot be edited after the fact", () => {
    expect(Object.isFrozen(resolveSkyLayers("?sky=nodust"))).toBe(true);
  });
});

describe("the field of view override", () => {
  it("keeps the scene's own value when nothing asks otherwise", () => {
    expect(resolveFov("", 90)).toBe(90);
    expect(resolveFov("?world=sky", 90)).toBe(90);
  });

  it("takes a field of view from the URL", () => {
    expect(resolveFov("?fov=65", 90)).toBe(65);
    expect(resolveFov("?world=sky&fov=72.5", 90)).toBe(72.5);
  });

  it("refuses values that would not render a usable frame", () => {
    // Below 20 the scene is a telescope; above 120 a flat image plane stops
    // being able to represent the angles at all, which is the very problem this
    // parameter exists to tune.
    for (const bad of ["0", "19", "121", "180", "-65", "abc", "", "NaN"]) {
      expect(resolveFov(`?fov=${bad}`, 90)).toBe(90);
    }
  });

  it("accepts both ends of the usable range", () => {
    expect(resolveFov("?fov=20", 90)).toBe(20);
    expect(resolveFov("?fov=120", 90)).toBe(120);
  });
});
