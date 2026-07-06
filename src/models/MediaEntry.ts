/**
 * MediaEntry model.
 */

export type MetadataValue = string | number | boolean | undefined;
export type EntryMetadata = Record<string, MetadataValue>;

/**
 * Lifecycle status of an entry.
 *   completed  — fully consumed; appears in the Library and statistics.
 *   in_progress — started but not finished; start date optional, no
 *                 completion date. Invisible to statistics.
 *   wishlist    — not yet started; no dates. Invisible to statistics.
 */
export type EntryStatus = 'completed' | 'in_progress' | 'wishlist';

export interface MediaEntry {
  id: string;
  title: string;
  mediaType: string;
  /** Lifecycle status — defaults to 'completed' for all pre-existing
   * entries via the v6 DB migration. */
  status: EntryStatus;
  startedDate?: string;
  /** Required when status === 'completed'; absent for other statuses. */
  completedDate?: string;
  rating?: number;
  notes?: string;
  repeatConsumption: boolean;
  metadata: EntryMetadata;
  tags: string[];
  /** Freeform genre labels (e.g. "Fantasy", "Sci-Fi"), same shape and
   * conventions as `tags` but kept as a distinct field so Genre can be
   * its own filter/suggestion list rather than mixed in with Tags. */
  genres: string[];
  /**
   * Calendar year of `completedDate`, stored redundantly for indexing.
   * Absent for in_progress and wishlist entries. Always kept in sync
   * by entryService.
   */
  completedYear?: number;
  createdAt: string;
  updatedAt: string;
}

export type NewMediaEntryInput = Omit<
  MediaEntry,
  'id' | 'completedYear' | 'createdAt' | 'updatedAt'
>;

export type MediaEntryUpdate = Partial<NewMediaEntryInput>;
