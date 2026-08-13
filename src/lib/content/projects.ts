import "server-only";

import {
  assertRecord,
  assertString,
  assertStringArray,
  assertUniqueSlugs,
  readJsonDirectory,
} from "./read-content";
import type { ProjectContent } from "./types";

export function validateProject(value: unknown, source: string): ProjectContent {
  assertRecord(value, source);

  for (const field of ["slug", "title", "summary", "status", "role"]) {
    assertString(value[field], field, source);
  }
  // A screenshot is optional, but an image must always carry alt text.
  if (value.image !== undefined) {
    assertString(value.image, "image", source);
    assertString(value.imageAlt, "imageAlt", source);
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
  if (
    typeof value.featured !== "boolean" ||
    typeof value.showInProjectsSection !== "boolean" ||
    typeof value.showInResume !== "boolean"
  ) {
    throw new Error(`${source}: visibility fields must be booleans`);
  }
  // A project on the résumé needs its résumé wording, since the case study's
  // is written for a different length.
  if (value.showInResume) {
    assertRecord(value.resume, `${source}.resume`);
    assertString(value.resume.technologies, "technologies", `${source}.resume`);
    assertStringArray(value.resume.highlights, "highlights", `${source}.resume`);
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
