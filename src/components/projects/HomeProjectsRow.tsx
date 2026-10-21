"use client";

import { useEffect, useRef, type RefObject } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePrefetchProjects } from "@/hooks/usePrefetchProjects";
import { announceNavigation } from "@/components/skeleton/PendingNavigation";
import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from "ogl";
import gsap from "gsap";
import { useGlRecovery } from "@/hooks/useGlRecovery";
import { useMediaQuery, useReducedMotion } from "@/hooks/useMediaQuery";
import { SkillMark } from "@/components/skills/skill-icons";
import type { ProjectContent, SkillContent } from "@/lib/content/types";
import gridStyles from "./projects-grid.module.css";
import { CARD_SHAPES, drawCard, drawSeeAllCard, textureSizeFor } from "./stack-card";
import { homeProjectsLayout, homeProjectsOverlayOffset } from "./home-projects-layout";
import { CARD_TEXTURE_IMAGE_WIDTH, cloudinaryImage } from "@/lib/cloudinary";
import { blackholeCentre } from "@/background/blackhole-centre";

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

/** The shape the row moves through: the cards come out of the black hole.
 *
 *  Seen from the front, the row runs out of the background black hole's centre
 *  on the right, through the centred card, and off the left edge of the screen.
 *  - Right of the centred card it is a funnel narrowing into the hole: a card
 *    there is shorter and narrower the closer it is, the cards crowd together
 *    as if receding into it, and they fade out just before they reach it. The
 *    row's own line bends to meet the hole's centre, wherever on the screen the
 *    hole is. Always there: it is where the cards come from.
 *  - The centred card is its own size.
 *  - Left of it the channel flares open towards the screen's edge: a card there
 *    grows taller towards the edge, widths unchanged. A little at rest, opened
 *    by speed in either direction to HORN_FLARE times the card's height taller
 *    at the edge — a little past the proportions of the sketch it was drawn
 *    from. */
const HORN_FLARE = 2.2;
/** The shortest the flare's walls may be, as a fraction of half the screen's
 *  width. Only a phone, where the centred card nearly fills the screen, falls
 *  back on it. */
const HORN_MIN_RAMP = 0.55;
/** How much of the flare is there with the row standing still. */
const HORN_AT_REST = 0.18;
/** Travel per 60Hz frame at which the flare is fully open: about a hard flick.
 *  An ordinary scroll opens it a little over half way. */
const HORN_FULL_SPEED = 90;
/** How much of the gap to its target the flare closes per 60Hz frame, so it
 *  opens and relaxes smoothly rather than following every jitter in speed. */
const HORN_EASE = 0.14;
/** On a phone the hole sits behind the centred card, so there is nowhere to
 *  its right to narrow into. When the hole is less than FUNNEL_MIN_DEPTH of
 *  half the screen past the centred card's edge, the funnel runs off the right
 *  edge of the screen instead, FUNNEL_FALLBACK_DEPTH of half the screen past
 *  the card, at the hole's height. Anywhere else it ends at the hole's centre. */
const FUNNEL_MIN_DEPTH = 0.12;
/** The funnel ends this fraction of the screen's width past the hole's centre.
 *  At the centre itself the cards had faded out by the time they reached the
 *  shadow's near edge, so they read as coming from in front of the hole rather
 *  than out of it. */
const FUNNEL_PAST_CENTRE = 0.05;
const FUNNEL_FALLBACK_DEPTH = 0.35;
/** How the funnel narrows. A card past the centred one's edge is scaled by
 *  (1 + along / T) ^ -FUNNEL_CURVE, where T is set so the row leaves the
 *  centred card at its own pace — no corner at the join — and its place closes
 *  on the hole as its size goes. Lower is a gentler fall in height and a
 *  narrower card: at 0.35 the next card is about a tenth of its own width and
 *  three quarters of its height at its near edge. */
const FUNNEL_CURVE = 0.35;
/** Where along the funnel, in panels past the centred card's edge, the cards
 *  start to fade, and where they are gone. */
const FUNNEL_FADE_FROM = 2;
const FUNNEL_FADE_TO = 3;
/** How much wider a card leaving to the left is at the screen's edge with the
 *  flare fully open, as a multiple of its own width: it widens as it grows. */
