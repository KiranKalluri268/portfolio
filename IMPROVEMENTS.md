# Portfolio Improvements Backlog

This document records the recommended improvements in priority order. The ordering is based on user impact, correctness, accessibility, and risk.

## Priority 0 — Critical fixes

### ~~1. Remove the audio gate from the entire portfolio~~ — Completed

**Problem:** The main portfolio is rendered only when `audioEnabled` is true. If a visitor does not enable audio, the actual site is hidden.

**Required change:** Always render the portfolio. Treat audio as an optional enhancement controlled by the audio toggle.

**Expected result:** The site remains usable without sound, autoplay permission, or interaction with the loading screen.

**Relevant areas:** `src/app/page.tsx`, `src/components/LoadingScreen.tsx`, `src/context/AudioContextProvider.tsx`.

### ~~2. Make the contact form functional or remove the success claim~~ — Completed

**Problem:** The contact form clears its fields and displays a success message without sending data anywhere.

**Required change:** Connect the form to a real API/email provider/server action, including loading, success, and failure states. If no backend is available, replace the form with a working `mailto:` or external contact link.

**Expected result:** Visitors can reliably contact the owner and receive truthful feedback.

**Relevant area:** `src/components/Contact.tsx`.

### ~~3. Restore keyboard focus visibility~~ — Completed

**Problem:** Global CSS removes all focus outlines and box shadows, making keyboard navigation inaccessible.

**Required change:** Delete the global focus removal rule. Add a consistent `:focus-visible` style with sufficient contrast and preserve component-specific focus rings.

**Expected result:** Keyboard users can see which control is active.

**Relevant area:** `src/app/globals.css`.

### ~~4. Add complete reduced-motion support~~ — Completed

**Problem:** The site continuously animates text, transitions, particles, canvases, and video without respecting motion preferences.

**Required change:** Detect `prefers-reduced-motion: reduce`; disable or substantially simplify scene transitions, typing effects, particle movement, looping video, and decorative animations.

**Expected result:** The site is comfortable and safe for users sensitive to motion, while preserving the content and navigation.

**Relevant areas:** global CSS, `Hero`, `SceneWrapper`, background components, carousel components.

### ~~5. Make interactive controls semantic and keyboard usable~~ — Completed

**Problem:** Some controls use `div` elements with `role="button"`, synthetic keyboard events, or mouse-only behavior.

**Required change:** Use native `<button>` and `<a>` elements. Add Enter/Space behavior only where a custom control is unavoidable. Ensure every interactive element has an accessible name and usable focus state.

**Expected result:** Reliable keyboard, screen-reader, touch, and browser behavior.

**Relevant areas:** `src/components/hero.tsx`, navigation controls, scene indicators, tooltips, carousel controls.

## Priority 1 — Major usability and architecture improvements

### ~~6. Keep all important portfolio content in the semantic document~~ — Completed

**Problem:** Only the current scene is mounted. Search engines, assistive technology, browser find, text selection, and no-JavaScript users cannot reliably access all sections.

**Required change:** Render all major sections in the document with semantic headings and landmarks. Use animation and scene navigation as progressive enhancement, not as the only way to access content.

**Expected result:** Better SEO, accessibility, resilience, printing, deep linking, and content discoverability.

**Relevant areas:** `src/app/page.tsx`, scene components, navigation manager.

### ~~7. Simplify navigation state management~~ — Completed

**Problem:** Several contexts and global event listeners overlap: `UnifiedScrollManager`, `ScrollManager`, `ScrollManagerContext`, `GlobalContext`, and project view state.

**Required change:** Consolidate navigation into one state machine/reducer or one navigation context. Define clear responsibilities for scene state, carousel state, transition locking, and input handling.

**Expected result:** Fewer race conditions, easier debugging, and simpler future changes.

**Relevant areas:** `src/context/*`, `SceneWrapper`, `ProjectsSection`.

### ~~8. Protect form and text inputs from global keyboard shortcuts~~ — Completed

**Problem:** Global handling of Arrow keys, `W`, and `S` can interfere with typing, cursor movement, and scrolling inside form controls.

**Required change:** Ignore navigation shortcuts when the event target is an input, textarea, select, button, link, contenteditable element, or an element inside a dialog.

**Expected result:** Form fields and normal browser interaction work as expected.

**Relevant area:** `src/context/UnifiedScrollManager.tsx`.

### ~~9. Reduce background rendering cost~~ — Completed

**Problem:** Multiple full-screen canvas animation loops and a looping video run continuously, including when they are not necessary.

**Required change:** Pause loops when the tab is hidden, reduce frame rate and particle count on mobile, use static fallbacks, avoid redraws for static effects, and consider consolidating canvas layers.

**Expected result:** Better battery life, lower CPU/GPU usage, fewer dropped frames, and improved mobile performance.

**Relevant areas:** `StarfieldBackground`, `CometsInBackground`, `BlackholeEffect`, video background.

### ~~10. Fix linting and enforce quality checks~~ — Completed

**Problem:** `npm run lint` is broken because it calls the removed `next lint` command. Direct ESLint currently reports five unused-variable errors.

**Required change:** Update the script to invoke ESLint directly, align the ESLint configuration with the installed Next.js version, and fix all reported errors.

**Expected result:** Linting works locally and can be enforced in CI.

**Known errors:**

- Unused `definition` in `SceneWrapper.tsx`
- Unused `delayBetweenLines` in `hero.tsx`
- Unused `isForward` in `hero.tsx`
- Unused `TRANSITION_DURATION` in `UnifiedScrollManager.tsx`
- Unused `SCENE_DISPLAY_TIME` in `UnifiedScrollManager.tsx`

