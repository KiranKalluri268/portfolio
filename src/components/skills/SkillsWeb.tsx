"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { SkillWebData } from "@/lib/content/types";
import {
  CENTER_X,
  CENTER_Y,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  skillWebEdgePathFromChild,
  type GraphEdge,
  type GraphNode,
} from "./skill-web-layout";
import HintPill from "../hints/HintPill";
import { useReducedMotion } from "@/hooks/useMediaQuery";
import { useIdleHint, useInputMode } from "../hints/useIdleHint";
import { whenUncovered } from "../nav/navigation-cover";
import { hintText } from "../hints/hint-copy";

const MIN_SCALE = 0.28;
const MAX_SCALE = 1.65;

interface ViewState {
  x: number;
  y: number;
  scale: number;
}

interface PointerPosition {
  x: number;
  y: number;
}

interface GestureSnapshot {
  distance: number;
  midpoint: PointerPosition;
  view: ViewState;
}

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function distanceBetween(first: PointerPosition, second: PointerPosition) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function midpoint(first: PointerPosition, second: PointerPosition) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

/** The web assembles itself from the outside in: the skills appear, their lines
 *  reach inward and meet to make a category, those lines reach in to make a
 *  domain, and those meet at the centre. Each beat finishes before the next
 *  starts — it is a thing being built, not a thing growing.
 *
 * Every line in a beat takes the same time regardless of how long it is. That
 * is the whole trick: at a constant speed the short edges land first and there
 * is no moment of collision, just lines finishing untidily. `pathLength="1"`
 * normalises them so they all arrive on the same frame. */
/** Every node arrives on the same damped spring — under its size, past it, a
 *  little under again, rest. The curve itself is in globals.css as keyframes;
 *  this is how long it takes. */
const NODE_MS = 520;
/** The leaves do not all appear at once; they sweep round the circle. */
const LEAF_SWEEP_MS = 450;
/** How long a comet takes to run its edge, whatever that edge's length. */
const LINE_MS = 600;
/** The comet's bright head, as a fraction of the edge it is running. */
const COMET_LENGTH = 0.16;
/** The beat between the comets landing on a meeting point and the node they
 *  made springing out of it. Without it the node started on the same frame the
 *  heads arrived and covered the collision it was supposed to be caused by. */
const TOUCH_HOLD_MS = 140;
/** How long the landed head takes to go, once the node is on its way out from
 *  under it. */
const COMET_LAND_MS = 180;

/** The size a node starts at, as a fraction of its own. The spring's overshoot
 *  is proportional to the distance travelled — a node starting at 0.5 only ever
 *  swings 6% past its size, which reads as nothing on something as large as the
 *  centre. The structural nodes start far smaller than the leaves for that
 *  reason: same curve, visible amplitude. */
const POP_FROM: Record<GraphNode["kind"], number> = {
  skill: 0.34,
  category: 0.12,
  domain: 0.1,
  center: 0.08,
};

/** How long to wait for the page to go quiet before starting, and how long to
 *  wait for that wait. A browser without requestIdleCallback gets the flat
 *  delay instead. */
const SETTLE_TIMEOUT_MS = 600;
const SETTLE_FALLBACK_MS = 260;

const T_CATEGORY_LINES = LEAF_SWEEP_MS + NODE_MS;
const T_CATEGORY_NODES = T_CATEGORY_LINES + LINE_MS + TOUCH_HOLD_MS;
const T_DOMAIN_LINES = T_CATEGORY_NODES + NODE_MS;
const T_DOMAIN_NODES = T_DOMAIN_LINES + LINE_MS + TOUCH_HOLD_MS;
const T_CENTER_LINES = T_DOMAIN_NODES + NODE_MS;
const T_CENTER_NODE = T_CENTER_LINES + LINE_MS + TOUCH_HOLD_MS;
/** The animations begin a frame or two after the timer that will end them, so
 *  the two clocks are not the same clock. Without the tail the last node loses
 *  the end of its spring and snaps the final percent. */
const INTRO_TAIL_MS = 90;
const INTRO_TOTAL_MS = T_CENTER_NODE + NODE_MS + INTRO_TAIL_MS;

/** When a node appears, by what it is. Skills are handled separately, since
 *  they sweep rather than land together. */
const NODE_DELAY: Record<GraphNode["kind"], number> = {
  skill: 0,
  category: T_CATEGORY_NODES,
  domain: T_DOMAIN_NODES,
  center: T_CENTER_NODE,
};

