/**
 * Which of the two presentations a visitor gets, and how that is remembered.
 *
 * `CINEMATIC_DECISION.md` §2 keeps this deliberately separate from the tier
 * ladder: presentation is the visitor's choice, tier is the device's verdict,
 * and welding them means a mid-range phone gets a structurally different
 * portfolio because of its graphics chip. That split is the reason there are two
 * cookies here rather than one, and it is the only reason - see
 * JOURNEY_BLOCKED_COOKIE below.
 *
 * Everything in this file is pure and runs in three places that cannot share
 * much else: the proxy (Next 16's renamed middleware, which runs before any page
 * and may be deployed to a CDN, so it can rely on nothing shared), the menu
 * control (browser, no `next/headers`), and the tests. So it holds vocabulary
 * and decisions, and nothing that reads or writes anything.
 */

/** The two presentations. There are exactly two, on purpose - one per tier is
 *  five sites, and five sites is not a design that can be maintained. */
export const PRESENTATIONS = ["plain", "cinematic"] as const;

export type Presentation = (typeof PRESENTATIONS)[number];

/**
 * What the front door serves.
 *
 * §6 says default silently to cinematic, and that is still the intent - but the
 * cinematic presentation is currently a flight with one section scored against
 * it, so defaulting to it now would hand a stranger 28 screens of mostly
 * nothing. Until it carries the portfolio, `/` is the plain site for everyone:
 * not a preference that can be overridden by a cookie, but the address itself.
 * The journey is reachable by asking for it - see MODE_ROUTE. This flips when
 * there is a portfolio in there, and the test named after it is the reminder.
 */
export const DEFAULT_PRESENTATION: Presentation = "plain";

/** The visitor's choice, kept between visits. */
export const PRESENTATION_COOKIE = "presentation";

/**
 * This device could not run the journey *this visit*.
 *
 * Session-scoped and deliberately a different cookie from the choice above. When
 * the scene falls back to `still` - reduced motion, no WebGL2, a throw, or a
 * benchmark that cannot hold 20fps - something has to stop the proxy from
 * bouncing the visitor straight back to `/cinematic`, which without this is an
 * outright redirect loop.
 *
 * The lazy fix is to rewrite the preference to `plain`. That is exactly the
 * welding §2 forbids: a hardware verdict silently overwriting a choice a person
 * made. So the choice is left alone and this records the verdict beside it. Ask
 * for the journey again explicitly and it is cleared - a device that was hot, or
 * a browser flag that changed, deserves another go.
 */
export const JOURNEY_BLOCKED_COOKIE = "journey-unavailable";

/**
 * An explicit request, in the URL.
 *
 * The rule the deep-linking work already established: an explicit request
 * outranks a stored preference. `?presentation=plain` gets you the plain site
 * whatever the cookie says, and updates the cookie, because typing it or
 * following a link that carries it is a choice too.
 */
export const PRESENTATION_PARAM = "presentation";

/**
 * The door that asks for the journey.
 *
 * `/mode?mode=3d` is the only way into the cinematic that a stranger can arrive
 * through by accident, and arriving through it is a request to have the device
 * decide: capable browsers get the flight, everything else lands on the plain
 * site the moment the scene's own ladder says so. `/` deliberately does not do
 * this - an unfinished journey behind the site's own address is a stranger
 * seeing nothing at all.
 */
export const MODE_ROUTE = "/mode";

/** The query the mode door reads. */
export const MODE_PARAM = "mode";

/** The one value that means "give me the journey if this device can hold it".
 *  Compared case-insensitively: `?mode=3D` is what gets typed and shared. */
export const CINEMATIC_MODE = "3d";

/** A year. Long enough to be a preference rather than a session, short enough
 *  that a choice made once and forgotten does not follow someone forever. */
export const PRESENTATION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** The route each presentation is served from. Two URLs for one portfolio is a
 *  real cost, taken knowingly: the journey owns scroll for its whole length and
 *  cannot yet share a document with sections that have their own ideas about
 *  scrolling. */
export const PRESENTATION_ROUTES: Record<Presentation, string> = {
  plain: "/",
  cinematic: "/cinematic",
};

/** Narrows an untrusted string - a cookie, a query param - to a presentation.
 *  Returns null rather than the default, so callers can tell "they asked for
 *  something I do not recognise" from "they asked for nothing". */
export function parsePresentation(value: string | null | undefined): Presentation | null {
  return PRESENTATIONS.includes(value as Presentation) ? (value as Presentation) : null;
}

/** Which presentation this request should be served, given what it carries.
 *  Explicit beats stored beats default, and that order is the whole rule. */
export function resolvePresentation({
  requested,
  stored,
}: {
  requested?: string | null;
  stored?: string | null;
}): Presentation {
  return parsePresentation(requested) ?? parsePresentation(stored) ?? DEFAULT_PRESENTATION;
}
