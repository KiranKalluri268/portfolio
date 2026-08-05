# Saikiran Kalluri — Portfolio

A responsive, animated software engineering portfolio built with Next.js, React, GSAP, Lenis, and Tailwind CSS. It presents Saikiran Kalluri's work, experience, technical skills, résumé, and contact information through a continuous vertical narrative with a pinned horizontal Projects section.

**Live site:** [saikirankalluri.vercel.app](https://saikirankalluri.vercel.app)  
**Repository:** [github.com/KiranKalluri268/portfolio1](https://github.com/KiranKalluri268/portfolio1)

## Features

- User-initiated entry experience with coordinated font, video, and audio preparation
- Lenis smooth scrolling integrated with the GSAP ticker
- GSAP `ScrollTrigger` animations without wheel-event hijacking
- Scroll-animated About section backed by editable JSON
- Pinned horizontal Projects carousel driven by natural Lenis scrolling
- Responsive alternating Experience timeline with mobile-specific focus behavior, where each role opens a detail page with a nested timeline of the work shipped during it
- Direction-aware, scroll-responsive skill marquees
- Interactive, data-driven skill universe with radial branches, pan, zoom, pinch, and accessible list navigation
- Interactive canvas star field with shooting-star lifecycle
- Cross-browser transparent black-hole video using WebM and QuickTime sources
- Accessible HTML résumé generated from JSON, with client-side PDF download
- Resend-powered contact form with server-side validation and rate limiting
- Keyboard navigation, skip links, semantic controls, and reduced-motion support
- Canonical metadata, JSON-LD, sitemap, robots configuration, and generated social image

## Technology

| Area | Technology |
| --- | --- |
| Framework | Next.js 16 App Router, React 19, TypeScript |
| Styling | Tailwind CSS 4, CSS Modules |
| Motion | GSAP, ScrollTrigger, Lenis |
| PDF | `@react-pdf/renderer` |
| Contact delivery | Resend REST API through a Next.js route handler |
| Icons | React Icons |
| Deployment | Vercel |
| Verification | ESLint, TypeScript through `next build`, Vitest, GitHub Actions |

## Getting started

### Requirements

- Node.js 20 or newer
- npm
- A Resend account if you want the contact form to deliver email

### Installation

```bash
git clone https://github.com/KiranKalluri268/portfolio1.git
cd portfolio1
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The portfolio can be viewed without valid Resend credentials, but contact submissions will return a configuration error until the required variables are supplied.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | Yes for contact delivery | Resend API key used only by the server route |
| `CONTACT_EMAIL` | Yes for contact delivery | Destination for submitted messages |
| `RESEND_FROM_EMAIL` | Optional | Verified sender; defaults to Resend's onboarding sender |

Never commit `.env.local` or expose `RESEND_API_KEY` through a `NEXT_PUBLIC_` variable. See [Configuration](docs/CONFIGURATION.md) for provider setup and limits.

## Commands

```bash
npm run dev           # Start the Turbopack development server
npm run lint          # Run ESLint across the repository
npm run test          # Run the Vitest suite once
npm run test:watch    # Run Vitest in watch mode
npm run test:coverage # Run Vitest with a coverage report
npm run build         # Type-check and create an optimized production build
npm run start         # Serve the completed production build
```

Recommended verification before committing:

```bash
npm run lint
npm run test
npm run build
```

## Testing

Vitest and React Testing Library cover the parts of the codebase most likely to break silently:

- `src/lib/content/*` — JSON content validation, sorting, filtering, and the project/skill/experience relationship graph
- `src/components/skills/skill-web-layout.ts` — the deterministic radial skill-graph layout and its collision-free guarantee
- `src/app/api/contact/route.ts` — request validation, Resend delivery, and IP-based rate limiting
- `src/components/Contact.tsx` — client-side form validation and submit/success/error states

Tests run in a Node environment by default; component tests that need a DOM opt in with a `// @vitest-environment jsdom` docblock. GitHub Actions runs `npm run lint`, `npm run test`, and `npm run build` on every push and pull request to `main`.

## Application routes

| Route | Purpose |
| --- | --- |
| `/` | Main portfolio narrative |
| `/resume` | Accessible JSON-driven résumé and PDF download |
| `/projects` | Responsive project overview and case studies |
| `/projects/[slug]` | JSON-driven project case study |
| `/skills` | Interactive skill universe organized by domain and subcategory |
| `/skills/[slug]` | JSON-driven skill background and related projects |
| `/experience/[slug]` | JSON-driven role detail with a timeline of work shipped during it |
| `/api/contact` | Server-side contact form endpoint |
| `/opengraph-image` | Generated 1200×630 social preview |
| `/robots.txt` | Search crawler rules |
| `/sitemap.xml` | Indexable route list |

## Project structure

```text
src/
├── app/                 Next.js routes, metadata, API, résumé and PDF
├── background/          Star canvas and transparent black-hole media
├── components/          Portfolio sections and navigation controls
├── context/             Audio lifecycle and Lenis/scroll coordination
├── data/                Editable About, résumé, project, skill, and experience content
├── lib/content/         Server-side content discovery, validation, and relationships
└── types/               Shared TypeScript interfaces
public/
├── audio/               Portfolio soundtrack
├── fonts/               Tektur files used by the social image renderer
├── images/              Project, identity and black-hole assets
└── sounds/              Additional sound effects
docs/                    Architecture and operational documentation
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Animation system](docs/ANIMATIONS.md)
- [Configuration](docs/CONFIGURATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Contributing](docs/CONTRIBUTING.md)
- [What is left](docs/ROADMAP.md)
- [Current project status](PROJECT_STATUS.md)
- [Improvement backlog](IMPROVEMENTS.md)

## Accessibility and performance

The site uses native buttons and links, visible focus states, skip links, semantic sections, and `prefers-reduced-motion`. Background video and audio pause while the tab is hidden. Decorative canvas work is reduced or stopped when appropriate, and skill animation pauses outside the viewport.

Performance-sensitive changes should be tested on a real touch device as well as desktop Chrome DevTools. See [Animation system](docs/ANIMATIONS.md) before adding new scroll effects.

## Licensing and attribution

This repository uses two licenses:

- **Source code:** [MIT License](LICENSE)
- **Original design, documentation, written content, résumé data, and original visual assets:** [Creative Commons Attribution 4.0](LICENSE-CONTENT.md)

Reuse of the CC BY material requires attribution to **Saikiran Kalluri / [@KiranKalluri268](https://github.com/KiranKalluri268)**, a link to the [original repository](https://github.com/KiranKalluri268/portfolio1), a link to CC BY 4.0, and an indication of changes.

Third-party packages, fonts, icons, audio, and other externally sourced material remain subject to their respective licenses and are not relicensed by this repository.
