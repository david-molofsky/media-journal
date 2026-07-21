/**
 * Media Journal — combined API proxy (ComicVine + MyAnimeList + Trakt).
 *
 * ComicVine section is unchanged from the original working version.
 * MAL and Trakt are new. The bug that broke both of them: the original
 * script had a single `if (request.method !== 'GET') return 405` guard
 * near the top, which ran before any route-specific logic and
 * rejected every POST outright — including the MAL/Trakt token
 * exchange calls, which have to be POST. Fixed by moving method
 * checking into each route instead of one blanket rule up front.
 */

const ALLOWED_ORIGINS = [
  'https://david-molofsky.github.io',
  'http://localhost:5173',
];

const COMICVINE_BASE = 'https://comicvine.gamespot.com/api';
const MAL_CLIENT_ID = 'bba4ffe9672033f70250e9df05bde6d9';
const MAL_TOKEN_URL = 'https://myanimelist.net/v1/oauth2/token';
const MAL_API_BASE = 'https://api.myanimelist.net/v2';
const TRAKT_CLIENT_ID = 'msvrEiCKUcqo-Re5yLKZIQ6n1-v-3nqSUvWXKgeKybo';
const TRAKT_TOKEN_URL = 'https://api.trakt.tv/oauth/token';
const OAUTH_REDIRECT_URI = 'https://david-molofsky.github.io/media-journal/oauth-callback.html';

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    // POST added — the original list only had GET, which is a second,
    // independent reason a POST from a real browser would have been
    // blocked even once the blanket 405 guard above was removed:
    // browsers reject a request whose method isn't in this list *even
    // if the server would have accepted it*.
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

// ── ComicVine (unchanged behaviour) ─────────────────────────────────────────

async function handleComicVine(request, origin, env) {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders(origin) });
  }

  const incomingUrl = new URL(request.url);
  const comicVineUrl = new URL(`${COMICVINE_BASE}${incomingUrl.pathname}`);
  comicVineUrl.search = incomingUrl.search;
  comicVineUrl.searchParams.set('api_key', env.COMICVINE_API_KEY);
  comicVineUrl.searchParams.set('format', 'json');

  const upstreamResponse = await fetch(comicVineUrl.toString(), {
    headers: {
      'User-Agent': 'MediaJournal/1.0 (+https://david-molofsky.github.io/media-journal/)',
      Accept: 'application/json',
    },
  });

  const body = await upstreamResponse.text();
  return new Response(body, {
    status: upstreamResponse.status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

// ── MyAnimeList ──────────────────────────────────────────────────────────────

async function handleMalToken(request, origin, env) {
  const { code, code_verifier, redirect_uri } = await request.json();
  const body = new URLSearchParams({
    client_id: MAL_CLIENT_ID,
    client_secret: env.MAL_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    code_verifier,
    redirect_uri,
  });
  const malResponse = await fetch(MAL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await malResponse.text();
  return new Response(data, {
    status: malResponse.status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

async function handleMalRefresh(request, origin, env) {
  const { refresh_token } = await request.json();
  const body = new URLSearchParams({
    client_id: MAL_CLIENT_ID,
    client_secret: env.MAL_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token,
  });
  const malResponse = await fetch(MAL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await malResponse.text();
  return new Response(data, {
    status: malResponse.status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

async function handleMalList(request, origin, listType) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }
  const incomingUrl = new URL(request.url);
  const malUrl = `${MAL_API_BASE}/users/@me/${listType}?${incomingUrl.searchParams.toString()}`;
  const malResponse = await fetch(malUrl, {
    headers: { Authorization: authHeader, 'X-MAL-Client-ID': MAL_CLIENT_ID },
  });
  const data = await malResponse.text();
  return new Response(data, {
    status: malResponse.status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

// ── Trakt ────────────────────────────────────────────────────────────────────

async function handleTraktToken(request, origin, env) {
  const { code, redirect_uri } = await request.json();
  const traktResponse = await fetch(TRAKT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id: TRAKT_CLIENT_ID,
      client_secret: env.TRAKT_CLIENT_SECRET,
      redirect_uri,
      grant_type: 'authorization_code',
    }),
  });
  const data = await traktResponse.text();
  return new Response(data, {
    status: traktResponse.status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

async function handleTraktRefresh(request, origin, env) {
  const { refresh_token } = await request.json();
  const traktResponse = await fetch(TRAKT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refresh_token,
      client_id: TRAKT_CLIENT_ID,
      client_secret: env.TRAKT_CLIENT_SECRET,
      redirect_uri: OAUTH_REDIRECT_URI,
      grant_type: 'refresh_token',
    }),
  });
  const data = await traktResponse.text();
  return new Response(data, {
    status: traktResponse.status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

// ── Router ───────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Same allowlist check as before, applied globally regardless of
    // which route matches below (a direct address-bar/curl request
    // sends no Origin header at all and is let through, same as the
    // original ComicVine-only version did).
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return new Response('Origin not allowed', { status: 403, headers: corsHeaders(origin) });
    }

    if (url.pathname === '/mal/token' && request.method === 'POST') {
      return handleMalToken(request, origin, env);
    }
    if (url.pathname === '/mal/refresh' && request.method === 'POST') {
      return handleMalRefresh(request, origin, env);
    }
    if (url.pathname === '/mal/animelist' && request.method === 'GET') {
      return handleMalList(request, origin, 'animelist');
    }
    if (url.pathname === '/mal/mangalist' && request.method === 'GET') {
      return handleMalList(request, origin, 'mangalist');
    }
    if (url.pathname === '/trakt/token' && request.method === 'POST') {
      return handleTraktToken(request, origin, env);
    }
    if (url.pathname === '/trakt/refresh' && request.method === 'POST') {
      return handleTraktRefresh(request, origin, env);
    }

    // Everything else falls through to ComicVine, exactly as the
    // original script behaved — it forwards whatever path arrives
    // (/search/, /issues/, /issue/{id}/, etc.) straight to ComicVine.
    return handleComicVine(request, origin, env);
  },
};
