/**
 * Display label for the `watchedWith` field, which varies by media
 * type (see chat, Sept 2026 — "Watched With" for Film/TV/Anime/
 * Theatre/Art/Sport, "Listened With" for Audiobook/Podcast, "Read
 * With" for Book/Comic/Manga/Magazine, "Played With" for Game). The
 * field itself is always the same `watchedWith` array underneath —
 * only what it's called in the UI changes. Any media type not listed
 * here (a user-created custom type, or a future built-in one) falls
 * back to "Watched With" as a sensible default.
 *
 * `recommendedBy` deliberately has no equivalent mapping — "who
 * recommended it" doesn't depend on how the entry is consumed, so it
 * always reads "Recommended By" everywhere.
 *
 * The Library filter chips and BulkActionBar's bulk-edit buttons use
 * fixed generic labels ("Watched With" / "Recommended By") rather than
 * this mapping, since both operate across mixed media types at once.
 */
const WATCHED_WITH_LABEL_BY_MEDIA_TYPE: Record<string, string> = {
  film: 'Watched With',
  tv: 'Watched With',
  anime: 'Watched With',
  theatre: 'Watched With',
  art: 'Watched With',
  sport: 'Watched With',
  audiobook: 'Listened With',
  podcast: 'Listened With',
  book: 'Read With',
  comic: 'Read With',
  manga: 'Read With',
  magazine: 'Read With',
  game: 'Played With',
};

const DEFAULT_WATCHED_WITH_LABEL = 'Watched With';

/** Returns the per-media-type label for the `watchedWith` field —
 * "Watched With", "Listened With", "Read With", or "Played With". */
export function watchedWithLabel(mediaTypeId: string): string {
  return WATCHED_WITH_LABEL_BY_MEDIA_TYPE[mediaTypeId] ?? DEFAULT_WATCHED_WITH_LABEL;
}

/** Fixed label for `recommendedBy` — never varies by media type. */
export const RECOMMENDED_BY_LABEL = 'Recommended By';
