import { describe, expect, it } from "vitest";

import {
  getAllSkillCategories,
  getAllSkills,
  getSkillBySlug,
  getSkillsByCategory,
  getSkillWebConfig,
  getSkillWebData,
} from "../skills";

describe("getAllSkillCategories", () => {
  it("returns categories sorted by order with unique slugs", () => {
    const categories = getAllSkillCategories();
    expect(categories.length).toBeGreaterThan(0);
    const orders = categories.map((category) => category.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(new Set(categories.map((category) => category.slug)).size).toBe(categories.length);
  });
});

describe("getAllSkills", () => {
  it("returns only published skills by default, sorted by skillsSectionOrder", () => {
    const skills = getAllSkills();
    expect(skills.length).toBeGreaterThan(0);
    for (const skill of skills) {
      expect(skill.status).toBe("published");
    }
    const orders = skills.map((skill) => skill.skillsSectionOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it("every skill references a category that exists", () => {
    const categorySlugs = new Set(getAllSkillCategories().map((category) => category.slug));
    for (const skill of getAllSkills({ includeDrafts: true })) {
      expect(categorySlugs.has(skill.category)).toBe(true);
    }
  });
});

describe("getSkillBySlug", () => {
  it("finds a known skill by slug", () => {
    const [first] = getAllSkills();
    expect(getSkillBySlug(first.slug)?.slug).toBe(first.slug);
  });

  it("returns undefined for an unknown slug", () => {
    expect(getSkillBySlug("does-not-exist")).toBeUndefined();
  });
});

describe("getSkillsByCategory", () => {
  it("groups every visible skill under its own category, in category order", () => {
    const grouped = getSkillsByCategory();
    const categories = getAllSkillCategories();
    expect(grouped.map((group) => group.category.slug)).toEqual(
      categories.map((category) => category.slug),
    );
    for (const group of grouped) {
      for (const skill of group.skills) {
        expect(skill.category).toBe(group.category.slug);
        expect(skill.showInSkillsSection).toBe(true);
      }
    }
  });
});

describe("getSkillWebConfig / getSkillWebData", () => {
  it("every skill's webCategory resolves to a real category in the web graph", () => {
    const data = getSkillWebData();
    expect(data.domains.length).toBeGreaterThan(0);

    const config = getSkillWebConfig();
    const configuredCategorySlugs = new Set(
      config.domains.flatMap((domain) => domain.categories.map((category) => category.slug)),
    );
    for (const skill of getAllSkills()) {
      expect(configuredCategorySlugs.has(skill.webCategory)).toBe(true);
    }
  });

  it("assigns every skill to exactly one category bucket in the web data", () => {
    const data = getSkillWebData();
    const placedSlugs = data.domains.flatMap((domain) =>
      domain.categories.flatMap((category) => category.skills.map((skill) => skill.slug)),
    );
    const publishedSlugs = getAllSkills().map((skill) => skill.slug);
    expect(new Set(placedSlugs)).toEqual(new Set(publishedSlugs));
    expect(placedSlugs.length).toBe(publishedSlugs.length);
  });
});
