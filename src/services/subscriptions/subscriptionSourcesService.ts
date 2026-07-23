import { db } from '@/services/database/db';
import { getSetting, setSetting } from '@/services/database/settingsService';
import { sourceOf } from '@/services/statistics/statisticsService';

/** Which `metadata.source` values count as a paid subscription, keyed
 * by the exact source string — global across every media type, not
 * per type. A source like Disney+ or Libby means the same
 * subscription regardless of whether it's attached to a Film, TV,
 * Audiobook, or Comic entry, so a single flag covers all of them.
 * Missing from the map (rather than explicitly `false`) is treated
 * the same as `false` — see `isSubscriptionSource` below.
 *
 * Changed from a per-media-type shape (`Record<mediaTypeId,
 * Record<source, boolean>>`) to this flat one — see chat (Settings >
 * Subscriptions redesign): the old shape let the same real-world
 * service (e.g. Disney+ logged under both Film and TV) end up with
 * two independent, silently-diverging flags. See
 * `migrateLegacySubscriptionSourceConfig` for the one-time upgrade
 * from the old shape. */
export type SubscriptionSourceConfig = Record<string, boolean>;

/** Starter values, applied the first time this setting is read (see
 * `getSubscriptionSourceConfig`). Flat-fee subscriptions default on,
 * à la carte/library/free/physical sources default off. Anyone can
 * flip any of these in Settings > Subscriptions — this is only ever a
 * starting point, never re-applied over a user's existing choices. */
export const DEFAULT_SUBSCRIPTION_SOURCES: SubscriptionSourceConfig = {
  // Film, TV & Anime
  Netflix: true,
  'Disney+': true,
  'Amazon Prime Video': true,
  Max: true,
  Hulu: true,
  'Apple TV+': true,
  Crunchyroll: true,
  HIDIVE: true,
  Funimation: true,
  Theatrical: false,
  'Physical Media': false,
  Digital: false,
  // Comics & Manga
  Physical: false,
  'Humble Bundle': false,
  'Marvel Unlimited': true,
  'Kindle/Comixology': false,
  Hoopla: false,
  Libby: true,
  'Global Comix': false,
  Comichaus: true,
  Webtoons: false,
  'Shonen Jump': true,
  // Books
  Kindle: false,
  Kobo: false,
  'Apple Books': false,
  'Physical Copy': false,
  // Audiobooks
  Audible: true,
  'Physical CD': false,
  // Podcasts
  Spotify: true,
  'Apple Podcasts': true,
  YouTube: true,
  Overcast: false,
};

/** Suggested source names to show under each Settings > Subscriptions
 * category (keyed by `SUBSCRIPTION_VALUE_GROUPS` title) even before
 * anything's been logged against them yet — purely a display
 * grouping for Settings. The underlying subscription flag itself
 * (`DEFAULT_SUBSCRIPTION_SOURCES` and the stored config) is flat and
 * has no concept of category; a source appearing in more than one
 * list here (e.g. Spotify under both Podcasts and Audiobooks, or
 * Libby under Audiobooks and Comics & Manga) shares the exact same
 * flag everywhere it's listed — see `useSubscriptionSources`. */
export const SUGGESTED_SOURCES_BY_GROUP: Record<string, string[]> = {
  'Film, TV & Anime': [
    'Netflix',
    'Disney+',
    'Amazon Prime Video',
    'Max',
    'Hulu',
    'Apple TV+',
    'Crunchyroll',
    'HIDIVE',
    'Funimation',
    'Theatrical',
    'Physical Media',
    'Digital',
  ],
  'Comics & Manga': [
    'Physical',
    'Humble Bundle',
    'Marvel Unlimited',
    'Kindle/Comixology',
    'Hoopla',
    'Libby',
    'Digital',
    'Global Comix',
    'Comichaus',
    'Webtoons',
    'Shonen Jump',
  ],
  'Reading sources': ['Kindle', 'Libby', 'Kobo', 'Apple Books', 'Physical Copy'],
  Audiobooks: ['Audible', 'Spotify', 'Libby', 'Physical CD'],
  Podcasts: ['Spotify', 'Apple Podcasts', 'YouTube', 'Overcast'],
};

