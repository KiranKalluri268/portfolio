import { NextResponse } from "next/server";
import { getCvData } from "@/lib/content/cv";

/** Machine-readable form of /cv: the exact same data the page renders, so a
 *  résumé-tailoring tool reads the same source of truth a recruiter sees. All
 *  public content, already served as static text on /cv, so no auth. */
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(getCvData(), {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
