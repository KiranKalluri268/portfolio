# Responsive desktop composition plan

## Status

Implemented on `fix/responsive-desktop-composition` on 2026-08-17.

The implementation kept the work evidence-based rather than applying a global
resize: Projects now shares one tested geometry contract, short desktop Hero
layouts retain their calls to action, and non-Projects scenes use compact
vertical navigation controls so disabled horizontal controls cannot cover
content. The remaining homepage sections were visually audited and did not
need sizing changes.

The 1920x1080 layout at 100% Windows display scaling is the visual reference.
The implementation must preserve its hierarchy and balance across desktop
viewports without attempting to detect or cancel operating-system scaling,
browser zoom, accessibility magnification, or device pixel ratio.

## Problem

Windows display scaling changes the number of CSS pixels available to the
browser. A 1920x1080 display at 125% scaling commonly exposes a viewport near
1536x864, so fixed sizes and independent viewport-based positions occupy a
larger share of the page. The result is not merely a smaller copy of the
reference composition: headings, WebGL cards, fixed navigation, descriptions,
and progress controls can move toward one another or compete for space.

A global `scale(0.8)`, CSS `zoom`, inverse `devicePixelRatio`, or blanket 20%
reduction is explicitly out of scope. Those approaches would make the site too
small at 100%, conflict with breakpoints and hit testing, and override scaling
chosen for readability.

## Desired outcome

Across supported desktop viewports, the site should retain the character of
the 1920x1080 reference:

- the same content hierarchy and reading order;
- comparable proportions between headings, cards, copy, and controls;
- deliberate negative space rather than compressed or overlapping layers;
- no collisions with the fixed header or navigation controls;
- readable text and usable pointer targets at the user's chosen scaling;
- unchanged native scrolling, GSAP ownership, and carousel interaction.

Exact physical size and identical pixel coordinates are not goals. The
guarantee is compositional consistency inside the CSS viewport.

## Reference viewports

All implementation and review work must cover these CSS viewport sizes:

| Viewport | Purpose |
| --- | --- |
| 1920x1080 | Primary visual reference |
| 1536x864 | Typical 1920x1080 display at 125% scaling |
| 1366x768 | Common short laptop viewport |
| 1280x720 | Constrained supported desktop |
| 2560x1440 | Large desktop and upper-bound behavior |

Also retain the existing 390x844 phone regression coverage. Desktop work must
not silently alter the mobile composition.

## Implementation principles

1. **Available space drives layout.** Use the CSS viewport and rendered bounds,
   not laptop inches, operating-system settings, or device pixel ratio.
2. **Preferences are fluid; boundaries are measured.** Proportional positions
   may express the preferred composition, while measured fixed UI establishes
   hard collision limits.
3. **Scale components selectively.** Adjust the element causing imbalance,
   rather than shrinking the application root.
4. **Width and height both matter.** Desktop breakpoints based only on width
   cannot distinguish 1920x1080 from a short 1366x768 layout.
5. **One system owns each transform.** The Projects pin and title remain in the
   existing GSAP/ScrollTrigger timeline. No competing CSS animation, scroll
   controller, or root transform may be introduced.
6. **DOM and WebGL geometry stay aligned.** A card movement must carry its hit
   testing and related DOM overlay with it.
7. **Accessibility sizes have floors.** Fluid text and controls may shrink only
   to reviewed minimums; interactive targets must remain usable.

## Phase 1: capture the reference composition

Before changing sizing rules, capture the current intended state at 1920x1080
and 100% browser zoom.

For each primary homepage section:

- take a screenshot at its representative settled state;
- record the bounding rectangles of its heading, primary content, fixed header,
  scene indicator, navigation controls, hint, and section-local controls;
- record meaningful gaps as both pixels and viewport proportions;
- note which values express design intent and which merely happen to be current
  implementation constants.

For Projects, capture at minimum:

- the title after its first timeline movement;
- one project card settled in the centre;
- its summary and external-link controls;
- the progress rail;
- the fixed header and navigation controls.

The measurements should identify relationships such as "card begins below the
heading" and "summary ends above the progress rail," not freeze every edge to
an absolute coordinate.

## Phase 2: audit desktop sizing and positioning

Inventory desktop-facing values in the homepage and shared fixed controls:

- fixed pixel/rem font sizes;
- `vw`, `vh`, `dvh`, `svh`, and percentage positions;
- absolute and fixed offsets;
- WebGL card width caps and viewport ratios;
- section-specific top, overlay, and control bands;
- Tailwind width-only breakpoints that also need height-aware behavior;
- duplicated header-height assumptions.

Classify each value as one of:

- **fixed floor:** must not become smaller;
- **fixed ceiling:** must not become larger;
- **fluid preference:** should interpolate with available space;
- **measured boundary:** must come from rendered neighboring UI;
- **intentional constant:** should remain unchanged.

Do not broaden this phase into redesigning mobile, project listing views, or
unrelated known issues.

## Phase 3: establish shared desktop layout constraints

Create a small set of named constraints instead of scattered corrective magic
numbers. Use CSS custom properties for values consumed by CSS and DOM layout;
use measured TypeScript geometry only where WebGL or GSAP needs the result.

Candidate constraints include:

- header bottom plus a minimum content gap;
- section horizontal gutter with a minimum and maximum;
- heading size and line-height range;
- lower navigation/control safe area;
- short-desktop height threshold where vertical constraints become dominant.

Prefer formulas such as:

