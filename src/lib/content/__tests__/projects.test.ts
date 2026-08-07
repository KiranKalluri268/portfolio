import { describe, expect, it } from "vitest";

import {
  getAllProjects,
  getFeaturedProjects,
  getHomepageProjects,
  getProjectBySlug,
} from "../projects";

describe("getAllProjects", () => {
  it("returns only published projects by default, sorted by projectsSectionOrder", () => {
    const projects = getAllProjects();
    expect(projects.length).toBeGreaterThan(0);
    for (const project of projects) {
      expect(project.status).toBe("published");
    }
    const orders = projects.map((project) => project.projectsSectionOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it("includes drafts when includeDrafts is true", () => {
    const withDrafts = getAllProjects({ includeDrafts: true });
    const withoutDrafts = getAllProjects();
    expect(withDrafts.length).toBeGreaterThanOrEqual(withoutDrafts.length);
  });

  it("has no duplicate slugs across the dataset", () => {
    const slugs = getAllProjects({ includeDrafts: true }).map((project) => project.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("getProjectBySlug", () => {
  it("finds a known published project by slug", () => {
    const [first] = getAllProjects();
    expect(getProjectBySlug(first.slug)).toEqual(first);
  });

  it("returns undefined for an unknown slug", () => {
    expect(getProjectBySlug("does-not-exist")).toBeUndefined();
  });
});

describe("getFeaturedProjects", () => {
  it("only returns projects flagged as featured", () => {
    for (const project of getFeaturedProjects()) {
      expect(project.featured).toBe(true);
    }
  });
});

describe("getHomepageProjects", () => {
  it("only returns projects flagged for the homepage carousel", () => {
    for (const project of getHomepageProjects()) {
      expect(project.showInProjectsSection).toBe(true);
    }
  });

  it("can show something for every carousel project, image or not", () => {
    // This used to require an image on every panel. It no longer does: two of
    // them pointed at a stock "NOT AVAILABLE" graphic, which is worse than
    // nothing, and ProjectThumbnail already draws a monogram from the title
    // with the role beneath it when there is no image.
    //
    // What the carousel cannot survive is a project with neither — no image
    // and nothing to build the fallback from. An image without alt text is
    // also a hole, and the old assertion did not cover it.
    for (const project of getHomepageProjects()) {
      if (project.image) {
        expect(project.imageAlt).toBeTruthy();
        continue;
      }
      expect(project.title.trim()).toBeTruthy();
      expect(project.role.trim()).toBeTruthy();
    }
  });
});

describe("project imagery", () => {
  it("allows a project to omit its screenshot", () => {
    // Client and internal work often has nothing shareable to show; the UI
    // falls back to a generated monogram panel instead.
    const projects = getAllProjects({ includeDrafts: true });
    expect(projects.some((project) => !project.image)).toBe(true);
  });

  it("requires alt text whenever an image is present", () => {
    for (const project of getAllProjects({ includeDrafts: true })) {
      if (project.image) {
        expect(typeof project.imageAlt).toBe("string");
        expect(project.imageAlt?.trim()).not.toBe("");
      }
    }
  });
});
