/**
 * Builds the plain-text message that accompanies a shared entry image.
 *
 * Message wording depends on the entry's status (wishlist / in_progress /
 * completed) and a "consumption verb" for its media type (reading,
 * watching, etc.). Every message ends with a link back to the app.
 */

import type { MediaEntry } from '@/models';
import { ROUTES } from '@/routes/paths';

const APP_URL = 'https://mediajournal.ap2hyc.com/';

/**
 * Media types that support a shared "add to journal" deep link via a
 * single persisted source id, and the metadata key that id is stored
 * under (see MetadataSearch.tsx's getSourceIdKey / AddEntryPage's
 * shared-link handling). Comic is handled separately below — a comic
 * issue needs two pieces of data (volume id + issue number), not one.
 */
const SHARED_LINK_ID_KEY: Record<string, string> = {
  film: 'tmdbId',
  tv: 'tmdbId',
  book: 'openLibraryKey',
  audiobook: 'openLibraryKey',
};

/**
 * Comic's smart link (see chat, Aug 2026). Two tiers:
 *  - Precise: when the entry has a persisted `comicVineVolumeId` (only
 *    set when the entry was created via ComicVine autofill — see
 *    entrySchemas.ts) and an `issueStart`, links straight to that
 *    specific issue, ignoring `issueEnd` per the scoping decision.
 *  - Fallback: manually-created comics have no volume id, so the link
 *    instead carries just the series name — AddEntryPage re-runs a
 *    ComicVine series search from it on the receiving end, same as if
 *    the recipient had typed it into the search box themselves. Less
 *    precise (series only, no specific issue), but still better than
 *    the plain homepage link.
 */
function buildComicLink(entry: MediaEntry): string {
  const volumeId = entry.metadata.comicVineVolumeId;
  const issueStart = entry.metadata.issueStart;
  if (typeof volumeId === 'string' && volumeId && issueStart !== undefined && issueStart !== '') {
    const params = new URLSearchParams({ type: 'comic', id: volumeId, issue: String(issueStart) });
    return `${APP_URL}#${ROUTES.addEntry}?${params.toString()}`;
  }

  const series = entry.metadata.series;
  if (typeof series === 'string' && series.trim()) {
    const params = new URLSearchParams({ type: 'comic', series: series.trim() });
    return `${APP_URL}#${ROUTES.addEntry}?${params.toString()}`;
  }

  return APP_URL;
}

/**
 * Builds the link that goes at the end of a shared message. If the
 * entry's media type supports it and has a persisted source id, this
 * is a smart link straight to a pre-filled Add Entry screen
 * (`#/entry/new?type=...&id=...`); otherwise it's just the plain app
 * URL, same as before this feature existed.
 */
export function buildEntryLink(entry: MediaEntry): string {
  if (entry.mediaType === 'comic') return buildComicLink(entry);

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
 * "I finished watching Dune: Part Three (via Media Journal)"
 */
export function buildShareMessageLine(entry: MediaEntry): string {
  const verb = getConsumptionVerb(entry.mediaType);

  switch (entry.status) {
    case 'wishlist':
      return `I added ${entry.title} to my wishlist (via Media Journal)`;
    case 'in_progress':
      return `I started ${verb} ${entry.title} (via Media Journal)`;
    case 'completed':
    default:
      return `I finished ${verb} ${entry.title} (via Media Journal)`;
  }
}

/** Full share message: the message line, a newline, then the entry link
 * (a smart "add to journal" link when available, otherwise the plain
 * app URL — see buildEntryLink). */
export function buildShareMessage(entry: MediaEntry): string {
  return `${buildShareMessageLine(entry)}\n${buildEntryLink(entry)}`;
}
