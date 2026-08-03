"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import HintPill from "./hints/HintPill";
import { useIdleHint, useInputMode } from "./hints/useIdleHint";
import {
  carouselFacts,
  hintText,
  resolveHomepageHint,
  type CarouselFacts,
} from "./hints/hint-copy";
import { useActiveSection, useScrollActions } from "@/context/SmoothScrollContext";
import { useAudio } from "@/context/AudioContextProvider";

/** Tells the visitor what they can do in the scene they have stalled in.
 *
 * Reads the pinned carousel's own ScrollTrigger rather than taking state from
 * the projects section, so the two stay independent — the carousel does not
 * have to know a hint exists. */
export default function NavigationHint({ projectCount }: { projectCount: number }) {
  const section = useActiveSection();
  const { lenis } = useScrollActions();
  const inputMode = useInputMode();
  // Nobody is stuck while the loading screen is still up. Without this the
  // idle timer runs behind it and the hero hint is already on screen the
  // moment the visitor arrives.
  const { hasEntered } = useAudio();
  const [carousel, setCarousel] = useState<CarouselFacts | null>(null);

  // Arriving in the section starts a fresh baseline for "have they moved it?".
  // Without this, landing mid-carousel — a restored scroll position, a shared
  // link — reads as a swipe the visitor never made, and the hint they actually
  // needed never appears.
  const needsBaseline = useRef(true);
  useEffect(() => {
    if (section === "projects") needsBaseline.current = true;
  }, [section]);

  useEffect(() => {
    const read = () => {
      const trigger = ScrollTrigger.getById("projects-horizontal-pin");
      if (!trigger) return;
      const progress = Math.min(1, Math.max(0, trigger.progress));
      // Read and clear before the updater, which has to stay pure.
      const fromScratch = needsBaseline.current;
      needsBaseline.current = false;
      setCarousel((previous) => {
        const next = carouselFacts(progress, projectCount, fromScratch ? null : previous);
        // Same object unless a fact actually flipped, so scrolling the pinned
        // section does not re-render the pill on every frame. A fresh baseline
        // always has to be kept, even when neither fact changed with it.
        if (
          !fromScratch &&
          previous &&
          previous.atEnd === next.atEnd &&
          previous.hasAdvanced === next.hasAdvanced
        ) {
          return previous;
        }
        return next;
      });
    };

    // The trigger is created in a layout effect elsewhere, so give it a frame.
    const initial = requestAnimationFrame(read);
    lenis?.on("scroll", read);
    return () => {
      cancelAnimationFrame(initial);
      lenis?.off("scroll", read);
    };
  }, [lenis, projectCount]);

  const { hint, visible } = useIdleHint(
    hasEntered ? resolveHomepageHint({ section, carousel }) : null,
  );

  return <HintPill text={hint ? hintText(hint, inputMode) : ""} visible={visible} />;
}
