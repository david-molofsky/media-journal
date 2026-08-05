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
import { hasMetadataSearch } from '@/utils/metadataSearchSupport';
import type { SearchResult } from '@/services/metadata/openLibraryService';

interface MetadataSearchProps {
  mediaTypeId: string;
  /** Called with title + pre-filled metadata fields when the user
   * selects a result. The receiving form calls setValue for each.
   * `genres`, when present, should be merged into the form's existing
   * genres rather than overwriting them. */
  onFill: (title: string, fields: Record<string, string>, genres?: string[]) => void;
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

function getSearchFn(
  mediaTypeId: string,
): ((q: string) => Promise<SearchResult[]>) | null {
  if (mediaTypeId === 'book' || mediaTypeId === 'audiobook') return searchBooks;
  if (mediaTypeId === 'film') return searchFilms;
  if (mediaTypeId === 'tv') return searchTV;
  if (mediaTypeId === 'comic') return searchSeries;
  return null;
}

/** Paginated counterpart of `getSearchFn`, used for every page after
 * the first (see infinite-scroll comment on the component below).
 * `cursor` means "TMDB page number" for film/tv and "row offset" for
 * Open Library/ComicVine — `getStartCursor`/`getNextCursor` below hide
 * that difference from the rest of the component. */
function getSearchPageFn(
  mediaTypeId: string,
): ((q: string, cursor: number) => Promise<{ results: SearchResult[]; hasMore: boolean }>) | null {
  if (mediaTypeId === 'book' || mediaTypeId === 'audiobook') return searchBooksPage;
  if (mediaTypeId === 'film') return searchFilmsPage;
  if (mediaTypeId === 'tv') return searchTVPage;
  if (mediaTypeId === 'comic') return searchSeriesPage;
  return null;
}

function getStartCursor(mediaTypeId: string): number {
  return mediaTypeId === 'film' || mediaTypeId === 'tv' ? 1 : 0;
}

function getNextCursor(mediaTypeId: string, currentCursor: number, resultsCount: number): number {
  // TMDB pages are a fixed size server-side, so the next request is
  // simply "page + 1" regardless of how many results came back. Open
  // Library/ComicVine are offset-based, so the next request starts
  // right after the rows just received.
  return mediaTypeId === 'film' || mediaTypeId === 'tv' ? currentCursor + 1 : currentCursor + resultsCount;
}

async function fetchDetails(
  mediaTypeId: string,
  result: SearchResult,
): Promise<{ fields: Record<string, string>; genres?: string[] }> {
  // Open Library and ComicVine results already contain all fields (and
  // any genre guesses) in one call — ComicVine series search returns
  // series + publisher directly, with credits/cover date/cover image
  // deferred to a separate "Fetch issue details" step in EntryForm
  // once an issue number is known (see comicVineService.ts).
  if (Object.keys(result.fields).length > 0) return { fields: result.fields, genres: result.genres };
  // TMDB results need a second call to get director/cast/creator/genres.
  if (mediaTypeId === 'film') return getFilmDetails(result.id);
  if (mediaTypeId === 'tv') return getTVDetails(result.id);
  return { fields: {} };
}

/**
 * Optional metadata search shown at the top of the entry form for
 * supported media types (book, audiobook, film, tv, comic). The user
 * can type a title, pick a result, and have the form pre-filled — or
 * ignore it entirely and fill the form manually.
 *
 * Books/Audiobooks use Open Library (no key, one API call).
 * Films use TMDB (two calls: search then credits on selection).
 * TV shows use TMDB (two calls: search then details on selection).
 * Comic Issues use ComicVine (one call here — series + publisher only;
 * credits/cover date/cover image need an issue number, which isn't
 * known yet at this point in the form, so that's a separate "Fetch
 * issue details" step further down EntryForm instead).
 *
 * Infinite scroll: the initial debounced search still uses the plain
 * `searchFn` (page 1 / offset 0, capped at 15 — unchanged from
 * before), so the first paint is identical to before this was added.
 * Scrolling near the bottom of the results listbox fetches a further
 * page via `searchPageFn` and appends it, until a source reports no
 * more results are available.
 */
export function MetadataSearch({ mediaTypeId, onFill }: MetadataSearchProps) {
  const source = getSource(mediaTypeId);
  const searchFn = getSearchFn(mediaTypeId);
  const searchPageFn = getSearchPageFn(mediaTypeId);

  const [options, setOptions] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
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
  const [inputValue, setInputValue] = useState('');
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
  // Where the *next* load-more request should start (TMDB page number,
  // or an Open Library/ComicVine row offset — see getStartCursor).
  const cursorRef = useRef(0);

  const handleInputChange = useCallback(
    (_: React.SyntheticEvent, value: string) => {
      setInputValue(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!value.trim() || !searchFn) {
        requestIdRef.current += 1; // invalidate any still-pending request too
        setOptions([]);
        setSearchError(null);
        setHasMore(false);
        setEverLoadedMore(false);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        const requestId = ++requestIdRef.current;
        setSearching(true);
        setSearchError(null);
        setEverLoadedMore(false);
        try {
          const results = await searchFn(value);
          if (requestIdRef.current !== requestId) return; // superseded — drop it
          setOptions(results);
          cursorRef.current = getNextCursor(mediaTypeId, getStartCursor(mediaTypeId), results.length);
          // A fresh search only knows whether a further page exists
          // once it's actually requested one — a full first page (15
          // results) is a reasonable signal there's probably more,
          // without an extra request just to find out for certain.
          setHasMore(results.length >= 15 && !!searchPageFn);
        } catch (err) {
          if (requestIdRef.current !== requestId) return;
          if (err instanceof OpenLibraryTimeoutError) {
            setSearchError("Open Library isn't responding — try again in a moment.");
          }
          setOptions([]);
          setHasMore(false);
        } finally {
          if (requestIdRef.current === requestId) setSearching(false);
        }
      }, 350);
    },
    [searchFn, searchPageFn, mediaTypeId],
  );

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || loadingMore || searching || fetching || !searchPageFn || !inputValue.trim()) return;
    const requestId = ++requestIdRef.current;
    setLoadingMore(true);
    try {
      const page = await searchPageFn(inputValue, cursorRef.current);
      if (requestIdRef.current !== requestId) return; // superseded — drop it
      setOptions((prev) => [...prev, ...page.results]);
      cursorRef.current = getNextCursor(mediaTypeId, cursorRef.current, page.results.length);
      setHasMore(page.hasMore);
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
  }, [hasMore, loadingMore, searching, fetching, searchPageFn, inputValue, mediaTypeId]);

  const handleListboxScroll = useCallback(
    (event: React.UIEvent<HTMLUListElement>) => {
      const el = event.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) {
        void handleLoadMore();
      }
    },
    [handleLoadMore],
  );

  const handleChange = async (_: React.SyntheticEvent, value: SearchResult | null) => {
    if (!value || isSentinel(value)) return;
    requestIdRef.current += 1; // invalidate any still-pending search/load-more
    setFetching(true);
    const idKey = getSourceIdKey(mediaTypeId);
    try {
      const { fields, genres } = await fetchDetails(mediaTypeId, value);
      onFill(value.title, idKey ? { ...fields, [idKey]: value.id } : fields, genres);
      // Clear the search so the field doesn't show the selected title twice.
      setInputValue('');
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
        ? 'Data provided by ComicVine. Search a series first, then use Fetch issue details for credits.'
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
      <Autocomplete<SearchResult, false, false, false>
        options={displayOptions}
        inputValue={inputValue}
        onInputChange={handleInputChange}
        onChange={handleChange}
        loading={searching || fetching}
        loadingText={fetching ? 'Fetching details…' : 'Searching…'}
        noOptionsText={
          searchError
            ? searchError
            : inputValue.trim()
              ? searching ? 'Searching…' : 'No results found'
              : 'Type to search'
        }
        getOptionLabel={(option) => (isSentinel(option) ? '' : option.title)}
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
            label="Search to pre-fill"
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
      <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
        {attribution}
      </Typography>
    </Box>
  );
}
