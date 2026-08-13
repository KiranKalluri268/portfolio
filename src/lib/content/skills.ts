import "server-only";

import {
  assertRecord,
  assertString,
  assertStringArray,
  assertUniqueSlugs,
  readJsonDirectory,
  readJsonFile,
} from "./read-content";
import type {
  SkillCategoryContent,
  SkillContent,
  SkillWebConfig,
  SkillWebData,
  SkillWebDomainContent,
} from "./types";

const DETAIL_ARRAY_FIELDS = [
  "whatItIs",
  "howILearned",
  "howIUseIt",
  "concepts",
  "lessonsLearned",
] as const;

export function validateSkill(value: unknown, source: string): SkillContent {
  assertRecord(value, source);
  for (const field of ["slug", "name", "shortDescription", "status", "category", "webCategory"]) {
    assertString(value[field], field, source);
  }
  if (value.status !== "draft" && value.status !== "published") {
    throw new Error(`${source}: "status" must be "draft" or "published"`);
  }
  if (typeof value.showInSkillsSection !== "boolean" || typeof value.skillsSectionOrder !== "number") {
    throw new Error(`${source}: skill visibility and order fields are required`);
  }
  if (typeof value.showInResume !== "boolean") {
    throw new Error(`${source}: "showInResume" must be a boolean`);
  }
  // A skill on the résumé needs a group to sit under, since the résumé's
  // grouping is editorial rather than the skill graph's categories.
  if (value.showInResume) {
    assertString(value.resumeGroup, "resumeGroup", source);
  }
  for (const field of ["resumeLabel", "resumeGroup"] as const) {
    if (value[field] !== undefined) assertString(value[field], field, source);
  }
  if (value.resumeOrder !== undefined && typeof value.resumeOrder !== "number") {
    throw new Error(`${source}: "resumeOrder" must be a number`);
  }
  for (const field of DETAIL_ARRAY_FIELDS) {
    if (value[field] !== undefined) assertStringArray(value[field], field, source);
  }
  if (value.resources !== undefined && !Array.isArray(value.resources)) {
    throw new Error(`${source}: "resources" must be an array`);
  }
  assertRecord(value.seo, `${source}.seo`);
  assertString(value.seo.title, "title", `${source}.seo`);
  assertString(value.seo.description, "description", `${source}.seo`);

  return {
    ...(value as unknown as SkillContent),
    whatItIs: (value.whatItIs as string[] | undefined) ?? [],
    howILearned: (value.howILearned as string[] | undefined) ?? [],
    howIUseIt: (value.howIUseIt as string[] | undefined) ?? [],
    concepts: (value.concepts as string[] | undefined) ?? [],
    lessonsLearned: (value.lessonsLearned as string[] | undefined) ?? [],
    resources: (value.resources as SkillContent["resources"] | undefined) ?? [],
  };
}

export function validateCategory(value: unknown, source: string): SkillCategoryContent {
  assertRecord(value, source);
  assertString(value.slug, "slug", source);
  assertString(value.label, "label", source);
  if (typeof value.order !== "number") throw new Error(`${source}: "order" must be a number`);
  if (value.marqueeDirection !== "left" && value.marqueeDirection !== "right") {
    throw new Error(`${source}: "marqueeDirection" must be "left" or "right"`);
  }
  return value as unknown as SkillCategoryContent;
}

let skillCache: SkillContent[] | undefined;
let categoryCache: SkillCategoryContent[] | undefined;
let skillWebConfigCache: SkillWebConfig | undefined;

export function getAllSkillCategories(): SkillCategoryContent[] {
  if (!categoryCache) {
    const { source, value } = readJsonFile("skill-categories.json");
    if (!Array.isArray(value)) throw new Error(`${source}: expected an array`);
    categoryCache = value.map((category, index) =>
      validateCategory(category, `${source}[${index}]`),
    );
    assertUniqueSlugs(categoryCache, "skill categories");
  }
  return [...categoryCache].sort((a, b) => a.order - b.order);
}

export function getAllSkills(options: { includeDrafts?: boolean } = {}): SkillContent[] {
  if (!skillCache) {
    skillCache = readJsonDirectory("skills").map(({ source, value }) =>
      validateSkill(value, source),
    );
    assertUniqueSlugs(skillCache, "skills");

    const categories = new Set(getAllSkillCategories().map((category) => category.slug));
    for (const skill of skillCache) {
      if (!categories.has(skill.category)) {
        throw new Error(`skills/${skill.slug}.json: unknown category "${skill.category}"`);
      }
    }
  }

  return skillCache
    .filter((skill) => options.includeDrafts || skill.status === "published")
    .sort((a, b) => a.skillsSectionOrder - b.skillsSectionOrder);
}

export function getSkillBySlug(slug: string): SkillContent | undefined {
  return getAllSkills().find((skill) => skill.slug === slug);
}

export function getSkillsByCategory(): Array<{
  category: SkillCategoryContent;
  skills: SkillContent[];
}> {
  const skills = getAllSkills().filter((skill) => skill.showInSkillsSection);
  return getAllSkillCategories().map((category) => ({
    category,
    skills: skills.filter((skill) => skill.category === category.slug),
  }));
}

export function validateWebDomain(value: unknown, source: string): SkillWebDomainContent {
  assertRecord(value, source);
  for (const field of ["slug", "label", "description", "accent"]) {
    assertString(value[field], field, source);
  }
  if (typeof value.angle !== "number") {
    throw new Error(`${source}: "angle" must be a number`);
  }
  if (!Array.isArray(value.categories)) {
    throw new Error(`${source}: "categories" must be an array`);
  }
  const categories = value.categories.map((category, index) => {
    const categorySource = `${source}.categories[${index}]`;
    assertRecord(category, categorySource);
    for (const field of ["slug", "label", "description"]) {
      assertString(category[field], field, categorySource);
    }
    return category as unknown as SkillWebDomainContent["categories"][number];
  });
  assertUniqueSlugs(categories, `${source} categories`);
  return { ...(value as unknown as SkillWebDomainContent), categories };
}

export function getSkillWebConfig(): SkillWebConfig {
  if (!skillWebConfigCache) {
    const { source, value } = readJsonFile("skill-web.json");
    assertRecord(value, source);
    assertRecord(value.center, `${source}.center`);
    assertString(value.center.label, "label", `${source}.center`);
    assertString(value.center.eyebrow, "eyebrow", `${source}.center`);
    if (!Array.isArray(value.domains)) throw new Error(`${source}: "domains" must be an array`);
    const domains = value.domains.map((domain, index) =>
      validateWebDomain(domain, `${source}.domains[${index}]`),
    );
    assertUniqueSlugs(domains, "skill web domains");
    skillWebConfigCache = {
      center: value.center as SkillWebConfig["center"],
      domains,
    };
  }
  return skillWebConfigCache;
}

export function getSkillWebData(): SkillWebData {
  const config = getSkillWebConfig();
  const skills = getAllSkills();
  const categorySlugs = new Set(
    config.domains.flatMap((domain) => domain.categories.map((category) => category.slug)),
  );

  for (const skill of skills) {
    if (!categorySlugs.has(skill.webCategory)) {
      throw new Error(`skills/${skill.slug}.json: unknown web category "${skill.webCategory}"`);
    }
  }

  return {
    center: config.center,
    domains: config.domains.map((domain) => ({
      ...domain,
      categories: domain.categories.map((category) => ({
        ...category,
        skills: skills.filter((skill) => skill.webCategory === category.slug),
      })),
    })),
  };
}
