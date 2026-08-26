// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The switch, in the place §6 of CINEMATIC_DECISION.md puts it.
 *
 * Not in the entry screen — that screen asks for a press-and-hold and a settings
 * panel in the middle of it costs more than the control gains. In the menu,
 * where it is reachable *during* the experience: someone twenty minutes into a
 * warm phone should be able to leave without hunting for a reload.
 */

const push = vi.fn();
let pathname = "/";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname,
}));

vi.mock("@/context/SmoothScrollContext", () => ({
  useScrollActions: () => ({ lenis: null }),
}));

vi.mock("@/hooks/useMediaQuery", () => ({ useReducedMotion: () => true }));

vi.mock("../navigation-cover", () => ({
  dropCoverIn: vi.fn(),
  raiseCover: vi.fn(),
}));

vi.mock("../../page-scroll-lock", () => ({ lockPageScroll: () => () => {} }));

const rememberPresentation = vi.fn();
vi.mock("@/lib/presentation-client", () => ({
  rememberPresentation: (value: string) => rememberPresentation(value),
  readStoredPresentation: () => storedPresentation,
}));

let storedPresentation: string | null = null;

import SiteMenu from "../SiteMenu";

/** The switch only exists once the menu is open. */
function openMenu() {
  render(<SiteMenu />);
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
}

describe("the presentation switch", () => {
  beforeEach(() => {
    push.mockClear();
    rememberPresentation.mockClear();
    pathname = "/";
    storedPresentation = null;
    document.body.innerHTML = "";
  });

  it("shows the plain presentation as current for a first-time visitor", async () => {
    openMenu();

    const plain = await screen.findByRole("button", { name: /Plain/ });
    expect(plain.getAttribute("aria-pressed")).toBe("true");
  });

  it("reports the route you are on, not the cookie, while you are on it", async () => {
    // Arriving at /cinematic by URL is a choice. A switch that says "Plain"
    // while a black hole fills the screen behind it is not reporting state, it
    // is arguing with the visitor.
    pathname = "/cinematic";
    storedPresentation = "plain";
    openMenu();

    const cinematic = await screen.findByRole("button", { name: /Cinematic/ });
    expect(cinematic.getAttribute("aria-pressed")).toBe("true");
  });

  it("remembers the choice and goes there", async () => {
    openMenu();
    fireEvent.click(await screen.findByRole("button", { name: /Cinematic/ }));

    expect(rememberPresentation).toHaveBeenCalledWith("cinematic");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/cinematic"));
  });

  it("remembers the choice from a sub-route without dragging you off the page", async () => {
    // Switching presentation is not a request to leave what you are reading.
    // /projects is /projects either way, and the choice takes effect next time
    // you go home.
    pathname = "/projects";
    openMenu();
    fireEvent.click(await screen.findByRole("button", { name: /Cinematic/ }));

    expect(rememberPresentation).toHaveBeenCalledWith("cinematic");
    expect(push).not.toHaveBeenCalled();
  });

  it("does not navigate to the presentation you are already in", async () => {
    storedPresentation = "plain";
    openMenu();
    fireEvent.click(await screen.findByRole("button", { name: /Plain/ }));

    expect(push).not.toHaveBeenCalled();
  });

  it("keeps the destinations reachable", async () => {
    // The switch was added below the six destinations, and the panel's flex
    // direction had to change to fit it. Cheap insurance that it did not land
    // on top of them.
    openMenu();

    expect(await screen.findByRole("link", { name: /Projects/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Résumé/ })).toBeTruthy();
  });
});
