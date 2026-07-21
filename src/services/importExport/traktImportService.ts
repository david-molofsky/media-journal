import { createEntry } from '@/services/database/entryService';
import { getFilmDetails, getTVShowSummary } from '@/services/metadata/tmdbService';
import { toTitleCase } from '@/utils/toTitleCase';
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
 * Movies: one entry per distinct watched_at date — a rewatched movie
 * with 3 history rows becomes 3 entries, per David's decision.
 *
 * TV: rolled up to season level using the same ShowGroup shape and
 * applyShowSeasons function the IMDb import already uses (see chat) —
 * reused as-is rather than duplicated. Note this means TV rewatches
 * do NOT get separate entries the way movie rewatches do: a season is
 * a single entry (using its most recent watch date), consistent with
 * how applyShowSeasons already dedupes by (title, season) — re-running
 * this import after rewatching a season won't create a second entry
 * for it. Flagged as a deliberate scope difference from the "every
 * rewatch is a separate entry" rule, which fits movies (single
 * episode-equivalent) far more naturally than a whole season would.
 */

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

export interface TraktImportProgress {
  phase: 'movies' | 'shows' | 'watchlist';
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

export async function runTraktImport(
  onProgress?: (progress: TraktImportProgress) => void,
): Promise<TraktImportSummary> {
  // ── Movies ──────────────────────────────────────────────────────────
  const [movieHistory, movieRatings, existingFilmKeys] = await Promise.all([
    fetchMovieHistory(),
    fetchMovieRatings(),
    loadExistingFilmKeys(),
  ]);

  const ratingByTmdbId = new Map(
    movieRatings.filter((r) => r.movie.ids.tmdb).map((r) => [String(r.movie.ids.tmdb), r.rating]),
  );

  let moviesImported = 0;
  let moviesSkipped = 0;
  let moviesErrored = 0;
  const validMovieRows = movieHistory.filter((row) => row.movie.ids.tmdb);
  for (let i = 0; i < validMovieRows.length; i += 1) {
    const row = validMovieRows[i]!;
    const tmdbId = String(row.movie.ids.tmdb);
    const completedDate = row.watched_at.slice(0, 10);
    const key = `${row.movie.title.trim().toLowerCase()}|${completedDate}`;

    onProgress?.({ phase: 'movies', done: i + 1, total: validMovieRows.length });

    if (existingFilmKeys.has(key)) {
      moviesSkipped += 1;
      continue;
    }

    // A single bad row here (TMDB lookup failure, unexpected data
    // shape, validation error) must not abort every remaining movie —
    // see chat: this exact class of bug already broke the MAL import
    // once by killing the whole run over one entry.
    try {
      const { fields, genres } = await getFilmDetails(tmdbId);
      await createEntry({
        title: toTitleCase(row.movie.title),
        mediaType: 'film',
        status: 'completed',
        completedDate,
        rating: ratingByTmdbId.get(tmdbId),
        repeatConsumption: false,
        tags: [],
        genres: genres ?? [],
        metadata: buildFilmMetadata(fields),
      });
      moviesImported += 1;
      existingFilmKeys.add(key); // guard against duplicate history rows on the same day
    } catch {
      moviesErrored += 1;
    }
  }

  // ── TV (rolled up to seasons, reusing the IMDb import's machinery) ──
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

  let seasonsImported = 0;
  let showsErrored = 0;
  const showIds = Array.from(showsById.keys());
  for (let i = 0; i < showIds.length; i += 1) {
    const showId = showIds[i]!;
    const show = showsById.get(showId)!;
    onProgress?.({ phase: 'shows', done: i + 1, total: showIds.length });

    try {
      const { title, seasonNumbers } = await getTVShowSummary(showId);
      const group: ShowGroup = {
        tmdbShowId: showId,
        title: title || show.title,
        seasonNumbers,
        episodeEvidence: show.episodeEvidence,
      };
      // Every season with at least one watched episode is imported —
      // there's no per-show prompt here the way IMDb needs one (IMDb
      // requires a person's choice because a "TV Series" row alone is
      // ambiguous about which seasons were actually watched; Trakt's
      // episode-level history already tells us exactly that).
      const selected = new Set(show.episodeEvidence.keys());
      const result = await applyShowSeasons(group, selected, 'Trakt');
      seasonsImported += result.imported;
    } catch {
      showsErrored += 1;
    }
  }

  // ── Watchlist → Wishlist ────────────────────────────────────────────
  const watchlist = await fetchWatchlist();
  const [existingWishlistFilms, existingWishlistShows] = await Promise.all([
    db.mediaEntries.where('mediaType').equals('film').toArray(),
    db.mediaEntries.where('mediaType').equals('tv').toArray(),
  ]);
  const existingWishlistTitles = new Set(
    [...existingWishlistFilms, ...existingWishlistShows]
      .filter((e) => e.status === 'wishlist')
      .map((e) => `${e.mediaType}|${e.title.trim().toLowerCase()}`),
  );

  let watchlistImported = 0;
  let watchlistSkipped = 0;
  let watchlistErrored = 0;
  for (let i = 0; i < watchlist.length; i += 1) {
    const item = watchlist[i]!;
    onProgress?.({ phase: 'watchlist', done: i + 1, total: watchlist.length });

    try {
      if (item.type === 'movie' && item.movie?.ids.tmdb) {
        const key = `film|${item.movie.title.trim().toLowerCase()}`;
        if (existingWishlistTitles.has(key)) {
          watchlistSkipped += 1;
          continue;
        }
        await createEntry({
          title: toTitleCase(item.movie.title),
          mediaType: 'film',
          status: 'wishlist',
          repeatConsumption: false,
          tags: [],
          genres: [],
          metadata: { source: 'Trakt' },
        });
        watchlistImported += 1;
      } else if (item.type === 'show' && item.show?.ids.tmdb) {
        const key = `tv|${item.show.title.trim().toLowerCase()}`;
        if (existingWishlistTitles.has(key)) {
          watchlistSkipped += 1;
          continue;
        }
        await createEntry({
          title: toTitleCase(item.show.title),
          mediaType: 'tv',
          status: 'wishlist',
          repeatConsumption: false,
          tags: [],
          genres: [],
          metadata: { source: 'Trakt' },
        });
        watchlistImported += 1;
      }
    } catch {
      watchlistErrored += 1;
    }
  }

  return {
    moviesImported,
    moviesSkipped,
    moviesErrored,
    seasonsImported,
    showsErrored,
    watchlistImported,
    watchlistSkipped,
    watchlistErrored,
  };
}
