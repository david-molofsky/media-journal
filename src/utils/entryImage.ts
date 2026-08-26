import type { MediaEntry } from '@/models';

/** TMDB's hosted image CDN. Two sizes in use:
 * - `thumb` (w92) — the small ~44px-wide list row thumbnail (EntryCard),
 *   crisp at up to 2x device pixel ratio.
 * - `poster` (w342) — the larger ~120×180 share-card poster (both the
 *   in-app preview and the exported/shared PNG, see chat). Requested
 *   once at a size that stays sharp when the canvas export scales it
 *   up further, rather than adding a third TMDB size for that case. */
const TMDB_IMAGE_BASE: Record<EntryImageSize, string> = {
  thumb: 'https://image.tmdb.org/t/p/w92',
  poster: 'https://image.tmdb.org/t/p/w342',
};

export type EntryImageSize = 'thumb' | 'poster';

/** Turns a raw TMDB `posterPath` path fragment (e.g. "/abc123.jpg")
 * into a complete, standalone, hosted URL at the given size. Exported
 * separately from getEntryImageUrl below so entryConversion.ts's
 * Convert step can produce a real, storable URL for a target media
 * type that only understands `coverImagePath` (a complete URL) and
 * has no `posterPath` field of its own — see the comment there. */
export function resolvePosterPathUrl(
  posterPath: string,
  size: EntryImageSize = 'poster',
): string {
  return `${TMDB_IMAGE_BASE[size]}${posterPath}`;
}

/**
 * Resolves the poster/cover image URL for an entry, if it has one (see
 * chat — replacing EntryCard's icon with a poster thumbnail, later
 * extended to the share card). Reads whatever's already stored on the
 * entry rather than checking any settings toggle — the "Poster
 * image"/"Cover image" auto-fill toggles in Settings just control
 * whether *new* entries get one of these fields populated in the
 * first place.
 *
 * - `posterPath` (Film/TV, via TMDB) is a path fragment, not a full
 *   URL — same convention as EntryForm.tsx's poster preview. `size`
 *   picks which TMDB width to request.
 * - `coverImagePath` (Comics/Anime/Manga) is already a complete,
 *   hosted URL — used as-is, `size` has no effect on it.
 *
 * Returns undefined if neither field is set, in which case the caller
 * falls back to the existing media-type icon / text-only layout.
 */
export function getEntryImageUrl(
  entry: MediaEntry,
  size: EntryImageSize = 'thumb',
): string | undefined {
  const posterPath = entry.metadata.posterPath;
  if (typeof posterPath === 'string' && posterPath) {
    return resolvePosterPathUrl(posterPath, size);
  }

  const coverImagePath = entry.metadata.coverImagePath;
  if (typeof coverImagePath === 'string' && coverImagePath) {
    return coverImagePath;
  }

  return undefined;
}
