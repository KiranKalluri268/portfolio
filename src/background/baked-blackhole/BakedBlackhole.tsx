"use client";
import { useEffect, useRef, useState } from "react";
import { createBakedBlackhole, type BakedBlackholeOptions, type BlackholeCamera } from "./renderer";

/** The cinematic's settled black-hole frame: the bloom it ends the approach on.
 *  main.js lerps strength to 0.2 and threshold to 0.1 across the fall, from a
 *  radius of 1. */
const CINEMATIC_BLOOM = { strength: 0.2, radius: 1, threshold: 0.1 };

/** Framed to sit in the square the video did at the size the video drew it:
 *  the disk, out to radius 6, about two fifths of the frame across, which
 *  leaves the glow room to fade before the edge. Seen from 10 degrees above
 *  the disk, in the cinematic's own colours. */
export const DEFAULT_CAMERA: BlackholeCamera = { distance: 20, elevationDeg: 10, rollDeg: 0, fovDeg: 75 };

/** What scrolling the page does to the black hole, from the top of the page
 *  (0) to the bottom (1).
 *
 *  `distance` is the camera's, and is real: every change is integrated again,
 *  so the lensing grows the way it does on an actual approach rather than the
 *  picture being enlarged. 12 keeps the disk and its glow inside the square
 *  the canvas occupies; much closer and the disk runs off its edges.
 *
 *  `rollDeg` and `shift` turn and slide the whole canvas. Both are exact — the
 *  same picture, turned or moved — so they are done in CSS and cost nothing. */
export interface ScrollPath {
  distance: [number, number];
  rollDeg: [number, number];
  /** Viewport units, [x, y], at the start and the end. */
  shift: [[number, number], [number, number]];
}

export const DEFAULT_SCROLL_PATH: ScrollPath = {
  distance: [20, 12],
  rollDeg: [-20, -38],
  shift: [[0, 0], [-6, -4]],
};

/** Device pixels per CSS pixel, capped, and a ceiling on the total. The bake
 *  costs memory and time in proportion to its pixel count: 20 bytes each, so a
 *  million pixels is 20MB a bake, and while the camera moves there are two.
 *  On a phone the canvas is 840 CSS pixels square — wider than the screen — so
 *  a 2x or 3x ratio would have paid for pixels nobody sees. */
const MAX_PIXEL_RATIO = 1.5;
const MAX_BAKE_PIXELS = 1_000_000;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (t: number) => t * t * (3 - 2 * t);

function scrollProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
}

export default function BakedBlackhole({
  className,
  style,
  enabled,
  camera = DEFAULT_CAMERA,
  path = DEFAULT_SCROLL_PATH,
  diskTint,
  onUnsupported,
}: {
  className: string;
  style?: React.CSSProperties;
  /** Whether it should be moving — the same gate the video plays on. */
  enabled: boolean;
  /** Where the camera starts. The scroll path's distance replaces its own. */
  camera?: BlackholeCamera;
  path?: ScrollPath;
  /** Multiplies the disk's colour, as the cinematic's disk_tint does. */
  diskTint?: [number, number, number];
  /** Called when this browser cannot run it, so the caller can keep the video. */
  onUnsupported: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const enabledRef = useRef(enabled);
  const unsupportedRef = useRef(onUnsupported);
  const pathRef = useRef(path);
  useEffect(() => {
    enabledRef.current = enabled;
    unsupportedRef.current = onUnsupported;
    pathRef.current = path;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    let disposed = false;
    let frame = 0;
    let renderer: ReturnType<typeof createBakedBlackhole> = null;
    let observer: ResizeObserver | null = null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    // Where along the path the page is. Held at the start for anyone who asked
    // for less motion: scroll-linked movement is still movement.
    const progress = () => (reducedMotion.matches ? 0 : smoothstep(scrollProgress()));
    const cameraAt = (t: number): BlackholeCamera => ({
      ...camera,
      distance: lerp(pathRef.current.distance[0], pathRef.current.distance[1], t),
    });

    let lastTransform = "";
    const place = (t: number) => {
      const { rollDeg, shift } = pathRef.current;
      const x = lerp(shift[0][0], shift[1][0], t);
      const y = lerp(shift[0][1], shift[1][1], t);
      const transform = `translate3d(${x.toFixed(3)}vw, ${y.toFixed(3)}vh, 0) rotateZ(${lerp(rollDeg[0], rollDeg[1], t).toFixed(3)}deg)`;
      if (transform !== lastTransform) {
        wrapper.style.transform = transform;
        lastTransform = transform;
      }
    };
    place(progress());

    const image = new Image();
    image.src = "/textures/accretion_disk.png";
    image.decode().then(() => {
      if (disposed) return;
      const options: BakedBlackholeOptions = { camera: cameraAt(progress()), bloom: CINEMATIC_BLOOM, diskTint };
      renderer = createBakedBlackhole(canvas, image, options);
      if (!renderer) {
        unsupportedRef.current();
        return;
      }
      const size = () => {
        // The layout box, not the bounding rect: the wrapper is rotated, and the
        // canvas is drawn at its own unrotated size.
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        let ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
        if (w * h * ratio * ratio > MAX_BAKE_PIXELS) ratio = Math.sqrt(MAX_BAKE_PIXELS / (w * h));
        renderer!.resize(w * ratio, h * ratio);
      };
      size();
      observer = new ResizeObserver(size);
      observer.observe(canvas);

      const start = performance.now();
      let drewStill = false;
      let shown = false;
      let lastProgress = -1;
      const tick = () => {
        frame = requestAnimationFrame(tick);
        if (!renderer) return;
        // display: none while the cinematic journey runs over the top of it.
        if (canvas.clientWidth === 0) return;

        const t = progress();
        const scrolled = t !== lastProgress;
        if (scrolled) {
          lastProgress = t;
          place(t);
          renderer.setCamera(cameraAt(t));
        }

        // Still while the visitor has not entered, while the tab is hidden, and
        // for anyone who asked for less motion — the video paused in all three.
        // A scroll still redraws it, so the approach follows the page.
        const spinning = enabledRef.current && !document.hidden && !reducedMotion.matches;
        const settling = scrolled || renderer.busy;
        if (!spinning && !settling && drewStill) return;
        const drew = renderer.render(spinning ? (performance.now() - start) / 1000 : 0);
        if (drew) {
          drewStill = !spinning && !renderer.busy;
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
    // The starting camera is fixed for the life of the canvas; a new one is a
    // new renderer. The path is read through a ref, so it can change freely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.distance, camera.elevationDeg, camera.rollDeg, camera.fovDeg, diskTint?.join()]);

  // Placed by a wrapper, not on the canvas: globals.css pins every canvas to
  // the top-left corner, outside any layer, so it beats a utility class. Inside
  // a transformed wrapper that pin is relative to the wrapper, which is where
  // the canvas belongs anyway.
  return (
    <div ref={wrapperRef} className={className} style={style} aria-hidden="true">
      <canvas
        ref={canvasRef}
        data-blackhole-canvas
        className="h-full w-full"
        style={{ opacity: ready ? 1 : 0, transition: "opacity 800ms ease-out" }}
      />
    </div>
  );
}
