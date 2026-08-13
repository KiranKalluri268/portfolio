"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useReducedMotion } from "@/hooks/useMediaQuery";
import {
  PILL_CLASS,
  PILL_TRAVEL_MS,
  pillMetrics,
  pillTransition,
} from "../nav/sliding-pill";

const VIEWS = ["grid", "list"] as const;

const STORAGE_KEY = "projects-view";
type View = "grid" | "list";

/** Which view is showing, published to whatever is inside them.
 *
 * Neither view is unmounted, so anything with a running cost has to be told
 * when to stand down: the stack holds the page still and drives a WebGL loop,
 * and both must stop while the grid is the one on screen. Inferring that from
 * a measurement means every such thing re-deriving the state this component
 * already knows. */
const ActiveViewContext = createContext<View>("grid");

export function useActiveProjectsView() {
  return useContext(ActiveViewContext);
}

/** Holds the two ways of looking at the projects and the switch between them.
 *
 * Both are rendered by the server and only hidden with CSS, never unmounted.
 * The list is where the written descriptions and links live, so it has to stay
 * in the HTML whichever view is showing — a search engine, or anyone who cannot
 * drag a spatial grid, still gets the whole page. The list now draws itself on
 * the GPU, so that text is the visually-hidden layer inside ProjectsStack
 * rather than the cards themselves; the requirement is the same, only what
 * satisfies it moved.
 */
export default function ProjectsView({ grid, list }: { grid: ReactNode; list: ReactNode }) {
  const [view, setView] = useState<View>("grid");
  const reduceMotion = useReducedMotion();

  const barRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /** Centre of each choice, in px from the left of the row, measured rather
   *  than computed — the labels are padded differently at each breakpoint. */
  const [centers, setCenters] = useState<number[]>([]);
  const [pill, setPill] = useState({
    idleWidth: 0,
    idleHeight: 0,
    moveWidth: 0,
    moveHeight: 0,
    trackPadding: 0,
  });
  /** True while the pill is travelling, which is what makes it grow. */
  const [travelling, setTravelling] = useState(false);
  const settled = useRef<View>("grid");

  useLayoutEffect(() => {
    const row = rowRef.current;
    const bar = barRef.current;
    if (!row || !bar) return;

    const measure = () => {
      const rowLeft = row.getBoundingClientRect().left;
      const buttons = buttonRefs.current.filter(Boolean) as HTMLButtonElement[];
      if (buttons.length === 0) return;
      const rects = buttons.map((button) => button.getBoundingClientRect());
      setCenters(rects.map((rect) => rect.left - rowLeft + rect.width / 2));
      const border = parseFloat(getComputedStyle(bar).borderLeftWidth) || 0;
      // One width for both choices, so the pill is a constant shape that only
      // travels — the dots' pill does the same, and a pill that resized as it
      // moved would read as two different highlights.
      const widest = Math.max(...rects.map((rect) => rect.width));
      setPill(
        pillMetrics(
          bar.getBoundingClientRect().height,
          border,
          rects[0].left - rowLeft + rects[0].width / 2,
          widest,
        ),
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Growing is tied to the pill moving rather than to what moved it, exactly
  // as the scene dots do it.
  useEffect(() => {
    if (settled.current === view) return;
    settled.current = view;
    setTravelling(true);
    const timer = window.setTimeout(() => setTravelling(false), PILL_TRAVEL_MS);
    return () => window.clearTimeout(timer);
  }, [view]);

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
          ref={barRef}
          role="group"
          aria-label="Projects view"
          // The same white glow the cards carry, so the toggle reads as part of
          // the grid rather than something floating over it.
          className="pointer-events-auto isolate flex items-center rounded-full border border-white/20 bg-black/70 shadow-[0_0_0_1px_rgba(255,255,255,0.22),0_0_2.5rem_rgba(255,255,255,0.3)] backdrop-blur-md"
          style={{ paddingLeft: pill.trackPadding, paddingRight: pill.trackPadding }}
        >
          <div ref={rowRef} className="relative flex items-center">
            {/* The highlight, and the only thing marking the current view —
                which is why the labels below stay uniform. */}
            {centers.length > 0 && (
              <span
                aria-hidden="true"
                className={PILL_CLASS}
                style={{
                  width: travelling ? pill.moveWidth : pill.idleWidth,
                  height: travelling ? pill.moveHeight : pill.idleHeight,
                  transform: `translate3d(${
                    (centers[VIEWS.indexOf(view)] ?? 0) -
                    (travelling ? pill.moveWidth : pill.idleWidth) / 2
                  }px, -50%, 0)`,
                  transition: pillTransition(reduceMotion),
                }}
              />
            )}

            {VIEWS.map((option, index) => (
              <button
                key={option}
                ref={(element) => {
                  buttonRefs.current[index] = element;
                }}
                type="button"
                onClick={() => choose(option)}
                aria-pressed={view === option}
                className={`relative z-10 rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors sm:text-sm ${
                  view === option ? "text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* hidden rather than unmounted: the list carries the page's text. */}
      <ActiveViewContext.Provider value={view}>
        <div hidden={view !== "grid"}>{grid}</div>
        <div hidden={view !== "list"}>{list}</div>
      </ActiveViewContext.Provider>
    </>
  );
}
