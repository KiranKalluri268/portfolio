"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import type { ProjectContent } from "@/lib/content/types";

export default function ProjectsSection({ projects }: { projects: ProjectContent[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const lastPanelIndex = projects.length + 1;

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    const title = titleRef.current;
    if (!section || !track || !title) return;

    gsap.registerPlugin(ScrollTrigger);

    const context = gsap.context(() => {
      gsap.set(track, { x: 0, force3D: true, willChange: "transform" });
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
    }, section);

    return () => {
      context.revert();
    };
  }, [lastPanelIndex]);

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

      <div ref={trackRef} className="flex h-full w-max">
        <div className="h-[100dvh] min-h-[100svh] w-screen shrink-0" aria-hidden="true" />

        {projects.map((project) => (
          <article
            key={project.id}
            className="flex h-[100dvh] min-h-[100svh] w-screen shrink-0 flex-col items-center justify-center px-4 py-16 text-center sm:px-8 lg:p-12"
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
                sizes="(max-width: 640px) calc(100vw - 2rem), 768px"
                loading={project.id === 1 ? "eager" : "lazy"}
              />
            </div>
            <p className="mb-[clamp(0.75rem,2.5dvh,1.5rem)] max-w-xl text-sm leading-relaxed sm:text-base lg:text-lg">{project.summary}</p>
            <nav className="space-x-4" aria-label={`Links for ${project.title}`}>
              <Link
                href={`/projects/${project.slug}`}
                className="rounded px-2 py-1 underline"
              >
                Case Study
              </Link>
              {project.repositoryUrl && (
                <a
                  href={project.repositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded px-2 py-1 underline"
                  aria-label={`Visit ${project.title} on GitHub (opens in new tab)`}
                >
                  GitHub
                </a>
              )}
              {project.liveUrl && (
                <a
                  href={project.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded px-2 py-1 underline"
                  aria-label={`Visit ${project.title} live demo (opens in new tab)`}
                >
                  Live Demo
                </a>
              )}
            </nav>
          </article>
        ))}

        <div className="flex h-[100dvh] min-h-[100svh] w-screen shrink-0 items-center justify-center px-4">
          <h2 className="whitespace-nowrap text-center text-4xl font-bold tracking-tight sm:text-5xl">
            <Link href="/projects" className="rounded underline underline-offset-8">
              See all projects
            </Link>
          </h2>
        </div>
      </div>
    </section>
  );
}
