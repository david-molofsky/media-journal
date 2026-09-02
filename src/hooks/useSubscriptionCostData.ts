import { useLiveQuery } from 'dexie-react-hooks';
import {
  getSubscriptionCostSummary,
  type SubscriptionCostSummary,
} from '@/services/subscriptions/subscriptionCostService';
import type { StatsYearScope } from '@/services/statistics/statisticsService';

/** Reactive Subscriptions calculator dataset — recomputes whenever
 * entries, the subscription-source config, region, tier/billing
 * selections, or price overrides change (any Dexie write touching
 * those tables), or `year` itself changes. `year` only rescopes
 * usage/rating/score/top-titles (see `getSubscriptionCostSummary`'s
 * doc comment) — queued count, price and spend always reflect
 * current-state regardless of scope, same as before this page had a
 * time-scope selector. Defaults to `'last12'`, matching the page's
 * prior always-rolling-12-months behaviour. */
export function useSubscriptionCostData(
  year: StatsYearScope = 'last12',
): SubscriptionCostSummary | undefined {
  return useLiveQuery(() => getSubscriptionCostSummary(year), [year]);
}
