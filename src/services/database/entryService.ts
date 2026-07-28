import { db } from './db';
import type { MediaEntry, NewMediaEntryInput, MediaEntryUpdate, EntryStatus } from '@/models';
import { generateId } from '@/utils/id';
import { nowIso, yearOf, todayIso } from '@/utils/dateUtils';
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
    genres: patch.genres ?? existing.genres ?? [],
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
 *   → in_progress: clears completedDate/completedYear; defaults
 *     startedDate to today if it doesn't already have one, so the
 *     entry has something to place it on the Timeline (which renders
 *     in_progress entries as running from start to today) — matters
 *     most for the Library "Start tracking" quick action, which has no
 *     date field of its own for the person to fill in.
 *   → wishlist: clears completedDate and completedYear.
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
    if (status === 'in_progress' && !existing.startedDate) {
      update.startedDate = todayIso();
    }
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

export async function bulkAddTags(ids: string[], tags: string[]): Promise<void> {
  const entries = await db.mediaEntries.bulkGet(ids);
  const updates = entries
    .filter((e): e is MediaEntry => e !== undefined)
    .map((e) => ({
      ...e,
      tags: Array.from(new Set([...(e.tags ?? []), ...tags])),
      updatedAt: nowIso(),
    }));
  await db.mediaEntries.bulkPut(updates);
}

/** Adds genres to every selected entry, merging with whatever each
 * entry already has. Mirrors `bulkAddTags`. */
export async function bulkAddGenres(ids: string[], genres: string[]): Promise<void> {
  const entries = await db.mediaEntries.bulkGet(ids);
  const updates = entries
    .filter((e): e is MediaEntry => e !== undefined)
    .map((e) => ({
      ...e,
      genres: Array.from(new Set([...(e.genres ?? []), ...genres])),
      updatedAt: nowIso(),
    }));
  await db.mediaEntries.bulkPut(updates);
}

/** Sets `metadata.source` to the same value on every selected entry,
 * regardless of media type — every type's metadata schema includes an
 * optional `source` field, so this is safe across a mixed-type
 * selection (e.g. Film + Comic selected together). */
export async function bulkSetSource(ids: string[], source: string): Promise<void> {
  const entries = await db.mediaEntries.bulkGet(ids);
  const updates = entries
    .filter((e): e is MediaEntry => e !== undefined)
    .map((e) => ({ ...e, metadata: { ...e.metadata, source }, updatedAt: nowIso() }));
  await db.mediaEntries.bulkPut(updates);
}

export async function bulkSetRating(ids: string[], rating: number): Promise<void> {
  const entries = await db.mediaEntries.bulkGet(ids);
  const updates = entries
    .filter((e): e is MediaEntry => e !== undefined)
    .map((e) => ({ ...e, rating, updatedAt: nowIso() }));
  await db.mediaEntries.bulkPut(updates);
}

/**
 * Ensures every current Wishlist entry has an explicit `wishlistOrder`,
 * assigning sequential values (0, 1, 2…) in "Newest added" order to any
 * that don't yet — called once when Reorder mode is entered so the
 * arrow-swap logic always has real numbers to work with. A no-op (no
 * writes) if every Wishlist entry already has a value, so repeated
 * calls are safe.
 */
export async function normalizeWishlistOrder(): Promise<void> {
  const wishlist = await db.mediaEntries.where('status').equals('wishlist').toArray();
  const missing = wishlist.filter((e) => e.wishlistOrder === undefined);
  if (missing.length === 0) return;

  const alreadyOrdered = wishlist.filter((e) => e.wishlistOrder !== undefined);
  const nextStart = alreadyOrdered.length > 0
    ? Math.max(...alreadyOrdered.map((e) => e.wishlistOrder!)) + 1
    : 0;

  const sortedMissing = [...missing].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const updates = sortedMissing.map((e, i) => ({ ...e, wishlistOrder: nextStart + i }));
  await db.mediaEntries.bulkPut(updates);
}

/** Swaps the saved `wishlistOrder` of two Wishlist entries — used by
 * the Library's Reorder mode up/down arrows, which always move an
 * entry one position at a time against its immediate neighbour in the
 * currently displayed (unfiltered) "My Order" list. */
