import { Font } from "@react-pdf/renderer";

/** Keeps every word whole in the generated PDFs. react-pdf hyphenates long
 *  words at line ends by default, so the résumé summary printed
 *  "container-" / "izing", and copied or parsed text (an ATS reading the
 *  download) came out with the keyword split in two. A word that does not fit
 *  now moves to the next line instead.
 *
 *  The registry is global to react-pdf, but the résumé and CV PDFs are loaded
 *  on demand from different routes, so each document imports this module
 *  rather than relying on whichever one was rendered first. */
export function keepWordsWhole(word: string): string[] {
  return [word];
}

Font.registerHyphenationCallback(keepWordsWhole);
