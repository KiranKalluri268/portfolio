"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from "ogl";
import gsap from "gsap";
import { useMediaQuery, useReducedMotion } from "@/hooks/useMediaQuery";
import { SkillMark } from "@/components/skills/skill-icons";
import type { ProjectContent, SkillContent } from "@/lib/content/types";
import gridStyles from "./projects-grid.module.css";
import { CARD_SHAPES, drawCard, textureSizeFor } from "./stack-card";

/** The home page's projects carousel, drawn on the GPU.
 *
 * The same cards as `/projects`, laid in a row instead of a column, and bent
 * on a cylinder by how fast the row is moving. It is the list view rotated a
 * quarter turn — that view is the part of the site that feels best to move,
 * and the reason is that its motion has a *speed*, not just a position.
 *
 * The one thing that does not carry over is who owns the gesture. The list
 * view takes the wheel with an Observer and stops the page behind it; this
 * section cannot, because its scroll position is what pins it and what the
 * scene indicator reads. Scroll stays the single source of truth: the pin's
 * progress sets a target, and the row eases towards it. The lag between the
 * two is the velocity everything here is drawn from — a second reading of the
 * same truth, never a second truth. */

export interface HomeRowEntry {
  project: ProjectContent;
  skills: SkillContent[];
  /** Work, selected or personal — the key the grid colours its cards by. */
  origin: string;
}

/** How far the row travels for each pixel of scroll.
 *
 *  The row's length is fixed — it has to walk through every panel exactly once
 *  — so this is applied by shortening the pin rather than by moving the cards
 *  further: the whole carousel is crossed in half the scrolling. The pin's end
 *  is derived from the row's own travel, which is why the renderer publishes
 *  it rather than the section assuming a viewport per panel. */
export const SCROLL_MULTIPLIER = 2;

/** How much of the gap to the target is closed per 60Hz frame.
 *
 *  Lower is heavier. This is the whole trick: with the row pinned exactly to
 *  the scroll there is no lag, and with no lag there is no speed to draw. */
const ROW_EASE = 0.12;

/** Travel per 60Hz frame, as a fraction of the card's *height* — the axis the
 *  bow spans, now that the row runs sideways. */
const BULGE_PER_PIXEL = 0.00071;
const MAX_BULGE = 0.09;

/** Curvature of the row, per pixel of travel per 60Hz frame. The row is rolled
 *  onto a cylinder about a vertical axis, so a card away from the middle is
 *  turned to sit on it and seen as a trapezoid, while the card being read stays
 *  square on. The sign follows the direction of travel.
 *
 *  Calibrated against measured travel rather than borrowed from the list view.
 *  With the row moving at the scroll's own pace, one wheel tick moved it about
 *  11.5 px per 60Hz frame, an ordinary scroll 27, and a hard flick 98. The list
 *  view's own numbers put a flick past a 77 degree turn here, which is a sliver
 *  rather than a card: its cards travel up the short axis of the screen, so far
 *  fewer of them are on it at once and the steep ones are already gone.
 *  Sideways, the same curvature is applied across nearly twice the distance.
 *
 *  This and the bulge above were then divided by the multiplier's own effect on
 *  speed, so the same gesture still draws the same bend. The row moves faster
 *  now, but a bend that grew with it would have put an ordinary scroll at 90
 *  per cent of the ceiling and everything quicker at exactly the ceiling —
 *  which is the failure this was tuned away from in the first place. */
const CURVE_PER_PIXEL = 0.0000071;
const MAX_CURVE = 0.0011;

/** A phone bends further. What reads as the bend is the turn across one card,
 *  and a phone's card is well under half the width of a desktop's, so the same
 *  curvature spans far less of it. This is set so the turn from a card's near
 *  edge to its far one comes out about the same on both. */
const MAX_CURVE_NARROW = 0.003;

/** How far a card is ever turned, in radians. Past a quarter turn it faces away
 *  and is culled, blinking out while still well inside the screen; well before
 *  that it has stopped reading as a card at all. At the curvature above this
 *  stops the bend growing about one card's width out from the middle. */
const MAX_TILT = 0.9;

/** How far the whole row is pushed towards or away from the camera at full
 *  speed, as a fraction of the camera's distance. Without it the middle card
 *  never changes size: the cylinder rolls about that point, so its tilt and its
 *  z are both zero there by definition. */
const MAX_CENTRE_PUSH = 0.09;

