"use client";

import { useEffect, useRef } from "react";
import { useAudio } from "@/context/AudioContextProvider";
import { SECTION_IDS, useScrollActions, type SectionId } from "@/context/SmoothScrollContext";
import { readOneOf } from "@/lib/deep-link";

/** How long to keep waiting for the page to be released before giving up. The
 *  visitor is then simply at the top of the page, which is a fine place to be —
 *  better than a scroll arriving minutes later out of nowhere. */
const UNLOCK_TIMEOUT_MS = 5000;

/** Sends an arriving visitor to the section a link named.
 *
 * `?section=skills` rather than `#skills`, because the home page cannot honour
 * a fragment: the browser acts on one the moment the document is ready, which
 * here is while the entry screen is still up and the page is held still. The
 * scroll is swallowed, and nothing ever tries again. A parameter is inert,
 * which lets the wait be deliberate.
 *
 * Two things have to be true before it can move: the visitor has to have gone
 * through the entry screen, which is what releases the page, and Lenis has to
 * exist, since it owns scrolling on this route. Both are waited for rather than
 * assumed.
 *
 * Read once, on arrival. Afterwards the page is the visitor's; the scene dots
 * already show where they are, and re-reading the parameter would drag them
 * back to it.
 */
export default function SectionLink() {
  const { hasEntered } = useAudio();
  const { lenis, scrollToSection } = useScrollActions();
  const wanted = useRef<SectionId | null>(null);
  const done = useRef(false);

  useEffect(() => {
    wanted.current = readOneOf("section", SECTION_IDS);
  }, []);

  useEffect(() => {
    if (done.current || !hasEntered || !lenis) return;
    const section = wanted.current;
    if (!section) return;
    done.current = true;

    // Entering and being released are not the same moment. The entry screen
    // flips `hasEntered` first and holds the page still until its exit
    // animation has finished, and a stopped Lenis ignores scrollTo outright —
    // so a scroll issued on the flag is swallowed and never retried. This
    // waits for the lock itself to lift.
    const deadline = performance.now() + UNLOCK_TIMEOUT_MS;
    let frame = 0;
    const attempt = () => {
      if (!lenis.isStopped) {
        scrollToSection(section);
        return;
      }
      if (performance.now() > deadline) return;
      frame = requestAnimationFrame(attempt);
    };
    frame = requestAnimationFrame(attempt);
    return () => cancelAnimationFrame(frame);
  }, [hasEntered, lenis, scrollToSection]);

  return null;
}
