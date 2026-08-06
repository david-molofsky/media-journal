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
 */

const IMPORTED_TAG_PREFIX = 'imported from ';
const DEFAULT_LIMIT = 5;

export interface WishlistRecommendation {
  entry: MediaEntry;
  score: number;
  reason: string;
}

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

  const results: WishlistRecommendation[] = [];

  for (const candidate of wishlistEntries) {
    if (candidate.id === sourceEntry.id) continue;
    // Same title likely means "another copy/volume of this exact
    // thing" — already surfaced by Edit Entry's "Previous Entries
    // with This Title" list, so skip it here to avoid a redundant
    // recommendation.
    if (candidate.title.trim().toLowerCase() === sourceTitleKey) continue;

    let score = 0;
    const reasons: { priority: number; text: string }[] = [];

    const candidateCreatorKey = creatorKeyFor(candidate.mediaType);
    const candidateSeriesKey = seriesKeyFor(candidate.mediaType);
    const candidateCreatorRaw = candidateCreatorKey ? candidate.metadata[candidateCreatorKey] : undefined;
    const candidateSeriesRaw = candidateSeriesKey ? candidate.metadata[candidateSeriesKey] : undefined;
    const candidateCreator = normalizeValue(candidateCreatorRaw);
    const candidateSeries = normalizeValue(candidateSeriesRaw);

    if (sourceCreator && candidateCreator && sourceCreator === candidateCreator) {
      score += 2;
      reasons.push({ priority: 1, text: `Same creator — ${candidateCreatorRaw}` });
    }
    if (sourceSeries && candidateSeries && sourceSeries === candidateSeries) {
      score += 2;
      reasons.push({ priority: 2, text: `Same series — ${candidateSeriesRaw}` });
    }

    const genreMatches = overlapWithOriginalCasing(sourceGenres, candidate.genres ?? []);
    if (genreMatches.length > 0) {
      score += genreMatches.length;
      reasons.push({ priority: 3, text: `Shared genres: ${formatList(genreMatches)}` });
    }

    const tagMatches = overlapWithOriginalCasing(sourceTags, stripImportedTags(candidate.tags));
    if (tagMatches.length > 0) {
      score += tagMatches.length;
      reasons.push({ priority: 4, text: `Shared tags: ${formatList(tagMatches)}` });
    }

    if (score === 0) continue;

    reasons.sort((a, b) => a.priority - b.priority);
    results.push({ entry: candidate, score, reason: reasons[0]?.text ?? 'Similar to this' });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
