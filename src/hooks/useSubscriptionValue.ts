import { useLiveQuery } from 'dexie-react-hooks';
import {
  getSubscriptionValue,
  type SubscriptionValueResult,
} from '@/services/statistics/subscriptionValueService';

/** Reactive Subscription Value ranking for one group of media types
 * over a rolling `windowMonths`-month window — see
 * subscriptionValueService.ts for what each field means. */
export function useSubscriptionValue(
  mediaTypeIds: string[],
  windowMonths: number,
): SubscriptionValueResult | undefined {
  return useLiveQuery(
    () => getSubscriptionValue(mediaTypeIds, windowMonths),
    [JSON.stringify(mediaTypeIds), windowMonths],
  );
}
