"use client";

import { useEffect, useRef } from "react";
import { useScrollActions } from "@/context/SmoothScrollContext";
import "./cinematic.css";

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
export default function CinematicScene({ showDevTools = false }: { showDevTools?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { lenis } = useScrollActions();

  useEffect(() => {
    const root = rootRef.current;
    // Lenis is published from an effect in the provider, so on the first render
    // it is still null. Waiting is correct rather than defensive: the journey is
    // a function of scroll and cannot start before there is a scroll position to
    // read. This effect runs again when it arrives.
    if (!root || !lenis) return;

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
      .then(({ mountCinematic }) => mountCinematic(root, lenis, showDevTools))
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
  }, [lenis, showDevTools]);

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
