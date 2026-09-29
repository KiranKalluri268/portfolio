import "server-only";

import {
  assertRecord,
  assertString,
  assertStringArray,
  assertUniqueSlugs,
  readJsonDirectory,
} from "./read-content";
import type { ProjectContent, ProjectGalleryItem } from "./types";

export function getProjectGalleryImages(project: ProjectContent): ProjectGalleryItem[] {
  return Object.entries(project.gallery)
    .sort(([first], [second]) => Number(first.slice(6)) - Number(second.slice(6)))
    .flatMap(([key, image]) => {
      if (image === null) return [];
      if (typeof image === "string") {
        return [{ src: image, alt: `${project.title} screenshot ${key.slice(6)}` }];
      }
      return [image];
    });
}

export function validateProject(value: unknown, source: string): ProjectContent {
  assertRecord(value, source);

  for (const field of ["slug", "title", "summary", "status", "role"]) {
    assertString(value[field], field, source);
  }
  // A screenshot is optional, but an image must always carry alt text.
  if (value.image !== undefined && value.image !== null) {
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
  // showInResumeAi is optional (most projects appear on neither, one, or the
  // other résumé) so existing files without it are still valid; when present
  // it follows the same rule as showInResume above.
  if (value.showInResumeAi !== undefined && typeof value.showInResumeAi !== "boolean") {
    throw new Error(`${source}: "showInResumeAi" must be a boolean`);
  }
  if (value.showInResumeAi) {
    assertRecord(value.resumeAi, `${source}.resumeAi`);
    assertString(value.resumeAi.technologies, "technologies", `${source}.resumeAi`);
    assertStringArray(value.resumeAi.highlights, "highlights", `${source}.resumeAi`);
  }
  if (!Array.isArray(value.howItWorks) || !Array.isArray(value.buildingProcess)) {
    throw new Error(`${source}: process fields must be arrays`);
  }
  if (!Array.isArray(value.challenges) || !Array.isArray(value.outcomes)) {
    throw new Error(`${source}: challenges and outcomes must be arrays`);
  }
  assertRecord(value.gallery, `${source}.gallery`);
  for (const [key, image] of Object.entries(value.gallery)) {
    if (!/^image-[1-9]\d*$/.test(key)) {
      throw new Error(`${source}.gallery: "${key}" must use image-1, image-2, ...`);
    }
    if (image === null) continue;
    if (typeof image === "string") {
      assertString(image, key, `${source}.gallery`);
      continue;
    }
    assertRecord(image, `${source}.gallery.${key}`);
    assertString(image.src, "src", `${source}.gallery.${key}`);
    assertString(image.alt, "alt", `${source}.gallery.${key}`);
    if (image.caption !== undefined) {
      assertString(image.caption, "caption", `${source}.gallery.${key}`);
    }
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