/** True when `value` looks like the pre-redesign per-media-type shape
 * (an object whose values are themselves objects) rather than the
 * current flat shape (an object whose values are booleans). Used only
 * by `migrateLegacySubscriptionSourceConfig`, to detect data written
 * before Settings > Subscriptions moved to a single global flag per
 * source. */
function isLegacyShape(
  value: unknown,
): value is Record<string, Record<string, boolean>> {
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value).some((v) => typeof v === 'object' && v !== null);
}

/** One-time upgrade from the old `(mediaTypeId -> source -> boolean)`
 * shape to the new flat `(source -> boolean)` shape. A source counts
 * as a subscription in the new shape if it was `true` for *any* media
 * type in the old shape — the more permissive resolution, chosen in
 * chat: a subscription service doesn't stop being one just because it
 * was mis-flagged for a second media type it's also logged under. */
function migrateLegacySubscriptionSourceConfig(
  legacy: Record<string, Record<string, boolean>>,
): SubscriptionSourceConfig {
  const flat: SubscriptionSourceConfig = {};
  for (const sources of Object.values(legacy)) {
    for (const [source, isSubscription] of Object.entries(sources)) {
      if (isSubscription) {
        flat[source] = true;
      } else if (!(source in flat)) {
        flat[source] = false;
      }
    }
  }
  return flat;
}

/** Reads the Subscriptions config (Settings > Subscriptions),
 * defaulting to `DEFAULT_SUBSCRIPTION_SOURCES` the first time it's
 * read — never overwrites a stored value that already exists,
 * including for individual sources the defaults don't know about
 * (those are simply absent, and `isSubscriptionSource` treats absent
 * as "not a subscription" until the user says otherwise).
 *
 * Transparently upgrades data written before the Settings >
 * Subscriptions redesign (the old per-media-type shape) the first
 * time it's read, persisting the upgraded flat shape so this only
 * happens once. */
export async function getSubscriptionSourceConfig(): Promise<SubscriptionSourceConfig> {
  const stored = await getSetting<unknown>('subscriptionSources', DEFAULT_SUBSCRIPTION_SOURCES);
  if (isLegacyShape(stored)) {
    const migrated = migrateLegacySubscriptionSourceConfig(stored);
    await setSetting('subscriptionSources', migrated);
    return migrated;
  }
  return stored as SubscriptionSourceConfig;
}

/** Sets a single source's flag and persists the whole config,
 * preserving every other flag already stored. Applies globally — the
 * source no longer needs a media type, since one flag now covers
 * every media type that source is logged under. */
export async function setSubscriptionSourceFlag(
  source: string,
  isSubscription: boolean,
): Promise<void> {
  const config = await getSubscriptionSourceConfig();
  await setSetting('subscriptionSources', { ...config, [source]: isSubscription });
}

/** Whether `source` counts as a subscription, per the stored config.
 * Absent from the config is treated as "not a subscription" — a
 * source only counts once someone has explicitly turned it on,
 * whether via the defaults above or by hand in Settings. */
export function isSubscriptionSource(
  config: SubscriptionSourceConfig,
  source: string,
): boolean {
  return config[source] === true;
}

/** Every distinct `metadata.source` value actually used by entries of
 * the given media types, for Settings > Subscriptions to list —
 * covers custom/typed-in values beyond the starter list above, not
 * just the autocomplete suggestions in defaultMediaTypes.ts. Still
 * grouped by media type (rather than returned as one flat list), so
 * callers can decide how to merge/dedupe per their own grouping —
 * see `SubscriptionsSection`, which unions each of its category
 * groups' member media types into a single deduped list per
 * category. */
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
