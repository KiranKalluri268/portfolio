import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "../proxy";
import {
  DEFAULT_PRESENTATION,
  JOURNEY_BLOCKED_COOKIE,
  PRESENTATION_COOKIE,
} from "@/lib/presentation";

/**
 * Which of the two presentations a request is served.
 *
 * Worth testing here rather than in a browser because the decision is made
 * before any page renders — by the time something is on screen the answer has
 * already been given, and the interesting cases are the ones where it is given
 * wrongly. Chiefly one: a visitor whose stored preference is the cinematic, on a
 * device that cannot render it. Without the session cookie the scene sets on its
 * way out, `/` sends them to `/cinematic`, the scene gives up and sends them to
 * `/`, and that is not a fallback, it is a loop.
 */

const ORIGIN = "https://saikirankalluri.dev";

function request(path: string, cookies: Record<string, string> = {}) {
  const req = new NextRequest(new URL(path, ORIGIN));
  for (const [name, value] of Object.entries(cookies)) {
    req.cookies.set(name, value);
  }
  return req;
}

/** Where a response sends you, or null if it lets the request through. */
function redirectTarget(response: Response) {
  const location = response.headers.get("location");
  if (!location) return null;
  const url = new URL(location, ORIGIN);
  return url.pathname + url.search;
}

describe("routing a visitor to their presentation", () => {
  it("leaves a first-time visitor on the presentation the site ships", async () => {
    const response = await proxy(request("/"));

    expect(redirectTarget(response)).toBeNull();
    // The default is plain while the cinematic has one section scored against
    // it. §6 wants this flipped eventually; this is the line that flips.
    expect(DEFAULT_PRESENTATION).toBe("plain");
  });

  it("sends a visitor who chose the cinematic to it from the front door", async () => {
    const response = await proxy(
      request("/", { [PRESENTATION_COOKIE]: "cinematic" }),
    );

    expect(redirectTarget(response)).toBe("/cinematic");
  });

  it("does not redirect away from /cinematic just because the cookie says plain", async () => {
    // Arriving at a specific address is a choice too. The two front doors are
    // asymmetric on purpose: `/` answers to the preference, `/cinematic` does
    // not, or a shared link to the journey would never once show the journey.
    const response = await proxy(
      request("/cinematic", { [PRESENTATION_COOKIE]: "plain" }),
    );

    expect(redirectTarget(response)).toBeNull();
  });

  it("does not send a device that failed the journey back into it", async () => {
    // The loop this whole session cookie exists to prevent.
    const response = await proxy(
      request("/", {
        [PRESENTATION_COOKIE]: "cinematic",
        [JOURNEY_BLOCKED_COOKIE]: "1",
      }),
    );

    expect(redirectTarget(response)).toBeNull();
  });

  it("gets a failed device off /cinematic if it lands back there", async () => {
    const response = await proxy(
      request("/cinematic", {
        [PRESENTATION_COOKIE]: "cinematic",
        [JOURNEY_BLOCKED_COOKIE]: "1",
      }),
    );

    expect(redirectTarget(response)).toBe("/");
  });

  it("honours an explicit request over the stored preference, and remembers it", async () => {
    const response = await proxy(
      request("/?presentation=plain", { [PRESENTATION_COOKIE]: "cinematic" }),
    );

    // The param is spent on the way: it has been folded into the cookie, and
    // leaving it in the address bar makes a link that keeps overriding later
    // choices for anyone it is shared with.
    expect(redirectTarget(response)).toBe("/");
    expect(response.cookies.get(PRESENTATION_COOKIE)?.value).toBe("plain");
  });

  it("lets an explicit request for the cinematic overrule a failed device", async () => {
    // A phone that was hot, or a browser flag that has since changed, deserves
    // another go — and asking for it by name is how you say so.
    const response = await proxy(
      request("/?presentation=cinematic", { [JOURNEY_BLOCKED_COOKIE]: "1" }),
    );

    expect(redirectTarget(response)).toBe("/cinematic");
    expect(response.cookies.get(PRESENTATION_COOKIE)?.value).toBe("cinematic");
    // Asserted on the header the browser actually receives rather than on the
    // cookie object, because "deleted" is not a state a response can be in: it
    // is an empty value with an expiry in 1970, and that is what has to arrive.
    const cleared = response.headers
      .getSetCookie()
      .find((header) => header.startsWith(`${JOURNEY_BLOCKED_COOKIE}=`));
    expect(cleared).toContain("Expires=Thu, 01 Jan 1970");
  });

  it("carries the rest of the query string across a switch", async () => {
    // ?section= is how the site's own deep links work, and losing it would turn
    // a link to one part of the portfolio into a link to the top of it.
    const response = await proxy(request("/?presentation=plain&section=projects"));

    expect(redirectTarget(response)).toBe("/?section=projects");
  });

  it("ignores a preference it does not recognise", async () => {
    const response = await proxy(
      request("/?presentation=holodeck", { [PRESENTATION_COOKIE]: "vhs" }),
    );

    expect(redirectTarget(response)).toBeNull();
  });

  it("still gates /admin", async () => {
    // The presentation branch sits in front of the admin gate now, so the thing
    // worth checking is that it did not swallow it.
    const response = await proxy(request("/admin"));

    expect(redirectTarget(response)).toBe("/admin/login?from=%2Fadmin");
  });
});
