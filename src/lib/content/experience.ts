import "server-only";

import {
  assertRecord,
  assertString,
  assertStringArray,
  assertUniqueSlugs,
  readJsonDirectory,
} from "./read-content";
import type {
  ExperienceContent,
  ExperienceRecommendation,
  ExperienceWorkItem,
  ResumeInternship,
} from "./types";

const WORK_ITEM_KINDS = new Set([
  "feature",
  "integration",
  "research",
  "infrastructure",
  "improvement",
]);

const WORK_MODES = new Set(["On-site", "Hybrid", "Remote"]);

function validateWorkItem(value: unknown, source: string): ExperienceWorkItem {
  assertRecord(value, source);
  assertString(value.title, "title", source);
  assertString(value.description, "description", source);

  if (value.kind !== undefined && !WORK_ITEM_KINDS.has(value.kind as string)) {
    throw new Error(
      `${source}: "kind" must be one of ${[...WORK_ITEM_KINDS].join(", ")}`,
    );
  }
  if (value.skills !== undefined) assertStringArray(value.skills, "skills", source);
  if (value.projectSlug !== undefined) {
    assertString(value.projectSlug, "projectSlug", source);
  }

  return {
    ...(value as unknown as ExperienceWorkItem),
    skills: (value.skills as string[] | undefined) ?? [],
  };
}

function validateRecommendation(value: unknown, source: string): ExperienceRecommendation {
  assertRecord(value, source);
  assertStringArray(value.quote, "quote", source);
  if ((value.quote as string[]).length === 0) {
    throw new Error(`${source}: "quote" must contain at least one paragraph`);
  }
  assertString(value.author, "author", source);
  assertString(value.authorTitle, "authorTitle", source);
  // A link without a label renders as a bare URL, so require them together.
  if (value.sourceUrl !== undefined) {
    assertString(value.sourceUrl, "sourceUrl", source);
    assertString(value.sourceLabel, "sourceLabel", source);
  }
  return value as unknown as ExperienceRecommendation;
}

export function validateExperience(value: unknown, source: string): ExperienceContent {
  assertRecord(value, source);

  for (const field of ["slug", "role", "company", "status", "summary", "resumePeriod"]) {
    assertString(value[field], field, source);
  }
  for (const field of ["highlights", "overview", "skills", "lessonsLearned"]) {
    if (value[field] !== undefined) assertStringArray(value[field], field, source);
  }

  if (value.status !== "draft" && value.status !== "published") {
    throw new Error(`${source}: "status" must be "draft" or "published"`);
  }
  if (typeof value.timelineOrder !== "number") {
    throw new Error(`${source}: "timelineOrder" must be a number`);
  }
  if (typeof value.showInTimeline !== "boolean" || typeof value.showInResume !== "boolean") {
    throw new Error(`${source}: "showInTimeline" and "showInResume" must be booleans`);
  }
  if (value.workMode !== undefined && !WORK_MODES.has(value.workMode as string)) {
    throw new Error(`${source}: "workMode" must be one of ${[...WORK_MODES].join(", ")}`);
  }

  assertRecord(value.period, `${source}.period`);
  for (const field of ["startLabel", "startDate", "endLabel"]) {
    assertString(value.period[field], field, `${source}.period`);
  }
  if (value.period.endDate !== undefined) {
    assertString(value.period.endDate, "endDate", `${source}.period`);
  }

  if (value.workItems !== undefined && !Array.isArray(value.workItems)) {
    throw new Error(`${source}: "workItems" must be an array`);
  }
  const workItems = ((value.workItems as unknown[] | undefined) ?? []).map((item, index) =>
    validateWorkItem(item, `${source}.workItems[${index}]`),
  );

  if (value.outcomes !== undefined && !Array.isArray(value.outcomes)) {
    throw new Error(`${source}: "outcomes" must be an array`);
  }

  if (value.recommendations !== undefined && !Array.isArray(value.recommendations)) {
    throw new Error(`${source}: "recommendations" must be an array`);
  }
  const recommendations = ((value.recommendations as unknown[] | undefined) ?? []).map(
    (item, index) => validateRecommendation(item, `${source}.recommendations[${index}]`),
  );

  assertRecord(value.seo, `${source}.seo`);
  assertString(value.seo.title, "title", `${source}.seo`);
  assertString(value.seo.description, "description", `${source}.seo`);

  return {
    ...(value as unknown as ExperienceContent),
    highlights: (value.highlights as string[] | undefined) ?? [],
    overview: (value.overview as string[] | undefined) ?? [],
    skills: (value.skills as string[] | undefined) ?? [],
    lessonsLearned: (value.lessonsLearned as string[] | undefined) ?? [],
    outcomes: (value.outcomes as ExperienceContent["outcomes"] | undefined) ?? [],
    workItems,
    recommendations,
  };
}

let experienceCache: ExperienceContent[] | undefined;

export function getAllExperiences(
  options: { includeDrafts?: boolean } = {},
): ExperienceContent[] {
  if (!experienceCache) {
    experienceCache = readJsonDirectory("experience").map(({ source, value }) =>
      validateExperience(value, source),
    );
    assertUniqueSlugs(experienceCache, "experience");
  }

  return experienceCache
    .filter((experience) => options.includeDrafts || experience.status === "published")
    .sort((a, b) => a.timelineOrder - b.timelineOrder);
}

export function getExperienceBySlug(slug: string): ExperienceContent | undefined {
  return getAllExperiences().find((experience) => experience.slug === slug);
}

/** Roles shown on the homepage timeline, most recent first. */
export function getTimelineExperiences(): ExperienceContent[] {
  return getAllExperiences().filter((experience) => experience.showInTimeline);
}

/** A recommendation paired with the role it was written for, flattened for the
 *  client components that display it. */
export interface RecommendationEntry extends ExperienceRecommendation {
  company: string;
  roleTitle: string;
  experienceSlug: string;
}

/** Every recommendation across all roles, most recent role first. */
export function getAllRecommendations(): RecommendationEntry[] {
  return getAllExperiences().flatMap((experience) =>
    experience.recommendations.map((recommendation) => ({
      ...recommendation,
      company: experience.company,
      roleTitle: experience.role,
      experienceSlug: experience.slug,
    })),
  );
}

export function getResumeInternships(): ResumeInternship[] {
  return getAllExperiences()
    .filter((experience) => experience.showInResume)
    .map((experience) => ({
      role: experience.role,
      company: experience.company,
      period: experience.resumePeriod,
      highlights: experience.highlights,
    }));
}
