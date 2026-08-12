import type { MediaEntry } from '@/models';

/**
 * "Find Next in Series" (see chat, Aug 2026) — supported media types
 * and, per type, what an entry needs before the button enables.
 * Deliberately conservative, same reasoning as relogLabel.ts: Art,
 * Theatre, Sport and custom types have no series concept at all and
 * are excluded entirely rather than showing a button that can never
 * do anything.
 *
 * Each type's real "next" lookup lives in nextInSeriesService.ts —
 * this file only decides whether the button is enabled and what the
 * disabled tooltip should say, so EntryDetail-type components (button
 * placement) don't need to know the per-type data-source details.
 */
export type NextInSeriesEligibility =
  | { eligible: true }
  | { eligible: false; reason: string };

const SUPPORTED_MEDIA_TYPES = new Set([
  'book',
  'audiobook',
  'tv',
  'film',
  'comic',
  'anime',
  'manga',
  'podcast',
]);

/** Button label — "Find Next Episode" for Podcasts (no series/number
 * concept, see chat), "Find Next in Series" everywhere else. */
export function nextInSeriesButtonLabel(mediaTypeId: string): string {
  return mediaTypeId === 'podcast' ? 'Find Next Episode' : 'Find Next in Series';
}

export function isNextInSeriesSupported(mediaTypeId: string): boolean {
  return SUPPORTED_MEDIA_TYPES.has(mediaTypeId);
}

/** True only for a string that is purely digits (no "Vol.", no
 * decimals) — Book/Audiobook's Volume field is free text, and David's
 * call (Aug 2026) was to require it be purely numeric for the button
 * to enable, rather than best-effort-parsing things like "Vol. 2". */
function isPureInteger(value: string | undefined): value is string {
  return typeof value === 'string' && /^\d+$/.test(value.trim());
}

export function getNextInSeriesEligibility(entry: MediaEntry): NextInSeriesEligibility {
  const { mediaType, metadata } = entry;

  if (!isNextInSeriesSupported(mediaType)) {
    return { eligible: false, reason: 'Not available for this media type' };
  }

  switch (mediaType) {
    case 'book':
    case 'audiobook': {
      const series = metadata.series;
      const volume = metadata.volume;
      if (!(typeof series === 'string' && series.trim())) {
        return { eligible: false, reason: 'Add a Series name to use this feature' };
      }
      if (!isPureInteger(typeof volume === 'string' ? volume : undefined)) {
        return {
          eligible: false,
          reason: 'Volume must be a plain number (e.g. "2", not "Vol. 2") to use this feature',
        };
      }
      return { eligible: true };
    }

    case 'tv': {
      // TMDB-backed (see nextInSeriesService.ts) — needs tmdbId to
      // look up the show directly, rather than a fresh title search.
      const tmdbId = metadata.tmdbId;
      const seasonNumber = metadata.seasonNumber;
      if (!(typeof tmdbId === 'string' && tmdbId)) {
        return {
          eligible: false,
          reason: 'This entry isn\'t linked to TMDB — re-fill it via search to use this feature',
        };
      }
      if (typeof seasonNumber !== 'number') {
        return { eligible: false, reason: 'Add a Season Number to use this feature' };
      }
      return { eligible: true };
    }

    case 'film': {
      // TMDB Collections-backed — tmdbId is the only requirement; no
      // numeric field exists for Film at all (see chat).
      const tmdbId = metadata.tmdbId;
      if (!(typeof tmdbId === 'string' && tmdbId)) {
        return {
          eligible: false,
          reason: 'This entry isn\'t linked to TMDB — re-fill it via search to use this feature',
        };
      }
      return { eligible: true };
    }

    case 'comic': {
      const series = metadata.series;
      const issueNumber = metadata.issueEnd ?? metadata.issueStart;
      if (!(typeof series === 'string' && series.trim())) {
        return { eligible: false, reason: 'Add a Series name to use this feature' };
      }
      if (typeof issueNumber !== 'number') {
        return { eligible: false, reason: 'Add an Issue Start/End number to use this feature' };
      }
      return { eligible: true };
    }

    case 'anime': {
      const series = metadata.series;
      const seasonNumber = metadata.seasonNumber;
      if (!(typeof series === 'string' && series.trim())) {
        return { eligible: false, reason: 'Add a Series name to use this feature' };
      }
      if (typeof seasonNumber !== 'number') {
        return { eligible: false, reason: 'Add a Season Number to use this feature' };
      }
      return { eligible: true };
    }

    case 'manga': {
      const series = metadata.series;
      const volumeNumber = metadata.volumeNumber;
      if (!(typeof series === 'string' && series.trim())) {
        return { eligible: false, reason: 'Add a Series name to use this feature' };
      }
      if (typeof volumeNumber !== 'number') {
        return { eligible: false, reason: 'Add a Volume Number to use this feature' };
      }
      return { eligible: true };
    }

    case 'podcast': {
      const subscriptionId = metadata.podcastSubscriptionId;
      const episodeGuid = metadata.episodeGuid;
      if (!(typeof subscriptionId === 'string' && subscriptionId)) {
        return {
          eligible: false,
          reason: 'Only available for episodes added via a Podcast Subscription',
        };
      }
      if (!(typeof episodeGuid === 'string' && episodeGuid)) {
        return { eligible: false, reason: 'This episode is missing feed data needed for this feature' };
      }
      return { eligible: true };
    }

    default:
      return { eligible: false, reason: 'Not available for this media type' };
  }
}
