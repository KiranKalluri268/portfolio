/** The pacing of the entry greeting.
 *
 *  The sequence is one gesture, not a slideshow: it leans in slowly, flicks
 *  through the middle too fast to read, and brakes to a halt on the last word
 *  before the push through it. So the holds are a curve, sampled once per
 *  greeting — not a list with one number per word. Adding or removing a
 *  greeting reshapes nothing; it just samples the same curve at more or fewer
 *  points, and the sequence still takes the same time end to end.
 */

/** Where along the sequence the eye is moving fastest, as a fraction of it.
 *  Before the halfway mark, so the deceleration is the longer half — that is
 *  the part anyone actually reads. */
export const PEAK_AT = 0.45;

/** The shape, in relative terms. Only the ratios matter: the holds are scaled
 *  to fit GREETING_MS afterwards, so these say "the last word rests six times
 *  as long as the fastest one", not "600ms". */
const WEIGHT_AT_START = 3.4;
const WEIGHT_AT_PEAK = 1;
const WEIGHT_AT_REST = 6;

/** How long the words take, before the fly-through. */
export const GREETING_MS = 3480;

/** The push through the final letter. */
export const FLY_MS = 1100;

/** The fly's easing, and the one line here worth checking against the spec
 *  rather than eyeballing.
 *
 *  This was cubic-bezier(0.55, 0, 1, 1), written as "ease-in" and not being
 *  one: with y1 = 0 and y2 = 1 the y curve works out as 3t^2 - 2t^3, a
 *  smoothstep, which eases *out* as well as in. The push therefore slowed to a
 *  crawl over the last third - the opposite of getting closer to something -
 *  and, landing right after a swell that had just stopped growing, read as a
 *  lurch that then stalled.
 *
 *  Both control points at y = 0 give y = t^3: accelerating the whole way, never
 *  turning over. */
export const FLY_EASING = "cubic-bezier(0.55, 0, 0.85, 0)";

/** How far the last word's swell is allowed to run past its own beat.
 *
 *  The swell and the push are scheduled by two different clocks - a CSS
 *  transition started by a render, and a setTimeout started by an effect after
 *  that render has painted - and on a loaded main thread they drift apart by a
 *  couple of hundred milliseconds. Whichever way that drift falls, it lands in
 *  the overrun, which under SWELL_FINAL_EASING is the flat tail of the curve
 *  where almost nothing is happening. The alternative is the swell finishing
 *  early and the word sitting dead still until the push notices. */
export const SWELL_OVERRUN_MS = 300;

/** How the type size moves within a single beat.
 *
 *  Linear for the run of greetings: each beat is a straight line between two
 *  samples of the size curve, and the curve's own shape lives in where those
 *  samples fall, not in how the gap between two of them is crossed. */
export const SWELL_EASING = "linear";

/** How the type size moves within the last beat, which is its own case.
 *
 *  The size curve accelerates all the way to the end, so its steepest segment
 *  is the final one - the last word arrived at its opening size, sat nearly
 *  still, and then bolted. Reading it as one gesture, that is backwards: the
 *  word should lunge as it lands and settle into its full size, and let the
 *  push supply the acceleration afterwards.
 *
 *  So the last beat alone runs on ease-out. Roughly seven-eighths of its growth
 *  happens in the first half of the beat, and the tail flattens into the
 *  overrun - which is what makes the drift between the two clocks invisible
 *  rather than something to be compensated for. */
export const SWELL_FINAL_EASING = "cubic-bezier(0.33, 1, 0.68, 1)";

/** The widest the grown word may be set, in vw.
 *
 *  The Indian greetings are single words set nowrap at up to twice the base,
 *  and the Telugu one is about 5.2em wide - on a 320px phone that overran the
 *  viewport by 31px and lost its last letter to the section's overflow.
 *
 *  This is a ceiling on the *base* size rather than on the grown one. Capping
 *  the grown size instead flattened the end of the swell on every screen under
 *  about 1130px: the word hit the cap two beats early and then sat there, which
 *  is the same stall this whole pass is about, just on a phone. Dividing it out
 *  of the base means the multiply is always clean and only the starting size
 *  gives way. */
export const MAX_WIDTH_VW = 17;

/** What the base size is divided by to keep the grown word on screen.
 *
 *  The swell reaches MAX_SCALE and stops, so 2.0 is what it actually needs.
 *  This is deliberately 10% clear of that: it was sized when the last beat
 *  overshot MAX_SCALE to hold its rate, and it is left there because the margin
 *  costs a little starting size on narrow screens and buys the room for the
 *  last word to be given a bigger target again without anything clipping.
 *  Lowering it to 2.0 would make the greeting 10% larger below about 1130px. */
export const SWELL_HEADROOM = 2.2;

/** Below this a word is a flicker rather than a glimpse, so a long list
 *  stretches the sequence instead of becoming subliminal. */
export const MIN_HOLD_MS = 90;

