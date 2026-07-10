import dayjs from 'dayjs';
import { db } from '@/services/database/db';
import type { MediaEntry } from '@/models';
import type { TvTrackingMode } from '@/models';
import { comicIssueCount } from '@/utils/comicIssues';

/**
 * Statistics service.
 *
 * Per the Database Schema & Data Model document, section 9: "All
 * analytics should be generated through a dedicated statistics
 * service... UI components must consume these functions rather than
 * querying the database directly." Function names below match that
 * section's list exactly.
 *
 * This is a Milestone 2 skeleton: the straightforward aggregations
 * (totals, breakdowns, averages, recent/highest-rated entries) are
 * fully implemented now, since the data model already supports them
 * directly. `getLongestStreak`, `getMonthlyTrend` and
 * `getRepeatConsumption` are left as documented stubs — streaks and
 * trends depend on definitions (e.g. what counts as a "streak", what
 * window a "trend" covers) that are better pinned down alongside the
 * Statistics screen design in Milestone 6, rather than guessed at here.
 */

/** `year === null` means "All" (every completed entry, no year
 * filter) — a full-table scan rather than the indexed `completedYear`
 * lookup, which is fine at personal-library scale and keeps this one
 * function as the single place every statistic routes through
 * regardless of scope (see chat). */
async function entriesForYear(year: number | null): Promise<MediaEntry[]> {
  const entries =
    year === null
      ? await db.mediaEntries.toArray()
      : await db.mediaEntries.where('completedYear').equals(year).toArray();
  return entries.filter((entry) => !entry.status || entry.status === 'completed');
}

/** Reads the TV tracking mode from the database (not reactive — used
 * only inside statistics service functions which are already async). */
async function getTvTrackingMode(): Promise<TvTrackingMode> {
  const record = await db.appSettings.get('tvTrackingMode');
  return (record?.value as TvTrackingMode) ?? 'season';
}

/**
 * How much a single entry counts toward volume statistics (totals,
 * monthly/weekly breakdowns). Per PRD section 5 ("the application
 * automatically calculates the number of comic issues represented by
 * the issue range") and section 5's dashboard spec ("Total comic
 * issues"), a comic entry counts as however many issues it covers,
 * not as one record — issues 6–11 contribute 6, not 1. TV entries
 * follow the same logic when the user has enabled episode tracking.
 * Every other media type counts as 1 per entry. This only applies to
 * *counting* statistics; ratings, streaks and entry lists
 * (highest-rated, recent activity) still treat each record as one
 * item, since a six-issue entry is still a single rating and a single
 * thing to revisit.
 */
function getEntryWeight(entry: MediaEntry, tvMode: TvTrackingMode): number {
  if (entry.mediaType === 'comic') {
    const { issueStart, issueEnd } = entry.metadata;
    if (typeof issueStart !== 'number' || typeof issueEnd !== 'number' || issueEnd < issueStart) {
      return 1;
    }
    return comicIssueCount(issueStart, issueEnd);
  }
  if (entry.mediaType === 'tv' && tvMode === 'episode') {
    const { episodeStart, episodeEnd } = entry.metadata;
    if (
      typeof episodeStart === 'number' &&
      typeof episodeEnd === 'number' &&
      episodeEnd >= episodeStart
    ) {
      return episodeEnd - episodeStart + 1;
    }
  }
  return 1;
}

export interface YearSummary {
  year: number | null;
  totalEntries: number;
  totalsByMediaType: Record<string, number>;
}

export async function getYearSummary(year: number | null): Promise<YearSummary> {
  const [entries, tvMode] = await Promise.all([entriesForYear(year), getTvTrackingMode()]);
  const totalsByMediaType: Record<string, number> = {};
  let totalEntries = 0;
  for (const entry of entries) {
    const weight = getEntryWeight(entry, tvMode);
    totalsByMediaType[entry.mediaType] = (totalsByMediaType[entry.mediaType] ?? 0) + weight;
    totalEntries += weight;
  }
  return { year, totalEntries, totalsByMediaType };
}

