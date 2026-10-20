"use client";
import { useEffect, useRef, useState } from "react";
import { createBakedBlackhole, type BakedBlackholeOptions, type BlackholeCamera } from "./renderer";

/** The cinematic's settled black-hole frame: the bloom it ends the approach on.
 *  main.js lerps strength to 0.2 and threshold to 0.1 across the fall, from a
 *  radius of 1. */
const CINEMATIC_BLOOM = { strength: 0.2, radius: 1, threshold: 0.1 };

/** Framed to sit in the square the video did at the size the video drew it:
 *  the disk, out to radius 6, about two fifths of the frame across, which
 *  leaves the glow room to fade before the edge. */
export const DEFAULT_CAMERA: BlackholeCamera = { distance: 20, elevationDeg: 10, rollDeg: 0, fovDeg: 75 };

/** Device pixels per CSS pixel, capped. The bake costs in proportion to the
 *  pixel count, and past 2x the disk's own texture has no more detail to give. */
const MAX_PIXEL_RATIO = 2;

export default function BakedBlackhole({
  className,
  style,
  enabled,
  camera = DEFAULT_CAMERA,
  diskTint,
  onUnsupported,
}: {
  className: string;
  style?: React.CSSProperties;
  /** Whether it should be moving — the same gate the video plays on. */
  enabled: boolean;
  camera?: BlackholeCamera;
  /** Multiplies the disk's colour, as the cinematic's disk_tint does. */
  diskTint?: [number, number, number];
  /** Called when this browser cannot run it, so the caller can keep the video. */
  onUnsupported: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const enabledRef = useRef(enabled);
  const unsupportedRef = useRef(onUnsupported);
  useEffect(() => {
    enabledRef.current = enabled;
    unsupportedRef.current = onUnsupported;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let frame = 0;
    let renderer: ReturnType<typeof createBakedBlackhole> = null;
    let observer: ResizeObserver | null = null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const image = new Image();
    image.src = "/textures/accretion_disk.png";
    image.decode().then(() => {
      if (disposed) return;
      const options: BakedBlackholeOptions = { camera, bloom: CINEMATIC_BLOOM, diskTint };
      renderer = createBakedBlackhole(canvas, image, options);
      if (!renderer) {
        unsupportedRef.current();
        return;
      }
      const size = () => {
        const rect = canvas.getBoundingClientRect();
        // The canvas is rotated by its transform; its layout box is not, and that
        // is the size it is drawn at.
        const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
        renderer!.resize(canvas.clientWidth * ratio || rect.width * ratio, canvas.clientHeight * ratio || rect.height * ratio);
      };
      size();
      observer = new ResizeObserver(size);
      observer.observe(canvas);

      const start = performance.now();
      let drewStill = false;
      let shown = false;
      const tick = () => {
        frame = requestAnimationFrame(tick);
        if (!renderer) return;
        // display: none while the cinematic journey runs over the top of it.
        if (canvas.clientWidth === 0) return;
        const baking = renderer.bakeProgress < 1;
        // Still while the visitor has not entered, while the tab is hidden, and
        // for anyone who asked for less motion — the video paused in all three.
        const moving = enabledRef.current && !document.hidden && !reducedMotion.matches;
        if (!baking && !moving && drewStill) return;
        const drew = renderer.render(moving ? (performance.now() - start) / 1000 : 0);
        if (drew) {
          drewStill = !moving;
          if (!shown) {
            shown = true;
            setReady(true);
          }
        }
      };
      frame = requestAnimationFrame(tick);
    }).catch(() => {
      if (!disposed) unsupportedRef.current();
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      renderer?.dispose();
    };
    // The camera is fixed for the life of the canvas; a new one is a new bake.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.distance, camera.elevationDeg, camera.rollDeg, camera.fovDeg, diskTint?.join()]);

  // Placed by a wrapper, not on the canvas: globals.css pins every canvas to
  // the top-left corner, outside any layer, so it beats a utility class. Inside
  // a transformed wrapper that pin is relative to the wrapper, which is where
  // the canvas belongs anyway.
  return (
    <div className={className} style={style} aria-hidden="true">
      <canvas
        ref={canvasRef}
        data-blackhole-canvas
        className="h-full w-full"
        style={{ opacity: ready ? 1 : 0, transition: "opacity 800ms ease-out" }}
      />
    </div>
  );
}
