import { describe, expect, it } from "vitest";

import {
  getAllProjects,
  getFeaturedProjects,
  getHomepageProjects,
  getProjectGalleryImages,
  getProjectBySlug,
  validateProject,
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
  it("keeps a null screenshot as a monogram placeholder and requires alt text for a URL", () => {
    const project = getProjectBySlug("third-eye-ai");
    expect(project).toBeDefined();
    expect(validateProject({ ...project, image: null }, "third-eye-ai.json").image).toBeNull();
    expect(() =>
      validateProject(
        { ...project, image: "https://res.cloudinary.com/dytobweya/image/upload/v1/example.png", imageAlt: undefined },
        "third-eye-ai.json",
      ),
    ).toThrow('"imageAlt" must be a non-empty string');
  });

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

  it("orders filled gallery slots numerically and skips placeholders", () => {
    const project = getProjectBySlug("third-eye-ai");
    expect(project).toBeDefined();
    const gallery = {
      "image-10": { src: "/images/ten.png", alt: "Tenth image" },
      "image-2": null,
      "image-1": { src: "/images/one.png", alt: "First image" },
      "image-3": { src: "/images/three.png", alt: "Third image", caption: "Detail" },
    };
    const validated = validateProject({ ...project, gallery }, "third-eye-ai.json");
    expect(getProjectGalleryImages(validated).map((image) => image.alt)).toEqual([
      "First image", "Third image", "Tenth image",
    ]);
  });

  it("rejects gallery URLs without alt text and invalid numbered keys", () => {
    const project = getProjectBySlug("third-eye-ai");
    expect(project).toBeDefined();
    expect(() => validateProject({ ...project, gallery: { "image-1": { src: "/a.png" } } }, "third-eye-ai.json"))
      .toThrow('"alt" must be a non-empty string');
    expect(() => validateProject({ ...project, gallery: { first: null } }, "third-eye-ai.json"))
      .toThrow('must use image-1, image-2');
  });
});
