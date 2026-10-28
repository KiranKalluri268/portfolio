/** Résumé bullets mark the figure a reader should catch with `**…**`, the way
 *  the printed résumé sets it in bold, and a link with `[text](url)`, as
 *  Markdown does. A url starting with "/" is a page on this site. Plain module
 *  rather than a component so the HTML sheet and both PDF documents split the
 *  text the same way. */
export interface EmphasisRun {
  text: string;
  bold: boolean;
  href?: string;
}

/** Either marker, so bold can open before a link and close after it. */
const MARKERS = /(\*\*|\[[^\]]+\]\([^)\s]+\))/;
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

export function splitEmphasis(text: string): EmphasisRun[] {
  let bold = false;
  const runs: EmphasisRun[] = [];
  for (const part of text.split(MARKERS)) {
    if (part === "**") {
      bold = !bold;
      continue;
    }
    const link = LINK.exec(part);
    if (link) runs.push({ text: link[1], bold, href: link[2] });
    else if (part.length > 0) runs.push({ text: part, bold });
  }
  return runs;
}

/** The same text with its markers removed, for keys and accessible names. */
export function plainText(text: string): string {
  return splitEmphasis(text)
    .map((run) => run.text)
    .join("");
}
