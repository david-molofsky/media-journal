import { fieldRolesFor } from './entryConversion';
import type { MediaEntry, MetadataValue } from '@/models';

/**
 * "More From Your Wishlist" — scores a source entry (any status)
 * against the user's own Wishlist entries only (see chat), using
 * genre/tag overlap plus creator and series/franchise matches (via
 * entryConversion's field-role map, so it works across media types —
 * e.g. a Film's director and a TV show's creator both count as
 * 'creator'). No external API; purely the user's own logged data.
 *
 * Weights: creator match and series match are strong signals (+2
 * each); each shared genre or tag is a weaker signal (+1 each).
 * "imported from {source}" tags are excluded from tag matching since
 * they reflect import provenance, not genuine similarity.
 *
 * Multi-point-of-connection hierarchy (see chat): a candidate must
 * match at least 2 distinct categories (creator/series/genre/tag) —
 * OR 2+ items within a single genre-or-tag category — to qualify at
 * all. A single shared genre, or a single creator match, is not
 * enough on its own. Creator/series are binary and can never satisfy
 * the "2+ items in one category" path alone.
 *
 * Fallback (see chat): if nothing on the Wishlist clears that 2+ bar,
 * single-point matches (one shared genre, or same creator alone) are
 * shown instead of returning nothing — the strict rule only applies
 * when it doesn't starve the section entirely.
 *
 * Ranking is two-tier: distinct-category count is the primary sort
 * (matching 2 categories always outranks matching only 1, regardless
 * of raw score), with the existing weighted score used as the
 * tiebreaker within the same category-count tier. This is what makes
 * e.g. a horror+fantasy film rank below a comedy+fantasy film when
 * only "fantasy" is shared, once anything with a second point of
 * connection is on the list.
 */

const IMPORTED_TAG_PREFIX = 'imported from ';
const DEFAULT_LIMIT = 5;

export interface WishlistRecommendation {
  entry: MediaEntry;
  score: number;
  /** Number of distinct categories matched (creator/series/genre/tag),
   * out of a max of 4. Primary sort key — see chat. */
  categoryMatches: number;
  reason: string;
}

/** Internal shape used before the strict-vs-fallback split — same
 * fields as WishlistRecommendation, since fallback candidates are
 * just the ones that didn't clear the strict bar. */
type ScoredCandidate = WishlistRecommendation;

function normalizeValue(value: MetadataValue): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : undefined;
}

function creatorKeyFor(mediaTypeId: string): string | undefined {
  return Object.entries(fieldRolesFor(mediaTypeId)).find(([, role]) => role === 'creator')?.[0];
}

function seriesKeyFor(mediaTypeId: string): string | undefined {
  return Object.entries(fieldRolesFor(mediaTypeId)).find(([, role]) => role === 'series')?.[0];
}

/** Case-insensitive de-dupe that preserves the *source* entry's
 * original casing for display (e.g. "Sci-Fi" rather than "sci-fi"). */
function overlapWithOriginalCasing(sourceList: string[], candidateList: string[]): string[] {
  const candidateNormalized = new Set(candidateList.map((v) => v.trim().toLowerCase()));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of sourceList) {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    if (candidateNormalized.has(normalized)) {
      seen.add(normalized);
      result.push(value.trim());
    }
  }
  return result;
}

function formatList(items: string[], max = 3): string {
  if (items.length <= max) return items.join(', ');
  return `${items.slice(0, max).join(', ')} +${items.length - max} more`;
}

function stripImportedTags(tags: string[] | undefined): string[] {
  return (tags ?? []).filter((t) => !t.trim().toLowerCase().startsWith(IMPORTED_TAG_PREFIX));
}

/** Minimum items required within a single category for that category
 * alone to qualify a candidate (see chat — "2+ shared genres" rule).
 * Only applies to genre/tag; creator/series are binary. */
const SOLO_CATEGORY_QUALIFYING_COUNT = 2;

