import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, isValidSessionToken } from "@/lib/admin/session";
import {
  CINEMATIC_MODE,
  JOURNEY_BLOCKED_COOKIE,
  MODE_PARAM,
  MODE_ROUTE,
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

/** Sends a request on to `destination`, carrying every query it arrived with
 *  except the one that was spent making the decision. */
function redirectTo(request: NextRequest, destination: string, spentParam: string) {
  const url = new URL(destination, request.url);
  request.nextUrl.searchParams.forEach((value, key) => {
    if (key !== spentParam) url.searchParams.set(key, value);
  });
  return NextResponse.redirect(url);
}

/**
 * The door that asks for the journey: `/mode?mode=3d`.
 *
 * A page of its own would have to be a client component that probes the device
 * and then navigates, which is a blank screen and a second navigation to answer
 * a question `/cinematic` already answers on arrival. So this only routes: the
 * scene's own ladder — reduced motion, WebGL2, then a benchmark it has to hold
 * 20fps through — is the device check, and it lands anyone it turns away on the
 * plain site. Asking here always clears the "this device could not" mark, since
 * coming through this door is a request to try the device again.
 *
 * Any other value is the plain site, including no value at all. There is one
 * mode worth naming and a typo should not strand anyone.
 */
function routeMode(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get(MODE_PARAM)?.trim().toLowerCase();
  const wantsJourney = requested === CINEMATIC_MODE;

  const response = redirectTo(
    request,
    wantsJourney ? PRESENTATION_ROUTES.cinematic : PRESENTATION_ROUTES.plain,
    MODE_PARAM,
  );
  response.cookies.set(PRESENTATION_COOKIE, wantsJourney ? "cinematic" : "plain", {
    path: "/",
    maxAge: PRESENTATION_MAX_AGE_SECONDS,
    sameSite: "lax",
  });
  if (wantsJourney) response.cookies.delete(JOURNEY_BLOCKED_COOKIE);
  return response;
}

/**
 * Sends a visitor to the presentation they asked for.
 *
 * The two front doors are asymmetric on purpose, and no longer symmetric in the
 * direction they used to be. `/` is the site's address and now always serves the
 * plain site: the journey is one section long, and a stored preference that
 * promotes `/` to it hands a returning visitor — or anyone following a link to
 * the site — 28 screens of mostly nothing. `/cinematic` is a specific place, so
 * arriving there is taken at face value; only an explicit `?presentation=plain`
 * or a device that has already failed the journey moves you off it.
 *
 * Done here rather than in the page so that `/` stays statically generated. A
 * `cookies()` read in the home page would make every request to the busiest
 * route on the site dynamic, to answer a question that is nearly always "no".
 */
function routePresentation(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  const requested = parsePresentation(searchParams.get(PRESENTATION_PARAM));
  // Set by the scene on its way out to `still`. Without it, a link straight to
  // `/cinematic` sends a device that cannot render it back into the route it
  // just escaped, forever.
  const blocked = request.cookies.get(JOURNEY_BLOCKED_COOKIE)?.value === "1";

  if (requested) {
    // An explicit ask is honoured and remembered, and the param is spent on the
    // way — it has been folded into the cookie, so leaving it in the address bar
    // would only make a stale link that keeps overriding later choices.
    const response = redirectTo(request, PRESENTATION_ROUTES[requested], PRESENTATION_PARAM);
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

  if (blocked && pathname === PRESENTATION_ROUTES.cinematic) {
    // Nothing to decide: this device has already told us how the journey ends.
    return NextResponse.redirect(new URL(PRESENTATION_ROUTES.plain, request.url));
  }

  return NextResponse.next();
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    return gateAdmin(request);
  }

  if (pathname === MODE_ROUTE) {
    return routeMode(request);
  }

  return routePresentation(request);
}

export const config = {
  matcher: [
    "/",
    "/cinematic",
    "/mode",
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
