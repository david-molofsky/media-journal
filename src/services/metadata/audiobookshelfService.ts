/**
 * Audiobookshelf self-hosted server API client.
 *
 * Auth: either username/password via POST /login (returns a JWT in
 * `user.token`), or an admin-generated API token pasted directly —
 * both end up stored as the same `absToken` setting, since every
 * subsequent call just needs a bearer token regardless of how it was
 * obtained (see AudiobookshelfImportSection.tsx).
 *
 * CORS note: this calls the user's own server URL directly from the
 * browser. Whether that works depends on the server's own CORS
 * configuration (reverse proxy, etc.) — if it's blocked, the same
 * Cloudflare Worker proxy pattern used for ComicVine/MAL/Trakt would
 * need a new route added (see chat: worker source isn't in the app
 * repo, lives only in the Cloudflare dashboard).
 */

function normalizeServerUrl(serverUrl: string): string {
  return serverUrl.trim().replace(/\/+$/, '');
}

async function absFetch<T>(serverUrl: string, token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${normalizeServerUrl(serverUrl)}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Audiobookshelf request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

interface AbsLoginResponse {
  user?: { token?: string };
}

/** Exchanges username/password for a bearer token via POST /login. */
export async function loginAudiobookshelf(
  serverUrl: string,
  username: string,
  password: string,
): Promise<string> {
  const res = await fetch(`${normalizeServerUrl(serverUrl)}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error('Login failed — check your username and password.');
  const data = (await res.json()) as AbsLoginResponse;
  const token = data.user?.token;
  if (!token) throw new Error("Audiobookshelf didn't return a token — check your server version.");
  return token;
}

/** Confirms a server URL + token actually work, for both auth paths —
 * pasted tokens never went through loginAudiobookshelf, so this is the
 * only validation they get before being saved. */
export async function verifyAudiobookshelfToken(serverUrl: string, token: string): Promise<void> {
  await absFetch(serverUrl, token, '/api/me');
}

export interface AbsMediaProgress {
  id: string;
  libraryItemId: string;
  progress: number; // 0–1
  isFinished: boolean;
  startedAt?: number; // unix ms
  finishedAt?: number; // unix ms
}

interface AbsMeResponse {
  mediaProgress?: AbsMediaProgress[];
}

export async function getMediaProgress(serverUrl: string, token: string): Promise<AbsMediaProgress[]> {
  const data = await absFetch<AbsMeResponse>(serverUrl, token, '/api/me');
  return data.mediaProgress ?? [];
}

export interface AbsLibraryItem {
  id: string;
  libraryId: string;
  media: {
    metadata: {
      title: string;
      authorName?: string;
      seriesName?: string;
      isbn?: string;
      asin?: string;
      genres?: string[];
    };
    ebookFormat?: string;
    audioFiles?: unknown[];
  };
}

export async function getLibraryItem(serverUrl: string, token: string, id: string): Promise<AbsLibraryItem> {
  return absFetch<AbsLibraryItem>(serverUrl, token, `/api/items/${id}?expanded=1`);
}

export interface AbsLibrary {
  id: string;
  name: string;
}

interface AbsLibrariesResponse {
  libraries?: AbsLibrary[];
}

export async function getLibraries(serverUrl: string, token: string): Promise<AbsLibrary[]> {
  const data = await absFetch<AbsLibrariesResponse>(serverUrl, token, '/api/libraries');
  return data.libraries ?? [];
}