export function getWishlistRecommendations(
  sourceEntry: MediaEntry,
  wishlistEntries: MediaEntry[],
  limit: number = DEFAULT_LIMIT,
): WishlistRecommendation[] {
  const sourceCreatorKey = creatorKeyFor(sourceEntry.mediaType);
  const sourceSeriesKey = seriesKeyFor(sourceEntry.mediaType);
  const sourceCreator = sourceCreatorKey ? normalizeValue(sourceEntry.metadata[sourceCreatorKey]) : undefined;
  const sourceSeries = sourceSeriesKey ? normalizeValue(sourceEntry.metadata[sourceSeriesKey]) : undefined;
  const sourceGenres = sourceEntry.genres ?? [];
  const sourceTags = stripImportedTags(sourceEntry.tags);
  const sourceTitleKey = sourceEntry.title.trim().toLowerCase();

  const strictResults: ScoredCandidate[] = [];
  const anyMatchResults: ScoredCandidate[] = [];

  for (const candidate of wishlistEntries) {
    if (candidate.id === sourceEntry.id) continue;
    // Same title likely means "another copy/volume of this exact
    // thing" — already surfaced by Edit Entry's "Previous Entries
    // with This Title" list, so skip it here to avoid a redundant
    // recommendation.
    if (candidate.title.trim().toLowerCase() === sourceTitleKey) continue;

    let score = 0;
    let categoryMatches = 0;
    const reasons: { priority: number; text: string }[] = [];

    const candidateCreatorKey = creatorKeyFor(candidate.mediaType);
    const candidateSeriesKey = seriesKeyFor(candidate.mediaType);
    const candidateCreatorRaw = candidateCreatorKey ? candidate.metadata[candidateCreatorKey] : undefined;
    const candidateSeriesRaw = candidateSeriesKey ? candidate.metadata[candidateSeriesKey] : undefined;
    const candidateCreator = normalizeValue(candidateCreatorRaw);
    const candidateSeries = normalizeValue(candidateSeriesRaw);

    if (sourceCreator && candidateCreator && sourceCreator === candidateCreator) {
      score += 2;
      categoryMatches += 1;
      reasons.push({ priority: 1, text: `Same creator — ${candidateCreatorRaw}` });
    }
    if (sourceSeries && candidateSeries && sourceSeries === candidateSeries) {
      score += 2;
      categoryMatches += 1;
      reasons.push({ priority: 2, text: `Same series — ${candidateSeriesRaw}` });
    }

    const genreMatches = overlapWithOriginalCasing(sourceGenres, candidate.genres ?? []);
    if (genreMatches.length > 0) {
      score += genreMatches.length;
      categoryMatches += 1;
      reasons.push({ priority: 3, text: `Shared genres: ${formatList(genreMatches)}` });
    }

    const tagMatches = overlapWithOriginalCasing(sourceTags, stripImportedTags(candidate.tags));
    if (tagMatches.length > 0) {
      score += tagMatches.length;
      categoryMatches += 1;
      reasons.push({ priority: 4, text: `Shared tags: ${formatList(tagMatches)}` });
    }

    if (categoryMatches === 0) continue;

    reasons.sort((a, b) => a.priority - b.priority);
    const combinedReason = reasons.map((r) => r.text).join(' · ') || 'Similar to this';
    const scored: ScoredCandidate = { entry: candidate, score, categoryMatches, reason: combinedReason };

    // Multi-point-of-connection gate (see chat): needs 2+ distinct
    // categories, OR 2+ items within genre/tag alone. A lone creator
    // or series match, or a single shared genre/tag, doesn't qualify
    // for the strict list — but every match (including single-point
    // ones) is kept as a fallback in case the strict list ends up
    // empty.
    const soloCategoryQualifies =
      categoryMatches === 1 &&
      (genreMatches.length >= SOLO_CATEGORY_QUALIFYING_COUNT || tagMatches.length >= SOLO_CATEGORY_QUALIFYING_COUNT);
    const qualifiesStrict = categoryMatches >= 2 || soloCategoryQualifies;

    anyMatchResults.push(scored);
    if (qualifiesStrict) strictResults.push(scored);
  }

  // Distinct-category count is the primary sort: matching 2
  // categories always outranks matching only 1, even if the
  // single-category candidate has a higher raw score (see chat).
  const rank = (list: ScoredCandidate[]) =>
    list.sort((a, b) => b.categoryMatches - a.categoryMatches || b.score - a.score);

  // Fallback (see chat): only relax to single-point matches when the
  // Wishlist has nothing that clears the 2+ bar at all.
  const results = strictResults.length > 0 ? rank(strictResults) : rank(anyMatchResults);
  return results.slice(0, limit);
}
