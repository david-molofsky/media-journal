import dayjs from 'dayjs';
import { db } from '@/services/database/db';
import type { MediaEntry } from '@/models';
import type { TvTrackingMode } from '@/models';
import { comicIssueCount } from '@/utils/comicIssues';
import { PERSON_ROLE_FIELDS, splitPeople, type PersonRole } from '@/utils/personRoles';

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

/** The Statistics page's time-scope selector: a specific calendar
 * year, `null` for "All" (every completed entry, no time bound), or
 * `'last12'` for a rolling 12-month window ending today. Added
 * alongside `'last12'` — see chat (Statistics page filters applying
 * to Subscription Value) — so every statistic on the page, including
 * Subscription Value, can share one consistent time scope instead of
 * Subscription Value running its own independent rolling window. */
export type StatsYearScope = number | null | 'last12';

/** Filters applied on top of the year scope, from the Statistics page's
 * filter bar (Media Type, Genre, Tags, Rating range). All optional —
 * an empty/undefined filters object behaves exactly as before this
 * feature existed. Deliberately excludes Status (Statistics already
 * uses separate code paths for Completed vs Wishlist throughout, not
 * a toggle on the same query) and a standalone date range (the page's
 * existing Year selector already does that job). */
export interface StatsFilters {
  /** Entry must be one of these media types. Empty/undefined = all. */
  mediaTypeIds?: string[];
  /** Entry's `genres` array must include this value. */
  genre?: string;
  /** Entry's `tags` array must include this value. */
  tag?: string;
  /** Entry's `rating` must fall within [ratingMin, ratingMax] — an
   * entry with no rating is excluded once either bound is set. */
  ratingMin?: number;
  ratingMax?: number;
}

/** Narrows `entries` by the Statistics filter bar (Media Type, Genre,
 * Tag, Rating range). Exported so `subscriptionValueService.ts` can
 * apply the exact same filter semantics to Subscription Value's own
 * entry lists — see chat (Statistics page filters applying to
 * Subscription Value) — rather than reimplementing this logic. */
export function applyStatsFilters(
  entries: MediaEntry[],
  filters: StatsFilters | undefined,
): MediaEntry[] {
  if (!filters) return entries;
  let result = entries;
  if (filters.mediaTypeIds && filters.mediaTypeIds.length > 0) {
    const set = new Set(filters.mediaTypeIds);
    result = result.filter((e) => set.has(e.mediaType));
  }
  if (filters.genre) {
    result = result.filter((e) => (e.genres ?? []).includes(filters.genre!));
  }
  if (filters.tag) {
    result = result.filter((e) => (e.tags ?? []).includes(filters.tag!));
  }
  if (filters.ratingMin !== undefined || filters.ratingMax !== undefined) {
    const min = filters.ratingMin ?? 0;
    const max = filters.ratingMax ?? 10;
    result = result.filter(
      (e) => e.rating !== undefined && e.rating >= min && e.rating <= max,
    );
  }
  return result;
}

/** True when `dateStr` falls within `year`'s scope — a specific
 * calendar year (exact match against the date's own year, same as the
 * indexed `completedYear` field), `'last12'` (within the last 12
 * months of today), or `null`/undefined `dateStr` always fails (an
 * entry with no date can't be "within" any bounded scope). Shared by
 * `entriesForYear` below and by `subscriptionValueService.ts`, so both
 * apply identical time-scope rules. */
export function isWithinYearScope(
  dateStr: string | undefined,
  year: StatsYearScope,
): boolean {
  if (!dateStr) return false;
  if (year === null) return true;
  if (year === 'last12') {
    return dayjs(dateStr).isAfter(dayjs().subtract(12, 'month'));
  }
  return dayjs(dateStr).year() === year;
}

