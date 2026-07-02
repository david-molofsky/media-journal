import Dexie, { type EntityTable } from 'dexie';
import type { MediaEntry, MediaType, AppSettingRecord, InProgressEntry, EntryMetadata } from '@/models';

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
  inProgressEntries!: EntityTable<InProgressEntry, 'id'>;

  constructor() {
    super('MediaJournalDatabase');

    this.version(1).stores({
      mediaEntries:
        'id, completedDate, mediaType, title, rating, completedYear, [completedYear+mediaType], [completedDate+rating]',
      mediaTypes: 'id, enabled',
      appSettings: 'key',
    });

    /**
     * Version 2: removes the `showTitle` metadata field from the TV
     * media type. The field was redundant — the entry's `title` already
     * captures the show name (see defaultMediaTypes.ts). Existing
     * entries that stored a `showTitle` value in `metadata` are left
     * untouched (the key simply becomes inert), since deleting stored
     * data during a migration is irreversible and the value is never
     * read again after this point.
     */
    this.version(2).stores({
      mediaEntries:
        'id, completedDate, mediaType, title, rating, completedYear, [completedYear+mediaType], [completedDate+rating]',
      mediaTypes: 'id, enabled',
      appSettings: 'key',
    }).upgrade(async (tx) => {
      const tv = await tx.table<MediaType>('mediaTypes').get('tv');
      if (tv) {
        const patched: MediaType = {
          ...tv,
          fields: tv.fields.filter((field) => field.key !== 'showTitle'),
        };
        await tx.table('mediaTypes').put(patched);
      }
    });

    /**
     * Version 3: adds `episodeStart` and `episodeEnd` fields to the TV
     * media type, enabling episode-range tracking when the user enables
     * "episode mode" in Settings. The new fields are optional and hidden
     * in season mode, so existing season-based entries are unaffected.
     */
    this.version(3).stores({
      mediaEntries:
        'id, completedDate, mediaType, title, rating, completedYear, [completedYear+mediaType], [completedDate+rating]',
      mediaTypes: 'id, enabled',
      appSettings: 'key',
    }).upgrade(async (tx) => {
      const tv = await tx.table<MediaType>('mediaTypes').get('tv');
      if (tv) {
        const existingKeys = new Set(tv.fields.map((f) => f.key));
        const toAdd: MediaType['fields'] = [];
        if (!existingKeys.has('episodeStart')) {
          toAdd.push({ key: 'episodeStart', label: 'Episode Start', type: 'number', required: false });
        }
        if (!existingKeys.has('episodeEnd')) {
          toAdd.push({ key: 'episodeEnd', label: 'Episode End', type: 'number', required: false });
        }
        if (toAdd.length > 0) {
          await tx.table('mediaTypes').put({ ...tv, fields: [...tv.fields, ...toAdd] });
        }
      }
    });

    /**
     * Version 4: adds user-defined tags to entries.
     *   • `*tags` multiEntry index lets Dexie query entries by tag
     *     efficiently using `.where('tags').equals(tag)`.
     *   • Existing entries are migrated to `tags: []` so the index is
     *     consistent from the start.
     *   • Film gains `screenwriter` and `cast` fields.
     *   • TV gains `creator`, `showrunner` and `cast` fields.
     */
    this.version(4).stores({
      mediaEntries:
        'id, completedDate, mediaType, title, rating, completedYear, [completedYear+mediaType], [completedDate+rating]',
      mediaTypes: 'id, enabled',
      appSettings: 'key',
    }).upgrade(async (tx) => {
      await tx.table('mediaEntries').toCollection().modify((entry: MediaEntry) => {
        if (!Array.isArray(entry.tags)) {
          entry.tags = [];
        }
      });

      const film = await tx.table<MediaType>('mediaTypes').get('film');
      if (film) {
        const existingKeys = new Set(film.fields.map((f) => f.key));
        const toAdd: MediaType['fields'] = [];
        if (!existingKeys.has('screenwriter')) toAdd.push({ key: 'screenwriter', label: 'Screenwriter', type: 'text', required: false });
        if (!existingKeys.has('cast')) toAdd.push({ key: 'cast', label: 'Cast', type: 'text', required: false });
        if (toAdd.length > 0) await tx.table('mediaTypes').put({ ...film, fields: [...film.fields, ...toAdd] });
      }

      const tv = await tx.table<MediaType>('mediaTypes').get('tv');
      if (tv) {
        const existingKeys = new Set(tv.fields.map((f) => f.key));
        const toAdd: MediaType['fields'] = [];
        if (!existingKeys.has('creator')) toAdd.push({ key: 'creator', label: 'Creator', type: 'text', required: false });
        if (!existingKeys.has('showrunner')) toAdd.push({ key: 'showrunner', label: 'Showrunner', type: 'text', required: false });
        if (!existingKeys.has('cast')) toAdd.push({ key: 'cast', label: 'Cast', type: 'text', required: false });
        if (toAdd.length > 0) await tx.table('mediaTypes').put({ ...tv, fields: [...tv.fields, ...toAdd] });
      }
    });

    /**
     * Version 5: adds the `inProgressEntries` table for currently-
     * reading/watching items (Phase 8) and adds `createdAt` to the
     * `mediaEntries` index so the Library can sort by "Date added".
     */
    this.version(5).stores({
      mediaEntries:
        'id, completedDate, mediaType, title, rating, completedYear, createdAt, [completedYear+mediaType], [completedDate+rating]',
      mediaTypes: 'id, enabled',
      appSettings: 'key',
      inProgressEntries: 'id, mediaType, createdAt',
    });

    /**
     * Version 6: introduces `status` on `mediaEntries`, replacing the
     * separate `inProgressEntries` table.
     *   • Existing entries get `status: 'completed'`.
     *   • `inProgressEntries` rows are copied in with `status: 'in_progress'`.
     *   • `inProgressEntries` table is dropped.
     */
    this.version(6).stores({
      mediaEntries:
        'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
      mediaTypes: 'id, enabled',
      appSettings: 'key',
      inProgressEntries: null,
    }).upgrade(async (tx) => {
      await tx.table('mediaEntries').toCollection().modify((entry: MediaEntry) => {
        if (!entry.status) entry.status = 'completed';
      });

      try {
        const inProgress = await tx.table('inProgressEntries').toArray();
        if (inProgress.length > 0) {
          const now = new Date().toISOString();
          await tx.table('mediaEntries').bulkAdd(
            inProgress.map((entry: Record<string, unknown>) => ({
              id: entry['id'] as string,
              title: entry['title'] as string,
              mediaType: entry['mediaType'] as string,
              status: 'in_progress' as const,
              startedDate: entry['startedDate'] as string | undefined,
              completedDate: undefined,
              completedYear: undefined,
              rating: undefined,
              notes: entry['notes'] as string | undefined,
              repeatConsumption: false,
              tags: Array.isArray(entry['tags']) ? (entry['tags'] as string[]) : [],
              metadata: (entry['metadata'] as EntryMetadata) ?? {},
              createdAt: (entry['createdAt'] as string) ?? now,
              updatedAt: now,
            })),
          );
        }
      } catch {
        // inProgressEntries may not exist on installs that skipped v5.
      }
    });

    /**
     * Version 7: removes the `*tags` multiEntry index.
     *
     * The index was introduced in v4 but `multiEntry: true` on fields
     * that contain empty arrays triggers a DataError in iOS Safari ≤ 15,
     * preventing the database from opening at all on those devices.
     * Tag filtering is done in-memory in entryService.ts so the index
     * was never needed for correctness — only for theoretical query
     * performance that doesn't matter at journal-scale entry counts.
     *
     * Removing it from v4/v5/v6 schema strings above means fresh
     * installs never create it. This v7 upgrade drops it for any
     * existing desktop user who already has the index from v4.
     */
    this.version(7).stores({
      mediaEntries:
        'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
      mediaTypes: 'id, enabled',
      appSettings: 'key',
      inProgressEntries: null,
    });
  }
}

export const db = new MediaJournalDatabase();
