import { getBotKnowledge } from "@/lib/content/bot";

/** What TARS knows, built from the content files at build time and fetched
 *  only when someone opens the chat, so no page carries it in its HTML. */
export const dynamic = "force-static";

export function GET() {
  return Response.json(getBotKnowledge());
}
