import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';

/**
 * Returns a sorted list of every distinct name that appears in any
 * entry's `recommendedBy` across the library. Mirrors
 * `useAvailableTags`/`useAvailableWatchedWith` — powers the
 * autocomplete suggestions in `RecommendedByInput` and the Library's
 * Recommended By filter chip.
 */
export function useAvailableRecommendedBy(): string[] {
  return (
    useLiveQuery(async () => {
      const entries = await db.mediaEntries.toArray();
      const names = new Set<string>();
      for (const entry of entries) {
        for (const name of entry.recommendedBy ?? []) {
          names.add(name);
        }
      }
      return Array.from(names).sort();
    }, []) ?? []
  );
}
