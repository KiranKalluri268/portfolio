"use client";

import { useEffect, useRef } from "react";

interface TooltipProps {
  text: string;
  isVisible: boolean;
}

const GAP = 20;

export default function Tooltip({ text, isVisible }: TooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVisible) return;
    const updateMouse = (event: PointerEvent) => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;
      // Flip to the other side of the cursor rather than running off-screen.
      const { offsetWidth, offsetHeight } = tooltip;
      const x = event.clientX + GAP + offsetWidth > window.innerWidth
        ? Math.max(0, event.clientX - GAP - offsetWidth)
        : event.clientX + GAP;
      const y = event.clientY + GAP + offsetHeight > window.innerHeight
        ? Math.max(0, event.clientY - GAP - offsetHeight)
        : event.clientY + GAP;
      tooltip.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    window.addEventListener("pointermove", updateMouse, { passive: true });
    return () => window.removeEventListener("pointermove", updateMouse);
  }, [isVisible]);

  return (
    <div
      ref={tooltipRef}
      aria-hidden={!isVisible}
      style={{ left: 0, top: 0, zIndex: 9999 }}
      className={`fixed pointer-events-none whitespace-nowrap text-white text-sm font-semibold tracking-wide bg-black/40 px-2 py-1 rounded-md backdrop-blur-md border border-white/10 transition-[opacity,transform] duration-150 ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-80"}`}
    >
      {text}
    </div>
  );
}
