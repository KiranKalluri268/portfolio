import { STORY_SCENES, getScenePresence } from './storyTimeline';

// `root` is passed in rather than looked up by id. In portfolio-3D the overlay
// is a fixed element in index.html; here it is rendered by React inside the
// route, so the caller is the only thing that knows where it is.
export function createStoryOverlay(root) {
  const scenes = new Map();
  let previousScrollPosition = 0;
  let isScrollingForward = true;

  root?.querySelectorAll('[data-story-scene]').forEach((element) => {
    scenes.set(element.dataset.storyScene, element);
  });

  function update(scrollViewportUnits) {
    const horizonElement = scenes.get('horizonMessage');
    if (!horizonElement) return;

    const scrollDelta = scrollViewportUnits - previousScrollPosition;
    if (Math.abs(scrollDelta) > 0.0001) {
      isScrollingForward = scrollDelta > 0;
    }
    previousScrollPosition = scrollViewportUnits;

    if (!isScrollingForward) {
      horizonElement.style.opacity = '0';
      horizonElement.setAttribute('aria-hidden', 'true');
      return;
    }

    const state = getScenePresence(scrollViewportUnits, STORY_SCENES.horizonMessage);
    horizonElement.style.opacity = state.opacity.toFixed(3);
    horizonElement.style.transform = `translate3d(${state.offsetX.toFixed(1)}px, ${state.offsetY.toFixed(1)}px, 0)`;
    horizonElement.setAttribute('aria-hidden', state.opacity < 0.01 ? 'true' : 'false');
  }

  function dispose() {
    scenes.clear();
  }

  return { update, dispose };
}
