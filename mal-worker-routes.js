/**
 * MyAnimeList proxy routes — ADD these to your existing ComicVine
 * Cloudflare Worker (media-journal-comicvine-proxy). This is not a
 * standalone Worker; it's the piece that needs merging into whatever
 * router/switch structure your current worker.js already uses.
 *
 * Why this exists at all: MAL's API sends no CORS headers on ANY
 * endpoint — not even the token endpoint — so even though MAL's OAuth
 * uses PKCE (no client_secret to protect), the browser still can't
 * call myanimelist.net or api.myanimelist.net directly. This Worker's
 * job here is purely a CORS bypass: add the right headers and forward
 * the request through. Nothing handled here is a secret that needs
 * hiding — MAL_CLIENT_ID below is fine to hardcode or set as a plain
 * (non-secret) Worker environment variable, your choice.
 *
 * Three routes needed:
 *   POST /mal/token    — exchanges an auth code for tokens
 *   POST /mal/refresh   — refreshes an expired access token
 *   GET  /mal/animelist — proxies the user's anime list (paginated)
 *   GET  /mal/mangalist — proxies the user's manga list (paginated)
 *
 * Plus, added for "Find Next in Series" (see chat, Aug 2026) — public,
 * Client-ID-only routes needing no user OAuth connection:
 *   GET  /mal/anime         — title search
 *   GET  /mal/anime/:id     — single anime detail (e.g. related_anime)
 *   GET  /mal/manga         — title search
 *   GET  /mal/manga/:id     — single manga detail (e.g. related_manga)
 *
 * If your existing Worker uses a router library (itty-router, Hono,
 * etc.) rather than a plain switch/if chain, adapt the route
 * registration syntax below to match — the handler bodies themselves
 * don't depend on any particular router.
 */

const MAL_CLIENT_ID = 'bba4ffe9672033f70250e9df05bde6d9';
const MAL_TOKEN_URL = 'https://myanimelist.net/v1/oauth2/token';
const MAL_API_BASE = 'https://api.myanimelist.net/v2';

// Reuse whatever CORS header logic your Worker already applies for
// the ComicVine routes (same ALLOWED_ORIGINS allowlist — this doesn't
// need its own separate origin check). The snippets below assume a
// helper like this already exists; adjust the call sites if your
// existing helper has a different name/signature.
//
// function corsHeaders(origin) {
//   return {
//     'Access-Control-Allow-Origin': origin,
//     'Access-Control-Allow-Headers': 'Content-Type, Authorization',
//     'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
//   };
// }

/** POST /mal/token — body: { code, code_verifier, redirect_uri } */
async function handleMalToken(request, origin) {
  const { code, code_verifier, redirect_uri } = await request.json();

  const body = new URLSearchParams({
    client_id: MAL_CLIENT_ID,
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
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

/** POST /mal/refresh — body: { refresh_token } */
async function handleMalRefresh(request, origin) {
  const { refresh_token } = await request.json();

  const body = new URLSearchParams({
    client_id: MAL_CLIENT_ID,
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
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

/**
 * GET /mal/animelist or /mal/mangalist — forwards the Authorization
 * header from the browser straight through (the Worker never sees or
 * needs to inspect the token itself), adds X-MAL-Client-ID (required
 * on every MAL v2 API call), and passes through whatever query string
 * the client sent (fields, limit, offset — see malService.ts).
 */
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
    headers: {
      Authorization: authHeader,
      'X-MAL-Client-ID': MAL_CLIENT_ID,
    },
  });

  const data = await malResponse.text();
  return new Response(data, {
    status: malResponse.status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

/**
 * GET /mal/anime/:id or /mal/manga/:id, and GET /mal/anime or
 * /mal/manga (search, when no :id segment is present) — added for
 * "Find Next in Series" (see chat, Aug 2026). Client-ID-only auth
 * (X-MAL-Client-ID, no Authorization header) since these are MAL's
 * public read endpoints — unlike handleMalList above, these work
 * whether or not the user has ever connected their MAL account.
 * `id` is undefined for the search variant.
 */
async function handleMalPublic(request, origin, type, id) {
  const incomingUrl = new URL(request.url);
  const malUrl = id
    ? `${MAL_API_BASE}/${type}/${id}?${incomingUrl.searchParams.toString()}`
    : `${MAL_API_BASE}/${type}?${incomingUrl.searchParams.toString()}`;

  const malResponse = await fetch(malUrl, {
    headers: { 'X-MAL-Client-ID': MAL_CLIENT_ID },
  });

  const data = await malResponse.text();
  return new Response(data, {
    status: malResponse.status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

// ── Wire these into your existing router ────────────────────────────────────
//
// If your Worker is a plain switch on `url.pathname`, something like:
//
//   const url = new URL(request.url);
//   const origin = request.headers.get('Origin');
//
//   if (url.pathname === '/mal/token' && request.method === 'POST') {
//     return handleMalToken(request, origin);
//   }
//   if (url.pathname === '/mal/refresh' && request.method === 'POST') {
//     return handleMalRefresh(request, origin);
//   }
//   if (url.pathname === '/mal/animelist' && request.method === 'GET') {
//     return handleMalList(request, origin, 'animelist');
//   }
//   if (url.pathname === '/mal/mangalist' && request.method === 'GET') {
//     return handleMalList(request, origin, 'mangalist');
//   }
//   // Added for "Find Next in Series" (Aug 2026) — matches both the
//   // search form (/mal/anime, /mal/manga) and the detail form
//   // (/mal/anime/123, /mal/manga/123).
//   const animeMatch = url.pathname.match(/^\/mal\/anime(?:\/(\d+))?$/);
//   if (animeMatch && request.method === 'GET') {
//     return handleMalPublic(request, origin, 'anime', animeMatch[1]);
//   }
//   const mangaMatch = url.pathname.match(/^\/mal\/manga(?:\/(\d+))?$/);
//   if (mangaMatch && request.method === 'GET') {
//     return handleMalPublic(request, origin, 'manga', mangaMatch[1]);
//   }
//
// Don't forget: if your Worker handles OPTIONS preflight requests
// explicitly for the ComicVine routes, these new routes need the same
// treatment (an OPTIONS handler returning corsHeaders(origin) with no
// body) — browsers will preflight the POST routes and the GET routes
// that send a custom Authorization header.
