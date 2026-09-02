import dayjs from 'dayjs';
import { db } from '@/services/database/db';
import {
  getEntryWeight,
  getTvTrackingMode,
  sourceOf,
  applyStatsFilters,
  isWithinYearScope,
  isWithinRollingWindowEnding,
  type StatsFilters,
  type StatsYearScope,
} from '@/services/statistics/statisticsService';
import {
  getSubscriptionSourceConfig,
  isSubscriptionSource,
} from '@/services/subscriptions/subscriptionSourcesService';

/** Minimum weighted watch count a source needs before it's allowed to
 * rank on its score alone — see `belowThreshold` below. Chosen in
 * chat: a single 10/10 watch shouldn't be able to outrank a service
 * with real, sustained usage. */
const MIN_WATCHES_FOR_RANKING = 3;

/** Blend weights for `score` — usage volume counts for more than
 * rating, since a service you rarely open isn't "valuable" just
 * because the one thing you watched there happened to be great.
 * Chosen in chat. */
const USAGE_WEIGHT = 0.6;
const RATING_WEIGHT = 0.4;

export interface SubscriptionValueGroup {
  title: string;
  colour: string;
  mediaTypeIds: string[];
}

/** The five Subscription Value groupings shown on the Statistics
 * page's Sources section — shared with `getFavouriteSubscription`
 * below so the "Favourite Subscription" Overview stat and the cards
 * themselves can never drift out of sync with each other. */
export const SUBSCRIPTION_VALUE_GROUPS: SubscriptionValueGroup[] = [
  { title: 'Film, TV & Anime', colour: '#388E3C', mediaTypeIds: ['film', 'tv', 'anime'] },
  { title: 'Comics & Manga', colour: '#C62828', mediaTypeIds: ['comic', 'manga'] },
  { title: 'Reading sources', colour: '#1976D2', mediaTypeIds: ['book'] },
  { title: 'Audiobooks', colour: '#7B1FA2', mediaTypeIds: ['audiobook'] },
  { title: 'Podcasts', colour: '#5D4037', mediaTypeIds: ['podcast'] },
];

/** Intersects a Subscription Value group's own media types with the
 * Statistics filter bar's Media Type filter, if one is set — e.g.
 * "Film, TV & Anime" narrows to just `['film']` when the page is
 * filtered down to Film only. No filter (empty/undefined) means no
 * restriction, so the group's full media type list passes through
 * unchanged. An empty result means none of the group's media types
 * are in the current filter — the caller should skip that group
 * entirely rather than call `getSubscriptionValue` with an empty
 * list. See chat (Statistics page filters applying to Subscription
 * Value). */
export function effectiveGroupMediaTypeIds(
  group: SubscriptionValueGroup,
  filterMediaTypeIds: string[] | undefined,
): string[] {
  if (!filterMediaTypeIds || filterMediaTypeIds.length === 0) return group.mediaTypeIds;
  const filterSet = new Set(filterMediaTypeIds);
  return group.mediaTypeIds.filter((id) => filterSet.has(id));
}

export interface SubscriptionValueTopTitle {
  title: string;
  rating: number;
}

export interface SubscriptionValueRow {
  source: string;
  /** Weighted count of Completed entries on this source within the
   * selected year scope (same weighting as the rest of Statistics —
   * a multi-episode TV entry in "episode" tracking mode counts its
   * full episode span, same as Sources elsewhere on this page). */
  watchedCount: number;
  /** Average rating of rated Completed entries on this source within
   * the year scope, or `null` if none of them were rated. */
  avgRating: number | null;
  /** Count of Wishlist + In Progress entries on this source —
   * deliberately not scoped by `year`, same reasoning as
   * `getWishlistSourceTotals`: a backlog is a current-state question,
   * not a "within this time scope" one. Still narrowed by the
   * Genre/Tag/Rating/Media Type filter bar, same as everything else
   * on the page. */
  queuedCount: number;
  /** 0–100 blended score — see `USAGE_WEIGHT`/`RATING_WEIGHT`. */
  score: number;
  /** True when `watchedCount` is below `MIN_WATCHES_FOR_RANKING` —
   * the row still renders with its real score and data, it's just
   * sorted after every row that clears the floor, so a single
   * highly-rated watch can't out-rank a service with real usage. */
  belowThreshold: boolean;
  topTitles: SubscriptionValueTopTitle[];
}

