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
