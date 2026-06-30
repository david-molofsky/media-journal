import Dexie, { type EntityTable } from 'dexie';
import type { MediaEntry, MediaType, AppSettingRecord } from '@/models';

/**
 * Media Journal's IndexedDB database, accessed via Dexie.
 *
 * Schema follows the Database Schema & Data Model document, section 2
 * (Database Overview) and section 12 (Indexing Strategy).
 *
 * Indexes on `mediaEntries`:
 *  - `completedDate`, `mediaType`, `title`, `rating` — single-column
 *    indexes for the most common Library queries (search, filter, sort).
 *  - `[completedYear+mediaType]` and `[completedDate+rating]` — composite
 *    indexes for the year+type and date+rating queries called out
 *    explicitly in the schema document.
 *
 * Note: `completedYear` is a derived value (see models/MediaEntry.ts)
 * stored redundantly purely so it can be indexed; IndexedDB has no way
 * to index a value computed at query time.
 */
export class MediaJournalDatabase extends Dexie {
  mediaEntries!: EntityTable<MediaEntry, 'id'>;
  mediaTypes!: EntityTable<MediaType, 'id'>;
  appSettings!: EntityTable<AppSettingRecord, 'key'>;

  constructor() {
    super('MediaJournalDatabase');

    this.version(1).stores({
      mediaEntries:
        'id, completedDate, mediaType, title, rating, completedYear, [completedYear+mediaType], [completedDate+rating]',
      mediaTypes: 'id, enabled',
      appSettings: 'key',
    });
  }
}

export const db = new MediaJournalDatabase();
