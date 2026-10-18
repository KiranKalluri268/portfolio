"use client";

import { Font, Text } from "@react-pdf/renderer";
import { splitEmphasis } from "./emphasis";

/** The family both résumé PDFs set their text in: the same CMU Serif subset
 *  the page loads, so the download matches the sheet on screen. */
export const RESUME_PDF_FONT = "Resume Serif";

const FONT_DIR = "/fonts/resume-serif";

Font.register({
  family: RESUME_PDF_FONT,
  fonts: [
    { src: `${FONT_DIR}/resume-serif-regular.ttf` },
    { src: `${FONT_DIR}/resume-serif-bold.ttf`, fontWeight: 700 },
    { src: `${FONT_DIR}/resume-serif-italic.ttf`, fontStyle: "italic" },
    { src: `${FONT_DIR}/resume-serif-bold-italic.ttf`, fontWeight: 700, fontStyle: "italic" },
  ],
});

/** A bullet's text with its `**…**` figures set in bold. */
export function PdfEmphasised({ text }: { text: string }) {
  return (
    <Text style={{ flex: 1 }}>
      {splitEmphasis(text).map((run, index) =>
        run.bold ? (
          <Text key={index} style={{ fontWeight: 700 }}>
            {run.text}
          </Text>
        ) : (
          run.text
        ),
      )}
    </Text>
  );
}
