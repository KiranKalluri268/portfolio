# Animation system

## Principles

1. Native scrolling remains available at all times after entry.
2. Lenis smooths scroll; it does not decide section state.
3. GSAP owns scroll-linked transforms and timelines.
4. React state is reserved for semantic UI state, not per-frame animation values.
5. Every new effect must define reduced-motion behavior and cleanup.
6. Avoid animating layout properties when transforms or opacity can produce the same result.

## Lenis and GSAP integration

`SmoothScrollContext` creates Lenis with `autoRaf: false`. GSAP's ticker calls `lenis.raf()`, keeping smooth scrolling and `ScrollTrigger` on the same animation clock. Lenis updates call `ScrollTrigger.update()`.

Do not create another Lenis instance, independent request-animation-frame loop, or global wheel listener.

## Current animations

### Entry screen

The loader canvas draws orbiting particles independently from the percentage state, so progress updates do not restart the orbit. Entry does not begin the hero sequence until the user activates Enter.

### Hero

The hero uses React timers for a controlled typing lifecycle:

```text
type greeting → delete greeting → type name → cycle roles
```

Tektur is used at every breakpoint. Cursor color follows the active text color.

### About

One pinned ScrollTrigger maps scroll progress to word readability. Previously read lines gradually dim as the next line progresses. The résumé link is revealed near the end of the paragraph sequence.

### Projects

One scrubbed GSAP timeline translates the project track while pinning the section. Lenis keeps the underlying vertical scroll smooth without forcing the viewport to a panel after input settles. Do not add custom or CSS scroll snapping, or a second transform owner to the track.

On desktop, the focused project's summary and actions stay in one centred DOM
region below the WebGL carousel and switch when focus moves to another card.
On mobile, that region may follow its card horizontally because there is no
progress rail to settle on and a swipe may stop between panels.

### Projects — list view (the card stack)

`/projects` has two views. The grid is DOM; the list is a single WebGL canvas
(OGL) drawing every card as a textured plane, and it is the one place on the
site that does **not** scroll the document.

- **Scroll is hijacked, deliberately.** A GSAP `Observer` takes wheel, touch and
  pointer on the container and moves the stack itself; the page is held still
  through the counted `lockPageScroll` the entry screen and the menu share, so
  Lenis is stopped exactly once. The stack travels 3× the gesture and wraps
  with `gsap.utils.wrap`, which is what makes it endless — the document is not
  infinitely tall and never scrolls at all.
- **The bulge is the whole stack bending, not each card curving.** The run of
  cards is rolled onto a cylinder whose curvature comes from the velocity: a
  card away from the centre of the screen is pushed along z and tilted to sit
  on that cylinder, so it is seen at an angle and reads as a trapezoid, while
  the card nearest the middle stays square on. The sign follows the direction
  of travel — convex as the cards run up, concave as they run down. At rest the
  curvature is zero and the stack is flat.
  - Only z and the tilt come from the curve. `y` stays linear, so spacing never
    changes, cards cannot pile up at the far end, and the tap hit-test still
    resolves against a card's real position.
  - The whole sheet is also pushed along z, not just bent. The cylinder is
    rolled about the centre of the screen, so the tilt and the z displacement
    are both zero exactly there — without the push, the card in the middle is
    the one thing that never changes size, and the cards around it only appear
    to widen because they moved relative to it.
  - A card is never turned past just under 90°. Beyond that it faces away and
    is culled, so it would blink out while still well inside the screen. The
    bound is applied by shortening the distance the bend is measured over, so z
    and the tilt cannot disagree about where a card is.
  - The bend stops growing past a screen's worth of distance. Unbounded, a card
    far enough up the stack swings round the cylinder and comes back towards
    the camera, in front of the cards being read.
- **A smaller per-card bow rides on top of it.** The vertex shader displaces
  each vertex by `sin(uv.x · π) × uBulge`, so a card's own centre leads and its
  edges trail. Two things about it are easy to get wrong and were both wrong
  once:
  - It is travel per **60Hz frame**, corrected by `gsap.ticker.deltaRatio(60)`,
    not per raw frame. Uncorrected, a 120Hz display moves half as far each
    frame and bows half as hard, which on most current phones reads as no bow
    at all. The easing is corrected the same way.
  - It is a fraction of the card's **width**, not its height, because the arc
    spans the card side to side. Tied to the height, shortening the card
    flattens the curve — halving the image panel cost a third of the bow with
    nothing about the motion having changed.
- **The cards are textures, not markup.** Name, image and skill marks are
  composed into a 2D canvas per card. Two shapes exist because one aspect
  cannot serve both a phone and a desktop; crossing 640px rebuilds them.
- **It must stand down when hidden.** Neither view is unmounted, so the stack
  reads `useActiveProjectsView()` and skips both the render loop and the scroll
  lock while the grid is showing. Do not infer this from a measurement.
- **The cards cannot be links.** A tap is resolved against the meshes' own
  positions, and a pointer that moved more than 8px is treated as a flick.

Under reduced motion the easing resolves immediately and the bow is pinned to
zero; the cards still move and are still tappable.

### Experience

Each experience row scales toward `1` near viewport focus, then returns to its resting scale. Desktop and mobile use separate media-query configurations because desktop cards share a row while mobile cards stack vertically.

The SVG curve reads the rendered dot positions. On mobile, dot and curve coordinates are anchored to the gap between the details and Highlights cards rather than the combined row center.

### Skills

Each row has one infinite GSAP tween. An IntersectionObserver pauses rows outside the viewport. Lenis velocity temporarily increases marquee speed and reverses direction when scroll direction changes.

### Stars

The star canvas is normally static. At controlled intervals—or after a user selects a nearby star—a star blinks and becomes a shooting star. Active stars are capped to protect frame time.

## Reduced motion

When `prefers-reduced-motion: reduce` is active:

- Lenis smooth-wheel behavior is disabled.
- Hero typing resolves to readable final content.
- About scroll animation resolves to readable content.
- Optional project scroll effects are reduced or skipped.
- Experience scaling and skill marquee motion are disabled.
- Black-hole video and shooting-star animation are paused.
- Global CSS reduces transition and animation duration.

*Never hide content as part of a reduced-motion fallback.*

## Adding an animation safely

1. Scope selectors with `gsap.context()`.
2. Use `gsap.matchMedia()` for materially different mobile geometry.
3. Add `invalidateOnRefresh` when values depend on viewport dimensions.
4. Kill tweens, observers, listeners, and timers during cleanup.
5. Avoid multiple systems writing to the same `transform` property.
6. Verify mouse wheel, trackpad, keyboard, touch, resize, and route return behavior.
7. Run `npm run lint` and `npm run build`.

## Performance checklist

- Prefer transforms and opacity.
- Pause infinite animation outside the viewport.
- Avoid React state updates inside animation frames.
- Cap device pixel ratio and particle counts for canvas work.
- Do not call `ScrollTrigger.refresh()` continuously.
- Confirm that mobile browser address-bar resizing does not rebuild expensive scenes unnecessarily.