/** Entry counts for each calendar month (1–12) within `year`, weighted
 * by `getEntryWeight` so a multi-issue comic entry contributes its
 * full issue count rather than one. */
export async function getMonthlyBreakdown(year: number | null): Promise<Record<number, number>> {
  const [entries, tvMode] = await Promise.all([entriesForYear(year), getTvTrackingMode()]);
  const breakdown: Record<number, number> = {};
  for (let month = 1; month <= 12; month += 1) {
    breakdown[month] = 0;
  }
  for (const entry of entries) {
    const month = new Date(entry.completedDate ?? '').getMonth() + 1;
    breakdown[month] = (breakdown[month] ?? 0) + getEntryWeight(entry, tvMode);
  }
  return breakdown;
}

/** Entry counts grouped by media type within `year`. */
export async function getMediaTypeTotals(year: number | null): Promise<Record<string, number>> {
  const summary = await getYearSummary(year);
  return summary.totalsByMediaType;
}

/** Extracts `metadata.source` from an entry, or `undefined` if unset —
 * shared by all three Source-based statistics below so "no source set"
 * is handled identically everywhere. */
function sourceOf(entry: MediaEntry): string | undefined {
  const { source } = entry.metadata;
  return typeof source === 'string' && source.trim() ? source : undefined;
}

/** Completed-entry counts grouped by media type, then by Source, within
 * `year` — weighted by `getEntryWeight` for consistency with other
 * volume stats (e.g. a multi-issue comic on a given Source counts its
 * full issue span). Grouped by media type (rather than one flat list)
 * so sources that are only meaningful within their own type — e.g.
 * Netflix/Disney+ (Film & TV) vs Spotify (Podcasts) vs Humble Bundle
 * (Comics) — can be compared against each other without unrelated
 * types mixed in. Entries with no Source set are excluded entirely,
 * not bucketed under an "Unknown" label — Source is optional, so most
 * historical entries won't have one, and lumping them together
 * wouldn't be meaningful. */
export async function getTopSourcesByCount(year: number | null): Promise<Record<string, Record<string, number>>> {
  const [entries, tvMode] = await Promise.all([entriesForYear(year), getTvTrackingMode()]);
  const totals: Record<string, Record<string, number>> = {};
  for (const entry of entries) {
    const source = sourceOf(entry);
    if (!source) continue;
    const group = totals[entry.mediaType] ?? {};
    group[source] = (group[source] ?? 0) + getEntryWeight(entry, tvMode);
    totals[entry.mediaType] = group;
  }
  return totals;
}

/** Wishlist entry counts grouped by media type, then by Source, across
 * all years — unlike the rest of this service, this isn't year-scoped:
 * wishlist entries have no completion date to scope by, and "what's
 * piled up waiting" is inherently an all-time question. Plain counts,
 * not weighted by `getEntryWeight` — a wishlisted comic run hasn't
 * been read yet, so there's no meaningful "issue count consumed" to
 * weight by. Grouped by media type for the same reason as
 * `getTopSourcesByCount` above. */
export async function getWishlistSourceTotals(): Promise<Record<string, Record<string, number>>> {
  const entries = await db.mediaEntries.where('status').equals('wishlist').toArray();
  const totals: Record<string, Record<string, number>> = {};
  for (const entry of entries) {
    const source = sourceOf(entry);
    if (!source) continue;
    const group = totals[entry.mediaType] ?? {};
    group[source] = (group[source] ?? 0) + 1;
    totals[entry.mediaType] = group;
  }
  return totals;
}

/** Average rating per media type, then per Source, within `year`,
 * ignoring unrated entries and entries with no Source set. Mirrors
 * `getAverageRatingByMediaType` exactly, grouped by Source within each
 * media type instead. Grouped by media type for the same reason as
 * `getTopSourcesByCount` above. */
