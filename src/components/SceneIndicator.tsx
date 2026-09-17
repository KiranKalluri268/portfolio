"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useActiveSection, useScrollActions, type SectionId } from "@/context/SmoothScrollContext";
import { useAudio } from "@/context/AudioContextProvider";
import { useCoarsePointer, useReducedMotion } from "@/hooks/useMediaQuery";
import { useHoverLabel } from "@/hooks/useHoverLabel";
import {
  PILL_GAP,
  PILL_SIZE_MS,
  PILL_TRAVEL_MS,
  PILL_CLASS,
  pillMetrics,
  pillTransition,
} from "./nav/sliding-pill";
import type { SceneIndex } from "@/types";

interface SceneInfo {
  index: SceneIndex;
  id: SectionId;
  name: string;
}

const scenes: SceneInfo[] = [
  { index: 0, id: "hero", name: "Hero" },
  { index: 1, id: "about", name: "About" },
  { index: 2, id: "experience", name: "Experience" },
  { index: 3, id: "projects", name: "Projects" },
  { index: 4, id: "skills", name: "Tech Stack" },
  { index: 5, id: "contact", name: "Contact" },
];

const TOOLTIP_GAP = 20;

/** The least space kept between the pill's edge and the dot next to it, on
 *  either side, whichever scene's name is currently showing. Fixed rather
 *  than recomputed per active dot, so it holds however the visitor navigates
 *  and never depends on which name happens to be up. */
const LABEL_CLEARANCE = 10;

/** Movement, in px, before a press on the bar counts as a drag rather than a
 *  tap. Below it nothing moves and the button's own click still fires. */
const DRAG_THRESHOLD = 5;

/** How long after a drag a click is treated as that drag's own leftover. */
const CLICK_AFTER_DRAG_MS = 400;

/** How long the pill waits on a dot the visitor picked before going back to
 *  following the page. Long enough for the scroll to arrive; short enough that
 *  a pick the page never reaches — because the visitor scrolled off somewhere
 *  else meanwhile — does not strand it there for the rest of the visit. */
