/**
 * A subscribed podcast feed (see chat — Podcast Subscriptions). Lives
 * in its own Dexie table, separate from `mediaEntries`, since a
 * subscription is bookkeeping ("which feeds do we check, and when did
 * we last check them") rather than something the user rates/reviews —
 * each *episode* a check finds becomes its own Wishlist `MediaEntry`
 * (mediaType `podcast`), tagged back to the subscription it came from
 * via `metadata.podcastSubscriptionId`.
 */
export interface PodcastSubscription {
  id: string;
  feedUrl: string;
  showTitle: string;
  /** Show-level artwork (iTunes search result artwork, or the feed's
   * own `<itunes:image>`/`<image><url>` if added via pasted RSS URL).
   * Falls back to this when an individual episode has no artwork of
   * its own — see podcastFeedService.ts. */
  showArtworkUrl?: string;
  /** ISO timestamp of the last successful "Check for New Episodes"
   * run against this feed, or undefined if it's never been checked
   * (e.g. right after subscribing). */
  lastCheckedAt?: string;
  createdAt: string;
}

export type NewPodcastSubscriptionInput = Omit<PodcastSubscription, 'id' | 'createdAt'>;
