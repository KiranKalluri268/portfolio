/**
 * Which parts of the world are switched on.
 *
 * `CINEMATIC_WORLD_PLAN.md` builds the world in phases, one feature each, and
 * every one of them arrives behind a flag here. Not because a flag is tidy, but
 * because of what the flag is for: the journey is a 28-viewport scroll-driven
 * scene whose cost is dominated by a fullscreen raymarcher, and a phase that
 * turns out to be too expensive on a real phone has to be switchable off in
 * production without a revert. That is exactly what `PLANET_ENABLED` was — a
 * single boolean holding back a finished, unmounted feature — and this is that
 * pattern given somewhere to live before there are five of them scattered
 * through a thousand-line file.
 *
 * Every flag is false. A phase turns its own one on, in its own change, once its
 * measurements are in. Nothing here may default to true.
 */

/**
 * @typedef {Object} WorldConfig
 * @property {boolean} sky - Procedural galaxy sampled from the escaped ray
 *   direction, replacing the bounded point shell as the backdrop. Phase 1.
 * @property {boolean} bodies - The star and the planets, drawn into one scene
 *   and one render target. Phase 2. This is the flag `PLANET_ENABLED` became:
 *   the single planet is the first instance of the body system rather than a
 *   feature beside it.
 * @property {boolean} rings - The orbital rings, one per role. Phase 3.
 * @property {boolean} contentAnchors - Story sections taking positions in the
 *   world rather than on the screen. Phase 4.
 * @property {boolean} heroStar - The hero rendered as the star it is meant to
 *   be, rather than as the plain site's header. Phase 6.
 */

/** @type {Readonly<WorldConfig>} */
export const worldConfig = Object.freeze({
  sky: false,
  bodies: false,
  rings: false,
  contentAnchors: false,
  heroStar: false,
});

/**
 * The flag names, in the order the phases build them.
 *
 * Exported so a test can assert the set has not drifted from the object without
 * restating it, and so anything that wants to report the world's state can do so
 * without hardcoding a list that will go stale.
 *
 * @type {ReadonlyArray<keyof WorldConfig>}
 */
export const WORLD_FEATURES = Object.freeze(
  /** @type {Array<keyof WorldConfig>} */ (Object.keys(worldConfig)),
);
