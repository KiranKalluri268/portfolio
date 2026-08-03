"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useCoarsePointer } from "@/hooks/useMediaQuery";

interface TooltipProps {
  text: string;
  isVisible: boolean;
}

const GAP = 20;

/** Clearance from a tap. Wider than the cursor's, because a fingertip covers
 *  far more of the screen than a pointer does. */
const TOUCH_GAP = 30;

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

    // Controls near the top edge have no room above them. Clamping there put
    // the label straight back on top of the control it names, hiding the very
    // thing being described — the audio toggle's bars vanished behind it — so
    // drop below the finger instead, which is the only clear space left.
    const above = point.y - TOUCH_GAP - offsetHeight;
    const y = isCoarsePointer
      ? above >= GAP
        ? above
        : point.y + TOUCH_GAP
      : point.y + GAP + offsetHeight > window.innerHeight
        ? Math.max(0, point.y - GAP - offsetHeight)
        : point.y + GAP;

    tooltip.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, [isCoarsePointer]);

  // Where the pointer is, remembered at all times rather than only while a
  // label is up. A tap produces no pointermove at all, so the only position the
  // label can use is the one carried by the pointerdown that asked for it —
  // without this it never moved from where it first rendered, the top-left
  // corner of the screen, nowhere near the control that was tapped.
  //
  // Deliberately just two numbers: this runs on every mouse move across the
  // page, so it must not touch the DOM.
  useEffect(() => {
    const remember = (event: PointerEvent) => {
      pointRef.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener("pointermove", remember, { passive: true });
    window.addEventListener("pointerdown", remember, { passive: true });
    return () => {
      window.removeEventListener("pointermove", remember);
      window.removeEventListener("pointerdown", remember);
    };
  }, []);

  // Following the cursor costs a layout read per move, so it is only worth
  // doing while a label is actually on screen. Registered after the listener
  // above, which therefore has the position up to date by the time this runs.
  useEffect(() => {
    if (!isVisible) return;
    const follow = () => place();
    window.addEventListener("pointermove", follow, { passive: true });
    return () => window.removeEventListener("pointermove", follow);
  }, [isVisible, place]);

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
