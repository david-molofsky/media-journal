import dayjs from 'dayjs';
import { db } from '@/services/database/db';
import { createEntry } from '@/services/database/entryService';
import {
  findByImdbId,
  getFilmDetails,
  getTVDetails,
  getTVShowSummary,
} from '@/services/metadata/tmdbService';
import { parseCsv } from '@/utils/csvParser';
import { toTitleCase } from '@/utils/toTitleCase';
import { importedFromTag } from '@/utils/importedFromTag';
import type { EntryMetadata } from '@/models';

/**
 * Import from IMDb's ratings export (Settings > Import from IMDb;
 * account > Your Ratings > Export on imdb.com, desktop only — no API
 * or OAuth). Unlike Letterboxd's title/year search, matching here is a
 * direct ID lookup (TMDB's /find/{imdb_id}?external_source=imdb_id),
 * so there's no ambiguous-candidates step: a row either resolves or it
 * doesn't.
 *
 * Movies import straight away. TV rows (Series/Mini Series/Episode) —
 * IMDb rates episodes individually, not seasons, and the ratings
 * export has no season/episode column, so every TV row for a show is
 * grouped under that show (via TMDB's episode lookup, which does
 * return season/episode numbers) into one per-show prompt: "here's
 * what you rated for this show, which season(s) do you want logged?"
 * (see chat — this needed a genuine grouping pass, not a per-row
 * import, since IMDb's data model doesn't line up with MJ's
 * one-entry-per-season model).
 */

export type ImdbTitleType =
  'Movie' | 'TV Series' | 'TV Mini Series' | 'TV Episode' | string;

export interface ImdbRow {
  imdbId: string;
  title: string;
  titleType: ImdbTitleType;
  rating?: number;
  dateRated?: string;
}

/** IMDb exports "Date Rated" as YYYY-MM-DD, already ISO — parsed
 * defensively all the same, so a format change upstream degrades to
 * "no date" rather than a bad date silently reaching an entry. */
function parseImdbDate(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  const parsed = dayjs(trimmed, ['YYYY-MM-DD', 'YYYY/MM/DD'], true);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : undefined;
}

/**
 * Parses an IMDb ratings export. Rows missing an IMDb id or title are
 * dropped silently, same malformed-row tolerance as the Letterboxd and
 * Goodreads imports.
 */
export function parseImdbRatings(csvText: string): ImdbRow[] {
  const records = parseCsv(csvText);
  const rows: ImdbRow[] = [];

  for (const record of records) {
    const imdbId = record['Const']?.trim();
    const title = record['Title']?.trim();
    if (!imdbId || !title) continue;

    const ratingRaw = Number(record['Your Rating']?.trim() ?? '');
    rows.push({
      imdbId,
      title,
      titleType: record['Title Type']?.trim() || 'Unknown',
      rating: Number.isFinite(ratingRaw) && ratingRaw > 0 ? ratingRaw : undefined,
      dateRated: parseImdbDate(record['Date Rated']),
    });
  }

  return rows;
}

const TV_TITLE_TYPES = new Set(['TV Series', 'TV Mini Series', 'TV Episode']);

export type SkipReason =
  'unsupported_type' | 'no_tmdb_match' | 'missing_date' | 'show_skipped';

export interface SkippedRow {
  row: ImdbRow;
  reason: SkipReason;
}

export interface MovieMatch {
  row: ImdbRow;
  tmdbId: string;
}

/** One show's aggregated IMDb evidence, grouped by TMDB show id across
 * every row (series-level and episode-level) that resolved to it. */
export interface ShowGroup {
  tmdbShowId: string;
  title: string;
  /** All real season numbers TMDB has for this show (season 0/specials
   * excluded) — the checkbox list always covers the whole show, not
   * just the seasons IMDb happened to have episode ratings for. */
  seasonNumbers: number[];
  /** A rating of the show itself, if one of the grouped rows was a
   * "TV Series"/"TV Mini Series" row rather than an episode. */
  seriesRating?: { rating?: number; date?: string };
  /** season number -> { count, latest date rated } — the evidence
   * shown next to each checkbox, and the source for a season entry's
   * completedDate. */
  episodeEvidence: Map<number, { count: number; latestDate?: string }>;
}

export interface ImdbMatchResult {
  movies: MovieMatch[];
  showGroups: ShowGroup[];
  skipped: SkippedRow[];
}

