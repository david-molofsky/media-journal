/**
 * MyAnimeList OAuth (Authorization Code + PKCE) and list-fetching.
 *
 * MAL's API sends no CORS headers on ANY endpoint — including the
 * token endpoint — so despite PKCE meaning no client_secret is
 * required, every call here still has to go through the same
 * Cloudflare Worker proxy pattern used for ComicVine (see
 * comicVineService.ts). The Worker's job for MAL is purely a CORS
 * bypass, not secret-hiding — nothing sent to it here is sensitive
 * (the access token is already in the browser's own hands regardless).
 *
 * PKCE note: MAL currently only supports code_challenge_method=plain
 * (not S256) — see https://myanimelist.net/apiconfig/references/authorization —
 * so code_challenge is sent as literally the same string as
 * code_verifier, generated once per auth attempt.
 *
 * Redirect URI note: this app uses HashRouter, but OAuth's redirect_uri
 * can't contain a '#' fragment per spec. The registered redirect URI is
 * a plain static page (public/oauth-callback.html) that forwards into
 * the real in-app route — see that file's comments.
 */

import { getSetting, setSetting } from '@/services/database/settingsService';

const CLIENT_ID = 'bba4ffe9672033f70250e9df05bde6d9';

// Same Worker as ComicVine — David chose to add new routes to the
// existing proxy rather than stand up a separate one (see chat).
const WORKER_BASE = 'https://media-journal-comicvine-proxy.david-molofsky.workers.dev';

const REDIRECT_URI = 'https://david-molofsky.github.io/media-journal/oauth-callback.html';

const SESSION_VERIFIER_KEY = 'mal_pkce_verifier';
const SESSION_STATE_KEY = 'mal_pkce_state';

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

/** Kicks off the MAL OAuth flow by redirecting the whole page to MAL's
 * authorize screen. The code_verifier and state are stashed in
 * sessionStorage (not IndexedDB — this is a short-lived, single-tab
 * value, not app data) to survive the full-page redirect round trip. */
