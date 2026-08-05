/**
 * Cover image search for EntryForm's "Find cover image" feature (see
 * chat). Goes through the Worker's `/image-search` route, which holds
 * the real Google Custom Search API key server-side — same pattern as
 * every other keyed source in this app (ComicVine, MAL, Trakt, UPCMDB).
 *
 * Free tier is 100 searches/day across the whole Worker (shared by
 * every device signed in) — `ImageSearchQuotaError` lets
 * CoverImageSearchDialog show a distinct "out of searches for today"
 * message and fall back to the always-available manual URL paste
 * field, rather than a generic error.
 */

const WORKER_BASE = 'https://media-journal-comicvine-proxy.david-molofsky.workers.dev';

export interface ImageSearchResult {
  /** Full-resolution image URL — what actually gets saved as
   * `metadata.coverImagePath` if this result is chosen. */
  url: string;
  /** Smaller preview Google already generated — used for the results
   * grid so the dialog doesn't have to load 9 full-size images just
   * to show a thumbnail. */
  thumbnailUrl: string;
}

export class ImageSearchQuotaError extends Error {
  constructor() {
    super('Google Custom Search daily quota exceeded');
    this.name = 'ImageSearchQuotaError';
  }
}

interface GoogleCseImageItem {
  link: string;
  image?: { thumbnailLink?: string };
}

/**
 * Searches Google Custom Search for images matching `query` (typically
 * an entry's title, optionally with author/creator appended — see
 * CoverImageSearchDialog). Returns up to 9 results — Google's own
 * per-request cap.
 */
export async function searchCoverImages(query: string): Promise<ImageSearchResult[]> {
  if (!query.trim()) return [];

  const res = await fetch(`${WORKER_BASE}/image-search?q=${encodeURIComponent(query)}`);

  if (res.status === 429) throw new ImageSearchQuotaError();
  if (!res.ok) throw new Error(`Image search failed: ${res.status}`);

  const data = (await res.json()) as { items?: GoogleCseImageItem[] };

  return (data.items ?? [])
    .filter((item) => !!item.link)
    .map((item) => ({
      url: item.link,
      thumbnailUrl: item.image?.thumbnailLink || item.link,
    }));
}
