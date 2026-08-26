"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { useScrollActions } from "@/context/SmoothScrollContext";
import "./cinematic.css";

/**
 * Whether this browser can render the journey at all.
 *
 * Checked before the dynamic import rather than after, because the alternative
 * is downloading three.js and ~10MB of texture to a device that was never going
 * to draw a frame with them.
 *
 * Note this asks about WebGL2 specifically, and only on behalf of the journey.
 * `still` is not "no WebGL" - the projects grid renders its cards through ogl
 * and keeps working there. A browser with no WebGL at all is the grid's problem
 * and has its own answer in `useGlRecovery`.
 */
function canRenderJourney() {
  try {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    // Some privacy modes throw rather than returning null.
    return false;
  }
}

/**
 * Mounts the ported black hole journey and owns its lifecycle.
 *
 * The scene itself is imperative and knows nothing about React: it is given an
 * element and a Lenis instance, and hands back a teardown function. Everything
 * this component does is the bookkeeping around that.
 *
 * The overlays are rendered here rather than created by the scene, so the
 * markup is real DOM in the tree rather than strings built at runtime, and so
 * the copy is readable in the source. The scene finds each one by its
 * data-cinematic attribute inside the root, never by document id - the site is
 * full of other elements and nothing here should be reachable from outside.
 */
export default function CinematicScene({
  showDevTools = false,
  measureCurve = false,
}: {
  showDevTools?: boolean;
  measureCurve?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { lenis } = useScrollActions();
  const router = useRouter();

  /**
   * Leave for the presentation the site already ships.
   *
   * `still` is not a mode this route renders - it is the rest of the site, and
   * this route has no content of its own to show without the journey. So the
   * bottom rung of the ladder is a navigation, not a render path. `replace` so
   * a device that cannot run this does not collect a history entry that sends
   * it straight back here on Back.
   */
  const fallBackToStill = useCallback((reason: string) => {
    console.info(`Cinematic: falling back to the still presentation (${reason}).`);
    // Owned by the scene, but the scene may never have started or may have
    // failed partway. Left behind, they lock scroll on a 28-viewport page.
    document.documentElement.classList.remove("cinematic-journey");
    document.documentElement.classList.remove("cinematic-loading");
    // The other half of the same lock. The scene calls `lenis.stop()` on the
    // site's own borrowed instance and `disposeApp` starts it again — but a
    // throw between those two never reaches the teardown, and smooth scrolling
    // would stay stopped for the rest of the visit, on every route. Starting an
    // instance that was never stopped is a no-op, so this is safe on the paths
    // that never got that far.
    lenis?.start();
    router.replace("/");
  }, [router, lenis]);

  useEffect(() => {
    const root = rootRef.current;
    // Lenis is published from an effect in the provider, so on the first render
    // it is still null. Waiting is correct rather than defensive: the journey is
    // a function of scroll and cannot start before there is a scroll position to
    // read. This effect runs again when it arrives.
    if (!root || !lenis) return;

    // Two answers that need no benchmark, both settled before three.js is even
    // fetched. Read from matchMedia directly rather than through useReducedMotion,
    // which reports false until after hydration - mounting the journey and then
    // tearing it down again is exactly what this is here to avoid.
    //
    // A scroll-driven camera flight is precisely what prefers-reduced-motion
    // asks you not to do, and lowering the frame rate is not a reduction in
    // motion. It has had no answer on this route until now.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      fallBackToStill("prefers-reduced-motion");
      return;
    }

    if (!canRenderJourney()) {
      fallBackToStill("no WebGL2");
      return;
    }

    // The document has to be twenty-eight screens tall for the journey to have
    // somewhere to happen, and emphatically must not stay that way once this
    // route is left.
    document.documentElement.classList.add("cinematic-journey");

    let disposed = false;
    let teardown: (() => void) | null = null;

    // Loaded on demand. three.js and the scene together are far larger than
    // anything else this site ships, and no visitor who does not come here
    // should pay for a byte of it.
    import("./scene/main")
      .then(({ mountCinematic }) =>
        mountCinematic(root, lenis, {
          showDevTools,
          measureCurve,
          // The bottom rung, reached only before the entry gate. The scene has
          // already told the visitor what is happening by the time this fires.
          onStill: ({ reason }: { reason: string }) => {
            if (disposed) return;
            teardown?.();
            teardown = null;
            fallBackToStill(reason);
          },
        }),
      )
      .then((dispose) => {
        // Unmounted while the import or the shader compile was still in flight.
        // StrictMode makes this the normal case in development rather than a
        // rare race, so the scene is torn down immediately instead of being left
        // running with nothing referencing it.
        if (disposed) {
          dispose();
          return;
        }
        teardown = dispose;
      })
      .catch((error) => {
        console.error("The cinematic scene failed to start.", error);
        if (disposed) return;
        // This used to only log, and that was a real hole. A throw after the
        // scene had added `cinematic-loading` - a refused context, a shader that
        // would not compile, a texture that 404s - left the class on <html>,
        // scroll locked, and the visitor staring at a loading overlay frozen at
        // whatever percentage it had reached, on a page 28 screens tall with
        // nothing on it. A failure to render the journey is the same answer as a
        // device too slow to: there is a whole site that works.
        fallBackToStill("the scene failed to start");
      });

    return () => {
      disposed = true;
      teardown?.();
      document.documentElement.classList.remove("cinematic-journey");
      // Owned by the scene, which removes it on the way out - but only if it got
      // far enough to add it. Cleared here too, or a failure during startup
      // leaves the whole site unable to scroll.
      document.documentElement.classList.remove("cinematic-loading");
    };
  }, [lenis, showDevTools, measureCurve, fallBackToStill]);

  return (
    <div ref={rootRef} data-cinematic-root>
      <div data-cinematic="loading-overlay">
        <h1 className="loading-headline">YOU ARE NOT READY FOR THIS</h1>
        <div className="loading-visual" aria-hidden="true">
          <div className="loading-ring outer" />
          <div className="loading-ring inner" />
        </div>
        <div className="loading-copy" role="status" aria-live="polite">
          <div data-cinematic="loading-percentage">0%</div>
          <div data-cinematic="loading-status">Initializing renderer...</div>
        </div>
      </div>

      {/* The swap between the raymarched scene and the tunnel: black going in,
          white coming out. Driven from the scene. */}
      <div data-cinematic="transition-veil" aria-hidden="true" />
      <div data-cinematic="cockpit-vignette" aria-hidden="true" />

      <div data-cinematic="story-overlay" aria-live="polite">
        <section
          className="story-scene horizon-message"
          data-story-scene="horizonMessage"
          aria-hidden="true"
        >
          <h2>
            YOU ARE <span className="story-accent">STILL</span>{" "}
            <span className="story-accent">NOT READY</span> FOR THIS
          </h2>
        </section>
      </div>

      {/* The shader and the disk texture derive from Starless, which is GPL, and
          the licence asks that this be reachable from the work itself. Fades in
          at the end of the fall. */}
      <footer data-cinematic="source-license-links" aria-label="Source and licence links">
        <a href="https://github.com/KiranKalluri268/portfolio-3D" target="_blank" rel="noreferrer">
          Source
        </a>
        <span aria-hidden="true">/</span>
        <a
          href="https://github.com/KiranKalluri268/portfolio-3D/blob/main/LICENSE"
          target="_blank"
          rel="noreferrer"
        >
          Licence
        </a>
      </footer>
    </div>
  );
}
