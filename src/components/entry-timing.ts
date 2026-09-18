/** How long the entry screen winds up before it lets the particles go, and so
 *  the moment the page starts being uncovered.
 *
 * Shared because the hero waits for it: its headline types itself, and behind
 * an opaque curtain that is a performance nobody sees. Delaying the whole of
 * `enterPortfolio` instead would take the starfield and the audio with it —
 * the stars do not draw at all until it is set, so the hole in the curtain
 * would look onto an empty void and then fill in.
 */
export const ENTRY_RELEASE_MS = 1200;

/** How long the particles take to clear the screen once released, and so how
 *  much longer the curtain takes to fully dismiss after it starts opening.
 *  Shared because anything positioned outside where the curtain's opening
 *  starts - the scene dots sit at the top of the screen, not the centre -
 *  is still covered for the whole of this, not just ENTRY_RELEASE_MS. */
export const ENTRY_ESCAPE_MS = 750;

/** The entry screen's whole lifetime, wind-up and escape both: the first
 *  moment nothing at all is left of it. */
export const ENTRY_DISMISS_MS = ENTRY_RELEASE_MS + ENTRY_ESCAPE_MS;
