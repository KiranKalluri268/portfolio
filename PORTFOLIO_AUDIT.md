# Portfolio Audit — saikirankalluri.dev

## Follow-up — 2026-09-29

- **Entry gate:** Resolved. The loading screen now runs its reveal automatically when the first-frame visual assets are ready. Audio remains an explicit choice at the header control; same-session reloads skip the loader.
- **Scene navigation focus:** Resolved. The dot buttons have a visible keyboard focus ring.
- **Homepage project selection:** ResumeByAI and MindPlan are no longer in the homepage carousel. Four projects remain; CertiSafe and IPL Score Predictor have local images, ThirdEyeAI has a Cloudinary screenshot URL, and the portfolio still uses a monogram. Both removed projects remain on `/projects` and retain their case-study routes.
- **ThirdEyeAI screenshot:** A Cloudinary screenshot URL is configured; its visual content and delivery still need checking in a browser. The public demo reaches the login page, but on 2026-09-29 Chrome rejected the `/api/auth/me` request: the backend allowed `https://thirdeyeai.vercel.app` as its CORS origin instead of `https://thirdeyeai.saikirankalluri.dev`. The server configuration is a separate follow-up.
- **Project links:** The existing ThirdEyeAI, CertiSafe, portfolio, and linked GitHub URLs returned HTTP 200 on 2026-09-29. A response alone does not prove that a demo works beyond its landing page. ResumeByAI has a public, pinned GitHub repository but no `repositoryUrl` in its portfolio data. No public MindPlan repository was confirmed from the account's repository list.

The findings below are the original audit snapshot. Counts and implementation details there describe the site before these follow-up changes.

First 10 seconds: name, role ("MERN Developer"), and two CTAs are all visible immediately on the hero — that part works. But before any of that, every visitor (including repeat visitors) hits a full-screen "Enter" gate with a loading spinner and an audio prompt. That's the biggest issue on the site.

## Top 5 fixes, ranked by impact

