import type { Metadata } from "next";
import CinematicScene from "@/cinematic/CinematicScene";

/**
 * The cinematic presentation, on a route of its own.
 *
 * Until now this was scaffolding behind `?cinematic=1`, because nothing linked
 * here and a stranger wandering in would have started downloading 10MB of
 * texture for a scene that was not a choice anyone had made. It is a choice now
 * - the site menu offers it and a cookie remembers it - so the flag is gone and
 * the proxy decides who arrives.
 *
 * Still its own route rather than a branch inside `/`. The journey owns scroll
 * for its whole length, and the sections on the home page have their own ideas
 * about scrolling. One document with one scroll position is where this ends up
 * (CINEMATIC_DECISION.md §7); two URLs is what it costs to get there in steps.
 */

/**
 * Not indexed, and that is a deliberate cost rather than an oversight.
 *
 * Two URLs serving one portfolio is duplicate content, and `/` is the canonical
 * one: it has every section, it is what every link on the internet points at,
 * and it is what a crawler should read. This route currently carries a single
 * section scored against the flight. When it carries the whole portfolio, this
 * decision is worth taking again.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: { canonical: "/" },
};

export default async function CinematicPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  // The FPS meter and the tier switcher. Watching a tier settle under real
  // thermal load, and holding one still to see what it actually looks like, are
  // the two things a desktop cannot tell me.
  const showDevTools = params.devtools === "1";

  // Walk the camera through the whole journey and report what each part costs,
  // instead of following scroll. Every tuning decision so far has rested on a
  // guess about where the expensive frames are, and the guess has now been wrong
  // twice in opposite directions.
  const measureCurve = params.curve === "1";

  return <CinematicScene showDevTools={showDevTools} measureCurve={measureCurve} />;
}
