import "server-only";

import { getAllExperiences } from "./experience";
import { getAllProjects } from "./projects";
import { getAllSkills } from "./skills";
import type {
  ExperienceContent,
  ProjectContent,
  SkillContent,
} from "./types";

function validateRelationships() {
  const skillSlugs = new Set(getAllSkills().map((skill) => skill.slug));
  for (const project of getAllProjects()) {
    for (const skillSlug of project.skills) {
      if (!skillSlugs.has(skillSlug)) {
        throw new Error(
          `projects/${project.slug}.json: references unknown skill "${skillSlug}"`,
        );
      }
    }
  }

  const projectSlugs = new Set(getAllProjects().map((project) => project.slug));
  for (const experience of getAllExperiences()) {
    for (const skillSlug of experience.skills) {
      if (!skillSlugs.has(skillSlug)) {
        throw new Error(
          `experience/${experience.slug}.json: references unknown skill "${skillSlug}"`,
        );
      }
    }
    for (const item of experience.workItems) {
      for (const skillSlug of item.skills) {
        if (!skillSlugs.has(skillSlug)) {
          throw new Error(
            `experience/${experience.slug}.json: work item "${item.title}" references unknown skill "${skillSlug}"`,
          );
        }
      }
      if (item.projectSlug && !projectSlugs.has(item.projectSlug)) {
        throw new Error(
          `experience/${experience.slug}.json: work item "${item.title}" references unknown project "${item.projectSlug}"`,
        );
      }
    }
  }
}

export function getSkillsForProject(project: ProjectContent): SkillContent[] {
  validateRelationships();
  const bySlug = new Map(getAllSkills().map((skill) => [skill.slug, skill]));
  return project.skills.flatMap((slug) => {
    const skill = bySlug.get(slug);
    return skill ? [skill] : [];
  });
}

export function getProjectsForSkill(skill: SkillContent): ProjectContent[] {
  validateRelationships();
  return getAllProjects().filter((project) => project.skills.includes(skill.slug));
}

export function getSkillsForExperience(experience: ExperienceContent): SkillContent[] {
  validateRelationships();
  const bySlug = new Map(getAllSkills().map((skill) => [skill.slug, skill]));
  return experience.skills.flatMap((slug) => {
    const skill = bySlug.get(slug);
    return skill ? [skill] : [];
  });
}

/** Case studies referenced by any work item in a role, de-duplicated and
 *  returned in the order the work items appear. */
export function getProjectsForExperience(experience: ExperienceContent): ProjectContent[] {
  validateRelationships();
  const bySlug = new Map(getAllProjects().map((project) => [project.slug, project]));
  const seen = new Set<string>();
  return experience.workItems.flatMap((item) => {
    if (!item.projectSlug || seen.has(item.projectSlug)) return [];
    seen.add(item.projectSlug);
    const project = bySlug.get(item.projectSlug);
    return project ? [project] : [];
  });
}

export function getExperiencesForSkill(skill: SkillContent): ExperienceContent[] {
  validateRelationships();
  return getAllExperiences().filter(
    (experience) =>
      experience.skills.includes(skill.slug) ||
      experience.workItems.some((item) => item.skills.includes(skill.slug)),
  );
}

/** How a project came about — what the grid's card outlines stand for.
 *
 * The line is a role, and nothing else: a project built inside one is work,
 * and everything else is mine, whether or not it is also put forward as
 * selected work. */
export type ProjectOrigin = "work" | "personal";

export function getProjectOrigin(project: ProjectContent): ProjectOrigin {
  validateRelationships();
  const fromWork = getAllExperiences().some((experience) =>
    experience.workItems.some((item) => item.projectSlug === project.slug),
  );
  return fromWork ? "work" : "personal";
}
