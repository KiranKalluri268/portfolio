/**
 * The skill web's domains, turned into the uniforms the sky shader draws its
 * arms from.
 *
 * Pure, and separate from the scene, for two reasons. It is the one part of the
 * sky that can be tested without a GPU — which makes it the part worth putting
 * the logic in. And it is where §8's rule that content never forks is actually
 * enforced: the angles and the colours come out of `src/data/skill-web.json`, the
 * same file `/skills` lays its radial map out from, so the two cannot drift.
 *
 * A sixth domain added to that file changes the sky, with no shader edit.
 */

/** Must match DOMAIN_SLOTS in the fragment shader. GLSL ES 1.00 wants a constant
 *  loop bound, so the arrays are a fixed length and `count` says how much of them
 *  is real. Eight against today's five leaves room without being a promise. */
export const DOMAIN_SLOTS = 8;

const DEG_TO_RAD = Math.PI / 180;

/**
 * `#rrggbb` or `#rgb` to linear-ish 0..1 components.
 *
 * No sRGB decode. Every other colour the scene hands the shader — `bg_tint`,
 * `disk_tint`, `space_color_plane` — is a raw triple tuned by eye against the
 * render, and putting one colour through a transfer function the others do not
 * use would make the arms disagree with everything around them. The accents come
 * from the same file the site's CSS uses and are meant to be recognisably those
 * colours, not physically reconstructed ones.
 */
function parseHex(hex) {
  const value = String(hex ?? "").trim().replace(/^#/, "");
  const full =
    value.length === 3
      ? value.split("").map((c) => c + c).join("")
      : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255,
  ];
}

/**
 * @param {unknown} skillWeb - the parsed contents of src/data/skill-web.json.
 *   Typed loosely on purpose: this runs against a file a human edits, and the
 *   whole point of the guards below is that it survives whatever is in there.
 * @returns {{ count: number, angles: number[], colors: number[][] }}
 *   `angles` in radians and `colors` as 0..1 triples, both padded to
 *   DOMAIN_SLOTS so they can be uploaded as fixed-length uniform arrays.
 */
export function buildArmUniforms(skillWeb) {
  const source = /** @type {{ domains?: unknown }} */ (skillWeb ?? {});
  const domains = Array.isArray(source.domains)
    ? /** @type {Array<{ slug?: string, angle?: number, accent?: string }>} */ (source.domains)
    : [];

  const usable = domains.filter(
    (domain) =>
      Number.isFinite(domain?.angle) && parseHex(domain?.accent) !== null,
  );

  // More domains than slots is a content change outrunning the shader rather
  // than a bug to swallow silently: the sky would quietly stop showing one.
  if (usable.length > DOMAIN_SLOTS) {
    console.warn(
      `The sky can draw ${DOMAIN_SLOTS} domain arms and skill-web.json has ` +
        `${usable.length}. Raise DOMAIN_SLOTS here and in the shader.`,
    );
  }

  const kept = usable.slice(0, DOMAIN_SLOTS);

  const angles = new Array(DOMAIN_SLOTS).fill(0);
  const colors = Array.from({ length: DOMAIN_SLOTS }, () => [0, 0, 0]);

  kept.forEach((domain, index) => {
    angles[index] = domain.angle * DEG_TO_RAD;
    colors[index] = parseHex(domain.accent);
  });

  return { count: kept.length, angles, colors };
}
