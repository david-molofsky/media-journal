/**
 * TMDB (The Movie Database) metadata lookup for films and TV shows.
 *
 * Uses the v3 REST API with the Read Access Token (Bearer auth).
 *
 * Attribution required by TMDB terms:
 * "This product uses the TMDB API but is not endorsed or certified by TMDB."
 * https://developer.themoviedb.org/docs/getting-started
 */

import type { SearchResult } from './openLibraryService';
import { getSetting } from '@/services/database/settingsService';
export type { SearchResult };

// ── Config ───────────────────────────────────────────────────────────────────

const TMDB_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2Y2I0MjVmOTRiM2U4NDk4ZTNhYTM4NmE1ZDYzMmZmMiIsIm5iZiI6MTc4MjkwNjg2OS4xNjgsInN1YiI6IjZhNDRmZmY1M2UzZGRmYjE0Mzk5N2Y2MSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.dthd2Fd1XszE7SyoYYoWIHOhk-1bNgr6lxGn0LpoHHM';

const BASE = 'https://api.themoviedb.org/3';

const HEADERS = {
  Authorization: `Bearer ${TMDB_TOKEN}`,
  accept: 'application/json',
};

// ── Internal helpers ─────────────────────────────────────────────────────────

async function tmdbGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`TMDB API error ${res.status}`);
  return res.json() as Promise<T>;
}

interface TmdbCrewMember { job: string; department: string; name: string; }
interface TmdbCastMember { order: number; name: string; }
interface TmdbPerson { name: string; }

// ── Watch providers (JustWatch, via TMDB's partnership) ─────────────────────
//
// TMDB attribution requirement: "Powered by our partnership with
// JustWatch" — see https://developer.themoviedb.org/reference/movie-watch-providers.
// The caption shown under the search box in MetadataSearch.tsx credits
// JustWatch whenever this data could have been used (Film/TV), rather
// than only when a match happens to be found, since a call may still
// have been made even if nothing matched.

/** Fallback region for provider lookups when no Settings > Region value
 * has been chosen yet — matches the value that used to be hardcoded
 * here, so existing installs see no behaviour change until the user
 * actively picks a different region. See getWatchProviderRegion. */
const DEFAULT_WATCH_PROVIDER_REGION = 'GB';

/** Reads the user's configured region (Settings > Region) for TMDB/
 * JustWatch watch-provider lookups only — doesn't affect metadata
 * language, search results, or anything else TMDB-related. Manual
 * rather than geolocation-based, per David's call: avoids a GPS
 * permission prompt and stays correct while travelling (an entry
 * logged abroad still reflects home-region availability). */
async function getWatchProviderRegion(): Promise<string> {
  return getSetting('watchProviderRegion', DEFAULT_WATCH_PROVIDER_REGION);
}

interface TmdbWatchProvider {
  provider_name: string;
}

interface TmdbWatchProviderRegion {
  flatrate?: TmdbWatchProvider[];
  rent?: TmdbWatchProvider[];
  buy?: TmdbWatchProvider[];
}

interface TmdbWatchProviders {
  results?: Record<string, TmdbWatchProviderRegion>;
}

/** Maps TMDB/JustWatch's own provider naming onto this app's Source
 * suggestion list wording, so an auto-filled value lands on an
 * existing suggestion rather than creating a near-duplicate (e.g.
 * "Disney Plus" vs "Disney+"). Providers with no mapping are passed
 * through as free text rather than dropped — Source is a free-solo
 * field, so an unmapped value is still useful, just not suggestion-list-exact. */
const PROVIDER_NAME_MAP: Record<string, string> = {
  'Disney Plus': 'Disney+',
  'Amazon Prime Video': 'Amazon Prime Video',
  'Apple TV Plus': 'Apple TV+',
  Netflix: 'Netflix',
  Max: 'Max',
  Hulu: 'Hulu',
};

/** Picks a single best-guess Source value from a title's watch
 * providers in `WATCH_PROVIDER_REGION`: subscription (flatrate) first,
 * then rental, then purchase. Returns `undefined` if the title has no
 * availability data for that region — Source is then left blank for
 * manual entry, same as before this feature existed. */
