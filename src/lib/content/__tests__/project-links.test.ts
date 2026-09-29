import { describe, expect, it } from "vitest";
import { getProjectActionLinks } from "../project-links";

describe("getProjectActionLinks", () => {
  it("shows landing and app destinations together and suppresses the fallback", () => {
    expect(getProjectActionLinks({
      landingPageUrl: "https://example.com",
      appUrl: "https://app.example.com",
      liveUrl: "https://old.example.com",
    })).toEqual([
      { label: "Landing page", url: "https://example.com" },
      { label: "Open app", url: "https://app.example.com" },
    ]);
  });

  it("uses the live link only when landing and app links are absent", () => {
    expect(getProjectActionLinks({ landingPageUrl: null, appUrl: null, liveUrl: "https://example.com" }))
      .toEqual([{ label: "Live project", url: "https://example.com" }]);
    expect(getProjectActionLinks({ landingPageUrl: "https://example.com", appUrl: null, liveUrl: "https://old.example.com" }))
      .toEqual([{ label: "Landing page", url: "https://example.com" }]);
    expect(getProjectActionLinks({ landingPageUrl: null, appUrl: null, liveUrl: null })).toEqual([]);
  });
});
