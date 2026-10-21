"use client";

import { useEffect, useState } from "react";

/** How long the vanish animation runs, matching --vanish-ms's default. */
export const VANISH_MS = 360;

/**
 * Keeps an element on the page long enough for it to leave visibly.
 *
 * `visible` going false does not unmount at once: the element stays for
 * `exitMs` with the `vanish-out` class, then goes. Coming back mid-exit just
 * turns it round. Use `className` on the element and render it while
 * `mounted`.
 *
 * Reduced motion shortens the CSS to a 150ms fade; the element is kept for
 * the full `exitMs` either way, which is invisible once it has faded.
 */
export function usePresence(visible: boolean, exitMs: number = VANISH_MS) {
  const [mounted, setMounted] = useState(visible);
  const [leaving, setLeaving] = useState(false);

  // Adjusted during render, so the frame that makes it visible already has
  // it mounted rather than waiting a commit for an effect.
  if (visible && !mounted) setMounted(true);
  if (visible && leaving) setLeaving(false);
  if (!visible && mounted && !leaving) setLeaving(true);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => {
      setMounted(false);
      setLeaving(false);
    }, exitMs);
    return () => window.clearTimeout(timer);
  }, [leaving, exitMs]);

  return { mounted, leaving, className: leaving ? "vanish-out" : "vanish-in" };
}
