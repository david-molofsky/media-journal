/**
 * Builds the "imported from {source}" tag applied to every entry
 * created by an external import (Letterboxd, IMDb, Goodreads,
 * StoryGraph, MyAnimeList, Trakt, Netflix, Amazon Prime Video).
 * Deliberately excludes plain JSON import/export — that's a
 * backup/restore of the library, not an import "from" an external
 * source in this sense.
 *
 * Lowercased to match TagInput's own auto-lowercase-on-commit
 * convention (see TagInput.tsx), so a manually-typed tag and this
 * generated one always dedupe/filter consistently.
 */
export function importedFromTag(sourceName: string): string {
  return `imported from ${sourceName.toLowerCase()}`;
}
