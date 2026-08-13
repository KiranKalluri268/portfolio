"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from "ogl";
import HintPill from "@/components/hints/HintPill";
import { hintText } from "@/components/hints/hint-copy";
import { useInputMode } from "@/components/hints/useIdleHint";
import { SkillMark } from "@/components/skills/skill-icons";
import { useMediaQuery, useReducedMotion } from "@/hooks/useMediaQuery";
import type { ProjectOrigin } from "@/lib/content/relationships";
import type { ProjectContent, SkillContent } from "@/lib/content/types";
import {
  type Cell,
  type Vec,
  REST_CURVATURE,
  cellFocus,
  curvatureFor,
  domeHeight,
  leanFor,
  nearestCell,
  pitchFor,
  projectIndexFor,
  radiusLimitFor,
  reachFromCurvature,
  sizeAt,
  surfacePoint,
} from "./grid-sphere";
import { CARD_SHAPES, drawCard, textureSizeFor } from "./stack-card";
import styles from "./projects-grid.module.css";

export interface GridEntry {
  project: ProjectContent;
  skills: SkillContent[];
  origin: ProjectOrigin;
}

/** Drag distance, in px, before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD = 6;

/** What a second of coasting leaves of the velocity. Expressed per second
 *  rather than per frame so the glide is the same length on a 60Hz screen and a
 *  120Hz one, and does not stretch out when frames are dropped. */
const FRICTION_PER_SECOND = 0.0016;

/** Below this the grid is at rest, in cells per second. Above zero, or it
 *  creeps for several seconds on a velocity too small to see. */
const STILL = 0.05;

/** What a second of travel leaves of the remaining distance when the grid has
 *  been asked for a particular cell — an arrow key. */
const TRAVEL_PER_SECOND = 0.0002;

/** Cells kept beyond the edge of the screen. One ring, not two: every card is
 *  blended with no depth test, so a card drawn off screen is overdraw paid for
 *  nothing — and overdraw is the one cost that still bites a weak GPU. Cards
 *  outside the viewport are skipped individually as well; this is only the
 *  window that gets considered at all. */
const WINDOW_MARGIN = 1;

/** How much of a card may hang off the edge before it stops being drawn. Above
 *  1 because the dome moves a card after its flat position is known. */
const CULL_SLACK = 1.4;

/** How wide a card is, against the viewport. A phone gets proportionally more
 *  of the screen than a desktop does but not as much as it once did — at 0.52
 *  two cards filled a phone and the field stopped reading as a field. */
function cardWidthFor(viewportWidth: number, narrow: boolean) {
  // A phone sees the sphere by standing further back rather than by the camera
  // moving, which amounts to the same thing: smaller cards, more of them, and
  // enough of the field on screen for the curve to be a shape rather than a
  // slight tilt on the three cards that fit.
  return Math.min(viewportWidth * (narrow ? 0.3 : 0.26), 360);
}

/** Pixels drawn per layout unit in the card textures. A grid card is about a
 *  third of the width the layout is written against, so drawing them at full
 *  size cost roughly 54MB across eleven projects for detail never sampled. */
const TEXTURE_RESOLUTION = 0.5;

/** What a second of easing leaves of the gap between the curvature being drawn
 *  and the one the current speed asks for.
 *
 *  Per second, not per frame, for the same reason the friction above is: eased
 *  per frame, the surface would swell twice as fast on a 120Hz screen and
 *  barely at all on a device dropping frames — which is the device this was
 *  rebuilt for. The velocity can also change abruptly, a flick ending the
 *  moment a finger lifts, and the surface should relax rather than snap flat. */
const CURVATURE_SETTLE_PER_SECOND = 0.00005;

/** Every vertex of every card is put on one sphere, evaluated from the same
 *  function of where it lands in the field. That is what makes the field read
 *  as a single curved surface cut into cells rather than a mosaic of flat
 *  tiles tilted to face along it — a card's edge and its neighbour's are the
 *  same point on the sphere, so they meet. */
