import { useLiveQuery } from 'dexie-react-hooks';
import { getFavouriteSubscription } from '@/services/statistics/subscriptionValueService';
import type { StatsFilters, StatsYearScope } from '@/services/statistics/statisticsService';

/** Reactive "Favourite Subscription" Overview stat — the
 * highest-scoring source across all Subscription Value groups, scoped
 * by the Statistics page's `year` selector and filter bar, same as
 * every other stat on the page — see chat (Statistics page filters
 * applying to Subscription Value) and subscriptionValueService.ts. */
export function useFavouriteSubscription(
  year: StatsYearScope,
  filters?: StatsFilters,
): string | null | undefined {
  return useLiveQuery(
    () => getFavouriteSubscription(year, filters),
    [year, JSON.stringify(filters)],
  );
}
