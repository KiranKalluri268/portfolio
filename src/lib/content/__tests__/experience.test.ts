import { describe, expect, it } from "vitest";

import {
  getAllExperiences,
  getExperienceBySlug,
  getResumeInternships,
  getTimelineExperiences,
} from "../experience";

describe("getAllExperiences", () => {
  it("returns only published roles by default, sorted by timelineOrder", () => {
    const experiences = getAllExperiences();
    expect(experiences.length).toBeGreaterThan(0);
    for (const experience of experiences) {
      expect(experience.status).toBe("published");
    }
    const orders = experiences.map((experience) => experience.timelineOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it("has no duplicate slugs", () => {
    const slugs = getAllExperiences({ includeDrafts: true }).map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gives every role a machine-readable start date matching its label", () => {
    for (const experience of getAllExperiences({ includeDrafts: true })) {
      expect(experience.period.startDate).toMatch(/^\d{4}-\d{2}$/);
      if (experience.period.endDate) {
        expect(experience.period.endDate).toMatch(/^\d{4}-\d{2}$/);
      }
    }
  });

  it("normalizes optional array fields so consumers never see undefined", () => {
    for (const experience of getAllExperiences({ includeDrafts: true })) {
      expect(Array.isArray(experience.highlights)).toBe(true);
      expect(Array.isArray(experience.overview)).toBe(true);
      expect(Array.isArray(experience.skills)).toBe(true);
      expect(Array.isArray(experience.workItems)).toBe(true);
      expect(Array.isArray(experience.outcomes)).toBe(true);
      expect(Array.isArray(experience.lessonsLearned)).toBe(true);
      expect(Array.isArray(experience.recommendations)).toBe(true);
      for (const item of experience.workItems) {
        expect(Array.isArray(item.skills)).toBe(true);
      }
    }
  });
});

describe("recommendations", () => {
  it("gives every recommendation an attributable author, title, and non-empty quote", () => {
    for (const experience of getAllExperiences({ includeDrafts: true })) {
      for (const recommendation of experience.recommendations) {
        expect(recommendation.author.trim()).not.toBe("");
        expect(recommendation.authorTitle.trim()).not.toBe("");
        expect(recommendation.quote.length).toBeGreaterThan(0);
        for (const paragraph of recommendation.quote) {
          expect(paragraph.trim()).not.toBe("");
        }
      }
    }
  });

  it("pairs a source link with a label so it never renders as a bare URL", () => {
    for (const experience of getAllExperiences({ includeDrafts: true })) {
      for (const recommendation of experience.recommendations) {
        if (recommendation.sourceUrl) {
          expect(recommendation.sourceUrl).toMatch(/^https?:\/\//);
          expect(recommendation.sourceLabel?.trim()).toBeTruthy();
        }
      }
    }
  });

  it("uses a machine-readable date whenever a date label is shown", () => {
    for (const experience of getAllExperiences({ includeDrafts: true })) {
      for (const recommendation of experience.recommendations) {
        if (recommendation.date) {
          expect(recommendation.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(recommendation.dateLabel?.trim()).toBeTruthy();
        }
      }
    }
  });
});

describe("getExperienceBySlug", () => {
  it("finds a known role by slug", () => {
    const [first] = getAllExperiences();
    expect(getExperienceBySlug(first.slug)).toEqual(first);
  });

  it("returns undefined for an unknown slug", () => {
    expect(getExperienceBySlug("does-not-exist")).toBeUndefined();
  });
});

describe("getTimelineExperiences", () => {
  it("only returns roles flagged for the homepage timeline", () => {
    for (const experience of getTimelineExperiences()) {
      expect(experience.showInTimeline).toBe(true);
    }
  });
});

describe("getResumeInternships", () => {
  it("only includes roles flagged for the résumé", () => {
    const resumeSlugs = new Set(
      getAllExperiences()
        .filter((experience) => experience.showInResume)
        .map((experience) => experience.role),
    );
    const internships = getResumeInternships();
    expect(internships.length).toBe(resumeSlugs.size);
    for (const internship of internships) {
      expect(resumeSlugs.has(internship.role)).toBe(true);
    }
  });

  it("projects each role into the flat shape the résumé and PDF render", () => {
    for (const internship of getResumeInternships()) {
      expect(typeof internship.role).toBe("string");
      expect(typeof internship.company).toBe("string");
      expect(internship.period).toMatch(/\S/);
      expect(Array.isArray(internship.highlights)).toBe(true);
      expect(internship.highlights.length).toBeGreaterThan(0);
    }
  });
});
