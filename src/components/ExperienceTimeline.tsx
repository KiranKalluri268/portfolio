"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import type { ExperienceContent } from "@/lib/content/types";
import { useAudio } from "@/context/AudioContextProvider";

export default function ExperienceTimeline({
  experiences,
}: {
  experiences: ExperienceContent[];
}) {
  const { hasEntered } = useAudio();
  const sectionRef = useRef<HTMLElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const glowPathRef = useRef<SVGPathElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const dotRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useLayoutEffect(() => {
    if (!hasEntered) return;

    const section = sectionRef.current;
    const timeline = timelineRef.current;
    const svg = svgRef.current;
    const glowPath = glowPathRef.current;
    const path = pathRef.current;
    if (!section || !timeline || !svg || !glowPath || !path) return;

    gsap.registerPlugin(ScrollTrigger);

    const updateCurve = () => {
      const timelineRect = timeline.getBoundingClientRect();
      const isMobile = window.matchMedia("(max-width: 767px)").matches;
      const points = dotRefs.current
        .map((dot) => {
          if (!dot) return null;
          const rect = dot.getBoundingClientRect();
          const row = dot.closest<HTMLElement>(".experience-row");
          const cards = row?.querySelectorAll<HTMLElement>(".experience-card-scale");
          const mobileGapCenter = isMobile && row && cards?.length === 2
            ? row.offsetTop
              + (cards[0].offsetTop + cards[0].offsetHeight + cards[1].offsetTop) / 2
            : null;

          return {
            x: rect.left + rect.width / 2 - timelineRect.left,
            y: mobileGapCenter ?? rect.top + rect.height / 2 - timelineRect.top,
          };
        })
        .filter((point): point is { x: number; y: number } => point !== null);

      svg.setAttribute("viewBox", `0 0 ${timelineRect.width} ${timelineRect.height}`);
      if (points.length === 0) {
        glowPath.setAttribute("d", "");
        path.setAttribute("d", "");
        return;
      }

      const commands = [`M ${points[0].x} ${points[0].y}`];
      for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const current = points[index];
        const middleY = (previous.y + current.y) / 2;
        commands.push(
          `C ${previous.x} ${middleY}, ${current.x} ${middleY}, ${current.x} ${current.y}`,
        );
      }
      const curve = commands.join(" ");
      glowPath.setAttribute("d", curve);
      path.setAttribute("d", curve);
    };

    const resizeObserver = new ResizeObserver(() => {
      updateCurve();
      ScrollTrigger.refresh();
    });
    resizeObserver.observe(timeline);
    updateCurve();

    const media = gsap.matchMedia();
    const context = gsap.context(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const createFocusAnimations = ({
        start,
        end,
        restingScale,
        restingOpacity,
      }: {
        start: string;
        end: string;
        restingScale: number;
        restingOpacity: number;
      }) => {
        gsap.utils.toArray<HTMLElement>(".experience-row").forEach((row) => {
          const cards = row.querySelectorAll<HTMLElement>(".experience-card-scale");
          gsap.timeline({
            scrollTrigger: {
              trigger: row,
              start,
              end,
              scrub: 0.35,
              invalidateOnRefresh: true,
            },
          })
            // Paired power2.out / power2.in meet with zero slope at the peak,
            // so a row decelerates into focus with no kink at the centre —
            // the same curve the projects carousel uses.
            .fromTo(cards, {
              scale: restingScale,
              opacity: restingOpacity,
            }, {
              scale: 1,
              opacity: 1,
              duration: 0.5,
              ease: "power2.out",
              force3D: true,
            })
            .to(cards, {
              scale: restingScale,
              opacity: restingOpacity,
              duration: 0.5,
              ease: "power2.in",
              force3D: true,
            });
        });
      };

      // Dimming carries most of the focus cue, which is what lets the scale go
      // this deep: an out-of-focus row reads as "not the one you're reading"
      // rather than as small body copy you are expected to parse.
      // A narrow trigger window matters as much as the resting values. At
      // "top 90%" a row was already ~87% faded in by the time it reached the
      // lower third, so the neighbouring row never looked meaningfully
      // out of focus. This keeps rows dim until they are close to centre.
      media.add("(min-width: 768px)", () => {
        createFocusAnimations({
          start: "top 75%",
          end: "bottom 25%",
          restingScale: 0.82,
          restingOpacity: 0.35,
        });
      });

      // Mobile stacks both cards vertically, so a row already fills most of the
      // viewport. Less shrink, less dimming.
      media.add("(max-width: 767px)", () => {
        createFocusAnimations({
          start: "top 82%",
          end: "bottom 18%",
          restingScale: 0.9,
          restingOpacity: 0.45,
        });
      });
      ScrollTrigger.refresh();
    }, section);

    return () => {
      resizeObserver.disconnect();
      media.revert();
      context.revert();
    };
  }, [hasEntered]);

  return (
    <section
      id="experience"
      ref={sectionRef}
      className="relative z-10 min-h-[100svh] overflow-hidden px-4 py-20 text-white sm:px-6 sm:py-24 lg:px-8"
      aria-label="Experience timeline section"
    >
      <div className="relative mx-auto w-full max-w-[1080px] lg:-left-[6vw]">
        <h2 className="mb-14 text-center text-3xl font-bold sm:text-4xl">
          Experience Timeline
        </h2>

        <div ref={timelineRef} className="relative flex flex-col gap-20 md:gap-24">
          <svg
            ref={svgRef}
            className="pointer-events-none absolute inset-0 z-[5] h-full w-full overflow-visible"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="experience-line-gradient" x1="0" y1="0" x2="0" y2="1">
                {/* `style` rather than the presentation attribute, because
                    var() does not resolve in SVG presentation attributes. */}
                <stop offset="0%" style={{ stopColor: "var(--color-accent)" }} />
                <stop offset="55%" style={{ stopColor: "var(--color-accent-violet)" }} />
                <stop offset="100%" style={{ stopColor: "var(--color-accent)" }} stopOpacity="0.25" />
              </linearGradient>
            </defs>
            <path
              ref={glowPathRef}
              fill="none"
              style={{ stroke: "var(--color-accent)" }}
              strokeWidth="7"
              strokeLinecap="round"
              strokeOpacity="0.2"
              vectorEffect="non-scaling-stroke"
            />
            <path
              ref={pathRef}
              fill="none"
              stroke="url(#experience-line-gradient)"
              strokeWidth="2.5"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {experiences.map((experience, index) => (
            <ExperienceRow
              key={experience.slug}
              experience={experience}
              index={index}
              dotRef={(dot) => {
                dotRefs.current[index] = dot;
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

interface ExperienceRowProps {
  experience: ExperienceContent;
  index: number;
  dotRef: (dot: HTMLSpanElement | null) => void;
}

function ExperienceRow({ experience, index, dotRef }: ExperienceRowProps) {
  const isReversed = index % 2 === 1;
  const rowShift = isReversed ? "lg:-left-12" : "lg:left-12";
  const detailColumn = isReversed ? "md:col-start-3" : "md:col-start-1";
  const descriptionColumn = isReversed ? "md:col-start-1" : "md:col-start-3";
  const desktopColumns = isReversed
    ? "md:grid-cols-[minmax(0,1.28fr)_64px_minmax(0,0.72fr)]"
    : "md:grid-cols-[minmax(0,0.72fr)_64px_minmax(0,1.28fr)]";

  return (
    <article
      className={`experience-row relative grid grid-cols-[32px_minmax(0,1fr)] gap-x-3 gap-y-4 ${desktopColumns} md:items-stretch md:gap-x-5 md:gap-y-0 ${rowShift}`}
      aria-label={`${experience.role} at ${experience.company}`}
    >
      <div
        className={`experience-card-scale relative z-10 will-change-[transform,opacity] col-start-2 row-start-1 origin-center ${detailColumn} md:row-start-1 ${isReversed ? "md:origin-left" : "md:origin-right"}`}
      >
        <Link
          href={`/experience/${experience.slug}`}
          className="group block h-full rounded-2xl border border-white/10 bg-black/55 p-5 shadow-xl backdrop-blur-sm transition-[background-color,border-color,box-shadow] duration-300 hover:border-accent-soft/25 hover:bg-white/5 hover:shadow-accent/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:p-6"
        >
          <h3 className="mb-3 text-xl font-bold tracking-wide sm:text-2xl">
            {experience.role}
          </h3>
          <p className="mb-4 font-medium text-accent-soft">{experience.company}</p>
          <dl className="space-y-3 text-sm text-gray-300">
            <div>
              <dt className="text-xs uppercase tracking-wider text-gray-500">Period</dt>
              <dd className="mt-1">
                <time dateTime={experience.period.startDate}>{experience.period.startLabel}</time>
                <span aria-hidden="true"> – </span>
                {experience.period.endDate ? (
                  <time dateTime={experience.period.endDate}>{experience.period.endLabel}</time>
                ) : (
                  <span>{experience.period.endLabel}</span>
                )}
              </dd>
            </div>
            {experience.location && (
              <div>
                <dt className="text-xs uppercase tracking-wider text-gray-500">Location</dt>
                <dd className="mt-1">{experience.location}</dd>
              </div>
            )}
            {experience.workMode && (
              <div>
                <dt className="text-xs uppercase tracking-wider text-gray-500">Work mode</dt>
                <dd className="mt-1">{experience.workMode}</dd>
              </div>
            )}
          </dl>
          <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-soft transition-colors group-hover:text-white">
            View role details
            <span
              className="transition-transform duration-300 group-hover:translate-x-1"
              aria-hidden="true"
            >
              →
            </span>
          </span>
        </Link>
      </div>

      <span
        ref={dotRef}
        className="relative z-10 col-start-1 row-start-2 -translate-y-full self-start justify-self-center rounded-full border border-white/70 bg-accent shadow-[0_0_14px_rgba(59,130,246,0.9)] md:col-start-2 md:row-start-1 md:translate-y-0 md:place-self-center"
        style={{ width: 16, height: 16 }}
        aria-hidden="true"
      />

      <div
        className={`experience-card-scale relative z-10 will-change-[transform,opacity] col-start-2 row-start-2 origin-center ${descriptionColumn} md:row-start-1 ${isReversed ? "md:origin-right" : "md:origin-left"}`}
      >
        <div className="h-full rounded-2xl border border-white/10 bg-black/55 p-5 shadow-xl backdrop-blur-sm transition-[background-color,border-color,box-shadow] duration-300 hover:border-purple-400/25 hover:bg-white/5 hover:shadow-purple-500/10 sm:p-6">
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-400">
            Highlights
          </h4>
          <ul className="space-y-3 text-sm leading-relaxed text-gray-300 sm:text-base">
            {experience.highlights.map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-[0.65em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-soft" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}
