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
  type GraphEdge,
  type GraphNode,
} from "./skill-web-layout";

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
          "radial-gradient(circle at center, rgba(37,99,235,0.12), transparent 34%)",
          "radial-gradient(circle at 24% 28%, rgba(168,85,247,0.1), transparent 20%)",
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
        <div
          className="pointer-events-none absolute inset-0 opacity-55"
          style={{
            backgroundImage: [
              "radial-gradient(circle, rgba(255,255,255,.75) 0 1px, transparent 1.5px)",
              "radial-gradient(circle, rgba(96,165,250,.55) 0 1px, transparent 1.5px)",
            ].join(","),
            backgroundPosition: "0 0, 42px 58px",
            backgroundSize: "86px 86px, 113px 113px",
            maskImage: "radial-gradient(circle at center, black 25%, transparent 78%)",
          }}
        />

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
            return (
              <g key={edge.id}>
                <path
                  d={edge.path}
                  fill="none"
                  stroke={edge.accent}
                  strokeWidth={isActive ? 2.2 : 1}
                  strokeOpacity={isActive ? 0.48 : 0.07}
                  filter={isActive && activeNode ? "url(#skill-web-glow)" : undefined}
                  className="transition-all duration-300"
                />
                <circle className="skill-web-particle" r="3" fill={edge.accent} opacity={isActive ? 0.8 : 0.1}>
                  <animateMotion dur="5s" repeatCount="indefinite" path={edge.path} />
                </circle>
              </g>
            );
          })}
        </svg>

        {graph.nodes.map((node) => {
          const dimmed = relatedNodeIds && !relatedNodeIds.has(node.id);
          const sharedStyle = {
            left: node.x,
            top: node.y,
            borderColor: `${node.accent}66`,
            boxShadow: `0 0 ${node.kind === "center" ? 50 : 24}px ${node.accent}22`,
          };

          if (node.kind === "skill" && node.skill) {
            return (
              <Link
                key={node.id}
                data-web-node
                href={`/skills/${node.skill.slug}`}
                className={`absolute z-20 flex min-h-12 w-36 -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border bg-black/80 px-3 py-2 text-left text-sm text-white shadow-xl backdrop-blur-md transition-all hover:z-40 hover:scale-110 hover:bg-black focus-visible:z-40 focus-visible:scale-110 ${dimmed ? "opacity-20" : "opacity-100"}`}
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
              className={`absolute z-30 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center border bg-black/80 text-center text-white backdrop-blur-xl transition-all hover:z-40 hover:scale-105 focus-visible:z-40 focus-visible:scale-105 ${sizeClasses} ${dimmed ? "opacity-25" : "opacity-100"}`}
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
                  ? "text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-blue-300"
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

      <div
        className={`pointer-events-none absolute bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/10 bg-black/65 px-4 py-2 text-center text-xs text-gray-300 backdrop-blur-md transition-opacity duration-500 sm:bottom-7 ${hasInteracted ? "opacity-0" : "opacity-100"}`}
        aria-hidden="true"
      >
        Drag to explore · Scroll or pinch to zoom · Select a branch to focus
      </div>

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
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-400">Alternative view</p>
                <h2 id="skill-directory-title" className="mt-1 text-2xl font-bold">Skill directory</h2>
              </div>
              <button
                type="button"
                onClick={() => setDirectoryOpen(false)}
                className="rounded-full border border-white/15 px-4 py-2 text-sm hover:border-blue-400/50"
                aria-label="Close skill directory"
              >
                Close
              </button>
            </div>

            <div className="grid gap-5 py-7 md:grid-cols-2">
              {data.domains.map((domain) => (
                <section key={domain.slug} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
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
                                className="rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-blue-400/40 hover:text-white"
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
