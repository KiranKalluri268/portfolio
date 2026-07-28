import "server-only";

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const DATA_DIRECTORY = path.join(process.cwd(), "src", "data");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertRecord(value: unknown, source: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${source}: expected a JSON object`);
}

export function assertString(
  value: unknown,
  field: string,
  source: string,
): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${source}: "${field}" must be a non-empty string`);
  }
}

export function assertStringArray(
  value: unknown,
  field: string,
  source: string,
): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${source}: "${field}" must be an array of strings`);
  }
}

export function readJsonDirectory(folder: string): Array<{ source: string; value: unknown }> {
  const directory = path.join(DATA_DIRECTORY, folder);
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const source = `${folder}/${entry.name}`;
      const contents = readFileSync(path.join(directory, entry.name), "utf8");
      try {
        return { source, value: JSON.parse(contents) as unknown };
      } catch (error) {
        throw new Error(`${source}: invalid JSON`, { cause: error });
      }
    });
}

export function assertUniqueSlugs(
  entries: Array<{ slug: string }>,
  collectionName: string,
) {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.slug)) {
      throw new Error(`${collectionName}: duplicate slug "${entry.slug}"`);
    }
    seen.add(entry.slug);
  }
}
