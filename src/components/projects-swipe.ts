/** Gesture maths for the projects carousel's touch handling.
 *
 * The carousel has no horizontal scroller of its own: vertical scroll position
 * is the single source of truth, and a pinned ScrollTrigger maps it to the
 * track's `x`. A horizontal swipe therefore works by moving the page's vertical
 * scroll by the equivalent amount, which keeps the track, the panel focus
 * animations, the title, and the active-panel state all deriving from one
 * value. These helpers are pure so the mapping can be tested without a browser.
 */

/** Movement, in px, before a gesture commits to an axis. Below this a touch is
 *  still a potential tap, so nothing is intercepted. */
export const AXIS_LOCK_THRESHOLD = 10;

/** How long the release velocity is allowed to keep carrying the carousel.
 *  Roughly the glide of a native momentum scroll without overshooting. */
export const MOMENTUM_MS = 220;

export const MIN_MOMENTUM_VELOCITY = 0.15; // px per ms
export const MIN_SETTLE_SECONDS = 0.25;
export const MAX_SETTLE_SECONDS = 0.9;

/** How much more horizontal than vertical a gesture must be before the carousel
 *  claims it — about a 39° cone either side of horizontal.
 *
 *  Comparing the two distances directly is not enough: touch coordinates arrive
 *  as 32-bit floats, so a perfect diagonal can report |dx| greater than |dy| by
 *  a millionth of a pixel and get claimed. Requiring real dominance also suits
 *  the gesture itself, since nobody swipes in a perfectly straight line and the
 *  page scroll should win anything close to a tie. */
export const AXIS_DOMINANCE = 1.25;

export type SwipeAxis = "horizontal" | "vertical";

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Which way a gesture is going, or null while it is still ambiguous.
 *
 * Anything short of clearly horizontal counts as vertical: scrolling the page
 * is the primary gesture, so an uncertain swipe should never steal it. */
export function resolveAxis(
  deltaX: number,
  deltaY: number,
  threshold: number = AXIS_LOCK_THRESHOLD,
): SwipeAxis | null {
  const distanceX = Math.abs(deltaX);
  const distanceY = Math.abs(deltaY);
  if (Math.max(distanceX, distanceY) < threshold) return null;
  return distanceX > distanceY * AXIS_DOMINANCE ? "horizontal" : "vertical";
}

/** Vertical scroll distance that moves the track one pixel horizontally. */
export function scrollPerPixel(verticalTravel: number, horizontalTravel: number) {
  if (horizontalTravel <= 0) return 0;
  return verticalTravel / horizontalTravel;
}

/** Scroll position that keeps content under the finger 1:1.
 *
 * Dragging right (positive deltaX) pulls earlier panels back into view, which
 * means moving *backwards* through the scroll range. */
export function dragTarget({
  startScroll,
  deltaX,
  ratio,
  min,
  max,
}: {
  startScroll: number;
  deltaX: number;
  ratio: number;
  min: number;
  max: number;
}) {
  return clamp(startScroll - deltaX * ratio, min, max);
}

/** Where a flick should coast to after the finger lifts. */
export function momentumTarget({
  scroll,
  velocityX,
  ratio,
  min,
  max,
}: {
  scroll: number;
  /** Horizontal finger velocity in px per ms; positive is rightwards. */
  velocityX: number;
  ratio: number;
  min: number;
  max: number;
}) {
  if (Math.abs(velocityX) < MIN_MOMENTUM_VELOCITY) return clamp(scroll, min, max);
  return clamp(scroll - velocityX * MOMENTUM_MS * ratio, min, max);
}

/** Settle duration in seconds, scaled to how far the carousel still has to
 *  travel so a short glide does not take as long as a long one. */
export function settleSeconds(distance: number, viewportHeight: number) {
  if (distance <= 0 || viewportHeight <= 0) return 0;
  const travelRatio = Math.min(1, distance / viewportHeight);
  return clamp(
    MIN_SETTLE_SECONDS + travelRatio * (MAX_SETTLE_SECONDS - MIN_SETTLE_SECONDS),
    MIN_SETTLE_SECONDS,
    MAX_SETTLE_SECONDS,
  );
}

/** Tracks recent points so release velocity reflects the end of the gesture
 *  rather than its whole length — a slow drag that ends in a flick should
 *  still flick. */
export class VelocityTracker {
  private samples: Array<{ x: number; time: number }> = [];
  /** Samples older than this are dropped before velocity is measured. */
  constructor(private readonly windowMs = 100) {}

  add(x: number, time: number) {
    this.samples.push({ x, time });
    while (this.samples.length > 2 && time - this.samples[0].time > this.windowMs) {
      this.samples.shift();
    }
  }

  reset() {
    this.samples = [];
  }

  /** px per ms, positive when moving right. Zero if the finger paused, which
   *  is what makes "drag and hold, then release" stop where it was left. */
  velocity() {
    if (this.samples.length < 2) return 0;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const elapsed = last.time - first.time;
    if (elapsed <= 0) return 0;
    return (last.x - first.x) / elapsed;
  }
}
