import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';

/**
 * Returns a sorted list of every distinct name that appears in any
 * entry's `watchedWith` across the library. Mirrors `useAvailableTags`
 * — powers the autocomplete suggestions in `WatchedWithInput` and the
 * Library's Watched With filter chip. Shared across every media type,
 * so a name used on a Film entry also suggests on a Book entry.
 */
export function useAvailableWatchedWith(): string[] {
  return (
    useLiveQuery(async () => {
      const entries = await db.mediaEntries.toArray();
      const names = new Set<string>();
      for (const entry of entries) {
        for (const name of entry.watchedWith ?? []) {
          names.add(name);
        }
      }
      return Array.from(names).sort();
    }, []) ?? []
  );
}
