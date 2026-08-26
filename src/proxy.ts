import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, isValidSessionToken } from "@/lib/admin/session";
import {
  DEFAULT_PRESENTATION,
  JOURNEY_BLOCKED_COOKIE,
  PRESENTATION_COOKIE,
  PRESENTATION_MAX_AGE_SECONDS,
  PRESENTATION_PARAM,
  PRESENTATION_ROUTES,
  parsePresentation,
} from "@/lib/presentation";

/** Gates every /admin route behind a signed session cookie. The login page
 *  and its own API route are the only paths under /admin* left open, since
 *  they're how the cookie gets set in the first place. */
async function gateAdmin(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (await isValidSessionToken(token)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

/**
 * Sends a visitor to the presentation they chose.
 *
 * The two front doors are asymmetric on purpose. `/` is the site's address and
 * answers to the stored preference — that is the entire point of storing one.
 * `/cinematic` is a specific place, so arriving there is taken at face value and
 * is not redirected away by a preference; only an explicit `?presentation=plain`
 * or a device that has already failed the journey moves you off it.
 *
 * Done here rather than in the page so that `/` stays statically generated. A
 * `cookies()` read in the home page would make every request to the busiest
 * route on the site dynamic, to answer a question that is nearly always "no".
 */
function routePresentation(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  const requested = parsePresentation(searchParams.get(PRESENTATION_PARAM));
  const stored = parsePresentation(request.cookies.get(PRESENTATION_COOKIE)?.value);
  // Set by the scene on its way out to `still`. Without it, a stored preference
  // for the cinematic sends a device that cannot render it straight back into
  // the route it just escaped, forever.
  const blocked = request.cookies.get(JOURNEY_BLOCKED_COOKIE)?.value === "1";

  if (requested) {
    // An explicit ask is honoured and remembered, and the param is spent on the
    // way — it has been folded into the cookie, so leaving it in the address bar
    // would only make a stale link that keeps overriding later choices.
    const destination = new URL(PRESENTATION_ROUTES[requested], request.url);
    searchParams.forEach((value, key) => {
      if (key !== PRESENTATION_PARAM) destination.searchParams.set(key, value);
    });

    const response = NextResponse.redirect(destination);
    response.cookies.set(PRESENTATION_COOKIE, requested, {
      path: "/",
      maxAge: PRESENTATION_MAX_AGE_SECONDS,
      sameSite: "lax",
    });
    // Asking for the journey by name is reason enough to try again. The phone
    // may have cooled down, or the browser flag that refused WebGL2 may be off.
    if (requested === "cinematic") {
      response.cookies.delete(JOURNEY_BLOCKED_COOKIE);
    }
    return response;
  }

  if (blocked) {
    // Nothing to decide: this device has already told us how the journey ends.
    return pathname === PRESENTATION_ROUTES.plain
      ? NextResponse.next()
      : NextResponse.redirect(new URL(PRESENTATION_ROUTES.plain, request.url));
  }

  const preference = stored ?? DEFAULT_PRESENTATION;
  if (pathname === PRESENTATION_ROUTES.plain && preference === "cinematic") {
    const destination = new URL(PRESENTATION_ROUTES.cinematic, request.url);
    searchParams.forEach((value, key) => destination.searchParams.set(key, value));
    return NextResponse.redirect(destination);
  }

  return NextResponse.next();
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    return gateAdmin(request);
  }

  return routePresentation(request);
}

export const config = {
  matcher: [
    "/",
    "/cinematic",
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