/** Existing (mediaType, title, key) pairs already in the library, used
 * to skip rows/seasons re-imported on a later run. Films key on
 * (title, completedDate); TV seasons key on (title, seasonNumber) since
 * IMDb has no reliable per-season date to dedupe on otherwise. */
async function loadExistingKeys(): Promise<{ films: Set<string>; seasons: Set<string> }> {
  const [films, seasons] = await Promise.all([
    db.mediaEntries.where('mediaType').equals('film').toArray(),
    db.mediaEntries.where('mediaType').equals('tv').toArray(),
  ]);
  return {
    films: new Set(
      films
        .filter((e) => e.completedDate)
        .map((e) => `${e.title.trim().toLowerCase()}|${e.completedDate}`),
    ),
    seasons: new Set(
      seasons
        .filter((e) => e.metadata['seasonNumber'] !== undefined)
        .map((e) => `${e.title.trim().toLowerCase()}|${e.metadata['seasonNumber']}`),
    ),
  };
}

/**
 * Resolves every row against TMDB (sequential, one call at a time —
 * same rate-limiting approach as Letterboxd/backfill) and groups TV
 * rows by show. Movies already in the library (by title+date) are
 * marked matched but flagged so `applyAll` can dedupe; TV seasons are
 * deduped later, once the person has actually chosen which seasons to
 * import, since dedup needs the season number the prompt screen
 * collects.
 */
export async function matchRows(
  rows: ImdbRow[],
  onProgress?: (done: number, total: number) => void,
): Promise<ImdbMatchResult> {
  const existing = await loadExistingKeys();
  const movies: MovieMatch[] = [];
  const skipped: SkippedRow[] = [];
  const showGroupsById = new Map<string, ShowGroup>();
  const showSummaryCache = new Map<string, { title: string; seasonNumbers: number[] }>();

  let done = 0;
  for (const row of rows) {
    if (row.titleType === 'Movie') {
      // completedDate is required for a 'completed' entry (see
      // entrySchemas.ts) — a movie row with no Date Rated can't become
      // one, so it's flagged here rather than failing validation later
      // mid-import.
      if (!row.dateRated) {
        skipped.push({ row, reason: 'missing_date' });
        done += 1;
        onProgress?.(done, rows.length);
        continue;
      }
      const result = await findByImdbId(row.imdbId);
      if (!result.movieId) {
        skipped.push({ row, reason: 'no_tmdb_match' });
      } else if (
        existing.films.has(`${row.title.trim().toLowerCase()}|${row.dateRated ?? ''}`)
      ) {
        // Already imported — silently excluded rather than counted as
        // "skipped" (that label is reserved for rows that genuinely
        // couldn't be imported).
      } else {
        movies.push({ row, tmdbId: result.movieId });
      }
    } else if (TV_TITLE_TYPES.has(row.titleType)) {
      const result = await findByImdbId(row.imdbId);
      const showId = result.tvId ?? result.episode?.showId;
      if (!showId) {
        skipped.push({ row, reason: 'no_tmdb_match' });
      } else {
        let group = showGroupsById.get(showId);
        if (!group) {
          let summary = showSummaryCache.get(showId);
          if (!summary) {
            summary = await getTVShowSummary(showId);
            showSummaryCache.set(showId, summary);
          }
          group = {
            tmdbShowId: showId,
            title: summary.title,
            seasonNumbers: summary.seasonNumbers,
            episodeEvidence: new Map(),
          };
          showGroupsById.set(showId, group);
        }
        if (result.tvId) {
          group.seriesRating = { rating: row.rating, date: row.dateRated };
        } else if (result.episode) {
          const existingEvidence = group.episodeEvidence.get(result.episode.seasonNumber);
          const latestDate =
            !existingEvidence?.latestDate ||
            (row.dateRated && row.dateRated > existingEvidence.latestDate)
              ? row.dateRated
              : existingEvidence.latestDate;
          group.episodeEvidence.set(result.episode.seasonNumber, {
            count: (existingEvidence?.count ?? 0) + 1,
            latestDate,
          });
        }
      }
    } else {
      skipped.push({ row, reason: 'unsupported_type' });
    }

    done += 1;
    onProgress?.(done, rows.length);
  }

  return { movies, showGroups: [...showGroupsById.values()], skipped };
}

