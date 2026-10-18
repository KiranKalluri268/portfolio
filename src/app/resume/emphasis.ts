/** Résumé bullets mark the figure a reader should catch with `**…**`, the way
 *  the printed résumé sets it in bold. Plain module rather than a component so
 *  the HTML sheet and both PDF documents split the text the same way. */
export interface EmphasisRun {
  text: string;
  bold: boolean;
}

export function splitEmphasis(text: string): EmphasisRun[] {
  return text
    .split("**")
    .map((part, index) => ({ text: part, bold: index % 2 === 1 }))
    .filter((run) => run.text.length > 0);
}

/** The same text with its markers removed, for keys and accessible names. */
export function plainText(text: string): string {
  return text.replaceAll("**", "");
}