export function beginMalAuth(): void {
  const codeVerifier = randomString(128);
  // Prefixed "mal:" so the shared oauth-callback.html shim can route
  // to the right provider's handler without a per-provider copy.
  const state = `mal:${randomString(16)}`;
  sessionStorage.setItem(SESSION_VERIFIER_KEY, codeVerifier);
  sessionStorage.setItem(SESSION_STATE_KEY, state);

  const url = new URL('https://myanimelist.net/v1/oauth2/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('state', state);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('code_challenge', codeVerifier);
  url.searchParams.set('code_challenge_method', 'plain');
  window.location.href = url.toString();
}

interface MalTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/** Completes the flow from MAL's callback (code + state from the URL).
 * Verifies state against what was stashed before redirecting, then
 * exchanges the code for tokens via the Worker and persists them. */
export async function completeMalAuth(code: string, state: string): Promise<void> {
  const expectedState = sessionStorage.getItem(SESSION_STATE_KEY);
  const codeVerifier = sessionStorage.getItem(SESSION_VERIFIER_KEY);
  sessionStorage.removeItem(SESSION_STATE_KEY);
  sessionStorage.removeItem(SESSION_VERIFIER_KEY);

  if (!expectedState || state !== expectedState || !codeVerifier) {
    throw new Error('Connection expired or was tampered with — please try connecting again.');
  }

  const res = await fetch(`${WORKER_BASE}/mal/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, code_verifier: codeVerifier, redirect_uri: REDIRECT_URI }),
  });
  if (!res.ok) throw new Error(`MyAnimeList token exchange failed (${res.status})`);
  const data = (await res.json()) as MalTokenResponse;

  await Promise.all([
    setSetting('malAccessToken', data.access_token),
    setSetting('malRefreshToken', data.refresh_token),
    setSetting('malTokenExpiresAt', new Date(Date.now() + data.expires_in * 1000).toISOString()),
  ]);
}

export async function isMalConnected(): Promise<boolean> {
  const token = await getSetting<string | null>('malAccessToken', null);
  return !!token;
}

export async function disconnectMal(): Promise<void> {
  await Promise.all([
    setSetting('malAccessToken', null),
    setSetting('malRefreshToken', null),
    setSetting('malTokenExpiresAt', null),
  ]);
}

/** Refreshes the access token if it's expired or about to be (5 minute
 * buffer), storing the new tokens. Returns the token to use for the
 * next request — either the still-valid existing one or a fresh one. */
async function ensureFreshToken(): Promise<string> {
  const [accessToken, refreshToken, expiresAt] = await Promise.all([
    getSetting<string | null>('malAccessToken', null),
    getSetting<string | null>('malRefreshToken', null),
    getSetting<string | null>('malTokenExpiresAt', null),
  ]);
  if (!accessToken || !refreshToken) {
    throw new Error('MyAnimeList isn\'t connected — connect it in Settings first.');
  }

  const expiresSoon = !expiresAt || new Date(expiresAt).getTime() - Date.now() < 5 * 60 * 1000;
  if (!expiresSoon) return accessToken;

  const res = await fetch(`${WORKER_BASE}/mal/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error(`MyAnimeList token refresh failed (${res.status})`);
  const data = (await res.json()) as MalTokenResponse;

  await Promise.all([
    setSetting('malAccessToken', data.access_token),
    setSetting('malRefreshToken', data.refresh_token),
    setSetting('malTokenExpiresAt', new Date(Date.now() + data.expires_in * 1000).toISOString()),
  ]);
  return data.access_token;
}

// ── List fetching ────────────────────────────────────────────────────────────

export interface MalListStatus {
  status: string;
  score: number;
  num_episodes_watched?: number;
  num_chapters_read?: number;
  num_volumes_read?: number;
  num_times_rewatched?: number;
  num_times_reread?: number;
  start_date?: string;
  finish_date?: string;
}

export interface MalNode {
  id: number;
  title: string;
  main_picture?: { medium?: string; large?: string };
  media_type?: string;
  num_episodes?: number;
  num_chapters?: number;
  num_volumes?: number;
  genres?: { name: string }[];
  studios?: { name: string }[];
  authors?: { node: { first_name: string; last_name: string } }[];
}

export interface MalListEntry {
  node: MalNode;
  list_status: MalListStatus;
}

interface MalListPage {
  data: MalListEntry[];
  paging: { next?: string };
}

const ANIME_FIELDS = 'list_status,genres,studios,media_type,num_episodes,main_picture';
const MANGA_FIELDS = 'list_status,genres,authors{first_name,last_name},num_chapters,num_volumes,main_picture';

/** Fetches a user's full anime or manga list, paginating via the
 * Worker until MAL reports no further pages. `onProgress` is called
 * after each page so the UI can show a live count during large-library
 * pulls (per the wireframed progress bar). Self-throttled to roughly
 * 1 request/second between pages — MAL publishes no hard rate limit,
 * but community wrappers recommend staying under that. */
export async function fetchMalList(
  type: 'anime' | 'manga',
  onProgress?: (count: number) => void,
): Promise<MalListEntry[]> {
  const accessToken = await ensureFreshToken();
  const fields = type === 'anime' ? ANIME_FIELDS : MANGA_FIELDS;

  const results: MalListEntry[] = [];
  let path = `/mal/${type}list?fields=${encodeURIComponent(fields)}&limit=100`;

  while (path) {
    const res: Response = await fetch(`${WORKER_BASE}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`MyAnimeList ${type} list request failed (${res.status})`);
    const page = (await res.json()) as MalListPage;
    results.push(...page.data);
    onProgress?.(results.length);

    // The Worker returns MAL's own `paging.next` (a full MAL API URL);
    // it forwards a request whose path+query it recognises, so strip
    // back down to just the querystring the Worker's /mal/{type}list
    // route expects rather than reconstructing manually.
    if (page.paging?.next) {
      const nextUrl = new URL(page.paging.next);
      path = `/mal/${type}list${nextUrl.search}`;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } else {
      path = '';
    }
  }

  return results;
}

// ── Find Next in Series ─────────────────────────────────────────────────────
// See chat (Aug 2026). Unlike fetchMalList above, these use MAL's
// Client-ID-only auth (the `X-MAL-Client-ID` header, no user OAuth
// token) — MAL's public anime/manga detail and search endpoints
// support this, so these work regardless of whether the user has ever
// connected their MAL account. Still routed through the same Worker
// purely for the CORS bypass (see file header) — the Worker forwards
// these without touching any Authorization header, unlike
// `handleMalList`. New Worker routes needed: GET /mal/anime/:id,
// GET /mal/manga/:id, GET /mal/anime (search), GET /mal/manga
// (search) — see mal-worker-routes.js.

interface MalRelatedNode {
  node: { id: number; title: string };
  relation_type: string;
}

interface MalDetailResponse {
  id: number;
  title: string;
  related_anime?: MalRelatedNode[];
  related_manga?: MalRelatedNode[];
}

/**
 * Follows MAL's own `related_anime`/`related_manga` "sequel"
 * relation from a given MAL id — more reliable than guessing from a
 * season/volume number, since MAL already tracks which entries are
 * genuinely sequels of each other (season 2 of a show is very often
 * its own separate MAL entry, not a season *within* one entry the way
 * TMDB models TV). Returns `null` if MAL has no "sequel"-relation
 * entry for this id.
 */
export async function findMalSequel(
  malId: string,
  type: 'anime' | 'manga',
): Promise<{ id: number; title: string } | null> {
  const field = type === 'anime' ? 'related_anime' : 'related_manga';
  const res = await fetch(`${WORKER_BASE}/mal/${type}/${malId}?fields=${field}`);
  if (!res.ok) throw new Error(`MyAnimeList ${type} detail lookup failed (${res.status})`);
  const data = (await res.json()) as MalDetailResponse;
  const related = type === 'anime' ? data.related_anime : data.related_manga;
  const sequel = related?.find((r) => r.relation_type === 'sequel');
  return sequel ? { id: sequel.node.id, title: sequel.node.title } : null;
}

interface MalSearchResponse {
  data: { node: { id: number; title: string } }[];
}

/**
 * Title search against MAL's public search endpoint — the fallback
 * path when an entry has a `series` name but no stored `malId` yet
 * (e.g. logged manually rather than via MAL import). Takes the first
 * result as the show/series' own MAL id, which `findMalSequel` above
 * then follows to the actual next entry.
 */
export async function searchMalTitle(
  query: string,
  type: 'anime' | 'manga',
): Promise<{ id: number; title: string } | null> {
  if (!query.trim()) return null;
  const res = await fetch(`${WORKER_BASE}/mal/${type}?q=${encodeURIComponent(query)}&limit=1`);
  if (!res.ok) throw new Error(`MyAnimeList ${type} search failed (${res.status})`);
  const data = (await res.json()) as MalSearchResponse;
  const first = data.data[0]?.node;
  return first ? { id: first.id, title: first.title } : null;
}
