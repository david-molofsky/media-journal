import { useState, useRef, useCallback } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import SearchIcon from '@mui/icons-material/Search';
import InputAdornment from '@mui/material/InputAdornment';
import { searchBooks, searchBooksPage, OpenLibraryTimeoutError } from '@/services/metadata/openLibraryService';
import {
  searchFilms,
  searchFilmsPage,
  getFilmDetails,
  searchTV,
  searchTVPage,
  getTVDetails,
} from '@/services/metadata/tmdbService';
import { searchSeries, searchSeriesPage } from '@/services/metadata/comicVineService';
import { searchGoogleBooksPage } from '@/services/metadata/googleBooksService';
import { hasMetadataSearch } from '@/utils/metadataSearchSupport';
import type { SearchResult } from '@/services/metadata/openLibraryService';

interface MetadataSearchProps {
  mediaTypeId: string;
  /** Called with title + pre-filled metadata fields when the user
   * selects a result. The receiving form calls setValue for each.
   * `genres`, when present, should be merged into the form's existing
   * genres rather than overwriting them. */
  onFill: (title: string, fields: Record<string, string>, genres?: string[]) => void;
  /** Called on every keystroke in the search-narrowing field below
   * Title (labeled "Writer" for Comic, "Author" everywhere else it
   * appears — see chat, Aug 2026) — mirrors it live into the entry's
   * actual persisted Author (Book/Audiobook) or Writer (Comic) field, the
   * same way titleValue/onTitleChange already mirror the Title field,
   * so the person doesn't have to type the name twice. If a search
   * result is later selected, onFill's own `fields.author` (or, for
   * Comic, a later "Fetch issue details" call's `fields.writer`)
   * still overwrites this with the authoritative value — same
   * precedence Title already has. Omitted entirely for media types
   * with no Author field (Film/TV), same as the Author TextField
   * itself.
   */
  onAuthorTyped?: (value: string) => void;
  /** Seeds the Author search-narrowing field's initial value — for
   * Edit Entry, where metadata.author/writer may already be set. Only
   * read once on mount (matches how the Author box is otherwise
   * self-contained, ephemeral state); doesn't stay reactive to
   * external changes after that, same as titleValue does stay
   * reactive (it's the actual controlled field) but this isn't. */
  initialAuthor?: string;
  /** This field doubles as the Title field (see chat, Aug 2026) — the
   * parent owns the actual title value via react-hook-form's
   * Controller, so typing here (whether or not a result gets picked)
   * writes straight to the form's title, and nothing needs re-typing
   * if a search comes up empty. */
  titleValue: string;
  onTitleChange: (value: string) => void;
  onTitleBlur?: () => void;
  required?: boolean;
  error?: boolean;
  helperText?: string;
}

type Source = 'openlibrary' | 'tmdb' | 'comicvine' | null;

/** Sentinel id for the non-selectable footer row appended to `options`
 * while a further page is loading, or once every page has been
 * loaded. Kept out of band from real result ids (which are always
 * ComicVine/TMDB numeric ids or Open Library `/works/...` keys) by
 * using an id shape neither source can produce. */
const LOAD_MORE_SENTINEL_ID = '__mj_load_more__';

function isSentinel(option: SearchResult): boolean {
  return option.id === LOAD_MORE_SENTINEL_ID;
}

/**
 * Hidden metadata key each supported media type's source id gets
 * stored under (mirrors the posterPath/coverImagePath pattern — not
 * in defaultMediaTypes.ts's `fields[]`, but present in the per-type
 * Zod schema so it survives save). Persisted so a manually-searched
 * entry can later be re-shared as a smart link (see ShareEntrySheet /
 * shareMessageService), and so the shared-link Add Entry flow has an
 * id to resolve on the recipient's end.
 */
function getSourceIdKey(mediaTypeId: string): string | null {
  if (mediaTypeId === 'film' || mediaTypeId === 'tv') return 'tmdbId';
  if (mediaTypeId === 'book' || mediaTypeId === 'audiobook') return 'openLibraryKey';
  return null; // comic (series id alone can't resolve one issue) and others
}

function getSource(mediaTypeId: string): Source {
  if (!hasMetadataSearch(mediaTypeId)) return null;
  if (mediaTypeId === 'book' || mediaTypeId === 'audiobook') return 'openlibrary';
  if (mediaTypeId === 'comic') return 'comicvine';
  return 'tmdb'; // film or tv — the only other types hasMetadataSearch allows
}