/** When an edge draws, by the child it runs to — the end it draws from. */
const EDGE_DELAY: Record<GraphNode["kind"], number> = {
  skill: T_CATEGORY_LINES,
  category: T_DOMAIN_LINES,
  domain: T_CENTER_LINES,
  center: 0,
};

/** Where a leaf sits round the circle, 0 to 1, so they can sweep rather than
 *  arrive in whatever order the data happens to be in. */
function angleFraction(node: GraphNode) {
  const turn = Math.atan2(node.y - CENTER_Y, node.x - CENTER_X) + Math.PI / 2;
  return ((turn / (Math.PI * 2)) % 1 + 1) % 1;
}

export default function SkillsWeb({
  data,
  graph,
}: {
  data: SkillWebData;
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, PointerPosition>());
  const dragOriginRef = useRef<{ pointer: PointerPosition; view: ViewState } | null>(null);
  const pinchOriginRef = useRef<GestureSnapshot | null>(null);
  const transitionTimerRef = useRef(0);
  const [view, setView] = useState<ViewState>({ x: 0, y: 0, scale: 0.5 });
  const [dragging, setDragging] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  /** "waiting" until anything covering the page has gone, "building" while it
   *  assembles, "done" once it is an ordinary web again — at which point every
   *  inline style the intro used is dropped so nothing it did survives. */
  const reduceMotion = useReducedMotion();
  // Reduced motion never assembles; it is done before the first paint rather
  // than switched to done by an effect afterwards.
  const [assembly, setAssembly] = useState<"waiting" | "building" | "done">(
    () => (typeof window !== "undefined"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "done" : "waiting"),
  );
  const inputMode = useInputMode();
  const webHint = useIdleHint(hasInteracted || assembly !== "done" ? null : "skill-web");

  // The directory is a full-screen dialog, and the site header is fixed in the
  // layout, so it paints over the top of it. That put the logo on top of
  // "Alternative view" and the menu button on top of Close at 402px, and on a
  // desktop it put the audio toggle inside the Close button, where it took the
  // click — pressing the middle of "Close" played audio instead of closing.
  //
  // A dialog that covers the screen owns the screen, so the header goes away
  // for as long as it is open. That is what the site menu already does by
  // covering everything, and it means the dialog's own controls are the only
  // ones on screen.
  useEffect(() => {
    if (!directoryOpen) return;
    document.body.dataset.modalOpen = "true";
    return () => {
      delete document.body.dataset.modalOpen;
    };
  }, [directoryOpen]);

  // Anyone who touches the web wants the web, not a performance about it. The
  // first visit earns the build; the fifth does not.
  useEffect(() => {
    if (assembly !== "building") return;
    const skip = () => setAssembly("done");
    window.addEventListener("pointerdown", skip, { passive: true });
    window.addEventListener("wheel", skip, { passive: true });
    window.addEventListener("keydown", skip, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("wheel", skip);
      window.removeEventListener("keydown", skip);
    };
  }, [assembly]);

  useEffect(() => {
    if (reduceMotion) return;
    let finish = 0;
    // Reached through the site menu, this page mounts behind its cover; without
    // waiting the web would build itself on a hidden screen.
    let idle = 0;
    let usedIdle = false;
    const cancel = whenUncovered(() => {
      // Not on the frame the page mounts: hydration and thirty-seven icon
      // images land in the first few hundred milliseconds, and starting into
      // that spends the opening beat on frames that are already late.
      const begin = () => {
        setAssembly("building");
        finish = window.setTimeout(() => setAssembly("done"), INTRO_TOTAL_MS);
      };
      const idleAvailable = typeof window.requestIdleCallback === "function";
      idle = idleAvailable
        ? window.requestIdleCallback(begin, { timeout: SETTLE_TIMEOUT_MS })
        : window.setTimeout(begin, SETTLE_FALLBACK_MS);
      usedIdle = idleAvailable;
    });
    return () => {
      cancel();
      window.clearTimeout(finish);
      if (usedIdle) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [reduceMotion]);

  const nodeById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );

  const enableViewTransition = useCallback(() => {
    setTransitioning(true);
    window.clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = window.setTimeout(() => setTransitioning(false), 720);
  }, []);

  const fitWeb = useCallback((animate = true) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const bounds = viewport.getBoundingClientRect();
    const scale = clampScale(Math.min(
      (bounds.width - 40) / (WORLD_WIDTH - 280),
      (bounds.height - 40) / (WORLD_HEIGHT - 240),
      0.72,
    ));
    if (animate) enableViewTransition();
    setView({
      x: bounds.width / 2 - CENTER_X * scale,
      y: bounds.height / 2 - CENTER_Y * scale,
      scale,
    });
  }, [enableViewTransition]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const initialFrame = window.requestAnimationFrame(() => fitWeb(false));
    const observer = new ResizeObserver(() => fitWeb(false));
    observer.observe(viewport);
    return () => {
      window.cancelAnimationFrame(initialFrame);
      observer.disconnect();
      window.clearTimeout(transitionTimerRef.current);
    };
  }, [fitWeb]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = viewport.getBoundingClientRect();
      const point = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      };
      setTransitioning(false);
      setHasInteracted(true);
      setView((current) => {
        const nextScale = clampScale(current.scale * Math.exp(-event.deltaY * 0.00125));
        const ratio = nextScale / current.scale;
        return {
          x: point.x - (point.x - current.x) * ratio,
          y: point.y - (point.y - current.y) * ratio,
          scale: nextScale,
        };
      });
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, []);

  const focusNode = useCallback((node: GraphNode, scale: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const bounds = viewport.getBoundingClientRect();
    const nextScale = clampScale(scale);
    enableViewTransition();
    setHasInteracted(true);
    setView({
      x: bounds.width / 2 - node.x * nextScale,
      y: bounds.height / 2 - node.y * nextScale,
      scale: nextScale,
    });
  }, [enableViewTransition]);

  const zoomAtCenter = useCallback((factor: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const bounds = viewport.getBoundingClientRect();
    const point = { x: bounds.width / 2, y: bounds.height / 2 };
    enableViewTransition();
    setHasInteracted(true);
    setView((current) => {
      const nextScale = clampScale(current.scale * factor);
      const ratio = nextScale / current.scale;
      return {
        x: point.x - (point.x - current.x) * ratio,
        y: point.y - (point.y - current.y) * ratio,
        scale: nextScale,
      };
    });
  }, [enableViewTransition]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-web-node], [data-web-control]")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const position = { x: event.clientX, y: event.clientY };
    pointersRef.current.set(event.pointerId, position);
    setTransitioning(false);
    setDragging(true);
    setHasInteracted(true);

    if (pointersRef.current.size === 1) {
      dragOriginRef.current = { pointer: position, view };
      pinchOriginRef.current = null;
    } else if (pointersRef.current.size === 2) {
      const [first, second] = [...pointersRef.current.values()];
      pinchOriginRef.current = {
        distance: distanceBetween(first, second),
        midpoint: midpoint(first, second),
        view,
      };
      dragOriginRef.current = null;
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2 && pinchOriginRef.current) {
      const [first, second] = [...pointersRef.current.values()];
      const currentMidpoint = midpoint(first, second);
      const origin = pinchOriginRef.current;
      const nextScale = clampScale(
        origin.view.scale * distanceBetween(first, second) / Math.max(origin.distance, 1),
      );
      const worldX = (origin.midpoint.x - origin.view.x) / origin.view.scale;
      const worldY = (origin.midpoint.y - origin.view.y) / origin.view.scale;
      setView({
        x: currentMidpoint.x - worldX * nextScale,
        y: currentMidpoint.y - worldY * nextScale,
        scale: nextScale,
      });
      return;
    }

    if (pointersRef.current.size === 1 && dragOriginRef.current) {
      const origin = dragOriginRef.current;
      setView({
        ...origin.view,
        x: origin.view.x + event.clientX - origin.pointer.x,
        y: origin.view.y + event.clientY - origin.pointer.y,
      });
    }
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size === 1) {
      const [position] = pointersRef.current.values();
      dragOriginRef.current = { pointer: position, view };
      pinchOriginRef.current = null;
    } else if (pointersRef.current.size === 0) {
      dragOriginRef.current = null;
      pinchOriginRef.current = null;
      setDragging(false);
    }
  };

  const activeNode = activeNodeId ? nodeById.get(activeNodeId) : undefined;
  const relatedNodeIds = useMemo(() => {
    if (!activeNode) return null;
    const related = new Set<string>([activeNode.id]);
    let current = activeNode;
    while (current.parentId) {
      related.add(current.parentId);
      const parent = nodeById.get(current.parentId);
      if (!parent) break;
      current = parent;
    }
    const addDescendants = (parentId: string) => {
      for (const node of graph.nodes) {
        if (node.parentId === parentId) {
          related.add(node.id);
          addDescendants(node.id);
        }
      }
    };
    addDescendants(activeNode.id);
    return related;
  }, [activeNode, graph.nodes, nodeById]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-web-node], [data-web-control]")) return;
    const distance = event.shiftKey ? 140 : 70;
    if (event.key === "ArrowLeft") setView((current) => ({ ...current, x: current.x + distance }));
    else if (event.key === "ArrowRight") setView((current) => ({ ...current, x: current.x - distance }));
    else if (event.key === "ArrowUp") setView((current) => ({ ...current, y: current.y + distance }));
    else if (event.key === "ArrowDown") setView((current) => ({ ...current, y: current.y - distance }));
    else if (event.key === "+" || event.key === "=") zoomAtCenter(1.22);
    else if (event.key === "-") zoomAtCenter(0.82);
    else if (event.key === "0" || event.key === "Home") fitWeb();
    else return;
    event.preventDefault();
    setHasInteracted(true);
  };

  return (
    <div
      ref={viewportRef}
      className={`relative h-full w-full overflow-hidden select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={{
        touchAction: "none",
        backgroundColor: "rgba(2, 3, 10, 0.34)",
        backgroundImage: [
          "radial-gradient(circle at center, rgba(224,69,10,0.14), transparent 34%)",
          "radial-gradient(circle at 24% 28%, rgba(255,122,24,0.1), transparent 20%)",
        ].join(","),
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label="Interactive skill universe. Drag to pan and scroll or pinch to zoom."
    >
      <div
        className={`absolute left-0 top-0 ${transitioning && !dragging ? "transition-transform duration-700 ease-out" : ""}`}
        style={{
          width: WORLD_WIDTH,
          height: WORLD_HEIGHT,
          transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
          transformOrigin: "0 0",
        }}
      >
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
          aria-hidden="true"
        >
          <defs>
            {/* Sized in user space, not as a percentage of each path's bounding
                box: a branch that runs perfectly vertical has a box of zero
                width, so a percentage region collapses and the glowing edge
                renders into nothing. */}
            <filter
              id="skill-web-glow"
              filterUnits="userSpaceOnUse"
              x="0"
              y="0"
              width={WORLD_WIDTH}
              height={WORLD_HEIGHT}
            >
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {graph.edges.map((edge) => {
            const isActive = !relatedNodeIds ||
              (relatedNodeIds.has(edge.from.id) && relatedNodeIds.has(edge.to.id));
            // A negative offset reveals from the far end, so the line grows
            // from the child inward to its parent rather than out from the
            // parent. pathLength="1" makes that one unit for every edge, so
            // long and short lines take the same time and arrive together.
            const drawDelay = EDGE_DELAY[edge.to.kind];
            // The line the comet leaves behind. It does not fade — what the
            // head has passed over stays drawn.
            const drawing = assembly === "done"
              ? undefined
              : {
                strokeDasharray: "1 1",
                strokeDashoffset: 1,
                animation: assembly === "building"
                  ? `skill-edge-draw ${LINE_MS}ms linear ${drawDelay}ms both`
                  : undefined,
              };

            return (
              <g key={edge.id}>
                <path
                  d={assembly === "done" ? edge.path : skillWebEdgePathFromChild(edge)}
                  pathLength="1"
                  fill="none"
                  stroke={edge.accent}
                  strokeWidth={isActive ? 2.2 : 1}
                  strokeOpacity={isActive ? 0.48 : 0.07}
                  filter={isActive && activeNode ? "url(#skill-web-glow)" : undefined}
                  className="transition-all duration-300"
                  style={drawing}
                />
                {/* The comet: a bright head riding the leading edge of the line
                    being drawn. Its dash offset is the line's own offset shifted
                    by its length, so the two cannot come apart however long the
                    edge is. Two animations: the run in, then — after it has sat
                    on the meeting point long enough to be seen touching — the
                    fade, by which time the node is springing out beneath it. */}
                {assembly === "building" && (
                  <path
                    d={skillWebEdgePathFromChild(edge)}
                    pathLength="1"
                    fill="none"
                    stroke={edge.accent}
                    strokeWidth={3.4}
                    strokeLinecap="round"
                    filter="url(#skill-web-glow)"
                    style={{
                      "--comet-length": COMET_LENGTH,
                      strokeDasharray: `${COMET_LENGTH} 1`,
                      strokeDashoffset: COMET_LENGTH,
                      animation: [
                        `skill-edge-comet ${LINE_MS}ms linear ${drawDelay}ms both`,
                        `skill-comet-land ${COMET_LAND_MS}ms linear ${drawDelay + LINE_MS + TOUCH_HOLD_MS}ms both`,
                      ].join(", "),
                    } as React.CSSProperties}
                  />
                )}

              </g>
            );
          })}
        </svg>

        {graph.nodes.map((node) => {
          const dimmed = relatedNodeIds && !relatedNodeIds.has(node.id);
          // Skills sweep round the circle; everything else lands on its beat.
          const appearsAt = node.kind === "skill"
            ? angleFraction(node) * LEAF_SWEEP_MS
            : NODE_DELAY[node.kind];

          // `scale` rather than a transform, so it composes with the centring
          // translate in the class list instead of replacing it — and with the
          // hover scale, once this is out of the way.
          const popFrom = POP_FROM[node.kind];
          const arriving = assembly === "done"
            ? undefined
            : {
              // The pre-animation state, which is also what "waiting" shows.
              opacity: 0,
              scale: String(popFrom),
              // The keyframes read every intermediate off this, so one curve
              // covers a leaf starting at a third of its size and a centre
              // starting at a twelfth.
              "--pop-from": popFrom,
              animation: assembly === "building"
                ? `skill-node-pop ${NODE_MS}ms linear ${appearsAt}ms both`
                : undefined,
            };

          /* Every node carries a backdrop blur, and the build animates the
             scale of all fifty-eight at once — so the browser re-samples and
             re-blurs what is behind each of them, every frame. Measured: it
             halves the frame rate for the whole build, 33.3ms a frame against
             16.7ms without it. The utility is left off while it arrives rather
             than overridden: a rule setting backdrop-filter:none is minified
             down to the -webkit- form alone and Chrome then ignores it. */
          const blur = assembly === "building"
            ? ""
            : node.kind === "skill" ? "backdrop-blur-md" : "backdrop-blur-xl";

          const sharedStyle = {
            left: node.x,
            top: node.y,
            borderColor: `${node.accent}66`,
            boxShadow: `0 0 ${node.kind === "center" ? 50 : 24}px ${node.accent}22`,
            ...arriving,
          } as React.CSSProperties;

          if (node.kind === "skill" && node.skill) {
            return (
              <Link
                key={node.id}
                data-web-node
                href={`/skills/${node.skill.slug}`}
                className={`absolute z-20 flex min-h-12 w-36 -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border bg-black/80 px-3 py-2 text-left text-sm text-white shadow-xl transition-all hover:z-40 hover:scale-110 hover:bg-black focus-visible:z-40 focus-visible:scale-110 ${blur} ${dimmed ? "opacity-20" : "opacity-100"}`}
                style={sharedStyle}
                onPointerEnter={() => setActiveNodeId(node.id)}
                onPointerLeave={() => setActiveNodeId(null)}
                onFocus={() => setActiveNodeId(node.id)}
                onBlur={() => setActiveNodeId(null)}
                aria-label={`${node.label}: ${node.description}`}
              >
                <span
                  className="flex h-7 min-w-7 items-center justify-center overflow-hidden rounded-full text-[0.65rem] font-bold"
                  style={{ color: node.accent, backgroundColor: `${node.accent}18` }}
                  aria-hidden="true"
                >
                  {node.skill.icon ? (
                    <Image src={node.skill.icon} alt="" width={24} height={24} className="h-6 w-6 object-contain" />
                  ) : (
                    node.skill.iconText ?? node.label.slice(0, 2)
                  )}
                </span>
                <span className="truncate font-medium">{node.label}</span>
              </Link>
            );
          }

          const sizeClasses = node.kind === "center"
            ? "h-48 w-48 rounded-full"
            : node.kind === "domain"
              ? "min-h-20 w-52 rounded-2xl px-5"
              : "min-h-16 w-44 rounded-2xl px-4";
          return (
            <button
              key={node.id}
              type="button"
              data-web-node
              className={`absolute z-30 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center border bg-black/80 text-center text-white transition-all hover:z-40 hover:scale-105 focus-visible:z-40 focus-visible:scale-105 ${blur} ${sizeClasses} ${dimmed ? "opacity-25" : "opacity-100"}`}
              style={sharedStyle}
              onClick={() => node.kind === "center" ? fitWeb() : focusNode(node, node.kind === "domain" ? 0.82 : 1.02)}
              onPointerEnter={() => setActiveNodeId(node.id)}
              onPointerLeave={() => setActiveNodeId(null)}
              onFocus={() => setActiveNodeId(node.id)}
              onBlur={() => setActiveNodeId(null)}
              aria-label={`${node.label}: ${node.description}. Activate to focus this branch.`}
            >
              <span
                className={node.kind === "center"
                  ? "text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-accent-tint"
                  : "text-[0.6rem] font-semibold uppercase tracking-[0.2em]"}
                style={node.kind === "center" ? undefined : { color: node.accent }}
              >
                {node.kind === "center" ? node.description : node.kind}
              </span>
              <span className={node.kind === "center" ? "mt-2 text-2xl font-bold tracking-[0.12em]" : "mt-1 font-semibold"}>
                {node.label}
              </span>
              {node.kind === "category" && (
                <span className="mt-1 text-[0.6rem] text-gray-500">
                  {graph.nodes.filter((item) => item.parentId === node.id).length || "Explore"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        data-web-control
        className="absolute bottom-4 right-4 z-50 flex items-center gap-1 rounded-full border border-white/10 bg-black/70 p-1.5 shadow-xl backdrop-blur-xl sm:bottom-6 sm:right-6"
        aria-label="Skill universe zoom controls"
      >
        <button type="button" onClick={() => zoomAtCenter(1.22)} className="flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-white/10" aria-label="Zoom in">+</button>
        <button type="button" onClick={() => zoomAtCenter(0.82)} className="flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-white/10" aria-label="Zoom out">−</button>
        <button type="button" onClick={() => fitWeb()} className="h-10 rounded-full px-3 text-xs font-semibold uppercase tracking-wider hover:bg-white/10" aria-label="Fit entire skill universe">Fit</button>
        <button type="button" onClick={() => setDirectoryOpen(true)} className="h-10 rounded-full px-3 text-xs font-semibold uppercase tracking-wider hover:bg-white/10" aria-label="Open accessible skill directory">List</button>
      </div>

      {/* Same hint system as the homepage: it waits until someone has stalled
          rather than greeting everyone, and retires once they start dragging.
          Absolute rather than fixed so it sits inside the canvas.

          Clear of the zoom controls, which are 52px tall and sit 16px off the
          bottom (24px above sm) — the pill used to sit at 20px and the two
          overlapped, with the controls painting over the middle of the hint. */}
      <HintPill
        text={hintText("skill-web", inputMode)}
        visible={webHint.visible}
        className="absolute bottom-20 left-1/2 sm:bottom-24"
      />

      {activeNode && activeNode.kind !== "center" && (
        <aside
          data-web-control
          className="pointer-events-none absolute right-4 top-4 z-50 hidden max-w-xs rounded-2xl border border-white/10 bg-black/80 p-4 shadow-2xl backdrop-blur-xl lg:block"
          style={{ borderColor: `${activeNode.accent}55` }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: activeNode.accent }}>
            {activeNode.kind}
          </p>
          <p className="mt-2 font-semibold text-white">{activeNode.label}</p>
          <p className="mt-2 text-sm leading-relaxed text-gray-400">{activeNode.description}</p>
        </aside>
      )}

      {directoryOpen && (
        <div
          data-web-control
          className="absolute inset-0 z-[80] overflow-y-auto bg-[#02030a]/95 p-4 backdrop-blur-xl sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="skill-directory-title"
        >
          <div className="mx-auto max-w-5xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#02030a]/95 py-4 backdrop-blur-xl">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent-soft">Alternative view</p>
                <h2 id="skill-directory-title" className="mt-1 text-2xl font-bold">Skill directory</h2>
              </div>
              <button
                type="button"
                onClick={() => setDirectoryOpen(false)}
                className="rounded-full border border-white/15 px-4 py-2 text-sm hover:border-accent-soft/50"
                aria-label="Close skill directory"
              >
                Close
              </button>
            </div>

            <div className="grid gap-5 py-7 md:grid-cols-2">
              {data.domains.map((domain) => (
                <section key={domain.slug} className="rounded-3xl border border-white/10 bg-black/55 backdrop-blur-sm p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: domain.accent }}>
                    Domain
                  </p>
                  <h3 className="mt-2 text-xl font-bold">{domain.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">{domain.description}</p>
                  <div className="mt-5 space-y-5">
                    {domain.categories.map((category) => (
                      <div key={category.slug}>
                        <h4 className="text-sm font-semibold text-gray-200">{category.label}</h4>
                        {category.skills.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {category.skills.map((skill) => (
                              <Link
                                key={skill.slug}
                                href={`/skills/${skill.slug}`}
                                className="rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-accent-soft/40 hover:text-white"
                              >
                                {skill.name}
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-gray-600">Exploration in progress</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
