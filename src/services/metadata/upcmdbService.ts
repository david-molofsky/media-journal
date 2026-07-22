/**
 * UPC barcode lookup for Films, via UPCMDB (https://upcmdb.com).
 *
 * UPCMDB's API key is account-tied (unlike TMDB's public read token)
 * so — same pattern as ComicVine — it must be proxied through the
 * Cloudflare Worker rather than called directly from the browser. See
 * upc-worker-routes.js for the Worker-side route this calls.
 *
 * Flow: UPC -> Worker -> UPCMDB -> imdbID -> TMDB /find -> movieId ->
 * TMDB movie details. Going through TMDB (rather than using UPCMDB's
 * own title/year/director fields directly) keeps this consistent with
 * every other metadata source in the app — same field mapping, same
 * genre normalisation, same auto-fill settings, same poster handling.
 */

import type { SearchResult } from './openLibraryService';
import { findByImdbId, getFilmDetails } from './tmdbService';

const WORKER_BASE = 'https://media-journal-comicvine-proxy.david-molofsky.workers.dev';

export type UpcLookupResult =
  | { status: 'found'; result: SearchResult }
  /** UPCMDB has no record of this UPC (its 404). Common for less
   * common editions, box sets, or region variants. */
  | { status: 'not-found' }
  /** UPCMDB matched the UPC to an IMDb id, but that title couldn't be
   * found on TMDB. Rare, but distinct from "not-found" so the message
   * can say what actually happened. */
  | { status: 'tmdb-not-found' }
  /** Anything else — quota exceeded (429), auth failure (401/403),
   * network error. Not actionable by the user beyond "try again" or
   * "enter manually", so these are collapsed into one status rather
   * than surfaced individually. */
  | { status: 'service-error' };

interface UpcmdbRecord {
  upc: string;
  title: string;
  year?: number;
  imdbID?: string;
  director?: string;
}

/**
 * Looks up a scanned UPC via the Worker proxy, then cross-references
 * the resulting IMDb id against TMDB for full, app-consistent metadata.
 */
export async function lookupFilmByUpc(upc: string): Promise<UpcLookupResult> {
  let record: UpcmdbRecord;
  try {
    const res = await fetch(`${WORKER_BASE}/upcmdb/${encodeURIComponent(upc)}`);
    if (res.status === 404) return { status: 'not-found' };
    if (!res.ok) return { status: 'service-error' };
    record = (await res.json()) as UpcmdbRecord;
  } catch {
    return { status: 'service-error' };
  }

  if (!record.imdbID) return { status: 'not-found' };

  let movieId: string | undefined;
  try {
    const found = await findByImdbId(record.imdbID);
    movieId = found.movieId;
  } catch {
    return { status: 'service-error' };
  }
  if (!movieId) return { status: 'tmdb-not-found' };

  try {
    const { fields, genres } = await getFilmDetails(movieId);
    const year = record.year ? String(record.year) : '';
    const subtitleParts = [year, fields['director'] ? `Directed by ${fields['director']}` : '']
      .filter(Boolean);

    return {
      status: 'found',
      result: {
        id: movieId,
        title: record.title,
        subtitle: subtitleParts.join(' · '),
        fields,
        genres,
      },
    };
  } catch {
    return { status: 'service-error' };
  }
}
