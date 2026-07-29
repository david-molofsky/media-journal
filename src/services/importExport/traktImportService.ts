import { createEntry } from '@/services/database/entryService';
import { getFilmDetails, getTVShowSummary } from '@/services/metadata/tmdbService';
import { toTitleCase } from '@/utils/toTitleCase';
import { importedFromTag } from '@/utils/importedFromTag';
import { db } from '@/services/database/db';
import {
  fetchMovieHistory,
  fetchEpisodeHistory,
  fetchMovieRatings,
  fetchWatchlist,
} from '@/services/metadata/traktService';
import { applyShowSeasons, type ShowGroup } from '@/services/importExport/imdbImportService';
import type { EntryMetadata } from '@/models';

/**
 * Imports Trakt history, ratings and watchlist into Film/TV entries.
 * TMDB ids come directly from Trakt's `ids.tmdb` on every item — no
 * fuzzy title matching needed, unlike Letterboxd/Goodreads/StoryGraph.
 *
 * Restructured into fetch → review → apply (see chat: the "tick box"
 * feature) — previously this fetched and created entries in one pass
 * with no way to review or exclude anything before it landed in the
 * Library. `fetchAndClassifyTrakt` does the read-only fetch/grouping
 * work; `applyTraktImport` creates entries for whatever the person
 * left ticked on the review screen.
 *
 * Movies: one entry per distinct watched_at date — a rewatched movie
 * with 3 history rows becomes 3 entries, per David's decision.
 *
 * TV: rolled up to season level using the same ShowGroup shape and
 * applyShowSeasons function the IMDb import already uses — reused as-is
 * rather than duplicated. Every season with at least one watched
 * episode starts ticked (no per-show prompt the way IMDb needs one —
 * IMDb requires a person's choice because a "TV Series" row alone is
 * ambiguous about which seasons were actually watched; Trakt's
 * episode-level history already tells us exactly that; the tick boxes
 * here are for opting *out* of something already unambiguous, not for
 * resolving ambiguity). Note this means TV rewatches do NOT get
 * separate entries the way movie rewatches do: a season is a single
 * entry (using its most recent watch date), consistent with how
 * applyShowSeasons already dedupes by (title, season).
 */

export interface TraktMovieReviewItem {
  key: string;
  tmdbId: string;
  title: string;
  completedDate: string;
  rating?: number;
  included: boolean;
}

export interface TraktShowReviewItem {
  key: string;
  tmdbShowId: string;
  title: string;
  seasonEvidence: Map<number, { count: number; latestDate?: string }>;
  includedSeasons: Set<number>;
}

export interface TraktWatchlistReviewItem {
  key: string;
  mediaType: 'film' | 'tv';
  title: string;
  included: boolean;
}

export interface TraktReviewData {
  movies: TraktMovieReviewItem[];
  duplicateMovieCount: number;
  shows: TraktShowReviewItem[];
  watchlist: TraktWatchlistReviewItem[];
  duplicateWatchlistCount: number;
}

function buildFilmMetadata(fields: Record<string, string>): EntryMetadata {
  const metadata: EntryMetadata = { source: 'Trakt' };
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'runtime') metadata[key] = Number(value);
    else metadata[key] = value;
  }
  return metadata;
}

async function loadExistingFilmKeys(): Promise<Set<string>> {
  const films = await db.mediaEntries.where('mediaType').equals('film').toArray();
  return new Set(
    films.filter((e) => e.completedDate).map((e) => `${e.title.trim().toLowerCase()}|${e.completedDate}`),
  );
}

async function loadExistingWishlistKeys(): Promise<Set<string>> {
  const [films, shows] = await Promise.all([
    db.mediaEntries.where('mediaType').equals('film').toArray(),
    db.mediaEntries.where('mediaType').equals('tv').toArray(),
  ]);
  return new Set(
    [...films, ...shows]
      .filter((e) => e.status === 'wishlist')
      .map((e) => `${e.mediaType}|${e.title.trim().toLowerCase()}`),
  );
}

