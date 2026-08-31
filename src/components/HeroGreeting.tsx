"use client";

import { useEffect, useRef, useState } from "react";
import hero from "@/data/hero.json";
import {
  FLY_CUT_AT,
  FLY_EASING,
  FLY_MS,
  FLY_SCALE,
  holdsFor,
  MAX_WIDTH_VW,
  SWELL_HEADROOM,
  swellFor,
} from "./hero-greeting-timing";

type Beat = {
  text: string;
  script: string;
  hold: number;
  scale: number;
  swellMs: number;
  flyOrigin: string;
};

/** The two groups in the content file say only what a greeting *is* — the
 *  opening ones are plain Latin, the Indian ones carry their own script and
 *  the last carries the aiming point for the fly. Neither says anything about
 *  pace or size: both of those are curves sampled across the whole run, so a
 *  greeting added to either group is just one more point on them, and the
 *  swell no longer starts wherever the file happens to change group. */
const GREETINGS = [
  ...hero.greetingCycle.opening.map((text) => ({
    text,
    script: "latin",
    flyOrigin: "50% 50%",
  })),
  ...hero.greetingCycle.indian.map((entry) => ({
    text: entry.text,
    script: entry.script,
    // Only the last greeting is ever flown through, so only it needs an aiming
    // point. The rest keep the centre so an accidental fly reads sanely.
    flyOrigin: ("flyOrigin" in entry && entry.flyOrigin) || "50% 50%",
  })),
];

const HOLDS = holdsFor(GREETINGS.length);

const BEATS: Beat[] = GREETINGS.map((entry, index) => {
  const swell = swellFor(index, GREETINGS.length);
  return {
    ...entry,
    hold: HOLDS[index],
    scale: swell.scale,
    // Not the same as the hold on the last word, which keeps growing into the
    // push rather than stopping to wait for it.
    swellMs: swell.duration,
  };
});

/** Tektur has no Indic coverage, so each script names its own face first and
 *  falls back to Tektur for the Latin beats. */
function fontStackFor(script: string) {
  if (script === "latin") return "var(--font-tektur), sans-serif";
  return `var(--font-greeting-${script}), var(--font-tektur), sans-serif`;
}

/** Built from the same constants the rest of the fly reads, so the keyframes
 *  cannot drift from FLY_SCALE. */
const FLY_KEYFRAMES = `
@keyframes hero-greeting-fly {
  from { transform: scale(1); }
  to { transform: scale(${FLY_SCALE}); }
}
@keyframes hero-greeting-cut {
  from { opacity: 1; }
  to { opacity: 0; }
}`;

/**
 * The entry greeting: a stack of hellos flicked through, braking and growing
 * into the Indian ones, then a push through a gap in the last of them that
 * hands the headline over to the name.
 *
 * It draws in its own full-bleed layer rather than inside the headline,
 * because the fly-through has to grow past the edges of the screen — the hero
 * section clips it. `onDone` fires once, when the push has finished.
 */
export default function HeroGreeting({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [flying, setFlying] = useState(false);
  const beat = BEATS[index];
  const isLast = index === BEATS.length - 1;

  // onDone is called from a timer that must not be restarted when the parent
  // re-renders with a fresh closure, which it does on every typed character.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (flying) return;
    const timer = setTimeout(() => {
      if (isLast) setFlying(true);
      else setIndex((current) => current + 1);
    }, beat.hold);
    return () => clearTimeout(timer);
    // `index` is what actually changes from one beat to the next. Without it
    // the fast greetings, which share a hold and are none of them last, give
    // this effect an identical dependency list every time and it never re-runs
    // - the sequence advances once and sticks on the second word.
  }, [index, beat.hold, isLast, flying]);

  useEffect(() => {
    if (!flying) return;
    const timer = setTimeout(() => onDoneRef.current(), FLY_MS);
    return () => clearTimeout(timer);
  }, [flying]);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 grid place-items-center px-4"
      aria-hidden="true"
    >
      <style>{FLY_KEYFRAMES}</style>
      <span
        className="whitespace-nowrap font-bold leading-none text-white"
        style={{
          fontFamily: fontStackFor(beat.script),
          // The clamp is the headline's own ramp; the second term is the
          // narrow-screen ceiling, divided by the swell's headroom so it bounds
          // the base rather than the grown word - see MAX_WIDTH_VW. Above about
          // 1130px it never binds and this is the headline's size exactly.
          fontSize: `calc(min(clamp(2.25rem, 10vw, 6rem), ${(
            MAX_WIDTH_VW / SWELL_HEADROOM
          ).toFixed(2)}vw) * ${beat.scale})`,
          textShadow:
            "0.1rem 0 0.3rem rgba(255, 255, 255, 0.8), 0 0 0.6rem rgba(224, 69, 10, 0.5)",
          transformOrigin: beat.flyOrigin,
          willChange: "transform, opacity, font-size",
          // Font size eases across the whole of the beat it is growing into, so
          // the swell is continuous and only the words are stepped.
          transition: flying
            ? undefined
            : `font-size ${beat.swellMs}ms linear`,
          // An animation, not a transition. A transition needs its start value
          // painted in an earlier frame than its end value, which meant a state
          // flip and two rAFs before the push could begin - and the swell had
          // already stopped growing by then, so the word hung still for about
          // 150ms right at the moment it should have been accelerating. An
          // animation runs from its own first keyframe on the commit that
          // applies it.
          animation: flying
            ? `hero-greeting-fly ${FLY_MS}ms ${FLY_EASING} forwards, ` +
              // step-start holds the keyframe's end value for the whole
              // duration, so this is a switch thrown once at the delay rather
              // than a fade run over it.
              `hero-greeting-cut ${FLY_MS * (1 - FLY_CUT_AT)}ms step-start ` +
              `${FLY_MS * FLY_CUT_AT}ms forwards`
            : undefined,
        }}
      >
        {beat.text}
      </span>
    </div>
  );
}