/** How far along the fly the word disappears, as a fraction of it.
 *
 *  A hard cut, not a fade. Passing through something does not dim it on the
 *  way past - it is solid right up to the moment it is behind you, and then it
 *  is not there. The fade this replaced started at 0.55 and spent the last
 *  45% of the push turning the letterform translucent, which read as the word
 *  dissolving in front of the camera rather than the camera going through it.
 *
 *  Late is the whole point: at 0.9 the glyph is measured at about 35x its own size and the gap
 *  it was aimed at is many screens wide, so what leaves is a colour, not a
 *  shape. Pulling this much before about 0.8 puts a recognisable letter on
 *  screen at the instant it vanishes, and the cut becomes a blink. */
export const FLY_CUT_AT = 0.9;

/** The type size the last greeting reaches, as a multiple of the opening one. */
export const MAX_SCALE = 2;

/** Where the swell starts, as a fraction of the sequence.
 *
 *  The same point the words are moving fastest. Growing before then would
 *  fight the acceleration - the eye would be asked to read a speeding-up
 *  slideshow and a looming word at once - and starting it later, at the first
 *  Indian greeting, left the growth crammed into the last few beats where it
 *  arrived as a lurch rather than an approach. */
export const GROWTH_STARTS_AT = PEAK_AT;

/** The swell's own curve: barely moving as it leaves the peak, fastest as it
 *  hands over to the fly-through.
 *
 *  It has to end fast. The fly accelerates away from wherever the type size
 *  left off, so a swell that grew at a constant rate and then stopped dead put
 *  a corner in the middle of one continuous move - the size visibly caught,
 *  then restarted. An accelerating swell hands over at speed instead. */
const GROWTH_EASE_POWER = 2.2;

/** How far past the viewport the final greeting is driven. Enough that the
 *  chosen gap in the letterform is wider than the screen well before the fade
 *  finishes, so what is left is the space, not the glyph. */
export const FLY_SCALE = 70;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Ease in and out of the turn. A straight ramp would give the sequence a
 *  visible corner at the peak — it would read as two speeds rather than one
 *  accelerating and decelerating move. */
const smoothstep = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/** The hold curve, in relative weight, at a point along the sequence. */
export function holdWeightAt(position: number) {
  const t = clamp01(position);
  if (t <= PEAK_AT) {
    return lerp(WEIGHT_AT_START, WEIGHT_AT_PEAK, smoothstep(t / PEAK_AT));
  }
  return lerp(WEIGHT_AT_PEAK, WEIGHT_AT_REST, smoothstep((t - PEAK_AT) / (1 - PEAK_AT)));
}

/** How long each of `count` greetings holds, in order.
 *
 *  Scaled so the set adds up to GREETING_MS, which is what keeps the arc the
 *  same shape whether the list has six greetings or twenty: more of them just
 *  samples the same curve at more points.
 *
 *  The one thing that outranks the total is the shape. Pinning the quick
 *  middle of a long list at MIN_HOLD_MS would flatten the lean-in into a row
 *  of identical flickers - the sequence would still take 3.48s and no longer
 *  be a gesture. So when the fastest beat would fall through the floor the
 *  whole set is stretched until it sits on it, and the sequence gets longer
 *  instead of flatter. That only happens past about fourteen greetings, and it
 *  is gradual: the ratios never change.
 */
export function holdsFor(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [GREETING_MS];

  const weights = Array.from({ length: count }, (_, index) =>
    holdWeightAt(index / (count - 1)),
  );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  const fit = GREETING_MS / totalWeight;
  const floorFit = MIN_HOLD_MS / Math.min(...weights);
  const scale = Math.max(fit, floorFit);

  return weights.map((weight) => Math.round(weight * scale));
}

/** The type scale at a point along the sequence. Flat until the swell starts,
 *  then accelerating to MAX_SCALE on the last word. */
export function scaleAt(position: number) {
  const t = clamp01(position);
  if (t <= GROWTH_STARTS_AT) return 1;
  const u = (t - GROWTH_STARTS_AT) / (1 - GROWTH_STARTS_AT);
  return lerp(1, MAX_SCALE, Math.pow(u, GROWTH_EASE_POWER));
}

/** The type scale of the `index`th of `count` greetings. Spread across the
 *  whole run rather than counted off a list, so it reaches MAX_SCALE on the
 *  last word whatever the count - and starts where the speed peaks, not where
 *  the content file happens to change groups. */
export function scaleFor(index: number, count: number) {
  if (count <= 1) return MAX_SCALE;
  return scaleAt(index / (count - 1));
}

/** How the size moves on one beat: what it is aimed at, how long it has, and
 *  how it gets there.
 *
 *  Every beat but the last is a straight line to its sample of the size curve.
 *  The last is the shaped one - it lands on MAX_SCALE exactly, takes the
 *  overrun to do it, and eases out, so the growth is spent early and the tail
 *  is flat.
 */
export function swellFor(index: number, count: number) {
  const scale = scaleFor(index, count);
  const duration = holdsFor(count)[index];
  if (count < 2 || index !== count - 1) {
    return { scale, duration, easing: SWELL_EASING };
  }

  return {
    scale,
    duration: duration + SWELL_OVERRUN_MS,
    easing: SWELL_FINAL_EASING,
  };
}

/** Total wall time from the curtain opening to the name beginning to type. */
export function greetingSequenceMs(count: number) {
  return holdsFor(count).reduce((sum, hold) => sum + hold, 0) + FLY_MS;
}
