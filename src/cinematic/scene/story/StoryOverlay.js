import { STORY_SCENES, getScenePresence } from './storyTimeline';

// `root` is passed in rather than looked up by id. In portfolio-3D the overlay
// is a fixed element in index.html; here it is rendered by React inside the
// route, so the caller is the only thing that knows where it is.
//
// Every `[data-story-scene]` inside `root` is driven from the table in
// storyTimeline, rather than one hardcoded element. That generalisation is what
// lets the site's own content sit on the journey: a section is markup with a
// name and four scroll positions, and nothing here needs to know whether it is
// the film's copy or the portfolio's.
export function createStoryOverlay(root) {
  const scenes = [];
  let previousScrollPosition = 0;
  let isScrollingForward = true;

  root?.querySelectorAll('[data-story-scene]').forEach((element) => {
    const timing = STORY_SCENES[element.dataset.storyScene];
    // Markup with no entry in the table would otherwise sit at whatever opacity
    // the stylesheet gave it, for the whole journey. Skipping it is quieter than
    // throwing and is the same outcome as never having added it.
    if (timing) scenes.push({ element, timing });
  });

  function hide(element) {
    element.style.opacity = '0';
    element.setAttribute('aria-hidden', 'true');
  }

  function update(scrollViewportUnits) {
    const scrollDelta = scrollViewportUnits - previousScrollPosition;
    if (Math.abs(scrollDelta) > 0.0001) {
      isScrollingForward = scrollDelta > 0;
    }
    previousScrollPosition = scrollViewportUnits;

    for (const { element, timing } of scenes) {
      // A beat that has already played does not play again on the way back up.
      // Content is the opposite: scrolling back to where the hero lives is how
      // you re-read it.
      if (timing.forwardOnly && !isScrollingForward) {
        hide(element);
        continue;
      }

      const state = getScenePresence(scrollViewportUnits, timing);
      element.style.opacity = state.opacity.toFixed(3);
      element.style.transform =
        `translate3d(${state.offsetX.toFixed(1)}px, ${state.offsetY.toFixed(1)}px, 0)`;
      // Faded out is gone, not merely invisible: an overlay left in the
      // accessibility tree at opacity 0 is still read aloud and still tabbable,
      // which on a 28-viewport page means the whole journey's copy at once.
      element.setAttribute('aria-hidden', state.opacity < 0.01 ? 'true' : 'false');
    }
  }

  function dispose() {
    scenes.length = 0;
  }

  return { update, dispose };
}
