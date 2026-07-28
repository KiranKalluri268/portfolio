# Architecture

## Overview

The portfolio is a Next.js App Router application. All primary homepage sections remain mounted in semantic document order:

```text
Hero → About → Projects (horizontal pin) → Experience → Skills → Contact
```

Native document scrolling remains the source of truth. Lenis smooths that scroll, while GSAP `ScrollTrigger` derives animation progress from it. No global wheel handler replaces normal browser scrolling.

## Root composition

`src/app/layout.tsx` provides the global fonts, metadata, JSON-LD, smooth-scroll provider, audio provider, star background, and black-hole media. Page content is rendered above those fixed decorative layers.

`src/app/page.tsx` renders:

1. Entry/loading overlay
2. Skip links
3. Fixed navbar and navigation controls
4. Six semantic portfolio sections inside `<main>`

`SceneWrapper` is a lightweight layout wrapper. It does not mount/unmount sections or manage navigation state.

## Scrolling and navigation

`SmoothScrollContext` owns one Lenis instance and exposes a small command API:

- `scrollToSection(section)`
- `scrollNext()`
- `scrollPrev()`
- `toggleProjectsEndpoint()`

Lenis is advanced through the GSAP ticker. Each Lenis scroll update refreshes `ScrollTrigger` and detects which section contains the viewport center. `SceneIndicator` and `NavigationControls` consume that active section instead of maintaining competing navigation state.

The scene indicator is portaled to `document.body`, keeping mobile controls above pinned or transformed content. It remains hidden until the entry overlay is dismissed.

## Projects pin

`src/components/projects.tsx` creates one GSAP timeline with a pinned `ScrollTrigger`. Vertical scroll progress translates a wide horizontal track containing:

- Projects title panel
- Project cards
- “See all projects” panel

Natural vertical scrolling drives the pinned timeline continuously; there is no separate snap controller. Arrow buttons, arrow/WASD keys, and section-to-section movement all use the shared Lenis API.

## Background layers

`StarsBackground` owns one fixed canvas. It creates a deterministic density of stars for the viewport, pauses when appropriate, and allows a limited number of stars to enter a blinking/shooting lifecycle.

`BlackholeEffect` renders a transparent video with two sources:

- QuickTime (`.mov`) for Safari-compatible alpha video
- WebM for other capable browsers

The video pauses when the tab is hidden, before entry, or when reduced motion is requested.

`SpaceBackground.tsx` is retained as an intentional reference/alternative implementation but is not part of the active page composition.

## Entry and audio lifecycle

`LoadingScreen` prepares fonts, the first black-hole frame, and portfolio audio. It locks scrolling and makes the portfolio inert until the user activates Enter. The interaction allows browsers to start audio without violating autoplay restrictions.

`AudioContextProvider` owns entry state and soundtrack playback. It pauses audio when the document becomes hidden and preserves the provider across application routes so navigation to `/resume` or `/projects` does not recreate playback state.

## Content and data

- `src/data/about.json` controls About copy and emphasis.
- `src/data/resume.json` is the single source for both résumé HTML and PDF output.
- `src/data/projects/*.json` supplies the homepage carousel, `/projects`, and statically generated project detail routes.
- `src/data/skills/*.json` supplies the skill marquee, `/skills`, and statically generated skill detail routes.
- `src/lib/content` discovers, validates, sorts, and relates project and skill content on the server.
- Homepage experience data currently lives in `ExperienceTimeline.tsx`.

The `/resume` route renders accessible HTML. `DownloadResumeButton` dynamically imports `@react-pdf/renderer`, keeping PDF generation code out of the initial homepage bundle.

## Contact flow

The Contact component validates required fields in the browser, then posts JSON to `/api/contact`. The Node.js route handler:

1. Applies an in-memory IP-based request limit
2. Parses and validates field types and lengths
3. Reads server-only Resend configuration
4. Sends a plain-text email through the Resend REST API
5. Returns truthful success or error responses

*The in-memory limiter is best-effort and instance-local. A distributed store is required if strict global rate limiting becomes necessary.*

## Metadata

The root layout defines canonical metadata, Open Graph data, Twitter card data, and Person JSON-LD. Next.js metadata routes generate the sitemap, robots file, and social image. `/projects` provides route-specific canonical and sharing metadata.
