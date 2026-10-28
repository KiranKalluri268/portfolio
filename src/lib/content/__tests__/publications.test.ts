import { describe, expect, it } from "vitest";

import { getAllProjects } from "../projects";
import {
  formatVolumeIssue,
  getAllPublications,
  getPublicationsForProject,
  validatePublication,
} from "../publications";

const valid = {
  slug: "paper",
  title: "A Paper",
  authors: ["A. Author", "Saikiran Kalluri"],
  selfAuthor: "Saikiran Kalluri",
  venue: "A Journal",
  date: "April 2026",
  url: "https://example.com/paper",
};

describe("getAllPublications", () => {
  it("loads every publication with unique slugs", () => {
    const publications = getAllPublications();
    expect(publications.length).toBeGreaterThan(0);
    const slugs = publications.map((publication) => publication.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("only relates publications to projects that exist", () => {
    const projectSlugs = new Set(getAllProjects({ includeDrafts: true }).map((project) => project.slug));
    for (const publication of getAllPublications()) {
      if (publication.relatedProject) expect(projectSlugs).toContain(publication.relatedProject);
    }
  });
});

describe("getPublicationsForProject", () => {
  it("returns the publications that name the project", () => {
    expect(getPublicationsForProject("third-eye-ai").map((p) => p.slug)).toContain(
      "learner-involvement-recognition",
    );
    expect(getPublicationsForProject("no-such-project")).toEqual([]);
  });
});

describe("validatePublication", () => {
  it("accepts a minimal publication", () => {
    expect(validatePublication(valid, "test.json")).toEqual(valid);
  });

  it("rejects a selfAuthor who is not among the authors", () => {
    expect(() => validatePublication({ ...valid, selfAuthor: "Someone Else" }, "test.json")).toThrow(
      /selfAuthor/,
    );
  });

  it("rejects a publication without a link", () => {
    expect(() => validatePublication({ ...valid, url: undefined }, "test.json")).toThrow(/url/);
  });
});

describe("formatVolumeIssue", () => {
  it("joins whichever of volume and issue are present", () => {
    expect(formatVolumeIssue({ ...valid, volume: "4", issue: "4" })).toBe("Vol. 4, Issue 4");
    expect(formatVolumeIssue({ ...valid, volume: "4" })).toBe("Vol. 4");
    expect(formatVolumeIssue(valid)).toBe("");
  });
});
