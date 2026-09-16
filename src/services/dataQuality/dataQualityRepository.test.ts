import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/services/database/db';
import { storedEntry } from '@/test/factories';
import { mergeDuplicateEntries, normalizeEntryValues } from './dataQualityRepository';

describe('data quality normalization', () => {
  beforeEach(async () => {
    db.close();
    await db.delete();
    await db.open();
  });

  afterAll(async () => {
    db.close();
    await db.delete();
  });

  it('normalizes sources, genres and tags without creating duplicate list values', async () => {
    await db.mediaEntries.bulkPut([
      storedEntry({
        id: 'one',
        metadata: { source: 'Prime Video' },
        genres: ['sci fi', 'Sci-Fi'],
        tags: ['space-opera', 'Space Opera'],
      }),
      storedEntry({ id: 'two', title: 'Arrival', metadata: { source: 'Netflix' } }),
    ]);

    expect(
      await normalizeEntryValues('source', ['Prime Video'], 'Amazon Prime Video'),
    ).toBe(1);
    expect(await normalizeEntryValues('genre', ['sci fi'], 'Sci-Fi')).toBe(1);
    expect(await normalizeEntryValues('tag', ['space-opera'], 'Space Opera')).toBe(1);

    const [first, second] = await db.mediaEntries.bulkGet(['one', 'two']);
    expect(first).toMatchObject({
      metadata: { source: 'Amazon Prime Video' },
      genres: ['Sci-Fi'],
      tags: ['Space Opera'],
    });
    expect(second?.metadata.source).toBe('Netflix');
  });

  it('merges complementary duplicate data and deletes only the duplicate records', async () => {
    await db.mediaEntries.bulkPut([
      storedEntry({
        id: 'keep',
        title: 'Dune',
        tags: ['Favourite'],
        notes: 'Keeper note',
      }),
      storedEntry({
        id: 'remove',
        title: 'Dune',
        genres: ['Sci-Fi'],
        notes: 'Imported note',
        metadata: { source: 'Cinema', tmdbId: 438631 },
      }),
      storedEntry({ id: 'unrelated', title: 'Arrival' }),
    ]);

    const merged = await mergeDuplicateEntries(['keep', 'remove'], 'keep');

    expect(merged).toMatchObject({
      id: 'keep',
      tags: ['Favourite'],
      genres: ['Sci-Fi'],
      notes: 'Keeper note\n\nImported note',
      metadata: { source: 'Cinema', tmdbId: 438631 },
    });
    expect(await db.mediaEntries.get('remove')).toBeUndefined();
    expect(await db.mediaEntries.get('unrelated')).toBeDefined();
  });
});
