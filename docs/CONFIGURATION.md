# Configuration

## Environment setup

Copy the committed example before local development:

```bash
cp .env.example .env.local
```

`.env.local` must remain uncommitted.

## Contact form

### `RESEND_API_KEY`

Required for email delivery. Create the key in the Resend dashboard. It is read only in `src/app/api/contact/route.ts` and must never use a `NEXT_PUBLIC_` prefix.

### `CONTACT_EMAIL`

Required for email delivery. Every valid contact submission is sent to this address.

### `RESEND_FROM_EMAIL`

Optional sender identity. Until a domain is verified, use the Resend onboarding sender:

```dotenv
RESEND_FROM_EMAIL=Portfolio <onboarding@resend.dev>
```

For production, verify a domain in Resend and replace it with an address on that domain.

The visitor's email is assigned as `reply_to`, allowing a direct reply from the destination inbox.

## Contact limits

The API accepts:

- Name: 1–100 characters
- Valid email: up to 254 characters
- Message: 1–5,000 characters
- Five accepted attempts per IP during a ten-minute window before a `429` response

The current limiter uses process memory. Serverless instances do not share this map, and deployments reset it. Use a managed store such as Redis if stronger abuse protection is needed.

## Editable portfolio data

### About

Edit `src/data/about.json`. Preserve valid JSON and keep emphasis ranges aligned with the desired copy.

### Résumé

Edit `src/data/resume.json`. Both `/resume` and the downloaded PDF consume this file, so content remains synchronized.

### Projects, skills, and experience

Each project is one JSON file in:

- `src/data/projects/`

The filename is for organization; the `slug` field controls the URL. A published
project automatically receives `/projects/[slug]`. Set `showInProjectsSection`
to control the homepage carousel, `featured` to control the projects listing,
and `projectsSectionOrder` to control ordering.

Each skill is one JSON file in:

- `src/data/skills/`

Skills automatically receive `/skills/[slug]`. Project files connect to skills
through the skill slugs in their `skills` arrays. These relationships generate
clickable technology badges on project pages and related-project cards on skill
pages. Do not duplicate project lists inside skill files.

Skill marquee groups and directions are configured in:

- `src/data/skill-categories.json`

Set `showInSkillsSection` to control marquee visibility and
`skillsSectionOrder` to control ordering. Optional icons should use a public URL
such as `/icons/skills/react.svg`; `iconText` is used as the fallback.

All image and icon paths are relative to `public`, so use `/images/example.jpg`
rather than `public/images/example.jpg`. Draft entries remain editable but are
excluded from generated pages until `status` is changed to `published`.

The server loaders in `src/lib/content` validate required fields, duplicate
slugs, unknown categories, and project references to unknown skills during the
build.

Experience content currently lives in:

- `src/components/ExperienceTimeline.tsx`

Use optimized images from `public/images` and provide specific repository/demo URLs where available.

## Site identity and SEO

Canonical site information is currently defined in:

- `src/app/layout.tsx`
- `src/app/sitemap.ts`
- `src/app/robots.ts`
- `src/app/opengraph-image.tsx`

When changing domains, update every canonical occurrence and the generated social image URL. The Open Graph renderer reads local Tektur TTF files from `public/fonts` and uses the deployed black-hole image URL.

## Media

- Main audio: `public/audio/final.mp3`
- Safari alpha video: `public/images/optimized_safari.mov`
- WebM alpha video: `public/images/optimized.webm`
- Static black-hole image: `public/images/blackhole.png`

Keep both transparent video formats unless browser support requirements change. Large media should be optimized before committing.

Project images use the configured Next.js quality value `90`; the default `75` remains available for other images. Add new quality values to `images.qualities` in `next.config.ts` before using them.

## Fonts

The application uses `next/font/google` for Foldit and Tektur. The social image renderer cannot consume those generated WOFF2 URLs directly, so it embeds the committed static Tektur TTF files in `public/fonts`.
