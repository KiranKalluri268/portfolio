# Status

The one page to read before picking work up again. Brief on purpose — the
reasoning lives in `docs/`, and the rules for changing things live in
`CLAUDE.md`.

**Last verified:** 2026-08-06 · Next 16 · Node 20 · deployed on Vercel

---

## Health

| | | |
|---|---|---|
| Build | ✅ | clean |
| Unit tests | ✅ | 241 passing, 20 files |
| Browser tests | ✅ | 39 passing, 5 files, Chromium in CI |
| Lint / types | ✅ | clean |
| Vulnerabilities | ✅ | 0 (Dependabot watches weekly) |
| Unit coverage | ⚠️ | 21% of statements. Low by design — the big components are covered by browser tests, which this number cannot see. |
| Analytics | ✅ | Vercel Analytics + Speed Insights |
| Error reporting | ❌ | nothing collects production errors |

---

## What's left

Ordered. Detail and reasoning in [`docs/ROADMAP.md`](docs/ROADMAP.md).

| # | | Notes |
|---|---|---|
| 1 | **Audit the content** | Only item that can make the site *wrong*. 5 of 10 projects have no image, 2 have outcomes, 0 have a gallery. Nobody else can do it. |
| 2 | **Licence the background music** | Current track may not be licensed for this use. An afternoon. |
| 3 | **Cover the carousel and the projects grid** | The two biggest untested behaviours left. Both need real touch input, which no existing test does. |
| 4 | **Security headers** | No CSP, HSTS, `X-Frame-Options` or `Referrer-Policy` anywhere. |
| 5 | **Error reporting** | Needs a service picked (Sentry means an account and a DSN). |
| 6 | **Hiring call to action** | Availability, preferred role, location — one prominent contact action. Needs Saikiran's decisions, not code. |
| 7 | **Carousel smoothing** | Decide which "smoother" is meant first — there are four. |
| 8 | **Skill detail pages, then the web** | Destination before the map. |
| 9 | **Accessibility pass** | Done once, properly, with numbers. |
| 10 | **Section-aware music** | Real feature: tracks, licences, crossfade. |
| 11 | **Sound effects** | Last — everything above changes interactions that would each need one. |

---

## Known issues

| | |
|---|---|
| `/skills` runs at ~51fps at rest | Starfield canvas repainting under 58 backdrop-blurred nodes. Either alone is free; the pair is not. |
| Projects grid leaves a band top and bottom | Vertical warp not scaled to viewport aspect. Not a regression. |
| Header height is hardcoded in 4 places | `56px` / `96px` as Tailwind classes, nothing keeping them in step. |
| Contact rate limit is per-instance | In-memory `Map` in the route; each serverless instance has its own and a cold start resets it. A speed bump, not a limit. |
| `react-icons` is pinned at 5.5.x | 5.7 removed the marks for AWS, DynamoDB, Canva, GPT-4 and Tableau. Unpinning costs five logos; putting them back as local assets is a trademark question. Reasoning is in `skill-icons.tsx`. |
| `resume.json` publishes phone, email, home address | A decision to make deliberately, not by default. |
| `/admin` can't validate `resume.json` or `about.json` before commit | Neither has a runtime validator like projects/skills/experience do - a bad edit there is only caught by CI on the resulting PR, not before the commit itself. |

---

## Where things are

| | |
|---|---|
| `CLAUDE.md` | How to change this repo. Read before editing. |
| `docs/ARCHITECTURE.md` | What the code is |
| `docs/ANIMATIONS.md` | Scroll ownership, GSAP/Lenis rules |
| `docs/ROADMAP.md` | The why behind "What's left" |
| `docs/CONFIGURATION.md` · `docs/DEPLOYMENT.md` | Env vars, deploy |
| `src/data/**` | All content. Prefer changing this over changing components. |
| `e2e/` | Browser tests. `npm run test:e2e`. |

---

## Recently shipped

Site menu · entry animation · projects grid + its intro · skills web intro ·
résumé and CV reveal · 404 and error pages · analytics · browser tests in CI ·
content admin (`/admin`) for editing `src/data/**` into a real commit + PR
without a local checkout.
