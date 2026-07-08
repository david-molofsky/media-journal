import { db } from '@/services/database/db';
import { createEntry } from '@/services/database/entryService';
import { searchFilms, getFilmDetails } from '@/services/metadata/tmdbService';
import { parseCsv } from '@/utils/csvParser';
import { toTitleCase } from '@/utils/toTitleCase';
import type { SearchResult } from '@/services/metadata/openLibraryService';
import type { EntryMetadata } from '@/models';

/**
 * Import from Letterboxd's diary.csv export (Settings > Import from
 * Letterboxd). Each diary row becomes its own Film entry — including
 * rewatches, which Letterboxd logs as separate rows — matched against
 * TMDB the same way the Film/TV backfill feature matches existing
 * entries (see backfillService.ts), but with the CSV's Year column
 * added for disambiguation, since diary.csv has no TMDB id to match
 * on directly.
 */

export interface LetterboxdDiaryRow {
  name: string;
  year?: string;
  watchedDate: string;
  /** 0–10 scale (doubled from Letterboxd's 0.5–5★), matching MJ's
   * rating field. Undefined when the row has no rating. */
  rating?: number;
  rewatch: boolean;
  tags: string[];
}

/**
 * Parses a diary.csv export. Rows missing a title or a usable date are
 * dropped silently — a partially malformed file still imports what it
 * can, consistent with how JSON import handles per-entry failures
 * (see importExportService.ts).
 */
export function parseLetterboxdDiary(csvText: string): LetterboxdDiaryRow[] {
  const records = parseCsv(csvText);
  const rows: LetterboxdDiaryRow[] = [];

  for (const record of records) {
    const name = record['Name']?.trim();
    // "Watched Date" is the actual viewing date; "Date" is when the
    // entry was logged to the site, which Letterboxd's own docs use as
    // a fallback only when Watched Date is absent (e.g. rows added via
    // the "mark watched" bulk flow rather than the diary).
    const watchedDate = (record['Watched Date']?.trim() || record['Date']?.trim()) ?? '';
    if (!name || !watchedDate) continue;

    const ratingRaw = record['Rating']?.trim();
    const rating = ratingRaw ? Number(ratingRaw) * 2 : undefined;

    const tags = (record['Tags'] ?? '')
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    rows.push({
      name,
      year: record['Year']?.trim() || undefined,
      watchedDate,
      rating: rating !== undefined && !Number.isNaN(rating) ? rating : undefined,
      rewatch: (record['Rewatch']?.trim() ?? '').toLowerCase() === 'yes',
      tags,
    });
  }

  return rows;
}

export type LetterboxdMatchStatus = 'auto' | 'ambiguous' | 'none' | 'duplicate' | 'skipped';

export interface LetterboxdMatchState {
  row: LetterboxdDiaryRow;
  candidates: SearchResult[];
  status: LetterboxdMatchStatus;
  selectedId?: string;
  /** Only meaningful when status === 'none' — whether to still create
   * a bare entry from the raw Letterboxd title. Defaults to true so
   * no watch history is silently dropped; the person can opt out per
   * row on the review screen. */
  importAnyway?: boolean;
}

/** Existing (title, completedDate) pairs already in the library, used
 * to skip rows that were already imported on a previous run. Title is
 * lower-cased/trimmed for a forgiving match. */
async function loadExistingFilmKeys(): Promise<Set<string>> {
  const existing = await db.mediaEntries.where('mediaType').equals('film').toArray();
  return new Set(
    existing
      .filter((e) => e.completedDate)
      .map((e) => `${e.title.trim().toLowerCase()}|${e.completedDate}`),
  );
}

function dedupeKey(row: LetterboxdDiaryRow): string {
  return `${row.name.trim().toLowerCase()}|${row.watchedDate}`;
}

/** Marks rows already present in the library as 'duplicate' up front,
 * before any TMDB calls — cheap, and avoids burning API calls on rows
 * that won't be imported anyway. */
export async function partitionDuplicates(
  rows: LetterboxdDiaryRow[],
): Promise<{ toMatch: LetterboxdDiaryRow[]; duplicates: LetterboxdDiaryRow[] }> {
  const existingKeys = await loadExistingFilmKeys();
  const toMatch: LetterboxdDiaryRow[] = [];
  const duplicates: LetterboxdDiaryRow[] = [];
  for (const row of rows) {
    if (existingKeys.has(dedupeKey(row))) duplicates.push(row);
    else toMatch.push(row);
  }
  return { toMatch, duplicates };
}

