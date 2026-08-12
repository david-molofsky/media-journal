import Dexie, { type EntityTable } from 'dexie';
import type {
  MediaEntry,
  MediaType,
  AppSettingRecord,
  InProgressEntry,
  EntryMetadata,
  PodcastSubscription,
} from '@/models';
import { defaultMediaTypes } from './defaultMediaTypes';
import { mapOpenLibrarySubjectsToGenres } from '@/utils/openLibraryGenreMap';

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
  podcastSubscriptions!: EntityTable<PodcastSubscription, 'id'>;

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
    this.version(2)
      .stores({
        mediaEntries:
          'id, completedDate, mediaType, title, rating, completedYear, [completedYear+mediaType], [completedDate+rating]',
        mediaTypes: 'id, enabled',
        appSettings: 'key',
      })
      .upgrade(async (tx) => {
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
    this.version(3)
      .stores({
        mediaEntries:
          'id, completedDate, mediaType, title, rating, completedYear, [completedYear+mediaType], [completedDate+rating]',
        mediaTypes: 'id, enabled',
        appSettings: 'key',
      })
      .upgrade(async (tx) => {
        const tv = await tx.table<MediaType>('mediaTypes').get('tv');
        if (tv) {
          const existingKeys = new Set(tv.fields.map((f) => f.key));
          const toAdd: MediaType['fields'] = [];
          if (!existingKeys.has('episodeStart')) {
            toAdd.push({
              key: 'episodeStart',
              label: 'Episode Start',
              type: 'number',
              required: false,
            });
          }
          if (!existingKeys.has('episodeEnd')) {
            toAdd.push({
              key: 'episodeEnd',
              label: 'Episode End',
              type: 'number',
              required: false,
            });
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
    this.version(4)
      .stores({
        mediaEntries:
          'id, completedDate, mediaType, title, rating, completedYear, [completedYear+mediaType], [completedDate+rating]',
        mediaTypes: 'id, enabled',
        appSettings: 'key',
      })
      .upgrade(async (tx) => {
        await tx
          .table('mediaEntries')
          .toCollection()
          .modify((entry: MediaEntry) => {
            if (!Array.isArray(entry.tags)) {
              entry.tags = [];
            }
          });

        const film = await tx.table<MediaType>('mediaTypes').get('film');
        if (film) {
          const existingKeys = new Set(film.fields.map((f) => f.key));
          const toAdd: MediaType['fields'] = [];
          if (!existingKeys.has('screenwriter'))
            toAdd.push({
              key: 'screenwriter',
              label: 'Screenwriter',
              type: 'text',
              required: false,
            });
          if (!existingKeys.has('cast'))
            toAdd.push({ key: 'cast', label: 'Cast', type: 'text', required: false });
          if (toAdd.length > 0)
            await tx
              .table('mediaTypes')
              .put({ ...film, fields: [...film.fields, ...toAdd] });
        }

        const tv = await tx.table<MediaType>('mediaTypes').get('tv');
        if (tv) {
          const existingKeys = new Set(tv.fields.map((f) => f.key));
          const toAdd: MediaType['fields'] = [];
          if (!existingKeys.has('creator'))
            toAdd.push({
              key: 'creator',
              label: 'Creator',
              type: 'text',
              required: false,
            });
          if (!existingKeys.has('showrunner'))
            toAdd.push({
              key: 'showrunner',
              label: 'Showrunner',
              type: 'text',
              required: false,
            });
          if (!existingKeys.has('cast'))
            toAdd.push({ key: 'cast', label: 'Cast', type: 'text', required: false });
          if (toAdd.length > 0)
            await tx.table('mediaTypes').put({ ...tv, fields: [...tv.fields, ...toAdd] });
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
    this.version(6)
      .stores({
        mediaEntries:
          'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
        mediaTypes: 'id, enabled',
        appSettings: 'key',
        inProgressEntries: null,
      })
      .upgrade(async (tx) => {
        await tx
          .table('mediaEntries')
          .toCollection()
          .modify((entry: MediaEntry) => {
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
    this.version(8)
      .stores({
        mediaEntries:
          'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
        mediaTypes: 'id, enabled',
        appSettings: 'key',
        inProgressEntries: null,
      })
      .upgrade(async (tx) => {
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
    this.version(9)
      .stores({
        mediaEntries:
          'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
        mediaTypes: 'id, enabled',
        appSettings: 'key',
        inProgressEntries: null,
      })
      .upgrade(async (tx) => {
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
    this.version(10)
      .stores({
        mediaEntries:
          'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
        mediaTypes: 'id, enabled',
        appSettings: 'key',
        inProgressEntries: null,
      })
      .upgrade(async (tx) => {
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
    this.version(11)
      .stores({
        mediaEntries:
          'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
        mediaTypes: 'id, enabled',
        appSettings: 'key',
        inProgressEntries: null,
      })
      .upgrade(async (tx) => {
        const table = tx.table<MediaType>('mediaTypes');
        const expectedSet = new Set([
          'Netflix',
          'Disney+',
          'Max',
          'Hulu',
          'Prime Video',
          'Apple TV+',
          'Theatrical',
          'Physical Media',
        ]);
        const newOrder = [
          'Netflix',
          'Disney+',
          'Prime Video',
          'Theatrical',
          'Max',
          'Hulu',
          'Apple TV+',
          'Physical Media',
        ];

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
    this.version(12)
      .stores({
        mediaEntries:
          'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
        mediaTypes: 'id, enabled',
        appSettings: 'key',
        inProgressEntries: null,
      })
      .upgrade(async (tx) => {
        const mediaTypesTable = tx.table<MediaType>('mediaTypes');
        const mediaEntriesTable = tx.table<MediaEntry>('mediaEntries');

        for (const id of ['film', 'tv']) {
          const existing = await mediaTypesTable.get(id);
          if (!existing) continue;

          const sourceField = existing.fields.find((f) => f.key === 'source');
          if (!sourceField?.options?.includes('Prime Video')) continue;

          const updatedFields = existing.fields.map((f) =>
            f.key === 'source'
              ? {
                  ...f,
                  options: f.options?.map((o) =>
                    o === 'Prime Video' ? 'Amazon Prime Video' : o,
                  ),
                }
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

    /**
     * Version 13: adds "Digital" to the Source suggestion list for
     * Film, TV, and Comic Issues (per David's request — a generic
     * catch-all distinct from the existing platform-specific options).
     * Magazine Issues is deliberately left untouched here even though
     * it normally mirrors Comic, since only Comics was requested.
     *
     * Guarded: only appends if "Digital" isn't already present in that
     * type's source options — a no-op if the user already added it
     * themselves via a future options-editing feature.
     */
    this.version(13)
      .stores({
        mediaEntries:
          'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
        mediaTypes: 'id, enabled',
        appSettings: 'key',
        inProgressEntries: null,
      })
      .upgrade(async (tx) => {
        const table = tx.table<MediaType>('mediaTypes');

        for (const id of ['film', 'tv', 'comic']) {
          const existing = await table.get(id);
          if (!existing) continue;

          const sourceField = existing.fields.find((f) => f.key === 'source');
          if (!sourceField?.options || sourceField.options.includes('Digital')) continue;

          const updatedFields = existing.fields.map((f) =>
            f.key === 'source' ? { ...f, options: [...(f.options ?? []), 'Digital'] } : f,
          );
          await table.update(id, { fields: updatedFields });
        }
      });

    /**
     * Version 14: adds "Humble Bundle" to the Comic Issues Source
     * suggestion list, inserted immediately after "Physical" (per
     * David's request). Only Comic Issues is touched — Magazine
     * Issues, though it normally mirrors Comic, is deliberately left
     * alone since only Comics was requested.
     *
     * Guarded: only inserts if "Humble Bundle" isn't already present
     * and "Physical" is found in the options — a no-op otherwise, so a
     * row that's diverged (e.g. user already customised it) is left
     * untouched.
     */
    this.version(14)
      .stores({
        mediaEntries:
          'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
        mediaTypes: 'id, enabled',
        appSettings: 'key',
        inProgressEntries: null,
      })
      .upgrade(async (tx) => {
        const table = tx.table<MediaType>('mediaTypes');
        const existing = await table.get('comic');
        if (!existing) return;

        const sourceField = existing.fields.find((f) => f.key === 'source');
        const options = sourceField?.options;
        if (!options || options.includes('Humble Bundle')) return;

        const physicalIndex = options.indexOf('Physical');
        if (physicalIndex === -1) return;

        const newOptions = [
          ...options.slice(0, physicalIndex + 1),
          'Humble Bundle',
          ...options.slice(physicalIndex + 1),
        ];
        const updatedFields = existing.fields.map((f) =>
          f.key === 'source' ? { ...f, options: newOptions } : f,
        );
        await table.update('comic', { fields: updatedFields });
      });

    /**
     * Version 15:
     *  - Renames the TV media type's displayName from "Television
     *    Season" to "TV Season" (label only — id stays 'tv', no data
     *    affected).
     *  - Adds "Global Comix", "Comichaus" and "Webtoons" to the Comic
     *    Issues Source suggestion list. Magazine Issues is deliberately
     *    left untouched, as with the Digital/Humble Bundle additions.
     *  - Backfills `genres: []` on every existing entry so the new
     *    Genre field/filter has a consistent array to work with.
     *
     * All three steps are guarded so a row that's already been
     * customised (or already migrated) is left untouched.
     */
    this.version(15)
      .stores({
        mediaEntries:
          'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
        mediaTypes: 'id, enabled',
        appSettings: 'key',
        inProgressEntries: null,
      })
      .upgrade(async (tx) => {
        const mediaTypeTable = tx.table<MediaType>('mediaTypes');

        const tvType = await mediaTypeTable.get('tv');
        if (tvType && tvType.displayName === 'Television Season') {
          await mediaTypeTable.update('tv', { displayName: 'TV Season' });
        }

        const comicType = await mediaTypeTable.get('comic');
        if (comicType) {
          const sourceField = comicType.fields.find((f) => f.key === 'source');
          const options = sourceField?.options;
          if (options) {
            const additions = ['Global Comix', 'Comichaus', 'Webtoons'].filter(
              (o) => !options.includes(o),
            );
            if (additions.length > 0) {
              const updatedFields = comicType.fields.map((f) =>
                f.key === 'source' ? { ...f, options: [...options, ...additions] } : f,
              );
              await mediaTypeTable.update('comic', { fields: updatedFields });
            }
          }
        }

        const entryTable = tx.table<MediaEntry>('mediaEntries');
        await entryTable.toCollection().modify((entry) => {
          if (entry.genres === undefined) {
            entry.genres = [];
          }
        });
      });

    /**
     * Version 16: adds the new TMDB auto-fill metadata fields to Film and
     * TV — `runtime`, `productionCompany`/`network`, `series`, and (TV
     * only) `tvStatus`. Population itself is opt-in per field via
     * Settings > Metadata auto-fill (see AppSettings.ts); this migration
     * only adds the field *definitions* so Media Details renders them
     * and entrySchemas.ts's per-type schema doesn't strip values once
     * TMDB starts supplying them. `overview` and `posterPath` are also
     * new metadata keys as of this version but aren't added to
     * `fields[]` here — they get bespoke UI in EntryForm rather than the
     * generic field loop, so there's no field-definition row for them.
     *
     * No existing entry data is touched — every new key is optional and
     * simply absent from `metadata` until the user re-runs auto-fill or
     * enters a value manually.
     */
    this.version(16)
      .stores({
        mediaEntries:
          'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
        mediaTypes: 'id, enabled',
        appSettings: 'key',
        inProgressEntries: null,
      })
      .upgrade(async (tx) => {
        const table = tx.table<MediaType>('mediaTypes');

        const film = await table.get('film');
        if (film) {
          const existingKeys = new Set(film.fields.map((f) => f.key));
          const toAdd: MediaType['fields'] = [];
          if (!existingKeys.has('runtime'))
            toAdd.push({
              key: 'runtime',
              label: 'Runtime (minutes)',
              type: 'number',
              required: false,
            });
          if (!existingKeys.has('productionCompany'))
            toAdd.push({
              key: 'productionCompany',
              label: 'Production company',
              type: 'text',
              required: false,
            });
          if (!existingKeys.has('series'))
            toAdd.push({ key: 'series', label: 'Series', type: 'text', required: false });
          if (toAdd.length > 0)
            await table.put({ ...film, fields: [...film.fields, ...toAdd] });
        }

        const tv = await table.get('tv');
        if (tv) {
          const existingKeys = new Set(tv.fields.map((f) => f.key));
          const toAdd: MediaType['fields'] = [];
          if (!existingKeys.has('network'))
            toAdd.push({
              key: 'network',
              label: 'Network',
              type: 'text',
              required: false,
            });
          if (!existingKeys.has('runtime'))
            toAdd.push({
              key: 'runtime',
              label: 'Runtime (minutes)',
              type: 'number',
              required: false,
            });
          if (!existingKeys.has('tvStatus'))
            toAdd.push({
              key: 'tvStatus',
              label: 'Status',
              type: 'text',
              required: false,
            });
          if (!existingKeys.has('series'))
            toAdd.push({ key: 'series', label: 'Series', type: 'text', required: false });
          if (toAdd.length > 0)
            await table.put({ ...tv, fields: [...tv.fields, ...toAdd] });
        }
      });

    /**
     * Version 17: adds the new ComicVine auto-fill metadata fields to
     * Comic Issues — `publisher`, `issueTitle`, `coverDate`, and the
     * seven creator credit fields (`writer`, `penciller`, `inker`,
     * `colorist`, `letterer`, `coverArtist`, `editor`). Same shape as
     * the version 16 migration: only adds field *definitions* so Media
     * Details renders them and comicMetadataSchema (entrySchemas.ts)
     * doesn't strip values once ComicVine starts supplying them.
     * `coverImagePath` is also a new metadata key as of this version
     * but isn't added to `fields[]` here — bespoke UI in EntryForm,
     * same as Film/TV's `posterPath`.
     *
     * Deliberately scoped to Comic Issues only — Magazine Issues keeps
     * its own field set (per David's instruction that Comic and
     * Magazine changes stay separate unless he says otherwise).
     *
     * No existing entry data is touched — every new key is optional and
     * simply absent from `metadata` until the user re-runs auto-fill or
     * enters a value manually.
     */
    this.version(17)
      .stores({
        mediaEntries:
          'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
        mediaTypes: 'id, enabled',
        appSettings: 'key',
        inProgressEntries: null,
      })
      .upgrade(async (tx) => {
        const table = tx.table<MediaType>('mediaTypes');

        const comic = await table.get('comic');
        if (comic) {
          const existingKeys = new Set(comic.fields.map((f) => f.key));
          const toAdd: MediaType['fields'] = [];
          if (!existingKeys.has('publisher'))
            toAdd.push({
              key: 'publisher',
              label: 'Publisher',
              type: 'text',
              required: false,
            });
          if (!existingKeys.has('issueTitle'))
            toAdd.push({
              key: 'issueTitle',
              label: 'Issue title',
              type: 'text',
              required: false,
            });
          if (!existingKeys.has('coverDate'))
            toAdd.push({
              key: 'coverDate',
              label: 'Cover date',
              type: 'text',
              required: false,
            });
          if (!existingKeys.has('writer'))
            toAdd.push({ key: 'writer', label: 'Writer', type: 'text', required: false });
          if (!existingKeys.has('penciller'))
            toAdd.push({
              key: 'penciller',
              label: 'Penciller',
              type: 'text',
              required: false,
            });
          if (!existingKeys.has('inker'))
            toAdd.push({ key: 'inker', label: 'Inker', type: 'text', required: false });
          if (!existingKeys.has('colorist'))
            toAdd.push({
              key: 'colorist',
              label: 'Colorist',
              type: 'text',
              required: false,
            });
          if (!existingKeys.has('letterer'))
            toAdd.push({
              key: 'letterer',
              label: 'Letterer',
              type: 'text',
              required: false,
            });
          if (!existingKeys.has('coverArtist'))
            toAdd.push({
              key: 'coverArtist',
              label: 'Cover artist',
              type: 'text',
              required: false,
            });
          if (!existingKeys.has('editor'))
            toAdd.push({ key: 'editor', label: 'Editor', type: 'text', required: false });
          if (toAdd.length > 0)
            await table.put({ ...comic, fields: [...comic.fields, ...toAdd] });
        }
      });

    /**
     * Version 18: adds three new media types — Sports, Anime, Manga —
     * for existing installs (fresh installs already get them via
     * seed.ts/defaultMediaTypes.ts). Guarded with `get`/`add` (not
     * `bulkAdd`) so re-running this migration, or a user who already
     * manually created a media type with one of these ids, doesn't
     * clobber existing data.
     *
     * No `mediaEntries` changes — these are brand new types with no
     * prior entries to migrate.
     */
    this.version(18)
      .stores({
        mediaEntries:
          'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
        mediaTypes: 'id, enabled',
        appSettings: 'key',
        inProgressEntries: null,
      })
      .upgrade(async (tx) => {
        const table = tx.table<MediaType>('mediaTypes');
        for (const newType of defaultMediaTypes.filter((t) =>
          ['sport', 'anime', 'manga'].includes(t.id),
        )) {
          const existing = await table.get(newType.id);
          if (!existing) {
            await table.add(newType);
          }
        }
      });

    /**
     * Version 19: fixes two icon problems from version 18:
     *   • Sports (`sports_soccer`) and Anime (`live_tv`) referenced icon
     *     keys that were never registered in mediaTypeIcon.tsx, so they
     *     rendered as the generic fallback icon instead of anything
     *     meaningful. The keys themselves were always correct — this
     *     migration doesn't need to change the stored value, only
     *     mediaTypeIcon.tsx (a code change, not a data migration) needed
     *     fixing. Included here as a no-op pass so the version history
     *     stays an accurate record of what changed and why.
     *   • Manga was given the same icon key (`auto_stories`) as Comics,
     *     making the two indistinguishable in any icon-only UI. This
     *     patches existing installs to the new dedicated `remove_red_eye`
     *     key — guarded so a user who's since manually changed Manga's
     *     icon in Settings keeps their choice rather than being
     *     overwritten.
     */
    this.version(19)
      .stores({
        mediaEntries:
          'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
        mediaTypes: 'id, enabled',
        appSettings: 'key',
        inProgressEntries: null,
      })
      .upgrade(async (tx) => {
        const table = tx.table<MediaType>('mediaTypes');
        const manga = await table.get('manga');
        if (manga && manga.icon === 'auto_stories') {
          await table.update('manga', { icon: 'remove_red_eye' });
        }
      });

    /**
     * Version 20: adds a `source` field to the Anime media type
     * (Crunchyroll, Netflix, HIDIVE, etc.), mirroring the field Film
     * and TV already have. Added for the Subscription Value statistics
     * feature — Anime is grouped with Film/TV there, which requires it
     * to carry the same "where did you watch this" data. Guarded with
     * `existingKeys` (same pattern as version 17's Comic migration) so
     * re-running this, or a user who's already added their own
     * `source` field to Anime, doesn't clobber anything. Existing
     * Anime entries simply have no value for the new field until
     * edited — same as every other optional field added after the
     * fact.
     */
    this.version(20)
      .stores({
        mediaEntries:
          'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
        mediaTypes: 'id, enabled',
        appSettings: 'key',
        inProgressEntries: null,
      })
      .upgrade(async (tx) => {
        const table = tx.table<MediaType>('mediaTypes');
        const anime = await table.get('anime');
        if (anime) {
          const existingKeys = new Set(anime.fields.map((f) => f.key));
          if (!existingKeys.has('source')) {
            const sourceField: MediaType['fields'][number] = {
              key: 'source',
              label: 'Source',
              type: 'autocomplete',
              required: false,
              options: [
                'Crunchyroll',
                'Netflix',
                'HIDIVE',
                'Funimation',
                'Disney+',
                'Physical Media',
                'Digital',
              ],
            };
            // Insert right after 'format' to match defaultMediaTypes.ts's
            // field order for fresh installs, falling back to appending
            // at the end if 'format' isn't found for some reason.
            const formatIndex = anime.fields.findIndex((f) => f.key === 'format');
            const fields = [...anime.fields];
            if (formatIndex >= 0) {
              fields.splice(formatIndex + 1, 0, sourceField);
            } else {
              fields.push(sourceField);
            }
            await table.put({ ...anime, fields });
          }
        }
      });

    /**
     * Version 21: adds British streaming services (BBC iPlayer, ITVX,
     * Channel 4/All 4, Channel 5/My5, Sky/NOW, BritBox) to the Source
     * options for Film, TV, and Anime on existing installs — fresh
     * installs already get them via seed.ts/defaultMediaTypes.ts.
     *
     * `source` is a freeSolo autocomplete field (AutocompleteField.tsx),
     * so users could already type these values manually; this just adds
     * them to the suggestion list. Guarded per-option with `existingKeys`
     * (same pattern as version 17/20) so re-running this, or a user who's
     * already added one of these themselves, doesn't create duplicates.
     * No `mediaEntries` changes — existing entries' `metadata.source`
     * values are untouched either way.
     */
    this.version(21)
      .stores({
        mediaEntries:
          'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
        mediaTypes: 'id, enabled',
        appSettings: 'key',
        inProgressEntries: null,
      })
      .upgrade(async (tx) => {
        const table = tx.table<MediaType>('mediaTypes');
        const britishServices = [
          'BBC iPlayer',
          'ITVX',
          'Channel 4 (All 4)',
          'Channel 5 (My5)',
          'Sky/NOW',
          'BritBox',
        ];

        for (const typeId of ['film', 'tv', 'anime']) {
          const mediaType = await table.get(typeId);
          if (!mediaType) continue;
          const fields = mediaType.fields.map((field) => {
            if (field.key !== 'source' || field.type !== 'autocomplete') return field;
            const existingOptions = new Set(field.options ?? []);
            const toAdd = britishServices.filter((s) => !existingOptions.has(s));
            if (toAdd.length === 0) return field;
            return { ...field, options: [...(field.options ?? []), ...toAdd] };
          });
          await table.put({ ...mediaType, fields });
        }
      });

    /**
     * Version 22: adds a Release Year field to Book (number, Open
     * Library auto-fill via `first_publish_year`) and a Release Date
     * field to Film and TV (date, TMDB auto-fill via `release_date`/
     * `first_air_date`) on existing installs — fresh installs already
     * get these via seed.ts/defaultMediaTypes.ts. Guarded per-type with
     * `existingKeys` (same pattern as version 20/21) so re-running this
     * doesn't duplicate the field. No `mediaEntries` changes — this
     * only affects the media type's field *definitions*, not any
     * entry's stored metadata.
     */
    this.version(22)
      .stores({
        mediaEntries:
          'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
        mediaTypes: 'id, enabled',
        appSettings: 'key',
        inProgressEntries: null,
      })
      .upgrade(async (tx) => {
        const table = tx.table<MediaType>('mediaTypes');

        const book = await table.get('book');
        if (book && !book.fields.some((f) => f.key === 'releaseYear')) {
          await table.put({
            ...book,
            fields: [
              ...book.fields,
              { key: 'releaseYear', label: 'Release Year', type: 'number', required: false },
            ],
          });
        }

        for (const typeId of ['film', 'tv']) {
          const mediaType = await table.get(typeId);
          if (!mediaType || mediaType.fields.some((f) => f.key === 'releaseDate')) continue;
          await table.put({
            ...mediaType,
            fields: [
              ...mediaType.fields,
              { key: 'releaseDate', label: 'Release Date', type: 'date', required: false },
            ],
          });
        }
      });

    /**
     * Version 23: adds the `podcastSubscriptions` table (Podcast
     * Subscriptions — see chat). New table, so no `.upgrade()` step is
     * needed; Dexie creates it empty. Deliberately its own table
     * rather than a new field on an existing one — a subscription
     * isn't a `mediaEntry` (it's not something the user rates or
     * reviews), and it isn't an `appSetting` either (there can be many
     * of them, each with real per-row state: last-checked time, show
     * artwork). Episodes a "Check for New Episodes" run finds are
     * created as ordinary Wishlist `mediaEntries` (mediaType
     * `podcast`), tagged back here via
     * `metadata.podcastSubscriptionId` — see
     * podcastSubscriptionService.ts / checkForNewEpisodes.ts.
     */
    this.version(23).stores({
      mediaEntries:
        'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
      mediaTypes: 'id, enabled',
      appSettings: 'key',
      inProgressEntries: null,
      podcastSubscriptions: 'id, feedUrl, createdAt',
    });

    /**
     * Version 24 (see chat): adds Season Number/Episode Number/
     * Duration fields to Podcasts, Podcast Addict and PodBean to its
     * Source options, and Paramount+ to Film/TV's Source options —
     * fresh installs already get all of these via
     * seed.ts/defaultMediaTypes.ts. Guarded per-field/per-option with
     * `existingKeys`/`existingOptions` (same pattern as version
     * 20/21/22) so re-running this doesn't duplicate anything. No
     * `mediaEntries` changes — this only affects media type field
     * *definitions*, not any entry's stored metadata (new Podcast
     * entries pick up the fields going forward; existing ones are
     * unaffected until edited, same as every other field added this
     * way).
     */
    this.version(24)
      .stores({
        mediaEntries:
          'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
        mediaTypes: 'id, enabled',
        appSettings: 'key',
        inProgressEntries: null,
        podcastSubscriptions: 'id, feedUrl, createdAt',
      })
      .upgrade(async (tx) => {
        const table = tx.table<MediaType>('mediaTypes');

        const podcast = await table.get('podcast');
        if (podcast) {
          const existingKeys = new Set(podcast.fields.map((f) => f.key));
          const fields = podcast.fields.map((field) => {
            if (field.key !== 'source' || field.type !== 'autocomplete') return field;
            const existingOptions = new Set(field.options ?? []);
            const toAdd = ['Podcast Addict', 'PodBean'].filter((s) => !existingOptions.has(s));
            if (toAdd.length === 0) return field;
            return { ...field, options: [...(field.options ?? []), ...toAdd] };
          });
          if (!existingKeys.has('seasonNumber')) {
            fields.push({
              key: 'seasonNumber',
              label: 'Season Number',
              type: 'number',
              required: false,
            });
          }
          if (!existingKeys.has('episodeNumber')) {
            fields.push({
              key: 'episodeNumber',
              label: 'Episode Number',
              type: 'number',
              required: false,
            });
          }
          if (!existingKeys.has('duration')) {
            fields.push({
              key: 'duration',
              label: 'Duration (minutes)',
              type: 'number',
              required: false,
            });
          }
          await table.put({ ...podcast, fields });
        }

        for (const typeId of ['film', 'tv']) {
          const mediaType = await table.get(typeId);
          if (!mediaType) continue;
          const fields = mediaType.fields.map((field) => {
            if (field.key !== 'source' || field.type !== 'autocomplete') return field;
            const existingOptions = new Set(field.options ?? []);
            if (existingOptions.has('Paramount+')) return field;
            return { ...field, options: [...(field.options ?? []), 'Paramount+'] };
          });
          await table.put({ ...mediaType, fields });
        }
      });

    /**
     * Version 25 (see chat, Aug 2026): one-time backfill mapping
     * Book/Audiobook entries' `genres` — previously raw Open Library
     * `subject` strings (noisy LCSH tags) — onto the fixed vocabulary
     * in openLibraryGenreMap.ts. Deliberate hard overwrite, not
     * additive: David explicitly accepted that any manually-edited
     * genre text on these entries that doesn't match a keyword or an
     * already-used genre elsewhere in the library will be dropped, and
     * declined a console log of affected entries. No `mediaTypes`
     * changes — this only touches stored entry data, not field
     * definitions, so it's a `.upgrade()` with an unchanged `.stores()`
     * (same pattern as version 6's metadata-only migration).
     *
     * `knownGenres` is computed once up front from every OTHER media
     * type's entries (Film, TV, Comics, etc. — genuinely curated genre
     * values) so a custom genre the user already typed elsewhere, e.g.
     * "Cyberpunk" on a Film entry, is available as a match target
     * here. Deliberately excludes Book/Audiobook entries' own
     * genres — at this point in the migration those are still the OLD
     * raw Open Library subject noise about to be overwritten, so
     * treating them as "known custom genres" would just let noise
     * re-match itself across entries instead of getting cleaned up.
     */
    this.version(25)
      .stores({
        mediaEntries:
          'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
        mediaTypes: 'id, enabled',
        appSettings: 'key',
        inProgressEntries: null,
        podcastSubscriptions: 'id, feedUrl, createdAt',
      })
      .upgrade(async (tx) => {
        const table = tx.table<MediaEntry>('mediaEntries');
        const allEntries = await table.toArray();

        const knownGenres = new Set<string>();
        for (const entry of allEntries) {
          if (entry.mediaType === 'book' || entry.mediaType === 'audiobook') continue;
          for (const genre of entry.genres ?? []) knownGenres.add(genre);
        }
        const knownGenresList = Array.from(knownGenres);

        for (const entry of allEntries) {
          if (entry.mediaType !== 'book' && entry.mediaType !== 'audiobook') continue;
          if (!entry.genres?.length) continue;
          const mapped = mapOpenLibrarySubjectsToGenres(entry.genres, knownGenresList);
          await table.update(entry.id, { genres: mapped });
        }
      });

    /**
     * Version 26 (see chat, Aug 2026): adds `series` to Anime and
     * `series`/`volumeNumber` to Manga's field definitions, needed for
     * "Find Next in Series" — both types previously had no
     * series-grouping field at all. Same guarded
     * `existingKeys`/append pattern as version 24's Podcast fields; no
     * `mediaEntries` changes — existing entries simply have these keys
     * absent from `metadata` until edited, same as every other field
     * added this way.
     */
    this.version(26)
      .stores({
        mediaEntries:
          'id, completedDate, mediaType, title, rating, completedYear, status, createdAt, [completedYear+mediaType], [completedDate+rating]',
        mediaTypes: 'id, enabled',
        appSettings: 'key',
        inProgressEntries: null,
        podcastSubscriptions: 'id, feedUrl, createdAt',
      })
      .upgrade(async (tx) => {
        const table = tx.table<MediaType>('mediaTypes');

        const anime = await table.get('anime');
        if (anime) {
          const existingKeys = new Set(anime.fields.map((f) => f.key));
          if (!existingKeys.has('series')) {
            const seasonIndex = anime.fields.findIndex((f) => f.key === 'seasonNumber');
            const fields = [...anime.fields];
            const newField = { key: 'series', label: 'Series', type: 'text' as const, required: false };
            // Inserted right after seasonNumber to match the order
            // seen in the field list elsewhere (Number, then Series),
            // falling back to appending if seasonNumber is somehow
            // absent.
            if (seasonIndex >= 0) fields.splice(seasonIndex + 1, 0, newField);
            else fields.push(newField);
            await table.put({ ...anime, fields });
          }
        }

        const manga = await table.get('manga');
        if (manga) {
          const existingKeys = new Set(manga.fields.map((f) => f.key));
          const toAdd: MediaType['fields'] = [];
          if (!existingKeys.has('series')) {
            toAdd.push({ key: 'series', label: 'Series', type: 'text', required: false });
          }
          if (!existingKeys.has('volumeNumber')) {
            toAdd.push({ key: 'volumeNumber', label: 'Volume Number', type: 'number', required: false });
          }
          if (toAdd.length > 0) {
            // Inserted right after `author` (index 0), same "new
            // series-identity fields near the top" placement as Anime
            // above.
            const authorIndex = manga.fields.findIndex((f) => f.key === 'author');
            const fields = [...manga.fields];
            fields.splice(authorIndex >= 0 ? authorIndex + 1 : 0, 0, ...toAdd);
            await table.put({ ...manga, fields });
          }
        }
      });
  }
}

export const db = new MediaJournalDatabase();
