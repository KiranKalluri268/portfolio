import type { CSSProperties } from "react";

/** The shape of the résumé's and CV's reveal: how long a piece takes, and when
 *  each one lands.
 *
 * Plain module rather than part of `PaperReveal.tsx`, because both documents
 * are server components and a server component cannot call a function that
 * lives in a `"use client"` file. What is here is data about the animation;
 * the component next door owns when it starts. */

/** How long one piece takes to arrive. */
export const REVEAL_MS = 460;

/** Empty paper before the first piece lands, so the sheet is seen as a sheet.
 *  Without it the header is already fading up as the page paints and there is
 *  no blank-page moment at all. */
export const REVEAL_LEAD_IN_MS = 320;

/** Between one piece and the next. The résumé is one sheet of eight pieces and
 *  can afford a slow tempo; the CV is thirty across five sheets and at the same
 *  step would take seven seconds to finish writing itself. */
export const RESUME_STEP_MS = 140;
export const CV_STEP_MS = 70;

/** An extra beat when the writing crosses onto a new sheet, so "page by page"
 *  is legible as pages rather than as one long queue of paragraphs. */
export const CV_PAGE_GAP_MS = 200;

/** What a revealed piece has to carry: the marker the CSS selects on, and its
 *  own delay. Server components spread this — it is data, not behaviour. */
export function revealProps(delayMs: number) {
  return {
    "data-reveal": "",
    style: { "--reveal-delay": `${delayMs}ms` } as CSSProperties,
  };
}
