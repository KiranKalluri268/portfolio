"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAudio } from "@/context/AudioContextProvider";
import { useScrollActions } from "@/context/SmoothScrollContext";

interface ParticleProps {
  radius: number;
  size: number;
  angle: number;
  speed: number;
  orbitRadius: number;
  centerX: number;
  centerY: number;
}

class LoadingParticle {
  radius: number;
  size: number;
  angle: number;
  speed: number;
  orbitRadius: number;
  centerX: number;
  centerY: number;
  tailLength: number;
  trail: { x: number; y: number }[] = [];

  constructor(props: ParticleProps & { tailLength: number }) {
    this.radius = props.radius;
    this.size = props.size;
    this.angle = props.angle;
    this.speed = props.speed;
    this.orbitRadius = props.orbitRadius;
    this.centerX = props.centerX;
    this.centerY = props.centerY;
    this.tailLength = props.tailLength;
  }

  update() {
    this.angle += this.speed;
    if (this.angle > Math.PI * 2) this.angle -= Math.PI * 2;

    const x = this.centerX + this.orbitRadius * Math.cos(this.angle);
    const y = this.centerY + this.orbitRadius * Math.sin(this.angle);

    this.trail.push({ x, y });

    if (this.trail.length > this.tailLength) this.trail.shift();

    return { x, y };
  }
}

interface LoadingScreenProps {
  tailLength?: number;
  thickness?: number;
  speed?: number;
  numParticles?: number;
  color?: string;
  orbitRadii?: number[];
  particleRadius?: number;
}

const DEFAULT_ORBIT_RADII = [80, 90];

function hexToRgb(hex: string) {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    }
    : null;
}

function colorToRgba(color: string, alpha: number) {
  const rgb = hexToRgb(color);
  if (rgb) {
    return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
  }
  return `rgba(255,255,255,${alpha})`;
}

