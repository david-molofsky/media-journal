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

async function entriesForYear(year: number): Promise<MediaEntry[]> {
  return db.mediaEntries
    .where('completedYear')
    .equals(year)
    .filter((entry) => !entry.status || entry.status === 'completed')
    .toArray();
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
  year: number;
  totalEntries: number;
  totalsByMediaType: Record<string, number>;
}

export async function getYearSummary(year: number): Promise<YearSummary> {
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
export async function getMonthlyBreakdown(year: number): Promise<Record<number, number>> {
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
export async function getMediaTypeTotals(year: number): Promise<Record<string, number>> {
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

/** Completed-entry counts grouped by Source within `year`, weighted by
 * `getEntryWeight` for consistency with other volume stats (e.g. a
 * multi-issue comic on a given Source counts its full issue span).
 * Entries with no Source set are excluded entirely, not bucketed under
 * an "Unknown" label — Source is optional, so most historical entries
 * won't have one, and lumping them together wouldn't be meaningful. */
export async function getTopSourcesByCount(year: number): Promise<Record<string, number>> {
  const [entries, tvMode] = await Promise.all([entriesForYear(year), getTvTrackingMode()]);
  const totals: Record<string, number> = {};
  for (const entry of entries) {
    const source = sourceOf(entry);
    if (!source) continue;
    totals[source] = (totals[source] ?? 0) + getEntryWeight(entry, tvMode);
  }
  return totals;
}

/** Wishlist entry counts grouped by Source, across all years — unlike
 * the rest of this service, this isn't year-scoped: wishlist entries
 * have no completion date to scope by, and "what's piled up waiting"
 * is inherently an all-time question. Plain counts, not weighted by
 * `getEntryWeight` — a wishlisted comic run hasn't been read yet, so
 * there's no meaningful "issue count consumed" to weight by. */
export async function getWishlistSourceTotals(): Promise<Record<string, number>> {
  const entries = await db.mediaEntries.where('status').equals('wishlist').toArray();
  const totals: Record<string, number> = {};
  for (const entry of entries) {
    const source = sourceOf(entry);
    if (!source) continue;
    totals[source] = (totals[source] ?? 0) + 1;
  }
  return totals;
}

/** Average rating per Source within `year`, ignoring unrated entries
 * and entries with no Source set. Mirrors
 * `getAverageRatingByMediaType` exactly, grouped by Source instead. */
export async function getAverageRatingBySource(year: number): Promise<Record<string, number>> {
  const entries = (await entriesForYear(year)).filter((entry) => entry.rating !== undefined);
  const sums: Record<string, { total: number; count: number }> = {};
  for (const entry of entries) {
    const source = sourceOf(entry);
    if (!source) continue;
    const bucket = sums[source] ?? { total: 0, count: 0 };
    bucket.total += entry.rating ?? 0;
    bucket.count += 1;
    sums[source] = bucket;
  }
  return Object.fromEntries(
    Object.entries(sums).map(([source, { total, count }]) => [source, total / count]),
  );
}

/** Histogram of ratings (0–10 in 0.5 steps) within `year`, ignoring
 * unrated entries. */
export async function getRatingDistribution(
  year: number,
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
export async function getAverageRating(year: number): Promise<number | null> {
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
  year: number,
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
 * rather than true ISO weeks — close enough for the activity chart
 * this powers (UI & UX Specification, section 8) without adding a
 * date library plugin. */
export async function getWeeklyTotals(year: number): Promise<Record<number, number>> {
  const [entries, tvMode] = await Promise.all([entriesForYear(year), getTvTrackingMode()]);
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const totals: Record<number, number> = {};
  for (const entry of entries) {
    const date = new Date(entry.completedDate ?? '');
    const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86_400_000) + 1;
    const week = Math.min(53, Math.max(1, Math.ceil(dayOfYear / 7)));
    totals[week] = (totals[week] ?? 0) + getEntryWeight(entry, tvMode);
  }
  return totals;
}

/** The media type with the most entries within `year`, or `null` if
 * the year has no entries. */
export async function getFavouriteMediaType(year: number): Promise<string | null> {
  const totals = await getMediaTypeTotals(year);
  const entries = Object.entries(totals);
  if (entries.length === 0) return null;
  return entries.reduce((best, current) => (current[1] > best[1] ? current : best))[0];
}

/** The calendar month (1–12) with the most completions within `year`,
 * or `null` if the year has no entries. */
export async function getMostActiveMonth(year: number): Promise<number | null> {
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
export async function getMostActiveWeekday(year: number): Promise<number | null> {
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
  year: number,
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
export async function getLongestStreak(year: number): Promise<number> {
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
export async function getMonthlyTrend(_year: number): Promise<Record<number, number>> {
  return getMonthlyBreakdown(_year);
}

/** Total re-read / re-watched entries within `year`. */
export async function getRepeatConsumption(year: number): Promise<number> {
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
 * Note: the PRD also calls out a "longest book" statistic, but the
 * data model has no page-count field for books (Database Schema &
 * Data Model, section 4) — adding one is a future-enhancement
 * decision, not something to infer here, so it's intentionally
 * omitted from both this function and the Statistics screen.
 */
export async function getInsights(year: number): Promise<string[]> {
  const [totals, previousTotals, favourite, weekday, repeats] = await Promise.all([
    getMediaTypeTotals(year),
    getMediaTypeTotals(year - 1),
    getFavouriteMediaType(year),
    getMostActiveWeekday(year),
    getRepeatConsumption(year),
  ]);

  const totalEntries = Object.values(totals).reduce((sum, count) => sum + count, 0);
  if (totalEntries === 0) return [];

  const insights: string[] = [];
  const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (favourite && totals[favourite] !== undefined) {
    const share = Math.round((totals[favourite] / totalEntries) * 100);
    insights.push(`${favourite} entries account for ${share}% of your media this year.`);
  }

  if (weekday !== null && WEEKDAY_NAMES[weekday]) {
    insights.push(`${WEEKDAY_NAMES[weekday]} is your most active completion day.`);
  }

  for (const [mediaType, count] of Object.entries(totals)) {
    const previousCount = previousTotals[mediaType] ?? 0;
    if (previousCount === 0 || count === previousCount) continue;
    const change = Math.round(((count - previousCount) / previousCount) * 100);
    if (Math.abs(change) < 10) continue;
    const direction = change > 0 ? 'more' : 'fewer';
    insights.push(`You consumed ${Math.abs(change)}% ${direction} ${mediaType} than last year.`);
  }

  if (repeats > 0) {
    insights.push(`You revisited ${repeats} ${repeats === 1 ? 'entry' : 'entries'} this year.`);
  }

  return insights;
}
