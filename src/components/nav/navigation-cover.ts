/** Whether a full-screen cover is currently over the page, and a way to be told
 *  when it lifts.
 *
 * The site menu holds its cover up while the route changes, so a page that
 * animates as it arrives mounts behind it and plays to nobody. Anything with an
 * entrance asks here first rather than starting on mount.
 *
 * Deliberately a module rather than context: the cover is raised by a component
 * in the layout and waited on by components inside the page, and the page's
 * effects run before the layout's — so anything relying on render order would
 * be read before it was written.
 */

let covered = false;
const waiting = new Set<() => void>();

/** The menu is holding the screen while a route change happens. */
export function raiseCover() {
  covered = true;
}

/** The cover has started lifting and will be gone in `ms`. */
export function dropCoverIn(ms: number) {
  if (!covered) return;
  window.setTimeout(() => {
    covered = false;
    const due = [...waiting];
    waiting.clear();
    for (const run of due) run();
  }, ms);
}

/** Runs `whenClear` once nothing is over the page — immediately if nothing is.
 *  Returns a function that cancels the wait. */
export function whenUncovered(whenClear: () => void) {
  if (!covered) {
    whenClear();
    return () => {};
  }
  waiting.add(whenClear);
  return () => {
    waiting.delete(whenClear);
  };
}
