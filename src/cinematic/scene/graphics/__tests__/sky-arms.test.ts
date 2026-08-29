import { describe, expect, it, vi } from "vitest";
import skillWeb from "@/data/skill-web.json";
import { buildArmUniforms, DOMAIN_SLOTS } from "../skyArms";

/**
 * The sky's arms are the skill web. These tests are where §8's "content never
 * forks" rule is actually held to: if the angles or the colours ever stop coming
 * out of skill-web.json, one of these fails.
 */
describe("the sky's domain arms", () => {
  it("takes every domain from the real skill web", () => {
    const { count } = buildArmUniforms(skillWeb);
    expect(count).toBe(skillWeb.domains.length);
    expect(count).toBeGreaterThan(0);
  });

  it("uses each domain's own accent colour", () => {
    const { colors } = buildArmUniforms(skillWeb);

    skillWeb.domains.forEach((domain, index) => {
      const hex = domain.accent.replace("#", "");
      const expected = [
        parseInt(hex.slice(0, 2), 16) / 255,
        parseInt(hex.slice(2, 4), 16) / 255,
        parseInt(hex.slice(4, 6), 16) / 255,
      ];
      expect(colors[index][0]).toBeCloseTo(expected[0], 5);
      expect(colors[index][1]).toBeCloseTo(expected[1], 5);
      expect(colors[index][2]).toBeCloseTo(expected[2], 5);
    });
  });

  it("uses each domain's own angle, in radians", () => {
    const { angles } = buildArmUniforms(skillWeb);
    skillWeb.domains.forEach((domain, index) => {
      expect(angles[index]).toBeCloseTo((domain.angle * Math.PI) / 180, 6);
    });
  });

  it("follows the data rather than a copy of it", () => {
    // The point of the whole module. A domain added to the JSON must show up in
    // the sky with no shader edit and no change here.
    const invented = {
      domains: [
        { slug: "a", angle: 0, accent: "#ff0000" },
        { slug: "b", angle: 90, accent: "#00ff00" },
        { slug: "c", angle: -45, accent: "#0000ff" },
      ],
    };
    const { count, angles, colors } = buildArmUniforms(invented);
    expect(count).toBe(3);
    expect(angles[1]).toBeCloseTo(Math.PI / 2, 6);
    expect(angles[2]).toBeCloseTo(-Math.PI / 4, 6);
    expect(colors[0]).toEqual([1, 0, 0]);
    expect(colors[2]).toEqual([0, 0, 1]);
  });

  it("pads to the shader's fixed array length", () => {
    // GLSL ES 1.00 needs a constant loop bound, so the uniform arrays are always
    // full length whatever the data says. A short array uploads as garbage.
    const { angles, colors } = buildArmUniforms(skillWeb);
    expect(angles).toHaveLength(DOMAIN_SLOTS);
    expect(colors).toHaveLength(DOMAIN_SLOTS);
    for (const color of colors) expect(color).toHaveLength(3);
  });

  it("leaves the unused slots black rather than undefined", () => {
    const { count, angles, colors } = buildArmUniforms(skillWeb);
    for (let i = count; i < DOMAIN_SLOTS; i++) {
      expect(angles[i]).toBe(0);
      expect(colors[i]).toEqual([0, 0, 0]);
    }
  });

  it("skips a domain the shader could not draw, rather than drawing it wrong", () => {
    const broken = {
      domains: [
        { slug: "fine", angle: 30, accent: "#abcdef" },
        { slug: "no-angle", accent: "#123456" },
        { slug: "bad-colour", angle: 10, accent: "not a colour" },
        { slug: "also-fine", angle: 60, accent: "#fff" },
      ],
    };
    const { count, colors } = buildArmUniforms(broken);
    expect(count).toBe(2);
    // The short form expands, so the second kept domain is white.
    expect(colors[1]).toEqual([1, 1, 1]);
  });

  it("says so when the data outgrows the shader", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tooMany = {
      domains: Array.from({ length: DOMAIN_SLOTS + 2 }, (_, i) => ({
        slug: `d${i}`,
        angle: i * 20,
        accent: "#ffffff",
      })),
    };
    const { count } = buildArmUniforms(tooMany);
    expect(count).toBe(DOMAIN_SLOTS);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("survives a missing or malformed file", () => {
    expect(buildArmUniforms(undefined).count).toBe(0);
    expect(buildArmUniforms({}).count).toBe(0);
    expect(buildArmUniforms({ domains: "nonsense" }).count).toBe(0);
  });
});
