"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import ProjectThumbnail from "@/components/content/ProjectThumbnail";
import HintPill from "@/components/hints/HintPill";
import { hintText } from "@/components/hints/hint-copy";
import { useInputMode } from "@/components/hints/useIdleHint";
import { SKILL_ICONS } from "@/components/skills/skill-icons";
import { whenUncovered } from "@/components/nav/navigation-cover";
import { useReducedMotion } from "@/hooks/useMediaQuery";
import type { ProjectOrigin } from "@/lib/content/relationships";
import type { ProjectContent } from "@/lib/content/types";
import {
  CULL_DISTANCE,
  FOCUS_SCALE,
  type Cell,
  type Vec,
  cellFocus,
  nearestCell,
  place,
  projectIndexFor,
  ringFalloff,
  visibleCells,
} from "./grid-math";
import styles from "./projects-grid.module.css";

/** Cells are mounted a little beyond the cull radius so the set only has to be
 *  recomputed when the focus crosses into a new cell, not every frame. */
const MOUNT_SLACK = 1;

/** Drag distance, in px, before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD = 6;

/** What a second of coasting leaves of the velocity. Expressed per second
 *  rather than per frame so the glide is the same length on a 60Hz screen and
 *  a 120Hz one, and does not stretch out when frames are dropped. */
const FRICTION_PER_SECOND = 0.0016;

/** Below this the grid is at rest, in cells per second. Above zero, or it
 *  creeps for several seconds on a velocity too small to see. */
const STILL = 0.05;

/** What a second of travel leaves of the remaining distance when the grid has
 *  been asked for a particular cell — an arrow key. Nothing else pulls it:
 *  released from a drag it rests exactly where it was left. */
const TRAVEL_PER_SECOND = 0.0002;

/** Cards smaller than this fraction of the focus card show only their image;
 *  the name and skills would be illegible and only add noise. */
const LABEL_MIN_SCALE = ringFalloff(1.6);

/** How far out the backdrop blur is worth paying for. Just past the first ring,
 *  so the nine cards in the middle of the lens keep it while it is crossing
 *  between rings, and nothing beyond them does. */
const BLUR_DISTANCE = 1.05;

/** How long one card takes to arrive, and how much later each ring out starts.
 *
 * The stagger is what makes it a wave, but only while it stays short against
 * the card's own duration. At 190ms the rings were far enough apart to read as
 * one ring popping, then the next; at 90ms they overlap enough that the crest
 * — every card is at its widest about 40% of the way through — travels outward
 * as one thing. A wave is overlap, not sequence. */
const INTRO_CARD_MS = 950;
const INTRO_STAGGER_MS = 90;

/** The size a card starts at, against the size the lens says it should be.
 *  Small enough that the growth is the thing being watched. */
const INTRO_FROM = 0.38;

/** The spring the card arrives on. Damping sets how much of the overshoot
 *  survives; the frequency is chosen so there is exactly one swing past the
 *  target and one smaller dip under it before it rests — grows past its size,
 *  settles a little under, comes to rest. More swings than that reads as a
 *  wobble, fewer and it is just a fade. */
const INTRO_DAMPING = 3.4;
const INTRO_FREQUENCY = 2.5 * Math.PI;

/** Everything has arrived by here, including the outermost ring. */
const INTRO_TOTAL_MS = INTRO_CARD_MS + CULL_DISTANCE * INTRO_STAGGER_MS;

/** A damped spring from `INTRO_FROM` to 1: below, past, a little under, rest. */
function settle(t: number) {
  if (t >= 1) return 1;
  return 1 - (1 - INTRO_FROM) * Math.exp(-INTRO_DAMPING * t) * Math.cos(INTRO_FREQUENCY * t);
}

/** Remembers that this visitor has already been told the grid moves. */
const HINT_STORAGE_KEY = "projects-grid-hint";

/** A beat after arriving before the hint appears, so it is not competing with
 *  the page painting, and long enough on screen to be read at a glance. */
const HINT_DELAY_MS = INTRO_TOTAL_MS + 500;
const HINT_DURATION_MS = 9000;

