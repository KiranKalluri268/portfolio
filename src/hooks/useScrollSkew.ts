"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useOptionalScrollActions } from "@/context/SmoothScrollContext";
import { useReducedMotion } from "./useMediaQuery";

/** Leaning a section into the scroll, by how fast it is moving.
 *
 * Everything else animating on this page is scrubbed off scroll *position* —
 * About's words, Experience's scaling, the pinned carousel. Position-driven
 * motion reads as a diagram being scrubbed. This is the one thing that reads as
 * mass: the amount of lean is the speed, and it is zero when nothing moves.
 *
 * It is the projects list view's bow, in two dimensions and on DOM. That view
 * feels the way it does mostly because of this one idea, and nothing on the
 * home page had it.
 */

/** Degrees of lean per unit of Lenis velocity, and the most it may ever reach.
 *
 *  Small on purpose. This shears text a visitor may be part-way through
 *  reading, so it wants to be felt rather than seen — past about five degrees
 *  it stops reading as weight and starts reading as a broken transform.
 *
 *  Calibrated against measured velocities rather than guessed. On this page a
 *  single wheel tick peaks around 12 px per 60Hz frame, an ordinary scroll
 *  around 30, and a hard flick around 98. The first value tried was 0.32, at
 *  which one tick already pinned the clamp — so every gesture drew the same
 *  four degrees and the lean carried no information about speed at all, which
 *  is the entire point of it. */
const DEGREES_PER_VELOCITY = 0.055;
const MAX_DEGREES = 4;

/** What a second of easing leaves of the gap between the lean being drawn and
 *  the one the current speed asks for.
 *
 *  Per second, not per frame, for the same reason the rest of the site's
 *  easings are: eased per frame this would lean twice as hard on a 120Hz screen
 *  and barely at all on a device dropping frames. */
const SETTLE_PER_SECOND = 0.0000001;

/** Below this the section is treated as still and pinned flat, so a velocity
 *  too small to see cannot leave a permanent fraction of a degree behind. */
const STILL = 0.01;

/** Leans the returned element with the scroll. Attach it to something no other
 *  animation transforms — GSAP already owns the transform on `.project-panel`
 *  and `.experience-card-scale`, and two systems writing one property is a
 *  documented way to lose an afternoon. */
export function useScrollSkew<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const lenis = useOptionalScrollActions()?.lenis ?? null;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const element = ref.current;
    if (!element || !lenis) return;

    // Nothing to lean under reduced motion, and nothing left leaning either:
    // whatever it was mid-gesture is cleared rather than frozen.
    if (reduceMotion) {
      gsap.set(element, { skewY: 0 });
      return;
    }

    const setSkew = gsap.quickSetter(element, "skewY", "deg") as (value: number) => void;
    let drawn = 0;

    const frame = () => {
      // 1 at 60Hz, 0.5 at 120Hz. Lenis measures velocity per frame, so on a
      // faster screen the same gesture reports a smaller number.
      const deltaRatio = gsap.ticker.deltaRatio(60);
      const velocity = lenis.velocity / deltaRatio;
      const wanted =
        Math.abs(velocity) < STILL
          ? 0
          : gsap.utils.clamp(-MAX_DEGREES, MAX_DEGREES, velocity * DEGREES_PER_VELOCITY);

      const ease = 1 - SETTLE_PER_SECOND ** (gsap.ticker.deltaRatio(60) / 60);
      drawn += (wanted - drawn) * ease;
      if (Math.abs(drawn) < 0.001 && wanted === 0) drawn = 0;
      setSkew(drawn);
    };

    gsap.ticker.add(frame);
    return () => {
      gsap.ticker.remove(frame);
      gsap.set(element, { skewY: 0 });
    };
  }, [lenis, reduceMotion]);

  return ref;
}
