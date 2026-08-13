import "server-only";

import { assertRecord, assertString, assertUniqueSlugs } from "@/lib/content/read-content";
import { validateExperience } from "@/lib/content/experience";
import { validateProject } from "@/lib/content/projects";
import { validateCategory, validateSkill, validateWebDomain } from "@/lib/content/skills";

/** Same shape checks the site itself runs at build time, reused here so a
 *  bad edit can be caught before it becomes a commit rather than after.
 *
 *  `resume.json` and `about.json` have no runtime validator of their own -
 *  they're read as plain typed JSON imports, so TypeScript only checks their
 *  shape at build time, not at runtime. This function can only confirm they
 *  parse as an object for those two; a genuinely malformed edit there would
 *  still be caught by CI on the resulting PR, just not here.
 */
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

  // resume.json, about.json: no dedicated validator exists yet (see the
  // module comment above) - an object is all that can be confirmed here.
  assertRecord(value, relativePath);
}
