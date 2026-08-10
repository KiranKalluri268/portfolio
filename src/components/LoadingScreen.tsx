"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAudio } from "@/context/AudioContextProvider";
import { ENTRY_RELEASE_MS } from "./entry-timing";
import { lockPageScroll } from "./page-scroll-lock";
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
  /** Resting geometry, kept so the exit can work from it. */
  readonly baseOrbitRadius: number;
  readonly baseSpeed: number;
  /** Set when the particle stops turning and keeps going straight: where it
   *  was let go, the direction it was travelling, and how far along it is. */
  released: { x: number; y: number; dx: number; dy: number } | null = null;
  travel = 0;

  constructor(props: ParticleProps & { tailLength: number }) {
    this.baseOrbitRadius = props.orbitRadius;
    this.baseSpeed = props.speed;
    this.radius = props.radius;
    this.size = props.size;
    this.angle = props.angle;
    this.speed = props.speed;
    this.orbitRadius = props.orbitRadius;
    this.centerX = props.centerX;
    this.centerY = props.centerY;
    this.tailLength = props.tailLength;
  }

  /** Stops turning and keeps the velocity it had: straight out along the
   *  tangent, which is the direction it was already travelling. */
  release() {
    if (this.released) return;
    this.released = {
      x: this.centerX + this.orbitRadius * Math.cos(this.angle),
      y: this.centerY + this.orbitRadius * Math.sin(this.angle),
      dx: -Math.sin(this.angle),
      dy: Math.cos(this.angle),
    };
  }

  update() {
    if (this.released) {
      const x = this.released.x + this.released.dx * this.travel;
      const y = this.released.y + this.released.dy * this.travel;
      this.trail.push({ x, y });
      if (this.trail.length > this.tailLength) this.trail.shift();
      return { x, y };
    }

    // Sampled finely enough that the straight lines between points still read
    // as a circle at speed.
    const steps = Math.max(1, Math.ceil(Math.abs(this.speed) / MAX_TRAIL_STEP));
    let x = this.centerX;
    let y = this.centerY;
    for (let i = 0; i < steps; i++) {
      this.angle += this.speed / steps;
      if (this.angle > Math.PI * 2) this.angle -= Math.PI * 2;
      x = this.centerX + this.orbitRadius * Math.cos(this.angle);
      y = this.centerY + this.orbitRadius * Math.sin(this.angle);
      this.trail.push({ x, y });
      if (this.trail.length > this.tailLength) this.trail.shift();
    }

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

/** What sits under the rings while the portfolio loads, and when it changes.
 *  The first line is what every loading screen says; the second is what this
 *  one has to say about it. */
const LOADING_LINES = [
  "Loading",
  "Yeah kinda sucks, can't help but worth the wait",
];

/** How long the plain line holds alone before the second one joins it under.
 *  Long enough that a fast connection never sees the joke, which is the right
 *  way round. */
const LOADING_QUIP_MS = 2500;

/** The word fades while the orbit winds up, and the particles are let go at
 *  the end of it. Long enough to watch it speed up, which is the point of it.
 *  Shared with the hero, which waits for it before it starts typing. */
const SPIN_MS = ENTRY_RELEASE_MS;

/** How long they take to clear the screen once they are free. */
const ESCAPE_MS = 750;
const EXIT_MS = SPIN_MS + ESCAPE_MS;

/** Without an orbit to watch there is nothing to time a fade to, so reduced
 *  motion gets a short one instead of a slow one. */
const REDUCED_EXIT_MS = 300;

/** What the orbit speeds up to before it lets go. Steep on purpose: the point
 *  of the wind-up is watching it get away from itself. */
const RELEASE_SPIN = 9;

/** The furthest the orbit may advance between two trail points, in radians.
 *  The trail is drawn as straight lines between what it sampled, so at nine
 *  times the resting speed one point per frame turns the ring into a visible
 *  polygon. Sub-stepping keeps it a curve and, as a side effect, keeps the arc
 *  the same length in radians however fast it is going — so the wind-up reads
 *  as one arc turning faster rather than as a growing smear. */
const MAX_TRAIL_STEP = 0.06;

/** Straight lines need no smoothing, so the tail can be short once free. */
const ESCAPE_TAIL = 12;

/** How narrow the opening gets across its short axis, against its long one, at
 *  the pointiest moment. It is a circle at both ends of the flight. */
const SQUASH_MIN = 0.45;

/** The curtain lifts off black as the orbit winds up. It has to: the page
 *  behind it is black too, so cutting a hole in a black screen over a black
 *  page shows nothing at all. By the time the opening appears the curtain is
 *  grey and the page reads as the darker thing. */
const CURTAIN_GREY = 61;

/** Fraction of the escape spent growing the opening from the ring out to the
 *  particles, so it does not jump the moment they are let go. */
const OPENING_LEAD_IN = 0.12;

/** The hole is there from the start, framing the orbit rather than growing out
 *  of the middle of it: just inside the inner ring when the word begins to go,
 *  just outside the outer one by the time they are let go. */
const HOLE_FROM = 0.94;
const HOLE_TO = 1.1;

/** Fraction of the hole that is fully clear before its edge starts to soften,
 *  while it is still a circle. Low, because a soft circumference is the point
 *  of it — it should read as something coming through rather than as a disc
 *  cut out of the curtain. */
const HOLE_FEATHER = 0.45;

/** Fraction of the opening that is fully clear before the edge softens. */
const FEATHER_FROM = 0.72;

/** Past the far corner rather than exactly to it, so the soft edge finishes
 *  off screen instead of leaving a ring of dusk in the corners. */
const OVERSHOOT = 1.35;

interface ExitFlight {
  startedAt: number;
  centre: { x: number; y: number };
  /** How far the particles travel from where they were let go. */
  distance: number;
}

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
  /** Which of the two lines under the rings is showing. */
  const [loadingLine, setLoadingLine] = useState(0);
  /** Set the moment Enter is pressed, read by the draw loop every frame. A ref
   *  rather than state, so starting it does not rebuild the loop. */
  const flightRef = useRef<ExitFlight | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  /** Whether this exit is the flight or the plain fade reduced motion gets. */
  const [isFlying, setIsFlying] = useState(false);

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
    const portfolio = document.getElementById("portfolio-content");
    // Counted, because the site menu holds the page still too and both are
    // holding it at once when Home is reached through the menu.
    const releaseScroll = lockPageScroll(lenis);
    window.scrollTo(0, 0);
    lenis?.scrollTo(0, { immediate: true });
    if (portfolio) {
      portfolio.inert = true;
      portfolio.setAttribute("aria-hidden", "true");
    }

    return () => {
      releaseScroll();
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
      if (document.hidden || (!flightRef.current && time - lastFrame < 1000 / 30)) {
        animationFrameRef.current = requestAnimationFrame(draw);
        return;
      }
      lastFrame = time;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

      const flight = flightRef.current;
      if (flight) {
        const elapsed = time - flight.startedAt;
        const windUp = Math.min(1, elapsed / SPIN_MS);
        const particles = particlesRef.current;

        if (elapsed < SPIN_MS) {
          // Winding up while the word fades from inside it.
          const t = elapsed / SPIN_MS;
          particles.forEach((p) => {
            p.speed = p.baseSpeed * (1 + (RELEASE_SPIN - 1) * t * t);
          });
        } else {
          // Let go, and accelerating away along the tangent.
          const t = Math.min(1, (elapsed - SPIN_MS) / ESCAPE_MS);
          particles.forEach((p) => {
            p.release();
            p.travel = flight.distance * t ** 1.8;
            p.tailLength = ESCAPE_TAIL;
          });
        }

        // The curtain moves to the canvas so the opening can be cut in it. The
        // black div behind is dropped on the same frame it is first painted,
        // which is why this happens here rather than through React. It starts
        // at black so there is nothing to see in the handover.
        const level = Math.round(CURTAIN_GREY * (1 - (1 - windUp) ** 2));
        ctx.fillStyle = `rgb(${level},${level},${level})`;
        ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
        if (backdropRef.current) backdropRef.current.style.opacity = "0";

        // The opening: an ellipse whose two ends are the particles themselves,
        // so the page is uncovered by them rather than merely at the same time.
        // Their line swings round as they separate — they leave on a tangent,
        // not straight out — and the ellipse turns with it.
        // The hole opens inside the ring while the word fades, so the orbit is
        // turning around something rather than around nothing, and by the time
        // they are let go there is already a way through for them to tear open.
        const outer = particles.reduce((widest, p) => (p.baseOrbitRadius > widest.baseOrbitRadius ? p : widest), particles[0]);
        const inner = particles.reduce((narrowest, p) => Math.min(narrowest, p.baseOrbitRadius), Infinity);
        const held = outer.baseOrbitRadius * HOLE_TO;
        if (outer) {
          let major: number;
          let angle = 0;
          let squash = 1;
          // How much of the curtain the hole takes away where it is fully
          // open, and how far in from its rim that begins.
          let clarity = 1;
          let feather = FEATHER_FROM;

          if (outer.released) {
            const pos = {
              x: outer.released.x + outer.released.dx * outer.travel,
              y: outer.released.y + outer.released.dy * outer.travel,
            };
            const dx = pos.x - flight.centre.x;
            const dy = pos.y - flight.centre.y;
            const escaped = Math.min(1, outer.travel / flight.distance);
            // The hole is already a little ahead of them at release. They catch
            // it up and drag it out from there, so it never shrinks back.
            major = Math.max(held, Math.hypot(dx, dy));
            angle = Math.atan2(dy, dx);
            // Round at both ends of the flight, pointiest in the middle.
            squash = 1 - (1 - SQUASH_MIN) * Math.sin(Math.PI * escaped);
            // The soft circumference firms up as it becomes an opening rather
            // than a window.
            const lead = Math.min(1, escaped / OPENING_LEAD_IN);
            feather = HOLE_FEATHER + (FEATHER_FROM - HOLE_FEATHER) * lead;
          } else {
            // Not a dot inflating: a window the size of the ring, coming
            // through as the word goes. Rotation cannot show on a circle, so
            // the swing to the particles' line costs nothing here.
            const from = inner * HOLE_FROM;
            major = from + (held - from) * windUp;
            clarity = windUp;
            feather = HOLE_FEATHER;
          }

          ctx.save();
          ctx.globalCompositeOperation = "destination-out";
          ctx.translate(flight.centre.x, flight.centre.y);
          ctx.rotate(angle);
          ctx.scale(1, Math.max(squash, 0.01));
          const opening = ctx.createRadialGradient(0, 0, 0, 0, 0, major);
          opening.addColorStop(0, `rgba(0,0,0,${clarity})`);
          opening.addColorStop(feather, `rgba(0,0,0,${clarity})`);
          opening.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = opening;
          ctx.beginPath();
          ctx.arc(0, 0, major, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

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
    if (isLoaded) return;
    const timer = window.setTimeout(() => setLoadingLine(1), LOADING_QUIP_MS);
    return () => window.clearTimeout(timer);
  }, [isLoaded]);

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
    // Before the flight, not after: the hero types its headline off hasEntered,
    // so it is already coming in behind the black as this clears.
    enterPortfolio();

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setIsFlying(!reduced);
    if (!reduced) {
      const centre = { x: canvasSize.width / 2, y: canvasSize.height / 2 };
      const corner = Math.hypot(
        Math.max(centre.x, canvasSize.width - centre.x),
        Math.max(centre.y, canvasSize.height - centre.y),
      );
      const orbit = particlesRef.current.reduce(
        (widest, p) => Math.max(widest, p.baseOrbitRadius),
        1,
      );
      // They leave on a tangent, so their distance from the centre is the
      // hypotenuse of the orbit and how far they have run. This solves that
      // for the run that puts the far corner inside the opening.
      const reach = corner * OVERSHOOT;
      flightRef.current = {
        startedAt: performance.now(),
        centre,
        distance: Math.sqrt(Math.max(reach * reach - orbit * orbit, 1)),
      };
    }
    exitTimerRef.current = setTimeout(
      () => setDismissed(true),
      reduced ? REDUCED_EXIT_MS : EXIT_MS,
    );
  };

  if (dismissed || !portalReady) return null;

  return createPortal(
    <div
      ref={overlayRef}
      tabIndex={-1}
      className={`fixed inset-0 z-[9999] flex min-h-[100svh] items-center justify-center outline-none ${isExiting ? "pointer-events-none" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Portfolio entry"
      aria-busy={!isLoaded}
    >
      {/* Its own layer, so the canvas can take the black over and cut the
          opening into it. Only reduced motion fades this. */}
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-black transition-opacity ease-out"
        style={{
          opacity: isExiting && !isFlying ? 0 : 1,
          transitionDuration: `${isExiting && !isFlying ? REDUCED_EXIT_MS : 0}ms`,
        }}
      />

      {/* No rounding: once this carries the curtain, a border radius would
          clip the corners and leave the page showing through them. */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute top-0 left-0 h-[100dvh] w-screen bg-transparent"
      />

      <div
        className={`relative z-10 flex h-[60px] flex-col items-center justify-center transition-opacity ease-out ${isExiting ? "opacity-0" : "opacity-100"}`}
        style={{ transitionDuration: `${SPIN_MS}ms` }}
      >
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

      {/* Under the rings, not inside them: the middle belongs to the count and
          then to the word. The second line arrives beneath the first rather
          than in place of it — the remark is about the wait, so the wait has to
          still be on screen for it to be a remark. They stack downward, so
          nothing already read moves when it lands. Neither is announced: the
          count above already says what is happening. */}
      <div
        className="entry-lines pointer-events-none absolute top-1/2 left-1/2 w-full -translate-x-1/2 translate-y-[7.5rem] px-6 text-center select-none"
        aria-hidden="true"
      >
        {LOADING_LINES.map((line, index) => (
          <p
            key={line}
            className={`text-xs font-light tracking-wider transition-opacity duration-500 ease-out sm:text-sm ${
              index > 0 ? "mt-2" : ""
            } ${!isLoaded && loadingLine >= index ? "opacity-100" : "opacity-0"}`}
            style={{ color: colorToRgba(color, 0.55) }}
          >
            {line}
          </p>
        ))}
      </div>

      <p
        className={`absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-0 w-full px-4 text-center text-xs font-light tracking-wider transition-opacity ease-out select-none sm:text-sm md:text-base ${isExiting ? "opacity-0" : "opacity-100"}`}
        style={{ color: colorToRgba(color, 0.7), transitionDuration: `${SPIN_MS}ms` }}
      >
        Press Enter to open the portfolio with audio. You can mute it anytime from the top control.
      </p>
    </div>,
    document.body,
  );
}