/** How much travel per 60Hz frame counts as fully moving, for the overlay's
 *  fade. Reading a paragraph mid-flick is not possible anyway, and text held
 *  flat while its card bends away reads as two unrelated layers. About two
 *  thirds of an ordinary scroll, so it is gone well before the row is. Scaled
 *  with the multiplier for the same reason the bend was: it is the gesture that
 *  should decide when the text goes, not the pace the row happens to run at. */
const OVERLAY_FADE_SPEED = 41;

/** Room left at the bottom for the progress rail, and above that for the
 *  overlay carrying the centred project's summary and links. The card is sized
 *  into whatever is left, so the overlay never lands on top of it. */
const RAIL_BAND = { wide: 92, narrow: 28 };
const OVERLAY_BAND = { min: 132, ratio: 0.26, max: 230 };

const VERTEX_SHADER = /* glsl */ `
  attribute vec3 position;
  attribute vec2 uv;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uBulge;

  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 displaced = position;
    // Zero at the top and bottom edges, greatest across the middle, so the
    // card's centre leads and its ends trail. The list view bows the other
    // way about, because its run of cards travels the other way.
    displaced.x += sin(uv.y * 3.14159265) * uBulge;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D tMap;
  varying vec2 vUv;

  void main() {
    gl_FragColor = texture2D(tMap, vUv);
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

/** react-icons renders brand marks as inline SVG inheriting `currentColor`. A
 *  texture has nothing to inherit from, so the colour and size are written onto
 *  the copy before it is rasterised. */
function svgToImage(svg: SVGElement) {
  const copy = svg.cloneNode(true) as SVGElement;
  copy.setAttribute("fill", "#ffffff");
  copy.setAttribute("width", "64");
  copy.setAttribute("height", "64");
  const markup = new XMLSerializer().serializeToString(copy);
  return loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`);
}

interface HomeProjectsRowProps {
  entries: HomeRowEntry[];
  /** Index of the last panel. Panel 0 is the empty lead-in that gives the
   *  section title somewhere to travel before the first card arrives, and the
   *  last panel is "See all projects", which is markup rather than a card. */
  lastPanelIndex: number;
  /** Written by the pin each frame: 0 to 1 through the carousel. Read here
   *  rather than passed as state, so nothing re-renders per frame. */
  progressRef: RefObject<number>;
  /** Written here for the swipe handler and for the pin's own length: the row's
   *  travel, in pixels. It comes out of the card geometry, which only this
   *  component knows. */
  travelRef: RefObject<number>;
  /** Called when that travel first becomes known, or changes. The pin's end is
   *  measured from it, so the trigger has to be re-measured when it moves. */
  onTravelChange: () => void;
  /** Styled here each frame, and told which panel to show. */
  overlayRef: RefObject<HTMLDivElement | null>;
  onCentre: (panelIndex: number) => void;
}

