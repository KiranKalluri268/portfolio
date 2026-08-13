/** The travelling pill shared by the home page's scene dots and the projects
 *  view toggle.
 *
 * Both are a small bar of choices with one highlight that slides between them,
 * and the highlight is the whole of the affordance — the choices underneath it
 * stay uniform. The behaviour worth keeping in one place is that the pill
 * *grows while it travels*: at rest it sits inside the bar, and while moving it
 * stands outside it on every side, then settles back in. Copying that into a
 * second component would be two sets of numbers to keep level with each other.
 */

/** The pill's clearance from the bar, measured against the bar's outer edge.
 *  Idle it sits this far inside on every side; moving it stands this far
 *  outside on every side. Driving the track's padding and the pill's moving
 *  width from the same number is what keeps both gaps even at the ends, where
 *  the geometry is otherwise set by the run from the end choice to the edge. */
export const PILL_GAP = 5;

/** How long the pill takes to travel, and so how long it stays at its larger
 *  size after a choice is made. */
export const PILL_TRAVEL_MS = 250;

/** Size settles faster than the pill travels, so it is already at its larger
 *  size for most of the journey rather than arriving and then swelling. */
export const PILL_SIZE_MS = 200;

/** The pill's own look, so both bars are unmistakably the same control. */
export const PILL_CLASS =
  "pointer-events-none absolute top-1/2 left-0 rounded-full border border-accent-soft/50 bg-accent/25 shadow-[0_0_18px_rgba(224,69,10,0.45)]";

export interface PillMetrics {
  idleWidth: number;
  idleHeight: number;
  moveWidth: number;
  moveHeight: number;
  /** Padding for the track that puts the pill exactly `PILL_GAP` inside the
   *  bar's end when it rests on the first or last choice. */
  trackPadding: number;
}

/** The pill's two sizes and the padding that squares it with the bar's ends.
 *
 * `navHeight` and `border` are the bar's own, measured rather than assumed —
 * the choices are padded differently at each breakpoint. `idleWidth` is given
 * when the choices are labels wide enough to need covering; left out, the pill
 * is a lozenge sized off its own height, which is what the dots want. */
export function pillMetrics(
  navHeight: number,
  border: number,
  firstCenter: number,
  idleWidth?: number,
): PillMetrics {
  const idleHeight = Math.max(18, navHeight - PILL_GAP * 2);
  const width = idleWidth ?? Math.round(idleHeight * 1.6);
  return {
    idleWidth: width,
    idleHeight,
    // Standing PILL_GAP outside the bar on every side. Solving the same
    // geometry the other way gives the width: the extra needed at the ends is
    // the idle gap plus the outer one, twice over.
    moveWidth: width + PILL_GAP * 4,
    moveHeight: navHeight + PILL_GAP * 2,
    trackPadding: Math.max(0, PILL_GAP + width / 2 - firstCenter - border),
  };
}

/** The pill's transition. `easePosition` is false only while something is
 *  dragging it, where the position must follow the finger with no easing at
 *  all — the size still animates. */
export function pillTransition(reduceMotion: boolean, easePosition = true) {
  if (reduceMotion) return "none";
  const size = `width ${PILL_SIZE_MS}ms ease-out, height ${PILL_SIZE_MS}ms ease-out`;
  return easePosition ? `transform ${PILL_TRAVEL_MS}ms ease-out, ${size}` : size;
}
