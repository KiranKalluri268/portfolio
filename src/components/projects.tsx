"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import Link from "next/link";
import type { ProjectContent } from "@/lib/content/types";
import ProjectThumbnail from "@/components/content/ProjectThumbnail";
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

// Resting values for the focus animation below. Panel geometry (count, step)
// depends on the `projects` prop, so those live inside the component instead.
const RESTING_SCALE = 0.82;
const RESTING_OPACITY = 0.35;
const RESTING_LIFT = 16;

export default function ProjectsSection({ projects }: { projects: ProjectContent[] }) {
  const { lenis } = useScrollActions();
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [activePanel, setActivePanel] = useState(0);
  // Driven by the active scene rather than the trigger's own isActive, which
  // reports false at exactly progress 1 — the position the Projects dot lands on.
  const isInCarousel = useActiveSection() === "projects";

  // Panel 0 is the empty lead-in spacer, the last panel is "See all projects".
  const panelCount = projects.length + 2;
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
    const track = trackRef.current;
    const title = titleRef.current;
    if (!section || !track || !title) return;

    gsap.registerPlugin(ScrollTrigger);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const context = gsap.context(() => {
      gsap.set(track, { x: 0, force3D: true, willChange: "transform" });
      gsap.set(title, {
        xPercent: -50,
        yPercent: -50,
        autoAlpha: 1,
        willChange: "transform,opacity",
      });

      let reportedPanel = -1;

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
            // Only cross a React render when the centred panel actually changes.
            const index = Math.round(gsap.utils.clamp(0, 1, progress) * lastPanelIndex);
            if (index === reportedPanel) return;
            reportedPanel = index;
            setActivePanel(index);
          },
        },
      });

      timeline
        .to(track, {
          x: () => -(track.scrollWidth - section.clientWidth),
          duration: 1,
        }, 0)
        .to(title, {
          x: () => window.innerWidth < 640 ? "-20vw" : "-40vw",
          y: () => window.innerWidth < 640 ? "-28vh" : "-24vh",
          duration: 0.14,
        }, 0.02)
        .to(title, {
          x: "-110vw",
          autoAlpha: 0,
          duration: 0.12,
          ease: "sine.inOut",
        }, 0.84);

      // Each panel grows into focus and falls back as it leaves. Paired
      // power2.out / power2.in curves meet with zero slope at the centre, so
      // there is no visible kink at the peak.
      if (!reduceMotion) {
        const panels = gsap.utils.toArray<HTMLElement>(".project-panel");

        panels.forEach((panel, arrayIndex) => {
          // Index 0 of the track is the empty lead-in spacer.
          const panelIndex = arrayIndex + 1;
          const centeredAt = panelIndex * panelStep;

          timeline.fromTo(panel, {
            scale: RESTING_SCALE,
            opacity: RESTING_OPACITY,
            y: RESTING_LIFT,
          }, {
            scale: 1,
            opacity: 1,
            y: 0,
            duration: panelStep,
            ease: "power2.out",
            force3D: true,
          }, centeredAt - panelStep);

          // The final panel gets no exit tween: it would end at 1 + panelStep,
          // stretching the timeline past a duration of 1, which would rescale
          // the track tween so the last panel never fully arrives.
          if (panelIndex < lastPanelIndex) {
            timeline.to(panel, {
              scale: RESTING_SCALE,
              opacity: RESTING_OPACITY,
              y: RESTING_LIFT,
              duration: panelStep,
              ease: "power2.in",
              force3D: true,
            }, centeredAt);
          }
        });
      }
    }, section);

    return () => context.revert();
  }, [lastPanelIndex, panelStep]);

  // Horizontal swiping on touch devices. The section declares
  // `touch-action: pan-y pinch-zoom`, so the browser keeps vertical panning and
  // pinch-zoom while horizontal movement is left to us — there is nothing to
  // pan horizontally natively, since the track is transformed rather than
  // scrolled.
  useLayoutEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;

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
      // changes as mobile browser chrome hides.
      const horizontalTravel = track.scrollWidth - section.clientWidth;
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
      velocity.add(touch.clientX, event.timeStamp);
      scrollTo(dragTarget({ startScroll, deltaX, ratio, ...range }), 0);
    };

    const onTouchEnd = () => {
      if (!range || axis !== "horizontal") return reset();

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

      {/* Horizontal padding is exactly half the off-panel width, so panel 0
          starts centred and panel N ends centred without touching the
          travel calculation above. */}
      <div ref={trackRef} className="flex h-full w-max px-[11vw] sm:px-[19vw]">
        <div className="h-[100dvh] min-h-[100svh] w-[78vw] shrink-0 sm:w-[62vw]" aria-hidden="true" />

        {projects.map((project) => (
          <article
            key={project.id}
            className="project-panel flex h-[100dvh] min-h-[100svh] w-[78vw] shrink-0 flex-col items-center justify-center px-4 py-16 text-center will-change-[transform,opacity] sm:w-[62vw] sm:px-8 lg:p-12"
          >
            <h3 className="mb-[clamp(0.5rem,2dvh,1rem)] max-w-3xl text-base font-semibold sm:text-2xl lg:text-3xl">
              <Link href={`/projects/${project.slug}`} className="rounded hover:text-accent-soft">
                {project.title}
              </Link>
            </h3>
            <Link
              href={`/projects/${project.slug}`}
              className="relative mb-[clamp(0.5rem,2dvh,1rem)] block h-[clamp(7.5rem,30dvh,18.75rem)] w-full max-w-3xl rounded-xl"
              aria-label={`Read the ${project.title} case study`}
            >
              <ProjectThumbnail
                project={project}
                className="rounded-xl object-cover shadow-lg"
                sizes="(max-width: 640px) 74vw, (max-width: 1400px) 56vw, 768px"
              />
            </Link>
            <p className="mb-[clamp(0.75rem,2.5dvh,1.5rem)] max-w-xl text-sm leading-relaxed sm:text-base lg:text-lg">{project.summary}</p>

            <nav className="flex flex-wrap justify-center gap-3" aria-label={`Links for ${project.title}`}>
              <Link
                href={`/projects/${project.slug}`}
                className="rounded-full border border-white/20 bg-black/45 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:border-accent/60 hover:text-accent-soft sm:text-sm"
              >
                Read case study <span aria-hidden="true">→</span>
              </Link>
              {project.repositoryUrl && (
                <a
                  href={project.repositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/20 bg-black/45 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:border-accent/60 hover:text-accent-soft sm:text-sm"
                  aria-label={`Visit ${project.title} on GitHub (opens in new tab)`}
                >
                  View source <span aria-hidden="true">↗</span>
                </a>
              )}
              {project.liveUrl && (
                <a
                  href={project.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/20 bg-white px-5 py-2.5 text-xs font-semibold text-black transition-colors hover:bg-accent-soft sm:text-sm"
                  aria-label={`Visit ${project.title} live demo (opens in new tab)`}
                >
                  Live project <span aria-hidden="true">↗</span>
                </a>
              )}
            </nav>
          </article>
        ))}

        <div className="project-panel flex h-[100dvh] min-h-[100svh] w-[78vw] shrink-0 items-center justify-center px-4 will-change-[transform,opacity] sm:w-[62vw]">
          <h2 className="whitespace-nowrap text-center text-4xl font-bold tracking-tight sm:text-5xl">
            <Link href="/projects" className="rounded-control underline underline-offset-8">
              See all projects
            </Link>
          </h2>
        </div>
      </div>

      <CarouselProgress
        projects={projects}
        lastPanelIndex={lastPanelIndex}
        activePanel={activePanel}
        isInCarousel={isInCarousel}
        onSelect={goToPanel}
      />
    </section>
  );
}

interface CarouselProgressProps {
  projects: ProjectContent[];
  lastPanelIndex: number;
  activePanel: number;
  isInCarousel: boolean;
  onSelect: (panelIndex: number) => void;
}

function CarouselProgress({ projects, lastPanelIndex, activePanel, isInCarousel, onSelect }: CarouselProgressProps) {
  // Panel 0 is the empty lead-in, so the destinations are 1..lastPanelIndex.
  const destinations = Array.from({ length: lastPanelIndex }, (_, index) => index + 1);
  const isOnProject = activePanel >= 1 && activePanel <= projects.length;
  const visibility = isInCarousel ? "opacity-100" : "pointer-events-none opacity-0";

  return (
    <>
      {/* Mobile: a counter, since a segmented rail cannot stay legible at
          this width alongside the scene indicator. */}
      <div
        className={`absolute right-4 top-20 z-30 transition-opacity duration-300 sm:hidden ${isOnProject && isInCarousel ? "opacity-100" : "pointer-events-none opacity-0"}`}
        aria-hidden="true"
      >
        <span className="rounded-full border border-white/10 bg-black/65 px-3 py-1 text-xs font-semibold tabular-nums tracking-widest text-white/80 backdrop-blur-md">
          {String(Math.max(activePanel, 1)).padStart(2, "0")}
          <span className="mx-1 text-white/35">/</span>
          {String(projects.length).padStart(2, "0")}
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
              : projects[panelIndex - 1].title;

            return (
              <button
                key={panelIndex}
                type="button"
                onClick={() => onSelect(panelIndex)}
                aria-label={`Go to ${label}`}
                aria-current={isActive ? "true" : undefined}
                className="group cursor-pointer px-0.5 py-3"
              >
                <span
                  className={`block h-[3px] rounded-full transition-all duration-300 ${isActive
                    ? "w-11 bg-accent"
                    : "w-7 bg-white/25 group-hover:bg-white/60"
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