export async function getAverageRatingBySource(year: number | null): Promise<Record<string, Record<string, number>>> {
  const entries = (await entriesForYear(year)).filter((entry) => entry.rating !== undefined);
  const sums: Record<string, Record<string, { total: number; count: number }>> = {};
  for (const entry of entries) {
    const source = sourceOf(entry);
    if (!source) continue;
    const group = sums[entry.mediaType] ?? {};
    const bucket = group[source] ?? { total: 0, count: 0 };
    bucket.total += entry.rating ?? 0;
    bucket.count += 1;
    group[source] = bucket;
    sums[entry.mediaType] = group;
  }
  const result: Record<string, Record<string, number>> = {};
  for (const [mediaType, sources] of Object.entries(sums)) {
    result[mediaType] = Object.fromEntries(
      Object.entries(sources).map(([source, { total, count }]) => [source, total / count]),
    );
  }
  return result;
}

/** Completed-entry counts by Genre within `year`, weighted by
 * `getEntryWeight`. Flat (not grouped by media type) unlike the Source
 * statistics above — a "Fantasy" book and a "Fantasy" film are the
 * same genre, so grouping by type would just split one genre's totals
 * across several sections for no benefit. An entry can have multiple
 * genres; each one it has gets the entry's full weight, same as how
 * Tags work — this is a "how much did I consume tagged X" count, not
 * a mutually-exclusive breakdown. */
export async function getTopGenresByCount(year: number | null): Promise<Record<string, number>> {
  const [entries, tvMode] = await Promise.all([entriesForYear(year), getTvTrackingMode()]);
  const totals: Record<string, number> = {};
  for (const entry of entries) {
    const weight = getEntryWeight(entry, tvMode);
    for (const genre of entry.genres ?? []) {
      totals[genre] = (totals[genre] ?? 0) + weight;
    }
  }
  return totals;
}

/** Average rating per Genre within `year`, ignoring unrated entries.
 * Flat, for the same reason as `getTopGenresByCount`. An entry with
 * multiple genres contributes its rating to each genre's average. */
export async function getAverageRatingByGenre(year: number | null): Promise<Record<string, number>> {
  const entries = (await entriesForYear(year)).filter((entry) => entry.rating !== undefined);
  const sums: Record<string, { total: number; count: number }> = {};
  for (const entry of entries) {
    for (const genre of entry.genres ?? []) {
      const bucket = sums[genre] ?? { total: 0, count: 0 };
      bucket.total += entry.rating ?? 0;
      bucket.count += 1;
      sums[genre] = bucket;
    }
  }
  return Object.fromEntries(
    Object.entries(sums).map(([genre, { total, count }]) => [genre, total / count]),
  );
}

/** Wishlist entry counts by Genre, across all years — mirrors
 * `getWishlistSourceTotals` (all-time, plain counts, not weighted),
 * but flat rather than grouped by media type, for the same reason as
 * `getTopGenresByCount`. */
export async function getWishlistGenreTotals(): Promise<Record<string, number>> {
  const entries = await db.mediaEntries.where('status').equals('wishlist').toArray();
  const totals: Record<string, number> = {};
  for (const entry of entries) {
    for (const genre of entry.genres ?? []) {
      totals[genre] = (totals[genre] ?? 0) + 1;
    }
  }
  return totals;
}

export interface TopGenreShareByMediaType {
  genre: string;
  /** This genre's weighted share of every completed entry within
   * `year` (0–100, rounded) — the headline number used in the
   * "X is your favourite genre" insight. */
  overallPercentage: number;
  /** Per media type present in `year`: what percentage of that type's
   * *own* completed entries carry the top genre (e.g. 42% of Books
   * were Sci-Fi). Unweighted — a genre either applies to an entry or
   * it doesn't, unlike `getTopGenresByCount`'s comic/TV-episode
   * weighting, since this answers "how much of this type is this
   * genre" rather than "how much volume did I consume". Media types
   * with zero entries this year are omitted entirely; a type with
   * entries but none matching the top genre still appears, at 0%. */
  shareByMediaType: { mediaType: string; percentage: number }[];
}

/**
 * Finds the single most-consumed genre within `year` (same weighting
 * as `getTopGenresByCount`) and breaks down what share of each media
 * type it represents — the "42% of your books, 38% of your films were
 * Sci-Fi" statistic. Returns `null` when there's no genre data at all
 * for the year, so callers can skip rendering rather than showing an
 * empty breakdown.
 */
