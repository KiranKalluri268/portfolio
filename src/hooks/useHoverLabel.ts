"use client";

import { useEffect, useState } from "react";
import { useCoarsePointer } from "./useMediaQuery";

/** How long a tapped control's label stays up. Long enough to read, and gone
 *  before it can be mistaken for part of the page. */
export const TOUCH_LABEL_MS = 1600;

/**
 * Hover state for a control that shows a label, safe on touch.
 *
 * A tap fires the browser's synthesised `mouseenter`, but no `mouseleave` ever
 * follows it — there is no cursor to move away — so a label set on hover stayed
 * on screen indefinitely, outliving even a scroll to another section, until
 * some unrelated element happened to take the hover.
 *
 * On coarse pointers the label now dismisses itself. Pointer devices are left
 * alone, since a real `mouseleave` already clears them and a timeout there
 * would snatch the label away from someone still reading it.
 */
export function useHoverLabel<T>(dismissMs: number = TOUCH_LABEL_MS) {
  const [hovered, setHovered] = useState<T | null>(null);
  const isCoarsePointer = useCoarsePointer();

  useEffect(() => {
    if (!isCoarsePointer || hovered === null) return;
    const timer = window.setTimeout(() => setHovered(null), dismissMs);
    return () => window.clearTimeout(timer);
  }, [isCoarsePointer, hovered, dismissMs]);

  return [hovered, setHovered] as const;
}
