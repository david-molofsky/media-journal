import dayjs from 'dayjs';
import { parseCsv } from '@/utils/csvParser';
import { parseSeriesTitle } from '@/utils/importTitleParsing';
import { matchAndGroupRows, applyStreamingImport, type ReviewItem, type ApplyResult } from '@/services/importExport/streamingImportShared';

export type { ReviewItem, MovieReviewItem, ShowReviewGroup, ApplyResult } from '@/services/importExport/streamingImportShared';

/**
 * Import from the community "Watch History Exporter for Amazon Prime
 * Video" tool's CSV output (github.com/caret-collective/watch-history-
 * exporter-for-amazon-prime-video by John Goodliff, public domain) —
 * Amazon itself has no official export. Unlike Netflix, the CSV
 * already has an explicit Type column (Movie/Series) and a separate
 * Episode Title column, so classification doesn't need Netflix's
 * colon-splitting heuristic — only the season number still needs
 * parsing out of the show Title (e.g. "The Terminal List: Dark Wolf -
 * Season 1"). Matching/review/apply logic lives in
 * streamingImportShared.ts, shared with the Netflix import.
 */

export interface AmazonPrimeRow {
  title: string;
  type: 'Movie' | 'Series';
  /** Defensively parsed to YYYY-MM-DD from the exporter's "Date
   * Watched" column, which may be a human-readable date/time or a raw
   * Unix timestamp depending on the exporter's own configuration. */
  date: string;
}

function parseDateWatched(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;

  // Raw Unix timestamp in milliseconds, if the exporter's "Date
  // Formats" option was configured to disable human-readable dates.
  if (/^\d{10,}$/.test(trimmed)) {
    const parsed = dayjs(Number(trimmed));
    return parsed.isValid() ? parsed.format('YYYY-MM-DD') : undefined;
  }

  // Default exporter format: "yyyy-mm-dd hh:mm:ss.sss".
  const parsed = dayjs(trimmed, ['YYYY-MM-DD HH:mm:ss.SSS', 'YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD'], true);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : undefined;
}

/**
 * Parses the exporter's CSV. Rows missing a title, a usable date, or
 * an unrecognised Type are dropped silently, same tolerance as the
 * other CSV imports. Movie rows are deduped by title, keeping the
 * latest date (repeat viewings collapse to one row, same as Netflix);
 * series rows aren't deduped here since each episode row is meaningful
 * evidence for season grouping in matchAmazonPrimeRows.
 */
export function parseAmazonPrimeCsv(csvText: string): AmazonPrimeRow[] {
  const records = parseCsv(csvText);
  const movieByTitle = new Map<string, AmazonPrimeRow>();
  const seriesRows: AmazonPrimeRow[] = [];

  for (const record of records) {
    const title = record['Title']?.trim();
    const typeRaw = record['Type']?.trim();
    const date = parseDateWatched(record['Date Watched']);
    if (!title || !date) continue;
    if (typeRaw !== 'Movie' && typeRaw !== 'Series') continue;

    if (typeRaw === 'Movie') {
      const existing = movieByTitle.get(title);
      if (!existing || date > existing.date) {
        movieByTitle.set(title, { title, type: 'Movie', date });
      }
    } else {
      seriesRows.push({ title, type: 'Series', date });
    }
  }

  return [...movieByTitle.values(), ...seriesRows];
}

/** Classifies parsed rows by their Type column and runs TMDB
 * matching/grouping, same shared pipeline as the Netflix import. */
export async function matchAmazonPrimeRows(
  rows: AmazonPrimeRow[],
  onProgress?: (done: number, total: number) => void,
): Promise<ReviewItem[]> {
  const movieRows: { title: string; date: string }[] = [];
  const seriesRows: { title: string; showTitle: string; seasonNumber: number | undefined; date: string }[] = [];

  for (const row of rows) {
    if (row.type === 'Movie') {
      movieRows.push(row);
    } else {
      const { showTitle, seasonNumber } = parseSeriesTitle(row.title);
      seriesRows.push({ title: row.title, showTitle, seasonNumber, date: row.date });
    }
  }

  return matchAndGroupRows(movieRows, seriesRows, onProgress);
}

export function applyAmazonPrimeImport(items: ReviewItem[]): Promise<ApplyResult> {
  return applyStreamingImport(items, 'Amazon Prime Video');
}
