import { db } from '@/services/database/db';
import type { MediaEntry } from '@/models';

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
  return db.mediaEntries.where('completedYear').equals(year).toArray();
}

export interface YearSummary {
  year: number;
  totalEntries: number;
  totalsByMediaType: Record<string, number>;
}

export async function getYearSummary(year: number): Promise<YearSummary> {
  const entries = await entriesForYear(year);
  const totalsByMediaType: Record<string, number> = {};
  for (const entry of entries) {
    totalsByMediaType[entry.mediaType] = (totalsByMediaType[entry.mediaType] ?? 0) + 1;
  }
  return { year, totalEntries: entries.length, totalsByMediaType };
}

/** Entry counts for each calendar month (1–12) within `year`. */
export async function getMonthlyBreakdown(year: number): Promise<Record<number, number>> {
  const entries = await entriesForYear(year);
  const breakdown: Record<number, number> = {};
  for (let month = 1; month <= 12; month += 1) {
    breakdown[month] = 0;
  }
  for (const entry of entries) {
    const month = new Date(entry.completedDate).getMonth() + 1;
    breakdown[month] = (breakdown[month] ?? 0) + 1;
  }
  return breakdown;
}

/** Entry counts grouped by media type within `year`. */
export async function getMediaTypeTotals(year: number): Promise<Record<string, number>> {
  const summary = await getYearSummary(year);
  return summary.totalsByMediaType;
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

/** Entry counts grouped by ISO-ish week (1–53) within `year`. Weeks are
 * simple 7-day buckets from 1 January rather than true ISO weeks —
 * close enough for the activity chart this powers (UI & UX
 * Specification, section 8) without adding a date library plugin. */
export async function getWeeklyTotals(year: number): Promise<Record<number, number>> {
  const entries = await entriesForYear(year);
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const totals: Record<number, number> = {};
  for (const entry of entries) {
    const date = new Date(entry.completedDate);
    const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86_400_000) + 1;
    const week = Math.min(53, Math.max(1, Math.ceil(dayOfYear / 7)));
    totals[week] = (totals[week] ?? 0) + 1;
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
 * completions within `year`, or `null` if the year has no entries. */
export async function getMostActiveWeekday(year: number): Promise<number | null> {
  const entries = await entriesForYear(year);
  if (entries.length === 0) return null;
  const totals: Record<number, number> = {};
  for (const entry of entries) {
    const day = new Date(entry.completedDate).getDay();
    totals[day] = (totals[day] ?? 0) + 1;
  }
  return Number(
    Object.entries(totals).reduce((best, current) => (current[1] > best[1] ? current : best))[0],
  );
}
export async function getRecentEntries(limit: number): Promise<MediaEntry[]> {
  return db.mediaEntries.orderBy('completedDate').reverse().limit(limit).toArray();
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