const VERTEX_SHADER = /* glsl */ `
  attribute vec3 position;
  attribute vec2 uv;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;

  /** This card's centre, in pixels from the dome's peak. */
  uniform vec2 uCardCentre;
  /** The card's drawn size in pixels, so a local corner can be put in the field. */
  uniform vec2 uSize;
  uniform float uCurvature;
  uniform float uRadiusLimit;

  varying vec2 vUv;

  float domeHeight(vec2 p) {
    float r = length(p);
    float scale = r > 0.0001 ? min(r, uRadiusLimit) / r : 1.0;
    vec2 c = p * scale;
    return -dot(c, c) * uCurvature * 0.5;
  }

  void main() {
    vUv = uv;
    vec2 field = uCardCentre + position.xy * uSize;
    // Relative to the card's own centre, which the model matrix has already
    // placed along z so the renderer can still sort the cards by depth.
    float z = domeHeight(field) - domeHeight(uCardCentre);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, position.y, z, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D tMap;
  uniform float uAlpha;
  varying vec2 vUv;

  void main() {
    vec4 colour = texture2D(tMap, vUv);
    gl_FragColor = vec4(colour.rgb, colour.a * uAlpha);
  }
`;

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

/** react-icons renders brand marks as inline SVG that inherits `currentColor`.
 *  A texture has nothing to inherit from, so colour and size are written onto
 *  the copy before it is rasterised. */
