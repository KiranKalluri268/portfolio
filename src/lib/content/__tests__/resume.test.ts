import { describe, expect, it } from "vitest";

import resume from "@/data/resume.json";
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
      expect(project.name).toBe(source?.resume?.title ?? source?.title);
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

/** Every résumé skill line with its group and order: the opted-in skills plus
 *  resume.json's extras, which are not skills with a page of their own. */
function expectedSkillLines() {
  return [
    ...getAllSkills()
      .filter((skill) => skill.showInResume)
      .map((skill) => ({
        group: skill.resumeGroup,
        label: skill.resumeLabel ?? skill.name,
        order: skill.resumeOrder ?? skill.skillsSectionOrder,
      })),
    ...(resume.skillExtras ?? []),
  ];
}

describe("getResumeSkillGroups", () => {
  it("includes only skills opted in to the résumé, plus the résumé's extras", () => {
    const listed = getResumeSkillGroups().flatMap((group) => group.items);
    expect([...listed].sort()).toEqual(expectedSkillLines().map((line) => line.label).sort());
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
      const expected = expectedSkillLines()
        .filter((line) => line.group === group.category)
        .map((line) => line.label);
      expect([...group.items].sort()).toEqual([...expected].sort());
    }
  });

  it("orders skills within a group by their résumé order", () => {
    for (const group of getResumeSkillGroups()) {
      const orders = group.items.map(
        (item) => expectedSkillLines().find((line) => line.label === item)?.order ?? 0,
      );
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
