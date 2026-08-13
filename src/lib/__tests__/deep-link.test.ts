// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { readOneOf, readParam, writeParam } from "../deep-link";

const VIEWS = ["grid", "list"] as const;

function at(search: string) {
  window.history.replaceState(null, "", `/projects${search}`);
}

describe("readParam", () => {
  beforeEach(() => at(""));

  it("reads a parameter that is there", () => {
    at("?view=list");
    expect(readParam("view")).toBe("list");
  });

  it("returns null rather than a guess when it is not", () => {
    expect(readParam("view")).toBeNull();
  });
});

describe("readOneOf", () => {
  beforeEach(() => at(""));

  it("accepts a value the screen can actually render", () => {
    at("?view=list");
    expect(readOneOf("view", VIEWS)).toBe("list");
  });

  it("refuses one it cannot", () => {
    // A stale or hand-edited link should fall back to the default rather than
    // put the page into a state it has no rendering for.
    at("?view=banana");
    expect(readOneOf("view", VIEWS)).toBeNull();
  });

  it("refuses an empty value", () => {
    at("?view=");
    expect(readOneOf("view", VIEWS)).toBeNull();
  });
});

describe("writeParam", () => {
  beforeEach(() => at(""));

  it("names the state in the address bar", () => {
    writeParam("view", "list");
    expect(window.location.search).toBe("?view=list");
  });

  it("replaces rather than stacks, so back leaves the page", () => {
    const before = window.history.length;
    writeParam("view", "list");
    writeParam("view", "grid");
    expect(window.location.search).toBe("?view=grid");
    expect(window.history.length).toBe(before);
  });

  it("clears the parameter when the screen returns to its default", () => {
    writeParam("view", "list");
    writeParam("view", null);
    // A URL that says nothing is the tidier thing to copy.
    expect(window.location.search).toBe("");
  });

  it("leaves other parameters alone", () => {
    at("?q=availability");
    writeParam("view", "list");
    expect(new URLSearchParams(window.location.search).get("q")).toBe("availability");
    expect(new URLSearchParams(window.location.search).get("view")).toBe("list");
  });

  it("keeps the path and the hash", () => {
    window.history.replaceState(null, "", "/faq#somewhere");
    writeParam("q", "availability");
    expect(window.location.pathname).toBe("/faq");
    expect(window.location.hash).toBe("#somewhere");
  });
});
