import { db } from './db';
import { nowIso, todayIso, yearOf } from '@/utils/dateUtils';
import { createEntry } from './entryService';
import type { NewInProgressInput, NewMediaEntryInput, MediaEntry } from '@/models';

export async function listInProgressEntries(): Promise<MediaEntry[]> {
  const entries = await db.mediaEntries.where('status').equals('in_progress').toArray();
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createInProgressEntry(
  input: NewInProgressInput,
): Promise<MediaEntry> {
  const entryInput: NewMediaEntryInput = {
    ...input,
    status: 'in_progress',
    completedDate: undefined,
    rating: undefined,
    repeatConsumption: false,
    genres: [],
    watchedWith: [],
    recommendedBy: [],
  };
  return createEntry(entryInput);
}

export async function updateInProgressEntry(
  id: string,
  patch: Partial<NewInProgressInput>,
): Promise<void> {
  await db.transaction('rw', db.mediaEntries, async () => {
    const entry = await db.mediaEntries.get(id);
    if (!entry || entry.status !== 'in_progress') {
      throw new Error(`In-progress entry not found: ${id}`);
    }
    await db.mediaEntries.update(id, { ...patch, updatedAt: nowIso() });
  });
}

export async function deleteInProgressEntry(id: string): Promise<void> {
  await db.transaction('rw', db.mediaEntries, async () => {
    const entry = await db.mediaEntries.get(id);
    if (!entry || entry.status !== 'in_progress') {
      throw new Error(`In-progress entry not found: ${id}`);
    }
    await db.mediaEntries.delete(id);
  });
}

/** Captures the exact record before removal so the UI can offer Undo. */
export async function deleteInProgressEntryWithSnapshot(
  id: string,
): Promise<MediaEntry | undefined> {
  return db.transaction('rw', db.mediaEntries, async () => {
    const entry = await db.mediaEntries.get(id);
    if (!entry || entry.status !== 'in_progress') return undefined;
    await db.mediaEntries.delete(id);
    return entry;
  });
}

export async function restoreInProgressEntry(entry: MediaEntry): Promise<void> {
  if (entry.status !== 'in_progress') {
    throw new Error(`Cannot restore non-in-progress entry: ${entry.id}`);
  }
  await db.mediaEntries.put(entry);
}

/**
 * Converts an in-progress entry into a completed library entry in
 * place. Since v6 all lifecycle states share `mediaEntries`; updating
 * the existing row preserves its id, metadata, tags and timestamps.
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
  return db.transaction('rw', db.mediaEntries, async () => {
    const inProgress = await db.mediaEntries.get(id);
    if (!inProgress || inProgress.status !== 'in_progress') {
      throw new Error(`In-progress entry not found: ${id}`);
    }

    const finished: MediaEntry = {
      ...inProgress,
      status: 'completed',
      completedDate,
      completedYear: yearOf(completedDate),
      rating,
      updatedAt: nowIso(),
    };
    await db.mediaEntries.put(finished);
    return finished;
  });
}
