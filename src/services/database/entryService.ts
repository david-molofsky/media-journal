import { db } from './db';
import type { MediaEntry, NewMediaEntryInput, MediaEntryUpdate } from '@/models';
import { generateId } from '@/utils/id';
import { nowIso, yearOf } from '@/utils/dateUtils';
import { mediaEntrySchema, getMetadataSchema } from '@/services/validation/entrySchemas';

/**
 * Validates a candidate entry against both the common schema and the
 * metadata schema specific to its media type. Throws if invalid.
 */
function validateEntry(entry: NewMediaEntryInput): void {
  mediaEntrySchema.parse(entry);
  getMetadataSchema(entry.mediaType).parse(entry.metadata);
}

/**
 * Creates a new media entry.
 *
 * Business logic lives here, not in UI components (per the master
 * project instructions and Technical Architecture Document, section
 * 4): id generation, timestamps and the derived `completedYear` index
 * field are all handled in one place so every entry point (Add Entry
 * form, JSON import, duplication) stays consistent.
 */
export async function createEntry(input: NewMediaEntryInput): Promise<MediaEntry> {
  validateEntry(input);

  const timestamp = nowIso();
  const entry: MediaEntry = {
    ...input,
    id: generateId(),
    completedYear: yearOf(input.completedDate),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await db.mediaEntries.add(entry);
  return entry;
}

/** Fetches a single entry by id, or `undefined` if it doesn't exist. */
export async function getEntry(id: string): Promise<MediaEntry | undefined> {
  return db.mediaEntries.get(id);
}

/**
 * Updates an existing entry. Re-validates the merged result so a
 * partial update can never leave the record in an invalid state.
 */
export async function updateEntry(
  id: string,
  patch: MediaEntryUpdate,
): Promise<MediaEntry> {
  const existing = await db.mediaEntries.get(id);
  if (!existing) {
    throw new Error(`Entry not found: ${id}`);
  }

  const merged: NewMediaEntryInput = {
    title: patch.title ?? existing.title,
    mediaType: patch.mediaType ?? existing.mediaType,
    startedDate: patch.startedDate ?? existing.startedDate,
    completedDate: patch.completedDate ?? existing.completedDate,
    rating: patch.rating ?? existing.rating,
    notes: patch.notes ?? existing.notes,
    repeatConsumption: patch.repeatConsumption ?? existing.repeatConsumption,
    metadata: patch.metadata ?? existing.metadata,
  };
  validateEntry(merged);

  const updated: MediaEntry = {
    ...existing,
    ...merged,
    completedYear: yearOf(merged.completedDate),
    updatedAt: nowIso(),
  };

  await db.mediaEntries.put(updated);
  return updated;
}

/** Permanently deletes an entry. UI-level undo (Milestone 3) is
 * implemented by holding the deleted record in memory and re-creating
 * it via `createEntry` if the user undoes — this service stays simple
 * and has no concept of a "trash" state. */
export async function deleteEntry(id: string): Promise<void> {
  await db.mediaEntries.delete(id);
}

/**
 * Duplicates an existing entry. Per UI & UX Specification, section 7,
 * available as an action from the Edit Entry screen. The duplicate
 * gets a fresh id and timestamps; everything else is copied as-is,
 * leaving the user to adjust dates/rating/notes for the new instance
 * (e.g. a re-read logged as a new entry rather than the
 * `repeatConsumption` flag, which marks repeats of the *same* entry).
 */
export async function duplicateEntry(id: string): Promise<MediaEntry> {
  const existing = await db.mediaEntries.get(id);
  if (!existing) {
    throw new Error(`Entry not found: ${id}`);
  }

  const {
    id: _id,
    completedYear: _year,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...rest
  } = existing;
  return createEntry(rest);
}

export interface EntryListFilter {
  year?: number;
  month?: number;
  mediaType?: string;
  searchText?: string;
}

export type EntrySortOrder =
  'completedDateDesc' | 'completedDateAsc' | 'alphabetical' | 'ratingDesc' | 'ratingAsc';

/**
 * Lists entries matching the given filter, sorted as requested.
 *
 * This is the read path consumed by the Library (Milestone 4) and by
 * `hooks/useMediaEntries`, which wraps it in a Dexie live query. Kept
 * as a plain async function (rather than baked into the hook) so it
 * can also be reused by Statistics and Export without depending on
 * React.
 */
export async function listEntries(
  filter: EntryListFilter = {},
  sort: EntrySortOrder = 'completedDateDesc',
): Promise<MediaEntry[]> {
  let entries = await db.mediaEntries.toArray();

  if (filter.year !== undefined) {
    entries = entries.filter((entry) => entry.completedYear === filter.year);
  }
  if (filter.month !== undefined) {
    entries = entries.filter(
      (entry) => new Date(entry.completedDate).getMonth() + 1 === filter.month,
    );
  }
  if (filter.mediaType !== undefined) {
    entries = entries.filter((entry) => entry.mediaType === filter.mediaType);
  }
  if (filter.searchText) {
    const needle = filter.searchText.trim().toLowerCase();
    if (needle) {
      entries = entries.filter((entry) => entry.title.toLowerCase().includes(needle));
    }
  }

  return sortEntries(entries, sort);
}

function sortEntries(entries: MediaEntry[], sort: EntrySortOrder): MediaEntry[] {
  const sorted = [...entries];
  switch (sort) {
    case 'completedDateDesc':
      return sorted.sort((a, b) => b.completedDate.localeCompare(a.completedDate));
    case 'completedDateAsc':
      return sorted.sort((a, b) => a.completedDate.localeCompare(b.completedDate));
    case 'alphabetical':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case 'ratingDesc':
      return sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    case 'ratingAsc':
      return sorted.sort((a, b) => (a.rating ?? 11) - (b.rating ?? 11));
    default:
      return sorted;
  }
}
