import dayjs from 'dayjs';
import { parseCsv } from '@/utils/csvParser';
import { parseSeriesTitle, looksLikeSeries } from '@/utils/importTitleParsing';
import { matchAndGroupRows, applyStreamingImport, type ReviewItem, type ApplyResult } from '@/services/importExport/streamingImportShared';

export type { ReviewItem, MovieReviewItem, ShowReviewGroup, ApplyResult } from '@/services/importExport/streamingImportShared';

/**
 * Import from Netflix's official "Viewing Activity" export (Account >
 * Profile & Parental Controls > Viewing Activity > Download all >
 * NetflixViewingHistory.csv). Two columns only — Title, Date — no id,
 * rating, runtime, or movie/TV flag, so classification and season
 * grouping both have to be inferred from the Title string alone (see
 * importTitleParsing.ts). Matching/review/apply logic lives in
 * streamingImportShared.ts, shared with the Amazon Prime Video import.
 */

export interface NetflixRow {
  title: string;
  /** Defensively parsed to YYYY-MM-DD — Netflix's own date format has
   * changed by region/era in the past, so this never hard-assumes
   * MM/DD/YY. Rows with an unparseable date are dropped. */
  date: string;
}

const DROPPED_TITLE_PATTERN = /\b(trailer|preview|interactive special)\b/i;
const DATE_FORMATS = ['M/D/YY', 'M/D/YYYY', 'YYYY-MM-DD', 'DD/MM/YYYY', 'MMM D, YYYY'];

function parseNetflixDate(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  const parsed = dayjs(trimmed, DATE_FORMATS, true);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : undefined;
}

/**
 * Parses NetflixViewingHistory.csv. Drops trailer/preview/interactive-
 * special rows and anything with an unreadable title/date, then
 * collapses repeated viewing-session rows for the same episode/movie
 * (e.g. watched across two sittings) down to one row with the latest
 * date — see chat scoping.
 */
export function parseNetflixCsv(csvText: string): NetflixRow[] {
  const records = parseCsv(csvText);
  const byTitle = new Map<string, NetflixRow>();

  for (const record of records) {
    const title = record['Title']?.trim();
    const date = parseNetflixDate(record['Date']);
    if (!title || !date) continue;
    if (DROPPED_TITLE_PATTERN.test(title)) continue;

    const existing = byTitle.get(title);
    if (!existing || date > existing.date) {
      byTitle.set(title, { title, date });
    }
  }

  return Array.from(byTitle.values());
}

/** Classifies parsed rows (movie vs. series+season, via Title-string
 * heuristics) and runs TMDB matching/grouping. */
export async function matchNetflixRows(
  rows: NetflixRow[],
  onProgress?: (done: number, total: number) => void,
): Promise<ReviewItem[]> {
  const movieRows: { title: string; date: string }[] = [];
  const seriesRows: { title: string; showTitle: string; seasonNumber: number | undefined; date: string }[] = [];

  for (const row of rows) {
    if (looksLikeSeries(row.title)) {
      const { showTitle, seasonNumber } = parseSeriesTitle(row.title);
      seriesRows.push({ title: row.title, showTitle, seasonNumber, date: row.date });
    } else {
      movieRows.push(row);
    }
  }

  return matchAndGroupRows(movieRows, seriesRows, onProgress);
}

export function applyNetflixImport(items: ReviewItem[]): Promise<ApplyResult> {
  return applyStreamingImport(items, 'Netflix');
}
