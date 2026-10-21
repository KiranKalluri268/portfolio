"use client";
import { useEffect, useRef, useState } from "react";
import {
  createBakedBlackhole,
  type BakedBlackholeOptions,
  type BlackholeCamera,
  type BlackholeDimming,
} from "./renderer";
import { blackholeCentre, centreOnScreen } from "../blackhole-centre";

/** The cinematic's settled black-hole frame: the bloom it ends the approach on.
 *  main.js lerps strength to 0.2 and threshold to 0.1 across the fall, from a
 *  radius of 1. */
const CINEMATIC_BLOOM = { strength: 0.2, radius: 1, threshold: 0.1 };

/** Where the path starts and ends, for a canvas of the given CSS size. */
export interface CameraPath {
  (viewport: { width: number; height: number; wide: boolean }): {
    start: BlackholeCamera;
    end: BlackholeCamera;
  };
}

/** The pixel scale the black hole started at when it was a video: an 840px
 *  square drawn at a 75 degree field of view, so 547 CSS pixels of focal
 *  length. Held at the start of the scroll whatever the viewport's height. */
const START_FOCAL_PX = 420 / Math.tan((37.5 * Math.PI) / 180);

/** The home page's path, from a small level black hole where the video sat to
 *  the reference frame in portfolio-3D's public/goal/last_frame.jpg.
 *
 *  The end takes the cinematic's framing of that reference — 2.5 degrees above
 *  the disk, rolled 18 degrees so the disk runs up to the right, the compose
 *  shift that puts the shadow high and to the right, and its back-off of up to
 *  55% as the screen narrows — but not its distance. The cinematic ends at 3.6,
 *  inside the disk's outer edge at 6, so the near side of the disk passes under
 *  the camera and fills the bottom of the frame with a white slab; its own
 *  notes say the reference is shot from outside its disk. 7 is outside it, and
 *  a 54 degree field of view keeps the shadow the size the cinematic's 90 gave
 *  it at 3.6, so the disk now recedes into the dark at the lower left as the
 *  reference's does.
 *
 *  The start is the size and place the video had, pushed further away to 28 so
 *  it starts smaller, and level: no roll until the scroll turns it in. */
export const HOME_PATH: CameraPath = ({ width, height, wide }) => {
  const aspect = Math.max(width / height, 0.4);
  const narrowFraming = Math.min(1, Math.max(0, (1.2 - aspect) / 0.8));
  return {
    start: {
      distance: 28,
      elevationDeg: 10,
      rollDeg: 0,
      fovDeg: (2 * Math.atan(height / 2 / START_FOCAL_PX) * 180) / Math.PI,
      // Where the video sat: at 80% across and halfway down beside the copy, or
      // centred three quarters of the way down a phone.
      shift: wide ? [0.6, 0] : [0, -0.5],
    },
    end: {
      distance: 7 * (1 + 0.55 * narrowFraming),
      elevationDeg: 2.5,
      rollDeg: 18,
      fovDeg: 54,
      shift: [0.67, 0.26],
    },
  };
};

/** Away from the home page it holds the home page's starting frame. */
export const STILL_PATH: CameraPath = (viewport) => {
  const { start } = HOME_PATH(viewport);
  return { start, end: start };
};

/** Between the two ends. The distance is eased in its inverse, which is what
 *  the black hole's size on screen goes with, so it grows steadily along the
 *  path rather than holding small and then rushing up at the very end. */
export function cameraBetween(start: BlackholeCamera, end: BlackholeCamera, t: number): BlackholeCamera {
  return {
    distance: 1 / lerp(1 / start.distance, 1 / end.distance, t),
    elevationDeg: lerp(start.elevationDeg, end.elevationDeg, t),
    rollDeg: lerp(start.rollDeg, end.rollDeg, t),
    fovDeg: lerp(start.fovDeg, end.fovDeg, t),
    shift: [lerp(start.shift[0], end.shift[0], t), lerp(start.shift[1], end.shift[1], t)],
  };
}

/** Device pixels per CSS pixel, capped, and a ceiling on the total. The bake
 *  costs memory and time in proportion to its pixel count: 20 bytes each, so a
 *  million pixels is 20MB a bake, and while the camera moves there are two.
 *  On a phone the canvas is 840 CSS pixels square — wider than the screen — so
 *  a 2x or 3x ratio would have paid for pixels nobody sees. */
