/**
 * Open Library metadata lookup for books and audiobooks.
 * No API key required — completely free and open.
 * https://openlibrary.org/developers/api
 */

import { getSetting } from '@/services/database/settingsService';

export interface SearchResult {
  id: string;
  title: string;
  /** Short descriptor shown in the dropdown — e.g. "Cormac McCarthy · 2006" */
  subtitle: string;
  /** Fields to pre-fill in the entry form on selection. */
  fields: Record<string, string>;
  /** Best-effort genre guesses, from Open Library's community-tagged
   * `subject` field. Only present when `ENABLE_OPENLIBRARY_GENRES` is
   * true. Unlike TMDB's genres, these are noisy (mixed in with
   * non-genre tags) — David is trying this out and may switch it off. */
  genres?: string[];
}

const BASE = 'https://openlibrary.org';
/** Open Library's dedicated image CDN — separate host from the main
 * API, same pattern as TMDB's image.tmdb.org. `-M.jpg` (medium) is
 * used throughout, matching the size ComicVine's `medium_url` already
 * gives EntryForm's cover preview. */
const COVERS_BASE = 'https://covers.openlibrary.org/b';

/** Toggle for Open Library's best-effort genre auto-fill. Open
 * Library's `subject` field is community-tagged rather than a clean
 * genre taxonomy (real genres mixed in with things like
 * "Nyt:hardcover-fiction=2023-01-15"), so this is a single flag to
 * flip off if it turns out to be more noise than it's worth — no need
 * to rip the feature out, just flip this to `false`. */
const ENABLE_OPENLIBRARY_GENRES = true;

/** How many raw `subject` entries to take as genre guesses. Kept small
 * since later entries in Open Library's subject list tend to get more
 * obscure/tag-like rather than more genre-like. */
const OPENLIBRARY_GENRE_LIMIT = 5;

/** How long to wait for Open Library's search before giving up. Open
 * Library's own infra has documented periods of Solr-backend slowness
 * where requests just hang rather than erroring (see chat) — without
 * this, the search box's loading spinner would spin indefinitely with
 * no way out. 8 seconds, per David's call. */
const SEARCH_TIMEOUT_MS = 8000;

/** Thrown specifically when the 8s timeout above fires, so
 * MetadataSearch.tsx can show a distinct "Open Library isn't
 * responding" message rather than the generic "No results found" it
 * shows for a normal empty/failed search. */
export class OpenLibraryTimeoutError extends Error {
  constructor() {
    super('Open Library search timed out');
    this.name = 'OpenLibraryTimeoutError';
  }
}

/**
 * Searches Open Library by title and returns up to 6 results.
 * All metadata is returned in a single call (no second fetch on
 * selection) because the search endpoint supports field projection.
 */
