"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    const read = () => {
      const trigger = ScrollTrigger.getById("projects-horizontal-pin");
      if (!trigger) return;
      const progress = Math.min(1, Math.max(0, trigger.progress));
      setCarousel((previous) => {
        const next = carouselFacts(progress, projectCount, previous?.hasAdvanced ?? false);
        // Same object unless a fact actually flipped, so scrolling the pinned
        // section does not re-render the pill on every frame.
        if (previous && previous.atEnd === next.atEnd && previous.hasAdvanced === next.hasAdvanced) {
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
