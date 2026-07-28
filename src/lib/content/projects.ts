import "server-only";

import {
  assertRecord,
  assertString,
  assertStringArray,
  assertUniqueSlugs,
  readJsonDirectory,
} from "./read-content";
import type { ProjectContent } from "./types";

function validateProject(value: unknown, source: string): ProjectContent {
  assertRecord(value, source);

  for (const field of ["slug", "title", "summary", "status", "image", "imageAlt", "role"]) {
    assertString(value[field], field, source);
  }
  for (const field of [
    "skills",
    "overview",
    "features",
    "highlights",
    "lessonsLearned",
  ]) {
    assertStringArray(value[field], field, source);
  }

  if (value.status !== "draft" && value.status !== "published") {
    throw new Error(`${source}: "status" must be "draft" or "published"`);
  }
  if (typeof value.id !== "number" || typeof value.projectsSectionOrder !== "number") {
    throw new Error(`${source}: "id" and "projectsSectionOrder" must be numbers`);
  }
  if (typeof value.featured !== "boolean" || typeof value.showInProjectsSection !== "boolean") {
    throw new Error(`${source}: visibility fields must be booleans`);
  }
  if (!Array.isArray(value.howItWorks) || !Array.isArray(value.buildingProcess)) {
    throw new Error(`${source}: process fields must be arrays`);
  }
  if (!Array.isArray(value.challenges) || !Array.isArray(value.outcomes) || !Array.isArray(value.gallery)) {
    throw new Error(`${source}: detail fields must be arrays`);
  }
  assertRecord(value.seo, `${source}.seo`);
  assertString(value.seo.title, "title", `${source}.seo`);
  assertString(value.seo.description, "description", `${source}.seo`);

  return value as unknown as ProjectContent;
}

let projectCache: ProjectContent[] | undefined;

export function getAllProjects(options: { includeDrafts?: boolean } = {}): ProjectContent[] {
  if (!projectCache) {
    projectCache = readJsonDirectory("projects").map(({ source, value }) =>
      validateProject(value, source),
    );
    assertUniqueSlugs(projectCache, "projects");
  }

  return projectCache
    .filter((project) => options.includeDrafts || project.status === "published")
    .sort((a, b) => a.projectsSectionOrder - b.projectsSectionOrder);
}

export function getProjectBySlug(slug: string): ProjectContent | undefined {
  return getAllProjects().find((project) => project.slug === slug);
}

export function getFeaturedProjects(): ProjectContent[] {
  return getAllProjects().filter((project) => project.featured);
}

export function getHomepageProjects(): ProjectContent[] {
  return getAllProjects().filter((project) => project.showInProjectsSection);
}
