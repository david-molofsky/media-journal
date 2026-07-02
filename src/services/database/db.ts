import Dexie, { type EntityTable } from 'dexie';
import type { MediaEntry, MediaType, AppSettingRecord, InProgressEntry, EntryMetadata } from '@/models';
import { defaultMediaTypes } from './defaultMediaTypes';

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

    /**
     * Version 8: adds five new default media types — Magazine Issues,
     * Video Games, Podcasts, Art, and Theatre — to `defaultMediaTypes.ts`.
     *
     * Fresh installs get all ten via seed.ts (which only runs when the
     * table is empty). Existing installs already have five rows in
     * `mediaTypes`, so seed.ts is a no-op for them — this migration adds
     * just the five new rows, keyed by id, and only if not already
     * present. This is deliberately additive-only: it never touches the
     * five pre-existing types, so any edits the user has already made to
     * them in Settings (name, colour, icon, fields, enabled state) are
     * left completely alone.
     */
    this.version(8).stores({
      mediaEntries:
        'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
      mediaTypes: 'id, enabled',
      appSettings: 'key',
      inProgressEntries: null,
    }).upgrade(async (tx) => {
      const newDefaults = defaultMediaTypes.filter((mt) =>
        ['magazine', 'game', 'podcast', 'art', 'theatre'].includes(mt.id),
      );
      const table = tx.table<MediaType>('mediaTypes');
      for (const mediaType of newDefaults) {
        const existing = await table.get(mediaType.id);
        if (!existing) {
          await table.add(mediaType);
        }
      }
    });

    /**
     * Version 9: adds a `source` metadata field ("Netflix", "Audible",
     * "Libby", etc.) to every media type — a free-solo autocomplete
     * (see FieldInputType, AutocompleteField.tsx) with per-type
     * suggestion lists, distinct from Tags per David's request.
     *
     * Fresh installs get it via seed.ts, since `defaultMediaTypes.ts`
     * now includes it on every type. For existing installs, this
     * migration appends a `source` field to every existing row in
     * `mediaTypes` that doesn't already have one — matched by key, so
     * it's a no-op for any row the user (unusually) already has a
     * same-keyed field on. It never removes or reorders existing
     * fields, so field-specific data already saved on entries is
     * unaffected. Built-in types get the tailored suggestion list from
     * `defaultMediaTypes.ts`; any user-created custom type gets a
     * small generic list as a starting point.
     */
    this.version(9).stores({
      mediaEntries:
        'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
      mediaTypes: 'id, enabled',
      appSettings: 'key',
      inProgressEntries: null,
    }).upgrade(async (tx) => {
      const genericSourceOptions = ['Physical', 'Streaming', 'Digital', 'Other'];
      const table = tx.table<MediaType>('mediaTypes');
      const allTypes = await table.toArray();

      for (const mediaType of allTypes) {
        const alreadyHasSource = mediaType.fields.some((f) => f.key === 'source');
        if (alreadyHasSource) continue;

        const defaultMatch = defaultMediaTypes.find((dmt) => dmt.id === mediaType.id);
        const sourceField = defaultMatch?.fields.find((f) => f.key === 'source') ?? {
          key: 'source',
          label: 'Source',
          type: 'autocomplete' as const,
          required: false,
          options: genericSourceOptions,
        };

        await table.put({ ...mediaType, fields: [...mediaType.fields, sourceField] });
      }
    });

    /**
     * Version 10: swaps the default accent colours for Art and Theatre
     * — Art becomes amber/yellow (#F9A825), Theatre becomes deep
     * pink/magenta (#C2185B); the reverse of what they launched with in
     * version 8. `defaultMediaTypes.ts` already reflects the new pair
     * for fresh installs.
     *
     * For existing installs, this only updates the colour if it still
     * exactly matches the *original* v8 default for that type — so if
     * David (or anyone) already customised Art's or Theatre's colour in
     * Settings, that customisation is left untouched rather than being
     * overwritten by this swap.
     */
    this.version(10).stores({
      mediaEntries:
        'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
      mediaTypes: 'id, enabled',
      appSettings: 'key',
      inProgressEntries: null,
    }).upgrade(async (tx) => {
      const table = tx.table<MediaType>('mediaTypes');
      const swaps: Record<string, { from: string; to: string }> = {
        art: { from: '#C2185B', to: '#F9A825' },
        theatre: { from: '#F9A825', to: '#C2185B' },
      };

      for (const [id, { from, to }] of Object.entries(swaps)) {
        const existing = await table.get(id);
        if (existing && existing.colour === from) {
          await table.update(id, { colour: to });
        }
      }
    });

    /**
     * Version 11: reorders the Source suggestion list for Film and TV —
     * Prime Video moves to 3rd, Theatrical to 4th, with the remaining
     * options keeping their prior relative order. This only reorders
     * the suggestions shown in the dropdown; it never touches any
     * Source value already saved on an entry.
     *
     * Guarded: only reorders if the field's current option set is
     * exactly the original eight values (regardless of order) — so if
     * this ever runs against a row that's diverged (e.g. a future
     * options-editing feature was used), it's left alone rather than
     * silently overwritten.
     */
    this.version(11).stores({
      mediaEntries:
        'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
      mediaTypes: 'id, enabled',
      appSettings: 'key',
      inProgressEntries: null,
    }).upgrade(async (tx) => {
      const table = tx.table<MediaType>('mediaTypes');
      const expectedSet = new Set([
        'Netflix', 'Disney+', 'Max', 'Hulu', 'Prime Video', 'Apple TV+', 'Theatrical', 'Physical Media',
      ]);
      const newOrder = ['Netflix', 'Disney+', 'Prime Video', 'Theatrical', 'Max', 'Hulu', 'Apple TV+', 'Physical Media'];

      for (const id of ['film', 'tv']) {
        const existing = await table.get(id);
        if (!existing) continue;

        const sourceField = existing.fields.find((f) => f.key === 'source');
        if (!sourceField?.options) continue;

        const currentSet = new Set(sourceField.options);
        const matchesExpected =
          currentSet.size === expectedSet.size &&
          [...expectedSet].every((v) => currentSet.has(v));
        if (!matchesExpected) continue;

        const updatedFields = existing.fields.map((f) =>
          f.key === 'source' ? { ...f, options: newOrder } : f,
        );
        await table.update(id, { fields: updatedFields });
      }
    });

    /**
     * Version 12: renames the "Prime Video" Source suggestion to
     * "Amazon Prime Video" for Film and TV. Updates both places the old
     * name could exist:
     *  - the suggestion list on the `source` field (Film/TV types)
     *  - any entry that already has `metadata.source === 'Prime Video'`
     *    saved from before this rename
     *
     * Renaming only the suggestion list and leaving old entries as
     * "Prime Video" would silently split what's really one service into
     * two different values in the Source filter — this keeps them
     * merged as a single value going forward.
     */
    this.version(12).stores({
      mediaEntries:
        'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
      mediaTypes: 'id, enabled',
      appSettings: 'key',
      inProgressEntries: null,
    }).upgrade(async (tx) => {
      const mediaTypesTable = tx.table<MediaType>('mediaTypes');
      const mediaEntriesTable = tx.table<MediaEntry>('mediaEntries');

      for (const id of ['film', 'tv']) {
        const existing = await mediaTypesTable.get(id);
        if (!existing) continue;

        const sourceField = existing.fields.find((f) => f.key === 'source');
        if (!sourceField?.options?.includes('Prime Video')) continue;

        const updatedFields = existing.fields.map((f) =>
          f.key === 'source'
            ? { ...f, options: f.options?.map((o) => (o === 'Prime Video' ? 'Amazon Prime Video' : o)) }
            : f,
        );
        await mediaTypesTable.update(id, { fields: updatedFields });
      }

      const entriesToRename = await mediaEntriesTable
        .filter((e) => e.metadata.source === 'Prime Video')
        .toArray();
      for (const entry of entriesToRename) {
        await mediaEntriesTable.update(entry.id, {
          metadata: { ...entry.metadata, source: 'Amazon Prime Video' },
        });
      }
    });
  }
}

export const db = new MediaJournalDatabase();