```css
font-size: clamp(var(--minimum), var(--fluid), var(--maximum));
padding-inline: clamp(var(--minimum), var(--fluid), var(--maximum));
```

For collision-sensitive animated content, compute:

```text
final position = max(preferred proportional position, measured safe boundary)
```

Do not create a site-wide scaling wrapper.

## Phase 4: normalize the Projects composition

Projects is the first implementation target because it combines the fixed
header, GSAP title movement, WebGL cards, DOM overlays, and bottom navigation.

### Title

- Keep the existing GSAP timeline as transform owner.
- Retain the preferred reference position when the viewport has room.
- Clamp its final top edge below the rendered header with a reviewed gap.
- Recalculate through the existing `invalidateOnRefresh` behavior on resize.

### Card row

- Treat the area between the heading band and progress/navigation band as the
  card region.
- Derive card width from all three constraints:
  - a fluid fraction of viewport width;
  - a reviewed maximum matching the reference composition;
  - the width implied by available vertical height and card aspect ratio.
- Keep a reviewed minimum only when it still fits; never use a minimum that
  forces overlap on a short viewport.
- Recalculate row centre, plane size, hit testing, spacing, and travel from the
  same geometry.

Conceptually:

```text
available height = viewport height - heading band - overlay band - rail band
height-limited width = available height / card aspect ratio
card width = min(fluid width, maximum width, height-limited width)
```

### Summary and links

- Keep them in the DOM for accessibility.
- Preserve their alignment with the centred WebGL card.
- Give the copy band enough room for the current longest homepage summary at
  every reference viewport.
- Ensure external-link buttons remain above the progress rail and navigation
  controls.

### Progress and global controls

- Keep the progress rail's bottom placement stable unless measurements show a
  collision.
- Verify the scene indicator, directional controls, navigation hint, audio
  control, and menu independently; they are fixed layers outside the card
  geometry.

## Phase 5: apply the same method to other homepage sections

After Projects passes review, audit Hero, About, Experience, Skills, and Contact
one at a time.

For each section:

1. compare it with the 1920x1080 reference;
2. identify the specific element that changes the balance;
3. replace only that element's brittle sizing or positioning rule;
4. verify fixed controls and adjacent sections;
5. preserve mobile behavior unless a demonstrated regression requires a
   separately reviewed mobile change.

Do not apply a mechanical 20% rewrite across Tailwind classes or constants.

## Phase 6: automated regression coverage

Extend Playwright coverage because jsdom cannot validate layout, WebGL paint,
fixed layers, or ScrollTrigger pin geometry.

At all five desktop viewports, assert measurable relationships rather than
exact screenshots alone:

- Projects heading is below the fixed header by at least the agreed gap;
- project card region begins below the heading region;
- card region ends above the summary/link region;
- summary/link region ends above the progress rail;
- fixed navigation controls do not intersect primary content or local controls;
- no nested or document-level horizontal overflow appears;
- important controls remain inside the viewport and receive pointer hits.

Where WebGL content has no DOM bounding box, expose the renderer's calculated
layout as stable data attributes/CSS custom properties on its container, or
extract a pure geometry function and test that function alongside browser
screenshots. Do not infer WebGL placement from unrelated DOM elements.

Keep screenshot snapshots focused. Geometry assertions should carry the hard
guarantees; screenshots should catch visual changes that measurements cannot
describe.

## Phase 7: visual and interaction verification

Run the site as a production build and inspect every reference viewport in a
real Chromium browser.

For Projects, verify:

- initial title panel;
- title-to-first-card transition;
- a centred card at rest;
- fast wheel/trackpad movement and settling;
- description and links following the selected card;
- first and last panels;
- keyboard navigation;
- resize between reference viewport sizes;
- reduced-motion behavior;
- route navigation into a project and back;
- phone swipe behavior remains unchanged.

Use Windows 125% scaling for a real-device check, but use DevTools or Playwright
to set exact CSS viewports. Repeat the primary 1920x1080 reference at 100% when
that setup is available before final visual approval.

## Verification commands

```powershell
npm run lint
npm run test
npm run build
```

On this Windows laptop, use the installed Chrome for browser tests:

```powershell
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE='C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run test:e2e
```

The existing unrelated `@next/next/no-img-element` warning in
`src/app/opengraph-image.tsx` is not part of this work. New warnings or errors
are not acceptable.

## Acceptance criteria

The work is complete only when:

- 1920x1080 retains the approved 100%-scaling reference composition;
- all five desktop viewports preserve comparable hierarchy and spacing;
- no important elements overlap at any tested viewport;
- no global inverse scaling, CSS zoom, or device-pixel-ratio compensation is
  present;
- headings and body text remain readable without defeating user scaling;
- buttons and navigation remain reachable and correctly hit-tested;
- Projects scrolling, easing, bending, swipe, and navigation behavior remain
  unchanged except for responsive geometry;
- mobile layout and interaction regressions are absent;
- lint, unit tests, production build, and browser tests pass;
- final screenshots are reviewed at every reference viewport.

## Rollout and review

Implement this as focused commits, preferably one section or shared constraint
per commit. Review Projects before applying the method elsewhere; its approved
geometry becomes the pattern, not an assumption imposed on every section.

Do not combine this work with unrelated redesigns, content edits, the known
Projects-grid warp issue, middleware migration, or header architecture cleanup.
If the audit shows that consolidating the currently duplicated header-height
assumptions is required, propose that as an explicit prerequisite or separate
commit before expanding scope.
