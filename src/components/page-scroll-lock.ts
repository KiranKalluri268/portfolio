/** Holding the page still, counted, so two holders cannot fight over it.
 *
 * Two things stop the page scrolling, and their lifetimes overlap: the entry
 * screen, and the site menu while it covers the screen for a route change.
 * Both used to save `body.style.overflow` themselves and put their saved value
 * back on the way out, which is only correct while one of them exists at a
 * time. Returning to `/` through the menu is exactly the case where they do
 * not:
 *
 *   1. the menu opens on some other route  - saves "", sets "hidden"
 *   2. Home is chosen, the home page mounts, the entry screen appears and
 *      locks too - saves "hidden", the menu's value, and sets "hidden"
 *   3. the menu closes  - puts its "" back
 *   4. Enter is pressed, the entry screen goes - puts *its* saved "hidden"
 *      back, and the page is left with `overflow: hidden` for good
 *
 * A body stuck at `overflow: hidden` makes the body its own scroll container,
 * and `position: sticky` inside it has nothing to stick to any more, because
 * the thing actually scrolling is the document above it. The About section is
 * a sticky panel inside 500svh of runway, so it stopped pinning: the copy
 * scrolled away with the page and left the rest of the section as a long gap
 * before Experience.
 *
 * So there is one owner instead. The first holder saves and applies, the last
 * one to leave restores, and nobody in between reads a value another holder
 * wrote. Lenis is stopped and started on the same count, because both callers
 * were already doing both together and the same overlap left it started while
 * the entry screen was still up.
 */

/** Only what this needs from Lenis, so the lock does not depend on it. */
interface ScrollEngine {
  stop: () => void;
  start: () => void;
}

let holders = 0;
let restoreOverflow = "";
let engine: ScrollEngine | null = null;

/** Holds the page still until the returned function is called. Safe to call
 *  from more than one place at once, and safe to release twice. */
export function lockPageScroll(lenis: ScrollEngine | null | undefined): () => void {
  if (holders === 0) {
    restoreOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  // Lenis is created in the layout and published a render later, so the first
  // holder can arrive before it exists. Whoever brings it stops it.
  if (lenis && !engine) {
    engine = lenis;
    lenis.stop();
  }
  holders += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders -= 1;
    if (holders > 0) return;
    document.body.style.overflow = restoreOverflow;
    engine?.start();
    engine = null;
  };
}
