import { describe, expect, it } from "vitest";

import { getAllProjects } from "../projects";
import { getAllSkills } from "../skills";
import { getProjectsForSkill, getSkillsForProject } from "../relationships";

describe("getSkillsForProject", () => {
  it("resolves every referenced skill slug to full skill content, in order", () => {
    for (const project of getAllProjects()) {
      const skills = getSkillsForProject(project);
      expect(skills.map((skill) => skill.slug)).toEqual(project.skills);
    }
  });
});

describe("getProjectsForSkill", () => {
  it("is the inverse of getSkillsForProject", () => {
    const skills = getAllSkills();
    for (const skill of skills) {
      const projects = getProjectsForSkill(skill);
      for (const project of projects) {
        expect(project.skills).toContain(skill.slug);
      }
    }
  });

  it("returns no projects for a skill nothing links to", () => {
    const unusedSkill = getAllSkills().find(
      (skill) => getProjectsForSkill(skill).length === 0,
    );
    if (unusedSkill) {
      expect(getProjectsForSkill(unusedSkill)).toEqual([]);
    }
  });
});