const SELECTION_HOLD_MS = 2500;

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
  const navRef = useRef<HTMLElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  /** One hidden span per scene, rendered off to the side purely to be
   *  measured — see `labelWidths` below. */
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);

  /** Centre of each dot, in px from the left of the row. Measured rather than
   *  computed, because the dots are padded differently at each breakpoint. */
  const [centers, setCenters] = useState<number[]>([]);
  /** How wide the pill needs to be to show each scene's name, measured from
   *  real rendered text rather than estimated — the names are different
   *  lengths and the font is loaded asynchronously. Indexed by scene, not by
   *  the dot's position, so the label the pill grows into always matches
   *  whichever dot it has settled on. */
  const [labelWidths, setLabelWidths] = useState<number[]>([]);
  const [pill, setPill] = useState({
    idleWidth: 0,
    idleHeight: 0,
    moveWidth: 0,
    moveHeight: 0,
  });
  /** The bar's own border, needed to size its padding against the pill - see
   *  the padding calculation near the render below. */
  const [barBorder, setBarBorder] = useState(0);
  /** Extra space added between every pair of dots, beyond their own natural
   *  spacing, so the widest label never reaches whichever dot is next to it -
   *  see LABEL_CLEARANCE. Zero when the dots are already far enough apart on
   *  their own (a wide bar with few scenes). */
  const [dotGap, setDotGap] = useState(0);
  /** Which dot the pill sits on. It follows the page: scroll to a section and
   *  the pill comes with you. Two things take it off that — a drag, where it
   *  follows the finger instead, and a pick, where it waits on the dot chosen
   *  rather than chasing every section the page passes on the way there. */
  const [pillIndex, setPillIndex] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);
  /** Set while a drag is in flight so the click it ends with can be swallowed —
   *  letting it through would scroll twice, to two different places. */
  const draggedRef = useRef(false);
  /** When that drag finished. The flag above cannot be the whole story: it is
   *  cleared on the next pointerdown, and a click can arrive without one — a
   *  keyboard Enter on a focused dot, or a tap that fires no synthesised click.
   *  Either would be swallowed for the rest of the visit. Only clicks landing
   *  in the moment right after a drag are refused. */
  const dragEndedAt = useRef(0);
  /** True while the pill is travelling to a dot after a tap. Growing is tied to
   *  the pill moving, not to the gesture that moved it, so selecting a dot
   *  animates exactly as dragging to it does. */
  const [travelling, setTravelling] = useState(false);
  const settledIndex = useRef(0);
  /** A release is already showing the larger size, and the snap that follows is
   *  a few pixels; it should shrink then, not restart the travel animation. */
  const releasedRef = useRef(false);

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
      const centersNow = buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return rect.left - rowLeft + rect.width / 2;
      });
      setCenters(centersNow);

      const labels = labelRefs.current.filter(Boolean) as HTMLSpanElement[];
      const labelWidthsNow = labels.map((label) => label.getBoundingClientRect().width);
      if (labelWidthsNow.length > 0) setLabelWidths(labelWidthsNow);

      // A button's own width does not depend on any gap added between
      // buttons, so this stays a stable baseline to measure the (separately
      // stateful) gap against, however many times this re-runs.
      const buttonWidth = buttons[0].getBoundingClientRect().width;
      if (labelWidthsNow.length > 0) {
        const widestLabel = Math.max(...labelWidthsNow);
        // Two adjacent dots are `buttonWidth` apart with no added gap at all,
        // since they sit edge to edge. The pill needs half the widest label
        // plus the clearance on each side of whichever dot it is centred on.
        const required = widestLabel / 2 + LABEL_CLEARANCE;
        setDotGap(Math.max(0, required - buttonWidth));
      }

      // Measured against the bar's outer edge, which is what the eye compares
      // the pill to — the row inside it excludes the border.
      const nav = navRef.current;
      if (!nav) return;
      const navHeight = nav.getBoundingClientRect().height;
      const border = parseFloat(getComputedStyle(nav).borderLeftWidth) || 0;
      const firstCenter = centersNow[0] ?? 0;

      setBarBorder(border);
      setPill(pillMetrics(navHeight, border, firstCenter));
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

  /** A dot the visitor picked, held until the page gets there. */
  const awaiting = useRef<number | null>(null);
  const awaitingTimer = useRef(0);
  const activeIndex = Math.max(0, scenes.findIndex((scene) => scene.id === activeSection));

  /** Parks the pill on a picked dot and keeps it there while the page travels.
   *  The timer is the safety net: if the visitor scrolls somewhere else before
   *  the pick lands, the pill would otherwise be stranded on it. */
  const holdPillAt = (index: number) => {
    awaiting.current = index;
    window.clearTimeout(awaitingTimer.current);
    awaitingTimer.current = window.setTimeout(() => {
      awaiting.current = null;
    }, SELECTION_HOLD_MS);
    setPillIndex(index);
  };

  useEffect(() => () => window.clearTimeout(awaitingTimer.current), []);

  // The pill follows the page. Held back only while a pick is still on its way:
  // scrolling from the hero to contact passes through four sections, and the
  // pill jumping through each of them is not what the visitor asked for.
  useEffect(() => {
    if (drag) return;
    if (awaiting.current !== null && awaiting.current !== activeIndex) return;
    awaiting.current = null;
    setPillIndex(activeIndex);
  }, [activeIndex, drag]);

  const handleDotClick = (index: number, section: SectionId) => {
    // Selecting a dot outright puts the handle on it, and keeps it there until
    // the page arrives.
    holdPillAt(index);
    if (section === activeSection) {
      if (section === "projects") toggleProjectsEndpoint();
      return;
    }
    scrollToSection(section);
  };

  useEffect(() => {
    if (settledIndex.current === pillIndex) return;
    settledIndex.current = pillIndex;
    if (releasedRef.current) {
      releasedRef.current = false;
      return;
    }
    setTravelling(true);
    const timer = window.setTimeout(() => setTravelling(false), PILL_TRAVEL_MS);
    return () => window.clearTimeout(timer);
  }, [pillIndex]);

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
      dragEndedAt.current = event.timeStamp;
      // Snap to the scene it was left over and wait there while the page comes
      // to meet it; once it arrives the pill goes back to following along.
      const target = scenes[drag.index];
      releasedRef.current = true;
      holdPillAt(drag.index);
      setDrag(null);
      if (target.id !== activeSection) scrollToSection(target.id);
      else if (target.id === "projects") toggleProjectsEndpoint();
    }
  };

  if (!portalReady || !hasEntered) return null;

  const pillCenter = drag ? drag.x : (centers[pillIndex] ?? 0);
  const moving = drag !== null || travelling;
  const labelIndex = drag ? drag.index : null;
  const pillWidth = moving ? pill.moveWidth : (labelWidths[pillIndex] ?? pill.idleWidth);
  // The bar's own width, rather than a constant sized for the longest name:
  // it grows and shrinks with whichever pill is currently showing, the same
  // way the pill itself does. Solving the pill's own containment for the
  // current width — the amount of edge padding that keeps it PILL_GAP inside
  // the bar if it were parked on the first dot — happens to also be the
  // right amount for every other position, since none of them need more.
  const trackPadding = Math.max(
    0,
    PILL_GAP + pillWidth / 2 - (centers[0] ?? 0) - barBorder,
  );

  return createPortal(
    <>
      <nav
        ref={navRef}
        className="pointer-events-auto fixed bottom-[calc(3rem+env(safe-area-inset-bottom))] left-1/2 z-[1000] isolate -translate-x-1/2 rounded-full border border-white/10 bg-black/65 shadow-[0_6px_20px_rgba(0,0,0,0.4)] backdrop-blur-md sm:bottom-auto sm:top-8"
        style={{
          paddingLeft: trackPadding,
          paddingRight: trackPadding,
          // Matches the pill's own size transition, so the bar's curved ends
          // arrive around it rather than snapping to a new size while the
          // pill inside is still growing or shrinking to meet them.
          transition: reduceMotion ? "none" : `padding ${PILL_SIZE_MS}ms ease-out`,
        }}
        aria-label="Scene navigation indicator"
        role="navigation"
        // A click that ended a drag would scroll a second time, to whichever
        // dot the finger happened to finish over.
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
          className="relative flex flex-row items-center justify-between"
          // pan-y so the page still scrolls from a vertical swipe over the bar;
          // horizontal movement is the pill's. columnGap keeps the widest
          // label clear of the dots either side of it - see LABEL_CLEARANCE.
          style={{ touchAction: "pan-y", columnGap: dotGap }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {/* The pill: the only thing marking the active scene, which is why
              the dots below stay uniform. Idle, it widens into the current
              scene's name instead of sitting on the dot as a plain blob -
              travelling or dragged, it shrinks back to a small capsule with
              no label, since it is not settled on anything yet to name. */}
          {centers.length > 0 && (
            <span
              aria-hidden="true"
              className={PILL_CLASS}
              style={{
                width: pillWidth,
                height: moving ? pill.moveHeight : pill.idleHeight,
                transform: `translate3d(${pillCenter - pillWidth / 2}px, -50%, 0)`,
                // A drag follows the finger, so its position must not be eased.
                transition: pillTransition(reduceMotion, !drag),
              }}
            >
              {/* Its own layer, clipped to the pill's growing box, so the name
                  cannot poke out past the edge while the width is still
                  animating up to it - clipping the pill itself instead would
                  cut off its own glow, which is meant to bleed past the edge. */}
              {!moving && (
                <span className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full">
                  <span className="whitespace-nowrap text-xs font-semibold tracking-wide text-white sm:text-sm">
                    {scenes[pillIndex].name}
                  </span>
                </span>
              )}
            </span>
          )}

          {/* Off-screen copies of every name, in the same font the pill uses,
              purely so their rendered width can be measured - the pill needs
              to know how wide to grow before it is asked to show one. */}
          <div aria-hidden="true" className="pointer-events-none absolute -z-10 opacity-0">
            {scenes.map((scene) => (
              <span
                key={scene.index}
                ref={(element) => {
                  labelRefs.current[scene.index] = element;
                }}
                className="inline-block whitespace-nowrap px-3.5 text-xs font-semibold tracking-wide sm:text-sm"
              >
                {scene.name}
              </span>
            ))}
          </div>

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
                  onClick={() => handleDotClick(scene.index, scene.id)}
                  onMouseEnter={() => setHoveredIndex(scene.index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  type="button"
                >
                  {/* One size for every dot — the colour carries which scene is
                      current, so it stays legible while the pill is elsewhere,
                      including mid-drag. Size is left to the pill.
                      The active one fades out once the pill has settled and
                      widened into that scene's name over it — the label says
                      what the dot was saying, and the two together would just
                      be the same fact twice, with the dot sitting inside the
                      text. It returns the moment the pill moves off again. */}
                  <div
                    className="relative h-1 w-1 rounded-full transition-[background-color,box-shadow,opacity] duration-300 ease-out"
                    style={{
                      backgroundColor: isActive ? "var(--color-accent-soft)" : "white",
                      opacity: isActive && !moving ? 0 : 1,
                      boxShadow: isActive
                        ? "0 0 12px 3px color-mix(in oklab, var(--color-accent) 85%, transparent)"
                        : isHovered
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
