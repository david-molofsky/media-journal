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

  it('upgrades version 29 entries with the version 30 companion fields', async () => {
    db.close();
    await Dexie.delete('MediaJournalDatabase');

    const legacy = new Dexie('MediaJournalDatabase');
    legacy.version(29).stores(VERSION_29_SCHEMA);
    await legacy.open();
    const legacyEntry = storedEntry() as unknown as Record<string, unknown>;
    delete legacyEntry.watchedWith;
    delete legacyEntry.recommendedBy;
    await legacy.table('mediaEntries').add(legacyEntry);
    legacy.close();

    await db.open();
    const migrated = await db.mediaEntries.get('entry-1');

    expect(db.verno).toBe(30);
    expect(migrated?.watchedWith).toEqual([]);
    expect(migrated?.recommendedBy).toEqual([]);
  });
});
