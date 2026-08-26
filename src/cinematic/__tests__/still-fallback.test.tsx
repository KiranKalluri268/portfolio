// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The three ways a visitor ends up on `still` before the journey ever starts.
 *
 * All of them share one route out: strip the classes the scene owns and hand
 * the visitor back to the presentation the site already ships. Getting that
 * wrong is not a cosmetic failure — `cinematic-journey` makes the document 28
 * screens tall and `cinematic-loading` locks scroll, so a fallback that forgets
 * either leaves someone stranded on an empty page they cannot scroll.
 *
 * Deliberately checked here rather than in a browser: two of the three are
 * decided before the dynamic import, so there is no moment at which page script
 * could observe them.
 */

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const lenis = { scroll: 0, start: vi.fn(), stop: vi.fn(), raf: vi.fn() };
vi.mock("@/context/SmoothScrollContext", () => ({
  useScrollActions: () => ({ lenis }),
}));

const mountCinematic = vi.fn();
vi.mock("../scene/main", () => ({
  mountCinematic: (...args: unknown[]) => mountCinematic(...args),
}));

vi.mock("../cinematic.css", () => ({}));

import CinematicScene from "../CinematicScene";

/** Pretend the browser does or does not honour reduced motion. */
function setReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? reduce : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  })) as unknown as typeof window.matchMedia;
}

/** Pretend the browser does or does not offer WebGL2. */
function setWebGL2(available: boolean) {
  HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation(
    (kind: string) => (kind === "webgl2" && available
      ? { getExtension: () => ({ loseContext: () => {} }) }
      : null),
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

describe("falling back to the still presentation", () => {
  beforeEach(() => {
    replace.mockClear();
    mountCinematic.mockReset();
    mountCinematic.mockResolvedValue(() => {});
    setReducedMotion(false);
    setWebGL2(true);
    document.documentElement.className = "";
  });

  afterEach(() => {
    document.documentElement.className = "";
  });

  it("never starts the journey when reduced motion is asked for", async () => {
    setReducedMotion(true);
    render(<CinematicScene />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    // The point of checking before the import: three.js and ~10MB of texture
    // are not downloaded to a device that was never going to draw with them.
    expect(mountCinematic).not.toHaveBeenCalled();
    expect(document.documentElement.className).not.toContain("cinematic-journey");
  });

  it("never starts the journey without WebGL2", async () => {
    setWebGL2(false);
    render(<CinematicScene />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(mountCinematic).not.toHaveBeenCalled();
  });

  it("does not strand the visitor when the scene throws on the way up", async () => {
    // This used to only log. A throw after the scene had added
    // `cinematic-loading` left scroll locked and a loading overlay frozen at
    // whatever percentage it had reached, on a page 28 screens tall.
    mountCinematic.mockImplementation(() => {
      document.documentElement.classList.add("cinematic-loading");
      return Promise.reject(new Error("shader would not compile"));
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<CinematicScene />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(document.documentElement.className).not.toContain("cinematic-loading");
    expect(document.documentElement.className).not.toContain("cinematic-journey");
    consoleError.mockRestore();
  });

  it("leaves for still when the benchmark says the device cannot cope", async () => {
    const teardown = vi.fn();
    mountCinematic.mockImplementation(
      (_root: unknown, _lenis: unknown, options: { onStill?: (i: { reason: string }) => void }) => {
        // The manager reaches this only before the entry gate.
        queueMicrotask(() => options.onStill?.({ reason: "warmup-below-low" }));
        return Promise.resolve(teardown);
      },
    );

    render(<CinematicScene />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(document.documentElement.className).not.toContain("cinematic-journey");
  });

  it("runs the journey normally when nothing objects", async () => {
    render(<CinematicScene />);

    await waitFor(() => expect(mountCinematic).toHaveBeenCalled());
    expect(replace).not.toHaveBeenCalled();
    expect(document.documentElement.className).toContain("cinematic-journey");
  });
});
