"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { flushSync } from "react-dom";
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
  const { hasEntered, entrySkipped } = useAudio();
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
    if (curtainOpening || !hasEntered || entrySkipped) return;
    const timer = setTimeout(() => setCurtainOpening(true), reduceMotion ? 0 : ENTRY_RELEASE_MS);
    return () => clearTimeout(timer);
  }, [hasEntered, curtainOpening, reduceMotion, entrySkipped]);

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

  /** `entrySkipped` lands one tick after mount — sessionStorage cannot be
   *  read during render — so it always arrives after h1State's own lazy
   *  initializer above already committed to 'greeting'. This is the
   *  correction: a gate that never played has nothing for the greeting to
   *  be the payoff of, so it is skipped exactly like a same-session return
   *  to Home. */
  useEffect(() => {
    if (!entrySkipped) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurtainOpening(true);
    setH1State((current) => (current === 'greeting' ? 'entering' : current));
  }, [entrySkipped]);

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

        // Forced synchronous rather than the usual batched commit: enter()
        // below reads letterRefs off the newly-mounted letters immediately
        // after, and needs React to have actually attached them by then. A
        // plain setState here only queues the render - on a busy main thread
        // (this page runs a WebGL scene alongside it) React can take more
        // than the one requestAnimationFrame this used to wait before
        // committing, and whichever letters had not been ref'd yet were
        // silently dropped from the tween and stayed at their default
        // opacity-0 forever - not a stray frame, a letter that never arrives.
        flushSync(() => {
          setSlotTexts((previous) => {
            const updated: [string, string] = [...previous];
            updated[next] = nextRole;
            return updated;
          });
        });
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
          className={`hero-copy @container absolute left-1/2 w-full max-w-5xl -translate-x-1/2 px-[clamp(1.25rem,7vw,4.5rem)] pt-8 text-left transition-all duration-1000 ease-in-out sm:px-8 sm:pt-0 lg:px-0 ${nameSettled ? 'top-[20dvh] translate-y-0' : 'top-1/2 -translate-y-1/2'
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
              className={`block whitespace-nowrap transition-all duration-1000 ease-in-out ${nameSettled
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
              className={`block whitespace-nowrap transition-all duration-1000 ease-in-out ${nameSettled
                ? "text-[clamp(1.8rem,8vw,6rem)]"
                : "text-[clamp(3rem,13vw,8rem)]"
                }`}
            >
              {reduceMotion ? hero.name : <SweepText ref={nameRef} text={hero.name} />}
            </span>
          </h1>

          {/* Sized to the line's own width (the copy block is the container) so
              the longest role, FULL-STACK DEVELOPER at about 11.7em, sits on
              one row: two rows held for it left a row of empty space under
              every shorter role. The height is not reserved here at all; it
              comes from the invisible copies of every role below, so a longer
              role added later reserves two rows rather than being clipped. */}
          <h2
            className="hero-role mt-4 max-w-full text-[min(7.5rem,calc(100cqw/11.9))] font-bold font-[family-name:var(--font-tektur)] leading-none overflow-hidden"
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
              <span className="relative grid w-full text-accent">
                {/* Every role, laid out invisibly in one cell, so the line is as
                    tall as the tallest of them. The two animated slots are
                    absolutely positioned so they can cross, and give the line
                    no height of their own. */}
                {hero.roles.map((role) => (
                  <SweepText key={role} text={role} groupByWord className="invisible col-start-1 row-start-1" />
                ))}
                <SweepText ref={roleRefA} text={slotTexts[0]} groupByWord className="absolute left-0 top-0 w-full" />
                <SweepText ref={roleRefB} text={slotTexts[1]} groupByWord className="absolute left-0 top-0 w-full" />
              </span>
            )}
          </h2>

          {/* Where I am and whether I'm looking, in the sentence face rather
              than the display one, and arriving with the buttons so the
              headline still lands on its own first. */}
          <p
            className={`hero-availability mt-6 font-body text-sm text-white/75 transition-opacity duration-700 sm:text-base ${visibleH1State === 'done'
              ? 'opacity-100'
              : 'opacity-0'
              }`}
            style={{ transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)" }}
          >
            {/* Each part kept whole, so a phone wraps between parts rather
                than at the hyphen in "On-site". */}
            {hero.availability.split(" · ").map((part, index) => (
              <span key={part}>
                {index > 0 && " · "}
                <span className="whitespace-nowrap">{part}</span>
              </span>
            ))}
          </p>

          <div
            className={`hero-cta mt-5 flex flex-row flex-wrap items-center gap-3 transition-opacity duration-700 sm:gap-4 ${visibleH1State === 'done'
              ? 'opacity-100'
              : 'pointer-events-none opacity-0'
              }`}
            style={{ transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)" }}
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
            <Link
              href="/resume"
              className="rounded-full border border-white/25 bg-black/40 px-6 py-3 text-center text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:border-accent hover:text-accent-soft sm:text-base"
            >
              Résumé
            </Link>
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