export async function getTopGenreShareByMediaType(
  year: number | null,
): Promise<TopGenreShareByMediaType | null> {
  const [entries, tvMode] = await Promise.all([entriesForYear(year), getTvTrackingMode()]);
  if (entries.length === 0) return null;

  const genreTotals: Record<string, number> = {};
  let totalWeighted = 0;
  for (const entry of entries) {
    const weight = getEntryWeight(entry, tvMode);
    totalWeighted += weight;
    for (const genre of entry.genres ?? []) {
      genreTotals[genre] = (genreTotals[genre] ?? 0) + weight;
    }
  }

  const topEntry = Object.entries(genreTotals).sort(([, a], [, b]) => b - a)[0];
  if (!topEntry) return null;
  const [genre, genreWeight] = topEntry;

  const totalsByType: Record<string, number> = {};
  const matchingByType: Record<string, number> = {};
  for (const entry of entries) {
    totalsByType[entry.mediaType] = (totalsByType[entry.mediaType] ?? 0) + 1;
    if ((entry.genres ?? []).includes(genre)) {
      matchingByType[entry.mediaType] = (matchingByType[entry.mediaType] ?? 0) + 1;
    }
  }

  const shareByMediaType = Object.entries(totalsByType)
    .map(([mediaType, total]) => ({
      mediaType,
      percentage: Math.round(((matchingByType[mediaType] ?? 0) / total) * 100),
    }))
    .sort((a, b) => b.percentage - a.percentage);

  return {
    genre,
    overallPercentage: Math.round((genreWeight / totalWeighted) * 100),
    shareByMediaType,
  };
}

/** Histogram of ratings (0–10 in 0.5 steps) within `year`, ignoring
 * unrated entries. */
export async function getRatingDistribution(
  year: number | null,
): Promise<Record<number, number>> {
  const entries = await entriesForYear(year);
  const distribution: Record<number, number> = {};
  for (const entry of entries) {
    if (entry.rating === undefined) continue;
    distribution[entry.rating] = (distribution[entry.rating] ?? 0) + 1;
  }
  return distribution;
}

/** Average rating within `year`, ignoring unrated entries. `null` if
 * no rated entries exist. */
export async function getAverageRating(year: number | null): Promise<number | null> {
  const entries = (await entriesForYear(year)).filter(
    (entry) => entry.rating !== undefined,
  );
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, entry) => sum + (entry.rating ?? 0), 0);
  return total / entries.length;
}

/** Average rating per media type within `year`, ignoring unrated
 * entries and media types with no rated entries. */
export async function getAverageRatingByMediaType(
  year: number | null,
): Promise<Record<string, number>> {
  const entries = (await entriesForYear(year)).filter((entry) => entry.rating !== undefined);
  const sums: Record<string, { total: number; count: number }> = {};
  for (const entry of entries) {
    const bucket = sums[entry.mediaType] ?? { total: 0, count: 0 };
    bucket.total += entry.rating ?? 0;
    bucket.count += 1;
    sums[entry.mediaType] = bucket;
  }
  return Object.fromEntries(
    Object.entries(sums).map(([mediaType, { total, count }]) => [mediaType, total / count]),
  );
}

/** Entry counts grouped by ISO-ish week (1–53) within `year`, weighted
 * by `getEntryWeight`. Weeks are simple 7-day buckets from 1 January
 * of *each entry's own* completion year — rather than a single week-0
 * anchor computed once — so this doubles as "week-of-year across all
 * history" when `year` is null (All): every entry lands in the week
 * bucket for its own year, and buckets from different years add up
 * together, answering "which weeks are typically busiest" rather than
 * mixing in absolute-date math that would only make sense for one
 * year. True ISO weeks aren't used — close enough for the activity
 * chart this powers without adding a date library plugin. */
