import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';

export interface FieldCount {
  value: string;
  /** How many of the selected entries currently have this value. */
  count: number;
}

/**
 * Returns every distinct genre, tag, watched-with or recommended-by
 * name present across the given set of entry ids, each with how many
 * of those entries have it — e.g. "Sci-Fi (4 of 6)". Powers the
 * Remove-mode autocomplete in BulkActionBar's Genre/Tag/Watched With/
 * Recommended By dialogs, which is deliberately scoped to the current
 * selection only (unlike Add mode's library-wide `useAvailableGenres`/
 * `useAvailableTags`/`useAvailableWatchedWith`/`useAvailableRecommendedBy`)
 * — removing a value no entry in the selection has would always be a
 * no-op, so it shouldn't be offered as an option. Sorted by count
 * descending (most common first), then alphabetically.
 */
export function useSelectionFieldCounts(
  ids: string[],
  field: 'genres' | 'tags' | 'watchedWith' | 'recommendedBy',
): FieldCount[] {
  return (
    useLiveQuery(async () => {
      if (ids.length === 0) return [];
      const entries = await db.mediaEntries.bulkGet(ids);
      const counts = new Map<string, number>();
      for (const entry of entries) {
        if (!entry) continue;
        for (const value of entry[field] ?? []) {
          counts.set(value, (counts.get(value) ?? 0) + 1);
        }
      }
      return Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    }, [ids.join(','), field]) ?? []
  );
}
