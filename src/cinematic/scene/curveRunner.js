// Measures what each part of the journey actually costs, on the device you are
// holding.
//
// Every tuning decision so far has rested on a guess about where the expensive
// frames are, and the guess has been wrong twice. First the benchmark judged
// devices on the wormhole opening, which is the cheapest thing the scene draws.
// Then it was moved to 0.85 of the approach on the assumption that closest is
// most expensive - and an iPhone reading said 40-45fps mid-approach against
// 50-60fps up close, which is the opposite. Plausible in hindsight: once the
// shadow fills the frame, rays that hit the horizon terminate early and cheap,
// where mid-distance the frame is mostly background and disk seen through hard
// lensing, and those rays spend their whole step budget.
//
// So rather than guess a third time: hold the tier still, walk the camera
// through the whole journey a pose at a time, and report the frame time at each.
// The answer is a curve, not a point, and the per-act budget work will want the
// whole curve anyway.
//
// Runs only behind ?curve=1. It drives the camera itself and is useless with
// anyone scrolling, so it says so on screen while it works.

import { detectVsyncQuantisation, median } from './performance/frameStats';

const SETTLE_FRAMES = 10;   // discarded per pose: tier/pose changes cost frames
const SAMPLE_FRAMES = 30;   // measured per pose

/**
 * @param {object} options
 * @param {{ crossingEnd: number, blackoutEnd: number, tunnelEnd: number,
 *   arrivalEnd: number, approachEnd: number }} options.journey
 * @param {() => string} options.getTier
 * @param {(pose: number | null) => void} options.onPose
 * @param {import('./performance/gpuTimer').createGpuTimer extends
 *   (...args: never[]) => infer T ? T | null : null} [options.gpuTimer] - real
 *   GPU time where the driver offers it. Absent or unsupported is normal, not a
 *   failure: iOS Safari has no such extension.
 * @param {number | null} [options.measureScale] - the render scale the sweep is
 *   being taken at, for the report to state. Purely informational here; the
 *   scale itself is applied by the caller.
 */