export interface SubscriptionValueResult {
  rows: SubscriptionValueRow[];
  /** Count of Completed entries within the year scope, among the
   * given media types, that have a Source set but aren't marked as a
   * subscription (or aren't marked at all) — surfaced so the UI can
   * point people at Settings > Subscriptions rather than silently
   * dropping data. */
  excludedCount: number;
}

/** Computes the Subscription Value ranking for one group of media
 * types (e.g. Film+TV+Anime, or Podcasts alone) within the Statistics
 * page's `year` scope (a specific calendar year, `'last12'` for a
 * rolling 12-month window, or `null` for All) and filter bar
 * (`filters`) — see chat (Statistics page filters applying to
 * Subscription Value). Callers pass the *effective* `mediaTypeIds`
 * for a group — see `effectiveGroupMediaTypeIds` — not necessarily
 * the group's full list, so a Media Type filter narrows which of a
 * group's types are even queried. See SubscriptionValueRow for what
 * each field means and why. */
export async function getSubscriptionValue(
  mediaTypeIds: string[],
  year: StatsYearScope,
  filters?: StatsFilters,
): Promise<SubscriptionValueResult> {
  const [rawEntries, tvMode, subsConfig] = await Promise.all([
    db.mediaEntries.where('mediaType').anyOf(mediaTypeIds).toArray(),
    getTvTrackingMode(),
    getSubscriptionSourceConfig(),
  ]);

  // Genre/Tag/Rating (and Media Type, redundantly with the query
  // above) narrow both watched and queued entries below; `year` only
  // narrows watched (Completed) entries — see queuedCount's doc
  // comment for why the backlog stays unscoped by time.
  const allEntries = applyStatsFilters(rawEntries, filters);

  const isSub = (source: string) => isSubscriptionSource(subsConfig, source);

  const watched = new Map<
    string,
    { count: number; ratingTotal: number; ratingCount: number }
  >();
  const topTitlesBySource = new Map<string, SubscriptionValueTopTitle[]>();
  const queued = new Map<string, number>();
  let excludedCount = 0;

  for (const entry of allEntries) {
    const source = sourceOf(entry);

    if (!entry.status || entry.status === 'completed') {
      if (!isWithinYearScope(entry.completedDate, year)) continue;
      if (!source) continue;
      if (!isSub(source)) {
        excludedCount += 1;
        continue;
      }
      const weight = getEntryWeight(entry, tvMode);
      const bucket = watched.get(source) ?? { count: 0, ratingTotal: 0, ratingCount: 0 };
      bucket.count += weight;
      if (entry.rating !== undefined) {
        bucket.ratingTotal += entry.rating;
        bucket.ratingCount += 1;
      }
      watched.set(source, bucket);

      if (entry.rating !== undefined) {
        const list = topTitlesBySource.get(source) ?? [];
        list.push({ title: entry.title, rating: entry.rating });
        topTitlesBySource.set(source, list);
      }
    } else if (entry.status === 'in_progress' || entry.status === 'wishlist') {
      if (!source || !isSub(source)) continue;
      queued.set(source, (queued.get(source) ?? 0) + 1);
    }
  }

  const sources = new Set([...watched.keys(), ...queued.keys()]);
  const maxCount = Math.max(0, ...Array.from(watched.values()).map((b) => b.count));

  const rows: SubscriptionValueRow[] = Array.from(sources).map((source) => {
    const bucket = watched.get(source);
    const watchedCount = bucket?.count ?? 0;
    const avgRating =
      bucket && bucket.ratingCount > 0 ? bucket.ratingTotal / bucket.ratingCount : null;
    const usageScore = maxCount > 0 ? (watchedCount / maxCount) * 100 : 0;
    const ratingScore = avgRating !== null ? (avgRating / 10) * 100 : 0;
    const score = Math.round(USAGE_WEIGHT * usageScore + RATING_WEIGHT * ratingScore);
    const topTitles = (topTitlesBySource.get(source) ?? [])
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3);

    return {
      source,
      watchedCount,
      avgRating,
      queuedCount: queued.get(source) ?? 0,
      score,
      belowThreshold: watchedCount < MIN_WATCHES_FOR_RANKING,
      topTitles,
    };
  });

  rows.sort((a, b) => {
    if (a.belowThreshold !== b.belowThreshold) return a.belowThreshold ? 1 : -1;
    return b.score - a.score;
  });

  return { rows, excludedCount };
}

