# Contributing

Contributions are welcome when they preserve the portfolio's accessibility, performance, and visual intent.

## Setup

```bash
git clone https://github.com/KiranKalluri268/portfolio1.git
cd portfolio1
npm ci
cp .env.example .env.local
npm run dev
```

Contact delivery is optional during UI development. Never commit real API keys or recipient addresses.

## Before changing code

- Read [Architecture](ARCHITECTURE.md) for ownership boundaries.
- Read [Animation system](ANIMATIONS.md) before modifying scrolling or motion.
- Check [IMPROVEMENTS.md](../IMPROVEMENTS.md) for known work.
- Keep changes focused; avoid mixing visual redesigns with architecture refactors.

## Code expectations

- Use TypeScript and existing shared types.
- Use native semantic elements for interactive controls.
- Preserve keyboard and touch behavior.
- Respect `prefers-reduced-motion`.
- Keep native scrolling available; do not add wheel hijacking.
- Do not create a second Lenis instance or a competing global scroll manager.
- Scope GSAP work and clean up every tween, trigger, observer, listener, and timer.
- Keep personal content in JSON where an established data source exists.
- Optimize large images, audio, and video before committing.

## Verification

Run:

```bash
npm run lint
npm run test
npm run build
```

Add or update Vitest coverage in `src/lib/content`, `src/components/skills/skill-web-layout.ts`, `src/app/api/contact/route.ts`, or `src/components/Contact.tsx` when you change their behavior.

For visual changes, manually verify:

- Desktop and mobile widths
- Short mobile landscape viewports
- Mouse wheel and trackpad scrolling
- Touch swipes in Projects
- Keyboard navigation and visible focus
- Reduced-motion mode
- Route navigation and restored scroll position
- Background-tab audio/video behavior

## Commit messages

Use concise Conventional Commit-style messages:

```text
feat(scope): add capability
fix(scope): correct behavior
refactor(scope): simplify implementation
docs: update project documentation
perf(scope): reduce rendering cost
```

## Licensing contributions

By contributing source code, you agree that it may be distributed under the repository's [MIT License](../LICENSE).

By contributing original documentation, design work, written content, or visual assets, you agree that it may be distributed under [CC BY 4.0](../LICENSE-CONTENT.md), unless an alternative license is clearly identified before acceptance.

Do not contribute material that you do not have permission to redistribute. Third-party material must include its source and license information.

## Attribution when creating your own portfolio

If you reuse covered design, content, documentation, or assets, follow [LICENSE-CONTENT.md](../LICENSE-CONTENT.md). Replace Saikiran's résumé, photograph, project screenshots, contact details, employer information, and personal writing with your own material.
