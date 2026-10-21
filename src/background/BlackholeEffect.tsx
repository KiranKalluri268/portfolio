"use client";
import { useRef, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAudio } from "@/context/AudioContextProvider";
import { SECTION_IDS, useActiveSection } from "@/context/SmoothScrollContext";
import BakedBlackhole, { HOME_PATH, STILL_PATH } from "./baked-blackhole/BakedBlackhole";

const PLACEMENT =
  "fixed top-3/4 left-1/2 z-[1] aspect-square w-[min(220vw,52.5rem)] -translate-x-1/2 -translate-y-1/2 transform [transform-style:preserve-3d] sm:top-1/2 sm:left-[80%] sm:w-[52.5rem]";
const TILT = { transform: "rotateX(0deg) rotateY(0deg) rotateZ(-20deg)" };
/** The drawn black hole covers the screen and frames itself inside it. */
const DRAWN_PLACEMENT = "pointer-events-none fixed inset-x-0 top-0 z-[1]";

export default function Blackhole() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { hasEntered } = useAudio();
  const pathname = usePathname();
  const backgroundEnabled = hasEntered || pathname !== "/";
  // On the home page each section has its own resting place along the path,
  // evenly spaced from the hero to the contact form. It moves only when the
  // section changes — the one the scene dots light — and holds still while the
  // section is read.
  const activeSection = useActiveSection();
  const stop = Math.max(0, SECTION_IDS.indexOf(activeSection)) / (SECTION_IDS.length - 1);
  // Drawn on every route, so no page puts the video in its HTML or starts
  // downloading it. The video is only the answer for a browser that cannot draw
  // it — no WebGL2, a shader its driver rejects, or only a software renderer.
  // Only the home page moves it, section by section.
  const [unsupported, setUnsupported] = useState(false);
  const baked = !unsupported;

  useEffect(() => {
    if (baked) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleVisibility = () => {
      const video = videoRef.current;
      if (!video) return;
      if (!backgroundEnabled || document.hidden || reducedMotion.matches) video.pause();
      else video.play().catch(() => {});
    };
    handleVisibility();
    document.addEventListener("visibilitychange", handleVisibility);
    reducedMotion.addEventListener("change", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      reducedMotion.removeEventListener("change", handleVisibility);
    };
  }, [backgroundEnabled, baked]);

  if (baked) {
    return (
      <div>
        <BakedBlackhole
          className={DRAWN_PLACEMENT}
          enabled={backgroundEnabled}
          path={pathname === "/" ? HOME_PATH : STILL_PATH}
          stop={stop}
          onUnsupported={() => setUnsupported(true)}
        />
      </div>
    );
  }

  return (
    <div>
      <video
        ref={videoRef}
        data-blackhole-video
        autoPlay={backgroundEnabled}
        loop
        muted
        playsInline
        preload="auto"
        className={`${PLACEMENT} object-contain`}
        style={{
          background: 'transparent',
          ...TILT,
        }}
      >
        <source
          src="https://res.cloudinary.com/dytobweya/video/upload/v1789667466/optimized_safari.mov"
          type="video/quicktime"
        />
        <source
          src="https://res.cloudinary.com/dytobweya/video/upload/v1789667463/optimized.webm"
          type="video/webm"
        />
        Your browser does not support transparent video.
      </video>
    </div>
  );
}