/** Applies field-type-aware coercion the same way Letterboxd import's
 * buildMetadata does — title-case text fields, leave numeric/bespoke
 * fields alone. */
function buildFilmMetadata(fields: Record<string, string>): EntryMetadata {
  const metadata: EntryMetadata = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'runtime') metadata[key] = Number(value);
    else if (key === 'overview' || key === 'posterPath') metadata[key] = value;
    else metadata[key] = toTitleCase(value);
  }
  metadata['source'] = 'IMDb';
  return metadata;
}

function buildTvMetadata(
  fields: Record<string, string>,
  seasonNumber: number,
  source: string,
): EntryMetadata {
  const metadata: EntryMetadata = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'runtime') metadata[key] = Number(value);
    else if (key === 'overview' || key === 'posterPath') metadata[key] = value;
    else metadata[key] = toTitleCase(value);
  }
  metadata['source'] = source;
  metadata['seasonNumber'] = seasonNumber;
  return metadata;
}

/** Imports every matched movie. Returns the count actually created —
 * TMDB detail fetches happen here (not during matchRows) so a large
 * library's initial match pass stays to one lightweight call per row. */
export async function applyMovies(movies: MovieMatch[]): Promise<number> {
  let imported = 0;
  for (const { row, tmdbId } of movies) {
    const { fields, genres } = await getFilmDetails(tmdbId);
    await createEntry({
      title: toTitleCase(row.title),
      mediaType: 'film',
      status: 'completed',
      // Guaranteed present — matchRows filters out Movie rows with no
      // Date Rated before they ever reach `movies`.
      completedDate: row.dateRated,
      rating: row.rating,
      repeatConsumption: false,
      tags: [importedFromTag('IMDb')],
      genres: genres ?? [],
      watchedWith: [],
      recommendedBy: [],
      metadata: buildFilmMetadata(fields),
    });
    imported += 1;
  }
  return imported;
}

export interface ApplyShowSeasonsResult {
  imported: number;
  /** Season numbers that couldn't be created — no episode evidence and
   * no series-level rating date to fall back on for completedDate,
   * which a 'completed' entry requires (see entrySchemas.ts). Rare in
   * practice (it means the person checked a season IMDb has no rating
   * evidence for at all), but skip-and-report rather than guess a
   * date, same principle as the Goodreads import's missing-date rows. */
  skippedSeasons: number[];
}

/**
 * Imports the seasons selected for one show. `selectedSeasons` are the
 * season numbers the person checked on that show's prompt card;
 * already-imported (title, season) pairs are silently skipped (see
 * loadExistingKeys) rather than duplicated on a later run.
 *
 * `source` defaults to 'IMDb' (this function's original caller) but is
 * parametrized since Trakt's import reuses this same function for its
 * TV-season rollup (see chat) — every Trakt-imported season was
 * incorrectly labelled "IMDb" as its source until this was added.
 */
export async function applyShowSeasons(
  group: ShowGroup,
  selectedSeasons: Set<number>,
  source = 'IMDb',
): Promise<ApplyShowSeasonsResult> {
  if (selectedSeasons.size === 0) return { imported: 0, skippedSeasons: [] };

  const existing = await loadExistingKeys();
  const { fields, genres } = await getTVDetails(group.tmdbShowId);

  let imported = 0;
  const skippedSeasons: number[] = [];
  for (const seasonNumber of selectedSeasons) {
    const key = `${group.title.trim().toLowerCase()}|${seasonNumber}`;
    if (existing.seasons.has(key)) continue;

    const evidence = group.episodeEvidence.get(seasonNumber);
    const completedDate = evidence?.latestDate ?? group.seriesRating?.date;
    if (!completedDate) {
      skippedSeasons.push(seasonNumber);
      continue;
    }

    await createEntry({
      title: toTitleCase(group.title),
      mediaType: 'tv',
      status: 'completed',
      completedDate,
      // IMDb rates episodes/shows, not seasons — there's no reliable
      // season-level rating to carry over, so this is left for the
      // person to fill in manually if they want one.
      rating: undefined,
      repeatConsumption: false,
      tags: [importedFromTag(source)],
      genres: genres ?? [],
      watchedWith: [],
      recommendedBy: [],
      metadata: buildTvMetadata(fields, seasonNumber, source),
    });
    imported += 1;
  }
  return { imported, skippedSeasons };
}
