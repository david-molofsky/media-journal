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

/** Most recently completed entries across all years, newest first. */
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
 * Longest consecutive-day completion streak within `year`.
 *
 * TODO (Milestone 6): implement once the Statistics screen design
 * settles on a precise streak definition (e.g. whether a day with
 * zero completions but an in-progress item still counts).
 */
export async function getLongestStreak(_year: number): Promise<number> {
  return 0;
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

/**
 * Total re-read / re-watched entries within `year`.
 *
 * TODO (Milestone 6): expand into the fuller "Total rereads/rewatches"
 * statistic described in PRD section 5 (currently a simple count).
 */
export async function getRepeatConsumption(year: number): Promise<number> {
  const entries = await entriesForYear(year);
  return entries.filter((entry) => entry.repeatConsumption).length;
}
