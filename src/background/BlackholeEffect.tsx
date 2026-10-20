"use client";
import { useRef, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAudio } from "@/context/AudioContextProvider";
import BakedBlackhole, { DEFAULT_SCROLL_PATH, type ScrollPath } from "./baked-blackhole/BakedBlackhole";

const PLACEMENT =
  "fixed top-3/4 left-1/2 z-[1] aspect-square w-[min(220vw,52.5rem)] -translate-x-1/2 -translate-y-1/2 transform [transform-style:preserve-3d] sm:top-1/2 sm:left-[80%] sm:w-[52.5rem]";
const TILT = { transform: "rotateX(0deg) rotateY(0deg) rotateZ(-20deg)" };

/** Away from the home page the black hole holds where the home page starts it:
 *  the same distance, turn and place whatever the scroll. */
const STILL_PATH: ScrollPath = {
  distance: [DEFAULT_SCROLL_PATH.distance[0], DEFAULT_SCROLL_PATH.distance[0]],
  rollDeg: [DEFAULT_SCROLL_PATH.rollDeg[0], DEFAULT_SCROLL_PATH.rollDeg[0]],
  shift: [DEFAULT_SCROLL_PATH.shift[0], DEFAULT_SCROLL_PATH.shift[0]],
};

export default function Blackhole() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { hasEntered } = useAudio();
  const pathname = usePathname();
  const backgroundEnabled = hasEntered || pathname !== "/";
  // Drawn on every route, so no page puts the video in its HTML or starts
  // downloading it. The video is only the answer for a browser that cannot draw
  // it — no WebGL2, or a shader its driver rejects. Only the home page moves it
  // with the scroll.
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
          className={PLACEMENT}
          style={TILT}
          enabled={backgroundEnabled}
          path={pathname === "/" ? DEFAULT_SCROLL_PATH : STILL_PATH}
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
