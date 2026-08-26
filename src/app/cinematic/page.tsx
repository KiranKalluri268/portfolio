import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CinematicScene from "@/cinematic/CinematicScene";

/**
 * The ported black hole journey, on a route of its own.
 *
 * This is scaffolding, not a destination. The scene owns scroll for its whole
 * length - the document is twenty-eight screens tall and every frame is a
 * function of where you are in it - so it cannot share a page with sections
 * that have their own ideas about scrolling. Giving it somewhere to run on its
 * own is what makes the port provable before anything about the site changes:
 * every other route still gets the still tier, exactly as before.
 *
 * Where the journey eventually lives, and how the site's real content is scored
 * against it, is a separate and much larger question. See
 * docs/CINEMATIC_DECISION.md.
 */

// Nothing links here and nothing should index it.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function CinematicPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  // A flag rather than a deploy. Both phones this needs testing on are ones I
  // cannot attach a debugger to, and the useful comparison is the same build on
  // a fast phone and a slow one - so the switch has to be something typeable in
  // a URL bar. It is not secrecy: the route simply does not exist without it,
  // so nothing can wander in and start downloading 10MB of texture.
  if (params.cinematic !== "1") {
    notFound();
  }

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
