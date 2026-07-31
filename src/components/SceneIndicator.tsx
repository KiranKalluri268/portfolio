"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useActiveSection, useScrollActions, type SectionId } from "@/context/SmoothScrollContext";
import { useAudio } from "@/context/AudioContextProvider";
import { useCoarsePointer } from "@/hooks/useMediaQuery";
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

export default function SceneIndicator() {
  const { hasEntered } = useAudio();
  const activeSection = useActiveSection();
  const { scrollToSection, toggleProjectsEndpoint } = useScrollActions();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const isCoarsePointer = useCoarsePointer();

  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Render after hydration so the fixed controls can safely portal to body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPortalReady(true);
  }, []);

  useEffect(() => {
    // Touch devices get a tooltip anchored to the dot instead, so there is no
    // pointer to track.
    if (hoveredIndex === null || isCoarsePointer) return;
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
  }, [hoveredIndex, isCoarsePointer]);

  const handleDotClick = (section: SectionId) => {
    if (section === activeSection) {
      if (section === "projects") toggleProjectsEndpoint();
      return;
    }

    scrollToSection(section);
  };

  if (!portalReady || !hasEntered) return null;

  return createPortal(
    <>
      <nav
        className="pointer-events-auto fixed bottom-[calc(3rem+env(safe-area-inset-bottom))] left-1/2 z-[1000] isolate -translate-x-1/2 touch-manipulation rounded-full border border-white/10 bg-black/65 shadow-[0_6px_20px_rgba(0,0,0,0.4)] backdrop-blur-md sm:bottom-auto sm:top-8 sm:border-transparent sm:bg-transparent sm:shadow-none sm:backdrop-blur-none"
        aria-label="Scene navigation indicator"
        role="navigation"
      >
        <div className="relative flex flex-row items-center justify-between">
          {/* Dots */}
          {scenes.map((scene) => {
            const isActive = activeSection === scene.id;
            const isHovered = hoveredIndex === scene.index;

            // Active state changes size as well as colour, so it survives
            // glare, dim displays, and colour-vision deficiency.
            const dotSize = isActive ? 8 : 4;

            return (
              <div key={scene.index} className="relative flex flex-col items-center">
                <button
                  className="relative z-10 flex min-h-9 min-w-9 cursor-pointer items-center justify-center border-none bg-transparent p-3 outline-none sm:min-h-12 sm:min-w-12 sm:p-6"
                  aria-label={`Go to ${scene.name} section${isActive ? " (current)" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => handleDotClick(scene.id)}
                  onMouseEnter={() => setHoveredIndex(scene.index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  type="button"
                >
                  {/* Dot */}
                  <div
                    className="relative rounded-full transition-[width,height,background-color,box-shadow] duration-300 ease-out"
                    style={{
                      width: dotSize,
                      height: dotSize,
                      backgroundColor: isActive ? "var(--color-accent-warm)" : "white",
                      boxShadow: isActive
                        ? "0 0 16px 4px color-mix(in oklab, var(--color-accent-warm-deep) 90%, transparent)"
                        : isHovered
                          ? "0 0 10px 2px rgba(255, 255, 255, 0.8)"
                          : "0 0 6px rgba(255, 255, 255, 0.35)",
                    }}
                  >
                  </div>
                </button>

                {/* Touch devices have no cursor to follow, so the label anchors
                    above its own dot. */}
                {isCoarsePointer && isHovered && (
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
        </div>
      </nav>

      {/* Floating Cursor Tooltip */}
      {!isCoarsePointer && hoveredIndex !== null && (
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