export default function LoadingScreen({
  tailLength = 60,
  thickness = 2.2,
  speed = 0.05,
  numParticles = 2,
  color = "white",
  orbitRadii = DEFAULT_ORBIT_RADII,
  particleRadius = 1.8,
}: LoadingScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<LoadingParticle[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { hasEntered, enterPortfolio } = useAudio();
  const { lenis } = useScrollActions();
  const [dismissed, setDismissed] = useState(hasEntered);
  const [isExiting, setIsExiting] = useState(false);
  /** The entry screen has to cover the site header and the scene dots. Both sit
   *  in the document's own stacking context while the page is inside a z-10
   *  wrapper, so no z-index here can reach over them from where this renders —
   *  it goes to the body instead. */
  const [portalReady, setPortalReady] = useState(false);

  // Loading progress state
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Responsive canvas size
  const [canvasSize, setCanvasSize] = useState({ width: 300, height: 300 });

  useEffect(() => {
    function updateCanvasSize() {
      if (!canvasRef.current) return;
      const parent = canvasRef.current.parentElement;
      if (!parent) return;

      const style = getComputedStyle(parent);
      const width =
        parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height =
        parent.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);

      setCanvasSize({ width, height });
    }
    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
    // portalReady: the canvas does not exist until the overlay has been
    // portalled, and measuring a ref that is still null does nothing at all.
  }, [portalReady]);

  // Prepare only assets needed for the first frame and entry experience.
  useLayoutEffect(() => {
    if (dismissed) return;

    const startedAt = performance.now();
    const completed = new Set<string>();
    const cleanups: Array<() => void> = [];
    let readyTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let readyScheduled = false;

    const finish = () => {
      if (readyScheduled) return;
      readyScheduled = true;
      const minimumDelay = Math.max(0, 700 - (performance.now() - startedAt));
      readyTimer = setTimeout(() => {
        if (cancelled) return;
        setLoadingProgress(100);
        setIsLoaded(true);
      }, minimumDelay);
    };

    const complete = (key: string, progress: number) => {
      if (cancelled || completed.has(key)) return;
      completed.add(key);
      setLoadingProgress((current) => Math.max(current, progress));
      if (completed.size === 3) finish();
    };

    document.fonts.ready.then(() => complete("fonts", 30)).catch(() => complete("fonts", 30));

    const prepareMedia = (
      selector: string,
      key: string,
      progress: number,
      readyState: number,
      eventName: "loadeddata" | "canplay",
    ) => {
      const media = document.querySelector<HTMLMediaElement>(selector);
      if (!media) {
        complete(key, progress);
        return;
      }
      const handleReady = () => complete(key, progress);
      if (media.readyState >= readyState) handleReady();
      else {
        media.addEventListener(eventName, handleReady, { once: true });
        media.addEventListener("error", handleReady, { once: true });
        media.load();
        cleanups.push(() => {
          media.removeEventListener(eventName, handleReady);
          media.removeEventListener("error", handleReady);
        });
      }
    };

    prepareMedia("[data-blackhole-video]", "video", 75, HTMLMediaElement.HAVE_CURRENT_DATA, "loadeddata");
    prepareMedia("[data-portfolio-audio]", "audio", 100, HTMLMediaElement.HAVE_FUTURE_DATA, "canplay");

    const fallbackTimer = setTimeout(() => {
      if (!cancelled) finish();
    }, 8000);

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
      if (readyTimer) clearTimeout(readyTimer);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [dismissed]);

  useEffect(() => {
    if (dismissed) return;
    const body = document.body;
    const portfolio = document.getElementById("portfolio-content");
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    window.scrollTo(0, 0);
    lenis?.scrollTo(0, { immediate: true });
    lenis?.stop();
    if (portfolio) {
      portfolio.inert = true;
      portfolio.setAttribute("aria-hidden", "true");
    }

    return () => {
      body.style.overflow = previousOverflow;
      lenis?.start();
      if (portfolio) {
        portfolio.inert = false;
        portfolio.removeAttribute("aria-hidden");
      }
    };
  }, [dismissed, lenis]);

  useEffect(() => {
    if (dismissed) return; // don't run animation if hidden

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;
    ctx.scale(dpr, dpr);

    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;

    particlesRef.current = Array(numParticles)
      .fill(null)
      .map((_, i) => {
        return new LoadingParticle({
          radius: particleRadius,
          size: particleRadius,
          angle: (2 * Math.PI * i) / numParticles,
          speed,
          orbitRadius: orbitRadii[i % orbitRadii.length] || 50,
          centerX,
          centerY,
          tailLength,
        });
      });

    let lastFrame = 0;
    function draw(time = 0) {
      if (!canvas) return;
      if (document.hidden || time - lastFrame < 1000 / 30) {
        animationFrameRef.current = requestAnimationFrame(draw);
        return;
      }
      lastFrame = time;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

      particlesRef.current.forEach((p) => {
        const pos = p.update();

        for (let i = 1; i < p.trail.length; i++) {
          const prev = p.trail[i - 1];
          const curr = p.trail[i];

          const t = i / p.trail.length;
          ctx.beginPath();
          ctx.strokeStyle = colorToRgba(color, t * 0.7);
          ctx.lineWidth = p.size * thickness;
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(curr.x, curr.y);
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        ctx.arc(pos.x, pos.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      animationFrameRef.current = requestAnimationFrame(draw);
    }

    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [canvasSize, color, thickness, speed, numParticles, orbitRadii, particleRadius, tailLength, dismissed, portalReady]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!dismissed) overlayRef.current?.focus({ preventScroll: true });
  }, [dismissed, portalReady]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && !dismissed && !isExiting && isLoaded) buttonRef.current?.click();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dismissed, isExiting, isLoaded]);

  useEffect(() => () => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
  }, []);

  const handleEnter = () => {
    if (!isLoaded || isExiting) return;
    setIsExiting(true);

    // These calls stay inside the user interaction for strict autoplay policies.
    document.querySelector<HTMLAudioElement>("[data-portfolio-audio]")?.play().catch(() => {});
    document.querySelector<HTMLVideoElement>("[data-blackhole-video]")?.play().catch(() => {});
    enterPortfolio();
    exitTimerRef.current = setTimeout(() => setDismissed(true), 700);
  };

  if (dismissed || !portalReady) return null;

  return createPortal(
    <div
      ref={overlayRef}
      tabIndex={-1}
      className={`fixed inset-0 z-[9999] flex min-h-[100svh] items-center justify-center bg-black outline-none transition-opacity duration-700 ease-out ${isExiting ? "pointer-events-none opacity-0" : "opacity-100"}`}
      role="dialog"
      aria-modal="true"
      aria-label="Portfolio entry"
      aria-busy={!isLoaded}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute top-0 left-0 h-[100dvh] w-screen rounded-full bg-transparent"
      />

      <div className="relative z-10 flex flex-col items-center justify-center h-[60px]">
          {!isLoaded ? (
            <p
              key="loading-text"
              className="animate-fade-in text-2xl md:text-3xl font-bold font-mono"
              style={{ color: color }}
            >
              <span aria-live="polite">{loadingProgress}%</span>
            </p>
          ) : (
            <button
              ref={buttonRef}
              type="button"
              onClick={handleEnter}
              className="animate-pop-in cursor-pointer rounded bg-transparent p-4 text-2xl font-bold transition-transform duration-200 hover:scale-115 active:scale-95 md:text-3xl"
              style={{ color }}
              aria-label="Enter portfolio and enable audio"
            >
              Enter
            </button>
          )}
      </div>

      <p
        className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-0 w-full px-4 text-center text-xs font-light tracking-wider select-none sm:text-sm md:text-base"
        style={{ color: colorToRgba(color, 0.7) }}
      >
        Press Enter to open the portfolio with audio. You can mute it anytime from the top control.
      </p>
    </div>,
    document.body,
  );
}