const MAX_PIXEL_RATIO = 1.5;
const MAX_BAKE_PIXELS = 1_000_000;

/** What the black hole steps back behind, and only exactly behind: nothing
 *  dims around it, because a dark patch in open space reads as a shadow with
 *  nothing to fall on.
 *
 *  - `data-blackhole-dim="text"` dims under each line of the element's text,
 *    hugging the words, not the block they sit in.
 *  - `data-blackhole-dim="box"` dims the element's own outline, rounded
 *    corners included, as if the box were tinted glass. For things drawn as
 *    boxes: cards, form fields, buttons.
 *
 *  Something still too faint to read is left out with `data-blackhole-undimmed`
 *  — on a box, or on the part of a text element that has not appeared yet —
 *  or the dimming draws its shadow with nothing in it. A text element whose
 *  parts come and go says so by changing `data-blackhole-dim-key`, which is
 *  what tells its cached lines to be measured again. */
export const DIM_BEHIND_ATTRIBUTE = "data-blackhole-dim";
const UNDIMMED_ATTRIBUTE = "data-blackhole-undimmed";
const DIM_KEY_ATTRIBUTE = "data-blackhole-dim-key";

/** Behind text the light drops to this fraction. Each shape fades in from its
 *  outline over its soft width, so no edge is drawn where the dimming starts.
 *  A line of text is widened by `textPad` to give its fade room; a box fades
 *  in over `boxSoft` inside its own outline. */
const DIM = { floor: 0.35, textPad: 8, textSoft: 12, boxSoft: 24 };

type DimShape = BlackholeDimming["rects"][number];

/** A text element's lines, relative to its own top-left corner. Measured once
 *  and kept until the element's size or text changes: a paragraph split into a
 *  span a word is a hundred rectangles to read, and the lines only move with
 *  the element, which is one read a frame. */
const lineCache = new WeakMap<Element, { key: string; lines: [number, number, number, number][] }>();

function textLines(element: Element, box: DOMRect) {
  const key = `${box.width.toFixed(1)}x${box.height.toFixed(1)}:${element.textContent?.length ?? 0}:${element.getAttribute(DIM_KEY_ATTRIBUTE) ?? ""}`;
  const cached = lineCache.get(element);
  if (cached?.key === key) return cached.lines;

  const range = document.createRange();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const lines: [number, number, number, number][] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    const parent = node.parentElement;
    if (parent && (parent.closest(`.sr-only, [${UNDIMMED_ATTRIBUTE}]`) || getComputedStyle(parent).visibility === "hidden")) continue;
    range.selectNodeContents(node);
    for (const r of range.getClientRects()) {
      if (r.width === 0 || r.height === 0) continue;
      // The same line if the two overlap by most of the shorter one's height.
      const line = lines.find(
        (l) => Math.min(l[3], r.bottom) - Math.max(l[1], r.top) > 0.5 * Math.min(l[3] - l[1], r.height),
      );
      if (line) {
        line[0] = Math.min(line[0], r.left);
        line[1] = Math.min(line[1], r.top);
        line[2] = Math.max(line[2], r.right);
        line[3] = Math.max(line[3], r.bottom);
      } else {
        lines.push([r.left, r.top, r.right, r.bottom]);
      }
    }
  }
  const relative = lines.map(([l, t, r, b]) => [l - box.left, t - box.top, r - box.left, b - box.top] as [number, number, number, number]);
  lineCache.set(element, { key, lines: relative });
  return relative;
}

const radiusCache = new WeakMap<Element, number>();

