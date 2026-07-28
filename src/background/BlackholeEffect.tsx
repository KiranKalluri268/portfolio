"use client";
import { useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAudio } from "@/context/AudioContextProvider";

export default function Blackhole() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { hasEntered } = useAudio();
  const pathname = usePathname();
  const backgroundEnabled = hasEntered || pathname !== "/";

  useEffect(() => {
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
  }, [backgroundEnabled]);

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
        className="fixed top-3/4 left-1/2 z-[1] aspect-square w-[min(220vw,52.5rem)] -translate-x-1/2 -translate-y-1/2 transform object-contain [transform-style:preserve-3d] sm:top-1/2 sm:left-[80%] sm:w-[52.5rem]"
        style={{
          background: 'transparent',
          transform: 'rotateX(0deg) rotateY(0deg) rotateZ(-20deg)',
        }}
      >
        <source src="/images/optimized_safari.mov" type="video/quicktime" />
        <source src="/images/optimized.webm" type="video/webm" />
        Your browser does not support transparent video.
      </video>
    </div>
  );
}
