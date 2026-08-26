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

## Two presentations, one set of facts

The portfolio is served two ways. `/` is the plain presentation described above. `/cinematic` is the same portfolio read from a camera falling toward a black hole, and it is a visitor's choice rather than a device's — see `CINEMATIC_DECISION.md` for why those two decisions are kept apart.

`src/proxy.ts` (Next 16's rename of `middleware`) decides which one a request gets, before any page renders, so `/` stays statically prerendered. It reads two cookies: `presentation` holds the choice and persists for a year; `journey-unavailable` is session-scoped and records that this device could not run the journey, which is what stops the scene's fallback to `still` from becoming a redirect loop back into it. `?presentation=` in the URL beats both. `src/lib/presentation.ts` holds the shared vocabulary; the client half that writes the cookies is `presentation-client.ts`.

Content never forks between the two. `src/data/**` is the single source, and every fact has to exist as real markup in both — a name painted into a WebGL texture is invisible to crawlers, screen readers, and anyone tabbing through. Layout, motion and arrival are free to differ completely.

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
- `src/data/skill-web.json` defines the center identity, primary domains, subcategories, branch colors, and radial ordering for the interactive `/skills` universe.
- `src/data/experience/*.json` supplies the homepage Experience timeline, the statically generated `/experience/[slug]` routes, and the résumé's Internships section.
- `src/lib/content` discovers, validates, sorts, and relates project, skill, and experience content on the server.

### Interactive skill universe

The `/skills` server route loads and validates the hierarchy, then passes a
serializable graph to the client-side `SkillsWeb` component. The component
creates a deterministic radial layout with four levels:

1. `SAIKIRAN`
2. Primary domains
3. Subcategories
4. Linked skill pages

The viewport owns only local interaction state. Wheel and pinch gestures zoom
around the interaction point; pointer dragging pans the plane. Domain and
subcategory buttons focus their branches, while skill nodes navigate to the
existing `/skills/[slug]` pages. A list dialog exposes the same hierarchy
without spatial navigation. The pure layout module applies deterministic
rectangle-based collision resolution across leaves from every parent branch
and asserts that no skill node overlaps another rendered node.
### Experience

Each role in `src/data/experience` carries both the summary the homepage
timeline shows and a `workItems` array describing what was built during the
role. `ExperienceTimeline` receives roles as a server-supplied prop and links
every card to `/experience/[slug]`, where `ExperienceDetail` renders the work
items as a nested vertical timeline.

Work items may reference skill slugs and a project slug. `src/lib/content/relationships.ts`
validates those references at build time and resolves them, so a role links out
to the same `/skills/[slug]` and `/projects/[slug]` pages the rest of the site
uses. An unknown slug fails the build rather than rendering a dead link.

`showInTimeline` and `showInResume` are independent flags: a role can appear on
the homepage timeline without appearing in the résumé.

The `/resume` route renders accessible HTML and reads its Internships section from the same experience data, so role wording lives in one place. Because `@react-pdf/renderer` runs on the client, the résumé page passes a serializable `ResumeInternship[]` projection down to `DownloadResumeButton` and `ResumePdfDocument` rather than importing the server-only loader. `DownloadResumeButton` dynamically imports `@react-pdf/renderer`, keeping PDF generation code out of the initial homepage bundle.

## Deep linking

Most of the site is shareable because most of it is routes: a project, a skill,
a role, the résumé, the CV and the FAQ are all pages. What needed plumbing was
the state *inside* a page. `src/lib/deep-link.ts` owns it.

| URL | Restores |
| --- | --- |
| `/projects?view=grid\|list` | Which of the two project views is showing |
| `/skills?view=list` | The skill directory dialog, open over the web |
| `/faq?q=<id>` | One answer, open and scrolled to |
| `/?section=<id>` | A home page section, scrolled to on arrival |

Four rules hold across all of them:

- **Query parameters, not path segments.** `/projects/[slug]` and
  `/skills/[slug]` already own everything after their own name, so
  `/projects/list` would work only by shadowing a project slugged `list` —
  quietly, and for as long as that slug existed.
- **A link outranks a remembered preference.** `/projects` also stores the last
  view in `localStorage`. If storage won, sending someone the grid would open
  the list for anyone who had ever chosen it, which is the thing the link was
  sent to prevent.
- **Written with `history.replaceState`, never the router.** The router
  re-renders the route, which on these pages means tearing through a WebGL
  scene's React tree for a change the scene does not care about. Replacing
  rather than pushing keeps the back button leaving the page instead of walking
  back through every view the visitor tried.
- **A value the screen cannot render is ignored.** Stale and hand-edited links
  fall back to the default rather than putting a page into a state it has no
  rendering for.

Two of these need to wait rather than act on arrival, and both were wrong first:

- **The home page cannot use a `#fragment`.** The browser acts on one as soon as
  the document is ready, which here is while the entry screen is up and the page
  is held still — the scroll is swallowed and never retried. A parameter is
  inert, which lets the wait be deliberate. `SectionLink` then waits for the
  lock itself to lift rather than for `hasEntered`, because entering and being
  released are not the same moment: the entry screen flips the flag first and
  holds the page until its exit animation ends, and a stopped Lenis ignores
  `scrollTo` outright.
- **The FAQ waits for Lenis.** It is published a render after it is built, and
  scrolling before then falls back to `scrollIntoView`, which knows nothing
  about the fixed header and leaves the question underneath it.

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
