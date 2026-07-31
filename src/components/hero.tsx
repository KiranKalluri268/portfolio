"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useScrollActions } from "@/context/SmoothScrollContext";
import { useAudio } from "@/context/AudioContextProvider";
import { useReducedMotion } from "@/hooks/useMediaQuery";

export default function Hero() {
  const { scrollNext, scrollToSection } = useScrollActions();
  const { hasEntered } = useAudio();
  const reduceMotion = useReducedMotion();
  const words = useMemo(
    () => [
      "MERN FULL-STACK DEVELOPER...",
      "PYTHON DEVELOPER...",
      "AWS ENGINEER...",
      "C++ DEVELOPER...",
    ],
    []
  );

  const typingSpeed = 100;
  const deleteSpeed = 100;
  const delayBeforeDeletingCurrent = 2000;

  // Animation States
  const [displayText, setDisplayText] = useState("");
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [secondLine, setSecondLine] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFirstLineDone, setIsFirstLineDone] = useState(false);
  const [showSecondCursor, setShowSecondCursor] = useState(false);

  // New state for H1 intro sequence
  const [h1State, setH1State] = useState<'typing_intro' | 'deleting_intro' | 'typing_name' | 'done'>('typing_intro');

  const heroRef = useRef<HTMLDivElement>(null);

  const introText = "NAMASTE!";
  const mainText = "I'M,\nSAIKIRAN KALLURI";
  const visibleH1State = reduceMotion ? "done" : h1State;
  const visibleDisplayText = reduceMotion ? mainText : displayText;
  const visibleSecondLine = reduceMotion ? words[0] : secondLine;

  // H1 Animation Sequence
  useEffect(() => {
    if (!hasEntered || reduceMotion) return;
    let timeout: NodeJS.Timeout;

    switch (h1State) {
      case 'typing_intro':
        if (displayText.length < introText.length) {
          timeout = setTimeout(() => {
            setDisplayText(introText.slice(0, displayText.length + 1));
          }, typingSpeed);
        } else {
          // Wait before deleting
          timeout = setTimeout(() => setH1State('deleting_intro'), 1000);
        }
        break;

      case 'deleting_intro':
        if (displayText.length > 0) {
          timeout = setTimeout(() => {
            setDisplayText(displayText.slice(0, -1));
          }, deleteSpeed / 2); // Delete slightly faster
        } else {
          timeout = setTimeout(() => setH1State('typing_name'), 0);
        }
        break;

      case 'typing_name':
        if (displayText.length < mainText.length) {
          timeout = setTimeout(() => {
            setDisplayText(mainText.slice(0, displayText.length + 1));
          }, typingSpeed);
        } else {
          // Wait 1 second before starting H2
          timeout = setTimeout(() => {
            setH1State('done');
            setIsFirstLineDone(true);
            setShowSecondCursor(true);
          }, 1000);
        }
        break;

      case 'done':
        // H1 animation complete
        break;
    }

    return () => clearTimeout(timeout);
  }, [displayText, h1State, introText, mainText, reduceMotion, hasEntered]);

  // Second line typing
  useEffect(() => {
    if (!hasEntered || reduceMotion) return;
    if (!isFirstLineDone) return;
    let timeout: NodeJS.Timeout;

    if (!isDeleting && secondLine.length < words[currentWordIndex].length) {
      timeout = setTimeout(() => {
        setSecondLine(words[currentWordIndex].slice(0, secondLine.length + 1));
      }, typingSpeed);
    } else if (!isDeleting) {
      timeout = setTimeout(() => setIsDeleting(true), delayBeforeDeletingCurrent);
    } else if (isDeleting && secondLine.length > 0) {
      timeout = setTimeout(() => {
        setSecondLine((prev) => prev.slice(0, prev.length - 1));
      }, deleteSpeed);
    } else {
      timeout = setTimeout(() => {
        setIsDeleting(false);
        setCurrentWordIndex((prev) => (prev + 1) % words.length);
      }, 0);
    }

    return () => clearTimeout(timeout);
  }, [secondLine, isDeleting, isFirstLineDone, currentWordIndex, words, reduceMotion, hasEntered]);

  return (
    <section
      ref={heroRef}
      className="relative h-[100dvh] min-h-[100svh] w-full overflow-hidden"
      id="hero"
      aria-label="Hero section - Introduction"
      style={{ zIndex: 10 }}
    >
      <div className="relative w-full h-full text-white">
        <div
          className={`hero-copy absolute left-1/2 w-full max-w-5xl -translate-x-1/2 px-[clamp(1.25rem,7vw,4.5rem)] pt-8 text-left transition-all duration-1000 ease-in-out sm:px-8 sm:pt-0 lg:px-0 ${visibleH1State === 'done' ? 'top-[20dvh] translate-y-0' : 'top-1/2 -translate-y-1/2'
            }`}
        >
          <h1
            className="font-bold font-[family-name:var(--font-tektur)] whitespace-pre-line leading-none md:font-[family-name:var(--font-foldit)]"
            style={{
              textShadow:
                "0.1rem 0 0.3rem rgba(255, 255, 255, 0.8), 0 0 0.6rem rgba(18, 33, 163, 0.5)",
            }}
          >
            {visibleDisplayText.split('\n').map((part, index) => (
              <span
                key={index}
                className={`transition-all duration-1000 ease-in-out ${index === 0
                  ? visibleH1State === 'done'
                    ? "text-[clamp(2.1rem,9vw,4.5rem)]"
                    : "text-[clamp(3rem,13vw,8rem)]"
                  : visibleH1State === 'done'
                    ? "text-[clamp(2.7rem,11vw,6rem)]"
                    : "text-[clamp(3rem,13vw,8rem)]"
                  }`}
              >
                {part}
                {index === 0 && visibleDisplayText.includes('\n') && '\n'}
              </span>
            ))}
            {visibleH1State !== 'done' && (
              <span
                className="animate-blink text-[clamp(2.5rem,13vw,8rem)] text-white"
                aria-hidden="true"
              >
                |
              </span>
            )}
          </h1>

          {/* The typed roles wrap between one and two lines as they cycle.
              Reserving two lines keeps the CTA row below from bouncing. */}
          <h2
            className="hero-role mt-4 min-h-[calc(2*clamp(2.15rem,10vw,7.5rem))] max-w-full break-words text-[clamp(2.15rem,10vw,7.5rem)] font-bold font-[family-name:var(--font-tektur)] leading-none md:font-[family-name:var(--font-foldit)]"
            style={{
              // The name above can carry a white halo because white has 21:1 of
              // contrast to spend. The role line is coloured and has far less,
              // so a tinted, tighter glow keeps the letterforms crisp at phone
              // size instead of blooming into them.
              textShadow: "0 0 0.4rem rgba(96, 165, 250, 0.45)",
            }}
          >
            {/* The visible line retypes character by character. Announcing that
                live would fire on every keystroke, so assistive technology gets
                the full set of roles as static text instead. */}
            <span className="sr-only">
              {words.map((word) => word.replace(/\.+$/, "")).join(", ")}
            </span>
            <span className="text-accent-soft" aria-hidden="true">{visibleSecondLine}</span>
            {!reduceMotion && showSecondCursor && <span className="animate-blink text-accent-soft" aria-hidden="true">|</span>}
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

      {/* Scroll Indicator */}
      <button
        type="button"
        className="scroll-hint absolute bottom-[env(safe-area-inset-bottom)] left-1/2 z-20 flex -translate-x-1/2 cursor-pointer flex-col items-center gap-0 rounded bg-transparent text-white/50 sm:bottom-1 sm:p-1"
        onClick={scrollNext}
        aria-label="Scroll down"
      >
        <span className="text-xs font-light tracking-widest sm:text-sm">Scroll Down or</span>
        <span className="text-xs font-light tracking-widest sm:text-sm">Press Arrow Down</span>
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
