"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAudio } from "@/context/AudioContextProvider";

const STAR_COLORS = ["255,255,255", "255,233,196", "212,251,255"];
const MIN_STARS = 45;
const MAX_STARS = 95;
const MAX_ACTIVE_STARS = 5;
const STAR_HIT_RADIUS = 22;

type Star = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  color: string;
  flare: boolean;
};

type ActiveStar = {
  phase: "blinking" | "shooting";
  starIndex: number;
  startX: number;
  startY: number;
  distance: number;
  angle: number;
  startedAt: number;
  duration: number;
  blinkDuration: number;
};

function createRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function drawStar(context: CanvasRenderingContext2D, star: Star) {
  context.fillStyle = `rgba(${star.color},${star.alpha})`;

  if (!star.flare) {
    context.beginPath();
    context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    context.fill();
    return;
  }

  const glow = context.createRadialGradient(
    star.x,
    star.y,
    0,
    star.x,
    star.y,
    star.radius * 5,
  );
  glow.addColorStop(0, `rgba(${star.color},${star.alpha})`);
  glow.addColorStop(1, `rgba(${star.color},0)`);
  context.fillStyle = glow;
  context.beginPath();
  context.arc(star.x, star.y, star.radius * 5, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = `rgba(${star.color},${Math.min(1, star.alpha + 0.15)})`;
  context.beginPath();
  context.moveTo(star.x, star.y - star.radius * 3.5);
  context.lineTo(star.x + star.radius * 0.45, star.y - star.radius * 0.45);
  context.lineTo(star.x + star.radius * 3.5, star.y);
  context.lineTo(star.x + star.radius * 0.45, star.y + star.radius * 0.45);
  context.lineTo(star.x, star.y + star.radius * 3.5);
  context.lineTo(star.x - star.radius * 0.45, star.y + star.radius * 0.45);
  context.lineTo(star.x - star.radius * 3.5, star.y);
  context.lineTo(star.x - star.radius * 0.45, star.y - star.radius * 0.45);
  context.closePath();
  context.fill();
}

export default function StarsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { hasEntered } = useAudio();
  const pathname = usePathname();
  const backgroundEnabled = hasEntered || pathname !== "/";

  useEffect(() => {
    if (!backgroundEnabled) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context) return;

    let renderedWidth = 0;
    let renderedHeight = 0;
    let resizeFrame = 0;
    let animationFrame = 0;
    let selectionTimer = 0;
    let lastBlinkDraw = 0;
    let stars: Star[] = [];
    let activeStars: ActiveStar[] = [];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const drawActiveStar = (activeStar: ActiveStar, time: number) => {
      const source = stars[activeStar.starIndex];
      if (!source) return;

      if (activeStar.phase === "blinking") {
        const elapsed = time - activeStar.startedAt;
        const blink = (Math.sin(elapsed * 0.003) + 1) / 2;
        drawStar(context, {
          ...source,
          radius: source.radius * (1 + blink * 0.7),
          alpha: 0.2 + blink * 0.8,
          flare: true,
        });
        return;
      }

      const progress = Math.min(1, (time - activeStar.startedAt) / activeStar.duration);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const x = activeStar.startX
        + Math.cos(activeStar.angle) * activeStar.distance * easedProgress;
      const y = activeStar.startY
        + Math.sin(activeStar.angle) * activeStar.distance * easedProgress;
      const trailLength = Math.min(130, activeStar.distance * 0.2) * (1 - progress * 0.35);
      const tailX = x - Math.cos(activeStar.angle) * trailLength;
      const tailY = y - Math.sin(activeStar.angle) * trailLength;
      const opacity = Math.sin(Math.PI * progress);
      const gradient = context.createLinearGradient(tailX, tailY, x, y);
      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(0.75, `rgba(212,251,255,${opacity * 0.45})`);
      gradient.addColorStop(1, `rgba(255,255,255,${opacity})`);

      context.strokeStyle = gradient;
      context.lineWidth = 1.35;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(tailX, tailY);
      context.lineTo(x, y);
      context.stroke();

      context.fillStyle = `rgba(255,255,255,${opacity})`;
      context.beginPath();
      context.arc(x, y, 1.25, 0, Math.PI * 2);
      context.fill();
    };

    const drawScene = (time = performance.now()) => {
      context.clearRect(0, 0, renderedWidth, renderedHeight);
      const activeIndices = new Set(activeStars.map(({ starIndex }) => starIndex));
      stars.forEach((star, index) => {
        if (!activeIndices.has(index)) drawStar(context, star);
      });
      activeStars.forEach((activeStar) => drawActiveStar(activeStar, time));
    };

    const animate = (time: number) => {
      animationFrame = 0;
      if (document.hidden || activeStars.length === 0) return;

      activeStars.forEach((activeStar) => {
        if (
          activeStar.phase === "blinking"
          && time - activeStar.startedAt >= activeStar.blinkDuration
        ) {
          activeStar.phase = "shooting";
          activeStar.startedAt = time;
        }
      });

      const completedIndices = new Set(
        activeStars
          .filter(
            (activeStar) => activeStar.phase === "shooting"
              && time - activeStar.startedAt >= activeStar.duration,
          )
          .map(({ starIndex }) => starIndex),
      );
      completedIndices.forEach((starIndex) => {
        const star = stars[starIndex];
        if (!star) return;
        star.x = Math.random() * renderedWidth;
        star.y = Math.random() * renderedHeight;
      });
      activeStars = activeStars.filter(({ starIndex }) => !completedIndices.has(starIndex));

      const hasShootingStar = activeStars.some(({ phase }) => phase === "shooting");
      if (hasShootingStar || time - lastBlinkDraw >= 50 || activeStars.length === 0) {
        drawScene(time);
        lastBlinkDraw = time;
      }

      if (activeStars.length > 0) animationFrame = requestAnimationFrame(animate);
    };

    const ensureAnimation = () => {
      if (!animationFrame && activeStars.length > 0) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    const selectStar = (starIndex: number) => {
      if (
        reducedMotion.matches
        || document.hidden
        || activeStars.length >= MAX_ACTIVE_STARS
        || activeStars.some((star) => star.starIndex === starIndex)
      ) return;

      const star = stars[starIndex];
      if (!star) return;
      activeStars.push({
        phase: "blinking",
        starIndex,
        startX: star.x,
        startY: star.y,
        distance: Math.max(renderedWidth, renderedHeight) * (0.28 + Math.random() * 0.2),
        angle: Math.PI * (0.12 + Math.random() * 0.16),
        startedAt: performance.now(),
        duration: 1050 + Math.random() * 450,
        blinkDuration: 3000 + Math.random() * 5000,
      });
      ensureAnimation();
    };

    const scheduleRandomSelection = () => {
      window.clearTimeout(selectionTimer);
      if (reducedMotion.matches || document.hidden || stars.length === 0) return;
      selectionTimer = window.setTimeout(() => {
        const availableIndices = stars
          .map((_, index) => index)
          .filter((index) => !activeStars.some((star) => star.starIndex === index));
        if (activeStars.length < MAX_ACTIVE_STARS && availableIndices.length > 0) {
          selectStar(availableIndices[Math.floor(Math.random() * availableIndices.length)]);
        }
        scheduleRandomSelection();
      }, 2000 + Math.random() * 5000);
    };

    const render = () => {
      const width = document.documentElement.clientWidth;
      const height = window.innerHeight;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);

      renderedWidth = width;
      renderedHeight = height;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const random = createRandom(width * 31 + height * 17);
      const starCount = Math.round(
        Math.min(MAX_STARS, Math.max(MIN_STARS, (width * height) / 15000)),
      );
      stars = Array.from({ length: starCount }, () => {
        const flare = random() > 0.88;
        return {
          x: random() * width,
          y: random() * height,
          radius: flare ? 0.7 + random() * 0.75 : 0.35 + random() * 0.85,
          alpha: 0.35 + random() * 0.65,
          color: STAR_COLORS[Math.floor(random() * STAR_COLORS.length)],
          flare,
        };
      });
      activeStars = [];
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      drawScene();
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (
        target instanceof Element
        && target.closest("a, button, input, textarea, select, label, [role='button']")
      ) return;

      let nearestIndex = -1;
      let nearestDistance = STAR_HIT_RADIUS;
      stars.forEach((star, index) => {
        if (activeStars.some((activeStar) => activeStar.starIndex === index)) return;
        const distance = Math.hypot(event.clientX - star.x, event.clientY - star.y);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });
      if (nearestIndex >= 0) selectStar(nearestIndex);
    };

    const handleResize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        const nextWidth = document.documentElement.clientWidth;
        const nextHeight = window.innerHeight;
        const widthChanged = Math.abs(nextWidth - renderedWidth) > 1;
        const significantHeightChange = Math.abs(nextHeight - renderedHeight) > 160;
        if (widthChanged || significantHeightChange) render();
      });
    };

    const resetAnimation = () => {
      cancelAnimationFrame(animationFrame);
      window.clearTimeout(selectionTimer);
      animationFrame = 0;
      activeStars = [];
      drawScene();
      if (!document.hidden && !reducedMotion.matches) scheduleRandomSelection();
    };

    render();
    scheduleRandomSelection();
    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("click", handleClick);
    document.addEventListener("visibilitychange", resetAnimation);
    reducedMotion.addEventListener("change", resetAnimation);

    return () => {
      cancelAnimationFrame(resizeFrame);
      cancelAnimationFrame(animationFrame);
      window.clearTimeout(selectionTimer);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("click", handleClick);
      document.removeEventListener("visibilitychange", resetAnimation);
      reducedMotion.removeEventListener("change", resetAnimation);
    };
  }, [backgroundEnabled]);

  return (
    <canvas
      ref={canvasRef}
      data-stars-background
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
