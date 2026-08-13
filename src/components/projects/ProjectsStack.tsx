"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from "ogl";
import gsap from "gsap";
import { Observer } from "gsap/dist/Observer";
import { useScrollActions } from "@/context/SmoothScrollContext";
import { useMediaQuery, useReducedMotion } from "@/hooks/useMediaQuery";
import { lockPageScroll } from "../page-scroll-lock";
import { SkillMark } from "../skills/skill-icons";
import { useActiveProjectsView } from "./ProjectsView";
import gridStyles from "./projects-grid.module.css";
import { CARD_SHAPES, drawCard, textureSizeFor } from "./stack-card";
import type { ProjectContent, SkillContent } from "@/lib/content/types";

export interface StackEntry {
  project: ProjectContent;
  skills: SkillContent[];
  /** Work, selected or personal — the same key the grid colours its cards by. */
  origin: string;
}

/** How much further the stack travels than the gesture that drove it. */
const SCROLL_MULTIPLIER = 2;

/** How much of the remaining distance is covered per 60Hz frame. Lower is
 *  smoother and heavier; this is what makes a flick glide rather than snap. */
const SCROLL_EASE = 0.085;

/** Travel per 60Hz frame, as a fraction of the card's *width*. The bow is
 *  proportional to speed, so a stack at rest is perfectly flat.
 *
 *  Measured against the width, not the height, because the arc spans the card
 *  from side to side: tying it to the height meant that shortening the card
 *  flattened the curve, and halving the image panel cost a third of the bow
 *  without anything about the motion changing.
 *
 *  Both this and the easing above are defined against 60Hz and corrected by
 *  the frame's own delta, because neither is a per-frame quantity in truth: a
 *  120Hz display moves half as far each frame and used to bow half as hard,
 *  which on most current phones read as no bow at all. */
const BULGE_PER_PIXEL = 0.0018;
const MAX_BULGE = 0.10;

/** Curvature of the whole stack, per pixel of travel per 60Hz frame.
 *
 *  The stack is bent around a horizontal axis rather than each card being
 *  curved on its own: a card away from the centre of the screen is rotated to
 *  sit on that cylinder and pushed along z, so it is seen at an angle and
 *  reads as a trapezoid. The card nearest the middle stays square on, which is
 *  what the layout sketches show. The sign follows the direction of travel, so
 *  the sheet is concave one way and convex the other. */
const CURVE_PER_PIXEL = 0.000026;
const MAX_CURVE = 0.00315;

/** A phone bends further. The tilt is the curvature times the distance from
 *  the centre of the screen, and a phone's card is less than half the width of
 *  a desktop's, so the same angle reads as far less of a turn across it. */
const MAX_CURVE_NARROW = 0.0055;

/** How far a card is ever turned, in radians. Past a quarter turn a card is
 *  facing away and the renderer culls it, so it would blink out while still
 *  well inside the screen — on a phone, where the bend is tightest, that
 *  happens to cards a visitor is still looking at. Just under 90 degrees keeps
 *  the steepest card edge-on rather than gone. */
const MAX_TILT = 1.45;

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
    // Zero at the left and right edges, greatest at the centre, so the card's
    // middle leads and its sides trail — the bow drawn in the layout sketch.
    displaced.y += sin(uv.x * 3.14159265) * uBulge;
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

/** react-icons renders brand marks as inline SVG that inherits `currentColor`.
 *  A texture has nothing to inherit from, so the colour and size are written
 *  onto the copy before it is rasterised. */
