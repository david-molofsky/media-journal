import { db } from './db';
import { generateId } from '@/utils/id';
import { nowIso } from '@/utils/dateUtils';
import type { PodcastSubscription, NewPodcastSubscriptionInput } from '@/models';

export async function listPodcastSubscriptions(): Promise<PodcastSubscription[]> {
  const all = await db.podcastSubscriptions.toArray();
  return all.sort((a, b) => a.showTitle.localeCompare(b.showTitle));
}

export async function addPodcastSubscription(
  input: NewPodcastSubscriptionInput,
): Promise<PodcastSubscription> {
  const subscription: PodcastSubscription = {
    ...input,
    id: generateId(),
    createdAt: nowIso(),
  };
  await db.podcastSubscriptions.add(subscription);
  return subscription;
}

export async function removePodcastSubscription(id: string): Promise<void> {
  await db.podcastSubscriptions.delete(id);
}

export async function touchPodcastSubscriptionLastChecked(id: string): Promise<void> {
  await db.podcastSubscriptions.update(id, { lastCheckedAt: nowIso() });
}

/** Added for "Find Next in Series" (see chat, Aug 2026) — resolves a
 * stored `podcastSubscriptionId` back to its feed URL, needed to
 * re-fetch the feed and find the next episode. */
export async function getPodcastSubscription(id: string): Promise<PodcastSubscription | undefined> {
  return db.podcastSubscriptions.get(id);
}
