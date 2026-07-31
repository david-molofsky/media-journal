import type { MediaEntry } from '@/models';

/** TMDB's hosted image CDN, sized for a small ~44px-wide list thumbnail
 * (w92 gives a crisp result at up to 2x device pixel ratio). */
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w92';

/**
 * Resolves the poster/cover thumbnail URL for an entry, if it has one
 * (see chat — replacing EntryCard's icon with a poster thumbnail).
 * Reads whatever's already stored on the entry rather than checking
 * any settings toggle — the "Poster image"/"Cover image" auto-fill
 * toggles in Settings just control whether *new* entries get one of
 * these fields populated in the first place.
 *
 * - `posterPath` (Film/TV, via TMDB) is a path fragment, not a full
 *   URL — same convention as EntryForm.tsx's poster preview.
 * - `coverImagePath` (Comics/Anime/Manga) is already a complete,
 *   hosted URL — used as-is.
 *
 * Returns undefined if neither field is set, in which case the caller
 * falls back to the existing media-type icon.
 */
export function getEntryImageUrl(entry: MediaEntry): string | undefined {
  const posterPath = entry.metadata.posterPath;
  if (typeof posterPath === 'string' && posterPath) {
    return `${TMDB_IMAGE_BASE}${posterPath}`;
  }

  const coverImagePath = entry.metadata.coverImagePath;
  if (typeof coverImagePath === 'string' && coverImagePath) {
    return coverImagePath;
  }

  return undefined;
}