1. **Remove or make the entry gate skippable** — it blocks content from every visitor, every visit. `src/components/LoadingScreen.tsx` sets `portfolio.inert = true` and `aria-hidden="true"` on the real content until the visitor clicks/presses Enter, and this replays on every page load — there's no localStorage/session persistence (`AudioContextProvider.tsx` resets `hasEntered` to `false` on every mount). A recruiter who bounces back to the tab, or opens the link a second time, sees the full loading screen again. This directly matches the skill's flagged anti-pattern ("click to enter" gate before content) and the copy itself ("Yeah kinda sucks, can't help but worth the wait") undercuts the professional impression rather than charmingly owning it. **Fix:** persist entry in sessionStorage so it only shows once per session, and make sure content is reachable/crawlable without the gate (it currently isn't — inert+aria-hidden blocks screen readers entirely until Enter is pressed).
2. **ThirdEyeAI — your strongest project** (94.25% accuracy hybrid model, RAG, WebRTC, `featured: true`) — has no screenshot. `src/data/projects/third-eye-ai.json` has no `image` field, so its homepage card renders as a plain "TH" text placeholder instead of the live app. This is exactly the "never a placeholder or just a logo" violation, and it's happening to the project you're leading with. **Fix:** add a real screenshot/GIF at `/images/` and wire it into `third-eye-ai.json` the same way `certisafe.json` and `ipl-score-predictor.json` do.
3. **ResumeByAI and MindPlan are shown on the homepage with no working links and no screenshot.** Both have `showInProjectsSection: true` but neither has `liveUrl`, `repositoryUrl`, nor `image` in their JSON — confirmed live at `/projects/resume-by-ai`, which renders title + description and nothing else (no Live Demo, no View Source button). A recruiter can't verify either project exists. **Fix:** either add real `liveUrl`/`repositoryUrl` + a screenshot, or set `showInProjectsSection: false` until they're demo-ready (per the skill: don't showcase an unfinished/unverifiable project as a headline item).
4. **No visible keyboard focus indicator on the scene-navigation dots.** `src/components/SceneIndicator.tsx:361` sets `outline-none` on the nav-dot buttons with no `focus-visible` replacement anywhere in the file (confirmed via grep — zero focus styles exist for this component). This is the primary way to jump between sections, and it's currently invisible to keyboard-only users, which fails WCAG 2.2 and is a bad look for a candidate interested in accessibility work.
5. **Curate the project count and unify screenshots.** 6 projects currently show on the homepage (already trimmed from 10 in the JSON — good instinct), but only 2 of the 6 (CertiSafe, IPL Score Predictor) have real screenshots; the other 4 render as two-letter placeholder cards. Recommend cutting to your best 4-5 with real images rather than filling the row with placeholder cards — a placeholder card reads worse than one fewer project.

## Everything else, by category

### Category 1 — First impression & structure
- PASS: real name, specific role/stack line, two CTAs above the fold ("View my work", "Get in touch")
- PASS: About section is specific and human ("I am a software engineer who enjoys turning complex problems into practical, scalable products...")
- PASS: Experience timeline has concrete, specific highlights (AWS ECS, GitHub Actions CI/CD, Razorpay, WebRTC) — not vague filler
- PASS: real email (kirankalluri888@gmail.com) and LinkedIn/GitHub in `resume.json`, not a generic address
- FIX: see #2, #3, #5 above (screenshots/placeholders, dead-link projects)
- Project detail pages (e.g. `/projects/portfolio`) are genuinely good — real "what/why/hardest decision" structure, working Live Demo + View Source buttons where data exists

### Category 2 — Performance
- FIX: see #1 (entry gate/loading screen delays real content — exactly the "splash enter-site gate" anti-pattern called out in the skill)
- Video/audio preload logic in `LoadingScreen.tsx` is reasonably careful (8s fallback timer, `document.fonts.ready`, minimum-delay smoothing) — the mechanism itself isn't sloppy, it's the product decision to gate content behind it that's the problem
- Did not get a Lighthouse/PageSpeed run in this session (browser viewport resize wasn't taking effect for on-device testing) — worth running manually before applying next.

### Category 3 — Accessibility
- FIX: see #4 (scene-dot focus indicator missing)
- PASS: most interactive elements do replace `outline-none` with a `focus:ring`/`focus-visible` treatment (`AudioToggle`, `Contact`, `FaqQuestionForm`, `ErrorBoundary`, `projects-grid .stage`)
- FIX: entry gate makes real content `inert`+`aria-hidden` until dismissed — screen reader users get only the gate, not a parallel accessible path, until they act on it
- `prefers-reduced-motion` is respected for the gate's canvas animation (skips the particle wind-up) but the gate itself, and its `aria-hidden` behavior, isn't bypassed — worth reconsidering whether reduced-motion users should skip the gate outright

### Category 4 — SEO & discoverability
- PASS across the board: custom domain, templated `<title>`, meta description, OpenGraph + Twitter Card with a real 1200×630 image, canonical URL, JSON-LD Person schema with name/jobTitle/social links, `robots.ts` and `sitemap.ts` present, Google Search Console verification tag in place. Nothing to fix here.

### Category 5 — Visual design / AI-slop tells
- PASS: distinctive black-hole/space aesthetic with a committed orange accent — not the generic purple-gradient/Inter-font template look
- FIX: the entry gate is exactly the kind of "friction before content" the skill calls out even for an otherwise-excellent 3D concept — the visual idea (Interstellar-style black hole) is good and worth keeping, the mandatory gate in front of it is the problem, not the visuals themselves

### Category 6 — GitHub / proof-of-work
- PASS: `repositoryUrl` present and correct for CertiSafe, IPL Score Predictor, ThirdEyeAI, and the portfolio itself
- FIX: ResumeByAI, MindPlan, and 5 other projects in `src/data/projects/` have no `repositoryUrl` at all — either add them or don't surface those projects
- Did not independently check github.com/KiranKalluri268's pinned repos/recent activity in this session — worth a quick manual check that pinned repos match what's advertised on the site.
