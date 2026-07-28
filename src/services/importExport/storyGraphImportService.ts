import dayjs from 'dayjs';
import { db } from '@/services/database/db';
import { createEntry } from '@/services/database/entryService';
import { parseCsv } from '@/utils/csvParser';
import { toTitleCase } from '@/utils/toTitleCase';
import type { EntryMetadata, EntryStatus } from '@/models';

/**
 * Import from StoryGraph's library export (Settings > Import from
 * StoryGraph). Mirrors the actual Goodreads import pattern — direct
 * CSV field mapping, no external metadata lookup/matching phase.
 *
 * Correction from earlier scoping: this was originally planned to
 * reuse an "Open Library matching" step from the Goodreads import, but
 * that import doesn't actually do any Open Library matching — it maps
 * CSV fields directly. This import follows that same, simpler, actual
 * pattern instead.
 *
 * Export from StoryGraph: Manage Account > Manage Your Data > "Export
 * StoryGraph Library".
 *
 * Column header note: some StoryGraph exports use `ISBN`, others
 * `ISBN/UID` — irrelevant here since there's no ID-based matching, but
 * documented in case a future pass adds one.
 */

export interface StoryGraphRow {
  title: string;
  author?: string;
  mediaType: 'book' | 'audiobook';
  status: EntryStatus;
  /** Only ever set when status === 'completed'. One row is produced
   * per parsed date in the "Dates Read" column, so a reread with two
   * dates becomes two separate StoryGraphRow entries — each imports as
   * its own Media Journal entry, per David's decision (see chat). */
  completedDate?: string;
  /** 0–10 scale, doubled from StoryGraph's 0–5 (quarter-star)
   * scale, with half-step precision preserved rather than rounded to
   * a whole number — e.g. 4.5★ → 9.0, 3.75★ → 7.5 (see chat). */
  rating?: number;
  /** From the Review column, mapped to Media Journal's top-level
   * `notes` field (Goodreads/Letterboxd don't do this, but there's no
   * existing StoryGraph precedent either way — defaulted to mapping
   * it since it's clearly meaningful content, flagged in chat). */
  notes?: string;
  /** True for every read date after the first, chronologically — the
   * existing repeatConsumption flag Media Journal already has for
   * rewatches/rereads, applied per generated entry rather than once
   * for the whole book. */
  repeatConsumption: boolean;
  /** Moods, Pace, the five character-driven yes/no columns, Content
   * Warnings, and the Tags column all flatten into this single array,
   * per David's decision (see chat) — e.g. "mood: mysterious",
   * "pace: slow", "plot-driven", "cw: grief". */
  tags: string[];
}

/** StoryGraph's Read Status values. "did-not-finish" has no clean
 * mapping in Media Journal's three-state status system — folded into
 * 'in_progress', the same convention already agreed for MyAnimeList's
 * "dropped"/"on_hold" statuses (see chat). */
function statusForReadStatus(raw: string): EntryStatus | undefined {
  const value = raw.trim().toLowerCase();
  if (value === 'read') return 'completed';
  if (value === 'currently-reading') return 'in_progress';
  if (value === 'to-read') return 'wishlist';
  if (value === 'did-not-finish') return 'in_progress';
  return undefined;
}

/** StoryGraph exports "Dates Read" as a comma-separated list for books
 * read more than once. Parses each into an ISO date, silently dropping
 * anything unparseable (a reread with an unreadable date just doesn't
 * get its own entry, rather than blocking the whole row). */
function parseDatesRead(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => dayjs(part, ['YYYY/MM/DD', 'YYYY-MM-DD'], true))
    .filter((parsed) => parsed.isValid())
    .map((parsed) => parsed.format('YYYY-MM-DD'));
}

/** Flattens Moods/Pace/character-driven flags/Content Warnings/Tags
 * into one free-form tag list, per David's decision (see chat). */
function buildTags(record: Record<string, string>): string[] {
  const tags: string[] = [];

  for (const mood of (record['Moods'] ?? '').split(',').map((m) => m.trim()).filter(Boolean)) {
    tags.push(`mood: ${mood.toLowerCase()}`);
  }
  const pace = record['Pace']?.trim();
  if (pace) tags.push(`pace: ${pace.toLowerCase()}`);

  if (record['Character- or Plot-Driven?']?.trim().toLowerCase() === 'plot-driven') {
    tags.push('plot-driven');
  } else if (record['Character- or Plot-Driven?']?.trim().toLowerCase() === 'character-driven') {
    tags.push('character-driven');
  }

  const yesNoTagLabels: [string, string][] = [
    ['Strong Character Development?', 'strong character development'],
    ['Loveable Characters?', 'loveable characters'],
    ['Diverse Characters?', 'diverse characters'],
    ['Flawed Characters?', 'flawed characters'],
  ];
  for (const [column, label] of yesNoTagLabels) {
    if (record[column]?.trim().toLowerCase() === 'yes') tags.push(label);
  }

  for (const cw of (record['Content Warnings'] ?? '').split(',').map((c) => c.trim()).filter(Boolean)) {
    tags.push(`cw: ${cw.toLowerCase()}`);
  }

  for (const tag of (record['Tags'] ?? '').split(',').map((t) => t.trim()).filter(Boolean)) {
    tags.push(tag.toLowerCase());
  }

  return Array.from(new Set(tags));
}

