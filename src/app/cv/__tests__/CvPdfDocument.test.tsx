import { describe, expect, it } from "vitest";

import CvPdfDocument from "../CvPdfDocument";
import { getCvData } from "@/lib/content/cv";

/** Counts `/Type /Page` objects, which is one per rendered page. */
function countPages(pdf: Buffer) {
  return (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

describe("CvPdfDocument", () => {
  it("renders a multi-page PDF from the real CV data", async () => {
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const pdf = await renderToBuffer(<CvPdfDocument cv={getCvData()} />);

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
    // The CV is the long form of the résumé. If it ever collapses to a single
    // page, the content pipeline feeding it has broken.
    expect(countPages(pdf)).toBeGreaterThan(1);
  }, 60_000);

  it("does not set lineHeight on the Page, which would drop the page-number footer", async () => {
    // react-pdf 4.x silently stops rendering `fixed` absolutely-positioned
    // children when the Page carries a lineHeight. The footer disappears with
    // no error, so guard the style rather than the output.
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(
      new URL("../CvPdfDocument.tsx", import.meta.url),
      "utf8",
    );
    const pageStyle = source
      .slice(source.indexOf("page: {"), source.indexOf("name: {"))
      .replace(/\/\/.*$/gm, ""); // the comment explaining this rule mentions it
    expect(pageStyle).not.toMatch(/\blineHeight\s*:/);
  });
});
