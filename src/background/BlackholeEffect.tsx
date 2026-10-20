"use client";
import { useRef, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAudio } from "@/context/AudioContextProvider";
import BakedBlackhole, { DEFAULT_CAMERA } from "./baked-blackhole/BakedBlackhole";
import type { BlackholeCamera } from "./baked-blackhole/renderer";

const PLACEMENT =
  "fixed top-3/4 left-1/2 z-[1] aspect-square w-[min(220vw,52.5rem)] -translate-x-1/2 -translate-y-1/2 transform [transform-style:preserve-3d] sm:top-1/2 sm:left-[80%] sm:w-[52.5rem]";
const TILT = { transform: "rotateX(0deg) rotateY(0deg) rotateZ(-20deg)" };

/** Preview switch while the drawn black hole is being compared with the video:
 *  `?blackhole=baked` turns it on for the session, `?blackhole=video` back off,
 *  and `?bh=distance,elevation,fov[,roll]` tries a different framing. The video
 *  stays the default until the comparison is settled. */
const PREVIEW_KEY = "portfolio:blackhole-preview";

type Preview = { baked: boolean; camera: BlackholeCamera; diskTint?: [number, number, number] };

function readPreview(): Preview {
  const params = new URLSearchParams(window.location.search);
  const choice = params.get("blackhole");
  try {
    if (choice === "baked" || choice === "video") window.sessionStorage.setItem(PREVIEW_KEY, choice);
  } catch {
    // Storage may be unavailable; the URL still decides this page.
  }
  let stored: string | null = null;
  try {
    stored = window.sessionStorage.getItem(PREVIEW_KEY);
  } catch {
    stored = null;
  }
  const [distance, elevationDeg, fovDeg, rollDeg] = (params.get("bh") ?? "").split(",").map(Number);
  const camera = {
    distance: distance || DEFAULT_CAMERA.distance,
    elevationDeg: elevationDeg || DEFAULT_CAMERA.elevationDeg,
    fovDeg: fovDeg || DEFAULT_CAMERA.fovDeg,
    rollDeg: rollDeg || DEFAULT_CAMERA.rollDeg,
  };
  const tint = (params.get("bhtint") ?? "").split(",").map(Number);
  const diskTint = tint.length === 3 && tint.every((v) => Number.isFinite(v)) ? (tint as [number, number, number]) : undefined;
  return { baked: (choice ?? stored) === "baked", camera, diskTint };
}

export default function Blackhole() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { hasEntered } = useAudio();
  const pathname = usePathname();
  const backgroundEnabled = hasEntered || pathname !== "/";
  const [preview, setPreview] = useState<Preview | null>(null);

  // Read after mount: the server render has no URL query or session to read.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreview(readPreview());
  }, []);

  const baked = preview?.baked ?? false;

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

  if (baked && preview) {
    return (
      <div>
        <BakedBlackhole
          className={PLACEMENT}
          style={TILT}
          enabled={backgroundEnabled}
          camera={preview.camera}
          diskTint={preview.diskTint}
          onUnsupported={() => setPreview({ ...preview, baked: false })}
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
