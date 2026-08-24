/**
 * Google Books fallback search for Book/Audiobook and Comic.
 *
 * See chat, Aug 2026. Self-published titles are frequently missing
 * from Open Library (books) and ComicVine (comics); Google Books
 * indexes retailer/publisher metadata (Amazon KDP, IngramSpark, etc.)
 * far more broadly. This is a FALLBACK, not a merged/parallel source —
 * MetadataSearch.tsx only calls this once the primary source
 * (openLibraryService / comicVineService) reports its own pagination
 * exhausted (`hasMore: false`). Results from here are appended into
 * the same results list with no visible distinction from the primary
 * source (see chat — David's call: "I don't think the user will
 * actually care" which source a result came from).
 *
 * Requires the Worker's GOOGLE_BOOKS_API_KEY secret — this service
 * only ever talks to the Worker (see WORKER_BASE below), same as
 * comicVineService.ts. Never calls googleapis.com directly.
 */

import type { SearchResult } from './openLibraryService';

// Same Worker as ComicVine/MAL/Trakt — see comicVineService.ts's
// identical constant and comment.
const WORKER_BASE = 'https://media-journal-comicvine-proxy.david-molofsky.workers.dev';

/** Matches openLibraryService.ts's PAGE_SIZE — first page and every
 * subsequent infinite-scroll batch are the same size, so switching
 * from the primary source to this one mid-scroll doesn't change the
 * batch size the user is used to. */
const PAGE_SIZE = 15;

interface GoogleBooksIndustryIdentifier {
  type: string;
  identifier: string;
}

interface GoogleBooksVolumeInfo {
  title?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  pageCount?: number;
  industryIdentifiers?: GoogleBooksIndustryIdentifier[];
  imageLinks?: {
    thumbnail?: string;
    smallThumbnail?: string;
  };
}

interface GoogleBooksVolume {
  id: string;
  volumeInfo?: GoogleBooksVolumeInfo;
}

interface GoogleBooksResponse {
  totalItems?: number;
  items?: GoogleBooksVolume[];
}

/** Google Books returns http:// image links even over an https
 * request — upgraded here so they don't get silently blocked as mixed
 * content when used as coverImagePath (same class of fix as
 * comicVineService's existing image-url handling). */
function toHttps(url: string): string {
  return url.startsWith('http://') ? `https://${url.slice(7)}` : url;
}

/** Prefers ISBN-13 over ISBN-10 over any other identifier type Google
 * Books might return (e.g. OTHER, for some self-published/ASIN-only
 * editions) — same preference order barcode scanning already uses
 * elsewhere in the app. */
function extractIsbn(identifiers: GoogleBooksIndustryIdentifier[] | undefined): string {
  if (!identifiers?.length) return '';
  const isbn13 = identifiers.find((i) => i.type === 'ISBN_13');
  if (isbn13) return isbn13.identifier;
  const isbn10 = identifiers.find((i) => i.type === 'ISBN_10');
  if (isbn10) return isbn10.identifier;
  return identifiers[0]?.identifier ?? '';
}

function mapVolume(volume: GoogleBooksVolume): SearchResult {
  const info = volume.volumeInfo ?? {};
  const author = info.authors?.[0] ?? '';
  const year = info.publishedDate?.slice(0, 4) ?? '';
  const isbn = extractIsbn(info.industryIdentifiers);

  const subtitleParts = [author, year].filter(Boolean);
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(' · ') : 'Google Books';

  const fields: Record<string, string> = {};
  if (author) fields['author'] = author;
  if (year) fields['releaseYear'] = year;
  if (isbn) fields['isbn'] = isbn;
  if (info.description) fields['overview'] = info.description.slice(0, 2000);
  if (info.pageCount) fields['pageCount'] = String(info.pageCount);
  const cover = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail;
  if (cover) fields['coverImagePath'] = toHttps(cover);

  return {
    id: volume.id,
    title: info.title ?? '(untitled)',
    subtitle,
    fields,
  };
}

async function fetchGoogleBooksPage(
  title: string,
  author: string,
  startIndex: number,
): Promise<{ results: SearchResult[]; totalItems: number }> {
  if (!title.trim()) return { results: [], totalItems: 0 };

  const params = new URLSearchParams({
    title,
    startIndex: String(startIndex),
    maxResults: String(PAGE_SIZE),
  });
  if (author.trim()) params.set('author', author);

  const res = await fetch(`${WORKER_BASE}/googlebooks/search?${params.toString()}`);
  if (!res.ok) throw new Error(`Google Books proxy error ${res.status}`);

  const data = (await res.json()) as GoogleBooksResponse;
  const results = (data.items ?? []).map(mapVolume);
  return { results, totalItems: data.totalItems ?? results.length };
}

/**
 * First-page search. Signature intentionally matches
 * openLibraryService.searchBooks / comicVineService.searchSeries
 * (query in, SearchResult[] out) so MetadataSearch.tsx's
 * getSearchFn-style dispatch doesn't need special-casing — though in
 * practice this is only ever called as a *fallback*, via
 * searchGoogleBooksPage below, once the primary source is exhausted;
 * see MetadataSearch.tsx's cross-source continuation logic.
 */
export async function searchGoogleBooks(title: string, author = ''): Promise<SearchResult[]> {
  return (await fetchGoogleBooksPage(title, author, 0)).results;
}

/**
 * Infinite-scroll variant — fetches one further batch starting at
 * `startIndex` and reports whether another batch would still return
 * anything, based on Google Books' own `totalItems`. Same shape as
 * openLibraryService.searchBooksPage / comicVineService.searchSeriesPage.
 */
export async function searchGoogleBooksPage(
  title: string,
  author: string,
  startIndex: number,
): Promise<{ results: SearchResult[]; hasMore: boolean }> {
  const { results, totalItems } = await fetchGoogleBooksPage(title, author, startIndex);
  return { results, hasMore: startIndex + results.length < totalItems };
}
