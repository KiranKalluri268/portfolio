"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useActiveSection, useScrollActions, type SectionId } from "@/context/SmoothScrollContext";
import { useAudio } from "@/context/AudioContextProvider";
import { useCoarsePointer, useReducedMotion } from "@/hooks/useMediaQuery";
import { useHoverLabel } from "@/hooks/useHoverLabel";
import type { SceneIndex } from "@/types";

interface SceneInfo {
  index: SceneIndex;
  id: SectionId;
  name: string;
}

const scenes: SceneInfo[] = [
  { index: 0, id: "hero", name: "Hero" },
  { index: 1, id: "about", name: "About" },
  { index: 2, id: "projects", name: "Projects" },
  { index: 3, id: "experience", name: "Experience" },
  { index: 4, id: "skills", name: "Tech Stack" },
  { index: 5, id: "contact", name: "Contact" },
];

const TOOLTIP_GAP = 20;

/** Movement, in px, before a press on the bar counts as a drag rather than a
 *  tap. Below it nothing moves and the button's own click still fires. */
const DRAG_THRESHOLD = 5;

interface DragState {
  /** Where the pill currently sits, in px from the left of the dot row. */
  x: number;
  /** The scene it would land on if released now. */
  index: number;
}

export default function SceneIndicator() {
  const { hasEntered } = useAudio();
  const activeSection = useActiveSection();
  const { scrollToSection, toggleProjectsEndpoint } = useScrollActions();
  const [hoveredIndex, setHoveredIndex] = useHoverLabel<number>();
  const [portalReady, setPortalReady] = useState(false);
  const isCoarsePointer = useCoarsePointer();
  const reduceMotion = useReducedMotion();

  const tooltipRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /** Centre of each dot, in px from the left of the row. Measured rather than
   *  computed, because the dots are padded differently at each breakpoint. */
  const [centers, setCenters] = useState<number[]>([]);
  const [pillSize, setPillSize] = useState({ width: 0, height: 0 });
  const [drag, setDrag] = useState<DragState | null>(null);
  /** Set while a drag is in flight so the click it ends with can be swallowed —
   *  letting it through would scroll twice, to two different places. */
  const draggedRef = useRef(false);

  useEffect(() => {
    // Render after hydration so the fixed controls can safely portal to body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPortalReady(true);
  }, []);

  useLayoutEffect(() => {
    if (!portalReady || !hasEntered) return;
    const row = rowRef.current;
    if (!row) return;

    const measure = () => {
      const rowLeft = row.getBoundingClientRect().left;
      const buttons = dotRefs.current.filter(Boolean) as HTMLButtonElement[];
      if (buttons.length === 0) return;
      setCenters(
        buttons.map((button) => {
          const rect = button.getBoundingClientRect();
          return rect.left - rowLeft + rect.width / 2;
        }),
      );
      const first = buttons[0].getBoundingClientRect();
      // Sized from the dots' own hit area, so it stays proportionate at both
      // breakpoints without a second set of numbers to keep in step.
      setPillSize({
        width: Math.max(24, first.width - 6),
        height: Math.max(24, first.height - 6),
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [portalReady, hasEntered]);

  useEffect(() => {
    // Touch devices get a tooltip anchored to the dot instead, so there is no
    // pointer to track. A drag has its own label and does not want this one.
    if (hoveredIndex === null || isCoarsePointer || drag) return;
    const updateMouse = (event: PointerEvent) => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;
      const { offsetWidth, offsetHeight } = tooltip;
      const overflowsRight = event.clientX + TOOLTIP_GAP + offsetWidth > window.innerWidth;
      const overflowsBottom = event.clientY + TOOLTIP_GAP + offsetHeight > window.innerHeight;
      const x = overflowsRight
        ? Math.max(0, event.clientX - TOOLTIP_GAP - offsetWidth)
        : event.clientX + TOOLTIP_GAP;
      const y = overflowsBottom
        ? Math.max(0, event.clientY - TOOLTIP_GAP - offsetHeight)
        : event.clientY + TOOLTIP_GAP;
      tooltip.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    window.addEventListener("pointermove", updateMouse, { passive: true });
    return () => window.removeEventListener("pointermove", updateMouse);
  }, [hoveredIndex, isCoarsePointer, drag]);

  // Lenis listens for touch on the window, so its handler runs after ours, and
  // with syncTouch off it treats every touch as native scrolling and calls
  // animate.stop(). That killed the scroll a released drag had just started:
  // endDrag ran, scrollToSection ran, and the touchend behind it stopped the
  // animation on the frame it began. Marking the events this drag has claimed
  // makes Lenis skip them. See docs in CLAUDE.md.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const claim = (event: TouchEvent) => {
      if (!draggedRef.current) return;
      (event as TouchEvent & { lenisStopPropagation?: boolean }).lenisStopPropagation = true;
    };
    row.addEventListener("touchmove", claim, { passive: true });
    row.addEventListener("touchend", claim, { passive: true });
    return () => {
      row.removeEventListener("touchmove", claim);
      row.removeEventListener("touchend", claim);
    };
  }, [portalReady, hasEntered]);

  const handleDotClick = (section: SectionId) => {
    if (section === activeSection) {
      if (section === "projects") toggleProjectsEndpoint();
      return;
    }
    scrollToSection(section);
  };

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

  // The pill is dragged from anywhere on the bar, not just from the pill
  // itself: on a bar this small, asking for a precise grab would mostly produce
  // taps. A press only becomes a drag once it has travelled far enough that it
  // cannot have been meant as a tap.
  const pressRef = useRef<{ startX: number; pointerId: number } | null>(null);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (centers.length === 0 || event.button !== 0) return;
    pressRef.current = { startX: event.clientX, pointerId: event.pointerId };
    draggedRef.current = false;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const press = pressRef.current;
    const row = rowRef.current;
    if (!press || !row || press.pointerId !== event.pointerId) return;

    if (!draggedRef.current) {
      if (Math.abs(event.clientX - press.startX) < DRAG_THRESHOLD) return;
      draggedRef.current = true;
      setHoveredIndex(null);
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

    if (drag) {
      // Snap to the scene it was left over, and go there.
      const target = scenes[drag.index];
      setDrag(null);
      if (target.id !== activeSection) scrollToSection(target.id);
      else if (target.id === "projects") toggleProjectsEndpoint();
    }
  };

  if (!portalReady || !hasEntered) return null;

  const activeIndex = scenes.findIndex((scene) => scene.id === activeSection);
  const pillCenter = drag ? drag.x : (centers[Math.max(0, activeIndex)] ?? 0);
  const labelIndex = drag ? drag.index : null;

  return createPortal(
    <>
      <nav
        className="pointer-events-auto fixed bottom-[calc(3rem+env(safe-area-inset-bottom))] left-1/2 z-[1000] isolate -translate-x-1/2 rounded-full border border-white/10 bg-black/65 shadow-[0_6px_20px_rgba(0,0,0,0.4)] backdrop-blur-md sm:bottom-auto sm:top-8"
        aria-label="Scene navigation indicator"
        role="navigation"
        // A click that ended a drag would scroll a second time, to whichever
        // dot the finger happened to finish over.
        onClickCapture={(event) => {
          if (!draggedRef.current) return;
          draggedRef.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <div
          ref={rowRef}
          className="relative flex flex-row items-center justify-between"
          // pan-y so the page still scrolls from a vertical swipe over the bar;
          // horizontal movement is the pill's.
          style={{ touchAction: "pan-y" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {/* The pill: the only thing marking the active scene, which is why
              the dots below stay uniform. */}
          {centers.length > 0 && (
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute top-1/2 left-0 rounded-full border border-accent-soft/50 bg-accent/25 shadow-[0_0_18px_rgba(224,69,10,0.45)] ${
                drag || reduceMotion ? "" : "transition-transform duration-500 ease-out"
              }`}
              style={{
                width: pillSize.width,
                height: pillSize.height,
                transform: `translate3d(${pillCenter - pillSize.width / 2}px, -50%, 0)`,
              }}
            />
          )}

          {scenes.map((scene) => {
            const isActive = activeSection === scene.id;
            const isHovered = hoveredIndex === scene.index;

            return (
              <div key={scene.index} className="relative flex flex-col items-center">
                <button
                  ref={(element) => {
                    dotRefs.current[scene.index] = element;
                  }}
                  className="relative z-10 flex min-h-9 min-w-9 cursor-pointer items-center justify-center border-none bg-transparent p-3 outline-none sm:min-h-12 sm:min-w-12 sm:p-6"
                  aria-label={`Go to ${scene.name} section${isActive ? " (current)" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => handleDotClick(scene.id)}
                  onMouseEnter={() => setHoveredIndex(scene.index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  type="button"
                >
                  {/* Uniform: the pill says which scene is current, so a dot
                      that also grew and glowed would be saying it twice. */}
                  <div
                    className="relative h-1 w-1 rounded-full bg-white transition-[box-shadow] duration-300 ease-out"
                    style={{
                      boxShadow: isHovered
                        ? "0 0 10px 2px rgba(255, 255, 255, 0.8)"
                        : "0 0 6px rgba(255, 255, 255, 0.35)",
                    }}
                  />
                </button>

                {/* Touch devices have no cursor to follow, so the label anchors
                    above its own dot. Suppressed mid-drag, which has its own. */}
                {isCoarsePointer && isHovered && !drag && (
                  <span
                    className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-black/70 px-2 py-1 text-xs font-semibold tracking-wide text-white backdrop-blur-md"
                    aria-hidden="true"
                  >
                    {scene.name}
                  </span>
                )}
              </div>
            );
          })}

          {/* Where the pill would land. Above the bar on a phone, below it on
              desktop, since the bar sits at the opposite edge in each case. */}
          {labelIndex !== null && (
            <span
              className="pointer-events-none absolute bottom-full z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-black/80 px-2.5 py-1 text-xs font-semibold tracking-wide text-white backdrop-blur-md sm:bottom-auto sm:top-full sm:mt-2 sm:mb-0"
              style={{ left: pillCenter }}
              aria-hidden="true"
            >
              {scenes[labelIndex].name}
            </span>
          )}
        </div>
      </nav>

      {/* Floating Cursor Tooltip */}
      {!isCoarsePointer && hoveredIndex !== null && !drag && (
        <div
          ref={tooltipRef}
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            pointerEvents: "none",
            zIndex: 9999, // Ensure it's on top of everything
          }}
          className="whitespace-nowrap text-white text-sm font-semibold tracking-wide bg-black/40 px-3 py-1 rounded-md backdrop-blur-md border border-white/10"
        >
          {scenes[hoveredIndex].name}
        </div>
      )}
    </>,
    document.body,
  );
}
