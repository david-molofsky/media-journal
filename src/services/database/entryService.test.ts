import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import {
  createEntry,
  deleteEntriesWithSnapshot,
  getEntry,
  listEntries,
  MISSING_CATEGORY_FILTER_VALUE,
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

  it('filters entries with missing tags, source or rating', async () => {
    await createEntry(
      completedEntryInput({
        title: 'Missing fields',
        rating: undefined,
        metadata: {},
        tags: [],
      }),
    );
    await createEntry(
      completedEntryInput({
        title: 'Filled fields',
        rating: 8,
        metadata: { source: 'Cinema' },
        tags: ['Favourite'],
      }),
    );

    const missingTags = await listEntries({
      tags: [MISSING_CATEGORY_FILTER_VALUE],
    });
    const missingSources = await listEntries({
      sources: [MISSING_CATEGORY_FILTER_VALUE],
    });
    const missingRatings = await listEntries({ ratingMissing: true });
    const ratedEight = await listEntries({ rating: 8 });
    const taggedEntries = await listEntries({
      tagsExclude: [MISSING_CATEGORY_FILTER_VALUE],
    });

    expect(missingTags.map((entry) => entry.title)).toEqual(['Missing fields']);
    expect(missingSources.map((entry) => entry.title)).toEqual(['Missing fields']);
    expect(missingRatings.map((entry) => entry.title)).toEqual(['Missing fields']);
    expect(ratedEight.map((entry) => entry.title)).toEqual(['Filled fields']);
    expect(taggedEntries.map((entry) => entry.title)).toEqual(['Filled fields']);
  });
});
