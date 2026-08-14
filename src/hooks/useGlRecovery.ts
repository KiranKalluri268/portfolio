"use client";

import { useCallback, useRef, useState } from "react";

/** Surviving the browser taking a WebGL context away.
 *
 * A context is the live connection between a canvas and the GPU, and it holds
 * everything that has been uploaded to it: textures, buffers, compiled shaders.
 * The browser may take one back at any time — a driver reset, the system
 * reclaiming graphics memory, a laptop switching between its two GPUs, a phone
 * backgrounding the tab. It also takes the *oldest* context back when a page
 * asks for more than it allows, so a scene can lose its context because a
 * different scene opened.
 *
 * When that happens every GPU resource is gone and the canvas turns
 * transparent. Nothing here used to listen for it, so the only cure was
 * reloading the page.
 *
 * Two halves, because they sit at opposite ends of a scene's effect:
 * `watchContext` at the top, before the renderer exists, and `releaseContext`
 * in the teardown. `generation` goes in the effect's dependencies — recovering
 * means building the whole scene again, which is what the effect already knows
 * how to do, rather than a second rebuild path that would drift from it.
 */
export function useGlRecovery() {
  const [generation, setGeneration] = useState(0);
  // Set while a teardown is happening in order to rebuild, so the cleanup can
  // tell that apart from the scene actually going away.
  const rebuilding = useRef(false);

  /** Watches a canvas for its context being lost and given back. Returns the
   *  detach function, and calls `onLost` so the caller can stop drawing into a
   *  context that is no longer there.
   *
   *  Attach this before creating the renderer, not after: setting a scene up
   *  means decoding images and rasterising icons, and a context lost during
   *  that is still lost. */
  const watchContext = useCallback(
    (canvas: HTMLCanvasElement, onLost: () => void) => {
      const lost = (event: Event) => {
        // Required, and easy to miss: a lost event nobody cancels is never
        // followed by a restored one. Without this line the browser has no
        // reason to believe the page intends to recover, and the canvas stays
        // blank for good.
        event.preventDefault();
        onLost();
      };
      const restored = () => {
        rebuilding.current = true;
        setGeneration((value) => value + 1);
      };
      canvas.addEventListener("webglcontextlost", lost);
      canvas.addEventListener("webglcontextrestored", restored);
      return () => {
        canvas.removeEventListener("webglcontextlost", lost);
        canvas.removeEventListener("webglcontextrestored", restored);
      };
    },
    [],
  );

  /** Hands the context back at teardown, so leaving a page and returning does
   *  not leak one each time and eventually push an unrelated scene off the end
   *  of the browser's allowance.
   *
   *  Skipped when the teardown is a rebuild: the context being torn down from
   *  is the one just restored, and throwing it away here would lose the very
   *  thing the scene is about to be drawn into. */
  const releaseContext = useCallback((gl: { getExtension(name: string): unknown }) => {
    if (rebuilding.current) {
      rebuilding.current = false;
      return;
    }
    (gl.getExtension("WEBGL_lose_context") as WEBGL_lose_context | null)?.loseContext();
  }, []);

  return { generation, watchContext, releaseContext };
}