/**
 * The single highest-scoring source across every Subscription Value
 * group (`SUBSCRIPTION_VALUE_GROUPS`) within the given `year` scope
 * and filter bar — the "Favourite Subscription" Overview stat. Groups
 * with no media types left after the Media Type filter (see
 * `effectiveGroupMediaTypeIds`) are skipped entirely, same as the
 * cards themselves. Rows below `MIN_WATCHES_FOR_RANKING` are excluded
 * from consideration, same as each individual card's own ranking.
 * Returns `null` if no source across any group clears that bar.
 */
export async function getFavouriteSubscription(
  year: StatsYearScope,
  filters?: StatsFilters,
): Promise<string | null> {
  const results = await Promise.all(
    SUBSCRIPTION_VALUE_GROUPS.map((group) => {
      const ids = effectiveGroupMediaTypeIds(group, filters?.mediaTypeIds);
      if (ids.length === 0) {
        return Promise.resolve<SubscriptionValueResult>({ rows: [], excludedCount: 0 });
      }
      return getSubscriptionValue(ids, year, filters);
    }),
  );

  const eligible = results
    .flatMap((result) => result.rows)
    .filter((row) => !row.belowThreshold);

  if (eligible.length === 0) return null;

  return eligible.reduce((best, current) => (current.score > best.score ? current : best))
    .source;
}

/** A source's "good value" score, at or above which the Subscriptions
 * calculator considers it worth what's being paid — same bar as the
 * `Good` label used everywhere else (`score >= 60`), so a source's
 * good-value history and its live chip can never disagree. */
const GOOD_VALUE_SCORE_THRESHOLD = 60;

/** How many months of history `getGoodValueHistory` will scan back,
 * regardless of how long a source has actually been logged for — five
 * years of monthly rolling-window recomputation already answers "when
 * did this last qualify" for any practical purpose, and an unbounded
 * scan would get slower with every year a library keeps growing. */
const MAX_GOOD_VALUE_MONTHS_TO_SCAN = 60;

export interface GoodValueStatus {
  /** `'current'` — good value right now; `month` is the first month
   * ('YYYY-MM') of the unbroken streak leading up to today (may equal
   * the current month). `'past'` — was good value before but isn't
   * now; `month` is the last month it was. `'never'` — hasn't cleared
   * the bar for any trailing-12-month window in the scanned history. */
  state: 'current' | 'past' | 'never';
  month: string | null;
}

/**
 * For every source flagged as a subscription, finds the most recent
 * month whose *trailing 12-month* score (ending that month, same
 * formula as `getSubscriptionValue`) cleared `GOOD_VALUE_SCORE_THRESHOLD`
 * — "the last month this service qualified as good value" (see chat,
 * Sept 2026, Subscriptions page redesign). Deliberately scores each
 * past month against a rolling year rather than that single month's
 * own (usually sparse) activity — confirmed in chat as the less noisy
 * definition — reusing the exact `isWithinRollingWindowEnding` rule
 * Statistics already uses for "Last 12 months", just anchored at each
 * month in the past instead of always today.
 *
 * Always scored across every enabled media type (mirrors
 * `getSubscriptionCostSummary`'s cross-media aggregation, not a single
 * Statistics group) and independent of the Subscriptions page's own
 * time-scope selector — "when did this last qualify" is a fixed
 * historical fact, not something that should change depending on what
 * window you happen to be viewing.
 */
