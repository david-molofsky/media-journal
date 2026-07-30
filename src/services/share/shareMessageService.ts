/**
 * Builds the plain-text message that accompanies a shared entry image.
 *
 * Message wording depends on the entry's status (wishlist / in_progress /
 * completed) and a "consumption verb" for its media type (reading,
 * watching, etc.). Every message ends with a link back to the app.
 */

import type { MediaEntry } from '@/models';
import { ROUTES } from '@/routes/paths';

const APP_URL = 'https://david-molofsky.github.io/media-journal/';

/**
 * Media types that support a shared "add to journal" deep link, and
 * the metadata key their source id is stored under (see
 * MetadataSearch.tsx's getSourceIdKey / AddEntryPage's shared-link
 * handling). Comics and any other type are left out — a comic's
 * ComicVine id identifies a series, not one issue, so it can't be
 * resolved back into a single entry the way a TMDB id or Open Library
 * work key can.
 */
const SHARED_LINK_ID_KEY: Record<string, string> = {
  film: 'tmdbId',
  tv: 'tmdbId',
  book: 'openLibraryKey',
  audiobook: 'openLibraryKey',
};

/**
 * Builds the link that goes at the end of a shared message. If the
 * entry's media type supports it and has a persisted source id, this
 * is a smart link straight to a pre-filled Add Entry screen
 * (`#/entry/new?type=...&id=...`); otherwise it's just the plain app
 * URL, same as before this feature existed.
 */
export function buildEntryLink(entry: MediaEntry): string {
  const idKey = SHARED_LINK_ID_KEY[entry.mediaType];
  const id = idKey ? entry.metadata[idKey] : undefined;
  if (!idKey || typeof id !== 'string' || !id) return APP_URL;

  const params = new URLSearchParams({ type: entry.mediaType, id });
  return `${APP_URL}#${ROUTES.addEntry}?${params.toString()}`;
}

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

/** Full share message: the message line, a newline, then the entry link
 * (a smart "add to journal" link when available, otherwise the plain
 * app URL — see buildEntryLink). */
export function buildShareMessage(entry: MediaEntry): string {
  return `${buildShareMessageLine(entry)}\n${buildEntryLink(entry)}`;
}
