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

Tektur is used below the medium breakpoint; Foldit is used on larger screens. Cursor color follows the active text color.

### About

One pinned ScrollTrigger maps scroll progress to word readability. Previously read lines gradually dim as the next line progresses. The résumé link is revealed near the end of the paragraph sequence.

### Projects

One scrubbed GSAP timeline translates the project track while pinning the section. Lenis keeps the underlying vertical scroll smooth without forcing the viewport to a panel after input settles. Do not add custom or CSS scroll snapping, or a second transform owner to the track.

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
