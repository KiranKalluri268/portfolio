/**
 * Reading a set of frame times honestly.
 *
 * Split out of curveRunner so it can be tested, which is the whole reason it
 * exists: the curve was trusted for months and was reporting the display rather
 * than the scene, and nothing in the code was in a position to notice.
 */

/** Middle value, averaging the two middle ones for an even-length set.
 *
 *  Worth knowing when reading a curve: with an even sample count, a pose that
 *  alternates between two vsync intervals reports the average of them, which
 *  looks like a real intermediate cost and is not. 17.4ms on a 144Hz screen is
 *  not a frame that took 17.4ms; it is frames alternating 13.9 and 20.8. */
export function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** No display refreshes faster than this, so no candidate interval below it. */
const MIN_INTERVAL_MS = 3;
/** Or slower than this. 40ms is 25Hz, below anything shipping. */
const MAX_INTERVAL_MS = 40;
/** How far off an exact multiple a reading may sit, as a fraction of one
 *  interval. Generous enough for timer jitter, tight enough that genuinely
 *  variable frame times do not all happen to land on a grid. */
const TOLERANCE = 0.12;
/** A single repeated value is a grid of one and explains nothing. */
const MIN_DISTINCT_STEPS = 2;

/**
 * Whether a set of readings is quantised to a display's refresh interval — that
 * is, whether the numbers are describing when frames were *presented* rather
 * than what they cost.
 *
 * The refresh rate is not asked for, because nothing reports it reliably. It is
 * inferred: the fastest reading is some whole number of intervals, so each of
 * `min`, `min/2`, `min/3`, `min/4` is a candidate, and the right one is the
 * largest that explains every reading. Trying `min` alone is not enough — a
 * device that never draws a frame in under two intervals never produces a
 * one-interval reading to be found.
 *
 * Half-steps count, because `median` above manufactures them out of a pose that
 * alternates between two intervals.
 *
 * Detecting it is not the same as it mattering, which is the mistake the first
 * version of this made. A frame time snapped to a 6.9ms grid is a floor when the
 * whole reading is three intervals — one interval is then a third of it, and a
 * change smaller than that is invisible. The same snapping at forty-nine
 * intervals is a rounding error of two per cent on a number that is otherwise
 * telling the truth. `resolutionFraction` is how much of the largest reading one
 * interval accounts for, and it is what decides whether the quantisation is worth
 * acting on.
 *
 * @param {number[]} readings
 * @returns {{ quantised: boolean, intervalMs: number | null,
 *   resolutionFraction: number | null }}
 */
export function detectVsyncQuantisation(readings) {
  const usable = readings.filter((value) => Number.isFinite(value) && value > 0);
  if (usable.length < 2) {
    return { quantised: false, intervalMs: null, resolutionFraction: null };
  }

  const fastest = Math.min(...usable);

  for (const divisor of [1, 2, 3, 4]) {
    const interval = fastest / divisor;
    if (interval < MIN_INTERVAL_MS || interval > MAX_INTERVAL_MS) continue;

    const step = interval / 2;
    const tolerance = interval * TOLERANCE;
    const steps = new Set();
    let explainsAll = true;

    for (const value of usable) {
      const nearestStep = Math.round(value / step);
      if (nearestStep < 1 || Math.abs(value - nearestStep * step) > tolerance) {
        explainsAll = false;
        break;
      }
      steps.add(nearestStep);
    }

    if (explainsAll && steps.size >= MIN_DISTINCT_STEPS) {
      return {
        quantised: true,
        intervalMs: interval,
        resolutionFraction: interval / Math.max(...usable),
      };
    }
  }

  return { quantised: false, intervalMs: null, resolutionFraction: null };
}

/**
 * Above this share of the largest reading, one refresh interval is coarse enough
 * that the curve cannot answer the question it is being asked.
 *
 * 0.10 rather than something tighter because the gate it serves is a comparison
 * between two runs on one device, and a grid that rounds to within a tenth of the
 * peak still ranks poses correctly and still shows a regression worth caring
 * about. Below that the right response is to note it; above it, to re-take the
 * sweep at a higher render scale.
 */
export const COARSE_RESOLUTION_FRACTION = 0.10;

/** How far below the peak a pose may sit and still count as part of the same
 *  plateau. Chosen against four real sweeps: the fall's flat top varies by 1-7%
 *  within itself, so anything tighter splits one plateau into several and
 *  anything much looser swallows the decline that follows it. */
const PLATEAU_TOLERANCE = 0.10;

/**
 * The flat top of a curve, rather than the single highest point on it.
 *
 * Reporting a peak was actively misleading here. Four sweeps of the same journey
 * proposed 0.68, 0.46, 0.25 and 0.14 for the same constant, not because the
 * devices disagreed about where the fall is expensive but because the fall is
 * flat and `max()` was ranking measurement scatter. The plateau is the honest
 * answer, and it comes out at 0.36-0.41 across all four.
 *
 * Contiguous from the peak rather than every pose within tolerance: a plateau is
 * a region, and a stray pose the far side of a dip is not part of it.
 *
 * @param {number[]} costs - in pose order.
 * @returns {{ startIndex: number, endIndex: number, peakIndex: number } | null}
 */
export function findPlateau(costs) {
  if (!costs.length) return null;

  let peakIndex = 0;
  for (let i = 1; i < costs.length; i++) {
    if (costs[i] > costs[peakIndex]) peakIndex = i;
  }

  const floor = costs[peakIndex] * (1 - PLATEAU_TOLERANCE);
  let startIndex = peakIndex;
  let endIndex = peakIndex;
  while (startIndex > 0 && costs[startIndex - 1] >= floor) startIndex--;
  while (endIndex < costs.length - 1 && costs[endIndex + 1] >= floor) endIndex++;

  return { startIndex, endIndex, peakIndex };
}
