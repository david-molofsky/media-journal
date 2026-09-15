import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import {
  createEntry,
  deleteEntriesWithSnapshot,
  getEntry,
  restoreEntriesSnapshot,
  updateEntry,
} from './entryService';
import { completedEntryInput } from '@/test/factories';

describe('entry service journeys', () => {
  beforeEach(async () => {
    db.close();
    await db.delete();
    await db.open();
  });

  afterAll(async () => {
    db.close();
    await db.delete();
  });

  it('creates, edits, deletes and restores an entry', async () => {
    const created = await createEntry(
      completedEntryInput({ title: 'Original', completedDate: '2025-12-31' }),
    );
    expect(created.completedYear).toBe(2025);

    const updated = await updateEntry(created.id, {
      title: 'Updated',
      completedDate: '2026-01-02',
    });
    expect(updated).toMatchObject({ title: 'Updated', completedYear: 2026 });

    const snapshot = await deleteEntriesWithSnapshot([created.id]);
    expect(await getEntry(created.id)).toBeUndefined();

    await restoreEntriesSnapshot(snapshot);
    expect(await getEntry(created.id)).toEqual(updated);
  });

  it('does not persist an invalid completed entry', async () => {
    await expect(
      createEntry(completedEntryInput({ completedDate: undefined })),
    ).rejects.toThrow('Completed date is required');
    expect(await db.mediaEntries.count()).toBe(0);
  });
});
