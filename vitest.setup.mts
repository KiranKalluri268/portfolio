import "@testing-library/jest-dom/vitest";

import { afterEach } from "vitest";

// jsdom does not implement matchMedia, so any component that asks about the
// pointer or reduced motion throws on render. Report the defaults a plain
// desktop browser would: a fine pointer, hover available, motion allowed.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

afterEach(async () => {
  if (typeof document === "undefined") return;
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});
