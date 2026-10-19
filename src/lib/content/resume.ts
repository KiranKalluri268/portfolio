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
  if (value.skillExtras !== undefined) {
    if (!Array.isArray(value.skillExtras)) {
      throw new Error(`${source}: "skillExtras" must be an array`);
    }
    value.skillExtras.forEach((extra, index) => {
      const extraSource = `${source}.skillExtras[${index}]`;
      assertRecord(extra, extraSource);
      assertString(extra.group, "group", extraSource);
      assertString(extra.label, "label", extraSource);
      if (typeof extra.order !== "number") {
        throw new Error(`${extraSource}: "order" must be a number`);
      }
    });
  }

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
  liveUrl?: string;
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
      name: project.resume!.title ?? project.title,
      liveUrl: project.liveUrl ?? undefined,
      technologies: project.resume!.technologies,
      highlights: project.resume!.highlights,
    }));
}

/** Skills opted in to the résumé, grouped by their résumé grouping. Group order
 *  comes from resume.json so the ordering stays an editorial decision in one
 *  place rather than being spread across every skill file. */
export function getResumeSkillGroups(): ResumeSkillGroup[] {
  const entries = [
    ...getAllSkills()
      .filter((skill) => skill.showInResume)
      .map((skill) => ({
        group: skill.resumeGroup as string,
        label: skill.resumeLabel ?? skill.name,
        order: skill.resumeOrder ?? skill.skillsSectionOrder,
      })),
    // Lines such as CI/CD that belong on the résumé but are not skills with a
    // page of their own.
    ...((resume as ResumeJson).skillExtras ?? []),
  ];
  const declaredOrder: string[] = resume.skillGroupOrder;

  const groupNames = [
    ...declaredOrder.filter((name) => entries.some((entry) => entry.group === name)),
    // Any group a skill declares but resume.json has not ordered still shows,
    // rather than silently disappearing from the résumé.
    ...[...new Set(entries.map((entry) => entry.group))]
      .filter((name) => !declaredOrder.includes(name))
      .sort(),
  ];

  return groupNames.map((category) => ({
    category,
    items: entries
      .filter((entry) => entry.group === category)
      .sort((a, b) => a.order - b.order)
      .map((entry) => entry.label),
  }));
}

export function getResumeData(): ResumeData {
  return {
    internships: getResumeInternships(),
    projects: getResumeProjects(),
    skillGroups: getResumeSkillGroups(),
  };
}
