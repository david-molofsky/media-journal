/**
 * Shared helper for classifying/parsing streaming-service watch-history
 * exports (Netflix, Amazon Prime Video) where a single "Title" column
 * carries the show name and season info together, rather than separate
 * columns — e.g. "Stranger Things: Season 4" or "The Terminal List:
 * Dark Wolf - Season 1". Both imports look for the same three signal
 * phrases to decide "this is TV, not a movie": an explicit season
 * number, "Limited Series", or "Part N" (some Netflix/Amazon minis are
 * split into numbered Parts instead of Seasons).
 */

const SEASON_PATTERN = /season\s+(\d+)/i;
const PART_PATTERN = /part\s+(\d+)/i;
const LIMITED_SERIES_PATTERN = /limited series/i;

export interface TitleSeasonInfo {
  /** True if any segment matched a season/part/limited-series signal. */
  isSeries: boolean;
  /** Parsed season number, if found. "Limited Series" alone (no
   * explicit number) and unnumbered "Part" segments fall back to
   * season 1 — both describe a single self-contained season. */
  seasonNumber?: number;
}

/**
 * Inspects one colon/dash-separated segment of a title (e.g. "Season
 * 4", "Part 2", "Limited Series") and reports what it found. Segments
 * that match none of the patterns return `{ isSeries: false }` — the
 * caller keeps scanning the remaining segments.
 */
export function parseTitleSegment(segment: string): TitleSeasonInfo {
  const trimmed = segment.trim();

  const seasonMatch = trimmed.match(SEASON_PATTERN);
  if (seasonMatch?.[1]) {
    return { isSeries: true, seasonNumber: Number(seasonMatch[1]) };
  }

  const partMatch = trimmed.match(PART_PATTERN);
  if (partMatch?.[1]) {
    return { isSeries: true, seasonNumber: Number(partMatch[1]) };
  }

  if (LIMITED_SERIES_PATTERN.test(trimmed)) {
    return { isSeries: true, seasonNumber: 1 };
  }

  return { isSeries: false };
}

/**
 * Scans every colon-or-dash-separated segment of a full title string
 * and returns the show name (everything before the first matching
 * segment) plus whatever season info was found. Segments are checked
 * left-to-right; the first match wins, since Netflix/Amazon always put
 * the season/part marker directly after the show name.
 */
export function parseSeriesTitle(fullTitle: string): {
  showTitle: string;
  seasonNumber: number | undefined;
} {
  const segments = fullTitle.split(/[:\-–]/).map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return { showTitle: fullTitle.trim(), seasonNumber: undefined };

  for (let i = 1; i < segments.length; i += 1) {
    const info = parseTitleSegment(segments[i]!);
    if (info.isSeries) {
      return { showTitle: segments.slice(0, i).join(': '), seasonNumber: info.seasonNumber };
    }
  }

  // No season/part/limited-series segment found anywhere — still may
  // be a series (e.g. an unnumbered special), but callers treat this
  // as "no season resolved" and fall back to season 1 evidence-only.
  return { showTitle: segments[0]!, seasonNumber: undefined };
}

/** True if the full title contains any season/part/limited-series
 * signal in any segment after the first — used to classify a row as
 * TV vs. Movie before attempting to parse out a season number. */
export function looksLikeSeries(fullTitle: string): boolean {
  const segments = fullTitle.split(/[:\-–]/).map((s) => s.trim()).filter(Boolean);
  return segments.slice(1).some((s) => parseTitleSegment(s).isSeries);
}