export async function searchBooks(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const params = new URLSearchParams({
    title: query,
    limit: '15',
    fields: `key,title,author_name,series,first_publish_year,editions,cover_i${ENABLE_OPENLIBRARY_GENRES ? ',subject' : ''}`,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${BASE}/search.json?${params.toString()}`, { signal: controller.signal });
  } catch (err) {
    // `abort()` makes fetch reject with a DOMException named
    // 'AbortError' — checking the controller's own flag (rather than
    // the error shape) distinguishes "we timed out" from any other
    // network failure, which should still surface as a normal error.
    if (controller.signal.aborted) throw new OpenLibraryTimeoutError();
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) throw new Error(`Open Library search failed: ${res.status}`);

  const data = await res.json() as {
    docs: Array<{
      key: string;
      title: string;
      author_name?: string[];
      series?: string[];
      first_publish_year?: number;
      subject?: string[];
      cover_i?: number;
    }>;
  };

  // One read for the whole result set — same convention as
  // comicVineService.searchSeries reading its publisher toggle once
  // before mapping every result.
  const autofillCoverImage = await getSetting('autofillBookCoverImage', true);
  const autofillReleaseYear = await getSetting('autofillBookReleaseYear', true);

  return data.docs.map((doc) => {
    const author = doc.author_name?.[0] ?? '';
    const series = doc.series?.[0] ?? '';
    const year = doc.first_publish_year ? String(doc.first_publish_year) : '';

    const subtitleParts = [author, year].filter(Boolean);
    if (series) subtitleParts.push(`${series} series`);

    const fields: Record<string, string> = {};
    if (author) fields['author'] = author;
    if (series) fields['series'] = series;
    if (autofillCoverImage && doc.cover_i) {
      fields['coverImagePath'] = `${COVERS_BASE}/id/${doc.cover_i}-M.jpg`;
    }
    // Year-only, unlike TMDB's full releaseDate on Film/TV — Open
    // Library's search index only gives first_publish_year, already
    // computed above for the subtitle.
    if (autofillReleaseYear && year) fields['releaseYear'] = year;

    const genres = ENABLE_OPENLIBRARY_GENRES && doc.subject?.length
      ? doc.subject.slice(0, OPENLIBRARY_GENRE_LIMIT)
      : undefined;

    return {
      id: doc.key,
      title: doc.title,
      subtitle: subtitleParts.join(' · '),
      fields,
      genres,
    };
  });
}

interface OpenLibraryWork {
  title: string;
  authors?: { author: { key: string } }[];
  subjects?: string[];
  /** Cover ids, first-is-primary — same id space as search's
   * `cover_i`, both resolved via COVERS_BASE. */
  covers?: number[];
}

interface OpenLibraryAuthor {
  name: string;
}

/**
 * Fetches a book's title, author and genre guesses directly from an
 * Open Library work key (e.g. "/works/OL45804W" — the `id` searchBooks
 * returns). Used by the "add via shared link" flow: unlike the normal
 * search-and-select flow, there's no SearchResult to draw fields from
 * at that point, only the key from the URL. Two calls: the work
 * record, then its first author's name (Open Library only exposes an
 * author *key* on the work itself, not the name).
 *
 * Deliberately narrower than searchBooks' fields — no `series`, since
 * that comes from Open Library's search index projection, not the raw
 * work record. Author lookup failure doesn't fail the whole fetch;
 * title/genres still come through with author left blank.
 */
export async function getBookDetailsByKey(
  key: string,
): Promise<{ title: string; fields: Record<string, string>; genres?: string[] }> {
  const res = await fetch(`${BASE}${key}.json`);
  if (!res.ok) throw new Error(`Open Library work lookup failed: ${res.status}`);
  const work = (await res.json()) as OpenLibraryWork;

  const fields: Record<string, string> = {};
  const authorKey = work.authors?.[0]?.author?.key;
  if (authorKey) {
    try {
      const authorRes = await fetch(`${BASE}${authorKey}.json`);
      if (authorRes.ok) {
        const author = (await authorRes.json()) as OpenLibraryAuthor;
        if (author.name) fields['author'] = author.name;
      }
    } catch {
      // Author name is a nice-to-have; leave the field blank rather
      // than failing the whole shared-link fetch over it.
    }
  }

  if (await getSetting('autofillBookCoverImage', true)) {
    const coverId = work.covers?.find((id) => id > 0); // -1 marks "no cover"
    if (coverId) fields['coverImagePath'] = `${COVERS_BASE}/id/${coverId}-M.jpg`;
  }

  const genres =
    ENABLE_OPENLIBRARY_GENRES && work.subjects?.length
      ? work.subjects.slice(0, OPENLIBRARY_GENRE_LIMIT)
      : undefined;

  return { title: work.title, fields, genres };
}

interface OpenLibraryBookRecord {
  title: string;
  authors?: { name: string }[];
  publishers?: { name: string }[];
  subjects?: { name: string }[];
  cover?: { medium?: string; large?: string };
}

/**
 * Direct ISBN lookup for barcode scanning — one call, no title search
 * involved. Uses Open Library's Books API (bibkeys) rather than the
 * /isbn/{isbn}.json edition endpoint, since the Books API returns
 * author names directly; the edition endpoint only returns author
 * *keys*, which would need a second fetch per author to resolve to a
 * name. Returns null if Open Library has no record for this ISBN
 * (common for less common editions, or if a UPC was accidentally read
 * as if it were an ISBN — see IsbnScanDialog.tsx).
 */
export async function lookupByIsbn(isbn: string): Promise<SearchResult | null> {
  const params = new URLSearchParams({
    bibkeys: `ISBN:${isbn}`,
    format: 'json',
    jscmd: 'data',
  });
  const res = await fetch(`${BASE}/api/books?${params.toString()}`);
  if (!res.ok) throw new Error(`Open Library ISBN lookup failed: ${res.status}`);

  const data = (await res.json()) as Record<string, OpenLibraryBookRecord>;
  const record = data[`ISBN:${isbn}`];
  if (!record) return null;

  const author = record.authors?.[0]?.name ?? '';
  const fields: Record<string, string> = {};
  if (author) fields['author'] = author;
  // Unlike searchBooks/getBookDetailsByKey (which resolve a cover id
  // into a URL themselves), the Books API hands back a ready-made
  // hosted URL directly — used as-is, no COVERS_BASE construction
  // needed here.
  if (await getSetting('autofillBookCoverImage', true)) {
    const coverUrl = record.cover?.medium ?? record.cover?.large;
    if (coverUrl) fields['coverImagePath'] = coverUrl;
  }

  const genres =
    ENABLE_OPENLIBRARY_GENRES && record.subjects?.length
      ? record.subjects.slice(0, OPENLIBRARY_GENRE_LIMIT).map((s) => s.name)
      : undefined;

  return {
    id: isbn,
    title: record.title,
    subtitle: author,
    fields,
    genres,
  };
}
