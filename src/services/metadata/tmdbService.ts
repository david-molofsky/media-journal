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
    `/movie/${tmdbId}?append_to_response=credits&language=en-US`,
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

  const fields: Record<string, string> = {};
  if (director) fields['director'] = director;
  if (screenwriter) fields['screenwriter'] = screenwriter;
  if (castNames) fields['cast'] = castNames;

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
    `/tv/${tmdbId}?append_to_response=credits&language=en-US`,
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

  const fields: Record<string, string> = {};
  if (creator) fields['creator'] = creator;
  if (showrunner) fields['showrunner'] = showrunner;
  if (castNames) fields['cast'] = castNames;

  return fields;
}
