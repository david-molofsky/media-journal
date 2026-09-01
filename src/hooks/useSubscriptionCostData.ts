import { useLiveQuery } from 'dexie-react-hooks';
import { getSubscriptionCostSummary, type SubscriptionCostSummary } from '@/services/subscriptions/subscriptionCostService';

/** Reactive Subscriptions calculator dataset — recomputes whenever
 * entries, the subscription-source config, region, tier selections,
 * or price overrides change (any Dexie write touching those tables).
 * Deliberately no year/filter params, unlike Statistics' equivalent
 * hook — the calculator is always a rolling-12-month, unfiltered view
 * of what's currently being paid for, not something to slice by year
 * or genre. */
export function useSubscriptionCostData(): SubscriptionCostSummary | undefined {
  return useLiveQuery(() => getSubscriptionCostSummary(), []);
}