function svgToImage(svg: SVGElement) {
  const copy = svg.cloneNode(true) as SVGElement;
  copy.setAttribute("fill", "#ffffff");
  copy.setAttribute("width", "64");
  copy.setAttribute("height", "64");
  const markup = new XMLSerializer().serializeToString(copy);
  return loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`);
}

/** What each outline colour means, in the order the legend reads. */
const ORIGINS: { origin: ProjectOrigin; label: string }[] = [
  { origin: "work", label: "Built in a role" },
  { origin: "selected", label: "Built for myself" },
  { origin: "personal", label: "Built for myself, not listed" },
];

const HINT_STORAGE_KEY = "projects-grid-hint";
const HINT_DELAY_MS = 900;
const HINT_DURATION_MS = 9000;

export default function ProjectsGridGL({ entries }: { entries: GridEntry[] }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const iconSourceRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const narrow = useMediaQuery("(max-width: 639px)");
  const shape = narrow ? "portrait" : "wide";
  const inputMode = useInputMode();

  const focus = useRef<Vec>({ x: 0, y: 0 });
  const velocity = useRef<Vec>({ x: 0, y: 0 });
  const dragging = useRef(false);
  const target = useRef<Vec | null>(null);
  /** The cell under the middle of the screen, for the live region and for what
   *  a tap opens. */
  const [focusedCell, setFocusedCell] = useState<Cell>({ col: 0, row: 0 });
  const focusedCellRef = useRef<Cell>({ col: 0, row: 0 });

  const [hintVisible, setHintVisible] = useState(false);
  const hintDone = useRef(true);

  const dismissHint = useCallback(() => {
    if (hintDone.current) return;
    hintDone.current = true;
    setHintVisible(false);
    try {
      window.localStorage.setItem(HINT_STORAGE_KEY, "seen");
    } catch {
      // Private browsing can refuse storage; they will just be told again.
    }
  }, []);

  useEffect(() => {
    let seen = true;
    try {
      seen = window.localStorage.getItem(HINT_STORAGE_KEY) === "seen";
    } catch {
      seen = true;
    }
    if (seen) return;
    hintDone.current = false;
    const show = window.setTimeout(() => setHintVisible(true), HINT_DELAY_MS);
    const hide = window.setTimeout(dismissHint, HINT_DELAY_MS + HINT_DURATION_MS);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [dismissHint]);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const iconSource = iconSourceRef.current;
    if (!stage || !canvas || !iconSource) return;

    let disposed = false;
    const cleanups: Array<() => void> = [];

    const start = async () => {
      await document.fonts.ready;
      if (disposed) return;

      const fontFamily =
        getComputedStyle(document.body).getPropertyValue("--font-tektur").trim() ||
        "system-ui, sans-serif";

      // The grid's own stylesheet still owns what an origin's colour is; it is
      // read back from a hidden swatch so the legend, the cards here and the
      // list view's glow cannot drift apart.
      const originColour = (origin: string) => {
        const swatch = iconSource.querySelector<HTMLElement>(`[data-grid-origin="${origin}"]`);
        if (!swatch) return "#ffffff";
        return getComputedStyle(swatch).getPropertyValue("--origin-colour").trim() || "#ffffff";
      };

      // One texture per project, not per cell. The lattice repeats the same
      // eleven projects, and the old grid paid for a mounted image per cell.
      const canvases = await Promise.all(
        entries.map(async ({ project, origin }) => {
          const image = project.image ? await loadImage(project.image) : null;
          const marks = iconSource.querySelectorAll<SVGElement>(
            `[data-grid-icons="${project.slug}"] svg`,
          );
          const icons = (await Promise.all(Array.from(marks).map(svgToImage))).filter(
            (icon): icon is HTMLImageElement => icon !== null,
          );
          return drawCard({
            title: project.title,
            role: project.role,
            image,
            icons,
            fontFamily: `${fontFamily}, system-ui, sans-serif`,
            shape,
            originColour: originColour(origin),
            resolution: TEXTURE_RESOLUTION,
          });
        }),
      );
      if (disposed) return;

      const renderer = new Renderer({
        canvas,
        alpha: true,
        antialias: true,
        dpr: Math.min(window.devicePixelRatio, 2),
      });
      const gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);

      // One world unit is one CSS pixel, so every size below is in the same
      // units as the layout. `far` has to clear the camera's own distance.
      const camera = new Camera(gl, { fov: 45, near: 1, far: 10000 });
      const scene = new Transform();

      const textures = canvases.map(
        (image) => new Texture(gl, { image, generateMipmaps: false }),
      );
      // Enough segments for the card to bend with the surface rather than
      // facet it. The grid draws far more cards than the list view, so this is
      // the one number to reach for first if an old phone struggles.
      const geometry = new Plane(gl, { widthSegments: 8, heightSegments: 8 });

      /** A mesh per slot in the window, reused as the window moves — the cell a
       *  slot shows changes, the mesh does not. */
      interface Slot {
        mesh: Mesh;
        program: Program;
      }
      let slots: Slot[] = [];
      let halfCols = 0;
      let halfRows = 0;
      let cardWidth = 0;
      let cardHeight = 0;
      let planeWidth = 0;
      let planeHeight = 0;
      let pitch = { x: 0, y: 0 };

      const buildSlots = (count: number) => {
        for (const slot of slots) {
          slot.mesh.setParent(null);
        }
        slots = [];
        for (let index = 0; index < count; index += 1) {
          const program = new Program(gl, {
            vertex: VERTEX_SHADER,
            fragment: FRAGMENT_SHADER,
            uniforms: {
              tMap: { value: textures[0] },
              uAlpha: { value: 1 },
              uCardCentre: { value: new Float32Array(2) },
              uSize: { value: new Float32Array(2) },
              uCurvature: { value: 0 },
              uRadiusLimit: { value: Number.MAX_VALUE },
            },
            transparent: true,
            depthTest: false,
          });
          const mesh = new Mesh(gl, { geometry, program });
          mesh.setParent(scene);
          slots.push({ mesh, program });
        }
      };

      const resize = () => {
        const width = stage.clientWidth;
        const height = stage.clientHeight;
        if (width === 0 || height === 0) return false;

        renderer.setSize(width, height);
        camera.perspective({ aspect: width / height });
        camera.position.z = height / (2 * Math.tan((45 * Math.PI) / 360));

        const card = CARD_SHAPES[shape];
        const aspect = card.height / card.width;
        cardWidth = cardWidthFor(width, narrow);
        cardHeight = cardWidth * aspect;
        pitch = pitchFor(cardWidth, cardHeight, narrow);

        // The plane carries the glow's margin as well as the card.
        const texture = textureSizeFor(shape);
        planeWidth = (cardWidth * texture.width) / card.width;
        planeHeight = (cardHeight * texture.height) / card.height;

        halfCols = Math.ceil(width / (2 * pitch.x)) + WINDOW_MARGIN;
        halfRows = Math.ceil(height / (2 * pitch.y)) + WINDOW_MARGIN;
        const needed = (halfCols * 2 + 1) * (halfRows * 2 + 1);
        if (needed !== slots.length) buildSlots(needed);

        return true;
      };

      let ready = resize();

      /** How curved the surface is being drawn right now, eased towards what
       *  the current speed asks for. */
      let curvature = REST_CURVATURE;
      let lean: Vec = { x: 0, y: 0 };
      /** The shape a finger still on the screen is holding. A drag that pauses
       *  is still a drag — the field should stay where it has been pulled to
       *  rather than relaxing back out from under a stationary fingertip — so
       *  while the pointer is down these only ever move further from rest, and
       *  are let go of on release. */
      let heldCurvature = REST_CURVATURE;
      let heldLean: Vec = { x: 0, y: 0 };
      /** Frames drawn since the scene last changed. The old grid's loop
       *  returned early when idle; without this the GPU redraws a still field
       *  sixty times a second for the rest of the visit, which on the phone
       *  this was rebuilt for is heat for nothing. One frame is still drawn
       *  after everything settles, so the resting state is the one on screen. */
      let settledFrames = 0;

      const paint = (elapsed: number) => {
        if (!ready) {
          ready = resize();
          if (!ready) return;
        }

        const ease = 1 - CURVATURE_SETTLE_PER_SECOND ** elapsed;
        const speed = Math.hypot(velocity.current.x, velocity.current.y);
        const fromSpeed = reduceMotion ? REST_CURVATURE : curvatureFor(speed);
        const leanFromSpeed = reduceMotion ? { x: 0, y: 0 } : leanFor(velocity.current);

        if (dragging.current) {
          // Further from rest is a smaller number, the resting shape being the
          // most positive curvature there is, so the held shape is the minimum.
          if (fromSpeed < heldCurvature) heldCurvature = fromSpeed;
          // The lean is only taken while there is a direction to take it from;
          // a paused finger would otherwise slide the peak back to the middle
          // and move the field it is holding still.
          if (speed > STILL) heldLean = leanFromSpeed;
        } else {
          heldCurvature = fromSpeed;
          heldLean = leanFromSpeed;
        }

        const wanted = heldCurvature;
        const wantedLean = heldLean;
        curvature += (wanted - curvature) * ease;
        lean = {
          x: lean.x + (wantedLean.x - lean.x) * ease,
          y: lean.y + (wantedLean.y - lean.y) * ease,
        };

        const moving =
          dragging.current || speed > STILL || target.current !== null;
        const settling =
          Math.abs(curvature - wanted) > 1e-7 ||
          Math.abs(lean.x - wantedLean.x) > 1e-4 ||
          Math.abs(lean.y - wantedLean.y) > 1e-4;
        if (moving || settling) {
          settledFrames = 0;
        } else {
          // The frame everything comes to rest on still has to be drawn — it is
          // the one left on screen. Only the ones after it are skipped.
          if (settledFrames > 0) return;
          settledFrames = 1;
        }

        const radiusLimit = radiusLimitFor(curvature, camera.position.z);
        // The rim of the field, for grading the card sizes across it.
        const falloffSpan = Math.hypot(stage.clientWidth, stage.clientHeight) / 2;
        const reach = reachFromCurvature(curvature);
        const halfWidth = stage.clientWidth / 2 + planeWidth * CULL_SLACK;
        const halfHeight = stage.clientHeight / 2 + planeHeight * CULL_SLACK;

        const centre = nearestCell(focus.current);
        // The dome's peak, in pixels from the middle of the screen.
        const peak = { x: lean.x * pitch.x, y: -lean.y * pitch.y };

        let index = 0;
        for (let dRow = -halfRows; dRow <= halfRows; dRow += 1) {
          for (let dCol = -halfCols; dCol <= halfCols; dCol += 1) {
            const slot = slots[index];
            index += 1;
            if (!slot) continue;
            const cell = { col: centre.col + dCol, row: centre.row + dRow };
            const flat = surfacePoint(cell, focus.current, pitch);

            // Off the screen entirely: not drawn at all rather than drawn and
            // blended into nothing.
            if (Math.abs(flat.x) > halfWidth || Math.abs(flat.y) > halfHeight) {
              slot.mesh.visible = false;
              continue;
            }
            slot.mesh.visible = true;

            const centreX = flat.x - peak.x;
            const centreY = flat.y - peak.y;
            // Only the card's own centre is placed here; every vertex finds its
            // own height on the sphere in the shader. Nothing is rotated — a
            // card is part of the surface rather than a tile lying on it.
            slot.mesh.position.set(
              flat.x,
              flat.y,
              domeHeight(centreX, centreY, curvature, radiusLimit),
            );
            const size = sizeAt(Math.hypot(centreX, centreY), falloffSpan, reach);
            slot.mesh.scale.set(planeWidth * size, planeHeight * size, 1);

            const uniforms = slot.program.uniforms;
            (uniforms.uCardCentre.value as Float32Array).set([centreX, centreY]);
            (uniforms.uSize.value as Float32Array).set([
              planeWidth * size,
              planeHeight * size,
            ]);
            uniforms.uCurvature.value = curvature;
            uniforms.uRadiusLimit.value = radiusLimit;
            uniforms.tMap.value = textures[projectIndexFor(cell, entries.length)];
          }
        }

        renderer.render({ scene, camera });
      };

      // The animation loop: coast on whatever velocity the drag left behind and
      // come to rest there. The grid is a field to wander, not a carousel, so
      // nothing tugs it onto the nearest card afterwards.
      let frame = 0;
      let previous = performance.now();
      const step = (now: number) => {
        frame = requestAnimationFrame(step);
        // Capped so a backgrounded tab does not resume with one enormous step.
        const elapsed = Math.min(0.05, Math.max(0, (now - previous) / 1000));
        previous = now;
        if (elapsed === 0) return;

        if (!dragging.current) {
          const speed = Math.hypot(velocity.current.x, velocity.current.y);
          if (speed > STILL) {
            const decay = FRICTION_PER_SECOND ** elapsed;
            focus.current = {
              x: focus.current.x + velocity.current.x * elapsed,
              y: focus.current.y + velocity.current.y * elapsed,
            };
            velocity.current = {
              x: velocity.current.x * decay,
              y: velocity.current.y * decay,
            };
          } else {
            velocity.current = { x: 0, y: 0 };
            const destination = target.current;
            if (destination) {
              const dx = destination.x - focus.current.x;
              const dy = destination.y - focus.current.y;
              if (Math.abs(dx) < 0.0008 && Math.abs(dy) < 0.0008) {
                focus.current = destination;
                target.current = null;
              } else {
                const pull = 1 - TRAVEL_PER_SECOND ** elapsed;
                focus.current = {
                  x: focus.current.x + dx * pull,
                  y: focus.current.y + dy * pull,
                };
              }
            }
          }
        }

        const centre = nearestCell(focus.current);
        if (
          centre.col !== focusedCellRef.current.col ||
          centre.row !== focusedCellRef.current.row
        ) {
          focusedCellRef.current = centre;
          setFocusedCell(centre);
        }

        paint(elapsed);
      };
      frame = requestAnimationFrame(step);
      cleanups.push(() => cancelAnimationFrame(frame));

      const resizeObserver = new ResizeObserver(() => {
        ready = resize();
        settledFrames = 0;
      });
      resizeObserver.observe(stage);
      cleanups.push(() => resizeObserver.disconnect());

      // A browser only allows a handful of live WebGL contexts, and leaving to
      // a case study and coming back would take a new one each time.
      cleanups.push(() => {
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      });
    };

    void start();

    return () => {
      disposed = true;
      for (const cleanup of cleanups) cleanup();
    };
  }, [entries, narrow, reduceMotion, shape]);

  // Lenis owns touch on the window and stops animations on every touch event.
  // The grid is a drag surface, so it claims the ones it is using; without this
  // a flick would die the instant the finger lifted. See CLAUDE.md.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const claim = (event: TouchEvent) => {
      (event as TouchEvent & { lenisStopPropagation?: boolean }).lenisStopPropagation = true;
    };
    stage.addEventListener("touchmove", claim, { passive: true });
    stage.addEventListener("touchend", claim, { passive: true });
    return () => {
      stage.removeEventListener("touchmove", claim);
      stage.removeEventListener("touchend", claim);
    };
  }, []);

  const press = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const lastMove = useRef<{ x: number; y: number; time: number } | null>(null);

  const cellsPerPixel = () => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    // One card width of finger travel moves the grid by about one cell, so
    // this has to be worked out the same way the cards themselves are. It was
    // using the desktop width on a phone, which made a drag there move the
    // grid further than the finger did.
    const width = cardWidthFor(stage.clientWidth, narrow);
    const height = width * (CARD_SHAPES[shape].height / CARD_SHAPES[shape].width);
    const spacing = pitchFor(width, height, narrow);
    return { x: 1 / spacing.x, y: 1 / spacing.y };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    press.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    lastMove.current = { x: event.clientX, y: event.clientY, time: event.timeStamp };
    velocity.current = { x: 0, y: 0 };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const held = press.current;
    const stage = stageRef.current;
    if (!held || !stage || held.id !== event.pointerId) return;

    if (!held.moved) {
      if (Math.hypot(event.clientX - held.x, event.clientY - held.y) < DRAG_THRESHOLD) return;
      held.moved = true;
      dragging.current = true;
      dismissHint();
      stage.setPointerCapture(event.pointerId);
    }

    const previous = lastMove.current;
    const perPixel = cellsPerPixel();
    if (previous) {
      // Dragging right brings cards from the left, so the focus moves left.
      const dx = -(event.clientX - previous.x) * perPixel.x;
      const dy = -(event.clientY - previous.y) * perPixel.y;
      focus.current = { x: focus.current.x + dx, y: focus.current.y + dy };
      const elapsed = Math.max(1, event.timeStamp - previous.time);
      velocity.current = { x: (dx / elapsed) * 1000, y: (dy / elapsed) * 1000 };
    }
    lastMove.current = { x: event.clientX, y: event.clientY, time: event.timeStamp };
  };

  const endPress = (event: React.PointerEvent<HTMLDivElement>) => {
    const held = press.current;
    if (!held || held.id !== event.pointerId) return;
    press.current = null;
    lastMove.current = null;
    if (held.moved) {
      dragging.current = false;
      target.current = null;
      if (reduceMotion) velocity.current = { x: 0, y: 0 };
      return;
    }
    // A press that never moved is a choice: open whatever is under the middle.
    const entry = entries[projectIndexFor(focusedCellRef.current, entries.length)];
    if (entry) router.push(`/projects/${entry.project.slug}`);
  };

  const moveFocus = (dCol: number, dRow: number) => {
    const centre = target.current ? nearestCell(target.current) : nearestCell(focus.current);
    const next = { col: centre.col + dCol, row: centre.row + dRow };
    velocity.current = { x: 0, y: 0 };
    if (reduceMotion) {
      focus.current = cellFocus(next);
      target.current = null;
      return;
    }
    target.current = cellFocus(next);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      dismissHint();
      moveFocus(move[0], move[1]);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      const entry = entries[projectIndexFor(focusedCellRef.current, entries.length)];
      if (!entry) return;
      event.preventDefault();
      router.push(`/projects/${entry.project.slug}`);
    }
  };

  const focused = entries[projectIndexFor(focusedCell, entries.length)];

  // Only key what is actually on the grid. Every project today is either work
  // or selected, and a key entry for a colour nobody can find is a puzzle
  // rather than an explanation.
  const present = new Set(entries.map((entry) => entry.origin));
  const shownOrigins = ORIGINS.filter((entry) => present.has(entry.origin));

  return (
    <>
      <h1 className={styles.heading}>Projects</h1>

      <div className={styles.legend}>
        <ul className={styles.legendList}>
          {shownOrigins.map((entry) => (
            <li key={entry.origin} className={styles.legendItem}>
              <span className={styles.legendSwatch} data-origin={entry.origin} aria-hidden="true" />
              {entry.label}
            </li>
          ))}
        </ul>
      </div>

      <div
        ref={stageRef}
        className={styles.stage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPress}
        onPointerCancel={endPress}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="group"
        aria-label="Projects, arranged as a grid you can drag. Use the arrow keys to move between them, and Enter to open the one in the middle."
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {/* The cards are pixels on the GPU and carry no text a crawler or a
            screen reader can reach, so the same content is published here as
            real markup. The brand marks and the origin colours above are read
            back out of this subtree to build the textures. */}
        <div ref={iconSourceRef} className="sr-only">
          {(["work", "selected", "personal"] as const).map((origin) => (
            <span
              key={origin}
              data-grid-origin={origin}
              data-origin={origin}
              className={styles.legendSwatch}
              aria-hidden="true"
            />
          ))}
          <ul>
            {entries.map(({ project, skills }) => (
              <li key={project.slug}>
                <a href={`/projects/${project.slug}`}>{project.title}</a>
                <p>{project.summary}</p>
                <span data-grid-icons={project.slug} aria-hidden="true">
                  {skills.map((skill) => (
                    <SkillMark key={skill.slug} skill={skill} />
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <HintPill
          text={hintText("projects-grid", inputMode)}
          visible={hintVisible}
          className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] left-1/2 sm:bottom-16"
        />

        <p className={styles.liveRegion} aria-live="polite">
          {focused ? `${focused.project.title} in focus` : ""}
        </p>
      </div>
    </>
  );
}