/**
 * Parses a StoryGraph library export CSV. Rows missing a title or with
 * an unrecognized Read Status are dropped silently, same tolerance as
 * the Goodreads/Letterboxd imports. A completed row with multiple
 * "Dates Read" entries expands into multiple StoryGraphRow objects —
 * one per date — each carrying the same rating/notes/tags.
 */
export function parseStoryGraphLibrary(csvText: string): StoryGraphRow[] {
  const records = parseCsv(csvText);
  const rows: StoryGraphRow[] = [];

  for (const record of records) {
    const title = record['Title']?.trim();
    if (!title) continue;

    const status = statusForReadStatus(record['Read Status'] ?? '');
    if (!status) continue;

    const format = record['Format']?.trim().toLowerCase() ?? '';
    const mediaType = format.includes('audio') ? 'audiobook' : 'book';

    const starRating = Number(record['Star Rating']?.trim() ?? '0');
    // ×2 for MJ's 0–10 scale; rounded to the nearest 0.5 so the
    // existing rating field's half-step validation always accepts it,
    // even though StoryGraph itself supports quarter-star precision.
    const rating = starRating > 0 ? Math.round(starRating * 2 * 2) / 2 : undefined;

    const author = record['Author']?.trim() || undefined;
    const notes = record['Review']?.trim() || undefined;
    const tags = buildTags(record);

    if (status !== 'completed') {
      rows.push({ title, author, mediaType, status, rating, notes, tags, repeatConsumption: false });
      continue;
    }

    const readDates = parseDatesRead(record['Dates Read']);
    if (readDates.length === 0) {
      // Completed but no parseable date — still imported, just flagged
      // for review the same way a dateless Goodreads "read" row is.
      rows.push({ title, author, mediaType, status, rating, notes, tags, repeatConsumption: false });
    } else {
      const sortedDates = [...readDates].sort();
      sortedDates.forEach((completedDate, index) => {
        rows.push({
          title, author, mediaType, status, completedDate, rating, notes, tags,
          repeatConsumption: index > 0,
        });
      });
    }
  }

  return rows;
}

export type StoryGraphRowStatus = 'ready' | 'needs_date' | 'duplicate' | 'skipped';

export interface StoryGraphRowState {
  row: StoryGraphRow;
  status: StoryGraphRowStatus;
  /** Editable in the review UI when status === 'needs_date'; otherwise
   * mirrors row.completedDate. */
  completedDate?: string;
  /** Tick state for the review screen's "tick box" feature (see chat)
   * — meaningful for 'ready' rows; mirrors the Goodreads import's
   * identical field. */
  included: boolean;
}

/** Existing (mediaType, title, status, completedDate) keys already in
 * the library, used to skip rows re-imported on a later run — same
 * convention as the Goodreads import's dedupe key. */
async function loadExistingKeys(): Promise<Set<string>> {
  const existing = await db.mediaEntries.where('mediaType').anyOf(['book', 'audiobook']).toArray();
  return new Set(
    existing.map(
      (e) => `${e.mediaType}|${e.title.trim().toLowerCase()}|${e.status}|${e.completedDate ?? ''}`,
    ),
  );
}

function dedupeKey(row: StoryGraphRow): string {
  return `${row.mediaType}|${row.title.trim().toLowerCase()}|${row.status}|${row.completedDate ?? ''}`;
}

/** Classifies every parsed row against the existing library and
 * against itself (missing a usable completed date) — mirrors
 * classifyRows in the Goodreads import. */
export async function classifyRows(rows: StoryGraphRow[]): Promise<StoryGraphRowState[]> {
  const existingKeys = await loadExistingKeys();
  return rows.map((row) => {
    if (row.status === 'completed' && !row.completedDate) {
      return { row, status: 'needs_date', included: true };
    }
    if (existingKeys.has(dedupeKey(row))) {
      return { row, status: 'duplicate', included: false };
    }
    return { row, status: 'ready', completedDate: row.completedDate, included: true };
  });
}

function buildMetadata(row: StoryGraphRow): EntryMetadata {
  const metadata: EntryMetadata = { source: 'StoryGraph' };
  if (row.author) metadata['author'] = toTitleCase(row.author);
  return metadata;
}

/** Creates the MJ entry for one resolved row. Returns 'skipped' for
 * duplicates, explicitly-skipped rows, or needs_date rows the person
 * never filled in a date for — mirrors applyRow in the Goodreads
 * import. */
export async function applyRow(state: StoryGraphRowState): Promise<'imported' | 'skipped'> {
  const { row } = state;

  if (state.status === 'duplicate' || state.status === 'skipped') return 'skipped';
  if (row.status === 'completed' && !state.completedDate) return 'skipped';
  if (state.status === 'ready' && !state.included) return 'skipped';

  await createEntry({
    title: toTitleCase(row.title),
    mediaType: row.mediaType,
    status: row.status,
    completedDate: row.status === 'completed' ? state.completedDate : undefined,
    rating: row.rating,
    notes: row.notes,
    repeatConsumption: row.repeatConsumption,
    tags: row.tags,
    genres: [],
    metadata: buildMetadata(row),
  });

  return 'imported';
}