/** What each outline colour means, in the order the legend reads. */
const ORIGINS: { origin: ProjectOrigin; label: string }[] = [
  { origin: "work", label: "Built in a role" },
  { origin: "selected", label: "Built for myself" },
  { origin: "personal", label: "Built for myself, not listed" },
];

export default function ProjectsGrid({
  projects,
  origins,
}: {
  projects: ProjectContent[];
  /** Keyed by slug: where each project came from, worked out on the server
   *  where the experience content lives. */
  origins: Record<string, ProjectOrigin>;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const focus = useRef<Vec>({ x: 0, y: 0 });
  const velocity = useRef<Vec>({ x: 0, y: 0 });
  const dragging = useRef(false);
  /** Where the grid is easing to, when something asked for a particular cell —
   *  a keypress, say. Null means "settle on whatever is nearest". */
  const target = useRef<Vec | null>(null);
  const reduceMotion = useReducedMotion();
  const inputMode = useInputMode();

  /** When the grid arrived. Cards ride in from the middle outwards against
   *  this, and it is cleared once the last ring has landed so the paint loop
   *  stops doing the arithmetic for the rest of the visit. */
  const introStart = useRef<number | null>(null);
  const introArmed = useRef(false);
  /** Waiting for a cover to lift before the wave can start. Nothing is drawn
   *  while this is true: without it the grid paints at full size the moment the
   *  menu's circle begins shrinking, and then animates itself in over the top
   *  of what the visitor has already seen. */
  const introPending = useRef(false);

  /** Shown once, to a visitor who has never seen the grid before. There is no
   *  scrollbar and no edge, so nothing else says the thing can be moved. */
  const [hintVisible, setHintVisible] = useState(false);
  const hintDone = useRef(true);

  const dismissHint = useCallback(() => {
    if (hintDone.current) return;
    hintDone.current = true;
    setHintVisible(false);
    try {
      window.localStorage.setItem(HINT_STORAGE_KEY, "seen");
    } catch {
      // Private browsing can refuse storage; they will just be told again.
    }
  }, []);

  useEffect(() => {
    let seen = true;
    try {
      seen = window.localStorage.getItem(HINT_STORAGE_KEY) === "seen";
    } catch {
      seen = true;
    }
    if (seen) return;
    hintDone.current = false;
    let show = 0;
    let hide = 0;
    // Counted from the same moment the wave starts, not from mount, or arriving
    // through the menu puts the pill on screen while cards are still landing.
    const cancel = whenUncovered(() => {
      show = window.setTimeout(() => setHintVisible(true), HINT_DELAY_MS);
      hide = window.setTimeout(dismissHint, HINT_DELAY_MS + HINT_DURATION_MS);
    });
    return () => {
      cancel();
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [dismissHint]);

  const [cells, setCells] = useState<Cell[]>(() => visibleCells({ x: 0, y: 0 }, CULL_DISTANCE + MOUNT_SLACK));
  const [focusedCell, setFocusedCell] = useState<Cell>({ col: 0, row: 0 });
  const mountedAround = useRef<Cell>({ col: 0, row: 0 });

  const key = (cell: Cell) => `${cell.col},${cell.row}`;

  /** Writes every mounted card's transform. Runs on the animation frame and
   *  touches the DOM directly: putting the focus in React state would re-render
   *  the whole grid sixty times a second for no benefit. */
  const paint = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) return;

    // Elapsed since the grid arrived, or null once everything has landed.
    let intro: number | null = null;
    if (introStart.current !== null) {
      intro = performance.now() - introStart.current;
      if (intro > INTRO_TOTAL_MS) {
        introStart.current = null;
        intro = null;
      }
    }

    const baseWidth = width * FOCUS_SCALE;
    const baseHeight = Math.min(height * FOCUS_SCALE, baseWidth * 1.25);
    const aspect = {
      x: baseWidth / (width * FOCUS_SCALE),
      y: baseHeight / (height * FOCUS_SCALE),
    };

    for (const cell of cells) {
      const element = cardRefs.current.get(key(cell));
      if (!element) continue;
      if (introPending.current) {
        element.style.visibility = "hidden";
        continue;
      }
      const spot = place(cell, focus.current, aspect);
      if (spot.distance > CULL_DISTANCE) {
        element.style.visibility = "hidden";
        continue;
      }
      let cardScale = spot.scale / FOCUS_SCALE;
      let entryFade = 1;
      if (intro !== null) {
        // Each ring starts later than the one inside it, so the arrival reads
        // as a wave leaving the focused card rather than as everything landing
        // together. Distance is the lens's own, so a card that is half a ring
        // out starts half a beat later.
        const t = (intro - spot.distance * INTRO_STAGGER_MS) / INTRO_CARD_MS;
        if (t <= 0) {
          element.style.visibility = "hidden";
          continue;
        }
        cardScale *= settle(t);
        entryFade = Math.min(1, t / 0.35);
      }
      element.style.visibility = "visible";
      element.style.opacity = String(spot.opacity * entryFade);
      element.style.transform =
        `translate3d(${spot.x * width - baseWidth / 2}px, ${spot.y * height - baseHeight / 2}px, 0)` +
        ` scale(${cardScale})`;
      // Nearer cards paint over farther ones, so the lens reads as depth.
      element.style.zIndex = String(Math.round(1000 - spot.distance * 100));
      // These two drive selectors, so writing them invalidates style for the
      // card even when the value is the same. Both change a handful of times a
      // drag, not sixty times a second, so they are written only on a change.
      const faded = cardScale < LABEL_MIN_SCALE ? "true" : "false";
      if (element.dataset.faded !== faded) element.dataset.faded = faded;
      const near = spot.distance <= BLUR_DISTANCE ? "true" : "false";
      if (element.dataset.near !== near) element.dataset.near = near;
    }
  }, [cells]);

  /** Remounts the visible set when the focus has wandered into a new cell. */
  const syncMounted = useCallback(() => {
    const centre = nearestCell(focus.current);
    if (centre.col === mountedAround.current.col && centre.row === mountedAround.current.row) return;
    mountedAround.current = centre;
    setCells(visibleCells(focus.current, CULL_DISTANCE + MOUNT_SLACK));
    setFocusedCell(centre);
  }, []);

  // The animation loop below must not be rebuilt every time the mounted set
  // changes, or it drops frames and the physics slows down with them. It reads
  // the latest painter through these instead of closing over it.
  const paintRef = useRef(paint);
  const syncRef = useRef(syncMounted);

  // Armed once, before the first paint, so no card is ever drawn at full size
  // and then snapped back to start the wave.
  useLayoutEffect(() => {
    if (introArmed.current) return;
    introArmed.current = true;
    if (reduceMotion) return;
    // Navigated here from the menu, this page mounts behind its cover — so the
    // wave would run while the screen is still hidden and be over by the time
    // anyone could see it. It waits for the cover to lift. Arriving any other
    // way, there is no cover and this runs at once.
    introPending.current = true;
    return whenUncovered(() => {
      introPending.current = false;
      introStart.current = performance.now();
    });
  }, [reduceMotion]);

  useLayoutEffect(() => {
    paintRef.current = paint;
    syncRef.current = syncMounted;
    paint();
  }, [paint, syncMounted]);

  // The animation loop: coast on whatever velocity the drag left behind, and
  // come to rest there. The grid is a field to wander, not a carousel of
  // positions, so nothing tugs it onto the nearest card afterwards.
  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    const step = (now: number) => {
      frame = requestAnimationFrame(step);
      // Capped so a backgrounded tab does not resume with one enormous step.
      const elapsed = Math.min(0.05, Math.max(0, (now - previous) / 1000));
      previous = now;
      if (dragging.current || elapsed === 0) return;

      const speed = Math.hypot(velocity.current.x, velocity.current.y);
      if (speed > STILL) {
        const decay = FRICTION_PER_SECOND ** elapsed;
        focus.current = {
          x: focus.current.x + velocity.current.x * elapsed,
          y: focus.current.y + velocity.current.y * elapsed,
        };
        velocity.current = { x: velocity.current.x * decay, y: velocity.current.y * decay };
        paintRef.current();
        syncRef.current();
        return;
      }
      velocity.current = { x: 0, y: 0 };

      // Only a deliberate request moves it now; a finished drag just stops.
      const destination = target.current;
      if (!destination) {
        // Standing still, but still arriving: the wave has to be painted even
        // though there is nothing to integrate.
        if (introStart.current !== null) paintRef.current();
        return;
      }
      const dx = destination.x - focus.current.x;
      const dy = destination.y - focus.current.y;
      if (Math.abs(dx) < 0.0008 && Math.abs(dy) < 0.0008) {
        target.current = null;
        if (focus.current.x !== destination.x || focus.current.y !== destination.y) {
          focus.current = destination;
          paintRef.current();
          syncRef.current();
        }
        return;
      }
      const pull = 1 - TRAVEL_PER_SECOND ** elapsed;
      focus.current = { x: focus.current.x + dx * pull, y: focus.current.y + dy * pull };
      paintRef.current();
      syncRef.current();
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => paint());
    observer.observe(stage);
    return () => observer.disconnect();
  }, [paint]);

  // Lenis owns touch on the window and stops animations on every touch event.
  // The grid is a drag surface, so it claims the ones it is using; without this
  // a flick would die the instant the finger lifted. See CLAUDE.md.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const claim = (event: TouchEvent) => {
      (event as TouchEvent & { lenisStopPropagation?: boolean }).lenisStopPropagation = true;
    };
    stage.addEventListener("touchmove", claim, { passive: true });
    stage.addEventListener("touchend", claim, { passive: true });
    return () => {
      stage.removeEventListener("touchmove", claim);
      stage.removeEventListener("touchend", claim);
    };
  }, []);

  const press = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const lastMove = useRef<{ x: number; y: number; time: number } | null>(null);
  const suppressClickUntil = useRef(0);

  const cellsPerPixel = () => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    // One card width of finger travel should move the grid by about one cell.
    return { x: 1 / (stage.clientWidth * FOCUS_SCALE), y: 1 / (stage.clientHeight * FOCUS_SCALE) };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    press.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    lastMove.current = { x: event.clientX, y: event.clientY, time: event.timeStamp };
    velocity.current = { x: 0, y: 0 };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const held = press.current;
    const stage = stageRef.current;
    if (!held || !stage || held.id !== event.pointerId) return;

    if (!held.moved) {
      if (Math.hypot(event.clientX - held.x, event.clientY - held.y) < DRAG_THRESHOLD) return;
      held.moved = true;
      dragging.current = true;
      // They have worked it out; the pill has nothing left to say.
      dismissHint();
      stage.setPointerCapture(event.pointerId);
    }

    const previous = lastMove.current;
    const perPixel = cellsPerPixel();
    if (previous) {
      // Dragging right brings cards from the left, so the focus moves left.
      const dx = -(event.clientX - previous.x) * perPixel.x;
      const dy = -(event.clientY - previous.y) * perPixel.y;
      focus.current = { x: focus.current.x + dx, y: focus.current.y + dy };
      const elapsed = Math.max(1, event.timeStamp - previous.time);
      // Cells per second, which is what the loop integrates.
      velocity.current = { x: (dx / elapsed) * 1000, y: (dy / elapsed) * 1000 };
      paint();
      syncMounted();
    }
    lastMove.current = { x: event.clientX, y: event.clientY, time: event.timeStamp };
  };

  const endPress = (event: React.PointerEvent<HTMLDivElement>) => {
    const held = press.current;
    if (!held || held.id !== event.pointerId) return;
    press.current = null;
    lastMove.current = null;
    if (held.moved) {
      dragging.current = false;
      target.current = null;
      suppressClickUntil.current = performance.now() + 400;
      if (reduceMotion) velocity.current = { x: 0, y: 0 };
    }
  };

  /** Moves one cell in a direction, easing rather than jumping so a held arrow
   *  key travels the grid the same way a drag does. */
  const moveFocus = (dCol: number, dRow: number) => {
    const centre = target.current ? nearestCell(target.current) : nearestCell(focus.current);
    const next = { col: centre.col + dCol, row: centre.row + dRow };
    velocity.current = { x: 0, y: 0 };
    if (reduceMotion) {
      focus.current = cellFocus(next);
      target.current = null;
      paint();
      syncMounted();
      return;
    }
    target.current = cellFocus(next);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    dismissHint();
    moveFocus(move[0], move[1]);
  };

  const focusedProject = projects[projectIndexFor(focusedCell, projects.length)];

  // Only key what is actually on the grid. Every project today is either work
  // or selected, and a key entry for a colour nobody can find is a puzzle
  // rather than an explanation; add a project that is neither and its entry
  // appears on its own.
  const present = new Set(projects.map((project) => origins[project.slug] ?? "personal"));
  const shownOrigins = ORIGINS.filter((entry) => present.has(entry.origin));

  return (
    <>
      {/* Under the back button rather than across the top: the middle of the
          screen belongs to the focused card, and on a phone there is no room
          between the button and the view toggle. */}
      <h1 className={styles.heading}>Projects</h1>

      <div className={styles.legend}>
        <ul className={styles.legendList}>
          {shownOrigins.map((entry) => (
            <li key={entry.origin} className={styles.legendItem}>
              <span className={styles.legendSwatch} data-origin={entry.origin} aria-hidden="true" />
              {entry.label}
            </li>
          ))}
        </ul>
      </div>

    <div
      ref={stageRef}
      className={styles.stage}
      style={{ "--focus-scale": FOCUS_SCALE } as React.CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPress}
      onPointerCancel={endPress}
      onKeyDown={onKeyDown}
      onClickCapture={(event) => {
        if (performance.now() > suppressClickUntil.current) return;
        suppressClickUntil.current = 0;
        event.preventDefault();
        event.stopPropagation();
      }}
      tabIndex={0}
      role="group"
      aria-label="Projects, arranged as a grid you can drag. Use the arrow keys to move between them."
    >
      {cells.map((cell) => {
        const project = projects[projectIndexFor(cell, projects.length)];
        if (!project) return null;
        const isFocused = cell.col === focusedCell.col && cell.row === focusedCell.row;
        return (
          <article
            key={key(cell)}
            ref={(element) => {
              if (element) cardRefs.current.set(key(cell), element);
              else cardRefs.current.delete(key(cell));
            }}
            className={styles.card}
            // Only the card under the lens is reachable and readable; the rest
            // are the same handful of projects repeated, and announcing them
            // all would be a wall of duplicates.
            aria-hidden={!isFocused}
          >
            <Link
              href={`/projects/${project.slug}`}
              className={styles.cardLink}
              data-origin={origins[project.slug] ?? "personal"}
              tabIndex={isFocused ? 0 : -1}
            >
              <span className={styles.media}>
                <ProjectThumbnail
                  project={project}
                  className={styles.image}
                  sizes="(max-width: 640px) 50vw, 40vw"
                />
              </span>
              <span className={styles.meta}>
                <span className={styles.title}>{project.title.split(" – ")[0]}</span>
                <span className={styles.skills} aria-hidden="true">
                  {project.skills
                    .filter((slug) => SKILL_ICONS[slug])
                    .slice(0, 4)
                    .map((slug) => {
                      const Icon = SKILL_ICONS[slug];
                      return <Icon key={slug} className={styles.skillIcon} />;
                    })}
                </span>
              </span>
            </Link>
          </article>
        );
      })}

      <HintPill
        text={hintText("projects-grid", inputMode)}
        visible={hintVisible}
        // Above the colour key rather than beside it: on a phone the two are
        // both wide enough to share the bottom of the screen otherwise.
        className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] left-1/2 sm:bottom-16"
      />

      {/* Announced on its own so the focused project is reported as it changes,
          without the grid speaking every repeat of every card. */}
      <p className={styles.liveRegion} aria-live="polite">
        {focusedProject ? `${focusedProject.title} in focus` : ""}
      </p>
    </div>
    </>
  );
}
