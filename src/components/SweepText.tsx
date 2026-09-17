"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import gsap from "gsap";
import { LETTER_DURATION_MS, LETTER_STAGGER_MS, SWEEP_EASE } from "./hero-sweep-timing";

export type SweepDirection = "bottom" | "top";

export interface SweepTextHandle {
  /** Sweeps every letter in from `direction`, left letter first. Resolves
   *  once the last letter has landed. */
  enter: (direction: SweepDirection) => Promise<void>;
  /** Sweeps every letter back out toward `direction`, left letter first -
   *  the same order as enter, so a line that came in from the bottom leaves
   *  toward the bottom as one continuing motion rather than reversing itself. */
  exit: (direction: SweepDirection) => Promise<void>;
}

/** One line of text, split into per-letter spans an imperative handle can
 *  sweep in and out. The letters are the visual layer only - callers that
 *  need the text announced put it in an sr-only sibling, the same way the
 *  typewriter this replaces did.
 *
 *  Splitting happens on every render rather than being memoised on `text`:
 *  the caller swaps `text` and then immediately calls `enter`, and a stale
 *  set of letter refs from the previous word would animate spans that no
 *  longer exist. */
const SweepText = forwardRef<SweepTextHandle, { text: string; className?: string }>(
  function SweepText({ text, className }, ref) {
    const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
    const letters = useMemo(() => Array.from(text), [text]);

    useImperativeHandle(ref, () => ({
      enter(direction) {
        const els = letterRefs.current.filter((el): el is HTMLSpanElement => el !== null);
        if (els.length === 0) return Promise.resolve();
        return new Promise((resolve) => {
          gsap.killTweensOf(els);
          gsap.fromTo(
            els,
            { yPercent: direction === "bottom" ? 120 : -120, opacity: 0 },
            {
              yPercent: 0,
              opacity: 1,
              duration: LETTER_DURATION_MS / 1000,
              ease: SWEEP_EASE,
              stagger: LETTER_STAGGER_MS / 1000,
              onComplete: resolve,
            },
          );
        });
      },
      exit(direction) {
        const els = letterRefs.current.filter((el): el is HTMLSpanElement => el !== null);
        if (els.length === 0) return Promise.resolve();
        return new Promise((resolve) => {
          gsap.killTweensOf(els);
          gsap.to(els, {
            yPercent: direction === "bottom" ? 120 : -120,
            opacity: 0,
            duration: LETTER_DURATION_MS / 1000,
            ease: SWEEP_EASE,
            stagger: LETTER_STAGGER_MS / 1000,
            onComplete: resolve,
          });
        });
      },
    }));

    return (
      <span className={className} aria-hidden="true">
        {letters.map((char, index) =>
          // A space stays a plain, unwrapped character rather than an
          // inline-block one - that is what lets the browser break the line
          // after it. Wrapping it the same as a letter would glue every word
          // into one unbreakable run.
          char === " " ? (
            <span key={index}> </span>
          ) : (
            <span
              key={index}
              ref={(el) => {
                letterRefs.current[index] = el;
              }}
              className="inline-block"
            >
              {char}
            </span>
          ),
        )}
      </span>
    );
  },
);

export default SweepText;
