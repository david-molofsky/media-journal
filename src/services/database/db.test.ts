import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { storedEntry } from '@/test/factories';

const VERSION_29_SCHEMA = {
  mediaEntries:
    'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
  mediaTypes: 'id, enabled',
  appSettings: 'key',
  inProgressEntries: null,
  podcastSubscriptions: 'id, feedUrl, createdAt',
};

describe('database migrations', () => {
  afterEach(async () => {
    db.close();
    await db.delete();
  });

  it('upgrades version 29 entries with companion fields and dated repeat flags', async () => {
    db.close();
    await Dexie.delete('MediaJournalDatabase');

    const legacy = new Dexie('MediaJournalDatabase');
    legacy.version(29).stores(VERSION_29_SCHEMA);
    await legacy.open();
    const legacyEntry = storedEntry() as unknown as Record<string, unknown>;
    delete legacyEntry.watchedWith;
    delete legacyEntry.recommendedBy;
    await legacy
      .table('mediaEntries')
      .bulkAdd([
        storedEntry({ id: 'original', completedDate: '2026-09-14' }),
        legacyEntry,
        storedEntry({ id: 'same-day', completedDate: '2026-09-15' }),
      ]);
    await legacy.table('mediaTypes').add({
      id: 'audiobook',
      displayName: 'Audiobook',
      icon: 'headphones',
      colour: '#7B1FA2',
      enabled: true,
      fields: [
        { key: 'author', label: 'Author', type: 'text', required: false },
        { key: 'series', label: 'Series', type: 'text', required: false },
      ],
    });
    legacy.close();

    await db.open();
    const migrated = await db.mediaEntries.get('entry-1');
    const audiobook = await db.mediaTypes.get('audiobook');

    expect(db.verno).toBe(32);
    expect(audiobook?.fields.map((field) => field.key)).toEqual([
      'author',
      'narrator',
      'series',
    ]);
    expect(migrated?.watchedWith).toEqual([]);
    expect(migrated?.recommendedBy).toEqual([]);
    expect(migrated?.repeatConsumption).toBe(true);
    expect((await db.mediaEntries.get('original'))?.repeatConsumption).toBe(false);
    expect((await db.mediaEntries.get('same-day'))?.repeatConsumption).toBe(true);
  });
});
