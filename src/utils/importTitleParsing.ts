/**
 * Shared helper for classifying/parsing streaming-service watch-history
 * exports (Netflix, Amazon Prime Video) where a single "Title" column
 * carries the show name and season info together.
 */

const SEASON_PATTERN = /season\s+(\d+)/i;
const SERIES_PATTERN = /series\s+(\d+)/i;
const PART_PATTERN = /part\s+(\d+)/i;
const VOLUME_PATTERN = /volume\s+(\d+)/i;
const LIMITED_SERIES_PATTERN = /limited series/i;

export interface TitleSeasonInfo {
  /** True if the segment contains a reliable TV-series signal. */
  isSeries: boolean;
  /** Parsed season number when the label is known to represent a season. */
  seasonNumber?: number;
}

export interface ParseTitleOptions {
  /**
   * Amazon's exporter uses Part as season evidence. Netflix historically
   * used Part labels that do not reliably map 1:1 to TMDB seasons, so its
   * importer disables this conversion.
   */
  resolvePartAsSeason?: boolean;
}

export function parseTitleSegment(
  segment: string,
  options: ParseTitleOptions = {},
): TitleSeasonInfo {
  const trimmed = segment.trim();

  const seasonMatch = trimmed.match(SEASON_PATTERN);
  if (seasonMatch?.[1]) {
    return { isSeries: true, seasonNumber: Number(seasonMatch[1]) };
  }

  const seriesMatch = trimmed.match(SERIES_PATTERN);
  if (seriesMatch?.[1]) {
    return { isSeries: true, seasonNumber: Number(seriesMatch[1]) };
  }

  const partMatch = trimmed.match(PART_PATTERN);
  if (partMatch?.[1]) {
    return {
      isSeries: true,
      seasonNumber:
        options.resolvePartAsSeason === false ? undefined : Number(partMatch[1]),
    };
  }

  if (VOLUME_PATTERN.test(trimmed)) {
    return { isSeries: true };
  }

  if (LIMITED_SERIES_PATTERN.test(trimmed)) {
    return { isSeries: true, seasonNumber: 1 };
  }

  return { isSeries: false };
}

export function parseSeriesTitle(
  fullTitle: string,
  options: ParseTitleOptions = {},
): {
  showTitle: string;
  seasonNumber: number | undefined;
} {
  const segments = fullTitle
    .split(/[:\-–]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) {
    return { showTitle: fullTitle.trim(), seasonNumber: undefined };
  }

  for (let i = 1; i < segments.length; i += 1) {
    const info = parseTitleSegment(segments[i]!, options);
    if (info.isSeries) {
      return {
        showTitle: segments.slice(0, i).join(': '),
        seasonNumber: info.seasonNumber,
      };
    }
  }

  return { showTitle: segments[0]!, seasonNumber: undefined };
}

/** True when a title contains an explicit TV-series marker. */
export function looksLikeSeries(
  fullTitle: string,
  options: ParseTitleOptions = {},
): boolean {
  const segments = fullTitle
    .split(/[:\-–]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return segments
    .slice(1)
    .some((segment) => parseTitleSegment(segment, options).isSeries);
}
