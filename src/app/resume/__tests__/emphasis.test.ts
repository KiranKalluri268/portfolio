import { describe, expect, it } from "vitest";

import { plainText, splitEmphasis } from "../emphasis";

describe("splitEmphasis", () => {
  it("leaves plain text as one run", () => {
    expect(splitEmphasis("Built a platform.")).toEqual([{ text: "Built a platform.", bold: false }]);
  });

  it("sets **…** in bold", () => {
    expect(splitEmphasis("cutting it to **under 30 seconds**.")).toEqual([
      { text: "cutting it to ", bold: false },
      { text: "under 30 seconds", bold: true },
      { text: ".", bold: false },
    ]);
  });

  it("turns [text](url) into a linked run", () => {
    expect(splitEmphasis("a platform ([HealthyMitra](/projects/healthymitra)) with")).toEqual([
      { text: "a platform (", bold: false },
      { text: "HealthyMitra", bold: false, href: "/projects/healthymitra" },
      { text: ") with", bold: false },
    ]);
  });

  it("keeps bold and links apart in one bullet", () => {
    expect(splitEmphasis("**94.25%** accuracy; published in [IJNTI](https://example.com/p?id=1).")).toEqual([
      { text: "94.25%", bold: true },
      { text: " accuracy; published in ", bold: false },
      { text: "IJNTI", bold: false, href: "https://example.com/p?id=1" },
      { text: ".", bold: false },
    ]);
  });

  it("leaves brackets that are not a link alone", () => {
    expect(splitEmphasis("Deep Learning [CNN] (ResNet)")).toEqual([
      { text: "Deep Learning [CNN] (ResNet)", bold: false },
    ]);
  });
});

describe("plainText", () => {
  it("drops both kinds of marker", () => {
    expect(plainText("**3x** faster ([Digichikitsak](/projects/digichikitsak))")).toBe(
      "3x faster (Digichikitsak)",
    );
  });
});
