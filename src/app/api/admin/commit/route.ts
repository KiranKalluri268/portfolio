import { NextResponse } from "next/server";
import { commitContentChange } from "@/lib/admin/github";
import { validateContentForPath } from "@/lib/admin/validate-content";

const VALID_PATH = /^[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*\.json$/;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    relativePath?: string;
    content?: string;
    message?: string;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { relativePath, content, message } = body;

  if (typeof relativePath !== "string" || !VALID_PATH.test(relativePath)) {
    return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
  }
  if (typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "A change message is required" }, { status: 400 });
  }
  if (typeof content !== "string") {
    return NextResponse.json({ error: "Missing content" }, { status: 400 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return NextResponse.json({ error: `Not valid JSON: ${detail}` }, { status: 400 });
  }

  try {
    validateContentForPath(relativePath, parsed);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return NextResponse.json({ error: `Failed content validation: ${detail}` }, { status: 400 });
  }

  try {
    // Re-serialized from the parsed value, not the raw textarea text, so the
    // committed file always has the same formatting as every other file in
    // src/data regardless of how it was typed.
    const canonicalContent = `${JSON.stringify(parsed, null, 2)}\n`;
    const result = await commitContentChange({
      relativePath,
      content: canonicalContent,
      message: message.trim(),
    });
    return NextResponse.json(result);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return NextResponse.json({ error: `Commit failed: ${detail}` }, { status: 502 });
  }
}