export async function swapWishlistOrder(idA: string, idB: string): Promise<void> {
  const [a, b] = await db.mediaEntries.bulkGet([idA, idB]);
  if (!a || !b || a.wishlistOrder === undefined || b.wishlistOrder === undefined) return;
  await db.mediaEntries.bulkPut([
    { ...a, wishlistOrder: b.wishlistOrder, updatedAt: nowIso() },
    { ...b, wishlistOrder: a.wishlistOrder, updatedAt: nowIso() },
  ]);
}

/** Moves a Wishlist entry directly to `newPosition` (1-based, clamped
 * to the list bounds) — the "tap the position number, type a new
 * position" jump, as opposed to swapWishlistOrder's single-step nudge.
 * Renumbers every entry in the Wishlist sequentially afterward, so
 * everything between the old and new position shifts by one to make
 * room, in whichever direction the move goes. O(n) writes (bulkPut
 * over the whole Wishlist) rather than a 1-2 row swap — an accepted
 * tradeoff for an arbitrary jump versus a single-step nudge (see
 * chat). */
export async function jumpWishlistOrder(id: string, newPosition: number): Promise<void> {
  const wishlist = await db.mediaEntries.where('status').equals('wishlist').toArray();
  const ordered = wishlist
    .filter((e) => e.wishlistOrder !== undefined)
    .sort((a, b) => a.wishlistOrder! - b.wishlistOrder!);

  const currentIndex = ordered.findIndex((e) => e.id === id);
  if (currentIndex === -1) return;
  const moved = ordered[currentIndex];
  if (!moved) return;

  ordered.splice(currentIndex, 1);
  const clampedIndex = Math.max(0, Math.min(newPosition - 1, ordered.length));
  ordered.splice(clampedIndex, 0, moved);

  const updates = ordered.map((e, i) => ({ ...e, wishlistOrder: i, updatedAt: nowIso() }));
  await db.mediaEntries.bulkPut(updates);
}

export interface EntryListFilter {
  year?: number;
  month?: number;
  /** OR-matched: an entry passes if its mediaType is any of these. */
  mediaTypeIds?: string[];
  searchText?: string;
  /** OR-matched against `tags` — an entry passes if it has any of these. */
  tags?: string[];
  /** OR-matched against `genres` — an entry passes if it has any of
   * these. Cross-media-type, same shape as Tags. */
  genres?: string[];
  /** OR-matched against `metadata.source` — an entry passes if its
   * source is any of these (e.g. "Netflix", "Audible"). Cross-media-type,
   * like Tags. */
  sources?: string[];
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
  | 'byType'
  | 'wishlistOrderAsc';

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
  if (filter.mediaTypeIds && filter.mediaTypeIds.length > 0) {
    const ids = filter.mediaTypeIds;
    entries = entries.filter((e) => ids.includes(e.mediaType));
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
  if (filter.tags && filter.tags.length > 0) {
    const tags = filter.tags;
    entries = entries.filter((e) => (e.tags ?? []).some((t) => tags.includes(t)));
  }
  if (filter.genres && filter.genres.length > 0) {
    const genres = filter.genres;
    entries = entries.filter((e) => (e.genres ?? []).some((g) => genres.includes(g)));
  }
  if (filter.sources && filter.sources.length > 0) {
    const sources = filter.sources;
    entries = entries.filter((e) => typeof e.metadata.source === 'string' && sources.includes(e.metadata.source));
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
    case 'wishlistOrderAsc':
      // Entries without an explicit wishlistOrder yet (never reordered)
      // sort after every explicitly-ordered entry, in "Newest added"
      // order among themselves — matches the Wishlist's previous
      // default so the list looks unchanged until the user actually
      // starts reordering. normalizeWishlistOrder backfills real
      // values the first time reorder mode is entered.
      return sorted.sort((a, b) => {
        if (a.wishlistOrder !== undefined && b.wishlistOrder !== undefined) {
          return a.wishlistOrder - b.wishlistOrder;
        }
        if (a.wishlistOrder !== undefined) return -1;
        if (b.wishlistOrder !== undefined) return 1;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }
}
