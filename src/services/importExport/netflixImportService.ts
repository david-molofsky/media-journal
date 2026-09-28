import dayjs from 'dayjs';
import { parseCsv } from '@/utils/csvParser';
import { parseSeriesTitle, looksLikeSeries } from '@/utils/importTitleParsing';
import {
  matchAndGroupRows,
  matchShowTitle,
  applyStreamingImport,
  type ReviewItem,
  type ApplyResult,
} from '@/services/importExport/streamingImportShared';

export type {
  ReviewItem,
  MovieReviewItem,
  ShowReviewGroup,
  ApplyResult,
} from '@/services/importExport/streamingImportShared';

/**
 * Import from Netflix's official Viewing Activity export. Netflix has
 * used several title formats over time, so classification combines
 * explicit labels with conservative batch-level evidence.
 */

export interface NetflixRow {
  title: string;
  date: string;
}

const DROPPED_TITLE_PATTERN =
  /\b(trailer|preview|recap|teaser|clip|interactive special)\b/i;
const DATE_FORMATS = ['M/D/YY', 'M/D/YYYY', 'YYYY-MM-DD', 'MMM D, YYYY'];
const NETFLIX_TITLE_OPTIONS = { resolvePartAsSeason: false } as const;

function parseNetflixDate(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  const parsed = dayjs(trimmed, DATE_FORMATS, true);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : undefined;
}

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

function legacyPrefix(title: string): string | undefined {
  const separator = title.indexOf(':');
  if (separator <= 0) return undefined;
  const prefix = title.slice(0, separator).trim();
  return prefix || undefined;
}

function legacyPrefixCandidates(title: string): string[] {
  const segments = title
    .split(':')
    .map((segment) => segment.trim())
    .filter(Boolean);
  const candidates: string[] = [];
  for (let i = segments.length - 1; i >= 1; i -= 1) {
    candidates.push(segments.slice(0, i).join(': '));
  }
  return candidates;
}

/**
 * Finds prefixes that occur on multiple legacy "Show: Episode" rows.
 * Repetition is only candidate evidence: matchNetflixRows still requires
 * either an explicit TV-labelled row for that prefix or an exact TMDB TV
 * match before classifying the rows as television.
 */
export function findRepeatedNetflixPrefixes(rows: NetflixRow[]): Set<string> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (looksLikeSeries(row.title, NETFLIX_TITLE_OPTIONS)) continue;
    const prefix = legacyPrefix(row.title);
    if (!prefix) continue;
    const key = prefix.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return new Set(
    Array.from(counts.entries())
      .filter(([, count]) => count >= 2)
      .map(([prefix]) => prefix),
  );
}

export async function matchNetflixRows(
  rows: NetflixRow[],
  onProgress?: (done: number, total: number) => void,
): Promise<ReviewItem[]> {
  const movieRows: { title: string; date: string; includeUnmatched?: boolean }[] = [];
  const seriesRows: {
    title: string;
    showTitle: string;
    seasonNumber: number | undefined;
    date: string;
  }[] = [];

  const explicitShowPrefixes = new Set<string>();
  for (const row of rows) {
    if (!looksLikeSeries(row.title, NETFLIX_TITLE_OPTIONS)) continue;
    const parsed = parseSeriesTitle(row.title, NETFLIX_TITLE_OPTIONS);
    explicitShowPrefixes.add(parsed.showTitle.trim().toLowerCase());
  }

  const repeatedPrefixes = findRepeatedNetflixPrefixes(rows);
  const verifiedLegacyPrefixes = new Map<string, string>();
  const showCache = new Map();

  for (const prefixKey of repeatedPrefixes) {
    if (explicitShowPrefixes.has(prefixKey)) {
      const displayPrefix = rows
        .map((row) => legacyPrefix(row.title))
        .find((prefix) => prefix?.toLowerCase() === prefixKey);
      if (displayPrefix) verifiedLegacyPrefixes.set(prefixKey, displayPrefix);
      continue;
    }

    const candidateTitles = Array.from(
      new Set(
        rows
          .filter((row) => legacyPrefix(row.title)?.toLowerCase() === prefixKey)
          .flatMap((row) => legacyPrefixCandidates(row.title)),
      ),
    );

    for (const candidate of candidateTitles) {
      const match = await matchShowTitle(candidate, showCache);
      if (match.status === 'auto') {
        verifiedLegacyPrefixes.set(prefixKey, candidate);
        break;
      }
    }
  }

  for (const row of rows) {
    if (looksLikeSeries(row.title, NETFLIX_TITLE_OPTIONS)) {
      const { showTitle, seasonNumber } = parseSeriesTitle(
        row.title,
        NETFLIX_TITLE_OPTIONS,
      );
      seriesRows.push({ title: row.title, showTitle, seasonNumber, date: row.date });
      continue;
    }

    const prefix = legacyPrefix(row.title);
    const verifiedShowTitle = prefix
      ? verifiedLegacyPrefixes.get(prefix.toLowerCase())
      : undefined;
    if (verifiedShowTitle) {
      seriesRows.push({
        title: row.title,
        showTitle: verifiedShowTitle,
        seasonNumber: undefined,
        date: row.date,
      });
      continue;
    }

    movieRows.push({
      ...row,
      includeUnmatched: prefix === undefined,
    });
  }

  return matchAndGroupRows(movieRows, seriesRows, onProgress);
}

export function applyNetflixImport(items: ReviewItem[]): Promise<ApplyResult> {
  return applyStreamingImport(items, 'Netflix');
}
