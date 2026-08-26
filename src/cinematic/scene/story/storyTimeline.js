// Scroll positions are viewport units and line up with JOURNEY in main.js.
//
// Two kinds of thing sit on this timeline now, and the difference is worth
// naming. `horizonMessage` is the film's own copy — it belongs to the journey
// and means nothing outside it. `heroIntro` is the *site's* content scored
// against the flight: the same three facts the plain presentation opens with,
// arriving at a point in the journey rather than at the top of a page. That
// second kind is what step 5 of CINEMATIC_DECISION.md is for, and there will be
// more of them.
//
// This is where this file diverges from portfolio-3D's, permanently and on
// purpose. The lab has a shader and no portfolio; scoring content against the
// camera is not a thing it can have an opinion about.
export const STORY_SCENES = {
  /**
   * The hero, over the wormhole crossing.
   *
   * Present from the first frame rather than faded in, because the gate opens at
   * scroll 0 and a portfolio whose owner's name only appears once you have
   * scrolled is a portfolio that failed to introduce itself. It leaves during
   * the crossing, well before the blackout at 6.5 takes the frame.
   */
  heroIntro: {
    fadeInStart: 0,
    holdStart: 0,
    holdEnd: 2.60,
    fadeOutEnd: 3.40,
  },

  // The message rides the blackout: it arrives as the frame goes dark at 6.5 and
  // is gone before the passage is revealed at ~7.2.
  horizonMessage: {
    fadeInStart: 6.30,
    holdStart: 6.50,
    holdEnd: 6.90,
    fadeOutEnd: 7.05,
    // A beat, not a place. Scrolling back up should not replay it, the way
    // scrolling back up to the hero should absolutely show you the hero.
    forwardOnly: true,
  },
};

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function getScenePresence(progress, scene) {
  // Strictly before rather than at-or-before, which is what lets a scene be
  // present at its own first frame. heroIntro starts at 0 and the journey starts
  // at 0, so under `<=` the hero was outside its own window for the one scroll
  // position every visitor is guaranteed to see.
  //
  // Safe for the scenes that do ramp: at exactly `fadeInStart` the ramp below
  // evaluates to smoothstep(0), which is 0 — the same answer the early return
  // was giving. And a zero-length ramp can never reach that division, since
  // `progress < holdStart` is false whenever `holdStart === fadeInStart`.
  if (progress < scene.fadeInStart || progress >= scene.fadeOutEnd) {
    return {
      opacity: 0,
      offsetX: progress < scene.fadeInStart ? -48 : 48,
      offsetY: progress < scene.fadeInStart ? 48 : -48,
    };
  }

  if (progress < scene.holdStart) {
    const t = smoothstep((progress - scene.fadeInStart) / (scene.holdStart - scene.fadeInStart));
    return { opacity: t, offsetX: -48 * (1 - t), offsetY: 48 * (1 - t) };
  }

  if (progress <= scene.holdEnd) {
    return { opacity: 1, offsetX: 0, offsetY: 0 };
  }

  const t = smoothstep((progress - scene.holdEnd) / (scene.fadeOutEnd - scene.holdEnd));
  return { opacity: 1 - t, offsetX: 48 * t, offsetY: -48 * t };
}
