import { db } from '@/services/database/db';
import { getSetting, setSetting } from '@/services/database/settingsService';
import { sourceOf } from '@/services/statistics/statisticsService';

/** Which `metadata.source` values count as a paid subscription, keyed
 * by media type id then by the exact source string. Missing from the
 * map (rather than explicitly `false`) is treated the same as
 * `false` — see `isSubscriptionSource` below — so this only needs to
 * list the sources worth calling out either way. */
export type SubscriptionSourceConfig = Record<string, Record<string, boolean>>;

/** Starter values, applied the first time this setting is read (see
 * `getSubscriptionSourceConfig`). Chosen to match what's already
 * offered as autocomplete suggestions in defaultMediaTypes.ts:
 * flat-fee subscriptions default on, à la carte/library/free/physical
 * sources default off. Anyone can flip any of these in Settings >
 * Subscriptions — this is only ever a starting point, never
 * re-applied over a user's existing choices. */
export const DEFAULT_SUBSCRIPTION_SOURCES: SubscriptionSourceConfig = {
  film: {
    Netflix: true,
    'Disney+': true,
    'Amazon Prime Video': true,
    Max: true,
    Hulu: true,
    'Apple TV+': true,
    Theatrical: false,
    'Physical Media': false,
    Digital: false,
  },
  tv: {
    Netflix: true,
    'Disney+': true,
    'Amazon Prime Video': true,
    Max: true,
    Hulu: true,
    'Apple TV+': true,
    Theatrical: false,
    'Physical Media': false,
    Digital: false,
  },
  anime: {
    Crunchyroll: true,
    Netflix: true,
    HIDIVE: true,
    Funimation: true,
    'Disney+': true,
    'Physical Media': false,
    Digital: false,
  },
  podcast: {
    Spotify: true,
    'Apple Podcasts': true,
    YouTube: true,
    Overcast: false,
  },
  audiobook: {
    Audible: true,
    Spotify: true,
    Libby: false,
    'Physical CD': false,
  },
  book: {
    Kindle: false,
    Libby: false,
    Kobo: false,
    'Apple Books': false,
    'Physical Copy': false,
  },
};

/** Reads the Subscriptions config (Settings > Subscriptions),
 * defaulting to `DEFAULT_SUBSCRIPTION_SOURCES` the first time it's
 * read — never overwrites a stored value that already exists,
 * including for individual sources the defaults don't know about
 * (those are simply absent, and `isSubscriptionSource` treats absent
 * as "not a subscription" until the user says otherwise). */
export async function getSubscriptionSourceConfig(): Promise<SubscriptionSourceConfig> {
  return getSetting<SubscriptionSourceConfig>(
    'subscriptionSources',
    DEFAULT_SUBSCRIPTION_SOURCES,
  );
}

/** Sets a single (mediaTypeId, source) flag and persists the whole
 * config, preserving every other flag already stored. */
export async function setSubscriptionSourceFlag(
  mediaTypeId: string,
  source: string,
  isSubscription: boolean,
): Promise<void> {
  const config = await getSubscriptionSourceConfig();
  const group = { ...(config[mediaTypeId] ?? {}) };
  group[source] = isSubscription;
  await setSetting('subscriptionSources', { ...config, [mediaTypeId]: group });
}

/** Whether `source` counts as a subscription for `mediaTypeId`,
 * per the stored config. Absent from the config is treated as "not a
 * subscription" — a source only counts once someone has explicitly
 * turned it on, whether via the defaults above or by hand in
 * Settings. */
export function isSubscriptionSource(
  config: SubscriptionSourceConfig,
  mediaTypeId: string,
  source: string,
): boolean {
  return config[mediaTypeId]?.[source] === true;
}

/** Every distinct `metadata.source` value actually used by entries of
 * the given media types, for Settings > Subscriptions to list —
 * covers custom/typed-in values beyond the starter list above, not
 * just the autocomplete suggestions in defaultMediaTypes.ts. */
export async function getDistinctSourceValues(
  mediaTypeIds: string[],
): Promise<Record<string, string[]>> {
  const idSet = new Set(mediaTypeIds);
  const entries = await db.mediaEntries.where('mediaType').anyOf(mediaTypeIds).toArray();
  const seen: Record<string, Set<string>> = {};
  for (const entry of entries) {
    if (!idSet.has(entry.mediaType)) continue;
    const source = sourceOf(entry);
    if (!source) continue;
    const set = seen[entry.mediaType] ?? new Set<string>();
    set.add(source);
    seen[entry.mediaType] = set;
  }
  return Object.fromEntries(
    Object.entries(seen).map(([id, set]) => [id, Array.from(set).sort()]),
  );
}
