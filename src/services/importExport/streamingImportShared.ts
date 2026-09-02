import { db } from '@/services/database/db';
import { createEntry } from '@/services/database/entryService';
import {
  searchFilms,
  searchTV,
  getFilmDetails,
  getTVDetails,
} from '@/services/metadata/tmdbService';
import { toTitleCase } from '@/utils/toTitleCase';
import { importedFromTag } from '@/utils/importedFromTag';
import type { SearchResult } from '@/services/metadata/openLibraryService';
import type { EntryMetadata } from '@/models';

/**
 * Shared matching/review/apply logic for streaming-service watch-
 * history imports where episodes need to be title-matched (no direct
 * TMDB id available) and rolled up to season level — currently Netflix
 * (netflixImportService.ts) and Amazon Prime Video
 * (amazonPrimeImportService.ts). Each source owns its own CSV parsing
 * (column layouts differ) and produces a flat `{ title, date }[]` /
 * grouped-by-show input; this module does the TMDB matching, the
 * review-step tick state, and the actual entry creation, identically
 * for both, parametrized by `source` for the metadata.source field.
 */

export type ReviewMatchStatus = 'auto' | 'ambiguous' | 'none' | 'duplicate' | 'skipped';

export interface MovieReviewItem {
  kind: 'movie';
  /** Stable key for React lists and toggling. */
  key: string;
  title: string;
  date: string;
  status: ReviewMatchStatus;
  candidates: SearchResult[];
  selectedId?: string;
  /** Tick state — defaults to true for every status except
   * 'duplicate' (never shown in the review list). */
  included: boolean;
}

export interface ShowReviewGroup {
  kind: 'show';
  /** Parsed show title, lowercased — the grouping key. */
  key: string;
  title: string;
  status: 'auto' | 'ambiguous' | 'none';
  candidates: SearchResult[];
  selectedId?: string;
  /** season number -> evidence, from the parsed rows. */
  seasonEvidence: Map<number, { count: number; latestDate: string }>;
  /** Seasons currently ticked for import — defaults to every evidenced
   * season not already in the library, individually toggleable. */
  includedSeasons: Set<number>;
  /** True if the evidenced season numbers have a gap (e.g. 1 and 3
   * logged, but not 2) — flagged for review, still ticked by default. */
  hasGap: boolean;
}

export type ReviewItem = MovieReviewItem | ShowReviewGroup;

export function detectGap(seasonNumbers: number[]): boolean {
  if (seasonNumbers.length < 2) return false;
  const sorted = [...seasonNumbers].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i]! - sorted[i - 1]! > 1) return true;
  }
  return false;
}

export async function loadExistingFilmKeys(): Promise<Set<string>> {
  const films = await db.mediaEntries.where('mediaType').equals('film').toArray();
  return new Set(
    films
      .filter((e) => e.completedDate)
      .map((e) => `${e.title.trim().toLowerCase()}|${e.completedDate}`),
  );
}

export async function loadExistingSeasonKeys(): Promise<Set<string>> {
  const shows = await db.mediaEntries.where('mediaType').equals('tv').toArray();
  return new Set(
    shows
      .filter((e) => e.metadata['seasonNumber'] !== undefined)
      .map((e) => `${e.title.trim().toLowerCase()}|${e.metadata['seasonNumber']}`),
  );
}

/** Exact-title-match heuristic shared by both movie and show matching —
 * a single exact (case-insensitive) title match auto-resolves; more
 * than one, or a fuzzy-only match, is ambiguous and needs a person's
 * pick (pre-selected to the top result so Import never silently skips
 * someone who didn't touch the picker). */
async function matchTitle(
  title: string,
  cache: Map<string, SearchResult[]>,
  search: (query: string) => Promise<SearchResult[]>,
): Promise<{
  status: 'auto' | 'ambiguous' | 'none';
  candidates: SearchResult[];
  selectedId?: string;
}> {
  const cacheKey = title.trim().toLowerCase();
  let results = cache.get(cacheKey);
  if (!results) {
    results = await search(title);
    cache.set(cacheKey, results);
  }
  if (results.length === 0) return { status: 'none', candidates: [] };

  const exactMatches = results.filter((r) => r.title.trim().toLowerCase() === cacheKey);
  if (exactMatches.length === 1) {
    return {
      status: 'auto',
      candidates: results.slice(0, 5),
      selectedId: exactMatches[0]!.id,
    };
  }

  const topCandidates = results.slice(0, 5);
  return {
    status: 'ambiguous',
    candidates: topCandidates,
    selectedId: topCandidates[0]?.id,
  };
}

export const matchMovieTitle = (title: string, cache: Map<string, SearchResult[]>) =>
  matchTitle(title, cache, searchFilms);

export const matchShowTitle = (title: string, cache: Map<string, SearchResult[]>) =>
  matchTitle(title, cache, searchTV);

function buildFilmMetadata(
  fields: Record<string, string>,
  source: string,
): EntryMetadata {
  const metadata: EntryMetadata = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'runtime') metadata[key] = Number(value);
    else if (key === 'overview' || key === 'posterPath') metadata[key] = value;
    else metadata[key] = toTitleCase(value);
  }
  metadata['source'] = source;
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

export interface ApplyResult {
  moviesImported: number;
  seasonsImported: number;
  flaggedForReview: number;
  unmatched: number;
}

/** Creates entries for every ticked item. Only called once the person
 * confirms the review/tick step — nothing is written before this. */
