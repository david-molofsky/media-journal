import { useLiveQuery } from 'dexie-react-hooks';
import {
  getSubscriptionSourceConfig,
  getDistinctSourceValues,
  DEFAULT_SUBSCRIPTION_SOURCES,
  type SubscriptionSourceConfig,
} from '@/services/subscriptions/subscriptionSourcesService';

export interface SubscriptionSourcesData {
  config: SubscriptionSourceConfig;
  /** Every distinct `metadata.source` value actually in use, per media
   * type, unioned with the starter list's keys — so a source someone
   * typed in manually shows up in Settings even before it's in
   * DEFAULT_SUBSCRIPTION_SOURCES, and a starter suggestion still shows
   * up even if nothing's been logged against it yet. */
  sourcesByMediaType: Record<string, string[]>;
}

const ALL_TRACKED_MEDIA_TYPE_IDS = Object.keys(DEFAULT_SUBSCRIPTION_SOURCES);

export function useSubscriptionSources(): SubscriptionSourcesData | undefined {
  return useLiveQuery(async () => {
    const [config, inUse] = await Promise.all([
      getSubscriptionSourceConfig(),
      getDistinctSourceValues(ALL_TRACKED_MEDIA_TYPE_IDS),
    ]);
    const sourcesByMediaType: Record<string, string[]> = {};
    for (const mediaTypeId of ALL_TRACKED_MEDIA_TYPE_IDS) {
      const fromDefaults = Object.keys(DEFAULT_SUBSCRIPTION_SOURCES[mediaTypeId] ?? {});
      const fromEntries = inUse[mediaTypeId] ?? [];
      sourcesByMediaType[mediaTypeId] = Array.from(
        new Set([...fromDefaults, ...fromEntries]),
      ).sort();
    }
    return { config, sourcesByMediaType };
  }, []);
}
