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
import { readOneOf, writeParam } from "@/lib/deep-link";
import {
  PILL_CLASS,
  PILL_TRAVEL_MS,
  pillMetrics,
  pillTransition,
} from "../nav/sliding-pill";

const VIEWS = ["grid", "list"] as const;

/** Movement, in px, before a press on the bar counts as a drag rather than a
 *  tap. Below it nothing moves and the button's own click still fires. */
const DRAG_THRESHOLD = 5;

/** How long after a drag a click is treated as that drag's own leftover. */
const CLICK_AFTER_DRAG_MS = 400;

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

  /** Where the pill sits while a finger is carrying it, and which view it would
   *  land on if released now. The dots are dragged the same way: on a bar this
   *  small, asking for a precise grab on the pill itself would mostly produce
   *  taps, so the whole row is the handle. */
  const [drag, setDrag] = useState<{ x: number; index: number } | null>(null);
  const pressRef = useRef<{ startX: number; pointerId: number } | null>(null);
  const draggedRef = useRef(false);
  /** When a drag finished, so the click it ends with can be refused — letting
   *  it through would choose whichever label the finger happened to stop over,
   *  as well as the one it was released on. */
  const dragEndedAt = useRef(0);

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
    // A shared link outranks the remembered preference. The other way round,
    // sending someone the grid would open the list for anyone who had ever
    // chosen it — which is the thing the link was sent to prevent.
    const shared = readOneOf("view", VIEWS);
    // Otherwise remembered per browser, so someone who prefers the list is not
    // put back in the grid on every visit.
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const remembered = stored === "list" || stored === "grid" ? stored : null;
    const initial = shared ?? remembered;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initial) setView(initial);
  }, []);

  const nearestIndex = (x: number) => {
    let best = 0;
    let bestDistance = Infinity;
    centers.forEach((center, index) => {
      const distance = Math.abs(center - x);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    return best;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (centers.length === 0 || event.button !== 0) return;
    pressRef.current = { startX: event.clientX, pointerId: event.pointerId };
    draggedRef.current = false;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const press = pressRef.current;
    const row = rowRef.current;
    if (!press || !row || press.pointerId !== event.pointerId) return;

    if (!draggedRef.current) {
      if (Math.abs(event.clientX - press.startX) < DRAG_THRESHOLD) return;
      draggedRef.current = true;
      // Keep receiving moves even when the finger leaves the little bar.
      row.setPointerCapture(event.pointerId);
    }

    const x = event.clientX - row.getBoundingClientRect().left;
    const clamped = Math.min(Math.max(x, centers[0]), centers[centers.length - 1]);
    setDrag({ x: clamped, index: nearestIndex(clamped) });
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const press = pressRef.current;
    if (!press || press.pointerId !== event.pointerId) return;
    pressRef.current = null;
    rowRef.current?.releasePointerCapture?.(event.pointerId);
    if (!drag) return;
    dragEndedAt.current = event.timeStamp;
    // Snap to whichever view it was left over.
    choose(VIEWS[drag.index]);
    setDrag(null);
  };

  const choose = (next: View) => {
    setView(next);
    // Named in the address bar as soon as it is chosen, so the URL is already
    // the right one whenever the visitor thinks to copy it.
    writeParam("view", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing can refuse storage; the choice just will not persist.
    }
  };

  const pillCenter = drag ? drag.x : (centers[VIEWS.indexOf(view)] ?? 0);
  const moving = drag !== null || travelling;

  return (
    <>
      {/* Below the site header, which owns the top-right corner on every route
          — at top-4 the toggle sat under the audio bars and the menu button. */}
      <div className="pointer-events-none fixed top-16 right-4 z-[900] flex sm:top-24 sm:right-6">
        <div className="relative">
          {/* A moat around the bar, catching presses that miss it narrowly.
              The field behind this is a drag surface that opens whatever is
              under the middle when tapped, and it reaches right up to the bar's
              edge — so a thumb aiming for the toggle and landing just outside
              it used to open a project instead. Wide enough for a near-miss,
              small enough that the field is still draggable around it. */}
          <span aria-hidden="true" className="pointer-events-auto absolute -inset-2 rounded-full" />
        <div
          ref={barRef}
          role="group"
          aria-label="Projects view"
          // The same white glow the cards carry, so the toggle reads as part of
          // the grid rather than something floating over it.
          className="pointer-events-auto isolate flex items-center rounded-full border border-white/20 bg-black/70 shadow-[0_0_0_1px_rgba(255,255,255,0.22),0_0_2.5rem_rgba(255,255,255,0.3)] backdrop-blur-md"
          style={{ paddingLeft: pill.trackPadding, paddingRight: pill.trackPadding }}
          // A click that ended a drag would choose a second time, on whichever
          // label the finger happened to finish over.
          onClickCapture={(event) => {
            // Both timestamps come from events, so they share a clock.
            if (event.timeStamp - dragEndedAt.current > CLICK_AFTER_DRAG_MS) return;
            dragEndedAt.current = 0;
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <div
            ref={rowRef}
            className="relative flex items-center"
            // pan-y so a vertical swipe over the bar still reaches the page;
            // horizontal movement is the pill's.
            style={{ touchAction: "pan-y" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {/* The highlight, and the only thing marking the current view —
                which is why the labels below stay uniform. */}
            {centers.length > 0 && (
              <span
                aria-hidden="true"
                className={PILL_CLASS}
                style={{
                  width: moving ? pill.moveWidth : pill.idleWidth,
                  height: moving ? pill.moveHeight : pill.idleHeight,
                  transform: `translate3d(${
                    pillCenter - (moving ? pill.moveWidth : pill.idleWidth) / 2
                  }px, -50%, 0)`,
                  // A drag follows the finger, so its position must not be eased.
                  transition: pillTransition(reduceMotion, !drag),
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
      </div>

      {/* hidden rather than unmounted: the list carries the page's text. */}
      <ActiveViewContext.Provider value={view}>
        <div hidden={view !== "grid"}>{grid}</div>
        <div hidden={view !== "list"}>{list}</div>
      </ActiveViewContext.Provider>
    </>
  );
}
