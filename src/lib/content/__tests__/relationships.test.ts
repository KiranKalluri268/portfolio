import { describe, expect, it } from "vitest";

import { getAllExperiences } from "../experience";
import { getAllProjects } from "../projects";
import { getAllSkills } from "../skills";
import {
  getExperiencesForSkill,
  getProjectsForExperience,
  getProjectsForSkill,
  getSkillsForExperience,
  getSkillsForProject,
} from "../relationships";

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

describe("getSkillsForExperience", () => {
  it("resolves every referenced skill slug to full skill content, in order", () => {
    for (const experience of getAllExperiences()) {
      const skills = getSkillsForExperience(experience);
      expect(skills.map((skill) => skill.slug)).toEqual(experience.skills);
    }
  });

  it("validates that no role references an unknown skill", () => {
    const skillSlugs = new Set(getAllSkills().map((skill) => skill.slug));
    for (const experience of getAllExperiences()) {
      for (const slug of experience.skills) {
        expect(skillSlugs.has(slug)).toBe(true);
      }
      for (const item of experience.workItems) {
        for (const slug of item.skills) {
          expect(skillSlugs.has(slug)).toBe(true);
        }
      }
    }
  });
});

describe("getProjectsForExperience", () => {
  it("resolves work-item project references, de-duplicated and in order", () => {
    for (const experience of getAllExperiences()) {
      const projects = getProjectsForExperience(experience);
      const expected: string[] = [];
      for (const item of experience.workItems) {
        if (item.projectSlug && !expected.includes(item.projectSlug)) {
          expected.push(item.projectSlug);
        }
      }
      expect(projects.map((project) => project.slug)).toEqual(expected);
    }
  });

  it("only returns projects that actually exist", () => {
    const projectSlugs = new Set(getAllProjects().map((project) => project.slug));
    for (const experience of getAllExperiences()) {
      for (const project of getProjectsForExperience(experience)) {
        expect(projectSlugs.has(project.slug)).toBe(true);
      }
    }
  });
});

describe("getExperiencesForSkill", () => {
  it("is consistent with the skills declared on each role and its work items", () => {
    for (const skill of getAllSkills()) {
      for (const experience of getExperiencesForSkill(skill)) {
        const referenced =
          experience.skills.includes(skill.slug) ||
          experience.workItems.some((item) => item.skills.includes(skill.slug));
        expect(referenced).toBe(true);
      }
    }
  });
});
