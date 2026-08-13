import "server-only";

import { assertRecord, assertString, assertUniqueSlugs } from "@/lib/content/read-content";
import { validateAboutJson } from "@/lib/content/about";
import { validateExperience } from "@/lib/content/experience";
import { validateProject } from "@/lib/content/projects";
import { validateResumeJson } from "@/lib/content/resume";
import { validateCategory, validateSkill, validateWebDomain } from "@/lib/content/skills";

/** Same shape checks the site itself runs at build time, reused here so a
 *  bad edit can be caught before it becomes a commit rather than after. */
export function validateContentForPath(relativePath: string, value: unknown): void {
  if (relativePath.startsWith("projects/")) {
    validateProject(value, relativePath);
    return;
  }

  if (relativePath.startsWith("skills/")) {
    validateSkill(value, relativePath);
    return;
  }

  if (relativePath.startsWith("experience/")) {
    validateExperience(value, relativePath);
    return;
  }

  if (relativePath === "skill-categories.json") {
    if (!Array.isArray(value)) throw new Error(`${relativePath}: expected an array`);
    const categories = value.map((category, index) =>
      validateCategory(category, `${relativePath}[${index}]`),
    );
    assertUniqueSlugs(categories, "skill categories");
    return;
  }

  if (relativePath === "skill-web.json") {
    assertRecord(value, relativePath);
    assertRecord(value.center, `${relativePath}.center`);
    assertString(value.center.label, "label", `${relativePath}.center`);
    assertString(value.center.eyebrow, "eyebrow", `${relativePath}.center`);
    if (!Array.isArray(value.domains)) {
      throw new Error(`${relativePath}: "domains" must be an array`);
    }
    const domains = value.domains.map((domain, index) =>
      validateWebDomain(domain, `${relativePath}.domains[${index}]`),
    );
    assertUniqueSlugs(domains, "skill web domains");
    return;
  }

  if (relativePath === "resume.json") {
    validateResumeJson(value, relativePath);
    return;
  }

  if (relativePath === "about.json") {
    validateAboutJson(value, relativePath);
    return;
  }

  assertRecord(value, relativePath);
}
