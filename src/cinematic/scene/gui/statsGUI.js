/**
 * The FPS meter, as text.
 *
 * This used to be stats.js, and stats.js measured the scene by breaking it.
 *
 * Its panel is an 80x48 `<canvas>` redrawn once a second (Stats.js:77), sitting
 * over the WebGL canvas. On an AMD iGPU through ANGLE/D3D11 that redraw costs
 * 76-723ms of presentation time - not script time: `long-animation-frame`
 * reported `blockingDuration: 0` and no scripts at all on every one of them, so
 * nothing was running long. The compositor simply stopped producing frames for
 * about twenty refreshes, once per second, on the dot.
 *
 * Measured on the laptop at the entry gate, same tab, seconds apart:
 *
 *   with the meter     955 frames  median 7.0ms  p90 7.1ms  max 201.8ms
 *                      10 spikes, gaps 1002 995 1009 1002 1009ms
 *   without it         632 frames  median 13.9ms p90 20.9ms max  21.6ms
 *                      no spikes, no downgrades, held `high` throughout
 *
 * The scene was fine the whole time. Two of those stalls tripped the panic rule
 * twice, which cost two rungs and pinned the tier ceiling at `low` before the
 * visitor had even entered - so the instrument produced the exact symptom it
 * was mounted to investigate, and several days went into chasing it.
 *
 * Reproduced from scratch afterwards to be sure it was not stats.js specifically:
 * an empty 80x48 canvas appended to the page and filled once a second brought
 * the spikes straight back on an otherwise clean tab. Layer promotion did not
 * help (`will-change: transform` and `contain: strict` both still spiked), and
 * neither did moving it out to `<body>`. Text does not spike at all.
 *
 * So: no canvas. Same numbers, same once-a-second cadence, plain DOM.
 */

const UPDATE_INTERVAL_MS = 1000;

export function createStatsGUI() {
  const dom = document.createElement('div');
  dom.id = 'stats-panel';

  const fpsLine = document.createElement('div');
  fpsLine.className = 'stats-fps';
  const msLine = document.createElement('div');
  msLine.className = 'stats-ms';
  dom.append(fpsLine, msLine);

  let frames = 0;
  let previousTime = performance.now();
  let worstFrameMs = 0;
  let lastFrameTime = previousTime;

  function update() {
    const now = performance.now();
    const frameMs = now - lastFrameTime;
    lastFrameTime = now;
    frames++;
    // The worst frame in the last second, which is the number that actually
    // explains a downgrade. An average hides exactly the frames that cause one.
    if (frameMs > worstFrameMs) worstFrameMs = frameMs;

    const elapsed = now - previousTime;
    if (elapsed < UPDATE_INTERVAL_MS) return;

    fpsLine.textContent = Math.round((frames * 1000) / elapsed) + ' fps';
    msLine.textContent = (elapsed / frames).toFixed(1) + ' / '
      + worstFrameMs.toFixed(0) + ' ms';

    frames = 0;
    worstFrameMs = 0;
    previousTime = now;
  }

  return { dom, update };
}