export async function getWeeklyTotals(year: number | null): Promise<Record<number, number>> {
  const [entries, tvMode] = await Promise.all([entriesForYear(year), getTvTrackingMode()]);
  const totals: Record<number, number> = {};
  for (const entry of entries) {
    const date = new Date(entry.completedDate ?? '');
    const startOfYear = new Date(Date.UTC(date.getFullYear(), 0, 1));
    const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86_400_000) + 1;
    const week = Math.min(53, Math.max(1, Math.ceil(dayOfYear / 7)));
    totals[week] = (totals[week] ?? 0) + getEntryWeight(entry, tvMode);
  }
  return totals;
}

/** The media type with the most entries within `year`, or `null` if
 * the year has no entries. */
export async function getFavouriteMediaType(year: number | null): Promise<string | null> {
  const totals = await getMediaTypeTotals(year);
  const entries = Object.entries(totals);
  if (entries.length === 0) return null;
  return entries.reduce((best, current) => (current[1] > best[1] ? current : best))[0];
}

/** The calendar month (1–12) with the most completions within `year`,
 * or `null` if the year has no entries. */
export async function getMostActiveMonth(year: number | null): Promise<number | null> {
  const breakdown = await getMonthlyBreakdown(year);
  const entries = Object.entries(breakdown).filter(([, count]) => count > 0);
  if (entries.length === 0) return null;
  return Number(entries.reduce((best, current) => (current[1] > best[1] ? current : best))[0]);
}

/** The day of the week (0 = Sunday … 6 = Saturday) with the most
 * completions within `year`, or `null` if the year has no entries.
 * Deliberately counts records, not `getEntryWeight` — this is about
 * which day you tend to log entries, not how much volume you got
 * through, so a single six-issue comic shouldn't outweigh six
 * separate days of reading. */
export async function getMostActiveWeekday(year: number | null): Promise<number | null> {
  const entries = await entriesForYear(year);
  if (entries.length === 0) return null;
  const totals: Record<number, number> = {};
  for (const entry of entries) {
    const day = new Date(entry.completedDate ?? '').getDay();
    totals[day] = (totals[day] ?? 0) + 1;
  }
  return Number(
    Object.entries(totals).reduce((best, current) => (current[1] > best[1] ? current : best))[0],
  );
}
/** Most recently completed entries across all years, newest first. */
export async function getRecentEntries(limit: number): Promise<MediaEntry[]> {
  return db.mediaEntries
    .where('status')
    .equals('completed')
    .sortBy('completedDate')
    .then((entries) => entries.reverse().slice(0, limit));
}

/**
 * Number of consecutive calendar days (ending today or yesterday) on
 * which at least one entry was completed. Returns 0 if there are no
 * entries or the most recent entry is more than one day old. Looks
 * across all years so a streak that started in December keeps running
 * into January.
 */