const HORN_WIDEN = 1.2;
/** Until the "Projects" heading starts its move from the centre to the corner
 *  there are no cards. Then the row is drawn out of the hole while the heading
 *  moves, so the first card arrives as the heading settles: it waits this many
 *  panels further into the funnel, close enough to the mouth that it can be
 *  seen growing out of it the whole way, and fades in from nothing over the
 *  first EMERGE_FADE of the way. Deeper, it was a sliver a few pixels wide for
 *  most of the move and then arrived at once. The heading's own cues are in
 *  projects.tsx: it moves from 2% to 16% of the pinned scroll, and the first
 *  card is centred at one panel. */
const EMERGE_DEPTH = 1.2;
const EMERGE_FROM = 0.1;
const EMERGE_FADE = 0.15;

/** How much travel per 60Hz frame counts as fully moving, for the overlay's
 *  fade. Reading a paragraph mid-flick is not possible anyway, and text held
 *  flat while its card bends away reads as two unrelated layers. About two
 *  thirds of an ordinary scroll, so it is gone well before the row is. Scaled
 *  with the multiplier for the same reason the bend was: it is the gesture that
 *  should decide when the text goes, not the pace the row happens to run at. */
const OVERLAY_FADE_SPEED = 41;

const VERTEX_SHADER = /* glsl */ `
  attribute vec3 position;
  attribute vec2 uv;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  // In pixels from the middle of the canvas, y up: this card's centre, its
  // plane's size, half the canvas's width, half the centred card's width, and
  // the black hole's centre.
  uniform vec2 uRow;
  uniform vec2 uPlane;
  uniform float uHalfView;
  uniform float uHalfCard;
  uniform vec2 uHole;
  // The distance between cards, and how much wider a card leaving to the
  // left is at the screen's edge.
  uniform float uSpacing;
  uniform float uWiden;
  // How open the flare is, 0 to 1, and how much taller it is when fully open.
  uniform float uHorn;
  uniform float uFlare;

  varying vec2 vUv;
  // The stretched height and the stretch itself, divided again per pixel;
  // and how much of the card is left before the hole takes it.
  varying float vY;
  varying float vStretch;
  varying float vFade;

  void main() {
    vUv = uv;
    // Where this point would be in a straight, flat row.
    float x = uRow.x + position.x * uPlane.x;
    float stretch = 1.0;
    float placedX = x;
    float lineY = uRow.y;
    float fade = 1.0;

    if (x < 0.0) {
      // The flare. Its walls rise over the gap between the centred card and
      // the screen's edge, never over less than HORN_MIN_RAMP of half the
      // screen (on a phone the gap is 35px and the wall came up as a spike),
      // in an S-curve so the channel leaves the card level and arrives level.
      float ramp = max(uHalfView - uHalfCard, uHalfView * ${HORN_MIN_RAMP.toFixed(2)});
      float past = max(-x - uHalfCard, 0.0);
      float reach = clamp(past / ramp, 0.0, 1.0);
      stretch = 1.0 + uFlare * uHorn * reach * reach * (3.0 - 2.0 * reach);
      // And wider, by the same S-curve: the extra width is that curve's
      // integral, so each point moves out by as much as everything between it
      // and the centred card has grown, and the cards never overlap.
      float grown = reach < 1.0
        ? ramp * (reach * reach * reach - 0.5 * reach * reach * reach * reach)
        : ramp * 0.5 + (past - ramp);
      placedX = x - uWiden * uHorn * grown;
    } else {
      // The funnel: a row receding into a vanishing point at the hole. Past
      // the centred card's edge a card is scaled by (1 + along / T) ^ -k, and
      // its place closes on the hole by what it has lost. T = depth * k makes
      // the slope at the join exactly 1, so the row turns into the funnel
      // without a corner; the width then falls far faster than the height,
      // which is what crowds the cards together near the hole. The row's
      // line bends from its own height to the hole's as it goes.
      float k = ${FUNNEL_CURVE.toFixed(2)};
      float depth = max(uHole.x - uHalfCard, 1.0);
      float along = max(x - uHalfCard, 0.0);
      float scale = pow(1.0 + along / (depth * k), -k);
      float into = 1.0 - scale;
      placedX = min(x, uHalfCard) + depth * into;
      stretch = scale;
      lineY = mix(uRow.y, uHole.y, into);
      fade = 1.0 - smoothstep(${FUNNEL_FADE_FROM.toFixed(1)} * uSpacing, ${FUNNEL_FADE_TO.toFixed(1)} * uSpacing, along);
    }

    vec3 displaced = vec3(
      (placedX - uRow.x) / uPlane.x,
      position.y * stretch + (lineY - uRow.y) / uPlane.y,
      position.z
    );
    vY = position.y * stretch;
    vStretch = max(stretch, 0.0001);
    vFade = fade;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D tMap;
  varying vec2 vUv;
  varying float vY;
  varying float vStretch;
  varying float vFade;
  // The whole row, faded in as it starts to come out of the hole.
  uniform float uAppear;

  void main() {
    // Each strip of the card is a trapezoid once it is stretched, and a
    // texture coordinate interpolated across its two triangles kinks along
    // their shared diagonal: a saw-tooth down every edge. The height and the
    // stretch both vary linearly across a strip, so dividing them here gives
    // the exact point on the card. (The plane's v runs from 0 at its bottom,
    // y = -0.5, to 1 at its top.)
    vec4 colour = texture2D(tMap, vec2(vUv.x, vY / vStretch + 0.5));
    gl_FragColor = vec4(colour.rgb, colour.a * vFade * uAppear);
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
   *  last panel is the row's own "See all projects" card, appended after the
   *  real ones. */
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
  usePrefetchProjects(entries.map(({ project }) => project.slug), ["/projects"]);
  const reduceMotion = useReducedMotion();
  // The same breakpoint the list view uses: a phone gets the portrait card,
  // anything wider the landscape one. Crossing it redraws the textures.
  const narrow = useMediaQuery("(max-width: 639px)");
  const shape = narrow ? "portrait" : "wide";
  const { generation, watchContext, releaseContext } = useGlRecovery();

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
    // Attached before anything is built: setting the scene up means decoding
    // every project image and rasterising every brand mark, and a context lost
    // during that is still lost.
    let contextLost = false;
    const cleanups: Array<() => void> = [
      watchContext(canvas, () => {
        contextLost = true;
      }),
    ];

    const start = async () => {
      // The brand marks are rendered as real SkillMark elements below and read
      // back out of the DOM, so this row, the marquee and the skill pages can
      // never disagree about which logo a skill has.
      await document.fonts.ready;
      if (disposed) return;

      const fontFamily =
        getComputedStyle(document.body).getPropertyValue("--font-tektur").trim() ||
        "system-ui, sans-serif";
      const quotedFontFamily = `${fontFamily}, system-ui, sans-serif`;

      // The grid's stylesheet owns what each origin's colour is; reading it
      // back from a hidden swatch means the views cannot drift apart.
      const originColour = (origin: string) => {
        const swatch = iconSource.querySelector<HTMLElement>(`[data-home-origin="${origin}"]`);
        if (!swatch) return "#ffffff";
        return getComputedStyle(swatch).getPropertyValue("--origin-colour").trim() || "#ffffff";
      };
      const accentColour =
        getComputedStyle(document.documentElement).getPropertyValue("--color-accent-soft").trim() ||
        "#ff7a18";

      const projectTextures = await Promise.all(
        entries.map(async ({ project, origin }) => {
          const image = project.image ? await loadImage(cloudinaryImage(project.image, CARD_TEXTURE_IMAGE_WIDTH)) : null;
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
            fontFamily: quotedFontFamily,
            shape,
            originColour: originColour(origin),
          });
        }),
      );
      if (disposed) return;

      // The row's last panel, appended as one more texture rather than left
      // as a gap the row travels through - it moves and bends exactly like a
      // project card because, from here down, it is treated as one: same
      // mesh, same geometry, same spacing. The panel maths below already
      // brings the panel *after* the last project to centre exactly when the
      // pin's own scroll range ends (see SCROLL_MULTIPLIER's caller), so
      // giving that panel a card is what lets the visitor see it arrive
      // before the page hands off to ordinary vertical scroll.
      const textures = [
        ...projectTextures,
        drawSeeAllCard({ fontFamily: quotedFontFamily, shape, accentColour }),
      ];

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
          uniforms: {
            tMap: { value: texture },
            uRow: { value: [0, 0] },
            uPlane: { value: [1, 1] },
            uHalfView: { value: 1 },
            uHalfCard: { value: 0 },
            uHole: { value: [1, 0] },
            uSpacing: { value: 1 },
            uWiden: { value: HORN_WIDEN },
            uAppear: { value: 1 },
            uHorn: { value: HORN_AT_REST },
            uFlare: { value: HORN_FLARE },
          },
          transparent: true,
        });
        // The horn's height changes across the card, so the segments run
        // across it; down it, the card only stretches, which needs none.
        const geometry = new Plane(gl, { widthSegments: 48, heightSegments: 1 });
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

        const card = CARD_SHAPES[shape];
        const aspect = card.height / card.width;
        const title = container.closest("#projects")
          ?.querySelector<HTMLElement>("[data-projects-title]");
        const headerBottom = document
          .querySelector<HTMLElement>('header[role="banner"]')
          ?.getBoundingClientRect().bottom ?? 0;
        const layout = homeProjectsLayout({
          width,
          height,
          narrow,
          cardAspect: aspect,
          titleHeight: title?.offsetHeight ?? 0,
          titleWidth: title?.offsetWidth ?? 0,
          headerBottom,
          navBottom: document
            .querySelector<HTMLElement>("[aria-label='Scene navigation indicator']")
            ?.getBoundingClientRect().bottom ?? 0,
        });
        const { railBand, overlayBand } = layout;
        cardWidth = layout.cardWidth;
        cardHeight = layout.cardHeight;
        spacing = cardWidth + Math.max(28, width * 0.08);
        // Panel 0 is empty, so the row travels one panel further than there
        // are cards to reach it before the first one arrives.
        const travel = spacing * lastPanelIndex;
        if (travel !== travelRef.current) {
          travelRef.current = travel;
          // Off this frame: the pin's length comes from this number, and
          // re-measuring every trigger from inside a render loop or a resize
          // observer is how ScrollTrigger ends up measuring a layout that is
          // still half-applied.
          requestAnimationFrame(() => onTravelChangeRef.current());
        }

        // World y is positive upwards from the middle of the section.
        rowCentreY = height / 2 - (layout.cardTop + cardHeight / 2);

        // The browser tests cannot inspect pixels inside WebGL. Publish the
        // calculated card bounds so they can verify the same geometry the
        // renderer and pointer hit-test use.
        container.dataset.cardTop = layout.cardTop.toFixed(2);
        container.dataset.cardBottom = layout.cardBottom.toFixed(2);
        container.dataset.cardLeft = ((width - cardWidth) / 2).toFixed(2);
        container.dataset.overlayTop = layout.overlayTop.toFixed(2);
        container.dataset.railTop = layout.railTop.toFixed(2);

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
      let horn = HORN_AT_REST;
      /** What the last frame drew with, so a tap is tested against the cards
       *  where they were seen rather than where a flat row would put them. */
      let drawn = { rowY: 0, hole: [1, 0], horn: HORN_AT_REST };
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

        // The vertex shader's shape, undone for one point: back from where the
        // tap landed to where it would be in a flat row, and how tall the row
        // is there and where its line runs.
        const halfCard = cardWidth / 2;
        let flatX = worldX;
        let halfHeight = cardHeight / 2;
        let lineY = drawn.rowY;
        if (worldX > halfCard) {
          const depth = Math.max(drawn.hole[0] - halfCard, 1);
          const into = (worldX - halfCard) / depth;
          if (into >= 1) return;
          const along = depth * FUNNEL_CURVE * (Math.pow(1 - into, -1 / FUNNEL_CURVE) - 1);
          // Past the fade the cards are not there to be tapped.
          if (along >= FUNNEL_FADE_FROM * spacing) return;
          flatX = halfCard + along;
          halfHeight *= 1 - into;
          lineY += (drawn.hole[1] - drawn.rowY) * into;
        } else if (worldX < 0) {
          const halfView = viewWidth / 2;
          const ramp = Math.max(halfView - halfCard, halfView * HORN_MIN_RAMP);
          // The widening has no closed-form inverse; it only ever grows, so a
          // bisection finds the flat point that lands where the tap did.
          const widen = HORN_WIDEN * drawn.horn;
          const placed = (past: number) => {
            const r = Math.min(1, past / ramp);
            const grown = r < 1 ? ramp * (r ** 3 - 0.5 * r ** 4) : ramp * 0.5 + (past - ramp);
            return past + widen * grown;
          };
          const target = Math.max(0, -worldX - halfCard);
          let low = 0;
          let high = target;
          for (let step = 0; step < 24; step += 1) {
            const mid = (low + high) / 2;
            if (placed(mid) < target) low = mid;
            else high = mid;
          }
          const past = (low + high) / 2;
          flatX = worldX < -halfCard ? -(halfCard + past) : worldX;
          const reach = gsap.utils.clamp(0, 1, past / ramp);
          halfHeight *= 1 + HORN_FLARE * drawn.horn * reach * reach * (3 - 2 * reach);
        }
        if (Math.abs(worldY - lineY) > halfHeight) return;

        const hit = meshes.findIndex(
          (mesh) => Math.abs(mesh.position.x - flatX) <= cardWidth / 2,
        );
        if (hit === -1) return;
        // The last mesh is the row's own "see all" card, one past the real
        // projects rather than one of them.
        const href = hit === entries.length ? "/projects" : `/projects/${entries[hit].project.slug}`;
        announceNavigation(href);
        router.push(href);
      };

      container.addEventListener("pointerdown", onPointerDown);
      container.addEventListener("pointerup", onPointerUp);
      cleanups.push(() => {
        container.removeEventListener("pointerdown", onPointerDown);
        container.removeEventListener("pointerup", onPointerUp);
      });

      const frame = () => {
        // Every GL call into a lost context is ignored, so this is about not
        // spending a frame's work to be ignored — and about not reading back
        // sizes from a renderer whose context is gone.
        if (contextLost || !visible) return;
        try {
          drawFrame();
        } catch (error) {
          // A context can be lost between the check above and the GL calls
          // below - the browser's own event for that fires asynchronously, so
          // a frame can still be mid-render when it happens. OGL's bookkeeping
          // assumes a live context and throws rather than no-op'ing, which
          // otherwise escaped the ticker uncaught and took the whole page down
          // with it. Treated the same as the watched event: stop drawing and
          // wait for a restore to rebuild the scene.
          contextLost = true;
          if (process.env.NODE_ENV !== "production") console.error(error);
        }
      };

      const drawFrame = () => {
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

        // How open the horn is: a little at rest, opening with speed in either
        // direction, eased so it neither snaps open nor jitters.
        const hornTarget = reduceMotion
          ? HORN_AT_REST
          : HORN_AT_REST + (1 - HORN_AT_REST) * gsap.utils.clamp(0, 1, Math.abs(velocity) / HORN_FULL_SPEED);
        horn += (hornTarget - horn) * (reduceMotion ? 1 : 1 - Math.pow(1 - HORN_EASE, deltaRatio));

        // Where the canvas is on screen. While the section is still coming up
        // from below, the row is held where it will sit once the section has
        // arrived, so only the heading rises with the page: the cards come out
        // of the black hole rather than up from the bottom of the screen. Once
        // the section is pinned this is zero; leaving it, or arriving from
        // below it, the row goes with the page.
        const box = container.getBoundingClientRect();
        const rowY = rowCentreY + Math.max(0, box.top);
        // The hole, in the canvas's own terms: pixels from its middle, y up.
        // Without a drawn black hole (the video fallback) the row still runs
        // into the same place on the right, at its own height.
        const holeX = blackholeCentre.drawn
          ? blackholeCentre.x - (box.left + box.width / 2) + viewWidth * FUNNEL_PAST_CENTRE
          : viewWidth * 0.35;
        const holeY = blackholeCentre.drawn ? box.top + box.height / 2 - blackholeCentre.y : rowY;
        const holeClear = holeX - cardWidth / 2 >= (viewWidth / 2) * FUNNEL_MIN_DEPTH;
        const hole = [holeClear ? holeX : cardWidth / 2 + (viewWidth / 2) * FUNNEL_FALLBACK_DEPTH, holeY];
        // Nothing until the heading starts to move, then drawn out of the hole
        // while it does: the whole row waits EMERGE_DEPTH panels further in.
        const emerged = reduceMotion
          ? 1
          : gsap.utils.clamp(0, 1, (current / spacing - EMERGE_FROM) / (1 - EMERGE_FROM));
        const waiting = (1 - emerged) * EMERGE_DEPTH * spacing;
        const appear = gsap.utils.clamp(0, 1, emerged / EMERGE_FADE);
        drawn = { rowY, hole, horn };

        meshes.forEach((mesh, index) => {
          // Entry 0 is panel 1: panel 0 is the empty lead-in.
          const flat = (index + 1) * spacing - current + waiting;
          mesh.position.x = flat;
          mesh.position.y = rowY;
          const uniforms = mesh.program.uniforms as Record<string, { value: number | number[] }>;
          uniforms.uRow.value = [flat, rowY];
          uniforms.uPlane.value = [planeWidth, planeHeight];
          uniforms.uHalfView.value = viewWidth / 2;
          uniforms.uHalfCard.value = cardWidth / 2;
          uniforms.uHole.value = hole;
          uniforms.uSpacing.value = spacing;
          uniforms.uAppear.value = appear;
          uniforms.uHorn.value = horn;
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
          // Desktop details stay in one fixed place below the carousel and
          // switch when the focused card changes. A phone has no progress rail
          // to settle with and can naturally stop between panels, so there the
          // details continue to follow their card within the available width.
          const centredX = homeProjectsOverlayOffset({
            narrow,
            shiftLimit: overlayShiftLimit,
            focusedOffset: centred * spacing - current,
          });
          overlay.style.transform = `translate3d(${centredX.toFixed(2)}px, 0, 0)`;
          const speed = gsap.utils.clamp(0, 1, Math.abs(velocity) / OVERLAY_FADE_SPEED);
          // And not before its card has come all the way out of the hole.
          const arrived = gsap.utils.clamp(0, 1, (emerged - 0.75) / 0.25);
          const opacity = gsap.utils.clamp(0, 1, 1 - speed) * arrived;
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

      // Mobile Safari (and, to a lesser extent, Chrome) resizes the visual
      // viewport by dozens of pixels as its address bar shows and hides -
      // including mid-scroll, since the bar can auto-hide while a visitor is
      // still moving through the page. That is not a layout change: it is
      // the same device, asked to redraw a card size and, through it, this
      // pin's own scroll length (`travelRef`, read by projects.tsx to size
      // the ScrollTrigger). Recalculating and refreshing that while the pin
      // is actively being scrolled through is what made the section's start
      // and the "See all projects" reveal both jump - the boundary the
      // visitor was scrolling against moved out from under them. A real
      // width change, or a height change large enough to be a rotation
      // rather than a toolbar, still goes through immediately.
      let lastWidth = container.clientWidth;
      let lastHeight = container.clientHeight;
      const IGNORE_HEIGHT_DELTA = 150;
      const resizeObserver = new ResizeObserver(() => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        const widthChanged = width !== lastWidth;
        const heightDelta = Math.abs(height - lastHeight);
        lastWidth = width;
        lastHeight = height;
        if (!widthChanged && heightDelta < IGNORE_HEIGHT_DELTA) return;
        ready = resize();
      });
      resizeObserver.observe(container);
      cleanups.push(() => resizeObserver.disconnect());

      // A browser only allows a handful of live WebGL contexts, and leaving to
      // a case study and coming back would take a new one each time.
      cleanups.push(() => releaseContext(gl));
    };

    void start();

    return () => {
      disposed = true;
      for (const cleanup of cleanups) cleanup();
    };
    // `generation` is what rebuilds the scene after a lost context is given
    // back: everything below is gone with it, so it is built again rather than
    // patched.
  }, [entries, generation, lastPanelIndex, narrow, overlayRef, progressRef, reduceMotion, releaseContext, router, shape, travelRef, watchContext]);

  return (
    <div
      ref={containerRef}
      data-home-projects-row
      className="absolute inset-0 z-10 cursor-pointer"
    >
      {/* Keyed so crossing the `narrow` breakpoint or recovering from a lost
          context (`generation`) mounts a fresh canvas rather than reusing the
          old one. Both tear the scene down and build a new one on the same
          effect run, calling WEBGL_lose_context.loseContext() on the outgoing
          context and creating a new one in the same tick - and a fresh
          getContext() call on a canvas whose previous context is still being
          torn down can come back looking valid while every GL call on it
          silently fails, which is what a shader "failing to compile" with a
          null info log actually means. A new element sidesteps the race
          instead of trying to win it. */}
      <canvas key={`${narrow ? "n" : "w"}-${generation}`} ref={canvasRef} className="absolute inset-0 h-full w-full" />

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
          <li>
            <Link href="/projects">See all projects</Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
