import "server-only";

import { assertRecord, assertString, assertStringArray, assertUniqueSlugs, readJsonDirectory } from "./read-content";
import type { PublicationContent } from "./types";

export function validatePublication(value: unknown, source: string): PublicationContent {
  assertRecord(value, source);

  for (const field of ["slug", "title", "selfAuthor", "venue", "date", "url"]) {
    assertString(value[field], field, source);
  }
  for (const field of ["venueShort", "volume", "issue", "issn", "paperId", "relatedProject"]) {
    if (value[field] !== undefined) assertString(value[field], field, source);
  }
  assertStringArray(value.authors, "authors", source);
  // The bold name is matched against the author list, so a typo in either
  // would silently print the citation with nobody highlighted.
  if (!(value.authors as string[]).includes(value.selfAuthor as string)) {
    throw new Error(`${source}: "selfAuthor" must be one of "authors"`);
  }
  if (typeof value.showInResume !== "boolean" || typeof value.showInResumeAi !== "boolean") {
    throw new Error(`${source}: visibility fields must be booleans`);
  }

  return value as unknown as PublicationContent;
}

let publicationCache: PublicationContent[] | undefined;

/** Every publication, in file-name order. */
export function getAllPublications(): PublicationContent[] {
  if (!publicationCache) {
    publicationCache = readJsonDirectory("publications").map(({ source, value }) =>
      validatePublication(value, source),
    );
    assertUniqueSlugs(publicationCache, "publications");
  }
  return publicationCache;
}

export function getPublicationsForProject(projectSlug: string): PublicationContent[] {
  return getAllPublications().filter((publication) => publication.relatedProject === projectSlug);
}

/** "Vol. 4, Issue 4" — whichever of the two the paper has. */
export function formatVolumeIssue(publication: PublicationContent) {
  return [
    publication.volume && `Vol. ${publication.volume}`,
    publication.issue && `Issue ${publication.issue}`,
  ]
    .filter(Boolean)
    .join(", ");
}
