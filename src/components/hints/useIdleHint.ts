"use client";

import { useEffect, useRef, useState } from "react";
import type { HintId, InputMode } from "./hint-copy";

/** How long a visitor may sit in one place before the pill offers a way on.
 *  Long enough that anyone who knows what they are doing never sees it. */
export const IDLE_HINT_MS = 3500;

/** Reveals a hint once the visitor has stalled on it, and never again.
 *
 * The timer measures time spent on one hint rather than time since the last
 * event, because "idle" here means "has not done the thing this scene is
 * waiting for" — a visitor can be busy reading and still be stuck.
 *
 * Returns the hint that is currently on screen (which lingers through the fade
 * after the scene has moved on) alongside whether it should be visible.
 */
export function useIdleHint(hintId: HintId | null, delayMs: number = IDLE_HINT_MS) {
  const [revealed, setRevealed] = useState<HintId | null>(null);
  const retired = useRef<Set<HintId>>(new Set());

  useEffect(() => {
    if (!hintId || retired.current.has(hintId)) return;
    const timer = window.setTimeout(() => setRevealed(hintId), delayMs);
    return () => window.clearTimeout(timer);
  }, [hintId, delayMs]);

  // Once a hint has been shown and the visitor has moved past it, it has done
  // its job. Showing it a second time would be nagging someone who by then has
  // demonstrated they know the way around.
  useEffect(() => {
    if (revealed && revealed !== hintId) retired.current.add(revealed);
  }, [revealed, hintId]);

  return { hint: revealed, visible: revealed !== null && revealed === hintId };
}

/** Whether the visitor is using touch or a pointer, so a hint can name the
 *  gesture that actually works.
 *
 * Starts from the media query at mount, then follows real events: a laptop
 * with a touchscreen reports coarse pointer support but is usually driven by
 * the trackpad, and the reverse happens when a tablet has a keyboard attached.
 */
export function useInputMode(): InputMode {
  const [mode, setMode] = useState<InputMode>("pointer");

  useEffect(() => {
    // Browser-only, and the server has no way to know which this is, so the
    // first correct value can only be set after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) setMode("touch");

    const onPointerDown = (event: PointerEvent) =>
      setMode(event.pointerType === "touch" ? "touch" : "pointer");
    const onKeyDown = () => setMode("pointer");
    const onWheel = () => setMode("pointer");

    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("keydown", onKeyDown, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("wheel", onWheel);
    };
  }, []);

  return mode;
}
