"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useActiveSection, useScrollActions, type SectionId } from "@/context/SmoothScrollContext";
import { useAudio } from "@/context/AudioContextProvider";
import { useCoarsePointer, useReducedMotion } from "@/hooks/useMediaQuery";
import { useHoverLabel } from "@/hooks/useHoverLabel";
import { ENTRY_DISMISS_MS } from "./entry-timing";
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

/** Movement, in px, before a press on the bar counts as a drag rather than a
 *  tap. Below it nothing moves and the button's own click still fires. */
const DRAG_THRESHOLD = 5;

/** The entrance shows the bar being built, in five beats: a single dot, a
 *  circle drawn around it, the rest of the dots flooding into that same
 *  small circle cramped together, that crowding pushing the circle out into
 *  the full bar as every dot reaches its real place, and only then the
 *  active one's pill appearing around it - so the bar arrives as something
 *  assembled rather than something that was just revealed. */
type Intro = "dot" | "circle" | "flood" | "expanding" | "done";

/** How long the lone dot sits before the circle is drawn around it. */
const INTRO_DOT_MS = 250;
/** How long the circle holds, drawn but still empty, before the rest of the
 *  dots flood into it. Also how long its own fade-in takes - see the
 *  background layer's opacity transition - so the circle has fully arrived
 *  before anything floods into it. */
const INTRO_CIRCLE_MS = 350;
/** How long the flooded dots sit cramped together before their crowding
 *  pushes the circle out into the bar. */
const INTRO_FLOOD_MS = 250;
/** How long each dot takes to pop in when it floods - quick, since flooding
 *  in is a crowding, not an arrival worth lingering on. */
const INTRO_FLOOD_FADE_MS = 200;
/** How far apart the flooded dots sit, cramped, before they are pushed out
 *  to their real spacing - close enough to read as crowded, far enough that
 *  they are still five distinct dots rather than one smear. */
const CRAMPED_GAP = 10;
/** How long the crowding takes to push the circle out into the full bar. */
const INTRO_EXPAND_MS = 550;
/** How long the active dot's pill takes to appear once every dot has
 *  reached its place, and the name inside it once the pill has its shape.
 *  Opacity (and the pill's own entrance scale) only - see FADE_EASE. */
const INTRO_FADE_MS = 280;
/** How long the active dot itself takes to fade out once the pill has
 *  widened into its name, and back in once the pill moves off again. Kept
 *  short and separate from INTRO_FADE_MS so the handoff between the two
 *  reads as a sequence - one gone, then the other arriving - rather than a
 *  crossfade that shows both at once. */
const DOT_FADE_MS = 150;
/** How long the label waits before it starts fading in - long enough that
 *  both the dot it is replacing (DOT_FADE_MS) and the pill's own entrance
 *  (INTRO_FADE_MS, its scale and opacity growing in around the first-ever
 *  active dot) have finished, whichever of the two actually applies. The two
 *  run in parallel, not one after the other, so this is the larger of them
 *  rather than their sum - the label is never shown against a pill that is
 *  itself still arriving. */
const LABEL_DELAY_MS = Math.max(DOT_FADE_MS, INTRO_FADE_MS);
/** How long the bar's local widening around the active dot takes - the same
 *  total window as the label waiting and then fading in, so the bar growing
 *  the room for that label and the label itself arriving read as one motion
 *  rather than two separately timed ones. */
const BAR_GROW_MS = LABEL_DELAY_MS + INTRO_FADE_MS;
/** Every motion in the entrance rides this curve: eased well past its
 *  midpoint before easing out, the same standard curve used for the site
 *  menu's own transitions. */
