import "server-only";

import resume from "@/data/resume.json";
import { getResumeInternships } from "./experience";
import { getAllProjects } from "./projects";
import { assertRecord, assertString, assertStringArray } from "./read-content";
import { getAllSkills } from "./skills";
import type { ResumeInternship, ResumeJson } from "./types";

/** resume.json is read everywhere else as a plain typed JSON import, with no
 *  runtime check that it actually matches ResumeJson - TypeScript's JSON
 *  module inference is a build-time convenience, not a runtime guarantee.
 *  This exists so the /admin tool can reject a malformed edit before it
 *  becomes a commit, the same way validateProject/validateSkill/
 *  validateExperience already do for their own files. */
export function validateResumeJson(value: unknown, source: string): ResumeJson {
  assertRecord(value, source);

  assertRecord(value.basics, `${source}.basics`);
  const basics = value.basics;
  for (const field of ["name", "headline", "location", "phone", "email"]) {
    assertString(basics[field], field, `${source}.basics`);
  }
  if (!Array.isArray(basics.links)) {
    throw new Error(`${source}.basics: "links" must be an array`);
  }
  basics.links.forEach((link, index) => {
    const linkSource = `${source}.basics.links[${index}]`;
    assertRecord(link, linkSource);
    assertString(link.label, "label", linkSource);
    assertString(link.url, "url", linkSource);
  });

  assertString(value.objective, "objective", source);
  assertStringArray(value.skillGroupOrder, "skillGroupOrder", source);

  assertRecord(value.education, `${source}.education`);
  for (const field of ["degree", "institution", "period", "cgpa"]) {
    assertString(value.education[field], field, `${source}.education`);
  }

  assertStringArray(value.certifications, "certifications", source);
  assertStringArray(value.languages, "languages", source);
  assertStringArray(value.strengths, "strengths", source);

  return value as unknown as ResumeJson;
}

export interface ResumeProject {
  slug: string;
  name: string;
  technologies: string;
  highlights: string[];
}

export interface ResumeSkillGroup {
  category: string;
  items: string[];
}

export interface ResumeData {
  internships: ResumeInternship[];
  projects: ResumeProject[];
  skillGroups: ResumeSkillGroup[];
}

/** Projects opted in to the one-page résumé, in their résumé order. */
export function getResumeProjects(): ResumeProject[] {
  return getAllProjects()
    .filter((project) => project.showInResume && project.resume)
    .sort((a, b) => (a.resume?.order ?? 0) - (b.resume?.order ?? 0))
    .map((project) => ({
      slug: project.slug,
      name: project.title,
      technologies: project.resume!.technologies,
      highlights: project.resume!.highlights,
    }));
}

/** Skills opted in to the résumé, grouped by their résumé grouping. Group order
 *  comes from resume.json so the ordering stays an editorial decision in one
 *  place rather than being spread across every skill file. */
export function getResumeSkillGroups(): ResumeSkillGroup[] {
  const skills = getAllSkills().filter((skill) => skill.showInResume);
  const declaredOrder: string[] = resume.skillGroupOrder;

  const groupNames = [
    ...declaredOrder.filter((name) => skills.some((s) => s.resumeGroup === name)),
    // Any group a skill declares but resume.json has not ordered still shows,
    // rather than silently disappearing from the résumé.
    ...[...new Set(skills.map((s) => s.resumeGroup as string))]
      .filter((name) => !declaredOrder.includes(name))
      .sort(),
  ];

  return groupNames.map((category) => ({
    category,
    items: skills
      .filter((skill) => skill.resumeGroup === category)
      .sort(
        (a, b) =>
          (a.resumeOrder ?? a.skillsSectionOrder) - (b.resumeOrder ?? b.skillsSectionOrder),
      )
      .map((skill) => skill.resumeLabel ?? skill.name),
  }));
}

export function getResumeData(): ResumeData {
  return {
    internships: getResumeInternships(),
    projects: getResumeProjects(),
    skillGroups: getResumeSkillGroups(),
  };
}
