"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useCoarsePointer } from "@/hooks/useMediaQuery";

interface TooltipProps {
  text: string;
  isVisible: boolean;
}

const GAP = 20;

export default function Tooltip({ text, isVisible }: TooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const pointRef = useRef<{ x: number; y: number } | null>(null);
  const isCoarsePointer = useCoarsePointer();

  const place = useCallback(() => {
    const tooltip = tooltipRef.current;
    const point = pointRef.current;
    if (!tooltip || !point) return;
    const { offsetWidth, offsetHeight } = tooltip;

    // A finger covers what it taps, so the label goes above it and centred on
    // it. A cursor does not, so it keeps sitting beside the pointer, flipping
    // to the other side rather than running off-screen.
    const x = isCoarsePointer
      ? Math.min(
          Math.max(GAP, point.x - offsetWidth / 2),
          Math.max(GAP, window.innerWidth - offsetWidth - GAP),
        )
      : point.x + GAP + offsetWidth > window.innerWidth
        ? Math.max(0, point.x - GAP - offsetWidth)
        : point.x + GAP;
    const y = isCoarsePointer
      ? Math.max(GAP, point.y - GAP - offsetHeight)
      : point.y + GAP + offsetHeight > window.innerHeight
        ? Math.max(0, point.y - GAP - offsetHeight)
        : point.y + GAP;

    tooltip.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, [isCoarsePointer]);

  // Track the pointer at all times, not only while a label is up. A tap
  // produces no pointermove at all, so the only position the label can use is
  // the one carried by the pointerdown that asked for it. Without this it never
  // moved from where it first rendered — the top-left corner of the screen,
  // nowhere near the control that was tapped.
  useEffect(() => {
    const remember = (event: PointerEvent) => {
      pointRef.current = { x: event.clientX, y: event.clientY };
      place();
    };
    window.addEventListener("pointermove", remember, { passive: true });
    window.addEventListener("pointerdown", remember, { passive: true });
    return () => {
      window.removeEventListener("pointermove", remember);
      window.removeEventListener("pointerdown", remember);
    };
  }, [place]);

  // Placed before the paint that reveals it, so it is never seen in the corner
  // on its way to the right spot.
  useLayoutEffect(() => {
    if (isVisible) place();
  }, [isVisible, place]);

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
