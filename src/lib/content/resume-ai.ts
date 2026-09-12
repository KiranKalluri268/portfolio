import "server-only";

import resumeAi from "@/data/resume-ai.json";
import { getResumeInternships } from "./experience";
import { getAllProjects } from "./projects";
import { getAllSkills } from "./skills";
import type { ResumeProject, ResumeSkillGroup } from "./resume";
import type { ResumeInternship } from "./types";

/** AI/ML-focused counterpart to getResumeData in resume.ts. It reads the same
 *  underlying project and skill content, but filters and groups through the
 *  showInResumeAi/resumeAi/resumeAiGroup fields instead of their showInResume
 *  equivalents, so a project or skill can appear on the full-stack résumé,
 *  the AI/ML one, both, or neither, without keeping two copies of the work
 *  itself. Internships are shared as-is: the same roles are real regardless
 *  of which résumé is curating around them. */

/** Projects opted in to the AI/ML résumé, in their résumé order. */
export function getResumeAiProjects(): ResumeProject[] {
  return getAllProjects()
    .filter((project) => project.showInResumeAi && project.resumeAi)
    .sort((a, b) => (a.resumeAi?.order ?? 0) - (b.resumeAi?.order ?? 0))
    .map((project) => ({
      slug: project.slug,
      name: project.title,
      liveUrl: project.liveUrl,
      technologies: project.resumeAi!.technologies,
      highlights: project.resumeAi!.highlights,
    }));
}

/** Skills opted in to the AI/ML résumé, grouped by their résumé grouping.
 *  Group order comes from resume-ai.json, mirroring how resume.json orders
 *  the full-stack résumé's groups. */
export function getResumeAiSkillGroups(): ResumeSkillGroup[] {
  const skills = getAllSkills().filter((skill) => skill.showInResumeAi);
  const declaredOrder: string[] = resumeAi.skillGroupOrder;

  const groupNames = [
    ...declaredOrder.filter((name) => skills.some((s) => s.resumeAiGroup === name)),
    // Any group a skill declares but resume-ai.json has not ordered still
    // shows, rather than silently disappearing from the résumé.
    ...[...new Set(skills.map((s) => s.resumeAiGroup as string))]
      .filter((name) => !declaredOrder.includes(name))
      .sort(),
  ];

  return groupNames.map((category) => ({
    category,
    items: skills
      .filter((skill) => skill.resumeAiGroup === category)
      .sort(
        (a, b) =>
          (a.resumeAiOrder ?? a.skillsSectionOrder) - (b.resumeAiOrder ?? b.skillsSectionOrder),
      )
      .map((skill) => skill.resumeAiLabel ?? skill.name),
  }));
}

export interface ResumeAiData {
  internships: ResumeInternship[];
  projects: ResumeProject[];
  skillGroups: ResumeSkillGroup[];
}

export function getResumeAiData(): ResumeAiData {
  return {
    internships: getResumeInternships(),
    projects: getResumeAiProjects(),
    skillGroups: getResumeAiSkillGroups(),
  };
}
