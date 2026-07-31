"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import type { Project } from "@/types";
import { useActiveSection, useScrollActions } from "@/context/SmoothScrollContext";
import projectData from "@/data/projects.json";

type CarouselProject = Project & { technologies: string[] };

const projects: CarouselProject[] = projectData.projects.map((project) => ({
  id: project.id,
  title: project.title,
  description: project.summary,
  image: project.image,
  github: project.links.github,
  live: project.links.live,
  technologies: project.technologies,
}));

const PANEL_COUNT = projects.length + 2;
const LAST_PANEL_INDEX = PANEL_COUNT - 1;

// Panels sit at a fraction of the viewport so the neighbouring cards stay
// visible. Track padding must be exactly half the leftover width, which is what
// keeps panel k centred at progress k / LAST_PANEL_INDEX.
//
// The width matters more than it looks: a resting panel shrinks about its own
// centre, so it pulls away from the viewport edge and eats into its own peek.
// At 82vw the surviving sliver was ~42px of empty panel padding — the effect
// was running, just with nothing visible to show it.
const PANEL_STEP = 1 / LAST_PANEL_INDEX;
const RESTING_SCALE = 0.82;
const RESTING_OPACITY = 0.35;
const RESTING_LIFT = 16;

export default function ProjectsSection() {
  const { lenis } = useScrollActions();
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [activePanel, setActivePanel] = useState(0);
  // Driven by the active scene rather than the trigger's own isActive, which
  // reports false at exactly progress 1 — the position the Projects dot lands on.
  const isInCarousel = useActiveSection() === "projects";

  const goToPanel = useCallback((panelIndex: number) => {
    const trigger = ScrollTrigger.getById("projects-horizontal-pin");
    if (!trigger) return;
    const destination = trigger.start
      + (panelIndex * PANEL_STEP) * (trigger.end - trigger.start);
    if (lenis) lenis.scrollTo(destination, { duration: 0.6 });
    else window.scrollTo({ top: destination, behavior: "smooth" });
  }, [lenis]);

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
          end: () => `+=${window.innerHeight * LAST_PANEL_INDEX}`,
          pin: true,
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: ({ progress }) => {
            // Only cross a React render when the centred panel actually changes.
            const index = Math.round(gsap.utils.clamp(0, 1, progress) * LAST_PANEL_INDEX);
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
          const centeredAt = panelIndex * PANEL_STEP;

          timeline.fromTo(panel, {
            scale: RESTING_SCALE,
            opacity: RESTING_OPACITY,
            y: RESTING_LIFT,
          }, {
            scale: 1,
            opacity: 1,
            y: 0,
            duration: PANEL_STEP,
            ease: "power2.out",
            force3D: true,
          }, centeredAt - PANEL_STEP);

          // The final panel gets no exit tween: it would end at 1 + PANEL_STEP,
          // stretching the timeline past a duration of 1, which would rescale
          // the track tween so the last panel never fully arrives.
          if (panelIndex < LAST_PANEL_INDEX) {
            timeline.to(panel, {
              scale: RESTING_SCALE,
              opacity: RESTING_OPACITY,
              y: RESTING_LIFT,
              duration: PANEL_STEP,
              ease: "power2.in",
              force3D: true,
            }, centeredAt);
          }
        });
      }
    }, section);

    return () => context.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="projects"
      className="relative h-[100dvh] min-h-[100svh] overflow-hidden text-white"
      aria-label="Projects section"
      style={{ zIndex: 10 }}
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
            <h3 className="mb-[clamp(0.5rem,2dvh,1rem)] max-w-3xl text-base font-semibold sm:text-2xl lg:text-3xl">{project.title}</h3>
            <div
              className="relative mb-[clamp(0.5rem,2dvh,1rem)] h-[clamp(7.5rem,30dvh,18.75rem)] w-full max-w-3xl"
              role="img"
              aria-label={`Screenshot of ${project.title}`}
            >
              <Image
                src={project.image}
                alt={`Screenshot of ${project.title} project`}
                fill
                className="rounded-xl object-cover shadow-lg"
                quality={90}
                sizes="(max-width: 640px) 74vw, (max-width: 1400px) 56vw, 768px"
                loading={project.id === 1 ? "eager" : "lazy"}
              />
            </div>
            <p className="mb-[clamp(0.5rem,2dvh,1rem)] max-w-xl text-sm leading-relaxed sm:text-base lg:text-lg">{project.description}</p>

            <ul
              className="mb-[clamp(0.75rem,2.5dvh,1.5rem)] flex flex-wrap justify-center gap-2"
              aria-label={`Technologies used in ${project.title}`}
            >
              {project.technologies.map((technology) => (
                <li
                  key={technology}
                  className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs text-blue-200"
                >
                  {technology}
                </li>
              ))}
            </ul>

            <nav className="flex flex-wrap justify-center gap-3" aria-label={`Links for ${project.title}`}>
              {project.github && (
                <a
                  href={project.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/20 bg-black/45 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:border-accent/60 hover:text-accent-soft sm:text-sm"
                  aria-label={`Visit ${project.title} on GitHub (opens in new tab)`}
                >
                  View source <span aria-hidden="true">↗</span>
                </a>
              )}
              {project.live && (
                <a
                  href={project.live}
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
        activePanel={activePanel}
        isInCarousel={isInCarousel}
        onSelect={goToPanel}
      />
    </section>
  );
}

interface CarouselProgressProps {
  activePanel: number;
  isInCarousel: boolean;
  onSelect: (panelIndex: number) => void;
}

function CarouselProgress({ activePanel, isInCarousel, onSelect }: CarouselProgressProps) {
  // Panel 0 is the empty lead-in, so the destinations are 1..LAST_PANEL_INDEX.
  const destinations = Array.from({ length: LAST_PANEL_INDEX }, (_, index) => index + 1);
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
            const isFinal = panelIndex === LAST_PANEL_INDEX;
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