function extractSource(
  watchProviders: TmdbWatchProviders | undefined,
  region: string,
): string | undefined {
  const regionData = watchProviders?.results?.[region];
  if (!regionData) return undefined;

  const best = regionData.flatrate?.[0] ?? regionData.rent?.[0] ?? regionData.buy?.[0];
  if (!best) return undefined;

  return PROVIDER_NAME_MAP[best.provider_name] ?? best.provider_name;
}

// ── Genres ───────────────────────────────────────────────────────────────────
//
// TMDB's genre names don't always match this app's Genre suggestion
// list wording — some TV genres in particular combine two concepts
// into one ("Sci-Fi & Fantasy", "Action & Adventure") that this app
// treats as two separate genres. Names not listed here pass through
// unchanged, since Genres is a free-solo field same as Source/Tags —
// an unmapped value is still useful, just not suggestion-list-exact.
// Note: TMDB has no dedicated "Superhero" genre — those titles are
// filed under Action/Adventure/Sci-Fi & Fantasy instead, so this
// mapping can never produce "Superhero" on its own.
const GENRE_NAME_MAP: Record<string, string[]> = {
  'Science Fiction': ['Sci-Fi'],
  'Sci-Fi & Fantasy': ['Sci-Fi', 'Fantasy'],
  'Action & Adventure': ['Action', 'Adventure'],
  'War & Politics': ['War'],
};

interface TmdbGenre { name: string; }

/** Maps TMDB's genre list onto this app's Genre vocabulary. Returns
 * `undefined` (rather than an empty array) when there's nothing to
 * fill, consistent with how `extractSource` signals "nothing found". */
function extractGenres(genres: TmdbGenre[] | undefined): string[] | undefined {
  if (!genres || genres.length === 0) return undefined;
  const mapped = genres.flatMap((g) => GENRE_NAME_MAP[g.name] ?? [g.name]);
  return Array.from(new Set(mapped));
}

// ── Series (TMDB "collection") ──────────────────────────────────────────────
//
// TMDB's `belongs_to_collection` is film-only (TV has no equivalent
// concept), and its `name` usually ends in the literal word
// "Collection" (e.g. "Dune Collection"). Stripping that suffix gives a
// cleaner value for this app's Series field than reproducing TMDB's
// own naming convention verbatim.
function extractSeriesFromCollection(collectionName: string | undefined): string | undefined {
  if (!collectionName) return undefined;
  return collectionName.replace(/\s+collection$/i, '').trim() || undefined;
}

// ── Films ────────────────────────────────────────────────────────────────────

interface TmdbMovieSearchResult {
  id: number;
  title: string;
  release_date?: string;
}

interface TmdbCollection { name: string; }
interface TmdbProductionCompany { name: string; }

interface TmdbMovieDetails {
  id: number;
  title: string;
  genres?: TmdbGenre[];
  overview?: string;
  runtime?: number;
  poster_path?: string;
  belongs_to_collection?: TmdbCollection;
  production_companies?: TmdbProductionCompany[];
  credits: {
    crew: TmdbCrewMember[];
    cast: TmdbCastMember[];
  };
  'watch/providers'?: TmdbWatchProviders;
}

/**
 * Searches TMDB for films by title. Returns basic info for the
 * dropdown — director/cast are fetched separately via `getFilmDetails`
 * once the user makes a selection (to avoid 6× unnecessary API calls).
 */
export async function searchFilms(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const data = await tmdbGet<{ results: TmdbMovieSearchResult[] }>(
    `/search/movie?query=${encodeURIComponent(query)}&language=en-US&page=1`,
  );

  return data.results.slice(0, 6).map((movie) => ({
    id: String(movie.id),
    title: movie.title,
    subtitle: movie.release_date ? movie.release_date.slice(0, 4) : '',
    fields: {}, // populated by getFilmDetails on selection
  }));
}

/**
 * Fetches director, screenwriter and cast for a film. Called once the
 * user selects a search result — not during the search itself.
 */
