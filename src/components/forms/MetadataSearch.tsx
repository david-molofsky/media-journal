import { useState, useRef, useCallback } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import SearchIcon from '@mui/icons-material/Search';
import InputAdornment from '@mui/material/InputAdornment';
import { searchBooks } from '@/services/metadata/openLibraryService';
import {
  searchFilms,
  getFilmDetails,
  searchTV,
  getTVDetails,
} from '@/services/metadata/tmdbService';
import { searchSeries } from '@/services/metadata/comicVineService';
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
 */
export function MetadataSearch({ mediaTypeId, onFill }: MetadataSearchProps) {
  const source = getSource(mediaTypeId);
  const searchFn = getSearchFn(mediaTypeId);

  const [options, setOptions] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInputChange = useCallback(
    (_: React.SyntheticEvent, value: string) => {
      setInputValue(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!value.trim() || !searchFn) { setOptions([]); return; }

      debounceRef.current = setTimeout(async () => {
        setSearching(true);
        try {
          const results = await searchFn(value);
          setOptions(results);
        } catch {
          setOptions([]);
        } finally {
          setSearching(false);
        }
      }, 350);
    },
    [searchFn],
  );

  const handleChange = async (_: React.SyntheticEvent, value: SearchResult | null) => {
    if (!value) return;
    setFetching(true);
    try {
      const { fields, genres } = await fetchDetails(mediaTypeId, value);
      onFill(value.title, fields, genres);
      // Clear the search so the field doesn't show the selected title twice.
      setInputValue('');
      setOptions([]);
    } catch {
      // If the details fetch fails, still fill what we have.
      onFill(value.title, value.fields, value.genres);
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

  return (
    <Box>
      <Autocomplete<SearchResult, false, false, false>
        options={options}
        inputValue={inputValue}
        onInputChange={handleInputChange}
        onChange={handleChange}
        loading={searching || fetching}
        loadingText={fetching ? 'Fetching details…' : 'Searching…'}
        noOptionsText={
          inputValue.trim()
            ? searching ? 'Searching…' : 'No results found'
            : 'Type to search'
        }
        getOptionLabel={(option) => option.title}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        filterOptions={(x) => x} // server-side filtering only
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
        renderOption={(props, option) => (
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
        )}
      />
      <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
        {attribution}
      </Typography>
    </Box>
  );
}
