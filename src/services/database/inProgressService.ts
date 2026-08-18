import { db } from './db';
import { generateId } from '@/utils/id';
import { nowIso, todayIso } from '@/utils/dateUtils';
import { createEntry } from './entryService';
import type { InProgressEntry, NewInProgressInput, NewMediaEntryInput, MediaEntry } from '@/models';

export async function listInProgressEntries(): Promise<InProgressEntry[]> {
  return db.inProgressEntries.orderBy('createdAt').reverse().toArray();
}

export async function createInProgressEntry(
  input: NewInProgressInput,
): Promise<InProgressEntry> {
  const now = nowIso();
  const entry: InProgressEntry = {
    ...input,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  await db.inProgressEntries.add(entry);
  return entry;
}

export async function updateInProgressEntry(
  id: string,
  patch: Partial<NewInProgressInput>,
): Promise<void> {
  await db.inProgressEntries.update(id, { ...patch, updatedAt: nowIso() });
}

export async function deleteInProgressEntry(id: string): Promise<void> {
  await db.inProgressEntries.delete(id);
}

/**
 * Converts an in-progress entry into a completed library entry.
 * Creates the `MediaEntry` (with today as the default completed date),
 * then deletes the in-progress record. Returns the new entry so the
 * caller can navigate to it for rating/notes.
 *
 * `rating` is optional — the quick-action completion dialog captures
 * it up front (see chat, Aug 2026), but the caller still lands on the
 * full edit form afterward, pre-filled, in case they want to adjust
 * it or add notes.
 */
export async function finishInProgressEntry(
  id: string,
  completedDate: string = todayIso(),
  rating?: number,
): Promise<MediaEntry> {
  const inProgress = await db.inProgressEntries.get(id);
  if (!inProgress) throw new Error(`In-progress entry not found: ${id}`);

  const input: NewMediaEntryInput = {
    title: inProgress.title,
    mediaType: inProgress.mediaType,
    status: 'completed',
    startedDate: inProgress.startedDate,
    completedDate,
    rating,
    notes: inProgress.notes,
    repeatConsumption: false,
    tags: inProgress.tags,
    // InProgressEntry predates the Genre field and doesn't track it;
    // default to empty, same as a fresh entry would.
    genres: [],
    metadata: inProgress.metadata,
  };

  const created = await createEntry(input);
  await db.inProgressEntries.delete(id);
  return created;
}