/** Whether this source's own pagination, once exhausted, should pivot
 * to a Google Books fallback rather than just stopping — see chat,
 * Aug 2026. TMDB (film/tv) has no fallback: Google Books doesn't cover
 * films/TV, so there's nothing to pivot to. */
function supportsGoogleBooksFallback(source: Source): boolean {
  return source === 'openlibrary' || source === 'comicvine';
}

/** Whether this source's *primary* search benefits from an author
 * filter on the initial/paginated call itself, not just the Google
 * Books fallback. Open Library's search.json accepts a scoped
 * `author` param directly (see openLibraryService.ts). ComicVine's
 * volume/series search has no author-equivalent concept — for comics,
 * the Author field only narrows the Google Books fallback once
 * ComicVine's own results are exhausted. */
function primarySearchAcceptsAuthor(source: Source): boolean {
  return source === 'openlibrary';
}

async function fetchDetails(
  mediaTypeId: string,
  result: SearchResult,
): Promise<{ fields: Record<string, string>; genres?: string[] }> {
  // Open Library, ComicVine and Google Books results already contain
  // all fields (and any genre guesses) in one call — ComicVine series
  // search returns series + publisher directly, with credits/cover
  // date/cover image deferred to a separate "Fetch issue details" step
  // in EntryForm once an issue number is known (see comicVineService.ts).
  if (Object.keys(result.fields).length > 0) return { fields: result.fields, genres: result.genres };
  // TMDB results need a second call to get director/cast/creator/genres.
  if (mediaTypeId === 'film') return getFilmDetails(result.id);
  if (mediaTypeId === 'tv') return getTVDetails(result.id);
  return { fields: {} };
}

/**
 * Title field for supported media types (book, audiobook, film, tv,
 * comic) that doubles as a metadata search — the same field the user
 * types the title into is also what searches Open Library/TMDB/
 * ComicVine, so nothing needs re-entering if a search comes up empty
 * (see chat, Aug 2026; was two separate fields before this). The user
 * can pick a result to pre-fill the form, or just keep typing and
 * whatever's typed becomes the title directly. Unsupported media
 * types render nothing here — EntryForm falls back to a plain Title
 * TextField for those.
 *
 * Books/Audiobooks use Open Library (no key, one API call).
 * Films use TMDB (two calls: search then credits on selection).
 * TV shows use TMDB (two calls: search then details on selection).
 * Comic Issues use ComicVine (one call here — series + publisher only;
 * credits/cover date/cover image need an issue number, which isn't
 * known yet at this point in the form, so that's a separate "Fetch
 * issue details" step further down EntryForm instead).
 *
 * Author field (book/audiobook + comic only — see chat, Aug 2026):
 * narrows short/common titles ("Wicked", "Villain") that otherwise
 * return an unmanageable number of unrelated matches. For Open
 * Library this narrows the primary search itself; for ComicVine
 * (which has no author-equivalent search parameter) it only narrows
 * the Google Books fallback once ComicVine's own results run out.
 * This field is search-only — typing here doesn't write to the
 * entry's own persisted Author field; that's still filled from
 * whichever result gets selected, same as before.
 *
 * Infinite scroll + Google Books fallback: the initial debounced
 * search still uses the plain `searchFn` (page 1, capped at 15 —
 * unchanged from before this was added). Scrolling near the bottom of
 * the results listbox fetches a further page via `searchPageFn` and
 * appends it. Once the primary source (Open Library/ComicVine) itself
 * reports no more results, the *next* scroll-triggered fetch pivots
 * to Google Books instead — same listbox, same footer row, no visible
 * seam or source label (see chat: "I don't think the user will
 * actually care" which source a result came from). TMDB (film/tv) has
 * no fallback and just stops once exhausted, as before.
 */
