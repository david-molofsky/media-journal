import { searchBooks } from './openLibraryService';
import { searchFilms, getFilmDetails, searchTV, getTVDetails } from './tmdbService';
import { searchSeries, getIssueDetails } from './comicVineService';
import { fieldRolesFor } from '@/utils/entryConversion';
import { hasMetadataSearch } from '@/utils/metadataSearchSupport';

/**
 * "Re-search" (Edit Entry, see chat Aug 2026) re-uses the exact same
 * per-type search + detail-fetch calls MetadataSearch.tsx uses on
 * manual selection, so it's only available for the same five types
 * that have a search source at all: book, audiobook, film, tv, comic.
 */
export const hasReSearch = hasMetadataSearch;

/** Display label for the source Re-search will query — shown in the
 * confirm dialog's subtitle (ReSearchDialog). */
export function reSearchSourceLabel(mediaTypeId: string): string {
  if (mediaTypeId === 'book' || mediaTypeId === 'audiobook') return 'Open Library';
  if (mediaTypeId === 'comic') return 'ComicVine';
  return 'TMDB';
}

export interface ReSearchResult {
  title: string;
  fields: Record<string, string>;
  genres?: string[];
}

/**
 * Builds a search query from the entry's current title plus its
 * 'creator' role field (author/director/writer — see
 * entryConversion.ts's fieldRolesFor), then takes the top result as
 * the presumed match and fetches its full details exactly the way
 * MetadataSearch's onFill selection does.
 *
 * Comics are a special case, same as MetadataSearch: they search by
 * series name (the 'series' role field) rather than title, and — when
 * a volume id comes back and an issue number is already on the entry
 * (the 'unitStart' role field) — immediately follow up with an
 * issue-level fetch too, mirroring the "Fetch issue details" button
 * EntryForm already has further down the form.
 *
 * Returns null when nothing was found, so the caller can show "no
 * match found" rather than a false "already up to date".
 */
export async function reSearchEntry(
  mediaTypeId: string,
  title: string,
  metadata: Record<string, unknown>,
): Promise<ReSearchResult | null> {
  const roles = fieldRolesFor(mediaTypeId);
  const creatorKey = Object.entries(roles).find(([, role]) => role === 'creator')?.[0];
  const creatorValue = creatorKey ? metadata[creatorKey] : undefined;

  if (mediaTypeId === 'comic') {
    const seriesKey = Object.entries(roles).find(([, role]) => role === 'series')?.[0];
    const seriesValue = seriesKey ? (metadata[seriesKey] as string | undefined) : undefined;
    const results = await searchSeries(seriesValue || title);
    const top = results[0];
    if (!top) return null;

    const volumeId = top.fields.comicVineVolumeId;
    const unitStartKey = Object.entries(roles).find(([, role]) => role === 'unitStart')?.[0];
    const issueNumber = unitStartKey ? metadata[unitStartKey] : undefined;
    if (volumeId && (typeof issueNumber === 'number' || typeof issueNumber === 'string')) {
      const issueDetail = await getIssueDetails(volumeId, String(issueNumber));
      return { title: top.title, fields: { ...top.fields, ...issueDetail.fields } };
    }
    return { title: top.title, fields: top.fields, genres: top.genres };
  }

  const query = creatorValue ? `${title} ${creatorValue}` : title;
  const searchFn =
    mediaTypeId === 'book' || mediaTypeId === 'audiobook'
      ? searchBooks
      : mediaTypeId === 'film'
        ? searchFilms
        : mediaTypeId === 'tv'
          ? searchTV
          : null;
  if (!searchFn) return null;

  const results = await searchFn(query);
  const top = results[0];
  if (!top) return null;

  // Open Library results already carry every field in one call; TMDB
  // results need a second call for director/cast/creator/genres —
  // same split as MetadataSearch's fetchDetails.
  if (Object.keys(top.fields).length > 0) {
    return { title: top.title, fields: top.fields, genres: top.genres };
  }
  if (mediaTypeId === 'film') {
    const detail = await getFilmDetails(top.id);
    return { title: top.title, fields: detail.fields, genres: detail.genres };
  }
  if (mediaTypeId === 'tv') {
    const detail = await getTVDetails(top.id);
    return { title: top.title, fields: detail.fields, genres: detail.genres };
  }
  return { title: top.title, fields: {} };
}
