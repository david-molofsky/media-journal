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
  updateEntryStatus,
} from './entryService';
import { completedEntryInput } from '@/test/factories';
import { getRecentEntries } from '@/services/statistics/statisticsService';
import { SETTINGS_KEYS } from '@/models';

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
    expect((await db.appSettings.get(SETTINGS_KEYS.entryDeletionEvents))?.value).toEqual([
      expect.objectContaining({ id: created.id, undone: false }),
    ]);

    await restoreEntriesSnapshot(snapshot);
    expect(await getEntry(created.id)).toEqual(updated);
    expect((await db.appSettings.get(SETTINGS_KEYS.entryDeletionEvents))?.value).toEqual([
      expect.objectContaining({ id: created.id, undone: true }),
    ]);
  });

  it('records an exact completion timestamp when an entry is created as completed', async () => {
    const created = await createEntry(
      completedEntryInput({ title: 'Completed immediately' }),
    );

    expect(created.completedAt).toBeDefined();
    expect(created.completedAt).toBe(created.createdAt);
    expect(Number.isNaN(Date.parse(created.completedAt!))).toBe(false);
  });

  it('records the moment an in-progress entry is marked completed', async () => {
    const created = await createEntry({
      ...completedEntryInput({ title: 'Finished later' }),
      status: 'in_progress',
      completedDate: undefined,
    });

    expect(created.completedAt).toBeUndefined();

    await updateEntryStatus(created.id, 'completed', '2026-10-30');
    const completed = await getEntry(created.id);

    expect(completed?.completedAt).toBeDefined();
    expect(completed?.completedAt).toBe(completed?.updatedAt);
    expect(Number.isNaN(Date.parse(completed!.completedAt!))).toBe(false);
  });

  it('does not persist an invalid completed entry', async () => {
    await expect(
      createEntry(completedEntryInput({ completedDate: undefined })),
    ).rejects.toThrow('Completed date is required');
    expect(await db.mediaEntries.count()).toBe(0);
  });

  it('keeps completion months chronological and orders entries within a date by completion timestamp', async () => {
    await db.mediaEntries.bulkAdd([
      {
        ...completedEntryInput({ title: 'October', completedDate: '2026-10-01' }),
        id: 'october',
        completedAt: '2026-10-01T08:00:00Z',
        createdAt: '2026-10-01T08:00:00Z',
        updatedAt: '2026-10-01T08:00:00Z',
      },
      {
        ...completedEntryInput({ title: 'September first', completedDate: '2026-09-30' }),
        id: 'september-first',
        completedAt: '2026-09-30T09:00:00Z',
        createdAt: '2026-09-30T11:00:00Z',
        updatedAt: '2026-09-30T09:00:00Z',
      },
      {
        ...completedEntryInput({
          title: 'September latest',
          completedDate: '2026-09-30',
        }),
        id: 'september-latest',
        completedAt: '2026-09-30T12:00:00Z',
        createdAt: '2026-09-30T08:00:00Z',
        updatedAt: '2026-09-30T12:00:00Z',
      },
    ]);

    expect(
      (await listEntries({}, 'completedDateDesc')).map(({ title }) => title),
    ).toEqual(['October', 'September latest', 'September first']);
    expect((await listEntries({}, 'completedDateAsc')).map(({ title }) => title)).toEqual(
      ['September first', 'September latest', 'October'],
    );
    expect((await getRecentEntries(2)).map(({ title }) => title)).toEqual([
      'October',
      'September latest',
    ]);
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