export async function getCurrentStreak(): Promise<number> {
  const entries = await db.mediaEntries
    .where('status')
    .equals('completed')
    .sortBy('completedDate')
    .then((rows) => rows.reverse());
  if (entries.length === 0) return 0;

  const today = dayjs().format('YYYY-MM-DD');
  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  const distinctDays = Array.from(
    new Set(entries.map((entry) => entry.completedDate)),
  ).sort().reverse();

  const mostRecent = distinctDays[0];
  if (mostRecent !== today && mostRecent !== yesterday) return 0;

  let streak = 1;
  for (let index = 1; index < distinctDays.length; index += 1) {
    const prev = distinctDays[index - 1];
    const curr = distinctDays[index];
    if (!prev || !curr) break;
    if (dayjs(prev).diff(dayjs(curr), 'day') === 1) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

/** Highest-rated entries within `year`, highest first. */
export async function getHighestRated(
  year: number | null,
  limit: number,
): Promise<MediaEntry[]> {
  const entries = (await entriesForYear(year))
    .filter((entry) => entry.rating !== undefined)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  return entries.slice(0, limit);
}

/**
 * Longest run of consecutive calendar days with at least one
 * completion within `year`. Multiple entries on the same day count
 * once; the streak resets on any gap of a full day or more.
 */
export async function getLongestStreak(year: number | null): Promise<number> {
  const entries = await entriesForYear(year);
  if (entries.length === 0) return 0;

  const distinctDays = Array.from(
    new Set(entries.map((entry) => entry.completedDate)),
  ).sort();

  let longest = 1;
  let current = 1;
  for (let index = 1; index < distinctDays.length; index += 1) {
    const previousDayIso = distinctDays[index - 1];
    const dayIso = distinctDays[index];
    if (!previousDayIso || !dayIso) continue;
    const diffDays = Math.round(
      (new Date(dayIso).getTime() - new Date(previousDayIso).getTime()) / 86_400_000,
    );
    current = diffDays === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

/**
 * Month-over-month consumption trend within `year`.
 *
 * TODO (Milestone 6): implement alongside the Statistics screen's
 * "Trends" section (PRD section 5; UI & UX Specification section 8).
 */
export async function getMonthlyTrend(_year: number | null): Promise<Record<number, number>> {
  return getMonthlyBreakdown(_year);
}

/** Total re-read / re-watched entries within `year`. */
export async function getRepeatConsumption(year: number | null): Promise<number> {
  const entries = await entriesForYear(year);
  return entries.filter((entry) => entry.repeatConsumption).length;
}

/**
 * Short, dynamically-generated observations about `year`'s
 * consumption, per UI & UX Specification section 8 (e.g. "You
 * consumed 38% more books than last year", "Friday is your most
 * active completion day"). Returns an empty array for a year with no
 * entries rather than guessing.
 *
 * `year === null` (All) reworks the "this year" phrasing to "overall"
 * and drops the year-over-year comparison entirely — there's no
 * previous-period baseline to compare All time against (see chat).
 *
 * Note: the PRD also calls out a "longest book" statistic, but the
 * data model has no page-count field for books (Database Schema &
 * Data Model, section 4) — adding one is a future-enhancement
 * decision, not something to infer here, so it's intentionally
 * omitted from both this function and the Statistics screen.
 */
export async function getInsights(year: number | null): Promise<string[]> {
  const [totals, previousTotals, favourite, weekday, repeats, topGenre] = await Promise.all([
    getMediaTypeTotals(year),
    year === null ? Promise.resolve({} as Record<string, number>) : getMediaTypeTotals(year - 1),
    getFavouriteMediaType(year),
    getMostActiveWeekday(year),
    getRepeatConsumption(year),
    getTopGenreShareByMediaType(year),
  ]);

  const totalEntries = Object.values(totals).reduce((sum, count) => sum + count, 0);
  if (totalEntries === 0) return [];

  const insights: string[] = [];
  const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const scope = year === null ? 'overall' : 'this year';

  if (favourite && totals[favourite] !== undefined) {
    const share = Math.round((totals[favourite] / totalEntries) * 100);
    insights.push(`${favourite} entries account for ${share}% of your media ${scope}.`);
  }

  if (topGenre) {
    insights.push(
      `${topGenre.genre} is your favourite genre ${scope}, making up ${topGenre.overallPercentage}% of what you completed.`,
    );
  }

  if (weekday !== null && WEEKDAY_NAMES[weekday]) {
    insights.push(
      `${WEEKDAY_NAMES[weekday]} is your most active completion day${year === null ? ' overall' : ''}.`,
    );
  }

  if (year !== null) {
    for (const [mediaType, count] of Object.entries(totals)) {
      const previousCount = previousTotals[mediaType] ?? 0;
      if (previousCount === 0 || count === previousCount) continue;
      const change = Math.round(((count - previousCount) / previousCount) * 100);
      if (Math.abs(change) < 10) continue;
      const direction = change > 0 ? 'more' : 'fewer';
      insights.push(`You consumed ${Math.abs(change)}% ${direction} ${mediaType} than last year.`);
    }
  }

  if (repeats > 0) {
    insights.push(
      `You revisited ${repeats} ${repeats === 1 ? 'entry' : 'entries'} ${year === null ? 'in total' : 'this year'}.`,
    );
  }

  return insights;
}
