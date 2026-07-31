"use client";

import { type Ref, useLayoutEffect, useRef } from "react";
import type { SkillCategory } from "@/types";
import { useScrollActions } from "@/context/SmoothScrollContext";
import gsap from "gsap";
import {
  FaCss3Alt,
  FaGitAlt,
  FaHtml5,
  FaJava,
  FaJs,
  FaPython,
  FaReact,
} from "react-icons/fa";
import {
  SiAmazondynamodb,
  SiAmazonwebservices,
  SiCanva,
  SiCloudinary,
  SiDocker,
  SiExpress,
  SiFigma,
  SiLangchain,
  SiLinux,
  SiMongodb,
  SiMysql,
  SiNextdotjs,
  SiNodedotjs,
  SiPostgresql,
  SiSupabase,
  SiTableau,
  SiTailwindcss,
  SiTensorflow,
  SiTypescript,
} from "react-icons/si";

const skillCategories: SkillCategory[] = [
  {
    title: "Web & Frameworks",
    skills: [
      { name: "React", icon: <FaReact /> },
      { name: "Next.js", icon: <SiNextdotjs /> },
      { name: "JavaScript", icon: <FaJs /> },
      { name: "TypeScript", icon: <SiTypescript /> },
      { name: "Node.js", icon: <SiNodedotjs /> },
      { name: "Express", icon: <SiExpress /> },
      { name: "Tailwind CSS", icon: <SiTailwindcss /> },
      { name: "HTML5", icon: <FaHtml5 /> },
      { name: "CSS3", icon: <FaCss3Alt /> },
    ],
  },
  {
    title: "AI & Programming",
    skills: [
      { name: "Python", icon: <FaPython /> },
      { name: "Java", icon: <FaJava /> },
      { name: "TensorFlow.js", icon: <SiTensorflow /> },
      { name: "LangChain", icon: <SiLangchain /> },
      { name: "RAG", icon: <span className="font-bold">RAG</span> },
      { name: "Deep Learning", icon: <span className="font-bold">DL</span> },
    ],
  },
  {
    title: "Data & Cloud",
    skills: [
      { name: "MongoDB", icon: <SiMongodb /> },
      { name: "MySQL", icon: <SiMysql /> },
      { name: "PostgreSQL", icon: <SiPostgresql /> },
      { name: "Supabase", icon: <SiSupabase /> },
      { name: "DynamoDB", icon: <SiAmazondynamodb /> },
      { name: "AWS", icon: <SiAmazonwebservices /> },
      { name: "Docker", icon: <SiDocker /> },
    ],
  },
  {
    title: "Tools",
    skills: [
      { name: "Git", icon: <FaGitAlt /> },
      { name: "Linux", icon: <SiLinux /> },
      { name: "Figma", icon: <SiFigma /> },
      { name: "Canva", icon: <SiCanva /> },
      { name: "Tableau", icon: <SiTableau /> },
      { name: "Cloudinary", icon: <SiCloudinary /> },
    ],
  },
];

interface SkillRowProps {
  category: SkillCategory;
  reverse: boolean;
}

function SkillGroup({
  category,
  duplicate = false,
  elementRef,
}: {
  category: SkillCategory;
  duplicate?: boolean;
  elementRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={elementRef}
      className="flex shrink-0 items-center justify-start"
      aria-hidden={duplicate || undefined}
    >
      {category.skills.map((skill) => (
        <div
          key={`${category.title}-${skill.name}`}
          className="mr-3 flex h-24 w-[104px] min-w-[104px] shrink-0 flex-col items-center justify-center rounded-control text-gray-300 transition-colors duration-200 hover:text-white sm:mr-6 sm:w-[124px] sm:min-w-[124px]"
          title={skill.name}
          role={duplicate ? undefined : "img"}
          aria-label={duplicate ? undefined : skill.name}
        >
          <div className="select-none text-2xl sm:text-4xl">{skill.icon}</div>
          <span className="mt-1 whitespace-nowrap text-xs select-none">{skill.name}</span>
        </div>
      ))}
    </div>
  );
}

function SkillRow({ category, reverse }: SkillRowProps) {
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
      aria-label={category.title}
    >
      <h2 className="sr-only">{category.title}</h2>
      <div
        ref={trackRef}
        className="flex w-max will-change-transform"
        onMouseEnter={() => gsap.getTweensOf(trackRef.current).forEach((tween) => tween.pause())}
        onMouseLeave={() => gsap.getTweensOf(trackRef.current).forEach((tween) => tween.play())}
      >
        <SkillGroup category={category} elementRef={groupRef} />
        <SkillGroup category={category} duplicate />
        <SkillGroup category={category} duplicate />
        <SkillGroup category={category} duplicate />
        <SkillGroup category={category} duplicate />
        <SkillGroup category={category} duplicate />
      </div>
    </div>
  );
}

export default function SkillsCarousel() {
  return (
    <section
      id="skills"
      className="relative flex min-h-[100svh] items-center justify-start overflow-hidden px-4 text-white"
      aria-label="Technical skills section"
      style={{ zIndex: 10 }}
    >
      <div className="relative left-[2vw] w-full space-y-6 py-16 sm:left-[5vw] sm:w-[82%] sm:space-y-10 sm:py-20 md:w-[72%] lg:w-[62%] xl:w-[62%]">
        <h2 className="mb-6 text-center text-3xl font-bold sm:mb-10 sm:text-4xl">Tech Stack</h2>
        {skillCategories.map((category, index) => (
          <SkillRow key={category.title} category={category} reverse={index % 2 === 1} />
        ))}
      </div>
    </section>
  );
}
