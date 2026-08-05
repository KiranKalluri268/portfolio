/** How long the entry screen winds up before it lets the particles go, and so
 *  the moment the page starts being uncovered.
 *
 * Shared because the hero waits for it: its headline types itself, and behind
 * an opaque curtain that is a performance nobody sees. Delaying the whole of
 * `enterPortfolio` instead would take the starfield and the audio with it —
 * the stars do not draw at all until it is set, so the hole in the curtain
 * would look onto an empty void and then fill in.
 */
export const ENTRY_RELEASE_MS = 2000;
