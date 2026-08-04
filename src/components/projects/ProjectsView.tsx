"use client";

import { useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "projects-view";
type View = "grid" | "list";

/** Holds the two ways of looking at the projects and the switch between them.
 *
 * Both are rendered by the server and only hidden with CSS, never unmounted.
 * The list is where the written descriptions and links live, so it has to stay
 * in the HTML whichever view is showing — a search engine, or anyone who cannot
 * drag a spatial grid, still gets the whole page.
 */
export default function ProjectsView({ grid, list }: { grid: ReactNode; list: ReactNode }) {
  const [view, setView] = useState<View>("grid");

  useEffect(() => {
    // Remembered per browser, so someone who prefers the list is not put back
    // in the grid on every visit.
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "list" || stored === "grid") setView(stored);
  }, []);

  const choose = (next: View) => {
    setView(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing can refuse storage; the choice just will not persist.
    }
  };

  return (
    <>
      {/* Below the site header, which owns the top-right corner on every route
          — at top-4 the toggle sat under the audio bars and the menu button. */}
      <div className="pointer-events-none fixed top-16 right-4 z-[900] flex sm:top-24 sm:right-6">
        <div
          role="group"
          aria-label="Projects view"
          // The same white glow the cards carry, so the toggle reads as part of
          // the grid rather than something floating over it.
          className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/20 bg-black/70 p-1 shadow-[0_0_0_1px_rgba(255,255,255,0.22),0_0_2.5rem_rgba(255,255,255,0.3)] backdrop-blur-md"
        >
          {(["grid", "list"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => choose(option)}
              aria-pressed={view === option}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors sm:text-sm ${
                view === option
                  ? "bg-accent/30 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* hidden rather than unmounted: the list carries the page's text. */}
      <div hidden={view !== "grid"}>{grid}</div>
      <div hidden={view !== "list"}>{list}</div>
    </>
  );
}
