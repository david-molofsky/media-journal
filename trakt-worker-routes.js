/**
 * Trakt proxy routes — ADD these to the same Cloudflare Worker as the
 * ComicVine and MyAnimeList routes (media-journal-comicvine-proxy).
 *
 * Unlike MAL, Trakt's data endpoints (history/ratings/watchlist) are
 * called DIRECTLY from the browser — no Worker involvement — because
 * Trakt does support CORS for origins registered on the app (the
 * "JavaScript (CORS) origins" field). Only the token exchange and
 * refresh need to go through here, because those require
 * TRAKT_CLIENT_SECRET, which must never reach the browser.
 *
 * IMPORTANT: TRAKT_CLIENT_SECRET must be added as a Worker secret —
 *   wrangler secret put TRAKT_CLIENT_SECRET
 * or via the Cloudflare dashboard (Worker > Settings > Variables >
 * Encrypt). Do NOT hardcode it in this file or commit it anywhere.
 *
 * Two routes:
 *   POST /trakt/token   — exchanges an auth code for tokens
 *   POST /trakt/refresh — refreshes an expired access token
 */

const TRAKT_CLIENT_ID = 'msvrEiCKUcqo-Re5yLKZIQ6n1-v-3nqSUvWXKgeKybo';
const TRAKT_TOKEN_URL = 'https://api.trakt.tv/oauth/token';

// Same corsHeaders(origin) helper referenced in mal-worker-routes.js —
// reuse whatever's already defined for the ComicVine/MAL routes.

/** POST /trakt/token — body: { code, redirect_uri } */
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
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

/** POST /trakt/refresh — body: { refresh_token } */
async function handleTraktRefresh(request, origin, env) {
  const { refresh_token } = await request.json();

  const traktResponse = await fetch(TRAKT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refresh_token,
      client_id: TRAKT_CLIENT_ID,
      client_secret: env.TRAKT_CLIENT_SECRET,
      redirect_uri: 'https://david-molofsky.github.io/media-journal/oauth-callback.html',
      grant_type: 'refresh_token',
    }),
  });

  const data = await traktResponse.text();
  return new Response(data, {
    status: traktResponse.status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

// ── Wire these into your existing router ────────────────────────────────────
//
//   if (url.pathname === '/trakt/token' && request.method === 'POST') {
//     return handleTraktToken(request, origin, env);
//   }
//   if (url.pathname === '/trakt/refresh' && request.method === 'POST') {
//     return handleTraktRefresh(request, origin, env);
//   }
//
// Note the `env` parameter — this needs to be threaded through from
// your Worker's top-level fetch(request, env, ctx) handler down to
// these functions, since that's how Cloudflare Workers expose secrets.
// If your existing ComicVine handler doesn't currently take `env` as a
// parameter (e.g. it hardcodes its API key directly, or reads it some
// other way), let me know how it's structured there and I'll adjust
// this to match.
