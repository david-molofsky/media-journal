import dayjs from 'dayjs';
import { db } from '@/services/database/db';
import {
  getEntryWeight,
  getTvTrackingMode,
  sourceOf,
} from '@/services/statistics/statisticsService';
import {
  getSubscriptionSourceConfig,
  isSubscriptionSource,
} from '@/services/subscriptions/subscriptionSourcesService';
import type { MediaEntry } from '@/models';

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

/** The four Subscription Value groupings shown on the Statistics
 * page's Sources section — shared with `getFavouriteSubscription`
 * below so the "Favourite Subscription" Overview stat and the cards
 * themselves can never drift out of sync with each other. */
export const SUBSCRIPTION_VALUE_GROUPS: SubscriptionValueGroup[] = [
  { title: 'Film, TV & Anime', colour: '#388E3C', mediaTypeIds: ['film', 'tv', 'anime'] },
  { title: 'Podcasts', colour: '#5D4037', mediaTypeIds: ['podcast'] },
  { title: 'Audiobooks', colour: '#7B1FA2', mediaTypeIds: ['audiobook'] },
  { title: 'Reading sources', colour: '#1976D2', mediaTypeIds: ['book'] },
];

export interface SubscriptionValueTopTitle {
  title: string;
  rating: number;
}

export interface SubscriptionValueRow {
  source: string;
  /** Weighted count of Completed entries on this source within the
   * selected window (same weighting as the rest of Statistics — a
   * multi-episode TV entry in "episode" tracking mode counts its full
   * episode span, same as Sources elsewhere on this page). */
  watchedCount: number;
  /** Average rating of rated Completed entries on this source within
   * the window, or `null` if none of them were rated. */
  avgRating: number | null;
  /** Count of Wishlist + In Progress entries on this source —
   * deliberately not window-scoped, same reasoning as
   * `getWishlistSourceTotals`: a backlog is a current-state question,
   * not a "how much happened in the last N months" one. */
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
  /** Count of Completed entries within the window, among the given
   * media types, that have a Source set but aren't marked as a
   * subscription (or aren't marked at all) — surfaced so the UI can
   * point people at Settings > Subscriptions rather than silently
   * dropping data. */
  excludedCount: number;
}

/** Computes the Subscription Value ranking for one group of media
 * types (e.g. Film+TV+Anime, or Podcasts alone) over a rolling
 * `windowMonths`-month window ending today. See SubscriptionValueRow
 * for what each field means and why. */
export async function getSubscriptionValue(
  mediaTypeIds: string[],
  windowMonths: number,
): Promise<SubscriptionValueResult> {
  const [allEntries, tvMode, subsConfig] = await Promise.all([
    db.mediaEntries.where('mediaType').anyOf(mediaTypeIds).toArray(),
    getTvTrackingMode(),
    getSubscriptionSourceConfig(),
  ]);

  const windowStart = dayjs().subtract(windowMonths, 'month');
  const isSub = (entry: MediaEntry, source: string) =>
    isSubscriptionSource(subsConfig, entry.mediaType, source);

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
      if (!entry.completedDate || !dayjs(entry.completedDate).isAfter(windowStart))
        continue;
      if (!source) continue;
      if (!isSub(entry, source)) {
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
      if (!source || !isSub(entry, source)) continue;
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
 * group (`SUBSCRIPTION_VALUE_GROUPS`) over a rolling `windowMonths`
 * window — the "Favourite Subscription" Overview stat. Rows below
 * `MIN_WATCHES_FOR_RANKING` are excluded from consideration, same as
 * each individual card's own ranking. Returns `null` if no source
 * across any group clears that bar.
 */
export async function getFavouriteSubscription(
  windowMonths: number,
): Promise<string | null> {
  const results = await Promise.all(
    SUBSCRIPTION_VALUE_GROUPS.map((group) =>
      getSubscriptionValue(group.mediaTypeIds, windowMonths),
    ),
  );

  const eligible = results
    .flatMap((result) => result.rows)
    .filter((row) => !row.belowThreshold);

  if (eligible.length === 0) return null;

  return eligible.reduce((best, current) => (current.score > best.score ? current : best))
    .source;
}