export function MetadataSearch({
  mediaTypeId,
  onFill,
  onAuthorTyped,
  initialAuthor,
  titleValue,
  onTitleChange,
  onTitleBlur,
  required,
  error,
  helperText,
}: MetadataSearchProps) {
  const source = getSource(mediaTypeId);
  const fallbackApplicable = supportsGoogleBooksFallback(source);
  const showAuthorField = source === 'openlibrary' || source === 'comicvine';

  const [options, setOptions] = useState<SearchResult[]>([]);
  const [authorFilter, setAuthorFilter] = useState(initialAuthor ?? '');
  const [searching, setSearching] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  // True once any Google Books result has actually appeared in the
  // current result set — drives the attribution caption switch (see
  // chat: switches as soon as a result appears, not deferred until
  // one's selected, since the Worker/key were confirmed live first).
  const [usedGoogleBooksFallback, setUsedGoogleBooksFallback] = useState(false);
  // Only shows the "No more results" footer once the user has actually
  // scrolled for more at least once — a short first page (e.g. a TV
  // search with 3 matches) shouldn't immediately claim there's "no
  // more" before the person has any reason to expect there might be.
  const [everLoadedMore, setEverLoadedMore] = useState(false);
  // Distinct message for the 8s Open Library timeout (see
  // openLibraryService.ts) — kept separate from the generic "No
  // results found" text so a hung Open Library request doesn't look
  // identical to a genuinely empty search.
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against out-of-order responses: typing further input after a
  // search has already fired starts a second in-flight request, and
  // network timing doesn't guarantee the first one resolves first. A
  // slow response to an earlier, less-specific query landing after a
  // newer, more-specific one previously overwrote it — the classic
  // symptom being "results don't get more accurate as I keep typing".
  // Only the response matching the most recently *fired* request is
  // applied; anything older is silently dropped. Also guards
  // load-more requests the same way — a fresh search invalidates any
  // in-flight "load more" for the previous query.
  const requestIdRef = useRef(0);
  // Where the *next* primary-source load-more request should start
  // (TMDB page number, or an Open Library/ComicVine row offset).
  const cursorRef = useRef(0);
  // Which source the *next* load-more call should hit. Starts at
  // 'primary' every fresh search; flips to 'googlebooks' once the
  // primary source reports exhausted and a fallback pivot happens.
  const activeSourceRef = useRef<'primary' | 'googlebooks'>('primary');
  // Separate Google Books startIndex cursor — independent of the
  // primary source's own cursor/offset scheme.
  const googleBooksCursorRef = useRef(0);

  const runInitialSearch = useCallback(
    async (value: string, author: string) => {
      const requestId = ++requestIdRef.current;
      setSearching(true);
      setSearchError(null);
      setEverLoadedMore(false);
      activeSourceRef.current = 'primary';
      googleBooksCursorRef.current = 0;
      setUsedGoogleBooksFallback(false);
      try {
        let results: SearchResult[];
        if (mediaTypeId === 'book' || mediaTypeId === 'audiobook') {
          results = await searchBooks(value, author);
        } else if (mediaTypeId === 'film') {
          results = await searchFilms(value);
        } else if (mediaTypeId === 'tv') {
          results = await searchTV(value);
        } else if (mediaTypeId === 'comic') {
          results = await searchSeries(value);
        } else {
          results = [];
        }
        if (requestIdRef.current !== requestId) return; // superseded — drop it
        setOptions(results);
        cursorRef.current =
          mediaTypeId === 'film' || mediaTypeId === 'tv' ? 2 : results.length;
        // A fresh search only knows whether a further page exists
        // once it's actually requested one — a full first page (15
        // results) is a reasonable signal there's probably more,
        // without an extra request just to find out for certain. When
        // a Google Books fallback is applicable, `hasMore` stays true
        // even on a short/empty primary page, so the very first
        // scroll (or immediate load-more, for a genuinely empty
        // result) still gets one chance at Google Books before
        // declaring "no results" for real.
        const primaryFull = results.length >= 15;
        setHasMore(primaryFull || fallbackApplicable);
      } catch (err) {
        if (requestIdRef.current !== requestId) return;
        if (err instanceof OpenLibraryTimeoutError) {
          setSearchError("Open Library isn't responding — try again in a moment.");
        }
        setOptions([]);
        // Even a failed primary search still leaves a fallback worth
        // trying, rather than dead-ending immediately.
        setHasMore(fallbackApplicable);
      } finally {
        if (requestIdRef.current === requestId) setSearching(false);
      }
    },
    [mediaTypeId, fallbackApplicable],
  );

  const handleInputChange = useCallback(
    (_: React.SyntheticEvent, value: string) => {
      onTitleChange(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!value.trim() || !source) {
        requestIdRef.current += 1; // invalidate any still-pending request too
        setOptions([]);
        setSearchError(null);
        setHasMore(false);
        setEverLoadedMore(false);
        return;
      }
      debounceRef.current = setTimeout(() => {
        void runInitialSearch(value, authorFilter);
      }, 350);
    },
    [source, runInitialSearch, authorFilter, onTitleChange],
  );

  /** Author field changes re-fire the search the same debounced way
   * Title does, using whatever title is currently entered — narrowing
   * (or widening, if cleared) the existing query rather than requiring
   * the user to retype the title. */
  const handleAuthorChange = useCallback(
    (value: string) => {
      setAuthorFilter(value);
      onAuthorTyped?.(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!titleValue.trim() || !source) return;
      debounceRef.current = setTimeout(() => {
        void runInitialSearch(titleValue, value);
      }, 350);
    },
    [titleValue, source, runInitialSearch, onAuthorTyped],
  );

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || loadingMore || searching || fetching || !titleValue.trim()) return;
    const requestId = ++requestIdRef.current;
    setLoadingMore(true);
    try {
      if (activeSourceRef.current === 'primary') {
        let page: { results: SearchResult[]; hasMore: boolean } | null = null;
        if (mediaTypeId === 'book' || mediaTypeId === 'audiobook') {
          page = await searchBooksPage(titleValue, cursorRef.current, authorFilter);
        } else if (mediaTypeId === 'film') {
          page = await searchFilmsPage(titleValue, cursorRef.current);
        } else if (mediaTypeId === 'tv') {
          page = await searchTVPage(titleValue, cursorRef.current);
        } else if (mediaTypeId === 'comic') {
          page = await searchSeriesPage(titleValue, cursorRef.current);
        }
        if (requestIdRef.current !== requestId) return; // superseded — drop it

        if (page) {
          setOptions((prev) => [...prev, ...page.results]);
          cursorRef.current =
            mediaTypeId === 'film' || mediaTypeId === 'tv'
              ? cursorRef.current + 1
              : cursorRef.current + page.results.length;
        }

        if (page?.hasMore) {
          setHasMore(true);
        } else if (fallbackApplicable) {
          // Primary source just ran out — pivot to Google Books within
          // this same load-more call (see chat: the wireframe shows
          // this as one continuous scroll, not a second scroll event).
          const gbPage = await searchGoogleBooksPage(titleValue, authorFilter, 0);
          if (requestIdRef.current !== requestId) return;
          activeSourceRef.current = 'googlebooks';
          googleBooksCursorRef.current = gbPage.results.length;
          if (gbPage.results.length > 0) setUsedGoogleBooksFallback(true);
          setOptions((prev) => [...prev, ...gbPage.results]);
          setHasMore(gbPage.hasMore);
        } else {
          setHasMore(false);
        }
      } else {
        // Already pivoted — keep paging Google Books.
        const gbPage = await searchGoogleBooksPage(titleValue, authorFilter, googleBooksCursorRef.current);
        if (requestIdRef.current !== requestId) return;
        googleBooksCursorRef.current += gbPage.results.length;
        if (gbPage.results.length > 0) setUsedGoogleBooksFallback(true);
        setOptions((prev) => [...prev, ...gbPage.results]);
        setHasMore(gbPage.hasMore);
      }
      setEverLoadedMore(true);
    } catch {
      if (requestIdRef.current !== requestId) return;
      // A failed "load more" just stops offering more — the results
      // already on screen stay usable, so this doesn't need its own
      // error message the way the initial search does.
      setHasMore(false);
    } finally {
      if (requestIdRef.current === requestId) setLoadingMore(false);
    }
  }, [hasMore, loadingMore, searching, fetching, titleValue, mediaTypeId, authorFilter, fallbackApplicable]);

  const handleListboxScroll = useCallback(
    (event: React.UIEvent<HTMLUListElement>) => {
      const el = event.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) {
        void handleLoadMore();
      }
    },
    [handleLoadMore],
  );

  const handleChange = async (_: React.SyntheticEvent, value: SearchResult | string | null) => {
    if (!value || typeof value === 'string' || isSentinel(value)) return;
    requestIdRef.current += 1; // invalidate any still-pending search/load-more
    setFetching(true);
    const idKey = getSourceIdKey(mediaTypeId);
    try {
      const { fields, genres } = await fetchDetails(mediaTypeId, value);
      onFill(value.title, idKey ? { ...fields, [idKey]: value.id } : fields, genres);
      setOptions([]);
      setHasMore(false);
    } catch {
      // If the details fetch fails, still fill what we have.
      onFill(value.title, idKey ? { ...value.fields, [idKey]: value.id } : value.fields, value.genres);
    } finally {
      setFetching(false);
    }
  };

  if (!source) return null;

  const attribution =
    source === 'tmdb'
      ? 'This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability data provided by JustWatch.'
      : source === 'comicvine'
        ? usedGoogleBooksFallback
          ? 'Data provided by ComicVine and Google Books. Search a series first, then use Fetch issue details for credits.'
          : 'Data provided by ComicVine. Search a series first, then use Fetch issue details for credits.'
        : usedGoogleBooksFallback
          ? 'Search powered by Open Library and Google Books.'
          : 'Search powered by Open Library.';

  // The loading/end-of-results footer is appended as a non-selectable
  // "option" rather than rendered outside the Autocomplete, since MUI
  // only scrolls/sizes what's inside its own listbox — a sibling
  // element wouldn't scroll into view together with the real results.
  const displayOptions: SearchResult[] = loadingMore
    ? [...options, { id: LOAD_MORE_SENTINEL_ID, title: '', subtitle: '', fields: {} }]
    : !hasMore && everLoadedMore
      ? [...options, { id: LOAD_MORE_SENTINEL_ID, title: '', subtitle: '', fields: {} }]
      : options;

  return (
    <Box>
      <Autocomplete<SearchResult, false, false, true>
        freeSolo
        options={displayOptions}
        inputValue={titleValue}
        onInputChange={handleInputChange}
        onChange={handleChange}
        onBlur={onTitleBlur}
        loading={searching || fetching}
        loadingText={fetching ? 'Fetching details…' : 'Searching…'}
        noOptionsText={
          searchError
            ? searchError
            : titleValue.trim()
              ? searching ? 'Searching…' : 'No results found — this will be used as the title as typed'
              : 'Type to search'
        }
        getOptionLabel={(option) => (typeof option === 'string' ? option : isSentinel(option) ? '' : option.title)}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        getOptionDisabled={(option) => isSentinel(option)}
        filterOptions={(x) => x} // server-side filtering only
        slotProps={{
          listbox: {
            sx: {
              maxHeight: 320,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
            },
            onScroll: handleListboxScroll,
          },
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Title"
            required={required}
            error={error}
            helperText={helperText}
            autoFocus
            placeholder={
              source === 'openlibrary'
                ? 'Search Open Library…'
                : source === 'comicvine'
                  ? 'Search ComicVine for a series…'
                  : mediaTypeId === 'film'
                    ? 'Search TMDB for a film…'
                    : 'Search TMDB for a TV show…'
            }
            slotProps={{
              input: {
                ...params.InputProps,
                startAdornment: (
                  <InputAdornment position="start">
                    {searching || fetching ? (
                      <CircularProgress size={16} />
                    ) : (
                      <SearchIcon fontSize="small" />
                    )}
                  </InputAdornment>
                ),
              },
            }}
          />
        )}
        renderOption={(props, option) => {
          if (isSentinel(option)) {
            // key/onClick etc. from `props` are deliberately dropped
            // here — this row isn't a real, selectable option.
            return (
              <Stack
                key="load-more-footer"
                direction="row"
                justifyContent="center"
                alignItems="center"
                spacing={1}
                sx={{ py: 1.25, pointerEvents: 'none' }}
              >
                {loadingMore ? (
                  <>
                    <CircularProgress size={13} />
                    <Typography variant="caption" color="text.secondary">
                      Loading more results…
                    </Typography>
                  </>
                ) : (
                  <Typography variant="caption" color="text.disabled">
                    No more results
                  </Typography>
                )}
              </Stack>
            );
          }
          return (
            <Box component="li" {...props} key={option.id}>
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  {option.title}
                </Typography>
                {option.subtitle && (
                  <Typography variant="caption" color="text.secondary">
                    {option.subtitle}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        }}
      />
      {showAuthorField && (
        <TextField
          fullWidth
          size="small"
          margin="dense"
          label={mediaTypeId === 'comic' ? 'Writer' : 'Author'}
          placeholder={
            mediaTypeId === 'comic'
              ? 'e.g. M. Alvarez — optional, narrows results'
              : 'e.g. Andy Weir — optional, narrows results'
          }
          value={authorFilter}
          onChange={(e) => handleAuthorChange(e.target.value)}
          helperText={
            primarySearchAcceptsAuthor(source)
              ? undefined
              : 'Narrows the Google Books fallback once ComicVine results run out'
          }
        />
      )}
      <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
        {attribution}
      </Typography>
    </Box>
  );
}
