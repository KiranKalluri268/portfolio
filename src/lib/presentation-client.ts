"use client";

import {
  JOURNEY_BLOCKED_COOKIE,
  PRESENTATION_COOKIE,
  PRESENTATION_MAX_AGE_SECONDS,
  type Presentation,
} from "./presentation";

/**
 * Writing the two presentation cookies from the browser.
 *
 * `document.cookie` rather than a server action or a route handler, because
 * neither of the two callers is doing anything a round trip would help with: the
 * menu is about to navigate anyway, and the scene's fallback is racing a
 * redirect it must win. A server action would put a network request between the
 * decision and the navigation that reads it, which is exactly the ordering bug
 * this has to avoid.
 *
 * Neither cookie is a secret and neither is read for authorisation - the admin
 * gate is the only thing on this site that does that, and it uses a signed
 * token. These say which of two layouts to draw. `SameSite=Lax` so following a
 * link from elsewhere still carries the choice, which is the point of storing
 * it.
 */

function writeCookie(name: string, value: string, maxAgeSeconds: number | null) {
  const age = maxAgeSeconds === null ? "" : `; Max-Age=${maxAgeSeconds}`;
  // Secure is conditional rather than always on: on http://localhost the browser
  // silently drops a Secure cookie, and a preference that never persists in
  // development is a bug that only shows up in production.
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; Path=/${age}; SameSite=Lax${secure}`;
}

/** Remember which presentation this visitor wants. Choosing the cinematic also
 *  clears the "this device could not run it" mark, since asking for it by name
 *  is a request to try again. */
export function rememberPresentation(presentation: Presentation) {
  writeCookie(PRESENTATION_COOKIE, presentation, PRESENTATION_MAX_AGE_SECONDS);
  if (presentation === "cinematic") {
    writeCookie(JOURNEY_BLOCKED_COOKIE, "", 0);
  }
}

/**
 * Record that the journey cannot run here, for this visit only.
 *
 * Session-scoped, and pointedly not a change to the stored preference. The
 * visitor's choice is theirs; this is the device reporting a verdict, and the
 * two are kept apart so that a hot phone or a browser flag never quietly
 * rewrites something a person chose.
 */
export function markJourneyUnavailable() {
  writeCookie(JOURNEY_BLOCKED_COOKIE, "1", null);
}

/** Read the stored choice on the client. The middleware has usually acted on
 *  this already; the menu needs it to show which option is current. */
export function readStoredPresentation(): string | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${PRESENTATION_COOKIE}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}
