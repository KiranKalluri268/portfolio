"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import BackNavigationButton from "@/components/BackNavigationButton";
import ProjectThumbnail from "@/components/content/ProjectThumbnail";
import { SKILL_ICONS } from "@/components/skills/skill-icons";
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

    const baseWidth = width * FOCUS_SCALE;
    const baseHeight = Math.min(height * FOCUS_SCALE, baseWidth * 1.25);
    const aspect = {
      x: baseWidth / (width * FOCUS_SCALE),
      y: baseHeight / (height * FOCUS_SCALE),
    };

    for (const cell of cells) {
      const element = cardRefs.current.get(key(cell));
      if (!element) continue;
      const spot = place(cell, focus.current, aspect);
      if (spot.distance > CULL_DISTANCE) {
        element.style.visibility = "hidden";
        continue;
      }
      const cardScale = spot.scale / FOCUS_SCALE;
      element.style.visibility = "visible";
      element.style.opacity = String(spot.opacity);
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
      if (!destination) return;
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
      {/* The grid takes the whole viewport, so the way out has to travel with
          it rather than sitting in a page the visitor cannot scroll to. */}
      <BackNavigationButton className={styles.back}>
        <span aria-hidden="true">←</span> Back to portfolio
      </BackNavigationButton>

      <div className={styles.legend}>
        <p className={styles.legendTitle}>Where each project came from</p>
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

      {/* Announced on its own so the focused project is reported as it changes,
          without the grid speaking every repeat of every card. */}
      <p className={styles.liveRegion} aria-live="polite">
        {focusedProject ? `${focusedProject.title} in focus` : ""}
      </p>
    </div>
    </>
  );
}
