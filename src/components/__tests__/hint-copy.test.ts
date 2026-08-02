import { describe, expect, it } from "vitest";

import {
  CAROUSEL_END_PROGRESS,
  carouselFacts,
  hintText,
  resolveHomepageHint,
} from "../hints/hint-copy";

const PROJECT_COUNT = 6;
const facts = (progress: number, previouslyAdvanced = false) =>
  carouselFacts(progress, PROJECT_COUNT, previouslyAdvanced);

describe("carouselFacts", () => {
  it("does not count the very start as having moved", () => {
    expect(facts(0).hasAdvanced).toBe(false);
  });

  it("counts a deliberate move sideways, but not a nudge", () => {
    // One panel is 1/(count+1) of the track; the threshold sits past the first.
    const onePanel = 1 / (PROJECT_COUNT + 1);
    expect(facts(onePanel * 0.5).hasAdvanced).toBe(false);
    expect(facts(onePanel * 2).hasAdvanced).toBe(true);
  });

  it("keeps hasAdvanced once earned, even after swiping back", () => {
    // Someone who swiped forward and returned still knows how it works.
    expect(facts(0, true).hasAdvanced).toBe(true);
  });

  it("recognises the end of the track", () => {
    expect(facts(0.5).atEnd).toBe(false);
    expect(facts(CAROUSEL_END_PROGRESS).atEnd).toBe(true);
    expect(facts(1).atEnd).toBe(true);
  });
});

describe("resolveHomepageHint", () => {
  it("offers the scroll cue on the hero", () => {
    expect(resolveHomepageHint({ section: "hero", carousel: null })).toBe("hero");
  });

  it("says nothing where the scene explains itself", () => {
    expect(resolveHomepageHint({ section: "about", carousel: null })).toBeNull();
    expect(resolveHomepageHint({ section: "contact", carousel: null })).toBeNull();
  });

  it("teaches the sideways swipe only until it has been used", () => {
    expect(resolveHomepageHint({ section: "projects", carousel: facts(0) })).toBe("projects");
    expect(resolveHomepageHint({ section: "projects", carousel: facts(0.4) })).toBeNull();
  });

  it("points down again at the end of the carousel, however they got there", () => {
    // The end is the one place the carousel needs a hint even for someone who
    // has been swiping happily: horizontal travel is spent and nothing says so.
    expect(resolveHomepageHint({ section: "projects", carousel: facts(1) })).toBe("projects-end");
    expect(resolveHomepageHint({ section: "projects", carousel: facts(1, true) })).toBe(
      "projects-end",
    );
  });

  it("waits for the carousel to be measured before guessing", () => {
    expect(resolveHomepageHint({ section: "projects", carousel: null })).toBeNull();
  });

  it("invites a click on the scenes whose items open detail pages", () => {
    expect(resolveHomepageHint({ section: "experience", carousel: null })).toBe("experience");
    expect(resolveHomepageHint({ section: "skills", carousel: null })).toBe("skills");
  });
});

describe("hintText", () => {
  it("names the gesture that actually works on each input", () => {
    expect(hintText("projects", "touch")).toContain("Swipe");
    expect(hintText("projects", "pointer")).toContain("scroll");
    expect(hintText("experience", "touch")).toContain("Tap");
    expect(hintText("experience", "pointer")).toContain("Click");
  });

  it("never tells a touch visitor to press a key, or the reverse", () => {
    const touch = [
      hintText("hero", "touch"),
      hintText("projects", "touch"),
      hintText("projects-end", "touch"),
    ].join(" ");
    expect(touch).not.toMatch(/press|key|click/i);

    const pointer = [hintText("hero", "pointer"), hintText("projects", "pointer")].join(" ");
    expect(pointer).not.toMatch(/swipe|tap|pinch/i);
  });
});
