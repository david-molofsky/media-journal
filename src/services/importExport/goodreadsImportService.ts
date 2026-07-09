import dayjs from 'dayjs';
import { db } from '@/services/database/db';
import { createEntry } from '@/services/database/entryService';
import { parseCsv } from '@/utils/csvParser';
import { toTitleCase } from '@/utils/toTitleCase';
import type { EntryMetadata, EntryStatus } from '@/models';

/**
 * Import from Goodreads' library export (Settings > Import from
 * Goodreads). Unlike Letterboxd import, there's no external metadata
 * lookup/matching phase here — Goodreads' CSV already gives structured
 * title, author, dates and rating directly, so parsing goes straight
 * to review. See chat: minimum viable fields are title, author, dates
 * and rating; genre/cover art auto-fill is a possible follow-up via
 * Open Library, not built here.
 *
 * Export from goodreads.com/review/import (desktop only) > Export
 * Library.
 */

/** Matches "Title (Series, #N)" so the series/volume already embedded
 * in Goodreads titles lands in MJ's existing Series/Volume fields
 * instead of staying baked into the title. Deliberately conservative —
 * `[^,()]+` won't match a series name that itself contains parens, so
 * anything irregular just falls through with the title left as-is
 * rather than guessing wrong. */
const SERIES_PATTERN = /^(.+?)\s*\(([^,()]+),\s*#([\d.]+)\)$/;

export interface GoodreadsRow {
  title: string;
  series?: string;
  volume?: string;
  author?: string;
  mediaType: 'book' | 'audiobook';
  status: EntryStatus;
  /** Only ever set when status === 'completed'; a 'completed' row
   * without one gets flagged for review rather than guessed at (see
   * chat — Goodreads frequently drops Date Read even on books marked
   * read, a well-documented quirk of their export). */
  completedDate?: string;
  /** 0–10 scale (doubled from Goodreads' 1–5 stars), matching MJ's
   * rating field. Undefined when unrated (Goodreads uses 0 for this). */
  rating?: number;
  repeatConsumption: boolean;
  tags: string[];
}

/** Goodreads' own exclusive-shelf names, excluded from the Bookshelves
 * → tags mapping since they're redundant with `status`. */
const BUILTIN_SHELVES = new Set(['read', 'to-read', 'currently-reading']);

function parseSeries(rawTitle: string): { title: string; series?: string; volume?: string } {
  const match = rawTitle.match(SERIES_PATTERN);
  if (!match) return { title: rawTitle };
  const [, title, series, volume] = match;
  if (!title || !series || !volume) return { title: rawTitle };
  return { title: title.trim(), series: series.trim(), volume };
}

/** Goodreads exports Date Read/Date Added as `YYYY/MM/DD`. Returns
 * undefined (rather than throwing) for blank or unparseable values, so
 * a malformed date falls back to the same "needs review" path as a
 * genuinely missing one. */
function parseGoodreadsDate(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  const parsed = dayjs(trimmed, ['YYYY/MM/DD', 'YYYY-MM-DD'], true);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : undefined;
}

function statusForShelf(shelf: string): EntryStatus | undefined {
  if (shelf === 'read') return 'completed';
  if (shelf === 'currently-reading') return 'in_progress';
  if (shelf === 'to-read') return 'wishlist';
  return undefined;
}

/**
 * Parses a goodreads_library_export.csv. Rows missing a title or with
 * an unrecognized Exclusive Shelf (a custom shelf used as the primary
 * one, which shouldn't normally happen) are dropped silently, same
 * malformed-row tolerance as the Letterboxd import.
 */
export function parseGoodreadsLibrary(csvText: string): GoodreadsRow[] {
  const records = parseCsv(csvText);
  const rows: GoodreadsRow[] = [];

  for (const record of records) {
    const rawTitle = record['Title']?.trim();
    if (!rawTitle) continue;

    const shelf = record['Exclusive Shelf']?.trim().toLowerCase() ?? '';
    const status = statusForShelf(shelf);
    if (!status) continue;

    const { title, series, volume } = parseSeries(rawTitle);
    const binding = record['Binding']?.trim().toLowerCase() ?? '';
    const mediaType = binding.includes('audio') ? 'audiobook' : 'book';

    const ratingRaw = Number(record['My Rating']?.trim() ?? '0');
    const rating = ratingRaw > 0 ? ratingRaw * 2 : undefined;

    const readCount = Number(record['Read Count']?.trim() ?? '1');

    const tags = (record['Bookshelves'] ?? '')
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0 && !BUILTIN_SHELVES.has(t));

    rows.push({
      title,
      series,
      volume,
      author: record['Author']?.trim() || undefined,
      mediaType,
      status,
      completedDate: status === 'completed' ? parseGoodreadsDate(record['Date Read']) : undefined,
      rating,
      repeatConsumption: readCount > 1,
      tags,
    });
  }

  return rows;
}