export function createCurveRunner({ journey, onPose, getTier, gpuTimer = null, measureScale = null }) {
  // Every 1.5 units from the start to the end of the fall. Fine enough to find a
  // peak, coarse enough to finish on a phone that manages 5fps at the worst of
  // it.
  const poses = [];
  for (let units = 0; units <= journey.approachEnd; units += 1.5) {
    poses.push(Number(units.toFixed(2)));
  }

  const results = [];
  let poseIndex = 0;
  let framesAtPose = 0;
  let samples = [];
  let finished = false;

  // GPU samples come back two or three frames after the frame that produced
  // them, so they cannot be counted against whichever pose happens to be current
  // when they land. Each query is tagged with the pose index it was issued for
  // and sorted into this on arrival.
  //
  // Keyed by pose index rather than pushed into `samples`, because a result can
  // and does arrive after its pose has already been reported - the last few
  // frames of every pose resolve during the first few of the next one.
  /** @type {Map<number, number[]>} */
  const gpuSamplesByPose = new Map();

  function drainGpuSamples() {
    if (!gpuTimer?.supported) return;
    for (const { tag, ms } of gpuTimer.collect()) {
      if (typeof tag !== 'number') continue;
      const bucket = gpuSamplesByPose.get(tag);
      if (bucket) bucket.push(ms);
      else gpuSamplesByPose.set(tag, [ms]);
    }
  }

  const panel = document.createElement('div');
  panel.id = 'curve-runner';
  panel.textContent = 'Measuring the journey. Do not scroll.';
  document.body.appendChild(panel);

  function phaseOf(units) {
    if (units <= journey.crossingEnd) return 'crossing';
    if (units <= journey.blackoutEnd) return 'blackout';
    if (units <= journey.tunnelEnd) return 'tunnel';
    if (units <= journey.arrivalEnd) return 'arrival';
    return 'fall';
  }

  /** Called once per frame. Returns the pose to render, or null when done. */
  function update(frameMs) {
    if (finished) return null;

    drainGpuSamples();

    framesAtPose++;
    if (framesAtPose > SETTLE_FRAMES) samples.push(frameMs);

    if (framesAtPose >= SETTLE_FRAMES + SAMPLE_FRAMES) {
      const units = poses[poseIndex];
      const ms = median(samples);
      results.push({ units, phase: phaseOf(units), ms, fps: 1000 / ms, pose: poseIndex });

      poseIndex++;
      framesAtPose = 0;
      samples = [];

      if (poseIndex >= poses.length) {
        // The last few GPU queries are still in flight and are simply let go.
        // They resolve two or three frames after the frame that issued them, so
        // the final pose reports a median over about 27 samples instead of 30,
        // which does not move it. Draining them would mean rendering on after the
        // sweep has visibly ended, and a mutation test could not tell the
        // difference - untestable machinery inside a measuring instrument is what
        // this whole file is currently being fixed for.
        finished = true;
        report();
        return null;
      }
      panel.textContent =
        `Measuring ${getTier()}: ${poseIndex} / ${poses.length} poses. Do not scroll.`;
    }

    return poses[poseIndex];
  }

  function report() {
    const tier = getTier();

    // GPU time where the extension exists, wall-clock otherwise. Attach both to
    // every row, and choose one to reason about.
    for (const row of results) {
      const gpuSamples = gpuSamplesByPose.get(row.pose) ?? [];
      row.gpuMs = gpuSamples.length ? median(gpuSamples) : null;
    }

    const hasGpuTiming = results.some((r) => r.gpuMs !== null);

    // Which column the peaks and the benchmark suggestion are read from. GPU
    // time is what the frame cost; wall-clock is when it was presented, and on
    // any device drawing faster than its screen the second is the screen.
    const cost = (row) => (hasGpuTiming && row.gpuMs !== null ? row.gpuMs : row.ms);

    const wallReadings = results.map((r) => r.ms);
    const { quantised, intervalMs } = detectVsyncQuantisation(wallReadings);

    const peak = results.reduce((a, b) => (cost(b) > cost(a) ? b : a), results[0]);
    const fallPoses = results.filter((r) => r.phase === 'fall');
    const fallPeak = fallPoses.length
      ? fallPoses.reduce((a, b) => (cost(b) > cost(a) ? b : a), fallPoses[0])
      : null;

    // The number the benchmark actually needs: where in the approach the fall is
    // most expensive, as a fraction, which is what BENCHMARK_APPROACH_PROGRESS
    // is expressed in.
    const fallSpan = journey.approachEnd - journey.arrivalEnd;
    const peakProgress = fallPeak
      ? ((fallPeak.units - journey.arrivalEnd) / fallSpan).toFixed(2)
      : 'n/a';

    const rows = results
      .map((r) => {
        const gpu = r.gpuMs === null ? '      -' : `${r.gpuMs.toFixed(2).padStart(6)}ms`;
        return `${String(r.units).padStart(5)}  ${r.phase.padEnd(8)} ${r.ms.toFixed(1).padStart(6)}ms ${r.fps.toFixed(0).padStart(4)}fps ${gpu}`;
      })
      .join('\n');

    const header =
      `tier ${tier}` +
      (measureScale ? `, measured at ${measureScale}x render scale` : '') +
      (hasGpuTiming ? ', GPU timing available' : ', no GPU timing on this device');

    // The warning that would have saved this scene months of trusting the wrong
    // number. A wall-clock reading can never be shorter than the display's
    // refresh interval, so where the scene is faster than the screen the curve
    // is a staircase and a change smaller than one step is invisible in it.
    const quantisationNote = quantised
      ? `\n\nNOTE: the frame column is quantised to about ${intervalMs.toFixed(1)}ms, ` +
        `which is this display's refresh interval, not a cost. Those readings are a ` +
        `floor: the scene is drawing faster than the screen and this column cannot ` +
        `see a change smaller than one interval. ` +
        (hasGpuTiming
          ? `The GPU column is unaffected and is what the peaks below are read from.`
          : `There is no GPU timing on this device, so raise the render scale until ` +
            `the frame column stops sitting on multiples of ${intervalMs.toFixed(1)}ms.`)
      : '';

    const costLabel = hasGpuTiming ? 'GPU' : 'frame';
    const peakCost = hasGpuTiming ? peak.gpuMs : peak.ms;

    const summary =
      `${header}\n` +
      `units  phase       frame    fps    gpu\n${rows}` +
      `${quantisationNote}\n\n` +
      `peak overall: ${peak.units} units (${peak.phase}) at ${peakCost.toFixed(2)}ms ${costLabel}\n` +
      `peak in fall: ${
        fallPeak
          ? `${fallPeak.units} units at ${(hasGpuTiming ? fallPeak.gpuMs : fallPeak.ms).toFixed(2)}ms ${costLabel}`
          : 'n/a'
      }\n` +
      `=> BENCHMARK_APPROACH_PROGRESS ${peakProgress}` +
      (quantised && !hasGpuTiming
        ? `  (do not trust this - see the note above)`
        : '');

    panel.textContent = summary;
    console.log(`[curve]\n${summary}`);
    onPose(null);
  }

  function dispose() {
    panel.remove();
  }

  return {
    update,
    dispose,
    get finished() { return finished; },
    /** Which pose the next frame belongs to, so a GPU query can be tagged with
     *  it. Clamped, because the flush frames after the last pose still draw. */
    get currentPose() { return Math.min(poseIndex, poses.length - 1); },
  };
}
