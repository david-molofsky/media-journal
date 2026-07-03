/**
 * Builds the plain-text message that accompanies a shared entry image.
 *
 * Message wording depends on the entry's status (wishlist / in_progress /
 * completed) and a "consumption verb" for its media type (reading,
 * watching, etc.). Every message ends with a link back to the app.
 */

import type { MediaEntry } from '@/models';

const APP_URL = 'https://david-molofsky.github.io/media-journal/';

/**
 * Consumption verb per default media type id, used to fill in
 * "I started {verb} {title}" / "I finished {verb} {title}".
 *
 * NOTE: media types are user-configurable (see MediaType model) — this
 * map only covers the 10 built-in types. Custom types created via
 * Settings fall back to GENERIC_VERB below. If custom media types
 * become common, consider promoting this to a `verb` field on the
 * MediaType record itself instead of a hardcoded lookup.
 */
const VERB_BY_TYPE: Record<string, string> = {
  book: 'reading',
  comic: 'reading',
  magazine: 'reading',
  audiobook: 'listening to',
  podcast: 'listening to',
  film: 'watching',
  tv: 'watching',
  theatre: 'watching',
  game: 'playing',
  art: 'viewing',
};

const GENERIC_VERB = 'enjoying';

/** Returns the consumption verb for a media type id, with a safe fallback. */
export function getConsumptionVerb(mediaTypeId: string): string {
  return VERB_BY_TYPE[mediaTypeId] ?? GENERIC_VERB;
}

/**
 * Builds the share message line (no trailing URL) for an entry, e.g.
 * "I finished watching Dune: Part Three on Media Journal!"
 */
export function buildShareMessageLine(entry: MediaEntry): string {
  const verb = getConsumptionVerb(entry.mediaType);

  switch (entry.status) {
    case 'wishlist':
      return `I added ${entry.title} to my wishlist on Media Journal!`;
    case 'in_progress':
      return `I started ${verb} ${entry.title} on Media Journal!`;
    case 'completed':
    default:
      return `I finished ${verb} ${entry.title} on Media Journal!`;
  }
}

/** Full share message: the message line, a newline, then the app URL. */
export function buildShareMessage(entry: MediaEntry): string {
  return `${buildShareMessageLine(entry)}\n${APP_URL}`;
}
