/**
 * Podcast Subscriptions — show search (PodcastIndex.org) and RSS feed
 * fetch/parse (see chat). Both routes go through the Worker:
 * PodcastIndex because its auth (a signed request) has to happen
 * server-side with a real secret, RSS because most podcast hosts send
 * no CORS headers at all and there's no way to host-allowlist
 * arbitrary podcast feeds the way /image-proxy does for the three
 * known image CDNs (see combined-worker.js's comment on /rss-proxy
 * for the tradeoff that implies).
 *
 * Originally used Apple's iTunes Search API instead (no key needed),
 * but Apple rate-limits per source IP and Cloudflare Workers share an
 * outbound IP pool across every Worker on the platform — a well-known
 * show search could silently come back empty because of unrelated
 * traffic on the same shared IP. PodcastIndex.org is built specifically
 * for third-party podcast-app server traffic like this.
 */

const WORKER_BASE = 'https://media-journal-comicvine-proxy.david-molofsky.workers.dev';

export interface PodcastSearchResult {
  feedUrl: string;
  showTitle: string;
  artworkUrl?: string;
}

interface PodcastIndexFeed {
  url?: string;
  title?: string;
  image?: string;
  artwork?: string;
}

/** Searches PodcastIndex.org's directory by show name — the "search by
 * show name" half of Add Subscription (the other half, pasting an RSS
 * URL directly, doesn't need this at all). */
export async function searchPodcasts(term: string): Promise<PodcastSearchResult[]> {
  if (!term.trim()) return [];

  const res = await fetch(`${WORKER_BASE}/podcast-search?term=${encodeURIComponent(term)}`);
  if (!res.ok) throw new Error(`Podcast search failed: ${res.status}`);

  const data = (await res.json()) as { feeds?: PodcastIndexFeed[] };

  return (data.feeds ?? [])
    .filter((f): f is PodcastIndexFeed & { url: string; title: string } => !!f.url && !!f.title)
    .map((f) => ({
      feedUrl: f.url,
      showTitle: f.title,
      // PodcastIndex returns both `artwork` and `image` for most feeds
      // (usually identical) — `artwork` first since it's the field
      // their own docs describe as the canonical cover image.
      artworkUrl: f.artwork || f.image,
    }));
}

export interface PodcastEpisode {
  /** Stable per-episode identifier, used for dedup against episodes
   * already imported as entries (see checkForNewEpisodes.ts). Prefers
   * the feed's own `<guid>`; falls back to the episode link, then to
   * a title+pubDate composite for the rare feed with neither. */
  guid: string;
  title: string;
  /** ISO 8601 — converted from the feed's RFC 822-ish `<pubDate>`. */
  publishedAt: string;
  /** Episode-level artwork (`<itunes:image href="...">` on the
   * `<item>`), if the feed provides one. Falls back to show-level
   * artwork at the call site, not here — this service just reports
   * what each item actually has. */
  artworkUrl?: string;
}

export interface FetchedPodcastFeed {
  showTitle: string;
  showArtworkUrl?: string;
  /** Newest first, matching typical feed order — checkForNewEpisodes.ts
   * relies on this order when honouring "last N episodes". */
  episodes: PodcastEpisode[];
}

function textOf(parent: Element | null, tagName: string): string | undefined {
  const el = parent?.getElementsByTagName(tagName)[0];
  const text = el?.textContent?.trim();
  return text || undefined;
}

/** Browsers' XML DOMParser matches `itunes:image` as a literal tag
 * name (rather than resolving the `itunes` namespace prefix properly)
 * when queried via `getElementsByTagName`, which is the pragmatic,
 * widely-used approach for parsing podcast RSS client-side — a real
 * namespace-aware query needs the exact xmlns URI wired up, which
 * varies enough across feeds not to be worth it here. */
function itunesImageHref(parent: Element | null): string | undefined {
  const el = parent?.getElementsByTagName('itunes:image')[0];
  return el?.getAttribute('href') || undefined;
}

function toIsoDate(pubDate: string | undefined): string {
  if (pubDate) {
    const parsed = new Date(pubDate);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

/**
 * Fetches an RSS feed via the Worker proxy and parses it into show
 * metadata + an episode list. Throws on network failure or malformed
 * XML — callers (Add Subscription, Check for New Episodes) surface
 * that as "couldn't read this feed" rather than silently returning
 * nothing.
 */
export async function fetchAndParseFeed(feedUrl: string): Promise<FetchedPodcastFeed> {
  const res = await fetch(`${WORKER_BASE}/rss-proxy?url=${encodeURIComponent(feedUrl)}`);
  if (!res.ok) throw new Error(`Couldn't fetch this feed (${res.status}).`);

  const xmlText = await res.text();
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error("This doesn't look like a valid RSS feed.");
  }

  const channel = doc.getElementsByTagName('channel')[0] ?? null;
  const showTitle = textOf(channel, 'title') ?? 'Untitled Podcast';
  const showArtworkUrl =
    itunesImageHref(channel) ??
    textOf(channel?.getElementsByTagName('image')[0] ?? null, 'url');

  const items = Array.from(channel?.getElementsByTagName('item') ?? []);
  const episodes: PodcastEpisode[] = items.map((item) => {
    const title = textOf(item, 'title') ?? 'Untitled Episode';
    const pubDate = textOf(item, 'pubDate');
    const guid = textOf(item, 'guid') ?? textOf(item, 'link') ?? `${title}|${pubDate ?? ''}`;
    return {
      guid,
      title,
      publishedAt: toIsoDate(pubDate),
      artworkUrl: itunesImageHref(item),
    };
  });

  return { showTitle, showArtworkUrl, episodes };
}
