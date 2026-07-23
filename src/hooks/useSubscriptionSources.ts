import { useLiveQuery } from 'dexie-react-hooks';
import {
  getSubscriptionSourceConfig,
  getDistinctSourceValues,
  SUGGESTED_SOURCES_BY_GROUP,
  type SubscriptionSourceConfig,
} from '@/services/subscriptions/subscriptionSourcesService';
import { SUBSCRIPTION_VALUE_GROUPS } from '@/services/statistics/subscriptionValueService';

export interface SubscriptionSourcesData {
  config: SubscriptionSourceConfig;
  /** Every distinct `metadata.source` value actually in use — unioned
   * with `SUGGESTED_SOURCES_BY_GROUP` — grouped and deduplicated per
   * Settings > Subscriptions category (`SUBSCRIPTION_VALUE_GROUPS`),
   * so a source used by more than one media type in the same category
   * (e.g. Disney+ under both Film and TV) appears once rather than
   * once per media type. A source someone typed in manually shows up
   * even before it's a suggested default, and a suggested default
   * still shows up even if nothing's been logged against it yet. */
  sourcesByGroup: Record<string, string[]>;
}

const ALL_TRACKED_MEDIA_TYPE_IDS = SUBSCRIPTION_VALUE_GROUPS.flatMap(
  (group) => group.mediaTypeIds,
);

export function useSubscriptionSources(): SubscriptionSourcesData | undefined {
  return useLiveQuery(async () => {
    const [config, inUse] = await Promise.all([
      getSubscriptionSourceConfig(),
      getDistinctSourceValues(ALL_TRACKED_MEDIA_TYPE_IDS),
    ]);

    const sourcesByGroup: Record<string, string[]> = {};
    for (const group of SUBSCRIPTION_VALUE_GROUPS) {
      const suggested = SUGGESTED_SOURCES_BY_GROUP[group.title] ?? [];
      const fromEntries = group.mediaTypeIds.flatMap((id) => inUse[id] ?? []);
      sourcesByGroup[group.title] = Array.from(
        new Set([...suggested, ...fromEntries]),
      ).sort();
    }
    return { config, sourcesByGroup };
  }, []);
}
