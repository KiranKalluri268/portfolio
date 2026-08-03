# Working notes

How to work on this repo. `docs/` covers what the code is; this covers how to
change it.

## Branches and commits

- **Never put `claude` in a branch name.** Use a conventional prefix that says
  what the work is: `feat/`, `fix/`, `design/`, `style/`, `docs/`.
- **One commit per meaningful change**, not one commit at the end. A branch that
  fixes three things should read as three commits.
- Write the commit message about the problem, not the patch. What was wrong,
  why it was wrong, and what the fix rests on. If a number was measured, put the
  number in.
- A merged pull request is finished. Follow-up work starts a new branch from the
  updated default branch — never more commits on the merged one.

## Writing for the site

Everything a visitor reads is Saikiran speaking to them. Not the system
narrating, not a developer explaining the implementation.

- Empty states, hints, tooltips, error copy: all of it is his voice. "I haven't
  published a project using this yet" — not "No projects found".
- Never leak the machinery. Copy like "Project connections can be added through
  the project JSON files" is addressed to the wrong person.
- **Never invent work history, metrics, or outcomes.** No made-up percentages,
  user counts, or performance numbers. If a claim is not already in the content
  files or supplied directly, it does not go on the site.
- **Never publish employer-internal architecture.** Auth topology, vendor names,
  load-balancer and target-group layout, internal role checks. Describe what was
  built in terms a reader outside the company can follow, and keep the interior
  detail out.

## Verifying

Assume nothing renders the way it reads.

- Check UI work in a real browser, at a real viewport, with a screenshot.
  Chromium is at `/opt/pw-browsers/chromium` — pass it as `executablePath`. Do
  not run `playwright install`.
- Touch behaviour needs real touch input. Playwright's `hasTouch` plus CDP
  `Input.dispatchTouchEvent` produce genuine touch events; synthetic
  `dispatchEvent` does not, and will pass while the real thing is broken.
  A synthetic swipe is also perfectly straight, which real fingers never are —
  several bugs here only appear with a pixel or two of drift.
- Check PDF work by rendering the PDF and reading it back (`pdftotext`,
  `pdftoppm`), not by trusting the component tree.
- Measure regressions rather than describing them. "440px of glide, was 0" is
  worth more than "momentum feels better now".

## Traps that have already cost time

- **Scroll has one owner.** Vertical scroll position drives the pinned projects
  carousel through ScrollTrigger; nothing else may transform the track or hold a
  second source of truth. See `docs/ANIMATIONS.md`.
- **Lenis stops animations on touch.** With `syncTouch` off it treats every
  touch as native scrolling and calls `animate.stop()`, which kills any
  programmatic scroll in flight. The carousel marks events it has claimed with
  `lenisStopPropagation` — an internal Lenis flag, so re-test swipe momentum on
  a real touch device after any Lenis upgrade. No unit test covers it.
- **`jsdom` is pinned to 26.x.** jsdom 30 needs Node ≥22.22 and CI runs Node 20;
  its bundled undici calls an API that does not exist there and takes the Vitest
  worker down with it.
- **jsdom has no `matchMedia`.** It is stubbed in `vitest.setup.mts`. Any
  component asking about pointer type or reduced motion needs it.
- **react-pdf drops `fixed` children if `<Page>` has a `lineHeight`.** Page
  numbers vanish silently. There is a test asserting the style has none.
- **SVG filters need `filterUnits="userSpaceOnUse"`** when the element may have
  a zero-width or zero-height bounding box — a vertical line collapses the
  filter region and the stroke disappears.
- **Icons cannot live in JSON.** Skill brand marks are components, so they map
  from slug in `src/components/skills/skill-icons.tsx`. Content files own
  everything a skill *says*; the map owns the logo. Both the marquee and the
  skill page render through the same `SkillMark` so they cannot drift.

## Content

Content lives in `src/data/**` as JSON and is read through `server-only`
modules in `src/lib/content/`. Add a project, skill or role by adding its file —
the CV picks everything up automatically, while the résumé stays curated
through `showInResume` flags. Prefer changing content over changing components.
