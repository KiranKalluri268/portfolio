// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PaperReveal from "../PaperReveal";
import { revealProps, REVEAL_LEAD_IN_MS, RESUME_STEP_MS, CV_STEP_MS, CV_PAGE_GAP_MS } from "../paper-reveal";

/** jsdom has no font loading, so `document.fonts.ready` has to be supplied or
 *  the reveal never starts. */
function stubFonts(ready = Promise.resolve()) {
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready },
  });
}

function matchReducedMotion(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("reduced-motion") ? matches : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function Document() {
  return (
    <PaperReveal>
      <p {...revealProps(0)}>first</p>
      <p {...revealProps(140)}>second</p>
    </PaperReveal>
  );
}

describe("PaperReveal", () => {
  beforeEach(() => {
    stubFonts();
    matchReducedMotion(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders blank paper first, so the sheet is seen as a sheet", () => {
    const { container } = render(<Document />);
    // The state the server sends: the writing is there in the document, and
    // the CSS class is what holds it back.
    expect(container.querySelector(".paper-blank")).not.toBeNull();
    expect(container.querySelector(".paper-writing")).toBeNull();
  });

  it("starts writing once nothing is covering the page and the fonts have landed", async () => {
    const { container } = render(<Document />);
    await waitFor(() => expect(container.querySelector(".paper-writing")).not.toBeNull());
    expect(container.querySelector(".paper-blank")).toBeNull();
  });

  it("waits for the fonts rather than writing and then reflowing", async () => {
    let land: () => void = () => {};
    stubFonts(new Promise<void>((resolve) => { land = resolve; }));
    const { container } = render(<Document />);

    // Nothing yet: text that fades in and then jumps when the webfont arrives
    // is worse than text that simply appears.
    await Promise.resolve();
    expect(container.querySelector(".paper-writing")).toBeNull();

    land();
    await waitFor(() => expect(container.querySelector(".paper-writing")).not.toBeNull());
  });

  it("is already done under reduced motion, with no blank frame at all", () => {
    matchReducedMotion(true);
    const { container } = render(<Document />);
    expect(container.querySelector(".paper-blank")).toBeNull();
    expect(container.querySelector(".paper-writing")).toBeNull();
  });

  it("finishes at once when the reader scrolls", async () => {
    const { container } = render(<Document />);
    await waitFor(() => expect(container.querySelector(".paper-writing")).not.toBeNull());

    // Someone scrolling is reading, and the rest of the page is blank paper
    // below them.
    window.dispatchEvent(new Event("wheel"));

    await waitFor(() => {
      expect(container.querySelector(".paper-writing")).toBeNull();
      expect(container.querySelector(".paper-blank")).toBeNull();
    });
  });

  it("ships a noscript rule so a reader without JavaScript is not handed blank paper", () => {
    const { container } = render(<Document />);
    const noscript = container.querySelector("noscript");
    expect(noscript).not.toBeNull();
    expect(noscript!.textContent).toContain(".paper-blank [data-reveal]");
    expect(noscript!.textContent).toContain("opacity:1");
  });

  it("adds no box of its own, so no layout depends on it", () => {
    const { container } = render(<Document />);
    const wrapper = container.querySelector(".paper-blank") as HTMLElement;
    expect(wrapper.style.display).toBe("contents");
  });

  it("keeps the writing out of the accessibility tree's way", () => {
    render(<Document />);
    // Hidden by opacity, never by `display` or `hidden` — the text of a résumé
    // has to stay in the document for screen readers and crawlers.
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
  });
});

describe("reveal schedule", () => {
  it("gives each piece a later delay than the one before it", () => {
    const résumé = [0, 1, 2, 3].map((i) => REVEAL_LEAD_IN_MS + i * RESUME_STEP_MS);
    expect(résumé).toEqual([...résumé].sort((a, b) => a - b));
    expect(new Set(résumé).size).toBe(résumé.length);
  });

  it("holds the CV back a beat at every page break", () => {
    // Two blocks that are adjacent in the document but land on different
    // sheets must be further apart than two on the same sheet.
    const sameSheet = (REVEAL_LEAD_IN_MS + 5 * CV_STEP_MS + 0 * CV_PAGE_GAP_MS)
      - (REVEAL_LEAD_IN_MS + 4 * CV_STEP_MS + 0 * CV_PAGE_GAP_MS);
    const acrossBreak = (REVEAL_LEAD_IN_MS + 5 * CV_STEP_MS + 1 * CV_PAGE_GAP_MS)
      - (REVEAL_LEAD_IN_MS + 4 * CV_STEP_MS + 0 * CV_PAGE_GAP_MS);
    expect(acrossBreak).toBeGreaterThan(sameSheet);
  });

  it("carries the delay on the piece rather than on the mechanism", () => {
    const props = revealProps(320);
    expect(props["data-reveal"]).toBe("");
    expect(props.style).toMatchObject({ "--reveal-delay": "320ms" });
  });

  it("steps the CV faster than the résumé, because it has four times the pieces", () => {
    expect(CV_STEP_MS).toBeLessThan(RESUME_STEP_MS);
  });
});
