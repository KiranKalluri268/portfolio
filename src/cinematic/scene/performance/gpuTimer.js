/**
 * How long the GPU actually spent on a frame.
 *
 * Everything else in this scene measures frame time as the gap between
 * requestAnimationFrame callbacks, which is the right number for "is this
 * smooth?" and the wrong one for "what does this cost?". That gap can never be
 * shorter than the display's refresh interval, so on any device drawing faster
 * than its screen it reports the screen. A 144Hz laptop produces 6.9, 13.9,
 * 20.8, 27.8 and nothing in between — a staircase, not a curve — and a change
 * that adds real work is invisible until it happens to push a pose up a step.
 *
 * `EXT_disjoint_timer_query_webgl2` answers the other question. It times the
 * commands themselves on the GPU, in nanoseconds, with no relationship to when
 * anything is presented.
 *
 * Two things about it shape this whole module:
 *
 * - **The answer arrives late.** A query issued this frame is typically readable
 *   two or three frames later, so results have to be claimed asynchronously and
 *   matched back to what produced them. Every query here carries a tag for that.
 * - **Only one `TIME_ELAPSED_EXT` query may be active at a time.** Nesting is an
 *   error, so `begin` refuses while one is open rather than corrupting the
 *   sequence.
 *
 * It is also not available everywhere — notably not on iOS Safari, and gated in
 * some Chrome configurations. `supported` says so, and callers are expected to
 * have a second method rather than to treat its absence as a failure.
 */

/** Queries in flight before new ones are dropped. Bounds memory if results stop
 *  arriving — a lost context, or a driver that never signals availability. */
const MAX_PENDING = 8;

/**
 * @param {WebGL2RenderingContext} gl
 * @returns {{
 *   supported: boolean,
 *   begin: (tag: unknown) => void,
 *   end: () => void,
 *   collect: () => Array<{ tag: unknown, ms: number }>,
 *   dispose: () => void,
 * }}
 */
export function createGpuTimer(gl) {
  const ext = gl?.getExtension?.('EXT_disjoint_timer_query_webgl2') ?? null;

  if (!ext) {
    return {
      supported: false,
      begin: () => {},
      end: () => {},
      collect: () => [],
      dispose: () => {},
    };
  }

  /** @type {Array<{ query: WebGLQuery, tag: unknown }>} */
  let pending = [];
  /** @type {{ query: WebGLQuery, tag: unknown } | null} */
  let open = null;

  function begin(tag) {
    // Nesting is an error rather than a no-op in the spec, and a caller that
    // begins twice has a bug worth surviving rather than crashing on.
    if (open || pending.length >= MAX_PENDING) return;

    const query = gl.createQuery();
    if (!query) return;

    gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    open = { query, tag };
  }

  function end() {
    if (!open) return;
    gl.endQuery(ext.TIME_ELAPSED_EXT);
    pending.push(open);
    open = null;
  }

  /**
   * Every query whose result has arrived since the last call, oldest first.
   *
   * Disjoint results are thrown away rather than reported. The flag means the
   * GPU was interrupted — a context switch, a clock change, thermal throttling
   * moving the goalposts mid-query — and the timing that comes back is not
   * wrong so much as meaningless. Reporting it as a spike would invent exactly
   * the kind of peak this scene has already chased twice.
   */
  function collect() {
    if (!pending.length) return [];

    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
    const results = [];
    const stillPending = [];

    for (const entry of pending) {
      const available = gl.getQueryParameter(entry.query, gl.QUERY_RESULT_AVAILABLE);
      if (!available) {
        stillPending.push(entry);
        continue;
      }
      if (!disjoint) {
        const nanoseconds = gl.getQueryParameter(entry.query, gl.QUERY_RESULT);
        results.push({ tag: entry.tag, ms: nanoseconds / 1e6 });
      }
      gl.deleteQuery(entry.query);
    }

    pending = stillPending;
    return results;
  }

  function dispose() {
    if (open) {
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      gl.deleteQuery(open.query);
      open = null;
    }
    for (const entry of pending) gl.deleteQuery(entry.query);
    pending = [];
  }

  return { supported: true, begin, end, collect, dispose };
}
