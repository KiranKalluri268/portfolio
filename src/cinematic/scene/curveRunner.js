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

const SETTLE_FRAMES = 10;   // discarded per pose: tier/pose changes cost frames
const SAMPLE_FRAMES = 30;   // measured per pose

export function createCurveRunner({ journey, onPose, getTier }) {
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

  function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  /** Called once per frame. Returns the pose to render, or null when done. */
  function update(frameMs) {
    if (finished) return null;

    framesAtPose++;
    if (framesAtPose > SETTLE_FRAMES) samples.push(frameMs);

    if (framesAtPose >= SETTLE_FRAMES + SAMPLE_FRAMES) {
      const units = poses[poseIndex];
      const ms = median(samples);
      results.push({ units, phase: phaseOf(units), ms, fps: 1000 / ms });

      poseIndex++;
      framesAtPose = 0;
      samples = [];

      if (poseIndex >= poses.length) {
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
    const peak = results.reduce((a, b) => (b.ms > a.ms ? b : a), results[0]);
    const fallPoses = results.filter((r) => r.phase === 'fall');
    const fallPeak = fallPoses.length
      ? fallPoses.reduce((a, b) => (b.ms > a.ms ? b : a), fallPoses[0])
      : null;

    // The number the benchmark actually needs: where in the approach the fall is
    // most expensive, as a fraction, which is what BENCHMARK_APPROACH_PROGRESS
    // is expressed in.
    const fallSpan = journey.approachEnd - journey.arrivalEnd;
    const peakProgress = fallPeak
      ? ((fallPeak.units - journey.arrivalEnd) / fallSpan).toFixed(2)
      : 'n/a';

    const rows = results
      .map((r) => `${String(r.units).padStart(5)}  ${r.phase.padEnd(8)} ${r.ms.toFixed(1).padStart(6)}ms ${r.fps.toFixed(0).padStart(4)}fps`)
      .join('\n');

    const summary =
      `tier ${tier}\n` +
      `units  phase       frame    fps\n${rows}\n\n` +
      `peak overall: ${peak.units} units (${peak.phase}) at ${peak.ms.toFixed(1)}ms\n` +
      `peak in fall: ${fallPeak ? `${fallPeak.units} units at ${fallPeak.ms.toFixed(1)}ms` : 'n/a'}\n` +
      `=> BENCHMARK_APPROACH_PROGRESS ${peakProgress}`;

    panel.textContent = summary;
    console.log(`[curve]\n${summary}`);
    onPose(null);
  }

  function dispose() {
    panel.remove();
  }

  return { update, dispose, get finished() { return finished; } };
}
