import { db } from './db';
import type { MediaEntry, NewMediaEntryInput, MediaEntryUpdate, EntryStatus } from '@/models';
import { generateId } from '@/utils/id';
import { nowIso, yearOf } from '@/utils/dateUtils';
import { mediaEntrySchema, getMetadataSchema } from '@/services/validation/entrySchemas';

function validateEntry(entry: NewMediaEntryInput): void {
  mediaEntrySchema.parse(entry);
  getMetadataSchema(entry.mediaType).parse(entry.metadata);
}

export async function createEntry(input: NewMediaEntryInput): Promise<MediaEntry> {
  validateEntry(input);

  const timestamp = nowIso();
  const entry: MediaEntry = {
    ...input,
    id: generateId(),
    completedYear:
      input.completedDate ? yearOf(input.completedDate) : undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await db.mediaEntries.add(entry);
  return entry;
}

export async function getEntry(id: string): Promise<MediaEntry | undefined> {
  return db.mediaEntries.get(id);
}

export async function updateEntry(
  id: string,
  patch: MediaEntryUpdate,
): Promise<MediaEntry> {
  const existing = await db.mediaEntries.get(id);
  if (!existing) throw new Error(`Entry not found: ${id}`);

  const merged: NewMediaEntryInput = {
    title: patch.title ?? existing.title,
    mediaType: patch.mediaType ?? existing.mediaType,
    status: patch.status ?? existing.status ?? 'completed',
    startedDate: patch.startedDate ?? existing.startedDate,
    completedDate: patch.completedDate ?? existing.completedDate,
    rating: patch.rating ?? existing.rating,
    notes: patch.notes ?? existing.notes,
    repeatConsumption: patch.repeatConsumption ?? existing.repeatConsumption,
    tags: patch.tags ?? existing.tags ?? [],
    metadata: patch.metadata ?? existing.metadata,
  };

  validateEntry(merged);

  const updated: MediaEntry = {
    ...existing,
    ...merged,
    completedYear: merged.completedDate ? yearOf(merged.completedDate) : undefined,
    updatedAt: nowIso(),
  };

  await db.mediaEntries.put(updated);
  return updated;
}

/**
 * Moves an entry to a new status, handling date logic automatically:
 *   → completed: sets completedDate (today if not provided) and completedYear.
 *   → in_progress / wishlist: clears completedDate and completedYear.
 */
export async function updateEntryStatus(
  id: string,
  status: EntryStatus,
  completedDate?: string,
): Promise<void> {
  const existing = await db.mediaEntries.get(id);
  if (!existing) throw new Error(`Entry not found: ${id}`);

  const update: Partial<MediaEntry> = { status, updatedAt: nowIso() };

  if (status === 'completed') {
    const date = completedDate ?? existing.completedDate;
    update.completedDate = date;
    update.completedYear = date ? yearOf(date) : undefined;
  } else {
    update.completedDate = undefined;
    update.completedYear = undefined;
  }

  await db.mediaEntries.update(id, update);
}

export async function deleteEntry(id: string): Promise<void> {
  await db.mediaEntries.delete(id);
}

export async function deleteEntries(ids: string[]): Promise<void> {
  await db.mediaEntries.bulkDelete(ids);
}

export async function duplicateEntry(id: string): Promise<MediaEntry> {
  const existing = await db.mediaEntries.get(id);
  if (!existing) throw new Error(`Entry not found: ${id}`);
  const { id: _id, completedYear: _year, createdAt: _ca, updatedAt: _ua, ...rest } = existing;
  return createEntry(rest);
}

export async function bulkAddTag(ids: string[], tag: string): Promise<void> {
  const entries = await db.mediaEntries.bulkGet(ids);
  const updates = entries
    .filter((e): e is MediaEntry => e !== undefined)
    .map((e) => ({
      ...e,
      tags: Array.from(new Set([...(e.tags ?? []), tag])),
      updatedAt: nowIso(),
    }));
  await db.mediaEntries.bulkPut(updates);
}

export async function bulkSetRating(ids: string[], rating: number): Promise<void> {
  const entries = await db.mediaEntries.bulkGet(ids);
  const updates = entries
    .filter((e): e is MediaEntry => e !== undefined)
    .map((e) => ({ ...e, rating, updatedAt: nowIso() }));
  await db.mediaEntries.bulkPut(updates);
}

export interface EntryListFilter {
  year?: number;
  month?: number;
  mediaType?: string;
  searchText?: string;
  tag?: string;
  /** Filters to entries whose `metadata.source` matches exactly (e.g.
   * "Netflix", "Audible"). Cross-media-type, like Tag. */
  source?: string;
  /** Defaults to 'completed' when not provided so existing callers
   * (Dashboard, Statistics) see only finished entries. */
  status?: EntryStatus;
}

export type EntrySortOrder =
  | 'completedDateDesc'
  | 'completedDateAsc'
  | 'alphabetical'
  | 'ratingDesc'
  | 'ratingAsc'
  | 'createdAtDesc'
  | 'createdAtAsc'
  | 'byType';

export const TYPE_SORT_ORDER: Record<string, number> = {
  book: 0, audiobook: 1, comic: 2, film: 3, tv: 4,
};

export async function listEntries(
  filter: EntryListFilter = {},
  sort: EntrySortOrder = 'completedDateDesc',
): Promise<MediaEntry[]> {
  const targetStatus = filter.status ?? 'completed';

  let entries: MediaEntry[];

  if (filter.year !== undefined && targetStatus === 'completed') {
    entries = await db.mediaEntries
      .where('completedYear')
      .equals(filter.year)
      .filter((e) => e.status === 'completed')
      .toArray();
  } else {
    entries = await db.mediaEntries
      .where('status')
      .equals(targetStatus)
      .toArray();
    if (filter.year !== undefined) {
      entries = entries.filter((e) => e.completedYear === filter.year);
    }
  }

  if (filter.month !== undefined) {
    entries = entries.filter(
      (e) => e.completedDate !== undefined &&
        new Date(e.completedDate).getMonth() + 1 === filter.month,
    );
  }
  if (filter.mediaType) {
    entries = entries.filter((e) => e.mediaType === filter.mediaType);
  }
  if (filter.searchText) {
    const needle = filter.searchText.trim().toLowerCase();
    if (needle) {
      entries = entries.filter((e) => {
        if (e.title.toLowerCase().includes(needle)) return true;
        return Object.values(e.metadata)
          .filter((v): v is string => typeof v === 'string')
          .some((v) => v.toLowerCase().includes(needle));
      });
    }
  }
  if (filter.tag !== undefined) {
    entries = entries.filter((e) => (e.tags ?? []).includes(filter.tag!));
  }
  if (filter.source !== undefined) {
    entries = entries.filter((e) => e.metadata.source === filter.source);
  }

  return sortEntries(entries, sort);
}

function sortEntries(entries: MediaEntry[], sort: EntrySortOrder): MediaEntry[] {
  const sorted = [...entries];
  switch (sort) {
    case 'completedDateDesc':
      return sorted.sort((a, b) => (b.completedDate ?? '').localeCompare(a.completedDate ?? ''));
    case 'completedDateAsc':
      return sorted.sort((a, b) => (a.completedDate ?? '').localeCompare(b.completedDate ?? ''));
    case 'alphabetical':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case 'ratingDesc':
      return sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    case 'ratingAsc':
      return sorted.sort((a, b) => (a.rating ?? 11) - (b.rating ?? 11));
    case 'createdAtDesc':
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case 'createdAtAsc':
      return sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case 'byType':
      return sorted.sort((a, b) => {
        const orderA = TYPE_SORT_ORDER[a.mediaType] ?? 99;
        const orderB = TYPE_SORT_ORDER[b.mediaType] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.title.localeCompare(b.title);
      });
  }
}