/** True when `dateStr` falls within the trailing 12-month window
 * ending at `endDate` (inclusive of `endDate`'s own day) — the same
 * "last 12 months" rule as `isWithinYearScope`'s `'last12'` case, just
 * anchored at an arbitrary point in the past instead of always today.
 * Used by the Subscriptions calculator's good-value history
 * (`getGoodValueHistory` in subscriptionValueService.ts) to score each
 * past month the exact same way Statistics scores "Last 12 months"
 * today — see chat, Sept 2026 (Subscriptions page redesign). */
export function isWithinRollingWindowEnding(
  dateStr: string | undefined,
  endDate: dayjs.Dayjs,
  months: number,
): boolean {
  if (!dateStr) return false;
  const d = dayjs(dateStr);
  return !d.isAfter(endDate) && d.isAfter(endDate.subtract(months, 'month'));
}

/** `year === null` means "All" (every completed entry, no year
 * filter) — a full-table scan rather than the indexed `completedYear`
 * lookup, which is fine at personal-library scale and keeps this one
 * function as the single place every statistic routes through
 * regardless of scope (see chat). `year === 'last12'` is also a
 * full-table scan, filtered down to the trailing 12 months via
 * `isWithinYearScope` — there's no index for a rolling window.
 * `filters` narrows further by Media Type/Genre/Tags/Rating
 * (Statistics filter bar) — applied after the year/status scoping,
 * same order as before this feature existed. */
async function entriesForYear(
  year: StatsYearScope,
  filters?: StatsFilters,
): Promise<MediaEntry[]> {
  let entries: MediaEntry[];
  if (typeof year === 'number') {
    entries = await db.mediaEntries.where('completedYear').equals(year).toArray();
  } else if (year === 'last12') {
    const all = await db.mediaEntries.toArray();
    entries = all.filter((entry) => isWithinYearScope(entry.completedDate, year));
  } else {
    entries = await db.mediaEntries.toArray();
  }
  const completedOnly = entries.filter(
    (entry) => !entry.status || entry.status === 'completed',
  );
  return applyStatsFilters(completedOnly, filters);
}

/** Reads the TV tracking mode from the database (not reactive — used
 * only inside statistics service functions which are already async). */
