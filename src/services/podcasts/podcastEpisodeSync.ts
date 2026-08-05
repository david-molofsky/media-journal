import { db } from '@/services/database/db';
import { createEntry } from '@/services/database/entryService';
import {
  addPodcastSubscription,
  listPodcastSubscriptions,
  touchPodcastSubscriptionLastChecked,
} from '@/services/database/podcastSubscriptionService';
import { fetchAndParseFeed, type PodcastEpisode, type FetchedPodcastFeed } from './podcastFeedService';
import { importedFromTag } from '@/utils/importedFromTag';
import type { PodcastSubscription, EntryMetadata } from '@/models';

const SOURCE = 'Podcast RSS';

/** How much of a show's existing back-catalogue to import as Wishlist
 * entries at subscribe time — asked fresh every time someone
 * subscribes (see chat), no remembered default. */
export type BackCatalogueOption =
  | { type: 'all' }
  | { type: 'none' }
  | { type: 'lastN'; n: number };

function selectBackCatalogue(
  episodesNewestFirst: PodcastEpisode[],
  option: BackCatalogueOption,
): PodcastEpisode[] {
  if (option.type === 'none') return [];
  if (option.type === 'all') return episodesNewestFirst;
  return episodesNewestFirst.slice(0, Math.max(0, option.n));
}

async function createEpisodeEntry(
  subscription: Pick<PodcastSubscription, 'id' | 'showArtworkUrl'>,
  episode: PodcastEpisode,
): Promise<void> {
  const coverImagePath = episode.artworkUrl || subscription.showArtworkUrl || undefined;
  const metadata: EntryMetadata = {
    podcastSubscriptionId: subscription.id,
    episodeGuid: episode.guid,
    ...(coverImagePath ? { coverImagePath } : {}),
    // RSS auto-fill (see chat) — Season/Episode/Duration/Show Notes.
    // Each only written when the feed actually provided it, same
    // pattern as coverImagePath above, so a field absent from the
    // feed stays genuinely absent rather than saving as 0/''.
    ...(episode.seasonNumber !== undefined ? { seasonNumber: episode.seasonNumber } : {}),
    ...(episode.episodeNumber !== undefined ? { episodeNumber: episode.episodeNumber } : {}),
    ...(episode.durationMinutes !== undefined ? { duration: episode.durationMinutes } : {}),
    ...(episode.description ? { overview: episode.description } : {}),
  };
  await createEntry({
    title: episode.title,
    mediaType: 'podcast',
    status: 'wishlist',
    repeatConsumption: false,
    tags: [importedFromTag(SOURCE)],
    genres: [],
    metadata,
  });
}

/**
 * Subscribes to a feed: fetches it once (for real show title/artwork
 * and the full episode list), creates the subscription row, then
 * imports whichever slice of the back-catalogue was chosen as
 * Wishlist entries. Counts as the subscription's first "check", so
 * its `lastCheckedAt` is set immediately rather than left blank.
 */
export async function subscribeToPodcast(
  feedUrl: string,
  backCatalogue: BackCatalogueOption,
  // Add Subscription's back-catalogue prompt already needs the feed
  // fetched (to show an accurate episode count), so this accepts that
  // result directly rather than fetching a second time.
  prefetchedFeed?: FetchedPodcastFeed,
): Promise<{ subscription: PodcastSubscription; addedCount: number; totalEpisodes: number }> {
  const feed = prefetchedFeed ?? (await fetchAndParseFeed(feedUrl));

  const subscription = await addPodcastSubscription({
    feedUrl,
    showTitle: feed.showTitle,
    showArtworkUrl: feed.showArtworkUrl,
  });

  const toImport = selectBackCatalogue(feed.episodes, backCatalogue);
  for (const episode of toImport) {
    await createEpisodeEntry(subscription, episode);
  }
  await touchPodcastSubscriptionLastChecked(subscription.id);

  return { subscription, addedCount: toImport.length, totalEpisodes: feed.episodes.length };
}

/** Every episode guid already imported for a given subscription, so a
 * check can tell "new" from "already have this one" — Dexie has no
 * index into `metadata`, so this is a full scan of `podcast` entries
 * filtered in JS. Podcast libraries are small relative to IndexedDB's
 * comfortable range, so this stays fast in practice. */
async function loadExistingEpisodeGuids(subscriptionId: string): Promise<Set<string>> {
  const podcastEntries = await db.mediaEntries.where('mediaType').equals('podcast').toArray();
  const guids = podcastEntries
    .filter((e) => e.metadata.podcastSubscriptionId === subscriptionId)
    .map((e) => e.metadata.episodeGuid)
    .filter((g): g is string => typeof g === 'string');
  return new Set(guids);
}

export interface SubscriptionCheckResult {
  subscriptionId: string;
  showTitle: string;
  newEpisodeTitles: string[];
  /** Set when this subscription's feed couldn't be fetched/parsed —
   * the check continues on to the remaining subscriptions regardless. */
  error?: string;
}

/**
 * Manual "Check for New Episodes" — no automatic/background polling
 * (see chat). Walks every subscription, diffs its feed against
 * episodes already imported, creates Wishlist entries for anything
 * new, and stamps `lastCheckedAt`. One subscription's feed failing
 * doesn't stop the rest from being checked.
 */
export async function checkAllSubscriptionsForNewEpisodes(): Promise<SubscriptionCheckResult[]> {
  const subscriptions = await listPodcastSubscriptions();
  const results: SubscriptionCheckResult[] = [];

  for (const subscription of subscriptions) {
    try {
      const feed = await fetchAndParseFeed(subscription.feedUrl);
      const existingGuids = await loadExistingEpisodeGuids(subscription.id);
      const newEpisodes = feed.episodes.filter((ep) => !existingGuids.has(ep.guid));

      for (const episode of newEpisodes) {
        await createEpisodeEntry(subscription, episode);
      }
      await touchPodcastSubscriptionLastChecked(subscription.id);

      results.push({
        subscriptionId: subscription.id,
        showTitle: subscription.showTitle,
        newEpisodeTitles: newEpisodes.map((e) => e.title),
      });
    } catch (err) {
      results.push({
        subscriptionId: subscription.id,
        showTitle: subscription.showTitle,
        newEpisodeTitles: [],
        error: err instanceof Error ? err.message : 'Could not check this feed.',
      });
    }
  }

  return results;
}