export async function getFilmDetails(
  tmdbId: string,
): Promise<{ title: string; fields: Record<string, string>; genres?: string[] }> {
  const data = await tmdbGet<TmdbMovieDetails>(
    `/movie/${tmdbId}?append_to_response=credits,watch/providers&language=en-US`,
  );

  const crew = data.credits?.crew ?? [];
  const cast = data.credits?.cast ?? [];

  const director = crew.find((c) => c.job === 'Director')?.name ?? '';
  const screenwriter = crew
    .filter((c) => ['Screenplay', 'Writer', 'Story'].includes(c.job))
    .map((c) => c.name)
    .slice(0, 3)
    .join(', ');
  const castNames = cast
    .sort((a, b) => a.order - b.order)
    .slice(0, 5)
    .map((c) => c.name)
    .join(', ');
  const region = await getWatchProviderRegion();
  const source = extractSource(data['watch/providers'], region);

  const fields: Record<string, string> = {};
  if (director) fields['director'] = director;
  if (screenwriter) fields['screenwriter'] = screenwriter;
  if (castNames) fields['cast'] = castNames;
  if (source) fields['source'] = source;

  // Auto-fill toggles (Settings > Metadata auto-fill). Each is read
  // independently so turning one off never affects the others — and all
  // default to `true` except poster, which is opt-in.
  const [
    autofillOverview,
    autofillRuntime,
    autofillProductionCompany,
    autofillSeries,
    autofillPoster,
  ] = await Promise.all([
    getSetting('autofillOverview', true),
    getSetting('autofillRuntime', true),
    getSetting('autofillProductionCompany', true),
    getSetting('autofillSeries', true),
    getSetting('autofillPoster', false),
  ]);

  if (autofillOverview && data.overview) fields['overview'] = data.overview;
  if (autofillRuntime && data.runtime) fields['runtime'] = String(data.runtime);
  if (autofillProductionCompany && data.production_companies?.[0]?.name) {
    fields['productionCompany'] = data.production_companies[0].name;
  }
  if (autofillSeries) {
    const series = extractSeriesFromCollection(data.belongs_to_collection?.name);
    if (series) fields['series'] = series;
  }
  // Poster stores TMDB's image *path* only (e.g. "/abc123.jpg"), not the
  // image itself — kept light for storage and any future sync payload.
  // Callers combine it with TMDB's image base URL when rendering.
  if (autofillPoster && data.poster_path) fields['posterPath'] = data.poster_path;

  return { title: data.title, fields, genres: extractGenres(data.genres) };
}

// ── TV ───────────────────────────────────────────────────────────────────────

interface TmdbTVSearchResult {
  id: number;
  name: string;
  first_air_date?: string;
}

interface TmdbNetwork { name: string; }

interface TmdbTVDetails {
  id: number;
  name: string;
  genres?: TmdbGenre[];
  overview?: string;
  /** TMDB returns an array (episode runtimes can vary); the first entry
   * is used as the representative runtime. */
  episode_run_time?: number[];
  poster_path?: string;
  status?: string;
  networks?: TmdbNetwork[];
  created_by: TmdbPerson[];
  credits: {
    crew: TmdbCrewMember[];
    cast: TmdbCastMember[];
  };
  'watch/providers'?: TmdbWatchProviders;
}

/**
 * Searches TMDB for TV shows by title.
 */
export async function searchTV(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const data = await tmdbGet<{ results: TmdbTVSearchResult[] }>(
    `/search/tv?query=${encodeURIComponent(query)}&language=en-US&page=1`,
  );

  return data.results.slice(0, 6).map((show) => ({
    id: String(show.id),
    title: show.name,
    subtitle: show.first_air_date ? show.first_air_date.slice(0, 4) : '',
    fields: {},
  }));
}

/**
 * Fetches creator, showrunner and cast for a TV show.
 */