function cornerRadius(element: Element) {
  let radius = radiusCache.get(element);
  if (radius === undefined) {
    radius = parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
    radiusCache.set(element, radius);
  }
  return radius;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** How long a move of a fifth of the path takes from rest — one section on the
 *  home page. Long enough that a big approach stays smooth while the bakes
 *  catch up, short enough to be over by the time the visitor is reading the
 *  section it moved for. */
export const STOP_MOVE_MS = 1400;
const STOP_MOVE_SPAN = 0.2;
/** Longer moves take longer, but far less than in proportion: five sections at
 *  once is about 2.5s, not 7, so it never trails far behind the page. */
const STOP_MOVE_GROWTH = 0.35;
/** Even a move back to almost where it is gets this long to turn round in. */
const STOP_MOVE_MIN_MS = 300;

/** One move along the path: a cubic from `from` to `to` over `ms`, leaving at
 *  `slope` (its speed, in path per move) and arriving at rest. */
export interface Glide {
  from: number;
  to: number;
  slope: number;
  at: number;
  ms: number;
}

export const restingAt = (stop: number): Glide => ({ from: stop, to: stop, slope: 0, at: 0, ms: 1 });

/** Where a glide is at `now`, and how fast it is going, in path per ms. */
export function glideAt(glide: Glide, now: number) {
  const s = Math.min(1, Math.max(0, (now - glide.at) / glide.ms));
  const span = glide.to - glide.from;
  const x = glide.from + glide.slope * (s - 2 * s * s + s * s * s) + span * (3 * s * s - 2 * s * s * s);
  const v = s >= 1 ? 0 : (glide.slope * (1 - 4 * s + 3 * s * s) + span * (6 * s - 6 * s * s)) / glide.ms;
  return { x, v };
}

/** A new stop, taken from wherever the black hole is and at the speed it is
 *  already going, so a change mid-move never stalls it. Further the same way,
 *  it glides on and lands once, at the new stop. Back the other way, it eases
 *  to a halt, turns and heads back. */
export function retarget(glide: Glide, now: number, to: number): Glide {
  const { x, v } = glideAt(glide, now);
  const span = to - x;
  let ms = Math.max(STOP_MOVE_MIN_MS, STOP_MOVE_MS * Math.pow(Math.abs(span) / STOP_MOVE_SPAN, STOP_MOVE_GROWTH));
  // Already heading there: never so long that the speed it has would carry it
  // past the stop and back. A cubic leaving at more than three times its
  // average speed overshoots.
  if (v * span > 0) ms = Math.min(ms, (3 * Math.abs(span)) / Math.abs(v));
  return { from: x, to, slope: v * ms, at: now, ms };
}

export default function BakedBlackhole({
  className,
  path = HOME_PATH,
  stop = 0,
  enabled,
  diskTint,
  onUnsupported,
}: {
  className: string;
  path?: CameraPath;
  /** Where along the path to rest, from 0 at its start to 1 at its end. A new
   *  stop is glided to — see retarget — and the black hole holds still there
   *  until the next. */
  stop?: number;
  /** Whether it should be moving — the same gate the video plays on. */
  enabled: boolean;
  /** Multiplies the disk's colour, as the cinematic's disk_tint does. */
  diskTint?: [number, number, number];
  /** Called when this browser cannot run it, so the caller can keep the video. */
  onUnsupported: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const enabledRef = useRef(enabled);
  const unsupportedRef = useRef(onUnsupported);
  const pathRef = useRef(path);
  const stopRef = useRef(stop);
  useEffect(() => {
    enabledRef.current = enabled;
    unsupportedRef.current = onUnsupported;
    pathRef.current = path;
    stopRef.current = stop;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let frame = 0;
    let renderer: ReturnType<typeof createBakedBlackhole> = null;
    let observer: ResizeObserver | null = null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia("(min-width: 640px)");

    // Where along the path it is. Held at the start for anyone who asked for
    // less motion.
    let glide = restingAt(stopRef.current);
    let shown = false;
    const progress = () => {
      if (reducedMotion.matches) return 0;
      const now = performance.now();
      const target = stopRef.current;
      if (target !== glide.to) {
        // Until the first frame is on screen there is nothing to move from: a
        // page opened part-way down starts at its own stop.
        glide = shown ? retarget(glide, now, target) : restingAt(target);
      }
      return glideAt(glide, now).x;
    };
    // Where the canvas is, taken when it is sized rather than every frame.
    let canvasBox = { left: 0, top: 0, width: 0, height: 0 };
    const publishCentre = (camera: BlackholeCamera) => {
      const { x, y } = centreOnScreen(camera, canvasBox);
      blackholeCentre.x = x;
      blackholeCentre.y = y;
      blackholeCentre.drawn = true;
    };
    const cameraAt = (t: number): BlackholeCamera => {
      const { start, end } = pathRef.current({
        width: canvas.clientWidth || window.innerWidth,
        height: canvas.clientHeight || window.innerHeight,
        wide: wide.matches,
      });
      return cameraBetween(start, end, t);
    };

    // Reads where the text and the canvas are, before this frame writes
    // anything, so the reads cost no extra layout.
    const measureText = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const rects: DimShape[] = [];
      for (const element of document.querySelectorAll(`[${DIM_BEHIND_ATTRIBUTE}]`)) {
        const box = element.getBoundingClientRect();
        if (box.width === 0 || box.height === 0 || element.hasAttribute(UNDIMMED_ATTRIBUTE)) continue;
        if (box.bottom < 0 || box.top > height || box.right < 0 || box.left > width) continue;
        if (element.getAttribute(DIM_BEHIND_ATTRIBUTE) === "box") {
          rects.push([box.left, box.top, box.right, box.bottom, cornerRadius(element), DIM.boxSoft]);
          continue;
        }
        const pad = DIM.textPad;
        for (const [l, t, r, b] of textLines(element, box)) {
          const top = box.top + t;
          const bottom = box.top + b;
          if (bottom < 0 || top > height) continue;
          rects.push([box.left + l - pad, top - pad, box.left + r + pad, bottom + pad, (bottom - top) / 2, DIM.textSoft]);
        }
      }
      const box = canvas.getBoundingClientRect();
      return { rects, origin: [box.left, box.top] as [number, number] };
    };

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
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        let ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
        if (w * h * ratio * ratio > MAX_BAKE_PIXELS) ratio = Math.sqrt(MAX_BAKE_PIXELS / (w * h));
        // The frame depends on the canvas's shape, so the camera is set for the
        // new size before the bake it starts.
        const box = canvas.getBoundingClientRect();
        canvasBox = { left: box.left, top: box.top, width: w, height: h };
        const camera = cameraAt(progress());
        renderer!.setCamera(camera);
        publishCentre(camera);
        renderer!.resize(w * ratio, h * ratio);
      };
      size();
      observer = new ResizeObserver(size);
      observer.observe(canvas);

      const start = performance.now();
      let drewStill = false;
      let lastProgress = -1;
      let lastPath = pathRef.current;
      let lastDimming = "";
      const tick = () => {
        frame = requestAnimationFrame(tick);
        if (!renderer) return;
        // display: none while the cinematic journey runs over the top of it.
        if (canvas.clientWidth === 0) {
          blackholeCentre.drawn = false;
          return;
        }
        if (!blackholeCentre.drawn) publishCentre(cameraAt(progress()));

        const text = measureText();
        const t = progress();
        const moved = t !== lastProgress || pathRef.current !== lastPath;
        if (moved) {
          lastProgress = t;
          lastPath = pathRef.current;
          const camera = cameraAt(t);
          renderer.setCamera(camera);
          publishCentre(camera);
        }

        // Text moves without the page scrolling too — the carousel settling, a
        // section revealing — so a change here is a reason to draw on its own.
        const dimming: BlackholeDimming = {
          origin: text.origin,
          size: [canvas.clientWidth, canvas.clientHeight],
          rects: text.rects,
          floor: DIM.floor,
        };
        const signature = JSON.stringify([dimming.origin, dimming.size, dimming.rects]);
        const textMoved = signature !== lastDimming;
        if (textMoved) {
          lastDimming = signature;
          renderer.setDimming(dimming);
        }

        // Still while the visitor has not entered, while the tab is hidden, and
        // for anyone who asked for less motion — the video paused in all three.
        // A move to a new stop still redraws it.
        const spinning = enabledRef.current && !document.hidden && !reducedMotion.matches;
        const settling = moved || textMoved || renderer.busy;
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
      blackholeCentre.drawn = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      renderer?.dispose();
    };
    // The path is read through a ref, so it can change freely; a new tint is a
    // new renderer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diskTint?.join()]);

  // The canvas is the whole screen, as the cinematic's is, so the frame can
  // carry the disk off every edge. Sized to the large viewport so a phone's
  // address bar coming and going does not resize it, which would re-run the
  // bake. The wrapper only stacks it: globals.css pins every canvas to the
  // top-left corner.
  return (
    <div className={className} aria-hidden="true">
      <canvas
        ref={canvasRef}
        data-blackhole-canvas
        className="h-lvh w-full"
        style={{ opacity: ready ? 1 : 0, transition: "opacity 800ms ease-out" }}
      />
    </div>
  );
}
