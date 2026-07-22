/**
 * UPCMDB proxy route — ADD this to the same Cloudflare Worker as the
 * ComicVine, MAL, and Trakt routes (media-journal-comicvine-proxy).
 *
 * Why this exists: UPCMDB's API key is account-tied (unlike TMDB's
 * public read token), so it can't go client-side — same reasoning as
 * ComicVine. This route forwards a UPC lookup to UPCMDB with the key
 * attached server-side, and passes the response straight through.
 *
 * IMPORTANT: UPCMDB_API_KEY must be added as a Worker secret —
 *   wrangler secret put UPCMDB_API_KEY
 * or via the Cloudflare dashboard (Worker > Settings > Variables >
 * Encrypt). Do NOT hardcode it in this file or commit it anywhere.
 *
 * One route:
 *   GET /upcmdb/:upc — looks up a single UPC, returns UPCMDB's JSON
 *     response body as-is (status codes passed through too — 404 for
 *     not-found, 429 for quota exceeded, 401/403 for key problems —
 *     upcmdbService.ts on the client interprets these directly rather
 *     than this route reshaping them).
 */

const UPCMDB_BASE = 'https://us-central1-upcmdb-cbae5.cloudfunctions.net/api';

// Reuse the same corsHeaders(origin) helper already defined for the
// ComicVine/MAL/Trakt routes — see mal-worker-routes.js.

/** GET /upcmdb/:upc */
async function handleUpcmdbLookup(request, origin, env, upc) {
  const upcmdbResponse = await fetch(`${UPCMDB_BASE}/v1/lookup/${encodeURIComponent(upc)}`, {
    headers: { 'x-api-key': env.UPCMDB_API_KEY },
  });

  const data = await upcmdbResponse.text();
  return new Response(data, {
    status: upcmdbResponse.status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

// ── Wire this into your existing router ─────────────────────────────────────
//
//   const upcMatch = url.pathname.match(/^\/upcmdb\/([^/]+)$/);
//   if (upcMatch && request.method === 'GET') {
//     return handleUpcmdbLookup(request, origin, env, upcMatch[1]);
//   }
//
// Note the `env` parameter — same as the Trakt routes, this needs to
// be threaded through from your Worker's top-level fetch(request, env,
// ctx) handler down to this function, since that's how Cloudflare
// Workers expose secrets.
