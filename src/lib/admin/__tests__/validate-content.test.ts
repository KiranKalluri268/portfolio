import { describe, expect, it } from "vitest";
import { validateContentForPath } from "../validate-content";

import realProject from "@/data/projects/portfolio.json";
import realSkill from "@/data/skills/aws.json";
import realExperience from "@/data/experience/aude-ai.json";
import realSkillCategories from "@/data/skill-categories.json";
import realSkillWeb from "@/data/skill-web.json";
import realResume from "@/data/resume.json";
import realAbout from "@/data/about.json";

/** Real content from src/data, not hand-built fixtures - so a passing test
 *  actually says these match today's validators, not a fixture that drifted
 *  out of sync with them. */
describe("validateContentForPath", () => {
  it("accepts a real project and rejects one missing a required field", () => {
    expect(() => validateContentForPath("projects/portfolio.json", realProject)).not.toThrow();

    const broken = { ...realProject } as Record<string, unknown>;
    delete broken.title;
    expect(() => validateContentForPath("projects/portfolio.json", broken)).toThrow(/title/);
  });

  it("accepts a real skill and rejects one with the wrong status", () => {
    expect(() => validateContentForPath("skills/aws.json", realSkill)).not.toThrow();

    const broken = { ...realSkill, status: "not-a-real-status" };
    expect(() => validateContentForPath("skills/aws.json", broken)).toThrow(/status/);
  });

  it("accepts a real experience entry and rejects one missing its period", () => {
    expect(() => validateContentForPath("experience/aude-ai.json", realExperience)).not.toThrow();

    const broken = { ...realExperience } as Record<string, unknown>;
    delete broken.period;
    expect(() => validateContentForPath("experience/aude-ai.json", broken)).toThrow();
  });

  it("accepts the real skill categories and rejects a duplicate slug", () => {
    expect(() => validateContentForPath("skill-categories.json", realSkillCategories)).not.toThrow();

    const categories = realSkillCategories as Array<{ slug: string }>;
    const broken = [...categories, categories[0]];
    expect(() => validateContentForPath("skill-categories.json", broken)).toThrow(/duplicate/);
  });

  it("accepts the real skill web config and rejects a non-array domains field", () => {
    expect(() => validateContentForPath("skill-web.json", realSkillWeb)).not.toThrow();

    const broken = { ...realSkillWeb, domains: "not-an-array" };
    expect(() => validateContentForPath("skill-web.json", broken)).toThrow(/domains/);
  });

  it("accepts the real résumé and rejects one missing an education field", () => {
    expect(() => validateContentForPath("resume.json", realResume)).not.toThrow();
    expect(() => validateContentForPath("resume.json", "not an object")).toThrow();

    const broken = structuredClone(realResume) as Record<string, unknown>;
    delete (broken.education as Record<string, unknown>).cgpa;
    expect(() => validateContentForPath("resume.json", broken)).toThrow(/cgpa/);
  });

  it("accepts the real résumé and rejects a link missing its url", () => {
    const broken = structuredClone(realResume) as { basics: { links: Array<Record<string, unknown>> } };
    delete broken.basics.links[0].url;
    expect(() => validateContentForPath("resume.json", broken)).toThrow(/url/);
  });

  it("accepts the real about content and rejects a segment with a non-boolean accent", () => {
    expect(() => validateContentForPath("about.json", realAbout)).not.toThrow();
    expect(() => validateContentForPath("about.json", "not an object")).toThrow();

    const broken = structuredClone(realAbout) as { segments: Array<Record<string, unknown>> };
    broken.segments[0].accent = "true";
    expect(() => validateContentForPath("about.json", broken)).toThrow(/accent/);
  });
});
