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
 * @param {number[]} readings
 * @returns {{ quantised: boolean, intervalMs: number | null }}
 */
export function detectVsyncQuantisation(readings) {
  const usable = readings.filter((value) => Number.isFinite(value) && value > 0);
  if (usable.length < 2) return { quantised: false, intervalMs: null };

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
      return { quantised: true, intervalMs: interval };
    }
  }

  return { quantised: false, intervalMs: null };
}
