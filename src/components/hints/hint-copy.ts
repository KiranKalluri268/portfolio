/** What the navigation hint says, and when there is anything worth saying.
 *
 * Kept free of React so the wording and the rules that pick it can be read and
 * tested on their own. The pill only ever appears when a visitor has sat in one
 * place without doing the thing the scene is waiting for, so every line here
 * has to answer "what do I do here?" in one glance.
 */

import type { SectionId } from "@/context/SmoothScrollContext";

/** How the visitor is driving the page. Taken from what they actually touched
 *  rather than the screen size, so a touchscreen laptop is not told to swipe
 *  when it is being used with a trackpad. */
export type InputMode = "touch" | "pointer";

export type HintId =
  | "hero"
  | "projects"
  | "projects-end"
  | "projects-grid"
  | "experience"
  | "skills"
  | "skill-web";

/** Progress at which the carousel has reached the "See all projects" panel and
 *  the only way on is vertical again. Just short of 1: the pinned scrub rarely
 *  settles on exactly the end. */
export const CAROUSEL_END_PROGRESS = 0.97;

/** How far into the carousel counts as "they have worked out it moves
 *  sideways", in panels. Half a panel past the first is enough to be
 *  deliberate rather than a stray nudge. */
export const ADVANCED_PANELS = 1.5;

const HINTS: Record<HintId, Record<InputMode, string>> = {
  hero: {
    touch: "Swipe up to take a look around",
    pointer: "Scroll down to take a look around, or press ↓",
  },
  projects: {
    touch: "Swipe sideways to move through my projects",
    pointer: "Keep scrolling to move through my projects, or press ← →",
  },
  "projects-end": {
    touch: "That is the last project — swipe up to carry on",
    pointer: "That is the last project — scroll down to carry on",
  },
  experience: {
    touch: "Tap a role to see what I worked on there",
    pointer: "Click a role to see what I worked on there",
  },
  skills: {
    touch: "Tap any skill to see how I use it",
    pointer: "Click any skill to see how I use it",
  },
  // The grid has no edges and no scrollbar, so nothing on screen says it can
  // be moved at all — the one hint here that answers "is this a picture?".
  "projects-grid": {
    touch: "Drag any way you like — the grid keeps going",
    pointer: "Drag any way you like, or use the arrow keys — the grid keeps going",
  },
  "skill-web": {
    touch: "Drag to explore · Pinch to zoom · Tap a branch to focus",
    pointer: "Drag to explore · Scroll to zoom · Click a branch to focus",
  },
};

export function hintText(id: HintId, mode: InputMode) {
  return HINTS[id][mode];
}

/** The only two things about the carousel a hint cares about.
 *
 * Booleans rather than raw progress, so scrolling through the pinned section
 * does not push a new value into React on every frame. */
export interface CarouselFacts {
  atEnd: boolean;
  hasAdvanced: boolean;
  /** Where the carousel stood when the visitor arrived in the section.
   *  Movement is judged against this rather than against zero. */
  startProgress: number;
}

/** Reduces carousel progress to those facts.
 *
 * `hasAdvanced` means "this visitor moved the carousel", not "the carousel is
 * not at the start" — the two come apart when a browser restores a scroll
 * position mid-track, where measuring from zero would credit someone with a
 * swipe they never made and silently withhold the hint they needed.
 *
 * Pass `previous` as null to start a fresh baseline, which the caller does
 * each time the visitor arrives in the section. It is sticky otherwise:
 * swiping forward and back still means they know it moves sideways. */
export function carouselFacts(
  progress: number,
  projectCount: number,
  previous: CarouselFacts | null,
): CarouselFacts {
  // Panel 0 is the lead-in spacer and the last panel is "See all projects", so
  // the track has projectCount + 1 steps.
  const movedEnough = (1 / (projectCount + 1)) * ADVANCED_PANELS;
  const startProgress = previous?.startProgress ?? progress;
  return {
    atEnd: progress >= CAROUSEL_END_PROGRESS,
    hasAdvanced:
      (previous?.hasAdvanced ?? false) || Math.abs(progress - startProgress) > movedEnough,
    startProgress,
  };
}

/** The hint the homepage owes the visitor right now, or null when the scene
 *  explains itself.
 *
 * About and Contact stay silent: one is prose and the other is a form, and
 * neither needs telling how to work. */
export function resolveHomepageHint({
  section,
  carousel,
}: {
  section: SectionId;
  /** Null until the pinned carousel has been measured. */
  carousel: CarouselFacts | null;
}): HintId | null {
  switch (section) {
    case "hero":
      return "hero";
    case "projects": {
      if (!carousel) return null;
      // The end of the track is its own problem: horizontal travel is spent and
      // nothing on screen says the page continues downwards.
      if (carousel.atEnd) return "projects-end";
      // Someone already swiping does not need to be told how to swipe.
      return carousel.hasAdvanced ? null : "projects";
    }
    case "experience":
      return "experience";
    case "skills":
      return "skills";
    default:
      return null;
  }
}
