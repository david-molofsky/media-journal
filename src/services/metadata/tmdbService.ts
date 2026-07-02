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

/** Region used for provider lookups. Fixed rather than derived from
 * device locale for now — matches David's usage, and a wrong guess
 * (e.g. defaulting to US for a non-US user) would silently mis-fill
 * Source with unavailable services. Revisit if this app grows beyond
 * personal use. */
const WATCH_PROVIDER_REGION = 'GB';

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
function extractSource(watchProviders: TmdbWatchProviders | undefined): string | undefined {
  const regionData = watchProviders?.results?.[WATCH_PROVIDER_REGION];
  if (!regionData) return undefined;

  const best = regionData.flatrate?.[0] ?? regionData.rent?.[0] ?? regionData.buy?.[0];
  if (!best) return undefined;

  return PROVIDER_NAME_MAP[best.provider_name] ?? best.provider_name;
}

// ── Films ────────────────────────────────────────────────────────────────────

interface TmdbMovieSearchResult {
  id: number;
  title: string;
  release_date?: string;
}

interface TmdbMovieDetails {
  id: number;
  title: string;
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
export async function getFilmDetails(tmdbId: string): Promise<Record<string, string>> {
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
  const source = extractSource(data['watch/providers']);

  const fields: Record<string, string> = {};
  if (director) fields['director'] = director;
  if (screenwriter) fields['screenwriter'] = screenwriter;
  if (castNames) fields['cast'] = castNames;
  if (source) fields['source'] = source;

  return fields;
}

// ── TV ───────────────────────────────────────────────────────────────────────

interface TmdbTVSearchResult {
  id: number;
  name: string;
  first_air_date?: string;
}

interface TmdbTVDetails {
  id: number;
  name: string;
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
export async function getTVDetails(tmdbId: string): Promise<Record<string, string>> {
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
  const source = extractSource(data['watch/providers']);

  const fields: Record<string, string> = {};
  if (creator) fields['creator'] = creator;
  if (showrunner) fields['showrunner'] = showrunner;
  if (castNames) fields['cast'] = castNames;
  if (source) fields['source'] = source;

  return fields;
}
