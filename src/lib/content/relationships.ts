import "server-only";

import { getAllProjects } from "./projects";
import { getAllSkills } from "./skills";
import type { ProjectContent, SkillContent } from "./types";

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
