import { useLiveQuery } from 'dexie-react-hooks';
import { getFavouriteSubscription } from '@/services/statistics/subscriptionValueService';

/** Matches each SubscriptionValueCard's own `defaultWindowMonths`, so
 * the Overview stat and the cards it summarises start out looking at
 * the same window. */
const DEFAULT_WINDOW_MONTHS = 12;

/** Reactive "Favourite Subscription" Overview stat — the
 * highest-scoring source across all Subscription Value groups. Not
 * tied to the Statistics page's year selector or filter bar, same as
 * the Subscription Value cards themselves — see chat (Statistics page
 * redesign) and subscriptionValueService.ts. */
export function useFavouriteSubscription(): string | null | undefined {
  return useLiveQuery(() => getFavouriteSubscription(DEFAULT_WINDOW_MONTHS), []);
}
