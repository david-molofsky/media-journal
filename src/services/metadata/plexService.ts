/**
 * Plex Media Server API client.
 *
 * Auth: a manually-pasted `X-Plex-Token` — no PIN-linking flow in this
 * scope (see chat). Grabbed once from Plex Web's network tab or the
 * person's Plex account, then stored like any other token here.
 *
 * CORS note: same as the other self-hosted sources — calls the
 * server directly from the browser; a Cloudflare Worker proxy route
 * may be needed if the server doesn't allow that.
 */

function normalizeServerUrl(serverUrl: string): string {
  return serverUrl.trim().replace(/\/+$/, '');
}

async function plexFetch<T>(serverUrl: string, token: string, path: string): Promise<T> {
  const res = await fetch(`${normalizeServerUrl(serverUrl)}${path}`, {
    headers: {
      'X-Plex-Token': token,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Plex request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function verifyPlexToken(serverUrl: string, token: string): Promise<void> {
  await plexFetch(serverUrl, token, '/library/sections');
}

export interface PlexSection {
  key: string;
  title: string;
  type: 'movie' | 'show' | string;
}

interface PlexSectionsResponse {
  MediaContainer: { Directory: PlexSection[] };
}

export async function getLibrarySections(serverUrl: string, token: string): Promise<PlexSection[]> {
  const data = await plexFetch<PlexSectionsResponse>(serverUrl, token, '/library/sections');
  return data.MediaContainer.Directory ?? [];
}

export interface PlexItem {
  ratingKey: string;
  title: string;
  type: 'movie' | 'show' | string;
  viewCount?: number;
  lastViewedAt?: number; // unix seconds
  Guid?: { id: string }[]; // e.g. [{ id: 'imdb://tt0133093' }, { id: 'tmdb://603' }]
}

interface PlexItemsResponse {
  MediaContainer: { Metadata?: PlexItem[] };
}

/** Fetches every item in a section with viewCount > 0. Plex's own
 * `?unwatched=0` filter is unreliable across versions, so this fetches
 * everything in the section and filters client-side instead — fine at
 * personal-library scale. */
export async function getWatchedItems(serverUrl: string, token: string, sectionKey: string): Promise<PlexItem[]> {
  const data = await plexFetch<PlexItemsResponse>(serverUrl, token, `/library/sections/${sectionKey}/all`);
  return (data.MediaContainer.Metadata ?? []).filter((item) => (item.viewCount ?? 0) > 0);
}

/** Extracts a TMDB or IMDb id from Plex's Guid array, preferring TMDB
 * (a direct id, no extra lookup needed) over IMDb (needs the /find
 * round trip via tmdbService.findByImdbId). */
export function extractPlexIds(item: PlexItem): { tmdbId?: string; imdbId?: string } {
  const guids = item.Guid ?? [];
  const tmdbId = guids.find((g) => g.id.startsWith('tmdb://'))?.id.replace('tmdb://', '');
  const imdbId = guids.find((g) => g.id.startsWith('imdb://'))?.id.replace('imdb://', '');
  return { tmdbId, imdbId };
}
