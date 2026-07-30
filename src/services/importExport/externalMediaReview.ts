/**
 * Shared review-step types for the ID-first external imports —
 * Jellyfin, Plex, and Audiobookshelf. Unlike the streaming CSV imports
 * (Netflix/Amazon, see streamingImportShared.ts) where every row needs
 * a title search, these three sources usually hand back a direct id
 * (TMDB/IMDb via ProviderIds or Guid, ISBN/ASIN, or an Open Library
 * work key) — a title/author search is only needed as a fallback when
 * no id is present or it doesn't resolve. This module holds the
 * common shape; each source's own *ImportService.ts owns fetching and
 * turning its API's response into this shape, and ExternalImportReviewPanel
 * renders it generically.
 */

export interface ExternalReviewCandidate {
  id: string;
  title: string;
  subtitle?: string;
}

export type ExternalMatchStatus = 'matched' | 'ambiguous' | 'none' | 'duplicate';

export interface ExternalReviewItem {
  /** Stable key for React lists and toggling — the source's own item id. */
  key: string;
  title: string;
  /** Author, season label, etc. — shown under the title. */
  subtitle?: string;
  mediaType: string;
  status: ExternalMatchStatus;
  /** Populated when status is 'ambiguous' (more than one plausible
   * fuzzy match) — 'matched' items already know their id via
   * `selectedCandidateId` without needing this list shown. */
  candidates: ExternalReviewCandidate[];
  selectedCandidateId?: string;
  /** ISO date this entry should be saved with (finished/last-played date). */
  date: string;
  /** Tick state — defaults to true for everything except 'duplicate'. */
  included: boolean;
  /**
   * Audiobookshelf-only: present when file format and library
   * disagree on Book vs Audiobook, letting the person pick per item
   * (see MetadataSearch-adjacent chat decision). Absent for
   * Jellyfin/Plex, where mediaType is never ambiguous.
   */
  typeChoice?: {
    options: { value: string; label: string }[];
    selected: string;
  };
}

/** Splits ticked/matched items from everything else, for the review
 * screen's summary line ("14 items ready"). Duplicates are always
 * excluded from the list entirely by the source's fetch step, so
 * every item here is either matched, ambiguous, or unmatched. */
export function countIncluded(items: ExternalReviewItem[]): number {
  return items.filter((item) => item.included).length;
}

/**
 * Fallback title-search match, used when a source item has no usable
 * direct id (no ISBN, no ProviderIds/Guid entry, etc.) — same
 * single-exact-match-auto-resolves heuristic as streamingImportShared's
 * matchTitle, generalised to any of the app's existing search
 * functions (searchBooks, searchFilms, searchTV all return a
 * structurally-compatible SearchResult[]).
 */
export async function fuzzyMatchTitle(
  title: string,
  search: (query: string) => Promise<{ id: string; title: string; subtitle?: string }[]>,
): Promise<{
  status: 'matched' | 'ambiguous' | 'none';
  candidates: ExternalReviewCandidate[];
  selectedCandidateId?: string;
}> {
  const results = await search(title);
  if (results.length === 0) return { status: 'none', candidates: [] };

  const norm = title.trim().toLowerCase();
  const exact = results.filter((r) => r.title.trim().toLowerCase() === norm);
  const candidates = results.slice(0, 5).map((r) => ({ id: r.id, title: r.title, subtitle: r.subtitle }));

  if (exact.length === 1) {
    return { status: 'matched', candidates, selectedCandidateId: exact[0]!.id };
  }
  return { status: 'ambiguous', candidates, selectedCandidateId: candidates[0]?.id };
}
