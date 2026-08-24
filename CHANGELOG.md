# Media Journal — Delta 2026-08-24-1055

## Scope

Google Books integration: fallback metadata/cover source for Book,
Audiobook, and Comic, plus the new fields it unlocks. Builds on top of
delta 2026-08-23-1407 (the "Library" → "Journal" rename) — that delta
is not repeated here, only new/changed files from this session.

Everything in this package has passed `tsc -b --force`, ESLint, and
`vite build` clean, verified after each individual change, not just
once at the end.

## Prerequisite (already done by you, not part of this zip)

- Google Cloud project + Books API key created, restricted to Books
  API only
- `GOOGLE_BOOKS_API_KEY` added as a Worker secret on
  `media-journal-comicvine-proxy` (Settings > Variables > Encrypt),
  deployed

## Files changed

**`worker.js`** (paste over the Cloudflare dashboard's Edit Code view,
then Deploy)
- New route: `GET /googlebooks/search?title=...&author=...&startIndex=0&maxResults=15`
- New `handleGoogleBooksSearch` function — builds a scoped query
  (`intitle:X+inauthor:Y`), 1hr edge cache (errors excluded), same
  CORS/User-Agent handling as every other route
- Everything else in the file is unchanged from the previous version

**`src/services/metadata/googleBooksService.ts`** (new file)
- `searchGoogleBooks(title, author?)` / `searchGoogleBooksPage(title, author, startIndex)`
  — same shape as `openLibraryService`'s `searchBooks`/`searchBooksPage`
- Maps Google Books volumes into the shared `SearchResult` type:
  author, releaseYear, isbn, overview (truncated to 2000 chars),
  pageCount, coverImagePath (upgraded to https)
- Never calls Google's API directly — only ever talks to the Worker

**`src/services/metadata/openLibraryService.ts`**
- `searchBooks`/`searchBooksPage`/`fetchBooksPage` now take an
  optional `author` param, passed through to Open Library's own
  `author` search qualifier (narrows the *primary* search, not just
  the Google Books fallback)

**`src/services/validation/entrySchemas.ts`**
- `bookMetadataSchema` (shared by Book + Audiobook): added `pageCount`
  (`z.coerce.number().min(0).optional()`), `isbn` (`z.string().optional()`),
  `overview` (`z.string().max(2000).optional()`, same cap as Film's)

**`src/services/database/defaultMediaTypes.ts`**
- Book: added `pageCount` (number) and `isbn` (text) to `fields[]`
- Audiobook: added `isbn` (text) to `fields[]` — no `pageCount`,
  "pages" isn't a meaningful unit for an audio format
- `overview` is NOT here — it's a bespoke field (see EntryForm.tsx
  below), same treatment as Film's `overview`/`posterPath`

**`src/services/database/db.ts`**
- New Dexie `version(29)` — backfills `pageCount`/`isbn` onto
  existing users' *persisted* `mediaTypes` rows for `book`/`audiobook`.
  Necessary because `mediaTypes` records are stored per-user in
  IndexedDB; editing `defaultMediaTypes.ts` alone only affects brand
  new installs. Same conditional-injection pattern as v28's `source`
  backfill — only appends a field if the user's row doesn't already
  have one with that key, never overwrites customisations.

**`src/components/forms/MetadataSearch.tsx`** (full rewrite)
- New Author field, shown for Book/Audiobook and Comic only (not
  Film/TV). Narrows Open Library's primary search directly; for
  Comic (no ComicVine author-equivalent) it only narrows the Google
  Books fallback, with helper text explaining that
- Cross-source pivot: once the primary source's own pagination is
  exhausted, the *same* scroll-triggered load-more call pivots into
  Google Books and appends into the identical listbox — one
  continuous scroll, no second trigger needed
- No source badges/labels anywhere — a result looks identical
  regardless of which source it came from
- Attribution caption switches to "...and Google Books" the instant a
  Google Books result actually appears in the list (not deferred
  until one's selected)
- Film/TV (`tmdb` source) behavior is completely unchanged —
  `fallbackApplicable` is false there, so no Author field, no pivot

**`src/components/forms/AddCoverImageDialog.tsx`** (full rewrite)
- New "Search" tab alongside the existing "Paste URL" tab, for
  Book/Audiobook/Comic only — other media types unchanged
  (Paste URL only, exactly as before)
- Title + Author prefilled from the entry's current values, still
  editable; explicit Search button (not live typeahead — this is
  refining an already-known title, not typing one from scratch)
- Same cross-source pivot pattern as MetadataSearch
- Results filtered to only those with an actual `coverImagePath` —
  text-only matches aren't useful in an image grid
- **Known limitation, documented in the file's header comment**: Open
  Library covers here are still gated behind the "Auto-fill book
  cover image" Settings toggle, since this reuses
  `searchBooks`/`searchBooksPage` rather than a parallel cover-only
  code path. If that setting being off makes this tab feel broken
  (empty) rather than just sparse, worth a follow-up to decouple.

**`src/components/forms/EntryForm.tsx`**
- `AddCoverImageDialog` call site: added `mediaTypeId`, `initialTitle`
  (from `watch('title')`), `initialAuthor` (from
  `watch('metadata').author`, when present)
- Extended the existing bespoke `overview` Controller block (already
  shared by Film/TV/Podcast) to also cover Book/Audiobook — same
  multiline TextField, no new component. Label reads "Description"
  for Book/Audiobook, "Show Notes" for Podcast, "Overview" otherwise
- No other logic changes needed: `applyMetadataFill`'s existing
  bespoke-key handling and `fieldDef?.type === 'number'` coercion
  already cover `overview`/`pageCount`/`isbn` generically, since
  `pageCount` is now in Book's `fields[]` and `overview` was already
  on the bespoke-key skip-list

## Not included in this delta

- Nothing outstanding from this session — Author field, Google Books
  fallback (search + cover), `pageCount`, `isbn`, and `overview` are
  all built for Book/Audiobook/Comic where applicable.
- Possible follow-up (not requested): decoupling `AddCoverImageDialog`'s
  Open Library cover lookup from the "Auto-fill book cover image"
  Settings toggle (see known limitation above).

## Deploy order

1. `worker.js` → Cloudflare dashboard Edit Code → Deploy (if not
   already done from earlier in this session)
2. Drop the `src/` files into your working tree
3. `npm install` (no new dependencies were added) then re-run
   `tsc -b --force` / ESLint / `vite build` yourself as a final sanity
   check before committing
4. The Dexie `version(29)` migration runs automatically on next app
   load for any existing user — no manual step needed