export interface TraktFetchProgress {
  phase: 'movies' | 'shows' | 'watchlist';
  done: number;
  total: number;
}

/**
 * Fetches and groups everything, but creates nothing — every movie and
 * every evidenced show season starts ticked (`included`/
 * `includedSeasons`), ready for the review screen. Duplicates (already
 * in the Library) are excluded from the review list entirely — nothing
 * to review about them — but counted so the summary can still mention
 * them.
 */
export async function fetchAndClassifyTrakt(
  onProgress?: (progress: TraktFetchProgress) => void,
): Promise<TraktReviewData> {
  const [movieHistory, movieRatings, existingFilmKeys] = await Promise.all([
    fetchMovieHistory(),
    fetchMovieRatings(),
    loadExistingFilmKeys(),
  ]);

  const ratingByTmdbId = new Map(
    movieRatings.filter((r) => r.movie.ids.tmdb).map((r) => [String(r.movie.ids.tmdb), r.rating]),
  );

  const movies: TraktMovieReviewItem[] = [];
  let duplicateMovieCount = 0;
  const validMovieRows = movieHistory.filter((row) => row.movie.ids.tmdb);
  const seenMovieKeys = new Set<string>();
  for (let i = 0; i < validMovieRows.length; i += 1) {
    const row = validMovieRows[i]!;
    const tmdbId = String(row.movie.ids.tmdb);
    const completedDate = row.watched_at.slice(0, 10);
    const key = `${row.movie.title.trim().toLowerCase()}|${completedDate}`;
    onProgress?.({ phase: 'movies', done: i + 1, total: validMovieRows.length });

    if (existingFilmKeys.has(key) || seenMovieKeys.has(key)) {
      duplicateMovieCount += 1;
      continue;
    }
    seenMovieKeys.add(key);
    movies.push({
      key,
      tmdbId,
      title: toTitleCase(row.movie.title),
      completedDate,
      rating: ratingByTmdbId.get(tmdbId),
      included: true,
    });
  }

  // ── TV (grouped for season-checkbox review, same evidence shape the
  // IMDb import's ShowGroup already uses) ──
  const episodeHistory = await fetchEpisodeHistory();
  const validEpisodeRows = episodeHistory.filter((row) => row.show.ids.tmdb);

  const showsById = new Map<
    string,
    { title: string; episodeEvidence: Map<number, { count: number; latestDate?: string }> }
  >();
  for (const row of validEpisodeRows) {
    const showId = String(row.show.ids.tmdb);
    const entry = showsById.get(showId) ?? { title: row.show.title, episodeEvidence: new Map() };
    const season = row.episode.season;
    const watchedDate = row.watched_at.slice(0, 10);
    const existing = entry.episodeEvidence.get(season);
    entry.episodeEvidence.set(season, {
      count: (existing?.count ?? 0) + 1,
      latestDate: !existing?.latestDate || watchedDate > existing.latestDate ? watchedDate : existing.latestDate,
    });
    showsById.set(showId, entry);
  }

  const shows: TraktShowReviewItem[] = [];
  const showIds = Array.from(showsById.keys());
  for (let i = 0; i < showIds.length; i += 1) {
    const showId = showIds[i]!;
    const show = showsById.get(showId)!;
    onProgress?.({ phase: 'shows', done: i + 1, total: showIds.length });

    try {
      const { title } = await getTVShowSummary(showId);
      shows.push({
        key: showId,
        tmdbShowId: showId,
        title: title || show.title,
        seasonEvidence: show.episodeEvidence,
        includedSeasons: new Set(show.episodeEvidence.keys()),
      });
    } catch {
      // A single show's TMDB lookup failing shouldn't drop the rest of
      // the review list — it's just absent from `shows`, same
      // resilience principle as the rest of this file.
    }
  }

  // ── Watchlist → Wishlist ────────────────────────────────────────────
  const [watchlist, existingWishlistKeys] = await Promise.all([fetchWatchlist(), loadExistingWishlistKeys()]);

  const watchlistItems: TraktWatchlistReviewItem[] = [];
  let duplicateWatchlistCount = 0;
  for (let i = 0; i < watchlist.length; i += 1) {
    const item = watchlist[i]!;
    onProgress?.({ phase: 'watchlist', done: i + 1, total: watchlist.length });

    if (item.type === 'movie' && item.movie?.ids.tmdb) {
      const key = `film|${item.movie.title.trim().toLowerCase()}`;
      if (existingWishlistKeys.has(key)) {
        duplicateWatchlistCount += 1;
        continue;
      }
      watchlistItems.push({ key, mediaType: 'film', title: toTitleCase(item.movie.title), included: true });
    } else if (item.type === 'show' && item.show?.ids.tmdb) {
      const key = `tv|${item.show.title.trim().toLowerCase()}`;
      if (existingWishlistKeys.has(key)) {
        duplicateWatchlistCount += 1;
        continue;
      }
      watchlistItems.push({ key, mediaType: 'tv', title: toTitleCase(item.show.title), included: true });
    }
  }

  return { movies, duplicateMovieCount, shows, watchlist: watchlistItems, duplicateWatchlistCount };
}

