# Deployment

## Production target

The portfolio targets Vercel. GitHub Actions verifies that the `main` branch and pull requests can produce a Next.js build; it does not deploy to GitHub Pages.

## Local production verification

```bash
npm ci
npm run lint
npm run build
npm run start
```

Then verify:

- `/`
- `/resume`
- `/opengraph-image`
- `/robots.txt`
- `/sitemap.xml`
- A successful and failed contact submission

## Vercel setup

1. Import `KiranKalluri268/portfolio1` into Vercel.
2. Keep the detected Next.js framework preset.
3. Use `npm run build` as the build command.
4. Add the production environment variables.
5. Deploy and test contact delivery from the deployed domain.

Required production variables:

```dotenv
RESEND_API_KEY=...
CONTACT_EMAIL=...
RESEND_FROM_EMAIL=Portfolio <contact@your-verified-domain.example>
```

Configure variables for Preview environments too if contact testing is expected there.

## GitHub Actions

`.github/workflows/nextjs.yml` currently:

1. Checks out the repository
2. Uses Node.js 20
3. Runs `npm ci`
4. Runs `npm run build`

The workflow intentionally verifies builds only. A future CI improvement should add an explicit lint step and automated tests before the build.

## Post-deployment checks

- Confirm the Enter overlay waits for interaction.
- Confirm audio and video pause when the tab is backgrounded.
- Scroll through every project panel with mouse, trackpad, and touch.
- Confirm mobile navigation dots remain above content.
- Open `/skills` and verify mouse-wheel zoom, drag panning, touch pinch/pan, branch focus, Fit controls, and the accessible List view.
- Open several skill nodes and confirm they navigate to the matching `/skills/[slug]` pages.
- Download the résumé and test its links.
- Submit the contact form and reply to the delivered email.
- Inspect the social preview using LinkedIn Post Inspector or another crawler debugger.
- Confirm `/projects` metadata, project links, images, and responsive layout.

## Common failures

### Contact returns “not configured”

`RESEND_API_KEY` or `CONTACT_EMAIL` is missing from the current Vercel environment.

### Resend rejects the sender

Use the onboarding sender while testing, or verify the domain used by `RESEND_FROM_EMAIL`.

### Social image fails to generate

Confirm these files exist:

- `public/fonts/tektur-regular.ttf`
- `public/fonts/tektur-bold.ttf`
- `public/images/blackhole.png`

Run `npm run build`; metadata image failures appear during prerendering.

### Media works locally but not after deployment

Check filename capitalization and verify both source formats are committed. Vercel's filesystem is case-sensitive.

### Build works in PowerShell but not Windows Subsystem for Linux

Use WSL 2 with a Linux Node.js installation, or run npm commands from PowerShell. Avoid mixing Windows and Linux dependency installations in the same `node_modules` directory.
