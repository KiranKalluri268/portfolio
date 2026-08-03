import { describe, expect, it } from "vitest";

import {
  CAROUSEL_END_PROGRESS,
  carouselFacts,
  hintText,
  resolveHomepageHint,
} from "../hints/hint-copy";

const PROJECT_COUNT = 6;
const ONE_PANEL = 1 / (PROJECT_COUNT + 1);
/** First reading of a visit, which sets the baseline. */
const facts = (progress: number) => carouselFacts(progress, PROJECT_COUNT, null);
/** A later reading in the same visit. */
const then = (progress: number, previous: ReturnType<typeof facts>) =>
  carouselFacts(progress, PROJECT_COUNT, previous);

describe("carouselFacts", () => {
  it("does not count the very start as having moved", () => {
    expect(facts(0).hasAdvanced).toBe(false);
  });

  it("counts a deliberate move sideways, but not a nudge", () => {
    const start = facts(0);
    expect(then(ONE_PANEL * 0.5, start).hasAdvanced).toBe(false);
    expect(then(ONE_PANEL * 2, start).hasAdvanced).toBe(true);
  });

  it("keeps hasAdvanced once earned, even after swiping back", () => {
    // Someone who swiped forward and returned still knows how it works.
    const moved = then(ONE_PANEL * 2, facts(0));
    expect(then(0, moved).hasAdvanced).toBe(true);
  });

  it("treats arriving mid-track as a starting point, not a swipe", () => {
    // A restored scroll position or a shared link drops the visitor into the
    // middle of the carousel. They have moved nothing, so they still need the
    // hint — measuring from zero would silently withhold it.
    const landed = facts(0.5);
    expect(landed.hasAdvanced).toBe(false);
    expect(then(0.5, landed).hasAdvanced).toBe(false);
  });

  it("still notices a swipe made from a mid-track start, in either direction", () => {
    const landed = facts(0.5);
    expect(then(0.5 + ONE_PANEL * 2, landed).hasAdvanced).toBe(true);
    expect(then(0.5 - ONE_PANEL * 2, facts(0.5)).hasAdvanced).toBe(true);
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

  it("says nothing on About, which is prose with nothing to do but read", () => {
    expect(resolveHomepageHint({ section: "about", carousel: null })).toBeNull();
  });

  it("points at the form and the profiles on Contact", () => {
    expect(resolveHomepageHint({ section: "contact", carousel: null })).toBe("contact");
  });

  it("teaches the sideways swipe only until it has been used", () => {
    const start = facts(0);
    expect(resolveHomepageHint({ section: "projects", carousel: start })).toBe("projects");
    expect(resolveHomepageHint({ section: "projects", carousel: then(0.4, start) })).toBeNull();
  });

  it("still teaches the swipe to someone dropped into the middle of the track", () => {
    expect(resolveHomepageHint({ section: "projects", carousel: facts(0.5) })).toBe("projects");
  });

  it("points down again at the end of the carousel, however they got there", () => {
    // The end is the one place the carousel needs a hint even for someone who
    // has been swiping happily: horizontal travel is spent and nothing says so.
    expect(resolveHomepageHint({ section: "projects", carousel: facts(1) })).toBe("projects-end");
    expect(
      resolveHomepageHint({ section: "projects", carousel: then(1, facts(0)) }),
    ).toBe("projects-end");
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
