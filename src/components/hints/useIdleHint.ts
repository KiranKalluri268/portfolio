"use client";

import { useEffect, useState } from "react";
import type { HintId, InputMode } from "./hint-copy";

/** How long a visitor may sit in one place before the pill offers a way on.
 *  Long enough that anyone who knows what they are doing never sees it. */
export const IDLE_HINT_MS = 3500;

/** Reveals a hint once the visitor has stalled on the scene it belongs to.
 *
 * The timer measures time spent on one hint rather than time since the last
 * event, because "idle" here means "has not done the thing this scene is
 * waiting for" — a visitor can be busy reading and still be stuck.
 *
 * Every arrival at a scene is its own offer: leave, come back, pause again and
 * the hint is there again. Hints used to retire for the whole visit, which
 * read as the pill being broken — pause anywhere on a second pass through the
 * page and nothing ever appeared.
 *
 * Returns the hint to display, which lingers after the scene has moved on so
 * the pill fades out with its own text rather than blanking mid-transition.
 */
export function useIdleHint(hintId: HintId | null, delayMs: number = IDLE_HINT_MS) {
  const [offered, setOffered] = useState<HintId | null>(null);
  const [displayed, setDisplayed] = useState<HintId | null>(null);
  const [previousHintId, setPreviousHintId] = useState<HintId | null>(hintId);

  // Reset during render rather than in an effect — the offer belongs to the
  // scene that earned it, so arriving anywhere new has to withdraw it before
  // anything paints. Without this, returning to the last scene that showed a
  // hint would flash it back instantly with no wait at all.
  if (previousHintId !== hintId) {
    setPreviousHintId(hintId);
    setOffered(null);
  }

  useEffect(() => {
    if (!hintId) return;
    const timer = window.setTimeout(() => {
      setOffered(hintId);
      setDisplayed(hintId);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [hintId, delayMs]);

  return { hint: displayed, visible: offered !== null && offered === hintId };
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