export async function getTvTrackingMode(): Promise<TvTrackingMode> {
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
export function getEntryWeight(entry: MediaEntry, tvMode: TvTrackingMode): number {
  if (entry.mediaType === 'comic') {
    const { issueStart, issueEnd } = entry.metadata;
    if (
      typeof issueStart !== 'number' ||
      typeof issueEnd !== 'number' ||
      issueEnd < issueStart
    ) {
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
  year: StatsYearScope;
  totalEntries: number;
  totalsByMediaType: Record<string, number>;
}

export async function getYearSummary(
  year: StatsYearScope,
  filters?: StatsFilters,
): Promise<YearSummary> {
  const [entries, tvMode] = await Promise.all([
    entriesForYear(year, filters),
    getTvTrackingMode(),
  ]);
  const totalsByMediaType: Record<string, number> = {};
  let totalEntries = 0;
  for (const entry of entries) {
    const weight = getEntryWeight(entry, tvMode);
    totalsByMediaType[entry.mediaType] =
      (totalsByMediaType[entry.mediaType] ?? 0) + weight;
    totalEntries += weight;
  }
  return { year, totalEntries, totalsByMediaType };
}

/** Entry counts for each calendar month (1–12) within `year`, weighted
 * by `getEntryWeight` so a multi-issue comic entry contributes its
 * full issue count rather than one. */
export async function getMonthlyBreakdown(
  year: StatsYearScope,
  filters?: StatsFilters,
): Promise<Record<number, number>> {
  const [entries, tvMode] = await Promise.all([
    entriesForYear(year, filters),
    getTvTrackingMode(),
  ]);
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
export async function getMediaTypeTotals(
  year: StatsYearScope,
  filters?: StatsFilters,
): Promise<Record<string, number>> {
  const summary = await getYearSummary(year, filters);
  return summary.totalsByMediaType;
}

/** Extracts `metadata.source` from an entry, or `undefined` if unset —
 * shared by all three Source-based statistics below so "no source set"
 * is handled identically everywhere. */
export function sourceOf(entry: MediaEntry): string | undefined {
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
export async function getTopSourcesByCount(
  year: StatsYearScope,
  filters?: StatsFilters,
): Promise<Record<string, Record<string, number>>> {
  const [entries, tvMode] = await Promise.all([
    entriesForYear(year, filters),
    getTvTrackingMode(),
  ]);
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
export async function getWishlistSourceTotals(): Promise<
  Record<string, Record<string, number>>
> {
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
export async function getAverageRatingBySource(
  year: StatsYearScope,
  filters?: StatsFilters,
): Promise<Record<string, Record<string, number>>> {
  const entries = (await entriesForYear(year, filters)).filter(
    (entry) => entry.rating !== undefined,
  );
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
      Object.entries(sources).map(([source, { total, count }]) => [
        source,
        total / count,
      ]),
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
export async function getTopGenresByCount(
  year: StatsYearScope,
  filters?: StatsFilters,
): Promise<Record<string, number>> {
  const [entries, tvMode] = await Promise.all([
    entriesForYear(year, filters),
    getTvTrackingMode(),
  ]);
  const totals: Record<string, number> = {};
  for (const entry of entries) {
    const weight = getEntryWeight(entry, tvMode);
    for (const genre of entry.genres ?? []) {
      totals[genre] = (totals[genre] ?? 0) + weight;
    }
  }
  return totals;
}

/** Completed-entry counts by person, grouped by role (Actor, Director,
 * Writer, etc. — see personRoles.ts), within `year`, weighted by
 * `getEntryWeight`. One pass over entries computes every role at once
 * rather than one query per role. Cast/crew fields are comma-separated
 * free text (TMDB/ComicVine convention); each name split out counts
 * individually, same "each thing it has gets the entry's full weight"
 * approach as `getTopGenresByCount` above — a film with 5 listed
 * actors gives each of them the film's full weight, not a 1/5 share. */
export async function getTopPeopleByRole(
  year: StatsYearScope,
  filters?: StatsFilters,
): Promise<Record<PersonRole, Record<string, number>>> {
  const [entries, tvMode] = await Promise.all([
    entriesForYear(year, filters),
    getTvTrackingMode(),
  ]);
  const totals = Object.fromEntries(
    (Object.keys(PERSON_ROLE_FIELDS) as PersonRole[]).map((role) => [
      role,
      {} as Record<string, number>,
    ]),
  ) as Record<PersonRole, Record<string, number>>;

  for (const entry of entries) {
    const weight = getEntryWeight(entry, tvMode);
    for (const role of Object.keys(PERSON_ROLE_FIELDS) as PersonRole[]) {
      for (const { mediaTypeId, fieldKey } of PERSON_ROLE_FIELDS[role]) {
        if (entry.mediaType !== mediaTypeId) continue;
        const raw = entry.metadata[fieldKey];
        if (typeof raw !== 'string' || !raw.trim()) continue;
        for (const name of splitPeople(raw)) {
          totals[role][name] = (totals[role][name] ?? 0) + weight;
        }
      }
    }
  }
  return totals;
}

/** Average rating per person, grouped by role — mirrors
 * `getAverageRatingBySource`'s approach: only rated entries count,
 * each contributing once (not weighted by `getEntryWeight` — a
 * multi-issue comic run is still one rating, same reasoning as the
 * module doc comment at the top of this file). Named next to
 * `getTopPeopleByRole` above since the two are always used together
 * (see chat, Aug 2026 — People section gained ratings alongside
 * Sources' existing rating-next-to-count treatment). */
export async function getAverageRatingByPersonRole(
  year: StatsYearScope,
  filters?: StatsFilters,
): Promise<Record<PersonRole, Record<string, number>>> {
  const entries = (await entriesForYear(year, filters)).filter(
    (entry) => entry.rating !== undefined,
  );
  const sums = Object.fromEntries(
    (Object.keys(PERSON_ROLE_FIELDS) as PersonRole[]).map((role) => [
      role,
      {} as Record<string, { total: number; count: number }>,
    ]),
  ) as Record<PersonRole, Record<string, { total: number; count: number }>>;

  for (const entry of entries) {
    for (const role of Object.keys(PERSON_ROLE_FIELDS) as PersonRole[]) {
      for (const { mediaTypeId, fieldKey } of PERSON_ROLE_FIELDS[role]) {
        if (entry.mediaType !== mediaTypeId) continue;
        const raw = entry.metadata[fieldKey];
        if (typeof raw !== 'string' || !raw.trim()) continue;
        for (const name of splitPeople(raw)) {
          const bucket = sums[role][name] ?? { total: 0, count: 0 };
          bucket.total += entry.rating ?? 0;
          bucket.count += 1;
          sums[role][name] = bucket;
        }
      }
    }
  }

  return Object.fromEntries(
    (Object.keys(sums) as PersonRole[]).map((role) => [
      role,
      Object.fromEntries(
        Object.entries(sums[role]).map(([name, { total, count }]) => [
          name,
          total / count,
        ]),
      ),
    ]),
  ) as Record<PersonRole, Record<string, number>>;
}

/** Average rating per Genre within `year`, ignoring unrated entries.
 * Flat, for the same reason as `getTopGenresByCount`. An entry with
 * multiple genres contributes its rating to each genre's average. */
export async function getAverageRatingByGenre(
  year: StatsYearScope,
  filters?: StatsFilters,
): Promise<Record<string, number>> {
  const entries = (await entriesForYear(year, filters)).filter(
    (entry) => entry.rating !== undefined,
  );
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
  year: StatsYearScope,
  filters?: StatsFilters,
): Promise<TopGenreShareByMediaType | null> {
  const [entries, tvMode] = await Promise.all([
    entriesForYear(year, filters),
    getTvTrackingMode(),
  ]);
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
  year: StatsYearScope,
  filters?: StatsFilters,
): Promise<Record<number, number>> {
  const entries = await entriesForYear(year, filters);
  const distribution: Record<number, number> = {};
  for (const entry of entries) {
    if (entry.rating === undefined) continue;
    distribution[entry.rating] = (distribution[entry.rating] ?? 0) + 1;
  }
  return distribution;
}

/** Average rating within `year`, ignoring unrated entries. `null` if
 * no rated entries exist. */
export async function getAverageRating(
  year: StatsYearScope,
  filters?: StatsFilters,
): Promise<number | null> {
  const entries = (await entriesForYear(year, filters)).filter(
    (entry) => entry.rating !== undefined,
  );
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, entry) => sum + (entry.rating ?? 0), 0);
  return total / entries.length;
}

/** Average rating per media type within `year`, ignoring unrated
 * entries and media types with no rated entries. */
export async function getAverageRatingByMediaType(
  year: StatsYearScope,
  filters?: StatsFilters,
): Promise<Record<string, number>> {
  const entries = (await entriesForYear(year, filters)).filter(
    (entry) => entry.rating !== undefined,
  );
  const sums: Record<string, { total: number; count: number }> = {};
  for (const entry of entries) {
    const bucket = sums[entry.mediaType] ?? { total: 0, count: 0 };
    bucket.total += entry.rating ?? 0;
    bucket.count += 1;
    sums[entry.mediaType] = bucket;
  }
  return Object.fromEntries(
    Object.entries(sums).map(([mediaType, { total, count }]) => [
      mediaType,
      total / count,
    ]),
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
export async function getWeeklyTotals(
  year: StatsYearScope,
  filters?: StatsFilters,
): Promise<Record<number, number>> {
  const [entries, tvMode] = await Promise.all([
    entriesForYear(year, filters),
    getTvTrackingMode(),
  ]);
  const totals: Record<number, number> = {};
  for (const entry of entries) {
    const date = new Date(entry.completedDate ?? '');
    const startOfYear = new Date(Date.UTC(date.getFullYear(), 0, 1));
    const dayOfYear =
      Math.floor((date.getTime() - startOfYear.getTime()) / 86_400_000) + 1;
    const week = Math.min(53, Math.max(1, Math.ceil(dayOfYear / 7)));
    totals[week] = (totals[week] ?? 0) + getEntryWeight(entry, tvMode);
  }
  return totals;
}

/** The media type with the most entries within `year`, or `null` if
 * the year has no entries. */
export async function getFavouriteMediaType(
  year: StatsYearScope,
  filters?: StatsFilters,
): Promise<string | null> {
  const totals = await getMediaTypeTotals(year, filters);
  const entries = Object.entries(totals);
  if (entries.length === 0) return null;
  return entries.reduce((best, current) => (current[1] > best[1] ? current : best))[0];
}

/** The calendar month (1–12) with the most completions within `year`,
 * or `null` if the year has no entries. */
export async function getMostActiveMonth(
  year: StatsYearScope,
  filters?: StatsFilters,
): Promise<number | null> {
  const breakdown = await getMonthlyBreakdown(year, filters);
  const entries = Object.entries(breakdown).filter(([, count]) => count > 0);
  if (entries.length === 0) return null;
  return Number(
    entries.reduce((best, current) => (current[1] > best[1] ? current : best))[0],
  );
}

/** Minimum rated-entry count a Source needs before it's eligible to
 * be crowned "Favourite source" — mirrors Subscription Value's own
 * MIN_WATCHES_FOR_RANKING threshold (see subscriptionValueService.ts),
 * so a single 10/10 entry can't outrank a source with real, sustained
 * use. Chosen in chat to match that existing precedent. */
const MIN_ENTRIES_FOR_FAVOURITE_SOURCE = 3;

/** The Source with the highest average rating within `year`, across
 * every media type combined — unlike `getAverageRatingBySource`,
 * which groups by media type, this flattens across types since
 * "favourite source" is a single headline stat, not a per-type
 * breakdown. Only Sources with at least
 * `MIN_ENTRIES_FOR_FAVOURITE_SOURCE` rated entries are eligible;
 * returns `null` if none clear that bar (including when there are no
 * rated, sourced entries at all). */
export async function getFavouriteSource(
  year: StatsYearScope,
  filters?: StatsFilters,
): Promise<string | null> {
  const entries = (await entriesForYear(year, filters)).filter(
    (entry) => entry.rating !== undefined,
  );
  const sums: Record<string, { total: number; count: number }> = {};
  for (const entry of entries) {
    const source = sourceOf(entry);
    if (!source) continue;
    const bucket = sums[source] ?? { total: 0, count: 0 };
    bucket.total += entry.rating ?? 0;
    bucket.count += 1;
    sums[source] = bucket;
  }
  const eligible = Object.entries(sums).filter(
    ([, bucket]) => bucket.count >= MIN_ENTRIES_FOR_FAVOURITE_SOURCE,
  );
  if (eligible.length === 0) return null;
  const best = eligible.reduce((best, current) =>
    current[1].total / current[1].count > best[1].total / best[1].count ? current : best,
  );
  return best[0];
}

/** The day of the week (0 = Sunday … 6 = Saturday) with the most
 * completions within `year`, or `null` if the year has no entries.
 * Deliberately counts records, not `getEntryWeight` — this is about
 * which day you tend to log entries, not how much volume you got
 * through, so a single six-issue comic shouldn't outweigh six
 * separate days of reading. */
export async function getMostActiveWeekday(
  year: StatsYearScope,
  filters?: StatsFilters,
): Promise<number | null> {
  const entries = await entriesForYear(year, filters);
  if (entries.length === 0) return null;
  const totals: Record<number, number> = {};
  for (const entry of entries) {
    const day = new Date(entry.completedDate ?? '').getDay();
    totals[day] = (totals[day] ?? 0) + 1;
  }
  return Number(
    Object.entries(totals).reduce((best, current) =>
      current[1] > best[1] ? current : best,
    )[0],
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
  const distinctDays = Array.from(new Set(entries.map((entry) => entry.completedDate)))
    .sort()
    .reverse();

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
  year: StatsYearScope,
  limit: number,
  filters?: StatsFilters,
): Promise<MediaEntry[]> {
  const entries = (await entriesForYear(year, filters))
    .filter((entry) => entry.rating !== undefined)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  return entries.slice(0, limit);
}

/**
 * Longest run of consecutive calendar days with at least one
 * completion within `year`. Multiple entries on the same day count
 * once; the streak resets on any gap of a full day or more.
 */
export async function getLongestStreak(
  year: StatsYearScope,
  filters?: StatsFilters,
): Promise<number> {
  const entries = await entriesForYear(year, filters);
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

/** The book with the highest `metadata.pageCount` within `year`, or
 * `null` if no completed book entry has a page count set. Restricted
 * to `mediaType === 'book'` — Audiobooks share the same metadata
 * schema (so `pageCount` is technically present there too, inherited
 * from `bookMetadataSchema`) but a runtime, not a page count, is the
 * meaningful "length" for an audiobook, so they're excluded here to
 * avoid a misleading comparison. See chat, Sept 2026 — the field was
 * added via the Google Books integration (DB v29) specifically to
 * unlock this stat. */
export async function getLongestBook(
  year: StatsYearScope,
  filters?: StatsFilters,
): Promise<{ title: string; pageCount: number } | null> {
  const entries = await entriesForYear(year, filters);
  let longest: { title: string; pageCount: number } | null = null;
  for (const entry of entries) {
    if (entry.mediaType !== 'book') continue;
    const pageCount = entry.metadata.pageCount;
    if (typeof pageCount !== 'number' || pageCount <= 0) continue;
    if (!longest || pageCount > longest.pageCount) {
      longest = { title: entry.title, pageCount };
    }
  }
  return longest;
}

export interface RollingMonthDatum {
  year: number;
  /** 1–12, calendar month. */
  month: number;
  /** Short display label, e.g. "Sep '25" — needed because a rolling
   * window spans two calendar years, so month number alone ("Sep")
   * would be ambiguous between this September and last. */
  label: string;
  count: number;
}

/**
 * Entries per calendar month across the trailing 12 months, ending
 * with the current month — e.g. run in September 2026, this returns
 * Sep '25 through Sep '26 in that chronological order. Replaces the
 * old `getMonthlyTrend` stub and the Dashboard/Statistics Monthly
 * tab's previous single-calendar-year `getMonthlyBreakdown` usage —
 * see chat, Sept 2026: David wanted the moving-average trend line
 * removed and the chart itself to always show a rolling 12 months
 * instead of a fixed calendar year, in both places that share this
 * chart component.
 *
 * Deliberately ignores any year selector on the calling page — this
 * is always "now minus 11 months through now", recomputed fresh on
 * every call (no caching), which is what makes it "roll" day to day
 * without any extra scheduling logic: call it again tomorrow, or in
 * October, and the window has moved because `dayjs()` has.
 */
export async function getRollingMonthlyBreakdown(
  filters?: StatsFilters,
): Promise<RollingMonthDatum[]> {
  const windowStart = dayjs().subtract(11, 'month').startOf('month');
  const [allEntries, tvMode] = await Promise.all([
    db.mediaEntries.toArray(),
    getTvTrackingMode(),
  ]);
  const completedOnly = allEntries.filter((e) => !e.status || e.status === 'completed');
  const inWindow = completedOnly.filter((e) => {
    if (!e.completedDate) return false;
    const d = dayjs(e.completedDate);
    return !d.isBefore(windowStart) && !d.isAfter(dayjs());
  });
  const filtered = applyStatsFilters(inWindow, filters);

  const months: RollingMonthDatum[] = Array.from({ length: 12 }, (_, i) => {
    const d = windowStart.add(i, 'month');
    return { year: d.year(), month: d.month() + 1, label: d.format("MMM 'YY"), count: 0 };
  });
  const byKey = new Map(months.map((m) => [`${m.year}-${m.month}`, m]));

  for (const entry of filtered) {
    const d = dayjs(entry.completedDate);
    const key = `${d.year()}-${d.month() + 1}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.count += getEntryWeight(entry, tvMode);
  }

  return months;
}

/** Total re-read / re-watched entries within `year`. */
export async function getRepeatConsumption(
  year: StatsYearScope,
  filters?: StatsFilters,
): Promise<number> {
  const entries = await entriesForYear(year, filters);
  return entries.filter((entry) => entry.repeatConsumption).length;
}

/**
 * Short, dynamically-generated observations about `year`'s
 * consumption, per UI & UX Specification section 8 (e.g. "You
 * consumed 38% more books than last year", "Friday is your most
 * active completion day"). Returns an empty array for a year with no
 * entries rather than guessing.
 *
 * `year === null` (All) and `year === 'last12'` (Last 12 months) both
 * rework the "this year" phrasing (to "overall" and "in the last 12
 * months" respectively) and drop the year-over-year comparison
 * entirely — there's no previous-period baseline to compare against
 * for either (a rolling window has no fixed "last 12 months before
 * that" without extra scoping decisions — left out for now, see
 * chat).
 */
export async function getInsights(
  year: StatsYearScope,
  filters?: StatsFilters,
): Promise<string[]> {
  const [totals, previousTotals, favourite, weekday, repeats, topGenre, longestBook] =
    await Promise.all([
      getMediaTypeTotals(year, filters),
      typeof year === 'number'
        ? getMediaTypeTotals(year - 1, filters)
        : Promise.resolve({} as Record<string, number>),
      getFavouriteMediaType(year, filters),
      getMostActiveWeekday(year, filters),
      getRepeatConsumption(year, filters),
      getTopGenreShareByMediaType(year, filters),
      getLongestBook(year, filters),
    ]);

  const totalEntries = Object.values(totals).reduce((sum, count) => sum + count, 0);
  if (totalEntries === 0) return [];

  const insights: string[] = [];
  const WEEKDAY_NAMES = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const scope =
    year === null ? 'overall' : year === 'last12' ? 'in the last 12 months' : 'this year';
  const daySuffix =
    year === null ? ' overall' : year === 'last12' ? ' in the last 12 months' : '';
  const revisitedSuffix =
    year === null
      ? 'in total'
      : year === 'last12'
        ? 'in the last 12 months'
        : 'this year';

  if (favourite && totals[favourite] !== undefined) {
    const share = Math.round((totals[favourite] / totalEntries) * 100);
    insights.push(`${favourite} entries account for ${share}% of your media ${scope}.`);
  }

  if (topGenre) {
    insights.push(
      `${topGenre.genre} is your favourite genre ${scope}, making up ${topGenre.overallPercentage}% of what you completed.`,
    );
  }

  if (longestBook) {
    insights.push(
      `Your longest book ${scope} was "${longestBook.title}" at ${longestBook.pageCount} pages.`,
    );
  }

  if (weekday !== null && WEEKDAY_NAMES[weekday]) {
    insights.push(
      `${WEEKDAY_NAMES[weekday]} is your most active completion day${daySuffix}.`,
    );
  }

  if (typeof year === 'number') {
    for (const [mediaType, count] of Object.entries(totals)) {
      const previousCount = previousTotals[mediaType] ?? 0;
      if (previousCount === 0 || count === previousCount) continue;
      const change = Math.round(((count - previousCount) / previousCount) * 100);
      if (Math.abs(change) < 10) continue;
      const direction = change > 0 ? 'more' : 'fewer';
      insights.push(
        `You consumed ${Math.abs(change)}% ${direction} ${mediaType} than last year.`,
      );
    }
  }

  if (repeats > 0) {
    insights.push(
      `You revisited ${repeats} ${repeats === 1 ? 'entry' : 'entries'} ${revisitedSuffix}.`,
    );
  }

  return insights;
}
