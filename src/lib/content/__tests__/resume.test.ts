import { describe, expect, it } from "vitest";

import { getCvData } from "../cv";
import { getAllProjects } from "../projects";
import { getResumeData, getResumeProjects, getResumeSkillGroups } from "../resume";
import { getAllSkills } from "../skills";

describe("getResumeProjects", () => {
  it("includes only projects opted in to the résumé", () => {
    const optedIn = new Set(
      getAllProjects()
        .filter((project) => project.showInResume)
        .map((project) => project.slug),
    );
    const resumeProjects = getResumeProjects();
    expect(resumeProjects.length).toBe(optedIn.size);
    for (const project of resumeProjects) {
      expect(optedIn.has(project.slug)).toBe(true);
    }
  });

  it("uses the résumé's own wording rather than the case study's", () => {
    const bySlug = new Map(getAllProjects().map((project) => [project.slug, project]));
    for (const project of getResumeProjects()) {
      const source = bySlug.get(project.slug);
      expect(project.technologies).toBe(source?.resume?.technologies);
      expect(project.highlights).toEqual(source?.resume?.highlights);
    }
  });

  it("orders projects by their résumé order", () => {
    const orders = getResumeProjects().map(
      (project) =>
        getAllProjects().find((p) => p.slug === project.slug)?.resume?.order ?? 0,
    );
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });
});

describe("getResumeSkillGroups", () => {
  it("includes only skills opted in to the résumé", () => {
    const optedIn = getAllSkills().filter((skill) => skill.showInResume);
    const listed = getResumeSkillGroups().flatMap((group) => group.items);
    expect(listed.length).toBe(optedIn.length);
  });

  it("renders each skill's résumé label when it has one", () => {
    const listed = getResumeSkillGroups().flatMap((group) => group.items);
    for (const skill of getAllSkills().filter((s) => s.showInResume && s.resumeLabel)) {
      expect(listed).toContain(skill.resumeLabel);
    }
  });

  it("groups every listed skill under its declared résumé group", () => {
    for (const group of getResumeSkillGroups()) {
      expect(group.items.length).toBeGreaterThan(0);
      const expected = getAllSkills()
        .filter((skill) => skill.showInResume && skill.resumeGroup === group.category)
        .map((skill) => skill.resumeLabel ?? skill.name);
      expect([...group.items].sort()).toEqual([...expected].sort());
    }
  });

  it("orders skills within a group by their résumé order", () => {
    for (const group of getResumeSkillGroups()) {
      const orders = group.items.map((item) => {
        const skill = getAllSkills().find((s) => (s.resumeLabel ?? s.name) === item);
        return skill?.resumeOrder ?? skill?.skillsSectionOrder ?? 0;
      });
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
    }
  });
});

describe("résumé and CV scope", () => {
  it("keeps the résumé a curated subset while the CV carries everything", () => {
    // This is the point of showInResume: new content appears on the CV
    // automatically, and only reaches the résumé when opted in.
    const cv = getCvData();
    expect(getResumeProjects().length).toBeLessThan(cv.projects.length);

    const resumeSkillCount = getResumeSkillGroups().reduce(
      (total, group) => total + group.items.length,
      0,
    );
    expect(resumeSkillCount).toBeLessThan(getAllSkills().length);
  });
});

describe("getResumeData", () => {
  it("returns the three pipeline-driven résumé sections", () => {
    const data = getResumeData();
    expect(data.internships.length).toBeGreaterThan(0);
    expect(data.projects.length).toBeGreaterThan(0);
    expect(data.skillGroups.length).toBeGreaterThan(0);
  });
});
