"use client";
import { useRef, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAudio } from "@/context/AudioContextProvider";
import BakedBlackhole from "./baked-blackhole/BakedBlackhole";

const PLACEMENT =
  "fixed top-3/4 left-1/2 z-[1] aspect-square w-[min(220vw,52.5rem)] -translate-x-1/2 -translate-y-1/2 transform [transform-style:preserve-3d] sm:top-1/2 sm:left-[80%] sm:w-[52.5rem]";
const TILT = { transform: "rotateX(0deg) rotateY(0deg) rotateZ(-20deg)" };

export default function Blackhole() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { hasEntered } = useAudio();
  const pathname = usePathname();
  const backgroundEnabled = hasEntered || pathname !== "/";
  // The home page draws the black hole; every other route keeps the video.
  // Decided from the path, which the server render knows too, so the home page
  // never puts the video in its HTML and never starts downloading it. The video
  // stays the answer for a browser that cannot draw it — no WebGL2, or a
  // shader its driver rejects.
  const [unsupported, setUnsupported] = useState(false);
  const baked = pathname === "/" && !unsupported;

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
          className={PLACEMENT}
          style={TILT}
          enabled={backgroundEnabled}
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
