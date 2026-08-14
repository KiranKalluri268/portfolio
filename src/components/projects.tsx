"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import Link from "next/link";
import HomeProjectsRow, { type HomeRowEntry } from "@/components/projects/HomeProjectsRow";
import { useActiveSection, useScrollActions } from "@/context/SmoothScrollContext";
import {
  VelocityTracker,
  dragTarget,
  momentumTarget,
  resolveAxis,
  scrollPerPixel,
  settleSeconds,
  type SwipeAxis,
} from "./projects-swipe";

export default function ProjectsSection({ entries }: { entries: HomeRowEntry[] }) {
  const { lenis } = useScrollActions();
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  // Written by the pin, read by the row's render loop. Scroll position is
  // still the only source of truth for where the row is; this is just the
  // cheapest way to hand it over, without a React render per frame.
  const progressRef = useRef(0);
  // Written by the row once it knows its card geometry, read by the swipe
  // handler below, which has to turn finger pixels into scroll pixels.
  const travelRef = useRef(0);
  const [activePanel, setActivePanel] = useState(0);
  // Driven by the active scene rather than the trigger's own isActive, which
  // reports false at exactly progress 1 — the position the Projects dot lands on.
  const isInCarousel = useActiveSection() === "projects";

  // Panel 0 is the empty lead-in spacer, the last panel is "See all projects".
  const panelCount = entries.length + 2;
  const lastPanelIndex = panelCount - 1;
  const panelStep = 1 / lastPanelIndex;

  const goToPanel = useCallback((panelIndex: number) => {
    const trigger = ScrollTrigger.getById("projects-horizontal-pin");
    if (!trigger) return;
    const destination = trigger.start
      + (panelIndex * panelStep) * (trigger.end - trigger.start);
    if (lenis) lenis.scrollTo(destination, { duration: 0.6 });
    else window.scrollTo({ top: destination, behavior: "smooth" });
  }, [lenis, panelStep]);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const title = titleRef.current;
    if (!section || !title) return;

    gsap.registerPlugin(ScrollTrigger);

    const context = gsap.context(() => {
      gsap.set(title, {
        xPercent: -50,
        yPercent: -50,
        autoAlpha: 1,
        willChange: "transform,opacity",
      });

      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          id: "projects-horizontal-pin",
          trigger: section,
          start: "top top",
          end: () => `+=${window.innerHeight * lastPanelIndex}`,
          pin: true,
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: ({ progress }) => {
            progressRef.current = progress;
          },
        },
      });

      // The row used to be a DOM track tweened across the whole timeline, which
      // is what made the timeline one unit long. It is drawn on the GPU now, so
      // that length has to be stated rather than implied: the title's cues below
      // are fractions of it, and they would otherwise move every time a project
      // was added.
      timeline.to({}, { duration: 1 }, 0);

      timeline
        .to(title, {
          x: () => window.innerWidth < 640 ? "-20vw" : "-40vw",
          // On a phone the title parks on the same line as the 02/05 counter.
          // A share of the viewport height put it wherever that worked out to —
          // on a short screen, up under the logo — so it is measured from the
          // counter itself, which is the thing it has to line up with.
          y: () => {
            if (window.innerWidth >= 640) return window.innerHeight * -0.24;
            const counter = section.querySelector<HTMLElement>("[data-projects-counter]");
            // The title's resting centre; top-3/8 with a -50% translate.
            const restingCentre = section.clientHeight * 0.375;
            const counterCentre = counter
              ? counter.offsetTop + counter.offsetHeight / 2
              : restingCentre;
            return counterCentre - restingCentre;
          },
          duration: 0.14,
        }, 0.02)
        .to(title, {
          x: "-110vw",
          autoAlpha: 0,
          duration: 0.12,
          ease: "sine.inOut",
        }, 0.84);
    }, section);

    return () => context.revert();
  }, [lastPanelIndex]);

  // Horizontal swiping on touch devices. The section declares
  // `touch-action: pan-y pinch-zoom`, so the browser keeps vertical panning and
  // pinch-zoom while horizontal movement is left to us — there is nothing to
  // pan horizontally natively, since the row is drawn rather than scrolled.
  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const velocity = new VelocityTracker();

    let axis: SwipeAxis | null = null;
    let startX = 0;
    let startY = 0;
    let startScroll = 0;
    let ratio = 0;
    let range: { min: number; max: number } | null = null;

    const readRange = () => {
      const trigger = ScrollTrigger.getById("projects-horizontal-pin");
      if (!trigger) return null;
      // Measured per gesture: `end` is recalculated on resize, and 100dvh
      // changes as mobile browser chrome hides. The travel is the row's own,
      // published by the renderer that decided how big a card is.
      const horizontalTravel = travelRef.current;
      if (horizontalTravel <= 0) return null;
      return {
        min: trigger.start,
        max: trigger.end,
        ratio: scrollPerPixel(trigger.end - trigger.start, horizontalTravel),
      };
    };

    const scrollTo = (target: number, seconds: number) => {
      if (lenis) lenis.scrollTo(target, seconds > 0 ? { duration: seconds } : { immediate: true });
      else window.scrollTo({ top: target, behavior: seconds > 0 ? "smooth" : "auto" });
    };

    const reset = () => {
      axis = null;
      range = null;
      velocity.reset();
    };

    // Lenis listens for touch on the window, so its handler runs after ours.
    // With `syncTouch` off it treats every touch as native scrolling and stops
    // whatever it is animating — including the momentum scroll we start on
    // release, which died on the frame it began. Marking the events we have
    // already claimed makes Lenis skip them; it still owns every gesture we
    // do not take, so vertical scrolling is untouched.
    //
    // Only a gesture with some vertical drift ever hit this, because Lenis
    // ignores a perfectly straight horizontal swipe as an unknown gesture. No
    // real finger swipes straight, so in practice it was every fast flick.
    const cedeToCarousel = (event: TouchEvent) => {
      (event as TouchEvent & { lenisStopPropagation?: boolean }).lenisStopPropagation = true;
    };

    const onTouchStart = (event: TouchEvent) => {
      // Leave multi-touch alone so pinch-zoom is never interrupted.
      if (event.touches.length !== 1) return reset();

      const measured = readRange();
      // Only engage while the pin actually owns the viewport. Otherwise a
      // horizontal swipe elsewhere would yank the page into the pinned range.
      if (!measured || window.scrollY < measured.min || window.scrollY > measured.max) {
        return reset();
      }

      const touch = event.touches[0];
      axis = null;
      range = { min: measured.min, max: measured.max };
      ratio = measured.ratio;
      startX = touch.clientX;
      startY = touch.clientY;
      startScroll = window.scrollY;
      velocity.reset();
      velocity.add(touch.clientX, event.timeStamp);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!range || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (axis === null) {
        axis = resolveAxis(deltaX, deltaY);
        // Still ambiguous, or the page has claimed it: either way, hands off.
        if (axis === null) return;
        if (axis === "vertical") {
          range = null;
          return;
        }
      }

      // Committed to horizontal, so stop the browser doing anything else with
      // the gesture and track the finger exactly.
      event.preventDefault();
      cedeToCarousel(event);
      velocity.add(touch.clientX, event.timeStamp);
      scrollTo(dragTarget({ startScroll, deltaX, ratio, ...range }), 0);
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!range || axis !== "horizontal") return reset();
      cedeToCarousel(event);

      const from = window.scrollY;
      const target = momentumTarget({
        scroll: from,
        velocityX: velocity.velocity(),
        ratio,
        ...range,
      });
      const distance = Math.abs(target - from);
      // Reduced motion still swipes, it just arrives rather than glides.
      if (distance > 0) {
        scrollTo(target, reduceMotion ? 0 : settleSeconds(distance, window.innerHeight));
      }
      reset();
    };

    // touchmove must be non-passive to allow preventDefault; the others do not
    // need it and stay passive so they never delay scrolling.
    section.addEventListener("touchstart", onTouchStart, { passive: true });
    section.addEventListener("touchmove", onTouchMove, { passive: false });
    section.addEventListener("touchend", onTouchEnd, { passive: true });
    section.addEventListener("touchcancel", reset, { passive: true });

    return () => {
      section.removeEventListener("touchstart", onTouchStart);
      section.removeEventListener("touchmove", onTouchMove);
      section.removeEventListener("touchend", onTouchEnd);
      section.removeEventListener("touchcancel", reset);
    };
  }, [lenis]);

  const centred = entries[activePanel - 1];
  const onSeeAll = activePanel === lastPanelIndex;

  return (
    <section
      ref={sectionRef}
      id="projects"
      className="relative h-[100dvh] min-h-[100svh] overflow-hidden text-white"
      aria-label="Projects section"
      // pan-y keeps vertical scrolling native; pinch-zoom is listed explicitly
      // so declaring this does not cost the ability to zoom the page.
      style={{ zIndex: 10, touchAction: "pan-y pinch-zoom" }}
    >
      <h2
        ref={titleRef}
        className="absolute top-3/8 left-1/2 z-20 whitespace-nowrap text-center text-5xl font-bold tracking-tight sm:text-6xl"
      >
        Projects
      </h2>

      <HomeProjectsRow
        entries={entries}
        lastPanelIndex={lastPanelIndex}
        progressRef={progressRef}
        travelRef={travelRef}
        overlayRef={overlayRef}
        onCentre={setActivePanel}
      />

      {/* What a card cannot carry: the summary a recruiter reads, and the links
          out to the source and the live site. Real markup over the middle card,
          which is the one card the bend always leaves square on — so this never
          has to pretend to be on the cylinder with the rest of them.

          The container spans the section so its children can be placed against
          the same two bands the renderer sized the card into. It is never
          clickable itself: the links opt in through the settled flag, and
          everything else stays a tap on the card behind. */}
      <div
        ref={overlayRef}
        data-settled="false"
        className="group pointer-events-none absolute inset-0 z-20"
        style={{ opacity: 0 }}
      >
        {centred && (
          <div
            className="absolute inset-x-0 flex flex-col items-center px-6 text-center"
            style={{ bottom: "var(--rail-band, 0px)", height: "var(--overlay-band, 0px)" }}
          >
            {/* The renderer measures this to decide how far the text may follow
                its card sideways before it would run off the screen. */}
            <div data-overlay-content className="flex w-full max-w-xl flex-col items-center">
            <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-white/80 sm:text-base">
              {centred.project.summary}
            </p>
            <nav
              className="flex flex-wrap justify-center gap-3 group-data-[settled=true]:pointer-events-auto"
              aria-label={`Links for ${centred.project.title}`}
            >
              <Link
                href={`/projects/${centred.project.slug}`}
                className="rounded-full border border-white/20 bg-black/45 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:border-accent/60 hover:text-accent-soft sm:text-sm"
              >
                Read case study <span aria-hidden="true">→</span>
              </Link>
              {centred.project.repositoryUrl && (
                <a
                  href={centred.project.repositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/20 bg-black/45 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:border-accent/60 hover:text-accent-soft sm:text-sm"
                  aria-label={`Visit ${centred.project.title} on GitHub (opens in new tab)`}
                >
                  View source <span aria-hidden="true">↗</span>
                </a>
              )}
              {centred.project.liveUrl && (
                <a
                  href={centred.project.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/20 bg-white px-5 py-2.5 text-xs font-semibold text-black transition-colors hover:bg-accent-soft sm:text-sm"
                  aria-label={`Visit ${centred.project.title} live demo (opens in new tab)`}
                >
                  Live project <span aria-hidden="true">↗</span>
                </a>
              )}
            </nav>
            </div>
          </div>
        )}

        {/* The last panel has no card, so its heading takes the card's place
            rather than sitting in the strip underneath one. */}
        {onSeeAll && (
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <h2 className="whitespace-nowrap text-center text-4xl font-bold tracking-tight group-data-[settled=true]:pointer-events-auto sm:text-5xl">
              <Link href="/projects" className="rounded-control underline underline-offset-8">
                See all projects
              </Link>
            </h2>
          </div>
        )}
      </div>

      <CarouselProgress
        entries={entries}
        lastPanelIndex={lastPanelIndex}
        activePanel={activePanel}
        isInCarousel={isInCarousel}
        onSelect={goToPanel}
      />
    </section>
  );
}

interface CarouselProgressProps {
  entries: HomeRowEntry[];
  lastPanelIndex: number;
  activePanel: number;
  isInCarousel: boolean;
  onSelect: (panelIndex: number) => void;
}

function CarouselProgress({ entries, lastPanelIndex, activePanel, isInCarousel, onSelect }: CarouselProgressProps) {
  // Panel 0 is the empty lead-in, so the destinations are 1..lastPanelIndex.
  const destinations = Array.from({ length: lastPanelIndex }, (_, index) => index + 1);
  const isOnProject = activePanel >= 1 && activePanel <= entries.length;
  const visibility = isInCarousel ? "opacity-100" : "pointer-events-none opacity-0";

  return (
    <>
      {/* Mobile: a counter, since a segmented rail cannot stay legible at
          this width alongside the scene indicator. */}
      <div
        data-projects-counter
        className={`absolute right-4 top-20 z-30 transition-opacity duration-300 sm:hidden ${isOnProject && isInCarousel ? "opacity-100" : "pointer-events-none opacity-0"}`}
        aria-hidden="true"
      >
        <span className="rounded-full border border-white/10 bg-black/65 px-3 py-1 text-xs font-semibold tabular-nums tracking-widest text-white/80 backdrop-blur-md">
          {String(Math.max(activePanel, 1)).padStart(2, "0")}
          <span className="mx-1 text-white/35">/</span>
          {String(entries.length).padStart(2, "0")}
        </span>
      </div>

      {/* Desktop: a segmented rail that doubles as direct navigation. */}
      <div
        className={`absolute bottom-10 left-1/2 z-30 hidden -translate-x-1/2 transition-opacity duration-300 sm:flex ${visibility}`}
      >
        <nav className="flex items-center gap-2" aria-label="Project carousel navigation">
          {destinations.map((panelIndex) => {
            const isActive = activePanel === panelIndex;
            const isFinal = panelIndex === lastPanelIndex;
            const label = isFinal
              ? "All projects"
              : entries[panelIndex - 1].project.title;

            return (
              <button
                key={panelIndex}
                type="button"
                onClick={() => onSelect(panelIndex)}
                aria-label={`Go to ${label}`}
                aria-current={isActive ? "true" : undefined}
                className="group/dot cursor-pointer px-0.5 py-3"
              >
                <span
                  className={`block h-[3px] rounded-full transition-all duration-300 ${isActive
                    ? "w-11 bg-accent"
                    : "w-7 bg-white/25 group-hover/dot:bg-white/60"
                    }`}
                />
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