export default function HomeProjectsRow({
  entries,
  lastPanelIndex,
  progressRef,
  travelRef,
  overlayRef,
  onCentre,
  onTravelChange,
}: HomeProjectsRowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const iconSourceRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  // The same breakpoint the list view uses: a phone gets the portrait card,
  // anything wider the landscape one. Crossing it redraws the textures.
  const narrow = useMediaQuery("(max-width: 639px)");
  const shape = narrow ? "portrait" : "wide";

  // Held in a ref so a new callback identity does not tear down the scene and
  // rebuild every texture in it.
  const onCentreRef = useRef(onCentre);
  const onTravelChangeRef = useRef(onTravelChange);
  useEffect(() => {
    onCentreRef.current = onCentre;
    onTravelChangeRef.current = onTravelChange;
  }, [onCentre, onTravelChange]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const iconSource = iconSourceRef.current;
    if (!container || !canvas || !iconSource) return;

    let disposed = false;
    const cleanups: Array<() => void> = [];

    const start = async () => {
      // The brand marks are rendered as real SkillMark elements below and read
      // back out of the DOM, so this row, the marquee and the skill pages can
      // never disagree about which logo a skill has.
      await document.fonts.ready;
      if (disposed) return;

      const fontFamily =
        getComputedStyle(document.body).getPropertyValue("--font-tektur").trim() ||
        "system-ui, sans-serif";

      // The grid's stylesheet owns what each origin's colour is; reading it
      // back from a hidden swatch means the views cannot drift apart.
      const originColour = (origin: string) => {
        const swatch = iconSource.querySelector<HTMLElement>(`[data-home-origin="${origin}"]`);
        if (!swatch) return "#ffffff";
        return getComputedStyle(swatch).getPropertyValue("--origin-colour").trim() || "#ffffff";
      };

      const textures = await Promise.all(
        entries.map(async ({ project, origin }) => {
          const image = project.image ? await loadImage(project.image) : null;
          const marks = iconSource.querySelectorAll<SVGElement>(
            `[data-home-icons="${project.slug}"] svg`,
          );
          const icons = (await Promise.all(Array.from(marks).map(svgToImage))).filter(
            (icon): icon is HTMLImageElement => icon !== null,
          );
          return drawCard({
            title: project.title,
            role: project.role,
            image,
            icons,
            // Already quoted by next/font. Quoting it again makes the whole
            // `ctx.font` shorthand invalid, and canvas silently keeps its 10px
            // default rather than reporting anything.
            fontFamily: `${fontFamily}, system-ui, sans-serif`,
            shape,
            originColour: originColour(origin),
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

      // Placed so one world unit is one CSS pixel, which keeps every size below
      // in the same units as the layout. `far` has to clear the camera's own
      // distance — it sits over a thousand units back, and OGL's default far
      // plane of 100 would clip the row away entirely.
      const camera = new Camera(gl, { fov: 45, near: 1, far: 10000 });
      const scene = new Transform();

      const meshes = textures.map((textureCanvas) => {
        const texture = new Texture(gl, { image: textureCanvas, generateMipmaps: false });
        const program = new Program(gl, {
          vertex: VERTEX_SHADER,
          fragment: FRAGMENT_SHADER,
          uniforms: { tMap: { value: texture }, uBulge: { value: 0 } },
          transparent: true,
        });
        // The displacement runs sideways and varies down the card, so the
        // segments are needed the other way round from the list view's.
        const geometry = new Plane(gl, { widthSegments: 8, heightSegments: 48 });
        const mesh = new Mesh(gl, { geometry, program });
        mesh.setParent(scene);
        return mesh;
      });

      let cardWidth = 0;
      let cardHeight = 0;
      let planeWidth = 0;
      let planeHeight = 0;
      let spacing = 0;
      let rowCentreY = 0;
      let bendBand = 0;
      let viewWidth = 0;

      /** How far the text may follow its card before falling off the screen.
       *
       *  Measured from the text rather than assumed, so changing how wide it is
       *  cannot quietly start clipping it — but it can only be measured once
       *  the text exists, and at the first resize it does not: the row opens on
       *  the empty lead-in panel, which has no summary and no links. Taken then
       *  and never again, the limit stayed at zero for the life of the page and
       *  the text never followed anything. So it is taken lazily, and the frame
       *  loop keeps asking until there is something to ask about. */
      let overlayShiftLimit = 0;
      let overlayShiftMeasured = false;

      const measureOverlayShift = () => {
        const overlay = overlayRef.current;
        const content = overlay?.querySelector<HTMLElement>("[data-overlay-content]");
        if (!content || viewWidth === 0) return;
        overlayShiftLimit = Math.max(0, (viewWidth - content.getBoundingClientRect().width) / 2);
        overlayShiftMeasured = true;
      };

      const resize = () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (width === 0 || height === 0) return false;

        renderer.setSize(width, height);
        camera.perspective({ aspect: width / height });
        camera.position.z = height / (2 * Math.tan((45 * Math.PI) / 360));

        // The bands the card may not grow into: the rail along the bottom, the
        // overlay above it, and the room the travelling section title needs.
        const railBand = narrow ? RAIL_BAND.narrow : RAIL_BAND.wide;
        const overlayBand = gsap.utils.clamp(
          OVERLAY_BAND.min,
          OVERLAY_BAND.max,
          height * OVERLAY_BAND.ratio,
        );
        // Room for the section title, which parks at the top of a phone and
        // up to the left on anything wider.
        const topBand = height * (narrow ? 0.16 : 0.14);

        const card = CARD_SHAPES[shape];
        const aspect = card.height / card.width;
        const region = Math.max(120, height - topBand - overlayBand - railBand);
        cardWidth = Math.min(width * (narrow ? 0.86 : 0.62), 680, (region * 0.98) / aspect);
        cardHeight = cardWidth * aspect;
        spacing = cardWidth + Math.max(28, width * 0.08);
        // Panel 0 is empty and the last is the "See all" markup, so the row
        // travels the full run of panels even though only the middle ones
        // carry a card.
        const travel = spacing * lastPanelIndex;
        if (travel !== travelRef.current) {
          travelRef.current = travel;
          // Off this frame: the pin's length comes from this number, and
          // re-measuring every trigger from inside a render loop or a resize
          // observer is how ScrollTrigger ends up measuring a layout that is
          // still half-applied.
          requestAnimationFrame(() => onTravelChangeRef.current());
        }

        // World y is positive upwards from the middle of the section. The card
        // sits centred in what is left above the two bottom bands.
        rowCentreY = (railBand + overlayBand - topBand) / 2;
        bendBand = width;

        // The plane carries the glow's margin as well as the card, so it is
        // larger by exactly the ratio the texture is. Layout, spacing and the
        // tap hit-test all stay in the card's own size.
        const texture = textureSizeFor(shape);
        planeWidth = (cardWidth * texture.width) / card.width;
        planeHeight = (cardHeight * texture.height) / card.height;

        for (const mesh of meshes) mesh.scale.set(planeWidth, planeHeight, 1);

        // The overlay lays itself out against the same two bands, so the text
        // under the card can never be measured from anything the card is not.
        const overlay = overlayRef.current;
        if (overlay) {
          overlay.style.setProperty("--rail-band", `${railBand}px`);
          overlay.style.setProperty("--overlay-band", `${overlayBand}px`);
        }
        // The screen changed size, so whatever was measured against the old one
        // has to be taken again. On a wide screen the limit comes out at most
        // of a card's travel; on a phone the text nearly fills the width, so it
        // comes out near zero and the text stays put while the card slides
        // behind it — which is the only thing that fits there.
        viewWidth = width;
        overlayShiftMeasured = false;
        measureOverlayShift();
        return true;
      };

      let ready = resize();

      let current = 0;
      let reportedPanel = -1;
      // Nothing to draw while the section is off screen, and no reason to hold
      // a GPU loop open behind five other scenes.
      let visible = true;

      const observer = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting;
        },
        { threshold: 0 },
      );
      observer.observe(container);
      cleanups.push(() => observer.disconnect());

      // A card is pixels on a canvas, so it cannot be a link. The tap is
      // resolved against the meshes' own positions instead, and a tap that
      // moved is a swipe rather than a choice.
      let pressX = 0;
      let pressY = 0;
      let pressed = false;

      const onPointerDown = (event: PointerEvent) => {
        pressed = true;
        pressX = event.clientX;
        pressY = event.clientY;
      };

      const onPointerUp = (event: PointerEvent) => {
        if (!pressed) return;
        pressed = false;
        // The overlay's own links sit over the middle card and handle
        // themselves; only presses that landed on the canvas are ours.
        if (event.target !== canvas) return;
        if (Math.hypot(event.clientX - pressX, event.clientY - pressY) > 8) return;

        const rect = container.getBoundingClientRect();
        const worldX = event.clientX - rect.left - rect.width / 2;
        const worldY = rect.height / 2 - (event.clientY - rect.top);
        if (Math.abs(worldY - rowCentreY) > cardHeight / 2) return;

        const hit = meshes.findIndex(
          (mesh) => Math.abs(mesh.position.x - worldX) <= cardWidth / 2,
        );
        if (hit === -1) return;
        router.push(`/projects/${entries[hit].project.slug}`);
      };

      container.addEventListener("pointerdown", onPointerDown);
      container.addEventListener("pointerup", onPointerUp);
      cleanups.push(() => {
        container.removeEventListener("pointerdown", onPointerDown);
        container.removeEventListener("pointerup", onPointerUp);
      });

      const frame = () => {
        if (!visible) return;
        if (!ready) {
          ready = resize();
          if (!ready) return;
        }

        // 1 at 60Hz, 0.5 at 120Hz — how much of a 60Hz frame this one was.
        // Both the easing and the velocity are stated against 60Hz, so the
        // bend is the same size whatever the display is doing.
        const deltaRatio = gsap.ticker.deltaRatio(60);
        const ease = reduceMotion ? 1 : 1 - Math.pow(1 - ROW_EASE, deltaRatio);

        const target = (progressRef.current ?? 0) * spacing * lastPanelIndex;
        const previous = current;
        current += (target - current) * ease;
        const velocity = (current - previous) / deltaRatio;

        // Negated against the direction of travel: the card's middle trails and
        // its ends lead, rather than the other way about. Bowed the way the
        // maths first put it, the row read as leaning into the scroll instead
        // of being dragged along by it.
        const bulge = gsap.utils.clamp(
          -MAX_BULGE,
          MAX_BULGE,
          reduceMotion ? 0 : -velocity * BULGE_PER_PIXEL,
        );
        // The shader displaces in the plane's own units, where 1 is the plane's
        // width, so a height-relative bow is converted on the way in.
        const localBulge = (bulge * planeHeight) / planeWidth;

        const curveCeiling = narrow ? MAX_CURVE_NARROW : MAX_CURVE;
        const curve = gsap.utils.clamp(
          -curveCeiling,
          curveCeiling,
          reduceMotion ? 0 : velocity * CURVE_PER_PIXEL,
        );
        // Whichever runs out first: a screen's worth of distance, or the turn
        // at which a card would start facing away. Both z and the tilt come
        // from the same bounded distance so they cannot disagree.
        const band = curve === 0 ? bendBand : Math.min(bendBand, MAX_TILT / Math.abs(curve));
        const centrePush = (curve / curveCeiling) * MAX_CENTRE_PUSH * camera.position.z;

        meshes.forEach((mesh, index) => {
          // Entry 0 is panel 1: panel 0 is the empty lead-in.
          const flat = (index + 1) * spacing - current;
          const bent = gsap.utils.clamp(-band, band, flat);

          // Rolling the row onto a cylinder of radius 1/curve. Only z and the
          // turn come from the curve — x stays as it was, so the spacing never
          // changes and cards cannot pile up at the far end.
          mesh.position.x = flat;
          mesh.position.y = rowCentreY;
          mesh.position.z = (-bent * bent * curve) / 2 + centrePush;
          mesh.rotation.y = bent * curve;
          (mesh.program.uniforms.uBulge as { value: number }).value = localBulge;
        });

        // The rail, the counter and the overlay all follow the eased row rather
        // than the raw scroll, so they land when the card lands rather than
        // while it is still gliding into place.
        const centred = gsap.utils.clamp(0, lastPanelIndex, Math.round(current / spacing));
        if (centred !== reportedPanel) {
          reportedPanel = centred;
          onCentreRef.current(centred);
        }

        // Costs a layout read, but only until the text first exists — which is
        // the frame after the row leaves the lead-in panel, and never again.
        if (!overlayShiftMeasured) measureOverlayShift();

        const overlay = overlayRef.current;
        if (overlay) {
          // The text rides with the card it belongs to rather than sitting at
          // the middle of the screen waiting for one to arrive. Nothing makes
          // the row stop on a card — there is no snap, and on a phone there is
          // no rail to jump with — so resting halfway between two is the
          // ordinary case, and text pinned to the centre simply vanished for
          // it. Following the card also means the pairing survives the whole
          // gesture instead of only its endpoints.
          const centredX = gsap.utils.clamp(
            -overlayShiftLimit,
            overlayShiftLimit,
            centred * spacing - current,
          );
          overlay.style.transform = `translate3d(${centredX.toFixed(2)}px, 0, 0)`;
          const speed = gsap.utils.clamp(0, 1, Math.abs(velocity) / OVERLAY_FADE_SPEED);
          const opacity = gsap.utils.clamp(0, 1, 1 - speed);
          overlay.style.opacity = `${opacity}`;
          // Never a link a visitor can reach but not read. The flag goes on
          // the container and the links opt in through it, because the
          // container itself spans the whole section — made clickable, it
          // would swallow every tap meant for a card behind it.
          overlay.dataset.settled = opacity > 0.9 ? "true" : "false";
        }

        renderer.render({ scene, camera });
      };

      gsap.ticker.add(frame);
      cleanups.push(() => gsap.ticker.remove(frame));

      const resizeObserver = new ResizeObserver(() => {
        ready = resize();
      });
      resizeObserver.observe(container);
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
  }, [entries, lastPanelIndex, narrow, overlayRef, progressRef, reduceMotion, router, shape, travelRef]);

  return (
    <div ref={containerRef} className="absolute inset-0 z-10 cursor-pointer">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* The cards are pixels on the GPU and carry no text a crawler or a
          screen reader can reach, so the same content is published here as real
          markup. Visually hidden, never display:none — the brand marks are read
          back out of this subtree to build the textures. */}
      <div ref={iconSourceRef} className="sr-only">
        {(["work", "selected", "personal"] as const).map((origin) => (
          <span
            key={origin}
            data-home-origin={origin}
            data-origin={origin}
            className={gridStyles.legendSwatch}
            aria-hidden="true"
          />
        ))}
        <ul>
          {entries.map(({ project, skills }) => (
            <li key={project.slug}>
              <a href={`/projects/${project.slug}`}>{project.title}</a>
              <p>{project.summary}</p>
              <span data-home-icons={project.slug} aria-hidden="true">
                {skills.map((skill) => (
                  <SkillMark key={skill.slug} skill={skill} />
                ))}
              </span>
              <ul>
                {skills.map((skill) => (
                  <li key={skill.slug}>{skill.name}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