/**
 * Searches TMDB for one diary row and classifies the result. `cache`
 * is keyed by title+year and shared across the whole import run, so a
 * film watched multiple times (rewatches are separate diary rows)
 * only triggers one TMDB search rather than one per row.
 */
export async function matchRow(
  row: LetterboxdDiaryRow,
  cache: Map<string, SearchResult[]>,
): Promise<LetterboxdMatchState> {
  const cacheKey = `${row.name.trim().toLowerCase()}|${row.year ?? ''}`;
  let results = cache.get(cacheKey);
  if (!results) {
    results = await searchFilms(row.name);
    cache.set(cacheKey, results);
  }

  if (results.length === 0) {
    return { row, candidates: [], status: 'none', importAnyway: true };
  }

  const exactTitleMatches = results.filter(
    (r) => r.title.trim().toLowerCase() === row.name.trim().toLowerCase(),
  );
  const yearMatches = row.year
    ? exactTitleMatches.filter((r) => r.subtitle === row.year)
    : [];

  if (yearMatches.length === 1) {
    const match = yearMatches[0];
    if (match) return { row, candidates: results.slice(0, 5), status: 'auto', selectedId: match.id };
  }
  if (yearMatches.length === 0 && exactTitleMatches.length === 1) {
    const match = exactTitleMatches[0];
    if (match) return { row, candidates: results.slice(0, 5), status: 'auto', selectedId: match.id };
  }

  // Ambiguous — pre-select the best guess (prefer a year match among
  // all results, not just exact-title ones) so Apply never silently
  // skips someone who didn't touch the radio group.
  const topCandidates = results.slice(0, 5);
  const bestGuess = row.year ? topCandidates.find((c) => c.subtitle === row.year) : undefined;
  return {
    row,
    candidates: topCandidates,
    status: 'ambiguous',
    selectedId: (bestGuess ?? topCandidates[0])?.id,
  };
}

/** Applies field-type-aware coercion the same way EntryForm's onFill
 * does for a manual TMDB selection (runtime as number, overview/poster
 * left un-title-cased) — see EntryForm.tsx. */
function buildMetadata(fields: Record<string, string>): EntryMetadata {
  const metadata: EntryMetadata = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'runtime') {
      metadata[key] = Number(value);
    } else if (key === 'overview' || key === 'posterPath') {
      metadata[key] = value;
    } else {
      metadata[key] = toTitleCase(value);
    }
  }
  // Source deliberately overrides whatever getFilmDetails may have
  // inferred from JustWatch — for an imported entry, "how did this
  // get into MJ" (Letterboxd) is more useful here than "where can I
  // stream it now", which the normal Add Entry flow already covers.
  metadata['source'] = 'Letterboxd';
  return metadata;
}

/** Creates the MJ Film entry for one resolved row. Returns 'skipped'
 * for duplicates, explicitly-skipped rows, or 'none' rows the person
 * chose not to import anyway. */
export async function applyRow(state: LetterboxdMatchState): Promise<'imported' | 'skipped'> {
  const { row } = state;

  if (state.status === 'duplicate' || state.status === 'skipped') return 'skipped';
  if (state.status === 'none' && !state.importAnyway) return 'skipped';

  let title = toTitleCase(row.name);
  let metadata: EntryMetadata = { source: 'Letterboxd' };
  let genres: string[] = [];

  if ((state.status === 'auto' || state.status === 'ambiguous') && state.selectedId) {
    const matchedCandidate = state.candidates.find((c) => c.id === state.selectedId);
    if (matchedCandidate) title = matchedCandidate.title;
    const { fields, genres: matchedGenres } = await getFilmDetails(state.selectedId);
    metadata = buildMetadata(fields);
    genres = matchedGenres ?? [];
  }

  await createEntry({
    title,
    mediaType: 'film',
    status: 'completed',
    completedDate: row.watchedDate,
    rating: row.rating,
    repeatConsumption: row.rewatch,
    tags: row.tags,
    genres,
    metadata,
  });

  return 'imported';
}
