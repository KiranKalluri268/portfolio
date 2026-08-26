// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import hero from "@/data/hero.json";

/**
 * The one rule §3 of CINEMATIC_DECISION.md does not bend: content must exist as
 * real markup in both presentations, not only as pixels inside a canvas.
 *
 * Crawlers, screen readers and anyone tabbing through the page all read the DOM.
 * The temptation on a route like this is enormous — there is already a WebGL
 * surface filling the screen, and drawing the name into it would look better and
 * cost less. It would also make the name invisible to all three.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/context/SmoothScrollContext", () => ({
  useScrollActions: () => ({ lenis: null }),
}));
vi.mock("../scene/main", () => ({ mountCinematic: vi.fn() }));
vi.mock("../cinematic.css", () => ({}));
vi.mock("@/lib/presentation-client", () => ({ markJourneyUnavailable: vi.fn() }));

import CinematicScene from "../CinematicScene";

describe("the hero, in the cinematic presentation", () => {
  it("puts every fact in the DOM as text", () => {
    // Lenis is null here, so the scene never mounts. That is the point: this is
    // the server-rendered markup, before a single frame of WebGL exists.
    render(<CinematicScene />);

    expect(screen.getByText(hero.name)).toBeTruthy();
    expect(screen.getByText(hero.namePrefix)).toBeTruthy();
    for (const role of hero.roles) {
      expect(screen.getByText(role)).toBeTruthy();
    }
  });

  it("gives the page one heading, and it is the visitor's name", () => {
    render(<CinematicScene />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toContain(hero.name);
  });

  it("does not fork the copy", () => {
    // Both presentations import this file. The assertion is not that the strings
    // are equal — it is that there is one place they could have been changed,
    // and it is not inside a component.
    expect(hero.roles.length).toBeGreaterThan(0);
    for (const role of hero.roles) {
      // Stored as the job title. The plain hero's trailing "..." is a typing
      // affordance it adds itself, and if it creeps back in here it is read
      // aloud as part of the title.
      expect(role.endsWith(".")).toBe(false);
    }
  });
});
