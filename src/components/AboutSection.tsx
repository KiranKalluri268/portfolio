"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import SkewOnScroll from "./SkewOnScroll";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import about from "@/data/about.json";
import { useAudio } from "@/context/AudioContextProvider";

export default function AboutSection() {
  const { hasEntered } = useAudio();
  const sectionRef = useRef<HTMLElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const resumeLinkRef = useRef<HTMLAnchorElement>(null);
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const fullDescription = useMemo(
    () => about.segments.map(({ text }) => text).join(" "),
    [],
  );
  const descriptionWords = useMemo(
    () => about.segments.flatMap((segment, segmentIndex) =>
      segment.text.split(/\s+/).map((word, index, words) => ({
        word,
        accent: segment.accent,
        key: `${segmentIndex}-${index}-${word}`,
        needsSpace: segmentIndex < about.segments.length - 1 || index < words.length - 1,
      })),
    ),
    [],
  );

  useLayoutEffect(() => {
    if (!hasEntered) return;
    const section = sectionRef.current;
    const copy = copyRef.current;
    const resumeLink = resumeLinkRef.current;
    const words = wordRefs.current.filter((word): word is HTMLSpanElement => word !== null);
    if (!section || !copy || !resumeLink || words.length === 0) return;

    gsap.registerPlugin(ScrollTrigger);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const rootStyles = getComputedStyle(document.documentElement);
    const readToken = (name: string, fallback: string) =>
      rootStyles.getPropertyValue(name).trim() || fallback;
    const accentColor = readToken("--color-accent-soft", "#ff7a18");
    const unreadColor = readToken("--color-muted", "#64748b");

    // The resume link fades in with scroll progress, but a keyboard user reaches
    // it long before then. Focus overrides the scroll-driven state rather than
    // pulling the link out of the tab order.
    let linkFocused = false;
    let linkProgress = 0;

    const applyLinkVisibility = () => {
      if (linkFocused) {
        resumeLink.style.opacity = "1";
        resumeLink.style.pointerEvents = "auto";
        return;
      }
      resumeLink.style.opacity = String(0.08 + linkProgress * 0.92);
      resumeLink.style.pointerEvents = linkProgress > 0.2 ? "auto" : "none";
    };

    const handleLinkFocus = () => {
      linkFocused = true;
      applyLinkVisibility();
    };
    const handleLinkBlur = () => {
      linkFocused = false;
      applyLinkVisibility();
    };

    resumeLink.addEventListener("focus", handleLinkFocus);
    resumeLink.addEventListener("blur", handleLinkBlur);

    const context = gsap.context(() => {
      if (reducedMotion) {
        gsap.set(words, {
          opacity: 1,
          color: (_, word: HTMLSpanElement) =>
            word.dataset.accent === "true" ? accentColor : "#ffffff",
        });
        gsap.set(resumeLink, { opacity: 1, pointerEvents: "auto" });
        return;
      }

      gsap.fromTo(copy, { y: 0 }, {
        y: () => -window.innerHeight * 0.05,
        ease: "none",
        force3D: true,
        scrollTrigger: {
          trigger: section,
          start: "top 20%",
          end: "bottom 35%",
          scrub: 1,
          invalidateOnRefresh: true,
        },
      });

      let wordLines: number[] = [];

      const measureLines = () => {
        let currentLine = -1;
        let previousTop = Number.NEGATIVE_INFINITY;
        wordLines = words.map((word) => {
          if (Math.abs(word.offsetTop - previousTop) > 2) {
            currentLine += 1;
            previousTop = word.offsetTop;
          }
          return currentLine;
        });
      };

      const renderProgress = (progress: number) => {
        const paragraphProgress = gsap.utils.clamp(0, 1, progress / 0.88);
        const revealPosition = paragraphProgress * words.length;
        const activeWordIndex = Math.min(
          words.length - 1,
          Math.max(0, Math.floor(revealPosition)),
        );
        const activeLine = wordLines[activeWordIndex] ?? 0;
        const activeLineStart = wordLines.indexOf(activeLine);
        const activeLineEnd = wordLines.lastIndexOf(activeLine);
        const activeLineProgress = gsap.utils.clamp(
          0,
          1,
          (revealPosition - activeLineStart) / Math.max(1, activeLineEnd - activeLineStart + 1),
        );

        words.forEach((word, index) => {
          const wordProgress = gsap.utils.clamp(0, 1, revealPosition - index);
          const wordLine = wordLines[index] ?? 0;
          const isReadLine = wordLine < activeLine;
          const isImmediatelyPreviousLine = wordLine === activeLine - 1;
          const isActiveLine = wordLine === activeLine;
          const opacity = isImmediatelyPreviousLine
            ? gsap.utils.interpolate(1, 0.38, activeLineProgress)
            : isReadLine
              ? 0.38
              : isActiveLine
                ? 0.1 + wordProgress * 0.9
                : 0.1;
          const readColor = word.dataset.accent === "true" ? accentColor : "#ffffff";

          word.style.opacity = String(opacity);
          word.style.color = wordProgress > 0 || isReadLine ? readColor : unreadColor;
        });

        linkProgress = gsap.utils.clamp(0, 1, (progress - 0.87) / 0.05);
        applyLinkVisibility();
      };

      measureLines();
      ScrollTrigger.create({
        trigger: section,
        start: "top 20%",
        end: "bottom 35%",
        scrub: 0.35,
        invalidateOnRefresh: true,
        onRefresh: measureLines,
        onUpdate: ({ progress }) => renderProgress(progress),
      });
    }, section);

    return () => {
      resumeLink.removeEventListener("focus", handleLinkFocus);
      resumeLink.removeEventListener("blur", handleLinkBlur);
      context.revert();
    };
  }, [hasEntered]);

  return (
    <section
      ref={sectionRef}
      id="about"
      className="relative min-h-[500svh] text-white"
      aria-label={about.ariaLabel}
    >
      <div className="h-[30svh]" aria-hidden="true" />
      <div className="sticky top-0 flex h-[100svh] items-center px-5 py-20 sm:px-10 lg:px-20">
        {/* Inside the sticky element, never around it: a transform on an
            ancestor would re-anchor the sticky to this wrapper. */}
        <SkewOnScroll className="w-full">
        <div ref={copyRef} className="relative mx-auto w-full max-w-6xl sm:-left-[3vw] lg:-left-[5vw]">
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.24em] text-white/55 sm:mb-8 sm:text-base">
            {about.eyebrow}
          </h2>
          <p
            className="text-[clamp(1.15rem,4.2vw,2.75rem)] font-semibold leading-[1.18] tracking-[-0.015em]"
            aria-label={fullDescription}
          >
            {descriptionWords.map(({ word, accent, key, needsSpace }, index) => (
              <span
                ref={(element) => {
                  wordRefs.current[index] = element;
                }}
                key={key}
                data-accent={accent}
                className="inline text-slate-500 opacity-10"
                aria-hidden="true"
              >
                {word}{needsSpace ? " " : ""}
              </span>
            ))}
          </p>
          <Link
            ref={resumeLinkRef}
            href="/resume"
            className="pointer-events-none mt-7 inline-flex items-center rounded-full border border-accent-soft/50 bg-accent/10 px-4 py-2 text-sm font-semibold tracking-wide text-white opacity-[0.08] shadow-[0_0_22px_rgba(255,122,24,0.12)] transition-[background-color,border-color,box-shadow] hover:border-accent-soft hover:bg-accent/20 hover:shadow-[0_0_28px_rgba(255,122,24,0.25)] sm:mt-9 sm:text-base"
          >
            View my resume →
          </Link>
        </div>
        </SkewOnScroll>
      </div>
    </section>
  );
}
