# Working notes

How to work on this repo. `docs/` covers what the code is; this covers how to
change it.

## Check what else a change touches

A change is not done when the thing asked for works. It is done when you know
what else moved, and whether that was wanted.

Before calling anything finished, ask what else reads the code, the token, the
class, the file you just edited — then go and look at it. Grep for the other
callers. Open the other route. Compare desktop and mobile, not just the one you
were asked about. If a change is mechanical, check what else the pattern
matched: a find-and-replace edits everything it matches, not everything you
meant.

Then say what moved. If a change reaches something outside the request, name it
in the reply and in the commit message, whether it turned out well or badly.
Nothing should be discovered by the person who asked, in a screenshot, after
the fact.

Real examples from this repo, all of them found late:

- A `sed` meant for the résumé sheet's width also matched the toolbar above it,
  widening it to 794px. It overflowed the phone screen, pushed the download
  button out of view, and made the page drag sideways.
- Restoring the marquee's brand icons left the skill's own page still showing
  initials, because both rendered the mark separately.
- Making one tooltip position itself from the pointer put a layout read on
  every mouse move across the whole page, on three mounted tooltips at once.
- Fixing the stuck label on the scene dots left the same bug in the audio
  toggle, the social icons, and the arrow pad.

Verifying the change you made is not the same as verifying the change you
caused. Prove the second one too — and prove it on the thing that actually
governs the behaviour. A sideways-scroll check measured the document's scroll
width and passed, while the overflow sat inside `.page`, which is its own
scroll container.

## Ask instead of deciding

When a choice would change what a visitor sees, what ships, or what the request
covered, it is not yours to make. Ask.

Ask when:

- there is more than one reasonable reading of the request;
- the fix could be narrow or broad, and the broad one touches things nobody
  asked about;
- something else is found broken along the way — report it, do not quietly fix
  it, and do not quietly leave it either;
- a trade-off has to be struck between two things that are both wanted;
- the tidy version of the change and the asked-for version are not the same
  change.

Carrying out the work asked for does not need a question at every step. Picking
a variable name, choosing which file a helper lives in, deciding how to measure
something — get on with it. The line is whether the outcome changes for the
person who asked. If it does, ask first; a question costs a minute, and an
assumption costs a review cycle and their trust in the rest of the diff.

When you do ask, ask with the options laid out and a recommendation, not an
open-ended "what would you like?". State the trade-off you see and which way
you would go.

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