export async function getGoodValueHistory(
  mediaTypeIds: string[],
): Promise<Map<string, GoodValueStatus>> {
  const [rawEntries, tvMode, subsConfig] = await Promise.all([
    db.mediaEntries.where('mediaType').anyOf(mediaTypeIds).toArray(),
    getTvTrackingMode(),
    getSubscriptionSourceConfig(),
  ]);

  const isSub = (source: string) => isSubscriptionSource(subsConfig, source);
  const completed = rawEntries.filter(
    (entry) => (!entry.status || entry.status === 'completed') && entry.completedDate,
  );

  const sources = new Set<string>();
  let earliest: dayjs.Dayjs | null = null;
  for (const entry of completed) {
    const source = sourceOf(entry);
    if (!source || !isSub(source)) continue;
    sources.add(source);
    const completedAt = dayjs(entry.completedDate);
    if (!earliest || completedAt.isBefore(earliest)) earliest = completedAt;
  }

  const result = new Map<string, GoodValueStatus>();
  if (sources.size === 0 || !earliest) return result;

  const now = dayjs();
  const monthsBack = Math.min(
    MAX_GOOD_VALUE_MONTHS_TO_SCAN,
    Math.max(0, now.diff(earliest, 'month')),
  );

  // index 0 = the current month, index i = i months before that —
  // whether each source cleared the good-value bar for the trailing
  // 12 months ending in that month.
  const monthlyGood = new Map<string, boolean[]>();
  for (const source of sources) monthlyGood.set(source, []);

  for (let i = 0; i <= monthsBack; i++) {
    const monthEnd = now.subtract(i, 'month').endOf('month');
    const windowEntries = completed.filter((entry) =>
      isWithinRollingWindowEnding(entry.completedDate, monthEnd, 12),
    );

    const bucket = new Map<
      string,
      { count: number; ratingTotal: number; ratingCount: number }
    >();
    for (const entry of windowEntries) {
      const source = sourceOf(entry);
      if (!source || !isSub(source)) continue;
      const weight = getEntryWeight(entry, tvMode);
      const b = bucket.get(source) ?? { count: 0, ratingTotal: 0, ratingCount: 0 };
      b.count += weight;
      if (entry.rating !== undefined) {
        b.ratingTotal += entry.rating;
        b.ratingCount += 1;
      }
      bucket.set(source, b);
    }

    const maxCount = Math.max(0, ...Array.from(bucket.values()).map((b) => b.count));

    for (const source of sources) {
      const b = bucket.get(source);
      const count = b?.count ?? 0;
      const avgRating = b && b.ratingCount > 0 ? b.ratingTotal / b.ratingCount : null;
      const usageScore = maxCount > 0 ? (count / maxCount) * 100 : 0;
      const ratingScore = avgRating !== null ? (avgRating / 10) * 100 : 0;
      const score = Math.round(USAGE_WEIGHT * usageScore + RATING_WEIGHT * ratingScore);
      const isGood =
        count >= MIN_WATCHES_FOR_RANKING && score >= GOOD_VALUE_SCORE_THRESHOLD;
      monthlyGood.get(source)!.push(isGood);
    }
  }

  for (const source of sources) {
    const monthFlags = monthlyGood.get(source)!;
    const lastGoodIndex = monthFlags.findIndex(Boolean);

    if (lastGoodIndex === -1) {
      result.set(source, { state: 'never', month: null });
      continue;
    }

    if (lastGoodIndex === 0) {
      // Still good now — walk back to find where the unbroken streak
      // started, so the UI can say "every month since <streakStart>"
      // rather than just "good this month".
      let streakEnd = 0;
      while (streakEnd + 1 < monthFlags.length && monthFlags[streakEnd + 1]) streakEnd++;
      result.set(source, {
        state: 'current',
        month: now.subtract(streakEnd, 'month').format('YYYY-MM'),
      });
    } else {
      result.set(source, {
        state: 'past',
        month: now.subtract(lastGoodIndex, 'month').format('YYYY-MM'),
      });
    }
  }

  return result;
}
