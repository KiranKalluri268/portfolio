import { describe, expect, it } from "vitest";

import { getCvData } from "../cv";
import { getAllExperiences } from "../experience";
import { getAllProjects } from "../projects";
import { getAllSkills } from "../skills";

describe("getCvData", () => {
  it("includes every published role", () => {
    const cv = getCvData();
    expect(cv.roles.map((role) => role.slug)).toEqual(
      getAllExperiences().map((experience) => experience.slug),
    );
  });

  it("lists only independent projects, since employment work is already under its role", () => {
    const cv = getCvData();
    const employmentProjects = new Set(
      getAllExperiences().flatMap((experience) =>
        experience.workItems.flatMap((item) => (item.projectSlug ? [item.projectSlug] : [])),
      ),
    );
    expect(employmentProjects.size).toBeGreaterThan(0);

    const listed = cv.projects.map((project) => project.slug);
    for (const slug of listed) {
      expect(employmentProjects.has(slug)).toBe(false);
    }
    expect(listed).toEqual(
      getAllProjects()
        .filter((project) => !employmentProjects.has(project.slug))
        .map((project) => project.slug),
    );
  });

  it("still names employment projects through their work item, so nothing is lost", () => {
    const cv = getCvData();
    const named = cv.roles.flatMap((role) =>
      role.workItems.flatMap((item) => (item.projectTitle ? [item.projectTitle] : [])),
    );
    const byTitle = new Map(getAllProjects().map((p) => [p.slug, p.title]));
    const employmentProjects = new Set(
      getAllExperiences().flatMap((experience) =>
        experience.workItems.flatMap((item) => (item.projectSlug ? [item.projectSlug] : [])),
      ),
    );
    for (const slug of employmentProjects) {
      expect(named).toContain(byTitle.get(slug));
    }
  });

  it("resolves skill slugs to display names rather than leaking slugs", () => {
    const cv = getCvData();
    const names = new Set(getAllSkills().map((skill) => skill.name));
    const allTechnologies = [
      ...cv.roles.flatMap((role) => [
        ...role.technologies,
        ...role.workItems.flatMap((item) => item.technologies),
      ]),
      ...cv.projects.flatMap((project) => project.technologies),
    ];
    expect(allTechnologies.length).toBeGreaterThan(0);
    for (const technology of allTechnologies) {
      expect(names.has(technology)).toBe(true);
    }
  });

  it("leaves recommendations off the CV", () => {
    // Recommendations belong on the homepage and the experience pages; the CV
    // is a record of work, and quoting managers made it noticeably longer.
    const cv = getCvData();
    expect(JSON.stringify(cv)).not.toContain("phenomenal asset");
    for (const role of cv.roles) {
      expect(role).not.toHaveProperty("recommendations");
    }
  });

  it("resolves a work item's project reference to that project's title", () => {
    const cv = getCvData();
    const titles = new Set(getAllProjects().map((project) => project.title));
    const linked = cv.roles.flatMap((role) =>
      role.workItems.filter((item) => item.projectTitle),
    );
    expect(linked.length).toBeGreaterThan(0);
    for (const item of linked) {
      expect(titles.has(item.projectTitle as string)).toBe(true);
    }
  });

  it("groups skills under non-empty categories only", () => {
    const cv = getCvData();
    expect(cv.skillGroups.length).toBeGreaterThan(0);
    for (const group of cv.skillGroups) {
      expect(group.label.trim()).not.toBe("");
      expect(group.skills.length).toBeGreaterThan(0);
    }
  });

  it("formats each role's period as a readable range", () => {
    for (const role of getCvData().roles) {
      expect(role.period).toMatch(/\S+\s–\s\S+/);
    }
  });

  it("carries the identity and closing details the résumé also shows", () => {
    const cv = getCvData();
    expect(cv.basics.name.trim()).not.toBe("");
    expect(cv.basics.links.length).toBeGreaterThan(0);
    expect(cv.profile.trim()).not.toBe("");
    expect(cv.education.degree.trim()).not.toBe("");
    expect(cv.certifications.length).toBeGreaterThan(0);
    expect(cv.languages.length).toBeGreaterThan(0);
    expect(cv.strengths.length).toBeGreaterThan(0);
  });
});
