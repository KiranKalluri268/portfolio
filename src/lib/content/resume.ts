import "server-only";

import resume from "@/data/resume.json";
import { getResumeInternships } from "./experience";
import { getAllProjects } from "./projects";
import { getAllSkills } from "./skills";
import type { ResumeInternship } from "./types";

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
