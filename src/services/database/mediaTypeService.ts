import { db } from './db';
import type { MediaType, MediaTypeInput } from '@/models';

/** Lists all configured media types, enabled and disabled alike. Used
 * by Settings (Milestone 7) for management; most other consumers want
 * `listEnabledMediaTypes` instead. */
export async function listMediaTypes(): Promise<MediaType[]> {
  return db.mediaTypes.toArray();
}

/** Lists only media types currently available for new entries — what
 * the Add Entry media-type picker (Milestone 3) should render. */
export async function listEnabledMediaTypes(): Promise<MediaType[]> {
  const all = await db.mediaTypes.toArray();
  return all.filter((type) => type.enabled);
}

export async function getMediaType(id: string): Promise<MediaType | undefined> {
  return db.mediaTypes.get(id);
}

/** Creates or replaces a media type configuration. Adding a brand new
 * media type is exactly this: a new row, no code changes required
 * (Database Schema & Data Model, section 5). */
export async function upsertMediaType(input: MediaTypeInput): Promise<MediaType> {
  const mediaType: MediaType = { enabled: true, ...input };
  await db.mediaTypes.put(mediaType);
  return mediaType;
}

/** Disables a media type rather than deleting it outright, so existing
 * entries referencing it remain valid and viewable. */
export async function disableMediaType(id: string): Promise<void> {
  await db.mediaTypes.update(id, { enabled: false });
}

/** Toggles whether a media type is selectable for new entries
 * (Settings, Milestone 7: "Manage Media Types"). Existing entries
 * referencing a disabled type remain untouched and still viewable. */
export async function setMediaTypeEnabled(id: string, enabled: boolean): Promise<void> {
  await db.mediaTypes.update(id, { enabled });
}

/**
 * The five media types shipped with the app. These cannot be deleted
 * (Settings, Milestone 7) — only disabled — because entries reference
 * them by id and there is no migration path to reassign them. Custom
 * types added by the user are fully deletable.
 */
const DEFAULT_MEDIA_TYPE_IDS = new Set(['book', 'audiobook', 'film', 'tv', 'comic']);

export function isDefaultMediaType(id: string): boolean {
  return DEFAULT_MEDIA_TYPE_IDS.has(id);
}

/**
 * Permanently removes a custom media type. Throws if called on one of
 * the five built-in types — callers should gate the action behind
 * `isDefaultMediaType` before showing it in the UI.
 *
 * Existing entries that reference the deleted type are left intact;
 * they will still appear in the Library but their media type label
 * will fall back to the raw id string since the type row no longer
 * exists to resolve it.
 */
export async function deleteMediaType(id: string): Promise<void> {
  if (DEFAULT_MEDIA_TYPE_IDS.has(id)) {
    throw new Error(`Cannot delete built-in media type "${id}".`);
  }
  await db.mediaTypes.delete(id);
}
