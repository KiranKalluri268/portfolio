"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useActiveSection, useScrollActions, type SectionId } from "@/context/SmoothScrollContext";
import { useAudio } from "@/context/AudioContextProvider";
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

export default function SceneIndicator() {
  const { hasEntered } = useAudio();
  const activeSection = useActiveSection();
  const { scrollToSection, toggleProjectsEndpoint } = useScrollActions();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Render after hydration so the fixed controls can safely portal to body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (hoveredIndex === null) return;
    const updateMouse = (event: PointerEvent) => {
      if (!tooltipRef.current) return;
      tooltipRef.current.style.transform = `translate3d(${event.clientX + 20}px, ${event.clientY + 20}px, 0)`;
    };
    window.addEventListener("pointermove", updateMouse, { passive: true });
    return () => window.removeEventListener("pointermove", updateMouse);
  }, [hoveredIndex]);

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
        <div className="relative flex flex-row justify-between items-center ">

          {/* Dots */}
          {scenes.map((scene) => {
            const isActive = activeSection === scene.id;
            const isHovered = hoveredIndex === scene.index;

            // Size calculation: active > hovered > normal
            const dotSize = 4; // Smaller consistent size

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
                    className="relative rounded-full"
                    style={{
                      width: dotSize,
                      height: dotSize,
                      backgroundColor: isActive ? "#ef4444" : "white", // Red-500 if active, else white
                      boxShadow: isActive
                        ? "0 0 16px 4px rgba(250, 3, 3, 0.9)"
                        : isHovered
                          ? "0 0 10px 2px rgba(255, 255, 255, 0.8)"
                          : "0 0 6px rgba(255, 255, 255, 0.35)",
                    }}
                  >
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </nav>

      {/* Floating Cursor Tooltip */}
        {hoveredIndex !== null && (
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
