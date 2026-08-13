/** Putting a screen's state in the URL, so it can be shared.
 *
 * Most of the site is already deep-linkable, because most of it is routes: a
 * project, a skill, a role and the résumé are all pages. What was not shareable
 * was the state *inside* a page — which of two views the projects and skills
 * pages were showing, which answer the FAQ had open, which section of the home
 * page you were looking at. This is the small amount of plumbing those need.
 *
 * Query parameters rather than path segments. `/projects/[slug]` and
 * `/skills/[slug]` already own everything after their own name, so
 * `/projects/list` would work only by shadowing a project slugged "list" —
 * quietly, and for as long as the slug existed.
 */

/** Reads a parameter from the address bar.
 *
 * `window.location` rather than `useSearchParams`, deliberately: the hook opts
 * a page out of static rendering unless it is wrapped in Suspense, and every
 * page using this is otherwise static. Nothing here needs to re-render when the
 * parameter changes — it is read once on arrival — so the hook buys nothing. */
export function readParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

/** Reads a parameter and checks it against what the screen actually supports.
 *  A shared link with a stale or invented value falls back to the default
 *  rather than putting the page into a state it has no rendering for. */
export function readOneOf<T extends string>(name: string, allowed: readonly T[]): T | null {
  const value = readParam(name);
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/** Writes a parameter without telling the router.
 *
 * `history.replaceState`, not `router.replace`: the router re-renders the route,
 * which on these pages means tearing through a WebGL scene's React tree for a
 * change the scene does not care about. Replace rather than push, so the back
 * button leaves the page rather than walking back through every view the
 * visitor tried.
 *
 * Passing null removes the parameter, which is what a screen in its default
 * state should do — a URL that says nothing is the tidier thing to copy. */
export function writeParam(name: string, value: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (value === null) url.searchParams.delete(name);
  else url.searchParams.set(name, value);
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (next === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
  window.history.replaceState(window.history.state, "", next);
}