export async function getTVDetails(
  tmdbId: string,
): Promise<{ title: string; fields: Record<string, string>; genres?: string[] }> {
  const data = await tmdbGet<TmdbTVDetails>(
    `/tv/${tmdbId}?append_to_response=credits,watch/providers&language=en-US`,
  );

  const crew = data.credits?.crew ?? [];
  const cast = data.credits?.cast ?? [];
  const createdBy = data.created_by ?? [];

  const creator = createdBy.map((p) => p.name).slice(0, 3).join(', ');
  // TMDB doesn't have a dedicated showrunner field; Executive Producer
  // is the closest proxy and is usually the current showrunner.
  const showrunner = crew.find((c) => c.job === 'Executive Producer')?.name ?? '';
  const castNames = cast
    .sort((a, b) => a.order - b.order)
    .slice(0, 5)
    .map((c) => c.name)
    .join(', ');
  const region = await getWatchProviderRegion();
  const source = extractSource(data['watch/providers'], region);

  const fields: Record<string, string> = {};
  if (creator) fields['creator'] = creator;
  if (showrunner) fields['showrunner'] = showrunner;
  if (castNames) fields['cast'] = castNames;
  if (source) fields['source'] = source;

  // Auto-fill toggles — same settings as getFilmDetails, minus Series:
  // TMDB has no "collection" concept for TV, so it's never auto-filled
  // here (it stays a manually-editable field on the TV type).
  const [autofillOverview, autofillRuntime, autofillProductionCompany, autofillTvStatus, autofillPoster] =
    await Promise.all([
      getSetting('autofillOverview', true),
      getSetting('autofillRuntime', true),
      getSetting('autofillProductionCompany', true),
      getSetting('autofillTvStatus', true),
      getSetting('autofillPoster', false),
    ]);

  if (autofillOverview && data.overview) fields['overview'] = data.overview;
  if (autofillRuntime && data.episode_run_time?.[0]) fields['runtime'] = String(data.episode_run_time[0]);
  if (autofillProductionCompany && data.networks?.[0]?.name) fields['network'] = data.networks[0].name;
  if (autofillTvStatus && data.status) fields['tvStatus'] = data.status;
  if (autofillPoster && data.poster_path) fields['posterPath'] = data.poster_path;

  return { title: data.name, fields, genres: extractGenres(data.genres) };
}

// ── IMDb id lookup (used by IMDb import — direct ID matching rather
// than the title/year search the Letterboxd import relies on) ────────────────

interface TmdbFindMovieResult { id: number; }
interface TmdbFindTVResult { id: number; }
interface TmdbFindEpisodeResult { id: number; show_id: number; season_number: number; episode_number: number; }

export interface ImdbFindResult {
  /** A film's TMDB id, when the IMDb id resolves to a movie. */
  movieId?: string;
  /** A show's TMDB id, when the IMDb id resolves to the show itself
   * (an IMDb "TV Series"/"TV Mini Series" row rates the show, not an
   * episode). */
  tvId?: string;
  /** Present when the IMDb id resolves to a single episode — `showId`
   * is the parent show's TMDB id, used to group episode rows under
   * their show for the per-show season prompt. */
  episode?: { showId: string; seasonNumber: number; episodeNumber: number };
}

/**
 * Resolves an IMDb id (the `Const` column in an IMDb ratings export) to
 * TMDB via the /find endpoint's external-id lookup — a direct match,
 * not a fuzzy title/year search, so there's no ambiguous-candidates
 * step for IMDb import the way there is for Letterboxd's title-based
 * matching. Returns an empty object if nothing matches.
 */
export async function findByImdbId(imdbId: string): Promise<ImdbFindResult> {
  const data = await tmdbGet<{
    movie_results: TmdbFindMovieResult[];
    tv_results: TmdbFindTVResult[];
    tv_episode_results: TmdbFindEpisodeResult[];
  }>(`/find/${imdbId}?external_source=imdb_id`);

  const movie = data.movie_results?.[0];
  if (movie) return { movieId: String(movie.id) };

  const tv = data.tv_results?.[0];
  if (tv) return { tvId: String(tv.id) };

  const episode = data.tv_episode_results?.[0];
  if (episode) {
    return {
      episode: {
        showId: String(episode.show_id),
        seasonNumber: episode.season_number,
        episodeNumber: episode.episode_number,
      },
    };
  }

  return {};
}

interface TmdbSeasonSummary { season_number: number; }
interface TmdbShowSummary { name: string; seasons?: TmdbSeasonSummary[]; }

/**
 * A show's display title and real season-number list (excluding season
 * 0, TMDB's convention for specials/extras) — used to build the
 * per-show season prompt's checkbox list, so it always reflects every
 * season the show actually has rather than only the ones with IMDb
 * episode-rating evidence.
 */
export async function getTVShowSummary(
  tmdbId: string,
): Promise<{ title: string; seasonNumbers: number[] }> {
  const data = await tmdbGet<TmdbShowSummary>(`/tv/${tmdbId}`);
  const seasonNumbers = (data.seasons ?? [])
    .map((s) => s.season_number)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  return { title: data.name, seasonNumbers };
}
