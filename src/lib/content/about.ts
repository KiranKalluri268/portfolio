import "server-only";

import { assertRecord, assertString } from "./read-content";
import type { AboutJson } from "./types";

/** about.json is read directly as a plain typed JSON import in
 *  AboutSection.tsx, with no runtime check that it matches AboutJson - see
 *  the same comment on validateResumeJson in resume.ts for why this exists:
 *  so /admin can reject a malformed edit before it becomes a commit. */
export function validateAboutJson(value: unknown, source: string): AboutJson {
  assertRecord(value, source);

  assertString(value.eyebrow, "eyebrow", source);
  assertString(value.ariaLabel, "ariaLabel", source);

  if (!Array.isArray(value.segments) || value.segments.length === 0) {
    throw new Error(`${source}: "segments" must be a non-empty array`);
  }
  value.segments.forEach((segment, index) => {
    const segmentSource = `${source}.segments[${index}]`;
    assertRecord(segment, segmentSource);
    assertString(segment.text, "text", segmentSource);
    if (typeof segment.accent !== "boolean") {
      throw new Error(`${segmentSource}: "accent" must be a boolean`);
    }
  });

  return value as unknown as AboutJson;
}
