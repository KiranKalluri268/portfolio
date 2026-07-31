import { describe, expect, it } from "vitest";

import {
  assertRecord,
  assertString,
  assertStringArray,
  assertUniqueSlugs,
  readJsonDirectory,
  readJsonFile,
} from "../read-content";

describe("assertRecord", () => {
  it("accepts plain objects", () => {
    expect(() => assertRecord({}, "source")).not.toThrow();
  });

  it.each([null, undefined, "string", 1, [1, 2]])("rejects %p", (value) => {
    expect(() => assertRecord(value, "source")).toThrow('source: expected a JSON object');
  });
});

describe("assertString", () => {
  it("accepts non-empty strings", () => {
    expect(() => assertString("hello", "field", "source")).not.toThrow();
  });

  it.each(["", "   ", 1, null, undefined])("rejects %p", (value) => {
    expect(() => assertString(value, "field", "source")).toThrow(
      'source: "field" must be a non-empty string',
    );
  });
});

describe("assertStringArray", () => {
  it("accepts arrays of strings, including empty arrays", () => {
    expect(() => assertStringArray([], "field", "source")).not.toThrow();
    expect(() => assertStringArray(["a", "b"], "field", "source")).not.toThrow();
  });

  it.each([["a", 1], "not-an-array", null, undefined])("rejects %p", (value) => {
    expect(() => assertStringArray(value, "field", "source")).toThrow(
      'source: "field" must be an array of strings',
    );
  });
});

describe("assertUniqueSlugs", () => {
  it("passes when all slugs are unique", () => {
    expect(() =>
      assertUniqueSlugs([{ slug: "a" }, { slug: "b" }], "collection"),
    ).not.toThrow();
  });

  it("throws on the first duplicate slug", () => {
    expect(() =>
      assertUniqueSlugs([{ slug: "a" }, { slug: "b" }, { slug: "a" }], "collection"),
    ).toThrow('collection: duplicate slug "a"');
  });
});

describe("readJsonFile", () => {
  it("parses a real data file relative to src/data", () => {
    const { source, value } = readJsonFile("skill-categories.json");
    expect(source).toBe("skill-categories.json");
    expect(Array.isArray(value)).toBe(true);
  });

  it("throws a descriptive error for a missing file", () => {
    expect(() => readJsonFile("does-not-exist.json")).toThrow();
  });
});

describe("readJsonDirectory", () => {
  it("reads every JSON file in a data subdirectory, sorted by name", () => {
    const entries = readJsonDirectory("skills");
    expect(entries.length).toBeGreaterThan(0);
    const names = entries.map((entry) => entry.source);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    for (const entry of entries) {
      expect(entry.source.startsWith("skills/")).toBe(true);
      expect(entry.value).not.toBeNull();
    }
  });
});
