import { useLiveQuery } from 'dexie-react-hooks';
import {
  getSubscriptionValue,
  type SubscriptionValueResult,
} from '@/services/statistics/subscriptionValueService';
import type { StatsFilters, StatsYearScope } from '@/services/statistics/statisticsService';

/** Reactive Subscription Value ranking for one group of media types,
 * scoped by the Statistics page's `year` selector and filter bar —
 * see subscriptionValueService.ts for what each field means. Each
 * card no longer has its own independent time window; the page-level
 * `year` is the only time control (see chat, Statistics page filters
 * applying to Subscription Value). */
export function useSubscriptionValue(
  mediaTypeIds: string[],
  year: StatsYearScope,
  filters?: StatsFilters,
): SubscriptionValueResult | undefined {
  return useLiveQuery(
    () => getSubscriptionValue(mediaTypeIds, year, filters),
    [JSON.stringify(mediaTypeIds), year, JSON.stringify(filters)],
  );
}
