"use client";

import { useState, useEffect, useRef } from "react";
import { useScrollActions } from "@/context/SmoothScrollContext";
import { useAudio } from "@/context/AudioContextProvider";
import { ENTRY_RELEASE_MS } from "./entry-timing";
import { useReducedMotion } from "@/hooks/useMediaQuery";
import HeroGreeting from "./HeroGreeting";
import SweepText, { type SweepDirection, type SweepTextHandle } from "./SweepText";
import { ROLE_HOLD_MS } from "./hero-sweep-timing";
import hero from "@/data/hero.json";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export default function Hero() {
  const { scrollNext, scrollToSection } = useScrollActions();
  const { hasEntered } = useAudio();
  const reduceMotion = useReducedMotion();

  /** The headline sweeps itself in, and for the first couple of seconds after
   *  Enter the entry screen is still over it — so it would perform to a closed
   *  curtain. It waits for the moment the curtain starts opening instead.
   *
   *  Only when the entry screen was actually used: arriving here from another
   *  page, hasEntered is already true at mount and there is nothing to wait
   *  for. */
  const [curtainOpening, setCurtainOpening] = useState(hasEntered);

  useEffect(() => {
    if (curtainOpening || !hasEntered) return;
    const timer = setTimeout(() => setCurtainOpening(true), reduceMotion ? 0 : ENTRY_RELEASE_MS);
    return () => clearTimeout(timer);
  }, [hasEntered, curtainOpening, reduceMotion]);

  // Two slots rather than one, so the next role can sweep in while the
  // current one is still sweeping out - the pause between them was the
  // outgoing role's whole exit playing to completion before the incoming one
  // was even asked to start.
  const [slotTexts, setSlotTexts] = useState<[string, string]>([hero.roles[0], hero.roles[0]]);

  /** The greeting is the entry gate's payoff, so it is only spent on someone
   *  who went through the gate. `hasEntered` is already true at mount when the
   *  visitor is coming back to the home page from elsewhere on the site; that
   *  arrival starts at the name instead. (The old NAMASTE intro replayed on
   *  those returns; a four-and-a-half second one would be a toll booth.) */
  const [h1State, setH1State] = useState<'greeting' | 'entering' | 'done'>(() =>
    hasEntered ? 'entering' : 'greeting',
  );

  const heroRef = useRef<HTMLDivElement>(null);
  const namePrefixRef = useRef<SweepTextHandle>(null);
  const nameRef = useRef<SweepTextHandle>(null);
  const roleRefA = useRef<SweepTextHandle>(null);
  const roleRefB = useRef<SweepTextHandle>(null);
  const rolesLoopStarted = useRef(false);

  const visibleH1State = reduceMotion ? "done" : h1State;
  // The container's position and size settle the instant the name starts
  // sweeping in, not once it finishes - so the letters land smoothly into a
  // headline that is already moving to its place, rather than arriving
  // centred at full size and only then resizing out from under themselves.
  const nameSettled = reduceMotion || h1State !== 'greeting';

  // Sweep the name in once, the moment the curtain has cleared it.
  useEffect(() => {
    if (!curtainOpening || reduceMotion || h1State !== 'entering') return;
    let cancelled = false;

    Promise.all([namePrefixRef.current?.enter('bottom'), nameRef.current?.enter('bottom')]).then(
      () => {
        if (!cancelled) setH1State('done');
      },
    );

    return () => {
      cancelled = true;
    };
  }, [curtainOpening, reduceMotion, h1State]);

  // The role line loops: one role sweeps in, holds, and the next sweeps in
  // right on top of it while it sweeps back out the way it came - the two
  // run together rather than one waiting for the other to finish, which is
  // what made the swap read as a pause. A role's own exit always matches the
  // direction it entered with (arrived from the bottom, leaves toward the
  // bottom), and the direction flips on every swap - the outgoing role and
  // the incoming one move in opposite semantic directions but the same way
  // on screen (both sliding down, or both sliding up), which is what makes
  // the overlap read as one continuous motion rather than two crossing.
  useEffect(() => {
    if (!curtainOpening || reduceMotion || h1State !== 'done' || rolesLoopStarted.current) return;
    rolesLoopStarted.current = true;
    let cancelled = false;
    const roleRefs = [roleRefA, roleRefB] as const;

    async function loop() {
      let roleIndex = 0;
      let active = 0;
      let direction: SweepDirection = 'bottom';

      await nextFrame();
      if (cancelled) return;
      await roleRefs[active].current?.enter(direction);

      while (!cancelled) {
        await wait(ROLE_HOLD_MS);
        if (cancelled) return;

        const exitDirection = direction;
        const enterDirection: SweepDirection = direction === 'bottom' ? 'top' : 'bottom';
        const next = active === 0 ? 1 : 0;
        roleIndex = (roleIndex + 1) % hero.roles.length;
        const nextRole = hero.roles[roleIndex];

        setSlotTexts((previous) => {
          const updated: [string, string] = [...previous];
          updated[next] = nextRole;
          return updated;
        });
        await nextFrame();
        if (cancelled) return;

        await Promise.all([
          roleRefs[next].current?.enter(enterDirection),
          roleRefs[active].current?.exit(exitDirection),
        ]);

        active = next;
        direction = enterDirection;
      }
    }

    loop();
    return () => {
      cancelled = true;
    };
  }, [curtainOpening, reduceMotion, h1State]);

  return (
    <section
      ref={heroRef}
      className="relative h-[100dvh] min-h-[100svh] w-full overflow-hidden"
      id="hero"
      aria-label="Hero section - Introduction"
      style={{ zIndex: 10 }}
    >
      {/* The greeting is the whole headline until it has finished: it draws
          full-bleed so the push through the final letter can grow past the
          edges of the screen, which the section's overflow clips. */}
      {curtainOpening && !reduceMotion && visibleH1State === 'greeting' && (
        <HeroGreeting onDone={() => setH1State('entering')} />
      )}

      <div className="relative w-full h-full text-white">
        <div
          data-settled={nameSettled}
          className={`hero-copy absolute left-1/2 w-full max-w-5xl -translate-x-1/2 px-[clamp(1.25rem,7vw,4.5rem)] pt-8 text-left transition-all duration-1000 ease-in-out sm:px-8 sm:pt-0 lg:px-0 ${nameSettled ? 'top-[20dvh] translate-y-0' : 'top-1/2 -translate-y-1/2'
            }`}
        >
          <h1
            className="font-bold font-[family-name:var(--font-tektur)] leading-none overflow-hidden"
            style={{
              textShadow:
                "0.1rem 0 0.3rem rgba(255, 255, 255, 0.8), 0 0 0.6rem rgba(224, 69, 10, 0.5)",
            }}
          >
            {/* The visible lines sweep in letter by letter; a screen reader gets
                the whole name as plain, static text instead. */}
            <span className="sr-only">{`${hero.namePrefix} ${hero.name}`}</span>
            <span
              className={`block transition-all duration-1000 ease-in-out ${nameSettled
                ? "text-[clamp(2.1rem,9vw,4.5rem)]"
                : "text-[clamp(3rem,13vw,8rem)]"
                }`}
            >
              {reduceMotion ? (
                hero.namePrefix
              ) : (
                <SweepText ref={namePrefixRef} text={hero.namePrefix} />
              )}
            </span>
            <span
              className={`block transition-all duration-1000 ease-in-out ${nameSettled
                ? "text-[clamp(2.7rem,11vw,6rem)]"
                : "text-[clamp(3rem,13vw,8rem)]"
                }`}
            >
              {reduceMotion ? hero.name : <SweepText ref={nameRef} text={hero.name} />}
            </span>
          </h1>

          {/* The role line loops between one and two lines as it cycles.
              Reserving two lines keeps the CTA row below from bouncing. */}
          <h2
            className="hero-role mt-4 min-h-[calc(2*clamp(2.15rem,10vw,7.5rem))] max-w-full text-[clamp(2.15rem,10vw,7.5rem)] font-bold font-[family-name:var(--font-tektur)] leading-none overflow-hidden"
            style={{
              // The name above can carry a white halo because white has 21:1 of
              // contrast to spend. The role line is coloured and has far less,
              // so a tinted, tighter glow keeps the letterforms crisp at phone
              // size instead of blooming into them.
              textShadow: "0 0 0.45rem rgba(224, 69, 10, 0.55)",
            }}
          >
            {/* The visible line sweeps in and out; assistive technology gets
                the full set of roles as static text instead, so the loop does
                not fire an announcement every time it turns over. */}
            <span className="sr-only">{hero.roles.join(", ")}</span>
            {reduceMotion ? (
              <span className="text-accent">{hero.roles[0]}</span>
            ) : (
              <span className="relative block w-full text-accent">
                <SweepText ref={roleRefA} text={slotTexts[0]} groupByWord className="absolute left-0 top-0 w-full" />
                <SweepText ref={roleRefB} text={slotTexts[1]} groupByWord className="absolute left-0 top-0 w-full" />
              </span>
            )}
          </h2>

          <div
            className={`hero-cta mt-8 flex flex-row flex-wrap items-center gap-3 transition-[opacity,transform] duration-700 ease-out sm:gap-4 ${visibleH1State === 'done'
              ? 'translate-y-0 opacity-100'
              : 'pointer-events-none translate-y-3 opacity-0'
              }`}
          >
            <button
              type="button"
              onClick={() => scrollToSection('projects')}
              className="rounded-full border border-white/25 bg-black/40 px-6 py-3 text-center text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:border-accent hover:text-accent-soft sm:text-base"
            >
              View my work
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('contact')}
              className="rounded-full border border-white/25 bg-black/40 px-6 py-3 text-center text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:border-accent hover:text-accent-soft sm:text-base"
            >
              Get in touch
            </button>
          </div>
        </div>
      </div>

      {/* The scroll cue used to live here as its own two-line label. It is now
          one of the scenes NavigationHint speaks for, so that every "what do I
          do here?" answer on the page looks and behaves the same. */}
      <button
        type="button"
        className="scroll-hint absolute bottom-[env(safe-area-inset-bottom)] left-1/2 z-20 flex -translate-x-1/2 cursor-pointer items-center justify-center rounded bg-transparent p-2 text-white/50 transition-colors hover:text-white sm:bottom-1"
        onClick={scrollNext}
        aria-label="Scroll down"
      >
        <svg
          className="h-4 w-4 sm:h-6 sm:w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </button>
    </section >
  );
}
