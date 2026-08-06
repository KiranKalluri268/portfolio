// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { SKILL_ICONS } from "../skill-icons";

/**
 * A guard for the failure mode that broke a build once and could break one
 * again more quietly.
 *
 * `react-icons` follows Simple Icons, which removes brands when asked. 5.7
 * dropped six marks used here. That surfaced as a build error, which is the
 * loud version — but an entry that resolves to `undefined` instead would
 * render nothing at all and pass every other check, leaving a skill with a
 * blank space where its logo was.
 */
describe("skill brand marks", () => {
  const entries = Object.entries(SKILL_ICONS);

  it("maps at least one mark", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries)("%s resolves to something renderable", (_slug, Icon) => {
    expect(Icon).toBeDefined();
    // Icon components are functions, or objects once wrapped in memo/forwardRef.
    expect(["function", "object"]).toContain(typeof Icon);
  });

  it("has no duplicate slugs", () => {
    const slugs = entries.map(([slug]) => slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