### ~~11. Align and audit dependencies~~ — Completed

**Problem:** `next` is version 16 while `eslint-config-next` is version 15. Some dependencies may be unused or accidental (`lib`, `util`, and potentially others).

**Required change:** Align Next.js-related package versions, remove unused dependencies, run a clean install, and verify the lockfile.

**Expected result:** More predictable builds, fewer compatibility problems, and a smaller dependency surface.

**Relevant area:** `package.json` and `package-lock.json`.

### ~~12. Fix deployment configuration~~ — Completed

**Problem:** The GitHub Pages workflow uploads `./out`, but Next.js is not configured with static export output. SEO URLs also point to Vercel.

**Required change:** Choose one deployment target. For GitHub Pages, configure static export and verify asset/base-path behavior. For Vercel, remove or replace the Pages workflow.

**Expected result:** Deployment is deterministic and matches the declared canonical domain.

**Relevant areas:** `next.config.ts`, `.github/workflows/nextjs.yml`, metadata, sitemap, robots.

## Priority 2 — SEO, content, and hiring effectiveness

### ~~13. Improve metadata and social sharing~~ — Completed

Add `metadataBase`, canonical URL, Open Graph metadata, Twitter card metadata, and a properly designed social preview image. Shorten and clarify the page title.

Also change JSON-LD from `http://schema.org` to `https://schema.org`.

**Relevant areas:** `src/app/layout.tsx`, `src/app/sitemap.ts`, `src/app/robots.ts`, `public/images`.

### ~~14. Fix heading hierarchy and semantic landmarks~~ — Completed

Use one page-level `<h1>`. Change the navbar logo heading to a non-heading element if appropriate. Ensure every section has a visible heading, and use `header`, `nav`, `main`, `section`, and `footer` consistently.

### 15. Improve project information and links — In progress

The shared project dataset and `/projects` case-study page are implemented. Content accuracy, available links, and real-device visual QA remain under review.

Give every project its own repository link where available, add live demos where available, and explain:

- The problem solved
- The owner's contribution
- Key technical decisions
- Measurable result or impact
- Main lessons learned

Avoid linking projects only to the general GitHub profile.

### 16. Add a clear résumé and hiring call to action

Add a downloadable résumé, current availability, preferred role, location/time zone, and one prominent contact action. Keep social links as secondary actions.

### ~~17. Correct copy and encoding issues~~ — Completed

Fix grammar, punctuation, capitalization, and corrupted characters such as `Â©` and `â†’`.

Examples include:

- “AI Enthusiastic” → “AI enthusiast”
- “a AI-powered” → “an AI-powered”
- Add spacing around separators in the title
- Use consistent technology naming: Node.js, GitHub, Java, AWS, etc.

### ~~18. Replace invalid machine-readable dates~~ — Completed

Use valid `dateTime` values such as `2026-01` or separate start/end dates instead of strings like `January 2026 - Present` in the `dateTime` attribute.

## Priority 3 — Maintainability and polish

### ~~19. Remove duplicate font loading~~ — Completed

Fonts are loaded using both `next/font/google` and a Google Fonts CSS import. Keep the Next.js font integration and remove the duplicate import.

### ~~20. Replace the default README~~ — Completed

Document the actual project, including:

- Purpose and feature overview
- Local setup
- Environment variables
- Available scripts
- Deployment instructions
- Contact form configuration
- Accessibility and reduced-motion behavior

### 21. Add automated tests and CI checks — In progress

**Done:** Vitest is wired up with a Node environment by default and an opt-in jsdom environment for component tests. Coverage now includes content validation/sorting/relationships (`src/lib/content`), the skill-web radial layout and its collision-free guarantee (`src/components/skills/skill-web-layout.ts`), contact API validation/rate limiting/Resend delivery (`src/app/api/contact/route.ts`), and the contact form's client-side validation and submit/success/error states (`src/components/Contact.tsx`). GitHub Actions now runs `npm run lint`, `npm run test`, and `npm run build` on every push and pull request to `main`.

**Still missing:**

- Scene/section navigation boundaries (Lenis + `SmoothScrollContext`)
- Projects carousel boundaries
- Keyboard navigation
- Audio-disabled rendering
- Accessibility/performance checks in CI

### ~~22. Remove unused code and legacy context paths~~ — Completed (`SpaceBackground.tsx` intentionally retained)

After navigation consolidation, remove unused contexts, commented-out audio code, unused constants, unused props, and stale implementation notes.

### ~~23. Improve mobile layout and touch discoverability~~ — Completed (real-device QA recommended)

Test small phones, landscape orientation, browser zoom, reduced viewport heights, and touch scrolling. Avoid relying only on “scroll down” text and hidden scene controls.

### 24. Add observability for real-world failures

Add error reporting or at least structured client-side logging for failed form submissions, media load failures, and navigation exceptions. Do not expose sensitive user data in logs.

## Suggested implementation sequence

1. Remove the audio content gate.
2. Fix contact submission behavior.
3. Restore focus styles and semantic controls.
4. Add reduced-motion support.
5. Fix keyboard/input event interference.
6. Repair linting and dependency version alignment.
7. Decide between Vercel and GitHub Pages and fix deployment.
8. Simplify navigation and render semantic sections.
9. Optimize background animation and mobile performance.
10. Improve SEO metadata, project content, résumé CTA, copy, tests, and documentation.
