// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { createStoryOverlay } from "../StoryOverlay";
import { STORY_SCENES, getScenePresence } from "../storyTimeline";

/**
 * Site content sitting on the journey's scroll.
 *
 * The overlay used to drive one hardcoded element, which was fine while the only
 * thing on the timeline was the film's own copy. Now the hero is on it too, and
 * the two want opposite things: a beat should not replay when you scroll back
 * up, and content absolutely should — scrolling back to where the hero lives is
 * how you re-read it.
 */

/** Build the markup the route renders, without rendering the route. */
function mountOverlay(sceneNames: string[]) {
  const root = document.createElement("div");
  for (const name of sceneNames) {
    const section = document.createElement("section");
    section.className = "story-scene";
    section.dataset.storyScene = name;
    root.append(section);
  }
  document.body.append(root);
  const overlay = createStoryOverlay(root);
  const at = (name: string) =>
    root.querySelector<HTMLElement>(`[data-story-scene="${name}"]`)!;
  return { overlay, at };
}

function opacityOf(element: HTMLElement) {
  return Number(element.style.opacity);
}

describe("content scored against the flight", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("has the hero up from the first frame after the gate", () => {
    // The gate opens at scroll 0. A portfolio whose owner's name only appears
    // once you have scrolled is a portfolio that failed to introduce itself.
    const { overlay, at } = mountOverlay(["heroIntro"]);
    overlay.update(0);

    expect(opacityOf(at("heroIntro"))).toBe(1);
    expect(at("heroIntro").getAttribute("aria-hidden")).toBe("false");
  });

  it("clears the hero well before the blackout takes the frame", () => {
    const { overlay, at } = mountOverlay(["heroIntro"]);
    overlay.update(4);

    expect(opacityOf(at("heroIntro"))).toBe(0);
    // Faded out has to mean gone: an overlay left in the accessibility tree at
    // opacity 0 is still read aloud and still tabbable.
    expect(at("heroIntro").getAttribute("aria-hidden")).toBe("true");
    expect(STORY_SCENES.heroIntro.fadeOutEnd).toBeLessThan(6.5);
  });

  it("shows the hero again on the way back up", () => {
    const { overlay, at } = mountOverlay(["heroIntro"]);
    overlay.update(4);
    overlay.update(1);

    expect(opacityOf(at("heroIntro"))).toBe(1);
  });

  it("does not replay the film's own beat on the way back up", () => {
    const { overlay, at } = mountOverlay(["horizonMessage"]);
    overlay.update(6.7);
    expect(opacityOf(at("horizonMessage"))).toBe(1);

    overlay.update(6.6);
    expect(opacityOf(at("horizonMessage"))).toBe(0);
  });

  it("drives every scene in the table, not just the first", () => {
    // The generalisation this whole file exists to hold in place. Before it, a
    // second section could be added to the markup and would simply never move.
    const { overlay, at } = mountOverlay(["heroIntro", "horizonMessage"]);
    overlay.update(0);

    expect(opacityOf(at("heroIntro"))).toBe(1);
    // Checked by the transform rather than the opacity, because both "driven,
    // and not due yet" and "never touched" read as opacity 0. Only a scene that
    // went through the timeline has had a transform written to it.
    expect(opacityOf(at("horizonMessage"))).toBe(0);
    expect(at("horizonMessage").style.transform).toContain("translate3d");
  });

  it("leaves markup with no entry in the table alone", () => {
    const { overlay, at } = mountOverlay(["somethingNobodyScored"]);
    overlay.update(2);

    expect(at("somethingNobodyScored").style.opacity).toBe("");
  });

  it("counts a scene as present at its own first frame", () => {
    // The boundary the hero depends on. heroIntro starts at 0 and so does the
    // journey, so under the original `progress <= fadeInStart` the hero was
    // outside its own window at the one scroll position every visitor is
    // guaranteed to see. Off-by-one at a boundary nothing else in the table
    // sits on, which is why it survived until content arrived.
    const presence = getScenePresence(0, STORY_SCENES.heroIntro);

    expect(presence.opacity).toBe(1);
    expect(presence.offsetX).toBe(0);
  });
});
