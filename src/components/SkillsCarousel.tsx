"use client";

import { type Ref, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import type { SkillCategoryContent, SkillContent } from "@/lib/content/types";
import { useScrollActions } from "@/context/SmoothScrollContext";
import SkewOnScroll from "./SkewOnScroll";
import gsap from "gsap";
import { SkillMark } from "./skills/skill-icons";

export interface SkillCategoryGroup {
  category: SkillCategoryContent;
  skills: SkillContent[];
}

interface SkillRowProps {
  group: SkillCategoryGroup;
  reverse: boolean;
}

function SkillGroup({
  group,
  duplicate = false,
  elementRef,
}: {
  group: SkillCategoryGroup;
  duplicate?: boolean;
  elementRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={elementRef}
      className="flex shrink-0 items-center justify-start"
      aria-hidden={duplicate || undefined}
    >
      {group.skills.map((skill) => (
        <Link
          key={`${group.category.slug}-${skill.slug}`}
          href={`/skills/${skill.slug}`}
          className="mr-3 flex h-24 w-[104px] min-w-[104px] shrink-0 flex-col items-center justify-center rounded-control text-gray-300 transition-colors duration-200 hover:text-white sm:mr-6 sm:w-[124px] sm:min-w-[124px]"
          title={skill.name}
          aria-label={duplicate ? undefined : `Learn more about ${skill.name}`}
          tabIndex={duplicate ? -1 : 0}
        >
          <div className="flex h-10 items-center justify-center select-none text-xl font-bold sm:text-2xl">
            <SkillMark skill={skill} />
          </div>
          {/* Two lines, then an ellipsis. A fixed height rather than a natural
              one so every icon in the row sits at the same level whether its
              label wraps or not — the full name is on the link's title. */}
          <span className="mt-1 line-clamp-2 h-8 text-center text-xs leading-4 select-none">
            {skill.name}
          </span>
        </Link>
      ))}
    </div>
  );
}

function SkillRow({ group, reverse }: SkillRowProps) {
  const { lenis } = useScrollActions();
  const rowRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const row = rowRef.current;
    const track = trackRef.current;
    const group = groupRef.current;
    if (!row || !track || !group) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches) return;

    let tween: gsap.core.Tween | undefined;
    let speedTween: gsap.core.Tween | undefined;
    let resetSpeedTimer = 0;
    let visible = false;
    let scrollDirection = 1;

    const setSpeed = (timeScale: number) => {
      if (!tween) return;
      speedTween?.kill();
      speedTween = gsap.to(tween, {
        timeScale,
        duration: Math.abs(timeScale) > 1 ? 0.18 : 0.55,
        ease: "power2.out",
        overwrite: true,
      });
    };

    const handleScroll = ({ velocity }: { velocity: number }) => {
      if (!visible || !tween) return;
      if (Math.abs(velocity) > 0.01) scrollDirection = velocity < 0 ? -1 : 1;
      const acceleratedSpeed = scrollDirection * (1 + Math.min(3, Math.abs(velocity) * 0.2));
      setSpeed(acceleratedSpeed);
      window.clearTimeout(resetSpeedTimer);
      resetSpeedTimer = window.setTimeout(() => setSpeed(scrollDirection), 140);
    };

    const createTween = () => {
      const distance = group.getBoundingClientRect().width;
      if (!distance) return;

      tween?.kill();
      speedTween?.kill();
      gsap.set(track, { x: reverse ? -distance : 0 });
      tween = gsap.to(track, {
        x: reverse ? 0 : -distance,
        duration: distance / 42,
        ease: "none",
        repeat: -1,
        force3D: true,
        paused: !visible,
      });
    };

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (!tween) createTween();
        else if (visible) tween.play();
        else {
          window.clearTimeout(resetSpeedTimer);
          scrollDirection = 1;
          tween.timeScale(1).pause();
        }
      },
      { threshold: 0 },
    );
    const resizeObserver = new ResizeObserver(createTween);

    visibilityObserver.observe(row);
    resizeObserver.observe(group);
    lenis?.on("scroll", handleScroll);

    return () => {
      window.clearTimeout(resetSpeedTimer);
      visibilityObserver.disconnect();
      resizeObserver.disconnect();
      lenis?.off("scroll", handleScroll);
      speedTween?.kill();
      tween?.kill();
      gsap.set(track, { clearProps: "transform" });
    };
  }, [lenis, reverse]);

  return (
    <div
      ref={rowRef}
      className="relative w-full overflow-hidden"
      style={{
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0%, black 7%, black 93%, transparent 100%)",
        maskImage:
          "linear-gradient(to right, transparent 0%, black 7%, black 93%, transparent 100%)",
      }}
      aria-label={group.category.label}
    >
      <h2 className="sr-only">{group.category.label}</h2>
      <div
        ref={trackRef}
        className="flex w-max will-change-transform"
        onMouseEnter={() => gsap.getTweensOf(trackRef.current).forEach((tween) => tween.pause())}
        onMouseLeave={() => gsap.getTweensOf(trackRef.current).forEach((tween) => tween.play())}
      >
        <SkillGroup group={group} elementRef={groupRef} />
        <SkillGroup group={group} duplicate />
        <SkillGroup group={group} duplicate />
        <SkillGroup group={group} duplicate />
        <SkillGroup group={group} duplicate />
        <SkillGroup group={group} duplicate />
      </div>
    </div>
  );
}

export default function SkillsCarousel({ groups }: { groups: SkillCategoryGroup[] }) {
  return (
    <section
      id="skills"
      className="relative flex min-h-[100svh] items-center justify-start overflow-hidden px-4 text-white"
      aria-label="Technical skills section"
      style={{ zIndex: 10 }}
    >
      <SkewOnScroll className="relative left-[2vw] w-full space-y-6 py-16 sm:left-[5vw] sm:w-[82%] sm:space-y-10 sm:py-20 md:w-[72%] lg:w-[62%] xl:w-[62%]">
        <h2 className="mb-6 text-center text-3xl font-bold sm:mb-10 sm:text-4xl">Tech Stack</h2>
        {groups.filter((group) => group.skills.length > 0).map((group) => (
          <SkillRow
            key={group.category.slug}
            group={group}
            reverse={group.category.marqueeDirection === "right"}
          />
        ))}
      </SkewOnScroll>
    </section>
  );
}