export async function applyStreamingImport(
  items: ReviewItem[],
  source: string,
): Promise<ApplyResult> {
  let moviesImported = 0;
  let seasonsImported = 0;
  let flaggedForReview = 0;
  let unmatched = 0;

  for (const item of items) {
    if (item.kind === 'movie') {
      if (item.status === 'duplicate' || item.status === 'skipped') continue;

      if (item.status === 'none') {
        if (!item.included) {
          unmatched += 1;
          continue;
        }
        // "Import anyway" was ticked — create a bare entry under the
        // raw title, no TMDB metadata (mirrors Letterboxd's
        // importAnyway behaviour for unmatched rows).
        await createEntry({
          title: toTitleCase(item.title),
          mediaType: 'film',
          status: 'completed',
          completedDate: item.date,
          repeatConsumption: false,
          tags: [importedFromTag(source)],
          genres: [],
          watchedWith: [],
          recommendedBy: [],
          metadata: { source },
        });
        moviesImported += 1;
        continue;
      }

      if (!item.included || !item.selectedId) continue;

      const matched = item.candidates.find((c) => c.id === item.selectedId);
      const { fields, genres } = await getFilmDetails(item.selectedId);
      await createEntry({
        title: matched?.title ?? toTitleCase(item.title),
        mediaType: 'film',
        status: 'completed',
        completedDate: item.date,
        repeatConsumption: false,
        tags: [importedFromTag(source)],
        genres: genres ?? [],
        watchedWith: [],
        recommendedBy: [],
        metadata: buildFilmMetadata(fields, source),
      });
      moviesImported += 1;
    } else {
      if (item.status === 'none') {
        unmatched += 1;
        continue;
      }
      if (item.hasGap) flaggedForReview += 1;
      if (!item.selectedId || item.includedSeasons.size === 0) continue;

      const { fields, genres } = await getTVDetails(item.selectedId);
      const matched = item.candidates.find((c) => c.id === item.selectedId);
      const title = matched?.title ?? toTitleCase(item.title);
      for (const seasonNumber of item.includedSeasons) {
        const evidence = item.seasonEvidence.get(seasonNumber);
        if (!evidence) continue;
        await createEntry({
          title,
          mediaType: 'tv',
          status: 'completed',
          completedDate: evidence.latestDate,
          repeatConsumption: false,
          tags: [importedFromTag(source)],
          genres: genres ?? [],
          watchedWith: [],
          recommendedBy: [],
          metadata: buildTvMetadata(fields, seasonNumber, source),
        });
        seasonsImported += 1;
      }
    }
  }

  return { moviesImported, seasonsImported, flaggedForReview, unmatched };
}

/**
 * Groups already-classified rows (movie rows vs. `{ showTitle,
 * seasonNumber }` series rows) into the ReviewItem list, running TMDB
 * matching for each distinct movie title and each distinct show title.
 * Both Netflix and Amazon Prime call this after their own CSV-specific
 * classification step.
 */
export async function matchAndGroupRows(
  movieRows: { title: string; date: string }[],
  seriesRows: {
    title: string;
    showTitle: string;
    seasonNumber: number | undefined;
    date: string;
  }[],
  onProgress?: (done: number, total: number) => void,
): Promise<ReviewItem[]> {
  const [existingFilmKeys, existingSeasonKeys] = await Promise.all([
    loadExistingFilmKeys(),
    loadExistingSeasonKeys(),
  ]);

  const movieCache = new Map<string, SearchResult[]>();
  const showCache = new Map<string, SearchResult[]>();
  const total = movieRows.length + seriesRows.length;
  let done = 0;

  const movies: MovieReviewItem[] = [];
  for (const row of movieRows) {
    const filmKey = `${row.title.trim().toLowerCase()}|${row.date}`;
    if (existingFilmKeys.has(filmKey)) {
      movies.push({
        kind: 'movie',
        key: row.title,
        title: row.title,
        date: row.date,
        status: 'duplicate',
        candidates: [],
        included: false,
      });
    } else {
      const match = await matchMovieTitle(row.title, movieCache);
      movies.push({
        kind: 'movie',
        key: row.title,
        title: row.title,
        date: row.date,
        status: match.status,
        candidates: match.candidates,
        selectedId: match.selectedId,
        included: true,
      });
    }
    done += 1;
    onProgress?.(done, total);
  }

  const showGroups = new Map<
    string,
    { title: string; seasonEvidence: Map<number, { count: number; latestDate: string }> }
  >();
  for (const row of seriesRows) {
    const key = row.showTitle.trim().toLowerCase();
    const group = showGroups.get(key) ?? {
      title: row.showTitle,
      seasonEvidence: new Map(),
    };
    if (row.seasonNumber !== undefined) {
      const existing = group.seasonEvidence.get(row.seasonNumber);
      group.seasonEvidence.set(row.seasonNumber, {
        count: (existing?.count ?? 0) + 1,
        latestDate:
          !existing?.latestDate || row.date > existing.latestDate
            ? row.date
            : existing.latestDate,
      });
    }
    showGroups.set(key, group);
    done += 1;
    onProgress?.(done, total);
  }

  const shows: ShowReviewGroup[] = [];
  for (const [key, group] of showGroups) {
    const match = await matchShowTitle(group.title, showCache);
    const seasonNumbers = Array.from(group.seasonEvidence.keys());
    const includedSeasons = new Set(
      seasonNumbers.filter(
        (n) => !existingSeasonKeys.has(`${group.title.trim().toLowerCase()}|${n}`),
      ),
    );
    shows.push({
      kind: 'show',
      key,
      title: group.title,
      status: match.status,
      candidates: match.candidates,
      selectedId: match.selectedId,
      seasonEvidence: group.seasonEvidence,
      includedSeasons,
      hasGap: detectGap(seasonNumbers),
    });
  }

  return [...movies, ...shows];
}