function svgToImage(svg: SVGElement) {
  const copy = svg.cloneNode(true) as SVGElement;
  copy.setAttribute("fill", "#ffffff");
  copy.setAttribute("width", "64");
  copy.setAttribute("height", "64");
  const markup = new XMLSerializer().serializeToString(copy);
  return loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`);
}

export default function ProjectsStack({ entries }: { entries: StackEntry[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const iconSourceRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const activeView = useActiveProjectsView();
  const active = activeView === "list";
  // Read inside the render loop, which must not be torn down and rebuilt every
  // time the view is toggled — the textures are expensive to redraw.
  const activeRef = useRef(active);
  const { lenis } = useScrollActions();
  const reduceMotion = useReducedMotion();
  // A phone gets a portrait card; anything wider gets the landscape one. The
  // textures are drawn per shape, so crossing this rebuilds them.
  const narrow = useMediaQuery("(max-width: 639px)");
  const shape = narrow ? "portrait" : "wide";
  // Building the textures means eleven full-size canvases, every project image
  // decoded and every brand mark rasterised. The grid is the default view, so
  // none of that is paid for until the list is actually asked for once.
  const [everActive, setEverActive] = useState(active);

  useEffect(() => {
    activeRef.current = active;
    // Latching the first activation is what defers the build; it settles once
    // and never toggles back.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (active) setEverActive(true);
  }, [active]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const iconSource = iconSourceRef.current;
    if (!container || !canvas || !iconSource || !everActive) return;

    gsap.registerPlugin(Observer);

    let disposed = false;
    const cleanups: Array<() => void> = [];

    const start = async () => {
      // The brand marks are rendered as real SkillMark elements below and read
      // back from the DOM, so the marquee, the skill pages and these cards can
      // never disagree about which logo a skill has.
      await document.fonts.ready;
      if (disposed) return;

      const fontFamily =
        getComputedStyle(document.body).getPropertyValue("--font-tektur").trim() ||
        "system-ui, sans-serif";

      // The grid's stylesheet owns what each origin's colour is. Reading it
      // back from a hidden swatch means the two views cannot drift apart the
      // way the skill marks once did.
      const originColour = (origin: string) => {
        const swatch = iconSource.querySelector<HTMLElement>(
          `[data-stack-origin="${origin}"]`,
        );
        if (!swatch) return "#ffffff";
        return getComputedStyle(swatch).getPropertyValue("--origin-colour").trim() || "#ffffff";
      };

      const textures = await Promise.all(
        entries.map(async ({ project, origin }) => {
          const image = project.image ? await loadImage(project.image) : null;
          const marks = iconSource.querySelectorAll<SVGElement>(
            `[data-stack-icons="${project.slug}"] svg`,
          );
          const icons = (await Promise.all(Array.from(marks).map(svgToImage))).filter(
            (icon): icon is HTMLImageElement => icon !== null,
          );
          return drawCard({
            title: project.title,
            role: project.role,
            image,
            icons,
            // Already quoted by next/font — quoting it again makes the whole
            // `ctx.font` shorthand invalid, and canvas silently keeps its 10px
            // default rather than reporting the error.
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

      // A perspective camera placed so that one world unit is one CSS pixel,
      // which keeps every size below in the same units as the layout.
      // `far` has to clear the camera's own distance: one world unit is one
      // pixel here, so the camera sits over a thousand units back and OGL's
      // default far plane of 100 would clip the whole stack away.
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
        // Enough segments across for the bow to read as a curve rather than a
        // fold; the displacement is horizontal-only so the height needs few.
        const geometry = new Plane(gl, { widthSegments: 48, heightSegments: 8 });
        const mesh = new Mesh(gl, { geometry, program });
        mesh.setParent(scene);
        return mesh;
      });

      let cardWidth = 0;
      let cardHeight = 0;
      let planeWidth = 0;
      let planeHeight = 0;
      let spacing = 0;
      let total = 0;
      let bendBand = 0;

      const resize = () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        // Hidden by the view toggle: nothing to measure, and resizing to zero
        // would throw the projection away.
        if (width === 0 || height === 0) return false;

        renderer.setSize(width, height);
        camera.perspective({ aspect: width / height });
        camera.position.z = height / (2 * Math.tan((45 * Math.PI) / 360));

        const card = CARD_SHAPES[shape];
        const aspect = card.height / card.width;
        // Fit to whichever axis runs out first, so a card is never taller than
        // the screen it has to be read on.
        bendBand = height;
        cardWidth = Math.min(width * 0.88, 820, (height * 0.78) / aspect);
        cardHeight = cardWidth * aspect;
        spacing = cardHeight + Math.max(28, height * 0.05);
        total = spacing * meshes.length;

        // The plane carries the glow's margin as well as the card, so it is
        // larger than the card by exactly the ratio the texture is. Layout,
        // spacing and the tap hit-test all stay in the card's own size.
        const texture = textureSizeFor(shape);
        planeWidth = (cardWidth * texture.width) / card.width;
        planeHeight = (cardHeight * texture.height) / card.height;

        for (const mesh of meshes) {
          mesh.scale.set(planeWidth, planeHeight, 1);
        }
        return true;
      };

      let ready = resize();

      let target = 0;
      let current = 0;

      const observer = Observer.create({
        target: container,
        type: "wheel,touch,pointer",
        preventDefault: true,
        // The stack is the only thing moving on this view, so the gesture is
        // multiplied here rather than by scrolling the document further.
        onChange: (self) => {
          target += self.deltaY * SCROLL_MULTIPLIER;
        },
      });
      cleanups.push(() => observer.kill());

      // A card is pixels on a canvas, so it cannot be a link. The tap is
      // resolved against the meshes' own positions instead, and a tap that
      // moved is a flick rather than a choice.
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
        if (Math.hypot(event.clientX - pressX, event.clientY - pressY) > 8) return;

        const rect = container.getBoundingClientRect();
        const worldX = event.clientX - rect.left - rect.width / 2;
        const worldY = rect.height / 2 - (event.clientY - rect.top);
        if (Math.abs(worldX) > cardWidth / 2) return;

        const hit = meshes.findIndex(
          (mesh) => Math.abs(mesh.position.y - worldY) <= cardHeight / 2,
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
        // Standing down while the grid is showing: there is nothing on screen
        // to draw, and the stack should not keep a GPU loop alive behind it.
        if (!activeRef.current) return;
        if (!ready) {
          ready = resize();
          if (!ready) return;
        }

        // 1 at 60Hz, 0.5 at 120Hz — how much of a 60Hz frame this one was.
        const deltaRatio = gsap.ticker.deltaRatio(60);
        const ease = reduceMotion ? 1 : 1 - Math.pow(1 - SCROLL_EASE, deltaRatio);

        const previous = current;
        current += (target - current) * ease;
        // Restated as travel per 60Hz frame, so the bow is the same size on
        // any refresh rate rather than shrinking as the display gets faster.
        const velocity = (current - previous) / deltaRatio;

        const bulge = gsap.utils.clamp(
          -MAX_BULGE,
          MAX_BULGE,
          reduceMotion ? 0 : velocity * BULGE_PER_PIXEL,
        );
        // The shader displaces in the plane's own units, where 1 is the card's
        // height, so a width-relative bow is converted on the way in.
        const localBulge = (bulge * planeWidth) / planeHeight;

        const curveCeiling = narrow ? MAX_CURVE_NARROW : MAX_CURVE;
        const curve = gsap.utils.clamp(
          -curveCeiling,
          curveCeiling,
          reduceMotion ? 0 : velocity * CURVE_PER_PIXEL,
        );
        // Whichever runs out first: a screen's worth of distance, or the turn
        // at which a card would start facing away. Both z and the tilt are
        // taken from the same bounded distance so they cannot disagree.
        const band =
          curve === 0 ? bendBand : Math.min(bendBand, MAX_TILT / Math.abs(curve));

        meshes.forEach((mesh, index) => {
          // Laid out downwards: the first project sits above the second, so
          // scrolling down walks forwards through the list. Stacking these the
          // other way up reads as an inverted scroll — the page appeared to
          // run backwards through the projects.
          const flat = gsap.utils.wrap(-total / 2, total / 2, current - index * spacing);
          // The bend stops growing beyond a screen's worth of distance. Left
          // unbounded, a card far enough up the stack swings so far around the
          // cylinder that it comes back towards the camera and appears in
          // front of the cards actually being read.
          const bent = gsap.utils.clamp(-band, band, flat);

          // Rolling the run of cards onto a cylinder of radius 1/curve. Only
          // z and the tilt come from the curve — y stays as it was, so the
          // spacing never changes and cards cannot pile up at the far end.
          mesh.position.y = flat;
          mesh.position.z = (-bent * bent * curve) / 2;
          mesh.rotation.x = -bent * curve;
          (mesh.program.uniforms.uBulge as { value: number }).value = localBulge;
        });

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
  }, [entries, everActive, narrow, reduceMotion, router, shape]);

  // The document must not scroll behind a view that has taken the gesture over.
  // This is the counted lock the entry screen and the menu already share, so
  // Lenis is stopped once no matter how many holders there are.
  // The document must not scroll behind a view that has taken the gesture
  // over. This is the counted lock the entry screen and the menu already
  // share, so Lenis is stopped once no matter how many holders there are.
  useEffect(() => {
    if (!active) return;
    return lockPageScroll(lenis);
  }, [active, lenis]);

  return (
    <div ref={containerRef} className="relative h-[100svh] w-full cursor-pointer touch-none overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* The cards are pixels on the GPU and carry no text a crawler or a
          screen reader can reach, so the same content is published here as
          real markup. Visually hidden, never display:none — the brand marks
          above are read back out of this subtree to build the textures. */}
      <div ref={iconSourceRef} className="sr-only">
        {(["work", "selected", "personal"] as const).map((origin) => (
          <span
            key={origin}
            data-stack-origin={origin}
            data-origin={origin}
            className={gridStyles.legendSwatch}
            aria-hidden="true"
          />
        ))}
        <h2>Projects</h2>
        <ul>
          {entries.map(({ project, skills }) => (
            <li key={project.slug}>
              <a href={`/projects/${project.slug}`}>{project.title}</a>
              <p>{project.summary}</p>
              <span data-stack-icons={project.slug} aria-hidden="true">
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
