/**
 * Jellyfin self-hosted server API client.
 *
 * Auth: either username/password via POST /Users/AuthenticateByName
 * (returns an AccessToken + User.Id), or an admin-generated API key
 * pasted directly. Both end up as the same `jellyfinToken` setting —
 * note the API-key path has a known Jellyfin quirk where UserData
 * (played status) is sometimes omitted from /Items responses, so
 * username/password is the more reliable option in practice (flagged
 * in the connect form's help text).
 *
 * CORS note: same as audiobookshelfService.ts — calls the server
 * directly from the browser; a Cloudflare Worker proxy route may be
 * needed if the server doesn't allow that.
 */

const CLIENT_HEADER = 'MediaBrowser Client="Media Journal", Device="Web", DeviceId="media-journal-web", Version="1.0"';

function normalizeServerUrl(serverUrl: string): string {
  return serverUrl.trim().replace(/\/+$/, '');
}

async function jellyfinFetch<T>(
  serverUrl: string,
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${normalizeServerUrl(serverUrl)}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `${CLIENT_HEADER}, Token="${token}"`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Jellyfin request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

interface JellyfinAuthResult {
  AccessToken: string;
  User: { Id: string };
}

/** Exchanges username/password for an access token + user id. */
export async function loginJellyfin(
  serverUrl: string,
  username: string,
  password: string,
): Promise<{ token: string; userId: string }> {
  const res = await fetch(`${normalizeServerUrl(serverUrl)}/Users/AuthenticateByName`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: CLIENT_HEADER,
    },
    body: JSON.stringify({ Username: username, Pw: password }),
  });
  if (!res.ok) throw new Error('Login failed — check your username and password.');
  const data = (await res.json()) as JellyfinAuthResult;
  return { token: data.AccessToken, userId: data.User.Id };
}

interface JellyfinUser {
  Id: string;
  Policy?: { IsAdministrator?: boolean };
}

/**
 * Resolves the user id to sync for an API-key connection, since a key
 * alone has no associated user. Prefers /Users/Me (works for most
 * tokens); if the key can't use that (see the API-key caveat above),
 * falls back to the first administrator returned by /Users.
 */
export async function resolveJellyfinUserId(serverUrl: string, token: string): Promise<string> {
  try {
    const me = await jellyfinFetch<JellyfinUser>(serverUrl, token, '/Users/Me');
    if (me.Id) return me.Id;
  } catch {
    // fall through
  }
  const users = await jellyfinFetch<JellyfinUser[]>(serverUrl, token, '/Users');
  const admin = users.find((u) => u.Policy?.IsAdministrator) ?? users[0];
  if (!admin) throw new Error('No Jellyfin users found for this API key.');
  return admin.Id;
}

export async function verifyJellyfinToken(serverUrl: string, token: string, userId: string): Promise<void> {
  await jellyfinFetch(serverUrl, token, `/Users/${userId}`);
}

export interface JellyfinItem {
  Id: string;
  Name: string;
  Type: 'Movie' | 'Series' | 'Book' | 'AudioBook' | string;
  ProductionYear?: number;
  Album?: string; // author, for Book/AudioBook items
  ProviderIds?: Record<string, string>; // e.g. { Imdb: 'tt123', Tmdb: '603' }
  UserData?: {
    Played?: boolean;
    LastPlayedDate?: string; // ISO
  };
}

interface JellyfinItemsResponse {
  Items: JellyfinItem[];
}

/** Fetches every item of the given types marked played by this user.
 * `IncludeItemTypes` values map onto Media Journal's own types:
 * Movie→Film, Series→TV, Book→Book, AudioBook→Audiobook. */
export async function getPlayedItems(
  serverUrl: string,
  token: string,
  userId: string,
  includeItemTypes: string[],
): Promise<JellyfinItem[]> {
  const params = new URLSearchParams({
    IncludeItemTypes: includeItemTypes.join(','),
    Filters: 'IsPlayed',
    Recursive: 'true',
    Fields: 'ProviderIds,UserData',
  });
  const data = await jellyfinFetch<JellyfinItemsResponse>(
    serverUrl,
    token,
    `/Users/${userId}/Items?${params.toString()}`,
  );
  return data.Items ?? [];
}
