import type { ExportPayload } from '@/services/importExport/importExportService';
import type { MediaEntry, MediaType, PodcastSubscription } from '@/models';

function compareIds(left: { id: string }, right: { id: string }): number {
  return left.id.localeCompare(right.id);
}

function canonicalSnapshot(snapshot: ExportPayload): unknown {
  return {
    version: snapshot.version,
    entries: [...snapshot.entries].sort(compareIds),
    mediaTypes: [...snapshot.mediaTypes].sort(compareIds),
    podcastSubscriptions: [...snapshot.podcastSubscriptions].sort(compareIds),
    settings: Object.fromEntries(
      Object.entries(snapshot.settings).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  };
}

export async function calculateJournalHash(snapshot: ExportPayload): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalSnapshot(snapshot)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function newestEntry(cloud: MediaEntry, local: MediaEntry): MediaEntry {
  return local.updatedAt > cloud.updatedAt ? local : cloud;
}

function newestSubscription(
  cloud: PodcastSubscription,
  local: PodcastSubscription,
): PodcastSubscription {
  const cloudDate = cloud.lastCheckedAt ?? cloud.createdAt;
  const localDate = local.lastCheckedAt ?? local.createdAt;
  return localDate > cloudDate ? local : cloud;
}

function mergeById<T extends { id: string }>(
  localItems: T[],
  cloudItems: T[],
  choose: (cloud: T, local: T) => T = (cloud) => cloud,
): T[] {
  const merged = new Map(localItems.map((item) => [item.id, item]));
  for (const cloudItem of cloudItems) {
    const localItem = merged.get(cloudItem.id);
    merged.set(cloudItem.id, localItem ? choose(cloudItem, localItem) : cloudItem);
  }
  return [...merged.values()].sort(compareIds);
}

/**
 * Produces a non-destructive conflict merge. Unique records from both devices
 * survive. Matching entries use their updatedAt timestamps; cloud values win
 * ties and matching journal-definition/preferences records.
 */
export function mergeJournalSnapshots(
  cloud: ExportPayload,
  local: ExportPayload,
): ExportPayload {
  return {
    version: Math.max(cloud.version, local.version),
    exportedAt: new Date().toISOString(),
    entries: mergeById(local.entries, cloud.entries, newestEntry),
    mediaTypes: mergeById<MediaType>(local.mediaTypes, cloud.mediaTypes),
    podcastSubscriptions: mergeById<PodcastSubscription>(
      local.podcastSubscriptions,
      cloud.podcastSubscriptions,
      newestSubscription,
    ),
    settings: { ...local.settings, ...cloud.settings },
  };
}
