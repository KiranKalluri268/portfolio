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

/**
 * The world config for one visit, with any overrides the URL asked for.
 *
 * The flags above are the shipped answer and stay false. This is how a phase
 * gets *looked at* before that answer changes: `?world=sky` turns one on for the
 * current page load and nothing else.
 *
 * It exists because the alternative was worse. Reviewing a phase meant editing
 * `worldConfig.js`, rebuilding and restarting, which is slow, easy to forget, and
 * — as happened the first time — indistinguishable from the feature not working.
 * The route already takes `?devtools=1` and `?curve=1` for the same reason.
 *
 * Overrides are per-load and never persisted. Nothing here can change what a
 * visitor who did not type it gets.
 *
 * @param {string} search - `window.location.search`.
 * @returns {Readonly<WorldConfig>}
 */
export function resolveWorldConfig(search) {
  const resolved = { ...worldConfig };

  let requested = [];
  try {
    requested = (new URLSearchParams(search).get("world") ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
  } catch {
    // A malformed query string is not a reason to fail to render a page.
    return Object.freeze(resolved);
  }

  for (const name of requested) {
    // Unknown names are ignored rather than thrown on. A typo should leave the
    // journey exactly as it was, not break it — and silently adding a property
    // that nothing reads would be worse than either.
    if (Object.prototype.hasOwnProperty.call(resolved, name)) {
      resolved[/** @type {keyof WorldConfig} */ (name)] = true;
    }
  }

  return Object.freeze(resolved);
}

/**
 * How bright the sky's domain arms are drawn.
 *
 * A number rather than a flag because it is the one value in the sky that cannot
 * be reasoned to and has to be found by looking, and because the place that
 * would normally be found — the lab, with its lil-gui — cannot run this feature:
 * the arms are fed from `src/data/skill-web.json`, which lives in this repo and
 * not in that one.
 *
 * `?armGain=0.2`. Out-of-range and unparseable values fall back to the default
 * rather than rendering a blown-out or invisible sky.
 *
 * @param {string} search
 * @param {number} fallback
 * @returns {number}
 */
export function resolveArmGain(search, fallback) {
  let raw = null;
  try {
    raw = new URLSearchParams(search).get("armGain");
  } catch {
    return fallback;
  }
  if (raw === null) return fallback;

  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value < 0 || value > 5) return fallback;
  return value;
}

/**
 * Which layers of the sky are drawn.
 *
 * All four are on by default and this is a diagnostic, not a feature. The
 * journey has a long-standing complaint — the world reads as a sphere rather
 * than as open space — and there are four things stacked on top of each other
 * that could each be causing it:
 *
 * - `dust`   the point field, a hollow shell with a wall at one radius and a
 *            void at another, which the camera crosses end to end.
 * - `glow`   `mix(plane_color, pole_color, ...)` on `abs(dir.y)`, which paints a
 *            bright equator fading to dark poles. That is a sphere, drawn.
 * - `nebula` the background plate, sampled equirectangularly, so it pinches and
 *            converges at the poles the way a panorama on a ball does.
 * - `stars`  the star plate, sampled the same way.
 *
 * Reasoning about which from the source has already produced one wrong answer.
 * `?sky=nodust`, `?sky=noglow,nonebula` and so on turn them off one at a time so
 * the question can be settled by looking instead.
 *
 * @param {string} search
 * @returns {Readonly<{ dust: boolean, glow: boolean, nebula: boolean, stars: boolean }>}
 */
export function resolveSkyLayers(search) {
  const layers = { dust: true, glow: true, nebula: true, stars: true };

  let requested = [];
  try {
    requested = (new URLSearchParams(search).get("sky") ?? "")
      .split(",")
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean);
  } catch {
    return Object.freeze(layers);
  }

  for (const name of requested) {
    if (!name.startsWith("no")) continue;
    const layer = name.slice(2);
    if (Object.prototype.hasOwnProperty.call(layers, layer)) {
      layers[/** @type {keyof typeof layers} */ (layer)] = false;
    }
  }

  return Object.freeze(layers);
}