export type GoodreadsRowStatus = 'ready' | 'needs_date' | 'duplicate' | 'skipped';

export interface GoodreadsRowState {
  row: GoodreadsRow;
  status: GoodreadsRowStatus;
  /** Editable in the review UI when status === 'needs_date'; otherwise
   * mirrors row.completedDate. */
  completedDate?: string;
}

/** Existing (mediaType, title, status, completedDate) keys already in
 * the library, used to skip rows re-imported on a later run. Title is
 * lower-cased/trimmed for a forgiving match; completedDate is blank
 * for in_progress/wishlist rows, matching how those are keyed below. */
async function loadExistingKeys(): Promise<Set<string>> {
  const existing = await db.mediaEntries.where('mediaType').anyOf(['book', 'audiobook']).toArray();
  return new Set(
    existing.map(
      (e) => `${e.mediaType}|${e.title.trim().toLowerCase()}|${e.status}|${e.completedDate ?? ''}`,
    ),
  );
}

function dedupeKey(row: GoodreadsRow): string {
  return `${row.mediaType}|${row.title.trim().toLowerCase()}|${row.status}|${row.completedDate ?? ''}`;
}

/**
 * Classifies every parsed row against the existing library and against
 * itself (missing Date Read on a completed row) — all synchronous, no
 * network calls, so this runs in one pass rather than the sequential
 * per-row loop Letterboxd import needs for its TMDB lookups.
 */
export async function classifyRows(rows: GoodreadsRow[]): Promise<GoodreadsRowState[]> {
  const existingKeys = await loadExistingKeys();
  return rows.map((row) => {
    if (row.status === 'completed' && !row.completedDate) {
      return { row, status: 'needs_date' };
    }
    if (existingKeys.has(dedupeKey(row))) {
      return { row, status: 'duplicate' };
    }
    return { row, status: 'ready', completedDate: row.completedDate };
  });
}

function buildMetadata(row: GoodreadsRow): EntryMetadata {
  const metadata: EntryMetadata = { source: 'Goodreads' };
  if (row.author) metadata['author'] = toTitleCase(row.author);
  if (row.series) metadata['series'] = toTitleCase(row.series);
  if (row.volume) metadata['volume'] = row.volume;
  return metadata;
}

/** Creates the MJ entry for one resolved row. Returns 'skipped' for
 * duplicates, explicitly-skipped rows, or needs_date rows the person
 * never filled in a date for. */
export async function applyRow(state: GoodreadsRowState): Promise<'imported' | 'skipped'> {
  const { row } = state;

  if (state.status === 'duplicate' || state.status === 'skipped') return 'skipped';
  if (row.status === 'completed' && !state.completedDate) return 'skipped';

  await createEntry({
    title: toTitleCase(row.title),
    mediaType: row.mediaType,
    status: row.status,
    completedDate: row.status === 'completed' ? state.completedDate : undefined,
    rating: row.rating,
    repeatConsumption: row.repeatConsumption,
    tags: row.tags,
    genres: [],
    metadata: buildMetadata(row),
  });

  return 'imported';
}