export interface TraktApplyProgress {
  done: number;
  total: number;
}

export interface TraktImportSummary {
  moviesImported: number;
  moviesSkipped: number;
  moviesErrored: number;
  seasonsImported: number;
  showsErrored: number;
  watchlistImported: number;
  watchlistSkipped: number;
  watchlistErrored: number;
}

/** Creates entries for everything still ticked on the review screen.
 * Only called once the person confirms — nothing is written before
 * this (mirrors the Netflix/Amazon Prime Video imports' apply step). */
export async function applyTraktImport(
  data: TraktReviewData,
  onProgress?: (progress: TraktApplyProgress) => void,
): Promise<TraktImportSummary> {
  const includedMovies = data.movies.filter((m) => m.included);
  const includedWatchlist = data.watchlist.filter((w) => w.included);
  const totalSteps = includedMovies.length + data.shows.length + includedWatchlist.length;
  let done = 0;

  let moviesImported = 0;
  let moviesErrored = 0;
  for (const movie of includedMovies) {
    try {
      const { fields, genres } = await getFilmDetails(movie.tmdbId);
      await createEntry({
        title: movie.title,
        mediaType: 'film',
        status: 'completed',
        completedDate: movie.completedDate,
        rating: movie.rating,
        repeatConsumption: false,
        tags: [importedFromTag('Trakt')],
        genres: genres ?? [],
        metadata: buildFilmMetadata(fields),
      });
      moviesImported += 1;
    } catch {
      moviesErrored += 1;
    }
    done += 1;
    onProgress?.({ done, total: totalSteps });
  }

  let seasonsImported = 0;
  let showsErrored = 0;
  for (const show of data.shows) {
    try {
      const group: ShowGroup = {
        tmdbShowId: show.tmdbShowId,
        title: show.title,
        seasonNumbers: Array.from(show.seasonEvidence.keys()),
        episodeEvidence: show.seasonEvidence,
      };
      const result = await applyShowSeasons(group, show.includedSeasons, 'Trakt');
      seasonsImported += result.imported;
    } catch {
      showsErrored += 1;
    }
    done += 1;
    onProgress?.({ done, total: totalSteps });
  }

  let watchlistImported = 0;
  let watchlistErrored = 0;
  for (const item of includedWatchlist) {
    try {
      await createEntry({
        title: item.title,
        mediaType: item.mediaType,
        status: 'wishlist',
        repeatConsumption: false,
        tags: [importedFromTag('Trakt')],
        genres: [],
        metadata: { source: 'Trakt' },
      });
      watchlistImported += 1;
    } catch {
      watchlistErrored += 1;
    }
    done += 1;
    onProgress?.({ done, total: totalSteps });
  }

  return {
    moviesImported,
    moviesSkipped: data.duplicateMovieCount,
    moviesErrored,
    seasonsImported,
    showsErrored,
    watchlistImported,
    watchlistSkipped: data.duplicateWatchlistCount,
    watchlistErrored,
  };
}