const INTRO_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

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
  const { hasEntered, entrySkipped } = useAudio();
  const activeSection = useActiveSection();
  const { scrollToSection, toggleProjectsEndpoint } = useScrollActions();
  const [hoveredIndex, setHoveredIndex] = useHoverLabel<number>();
  const [portalReady, setPortalReady] = useState(false);
  const isCoarsePointer = useCoarsePointer();
  const reduceMotion = useReducedMotion();

  /** The bar sits well under the entry screen's own stacking order, so it is
   *  already mounted and running behind it - the entrance below would finish
   *  unseen if it started the moment Enter was pressed. Unlike the hero,
   *  which only has to wait for the curtain to start opening (its content
   *  sits where the opening starts, at the centre of the screen), the bar
   *  sits at the very top - outside that opening for most of the flight - so
   *  this waits for the curtain to be gone completely instead. Already true
   *  at mount for a visitor arriving from elsewhere on the site, where there
   *  is no curtain to wait for. entrySkipped restores hasEntered a tick after
   *  mount rather than at mount, same as a fresh Enter press mid-session
   *  would - but there is no curtain playing in that case either, so it
   *  gets the same zero wait reduced motion does. */
  const [curtainGone, setCurtainGone] = useState(hasEntered);
  useEffect(() => {
    if (curtainGone || !hasEntered) return;
    const timer = window.setTimeout(
      () => setCurtainGone(true),
      reduceMotion || entrySkipped ? 0 : ENTRY_DISMISS_MS,
    );
    return () => window.clearTimeout(timer);
  }, [hasEntered, curtainGone, reduceMotion, entrySkipped]);

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
  /** A button's own width, needed to know how far apart two adjacent dots
   *  already sit with no extra space between them - see activeExtra below,
   *  near the render. */
  const [buttonWidth, setButtonWidth] = useState(0);
  const [intro, setIntro] = useState<Intro>("dot");
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

      // Two adjacent dots sit this far apart, centre to centre, with no
      // extra space between them - see activeExtra near the render, which
      // measures the local bulge the active dot's own pill needs against it.
      setButtonWidth(buttons[0].getBoundingClientRect().width);

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

  // The entrance: a dot, a circle drawn around it, the rest of the dots
  // flooding into that circle cramped together, that crowding pushing the
  // circle out into the bar, and only then the active dot's pill appearing.
  // Skipped for reduced motion or a session that skipped the gate itself,
  // both of which start already "done" rather than replaying the five beats
  // as a set of instant jumps.
  useEffect(() => {
    if (!portalReady || !curtainGone) return;
    if (reduceMotion || entrySkipped) {
      // useReducedMotion() reports false for the very first client paint
      // regardless of the visitor's actual preference, so this cannot be
      // read once at mount - it has to catch up once the real value lands.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIntro("done");
      return;
    }
    const timer = window.setTimeout(() => setIntro("circle"), INTRO_DOT_MS);
    return () => window.clearTimeout(timer);
  }, [portalReady, curtainGone, reduceMotion, entrySkipped]);

  useEffect(() => {
    if (intro !== "circle") return;
    const timer = window.setTimeout(() => setIntro("flood"), INTRO_CIRCLE_MS);
    return () => window.clearTimeout(timer);
  }, [intro]);

  useEffect(() => {
    if (intro !== "flood") return;
    const timer = window.setTimeout(() => setIntro("expanding"), INTRO_FLOOD_MS);
    return () => window.clearTimeout(timer);
  }, [intro]);

  useEffect(() => {
    if (intro !== "expanding") return;
    const timer = window.setTimeout(() => setIntro("done"), INTRO_EXPAND_MS);
    return () => window.clearTimeout(timer);
  }, [intro]);

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

  const moving = drag !== null || travelling;
  const labelIndex = drag ? drag.index : null;
  const pillWidth = moving ? pill.moveWidth : (labelWidths[pillIndex] ?? pill.idleWidth);

  // One constant governs every dot-to-dot gap in the bar: half the distance
  // between two ordinary dots, which is already exactly how far a plain
  // dot's own centre sits from a neighbour - each button is its own
  // symmetric box, so this falls out of the layout for free, with no margin
  // spent on it. Only the active dot's pill is wider than a plain dot, so
  // only it ever needs more than that, split as margin onto both its sides.
  const halfUnit = buttonWidth / 2;
  const extraFor = (width: number) => Math.max(0, width / 2 - halfUnit);
  // Zero while moving: a travelling pill is a plain capsule with no label to
  // clear anything for, so the bar has nothing to make room for either.
  const activeExtra = moving ? 0 : extraFor(pillWidth);

  const circleSize = pill.idleHeight + PILL_GAP * 2;
  const isCircular = intro === "dot" || intro === "circle" || intro === "flood";
  const circleExtra = extraFor(circleSize);
  // The bar's own edge is a different constant from a dot-to-dot gap: it is
  // PILL_GAP, the same fixed clearance the sliding pill elsewhere in the
  // codebase keeps from its own bar's edge, not half a dot's natural
  // spacing - so it applies in full the moment anything is parked there,
  // rather than only past whatever a plain dot already gets for free. A
  // plain, inactive dot at that edge needs none of this - its own natural
  // half-unit from the edge is already the last of the free spacing above.
  const edgePad = (extra: number) => Math.max(0, extra + PILL_GAP - barBorder);
  // The circle centres itself on the first dot on both sides at once, unlike
  // the pill later, which only ever needs to clear whichever one side it is
  // actually parked against.
  const leftPad = isCircular ? edgePad(circleExtra) : pillIndex === 0 ? edgePad(activeExtra) : 0;
  const rightPad = isCircular
    ? edgePad(circleExtra)
    : pillIndex === scenes.length - 1
      ? edgePad(activeExtra)
      : 0;

  // The row's own width, found the same way the browser itself lays the
  // dots out - n of them, each buttonWidth wide, plus whichever of the
  // active dot's own two margins actually borders another dot rather than
  // the bar's edge (that side is edgePad's job instead) - rather than
  // measured back off the live DOM, which only reports the width the CSS
  // margin transition has reached partway through animating to it. Reading
  // that measurement back while it is itself still catching up to a
  // transition already in flight was the bar's width chasing its own tail:
  // briefly behind the very margin driving it, the dots it was meant to
  // contain drawn outside it.
  const marginBefore = pillIndex > 0 ? activeExtra : 0;
  const marginAfter = pillIndex < scenes.length - 1 ? activeExtra : 0;
  const rowWidthNow = scenes.length * buttonWidth + marginBefore + marginAfter;
  const barFullWidth = rowWidthNow + leftPad + rightPad + barBorder * 2;
  const barWidth = isCircular ? circleSize : barFullWidth;
  // The active dot's own centre, found the same analytical way rather than
  // measured - same reasoning as rowWidthNow above, and what the pill's own
  // translateX is built from, so it cannot lag the margin transition moving
  // the dot it is meant to be centred on either.
  const analyticalCenterOf = (index: number) => {
    const natural = index * buttonWidth + halfUnit;
    if (index < pillIndex) return natural;
    if (index === pillIndex) return natural + marginBefore;
    return natural + marginBefore + marginAfter;
  };
  const pillCenter = drag ? drag.x : analyticalCenterOf(pillIndex);
  // Every dot but the first starts cramped this close to it, tightly spaced
  // rather than overlapping - see CRAMPED_GAP - and is pushed out to its own
  // real centre once the crowding starts expanding the bar around it.
  const crampedOffsetFor = (index: number) =>
    index === 0 ? 0 : (centers[0] ?? 0) + index * CRAMPED_GAP - (centers[index] ?? 0);
  const pushedOut = intro === "expanding" || intro === "done";

  return createPortal(
    <>
      <nav
        ref={navRef}
        // border-transparent: invisible, but keeps nav's own border-box the
        // same thickness as the background layer's real border below, since
        // the measurement effect reads this border's width off nav itself
        // to size the pill's containment against the bar's true outer edge.
        className={`pointer-events-auto fixed bottom-[calc(3rem+env(safe-area-inset-bottom))] left-1/2 z-[1000] isolate -translate-x-1/2 rounded-full border border-transparent sm:bottom-auto sm:top-8 ${intro === "done" ? "" : "overflow-hidden"}`}
        style={{
          paddingLeft: leftPad,
          paddingRight: rightPad,
          width: barWidth,
          // Two different growths ride this: the entrance pushing the circle
          // out into the full bar, and - once settled - the bar's local
          // bulge opening and closing around whichever dot the pill is on.
          // The former is tied to the dots' own push-out (INTRO_EXPAND_MS);
          // the latter to the dot-fade-then-label-fade switch it now grows
          // alongside (BAR_GROW_MS), so the bar finishes widening exactly
          // when the label finishes fading in rather than on its own clock.
          transition: reduceMotion
            ? "none"
            : intro === "done"
              ? `padding ${BAR_GROW_MS}ms ${INTRO_EASE}, width ${BAR_GROW_MS}ms ${INTRO_EASE}`
              : `padding ${PILL_SIZE_MS}ms ease-out, width ${INTRO_EXPAND_MS}ms ${INTRO_EASE}`,
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
        {/* The bar's own visual chrome, on its own layer behind the row so it
            can fade in on its own - the circle drawn around the lone first
            dot, which is already there before this ever appears. Its shape
            always matches `nav`'s own clip exactly, so clipping it too would
            change nothing; it is not given `overflow-hidden` of its own. */}
        <div
          aria-hidden="true"
          // -inset-px: sits exactly where nav's own (transparent) border is,
          // so this layer's real border lands on nav's true outer edge
          // rather than one border-width further in.
          className="pointer-events-none absolute -inset-px rounded-full border border-white/10 bg-black/65 shadow-[0_6px_20px_rgba(0,0,0,0.4)] backdrop-blur-md"
          style={{
            opacity: intro === "dot" ? 0 : 1,
            transition: reduceMotion ? "none" : `opacity ${INTRO_CIRCLE_MS}ms ${INTRO_EASE}`,
          }}
        />
        <div
          ref={rowRef}
          // w-max: its own content width always, never shrunk to fit a
          // narrower `nav` - so the overflow while nav is held down to a
          // small circle goes somewhere sane (past the right edge, clipped
          // by nav's own overflow-hidden) rather than every dot compressing
          // into that circle.
          className="relative flex w-max flex-row items-center justify-between"
          // pan-y so the page still scrolls from a vertical swipe over the
          // bar; horizontal movement is the pill's. No gap here - the space
          // a label needs is opened locally, around whichever dot is active,
          // as margin on that dot alone - see activeExtra.
          style={{ touchAction: "pan-y" }}
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
                // Scales in from the active dot once every dot has reached
                // its place - the pill is the last thing built, not
                // something that was there all along under a closed circle.
                transform: `translate3d(${pillCenter - pillWidth / 2}px, -50%, 0) scale(${
                  intro === "done" ? 1 : 0.5
                })`,
                opacity: intro === "done" ? 1 : 0,
                // A drag follows the finger, so its position must not be
                // eased - but the entrance's own opacity and scale always
                // are, even then, since a drag cannot start until the pill
                // has already finished appearing.
                transition: reduceMotion
                  ? "none"
                  : `${pillTransition(false, !drag)}, opacity ${INTRO_FADE_MS}ms ${INTRO_EASE}`,
              }}
            >
              {/* Its own layer, clipped to the pill's growing box, so the name
                  cannot poke out past the edge while the width is still
                  animating up to it - clipping the pill itself instead would
                  cut off its own glow, which is meant to bleed past the edge.
                  Kept mounted even while moving, rather than unmounted and
                  remounted, so its own fade is a real transition every time
                  the pill settles on a new dot - a freshly mounted element
                  has no earlier frame to transition from, and would just
                  appear at full opacity the instant it settles. Delayed past
                  LABEL_DELAY_MS so the dot it is replacing is fully gone and
                  the pill itself has fully arrived first - showing the name
                  against either one still arriving is the same fact told
                  twice, once by something that is itself still unsettled. */}
              <span className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full">
                <span
                  className="whitespace-nowrap text-xs font-semibold tracking-wide text-white transition-opacity sm:text-sm"
                  style={{
                    opacity: !moving && intro === "done" ? 1 : 0,
                    transitionDuration: `${INTRO_FADE_MS}ms`,
                    transitionTimingFunction: INTRO_EASE,
                    transitionDelay: !moving && intro === "done" ? `${LABEL_DELAY_MS}ms` : "0ms",
                  }}
                >
                  {scenes[pillIndex].name}
                </span>
              </span>
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

            // The first dot is there from the very start - everything else
            // floods in cramped once the circle has been drawn, then is
            // pushed out to its real place as the crowding grows the bar.
            const dotVisible = scene.index === 0 || intro === "flood" || pushedOut;
            const dotOffset = pushedOut ? 0 : crampedOffsetFor(scene.index);
            // Only the active dot itself carries the local bulge, split
            // evenly onto its own left and right margins - which reads as
            // both of its neighbours being pushed away from it, without
            // touching any of the other, unrelated gaps between dots. Left
            // out at either end of the row, where there is no neighbour to
            // push - the bar's own edge padding already covers that side.
            const isPillHere = scene.index === pillIndex;
            const marginLeft = isPillHere && scene.index > 0 ? activeExtra : 0;
            const marginRight = isPillHere && scene.index < scenes.length - 1 ? activeExtra : 0;

            return (
              <div
                key={scene.index}
                className="relative flex flex-col items-center"
                style={{
                  opacity: dotVisible ? 1 : 0,
                  transform: `translateX(${dotOffset}px)`,
                  marginLeft,
                  marginRight,
                  transition: reduceMotion
                    ? "none"
                    : `opacity ${INTRO_FLOOD_FADE_MS}ms ${INTRO_EASE}, transform ${INTRO_EXPAND_MS}ms ${INTRO_EASE}, margin ${BAR_GROW_MS}ms ${INTRO_EASE}`,
                }}
              >
                <button
                  ref={(element) => {
                    dotRefs.current[scene.index] = element;
                  }}
                  className="relative z-10 flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-3 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:min-h-12 sm:min-w-12 sm:p-6"
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
                      The active one fades out once the pill has arrived and
                      widened into that scene's name over it — the label says
                      what the dot was saying, and the two together would just
                      be the same fact twice, with the dot sitting inside the
                      text. It returns the moment the pill moves off again,
                      plainly and at once - only the arrival gets a sequenced
                      handoff (see LABEL_DELAY_MS on the label below); timing
                      the departure the same way as well chases the pill's own
                      travel time, which varies with distance, for no benefit
                      an instant swap does not already give. */}
                  <div
                    className="relative h-1 w-1 rounded-full transition-[background-color,box-shadow,opacity] duration-300 ease-out"
                    style={{
                      backgroundColor: isActive ? "var(--color-accent-soft)" : "white",
                      opacity: isActive && !moving && intro === "done" ? 0 : 1,
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
