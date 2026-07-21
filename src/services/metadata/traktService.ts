/**
 * Trakt OAuth (Authorization Code flow) and API access.
 *
 * Unlike MyAnimeList, Trakt's data endpoints DO support CORS — but
 * only for origins registered on the Trakt app itself (the "JavaScript
 * (CORS) origins" field David filled in when creating the app), and
 * only once Trakt's team has actually enabled it for that app (see
 * https://github.com/trakt/trakt-api/discussions/337). Data calls
 * (history/ratings/watchlist) go straight from the browser to
 * api.trakt.tv. The token endpoint is the one exception — it needs
 * client_secret, which must never reach the browser, so token exchange
 * and refresh go through the Cloudflare Worker (same one used for
 * ComicVine and MyAnimeList), which is the only place that holds the
 * secret.
 */

import { getSetting, setSetting } from '@/services/database/settingsService';

const CLIENT_ID = 'msvrEiCKUcqo-Re5yLKZIQ6n1-v-3nqSUvWXKgeKybo';
const WORKER_BASE = 'https://media-journal-comicvine-proxy.david-molofsky.workers.dev';
const REDIRECT_URI = 'https://david-molofsky.github.io/media-journal/oauth-callback.html';
const API_BASE = 'https://api.trakt.tv';

const SESSION_STATE_KEY = 'trakt_oauth_state';

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

/** Kicks off the Trakt OAuth flow via full-page redirect. No PKCE —
 * Trakt uses the standard Authorization Code flow with a
 * server-held secret (see module doc comment). */
export function beginTraktAuth(): void {
  const state = `trakt:${randomString(24)}`;
  sessionStorage.setItem(SESSION_STATE_KEY, state);

  const url = new URL('https://trakt.tv/oauth/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('state', state);
  window.location.href = url.toString();
}

interface TraktTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export async function completeTraktAuth(code: string, state: string): Promise<void> {
  const expectedState = sessionStorage.getItem(SESSION_STATE_KEY);
  sessionStorage.removeItem(SESSION_STATE_KEY);
  if (!expectedState || state !== expectedState) {
    throw new Error('Connection expired or was tampered with — please try connecting again.');
  }

  const res = await fetch(`${WORKER_BASE}/trakt/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: REDIRECT_URI }),
  });
  if (!res.ok) throw new Error(`Trakt token exchange failed (${res.status})`);
  const data = (await res.json()) as TraktTokenResponse;

  await Promise.all([
    setSetting('traktAccessToken', data.access_token),
    setSetting('traktRefreshToken', data.refresh_token),
    setSetting('traktTokenExpiresAt', new Date(Date.now() + data.expires_in * 1000).toISOString()),
  ]);
}

export async function isTraktConnected(): Promise<boolean> {
  return !!(await getSetting<string | null>('traktAccessToken', null));
}

export async function disconnectTrakt(): Promise<void> {
  await Promise.all([
    setSetting('traktAccessToken', null),
    setSetting('traktRefreshToken', null),
    setSetting('traktTokenExpiresAt', null),
  ]);
}

async function ensureFreshToken(): Promise<string> {
  const [accessToken, refreshToken, expiresAt] = await Promise.all([
    getSetting<string | null>('traktAccessToken', null),
    getSetting<string | null>('traktRefreshToken', null),
    getSetting<string | null>('traktTokenExpiresAt', null),
  ]);
  if (!accessToken || !refreshToken) {
    throw new Error("Trakt isn't connected — connect it in Settings first.");
  }

  const expiresSoon = !expiresAt || new Date(expiresAt).getTime() - Date.now() < 5 * 60 * 1000;
  if (!expiresSoon) return accessToken;

  const res = await fetch(`${WORKER_BASE}/trakt/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error(`Trakt token refresh failed (${res.status})`);
  const data = (await res.json()) as TraktTokenResponse;

  await Promise.all([
    setSetting('traktAccessToken', data.access_token),
    setSetting('traktRefreshToken', data.refresh_token),
    setSetting('traktTokenExpiresAt', new Date(Date.now() + data.expires_in * 1000).toISOString()),
  ]);
  return data.access_token;
}

/** Fetches one Trakt endpoint directly (CORS, no Worker involved),
 * paginating via Trakt's `page`/`X-Pagination-Page-Count` convention
 * until every page has been collected. */
async function fetchAllPages<T>(path: string): Promise<T[]> {
  const accessToken = await ensureFreshToken();
  const results: T[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(`${API_BASE}${path}${path.includes('?') ? '&' : '?'}page=${page}&limit=100`, {
      headers: {
        'trakt-api-version': '2',
        'trakt-api-key': CLIENT_ID,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) throw new Error(`Trakt API error ${res.status} on ${path}`);
    const data = (await res.json()) as T[];
    results.push(...data);

    const pageCount = Number(res.headers.get('X-Pagination-Page-Count') ?? '1');
    if (page >= pageCount) break;
    page += 1;
  }

  return results;
}

// ── Data shapes ──────────────────────────────────────────────────────────────

interface TraktIds {
  tmdb?: number;
}

export interface TraktMovieHistoryItem {
  watched_at: string;
  movie: { title: string; year?: number; ids: TraktIds };
}

export interface TraktEpisodeHistoryItem {
  watched_at: string;
  episode: { season: number; number: number };
  show: { title: string; ids: TraktIds };
}

export interface TraktMovieRatingItem {
  rated_at: string;
  rating: number;
  movie: { ids: TraktIds };
}

export interface TraktEpisodeRatingItem {
  rated_at: string;
  rating: number;
  episode: { season: number; number: number };
  show: { ids: TraktIds };
}

export interface TraktWatchlistItem {
  type: 'movie' | 'show';
  movie?: { title: string; ids: TraktIds };
  show?: { title: string; ids: TraktIds };
}

export const fetchMovieHistory = () => fetchAllPages<TraktMovieHistoryItem>('/sync/history/movies');
export const fetchEpisodeHistory = () => fetchAllPages<TraktEpisodeHistoryItem>('/sync/history/episodes');
export const fetchMovieRatings = () => fetchAllPages<TraktMovieRatingItem>('/sync/ratings/movies');
export const fetchEpisodeRatings = () => fetchAllPages<TraktEpisodeRatingItem>('/sync/ratings/episodes');
export const fetchWatchlist = () => fetchAllPages<TraktWatchlistItem>('/sync/watchlist');
