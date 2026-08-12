import type { MediaEntry, NewMediaEntryInput } from '@/models';
import { findNextBookInSeries } from './openLibraryService';
import { findNextTVSeason, findNextFilmInCollection } from './tmdbService';
import { findNextComicIssue } from './comicVineService';
import { findMalSequel, searchMalTitle } from './malService';
import { fetchAndParseFeed, findNextEpisode } from '@/services/podcasts/podcastFeedService';
import { getPodcastSubscription } from '@/services/database/podcastSubscriptionService';
import { getNextInSeriesEligibility } from '@/utils/nextInSeries';

export interface NextInSeriesFound {
  title: string;
  subtitle?: string;
  /** Small badge shown in the confirm popup — "via TMDB", "via Open
   * Library", etc. — so it's clear where the match came from. */
  sourceBadge: string;
  /** Ready to hand straight to entryService.createEntry on "Add to
   * Wishlist" — always status: 'wishlist'. */
  entryInput: NewMediaEntryInput;
}

export type NextInSeriesResult =
  | { status: 'found'; found: NextInSeriesFound }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

/** Shared entry-shape builder — every branch below only differs in
 * `title` and the type-specific `metadata` fields it found. Carries
 * over the parent entry's Source and genres (same platform, same
 * franchise), same reasoning as "Log a Rewatch"'s metadata carryover,
 * but deliberately starts fresh on tags/notes/rating — this is a new
 * entry, not a copy. */
function buildEntryInput(
  entry: MediaEntry,
  title: string,
  foundMetadata: Record<string, string | number>,
): NewMediaEntryInput {
  const source = entry.metadata.source;
  return {
    title,
    mediaType: entry.mediaType,
    status: 'wishlist',
    repeatConsumption: false,
    tags: [],
    genres: entry.genres ?? [],
    metadata: {
      ...(typeof source === 'string' && source ? { source } : {}),
      ...foundMetadata,
    },
  };
}

/**
 * Finds the next entry in the same series/season/issue/episode as
 * `entry`, dispatching to the relevant metadata source per media type
 * (see nextInSeries.ts for the eligibility rules this assumes have
 * already passed). Never throws — network/API failures are caught and
 * returned as `{ status: 'error' }` so the calling UI can show a
 * message rather than an unhandled rejection.
 */
export async function findNextInSeries(entry: MediaEntry): Promise<NextInSeriesResult> {
  const eligibility = getNextInSeriesEligibility(entry);
  if (!eligibility.eligible) {
    return { status: 'error', message: eligibility.reason };
  }

  try {
    switch (entry.mediaType) {
      case 'book':
      case 'audiobook': {
        const series = String(entry.metadata.series);
        const nextVolume = Number(entry.metadata.volume) + 1;
        const match = await findNextBookInSeries(series, nextVolume);
        if (!match) return { status: 'not_found' };
        return {
          status: 'found',
          found: {
            title: match.title,
            subtitle: `${series} · #${nextVolume}`,
            sourceBadge: 'via Open Library',
            entryInput: buildEntryInput(entry, match.title, match.fields),
          },
        };
      }

      case 'tv': {
        const tmdbId = String(entry.metadata.tmdbId);
        const seasonNumber = Number(entry.metadata.seasonNumber);
        const match = await findNextTVSeason(tmdbId, seasonNumber);
        if (!match) return { status: 'not_found' };
        return {
          status: 'found',
          found: {
            title: match.title,
            subtitle: `Season ${seasonNumber + 1}`,
            sourceBadge: 'via TMDB',
            entryInput: buildEntryInput(entry, match.title, { ...match.fields, tmdbId }),
          },
        };
      }

      case 'film': {
        const tmdbId = String(entry.metadata.tmdbId);
        const match = await findNextFilmInCollection(tmdbId);
        if (!match) return { status: 'not_found' };
        return {
          status: 'found',
          found: {
            title: match.title,
            subtitle: match.fields.series ? `${match.fields.series} Series` : undefined,
            sourceBadge: 'via TMDB',
            entryInput: buildEntryInput(entry, match.title, match.fields),
          },
        };
      }

      case 'comic': {
        const series = String(entry.metadata.series);
        const currentIssue = Number(entry.metadata.issueEnd ?? entry.metadata.issueStart);
        const nextIssue = currentIssue + 1;
        const match = await findNextComicIssue(series, nextIssue);
        if (!match) return { status: 'not_found' };
        return {
          status: 'found',
          found: {
            title: match.title,
            subtitle: `${series} · #${nextIssue}`,
            sourceBadge: 'via ComicVine',
            entryInput: buildEntryInput(entry, match.title, match.fields),
          },
        };
      }

      case 'anime':
      case 'manga': {
        const type = entry.mediaType;
        const series = String(entry.metadata.series);
        const storedMalId = typeof entry.metadata.malId === 'string' ? entry.metadata.malId : undefined;
        const showId = storedMalId ?? (await searchMalTitle(series, type))?.id.toString();
        if (!showId) return { status: 'not_found' };

        const sequel = await findMalSequel(showId, type);
        if (!sequel) return { status: 'not_found' };

        return {
          status: 'found',
          found: {
            title: sequel.title,
            subtitle: 'Sequel',
            sourceBadge: 'via MyAnimeList',
            entryInput: buildEntryInput(entry, sequel.title, {
              series: sequel.title,
              malId: String(sequel.id),
            }),
          },
        };
      }

      case 'podcast': {
        const subscriptionId = String(entry.metadata.podcastSubscriptionId);
        const episodeGuid = String(entry.metadata.episodeGuid);

        const subscription = await getPodcastSubscription(subscriptionId);
        if (!subscription) return { status: 'error', message: 'This subscription no longer exists' };

        const feed = await fetchAndParseFeed(subscription.feedUrl);
        const next = findNextEpisode(feed.episodes, episodeGuid);
        if (!next) return { status: 'not_found' };

        const foundMetadata: Record<string, string | number> = {
          podcastSubscriptionId: subscriptionId,
          episodeGuid: next.guid,
        };
        if (next.seasonNumber !== undefined) foundMetadata.seasonNumber = next.seasonNumber;
        if (next.episodeNumber !== undefined) foundMetadata.episodeNumber = next.episodeNumber;
        if (next.durationMinutes !== undefined) foundMetadata.duration = next.durationMinutes;
        if (next.description) foundMetadata.overview = next.description;
        if (next.artworkUrl) foundMetadata.coverImagePath = next.artworkUrl;

        return {
          status: 'found',
          found: {
            title: next.title,
            subtitle: `${subscription.showTitle} · Published ${new Date(next.publishedAt).toLocaleDateString()}`,
            sourceBadge: 'via RSS',
            entryInput: buildEntryInput(entry, next.title, foundMetadata),
          },
        };
      }

      default:
        return { status: 'error', message: 'Not available for this media type' };
    }
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Something went wrong' };
  }
}
