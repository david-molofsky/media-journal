/** Media types with a metadata search source (Open Library or TMDB). */
const SEARCHABLE_MEDIA_TYPES = new Set(['book', 'audiobook', 'film', 'tv', 'comic']);

/** Whether a given media type has a metadata search source available.
 * Used by EntryForm to decide whether autofocus goes on the search box
 * (when true) or falls back to the Title field (when false — e.g.
 * Magazine, Games, Podcasts, Art, Theatre have no search source).
 * Kept in its own file, separate from MetadataSearch.tsx, so that
 * component file can stay component-only for Fast Refresh. */
export function hasMetadataSearch(mediaTypeId: string): boolean {
  return SEARCHABLE_MEDIA_TYPES.has(mediaTypeId);
}
