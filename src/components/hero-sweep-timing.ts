/** The pacing of the sweep-in used for the hero's name and role lines.
 *
 *  Replaces a per-character typewriter, which reads as a machine printing
 *  each letter. This instead lands the whole line as one gesture: the left
 *  letter arrives first, each one after it a beat later, close enough that
 *  the eye reads a single curve sweeping into place rather than letters
 *  appearing in turn.
 */

/** How long one letter takes to arrive. Short - this is meant to read as
 *  fast, not as a reveal to watch. */
export const LETTER_DURATION_MS = 380;

/** The delay between one letter starting and the next one starting. Far
 *  below LETTER_DURATION_MS, so consecutive letters are already moving
 *  together rather than one finishing before the next begins - that overlap
 *  is what keeps it reading as a line, not a row of separate pops. */
export const LETTER_STAGGER_MS = 16;

/** The overshoot on arrival: it lands past its resting position and settles
 *  back, rather than easing to a dead stop. GSAP's own named ease - no custom
 *  curve to keep in sync with anything. */
export const SWEEP_EASE = "back.out(1.7)";

/** How long a role sits fully in view before the loop moves on to the next
 *  one. */
export const ROLE_HOLD_MS = 1600;

/** When a role wraps onto two words/lines, how far ahead of the trailing one
 *  the leading word starts - see SweepText's `groupByWord`. Short enough that
 *  the two are still one continuous move, not two separate ones. */
export const GROUP_STAGGER_MS = 80;
