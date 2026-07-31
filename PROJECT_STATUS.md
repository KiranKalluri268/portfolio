# Project Status

Last updated: 2026-07-22  
Active branch: `feat/hiring-cta-content-audit`

## Current focus

Complete the copy, semantic-date, and image-quality audits.

| Work item | Status | Notes |
| --- | --- | --- |
| Copy consistency audit | Complete | Corrected role naming, punctuation, capitalization, and résumé terminology |
| Semantic experience dates | Complete | Visible periods use valid machine-readable year-month values |
| Image quality configuration | Complete | Project images consistently use configured quality `90` |
| Desktop visual QA | Pending | Review audited copy and experience-period rendering |
| Mobile visual QA | Pending | Review audited copy and experience-period wrapping |
| Automated verification | Complete | ESLint and the Next.js production build pass |

## Next

1. Review the audited copy and experience dates on desktop and mobile.
2. Extend automated test coverage to scene/carousel navigation, keyboard navigation, and audio-disabled rendering.
3. Add production error monitoring and structured operational logging.

## Later

- Consider individual project detail routes if case studies grow beyond the overview page.
- Add new project screenshots and measurable outcomes as they become available.

## Recently completed

- Vitest test suite (content layer, skill-web layout, contact API, contact form) plus `npm run lint` and `npm run test` in CI
- Comprehensive README and operational documentation
- Responsive `/projects` case-study page backed by shared structured data
- MIT code license and CC BY 4.0 content/design license
- Mobile Experience timeline alignment and focus animation
- Persistent mobile scene navigation overlay
- Responsive hero typography
- SEO metadata and generated social preview

## Known constraints

- `/api/contact` uses an in-memory, instance-local rate limiter.
- ResumeByAI and MindPlan do not currently have verified public project links.
- Real-device mobile QA is still required after significant layout changes.
- Some Windows/WSL worktrees may report line-ending-only file modifications; verify logical diffs before staging.

## Verification baseline

Current branch verification:

- `npm run lint` — Passed
- `npm run test` — Passed (61 tests)
- `npm run build` — Passed

Before merging a feature branch:

```bash
npm run lint
npm run test
npm run build
```

Manual verification should include keyboard navigation, reduced motion, touch behavior, route return behavior, and background-tab audio/video handling.
